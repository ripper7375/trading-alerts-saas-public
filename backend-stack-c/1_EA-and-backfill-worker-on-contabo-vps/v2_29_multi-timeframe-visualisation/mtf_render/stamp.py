"""The chart stamp: which cycle an image belongs to (rule 8, ADR-014).

Every image says, in its title and in its R2 object metadata, which 5-minute slot
it was drawn for, the last bar that was closed at that slot, which indicators it
shows and which variant it is. An image from another slot can then be recognised
and kept out of a prompt; "a chart from another moment" stops being something
only the reader's eye can catch.

Deliberately free of pandas, matplotlib and boto3: the stamp is plain data, so the
renderer, the upload worker and the tests all share one definition of it, and the
monolith's ``lib/storage/chart-keys.ts`` (``parseChartStamp``) reads the same
metadata keys. A test on each side pins the key names against this file, because
the two are maintained in different languages with nothing linking them.

What each field means
---------------------
``slot``            the cycle's slot: ``collection_cycles.cycle_time`` of the validated
                    M5 cycle the image was drawn from (unix seconds, UTC, a multiple of 300)
``last_closed_bar`` ``slot - 300``: the open time of the newest M5 bar that is closed at
                    the slot (rule 2, a bar is closed when open time + period <= slot)
``overlay_m5``      the channel drawn on the M5 panel, and overlaid on the M15 panel in the
                    ``overlay`` variant: the active indicator for M5 (a registry key such as
                    ``best_fit_a``), or the configured default list when the setting could
                    not be read
``overlay_m15``     the channel the M15 panel carries as its own (the active indicator for M15)
``overlay_source``  ``setting`` when both indicators were resolved from the gateway for this
                    slot, ``default`` when the renderer fell back to its configured default
``variant``         ``overlay`` (the M5 channel is overlaid on the M15 panel) or ``standard``
``rendered_at``     when the image was drawn (unix seconds, UTC)
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Mapping, Optional

SLOT_SECONDS = 300

VARIANTS = ("overlay", "standard")
OVERLAY_SOURCES = ("setting", "default")

# The R2 object metadata keys. S3 lowercases user metadata keys and stores them
# as x-amz-meta-<key>; the first five are the contract with the monolith, the last
# two say which indicator each panel carries and where that choice came from.
META_SLOT = "cycle-slot"
META_LAST_CLOSED_BAR = "last-closed-bar"
META_OVERLAY = "overlay"
META_VARIANT = "variant"
META_RENDERED_AT = "rendered-at"
META_OVERLAY_M15 = "overlay-m15"
META_OVERLAY_SOURCE = "overlay-source"

METADATA_KEYS = (
    META_SLOT,
    META_LAST_CLOSED_BAR,
    META_OVERLAY,
    META_VARIANT,
    META_RENDERED_AT,
    META_OVERLAY_M15,
    META_OVERLAY_SOURCE,
)

FORMING_NOTICE = (
    "the rightmost candle on each panel is STILL FORMING (dashed, hollow)"
    " - not a completed bar"
)


def utc_text(ts: int) -> str:
    """``2026-09-18 20:55 UTC``: minutes are enough for a bar, and unambiguous."""
    return datetime.fromtimestamp(int(ts), tz=timezone.utc).strftime("%Y-%m-%d %H:%M UTC")


def normalize_overlays(value: object) -> str:
    """``" best_fit_a , non_b"`` -> ``best_fit_a,non_b``: one spelling for metadata and title."""
    if isinstance(value, str):
        parts = [p.strip() for p in value.split(",")]
    else:
        parts = [str(p).strip() for p in value]  # type: ignore[union-attr]
    parts = [p for p in parts if p]
    if not parts:
        raise ValueError("a stamp needs at least one overlay")
    return ",".join(parts)


def _require_int(name: str, value: object) -> int:
    # bool is an int in Python; a stamp field that is True is a bug, not a time.
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValueError(f"{name} must be an integer, got {value!r}")
    return value


@dataclass(frozen=True)
class RenderStamp:
    """What one rendered image says about itself. See the module docstring."""

    slot: int
    variant: str
    overlay_m5: str
    overlay_m15: str
    overlay_source: str
    rendered_at: int

    def __post_init__(self) -> None:
        slot = _require_int("slot", self.slot)
        if slot < 0 or slot % SLOT_SECONDS != 0:
            raise ValueError(
                f"slot must be a unix time on a {SLOT_SECONDS}-second boundary, got {slot}"
            )
        _require_int("rendered_at", self.rendered_at)
        if self.variant not in VARIANTS:
            raise ValueError(f"variant must be one of {VARIANTS}, got {self.variant!r}")
        if self.overlay_source not in OVERLAY_SOURCES:
            raise ValueError(
                f"overlay_source must be one of {OVERLAY_SOURCES}, got {self.overlay_source!r}"
            )
        # normalise through object.__setattr__: the dataclass is frozen
        object.__setattr__(self, "overlay_m5", normalize_overlays(self.overlay_m5))
        object.__setattr__(self, "overlay_m15", normalize_overlays(self.overlay_m15))
        for name in ("overlay_m5", "overlay_m15"):
            if not getattr(self, name).isascii():
                raise ValueError(f"{name} must be ASCII (S3 metadata), got {getattr(self, name)!r}")

    @property
    def last_closed_bar(self) -> int:
        """Open time of the newest M5 bar closed at the slot (rule 2)."""
        return self.slot - SLOT_SECONDS

    def object_metadata(self) -> dict[str, str]:
        """The R2 user metadata: every value a string (S3 stores nothing else)."""
        return {
            META_SLOT: str(self.slot),
            META_LAST_CLOSED_BAR: str(self.last_closed_bar),
            META_OVERLAY: self.overlay_m5,
            META_VARIANT: self.variant,
            META_RENDERED_AT: str(self.rendered_at),
            META_OVERLAY_M15: self.overlay_m15,
            META_OVERLAY_SOURCE: self.overlay_source,
        }

    def title(self, newest_m5_bar: Optional[int] = None) -> str:
        """The figure's suptitle: three lines a person and a vision model can both read.

        `newest_m5_bar` is the open time of the newest M5 candle actually drawn. It is
        stated as a fact rather than assumed: the picture then carries evidence of its
        own freshness, whichever way the "is the newest row the new bar's stub or the
        bar about to close" question (waiting-on.md) turns out.
        """
        m15 = f", M15 {self.overlay_m15}" if self.overlay_m15 != self.overlay_m5 else ""
        drawn = (
            f"  ·  newest M5 candle opened {utc_text(newest_m5_bar)}"
            if newest_m5_bar is not None
            else ""
        )
        default_note = "" if self.overlay_source == "setting" else " (default, setting unavailable)"
        return (
            f"DavinTrade - XAUUSD Multi-Timeframe  ·  variant: {self.variant}"
            f"  ·  rendered {utc_text(self.rendered_at)}"
            f"\ncycle slot {self.slot} ({utc_text(self.slot)})"
            f"  ·  last closed bar {self.last_closed_bar} ({utc_text(self.last_closed_bar)})"
            f"\noverlay: M5 {self.overlay_m5}{m15}{default_note}{drawn}"
            f"\n{FORMING_NOTICE}"
        )


def parse_metadata(metadata: Mapping[str, str]) -> Optional[RenderStamp]:
    """The inverse of ``object_metadata``, or None if the metadata is absent or invalid.

    The monolith's ``parseChartStamp`` does the same in TypeScript; a test keeps the
    two reading the same keys. Used by the tests (a round trip) and available to any
    VPS-side tool that wants to read a stamp back.
    """
    try:
        slot = int(metadata[META_SLOT])
        if int(metadata[META_LAST_CLOSED_BAR]) != slot - SLOT_SECONDS:
            return None
        overlay = metadata[META_OVERLAY]
        return RenderStamp(
            slot=slot,
            variant=metadata[META_VARIANT],
            overlay_m5=overlay,
            overlay_m15=metadata.get(META_OVERLAY_M15, overlay),
            overlay_source=metadata.get(META_OVERLAY_SOURCE, "default"),
            rendered_at=int(metadata[META_RENDERED_AT]),
        )
    except (KeyError, ValueError, TypeError):
        return None
