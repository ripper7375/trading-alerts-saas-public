"""CLI entry point for the multi-timeframe renderer.

Examples
--------
Render against the synthetic golden fixture (no DB needed)::

    python -m mtf_render --out chart.png

Render against a real database::

    python -m mtf_render --db /path/to/xauusd.db --variant cherry_a --out chart.png
"""

from __future__ import annotations

import argparse
import os
import tempfile

from .data_source import VARIANTS, load_market_data
from .fixture import build_fixture_db
from .renderer import render_combined


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="mtf_render",
        description="Render the DavinTrade A/B/C multi-timeframe charts from market_data.",
    )
    parser.add_argument(
        "--db",
        help="Path to xauusd.db. If omitted, a synthetic golden fixture is generated.",
    )
    parser.add_argument(
        "--variant",
        default="best_fit",
        choices=VARIANTS,
        help="Centroid-regression channel variant to plot (default: best_fit).",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=200,
        help="Max bars per timeframe (most recent). Default: 200.",
    )
    parser.add_argument(
        "--out",
        default="multi_timeframe_chart.png",
        help="Output PNG path (default: multi_timeframe_chart.png).",
    )
    args = parser.parse_args(argv)

    cleanup_db = None
    db_path = args.db
    if not db_path:
        fd, db_path = tempfile.mkstemp(prefix="xauusd_fixture_", suffix=".db")
        os.close(fd)
        build_fixture_db(db_path)
        cleanup_db = db_path
        print(f"[mtf_render] no --db given; generated synthetic fixture at {db_path}")

    try:
        panels = load_market_data(db_path, variant=args.variant, limit=args.limit)
        out = render_combined(panels, args.out, variant=args.variant)
    finally:
        if cleanup_db and os.path.exists(cleanup_db):
            os.remove(cleanup_db)

    print(f"[mtf_render] wrote {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
