"""Unit tests for MCD0 1.0.0 (standard section 12: T1 to T13; T14 is for derived MCDs only).

Run from ``davintrade-stack-d-and-e/engine-1-5-new/``::

    python -m unittest discover -s mcd0

Real-data tests read the stored fixtures (``fixtures/<slot>.inputs.json``), never a workbook. Only the provenance tests
open the replica workbooks, and they skip when a workbook is missing. The fixtures are written by ``write_fixtures()``::

    python -c "import sys; sys.path.insert(0, 'mcd0'); import test_mcd0_unit_tests as t; t.write_fixtures()"

MCD0 is a gate that reads no bar: the shared T6 and T10 are overridden below (``_Shared``), as plan section 3.1 says.
"""

from __future__ import annotations

import ast
import dataclasses
import hashlib
import json
import logging
import math
import re
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

import mcd0_evaluator as ev  # noqa: E402
from mcd_common import excel_fixture_provider as provider  # noqa: E402
from mcd_common import reason_codes as rc  # noqa: E402
from mcd_common import testing as shared  # noqa: E402
from mcd_common import wording  # noqa: E402
from mcd_common.cycle_inputs import (  # noqa: E402
    CycleInputs,
    Params,
    slot_to_epoch,
    stats_slot_for,
    statistics_source,
    thaw,
)
from mcd_common.envelope import canonical_json, schema_errors  # noqa: E402

# The evaluator logs the exception behind EVALUATOR_ERROR; keep the test output quiet.
logging.getLogger("mcd").addHandler(logging.NullHandler())

FIXTURES = HERE / "fixtures"
PARAMS = Params.from_yaml(str(HERE / "mcd0_params.yaml"))
REGISTRY = yaml.safe_load((HERE / "mcd0_registry.yaml").read_text(encoding="utf-8"))
SPEC = (HERE / "mcd0.md").read_text(encoding="utf-8")

SLOTS = {"v1": "2026-09-18T20:55Z", "v3": "2026-09-28T14:15Z", "v4": "2026-09-28T23:15Z"}
SETTINGS = {name: ENGINE / "mcd_common" / "fixtures" / f"settings_{name}.yaml" for name in SLOTS}
WORKBOOKS = {
    "v1": ENGINE / "market_data_v6_replicated.xlsx",
    "v3": STACK / "market_data_v6_replicated_v3.xlsx",
    "v4": STACK / "market_data_v6_replicated_v4.xlsx",
}
FIXTURE_COLUMNS = ("close",)  # MCD0 reads no bar; the shared T4 needs one closed bar per timeframe to copy
FIXTURE_BARS = {"M5": 1, "M15": 1}
TIMEFRAMES = ("M5", "M15")

# Required statistics fields, written out here from spec section 3 (not read from the evaluator, so a field dropped from
# the evaluator's list is caught): every source, then the seven centroid sources only.
REQUIRED_COMMON = (
    "window_span_bars", "regression_angle", "model_b_r2", "model_b_mse", "model_b_skew",
    "uoedt_offset", "loedt_offset", "channel_width",
)
REQUIRED_MODEL_A = ("model_a_r2", "model_a_mse", "model_a_skew")

FORBIDDEN_REASONS = {rc.INSUFFICIENT_BARS, rc.DISCONTINUITY, rc.CONTAINMENT_LOW, rc.DETECTION_MISMATCH}

# --------------------------------------------------------------------------- fixtures


def fresh_bundle(name: str):
    """The bundle the kit's provider builds from the frozen workbook (settings from the kit's settings file)."""
    return provider.build_cycle_inputs_with_report(
        WORKBOOKS[name], SETTINGS[name], columns=FIXTURE_COLUMNS, max_bars=FIXTURE_BARS
    )


def write_fixtures() -> None:
    """Write ``fixtures/<slot>.{inputs,envelope}.json``, ``<slot>.source.md`` and ``mcd0_output.json``."""
    for name in SLOTS:
        inputs, report = fresh_bundle(name)
        envelope = ev.evaluate(inputs, PARAMS, {})
        provider.write_fixture_files(FIXTURES, inputs, report, envelope, base_dir=ENGINE)
        if name == "v1":
            (HERE / "mcd0_output.json").write_text(canonical_json(envelope, pretty=True), encoding="utf-8", newline="\n")


def stored_inputs(name: str) -> CycleInputs:
    return provider.load_inputs(FIXTURES / f"{provider.slot_file_stem(SLOTS[name])}.inputs.json")


def with_settings(inputs: CycleInputs, *, m5: str | None = None, m15: str | None = None) -> CycleInputs:
    settings = thaw(inputs.active_indicator)
    if m5 is not None:
        settings["M5"] = m5
    if m15 is not None:
        settings["M15"] = m15
    return dataclasses.replace(inputs, active_indicator=settings)


# --------------------------------------------------------------------------- synthetic bundles

SLOT = "2026-09-18T20:55Z"
LAST_OPEN = {"M5": slot_to_epoch(SLOT) - 300, "M15": slot_to_epoch(SLOT) - 1500}  # last closed bars open 20:50 and 20:30
DROP = object()  # remove a field

# A statistics row that meets every pillar: coverage 499 closed bars, R2 0.80 / 0.75, fit ratio 2.0 for both models
# (half width 30, sqrt(225) = 15), geo ratio 1.0, skew 0.20 / -0.30, angle 12 degrees (not flat).
GOOD_ROW = {
    "window_span_bars": 500,
    "regression_angle": 12.0,
    "model_a_r2": 0.80,
    "model_a_mse": 225.0,
    "model_a_skew": 0.20,
    "model_a_var_ratio": 1.1,
    "model_a_kurt": 2.5,
    "model_b_r2": 0.75,
    "model_b_mse": 225.0,
    "model_b_skew": -0.30,
    "model_b_var_ratio": 1.2,
    "model_b_kurt": 2.6,
    "uoedt_offset": 30.0,
    "loedt_offset": -30.0,
    "channel_width": 60.0,
}


def good_row(source: str, **changes) -> dict:
    row = dict(GOOD_ROW)
    if source == "fractal_edt":  # the fractal EDT has no Model A values
        for name in list(row):
            if name.startswith("model_a_"):
                row[name] = None
    for name, value in changes.items():
        if value is DROP:
            row.pop(name, None)
        else:
            row[name] = value
    return row


def synth(*, m5: str = "best_fit_a", m15: str = "non_b", m5_row: dict | None = None, m15_row: dict | None = None) -> CycleInputs:
    """A valid bundle for slot 20:55 with one closed bar per timeframe (the shared T4 needs one) and a good statistics
    row for each timeframe's active source. ``m5_row`` and ``m15_row`` replace the default rows."""
    settings = {"M5": m5, "M15": m15}
    statistics = {}
    for tf, row in (("M5", m5_row), ("M15", m15_row)):
        source = statistics_source(settings[tf])
        base = good_row(source)
        base.update(
            {"timeframe": tf, "source": source, "captured_at": slot_to_epoch(stats_slot_for(SLOT, tf))}
        )
        for name, value in (row or {}).items():
            if value is DROP:
                base.pop(name, None)
            else:
                base[name] = value
        statistics[(tf, source)] = base
    return CycleInputs(
        symbol="XAUUSD",
        cycle_slot=SLOT,
        data_status="FRESH",
        retuning=False,
        bars={tf: [{"timestamp": LAST_OPEN[tf], "close": 4005.0}] for tf in TIMEFRAMES},
        statistics=statistics,
        stats_slot={tf: stats_slot_for(SLOT, tf) for tf in TIMEFRAMES},
        active_indicator=settings,
        config_hash={statistics_source(settings[tf]): f"hash-{tf}" for tf in TIMEFRAMES},
        channel_mode={statistics_source(settings[tf]): "dynamic" for tf in TIMEFRAMES},
    )


def with_row(inputs: CycleInputs, tf: str, **changes) -> CycleInputs:
    stats = thaw(dict(inputs.statistics))
    key = (tf, statistics_source(inputs.active_indicator[tf]))
    row = dict(stats[key])
    for name, value in changes.items():
        if value is DROP:
            row.pop(name, None)
        else:
            row[name] = value
    stats[key] = row
    return dataclasses.replace(inputs, statistics=stats)


