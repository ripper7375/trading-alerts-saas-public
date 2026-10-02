"""Tests for the chart stamp (rule 8, ADR-014): the stamp itself, the title it
draws, the slot-bounded read and the per-timeframe overlays that make it true.

Run: python -m pytest test_mtf_stamp.py   (or: python test_mtf_stamp.py)

The stamp is what lets a consumer recognise an image from another slot, so the
tests are about the ways it could quietly lie: a slot off the boundary, a variant
that is not the picture's, a last closed bar that is not slot - 300, a read that
includes a bar newer than the slot it claims, metadata that is not a string.
"""

from __future__ import annotations

import os
import sqlite3
import sys
import tempfile
from contextlib import contextmanager
from unittest import mock

from mtf_render import __main__ as cli
from mtf_render.data_source import load_market_data
from mtf_render.fixture import build_fixture_db
from mtf_render.renderer import render_combined
from mtf_render.stamp import (
    FORMING_NOTICE,
    METADATA_KEYS,
    RenderStamp,
    normalize_overlays,
    parse_metadata,
    utc_text,
)

SLOT = 1789764900  # 2026-09-18 20:55:00 UTC
RENDERED_AT = SLOT + 70


def stamp(**overrides) -> RenderStamp:
    values = dict(
        slot=SLOT,
        variant="overlay",
        overlay_m5="best_fit_a",
        overlay_m15="non_b",
        overlay_source="setting",
        rendered_at=RENDERED_AT,
    )
    values.update(overrides)
    return RenderStamp(**values)


def raises(exc_type, fn) -> bool:
    try:
        fn()
    except exc_type:
        return True
    return False


@contextmanager
def fixture_db():
    fd, db = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    build_fixture_db(db)
    try:
        yield db
    finally:
        try:
            os.remove(db)
        except OSError:
            pass  # Windows may still hold the file for a moment; the temp dir is cleaned anyway


def m5_times(db: str) -> list[int]:
    conn = sqlite3.connect(db)
    try:
        return [r[0] for r in conn.execute(
            "SELECT timestamp FROM market_data WHERE timeframe='M5' ORDER BY timestamp")]
    finally:
        conn.close()


# ------------------------------------------------------------------- the stamp


def test_last_closed_bar_is_the_slot_minus_one_bar() -> None:
    assert stamp().last_closed_bar == SLOT - 300
    # rule 2: a bar is closed when open time + period <= slot
    assert stamp().last_closed_bar + 300 <= stamp().slot
    assert (stamp().last_closed_bar + 300) + 300 > stamp().slot


def test_utc_text() -> None:
    assert utc_text(SLOT) == "2026-09-18 20:55 UTC"
    assert utc_text(SLOT - 300) == "2026-09-18 20:50 UTC"
    assert utc_text(0) == "1970-01-01 00:00 UTC"


def test_object_metadata_is_exactly_the_agreed_keys_all_strings() -> None:
    meta = stamp().object_metadata()
    assert set(meta) == set(METADATA_KEYS)
    assert list(METADATA_KEYS[:5]) == [
        "cycle-slot", "last-closed-bar", "overlay", "variant", "rendered-at"
    ]
    assert all(isinstance(k, str) and isinstance(v, str) for k, v in meta.items())
    assert meta == {
        "cycle-slot": str(SLOT),
        "last-closed-bar": str(SLOT - 300),
        "overlay": "best_fit_a",
        "variant": "overlay",
        "rendered-at": str(RENDERED_AT),
        "overlay-m15": "non_b",
        "overlay-source": "setting",
    }


def test_metadata_values_are_ascii_and_have_no_surrounding_whitespace() -> None:
    for value in stamp(overlay_m5=" best_fit_a , cherry_a ").object_metadata().values():
        assert value.isascii() and value == value.strip()


def test_overlay_lists_are_normalised_once_for_metadata_and_title() -> None:
    s = stamp(overlay_m5=" cherry_a , resistance ,support", overlay_m15="cherry_a,resistance,support")
    assert s.overlay_m5 == "cherry_a,resistance,support"
    assert normalize_overlays(["a", " b "]) == "a,b"
    assert raises(ValueError, lambda: normalize_overlays(" , "))
    assert raises(ValueError, lambda: normalize_overlays(""))


