"""Unit tests for MCD2 2.0.1 (standard section 12: T1 to T13; T14 is for derived MCDs only).

Run from ``davintrade-stack-d-and-e/engine-1-5-new/``::

    python -m unittest discover -s mcd2

Real-data tests read the stored fixtures (``fixtures/<slot>.inputs.json``), never a workbook. Only the
provenance tests open the replica workbooks, and they skip when a workbook is missing. The fixtures are
written by ``write_fixtures()`` below::

    python -c "import sys; sys.path.insert(0, 'mcd2'); import test_mcd2_unit_tests as t; t.write_fixtures()"

The 13 pre-retrofit scenarios are kept as cases: legacy 01 and 02 are ``RealCycleTests``, 03 to 09 are
``StateTests``, 10 to 13 are ``LegacyFailureCases`` (see the method names and the manifest).
"""

from __future__ import annotations

import ast
import dataclasses
import hashlib
import json
import logging
import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
ENGINE = HERE.parent
STACK = ENGINE.parent
for _path in (str(ENGINE), str(HERE)):
    if _path not in sys.path:
        sys.path.insert(0, _path)

import yaml  # noqa: E402

import mcd2_evaluator as ev  # noqa: E402
from mcd_common import excel_fixture_provider as provider  # noqa: E402
from mcd_common import testing as shared  # noqa: E402
from mcd_common import wording  # noqa: E402
from mcd_common.cycle_inputs import (  # noqa: E402
    CycleInputs,
    Params,
    channel_columns,
    slot_to_epoch,
    stats_slot_for,
    statistics_source,
    thaw,
)
from mcd_common.envelope import canonical_json, schema_errors  # noqa: E402

# The evaluator logs the exception behind EVALUATOR_ERROR; keep the test output quiet.
logging.getLogger("mcd").addHandler(logging.NullHandler())

FIXTURES = HERE / "fixtures"
PARAMS = Params.from_yaml(str(HERE / "mcd2_params.yaml"))
REGISTRY = yaml.safe_load((HERE / "mcd2_registry.yaml").read_text(encoding="utf-8"))

SLOTS = {"v1": "2026-09-18T20:55Z", "v4": "2026-09-28T23:15Z"}
SETTINGS = {name: ENGINE / "mcd_common" / "fixtures" / f"settings_{name}.yaml" for name in SLOTS}
WORKBOOKS = {"v1": ENGINE / "market_data_v6_replicated.xlsx", "v4": STACK / "market_data_v6_replicated_v4.xlsx"}


def _columns(centroid: str) -> tuple[str, ...]:
    return ("close", *channel_columns(centroid).values(), *channel_columns("fractal").values())


FIXTURE_COLUMNS = {"v1": _columns("best_fit_a"), "v4": _columns("cherry_a")}
FIXTURE_BARS = {"M5": 288, "M15": 1}  # N_window never exceeds 288; MCD2 reads no M15 bar

# --------------------------------------------------------------------------- fixtures


def fresh_bundle(name: str):
    """The bundle the kit's provider builds from the frozen workbook (settings from the kit's settings file)."""
    return provider.build_cycle_inputs_with_report(
        WORKBOOKS[name], SETTINGS[name], columns=FIXTURE_COLUMNS[name], max_bars=FIXTURE_BARS
    )


def write_fixtures() -> None:
    """Write ``fixtures/<slot>.{inputs,envelope}.json``, ``<slot>.source.md`` and ``mcd2_output.json``."""
    for name in SLOTS:
        inputs, report = fresh_bundle(name)
        envelope = ev.evaluate(inputs, PARAMS, {})
        provider.write_fixture_files(FIXTURES, inputs, report, envelope, base_dir=ENGINE)
        if name == "v1":
            (HERE / "mcd2_output.json").write_text(canonical_json(envelope, pretty=True), encoding="utf-8", newline="\n")


def stored_inputs(name: str) -> CycleInputs:
    return provider.load_inputs(FIXTURES / f"{provider.slot_file_stem(SLOTS[name])}.inputs.json")


def with_indicator(inputs: CycleInputs, indicator: str) -> CycleInputs:
    return dataclasses.replace(inputs, active_indicator={**thaw(inputs.active_indicator), "M5": indicator})


# --------------------------------------------------------------------------- synthetic bundles

SLOT = "2026-09-18T20:55Z"
LAST_OPEN = slot_to_epoch(SLOT) - 300  # the last closed M5 bar opens at 20:50
DROP = object()  # remove a field


def synth(
    *,
    indicator: str = "best_fit_a",
    angle: float = 7.5,
    metric: float = 4010.0,
    upper: float = 4050.0,
    lower: float = 3950.0,
    baseline: float = 4000.0,
    containment: float = 60.0,
    t_edt: int = 755,
    bars: int = 300,
) -> CycleInputs:
    """A valid M5 bundle for slot 20:55: ``bars`` closed bars, the channel ``lower``..``upper``, the metric on
    the last bar (SSA for a centroid indicator, Close for the fractal)."""
    cols = channel_columns(indicator)
    fractal = indicator == "fractal"
    rows = []
    for i in range(bars):
        row = {
            "timestamp": LAST_OPEN - (bars - 1 - i) * 300,
            "close": 4005.0,
            cols["upper"]: upper,
            cols["lower"]: lower,
            cols["baseline"]: baseline,
        }
        if not fractal:
            row[cols["fit"]] = 4000.5
        rows.append(row)
    rows[-1]["close" if fractal else cols["fit"]] = metric
    source = statistics_source(indicator)
    stats_row = {
        "timeframe": "M5",
        "source": source,
        "captured_at": slot_to_epoch(stats_slot_for(SLOT, "M5")),
        "regression_angle": angle,
        "containment_rate": containment,
        "containment_n": t_edt,
        "channel_width": upper - lower,
    }
    return CycleInputs(
        symbol="XAUUSD",
        cycle_slot=SLOT,
        data_status="FRESH",
        retuning=False,
        bars={"M5": rows},
        statistics={("M5", source): stats_row},
        stats_slot={"M5": stats_slot_for(SLOT, "M5"), "M15": stats_slot_for(SLOT, "M15")},
        active_indicator={"M5": indicator},
        config_hash={source: "abc123"},
        channel_mode={source: "dynamic"},
    )


def with_stat(inputs: CycleInputs, **changes) -> CycleInputs:
    stats = thaw(dict(inputs.statistics))
    key = ("M5", statistics_source(inputs.active_indicator["M5"]))
    row = dict(stats[key])
    for name, value in changes.items():
        if value is DROP:
            row.pop(name, None)
        else:
            row[name] = value
    stats[key] = row
    return dataclasses.replace(inputs, statistics=stats)


def with_bars(inputs: CycleInputs, edit) -> CycleInputs:
    bars = thaw(inputs.bars)
    edit(bars["M5"])
    return dataclasses.replace(inputs, bars=bars)


def with_params(**changes) -> Params:
    return dataclasses.replace(PARAMS, values={**PARAMS.values, **changes})


