"""Unit tests for MCD1 2.0.1 (standard section 12: T1 to T13; T14 is for derived MCDs only).

Run from ``davintrade-stack-d-and-e/engine-1-5-new/``::

    python -m unittest discover -s mcd1

Real-data tests read the stored fixtures (``fixtures/<slot>.inputs.json``), never a workbook. Only the
provenance tests open the replica workbooks, and they skip when a workbook is missing. The fixtures are
written by ``write_fixtures()`` below::

    python -c "import sys; sys.path.insert(0, 'mcd1'); import test_mcd1_unit_tests as t; t.write_fixtures()"

The 13 pre-retrofit scenarios are kept as cases: legacy 01 is ``RealCycleTests``, 02 is
``LegacyCases.test_legacy_02_*``, 03 to 07 are ``LegacyCases.test_legacy_03_to_07_*``, 08 to 13 are the
other ``LegacyCases`` (see the method names and the manifest).
"""

from __future__ import annotations

import ast
import dataclasses
import hashlib
import json
import logging
import math
import sys
import unittest
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path

HERE = Path(__file__).resolve().parent
ENGINE = HERE.parent
STACK = ENGINE.parent
for _path in (str(ENGINE), str(HERE)):
    if _path not in sys.path:
        sys.path.insert(0, _path)

import yaml  # noqa: E402

import mcd1_evaluator as ev  # noqa: E402
from mcd_common import excel_fixture_provider as provider  # noqa: E402
from mcd_common import testing as shared  # noqa: E402
from mcd_common import wording  # noqa: E402
from mcd_common.cycle_inputs import (  # noqa: E402
    CENTROID_CANDIDATES,
    CycleInputs,
    Params,
    channel_columns,
    floor_epoch,
    slot_to_epoch,
    stats_slot_for,
    statistics_source,
    thaw,
)
from mcd_common.envelope import canonical_json, schema_errors  # noqa: E402

# The evaluator logs the exception behind EVALUATOR_ERROR; keep the test output quiet.
logging.getLogger("mcd").addHandler(logging.NullHandler())

FIXTURES = HERE / "fixtures"
PARAMS = Params.from_yaml(str(HERE / "mcd1_params.yaml"))
REGISTRY = yaml.safe_load((HERE / "mcd1_registry.yaml").read_text(encoding="utf-8"))

SLOTS = {"v1": "2026-09-18T20:55Z", "v4": "2026-09-28T23:15Z"}
SETTINGS = {name: ENGINE / "mcd_common" / "fixtures" / f"settings_{name}.yaml" for name in SLOTS}
WORKBOOKS = {"v1": ENGINE / "market_data_v6_replicated.xlsx", "v4": STACK / "market_data_v6_replicated_v4.xlsx"}

# One bundle holds the channel columns of all seven centroid candidates, so the second v4 reading (`non_a`) is
# the same bundle with the setting replaced in memory. The newest 150 closed M15 bars cover the largest
# practical N_micro (T_EDT 3,000 gives 150); MCD1 reads no M5 bar, so one is kept only to show it is ignored.
FIXTURE_COLUMNS = tuple(sorted({"close", *(c for cand in CENTROID_CANDIDATES for c in channel_columns(cand).values())}))
FIXTURE_BARS = {"M5": 1, "M15": 150}

# --------------------------------------------------------------------------- fixtures


def fresh_bundle(name: str):
    """The bundle the kit's provider builds from the frozen workbook (settings from the kit's settings file)."""
    return provider.build_cycle_inputs_with_report(
        WORKBOOKS[name], SETTINGS[name], columns=FIXTURE_COLUMNS, max_bars=FIXTURE_BARS
    )


def write_fixtures() -> None:
    """Write ``fixtures/<slot>.{inputs,envelope}.json``, ``<slot>.source.md`` and ``mcd1_output.json``."""
    for name in SLOTS:
        inputs, report = fresh_bundle(name)
        envelope = ev.evaluate(inputs, PARAMS, {})
        provider.write_fixture_files(FIXTURES, inputs, report, envelope, base_dir=ENGINE)
        if name == "v1":
            (HERE / "mcd1_output.json").write_text(canonical_json(envelope, pretty=True), encoding="utf-8", newline="\n")


def stored_inputs(name: str) -> CycleInputs:
    return provider.load_inputs(FIXTURES / f"{provider.slot_file_stem(SLOTS[name])}.inputs.json")


def with_indicator(inputs: CycleInputs, indicator: str) -> CycleInputs:
    return dataclasses.replace(inputs, active_indicator={**thaw(inputs.active_indicator), "M15": indicator})


# --------------------------------------------------------------------------- synthetic bundles

SLOT = "2026-09-18T20:55Z"
LAST_OPEN = floor_epoch(slot_to_epoch(SLOT), "M15") - 900  # the last closed M15 bar opens at 20:30
DROP = object()  # remove a field

# Standard synthetic channel: UOEDT 4050, baseline 4000, LOEDT 3950. Inside 4010 (channel position 0.6),
# above 4062.5 (1.125), below 3941.25 (-0.0875).
INSIDE, ABOVE, BELOW = 4010.0, 4062.5, 3941.25


