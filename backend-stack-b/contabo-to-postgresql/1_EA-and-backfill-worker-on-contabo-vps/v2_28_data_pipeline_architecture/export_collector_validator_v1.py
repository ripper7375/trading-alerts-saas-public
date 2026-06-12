#!/usr/bin/env python3
"""
Export Collector + Validator v1 — v5 collection pipeline (XAUUSD, M5/M15)

Pipeline stage implemented here:  COLLECT → ADJUST → VALIDATE → PROMOTE

Every collection cycle this worker:
  1. Gates on XAUUSD market hours (skipped with --no-market-hours / mock mode).
  2. Opens a row in collection_cycles (attempt = previous attempt + 1 after a
     rejection of the same cycle slot).
  3. Reads the 12 indicator export files ({Prefix}_{SYMBOL}_{TF}.txt) from the
     MT5 Files folder, converts empty fields to NULL, fills timestamp_adj
     (nearest 5-min / 15-min boundary), and stages rows into the raw_* tables.
  4. Validates across sources:
       a. Consistency — for every timestamp_adj shared by ≥2 per-bar sources,
          symbol and timeframe must be identical and the close spread must be
          within CLOSE_TOLERANCE (0.01 = one XAUUSD point).
       b. Zigzag subset — every pivot inside OHLCV coverage must match the
          OHLCV bar at the same timestamp_adj (close within tolerance).
       c. Completeness (strict mode) — the latest OHLCV bar must be present in
          all 11 per-bar sources; otherwise the cycle is rejected and a
          re-request (new attempt) is scheduled.
  5. On pass: promotes bars onto the OHLCV spine (LEFT-JOIN semantics — zigzag
     and any absent indicator values stay NULL) into market_data and marks the
     cycle 'validated'. On fail: logs validation_failures, purges the staged
     rows, marks the cycle 'rejected'.

Mock mode (development): point --export-dir at
mock-data-from-indicators/time_series_data and use --once. The mock files were
exported at different times, so strict completeness correctly rejects the
cycle; --no-completeness demonstrates the promote path on the overlap.

Production deployment: same VPS as MT5; EXPORT_DIR = the terminal's
MQL5/Files folder. The 12 indicators auto-export every minute at
InpExportSecond (default :59), so files are at most one minute old when the
5-minute collection tick fires.
"""

import argparse
import json
import logging
import sqlite3
import sys
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Tuple

# ============================================================
# CONFIGURATION
# ============================================================
SYMBOL = 'XAUUSD'
TIMEFRAMES = ['M5', 'M15']
TF_SECONDS = {'M5': 300, 'M15': 900}

CLOSE_TOLERANCE = 0.01        # one XAUUSD point; do not widen beyond ~0.05
MAX_ATTEMPTS_PER_CYCLE = 3    # re-requests before giving up on a cycle slot
RETRY_WAIT_SEC = 65           # wait for the next auto-export before re-reading
CYCLE_INTERVAL_SEC = 300      # collection cadence

DEFAULT_DB_PATH = 'C:/Scripts/database/xauusd.db'
DEFAULT_EXPORT_DIR = 'C:/MT5/MQL5/Files'   # set to the terminal's Files folder
SCHEMA_FILE = Path(__file__).with_name('sqlite_schema_v5_xauusd.sql')

# ============================================================
# SOURCE REGISTRY — file prefix, staging table, column mapping
# ============================================================
# Every export starts with the 4 validation keys:
#   timestamp(raw) , symbol , timeframe , close
# 'columns' lists the source-specific columns AFTER the 4 keys, in file order,
# as (sqlite_column, type) where type is 'real', 'int' or 'text'.

CENTROID_COLUMNS = [
    ('base_fl', 'real'), ('uoedt', 'real'), ('loedt', 'real'),
    ('horiz_high_map', 'real'), ('horiz_low_map', 'real'),
    ('ssa', 'real'), ('ema_ssa', 'real'), ('crossing', 'int'),
]

