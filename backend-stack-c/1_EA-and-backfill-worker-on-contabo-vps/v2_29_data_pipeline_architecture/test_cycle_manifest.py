"""Tests for the cycle manifest (ADR-009; build step 2 part 3): what the
collector records, what the push worker builds from it, the contract the gateway
will validate it against, and how it is delivered.

Run either way (there is no pytest config in this stack; the contract tests need
the `jsonschema` package, which is on the dev box):

    python test_cycle_manifest.py
    python -m pytest test_cycle_manifest.py -q

A manifest is the instrument the first real cycles will be measured with, and
Davin's decision for it is specific: report the export FILE's modification time
and the newest bar's open time, and the attempts each collection cycle needed.
The failure modes worth testing are the silent ones:

  * an export time that is really something else (the "Export Time:" line inside
    an export is the last tick's broker time, not when the file was written);
  * a manifest sent before the bars it describes, or before the statistics are
    staged, so the gateway sees a partial slot as complete;
  * a manifest lost because the gateway did not know the endpoint yet (a 404 must
    be a retry, never a quarantine);
  * the collector and the push worker disagreeing about a column, which on a
    deployed database is an uncaught OperationalError.

test_end_to_end_collector_to_manifest_to_contract is the load-bearing test: it
runs the REAL collector over synthetic export files and feeds the database it
produced to the REAL push worker, then validates what the worker sends.
"""
import copy
import json
import os
import sqlite3
import sys
import tempfile
import time
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent))

from cycle_test_support import (  # noqa: E402
    CENTROID_SOURCES, FakeSession, SCHEMA, SLOT_PLAIN, SLOT_REFRESH, add_bars, add_cycle, add_stats,
    always, build_world, captured_warnings, collector, fresh_db, isolated_worker, worker)

try:
    import jsonschema
except ImportError:                                     # pragma: no cover
    jsonschema = None

HERE = Path(__file__).resolve().parent
CONTRACT_PATH = HERE / 'gateway_contract_cycle_manifest.schema.json'
CONTRACT = json.loads(CONTRACT_PATH.read_text(encoding='utf-8'))


def validator():
    assert jsonschema is not None, 'the contract tests need the jsonschema package (pip install jsonschema)'
    return jsonschema.Draft202012Validator(CONTRACT)


def errors_of(manifest):
    return sorted(validator().iter_errors(manifest), key=lambda e: list(e.path))


def a_manifest(slot=SLOT_REFRESH, **world):
    """The manifest the worker builds for a freshly built world."""
    conn, info = build_world(slot, **world)
    manifest = worker.build_manifest(conn, slot, slot + 60)
    return conn, info, manifest


# ============================================================
# The collector: schema, migration, stamping
# ============================================================
def test_fresh_database_has_the_fact_columns_and_the_manifest_outbox():
    conn = fresh_db()
    cycle_cols = {r[1] for r in conn.execute("PRAGMA table_info(collection_cycles)")}
    assert {c for c, _ in collector.CYCLE_FACT_COLUMNS} <= cycle_cols
    assert worker.CYCLE_FACT_COLUMNS == {c for c, _ in collector.CYCLE_FACT_COLUMNS}, \
        'the worker and the collector disagree about which columns the manifest needs'
    assert {r[1] for r in conn.execute("PRAGMA table_info(cycle_manifests)")} == {
        'slot', 'payload', 'created_at', 'synced_at', 'send_attempts', 'last_error'}
    assert worker.manifest_table_available(conn)


def old_cycles_table(conn):
    conn.execute("PRAGMA foreign_keys = OFF")
    conn.executescript("""
        DROP TABLE collection_cycles;
        CREATE TABLE collection_cycles (
            cycle_id INTEGER PRIMARY KEY AUTOINCREMENT, cycle_time INTEGER NOT NULL,
            timeframe TEXT NOT NULL CHECK (timeframe IN ('M5', 'M15')),
            attempt INTEGER NOT NULL DEFAULT 1,
            status TEXT NOT NULL DEFAULT 'collecting'
                CHECK (status IN ('collecting', 'validating', 'validated', 'rejected')),
            sources_received INTEGER NOT NULL DEFAULT 0, rejected_reason TEXT,
            created_at INTEGER NOT NULL, validated_at INTEGER,
            UNIQUE (cycle_time, timeframe, attempt));
        INSERT INTO collection_cycles (cycle_time, timeframe, attempt, status, sources_received, created_at, validated_at)
            VALUES (1789764900, 'M5', 2, 'validated', 15, 1789764905, 1789764930);
    """)


def test_migrate_cycles_table_widens_an_old_table_and_keeps_its_rows():
    conn = fresh_db()
    old_cycles_table(conn)
    assert collector.migrate_cycles_table(conn) == 4
    cols = {r[1] for r in conn.execute("PRAGMA table_info(collection_cycles)")}
    assert {c for c, _ in collector.CYCLE_FACT_COLUMNS} <= cols
    row = conn.execute("SELECT attempt, status, created_at, validated_at, export_dir, export_mtime, "
                       "newest_bar_ts, finished_at FROM collection_cycles").fetchone()
    assert row == (2, 'validated', 1789764905, 1789764930, None, None, None, None), \
        'existing history must keep every value and read NULL for the new facts'
    assert collector.migrate_cycles_table(conn) == 0, 'the migration must be idempotent'


def test_migrate_cycles_table_adds_nothing_to_a_fresh_database():
    assert collector.migrate_cycles_table(fresh_db()) == 0


