#!/usr/bin/env python3
"""
Export Collector + Validator v2 — v6 collection pipeline (XAUUSD, M5/M15)

Pipeline stages implemented here:
  COLLECT -> ADJUST -> VALIDATE -> PROMOTE

MQL5 IS THE SINGLE SOURCE OF EVERY VALUE (2026-09-09). The 13 indicators export
all 83 market_data data fields; this collector parses, validates, and forwards
them unchanged. It calculates nothing.

The former CALCULATE stage — a Python calc stack that recomputed the derived
layer (centroid baselines/EDTs, fractal/resistance/support lines, zigzag
metrics, the z-score body set) — is PARKED, not deleted. It lives in
calculation-split-between-mt5-and-python-PENDING-PROJECT/ together with its
certification harness and a document explaining the architecture, what it
costs to be without it, and how to revive it.

- HEADER-NAME-BASED PARSING: columns are located by header name, not position,
  so a reordered or extended export cannot silently shift a column.
- Staging holds every exported column, so PROMOTE is a straight copy onto the
  OHLCV per-bar spine (absent value -> NULL, never a sentinel).

Unchanged: cycle states (collecting -> validating -> validated | rejected),
key validation (timestamp_adj / symbol / timeframe / close with
CLOSE_TOLERANCE), zigzag subset rule, market-hours gate (XAUUSD server hours
with US-DST conversion to UTC), bounded reject -> re-request.

Mock mode:
  python3 export_collector_validator_v2.py \
      --export-dir ../../mock-data-from-indicators/time_series_data \
      --db /tmp/test.db --timeframes M5 --once --no-market-hours --no-completeness
"""

import argparse
import hashlib
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
MAX_ATTEMPTS_PER_CYCLE = 3
RETRY_WAIT_SEC = 65
CYCLE_INTERVAL_SEC = 300

DEFAULT_DB_PATH = 'C:/Scripts/database/xauusd.db'
DEFAULT_EXPORT_DIR = 'C:/MT5/MQL5/Files'
SCHEMA_FILE = Path(__file__).with_name('sqlite_schema_v6_xauusd.sql')

CENTROID_VARIANTS = ['best_fit_a', 'best_fit_b', 'cherry_a', 'cherry_b', 'most_recent', 'non_a', 'non_b']

# ============================================================
# SOURCE REGISTRY — every column each MQL5 indicator exports
# ============================================================
# 'columns': (sqlite/staging column, type, exact export header name)
#
# The header names below are the literal strings the .mq5 files write, which
# are NOT uniform: the centroid line values are Title_Case (Base_FL/UOEDT/LOEDT)
# while their admin columns are lower_snake, the zigzag metrics carry no source
# prefix at all, and the export FILE prefix differs from the column prefix on
# every source (file 'Centriod_Best_Fit_A_XAUUSD_M5.txt' holds 'Best_Fit_A_*'
# columns). Verified against both the .mq5 source and real captured exports —
# do not "tidy" these to match each other.
def _centroid_columns(prefix: str):
    return [('horiz_high_map', 'real', f'{prefix}_horiz_high_map'),
            ('horiz_low_map', 'real', f'{prefix}_horiz_low_map'),
            ('ssa', 'real', f'{prefix}_ssa'),
            ('ema_ssa', 'real', f'{prefix}_ema_ssa'),
            ('crossing', 'int', f'{prefix}_crossing'),
            ('base_fl', 'real', f'{prefix}_Base_FL'),
            ('uoedt', 'real', f'{prefix}_UOEDT'),
            ('loedt', 'real', f'{prefix}_LOEDT')]


