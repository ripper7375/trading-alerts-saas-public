"""Tests for the economic-events push lane in backfill_worker_api_gateway_v5.

Run either way (there is no pytest config in this stack, and pytest is not
installed on the dev box):

    python test_push_economic_events.py
    python -m pytest test_push_economic_events.py -q

The properties worth protecting are the isolation guarantees. This lane must
never be able to delay, fail or influence price ingestion, and it must not
turn a 333-row first sync into 333 sequential HTTP requests -- market_data's
one-POST-per-row shape is already under-provisioned for its own volume
(PUSH-WORKER-THROUGHPUT-OPEN-ISSUE.md).
"""
import json
import sqlite3
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import backfill_worker_api_gateway_v5 as worker  # noqa: E402

SCHEMA = Path(__file__).resolve().parent / 'sqlite_schema_v6_xauusd.sql'

BASE = {
    'value_id': '18446744073709551615',
    'captured_at': 1789000000,
    'event_id': '840010013',
    'event_time': 1789012345,
    'event_period': None,
    'revision': 0,
    'country_code': 'MX',
    'currency': 'MXN',
    'event_name': 'Banco de México Rate Decision',
    'importance': 'HIGH',
    'event_type': 1, 'sector': 2, 'frequency': 3, 'time_mode': 0,
    'unit': 4, 'multiplier': 0, 'digits': 2,
    'event_code': 'MX-RATE', 'source_url': 'https://banxico.org.mx',
    'actual_value': None,          # not published
    'forecast_value': -0.30,
    'prev_value': 0.0,             # a REAL zero
    'revised_prev_value': None,
    'impact_type': 2,
}


class FakeResponse:
    def __init__(self, status_code, text=''):
        self.status_code = status_code
        self.text = text


class FakeSession:
    """Records every POST so batching and payload shape can be asserted."""

    def __init__(self, status=200, raise_exc=None):
        self.posts = []
        self.status = status
        self.raise_exc = raise_exc

    def post(self, url, json=None, timeout=None):
        self.posts.append((url, json))
        if self.raise_exc:
            raise self.raise_exc
        return FakeResponse(self.status, text='gateway said no')


def fresh_db(n_rows=1) -> sqlite3.Connection:
    conn = sqlite3.connect(':memory:')
    conn.executescript(SCHEMA.read_text(encoding='utf-8'))
    cols = list(BASE.keys())
    for i in range(n_rows):
        row = dict(BASE)
        row['value_id'] = str(int(BASE['value_id']) - i)
        conn.execute(
            f"INSERT INTO economic_events ({', '.join(cols)}) "
            f"VALUES ({', '.join('?' * len(cols))})", [row[c] for c in cols])
    conn.commit()
    return conn


def synced(conn):
    return conn.execute(
        "SELECT COUNT(*) FROM economic_events WHERE synced_at IS NOT NULL").fetchone()[0]


def with_temp_quarantine(fn):
    """Keep the 400-path from writing to the real C:/Scripts location."""
    def wrapper():
        original = worker.REJECTED_EVENTS_FILE
        with tempfile.TemporaryDirectory() as d:
            worker.REJECTED_EVENTS_FILE = Path(d) / 'rejected_economic_events.jsonl'
            try:
                return fn()
            finally:
                worker.REJECTED_EVENTS_FILE = original
    wrapper.__name__ = fn.__name__
    return wrapper


# ------------------------------------------------------------- happy path

def test_success_stamps_synced_and_returns_count():
    conn, session = fresh_db(3), FakeSession(200)
    assert worker.push_economic_events(session, conn) == 3
    assert synced(conn) == 3


def test_nothing_unsynced_makes_no_http_call():
    conn, session = fresh_db(2), FakeSession(200)
    worker.push_economic_events(session, conn)
    session.posts.clear()
    assert worker.push_economic_events(session, conn) == 0
    assert session.posts == [], 'posted with an empty outbox'


def test_many_rows_go_in_ONE_request():
    """The throughput point. market_data posts one row per request; inheriting
    that here would make the first sync 333 sequential round trips."""
    conn, session = fresh_db(120), FakeSession(200)
    assert worker.push_economic_events(session, conn) == 120
    assert len(session.posts) == 1, f'{len(session.posts)} requests for 120 rows'
    assert len(session.posts[0][1]) == 120


