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
  (COLLECT -> ADJUST -> VALIDATE -> PROMOTE); every pushed row has passed
  cross-source validation. Every value in it was computed and exported by the
  MQL5 indicators — nothing downstream of MT5 recalculates anything.
- 400 rejections are quarantined to rejected_rows.jsonl AND stamped synced_at
  (with a log marker) so a poison row cannot block the outbox; the JSONL
  preserves it for replay after a gateway fix.

Build step 2 part 3 (ADR-013, ADR-009), in place, same file name so the NSSM
service needs no change:
- NEWEST BARS FIRST. Each pass sends the latest validated slot's priority set
  (its newest 288 closed M5 and 96 closed M15 bars plus each timeframe's newest
  row, at most 386 rows) before anything else, then the cycle MANIFEST, then the
  backlog oldest-first with what is left of the 500-row budget. See push_cycle().
- The manifest (gateway_contract_cycle_manifest.schema.json) is built once into
  the cycle_manifests outbox and sent only after the priority rows have gone
  through. A failed send (404 from a gateway that lacks the endpoint, 5xx,
  timeout) is retried and never stamped or quarantined; only a 400 is.
- Against a database the new collector has not widened yet, the priority and
  manifest lanes switch off and prices flow exactly as before.

Build step 2 part 8 (ADR-066): a FOURTH lane, push_symbol_specs(), drains the
symbol_specs outbox (the broker's contract size, volume limits, tick size, typical
spread and swaps) to /api/v1/symbol-specs after prices, statistics and the economic
calendar. Isolated like they are: it swallows its own failures, so it cannot delay
price rows.

Build step 2 part 9 (ADR-015): the manifest also carries repush_rows_unsent, the
unsent rows older than the cycle's newest bars. Since build step 2 part 10
(Option A) it is an operational diagnostic only: the gateway ends RETUNING by
counting the window itself, because this count cannot reach 0 while the collector
re-queues the whole window every cycle. See unsent_counts().

Kept from v4: connection pooling + retry session, exponential backoff,
Retry-After handling, graceful shutdown, rotating logs, health checks.
"""

import json
import logging
import os
import signal
import sqlite3
import time
from dataclasses import dataclass, field
from datetime import datetime
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# ============================================================
# CONFIGURATION
# ============================================================
API_GATEWAY_URL = os.environ.get('API_GATEWAY_URL', 'https://your-api.railway.app')
API_KEY = os.environ.get('BACKFILL_API_KEY', 'your_api_key_here')
TERMINAL_ID = 'push_worker_v5'

# The 103 fields gateway_contract_market_data.schema.json requires, as posted
# (i.e. after dropping market_data's own synced_at and adding terminal_id).
# (Was 79 before the 2026-09-03 best_fit_a/best_fit_b split added 8 fields,
# 87 before the 2026-09-16 14th-indicator onboarding added sr_1..sr_8, and 95
# before the 2026-09-22 15th-indicator onboarding added sr_9..sr_16.)
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
    # 14th indicator (SupportAndResistantAutoCalibration_v2_29): sr_1..sr_4 are
    # the nearest supports below each bar's close, sr_5..sr_8 the nearest
    # resistances above it. Nullable; an unresolved slot posts as JSON null.
    'sr_1', 'sr_2', 'sr_3', 'sr_4', 'sr_5', 'sr_6', 'sr_7', 'sr_8',
    # 15th indicator (S-R-AutoCalibration_v2_29), a second calibration window:
    # sr_9..sr_12 supports below close, sr_13..sr_16 resistances above it.
    'sr_9', 'sr_10', 'sr_11', 'sr_12', 'sr_13', 'sr_14', 'sr_15', 'sr_16',
    'body_direction', 'body_size', 'body_classification',
    'zigzag_point_type', 'zigzag_current_point', 'zigzag_price_change',
    'zigzag_pct_change', 'zigzag_pct_change_class', 'zigzag_bars',
    'zigzag_bars_class', 'zigzag_price_per_bar', 'zigzag_price_per_bar_class',
    'zigzag_slope', 'zigzag_category',
    'cycle_id', 'collected_at', 'calculated_at',
})
assert len(EXPECTED_CONTRACT_FIELDS) == 103, len(EXPECTED_CONTRACT_FIELDS)

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


def unsent_counts(conn, slot: int) -> Tuple[int, int]:
    """(rows unsent, of those the historical ones) for a cycle's manifest.

    "Historical" is a row older than the cycle's newest bars: open time before
    slot - SLOT_SECONDS. That is the backlog a promote's re-push leaves queued
    behind the cycle (ADR-015); the newest bars themselves went out as the
    priority set before the manifest was built. ONE statement, so both numbers
    come from the same snapshot even while the collector is writing: the second
    can never exceed the first (the contract says it is "of backlog_rows").
    """
    return tuple(conn.execute(
        "SELECT COUNT(*), COALESCE(SUM(timestamp < ?), 0) FROM market_data WHERE synced_at IS NULL",
        (slot - SLOT_SECONDS,)).fetchone())


def verify_schema_contract(conn) -> bool:
    """Confirm market_data's columns match gateway_contract_market_data.schema.json
    exactly (103 fields posted = table columns minus synced_at plus terminal_id).
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


