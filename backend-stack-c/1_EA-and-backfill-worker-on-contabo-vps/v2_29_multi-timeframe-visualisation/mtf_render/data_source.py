"""Data access layer for the multi-timeframe renderer.

Reads the wide ``market_data`` table (see ``sqlite_schema_v6_xauusd.sql``) into
plain pandas DataFrames. The renderer is deliberately decoupled from the source
so it works identically against a real ``xauusd.db`` or the synthetic fixture.

Nothing here recomputes indicators -- it only SELECTs the columns to plot, and
every column name comes from :mod:`mtf_render.overlays` rather than being built
by string interpolation.

Two rules from the plan are enforced here rather than in the renderer:

**D1 -- one shared clock window.** ``--limit`` selects the most recent N *M5*
bars; the M15 rows are then filtered to that same time range instead of taking N
M15 bars of their own. Equal bar counts would have made the lower panel span
roughly three times as long, so the overlaid M5 channel would have covered only
its right-hand third.

**D2 -- two variants.** ``m5_overlay=False`` produces the ``standard`` image, in
which the M15 panel carries only its own channel. The M5 channel is simply not
attached; nothing else differs.
"""

from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from typing import Iterable, Optional, Sequence

import pandas as pd

from .overlays import DEFAULT_OVERLAY_KEYS, OverlaySpec, resolve

# Candle columns are the per-bar spine; always present and NOT NULL.
_OHLCV_COLS = ("open", "high", "low", "close", "volume")

_M5 = "M5"
_M15 = "M15"


@dataclass(frozen=True)
class Overlay:
    """One overlay's values for one timeframe, indexed by bar timestamp.

    ``frame`` carries unix ``timestamp`` plus one column per line, named by the
    spec's canonical roles (``upper`` / ``mid`` / ``lower``; a single line has
    only ``mid``). Because an overlay is a price-vs-time object, drawing it on a
    different timeframe is only a matter of plotting it against the same time
    axis -- which is what makes the M5-on-M15 overlay correct rather than
    approximate.
    """

    spec: OverlaySpec
    frame: pd.DataFrame
    source_timeframe: str

    @property
    def has_data(self) -> bool:
        """True if at least one line has a non-NULL value to draw."""
        if self.frame.empty:
            return False
        roles = list(self.spec.line_roles)
        return bool(self.frame[roles].notna().any().any())

    @property
    def label(self) -> str:
        """Legend text, prefixed with the timeframe the values were computed on.

        The prefix is load-bearing: on the lower panel an M15 channel and an
        overlaid M5 channel are drawn together, and this is what distinguishes
        them for a reader (human or vision model).
        """
        return f"{self.source_timeframe} {self.spec.label}"


@dataclass(frozen=True)
class ChartData:
    """Everything one panel needs: its candles, plus the overlays drawn on it.

    ``own_overlays`` were computed on this panel's own timeframe.
    ``m5_overlays`` are the M5 channel layered on top -- populated only on the
    M15 panel, and only in the ``overlay`` variant (D2). It is always empty on
    the M5 panel, where "own" already means M5.
    """

    timeframe: str
    candles: pd.DataFrame
    own_overlays: tuple[Overlay, ...]
    m5_overlays: tuple[Overlay, ...] = ()

    @property
    def m5_overlay_requested(self) -> bool:
        """True in the ``overlay`` variant, regardless of whether data exists.

        Distinct from :attr:`has_m5_overlay` on purpose. During indicator
        warm-up the channel columns are NULL, so an ``overlay`` render can have
        nothing to draw -- and labelling that "M5 overlay OFF" would blame the
        user's setting for what is actually missing data.
        """
        return bool(self.m5_overlays)

    @property
    def has_m5_overlay(self) -> bool:
        """True only if the M5 overlay was requested AND has values to draw."""
        return any(o.has_data for o in self.m5_overlays)


def _select_columns(specs: Sequence[OverlaySpec]) -> tuple[str, ...]:
    """Union of the specs' real columns, order-stable and de-duplicated."""
    seen: set[str] = set()
    cols: list[str] = []
    for spec in specs:
        for col in spec.columns:
            if col not in seen:
                seen.add(col)
                cols.append(col)
    return tuple(cols)


