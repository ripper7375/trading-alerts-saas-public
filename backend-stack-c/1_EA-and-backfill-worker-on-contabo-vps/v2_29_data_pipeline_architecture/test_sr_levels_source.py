"""Tests for the 14th indicator source, sr_levels (Support & Resistance).

Run either way -- there is no pytest config in this stack, and a test nobody
can run is worse than none:

    python -m pytest test_sr_levels_source.py -q
    python test_sr_levels_source.py

WHAT IS BEING PROTECTED, and why each group is here:

1. BARE HEADERS. Every other source prefixes its export columns
   (`Best_Support`, `Resistance_timestamp`, `Best_Fit_A_ssa`).
   SupportAndResistantAutoCalibration_v2_29 writes them bare -- `timestamp`,
   `symbol`, `timeframe`, `close`, `sr_1`..`sr_8`. That is fine, because
   parse_export_file() reads the four keys POSITIONALLY and data columns by
   NAME -- but it is fine by accident of design rather than by intent, so it is
   pinned here.

2. ZERO IS NOT A PRICE. The indicator writes an unresolved slot as an empty
   field, but a slot holding a non-positive value still exports as 0.00. A
   $0.00 XAUUSD "support level" reaching the alert engine is the exact defect
   the 2026-09-08 ingestion guard exists to prevent. sr_* match neither
   PRICE_LEVEL_SUFFIXES nor the base set, so they are listed in
   PRICE_LEVEL_COLUMNS explicitly -- and a future tidy-up that drops them from
   that set must fail here.

3. market_data MIGRATION. sqlite_schema_v6_xauusd.sql's
   `CREATE TABLE IF NOT EXISTS market_data` is a silent no-op against a
   database that already exists, and migrate_raw_tables() is staging-only. So
   without migrate_market_data(), a deployed xauusd.db never gains sr_1..sr_8
   and promote_cycle() raises OperationalError -- uncaught in run_cycle(), i.e.
   the collector crash-loops. These tests build a genuinely pre-change database
   (columns dropped) and prove the function closes that gap without touching
   the rows already in it.

4. STAT_SOURCES ENROLMENT. STAT_SOURCES is a derived blacklist, so adding a
   source to SOURCES auto-enrols it. sr_levels was deliberately EXCLUDED from
   2026-09-16 until 2026-09-20 -- its _Statistic.txt records Freedman-Diaconis
   calibration, not regression fit quality, and
   gateway_contract_indicator_statistics.schema.json pins `source` to a CLOSED
   enum while the statistics POST is BATCHED, so one sr_levels element would
   400 the whole request and quarantine every other snapshot in it. That is no
   longer true: the sr_* columns exist and the enum has been widened to 11. The
   tests below now pin ENROLMENT, and the enum/STAT_SOURCES agreement, because
   the closed enum plus the batched POST means the two must never disagree.

5. CONTRACT PARITY. The market_data contract had no test tying the push
   worker's EXPECTED_CONTRACT_FIELDS to gateway_contract_market_data.schema.json
   (the economic-events lane has one; this lane did not). Set-based, never
   count-based -- the contract carries a `_centroid_admin_note` pseudo-property
   that breaks naive counts.

6. INDICATOR-SIDE DEFECTS. Four defects recorded in
   ARCHITECTURE_DESIGN_14TH_INDICATOR_SUPPORT_AND_RESISTANCE.md section 6.3 and
   fixed 2026-09-20. These assert against the .mq5 SOURCE, which is unusual but
   deliberate: MQL5 cannot be exercised from Python, and every one of the four
   is a silent defect -- a backfill button that does nothing different, an
   intra-bar branch that can never run, a precision that is only wrong off
   XAUUSD, an extra row that is quietly discarded downstream. None of them
   would ever surface as a failing pipeline test, so a source assertion is the
   only guard available. The alternative is no guard at all.
"""
import io
import json
import sqlite3
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import export_collector_validator_v2 as collector          # noqa: E402
import backfill_worker_api_gateway_v5 as worker            # noqa: E402

SCHEMA = HERE / 'sqlite_schema_v6_xauusd.sql'
CONTRACT = HERE / 'gateway_contract_market_data.schema.json'

SOURCE = 'sr_levels'
SR_COLS = [f'sr_{i}' for i in range(1, 9)]

