"""Unit tests for MCD3 2.0.0 (standard section 12: T1 to T14; MCD3 is derived, so T14 applies).

Run from ``davintrade-stack-d-and-e/engine-1-5-new/``::

    python -m unittest discover -s mcd3

Real-data tests read the stored fixtures (``fixtures/<slot>.inputs.json`` with its ``.upstream.json``), never a
workbook. Only the provenance, equivalence and T14 live-upstream tests open the replica workbooks, and they skip when
a workbook is missing. The fixtures are written by ``write_fixtures()`` below::

    python -c "import sys; sys.path.insert(0, 'mcd3'); import test_mcd3_unit_tests as t; t.write_fixtures()"

The 13 pre-retrofit scenarios are kept as cases: legacy 01 is ``RealCycleTests``, 02 to 08 are ``StateTests`` and
``LegacyCases``, 09 to 11 are ``StateTests``, 12 and 13 are ``LegacyCases`` (see the method names and the manifest).
``EquivalenceTests`` run the pre-retrofit evaluator (``legacy/``) side by side with the new one.

All twelve real pairings of the five replica batches can be scanned with ``MCD3_FULL_SCAN=1`` (slow: about 40 s)
or printed with ``scan_real_cycles()``.
"""

from __future__ import annotations

import ast
import dataclasses
import functools
import hashlib
import importlib.util
import json
import logging
import math
import os
import random
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
ENGINE = HERE.parent
STACK = ENGINE.parent
for _path in (str(ENGINE), str(HERE)):
    if _path not in sys.path:
        sys.path.insert(0, _path)

import yaml  # noqa: E402

import mcd3_evaluator as ev  # noqa: E402
from mcd_common import budget  # noqa: E402
from mcd_common import envelope as env  # noqa: E402
from mcd_common import excel_fixture_provider as provider  # noqa: E402
from mcd_common import reason_codes as rc  # noqa: E402
from mcd_common import testing as shared  # noqa: E402
from mcd_common import wording  # noqa: E402
from mcd_common.cycle_inputs import (  # noqa: E402
    CANDIDATES,
    CycleInputs,
    Params,
    channel_columns,
    closed_bars,
    epoch_to_slot,
    slot_to_epoch,
    stats_slot_for,
    statistics_source,
    thaw,
)
from mcd_common.envelope import canonical, canonical_json, schema_errors  # noqa: E402

# The evaluator logs the exception behind EVALUATOR_ERROR; keep the test output quiet.
logging.getLogger("mcd").addHandler(logging.NullHandler())

FIXTURES = HERE / "fixtures"
PARAMS = Params.from_yaml(str(HERE / "mcd3_params.yaml"))
REGISTRY = yaml.safe_load((HERE / "mcd3_registry.yaml").read_text(encoding="utf-8"))
LEGACY_EVALUATOR = HERE / "legacy" / "mcd3_evaluator.py"

SLOTS = {"v1": "2026-09-18T20:55Z", "v4": "2026-09-28T23:15Z", "v3": "2026-09-28T14:15Z"}
SETTINGS = {name: ENGINE / "mcd_common" / "fixtures" / f"settings_{name}.yaml" for name in SLOTS}
WORKBOOKS = {
    "v1": ENGINE / "market_data_v6_replicated.xlsx",
    "v4": STACK / "market_data_v6_replicated_v4.xlsx",
    "v3": STACK / "market_data_v6_replicated_v3.xlsx",
}
# Candidates with a channel on the last closed bar of each replica (so detection and populated_candidates work).
POPULATED = {
    "v1": {"M15": ("non_b",), "M5": ("best_fit_a", "fractal")},
    "v4": {"M15": ("non_a", "non_b"), "M5": ("cherry_a", "fractal")},
    "v3": {"M15": ("non_a", "non_b"), "M5": ("cherry_a", "fractal")},
}
DROP = object()  # remove a field
# Davin, 1 October 2026 (manifest A22): MCD3 is derived and carries six levels, two config hashes and up to two upstream
# cautions, so its envelope ceiling is 670 tokens (the standard's 600 is a "should"; a spec that departs says why: mcd3.md section 11).
DERIVED_CEILING = 670


# --------------------------------------------------------------------------- the committed upstream sensors


@functools.lru_cache(maxsize=None)
def _upstream_sensors():
    """MCD1 and MCD2 as committed: (evaluate, params) for each. Loaded by path, so the three ``mcdN_evaluator``
    modules never meet on ``sys.path``."""

    def load(folder: str, name: str):
        spec = importlib.util.spec_from_file_location(name, ENGINE / folder / f"{name}.py")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module.evaluate, Params.from_yaml(str(ENGINE / folder / f"{folder}_params.yaml"))

    return {"MCD1": load("mcd1", "mcd1_evaluator"), "MCD2": load("mcd2", "mcd2_evaluator")}


def live_upstream(full_inputs: CycleInputs) -> dict:
    """The same-cycle MCD1 and MCD2 readings, from the committed evaluators on a full bundle."""
    return {name: evaluate(full_inputs, params, {}) for name, (evaluate, params) in _upstream_sensors().items()}


# --------------------------------------------------------------------------- fixtures


@functools.lru_cache(maxsize=None)
def _tables(name: str):
    return provider.read_workbook(WORKBOOKS[name])


def _columns(name: str) -> tuple[str, ...]:
    names = {n for tf in ("M15", "M5") for n in POPULATED[name][tf]}
    return tuple(dict.fromkeys(c for n in sorted(names) for c in channel_columns(n).values()))


def full_bundle(name: str):
    """The bundle the kit's provider builds from the frozen workbook, all bars and columns (for MCD1 and MCD2)."""
    return provider.build_cycle_inputs_with_report(_tables(name), SETTINGS[name])


def trimmed_bundle(name: str):
    """What MCD3 reads and no more: its columns, the newest ``N_nest`` closed M5 bars and the closed M15 bars from the
    one that holds the oldest of them."""
    full, _report = full_bundle(name)
    row = full.statistics[("M5", statistics_source(full.active_indicator["M5"]))]
    nest = int(row["containment_n"]) - int(PARAMS["t_edt_open_bar_rows"])
    m5, m15 = closed_bars(full, "M5"), closed_bars(full, "M15")
    oldest = m5[-nest]["timestamp"]
    start = max(i for i, bar in enumerate(m15) if bar["timestamp"] <= oldest)
    return provider.build_cycle_inputs_with_report(
        _tables(name), SETTINGS[name], columns=_columns(name), max_bars={"M5": nest, "M15": len(m15) - start}
    )


def write_fixtures() -> None:
    """Write ``fixtures/<slot>.{inputs,upstream,envelope}.json``, ``<slot>.source.md`` and ``mcd3_output.json``."""
    for name, slot in SLOTS.items():
        full, _ = full_bundle(name)
        upstream = live_upstream(full)
        inputs, report = trimmed_bundle(name)
        envelope = ev.evaluate(inputs, PARAMS, upstream)
        provider.write_fixture_files(FIXTURES, inputs, report, envelope, base_dir=ENGINE)
        (FIXTURES / f"{provider.slot_file_stem(slot)}.upstream.json").write_text(
            json.dumps({k: canonical(v) for k, v in upstream.items()}, indent=2, ensure_ascii=True) + "\n",
            encoding="utf-8",
            newline="\n",
        )
        if name == "v1":
            (HERE / "mcd3_output.json").write_text(canonical_json(envelope, pretty=True), encoding="utf-8", newline="\n")


def stored_inputs(name: str) -> CycleInputs:
    return provider.load_inputs(FIXTURES / f"{provider.slot_file_stem(SLOTS[name])}.inputs.json")


def stored_upstream(name: str) -> dict:
    return json.loads((FIXTURES / f"{provider.slot_file_stem(SLOTS[name])}.upstream.json").read_text(encoding="utf-8"))


def stored_envelope_text(name: str) -> str:
    return (FIXTURES / f"{provider.slot_file_stem(SLOTS[name])}.envelope.json").read_text(encoding="utf-8")


# --------------------------------------------------------------------------- synthetic bundles

SLOT = "2026-09-18T20:55Z"


def synth(
    *,
    ind15: str = "non_b",
    ind5: str = "best_fit_a",
    slot: str = SLOT,
    t_edt: int = 301,
    extra5: int = 10,
    extra15: int = 10,
    m15=(4300.0, 4400.0),
    ssa15: float = 4350.0,
    m5=(4320.0, 4380.0),
    last5=None,
    nested: int | None = None,
    band15_from: int = 0,
    containment15: float = 70.0,
    containment5: float = 65.0,
    also5=(),
    also15=(),
) -> CycleInputs:
    """A valid M15 + M5 bundle. The M5 channel exists on ``N_nest = t_edt - 1`` closed bars (the last of the ``t_edt``
    rows is the forming bar, left out) preceded by ``extra5`` bars without a band; ``m15`` is the (LOEDT, UOEDT) of every
    M15 bar with a band and ``m5`` that of the nested M5 bars; the latest M5 bar has ``last5``. ``nested`` is how many
    window bars are nested (the newest ones), the latest included when it is inside. M15 bars before index
    ``band15_from`` have no band. ``also5`` and ``also15`` name other candidates populated on the last bar."""
    slot_epoch = slot_to_epoch(slot)
    last_open5 = slot_epoch - 300
    last_open15 = (slot_epoch - 900) // 900 * 900
    n = t_edt - 1
    c5, c15 = channel_columns(ind5), channel_columns(ind15)
    l15, u15 = m15
    last5 = last5 or m5
    last_inside = last5[0] >= l15 and last5[1] <= u15
    if nested is None:
        nested = n if last_inside else n - 1
    others = nested - (1 if last_inside else 0)
    assert 0 <= others <= n - 1, (nested, n)
    outside = (l15 - 50.0, u15 + 50.0)

    total5 = n + extra5
    rows5 = []
    for i in range(total5):
        row = {"timestamp": last_open5 - (total5 - 1 - i) * 300}
        w = i - extra5
        if w < 0:
            lo = hi = None
        elif w == n - 1:
            lo, hi = last5
        elif w >= n - 1 - others:
            lo, hi = m5
        else:
            lo, hi = outside
        row[c5["upper"]], row[c5["lower"]] = hi, lo
        row[c5["baseline"]] = None if lo is None else (lo + hi) / 2
        if ind5 != "fractal":
            row[c5["fit"]] = (m5[0] + m5[1]) / 2
        rows5.append(row)

    oldest_open5 = last_open5 - (n - 1) * 300
    first15 = oldest_open5 // 900 * 900 - extra15 * 900
    rows15 = []
    for j, ts in enumerate(range(first15, last_open15 + 1, 900)):
        has_band = j >= band15_from
        rows15.append(
            {
                "timestamp": ts,
                c15["upper"]: u15 if has_band else None,
                c15["lower"]: l15 if has_band else None,
                c15["baseline"]: (l15 + u15) / 2 if has_band else None,
                c15["fit"]: (l15 + u15) / 2,
            }
        )
    rows15[-1][c15["fit"]] = ssa15

    for rows, names in ((rows5, also5), (rows15, also15)):
        for name in names:
            for column in channel_columns(name).values():
                rows[-1][column] = 4000.0

    stats = {}
    for tf, ind, rate, horizon, width in (
        ("M15", ind15, containment15, 1808, u15 - l15),
        ("M5", ind5, containment5, t_edt, m5[1] - m5[0]),
    ):
        source = statistics_source(ind)
        stats[(tf, source)] = {
            "timeframe": tf,
            "source": source,
            "captured_at": slot_to_epoch(stats_slot_for(slot, tf)),
            "regression_angle": 10.0,
            "containment_rate": rate,
            "containment_n": horizon,
            "channel_width": width,
        }
    return CycleInputs(
        symbol="XAUUSD",
        cycle_slot=slot,
        data_status="FRESH",
        retuning=False,
        bars={"M5": rows5, "M15": rows15},
        statistics=stats,
        stats_slot={"M5": stats_slot_for(slot, "M5"), "M15": stats_slot_for(slot, "M15")},
        active_indicator={"M5": ind5, "M15": ind15},
        config_hash={statistics_source(ind5): "h5", statistics_source(ind15): "h15"},
        channel_mode={statistics_source(ind5): "dynamic", statistics_source(ind15): "dynamic"},
    )


def with_stat(inputs: CycleInputs, tf: str, **changes) -> CycleInputs:
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


def with_bars(inputs: CycleInputs, tf: str, edit) -> CycleInputs:
    bars = thaw(inputs.bars)
    edit(bars[tf])
    return dataclasses.replace(inputs, bars=bars)


def with_setting(inputs: CycleInputs, tf: str, value) -> CycleInputs:
    settings = thaw(inputs.active_indicator)
    if value is DROP:
        del settings[tf]
    else:
        settings[tf] = value
    return dataclasses.replace(inputs, active_indicator=settings)


# --------------------------------------------------------------------------- synthetic upstream readings

TREND_ANGLE = {"UP": 12.0, "DOWN": -15.0, "SIDEWAYS": 2.0}
_INDICATOR = {"M15": "non_b", "M5": "best_fit_a"}


def reading(mcd_id: str, trend: str, angle: float | None = None, *, status: str = "VALID", slot: str = SLOT, indicator=None, reasons=None) -> dict:
    """A same-cycle MCD1 or MCD2 envelope with the two fields MCD3 reads (and a few it does not)."""
    tf = "M15" if mcd_id == "MCD1" else "M5"
    common = dict(
        levels=(),
        regime_status="TREND_ALIGNED_CONTINUATION",
        details={"trend_direction": trend, "regression_angle_deg": TREND_ANGLE[trend] if angle is None else angle},
        last_closed_bar={tf: "2026-09-18T20:30Z"},
        active_indicator={tf: indicator or _INDICATOR[tf]},
    )
    ok = dict(state_code=f"{mcd_id}_{trend}_IN_CORRIDOR", bias="LONG", summary_line="x", commentary="x", **common)
    if status == "VALID":
        return env.valid(mcd_id, "2.0.0", slot, **ok)
    if status == "CAUTIONARY":
        return env.cautionary(mcd_id, "2.0.0", slot, reasons or [rc.mcd0_defect(tf)], **ok)
    if status == "INVALID":
        return env.invalid(mcd_id, "2.0.0", slot, reasons or [rc.SANITY_FAILED])
    return env.stale(mcd_id, "2.0.0", slot, reasons or [rc.NO_STATS_AT_SLOT])


