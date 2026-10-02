"""Tests for the collector's symbol-specs stage (build step 2 part 8; ADR-066).

Run either way -- there is no pytest config in this stack:

    python test_symbol_specs.py
    python -m pytest test_symbol_specs.py -q

What is protected here is SILENT failure, as in the calendar lane. If change
detection breaks open, the table gains a row every cycle; if it breaks shut, a
new contract size or lot step never reaches Engine 4 and it sizes lots from a
figure the broker no longer uses. Neither raises an error. And a snapshot from
the wrong chart (EURUSD's contract size of 100000, labelled XAUUSD) must never
get in at all.
"""
import json
import logging
import re
import sqlite3
import sys
import tempfile
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import backfill_worker_api_gateway_v5 as worker  # noqa: E402
import export_collector_validator_v2 as collector  # noqa: E402

HERE = Path(__file__).resolve().parent
SCHEMA = HERE / 'sqlite_schema_v6_xauusd.sql'
CONTRACT = json.loads((HERE / 'gateway_contract_symbol_specs.schema.json').read_text(encoding='utf-8'))
EXPORTER = HERE / 'mq5' / 'SymbolSpecsExport_v2_29.mq5'

TAB = chr(9)
DAY = 86400
T0 = 1789000000
HEADER = [c for c, _ in collector.SYMBOL_SPECS_COLUMNS]

# What a XAUUSD terminal reports: 100 oz a lot, a 0.01 lot step, a spread of 18
# points, a long swap that costs and a short swap that pays. A REAL 0 is data.
BASE = {
    'captured_at': T0, 'symbol': 'XAUUSD',
    'contract_size': 100.0, 'volume_min': 0.01, 'volume_step': 0.01, 'volume_max': 100.0,
    'tick_size': 0.01, 'typical_spread': 18.0, 'swap_long': -25.3, 'swap_short': 8.1,
    'point': 0.01, 'digits': 2, 'swap_mode': 1,
}


def snap(**overrides) -> dict:
    row = dict(BASE)
    row.update(overrides)
    return row


def fmt(value) -> str:
    """The way the MQL5 exporter prints a value: integers plain, reals to 8 places."""
    if isinstance(value, float):
        return f'{value:.8f}'
    return str(value)


def write_snapshot(directory: Path, row: dict, header=None, eol='\r\n') -> Path:
    """Write the file byte-for-byte the way the exporter does."""
    header = header or HEADER
    path = directory / collector.SYMBOL_SPECS_FILE
    path.write_bytes((TAB.join(header) + eol + TAB.join(fmt(row[c]) for c in header) + eol)
                     .encode('utf-8'))
    return path


def fresh_db() -> sqlite3.Connection:
    conn = sqlite3.connect(':memory:')
    conn.executescript(SCHEMA.read_text(encoding='utf-8'))
    return conn


def stored(conn, *cols):
    return list(conn.execute(f"SELECT {', '.join(cols)} FROM symbol_specs ORDER BY id"))


class Warnings:
    """What the collector tells the operator while the block runs. The log line is
    how a bad exporter file is noticed at all (the lane is silent by design)."""

    def __enter__(self):
        self.messages = []
        outer = self

        class Capture(logging.Handler):
            def emit(self, record):
                outer.messages.append(record.getMessage())

        self.handler = Capture()
        collector.logger.addHandler(self.handler)
        return self

    def __exit__(self, *_exc):
        collector.logger.removeHandler(self.handler)

    def said(self, fragment):
        return [m for m in self.messages if fragment in m]


def stage(conn, directory, row, now=None):
    write_snapshot(directory, row)
    return collector.stage_symbol_specs(conn, directory, now=T0 + 10 * DAY if now is None else now)


# ---------------------------------------------------------------- parsing

def test_parse_returns_typed_values():
    with tempfile.TemporaryDirectory() as d:
        row = collector.parse_symbol_specs_file(write_snapshot(Path(d), BASE))
    assert row == BASE
    assert isinstance(row['captured_at'], int) and isinstance(row['digits'], int)
    assert isinstance(row['swap_mode'], int)
    assert isinstance(row['contract_size'], float) and isinstance(row['swap_long'], float)