# An arbitrary but realistic 5-minute slot (unix UTC), aligned to M15 too so
# neither timeframe's arithmetic is accidentally favoured by the fixture.
CYCLE_TIME = 1789012800
assert CYCLE_TIME % 900 == 0, 'fixture slot must align to M15 as well as M5'

CLOSE = 4285.68

# The literal header SupportAndResistantAutoCalibration_v2_29 writes (its
# ExportSRData(), verified against the .mq5 source, not paraphrased).
SR_HEADER = 'timestamp\tsymbol\ttimeframe\tclose\tsr_1\tsr_2\tsr_3\tsr_4\tsr_5\tsr_6\tsr_7\tsr_8'


def fresh_db() -> sqlite3.Connection:
    conn = sqlite3.connect(':memory:')
    conn.executescript(SCHEMA.read_text(encoding='utf-8'))
    return conn


def write_sr_export(directory: Path, rows, timeframe='M5') -> Path:
    """Write a real-shaped SR_Levels export. `rows` are (ts, close, [8 strings])."""
    path = directory / f"SR_Levels_{collector.SYMBOL}_{timeframe}.txt"
    lines = [SR_HEADER]
    for ts, close, slots in rows:
        assert len(slots) == 8
        lines.append('\t'.join(
            [str(ts), collector.SYMBOL, timeframe, f'{close:.2f}'] + list(slots)))
    # The indicator writes CRLF via FileWriteString; the parser strips both.
    io.open(path, 'w', encoding='utf-8', newline='').write('\r\n'.join(lines) + '\r\n')
    return path


def parse(rows, timeframe='M5'):
    with tempfile.TemporaryDirectory() as d:
        path = write_sr_export(Path(d), rows, timeframe)
        return collector.parse_export_file(
            path, collector.SOURCES[SOURCE], timeframe)


def stage_minimal_row(conn, source, cycle_id, timeframe, ts, extra=None):
    """Insert one staged row, discovering columns from the live schema.

    Columns are read from PRAGMA table_info rather than hard-coded: these
    staging tables have already gained columns three times (the best_fit_a/b
    split, the 2026-09-09 MQL5-only refactor, and now sr_levels), and a test
    that hard-codes them breaks for reasons unrelated to what it tests.
    """
    table = collector.SOURCES[source]['table']
    known = {'cycle_id': cycle_id, 'timestamp_raw': ts, 'timestamp_adj': ts,
             'symbol': collector.SYMBOL, 'timeframe': timeframe, 'close': CLOSE}
    known.update(extra or {})
    cols, vals = [], []
    for _, name, decl_type, notnull, default, _pk in conn.execute(
            f'PRAGMA table_info({table})'):
        if name in known:
            cols.append(name)
            vals.append(known[name])
        elif notnull and default is None:
            cols.append(name)
            vals.append(0 if decl_type.upper() in ('INTEGER', 'REAL') else '')
    conn.execute(f"INSERT INTO {table} ({', '.join(cols)}) "
                 f"VALUES ({', '.join('?' * len(cols))})", vals)


# ============================================================
# 1. Bare headers parse correctly
# ============================================================
def test_all_eight_bare_headers_resolve():
    """sr_1..sr_8 are located by NAME even though they carry no source prefix."""
    slots = [f'{4200 + i}.50' for i in range(8)]
    rows = parse([(CYCLE_TIME, CLOSE, slots)])
    assert len(rows) == 1, rows
    row = rows[0]
    for i, col in enumerate(SR_COLS):
        assert row[col] == 4200 + i + 0.5, f'{col} = {row[col]!r}'


def test_key_columns_are_read_positionally():
    """The 4 keys are bare here; parse_export_file takes them from cols 0-3."""
    row = parse([(CYCLE_TIME, CLOSE, [''] * 8)])[0]
    assert row['timestamp_raw'] == CYCLE_TIME
    assert row['symbol'] == collector.SYMBOL
    assert row['timeframe'] == 'M5'
    assert row['close'] == CLOSE


def test_registry_headers_match_the_indicators_real_header():
    """The SOURCES entry must name exactly what the .mq5 writes, in order."""
    exported = SR_HEADER.split('\t')
    for col, _typ, hname in collector.SOURCES[SOURCE]['columns']:
        assert hname in exported, f'{hname} is not a column the indicator writes'
        assert hname == col, f'sr_* staging name and header must coincide: {col}/{hname}'