STAT_COLUMNS = [
    'symbol', 'timeframe', 'source', 'captured_at', 'live_bar_ts', 'cycle_id',
    'solution_found', 'raw_slope', 'anchored_y_int', 'regression_angle',
    'line_origin_ts', 'touches', 'window_start_ts', 'window_end_ts',
    'window_bars', 'math_lookback', 'crossings_n',
    'model_a_n', 'model_a_r2', 'model_a_mse', 'model_a_var_ratio',
    'model_a_skew', 'model_a_kurt',
    'model_b_n', 'model_b_r2', 'model_b_mse', 'model_b_var_ratio',
    'model_b_skew', 'model_b_kurt',
    'uoedt_offset', 'loedt_offset', 'containment_n', 'containment_count',
    'containment_rate',
    # extended statistics [added 2026-09-20]
    'window_span_bars', 'visual_window_bars', 'bars_available',
    'leftmost_bar_index', 'line_span_bars', 'baseline_coverage_n',
    'baseline_coverage_rate', 'centroids_used', 'crossings_in_window_n',
    'first_crossing_ts', 'last_crossing_ts', 'live_close',
    'baseline_value', 'uoedt_value', 'loedt_value',
    'dist_to_baseline', 'dist_to_uoedt', 'dist_to_loedt',
    'channel_position', 'window_high', 'window_low',
    'window_range', 'channel_width', 'channel_asymmetry',
    'breach_above_n', 'breach_below_n', 'max_excursion_above',
    'max_excursion_below', 'resid_a_n', 'resid_a_mean',
    'resid_a_mae', 'resid_a_sd', 'resid_a_max',
    'resid_a_dw', 'resid_b_n', 'resid_b_mean',
    'resid_b_mae', 'resid_b_sd', 'resid_b_max',
    'resid_b_dw',
    # sr_levels / sr2_levels calibration provenance [added 2026-09-20]
    'sr_fractals_n', 'sr_q25', 'sr_q75',
    'sr_iqr', 'sr_optimal_step', 'sr_macro_clusters',
    'sr_nearest_resistance', 'sr_nearest_support', 'sr_dist_resistance_pts',
    'sr_dist_support_pts',
    'config_hash', 'config_params',
]
STAT_MAX_ROWS_PER_CYCLE = 200          # a cycle produces at most 24 (12 sources x 2 TF)
REJECTED_STATS_FILE = DB_PATH.parent / 'rejected_statistics.jsonl'


def push_statistics(session: requests.Session, conn) -> int:
    """Drain the append-only statistics outbox to the gateway. Best-effort.

    Deliberately isolated from the market_data drain: its own table, its own
    endpoint, its own quarantine file, and every exception swallowed here. This
    is telemetry — valuable, but it must never be able to delay or fail price
    ingestion. The caller treats a return of 0 as "nothing to do", never as a
    reason to back off the market_data loop.

    BATCHED, unlike market_data's one-POST-per-row: a cycle yields at most 20
    small rows, so a single request is both cheaper and a low-risk place to
    prove the batching pattern before considering it for market_data (see
    PUSH-WORKER-THROUGHPUT-OPEN-ISSUE.md).
    """
    try:
        rows = conn.execute(
            f"SELECT {', '.join(STAT_COLUMNS)} FROM indicator_statistics "
            f"WHERE synced_at IS NULL ORDER BY captured_at ASC LIMIT ?",
            (STAT_MAX_ROWS_PER_CYCLE,)).fetchall()
        if not rows:
            return 0

        payload = []
        for r in rows:
            item = dict(zip(STAT_COLUMNS, r))
            item['terminal_id'] = TERMINAL_ID
            # SQLite has no boolean type; the contract expects one.
            if item['solution_found'] is not None:
                item['solution_found'] = bool(item['solution_found'])
            # config_params is stored as a JSON string, sent as an object.
            item['config_params'] = json.loads(item['config_params'])
            payload.append(item)

        resp = session.post(f'{API_GATEWAY_URL}/api/v1/indicator-statistics',
                            json=payload, timeout=HTTP_TIMEOUT_SEC)

        if resp.status_code in (200, 201):
            now = int(time.time())
            conn.executemany(
                "UPDATE indicator_statistics SET synced_at = ? "
                "WHERE symbol = ? AND timeframe = ? AND source = ? AND captured_at = ?",
                [(now, i['symbol'], i['timeframe'], i['source'], i['captured_at'])
                 for i in payload])
            conn.commit()
            logger.info(f"📊 Pushed {len(payload)} statistic snapshot(s)")
            return len(payload)

        if resp.status_code == 400:
            # Poison-batch guard, mirroring the market_data path: quarantine and
            # stamp synced_at so one bad snapshot cannot wedge the outbox.
            try:
                with open(REJECTED_STATS_FILE, 'a', encoding='utf-8') as f:
                    for i in payload:
                        f.write(json.dumps({'quarantined_at': datetime.now().isoformat(),
                                            'gateway_error': resp.text[:500],
                                            'row': i}, default=str) + '\n')
            except OSError as e:
                logger.error(f"❌ Failed to quarantine rejected statistics: {e}")
            now = int(time.time())
            conn.executemany(
                "UPDATE indicator_statistics SET synced_at = ? "
                "WHERE symbol = ? AND timeframe = ? AND source = ? AND captured_at = ?",
                [(now, i['symbol'], i['timeframe'], i['source'], i['captured_at'])
                 for i in payload])
            conn.commit()
            logger.warning(f"⚠️ Gateway rejected {len(payload)} statistic(s) — quarantined")
            return 0

        logger.warning(f"⚠️ Statistics push got HTTP {resp.status_code} — will retry")
        return 0
    except Exception as e:                                      # noqa: BLE001
        # Never propagate: the market_data drain must be unaffected.
        logger.warning(f"⚠️ Statistics push skipped: {e}")
        return 0


EVENT_COLUMNS = [
    'value_id', 'captured_at', 'event_id', 'event_time', 'event_period',
    'revision', 'country_code', 'currency', 'event_name', 'importance',
    'event_type', 'sector', 'frequency', 'time_mode', 'unit', 'multiplier',
    'digits', 'event_code', 'source_url',
    'actual_value', 'forecast_value', 'prev_value', 'revised_prev_value',
    'impact_type',
]
# The first sync after deployment carries the whole window (~333-545 rows); after
# that a cycle yields only what actually changed, typically a handful. The cap
# of 120 ensures the batch stays safely under Express's 100kb body-parser limit (which 413s at ~200 rows).
EVENT_MAX_ROWS_PER_CYCLE = 120
REJECTED_EVENTS_FILE = DB_PATH.parent / 'rejected_economic_events.jsonl'