def test_parse_keeps_a_real_zero_and_a_negative_swap():
    """A swap of 0 is data (a swap-free account), a negative one is a cost, and a
    typical spread of 0 is allowed by the contract: none of them is 'missing'."""
    with tempfile.TemporaryDirectory() as d:
        row = collector.parse_symbol_specs_file(
            write_snapshot(Path(d), snap(swap_long=0.0, swap_short=-3.5, typical_spread=0.0)))
    assert row['swap_long'] == 0.0 and row['swap_short'] == -3.5 and row['typical_spread'] == 0.0


def test_parse_is_by_column_name_not_position():
    with tempfile.TemporaryDirectory() as d:
        header = list(reversed(HEADER)) + ['broker_note']
        path = Path(d) / collector.SYMBOL_SPECS_FILE
        path.write_bytes((TAB.join(header) + '\r\n'
                          + TAB.join(fmt(BASE[c]) if c in BASE else 'x' for c in header) + '\r\n')
                         .encode('utf-8'))
        assert collector.parse_symbol_specs_file(path) == BASE


def test_parse_reads_unix_line_endings_too():
    with tempfile.TemporaryDirectory() as d:
        assert collector.parse_symbol_specs_file(write_snapshot(Path(d), BASE, eol='\n')) == BASE


def test_parse_refuses_a_row_for_another_symbol():
    """The wrong chart. EURUSD's contract size must never be stored as gold's."""
    with tempfile.TemporaryDirectory() as d:
        eur = snap(symbol='EURUSD', contract_size=100000.0)
        assert collector.parse_symbol_specs_file(write_snapshot(Path(d), eur)) is None


def test_parse_takes_the_row_for_this_symbol_among_several():
    with tempfile.TemporaryDirectory() as d:
        path = Path(d) / collector.SYMBOL_SPECS_FILE
        other = snap(symbol='EURUSD', contract_size=100000.0)
        path.write_bytes((TAB.join(HEADER) + '\r\n'
                          + TAB.join(fmt(other[c]) for c in HEADER) + '\r\n'
                          + TAB.join(fmt(BASE[c]) for c in HEADER) + '\r\n').encode('utf-8'))
        assert collector.parse_symbol_specs_file(path) == BASE


def test_parse_refuses_a_missing_or_empty_column():
    """Every figure is required. An empty field must NEVER become a zero."""
    with tempfile.TemporaryDirectory() as d:
        for col in HEADER:
            path = Path(d) / collector.SYMBOL_SPECS_FILE
            header = [c for c in HEADER if c != col]
            path.write_bytes((TAB.join(header) + '\r\n'
                              + TAB.join(fmt(BASE[c]) for c in header) + '\r\n').encode('utf-8'))
            assert collector.parse_symbol_specs_file(path) is None, f'missing {col} accepted'

            path.write_bytes((TAB.join(HEADER) + '\r\n'
                              + TAB.join('' if c == col else fmt(BASE[c]) for c in HEADER)
                              + '\r\n').encode('utf-8'))
            assert collector.parse_symbol_specs_file(path) is None, f'empty {col} accepted'


def test_parse_refuses_a_value_that_is_not_a_number():
    with tempfile.TemporaryDirectory() as d:
        path = Path(d) / collector.SYMBOL_SPECS_FILE
        for col, bad in [('contract_size', 'abc'), ('contract_size', 'nan'), ('contract_size', 'inf'),
                         ('swap_long', '-inf'), ('digits', '2.5'), ('digits', 'two'),
                         ('captured_at', '17890000.5'), ('volume_min', '0,01')]:
            path.write_bytes((TAB.join(HEADER) + '\r\n'
                              + TAB.join(bad if c == col else fmt(BASE[c]) for c in HEADER)
                              + '\r\n').encode('utf-8'))
            assert collector.parse_symbol_specs_file(path) is None, f'{col}={bad} accepted'


IMPLAUSIBLE = [
    ('contract_size', 0.0), ('contract_size', -100.0),
    ('volume_min', 0.0), ('volume_step', 0.0), ('volume_step', -0.01),
    ('volume_max', 0.0), ('tick_size', 0.0), ('point', 0.0), ('point', -0.01),
    ('typical_spread', -1.0),
    ('digits', -1), ('swap_mode', -1),
    ('captured_at', 0), ('captured_at', -5), ('captured_at', 2147483648),
    ('digits', 2147483648), ('swap_mode', 2147483648),
]


