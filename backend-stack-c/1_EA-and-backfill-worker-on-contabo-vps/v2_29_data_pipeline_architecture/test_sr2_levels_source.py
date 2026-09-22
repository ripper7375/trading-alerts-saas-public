"""Tests for the 15th indicator source, sr2_levels (S-R-AutoCalibration_v2_29).

Run either way -- there is no pytest config in this stack:

    python -m pytest test_sr2_levels_source.py -q
    python test_sr2_levels_source.py

The 15th indicator is a replica of the 14th (sr_levels) exporting slots
sr_9..sr_16 from a second calibration window. test_sr_levels_source.py already
covers the machinery both share (bare headers, the <=0 guard, migrate_market_data
itself); this file pins what is NEW or can only go wrong because there are now
TWO instances of the same indicator:

1. PREFIX ISOLATION. 'SR_Levels' and 'S_R_Levels' differ by one underscore.
   run_cycle() builds an EXACT filename, so they cannot collide -- proved here
   against real files, including the failure the enrolment deliberately accepts:
   a missing S_R_Levels export rejects the WHOLE cycle.

2. NO CROSS-TALK. Both sources fall through market_data_column()'s identity
   branch, so correctness rests entirely on their column names being disjoint.
   A promotion with different values in each proves sr_1..sr_8 and sr_9..sr_16
   land in their own columns.

3. THE .mq5 IS THE CONTRACT. The TSV header, export prefix and statistic labels
   are read out of S-R-AutoCalibration_v2_29.mq5 rather than restated, so the
   registry is checked against what MetaTrader will actually write.

4. DEPLOYED-DATABASE PATH. A VPS xauusd.db from before this change has 95
   market_data columns and no raw_sr2_levels. open_db() must bring it to 103
   and create the staging table, or promote_cycle() crash-loops the collector.

5. STATISTICS + POINT-IN-TIME ENROLMENT. Both were decided explicitly
   (2026-09-22): the statistic file is ingested as 'sr2_levels' (enum 11 -> 12)
   and sr_9..sr_16 are snapshotted (69 -> 77), because the 15th inherits the
   14th's re-bucketing look-ahead verbatim.

6. COEXISTENCE ON ONE CHART. Object prefixes, button names and export prefixes
   must not overlap -- ObjectsDeleteAll() matches by PREFIX, so one instance's
   cleanup must not be able to delete the other's lines.
"""
import io
import json
import re
import sqlite3
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import export_collector_validator_v2 as collector          # noqa: E402
import backfill_worker_api_gateway_v5 as worker            # noqa: E402
import generate_point_in_time_schema as pit                # noqa: E402

SCHEMA = HERE / 'sqlite_schema_v6_xauusd.sql'
CONTRACT = HERE / 'gateway_contract_market_data.schema.json'
STATS_CONTRACT = HERE / 'gateway_contract_indicator_statistics.schema.json'
INDICATOR = HERE / 'mq5' / 'S-R-AutoCalibration_v2_29.mq5'
INDICATOR_14 = HERE / 'mq5' / 'SupportAndResistantAutoCalibration_v2_29.mq5'
SQLITE_MIGRATION = HERE / 'migrate_sqlite_add_sr2_columns.sql'

SOURCE = 'sr2_levels'
SR2_COLS = [f'sr_{i}' for i in range(9, 17)]
SR1_COLS = [f'sr_{i}' for i in range(1, 9)]

CYCLE_TIME = 1789012800
assert CYCLE_TIME % 900 == 0, 'fixture slot must align to M15 as well as M5'
CLOSE = 4285.68


def _code(path: Path) -> str:
    """Source with // comment lines removed, so an explanation cannot satisfy
    an assertion meant for live code (a lesson from test_sr_levels_source)."""
    src = path.read_text(encoding='utf-8')
    return '\n'.join(l for l in src.split('\n') if not l.strip().startswith('//'))


def _mq5_header() -> str:
    """The TSV header literal ExportSRData() writes, read from the .mq5."""
    m = re.search(r'string header = "(timestamp\\t[^"]*)\\r\\n";', _code(INDICATOR))
    assert m, 'could not locate the TSV header literal in the .mq5'
    return m.group(1).replace('\\t', '\t')


def _mq5_input(name: str) -> str:
    m = re.search(rf'input\s+string\s+{name}\s*=\s*"([^"]*)"', _code(INDICATOR))
    assert m, f'input {name} not found'
    return m.group(1)


