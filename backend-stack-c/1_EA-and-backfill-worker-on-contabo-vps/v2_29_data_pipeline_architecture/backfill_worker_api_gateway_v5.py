#!/usr/bin/env python3
"""
Market Data Push Worker v5 - API Gateway Version (v6 pipeline)

v5 redesign (from v4):
- SOURCE OF TRUTH CHANGE: v4 drained the EA's per-symbol SQLite fallback
  tables and DELETED rows after a confirmed POST. v5 pushes VALIDATED rows
  from the v6 pipeline's market_data table (xauusd.db) and stamps synced_at
  on 200/201 — market_data is a permanent store, rows are NEVER deleted.
- Scope: XAUUSD only, M5/M15 (the v6 pipeline scope).
- Rows are produced by export_collector_validator_v2.py
  (COLLECT -> ADJUST -> VALIDATE -> CALCULATE -> PROMOTE); every pushed row
  has passed cross-source validation and carries the Python-calculated
  derived columns (see backend-stack-c/2_python-calc-stack/).
- 400 rejections are quarantined to rejected_rows.jsonl AND stamped synced_at
  (with a log marker) so a poison row cannot block the outbox; the JSONL
  preserves it for replay after a gateway fix.

Kept from v4: connection pooling + retry session, exponential backoff,
Retry-After handling, graceful shutdown, rotating logs, health checks.
"""

import json
import logging
import os
import signal
import sqlite3
import time
from datetime import datetime
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Tuple

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# ============================================================
# CONFIGURATION
# ============================================================
API_GATEWAY_URL = os.environ.get('API_GATEWAY_URL', 'https://your-api.railway.app')
API_KEY = os.environ.get('BACKFILL_API_KEY', 'your_api_key_here')
TERMINAL_ID = 'push_worker_v5'

# The 87 fields gateway_contract_market_data.schema.json requires, as posted
# (i.e. after dropping market_data's own synced_at and adding terminal_id).
# (Was 79 before the 2026-09-03 best_fit_a/best_fit_b split added 8 fields.)
# Checked once at startup against the real market_data table so drift between
# this SQLite schema and the JSON contract fails loudly instead of silently
# producing 400s at the gateway.
EXPECTED_CONTRACT_FIELDS = frozenset({
    'terminal_id', 'timestamp', 'symbol', 'timeframe',
    'open', 'high', 'low', 'close', 'volume',
    *(f'{variant}_{suffix}'
      for variant in ('best_fit_a', 'best_fit_b', 'cherry_a', 'cherry_b', 'most_recent', 'non_a', 'non_b')
      for suffix in ('horiz_high_map', 'horiz_low_map', 'ssa', 'ema_ssa',
                     'crossing', 'base_fl', 'uoedt', 'loedt')),
    'fractal_best_fl', 'fractal_uoedt', 'fractal_loedt',
    'best_resistance', 'best_support',
    'body_direction', 'body_size', 'body_classification',
    'zigzag_point_type', 'zigzag_current_point', 'zigzag_price_change',
    'zigzag_pct_change', 'zigzag_pct_change_class', 'zigzag_bars',
    'zigzag_bars_class', 'zigzag_price_per_bar', 'zigzag_price_per_bar_class',
    'zigzag_slope', 'zigzag_category',
    'cycle_id', 'collected_at', 'calculated_at',
})
assert len(EXPECTED_CONTRACT_FIELDS) == 87, len(EXPECTED_CONTRACT_FIELDS)

DB_PATH = Path('C:/Scripts/database/xauusd.db')      # the v6 pipeline database
LOG_DIR = Path('C:/Scripts/logs')
REJECTED_ROWS_FILE = DB_PATH.parent / 'rejected_rows.jsonl'

IDLE_SLEEP_SEC = 300          # no unsynced rows
ACTIVE_SLEEP_SEC = 30         # backlog present
MAX_ROWS_PER_CYCLE = 500
INTER_ROW_DELAY_SEC = 0.05
HTTP_TIMEOUT_SEC = 8
HEALTH_CHECK_INTERVAL = 12

BACKOFF_BASE_SEC = 30
BACKOFF_MAX_SEC = 300
BACKOFF_MULTIPLIER = 2
MAX_CONSECUTIVE_FAILURES = 10


# ============================================================
# LOGGING / SHUTDOWN
# ============================================================
def setup_logging():
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    lg = logging.getLogger('push_worker')
    lg.setLevel(logging.INFO)
    ch = logging.StreamHandler()
    ch.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(message)s'))
    fh = RotatingFileHandler(LOG_DIR / 'push_worker.log', maxBytes=10 * 1024 * 1024,
                             backupCount=5, encoding='utf-8')
    fh.setFormatter(logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s'))
    lg.addHandler(ch)
    lg.addHandler(fh)
    return lg


logger = setup_logging()
shutdown_requested = False


def signal_handler(signum, frame):
    global shutdown_requested
    logger.info("👋 Shutdown requested...")
    shutdown_requested = True


signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)