def test_a_slot_that_is_not_a_slot_is_refused() -> None:
    for bad in (SLOT + 1, SLOT + 299, -300, 1, SLOT + 0.5):
        assert raises(ValueError, lambda bad=bad: stamp(slot=bad)), bad
    assert raises(ValueError, lambda: stamp(slot=True))  # a bool is an int in Python
    assert raises(ValueError, lambda: stamp(slot="1789764900"))
    assert stamp(slot=0).slot == 0
    assert stamp(slot=SLOT + 300).last_closed_bar == SLOT


def test_a_boolean_is_not_a_time() -> None:
    # bool is an int in Python: True would otherwise pass as 1 second
    assert raises(ValueError, lambda: stamp(rendered_at=True))
    assert raises(ValueError, lambda: stamp(rendered_at=False))
    assert raises(ValueError, lambda: stamp(slot=True))
    assert raises(ValueError, lambda: stamp(slot=False))
    assert raises(ValueError, lambda: stamp(rendered_at=12.5))


def test_the_other_fields_are_validated() -> None:
    assert raises(ValueError, lambda: stamp(variant="both"))
    assert raises(ValueError, lambda: stamp(variant=""))
    assert raises(ValueError, lambda: stamp(overlay_source="gateway"))
    assert raises(ValueError, lambda: stamp(rendered_at="now"))
    assert raises(ValueError, lambda: stamp(rendered_at=1.5))
    assert raises(ValueError, lambda: stamp(overlay_m5=""))
    assert raises(ValueError, lambda: stamp(overlay_m15="  "))
    assert raises(ValueError, lambda: stamp(overlay_m5="best_fit_ä"))  # S3 metadata is ASCII


def test_the_stamp_is_immutable() -> None:
    s = stamp()
    try:
        s.slot = SLOT + 300  # type: ignore[misc]
    except Exception:
        return
    raise AssertionError("a stamp must not be changeable after it is made")


def test_parse_metadata_round_trips() -> None:
    for variant in ("overlay", "standard"):
        for source in ("setting", "default"):
            s = stamp(variant=variant, overlay_source=source)
            assert parse_metadata(s.object_metadata()) == s


def test_parse_metadata_rejects_anything_that_is_not_a_stamp() -> None:
    good = stamp().object_metadata()
    assert parse_metadata({}) is None
    for key in ("cycle-slot", "last-closed-bar", "overlay", "variant", "rendered-at"):
        broken = dict(good)
        del broken[key]
        assert parse_metadata(broken) is None, key
    for key, bad in (
        ("cycle-slot", "abc"),
        ("cycle-slot", str(SLOT + 1)),  # not on a boundary
        ("last-closed-bar", str(SLOT)),  # not slot - 300
        ("variant", "both"),
        ("rendered-at", "x"),
        ("overlay", ""),
    ):
        broken = dict(good)
        broken[key] = bad
        assert parse_metadata(broken) is None, (key, bad)


def test_parse_metadata_defaults_for_a_stamp_written_by_an_older_renderer() -> None:
    meta = {k: v for k, v in stamp().object_metadata().items() if k not in ("overlay-m15", "overlay-source")}
    parsed = parse_metadata(meta)
    assert parsed is not None
    assert parsed.overlay_m15 == parsed.overlay_m5
    assert parsed.overlay_source == "default"


# ------------------------------------------------------------------- the title


def test_title_states_everything_a_reader_needs() -> None:
    title = stamp().title(newest_m5_bar=SLOT)
    for expected in (
        f"cycle slot {SLOT}",
        "2026-09-18 20:55 UTC",
        f"last closed bar {SLOT - 300}",
        "2026-09-18 20:50 UTC",
        "M5 best_fit_a",
        "M15 non_b",
        "variant: overlay",
        "rendered 2026-09-18 20:56 UTC",
        FORMING_NOTICE,
        "STILL FORMING",
    ):
        assert expected in title, expected
    assert title.count("\n") == 3  # four lines: identity, slot and bar, overlay, the notice


def test_title_names_the_variant_of_the_picture() -> None:
    assert "variant: standard" in stamp(variant="standard").title()
    assert "variant: overlay" in stamp(variant="overlay").title()


def test_title_says_when_the_setting_was_not_used() -> None:
    assert "(default, setting unavailable)" in stamp(overlay_source="default").title()
    assert "(default, setting unavailable)" not in stamp(overlay_source="setting").title()