def with_params(**changes) -> Params:
    return dataclasses.replace(PARAMS, values={**PARAMS.values, **changes})


def run(inputs: CycleInputs, params: Params = PARAMS) -> dict:
    return ev.evaluate(inputs, params, {})


def failed(out: dict, tf: str) -> list:
    return out["details"][tf]["failed"]


def skipped(out: dict, tf: str) -> list:
    return out["details"][tf]["skipped"]


# --------------------------------------------------------------------------- the register (T1 setup, A10, A11, A20)


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
            self.assertEqual(entry["levels"], [], code)
        self.assertEqual(dict(ev.TEMPLATES), REGISTRY["commentary_templates"])
        self.assertEqual(list(ev.PILLAR_ORDER), REGISTRY["pillar_order"])
        self.assertEqual(dict(ev.PILLAR_LABELS), REGISTRY["pillar_labels"])

    def test_the_register_is_exhaustive_and_exclusive_and_every_bias_is_neutral(self):
        self.assertEqual(
            set(ev.STATES), {"MCD0_ALL_QUALIFIED", "MCD0_M5_DEFECT", "MCD0_M15_DEFECT", "MCD0_M5_M15_DEFECT"}
        )
        self.assertEqual(len(REGISTRY["states"]), 4)
        for code, (bias, regime, summary, _template) in ev.STATES.items():
            self.assertEqual((bias, regime), ("NEUTRAL", None), code)
            self.assertLessEqual(len(summary), 80, code)
            self.assertLessEqual(len(code), 48, code)

    def test_registry_and_params_describe_this_evaluator(self):
        self.assertEqual(REGISTRY["mcd_id"], ev.MCD_ID)
        self.assertEqual(REGISTRY["evaluator_version"], ev.EVALUATOR_VERSION)
        self.assertEqual((PARAMS.mcd_id, PARAMS.evaluator_version), (ev.MCD_ID, ev.EVALUATOR_VERSION))
        self.assertEqual(REGISTRY["kind"], "gate")
        self.assertEqual(REGISTRY["timeframes"], ["M5", "M15"])
        self.assertEqual(REGISTRY["depends_on"], [])
        self.assertEqual(REGISTRY["uses_channel"], [])
        self.assertEqual(REGISTRY["rung"], {})
        self.assertEqual(REGISTRY["flag"], "off")
        self.assertEqual(
            set(PARAMS.values),
            {
                "min_coverage_bars", "t_edt_open_bar_rows", "min_r2_model_a", "min_r2_model_b", "flat_angle_deg",
                "min_fit_ratio", "max_fit_ratio", "min_geo_ratio", "max_geo_ratio", "max_abs_skew",
                "ratio_decimals", "statistic_decimals",
            },
        )

    def test_every_threshold_of_spec_section_6_is_in_the_parameters_once_with_the_same_value(self):
        section = SPEC[SPEC.index("## 6. Calculation") : SPEC.index("## 7. State register")]
        rows = dict(re.findall(r"^\| `([a-z0-9_]+)`\s+\| ([0-9.]+) ", section, flags=re.M))
        in_spec = {name: float(value) for name, value in rows.items() if name in PARAMS.values}
        self.assertEqual(set(in_spec), set(PARAMS.values))
        for name, value in in_spec.items():
            self.assertEqual(float(PARAMS[name]), value, name)

    def test_every_parameter_carries_value_unit_boundary_and_why(self):
        for name, meta in PARAMS.meta.items():
            for field in ("unit", "boundary", "why"):
                self.assertTrue(str(meta[field]).strip(), (name, field))

    def test_the_values_are_the_settled_thresholds(self):
        # ADR-019, architecture 2.4 and file C: R2 A 0.70 and B 0.65, fit ratio 1.50 to 3.20, geo ratio 0.60 to 1.65,
        # skew 1.50, coverage 60 (decisions (a) and (d): one open-bar row, flat band 5 degrees).
        self.assertEqual(
            (PARAMS["min_coverage_bars"], PARAMS["t_edt_open_bar_rows"], PARAMS["min_r2_model_a"], PARAMS["min_r2_model_b"],
             PARAMS["flat_angle_deg"], PARAMS["min_fit_ratio"], PARAMS["max_fit_ratio"], PARAMS["min_geo_ratio"],
             PARAMS["max_geo_ratio"], PARAMS["max_abs_skew"]),
            (60, 1, 0.70, 0.65, 5.0, 1.50, 3.20, 0.60, 1.65, 1.50),
        )


# --------------------------------------------------------------------------- T1: one test per state


class StateTests(unittest.TestCase):
    """T1. Four states from synthetic bundles; the two with a real example are also in ``RealCycleTests``."""

    def assert_reading(self, out, *, state, m5_failed, m15_failed, commentary):
        self.assertEqual((out["status"], out["status_reasons"]), ("VALID", []))
        self.assertEqual(out["state_code"], state)
        self.assertEqual((out["bias"], out["regime_status"], out["levels"], out["depends_on"]), ("NEUTRAL", None, [], []))
        self.assertEqual(out["summary_line"], ev.STATES[state][2])
        self.assertEqual(out["commentary"], commentary)
        self.assertEqual(failed(out, "M5"), m5_failed)
        self.assertEqual(failed(out, "M15"), m15_failed)
        self.assertEqual(out["last_closed_bar"], {})
        self.assertEqual(out["active_indicator"], {"M5": "best_fit_a", "M15": "non_b"})
        self.assertEqual(sorted(out["config_hash"]), ["best_fit_a", "non_b"])
        self.assertEqual(schema_errors(out), [])

    def test_01_all_qualified(self):
        out = run(synth())
        self.assert_reading(
            out, state="MCD0_ALL_QUALIFIED", m5_failed=[], m15_failed=[],
            commentary="The M5 channel (best_fit_a) and the M15 channel (non_b) meet every fit criterion.",
        )
        self.assertEqual(skipped(out, "M5"), [])
        self.assertEqual(skipped(out, "M15"), [])

    def test_02_m5_defect(self):
        out = run(synth(m5_row={"model_a_r2": 0.60}))
        self.assert_reading(
            out, state="MCD0_M5_DEFECT", m5_failed=["R2_A"], m15_failed=[],
            commentary="The M5 channel (best_fit_a) misses fit criteria: R2. The M15 channel (non_b) meets every fit criterion.",
        )

    def test_03_m15_defect(self):
        out = run(synth(m15_row={"model_b_skew": 1.8}))
        self.assert_reading(
            out, state="MCD0_M15_DEFECT", m5_failed=[], m15_failed=["SKEW_B"],
            commentary="The M15 channel (non_b) misses fit criteria: skew. The M5 channel (best_fit_a) meets every fit criterion.",
        )

    def test_04_m5_and_m15_defect(self):
        out = run(synth(m5_row={"window_span_bars": 30, "uoedt_offset": 90.0}, m15_row={"model_a_mse": 8100.0, "model_b_r2": 0.1}))
        self.assert_reading(
            out, state="MCD0_M5_M15_DEFECT", m5_failed=["COVERAGE", "GEO"], m15_failed=["R2_B", "FIT_A"],
            commentary="The M5 channel (best_fit_a) misses fit criteria: coverage, geo ratio. "
            "The M15 channel (non_b) misses fit criteria: R2, fit ratio.",
        )

    def test_the_commentary_names_each_criterion_once_even_when_both_models_fail(self):
        out = run(synth(m5_row={"model_a_r2": 0.1, "model_b_r2": 0.1, "model_a_skew": 3.0, "model_b_skew": -3.0}))
        self.assertEqual(failed(out, "M5"), ["R2_A", "R2_B", "SKEW_A", "SKEW_B"])
        self.assertIn("misses fit criteria: R2, skew.", out["commentary"])

    def test_the_two_models_of_one_criterion_fail_independently(self):
        # Same value, different bound: R2 0.69 fails Model A (0.70) and passes Model B (0.65).
        out = run(synth(m5_row={"model_a_r2": 0.69, "model_b_r2": 0.69}))
        self.assertEqual(failed(out, "M5"), ["R2_A"])

    def test_a_sweep_agrees_with_an_independent_classifier(self):
        reached = set()
        for m5_bad in (False, True):
            for m15_bad in (False, True):
                out = run(synth(m5_row={"model_b_r2": 0.0} if m5_bad else None, m15_row={"model_a_r2": 0.0} if m15_bad else None))
                want = {(False, False): "ALL_QUALIFIED", (True, False): "M5_DEFECT", (False, True): "M15_DEFECT", (True, True): "M5_M15_DEFECT"}
                self.assertEqual(out["state_code"], f"MCD0_{want[(m5_bad, m15_bad)]}")
                reached.add(out["state_code"])
        self.assertEqual(reached, set(ev.STATES))


