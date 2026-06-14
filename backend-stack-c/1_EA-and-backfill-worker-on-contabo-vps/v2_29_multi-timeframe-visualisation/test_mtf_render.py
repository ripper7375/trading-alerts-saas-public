"""Smoke tests for the multi-timeframe renderer.

Run: python -m pytest test_mtf_render.py   (or: python test_mtf_render.py)
"""

from __future__ import annotations

import os
import tempfile

from mtf_render.data_source import VARIANTS, load_market_data
from mtf_render.fixture import build_fixture_db
from mtf_render.renderer import render_combined


def _fixture_db() -> str:
    fd, db = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    return build_fixture_db(db)


def test_panels_have_expected_timeframes_and_shared_channel() -> None:
    db = _fixture_db()
    try:
        panels = load_market_data(db, variant="best_fit", limit=200)
    finally:
        os.remove(db)
    assert panels["A"].timeframe == "M5"
    assert panels["B"].timeframe == "M15"
    assert panels["C"].timeframe == "M15"
    # B and C overlay the SAME M5 channel object computed for A.
    assert panels["B"].channel is panels["A"].channel
    assert panels["C"].channel is panels["A"].channel
    assert panels["A"].channel_timeframe == "M5"
    assert panels["A"].channel.has_data


def test_all_variants_load() -> None:
    db = _fixture_db()
    try:
        for variant in VARIANTS:
            panels = load_market_data(db, variant=variant, limit=50)
            assert panels["A"].channel.variant == variant
            assert panels["A"].channel.has_data
    finally:
        os.remove(db)


def test_render_writes_png() -> None:
    db = _fixture_db()
    out = tempfile.mktemp(suffix=".png")
    try:
        panels = load_market_data(db, variant="best_fit", limit=100)
        render_combined(panels, out, variant="best_fit")
        assert os.path.exists(out) and os.path.getsize(out) > 1000
    finally:
        os.remove(db)
        if os.path.exists(out):
            os.remove(out)


if __name__ == "__main__":
    test_panels_have_expected_timeframes_and_shared_channel()
    test_all_variants_load()
    test_render_writes_png()
    print("all tests passed")
