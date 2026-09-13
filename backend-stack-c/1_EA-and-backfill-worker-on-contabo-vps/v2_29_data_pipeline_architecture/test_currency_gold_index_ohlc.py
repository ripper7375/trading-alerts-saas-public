"""Tests for index OHLC in currency_gold_index_engine.py.

Run either way -- there is no pytest config in this stack:

    python -m pytest test_currency_gold_index_ohlc.py -q
    python test_currency_gold_index_ohlc.py

WHAT IS BEING PROTECTED:

`value` was always the index close. The Currency Index Comparison PRO page draws
OHLC and Heiken Ashi candles, so every row now also carries the index open/high/
low of the same M5 bar, built with the rule from the authoritative MQL5
references (*_H1_High.mq5: direct inputs use their High, inverse inputs their
Low; *_H1_Low.mq5 mirrors it).

The engine applies that rule to each index's NET exponent per raw symbol
(symbol_exponents()), because it triangulates 21 crosses from 7 primary pairs
rather than reading cross symbols. Two things can silently go wrong there and
neither would raise:

  1. symbol_exponents() drifting from index_value()/xaux_value() -- the candle
     body would then be computed from a different formula than the line.
     test_exponents_reproduce_index_value_* pin them together.
  2. A sign flip picking a High where a Low belongs -- the candle would still
     look like a candle. test_usdx_high_matches_mql5_rule_by_hand and
     test_xaux_exponents_match_mql5_high_pairs pin the rule against the MQL5
     file's own choices, computed independently of index_ohlc().
"""
import math
import os
import random
import sqlite3
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

_TMP = Path(tempfile.mkdtemp(prefix='cgi_ohlc_test_'))
os.environ.setdefault('CGI_LOG_DIR', str(_TMP / 'logs'))
os.environ.setdefault('CGI_DB_PATH', str(_TMP / 'db' / 'currency_gold_indices.db'))

sys.path.insert(0, str(Path(__file__).resolve().parent))

import currency_gold_index_engine as engine  # noqa: E402

W = 1.0 / 7.0
ALL_INDICES = list(engine.CURRENCY_INDEX_TERMS) + ['XAUX']

BASE_RATES = {
    'EURUSD': 1.0850, 'USDJPY': 147.20, 'GBPUSD': 1.2710, 'AUDUSD': 0.6620,
    'NZDUSD': 0.6050, 'USDCAD': 1.3580, 'USDCHF': 0.8840, 'XAUUSD': 2650.55,
}


def jitter(rates, rng, scale=0.004):
    return {s: v * (1 + rng.uniform(-scale, scale)) for s, v in rates.items()}


def random_bar(rng, close):
    """A well-formed (open, high, low, close) around `close`."""
    o = close * (1 + rng.uniform(-0.002, 0.002))
    h = max(o, close) * (1 + rng.uniform(0, 0.002))
    lo = min(o, close) * (1 - rng.uniform(0, 0.002))
    return o, h, lo, close


def value_via_engine(index_name, now, inception):
    if index_name == 'XAUX':
        return engine.xaux_value(now['XAUUSD'], now, inception['XAUUSD'], inception)
    return engine.index_value(index_name, now, inception)


# ------------------------------------------------------------------ exponents
def test_exponents_reproduce_index_value_for_all_nine_indices():
    rng = random.Random(7)
    for _ in range(25):
        inception = jitter(BASE_RATES, rng)
        now = jitter(inception, rng, 0.01)
        for name in ALL_INDICES:
            exps = engine.symbol_exponents(name)
            via_exponents = engine._index_from_symbol_prices(exps, now, inception)
            expected = value_via_engine(name, now, inception)
            assert math.isclose(via_exponents, expected, rel_tol=0, abs_tol=1e-9), \
                f'{name}: exponent form {via_exponents} != engine value {expected}'


def test_usdx_exponents_are_the_seven_usd_pairs():
    exps = engine.symbol_exponents('USDX')
    expected = {'EURUSD': -W, 'USDJPY': W, 'GBPUSD': -W, 'AUDUSD': -W,
                'NZDUSD': -W, 'USDCAD': W, 'USDCHF': W}
    assert set(exps) == set(expected)
    for s, e in expected.items():
        assert math.isclose(exps[s], e, abs_tol=1e-12), (s, exps[s], e)


def test_eurx_nets_eurusd_to_exponent_one():
    """EURX = u_EUR / PRODUCT(u_Y^W): EUR appears in all 7 terms -> 7W = 1."""
    exps = engine.symbol_exponents('EURX')
    assert math.isclose(exps['EURUSD'], 1.0, abs_tol=1e-12)
    assert math.isclose(exps['GBPUSD'], -W, abs_tol=1e-12)
    assert math.isclose(exps['USDJPY'], W, abs_tol=1e-12)