def push_economic_events(session: requests.Session, conn) -> int:
    """Drain the append-only economic-events outbox to the gateway.

    A THIRD independent lane, isolated exactly like push_statistics(): its own
    table, endpoint and quarantine file, and every exception swallowed here so
    it can never delay or fail price ingestion. A return of 0 means "nothing to
    do", never a reason to back the market_data loop off.

    BATCHED, deliberately. market_data's one-POST-per-row shape is already
    under-provisioned for its own volume (PUSH-WORKER-THROUGHPUT-OPEN-ISSUE.md:
    ~800 rows/min demanded against 375-600 capacity). Inheriting that here would
    turn a 333-row first sync into 333 sequential requests for no reason — these
    rows are small, and one POST carries the lot.

    Ordered oldest-first, matching the other two lanes. Safe here in a way it is
    not for market_data: this outbox drains completely every cycle, so nothing
    can starve behind a backlog.
    """
    try:
        rows = conn.execute(
            f"SELECT {', '.join(EVENT_COLUMNS)} FROM economic_events "
            f"WHERE synced_at IS NULL ORDER BY captured_at ASC LIMIT ?",
            (EVENT_MAX_ROWS_PER_CYCLE,)).fetchall()
        if not rows:
            return 0

        # No type coercion needed: value_id/event_id are TEXT in SQLite and
        # strings in the contract (upstream they are 64-bit and JSON cannot
        # carry that as a number), and every value column is already a plain
        # REAL or NULL. NULL means "not published" and must reach the gateway
        # as JSON null, never as 0.
        payload = []
        for r in rows:
            item = dict(zip(EVENT_COLUMNS, r))
            item['terminal_id'] = TERMINAL_ID
            payload.append(item)

        resp = session.post(f'{API_GATEWAY_URL}/api/v1/economic-events',
                            json=payload, timeout=HTTP_TIMEOUT_SEC)

        if resp.status_code in (200, 201):
            now = int(time.time())
            conn.executemany(
                "UPDATE economic_events SET synced_at = ? "
                "WHERE value_id = ? AND captured_at = ?",
                [(now, i['value_id'], i['captured_at']) for i in payload])
            conn.commit()
            logger.info(f"📅 Pushed {len(payload)} economic event(s)")
            return len(payload)

        if resp.status_code == 400:
            # Poison-batch guard, same as the other two lanes: quarantine and
            # stamp synced_at so one malformed row cannot wedge the outbox
            # forever. The row survives in the .jsonl for replay after a fix.
            try:
                with open(REJECTED_EVENTS_FILE, 'a', encoding='utf-8') as f:
                    for i in payload:
                        f.write(json.dumps({'quarantined_at': datetime.now().isoformat(),
                                            'gateway_error': resp.text[:500],
                                            'row': i}, default=str) + '\n')
            except OSError as e:
                logger.error(f"❌ Failed to quarantine rejected events: {e}")
            now = int(time.time())
            conn.executemany(
                "UPDATE economic_events SET synced_at = ? "
                "WHERE value_id = ? AND captured_at = ?",
                [(now, i['value_id'], i['captured_at']) for i in payload])
            conn.commit()
            logger.warning(f"⚠️ Gateway rejected {len(payload)} event(s) — quarantined")
            return 0

        logger.warning(f"⚠️ Economic-events push got HTTP {resp.status_code} — will retry")
        return 0
    except Exception as e:                                      # noqa: BLE001
        # Never propagate: the market_data drain must be unaffected.
        logger.warning(f"⚠️ Economic-events push skipped: {e}")
        return 0


# ---- the symbol specs lane (build step 2 part 8; ADR-066, STACK-D section 6.9) ----
# The broker's figures for the symbol, appended to the symbol_specs outbox by the
# collector (about one row a day, plus one when a contract figure changes). The
# contract is gateway_contract_symbol_specs.schema.json: these are exactly its
# fields. terminal_id is the MT5 terminal the figures were read from, taken from
# the row, NOT this worker's TERMINAL_ID.
SPEC_COLUMNS = [
    'terminal_id', 'symbol', 'captured_at', 'contract_size', 'volume_min',
    'volume_step', 'volume_max', 'tick_size', 'typical_spread', 'swap_long',
    'swap_short', 'point', 'digits', 'swap_mode',
]
SPECS_ENDPOINT = '/api/v1/symbol-specs'
# A day yields one row, so a batch is normally one. The cap bounds the blast
# radius of a 400 (the whole batch is quarantined, as in the other lanes).
SPEC_MAX_ROWS_PER_CYCLE = 20
REJECTED_SPECS_FILE = DB_PATH.parent / 'rejected_symbol_specs.jsonl'

_symbol_specs_table_warned = False


def symbol_specs_table_available(conn) -> bool:
    """True when the symbol_specs outbox exists. The collector creates it from
    sqlite_schema_v6_xauusd.sql, so a database the new collector has not opened
    yet lacks it: the lane then idles, and says so once instead of every pass."""
    global _symbol_specs_table_warned
    ok = conn.execute("SELECT 1 FROM sqlite_master WHERE type = 'table' "
                      "AND name = 'symbol_specs'").fetchone() is not None
    if not ok and not _symbol_specs_table_warned:
        logger.warning("⚠️ symbol_specs table is missing: the symbol specs lane is OFF. Deploy the "
                       "matching sqlite_schema_v6_xauusd.sql beside the collector and restart it "
                       "(the collector creates the table when it starts)")
        _symbol_specs_table_warned = True
    return ok


def _symbol_specs_failed(conn, ids: List[int], error: str) -> None:
    """Record a failed send. Never stamps synced_at: a row the gateway has not
    acknowledged must be sent again."""
    conn.executemany("UPDATE symbol_specs SET send_attempts = send_attempts + 1, last_error = ? "
                     "WHERE id = ?", [(error[:300], i) for i in ids])
    conn.commit()
    logger.warning(f"⚠️ Symbol specs not delivered ({error}) — will retry")


