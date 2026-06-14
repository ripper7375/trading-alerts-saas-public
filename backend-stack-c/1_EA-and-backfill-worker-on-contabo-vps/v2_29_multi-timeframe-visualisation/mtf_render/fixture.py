"""Synthetic golden fixture for developing/demoing the renderer.

The shipped ``market_data`` sample has only 3 M5 bars, no M15 rows, and all
channel columns NULL (warm-up by design), so it cannot exercise the renderer.
This module fabricates a self-consistent ``xauusd.db`` with:

  * realistic XAUUSD M5 + M15 candles over the SAME time window, and
  * a populated equal-distance channel per variant.

The channel is a straight centroid-regression line (slope * t + intercept) with
a constant equal-distance offset, so ``uoedt`` / ``base_fl`` / ``loedt`` come out
genuinely parallel — matching the three straight blue lines in the target image.
Crucially the M5 channel and the M15 candles share one price/time frame, so the
"reuse the M5 channel on M15" overlay is exact in golden data.

This is dev/demo data only. In production the renderer reads a real DB whose
channel columns are computed by the Python calc stack.
"""

from __future__ import annotations

import sqlite3

import numpy as np

# Per-variant (slope_perturb, offset) so the six variants render distinctly.
# offset = half the channel width in price units (equal distance above/below).
_VARIANT_PARAMS = {
    "best_fit": (1.00, 6.0),
    "cherry_a": (1.05, 7.0),
    "cherry_b": (0.95, 5.0),
    "most_recent": (1.10, 8.0),
    "non_a": (0.90, 4.5),
    "non_b": (1.02, 6.5),
}

_M5 = 5 * 60
_M15 = 15 * 60


def _candles(rng: np.random.Generator, t0: int, step: int, n: int, start: float):
    """Generate `n` OHLCV bars as a gentle random walk from `start`."""
    ts = t0 + step * np.arange(n)
    drift = np.linspace(0.0, 1.0, n)  # mild upward bias over the window
    noise = rng.normal(0.0, 1.2, n).cumsum()
    closes = start + 18.0 * drift + noise
    opens = np.empty(n)
    opens[0] = start
    opens[1:] = closes[:-1]
    spread = np.abs(rng.normal(0.0, 1.6, n)) + 0.4
    highs = np.maximum(opens, closes) + spread
    lows = np.minimum(opens, closes) - spread
    vol = rng.integers(450, 900, n)
    return ts, opens, highs, lows, closes, vol


def _channel(ts: np.ndarray, closes: np.ndarray, slope_mult: float, offset: float):
    """Fit one straight centroid line to closes, return parallel u/base/l lines."""
    x = (ts - ts[0]) / float(_M5)  # x in M5-bar units, stable across timeframes
    slope, intercept = np.polyfit(x, closes, 1)
    base = (slope * slope_mult) * x + intercept
    return base + offset, base, base - offset


def _create_schema(conn: sqlite3.Connection) -> None:
    """Minimal market_data table: the columns the renderer actually reads."""
    chan_cols = ",\n".join(
        f"        {v}_uoedt REAL, {v}_base_fl REAL, {v}_loedt REAL"
        for v in _VARIANT_PARAMS
    )
    conn.execute(
        f"""
        CREATE TABLE market_data (
            timestamp INTEGER NOT NULL,
            symbol    TEXT    NOT NULL,
            timeframe TEXT    NOT NULL,
            open REAL, high REAL, low REAL, close REAL, volume INTEGER,
{chan_cols},
            PRIMARY KEY (timestamp, timeframe)
        )
        """
    )


def _insert_timeframe(
    conn: sqlite3.Connection,
    timeframe: str,
    ts,
    o,
    h,
    l,
    c,
    v,
    channels: dict,
) -> None:
    variant_cols = []
    for variant in _VARIANT_PARAMS:
        variant_cols += [f"{variant}_uoedt", f"{variant}_base_fl", f"{variant}_loedt"]
    cols = ["timestamp", "symbol", "timeframe", "open", "high", "low", "close", "volume"] + variant_cols
    placeholders = ", ".join("?" for _ in cols)

    rows = []
    for i in range(len(ts)):
        row = [int(ts[i]), "XAUUSD", timeframe, float(o[i]), float(h[i]), float(l[i]), float(c[i]), int(v[i])]
        for variant in _VARIANT_PARAMS:
            u, b, lo = channels[variant]
            row += [float(u[i]), float(b[i]), float(lo[i])]
        rows.append(row)

    conn.executemany(
        f"INSERT INTO market_data ({', '.join(cols)}) VALUES ({placeholders})", rows
    )


def build_fixture_db(db_path: str, seed: int = 7) -> str:
    """Create a populated xauusd.db at `db_path` and return the path.

    M5: 96 bars (8h). M15: the same 8h window at 15-min resolution. Both share a
    common price frame so the M5 channel overlays the M15 candles exactly.
    """
    rng = np.random.default_rng(seed)
    t0 = 1781000000 - (1781000000 % _M15)  # align to a 15-min boundary
    start = 4330.0

    n_m5 = 96
    ts5, o5, h5, l5, c5, v5 = _candles(rng, t0, _M5, n_m5, start)

    # Build the M5 channel per variant from the M5 closes.
    m5_channels = {
        variant: _channel(ts5, c5, slope_mult, offset)
        for variant, (slope_mult, offset) in _VARIANT_PARAMS.items()
    }

    # M15 candles over the same window. Derive a coherent series by aggregating
    # the M5 walk into 15-min OHLC so the panels look like the same market.
    n_m15 = n_m5 // 3
    ts15 = t0 + _M15 * np.arange(n_m15)
    o15 = o5[::3][:n_m15]
    c15 = c5[2::3][:n_m15]
    h15 = np.array([h5[i * 3 : i * 3 + 3].max() for i in range(n_m15)])
    l15 = np.array([l5[i * 3 : i * 3 + 3].min() for i in range(n_m15)])
    v15 = np.array([v5[i * 3 : i * 3 + 3].sum() for i in range(n_m15)])

    # Sample the M5 channel at the M15 timestamps (purely so M15 rows have their
    # own channel columns populated; the renderer overlays the M5 channel anyway).
    m15_channels = {}
    for variant, (slope_mult, offset) in _VARIANT_PARAMS.items():
        u, b, lo = _channel(ts15, c15, slope_mult, offset)
        m15_channels[variant] = (u, b, lo)

    conn = sqlite3.connect(db_path)
    try:
        _create_schema(conn)
        _insert_timeframe(conn, "M5", ts5, o5, h5, l5, c5, v5, m5_channels)
        _insert_timeframe(conn, "M15", ts15, o15, h15, l15, c15, v15, m15_channels)
        conn.commit()
    finally:
        conn.close()
    return db_path
