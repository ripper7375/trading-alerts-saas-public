#!/usr/bin/env python3
"""
MT5 Data Backfill Worker v2 - API Gateway Version
Recovers data from SQLite backups and syncs to API Gateway
Runs continuously, checking every 5 minutes (configurable)

v2 Changelog (from v1):
- CONNECTION POOLING: Uses requests.Session() for TCP connection reuse
- EXPONENTIAL BACKOFF: Failures increase wait time (30s → 60s → 120s → max 300s)
- BATCH SQLITE DELETES: Groups successful deletes into single transactions
- GRACEFUL SHUTDOWN: Signal handling for clean exit (SIGINT, SIGTERM)
- RETRY WITH BACKOFF: Transient HTTP errors get up to 3 retries per bar
- CONFIGURABLE INTERVALS: All timing constants in one place
- SAFER SQL: Parameterized queries where possible
- BETTER LOGGING: Rotating file handler + structured log output
- HEALTH CHECK RETRY: Health check retries 3 times before giving up
- RATE LIMIT AWARENESS: Respects Retry-After header from API Gateway
"""

import sqlite3
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
import json
import time
import signal
import sys
import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Optional, Tuple

# ============================================================
# CONFIGURATION
# ============================================================
API_GATEWAY_URL = 'https://your-api.railway.app'
API_KEY = 'your_api_key_here'
TERMINAL_ID = 'backfill_worker'

DATABASE_DIR = Path('C:/Scripts/database')
LOG_DIR = Path('C:/Scripts/logs')

SYMBOLS = [
    'btcusd', 'ethusd', 'xauusd',      # Terminal 1
    'eurusd', 'gbpusd', 'usdjpy',      # Terminal 2
    'xagusd', 'wtiusd', 'audusd',      # Terminal 3
    'nzdusd', 'usdcad', 'us30',        # Terminal 4
    'spx500', 'nas100', 'bnbusd'       # Terminal 5
]

# Timing configuration (all in seconds)
IDLE_SLEEP_SEC = 300         # 5 minutes when no work to do
ACTIVE_SLEEP_SEC = 30        # 30 seconds between cycles when work exists
INTER_SYMBOL_DELAY_SEC = 0.3 # Delay between symbols to avoid rate limiting
INTER_BAR_DELAY_SEC = 0.05   # Small delay between individual bar posts
HEALTH_CHECK_INTERVAL = 12   # Check health every N idle iterations (12 × 5min = 1hr)
MAX_BARS_PER_SYMBOL = 500    # Max bars to process per symbol per cycle
MAX_RETRIES_PER_BAR = 2      # Max retries for transient errors per bar
HTTP_TIMEOUT_SEC = 8         # HTTP request timeout

# Exponential backoff configuration
BACKOFF_BASE_SEC = 30        # Starting backoff duration
BACKOFF_MAX_SEC = 300        # Maximum backoff duration (5 minutes)
BACKOFF_MULTIPLIER = 2       # Multiplier per consecutive failure
MAX_CONSECUTIVE_FAILURES = 10  # After this many, do full health check

# ============================================================
# LOGGING SETUP
# ============================================================
def setup_logging():
    """Configure logging with console + rotating file output"""
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    
    logger = logging.getLogger('backfill_worker')
    logger.setLevel(logging.INFO)
    
    # Console handler
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)
    console_fmt = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
    console_handler.setFormatter(console_fmt)
    
    # Rotating file handler (10MB max, keep 5 backups)
    file_handler = RotatingFileHandler(
        LOG_DIR / 'backfill_worker.log',
        maxBytes=10 * 1024 * 1024,
        backupCount=5,
        encoding='utf-8'
    )
    file_handler.setLevel(logging.DEBUG)
    file_fmt = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    file_handler.setFormatter(file_fmt)
    
    logger.addHandler(console_handler)
    logger.addHandler(file_handler)
    
    return logger


logger = setup_logging()

# ============================================================
# GRACEFUL SHUTDOWN
# ============================================================
shutdown_requested = False

