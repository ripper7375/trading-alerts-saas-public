"""Tests for the symbol-specs push lane in backfill_worker_api_gateway_v5
(build step 2 part 8; ADR-066).

Run either way (there is no pytest config in this stack):

    python test_push_symbol_specs.py
    python -m pytest test_push_symbol_specs.py -q

The properties worth protecting are the same as for the other lanes: this one
must never be able to delay, fail or influence price ingestion; a row the
gateway has not acknowledged must be sent again; and a poison row must not wedge
the outbox. It also has one of its own: terminal_id on the wire is the MT5
terminal the figures were read from, not the worker's sender id.
"""
import inspect
import json
import logging
import re
import sqlite3
import sys
import tempfile
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent))

import backfill_worker_api_gateway_v5 as worker  # noqa: E402

try:
    import jsonschema
except ImportError:                                             # pragma: no cover
    jsonschema = None

HERE = Path(__file__).resolve().parent
SCHEMA = HERE / 'sqlite_schema_v6_xauusd.sql'
CONTRACT = json.loads((HERE / 'gateway_contract_symbol_specs.schema.json').read_text(encoding='utf-8'))
DAY = 86400
T0 = 1789000000

BASE = {
    'terminal_id': 'MT5-A', 'symbol': 'XAUUSD', 'captured_at': T0,
    'contract_size': 100.0, 'volume_min': 0.01, 'volume_step': 0.01, 'volume_max': 100.0,
    'tick_size': 0.01, 'typical_spread': 18.0, 'swap_long': -25.3, 'swap_short': 0.0,   # a REAL zero
    'point': 0.01, 'digits': 2, 'swap_mode': 1,
}


class FakeResponse:
    def __init__(self, status_code, text=''):
        self.status_code = status_code
        self.text = text


class FakeSession:
    """Records every POST. `statuses` is a list answered in order (the last one
    repeats); `raise_exc` is raised instead of answering."""

    def __init__(self, status=200, raise_exc=None, statuses=None):
        self.posts = []
        self.statuses = list(statuses) if statuses else [status]
        self.raise_exc = raise_exc

    def post(self, url, json=None, timeout=None):
        self.posts.append((url, json))
        if self.raise_exc:
            raise self.raise_exc
        status = self.statuses.pop(0) if len(self.statuses) > 1 else self.statuses[0]
        return FakeResponse(status, text='gateway said no')


def fresh_db(n_rows=1, newest_first=False) -> sqlite3.Connection:
    conn = sqlite3.connect(':memory:')
    conn.row_factory = sqlite3.Row            # as the worker's own open_db() sets it
    conn.executescript(SCHEMA.read_text(encoding='utf-8'))
    cols = list(BASE.keys())
    for i in range(n_rows):
        row = dict(BASE)
        row['captured_at'] = T0 + i * DAY
        conn.execute(f"INSERT INTO symbol_specs ({', '.join(cols)}) VALUES ({', '.join('?' * len(cols))})",
                     [row[c] for c in cols])
    conn.commit()
    if newest_first:
        # insertion order is not observation order (a replayed older row)
        conn.execute("UPDATE symbol_specs SET id = id + 1000")
        conn.commit()
    return conn


def count(conn, where):
    return conn.execute(f"SELECT COUNT(*) FROM symbol_specs WHERE {where}").fetchone()[0]


def with_temp_quarantine(fn):
    """Keep the 400 path from writing to the real C:/Scripts location."""
    def wrapper():
        original = worker.REJECTED_SPECS_FILE
        with tempfile.TemporaryDirectory() as d:
            worker.REJECTED_SPECS_FILE = Path(d) / 'rejected_symbol_specs.jsonl'
            try:
                return fn()
            finally:
                worker.REJECTED_SPECS_FILE = original
    wrapper.__name__ = fn.__name__
    return wrapper


# ------------------------------------------------------------- happy path

def test_success_stamps_synced_and_returns_count():
    conn, session = fresh_db(3), FakeSession(200)
    assert worker.push_symbol_specs(session, conn) == 3
    assert count(conn, 'synced_at IS NOT NULL') == 3
    assert count(conn, 'last_error IS NOT NULL') == 0
    assert count(conn, 'send_attempts = 0') == 3, 'a delivered row is not a failed attempt'


def test_a_201_is_an_acknowledgement_too():
    conn = fresh_db(1)
    assert worker.push_symbol_specs(FakeSession(201), conn) == 1
    assert count(conn, 'synced_at IS NOT NULL') == 1