def expected_n(t_edt: int) -> int:
    """N_micro as the spec states it (section 6): 5% of T_EDT rounded half up, never below 96 (integer arithmetic)."""
    return max(96, (5 * t_edt + 50) // 100)


def synth(
    *,
    indicator: str = "non_b",
    angle: float = 7.5,
    latest: float = INSIDE,
    above: int | None = None,
    below: int | None = None,
    where: str = "old",
    upper: float = 4050.0,
    lower: float = 3950.0,
    baseline: float = 4000.0,
    breach_above: float | None = None,
    breach_below: float | None = None,
    ssa: float = 4000.5,
    containment: float = 60.0,
    t_edt: int = 1808,
    bars: int = 150,
) -> CycleInputs:
    """A valid M15 bundle for slot 20:55: ``bars`` closed bars and the channel ``lower``..``upper``.

    The window is the newest ``expected_n(t_edt)`` bars. ``latest`` is the Close of the last closed bar.
    ``above`` and ``below`` are the totals of window bars that closed above UOEDT and below LOEDT, the latest
    bar included (default: 1 for the side the latest bar is on, else 0). The other breach bars sit at the
    start of the window (``where="old"``) or just before the latest bar (``where="new"``). All other bars
    close at the baseline.
    """
    cols = channel_columns(indicator)
    n = expected_n(t_edt)
    high = upper + 12.5 if breach_above is None else breach_above
    low = lower - 8.75 if breach_below is None else breach_below
    side = "above" if latest > upper else "below" if latest < lower else "inside"
    above = (1 if side == "above" else 0) if above is None else above
    below = (1 if side == "below" else 0) if below is None else below
    older_above, older_below = above - (side == "above"), below - (side == "below")
    slots = list(range(max(0, bars - n), bars - 1))  # window positions before the latest bar, oldest first
    assert older_above >= 0 and older_below >= 0 and older_above + older_below <= len(slots), (above, below, n)
    if where == "new":
        slots.reverse()
    closes = [baseline] * bars
    for index in slots[:older_above]:
        closes[index] = high
    for index in slots[older_above : older_above + older_below]:
        closes[index] = low
    closes[-1] = latest
    rows = [
        {
            "timestamp": LAST_OPEN - (bars - 1 - i) * 900,
            "close": closes[i],
            cols["upper"]: upper,
            cols["lower"]: lower,
            cols["baseline"]: baseline,
            cols["fit"]: ssa,
        }
        for i in range(bars)
    ]
    source = statistics_source(indicator)
    stats_row = {
        "timeframe": "M15",
        "source": source,
        "captured_at": slot_to_epoch(stats_slot_for(SLOT, "M15")),
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
        bars={"M15": rows},
        statistics={("M15", source): stats_row},
        stats_slot={"M5": stats_slot_for(SLOT, "M5"), "M15": stats_slot_for(SLOT, "M15")},
        active_indicator={"M15": indicator},
        config_hash={source: "abc123"},
        channel_mode={source: "dynamic"},
    )


def with_stat(inputs: CycleInputs, **changes) -> CycleInputs:
    stats = thaw(dict(inputs.statistics))
    key = ("M15", statistics_source(inputs.active_indicator["M15"]))
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
    edit(bars["M15"])
    return dataclasses.replace(inputs, bars=bars)


def with_params(**changes) -> Params:
    return dataclasses.replace(PARAMS, values={**PARAMS.values, **changes})


def with_channel_rows(inputs: CycleInputs, t_edt: int) -> CycleInputs:
    """A real-shaped short channel (task P7): ``containment_n`` is ``t_edt`` and the active indicator's channel columns
    exist only on the newest ``t_edt - 1`` closed bars (the last of the ``t_edt`` rows is the still-open bar), null
    before. Every real channel in the replicas has this shape."""
    columns = set(channel_columns(inputs.active_indicator["M15"]).values())
    keep = max(t_edt - 1, 0)

    def edit(bars):
        for bar in bars[: max(len(bars) - keep, 0)]:
            for column in columns:
                bar[column] = None

    return with_stat(with_bars(inputs, edit), containment_n=t_edt)


def run(inputs: CycleInputs, params: Params = PARAMS) -> dict:
    return ev.evaluate(inputs, params, {})


# The nine states: the arguments that give each one on the standard channel with N_micro 96.
NINE = {
    "MCD1_UP_IN_CORRIDOR": dict(angle=7.5),
    "MCD1_UP_UPPER_BREAKOUT": dict(angle=7.5, latest=ABOVE),
    "MCD1_UP_LOWER_BREAKDOWN": dict(angle=7.5, latest=BELOW, below=77),
    "MCD1_DOWN_IN_CORRIDOR": dict(angle=-12.5),
    "MCD1_DOWN_LOWER_BREAKDOWN": dict(angle=-12.5, latest=BELOW),
    "MCD1_DOWN_UPPER_BREAKOUT": dict(angle=-12.5, latest=ABOVE, above=77),
    "MCD1_SIDEWAYS_IN_CORRIDOR": dict(angle=2.1),
    "MCD1_SIDEWAYS_UPPER_BREAKOUT": dict(angle=2.1, latest=ABOVE, above=77),
    "MCD1_SIDEWAYS_LOWER_BREAKDOWN": dict(angle=2.1, latest=BELOW, below=77),
}


def all_states():
    for kwargs in NINE.values():
        yield run(synth(**kwargs))


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
            f"MCD1_{trend}_{regime}"
            for trend in ("UP", "DOWN", "SIDEWAYS")
            for regime in ("IN_CORRIDOR", "UPPER_BREAKOUT", "LOWER_BREAKDOWN")
        }
        self.assertEqual(set(ev.STATES), expected)
        self.assertEqual(len(REGISTRY["states"]), 9)
        self.assertEqual(set(NINE), expected)
        for code, (bias, *_rest) in ev.STATES.items():
            if code.endswith("IN_CORRIDOR"):  # D6: inside the corridor the bias follows the macro trend
                want = "LONG" if "_UP_" in code else "SHORT" if "_DOWN_" in code else "NEUTRAL"
            else:  # D6: a break follows the break direction, for all three trends
                want = "LONG" if code.endswith("UPPER_BREAKOUT") else "SHORT"
            self.assertEqual(bias, want, code)
        self.assertNotIn("DAVIN", yaml.safe_dump(REGISTRY))  # no placeholder is left

    def test_regime_words_are_the_five_unchanged_ones(self):
        regimes = {code: regime for code, (_b, regime, _s, _t) in ev.STATES.items()}
        self.assertEqual(
            set(regimes.values()),
            {"TREND_ALIGNED_CONTINUATION", "BREAKOUT_SAME_SLOPE", "COUNTER_TREND_EXPANSION", "CONSOLIDATION", "RANGE_EXPANSION"},
        )
        same_slope = {"MCD1_UP_UPPER_BREAKOUT", "MCD1_DOWN_LOWER_BREAKDOWN"}
        counter = {"MCD1_UP_LOWER_BREAKDOWN", "MCD1_DOWN_UPPER_BREAKOUT"}
        for code, regime in regimes.items():
            if code in same_slope:
                self.assertEqual(regime, "BREAKOUT_SAME_SLOPE", code)
            elif code in counter:
                self.assertEqual(regime, "COUNTER_TREND_EXPANSION", code)
            elif code.startswith("MCD1_SIDEWAYS_IN"):
                self.assertEqual(regime, "CONSOLIDATION", code)
            elif code.startswith("MCD1_SIDEWAYS"):
                self.assertEqual(regime, "RANGE_EXPANSION", code)
            else:
                self.assertEqual(regime, "TREND_ALIGNED_CONTINUATION", code)

    def test_registry_and_params_describe_this_evaluator(self):
        self.assertEqual(REGISTRY["mcd_id"], ev.MCD_ID)
        self.assertEqual(REGISTRY["evaluator_version"], ev.EVALUATOR_VERSION)
        self.assertEqual((PARAMS.mcd_id, PARAMS.evaluator_version), (ev.MCD_ID, ev.EVALUATOR_VERSION))
        self.assertEqual(REGISTRY["kind"], "independent")
        self.assertEqual(REGISTRY["timeframes"], ["M15"])
        self.assertEqual(REGISTRY["depends_on"], [])
        self.assertEqual(REGISTRY["uses_channel"], ["M15"])
        self.assertEqual(REGISTRY["rung"], {"DAY_TRADER": "primary_structure", "SCALPER": "trendlines_channels"})
        self.assertEqual(REGISTRY["flag"], "off")
        self.assertEqual(
            dict(PARAMS.values),
            {
                "sideways_angle_deg": 5.0,
                "min_containment_rate": 50.0,
                "micro_window_pct": 5.0,
                "min_micro_window_bars": 96,
                "t_edt_open_bar_rows": 1,
                "sustained_breach_pct": 80.0,
                "max_abs_regression_angle_deg": 90.0,
                "channel_position_decimals": 4,
            },
        )

    def test_a_sweep_reaches_every_state_and_agrees_with_an_independent_classifier(self):
        def independent(angle, latest, above, below, n=96):
            trend = "UP" if angle > 5 else "DOWN" if angle < -5 else "SIDEWAYS"
            side = "above" if latest > 4050 else "below" if latest < 3950 else "inside"
            if side == "inside":
                return f"MCD1_{trend}_IN_CORRIDOR"
            sustained = 100 * (above if side == "above" else below) >= 80 * n
            same_slope = (trend, side) in {("UP", "above"), ("DOWN", "below")}
            name = "UPPER_BREAKOUT" if side == "above" else "LOWER_BREAKDOWN"
            return f"MCD1_{trend}_{name}" if same_slope or sustained else f"MCD1_{trend}_IN_CORRIDOR"

        reached = set()
        for angle in (-80.0, -12.5, -5.01, -5.0, 0.0, 5.0, 5.01, 12.5, 80.0):
            for latest in (3900.0, 3949.99, 3950.0, 4010.0, 4050.0, 4050.01, 4100.0):
                for older_above, older_below in ((0, 0), (75, 0), (76, 0), (0, 75), (0, 76), (50, 44)):
                    above = older_above + (latest > 4050)
                    below = older_below + (latest < 3950)
                    out = run(synth(angle=angle, latest=latest, above=above, below=below))
                    self.assertEqual(out["state_code"], independent(angle, latest, above, below), (angle, latest, above, below))
                    reached.add(out["state_code"])
        self.assertEqual(reached, set(ev.STATES))


# --------------------------------------------------------------------------- T1: one test per state


