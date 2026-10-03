"""The registry loader and the execution order (architecture 2.2 and 2.13; standard 9.1 and 9.2)."""

from __future__ import annotations

import random
import tempfile
import textwrap
import unittest
from pathlib import Path
from typing import Any

import yaml

from mcd_worker import registry as reg
from mcd_worker.errors import ConfigError
from mcd_worker.tests import support as s


# --------------------------------------------------------------------------- the real four


class RealRegistryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.registry = reg.load_registry()

    def test_the_four_registries_load_in_numeric_order(self) -> None:
        self.assertEqual(list(self.registry), ["MCD0", "MCD1", "MCD2", "MCD3"])

    def test_kinds_versions_and_links(self) -> None:
        facts = {i: (x.kind, x.evaluator_version, x.depends_on, x.uses_channel) for i, x in self.registry.items()}
        self.assertEqual(
            facts,
            {
                "MCD0": ("gate", "1.0.0", (), ()),
                "MCD1": ("independent", "2.0.1", (), ("M15",)),
                "MCD2": ("independent", "2.0.1", (), ("M5",)),
                "MCD3": ("derived", "2.0.0", ("MCD1", "MCD2"), ("M5", "M15")),
            },
        )

    def test_each_sensor_runs_its_evaluators_own_function(self) -> None:
        import sys

        for mcd_id, sensor in self.registry.items():
            module = sys.modules[f"mcd{sensor.number}_evaluator"]
            self.assertIs(sensor.evaluate, module.evaluate, mcd_id)
            self.assertEqual(module.EVALUATOR_VERSION, sensor.evaluator_version, mcd_id)
            self.assertEqual(module.MCD_ID, mcd_id)

    def test_the_params_files_belong_to_the_same_version(self) -> None:
        for mcd_id, sensor in self.registry.items():
            self.assertEqual(sensor.params.mcd_id, mcd_id)
            self.assertEqual(sensor.params.evaluator_version, sensor.evaluator_version)

    def test_the_state_registers_are_read_with_their_bias(self) -> None:
        self.assertEqual(len(self.registry["MCD0"].states), 4)
        self.assertEqual({e.bias for e in self.registry["MCD0"].states.values()}, {"NEUTRAL"})
        self.assertEqual(len(self.registry["MCD1"].states), 9)
        self.assertEqual(len(self.registry["MCD2"].states), 9)
        self.assertEqual(len(self.registry["MCD3"].states), 10)
        self.assertEqual(self.registry["MCD3"].states["MCD3_NON_CONSOLIDATED_ESCAPE"].bias, "STAND_ASIDE")
        self.assertEqual(self.registry["MCD3"].states["MCD3_BULL_VALUE"].regime_status, "BULLISH_CONSOLIDATED_VALUE_ZONE")

    def test_loading_twice_gives_the_same_registry(self) -> None:
        again = reg.load_registry()
        self.assertEqual(list(again), list(self.registry))
        for mcd_id in again:
            self.assertEqual(again[mcd_id].states, self.registry[mcd_id].states)

    def test_the_real_registry_orders_as_the_architecture_says(self) -> None:
        self.assertEqual(reg.execution_order(self.registry, list(self.registry)), ("MCD0", "MCD1", "MCD2", "MCD3"))


# --------------------------------------------------------------------------- a made-up engine folder


REGISTRY_YAML = """\
mcd_id: {mcd_id}
name: Made up {mcd_id}
evaluator_version: {version}
kind: {kind}
timeframes: {timeframes}
depends_on: {depends_on}
uses_channel: {uses_channel}
flag: {flag}
states:
{states}
"""