def test_open_db_widens_an_existing_database_file():
    """The startup path: a collector restarted over the VPS's old xauusd.db must
    come up with the columns, or its first validated cycle raises uncaught."""
    if sqlite3.sqlite_version_info < (3, 35):
        return                                          # DROP COLUMN needs SQLite 3.35
    with tempfile.TemporaryDirectory() as d:
        path = str(Path(d) / 'xauusd.db')
        conn = sqlite3.connect(path)
        conn.executescript(SCHEMA.read_text(encoding='utf-8'))
        for col, _ in collector.CYCLE_FACT_COLUMNS:
            conn.execute(f"ALTER TABLE collection_cycles DROP COLUMN {col}")
        conn.execute("DROP TABLE cycle_manifests")
        conn.commit()
        conn.close()

        widened = collector.open_db(path)
        try:
            cols = {r[1] for r in widened.execute("PRAGMA table_info(collection_cycles)")}
            assert {c for c, _ in collector.CYCLE_FACT_COLUMNS} <= cols
            assert worker.manifest_table_available(widened), 'open_db must create the outbox too'
        finally:
            widened.close()


def test_manifest_outbox_keeps_a_week_and_no_more():
    conn = fresh_db()
    now = 1789765200
    for slot in (now - 605100, now - 604800, now - 300):
        conn.execute("INSERT INTO cycle_manifests (slot, payload, created_at) VALUES (?, '{}', ?)", (slot, slot))
    conn.execute("INSERT INTO cycle_manifests (slot, payload, created_at) VALUES (?, '{}', ?)", (now, now))
    kept = sorted(r[0] for r in conn.execute("SELECT slot FROM cycle_manifests"))
    assert kept == [now - 604800, now - 300, now], kept


# ---- stamping, through the real run_cycle ----------------------------------------
def sample_value(col, typ):
    return {'real': '2650.5', 'int': '1'}.get(typ, 'Peak')


def write_exports(export_dir: Path, timeframe: str, newest_bar: int, bars=3, omit=(), mtime=None):
    """A complete set of synthetic export files for one timeframe, in the real
    format: tab-separated, first line the header, key columns first, the rest
    found by header name. Returns the OHLCV file (the spine) so a test can read
    or set its modification time."""
    step = collector.TF_SECONDS[timeframe]
    spine = None
    for source, spec in collector.SOURCES.items():
        if source in omit:
            continue
        headers = ['ts', 'symbol', 'timeframe', 'close'] + [h for _, _, h in spec['columns']]
        lines = ['\t'.join(headers)]
        for i in range(bars):
            ts = newest_bar - (bars - 1 - i) * step
            lines.append('\t'.join([str(ts), collector.SYMBOL, timeframe, '2650.55'] +
                                   [sample_value(c, t) for c, t, _ in spec['columns']]))
        path = export_dir / f"{spec['prefix']}_{collector.SYMBOL}_{timeframe}.txt"
        path.write_text('\n'.join(lines) + '\n', encoding='utf-8')
        if mtime is not None:
            # The OHLCV spine gets `mtime`; every other file is older. Distinct
            # times are the point: a collector that read the wrong file's time
            # would otherwise be indistinguishable from the right one.
            stamp = mtime if source == 'ohlcv' else mtime - 11
            os.utime(path, (stamp, stamp))
        if source == 'ohlcv':
            spine = path
    return spine


def write_statistic(export_dir: Path, source: str, timeframe: str, mode: str):
    path = export_dir / f"{collector.SOURCES[source]['prefix']}_{collector.SYMBOL}_{timeframe}_Statistic.txt"
    path.write_text(f"Observation Window: 1450\nProjection Mode: {mode}\n", encoding='utf-8')


def terminal_dir(tmp: Path) -> Path:
    d = tmp / 'MT5-A' / 'MQL5' / 'Files'
    d.mkdir(parents=True)
    return d


def test_run_cycle_stamps_the_export_time_the_newest_bar_and_the_finish():
    with tempfile.TemporaryDirectory() as d:
        export_dir = terminal_dir(Path(d))
        newest = SLOT_PLAIN - 300
        exported_at = SLOT_PLAIN - 1                       # written at xx:54:59, one second before the slot
        write_exports(export_dir, 'M5', newest, mtime=exported_at)
        conn = fresh_db()

        before = int(time.time())
        assert collector.run_cycle(conn, export_dir, 'M5', SLOT_PLAIN)
        after = int(time.time())

        row = conn.execute(
            "SELECT status, attempt, export_dir, export_mtime, newest_bar_ts, validated_at, finished_at "
            "FROM collection_cycles").fetchone()
        status, attempt, edir, mtime, newest_ts, validated_at, finished_at = row
        assert (status, attempt) == ('validated', 1)
        assert mtime == exported_at, 'export_mtime must be the OHLCV file\'s own modification time'
        assert newest_ts == newest, 'newest_bar_ts must be the open time of the newest exported bar'
        assert edir == str(export_dir)
        assert before <= validated_at <= after and before <= finished_at <= after
        assert validated_at <= finished_at, 'finished (statistics staged) cannot precede validated'


def test_the_cycles_export_time_is_the_spines_mtime_and_not_another_files():
    """Every export of a cycle is written at its own moment (the indicators each
    fire at second 59 of the minute). The cycle's export time is the OHLCV
    spine's, the file whose newest bar is newest_bar_ts, not whichever file
    happens to be read last or first."""
    with tempfile.TemporaryDirectory() as d:
        export_dir = terminal_dir(Path(d))
        write_exports(export_dir, 'M5', SLOT_PLAIN - 300, mtime=SLOT_PLAIN - 1)
        others = {p.stat().st_mtime for p in export_dir.iterdir() if not p.name.startswith('OHLCV')}
        assert others == {SLOT_PLAIN - 12}, 'the fixture must give the other files a different time'
        conn = fresh_db()
        assert collector.run_cycle(conn, export_dir, 'M5', SLOT_PLAIN)
        assert conn.execute("SELECT export_mtime FROM collection_cycles").fetchone()[0] == SLOT_PLAIN - 1


