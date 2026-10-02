"""Tests for newest-bars-first in the push worker (ADR-013; build step 2 part 3).

Run either way (there is no pytest config in this stack):

    python test_push_priority_order.py
    python -m pytest test_push_priority_order.py -q

THE PROBLEM, and why a toy test would not catch it. The collector's
INSERT OR REPLACE clears synced_at on every in-window row each cycle, so about
6,000 rows are unsent at any moment, and the worker used to send them
OLDEST-first, 500 at a time. A cycle's newest bars therefore arrived last, or in
a later pass. Nothing errors: every row eventually lands, every old test passes.
So these tests build the real situation (the full 3,000-bar window of both
timeframes, all unsent) and assert on the ORDER the gateway was called in.

What is pinned:
  * the priority set is exactly the newest 288 closed M5 bars + 96 closed M15
    bars + each timeframe's newest row when it is not closed (386 rows), and it
    goes out newest first, before anything else (section 1.8, "Newest bars
    first under backlog");
  * the manifest comes after those rows and before the backlog;
  * the backlog is still oldest-first, within the 500-row budget, so the
    stragglers that scrolled out of MT5's window keep draining (the SQLite
    growth guarantee);
  * a failure stops everything behind it, and a manifest the gateway cannot
    take never holds prices back;
  * against a database the new collector has not widened, the worker behaves
    exactly as before.
"""
import re
import sys
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent))

from cycle_test_support import (  # noqa: E402
    FakeSession, SLOT_PLAIN, SLOT_REFRESH, add_bars, add_cycle, add_stats, always,
    build_world, captured_warnings, collector, isolated_worker, worker)

REPO = Path(__file__).resolve().parents[3]


def expected_priority(slot, m5_newest, m15_newest=None):
    """The priority set, written out by hand from rule 4 (not by the worker's code):
    per timeframe the newest 288 (M5) or 96 (M15) bars that are closed at the slot,
    plus the newest row when it is not closed yet."""
    wanted = set()
    for tf, newest, period, closed_bars in (('M5', m5_newest, 300, 288), ('M15', m15_newest, 900, 96)):
        if newest is None:
            continue
        stamps = [newest - period * i for i in range(closed_bars + 1)]
        closed = sorted((ts for ts in stamps if ts + period <= slot), reverse=True)[:closed_bars]
        still_open = [ts for ts in stamps if ts + period > slot]
        wanted |= {(tf, ts) for ts in closed + still_open}
    return wanted


def key(row):
    return (row['timeframe'], row['timestamp'])


def run_pass(conn, session=None, now=None):
    session = session or FakeSession()
    result = worker.push_cycle(session, conn, now=SLOT_REFRESH + 60 if now is None else now)
    return session, result


# ============================================================
# The priority set
# ============================================================
def test_priority_set_is_exactly_the_newest_386_rows():
    with isolated_worker():
        conn, info = build_world(SLOT_REFRESH)
        session, _ = run_pass(conn)
        first = session.rows()[:386]
        assert len(first) == 386
        assert {key(r) for r in first} == expected_priority(
            SLOT_REFRESH, info['m5_newest'], info['m15_newest']), 'first 386 rows are not the priority set'
        assert len({key(r) for r in first}) == 386, 'a priority row was sent twice'


def test_priority_rows_go_out_newest_first():
    with isolated_worker():
        conn, _ = build_world(SLOT_REFRESH)
        session, _ = run_pass(conn)
        stamps = [r['timestamp'] for r in session.rows()[:386]]
        assert stamps == sorted(stamps, reverse=True), 'priority rows are not newest-first'
        assert session.rows()[0]['timeframe'] == 'M5' and session.rows()[0]['timestamp'] == SLOT_REFRESH
        # Both timeframes' newest rows are in the first two requests, not one
        # timeframe's whole window followed by the other's.
        assert {key(r) for r in session.rows()[:2]} == {('M5', SLOT_REFRESH), ('M15', SLOT_REFRESH)}


def test_a_closed_newest_row_gives_288_and_96_not_289_and_97():
    """If the newest exported bar is already closed there is no stub to add, and
    the priority set is exactly one day of closed bars (rule 4)."""
    with isolated_worker():
        conn, info = build_world(SLOT_REFRESH, stub=False)
        session, _ = run_pass(conn)
        priority = {key(r) for r in session.rows()[:384]}
        assert priority == expected_priority(SLOT_REFRESH, info['m5_newest'], info['m15_newest'])
        assert sum(1 for tf, _ in priority if tf == 'M5') == 288
        assert sum(1 for tf, _ in priority if tf == 'M15') == 96
        # and the 385th row is already backlog, oldest-first, not another priority row
        assert session.rows()[384]['timestamp'] <= session.rows()[385]['timestamp']