# --------------------------------------------------------------------------- T2: boundaries just below, at and just above


class BoundaryTests(unittest.TestCase):
    def verdict(self, tf="M5", **changes):
        row = {tf: changes}
        return run(synth(m5_row=row.get("M5"), m15_row=row.get("M15")))

    def test_coverage_counts_closed_bars_and_passes_at_60(self):
        for span, closed, passes in ((59, 58, False), (60, 59, False), (61, 60, True), (62, 61, True)):
            out = self.verdict(window_span_bars=span)
            self.assertEqual(out["details"]["M5"]["coverage"], closed, span)
            self.assertEqual("COVERAGE" in failed(out, "M5"), not passes, span)

    def test_the_open_bar_row_parameter_moves_the_coverage_boundary(self):
        for rows, span, passes in ((0, 60, True), (0, 59, False), (2, 62, True), (2, 61, False)):
            out = run(synth(m5_row={"window_span_bars": span}), with_params(t_edt_open_bar_rows=rows))
            self.assertEqual("COVERAGE" in failed(out, "M5"), not passes, (rows, span))

    def test_the_coverage_bound_is_a_parameter(self):
        out = run(synth(m5_row={"window_span_bars": 100}), with_params(min_coverage_bars=100))
        self.assertIn("COVERAGE", failed(out, "M5"))  # 99 closed bars against 100
        out = run(synth(m5_row={"window_span_bars": 101}), with_params(min_coverage_bars=100))
        self.assertNotIn("COVERAGE", failed(out, "M5"))

    def test_r2_model_a_at_0_70(self):
        for value, passes in ((0.6999, False), (0.70, True), (0.7001, True)):
            self.assertEqual("R2_A" in failed(self.verdict(model_a_r2=value), "M5"), not passes, value)

    def test_r2_model_b_at_0_65(self):
        for value, passes in ((0.6499, False), (0.65, True), (0.6501, True)):
            self.assertEqual("R2_B" in failed(self.verdict(model_b_r2=value), "M5"), not passes, value)

    def test_the_fit_ratio_lower_bound_is_1_5_inclusive(self):
        # W = 6 and MSE = 4: (6 / 2) / sqrt(4) is exactly 1.5.
        base = dict(channel_width=6.0, uoedt_offset=3.0, loedt_offset=-3.0)
        for mse, passes in ((4.0001, False), (4.0, True), (3.9999, True)):
            out = self.verdict(model_a_mse=mse, model_b_mse=mse, **base)
            self.assertEqual("FIT_A" in failed(out, "M5"), not passes, mse)
            self.assertEqual("FIT_B" in failed(out, "M5"), not passes, mse)

    def test_the_fit_ratio_upper_bound_is_3_2_inclusive(self):
        # W = 32 and MSE = 25: (32 / 2) / sqrt(25) is exactly 3.2.
        base = dict(channel_width=32.0, uoedt_offset=16.0, loedt_offset=-16.0)
        for mse, passes in ((24.999, False), (25.0, True), (25.001, True)):
            out = self.verdict(model_a_mse=mse, model_b_mse=mse, **base)
            self.assertEqual("FIT_A" in failed(out, "M5"), not passes, mse)
            self.assertEqual("FIT_B" in failed(out, "M5"), not passes, mse)

    def test_each_model_uses_its_own_mse(self):
        # Half width 30: Model A MSE 225 gives 2.0 (passes); Model B MSE 3600 gives 0.5 (fails). Decision (b).
        out = self.verdict(model_a_mse=225.0, model_b_mse=3600.0)
        self.assertEqual(failed(out, "M5"), ["FIT_B"])
        out = self.verdict(model_a_mse=3600.0, model_b_mse=225.0)
        self.assertEqual(failed(out, "M5"), ["FIT_A"])
        values = out["details"]["M5"]
        self.assertEqual((values["model_a"]["fit_ratio"], values["model_b"]["fit_ratio"]), (0.5, 2.0))

    def test_the_geo_ratio_is_inclusive_at_0_6_and_1_65(self):
        for up, lo, passes in ((0.5999, -1.0, False), (3.0, -5.0, True), (0.6001, -1.0, True),
                               (1.6499, -1.0, True), (33.0, -20.0, True), (1.6501, -1.0, False)):
            out = self.verdict(uoedt_offset=up, loedt_offset=lo)
            self.assertEqual("GEO" in failed(out, "M5"), not passes, (up, lo))

    def test_the_geo_ratio_is_the_upper_offset_over_the_lower_offset(self):
        out = self.verdict(uoedt_offset=3.0, loedt_offset=-5.0)
        self.assertEqual(out["details"]["M5"]["geo_ratio"], 0.6)

    def test_skew_is_inclusive_at_1_5_for_each_model_and_both_signs(self):
        for value, passes in ((1.49, True), (1.5, True), (1.51, False), (-1.49, True), (-1.5, True), (-1.51, False)):
            self.assertEqual("SKEW_A" in failed(self.verdict(model_a_skew=value), "M5"), not passes, value)
            self.assertEqual("SKEW_B" in failed(self.verdict(model_b_skew=value), "M5"), not passes, value)

    def test_a_flat_channel_skips_r2_at_and_inside_5_degrees_and_applies_it_beyond(self):
        bad = dict(model_a_r2=0.0, model_b_r2=0.0)
        for angle, flat in ((-5.01, False), (-5.0, True), (0.0, True), (5.0, True), (5.01, False)):
            out = self.verdict(regression_angle=angle, **bad)
            if flat:
                self.assertEqual((failed(out, "M5"), skipped(out, "M5")), ([], ["R2_A", "R2_B"]), angle)
            else:
                self.assertEqual((failed(out, "M5"), skipped(out, "M5")), (["R2_A", "R2_B"], []), angle)

    def test_the_flat_band_is_a_parameter(self):
        out = run(synth(m5_row=dict(regression_angle=8.0, model_a_r2=0.0, model_b_r2=0.0)), with_params(flat_angle_deg=10.0))
        self.assertEqual(skipped(out, "M5"), ["R2_A", "R2_B"])

    def test_a_flat_channel_with_a_bad_fit_still_fails_the_other_pillars(self):
        out = self.verdict(regression_angle=0.5, model_a_r2=-0.3, model_b_r2=-0.3, model_a_mse=3600.0)
        self.assertEqual((failed(out, "M5"), skipped(out, "M5")), (["FIT_A"], ["R2_A", "R2_B"]))
        self.assertEqual(out["state_code"], "MCD0_M5_DEFECT")

    def test_a_flat_channel_with_every_other_pillar_good_qualifies(self):
        out = self.verdict(regression_angle=-0.56, model_a_r2=-0.0856, model_b_r2=-0.1572)
        self.assertEqual(out["state_code"], "MCD0_ALL_QUALIFIED")

    def test_the_bounds_are_parameters(self):
        self.assertEqual(failed(run(synth(m5_row={"model_a_r2": 0.75}), with_params(min_r2_model_a=0.80)), "M5"), ["R2_A"])
        self.assertEqual(failed(run(synth(m5_row={"model_b_r2": 0.75}), with_params(min_r2_model_b=0.80)), "M5"), ["R2_B"])
        self.assertEqual(failed(run(synth(), with_params(min_fit_ratio=2.5)), "M5"), ["FIT_A", "FIT_B"])
        self.assertEqual(failed(run(synth(), with_params(max_fit_ratio=1.5)), "M5"), ["FIT_A", "FIT_B"])
        self.assertEqual(failed(run(synth(), with_params(min_geo_ratio=1.2)), "M5"), ["GEO"])
        self.assertEqual(failed(run(synth(), with_params(max_geo_ratio=0.9)), "M5"), ["GEO"])
        self.assertEqual(failed(run(synth(), with_params(max_abs_skew=0.1)), "M5"), ["SKEW_A", "SKEW_B"])

    def test_the_verdict_is_decided_on_the_unrounded_values(self):
        # R2 0.699999 fails 0.70 and is shown as 0.7 (four decimals); R2 0.700001 passes.
        out = self.verdict(model_a_r2=0.699999)
        self.assertEqual((failed(out, "M5"), out["details"]["M5"]["model_a"]["r2"]), (["R2_A"], 0.7))
        self.assertEqual(failed(self.verdict(model_a_r2=0.700001), "M5"), [])