def test_export_file_mtime_is_whole_seconds_and_missing_is_none_not_a_guess():
    with tempfile.TemporaryDirectory() as d:
        path = Path(d) / 'OHLCV_XAUUSD_M5.txt'
        path.write_text('x', encoding='utf-8')
        os.utime(path, (SLOT_PLAIN - 0.4, SLOT_PLAIN - 0.4))          # 20:54:59.6
        value = collector.export_file_mtime(path)
        assert isinstance(value, int) and value == SLOT_PLAIN - 1, value
    assert collector.export_file_mtime(Path('definitely/not/there.txt')) is None


def test_a_retried_cycle_records_each_attempt_and_stamps_only_the_one_that_validated():
    with tempfile.TemporaryDirectory() as d:
        export_dir = terminal_dir(Path(d))
        newest = SLOT_PLAIN - 300
        write_exports(export_dir, 'M5', newest, omit=('zigzag',), mtime=SLOT_PLAIN - 1)
        conn = fresh_db()

        assert not collector.run_cycle(conn, export_dir, 'M5', SLOT_PLAIN), 'a missing file must reject the attempt'
        conn.execute("UPDATE collection_cycles SET created_at = created_at - 65 WHERE attempt = 1")
        conn.commit()

        write_exports(export_dir, 'M5', newest, mtime=SLOT_PLAIN - 1)         # the terminal caught up
        assert collector.run_cycle(conn, export_dir, 'M5', SLOT_PLAIN)

        rows = conn.execute("SELECT attempt, status, export_mtime, newest_bar_ts, finished_at "
                            "FROM collection_cycles ORDER BY attempt").fetchall()
        assert [r[:2] for r in rows] == [(1, 'rejected'), (2, 'validated')]
        assert rows[0][2:] == (None, None, None), 'a rejected attempt must carry no manifest facts'
        assert rows[1][2] == SLOT_PLAIN - 1 and rows[1][3] == newest and rows[1][4] is not None

        manifest_cycle = worker.validated_cycle(conn, 'M5', SLOT_PLAIN)
        assert manifest_cycle['attempt'] == 2, 'attempts must count every attempt the cycle needed'


def test_end_to_end_collector_to_manifest_to_contract():
    """The real collector writes the database; the real push worker reads it and
    sends; the contract accepts what was sent."""
    with isolated_worker(), tempfile.TemporaryDirectory() as d:
        export_dir = terminal_dir(Path(d))
        newest_m5, newest_m15 = SLOT_REFRESH, SLOT_REFRESH            # both stubs of the bars opened at 21:00
        exported_at = SLOT_REFRESH + 3
        write_exports(export_dir, 'M5', newest_m5, bars=4, mtime=exported_at)
        write_exports(export_dir, 'M15', newest_m15, bars=4, mtime=exported_at)
        for tf in ('M5', 'M15'):
            write_statistic(export_dir, 'best_fit_a', tf, 'FROZEN')
            write_statistic(export_dir, 'non_b', tf, 'DYNAMIC')
        conn = fresh_db()
        assert collector.run_cycle(conn, export_dir, 'M5', SLOT_REFRESH)
        assert collector.run_cycle(conn, export_dir, 'M15', SLOT_REFRESH)

        session = FakeSession()
        pushed, quarantined, _, manifests = worker.push_cycle(session, conn, now=SLOT_REFRESH + 60)
        assert (quarantined, manifests) == (0, 1)
        assert session.kinds()[-1] == 'manifest' and session.kinds().count('manifest') == 1
        assert session.kinds().index('manifest') > max(i for i, k in enumerate(session.kinds()) if k == 'row'), \
            'the manifest must come after every row it describes'

        manifest = session.manifests()[0]
        assert errors_of(manifest) == [], [e.message for e in errors_of(manifest)]
        assert manifest['slot'] == SLOT_REFRESH
        assert manifest['mt5_terminal'] == 'MT5-A', manifest['mt5_terminal']
        for tf in ('M5', 'M15'):
            section = manifest['timeframes'][tf]
            assert section['export_mtime'] == exported_at
            assert section['newest_bar_ts'] == SLOT_REFRESH
            assert section['attempts'] == 1
            assert section['bar_count'] == 4 and section['oldest_bar_ts'] == SLOT_REFRESH - 3 * collector.TF_SECONDS[tf]
            assert section['statistics_count'] == 2
            assert section['source_modes'] == {'best_fit_a': 'FROZEN', 'non_b': 'DYNAMIC'}
            assert set(section['config_hashes']) == {'best_fit_a', 'non_b'}


# ============================================================
# What the manifest says
# ============================================================
def test_manifest_content_for_a_refresh_slot():
    conn, info, m = a_manifest()
    assert m['schema'] == 'cycle-manifest/1' and m['symbol'] == 'XAUUSD' and m['slot'] == SLOT_REFRESH
    assert m['mt5_terminal'] == 'MT5-A' and m['built_at'] == SLOT_REFRESH + 60
    assert m['backlog_rows'] == worker.unsynced_count(conn) == 6000
    assert set(m['timeframes']) == {'M5', 'M15'}
    m5, m15 = m['timeframes']['M5'], m['timeframes']['M15']
    assert (m5['collection_cycle_id'], m15['collection_cycle_id']) == (info['m5_cycle'], info['m15_cycle'])
    assert (m5['bar_count'], m15['bar_count']) == (289, 97)
    assert m5['newest_bar_ts'] == info['m5_newest'] and m15['newest_bar_ts'] == info['m15_newest']
    assert m5['oldest_bar_ts'] == SLOT_REFRESH - 288 * 300 and m15['oldest_bar_ts'] == SLOT_REFRESH - 96 * 900
    assert m5['export_mtime'] == SLOT_REFRESH - 1
    assert m5['statistics_count'] == 3 and m5['quarantined_rows'] == 0
    assert set(m5['config_hashes']) == {'best_fit_a', 'non_b', 'sr_levels'}
    assert m5['source_modes'] == {'best_fit_a': 'DYNAMIC', 'non_b': 'FROZEN'}, \
        'only sources that report a Projection Mode appear in source_modes'
    assert m['repush_rows_unsent'] == 5997, \
        'every unsent row except the three newest (M5 slot, M5 slot - 300, M15 slot) is historical'
    assert json.loads(json.dumps(m, sort_keys=True)) == m