def test_parse_refuses_implausible_figures():
    """The same rules as the exporter's own check and the gateway contract."""
    with tempfile.TemporaryDirectory() as d:
        for col, bad in IMPLAUSIBLE:
            assert collector.parse_symbol_specs_file(write_snapshot(Path(d), snap(**{col: bad}))) is None, \
                f'{col}={bad} accepted'
        # volume_max below volume_min is the one rule JSON Schema cannot express
        assert collector.parse_symbol_specs_file(
            write_snapshot(Path(d), snap(volume_min=1.0, volume_max=0.5))) is None


def test_parse_accepts_the_boundaries():
    with tempfile.TemporaryDirectory() as d:
        for override in (dict(volume_max=0.01), dict(captured_at=1), dict(captured_at=2147483647),
                         dict(digits=0), dict(swap_mode=0), dict(typical_spread=0.0)):
            assert collector.parse_symbol_specs_file(write_snapshot(Path(d), snap(**override))) \
                == snap(**override), f'{override} refused'


def test_parse_never_raises_on_a_bad_file():
    with tempfile.TemporaryDirectory() as d:
        path = Path(d) / collector.SYMBOL_SPECS_FILE
        for content in (b'', b'\r\n\r\n', (TAB.join(HEADER) + '\r\n').encode('utf-8'),
                        b'\xff\xfe\x00garbage', b'\x80\x81\x82', bytes(range(256))):
            path.write_bytes(content)
            assert collector.parse_symbol_specs_file(path) is None


def test_parse_refuses_a_file_that_is_not_there():
    with tempfile.TemporaryDirectory() as d:
        assert collector.parse_symbol_specs_file(Path(d) / 'nothing.txt') is None


def test_the_operator_is_told_why_a_file_was_refused():
    """The lane never raises, so the log line is the only way a broken exporter
    file is noticed. Each kind of unusable file has its own reason."""
    with tempfile.TemporaryDirectory() as d:
        path = Path(d) / collector.SYMBOL_SPECS_FILE

        with Warnings() as w:
            path.write_bytes(b'')
            assert collector.parse_symbol_specs_file(path) is None
        assert w.said('has no data row'), w.messages

        with Warnings() as w:                                    # a header and nothing else
            path.write_bytes((TAB.join(HEADER) + '\r\n').encode('utf-8'))
            assert collector.parse_symbol_specs_file(path) is None
        assert w.said('has no data row'), w.messages
        assert not w.said('no complete data row')

        with Warnings() as w:                                    # a row with a figure missing
            path.write_bytes((TAB.join(HEADER) + '\r\n' + TAB.join(['1'] * 3) + '\r\n').encode('utf-8'))
            assert collector.parse_symbol_specs_file(path) is None
        assert w.said('no complete data row'), w.messages

        with Warnings() as w:                                    # the wrong chart
            assert collector.parse_symbol_specs_file(
                write_snapshot(Path(d), snap(symbol='EURUSD'))) is None
        assert w.said('holds no row for XAUUSD') and w.said('EURUSD'), w.messages

        with Warnings() as w:                                    # an implausible figure
            assert collector.parse_symbol_specs_file(
                write_snapshot(Path(d), snap(contract_size=0.0))) is None
        assert w.said('refused: contract_size 0.0 is not positive'), w.messages

        with Warnings() as w:                                    # not readable as text
            path.write_bytes(b'\xff\xfe\x00garbage')
            assert collector.parse_symbol_specs_file(path) is None
        assert w.said('cannot read'), w.messages

        with Warnings() as w:                                    # a good file says nothing
            assert collector.parse_symbol_specs_file(write_snapshot(Path(d), BASE)) == BASE
        assert w.messages == []


# ------------------------------------------------------- the append-only stage

def test_no_file_is_not_an_error():
    """The exporter is not deployed yet, and the collector must not care."""
    with tempfile.TemporaryDirectory() as d:
        conn = fresh_db()
        assert collector.stage_symbol_specs(conn, Path(d)) == 'NO_FILE'
        assert stored(conn, 'id') == []