def test_batch_cap_is_respected():
    conn = fresh_db(worker.EVENT_MAX_ROWS_PER_CYCLE + 25)
    session = FakeSession(200)
    pushed = worker.push_economic_events(session, conn)
    assert pushed == worker.EVENT_MAX_ROWS_PER_CYCLE
    # the remainder is left unsynced for the next cycle, not dropped
    remaining = conn.execute(
        "SELECT COUNT(*) FROM economic_events WHERE synced_at IS NULL").fetchone()[0]
    assert remaining == 25


# ------------------------------------------------------------ payload shape

def test_payload_carries_terminal_id_and_hits_the_right_endpoint():
    conn, session = fresh_db(1), FakeSession(200)
    worker.push_economic_events(session, conn)
    url, payload = session.posts[0]
    assert url.endswith('/api/v1/economic-events')
    assert payload[0]['terminal_id'] == worker.TERMINAL_ID


def test_nulls_survive_as_json_null_not_zero():
    """If a NULL ever serialised as 0, the gateway would record that the market
    knew a 0.0 actual before the release."""
    conn, session = fresh_db(1), FakeSession(200)
    worker.push_economic_events(session, conn)
    item = session.posts[0][1][0]
    assert item['actual_value'] is None
    assert item['revised_prev_value'] is None
    assert item['event_period'] is None
    # ...and a genuine zero is still a zero
    assert item['prev_value'] == 0.0

    encoded = json.loads(json.dumps(item))
    assert encoded['actual_value'] is None
    assert encoded['prev_value'] == 0.0


def test_ids_stay_strings_on_the_wire():
    conn, session = fresh_db(1), FakeSession(200)
    worker.push_economic_events(session, conn)
    item = session.posts[0][1][0]
    assert isinstance(item['value_id'], str)
    assert isinstance(item['event_id'], str)
    assert item['value_id'] == '18446744073709551615'


def test_payload_matches_the_gateway_contract_exactly():
    contract = json.loads(
        (Path(__file__).resolve().parent
         / 'gateway_contract_economic_events.schema.json').read_text(encoding='utf-8'))
    allowed = set(contract['properties'])
    required = set(contract['required'])

    conn, session = fresh_db(1), FakeSession(200)
    worker.push_economic_events(session, conn)
    item = session.posts[0][1][0]

    assert not (set(item) - allowed), f'extra fields: {sorted(set(item) - allowed)}'
    assert not (required - set(item)), f'missing required: {sorted(required - set(item))}'
    # additionalProperties is false, so an extra key would be a 400 at runtime
    assert contract['additionalProperties'] is False


# ------------------------------------------------------------ failure paths

@with_temp_quarantine
def test_400_quarantines_and_unblocks_the_outbox():
    """A poison row must not wedge the outbox forever: it is written to the
    .jsonl for replay AND stamped, so the next cycle can make progress."""
    conn, session = fresh_db(2), FakeSession(400)
    assert worker.push_economic_events(session, conn) == 0
    assert synced(conn) == 2, 'poison rows left unstamped -> outbox wedged'

    lines = worker.REJECTED_EVENTS_FILE.read_text(encoding='utf-8').strip().split('\n')
    assert len(lines) == 2
    record = json.loads(lines[0])
    assert record['gateway_error'] == 'gateway said no'
    assert record['row']['value_id'] == BASE['value_id']


def test_500_leaves_rows_unsynced_for_retry():
    conn, session = fresh_db(2), FakeSession(503)
    assert worker.push_economic_events(session, conn) == 0
    assert synced(conn) == 0, 'a transient failure must not stamp rows'


def test_network_exception_is_swallowed():
    """Isolation guarantee: this lane can never raise into the market_data loop."""
    conn = fresh_db(2)
    session = FakeSession(raise_exc=OSError('connection reset'))
    assert worker.push_economic_events(session, conn) == 0
    assert synced(conn) == 0


def test_missing_table_is_swallowed():
    """Before the migration is applied the table does not exist. That must be a
    no-op, not a crash that takes the worker down."""
    conn = sqlite3.connect(':memory:')
    assert worker.push_economic_events(FakeSession(200), conn) == 0


def test_market_data_untouched_by_any_path():
    for status in (200, 400, 503):
        conn = fresh_db(2)
        original = worker.REJECTED_EVENTS_FILE
        with tempfile.TemporaryDirectory() as d:
            worker.REJECTED_EVENTS_FILE = Path(d) / 'q.jsonl'
            try:
                worker.push_economic_events(FakeSession(status), conn)
            finally:
                worker.REJECTED_EVENTS_FILE = original
        n = conn.execute("SELECT COUNT(*) FROM market_data").fetchone()[0]
        assert n == 0, f'market_data touched on HTTP {status}'


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