# --------------------------------------------------------------------------- the decisions (a), (d) to (g), (j) as tests


class DecisionTests(unittest.TestCase):
    def test_e_the_fractal_edt_has_no_model_a_and_is_judged_on_model_b_alone(self):
        out = run(synth(m5="fractal"))
        self.assertEqual((out["state_code"], failed(out, "M5")), ("MCD0_ALL_QUALIFIED", []))
        self.assertEqual(skipped(out, "M5"), ["R2_A", "FIT_A", "SKEW_A"])
        self.assertIsNone(out["details"]["M5"]["model_a"])
        self.assertIsNotNone(out["details"]["M5"]["model_b"])
        self.assertEqual(out["active_indicator"], {"M5": "fractal", "M15": "non_b"})
        self.assertEqual(sorted(out["config_hash"]), ["fractal_edt", "non_b"])

    def test_e_the_fractal_edt_still_fails_on_model_b_coverage_and_geo(self):
        out = run(synth(m5="fractal", m5_row={"model_b_r2": 0.1, "window_span_bars": 40, "uoedt_offset": 10.0, "loedt_offset": -50.0}))
        self.assertEqual(failed(out, "M5"), ["COVERAGE", "R2_B", "GEO"])
        self.assertEqual(out["state_code"], "MCD0_M5_DEFECT")

    def test_e_model_a_values_on_a_fractal_row_are_not_read(self):
        row = {"model_a_r2": -9.0, "model_a_mse": 0.0, "model_a_skew": 9.0}
        out = run(synth(m5="fractal", m5_row=row))
        self.assertEqual((out["status"], out["state_code"]), ("VALID", "MCD0_ALL_QUALIFIED"))
        self.assertIsNone(out["details"]["M5"]["model_a"])

    def test_e_a_flat_fractal_skips_r2_for_both_models(self):
        out = run(synth(m5="fractal", m5_row={"regression_angle": 1.0, "model_b_r2": -1.0}))
        self.assertEqual((failed(out, "M5"), skipped(out, "M5")), ([], ["R2_A", "R2_B", "FIT_A", "SKEW_A"]))

    def test_e_the_rule_follows_the_source_name_for_every_candidate(self):
        for candidate in ("best_fit_a", "best_fit_b", "cherry_a", "cherry_b", "most_recent", "non_a", "non_b"):
            out = run(synth(m5=candidate, m15=candidate))
            for tf in TIMEFRAMES:
                self.assertEqual((failed(out, tf), skipped(out, tf)), ([], []), (candidate, tf))
                self.assertIsNotNone(out["details"][tf]["model_a"], (candidate, tf))
        out = run(synth(m5="fractal"))
        self.assertIsNone(out["details"]["M5"]["model_a"])

    def test_i_a_centroid_without_model_a_values_is_sanity_failed(self):
        for name in ("model_a_r2", "model_a_mse", "model_a_skew"):
            for value in (None, DROP):
                out = run(synth(m5_row={name: value}))
                self.assertEqual((out["status"], out["status_reasons"]), ("INVALID", ["SANITY_FAILED"]), (name, value))

    def test_f_the_information_fields_are_values_and_never_a_failure(self):
        out = run(synth())
        a, b = out["details"]["M5"]["model_a"], out["details"]["M5"]["model_b"]
        self.assertEqual((a["var_ratio"], a["kurtosis"], b["var_ratio"], b["kurtosis"]), (1.1, 2.5, 1.2, 2.6))
        base = canonical_json(run(synth()))
        for name in ("model_a_var_ratio", "model_a_kurt", "model_b_var_ratio", "model_b_kurt"):
            for value in (None, DROP, "x", True, float("nan")):
                out = run(synth(m5_row={name: value}))
                self.assertEqual((out["status"], out["state_code"]), ("VALID", "MCD0_ALL_QUALIFIED"), (name, value))
                d = out["details"]["M5"]["model_a" if "model_a" in name else "model_b"]
                self.assertIsNone(d["var_ratio" if "var" in name else "kurtosis"], (name, value))
        self.assertNotEqual(base, canonical_json(run(synth(m5_row={"model_a_kurt": None}))))

    def test_f_the_information_fields_are_rounded_to_two_decimals_at_output_only(self):
        out = run(synth(m5_row={"model_a_var_ratio": 1.2349, "model_b_kurt": 2.675}))
        self.assertEqual((out["details"]["M5"]["model_a"]["var_ratio"], out["details"]["M5"]["model_b"]["kurtosis"]), (1.23, 2.68))

    def test_g_tier_1_is_the_setting_only_and_never_a_detection_mismatch(self):
        # The setting names a candidate that has no statistics row: STALE, not CAUTIONARY + DETECTION_MISMATCH.
        for m5, m15 in (("best_fit_b", "non_b"), ("best_fit_a", "non_a")):
            base = synth()
            inputs = dataclasses.replace(base, active_indicator={"M5": m5, "M15": m15})
            out = run(inputs)
            self.assertEqual((out["status"], out["status_reasons"]), ("STALE", ["NO_STATS_AT_SLOT"]), (m5, m15))

    def test_g_the_bars_are_not_read(self):
        base = run(synth())
        inputs = synth()
        for bars in ({}, {"M5": [], "M15": []}, {"M5": ("garbage",), "M15": ("garbage",)}, None):
            changed = dataclasses.replace(inputs, bars=bars)
            self.assertEqual(canonical_json(run(changed)), canonical_json(base), repr(bars))
        # A forming bar, many bars, and a bar with every column null change nothing either.
        many = {tf: [{"timestamp": LAST_OPEN[tf] - 300 * i, "close": None} for i in range(5)] for tf in TIMEFRAMES}
        self.assertEqual(canonical_json(run(dataclasses.replace(inputs, bars=many))), canonical_json(base))

    def test_j_containment_is_not_tested_and_not_read(self):
        base = canonical_json(run(synth()))
        for value in (0.0, 10.0, 49.99, None, "x"):
            out = run(synth(m5_row={"containment_rate": value}, m15_row={"containment_rate": value}))
            self.assertEqual(canonical_json(out), base, value)
        out = run(synth(m5_row={"containment_rate": DROP}))
        self.assertEqual(out["status"], "VALID")

    def test_a_coverage_is_in_closed_bars(self):
        out = run(synth(m5_row={"window_span_bars": 755}))
        self.assertEqual(out["details"]["M5"]["coverage"], 754)

    def test_h_one_unreadable_timeframe_makes_the_whole_envelope_unavailable(self):
        out = run(synth(m5_row={"model_a_mse": 0.0}, m15_row={"model_a_r2": 0.0}))  # M5 unreadable, M15 a defect
        self.assertEqual((out["status"], out["state_code"], out["bias"], out["details"]), ("INVALID", None, None, {}))


# --------------------------------------------------------------------------- T3: pre-flight failures