def ups(trend15: str = "UP", trend5: str = "UP", angle15: float | None = None, angle5: float | None = None, **changes) -> dict:
    """The upstream pair. ``changes`` are keyword arguments for ``reading`` as ``MCD1=dict(...)`` or ``MCD2=dict(...)``."""
    return {
        "MCD1": reading("MCD1", trend15, angle15, **changes.get("MCD1", {})),
        "MCD2": reading("MCD2", trend5, angle5, **changes.get("MCD2", {})),
    }


def run(inputs: CycleInputs, upstream=None, params: Params = PARAMS) -> dict:
    return ev.evaluate(inputs, params, ups() if upstream is None else upstream)


# --------------------------------------------------------------------------- a clean-room reference (mcd3.md section 6)


def reference(inputs: CycleInputs, upstream: dict, params: Params = PARAMS) -> dict:
    """The rules of spec section 6 written plainly (no bisect, no helpers shared with the evaluator), for a bundle that
    passes pre-flight. Returns the state, the nesting counts and the stochastic."""
    slot = slot_to_epoch(inputs.cycle_slot)
    c15, c5 = channel_columns(inputs.active_indicator["M15"]), channel_columns(inputs.active_indicator["M5"])
    m5 = [b for b in inputs.bars["M5"] if b["timestamp"] + 300 <= slot]
    m15 = [b for b in inputs.bars["M15"] if b["timestamp"] + 900 <= slot]
    row = inputs.statistics[("M5", statistics_source(inputs.active_indicator["M5"]))]
    t_edt = next(row[k] for k in ("containment_n", "visual_window_bars", "window_bars") if isinstance(row.get(k), (int, float)))
    n = int(t_edt) - int(params["t_edt_open_bar_rows"])
    nested = 0
    for bar in m5[-n:]:
        holder = None
        for candidate in reversed(m15):
            if candidate["timestamp"] <= bar["timestamp"]:
                holder = candidate
                break
        if holder is None or holder[c15["upper"]] is None or holder[c15["lower"]] is None:
            continue
        if bar[c5["lower"]] >= holder[c15["lower"]] and bar[c5["upper"]] <= holder[c15["upper"]]:
            nested += 1
    t15 = upstream["MCD1"]["details"]["trend_direction"]
    t5 = upstream["MCD2"]["details"]["trend_direction"]
    c1 = t15 == t5
    c2 = nested * 100 >= params["nesting_min_share"] * n
    last5, last15 = m5[-1], m15[-1]
    lo, hi, ssa = last15[c15["lower"]], last15[c15["upper"]], last15[c15["fit"]]
    c3 = last5[c5["lower"]] >= lo and last5[c5["upper"]] <= hi
    if not (c1 and c2 and c3):
        state = ev.CONFLICT_STATE if not c1 else ev.OVERFLOW_STATE if not c2 else ev.ESCAPE_STATE
        return {"state": state, "nested": nested, "n": n, "stochastic": None}
    position = 100.0 * (ssa - lo) / (hi - lo)
    if t15 == "SIDEWAYS":
        state = "MCD3_SIDEWAYS_EQUILIBRIUM"
    else:
        zone = "low" if position <= 20 else "high" if position >= 80 else "mid"
        state = {
            ("UP", "low"): "MCD3_BULL_VALUE", ("UP", "mid"): "MCD3_BULL_MID", ("UP", "high"): "MCD3_BULL_TOP",
            ("DOWN", "high"): "MCD3_BEAR_PREMIUM", ("DOWN", "mid"): "MCD3_BEAR_MID", ("DOWN", "low"): "MCD3_BEAR_BOTTOM",
        }[(t15, zone)]
    return {"state": state, "nested": nested, "n": n, "stochastic": round(position, 2)}


# --------------------------------------------------------------------------- the register (T1 setup, A10, A11)

D6_BIAS = {
    "MCD3_BULL_VALUE": "LONG",
    "MCD3_BULL_MID": "LONG",
    "MCD3_BULL_TOP": "NEUTRAL",
    "MCD3_BEAR_PREMIUM": "SHORT",
    "MCD3_BEAR_MID": "SHORT",
    "MCD3_BEAR_BOTTOM": "NEUTRAL",
    "MCD3_SIDEWAYS_EQUILIBRIUM": "NEUTRAL",
    "MCD3_NON_CONSOLIDATED_TREND_CONFLICT": "STAND_ASIDE",
    "MCD3_NON_CONSOLIDATED_OVERFLOW": "STAND_ASIDE",
    "MCD3_NON_CONSOLIDATED_ESCAPE": "STAND_ASIDE",
}


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

    def test_the_register_has_ten_states_and_bias_follows_d6(self):
        self.assertEqual(len(REGISTRY["states"]), 10)
        self.assertEqual({code: bias for code, (bias, *_rest) in ev.STATES.items()}, D6_BIAS)
        self.assertEqual(len({regime for (_b, regime, _s, _t) in ev.STATES.values()}), 10)

    def test_every_state_is_reached_by_exactly_one_rule_and_the_old_failure_states_are_gone(self):
        reached = set(ev.CONSOLIDATED_STATE.values()) | {ev.SIDEWAYS_STATE, ev.CONFLICT_STATE, ev.OVERFLOW_STATE, ev.ESCAPE_STATE}
        self.assertEqual(reached, set(ev.STATES))
        source = (HERE / "mcd3_evaluator.py").read_text(encoding="utf-8")
        for old in ("MCD3_INVALID", "MCD3_UNKNOWN", "HIGH_CONVICTION", "TAKE_PROFIT", "tactical_bias", "datetime"):
            self.assertNotIn(old, source)
            self.assertNotIn(old, yaml.safe_dump(REGISTRY))

    def test_registry_and_params_describe_this_evaluator(self):
        self.assertEqual(REGISTRY["mcd_id"], ev.MCD_ID)
        self.assertEqual(REGISTRY["evaluator_version"], ev.EVALUATOR_VERSION)
        self.assertEqual((PARAMS.mcd_id, PARAMS.evaluator_version), (ev.MCD_ID, ev.EVALUATOR_VERSION))
        self.assertEqual(REGISTRY["kind"], "derived")
        self.assertEqual(REGISTRY["depends_on"], list(ev.UPSTREAM))
        self.assertEqual(REGISTRY["timeframes"], ["M15", "M5"])
        self.assertEqual(REGISTRY["uses_channel"], ["M5", "M15"])
        self.assertEqual(REGISTRY["rung"], {"DAY_TRADER": "oscillators", "SCALPER": "oscillators"})
        self.assertEqual(REGISTRY["flag"], "off")
        self.assertEqual(
            set(PARAMS.values),
            {
                "min_containment_rate",
                "nesting_min_share",
                "min_nesting_window_bars",
                "t_edt_open_bar_rows",
                "lower_zone_max_position",
                "upper_zone_min_position",
                "stochastic_decimals",
            },
        )

    def test_the_templates_state_decision_d10_option_a(self):
        for template_id in ("MCD3_T01", "MCD3_T02", "MCD3_T03", "MCD3_T04", "MCD3_T05", "MCD3_T06", "MCD3_T07"):
            self.assertIn("(0 at LOEDT, 100 at UOEDT)", ev.TEMPLATES[template_id])


# --------------------------------------------------------------------------- T1: one test per state

C = dict(m15=(4300.0, 4400.0), m5=(4320.0, 4380.0))  # the legacy synthetic corridors; position = ssa - 4300


class StateTests(unittest.TestCase):
    """T1. Ten states, each from a synthetic bundle. Legacy scenarios 02 to 11 use the legacy numbers (angles, corridors
    4300 to 4400 and 4320 to 4380, SSA 4310 / 4350 / 4390)."""

    def check(self, out, state, stochastic, *, bias=None, regime=None):
        self.assertEqual((out["status"], out["status_reasons"], out["state_code"]), ("VALID", [], state))
        self.assertEqual(out["details"]["edt_stochastic"], stochastic)
        want_bias, want_regime, want_summary, _t = ev.STATES[state]
        self.assertEqual((out["bias"], out["regime_status"], out["summary_line"]), (bias or want_bias, regime or want_regime, want_summary))
        self.assertEqual(schema_errors(out), [])
        self.assertEqual(out["depends_on"], ["MCD1", "MCD2"])
        self.assertEqual(len(out["levels"]), 6)

    def test_02_legacy_bull_value(self):
        out = run(synth(ssa15=4310.0, **C), ups("UP", "UP", 12.0, 8.0))
        self.check(out, "MCD3_BULL_VALUE", 10.0, bias="LONG", regime="BULLISH_CONSOLIDATED_VALUE_ZONE")
        self.assertEqual(out["details"]["m15_trend_direction"], "UP")
        self.assertIn("the EDT stochastic is 10.00 (0 at LOEDT, 100 at UOEDT), in the lower zone.", out["commentary"])

    def test_03_legacy_bull_mid(self):
        self.check(run(synth(ssa15=4350.0, **C), ups("UP", "UP", 12.0, 8.0)), "MCD3_BULL_MID", 50.0, bias="LONG")

    def test_04_legacy_bull_top(self):
        out = run(synth(ssa15=4390.0, **C), ups("UP", "UP", 12.0, 8.0))
        self.check(out, "MCD3_BULL_TOP", 90.0, bias="NEUTRAL", regime="BULLISH_CONSOLIDATED_OVERBOUGHT")
        self.assertIn("in the upper zone.", out["commentary"])

    def test_05_legacy_bear_premium(self):
        out = run(synth(ssa15=4390.0, **C), ups("DOWN", "DOWN", -15.0, -10.0))
        self.check(out, "MCD3_BEAR_PREMIUM", 90.0, bias="SHORT", regime="BEARISH_CONSOLIDATED_PREMIUM_ZONE")

    def test_06_legacy_bear_mid(self):
        self.check(run(synth(ssa15=4350.0, **C), ups("DOWN", "DOWN", -15.0, -10.0)), "MCD3_BEAR_MID", 50.0, bias="SHORT")

    def test_07_legacy_bear_bottom(self):
        out = run(synth(ssa15=4310.0, **C), ups("DOWN", "DOWN", -15.0, -10.0))
        self.check(out, "MCD3_BEAR_BOTTOM", 10.0, bias="NEUTRAL", regime="BEARISH_CONSOLIDATED_OVERSOLD")
        self.assertEqual(
            out["commentary"],
            "Both channels slope down (M15 -15.00°, M5 -10.00°). 300 of 300 closed M5 bars have their corridor inside the "
            "M15 corridor, and the latest M5 corridor [4320.00, 4380.00] is inside the M15 corridor [4300.00, 4400.00]. "
            "The M15 SSA 4310.00 is inside the M15 corridor; the EDT stochastic is 10.00 (0 at LOEDT, 100 at UOEDT), in the lower zone.",
        )

    def test_08_legacy_sideways_equilibrium(self):
        out = run(synth(ssa15=4350.0, **C), ups("SIDEWAYS", "SIDEWAYS", 2.0, -1.5))
        self.check(out, "MCD3_SIDEWAYS_EQUILIBRIUM", 50.0, bias="NEUTRAL")
        self.assertTrue(out["commentary"].startswith("Both channels are flat (M15 +2.00°, M5 -1.50°)."))

    def test_09_legacy_condition_1_fails_trend_conflict(self):
        out = run(synth(**C), ups("UP", "DOWN", 15.0, -12.0))
        self.check(out, "MCD3_NON_CONSOLIDATED_TREND_CONFLICT", None)
        d = out["details"]
        self.assertEqual((d["trends_aligned"], d["nesting_met"], d["current_bar_engulfed"]), (False, True, True))
        self.assertEqual(
            out["commentary"],
            "The M15 channel slopes up (+15.00°) while the M5 channel slopes down (-12.00°), so the two timeframes do not "
            "form a consolidated trend and no EDT stochastic is given.",
        )

    def test_10_legacy_condition_2_fails_overflow(self):
        out = run(synth(nested=150, **C), ups("UP", "UP", 10.0, 8.0))
        self.check(out, "MCD3_NON_CONSOLIDATED_OVERFLOW", None)
        d = out["details"]
        self.assertEqual((d["trends_aligned"], d["nesting_met"], d["nested_bars"], d["nesting_window_bars"]), (True, False, 150, 300))
        self.assertIn("only 150 of 300 closed M5 bars", out["commentary"])
        self.assertIn("fewer than three quarters", out["commentary"])

    def test_11_legacy_condition_3_fails_escape(self):
        out = run(synth(last5=(4320.0, 4410.0), **C), ups("UP", "UP", 10.0, 8.0))
        self.check(out, "MCD3_NON_CONSOLIDATED_ESCAPE", None)
        d = out["details"]
        self.assertEqual((d["trends_aligned"], d["nesting_met"], d["current_bar_engulfed"], d["nested_bars"]), (True, True, False, 299))
        self.assertIn("the latest M5 corridor [4320.00, 4410.00] extends beyond the M15 corridor [4300.00, 4400.00]", out["commentary"])

    def test_the_first_failed_condition_decides_the_failure_state(self):
        far = dict(nested=100, last5=(4320.0, 4410.0))
        self.assertEqual(run(synth(**far, **C), ups("UP", "DOWN"))["state_code"], ev.CONFLICT_STATE)  # 1, 2 and 3 fail
        self.assertEqual(run(synth(**far, **C), ups("UP", "UP"))["state_code"], ev.OVERFLOW_STATE)  # 2 and 3 fail
        self.assertEqual(run(synth(last5=(4320.0, 4410.0), **C), ups("UP", "DOWN"))["state_code"], ev.CONFLICT_STATE)  # 1 and 3 fail
        self.assertEqual(run(synth(nested=100, **C), ups("UP", "DOWN"))["state_code"], ev.CONFLICT_STATE)  # 1 and 2 fail

    def test_a_consolidated_trend_with_the_ssa_outside_the_corridor_keeps_its_zone_and_is_not_clipped(self):  # Q6
        below = run(synth(ssa15=4298.0, **C), ups("DOWN", "DOWN"))
        self.assertEqual((below["state_code"], below["details"]["edt_stochastic"]), ("MCD3_BEAR_BOTTOM", -2.0))
        self.assertIn("The M15 SSA 4298.00 is below LOEDT; the EDT stochastic is -2.00", below["commentary"])
        above = run(synth(ssa15=4403.0, **C), ups("DOWN", "DOWN"))
        self.assertEqual((above["state_code"], above["details"]["edt_stochastic"]), ("MCD3_BEAR_PREMIUM", 103.0))
        self.assertIn("is above UOEDT;", above["commentary"])
        sideways = run(synth(ssa15=4299.0, **C), ups("SIDEWAYS", "SIDEWAYS"))  # the sideways state holds for any value
        self.assertEqual((sideways["state_code"], sideways["details"]["edt_stochastic"]), ("MCD3_SIDEWAYS_EQUILIBRIUM", -1.0))

    def test_the_ssa_place_at_the_corridor_edges_is_inside_and_a_hair_beyond_is_outside(self):
        for ssa, phrase, stoch in (
            (4300.0, "inside the M15 corridor", 0.0), (4299.99, "below LOEDT", -0.01),
            (4400.0, "inside the M15 corridor", 100.0), (4400.01, "above UOEDT", 100.01),
        ):
            with self.subTest(ssa=ssa):
                out = run(synth(ssa15=ssa, **C), ups("DOWN", "DOWN"))
                self.assertEqual(out["details"]["edt_stochastic"], stoch)
                self.assertIn(f"is {phrase}; the EDT stochastic is {stoch:.2f}", out["commentary"])

    def test_every_candidate_can_be_the_active_indicator_on_each_timeframe(self):
        for ind15 in ("best_fit_a", "best_fit_b", "cherry_a", "cherry_b", "most_recent", "non_a", "non_b"):
            for ind5 in ("best_fit_a", "best_fit_b", "cherry_a", "cherry_b", "most_recent", "non_a", "non_b", "fractal"):
                bundle = synth(ind15=ind15, ind5=ind5, ssa15=4310.0, **C)
                up = ups("UP", "UP", **{"MCD1": dict(indicator=ind15), "MCD2": dict(indicator=ind5)})
                out = run(bundle, up)
                self.assertEqual((out["status"], out["state_code"]), ("VALID", "MCD3_BULL_VALUE"), (ind15, ind5))
                self.assertEqual(out["active_indicator"], {"M15": ind15, "M5": ind5})
                self.assertEqual(sorted(out["config_hash"]), sorted({statistics_source(ind15), statistics_source(ind5)}))

    def test_the_fractal_reads_fractal_edt_statistics_and_its_own_baseline(self):
        out = run(synth(ind5="fractal", **C), ups("UP", "UP", **{"MCD2": dict(indicator="fractal")}))
        self.assertEqual(out["state_code"], "MCD3_BULL_MID")
        self.assertIn("fractal_edt", out["config_hash"])
        self.assertEqual([lv["price"] for lv in out["levels"]], [4400.0, 4350.0, 4300.0, 4380.0, 4350.0, 4320.0])