def test_title_shows_one_indicator_once_when_both_timeframes_use_it() -> None:
    title = stamp(overlay_m5="best_fit_a", overlay_m15="best_fit_a").title()
    assert "overlay: M5 best_fit_a" in title
    assert "M15 best_fit_a" not in title
    assert "M15 non_b" in stamp().title()


def test_title_states_the_newest_candle_drawn_as_a_fact() -> None:
    assert f"newest M5 candle opened {utc_text(SLOT)}" in stamp().title(newest_m5_bar=SLOT)
    assert f"newest M5 candle opened {utc_text(SLOT - 300)}" in stamp().title(newest_m5_bar=SLOT - 300)
    assert "newest M5 candle" not in stamp().title()


# ------------------------------------------ the picture is as of the slot it says


def test_load_market_data_without_a_slot_reads_the_newest_rows_as_before() -> None:
    with fixture_db() as db:
        times = m5_times(db)
        panels = load_market_data(db, overlays="best_fit_a", limit=20)
        assert int(panels["M5"].candles["timestamp"].iloc[-1]) == times[-1]


def test_load_market_data_as_of_a_slot_reads_no_bar_opened_after_it() -> None:
    with fixture_db() as db:
        times = m5_times(db)
        slot = times[-6]  # five bars before the newest
        assert slot % 300 == 0
        panels = load_market_data(db, overlays="best_fit_a", limit=20, as_of_slot=slot)
        m5 = panels["M5"].candles["timestamp"]
        m15 = panels["M15"].candles["timestamp"]
        assert int(m5.iloc[-1]) == slot  # the bar that opens AT the slot is in (it is the forming one)
        assert int(m5.max()) <= slot and int(m15.max()) <= slot
        assert len(m5) == 20


def test_as_of_a_slot_is_inclusive_and_exact() -> None:
    with fixture_db() as db:
        times = m5_times(db)
        slot = times[40]
        panels = load_market_data(db, overlays="best_fit_a", limit=500, as_of_slot=slot)
        assert [int(t) for t in panels["M5"].candles["timestamp"]] == [t for t in times if t <= slot]
        before = load_market_data(db, overlays="best_fit_a", limit=500, as_of_slot=slot - 1)
        assert int(before["M5"].candles["timestamp"].max()) == times[39]


def test_the_m15_panel_is_bounded_by_the_slot_too() -> None:
    with fixture_db() as db:
        times = m5_times(db)
        slot = times[50]
        panels = load_market_data(db, overlays="best_fit_a", limit=500, as_of_slot=slot)
        assert int(panels["M15"].candles["timestamp"].max()) <= slot


def test_the_m15_panel_is_bounded_by_the_slot_even_when_m5_has_no_bar_yet() -> None:
    # No M5 window to constrain M15 to: the slot is then the only thing that does
    with fixture_db() as db:
        slot = m5_times(db)[50]
        conn = sqlite3.connect(db)
        try:
            conn.execute("DELETE FROM market_data WHERE timeframe='M5' AND timestamp <= ?", (slot,))
            conn.commit()
        finally:
            conn.close()
        panels = load_market_data(db, overlays="best_fit_a", limit=20, as_of_slot=slot)
        assert len(panels["M5"].candles) == 0
        m15 = panels["M15"].candles["timestamp"]
        assert len(m15) > 0 and int(m15.max()) <= slot


# ------------------------------------------------- one indicator per timeframe


def keys(overlays) -> list[str]:
    return [o.spec.key for o in overlays]


def test_each_timeframe_can_carry_its_own_indicator() -> None:
    with fixture_db() as db:
        panels = load_market_data(
            db, overlays="best_fit_a", limit=20, m5_overlay=True, m15_overlays="non_b"
        )
        assert keys(panels["M5"].own_overlays) == ["best_fit_a"]
        assert keys(panels["M15"].own_overlays) == ["non_b"]
        # the M5 channel overlaid on M15 is the M5 indicator, not the M15 one
        assert keys(panels["M15"].m5_overlays) == ["best_fit_a"]


def test_standard_variant_carries_no_m5_overlay_whatever_the_indicators() -> None:
    with fixture_db() as db:
        panels = load_market_data(
            db, overlays="best_fit_a", limit=20, m5_overlay=False, m15_overlays="non_b"
        )
        assert panels["M15"].m5_overlays == ()
        assert keys(panels["M15"].own_overlays) == ["non_b"]


