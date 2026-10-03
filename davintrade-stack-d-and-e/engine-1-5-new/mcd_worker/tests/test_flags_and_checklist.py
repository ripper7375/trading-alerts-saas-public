"""Flags and the nine-item checklist (architecture 2.9, requirement R14; Davin's Q7: items 1 to 6 gate shadow, all nine gate live).

The part 1 plan asked for a synthetic MCD4: ``off`` always allowed, ``live`` refused at eight of nine, accepted at
nine; the shadow threshold per Q7; and a pin that the four registries and the worker's flags agree.
"""

from __future__ import annotations

import copy
import tempfile
import unittest
from pathlib import Path
from typing import Any

import yaml

from mcd_worker import flags as fl
from mcd_worker.cycle_runner import Worker
from mcd_worker.errors import ConfigError
from mcd_worker.registry import Registry, load_registry
from mcd_worker.tests import support as s

NINE = tuple(range(1, 10))


def world_with_mcd4(kind: str = "independent", depends_on: tuple[str, ...] = (), uses_channel: tuple[str, ...] = ("M5",)) -> Registry:
    """The synthetic four plus an MCD4."""
    sensors = s.synthetic_sensors()
    sensors.append(s.sensor("MCD4", kind, s.stub("MCD4"), depends_on=depends_on, uses_channel=uses_channel))
    return Registry(sensors)


def problems(registry: Registry, flags: dict[str, str], checklists: dict[str, fl.Checklist]) -> list[str]:
    return fl.flag_problems(flags, registry, checklists)


BASE_FLAGS = {"MCD0": "off", "MCD1": "off", "MCD2": "off", "MCD3": "off", "MCD4": "off"}


class TheItemsTests(unittest.TestCase):
    def test_the_nine_items_are_the_architectures_in_order(self) -> None:
        self.assertEqual([i for i, _ in fl.CHECKLIST_ITEMS], list(NINE))
        self.assertEqual(
            [n for _, n in fl.CHECKLIST_ITEMS],
            [
                "Spec approved by Davin", "Evaluator on the closed-bar view", "Tests (13-style suite, envelope and forming-bar case)",
                "State register entries (code, plain meaning, bias)", "Levels contributed (or none)", "depends_on",
                "Dispatch-matrix entry and playbook chunk", "Synthesis rows", "Statistics measured",
            ],
        )

    def test_items_1_to_6_gate_shadow_and_all_nine_gate_live(self) -> None:
        self.assertEqual(fl.SHADOW_ITEMS, (1, 2, 3, 4, 5, 6))
        self.assertEqual(fl.LIVE_ITEMS, NINE)

    def test_the_allowed_flag_at_every_threshold(self) -> None:
        self.assertEqual(s.checklist("MCD4", []).allowed_flag(), "off")
        self.assertEqual(s.checklist("MCD4", range(1, 6)).allowed_flag(), "off")
        self.assertEqual(s.checklist("MCD4", range(1, 7)).allowed_flag(), "shadow")
        self.assertEqual(s.checklist("MCD4", range(1, 9)).allowed_flag(), "shadow")
        self.assertEqual(s.checklist("MCD4", NINE).allowed_flag(), "live")

    def test_passing_7_to_9_without_1_to_6_allows_nothing(self) -> None:
        self.assertEqual(s.checklist("MCD4", (7, 8, 9)).allowed_flag(), "off")

    def test_pending_for_names_what_still_stops_a_flag(self) -> None:
        checklist = s.checklist("MCD4", (1, 2, 3, 4, 5, 6, 8))
        self.assertEqual(checklist.pending_for("shadow"), ())
        self.assertEqual(checklist.pending_for("live"), (7, 9))
        self.assertEqual(checklist.pending_for("off"), ())

    def test_flag_values_and_ranks(self) -> None:
        self.assertEqual(fl.FLAG_VALUES, ("off", "shadow", "live"))
        self.assertLess(fl.FLAG_RANK["off"], fl.FLAG_RANK["shadow"])
        self.assertLess(fl.FLAG_RANK["shadow"], fl.FLAG_RANK["live"])