class StateTests(unittest.TestCase):
    """T1. Nine states, each from a synthetic bundle on the standard channel (UOEDT 4050, LOEDT 3950, N_micro 96)."""

    def assert_state(self, state, *, regime, bias, upper, lower, position, commentary):
        out = run(synth(**NINE[state]))
        self.assertEqual(out["status"], "VALID", out["status_reasons"])
        self.assertEqual(out["state_code"], state)
        self.assertEqual(out["regime_status"], regime)
        self.assertEqual(out["bias"], bias)
        d = out["details"]
        self.assertEqual((d["n_micro"], d["upper_breach_count"], d["lower_breach_count"]), (96, upper, lower))
        self.assertEqual(d["channel_position"], position)
        self.assertEqual(out["commentary"], commentary)
        self.assertEqual(out["summary_line"], ev.STATES[state][2])
        self.assertEqual(out["depends_on"], [])
        self.assertEqual(
            [(lv["name"], lv["tf"], lv["price"], lv["role"]) for lv in out["levels"]],
            [("UOEDT", "M15", 4050.0, "resistance"), ("baseline", "M15", 4000.0, "mid"), ("LOEDT", "M15", 3950.0, "support")],
        )
        self.assertEqual(schema_errors(out), [])

    def test_01_up_in_corridor(self):
        self.assert_state("MCD1_UP_IN_CORRIDOR", regime="TREND_ALIGNED_CONTINUATION", bias="LONG", upper=0, lower=0, position=0.6,
                          commentary="The M15 channel slopes up (+7.50°). 96 of the last 96 closed bars closed inside the corridor; the latest closed bar has channel position 0.6000.")

    def test_02_up_upper_breakout(self):
        self.assert_state("MCD1_UP_UPPER_BREAKOUT", regime="BREAKOUT_SAME_SLOPE", bias="LONG", upper=1, lower=0, position=1.125,
                          commentary="The M15 channel slopes up (+7.50°). The latest closed bar closed 12.50 above UOEDT 4050.00 (channel position 1.1250); 1 of the last 96 closed bars closed above UOEDT.")

    def test_03_up_lower_breakdown(self):
        self.assert_state("MCD1_UP_LOWER_BREAKDOWN", regime="COUNTER_TREND_EXPANSION", bias="SHORT", upper=0, lower=77, position=-0.0875,
                          commentary="The M15 channel slopes up (+7.50°). The latest closed bar closed 8.75 below LOEDT 3950.00 (channel position -0.0875); 77 of the last 96 closed bars closed below LOEDT.")

    def test_04_down_in_corridor(self):
        self.assert_state("MCD1_DOWN_IN_CORRIDOR", regime="TREND_ALIGNED_CONTINUATION", bias="SHORT", upper=0, lower=0, position=0.6,
                          commentary="The M15 channel slopes down (-12.50°). 96 of the last 96 closed bars closed inside the corridor; the latest closed bar has channel position 0.6000.")

    def test_05_down_lower_breakdown(self):
        self.assert_state("MCD1_DOWN_LOWER_BREAKDOWN", regime="BREAKOUT_SAME_SLOPE", bias="SHORT", upper=0, lower=1, position=-0.0875,
                          commentary="The M15 channel slopes down (-12.50°). The latest closed bar closed 8.75 below LOEDT 3950.00 (channel position -0.0875); 1 of the last 96 closed bars closed below LOEDT.")

    def test_06_down_upper_breakout(self):
        self.assert_state("MCD1_DOWN_UPPER_BREAKOUT", regime="COUNTER_TREND_EXPANSION", bias="LONG", upper=77, lower=0, position=1.125,
                          commentary="The M15 channel slopes down (-12.50°). The latest closed bar closed 12.50 above UOEDT 4050.00 (channel position 1.1250); 77 of the last 96 closed bars closed above UOEDT.")

    def test_07_sideways_in_corridor(self):
        self.assert_state("MCD1_SIDEWAYS_IN_CORRIDOR", regime="CONSOLIDATION", bias="NEUTRAL", upper=0, lower=0, position=0.6,
                          commentary="The M15 channel is flat (+2.10°). 96 of the last 96 closed bars closed inside the corridor; the latest closed bar has channel position 0.6000.")

    def test_08_sideways_upper_breakout(self):
        self.assert_state("MCD1_SIDEWAYS_UPPER_BREAKOUT", regime="RANGE_EXPANSION", bias="LONG", upper=77, lower=0, position=1.125,
                          commentary="The M15 channel is flat (+2.10°). The latest closed bar closed 12.50 above UOEDT 4050.00 (channel position 1.1250); 77 of the last 96 closed bars closed above UOEDT.")

    def test_09_sideways_lower_breakdown(self):
        self.assert_state("MCD1_SIDEWAYS_LOWER_BREAKDOWN", regime="RANGE_EXPANSION", bias="SHORT", upper=0, lower=77, position=-0.0875,
                          commentary="The M15 channel is flat (+2.10°). The latest closed bar closed 8.75 below LOEDT 3950.00 (channel position -0.0875); 77 of the last 96 closed bars closed below LOEDT.")

    def test_the_inside_count_is_the_window_minus_both_breach_counts(self):
        out = run(synth(latest=INSIDE, above=10, below=5))
        self.assertEqual(out["state_code"], "MCD1_UP_IN_CORRIDOR")
        self.assertIn("81 of the last 96 closed bars closed inside the corridor", out["commentary"])
        false_break = run(synth(latest=BELOW, below=50))  # latest bar outside on the counter side, not sustained
        self.assertEqual(false_break["state_code"], "MCD1_UP_IN_CORRIDOR")
        self.assertIn("46 of the last 96 closed bars closed inside the corridor", false_break["commentary"])
        self.assertIn("channel position -0.0875", false_break["commentary"])

    def test_where_the_older_breach_bars_sit_does_not_change_the_reading(self):
        for kwargs in (dict(latest=BELOW, below=77), dict(latest=ABOVE, above=80), dict(latest=INSIDE, above=90)):
            with self.subTest(**kwargs):
                old = run(synth(where="old", **kwargs))
                new = run(synth(where="new", **kwargs))
                self.assertEqual(canonical_json(old), canonical_json(new))

    def test_a_same_slope_break_ignores_what_the_older_bars_did(self):
        out = run(synth(latest=ABOVE, below=90))  # up channel, latest bar above, 90 older bars below LOEDT
        self.assertEqual(out["state_code"], "MCD1_UP_UPPER_BREAKOUT")
        self.assertEqual((out["details"]["upper_breach_count"], out["details"]["lower_breach_count"]), (1, 90))


class MetricTests(unittest.TestCase):
    """The metric is the bar's Close for every candidate (Q1); the SSA is read (it must be a number) but not compared."""

    def test_the_close_is_the_metric_not_the_ssa(self):
        self.assertEqual(run(synth(ssa=5000.0))["state_code"], "MCD1_UP_IN_CORRIDOR")  # SSA far above, Close inside
        out = run(synth(latest=ABOVE, ssa=4000.0))  # SSA inside, Close above
        self.assertEqual(out["state_code"], "MCD1_UP_UPPER_BREAKOUT")
        self.assertIn("The latest closed bar closed 12.50 above UOEDT", out["commentary"])

    def test_every_centroid_candidate_can_be_the_active_indicator(self):
        for indicator in ("best_fit_a", "best_fit_b", "cherry_a", "cherry_b", "most_recent", "non_a", "non_b"):
            with self.subTest(indicator=indicator):
                out = run(synth(indicator=indicator))
                self.assertEqual((out["status"], out["state_code"]), ("VALID", "MCD1_UP_IN_CORRIDOR"))
                self.assertEqual(out["active_indicator"], {"M15": indicator})
                self.assertEqual(out["config_hash"], {indicator: "abc123"})
                self.assertEqual(out["details"]["populated_candidates"], {"M15": []})

    def test_the_fractal_edt_and_the_single_lines_are_never_candidates(self):
        for name in ("fractal", "fractal_edt", "resistance", "support", "sr_levels", "best_fit_z"):
            with self.subTest(name=name):
                out = run(with_indicator(synth(), name))
                self.assertEqual((out["status"], out["status_reasons"]), ("INVALID", ["NO_SETTING"]))


# --------------------------------------------------------------------------- T2: boundaries