def push_symbol_specs(session: requests.Session, conn) -> int:
    """Drain the symbol_specs outbox to the gateway. Best-effort.

    The FOURTH lane, isolated exactly like the statistics and economic-events
    lanes: its own table, endpoint and quarantine file, and every exception
    swallowed here so it can never delay or fail price ingestion. A return of 0
    means "nothing to do" or "not delivered", never a reason to back the
    market_data loop off.

    Oldest observation first, so the gateway, which numbers the versions in the
    order it records them, numbers them in the order they were observed.

      200/201  acknowledged: synced_at is stamped.
      400      the body is one the contract refuses and resending cannot fix:
               quarantine to rejected_symbol_specs.jsonl AND stamp synced_at, so
               one bad row cannot wedge the outbox (the file keeps it for replay).
      any other status (404 from a gateway without the endpoint, 429, 401/403,
               5xx) or a network error: retried; send_attempts and last_error say
               why, synced_at is never stamped.

    Returns the number of rows acknowledged.
    """
    try:
        if not symbol_specs_table_available(conn):
            return 0
        rows = conn.execute(
            f"SELECT id, {', '.join(SPEC_COLUMNS)} FROM symbol_specs "
            f"WHERE synced_at IS NULL ORDER BY captured_at ASC, id ASC LIMIT ?",
            (SPEC_MAX_ROWS_PER_CYCLE,)).fetchall()
        if not rows:
            return 0

        ids = [r[0] for r in rows]
        payload = [dict(zip(SPEC_COLUMNS, r[1:])) for r in rows]

        try:
            resp = session.post(f'{API_GATEWAY_URL}{SPECS_ENDPOINT}',
                                json=payload, timeout=HTTP_TIMEOUT_SEC)
        except Exception as e:                                  # noqa: BLE001
            _symbol_specs_failed(conn, ids, f"network error: {e}")
            return 0

        if resp.status_code in (200, 201):
            now = int(time.time())
            conn.executemany("UPDATE symbol_specs SET synced_at = ?, last_error = NULL WHERE id = ?",
                             [(now, i) for i in ids])
            conn.commit()
            logger.info(f"🧮 Pushed {len(payload)} symbol spec(s)")
            return len(payload)

        if resp.status_code == 400:
            try:
                with open(REJECTED_SPECS_FILE, 'a', encoding='utf-8') as f:
                    for i in payload:
                        f.write(json.dumps({'quarantined_at': datetime.now().isoformat(),
                                            'gateway_error': resp.text[:500],
                                            'row': i}, default=str) + '\n')
            except OSError as e:
                logger.error(f"❌ Failed to quarantine rejected symbol specs: {e}")
            now = int(time.time())
            conn.executemany("UPDATE symbol_specs SET synced_at = ?, last_error = ? WHERE id = ?",
                             [(now, 'rejected 400: ' + resp.text[:200], i) for i in ids])
            conn.commit()
            logger.warning(f"⚠️ Gateway rejected {len(payload)} symbol spec(s) — quarantined")
            return 0

        _symbol_specs_failed(conn, ids, f"HTTP {resp.status_code}")
        return 0
    except Exception as e:                                      # noqa: BLE001
        # Never propagate: the market_data drain must be unaffected.
        logger.warning(f"⚠️ Symbol specs push skipped: {e}")
        return 0


def quarantine_row(data: dict, error_msg: str) -> None:
    try:
        with open(REJECTED_ROWS_FILE, 'a', encoding='utf-8') as f:
            f.write(json.dumps({'quarantined_at': datetime.now().isoformat(),
                                'gateway_error': error_msg, 'row': data}) + '\n')
    except Exception as e:
        logger.error(f"❌ Failed to quarantine rejected row: {e}")


# ============================================================
# CYCLE PRIORITY AND MANIFEST (ADR-013, ADR-009; build step 2 part 3)
# ============================================================
# The collector re-queues EVERY in-window row each cycle (promote_cycle()'s
# INSERT OR REPLACE clears synced_at), so about 6,000 rows are unsent at any
# moment and a cycle's newest bars used to queue behind them oldest-first.
# push_cycle() sends the slot's newest bars first, then a short manifest that
# says what was sent, then the backlog oldest-first with what is left of the
# row budget. Oldest-first backlog is kept on purpose: it drains the stragglers
# that scrolled out of MT5's window while unsynced, which is what stops SQLite
# growing (PUSH-WORKER-THROUGHPUT-OPEN-ISSUE.md).
SYMBOL = 'XAUUSD'
SLOT_SECONDS = 300
TF_SECONDS = {'M5': 300, 'M15': 900}
TIMEFRAME_ORDER = ('M5', 'M15')

# Rule 4 (STACK-D-ARCHITECTURE.md section 1.3): "1 day of OHLC" is the last 288
# closed M5 bars and 96 closed M15 bars. The same 288 is the most a sensor
# window reads (a channel MCD reads min(T_EDT - 1, 288) closed M5 bars, ADR-083),
# so the priority set covers everything the first sensors and the prompt need.
# Plus each timeframe's newest row when it is not closed yet: 289 + 97 = 386
# rows, inside the 500-row budget.
PRIORITY_CLOSED_BARS = {'M5': 288, 'M15': 96}

COLLECTOR_MAX_ATTEMPTS = 3        # export_collector_validator_v2.MAX_ATTEMPTS_PER_CYCLE (a test pins the two together)
M15_SETTLE_SEC = 240              # how long a refresh slot waits for its M15 cycle before the manifest goes without it
MANIFEST_SCHEMA = 'cycle-manifest/1'
MANIFEST_ENDPOINT = '/api/v1/cycle-manifest'
MANIFEST_MAX_AGE_SEC = 3600       # a manifest older than this is not worth sending any more
MANIFEST_MAX_PER_ITERATION = 3
REJECTED_MANIFESTS_FILE = DB_PATH.parent / 'rejected_manifests.jsonl'

# collection_cycles columns the manifest needs; absent on a database the new
# collector has not widened yet (see migrate_cycles_table in the collector).
CYCLE_FACT_COLUMNS = frozenset({'export_dir', 'export_mtime', 'newest_bar_ts', 'finished_at'})