class ASyntheticMcd4Tests(unittest.TestCase):
    """MCD4 is independent here, so only its own checklist is in the way."""

    def setUp(self) -> None:
        self.registry = world_with_mcd4()
        self.others = {i: s.checklist(i, NINE) for i in ("MCD0", "MCD1", "MCD2", "MCD3")}

    def check(self, flag: str, passed: tuple[int, ...]) -> list[str]:
        flags = {**BASE_FLAGS, "MCD0": "live", "MCD1": "live", "MCD2": "live", "MCD3": "live", "MCD4": flag}
        return problems(self.registry, flags, {**self.others, "MCD4": s.checklist("MCD4", passed)})

    def test_off_is_always_allowed(self) -> None:
        for passed in ((), (1,), (1, 2, 3), NINE):
            self.assertEqual(self.check("off", passed), [], passed)

    def test_shadow_is_refused_unless_items_1_to_6_all_passed(self) -> None:
        for missing in range(1, 7):
            passed = tuple(i for i in range(1, 7) if i != missing)
            found = self.check("shadow", passed)
            self.assertEqual(len(found), 1, missing)
            self.assertIn(f"needs checklist items [{missing}]", found[0])

    def test_shadow_is_accepted_at_six_of_nine(self) -> None:
        self.assertEqual(self.check("shadow", (1, 2, 3, 4, 5, 6)), [])

    def test_live_is_refused_at_every_eight_of_nine(self) -> None:
        for missing in NINE:
            passed = tuple(i for i in NINE if i != missing)
            found = self.check("live", passed)
            self.assertEqual(len(found), 1, missing)
            self.assertIn(f"needs checklist items [{missing}]", found[0])

    def test_live_is_accepted_at_nine_of_nine(self) -> None:
        self.assertEqual(self.check("live", NINE), [])

    def test_live_names_every_missing_item_and_what_the_checklist_allows(self) -> None:
        found = self.check("live", (1, 2, 3, 4, 5, 6))
        self.assertEqual(len(found), 1)
        self.assertIn("[7, 8, 9]", found[0])
        self.assertIn("it allows 'shadow'", found[0])

    def test_a_flag_above_off_with_no_checklist_is_refused(self) -> None:
        flags = {**BASE_FLAGS, "MCD4": "shadow"}
        found = problems(self.registry, flags, {})
        self.assertTrue(any("MCD4: flag 'shadow' needs a checklist" in p for p in found), found)


class FlagValueTests(unittest.TestCase):
    def setUp(self) -> None:
        self.registry = Registry(s.synthetic_sensors())
        self.checklists = s.shadow_ready(self.registry)

    def test_a_boolean_or_wrongly_cased_or_missing_flag_is_refused(self) -> None:
        for bad in (False, True, "Off", "SHADOW", None, 0, ""):
            flags = {"MCD0": "off", "MCD1": bad, "MCD2": "off", "MCD3": "off"}
            found = problems(self.registry, flags, self.checklists)
            self.assertTrue(any("MCD1: flag must be one of" in p for p in found), (bad, found))

    def test_a_flag_for_an_unknown_mcd_is_refused(self) -> None:
        flags = {"MCD0": "off", "MCD1": "off", "MCD2": "off", "MCD3": "off", "MCD9": "off"}
        self.assertTrue(any("unknown MCD 'MCD9'" in p for p in problems(self.registry, flags, self.checklists)))

    def test_an_mcd_with_no_flag_is_refused(self) -> None:
        flags = {"MCD0": "off", "MCD1": "off", "MCD2": "off"}
        self.assertTrue(any("MCD3 has no flag" in p for p in problems(self.registry, flags, self.checklists)))

    def test_check_flags_raises_with_every_problem(self) -> None:
        with self.assertRaises(ConfigError) as caught:
            fl.check_flags({"MCD0": "maybe", "MCD1": "off", "MCD2": "off", "MCD3": "off", "MCD9": "off"}, self.registry, self.checklists)
        self.assertEqual(len(caught.exception.problems), 2)