class BoundaryTests(unittest.TestCase):
    def test_the_trend_band_edges_are_sideways_and_just_beyond_is_a_trend(self):
        for angle, trend in ((-5.01, "DOWN"), (-5.0, "SIDEWAYS"), (-4.99, "SIDEWAYS"), (0.0, "SIDEWAYS"),
                             (4.99, "SIDEWAYS"), (5.0, "SIDEWAYS"), (5.0000001, "UP"), (5.01, "UP")):
            with self.subTest(angle=angle):
                self.assertEqual(run(synth(angle=angle))["details"]["trend_direction"], trend)

    def test_the_corridor_edges_are_inside_and_just_beyond_is_outside(self):
        up = lambda **kw: run(synth(angle=7.5, **kw))["state_code"]  # noqa: E731
        down = lambda **kw: run(synth(angle=-12.5, **kw))["state_code"]  # noqa: E731
        self.assertEqual(up(latest=4050.0), "MCD1_UP_IN_CORRIDOR")
        self.assertEqual(up(latest=4050.01), "MCD1_UP_UPPER_BREAKOUT")
        self.assertEqual(down(latest=3950.0), "MCD1_DOWN_IN_CORRIDOR")
        self.assertEqual(down(latest=3949.99), "MCD1_DOWN_LOWER_BREAKDOWN")
        # With a sustained share on the counter side, the latest bar on the edge is still inside; one tick beyond breaks.
        self.assertEqual(up(latest=3950.0, below=77), "MCD1_UP_IN_CORRIDOR")
        self.assertEqual(up(latest=3949.99, below=77), "MCD1_UP_LOWER_BREAKDOWN")
        self.assertEqual(down(latest=4050.0, above=77), "MCD1_DOWN_IN_CORRIDOR")
        self.assertEqual(down(latest=4050.01, above=77), "MCD1_DOWN_UPPER_BREAKOUT")

    def test_the_state_follows_the_prices_not_the_rounded_channel_position(self):
        above = run(synth(latest=4050.000004))  # CP 1.00000004 rounds to 1.0000
        self.assertEqual(above["state_code"], "MCD1_UP_UPPER_BREAKOUT")
        self.assertEqual(above["details"]["channel_position"], 1.0)
        below = run(synth(angle=-12.5, latest=3949.999996))
        self.assertEqual(below["state_code"], "MCD1_DOWN_LOWER_BREAKDOWN")
        self.assertEqual(below["details"]["channel_position"], 0.0)
        counter = run(synth(latest=3949.999996, below=77))  # legacy: rounded CP 0.0 is not below 0.0, so it stayed inside
        self.assertEqual(counter["state_code"], "MCD1_UP_LOWER_BREAKDOWN")
        self.assertEqual(counter["details"]["channel_position"], 0.0)

    def test_the_sustained_share_is_inclusive_at_77_of_96_and_82_of_102(self):
        cases = (
            (1808, 96, 76, "IN_CORRIDOR"), (1808, 96, 77, "LOWER_BREAKDOWN"), (1808, 96, 96, "LOWER_BREAKDOWN"),
            (2035, 102, 81, "IN_CORRIDOR"), (2035, 102, 82, "LOWER_BREAKDOWN"),
            (2000, 100, 79, "IN_CORRIDOR"), (2000, 100, 80, "LOWER_BREAKDOWN"),  # exactly 80.0%: inclusive
        )
        for t_edt, n, count, regime in cases:
            with self.subTest(t_edt=t_edt, n_micro=n, count=count):
                out = run(synth(latest=BELOW, below=count, t_edt=t_edt))
                self.assertEqual(out["details"]["n_micro"], n)
                self.assertEqual(out["state_code"], f"MCD1_UP_{regime}")

    def test_the_breach_counts_cover_exactly_the_window(self):
        # 150 closed bars and N_micro 96: index 54 is the first bar of the window, index 53 is just outside it.
        base = synth(latest=BELOW, below=76, where="new")  # 76 of 96 below, all near the end: not sustained
        self.assertEqual(run(base)["state_code"], "MCD1_UP_IN_CORRIDOR")
        outside = with_bars(base, lambda bars: bars[53].update({"close": 3900.0}))
        self.assertEqual(run(outside)["state_code"], "MCD1_UP_IN_CORRIDOR")  # a bar outside the window is not counted
        self.assertEqual(run(outside)["details"]["lower_breach_count"], 76)
        inside_window = with_bars(base, lambda bars: bars[54].update({"close": 3900.0}))
        self.assertEqual(run(inside_window)["state_code"], "MCD1_UP_LOWER_BREAKDOWN")  # the first window bar is counted
        self.assertEqual(run(inside_window)["details"]["lower_breach_count"], 77)

    def test_a_window_bar_that_closes_exactly_on_a_band_is_inside_and_not_counted(self):
        # Both edges are inside (spec section 6): the counts use strict > UOEDT and < LOEDT on every window bar,
        # not only on the latest one. Window indexes 54 to 73 are plain bars here (where="new").
        lower = with_bars(synth(latest=BELOW, below=76, where="new"),
                          lambda bars: [bars[i].update({"close": 3950.0}) for i in range(54, 74)])
        out = run(lower)
        self.assertEqual((out["state_code"], out["details"]["lower_breach_count"]), ("MCD1_UP_IN_CORRIDOR", 76))
        self.assertIn("20 of the last 96 closed bars closed inside the corridor", out["commentary"])  # 96 - 0 - 76
        upper = with_bars(synth(angle=-12.5, latest=ABOVE, above=76, where="new"),
                          lambda bars: [bars[i].update({"close": 4050.0}) for i in range(54, 74)])
        out = run(upper)
        self.assertEqual((out["state_code"], out["details"]["upper_breach_count"]), ("MCD1_DOWN_IN_CORRIDOR", 76))

    def test_the_channel_position_rounds_half_up_at_output_only(self):
        # Channel 1024..1040 (width 16): a Close 0.5 above LOEDT is exactly 1/32 = 0.03125, an exact half at 4 decimals.
        channel = dict(upper=1040.0, lower=1024.0, baseline=1032.0, ssa=1032.0)
        up = run(synth(latest=1024.5, **channel))
        down = run(synth(latest=1023.5, **channel))
        self.assertEqual(up["details"]["channel_position"], 0.0313)
        self.assertEqual(down["details"]["channel_position"], -0.0313)
        self.assertIn("channel position 0.0313", up["commentary"])
        self.assertIn("channel position -0.0313", down["commentary"])
        self.assertEqual(up["state_code"], "MCD1_UP_IN_CORRIDOR")

    def test_a_small_break_is_written_as_it_is_and_a_hair_below_loedt_is_never_a_negative_zero(self):
        # P6 for MCD1, findings F1 and F2: two mutants survived the 104 earlier tests (a floor of 1.00 on {dist}; no
        # negative-zero guard on the channel position). The real evaluator was right in both cases; this test pins it.
        # F1: {dist} is the break itself; it is not floored at 1.00, so a break under 1.00 must read as it is.
        for angle, latest, text in (
            (7.5, 4050.25, "closed 0.25 above UOEDT 4050.00"),
            (7.5, 4050.01, "closed 0.01 above UOEDT 4050.00"),
            (7.5, 4050.5, "closed 0.50 above UOEDT 4050.00"),
            (-12.5, 3949.75, "closed 0.25 below LOEDT 3950.00"),
            (-12.5, 3949.99, "closed 0.01 below LOEDT 3950.00"),
        ):
            with self.subTest(angle=angle, latest=latest):
                self.assertIn(text, run(synth(angle=angle, latest=latest))["commentary"])
        # F2: Close 3949.999996 is 4e-6 below LOEDT, a channel position of -4e-8, which rounds to zero at 4 decimals.
        # It is written 0.0000 in the commentary and is a positive zero in the details (the state is decided on prices).
        for kwargs, state in (
            (dict(angle=-12.5, latest=3949.999996), "MCD1_DOWN_LOWER_BREAKDOWN"),  # same-slope break on the latest bar
            (dict(angle=7.5, latest=3949.999996, below=77), "MCD1_UP_LOWER_BREAKDOWN"),  # sustained counter-trend break
            (dict(angle=7.5, latest=3949.999996), "MCD1_UP_IN_CORRIDOR"),  # false breakout, not sustained
        ):
            with self.subTest(state=state):
                out = run(synth(**kwargs))
                position = out["details"]["channel_position"]
                self.assertEqual(out["state_code"], state)
                self.assertEqual(position, 0.0)
                self.assertEqual(math.copysign(1.0, position), 1.0)  # +0.0, not -0.0 (which also equals 0.0)
                self.assertIn("channel position 0.0000", out["commentary"])
                self.assertNotIn("-0.0000", out["commentary"])

    def test_a_counter_trend_or_sideways_break_needs_the_share_on_either_side(self):
        for angle, side, latest, count_kw in (
            (-12.5, "UPPER_BREAKOUT", ABOVE, "above"), (2.1, "UPPER_BREAKOUT", ABOVE, "above"),
            (7.5, "LOWER_BREAKDOWN", BELOW, "below"), (2.1, "LOWER_BREAKDOWN", BELOW, "below"),
        ):
            with self.subTest(angle=angle, side=side):
                trend = "UP" if angle > 5 else "DOWN" if angle < -5 else "SIDEWAYS"
                self.assertEqual(run(synth(angle=angle, latest=latest, **{count_kw: 76}))["state_code"], f"MCD1_{trend}_IN_CORRIDOR")
                self.assertEqual(run(synth(angle=angle, latest=latest, **{count_kw: 77}))["state_code"], f"MCD1_{trend}_{side}")

    def test_a_same_slope_break_needs_one_bar_and_a_counter_side_bar_alone_is_not_a_break(self):
        self.assertEqual(run(synth(angle=7.5, latest=ABOVE))["state_code"], "MCD1_UP_UPPER_BREAKOUT")  # ADR-023: 1 of 96
        self.assertEqual(run(synth(angle=-12.5, latest=BELOW))["state_code"], "MCD1_DOWN_LOWER_BREAKDOWN")
        self.assertEqual(run(synth(angle=7.5, latest=BELOW))["state_code"], "MCD1_UP_IN_CORRIDOR")
        self.assertEqual(run(synth(angle=-12.5, latest=ABOVE))["state_code"], "MCD1_DOWN_IN_CORRIDOR")
        self.assertEqual(run(synth(angle=2.1, latest=ABOVE))["state_code"], "MCD1_SIDEWAYS_IN_CORRIDOR")
        self.assertEqual(run(synth(angle=2.1, latest=BELOW))["state_code"], "MCD1_SIDEWAYS_IN_CORRIDOR")

    def test_a_latest_bar_inside_stays_inside_however_many_older_bars_were_outside(self):
        self.assertEqual(run(synth(angle=7.5, latest=INSIDE, above=90))["state_code"], "MCD1_UP_IN_CORRIDOR")
        self.assertEqual(run(synth(angle=-12.5, latest=INSIDE, below=90))["state_code"], "MCD1_DOWN_IN_CORRIDOR")
        self.assertEqual(run(synth(angle=2.1, latest=INSIDE, above=95))["state_code"], "MCD1_SIDEWAYS_IN_CORRIDOR")
        self.assertEqual(run(synth(angle=2.1, latest=INSIDE, below=95))["state_code"], "MCD1_SIDEWAYS_IN_CORRIDOR")

    def test_containment_49_99_fails_50_and_50_01_pass(self):
        out = run(synth(containment=49.99))
        self.assertEqual((out["status"], out["status_reasons"]), ("INVALID", ["CONTAINMENT_LOW"]))
        for rate in (50.0, 50.01):
            with self.subTest(rate=rate):
                self.assertEqual(run(synth(containment=rate))["status"], "VALID")

    def test_the_micro_window_is_five_percent_of_t_edt_rounded_half_up_and_never_below_96(self):
        cases = (
            (545, 96), (1808, 96), (1909, 96), (1910, 96), (1929, 96), (1930, 97), (1931, 97), (2035, 102),
            (2049, 102), (2050, 103),  # 102.5: Python's round() would give the even 102
            (2070, 104), (3000, 150),
        )
        for t_edt, window in cases:
            with self.subTest(t_edt=t_edt):
                out = run(synth(t_edt=t_edt))
                self.assertEqual(out["status"], "VALID")
                self.assertEqual(out["details"]["n_micro"], window)
                self.assertEqual(window, expected_n(t_edt))

    def test_the_bar_count_must_reach_the_window(self):
        for t_edt, window in ((1808, 96), (1930, 97), (2050, 103)):
            with self.subTest(n_micro=window):
                short = run(synth(t_edt=t_edt, bars=window - 1))
                self.assertEqual((short["status"], short["status_reasons"]), ("INVALID", ["INSUFFICIENT_BARS"]))
                self.assertEqual(run(synth(t_edt=t_edt, bars=window))["status"], "VALID")

    def test_the_window_percentage_is_a_parameter(self):
        ten = with_params(micro_window_pct=10.0)  # legacy test 02, case 4: 10% of 1,808 is 180.8, so 181
        self.assertEqual(run(synth(bars=200), ten)["details"]["n_micro"], 181)
        floor = with_params(min_micro_window_bars=120)
        self.assertEqual(run(synth(bars=150), floor)["details"]["n_micro"], 120)
        eighty = with_params(sustained_breach_pct=50.0)
        self.assertEqual(run(synth(latest=BELOW, below=48), eighty)["state_code"], "MCD1_UP_LOWER_BREAKDOWN")
        self.assertEqual(run(synth(latest=BELOW, below=47), eighty)["state_code"], "MCD1_UP_IN_CORRIDOR")

    def test_t_edt_falls_back_in_order_and_ends_at_the_floor(self):
        base = synth()
        cases = [
            ({"containment_n": DROP, "visual_window_bars": 3000}, 150),
            ({"containment_n": DROP, "visual_window_bars": DROP}, 96),
            ({"containment_n": DROP, "visual_window_bars": DROP, "window_bars": 3000}, 96),  # MCD1 does not read window_bars
            ({"containment_n": "x", "visual_window_bars": 2035}, 102),
            ({"containment_n": float("nan"), "visual_window_bars": 2035}, 102),
            ({"containment_n": None, "visual_window_bars": None}, 96),
            ({"containment_n": 1930.0}, 97),
            ({"containment_n": 3000, "visual_window_bars": 1808}, 150),  # containment_n comes first
        ]
        for changes, window in cases:
            with self.subTest(changes=changes):
                self.assertEqual(run(with_stat(base, **changes))["details"]["n_micro"], window)

    def test_the_angle_bound_is_90_degrees(self):
        for angle, trend in ((90.0, "UP"), (-90.0, "DOWN")):
            out = run(synth(angle=angle))
            self.assertEqual((out["status"], out["details"]["trend_direction"]), ("VALID", trend))
        for angle in (90.01, -90.01):
            out = run(synth(angle=angle))
            self.assertEqual((out["status"], out["status_reasons"]), ("INVALID", ["SANITY_FAILED"]))


