"""Tests for the stale-export-directory guard in validate_cycle().

Run either way -- there is no pytest config in this stack, and a test nobody
can run is worse than none:

    python -m pytest test_stale_export_guard.py -q
    python test_stale_export_guard.py

WHAT IS BEING PROTECTED, and why it is worth a dedicated test file:

validate_cycle()'s completeness check was RELATIVE only -- it verified that all
per-bar sources agreed with each other on the newest bar. It never asked whether
that bar was actually current. A directory frozen by a shut-down MT5 terminal is
stale in EVERY source by the SAME amount, so the sources agree perfectly and the
cycle validates clean: the collector logs success, the push worker drains, no row
is rejected, and the newest bar simply stops advancing while the alert engine --
which reads `ORDER BY timestamp DESC LIMIT 1` -- keeps evaluating a frozen bar.

Nothing errors. It looks like a quiet market.

That failure mode becomes materially more likely under the active / hot-standby
terminal design (ACTIVE-STANDBY-TERMINAL-ARCHITECTURE.md), because promotion
points the collector at the standby -- precisely the terminal most likely to have
been closed. Hence the absolute freshness check, and hence these tests.

test_uniformly_stale_directory_is_rejected is the load-bearing one: it fails
against the pre-guard code. The others pin the threshold's edges so the guard
cannot be quietly widened into uselessness.
"""
import sqlite3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import export_collector_validator_v2 as collector  # noqa: E402

SCHEMA = Path(__file__).resolve().parent / 'sqlite_schema_v6_xauusd.sql'

# An arbitrary but realistic 5-minute slot (unix UTC), aligned to both M5 and M15
# so neither timeframe's arithmetic is accidentally favoured by the fixture.
CYCLE_TIME = 1789012800
assert CYCLE_TIME % 900 == 0, 'fixture slot must align to M15 as well as M5'

CLOSE = 2650.55


def fresh_db() -> sqlite3.Connection:
    conn = sqlite3.connect(':memory:')
    conn.executescript(SCHEMA.read_text(encoding='utf-8'))
    return conn


def stage_row(conn, source: str, cycle_id: int, timeframe: str, ts: int) -> None:
    """Insert one minimal staged row into a source's raw table.

    Columns are discovered from the live schema rather than hard-coded: these
    staging tables have gained columns twice already (the best_fit_a/b split, the
    2026-09-09 MQL5-only refactor), and a test that hard-codes them breaks for
    reasons that have nothing to do with what it is testing.
    """
    table = collector.SOURCES[source]['table']
    known = {
        'cycle_id': cycle_id,
        'timestamp_raw': ts,
        'timestamp_adj': ts,
        'symbol': collector.SYMBOL,      # CHECK (symbol = 'XAUUSD')
        'timeframe': timeframe,          # CHECK (timeframe IN ('M5','M15'))
        'close': CLOSE,
    }
    cols, vals = [], []
    for _, name, decl_type, notnull, default, _pk in conn.execute(
            f'PRAGMA table_info({table})'):
        if name in known:
            cols.append(name)
            vals.append(known[name])
        elif notnull and default is None:
            # Satisfy NOT NULL without asserting anything about the value; these
            # columns play no part in the checks under test.
            cols.append(name)
            vals.append(0 if decl_type.upper() in ('INTEGER', 'REAL') else '')
    conn.execute(
        f"INSERT INTO {table} ({', '.join(cols)}) "
        f"VALUES ({', '.join('?' * len(cols))})", vals)


def staged_cycle(conn, timeframe: str, latest_bar: int,
                 omit_latest_from: str = None) -> int:
    """Stage a plausible cycle whose newest bar is `latest_bar`.

    Three bars per source so the fixture resembles a real window rather than a
    single point. `omit_latest_from` drops the newest bar from one source only,
    to trip the RELATIVE check without touching the absolute one.
    """
    cycle_id, _ = collector.open_cycle(conn, CYCLE_TIME, timeframe)
    step = collector.TF_SECONDS[timeframe]
    for source in collector.PER_BAR_SOURCES:
        for i in range(3):
            ts = latest_bar - (i * step)
            if i == 0 and source == omit_latest_from:
                continue
            stage_row(conn, source, cycle_id, timeframe, ts)
    conn.commit()
    return cycle_id


def validate(conn, cycle_id, timeframe, **kw):
    return collector.validate_cycle(conn, cycle_id, timeframe, CYCLE_TIME, **kw)


def max_lag(timeframe: str) -> int:
    return collector.MAX_BAR_LAG_MULTIPLIER * collector.TF_SECONDS[timeframe]


# ============================================================
# The failure this guard exists for
# ============================================================
def test_uniformly_stale_directory_is_rejected():
    """A terminal that was shut down freezes EVERY source at the same bar.

    Pre-guard this passed, because the sources agree with each other. It is the
    exact state a promote to a cold standby produces.
    """
    conn = fresh_db()
    one_hour_stale = CYCLE_TIME - 3600
    cycle_id = staged_cycle(conn, 'M5', one_hour_stale)

    passed, reasons = validate(conn, cycle_id, 'M5')

    assert not passed, 'uniformly stale export directory was accepted'
    assert any('stale export directory' in r for r in reasons), reasons

    # The rejection must be durable, not just a return value -- the operator
    # finds this in validation_failures / rejected_rows.jsonl, not in a log line.
    logged = conn.execute(
        "SELECT detail FROM validation_failures WHERE cycle_id = ? AND field = 'timestamp'",
        (cycle_id,)).fetchall()
    assert logged, 'stale rejection was not persisted to validation_failures'
    assert any('lag_sec' in row[0] for row in logged), logged