SOURCES = {
    'best_fit':    {'prefix': 'Centriod_Best_Fit', 'table': 'raw_best_fit',    'columns': CENTROID_COLUMNS},
    'cherry_a':    {'prefix': 'Cherry-Pick-A',     'table': 'raw_cherry_a',    'columns': CENTROID_COLUMNS},
    'cherry_b':    {'prefix': 'Cherry-Pick-B',     'table': 'raw_cherry_b',    'columns': CENTROID_COLUMNS},
    'most_recent': {'prefix': 'Most-Recent',       'table': 'raw_most_recent', 'columns': CENTROID_COLUMNS},
    'non_a':       {'prefix': 'Non-Recent-A',      'table': 'raw_non_a',       'columns': CENTROID_COLUMNS},
    'non_b':       {'prefix': 'Non-Recent-B',      'table': 'raw_non_b',       'columns': CENTROID_COLUMNS},
    'fractal_edt': {'prefix': 'Fractal_EDT',       'table': 'raw_fractal_edt',
                    'columns': [('best_fl', 'real'), ('uoedt', 'real'), ('loedt', 'real')]},
    'ohlcv':       {'prefix': 'OHLCV',             'table': 'raw_ohlcv',
                    'columns': [('open', 'real'), ('high', 'real'), ('low', 'real'), ('volume', 'int')]},
    'resistance':  {'prefix': 'Resistance_Line',   'table': 'raw_resistance',
                    'columns': [('best_resistance', 'real')]},
    'support':     {'prefix': 'Support_Line',      'table': 'raw_support',
                    'columns': [('best_support', 'real')]},
    'zscore':      {'prefix': 'ZScore',            'table': 'raw_zscore',
                    'columns': [('open', 'real'), ('high', 'real'), ('low', 'real'),
                                ('body_direction', 'int'), ('body_size', 'real'),
                                ('body_classification', 'int')]},
    'zigzag':      {'prefix': 'ZigZag',            'table': 'raw_zigzag',
                    'columns': [('point_type', 'text'), ('current_point', 'real'),
                                ('price_change', 'real'), ('pct_change', 'real'),
                                ('pct_change_class', 'int'), ('bars', 'int'),
                                ('bars_class', 'int'), ('price_per_bar', 'real'),
                                ('price_per_bar_class', 'int'), ('slope', 'real'),
                                ('category', 'text')]},
}

# Per-bar sources participate in consistency + completeness checks.
# zigzag rows are pivot events and get the subset rule instead.
PER_BAR_SOURCES = [s for s in SOURCES if s != 'zigzag']