# --------------------------------------------------------------------------- T3: one test per pre-flight failure


class ShortChannelTests(unittest.TestCase):
    """Task P7 (PATCH 2.0.1): the channel must hold ``N_micro`` closed bars. ``T_EDT`` counts the rows on which the channel
    exists and the last of them is the still-open bar, so a real channel has ``T_EDT - 1`` closed rows. 2.0.0 applied the
    floor of 96 even to a channel of 96 rows or fewer (``T_EDT`` 96 or less): the window reached before the channel,
    met a null and ended INVALID + DISCONTINUITY. Now it ends INVALID + INSUFFICIENT_BARS; nothing else changes."""

    def assert_invalid(self, out, reasons):
        self.assertEqual((out["status"], out["status_reasons"]), ("INVALID", reasons))
        self.assertEqual(schema_errors(out), [])
        self.assertEqual((out["state_code"], out["bias"], out["levels"], out["details"]), (None, None, [], {}))

    def test_a_real_channel_of_at_least_96_closed_bars_is_read_as_before(self):
        for indicator in ("non_b", "best_fit_a"):
            for t_edt in (97, 98, 120, 500, 1808):
                with self.subTest(indicator=indicator, t_edt=t_edt):
                    out = run(with_channel_rows(synth(indicator=indicator, t_edt=t_edt), t_edt))
                    self.assertEqual((out["status"], out["status_reasons"]), ("VALID", []))
                    self.assertEqual(out["details"]["n_micro"], expected_n(t_edt))
                    self.assertEqual(schema_errors(out), [])

    def test_a_channel_under_96_closed_bars_is_not_read(self):
        for t_edt in (96, 95, 50, 2, 1, 0, -5):
            with self.subTest(t_edt=t_edt):
                self.assert_invalid(run(with_channel_rows(synth(t_edt=t_edt), t_edt)), ["INSUFFICIENT_BARS"])

    def test_the_parameter_t_edt_open_bar_rows_moves_the_boundary(self):
        short = with_channel_rows(synth(t_edt=96), 96)  # the channel has 95 closed bars
        self.assert_invalid(run(short, with_params(t_edt_open_bar_rows=1)), ["INSUFFICIENT_BARS"])
        self.assert_invalid(run(short, with_params(t_edt_open_bar_rows=0)), ["DISCONTINUITY"])  # 96 rows said, 95 exist: the window meets a null
        two = with_params(t_edt_open_bar_rows=2)
        self.assert_invalid(run(with_channel_rows(synth(t_edt=97), 97), two), ["INSUFFICIENT_BARS"])
        self.assertEqual(run(with_channel_rows(synth(t_edt=98), 98), two)["details"]["n_micro"], 96)

    def test_the_channel_must_hold_n_micro_whatever_sets_it(self):
        floor = with_params(min_micro_window_bars=150)
        self.assert_invalid(run(with_channel_rows(synth(t_edt=150, bars=200), 150), floor), ["INSUFFICIENT_BARS"])
        self.assertEqual(run(with_channel_rows(synth(t_edt=151, bars=200), 151), floor)["details"]["n_micro"], 150)
        self.assertEqual(run(with_channel_rows(synth(t_edt=300, bars=300), 300), with_params(micro_window_pct=99.0))["details"]["n_micro"], 297)
        self.assert_invalid(run(with_channel_rows(synth(t_edt=300, bars=300), 300), with_params(micro_window_pct=100.0)), ["INSUFFICIENT_BARS"])

    def test_a_missing_t_edt_is_not_a_short_channel(self):
        out = run(with_stat(synth(), containment_n=DROP, visual_window_bars=DROP))
        self.assertEqual((out["status"], out["details"]["n_micro"]), ("VALID", 96))

    def test_the_short_channel_check_comes_before_the_bar_checks_and_after_the_statistics(self):
        short = with_channel_rows(synth(t_edt=50), 50)
        self.assert_invalid(run(with_bars(short, lambda bars: bars[-5].update({"close": None}))), ["INSUFFICIENT_BARS"])
        self.assert_invalid(run(with_stat(short, containment_rate=49.99)), ["CONTAINMENT_LOW"])
        long_enough = with_channel_rows(synth(t_edt=200), 200)
        self.assert_invalid(run(with_bars(long_enough, lambda bars: bars[-50].update({"non_b_ssa": None}))), ["DISCONTINUITY"])

    def test_the_stored_real_cycles_cut_to_the_shortest_readable_channel_read_the_same(self):
        for name, indicator in (("v1", "non_b"), ("v4", "non_a")):  # the real cycles whose own N_micro is 96 (T_EDT 1808 and 968)
            with self.subTest(workbook=name, indicator=indicator):
                base = with_indicator(stored_inputs(name), indicator)
                full = run(base)
                self.assertEqual(full["details"]["n_micro"], 96)
                self.assertEqual(run(with_channel_rows(base, 97)), full)  # 96 rows: nothing in the output depends on T_EDT but N_micro
                self.assert_invalid(run(with_channel_rows(base, 96)), ["INSUFFICIENT_BARS"])

    def test_tier3_reads_exactly_the_bars_of_the_channel(self):
        short = with_channel_rows(synth(t_edt=97), 97)  # 96 rows: the window is the whole channel
        inverted = with_bars(short, lambda bars: bars[-96].update({"non_b_uoedt": 3900.0}))
        self.assert_invalid(run(inverted), ["SANITY_FAILED"])
        self.assertEqual(run(with_bars(short, lambda bars: bars[-97].update({"non_b_uoedt": 3900.0})))["status"], "VALID")  # no channel there


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
        self.assertEqual((out["state_code"], out["bias"], len(out["levels"])), ("MCD1_UP_IN_CORRIDOR", "LONG", 3))

    def test_tier1_no_setting(self):
        none = dataclasses.replace(synth(), active_indicator={})
        self.assert_reading(run(none), "INVALID", ["NO_SETTING"])

    def test_tier1_a_setting_that_is_not_a_candidate(self):
        self.assert_reading(run(with_indicator(synth(), "best_fit_z")), "INVALID", ["NO_SETTING"])
        self.assert_reading(run(with_indicator(synth(), "fractal")), "INVALID", ["NO_SETTING"])

    def test_tier1_detection_mismatch_ends_stale_or_invalid_and_keeps_its_reason_first(self):
        wrong = with_indicator(synth(), "best_fit_b")  # non_b has the data, the setting says best_fit_b
        self.assert_reading(run(wrong), "STALE", ["DETECTION_MISMATCH", "NO_STATS_AT_SLOT"])
        stats = thaw(dict(wrong.statistics))
        stats[("M15", "best_fit_b")] = dict(stats[("M15", "non_b")], source="best_fit_b")
        with_row = dataclasses.replace(wrong, statistics=stats)
        self.assert_reading(run(with_row), "INVALID", ["DETECTION_MISMATCH", "DISCONTINUITY"])

    def test_tier1_candidates_populated_beside_the_set_one_change_nothing(self):  # D3
        def add_non_a(bars):
            for bar in bars:
                bar.update({"non_a_uoedt": 4060.0, "non_a_loedt": 3960.0, "non_a_base_fl": 4010.0, "non_a_ssa": 4005.0})

        out = run(with_bars(synth(), add_non_a))
        self.assertEqual((out["status"], out["status_reasons"], out["state_code"]), ("VALID", [], "MCD1_UP_IN_CORRIDOR"))
        self.assertEqual(out["details"]["populated_candidates"], {"M15": ["non_a"]})
        self.assertEqual(run(synth())["details"]["populated_candidates"], {"M15": []})

    def test_tier1_the_fractal_edt_is_not_an_m15_candidate(self):
        def add_fractal(bars):
            for bar in bars:
                bar.update({"fractal_uoedt": 4060.0, "fractal_loedt": 3960.0, "fractal_best_fl": 4010.0})

        out = run(with_bars(synth(), add_fractal))
        self.assertEqual((out["status"], out["details"]["populated_candidates"]), ("VALID", {"M15": []}))

    def test_tier4_no_row_and_a_row_from_another_slot(self):
        base = synth()
        self.assert_reading(run(dataclasses.replace(base, statistics={})), "STALE", ["NO_STATS_AT_SLOT"])
        self.assert_reading(run(with_stat(base, captured_at=slot_to_epoch(SLOT) - 900)), "STALE", ["NO_STATS_AT_SLOT"])
        # The strict rule: a row stamped with the export slot 20:55 is not the row of the M15 slot 20:45.
        self.assert_reading(run(with_stat(base, captured_at=slot_to_epoch(SLOT))), "STALE", ["NO_STATS_AT_SLOT"])

    def test_tier4_containment_below_the_floor(self):
        self.assert_reading(run(synth(containment=12.0)), "INVALID", ["CONTAINMENT_LOW"])

    def test_tier4_containment_or_angle_missing_or_not_a_number(self):
        base = synth()
        for field in ("containment_rate", "regression_angle"):
            for bad in (DROP, "x", None, float("nan")):
                with self.subTest(field=field, bad=bad):
                    self.assert_reading(run(with_stat(base, **{field: bad})), "INVALID", ["SANITY_FAILED"])

    def test_tier2_too_few_closed_bars(self):
        self.assert_reading(run(synth(bars=95)), "INVALID", ["INSUFFICIENT_BARS"])
        self.assert_reading(run(synth(bars=10)), "INVALID", ["INSUFFICIENT_BARS"])
        self.assert_reading(run(synth(t_edt=3000, bars=149)), "INVALID", ["INSUFFICIENT_BARS"])  # window 150

    def test_tier2_bars_out_of_order_missing_or_null(self):
        base = synth()
        swapped = with_bars(base, lambda bars: bars[-50].update({"timestamp": bars[-51]["timestamp"]}))
        self.assert_reading(run(swapped), "INVALID", ["DISCONTINUITY"])
        for column in ("non_b_ssa", "non_b_uoedt", "non_b_loedt", "non_b_base_fl", "close"):
            with self.subTest(column=column):
                nulled = with_bars(base, lambda bars: bars[-50].update({column: None}))
                self.assert_reading(run(nulled), "INVALID", ["DISCONTINUITY"])
        text = with_bars(base, lambda bars: bars[10].update({"timestamp": "x"}))
        self.assert_reading(run(text), "INVALID", ["DISCONTINUITY"])

    def test_tier2_a_null_older_than_the_window_is_ignored(self):
        old = with_bars(synth(), lambda bars: bars[3].update({"non_b_ssa": None}))  # window 96 of 150 bars
        self.assertEqual(run(old)["status"], "VALID")

    def test_tier3_inverted_channel_anywhere_in_the_window(self):
        inverted = with_bars(synth(), lambda bars: bars[-50].update({"non_b_uoedt": 3900.0}))
        self.assert_reading(run(inverted), "INVALID", ["SANITY_FAILED"])
        flat = with_bars(synth(), lambda bars: bars[-1].update({"non_b_uoedt": 3950.0}))  # U == L on the last bar
        self.assert_reading(run(flat), "INVALID", ["SANITY_FAILED"])
        older = with_bars(synth(), lambda bars: bars[3].update({"non_b_uoedt": 3900.0}))  # outside the window
        self.assertEqual(run(older)["status"], "VALID")

    def test_tier3_window_edges_strict_inequality_and_a_malformed_forming_bar(self):  # the H1 to H3 gaps found in MCD2
        def edited(index, **fields):
            return with_bars(synth(), lambda bars: bars[index].update(fields))

        # H1: 150 closed bars and N_micro 96, so index 54 is the first bar of the window and 53 is just outside it.
        self.assert_reading(run(edited(54, non_b_uoedt=3900.0)), "INVALID", ["SANITY_FAILED"])
        self.assertEqual(run(edited(53, non_b_uoedt=3900.0))["status"], "VALID")
        # H2: UOEDT == LOEDT fails on a window bar other than the last (the comparison is strict).
        self.assert_reading(run(edited(100, non_b_uoedt=3950.0)), "INVALID", ["SANITY_FAILED"])
        # H3: tier 3 reads closed bars only, so a malformed forming bar leaves the envelope byte-identical (R1).
        base = synth()
        forming = dict(thaw(base.bars)["M15"][-1], timestamp=floor_epoch(slot_to_epoch(SLOT), "M15"),
                       non_b_uoedt=3900.0, non_b_loedt=4000.0)
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
        self.assert_reading(run(synth(bars=50, containment=10.0)), "INVALID", ["CONTAINMENT_LOW"])  # tier 4 before tier 2
        inverted = with_bars(synth(bars=95), lambda bars: bars[-1].update({"non_b_uoedt": 3900.0}))
        self.assert_reading(run(inverted), "INVALID", ["INSUFFICIENT_BARS"])  # tier 2 before tier 3