_cycle_facts_warned = False
# Priority rows the gateway rejected with a 400, per (slot, timeframe). Diagnostic
# only and process-local: after a restart it under-reports, and the gateway's own
# landed-row count is the real check.
_priority_quarantined: Dict[Tuple[int, str], int] = {}


def _fetch_dicts(conn, sql: str, params=()) -> List[dict]:
    """Rows as dicts whatever the connection's row_factory is."""
    cur = conn.execute(sql, params)
    names = [d[0] for d in cur.description]
    return [dict(zip(names, row)) for row in cur.fetchall()]


def cycle_facts_available(conn) -> bool:
    """True when the collector has widened collection_cycles for the manifest.

    A new push worker can meet an old collector's database. In that case the
    worker must keep pushing prices exactly as before instead of failing on a
    missing column, so the priority and manifest lanes simply switch off.
    """
    global _cycle_facts_warned
    cols = {r[1] for r in conn.execute("PRAGMA table_info(collection_cycles)")}
    ok = CYCLE_FACT_COLUMNS <= cols
    if not ok and not _cycle_facts_warned:
        logger.warning("⚠️ collection_cycles lacks the manifest columns "
                       f"({sorted(CYCLE_FACT_COLUMNS - cols)}): newest-first priority and the "
                       "cycle manifest are OFF until the collector is updated and restarted")
        _cycle_facts_warned = True
    return ok


_manifest_table_warned = False


def manifest_table_available(conn) -> bool:
    """True when the manifest outbox exists. The collector creates it from
    sqlite_schema_v6_xauusd.sql, so a collector deployed WITHOUT the matching
    schema file leaves it missing: the manifest lane then switches off, and that
    is said once, loudly, instead of failing silently."""
    global _manifest_table_warned
    ok = conn.execute("SELECT 1 FROM sqlite_master WHERE type = 'table' "
                      "AND name = 'cycle_manifests'").fetchone() is not None
    if not ok and not _manifest_table_warned:
        logger.warning("⚠️ cycle_manifests table is missing: the cycle manifest is OFF. Deploy the "
                       "matching sqlite_schema_v6_xauusd.sql beside the collector and restart it "
                       "(the collector creates the table when it starts)")
        _manifest_table_warned = True
    return ok


_CYCLE_COLUMNS = ("cycle_id, cycle_time, timeframe, attempt, created_at, validated_at, "
                  "export_dir, export_mtime, newest_bar_ts, finished_at")


def validated_cycle(conn, timeframe: str, slot: Optional[int] = None) -> Optional[dict]:
    """The newest validated collection cycle of a timeframe, or the one at `slot`."""
    if slot is None:
        rows = _fetch_dicts(
            conn, f"SELECT {_CYCLE_COLUMNS} FROM collection_cycles "
                  "WHERE timeframe = ? AND status = 'validated' "
                  "ORDER BY cycle_time DESC, attempt DESC LIMIT 1", (timeframe,))
    else:
        rows = _fetch_dicts(
            conn, f"SELECT {_CYCLE_COLUMNS} FROM collection_cycles "
                  "WHERE timeframe = ? AND status = 'validated' AND cycle_time = ? "
                  "ORDER BY attempt DESC LIMIT 1", (timeframe, slot))
    return rows[0] if rows else None


def latest_validated_slot(conn) -> Optional[int]:
    """The slot of the newest validated M5 cycle (M5 is collected on every slot)."""
    cycle = validated_cycle(conn, 'M5')
    return cycle['cycle_time'] if cycle else None


def priority_window(conn, timeframe: str, slot: int, newest_bar_ts: Optional[int]) -> List[int]:
    """Open times of the rows a slot must land FIRST, newest first.

    The newest PRIORITY_CLOSED_BARS bars that are closed at the slot (rule 2:
    open time + period at or before the slot), preceded by the newest row if it
    is not closed yet. Bounded above by the cycle's own newest bar so a later
    cycle's rows can never leak into an earlier slot's window. Closed-ness is
    judged against the SLOT, not the wall clock, so the answer for a slot does
    not change as time passes.
    """
    period = TF_SECONDS[timeframe]
    upper = newest_bar_ts if newest_bar_ts is not None else 2 ** 62
    newest_open = [r[0] for r in conn.execute(
        "SELECT timestamp FROM market_data WHERE timeframe = ? AND timestamp <= ? "
        "AND timestamp + ? > ? ORDER BY timestamp DESC LIMIT 1",
        (timeframe, upper, period, slot))]
    closed = [r[0] for r in conn.execute(
        "SELECT timestamp FROM market_data WHERE timeframe = ? AND timestamp <= ? "
        "AND timestamp + ? <= ? ORDER BY timestamp DESC LIMIT ?",
        (timeframe, upper, period, slot, PRIORITY_CLOSED_BARS[timeframe]))]
    return newest_open + closed


def priority_rows(conn, slot: int) -> List[dict]:
    """The UNSYNCED rows of the slot's priority set, newest first across both
    timeframes (ties: M5 first). A timeframe with no validated cycle at the slot
    contributes nothing: M15 on the slots that do not refresh it."""
    rows: List[dict] = []
    for tf in TIMEFRAME_ORDER:
        cycle = validated_cycle(conn, tf, slot)
        if cycle is None:
            continue
        stamps = priority_window(conn, tf, slot, cycle['newest_bar_ts'])
        if not stamps:
            continue
        marks = ','.join('?' * len(stamps))
        rows += _fetch_dicts(
            conn, "SELECT * FROM market_data WHERE timeframe = ? AND synced_at IS NULL "
                  f"AND timestamp IN ({marks})", [tf, *stamps])
    rows.sort(key=lambda r: (-r['timestamp'], TIMEFRAME_ORDER.index(r['timeframe'])))
    return rows


@dataclass
class SendResult:
    attempted: int = 0
    pushed: int = 0
    quarantined: List[Tuple[str, int]] = field(default_factory=list)   # (timeframe, timestamp)
    rate_limited: bool = False
    stopped: bool = False        # the loop ended early: network, 429, auth, other error or shutdown


