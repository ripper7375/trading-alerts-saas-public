"""CycleInputs, Params, slot and grid arithmetic, closed-bar rule, channel catalogue."""

import dataclasses
import json
import os
import tempfile
import textwrap
import unittest
from types import MappingProxyType

from mcd_common import cycle_inputs as ci
from mcd_common.testing import append_forming_bar

from .support import SLOT, synthetic_inputs


class SlotAndGridTests(unittest.TestCase):
    def test_slot_round_trip(self):
        epoch = ci.slot_to_epoch("2026-09-18T20:55Z")
        self.assertEqual(epoch, 1789764900)
        self.assertEqual(ci.epoch_to_slot(epoch), "2026-09-18T20:55Z")

    def test_bad_slots_rejected(self):
        for bad in ("2026-09-18T20:57Z", "2026-09-18 20:55", "20:55", "2026-09-18T20:55:00Z", None, 5):
            with self.assertRaises(ValueError, msg=repr(bad)):
                ci.slot_to_epoch(bad)  # type: ignore[arg-type]

    def test_epoch_off_the_grid_rejected(self):
        with self.assertRaises(ValueError):
            ci.epoch_to_slot(1789764901)

    def test_stats_slot_m5_is_the_slot(self):
        self.assertEqual(ci.stats_slot_for("2026-09-18T20:55Z", "M5"), "2026-09-18T20:55Z")

    def test_stats_slot_m15_is_floored_to_the_quarter_hour(self):
        cases = {
            "2026-09-18T20:55Z": "2026-09-18T20:45Z",
            "2026-09-18T20:50Z": "2026-09-18T20:45Z",
            "2026-09-18T20:45Z": "2026-09-18T20:45Z",
            "2026-09-18T20:40Z": "2026-09-18T20:30Z",
            "2026-09-28T23:15Z": "2026-09-28T23:15Z",
            "2026-09-28T23:10Z": "2026-09-28T23:00Z",
            "2026-09-29T00:05Z": "2026-09-29T00:00Z",
        }
        for slot, expected in cases.items():
            self.assertEqual(ci.stats_slot_for(slot, "M15"), expected, slot)

    def test_bar_is_closed_rule_2(self):
        slot = "2026-09-18T20:55Z"
        e = ci.slot_to_epoch
        self.assertTrue(ci.bar_is_closed(e("2026-09-18T20:50Z"), "M5", slot))  # 20:50 + 5 min == slot: closed
        self.assertFalse(ci.bar_is_closed(e("2026-09-18T20:55Z"), "M5", slot))
        self.assertTrue(ci.bar_is_closed(e("2026-09-18T20:30Z"), "M15", slot))  # closes at 20:45
        self.assertFalse(ci.bar_is_closed(e("2026-09-18T20:45Z"), "M15", slot))  # forming