def write_mcd(
    root: Path,
    number: int,
    *,
    kind: str = "independent",
    version: str = "1.0.0",
    params_version: str | None = None,
    module_version: str | None = None,
    module_id: str | None = None,
    depends_on: str = "[]",
    uses_channel: str = "[M5]",
    timeframes: str = "[M5]",
    flag: str = "'off'",
    states: str | None = None,
    skip: tuple[str, ...] = (),
    folder: str | None = None,
    mcd_id: str | None = None,
) -> None:
    mcd_id = mcd_id or f"MCD{number}"
    folder_name = folder or f"mcd{number}"
    base = root / folder_name
    base.mkdir(parents=True, exist_ok=True)
    state_rows = states if states is not None else f"  - {{code: {mcd_id}_STATE, bias: NEUTRAL, regime_status: null}}"
    files = {
        f"{folder_name}_registry.yaml": REGISTRY_YAML.format(
            mcd_id=mcd_id, version=version, kind=kind, timeframes=timeframes, depends_on=depends_on,
            uses_channel=uses_channel, flag=flag, states=state_rows,
        ),
        f"{folder_name}_params.yaml": (
            f"mcd_id: {mcd_id}\nevaluator_version: {params_version or version}\nparameters:\n"
            "  p: {value: 1, unit: x, boundary: '>=', why: made up}\n"
        ),
        f"{folder_name}_evaluator.py": (
            f"MCD_ID = {module_id or mcd_id!r}\nEVALUATOR_VERSION = {module_version or version!r}\n"
            "def evaluate(inputs, params, upstream):\n    return None\n"
        ),
    }
    for name, text in files.items():
        if name.split("_", 1)[1] not in skip:
            (base / name).write_text(textwrap.dedent(text) if name.endswith(".py") else text, encoding="utf-8", newline="\n")


class MadeUpEngineTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.root = Path(self._tmp.name)

    def problems(self) -> list[str]:
        with self.assertRaises(ConfigError) as caught:
            reg.load_registry(self.root)
        return list(caught.exception.problems)

    def assertProblem(self, fragment: str) -> None:
        found = self.problems()
        self.assertTrue(any(fragment in p for p in found), f"{fragment!r} not in {found}")

    def test_a_clean_folder_loads(self) -> None:
        write_mcd(self.root, 4)
        self.assertEqual(list(reg.load_registry(self.root)), ["MCD4"])

    def test_a_folder_with_no_mcd_is_refused(self) -> None:
        (self.root / "mcd_common").mkdir()
        self.assertProblem("no mcdN folder")

    def test_only_mcd_folders_are_read(self) -> None:
        write_mcd(self.root, 4)
        (self.root / "mcd_common").mkdir()
        (self.root / "mcd_worker").mkdir()
        (self.root / "mcd16").mkdir()  # not an MCD id
        self.assertEqual(list(reg.load_registry(self.root)), ["MCD4"])

    def test_a_flag_written_as_a_yaml_boolean_is_refused_with_the_reason(self) -> None:
        write_mcd(self.root, 4, flag="off")  # unquoted: YAML 1.1 reads it as false
        self.assertProblem("quote it")

    def test_a_flag_outside_the_three_values_is_refused(self) -> None:
        write_mcd(self.root, 4, flag="'maybe'")
        self.assertProblem("flag must be one of")

    def test_registry_and_params_must_agree_on_the_version(self) -> None:
        write_mcd(self.root, 4, version="1.0.0", params_version="1.1.0")
        self.assertProblem("registry says 1.0.0, the params file says 1.1.0")

    def test_registry_and_evaluator_must_agree_on_the_version(self) -> None:
        write_mcd(self.root, 4, version="1.0.0", module_version="2.0.0")
        self.assertProblem("registry says 1.0.0, the evaluator says 2.0.0")

    def test_the_evaluator_must_say_it_is_this_mcd(self) -> None:
        write_mcd(self.root, 4, module_id="MCD5")
        self.assertProblem("the evaluator says it is MCD5")

    def test_a_missing_file_is_named(self) -> None:
        write_mcd(self.root, 4, skip=("evaluator.py",))
        self.assertProblem("missing mcd4_evaluator.py")

    def test_the_folder_number_must_match_the_id(self) -> None:
        write_mcd(self.root, 4, mcd_id="MCD5")
        self.assertProblem("lives in folder mcd4")

    def test_an_independent_mcd_may_not_depend_on_anything(self) -> None:
        write_mcd(self.root, 1)
        write_mcd(self.root, 4, kind="independent", depends_on="[MCD1]")
        self.assertProblem("kind independent has no dependencies")

    def test_a_derived_mcd_must_name_a_dependency(self) -> None:
        write_mcd(self.root, 4, kind="derived", depends_on="[]")
        self.assertProblem("a derived MCD must name at least one dependency")

    def test_a_dependency_on_an_unknown_mcd_is_refused(self) -> None:
        write_mcd(self.root, 4, kind="derived", depends_on="[MCD9]")
        self.assertProblem("MCD4 depends on MCD9, which is not in the registry")

    def test_a_dependency_on_itself_is_refused(self) -> None:
        write_mcd(self.root, 4, kind="derived", depends_on="[MCD4]")
        self.assertProblem("MCD4 depends on itself")

    def test_a_dependency_cycle_is_refused_and_named(self) -> None:
        write_mcd(self.root, 4, kind="derived", depends_on="[MCD5]")
        write_mcd(self.root, 5, kind="derived", depends_on="[MCD4]")
        self.assertProblem("dependency cycle: MCD4 -> MCD5 -> MCD4")

    def test_only_mcd0_may_be_a_gate(self) -> None:
        write_mcd(self.root, 4, kind="gate", uses_channel="[]")
        found = self.problems()
        self.assertTrue(any("only MCD0 is a gate" in p for p in found), found)

    def test_a_gate_is_not_itself_marked(self) -> None:
        write_mcd(self.root, 0, kind="gate", uses_channel="[M5]")
        self.assertProblem("a gate is not itself marked")

    def test_a_state_code_must_carry_the_mcd_prefix(self) -> None:
        write_mcd(self.root, 4, states="  - {code: MCD5_STATE, bias: NEUTRAL, regime_status: null}")
        self.assertProblem("a state code must start with 'MCD4_'")

    def test_a_bias_outside_the_four_is_refused(self) -> None:
        write_mcd(self.root, 4, states="  - {code: MCD4_STATE, bias: DAVIN, regime_status: null}")
        self.assertProblem("has bias 'DAVIN'")

    def test_a_state_listed_twice_is_refused(self) -> None:
        rows = "  - {code: MCD4_STATE, bias: NEUTRAL, regime_status: null}\n  - {code: MCD4_STATE, bias: LONG, regime_status: null}"
        write_mcd(self.root, 4, states=rows)
        self.assertProblem("appears twice")

    def test_a_timeframe_outside_m5_and_m15_is_refused(self) -> None:
        write_mcd(self.root, 4, uses_channel="[H1]")
        self.assertProblem("uses_channel must be a list of distinct timeframes")

    def test_every_problem_in_every_folder_is_reported_together(self) -> None:
        write_mcd(self.root, 4, flag="'maybe'")
        write_mcd(self.root, 5, version="1.0.0", params_version="1.1.0")
        found = self.problems()
        self.assertTrue(any("MCD4: flag must be one of" in p for p in found), found)
        self.assertTrue(any("MCD5: registry says" in p for p in found), found)

    def test_an_evaluator_with_no_evaluate_is_refused(self) -> None:
        write_mcd(self.root, 4)
        (self.root / "mcd4" / "mcd4_evaluator.py").write_text("MCD_ID = 'MCD4'\nEVALUATOR_VERSION = '1.0.0'\n", encoding="utf-8")
        self.assertProblem("has no evaluate")

    def test_an_evaluator_that_does_not_import_is_a_config_problem_not_a_crash(self) -> None:
        write_mcd(self.root, 4)
        (self.root / "mcd4" / "mcd4_evaluator.py").write_text("raise RuntimeError('broken')\n", encoding="utf-8")
        self.assertProblem("cannot be loaded (RuntimeError: broken)")


# --------------------------------------------------------------------------- the order