SOURCES = {
    'best_fit_a':  {'prefix': 'Centriod_Best_Fit_A', 'table': 'raw_best_fit_a',
                    'columns': _centroid_columns('Best_Fit_A')},
    'best_fit_b':  {'prefix': 'Centriod_Best_Fit_B', 'table': 'raw_best_fit_b',
                    'columns': _centroid_columns('Best_Fit_B')},
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
    'fractal_edt': {'prefix': 'Fractal_EDT', 'table': 'raw_fractal_edt',
                    'columns': [('best_fl', 'real', 'Fractal_Best_FL'),
                                ('uoedt', 'real', 'Fractal_UOEDT'),
                                ('loedt', 'real', 'Fractal_LOEDT')]},
    'ohlcv':       {'prefix': 'OHLCV', 'table': 'raw_ohlcv',
                    'columns': [('open', 'real', 'ohlcv_open'), ('high', 'real', 'ohlcv_high'),
                                ('low', 'real', 'ohlcv_low'), ('volume', 'int', 'ohlcv_volume')]},
    'resistance':  {'prefix': 'Resistance_Line', 'table': 'raw_resistance',
                    'columns': [('best_resistance', 'real', 'Best_Resistance')]},
    'support':     {'prefix': 'Support_Line', 'table': 'raw_support',
                    'columns': [('best_support', 'real', 'Best_Support')]},
    'zscore':      {'prefix': 'ZScore', 'table': 'raw_zscore',
                    'columns': [('body_direction', 'int', 'body_direction'),
                                ('body_size', 'real', 'body_size'),
                                ('body_classification', 'int', 'body_classification')]},
    'zigzag':      {'prefix': 'ZigZag', 'table': 'raw_zigzag',
                    'columns': [('point_type', 'text', 'zigzag_Type'),
                                ('current_point', 'real', 'CurrentPoint'),
                                ('price_change', 'real', 'CurrentPrChg'),
                                ('pct_change', 'real', 'Current%Chg'),
                                ('pct_change_class', 'int', 'Current%ChgClass'),
                                ('bars', 'int', 'CurrentBars'),
                                ('bars_class', 'int', 'CurrentBarsClass'),
                                ('price_per_bar', 'real', 'CurrentPrPerBar'),
                                ('price_per_bar_class', 'int', 'CurrentPrPerBarClass'),
                                ('slope', 'real', 'CurrentSlope'),
                                ('category', 'text', 'CurrentCategory')]},
}

PER_BAR_SOURCES = [s for s in SOURCES if s != 'zigzag']

# Price-level columns where <= 0.0 means inactive/empty, never a valid market price
# (XAUUSD trades in the $2,000-$3,000+ range) — schema v6 mandates these be stored as
# NULL, not 0 (sqlite_schema_v6_xauusd.sql). MQL5 writes an inactive buffer as an empty
# field OR as 0.0 depending on the indicator, so both must map to NULL.
#
# Deliberately EXCLUDED, because 0 is a legitimate value for them: `crossing` (0 = no
# cross), `body_size` (|z| = 0 when a candle sits exactly on its mean), `body_direction`
# (0 = doji), and every zigzag metric (`slope`, `price_change`, `pct_change`, ... are
# routinely zero or negative).
PRICE_LEVEL_COLUMNS = {
    'horiz_high_map', 'horiz_low_map', 'ssa', 'ema_ssa', 'current_point',
    'best_resistance', 'best_support', 'fractal_best_fl', 'fractal_uoedt',
    'fractal_loedt', 'base_fl', 'uoedt', 'loedt'
}
PRICE_LEVEL_SUFFIXES = ('_map', '_point', '_fl', '_edt', '_ssa', '_resistance', '_support')

# ============================================================
# STATISTIC FILES — the fit-quality snapshot beside each timeseries export
# ============================================================
# 10 of the 13 indicators also write `{prefix}_{SYMBOL}_{TF}_Statistic.txt`:
# the 7 centroid variants plus fractal_edt / resistance / support. OHLCV,
# ZigZag and ZScore do not (fully reproducible from their timeseries).
#
# Unlike the timeseries exports these are NOT per-bar — each file is a single
# snapshot of the current fit. That is exactly why they are worth capturing:
# stored per-bar values get refitted for ~3000 bars before they freeze, so
# they are not point-in-time honest, whereas a snapshot read at export time
# is. See STATISTIC-CAPTURE-SCOPE.md and
# HISTORICAL-VALUES-LOOK-AHEAD-BIAS-OPEN-ISSUE.md.
STAT_SOURCES = [s for s in SOURCES if s not in ('ohlcv', 'zigzag', 'zscore')]

