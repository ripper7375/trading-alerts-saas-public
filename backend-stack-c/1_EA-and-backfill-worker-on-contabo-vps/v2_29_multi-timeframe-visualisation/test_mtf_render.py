"""Tests for the multi-timeframe renderer.

Run: python -m pytest test_mtf_render.py   (or: python test_mtf_render.py)
"""

from __future__ import annotations

import os
import re
import tempfile
from pathlib import Path

from mtf_render.data_source import load_market_data
from mtf_render.fixture import build_fixture_db
from mtf_render.overlays import OVERLAY_KEYS, OVERLAYS, all_columns, resolve
from mtf_render.renderer import render_combined

# The real schema this module must stay in step with.
LIVE_SCHEMA = (
    Path(__file__).resolve().parent.parent
    / "v2_29_data_pipeline_architecture"
    / "sqlite_schema_v6_xauusd.sql"
)


def _fixture_db() -> str:
    fd, db = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    return build_fixture_db(db)


def _live_market_data_columns() -> set[str]:
    """Parse the market_data CREATE TABLE block out of the real schema file."""
    sql = LIVE_SCHEMA.read_text(encoding="utf-8", errors="replace")
    match = re.search(
        r"CREATE TABLE IF NOT EXISTS market_data\s*\((.*?)\n\);", sql, re.S | re.I
    )
    assert match, f"could not find the market_data CREATE TABLE block in {LIVE_SCHEMA}"

    columns: set[str] = set()
    for line in match.group(1).splitlines():
        line = line.strip()
        if not line or line.startswith("--"):
            continue
        token = line.split()[0]
        if token.upper() in {"PRIMARY", "FOREIGN", "UNIQUE", "CHECK", "CONSTRAINT"}:
            continue
        columns.add(token.strip(","))
    return columns


# --------------------------------------------------------------------------
# Schema parity -- the check that was missing when best_fit was renamed.
# --------------------------------------------------------------------------


def test_live_schema_file_is_reachable() -> None:
    """A wrong relative path would make the parity test pass vacuously."""
    assert LIVE_SCHEMA.exists(), f"schema not found at {LIVE_SCHEMA}"


def test_registry_columns_exist_in_live_schema() -> None:
    """Every column the registry can read must exist in the real market_data.

    This is the test that would have caught the 2026-09-03 best_fit ->
    best_fit_a/best_fit_b split, which left the module selecting a column that
    no longer existed while its own fixture kept inventing the old name.
    """
    live = _live_market_data_columns()
    missing = sorted(c for c in all_columns() if c not in live)
    assert not missing, f"registry columns absent from the live schema: {missing}"


def test_fixture_columns_match_live_schema() -> None:
    """The fixture must not invent columns the real table does not have."""
    import sqlite3

    db = _fixture_db()
    try:
        conn = sqlite3.connect(db)
        fixture_cols = {row[1] for row in conn.execute("PRAGMA table_info(market_data)")}
        conn.close()
    finally:
        os.remove(db)

    live = _live_market_data_columns()
    invented = sorted(c for c in fixture_cols if c not in live)
    assert not invented, f"fixture invents columns not in the live schema: {invented}"


def test_irregular_column_names_are_mapped() -> None:
    """fractal_edt's mid line breaks the *_base_fl convention; S/R are single lines."""
    assert OVERLAYS["fractal_edt"].mid == "fractal_best_fl"
    assert OVERLAYS["resistance"].kind == "line"
    assert OVERLAYS["resistance"].columns == ("best_resistance",)
    assert OVERLAYS["support"].columns == ("best_support",)


def test_resolve_rejects_unknown_overlays() -> None:
    """A stale key must fail loudly rather than reach SQL."""
    import pytest

    with pytest.raises(ValueError, match="unknown overlay"):
        resolve("best_fit")  # the pre-split name


# --------------------------------------------------------------------------
# Panel assembly
# --------------------------------------------------------------------------


def test_panels_have_expected_timeframes_and_shared_overlays() -> None:
    db = _fixture_db()
    try:
        panels = load_market_data(db, overlays="best_fit_a", limit=200)
    finally:
        os.remove(db)

    assert set(panels) == {"M5", "M15"}
    assert panels["M5"].timeframe == "M5"
    assert panels["M15"].timeframe == "M15"

    # The M15 panel overlays the SAME Overlay objects computed for M5.
    assert panels["M15"].m5_overlays is panels["M5"].own_overlays
    assert panels["M5"].own_overlays[0].source_timeframe == "M5"
    assert panels["M15"].own_overlays[0].source_timeframe == "M15"
    assert panels["M5"].own_overlays[0].has_data
    assert panels["M15"].has_m5_overlay

    # The M5 panel never carries a separate overlay set: "own" already means M5.
    assert panels["M5"].m5_overlays == ()