class PreflightTests(unittest.TestCase):
    def assert_unavailable(self, out, status, reasons):
        self.assertEqual((out["status"], out["status_reasons"]), (status, reasons))
        self.assertEqual((out["state_code"], out["bias"], out["levels"], out["details"]), (None, None, [], {}))
        self.assertEqual(out["last_closed_bar"], {})
        self.assertEqual(schema_errors(out), [])

    def test_an_unknown_data_status_is_sanity_failed(self):
        for value in (None, "Stale", "fresh", ""):
            self.assert_unavailable(run(dataclasses.replace(synth(), data_status=value)), "INVALID", ["SANITY_FAILED"])

    def test_a_stale_cycle_is_data_stale(self):
        self.assert_unavailable(run(dataclasses.replace(synth(), data_status="STALE")), "STALE", ["DATA_STALE"])

    def test_delayed_and_market_closed_cycles_are_read(self):
        for status in ("FRESH", "DELAYED", "MARKET_CLOSED"):
            out = run(dataclasses.replace(synth(), data_status=status))
            self.assertEqual((out["status"], out["state_code"]), ("VALID", "MCD0_ALL_QUALIFIED"), status)

    def test_a_retuning_cycle_is_cautionary_and_keeps_its_state_and_details(self):
        out = run(dataclasses.replace(synth(m5_row={"model_a_r2": 0.1}), retuning=True))
        self.assertEqual((out["status"], out["status_reasons"], out["state_code"]), ("CAUTIONARY", ["RETUNING"], "MCD0_M5_DEFECT"))
        self.assertEqual(failed(out, "M5"), ["R2_A"])
        self.assertEqual((out["bias"], out["levels"]), ("NEUTRAL", []))
        self.assertEqual(schema_errors(out), [])

    def test_retuning_stays_in_front_of_a_later_stop(self):
        inputs = dataclasses.replace(synth(), retuning=True)
        stats = thaw(dict(inputs.statistics))
        del stats[("M15", "non_b")]
        self.assert_unavailable(run(dataclasses.replace(inputs, statistics=stats)), "STALE", ["RETUNING", "NO_STATS_AT_SLOT"])

    def test_no_setting_for_either_timeframe(self):
        for tf in TIMEFRAMES:
            settings = thaw(synth().active_indicator)
            del settings[tf]
            self.assert_unavailable(run(dataclasses.replace(synth(), active_indicator=settings)), "INVALID", ["NO_SETTING"])

    def test_a_setting_that_is_not_a_candidate_of_the_timeframe(self):
        for settings in ({"M5": "nonsense", "M15": "non_b"}, {"M5": "best_fit_a", "M15": "fractal"},
                         {"M5": 5, "M15": "non_b"}, {"M5": "best_fit_a", "M15": None}, {"M5": "fractal_edt", "M15": "non_b"}):
            self.assert_unavailable(run(dataclasses.replace(synth(), active_indicator=settings)), "INVALID", ["NO_SETTING"])

    def test_no_statistics_row_at_the_slot_on_either_timeframe(self):
        for tf, source in (("M5", "best_fit_a"), ("M15", "non_b")):
            stats = thaw(dict(synth().statistics))
            del stats[(tf, source)]
            self.assert_unavailable(run(dataclasses.replace(synth(), statistics=stats)), "STALE", ["NO_STATS_AT_SLOT"])

    def test_a_row_from_another_slot_is_stale(self):
        for tf, source in (("M5", "best_fit_a"), ("M15", "non_b")):
            inputs = with_row(synth(), tf, captured_at=slot_to_epoch(stats_slot_for(SLOT, tf)) - 900)
            self.assert_unavailable(run(inputs), "STALE", ["NO_STATS_AT_SLOT"])

    def test_every_required_field_must_be_a_number(self):
        for source_case, kwargs in (("centroid", dict()), ("fractal", dict(m5="fractal"))):
            for tf in TIMEFRAMES:
                source = statistics_source(kwargs.get("m5", "best_fit_a") if tf == "M5" else "non_b")
                required = REQUIRED_COMMON + (() if source == "fractal_edt" else REQUIRED_MODEL_A)
                for name in required:
                    for value in (None, DROP, "x", True, False, float("nan"), float("inf"), float("-inf"), [1.0]):
                        changes = {name: value}
                        inputs = synth(m5_row=changes if tf == "M5" else None, m15_row=changes if tf == "M15" else None, **kwargs)
                        out = run(inputs)
                        self.assertEqual(
                            (out["status"], out["status_reasons"]), ("INVALID", ["SANITY_FAILED"]), (source_case, tf, name, value)
                        )

    def test_the_required_fields_follow_the_source_name(self):
        self.assertEqual(ev._required_fields("non_b"), REQUIRED_COMMON + REQUIRED_MODEL_A)
        self.assertEqual(ev._required_fields("fractal_edt"), REQUIRED_COMMON)
        for candidate in ("best_fit_a", "best_fit_b", "cherry_a", "cherry_b", "most_recent", "non_a", "non_b"):
            self.assertEqual(ev._required_fields(candidate), REQUIRED_COMMON + REQUIRED_MODEL_A, candidate)

    def test_mse_must_be_above_zero_for_each_model_used(self):
        for name in ("model_a_mse", "model_b_mse"):
            for value in (0.0, -1.0, -0.0001):
                for tf in TIMEFRAMES:
                    changes = {name: value}
                    out = run(synth(m5_row=changes if tf == "M5" else None, m15_row=changes if tf == "M15" else None))
                    self.assertEqual((out["status"], out["status_reasons"]), ("INVALID", ["SANITY_FAILED"]), (name, value, tf))
            self.assertEqual(run(synth(m5_row={name: 1e-9}))["status"], "VALID", name)  # tiny but positive is a reading

    def test_a_fractal_mse_of_model_a_is_not_checked(self):
        out = run(synth(m5="fractal", m5_row={"model_a_mse": 0.0}))
        self.assertEqual(out["status"], "VALID")

    def test_offsets_must_have_the_right_sign(self):
        for changes in ({"uoedt_offset": 0.0}, {"uoedt_offset": -1.0}, {"loedt_offset": 0.0}, {"loedt_offset": 1.0}):
            for tf in TIMEFRAMES:
                out = run(synth(m5_row=changes if tf == "M5" else None, m15_row=changes if tf == "M15" else None))
                self.assertEqual((out["status"], out["status_reasons"]), ("INVALID", ["SANITY_FAILED"]), (changes, tf))

    def test_the_channel_width_must_be_above_zero(self):
        for value in (0.0, -5.0):
            for tf in TIMEFRAMES:
                out = run(synth(m5_row={"channel_width": value} if tf == "M5" else None, m15_row={"channel_width": value} if tf == "M15" else None))
                self.assertEqual((out["status"], out["status_reasons"]), ("INVALID", ["SANITY_FAILED"]), (value, tf))

    # P6 finding F1 (2026-10-01): the hash of an active source is copied into the envelope, so a hash that is not a string
    # used to give a VALID envelope that broke ``mcd-output/1`` (and, for bytes, NaN or an object, could not be serialised).
    NOT_A_STRING = (None, 7, 1.5, True, False, [], [1], {}, {"a": 1}, b"x", float("nan"), float("inf"), object())

    def test_a_config_hash_that_is_not_a_string_is_sanity_failed_and_never_reaches_the_envelope(self):
        for m5, m15 in (("best_fit_a", "non_b"), ("fractal", "most_recent")):
            base = synth(m5=m5, m15=m15)
            for tf, setting in (("M5", m5), ("M15", m15)):
                source = statistics_source(setting)
                for value in self.NOT_A_STRING:
                    hashes = thaw(base.config_hash)
                    hashes[source] = value
                    out = run(dataclasses.replace(base, config_hash=hashes))
                    label = (m5, m15, tf, value)
                    self.assert_unavailable(out, "INVALID", ["SANITY_FAILED"])  # includes the schema check
                    self.assertEqual(out["config_hash"], {s: h for s, h in base.config_hash.items() if s != source}, label)
                    canonical_json(out)  # the stored form can be written

    def test_a_config_hash_that_is_not_a_mapping_is_sanity_failed(self):
        for value in (None, "abc", 5, [("best_fit_a", "hash")], ("hash",)):
            out = run(dataclasses.replace(synth(), config_hash=value))
            self.assert_unavailable(out, "INVALID", ["SANITY_FAILED"])
            self.assertEqual(out["config_hash"], {}, value)

    def test_a_bad_config_hash_is_dropped_when_an_earlier_check_stops_the_reading(self):
        # The sanitising in ``_evaluate`` covers the readings that tier 3 never sees.
        both = {"best_fit_a", "non_b"}
        no_row = thaw(dict(synth().statistics))
        del no_row[("M15", "non_b")]
        cases = (
            (dict(data_status="STALE"), "STALE", ["DATA_STALE"], both),
            (dict(data_status="Stale"), "INVALID", ["SANITY_FAILED"], both),
            (dict(active_indicator={"M5": "best_fit_a"}), "INVALID", ["NO_SETTING"], {"best_fit_a"}),
            (dict(statistics=no_row), "STALE", ["NO_STATS_AT_SLOT"], both),
            (dict(retuning=True), "INVALID", ["RETUNING", "SANITY_FAILED"], both),
        )
        for changes, status, reasons, used in cases:
            for hashes in ({"best_fit_a": None, "non_b": "hash-M15"}, {"best_fit_a": 7, "non_b": b"x"}):
                out = run(dataclasses.replace(synth(), config_hash=hashes, **changes))
                self.assert_unavailable(out, status, reasons)
                kept = {s: h for s, h in hashes.items() if s in used and isinstance(h, str)}
                self.assertEqual(out["config_hash"], kept, (changes, hashes))

    def test_only_the_hash_of_an_active_source_matters_and_a_missing_hash_is_left_out(self):
        base = synth()
        unused = thaw(base.config_hash)
        unused["fractal_edt"] = 7  # M5 is best_fit_a here, so this source is not read
        out = run(dataclasses.replace(base, config_hash=unused))
        self.assertEqual((out["status"], out["state_code"]), ("VALID", "MCD0_ALL_QUALIFIED"))
        self.assertEqual(out["config_hash"], {"best_fit_a": "hash-M5", "non_b": "hash-M15"})
        for hashes in ({"best_fit_a": "hash-M5"}, {}):
            out = run(dataclasses.replace(base, config_hash=hashes))
            self.assertEqual((out["status"], out["config_hash"]), ("VALID", hashes))
            self.assertEqual(schema_errors(out), [])

    def test_the_order_of_the_checks(self):
        # cycle before tier 1: a stale cycle with no setting is STALE.
        inputs = dataclasses.replace(synth(), data_status="STALE", active_indicator={})
        self.assert_unavailable(run(inputs), "STALE", ["DATA_STALE"])
        # tier 1 before tier 4: no setting and no statistics is INVALID + NO_SETTING.
        inputs = dataclasses.replace(synth(), active_indicator={}, statistics={})
        self.assert_unavailable(run(inputs), "INVALID", ["NO_SETTING"])
        # tier 4 before tier 3, for both timeframes: M5 unreadable (sanity) and M15 without a row is STALE.
        inputs = synth(m5_row={"model_b_mse": 0.0})
        stats = thaw(dict(inputs.statistics))
        del stats[("M15", "non_b")]
        self.assert_unavailable(run(dataclasses.replace(inputs, statistics=stats)), "STALE", ["NO_STATS_AT_SLOT"])

    def test_the_reason_codes_mcd0_never_emits(self):
        cases = [
            dataclasses.replace(synth(), data_status="STALE"),
            dataclasses.replace(synth(), data_status="x"),
            dataclasses.replace(synth(), retuning=True),
            synth(m5_row={"model_a_mse": 0.0}),
            synth(m15_row={"window_span_bars": DROP}),
            dataclasses.replace(synth(), active_indicator={}),
            dataclasses.replace(synth(), bars=None, statistics=None),
            dataclasses.replace(synth(), bars={"M5": ("garbage",)}),
            synth(m5_row={"containment_rate": 1.0}),
        ]
        for inputs in cases:
            self.assertFalse(FORBIDDEN_REASONS & set(run(inputs)["status_reasons"]))

    def test_t10_an_error_inside_the_evaluator_becomes_evaluator_error(self):
        broken = Params.from_dict(
            {
                "mcd_id": "MCD0",
                "evaluator_version": "1.0.0",
                "parameters": {"min_coverage_bars": {"value": 60, "unit": "x", "boundary": "x", "why": "x"}},
            }
        )
        with self.assertLogs("mcd", level="ERROR"):
            out = ev.evaluate(synth(), broken, {})
        self.assert_unavailable(out, "INVALID", ["EVALUATOR_ERROR"])

    def test_the_evaluator_ignores_upstream(self):
        self.assertEqual(
            canonical_json(ev.evaluate(synth(), PARAMS, {"MCD1": {"status": "INVALID"}})), canonical_json(run(synth()))
        )