class SlotTests(unittest.TestCase):
    def test_an_m15_reading_is_unchanged_at_the_five_and_ten_minute_slots(self):  # rule 1
        base = run(synth())
        for slot in ("2026-09-18T20:45Z", "2026-09-18T20:50Z"):
            with self.subTest(slot=slot):
                out = run(dataclasses.replace(synth(), cycle_slot=slot))
                self.assertEqual(out["last_closed_bar"], {"M15": "2026-09-18T20:30Z"})
                self.assertEqual(canonical_json({**out, "cycle_slot": SLOT}), canonical_json(base))


# --------------------------------------------------------------------------- the 13 pre-retrofit scenarios


class LegacyCases(unittest.TestCase):
    """Legacy tests 02 to 13, re-expressed. Legacy 01 is ``RealCycleTests``. The legacy numbers are kept where it
    helps: channel 4300..4400, baseline 4350, 96 bars."""

    CH = dict(upper=4400.0, lower=4300.0, baseline=4350.0)

    def test_legacy_02_micro_window_floor_percentage_and_custom_percentage(self):
        for t_edt, window in ((1808, 96), (545, 96), (3000, 150)):
            self.assertEqual(run(synth(t_edt=t_edt))["details"]["n_micro"], window)
        self.assertEqual(run(synth(bars=200), with_params(micro_window_pct=10.0))["details"]["n_micro"], 181)

    def test_legacy_03_to_07_the_five_synthesis_cases(self):
        cases = [
            # (legacy test, angle, latest Close, older breach bars, expected state, regime)
            ("03 UP + inside", 15.4, 4365.0, {}, "MCD1_UP_IN_CORRIDOR", "TREND_ALIGNED_CONTINUATION"),
            ("04 DOWN + below", -18.2, 4275.0, {}, "MCD1_DOWN_LOWER_BREAKDOWN", "BREAKOUT_SAME_SLOPE"),
            ("05 UP + above", 22.5, 4445.0, {}, "MCD1_UP_UPPER_BREAKOUT", "BREAKOUT_SAME_SLOPE"),
            ("06 UP + below sustained", 12.0, 4285.0, {"below": 96}, "MCD1_UP_LOWER_BREAKDOWN", "COUNTER_TREND_EXPANSION"),
            ("07a SIDEWAYS + inside", 1.2, 4350.0, {}, "MCD1_SIDEWAYS_IN_CORRIDOR", "CONSOLIDATION"),
            ("07b SIDEWAYS + above sustained", -2.1, 4430.0, {"above": 96}, "MCD1_SIDEWAYS_UPPER_BREAKOUT", "RANGE_EXPANSION"),
        ]
        for name, angle, latest, counts, state, regime in cases:
            with self.subTest(case=name):
                out = run(synth(angle=angle, latest=latest, **self.CH, **counts))
                self.assertEqual((out["status"], out["state_code"], out["regime_status"]), ("VALID", state, regime))

    def test_legacy_08_two_populated_indicators_is_no_longer_a_failure(self):
        out = run(stored_inputs("v4"))  # non_b is set and non_a is populated too: legacy UNIDENTIFIED
        self.assertEqual((out["status"], out["state_code"]), ("VALID", "MCD1_DOWN_IN_CORRIDOR"))
        self.assertEqual(out["details"]["populated_candidates"], {"M15": ["non_a"]})
        no_setting = dataclasses.replace(stored_inputs("v4"), active_indicator={})
        self.assertEqual((run(no_setting)["status"], run(no_setting)["status_reasons"]), ("INVALID", ["NO_SETTING"]))

    def test_legacy_09_an_indicator_without_data_is_not_read(self):
        out = run(with_indicator(stored_inputs("v1"), "best_fit_a"))
        self.assertEqual((out["status"], out["status_reasons"]), ("STALE", ["DETECTION_MISMATCH", "NO_STATS_AT_SLOT"]))
        stripped = with_bars(synth(), lambda bars: [bar.pop("non_b_ssa") for bar in bars])  # nothing populated at all
        out = run(stripped)
        self.assertEqual((out["status"], out["status_reasons"]), ("INVALID", ["DISCONTINUITY"]))

    def test_legacy_10_an_inverted_channel_is_rejected(self):
        inverted = with_bars(synth(), lambda bars: [bar.update({"non_b_uoedt": 4100.0, "non_b_loedt": 4200.0}) for bar in bars[-50:]])
        out = run(inverted)
        self.assertEqual((out["status"], out["status_reasons"]), ("INVALID", ["SANITY_FAILED"]))

    def test_legacy_11_a_compromised_corridor_is_a_status_never_a_state(self):
        low = run(synth(angle=-29.72, containment=35.5, **self.CH, t_edt=1808))  # legacy: trend UNIDENTIFIED, regime UNCERTAIN
        self.assertEqual((low["status"], low["status_reasons"], low["state_code"]), ("INVALID", ["CONTAINMENT_LOW"], None))
        missing = run(dataclasses.replace(synth(), statistics={}))
        self.assertEqual((missing["status"], missing["status_reasons"]), ("STALE", ["NO_STATS_AT_SLOT"]))

    def test_legacy_12_the_80_percent_share_filters_a_false_breakout(self):
        down = dict(angle=-25.0, latest=4450.0, containment=70.0, where="new", **self.CH)
        sustained = run(synth(above=80, **down))  # 16 bars inside, then 80 above (83.3%)
        self.assertEqual((sustained["state_code"], sustained["regime_status"]), ("MCD1_DOWN_UPPER_BREAKOUT", "COUNTER_TREND_EXPANSION"))
        self.assertEqual(sustained["details"]["upper_breach_count"], 80)
        filtered = run(synth(above=50, **down))  # 46 bars inside, then 50 above (52.1%)
        self.assertEqual((filtered["state_code"], filtered["regime_status"]), ("MCD1_DOWN_IN_CORRIDOR", "TREND_ALIGNED_CONTINUATION"))

    def test_legacy_13_a_same_slope_break_fires_on_the_latest_bar(self):  # ADR-023
        dump = run(synth(angle=-25.0, latest=4250.0, below=3, where="new", **self.CH))  # 3 of 96 bars below LOEDT
        self.assertEqual((dump["details"]["trend_direction"], dump["state_code"], dump["regime_status"]),
                         ("DOWN", "MCD1_DOWN_LOWER_BREAKDOWN", "BREAKOUT_SAME_SLOPE"))
        pump = run(synth(angle=25.0, latest=4450.0, above=2, where="new", **self.CH))  # 2 of 96 bars above UOEDT
        self.assertEqual((pump["details"]["trend_direction"], pump["state_code"], pump["regime_status"]),
                         ("UP", "MCD1_UP_UPPER_BREAKOUT", "BREAKOUT_SAME_SLOPE"))
        for out in (dump, pump):
            self.assertNotIn("V-shape", out["commentary"])  # the old forecast wording is gone
            self.assertLess(100 * (out["details"]["upper_breach_count"] + out["details"]["lower_breach_count"]), 80 * 96)

    def test_the_legacy_to_new_state_mapping_covers_all_nine_combinations(self):
        mapping = {
            ("UPTREND", "TREND_ALIGNED_CONTINUATION"): "MCD1_UP_IN_CORRIDOR",
            ("UPTREND", "BREAKOUT_SAME_SLOPE"): "MCD1_UP_UPPER_BREAKOUT",
            ("UPTREND", "COUNTER_TREND_EXPANSION"): "MCD1_UP_LOWER_BREAKDOWN",
            ("DOWNTREND", "TREND_ALIGNED_CONTINUATION"): "MCD1_DOWN_IN_CORRIDOR",
            ("DOWNTREND", "BREAKOUT_SAME_SLOPE"): "MCD1_DOWN_LOWER_BREAKDOWN",
            ("DOWNTREND", "COUNTER_TREND_EXPANSION"): "MCD1_DOWN_UPPER_BREAKOUT",
            ("SIDEWAYS", "CONSOLIDATION"): "MCD1_SIDEWAYS_IN_CORRIDOR",
        }
        for (_trend, regime), state in mapping.items():
            self.assertEqual(ev.STATES[state][1], regime, state)
        self.assertEqual({ev.STATES[s][1] for s in ("MCD1_SIDEWAYS_UPPER_BREAKOUT", "MCD1_SIDEWAYS_LOWER_BREAKDOWN")}, {"RANGE_EXPANSION"})