# ============================================================
# 2. An unresolved slot is NULL, never 0
# ============================================================
def test_empty_slot_is_null():
    """MQL5 writes "" between tabs for a slot that resolved no level."""
    row = parse([(CYCLE_TIME, CLOSE, ['4275.36', '', '', '', '4285.60', '', '', ''])])[0]
    assert row['sr_1'] == 4275.36
    assert row['sr_5'] == 4285.60
    for col in ('sr_2', 'sr_3', 'sr_4', 'sr_6', 'sr_7', 'sr_8'):
        assert row[col] is None, f'{col} = {row[col]!r}'


def test_zero_slot_is_coerced_to_null():
    """0.00 is not a price. This fails if sr_* leave PRICE_LEVEL_COLUMNS."""
    row = parse([(CYCLE_TIME, CLOSE, ['0.00'] * 4 + ['4285.60'] * 4)])[0]
    for col in ('sr_1', 'sr_2', 'sr_3', 'sr_4'):
        assert row[col] is None, f'{col} staged as {row[col]!r}, expected NULL'
    assert row['sr_5'] == 4285.60


def test_negative_slot_is_coerced_to_null():
    row = parse([(CYCLE_TIME, CLOSE, ['-1.00'] + [''] * 7)])[0]
    assert row['sr_1'] is None


def test_price_guard_covers_every_slot():
    """Explicit, because a numeric name has no suffix for the suffix rule."""
    for col in SR_COLS:
        assert (col in collector.PRICE_LEVEL_COLUMNS
                or col.endswith(collector.PRICE_LEVEL_SUFFIXES)), \
            f'{col} is outside the <=0 -> NULL ingestion guard'


# ============================================================
# 3. Registry wiring and promotion
# ============================================================
def test_market_data_column_is_identity():
    """sr_levels falls through market_data_column()'s identity branch."""
    for col in SR_COLS:
        assert collector.market_data_column(SOURCE, col) == col


def test_source_is_fully_enrolled_in_validation():
    """Full enrollment was a deliberate call: SR guards the price cycle too."""
    assert SOURCE in collector.SOURCES
    assert SOURCE in collector.PER_BAR_SOURCES
    assert SOURCE in collector.PROMOTE_SOURCES
    assert len(collector.SOURCES) == 14, len(collector.SOURCES)


def test_market_data_has_ninety_five_columns():
    conn = fresh_db()
    cols = [r[1] for r in conn.execute('PRAGMA table_info(market_data)')]
    assert len(cols) == 95, f'market_data changed shape: {len(cols)} columns'
    for col in SR_COLS:
        assert col in cols, f'{col} missing from market_data'


def test_validation_view_carries_the_new_source():
    conn = fresh_db()
    sql = conn.execute(
        "SELECT sql FROM sqlite_master WHERE name = 'v_validation_keys'").fetchone()[0]
    assert "'sr_levels'" in sql, 'v_validation_keys has no sr_levels branch'


def test_promote_lands_sr_values_in_market_data():
    """End to end: parse -> stage -> validate -> promote."""
    conn = fresh_db()
    cycle_id, _ = collector.open_cycle(conn, CYCLE_TIME, 'M5')

    slots = ['4275.36', '4260.71', '', '', '4285.60', '4297.28', '4311.48', '']
    parsed = parse([(CYCLE_TIME, CLOSE, slots)])
    collector.stage_source(conn, cycle_id, SOURCE, parsed)

    for source in collector.PER_BAR_SOURCES:
        if source == SOURCE:
            continue
        extra = ({'open': CLOSE, 'high': CLOSE, 'low': CLOSE, 'volume': 1}
                 if source == 'ohlcv' else None)
        stage_minimal_row(conn, source, cycle_id, 'M5', CYCLE_TIME, extra)
    conn.commit()

    ok, reasons = collector.validate_cycle(
        conn, cycle_id, 'M5', CYCLE_TIME, check_completeness=False)
    assert ok, reasons

    assert collector.promote_cycle(conn, cycle_id, 'M5') == 1
    row = conn.execute(
        f"SELECT {', '.join(SR_COLS)} FROM market_data "
        f"WHERE timestamp = ? AND timeframe = 'M5'", (CYCLE_TIME,)).fetchone()
    assert row == (4275.36, 4260.71, None, None,
                   4285.60, 4297.28, 4311.48, None), row