def fresh_db() -> sqlite3.Connection:
    conn = sqlite3.connect(':memory:')
    conn.executescript(SCHEMA.read_text(encoding='utf-8'))
    return conn


def write_export(directory: Path, source: str, rows, timeframe='M5') -> Path:
    """Write a real-shaped export for ANY source, from its registry entry.

    `rows` are (ts, close, {data column: string}); unspecified columns are
    written empty, which the parser stages as NULL. Keys go in columns 0-3,
    where parse_export_file() reads them positionally.
    """
    spec = collector.SOURCES[source]
    header = ['timestamp', 'symbol', 'timeframe', 'close'] + [h for _, _, h in spec['columns']]
    lines = ['\t'.join(header)]
    for ts, close, values in rows:
        lines.append('\t'.join(
            [str(ts), collector.SYMBOL, timeframe, f'{close:.2f}']
            + [values.get(col, '') for col, _t, _h in spec['columns']]))
    path = directory / f"{spec['prefix']}_{collector.SYMBOL}_{timeframe}.txt"
    io.open(path, 'w', encoding='utf-8', newline='').write('\r\n'.join(lines) + '\r\n')
    return path


def write_all_exports(directory: Path, skip=(), overrides=None):
    """One bar per source -- enough for a complete, valid cycle."""
    overrides = overrides or {}
    for source in collector.SOURCES:
        if source in skip:
            continue
        values = dict(overrides.get(source, {}))
        if source == 'ohlcv':
            values.update(open=f'{CLOSE:.2f}', high=f'{CLOSE:.2f}', low=f'{CLOSE:.2f}', volume='1')
        elif source == 'zigzag':
            values.setdefault('point_type', 'Peak')         # NOT NULL + CHECK in raw_zigzag
        write_export(directory, source, [(CYCLE_TIME, CLOSE, values)])


def parse(values: dict):
    with tempfile.TemporaryDirectory() as d:
        path = write_export(Path(d), SOURCE, [(CYCLE_TIME, CLOSE, values)])
        return collector.parse_export_file(path, collector.SOURCES[SOURCE], 'M5')[0]


SAMPLE = {'sr_9': '4275.36', 'sr_10': '4260.71', 'sr_11': '', 'sr_12': '',
          'sr_13': '4285.90', 'sr_14': '4297.28', 'sr_15': '4311.48', 'sr_16': ''}
SAMPLE_14 = {'sr_1': '4270.00', 'sr_2': '4250.00', 'sr_3': '', 'sr_4': '',
             'sr_5': '4300.00', 'sr_6': '', 'sr_7': '', 'sr_8': ''}


# ============================================================
# 1. The registry matches what the .mq5 writes
# ============================================================
def test_registry_header_matches_the_indicator_byte_for_byte():
    expected = ['timestamp', 'symbol', 'timeframe', 'close'] + \
               [h for _, _, h in collector.SOURCES[SOURCE]['columns']]
    assert _mq5_header().split('\t') == expected, _mq5_header()


def test_registry_prefix_is_the_indicators_default_export_name():
    assert collector.SOURCES[SOURCE]['prefix'] == _mq5_input('InpExportFileName')


def test_staging_names_coincide_with_bare_headers():
    for col, typ, hname in collector.SOURCES[SOURCE]['columns']:
        assert (col, typ) == (hname, 'real'), (col, typ, hname)
    assert [c for c, _, _ in collector.SOURCES[SOURCE]['columns']] == SR2_COLS


def test_all_eight_slots_parse_by_name():
    row = parse({c: f'{4200 + i}.25' for i, c in enumerate(SR2_COLS)})
    for i, col in enumerate(SR2_COLS):
        assert row[col] == 4200 + i + 0.25, (col, row[col])


# ============================================================
# 2. An unresolved slot is NULL, never 0
# ============================================================
def test_empty_slot_is_null():
    row = parse(SAMPLE)
    assert row['sr_9'] == 4275.36 and row['sr_13'] == 4285.90
    for col in ('sr_11', 'sr_12', 'sr_16'):
        assert row[col] is None, (col, row[col])


def test_zero_and_negative_slots_are_coerced_to_null():
    """Fails if sr_9..sr_16 ever leave PRICE_LEVEL_COLUMNS."""
    row = parse({c: '0.00' for c in SR2_COLS[:4]} | {'sr_13': '-1.00', 'sr_14': '4290.10'})
    for col in SR2_COLS[:4] + ['sr_13']:
        assert row[col] is None, f'{col} staged as {row[col]!r}, expected NULL'
    assert row['sr_14'] == 4290.10