def with_channel_rows(inputs: CycleInputs, t_edt: int) -> CycleInputs:
    """A real-shaped short channel (task P7): ``containment_n`` is ``t_edt`` and the active indicator's channel columns
    exist only on the newest ``t_edt - 1`` closed bars (the last of the ``t_edt`` rows is the still-open bar), null
    before. Every real channel in the replicas has this shape."""
    columns = set(channel_columns(inputs.active_indicator["M5"]).values())
    keep = max(t_edt - 1, 0)

    def edit(bars):
        for bar in bars[: max(len(bars) - keep, 0)]:
            for column in columns:
                bar[column] = None

    return with_stat(with_bars(inputs, edit), containment_n=t_edt)


def run(inputs: CycleInputs, params: Params = PARAMS) -> dict:
    return ev.evaluate(inputs, params, {})


# --------------------------------------------------------------------------- the register (T1 setup, A10, A11)


class RegisterTests(unittest.TestCase):
    def test_the_evaluator_register_equals_the_registry_file(self):
        states = {s["code"]: s for s in REGISTRY["states"]}
        self.assertEqual(set(states), set(ev.STATES))
        for code, (bias, regime, summary, template_id) in ev.STATES.items():
            entry = states[code]
            self.assertEqual(
                (entry["bias"], entry["regime_status"], entry["summary"], entry["commentary"]),
                (bias, regime, summary, template_id),
                code,
            )
            self.assertEqual(entry["levels"], ["UOEDT", "baseline", "LOEDT"], code)
        self.assertEqual(dict(ev.TEMPLATES), REGISTRY["commentary_templates"])

    def test_the_register_is_exhaustive_and_exclusive_and_bias_follows_d6(self):
        expected = {
            f"MCD2_{trend}_{corridor}"
            for trend in ("UP", "DOWN", "SIDEWAYS")
            for corridor in ("IN_CORRIDOR", "UPPER_BREAKOUT", "LOWER_BREAKDOWN")
        }
        self.assertEqual(set(ev.STATES), expected)
        self.assertEqual(len(REGISTRY["states"]), 9)
        for code, (bias, *_rest) in ev.STATES.items():
            want = "LONG" if "_UP_" in code else "SHORT" if "_DOWN_" in code else "NEUTRAL"
            self.assertEqual(bias, want, code)

    def test_regime_words_follow_d5(self):
        words = {regime for (_b, regime, _s, _t) in ev.STATES.values()}
        self.assertIn("UPTREND_DIP_BELOW_CORRIDOR", words)
        self.assertIn("DOWNTREND_RALLY_ABOVE_CORRIDOR", words)
        self.assertEqual(len(words), 8)
        source = (HERE / "mcd2_evaluator.py").read_text(encoding="utf-8")
        for old in ("DIP_VALUE_BUY_OPPORTUNITY", "RALLY_VALUE_SELL_OPPORTUNITY"):
            self.assertNotIn(old, source)
            self.assertNotIn(old, yaml.safe_dump(REGISTRY))

    def test_registry_and_params_describe_this_evaluator(self):
        self.assertEqual(REGISTRY["mcd_id"], ev.MCD_ID)
        self.assertEqual(REGISTRY["evaluator_version"], ev.EVALUATOR_VERSION)
        self.assertEqual((PARAMS.mcd_id, PARAMS.evaluator_version), (ev.MCD_ID, ev.EVALUATOR_VERSION))
        self.assertEqual(REGISTRY["kind"], "independent")
        self.assertEqual(REGISTRY["depends_on"], [])
        self.assertEqual(REGISTRY["uses_channel"], ["M5"])
        self.assertEqual(REGISTRY["rung"], {"DAY_TRADER": "trendlines_channels", "SCALPER": "primary_structure"})
        self.assertEqual(REGISTRY["flag"], "off")
        self.assertEqual(
            set(PARAMS.values),
            {
                "sideways_angle_deg",
                "min_containment_rate",
                "min_window_bars",
                "max_window_bars",
                "t_edt_open_bar_rows",
                "max_abs_regression_angle_deg",
                "channel_position_decimals",
            },
        )

    def test_a_sweep_reaches_every_state_and_agrees_with_an_independent_classifier(self):
        reached = set()
        for angle in (-80.0, -12.5, -5.01, -5.0, 0.0, 5.0, 5.01, 12.5, 80.0):
            for metric in (3900.0, 3949.99, 3950.0, 4000.0, 4050.0, 4050.01, 4100.0):
                out = run(synth(angle=angle, metric=metric))
                trend = "UP" if angle > 5 else "DOWN" if angle < -5 else "SIDEWAYS"
                corridor = "UPPER_BREAKOUT" if metric > 4050 else "LOWER_BREAKDOWN" if metric < 3950 else "IN_CORRIDOR"
                self.assertEqual(out["state_code"], f"MCD2_{trend}_{corridor}", (angle, metric))
                reached.add(out["state_code"])
        self.assertEqual(reached, set(ev.STATES))


# --------------------------------------------------------------------------- T1: one test per state

AT = dict(upper=4050.0, lower=3950.0)  # standard synthetic channel; inside 4010, above 4062.5, below 3941.25