def _send_rows(session: requests.Session, conn, rows: List[dict]) -> SendResult:
    """POST rows one by one, in the order given, stamping synced_at on 200/201.

    The behaviour push_batch always had, factored out so the priority rows and
    the backlog share one implementation: 400 -> quarantine AND stamp (a poison
    row must not block the outbox), 429 -> stop and flag, 401/403 or any other
    status or a network error -> stop, nothing stamped.
    """
    result = SendResult()
    for row in rows:
        if shutdown_requested:
            result.stopped = True
            break
        data = {k: v for k, v in row.items() if k != 'synced_at'}
        data['terminal_id'] = TERMINAL_ID
        result.attempted += 1

        try:
            resp = session.post(f'{API_GATEWAY_URL}/api/v1/market-data',
                                json=data, timeout=HTTP_TIMEOUT_SEC)
        except (requests.Timeout, requests.ConnectionError) as e:
            logger.error(f"❌ Network error: {e}")
            result.stopped = True
            break

        if resp.status_code in (200, 201):
            conn.execute("UPDATE market_data SET synced_at = ? WHERE timestamp = ? AND timeframe = ?",
                         (int(time.time()), row['timestamp'], row['timeframe']))
            result.pushed += 1
            if result.pushed % 50 == 0:
                conn.commit()
        elif resp.status_code == 429:
            retry_after = resp.headers.get('Retry-After')
            logger.warning(f"⚠️ Rate limited{f', Retry-After: {retry_after}s' if retry_after else ''}")
            result.rate_limited = True
            result.stopped = True
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
            result.quarantined.append((row['timeframe'], row['timestamp']))
        elif resp.status_code in (401, 403):
            logger.error("❌ CRITICAL: Authentication failed (check BACKFILL_API_KEY)")
            result.stopped = True
            break
        else:
            logger.error(f"❌ Gateway error: HTTP {resp.status_code}")
            result.stopped = True
            break

        time.sleep(INTER_ROW_DELAY_SEC)

    conn.commit()
    return result


def push_batch(session: requests.Session, conn, limit: Optional[int] = None) -> Tuple[int, int, bool]:
    """Push up to `limit` (default MAX_ROWS_PER_CYCLE) unsynced market_data rows,
    OLDEST first: the backlog drain. Returns (pushed, quarantined, rate_limited)."""
    limit = MAX_ROWS_PER_CYCLE if limit is None else limit
    rows = _fetch_dicts(
        conn, "SELECT * FROM market_data WHERE synced_at IS NULL "
              "ORDER BY timestamp ASC, timeframe ASC LIMIT ?", (limit,))
    result = _send_rows(session, conn, rows)
    return result.pushed, len(result.quarantined), result.rate_limited


# ---- the manifest ------------------------------------------------------------
def terminal_label(export_dir: Optional[str]) -> str:
    """The MT5 terminal an export directory belongs to: the folder that holds
    MQL5 (C:/MT5-A/MQL5/Files -> 'MT5-A'), else the whole directory. Only
    sameness matters (a change from the previous cycle is how a promote is
    noticed), so a layout this does not recognise still compares correctly."""
    if not export_dir:
        return 'unknown'
    normalised = str(export_dir).replace('\\', '/').rstrip('/')
    parts = [p for p in normalised.split('/') if p]
    for i, part in enumerate(parts):
        if part.upper() == 'MQL5' and i > 0:
            return parts[i - 1]
    return normalised


def _projection_mode(config_params) -> Optional[str]:
    """DYNAMIC or FROZEN from a statistics row's config JSON, else None (only the
    seven centroid indicators have a mode)."""
    try:
        mode = json.loads(config_params).get('Projection Mode')
    except (TypeError, ValueError, AttributeError):
        return None
    return mode.upper() if isinstance(mode, str) and mode.upper() in ('DYNAMIC', 'FROZEN') else None


def _note_quarantined(slot: int, quarantined: List[Tuple[str, int]]) -> None:
    for tf, _ts in quarantined:
        _priority_quarantined[(slot, tf)] = _priority_quarantined.get((slot, tf), 0) + 1
    for key in [k for k in _priority_quarantined if k[0] < slot - 86400]:
        del _priority_quarantined[key]


def m15_settled(conn, slot: int, now: int) -> bool:
    """Has the M15 half of this slot finished, one way or the other?

    M15 is collected only on :00 :15 :30 :45, right after M5, and may retry for
    up to about 200 s. The manifest for a refresh slot waits for it so it can say
    what M15 did, but not forever: after M15_SETTLE_SEC it goes without M15
    (absent means "did not refresh" and the gateway knows the slot).
    """
    if slot % TF_SECONDS['M15'] != 0:
        return True
    cycle = validated_cycle(conn, 'M15', slot)
    if cycle is not None and cycle['finished_at'] is not None:
        return True
    if cycle is None:
        last = conn.execute(
            "SELECT attempt, status FROM collection_cycles "
            "WHERE cycle_time = ? AND timeframe = 'M15' ORDER BY attempt DESC LIMIT 1",
            (slot,)).fetchone()
        if last is not None and last[1] == 'rejected' and last[0] >= COLLECTOR_MAX_ATTEMPTS:
            return True                                   # every attempt used: nothing more is coming
    return now >= slot + M15_SETTLE_SEC


