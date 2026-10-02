"""CLI entry point for the multi-timeframe renderer.

Examples
--------
Render against the synthetic golden fixture (no DB needed)::

    python -m mtf_render --out chart.png

Render both D2 variants from one data snapshot -- what the VPS cron calls::

    python -m mtf_render --db /path/to/xauusd.db --both-variants

Render the standard (no M5 overlay) variant of a different overlay set::

    python -m mtf_render --overlays cherry_a,resistance,support --no-m5-overlay

Render a STAMPED pair for one cycle -- what the VPS renderer service calls. The
data is read as of the slot, the title says which cycle the image belongs to, and
each timeframe carries its own active indicator::

    python -m mtf_render --db xauusd.db --both-variants --slot 1789764900 --m15-overlays non_b
"""

from __future__ import annotations

import argparse
import os
import tempfile
import time
from pathlib import Path

from .data_source import load_market_data
from .fixture import build_fixture_db
from .overlays import DEFAULT_OVERLAY_KEYS, OVERLAY_KEYS, resolve
from .renderer import render_combined
from .stamp import OVERLAY_SOURCES, RenderStamp

DEFAULT_OUT = "mtf_render_xauusd_m5_m15.png"


def _variant_path(out: str, variant: str) -> str:
    """chart.png -> chart_overlay.png / chart_standard.png."""
    p = Path(out)
    return str(p.with_name(f"{p.stem}_{variant}{p.suffix or '.png'}"))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="mtf_render",
        description=(
            "Render the DavinTrade M5 / M5-on-M15 multi-timeframe charts "
            "from market_data."
        ),
    )
    parser.add_argument(
        "--db",
        help="Path to xauusd.db. If omitted, a synthetic golden fixture is generated.",
    )
    parser.add_argument(
        "--overlays",
        default=",".join(DEFAULT_OVERLAY_KEYS),
        help=(
            "Comma-separated overlays to draw. "
            f"Available: {', '.join(OVERLAY_KEYS)}. "
            f"Default: {','.join(DEFAULT_OVERLAY_KEYS)}."
        ),
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=200,
        help=(
            "Max M5 bars (most recent). The M15 panel is clipped to the same "
            "clock window, so it holds roughly a third as many bars. Default: 200."
        ),
    )
    parser.add_argument(
        "--out",
        default=DEFAULT_OUT,
        help=f"Output PNG path (default: {DEFAULT_OUT}).",
    )

    parser.add_argument(
        "--m5-overlays",
        default=None,
        help="Overlays of the M5 panel (and the M5 channel overlaid on M15). Default: --overlays.",
    )
    parser.add_argument(
        "--m15-overlays",
        default=None,
        help="The M15 panel's own overlays: the active indicator is one per timeframe. Default: the M5 set.",
    )
    parser.add_argument(
        "--slot",
        type=int,
        default=None,
        help=(
            "Draw the picture for this cycle: read the data AS OF the slot (no bar opened "
            "after it) and stamp the title with it. A unix time on a 5-minute boundary."
        ),
    )
    parser.add_argument(
        "--overlay-source",
        choices=OVERLAY_SOURCES,
        default=None,
        help="With --slot: 'setting' when the overlays are the active-indicator setting's, 'default' otherwise (default).",
    )
    parser.add_argument(
        "--rendered-at",
        type=int,
        default=None,
        help="With --slot: the render time to state (unix seconds). Default: now. The upload worker passes its own so the title and the object metadata agree.",
    )

    overlay_group = parser.add_mutually_exclusive_group()
    overlay_group.add_argument(
        "--m5-overlay",
        dest="m5_overlay",
        action="store_true",
        default=True,
        help="Draw the M5 channel on the M15 panel (the 'overlay' variant). Default.",
    )
    overlay_group.add_argument(
        "--no-m5-overlay",
        dest="m5_overlay",
        action="store_false",
        help="Omit the M5 channel from the M15 panel (the 'standard' variant).",
    )

    parser.add_argument(
        "--both-variants",
        action="store_true",
        help=(
            "Render both variants from ONE data snapshot, writing "
            "<out>_overlay.png and <out>_standard.png. Use this for the cron "
            "job so the pair cannot come from two different reads."
        ),
    )
    args = parser.parse_args(argv)

    if args.slot is None and (args.overlay_source is not None or args.rendered_at is not None):
        parser.error("--overlay-source and --rendered-at only make sense with --slot")
    m5_overlays = args.m5_overlays or args.overlays
    m15_overlays = args.m15_overlays or m5_overlays

    # Validate before doing any work: building a fixture only to reject the
    # overlay name afterwards wastes a second and buries the real error.
    resolve(m5_overlays)
    resolve(m15_overlays)
    if args.slot is not None:
        # RenderStamp validates the slot (a boundary) and the overlays loudly.
        RenderStamp(
            slot=args.slot,
            variant="overlay",
            overlay_m5=m5_overlays,
            overlay_m15=m15_overlays,
            overlay_source=args.overlay_source or "default",
            rendered_at=args.rendered_at if args.rendered_at is not None else int(time.time()),
        )
    rendered_at = args.rendered_at if args.rendered_at is not None else int(time.time())

    def stamp_for(variant: str):
        if args.slot is None:
            return None
        return RenderStamp(
            slot=args.slot,
            variant=variant,
            overlay_m5=m5_overlays,
            overlay_m15=m15_overlays,
            overlay_source=args.overlay_source or "default",
            rendered_at=rendered_at,
        )

    cleanup_db = None
    db_path = args.db
    if not db_path:
        fd, db_path = tempfile.mkstemp(prefix="xauusd_fixture_", suffix=".db")
        os.close(fd)
        build_fixture_db(db_path)
        cleanup_db = db_path
        print(f"[mtf_render] no --db given; generated synthetic fixture at {db_path}")

    written: list[str] = []
    try:
        if args.both_variants:
            # One load per variant, but both from the same database file with no
            # writes in between -- the snapshot cannot shift underneath them.
            for variant, flag in (("overlay", True), ("standard", False)):
                panels = load_market_data(
                    db_path,
                    overlays=m5_overlays,
                    limit=args.limit,
                    m5_overlay=flag,
                    as_of_slot=args.slot,
                    m15_overlays=m15_overlays,
                )
                written.append(
                    render_combined(
                        panels,
                        _variant_path(args.out, variant),
                        overlays=m5_overlays,
                        stamp=stamp_for(variant),
                    )
                )
        else:
            panels = load_market_data(
                db_path,
                overlays=m5_overlays,
                limit=args.limit,
                m5_overlay=args.m5_overlay,
                as_of_slot=args.slot,
                m15_overlays=m15_overlays,
            )
            written.append(
                render_combined(
                    panels,
                    args.out,
                    overlays=m5_overlays,
                    stamp=stamp_for("overlay" if args.m5_overlay else "standard"),
                )
            )
    finally:
        if cleanup_db and os.path.exists(cleanup_db):
            os.remove(cleanup_db)

    for path in written:
        print(f"[mtf_render] wrote {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