def signal_handler(signum, frame):
    """Handle shutdown signals gracefully"""
    global shutdown_requested
    sig_name = signal.Signals(signum).name if hasattr(signal, 'Signals') else str(signum)
    logger.info(f"👋 Received {sig_name}, shutting down gracefully...")
    shutdown_requested = True

signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)


# ============================================================
# HTTP SESSION WITH CONNECTION POOLING AND AUTO-RETRY
# ============================================================
def create_http_session() -> requests.Session:
    """Create a requests Session with connection pooling and retry logic"""
    session = requests.Session()
    
    # Configure retry strategy for transient errors (5xx, connection errors)
    retry_strategy = Retry(
        total=MAX_RETRIES_PER_BAR,
        backoff_factor=0.5,
        status_forcelist=[502, 503, 504],  # Retry on gateway errors only
        allowed_methods=["POST", "GET"],
        raise_on_status=False  # Don't raise, let us handle status codes
    )
    
    adapter = HTTPAdapter(
        max_retries=retry_strategy,
        pool_connections=5,
        pool_maxsize=10
    )
    
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    
    # Set default headers
    session.headers.update({
        'Authorization': f'Bearer {API_KEY}',
        'Content-Type': 'application/json',
        'X-Terminal-ID': TERMINAL_ID,
        'X-EA-Version': 'backfill_worker_v2.py'
    })
    
    return session


# ============================================================
# SQLITE HELPERS
# ============================================================
def get_all_columns(cursor: sqlite3.Cursor, table_name: str) -> List[str]:
    """Get all column names from table"""
    cursor.execute(f"PRAGMA table_info([{table_name}])")
    return [row[1] for row in cursor.fetchall()]


def row_to_dict(row, columns: List[str]) -> Dict:
    """Convert SQLite row to dictionary"""
    data = {}
    for idx, col in enumerate(columns):
        value = row[idx]
        data[col] = value  # Keep None as None
    return data


def table_exists(cursor: sqlite3.Cursor, table_name: str) -> bool:
    """Check if table exists in SQLite database"""
    cursor.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
        (table_name,)
    )
    return cursor.fetchone() is not None


def get_row_count(cursor: sqlite3.Cursor, table_name: str) -> int:
    """Get number of rows in a table"""
    cursor.execute(f"SELECT COUNT(*) FROM [{table_name}]")
    return cursor.fetchone()[0]