# --------------------------------------------------------------------------- T2: boundaries


class BoundaryTests(unittest.TestCase):
    def state(self, inputs, up=None):
        return run(inputs, up)["state_code"]

    def test_nesting_share_75_is_exact_on_100_bars(self):
        for count, want in ((74, ev.OVERFLOW_STATE), (75, "MCD3_BULL_MID"), (76, "MCD3_BULL_MID")):
            with self.subTest(nested=count):
                self.assertEqual(self.state(synth(t_edt=101, nested=count, **C)), want)

    def test_nesting_share_75_is_exact_on_754_bars(self):
        for count, want in ((565, ev.OVERFLOW_STATE), (566, "MCD3_BULL_MID")):
            with self.subTest(nested=count):
                self.assertEqual(self.state(synth(t_edt=755, nested=count, **C)), want)

    def test_the_zone_edges_20_and_80_belong_to_the_outer_zones(self):
        cases = (
            (4319.99, "MCD3_BULL_VALUE"), (4320.0, "MCD3_BULL_VALUE"), (4320.01, "MCD3_BULL_MID"),
            (4379.99, "MCD3_BULL_MID"), (4380.0, "MCD3_BULL_TOP"), (4380.01, "MCD3_BULL_TOP"),
        )
        for ssa, want in cases:
            with self.subTest(ssa=ssa):
                self.assertEqual(self.state(synth(ssa15=ssa, **C), ups("UP", "UP")), want)
        for ssa, want in ((4320.0, "MCD3_BEAR_BOTTOM"), (4320.01, "MCD3_BEAR_MID"), (4380.0, "MCD3_BEAR_PREMIUM")):
            with self.subTest(ssa=ssa, trend="DOWN"):
                self.assertEqual(self.state(synth(ssa15=ssa, **C), ups("DOWN", "DOWN")), want)

    def test_the_zone_is_decided_on_the_unrounded_position(self):
        # P = 20.004: the reported number rounds to 20.0, the zone is still the middle one (20.004 > 20).
        out = run(synth(ssa15=4320.004, **C), ups("UP", "UP"))
        self.assertEqual((out["state_code"], out["details"]["edt_stochastic"]), ("MCD3_BULL_MID", 20.0))
        out = run(synth(ssa15=4319.996, **C), ups("UP", "UP"))
        self.assertEqual((out["state_code"], out["details"]["edt_stochastic"]), ("MCD3_BULL_VALUE", 20.0))

    def test_the_upper_zone_edge_is_80_and_not_a_hair_below_it(self):
        # 4379.99 gives P = 79.98999999999978: float noise puts it below 79.99, so it cannot tell 80 from 79.99. These can.
        for trend, ssa, want in (
            ("UP", 4379.995, "MCD3_BULL_MID"), ("UP", 4380.005, "MCD3_BULL_TOP"),
            ("DOWN", 4379.995, "MCD3_BEAR_MID"), ("DOWN", 4380.005, "MCD3_BEAR_PREMIUM"),
        ):
            with self.subTest(trend=trend, ssa=ssa):
                self.assertEqual(self.state(synth(ssa15=ssa, **C), ups(trend, trend)), want)

    def test_a_stochastic_that_rounds_to_zero_or_to_one_is_written_as_a_clean_number(self):
        # P = -0.003 rounds to -0.0: the number is 0.0 and the commentary reads 0.00, never "-0.00".
        out = run(synth(ssa15=4299.997, **C), ups("UP", "UP"))
        value = out["details"]["edt_stochastic"]
        self.assertEqual((out["state_code"], value), ("MCD3_BULL_VALUE", 0.0))
        self.assertEqual(math.copysign(1.0, value), 1.0)
        self.assertIn("is 0.00 (0 at LOEDT", out["commentary"])
        self.assertNotIn("-0.00", out["commentary"])
        self.assertIn("below LOEDT", out["commentary"])
        # P = 0.9996 rounds up to exactly 1.0, and stays 1.0.
        out = run(synth(ssa15=4300.9996, **C), ups("UP", "UP"))
        self.assertEqual(out["details"]["edt_stochastic"], 1.0)
        self.assertIn("is 1.00 (0 at LOEDT", out["commentary"])

    def test_the_latest_corridor_edges_are_inside_and_a_hair_beyond_is_outside(self):
        for last5, want in (
            ((4300.0, 4400.0), "MCD3_BULL_MID"),
            ((4299.99, 4400.0), ev.ESCAPE_STATE),
            ((4300.0, 4400.01), ev.ESCAPE_STATE),
            ((4300.01, 4399.99), "MCD3_BULL_MID"),
        ):
            with self.subTest(last5=last5):
                self.assertEqual(self.state(synth(last5=last5, **C)), want)

    def test_a_window_bar_whose_edge_equals_the_m15_edge_is_nested_and_a_hair_beyond_is_not(self):
        base = synth(t_edt=101, m5=(4300.0, 4400.0), **{"m15": (4300.0, 4400.0)})
        self.assertEqual(run(base)["details"]["nested_bars"], 100)

        def push(rows):
            rows[-5]["best_fit_a_loedt"] = 4299.99  # one window bar a hair below the M15 floor

        out = run(with_bars(base, "M5", push))
        self.assertEqual(out["details"]["nested_bars"], 99)

    def test_containment_49_99_fails_50_and_50_01_pass_on_each_timeframe(self):
        for tf in ("M15", "M5"):
            for rate, ok in ((49.99, False), (50.0, True), (50.01, True)):
                with self.subTest(tf=tf, rate=rate):
                    out = run(with_stat(synth(**C), tf, containment_rate=rate))
                    if ok:
                        self.assertEqual((out["status"], out["state_code"]), ("VALID", "MCD3_BULL_MID"))
                    else:
                        self.assertEqual((out["status"], out["status_reasons"]), ("INVALID", ["CONTAINMENT_LOW"]))

    def test_the_nesting_window_must_reach_48_bars(self):
        for t_edt, ok in ((48, False), (49, True), (50, True)):
            with self.subTest(t_edt=t_edt):
                out = run(synth(t_edt=t_edt, **C))
                if ok:
                    self.assertEqual((out["status"], out["details"]["nesting_window_bars"]), ("VALID", t_edt - 1))
                else:
                    self.assertEqual((out["status"], out["status_reasons"]), ("INVALID", ["INSUFFICIENT_BARS"]))

    def test_the_bar_count_must_reach_the_window(self):
        exact = synth(t_edt=301, extra5=0, **C)
        self.assertEqual(run(exact)["status"], "VALID")
        short = with_stat(exact, "M5", containment_n=302)  # N_nest 301 with 300 closed bars
        out = run(short)
        self.assertEqual((out["status"], out["status_reasons"]), ("INVALID", ["INSUFFICIENT_BARS"]))
        self.assertEqual(run(with_stat(exact, "M5", containment_n=300))["details"]["nesting_window_bars"], 299)

    def test_t_edt_falls_back_in_order(self):
        base = synth(**C)
        first = with_stat(base, "M5", containment_n=201, visual_window_bars=999, window_bars=999)
        self.assertEqual(run(first)["details"]["nesting_window_bars"], 200)
        second = with_stat(base, "M5", containment_n=DROP, visual_window_bars=151, window_bars=999)
        self.assertEqual(run(second)["details"]["nesting_window_bars"], 150)
        third = with_stat(base, "M5", containment_n=DROP, visual_window_bars="x", window_bars=121)
        self.assertEqual(run(third)["details"]["nesting_window_bars"], 120)
        none = with_stat(base, "M5", containment_n=DROP)
        self.assertEqual((run(none)["status"], run(none)["status_reasons"]), ("INVALID", ["SANITY_FAILED"]))

    def test_the_window_is_the_newest_n_nest_bars_and_older_bars_are_not_read(self):
        base = synth(**C)

        def spoil(rows):
            for row in rows[:10]:  # the 10 bars before the channel
                row["best_fit_a_uoedt"], row["best_fit_a_loedt"] = 1.0, 2.0  # inverted, outside any window

        self.assertEqual(canonical_json(run(with_bars(base, "M5", spoil))), canonical_json(run(base)))


# --------------------------------------------------------------------------- the M15 bar of an M5 bar, as-of at any slot


