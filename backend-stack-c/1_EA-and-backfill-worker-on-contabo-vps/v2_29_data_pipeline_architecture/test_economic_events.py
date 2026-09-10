"""Tests for the economic-calendar lane's append-only decision.

Run either way -- there is no pytest config in this stack, and a test nobody
can run is worse than none:

    python -m pytest test_economic_events.py -q
    python test_economic_events.py

What is actually being protected here is a SILENT failure mode. If change
detection breaks open, the table grows ~12M rows/year of byte-identical
repeats. If it breaks shut, revisions stop being recorded and the series
quietly stops being point-in-time honest. Neither raises an error; both are
only noticeable weeks later.
"""
import sqlite3
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import export_collector_validator_v2 as collector  # noqa: E402

TAB = chr(9)
SCHEMA = Path(__file__).resolve().parent / 'sqlite_schema_v6_xauusd.sql'

HEADER = [c for c, _ in collector.CALENDAR_COLUMNS]

# A realistic pre-release row: forecast published, actual not yet, and a
# non-ASCII name that only survives because the exporter writes real UTF-8.
BASE_ROW = {
    'value_id': '18446744073709551615',   # ULONG_MAX -- must survive as text
    'captured_at': '1789000000',
    'event_id': '840010013',
    'event_time': '1789012345',
    'event_period': '',
    'revision': '0',
    'country_code': 'MX',
    'currency': 'MXN',
    'event_name': 'Banco de México Rate Decision',
    'importance': 'HIGH',
    'event_type': '1', 'sector': '2', 'frequency': '3', 'time_mode': '0',
    'unit': '4', 'multiplier': '0', 'digits': '2',
    'event_code': 'MX-RATE', 'source_url': 'https://banxico.org.mx',
    'actual_value': '',        # not published yet
    'forecast_value': '-0.30',
    'prev_value': '0.0',       # a REAL zero -- not missing
    'revised_prev_value': '',
    'impact_type': '2',
}


def write_snapshot(directory: Path, *rows: dict) -> Path:
    """Write an export file byte-for-byte the way the MQL5 exporter does."""
    path = directory / collector.ECONOMIC_CALENDAR_FILE
    lines = [TAB.join(HEADER)]
    for row in rows:
        lines.append(TAB.join(row[c] for c in HEADER))
    path.write_bytes(('\r\n'.join(lines) + '\r\n').encode('utf-8'))
    return path


def fresh_db() -> sqlite3.Connection:
    conn = sqlite3.connect(':memory:')
    conn.executescript(SCHEMA.read_text(encoding='utf-8'))
    return conn


def row_with(**overrides) -> dict:
    row = dict(BASE_ROW)
    row.update({k: str(v) for k, v in overrides.items()})
    return row


def stored(conn, *cols):
    return list(conn.execute(
        f"SELECT {', '.join(cols)} FROM economic_events ORDER BY captured_at"))


# ---------------------------------------------------------------- parsing

def test_parse_keeps_missing_and_zero_apart():
    with tempfile.TemporaryDirectory() as d:
        path = write_snapshot(Path(d), BASE_ROW)
        rows = collector.parse_calendar_file(path)
        assert len(rows) == 1
        r = rows[0]
        # not published -> None
        assert r['actual_value'] is None
        assert r['revised_prev_value'] is None
        assert r['event_period'] is None
        # a real 0.0 reading is DATA, and must not become None
        assert r['prev_value'] == 0.0
        assert r['forecast_value'] == -0.30


def test_parse_keeps_ids_as_text_without_precision_loss():
    with tempfile.TemporaryDirectory() as d:
        rows = collector.parse_calendar_file(write_snapshot(Path(d), BASE_ROW))
        # 18446744073709551615 is not representable as a float, and would be
        # mangled by any numeric round trip.
        assert rows[0]['value_id'] == '18446744073709551615'
        assert rows[0]['event_id'] == '840010013'


def test_parse_survives_non_ascii_event_name():
    with tempfile.TemporaryDirectory() as d:
        rows = collector.parse_calendar_file(write_snapshot(Path(d), BASE_ROW))
        assert rows[0]['event_name'] == 'Banco de México Rate Decision'


def test_parse_drops_rows_missing_a_key_field():
    with tempfile.TemporaryDirectory() as d:
        good = BASE_ROW
        bad = row_with(value_id='')          # unkeyable
        rows = collector.parse_calendar_file(write_snapshot(Path(d), good, bad))
        assert len(rows) == 1
        assert rows[0]['value_id'] == BASE_ROW['value_id']


def test_parse_tolerates_a_column_the_exporter_does_not_emit():
    """An older exporter build omitting a column must yield NULL, not a crash."""
    with tempfile.TemporaryDirectory() as d:
        path = Path(d) / collector.ECONOMIC_CALENDAR_FILE
        cols = [c for c in HEADER if c != 'source_url']
        path.write_bytes((TAB.join(cols) + '\r\n'
                          + TAB.join(BASE_ROW[c] for c in cols) + '\r\n').encode('utf-8'))
        rows = collector.parse_calendar_file(path)
        assert rows[0]['source_url'] is None
        assert rows[0]['event_name'] == BASE_ROW['event_name']


# ------------------------------------------------------- append-only core