class StateTests(unittest.TestCase):
    """T1. Nine states, each from a synthetic bundle. Legacy scenarios 03 to 09 use the legacy numbers in
    ``LegacyFailureCases``-style cases below; here the numbers are the standard synthetic channel."""

    def assert_state(self, *, angle, metric, state, regime, bias, reversion, commentary, position):
        out = run(synth(angle=angle, metric=metric, **AT))
        self.assertEqual(out["status"], "VALID", out["status_reasons"])
        self.assertEqual(out["state_code"], state)
        self.assertEqual(out["regime_status"], regime)
        self.assertEqual(out["bias"], bias)
        self.assertEqual(out["details"]["reversion_setup"], reversion)
        self.assertEqual(out["details"]["channel_position"], position)
        self.assertEqual(out["commentary"], commentary)
        self.assertEqual(out["summary_line"], ev.STATES[state][2])
        self.assertEqual(out["depends_on"], [])
        self.assertEqual(
            [(lv["name"], lv["tf"], lv["price"], lv["role"]) for lv in out["levels"]],
            [("UOEDT", "M5", 4050.0, "resistance"), ("baseline", "M5", 4000.0, "mid"), ("LOEDT", "M5", 3950.0, "support")],
        )
        self.assertEqual(schema_errors(out), [])

    def test_01_up_in_corridor(self):
        self.assert_state(angle=7.5, metric=4010.0, state="MCD2_UP_IN_CORRIDOR", regime="TREND_ALIGNED_CONTINUATION",
                          bias="LONG", reversion=False, position=0.6,
                          commentary="The M5 SSA is inside the corridor, between LOEDT 3950.00 and UOEDT 4050.00 (channel position 0.6000), while the channel slopes up (+7.50°).")

    def test_02_up_upper_breakout(self):
        self.assert_state(angle=7.5, metric=4062.5, state="MCD2_UP_UPPER_BREAKOUT", regime="UPPER_OVEREXTENSION_REVERSION",
                          bias="LONG", reversion=True, position=1.125,
                          commentary="The M5 SSA is 12.50 above UOEDT 4050.00 while the channel slopes up (+7.50°).")

    def test_03_up_lower_breakdown(self):
        self.assert_state(angle=7.5, metric=3941.25, state="MCD2_UP_LOWER_BREAKDOWN", regime="UPTREND_DIP_BELOW_CORRIDOR",
                          bias="LONG", reversion=True, position=-0.0875,
                          commentary="The M5 SSA is 8.75 below LOEDT 3950.00 while the channel slopes up (+7.50°).")

    def test_04_down_in_corridor(self):
        self.assert_state(angle=-12.5, metric=4010.0, state="MCD2_DOWN_IN_CORRIDOR", regime="TREND_ALIGNED_CONTINUATION",
                          bias="SHORT", reversion=False, position=0.6,
                          commentary="The M5 SSA is inside the corridor, between LOEDT 3950.00 and UOEDT 4050.00 (channel position 0.6000), while the channel slopes down (-12.50°).")

    def test_05_down_lower_breakdown(self):
        self.assert_state(angle=-12.5, metric=3941.25, state="MCD2_DOWN_LOWER_BREAKDOWN", regime="LOWER_OVEREXTENSION_REVERSION",
                          bias="SHORT", reversion=True, position=-0.0875,
                          commentary="The M5 SSA is 8.75 below LOEDT 3950.00 while the channel slopes down (-12.50°).")

    def test_06_down_upper_breakout(self):
        self.assert_state(angle=-12.5, metric=4062.5, state="MCD2_DOWN_UPPER_BREAKOUT", regime="DOWNTREND_RALLY_ABOVE_CORRIDOR",
                          bias="SHORT", reversion=True, position=1.125,
                          commentary="The M5 SSA is 12.50 above UOEDT 4050.00 while the channel slopes down (-12.50°).")

    def test_07_sideways_in_corridor(self):
        self.assert_state(angle=2.1, metric=4010.0, state="MCD2_SIDEWAYS_IN_CORRIDOR", regime="RANGE_EQUILIBRIUM",
                          bias="NEUTRAL", reversion=False, position=0.6,
                          commentary="The M5 SSA is inside the corridor, between LOEDT 3950.00 and UOEDT 4050.00 (channel position 0.6000), while the channel is flat (+2.10°).")

    def test_08_sideways_upper_breakout(self):
        self.assert_state(angle=2.1, metric=4062.5, state="MCD2_SIDEWAYS_UPPER_BREAKOUT", regime="RANGE_RESISTANCE_REVERSION",
                          bias="NEUTRAL", reversion=True, position=1.125,
                          commentary="The M5 SSA is 12.50 above UOEDT 4050.00 while the channel is flat (+2.10°).")

    def test_09_sideways_lower_breakdown(self):
        self.assert_state(angle=2.1, metric=3941.25, state="MCD2_SIDEWAYS_LOWER_BREAKDOWN", regime="RANGE_SUPPORT_REVERSION",
                          bias="NEUTRAL", reversion=True, position=-0.0875,
                          commentary="The M5 SSA is 8.75 below LOEDT 3950.00 while the channel is flat (+2.10°).")


class MetricTests(unittest.TestCase):
    """The metric is the SSA for the seven centroid indicators and the Close for the fractal EDT (Q1)."""

    def test_a_centroid_reads_the_ssa_not_the_close(self):
        inside_ssa = with_bars(synth(), lambda bars: bars[-1].update({"close": 4500.0}))
        self.assertEqual(run(inside_ssa)["state_code"], "MCD2_UP_IN_CORRIDOR")
        outside_ssa = with_bars(synth(metric=4062.5), lambda bars: bars[-1].update({"close": 4000.0}))
        self.assertEqual(run(outside_ssa)["state_code"], "MCD2_UP_UPPER_BREAKOUT")

    def test_the_fractal_reads_the_close_and_its_statistics_source_is_fractal_edt(self):
        out = run(synth(indicator="fractal", metric=4062.5))
        self.assertEqual(out["state_code"], "MCD2_UP_UPPER_BREAKOUT")
        self.assertEqual(out["commentary"], "The M5 Close is 12.50 above UOEDT 4050.00 while the channel slopes up (+7.50°).")
        self.assertEqual(out["active_indicator"], {"M5": "fractal"})
        self.assertEqual(out["config_hash"], {"fractal_edt": "abc123"})
        self.assertEqual([lv["price"] for lv in out["levels"]], [4050.0, 4000.0, 3950.0])

    def test_every_candidate_can_be_the_active_indicator(self):
        for indicator in ("best_fit_a", "best_fit_b", "cherry_a", "cherry_b", "most_recent", "non_a", "non_b", "fractal"):
            with self.subTest(indicator=indicator):
                out = run(synth(indicator=indicator))
                self.assertEqual((out["status"], out["state_code"]), ("VALID", "MCD2_UP_IN_CORRIDOR"))


# --------------------------------------------------------------------------- T2: boundaries


class BoundaryTests(unittest.TestCase):
    def test_the_trend_band_edges_are_sideways_and_just_beyond_is_a_trend(self):
        for angle, trend in ((-5.01, "DOWN"), (-5.0, "SIDEWAYS"), (-4.99, "SIDEWAYS"), (0.0, "SIDEWAYS"),
                             (4.99, "SIDEWAYS"), (5.0, "SIDEWAYS"), (5.0000001, "UP"), (5.01, "UP")):
            with self.subTest(angle=angle):
                self.assertEqual(run(synth(angle=angle))["details"]["trend_direction"], trend)

    def test_the_corridor_edges_are_inside_and_just_beyond_is_outside(self):
        for metric, corridor in ((3949.99, "LOWER_BREAKDOWN"), (3950.0, "IN_CORRIDOR"), (4050.0, "IN_CORRIDOR"), (4050.01, "UPPER_BREAKOUT")):
            with self.subTest(metric=metric):
                self.assertTrue(run(synth(metric=metric))["state_code"].endswith(corridor))

    def test_the_state_follows_the_prices_not_the_rounded_channel_position(self):
        above = run(synth(metric=4050.000004))  # CP 1.00000004 rounds to 1.0000
        self.assertEqual(above["state_code"], "MCD2_UP_UPPER_BREAKOUT")
        self.assertEqual(above["details"]["channel_position"], 1.0)
        below = run(synth(metric=3949.999996))
        self.assertEqual(below["state_code"], "MCD2_UP_LOWER_BREAKDOWN")
        self.assertEqual(below["details"]["channel_position"], 0.0)

    def test_containment_49_99_fails_50_and_50_01_pass(self):
        out = run(synth(containment=49.99))
        self.assertEqual((out["status"], out["status_reasons"]), ("INVALID", ["CONTAINMENT_LOW"]))
        for rate in (50.0, 50.01):
            with self.subTest(rate=rate):
                self.assertEqual(run(synth(containment=rate))["status"], "VALID")

    def test_the_window_is_the_channel_length_between_48_and_288_bars(self):
        # The channel has T_EDT - 1 closed bars (task P7); the cap is 288; a channel under 48 is not read (ShortChannelTests).
        for t_edt, window in ((49, 48), (50, 49), (287, 286), (288, 287), (289, 288), (290, 288), (755, 288)):
            with self.subTest(t_edt=t_edt):
                self.assertEqual(run(synth(t_edt=t_edt))["details"]["window_bars"], window)

    def test_the_bar_count_must_reach_the_window(self):
        short = run(synth(t_edt=50, bars=48))  # window 49
        self.assertEqual((short["status"], short["status_reasons"]), ("INVALID", ["INSUFFICIENT_BARS"]))
        self.assertEqual(run(synth(t_edt=50, bars=49))["status"], "VALID")
        self.assertEqual(run(synth(t_edt=49, bars=48))["details"]["window_bars"], 48)
        short = run(synth(t_edt=49, bars=47))  # window 48
        self.assertEqual((short["status"], short["status_reasons"]), ("INVALID", ["INSUFFICIENT_BARS"]))

    def test_t_edt_falls_back_in_order_and_ends_at_288(self):
        base = synth()
        cases = [
            ({"containment_n": DROP, "visual_window_bars": 100, "window_bars": 60}, 99),  # T_EDT 100: the channel has 99 closed bars
            ({"containment_n": DROP, "visual_window_bars": DROP, "window_bars": 60}, 59),
            ({"containment_n": DROP, "visual_window_bars": DROP, "window_bars": DROP}, 288),
            ({"containment_n": "x", "visual_window_bars": 100}, 99),
            ({"containment_n": float("nan"), "visual_window_bars": DROP, "window_bars": DROP}, 288),
            ({"containment_n": 755.0}, 288),
        ]
        for changes, window in cases:
            with self.subTest(changes=changes):
                self.assertEqual(run(with_stat(base, **changes))["details"]["window_bars"], window)

    def test_the_angle_bound_is_90_degrees(self):
        for angle, trend in ((90.0, "UP"), (-90.0, "DOWN")):
            out = run(synth(angle=angle))
            self.assertEqual((out["status"], out["details"]["trend_direction"]), ("VALID", trend))
        for angle in (90.01, -90.01):
            out = run(synth(angle=angle))
            self.assertEqual((out["status"], out["status_reasons"]), ("INVALID", ["SANITY_FAILED"]))


