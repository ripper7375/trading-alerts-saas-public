"""
Sync Script Configuration
Part 20 - Trading Alerts SaaS

Configuration settings for SQLite to PostgreSQL synchronization.

IMPORTANT FIXES:
- Symbols changed to lowercase to match DataCollector.mq5 table names
- Timeframes changed to lowercase to match PostgreSQL table naming
"""

import os
from typing import List

# Database paths
SQLITE_PATH: str = os.getenv("SQLITE_PATH", "C:\\MT5Data\\trading_data.db")
POSTGRESQL_URI: str = os.getenv("POSTGRESQL_URI", "")

# Supported trading symbols (15 total)
# IMPORTANT: Must match table names in SQLite created by DataCollector.mq5
# DataCollector.mq5 creates lowercase table names (e.g., "eurusd")
SYMBOLS: List[str] = [
    "audjpy",
    "audusd",
    "btcusd",
    "ethusd",
    "eurusd",
    "gbpjpy",
    "gbpusd",
    "ndx100",
    "nzdusd",
    "us30",
    "usdcad",
    "usdchf",
    "usdjpy",
    "xagusd",
    "xauusd",
]

# Supported timeframes (9 total)
# IMPORTANT: Must match PostgreSQL table naming convention (lowercase)
TIMEFRAMES: List[str] = [
    "m5",
    "m15",
    "m30",
    "h1",
    "h2",
    "h4",
    "h8",
    "h12",
    "d1",
]

# Sync settings
SYNC_INTERVAL_SECONDS: int = 30
MAX_ROWS_PER_TABLE: int = 10000

# Connection pool settings
PG_POOL_MIN_CONNECTIONS: int = 1
PG_POOL_MAX_CONNECTIONS: int = 10

# Retry settings for network failures
MAX_RETRIES: int = 3
RETRY_DELAY_SECONDS: int = 5

# Sync state file path
SYNC_STATE_FILE: str = os.getenv("SYNC_STATE_FILE", "sync_state.json")

# Logging settings
LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
LOG_FORMAT: str = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
