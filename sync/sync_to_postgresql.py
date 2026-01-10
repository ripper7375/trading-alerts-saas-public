#!/usr/bin/env python3
"""
SQLite to PostgreSQL Sync Script
Part 20 - Trading Alerts SaaS

Syncs indicator data from local SQLite (MT5 data) to cloud PostgreSQL.
Filters data into appropriate timeframe tables (135 total: 15 symbols × 9 timeframes).

Usage:
    python sync_to_postgresql.py

The script is designed to run via cron every 30 seconds on Contabo VPS.
"""

import json
import logging
import os
import sys
import time
from datetime import datetime
from typing import Dict, List, Tuple, Any, Optional

from psycopg2.extras import execute_batch
from psycopg2 import Error as PgError

from config import (
    SYMBOLS,
    TIMEFRAMES,
    MAX_ROWS_PER_TABLE,
    SYNC_STATE_FILE,
    LOG_LEVEL,
    LOG_FORMAT,
    MAX_RETRIES,
    RETRY_DELAY_SECONDS,
    REALTIME_CANDLE_LIMIT,
    REDIS_REALTIME_TTL,
    ENABLE_REDIS_SYNC,
)
from timeframe_filter import filter_by_timeframe
from db_connections import (
    sqlite_connection,
    postgresql_connection,
    redis_connection,
    close_postgresql_pool,
    close_redis_pool,
)

# Configure logging
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL),
    format=LOG_FORMAT,
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("sync.log"),
    ],
)
logger = logging.getLogger(__name__)