# --------------------------------------------------------------------------- T13: the real readings

# (slot, M5 setting, M15 setting, state, M5 failed, M5 skipped, M5 coverage, M5 geo, M15 failed, M15 skipped, M15 coverage, M15 geo)
FRACTAL_SKIPS = ["R2_A", "FIT_A", "SKEW_A"]
REAL = [
    ("v1", None, None, "MCD0_M5_M15_DEFECT", ["R2_A", "R2_B", "FIT_A", "FIT_B"], [], 754, 1.0,
     ["R2_A", "FIT_A", "FIT_B"], [], 1807, 0.7425),
    ("v3", None, None, "MCD0_M5_M15_DEFECT", ["R2_A", "R2_B"], [], 1037, 0.8353, ["R2_A", "R2_B"], [], 1528, 0.7524),
    ("v4", None, None, "MCD0_M5_M15_DEFECT", ["R2_A"], [], 1133, 1.0761, ["R2_A", "R2_B"], [], 2034, 0.8478),
    ("v3", None, "non_a", "MCD0_M5_DEFECT", ["R2_A", "R2_B"], [], 1037, 0.8353, [], [], 487, 1.4351),
    ("v4", None, "non_a", "MCD0_M5_DEFECT", ["R2_A"], [], 1133, 1.0761, [], ["R2_A", "R2_B"], 967, 1.3097),
    ("v1", "fractal", None, "MCD0_M5_M15_DEFECT", ["R2_B", "FIT_B", "GEO"], FRACTAL_SKIPS, 335, 0.5,
     ["R2_A", "FIT_A", "FIT_B"], [], 1807, 0.7425),
    ("v3", "fractal", "non_a", "MCD0_M5_DEFECT", ["GEO"], FRACTAL_SKIPS, 313, 0.5961, [], [], 487, 1.4351),
    ("v4", "fractal", "non_a", "MCD0_M5_DEFECT", ["GEO"], FRACTAL_SKIPS, 409, 0.5961, [], ["R2_A", "R2_B"], 967, 1.3097),
]