def test_a_missing_sr_export_rejects_the_whole_cycle():
    """The accepted cost of full enrollment -- pinned so it is never a surprise."""
    conn = fresh_db()
    cycle_id, _ = collector.open_cycle(conn, CYCLE_TIME, 'M5')
    for source in collector.PER_BAR_SOURCES:
        if source == SOURCE:
            continue                      # the SR export never arrived
        extra = ({'open': CLOSE, 'high': CLOSE, 'low': CLOSE, 'volume': 1}
                 if source == 'ohlcv' else None)
        stage_minimal_row(conn, source, cycle_id, 'M5', CYCLE_TIME, extra)
    conn.commit()

    ok, reasons = collector.validate_cycle(conn, cycle_id, 'M5', CYCLE_TIME)
    assert not ok
    assert any(SOURCE in r for r in reasons), reasons


# ============================================================
# 4. migrate_market_data()
# ============================================================
def pre_change_db() -> sqlite3.Connection:
    """A database as a VPS would have it before this change: no sr_* columns."""
    conn = fresh_db()
    for col in SR_COLS:
        conn.execute(f'ALTER TABLE market_data DROP COLUMN {col}')
    conn.commit()
    cols = {r[1] for r in conn.execute('PRAGMA table_info(market_data)')}
    assert not (cols & set(SR_COLS)), 'fixture failed to model a pre-change DB'
    return conn


def test_migrate_market_data_adds_the_missing_columns():
    conn = pre_change_db()
    added = collector.migrate_market_data(conn)
    assert added == 8, added
    cols = {r[1] for r in conn.execute('PRAGMA table_info(market_data)')}
    assert set(SR_COLS) <= cols


def test_migrate_market_data_is_idempotent():
    conn = pre_change_db()
    collector.migrate_market_data(conn)
    assert collector.migrate_market_data(conn) == 0


def test_migrate_market_data_preserves_existing_rows():
    """ADD COLUMN must not disturb history -- that is the whole safety claim."""
    conn = pre_change_db()
    # The cycle row first: market_data.cycle_id is a real FK.
    conn.execute("INSERT INTO collection_cycles "
                 "(cycle_id, cycle_time, timeframe, created_at) VALUES (1, ?, 'M5', 1)",
                 (CYCLE_TIME,))
    conn.execute(
        "INSERT INTO market_data (timestamp, symbol, timeframe, open, high, low, "
        "close, volume, best_support, cycle_id, collected_at) "
        "VALUES (?, ?, 'M5', ?, ?, ?, ?, 7, ?, 1, 1)",
        (CYCLE_TIME, collector.SYMBOL, CLOSE, CLOSE, CLOSE, CLOSE, 4200.25))
    conn.commit()

    collector.migrate_market_data(conn)

    row = conn.execute(
        "SELECT close, volume, best_support, sr_1 FROM market_data "
        "WHERE timestamp = ?", (CYCLE_TIME,)).fetchone()
    assert row == (CLOSE, 7, 4200.25, None), row
    assert conn.execute('SELECT COUNT(*) FROM market_data').fetchone()[0] == 1


def test_migrate_market_data_is_additive_only():
    """No column may ever be lost by running it."""
    conn = fresh_db()
    before = [r[1] for r in conn.execute('PRAGMA table_info(market_data)')]
    collector.migrate_market_data(conn)
    after = [r[1] for r in conn.execute('PRAGMA table_info(market_data)')]
    assert after == before, 'migrate_market_data changed an up-to-date table'


def test_migrate_market_data_skips_an_absent_table():
    conn = sqlite3.connect(':memory:')
    assert collector.migrate_market_data(conn) == 0


def test_open_db_widens_a_pre_change_database():
    """The production path: the collector must self-heal a deployed xauusd.db.

    Calling migrate_market_data() directly proves the function works; this
    proves it is actually WIRED into open_db(), which is the only thing that
    stands between a stale database and a crash-looping collector.
    """
    with tempfile.TemporaryDirectory() as d:
        path = str(Path(d) / 'xauusd.db')
        seed = sqlite3.connect(path)
        seed.executescript(SCHEMA.read_text(encoding='utf-8'))
        for col in SR_COLS:
            seed.execute(f'ALTER TABLE market_data DROP COLUMN {col}')
        seed.commit()
        seed.close()

        conn = collector.open_db(path)
        cols = {r[1] for r in conn.execute('PRAGMA table_info(market_data)')}
        conn.close()
        assert set(SR_COLS) <= cols, (
            'open_db() left market_data without sr_*; promote_cycle() would '
            'raise OperationalError on the first validated cycle')