# market_data columns fed by each source (source_column → market_data_column)
PROMOTE_MAP = {
    'ohlcv':       {'open': 'open', 'high': 'high', 'low': 'low', 'close': 'close', 'volume': 'volume'},
    'best_fit':    {'base_fl': 'best_fit_base_fl', 'uoedt': 'best_fit_uoedt', 'loedt': 'best_fit_loedt',
                    'horiz_high_map': 'best_fit_horiz_high_map', 'horiz_low_map': 'best_fit_horiz_low_map',
                    'ssa': 'best_fit_ssa', 'ema_ssa': 'best_fit_ema_ssa', 'crossing': 'best_fit_crossing'},
    'cherry_a':    {'base_fl': 'cherry_a_base_fl', 'uoedt': 'cherry_a_uoedt', 'loedt': 'cherry_a_loedt',
                    'horiz_high_map': 'cherry_a_horiz_high_map', 'horiz_low_map': 'cherry_a_horiz_low_map',
                    'ssa': 'cherry_a_ssa', 'ema_ssa': 'cherry_a_ema_ssa', 'crossing': 'cherry_a_crossing'},
    'cherry_b':    {'base_fl': 'cherry_b_base_fl', 'uoedt': 'cherry_b_uoedt', 'loedt': 'cherry_b_loedt',
                    'horiz_high_map': 'cherry_b_horiz_high_map', 'horiz_low_map': 'cherry_b_horiz_low_map',
                    'ssa': 'cherry_b_ssa', 'ema_ssa': 'cherry_b_ema_ssa', 'crossing': 'cherry_b_crossing'},
    'most_recent': {'base_fl': 'most_recent_base_fl', 'uoedt': 'most_recent_uoedt', 'loedt': 'most_recent_loedt',
                    'horiz_high_map': 'most_recent_horiz_high_map', 'horiz_low_map': 'most_recent_horiz_low_map',
                    'ssa': 'most_recent_ssa', 'ema_ssa': 'most_recent_ema_ssa', 'crossing': 'most_recent_crossing'},
    'non_a':       {'base_fl': 'non_a_base_fl', 'uoedt': 'non_a_uoedt', 'loedt': 'non_a_loedt',
                    'horiz_high_map': 'non_a_horiz_high_map', 'horiz_low_map': 'non_a_horiz_low_map',
                    'ssa': 'non_a_ssa', 'ema_ssa': 'non_a_ema_ssa', 'crossing': 'non_a_crossing'},
    'non_b':       {'base_fl': 'non_b_base_fl', 'uoedt': 'non_b_uoedt', 'loedt': 'non_b_loedt',
                    'horiz_high_map': 'non_b_horiz_high_map', 'horiz_low_map': 'non_b_horiz_low_map',
                    'ssa': 'non_b_ssa', 'ema_ssa': 'non_b_ema_ssa', 'crossing': 'non_b_crossing'},
    'fractal_edt': {'best_fl': 'fractal_best_fl', 'uoedt': 'fractal_uoedt', 'loedt': 'fractal_loedt'},
    'resistance':  {'best_resistance': 'best_resistance'},
    'support':     {'best_support': 'best_support'},
    'zscore':      {'body_direction': 'body_direction', 'body_size': 'body_size',
                    'body_classification': 'body_classification'},
    'zigzag':      {'point_type': 'zigzag_point_type', 'current_point': 'zigzag_current_point',
                    'price_change': 'zigzag_price_change', 'pct_change': 'zigzag_pct_change',
                    'pct_change_class': 'zigzag_pct_change_class', 'bars': 'zigzag_bars',
                    'bars_class': 'zigzag_bars_class', 'price_per_bar': 'zigzag_price_per_bar',
                    'price_per_bar_class': 'zigzag_price_per_bar_class', 'slope': 'zigzag_slope',
                    'category': 'zigzag_category'},
}

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger('export_collector')


# ============================================================
# MARKET HOURS (Python port of lib/market-hours for XAUUSD)
# XAUUSD: Mon-Fri 01:01-23:59 SERVER time (GMT+2 winter / GMT+3 US-DST)
# ============================================================
def _nth_sunday_utc(year: int, month: int, nth: int) -> datetime:
    d = datetime(year, month, 1, tzinfo=timezone.utc)
    days_until_sunday = (6 - d.weekday()) % 7
    return d + timedelta(days=days_until_sunday + 7 * (nth - 1))


def is_dst_active(dt_utc: datetime) -> bool:
    """US DST: second Sunday of March 2:00 → first Sunday of November 2:00."""
    start = _nth_sunday_utc(dt_utc.year, 3, 2)
    end = _nth_sunday_utc(dt_utc.year, 11, 1)
    return start <= dt_utc < end


def server_utc_offset(dt_utc: datetime) -> int:
    return 3 if is_dst_active(dt_utc) else 2


def is_market_open_xauusd(ts_utc: Optional[int] = None) -> bool:
    dt_utc = datetime.fromtimestamp(ts_utc, tz=timezone.utc) if ts_utc \
        else datetime.now(timezone.utc)
    server = dt_utc + timedelta(hours=server_utc_offset(dt_utc))
    if server.weekday() > 4:  # Sat=5, Sun=6 in server time
        return False
    minutes = server.hour * 60 + server.minute
    return (1 * 60 + 1) <= minutes < (23 * 60 + 59)