class RealCycleTests(unittest.TestCase):
    def test_the_eight_real_readings(self):
        for slot, m5, m15, state, f5, s5, c5, g5, f15, s15, c15, g15 in REAL:
            with self.subTest(slot=slot, m5=m5, m15=m15):
                out = run(with_settings(stored_inputs(slot), m5=m5, m15=m15))
                self.assertEqual((out["status"], out["status_reasons"], out["state_code"]), ("VALID", [], state))
                self.assertEqual(out["last_closed_bar"], {})
                m5d, m15d = out["details"]["M5"], out["details"]["M15"]
                self.assertEqual((m5d["failed"], m5d["skipped"], m5d["coverage"], m5d["geo_ratio"]), (f5, s5, c5, g5))
                self.assertEqual((m15d["failed"], m15d["skipped"], m15d["coverage"], m15d["geo_ratio"]), (f15, s15, c15, g15))
                self.assertEqual(schema_errors(out), [])

    def test_the_v1_cycle_in_full(self):
        out = run(stored_inputs("v1"))
        m5, m15 = out["details"]["M5"], out["details"]["M15"]
        self.assertEqual(m5["model_a"], {"r2": -0.1016, "fit_ratio": 0.513, "skew": -0.85, "var_ratio": 0.32, "kurtosis": 2.48})
        self.assertEqual(m5["model_b"], {"r2": -0.121, "fit_ratio": 0.5331, "skew": -0.79, "var_ratio": 0.37, "kurtosis": 2.5})
        self.assertEqual(m15["model_a"], {"r2": 0.6828, "fit_ratio": 1.2242, "skew": -1.33, "var_ratio": 0.12, "kurtosis": 4.07})
        self.assertEqual(m15["model_b"], {"r2": 0.655, "fit_ratio": 1.1369, "skew": -1.28, "var_ratio": 0.13, "kurtosis": 3.8})
        self.assertEqual(out["active_indicator"], {"M5": "best_fit_a", "M15": "non_b"})
        self.assertEqual(sorted(out["config_hash"]), ["best_fit_a", "non_b"])
        self.assertEqual(
            out["commentary"],
            "The M5 channel (best_fit_a) misses fit criteria: R2, fit ratio. The M15 channel (non_b) misses fit criteria: R2, fit ratio.",
        )

    def test_the_boundary_close_real_values_decide_as_stated(self):
        # v4 M5 cherry_a R2 A 0.6876 against 0.70 (fails); v4 M15 non_b fit ratio B 1.5058 against 1.50 (passes);
        # v1 M15 non_b R2 B 0.6550 against 0.65 (passes).
        v4 = run(stored_inputs("v4"))
        self.assertEqual((v4["details"]["M5"]["model_a"]["r2"], "R2_A" in failed(v4, "M5")), (0.6876, True))
        self.assertEqual((v4["details"]["M15"]["model_b"]["fit_ratio"], "FIT_B" in failed(v4, "M15")), (1.5058, False))
        v1 = run(stored_inputs("v1"))
        self.assertEqual((v1["details"]["M15"]["model_b"]["r2"], "R2_B" in failed(v1, "M15")), (0.655, False))

    def test_no_real_m5_channel_qualifies_so_two_states_are_synthetic_only(self):
        states = set()
        for slot, m5, m15, state, *_rest in REAL:
            states.add(state)
        self.assertEqual(states, {"MCD0_M5_DEFECT", "MCD0_M5_M15_DEFECT"})

    def test_the_fractal_edt_fails_the_geo_ratio_on_all_three_slots(self):
        for slot in SLOTS:
            out = run(with_settings(stored_inputs(slot), m5="fractal"))
            self.assertIn("GEO", failed(out, "M5"), slot)

    def test_the_stored_bundles_hold_one_closed_bar_per_timeframe_and_the_slot_statistics(self):
        for name, slot in SLOTS.items():
            inputs = stored_inputs(name)
            self.assertEqual(inputs.cycle_slot, slot)
            for tf in TIMEFRAMES:
                self.assertEqual(len(inputs.bars[tf]), 1)
                self.assertTrue(any(key[0] == tf for key in inputs.statistics))


# --------------------------------------------------------------------------- shared checks T4 to T8, T10, T12


class _Shared(shared.SharedSensorChecks):
    """T4 forming bar, T5 wrong-slot statistics, T6 setting, T7 determinism, T8 schema, T10 never throws, T12 size and
    time, on each real cycle. T6 and T10 are overridden because MCD0 reads no bar (plan section 3.1)."""

    NAME = ""
    M5 = None
    M15 = None

    def sensor(self):
        return shared.SensorUnderTest(
            ev.evaluate, with_settings(stored_inputs(self.NAME), m5=self.M5, m15=self.M15), PARAMS, {}, TIMEFRAMES
        )

    def test_t6_setting_and_detection_mismatch(self):
        sensor = self.sensor()
        for tf in TIMEFRAMES:
            settings = thaw(sensor.inputs.active_indicator)
            del settings[tf]
            out = shared._run(sensor, dataclasses.replace(sensor.inputs, active_indicator=settings))
            self.assertEqual((out["status"], out["status_reasons"]), ("INVALID", ["NO_SETTING"]), tf)
        # The mismatch half does not apply: MCD0 reads no bar, so a setting that names an unpopulated candidate is a
        # missing row (STALE), never CAUTIONARY + DETECTION_MISMATCH (decision (g)).
        for tf, wrong in (("M5", "best_fit_b"), ("M15", "most_recent")):
            settings = thaw(sensor.inputs.active_indicator)
            settings[tf] = wrong
            out = shared._run(sensor, dataclasses.replace(sensor.inputs, active_indicator=settings))
            self.assertEqual((out["status"], out["status_reasons"]), ("STALE", ["NO_STATS_AT_SLOT"]), tf)

    def test_t10_corrupted_bundle_never_throws(self):
        # The three bar corruptions are skipped: a bundle whose bars are junk is still a normal reading for a gate
        # that reads no bar (``DecisionTests.test_g_the_bars_are_not_read``).
        shared.check_never_throws(
            self.sensor(), skip=("bars is None", "bar rows are strings", "last bar numbers are strings")
        )


class SharedV1(_Shared, unittest.TestCase):
    NAME = "v1"


class SharedV3(_Shared, unittest.TestCase):
    NAME = "v3"


class SharedV4(_Shared, unittest.TestCase):
    NAME = "v4"


class SharedV1Fractal(_Shared, unittest.TestCase):
    NAME, M5 = "v1", "fractal"


class SharedV3NonA(_Shared, unittest.TestCase):
    NAME, M15 = "v3", "non_a"


# --------------------------------------------------------------------------- T8, T9, T11, T12


def worst_case() -> CycleInputs:
    """Every pillar failed on both timeframes, long setting names and long numbers: a large envelope (P6 found slightly larger
    ones: ``cherry_b`` and ``cherry_a`` tokenise longer, so the margin to 600 is 20 to 30 tokens for realistic data)."""
    row = {
        "window_span_bars": 12,
        "regression_angle": 33.33,
        "model_a_r2": -12.3456,
        "model_a_mse": 98765.4321,
        "model_a_skew": -9.99,
        "model_a_var_ratio": -123.45,
        "model_a_kurt": 123.45,
        "model_b_r2": -12.3456,
        "model_b_mse": 98765.4321,
        "model_b_skew": 9.99,
        "model_b_var_ratio": 123.45,
        "model_b_kurt": -123.45,
        "uoedt_offset": 7.7777,
        "loedt_offset": -1.2345,
        "channel_width": 9.0122,
    }
    inputs = synth(m5="best_fit_a", m15="most_recent", m5_row=row, m15_row=row)
    hashes = {statistics_source(inputs.active_indicator[tf]): hashlib.sha256(tf.encode()).hexdigest() for tf in TIMEFRAMES}
    return dataclasses.replace(inputs, config_hash=hashes)


