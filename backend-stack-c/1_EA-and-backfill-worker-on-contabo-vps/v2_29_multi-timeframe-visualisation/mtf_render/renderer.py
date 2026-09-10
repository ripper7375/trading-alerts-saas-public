"""Matplotlib renderer for the two-canvas multi-timeframe layout.

Upper panel: XAUUSD M5 with its own equal-distance channel.
Lower panel: XAUUSD M15 with its own channel, plus -- in the ``overlay`` variant
-- the M5 channel layered on top. This mirrors the shipped terminal UI, where
the M15 chart always carries its own channel and the PRO-gated "M5 on M15"
toggle adds the M5 one over it.

Candles are drawn by hand against a real time x-axis (unix seconds) rather than
via mplfinance's categorical index. That matters here: the M5 channel must
overlay the M15 candles by *price and time*, and a categorical bar index would
misalign them.

The output is consumed by a vision model as well as by a human, so two things
are deliberate rather than cosmetic:

  * Every legend entry names the timeframe its values were computed on, because
    the lower panel can carry an M15 channel and an M5 channel at once.
  * The ``standard`` variant *states* that the M5 overlay is off. Conveying its
    absence by silently omitting the lines is what would let a model reason
    about a channel it was never shown.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Sequence

import matplotlib

matplotlib.use("Agg")  # headless / file output
import matplotlib.dates as mdates  # noqa: E402
import matplotlib.pyplot as plt  # noqa: E402
import pandas as pd  # noqa: E402

from .data_source import ChartData, Overlay  # noqa: E402

_UP_COLOR = "#26a269"  # bullish candle
_DOWN_COLOR = "#c01c28"  # bearish candle

# Drawn beside the newest candle on every panel. Short on purpose -- it sits in
# the plot area, and a vision model reads it as a caption on that bar.
FORMING_BAR_LABEL = "forming"

# A panel's OWN channel. First entry keeps the original single-overlay blue.
_OWN_COLORS = ("#1f6fe0", "#e08a1f", "#7b3fe0", "#0f9b8e", "#c0398b", "#5a6b7a")

# The M5 channel layered onto the M15 panel. Cyan + dashed mirrors the UI's own
# overlay styling, and keeps it separable from the panel's own lines.
_M5_OVERLAY_COLORS = ("#06b6d4", "#f59e0b", "#a855f7", "#14b8a6", "#ec4899", "#64748b")
_M5_OVERLAY_STYLE = (0, (6, 3))


def _ts_to_num(ts_series: pd.Series):
    """Unix seconds -> matplotlib date numbers (UTC)."""
    dt = [datetime.fromtimestamp(int(t), tz=timezone.utc) for t in ts_series]
    return mdates.date2num(dt)


def _draw_candles(ax, candles: pd.DataFrame, mark_forming: bool = True) -> None:
    """Draw candles, distinguishing the newest (still-forming) bar.

    MT5 exports include shift 0, so the newest row in ``market_data`` is always
    an incomplete candle until the next cycle overwrites it (pipeline deck
    SS10). Every other candle in the image is final; that one is not.

    It is drawn **hollow and dashed with a "forming" label** rather than
    dropped. Dropping it would make the render up to one bar-period stale, so
    the trader's screen would show a bar the downloaded PNG does not -- exactly
    the screen-vs-download divergence this whole stack exists to close. Marking
    keeps parity *and* removes the ambiguity, because the image then says so
    itself instead of relying on the reader knowing. Same principle as the
    ``standard`` variant naming its missing overlay rather than just omitting
    the lines.

    It matters most for the vision model: a wick rejection read off a bar that
    is thirty seconds old and still moving is not a pattern.
    """
    if candles.empty:
        return
    x = _ts_to_num(candles["timestamp"])
    # Bar width = ~70% of the spacing between bars (in date-number units).
    width = (x[1] - x[0]) * 0.7 if len(x) > 1 else 0.002
    last_index = len(x) - 1

    for i, (xi, (_, row)) in enumerate(zip(x, candles.iterrows())):
        up = row["close"] >= row["open"]
        color = _UP_COLOR if up else _DOWN_COLOR
        forming = mark_forming and i == last_index

        ax.plot(
            [xi, xi],
            [row["low"], row["high"]],
            color=color,
            linewidth=0.7,
            linestyle="--" if forming else "-",
            zorder=2,
        )
        lower = min(row["open"], row["close"])
        height = abs(row["close"] - row["open"]) or 1e-6
        ax.add_patch(
            plt.Rectangle(
                (xi - width / 2, lower),
                width,
                height,
                # Hollow, so it reads as "not settled" at a glance.
                facecolor="none" if forming else color,
                edgecolor=color,
                linewidth=1.0 if forming else 0.5,
                linestyle="--" if forming else "-",
                zorder=3,
            )
        )

        if forming:
            ax.annotate(
                FORMING_BAR_LABEL,
                xy=(xi, row["high"]),
                xytext=(0, 6),
                textcoords="offset points",
                ha="center",
                fontsize=7,
                fontweight="bold",
                color=color,
                zorder=6,
                # matplotlib's default 5% y-margin normally leaves room above
                # the high, but at MIN_CHART_HEIGHT that margin is about the
                # same as this offset. Better to spill slightly outside the
                # axes than to silently drop the caveat.
                annotation_clip=False,
            )


def _draw_overlay(ax, overlay: Overlay, color: str, linestyle, zorder: int) -> None:
    """Draw one overlay: three parallel lines for a channel, one for a line."""
    if not overlay.has_data:
        return
    frame = overlay.frame
    x = _ts_to_num(frame["timestamp"])
    label = overlay.label

    if overlay.spec.kind == "channel":
        ax.plot(x, frame["upper"], color=color, linewidth=1.3,
                linestyle=linestyle, zorder=zorder, label=f"{label} UOEDT")
        # Mid line dashed-thin so it reads as the baseline, not a bound.
        ax.plot(x, frame["mid"], color=color, linewidth=1.0,
                linestyle=":" if linestyle == "-" else linestyle,
                zorder=zorder, label=f"{label} base")
        ax.plot(x, frame["lower"], color=color, linewidth=1.3,
                linestyle=linestyle, zorder=zorder, label=f"{label} LOEDT")
    else:
        ax.plot(x, frame["mid"], color=color, linewidth=1.4,
                linestyle=linestyle, zorder=zorder, label=label)


def _panel_title(chart: ChartData) -> str:
    """Title that states the overlay's presence -- or its absence -- explicitly.

    Three states, not two. "Requested but empty" (indicator warm-up, when the
    channel columns are still NULL) must not be labelled the same as "not
    requested": one is missing data, the other is the user's setting, and a
    reader cannot tell them apart from the absence of lines alone.
    """
    if chart.timeframe == "M5":
        return "Chart 1 (upper) - XAUUSD M5  ·  M5 channel"
    if chart.has_m5_overlay:
        return (
            "Chart 2 (lower) - XAUUSD M15  ·  M15 channel "
            "+ M5 channel OVERLAID (PRO)"
        )
    if chart.m5_overlay_requested:
        return (
            "Chart 2 (lower) - XAUUSD M15  ·  M15 channel  ·  "
            "M5 overlay ON but NO DATA (indicator warm-up)"
        )
    return "Chart 2 (lower) - XAUUSD M15  ·  M15 channel  ·  M5 overlay OFF"


def _render_panel(ax, chart: ChartData) -> None:
    _draw_candles(ax, chart.candles)

    for i, overlay in enumerate(chart.own_overlays):
        _draw_overlay(ax, overlay, _OWN_COLORS[i % len(_OWN_COLORS)], "-", 4)

    for i, overlay in enumerate(chart.m5_overlays):
        _draw_overlay(
            ax,
            overlay,
            _M5_OVERLAY_COLORS[i % len(_M5_OVERLAY_COLORS)],
            _M5_OVERLAY_STYLE,
            5,
        )

    ax.set_title(_panel_title(chart), fontsize=11, loc="left", fontweight="bold")
    ax.grid(True, alpha=0.25, linewidth=0.5)
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%d %b\n%H:%M", tz=timezone.utc))
    ax.xaxis.set_major_locator(mdates.AutoDateLocator())
    ax.tick_params(axis="both", labelsize=8)
    ax.yaxis.tick_right()
    # Nothing is labelled when every overlay is NULL (indicator warm-up);
    # calling legend() then just emits a warning and draws an empty box.
    if ax.get_legend_handles_labels()[1]:
        ax.legend(loc="upper left", fontsize=7, framealpha=0.85, ncol=2)


def render_combined(
    panels: dict[str, ChartData],
    out_path: str,
    overlays: Sequence[str] | str = "",
) -> str:
    """Render the M5 and M15 panels stacked into one PNG; return `out_path`.

    Upper = XAUUSD M5 with its own channel. Lower = XAUUSD M15 with its own
    channel, plus the M5 channel when the panels were built with ``m5_overlay``.
    """
    fig, axes = plt.subplots(2, 1, figsize=(14, 10), sharex=True,
                             constrained_layout=True)

    upper, lower = panels["M5"], panels["M15"]
    _render_panel(axes[0], upper)
    _render_panel(axes[1], lower)

    if isinstance(overlays, str):
        overlay_text = overlays
    else:
        overlay_text = ", ".join(overlays)
    if not overlay_text:
        overlay_text = ", ".join(o.spec.key for o in upper.own_overlays)

    # Keyed on the request, not on whether data happened to exist: a warm-up
    # render of the overlay variant is still the overlay variant, and the
    # filename it is written to says so.
    variant = "overlay" if lower.m5_overlay_requested else "standard"
    rendered_at = datetime.now(tz=timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    fig.suptitle(
        f"DavinTrade - XAUUSD Multi-Timeframe  ·  overlays: {overlay_text}"
        f"  ·  variant: {variant}  ·  rendered {rendered_at}"
        f"\nrightmost candle on each panel is STILL FORMING (dashed, hollow)"
        f" — not a completed bar",
        fontsize=12,
        fontweight="bold",
    )

    fig.savefig(out_path, dpi=120)
    plt.close(fig)
    return out_path