def create_http_session() -> requests.Session:
    session = requests.Session()
    retry = Retry(total=2, backoff_factor=0.5, status_forcelist=[502, 503, 504],
                  allowed_methods=["POST", "GET"], raise_on_status=False)
    adapter = HTTPAdapter(max_retries=retry, pool_connections=5, pool_maxsize=10)
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    # terminal_id travels in the request body only (gateway_contract_market_data
    # .schema.json); the gateway has no EA-version concept, so no extra headers
    # are sent beyond auth.
    session.headers.update({
        'Authorization': f'Bearer {API_KEY}',
        'Content-Type': 'application/json',
    })
    return session


# ============================================================
# OUTBOX
# ============================================================
def open_db() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH), timeout=10)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA busy_timeout=5000")
    conn.row_factory = sqlite3.Row
    return conn


def unsynced_count(conn) -> int:
    return conn.execute(
        "SELECT COUNT(*) FROM market_data WHERE synced_at IS NULL").fetchone()[0]


def verify_schema_contract(conn) -> bool:
    """Confirm market_data's columns match gateway_contract_market_data.schema.json
    exactly (87 fields posted = table columns minus synced_at plus terminal_id).
    Run once at startup so a future drift between the SQL schema and the JSON
    contract fails loudly here instead of surfacing as silent 400s at the gateway.
    """
    table_columns = {row[1] for row in conn.execute("PRAGMA table_info(market_data)")}
    posted_fields = (table_columns - {'synced_at'}) | {'terminal_id'}

    missing = EXPECTED_CONTRACT_FIELDS - posted_fields
    unexpected = posted_fields - EXPECTED_CONTRACT_FIELDS
    if missing or unexpected:
        logger.error("❌ market_data columns do not match gateway_contract_market_data.schema.json:")
        if missing:
            logger.error(f"   Missing (in contract, not in table): {sorted(missing)}")
        if unexpected:
            logger.error(f"   Unexpected (in table, not in contract): {sorted(unexpected)}")
        return False

    logger.info(f"✅ Schema contract verified: {len(posted_fields)} fields match gateway_contract_market_data.schema.json")
    return True


def quarantine_row(data: dict, error_msg: str) -> None:
    try:
        with open(REJECTED_ROWS_FILE, 'a', encoding='utf-8') as f:
            f.write(json.dumps({'quarantined_at': datetime.now().isoformat(),
                                'gateway_error': error_msg, 'row': data}) + '\n')
    except Exception as e:
        logger.error(f"❌ Failed to quarantine rejected row: {e}")


def push_batch(session: requests.Session, conn) -> Tuple[int, int, bool]:
    """Push up to MAX_ROWS_PER_CYCLE unsynced market_data rows (oldest first).
    Returns (pushed, quarantined, rate_limited)."""
    rows = conn.execute(
        "SELECT * FROM market_data WHERE synced_at IS NULL "
        "ORDER BY timestamp ASC LIMIT ?", (MAX_ROWS_PER_CYCLE,)).fetchall()
    pushed = quarantined = 0
    rate_limited = False

    for row in rows:
        if shutdown_requested:
            break
        data = {k: row[k] for k in row.keys() if k != 'synced_at'}
        data['terminal_id'] = TERMINAL_ID

        try:
            resp = session.post(f'{API_GATEWAY_URL}/api/v1/market-data',
                                json=data, timeout=HTTP_TIMEOUT_SEC)
        except (requests.Timeout, requests.ConnectionError) as e:
            logger.error(f"❌ Network error: {e}")
            break

        if resp.status_code in (200, 201):
            conn.execute("UPDATE market_data SET synced_at = ? WHERE timestamp = ? AND timeframe = ?",
                         (int(time.time()), row['timestamp'], row['timeframe']))
            pushed += 1
            if pushed % 50 == 0:
                conn.commit()
        elif resp.status_code == 429:
            retry_after = resp.headers.get('Retry-After')
            logger.warning(f"⚠️ Rate limited{f', Retry-After: {retry_after}s' if retry_after else ''}")
            rate_limited = True
            break
        elif resp.status_code == 400:
            try:
                msg = resp.json().get('message', 'Unknown error')
            except (json.JSONDecodeError, ValueError):
                msg = resp.text[:200]
            logger.error(f"❌ Gateway rejected bar {row['timestamp']}/{row['timeframe']}: {msg}")
            quarantine_row(data, msg)
            # stamp synced_at so a poison row cannot block the outbox;
            # the quarantine file preserves it for replay after a fix
            conn.execute("UPDATE market_data SET synced_at = ? WHERE timestamp = ? AND timeframe = ?",
                         (int(time.time()), row['timestamp'], row['timeframe']))
            quarantined += 1
        elif resp.status_code in (401, 403):
            logger.error("❌ CRITICAL: Authentication failed (check BACKFILL_API_KEY)")
            break
        else:
            logger.error(f"❌ Gateway error: HTTP {resp.status_code}")
            break

        time.sleep(INTER_ROW_DELAY_SEC)

    conn.commit()
    return pushed, quarantined, rate_limited