def build_manifest(conn, slot: int, now: int) -> Optional[dict]:
    """The manifest for one slot, from what the collector recorded and what is in
    market_data and indicator_statistics. None if it cannot honestly be built
    (no finished M5 cycle, or the export file's modification time is unknown).

    Every value here is a fact read from the database, never a guess: an
    unknown export time is a reason to send no manifest, because a manifest is
    the instrument that measures the pipeline and a made-up time would lie to it.
    """
    timeframes: Dict[str, dict] = {}
    export_dir = None
    for tf in TIMEFRAME_ORDER:
        cycle = validated_cycle(conn, tf, slot)
        if cycle is None or cycle['finished_at'] is None:
            continue
        if cycle['export_mtime'] is None or cycle['newest_bar_ts'] is None:
            logger.error(f"❌ No {tf} section in the manifest for slot {slot}: cycle "
                         f"{cycle['cycle_id']} has no export time or newest bar recorded")
            continue
        window = priority_window(conn, tf, slot, cycle['newest_bar_ts'])
        if not window:
            continue
        first_started = conn.execute(
            "SELECT MIN(created_at) FROM collection_cycles WHERE cycle_time = ? AND timeframe = ?",
            (slot, tf)).fetchone()[0]
        stats = conn.execute(
            "SELECT source, config_hash, config_params FROM indicator_statistics "
            "WHERE captured_at = ? AND timeframe = ? ORDER BY source", (slot, tf)).fetchall()
        hashes: Dict[str, str] = {}
        modes: Dict[str, str] = {}
        for source, config_hash, config_params in stats:
            hashes[source] = config_hash
            mode = _projection_mode(config_params)
            if mode:
                modes[source] = mode
        timeframes[tf] = {
            'collection_cycle_id': cycle['cycle_id'],
            'attempts': cycle['attempt'],
            'started_at': first_started,
            'validated_at': cycle['validated_at'],
            'export_mtime': cycle['export_mtime'],
            'bar_count': len(window),
            'oldest_bar_ts': min(window),
            'newest_bar_ts': cycle['newest_bar_ts'],
            'quarantined_rows': _priority_quarantined.get((slot, tf), 0),
            'statistics_count': len(stats),
            'config_hashes': hashes,
            'source_modes': modes,
        }
        if tf == 'M5':
            export_dir = cycle['export_dir']
    if 'M5' not in timeframes:
        return None
    backlog_rows, repush_rows_unsent = unsent_counts(conn, slot)
    return {
        'schema': MANIFEST_SCHEMA,
        'symbol': SYMBOL,
        'slot': slot,
        'mt5_terminal': terminal_label(export_dir),
        'built_at': now,
        'backlog_rows': backlog_rows,
        # Of those, the historical rows (a promote's re-push). The gateway reads
        # 0 as "nothing left to re-push", then waits for one more verified
        # manifest before RETUNING ends (ADR-015, build step 2 part 9).
        'repush_rows_unsent': repush_rows_unsent,
        'timeframes': timeframes,
    }


def queue_manifest(conn, now: int) -> bool:
    """Build and store the manifest of the newest validated slot, once.

    Only when everything the manifest promises has happened: the collector has
    finished the slot (statistics staged), M15 has settled on a refresh slot, and
    EVERY priority row has been acknowledged or quarantined. Superseded slots
    get no manifest by design: the newest slot is the one that matters, and a
    hole is an honest signal that the worker fell behind. Returns True when a
    new manifest was stored.
    """
    slot = latest_validated_slot(conn)
    if slot is None or now - slot > MANIFEST_MAX_AGE_SEC:
        return False
    if conn.execute("SELECT 1 FROM cycle_manifests WHERE slot = ?", (slot,)).fetchone():
        return False
    m5 = validated_cycle(conn, 'M5', slot)
    if m5 is None or m5['finished_at'] is None or not m15_settled(conn, slot, now):
        return False
    if priority_rows(conn, slot):
        return False                       # the newest bars have not all been sent yet
    payload = build_manifest(conn, slot, now)
    if payload is None:
        return False
    conn.execute("INSERT OR IGNORE INTO cycle_manifests (slot, payload, created_at) VALUES (?, ?, ?)",
                 (slot, json.dumps(payload, sort_keys=True, separators=(',', ':')), now))
    conn.commit()
    sections = ', '.join(f"{tf} {t['bar_count']} bars" for tf, t in payload['timeframes'].items())
    logger.info(f"🧾 Manifest built for slot {slot} ({sections})")
    return True


def _manifest_failed(conn, slot: int, error: str) -> None:
    """Record a failed send. Never stamps synced_at: a manifest the gateway has
    not acknowledged must be sent again."""
    conn.execute("UPDATE cycle_manifests SET send_attempts = send_attempts + 1, last_error = ? "
                 "WHERE slot = ?", (error[:300], slot))
    conn.commit()
    logger.warning(f"⚠️ Manifest for slot {slot} not delivered ({error}) — will retry")


def send_manifests(session: requests.Session, conn, now: int) -> Tuple[int, str]:
    """Send unacknowledged manifests, newest slot first.

    Isolated like the statistics and events lanes: whatever happens here must
    not delay price rows. A gateway that does not have the endpoint yet answers
    404, and that is a retry, not a quarantine: only a 400 (a body the contract
    rejects, which resending cannot fix) is quarantined and stamped.

    Returns (acknowledged, status), status one of 'ok', 'retry', 'rate_limited'
    and 'auth'; the caller stops the cycle on the last two.
    """
    rows = conn.execute(
        "SELECT slot, payload FROM cycle_manifests WHERE synced_at IS NULL AND created_at >= ? "
        "ORDER BY slot DESC LIMIT ?", (now - MANIFEST_MAX_AGE_SEC, MANIFEST_MAX_PER_ITERATION)).fetchall()
    acknowledged = 0
    for slot, payload in rows:
        try:
            resp = session.post(f'{API_GATEWAY_URL}{MANIFEST_ENDPOINT}',
                                json=json.loads(payload), timeout=HTTP_TIMEOUT_SEC)
        except requests.RequestException as e:
            _manifest_failed(conn, slot, f"network error: {e}")
            return acknowledged, 'retry'

        if resp.status_code in (200, 201):
            conn.execute("UPDATE cycle_manifests SET synced_at = ? WHERE slot = ?", (int(time.time()), slot))
            conn.commit()
            acknowledged += 1
            logger.info(f"🧾 Manifest for slot {slot} acknowledged")
        elif resp.status_code == 400:
            try:
                with open(REJECTED_MANIFESTS_FILE, 'a', encoding='utf-8') as f:
                    f.write(json.dumps({'quarantined_at': datetime.now().isoformat(),
                                        'gateway_error': resp.text[:500],
                                        'row': json.loads(payload)}, default=str) + '\n')
            except OSError as e:
                logger.error(f"❌ Failed to quarantine rejected manifest: {e}")
            conn.execute("UPDATE cycle_manifests SET synced_at = ?, last_error = ? WHERE slot = ?",
                         (int(time.time()), 'rejected 400: ' + resp.text[:200], slot))
            conn.commit()
            logger.warning(f"⚠️ Gateway rejected the manifest for slot {slot} — quarantined")
        elif resp.status_code == 429:
            _manifest_failed(conn, slot, 'HTTP 429')
            return acknowledged, 'rate_limited'
        elif resp.status_code in (401, 403):
            _manifest_failed(conn, slot, f'HTTP {resp.status_code}')
            logger.error("❌ CRITICAL: Authentication failed (check BACKFILL_API_KEY)")
            return acknowledged, 'auth'
        else:
            _manifest_failed(conn, slot, f'HTTP {resp.status_code}')
            return acknowledged, 'retry'
    return acknowledged, 'ok'