class DataSyncer:
    """
    Synchronizes indicator data from SQLite to PostgreSQL.

    Handles:
    - Reading new data from SQLite tables
    - Filtering data by timeframe
    - Upserting data into PostgreSQL tables
    - Enforcing row limits per table
    - Persisting sync state between runs
    """

    def __init__(self):
        """Initialize the DataSyncer with empty sync state."""
        self.last_sync_timestamps: Dict[str, int] = {}
        self.load_sync_state()
        self.stats = {
            "symbols_synced": 0,
            "rows_synced": 0,
            "errors": 0,
            "start_time": None,
        }

    def load_sync_state(self) -> None:
        """
        Load last sync timestamps from state file.

        The state file tracks the last synced timestamp for each symbol,
        allowing the script to resume from where it left off.
        """
        try:
            if os.path.exists(SYNC_STATE_FILE):
                with open(SYNC_STATE_FILE, "r") as f:
                    self.last_sync_timestamps = json.load(f)
                logger.info(f"Loaded sync state from {SYNC_STATE_FILE}")
            else:
                # Initialize with 0 for all symbols (sync all data)
                self.last_sync_timestamps = {s: 0 for s in SYMBOLS}
                logger.info("No existing sync state, will sync all data")
        except (json.JSONDecodeError, IOError) as e:
            logger.warning(f"Failed to load sync state: {e}. Starting fresh.")
            self.last_sync_timestamps = {s: 0 for s in SYMBOLS}

    def save_sync_state(self) -> None:
        """
        Save sync state to file.

        Persists the last synced timestamp for each symbol so the next
        run can resume from where this run left off.
        """
        try:
            with open(SYNC_STATE_FILE, "w") as f:
                json.dump(self.last_sync_timestamps, f, indent=2)
            logger.debug(f"Saved sync state to {SYNC_STATE_FILE}")
        except IOError as e:
            logger.error(f"Failed to save sync state: {e}")

    def sync_symbol(self, symbol: str) -> bool:
        """
        Sync data for a single symbol from SQLite to PostgreSQL.

        Args:
            symbol: Trading symbol to sync (e.g., "EURUSD")

        Returns:
            True if sync was successful, False otherwise
        """
        logger.info(f"Syncing {symbol}...")

        try:
            # Get new data from SQLite
            with sqlite_connection() as sqlite_conn:
                cursor = sqlite_conn.cursor()
                last_ts = self.last_sync_timestamps.get(symbol, 0)

                # Query for new rows since last sync
                cursor.execute(
                    f"""
                    SELECT timestamp, open, high, low, close,
                           fractals, horizontal_trendlines, diagonal_trendlines,
                           momentum_candles, keltner_channels,
                           tema, hrma, smma, zigzag
                    FROM {symbol}
                    WHERE timestamp > ?
                    ORDER BY timestamp ASC
                    """,
                    (last_ts,),
                )

                rows = cursor.fetchall()

            if not rows:
                logger.debug(f"No new data for {symbol}")
                return True

            logger.info(f"Found {len(rows)} new rows for {symbol}")

            # Process data with PostgreSQL connection
            with postgresql_connection() as pg_conn:
                rows_synced = 0

                # Filter and insert into each timeframe table
                for timeframe in TIMEFRAMES:
                    filtered_rows = filter_by_timeframe(rows, timeframe)

                    if filtered_rows:
                        table_name = f"{symbol.lower()}_{timeframe.lower()}"
                        try:
                            self.insert_to_postgresql(pg_conn, table_name, filtered_rows)
                            self.enforce_row_limit(pg_conn, table_name)
                            rows_synced += len(filtered_rows)
                            logger.debug(
                                f"Inserted {len(filtered_rows)} rows into {table_name}"
                            )
                        except PgError as e:
                            logger.error(f"Error inserting into {table_name}: {e}")
                            raise

                # Update last sync timestamp to the most recent row
                self.last_sync_timestamps[symbol] = rows[-1][0]  # timestamp column
                self.stats["rows_synced"] += rows_synced

            # Sync to Redis (HOT tier) - raw 30-second data
            self.sync_realtime_to_redis(symbol, rows)

            logger.info(f"Synced {symbol}: {len(rows)} rows processed")
            return True

        except Exception as e:
            logger.error(f"Error syncing {symbol}: {e}")
            self.stats["errors"] += 1
            return False

    def insert_to_postgresql(
        self, conn, table_name: str, rows: List[Tuple]
    ) -> None:
        """
        Insert rows into PostgreSQL table using upsert.

        Uses ON CONFLICT DO UPDATE to handle duplicate timestamps.
        Converts Unix timestamps to PostgreSQL TIMESTAMPTZ.

        Args:
            conn: PostgreSQL connection
            table_name: Target table name (e.g., "eurusd_h1")
            rows: List of row tuples to insert
        """
        cursor = conn.cursor()

        # SQL with UPSERT (ON CONFLICT DO UPDATE)
        insert_sql = f"""
            INSERT INTO {table_name}
            (timestamp, open, high, low, close, fractals, horizontal_trendlines,
             diagonal_trendlines, momentum_candles, keltner_channels,
             tema, hrma, smma, zigzag)
            VALUES (to_timestamp(%s), %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (timestamp) DO UPDATE SET
                open = EXCLUDED.open,
                high = EXCLUDED.high,
                low = EXCLUDED.low,
                close = EXCLUDED.close,
                fractals = EXCLUDED.fractals,
                horizontal_trendlines = EXCLUDED.horizontal_trendlines,
                diagonal_trendlines = EXCLUDED.diagonal_trendlines,
                momentum_candles = EXCLUDED.momentum_candles,
                keltner_channels = EXCLUDED.keltner_channels,
                tema = EXCLUDED.tema,
                hrma = EXCLUDED.hrma,
                smma = EXCLUDED.smma,
                zigzag = EXCLUDED.zigzag
        """

        # Convert rows to list of tuples for execute_batch
        # Rows are already tuples from SQLite query
        data = [tuple(row) for row in rows]

        # Use execute_batch for better performance
        execute_batch(cursor, insert_sql, data, page_size=100)
        conn.commit()

        logger.debug(f"Inserted {len(rows)} rows into {table_name}")

    def enforce_row_limit(self, conn, table_name: str) -> None:
        """
        Delete oldest rows if table exceeds MAX_ROWS_PER_TABLE.

        Keeps only the most recent rows to prevent unbounded table growth.

        Args:
            conn: PostgreSQL connection
            table_name: Table to check and trim
        """
        cursor = conn.cursor()

        # Get current row count
        cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
        row_count = cursor.fetchone()[0]

        if row_count > MAX_ROWS_PER_TABLE:
            excess = row_count - MAX_ROWS_PER_TABLE
            logger.info(
                f"Table {table_name} has {row_count} rows, "
                f"deleting {excess} oldest rows"
            )

            # Delete oldest rows
            cursor.execute(
                f"""
                DELETE FROM {table_name}
                WHERE timestamp IN (
                    SELECT timestamp FROM {table_name}
                    ORDER BY timestamp ASC
                    LIMIT %s
                )
                """,
                (excess,),
            )
            conn.commit()
            logger.debug(f"Deleted {excess} rows from {table_name}")

    def sync_realtime_to_redis(self, symbol: str, rows: List[Tuple]) -> bool:
        """
        Sync last N candles to Redis for real-time chart updates (HOT tier).

        Stores raw 30-second OHLC data in Redis Sorted Set for fast access.
        Used by frontend for real-time candle chart rendering.

        Args:
            symbol: Trading symbol (e.g., "EURUSD.i", "BTCUSD")
            rows: List of row tuples with (timestamp, open, high, low, close, ...)

        Returns:
            True if sync was successful, False otherwise
        """
        if not ENABLE_REDIS_SYNC:
            logger.debug("Redis sync disabled, skipping Redis sync")
            return True

        if not rows:
            logger.debug(f"No rows to sync to Redis for {symbol}")
            return True

        try:
            with redis_connection() as r:
                if r is None:
                    logger.debug("Redis connection not available, skipping")
                    return True

                # Normalize symbol name (remove .i suffix, lowercase)
                normalized_symbol = symbol.replace(".i", "").lower()
                redis_key = f"{normalized_symbol}:realtime"

                # Sort rows by timestamp (ascending)
                sorted_rows = sorted(rows, key=lambda x: x[0])

                # Only keep the last REALTIME_CANDLE_LIMIT candles
                candles_to_store = sorted_rows[-REALTIME_CANDLE_LIMIT:]

                # Build data for Redis Sorted Set
                # Score = timestamp (for automatic sorting)
                # Value = JSON with OHLC data
                pipeline = r.pipeline()

                for row in candles_to_store:
                    timestamp = row[0]
                    candle_data = {
                        "t": timestamp,
                        "o": float(row[1]),  # open
                        "h": float(row[2]),  # high
                        "l": float(row[3]),  # low
                        "c": float(row[4]),  # close
                    }

                    # Add to sorted set (ZADD)
                    # Score is timestamp for automatic time-based sorting
                    import json
                    pipeline.zadd(
                        redis_key,
                        {json.dumps(candle_data): timestamp}
                    )

                # Keep only the last REALTIME_CANDLE_LIMIT candles
                # ZREMRANGEBYRANK removes all except top N scores
                pipeline.zremrangebyrank(
                    redis_key,
                    0,
                    -(REALTIME_CANDLE_LIMIT + 1)
                )

                # Set TTL as safety mechanism (7 days)
                pipeline.expire(redis_key, REDIS_REALTIME_TTL)

                # Execute all commands
                pipeline.execute()

                logger.debug(
                    f"Synced {len(candles_to_store)} candles to Redis for {normalized_symbol}"
                )

                return True

        except Exception as e:
            logger.error(f"Error syncing to Redis for {symbol}: {e}")
            # Don't fail the entire sync if Redis fails
            return False

    def run(self) -> Dict[str, Any]:
        """
        Run sync for all symbols.

        Returns:
            Dictionary with sync statistics
        """
        self.stats["start_time"] = datetime.utcnow().isoformat()
        logger.info(f"Starting sync for {len(SYMBOLS)} symbols...")

        for symbol in SYMBOLS:
            try:
                success = False
                for attempt in range(MAX_RETRIES):
                    if self.sync_symbol(symbol):
                        success = True
                        self.stats["symbols_synced"] += 1
                        break
                    else:
                        logger.warning(
                            f"Retry {attempt + 1}/{MAX_RETRIES} for {symbol}"
                        )
                        time.sleep(RETRY_DELAY_SECONDS)

                if not success:
                    logger.error(
                        f"Failed to sync {symbol} after {MAX_RETRIES} attempts"
                    )

            except Exception as e:
                logger.error(f"Unexpected error syncing {symbol}: {e}")
                self.stats["errors"] += 1

        # Save state after all symbols processed
        self.save_sync_state()

        end_time = datetime.utcnow().isoformat()
        logger.info(
            f"Sync completed: {self.stats['symbols_synced']}/{len(SYMBOLS)} symbols, "
            f"{self.stats['rows_synced']} rows, {self.stats['errors']} errors"
        )

        return {
            "start_time": self.stats["start_time"],
            "end_time": end_time,
            "symbols_synced": self.stats["symbols_synced"],
            "total_symbols": len(SYMBOLS),
            "rows_synced": self.stats["rows_synced"],
            "errors": self.stats["errors"],
        }


def main():
    """Main entry point for the sync script."""
    logger.info("=" * 60)
    logger.info("SQLite to PostgreSQL Sync Script - Part 20")
    logger.info("=" * 60)

    try:
        syncer = DataSyncer()
        result = syncer.run()

        # Exit with error code if there were errors
        if result["errors"] > 0:
            sys.exit(1)

    except KeyboardInterrupt:
        logger.info("Sync interrupted by user")
        sys.exit(130)

    except Exception as e:
        logger.exception(f"Fatal error in sync script: {e}")
        sys.exit(1)

    finally:
        # Clean up connection pools
        close_postgresql_pool()
        close_redis_pool()


if __name__ == "__main__":
    main()