def test_first_sighting_is_appended_with_the_terminal_from_the_folder():
    with tempfile.TemporaryDirectory() as d:
        export_dir = Path(d) / 'MT5-A' / 'MQL5' / 'Files'
        export_dir.mkdir(parents=True)
        conn = fresh_db()
        assert stage(conn, export_dir, BASE) == 'APPENDED'

        (row,) = conn.execute(
            "SELECT terminal_id, symbol, captured_at, contract_size, volume_min, volume_step, "
            "volume_max, tick_size, typical_spread, swap_long, swap_short, point, digits, swap_mode, "
            "synced_at, send_attempts, last_error FROM symbol_specs").fetchall()
        assert row == ('MT5-A', 'XAUUSD', T0, 100.0, 0.01, 0.01, 100.0, 0.01, 18.0, -25.3, 8.1,
                       0.01, 2, 1, None, 0, None)


def test_the_same_snapshot_read_again_appends_nothing():
    """The load-bearing one. The collector runs this on every cycle (M5 and M15),
    and the exporter rewrites the same file every five minutes."""
    with tempfile.TemporaryDirectory() as d:
        conn = fresh_db()
        assert stage(conn, Path(d), BASE) == 'APPENDED'
        for _ in range(10):
            assert collector.stage_symbol_specs(conn, Path(d), now=T0 + 10 * DAY) == 'NOT_NEWER'
        assert len(stored(conn, 'id')) == 1


def test_a_newer_snapshot_with_the_same_figures_is_not_news():
    with tempfile.TemporaryDirectory() as d:
        conn = fresh_db()
        stage(conn, Path(d), BASE)
        assert stage(conn, Path(d), snap(captured_at=T0 + 300)) == 'UNCHANGED'
        assert stage(conn, Path(d), snap(captured_at=T0 + DAY - 1)) == 'UNCHANGED'
        assert len(stored(conn, 'id')) == 1


def test_a_wandering_spread_alone_appends_nothing_within_a_day():
    """typical_spread is a median that moves by a point or two. If it triggered a
    row, the table would gain one every cycle."""
    with tempfile.TemporaryDirectory() as d:
        conn = fresh_db()
        stage(conn, Path(d), BASE)
        for k in range(1, 50):
            assert stage(conn, Path(d), snap(captured_at=T0 + k * 300,
                                             typical_spread=18.0 + (k % 7))) == 'UNCHANGED'
        assert len(stored(conn, 'id')) == 1


def test_every_contract_figure_changing_is_news():
    """One test per figure, so a figure dropped from the comparison is named."""
    changes = {
        'contract_size': 1000.0, 'volume_min': 0.1, 'volume_step': 0.1, 'volume_max': 50.0,
        'tick_size': 0.001, 'swap_long': -30.0, 'swap_short': 9.0, 'point': 0.001,
        'digits': 3, 'swap_mode': 2,
    }
    assert set(changes) == set(collector.SYMBOL_SPECS_CONTRACT_COLUMNS)
    for col, value in changes.items():
        with tempfile.TemporaryDirectory() as d:
            conn = fresh_db()
            stage(conn, Path(d), BASE)
            assert stage(conn, Path(d), snap(captured_at=T0 + 300, **{col: value})) == 'APPENDED', \
                f'a change of {col} was not recorded'
            assert len(stored(conn, 'id')) == 2


def test_a_change_leaves_history_untouched():
    with tempfile.TemporaryDirectory() as d:
        conn = fresh_db()
        stage(conn, Path(d), BASE)
        stage(conn, Path(d), snap(captured_at=T0 + 600, volume_step=0.1))
        assert stored(conn, 'captured_at', 'volume_step') == [(T0, 0.01), (T0 + 600, 0.1)]


def test_the_daily_refresh_appends_even_if_nothing_changed():
    """The row that carries the then-current typical spread, and keeps the newest
    row within the 7 days after which Report 2 is not offered (section 6.9)."""
    with tempfile.TemporaryDirectory() as d:
        conn = fresh_db()
        stage(conn, Path(d), BASE)
        assert stage(conn, Path(d), snap(captured_at=T0 + DAY, typical_spread=21.0)) == 'APPENDED'
        assert stored(conn, 'captured_at', 'typical_spread') == [(T0, 18.0), (T0 + DAY, 21.0)]