# --------------------------------------------------------------------------- T3: one test per pre-flight failure


class ShortChannelTests(unittest.TestCase):
    """Task P7 (PATCH 2.0.1): the window never reaches before the channel. ``T_EDT`` counts the rows on which the channel
    exists and the last of them is the still-open bar, so a real channel has ``T_EDT - 1`` closed rows. 2.0.0 read
    ``max(48, min(T_EDT, 288))`` bars: one bar too many for ``T_EDT`` 49 to 288 (a null, INVALID + DISCONTINUITY) and
    more still under 48."""

    def assert_invalid(self, out, reasons):
        self.assertEqual((out["status"], out["status_reasons"]), ("INVALID", reasons))
        self.assertEqual(schema_errors(out), [])
        self.assertEqual((out["state_code"], out["bias"], out["levels"], out["details"]), (None, None, [], {}))

    def test_a_real_short_channel_is_read_over_its_own_closed_bars(self):
        for indicator in ("best_fit_a", "fractal"):
            for t_edt in (49, 50, 100, 287, 288):
                with self.subTest(indicator=indicator, t_edt=t_edt):
                    out = run(with_channel_rows(synth(indicator=indicator), t_edt))
                    self.assertEqual((out["status"], out["status_reasons"]), ("VALID", []))
                    self.assertEqual(out["details"]["window_bars"], t_edt - 1)
                    self.assertEqual(schema_errors(out), [])

    def test_from_289_the_window_is_the_cap_as_before(self):
        for t_edt in (289, 290, 314, 755):
            with self.subTest(t_edt=t_edt):
                out = run(with_channel_rows(synth(), t_edt))
                self.assertEqual((out["status"], out["details"]["window_bars"]), ("VALID", 288))

    def test_a_channel_under_48_closed_bars_is_not_read(self):
        for t_edt in (48, 47, 30, 2, 1, 0, -5):
            with self.subTest(t_edt=t_edt):
                self.assert_invalid(run(with_channel_rows(synth(), t_edt)), ["INSUFFICIENT_BARS"])
        self.assertEqual(run(with_channel_rows(synth(), 49))["details"]["window_bars"], 48)  # exactly 48 is read

    def test_the_short_channel_check_comes_before_the_bar_checks_and_after_the_statistics(self):
        self.assert_invalid(run(with_bars(with_channel_rows(synth(), 30), lambda bars: bars[-5].update({"close": None}))), ["INSUFFICIENT_BARS"])
        self.assert_invalid(run(with_stat(with_channel_rows(synth(), 30), containment_rate=49.99)), ["CONTAINMENT_LOW"])
        null_inside = with_bars(with_channel_rows(synth(), 100), lambda bars: bars[-50].update({"best_fit_a_ssa": None}))
        self.assert_invalid(run(null_inside), ["DISCONTINUITY"])  # a null inside a long enough channel still stops

    def test_the_parameter_t_edt_open_bar_rows_moves_the_window(self):
        short = with_channel_rows(synth(), 100)  # the channel has 99 closed bars
        self.assert_invalid(run(short, with_params(t_edt_open_bar_rows=0)), ["DISCONTINUITY"])  # window 100: one bar before the channel
        self.assertEqual(run(short, with_params(t_edt_open_bar_rows=1))["details"]["window_bars"], 99)
        self.assertEqual(run(short, with_params(t_edt_open_bar_rows=2))["details"]["window_bars"], 98)
        self.assertEqual(run(synth(t_edt=755), with_params(t_edt_open_bar_rows=2))["details"]["window_bars"], 288)  # the cap
        three = with_params(t_edt_open_bar_rows=3)  # the floor is applied to T_EDT - 3
        self.assert_invalid(run(with_channel_rows(synth(), 50), three), ["INSUFFICIENT_BARS"])
        self.assertEqual(run(with_channel_rows(synth(), 51), three)["details"]["window_bars"], 48)

    def test_the_floor_and_the_cap_are_parameters(self):
        floor = with_params(min_window_bars=100)
        self.assert_invalid(run(with_channel_rows(synth(), 100), floor), ["INSUFFICIENT_BARS"])  # 99 rows
        self.assertEqual(run(with_channel_rows(synth(), 101), floor)["details"]["window_bars"], 100)
        cap = with_params(max_window_bars=200)
        self.assertEqual(run(synth(t_edt=755), cap)["details"]["window_bars"], 200)
        self.assertEqual(run(synth(t_edt=201), cap)["details"]["window_bars"], 200)
        self.assertEqual(run(synth(t_edt=200), cap)["details"]["window_bars"], 199)
        self.assertEqual(run(with_stat(synth(), containment_n=DROP, visual_window_bars=DROP, window_bars=DROP), cap)["details"]["window_bars"], 200)

    def test_a_missing_t_edt_is_not_a_short_channel(self):
        out = run(with_stat(synth(), containment_n=DROP, visual_window_bars=DROP, window_bars=DROP))
        self.assertEqual((out["status"], out["details"]["window_bars"]), ("VALID", 288))

    def test_the_stored_v1_cycle_cut_to_a_short_channel_changes_only_the_window(self):
        for indicator in ("best_fit_a", "fractal"):
            with self.subTest(indicator=indicator):
                base = with_indicator(stored_inputs("v1"), indicator)
                full = run(base)
                cut = run(with_channel_rows(base, 100))
                expected = json.loads(json.dumps(full))
                expected["details"]["window_bars"] = 99
                self.assertEqual(cut, expected)
                self.assertEqual(run(with_channel_rows(base, 48))["status_reasons"], ["INSUFFICIENT_BARS"])

    def test_tier3_reads_the_short_window_and_nothing_older(self):
        short = with_channel_rows(synth(), 100)  # window 99: bars[-99:]; bars[-100] has no channel and is never read
        inverted = with_bars(short, lambda bars: bars[-99].update({"best_fit_a_uoedt": 3900.0}))
        self.assert_invalid(run(inverted), ["SANITY_FAILED"])
        self.assertEqual(run(with_bars(short, lambda bars: bars[-100].update({"best_fit_a_uoedt": 3900.0})))["status"], "VALID")


