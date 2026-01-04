"""
Sync Script Configuration
Part 20 - Trading Alerts SaaS

Configuration settings for SQLite to PostgreSQL synchronization.
"""

import os
from typing import List

# Database paths
SQLITE_PATH: str = os.getenv("SQLITE_PATH", "C:\\MT5Data\\trading_data.db")
POSTGRESQL_URI: str = os.getenv("POSTGRESQL_URI", "")

# Supported trading symbols (15 total)
SYMBOLS: List[str] = [
    "AUDJPY",
    "AUDUSD",
    "BTCUSD",
    "ETHUSD",
    "EURUSD",
    "GBPJPY",
    "GBPUSD",
    "NDX100",
    "NZDUSD",
    "US30",
    "USDCAD",
    "USDCHF",
    "USDJPY",
    "XAGUSD",
    "XAUUSD",
]

# Supported timeframes (9 total)
TIMEFRAMES: List[str] = [
    "M5",
    "M15",
    "M30",
    "H1",
    "H2",
    "H4",
    "H8",
    "H12",
    "D1",
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