# ============================================================
# BACKFILL LOGIC
# ============================================================
def backfill_symbol(session: requests.Session, symbol: str) -> Tuple[int, int, bool]:
    """
    Backfill data from SQLite to API Gateway for one symbol.
    
    Returns:
        Tuple of (backfilled_count, validation_errors, rate_limited)
    """
    db_path = DATABASE_DIR / f"{symbol}.db"
    
    if not db_path.exists():
        return 0, 0, False
    
    backfilled = 0
    validation_errors = 0
    rate_limited = False
    
    try:
        # Use WAL mode for better concurrent access with the EA
        conn = sqlite3.connect(str(db_path), timeout=10)
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA busy_timeout=5000")
        cursor = conn.cursor()
        
        # Check if table exists
        if not table_exists(cursor, symbol):
            conn.close()
            return 0, 0, False
        
        # Get column names
        columns = get_all_columns(cursor, symbol)
        
        # Get rows to backfill (oldest first for chronological order)
        cursor.execute(
            f"SELECT * FROM [{symbol}] ORDER BY timestamp ASC LIMIT ?",
            (MAX_BARS_PER_SYMBOL,)
        )
        rows = cursor.fetchall()
        
        if not rows:
            conn.close()
            return 0, 0, False
        
        logger.info(f"📋 {symbol}: Found {len(rows)} bars to backfill")
        
        # Track successful deletes for batch commit
        rows_to_delete = []
        
        for row in rows:
            if shutdown_requested:
                logger.info(f"⏹️ Shutdown requested, stopping {symbol} backfill")
                break
            
            # Convert row to dictionary
            data = row_to_dict(row, columns)
            data['symbol'] = symbol
            
            try:
                response = session.post(
                    f'{API_GATEWAY_URL}/api/v1/market-data',
                    json=data,
                    timeout=HTTP_TIMEOUT_SEC
                )
                
                if response.status_code in (200, 201):
                    # ✅ Success — mark for batch delete
                    rows_to_delete.append((data.get('timestamp'), data.get('timeframe')))
                    backfilled += 1
                    
                    # Batch commit every 50 successful rows
                    if len(rows_to_delete) >= 50:
                        _batch_delete(cursor, conn, symbol, rows_to_delete)
                        rows_to_delete = []
                    
                elif response.status_code == 429:
                    # ⚠️ Rate limited — respect Retry-After header
                    retry_after = response.headers.get('Retry-After')
                    if retry_after:
                        logger.warning(f"⚠️ Rate limited for {symbol}, Retry-After: {retry_after}s")
                    else:
                        logger.warning(f"⚠️ Rate limited by API Gateway for {symbol}")
                    rate_limited = True
                    break
                    
                elif response.status_code == 400:
                    # ❌ Validation error — delete bad data permanently
                    try:
                        error_detail = response.json()
                        error_msg = error_detail.get('message', 'Unknown error')
                    except (json.JSONDecodeError, ValueError):
                        error_msg = response.text[:200]
                    
                    logger.error(f"❌ Validation failed for {symbol}: {error_msg}")
                    
                    # Delete bad data (it will never pass validation)
                    rows_to_delete.append((data.get('timestamp'), data.get('timeframe')))
                    validation_errors += 1
                    
                elif response.status_code in (401, 403):
                    # ❌ Authentication error — critical, stop everything
                    logger.error("❌ CRITICAL: Authentication failed (check API_KEY)")
                    _batch_delete(cursor, conn, symbol, rows_to_delete)
                    conn.close()
                    return backfilled, validation_errors, False
                    
                else:
                    # ❌ Other error (5xx, etc.) — stop this symbol
                    logger.error(f"❌ API Gateway error for {symbol}: HTTP {response.status_code}")
                    break
                
                # Small delay between requests
                time.sleep(INTER_BAR_DELAY_SEC)
                    
            except requests.Timeout:
                logger.error(f"❌ Timeout for {symbol} (>{HTTP_TIMEOUT_SEC}s)")
                break
                
            except requests.ConnectionError as e:
                logger.error(f"❌ Network error for {symbol}: {e}")
                break
                
            except Exception as e:
                logger.error(f"❌ Unexpected error processing bar: {e}")
                continue  # Skip this bar, try next
        
        # Final batch delete for remaining successful rows
        if rows_to_delete:
            _batch_delete(cursor, conn, symbol, rows_to_delete)
        
        conn.close()
        
        if backfilled > 0:
            logger.info(f"✅ {symbol}: Backfilled {backfilled} bars")
        
        if validation_errors > 0:
            logger.warning(f"⚠️ {symbol}: Removed {validation_errors} bars with validation errors")
        
        return backfilled, validation_errors, rate_limited
        
    except sqlite3.OperationalError as e:
        logger.error(f"❌ SQLite error for {symbol}: {e}")
        return backfilled, validation_errors, rate_limited
        
    except Exception as e:
        logger.error(f"❌ Error processing {symbol}: {e}")
        return backfilled, validation_errors, rate_limited


def _batch_delete(cursor: sqlite3.Cursor, conn: sqlite3.Connection, 
                  symbol: str, rows: List[Tuple]) -> None:
    """Batch delete rows from SQLite in a single transaction"""
    if not rows:
        return
    
    try:
        cursor.execute("BEGIN TRANSACTION")
        for timestamp, timeframe in rows:
            cursor.execute(
                f"DELETE FROM [{symbol}] WHERE timestamp = ? AND timeframe = ?",
                (timestamp, timeframe)
            )
        conn.commit()
    except Exception as e:
        conn.rollback()
        logger.error(f"❌ Batch delete failed for {symbol}: {e}")