def test_attempts_and_first_start_are_reported_per_timeframe():
    conn, info, m = a_manifest(m5_attempts=2, m15_attempts=3)
    m5, m15 = m['timeframes']['M5'], m['timeframes']['M15']
    assert (m5['attempts'], m15['attempts']) == (2, 3)
    # started_at is the FIRST attempt's start for the slot, not the validating attempt's
    assert m5['started_at'] == SLOT_REFRESH + 5 and m15['started_at'] == SLOT_REFRESH + 5
    last_m5 = conn.execute("SELECT created_at, validated_at FROM collection_cycles WHERE cycle_id = ?",
                           (info['m5_cycle'],)).fetchone()
    assert last_m5[0] == SLOT_REFRESH + 5 + collector.RETRY_WAIT_SEC
    assert m5['validated_at'] == last_m5[1] and m5['validated_at'] > m5['started_at']


def test_m15_is_absent_on_a_plain_slot():
    _, _, m = a_manifest(SLOT_PLAIN)
    assert set(m['timeframes']) == {'M5'}
    assert m['mt5_terminal'] == 'MT5-A', 'the terminal comes from M5, which every slot has'


def test_a_refresh_slot_whose_m15_failed_still_names_its_terminal():
    conn, info = build_world(SLOT_REFRESH)
    conn.execute("UPDATE collection_cycles SET finished_at = NULL WHERE cycle_id = ?", (info['m15_cycle'],))
    m = worker.build_manifest(conn, SLOT_REFRESH, SLOT_REFRESH + 60)
    assert set(m['timeframes']) == {'M5'} and m['mt5_terminal'] == 'MT5-A'


def test_a_timeframe_the_collector_has_not_finished_is_left_out():
    conn, info = build_world(SLOT_REFRESH)
    conn.execute("UPDATE collection_cycles SET finished_at = NULL WHERE cycle_id = ?", (info['m15_cycle'],))
    m = worker.build_manifest(conn, SLOT_REFRESH, SLOT_REFRESH + 60)
    assert set(m['timeframes']) == {'M5'}
    conn.execute("UPDATE collection_cycles SET finished_at = NULL WHERE cycle_id = ?", (info['m5_cycle'],))
    assert worker.build_manifest(conn, SLOT_REFRESH, SLOT_REFRESH + 60) is None, 'no M5, no manifest'


def test_an_unknown_export_time_means_no_manifest_not_a_made_up_one():
    with isolated_worker():
        conn, info = build_world(SLOT_PLAIN)
        conn.execute("UPDATE collection_cycles SET export_mtime = NULL WHERE cycle_id = ?", (info['m5_cycle'],))
        assert worker.build_manifest(conn, SLOT_PLAIN, SLOT_PLAIN + 60) is None


def test_terminal_label_follows_the_folder_that_holds_mql5():
    cases = {
        'C:/MT5-A/MQL5/Files': 'MT5-A',
        'C:\\MT5-B\\MQL5\\Files': 'MT5-B',
        'C:/MT5/MQL5/Files/': 'MT5',
        'c:/mt5-a/mql5/files': 'mt5-a',
        '/data/exports': '/data/exports',          # a layout it does not recognise: the whole directory
        '/MQL5/Files': '/MQL5/Files',              # MQL5 first: nothing before it to name
        '': 'unknown',
        None: 'unknown',
    }
    for given, expected in cases.items():
        assert worker.terminal_label(given) == expected, (given, worker.terminal_label(given))


def test_a_promote_shows_up_as_a_different_terminal_and_different_hashes():
    _, _, a = a_manifest(export_dir='C:/MT5-A/MQL5/Files')
    _, _, b = a_manifest(export_dir='C:/MT5-B/MQL5/Files')
    assert a['mt5_terminal'] != b['mt5_terminal']


# ============================================================
# repush_rows_unsent (ADR-015, build step 2 part 9)
# ============================================================
def sync_everything_older_than(conn, cutoff, at=1789700000):
    """Stamp every row opened before `cutoff` as pushed: the drained state."""
    conn.execute("UPDATE market_data SET synced_at = ? WHERE timestamp < ?", (at, cutoff))
    conn.commit()


def test_repush_rows_unsent_counts_the_historical_backlog():
    conn, _info, m = a_manifest(SLOT_REFRESH)
    assert (m['backlog_rows'], m['repush_rows_unsent']) == (6000, 5997)
    assert m['repush_rows_unsent'] == conn.execute(
        "SELECT COUNT(*) FROM market_data WHERE synced_at IS NULL AND timestamp < ?",
        (SLOT_REFRESH - 300,)).fetchone()[0]


def test_a_drained_backlog_reports_zero_re_push_rows_while_the_newest_bars_are_still_unsent():
    conn, _info = build_world(SLOT_REFRESH)
    sync_everything_older_than(conn, SLOT_REFRESH - 300)
    m = worker.build_manifest(conn, SLOT_REFRESH, SLOT_REFRESH + 60)
    assert m['repush_rows_unsent'] == 0, 'nothing historical is left'
    assert m['backlog_rows'] == 3, 'the newest rows of the cycle are not a re-push: they are not counted'