def test_a_slot_that_does_not_refresh_m15_has_no_m15_priority_rows():
    with isolated_worker():
        conn, info = build_world(SLOT_PLAIN)            # 20:55: M5 only
        session, _ = run_pass(conn, now=SLOT_PLAIN + 60)
        priority = session.rows()[:289]
        assert {key(r) for r in priority} == expected_priority(SLOT_PLAIN, info['m5_newest'])
        assert all(r['timeframe'] == 'M5' for r in priority)
        assert sum(1 for r in session.rows() if r['timeframe'] == 'M15') == 0, \
            'M15 rows were already synced and must not be sent again'


def test_rows_newer_than_the_cycle_do_not_leak_into_its_window():
    """A later cycle's rows must never be treated as part of an earlier slot."""
    with isolated_worker():
        conn, info = build_world(SLOT_PLAIN)
        # a bar from the NEXT cycle, already in market_data (e.g. promoted a moment ago)
        add_bars(conn, 'M5', SLOT_PLAIN + 300, 1, info['m5_cycle'])
        window = worker.priority_window(conn, 'M5', SLOT_PLAIN, info['m5_newest'])
        assert SLOT_PLAIN + 300 not in window
        assert window[0] == SLOT_PLAIN, 'the slot\'s own newest row should lead'


def test_priority_is_judged_against_the_slot_not_the_clock():
    """The same slot gives the same window however late the worker gets to it."""
    with isolated_worker():
        conn, info = build_world(SLOT_PLAIN)
        a = worker.priority_window(conn, 'M5', SLOT_PLAIN, info['m5_newest'])
        # priority_window takes no clock at all; a later slot moves the boundary
        b = worker.priority_window(conn, 'M5', SLOT_PLAIN + 300, info['m5_newest'])
        assert a[0] == SLOT_PLAIN and SLOT_PLAIN in a, 'bar opened at the slot is the still-open row'
        assert b[0] == SLOT_PLAIN, 'one slot later the same bar is the newest CLOSED bar'
        assert len(a) == 289 and len(b) == 288, (len(a), len(b))


# ============================================================
# Order: priority rows, then statistics and the manifest, then the backlog
# ============================================================
def test_manifest_follows_the_priority_rows_and_precedes_the_backlog():
    with isolated_worker():
        conn, _ = build_world(SLOT_REFRESH)
        session, (pushed, quarantined, rate_limited, manifests) = run_pass(conn)
        runs = []
        for kind in session.kinds():
            if runs and runs[-1][0] == kind:
                runs[-1][1] += 1
            else:
                runs.append([kind, 1])
        assert runs == [['row', 386], ['stats', 1], ['manifest', 1], ['row', 114]], runs
        assert (pushed, quarantined, rate_limited, manifests) == (500, 0, False, 1)


def test_backlog_is_oldest_first_within_the_500_row_budget():
    with isolated_worker():
        conn, info = build_world(SLOT_REFRESH)
        priority = expected_priority(SLOT_REFRESH, info['m5_newest'], info['m15_newest'])
        everything = conn.execute("SELECT timeframe, timestamp FROM market_data "
                                  "ORDER BY timestamp ASC, timeframe ASC").fetchall()
        expected_backlog = [r for r in everything if tuple(r) not in priority][:114]

        session, _ = run_pass(conn)
        rows = session.rows()
        assert len(rows) == worker.MAX_ROWS_PER_CYCLE == 500
        backlog = rows[386:]
        assert [key(r) for r in backlog] == [tuple(r) for r in expected_backlog], \
            'the backlog is not the 114 OLDEST unsent rows, in order'


def test_every_row_is_eventually_sent_exactly_once():
    """No priority row is re-sent and nothing is lost: the oldest-first backlog
    still empties the whole outbox, stragglers included."""
    with isolated_worker():
        conn, _ = build_world(SLOT_REFRESH)
        session = FakeSession()
        passes = 0
        while worker.unsynced_count(conn) and passes < 40:
            run_pass(conn, session)
            passes += 1
        sent = [key(r) for r in session.rows()]
        assert worker.unsynced_count(conn) == 0
        assert len(sent) == 6000 and len(set(sent)) == 6000, (len(sent), len(set(sent)))
        assert passes == 12, f'expected 1 priority pass + 11 backlog passes, got {passes}'