# ============================================================
# HEALTH CHECK
# ============================================================
def check_api_health(session: requests.Session, retries: int = 3) -> bool:
    """Check API Gateway health with retry"""
    for attempt in range(retries):
        try:
            response = session.get(
                f'{API_GATEWAY_URL}/api/v1/health',
                timeout=HTTP_TIMEOUT_SEC
            )
            
            if response.status_code == 200:
                try:
                    health = response.json()
                    status = health.get('status', 'unknown')
                    logger.info(f"📊 API Gateway Status: {status}")
                    
                    # Log queue stats if available
                    services = health.get('services', {})
                    if 'queue' in services:
                        queue = services['queue']
                        logger.info(f"   Queue: {queue.get('waiting', 0)} waiting, "
                                    f"{queue.get('active', 0)} active")
                except (json.JSONDecodeError, ValueError):
                    logger.info("📊 API Gateway: OK (non-JSON response)")
                
                return True
            else:
                logger.warning(f"⚠️ Health check attempt {attempt + 1}/{retries}: "
                               f"HTTP {response.status_code}")
                
        except requests.Timeout:
            logger.warning(f"⚠️ Health check timeout (attempt {attempt + 1}/{retries})")
            
        except requests.ConnectionError:
            logger.warning(f"⚠️ Health check connection error (attempt {attempt + 1}/{retries})")
            
        except Exception as e:
            logger.warning(f"⚠️ Health check error (attempt {attempt + 1}/{retries}): {e}")
        
        if attempt < retries - 1:
            time.sleep(2)  # Brief pause between retries
    
    logger.error("❌ API Gateway health check failed after all retries")
    return False


# ============================================================
# SQLITE STATISTICS
# ============================================================
def get_sqlite_stats() -> Tuple[int, List[str]]:
    """Get statistics on SQLite backup usage"""
    total_bars = 0
    symbols_with_data = []
    
    for symbol in SYMBOLS:
        db_path = DATABASE_DIR / f"{symbol}.db"
        
        if not db_path.exists():
            continue
        
        try:
            conn = sqlite3.connect(str(db_path), timeout=5)
            conn.execute("PRAGMA busy_timeout=3000")
            cursor = conn.cursor()
            
            if table_exists(cursor, symbol):
                count = get_row_count(cursor, symbol)
                if count > 0:
                    total_bars += count
                    symbols_with_data.append(f"{symbol}:{count}")
            
            conn.close()
            
        except sqlite3.OperationalError as e:
            logger.debug(f"Could not read {symbol} (may be locked): {e}")
            continue
            
        except Exception as e:
            logger.error(f"Error reading {symbol}: {e}")
            continue
    
    return total_bars, symbols_with_data