def test_xaux_exponents_match_mql5_high_pairs():
    """XAUX_H1_High.mq5 InitializePairs(): XAUUSD direct, EURUSD inverse, USDJPY
    direct, GBPUSD inverse, AUDUSD inverse -- i.e. the High index takes XAUUSD's
    High, EURUSD's Low, USDJPY's High, GBPUSD's Low, AUDUSD's Low."""
    exps = engine.symbol_exponents('XAUX')
    assert math.isclose(exps['XAUUSD'], 1.0, abs_tol=1e-12)
    assert exps['EURUSD'] < 0 and exps['GBPUSD'] < 0 and exps['AUDUSD'] < 0
    assert exps['USDJPY'] > 0
    assert set(exps) == {'XAUUSD', 'EURUSD', 'USDJPY', 'GBPUSD', 'AUDUSD'}


# ------------------------------------------------------------------ OHLC rule
def test_usdx_high_matches_mql5_rule_by_hand():
    """Independent of index_ohlc(): USDX_H1_High.mq5 uses iLow for the inverse
    pairs (EURUSD, GBPUSD, AUDUSD, NZDUSD) and iHigh for the direct ones."""
    rng = random.Random(11)
    inception = jitter(BASE_RATES, rng)
    bars = {s: random_bar(rng, inception[s] * 1.001) for s in engine.FX_PAIRS}
    inverse = {'EURUSD', 'GBPUSD', 'AUDUSD', 'NZDUSD'}

    by_hand = 100.0
    for s in engine.FX_PAIRS:
        price = bars[s][2] if s in inverse else bars[s][1]
        sign = -1 if s in inverse else 1
        by_hand *= (price / inception[s]) ** (sign * W)

    closes = {s: bars[s][3] for s in engine.FX_PAIRS}
    value = engine.index_value('USDX', closes, inception)
    _, high, _ = engine.index_ohlc('USDX', bars, inception, value)
    assert math.isclose(high, by_hand, abs_tol=1e-9), (high, by_hand)


def test_candle_range_strictly_exceeds_body_without_relying_on_the_clamp():
    """For input bars that each have a genuine range, the rule itself must put
    the High strictly above the body and the Low strictly below it.

    STRICT on purpose: index_ohlc() ends with a max/min clamp, so a sign flip
    (a Low picked where a High belongs) would be clamped to exactly the body
    edge and a >= check would still pass. Verified by mutation: flipping the
    rule fails this test, not just the by-hand one below.
    """
    rng = random.Random(3)
    for _ in range(40):
        inception = jitter(BASE_RATES, rng)
        bars = {s: random_bar(rng, inception[s] * (1 + rng.uniform(-0.01, 0.01)))
                for s in BASE_RATES}
        closes = {s: b[3] for s, b in bars.items()}
        for name in ALL_INDICES:
            value = value_via_engine(name, closes, inception)
            o, h, lo = engine.index_ohlc(name, bars, inception, value)
            assert h > max(o, value), (name, h, o, value)
            assert lo < min(o, value), (name, lo, o, value)


def test_flat_input_bars_give_a_flat_candle():
    rng = random.Random(5)
    inception = jitter(BASE_RATES, rng)
    now = jitter(inception, rng)
    bars = {s: (v, v, v, v) for s, v in now.items()}
    for name in ALL_INDICES:
        value = value_via_engine(name, now, inception)
        o, h, lo = engine.index_ohlc(name, bars, inception, value)
        for x in (o, h, lo):
            assert math.isclose(x, value, abs_tol=1e-9), (name, x, value)


def test_malformed_export_row_never_inverts_the_candle():
    """An exporter row with High below its own Close must not yield high < close."""
    rng = random.Random(9)
    inception = jitter(BASE_RATES, rng)
    bars = {s: random_bar(rng, v) for s, v in inception.items()}
    bars['EURUSD'] = (1.09, 1.07, 1.10, 1.09)  # high < low: nonsense on purpose
    closes = {s: b[3] for s, b in bars.items()}
    for name in ALL_INDICES:
        value = value_via_engine(name, closes, inception)
        o, h, lo = engine.index_ohlc(name, bars, inception, value)
        assert h >= max(o, value) and lo <= min(o, value), (name, o, h, lo, value)


# ------------------------------------------------------------------ parsing / lookup
LIVE_HEADER = ('ohlcv_timestamp\tohlcv_symbol\tohlcv_timeframe\tohlcv_close\t'
               'ohlcv_open\tohlcv_high\tohlcv_low\tohlcv_volume')


def write_export(path, symbol, bars):
    lines = [LIVE_HEADER]
    for ts, o, h, lo, c in bars:
        lines.append(f'{ts}\t{symbol}\tM5\t{c}\t{o}\t{h}\t{lo}\t100')
    path.write_text('\n'.join(lines) + '\n', encoding='utf-8')