class NestingTests(unittest.TestCase):
    def test_the_newest_m5_bars_are_compared_with_the_last_closed_m15_bar(self):
        # Slot 20:55: last closed M5 20:50, last closed M15 20:30. M5 bars 20:30 to 20:50 (5 bars) belong to, or are newer
        # than, the M15 bar 20:30: a narrow corridor there makes exactly those 5 bars not nested.
        for slot, newer in (("2026-09-18T20:55Z", 5), ("2026-09-18T20:45Z", 3), ("2026-09-18T21:00Z", 3), ("2026-09-18T21:10Z", 5)):
            with self.subTest(slot=slot):
                base = synth(slot=slot, **C)
                last_m15 = base.bars["M15"][-1]["timestamp"]
                narrow = with_bars(
                    base, "M15", lambda rows: rows[-1].update({"non_b_uoedt": 4350.0, "non_b_loedt": 4340.0, "non_b_base_fl": 4345.0})
                )
                out = run(narrow, ups("UP", "UP", **{"MCD1": dict(slot=slot), "MCD2": dict(slot=slot)}))
                held = sum(1 for bar in narrow.bars["M5"][-300:] if bar["timestamp"] >= last_m15)
                self.assertEqual(held, newer)
                self.assertEqual(out["details"]["nested_bars"], 300 - held)

    def test_an_m15_channel_younger_than_the_window_leaves_the_older_bars_not_nested(self):
        base = synth(extra15=10, band15_from=60, **C)  # the first 60 M15 bars have no band
        out = run(base, ups("UP", "UP"))
        m15 = base.bars["M15"]
        expected = sum(
            1
            for bar in base.bars["M5"][-300:]
            if max(i for i, m in enumerate(m15) if m["timestamp"] <= bar["timestamp"]) >= 60
        )
        self.assertGreater(expected, 0)
        self.assertLess(expected, 300)
        self.assertEqual((out["status"], out["details"]["nested_bars"]), ("VALID", expected))

    def test_an_m15_bar_with_only_one_band_value_does_not_nest_and_does_not_fail(self):
        base = synth(**C)
        for column in ("non_b_loedt", "non_b_uoedt"):  # either value missing: not nested, never an error
            with self.subTest(column=column):
                half = with_bars(base, "M15", lambda rows: rows[len(rows) // 2].update({column: None}))
                out = run(half)
                self.assertEqual((out["status"], out["status_reasons"]), ("VALID", []))
                self.assertLess(out["details"]["nested_bars"], 300)

    def test_the_current_corridor_is_the_last_closed_m15_bar_even_when_the_m5_stream_lags(self):
        # The M5 stream stops 6 bars (30 minutes) before the slot, so the last closed M5 bar belongs to an older M15 bar
        # than the last closed M15 bar. Condition 3, the position and the levels still read the last closed M15 bar.
        lag = 6
        lagged = with_bars(synth(**C), "M5", lambda rows: rows.__delitem__(slice(len(rows) - lag, None)))
        lagged = with_stat(lagged, "M5", containment_n=301 - lag)  # N_nest 294: the bars that are left with a channel
        lagged = with_bars(
            lagged, "M15",
            lambda rows: rows[-1].update({"non_b_uoedt": 4410.0, "non_b_loedt": 4290.0, "non_b_base_fl": 4350.0, "non_b_ssa": 4320.0}),
        )
        m5, m15 = closed_bars(lagged, "M5"), closed_bars(lagged, "M15")
        holder = max(i for i, bar in enumerate(m15) if bar["timestamp"] <= m5[-1]["timestamp"])
        self.assertLess(holder, len(m15) - 1)  # the M15 bar of the last M5 bar is not the last one
        out = run(lagged, ups("UP", "UP"))
        self.assertEqual((out["status"], out["details"]["nesting_window_bars"]), ("VALID", 301 - lag - 1))
        self.assertEqual(out["state_code"], "MCD3_BULL_MID")  # P = (4320 - 4290) / 120 = 25; the older M15 bar would give 20
        self.assertEqual(out["details"]["edt_stochastic"], 25.0)
        self.assertEqual([lv["price"] for lv in out["levels"][:3]], [4410.0, 4350.0, 4290.0])
        self.assertIn("[4290.00, 4410.00]", out["commentary"])

    def test_without_an_m15_bar_at_or_before_the_window_start_the_reading_is_invalid(self):
        base = synth(**C)
        oldest = base.bars["M5"][-300]["timestamp"]
        cut = with_bars(base, "M15", lambda rows: rows.__setitem__(slice(None), [r for r in rows if r["timestamp"] > oldest]))
        out = run(cut)
        self.assertEqual((out["status"], out["status_reasons"]), ("INVALID", ["INSUFFICIENT_BARS"]))
        kept = with_bars(base, "M15", lambda rows: rows.__setitem__(slice(None), [r for r in rows if r["timestamp"] >= oldest // 900 * 900]))
        self.assertEqual(run(kept)["status"], "VALID")

    def test_an_m15_bar_that_opens_exactly_when_the_window_starts_is_its_own_start(self):
        # Slot 20:55, 302 closed M5 bars: the oldest opens on a quarter hour, the same instant as an M15 bar. A bundle
        # that starts at that M15 bar is complete; one that starts a bar later is not.
        base = synth(t_edt=303, extra15=0, **C)
        oldest = base.bars["M5"][-302]["timestamp"]
        self.assertEqual(oldest % 900, 0)
        self.assertEqual(base.bars["M15"][0]["timestamp"], oldest)
        out = run(base, ups("UP", "UP"))
        self.assertEqual((out["status"], out["details"]["nesting_window_bars"]), ("VALID", 302))
        later = with_bars(base, "M15", lambda rows: rows.__delitem__(0))
        self.assertEqual(run(later, ups("UP", "UP"))["status_reasons"], ["INSUFFICIENT_BARS"])

    def test_an_inverted_m15_bar_that_no_window_bar_maps_to_is_not_read(self):
        # A data gap: the three M5 bars of one M15 bar are missing, so no window bar has that M15 bar as its own.
        base = synth(t_edt=301, extra5=0, extra15=3, **C)
        target = base.bars["M15"][40]["timestamp"]
        gap = with_bars(base, "M5", lambda rows: rows.__setitem__(slice(None), [r for r in rows if not target <= r["timestamp"] < target + 900]))
        gap = with_stat(gap, "M5", containment_n=298)  # N_nest = 297, the bars that are left
        self.assertEqual(len(gap.bars["M5"]), 297)
        spoiled = with_bars(gap, "M15", lambda rows: rows[40].update({"non_b_uoedt": 4300.0, "non_b_loedt": 4400.0}))
        out = run(spoiled, ups("UP", "UP"))
        self.assertEqual((out["status"], out["details"]["nesting_window_bars"]), ("VALID", 297))
        self.assertEqual(canonical_json(out), canonical_json(run(gap, ups("UP", "UP"))))

    def test_an_inverted_m15_bar_older_than_the_window_start_is_not_read(self):
        base = synth(extra15=10, **C)
        spoiled = with_bars(base, "M15", lambda rows: rows[0].update({"non_b_uoedt": 1.0, "non_b_loedt": 2.0}))
        self.assertEqual(canonical_json(run(spoiled)), canonical_json(run(base)))

    def test_the_forming_m5_and_m15_bars_are_never_read(self):
        base = synth(**C)
        up = ups("UP", "UP")
        for tf in ("M5", "M15", None):
            changed = base
            for each in ([tf] if tf else ["M5", "M15"]):
                changed = shared.append_forming_bar(changed, each)
            self.assertEqual(canonical_json(run(changed, up)), canonical_json(run(base, up)), tf)


# --------------------------------------------------------------------------- T3: one test per pre-flight failure


class PreflightTests(unittest.TestCase):
    def setUp(self):
        self.base = synth(**C)

    def expect(self, out, status, reasons, state=None):
        self.assertEqual((out["status"], out["status_reasons"], out["state_code"]), (status, reasons, state))
        self.assertEqual(schema_errors(out), [])
        self.assertEqual(out["depends_on"], ["MCD1", "MCD2"])
        if status in ("INVALID", "STALE"):
            self.assertEqual((out["levels"], out["bias"], out["details"]), ([], None, {}))

    def test_cycle_unknown_data_status(self):
        for value in ("Stale", None, "fresh"):
            self.expect(run(dataclasses.replace(self.base, data_status=value)), "INVALID", ["SANITY_FAILED"])

    def test_cycle_data_stale(self):
        self.expect(run(dataclasses.replace(self.base, data_status="STALE")), "STALE", ["DATA_STALE"])

    def test_cycle_delayed_and_market_closed_pass(self):
        for value in ("DELAYED", "MARKET_CLOSED"):
            self.assertEqual(run(dataclasses.replace(self.base, data_status=value))["status"], "VALID")

    def test_cycle_retuning_keeps_the_state_and_adds_the_reason(self):
        out = run(dataclasses.replace(self.base, retuning=True))
        self.expect(out, "CAUTIONARY", ["RETUNING"], "MCD3_BULL_MID")
        self.assertEqual(len(out["levels"]), 6)

    def test_tier1_no_setting_on_either_timeframe(self):
        for tf in ("M15", "M5"):
            self.expect(run(with_setting(self.base, tf, DROP)), "INVALID", ["NO_SETTING"])

    def test_tier1_a_setting_that_is_not_a_candidate(self):
        self.expect(run(with_setting(self.base, "M15", "fractal")), "INVALID", ["NO_SETTING"])  # the fractal EDT is M5 only
        self.expect(run(with_setting(self.base, "M5", "nonsense")), "INVALID", ["NO_SETTING"])
        self.expect(run(with_setting(self.base, "M5", None)), "INVALID", ["NO_SETTING"])

    def test_tier1_detection_mismatch_ends_stale_and_keeps_its_reason_first(self):
        for tf, wrong in (("M15", "best_fit_a"), ("M5", "cherry_a")):
            with self.subTest(tf=tf):
                out = run(with_setting(self.base, tf, wrong))
                self.expect(out, "STALE", ["DETECTION_MISMATCH", "NO_STATS_AT_SLOT"])

    def test_tier1_candidates_populated_beside_the_set_ones_change_nothing(self):  # D3
        out = run(synth(also5=("fractal", "non_a"), also15=("non_a",), **C))
        self.assertEqual((out["status"], out["state_code"]), ("VALID", "MCD3_BULL_MID"))
        self.assertEqual(out["details"]["populated_candidates"], {"M15": ["non_a"], "M5": ["non_a", "fractal"]})

    def test_tier4_no_row_and_a_row_from_another_slot_on_each_timeframe(self):
        for tf, period in (("M15", 900), ("M5", 300)):
            source = statistics_source(self.base.active_indicator[tf])
            stats = thaw(dict(self.base.statistics))
            earlier = dict(stats[(tf, source)], captured_at=stats[(tf, source)]["captured_at"] - period)
            self.expect(run(dataclasses.replace(self.base, statistics={**stats, (tf, source): earlier})), "STALE", ["NO_STATS_AT_SLOT"])
            del stats[(tf, source)]
            self.expect(run(dataclasses.replace(self.base, statistics=stats)), "STALE", ["NO_STATS_AT_SLOT"])

    def test_tier4_the_m15_row_is_checked_before_the_m5_row(self):
        def without(inputs, tf):
            stats = thaw(dict(inputs.statistics))
            del stats[(tf, statistics_source(inputs.active_indicator[tf]))]
            return dataclasses.replace(inputs, statistics=stats)

        # M15 has no row and M5 is too low: the M15 row decides (STALE); the other way round the M15 rate decides.
        self.expect(run(with_stat(without(self.base, "M15"), "M5", containment_rate=10.0)), "STALE", ["NO_STATS_AT_SLOT"])
        self.expect(run(with_stat(without(self.base, "M5"), "M15", containment_rate=10.0)), "INVALID", ["CONTAINMENT_LOW"])

    def test_tier4_containment_below_the_floor_on_each_timeframe(self):
        for tf in ("M15", "M5"):
            self.expect(run(with_stat(self.base, tf, containment_rate=10.0)), "INVALID", ["CONTAINMENT_LOW"])

    def test_tier4_containment_missing_or_not_a_number(self):
        for tf in ("M15", "M5"):
            for value in (DROP, None, "x", float("nan"), True):
                with self.subTest(tf=tf, value=value):
                    self.expect(run(with_stat(self.base, tf, containment_rate=value)), "INVALID", ["SANITY_FAILED"])

    def test_tier4_no_t_edt_on_the_m5_row(self):
        gone = with_stat(self.base, "M5", containment_n=DROP, visual_window_bars=DROP, window_bars=DROP)
        self.expect(run(gone), "INVALID", ["SANITY_FAILED"])
        junk = with_stat(self.base, "M5", containment_n="x", visual_window_bars=None, window_bars=float("inf"))
        self.expect(run(junk), "INVALID", ["SANITY_FAILED"])

    def test_tier2_too_few_m5_bars_and_a_window_below_the_floor(self):
        short = with_bars(synth(extra5=0, **C), "M5", lambda rows: rows.__delitem__(slice(0, 20)))
        self.expect(run(short), "INVALID", ["INSUFFICIENT_BARS"])
        self.expect(run(synth(t_edt=48, **C)), "INVALID", ["INSUFFICIENT_BARS"])

    def test_tier2_m5_bars_out_of_order_missing_or_null(self):
        def swap(rows):
            rows[-10]["timestamp"], rows[-9]["timestamp"] = rows[-9]["timestamp"], rows[-10]["timestamp"]

        self.expect(run(with_bars(self.base, "M5", swap)), "INVALID", ["DISCONTINUITY"])
        for column in ("best_fit_a_uoedt", "best_fit_a_loedt"):
            for value in (None, "x"):
                with self.subTest(column=column, value=value):
                    out = run(with_bars(self.base, "M5", lambda rows: rows[-100].update({column: value})))
                    self.expect(out, "INVALID", ["DISCONTINUITY"])
        self.expect(run(with_bars(self.base, "M5", lambda rows: rows[-1].update({"timestamp": None}))), "INVALID", ["DISCONTINUITY"])
        self.expect(run(with_bars(self.base, "M5", lambda rows: rows[-1].update({"best_fit_a_base_fl": None}))), "INVALID", ["DISCONTINUITY"])
        self.expect(run(with_bars(self.base, "M5", lambda rows: rows[3].update({"timestamp": "x"}))), "INVALID", ["DISCONTINUITY"])

    def test_tier2_a_null_in_the_first_bar_of_the_window_is_a_discontinuity(self):
        self.expect(run(with_bars(self.base, "M5", lambda rows: rows[-300].update({"best_fit_a_uoedt": None}))), "INVALID", ["DISCONTINUITY"])

    def test_tier2_m15_bars_out_of_order_missing_or_null(self):
        def swap(rows):
            rows[-4]["timestamp"], rows[-3]["timestamp"] = rows[-3]["timestamp"], rows[-4]["timestamp"]

        self.expect(run(with_bars(self.base, "M15", swap)), "INVALID", ["DISCONTINUITY"])
        self.expect(run(with_bars(self.base, "M15", lambda rows: rows[2].update({"timestamp": "x"}))), "INVALID", ["DISCONTINUITY"])
        twin = lambda rows: rows[-3].update({"timestamp": rows[-4]["timestamp"]})  # noqa: E731 - two bars with the same open time
        self.expect(run(with_bars(self.base, "M15", twin)), "INVALID", ["DISCONTINUITY"])
        for column in ("non_b_ssa", "non_b_uoedt", "non_b_loedt", "non_b_base_fl"):
            with self.subTest(column=column):
                self.expect(run(with_bars(self.base, "M15", lambda rows: rows[-1].update({column: None}))), "INVALID", ["DISCONTINUITY"])

    def test_tier3_inverted_channel_anywhere_in_the_window_and_on_the_matched_m15_bars(self):
        for index in (-300, -150, -2):
            with self.subTest(m5_index=index):
                out = run(with_bars(self.base, "M5", lambda rows: rows[index].update({"best_fit_a_uoedt": 4300.0, "best_fit_a_loedt": 4300.0})))
                self.expect(out, "INVALID", ["SANITY_FAILED"])
        self.expect(run(with_bars(self.base, "M5", lambda rows: rows[-1].update({"best_fit_a_uoedt": 4300.0, "best_fit_a_loedt": 4310.0}))), "INVALID", ["SANITY_FAILED"])
        mid = lambda rows: rows[len(rows) // 2].update({"non_b_uoedt": 4300.0, "non_b_loedt": 4400.0})  # noqa: E731
        self.expect(run(with_bars(self.base, "M15", mid)), "INVALID", ["SANITY_FAILED"])
        last = lambda rows: rows[-1].update({"non_b_uoedt": 4300.0, "non_b_loedt": 4400.0})  # noqa: E731
        self.expect(run(with_bars(self.base, "M15", last)), "INVALID", ["SANITY_FAILED"])

    def test_tier3_equal_bands_on_a_matched_older_m15_bar_are_not_a_channel(self):
        # UOEDT == LOEDT is impossible (Appendix D: UOEDT <= LOEDT), here on an M15 bar that is neither the last one nor an M5 bar.
        mid = lambda rows: rows[len(rows) // 2].update({"non_b_uoedt": 4350.0, "non_b_loedt": 4350.0})  # noqa: E731
        self.expect(run(with_bars(self.base, "M15", mid)), "INVALID", ["SANITY_FAILED"])

    def test_tier3_an_inverted_m15_bar_that_only_the_oldest_window_bar_maps_to(self):
        # N_nest 300 and slot 20:55: the oldest window bar opens at :10, the third M5 bar of its M15 bar, so that M15 bar is
        # older than the one of the second window bar and only the oldest window bar maps to it.
        window = self.base.bars["M5"][-300:]
        m15 = self.base.bars["M15"]
        self.assertEqual(window[0]["timestamp"] % 900, 600)
        holder_of = lambda stamp: max(i for i, bar in enumerate(m15) if bar["timestamp"] <= stamp)  # noqa: E731
        holder = holder_of(window[0]["timestamp"])
        self.assertEqual([holder_of(row["timestamp"]) for row in window].count(holder), 1)
        spoiled = with_bars(self.base, "M15", lambda rows: rows[holder].update({"non_b_uoedt": 4300.0, "non_b_loedt": 4400.0}))
        self.expect(run(spoiled), "INVALID", ["SANITY_FAILED"])

    def test_tier3_channel_width_must_be_positive_when_present(self):
        for tf in ("M15", "M5"):
            for value in (0.0, -1.0, "x"):
                with self.subTest(tf=tf, value=value):
                    self.expect(run(with_stat(self.base, tf, channel_width=value)), "INVALID", ["SANITY_FAILED"])
            self.assertEqual(run(with_stat(self.base, tf, channel_width=DROP))["status"], "VALID")

    def test_the_first_failing_check_decides(self):
        stale_and_unset = with_setting(dataclasses.replace(self.base, data_status="STALE"), "M5", DROP)
        self.expect(run(stale_and_unset), "STALE", ["DATA_STALE"])  # cycle before tier 1
        unset_and_low = with_stat(with_setting(self.base, "M15", DROP), "M5", containment_rate=1.0)
        self.expect(run(unset_and_low), "INVALID", ["NO_SETTING"])  # tier 1 before tier 4
        low_and_short = with_stat(with_bars(synth(extra5=0, **C), "M5", lambda rows: rows.__delitem__(slice(0, 20))), "M5", containment_rate=1.0)
        self.expect(run(low_and_short), "INVALID", ["CONTAINMENT_LOW"])  # tier 4 before tier 2
        short_and_inverted = with_bars(
            with_bars(self.base, "M5", lambda rows: rows[-100].update({"best_fit_a_uoedt": 4300.0, "best_fit_a_loedt": 4400.0})),
            "M5",
            lambda rows: rows[-2].update({"best_fit_a_uoedt": None}),
        )
        self.expect(run(short_and_inverted), "INVALID", ["DISCONTINUITY"])  # tier 2 before tier 3
        inverted_and_upstream_bad = with_bars(self.base, "M5", lambda rows: rows[-100].update({"best_fit_a_uoedt": 4300.0, "best_fit_a_loedt": 4400.0}))
        self.expect(run(inverted_and_upstream_bad, ups(**{"MCD1": dict(status="INVALID")})), "INVALID", ["SANITY_FAILED"])  # tier 3 before upstream

    def test_retuning_and_a_mismatch_reasons_come_before_the_stopping_reason(self):
        out = run(with_setting(dataclasses.replace(self.base, retuning=True), "M5", "cherry_a"))
        self.expect(out, "STALE", ["RETUNING", "DETECTION_MISMATCH", "NO_STATS_AT_SLOT"])


# --------------------------------------------------------------------------- upstream (T3 for derived MCDs, T14)


class UpstreamTests(unittest.TestCase):
    def setUp(self):
        self.base = synth(ssa15=4350.0, **C)

    def out(self, up):
        return run(self.base, up)

    def test_t14_changing_mcd1s_trend_changes_the_state_in_the_same_cycle(self):
        self.assertEqual(self.out(ups("UP", "UP"))["state_code"], "MCD3_BULL_MID")
        self.assertEqual(self.out(ups("DOWN", "UP"))["state_code"], ev.CONFLICT_STATE)
        self.assertEqual(self.out(ups("DOWN", "DOWN"))["state_code"], "MCD3_BEAR_MID")
        self.assertEqual(self.out(ups("SIDEWAYS", "SIDEWAYS"))["state_code"], "MCD3_SIDEWAYS_EQUILIBRIUM")
        self.assertEqual(self.out(ups("SIDEWAYS", "UP"))["state_code"], ev.CONFLICT_STATE)

    def test_t14_changing_mcd2s_trend_changes_the_state_in_the_same_cycle(self):
        self.assertEqual(self.out(ups("UP", "DOWN"))["state_code"], ev.CONFLICT_STATE)
        self.assertEqual(self.out(ups("DOWN", "SIDEWAYS"))["state_code"], ev.CONFLICT_STATE)
        self.assertEqual(self.out(ups("DOWN", "DOWN"))["state_code"], "MCD3_BEAR_MID")

    def test_t14_the_trend_is_read_from_the_upstream_not_from_the_statistics(self):
        steep = with_stat(with_stat(self.base, "M15", regression_angle=-40.0), "M5", regression_angle=40.0)
        self.assertEqual(canonical_json(run(steep, ups("UP", "UP"))), canonical_json(self.out(ups("UP", "UP"))))
        self.assertEqual(run(steep, ups("UP", "DOWN"))["state_code"], ev.CONFLICT_STATE)

    def test_the_commentary_quotes_the_upstream_angles_and_nothing_else_of_them_changes_the_state(self):
        a = self.out(ups("UP", "UP", 12.0, 8.0))
        b = self.out(ups("UP", "UP", 33.33, 44.44))
        self.assertEqual((a["state_code"], b["state_code"]), ("MCD3_BULL_MID", "MCD3_BULL_MID"))
        self.assertIn("(M15 +12.00°, M5 +8.00°)", a["commentary"])
        self.assertIn("(M15 +33.33°, M5 +44.44°)", b["commentary"])

    def test_an_upstream_that_is_invalid_or_missing_is_unavailable(self):
        for who in ("MCD1", "MCD2"):
            with self.subTest(who=who, how="invalid"):
                out = self.out(ups(**{who: dict(status="INVALID")}))
                self.assertEqual((out["status"], out["status_reasons"], out["state_code"]), ("INVALID", [f"UPSTREAM_UNAVAILABLE:{who}"], None))
            with self.subTest(who=who, how="missing"):
                up = ups()
                del up[who]
                out = self.out(up)
                self.assertEqual((out["status"], out["status_reasons"]), ("INVALID", [f"UPSTREAM_UNAVAILABLE:{who}"]))
        for junk in (None, "x", [], {"MCD1": None, "MCD2": None}):
            out = ev.evaluate(self.base, PARAMS, junk)
            self.assertEqual((out["status"], out["status_reasons"]), ("INVALID", ["UPSTREAM_UNAVAILABLE:MCD1"]))

    def test_an_upstream_that_is_stale_makes_mcd3_stale(self):
        for who in ("MCD1", "MCD2"):
            out = self.out(ups(**{who: dict(status="STALE")}))
            self.assertEqual((out["status"], out["status_reasons"], out["state_code"]), ("STALE", [f"UPSTREAM_STALE:{who}"], None))

    def test_an_upstream_that_is_cautionary_continues_with_its_reason(self):
        out = self.out(ups(**{"MCD1": dict(status="CAUTIONARY")}))
        self.assertEqual((out["status"], out["status_reasons"], out["state_code"]), ("CAUTIONARY", ["UPSTREAM_CAUTIONARY:MCD1"], "MCD3_BULL_MID"))
        both = self.out(ups(**{"MCD1": dict(status="CAUTIONARY"), "MCD2": dict(status="CAUTIONARY")}))
        self.assertEqual(both["status_reasons"], ["UPSTREAM_CAUTIONARY:MCD1", "UPSTREAM_CAUTIONARY:MCD2"])
        self.assertEqual(schema_errors(both), [])

    def test_upstream_reasons_keep_their_order_when_a_later_one_stops_the_reading(self):
        out = self.out(ups(**{"MCD1": dict(status="CAUTIONARY"), "MCD2": dict(status="INVALID")}))
        self.assertEqual((out["status"], out["status_reasons"]), ("INVALID", ["UPSTREAM_CAUTIONARY:MCD1", "UPSTREAM_UNAVAILABLE:MCD2"]))
        out = self.out(ups(**{"MCD1": dict(status="STALE"), "MCD2": dict(status="INVALID")}))
        self.assertEqual((out["status"], out["status_reasons"]), ("STALE", ["UPSTREAM_STALE:MCD1"]))  # the first stop decides

    def test_cautions_of_an_earlier_upstream_stay_in_front_when_a_later_reading_is_unreadable(self):  # Q5
        for label, bad in (("another cycle", dict(slot="2026-09-18T20:50Z")), ("another indicator", dict(indicator="fractal"))):
            with self.subTest(label):
                out = self.out(ups(**{"MCD1": dict(status="CAUTIONARY"), "MCD2": bad}))
                self.assertEqual((out["status"], out["status_reasons"]), ("INVALID", ["UPSTREAM_CAUTIONARY:MCD1", "UPSTREAM_UNAVAILABLE:MCD2"]))

    def test_mcd3_own_cautions_and_the_upstream_cautions_add_up(self):
        out = run(dataclasses.replace(self.base, retuning=True), ups(**{"MCD2": dict(status="CAUTIONARY")}))
        self.assertEqual((out["status"], out["status_reasons"]), ("CAUTIONARY", ["RETUNING", "UPSTREAM_CAUTIONARY:MCD2"]))

    def test_an_upstream_made_for_another_cycle_or_indicator_is_unavailable(self):  # Q5
        other_slot = ups(**{"MCD2": dict(slot="2026-09-18T20:50Z")})
        self.assertEqual(self.out(other_slot)["status_reasons"], ["UPSTREAM_UNAVAILABLE:MCD2"])
        self.assertEqual(self.out(ups(**{"MCD1": dict(slot="2026-09-18T21:00Z")}))["status_reasons"], ["UPSTREAM_UNAVAILABLE:MCD1"])
        self.assertEqual(self.out(ups(**{"MCD1": dict(indicator="non_a")}))["status_reasons"], ["UPSTREAM_UNAVAILABLE:MCD1"])
        self.assertEqual(self.out(ups(**{"MCD2": dict(indicator="fractal")}))["status_reasons"], ["UPSTREAM_UNAVAILABLE:MCD2"])

    def test_an_upstream_with_an_unreadable_trend_or_angle_is_unavailable(self):  # Q5
        for who in ("MCD1", "MCD2"):
            good = ups()
            for edit in (
                lambda e: e["details"].update({"trend_direction": "SIDEWAYSS"}),
                lambda e: e["details"].pop("trend_direction"),
                lambda e: e["details"].update({"regression_angle_deg": "x"}),
                lambda e: e["details"].pop("regression_angle_deg"),
                lambda e: e.update({"details": None}),
                lambda e: e.update({"active_indicator": None}),
                lambda e: e.update({"active_indicator": {}}),
            ):
                broken = dict(good, **{who: thaw(good[who])})
                edit(broken[who])
                out = self.out(broken)
                self.assertEqual((out["status"], out["status_reasons"]), ("INVALID", [f"UPSTREAM_UNAVAILABLE:{who}"]))

    def test_the_failures_of_mcd3_own_inputs_come_before_the_upstream_check(self):
        out = run(with_stat(self.base, "M5", containment_rate=1.0), ups(**{"MCD1": dict(status="INVALID")}))
        self.assertEqual(out["status_reasons"], ["CONTAINMENT_LOW"])


# --------------------------------------------------------------------------- the 13 legacy scenarios, side by side


def legacy_evaluator_module():
    spec = importlib.util.spec_from_file_location("legacy_mcd3_evaluator", LEGACY_EVALUATOR)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


LEGACY_START = 1779999300  # on the 15-minute grid (the pre-retrofit helper's 1780000000 is not); the same shift for both sheets


def legacy_workbook(path: str, *, m15_active="best_fit_a", m5_active="best_fit_a", m15_angle=10.0, m5_angle=8.0,
                    m15_cr=70.0, m5_cr=65.0, m15_corridor=(4300.0, 4400.0), m5_corridor=(4320.0, 4380.0),
                    latest_m15_ssa=4350.0, latest_m5_uoedt=4380.0, latest_m5_loedt=4320.0, nesting_override=1.0,
                    m15_channel_inverted=False, num_m15_bars=100, num_m5_bars=300):
    """The pre-retrofit test helper's synthetic workbook (same rows, same corridors), on a grid-aligned time axis."""
    import openpyxl

    wb = openpyxl.Workbook()
    wb.remove(wb.active)
    head = ["id", "terminal_id", "timestamp", "symbol", "timeframe", "open", "high", "low", "close", "volume"]
    ws15 = wb.create_sheet("market_data_v6_M15")
    ws15.append(head + [f"{m15_active}_ssa", f"{m15_active}_uoedt", f"{m15_active}_loedt", f"{m15_active}_base_fl"])
    for i in range(num_m15_bars):
        ssa = latest_m15_ssa if i == num_m15_bars - 1 else 4350.0
        up, lo = (m15_corridor[0], m15_corridor[1]) if m15_channel_inverted else (m15_corridor[1], m15_corridor[0])
        ws15.append([f"m15_{i}", "w", LEGACY_START + i * 900, "XAUUSD", "M15", 4350.0, 4350.0, 4350.0, 4350.0, 100, ssa, up, lo, 4350.0])
    ws5 = wb.create_sheet("market_data_v6_M5")
    ws5.append(head + [f"{m5_active}_ssa", f"{m5_active}_uoedt", f"{m5_active}_loedt", f"{m5_active}_base_fl"])
    for i in range(num_m5_bars):
        if i == num_m5_bars - 1:
            up, lo = latest_m5_uoedt, latest_m5_loedt
        elif i < int(num_m5_bars * nesting_override):
            up, lo = m5_corridor[1], m5_corridor[0]
        else:
            up, lo = m15_corridor[1] + 50.0, m15_corridor[0] - 50.0
        ws5.append([f"m5_{i}", "w", LEGACY_START + i * 300, "XAUUSD", "M5", 4350.0, 4350.0, 4350.0, 4350.0, 100, 4350.0, up, lo, 4350.0])
    st = wb.create_sheet("indicator_statistics")
    st.append(["symbol", "timeframe", "source", "regression_angle", "containment_rate", "containment_n"])
    st.append(["XAUUSD", "M15", m15_active, m15_angle, m15_cr, num_m15_bars])
    st.append(["XAUUSD", "M5", m5_active, m5_angle, m5_cr, num_m5_bars])
    wb.save(path)


def legacy_like_bundle(*, m15_angle=10.0, m5_angle=8.0, m15_cr=70.0, m5_cr=65.0, m15_corridor=(4300.0, 4400.0),
                       m5_corridor=(4320.0, 4380.0), latest_m15_ssa=4350.0, latest_m5_uoedt=4380.0, latest_m5_loedt=4320.0,
                       nesting_override=1.0, m15_channel_inverted=False, num_m15_bars=100, num_m5_bars=300):
    """The same arrays as ``legacy_workbook`` as a bundle: slot at the end of the last M5 bar (and of the last M15 bar),
    ``T_EDT`` one above the bar count (the forming bar), the trend words from the angles by the legacy +-5 band."""
    slot_epoch = LEGACY_START + num_m5_bars * 300
    assert slot_epoch == LEGACY_START + num_m15_bars * 900
    rows15 = []
    for i in range(num_m15_bars):
        up, lo = (m15_corridor[0], m15_corridor[1]) if m15_channel_inverted else (m15_corridor[1], m15_corridor[0])
        rows15.append({"timestamp": LEGACY_START + i * 900, "best_fit_a_ssa": latest_m15_ssa if i == num_m15_bars - 1 else 4350.0,
                       "best_fit_a_uoedt": up, "best_fit_a_loedt": lo, "best_fit_a_base_fl": 4350.0})
    rows5 = []
    for i in range(num_m5_bars):
        if i == num_m5_bars - 1:
            up, lo = latest_m5_uoedt, latest_m5_loedt
        elif i < int(num_m5_bars * nesting_override):
            up, lo = m5_corridor[1], m5_corridor[0]
        else:
            up, lo = m15_corridor[1] + 50.0, m15_corridor[0] - 50.0
        rows5.append({"timestamp": LEGACY_START + i * 300, "best_fit_a_ssa": 4350.0, "best_fit_a_uoedt": up,
                      "best_fit_a_loedt": lo, "best_fit_a_base_fl": 4350.0})
    slot = epoch_to_slot(slot_epoch)
    stats = {
        ("M15", "best_fit_a"): {"captured_at": slot_to_epoch(stats_slot_for(slot, "M15")), "regression_angle": m15_angle,
                                "containment_rate": m15_cr, "containment_n": num_m15_bars},
        ("M5", "best_fit_a"): {"captured_at": slot_to_epoch(stats_slot_for(slot, "M5")), "regression_angle": m5_angle,
                               "containment_rate": m5_cr, "containment_n": num_m5_bars + 1},
    }
    return CycleInputs(
        symbol="XAUUSD", cycle_slot=slot, data_status="FRESH", retuning=False, bars={"M5": rows5, "M15": rows15},
        statistics=stats, stats_slot={"M5": stats_slot_for(slot, "M5"), "M15": stats_slot_for(slot, "M15")},
        active_indicator={"M5": "best_fit_a", "M15": "best_fit_a"}, config_hash={}, channel_mode={},
    )


def legacy_trend(angle: float) -> str:
    return "UP" if angle > 5.0 else "DOWN" if angle < -5.0 else "SIDEWAYS"


LEGACY_SCENARIOS = {
    "02 bull value": dict(m15_angle=12.0, m5_angle=8.0, latest_m15_ssa=4310.0),
    "03 bull mid": dict(m15_angle=12.0, m5_angle=8.0, latest_m15_ssa=4350.0),
    "04 bull top": dict(m15_angle=12.0, m5_angle=8.0, latest_m15_ssa=4390.0),
    "05 bear premium": dict(m15_angle=-15.0, m5_angle=-10.0, latest_m15_ssa=4390.0),
    "06 bear mid": dict(m15_angle=-15.0, m5_angle=-10.0, latest_m15_ssa=4350.0),
    "07 bear bottom": dict(m15_angle=-15.0, m5_angle=-10.0, latest_m15_ssa=4310.0),
    "08 sideways": dict(m15_angle=2.0, m5_angle=-1.5, latest_m15_ssa=4350.0),
    "09 condition 1": dict(m15_angle=15.0, m5_angle=-12.0),
    "10 condition 2": dict(m15_angle=10.0, m5_angle=8.0, nesting_override=0.50),
    "11 condition 3": dict(m15_angle=10.0, m5_angle=8.0, latest_m5_uoedt=4410.0),
}
# The pre-retrofit bias value of each state and the bias it becomes (decision D6): the equivalence table of the manifest.
LEGACY_BIAS_TO_NEW = {
    "HIGH_CONVICTION_BUY_DIP": "LONG", "HOLD_BULLISH_TREND_RUNNER": "LONG", "CAUTION_TAKE_PROFIT_BUY": "NEUTRAL",
    "HIGH_CONVICTION_SELL_RALLY": "SHORT", "HOLD_BEARISH_TREND_RUNNER": "SHORT", "CAUTION_TAKE_PROFIT_SELL": "NEUTRAL",
    "RANGE_BOUND_MEAN_REVERSION": "NEUTRAL", "NEUTRAL_STAND_ASIDE": "STAND_ASIDE",
}


class LegacyCases(unittest.TestCase):
    """Legacy scenarios 12 and 13 (tier 1 and tiers 3 and 4); 01 to 11 are in the state, real-cycle and equivalence tests."""

    def test_legacy_12_no_setting_is_invalid_and_two_populated_candidates_are_no_longer_a_failure(self):
        out = run(with_setting(synth(**C), "M15", DROP))
        self.assertEqual((out["status"], out["status_reasons"]), ("INVALID", ["NO_SETTING"]))
        several = run(synth(also5=("fractal", "cherry_a"), also15=("non_a", "cherry_b"), **C))  # legacy: MCD3_INVALID
        self.assertEqual((several["status"], several["state_code"]), ("VALID", "MCD3_BULL_MID"))

    def test_legacy_13_an_inverted_channel_and_low_containment(self):
        inverted = run(with_bars(synth(**C), "M15", lambda rows: [r.update({"non_b_uoedt": 4300.0, "non_b_loedt": 4400.0}) for r in rows]))
        self.assertEqual((inverted["status"], inverted["status_reasons"], inverted["state_code"]), ("INVALID", ["SANITY_FAILED"], None))
        low = run(with_stat(synth(**C), "M15", containment_rate=45.0))
        self.assertEqual((low["status"], low["status_reasons"], low["state_code"]), ("INVALID", ["CONTAINMENT_LOW"], None))

    def test_the_legacy_bias_words_map_to_the_new_bias_state_by_state(self):
        legacy_bias = {
            "MCD3_BULL_VALUE": "HIGH_CONVICTION_BUY_DIP", "MCD3_BULL_MID": "HOLD_BULLISH_TREND_RUNNER", "MCD3_BULL_TOP": "CAUTION_TAKE_PROFIT_BUY",
            "MCD3_BEAR_PREMIUM": "HIGH_CONVICTION_SELL_RALLY", "MCD3_BEAR_MID": "HOLD_BEARISH_TREND_RUNNER", "MCD3_BEAR_BOTTOM": "CAUTION_TAKE_PROFIT_SELL",
            "MCD3_SIDEWAYS_EQUILIBRIUM": "RANGE_BOUND_MEAN_REVERSION", "MCD3_NON_CONSOLIDATED_TREND_CONFLICT": "NEUTRAL_STAND_ASIDE",
            "MCD3_NON_CONSOLIDATED_OVERFLOW": "NEUTRAL_STAND_ASIDE", "MCD3_NON_CONSOLIDATED_ESCAPE": "NEUTRAL_STAND_ASIDE",
        }
        for state, old in legacy_bias.items():
            self.assertEqual(LEGACY_BIAS_TO_NEW[old], ev.STATES[state][0], state)


class EquivalenceTests(unittest.TestCase):
    """R7: the pre-retrofit evaluator and the new one side by side."""

    @classmethod
    def setUpClass(cls):
        cls.legacy = legacy_evaluator_module()
        cls.tmp = tempfile.TemporaryDirectory(ignore_cleanup_errors=True)

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def both(self, label, **kw):
        path = os.path.join(self.tmp.name, f"{label.replace(' ', '_')}.xlsx")
        legacy_workbook(path, **kw)
        old = self.legacy.MCD3ConsolidatedTrendEvaluator(excel_path=path).evaluate()
        bundle = legacy_like_bundle(**kw)
        up = ups(legacy_trend(kw.get("m15_angle", 10.0)), legacy_trend(kw.get("m5_angle", 8.0)),
                 kw.get("m15_angle", 10.0), kw.get("m5_angle", 8.0),
                 **{"MCD1": dict(slot=bundle.cycle_slot, indicator="best_fit_a"), "MCD2": dict(slot=bundle.cycle_slot, indicator="best_fit_a")})
        return old, run(bundle, up)

    def test_the_ten_synthetic_scenarios_give_the_same_state_regime_stochastic_and_the_mapped_bias(self):
        for label, kw in LEGACY_SCENARIOS.items():
            with self.subTest(label):
                old, new = self.both(label, **kw)
                e = old["evaluation"]
                self.assertEqual(new["status"], "VALID", new["status_reasons"])
                self.assertEqual(new["state_code"], e["discrete_state_code"])
                self.assertEqual(new["regime_status"], e["regime_status"])
                self.assertEqual(new["details"]["edt_stochastic"], e["edt_stochastic"])
                self.assertEqual(new["bias"], LEGACY_BIAS_TO_NEW[e["tactical_bias"]])
                c = old["consolidated_trend_conditions"]
                self.assertEqual(new["details"]["nested_bars"], c["condition_2_contained_bars"])
                self.assertEqual(new["details"]["nesting_window_bars"], c["condition_2_total_bars"])
                self.assertEqual(
                    (new["details"]["trends_aligned"], new["details"]["nesting_met"], new["details"]["current_bar_engulfed"]),
                    (c["condition_1_trend_aligned"], c["condition_2_historical_nesting_passed"], c["condition_3_current_bar_engulfed"]),
                )

    def test_the_two_failure_scenarios_are_invalid_in_both(self):
        for label, kw, reasons in (
            ("13a inverted", dict(m15_channel_inverted=True), ["SANITY_FAILED"]),
            ("13b low containment", dict(m15_cr=45.0), ["CONTAINMENT_LOW"]),
        ):
            with self.subTest(label):
                old, new = self.both(label, **kw)
                self.assertEqual(old["evaluation"]["discrete_state_code"], "MCD3_INVALID")
                self.assertEqual((new["status"], new["status_reasons"], new["state_code"]), ("INVALID", reasons, None))

    def test_legacy_01_and_the_fixture_cycles_keep_their_state_with_the_open_bar_left_out(self):
        for name in SLOTS:
            if not WORKBOOKS[name].exists():
                self.skipTest(f"{WORKBOOKS[name].name} is not in this checkout")
            with self.subTest(name):
                setting = provider.load_settings(SETTINGS[name])
                old = self.legacy.MCD3ConsolidatedTrendEvaluator(
                    excel_path=str(WORKBOOKS[name]),
                    m15_target_indicator=setting.active_indicator["M15"],
                    m5_target_indicator=setting.active_indicator["M5"],
                ).evaluate()
                new = json.loads(stored_envelope_text(name))
                self.assertEqual(new["state_code"], old["evaluation"]["discrete_state_code"])
                c = old["consolidated_trend_conditions"]
                # the pre-retrofit window counted the still-open bar (the channel's last row): one more bar, nested or not
                self.assertEqual(c["condition_2_total_bars"], new["details"]["nesting_window_bars"] + 1)
                self.assertIn(c["condition_2_contained_bars"] - new["details"]["nested_bars"], (0, 1))


# --------------------------------------------------------------------------- T13: the real cycles (stored fixtures)

# slot name: (state, bias, N_nest, nested, (cond1, cond2, cond3), stochastic, M15 levels U / B / L, M5 levels U / B / L, populated)
REAL = {
    "v1": ("MCD3_NON_CONSOLIDATED_TREND_CONFLICT", "STAND_ASIDE", 754, 0, (False, False, False), None,
           (4279.46, 4214.17, 4126.24), (4384.23, 4367.2, 4350.16), {"M15": [], "M5": ["fractal"]}),
    "v4": ("MCD3_NON_CONSOLIDATED_OVERFLOW", "STAND_ASIDE", 1133, 483, (True, False, False), None,
           (4307.72, 4214.0, 4103.45), (4249.14, 4170.13, 4096.72), {"M15": ["non_a"], "M5": ["fractal"]}),
    "v3": ("MCD3_BEAR_BOTTOM", "NEUTRAL", 1037, 973, (True, True, True), -1.02,
           (4331.53, 4252.81, 4148.18), (4289.67, 4246.41, 4194.62), {"M15": ["non_a"], "M5": ["fractal"]}),
}
LAST_BARS = {
    "v1": {"M15": "2026-09-18T20:30Z", "M5": "2026-09-18T20:50Z"},
    "v4": {"M15": "2026-09-28T23:00Z", "M5": "2026-09-28T23:10Z"},
    "v3": {"M15": "2026-09-28T14:00Z", "M5": "2026-09-28T14:10Z"},
}


class RealCycleTests(unittest.TestCase):
    def test_the_real_cycles(self):
        for name, (state, bias, n, nested, conds, stoch, lv15, lv5, populated) in REAL.items():
            with self.subTest(workbook=name):
                out = ev.evaluate(stored_inputs(name), PARAMS, stored_upstream(name))
                self.assertEqual((out["status"], out["status_reasons"], out["state_code"], out["bias"]), ("VALID", [], state, bias))
                self.assertEqual(out["last_closed_bar"], LAST_BARS[name])
                setting = provider.load_settings(SETTINGS[name]).active_indicator
                self.assertEqual(out["active_indicator"], {"M15": setting["M15"], "M5": setting["M5"]})
                d = out["details"]
                self.assertEqual((d["nesting_window_bars"], d["nested_bars"]), (n, nested))
                self.assertEqual((d["trends_aligned"], d["nesting_met"], d["current_bar_engulfed"]), conds)
                self.assertEqual(d["edt_stochastic"], stoch)
                self.assertEqual(d["populated_candidates"], populated)
                self.assertEqual(tuple(lv["price"] for lv in out["levels"][:3]), lv15)
                self.assertEqual(tuple(lv["price"] for lv in out["levels"][3:]), lv5)
                self.assertEqual([lv["tf"] for lv in out["levels"]], ["M15"] * 3 + ["M5"] * 3)
                self.assertEqual([lv["name"] for lv in out["levels"]], ["UOEDT", "baseline", "LOEDT"] * 2)
                self.assertEqual([lv["role"] for lv in out["levels"]], ["resistance", "mid", "support"] * 2)
                self.assertEqual(out["depends_on"], ["MCD1", "MCD2"])
                self.assertEqual(schema_errors(out), [])

    def test_legacy_01_v1_non_consolidated_with_a_downtrend_against_an_uptrend(self):
        out = ev.evaluate(stored_inputs("v1"), PARAMS, stored_upstream("v1"))
        self.assertEqual(out["state_code"], "MCD3_NON_CONSOLIDATED_TREND_CONFLICT")
        d = out["details"]
        self.assertEqual((d["m15_trend_direction"], d["m5_trend_direction"], d["edt_stochastic"]), ("DOWN", "UP", None))
        self.assertEqual(
            out["commentary"],
            "The M15 channel slopes down (-29.72°) while the M5 channel slopes up (+6.94°), so the two timeframes do not "
            "form a consolidated trend and no EDT stochastic is given.",
        )

    def test_the_v4_overflow_and_the_v3_consolidated_commentary(self):
        v4 = ev.evaluate(stored_inputs("v4"), PARAMS, stored_upstream("v4"))
        self.assertEqual(
            v4["commentary"],
            "Both channels slope down (M15 -20.98°, M5 -20.94°), but only 483 of 1133 closed M5 bars have their corridor "
            "inside the M15 corridor, which is fewer than three quarters, so there is no consolidated trend and no EDT "
            "stochastic is given.",
        )
        v3 = ev.evaluate(stored_inputs("v3"), PARAMS, stored_upstream("v3"))
        self.assertEqual(
            v3["commentary"],
            "Both channels slope down (M15 -15.61°, M5 -11.01°). 973 of 1037 closed M5 bars have their corridor inside the "
            "M15 corridor, and the latest M5 corridor [4194.62, 4289.67] is inside the M15 corridor [4148.18, 4331.53]. "
            "The M15 SSA 4146.30 is below LOEDT; the EDT stochastic is -1.02 (0 at LOEDT, 100 at UOEDT), in the lower zone.",
        )
        self.assertEqual(v3["summary_line"], "Consolidated downtrend, lower zone of the M15 corridor")

    def test_the_stored_bundles_hold_closed_bars_only_and_exactly_what_mcd3_reads(self):
        for name, slot in SLOTS.items():
            inputs = stored_inputs(name)
            m5, m15 = inputs.bars["M5"], inputs.bars["M15"]
            self.assertEqual(len(m5), REAL[name][2])
            self.assertEqual(m5[-1]["timestamp"], slot_to_epoch(slot) - 300)
            self.assertLessEqual(m15[-1]["timestamp"] + 900, slot_to_epoch(slot))
            self.assertGreater(m15[-1]["timestamp"] + 1800, slot_to_epoch(slot))
            self.assertLessEqual(m15[0]["timestamp"], m5[0]["timestamp"])
            self.assertLess(m5[0]["timestamp"] - m15[0]["timestamp"], 900)
            self.assertEqual(sorted(stored_upstream(name)), ["MCD1", "MCD2"])


# --------------------------------------------------------------------------- shared checks T4 to T8, T10, T12


class _Shared(shared.SharedSensorChecks):
    """T4 forming bar, T5 wrong-slot statistics, T6 setting, T7 determinism, T8 schema, T10 never throws, T12 size and
    time, on each real cycle (both timeframes)."""

    NAME = ""

    def sensor(self):
        return shared.SensorUnderTest(ev.evaluate, stored_inputs(self.NAME), PARAMS, stored_upstream(self.NAME), ("M15", "M5"))


class SharedV1(_Shared, unittest.TestCase):
    NAME = "v1"


class SharedV4(_Shared, unittest.TestCase):
    NAME = "v4"


class SharedV3(_Shared, unittest.TestCase):
    NAME = "v3"


class NeverThrowsTests(unittest.TestCase):
    def test_t10_an_error_inside_the_evaluator_becomes_evaluator_error_and_still_declares_its_dependencies(self):
        broken = Params.from_dict(
            {"mcd_id": "MCD3", "evaluator_version": "2.0.0",
             "parameters": {"min_containment_rate": {"value": 50.0, "unit": "percent", "boundary": "x", "why": "x"}}}
        )
        with self.assertLogs("mcd", level="ERROR"):
            out = ev.evaluate(synth(**C), broken, ups())
        self.assertEqual((out["status"], out["status_reasons"], out["state_code"]), ("INVALID", ["EVALUATOR_ERROR"], None))
        self.assertEqual(out["depends_on"], ["MCD1", "MCD2"])
        self.assertEqual(schema_errors(out), [])

    def test_t10_corrupted_upstream_readings_never_raise(self):
        base = synth(**C)
        good = ups()
        for label, junk in (
            ("a string", "garbage"), ("a number", 7), ("a list", [1, 2]),
            ("readings that are strings", {"MCD1": "x", "MCD2": "y"}),
            ("details that are strings", {"MCD1": dict(good["MCD1"], details="x"), "MCD2": good["MCD2"]}),
            ("a status that is a number", {"MCD1": dict(good["MCD1"], status=3), "MCD2": good["MCD2"]}),
        ):
            with self.subTest(label):
                out = ev.evaluate(base, PARAMS, junk)
                self.assertEqual(schema_errors(out), [])
                self.assertEqual((out["status"], out["state_code"]), ("INVALID", None))
                self.assertTrue(all(rc.is_known(c) for c in out["status_reasons"]))

    def test_the_evaluator_does_not_change_its_inputs(self):
        base, up = synth(**C), ups()
        before = (canonical_json(up["MCD1"]), canonical_json(up["MCD2"]), json.dumps(base.to_dict(), sort_keys=True))
        run(base, up)
        self.assertEqual(before, (canonical_json(up["MCD1"]), canonical_json(up["MCD2"]), json.dumps(base.to_dict(), sort_keys=True)))


# --------------------------------------------------------------------------- randomised sweep against the reference


class ReferenceSweepTests(unittest.TestCase):
    def test_the_evaluator_agrees_with_a_plain_restatement_of_the_rules_on_random_cycles(self):
        rng = random.Random(20261001)
        reached: set[str] = set()
        slots = ("2026-09-18T20:45Z", "2026-09-18T20:50Z", "2026-09-18T20:55Z", "2026-09-18T21:00Z", "2026-09-18T21:05Z", "2026-09-18T21:10Z")
        for _ in range(400):
            width = rng.choice((60.0, 100.0, 183.35))
            low = rng.choice((4000.0, 4123.4))
            m15 = (low, low + width)
            span5 = rng.uniform(0.2, 0.9) * width
            m5_low = rng.uniform(low, low + width - span5)
            m5 = (m5_low, m5_low + span5)
            last_inside = rng.random() < 0.7
            last5 = m5 if last_inside else (low - rng.uniform(0.0, 5.0), low + width + rng.uniform(0.0, 5.0))
            t_edt = rng.choice((49, 50, 60, 101, 160, 301))
            n = t_edt - 1
            nested = rng.randint(0, n - 1) + (1 if last_inside else 0)
            if rng.random() < 0.5:
                nested = rng.choice((int(0.75 * n), int(0.75 * n) + 1, n - (0 if last_inside else 1)))
                nested = max(0, min(nested, n - (0 if last_inside else 1)))
            ssa = rng.uniform(low - 0.25 * width, low + 1.25 * width)
            trends = (rng.choice(("UP", "DOWN", "SIDEWAYS")),) * 2 if rng.random() < 0.75 else tuple(rng.choice(("UP", "DOWN", "SIDEWAYS")) for _ in range(2))
            slot = rng.choice(slots)
            bundle = synth(slot=slot, t_edt=t_edt, m15=m15, m5=m5, last5=last5, nested=nested, ssa15=ssa, band15_from=rng.choice((0, 0, 0, 5)),
                           extra15=rng.choice((3, 10)))
            up = ups(trends[0], trends[1], **{"MCD1": dict(slot=slot), "MCD2": dict(slot=slot)})
            out = ev.evaluate(bundle, PARAMS, up)
            want = reference(bundle, up)
            self.assertEqual((out["status"], out["status_reasons"]), ("VALID", []), (slot, t_edt, nested))
            self.assertEqual(out["state_code"], want["state"], (slot, t_edt, nested, trends, ssa))
            self.assertEqual((out["details"]["nested_bars"], out["details"]["nesting_window_bars"]), (want["nested"], want["n"]))
            if want["stochastic"] is None:
                self.assertIsNone(out["details"]["edt_stochastic"])
            else:
                self.assertAlmostEqual(out["details"]["edt_stochastic"], want["stochastic"], places=2)
            self.assertEqual(schema_errors(out), [])
            reached.add(out["state_code"])
        self.assertEqual(reached, set(ev.STATES))


# --------------------------------------------------------------------------- T8, T9, T11, T12


class OutputTests(unittest.TestCase):
    def all_states(self):
        for trends, ssas in (
            (("UP", "UP"), (4310.0, 4350.0, 4390.0)),
            (("DOWN", "DOWN"), (4310.0, 4350.0, 4390.0)),
            (("SIDEWAYS", "SIDEWAYS"), (4350.0,)),
        ):
            for ssa in ssas:
                yield run(synth(ssa15=ssa, **C), ups(*trends))
        yield run(synth(**C), ups("UP", "DOWN"))
        yield run(synth(nested=150, **C), ups("UP", "UP"))
        yield run(synth(last5=(4320.0, 4410.0), **C), ups("UP", "UP"))

    def test_the_ten_states_are_all_produced(self):
        self.assertEqual({e["state_code"] for e in self.all_states()}, set(ev.STATES))

    def test_t8_every_state_and_every_failure_validates_against_the_schema(self):
        envelopes = list(self.all_states())
        base = synth(**C)
        envelopes += [run(dataclasses.replace(base, data_status=s)) for s in ("STALE", "Stale")]
        envelopes += [run(dataclasses.replace(base, retuning=True)), run(with_setting(base, "M5", "cherry_a")), run(base, ups(**{"MCD1": dict(status="STALE")}))]
        envelopes += [run(base, ups(**{"MCD2": dict(status="CAUTIONARY")})), run(base, {})]
        for envelope in envelopes:
            self.assertEqual(schema_errors(envelope), [], envelope["state_code"])

    def test_t9_the_stored_fixtures_replay_byte_for_byte_with_their_stored_upstream(self):
        replayed = 0
        for inputs_path in sorted(FIXTURES.glob("*.inputs.json")):
            stem = inputs_path.name.replace(".inputs.json", "")
            upstream = json.loads((FIXTURES / f"{stem}.upstream.json").read_text(encoding="utf-8"))
            expected = (FIXTURES / f"{stem}.envelope.json").read_text(encoding="utf-8")
            self.assertEqual(canonical_json(ev.evaluate(provider.load_inputs(inputs_path), PARAMS, upstream), pretty=True), expected, stem)
            replayed += 1
        self.assertEqual(replayed, 3)

    def test_the_output_file_is_the_v1_envelope(self):
        stored = stored_envelope_text("v1")
        self.assertEqual((HERE / "mcd3_output.json").read_text(encoding="utf-8"), stored)
        self.assertEqual(json.loads(stored)["state_code"], "MCD3_NON_CONSOLIDATED_TREND_CONFLICT")

    def test_numbers_are_rounded_to_two_decimals_at_output_only(self):
        # Inputs with more than two decimals: the state is decided on them as they are, the output is rounded half up.
        bundle = synth(ssa15=4310.005, m15=(4299.994, 4400.006), m5=(4320.0, 4380.0))
        out = run(bundle, ups("UP", "UP", 12.345, 8.675))
        self.assertEqual(out["state_code"], "MCD3_BULL_VALUE")
        self.assertEqual(out["details"]["edt_stochastic"], 10.01)  # (4310.005 - 4299.994) / 100.012 * 100 = 10.0098
        self.assertEqual([lv["price"] for lv in out["levels"][:3]], [4400.01, 4350.0, 4299.99])
        self.assertIn("(M15 +12.35°, M5 +8.68°)", out["commentary"])
        self.assertIn("[4299.99, 4400.01]", out["commentary"])

    def test_prices_in_the_commentary_are_rounded_half_up_like_the_levels(self):
        # 4400.005 is a tie on its shortest decimal form: half up gives 4400.01 (a plain float format would give 4400.00).
        out = run(synth(m15=(4299.995, 4400.005), m5=(4320.0, 4380.0)), ups("UP", "UP"))
        self.assertEqual([lv["price"] for lv in out["levels"][:3]], [4400.01, 4350.0, 4300.0])
        self.assertIn("[4300.00, 4400.01]", out["commentary"])

    def test_the_stochastic_is_reported_with_two_decimals_half_up(self):
        out = run(synth(ssa15=4310.125, **C), ups("UP", "UP"))
        self.assertEqual(out["details"]["edt_stochastic"], 10.13)
        self.assertIn("is 10.13 (0 at LOEDT", out["commentary"])

    def test_t11_no_banned_word_no_percent_no_advice_in_codes_templates_and_texts(self):
        envelopes = list(self.all_states())
        shared.assert_wording_clean(
            mcd_id="MCD3",
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
            problems += wording.check_text(f"summary of {state['code']}", state["summary"])
        self.assertEqual(problems, [])

    def test_t11_the_legacy_wording_is_what_the_check_rejects(self):
        for legacy in ("Prime Buy Dip Opportunity", "Hold long positions", "Take Profit", "Standard EDT Stochastic is 10.00%"):
            self.assertTrue(wording.check_text("legacy", legacy), legacy)
        for code in ("HIGH_CONVICTION_BUY_DIP", "CAUTION_TAKE_PROFIT_BUY", "HOLD_BULLISH_TREND_RUNNER"):
            self.assertTrue(wording.check_code(code), code)

    def test_t12_the_largest_envelope_is_within_600_tokens(self):
        envelopes = list(self.all_states())
        envelopes.append(run(dataclasses.replace(synth(**C), retuning=True), ups(**{"MCD1": dict(status="CAUTIONARY"), "MCD2": dict(status="CAUTIONARY")})))
        envelopes += [ev.evaluate(stored_inputs(name), PARAMS, stored_upstream(name)) for name in SLOTS]
        result = shared.check_size(envelopes)
        self.assertFalse(result.pending, "o200k_base is not cached: python -m mcd_common.budget --fetch")
        self.assertTrue(result.passed, (result.largest_tokens, result.method))
        self.assertEqual(result.method, "o200k_base")


    def test_t12_the_plain_real_envelopes_pass_600_and_the_real_cautionary_variants_stay_within_the_derived_ceiling(self):
        # Real prices and two 64-character config hashes make a real envelope longer than a synthetic one. The plain
        # real readings pass the standard's 600 (R15). The CAUTIONARY variants of the consolidated reading (two upstream
        # cautions, with and without RETUNING) measured 607 and 611 on 1 October 2026: over 600 and inside the ceiling of
        # 670 that Davin approved for this derived sensor (manifest A22).
        def caution(up, who, code):
            up = json.loads(json.dumps(up))
            up[who]["status"], up[who]["status_reasons"] = "CAUTIONARY", [code]
            return up

        plain = [ev.evaluate(stored_inputs(n), PARAMS, stored_upstream(n)) for n in SLOTS]
        result = shared.check_size(plain)
        self.assertFalse(result.pending)
        self.assertTrue(result.passed, (result.largest_tokens, result.method))
        base_in, base_up = stored_inputs("v3"), stored_upstream("v3")
        both = caution(caution(base_up, "MCD1", "MCD0_DEFECT_M15"), "MCD2", "MCD0_DEFECT_M5")
        variants = [ev.evaluate(base_in, PARAMS, both), ev.evaluate(dataclasses.replace(base_in, retuning=True), PARAMS, both)]
        for envelope in variants:
            self.assertEqual(envelope["status"], "CAUTIONARY")
            counted = budget.count_envelope_tokens(envelope)
            self.assertFalse(counted.pending)
            self.assertLessEqual(counted.tokens, DERIVED_CEILING)

    def test_t12_the_derived_ceiling_holds_for_every_state_with_the_candidates_of_live_data(self):
        # On live data every variant has data every cycle (architecture, review A3), so details.populated_candidates lists
        # 6 names on M15 and 7 on M5; the replica workbooks have one or two. Worst case: all of them, RETUNING and two
        # upstream cautions, in each of the ten states, on the real v3 and v4 bundles (real prices, real hashes).
        def every_candidate(inputs):
            for tf in ("M15", "M5"):
                stamp = closed_bars(inputs, tf)[-1]["timestamp"]

                def fill(rows, tf=tf, stamp=stamp):
                    for row in rows:
                        if row["timestamp"] == stamp:
                            for name in CANDIDATES[tf]:
                                for key, value in (("upper", 4400.0), ("lower", 4300.0), ("fit", 4350.0)):
                                    if row.get(channel_columns(name)[key]) is None:
                                        row[channel_columns(name)[key]] = value

                inputs = with_bars(inputs, tf, fill)
            return inputs

        def cautions(up):
            up = json.loads(json.dumps(up))
            for who, code in (("MCD1", "MCD0_DEFECT_M15"), ("MCD2", "MCD0_DEFECT_M5")):
                up[who]["status"], up[who]["status_reasons"] = "CAUTIONARY", [code]
            return up

        def trends(up, trend15, trend5):
            up = json.loads(json.dumps(up))
            up["MCD1"]["details"]["trend_direction"], up["MCD2"]["details"]["trend_direction"] = trend15, trend5
            return up

        in3, up3, in4, up4 = stored_inputs("v3"), stored_upstream("v3"), stored_inputs("v4"), stored_upstream("v4")
        last15 = closed_bars(in3, "M15")[-1]
        low, high = last15["non_b_loedt"], last15["non_b_uoedt"]
        scenarios = [(in4, up4)]  # a real overflow
        for trend15, trend5, share in (("UP", "UP", 0.05), ("UP", "UP", 0.5), ("UP", "UP", 0.95), ("DOWN", "DOWN", 0.95),
                                        ("DOWN", "DOWN", 0.5), ("DOWN", "DOWN", 0.05), ("SIDEWAYS", "SIDEWAYS", 0.5), ("UP", "DOWN", 0.5)):
            placed = with_bars(in3, "M15", lambda rows, share=share: rows[-1].update({"non_b_ssa": low + (high - low) * share}))
            scenarios.append((placed, trends(up3, trend15, trend5)))
        scenarios.append((with_bars(in3, "M5", lambda rows: rows[-1].update({"cherry_a_uoedt": high + 50.0})), up3))  # an escape
        envelopes = []
        for inputs, up in scenarios:
            envelopes.append(ev.evaluate(every_candidate(inputs), PARAMS, up))
            worst = ev.evaluate(every_candidate(dataclasses.replace(inputs, retuning=True)), PARAMS, cautions(up))
            self.assertEqual(worst["status"], "CAUTIONARY")
            self.assertEqual({tf: len(names) for tf, names in worst["details"]["populated_candidates"].items()}, {"M15": 6, "M5": 7})
            envelopes.append(worst)
        self.assertEqual({e["state_code"] for e in envelopes}, set(ev.STATES))
        result = shared.check_size(envelopes, token_budget=DERIVED_CEILING)
        self.assertFalse(result.pending, "o200k_base is not cached: python -m mcd_common.budget --fetch")
        self.assertTrue(result.passed, (result.largest_tokens, result.method))


# --------------------------------------------------------------------------- A3, A26: what the evaluator may touch


class PurityTests(unittest.TestCase):
    ALLOWED_ROOTS = {"__future__", "bisect", "decimal", "typing"}
    ALLOWED_KIT = {"envelope", "preflight", "reason_codes", "cycle_inputs"}
    FORBIDDEN_NAMES = {"open", "print", "input", "eval", "exec", "compile", "__import__"}
    FORBIDDEN_ATTRIBUTES = {"now", "utcnow", "today", "time", "monotonic", "perf_counter", "environ", "getenv", "random", "read_text", "write_text"}

    def tree(self):
        return ast.parse((HERE / "mcd3_evaluator.py").read_text(encoding="utf-8"))

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

    def test_the_evaluator_reads_no_other_mcd_code_and_has_no_target_override(self):
        source = (HERE / "mcd3_evaluator.py").read_text(encoding="utf-8")
        for forbidden in ("mcd1_evaluator", "mcd2_evaluator", "target_indicator", "openpyxl", "indicator_override"):
            self.assertNotIn(forbidden, source)

    def test_the_folder_matches_the_standard_layout(self):
        expected = {
            "concept", "concept.md", "fixtures", "legacy", "mcd3.md", "mcd3_evaluator.py", "mcd3_implementation_plan.md",
            "mcd3_output.json", "mcd3_params.yaml", "mcd3_registry.yaml", "mcd3-manifest-work-completion.md",
            "test_mcd3_unit_tests.py",
        }
        present = {p.name for p in HERE.iterdir() if p.name != "__pycache__"}
        self.assertEqual(present, expected)
        self.assertEqual(sorted(p.name for p in (HERE / "legacy").iterdir() if p.name != "__pycache__"),
                         ["mcd3_evaluator.py", "mcd3_output.json", "test_mcd3_unit_tests.py"])
        self.assertEqual(sorted(p.name for p in (HERE / "concept").iterdir()), ["mcd3-xauusd-m5-and-m15.png"])
        stems = [provider.slot_file_stem(slot) for slot in SLOTS.values()]
        want = sorted(f"{stem}.{kind}" for stem in stems for kind in ("envelope.json", "inputs.json", "source.md", "upstream.json"))
        self.assertEqual(sorted(p.name for p in FIXTURES.iterdir()), want)


# --------------------------------------------------------------------------- fixtures stay what the workbooks say; T14 live


class FixtureProvenanceTests(unittest.TestCase):
    def need(self, name):
        if not WORKBOOKS[name].exists():
            self.skipTest(f"{WORKBOOKS[name].name} is not in this checkout")

    def test_each_fixture_names_its_workbook_and_the_hash_matches(self):
        for name, slot in SLOTS.items():
            source = (FIXTURES / f"{provider.slot_file_stem(slot)}.source.md").read_text(encoding="utf-8")
            self.assertIn(f"`{slot}`", source)
            self.need(name)
            digest = hashlib.sha256(WORKBOOKS[name].read_bytes()).hexdigest()
            self.assertIn(digest, source, f"{WORKBOOKS[name].name} changed since the fixture was written (freeze, never edit)")

    def test_the_stored_bundles_are_what_the_provider_builds_from_the_workbooks(self):
        for name in SLOTS:
            self.need(name)
            inputs, _report = trimmed_bundle(name)
            self.assertEqual(json.loads(json.dumps(inputs.to_dict())), json.loads(json.dumps(stored_inputs(name).to_dict())), name)

    def test_t14_the_stored_upstream_is_what_the_committed_mcd1_and_mcd2_give_on_the_same_cycle(self):
        for name in SLOTS:
            self.need(name)
            full, _report = full_bundle(name)
            live = {k: canonical(v) for k, v in live_upstream(full).items()}
            self.assertEqual(live, stored_upstream(name), name)

    def test_a_trimmed_bundle_and_the_full_bundle_give_the_same_envelope(self):
        for name in SLOTS:
            self.need(name)
            full, _report = full_bundle(name)
            up = stored_upstream(name)
            self.assertEqual(canonical_json(ev.evaluate(full, PARAMS, up)), canonical_json(ev.evaluate(stored_inputs(name), PARAMS, up)), name)


# --------------------------------------------------------------------------- all twelve real pairings (slow, opt-in)

# (workbook, M15 setting, M5 setting): the expected new state, from the closed-bar view (plan section 5).
PAIRINGS = {
    ("v1", "non_b", "best_fit_a"): ev.CONFLICT_STATE, ("v1", "non_b", "fractal"): ev.CONFLICT_STATE,
    ("v4", "non_b", "cherry_a"): ev.OVERFLOW_STATE, ("v4", "non_b", "fractal"): ev.OVERFLOW_STATE,
    ("v4", "non_a", "cherry_a"): ev.CONFLICT_STATE, ("v4", "non_a", "fractal"): ev.CONFLICT_STATE,
    ("v2", "non_b", "cherry_a"): ev.OVERFLOW_STATE, ("v2", "non_b", "fractal"): ev.CONFLICT_STATE,
    ("v3", "non_b", "cherry_a"): "MCD3_BEAR_BOTTOM", ("v3", "non_b", "fractal"): ev.OVERFLOW_STATE,
    ("v3", "non_a", "cherry_a"): ev.OVERFLOW_STATE, ("v3", "non_a", "fractal"): ev.OVERFLOW_STATE,
}
PAIRING_BOOKS = {
    "v1": (ENGINE / "market_data_v6_replicated.xlsx", "2026-09-18T20:55Z"),
    "v2": (STACK / "market_data_v6_replicated_v2.xlsx", "2026-09-27T23:40Z"),
    "v3": (STACK / "market_data_v6_replicated_v3.xlsx", "2026-09-28T14:15Z"),
    "v4": (STACK / "market_data_v6_replicated_v4.xlsx", "2026-09-28T23:15Z"),
}


def scan_real_cycles(*, legacy: bool = True) -> list[dict]:
    """Every populated pairing of the replica workbooks present in this checkout, new against pre-retrofit."""
    rows = []
    legacy_module = legacy_evaluator_module() if legacy else None
    for (book, m15, m5), expected in PAIRINGS.items():
        path, slot = PAIRING_BOOKS[book]
        if not path.exists():
            continue
        tables = provider.read_workbook(path)
        inputs = provider.build_cycle_inputs(tables, {"slot": slot, "active_indicator": {"M5": m5, "M15": m15}})
        up = live_upstream(inputs)
        new = ev.evaluate(inputs, PARAMS, up)
        row = {"book": book, "m15": m15, "m5": m5, "expected": expected, "state": new["state_code"], "status": new["status"],
               "d": new["details"], "trends": (up["MCD1"]["details"]["trend_direction"], up["MCD2"]["details"]["trend_direction"])}
        if legacy_module is not None:
            old = legacy_module.MCD3ConsolidatedTrendEvaluator(excel_path=str(path), m15_target_indicator=m15, m5_target_indicator=m5).evaluate()
            row["legacy"] = old["evaluation"]["discrete_state_code"]
            row["legacy_conditions"] = old["consolidated_trend_conditions"]
            row["legacy_stochastic"] = old["evaluation"]["edt_stochastic"]
        rows.append(row)
    return rows


@unittest.skipUnless(os.environ.get("MCD3_FULL_SCAN") == "1", "set MCD3_FULL_SCAN=1 to scan all twelve real pairings (about 40 s)")
class FullScanTests(unittest.TestCase):
    def test_every_real_pairing_gives_the_expected_state_and_keeps_its_legacy_state(self):
        rows = scan_real_cycles()
        self.assertGreater(len(rows), 0)
        for row in rows:
            with self.subTest(row["book"], m15=row["m15"], m5=row["m5"]):
                self.assertEqual((row["status"], row["state"]), ("VALID", row["expected"]))
                self.assertEqual(row["legacy"], row["expected"])
                c = row["legacy_conditions"]
                self.assertEqual(c["condition_2_total_bars"], row["d"]["nesting_window_bars"] + 1)
                self.assertIn(c["condition_2_contained_bars"] - row["d"]["nested_bars"], (0, 1))


if __name__ == "__main__":
    unittest.main()