def test_a_file_older_than_the_newest_row_never_goes_in_behind_it():
    """A standby terminal that stopped exporting earlier, after a promote."""
    with tempfile.TemporaryDirectory() as d:
        conn = fresh_db()
        stage(conn, Path(d), snap(captured_at=T0 + 1000))
        assert stage(conn, Path(d), snap(captured_at=T0 + 500, contract_size=1000.0)) == 'NOT_NEWER'
        assert stored(conn, 'captured_at', 'contract_size') == [(T0 + 1000, 100.0)]


def test_a_snapshot_from_the_future_is_refused():
    with tempfile.TemporaryDirectory() as d:
        conn = fresh_db()
        now = T0
        assert stage(conn, Path(d), snap(captured_at=now + 601), now=now) == 'REJECTED'
        assert stored(conn, 'id') == []
        # the tolerance itself is accepted: a clock a few seconds fast is not a fault
        assert stage(conn, Path(d), snap(captured_at=now + 600), now=now) == 'APPENDED'


def test_a_snapshot_for_another_symbol_is_refused_by_the_stage():
    with tempfile.TemporaryDirectory() as d:
        conn = fresh_db()
        assert stage(conn, Path(d), snap(symbol='EURUSD', contract_size=100000.0)) == 'REJECTED'
        assert stored(conn, 'id') == []


def test_another_symbols_rows_are_not_this_symbols_history():
    """The newest row is looked up per symbol. Nothing but this stage writes the
    table and it refuses other symbols, so this is the guard for the day a second
    symbol shares it: a newer row for another symbol must neither hide a first
    sighting nor stand in as the thing to compare against."""
    with tempfile.TemporaryDirectory() as d:
        conn = fresh_db()
        cols = ['terminal_id', 'symbol', 'captured_at', 'contract_size', 'volume_min', 'volume_step',
                'volume_max', 'tick_size', 'typical_spread', 'swap_long', 'swap_short', 'point',
                'digits', 'swap_mode']
        silver = dict(snap(symbol='XAGUSD', captured_at=T0 + 5 * DAY, contract_size=5000.0),
                      terminal_id='MT5-A')
        conn.execute(f"INSERT INTO symbol_specs ({', '.join(cols)}) VALUES ({', '.join('?' * len(cols))})",
                     [silver[c] for c in cols])
        conn.commit()

        # newer than nothing, older than the silver row: still this symbol's first sighting
        assert stage(conn, Path(d), BASE) == 'APPENDED'
        # and its own newest row, not the silver one, is what a repeat is compared with
        assert stage(conn, Path(d), snap(captured_at=T0 + 300)) == 'UNCHANGED'
        assert [r[0] for r in conn.execute(
            "SELECT symbol FROM symbol_specs ORDER BY id")] == ['XAGUSD', 'XAUUSD']


def test_an_unusable_file_appends_nothing_and_leaves_the_newest_row_alone():
    with tempfile.TemporaryDirectory() as d:
        conn = fresh_db()
        stage(conn, Path(d), BASE)
        (Path(d) / collector.SYMBOL_SPECS_FILE).write_bytes(b'garbage')
        assert collector.stage_symbol_specs(conn, Path(d), now=T0 + 10 * DAY) == 'REJECTED'
        assert len(stored(conn, 'id')) == 1


def test_volume_stays_bounded_over_three_days_of_five_minute_exports():
    """864 snapshots, a wandering spread, one real change (a swap rate, on day 2):
    the first sighting, one daily row a day, and the change. Without change
    detection this would be 864."""
    with tempfile.TemporaryDirectory() as d:
        conn = fresh_db()
        for k in range(864):
            at = T0 + k * 300
            swap = -25.3 if at < T0 + DAY + 40000 else -26.1
            stage(conn, Path(d), snap(captured_at=at, typical_spread=17.0 + (k % 5), swap_long=swap),
                  now=at)
        rows = stored(conn, 'captured_at', 'swap_long')
        assert len(rows) == 4, rows
        assert rows[0] == (T0, -25.3)
        assert rows[-1][1] == -26.1


def test_the_market_data_path_is_untouched_by_this_lane():
    with tempfile.TemporaryDirectory() as d:
        conn = fresh_db()
        stage(conn, Path(d), BASE)
        assert conn.execute("SELECT COUNT(*) FROM market_data").fetchone()[0] == 0
        cols = [r[1] for r in conn.execute("PRAGMA table_info(market_data)")]
        assert len(cols) == 103, f'market_data changed shape: {len(cols)} columns'


