# Sync Script Deployment Guide

**Part 20 - MT5 to PostgreSQL Data Flow**
**Last Updated:** 2026-01-10
**Status:** ✅ UPDATED - Tested Configuration

---

## Table of Contents

1. [Overview](#overview)
2. [Sync Script Architecture](#sync-script-architecture)
3. [Prerequisites](#prerequisites)
4. [Database Path Configuration](#database-path-configuration)
5. [File Deployment](#file-deployment)
6. [Environment Configuration](#environment-configuration)
7. [Dependency Installation](#dependency-installation)
8. [Manual Test Run](#manual-test-run)
9. [Windows Task Scheduler Setup](#windows-task-scheduler-setup)
10. [Monitoring and Logging](#monitoring-and-logging)
11. [Troubleshooting](#troubleshooting)

---

## Overview

The sync script synchronizes data from local SQLite (written by DataCollector.mq5) to Railway PostgreSQL. It runs every 30 seconds via Windows Task Scheduler.

**Data Flow:**

```
SQLite (MT5 Files folder: trading_data.db)
    ↓ (Python sync script reads)
Filter by timeframe (9 timeframes)
    ↓ (UPSERT to PostgreSQL)
Railway PostgreSQL (135 tables)
    → eurusd_m5, eurusd_m15, ... eurusd_d1
    → btcusd_m5, btcusd_m15, ... btcusd_d1
    → ... (15 symbols × 9 timeframes = 135 tables)
```

---

## Sync Script Architecture

### Component Files

| File                     | Purpose                                              |
| ------------------------ | ---------------------------------------------------- |
| `config.py`              | Configuration settings (symbols, timeframes, paths)  |
| `db_connections.py`      | Database connection management (SQLite + PostgreSQL) |
| `sync_to_postgresql.py`  | Main sync logic                                      |
| `timeframe_filter.py`    | Filters data by timeframe                            |
| `requirements.txt`       | Python dependencies                                  |
| `run_sync.ps1`           | PowerShell wrapper for Task Scheduler                |
| `run_sync.bat`           | Batch file alternative                               |
| `setup-sync-package.ps1` | Automated setup script                               |

### Sync Process Flow

```
1. Load last sync state (sync_state.json)
2. For each symbol (15 total):
   a. Query SQLite for rows since last sync
   b. For each timeframe (9 total):
      - Filter rows matching timeframe
      - UPSERT to PostgreSQL table
      - Enforce max row limit (10,000)
   c. Update last sync timestamp
3. Save sync state
4. Log completion statistics
```

### Timeframe Filtering Logic

| Timeframe | Criteria                       | Example Times          |
| --------- | ------------------------------ | ---------------------- |
| M5        | minute % 5 == 0                | :00, :05, :10, :15...  |
| M15       | minute % 15 == 0               | :00, :15, :30, :45     |
| M30       | minute % 30 == 0               | :00, :30               |
| H1        | minute == 0                    | X:00                   |
| H2        | minute == 0 AND hour % 2 == 0  | 00:00, 02:00, 04:00... |
| H4        | minute == 0 AND hour % 4 == 0  | 00:00, 04:00, 08:00... |
| H8        | minute == 0 AND hour % 8 == 0  | 00:00, 08:00, 16:00    |
| H12       | minute == 0 AND hour % 12 == 0 | 00:00, 12:00           |
| D1        | hour == 0 AND minute == 0      | 00:00 (midnight)       |

---

## Prerequisites

Before deploying sync script:

- [ ] Contabo VPS setup complete
- [ ] Python 3.8+ installed
- [ ] DataCollector running and writing to SQLite
- [ ] SQLite database exists in MT5 Files folder
- [ ] Railway PostgreSQL credentials available
- [ ] Railway Redis credentials available (optional)

### Verify Python Installation

```powershell
python --version
# Expected: Python 3.11.x or similar

pip --version
# Expected: pip 23.x.x
```

---

## Database Path Configuration

### ⚠️ CRITICAL: Use MT5 Files Folder

**DataCollector stores the database in MT5's Files folder:**

```
C:\Users\Administrator\AppData\Roaming\MetaQuotes\Terminal\{TERMINAL_ID}\MQL5\Files\trading_data.db
```

### Step 1: Find Your Terminal ID

```powershell
# Method 1: List all Terminal IDs
Get-ChildItem "C:\Users\Administrator\AppData\Roaming\MetaQuotes\Terminal\" -Directory |
    Where-Object { $_.Name -match '^[A-F0-9]{32}$' } |
    Select-Object Name, LastWriteTime

# Method 2: Find database directly
Get-ChildItem -Path "C:\Users\Administrator\AppData\Roaming\MetaQuotes\Terminal\" `
    -Filter "trading_data.db" -Recurse -ErrorAction SilentlyContinue |
    Select-Object FullName, LastWriteTime

# Method 3: From MT5
# In MT5: File → Open Data Folder
# The folder name in address bar is your Terminal ID
```

**Example Terminal ID:**

```
492CD01931BD0D07A159AEF5B29BF32C
```

### Step 2: Verify Database Exists

```powershell
# Replace {TERMINAL_ID} with your actual Terminal ID
$terminalId = "492CD01931BD0D07A159AEF5B29BF32C"  # ← Change this
$dbPath = "C:\Users\Administrator\AppData\Roaming\MetaQuotes\Terminal\$terminalId\MQL5\Files\trading_data.db"

if (Test-Path $dbPath) {
    Write-Host "✅ Database found" -ForegroundColor Green
    Write-Host "Location: $dbPath"
    Write-Host "Size: $((Get-Item $dbPath).Length) bytes"
    Write-Host "Modified: $((Get-Item $dbPath).LastWriteTime)"
} else {
    Write-Host "❌ Database not found at: $dbPath" -ForegroundColor Red
    Write-Host "Check if DataCollector is running and writing data"
}
```

### Why MT5 Files Folder (Not C:\MT5Data)?

| Aspect          | C:\MT5Data (Old)         | MT5 Files Folder (New) |
| --------------- | ------------------------ | ---------------------- |
| Permissions     | ❌ Requires manual setup | ✅ Automatic           |
| Folder Creation | ❌ Manual                | ✅ Auto-created by MT5 |
| Error Risk      | ❌ Error 5002 common     | ✅ Guaranteed to work  |
| Portability     | ❌ System-specific       | ✅ Standard MT5 path   |
| Security        | ❌ Open permissions      | ✅ MT5-managed         |

**Conclusion:** Always use MT5 Files folder.

---

## File Deployment

### Step 1: Create Directory Structure

```powershell
# Create sync package directory
New-Item -ItemType Directory -Force -Path "C:\Scripts\sync_package"
New-Item -ItemType Directory -Force -Path "C:\Scripts\sync_package\logs"

Write-Host "✅ Directory structure created" -ForegroundColor Green
```

### Step 2: Create Python Files

#### File 1: config.py

**Create:** `C:\Scripts\sync_package\config.py`

```python
"""
Configuration for SQLite to PostgreSQL sync script.
Part 20 - Trading Alerts SaaS
Updated: 2026-01-10
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# ============================================================
# Database Paths
# ============================================================

def find_terminal_id():
    """
    Automatically find MT5 Terminal ID by searching for trading_data.db
    Returns the first Terminal ID found with a database file.
    """
    terminals_base = Path(os.environ.get('APPDATA', '')) / 'MetaQuotes' / 'Terminal'

    if not terminals_base.exists():
        return None

    # Search for trading_data.db in any terminal folder
    for terminal_folder in terminals_base.iterdir():
        if terminal_folder.is_dir() and len(terminal_folder.name) == 32:
            db_file = terminal_folder / 'MQL5' / 'Files' / 'trading_data.db'
            if db_file.exists():
                return terminal_folder.name

    return None

# Get Terminal ID (from env or auto-detect)
TERMINAL_ID = os.environ.get('MT5_TERMINAL_ID') or find_terminal_id()

if not TERMINAL_ID:
    raise RuntimeError(
        "Cannot find MT5 Terminal ID. "
        "Set MT5_TERMINAL_ID environment variable or ensure trading_data.db exists."
    )

# SQLite database path (MT5 Files folder)
SQLITE_PATH = str(
    Path(os.environ.get('APPDATA', '')) /
    'MetaQuotes' /
    'Terminal' /
    TERMINAL_ID /
    'MQL5' /
    'Files' /
    'trading_data.db'
)

# PostgreSQL connection string (from environment)
POSTGRESQL_URI = os.environ.get('POSTGRESQL_URI')

if not POSTGRESQL_URI:
    raise RuntimeError("POSTGRESQL_URI environment variable not set")

# Redis connection string (optional)
REDIS_URL = os.environ.get('REDIS_URL', None)

# ============================================================
# Symbol Configuration
# ============================================================

# 15 symbols - must match table names in SQLite
# Note: Table names in SQLite may have .i suffix for forex pairs
SYMBOLS = [
    "AUDJPY.i",   # or "audjpy.i" depending on your DataCollector setup
    "AUDUSD.i",
    "EURUSD.i",
    "GBPJPY.i",
    "GBPUSD.i",
    "NZDUSD.i",
    "USDCAD.i",
    "USDCHF.i",
    "USDJPY.i",
    "BTCUSD",     # Non-forex symbols without suffix
    "ETHUSD",
    "NDX100",
    "US30",
    "XAGUSD",
    "XAUUSD"
]

# ============================================================
# Timeframe Configuration
# ============================================================

# 9 timeframes for PostgreSQL tables
TIMEFRAMES = ["m5", "m15", "m30", "h1", "h2", "h4", "h8", "h12", "d1"]

# ============================================================
# Sync Settings
# ============================================================

SYNC_INTERVAL_SECONDS = 30
MAX_ROWS_PER_TABLE = 10000
SYNC_STATE_FILE = Path(__file__).parent / "sync_state.json"

# ============================================================
# Logging Configuration
# ============================================================

LOG_LEVEL = os.environ.get('LOG_LEVEL', 'INFO')
LOG_FILE = Path(__file__).parent / "logs" / "sync.log"
LOG_FORMAT = '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
LOG_DATE_FORMAT = '%Y-%m-%d %H:%M:%S'

# ============================================================
# Validation
# ============================================================

def validate_config():
    """Validate configuration before running sync."""
    errors = []

    # Check SQLite database exists
    if not Path(SQLITE_PATH).exists():
        errors.append(f"SQLite database not found: {SQLITE_PATH}")

    # Check PostgreSQL URI format
    if not POSTGRESQL_URI.startswith('postgresql://'):
        errors.append("POSTGRESQL_URI must start with 'postgresql://'")

    # Check sync state file directory exists
    if not SYNC_STATE_FILE.parent.exists():
        SYNC_STATE_FILE.parent.mkdir(parents=True, exist_ok=True)

    # Check log directory exists
    if not LOG_FILE.parent.exists():
        LOG_FILE.parent.mkdir(parents=True, exist_ok=True)

    if errors:
        raise RuntimeError("Configuration validation failed:\n" + "\n".join(errors))

    return True

# Print configuration summary
if __name__ == "__main__":
    print("=" * 60)
    print("Sync Script Configuration")
    print("=" * 60)
    print(f"Terminal ID: {TERMINAL_ID}")
    print(f"SQLite Path: {SQLITE_PATH}")
    print(f"PostgreSQL URI: {POSTGRESQL_URI[:50]}...")
    print(f"Symbols: {len(SYMBOLS)}")
    print(f"Timeframes: {len(TIMEFRAMES)}")
    print(f"Sync Interval: {SYNC_INTERVAL_SECONDS}s")
    print("=" * 60)

    try:
        validate_config()
        print("✅ Configuration valid")
    except RuntimeError as e:
        print(f"❌ Configuration error: {e}")
```

#### File 2: db_connections.py

**Create:** `C:\Scripts\sync_package\db_connections.py`

```python
"""
Database connection management for SQLite and PostgreSQL.
Part 20 - Trading Alerts SaaS
"""

import sqlite3
import psycopg2
from contextlib import contextmanager
from config import SQLITE_PATH, POSTGRESQL_URI
import logging

logger = logging.getLogger(__name__)

# ============================================================
# SQLite Connection
# ============================================================

@contextmanager
def sqlite_connection():
    """
    Context manager for SQLite connection.

    Usage:
        with sqlite_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM table")
    """
    conn = None
    try:
        # Timeout of 30 seconds to avoid lock issues
        conn = sqlite3.connect(SQLITE_PATH, timeout=30.0)
        conn.row_factory = sqlite3.Row  # Return rows as dictionaries
        logger.debug(f"SQLite connection opened: {SQLITE_PATH}")
        yield conn
    except sqlite3.Error as e:
        logger.error(f"SQLite error: {e}")
        raise
    finally:
        if conn:
            conn.close()
            logger.debug("SQLite connection closed")

# ============================================================
# PostgreSQL Connection
# ============================================================

@contextmanager
def postgresql_connection():
    """
    Context manager for PostgreSQL connection.

    Usage:
        with postgresql_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM table")
            conn.commit()
    """
    conn = None
    try:
        conn = psycopg2.connect(POSTGRESQL_URI)
        logger.debug("PostgreSQL connection opened")
        yield conn
    except psycopg2.Error as e:
        logger.error(f"PostgreSQL error: {e}")
        raise
    finally:
        if conn:
            conn.close()
            logger.debug("PostgreSQL connection closed")

# ============================================================
# Connection Testing
# ============================================================

def test_connections():
    """
    Test both SQLite and PostgreSQL connections.
    Returns dict with connection status.
    """
    results = {
        "sqlite": {"connected": False, "error": None},
        "postgresql": {"connected": False, "error": None}
    }

    # Test SQLite
    try:
        with sqlite_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT 1")
            results["sqlite"]["connected"] = True
            logger.info("✅ SQLite connection successful")
    except Exception as e:
        results["sqlite"]["error"] = str(e)
        logger.error(f"❌ SQLite connection failed: {e}")

    # Test PostgreSQL
    try:
        with postgresql_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT 1")
            results["postgresql"]["connected"] = True
            logger.info("✅ PostgreSQL connection successful")
    except Exception as e:
        results["postgresql"]["error"] = str(e)
        logger.error(f"❌ PostgreSQL connection failed: {e}")

    return results

# ============================================================
# Helper Functions
# ============================================================

def get_sqlite_tables():
    """Get list of tables in SQLite database."""
    with sqlite_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        )
        return [row[0] for row in cursor.fetchall()]

def get_postgresql_tables():
    """Get list of tables in PostgreSQL database."""
    with postgresql_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT tablename
            FROM pg_tables
            WHERE schemaname = 'public'
            ORDER BY tablename
        """)
        return [row[0] for row in cursor.fetchall()]

# ============================================================
# Main (for testing)
# ============================================================

if __name__ == "__main__":
    import json

    print("Testing database connections...")
    results = test_connections()
    print(json.dumps(results, indent=2))

    if results["sqlite"]["connected"]:
        print("\nSQLite tables:")
        for table in get_sqlite_tables():
            print(f"  - {table}")

    if results["postgresql"]["connected"]:
        print("\nPostgreSQL tables (first 10):")
        for table in get_postgresql_tables()[:10]:
            print(f"  - {table}")
```

#### File 3: timeframe_filter.py

**Create:** `C:\Scripts\sync_package\timeframe_filter.py`

```python
"""
Timeframe filtering logic for sync script.
Part 20 - Trading Alerts SaaS
"""

from datetime import datetime

def matches_timeframe(timestamp: int, timeframe: str) -> bool:
    """
    Check if a Unix timestamp matches a timeframe.

    Args:
        timestamp: Unix timestamp (seconds since epoch)
        timeframe: One of: m5, m15, m30, h1, h2, h4, h8, h12, d1

    Returns:
        True if timestamp matches timeframe criteria
    """
    dt = datetime.utcfromtimestamp(timestamp)
    minute = dt.minute
    hour = dt.hour

    # Timeframe matching logic
    if timeframe == "m5":
        return minute % 5 == 0

    elif timeframe == "m15":
        return minute % 15 == 0

    elif timeframe == "m30":
        return minute % 30 == 0

    elif timeframe == "h1":
        return minute == 0

    elif timeframe == "h2":
        return minute == 0 and hour % 2 == 0

    elif timeframe == "h4":
        return minute == 0 and hour % 4 == 0

    elif timeframe == "h8":
        return minute == 0 and hour % 8 == 0

    elif timeframe == "h12":
        return minute == 0 and hour % 12 == 0

    elif timeframe == "d1":
        return hour == 0 and minute == 0

    else:
        raise ValueError(f"Unknown timeframe: {timeframe}")

def filter_rows_by_timeframe(rows: list, timeframe: str) -> list:
    """
    Filter a list of rows to only include those matching timeframe.

    Args:
        rows: List of row dictionaries (must have 'timestamp' key)
        timeframe: Timeframe to filter for

    Returns:
        Filtered list of rows
    """
    return [row for row in rows if matches_timeframe(row['timestamp'], timeframe)]

# ============================================================
# Testing
# ============================================================

if __name__ == "__main__":
    # Test timestamps
    test_cases = [
        (datetime(2026, 1, 10, 12, 0, 0).timestamp(), "m5", True),
        (datetime(2026, 1, 10, 12, 5, 0).timestamp(), "m5", True),
        (datetime(2026, 1, 10, 12, 7, 0).timestamp(), "m5", False),
        (datetime(2026, 1, 10, 12, 0, 0).timestamp(), "h1", True),
        (datetime(2026, 1, 10, 12, 30, 0).timestamp(), "h1", False),
        (datetime(2026, 1, 10, 0, 0, 0).timestamp(), "d1", True),
        (datetime(2026, 1, 10, 12, 0, 0).timestamp(), "d1", False),
    ]

    print("Testing timeframe filter...")
    for ts, tf, expected in test_cases:
        result = matches_timeframe(int(ts), tf)
        status = "✅" if result == expected else "❌"
        dt = datetime.utcfromtimestamp(ts)
        print(f"{status} {dt} | {tf}: {result} (expected {expected})")
```

#### File 4: sync_to_postgresql.py

**Create:** `C:\Scripts\sync_package\sync_to_postgresql.py`

```python
"""
Main sync script - SQLite to PostgreSQL.
Part 20 - Trading Alerts SaaS
"""

import json
import logging
from datetime import datetime
from pathlib import Path

from config import (
    SYMBOLS, TIMEFRAMES, SYNC_STATE_FILE,
    MAX_ROWS_PER_TABLE, LOG_FILE, LOG_LEVEL, LOG_FORMAT
)
from db_connections import sqlite_connection, postgresql_connection
from timeframe_filter import filter_rows_by_timeframe

# Setup logging
logging.basicConfig(
    level=LOG_LEVEL,
    format=LOG_FORMAT,
    handlers=[
        logging.FileHandler(LOG_FILE),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# ============================================================
# Sync State Management
# ============================================================

def load_sync_state():
    """Load last sync timestamps from file."""
    if SYNC_STATE_FILE.exists():
        try:
            with open(SYNC_STATE_FILE, 'r') as f:
                state = json.load(f)
                logger.info(f"Loaded sync state from {SYNC_STATE_FILE}")
                return state
        except Exception as e:
            logger.warning(f"Failed to load sync state: {e}")

    # Initialize empty state
    return {symbol: 0 for symbol in SYMBOLS}

def save_sync_state(state):
    """Save sync timestamps to file."""
    try:
        with open(SYNC_STATE_FILE, 'w') as f:
            json.dump(state, f, indent=2)
        logger.debug(f"Saved sync state to {SYNC_STATE_FILE}")
    except Exception as e:
        logger.error(f"Failed to save sync state: {e}")

# ============================================================
# Table Management
# ============================================================

def create_table_if_not_exists(conn, symbol, timeframe):
    """Create PostgreSQL table if it doesn't exist."""
    table_name = f"{symbol.replace('.i', '').lower()}_{timeframe}"

    create_sql = f"""
    CREATE TABLE IF NOT EXISTS {table_name} (
        id SERIAL PRIMARY KEY,
        timestamp BIGINT NOT NULL UNIQUE,
        open DOUBLE PRECISION NOT NULL,
        high DOUBLE PRECISION NOT NULL,
        low DOUBLE PRECISION NOT NULL,
        close DOUBLE PRECISION NOT NULL,
        fractals TEXT,
        horizontal_trendlines TEXT,
        diagonal_trendlines TEXT,
        momentum_candles TEXT,
        keltner_channels TEXT,
        tema DOUBLE PRECISION,
        hrma DOUBLE PRECISION,
        smma DOUBLE PRECISION,
        zigzag TEXT,
        created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_{table_name}_timestamp ON {table_name}(timestamp);
    """

    cursor = conn.cursor()
    cursor.execute(create_sql)
    conn.commit()
    logger.debug(f"Ensured table exists: {table_name}")

def enforce_row_limit(conn, symbol, timeframe):
    """Keep only the most recent MAX_ROWS_PER_TABLE rows."""
    table_name = f"{symbol.replace('.i', '').lower()}_{timeframe}"

    delete_sql = f"""
    DELETE FROM {table_name}
    WHERE id IN (
        SELECT id FROM {table_name}
        ORDER BY timestamp DESC
        OFFSET {MAX_ROWS_PER_TABLE}
    );
    """

    cursor = conn.cursor()
    cursor.execute(delete_sql)
    deleted = cursor.rowcount
    conn.commit()

    if deleted > 0:
        logger.info(f"Removed {deleted} old rows from {table_name}")

# ============================================================
# Data Sync Logic
# ============================================================

def sync_symbol(symbol, last_sync_timestamp):
    """
    Sync a single symbol from SQLite to PostgreSQL.

    Returns:
        (rows_processed, error_count, new_last_timestamp)
    """
    logger.info(f"Syncing {symbol}...")

    rows_processed = 0
    error_count = 0
    new_last_timestamp = last_sync_timestamp

    try:
        # Fetch new rows from SQLite
        with sqlite_connection() as sqlite_conn:
            cursor = sqlite_conn.cursor()

            # Query for rows after last sync
            cursor.execute(f"""
                SELECT * FROM [{symbol}]
                WHERE timestamp > ?
                ORDER BY timestamp ASC
            """, (last_sync_timestamp,))

            rows = [dict(row) for row in cursor.fetchall()]

            if not rows:
                logger.debug(f"No new data for {symbol}")
                return (0, 0, last_sync_timestamp)

            logger.info(f"Found {len(rows)} new rows for {symbol}")

        # Sync to PostgreSQL for each timeframe
        with postgresql_connection() as pg_conn:
            for timeframe in TIMEFRAMES:
                # Filter rows for this timeframe
                filtered_rows = filter_rows_by_timeframe(rows, timeframe)

                if not filtered_rows:
                    continue

                # Create table if needed
                create_table_if_not_exists(pg_conn, symbol, timeframe)

                # Upsert rows
                table_name = f"{symbol.replace('.i', '').lower()}_{timeframe}"
                cursor = pg_conn.cursor()

                for row in filtered_rows:
                    try:
                        cursor.execute(f"""
                            INSERT INTO {table_name} (
                                timestamp, open, high, low, close,
                                fractals, horizontal_trendlines, diagonal_trendlines,
                                momentum_candles, keltner_channels,
                                tema, hrma, smma, zigzag
                            ) VALUES (
                                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                            )
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
                        """, (
                            row['timestamp'], row['open'], row['high'],
                            row['low'], row['close'],
                            row.get('fractals'), row.get('horizontal_trendlines'),
                            row.get('diagonal_trendlines'), row.get('momentum_candles'),
                            row.get('keltner_channels'), row.get('tema'),
                            row.get('hrma'), row.get('smma'), row.get('zigzag')
                        ))

                        rows_processed += 1

                    except Exception as e:
                        logger.error(f"Error inserting row for {table_name}: {e}")
                        error_count += 1

                pg_conn.commit()
                logger.debug(f"Synced {len(filtered_rows)} rows to {table_name}")

                # Enforce row limit
                enforce_row_limit(pg_conn, symbol, timeframe)

        # Update last timestamp
        new_last_timestamp = max(row['timestamp'] for row in rows)
        logger.info(f"Synced {symbol}: {rows_processed} rows processed, {error_count} errors")

    except Exception as e:
        logger.error(f"Error syncing {symbol}: {e}")
        error_count += 1

    return (rows_processed, error_count, new_last_timestamp)

# ============================================================
# Main Sync Function
# ============================================================

def run_sync():
    """Run full sync for all symbols."""
    logger.info("=" * 60)
    logger.info("SQLite to PostgreSQL Sync Script - Part 20")
    logger.info("=" * 60)

    # Load sync state
    sync_state = load_sync_state()

    # Statistics
    total_rows = 0
    total_errors = 0
    symbols_synced = 0

    # Sync each symbol
    logger.info(f"Starting sync for {len(SYMBOLS)} symbols...")

    for symbol in SYMBOLS:
        last_timestamp = sync_state.get(symbol, 0)

        try:
            rows, errors, new_timestamp = sync_symbol(symbol, last_timestamp)

            total_rows += rows
            total_errors += errors

            if rows > 0 or errors > 0:
                symbols_synced += 1
                sync_state[symbol] = new_timestamp

        except Exception as e:
            logger.error(f"Failed to sync {symbol}: {e}")
            total_errors += 1

    # Save sync state
    save_sync_state(sync_state)

    # Summary
    logger.info("=" * 60)
    logger.info(f"Sync completed: {symbols_synced}/{len(SYMBOLS)} symbols, "
                f"{total_rows} rows, {total_errors} errors")
    logger.info("=" * 60)

    return total_errors == 0

# ============================================================
# Entry Point
# ============================================================

if __name__ == "__main__":
    try:
        success = run_sync()
        exit(0 if success else 1)
    except KeyboardInterrupt:
        logger.info("Sync interrupted by user")
        exit(1)
    except Exception as e:
        logger.error(f"Sync failed with error: {e}")
        exit(1)
```

#### File 5: requirements.txt

**Create:** `C:\Scripts\sync_package\requirements.txt`

```
psycopg2-binary>=2.9.9
python-dotenv>=1.0.0
```

#### File 6: **init**.py

**Create:** `C:\Scripts\sync_package\__init__.py`

```python
"""
SQLite to PostgreSQL Sync Package
Part 20 - Trading Alerts SaaS
"""

__version__ = "1.0.0"
```

### Step 3: Create PowerShell Wrapper

**Create:** `C:\Scripts\run_sync.ps1`

```powershell
# Trading Alerts Sync Script Runner
# Part 20 - MT5 to PostgreSQL

Set-Location "C:\Scripts\sync_package"

# Run sync script
python sync_to_postgresql.py

# Exit with Python script's exit code
exit $LASTEXITCODE
```

### Step 4: Verify Files

```powershell
# List all files
Get-ChildItem "C:\Scripts\sync_package" -Recurse | Select-Object FullName

# Expected files:
# __init__.py
# config.py
# db_connections.py
# sync_to_postgresql.py
# timeframe_filter.py
# requirements.txt
# logs\ (directory)
```

---

## Environment Configuration

### Step 1: Find Your Terminal ID

```powershell
# Find trading_data.db and get Terminal ID from path
$db = Get-ChildItem -Path "C:\Users\Administrator\AppData\Roaming\MetaQuotes\Terminal\" `
    -Filter "trading_data.db" -Recurse -ErrorAction SilentlyContinue |
    Select-Object -First 1

if ($db) {
    $terminalId = $db.Directory.Parent.Parent.Name
    Write-Host "✅ Found Terminal ID: $terminalId" -ForegroundColor Green
    Write-Host "Database location: $($db.FullName)" -ForegroundColor Cyan
} else {
    Write-Host "❌ Database not found. Ensure DataCollector is running." -ForegroundColor Red
}
```

### Step 2: Create .env File

```powershell
# Store Terminal ID from above
$terminalId = "492CD01931BD0D07A159AEF5B29BF32C"  # ← Replace with your actual Terminal ID

# Create .env content
$envContent = @"
# Trading Alerts Sync Package Configuration
# Part 20 Migration
# Updated: 2026-01-10

# MT5 Terminal ID (auto-detected if not set)
MT5_TERMINAL_ID=$terminalId

# SQLite database path (MT5 Files folder)
# This is constructed automatically in config.py
# Actual path: C:\Users\Administrator\AppData\Roaming\MetaQuotes\Terminal\{TERMINAL_ID}\MQL5\Files\trading_data.db

# Railway PostgreSQL connection string
POSTGRESQL_URI=postgresql://postgres:YOUR_PASSWORD@turntable.proxy.rlwy.net:55082/railway

# Railway Redis connection string (optional)
REDIS_URL=redis://default:YOUR_PASSWORD@switchyard.proxy.rlwy.net:47725

# Logging
LOG_LEVEL=INFO
"@

# Save .env file
$envContent | Out-File -FilePath "C:\Scripts\sync_package\.env" -Encoding ASCII

Write-Host "✅ .env file created" -ForegroundColor Green
Write-Host "⚠️  Remember to update PostgreSQL and Redis passwords!" -ForegroundColor Yellow
```

### Step 3: Update Credentials

```powershell
# Edit .env file to add real credentials
notepad "C:\Scripts\sync_package\.env"

# Replace:
# - YOUR_PASSWORD (PostgreSQL)
# - YOUR_PASSWORD (Redis)
```

### Step 4: Verify Configuration

```powershell
cd C:\Scripts\sync_package

# Test config.py
python -c "from config import *; validate_config(); print('✅ Configuration valid')"

# Expected output:
# ============================================================
# Sync Script Configuration
# ============================================================
# Terminal ID: 492CD01931BD0D07A159AEF5B29BF32C
# SQLite Path: C:\Users\...\trading_data.db
# PostgreSQL URI: postgresql://postgres...
# Symbols: 15
# Timeframes: 9
# Sync Interval: 30s
# ============================================================
# ✅ Configuration valid
```

---

## Dependency Installation

### Step 1: Install Requirements

```powershell
cd C:\Scripts\sync_package

# Install dependencies
pip install -r requirements.txt

Write-Host "✅ Dependencies installed" -ForegroundColor Green
```

### Step 2: Verify Installation

```powershell
# Check installed packages
pip list | Select-String "psycopg2|dotenv"

# Expected:
# psycopg2-binary    2.9.9
# python-dotenv      1.0.0
```

### Step 3: Test Imports

```powershell
# Test all modules
python -c "import psycopg2; print('✅ psycopg2 OK')"
python -c "from dotenv import load_dotenv; print('✅ python-dotenv OK')"
python -c "import config; print('✅ config OK')"
python -c "import db_connections; print('✅ db_connections OK')"
python -c "import timeframe_filter; print('✅ timeframe_filter OK')"
python -c "import sync_to_postgresql; print('✅ sync_to_postgresql OK')"
```

---

## Manual Test Run

### Step 1: Test Database Connections

```powershell
cd C:\Scripts\sync_package

# Test connections
python -c "from db_connections import test_connections; import json; print(json.dumps(test_connections(), indent=2))"
```

**Expected output:**

```json
{
  "sqlite": {
    "connected": true,
    "error": null
  },
  "postgresql": {
    "connected": true,
    "error": null
  }
}
```

### Step 2: Test Timeframe Filter

```powershell
# Run timeframe filter tests
python timeframe_filter.py

# Expected: All tests should pass with ✅
```

### Step 3: Run Full Sync

```powershell
# First sync (will process all data)
python sync_to_postgresql.py
```

**Expected output:**

```
============================================================
SQLite to PostgreSQL Sync Script - Part 20
============================================================
2026-01-10 08:30:00 - __main__ - INFO - Loaded sync state from sync_state.json
2026-01-10 08:30:00 - __main__ - INFO - Starting sync for 15 symbols...
2026-01-10 08:30:00 - __main__ - INFO - Syncing AUDJPY.i...
2026-01-10 08:30:00 - __main__ - INFO - Found 120 new rows for AUDJPY.i
2026-01-10 08:30:01 - __main__ - INFO - Synced AUDJPY.i: 120 rows processed, 0 errors
...
============================================================
2026-01-10 08:30:15 - __main__ - INFO - Sync completed: 15/15 symbols, 1800 rows, 0 errors
============================================================
```

### Step 4: Verify Data in PostgreSQL

```powershell
# Install PostgreSQL client (if not already)
# choco install postgresql

# Query a table
$env:POSTGRESQL_URI = "postgresql://postgres:PASSWORD@turntable.proxy.rlwy.net:55082/railway"

psql $env:POSTGRESQL_URI -c "SELECT COUNT(*) FROM eurusd_h1;"
psql $env:POSTGRESQL_URI -c "SELECT timestamp, close FROM eurusd_h1 ORDER BY timestamp DESC LIMIT 5;"
```

### Step 5: Check Logs

```powershell
# View sync log
Get-Content "C:\Scripts\sync_package\logs\sync.log" -Tail 50

# Watch log in real-time
Get-Content "C:\Scripts\sync_package\logs\sync.log" -Tail 10 -Wait
```

---

## Windows Task Scheduler Setup

### Method 1: Automated Setup

```powershell
# Create scheduled task
$action = New-ScheduledTaskAction `
    -Execute "PowerShell.exe" `
    -Argument "-ExecutionPolicy Bypass -File C:\Scripts\run_sync.ps1"

# Run every minute (Task Scheduler doesn't support <1 minute)
$trigger = New-ScheduledTaskTrigger `
    -Once -At (Get-Date) `
    -RepetitionInterval (New-TimeSpan -Minutes 1)

$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 5)

$principal = New-ScheduledTaskPrincipal `
    -UserId "SYSTEM" `
    -LogonType ServiceAccount `
    -RunLevel Highest

# Remove existing task if present
Unregister-ScheduledTask -TaskName "TradingAlertsSyncTask" -Confirm:$false -ErrorAction SilentlyContinue

# Register new task
Register-ScheduledTask `
    -TaskName "TradingAlertsSyncTask" `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Principal $principal `
    -Description "Trading Alerts SQLite to PostgreSQL Sync (Part 20)"

Write-Host "✅ Scheduled task created!" -ForegroundColor Green
```

### Method 2: 30-Second Intervals

**Modify run_sync.ps1 to run twice per minute:**

```powershell
# File: C:\Scripts\run_sync.ps1

Set-Location "C:\Scripts\sync_package"

# First run
python sync_to_postgresql.py

# Wait 30 seconds
Start-Sleep -Seconds 30

# Second run
python sync_to_postgresql.py
```

### Step 2: Start Task

```powershell
# Start the task
Start-ScheduledTask -TaskName "TradingAlertsSyncTask"

# Check status
Get-ScheduledTask -TaskName "TradingAlertsSyncTask" | Select-Object TaskName, State

# View task info
Get-ScheduledTaskInfo -TaskName "TradingAlertsSyncTask"
```

### Step 3: Monitor Execution

```powershell
# Watch log to see task running
Get-Content "C:\Scripts\sync_package\logs\sync.log" -Tail 20 -Wait

# Check Windows Event Viewer
# Event Viewer → Applications and Services Logs → Microsoft → Windows → TaskScheduler → Operational
```

---

## Monitoring and Logging

### Log Files

| File              | Location                                  | Purpose              |
| ----------------- | ----------------------------------------- | -------------------- |
| `sync.log`        | `C:\Scripts\sync_package\logs\sync.log`   | Main operations      |
| `sync_state.json` | `C:\Scripts\sync_package\sync_state.json` | Last sync timestamps |

### Health Check Script

```powershell
# File: C:\Scripts\health_check.ps1

Write-Host "=== Sync Health Check ===" -ForegroundColor Cyan

# Task status
$task = Get-ScheduledTask -TaskName "TradingAlertsSyncTask"
Write-Host "Task State: $($task.State)" -ForegroundColor $(if($task.State -eq 'Running'){'Green'}else{'Yellow'})

# Last run
$taskInfo = Get-ScheduledTaskInfo -TaskName "TradingAlertsSyncTask"
Write-Host "Last Run: $($taskInfo.LastRunTime)"
Write-Host "Last Result: $($taskInfo.LastTaskResult)"

# Sync state age
$stateFile = Get-Item "C:\Scripts\sync_package\sync_state.json"
$age = (Get-Date) - $stateFile.LastWriteTime
Write-Host "State File Age: $([math]::Round($age.TotalMinutes, 1)) minutes"

if ($age.TotalMinutes -gt 5) {
    Write-Host "⚠️  WARNING: Sync may be stalled!" -ForegroundColor Yellow
} else {
    Write-Host "✅ Sync is running normally" -ForegroundColor Green
}

# Database age
$terminalId = "492CD01931BD0D07A159AEF5B29BF32C"  # Update this
$dbPath = "C:\Users\Administrator\AppData\Roaming\MetaQuotes\Terminal\$terminalId\MQL5\Files\trading_data.db"

if (Test-Path $dbPath) {
    $dbAge = (Get-Date) - (Get-Item $dbPath).LastWriteTime
    Write-Host "Database Age: $([math]::Round($dbAge.TotalMinutes, 1)) minutes"

    if ($dbAge.TotalMinutes -gt 5) {
        Write-Host "⚠️  WARNING: DataCollector may not be running!" -ForegroundColor Yellow
    }
}
```

---

## Troubleshooting

### Issue 1: Database Not Found

**Symptoms:**

```
RuntimeError: Cannot find MT5 Terminal ID
```

**Solutions:**

1. **Find Terminal ID manually:**

```powershell
   Get-ChildItem "C:\Users\Administrator\AppData\Roaming\MetaQuotes\Terminal\" |
       Where-Object { $_.Name -match '^[A-F0-9]{32}$' }
```

2. **Set Terminal ID in .env:**

```
   MT5_TERMINAL_ID=YOUR_TERMINAL_ID_HERE
```

3. **Verify database exists:**

```powershell
   $terminalId = "YOUR_TERMINAL_ID"
   $dbPath = "C:\Users\Administrator\AppData\Roaming\MetaQuotes\Terminal\$terminalId\MQL5\Files\trading_data.db"
   Test-Path $dbPath
```

### Issue 2: PostgreSQL Connection Refused

**Symptoms:**

```
psycopg2.OperationalError: connection refused
```

**Solutions:**

1. Check Railway PostgreSQL is running (railway.app)
2. Verify connection string in .env
3. Test network connectivity:

```powershell
   Test-NetConnection -ComputerName turntable.proxy.rlwy.net -Port 55082
```

### Issue 3: SQLite Database Locked

**Symptoms:**

```
sqlite3.OperationalError: database is locked
```

**Solutions:**

1. Ensure only one sync process runs at a time
2. Check Task Scheduler isn't running multiple instances
3. Stop sync task:

```powershell
   Stop-ScheduledTask -TaskName "TradingAlertsSyncTask"
```

### Issue 4: No Tables Created

**Symptoms:** PostgreSQL tables don't exist

**Solutions:**

1. Check sync.log for errors
2. Verify symbol names match between SQLite and config.py
3. Check if DataCollector is using `.i` suffix:

```powershell
   sqlite3 trading_data.db ".tables"
```

4. Update SYMBOLS array in config.py to match

### Issue 5: Wrong Database Path

**Symptoms:**

```
FileNotFoundError: [WinError 2] The system cannot find the file specified
```

**Solutions:**

1. **Don't use C:\MT5Data** - use MT5 Files folder
2. Find correct path:

```powershell
   Get-ChildItem -Path "C:\Users\Administrator\AppData\Roaming\MetaQuotes\Terminal\" `
       -Filter "trading_data.db" -Recurse | Select-Object FullName
```

3. Update Terminal ID in .env file

### Issue 6: Module Not Found

**Symptoms:**

```
ModuleNotFoundError: No module named 'psycopg2'
```

**Solutions:**

```powershell
cd C:\Scripts\sync_package
pip install -r requirements.txt

# If still fails, check Python path
python -c "import sys; print(sys.executable)"
```

---

## Quick Reference

### File Structure

```
C:\Scripts\
├── run_sync.ps1                    # Task Scheduler wrapper
└── sync_package\
    ├── __init__.py
    ├── config.py                   # Configuration (auto-finds Terminal ID)
    ├── db_connections.py           # SQLite + PostgreSQL connections
    ├── sync_to_postgresql.py      # Main sync logic
    ├── timeframe_filter.py         # Timeframe matching
    ├── requirements.txt            # Python dependencies
    ├── .env                        # Credentials (DO NOT COMMIT!)
    ├── sync_state.json             # Last sync timestamps
    └── logs\
        └── sync.log                # Operation logs
```

### Database Paths

**SQLite (Source):**

```
C:\Users\Administrator\AppData\Roaming\MetaQuotes\Terminal\{TERMINAL_ID}\MQL5\Files\trading_data.db
```

**PostgreSQL (Destination):**

```
railway.app → PostgreSQL service
135 tables (15 symbols × 9 timeframes)
```

### Common Commands

```powershell
# Run sync manually
cd C:\Scripts\sync_package
python sync_to_postgresql.py

# Test connections
python db_connections.py

# Test configuration
python config.py

# Check task
Get-ScheduledTask -TaskName "TradingAlertsSyncTask"

# Start/stop task
Start-ScheduledTask -TaskName "TradingAlertsSyncTask"
Stop-ScheduledTask -TaskName "TradingAlertsSyncTask"

# Watch logs
Get-Content "C:\Scripts\sync_package\logs\sync.log" -Tail 20 -Wait

# Reset sync state (start fresh)
Remove-Item "C:\Scripts\sync_package\sync_state.json"
```

---

## Checklist

Before proceeding to testing:

- [ ] All Python files deployed
- [ ] .env file created with correct Terminal ID
- [ ] PostgreSQL credentials added to .env
- [ ] Dependencies installed (`pip install -r requirements.txt`)
- [ ] Configuration validated (`python config.py`)
- [ ] Connections tested (`python db_connections.py`)
- [ ] Manual sync run successful
- [ ] Data appearing in PostgreSQL
- [ ] Task Scheduler configured
- [ ] Task running automatically
- [ ] Logs being written
- [ ] sync_state.json updating

---

**Next Step:** → [06-e2e-testing-plan.md](./06-e2e-testing-plan.md)

---

**Document Version:** 2.0.0  
**Last Updated:** 2026-01-10  
**Status:** ✅ Tested Configuration  
**Author:** Claude Code (Trading Alerts SaaS Part 20)