# (statistic-file label, section it appears in, staging column, type)
# `section` is matched as a PREFIX because the files are written FILE_ANSI and
# the em-dash in headers like "[FRACTAL BEST-FIT — PARAMETERS]" arrives
# mangled; None means "any section".
STAT_FIELDS = [
    ('Raw Slope (b)',            None,            'raw_slope',        'real'),
    ('Anchored Y-Int',           None,            'anchored_y_int',   'real'),
    ('Regression Angle',         None,            'regression_angle', 'real'),
    ('Solution Found',           None,            'solution_found',   'bool'),
    ('Line Origin TS (UTC)',     None,            'line_origin_ts',   'int'),
    ('Best FL Touches',          None,            'touches',          'int'),
    ('Window Start TS (UTC)',    None,            'window_start_ts',  'int'),
    ('Window End TS (UTC)',      None,            'window_end_ts',    'int'),
    ('Observation Window (Box B Bars)', None,      'window_bars',      'int'),
    ('Math Search Window (Bars)', None,           'math_lookback',    'int'),
    ('Total 171 Crossings (n)',  None,            'crossings_n',      'int'),

    ('Sample (n)',  '[MODEL A',   'model_a_n',         'int'),
    ('R-Square',    '[MODEL A',   'model_a_r2',        'real'),
    ('MSE',         '[MODEL A',   'model_a_mse',       'real'),
    ('Var Ratio',   '[MODEL A',   'model_a_var_ratio', 'real'),
    ('Skewness',    '[MODEL A',   'model_a_skew',      'real'),
    ('Kurtosis',    '[MODEL A',   'model_a_kurt',      'real'),

    ('Sample (n)',  '[MODEL B',   'model_b_n',         'int'),
    ('R-Square',    '[MODEL B',   'model_b_r2',        'real'),
    ('MSE',         '[MODEL B',   'model_b_mse',       'real'),
    ('Var Ratio',   '[MODEL B',   'model_b_var_ratio', 'real'),
    ('Skewness',    '[MODEL B',   'model_b_skew',      'real'),
    ('Kurtosis',    '[MODEL B',   'model_b_kurt',      'real'),

    ('UOEDT Offset',           '[EDT CHANNEL', 'uoedt_offset',      'real'),
    ('LOEDT Offset',           '[EDT CHANNEL', 'loedt_offset',      'real'),
    ('Containment Sample (n)', '[EDT CHANNEL', 'containment_n',     'int'),
    ('Containment Count',      '[EDT CHANNEL', 'containment_count', 'int'),
    ('Containment Rate',       '[EDT CHANNEL', 'containment_rate',  'real'),
]

# Labels captured as configuration rather than as measurements: they describe
# HOW the indicator was set up, not what it found. Hashed and deduplicated
# into indicator_configs, because they are compiled into the .mq5 and change
# only on redeploy — a NEW hash appearing IS the "someone reconfigured this"
# signal.
STAT_CONFIG_LABELS = {
    'Regression Centroids (Box B)', 'Excluded Recent Centroids (Box A)',
    'Excluded Centroids', 'Time-Decay Lambda', 'Visual EDT Window (Bars)',
    'Timeframe (Sec)', 'Fractal Bars', 'Min Touches', 'Require Both Sides',
    'Max Line Angle', 'Tolerance Type', 'Tolerance Percent',
    'Tolerance ATR Multiplier', 'EDT Min Touches', 'LOEDT Min Touches',
    'UOEDT Min Touches', 'Extend To Current',
}

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
                    # Defensive snap to the bar grid. Since the 2026-09-09 MQL5
                    # fix this is a NO-OP on correct data: every indicator now
                    # derives its GMT offset from TimeTradeServer() rounded to
                    # the hour, so an exported timestamp is already exactly on
                    # the grid and rounds to itself.
                    #
                    # It used to matter, and the history is worth keeping: the
                    # indicators previously computed the offset as
                    # `TimeCurrent() - TimeGMT()`. TimeCurrent() is the LAST
                    # TICK's time, not the clock, so the offset silently
                    # absorbed "seconds since the last tick" and stamped it on
                    # every row of that file as a constant sub-bar phase
                    # (observed %300 in the golden archive: ohlcv 206,
                    # best_fit 4, cherry_a 240, cherry_b 288, fractal 189, ...).
                    # Different sources exported at different moments, so the
                    # same physical bar landed on different grid slots and
                    # cross-source close validation could not pass. Fixed at
                    # source in all 13 indicators, not worked around here.
                    #
                    # Kept as belt-and-braces: it costs nothing and still
                    # protects the cycle if one indicator is ever redeployed
                    # from an unfixed build.
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
                    val = float(v)
                    # Ingestion guard: an inactive/uninitialized price level exports as
                    # 0.0, not EMPTY_VALUE — coerce it to None (NULL) rather than let a
                    # $0.00 "price" reach the regression engine or alert bots.
                    is_price_col = (col in PRICE_LEVEL_COLUMNS or col.endswith(PRICE_LEVEL_SUFFIXES))
                    row[col] = None if (is_price_col and val <= 0.0) else val
                elif typ == 'int':
                    row[col] = int(float(v))
                else:
                    row[col] = v
            rows.append(row)
    return rows