class PreflightTests(unittest.TestCase):
    def assert_reading(self, out, status, reasons):
        self.assertEqual((out["status"], out["status_reasons"]), (status, reasons))
        self.assertEqual(schema_errors(out), [])
        if status in ("INVALID", "STALE"):
            self.assertEqual((out["state_code"], out["bias"], out["levels"], out["details"]), (None, None, [], {}))

    def test_cycle_unknown_data_status(self):
        self.assert_reading(run(dataclasses.replace(synth(), data_status="Stale")), "INVALID", ["SANITY_FAILED"])

    def test_cycle_data_stale(self):
        self.assert_reading(run(dataclasses.replace(synth(), data_status="STALE")), "STALE", ["DATA_STALE"])

    def test_cycle_retuning_keeps_the_state_and_adds_the_reason(self):
        out = run(dataclasses.replace(synth(), retuning=True))
        self.assert_reading(out, "CAUTIONARY", ["RETUNING"])
        self.assertEqual((out["state_code"], out["bias"], len(out["levels"])), ("MCD2_UP_IN_CORRIDOR", "LONG", 3))

    def test_tier1_no_setting(self):
        none = dataclasses.replace(synth(), active_indicator={})
        self.assert_reading(run(none), "INVALID", ["NO_SETTING"])

    def test_tier1_a_setting_that_is_not_a_candidate(self):
        self.assert_reading(run(with_indicator(synth(), "best_fit_z")), "INVALID", ["NO_SETTING"])
        self.assert_reading(run(with_indicator(synth(), "fractal_edt")), "INVALID", ["NO_SETTING"])

    def test_tier1_detection_mismatch_ends_stale_or_invalid_and_keeps_its_reason_first(self):
        wrong = with_indicator(synth(), "best_fit_b")  # best_fit_a has the data, the setting says best_fit_b
        self.assert_reading(run(wrong), "STALE", ["DETECTION_MISMATCH", "NO_STATS_AT_SLOT"])
        stats = thaw(dict(wrong.statistics))
        stats[("M5", "best_fit_b")] = dict(stats[("M5", "best_fit_a")], source="best_fit_b")
        with_row = dataclasses.replace(wrong, statistics=stats)
        self.assert_reading(run(with_row), "INVALID", ["DETECTION_MISMATCH", "DISCONTINUITY"])

    def test_tier1_candidates_populated_beside_the_set_one_change_nothing(self):  # D3
        def add_fractal(bars):
            for bar in bars:
                bar.update({"fractal_uoedt": 4060.0, "fractal_loedt": 3960.0, "fractal_best_fl": 4010.0})

        out = run(with_bars(synth(), add_fractal))
        self.assertEqual((out["status"], out["status_reasons"], out["state_code"]), ("VALID", [], "MCD2_UP_IN_CORRIDOR"))
        self.assertEqual(out["details"]["populated_candidates"], {"M5": ["fractal"]})
        self.assertEqual(run(synth())["details"]["populated_candidates"], {"M5": []})

    def test_tier4_no_row_and_a_row_from_another_slot(self):
        base = synth()
        self.assert_reading(run(dataclasses.replace(base, statistics={})), "STALE", ["NO_STATS_AT_SLOT"])
        self.assert_reading(run(with_stat(base, captured_at=slot_to_epoch(SLOT) - 300)), "STALE", ["NO_STATS_AT_SLOT"])

    def test_tier4_containment_below_the_floor(self):
        self.assert_reading(run(synth(containment=12.0)), "INVALID", ["CONTAINMENT_LOW"])

    def test_tier4_containment_or_angle_missing_or_not_a_number(self):
        base = synth()
        for field in ("containment_rate", "regression_angle"):
            for bad in (DROP, "x", None, float("nan")):
                with self.subTest(field=field, bad=bad):
                    self.assert_reading(run(with_stat(base, **{field: bad})), "INVALID", ["SANITY_FAILED"])

    def test_tier2_too_few_closed_bars(self):
        self.assert_reading(run(synth(bars=47)), "INVALID", ["INSUFFICIENT_BARS"])
        self.assert_reading(run(synth(bars=100)), "INVALID", ["INSUFFICIENT_BARS"])  # window 288

    def test_tier2_bars_out_of_order_missing_or_null(self):
        base = synth()
        swapped = with_bars(base, lambda bars: bars[-100].update({"timestamp": bars[-101]["timestamp"]}))
        self.assert_reading(run(swapped), "INVALID", ["DISCONTINUITY"])
        for column in ("best_fit_a_ssa", "best_fit_a_uoedt", "best_fit_a_loedt", "best_fit_a_base_fl", "close"):
            with self.subTest(column=column):
                nulled = with_bars(base, lambda bars: bars[-100].update({column: None}))
                self.assert_reading(run(nulled), "INVALID", ["DISCONTINUITY"])
        text = with_bars(base, lambda bars: bars[10].update({"timestamp": "x"}))
        self.assert_reading(run(text), "INVALID", ["DISCONTINUITY"])

    def test_tier2_a_null_older_than_the_window_is_ignored(self):
        old = with_bars(synth(), lambda bars: bars[3].update({"best_fit_a_ssa": None}))  # window 288 of 300 bars
        self.assertEqual(run(old)["status"], "VALID")

    def test_tier3_inverted_channel_anywhere_in_the_window(self):
        inverted = with_bars(synth(), lambda bars: bars[-100].update({"best_fit_a_uoedt": 3900.0}))
        self.assert_reading(run(inverted), "INVALID", ["SANITY_FAILED"])
        flat = with_bars(synth(), lambda bars: bars[-1].update({"best_fit_a_uoedt": 3950.0}))  # U == L on the last bar
        self.assert_reading(run(flat), "INVALID", ["SANITY_FAILED"])
        older = with_bars(synth(), lambda bars: bars[3].update({"best_fit_a_uoedt": 3900.0}))  # outside the window
        self.assertEqual(run(older)["status"], "VALID")

    def test_tier3_window_edges_strict_inequality_and_a_malformed_forming_bar(self):  # P6 findings H1 to H3
        def edited(index, **fields):
            return with_bars(synth(), lambda bars: bars[index].update(fields))

        # H1: 300 closed bars and N_window 288, so index 12 is the first bar of the window and 11 is just outside it.
        self.assert_reading(run(edited(12, best_fit_a_uoedt=3900.0)), "INVALID", ["SANITY_FAILED"])
        self.assertEqual(run(edited(11, best_fit_a_uoedt=3900.0))["status"], "VALID")
        # H2: UOEDT == LOEDT fails on a window bar other than the last (the comparison is strict).
        self.assert_reading(run(edited(100, best_fit_a_uoedt=3950.0)), "INVALID", ["SANITY_FAILED"])
        # H3: tier 3 reads closed bars only, so a malformed forming bar leaves the envelope byte-identical (R1).
        base = synth()
        forming = dict(thaw(base.bars)["M5"][-1], timestamp=slot_to_epoch(SLOT), best_fit_a_uoedt=3900.0, best_fit_a_loedt=4000.0)
        with_forming = with_bars(base, lambda bars: bars.append(forming))
        self.assertEqual(canonical_json(run(with_forming)), canonical_json(run(base)))

    def test_tier3_channel_width_and_angle_bound(self):
        for width in (0.0, -5.0):
            self.assert_reading(run(with_stat(synth(), channel_width=width)), "INVALID", ["SANITY_FAILED"])
        self.assert_reading(run(synth(angle=91.0)), "INVALID", ["SANITY_FAILED"])

    def test_the_first_failing_check_decides(self):
        base = synth(bars=10)
        self.assert_reading(run(dataclasses.replace(base, data_status="STALE")), "STALE", ["DATA_STALE"])
        self.assert_reading(run(dataclasses.replace(base, statistics={})), "STALE", ["NO_STATS_AT_SLOT"])  # before tier 2
        self.assert_reading(run(synth(bars=47, containment=10.0)), "INVALID", ["CONTAINMENT_LOW"])  # tier 4 before tier 2
        inverted = with_bars(synth(bars=47), lambda bars: bars[-1].update({"best_fit_a_uoedt": 3900.0}))
        self.assert_reading(run(inverted), "INVALID", ["INSUFFICIENT_BARS"])  # tier 2 before tier 3


