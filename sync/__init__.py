"""
SQLite to PostgreSQL Sync Package
Part 20 - Trading Alerts SaaS

This package provides utilities for synchronizing indicator data
from local SQLite (MT5 data) to cloud PostgreSQL (Railway).
"""

from .sync_to_postgresql import DataSyncer
from .timeframe_filter import filter_by_timeframe, get_latest_timeframe_timestamp
from .db_connections import (
    get_sqlite_connection,
    get_postgresql_connection,
    return_postgresql_connection,
    sqlite_connection,
    postgresql_connection,
)
from .config import SYMBOLS, TIMEFRAMES, SYNC_INTERVAL_SECONDS, MAX_ROWS_PER_TABLE

__all__ = [
    "DataSyncer",
    "filter_by_timeframe",
    "get_latest_timeframe_timestamp",
    "get_sqlite_connection",
    "get_postgresql_connection",
    "return_postgresql_connection",
    "sqlite_connection",
    "postgresql_connection",
    "SYMBOLS",
    "TIMEFRAMES",
    "SYNC_INTERVAL_SECONDS",
    "MAX_ROWS_PER_TABLE",
]

__version__ = "1.0.0"