# ============================================================
# DATABASE
# ============================================================
def _stat_value(raw: str, typ: str):
    """Coerce one statistic value. Empty means 'not resolved' -> None, never 0."""
    raw = raw.strip()
    if raw == '':
        return None
    try:
        if typ == 'int':
            return int(float(raw))
        if typ == 'real':
            return float(raw)
        if typ == 'bool':
            return 1 if raw.lower() == 'true' else 0
    except ValueError:
        return None
    return raw


def parse_statistic_file(path: Path) -> Optional[dict]:
    """Parse one `_Statistic.txt` into {staging column: value} + config params.

    Format is `Key: Value` lines grouped under `[SECTION]` headers. Four real
    quirks in the actual files, all handled here:

      1. Written FILE_ANSI, so the em-dash in a header arrives mangled — match
         sections by PREFIX ('[MODEL A'), never by the full literal.
      2. Keys contain digits, spaces and parentheses ('Total 171 Crossings (n)',
         'Raw Slope (b)') — split on the FIRST ':' only.
      3. 'Sample (n)', 'R-Square' etc. appear in BOTH model blocks, so a key is
         only unique WITHIN a section — the parser must be section-aware.
      4. A value can be empty ('UOEDT Offset: ') when the line did not resolve.
    """
    try:
        text = path.read_text(encoding='utf-8', errors='replace')
    except OSError as e:
        logger.warning(f"{path.name}: unreadable ({e})")
        return None

    seen: Dict[Tuple[Optional[str], str], str] = {}
    config: Dict[str, str] = {}
    section = ''
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        if line.startswith('['):
            section = line
            continue
        if ':' not in line:
            continue
        label, _, value = line.partition(':')
        label, value = label.strip(), value.strip()
        seen[(section, label)] = value
        seen.setdefault((None, label), value)     # section-agnostic lookup
        if label in STAT_CONFIG_LABELS:
            config[label] = value

    if not seen:
        return None

    row: dict = {}
    for label, sect_prefix, col, typ in STAT_FIELDS:
        if sect_prefix is None:
            raw = seen.get((None, label))
        else:
            raw = next((v for (s, l), v in seen.items()
                        if l == label and s is not None and s.startswith(sect_prefix)), None)
        row[col] = _stat_value(raw, typ) if raw is not None else None

    # Hash a canonical rendering, so reformatting or reordering the file can
    # never masquerade as a configuration change.
    canonical = json.dumps(config, sort_keys=True, separators=(',', ':'))
    row['config_params'] = canonical
    row['config_hash'] = hashlib.sha256(canonical.encode('utf-8')).hexdigest()
    return row


def stage_statistics(conn, cycle_id: int, timeframe: str, export_dir: Path,
                     cycle_time: int, live_bar_ts: Dict[str, int]) -> int:
    """Stage one statistics snapshot per source for a VALIDATED cycle.

    Best-effort by design: this is telemetry, and no failure here may reject a
    cycle or disturb the market_data path. The caller wraps it accordingly.
    """
    staged = 0
    for source in STAT_SOURCES:
        path = export_dir / f"{SOURCES[source]['prefix']}_{SYMBOL}_{timeframe}_Statistic.txt"
        if not path.exists():
            continue
        row = parse_statistic_file(path)
        if row is None:
            continue
        row.update({'cycle_id': cycle_id, 'symbol': SYMBOL, 'timeframe': timeframe,
                    'source': source, 'captured_at': cycle_time,
                    'live_bar_ts': live_bar_ts.get(source, cycle_time)})
        cols = list(row.keys())
        conn.execute(
            f"INSERT OR REPLACE INTO indicator_statistics ({', '.join(cols)}) "
            f"VALUES ({', '.join('?' * len(cols))})", [row[c] for c in cols])
        staged += 1
    conn.commit()
    return staged