def test_the_newest_bars_boundary_is_exactly_slot_minus_one_bar():
    conn, _info = build_world(SLOT_PLAIN)
    conn.execute("UPDATE market_data SET synced_at = 1789700000")
    conn.commit()

    def unsend(ts):
        conn.execute("UPDATE market_data SET synced_at = NULL WHERE timeframe = 'M5' AND timestamp = ?", (ts,))
        conn.commit()

    unsend(SLOT_PLAIN - 300)                   # the newest closed bar: the cycle's own, not historical
    assert worker.build_manifest(conn, SLOT_PLAIN, SLOT_PLAIN + 60)['repush_rows_unsent'] == 0
    unsend(SLOT_PLAIN - 600)                   # one bar older: historical
    m = worker.build_manifest(conn, SLOT_PLAIN, SLOT_PLAIN + 60)
    assert (m['repush_rows_unsent'], m['backlog_rows']) == (1, 2)


def test_re_push_rows_are_never_more_than_the_backlog_they_are_part_of():
    for slot, world in ((SLOT_REFRESH, {}), (SLOT_PLAIN, {}), (SLOT_REFRESH, {'stub': False}),
                        (SLOT_PLAIN, {'m5_bars': 700})):
        _, _, m = a_manifest(slot, **world)
        assert 0 <= m['repush_rows_unsent'] <= m['backlog_rows'], \
            (slot, world, m['repush_rows_unsent'], m['backlog_rows'])
    conn, _info = build_world(SLOT_REFRESH)
    assert worker.unsent_counts(conn, SLOT_REFRESH) == (6000, 5997)


def test_unsent_counts_on_an_empty_outbox_is_zero_and_not_none():
    conn = fresh_db()
    assert worker.unsent_counts(conn, SLOT_PLAIN) == (0, 0), 'SUM over no rows is NULL in SQLite'
    assert all(type(n) is int for n in worker.unsent_counts(conn, SLOT_PLAIN))


def test_the_two_counts_come_from_one_statement():
    """One snapshot: the collector writes to market_data while the manifest is
    built, so two queries could disagree (re-push rows above the backlog they are
    part of). A single SELECT cannot."""
    conn, _info = build_world(SLOT_REFRESH)
    seen = []
    conn.set_trace_callback(seen.append)
    counts = worker.unsent_counts(conn, SLOT_REFRESH)
    conn.set_trace_callback(None)
    reads = [sql for sql in seen if 'market_data' in sql]
    assert len(reads) == 1, reads
    assert 'COUNT(*)' in reads[0] and 'SUM(' in reads[0]
    assert counts == (6000, 5997) and type(counts) is tuple
    assert all(type(n) is int for n in counts)


def test_a_promote_re_push_drains_to_zero_through_the_real_push_pass():
    """The sender's own passes: a promote's re-push is 6,000 unsent rows; after
    they have gone out, the NEXT cycle's manifest reports zero. This is the
    number the gateway turns into 'nothing left to re-push'."""
    with isolated_worker():
        conn, _ = build_world(SLOT_REFRESH)
        session = FakeSession()
        worker.push_cycle(session, conn, now=SLOT_REFRESH + 60)
        first = session.manifests()[0]
        assert first['repush_rows_unsent'] == first['backlog_rows'] == 6000 - 386, \
            'right after the priority set the whole backlog is historical'
        for i in range(1, 30):
            worker.push_cycle(session, conn, now=SLOT_REFRESH + 60 + 30 * i)
            if worker.unsynced_count(conn) == 0:
                break
        assert worker.unsynced_count(conn) == 0, 'the backlog drains at 500 rows a pass'

        nxt = SLOT_REFRESH + 300                                  # the next, plain, slot: only a new bar arrives
        cycle = add_cycle(conn, nxt, 'M5', newest_bar_ts=nxt)
        add_bars(conn, 'M5', nxt, 1, cycle)
        add_stats(conn, cycle, 'M5', nxt)
        worker.push_cycle(session, conn, now=nxt + 60)
        second = session.manifests()[1]
        assert second['slot'] == nxt
        assert second['repush_rows_unsent'] == 0, 'nothing historical was left unsent'
        assert second['backlog_rows'] == 0, "the only new row is the cycle's newest and went out first"


def test_the_collectors_full_requeue_leaves_the_whole_window_unsent_at_manifest_time():
    """PINNED FACT, not a wish (part 9 hand-off, finding 1). promote_cycle()
    re-queues EVERY in-window row each cycle, so right after any cycle the
    historical backlog is the whole window and repush_rows_unsent is far from
    zero whether or not a promote happened. The gateway can only read 0 when the
    collector stops re-queueing unchanged bars (PUSH-WORKER-THROUGHPUT-OPEN-ISSUE
    fix 3) or the definition changes. If this test starts failing because the
    collector changed, re-read the hand-off and the gateway's completion rule."""
    import inspect
    src = inspect.getsource(collector.promote_cycle)
    assert 'INSERT OR REPLACE INTO market_data' in src and 'synced_at' not in src, \
        'promote_cycle no longer re-queues the whole window: re-check what repush_rows_unsent can now report'

    with isolated_worker():
        conn, _ = build_world(SLOT_REFRESH)
        session = FakeSession()
        for i in range(30):                                       # drain everything
            worker.push_cycle(session, conn, now=SLOT_REFRESH + 60 + 30 * i)
            if worker.unsynced_count(conn) == 0:
                break
        assert worker.unsynced_count(conn) == 0

        nxt = SLOT_REFRESH + 300
        cycle = add_cycle(conn, nxt, 'M5', newest_bar_ts=nxt)
        add_bars(conn, 'M5', nxt, 1, cycle)
        add_stats(conn, cycle, 'M5', nxt)
        conn.execute("UPDATE market_data SET synced_at = NULL")   # what the collector's INSERT OR REPLACE does
        conn.commit()
        worker.push_cycle(session, conn, now=nxt + 60)
        assert session.manifests()[1]['repush_rows_unsent'] > 5000


