"""
Database Connection Management
Part 20 - Trading Alerts SaaS

Manages connections to SQLite (local) and PostgreSQL (cloud) databases.
Uses connection pooling for PostgreSQL to improve performance.
"""

import sqlite3
import logging
import time
from typing import Optional
from contextlib import contextmanager

import psycopg2
from psycopg2 import pool, OperationalError

from config import (
    SQLITE_PATH,
    POSTGRESQL_URI,
    PG_POOL_MIN_CONNECTIONS,
    PG_POOL_MAX_CONNECTIONS,
    MAX_RETRIES,
    RETRY_DELAY_SECONDS,
)

logger = logging.getLogger(__name__)

# Global connection pool for PostgreSQL
_pg_pool: Optional[pool.SimpleConnectionPool] = None


def get_sqlite_connection() -> sqlite3.Connection:
    """
    Get a connection to the SQLite database.

    Returns:
        sqlite3.Connection: Active SQLite connection

    Raises:
        sqlite3.Error: If connection fails
    """
    try:
        conn = sqlite3.connect(SQLITE_PATH)
        conn.row_factory = sqlite3.Row
        return conn
    except sqlite3.Error as e:
        logger.error(f"Failed to connect to SQLite at {SQLITE_PATH}: {e}")
        raise


def _init_postgresql_pool() -> pool.SimpleConnectionPool:
    """
    Initialize the PostgreSQL connection pool.

    Returns:
        SimpleConnectionPool: Initialized connection pool

    Raises:
        OperationalError: If pool creation fails
    """
    global _pg_pool

    if not POSTGRESQL_URI:
        raise ValueError("POSTGRESQL_URI environment variable not set")

    try:
        _pg_pool = pool.SimpleConnectionPool(
            PG_POOL_MIN_CONNECTIONS,
            PG_POOL_MAX_CONNECTIONS,
            POSTGRESQL_URI,
        )
        logger.info(
            f"PostgreSQL connection pool initialized "
            f"(min={PG_POOL_MIN_CONNECTIONS}, max={PG_POOL_MAX_CONNECTIONS})"
        )
        return _pg_pool
    except OperationalError as e:
        logger.error(f"Failed to create PostgreSQL connection pool: {e}")
        raise


def get_postgresql_connection():
    """
    Get a PostgreSQL connection from the pool.

    Initializes the pool on first call. Retries on connection failure.

    Returns:
        psycopg2.connection: Active PostgreSQL connection from the pool

    Raises:
        OperationalError: If connection fails after all retries
    """
    global _pg_pool

    for attempt in range(MAX_RETRIES):
        try:
            if _pg_pool is None:
                _init_postgresql_pool()

            conn = _pg_pool.getconn()
            if conn is None:
                raise OperationalError("Failed to get connection from pool")

            # Test the connection
            with conn.cursor() as cur:
                cur.execute("SELECT 1")

            return conn

        except OperationalError as e:
            logger.warning(
                f"PostgreSQL connection attempt {attempt + 1}/{MAX_RETRIES} failed: {e}"
            )
            if attempt < MAX_RETRIES - 1:
                time.sleep(RETRY_DELAY_SECONDS)
                # Reset pool on error
                if _pg_pool is not None:
                    try:
                        _pg_pool.closeall()
                    except Exception:
                        pass
                    _pg_pool = None
            else:
                logger.error(f"Failed to connect to PostgreSQL after {MAX_RETRIES} attempts")
                raise


def return_postgresql_connection(conn) -> None:
    """
    Return a PostgreSQL connection to the pool.

    Args:
        conn: PostgreSQL connection to return
    """
    global _pg_pool

    if _pg_pool is not None and conn is not None:
        try:
            _pg_pool.putconn(conn)
        except Exception as e:
            logger.warning(f"Error returning connection to pool: {e}")


def close_postgresql_pool() -> None:
    """
    Close all PostgreSQL connections in the pool.

    Should be called when shutting down the sync script.
    """
    global _pg_pool

    if _pg_pool is not None:
        try:
            _pg_pool.closeall()
            logger.info("PostgreSQL connection pool closed")
        except Exception as e:
            logger.warning(f"Error closing PostgreSQL pool: {e}")
        finally:
            _pg_pool = None


@contextmanager
def postgresql_connection():
    """
    Context manager for PostgreSQL connections.

    Automatically returns the connection to the pool when done.

    Usage:
        with postgresql_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT ...")

    Yields:
        psycopg2.connection: Active PostgreSQL connection
    """
    conn = None
    try:
        conn = get_postgresql_connection()
        yield conn
    finally:
        if conn is not None:
            return_postgresql_connection(conn)


@contextmanager
def sqlite_connection():
    """
    Context manager for SQLite connections.

    Automatically closes the connection when done.

    Usage:
        with sqlite_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT ...")

    Yields:
        sqlite3.Connection: Active SQLite connection
    """
    conn = None
    try:
        conn = get_sqlite_connection()
        yield conn
    finally:
        if conn is not None:
            conn.close()


def test_connections() -> dict:
    """
    Test both database connections.

    Returns:
        dict: Status of each connection
    """
    status = {
        "sqlite": {"connected": False, "error": None},
        "postgresql": {"connected": False, "error": None},
    }

    # Test SQLite
    try:
        with sqlite_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT 1")
            status["sqlite"]["connected"] = True
    except Exception as e:
        status["sqlite"]["error"] = str(e)

    # Test PostgreSQL
    try:
        with postgresql_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT 1")
            status["postgresql"]["connected"] = True
    except Exception as e:
        status["postgresql"]["error"] = str(e)

    return status