# ============================================================
# ECONOMIC CALENDAR (append-only, independent of the market_data cycle)
# ============================================================
# Source: EconomicCalendarExport_v2_29.mq5, which dumps a FULL SNAPSHOT of its
# window every run and deliberately does no change detection. That decision
# lives here instead, because it is the one piece of this lane worth testing.
#
# Why it is not optional: the exporter emits ~333 rows per snapshot. Appending
# all of them every cycle would write ~32,000 rows/day — about 12M/year — of
# which almost all are byte-identical repeats. Appending only what actually
# changed brings that to roughly 15k/year. Same append-only guarantee, three
# orders of magnitude less of it.
ECONOMIC_CALENDAR_FILE = 'EconomicCalendar.txt'

# (column, type) in the exporter's own header. Parsing is by NAME, so this
# order is cosmetic — but the names ARE the contract, shared with
# gateway_contract_economic_events.schema.json and the economic_events table.
CALENDAR_COLUMNS: List[Tuple[str, str]] = [
    ('value_id', 'text'), ('captured_at', 'int'), ('event_id', 'text'),
    ('event_time', 'int'), ('event_period', 'int'), ('revision', 'int'),
    ('country_code', 'text'), ('currency', 'text'), ('event_name', 'text'),
    ('importance', 'text'),
    ('event_type', 'int'), ('sector', 'int'), ('frequency', 'int'),
    ('time_mode', 'int'), ('unit', 'int'), ('multiplier', 'int'),
    ('digits', 'int'), ('event_code', 'text'), ('source_url', 'text'),
    ('actual_value', 'real'), ('forecast_value', 'real'),
    ('prev_value', 'real'), ('revised_prev_value', 'real'),
    ('impact_type', 'int'),
]

# Everything except captured_at, which is the observation time and therefore
# differs on every snapshot by definition. Comparing it would make every row
# look changed and defeat the whole point.
CALENDAR_COMPARE_COLUMNS = [c for c, _ in CALENDAR_COLUMNS if c != 'captured_at']


def _calendar_value(raw: str, typ: str):
    """Empty field -> None. NEVER 0.

    LONG_MIN upstream means 'not published', and the exporter writes that as an
    empty field. A genuine 0.0 reading is real data — a 0.0% CPI print is a
    fact, not a gap. Conflating the two would fabricate a forecast of zero for
    every rate decision, which structurally has no numeric forecast at all.
    """
    raw = raw.strip()
    if raw == '':
        return None
    if typ == 'text':
        return raw
    try:
        return int(raw) if typ == 'int' else float(raw)
    except ValueError:
        return None


def parse_calendar_file(path: Path) -> List[dict]:
    """Header-NAME based, exactly like parse_export_file.

    The exporter writes real UTF-8 (not FILE_ANSI like the 13 numeric
    exporters) precisely so this open() succeeds on a non-ASCII event name.
    """
    rows: List[dict] = []
    with open(path, encoding='utf-8') as f:
        header_line = f.readline().rstrip('\n').rstrip('\r')
        if not header_line.strip():
            return rows
        headers = header_line.split('\t')
        idx = {}
        for col, typ in CALENDAR_COLUMNS:
            try:
                idx[col] = (headers.index(col), typ)
            except ValueError:
                idx[col] = (None, typ)      # absent in this export -> NULL

        for lineno, line in enumerate(f, start=2):
            line = line.rstrip('\n').rstrip('\r')
            if not line.strip():
                continue
            parts = line.split('\t')
            row = {}
            for col, (i, typ) in idx.items():
                raw = parts[i] if (i is not None and i < len(parts)) else ''
                row[col] = _calendar_value(raw, typ)

            # The three NOT NULL columns. A row missing any of them cannot be
            # keyed or ordered, so drop it rather than stage something broken.
            if row['value_id'] is None or row['captured_at'] is None \
                    or row['event_time'] is None:
                logger.warning(f"calendar: line {lineno} missing a key field, skipped")
                continue
            rows.append(row)
    return rows