def test_price_guard_covers_every_slot_explicitly():
    """A numeric name has no suffix, so only the explicit set can cover it."""
    for col in SR2_COLS:
        assert col in collector.PRICE_LEVEL_COLUMNS, f'{col} is outside the <=0 guard'
        assert not col.endswith(collector.PRICE_LEVEL_SUFFIXES)


# ============================================================
# 3. Registry wiring, two instances side by side
# ============================================================
def test_source_is_fully_enrolled():
    assert SOURCE in collector.PER_BAR_SOURCES, 'must guard the price cycle like sr_levels'
    assert SOURCE in collector.PROMOTE_SOURCES
    assert SOURCE in collector.STAT_SOURCES
    assert len(collector.SOURCES) == 15, len(collector.SOURCES)
    assert len(collector.PER_BAR_SOURCES) == 14, len(collector.PER_BAR_SOURCES)


def test_the_two_sr_sources_are_disjoint():
    """Identity-mapped columns: disjoint names are the ONLY thing keeping the
    two instances apart in market_data."""
    a = {collector.market_data_column('sr_levels', c) for c, _, _ in collector.SOURCES['sr_levels']['columns']}
    b = {collector.market_data_column(SOURCE, c) for c, _, _ in collector.SOURCES[SOURCE]['columns']}
    assert a == set(SR1_COLS) and b == set(SR2_COLS)
    assert not (a & b)
    assert collector.SOURCES[SOURCE]['table'] != collector.SOURCES['sr_levels']['table']
    assert collector.SOURCES[SOURCE]['prefix'] != collector.SOURCES['sr_levels']['prefix']


def test_every_market_data_column_has_exactly_one_writer():
    """Registry-wide: no two sources may promote into the same column."""
    seen = {}
    for src in collector.PROMOTE_SOURCES:
        for col, _t, _h in collector.SOURCES[src]['columns']:
            name = collector.market_data_column(src, col)
            assert name not in seen, f'{name} written by both {seen[name]} and {src}'
            seen[name] = src