# ----------------------------------------------------- the table and the cycle

def test_the_table_has_exactly_the_columns_the_order_names():
    conn = fresh_db()
    cols = [(r[1], r[2], r[3], r[4]) for r in conn.execute("PRAGMA table_info(symbol_specs)")]
    assert [c[0] for c in cols] == [
        'id', 'terminal_id', 'symbol', 'captured_at', 'contract_size', 'volume_min', 'volume_step',
        'volume_max', 'tick_size', 'typical_spread', 'swap_long', 'swap_short', 'point', 'digits',
        'swap_mode', 'synced_at', 'send_attempts', 'last_error']
    by_name = {c[0]: c for c in cols}
    for name in ('terminal_id', 'symbol', 'captured_at', 'contract_size', 'volume_min', 'volume_step',
                 'volume_max', 'tick_size', 'typical_spread', 'swap_long', 'swap_short', 'point',
                 'digits', 'swap_mode', 'send_attempts'):
        assert by_name[name][2] == 1, f'{name} must be NOT NULL'
    assert by_name['synced_at'][2] == 0 and by_name['last_error'][2] == 0
    assert by_name['send_attempts'][3] == '0'
    assert by_name['digits'][1] == 'INTEGER' and by_name['swap_mode'][1] == 'INTEGER'
    assert by_name['contract_size'][1] == 'REAL'