def test_nothing_unsynced_makes_no_http_call():
    conn, session = fresh_db(2), FakeSession(200)
    worker.push_symbol_specs(session, conn)
    session.posts.clear()
    assert worker.push_symbol_specs(session, conn) == 0
    assert session.posts == [], 'posted with an empty outbox'


def test_an_empty_table_makes_no_http_call():
    session = FakeSession(200)
    assert worker.push_symbol_specs(session, fresh_db(0)) == 0
    assert session.posts == []


def test_many_rows_go_in_ONE_request_as_an_array():
    conn, session = fresh_db(5), FakeSession(200)
    assert worker.push_symbol_specs(session, conn) == 5
    assert len(session.posts) == 1
    assert isinstance(session.posts[0][1], list) and len(session.posts[0][1]) == 5


def test_batch_cap_is_respected_and_the_remainder_is_left_for_the_next_pass():
    conn = fresh_db(worker.SPEC_MAX_ROWS_PER_CYCLE + 5)
    session = FakeSession(200)
    assert worker.push_symbol_specs(session, conn) == worker.SPEC_MAX_ROWS_PER_CYCLE
    assert count(conn, 'synced_at IS NULL') == 5
    assert worker.push_symbol_specs(session, conn) == 5            # the main loop's drain
    assert count(conn, 'synced_at IS NULL') == 0


# ------------------------------------------------------------ payload shape

def test_payload_hits_the_right_endpoint():
    conn, session = fresh_db(1), FakeSession(200)
    worker.push_symbol_specs(session, conn)
    assert session.posts[0][0].endswith('/api/v1/symbol-specs')
    assert session.posts[0][0] == worker.API_GATEWAY_URL + '/api/v1/symbol-specs'


def test_terminal_id_is_the_terminal_the_figures_came_from_not_the_senders():
    conn, session = fresh_db(1), FakeSession(200)
    worker.push_symbol_specs(session, conn)
    item = session.posts[0][1][0]
    assert item['terminal_id'] == 'MT5-A'
    assert item['terminal_id'] != worker.TERMINAL_ID


def test_oldest_observation_goes_first_so_the_gateway_numbers_versions_in_order():
    conn, session = fresh_db(4, newest_first=True), FakeSession(200)
    # make insertion (id) order the REVERSE of observation order
    conn.execute("UPDATE symbol_specs SET id = 5000 - (captured_at - ?) / ?", (T0, DAY))
    conn.commit()
    worker.push_symbol_specs(session, conn)
    sent = [i['captured_at'] for i in session.posts[0][1]]
    assert sent == sorted(sent) and len(sent) == 4


def test_numbers_stay_numbers_and_a_real_zero_stays_zero():
    conn, session = fresh_db(1), FakeSession(200)
    worker.push_symbol_specs(session, conn)
    item = session.posts[0][1][0]
    assert item['swap_short'] == 0.0 and item['swap_short'] is not None
    assert item['swap_long'] == -25.3
    assert isinstance(item['digits'], int) and isinstance(item['swap_mode'], int)
    assert isinstance(item['captured_at'], int) and isinstance(item['contract_size'], float)
    encoded = json.loads(json.dumps(item))
    assert encoded == item


def test_payload_matches_the_gateway_contract_exactly():
    allowed = set(CONTRACT['properties'])
    required = set(CONTRACT['required'])
    conn, session = fresh_db(2), FakeSession(200)
    worker.push_symbol_specs(session, conn)
    for item in session.posts[0][1]:
        assert not (set(item) - allowed), f'extra fields: {sorted(set(item) - allowed)}'
        assert not (required - set(item)), f'missing required: {sorted(required - set(item))}'
        # bookkeeping of the outbox must never leak onto the wire
        for private in ('id', 'synced_at', 'send_attempts', 'last_error'):
            assert private not in item
    assert CONTRACT['additionalProperties'] is False


def test_payload_validates_against_the_contract_schema():
    assert jsonschema is not None, 'the contract tests need the jsonschema package (pip install jsonschema)'
    validator = jsonschema.Draft202012Validator(CONTRACT)
    jsonschema.Draft202012Validator.check_schema(CONTRACT)
    conn, session = fresh_db(2), FakeSession(200)
    worker.push_symbol_specs(session, conn)
    for item in session.posts[0][1]:
        assert list(validator.iter_errors(item)) == []


# ------------------------------------------------------------ failure paths

