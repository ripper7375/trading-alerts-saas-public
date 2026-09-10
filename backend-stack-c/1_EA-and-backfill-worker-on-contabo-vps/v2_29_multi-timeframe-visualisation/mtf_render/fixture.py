"""Synthetic golden fixture for developing and demoing the renderer.

The shipped ``market_data`` sample has only 3 M5 bars, no M15 rows and all
channel columns NULL (warm-up by design), so it cannot exercise the renderer.
This module fabricates a self-consistent ``xauusd.db`` with realistic XAUUSD M5
and M15 candles over one shared window, plus a populated channel per overlay.

Two properties matter and are deliberate:

  * **The table is built from the overlay registry**, not from a hand-written
    column list. The previous fixture declared its own ``best_fit_*`` columns and
    therefore kept passing for months after the real schema renamed them --
    the fixture was validating itself rather than the contract. Driving both
    from one registry removes that failure mode, and
    ``test_fixture_columns_match_live_schema`` closes the loop by checking the
    registry against the real DDL.
  * **M5 and M15 cover the same clock window**, so the D1 windowing rule (the
    M15 panel is filtered to the M5 panel's time range) has something to filter,
    and the M5 overlay lands exactly over the M15 candles.

Dev/demo data only. Given ``--db`` the renderer reads a real database through
the identical code path.
"""

from __future__ import annotations

import sqlite3

import numpy as np

from .overlays import OVERLAYS, all_columns

# Per-overlay (slope multiplier, half-width in price units) so the variants
# render as visibly different channels rather than one line drawn ten times.
_CHANNEL_PARAMS: dict[str, tuple[float, float]] = {
    "best_fit_a": (1.00, 6.0),
    "best_fit_b": (0.97, 6.5),
    "cherry_a": (1.05, 7.0),
    "cherry_b": (0.95, 5.0),
    "most_recent": (1.10, 8.0),
    "non_a": (0.90, 4.5),
    "non_b": (1.02, 6.5),
    "fractal_edt": (1.03, 9.0),
}

_M5 = 5 * 60
_M15 = 15 * 60

# Roughly where XAUUSD trades in the reference screenshots.
_START_PRICE = 2650.0


def _candles(rng: np.random.Generator, t0: int, step: int, n: int, start: float):
    """Generate `n` OHLCV bars as a gentle random walk from `start`."""
    ts = t0 + step * np.arange(n)
    drift = np.linspace(0.0, 1.0, n)
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
    """Fit one straight centroid line to closes; return parallel u/mid/l lines."""
    # x in M5-bar units so the geometry is comparable across timeframes.
    x = (ts - ts[0]) / float(_M5)
    slope, intercept = np.polyfit(x, closes, 1)
    mid = (slope * slope_mult) * x + intercept
    return mid + offset, mid, mid - offset


def _overlay_values(ts: np.ndarray, closes: np.ndarray) -> dict[str, np.ndarray]:
    """Compute every registry column's values for one timeframe."""
    values: dict[str, np.ndarray] = {}
    n = len(ts)

    for key, spec in OVERLAYS.items():
        if spec.kind == "channel":
            slope_mult, offset = _CHANNEL_PARAMS[key]
            upper, mid, lower = _channel(ts, closes, slope_mult, offset)
            values[spec.upper] = upper
            values[spec.mid] = mid
            values[spec.lower] = lower

    # Single lines: a best resistance/support level sits near the window's
    # extremes and drifts only slightly, which is how these indicators behave.
    span = float(closes.max() - closes.min()) or 1.0
    tilt = np.linspace(0.0, 0.15 * span, n)
    values[OVERLAYS["resistance"].mid] = float(closes.max()) + 2.0 + tilt
    values[OVERLAYS["support"].mid] = float(closes.min()) - 2.0 + tilt

    return values


def _create_schema(conn: sqlite3.Connection) -> None:
    """market_data with exactly the columns the registry can read."""
    overlay_cols = ",\n".join(f"    {col} REAL" for col in all_columns())
    conn.execute(
        f"""
        CREATE TABLE market_data (
            timestamp INTEGER NOT NULL,
            symbol    TEXT    NOT NULL,
            timeframe TEXT    NOT NULL,
            open REAL, high REAL, low REAL, close REAL, volume INTEGER,
{overlay_cols},
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
    low,
    c,
    v,
    overlay_values: dict[str, np.ndarray],
) -> None:
    overlay_cols = list(all_columns())
    cols = [
        "timestamp",
        "symbol",
        "timeframe",
        "open",
        "high",
        "low",
        "close",
        "volume",
    ] + overlay_cols
    placeholders = ", ".join("?" for _ in cols)

    rows = []
    for i in range(len(ts)):
        row = [
            int(ts[i]),
            "XAUUSD",
            timeframe,
            float(o[i]),
            float(h[i]),
            float(low[i]),
            float(c[i]),
            int(v[i]),
        ]
        row += [float(overlay_values[col][i]) for col in overlay_cols]
        rows.append(row)

    conn.executemany(
        f"INSERT INTO market_data ({', '.join(cols)}) VALUES ({placeholders})", rows
    )


def build_fixture_db(db_path: str, seed: int = 7) -> str:
    """Create a populated xauusd.db at `db_path` and return the path.

    M5: 96 bars (8h). M15: the same 8h window at 15-minute resolution, derived by
    aggregating the M5 walk so both panels depict one market.
    """
    rng = np.random.default_rng(seed)
    t0 = 1781000000 - (1781000000 % _M15)  # align to a 15-minute boundary

    n_m5 = 96
    ts5, o5, h5, l5, c5, v5 = _candles(rng, t0, _M5, n_m5, _START_PRICE)

    # M15 over the SAME window, aggregated 3:1 from the M5 series.
    n_m15 = n_m5 // 3
    ts15 = t0 + _M15 * np.arange(n_m15)
    o15 = o5[::3][:n_m15]
    c15 = c5[2::3][:n_m15]
    h15 = np.array([h5[i * 3 : i * 3 + 3].max() for i in range(n_m15)])
    l15 = np.array([l5[i * 3 : i * 3 + 3].min() for i in range(n_m15)])
    v15 = np.array([v5[i * 3 : i * 3 + 3].sum() for i in range(n_m15)])

    m5_overlays = _overlay_values(ts5, c5)
    m15_overlays = _overlay_values(ts15, c15)

    conn = sqlite3.connect(db_path)
    try:
        _create_schema(conn)
        _insert_timeframe(conn, "M5", ts5, o5, h5, l5, c5, v5, m5_overlays)
        _insert_timeframe(conn, "M15", ts15, o15, h15, l15, c15, v15, m15_overlays)
        conn.commit()
    finally:
        conn.close()
    return db_path