def test_the_unsynced_index_is_partial_and_nothing_prunes_the_table():
    conn = fresh_db()
    (sql,) = conn.execute("SELECT sql FROM sqlite_master WHERE name = 'idx_symbol_specs_unsynced'").fetchone()
    assert 'WHERE synced_at IS NULL' in sql
    triggers = [r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type = 'trigger'")]
    assert not [t for t in triggers if 'symbol_specs' in t], 'the collector needs the newest row to stay'


def test_opening_an_old_database_creates_the_table():
    """The schema file is IF NOT EXISTS, so a deployed xauusd.db gains the table
    when the new collector opens it, and keeps its rows."""
    with tempfile.TemporaryDirectory() as d:
        db = str(Path(d) / 'xauusd.db')
        conn = collector.open_db(db)
        conn.execute("DROP TABLE symbol_specs")
        conn.commit()
        conn.close()
        conn = collector.open_db(db)
        assert conn.execute("SELECT COUNT(*) FROM symbol_specs").fetchone()[0] == 0
        conn.close()


def test_run_cycle_stages_specs_even_when_the_price_files_are_missing():
    """The lane is independent of the cycle: here the cycle is rejected for its
    missing export files, and the figures are recorded anyway."""
    with tempfile.TemporaryDirectory() as d:
        export_dir = Path(d) / 'MT5-B' / 'MQL5' / 'Files'
        export_dir.mkdir(parents=True)
        write_snapshot(export_dir, snap(captured_at=int(time.time()) - 5))
        conn = collector.open_db(str(Path(d) / 'xauusd.db'))
        slot = int(time.time()) // 300 * 300
        assert collector.run_cycle(conn, export_dir, 'M5', slot) is False
        assert conn.execute("SELECT status FROM collection_cycles").fetchone()[0] == 'rejected'
        assert conn.execute("SELECT terminal_id, contract_size FROM symbol_specs").fetchall() \
            == [('MT5-B', 100.0)]
        conn.close()


def test_a_failing_stage_cannot_fail_the_cycle():
    original = collector.stage_symbol_specs
    try:
        def boom(*_a, **_k):
            raise RuntimeError('disk on fire')
        collector.stage_symbol_specs = boom
        with tempfile.TemporaryDirectory() as d:
            conn = collector.open_db(str(Path(d) / 'xauusd.db'))
            slot = int(time.time()) // 300 * 300
            # no exception: the cycle goes on and is rejected for its own reason
            assert collector.run_cycle(conn, Path(d), 'M5', slot) is False
            assert 'missing export files' in conn.execute(
                "SELECT rejected_reason FROM collection_cycles").fetchone()[0]
            conn.close()
    finally:
        collector.stage_symbol_specs = original


# ------------------------------------------- the pieces that must agree with each other

def test_terminal_label_matches_the_push_workers():
    for path in ('C:/MT5-A/MQL5/Files', 'C:\\MT5-B\\MQL5\\Files\\', 'D:/Terminals/XM/mql5/files',
                 'C:/MT5/MQL5/Files', '/opt/mt5/MQL5/Files', 'C:/exports', '', None,
                 'MQL5/Files', '/MQL5'):
        assert collector.terminal_label(path) == worker.terminal_label(path), path


def test_the_contract_is_the_collectors_columns_plus_the_terminal():
    names = {c for c, _ in collector.SYMBOL_SPECS_COLUMNS}
    assert set(CONTRACT['properties']) == names | {'terminal_id'}
    assert set(CONTRACT['required']) == names | {'terminal_id'}
    assert CONTRACT['additionalProperties'] is False


def test_the_worker_posts_exactly_the_contract_fields():
    assert set(worker.SPEC_COLUMNS) == set(CONTRACT['properties'])
    assert worker.SPECS_ENDPOINT == '/api/v1/symbol-specs'


def test_the_exporter_writes_the_columns_the_collector_reads():
    source = EXPORTER.read_text(encoding='utf-8')
    block = re.search(r'const string COLUMNS\s*=\s*(.*?);', source, re.S).group(1)
    literal = ''.join(re.findall(r'"((?:[^"\\]|\\.)*)"', block))
    assert literal.split('\\t') == HEADER


def test_the_exporter_writes_the_file_the_collector_reads():
    source = EXPORTER.read_text(encoding='utf-8')
    assert re.search(r'input\s+string\s+InpSymbol\s*=\s*"XAUUSD"', source)
    assert 'g_outFile = "SymbolSpecs_" + InpSymbol + ".txt";' in source
    assert collector.SYMBOL_SPECS_FILE == 'SymbolSpecs_XAUUSD.txt'
    assert collector.SYMBOL == 'XAUUSD'


def test_the_exporter_stamps_utc_never_raw_server_time():
    """captured_at is UTC. TimeCurrent() is the last tick's SERVER time, hours off
    and stalled on a quiet market: the bug that mis-stamped every pipeline row."""
    code = [ln for ln in EXPORTER.read_text(encoding='utf-8').splitlines()
            if not ln.lstrip().startswith(('//',)) and not ln.lstrip().startswith('|')]
    body = '\n'.join(ln.split('//')[0] for ln in code)
    assert 'TimeCurrent(' not in body
    assert re.search(r'capturedAt\s*=\s*\(long\)TimeTradeServer\(\)\s*-\s*offset', body)
    assert re.search(r'long\s+raw\s*=\s*\(long\)TimeTradeServer\(\)\s*-\s*\(long\)TimeGMT\(\)', body)


def test_the_exporter_reads_every_property_the_architecture_names():
    source = EXPORTER.read_text(encoding='utf-8')
    for prop in ('SYMBOL_TRADE_CONTRACT_SIZE', 'SYMBOL_VOLUME_MIN', 'SYMBOL_VOLUME_STEP',
                 'SYMBOL_VOLUME_MAX', 'SYMBOL_TRADE_TICK_SIZE', 'SYMBOL_SPREAD', 'SYMBOL_SWAP_LONG',
                 'SYMBOL_SWAP_SHORT', 'SYMBOL_POINT', 'SYMBOL_DIGITS', 'SYMBOL_SWAP_MODE'):
        assert re.search(r'SymbolInfo(Double|Integer)\(_Symbol,\s*' + prop + r'\b', source), prop


def test_the_exporter_refuses_the_wrong_chart_and_leaves_the_old_file_on_doubt():
    source = EXPORTER.read_text(encoding='utf-8')
    assert 'if(StringFind(_Symbol, InpSymbol) != 0)' in source
    assert source.count('leaving the previous export in place') >= 4


def test_the_deployment_documents_name_the_same_endpoint_and_file():
    schema_text = (HERE / 'sqlite_schema_v6_xauusd.sql').read_text(encoding='utf-8')
    assert 'gateway_contract_symbol_specs.schema.json' in schema_text
    assert 'SymbolSpecsExport_v2_29.mq5' in schema_text


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