# --------------------------------------------------------------------------- the 13 pre-retrofit scenarios (10 to 13)


class LegacyFailureCases(unittest.TestCase):
    """Legacy tests 10 to 13, re-expressed. 01 and 02 are ``RealCycleTests``; 03 to 09 are ``StateTests``."""

    def test_legacy_10_two_populated_indicators_is_no_longer_a_failure(self):
        out = run(stored_inputs("v1"))  # best_fit_a is set and the fractal EDT is populated too
        self.assertEqual((out["status"], out["state_code"]), ("VALID", "MCD2_UP_IN_CORRIDOR"))
        self.assertEqual(out["details"]["populated_candidates"], {"M5": ["fractal"]})
        no_setting = dataclasses.replace(stored_inputs("v1"), active_indicator={})
        self.assertEqual((run(no_setting)["status"], run(no_setting)["status_reasons"]), ("INVALID", ["NO_SETTING"]))

    def test_legacy_11_an_indicator_without_data_is_not_read(self):
        out = run(with_indicator(stored_inputs("v1"), "best_fit_b"))
        self.assertEqual((out["status"], out["status_reasons"]), ("STALE", ["DETECTION_MISMATCH", "NO_STATS_AT_SLOT"]))
        none_populated = synth()
        stripped = with_bars(none_populated, lambda bars: [bar.pop("best_fit_a_ssa") for bar in bars])
        out = run(stripped)
        self.assertEqual((out["status"], out["status_reasons"]), ("INVALID", ["DISCONTINUITY"]))

    def test_legacy_12_an_inverted_channel_is_rejected(self):
        inverted = with_bars(synth(), lambda bars: [bar.update({"best_fit_a_uoedt": 3900.0, "best_fit_a_loedt": 4000.0}) for bar in bars[-50:]])
        out = run(inverted)
        self.assertEqual((out["status"], out["status_reasons"]), ("INVALID", ["SANITY_FAILED"]))

    def test_legacy_13_missing_statistics_and_a_compromised_corridor(self):
        missing = run(dataclasses.replace(synth(), statistics={}))
        self.assertEqual((missing["status"], missing["status_reasons"]), ("STALE", ["NO_STATS_AT_SLOT"]))
        low = run(synth(containment=49.0))  # legacy: state MCD2_UNIDENTIFIED; now a status, never a state
        self.assertEqual((low["status"], low["status_reasons"], low["state_code"]), ("INVALID", ["CONTAINMENT_LOW"], None))

    def test_the_legacy_regime_words_map_to_the_new_ones_state_by_state(self):
        renamed = {
            "DIP_VALUE_BUY_OPPORTUNITY": "UPTREND_DIP_BELOW_CORRIDOR",
            "RALLY_VALUE_SELL_OPPORTUNITY": "DOWNTREND_RALLY_ABOVE_CORRIDOR",
        }
        # (legacy angle, legacy uoedt, legacy loedt, legacy metric, legacy state, legacy regime): legacy tests 03 to 09
        legacy = [
            (7.5, 4400.0, 4360.0, 4386.0, "MCD2_UP_IN_CORRIDOR", "TREND_ALIGNED_CONTINUATION"),
            (8.2, 4400.0, 4360.0, 4410.0, "MCD2_UP_UPPER_BREAKOUT", "UPPER_OVEREXTENSION_REVERSION"),
            (6.4, 4400.0, 4360.0, 4352.0, "MCD2_UP_LOWER_BREAKDOWN", "DIP_VALUE_BUY_OPPORTUNITY"),
            (-12.5, 4380.0, 4340.0, 4354.0, "MCD2_DOWN_IN_CORRIDOR", "TREND_ALIGNED_CONTINUATION"),
            (-9.8, 4380.0, 4340.0, 4334.0, "MCD2_DOWN_LOWER_BREAKDOWN", "LOWER_OVEREXTENSION_REVERSION"),
            (-11.0, 4380.0, 4340.0, 4386.0, "MCD2_DOWN_UPPER_BREAKOUT", "RALLY_VALUE_SELL_OPPORTUNITY"),
            (2.1, 4380.0, 4340.0, 4360.0, "MCD2_SIDEWAYS_IN_CORRIDOR", "RANGE_EQUILIBRIUM"),
            (-1.5, 4380.0, 4340.0, 4392.0, "MCD2_SIDEWAYS_UPPER_BREAKOUT", "RANGE_RESISTANCE_REVERSION"),
            (0.0, 4380.0, 4340.0, 4330.0, "MCD2_SIDEWAYS_LOWER_BREAKDOWN", "RANGE_SUPPORT_REVERSION"),
        ]
        for angle, upper, lower, metric, state, regime in legacy:
            with self.subTest(state=state):
                out = run(synth(angle=angle, upper=upper, lower=lower, metric=metric, baseline=(upper + lower) / 2))
                self.assertEqual(out["state_code"], state)
                self.assertEqual(out["regime_status"], renamed.get(regime, regime))