def test_parser_reads_columns_by_header_name_in_live_order():
    d = Path(tempfile.mkdtemp(prefix='cgi_parse_'))
    p = d / 'OHLCV_EURUSD_M5.txt'
    write_export(p, 'EURUSD', [(600, 1.1, 1.3, 1.0, 1.2), (300, 2.1, 2.3, 2.0, 2.2)])
    rows = engine.parse_ohlcv_file(p)
    assert rows == [(300, 2.1, 2.3, 2.0, 2.2), (600, 1.1, 1.3, 1.0, 1.2)]


def test_ohlc_at_is_flat_when_symbol_has_no_bar_at_that_time():
    series = [(300, 1.0, 1.2, 0.9, 1.1), (900, 2.0, 2.2, 1.9, 2.1)]
    assert engine.ohlc_at(series, 300) == (1.0, 1.2, 0.9, 1.1)
    assert engine.ohlc_at(series, 600) == (1.1, 1.1, 1.1, 1.1)
    assert engine.ohlc_at(series, 0) is None


# ------------------------------------------------------------------ end to end
def test_compute_cycle_emits_ohlc_for_all_nine_indices():
    now_utc = datetime(2026, 9, 15, 12, 0, 20, tzinfo=timezone.utc)
    fx_open = engine.todays_session_open_utc(now_utc, 0, 0)
    latest = int(now_utc.timestamp()) // 300 * 300
    rng = random.Random(21)

    d = Path(tempfile.mkdtemp(prefix='cgi_cycle_'))
    for symbol, base in BASE_RATES.items():
        bars, price = [], base
        for ts in range(fx_open - 3600, latest + 1, 300):
            close = price * (1 + rng.uniform(-0.001, 0.001))
            bars.append((ts, *random_bar(rng, close)))
            price = close
        write_export(d / f'OHLCV_{symbol}_M5.txt', symbol, bars)

    rows = engine.compute_cycle(d, now_utc)
    assert sorted(r['index_name'] for r in rows) == sorted(ALL_INDICES)
    for r in rows:
        # Strict for the same reason as the unit test above: the clamp would
        # hide a flipped rule behind a >= check.
        assert r['high'] > max(r['open'], r['value']), r
        assert r['low'] < min(r['open'], r['value']), r


def test_outbox_migration_is_idempotent_and_preserves_rows():
    conn = sqlite3.connect(':memory:')
    conn.row_factory = sqlite3.Row
    conn.executescript("""
        CREATE TABLE currency_gold_indices (
            index_name TEXT NOT NULL, bar_time INTEGER NOT NULL, value REAL NOT NULL,
            change_pct REAL NOT NULL, session_open_bar_time INTEGER NOT NULL,
            synced_at INTEGER,
            created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
            PRIMARY KEY (index_name, bar_time));
        INSERT INTO currency_gold_indices (index_name, bar_time, value, change_pct,
            session_open_bar_time) VALUES ('USDX', 300, 100.5, 0.5, 0);
    """)
    assert engine.migrate_outbox_columns(conn) == ['open', 'high', 'low']
    assert engine.migrate_outbox_columns(conn) == []

    engine.store_rows(conn, [{'index_name': 'EURX', 'bar_time': 300, 'value': 99.8,
                              'change_pct': -0.2, 'session_open_bar_time': 0,
                              'open': 99.9, 'high': 100.1, 'low': 99.7}])
    rows = conn.execute("SELECT * FROM currency_gold_indices ORDER BY index_name").fetchall()
    payload = {p['index_name']: p for p in engine.build_push_payload(rows)}

    assert payload['USDX']['value'] == 100.5
    assert 'open' not in payload['USDX'] and 'high' not in payload['USDX']
    assert (payload['EURX']['open'], payload['EURX']['high'], payload['EURX']['low']) == \
        (99.9, 100.1, 99.7)


def test_store_rows_accepts_rows_without_ohlc_keys():
    conn = sqlite3.connect(':memory:')
    conn.row_factory = sqlite3.Row
    conn.executescript(engine.SCHEMA_SQL)
    engine.store_rows(conn, [{'index_name': 'XAUX', 'bar_time': 1, 'value': 100.0,
                              'change_pct': 0.0, 'session_open_bar_time': 1}])
    row = conn.execute("SELECT open, high, low FROM currency_gold_indices").fetchone()
    assert tuple(row) == (None, None, None)


if __name__ == '__main__':
    failures = 0
    tests = [(n, f) for n, f in sorted(globals().items()) if n.startswith('test_') and callable(f)]
    for name, fn in tests:
        try:
            fn()
            print(f'PASS  {name}')
        except Exception as e:  # noqa: BLE001
            failures += 1
            print(f'FAIL  {name}: {type(e).__name__}: {e}')
    print(f'\n{len(tests) - failures}/{len(tests)} passed')
    sys.exit(1 if failures else 0)
