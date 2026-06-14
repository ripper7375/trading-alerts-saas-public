"""Matplotlib renderer for the three-canvas multi-timeframe layout.

Candles are drawn by hand against a real time x-axis (unix seconds) rather than
via mplfinance's categorical index. That matters for this task: the M5 channel
must overlay the M15 candles by *price and time*, so both panels have to share a
real time axis — a categorical bar index would misalign M5 lines on M15 bars.
"""

from __future__ import annotations

from datetime import datetime, timezone

import matplotlib

matplotlib.use("Agg")  # headless / file output
import matplotlib.dates as mdates  # noqa: E402
import matplotlib.pyplot as plt  # noqa: E402
import pandas as pd  # noqa: E402

from .data_source import ChartData  # noqa: E402

# Channel styling — the three parallel blue lines from the target image.
_CHANNEL_BLUE = "#1f6fe0"
_UP_COLOR = "#26a269"  # bullish candle
_DOWN_COLOR = "#c01c28"  # bearish candle


def _ts_to_num(ts_series: pd.Series):
    """Unix seconds -> matplotlib date numbers (UTC)."""
    dt = [datetime.fromtimestamp(int(t), tz=timezone.utc) for t in ts_series]
    return mdates.date2num(dt)


def _draw_candles(ax, candles: pd.DataFrame, timeframe: str) -> None:
    if candles.empty:
        return
    x = _ts_to_num(candles["timestamp"])
    # Bar width = ~70% of the spacing between bars (in date-number units).
    width = (x[1] - x[0]) * 0.7 if len(x) > 1 else 0.002

    for xi, (_, row) in zip(x, candles.iterrows()):
        up = row["close"] >= row["open"]
        color = _UP_COLOR if up else _DOWN_COLOR
        # High-low wick.
        ax.plot([xi, xi], [row["low"], row["high"]], color=color, linewidth=0.7, zorder=2)
        # Open-close body.
        lower = min(row["open"], row["close"])
        height = abs(row["close"] - row["open"]) or 1e-6
        ax.add_patch(
            plt.Rectangle(
                (xi - width / 2, lower),
                width,
                height,
                facecolor=color,
                edgecolor=color,
                linewidth=0.5,
                zorder=3,
            )
        )


def _draw_channel(ax, chart: ChartData) -> None:
    """Draw the equal-distance channel (uoedt / base_fl / loedt)."""
    frame = chart.channel.frame
    if not chart.channel.has_data:
        return
    x = _ts_to_num(frame["timestamp"])
    label_tf = chart.channel_timeframe
    ax.plot(x, frame["uoedt"], color=_CHANNEL_BLUE, linewidth=1.3, zorder=4,
            label=f"{label_tf} UOEDT ({chart.channel.variant})")
    ax.plot(x, frame["base_fl"], color=_CHANNEL_BLUE, linewidth=1.1, linestyle="--",
            zorder=4, label=f"{label_tf} base_fl")
    ax.plot(x, frame["loedt"], color=_CHANNEL_BLUE, linewidth=1.3, zorder=4,
            label=f"{label_tf} LOEDT")


def _render_panel(ax, chart: ChartData, title: str) -> None:
    _draw_candles(ax, chart.candles, chart.timeframe)
    _draw_channel(ax, chart)

    ax.set_title(title, fontsize=11, loc="left", fontweight="bold")
    ax.grid(True, alpha=0.25, linewidth=0.5)
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%d %b\n%H:%M", tz=timezone.utc))
    ax.xaxis.set_major_locator(mdates.AutoDateLocator())
    ax.tick_params(axis="both", labelsize=8)
    ax.yaxis.tick_right()
    ax.legend(loc="upper left", fontsize=7, framealpha=0.85)


def render_combined(
    panels: dict[str, ChartData],
    out_path: str,
    variant: str = "best_fit",
) -> str:
    """Render Charts A | B | C side by side into one PNG; return `out_path`.

    Layout mirrors the target image: A = XAUUSD M5 with its M5 channel; B and C =
    XAUUSD M15 each with the SAME M5 channel overlaid by price+time.
    """
    fig, axes = plt.subplots(1, 3, figsize=(21, 7), constrained_layout=True)
    titles = {
        "A": "Chart A — XAUUSD M5  (M5 channel)",
        "B": "Chart B — XAUUSD M15  (M5 channel overlaid)",
        "C": "Chart C — XAUUSD M15  (M5 channel overlaid)",
    }
    for ax, key in zip(axes, ("A", "B", "C")):
        _render_panel(ax, panels[key], titles[key])

    fig.suptitle(
        f"DavinTrade — Multi-Timeframe Visualisation  ·  variant: {variant}",
        fontsize=13,
        fontweight="bold",
    )
    fig.savefig(out_path, dpi=120)
    plt.close(fig)
    return out_path