def check_api_health(session, retries: int = 3) -> bool:
    for attempt in range(retries):
        try:
            resp = session.get(f'{API_GATEWAY_URL}/api/v1/health', timeout=HTTP_TIMEOUT_SEC)
            if resp.status_code == 200:
                logger.info("📊 API Gateway: OK")
                return True
            logger.warning(f"⚠️ Health check {attempt + 1}/{retries}: HTTP {resp.status_code}")
        except Exception as e:
            logger.warning(f"⚠️ Health check {attempt + 1}/{retries}: {e}")
        if attempt < retries - 1:
            time.sleep(2)
    return False


def _interruptible_sleep(seconds: float) -> None:
    end = time.monotonic() + seconds
    while time.monotonic() < end and not shutdown_requested:
        time.sleep(min(1.0, end - time.monotonic()))


# ============================================================
# MAIN LOOP
# ============================================================
def main():
    logger.info("🚀 Market Data Push Worker v5 (v6 pipeline outbox)")
    logger.info(f"   Database: {DB_PATH}")
    logger.info(f"   Gateway: {API_GATEWAY_URL}")
    logger.info(f"   Quarantine: {REJECTED_ROWS_FILE}")

    if 'your-api.railway.app' in API_GATEWAY_URL:
        logger.error("❌ ERROR: Please configure API_GATEWAY_URL")
        return
    if 'your_api_key' in API_KEY or len(API_KEY) < 20:
        logger.error("❌ ERROR: Please configure BACKFILL_API_KEY")
        return
    if not DB_PATH.exists():
        logger.error(f"❌ ERROR: {DB_PATH} not found — run export_collector_validator_v2.py first")
        return

    contract_conn = open_db()
    try:
        if not verify_schema_contract(contract_conn):
            logger.error("❌ ERROR: refusing to start until market_data matches the gateway contract")
            return
    finally:
        contract_conn.close()

    session = create_http_session()
    check_api_health(session)

    iteration = 0
    consecutive_failures = 0
    while not shutdown_requested:
        try:
            iteration += 1
            conn = open_db()
            backlog = unsynced_count(conn)

            if backlog == 0:
                logger.info("✅ Outbox empty — all market_data rows synced")
                conn.close()
                consecutive_failures = 0
                if iteration % HEALTH_CHECK_INTERVAL == 0:
                    check_api_health(session)
                _interruptible_sleep(IDLE_SLEEP_SEC)
                continue

            logger.info(f"📋 {backlog} unsynced rows — pushing (≤{MAX_ROWS_PER_CYCLE}/cycle)")
            pushed, quarantined, rate_limited = push_batch(session, conn)
            conn.close()

            if pushed or quarantined:
                logger.info(f"✅ Pushed {pushed} rows"
                            f"{f', quarantined {quarantined}' if quarantined else ''}")
                consecutive_failures = 0
                sleep_time = ACTIVE_SLEEP_SEC
            else:
                consecutive_failures += 1
                sleep_time = min(BACKOFF_BASE_SEC * BACKOFF_MULTIPLIER ** (consecutive_failures - 1),
                                 BACKOFF_MAX_SEC)
                logger.warning(f"⚠️ No progress (#{consecutive_failures}) — backoff {sleep_time}s")
                if consecutive_failures >= MAX_CONSECUTIVE_FAILURES:
                    check_api_health(session)
                    session.close()
                    session = create_http_session()
                    logger.info("🔄 HTTP session recreated")
                    consecutive_failures = 0
            if rate_limited:
                sleep_time = max(sleep_time, BACKOFF_BASE_SEC * BACKOFF_MULTIPLIER)
            _interruptible_sleep(sleep_time)

        except Exception as e:
            logger.error(f"❌ Worker error: {e}", exc_info=True)
            _interruptible_sleep(60)

    session.close()
    logger.info("👋 Push worker shut down cleanly")


if __name__ == "__main__":
    main()