def manifest_work_pending(conn, now: int) -> bool:
    """Is there a manifest still to build or to deliver? Keeps the main loop on
    its short cadence instead of the 5-minute idle sleep while one is due."""
    if not (cycle_facts_available(conn) and manifest_table_available(conn)):
        return False
    if conn.execute("SELECT 1 FROM cycle_manifests WHERE synced_at IS NULL AND created_at >= ? LIMIT 1",
                    (now - MANIFEST_MAX_AGE_SEC,)).fetchone():
        return True
    slot = latest_validated_slot(conn)
    return (slot is not None and now - slot <= MANIFEST_MAX_AGE_SEC and
            conn.execute("SELECT 1 FROM cycle_manifests WHERE slot = ?", (slot,)).fetchone() is None)


def push_cycle(session: requests.Session, conn, now: Optional[int] = None) -> Tuple[int, int, bool, int]:
    """One pass of the price lane, in this order (ADR-013, ADR-009):

      1. the newest slot's priority rows, newest first;
      2. only if all of them went through: statistics, then the slot's manifest
         is built and sent (a manifest never precedes the bars it describes);
      3. the backlog, oldest first, with what is left of MAX_ROWS_PER_CYCLE.

    A pass that stops early (network, rate limit, auth) pushes nothing behind the
    failure: no manifest, no backlog. A manifest the gateway cannot take (404,
    5xx) does NOT hold back the backlog: prices never wait for the manifest lane.

    Returns (rows pushed, rows quarantined, rate limited, manifests acknowledged).
    """
    now = int(time.time()) if now is None else now
    budget = MAX_ROWS_PER_CYCLE
    pushed = quarantined = manifests = 0
    rate_limited = False

    if cycle_facts_available(conn):
        slot = latest_validated_slot(conn)
        if slot is not None:
            result = _send_rows(session, conn, priority_rows(conn, slot)[:budget])
            _note_quarantined(slot, result.quarantined)
            pushed += result.pushed
            quarantined += len(result.quarantined)
            rate_limited = result.rate_limited
            budget -= result.attempted
            if result.stopped:
                return pushed, quarantined, rate_limited, manifests

            if manifest_table_available(conn):
                push_statistics(session, conn)             # best effort, never raises
                queue_manifest(conn, now)
                acknowledged, status = send_manifests(session, conn, now)
                manifests += acknowledged
                if status in ('rate_limited', 'auth'):
                    return pushed, quarantined, status == 'rate_limited', manifests

    if budget > 0:
        p, q, rl = push_batch(session, conn, limit=budget)
        pushed += p
        quarantined += q
        rate_limited = rate_limited or rl
    return pushed, quarantined, rate_limited, manifests


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
            # An empty price outbox is not an idle worker while a manifest is
            # still to build or deliver: stay on the short cadence for it.
            manifest_due = manifest_work_pending(conn, int(time.time()))

            if backlog == 0 and not manifest_due:
                logger.info("✅ Outbox empty — all market_data rows synced")
                # Statistics still drain on an idle cycle — they are low volume
                # and this is the least contended moment to send them.
                push_statistics(session, conn)
                while push_economic_events(session, conn) == EVENT_MAX_ROWS_PER_CYCLE:
                    if shutdown_requested:
                        break
                while push_symbol_specs(session, conn) == SPEC_MAX_ROWS_PER_CYCLE:
                    if shutdown_requested:
                        break
                conn.close()
                consecutive_failures = 0
                if iteration % HEALTH_CHECK_INTERVAL == 0:
                    check_api_health(session)
                _interruptible_sleep(IDLE_SLEEP_SEC)
                continue

            logger.info(f"📋 {backlog} unsynced rows — pushing (≤{MAX_ROWS_PER_CYCLE}/cycle)"
                        f"{' + manifest due' if manifest_due else ''}")
            # Newest bars of the latest cycle first, then its manifest, then the
            # backlog oldest-first (push_cycle).
            pushed, quarantined, rate_limited, manifests = push_cycle(session, conn)
            # Statistics go AFTER market_data every cycle: price data has
            # priority for the connection, and push_statistics() swallows its
            # own failures so it cannot influence the backoff decision below.
            push_statistics(session, conn)
            # Economic events last: price data first, telemetry second, calendar
            # third. Like push_statistics() it swallows its own failures, so it
            # cannot influence the backoff decision below either.
            while push_economic_events(session, conn) == EVENT_MAX_ROWS_PER_CYCLE:
                if shutdown_requested:
                    break
            # Symbol specs fourth (build step 2 part 8): prices, then telemetry,
            # then the calendar, then the broker's figures. It swallows its own
            # failures too, so it cannot influence the backoff decision below.
            while push_symbol_specs(session, conn) == SPEC_MAX_ROWS_PER_CYCLE:
                if shutdown_requested:
                    break
            conn.close()

            if pushed or quarantined or manifests:
                logger.info(f"✅ Pushed {pushed} rows"
                            f"{f', quarantined {quarantined}' if quarantined else ''}"
                            f"{f', {manifests} manifest(s)' if manifests else ''}")
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