class FreezeTests(unittest.TestCase):
    def test_bundle_is_read_only(self):
        inputs = synthetic_inputs()
        with self.assertRaises(dataclasses.FrozenInstanceError):
            inputs.cycle_slot = "2026-09-18T21:00Z"
        with self.assertRaises(TypeError):
            inputs.active_indicator["M5"] = "non_b"  # mapping proxy
        with self.assertRaises(TypeError):
            inputs.bars["M5"][0]["close"] = 1.0  # a bar is a mapping proxy
        with self.assertRaises(TypeError):
            inputs.bars["M5"][0] = {}  # bars are a tuple

    def test_params_are_read_only(self):
        from .stub_mcd import PARAMS

        with self.assertRaises(TypeError):
            PARAMS.values["min_window_bars"] = 1

    def test_a_proxy_wrapping_mutable_data_is_frozen_too(self):
        """F1: ``freeze`` used to return any ``MappingProxyType`` unchanged, lists and dicts inside included."""
        bar = {"timestamp": 1, "close": 4000.0}
        inputs = dataclasses.replace(
            synthetic_inputs(),
            bars=MappingProxyType({"M5": [bar]}),
            active_indicator=MappingProxyType({"M5": "best_fit_a"}),
            statistics=MappingProxyType({("M5", "best_fit_a"): {"captured_at": 1, "nested": [1, 2]}}),
        )
        self.assertIsInstance(inputs.bars["M5"], tuple)            # a list, not a tuple, before the fix
        with self.assertRaises(TypeError):
            inputs.bars["M5"][0]["close"] = 1.0                     # a dict, not a proxy, before the fix
        self.assertIsInstance(inputs.statistics[("M5", "best_fit_a")]["nested"], tuple)
        with self.assertRaises(TypeError):
            inputs.active_indicator["M5"] = "non_b"

    def test_a_proxy_is_copied_so_the_callers_dict_cannot_change_the_bundle(self):
        source = {"M5": "best_fit_a"}
        bars = {"M5": [{"timestamp": 1, "close": 4000.0}]}
        inputs = dataclasses.replace(
            synthetic_inputs(), active_indicator=MappingProxyType(source), bars=MappingProxyType(bars)
        )
        source["M5"] = "non_b"
        bars["M5"][0]["close"] = 1.0
        bars["M5"].append({"timestamp": 2})
        self.assertEqual(inputs.active_indicator["M5"], "best_fit_a")
        self.assertEqual(inputs.bars["M5"][0]["close"], 4000.0)
        self.assertEqual(len(inputs.bars["M5"]), 1)

    def test_freezing_a_frozen_bundle_gives_an_equal_frozen_bundle(self):
        """``dataclasses.replace`` runs ``__post_init__`` again on data that is already frozen."""
        inputs = synthetic_inputs()
        again = dataclasses.replace(inputs)
        self.assertEqual(again, inputs)
        with self.assertRaises(TypeError):
            again.bars["M5"][0]["close"] = 1.0
        self.assertEqual(ci.thaw(ci.freeze(inputs.bars)), ci.thaw(inputs.bars))

    def test_params_freeze_a_proxy_too(self):
        params = ci.Params(
            mcd_id="MCD2", evaluator_version="2.0.0",
            values=MappingProxyType({"windows": [1, 2]}), meta=MappingProxyType({}),
        )
        self.assertEqual(params["windows"], (1, 2))

    def test_a_tuple_of_dicts_is_frozen_too(self):
        """G2a: standard §4 names the tuple as the bar container; if only lists were frozen, a bundle
        built with ``bars={"M5": (dict, ...)}`` would keep mutable dicts."""
        bar = {"timestamp": 1, "close": 4000.0, "nested": [1, 2]}
        inputs = dataclasses.replace(synthetic_inputs(), bars={"M5": (bar,)})
        with self.assertRaises(TypeError):
            inputs.bars["M5"][0]["close"] = 1.0
        self.assertIsInstance(inputs.bars["M5"][0]["nested"], tuple)
        bar["close"] = 1.0                                           # the caller's dict is copied, not kept
        bar["nested"].append(3)
        self.assertEqual(inputs.bars["M5"][0]["close"], 4000.0)
        self.assertEqual(inputs.bars["M5"][0]["nested"], (1, 2))
        self.assertEqual(ci.freeze(([1, 2], {"a": [3]})), ((1, 2), MappingProxyType({"a": (3,)})))
        self.assertIsInstance(ci.freeze((1, 2)), tuple)

    def test_params_meta_is_read_only_and_copied(self):
        """G2b: only ``Params.values`` was checked; ``meta`` is frozen by the same ``__post_init__``."""
        params = ci.Params.from_dict(ParamsTests.GOOD)
        with self.assertRaises(TypeError):
            params.meta["sideways_angle_deg"]["unit"] = "radians"   # an entry is a proxy
        with self.assertRaises(TypeError):
            params.meta["another"] = {}                             # the mapping is a proxy
        entry = {"unit": "degrees", "boundary": "<= value", "why": "band", "extra": [1]}
        source = {"angle": entry}
        built = ci.Params(mcd_id="MCD2", evaluator_version="2.0.0", values={"angle": 5.0}, meta=source)
        entry["unit"] = "radians"                                   # the caller's dict cannot reach it
        entry["extra"].append(2)
        source["late"] = {}
        self.assertEqual(built.meta["angle"]["unit"], "degrees")
        self.assertEqual(built.meta["angle"]["extra"], (1,))
        self.assertNotIn("late", built.meta)


class BundleJsonTests(unittest.TestCase):
    def test_round_trip_is_exact(self):
        inputs = synthetic_inputs()
        text = json.dumps(inputs.to_dict())
        again = ci.CycleInputs.from_dict(json.loads(text))
        self.assertEqual(again, inputs)
        self.assertEqual(json.dumps(again.to_dict()), text)

    def test_fields_are_part_b2_plus_stats_slot_and_context_levels(self):
        names = [f.name for f in dataclasses.fields(ci.CycleInputs)]
        self.assertEqual(
            sorted(names),
            sorted(
                [
                    "symbol", "cycle_slot", "data_status", "retuning", "bars", "statistics",
                    "stats_slot", "active_indicator", "config_hash", "channel_mode", "context_levels",
                ]
            ),
        )