def test_all_overlays_load() -> None:
    db = _fixture_db()
    try:
        for key in OVERLAY_KEYS:
            panels = load_market_data(db, overlays=key, limit=50)
            assert panels["M5"].own_overlays[0].spec.key == key
            assert panels["M5"].own_overlays[0].has_data, f"{key} produced no data"
    finally:
        os.remove(db)


def test_multiple_overlays_load_together() -> None:
    db = _fixture_db()
    try:
        panels = load_market_data(
            db, overlays="best_fit_a,resistance,support", limit=50
        )
    finally:
        os.remove(db)
    keys = [o.spec.key for o in panels["M5"].own_overlays]
    assert keys == ["best_fit_a", "resistance", "support"]


# --------------------------------------------------------------------------
# D1 -- shared clock window
# --------------------------------------------------------------------------


def test_m15_window_matches_m5_window() -> None:
    """The M15 panel is clipped to the M5 panel's time range, not its bar count."""
    db = _fixture_db()
    try:
        panels = load_market_data(db, overlays="best_fit_a", limit=200)
    finally:
        os.remove(db)

    m5 = panels["M5"].candles["timestamp"]
    m15 = panels["M15"].candles["timestamp"]
    assert not m15.empty
    assert m15.min() >= m5.min()
    assert m15.max() <= m5.max()
    # Same window at 3x the bar width => roughly a third as many bars.
    assert len(m15) < len(m5)


# --------------------------------------------------------------------------
# D2 -- the two variants
# --------------------------------------------------------------------------


def test_standard_variant_has_no_m5_overlay() -> None:
    """Toggle off: no M5 channel, but the lower panel must NOT be empty."""
    db = _fixture_db()
    try:
        panels = load_market_data(
            db, overlays="best_fit_a", limit=200, m5_overlay=False
        )
    finally:
        os.remove(db)

    lower = panels["M15"]
    assert lower.m5_overlays == ()
    assert not lower.has_m5_overlay
    # The regression this guards: an M15 panel with candles and nothing plotted.
    assert lower.own_overlays and lower.own_overlays[0].has_data


def test_variants_differ_only_in_m5_overlay() -> None:
    """Everything except the M5 overlay must be identical across the variants."""
    db = _fixture_db()
    try:
        with_overlay = load_market_data(db, overlays="best_fit_a", m5_overlay=True)
        without = load_market_data(db, overlays="best_fit_a", m5_overlay=False)
    finally:
        os.remove(db)

    assert with_overlay["M5"].candles.equals(without["M5"].candles)
    assert with_overlay["M15"].candles.equals(without["M15"].candles)
    assert with_overlay["M15"].own_overlays[0].frame.equals(
        without["M15"].own_overlays[0].frame
    )
    assert with_overlay["M15"].has_m5_overlay
    assert not without["M15"].has_m5_overlay


def test_warmup_nulls_are_not_reported_as_overlay_off() -> None:
    """NULL channel columns must read as missing data, not as a toggle setting.

    During indicator warm-up the channel columns are NULL. An 'overlay' render
    then has nothing to draw -- but calling that "M5 overlay OFF" would blame
    the user's setting for what is really absent data, which is precisely the
    ambiguity the variant-aware titles exist to remove.
    """
    import sqlite3

    from mtf_render.renderer import _panel_title

    db = _fixture_db()
    try:
        conn = sqlite3.connect(db)
        conn.execute(
            "UPDATE market_data SET best_fit_a_uoedt=NULL, "
            "best_fit_a_base_fl=NULL, best_fit_a_loedt=NULL"
        )
        conn.commit()
        conn.close()

        warm = load_market_data(db, overlays="best_fit_a", m5_overlay=True)
        off = load_market_data(db, overlays="best_fit_a", m5_overlay=False)
    finally:
        os.remove(db)

    lower_warm, lower_off = warm["M15"], off["M15"]

    # Requested but empty: distinguishable from not requested.
    assert lower_warm.m5_overlay_requested
    assert not lower_warm.has_m5_overlay
    assert not lower_off.m5_overlay_requested

    assert "NO DATA" in _panel_title(lower_warm)
    assert "overlay OFF" not in _panel_title(lower_warm)
    assert "overlay OFF" in _panel_title(lower_off)