# ============================================================
# The contract
# ============================================================
def test_the_contract_is_a_valid_schema_and_accepts_what_the_worker_builds():
    assert jsonschema is not None
    jsonschema.Draft202012Validator.check_schema(CONTRACT)
    for slot, world in ((SLOT_REFRESH, {}), (SLOT_PLAIN, {}), (SLOT_REFRESH, {'m5_attempts': 3}),
                        (SLOT_REFRESH, {'stub': False})):
        _, _, m = a_manifest(slot, **world)
        assert errors_of(m) == [], (slot, world, [e.message for e in errors_of(m)])


def test_the_builder_and_the_contract_list_the_same_fields():
    _, _, m = a_manifest()
    top = set(CONTRACT['required'])
    assert set(m) == top | {'repush_rows_unsent'}, 'a field was added to the builder or the contract alone'
    assert set(CONTRACT['properties']) == top | {'repush_rows_unsent'}
    assert 'repush_rows_unsent' not in CONTRACT['required'], 'optional: an older sender omits it'
    section = CONTRACT['$defs']['timeframeCycle']
    assert set(section['required']) == set(section['properties'])
    assert set(m['timeframes']['M5']) == set(section['required'])


def test_the_contract_names_the_same_sources_as_the_collector():
    assert set(CONTRACT['$defs']['sourceName']['enum']) == set(collector.STAT_SOURCES)


def test_the_contract_rejects_each_way_a_manifest_can_be_wrong():
    _, _, good = a_manifest()

    def broken(edit):
        m = copy.deepcopy(good)
        edit(m)
        return m

    def drop(*path):
        def edit(m):
            node = m
            for p in path[:-1]:
                node = node[p]
            del node[path[-1]]
        return edit

    def put(value, *path):
        def edit(m):
            node = m
            for p in path[:-1]:
                node = node[p]
            node[path[-1]] = value
        return edit

    bad = {
        'schema missing': drop('schema'),
        'schema version': put('cycle-manifest/2', 'schema'),
        'wrong symbol': put('EURUSD', 'symbol'),
        'slot off the boundary': put(SLOT_REFRESH + 1, 'slot'),
        'negative slot': put(-300, 'slot'),
        'terminal missing': drop('mt5_terminal'),
        'terminal empty': put('', 'mt5_terminal'),
        'M5 missing': drop('timeframes', 'M5'),
        'unknown timeframe': put(good['timeframes']['M5'], 'timeframes', 'M30'),
        'attempts missing': drop('timeframes', 'M5', 'attempts'),
        'attempts zero': put(0, 'timeframes', 'M5', 'attempts'),
        'attempts a string': put('2', 'timeframes', 'M5', 'attempts'),
        'bar_count zero': put(0, 'timeframes', 'M5', 'bar_count'),
        'export_mtime missing': drop('timeframes', 'M5', 'export_mtime'),
        'export_mtime a string': put('2026-09-18T21:00:00Z', 'timeframes', 'M5', 'export_mtime'),
        'newest_bar_ts missing': drop('timeframes', 'M5', 'newest_bar_ts'),
        'negative quarantined': put(-1, 'timeframes', 'M5', 'quarantined_rows'),
        'hash too short': put({'best_fit_a': 'abc'}, 'timeframes', 'M5', 'config_hashes'),
        'hash upper case': put({'best_fit_a': 'A' * 64}, 'timeframes', 'M5', 'config_hashes'),
        'unknown source': put({'made_up': 'a' * 64}, 'timeframes', 'M5', 'config_hashes'),
        'mode lower case': put({'best_fit_a': 'frozen'}, 'timeframes', 'M5', 'source_modes'),
        'unknown mode': put({'best_fit_a': 'STANDBY'}, 'timeframes', 'M5', 'source_modes'),
        'extra top-level field': put(1, 'extra'),
        'extra field in a timeframe': put(1, 'timeframes', 'M5', 'extra'),
        'negative backlog': put(-1, 'backlog_rows'),
        'negative repush': put(-1, 'repush_rows_unsent'),
    }
    for label, edit in bad.items():
        assert errors_of(broken(edit)), f'the contract accepted: {label}'

    assert not errors_of(broken(put(0, 'repush_rows_unsent'))), 'repush_rows_unsent 0 is valid'
    assert not errors_of(good), 'repush_rows_unsent is optional'


# ============================================================
# Building, storing and delivering it
# ============================================================
def stored(conn):
    return conn.execute("SELECT slot, payload, synced_at, send_attempts, last_error FROM cycle_manifests").fetchall()


def test_a_manifest_is_built_once_and_stored_verbatim():
    with isolated_worker():
        conn, _ = build_world(SLOT_REFRESH)
        session = FakeSession()
        worker.push_cycle(session, conn, now=SLOT_REFRESH + 60)
        rows = stored(conn)
        assert len(rows) == 1 and rows[0][2] is not None
        assert json.loads(rows[0][1]) == session.manifests()[0], 'what was sent is what was stored'
        assert worker.queue_manifest(conn, SLOT_REFRESH + 90) is False, 'a second build for the same slot'
        worker.push_cycle(session, conn, now=SLOT_REFRESH + 90)
        assert len(session.manifests()) == 1 and len(stored(conn)) == 1


