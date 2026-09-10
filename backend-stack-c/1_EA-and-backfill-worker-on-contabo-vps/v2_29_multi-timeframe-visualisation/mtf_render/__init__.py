"""Multi-timeframe visualisation (backend rendering only).

Renders the DavinTrade two-canvas chart layout from ``market_data``:

  * **Upper** -- XAUUSD M5 candles + the M5 equal-distance channel
    (``uoedt`` / ``base_fl`` / ``loedt`` for the selected overlay).
  * **Lower** -- XAUUSD M15 candles + the M15 channel, plus the SAME M5 channel
    overlaid by price+time in the ``overlay`` variant.

Two variants are produced per cycle, differing only in whether the M5 channel is
drawn on the lower panel: ``overlay`` for a PRO user with the "M5 on M15" toggle
on, ``standard`` otherwise. The renderer itself knows nothing about tiers -- the
caller picks the file.

This package only READS the already-computed columns and plots them; it never
recomputes indicators. UI, buttons and R2 upload are out of scope.
"""

from .data_source import ChartData, Overlay, build_panels, load_market_data
from .overlays import (
    DEFAULT_OVERLAY_KEYS,
    OVERLAY_KEYS,
    OVERLAYS,
    OverlaySpec,
    resolve,
)
from .renderer import render_combined

__all__ = [
    "ChartData",
    "Overlay",
    "OverlaySpec",
    "OVERLAYS",
    "OVERLAY_KEYS",
    "DEFAULT_OVERLAY_KEYS",
    "build_panels",
    "load_market_data",
    "render_combined",
    "resolve",
]