def test_stragglers_older_than_the_window_drain_first_in_the_backlog():
    """Oldest-first is kept on purpose: rows that scrolled out of MT5's window
    while unsent are only ever sent by the backlog, and it must reach them."""
    with isolated_worker():
        conn, info = build_world(SLOT_REFRESH)
        # older than EVERYTHING in the window, M15's longer reach included
        oldest_any = conn.execute("SELECT MIN(timestamp) FROM market_data").fetchone()[0]
        stragglers = add_bars(conn, 'M5', oldest_any - 300, 40, info['m5_cycle'])
        session, _ = run_pass(conn)
        backlog = session.rows()[386:]
        assert [r['timestamp'] for r in backlog[:40]] == stragglers, \
            'the oldest rows were not the first backlog rows'
        assert all(r['timeframe'] == 'M5' for r in backlog[:40])


def test_the_full_requeue_never_starves_the_newest_bars():
    """Section 1.8: with the full 3,000-bar re-queue, the cycle's newest bars
    still land first. The harder case: a backlog from the PREVIOUS cycle is
    still queued when the next cycle arrives and re-queues everything."""
    with isolated_worker():
        conn, _ = build_world(SLOT_REFRESH)
        run_pass(conn)                                  # leaves 5,500 rows unsent

        nxt = SLOT_REFRESH + 300                        # a plain slot: M5 only
        cycle = add_cycle(conn, nxt, 'M5', newest_bar_ts=nxt)
        add_bars(conn, 'M5', nxt, 1, cycle)
        add_stats(conn, cycle, 'M5', nxt)
        conn.execute("UPDATE market_data SET synced_at = NULL")   # the collector's INSERT OR REPLACE
        conn.commit()
        assert worker.unsynced_count(conn) > 6000

        session, _ = run_pass(conn, now=nxt + 60)
        first = session.rows()[:289]
        assert {key(r) for r in first} == expected_priority(nxt, nxt), \
            'the new cycle\'s newest bars did not go first behind the old backlog'
        assert first[0]['timestamp'] == nxt
        assert session.kinds()[289:292] == ['stats', 'manifest', 'row'], session.kinds()[289:292]


# ============================================================
# Failures stop everything behind them
# ============================================================
def test_network_error_mid_priority_sends_no_manifest_and_no_backlog():
    with isolated_worker():
        conn, _ = build_world(SLOT_REFRESH)
        session = FakeSession(always('row', requests.ConnectionError('down'), from_n=100))
        pushed, quarantined, rate_limited, manifests = worker.push_cycle(session, conn, now=SLOT_REFRESH + 60)
        assert pushed == 100 and manifests == 0
        assert session.kinds() == ['row'] * 101, 'nothing may be attempted behind a failure'
        assert conn.execute("SELECT COUNT(*) FROM cycle_manifests").fetchone()[0] == 0
        assert worker.unsynced_count(conn) == 6000 - 100


def test_rate_limit_mid_priority_stops_and_says_so():
    with isolated_worker():
        conn, _ = build_world(SLOT_REFRESH)
        session = FakeSession(always('row', 429, from_n=50))
        pushed, _, rate_limited, manifests = worker.push_cycle(session, conn, now=SLOT_REFRESH + 60)
        assert rate_limited is True and pushed == 50 and manifests == 0
        assert session.kinds() == ['row'] * 51


def test_auth_failure_and_server_errors_stop_the_pass():
    for status in (401, 403, 500, 503):
        with isolated_worker():
            conn, _ = build_world(SLOT_REFRESH)
            session = FakeSession(always('row', status, from_n=0))
            pushed, quarantined, _, manifests = worker.push_cycle(session, conn, now=SLOT_REFRESH + 60)
            assert (pushed, quarantined, manifests) == (0, 0, 0), status
            assert session.kinds() == ['row'], f'HTTP {status} did not stop the pass'
            assert worker.unsynced_count(conn) == 6000, 'a failed row must stay unsent'


def test_a_rejected_priority_row_is_quarantined_and_the_manifest_says_so():
    with isolated_worker() as tmp:
        conn, _ = build_world(SLOT_REFRESH)
        # only the 8th row (n == 7) is rejected: every other row succeeds
        session = FakeSession(lambda kind, n, body: 400 if kind == 'row' and n == 7 else None)
        pushed, quarantined, _, manifests = worker.push_cycle(session, conn, now=SLOT_REFRESH + 60)
        assert quarantined == 1 and manifests == 1
        assert pushed == 499
        rejected = session.rows()[7]
        stamped = conn.execute("SELECT synced_at FROM market_data WHERE timeframe = ? AND timestamp = ?",
                               (rejected['timeframe'], rejected['timestamp'])).fetchone()[0]
        assert stamped is not None, 'a poison row must be stamped so it cannot block the outbox'
        assert worker.REJECTED_ROWS_FILE.exists(), 'the rejected row must be preserved for replay'
        section = session.manifests()[0]['timeframes'][rejected['timeframe']]
        assert section['quarantined_rows'] == 1
        other = 'M15' if rejected['timeframe'] == 'M5' else 'M5'
        assert session.manifests()[0]['timeframes'][other]['quarantined_rows'] == 0
        assert tmp.exists()


