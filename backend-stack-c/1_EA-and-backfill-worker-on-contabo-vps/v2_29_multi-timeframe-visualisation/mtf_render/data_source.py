"""Data access layer for the multi-timeframe renderer.

Reads the wide ``market_data`` table (see ``sqlite_schema_v6_xauusd.sql``) into
plain pandas DataFrames. The renderer is deliberately decoupled from the source
so it works identically against a real ``xauusd.db`` or the synthetic fixture
(``fixture.py``).

Nothing here recomputes indicators — it only SELECTs the columns to plot.
"""

from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from typing import Optional

import pandas as pd

# The six centroid-regression variants available in market_data. Each exposes a
# parallel three-line "equal-distance channel": <variant>_uoedt / _base_fl / _loedt.
VARIANTS = (
    "best_fit",
    "cherry_a",
    "cherry_b",
    "most_recent",
    "non_a",
    "non_b",
)

# Candle columns are the per-bar spine; always present and NOT NULL.
_OHLCV_COLS = ("open", "high", "low", "close", "volume")


@dataclass(frozen=True)
class Channel:
    """The equal-distance channel for one timeframe, indexed by bar timestamp.

    ``frame`` carries unix ``timestamp`` plus ``uoedt`` / ``base_fl`` / ``loedt``
    columns. Because the channel is a price-vs-time object, overlaying it on a
    different timeframe is just a matter of plotting against the same time axis.
    """

    variant: str
    frame: pd.DataFrame  # columns: timestamp, uoedt, base_fl, loedt

    @property
    def has_data(self) -> bool:
        """True if at least one channel line has a non-NULL value to draw."""
        if self.frame.empty:
            return False
        return bool(self.frame[["uoedt", "base_fl", "loedt"]].notna().any().any())


@dataclass(frozen=True)
class ChartData:
    """Everything one chart panel needs: candles for its own timeframe plus the
    channel to draw on it.

    For Chart A the ``channel`` is the M5 channel computed on the M5 candles.
    For Charts B/C the ``candles`` are M15 but the ``channel`` is the *same M5
    channel* (overlaid by price+time, never recomputed on M15).
    """

    timeframe: str  # candle timeframe of this panel ("M5" / "M15")
    candles: pd.DataFrame  # timestamp, open, high, low, close, volume
    channel: Channel
    channel_timeframe: str  # timeframe the channel was computed on (always "M5")


def _read_timeframe(
    conn: sqlite3.Connection,
    timeframe: str,
    variant: str,
    limit: Optional[int],
) -> pd.DataFrame:
    """Read candles + the selected variant's channel for one timeframe."""
    chan_cols = f"{variant}_uoedt, {variant}_base_fl, {variant}_loedt"
    # Pull the most-recent `limit` bars, then return them oldest-first for plotting.
    order = "DESC" if limit else "ASC"
    sql = (
        "SELECT timestamp, "
        + ", ".join(_OHLCV_COLS)
        + f", {chan_cols} "
        "FROM market_data "
        "WHERE symbol = 'XAUUSD' AND timeframe = ? "
        f"ORDER BY timestamp {order}"
    )
    params: tuple = (timeframe,)
    if limit:
        sql += " LIMIT ?"
        params = (timeframe, limit)

    df = pd.read_sql_query(sql, conn, params=params)
    if limit:
        df = df.iloc[::-1].reset_index(drop=True)

    # Normalise the variant-prefixed channel names to canonical line names.
    df = df.rename(
        columns={
            f"{variant}_uoedt": "uoedt",
            f"{variant}_base_fl": "base_fl",
            f"{variant}_loedt": "loedt",
        }
    )
    return df


def load_market_data(
    db_path: str,
    variant: str = "best_fit",
    limit: Optional[int] = 200,
) -> dict[str, ChartData]:
    """Load the three chart panels (A=M5, B=M15, C=M15) from an ``xauusd.db``.

    The M5 channel is computed once (from the M5 rows) and reused on the M15
    panels, matching the DavinTrade "copy M5 EDT -> paste to Chart B/C" semantics.

    Returns a dict keyed ``"A"``, ``"B"``, ``"C"``.
    """
    if variant not in VARIANTS:
        raise ValueError(f"unknown variant {variant!r}; choose one of {VARIANTS}")

    conn = sqlite3.connect(db_path)
    try:
        m5 = _read_timeframe(conn, "M5", variant, limit)
        m15 = _read_timeframe(conn, "M15", variant, limit)
    finally:
        conn.close()

    return build_panels(m5, m15, variant)


def build_panels(
    m5: pd.DataFrame,
    m15: pd.DataFrame,
    variant: str,
) -> dict[str, ChartData]:
    """Assemble the A/B/C panels from raw M5 and M15 frames.

    Split out from :func:`load_market_data` so the fixture (and tests) can build
    panels from in-memory frames without a SQLite round-trip.
    """
    channel_cols = ["timestamp", "uoedt", "base_fl", "loedt"]
    m5_channel = Channel(variant=variant, frame=m5[channel_cols].copy())

    candle_cols = ["timestamp", *_OHLCV_COLS]
    panel_a = ChartData(
        timeframe="M5",
        candles=m5[candle_cols].copy(),
        channel=m5_channel,
        channel_timeframe="M5",
    )
    panel_bc = lambda: ChartData(  # noqa: E731 - tiny local factory
        timeframe="M15",
        candles=m15[candle_cols].copy(),
        channel=m5_channel,  # the SAME M5 channel, overlaid by price+time
        channel_timeframe="M5",
    )
    return {"A": panel_a, "B": panel_bc(), "C": panel_bc()}