@with_temp_quarantine
def test_400_quarantines_and_unblocks_the_outbox():
    """A poison row must not wedge the outbox forever: it is written to the
    .jsonl for replay AND stamped, so the next pass can make progress."""
    conn, session = fresh_db(2), FakeSession(400)
    assert worker.push_symbol_specs(session, conn) == 0
    assert count(conn, 'synced_at IS NOT NULL') == 2, 'poison rows left unstamped -> outbox wedged'
    assert count(conn, "last_error LIKE 'rejected 400: gateway said no%'") == 2

    lines = worker.REJECTED_SPECS_FILE.read_text(encoding='utf-8').strip().split('\n')
    assert len(lines) == 2
    record = json.loads(lines[0])
    assert record['gateway_error'] == 'gateway said no'
    assert record['row']['symbol'] == 'XAUUSD' and record['row']['captured_at'] == T0
    assert 'quarantined_at' in record


@with_temp_quarantine
def test_after_a_400_the_next_row_goes_through():
    conn = fresh_db(1)
    assert worker.push_symbol_specs(FakeSession(400), conn) == 0
    cols = list(BASE.keys())
    row = dict(BASE, captured_at=T0 + DAY)
    conn.execute(f"INSERT INTO symbol_specs ({', '.join(cols)}) VALUES ({', '.join('?' * len(cols))})",
                 [row[c] for c in cols])
    conn.commit()
    session = FakeSession(200)
    assert worker.push_symbol_specs(session, conn) == 1
    assert [i['captured_at'] for i in session.posts[0][1]] == [T0 + DAY], 'the quarantined row was sent again'


def test_a_400_still_unblocks_when_the_quarantine_file_cannot_be_written():
    original = worker.REJECTED_SPECS_FILE
    worker.REJECTED_SPECS_FILE = Path(tempfile.gettempdir()) / 'no-such-dir-for-specs' / 'x.jsonl'
    try:
        conn = fresh_db(1)
        assert worker.push_symbol_specs(FakeSession(400), conn) == 0     # no exception
        assert count(conn, 'synced_at IS NOT NULL') == 1
    finally:
        worker.REJECTED_SPECS_FILE = original


def test_any_other_status_leaves_rows_unsynced_and_says_why():
    for status in (404, 429, 401, 403, 500, 502, 503):
        conn, session = fresh_db(2), FakeSession(status)
        assert worker.push_symbol_specs(session, conn) == 0
        assert count(conn, 'synced_at IS NOT NULL') == 0, f'HTTP {status} stamped rows'
        assert count(conn, f"send_attempts = 1 AND last_error = 'HTTP {status}'") == 2, status


def test_a_404_from_a_gateway_without_the_endpoint_is_a_retry_not_a_quarantine():
    """The lane ships before the gateway does, or after: either order is safe."""
    original = worker.REJECTED_SPECS_FILE
    with tempfile.TemporaryDirectory() as d:
        worker.REJECTED_SPECS_FILE = Path(d) / 'q.jsonl'
        try:
            conn = fresh_db(1)
            worker.push_symbol_specs(FakeSession(404), conn)
            assert not worker.REJECTED_SPECS_FILE.exists()
            assert count(conn, 'synced_at IS NULL') == 1
        finally:
            worker.REJECTED_SPECS_FILE = original


def test_a_failed_send_is_retried_with_the_identical_payload_and_then_stamped():
    conn = fresh_db(2)
    session = FakeSession(statuses=[503, 200])
    assert worker.push_symbol_specs(session, conn) == 0
    assert worker.push_symbol_specs(session, conn) == 2
    assert session.posts[0][1] == session.posts[1][1], 'a retry must send exactly what the first send did'
    assert count(conn, 'synced_at IS NOT NULL') == 2
    assert count(conn, 'send_attempts = 1') == 2
    assert count(conn, 'last_error IS NOT NULL') == 0, 'a delivered row keeps no stale error'


def test_send_attempts_count_up_across_failures():
    conn, session = fresh_db(1), FakeSession(500)
    for _ in range(3):
        worker.push_symbol_specs(session, conn)
    assert count(conn, 'send_attempts = 3') == 1


def test_network_exceptions_are_swallowed_and_counted():
    for exc in (OSError('connection reset'), requests.Timeout('slow'), requests.ConnectionError('down'),
                RuntimeError('anything')):
        conn = fresh_db(2)
        assert worker.push_symbol_specs(FakeSession(raise_exc=exc), conn) == 0
        assert count(conn, 'synced_at IS NOT NULL') == 0
        assert count(conn, "send_attempts = 1 AND last_error LIKE 'network error:%'") == 2


def test_the_error_text_is_bounded():
    conn = fresh_db(1)
    worker.push_symbol_specs(FakeSession(raise_exc=OSError('x' * 5000)), conn)
    (err,) = conn.execute("SELECT last_error FROM symbol_specs").fetchone()
    assert len(err) <= 300