def test_first_sighting_is_appended():
    with tempfile.TemporaryDirectory() as d:
        write_snapshot(Path(d), BASE_ROW)
        conn = fresh_db()
        assert collector.stage_economic_events(conn, Path(d)) == (1, 0)


def test_identical_snapshot_appends_nothing():
    """The load-bearing one. The exporter re-emits the same ~333 rows every
    cycle; if this ever appends, the table grows ~12M rows/year of repeats."""
    with tempfile.TemporaryDirectory() as d:
        write_snapshot(Path(d), BASE_ROW)
        conn = fresh_db()
        collector.stage_economic_events(conn, Path(d))
        for _ in range(10):
            appended, unchanged = collector.stage_economic_events(conn, Path(d))
            assert (appended, unchanged) == (0, 1)
        assert conn.execute("SELECT COUNT(*) FROM economic_events").fetchone()[0] == 1


def test_revised_forecast_appends_without_touching_history():
    with tempfile.TemporaryDirectory() as d:
        conn = fresh_db()
        write_snapshot(Path(d), BASE_ROW)
        collector.stage_economic_events(conn, Path(d))

        write_snapshot(Path(d), row_with(captured_at=1789000900, forecast_value='-0.25'))
        assert collector.stage_economic_events(conn, Path(d)) == (1, 0)

        rows = stored(conn, 'captured_at', 'forecast_value')
        assert rows == [(1789000000, -0.30), (1789000900, -0.25)]


def test_published_actual_appends_and_pre_release_row_stays_null():
    """The whole reason this lane is append-only: the pre-release row must keep
    saying 'no actual known yet', because that is what the market knew."""
    with tempfile.TemporaryDirectory() as d:
        conn = fresh_db()
        write_snapshot(Path(d), BASE_ROW)
        collector.stage_economic_events(conn, Path(d))

        write_snapshot(Path(d), row_with(captured_at=1789013000, actual_value='0.0'))
        collector.stage_economic_events(conn, Path(d))

        rows = stored(conn, 'captured_at', 'actual_value')
        assert rows[0] == (1789000000, None), 'pre-release actual was overwritten'
        # and the published actual is a real 0.0, not a missing value
        assert rows[1] == (1789013000, 0.0)


def test_a_zero_actual_is_a_change_not_a_no_op():
    """0.0 vs None must count as a change. If _calendar_value ever coerced an
    empty field to 0, this release would look unchanged and the publication
    would never be recorded at all."""
    with tempfile.TemporaryDirectory() as d:
        conn = fresh_db()
        write_snapshot(Path(d), BASE_ROW)                      # actual = None
        collector.stage_economic_events(conn, Path(d))
        write_snapshot(Path(d), row_with(captured_at=1789013000, actual_value='0.0'))
        appended, _ = collector.stage_economic_events(conn, Path(d))
        assert appended == 1


def test_volume_stays_bounded_across_many_cycles():
    """Two releases, 96 cycles (a day at 15-min intervals), one revision."""
    with tempfile.TemporaryDirectory() as d:
        conn = fresh_db()
        other = row_with(value_id='999', event_id='999', event_name='CPI y/y')

        for cycle in range(96):
            captured = 1789000000 + cycle * 900
            # A real revision STICKS from the moment it is published. An
            # earlier draft of this test flipped the value back on the next
            # cycle, which the collector correctly recorded as a second change
            # -- reverting a forecast is itself a revision worth keeping.
            forecast = '-0.30' if cycle < 50 else '-0.10'
            rows = [
                row_with(captured_at=captured, forecast_value=forecast),
                row_with(**{
                    **{k: v for k, v in other.items() if k != 'captured_at'},
                    'captured_at': captured,
                }),
            ]
            write_snapshot(Path(d), *rows)
            collector.stage_economic_events(conn, Path(d))

        total = conn.execute("SELECT COUNT(*) FROM economic_events").fetchone()[0]
        # 2 first sightings + 1 revision. Without change detection this would
        # be 96 * 2 = 192.
        assert total == 3, f'expected 3 rows, got {total}'


def test_missing_export_file_is_not_an_error():
    """The exporter is not deployed yet, and the collector must not care."""
    with tempfile.TemporaryDirectory() as d:
        assert collector.stage_economic_events(fresh_db(), Path(d)) == (0, 0)


def test_empty_export_file_is_not_an_error():
    with tempfile.TemporaryDirectory() as d:
        (Path(d) / collector.ECONOMIC_CALENDAR_FILE).write_bytes(b'')
        assert collector.stage_economic_events(fresh_db(), Path(d)) == (0, 0)


def test_market_data_is_untouched_by_this_lane():
    """This lane must never be able to disturb the price path."""
    with tempfile.TemporaryDirectory() as d:
        conn = fresh_db()
        write_snapshot(Path(d), BASE_ROW)
        collector.stage_economic_events(conn, Path(d))
        assert conn.execute("SELECT COUNT(*) FROM market_data").fetchone()[0] == 0
        cols = [r[1] for r in conn.execute("PRAGMA table_info(market_data)")]
        assert len(cols) == 87, f'market_data changed shape: {len(cols)} columns'


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
    print(f'\n{"FAILED" if failures else "OK"} — {failures} failure(s)')
    sys.exit(1 if failures else 0)