class OutputTests(unittest.TestCase):
    def all_states(self):
        yield run(synth())
        yield run(synth(m5_row={"model_a_r2": 0.1}))
        yield run(synth(m15_row={"model_b_r2": 0.1}))
        yield run(synth(m5_row={"model_a_r2": 0.1}, m15_row={"model_b_r2": 0.1}))

    def test_t8_every_state_and_every_failure_validates_against_the_schema(self):
        envelopes = list(self.all_states())
        envelopes += [run(dataclasses.replace(synth(), data_status=s)) for s in ("STALE", "Stale")]
        envelopes += [run(dataclasses.replace(synth(), retuning=True)), run(dataclasses.replace(synth(), active_indicator={}))]
        envelopes += [run(synth(m5="fractal")), run(worst_case()), run(synth(m5_row={"model_a_mse": 0.0}))]
        for envelope in envelopes:
            self.assertEqual(schema_errors(envelope), [], envelope["state_code"])

    def test_t9_the_stored_fixtures_replay_byte_for_byte(self):
        self.assertEqual(shared.check_replay(ev.evaluate, PARAMS, FIXTURES), 3)

    def test_the_output_file_is_the_v1_envelope(self):
        stem = provider.slot_file_stem(SLOTS["v1"])
        stored = (FIXTURES / f"{stem}.envelope.json").read_text(encoding="utf-8")
        self.assertEqual((HERE / "mcd0_output.json").read_text(encoding="utf-8"), stored)
        self.assertEqual(canonical_json(run(stored_inputs("v1")), pretty=True), stored)
        self.assertEqual(json.loads(stored)["state_code"], "MCD0_M5_M15_DEFECT")

    def test_the_envelope_has_no_wall_clock_time_and_no_parameters(self):
        text = canonical_json(run(stored_inputs("v1")))
        for forbidden in ("evaluated_at", "evaluated_epoch", "timestamp", "parameters"):
            self.assertNotIn(forbidden, text)

    def test_details_has_exactly_the_documented_fields(self):
        out = run(stored_inputs("v1"))
        self.assertEqual(set(out["details"]), {"M5", "M15"})
        for tf in TIMEFRAMES:
            self.assertEqual(set(out["details"][tf]), {"failed", "skipped", "coverage", "geo_ratio", "model_a", "model_b"})
            self.assertEqual(set(out["details"][tf]["model_b"]), {"r2", "fit_ratio", "skew", "var_ratio", "kurtosis"})

    def test_ratios_are_rounded_half_up_to_four_decimals_and_statistics_to_two_at_output_only(self):
        out = run(synth(m5_row={"model_a_r2": 0.123456, "model_a_skew": 0.125, "model_a_mse": 224.5, "uoedt_offset": 31.0, "loedt_offset": -29.0}))
        a = out["details"]["M5"]["model_a"]
        self.assertEqual((a["r2"], a["skew"]), (0.1235, 0.13))
        self.assertEqual(out["details"]["M5"]["geo_ratio"], round(31.0 / 29.0 + 1e-12, 4))
        self.assertEqual(a["fit_ratio"], round((30.0 / math.sqrt(224.5)) + 1e-12, 4))

    def test_a_statistic_of_exactly_zero_is_reported_as_zero_and_never_as_negative_zero(self):
        # P6 finding F2 (2026-10-01): no test used a value that rounds to zero, so a rounding helper that returned 1.0 for
        # zero passed. Model A holds exact zeros; Model B holds small negatives that round to -0.0; the tiny offset and the
        # huge MSEs push the geo ratio and both fit ratios to zero as well.
        out = run(
            synth(
                m5_row={
                    "model_a_r2": 0.0, "model_a_skew": 0.0, "model_a_var_ratio": 0.0, "model_a_kurt": 0.0,
                    "model_b_r2": -0.00001, "model_b_skew": -0.004, "model_b_var_ratio": -0.001, "model_b_kurt": -0.0,
                    "model_a_mse": 1.0e12, "model_b_mse": 1.0e12, "uoedt_offset": 1.0e-6,
                }
            )
        )
        self.assertEqual(out["status"], "VALID")
        details = out["details"]["M5"]
        values = {"geo_ratio": details["geo_ratio"]}
        for model in ("model_a", "model_b"):
            values.update({f"{model}.{name}": value for name, value in details[model].items()})
        self.assertEqual(
            set(values),
            {"geo_ratio"} | {f"{m}.{n}" for m in ("model_a", "model_b") for n in ("r2", "fit_ratio", "skew", "var_ratio", "kurtosis")},
        )
        for name, value in values.items():
            self.assertEqual(value, 0.0, name)
            self.assertEqual(math.copysign(1.0, value), 1.0, f"{name} is negative zero")

    def test_t11_no_banned_word_no_percent_no_advice_in_codes_templates_and_texts(self):
        envelopes = list(self.all_states()) + [run(worst_case())]
        shared.assert_wording_clean(
            mcd_id="MCD0",
            state_codes=list(ev.STATES),
            regime_words=[],
            templates=dict(ev.TEMPLATES),
            summaries=[(e["summary_line"], e["levels"]) for e in envelopes],
        )
        problems = []
        for e in envelopes:
            problems += wording.check_text("commentary", e["commentary"])
        for state in REGISTRY["states"]:
            problems += wording.check_text(f"meaning of {state['code']}", state["meaning"])
        for pillar, label in ev.PILLAR_LABELS.items():
            problems += wording.check_text(f"label of {pillar}", label)
        self.assertEqual(problems, [])
        for e in envelopes:
            self.assertNotIn("%", e["commentary"] + e["summary_line"])

    def test_t11_the_old_file_c_wording_is_what_the_check_rejects(self):
        for old in ("Green light for high-conviction trade setups", "a safe channel", "high probability of a clean fit"):
            self.assertTrue(wording.check_text("file C", old), old)

    def test_t12_the_largest_envelope_is_within_600_tokens(self):
        worst = worst_case()
        envelopes = list(self.all_states())
        envelopes += [run(worst), run(dataclasses.replace(worst, retuning=True)), run(synth(m5="fractal"))]
        envelopes += [run(stored_inputs(name)) for name in SLOTS]
        self.assertEqual(run(worst)["state_code"], "MCD0_M5_M15_DEFECT")
        self.assertEqual(len(failed(run(worst), "M5")), 8)
        self.assertEqual(len(failed(run(worst), "M15")), 8)
        result = shared.check_size(envelopes)
        self.assertFalse(result.pending, "o200k_base is not cached: python -m mcd_common.budget --fetch")
        self.assertTrue(result.passed, (result.largest_tokens, result.method))
        self.assertEqual(result.method, "o200k_base")
        self.assertLessEqual(result.largest_tokens, 600)

    def test_r15_one_evaluation_takes_at_most_one_second(self):
        sensor = shared.SensorUnderTest(ev.evaluate, worst_case(), PARAMS, {}, TIMEFRAMES)
        self.assertLessEqual(shared.check_time(sensor), 1.0)


# --------------------------------------------------------------------------- A3, A26: what the evaluator may touch


class PurityTests(unittest.TestCase):
    ALLOWED_ROOTS = {"__future__", "decimal", "math", "typing"}
    ALLOWED_KIT = {"envelope", "preflight", "reason_codes", "cycle_inputs"}
    FORBIDDEN_NAMES = {"open", "print", "input", "eval", "exec", "compile", "__import__"}
    FORBIDDEN_ATTRIBUTES = {"now", "utcnow", "today", "time", "monotonic", "perf_counter", "environ", "getenv", "random", "read_text", "write_text"}

    def source(self):
        return (HERE / "mcd0_evaluator.py").read_text(encoding="utf-8")

    def tree(self):
        return ast.parse(self.source())

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

    def test_the_evaluator_reads_no_bar(self):
        # R1 and decision (g): no closed_bars call, no bars attribute, no bar-level kit check.
        tree = self.tree()
        for node in ast.walk(tree):
            if isinstance(node, ast.Attribute):
                self.assertNotEqual(node.attr, "bars", f"line {node.lineno}")
            if isinstance(node, ast.Name):
                self.assertNotIn(node.id, {"closed_bars", "channel_columns", "last_closed_bar_slots"}, f"line {node.lineno}")
            if isinstance(node, ast.Attribute):
                self.assertNotIn(node.attr, {"bars_check", "indicator_check", "sanity_check"}, f"line {node.lineno}")

    def test_the_folder_matches_the_standard_layout(self):
        expected = {
            "concept.md", "fixtures", "mcd0.md", "mcd0_evaluator.py", "mcd0_implementation_plan.md", "mcd0_output.json",
            "mcd0_params.yaml", "mcd0_registry.yaml", "mcd0-manifest-work-completion.md", "test_mcd0_unit_tests.py",
        }
        present = {p.name for p in HERE.iterdir() if p.name != "__pycache__"}
        self.assertEqual(present, expected)  # no legacy/ (new MCD) and no concept/ (no board; concept.md only)
        self.assertEqual(
            sorted(p.name for p in FIXTURES.iterdir()),
            sorted(f"{provider.slot_file_stem(slot)}.{kind}" for slot in SLOTS.values() for kind in ("inputs.json", "envelope.json", "source.md")),
        )


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