# ============================================================
# FILE PARSING
# ============================================================
def parse_export_file(path: Path, spec: dict, timeframe: str) -> List[dict]:
    """Parse one TSV export into staged-row dicts. Empty fields become None."""
    rows = []
    with open(path, encoding='utf-8') as f:
        header = f.readline()
        if not header.strip():
            return rows
        expected = 4 + len(spec['columns'])
        tf_sec = TF_SECONDS[timeframe]

        for lineno, line in enumerate(f, start=2):
            line = line.rstrip('\n').rstrip('\r')
            if not line.strip():
                continue
            parts = line.split('\t')
            if len(parts) < expected:
                parts += [''] * (expected - len(parts))

            try:
                ts_raw = int(parts[0])
                row = {
                    'timestamp_raw': ts_raw,
                    'timestamp_adj': round(ts_raw / tf_sec) * tf_sec,
                    'symbol': parts[1].strip(),
                    'timeframe': parts[2].strip(),
                    'close': float(parts[3]),
                }
            except (ValueError, IndexError) as e:
                logger.warning(f"{path.name}:{lineno}: unparseable key columns ({e}) — row skipped")
                continue

            for idx, (col, typ) in enumerate(spec['columns'], start=4):
                v = parts[idx].strip()
                if v == '':
                    row[col] = None        # "no line/value exists" — never 0
                elif typ == 'real':
                    row[col] = float(v)
                elif typ == 'int':
                    row[col] = int(float(v))
                else:
                    row[col] = v
            rows.append(row)
    return rows


# ============================================================
# DATABASE
# ============================================================
def open_db(db_path: str) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    # Apply schema (idempotent — CREATE IF NOT EXISTS throughout)
    conn.executescript(SCHEMA_FILE.read_text())
    return conn


def open_cycle(conn: sqlite3.Connection, cycle_time: int, timeframe: str) -> Tuple[int, int]:
    cur = conn.execute(
        "SELECT COALESCE(MAX(attempt), 0) FROM collection_cycles "
        "WHERE cycle_time = ? AND timeframe = ?", (cycle_time, timeframe))
    attempt = cur.fetchone()[0] + 1
    cur = conn.execute(
        "INSERT INTO collection_cycles (cycle_time, timeframe, attempt, status, created_at) "
        "VALUES (?, ?, ?, 'collecting', ?)",
        (cycle_time, timeframe, attempt, int(time.time())))
    conn.commit()
    return cur.lastrowid, attempt


def stage_source(conn: sqlite3.Connection, cycle_id: int, source: str,
                 rows: List[dict]) -> int:
    spec = SOURCES[source]
    cols = ['cycle_id', 'timestamp_raw', 'timestamp_adj', 'symbol', 'timeframe', 'close'] \
        + [c for c, _ in spec['columns']]
    sql = (f"INSERT OR REPLACE INTO {spec['table']} ({', '.join(cols)}) "
           f"VALUES ({', '.join('?' * len(cols))})")
    staged = 0
    for row in rows:
        conn.execute(sql, [cycle_id] + [row.get(c) for c in cols[1:]])
        staged += 1
    return staged


def purge_cycle_rows(conn: sqlite3.Connection, cycle_id: int) -> None:
    """Rejected cycles keep their audit row; staged data is removed."""
    for spec in SOURCES.values():
        conn.execute(f"DELETE FROM {spec['table']} WHERE cycle_id = ?", (cycle_id,))


def set_cycle_status(conn: sqlite3.Connection, cycle_id: int, status: str,
                     sources_received: int, reason: Optional[str] = None) -> None:
    conn.execute(
        "UPDATE collection_cycles SET status = ?, sources_received = ?, "
        "rejected_reason = ?, validated_at = ? WHERE cycle_id = ?",
        (status, sources_received, reason,
         int(time.time()) if status == 'validated' else None, cycle_id))
    conn.commit()


