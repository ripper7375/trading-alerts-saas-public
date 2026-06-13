#!/usr/bin/env python3
"""
Export Collector + Validator v2 — v6 collection pipeline (XAUUSD, M5/M15)

Pipeline stages implemented here:
  COLLECT -> ADJUST -> VALIDATE -> CALCULATE -> PROMOTE

v2 changes (from v1 / schema v5):
- CALCULATE stage: the Python calc stack (backend-stack-c/2_python-calc-stack:
  zscore_candle.py, zigzag_metrics.py, fractal_lines.py, centroid_regression.py)
  computes all user-configurable derived values that MQL5 used to export
  (candle z-score set, zigzag segment metrics, fractal/resistance/support
  lines, the six centroid-variant baselines + EDTs). market_data gets the
  default-parameter results; user-parameterized variants are served on demand
  by the same modules.
- Staging is admin-layer only (schema v6): keys + OHLCV + centroid maps/ssa/
  ema_ssa/crossing + zigzag pivots.
- HEADER-NAME-BASED PARSING: columns are located by header name, not position,
  so the collector accepts BOTH the current full MQL5 exports (kept during the
  golden-parity period) and the future reduced exports.

Unchanged from v1: cycle states (collecting -> validating -> validated |
rejected), key validation (timestamp_adj / symbol / timeframe / close with
CLOSE_TOLERANCE), zigzag subset rule, market-hours gate (XAUUSD server hours
with US-DST conversion to UTC), bounded reject -> re-request.

Mock mode:
  python3 export_collector_validator_v2.py \
      --export-dir ../../mock-data-from-indicators/time_series_data \
      --db /tmp/test.db --timeframes M5 --once --no-market-hours --no-completeness
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

# --- Python calc stack (CALCULATE stage) ---
CALC_STACK_DIR = Path(__file__).resolve().parents[1] / '2_python-calc-stack'
sys.path.insert(0, str(CALC_STACK_DIR))
from zscore_candle import calculate as zscore_calculate                      # noqa: E402
from zigzag_metrics import ZigZagPivot, segment_metrics                      # noqa: E402
from fractal_lines import (FractalLinesParams, single_best_resistance,       # noqa: E402
                           single_best_support, flip_line_with_edts)
from centroid_regression import calculate_variant                            # noqa: E402

# ============================================================
# CONFIGURATION
# ============================================================
SYMBOL = 'XAUUSD'
TIMEFRAMES = ['M5', 'M15']
TF_SECONDS = {'M5': 300, 'M15': 900}

CLOSE_TOLERANCE = 0.01        # one XAUUSD point; do not widen beyond ~0.05
MAX_ATTEMPTS_PER_CYCLE = 3
RETRY_WAIT_SEC = 65
CYCLE_INTERVAL_SEC = 300

DEFAULT_DB_PATH = 'C:/Scripts/database/xauusd.db'
DEFAULT_EXPORT_DIR = 'C:/MT5/MQL5/Files'
SCHEMA_FILE = Path(__file__).with_name('sqlite_schema_v6_xauusd.sql')

CENTROID_VARIANTS = ['best_fit', 'cherry_a', 'cherry_b', 'most_recent', 'non_a', 'non_b']

# ============================================================
# SOURCE REGISTRY — v6 (admin-layer columns, located by header name)
# ============================================================
# 'columns': (sqlite/staging column, type, exact export header name)
def _centroid_columns(prefix: str):
    return [('horiz_high_map', 'real', f'{prefix}_horiz_high_map'),
            ('horiz_low_map', 'real', f'{prefix}_horiz_low_map'),
            ('ssa', 'real', f'{prefix}_ssa'),
            ('ema_ssa', 'real', f'{prefix}_ema_ssa'),
            ('crossing', 'int', f'{prefix}_crossing')]


SOURCES = {
    'best_fit':    {'prefix': 'Centriod_Best_Fit', 'table': 'raw_best_fit',
                    'columns': _centroid_columns('Best_Fit')},
    'cherry_a':    {'prefix': 'Cherry-Pick-A', 'table': 'raw_cherry_a',
                    'columns': _centroid_columns('Cherry_A')},
    'cherry_b':    {'prefix': 'Cherry-Pick-B', 'table': 'raw_cherry_b',
                    'columns': _centroid_columns('Cherry_B')},
    'most_recent': {'prefix': 'Most-Recent', 'table': 'raw_most_recent',
                    'columns': _centroid_columns('Most_Recent')},
    'non_a':       {'prefix': 'Non-Recent-A', 'table': 'raw_non_a',
                    'columns': _centroid_columns('Non_A')},
    'non_b':       {'prefix': 'Non-Recent-B', 'table': 'raw_non_b',
                    'columns': _centroid_columns('Non_B')},
    'fractal_edt': {'prefix': 'Fractal_EDT', 'table': 'raw_fractal_edt', 'columns': []},
    'ohlcv':       {'prefix': 'OHLCV', 'table': 'raw_ohlcv',
                    'columns': [('open', 'real', 'ohlcv_open'), ('high', 'real', 'ohlcv_high'),
                                ('low', 'real', 'ohlcv_low'), ('volume', 'int', 'ohlcv_volume')]},
    'resistance':  {'prefix': 'Resistance_Line', 'table': 'raw_resistance', 'columns': []},
    'support':     {'prefix': 'Support_Line', 'table': 'raw_support', 'columns': []},
    'zscore':      {'prefix': 'ZScore', 'table': 'raw_zscore', 'columns': []},
    'zigzag':      {'prefix': 'ZigZag', 'table': 'raw_zigzag',
                    'columns': [('point_type', 'text', 'zigzag_Type'),
                                ('current_point', 'real', 'CurrentPoint')]},
}

PER_BAR_SOURCES = [s for s in SOURCES if s != 'zigzag']

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger('export_collector')


# ============================================================
# MARKET HOURS (XAUUSD: Mon-Fri 01:01-23:59 server, GMT+2/+3 US-DST)
# ============================================================
def _nth_sunday_utc(year: int, month: int, nth: int) -> datetime:
    d = datetime(year, month, 1, tzinfo=timezone.utc)
    return d + timedelta(days=(6 - d.weekday()) % 7 + 7 * (nth - 1))


def is_dst_active(dt_utc: datetime) -> bool:
    return _nth_sunday_utc(dt_utc.year, 3, 2) <= dt_utc < _nth_sunday_utc(dt_utc.year, 11, 1)


def is_market_open_xauusd(ts_utc: Optional[int] = None) -> bool:
    dt_utc = datetime.fromtimestamp(ts_utc, tz=timezone.utc) if ts_utc \
        else datetime.now(timezone.utc)
    server = dt_utc + timedelta(hours=3 if is_dst_active(dt_utc) else 2)
    if server.weekday() > 4:
        return False
    minutes = server.hour * 60 + server.minute
    return 61 <= minutes < 23 * 60 + 59


# ============================================================
# FILE PARSING (header-name based)
# ============================================================
def parse_export_file(path: Path, spec: dict, timeframe: str) -> List[dict]:
    """Locate columns by header name; keys are positional (always cols 0-3).
    Empty fields become None. Tolerates extra (full-export) columns."""
    rows: List[dict] = []
    with open(path, encoding='utf-8') as f:
        header_line = f.readline().rstrip('\n').rstrip('\r')
        if not header_line.strip():
            return rows
        headers = header_line.split('\t')
        col_idx = {}
        for col, typ, hname in spec['columns']:
            try:
                col_idx[col] = (headers.index(hname), typ)
            except ValueError:
                col_idx[col] = (None, typ)   # absent in this export -> NULL

        tf_sec = TF_SECONDS[timeframe]
        for lineno, line in enumerate(f, start=2):
            line = line.rstrip('\n').rstrip('\r')
            if not line.strip():
                continue
            parts = line.split('\t')
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
            for col, (idx, typ) in col_idx.items():
                v = parts[idx].strip() if idx is not None and idx < len(parts) else ''
                if v == '':
                    row[col] = None
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
    conn.executescript(SCHEMA_FILE.read_text())
    return conn


def open_cycle(conn, cycle_time: int, timeframe: str) -> Tuple[int, int]:
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


def stage_source(conn, cycle_id: int, source: str, rows: List[dict]) -> int:
    spec = SOURCES[source]
    cols = ['cycle_id', 'timestamp_raw', 'timestamp_adj', 'symbol', 'timeframe', 'close'] \
        + [c for c, _, _ in spec['columns']]
    sql = (f"INSERT OR REPLACE INTO {spec['table']} ({', '.join(cols)}) "
           f"VALUES ({', '.join('?' * len(cols))})")
    for row in rows:
        conn.execute(sql, [cycle_id] + [row.get(c) for c in cols[1:]])
    return len(rows)


def purge_cycle_rows(conn, cycle_id: int) -> None:
    for spec in SOURCES.values():
        conn.execute(f"DELETE FROM {spec['table']} WHERE cycle_id = ?", (cycle_id,))


def set_cycle_status(conn, cycle_id, status, sources_received, reason=None) -> None:
    conn.execute(
        "UPDATE collection_cycles SET status = ?, sources_received = ?, "
        "rejected_reason = ?, validated_at = ? WHERE cycle_id = ?",
        (status, sources_received, reason,
         int(time.time()) if status == 'validated' else None, cycle_id))
    conn.commit()


def log_failure(conn, cycle_id, field, detail) -> None:
    conn.execute(
        "INSERT INTO validation_failures (cycle_id, field, detail, created_at) "
        "VALUES (?, ?, ?, ?)", (cycle_id, field, json.dumps(detail), int(time.time())))


# ============================================================
# VALIDATION (unchanged rules from v1)
# ============================================================
def load_keys(conn, cycle_id, source) -> Dict[int, dict]:
    cur = conn.execute(
        f"SELECT timestamp_adj, symbol, timeframe, close FROM {SOURCES[source]['table']} "
        f"WHERE cycle_id = ?", (cycle_id,))
    return {r[0]: {'symbol': r[1], 'timeframe': r[2], 'close': r[3]} for r in cur}


def validate_cycle(conn, cycle_id, timeframe, check_completeness=True) -> Tuple[bool, List[str]]:
    reasons: List[str] = []
    keys = {s: load_keys(conn, cycle_id, s) for s in SOURCES}

    all_ts = set()
    for s in PER_BAR_SOURCES:
        all_ts |= keys[s].keys()

    for ts in sorted(all_ts):
        present = {s: keys[s][ts] for s in PER_BAR_SOURCES if ts in keys[s]}
        if len(present) < 2:
            continue
        if len({v['symbol'] for v in present.values()}) > 1:
            log_failure(conn, cycle_id, 'symbol',
                        {'timestamp_adj': ts, 'values': {s: v['symbol'] for s, v in present.items()}})
            reasons.append(f"symbol mismatch at {ts}")
        if len({v['timeframe'] for v in present.values()}) > 1:
            log_failure(conn, cycle_id, 'timeframe',
                        {'timestamp_adj': ts, 'values': {s: v['timeframe'] for s, v in present.items()}})
            reasons.append(f"timeframe mismatch at {ts}")
        closes = [v['close'] for v in present.values()]
        if max(closes) - min(closes) > CLOSE_TOLERANCE:
            log_failure(conn, cycle_id, 'close',
                        {'timestamp_adj': ts, 'tolerance': CLOSE_TOLERANCE,
                         'values': {s: v['close'] for s, v in present.items()}})
            reasons.append(f"close spread {max(closes) - min(closes):.5f} > {CLOSE_TOLERANCE} at {ts}")

    ohlcv = keys['ohlcv']
    if ohlcv and keys['zigzag']:
        ohlcv_min = min(ohlcv.keys())
        for ts, zz in keys['zigzag'].items():
            if ts < ohlcv_min:
                continue
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

    if check_completeness:
        missing = [s for s in PER_BAR_SOURCES if not keys[s]]
        if missing:
            reasons.append(f"no staged rows from: {', '.join(missing)}")
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
# CALCULATE — Python calc stack on the staged admin-layer data
# ============================================================
def calculate_stage(conn, cycle_id: int, timeframe: str) -> Dict[int, dict]:
    """Returns {timestamp_adj: {derived market_data columns}} for the cycle.

    Bar indexing: bars are addressed by timestamp_adj // TF_SECONDS — a global
    monotonic per-bar counter, so bar DIFFERENCES are exact even across gaps.
    """
    tf_sec = TF_SECONDS[timeframe]
    derived: Dict[int, dict] = {}

    ohlcv = conn.execute(
        f"SELECT timestamp_adj, open, high, low, close FROM raw_ohlcv "
        f"WHERE cycle_id = ? ORDER BY timestamp_adj", (cycle_id,)).fetchall()
    if not ohlcv:
        return derived
    ts_list = [r[0] for r in ohlcv]
    opens = [r[1] for r in ohlcv]
    highs = [r[2] for r in ohlcv]
    lows = [r[3] for r in ohlcv]
    closes = [r[4] for r in ohlcv]
    ts_to_idx = {ts: i for i, ts in enumerate(ts_list)}
    for ts in ts_list:
        derived[ts] = {}

    # --- 1. Z-Score candle set (zscore_candle.py) ---
    for ts, res in zip(ts_list, zscore_calculate(opens, closes)):
        derived[ts]['body_direction'] = res.body_direction
        derived[ts]['body_size'] = res.body_size_export        # |z| per export convention
        derived[ts]['body_classification'] = res.classification

    # --- 2. ZigZag segment metrics (zigzag_metrics.py) ---
    pivots_rows = conn.execute(
        f"SELECT timestamp_adj, point_type, current_point FROM raw_zigzag "
        f"WHERE cycle_id = ? AND current_point IS NOT NULL ORDER BY timestamp_adj DESC",
        (cycle_id,)).fetchall()
    pivots = [ZigZagPivot(bar=ts // tf_sec, price=pt, is_peak=(typ == 'Peak'), timestamp=ts)
              for ts, typ, pt in pivots_rows]     # newest-first
    for idx, pv in enumerate(pivots):
        if idx + 2 >= len(pivots):
            break                                  # needs prev + twoPrev
        m = segment_metrics(pivots, idx)
        d = derived.setdefault(pv.timestamp, {})
        d.update({'zigzag_price_change': m.price_change, 'zigzag_pct_change': m.pct_change,
                  'zigzag_pct_change_class': m.pct_change_class, 'zigzag_bars': m.bars,
                  'zigzag_bars_class': m.bars_class, 'zigzag_price_per_bar': m.price_per_bar,
                  'zigzag_price_per_bar_class': m.price_per_bar_class,
                  'zigzag_slope': m.slope, 'zigzag_category': m.category})

    # --- 3. Fractal / resistance / support lines (fractal_lines.py) ---
    p_single = FractalLinesParams(fractal_bars=13, min_touches=2)
    p_flip = FractalLinesParams(fractal_bars=35, min_touches=3)
    res_line = single_best_resistance(highs, p_single)
    sup_line = single_best_support(lows, p_single)
    flip = flip_line_with_edts(highs, lows, p_flip)
    for ts in ts_list:
        i = ts_to_idx[ts]
        if res_line and i >= res_line.bar_start:
            derived[ts]['best_resistance'] = res_line.price_at(i)
        if sup_line and i >= sup_line.bar_start:
            derived[ts]['best_support'] = sup_line.price_at(i)
        if flip and i >= flip.base.bar_start:
            derived[ts]['fractal_best_fl'] = flip.base.price_at(i)
            derived[ts]['fractal_uoedt'] = flip.uoedt_at(i)
            derived[ts]['fractal_loedt'] = flip.loedt_at(i)

    # --- 4. Centroid variants (centroid_regression.py, one engine) ---
    for variant in CENTROID_VARIANTS:
        rows = conn.execute(
            f"SELECT timestamp_adj, ssa, crossing FROM {SOURCES[variant]['table']} "
            f"WHERE cycle_id = ? ORDER BY timestamp_adj", (cycle_id,)).fetchall()
        # Crossing price = the SSA value on the crossing bar (the MQL5 cross
        # buffer holds the SSA price at the cross; confirm at golden cutover).
        crossings = [(ts_to_idx[ts], ssa) for ts, ssa, crossing in rows
                     if crossing == 1 and ssa is not None and ts in ts_to_idx]
        if not crossings:
            continue
        r = calculate_variant(variant, crossings, closes, highs, lows)
        if r is None:
            continue
        for ts in ts_list:
            i = ts_to_idx[ts]
            if r.leftmost <= i:                    # baseline extended to live bar
                derived[ts][f'{variant}_base_fl'] = r.baseline_at(i)
                derived[ts][f'{variant}_uoedt'] = r.uoedt_at(i)
                derived[ts][f'{variant}_loedt'] = r.loedt_at(i)

    return derived


# ============================================================
# PROMOTE — admin layer + calculated values -> market_data
# ============================================================
ADMIN_CENTROID_COLS = ['horiz_high_map', 'horiz_low_map', 'ssa', 'ema_ssa', 'crossing']

DERIVED_COLS = (['body_direction', 'body_size', 'body_classification',
                 'best_resistance', 'best_support',
                 'fractal_best_fl', 'fractal_uoedt', 'fractal_loedt',
                 'zigzag_price_change', 'zigzag_pct_change', 'zigzag_pct_change_class',
                 'zigzag_bars', 'zigzag_bars_class', 'zigzag_price_per_bar',
                 'zigzag_price_per_bar_class', 'zigzag_slope', 'zigzag_category']
                + [f'{v}_{c}' for v in CENTROID_VARIANTS
                   for c in ('base_fl', 'uoedt', 'loedt')])


def promote_cycle(conn, cycle_id: int, timeframe: str, derived: Dict[int, dict]) -> int:
    ohlcv = conn.execute(
        f"SELECT timestamp_adj, open, high, low, close, volume FROM raw_ohlcv "
        f"WHERE cycle_id = ? ORDER BY timestamp_adj", (cycle_id,)).fetchall()
    if not ohlcv:
        return 0

    admin: Dict[str, Dict[int, tuple]] = {}
    for v in CENTROID_VARIANTS:
        cur = conn.execute(
            f"SELECT timestamp_adj, {', '.join(ADMIN_CENTROID_COLS)} "
            f"FROM {SOURCES[v]['table']} WHERE cycle_id = ?", (cycle_id,))
        admin[v] = {r[0]: r[1:] for r in cur}
    zz = {r[0]: (r[1], r[2]) for r in conn.execute(
        f"SELECT timestamp_adj, point_type, current_point FROM raw_zigzag "
        f"WHERE cycle_id = ?", (cycle_id,))}

    now = int(time.time())
    promoted = 0
    for ts, o, h, l, c, vol in ohlcv:
        rec = {'timestamp': ts, 'symbol': SYMBOL, 'timeframe': timeframe,
               'open': o, 'high': h, 'low': l, 'close': c, 'volume': vol,
               'cycle_id': cycle_id, 'collected_at': now, 'calculated_at': now}
        for v in CENTROID_VARIANTS:
            vals = admin[v].get(ts)
            for i, col in enumerate(ADMIN_CENTROID_COLS):
                rec[f'{v}_{col}'] = vals[i] if vals else None
        rec['zigzag_point_type'], rec['zigzag_current_point'] = zz.get(ts, (None, None))
        d = derived.get(ts, {})
        for col in DERIVED_COLS:
            rec[col] = d.get(col)

        cols = list(rec.keys())
        conn.execute(
            f"INSERT OR REPLACE INTO market_data ({', '.join(cols)}) "
            f"VALUES ({', '.join('?' * len(cols))})", [rec[k] for k in cols])
        promoted += 1
    conn.commit()
    return promoted


# ============================================================
# COLLECTION CYCLE
# ============================================================
def run_cycle(conn, export_dir: Path, timeframe: str, cycle_time: int,
              check_completeness: bool = True) -> bool:
    cycle_id, attempt = open_cycle(conn, cycle_time, timeframe)
    logger.info(f"📥 Cycle {cycle_id} ({timeframe}, slot {cycle_time}, attempt {attempt}): collecting")

    sources_received = 0
    missing_files = []
    for source, spec in SOURCES.items():
        path = export_dir / f"{spec['prefix']}_{SYMBOL}_{timeframe}.txt"
        if not path.exists():
            missing_files.append(path.name)
            continue
        staged = stage_source(conn, cycle_id, source, parse_export_file(path, spec, timeframe))
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

    derived = calculate_stage(conn, cycle_id, timeframe)
    n_derived = sum(1 for d in derived.values() if d)
    promoted = promote_cycle(conn, cycle_id, timeframe, derived)
    set_cycle_status(conn, cycle_id, 'validated', sources_received)
    logger.info(f"✅ Cycle {cycle_id} validated — {promoted} bars promoted "
                f"({n_derived} bars carry calculated values)")
    return True


def run_cycle_with_retries(conn, export_dir, timeframe, cycle_time,
                           check_completeness=True, market_hours=True) -> bool:
    for attempt in range(1, MAX_ATTEMPTS_PER_CYCLE + 1):
        if market_hours and not is_market_open_xauusd():
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
    ap = argparse.ArgumentParser(description='v6 export collector + validator + calculator (XAUUSD)')
    ap.add_argument('--export-dir', default=DEFAULT_EXPORT_DIR)
    ap.add_argument('--db', default=DEFAULT_DB_PATH)
    ap.add_argument('--timeframes', default='M5,M15')
    ap.add_argument('--once', action='store_true')
    ap.add_argument('--no-completeness', action='store_true')
    ap.add_argument('--no-market-hours', action='store_true')
    args = ap.parse_args()

    export_dir = Path(args.export_dir)
    timeframes = [tf.strip().upper() for tf in args.timeframes.split(',') if tf.strip()]
    for tf in timeframes:
        if tf not in TF_SECONDS:
            ap.error(f"unsupported timeframe {tf} (only M5/M15)")

    conn = open_db(args.db)
    logger.info(f"🚀 Export collector v2 (v6 pipeline) — db={args.db} exports={export_dir} tfs={timeframes}")

    if args.once:
        cycle_time = int(time.time()) // CYCLE_INTERVAL_SEC * CYCLE_INTERVAL_SEC
        ok = all(run_cycle_with_retries(
            conn, export_dir, tf, cycle_time,
            check_completeness=not args.no_completeness,
            market_hours=not args.no_market_hours) for tf in timeframes)
        conn.close()
        sys.exit(0 if ok else 1)

    while True:
        now = time.time()
        next_slot = (int(now) // CYCLE_INTERVAL_SEC + 1) * CYCLE_INTERVAL_SEC
        time.sleep(max(0.0, next_slot + 5 - now))
        for tf in timeframes:
            if tf == 'M15' and next_slot % 900 != 0:
                continue
            run_cycle_with_retries(
                conn, export_dir, tf, next_slot,
                check_completeness=not args.no_completeness,
                market_hours=not args.no_market_hours)


if __name__ == '__main__':
    main()