def test_fresh_directory_passes():
    conn = fresh_db()
    cycle_id = staged_cycle(conn, 'M5', CYCLE_TIME)
    passed, reasons = validate(conn, cycle_id, 'M5')
    assert passed, reasons


# ============================================================
# Threshold edges -- so the guard cannot be widened into uselessness
# ============================================================
def test_lag_exactly_at_limit_passes():
    conn = fresh_db()
    cycle_id = staged_cycle(conn, 'M5', CYCLE_TIME - max_lag('M5'))
    passed, reasons = validate(conn, cycle_id, 'M5')
    assert passed, f'boundary lag must be inclusive: {reasons}'


def test_lag_one_second_over_limit_fails():
    conn = fresh_db()
    cycle_id = staged_cycle(conn, 'M5', CYCLE_TIME - max_lag('M5') - 1)
    passed, reasons = validate(conn, cycle_id, 'M5')
    assert not passed, 'lag one second past the limit was accepted'
    assert any('stale export directory' in r for r in reasons), reasons


def test_threshold_scales_with_timeframe():
    """A lag fatal on M5 must be fine on M15.

    Pins that the limit is derived from TF_SECONDS rather than being a constant
    that happens to suit M5 -- the M15 collector cycle legitimately lags by up to
    a full bar period, because it runs every 300s against a 900s bar.
    """
    lag = 900
    assert lag > max_lag('M5') and lag <= max_lag('M15'), 'fixture no longer straddles'

    conn = fresh_db()
    m5_cycle = staged_cycle(conn, 'M5', CYCLE_TIME - lag)
    m5_passed, _ = validate(conn, m5_cycle, 'M5')
    assert not m5_passed, 'M5 accepted a 900s lag'

    conn = fresh_db()
    m15_cycle = staged_cycle(conn, 'M15', CYCLE_TIME - lag)
    m15_passed, reasons = validate(conn, m15_cycle, 'M15')
    assert m15_passed, f'M15 rejected a legitimate 900s lag: {reasons}'


def test_worst_legitimate_retry_lag_still_passes():
    """The margin claimed in ACTIVE-STANDBY-TERMINAL-ARCHITECTURE.md 4.3.

    Worst honest case on M5: the bar is about to roll (300s) and the cycle has
    exhausted its retries (MAX_ATTEMPTS_PER_CYCLE x RETRY_WAIT_SEC = 195s). If
    this ever fails, the threshold is too tight and healthy cycles are being
    rejected -- which is the failure direction the guard must NOT have.
    """
    worst = collector.TF_SECONDS['M5'] + (
        collector.MAX_ATTEMPTS_PER_CYCLE * collector.RETRY_WAIT_SEC)
    assert worst < max_lag('M5'), (
        f'no margin left: worst legitimate lag {worst}s vs limit {max_lag("M5")}s')

    conn = fresh_db()
    cycle_id = staged_cycle(conn, 'M5', CYCLE_TIME - worst)
    passed, reasons = validate(conn, cycle_id, 'M5')
    assert passed, reasons


# ============================================================
# Interaction with the checks that were already there
# ============================================================
def test_relative_and_absolute_failures_are_reported_independently():
    """Both checks derive from `latest`, but neither gates the other.

    A directory that is stale AND internally inconsistent must report two
    reasons, not one -- if the absolute check were nested inside the relative
    one, the operator would fix the first problem and only then discover the
    second.
    """
    conn = fresh_db()
    cycle_id = staged_cycle(conn, 'M5', CYCLE_TIME - 3600,
                            omit_latest_from='resistance')
    passed, reasons = validate(conn, cycle_id, 'M5')

    assert not passed
    assert any('missing in' in r for r in reasons), f'relative check silent: {reasons}'
    assert any('stale export directory' in r for r in reasons), f'absolute check silent: {reasons}'


def test_no_completeness_flag_disables_the_freshness_check():
    """--no-completeness turns off BOTH checks, deliberately.

    Documents the coupling rather than leaving it to be rediscovered: replaying
    a deliberately old export directory is exactly when an operator passes this
    flag, and a freshness check that survived it would make replay impossible.
    """
    conn = fresh_db()
    cycle_id = staged_cycle(conn, 'M5', CYCLE_TIME - 86400)
    passed, reasons = validate(conn, cycle_id, 'M5', check_completeness=False)
    assert passed, reasons


def test_cycle_time_is_required():
    """The guard must not be skippable by omission.

    A default of None ('skip the check') is how this would silently stop running
    after some future refactor adds a second call site.
    """
    conn = fresh_db()
    cycle_id = staged_cycle(conn, 'M5', CYCLE_TIME)
    try:
        collector.validate_cycle(conn, cycle_id, 'M5')
    except TypeError:
        return
    raise AssertionError('validate_cycle accepted a call with no cycle_time')


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