def log_failure(conn: sqlite3.Connection, cycle_id: int, field: str, detail: dict) -> None:
    conn.execute(
        "INSERT INTO validation_failures (cycle_id, field, detail, created_at) "
        "VALUES (?, ?, ?, ?)",
        (cycle_id, field, json.dumps(detail), int(time.time())))


# ============================================================
# VALIDATION
# ============================================================
def load_keys(conn: sqlite3.Connection, cycle_id: int, source: str) -> Dict[int, dict]:
    """timestamp_adj → validation keys for one staged source."""
    spec = SOURCES[source]
    cur = conn.execute(
        f"SELECT timestamp_adj, symbol, timeframe, close FROM {spec['table']} "
        f"WHERE cycle_id = ?", (cycle_id,))
    return {r[0]: {'symbol': r[1], 'timeframe': r[2], 'close': r[3]} for r in cur}


def validate_cycle(conn: sqlite3.Connection, cycle_id: int, timeframe: str,
                   check_completeness: bool = True) -> Tuple[bool, List[str]]:
    """Cross-source validation. Returns (passed, reasons)."""
    reasons: List[str] = []
    keys = {s: load_keys(conn, cycle_id, s) for s in SOURCES}

    # --- a) Consistency on overlapping bars (per-bar sources) ---
    all_ts = set()
    for s in PER_BAR_SOURCES:
        all_ts |= keys[s].keys()

    for ts in sorted(all_ts):
        present = {s: keys[s][ts] for s in PER_BAR_SOURCES if ts in keys[s]}
        if len(present) < 2:
            continue
        symbols = {v['symbol'] for v in present.values()}
        tfs = {v['timeframe'] for v in present.values()}
        closes = [v['close'] for v in present.values()]

        if len(symbols) > 1:
            log_failure(conn, cycle_id, 'symbol',
                        {'timestamp_adj': ts, 'values': {s: v['symbol'] for s, v in present.items()}})
            reasons.append(f"symbol mismatch at {ts}")
        if len(tfs) > 1:
            log_failure(conn, cycle_id, 'timeframe',
                        {'timestamp_adj': ts, 'values': {s: v['timeframe'] for s, v in present.items()}})
            reasons.append(f"timeframe mismatch at {ts}")
        if max(closes) - min(closes) > CLOSE_TOLERANCE:
            log_failure(conn, cycle_id, 'close',
                        {'timestamp_adj': ts, 'tolerance': CLOSE_TOLERANCE,
                         'values': {s: v['close'] for s, v in present.items()}})
            reasons.append(f"close spread {max(closes) - min(closes):.5f} > {CLOSE_TOLERANCE} at {ts}")

    # --- b) Zigzag subset rule (pivots inside OHLCV coverage must match) ---
    ohlcv = keys['ohlcv']
    if ohlcv and keys['zigzag']:
        ohlcv_min = min(ohlcv.keys())
        for ts, zz in keys['zigzag'].items():
            if ts < ohlcv_min:
                continue  # pivot predates OHLCV export depth — legitimately absent
            if ts not in ohlcv:
                log_failure(conn, cycle_id, 'timestamp',
                            {'source': 'zigzag', 'timestamp_adj': ts,
                             'error': 'pivot bar missing from OHLCV spine'})
                reasons.append(f"zigzag pivot at {ts} has no OHLCV bar")
            elif abs(zz['close'] - ohlcv[ts]['close']) > CLOSE_TOLERANCE:
                log_failure(conn, cycle_id, 'close',
                            {'source': 'zigzag', 'timestamp_adj': ts,
                             'zigzag_close': zz['close'], 'ohlcv_close': ohlcv[ts]['close']})
                reasons.append(f"zigzag close mismatch at {ts}")

    # --- c) Completeness: latest OHLCV bar present in all per-bar sources ---
    if check_completeness:
        missing_sources = [s for s in PER_BAR_SOURCES if not keys[s]]
        if missing_sources:
            reasons.append(f"no staged rows from: {', '.join(missing_sources)}")
        elif ohlcv:
            latest = max(ohlcv.keys())
            stale = [s for s in PER_BAR_SOURCES if latest not in keys[s]]
            if stale:
                log_failure(conn, cycle_id, 'timestamp',
                            {'latest_bar': latest, 'missing_in': stale,
                             'error': 'sources exported different latest bars (stale export)'})
                reasons.append(f"latest bar {latest} missing in: {', '.join(stale)}")

    conn.commit()
    return (len(reasons) == 0), reasons


