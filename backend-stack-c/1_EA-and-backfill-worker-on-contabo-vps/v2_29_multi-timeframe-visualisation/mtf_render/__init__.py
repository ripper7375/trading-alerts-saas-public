"""Multi-timeframe visualisation (backend rendering only).

Renders the DavinTrade three-canvas chart layout from ``market_data``:

  * Chart A — XAUUSD M5 candles + the M5 equal-distance channel
    (``{variant}_uoedt`` / ``{variant}_base_fl`` / ``{variant}_loedt``).
  * Chart B — XAUUSD M15 candles + the SAME M5 channel overlaid (by price+time).
  * Chart C — XAUUSD M15 candles + the SAME M5 channel overlaid.

This package only READS the already-computed channel columns and plots them;
it never recomputes indicators. UI / copy-paste buttons are out of scope.
"""

from .data_source import Channel, ChartData, VARIANTS, load_market_data
from .renderer import render_combined

__all__ = [
    "Channel",
    "ChartData",
    "VARIANTS",
    "load_market_data",
    "render_combined",
]