def sensors(*specs: tuple[str, str, tuple[str, ...]]) -> reg.Registry:
    """``(id, kind, depends_on)`` per MCD, as a registry with stub evaluators."""
    return reg.Registry(
        [s.sensor(mcd_id, kind, s.stub(mcd_id), depends_on=deps, uses_channel=()) for mcd_id, kind, deps in specs]
    )


class ExecutionOrderTests(unittest.TestCase):
    def test_gate_then_independents_by_number_then_derived(self) -> None:
        registry = sensors(
            ("MCD6", "independent", ()), ("MCD0", "gate", ()), ("MCD4", "derived", ("MCD1", "MCD6")), ("MCD2", "independent", ()),
            ("MCD1", "independent", ()),
        )
        self.assertEqual(reg.execution_order(registry, list(registry)), ("MCD0", "MCD1", "MCD2", "MCD6", "MCD4"))

    def test_derived_mcds_follow_their_derived_dependencies(self) -> None:
        registry = sensors(
            ("MCD1", "independent", ()), ("MCD3", "derived", ("MCD1",)), ("MCD5", "derived", ("MCD3",)), ("MCD4", "derived", ("MCD1",)),
            ("MCD6", "derived", ("MCD5", "MCD4")),
        )
        order = reg.execution_order(registry, list(registry))
        self.assertEqual(order, ("MCD1", "MCD3", "MCD4", "MCD5", "MCD6"))
        for mcd_id in registry:
            for dep in registry[mcd_id].depends_on:
                self.assertLess(order.index(dep), order.index(mcd_id), (dep, mcd_id))

    def test_a_derived_mcd_numbered_below_its_dependency_still_runs_after_it(self) -> None:
        registry = sensors(("MCD2", "derived", ("MCD7",)), ("MCD7", "derived", ("MCD8",)), ("MCD8", "independent", ()))
        self.assertEqual(reg.execution_order(registry, list(registry)), ("MCD8", "MCD7", "MCD2"))

    def test_the_order_does_not_depend_on_how_the_registry_was_listed_or_enabled(self) -> None:
        specs = [
            ("MCD0", "gate", ()), ("MCD1", "independent", ()), ("MCD2", "independent", ()), ("MCD3", "derived", ("MCD1", "MCD2")),
            ("MCD4", "derived", ("MCD3",)),
        ]
        expected = ("MCD0", "MCD1", "MCD2", "MCD3", "MCD4")
        rng = random.Random(7)
        for _ in range(20):
            shuffled = specs[:]
            rng.shuffle(shuffled)
            registry = sensors(*shuffled)
            enabled = [m for m, _, _ in shuffled]
            rng.shuffle(enabled)
            self.assertEqual(reg.execution_order(registry, enabled), expected)

    def test_disabled_mcds_are_left_out(self) -> None:
        registry = sensors(("MCD0", "gate", ()), ("MCD1", "independent", ()), ("MCD2", "independent", ()), ("MCD3", "derived", ("MCD1", "MCD2")))
        self.assertEqual(reg.execution_order(registry, ["MCD0", "MCD2"]), ("MCD0", "MCD2"))
        self.assertEqual(reg.execution_order(registry, []), ())

    def test_a_derived_mcd_is_not_held_back_by_a_dependency_that_is_not_enabled(self) -> None:
        registry = sensors(("MCD1", "independent", ()), ("MCD3", "derived", ("MCD1",)), ("MCD4", "derived", ("MCD3",)))
        self.assertEqual(reg.execution_order(registry, ["MCD4"]), ("MCD4",))

    def test_an_unknown_id_is_refused(self) -> None:
        registry = sensors(("MCD1", "independent", ()))
        with self.assertRaises(ConfigError):
            reg.execution_order(registry, ["MCD1", "MCD9"])

    def test_a_registry_with_a_cycle_cannot_be_built(self) -> None:
        with self.assertRaises(ConfigError) as caught:
            sensors(("MCD3", "derived", ("MCD4",)), ("MCD4", "derived", ("MCD3",)))
        self.assertIn("dependency cycle: MCD3 -> MCD4 -> MCD3", "; ".join(caught.exception.problems))

    def test_a_longer_cycle_is_found_and_the_report_is_the_same_every_time(self) -> None:
        graph = {"MCD2": ("MCD3",), "MCD3": ("MCD4",), "MCD4": ("MCD2",), "MCD1": ()}
        first = reg.find_cycle(graph)
        self.assertEqual(first, ["MCD2", "MCD3", "MCD4", "MCD2"])
        self.assertEqual(reg.find_cycle(dict(reversed(list(graph.items())))), first)

    def test_no_cycle_gives_an_empty_report(self) -> None:
        self.assertEqual(reg.find_cycle({"MCD1": (), "MCD2": ("MCD1",), "MCD3": ("MCD1", "MCD2")}), [])

    def test_a_duplicate_id_is_refused(self) -> None:
        a = s.sensor("MCD1", "independent", s.stub("MCD1"))
        with self.assertRaises(ConfigError) as caught:
            reg.Registry([a, a])
        self.assertIn("appears twice", "; ".join(caught.exception.problems))

    def test_two_gates_are_refused(self) -> None:
        with self.assertRaises(ConfigError):
            sensors(("MCD0", "gate", ()), ("MCD1", "gate", ()))