ORIGINAL_KEYS = [
    "symbol", "cycle_slot", "data_status", "retuning", "bars", "statistics", "stats_slot", "active_indicator", "config_hash", "channel_mode",
]
SR = {"M5": {"sr_1": 4350.5, "sr_2": None}, "M15": {"sr_1": 4351.25, "sr_5": 4390.0}}


class ContextLevelsTests(unittest.TestCase):
    """Decision D8 of the build step 4 plan (standard 1.0.6): an optional, additive section that no evaluator reads."""

    def test_it_is_empty_by_default(self):
        inputs = synthetic_inputs()
        self.assertEqual(dict(inputs.context_levels), {})
        self.assertFalse(inputs.context_levels)

    def test_an_empty_section_is_left_out_of_the_json_form_so_the_old_text_and_hash_are_unchanged(self):
        inputs = synthetic_inputs()
        self.assertEqual(list(inputs.to_dict()), ORIGINAL_KEYS)  # the ten keys, in their order, and nothing else
        explicit = synthetic_inputs(context_levels={})
        self.assertEqual(explicit, inputs)
        self.assertEqual(json.dumps(explicit.to_dict(), sort_keys=True), json.dumps(inputs.to_dict(), sort_keys=True))

    def test_a_section_with_levels_is_written_last_and_round_trips_exactly(self):
        inputs = synthetic_inputs(context_levels=SR)
        data = inputs.to_dict()
        self.assertEqual(list(data), ORIGINAL_KEYS + ["context_levels"])
        self.assertEqual(data["context_levels"], SR)
        text = json.dumps(data)
        again = ci.CycleInputs.from_dict(json.loads(text))
        self.assertEqual(again, inputs)
        self.assertEqual(json.dumps(again.to_dict()), text)

    def test_a_none_level_is_kept_so_an_unresolved_slot_stays_visible(self):
        data = synthetic_inputs(context_levels=SR).to_dict()
        self.assertIn("sr_2", data["context_levels"]["M5"])
        self.assertIsNone(data["context_levels"]["M5"]["sr_2"])

    def test_a_bundle_without_the_key_or_with_null_reads_as_empty(self):
        data = synthetic_inputs().to_dict()
        self.assertNotIn("context_levels", data)
        self.assertEqual(dict(ci.CycleInputs.from_dict(data).context_levels), {})
        self.assertEqual(dict(ci.CycleInputs.from_dict({**data, "context_levels": None}).context_levels), {})
        self.assertEqual(dict(ci.CycleInputs.from_dict({**data, "context_levels": {}}).context_levels), {})

    def test_the_section_is_read_only_and_copied(self):
        source = {"M15": {"sr_1": 4351.25}}
        inputs = synthetic_inputs(context_levels=source)
        with self.assertRaises(TypeError):
            inputs.context_levels["M5"] = {}
        with self.assertRaises(TypeError):
            inputs.context_levels["M15"]["sr_1"] = 1.0
        source["M15"]["sr_1"] = 9.99  # the caller's dict changing later cannot change the bundle
        self.assertEqual(inputs.context_levels["M15"]["sr_1"], 4351.25)

    def test_two_bundles_that_differ_only_in_the_section_are_not_equal(self):
        self.assertNotEqual(synthetic_inputs(), synthetic_inputs(context_levels=SR))
        self.assertNotEqual(synthetic_inputs(context_levels=SR), synthetic_inputs(context_levels={"M5": {"sr_1": 1.0}}))

    def test_the_closed_bar_view_and_every_other_field_ignore_it(self):
        plain, with_levels = synthetic_inputs(), synthetic_inputs(context_levels=SR)
        self.assertEqual(ci.closed_bars(plain, "M5"), ci.closed_bars(with_levels, "M5"))
        for name in ORIGINAL_KEYS:
            self.assertEqual(getattr(plain, name), getattr(with_levels, name), name)


class ClosedBarsTests(unittest.TestCase):
    def test_last_closed_bar_is_20_50(self):
        inputs = synthetic_inputs()
        self.assertEqual(ci.last_closed_bar_slots(inputs, ["M5"]), {"M5": "2026-09-18T20:50Z"})

    def test_forming_bar_in_the_bundle_is_not_returned(self):
        inputs = synthetic_inputs()
        with_forming = append_forming_bar(inputs, "M5")
        self.assertEqual(len(with_forming.bars["M5"]), len(inputs.bars["M5"]) + 1)
        self.assertEqual(ci.closed_bars(with_forming, "M5"), ci.closed_bars(inputs, "M5"))
        self.assertEqual(ci.slot_to_epoch(SLOT), with_forming.bars["M5"][-1]["timestamp"])

    def test_bars_without_a_numeric_timestamp_are_skipped_not_raised(self):
        inputs = synthetic_inputs()
        bars = ci.thaw(inputs.bars)
        bars["M5"].append({"timestamp": None, "close": 1.0})
        changed = dataclasses.replace(inputs, bars=bars)
        self.assertEqual(len(ci.closed_bars(changed, "M5")), 60)