# --------------------------------------------------------------------------- T13: real cycles (legacy 01 and 02)

REAL = [
    # name, indicator, state, angle, containment, channel position, populated, last closed bar, levels (UOEDT, baseline, LOEDT)
    ("v1", "best_fit_a", "MCD2_UP_IN_CORRIDOR", 6.94, 55.76, 0.8192, ["fractal"], "2026-09-18T20:50Z", (4384.23, 4367.2, 4350.16)),
    ("v1", "fractal", "MCD2_UP_IN_CORRIDOR", 10.61, 64.88, 0.1065, ["best_fit_a"], "2026-09-18T20:50Z", (4412.51, 4399.75, 4374.23)),
    ("v4", "cherry_a", "MCD2_DOWN_IN_CORRIDOR", -20.94, 100.0, 0.1753, ["fractal"], "2026-09-28T23:10Z", (4249.14, 4170.13, 4096.72)),
    ("v4", "fractal", "MCD2_DOWN_IN_CORRIDOR", -49.89, 99.51, 0.7932, ["cherry_a"], "2026-09-28T23:10Z", (4141.61, 4112.19, 4062.86)),
]


class RealCycleTests(unittest.TestCase):
    def test_the_four_real_cycles(self):
        for name, indicator, state, angle, containment, position, populated, last_bar, levels in REAL:
            with self.subTest(workbook=name, indicator=indicator):
                out = run(with_indicator(stored_inputs(name), indicator))
                self.assertEqual((out["status"], out["status_reasons"], out["state_code"]), ("VALID", [], state))
                self.assertEqual(out["last_closed_bar"], {"M5": last_bar})
                self.assertEqual(out["active_indicator"], {"M5": indicator})
                self.assertEqual(list(out["config_hash"]), [statistics_source(indicator)])
                d = out["details"]
                self.assertEqual((d["regression_angle_deg"], d["containment_rate"], d["channel_position"]), (angle, containment, position))
                self.assertEqual((d["window_bars"], d["reversion_setup"]), (288, False))
                self.assertEqual(d["populated_candidates"], {"M5": populated})
                self.assertEqual(tuple(lv["price"] for lv in out["levels"]), levels)
                self.assertEqual(schema_errors(out), [])

    def test_legacy_01_v1_best_fit_a(self):
        out = run(stored_inputs("v1"))
        self.assertEqual(out["state_code"], "MCD2_UP_IN_CORRIDOR")
        self.assertEqual(out["details"]["trend_direction"], "UP")
        self.assertEqual(out["details"]["regression_angle_deg"], 6.94)
        self.assertEqual(out["details"]["containment_rate"], 55.76)
        self.assertTrue(out["commentary"].startswith("The M5 SSA is inside the corridor"))
        self.assertIn("(+6.94°)", out["commentary"])

    def test_legacy_02_v1_fractal_reads_close_and_fractal_edt(self):
        out = run(with_indicator(stored_inputs("v1"), "fractal"))
        self.assertEqual(out["state_code"], "MCD2_UP_IN_CORRIDOR")
        self.assertEqual(out["details"]["regression_angle_deg"], 10.61)
        self.assertEqual(out["details"]["containment_rate"], 64.88)
        self.assertIn("The M5 Close is inside the corridor", out["commentary"])
        self.assertEqual(list(out["config_hash"]), ["fractal_edt"])

    def test_the_stored_bundles_hold_closed_bars_only(self):
        for name, slot in SLOTS.items():
            bars = stored_inputs(name).bars["M5"]
            self.assertEqual(len(bars), 288)
            self.assertLessEqual(bars[-1]["timestamp"] + 300, slot_to_epoch(slot))
            self.assertEqual(bars[-1]["timestamp"], slot_to_epoch(slot) - 300)


# --------------------------------------------------------------------------- shared checks T4 to T8, T10, T12


class _Shared(shared.SharedSensorChecks):
    """T4 forming bar, T5 wrong-slot statistics, T6 setting, T7 determinism, T8 schema, T10 never throws,
    T12 size and time, on each real cycle."""

    NAME = ""
    INDICATOR = ""

    def sensor(self):
        return shared.SensorUnderTest(ev.evaluate, with_indicator(stored_inputs(self.NAME), self.INDICATOR), PARAMS, {}, ("M5",))


class SharedV1BestFitA(_Shared, unittest.TestCase):
    NAME, INDICATOR = "v1", "best_fit_a"


class SharedV1Fractal(_Shared, unittest.TestCase):
    NAME, INDICATOR = "v1", "fractal"


class SharedV4CherryA(_Shared, unittest.TestCase):
    NAME, INDICATOR = "v4", "cherry_a"


class SharedV4Fractal(_Shared, unittest.TestCase):
    NAME, INDICATOR = "v4", "fractal"


class NeverThrowsTests(unittest.TestCase):
    def test_t10_an_error_inside_the_evaluator_becomes_evaluator_error(self):
        broken = Params.from_dict(
            {
                "mcd_id": "MCD2",
                "evaluator_version": "2.0.0",
                "parameters": {
                    "sideways_angle_deg": {"value": 5.0, "unit": "degrees", "boundary": "x", "why": "x"},
                },
            }
        )
        with self.assertLogs("mcd", level="ERROR"):
            out = ev.evaluate(synth(), broken, {})
        self.assertEqual((out["status"], out["status_reasons"], out["state_code"]), ("INVALID", ["EVALUATOR_ERROR"], None))
        self.assertEqual(schema_errors(out), [])

    def test_the_evaluator_reads_m5_only_and_ignores_upstream(self):
        base = synth()
        junk = dataclasses.replace(base, bars={"M5": base.bars["M5"], "M15": ("garbage",)})
        self.assertEqual(canonical_json(run(junk)), canonical_json(run(base)))
        self.assertEqual(canonical_json(ev.evaluate(base, PARAMS, {"MCD1": {"status": "INVALID"}})), canonical_json(run(base)))


# --------------------------------------------------------------------------- T8, T9, T11, T12