class SensorFromEntryTests(unittest.TestCase):
    """The pure layer, without files."""

    def entry(self, **changes: Any) -> dict[str, Any]:
        base = yaml.safe_load(REGISTRY_YAML.format(
            mcd_id="MCD4", version="1.0.0", kind="independent", timeframes="[M5]", depends_on="[]", uses_channel="[M5]", flag="'off'",
            states="  - {code: MCD4_STATE, bias: NEUTRAL, regime_status: null}",
        ))
        base.update(changes)
        return base

    def build(self, entry: dict[str, Any]) -> reg.Sensor:
        return reg.sensor_from_entry(entry, folder_number=4, params=s.params_for("MCD4"), evaluate=lambda *a: None)

    def test_a_good_entry_builds_a_sensor(self) -> None:
        sensor = self.build(self.entry())
        self.assertEqual((sensor.mcd_id, sensor.kind, sensor.number, sensor.uses_channel, sensor.registry_flag), ("MCD4", "independent", 4, ("M5",), "off"))

    def test_an_entry_that_is_not_a_mapping_is_refused(self) -> None:
        with self.assertRaises(ConfigError):
            self.build([])  # type: ignore[arg-type]

    def test_a_bad_id_is_refused(self) -> None:
        with self.assertRaises(ConfigError):
            self.build(self.entry(mcd_id="MCD16"))

    def test_a_version_that_is_not_three_numbers_is_refused(self) -> None:
        with self.assertRaises(ConfigError):
            self.build(self.entry(evaluator_version="1.0"))

    def test_an_empty_state_register_is_refused(self) -> None:
        with self.assertRaises(ConfigError) as caught:
            self.build(self.entry(states=[]))
        self.assertIn("states must be a non-empty list", "; ".join(caught.exception.problems))

    def test_a_regime_that_is_not_text_is_refused(self) -> None:
        with self.assertRaises(ConfigError):
            self.build(self.entry(states=[{"code": "MCD4_STATE", "bias": "NEUTRAL", "regime_status": 5}]))

    def test_depends_on_must_be_distinct_mcd_ids(self) -> None:
        for bad in (["MCD1", "MCD1"], ["mcd1"], "MCD1", [1]):
            with self.assertRaises(ConfigError, msg=repr(bad)):
                self.build(self.entry(kind="derived", depends_on=bad))

    def test_a_timeframe_list_must_be_distinct_and_known(self) -> None:
        for bad in ([], ["M5", "M5"], ["H1"], "M5"):
            with self.assertRaises(ConfigError, msg=repr(bad)):
                self.build(self.entry(timeframes=bad))


if __name__ == "__main__":
    unittest.main()
