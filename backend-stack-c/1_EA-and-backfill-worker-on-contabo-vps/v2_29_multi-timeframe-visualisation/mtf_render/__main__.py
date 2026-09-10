"""CLI entry point for the multi-timeframe renderer.

Examples
--------
Render against the synthetic golden fixture (no DB needed)::

    python -m mtf_render --out chart.png

Render both D2 variants from one data snapshot -- what the VPS cron calls::

    python -m mtf_render --db /path/to/xauusd.db --both-variants

Render the standard (no M5 overlay) variant of a different overlay set::

    python -m mtf_render --overlays cherry_a,resistance,support --no-m5-overlay
"""

from __future__ import annotations

import argparse
import os
import tempfile
from pathlib import Path

from .data_source import load_market_data
from .fixture import build_fixture_db
from .overlays import DEFAULT_OVERLAY_KEYS, OVERLAY_KEYS, resolve
from .renderer import render_combined

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

    # Validate before doing any work: building a fixture only to reject the
    # overlay name afterwards wastes a second and buries the real error.
    resolve(args.overlays)

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
                    overlays=args.overlays,
                    limit=args.limit,
                    m5_overlay=flag,
                )
                written.append(
                    render_combined(
                        panels, _variant_path(args.out, variant), overlays=args.overlays
                    )
                )
        else:
            panels = load_market_data(
                db_path,
                overlays=args.overlays,
                limit=args.limit,
                m5_overlay=args.m5_overlay,
            )
            written.append(render_combined(panels, args.out, overlays=args.overlays))
    finally:
        if cleanup_db and os.path.exists(cleanup_db):
            os.remove(cleanup_db)

    for path in written:
        print(f"[mtf_render] wrote {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