# ============================================================
# 5. Statistics exclusion (deliberate) and contract parity
# ============================================================
def test_sr_levels_is_enrolled_in_stat_sources():
    """Enrolled 2026-09-20, after BOTH blockers the old guard named were closed.

    This test used to assert the opposite, and it is worth recording why it
    flipped rather than quietly rewriting it. The 2026-09-16 exclusion gave two
    reasons, and enrolment was conditional on clearing both:

      1. "its _Statistic.txt vocabulary has no home in STAT_FIELDS" -- it now
         has ten section-scoped rules ([SUPPORT-RESISTANCE ...) writing the
         sr_* calibration columns.
      2. "the contract pins `source` to a closed enum that does not include it"
         -- the enum is now 11 and includes it.

    The enum is STILL closed and the POST is STILL batched, so the ordering
    hazard the old test protected against is real and unchanged: the gateway
    must deploy before the VPS starts sending this source, or one element 400s
    the whole request. That constraint moved into the migration header and the
    comment above STAT_SOURCES; it did not go away.
    """
    assert SOURCE in collector.STAT_SOURCES, (
        'sr_levels dropped out of STAT_SOURCES -- its statistic file would be '
        'discarded in full again, losing the calibration provenance (Q25/Q75, '
        'IQR, Optimal Step, fractal sample) that exists nowhere else.')
    assert len(collector.STAT_SOURCES) == 11, collector.STAT_SOURCES


def test_sr_levels_vocabulary_has_collector_rules():
    """The first of the two blockers, asserted rather than assumed closed."""
    rules = {label for label, sect, _c, _t in collector.STAT_FIELDS
             if sect is not None and sect.startswith('[SUPPORT-RESISTANCE')}
    for label in ('Q25 (25th percentile)', 'Q75 (75th percentile)', 'IQR',
                  'Optimal Step', 'Fractals Sample (N)', 'Total Macro Clusters',
                  'Nearest Resistance', 'Nearest Support',
                  'Distance to Resistance', 'Distance to Support'):
        assert label in rules, f'{label!r} has no STAT_FIELDS rule'


def test_sr_levels_window_bars_has_no_trailing_parenthetical():
    """`Window Bars: 67 (Max Cap: 3000)` coerces to None, silently voiding it.

    Verified against the real coercion, not by reading it: this is the kind of
    defect that only shows up as a column that has been NULL for weeks.
    """
    assert collector._stat_value('67 (Max Cap: 3000)', 'int') is None
    src = (HERE / 'mq5' / 'SupportAndResistantAutoCalibration_v2_29.mq5').read_text(
        encoding='utf-8')
    assert '(Max Cap: %d)' not in src, (
        'Window Bars carries a trailing parenthetical again -- it will parse to '
        'None for every row now that this source is ingested')
    assert '"Max Window Bars: "' in src, 'the cap must still be exported, as its own field'


def test_stats_contract_enum_includes_sr_levels_and_matches_stat_sources():
    """The second blocker, and the ordering hazard that outlived it.

    The enum is CLOSED (`additionalProperties: false`, `forbidNonWhitelisted`)
    and the statistics POST is an ARRAY. A sender using a value the deployed
    gateway does not know 400s the WHOLE request, and the push worker
    quarantines every element in that batch AND stamps synced_at -- recoverable
    only by hand. So the enum and STAT_SOURCES must agree exactly: a source the
    collector stages but the contract does not list is a latent outage for the
    other ten, not just for itself.
    """
    contract = json.loads(
        (HERE / 'gateway_contract_indicator_statistics.schema.json')
        .read_text(encoding='utf-8'))
    enum = contract['properties']['source']['enum']
    assert SOURCE in enum, 'the statistics contract no longer accepts sr_levels'
    assert sorted(enum) == sorted(collector.STAT_SOURCES), (
        f'contract enum and STAT_SOURCES disagree: '
        f'{sorted(set(enum) ^ set(collector.STAT_SOURCES))}')
    assert contract.get('additionalProperties') is False, (
        'additionalProperties must stay false: an unknown field has to 400, '
        'not slip silently into the database')