def test_renders_when_channel_columns_are_all_null() -> None:
    """Warm-up data must degrade to a drawable image, not raise."""
    import sqlite3

    db = _fixture_db()
    out = tempfile.mktemp(suffix=".png")
    try:
        conn = sqlite3.connect(db)
        conn.execute(
            "UPDATE market_data SET best_fit_a_uoedt=NULL, "
            "best_fit_a_base_fl=NULL, best_fit_a_loedt=NULL"
        )
        conn.commit()
        conn.close()

        panels = load_market_data(db, overlays="best_fit_a", limit=50)
        render_combined(panels, out, overlays="best_fit_a")
        assert os.path.exists(out) and os.path.getsize(out) > 1000
    finally:
        os.remove(db)
        if os.path.exists(out):
            os.remove(out)


def test_newest_candle_is_drawn_as_still_forming() -> None:
    """The rightmost bar must be visibly distinct and labelled, not silent.

    MT5 exports include shift 0, so the newest row is always an incomplete
    candle. It is marked rather than dropped: dropping it would make the render
    a bar-period stale and stop it matching the trader's screen. Marking keeps
    parity while letting the image state its own caveat -- which is what stops
    a vision model reading a wick rejection off a bar that is still moving.
    """
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    from mtf_render.renderer import FORMING_BAR_LABEL, _draw_candles

    db = _fixture_db()
    try:
        panels = load_market_data(db, overlays="best_fit_a", limit=20)
    finally:
        os.remove(db)

    candles = panels["M5"].candles
    fig, ax = plt.subplots()
    try:
        _draw_candles(ax, candles)

        assert len(ax.patches) == len(candles)

        # Hollow: facecolor 'none' resolves to an RGBA with zero alpha.
        assert ax.patches[-1].get_facecolor()[3] == 0
        # Every earlier candle stays filled.
        assert all(p.get_facecolor()[3] > 0 for p in ax.patches[:-1])

        # And it says so in words, not only in styling.
        assert any(FORMING_BAR_LABEL in t.get_text() for t in ax.texts)
    finally:
        plt.close(fig)


def test_forming_mark_can_be_disabled() -> None:
    """`mark_forming=False` leaves every candle solid and unlabelled."""
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    from mtf_render.renderer import FORMING_BAR_LABEL, _draw_candles

    db = _fixture_db()
    try:
        panels = load_market_data(db, overlays="best_fit_a", limit=20)
    finally:
        os.remove(db)

    fig, ax = plt.subplots()
    try:
        _draw_candles(ax, panels["M5"].candles, mark_forming=False)
        assert all(p.get_facecolor()[3] > 0 for p in ax.patches)
        assert not any(FORMING_BAR_LABEL in t.get_text() for t in ax.texts)
    finally:
        plt.close(fig)


# --------------------------------------------------------------------------
# Rendering
# --------------------------------------------------------------------------


def test_render_writes_png_for_both_variants() -> None:
    db = _fixture_db()
    outs = [tempfile.mktemp(suffix=".png"), tempfile.mktemp(suffix=".png")]
    try:
        for out, flag in zip(outs, (True, False)):
            panels = load_market_data(
                db, overlays="best_fit_a", limit=100, m5_overlay=flag
            )
            render_combined(panels, out, overlays="best_fit_a")
            assert os.path.exists(out) and os.path.getsize(out) > 1000
    finally:
        os.remove(db)
        for out in outs:
            if os.path.exists(out):
                os.remove(out)


def test_render_handles_every_overlay() -> None:
    """Guards against a spec whose columns exist but cannot be drawn."""
    db = _fixture_db()
    out = tempfile.mktemp(suffix=".png")
    try:
        panels = load_market_data(db, overlays=",".join(OVERLAY_KEYS), limit=50)
        render_combined(panels, out, overlays=",".join(OVERLAY_KEYS))
        assert os.path.exists(out) and os.path.getsize(out) > 1000
    finally:
        os.remove(db)
        if os.path.exists(out):
            os.remove(out)


if __name__ == "__main__":
    import sys

    sys.exit(__import__("pytest").main([__file__, "-v"]))