def test_without_m15_overlays_both_timeframes_use_the_same_set_as_before() -> None:
    with fixture_db() as db:
        panels = load_market_data(db, overlays="cherry_a,resistance", limit=20)
        assert keys(panels["M5"].own_overlays) == ["cherry_a", "resistance"]
        assert keys(panels["M15"].own_overlays) == ["cherry_a", "resistance"]


def test_an_unknown_m15_indicator_is_refused() -> None:
    with fixture_db() as db:
        assert raises(ValueError, lambda: load_market_data(db, overlays="best_fit_a", m15_overlays="nope"))


# ------------------------------------------------------- the stamped rendering


class _TitleSpy:
    """Records every suptitle text without touching matplotlib's behaviour."""

    def __init__(self) -> None:
        self.texts: list[str] = []

    def install(self):
        import matplotlib.figure as figure

        original = figure.Figure.suptitle
        spy = self

        def recording(fig, t, **kwargs):
            spy.texts.append(t)
            return original(fig, t, **kwargs)

        return mock.patch.object(figure.Figure, "suptitle", recording)


def render(panels, stamp_value=None):
    fd, out = tempfile.mkstemp(suffix=".png")
    os.close(fd)
    try:
        spy = _TitleSpy()
        with spy.install():
            render_combined(panels, out, overlays="best_fit_a", stamp=stamp_value)
        with open(out, "rb") as fh:
            data = fh.read()
        return spy.texts[-1], data
    finally:
        os.remove(out)


def test_a_stamped_render_draws_the_stamp_as_the_title() -> None:
    with fixture_db() as db:
        slot = m5_times(db)[-3]
        panels = load_market_data(db, overlays="best_fit_a", limit=30, as_of_slot=slot, m15_overlays="non_b")
        s = stamp(slot=slot, rendered_at=slot + 70)
        title, png = render(panels, s)
        assert title == s.title(newest_m5_bar=slot)
        assert f"cycle slot {slot}" in title and "variant: overlay" in title
        assert png.startswith(b"\x89PNG\r\n\x1a\n") and png.endswith(b"IEND\xaeB`\x82")


def test_the_title_states_the_newest_candle_actually_drawn() -> None:
    with fixture_db() as db:
        times = m5_times(db)
        slot = times[-3]
        panels = load_market_data(db, overlays="best_fit_a", limit=30, as_of_slot=slot)
        title, _ = render(panels, stamp(slot=slot, overlay_m15="best_fit_a"))
        assert f"newest M5 candle opened {utc_text(slot)}" in title


def test_a_stamp_that_disagrees_with_the_picture_is_refused() -> None:
    with fixture_db() as db:
        slot = m5_times(db)[-3]
        overlay_panels = load_market_data(db, overlays="best_fit_a", limit=30, m5_overlay=True, as_of_slot=slot)
        standard_panels = load_market_data(db, overlays="best_fit_a", limit=30, m5_overlay=False, as_of_slot=slot)
        assert raises(ValueError, lambda: render(overlay_panels, stamp(slot=slot, variant="standard")))
        assert raises(ValueError, lambda: render(standard_panels, stamp(slot=slot, variant="overlay")))
        # and the honest ones render
        render(overlay_panels, stamp(slot=slot, variant="overlay"))
        render(standard_panels, stamp(slot=slot, variant="standard"))


def test_an_unstamped_render_keeps_the_title_it_always_had() -> None:
    with fixture_db() as db:
        panels = load_market_data(db, overlays="best_fit_a", limit=30)
        title, _ = render(panels, None)
        assert "overlays: best_fit_a" in title
        assert "variant: overlay" in title and "rendered " in title
        assert "STILL FORMING" in title
        assert "cycle slot" not in title


# --------------------------------------------------------------------- the CLI


def run_cli(argv: list[str]) -> list[str]:
    titles: list[str] = []
    spy = _TitleSpy()
    with spy.install():
        code = cli.main(argv)
    assert code == 0
    titles.extend(spy.texts)
    return titles