def stage_economic_events(conn, export_dir: Path) -> Tuple[int, int]:
    """Append only the releases whose content actually changed.

    Returns (appended, unchanged). Best-effort by design: like the statistics
    lane, nothing here may reject a cycle or disturb the market_data path.

    Idempotent — running it twice against the same snapshot appends nothing the
    second time, which is why it is safe to call once per timeframe cycle.
    """
    path = export_dir / ECONOMIC_CALENDAR_FILE
    if not path.exists():
        return (0, 0)

    rows = parse_calendar_file(path)
    if not rows:
        return (0, 0)

    cols = [c for c, _ in CALENDAR_COLUMNS]
    placeholders = ', '.join('?' * len(cols))
    select_prior = (
        f"SELECT {', '.join(CALENDAR_COMPARE_COLUMNS)} FROM economic_events "
        f"WHERE value_id = ? ORDER BY captured_at DESC LIMIT 1"
    )

    appended = unchanged = 0
    for row in rows:
        prior = conn.execute(select_prior, (row['value_id'],)).fetchone()
        if prior is not None:
            current = tuple(row[c] for c in CALENDAR_COMPARE_COLUMNS)
            if tuple(prior) == current:
                unchanged += 1
                continue

        cur = conn.execute(
            f"INSERT OR IGNORE INTO economic_events ({', '.join(cols)}) "
            f"VALUES ({placeholders})", [row[c] for c in cols])
        if cur.rowcount:
            appended += 1
        else:
            # A real change collided with an existing (value_id, captured_at).
            # Only reachable if two exports share a second, which a 900s timer
            # makes essentially impossible — but silence here would lose a
            # revision, so say so.
            logger.warning(
                f"calendar: change for value_id={row['value_id']} dropped — "
                f"captured_at={row['captured_at']} already present")
    conn.commit()
    return (appended, unchanged)


SQLITE_TYPE = {'real': 'REAL', 'int': 'INTEGER', 'text': 'TEXT'}


def migrate_raw_tables(conn) -> int:
    """Add any raw_* staging column present in SOURCES but missing from the DB.

    The schema file uses CREATE TABLE IF NOT EXISTS, which silently does nothing
    for a database that already exists — so a VPS carrying an older xauusd.db
    would keep the old staging shape and quietly stage NULL for every new
    column. This closes that gap: it reads the live shape with PRAGMA
    table_info and ALTERs in whatever SOURCES says is missing.

    Idempotent (a second run adds nothing), and driven by SOURCES itself so it
    can never drift from the registry. Staging tables only — market_data is
    never touched, so real history is never at risk.
    """
    added = 0
    for source, spec in SOURCES.items():
        existing = {r[1] for r in conn.execute(f"PRAGMA table_info({spec['table']})")}
        if not existing:
            continue                              # table absent; the schema file creates it
        for col, typ, _ in spec['columns']:
            if col not in existing:
                conn.execute(f"ALTER TABLE {spec['table']} ADD COLUMN {col} {SQLITE_TYPE[typ]}")
                logger.info(f"   schema migration: {spec['table']}.{col} {SQLITE_TYPE[typ]} added")
                added += 1
    if added:
        conn.commit()
    return added


def open_db(db_path: str) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    conn.executescript(SCHEMA_FILE.read_text())
    migrate_raw_tables(conn)
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
# PROMOTE — staged MQL5 columns -> market_data
# ============================================================
# Sources merged onto the OHLCV per-bar spine. OHLCV is excluded because it IS
# the spine (its columns are written directly).
PROMOTE_SOURCES = [s for s in SOURCES if s != 'ohlcv']


def market_data_column(source: str, staging_col: str) -> str:
    """Staging column -> its market_data column name.

    Derived from the source key rather than a hand-maintained list, so a column
    added to SOURCES automatically reaches market_data under the right name.
    """
    if source in CENTROID_VARIANTS:
        return f'{source}_{staging_col}'          # ssa -> non_a_ssa, base_fl -> non_a_base_fl
    if source == 'fractal_edt':
        return f'fractal_{staging_col}'           # best_fl -> fractal_best_fl
    if source == 'zigzag':
        return f'zigzag_{staging_col}'            # slope -> zigzag_slope
    return staging_col                            # resistance/support/zscore already canonical