# --------------------------------------------------------------------------- T13: real cycles (legacy 01)

REAL = [
    # workbook, setting, state, bias, angle, containment, n_micro, above, below, channel position, populated, last closed bar, levels
    ("v1", "non_b", "MCD1_DOWN_UPPER_BREAKOUT", "LONG", -29.72, 73.95, 96, 96, 0, 1.6622, [], "2026-09-18T20:30Z", (4279.46, 4214.17, 4126.24)),
    ("v4", "non_b", "MCD1_DOWN_IN_CORRIDOR", "SHORT", -20.98, 93.17, 102, 0, 0, 0.1071, ["non_a"], "2026-09-28T23:00Z", (4307.72, 4214.0, 4103.45)),
    ("v4", "non_a", "MCD1_SIDEWAYS_LOWER_BREAKDOWN", "SHORT", -0.56, 91.01, 96, 0, 86, -0.6473, ["non_b"], "2026-09-28T23:00Z", (4396.99, 4303.47, 4232.07)),
]


class RealCycleTests(unittest.TestCase):
    def test_the_three_real_cycles(self):
        for name, indicator, state, bias, angle, containment, n, above, below, position, populated, last_bar, levels in REAL:
            with self.subTest(workbook=name, indicator=indicator):
                out = run(with_indicator(stored_inputs(name), indicator))
                self.assertEqual((out["status"], out["status_reasons"], out["state_code"], out["bias"]), ("VALID", [], state, bias))
                self.assertEqual(out["last_closed_bar"], {"M15": last_bar})
                self.assertEqual(out["active_indicator"], {"M15": indicator})
                self.assertEqual(list(out["config_hash"]), [indicator])
                d = out["details"]
                self.assertEqual((d["regression_angle_deg"], d["containment_rate"], d["n_micro"]), (angle, containment, n))
                self.assertEqual((d["upper_breach_count"], d["lower_breach_count"], d["channel_position"]), (above, below, position))
                self.assertEqual(d["populated_candidates"], {"M15": populated})
                self.assertEqual(tuple(lv["price"] for lv in out["levels"]), levels)
                self.assertEqual(schema_errors(out), [])

    def test_each_real_cycle_shows_a_different_state(self):
        self.assertEqual(len({state for (_n, _i, state, *_rest) in REAL}), 3)

    def test_legacy_01_v1_non_b_counter_trend_expansion(self):
        stored = stored_inputs("v1")
        row = stored.statistics[("M15", "non_b")]
        self.assertEqual((row["containment_n"], row["regression_angle"], row["containment_rate"]), (1808, -29.72, 73.95))
        out = run(stored)
        self.assertEqual(out["state_code"], "MCD1_DOWN_UPPER_BREAKOUT")
        self.assertEqual(out["regime_status"], "COUNTER_TREND_EXPANSION")
        d = out["details"]
        self.assertEqual((d["trend_direction"], d["n_micro"], d["upper_breach_count"]), ("DOWN", 96, 96))
        self.assertEqual(d["n_micro"] - d["upper_breach_count"] - d["lower_breach_count"], 0)  # legacy contained_bar_count
        self.assertGreater(d["channel_position"], 1.0)
        self.assertEqual(
            out["commentary"],
            "The M15 channel slopes down (-29.72°). The latest closed bar closed 101.47 above UOEDT 4279.46 "
            "(channel position 1.6622); 96 of the last 96 closed bars closed above UOEDT.",
        )
        self.assertNotIn("persistent counter-trend buying expansion", out["commentary"])  # the old forecast wording

    def test_the_stored_bundles_hold_closed_bars_only(self):
        for name, slot in SLOTS.items():
            bars = stored_inputs(name).bars["M15"]
            self.assertEqual(len(bars), 150)
            self.assertLessEqual(bars[-1]["timestamp"] + 900, slot_to_epoch(slot))
            self.assertEqual(bars[-1]["timestamp"], floor_epoch(slot_to_epoch(slot), "M15") - 900)
            self.assertEqual(len(stored_inputs(name).bars["M5"]), 1)

    def test_the_stored_statistics_hold_no_live_bar_field(self):
        for name in SLOTS:
            for row in stored_inputs(name).statistics.values():
                for field in ("live_bar_ts", "live_close", "uoedt_value", "loedt_value", "baseline_value", "channel_position"):
                    self.assertNotIn(field, row)