class WhatAFlagMayReadTests(unittest.TestCase):
    """My two extra rules: no MCD is higher than an MCD it depends on, and no channel MCD is higher than the gate."""

    def setUp(self) -> None:
        self.registry = Registry(s.synthetic_sensors())
        self.checklists = s.all_passed(self.registry)

    def run_flags(self, **flags: str) -> list[str]:
        full = {"MCD0": "off", "MCD1": "off", "MCD2": "off", "MCD3": "off", **flags}
        return problems(self.registry, full, self.checklists)

    def test_a_derived_mcd_needs_its_dependencies_enabled(self) -> None:
        found = self.run_flags(MCD0="shadow", MCD3="shadow")
        self.assertTrue(any("MCD3: flag 'shadow' is higher than 'off' of MCD1" in p for p in found), found)
        self.assertTrue(any("of MCD2" in p for p in found), found)

    def test_a_derived_mcd_may_not_be_live_above_a_shadow_dependency(self) -> None:
        found = self.run_flags(MCD0="live", MCD1="shadow", MCD2="live", MCD3="live")
        self.assertEqual(len(found), 1)
        self.assertIn("MCD3: flag 'live' is higher than 'shadow' of MCD1", found[0])

    def test_the_whole_set_may_be_shadow_or_live(self) -> None:
        self.assertEqual(self.run_flags(MCD0="shadow", MCD1="shadow", MCD2="shadow", MCD3="shadow"), [])
        self.assertEqual(self.run_flags(MCD0="live", MCD1="live", MCD2="live", MCD3="live"), [])

    def test_a_dependency_may_be_higher_than_its_dependent(self) -> None:
        self.assertEqual(self.run_flags(MCD0="live", MCD1="live", MCD2="live", MCD3="shadow"), [])

    def test_a_channel_mcd_needs_the_gate(self) -> None:
        found = self.run_flags(MCD1="shadow")
        self.assertEqual(len(found), 1)
        self.assertIn("MCD1: flag 'shadow' is higher than 'off' of MCD0", found[0])

    def test_a_channel_mcd_may_not_be_live_above_a_shadow_gate(self) -> None:
        found = self.run_flags(MCD0="shadow", MCD2="live")
        self.assertEqual(len(found), 1)
        self.assertIn("higher than 'shadow' of MCD0", found[0])

    def test_the_gate_alone_may_run(self) -> None:
        self.assertEqual(self.run_flags(MCD0="shadow"), [])

    def test_everything_off_is_fine(self) -> None:
        self.assertEqual(self.run_flags(), [])

    def test_a_registry_with_a_channel_mcd_and_no_gate_is_refused(self) -> None:
        registry = Registry([x for x in s.synthetic_sensors() if x.mcd_id != "MCD0"])
        found = problems(registry, {"MCD1": "off", "MCD2": "off", "MCD3": "off"}, s.all_passed(registry))
        self.assertTrue(any("needs the gate MCD0 in the registry" in p for p in found), found)

    def test_required_mcds_are_the_dependencies_then_the_gate(self) -> None:
        self.assertEqual(fl.required_mcds(self.registry, "MCD3"), ("MCD1", "MCD2", "MCD0"))
        self.assertEqual(fl.required_mcds(self.registry, "MCD1"), ("MCD0",))
        self.assertEqual(fl.required_mcds(self.registry, "MCD0"), ())


# --------------------------------------------------------------------------- the checklist file format


def good_checklist() -> dict[str, Any]:
    return {
        "schema": "mcd-checklist/1",
        "mcd_id": "MCD4",
        "items": [
            {"id": i, "name": n, "status": "passed", "evidence": "shown", "files": ["a.md"]} if i <= 6
            else {"id": i, "name": n, "status": "pending", "waits_on": "later"}
            for i, n in fl.CHECKLIST_ITEMS
        ],
    }


class ChecklistFormatTests(unittest.TestCase):
    def test_a_good_file_loads(self) -> None:
        checklist = fl.checklist_from_dict(good_checklist())
        self.assertEqual(checklist.mcd_id, "MCD4")
        self.assertEqual(checklist.allowed_flag(), "shadow")

    def bad(self, mutate) -> list[str]:
        data = copy.deepcopy(good_checklist())
        mutate(data)
        return fl.checklist_problems(data)

    def test_each_defect_is_reported(self) -> None:
        checks = [
            ("wrong schema", lambda d: d.update(schema="mcd-checklist/2"), "schema must be"),
            ("no mcd_id", lambda d: d.update(mcd_id=""), "mcd_id must be a string"),
            ("unknown key", lambda d: d.update(extra=1), "unknown keys ['extra']"),
            ("eight items", lambda d: d["items"].pop(), "exactly 9 entries"),
            ("renamed item", lambda d: d["items"][2].update(name="Tests"), "must be item 3"),
            ("reordered", lambda d: d["items"].reverse(), "must be item 1"),
            ("unknown status", lambda d: d["items"][0].update(status="done"), "status must be 'passed' or 'pending'"),
            ("passed with no evidence", lambda d: d["items"][0].update(evidence=" "), "needs evidence text"),
            ("passed with no files", lambda d: d["items"][0].update(files=[]), "at least one evidence file"),
            ("passed with a non-text file", lambda d: d["items"][0].update(files=[3]), "at least one evidence file"),
            ("pending with no reason", lambda d: d["items"][8].update(waits_on=""), "must say what it waits on"),
            ("item with an unknown key", lambda d: d["items"][0].update(notes="x"), "unknown keys ['notes']"),
            ("item not a mapping", lambda d: d["items"].__setitem__(0, "item"), "must be a mapping"),
        ]
        for label, mutate, fragment in checks:
            found = self.bad(mutate)
            self.assertTrue(any(fragment in p for p in found), f"{label}: {fragment!r} not in {found}")

    def test_a_non_mapping_file_is_refused(self) -> None:
        self.assertEqual(fl.checklist_problems([]), ["checklist: the file must hold a mapping"])

    def test_items_not_a_list_is_refused(self) -> None:
        data = good_checklist()
        data["items"] = "none"
        self.assertTrue(any("exactly 9 entries" in p for p in fl.checklist_problems(data)))

    def test_from_dict_raises_with_the_problems(self) -> None:
        data = good_checklist()
        data["schema"] = "x"
        with self.assertRaises(ConfigError):
            fl.checklist_from_dict(data)