def _read_timeframe(
    conn: sqlite3.Connection,
    timeframe: str,
    specs: Sequence[OverlaySpec],
    limit: Optional[int] = None,
    ts_range: Optional[tuple[int, int]] = None,
) -> pd.DataFrame:
    """Read candles plus the requested overlay columns for one timeframe.

    Exactly one of `limit` (most recent N bars) or `ts_range` (an inclusive
    window) should be given; `ts_range` is how D1 constrains the M15 panel.
    """
    overlay_cols = _select_columns(specs)
    select_cols = ", ".join(("timestamp", *_OHLCV_COLS, *overlay_cols))

    where = "WHERE symbol = 'XAUUSD' AND timeframe = ?"
    params: list[object] = [timeframe]
    if ts_range is not None:
        where += " AND timestamp BETWEEN ? AND ?"
        params.extend(ts_range)

    # Pull the most recent `limit` bars, then flip back to oldest-first to plot.
    order = "DESC" if limit else "ASC"
    sql = f"SELECT {select_cols} FROM market_data {where} ORDER BY timestamp {order}"
    if limit:
        sql += " LIMIT ?"
        params.append(limit)

    df = pd.read_sql_query(sql, conn, params=params)
    if limit:
        df = df.iloc[::-1].reset_index(drop=True)
    return df


def _extract_overlays(
    df: pd.DataFrame,
    specs: Sequence[OverlaySpec],
    source_timeframe: str,
) -> tuple[Overlay, ...]:
    """Split a wide frame into one Overlay per spec, renaming to canonical roles."""
    overlays: list[Overlay] = []
    for spec in specs:
        frame = pd.DataFrame({"timestamp": df["timestamp"]})
        for role, column in zip(spec.line_roles, spec.columns):
            frame[role] = df[column]
        overlays.append(
            Overlay(spec=spec, frame=frame, source_timeframe=source_timeframe)
        )
    return tuple(overlays)


def build_panels(
    m5: pd.DataFrame,
    m15: pd.DataFrame,
    specs: Sequence[OverlaySpec],
    m5_overlay: bool = True,
) -> dict[str, ChartData]:
    """Assemble the two panels from raw M5 and M15 frames.

    Split out from :func:`load_market_data` so the fixture and tests can build
    panels from in-memory frames without a SQLite round-trip.

    Returns a dict keyed ``"M5"`` (upper) and ``"M15"`` (lower).
    """
    candle_cols = ["timestamp", *_OHLCV_COLS]

    m5_own = _extract_overlays(m5, specs, _M5)
    m15_own = _extract_overlays(m15, specs, _M15)

    upper = ChartData(
        timeframe=_M5,
        candles=m5[candle_cols].copy(),
        own_overlays=m5_own,
        m5_overlays=(),  # on the M5 panel, "own" already means M5
    )
    lower = ChartData(
        timeframe=_M15,
        candles=m15[candle_cols].copy(),
        own_overlays=m15_own,
        # The SAME Overlay objects as the upper panel's, by reference: computed
        # once on M5 and reused, never recomputed on M15.
        m5_overlays=m5_own if m5_overlay else (),
    )
    return {_M5: upper, _M15: lower}


def load_market_data(
    db_path: str,
    overlays: Iterable[str] | str = DEFAULT_OVERLAY_KEYS,
    limit: Optional[int] = 200,
    m5_overlay: bool = True,
) -> dict[str, ChartData]:
    """Load the two chart panels from an ``xauusd.db``.

    `limit` bounds the **M5** panel; the M15 panel is then clipped to the same
    clock window (D1). `m5_overlay` selects the D2 variant.
    """
    specs = resolve(overlays)

    conn = sqlite3.connect(db_path)
    try:
        m5 = _read_timeframe(conn, _M5, specs, limit=limit)

        # D1: constrain M15 to the M5 panel's window rather than its own bar count.
        ts_range: Optional[tuple[int, int]] = None
        if not m5.empty:
            ts_range = (int(m5["timestamp"].min()), int(m5["timestamp"].max()))
        m15 = _read_timeframe(conn, _M15, specs, ts_range=ts_range)
    finally:
        conn.close()

    return build_panels(m5, m15, specs, m5_overlay=m5_overlay)