def test_no_manifest_until_every_priority_row_has_been_sent():
    with isolated_worker():
        conn, _ = build_world(SLOT_REFRESH)
        assert worker.queue_manifest(conn, SLOT_REFRESH + 60) is False and stored(conn) == []
        worker._send_rows(FakeSession(), conn, worker.priority_rows(conn, SLOT_REFRESH)[:385])
        assert worker.queue_manifest(conn, SLOT_REFRESH + 60) is False, 'one priority row is still unsent'
        worker._send_rows(FakeSession(), conn, worker.priority_rows(conn, SLOT_REFRESH))
        assert worker.queue_manifest(conn, SLOT_REFRESH + 60) is True


def test_no_manifest_before_the_collector_has_finished_the_cycle():
    with isolated_worker():
        conn, info = build_world(SLOT_PLAIN, finished=False)
        worker._send_rows(FakeSession(), conn, worker.priority_rows(conn, SLOT_PLAIN))
        assert worker.queue_manifest(conn, SLOT_PLAIN + 60) is False, 'statistics may not be staged yet'
        conn.execute("UPDATE collection_cycles SET finished_at = ? WHERE cycle_id = ?",
                     (SLOT_PLAIN + 30, info['m5_cycle']))
        assert worker.queue_manifest(conn, SLOT_PLAIN + 60) is True


def test_a_refresh_slot_waits_for_m15_and_then_goes_without_it():
    with isolated_worker():
        conn, _ = build_world(SLOT_REFRESH, m15_status='rejected', m15_attempts=1)
        worker._send_rows(FakeSession(), conn, worker.priority_rows(conn, SLOT_REFRESH))
        assert worker.queue_manifest(conn, SLOT_REFRESH + 60) is False, 'M15 may still be retrying'
        assert worker.queue_manifest(conn, SLOT_REFRESH + worker.M15_SETTLE_SEC) is True
        manifest = json.loads(stored(conn)[0][1])
        assert set(manifest['timeframes']) == {'M5'}, 'absent means M15 did not refresh'


def test_a_refresh_slot_does_not_wait_once_m15_has_used_every_attempt():
    with isolated_worker():
        conn, _ = build_world(SLOT_REFRESH, m15_status='rejected', m15_attempts=collector.MAX_ATTEMPTS_PER_CYCLE)
        worker._send_rows(FakeSession(), conn, worker.priority_rows(conn, SLOT_REFRESH))
        assert worker.queue_manifest(conn, SLOT_REFRESH + 60) is True


def test_a_slot_too_old_to_matter_gets_no_manifest():
    with isolated_worker():
        conn, _ = build_world(SLOT_PLAIN)
        worker._send_rows(FakeSession(), conn, worker.priority_rows(conn, SLOT_PLAIN))
        assert worker.queue_manifest(conn, SLOT_PLAIN + worker.MANIFEST_MAX_AGE_SEC + 1) is False


def pending_manifest(conn, now=SLOT_PLAIN + 60):
    """A built, unsent manifest for SLOT_PLAIN, without going through push_cycle."""
    worker._send_rows(FakeSession(), conn, worker.priority_rows(conn, SLOT_PLAIN))
    assert worker.queue_manifest(conn, now)


def test_failed_sends_are_retried_never_stamped_and_resend_the_same_bytes():
    for failure in (404, 500, 503, requests.ConnectionError('down'), requests.Timeout('slow')):
        with isolated_worker():
            conn, _ = build_world(SLOT_PLAIN)
            pending_manifest(conn)
            payload_before = stored(conn)[0][1]

            session = FakeSession(always('manifest', failure))
            acknowledged, status = worker.send_manifests(session, conn, SLOT_PLAIN + 70)
            assert (acknowledged, status) == (0, 'retry'), failure
            slot, payload, synced_at, attempts, last_error = stored(conn)[0]
            assert synced_at is None, f'{failure!r} must not stamp a manifest as sent'
            assert attempts == 1 and last_error, 'the failure must be recorded for the operator'
            assert not worker.REJECTED_MANIFESTS_FILE.exists(), f'{failure!r} must never quarantine'

            good = FakeSession()
            assert worker.send_manifests(good, conn, SLOT_PLAIN + 130) == (1, 'ok')
            assert good.manifests()[0] == json.loads(payload_before), 'a retry must send the identical manifest'
            assert stored(conn)[0][2] is not None


def test_a_400_quarantines_the_manifest_once_and_stamps_it():
    with isolated_worker():
        conn, _ = build_world(SLOT_PLAIN)
        pending_manifest(conn)
        session = FakeSession(always('manifest', 400))
        assert worker.send_manifests(session, conn, SLOT_PLAIN + 70) == (0, 'ok')
        assert stored(conn)[0][2] is not None, 'a rejected manifest cannot be fixed by resending: stamp it'
        assert worker.REJECTED_MANIFESTS_FILE.exists()
        record = json.loads(worker.REJECTED_MANIFESTS_FILE.read_text(encoding='utf-8').splitlines()[0])
        assert record['row']['slot'] == SLOT_PLAIN and record['gateway_error']
        assert worker.send_manifests(session, conn, SLOT_PLAIN + 130) == (0, 'ok') and len(session.manifests()) == 1


def test_rate_limit_and_auth_failure_are_reported_to_the_caller():
    for status, expected in ((429, 'rate_limited'), (401, 'auth'), (403, 'auth')):
        with isolated_worker():
            conn, _ = build_world(SLOT_PLAIN)
            pending_manifest(conn)
            session = FakeSession(always('manifest', status))
            assert worker.send_manifests(session, conn, SLOT_PLAIN + 70) == (0, expected), status
            assert stored(conn)[0][2] is None