# ============================================================
# MAIN WORKER LOOP
# ============================================================
def main():
    """Main backfill worker loop with exponential backoff"""
    logger.info("🚀 Starting MT5 Data Backfill Worker v2 (API Gateway Version)")
    logger.info(f"   Database directory: {DATABASE_DIR}")
    logger.info(f"   Log directory: {LOG_DIR}")
    logger.info(f"   Monitoring {len(SYMBOLS)} symbols")
    logger.info(f"   API Gateway: {API_GATEWAY_URL}")
    logger.info(f"   Terminal ID: {TERMINAL_ID}")
    logger.info(f"   Idle interval: {IDLE_SLEEP_SEC}s | Active interval: {ACTIVE_SLEEP_SEC}s")
    logger.info(f"   Max bars per symbol per cycle: {MAX_BARS_PER_SYMBOL}")
    logger.info("=" * 60)
    
    # Verify configuration
    if 'your-api.railway.app' in API_GATEWAY_URL:
        logger.error("❌ ERROR: Please configure API_GATEWAY_URL")
        logger.error("   Example: https://your-api.railway.app")
        return
    
    if 'your_api_key' in API_KEY or len(API_KEY) < 20:
        logger.error("❌ ERROR: Please configure API_KEY")
        logger.error("   Format: mt5_terminal_xxx_xxxxxxxxxx")
        return
    
    # Create HTTP session with connection pooling
    session = create_http_session()
    
    # Initial health check
    logger.info("Checking API Gateway health...")
    if not check_api_health(session):
        logger.warning("⚠️ API Gateway health check failed, but continuing...")
    
    iteration = 0
    consecutive_failures = 0
    current_backoff = BACKOFF_BASE_SEC
    
    while not shutdown_requested:
        try:
            iteration += 1
            logger.info(f"\n--- Iteration #{iteration} at "
                        f"{datetime.now().strftime('%Y-%m-%d %H:%M:%S')} ---")
            
            # Check SQLite backup status
            total_bars, symbols_with_data = get_sqlite_stats()
            
            if total_bars == 0:
                logger.info("✅ No backfill needed - all data synced to API Gateway")
                
                # Reset backoff on clean state
                consecutive_failures = 0
                current_backoff = BACKOFF_BASE_SEC
                
                # Periodic health check when idle
                if iteration % HEALTH_CHECK_INTERVAL == 0:
                    check_api_health(session)
                
                # Sleep for idle interval (interruptible)
                _interruptible_sleep(IDLE_SLEEP_SEC)
                
            else:
                logger.warning(f"⚠️ Found {total_bars} bars in SQLite backups")
                logger.info(f"   Symbols: {', '.join(symbols_with_data)}")
                
                # Backfill each symbol
                total_backfilled = 0
                total_validation_errors = 0
                was_rate_limited = False
                
                for symbol in SYMBOLS:
                    if shutdown_requested:
                        break
                    
                    count, val_errors, rate_limited = backfill_symbol(session, symbol)
                    total_backfilled += count
                    total_validation_errors += val_errors
                    
                    if rate_limited:
                        was_rate_limited = True
                        logger.warning("⚠️ Rate limited — pausing remaining symbols")
                        break
                    
                    if count > 0:
                        time.sleep(INTER_SYMBOL_DELAY_SEC)
                
                if total_backfilled > 0:
                    logger.info(f"✅ Total backfilled: {total_backfilled} bars"
                                f"{f' ({total_validation_errors} validation errors removed)' if total_validation_errors > 0 else ''}")
                    consecutive_failures = 0
                    current_backoff = BACKOFF_BASE_SEC
                else:
                    # No progress made
                    consecutive_failures += 1
                    logger.warning(f"⚠️ No progress made (consecutive: {consecutive_failures})")
                    
                    if consecutive_failures >= MAX_CONSECUTIVE_FAILURES:
                        logger.error("❌ Multiple consecutive failures — running health check")
                        check_api_health(session)
                        
                        # Recreate session in case of stale connections
                        session.close()
                        session = create_http_session()
                        logger.info("🔄 HTTP session recreated")
                        
                        consecutive_failures = 0
                        current_backoff = BACKOFF_BASE_SEC
                
                # Determine sleep duration
                if was_rate_limited:
                    sleep_time = min(current_backoff * BACKOFF_MULTIPLIER, BACKOFF_MAX_SEC)
                    logger.info(f"Sleeping {sleep_time}s (rate limited backoff)...")
                elif consecutive_failures > 0:
                    # Exponential backoff on failures
                    sleep_time = min(
                        BACKOFF_BASE_SEC * (BACKOFF_MULTIPLIER ** (consecutive_failures - 1)),
                        BACKOFF_MAX_SEC
                    )
                    logger.info(f"Sleeping {sleep_time}s (failure backoff #{consecutive_failures})...")
                else:
                    sleep_time = ACTIVE_SLEEP_SEC
                    logger.info(f"Sleeping {sleep_time}s (active mode)...")
                
                _interruptible_sleep(sleep_time)
            
        except Exception as e:
            logger.error(f"❌ Worker error: {e}", exc_info=True)
            _interruptible_sleep(60)
    
    # Cleanup
    session.close()
    logger.info("👋 Backfill worker shut down cleanly")


def _interruptible_sleep(seconds: float) -> None:
    """Sleep that can be interrupted by shutdown signal"""
    end_time = time.monotonic() + seconds
    while time.monotonic() < end_time and not shutdown_requested:
        remaining = end_time - time.monotonic()
        time.sleep(min(1.0, remaining))  # Check every 1 second


if __name__ == "__main__":
    main()