# ============================================================
# PROMOTION
# ============================================================
def promote_cycle(conn: sqlite3.Connection, cycle_id: int, timeframe: str) -> int:
    """Merge validated staged rows into market_data on the OHLCV spine."""
    # Pull every source's rows keyed by timestamp_adj
    staged: Dict[str, Dict[int, dict]] = {}
    for source, spec in SOURCES.items():
        cols = ['timestamp_adj', 'symbol', 'timeframe', 'close'] + [c for c, _ in spec['columns']]
        cur = conn.execute(
            f"SELECT {', '.join(cols)} FROM {spec['table']} WHERE cycle_id = ?", (cycle_id,))
        staged[source] = {row[0]: dict(zip(cols, row)) for row in cur}

    spine = staged['ohlcv']
    if not spine:
        return 0

    promoted = 0
    now = int(time.time())
    for ts in sorted(spine.keys()):
        record = {'timestamp': ts, 'symbol': SYMBOL, 'timeframe': timeframe,
                  'cycle_id': cycle_id, 'collected_at': now}
        for source, mapping in PROMOTE_MAP.items():
            src_row = staged[source].get(ts)
            for src_col, md_col in mapping.items():
                record[md_col] = src_row.get(src_col) if src_row else None

        cols = list(record.keys())
        conn.execute(
            f"INSERT OR REPLACE INTO market_data ({', '.join(cols)}) "
            f"VALUES ({', '.join('?' * len(cols))})",
            [record[c] for c in cols])
        promoted += 1

    conn.commit()
    return promoted


# ============================================================
# COLLECTION CYCLE
# ============================================================
def run_cycle(conn: sqlite3.Connection, export_dir: Path, timeframe: str,
              cycle_time: int, check_completeness: bool = True) -> bool:
    """One collect→validate→promote pass. Returns True if validated."""
    cycle_id, attempt = open_cycle(conn, cycle_time, timeframe)
    logger.info(f"📥 Cycle {cycle_id} ({timeframe}, slot {cycle_time}, attempt {attempt}): collecting")

    sources_received = 0
    missing_files = []
    for source, spec in SOURCES.items():
        path = export_dir / f"{spec['prefix']}_{SYMBOL}_{timeframe}.txt"
        if not path.exists():
            missing_files.append(path.name)
            continue
        rows = parse_export_file(path, spec, timeframe)
        staged = stage_source(conn, cycle_id, source, rows)
        sources_received += 1
        logger.info(f"   {source:<12} {staged:>5} rows staged from {path.name}")
    conn.commit()

    if missing_files:
        reason = f"missing export files: {', '.join(missing_files)}"
        logger.error(f"❌ Cycle {cycle_id} rejected — {reason}")
        purge_cycle_rows(conn, cycle_id)
        set_cycle_status(conn, cycle_id, 'rejected', sources_received, reason)
        return False

    conn.execute("UPDATE collection_cycles SET status = 'validating' WHERE cycle_id = ?", (cycle_id,))
    passed, reasons = validate_cycle(conn, cycle_id, timeframe, check_completeness)

    if not passed:
        reason = '; '.join(reasons[:5]) + (f" (+{len(reasons) - 5} more)" if len(reasons) > 5 else '')
        logger.error(f"❌ Cycle {cycle_id} rejected — {reason}")
        purge_cycle_rows(conn, cycle_id)
        set_cycle_status(conn, cycle_id, 'rejected', sources_received, reason)
        return False

    promoted = promote_cycle(conn, cycle_id, timeframe)
    set_cycle_status(conn, cycle_id, 'validated', sources_received)
    logger.info(f"✅ Cycle {cycle_id} validated — {promoted} bars promoted to market_data")
    return True