def test_schema_shape():
    conn = fresh_db()
    md = [r[1] for r in conn.execute('PRAGMA table_info(market_data)')]
    assert len(md) == 103, f'market_data changed shape: {len(md)} columns'
    assert set(SR1_COLS + SR2_COLS) <= set(md)
    staged = [r[1] for r in conn.execute('PRAGMA table_info(raw_sr2_levels)')]
    assert staged[6:] == SR2_COLS, staged
    view = conn.execute("SELECT sql FROM sqlite_master WHERE name = 'v_validation_keys'").fetchone()[0]
    assert "'sr2_levels'" in view and 'raw_sr2_levels' in view
    sources = {r[0] for r in conn.execute('SELECT DISTINCT source FROM v_validation_keys')}
    assert sources == set(), 'fresh database should have no staged keys'
    raw_tables = {r[0] for r in conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'raw_%'")}
    assert raw_tables == {s['table'] for s in collector.SOURCES.values()}, raw_tables


# ============================================================
# 4. The real collection path, with real files on disk
# ============================================================
def _run(directory: Path):
    conn = fresh_db()
    ok = collector.run_cycle(conn, directory, 'M5', CYCLE_TIME, check_completeness=False)
    return conn, ok


def test_cycle_validates_and_promotes_both_instances_without_cross_talk():
    with tempfile.TemporaryDirectory() as d:
        write_all_exports(Path(d), overrides={SOURCE: SAMPLE, 'sr_levels': SAMPLE_14})
        conn, ok = _run(Path(d))
        assert ok, conn.execute('SELECT rejected_reason FROM collection_cycles').fetchall()
        row = conn.execute(
            f"SELECT {', '.join(SR1_COLS + SR2_COLS)} FROM market_data "
            f"WHERE timestamp = ? AND timeframe = 'M5'", (CYCLE_TIME,)).fetchone()
    assert row[:8] == (4270.0, 4250.0, None, None, 4300.0, None, None, None), row[:8]
    assert row[8:] == (4275.36, 4260.71, None, None, 4285.90, 4297.28, 4311.48, None), row[8:]


def test_a_missing_s_r_levels_export_rejects_the_whole_cycle():
    """The accepted cost of full enrolment -- pinned so it is never a surprise."""
    with tempfile.TemporaryDirectory() as d:
        write_all_exports(Path(d), skip=(SOURCE,))
        conn, ok = _run(Path(d))
        status, reason = conn.execute(
            'SELECT status, rejected_reason FROM collection_cycles').fetchone()
        promoted = conn.execute('SELECT COUNT(*) FROM market_data').fetchone()[0]
    assert not ok and status == 'rejected'
    assert f'S_R_Levels_{collector.SYMBOL}_M5.txt' in reason, reason
    assert promoted == 0


def test_the_14th_indicators_file_cannot_stand_in_for_the_15th():
    """Only SR_Levels present: the one-underscore difference must not be
    bridged by any fuzzy match. (And the reverse, for symmetry.)"""
    for present, absent in (('sr_levels', SOURCE), (SOURCE, 'sr_levels')):
        with tempfile.TemporaryDirectory() as d:
            write_all_exports(Path(d), skip=(absent,))
            conn, ok = _run(Path(d))
            reason = conn.execute('SELECT rejected_reason FROM collection_cycles').fetchone()[0]
        assert not ok, f'{absent} was satisfied by {present}'
        want = f"{collector.SOURCES[absent]['prefix']}_{collector.SYMBOL}_M5.txt"
        assert want in reason and reason.count('.txt') == 1, reason


def test_a_close_disagreement_in_the_new_source_rejects_the_cycle():
    """sr2_levels is a validation key source, not a passenger."""
    with tempfile.TemporaryDirectory() as d:
        write_all_exports(Path(d))
        write_export(Path(d), SOURCE, [(CYCLE_TIME, CLOSE + 1.0, SAMPLE)])
        conn, ok = _run(Path(d))
        reason = conn.execute('SELECT rejected_reason FROM collection_cycles').fetchone()[0]
    assert not ok and 'close spread' in reason, reason


# ============================================================
# 5. A database deployed before this change
# ============================================================
def _pre_change_file(path: str) -> None:
    """market_data at 95 columns and no raw_sr2_levels -- a VPS as of 09-21."""
    seed = sqlite3.connect(path)
    seed.executescript(SCHEMA.read_text(encoding='utf-8'))
    seed.execute('DROP VIEW v_validation_keys')
    seed.execute('DROP TABLE raw_sr2_levels')
    for col in SR2_COLS:
        seed.execute(f'ALTER TABLE market_data DROP COLUMN {col}')
    seed.execute("INSERT INTO collection_cycles (cycle_id, cycle_time, timeframe, created_at) "
                 "VALUES (1, ?, 'M5', 1)", (CYCLE_TIME,))
    seed.execute("INSERT INTO market_data (timestamp, symbol, timeframe, open, high, low, close, "
                 "volume, sr_1, cycle_id, collected_at) VALUES (?, ?, 'M5', ?, ?, ?, ?, 7, 4270.0, 1, 1)",
                 (CYCLE_TIME - 300, collector.SYMBOL, CLOSE, CLOSE, CLOSE, CLOSE))
    seed.commit()
    assert len(list(seed.execute('PRAGMA table_info(market_data)'))) == 95
    seed.close()


def test_migrate_market_data_adds_exactly_the_eight():
    with tempfile.TemporaryDirectory() as d:
        path = str(Path(d) / 'xauusd.db')
        _pre_change_file(path)
        conn = sqlite3.connect(path)
        assert collector.migrate_market_data(conn) == 8
        assert collector.migrate_market_data(conn) == 0, 'not idempotent'
        cols = [r[1] for r in conn.execute('PRAGMA table_info(market_data)')]
        conn.close()
    assert cols[-8:] == SR2_COLS, cols[-8:]


def test_open_db_brings_a_deployed_database_fully_up_to_date():
    """The production path end to end: widen, create, re-view, keep history,
    then actually promote a cycle and pass the push worker's own drift guard."""
    with tempfile.TemporaryDirectory() as d:
        path = str(Path(d) / 'xauusd.db')
        _pre_change_file(path)
        conn = collector.open_db(path)
        try:
            md = {r[1] for r in conn.execute('PRAGMA table_info(market_data)')}
            assert len(md) == 103 and set(SR2_COLS) <= md
            assert conn.execute("SELECT name FROM sqlite_master WHERE name='raw_sr2_levels'").fetchone()
            view = conn.execute("SELECT sql FROM sqlite_master WHERE name='v_validation_keys'").fetchone()[0]
            assert "'sr2_levels'" in view
            old = conn.execute('SELECT close, volume, sr_1, sr_9 FROM market_data').fetchall()
            assert old == [(CLOSE, 7, 4270.0, None)], old
            assert worker.verify_schema_contract(conn) is True

            exports = Path(d) / 'exports'
            exports.mkdir()
            write_all_exports(exports, overrides={SOURCE: SAMPLE})
            assert collector.run_cycle(conn, exports, 'M5', CYCLE_TIME, check_completeness=False)
            got = conn.execute('SELECT sr_9, sr_13 FROM market_data WHERE timestamp = ?',
                               (CYCLE_TIME,)).fetchone()
        finally:
            conn.close()                          # Windows will not delete an open WAL database
    assert got == (4275.36, 4285.90), got


def test_a_stale_schema_file_fails_at_startup_not_mid_cycle():
    """New collector + old schema file beside it (the VPS package copies .py
    files only): raw_sr2_levels is never created, and without the guard the
    first stage_source() raises inside run_cycle() on every cycle."""
    stale = SCHEMA.read_text(encoding='utf-8')
    start = stale.index('CREATE TABLE IF NOT EXISTS raw_sr2_levels')
    stale = stale[:start] + stale[stale.index(');', start) + 2:]
    stale = re.sub(r"\n\s*SELECT cycle_id, 'sr2_levels'[^\n]*\n\s*UNION ALL", '', stale)
    assert 'raw_sr2_levels' not in stale, 'fixture failed to model the old schema'
    original = collector.SCHEMA_FILE
    with tempfile.TemporaryDirectory() as d:
        old_schema = Path(d) / 'sqlite_schema_v6_xauusd.sql'
        old_schema.write_text(stale, encoding='utf-8')
        path = str(Path(d) / 'xauusd.db')
        _pre_change_file(path)
        collector.SCHEMA_FILE = old_schema
        try:
            collector.open_db(path).close()
            raised = 'open_db() accepted a schema file with no raw_sr2_levels'
        except RuntimeError as exc:
            raised = str(exc)
        finally:
            collector.SCHEMA_FILE = original
    assert 'raw_sr2_levels' in raised and 'sqlite_schema_v6_xauusd.sql' in raised, raised


def test_hand_run_sqlite_migration_widens_to_103():
    with tempfile.TemporaryDirectory() as d:
        path = str(Path(d) / 'xauusd.db')
        _pre_change_file(path)
        conn = sqlite3.connect(path)
        conn.executescript(SQLITE_MIGRATION.read_text(encoding='utf-8'))
        cols = [r[1] for r in conn.execute('PRAGMA table_info(market_data)')]
        conn.close()
    assert len(cols) == 103 and cols[-8:] == SR2_COLS, cols[-8:]
    stmts = ' '.join(l.split('--')[0] for l in SQLITE_MIGRATION.read_text().splitlines()).upper()
    assert 'DROP TABLE' not in stmts and 'DELETE' not in stmts and 'UPDATE' not in stmts


# ============================================================
# 6. Statistics lane
# ============================================================
def _stat_file_from_mq5(values: dict) -> str:
    """Rebuild the statistic file from the .mq5's OWN WriteSRStatFile labels.

    Each `FileWriteString(fh, "<Label>: " + ...)` becomes `<Label>: <value>`;
    `[SECTION]` lines pass through. Values come from `values` or a default.
    """
    code = _code(INDICATOR)
    # The definition, not the forward declaration near the top of the file.
    body = code[code.index('void WriteSRStatFile(string clean_symbol, string tf_str)\n{'):]
    body = body[:body.index('\n}')]
    out = []
    for lit in re.findall(r'FileWriteString\(fh,\s*"([^"]*)"', body):
        lit = lit.replace('\\r\\n', '')
        if lit.startswith('[') or lit == '':
            out.append(lit)
        elif lit.endswith(': '):
            label = lit[:-2]
            out.append(f'{label}: {values.get(label, "1")}')
        else:
            out.append(lit)                       # e.g. "Pipeline 1:1 Slots: 8 (...)"
    return '\r\n'.join(out) + '\r\n'


STAT_VALUES = {
    'Calculation Mode': 'Freedman-Diaconis IQR (Auto-Calibrated)', 'Window Mode': 'Fixed Window',
    'Window Start TS (UTC)': '1780580400', 'Window End TS (UTC)': '1780904700',
    'Window Bars': '1082', 'Max Window Bars': '3000', 'Timeframe (Sec)': '300',
    'Fractals Sample (N)': '31', 'Q25 (25th percentile)': '4350.44',
    'Q75 (75th percentile)': '4380.57', 'IQR': '30.13', 'Optimal Step': '18.42',
    'Min Touches Filter': '1', 'Highest High': '4402.10', 'Lowest Low': '4301.00',
    'Window Range': '101.10', 'Live Close': '4285.68', 'Total Macro Clusters': '6',
    'Nearest Resistance': '4285.90', 'Nearest Support': '4275.36',
    'Distance to Resistance': '22', 'Distance to Support': '1032',
}


def test_every_calibration_rule_label_is_written_by_the_15th_indicator():
    """The collector's [SUPPORT-RESISTANCE rules, checked against the .mq5."""
    code = _code(INDICATOR)
    for label, sect, _col, _t in collector.STAT_FIELDS:
        if sect is not None and sect.startswith('[SUPPORT-RESISTANCE'):
            assert f'"{label}: "' in code, f'{label!r} is not written by the 15th indicator'


def test_statistic_file_is_staged_as_sr2_levels():
    with tempfile.TemporaryDirectory() as d:
        stat = Path(d) / f"S_R_Levels_{collector.SYMBOL}_M5_Statistic.txt"
        io.open(stat, 'w', encoding='utf-8', newline='').write(_stat_file_from_mq5(STAT_VALUES))
        conn = fresh_db()
        cycle_id, _ = collector.open_cycle(conn, CYCLE_TIME, 'M5')
        n = collector.stage_statistics(conn, cycle_id, 'M5', Path(d), CYCLE_TIME, {})
        conn.row_factory = sqlite3.Row
        rows = conn.execute('SELECT * FROM indicator_statistics').fetchall()
    assert n == 1 and len(rows) == 1 and rows[0]['source'] == SOURCE
    r = rows[0]
    assert (r['sr_q25'], r['sr_q75'], r['sr_iqr'], r['sr_optimal_step']) == (4350.44, 4380.57, 30.13, 18.42)
    assert (r['sr_fractals_n'], r['sr_macro_clusters']) == (31, 6)
    assert (r['sr_nearest_resistance'], r['sr_nearest_support']) == (4285.90, 4275.36)
    assert (r['sr_dist_resistance_pts'], r['sr_dist_support_pts']) == (22, 1032)
    assert (r['window_span_bars'], r['math_lookback']) == (1082, 3000)
    assert (r['window_high'], r['window_low'], r['live_close']) == (4402.10, 4301.00, 4285.68)
    assert r['model_a_r2'] is None and r['uoedt_offset'] is None, 'regression fields must stay NULL'
    cfg = json.loads(r['config_params'])
    assert {'Calculation Mode', 'Window Mode', 'Min Touches Filter', 'Max Window Bars'} <= set(cfg)


def test_the_two_statistic_files_do_not_collide():
    """Each source reads only its own file; both land as separate rows."""
    with tempfile.TemporaryDirectory() as d:
        for prefix, step in (('SR_Levels', '11.11'), ('S_R_Levels', '22.22')):
            io.open(Path(d) / f'{prefix}_{collector.SYMBOL}_M5_Statistic.txt', 'w',
                    encoding='utf-8', newline='').write(
                _stat_file_from_mq5(dict(STAT_VALUES, **{'Optimal Step': step})))
        conn = fresh_db()
        cycle_id, _ = collector.open_cycle(conn, CYCLE_TIME, 'M5')
        collector.stage_statistics(conn, cycle_id, 'M5', Path(d), CYCLE_TIME, {})
        got = dict(conn.execute('SELECT source, sr_optimal_step FROM indicator_statistics'))
    assert got == {'sr_levels': 11.11, SOURCE: 22.22}, got


def test_stats_enum_is_closed_and_matches_stat_sources():
    """Closed enum + batched POST: a source the contract does not list 400s
    the WHOLE batch. The two must agree exactly."""
    contract = json.loads(STATS_CONTRACT.read_text(encoding='utf-8'))
    enum = contract['properties']['source']['enum']
    assert SOURCE in enum and len(enum) == 12, enum
    assert sorted(enum) == sorted(collector.STAT_SOURCES)
    assert contract['additionalProperties'] is False


def test_stats_row_pushes_through_the_worker_column_set():
    """Every column the collector stages for this source is one the worker sends."""
    conn = fresh_db()
    staged = {r[1] for r in conn.execute('PRAGMA table_info(indicator_statistics)')}
    sr_stats = {c for _l, s, c, _t in collector.STAT_FIELDS
                if s is not None and s.startswith('[SUPPORT-RESISTANCE')}
    assert sr_stats <= set(worker.STAT_COLUMNS) and sr_stats <= staged


# ============================================================
# 7. Wire contract
# ============================================================
def test_worker_contract_matches_the_gateway_schema_exactly():
    contract = json.loads(CONTRACT.read_text(encoding='utf-8'))
    fields = {k for k in contract['properties'] if not k.startswith('_')}
    assert fields == set(worker.EXPECTED_CONTRACT_FIELDS), fields ^ set(worker.EXPECTED_CONTRACT_FIELDS)
    assert len(fields) == 103
    assert contract['additionalProperties'] is False


def test_sr2_fields_are_nullable_and_optional():
    contract = json.loads(CONTRACT.read_text(encoding='utf-8'))
    for col in SR2_COLS:
        assert contract['properties'][col]['type'] == ['number', 'null'], col
        assert col not in contract['required'], col


def test_fresh_sqlite_matches_the_posted_contract():
    assert worker.verify_schema_contract(fresh_db()) is True


# ============================================================
# 8. Point-in-time snapshot lane
# ============================================================
def test_sr2_levels_is_snapshotted():
    assert SOURCE in pit.DRIFTING_SOURCES
    cols = pit.drifting_columns()
    assert len(cols) == 77, len(cols)
    assert cols[-8:] == SR2_COLS and cols[-16:-8] == SR1_COLS, cols[-16:]


def test_generated_model_files_sr2_columns_under_their_own_source():
    """Both sources write bare sr_<n>, so a name-prefix lookup would file
    sr_9..sr_16 under sr_levels. The label must come from the registry."""
    types = {c: 'Float?' for c in pit.drifting_columns()}
    model = pit.render_prisma(types, pit.drifting_columns_by_source())
    block = model[model.index('  // sr2_levels'):model.index('createdAt')]
    assert [l.split()[0] for l in block.strip().split('\n')[1:]] == SR2_COLS, block
    assert model.count('  // sr_levels') == 1


def test_both_prisma_schemas_carry_the_snapshot_columns():
    for path in (pit.APP_SCHEMA, pit.GATEWAY_SCHEMA):
        text = path.read_text(encoding='utf-8')
        for model in ('MarketDataV6', 'MarketDataPointInTime'):
            body = re.search(rf'model {model} \{{(.*?)\n\}}', text, re.S).group(1)
            declared = set(re.findall(r'\n  ([a-z_][a-zA-Z0-9_]*)\s+Float\?', body))
            assert set(SR2_COLS) <= declared, f'{path.parent.parent.name}:{model} lacks sr_9..sr_16'


def test_postgres_migration_is_additive_and_covers_both_tables():
    mig = (HERE.parents[2] / 'prisma' / 'migrations'
           / '20260922000000_add_market_data_v6_sr2_levels' / 'migration.sql')
    sql = ' '.join(l.split('--')[0] for l in mig.read_text(encoding='utf-8').splitlines())
    for table in ('market_data_v6', 'market_data_point_in_time'):
        m = re.search(rf'ALTER TABLE "{table}"(.*?);', sql, re.S)
        assert m, f'no ALTER for {table}'
        assert set(re.findall(r'ADD COLUMN\s+"(sr_\d+)" DOUBLE PRECISION', m.group(1))) == set(SR2_COLS)
    upper = sql.upper()
    assert 'DROP' not in upper and 'NOT NULL' not in upper and 'DEFAULT' not in upper


# ============================================================
# 9. Coexistence with the 14th indicator on one chart
# ============================================================
def _defines(path: Path) -> dict:
    code = _code(path)
    out = dict(re.findall(r'#define\s+(\w+_BUTTON_NAME)\s+"([^"]+)"', code))
    out['IndicatorName'] = re.search(r'input\s+string\s+IndicatorName\s*=\s*"([^"]+)"', code).group(1)
    out['InpExportFileName'] = re.search(r'input\s+string\s+InpExportFileName\s*=\s*"([^"]+)"', code).group(1)
    return out


def test_object_prefixes_cannot_delete_each_other():
    """ObjectsDeleteAll(0, prefix) matches by PREFIX -- neither name may be a
    prefix of the other, or one instance's cleanup erases the other's lines."""
    a, b = _defines(INDICATOR_14), _defines(INDICATOR)
    for key in ('IndicatorName', 'EXPORT_BUTTON_NAME', 'BACKFILL_BUTTON_NAME', 'InpExportFileName'):
        assert a[key] != b[key], key
        assert not a[key].startswith(b[key]) and not b[key].startswith(a[key]), (key, a[key], b[key])


def test_buttons_do_not_overlap():
    def margins(path):
        return [int(x) for x in re.findall(r'int x_margin\s*=\s*(\d+);', _code(path))]
    widths = [int(x) for x in re.findall(r'int button_width\s*=\s*(\d+);', _code(INDICATOR_14))]
    m14, m15 = margins(INDICATOR_14), margins(INDICATOR)
    assert m14 and m15 and widths, (m14, m15, widths)
    assert min(m15) >= max(m14) + max(widths), (m14, m15, widths)


def test_the_14th_indicators_four_fixes_carried_over():
    """Replicated from the 14th -- make sure it was replicated from the FIXED one
    (design doc 6.3 defects, closed 2026-09-20)."""
    code = _code(INDICATOR)
    assert 'is_backfill ? "_Backfill" : ""' in code, 'backfill writes the pipeline file'
    assert 'if(!is_backfill)\n      WriteSRStatFile(' in code, 'backfill rewrites the stat file'
    assert 'rates_total == prev_calculated' not in code, 'blanket intra-bar early return'
    assert 'string SRPriceToString(double value)' in code
    assert not re.findall(r'DoubleToString\s*\([^;\n]*?,\s*2\s*\)', code), 'hardcoded 2dp prices'
    assert 'int export_limit   = MathMin(requested_bars - 1, available_bars - 1);' in code
    assert 'for(int shift = export_limit; shift >= 0; shift--)' in code


def test_timestamps_use_the_fixed_gmt_offset():
    """TimeCurrent()-based offsets stamp a sub-bar phase on every row."""
    code = _code(INDICATOR)
    assert 'TimeCurrent() - TimeGMT()' not in code
    assert code.count('(long)TimeTradeServer() - (long)TimeGMT()') >= 1


# ============================================================
# 10. Golden: the 14th indicator's real captures, relabelled
# ============================================================
# No S_R_Levels capture exists yet. The 14th's real SR_Levels captures are the
# same engine's output, so relabelling their header sr_1..sr_8 -> sr_9..sr_16
# proves this registry parses real MetaTrader bytes with the same semantics.
GOLDEN = [HERE.parents[2] / 'excel-calculation' / sub / 'SR_Levels_XAUUSD_M5.txt'
          for sub in ('data-export', 'data-import-to-excel')]


def test_golden_relabelled_capture_honours_the_documented_semantics():
    files = [p for p in GOLDEN if p.exists()]
    if not files:
        return
    rename = {f'sr_{i}': f'sr_{i + 8}' for i in range(1, 9)}
    for path in files:
        lines = io.open(path, encoding='utf-8', newline='').read().split('\r\n')
        lines[0] = '\t'.join(rename.get(h, h) for h in lines[0].split('\t'))
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / 'S_R_Levels_XAUUSD_M5.txt'
            io.open(p, 'w', encoding='utf-8', newline='').write('\r\n'.join(lines))
            rows = collector.parse_export_file(p, collector.SOURCES[SOURCE], 'M5')
        assert len(rows) > 400, len(rows)
        for r in rows:
            sup = [r[c] for c in SR2_COLS[:4] if r[c] is not None]
            res = [r[c] for c in SR2_COLS[4:] if r[c] is not None]
            assert all(v < r['close'] for v in sup) and all(v > r['close'] for v in res)
            assert sup == sorted(sup, reverse=True) and res == sorted(res)
        assert any(r['sr_16'] is None for r in rows), 'unresolved-slot path not exercised'


if __name__ == '__main__':
    failures = 0
    for name, fn in sorted(globals().items()):
        if not name.startswith('test_') or not callable(fn):
            continue
        try:
            fn()
            print(f'PASS  {name}')
        except AssertionError as exc:
            failures += 1
            print(f'FAIL  {name}: {exc}')
        except Exception as exc:                        # noqa: BLE001
            failures += 1
            print(f'ERROR {name}: {type(exc).__name__}: {exc}')
    print(f'\n{"FAILED" if failures else "OK"} - {failures} failure(s)')
    sys.exit(1 if failures else 0)