# ============================================================
# Shutdown, the old collector, and the unchanged backlog drain
# ============================================================
def test_shutdown_request_stops_the_pass_before_any_post():
    with isolated_worker():
        conn, _ = build_world(SLOT_REFRESH)
        worker.shutdown_requested = True
        session, result = run_pass(conn)
        assert session.posts == [] and result[0] == 0


def old_shape_db(slot=SLOT_REFRESH):
    """A database a collector without this change created: collection_cycles has
    none of the four fact columns and there is no manifest outbox."""
    conn, info = build_world(slot)
    conn.execute("PRAGMA foreign_keys = OFF")        # the schema file switches it on; this is table surgery
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
        INSERT INTO collection_cycles (cycle_time, timeframe, attempt, status, created_at)
            VALUES (%d, 'M5', 1, 'validated', %d);
        DROP TABLE cycle_manifests;
    """ % (slot, slot + 5))
    return conn


def test_an_old_collector_database_is_reported_once_not_silently_ignored():
    """A worker updated before its collector must say why newest-first is off."""
    with isolated_worker():
        conn = old_shape_db()
        with captured_warnings() as records:
            for _ in range(3):
                worker.cycle_facts_available(conn)
        messages = [r.getMessage() for r in records]
        assert len(messages) == 1, messages
        assert 'collection_cycles' in messages[0] and 'OFF' in messages[0]


def test_an_old_collector_database_falls_back_to_oldest_first_and_does_not_crash():
    with isolated_worker():
        conn = old_shape_db()
        assert worker.cycle_facts_available(conn) is False
        assert worker.manifest_work_pending(conn, SLOT_REFRESH + 60) is False
        session = FakeSession()
        pushed, quarantined, rate_limited, manifests = worker.push_cycle(session, conn, now=SLOT_REFRESH + 60)
        stamps = [r['timestamp'] for r in session.rows()]
        assert (pushed, manifests) == (500, 0) and session.kinds() == ['row'] * 500
        assert stamps == sorted(stamps), 'without the new columns the drain must stay oldest-first'


def test_push_batch_still_drains_oldest_first_and_honours_a_limit():
    with isolated_worker():
        conn, _ = build_world(SLOT_REFRESH)
        session = FakeSession()
        pushed, quarantined, rate_limited = worker.push_batch(session, conn)
        stamps = [r['timestamp'] for r in session.rows()]
        assert pushed == 500 and stamps == sorted(stamps)
        session2 = FakeSession()
        assert worker.push_batch(session2, conn, limit=10)[0] == 10
        assert [r['timestamp'] for r in session2.rows()] == sorted(r['timestamp'] for r in session2.rows())


# ============================================================
# The numbers agree with the document and with the collector
# ============================================================
def test_priority_constants_match_rule_4_of_the_architecture():
    arch = (REPO / 'docs' / 'STACK-D-ARCHITECTURE.md').read_text(encoding='utf-8')
    rule4 = re.search(r'the last (\d+) closed M5 bars and (\d+) closed M15 bars', arch)
    assert rule4, 'rule 4 wording changed: update this test and the worker together'
    assert worker.PRIORITY_CLOSED_BARS == {'M5': int(rule4.group(1)), 'M15': int(rule4.group(2))}


def test_priority_set_fits_the_row_budget():
    most = sum(n + 1 for n in worker.PRIORITY_CLOSED_BARS.values())     # + each timeframe's newest row
    assert most == 386
    assert most <= worker.MAX_ROWS_PER_CYCLE, 'the priority set must leave room for the budget'
    assert worker.MAX_ROWS_PER_CYCLE - most == 114


def test_slot_and_attempt_constants_match_the_collector():
    assert worker.SLOT_SECONDS == collector.CYCLE_INTERVAL_SEC
    assert worker.TF_SECONDS == collector.TF_SECONDS
    assert worker.COLLECTOR_MAX_ATTEMPTS == collector.MAX_ATTEMPTS_PER_CYCLE
    # the M15 wait must outlast the collector's whole retry budget, or a retried M15 is cut off
    assert worker.M15_SETTLE_SEC >= (collector.MAX_ATTEMPTS_PER_CYCLE - 1) * collector.RETRY_WAIT_SEC


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