# --------------------------------------------------------------------------- shared checks T4 to T8, T10, T12


class _Shared(shared.SharedSensorChecks):
    """T4 forming bar, T5 wrong-slot statistics, T6 setting, T7 determinism, T8 schema, T10 never throws,
    T12 size and time, on each real cycle."""

    NAME = ""
    INDICATOR = ""

    def sensor(self):
        return shared.SensorUnderTest(ev.evaluate, with_indicator(stored_inputs(self.NAME), self.INDICATOR), PARAMS, {}, ("M15",))


class SharedV1NonB(_Shared, unittest.TestCase):
    NAME, INDICATOR = "v1", "non_b"


class SharedV4NonB(_Shared, unittest.TestCase):
    NAME, INDICATOR = "v4", "non_b"


class SharedV4NonA(_Shared, unittest.TestCase):
    NAME, INDICATOR = "v4", "non_a"


class NeverThrowsTests(unittest.TestCase):
    def test_t10_an_error_inside_the_evaluator_becomes_evaluator_error(self):
        broken = Params.from_dict(
            {
                "mcd_id": "MCD1",
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

    def test_the_evaluator_reads_m15_only_and_ignores_upstream(self):
        base = synth()
        junk = dataclasses.replace(base, bars={"M15": base.bars["M15"], "M5": ("garbage",)})
        self.assertEqual(canonical_json(run(junk)), canonical_json(run(base)))
        self.assertEqual(canonical_json(ev.evaluate(base, PARAMS, {"MCD2": {"status": "INVALID"}})), canonical_json(run(base)))


# --------------------------------------------------------------------------- T8, T9, T11, T12


class OutputTests(unittest.TestCase):
    def test_t8_every_state_and_every_failure_validates_against_the_schema(self):
        envelopes = list(all_states())
        envelopes += [run(dataclasses.replace(synth(), data_status=s)) for s in ("STALE", "Stale")]
        envelopes += [run(dataclasses.replace(synth(), retuning=True)), run(with_indicator(synth(), "best_fit_b"))]
        for envelope in envelopes:
            self.assertEqual(schema_errors(envelope), [], envelope["state_code"])

    def test_t9_the_stored_fixtures_replay_byte_for_byte(self):
        self.assertEqual(shared.check_replay(ev.evaluate, PARAMS, FIXTURES), 2)

    def test_the_output_file_is_the_v1_envelope(self):
        stem = provider.slot_file_stem(SLOTS["v1"])
        stored = (FIXTURES / f"{stem}.envelope.json").read_text(encoding="utf-8")
        self.assertEqual((HERE / "mcd1_output.json").read_text(encoding="utf-8"), stored)
        self.assertEqual(canonical_json(run(stored_inputs("v1")), pretty=True), stored)
        self.assertEqual(json.loads(stored)["state_code"], "MCD1_DOWN_UPPER_BREAKOUT")

    def test_numbers_are_rounded_to_two_decimals_at_output_only(self):
        # Inputs with more than two decimals: the state is decided on them as they are, the output is rounded half up.
        out = run(synth(angle=-29.725, containment=73.955, latest=4380.935, above=96, upper=4279.456, lower=4126.244, baseline=4214.174))
        self.assertEqual(out["state_code"], "MCD1_DOWN_UPPER_BREAKOUT")
        self.assertEqual((out["details"]["regression_angle_deg"], out["details"]["containment_rate"]), (-29.73, 73.96))
        self.assertEqual([lv["price"] for lv in out["levels"]], [4279.46, 4214.17, 4126.24])
        position = ((Decimal("4380.935") - Decimal("4126.244")) / (Decimal("4279.456") - Decimal("4126.244"))).quantize(
            Decimal("0.0001"), rounding=ROUND_HALF_UP
        )
        self.assertEqual(out["details"]["channel_position"], float(position))
        self.assertEqual(
            out["commentary"],
            f"The M15 channel slopes down (-29.73°). The latest closed bar closed 101.48 above UOEDT 4279.46 "
            f"(channel position {position}); 96 of the last 96 closed bars closed above UOEDT.",
        )

    def test_t11_no_banned_word_no_percent_no_advice_in_codes_templates_and_texts(self):
        envelopes = list(all_states())
        shared.assert_wording_clean(
            mcd_id="MCD1",
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
        legacy = (
            "massive pump with high probability of soon V-shape price reversal",
            "High probability of structural trend reversal",
            "96/96 bars = 100.0% >= 80.0% threshold",
        )
        for text in legacy:
            self.assertTrue(wording.check_text("legacy", text), text)

    def test_t12_the_largest_envelope_is_within_600_tokens(self):
        envelopes = list(all_states())
        envelopes.append(run(dataclasses.replace(synth(**NINE["MCD1_DOWN_UPPER_BREAKOUT"]), retuning=True)))
        for name, indicator in (("v1", "non_b"), ("v4", "non_b"), ("v4", "non_a")):
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
        return ast.parse((HERE / "mcd1_evaluator.py").read_text(encoding="utf-8"))

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
            "concept.md", "fixtures", "legacy", "mcd1.md", "mcd1_evaluator.py", "mcd1_implementation_plan.md",
            "mcd1_output.json", "mcd1_params.yaml", "mcd1_registry.yaml", "mcd1-manifest-work-completion.md",
            "test_mcd1_unit_tests.py",
        }
        # concept/ may be absent: MCD1 has no board (standard 11.1, plan section 4). If it exists it may not be empty.
        present = {p.name for p in HERE.iterdir() if p.name not in ("__pycache__", "concept")}
        self.assertEqual(present, expected)
        if (HERE / "concept").exists():
            self.assertTrue(any((HERE / "concept").iterdir()))
        self.assertEqual(sorted(p.name for p in (HERE / "legacy").iterdir() if p.name != "__pycache__"),
                         ["mcd1_evaluator.py", "mcd1_output.json", "test_mcd1_unit_tests.py"])
        self.assertEqual(sorted(p.name for p in FIXTURES.iterdir()),
                         [f"{provider.slot_file_stem(slot)}.{kind}" for slot in SLOTS.values() for kind in ("envelope.json", "inputs.json", "source.md")])


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