def test_a_gateway_without_the_endpoint_never_holds_back_the_prices():
    """The rollout order puts the gateway first, but a VPS can be updated before
    the gateway has deployed. Then every manifest 404s, and the price rows must
    flow exactly as if there were no manifest lane."""
    with isolated_worker():
        conn, _ = build_world(SLOT_REFRESH)
        session = FakeSession(always('manifest', 404))
        pushed, quarantined, rate_limited, manifests = worker.push_cycle(session, conn, now=SLOT_REFRESH + 60)
        assert (pushed, quarantined, manifests) == (500, 0, 0)
        assert session.kinds().count('row') == 500 and session.kinds().count('manifest') == 1
        assert stored(conn)[0][2] is None, 'the manifest is still waiting to be delivered'
        assert worker.manifest_work_pending(conn, SLOT_REFRESH + 90) is True


def test_a_rate_limited_manifest_stops_the_pass_before_the_backlog():
    with isolated_worker():
        conn, _ = build_world(SLOT_REFRESH)
        session = FakeSession(always('manifest', 429))
        pushed, _, rate_limited, manifests = worker.push_cycle(session, conn, now=SLOT_REFRESH + 60)
        assert rate_limited is True and pushed == 386 and manifests == 0
        assert session.kinds()[-1] == 'manifest', 'no backlog row may follow a rate-limited manifest'


def insert_manifests(conn, slots):
    for slot in slots:
        conn.execute("INSERT INTO cycle_manifests (slot, payload, created_at) VALUES (?, ?, ?)",
                     (slot, json.dumps({'slot': slot}), slot))
    conn.commit()


def test_manifests_go_out_newest_first_at_most_three_a_pass():
    with isolated_worker():
        conn = fresh_db()
        now = SLOT_PLAIN + 3000
        insert_manifests(conn, [now - 1200, now - 900, now - 600, now - 300])
        session = FakeSession()
        acknowledged, status = worker.send_manifests(session, conn, now)
        sent = [m['slot'] for m in session.manifests()]
        assert sent == [now - 300, now - 600, now - 900], f'newest first, at most {worker.MANIFEST_MAX_PER_ITERATION}'
        assert (acknowledged, status) == (3, 'ok')


def test_a_manifest_older_than_an_hour_is_abandoned_not_sent():
    """Fewer than the per-pass cap are due, so the cap cannot be what keeps the
    old one at home: only the age limit can."""
    with isolated_worker():
        conn = fresh_db()
        now = SLOT_PLAIN + 7000
        abandoned = now - worker.MANIFEST_MAX_AGE_SEC - 600
        insert_manifests(conn, [abandoned, now - 600, now - 300])
        session = FakeSession()
        acknowledged, status = worker.send_manifests(session, conn, now)
        assert [m['slot'] for m in session.manifests()] == [now - 300, now - 600]
        assert (acknowledged, status) == (2, 'ok')
        assert conn.execute("SELECT synced_at FROM cycle_manifests WHERE slot = ?", (abandoned,)).fetchone()[0] is None
        assert worker.manifest_work_pending(conn, now) is False, 'an abandoned manifest must not keep the worker busy'


def test_a_database_without_the_outbox_turns_the_manifest_lane_off_and_nothing_else():
    with isolated_worker():
        conn, _ = build_world(SLOT_REFRESH)
        conn.execute("DROP TABLE cycle_manifests")
        assert worker.manifest_table_available(conn) is False
        assert worker.manifest_work_pending(conn, SLOT_REFRESH + 60) is False
        session = FakeSession()
        pushed, _, _, manifests = worker.push_cycle(session, conn, now=SLOT_REFRESH + 60)
        assert pushed == 500 and manifests == 0 and 'manifest' not in session.kinds()
        assert session.kinds()[:386] == ['row'] * 386, 'priority order must not depend on the manifest lane'


def test_a_stale_slot_with_no_manifest_does_not_keep_the_worker_busy():
    """Nothing was ever built for this slot (say the collector never finished it).
    The worker may wait for it while it is recent, not for ever."""
    with isolated_worker():
        conn, _ = build_world(SLOT_PLAIN)
        assert worker.manifest_work_pending(conn, SLOT_PLAIN + 60) is True
        assert worker.manifest_work_pending(conn, SLOT_PLAIN + worker.MANIFEST_MAX_AGE_SEC) is True
        assert worker.manifest_work_pending(conn, SLOT_PLAIN + worker.MANIFEST_MAX_AGE_SEC + 1) is False


def test_a_missing_outbox_is_reported_once_not_silently_ignored():
    """The deploy package ships the two .py files but the collector creates the
    outbox from the SCHEMA file. A collector started beside an old schema file
    would leave the manifest lane off with nothing in the log: say so, once."""
    with isolated_worker():
        conn, _ = build_world(SLOT_REFRESH)
        conn.execute("DROP TABLE cycle_manifests")
        with captured_warnings() as records:
            for _ in range(3):
                worker.manifest_table_available(conn)
                worker.manifest_work_pending(conn, SLOT_REFRESH + 60)
        messages = [r.getMessage() for r in records]
        assert len(messages) == 1, messages
        assert 'cycle_manifests' in messages[0] and 'sqlite_schema_v6_xauusd.sql' in messages[0]


def test_the_main_loop_knows_when_a_manifest_is_due():
    with isolated_worker():
        conn, _ = build_world(SLOT_PLAIN)
        assert worker.manifest_work_pending(conn, SLOT_PLAIN + 60) is True, 'built nothing yet for a recent slot'
        pending_manifest(conn)
        assert worker.manifest_work_pending(conn, SLOT_PLAIN + 70) is True, 'built but not delivered'
        worker.send_manifests(FakeSession(), conn, SLOT_PLAIN + 80)
        assert worker.manifest_work_pending(conn, SLOT_PLAIN + 90) is False, 'delivered: the worker may idle'
        assert worker.manifest_work_pending(conn, SLOT_PLAIN + worker.MANIFEST_MAX_AGE_SEC + 600) is False, \
            'a stale slot must not keep the worker off its idle cadence for ever'


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