def test_cli_stamps_both_variants_from_one_slot() -> None:
    with fixture_db() as db, tempfile.TemporaryDirectory() as out_dir:
        slot = m5_times(db)[-4]
        titles = run_cli([
            "--db", db, "--both-variants", "--out", os.path.join(out_dir, "chart.png"),
            "--slot", str(slot), "--m5-overlays", "best_fit_a", "--m15-overlays", "non_b",
            "--overlay-source", "setting", "--rendered-at", str(slot + 70), "--limit", "30",
        ])
        assert len(titles) == 2
        assert "variant: overlay" in titles[0] and "variant: standard" in titles[1]
        for title in titles:
            assert f"cycle slot {slot}" in title
            assert f"last closed bar {slot - 300}" in title
            assert "M5 best_fit_a, M15 non_b" in title
            assert f"rendered {utc_text(slot + 70)}" in title
            # the picture is AS OF the slot: its newest candle is the one that opens at it
            assert f"newest M5 candle opened {utc_text(slot)}" in title
            # and the source given is the source stamped
            assert "(default, setting unavailable)" not in title
        assert sorted(os.listdir(out_dir)) == ["chart_overlay.png", "chart_standard.png"]


def test_cli_without_an_overlay_source_stamps_the_default() -> None:
    with fixture_db() as db, tempfile.TemporaryDirectory() as out_dir:
        slot = m5_times(db)[-4]
        titles = run_cli([
            "--db", db, "--both-variants", "--out", os.path.join(out_dir, "chart.png"),
            "--slot", str(slot), "--rendered-at", str(slot + 70), "--limit", "30",
        ])
        assert len(titles) == 2
        assert all("(default, setting unavailable)" in t for t in titles)


def test_cli_without_a_slot_is_unchanged() -> None:
    with fixture_db() as db, tempfile.TemporaryDirectory() as out_dir:
        titles = run_cli(["--db", db, "--both-variants", "--out", os.path.join(out_dir, "c.png"), "--limit", "30"])
        assert all("cycle slot" not in t for t in titles)


def test_cli_refuses_stamping_options_without_a_slot() -> None:
    with fixture_db() as db, tempfile.TemporaryDirectory() as out_dir:
        out = os.path.join(out_dir, "c.png")
        for extra in (["--overlay-source", "setting"], ["--rendered-at", "5"]):
            try:
                cli.main(["--db", db, "--out", out, *extra])
            except SystemExit as exc:
                assert exc.code != 0
            else:
                raise AssertionError(f"{extra} without --slot must be refused")
        assert os.listdir(out_dir) == []


def test_cli_refuses_a_bad_slot_or_indicator_before_drawing_anything() -> None:
    with fixture_db() as db, tempfile.TemporaryDirectory() as out_dir:
        out = os.path.join(out_dir, "c.png")
        assert raises(ValueError, lambda: cli.main(["--db", db, "--out", out, "--slot", str(SLOT + 1)]))
        assert raises(ValueError, lambda: cli.main(["--db", db, "--out", out, "--slot", str(SLOT), "--m15-overlays", "nope"]))
        assert raises(ValueError, lambda: cli.main(["--db", db, "--out", out, "--slot", str(SLOT), "--m5-overlays", "nope"]))
        assert os.listdir(out_dir) == []


def test_cli_single_variant_stamp_matches_its_flag() -> None:
    with fixture_db() as db, tempfile.TemporaryDirectory() as out_dir:
        slot = m5_times(db)[-4]
        base = ["--db", db, "--slot", str(slot), "--limit", "30", "--rendered-at", str(slot + 70)]
        overlay_title = run_cli([*base, "--out", os.path.join(out_dir, "a.png"), "--m5-overlay"])[0]
        standard_title = run_cli([*base, "--out", os.path.join(out_dir, "b.png"), "--no-m5-overlay"])[0]
        assert "variant: overlay" in overlay_title
        assert "variant: standard" in standard_title
        # a single image is also drawn as of its slot
        for title in (overlay_title, standard_title):
            assert f"newest M5 candle opened {utc_text(slot)}" in title


if __name__ == "__main__":
    failures = 0
    names = [n for n in sorted(globals()) if n.startswith("test_")]
    for name in names:
        try:
            globals()[name]()
            print(f"PASS {name}")
        except Exception as exc:  # noqa: BLE001
            failures += 1
            print(f"FAIL {name}: {exc!r}")
    print(f"\n{len(names) - failures} passed, {failures} failed")
    sys.exit(1 if failures else 0)