class ChecklistFilesTests(unittest.TestCase):
    def test_a_file_whose_id_differs_from_its_name_is_refused(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            Path(tmp, "MCD5.yaml").write_text(yaml.safe_dump(good_checklist()), encoding="utf-8")
            with self.assertRaises(ConfigError) as caught:
                fl.load_checklists(tmp)
        self.assertIn("the file name says 'MCD5'", "; ".join(caught.exception.problems))

    def test_a_broken_file_is_reported_with_its_name(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            Path(tmp, "MCD4.yaml").write_text("items: [", encoding="utf-8")
            with self.assertRaises(ConfigError) as caught:
                fl.load_checklists(tmp)
        self.assertIn("MCD4.yaml", "; ".join(caught.exception.problems))

    def test_a_good_directory_loads(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            Path(tmp, "MCD4.yaml").write_text(yaml.safe_dump(good_checklist()), encoding="utf-8")
            self.assertEqual(list(fl.load_checklists(tmp)), ["MCD4"])


# --------------------------------------------------------------------------- the committed files


class CommittedChecklistTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.checklists = fl.load_checklists()

    def test_there_is_one_checklist_per_registered_mcd(self) -> None:
        self.assertEqual(sorted(self.checklists), ["MCD0", "MCD1", "MCD2", "MCD3"])

    def test_every_mcd_allows_shadow_and_none_allows_live(self) -> None:
        for mcd_id, checklist in self.checklists.items():
            self.assertEqual(checklist.allowed_flag(), "shadow", mcd_id)
            self.assertEqual(checklist.passed(), frozenset(range(1, 7)), mcd_id)

    def test_items_7_to_9_wait_on_later_steps_and_say_which(self) -> None:
        for mcd_id, checklist in self.checklists.items():
            for item in checklist.items[6:]:
                self.assertEqual(item.status, "pending", (mcd_id, item.item_id))
                self.assertTrue(item.waits_on, (mcd_id, item.item_id))

    def test_the_evidence_files_exist(self) -> None:
        if not (s.REPO / "docs").is_dir():
            self.skipTest("the repository docs are not in this checkout")
        for mcd_id, checklist in self.checklists.items():
            for item in checklist.items:
                for name in item.files:
                    self.assertTrue((s.REPO / name).is_file(), f"{mcd_id} item {item.item_id}: {name} does not exist")

    def test_the_manifest_lines_the_evidence_cites_say_what_it_claims(self) -> None:
        """Items 1 to 6 cite manifest lines A1 to A16; the manifest must show Pass (or not applicable) on those it relies on."""
        if not (s.REPO / "docs").is_dir():
            self.skipTest("the repository docs are not in this checkout")
        for number in range(4):
            text = (s.ENGINE / f"mcd{number}" / f"mcd{number}-manifest-work-completion.md").read_text(encoding="utf-8")
            rows = {line.split("|")[1].strip(): line for line in text.splitlines() if line.startswith("| A")}
            for line_id in ("A1", "A2", "A4", "A10", "A11", "A21"):
                self.assertIn("Pass", rows[line_id].split("|")[3], f"mcd{number} {line_id}")
            for line_id in ("A18", "A19", "A23", "A24"):
                self.assertIn("Pending", rows[line_id].split("|")[3], f"mcd{number} {line_id}")


class CommittedConfigTests(unittest.TestCase):
    def test_the_committed_flags_are_all_off(self) -> None:
        config = fl.load_worker_config()
        self.assertEqual(dict(config.flags), {"MCD0": "off", "MCD1": "off", "MCD2": "off", "MCD3": "off"})

    def test_the_config_names_exactly_the_registered_mcds(self) -> None:
        self.assertEqual(set(fl.load_worker_config().flags), set(load_registry()))

    def test_the_registries_and_the_worker_config_agree_on_every_flag(self) -> None:
        """A flag changed in one place only fails here, so the registry stays the record of what the worker runs."""
        config = fl.load_worker_config().flags
        registry = load_registry()
        for mcd_id, sensor in registry.items():
            self.assertEqual(config[mcd_id], sensor.registry_flag, mcd_id)

    def test_the_committed_flags_pass_their_own_checklists(self) -> None:
        worker = Worker.load()
        self.assertEqual(worker.enabled, ())
        self.assertEqual(worker.order, ())

    def test_an_all_off_worker_runs_a_cycle_and_returns_nothing(self) -> None:
        result = Worker.load().run_cycle(s.bundle("v1"))
        self.assertEqual(result.results, ())
        self.assertEqual(result.order, ())
        self.assertIsNone(result.gate_status)


class WorkerConfigFormatTests(unittest.TestCase):
    def test_each_defect_is_refused(self) -> None:
        good = {"schema": "mcd-worker-config/1", "flags": {"MCD0": "off"}}
        self.assertEqual(dict(fl.worker_config_from_dict(good).flags), {"MCD0": "off"})
        bad = [
            ({"schema": "mcd-worker-config/2", "flags": {"MCD0": "off"}}, "schema must be"),
            ({"schema": "mcd-worker-config/1", "flags": {}}, "non-empty mapping"),
            ({"schema": "mcd-worker-config/1", "flags": {"MCD0": False}}, "quote it"),
            ({"schema": "mcd-worker-config/1", "flags": {"MCD0": "maybe"}}, "must be one of"),
            ({"schema": "mcd-worker-config/1", "flags": {"MCD0": "off"}, "extra": 1}, "unknown keys"),
            ([], "must hold a mapping"),
        ]
        for data, fragment in bad:
            with self.assertRaises(ConfigError, msg=repr(data)) as caught:
                fl.worker_config_from_dict(data)
            self.assertIn(fragment, "; ".join(caught.exception.problems))

    def test_a_missing_or_broken_file_is_a_config_error(self) -> None:
        with self.assertRaises(ConfigError):
            fl.load_worker_config("does-not-exist.yaml")
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp, "w.yaml")
            path.write_text("flags: [", encoding="utf-8")
            with self.assertRaises(ConfigError):
                fl.load_worker_config(path)

    def test_an_unquoted_off_in_the_file_is_refused(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp, "w.yaml")
            path.write_text("schema: mcd-worker-config/1\nflags:\n  MCD0: off\n", encoding="utf-8")
            with self.assertRaises(ConfigError) as caught:
                fl.load_worker_config(path)
        self.assertIn("quote it", "; ".join(caught.exception.problems))


class WorkerStartupTests(unittest.TestCase):
    def test_load_with_an_override_is_checked_like_the_file(self) -> None:
        with self.assertRaises(ConfigError) as caught:
            Worker.load(flags={"MCD0": "live"})
        self.assertIn("MCD0: flag 'live' needs checklist items [7, 8, 9]", "; ".join(caught.exception.problems))

    def test_load_refuses_an_override_for_an_unknown_mcd(self) -> None:
        with self.assertRaises(ConfigError):
            Worker.load(flags={"MCD9": "shadow"})

    def test_load_refuses_a_derived_mcd_without_its_dependencies(self) -> None:
        with self.assertRaises(ConfigError):
            Worker.load(flags={"MCD0": "shadow", "MCD3": "shadow"})

    def test_load_accepts_the_whole_set_at_shadow(self) -> None:
        worker = Worker.load(flags=s.SHADOW_ALL)
        self.assertEqual(worker.enabled, ("MCD0", "MCD1", "MCD2", "MCD3"))
        self.assertEqual(dict(worker.flags), s.SHADOW_ALL)

    def test_a_registry_folder_with_no_flag_is_refused(self) -> None:
        sensors = s.synthetic_sensors()
        sensors.append(s.sensor("MCD4", "independent", s.stub("MCD4"), uses_channel=("M5",)))
        with self.assertRaises(ConfigError) as caught:
            Worker(Registry(sensors), {"MCD0": "off", "MCD1": "off", "MCD2": "off", "MCD3": "off"}, s.shadow_ready(("MCD0", "MCD1", "MCD2", "MCD3", "MCD4")))
        self.assertIn("MCD4 has no flag", "; ".join(caught.exception.problems))

    def test_live_is_accepted_when_the_checklists_allow_it(self) -> None:
        worker = s.synthetic_worker(live=True)
        results = worker.run_cycle(s.tiny_inputs())
        self.assertEqual({r.flag for r in results.results}, {"live"})


if __name__ == "__main__":
    unittest.main()