class CatalogueTests(unittest.TestCase):
    def test_candidates(self):
        self.assertEqual(len(ci.CANDIDATES["M15"]), 7)
        self.assertEqual(len(ci.CANDIDATES["M5"]), 8)
        self.assertNotIn("fractal", ci.CANDIDATES["M15"])
        self.assertIn("fractal", ci.CANDIDATES["M5"])

    def test_fractal_maps_to_fractal_edt_and_its_own_columns(self):
        self.assertEqual(ci.statistics_source("fractal"), "fractal_edt")
        self.assertEqual(ci.statistics_source("non_b"), "non_b")
        self.assertEqual(ci.channel_columns("fractal")["upper"], "fractal_uoedt")
        self.assertEqual(ci.channel_columns("fractal")["baseline"], "fractal_best_fl")
        self.assertEqual(ci.channel_columns("cherry_a")["baseline"], "cherry_a_base_fl")
        self.assertEqual(ci.channel_columns("cherry_a")["fit"], "cherry_a_ssa")

    def test_is_populated(self):
        bar = {"best_fit_a_uoedt": 4384.0, "best_fit_a_loedt": 4350.0, "best_fit_a_ssa": 4377.0}
        self.assertTrue(ci.is_populated(bar, "best_fit_a"))
        self.assertFalse(ci.is_populated(bar, "non_b"))
        self.assertFalse(ci.is_populated({**bar, "best_fit_a_loedt": None}, "best_fit_a"))
        self.assertFalse(ci.is_populated({**bar, "best_fit_a_uoedt": 0}, "best_fit_a"))
        self.assertFalse(ci.is_populated({**bar, "best_fit_a_ssa": True}, "best_fit_a"))


class ParamsTests(unittest.TestCase):
    GOOD = {
        "mcd_id": "MCD2",
        "evaluator_version": "2.0.0",
        "parameters": {
            "sideways_angle_deg": {"value": 5.0, "unit": "degrees", "boundary": "abs(angle) <= value", "why": "band"}
        },
    }

    def test_loads_and_reads(self):
        params = ci.Params.from_dict(self.GOOD)
        self.assertEqual(params["sideways_angle_deg"], 5.0)
        self.assertEqual(params.meta["sideways_angle_deg"]["unit"], "degrees")
        self.assertIsNone(params.get("nope"))

    def test_every_parameter_needs_unit_boundary_and_why(self):
        for missing in ("unit", "boundary", "why"):
            bad = json.loads(json.dumps(self.GOOD))
            del bad["parameters"]["sideways_angle_deg"][missing]
            with self.assertRaises(ValueError, msg=missing):
                ci.Params.from_dict(bad)
        blank = json.loads(json.dumps(self.GOOD))
        blank["parameters"]["sideways_angle_deg"]["why"] = "  "
        with self.assertRaises(ValueError):
            ci.Params.from_dict(blank)

    def test_bad_identity_rejected(self):
        for change in ({"mcd_id": "MCD16"}, {"mcd_id": "mcd2"}, {"evaluator_version": "2.0"}, {"parameters": {}}):
            with self.assertRaises(ValueError, msg=str(change)):
                ci.Params.from_dict({**self.GOOD, **change})

    def test_yaml_appendix_c3_shape_loads(self):
        text = textwrap.dedent(
            """\
            mcd_id: MCD2
            evaluator_version: 2.0.0
            parameters:
              sideways_angle_deg: {value: 5.0, unit: degrees, boundary: 'abs(angle) <= value is SIDEWAYS', why: 'trend band used by MCD1-MCD3'}
              min_window_bars: {value: 48, unit: closed M5 bars, boundary: '>= value', why: '4 hours of M5'}
            """
        )
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "p.yaml")
            with open(path, "w", encoding="utf-8") as handle:
                handle.write(text)
            params = ci.Params.from_yaml(path)
        self.assertEqual(params["min_window_bars"], 48)


if __name__ == "__main__":
    unittest.main()