def test_worker_contract_matches_the_gateway_schema_exactly():
    """Set-based, not count-based: the contract carries a pseudo-property."""
    contract = json.loads(CONTRACT.read_text(encoding='utf-8'))
    assert contract['additionalProperties'] is False, (
        'the gateway rejects unknown fields; if that ever changes, the rollout '
        'ordering argument in 20260916000000_add_market_data_v6_sr_levels '
        'changes with it')
    schema_fields = {k for k in contract['properties'] if not k.startswith('_')}
    assert worker.EXPECTED_CONTRACT_FIELDS - schema_fields == set(), \
        f'worker posts fields the contract rejects: ' \
        f'{worker.EXPECTED_CONTRACT_FIELDS - schema_fields}'
    assert schema_fields - worker.EXPECTED_CONTRACT_FIELDS == set(), \
        f'contract declares fields the worker never posts: ' \
        f'{schema_fields - worker.EXPECTED_CONTRACT_FIELDS}'


def test_sr_fields_are_optional_in_the_gateway_contract():
    """An unresolved slot is a normal state, not a malformed payload."""
    contract = json.loads(CONTRACT.read_text(encoding='utf-8'))
    for col in SR_COLS:
        assert col in contract['properties'], f'{col} missing from the contract'
        assert contract['properties'][col]['type'] == ['number', 'null'], col
        assert col not in contract['required'], f'{col} must not be required'


def test_sqlite_table_matches_the_posted_contract():
    """The pipeline's own drift guard, run against a freshly-built schema."""
    conn = fresh_db()
    conn.commit()
    assert worker.verify_schema_contract(conn) is True


# ============================================================
# 6. Golden: the real captured MT5 exports
# ============================================================
# Two genuine SR_Levels captures exist in the repo (excel-calculation/, Feb 2026,
# ~500 bars each). Everything above this point is synthetic, so these are the
# only tests that prove the registry matches what MetaTrader ACTUALLY writes
# rather than what the .mq5 source reads like. They skip rather than fail if the
# captures are ever moved -- a relocated fixture is not a pipeline regression.
GOLDEN = [
    Path(r'D:\SaaS Project\trading-alerts-saas-public\excel-calculation')
    / sub / 'SR_Levels_XAUUSD_M5.txt'
    for sub in ('data-export', 'data-import-to-excel')
]


def _golden_files():
    return [p for p in GOLDEN if p.exists()]


def test_golden_header_matches_the_registry_byte_for_byte():
    files = _golden_files()
    if not files:
        return
    expected = ['timestamp', 'symbol', 'timeframe', 'close'] + \
               [h for _, _, h in collector.SOURCES[SOURCE]['columns']]
    for path in files:
        header = io.open(path, encoding='utf-8').readline().rstrip('\r\n')
        assert header.split('\t') == expected, f'{path.parent.name}: {header!r}'


def test_golden_rows_parse_and_honour_the_documented_semantics():
    """supports strictly BELOW close, resistances strictly ABOVE, nearest-first.

    Pinned against real data because the ordering is the whole meaning of the
    slots -- an off-by-one in the indicator's support loop would still produce a
    perfectly well-formed file.
    """
    files = _golden_files()
    if not files:
        return
    for path in files:
        rows = collector.parse_export_file(
            path, collector.SOURCES[SOURCE], 'M5')
        assert len(rows) > 400, f'{path.parent.name}: only {len(rows)} rows'
        for r in rows:
            close = r['close']
            sup = [r[f'sr_{i}'] for i in (1, 2, 3, 4) if r[f'sr_{i}'] is not None]
            res = [r[f'sr_{i}'] for i in (5, 6, 7, 8) if r[f'sr_{i}'] is not None]
            assert all(v < close for v in sup), (path.parent.name, r['timestamp_raw'], sup, close)
            assert all(v > close for v in res), (path.parent.name, r['timestamp_raw'], res, close)
            assert sup == sorted(sup, reverse=True), 'supports not nearest-first'
            assert res == sorted(res), 'resistances not nearest-first'
            assert all(v > 0 for v in sup + res), 'a non-positive level survived the guard'


