#!/usr/bin/env python3
"""
MT5 Data Backfill Worker
Recovers data from SQLite backups and syncs to Upstash Redis
Runs continuously, checking every 5 minutes
"""

import sqlite3
import redis
import json
import time
import logging
from pathlib import Path
from datetime import datetime
from typing import List, Dict

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Configuration
REDIS_HOST = 'your-redis.upstash.io'
REDIS_PORT = 6379
REDIS_PASSWORD = 'your-token-here'
REDIS_QUEUE = 'market-data-sync'

DATABASE_DIR = Path('C:/Scripts/database')
SYMBOLS = [
    'btcusd', 'ethusd', 'xauusd',      # Terminal 1
    'eurusd', 'gbpusd', 'usdjpy',      # Terminal 2
    'xagusd', 'wtiusd', 'audusd',      # Terminal 3
    'nzdusd', 'usdcad', 'us30',        # Terminal 4
    'spx500', 'nas100', 'bnbusd'       # Terminal 5
]

# Connect to Redis
try:
    redis_client = redis.Redis(
        host=REDIS_HOST,
        port=REDIS_PORT,
        password=REDIS_PASSWORD,
        ssl=True,
        decode_responses=False  # Keep as bytes for lpush
    )
    redis_client.ping()
    logger.info(f"✅ Connected to Redis: {REDIS_HOST}")
except Exception as e:
    logger.error(f"❌ Failed to connect to Redis: {e}")
    exit(1)


def get_all_columns(cursor, table_name: str) -> List[str]:
    """Get all column names from table"""
    cursor.execute(f"PRAGMA table_info([{table_name}])")
    return [row[1] for row in cursor.fetchall()]


def row_to_dict(cursor, row, columns: List[str]) -> Dict:
    """Convert SQLite row to dictionary"""
    data = {}
    for idx, col in enumerate(columns):
        value = row[idx]
        # Handle NULL values
        if value is None:
            data[col] = None
        else:
            data[col] = value
    return data


def backfill_symbol(symbol: str) -> int:
    """
    Backfill data from SQLite to Redis for one symbol
    Returns number of bars backfilled
    """
    db_path = DATABASE_DIR / f"{symbol}.db"
    
    if not db_path.exists():
        return 0
    
    try:
        conn = sqlite3.connect(str(db_path))
        cursor = conn.cursor()
        
        # Check if table exists
        cursor.execute(f"""
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='{symbol}'
        """)
        
        if not cursor.fetchone():
            conn.close()
            return 0
        
        # Get column names
        columns = get_all_columns(cursor, symbol)
        
        # Get all rows (these are bars that failed Redis publish)
        cursor.execute(f"SELECT * FROM [{symbol}] ORDER BY timestamp DESC LIMIT 1000")
        rows = cursor.fetchall()
        
        if not rows:
            conn.close()
            return 0
        
        logger.info(f"📋 {symbol}: Found {len(rows)} bars to backfill")
        
        backfilled = 0
        
        for row in rows:
            # Convert row to dictionary
            data = row_to_dict(cursor, row, columns)
            
            # Add symbol field (sanitized name)
            data['symbol'] = symbol
            
            try:
                # Convert to JSON
                payload = json.dumps(data, default=str)
                
                # Push to Redis queue
                redis_client.lpush(REDIS_QUEUE, payload)
                
                # Delete from SQLite (successfully synced)
                cursor.execute(f"""
                    DELETE FROM [{symbol}] 
                    WHERE timestamp = ? AND timeframe = ?
                """, (data['timestamp'], data['timeframe']))
                
                conn.commit()
                backfilled += 1
                
            except redis.RedisError as e:
                logger.error(f"❌ Redis error for {symbol}: {e}")
                break  # Stop this symbol, try next
            except Exception as e:
                logger.error(f"❌ Error processing bar: {e}")
                continue
        
        conn.close()
        
        if backfilled > 0:
            logger.info(f"✅ {symbol}: Backfilled {backfilled} bars")
        
        return backfilled
        
    except Exception as e:
        logger.error(f"❌ Error processing {symbol}: {e}")
        return 0


def check_queue_health():
    """Check Redis queue length"""
    try:
        queue_length = redis_client.llen(REDIS_QUEUE)
        logger.info(f"📊 Queue length: {queue_length} jobs")
        
        if queue_length > 10000:
            logger.warning(f"⚠️ Queue is backing up: {queue_length} jobs")
        
        return queue_length
    except Exception as e:
        logger.error(f"❌ Failed to check queue: {e}")
        return -1


def get_sqlite_stats():
    """Get statistics on SQLite backup usage"""
    total_bars = 0
    symbols_with_data = []
    
    for symbol in SYMBOLS:
        db_path = DATABASE_DIR / f"{symbol}.db"
        
        if not db_path.exists():
            continue
        
        try:
            conn = sqlite3.connect(str(db_path))
            cursor = conn.cursor()
            
            cursor.execute(f"""
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name='{symbol}'
            """)
            
            if cursor.fetchone():
                cursor.execute(f"SELECT COUNT(*) FROM [{symbol}]")
                count = cursor.fetchone()[0]
                
                if count > 0:
                    total_bars += count
                    symbols_with_data.append(f"{symbol}:{count}")
            
            conn.close()
            
        except Exception as e:
            logger.error(f"Error reading {symbol}: {e}")
            continue
    
    return total_bars, symbols_with_data


def main():
    """Main backfill worker loop"""
    logger.info("🚀 Starting MT5 Data Backfill Worker")
    logger.info(f"   Database directory: {DATABASE_DIR}")
    logger.info(f"   Monitoring {len(SYMBOLS)} symbols")
    logger.info(f"   Redis queue: {REDIS_QUEUE}")
    logger.info("=" * 50)
    
    iteration = 0
    
    while True:
        try:
            iteration += 1
            logger.info(f"\n--- Iteration #{iteration} at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} ---")
            
            # Check SQLite backup status
            total_bars, symbols_with_data = get_sqlite_stats()
            
            if total_bars == 0:
                logger.info("✅ No backfill needed - all data synced to Redis")
                check_queue_health()
            else:
                logger.warning(f"⚠️ Found {total_bars} bars in SQLite backups")
                logger.info(f"   Symbols: {', '.join(symbols_with_data)}")
                
                # Backfill each symbol
                total_backfilled = 0
                
                for symbol in SYMBOLS:
                    count = backfill_symbol(symbol)
                    total_backfilled += count
                    
                    if count > 0:
                        # Small delay between symbols
                        time.sleep(0.5)
                
                logger.info(f"✅ Total backfilled: {total_backfilled} bars")
                
                # Check queue after backfill
                check_queue_health()
            
            # Sleep interval based on whether work was done
            if total_bars > 0:
                # Had work, check again soon
                logger.info("Sleeping 60 seconds (quick check after backfill)...")
                time.sleep(60)
            else:
                # No work, normal interval
                logger.info("Sleeping 300 seconds (5 minutes)...")
                time.sleep(300)
            
        except KeyboardInterrupt:
            logger.info("\n👋 Shutting down backfill worker...")
            break
        except Exception as e:
            logger.error(f"❌ Worker error: {e}")
            logger.info("Sleeping 60 seconds before retry...")
            time.sleep(60)


if __name__ == "__main__":
    main()
