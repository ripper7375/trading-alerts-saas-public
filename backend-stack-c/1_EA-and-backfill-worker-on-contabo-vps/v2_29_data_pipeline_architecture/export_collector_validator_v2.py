#!/usr/bin/env python3
"""
Export Collector + Validator v2 — v6 collection pipeline (XAUUSD, M5/M15)

Pipeline stages implemented here:
  COLLECT -> ADJUST -> VALIDATE -> PROMOTE

MQL5 IS THE SINGLE SOURCE OF EVERY VALUE (2026-09-09). The 15 indicators export
all 99 market_data data fields; this collector parses, validates, and forwards
them unchanged. It calculates nothing.

2026-09-16: SupportAndResistantAutoCalibration_v2_29 onboarded as the 14th
indicator, adding sr_1..sr_8 (Freedman-Diaconis auto-calibrated support and
resistance levels) -- market_data 87 -> 95 columns.

2026-09-22: S-R-AutoCalibration_v2_29 onboarded as the 15th indicator, adding
sr_9..sr_16 -- the same calibration engine run as a second, independently
anchored instance (source 'sr2_levels', export prefix 'S_R_Levels') --
market_data 95 -> 103 columns.

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

# Reject a cycle whose newest exported bar is older than N x the bar period.
# Guards against reading a STALE export directory — e.g. after promoting the
# collector to a standby MT5 terminal that was not actually running. Such a
# directory passes every other check, because every per-bar source is stale by the
# SAME amount and therefore agree with each other perfectly (validate_cycle's
# completeness check is relative, not absolute). The pipeline would report
# healthy while the newest bar silently stopped advancing.
#
# Why 2: a legitimate cycle already lags for two compounding reasons — the
# collector runs every CYCLE_INTERVAL_SEC (300s) while an M15 bar only advances
# every 900s, and a cycle may retry MAX_ATTEMPTS_PER_CYCLE x RETRY_WAIT_SEC
# (195s). Worst legitimate lag is therefore ~495s on M5 and ~1095s on M15,
# against limits of 600s / 1800s. The M5 margin (105s) is deliberately tight:
# a false rejection is self-healing (the next cycle retries) whereas a missed
# detection is silent, so erring tight is the correct direction.
MAX_BAR_LAG_MULTIPLIER = 2

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
    # The 14th indicator (SupportAndResistantAutoCalibration_v2_29, 2026-09-16).
    # NOTE its export headers are BARE -- 'sr_1', and keys 'timestamp/symbol/
    # timeframe/close' -- where every other source prefixes them ('Best_Support',
    # 'Resistance_timestamp', ...). Verified against the .mq5 source, which writes
    # "timestamp	symbol	timeframe	close	sr_1	...	sr_8". That is fine here:
    # parse_export_file() reads the 4 keys POSITIONALLY (cols 0-3) and data columns
    # by header NAME, so a bare header needs no special case. Do not "tidy" these to
    # match the other sources -- they must match what MetaTrader actually writes.
    'sr_levels':   {'prefix': 'SR_Levels', 'table': 'raw_sr_levels',
                    'columns': [('sr_1', 'real', 'sr_1'), ('sr_2', 'real', 'sr_2'),
                                ('sr_3', 'real', 'sr_3'), ('sr_4', 'real', 'sr_4'),
                                ('sr_5', 'real', 'sr_5'), ('sr_6', 'real', 'sr_6'),
                                ('sr_7', 'real', 'sr_7'), ('sr_8', 'real', 'sr_8')]},
    # The 15th indicator (S-R-AutoCalibration_v2_29, 2026-09-22): a replica of
    # the 14th exporting slots sr_9..sr_16, so a second calibration window can
    # run beside the first. Same bare-header convention as sr_levels.
    #
    # The two prefixes differ by ONE underscore -- 'SR_Levels' vs 'S_R_Levels'.
    # run_cycle() builds an EXACT filename (it does not glob), so they can never
    # pick up each other's file; test_sr2_levels_source.py pins that. The 14th
    # still claims sr_1..sr_8 and this one sr_9..sr_16, so the column names are
    # disjoint and market_data_column()'s identity branch serves both.
    'sr2_levels':  {'prefix': 'S_R_Levels', 'table': 'raw_sr2_levels',
                    'columns': [('sr_9', 'real', 'sr_9'), ('sr_10', 'real', 'sr_10'),
                                ('sr_11', 'real', 'sr_11'), ('sr_12', 'real', 'sr_12'),
                                ('sr_13', 'real', 'sr_13'), ('sr_14', 'real', 'sr_14'),
                                ('sr_15', 'real', 'sr_15'), ('sr_16', 'real', 'sr_16')]},
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
# sr_1..sr_16 are listed EXPLICITLY because they match neither the base set nor
# PRICE_LEVEL_SUFFIXES below -- a numeric slot name has no suffix to key off. The
# indicators write an unresolved slot as an empty field, which parse_export_file
# already maps to NULL, but they export 0.0 for a slot whose level exists and is
# non-positive; both must land as NULL, never as a $0.00 "price".
PRICE_LEVEL_COLUMNS = {
    'horiz_high_map', 'horiz_low_map', 'ssa', 'ema_ssa', 'current_point',
    'best_resistance', 'best_support', 'fractal_best_fl', 'fractal_uoedt',
    'fractal_loedt', 'base_fl', 'uoedt', 'loedt',
    'sr_1', 'sr_2', 'sr_3', 'sr_4', 'sr_5', 'sr_6', 'sr_7', 'sr_8',        # sr_levels
    'sr_9', 'sr_10', 'sr_11', 'sr_12', 'sr_13', 'sr_14', 'sr_15', 'sr_16',  # sr2_levels
}
PRICE_LEVEL_SUFFIXES = ('_map', '_point', '_fl', '_edt', '_ssa', '_resistance', '_support')

# ============================================================
# STATISTIC FILES — the fit-quality snapshot beside each timeseries export
# ============================================================
# 12 of the 15 indicators also write `{prefix}_{SYMBOL}_{TF}_Statistic.txt`:
# the 7 centroid variants plus fractal_edt / resistance / support / sr_levels /
# sr2_levels. OHLCV, ZigZag and ZScore do not (fully reproducible from their
# timeseries). All 12 are ingested.
#
# HISTORY -- sr_levels was excluded deliberately on 2026-09-16: its
# statistic file is a different kind of document. It records Freedman-Diaconis
# calibration -- Q25/Q75, IQR, Optimal Step, Fractals Sample -- where this
# table's vocabulary is regression fit quality (MODEL A/B residuals, EDT
# containment). Almost none of its labels appear in STAT_FIELDS, so ingesting it
# would write a near-empty row per cycle; worse,
# gateway_contract_indicator_statistics.schema.json pins `source` to a CLOSED
# 10-value enum and the statistics POST is BATCHED, so one sr_levels element
# would 400 the whole request and quarantine every other snapshot in it.
# MT5 still writes the file; capturing it properly (new columns here, in both
# Prisma mirrors and in that contract's enum) is its own scoped piece of work.
#
# Unlike the timeseries exports these are NOT per-bar — each file is a single
# snapshot of the current fit. That is exactly why they are worth capturing:
# stored per-bar values get refitted for ~3000 bars before they freeze, so
# they are not point-in-time honest, whereas a snapshot read at export time
# is. See STATISTIC-CAPTURE-SCOPE.md and
# HISTORICAL-VALUES-LOOK-AHEAD-BIAS-OPEN-ISSUE.md.
# sr_levels was excluded here from 2026-09-16 until 2026-09-20, on the
# grounds that its statistic file is a different kind of document and would
# write a near-empty row. That was true then and is no longer: its own
# vocabulary now has columns (sr_q25/sr_iqr/sr_optimal_step/...), and the
# `source` enum in gateway_contract_indicator_statistics.schema.json has
# been widened to 11 to match. The enum is still CLOSED and the POST is
# still BATCHED, so the gateway MUST be deployed before the VPS starts
# sending this source -- otherwise one element 400s the whole request and
# every other snapshot in it is quarantined AND stamped synced_at.
#
# sr2_levels (2026-09-22) is enrolled from day one: its statistic file is
# the 14th indicator's, section for section, so the ten [SUPPORT-RESISTANCE
# rules below already parse it, and the enum is widened to 12 in the same
# release. The ordering hazard is unchanged, and it is NOT new to this lane:
# the market_data contract also rejects unknown fields, so sr_9..sr_16 force
# the same migration -> gateway -> VPS order regardless.
#
# Note on config_hash: indicator_configs is keyed by the hash ALONE, so two
# sources with identical parameter blocks share one row whose `source` is
# whichever was seen first. That already happens for resistance/support
# (measured: both hash to 12a7d85e8bf6 on the real captures) and will happen
# for sr_levels/sr2_levels, whose window anchors are measurements (STAT_FIELDS)
# rather than configuration. The per-source reconfiguration signal lives in
# indicator_statistics' (source, config_hash) history, which is unaffected.
STAT_SOURCES = [s for s in SOURCES
                if s not in ('ohlcv', 'zigzag', 'zscore')]

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
    # A tuple of labels is tried in order, first hit wins. This is how the
    # variant-flavoured header lines stop losing data: 'Observation Window'
    # is spelled '(Bars)' by BestFit A/B and MostRecent and '(Box B Bars)'
    # by CherryPick/NonRecent, so a single literal captured only four of
    # the seven and the other three stored NULL. The canonical [FIT WINDOW]
    # name is tried first; the legacy spellings remain so a terminal still
    # running an older binary keeps populating the column.
    (('Observation Bars', 'Observation Window (Box B Bars)',
      'Observation Window (Bars)'), None,          'window_bars',      'int'),
    (('Math Window Bars', 'Math Search Window (Bars)',
      'Max Window Bars'), None,                     'math_lookback',    'int'),
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

    # Extended statistics [added 2026-09-20]. Section prefixes are
    # ASCII-only by construction now, so the FILE_ANSI em-dash quirk that
    # forced prefix matching cannot bite these.
    # 'Window Bars' is unique per file, so section-agnostic lookup is safe and
    # lets sr_levels (which writes it under its own PARAMETERS header) land in
    # the same column as the other ten.
    ('Window Bars',                 None,                                      'window_span_bars',        'int'),
    ('Visual Window Bars',          '[FIT WINDOW',                             'visual_window_bars',      'int'),
    ('Bars Available',              '[FIT WINDOW',                             'bars_available',          'int'),
    ('Leftmost Bar Index',          '[FIT WINDOW',                             'leftmost_bar_index',      'int'),
    ('Line Span Bars',              '[FIT WINDOW',                             'line_span_bars',          'int'),
    ('Baseline Coverage (n)',       '[FIT WINDOW',                             'baseline_coverage_n',     'int'),
    ('Baseline Coverage Rate',      '[FIT WINDOW',                             'baseline_coverage_rate',  'real'),
    ('Centroids Used',              '[FIT WINDOW',                             'centroids_used',          'int'),
    ('Crossings In Window (n)',     '[FIT WINDOW',                             'crossings_in_window_n',   'int'),
    ('First Crossing TS (UTC)',     '[FIT WINDOW',                             'first_crossing_ts',       'int'),
    ('Last Crossing TS (UTC)',      '[FIT WINDOW',                             'last_crossing_ts',        'int'),
    ('Live Close',                  None,                                      'live_close',              'real'),
    ('Baseline Value',              '[PRICE CONTEXT',                          'baseline_value',          'real'),
    ('UOEDT Value',                 '[PRICE CONTEXT',                          'uoedt_value',             'real'),
    ('LOEDT Value',                 '[PRICE CONTEXT',                          'loedt_value',             'real'),
    ('Distance To Baseline',        '[PRICE CONTEXT',                          'dist_to_baseline',        'real'),
    ('Distance To UOEDT',           '[PRICE CONTEXT',                          'dist_to_uoedt',           'real'),
    ('Distance To LOEDT',           '[PRICE CONTEXT',                          'dist_to_loedt',           'real'),
    ('Channel Position',            '[PRICE CONTEXT',                          'channel_position',        'real'),
    # sr_levels calls these Highest High / Lowest Low; same measurement, same
    # column. Canonical spelling first, so the other ten are unaffected.
    (('Window High', 'Highest High'), None,                                    'window_high',             'real'),
    (('Window Low', 'Lowest Low'),  None,                                      'window_low',              'real'),
    ('Window Range',                None,                                      'window_range',            'real'),
    ('Channel Width',               '[CHANNEL GEOMETRY',                       'channel_width',           'real'),
    ('Channel Asymmetry',           '[CHANNEL GEOMETRY',                       'channel_asymmetry',       'real'),
    ('Above UOEDT Count',           '[CHANNEL GEOMETRY',                       'breach_above_n',          'int'),
    ('Below LOEDT Count',           '[CHANNEL GEOMETRY',                       'breach_below_n',          'int'),
    ('Max Excursion Above',         '[CHANNEL GEOMETRY',                       'max_excursion_above',     'real'),
    ('Max Excursion Below',         '[CHANNEL GEOMETRY',                       'max_excursion_below',     'real'),
    ('Sample (n)',                  '[RESIDUAL DIAGNOSTICS; CROSSINGS',        'resid_a_n',               'int'),
    ('Mean Residual',               '[RESIDUAL DIAGNOSTICS; CROSSINGS',        'resid_a_mean',            'real'),
    ('MAE',                         '[RESIDUAL DIAGNOSTICS; CROSSINGS',        'resid_a_mae',             'real'),
    ('Residual StdDev',             '[RESIDUAL DIAGNOSTICS; CROSSINGS',        'resid_a_sd',              'real'),
    ('Max Abs Residual',            '[RESIDUAL DIAGNOSTICS; CROSSINGS',        'resid_a_max',             'real'),
    ('Durbin-Watson',               '[RESIDUAL DIAGNOSTICS; CROSSINGS',        'resid_a_dw',              'real'),
    ('Sample (n)',                  '[RESIDUAL DIAGNOSTICS; CLOSE',            'resid_b_n',               'int'),
    ('Mean Residual',               '[RESIDUAL DIAGNOSTICS; CLOSE',            'resid_b_mean',            'real'),
    ('MAE',                         '[RESIDUAL DIAGNOSTICS; CLOSE',            'resid_b_mae',             'real'),
    ('Residual StdDev',             '[RESIDUAL DIAGNOSTICS; CLOSE',            'resid_b_sd',              'real'),
    ('Max Abs Residual',            '[RESIDUAL DIAGNOSTICS; CLOSE',            'resid_b_max',             'real'),
    ('Durbin-Watson',               '[RESIDUAL DIAGNOSTICS; CLOSE',            'resid_b_dw',              'real'),

    # [SUPPORT-RESISTANCE AUTO-CALIBRATION] -- sr_levels and sr2_levels only
    # (the 15th indicator writes this file section for section). Section-scoped
    # rather than reshaping that file into the regression-fit schema: it
    # measures bucket calibration, not residuals against a fitted line, and
    # padding it with permanently-empty channel fields would add noise, not
    # data.
    ('Fractals Sample (N)',         '[SUPPORT-RESISTANCE',                     'sr_fractals_n',           'int'),
    ('Q25 (25th percentile)',       '[SUPPORT-RESISTANCE',                     'sr_q25',                  'real'),
    ('Q75 (75th percentile)',       '[SUPPORT-RESISTANCE',                     'sr_q75',                  'real'),
    ('IQR',                         '[SUPPORT-RESISTANCE',                     'sr_iqr',                  'real'),
    ('Optimal Step',                '[SUPPORT-RESISTANCE',                     'sr_optimal_step',         'real'),
    ('Total Macro Clusters',        '[SUPPORT-RESISTANCE',                     'sr_macro_clusters',       'int'),
    ('Nearest Resistance',          '[SUPPORT-RESISTANCE',                     'sr_nearest_resistance',   'real'),
    ('Nearest Support',             '[SUPPORT-RESISTANCE',                     'sr_nearest_support',      'real'),
    ('Distance to Resistance',      '[SUPPORT-RESISTANCE',                     'sr_dist_resistance_pts',  'int'),
    ('Distance to Support',         '[SUPPORT-RESISTANCE',                     'sr_dist_support_pts',     'int'),
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
    # [FROZEN_SNAPSHOT], added 2026-09-18 with the frozen-projection mode.
    # These five describe how the terminal was SET UP, so they belong here and
    # not among the measurements -- and that turns the existing config_hash
    # mechanism into a free, permanent, append-only record of every promotion:
    # switching a terminal from DYNAMIC to FROZEN, or re-freezing it on a newly
    # approved line, mints a new hash in indicator_configs the moment it happens.
    #
    # The 'Snapshot *' keys in that same block are deliberately NOT listed. They
    # are the LIVE measured geometry, which drifts every cycle in dynamic mode --
    # registering them as configuration would mint a new hash on every single
    # cycle and bury the real signal in noise.
    'Projection Mode', 'Frozen Anchor TS (Server)', 'Frozen Slope (b)',
    'Frozen Anchor Price', 'Frozen UOEDT Offset', 'Frozen LOEDT Offset',
    # sr_levels [added 2026-09-20]. Calculation Mode and Window Mode are
    # compiled-in choices; a new config_hash appearing means someone changed
    # how the levels are calibrated, which is exactly the signal wanted.
    'Calculation Mode', 'Window Mode', 'Min Touches Filter', 'Max Window Bars',
}

# The columns migrate_statistics_table() adds to a deployed database.
# Kept beside STAT_FIELDS so the two are edited together; a column here
# with no STAT_FIELDS entry is dead, and the reverse crashes the lane.
STAT_EXTENDED_COLUMNS = [
    ('sr_fractals_n', 'INTEGER'),
    ('sr_q25', 'REAL'),
    ('sr_q75', 'REAL'),
    ('sr_iqr', 'REAL'),
    ('sr_optimal_step', 'REAL'),
    ('sr_macro_clusters', 'INTEGER'),
    ('sr_nearest_resistance', 'REAL'),
    ('sr_nearest_support', 'REAL'),
    ('sr_dist_resistance_pts', 'INTEGER'),
    ('sr_dist_support_pts', 'INTEGER'),
    ('window_span_bars', 'INTEGER'),
    ('visual_window_bars', 'INTEGER'),
    ('bars_available', 'INTEGER'),
    ('leftmost_bar_index', 'INTEGER'),
    ('line_span_bars', 'INTEGER'),
    ('baseline_coverage_n', 'INTEGER'),
    ('baseline_coverage_rate', 'REAL'),
    ('centroids_used', 'INTEGER'),
    ('crossings_in_window_n', 'INTEGER'),
    ('first_crossing_ts', 'INTEGER'),
    ('last_crossing_ts', 'INTEGER'),
    ('live_close', 'REAL'),
    ('baseline_value', 'REAL'),
    ('uoedt_value', 'REAL'),
    ('loedt_value', 'REAL'),
    ('dist_to_baseline', 'REAL'),
    ('dist_to_uoedt', 'REAL'),
    ('dist_to_loedt', 'REAL'),
    ('channel_position', 'REAL'),
    ('window_high', 'REAL'),
    ('window_low', 'REAL'),
    ('window_range', 'REAL'),
    ('channel_width', 'REAL'),
    ('channel_asymmetry', 'REAL'),
    ('breach_above_n', 'INTEGER'),
    ('breach_below_n', 'INTEGER'),
    ('max_excursion_above', 'REAL'),
    ('max_excursion_below', 'REAL'),
    ('resid_a_n', 'INTEGER'),
    ('resid_a_mean', 'REAL'),
    ('resid_a_mae', 'REAL'),
    ('resid_a_sd', 'REAL'),
    ('resid_a_max', 'REAL'),
    ('resid_a_dw', 'REAL'),
    ('resid_b_n', 'INTEGER'),
    ('resid_b_mean', 'REAL'),
    ('resid_b_mae', 'REAL'),
    ('resid_b_sd', 'REAL'),
    ('resid_b_max', 'REAL'),
    ('resid_b_dw', 'REAL'),
]

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
        # A label may be a tuple of spellings, tried in order; first hit wins.
        raw = None
        for lb in (label if isinstance(label, tuple) else (label,)):
            if sect_prefix is None:
                raw = seen.get((None, lb))
            else:
                raw = next((v for (s, l), v in seen.items()
                            if l == lb and s is not None and s.startswith(sect_prefix)), None)
            if raw is not None:
                break
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
    can never drift from the registry. Staging tables only; market_data has its
    own equivalent in migrate_market_data() below, which is likewise additive
    only, so real history is never at risk from either.
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


def migrate_market_data(conn) -> int:
    """Add any market_data column promote_cycle() will write but the DB lacks.

    The same gap migrate_raw_tables() closes, one table further down. The schema
    file's CREATE TABLE IF NOT EXISTS market_data is a silent no-op against a
    database that already exists, so widening the DDL does NOT widen a deployed
    xauusd.db. promote_cycle() then names a column SQLite does not have and
    raises OperationalError — which nothing in run_cycle() catches, so the
    collector crash-loops on the first validated cycle instead of degrading.
    That is a full outage from a forgotten manual step, which is why this runs
    automatically rather than living only in a runbook.

    ADDITIVE ONLY, and that distinction is the whole safety argument: it issues
    ALTER TABLE ... ADD COLUMN and nothing else — never DROP, never RENAME,
    never backfill, never rewrite a row. A nullable ADD COLUMN with no default
    is a catalog-only change in SQLite, so existing history is untouched.
    Anything destructive remains a deliberate, reviewed migration.

    Driven by SOURCES through market_data_column(), the same pair of functions
    promote_cycle() itself uses to build its INSERT, so the two cannot disagree
    about what a column is called. Idempotent. (PROMOTE_SOURCES and
    market_data_column are defined further down the module; Python resolves
    them at call time, and this only ever runs from open_db().)

    migrate_sqlite_add_sr_columns.sql is the hand-run equivalent for the
    2026-09-16 sr_* addition, for operators who would rather widen the database
    as an explicit step before starting the service. Running both is safe.
    """
    existing = {r[1] for r in conn.execute("PRAGMA table_info(market_data)")}
    if not existing:
        return 0                                  # table absent; the schema file creates it
    added = 0
    for source in PROMOTE_SOURCES:
        for col, typ, _ in SOURCES[source]['columns']:
            name = market_data_column(source, col)
            if name not in existing:
                conn.execute(f"ALTER TABLE market_data ADD COLUMN {name} {SQLITE_TYPE[typ]}")
                logger.info(f"   schema migration: market_data.{name} {SQLITE_TYPE[typ]} added")
                existing.add(name)
                added += 1
    if added:
        conn.commit()
    return added


def migrate_statistics_table(conn) -> int:
    """Add any indicator_statistics column parse_statistic_file() will write
    but the DB lacks -- the same CREATE TABLE IF NOT EXISTS gap that
    migrate_raw_tables() and migrate_market_data() close, one table further on.

    It matters more here than it looks. stage_statistics() builds its INSERT
    from the parsed row's own keys, so against a deployed xauusd.db that has
    not been widened it names a column SQLite does not have and raises
    OperationalError. That call is wrapped best-effort by design -- a
    statistics failure must never reject a price cycle -- so the exception is
    swallowed and the entire statistics lane goes SILENTLY dark while every
    other part of the pipeline reports success.

    ADDITIVE ONLY: ALTER TABLE ... ADD COLUMN and nothing else. Never DROP,
    never RENAME, never backfill. Idempotent.
    """
    existing = {r[1] for r in conn.execute("PRAGMA table_info(indicator_statistics)")}
    if not existing:
        return 0                                  # table absent; the schema file creates it
    added = 0
    for col, typ in STAT_EXTENDED_COLUMNS:
        if col not in existing:
            conn.execute(f"ALTER TABLE indicator_statistics ADD COLUMN {col} {typ}")
            logger.info(f"   schema migration: indicator_statistics.{col} {typ} added")
            existing.add(col)
            added += 1
    if added:
        conn.commit()
    return added


def assert_staging_tables(conn) -> None:
    """Refuse to start if a SOURCES staging table does not exist.

    The migrate_* functions above widen tables that exist; a staging table for
    a NEW source can only come from the schema file's CREATE TABLE. That file
    is read from beside this script, so deploying an updated collector without
    its matching sqlite_schema_v6_xauusd.sql -- the 2-file pattern the VPS
    staging package uses -- leaves the new table uncreated, and the first
    stage_source() raises an uncaught `no such table` inside run_cycle(): a
    crash loop on every cycle. Failing here instead says what to fix, once.
    """
    missing = [spec['table'] for spec in SOURCES.values()
               if not conn.execute("SELECT 1 FROM sqlite_master WHERE type = 'table' "
                                   "AND name = ?", (spec['table'],)).fetchone()]
    if missing:
        raise RuntimeError(
            f"staging table(s) {', '.join(missing)} missing after running "
            f"{SCHEMA_FILE} -- that schema file is older than this collector. "
            f"Deploy the matching sqlite_schema_v6_xauusd.sql beside it.")


def open_db(db_path: str) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    conn.executescript(SCHEMA_FILE.read_text())
    try:
        assert_staging_tables(conn)
    except RuntimeError:
        conn.close()
        raise
    migrate_raw_tables(conn)
    migrate_market_data(conn)
    migrate_statistics_table(conn)
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


def validate_cycle(conn, cycle_id, timeframe, cycle_time,
                   check_completeness=True) -> Tuple[bool, List[str]]:
    """Validate one staged cycle. `cycle_time` is the scheduled 5-min slot (unix
    UTC) and is REQUIRED — it is the reference the freshness check measures the
    newest exported bar against. Deliberately not defaulted to None: a silent
    'skip the check' path is exactly how this guard would stop running without
    anyone noticing."""
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

            # (a) RELATIVE — do the sources agree with each other on the newest bar?
            stale = [s for s in PER_BAR_SOURCES if latest not in keys[s]]
            if stale:
                log_failure(conn, cycle_id, 'timestamp',
                            {'latest_bar': latest, 'missing_in': stale,
                             'error': 'sources exported different latest bars (stale export)'})
                reasons.append(f"latest bar {latest} missing in: {', '.join(stale)}")

            # (b) ABSOLUTE — is the newest bar actually current? Checked
            # independently of (a), not nested under it: a directory frozen by a
            # shut-down terminal is stale in this sense while passing (a)
            # perfectly, since every source froze at the same bar. Both reasons
            # are reported when both apply.
            max_lag = MAX_BAR_LAG_MULTIPLIER * TF_SECONDS[timeframe]
            lag = cycle_time - latest
            if lag > max_lag:
                log_failure(conn, cycle_id, 'timestamp',
                            {'latest_bar': latest, 'cycle_time': cycle_time,
                             'lag_sec': lag, 'max_lag_sec': max_lag,
                             'error': 'newest exported bar is too old — export '
                                      'directory is stale (is the MT5 terminal '
                                      'running with charts attached?)'})
                reasons.append(
                    f"newest bar {latest} is {lag}s behind cycle slot {cycle_time} "
                    f"(max {max_lag}s) — stale export directory")

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

    # Economic calendar. A THIRD independent lane: its own exporter, table,
    # contract and endpoint. Staged independently so missing price files
    # or market_data validation failures cannot block calendar capture,
    # and calendar cannot affect market_data.
    #
    # Not tied to this cycle's timeframe or cycle_id — calendar events are
    # global, and the snapshot carries its own captured_at from the exporter.
    # Calling it on both the M5 and M15 cycles is harmless: change detection
    # makes the second call a no-op.
    try:
        appended, unchanged = stage_economic_events(conn, export_dir)
        if appended or unchanged:
            logger.info(f"   calendar      {appended:>5} appended, {unchanged} unchanged")
    except Exception as e:                                     # noqa: BLE001
        logger.warning(f"calendar capture skipped for cycle {cycle_id}: {e}")

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
    passed, reasons = validate_cycle(conn, cycle_id, timeframe, cycle_time,
                                     check_completeness=check_completeness)
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