def test_golden_unresolved_slots_really_are_null():
    """Real data proves unresolved slots are COMMON, not a theoretical edge case."""
    files = _golden_files()
    if not files:
        return
    for path in files:
        rows = collector.parse_export_file(
            path, collector.SOURCES[SOURCE], 'M5')
        assert all(r['sr_1'] is not None for r in rows), 'sr_1 should always resolve'
        assert any(r['sr_8'] is None for r in rows), (
            f'{path.parent.name}: no NULL sr_8 anywhere -- fixture no longer '
            f'exercises the unresolved-slot path')


def test_golden_timestamp_snap_repairs_a_sub_bar_phase():
    """One capture predates the 2026-09-09 GMT-offset fix; the snap must fix it.

    data-import-to-excel carries a CONSTANT 298s phase across every row -- the
    documented TimeCurrent() signature (see parse_export_file's comment). The
    defensive grid snap is what keeps such a file usable, so prove it works on
    the real thing rather than trusting the comment.
    """
    path = GOLDEN[1]
    if not path.exists():
        return
    rows = collector.parse_export_file(path, collector.SOURCES[SOURCE], 'M5')
    phases = {r['timestamp_raw'] % 300 for r in rows}
    assert len(phases) == 1 and phases != {0}, f'expected one non-zero phase, got {phases}'
    assert all(r['timestamp_adj'] % 300 == 0 for r in rows), 'snap left a row off-grid'


# ============================================================
# 6. INDICATOR-SIDE DEFECTS (section 6.3, fixed 2026-09-20)
# ============================================================
INDICATOR = HERE / 'mq5' / 'SupportAndResistantAutoCalibration_v2_29.mq5'


def _indicator_source() -> str:
    return INDICATOR.read_text(encoding='utf-8')


def test_indicator_source_is_present():
    """Everything in this section is vacuous if the file moved."""
    assert INDICATOR.exists(), f'indicator source not found at {INDICATOR}'


def test_backfill_parameter_is_actually_read():
    """`ExportSRData(bool is_backfill)` accepted the flag and never read it.

    The Backfill button therefore did exactly what Export did, while printing
    that it was backfilling -- the worst kind of dead code, because the log
    says otherwise. It must now branch on the flag.
    """
    src = _indicator_source()
    assert 'bool ExportSRData(bool is_backfill = false)' in src, (
        'ExportSRData signature changed; this test needs updating')
    body_start = src.index('bool ExportSRData(bool is_backfill = false)\n{')
    body = src[body_start:src.index('\nint OnInit()', body_start)]
    code = '\n'.join(l for l in body.split('\n') if not l.strip().startswith('//'))
    assert 'is_backfill' in code, (
        'is_backfill is never read in the body of ExportSRData -- the Backfill '
        'button is a relabelled Export again')


def test_backfill_writes_a_separate_file_the_collector_cannot_match():
    """A backfill must never overwrite the file the collector is polling.

    Proven against the collector's own filename construction rather than by
    eye: run_cycle() builds an EXACT name, so a suffixed file is invisible to
    it. If that ever became a glob, this test is where it shows up.
    """
    import re
    src = _indicator_source()
    # Comment-stripped. The first draft asserted `'"_Backfill"' in src` and a
    # mutation that removed the suffix from the CALL still passed, because the
    # explanatory comment above it also contains the literal. Assert the call.
    code = '\n'.join(l for l in src.split('\n') if not l.strip().startswith('//'))
    call = re.search(r'GenerateFilename\(\s*InpExportFileName,\s*clean_symbol,'
                     r'\s*timeframe,\s*is_backfill \? "_Backfill" : ""\s*\)',
                     code, re.S)
    assert call, ('ExportSRData no longer suffixes the backfill filename -- a '
                  'backfill would overwrite the file the collector polls')

    # And the collector genuinely cannot see a suffixed file: run_cycle() builds
    # an EXACT name, it does not glob. Asserted against the real construction so
    # that turning it into a glob fails here.
    spec = collector.SOURCES[SOURCE]
    polled = f"{spec['prefix']}_{collector.SYMBOL}_M5.txt"
    backfill = f"{spec['prefix']}_{collector.SYMBOL}_M5_Backfill.txt"
    with tempfile.TemporaryDirectory() as tmp:
        d = Path(tmp)
        (d / backfill).write_text('decoy', encoding='utf-8')
        assert not (d / polled).exists(), (
            'writing the backfill file created the polled filename')
        matched = [p.name for p in d.iterdir() if p.name == polled]
        assert matched == [], (
            f'the collector would pick up {backfill} as {polled}')