class OutputTests(unittest.TestCase):
    def all_states(self):
        for angle in (7.5, -12.5, 2.1):
            for metric in (4010.0, 4062.5, 3941.25):
                yield run(synth(angle=angle, metric=metric, **AT))

    def test_t8_every_state_and_every_failure_validates_against_the_schema(self):
        envelopes = list(self.all_states())
        envelopes += [run(dataclasses.replace(synth(), data_status=s)) for s in ("STALE", "Stale")]
        envelopes += [run(dataclasses.replace(synth(), retuning=True)), run(with_indicator(synth(), "best_fit_b"))]
        for envelope in envelopes:
            self.assertEqual(schema_errors(envelope), [], envelope["state_code"])

    def test_t9_the_stored_fixtures_replay_byte_for_byte(self):
        self.assertEqual(shared.check_replay(ev.evaluate, PARAMS, FIXTURES), 2)

    def test_the_output_file_is_the_v1_envelope(self):
        stem = provider.slot_file_stem(SLOTS["v1"])
        stored = (FIXTURES / f"{stem}.envelope.json").read_text(encoding="utf-8")
        self.assertEqual((HERE / "mcd2_output.json").read_text(encoding="utf-8"), stored)
        self.assertEqual(canonical_json(run(stored_inputs("v1")), pretty=True), stored)
        self.assertEqual(json.loads(stored)["state_code"], "MCD2_UP_IN_CORRIDOR")

    def test_numbers_are_rounded_to_two_decimals_at_output_only(self):
        # Inputs with more than two decimals: the state is decided on them as they are, the output is rounded half up.
        out = run(synth(angle=6.945, containment=55.755, metric=4062.508, upper=4050.006, lower=3949.994, baseline=3999.9999))
        self.assertEqual(out["state_code"], "MCD2_UP_UPPER_BREAKOUT")
        self.assertEqual((out["details"]["regression_angle_deg"], out["details"]["containment_rate"]), (6.95, 55.76))
        self.assertEqual([lv["price"] for lv in out["levels"]], [4050.01, 4000.0, 3949.99])
        self.assertEqual(out["commentary"], "The M5 SSA is 12.50 above UOEDT 4050.01 while the channel slopes up (+6.95°).")
        self.assertEqual(out["details"]["channel_position"], round(out["details"]["channel_position"], 4))

    def test_t11_no_banned_word_no_percent_no_advice_in_codes_templates_and_texts(self):
        envelopes = list(self.all_states())
        shared.assert_wording_clean(
            mcd_id="MCD2",
            state_codes=list(ev.STATES),
            regime_words=sorted({regime for (_b, regime, _s, _t) in ev.STATES.values()}),
            templates=dict(ev.TEMPLATES),
            summaries=[(e["summary_line"], e["levels"]) for e in envelopes],
        )
        problems = []
        for e in envelopes:
            problems += wording.check_text("commentary", e["commentary"])
        for state in REGISTRY["states"]:
            problems += wording.check_text(f"meaning of {state['code']}", state["meaning"])
        self.assertEqual(problems, [])

    def test_t11_the_legacy_wording_is_what_the_check_rejects(self):
        for legacy in ("with SSA safely within the EDT corridor", "High probability of Mean Reversion", "prime buying opportunity"):
            self.assertTrue(wording.check_text("legacy", legacy), legacy)

    def test_t12_the_largest_envelope_is_within_600_tokens(self):
        envelopes = list(self.all_states())
        envelopes.append(run(dataclasses.replace(with_indicator(synth(), "best_fit_a"), retuning=True)))
        for name, indicator in (("v1", "best_fit_a"), ("v4", "cherry_a"), ("v1", "fractal"), ("v4", "fractal")):
            envelopes.append(run(with_indicator(stored_inputs(name), indicator)))
        result = shared.check_size(envelopes)
        self.assertFalse(result.pending, "o200k_base is not cached: python -m mcd_common.budget --fetch")
        self.assertTrue(result.passed, (result.largest_tokens, result.method))
        self.assertEqual(result.method, "o200k_base")


# --------------------------------------------------------------------------- A3, A26: what the evaluator may touch


class PurityTests(unittest.TestCase):
    ALLOWED_ROOTS = {"__future__", "decimal", "typing"}
    ALLOWED_KIT = {"envelope", "preflight", "reason_codes", "cycle_inputs"}
    FORBIDDEN_NAMES = {"open", "print", "input", "eval", "exec", "compile", "__import__"}
    FORBIDDEN_ATTRIBUTES = {"now", "utcnow", "today", "time", "monotonic", "perf_counter", "environ", "getenv", "random", "read_text", "write_text"}

    def tree(self):
        return ast.parse((HERE / "mcd2_evaluator.py").read_text(encoding="utf-8"))

    def test_the_evaluator_imports_only_the_standard_library_the_kit_and_pure_maths(self):
        for node in ast.walk(self.tree()):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    self.assertIn(alias.name.split(".")[0], self.ALLOWED_ROOTS, alias.name)
            elif isinstance(node, ast.ImportFrom):
                root = (node.module or "").split(".")[0]
                if root == "mcd_common":
                    parts = [p for p in (node.module or "").split(".")[1:]] or [alias.name for alias in node.names]
                    for part in parts:
                        self.assertIn(part, self.ALLOWED_KIT, node.module)
                else:
                    self.assertIn(root, self.ALLOWED_ROOTS, node.module)

    def test_the_evaluator_uses_no_file_clock_randomness_environment_or_printing(self):
        for node in ast.walk(self.tree()):
            if isinstance(node, ast.Name):
                self.assertNotIn(node.id, self.FORBIDDEN_NAMES, f"line {node.lineno}")
            elif isinstance(node, ast.Attribute):
                self.assertNotIn(node.attr, self.FORBIDDEN_ATTRIBUTES, f"line {node.lineno}")

    def test_the_folder_matches_the_standard_layout(self):
        expected = {
            "concept", "concept.md", "fixtures", "legacy", "mcd2.md", "mcd2_evaluator.py", "mcd2_implementation_plan.md",
            "mcd2_output.json", "mcd2_params.yaml", "mcd2_registry.yaml", "mcd2-manifest-work-completion.md",
            "test_mcd2_unit_tests.py",
        }
        present = {p.name for p in HERE.iterdir() if p.name != "__pycache__"}
        self.assertEqual(present, expected)
        self.assertEqual(sorted(p.name for p in (HERE / "legacy").iterdir() if p.name != "__pycache__"),
                         ["mcd2_evaluator.py", "mcd2_output.json", "test_mcd2_unit_tests.py"])
        self.assertEqual(sorted(p.name for p in (HERE / "concept").iterdir()),
                         ["mcd2-xauusd-m5-best-fit-a.png", "mcd2-xauusd-m5-fractal.png"])


# --------------------------------------------------------------------------- fixtures stay what the workbooks say


class FixtureProvenanceTests(unittest.TestCase):
    def test_each_fixture_names_its_workbook_and_the_hash_matches(self):
        for name, slot in SLOTS.items():
            source = (FIXTURES / f"{provider.slot_file_stem(slot)}.source.md").read_text(encoding="utf-8")
            self.assertIn(f"`{slot}`", source)
            if not WORKBOOKS[name].exists():
                self.skipTest(f"{WORKBOOKS[name].name} is not in this checkout")
            digest = hashlib.sha256(WORKBOOKS[name].read_bytes()).hexdigest()
            self.assertIn(digest, source, f"{WORKBOOKS[name].name} changed since the fixture was written (freeze, never edit)")

    def test_the_stored_bundles_are_what_the_provider_builds_from_the_workbooks(self):
        for name in SLOTS:
            if not WORKBOOKS[name].exists():
                self.skipTest(f"{WORKBOOKS[name].name} is not in this checkout")
            inputs, _report = fresh_bundle(name)
            self.assertEqual(json.loads(json.dumps(inputs.to_dict())), json.loads(json.dumps(stored_inputs(name).to_dict())), name)


if __name__ == "__main__":
    unittest.main()