def run_cycle_with_retries(conn, export_dir, timeframe, cycle_time,
                           check_completeness=True, market_hours=True) -> bool:
    """Reject → wait for the next auto-export → re-request, bounded."""
    for attempt in range(1, MAX_ATTEMPTS_PER_CYCLE + 1):
        if market_hours and not is_market_open_xauusd():
            # Market closed is NOT a validation failure — do not burn attempts
            logger.info(f"💤 Market closed — skipping {timeframe} slot {cycle_time}")
            return False
        if run_cycle(conn, export_dir, timeframe, cycle_time, check_completeness):
            return True
        if attempt < MAX_ATTEMPTS_PER_CYCLE:
            logger.info(f"🔁 Re-requesting in {RETRY_WAIT_SEC}s (attempt {attempt + 1}/{MAX_ATTEMPTS_PER_CYCLE})")
            time.sleep(RETRY_WAIT_SEC)
    logger.error(f"⛔ Cycle slot {cycle_time} ({timeframe}) gave up after {MAX_ATTEMPTS_PER_CYCLE} attempts")
    return False


# ============================================================
# MAIN
# ============================================================
def main():
    ap = argparse.ArgumentParser(description='v5 export collector + validator (XAUUSD)')
    ap.add_argument('--export-dir', default=DEFAULT_EXPORT_DIR,
                    help='Folder containing the 12 indicator export .txt files')
    ap.add_argument('--db', default=DEFAULT_DB_PATH, help='SQLite database path (xauusd.db)')
    ap.add_argument('--timeframes', default='M5,M15', help='Comma-separated subset of M5,M15')
    ap.add_argument('--once', action='store_true', help='Run a single cycle then exit (mock/testing)')
    ap.add_argument('--no-completeness', action='store_true',
                    help='Skip the latest-bar completeness check (mock data only)')
    ap.add_argument('--no-market-hours', action='store_true',
                    help='Skip the market-hours gate (mock/testing)')
    args = ap.parse_args()

    export_dir = Path(args.export_dir)
    timeframes = [tf.strip().upper() for tf in args.timeframes.split(',') if tf.strip()]
    for tf in timeframes:
        if tf not in TF_SECONDS:
            ap.error(f"unsupported timeframe {tf} (only M5/M15)")

    conn = open_db(args.db)
    logger.info(f"🚀 Export collector started — db={args.db} exports={export_dir} tfs={timeframes}")

    if args.once:
        cycle_time = int(time.time()) // CYCLE_INTERVAL_SEC * CYCLE_INTERVAL_SEC
        ok = all(run_cycle_with_retries(
            conn, export_dir, tf, cycle_time,
            check_completeness=not args.no_completeness,
            market_hours=not args.no_market_hours) for tf in timeframes)
        conn.close()
        sys.exit(0 if ok else 1)

    # Continuous mode: fire shortly after each 5-minute boundary
    # (indicators auto-export at second :59, so :05 of the next slot is safe)
    while True:
        now = time.time()
        next_slot = (int(now) // CYCLE_INTERVAL_SEC + 1) * CYCLE_INTERVAL_SEC
        time.sleep(max(0.0, next_slot + 5 - now))

        for tf in timeframes:
            if tf == 'M15' and next_slot % 900 != 0:
                continue  # M15 only has a new bar every third 5-min slot
            run_cycle_with_retries(
                conn, export_dir, tf, next_slot,
                check_completeness=not args.no_completeness,
                market_hours=not args.no_market_hours)


if __name__ == '__main__':
    main()