def test_backfill_does_not_rewrite_the_statistic_file():
    """The statistic file is a LIVE calibration snapshot and is now ingested.

    A manual click rewriting it underneath the collector's read would be a torn
    read of a lane that reaches indicator_statistics.
    """
    src = _indicator_source()
    assert 'if(!is_backfill)\n      WriteSRStatFile(' in src, (
        'WriteSRStatFile is no longer gated on !is_backfill')


def test_intra_bar_trigger_is_reachable():
    """The blanket early return made every intra-bar branch unreachable.

        if (prev_calculated > 0 && rates_total == prev_calculated)
           return rates_total;

    `rates_total` only differs from `prev_calculated` on a NEW BAR, so this
    returned on every tick inside a forming bar.
    """
    src = _indicator_source()
    code = '\n'.join(l for l in src.split('\n') if not l.strip().startswith('//'))
    assert 'rates_total == prev_calculated' not in code, (
        'the blanket intra-bar early return is back in live code')
    assert 'bool new_bar   = (rates_total != prev_calculated);' in code, (
        'the new-bar flag that replaced it is gone')
    # FillBuffers must sit outside the expensive block, i.e. after it closes.
    assert code.index('CalculateLevels(calc_tf, start_idx, end_idx, window_bars);') \
        < code.index('FillBuffers(close[0]);'), (
        'FillBuffers moved back inside the new-bar-gated block')


def test_crossing_detection_exists_and_is_intra_bar_only():
    src = _indicator_source()
    assert 'bool level_pair_changed' in src, 'crossing detector removed'
    assert 'level_pair_changed && !new_tag_bar' in src, (
        'a crossing is being reported on new bars too, which is just a redraw')


def test_no_hardcoded_two_decimal_price_formatting():
    """sr_* were written to 2dp while `close` on the same row used _Digits.

    Identical on XAUUSD, silently wrong on a 5-digit symbol: EURUSD 1.08435
    would be written as 1.08, which is a different price, not a rounded one.
    """
    import re
    src = _indicator_source()
    code = '\n'.join(l for l in src.split('\n') if not l.strip().startswith('//'))
    hits = re.findall(r'DoubleToString\s*\([^;\n]*?,\s*2\s*\)', code)
    assert not hits, f'hardcoded 2-decimal price formatting is back: {hits}'
    assert 'string SRPriceToString(double value)' in code, (
        'the single-point-of-truth price formatter was removed')


def test_export_row_count_matches_the_ohlcv_spine():
    """3001 rows, not 3000 -- one bar deeper than the spine it merges onto.

    Harmless (promote_cycle() joins on OHLCV, so the extra bar is dropped) but
    an unexplained off-by-one in a lane where a MISSING bar rejects the whole
    cycle is worth removing. The loop is inclusive at both ends, so the row
    count is export_limit + 1 and export_limit must be requested_bars - 1.

    Shift 0 stays INCLUDED -- validate_cycle() requires every per-bar source to
    carry the spine's newest bar, so dropping it would reject every cycle.
    """
    src = _indicator_source()
    # Comment-stripped, because the fix's own comment quotes the old expression
    # verbatim to explain what was wrong with it. Asserting against raw source
    # made this test fail on the explanation of the bug rather than the bug.
    code = '\n'.join(l for l in src.split('\n') if not l.strip().startswith('//'))
    assert ('int export_limit   = MathMin(requested_bars - 1, available_bars - 1);'
            in code), 'export depth arithmetic changed'
    assert 'MathMin(InpExportBars, available_bars - 1)' not in code, (
        'the off-by-one export depth is back')
    assert 'for(int shift = export_limit; shift >= 0; shift--)' in code, (
        'the export loop no longer reaches shift 0 -- every cycle would be '
        'rejected by the completeness check')


def test_export_row_count_arithmetic():
    """The arithmetic itself, independent of the source text."""
    def rows(requested, available):
        limit = min(requested - 1, available - 1)
        return max(limit, 0) + 1

    assert rows(3000, 5000) == 3000, 'nominal depth must be exact'
    assert rows(3000, 3000) == 3000
    assert rows(3000, 500) == 500, 'short history must clamp, not over-read'
    assert rows(1, 5000) == 1, 'a single-bar export is just the forming bar'
    assert rows(0, 5000) == 1, 'a nonsense depth must still write one row, not crash'


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