def test_missing_table_is_swallowed_and_said_once():
    """Before the new collector has opened the database the table does not exist.
    That must be a no-op, not a crash that takes the worker down, and not a
    warning every 30 seconds."""
    records = []

    class Capture(logging.Handler):
        def emit(self, record):
            records.append(record.getMessage())

    handler = Capture()
    worker.logger.addHandler(handler)
    worker._symbol_specs_table_warned = False
    try:
        session = FakeSession(200)
        for _ in range(3):
            assert worker.push_symbol_specs(session, sqlite3.connect(':memory:')) == 0
        assert session.posts == []
        assert len([m for m in records if 'symbol_specs table is missing' in m]) == 1
    finally:
        worker.logger.removeHandler(handler)
        worker._symbol_specs_table_warned = False


def test_a_database_error_is_swallowed():
    class BrokenConn:
        def execute(self, *_a, **_k):
            raise sqlite3.OperationalError('database is locked')

        def executemany(self, *_a, **_k):
            raise sqlite3.OperationalError('database is locked')

        def commit(self):
            raise sqlite3.OperationalError('database is locked')

    assert worker.push_symbol_specs(FakeSession(200), BrokenConn()) == 0


def test_a_database_error_while_stamping_is_swallowed_and_the_row_is_sent_again():
    """The gateway took the row but the stamp could not be written: the worker
    must not crash, and the next pass sends the row again (the gateway absorbs a
    repeat on (symbol, captured_at))."""
    conn = fresh_db(1)

    class FlakyConn:
        def __init__(self, inner):
            self.inner = inner
            self.fail = True

        def execute(self, *a, **k):
            return self.inner.execute(*a, **k)

        def executemany(self, *a, **k):
            if self.fail:
                raise sqlite3.OperationalError('database is locked')
            return self.inner.executemany(*a, **k)

        def commit(self):
            return self.inner.commit()

    flaky = FlakyConn(conn)
    session = FakeSession(200)
    assert worker.push_symbol_specs(session, flaky) == 0
    assert count(conn, 'synced_at IS NOT NULL') == 0
    flaky.fail = False
    assert worker.push_symbol_specs(session, flaky) == 1
    assert len(session.posts) == 2


def test_market_data_and_the_other_outboxes_are_untouched_by_any_path():
    for status in (200, 400, 404, 503):
        conn = fresh_db(2)
        original = worker.REJECTED_SPECS_FILE
        with tempfile.TemporaryDirectory() as d:
            worker.REJECTED_SPECS_FILE = Path(d) / 'q.jsonl'
            try:
                worker.push_symbol_specs(FakeSession(status), conn)
            finally:
                worker.REJECTED_SPECS_FILE = original
        for table in ('market_data', 'economic_events', 'indicator_statistics', 'cycle_manifests'):
            n = conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
            assert n == 0, f'{table} touched on HTTP {status}'
        cols = [r[1] for r in conn.execute("PRAGMA table_info(market_data)")]
        assert len(cols) == 103


# ------------------------------------------------------- where the lane sits

def test_the_lane_runs_fourth_after_prices_statistics_and_the_calendar():
    """In both branches of the main loop, in the order the order names."""
    source = inspect.getsource(worker.main)
    idle = source.split('if backlog == 0 and not manifest_due:')[1].split('continue')[0]
    active = source.split('if backlog == 0 and not manifest_due:')[1].split('continue')[1] \
        .split('if pushed or quarantined or manifests:')[0]
    for branch, names in ((idle, ('push_statistics(', 'push_economic_events(', 'push_symbol_specs(')),
                          (active, ('push_cycle(', 'push_statistics(', 'push_economic_events(',
                                    'push_symbol_specs('))):
        order = [branch.index(name) for name in names]
        assert order == sorted(order), f'wrong order in the branch: {names}'


def test_the_priority_price_lane_does_not_call_it():
    """Prices never wait for the broker's figures: the specs lane is not part of
    push_cycle, whose result decides the backoff."""
    assert 'push_symbol_specs' not in inspect.getsource(worker.push_cycle)
    assert 'push_symbol_specs' not in inspect.getsource(worker.push_batch)


def test_the_main_loop_drains_until_a_short_batch_and_honours_shutdown():
    source = inspect.getsource(worker.main)
    assert len(re.findall(r'while push_symbol_specs\(session, conn\) == SPEC_MAX_ROWS_PER_CYCLE:\s+'
                          r'if shutdown_requested:\s+break', source)) == 2


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