def promote_cycle(conn, cycle_id: int, timeframe: str) -> int:
    """Merge every staged source onto the OHLCV spine, one market_data row per bar.

    LEFT-JOIN semantics: a bar missing from a source simply leaves that source's
    columns NULL — the cycle already passed cross-source key validation, so a gap
    here means the indicator had no value for that bar, not that data is missing.
    """
    ohlcv = conn.execute(
        f"SELECT timestamp_adj, open, high, low, close, volume FROM raw_ohlcv "
        f"WHERE cycle_id = ? ORDER BY timestamp_adj", (cycle_id,)).fetchall()
    if not ohlcv:
        return 0

    # {source: (staging column names, {timestamp_adj: value tuple})}
    staged: Dict[str, Tuple[List[str], Dict[int, tuple]]] = {}
    for src in PROMOTE_SOURCES:
        cols = [c for c, _, _ in SOURCES[src]['columns']]
        if not cols:
            continue
        cur = conn.execute(
            f"SELECT timestamp_adj, {', '.join(cols)} FROM {SOURCES[src]['table']} "
            f"WHERE cycle_id = ?", (cycle_id,))
        staged[src] = (cols, {r[0]: r[1:] for r in cur})

    now = int(time.time())
    promoted = 0
    for ts, o, h, l, c, vol in ohlcv:
        rec = {'timestamp': ts, 'symbol': SYMBOL, 'timeframe': timeframe,
               'open': o, 'high': h, 'low': l, 'close': c, 'volume': vol,
               # calculated_at is legacy: it marked the old Python CALCULATE
               # stage. With MQL5 as the single source there is no separate
               # calculation step, so it equals collected_at (promote time).
               'cycle_id': cycle_id, 'collected_at': now, 'calculated_at': now}
        for src, (cols, by_ts) in staged.items():
            vals = by_ts.get(ts)
            for i, col in enumerate(cols):
                rec[market_data_column(src, col)] = vals[i] if vals else None

        cols_out = list(rec.keys())
        conn.execute(
            f"INSERT OR REPLACE INTO market_data ({', '.join(cols_out)}) "
            f"VALUES ({', '.join('?' * len(cols_out))})", [rec[k] for k in cols_out])
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

    promoted = promote_cycle(conn, cycle_id, timeframe)
    set_cycle_status(conn, cycle_id, 'validated', sources_received)
    logger.info(f"✅ Cycle {cycle_id} validated — {promoted} bars promoted")

    # Statistics capture. Deliberately AFTER the cycle is marked validated and
    # wrapped so it cannot affect the outcome: these snapshots are valuable
    # telemetry, but price data is load-bearing and statistics must never be
    # able to reject a cycle or block the market_data outbox.
    try:
        live_bar_ts = {
            s: r[0] for s, r in (
                (s, conn.execute(
                    f"SELECT MAX(timestamp_adj) FROM {SOURCES[s]['table']} WHERE cycle_id = ?",
                    (cycle_id,)).fetchone())
                for s in STAT_SOURCES)
            if r and r[0] is not None
        }
        n_stats = stage_statistics(conn, cycle_id, timeframe, export_dir,
                                   cycle_time, live_bar_ts)
        if n_stats:
            logger.info(f"   statistics    {n_stats:>5} snapshots staged")
    except Exception as e:                                     # noqa: BLE001
        logger.warning(f"statistics capture skipped for cycle {cycle_id}: {e}")

    # Economic calendar. A THIRD independent lane: its own exporter, table,
    # contract and endpoint. Wrapped separately from the statistics block above
    # so neither can take the other down, and neither can touch market_data.
    #
    # Not tied to this cycle's timeframe or cycle_id — calendar events are
    # global, and the snapshot carries its own captured_at from the exporter.
    # Calling it on both the M5 and M15 cycles is harmless: change detection
    # makes the second call a no-op.
    try:
        appended, unchanged = stage_economic_events(conn, export_dir)
        if appended:
            logger.info(f"   calendar      {appended:>5} appended, {unchanged} unchanged")
    except Exception as e:                                     # noqa: BLE001
        logger.warning(f"calendar capture skipped for cycle {cycle_id}: {e}")

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
    ap = argparse.ArgumentParser(description='v6 export collector + validator (XAUUSD)')
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
