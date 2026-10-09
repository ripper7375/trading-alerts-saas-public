"""The golden scenarios of build step 4 part 7 (architecture 7.7) and the tool that records and checks them (``mcd_worker.tools.golden``).

Four things are tested:

* **the stored set**: it is what a fresh run makes, the three real cycles equal the stored fixtures, every rule and branch of ``draft-1`` decides a reading
  (the two cells no input can reach are shown to be unreachable), and every stored reading and zone keeps the invariants of "Done when" 3.10 that belong to
  this layer (a stop of at least $13, pills equal to the zones' reference prices, no zones when standing aside, zones ranked by the stated key);
* **the tool**: ``check`` finds a changed, damaged or missing file and a changed input, is blind to line endings, ``record`` writes nothing when nothing
  changed, and **no path through the tool produces an APPROVED scenario** nor keeps an approval that is no longer true;
* **determinism**: the same set, byte for byte, under different hash seeds;
* **the documents**: architecture 3.5 shows the stored 18 Sep reading and 3.7 its figures, so a change to the engine cannot leave the specification behind.

Nothing here writes into the golden folder: the tool tests work on a copy in a temporary directory.
"""

from __future__ import annotations

import contextlib
import copy
import io
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
from decimal import ROUND_HALF_UP, Decimal
from functools import lru_cache
from pathlib import Path
from typing import Any, Iterator
from unittest import mock

from mcd_common import envelope as env
from mcd_common import reason_codes as rc
from mcd_common.cycle_inputs import closed_bars, slot_to_epoch

from mcd_worker.synthesis import decide, reading_problems
from mcd_worker.synthesis.reading import INPUT_ORDER, TOP_LEVEL_ORDER
from mcd_worker.synthesis.rules import NO_MATCH_ID
from mcd_worker.synthesis.zones import ZONE_ORDER, reference_close, zone_problems
from mcd_worker.tests import support as s
from mcd_worker.tests import synthesis_support as sy
from mcd_worker.tools import golden as g

PROFILES = ("DAY_TRADER", "SCALPER")
ARCHITECTURE = s.REPO / "docs" / "STACK-D-ARCHITECTURE.md"
SIMPLE = "09-range-middle-stand-aside"  # a synthetic scenario that needs no runner: fast to rebuild


def damage(text: str) -> str:
    """Damage an expected file in a way that is certain to land: its data status."""
    return text.replace('"data_status": "FRESH"', '"data_status": "STALE"', 1)


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8").replace("\r\n", "\n")


@lru_cache(maxsize=1)
def stored() -> dict[str, tuple[dict[str, Any], dict[str, Any]]]:
    """``id -> (scenario, expected)`` as the stored files hold them."""
    out = {}
    for folder in g.scenario_folders():
        out[folder.name] = (json.loads(read(folder / "scenario.json")), json.loads(read(folder / "expected.json")))
    return out


def items() -> Iterator[tuple[str, str, dict[str, Any], dict[str, Any]]]:
    """``(scenario id, trader type, decoded item, expected)`` for every reading of the set."""
    for scenario_id, (_scenario, expected) in stored().items():
        for profile, item in g.decoded(expected).items():
            yield scenario_id, profile, item, expected


# --------------------------------------------------------------------------- the stored set


class StoredSetTests(unittest.TestCase):
    def test_the_set_is_numbered_without_gaps_and_has_the_planned_shape(self) -> None:
        names = [f.name for f in g.scenario_folders()]
        self.assertEqual([n[:2] for n in names], [f"{i:02d}" for i in range(1, len(names) + 1)])
        kinds = [stored()[n][0]["kind"] for n in names]
        self.assertEqual(kinds.count("cycle"), 3)  # the three real cycles
        self.assertGreaterEqual(kinds.count("readings"), 10)  # "about ten synthetic cycles" (plan decision D13)

    def test_every_folder_holds_its_four_files_and_nothing_else(self) -> None:
        for folder in g.scenario_folders():
            self.assertEqual(sorted(p.name for p in folder.iterdir()), ["approval.json", "expected.json", "review.md", "scenario.json"], folder.name)

    def test_the_folder_holds_the_readme_the_index_and_the_scenarios(self) -> None:
        self.assertEqual(sorted(p.name for p in g.GOLDEN_DIR.iterdir() if p.is_file()), ["INDEX.md", "README.md"])

    def test_a_fresh_run_makes_exactly_the_stored_files(self) -> None:
        before = {p: p.read_bytes() for p in g.GOLDEN_DIR.rglob("*") if p.is_file()}
        reports, set_problems = g.check()
        self.assertEqual(set_problems, [])
        for report in reports:
            self.assertEqual(report.problems, [], report.scenario)
        self.assertEqual({p: p.read_bytes() for p in g.GOLDEN_DIR.rglob("*") if p.is_file()}, before, "check wrote something")

    def test_every_approval_is_pending_or_true(self) -> None:
        # whoever signs, the sign-off must stay true of the files it covers; check() refuses a stale one (the tool tests below drive each case)
        for folder in g.scenario_folders():
            approval = json.loads(read(folder / "approval.json"))
            self.assertIn(approval["status"], (g.PENDING, g.APPROVED), folder.name)
            if approval["status"] == g.PENDING:
                self.assertIsNone(approval["approved_by"], folder.name)
                self.assertIsNone(approval["approved_on"], folder.name)

    def test_the_real_scenarios_equal_the_stored_fixtures(self) -> None:
        real = [(sid, sc) for sid, (sc, _e) in stored().items() if sc["kind"] == "cycle"]
        self.assertEqual(len(real), 3)
        for scenario_id, scenario in real:
            expected = stored()[scenario_id][1]
            cycle = json.loads((g.FIXTURES_DIR / f"{scenario['bundle']}.cycle.json").read_text(encoding="utf-8"))
            self.assertEqual(expected["inputs_sha256"], cycle["inputs_sha256"], scenario_id)
            self.assertEqual(
                expected["sensors"],
                [
                    {k: r[k] for k in ("mcd_id", "status", "state_code", "bias", "envelope_sha256", "envelope_json")}
                    for r in cycle["results"]
                ],
                scenario_id,
            )
            self.assertEqual(
                expected["synthesis"], json.loads((g.FIXTURES_DIR / f"{scenario['bundle']}.synthesis.json").read_text(encoding="utf-8")), scenario_id
            )

    @unittest.skipUnless((s.REPO / "railway-gateway" / "scripts" / "sync-sensor-kit.js").is_file(), "the gateway is not beside the engine (a scratch copy)")
    def test_the_golden_set_is_not_in_the_sensor_kit_the_gateway_ships(self) -> None:
        self.assertEqual(list((s.REPO / "railway-gateway" / "sensors").rglob("*golden*")), [])
        self.assertNotIn("golden", (s.REPO / "railway-gateway" / "scripts" / "sync-sensor-kit.js").read_text(encoding="utf-8"))


# --------------------------------------------------------------------------- coverage


class CoverageTests(unittest.TestCase):
    def covered(self) -> set[tuple[str, str, str | None]]:
        return {
            (profile, item["reading"]["rule_id"], item["reading"]["branch_id"])
            for _sid, profile, item, _e in items()
            if item["reading"] is not None
        }

    def test_every_row_decides_a_reading_for_each_trader_type_it_applies_to(self) -> None:
        got = {(p, r) for p, r, _b in self.covered()}
        rules = sy.rules()
        required = {(p, rule.id) for rule in rules.rules for p in rule.profiles} | {(p, NO_MATCH_ID) for p in PROFILES}
        self.assertEqual(sorted(required - got - g.UNREACHABLE), [], "a row of the rules table has no golden scenario")
        self.assertEqual(got & g.UNREACHABLE, set(), "a cell declared unreachable decided a reading")

    def test_every_branch_of_every_row_decides_a_reading(self) -> None:
        got = {(r, b) for _p, r, b in self.covered()}
        required = {(rule.id, branch.id) for rule in sy.rules().rules for branch in rule.branches}
        self.assertEqual(sorted(required - got), [], "a branch of the rules table has no golden scenario")

    def test_the_two_cells_declared_unreachable_cannot_be_reached_by_any_input(self) -> None:
        """A Scalper with a usable MCD2 always matches row 2, 3s or 4: row 5 and "no match" are out of reach. Every combination of the three sensors is tried."""
        self.assertEqual(g.UNREACHABLE, {("SCALPER", "R5_UNRESOLVED_CONFLICT"), ("SCALPER", NO_MATCH_ID)})
        m1 = [None, *sy.states("MCD1"), ("-", rc.INVALID), ("-", rc.STALE)]
        m3 = [None, *sy.states("MCD3"), ("-", rc.INVALID), ("-", rc.STALE)]
        tried = 0
        for state2 in sy.states("MCD2"):
            for status in (rc.VALID, rc.CAUTIONARY):
                for one in m1:
                    for three in m3:
                        readings = sy.cycle(MCD1=one, MCD2=(state2, status), MCD3=three)
                        decision = decide(sy.rules(), "SCALPER", readings)
                        self.assertNotIn(decision.rule_id, ("R5_UNRESOLVED_CONFLICT", NO_MATCH_ID), (state2, status, one, three))
                        tried += 1
        self.assertGreater(tried, 1500)

    def test_the_set_shows_every_status_bias_archetype_and_relation(self) -> None:
        readings = [item["reading"] for _sid, _p, item, _e in items() if item["reading"] is not None]
        self.assertEqual({r["status"] for r in readings}, {"VALID", "CAUTIONARY", "INVALID", "STALE"})
        self.assertEqual({r["bias"] for r in readings}, {"LONG", "SHORT", "NEUTRAL", "STAND_ASIDE"})
        self.assertEqual({r["archetype"] for r in readings} - {None}, {"A", "B", "C", "D"})
        self.assertEqual({r["trend_relation"] for r in readings} - {None}, {"WITH_TREND", "COUNTER_TREND"})
        self.assertTrue(any(c.startswith("MODIFIER_CAUTION:") for r in readings for c in r["status_reasons"]))
        self.assertTrue(any(c.startswith("MCD0_DEFECT_") for r in readings for c in r["status_reasons"]))

    def test_the_set_shows_every_invalidation_basis_and_every_reason_for_no_zones(self) -> None:
        rows = [z for _sid, _p, item, _e in items() for z in item["zones"]]
        self.assertEqual({z["invalidation_basis"] for z in rows}, {"LEVEL", "MINIMUM_STOP", "NO_LEVEL"})
        self.assertEqual({item["zones_reason"] for _sid, _p, item, _e in items() if not item["zones"]}, {"NOT_DIRECTIONAL", "NO_ZONE_SOURCES"})

    def test_a_level_just_above_the_entry_is_the_next_opposing_level(self) -> None:
        """Item 6 of 3.10, the data side: scenario 05 against scenario 04, which has the same sensors and no support or resistance level."""
        with_level = g.decoded(stored()["05-level-just-above-entry"][1])["DAY_TRADER"]["zones"]
        without = g.decoded(stored()["04-trend-up-all-valid"][1])["DAY_TRADER"]["zones"]
        top = with_level[0]
        self.assertEqual((top["zone_id"], top["reference_price"], top["confluence_count"]), ("Z1", 4376.0, 2))
        self.assertEqual((top["next_opposing_level"]["name"], top["next_opposing_level"]["price"]), ("sr_3", 4377.3))
        self.assertEqual(top["runway"], 1.3)
        self.assertLess(top["runway_ratio"], 0.1)
        baseline = next(z for z in without if z["reference_price"] == 4376.0)
        self.assertEqual((baseline["next_opposing_level"]["name"], baseline["runway"]), ("baseline", 10.0))  # the M15 baseline, 10.00 away


# --------------------------------------------------------------------------- invariants of the stored readings and zones


def rank_key(row: dict[str, Any], price: float) -> tuple[Any, ...]:
    ratio = row["runway_ratio"]
    return (-row["confluence_count"], (0, 0.0) if ratio is None else (1, -ratio), abs(row["reference_price"] - price))


class InvariantTests(unittest.TestCase):
    def test_nothing_was_refused_and_every_reading_passes_its_own_guards(self) -> None:
        for sid, profile, item, _e in items():
            self.assertEqual(item["guard_problems"], [], (sid, profile))
            self.assertIsNotNone(item["reading"], (sid, profile))
            self.assertEqual(reading_problems(item["reading"], sy.rules()), [], (sid, profile))

    def test_every_reading_and_zone_names_the_rules_and_parameters_it_was_made_with(self) -> None:
        for sid, profile, item, expected in items():
            self.assertEqual((item["reading"]["rules_version"], item["reading"]["rules_sha256"]), (sy.rules().version, sy.rules().sha256), (sid, profile))
            self.assertEqual(expected["synthesis"]["zones_sha256"], sy.zone_params().sha256, sid)
            for row in item["zones"]:
                self.assertEqual((row["zones_version"], row["zones_sha256"]), (sy.zone_params().version, sy.zone_params().sha256), (sid, profile))
                self.assertEqual((row["profile"], row["cycle_slot"]), (profile, expected["cycle_slot"]), (sid, profile))

    def test_every_zone_has_a_reference_price_an_invalidation_at_least_13_away_and_a_runway(self) -> None:
        """Item 5 of 3.10."""
        minimum = float(sy.zone_params().min_stop_distance)
        self.assertEqual(minimum, 13.0)
        for sid, profile, item, _e in items():
            for z in item["zones"]:
                where = (sid, profile, z["zone_id"])
                self.assertEqual(zone_problems({k: z[k] for k in ZONE_ORDER}, sy.zone_params()), [], where)
                self.assertLessEqual(z["low"], z["reference_price"], where)
                self.assertLessEqual(z["reference_price"], z["high"], where)
                self.assertGreaterEqual(abs(z["reference_price"] - z["invalidation_price"]), minimum - 1e-9, where)
                self.assertEqual(z["stop_distance"], round(abs(z["reference_price"] - z["invalidation_price"]), 2), where)
                far_side = z["invalidation_price"] < z["reference_price"] if z["bias"] == "LONG" else z["invalidation_price"] > z["reference_price"]
                self.assertTrue(far_side, where)
                if z["next_opposing_level"] is None:
                    self.assertEqual((z["runway"], z["runway_ratio"]), (None, None), where)
                else:
                    self.assertEqual(z["runway"], round(abs(z["next_opposing_level"]["price"] - z["reference_price"]), 2), where)
                    exact = Decimal(str(z["runway"])) / Decimal(str(z["stop_distance"]))  # the ratio is rounded half up, to two decimals
                    self.assertEqual(z["runway_ratio"], float(exact.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)), where)

    def test_zones_lie_on_the_bias_side_of_the_price_and_are_ranked_by_the_stated_key(self) -> None:
        for sid, profile, item, expected in items():
            price = expected["reference_price"]
            rows = item["zones"]
            self.assertLessEqual(len(rows), int(sy.zone_params().max_zones), (sid, profile))
            self.assertEqual([z["rank"] for z in rows], list(range(1, len(rows) + 1)), (sid, profile))
            self.assertEqual([z["zone_id"] for z in rows], [f"Z{i}" for i in range(1, len(rows) + 1)], (sid, profile))
            self.assertEqual(item["reading"]["zones"], [z["zone_id"] for z in rows], (sid, profile))
            keys = [rank_key(z, price) for z in rows]
            self.assertEqual(keys, sorted(keys), (sid, profile))
            for z in rows:
                self.assertEqual(z["bias"], item["reading"]["bias"], (sid, profile))
                self.assertTrue(z["reference_price"] < price if z["bias"] == "LONG" else z["reference_price"] > price, (sid, profile, z["zone_id"]))

    def test_the_modal_pills_are_the_zones_reference_prices_and_nothing_else(self) -> None:
        """Item 7 of 3.10, the data side: one pill per zone in rank order, none when there are no zones, no filler."""
        for sid, profile, item, _e in items():
            self.assertEqual(item["pills"], [z["reference_price"] for z in item["zones"]], (sid, profile))
            self.assertEqual(len(set(item["pills"])), len(item["pills"]), (sid, profile))
            self.assertLessEqual(len(item["pills"]), 5, (sid, profile))
            if not item["zones"]:
                self.assertEqual(item["pills"], [], (sid, profile))

    def test_standing_aside_builds_no_zones_and_no_pills(self) -> None:
        """Item 4 of 3.10, the data side."""
        seen = 0
        for sid, profile, item, _e in items():
            reading = item["reading"]
            self.assertEqual(reading["stand_aside"], reading["bias"] == "STAND_ASIDE", (sid, profile))
            if reading["bias"] not in ("LONG", "SHORT"):
                self.assertEqual((item["zones"], item["pills"], item["zones_reason"], reading["zones"]), ([], [], "NOT_DIRECTIONAL", []), (sid, profile))
                seen += reading["stand_aside"]
        self.assertGreaterEqual(seen, 6)

    def test_every_reading_joins_to_the_sensor_readings_it_was_made_from(self) -> None:
        for sid, profile, item, expected in items():
            by_id = {r["mcd_id"]: r for r in expected["sensors"]}
            self.assertEqual(sorted(item["reading"]["inputs"]), ["MCD1", "MCD2", "MCD3"], (sid, profile))
            for sensor, record in item["reading"]["inputs"].items():
                if sensor not in by_id:
                    self.assertEqual(record["status"], "ABSENT", (sid, sensor))
                    continue
                row = by_id[sensor]
                self.assertEqual((record["status"], record["state_code"], record["bias"], record["envelope_sha256"]), (row["status"], row["state_code"], row["bias"], row["envelope_sha256"]), (sid, sensor))

    def test_the_reference_price_is_the_close_of_the_last_closed_m5_bar_never_the_bar_still_forming(self) -> None:
        """Decision D4 and ADR-011."""
        for sid, (scenario, expected) in stored().items():
            if scenario["kind"] == "readings":
                self.assertEqual(expected["reference_price"], scenario["reference_close"], sid)
                if scenario.get("forming_close") is not None:
                    self.assertNotEqual(expected["reference_price"], scenario["forming_close"], sid)
            else:
                bundle = json.loads((g.FIXTURES_DIR / f"{scenario['bundle']}.bundle.json").read_text(encoding="utf-8"))
                slot = slot_to_epoch(bundle["cycle_slot"])
                closed = [b for b in bundle["bars"]["M5"] if b["timestamp"] + 300 <= slot]
                self.assertEqual(expected["reference_price"], max(closed, key=lambda b: b["timestamp"])["close"], sid)
        self.assertTrue(any(sc.get("forming_close") is not None for sc, _e in stored().values()))

    def test_the_two_trader_types_get_the_same_zones_when_they_share_a_direction(self) -> None:
        """3.2 principle 3: zones depend on the bias and the levels, never on who asks."""
        shared = 0
        for sid in stored():
            day, scalper = (g.decoded(stored()[sid][1])[p] for p in PROFILES)
            if day["reading"]["bias"] == scalper["reading"]["bias"] and day["zones"]:
                shared += 1
                strip = lambda rows: [{k: v for k, v in row.items() if k != "profile"} for row in rows]  # noqa: E731
                self.assertEqual(strip(day["zones"]), strip(scalper["zones"]), sid)
        self.assertGreaterEqual(shared, 5)

    def test_every_sensor_envelope_validates_and_is_stored_in_its_canonical_form(self) -> None:
        for sid, (_scenario, expected) in stored().items():
            for sensor in expected["sensors"]:
                envelope = json.loads(sensor["envelope_json"])
                self.assertEqual(env.schema_errors(envelope), [], (sid, sensor["mcd_id"]))
                self.assertEqual(env.canonical_json(envelope), sensor["envelope_json"], (sid, sensor["mcd_id"]))


# --------------------------------------------------------------------------- the tool


class WorkOnACopy(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.root = Path(self._tmp.name) / "golden"
        shutil.copytree(g.GOLDEN_DIR, self.root)
        for path in self.root.glob("*/approval.json"):  # whatever the stored set has been signed as, every test starts from pending (the hashes stay)
            approval = json.loads(read(path))
            approval.update(status=g.PENDING, approved_by=None, approved_on=None)
            path.write_bytes(g.dump(approval).encode("utf-8"))

    def folder(self, name: str = SIMPLE) -> Path:
        return self.root / name

    def edit(self, name: str, file: str, change) -> None:
        path = self.folder(name) / file
        before = read(path)
        after = change(before)
        self.assertNotEqual(before, after, f"the edit of {file} changed nothing: a test that damages a file must damage it")
        path.write_bytes(after.encode("utf-8"))

    def only(self, name: str = SIMPLE):
        reports, _ = g.check(self.root, [name])
        return reports[0]

    def sign(self, name: str = SIMPLE, by: Any = "Davin", on: Any = "2026-10-10") -> None:
        path = self.folder(name) / "approval.json"
        approval = json.loads(read(path))
        approval.update(status=g.APPROVED, approved_by=by, approved_on=on)
        path.write_bytes(g.dump(approval).encode("utf-8"))

    def approval(self, name: str = SIMPLE) -> dict[str, Any]:
        return json.loads(read(self.folder(name) / "approval.json"))

    def run_main(self, *args: str) -> tuple[int, str]:
        out, err = io.StringIO(), io.StringIO()
        with mock.patch.object(g, "GOLDEN_DIR", self.root), contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            code = g.main(list(args))
        return code, out.getvalue() + err.getvalue()


class CheckTests(WorkOnACopy):
    def test_a_copy_of_the_stored_set_passes(self) -> None:
        self.assertTrue(self.only().ok)

    def test_a_changed_expected_file_is_found_with_its_place(self) -> None:
        self.edit(SIMPLE, "expected.json", damage)
        report = self.only()
        self.assertFalse(report.ok)
        self.assertTrue(any("expected.json differs" in p and "line" in p for p in report.problems), report.problems)

    def test_a_damaged_review_is_found(self) -> None:
        self.edit(SIMPLE, "review.md", lambda t: t + "an extra line\n")
        self.assertTrue(any("review.md differs" in p for p in self.only().problems))

    def test_a_missing_file_is_found(self) -> None:
        for name in ("expected.json", "review.md", "approval.json"):
            with self.subTest(name):
                saved = (self.folder() / name).read_bytes()
                (self.folder() / name).unlink()
                self.assertTrue(any(name in p and "missing" in p for p in self.only().problems))
                (self.folder() / name).write_bytes(saved)

    def test_a_changed_input_is_found_even_though_nobody_recorded_it(self) -> None:
        self.edit(SIMPLE, "scenario.json", lambda t: t.replace('"reference_close": 4210.5', '"reference_close": 4210.6'))
        problems = self.only().problems
        self.assertTrue(any("expected.json differs" in p for p in problems), problems)
        self.assertTrue(any("scenario_sha256" in p for p in problems), problems)

    def test_line_endings_do_not_matter(self) -> None:
        for path in self.root.rglob("*"):
            if path.is_file():
                path.write_bytes(path.read_bytes().replace(b"\r\n", b"\n").replace(b"\n", b"\r\n"))
        self.assertTrue(self.only().ok)
        self.assertTrue(self.only("14-primary-sensor-stale").ok)

    def test_a_stale_index_is_found(self) -> None:
        index = self.root / "INDEX.md"
        index.write_bytes((read(index) + "extra\n").encode("utf-8"))
        _reports, set_problems = g.check(self.root)
        self.assertTrue(any("INDEX.md differs" in p for p in set_problems), set_problems)

    def test_a_scenario_with_a_problem_is_reported_by_the_check_with_its_reasons(self) -> None:
        self.edit(SIMPLE, "scenario.json", lambda t: t.replace('"kind": "readings"', '"kind": "readings", "colour": "red"'))
        problems = self.only().problems
        self.assertTrue(any("unknown key 'colour'" in p for p in problems), problems)
        with self.assertRaises(g.GoldenError):
            g.load_scenario(self.folder())

    def test_an_unknown_scenario_name_is_refused(self) -> None:
        with self.assertRaises(g.GoldenError):
            g.check(self.root, ["99-nothing"])
        with self.assertRaises(g.GoldenError):
            g.record(self.root, ["99-nothing"])


class RecordTests(WorkOnACopy):
    def test_nothing_is_written_when_nothing_changed(self) -> None:
        self.assertEqual(g.record(self.root, [SIMPLE]), [])

    def test_a_damaged_generated_file_is_rewritten_and_the_check_then_passes(self) -> None:
        self.edit(SIMPLE, "expected.json", damage)
        self.edit(SIMPLE, "review.md", lambda t: "damaged\n")
        written = g.record(self.root, [SIMPLE])
        self.assertEqual(sorted(written), sorted([f"{SIMPLE}/expected.json", f"{SIMPLE}/review.md"]))
        self.assertTrue(self.only().ok)

    def test_a_missing_or_damaged_index_is_written_again(self) -> None:
        index = self.root / "INDEX.md"
        index.unlink()
        self.assertEqual(g.record(self.root, [SIMPLE]), ["INDEX.md"])
        self.assertEqual(g.check(self.root)[1], [])
        index.write_bytes(b"damaged\n")
        self.assertEqual(g.record(self.root, [SIMPLE]), ["INDEX.md"])
        self.assertEqual(g.check(self.root)[1], [])

    def test_a_scenario_with_a_problem_is_not_recorded(self) -> None:
        self.edit(SIMPLE, "scenario.json", lambda t: t.replace('"kind": "readings"', '"kind": "readings", "colour": "red"'))
        with self.assertRaises(g.GoldenError) as raised:
            g.record(self.root, [SIMPLE])
        self.assertTrue(any("unknown key" in p for p in raised.exception.problems), raised.exception.problems)

    def test_a_missing_approval_comes_back_pending_and_never_approved(self) -> None:
        (self.folder() / "approval.json").unlink()
        g.record(self.root, [SIMPLE])
        approval = self.approval()
        self.assertEqual((approval["status"], approval["approved_by"], approval["approved_on"]), (g.PENDING, None, None))
        self.assertTrue(self.only().ok)

    def test_an_approval_that_is_still_true_is_left_alone(self) -> None:
        self.sign()
        before = (self.folder() / "approval.json").read_bytes()
        g.record(self.root, [SIMPLE])
        self.assertEqual((self.folder() / "approval.json").read_bytes(), before)
        self.assertEqual(self.approval()["status"], g.APPROVED)
        self.assertEqual(self.only().approval_status, g.APPROVED)

    def test_an_approved_scenario_that_changed_fails_the_check_and_record_puts_it_back_to_pending(self) -> None:
        self.sign()
        self.edit(SIMPLE, "scenario.json", lambda t: t.replace('"reference_close": 4210.5', '"reference_close": 4210.6'))
        self.assertTrue(any("changed after approval" in p for p in self.only().problems))
        g.record(self.root, [SIMPLE])
        approval = self.approval()
        self.assertEqual((approval["status"], approval["approved_by"], approval["approved_on"]), (g.PENDING, None, None))
        self.assertIn("Reset by record", approval["note"])
        self.assertIn("Davin", approval["note"])
        self.assertTrue(self.only().ok)

    def test_a_pending_scenario_keeps_a_note_a_person_wrote(self) -> None:
        path = self.folder() / "approval.json"
        approval = json.loads(read(path))
        approval["note"] = "waiting for the second look"
        path.write_bytes(g.dump(approval).encode("utf-8"))
        g.record(self.root, [SIMPLE])
        self.assertEqual(self.approval()["note"], "waiting for the second look")

    def test_no_run_of_record_ever_creates_an_approved_scenario(self) -> None:
        for path in self.root.glob("*/approval.json"):
            path.unlink()
        g.record(self.root)
        statuses = {json.loads(read(p))["status"] for p in self.root.glob("*/approval.json")}
        self.assertEqual(statuses, {g.PENDING})


class ApprovalTests(WorkOnACopy):
    def test_an_approval_needs_a_name_and_a_date(self) -> None:
        for by, on, expect in ((None, "2026-10-10", "approved_by"), ("  ", "2026-10-10", "approved_by"), ("Davin", None, "approved_on"), ("Davin", "10 Oct", "approved_on")):
            with self.subTest(by=by, on=on):
                self.sign(by=by, on=on)
                self.assertTrue(any(expect in p for p in self.only().problems), self.only().problems)

    def test_a_hand_edited_hash_is_not_an_approval(self) -> None:
        self.sign()
        path = self.folder() / "approval.json"
        approval = json.loads(read(path))
        approval["expected_sha256"] = "0" * 64
        path.write_bytes(g.dump(approval).encode("utf-8"))
        self.assertTrue(any("expected_sha256" in p and "changed after approval" in p for p in self.only().problems))

    def test_an_unknown_status_a_wrong_name_and_stray_keys_are_refused(self) -> None:
        path = self.folder() / "approval.json"
        good = json.loads(read(path))
        for change, expect in (
            ({"status": "SIGNED"}, "status must be"),
            ({"scenario": "08-other"}, "scenario is"),
            ({"schema": "golden-approval/2"}, "schema must be"),
            ({"extra": 1}, "unknown key"),
        ):
            with self.subTest(change=change):
                path.write_bytes(g.dump({**good, **change}).encode("utf-8"))
                self.assertTrue(any(expect in p for p in self.only().problems), self.only().problems)
        bad = {k: v for k, v in good.items() if k != "note"}
        path.write_bytes(g.dump(bad).encode("utf-8"))
        self.assertTrue(any("missing key" in p for p in self.only().problems))

    def test_unreadable_approval_json_is_reported_not_raised(self) -> None:
        (self.folder() / "approval.json").write_bytes(b"{not json")
        self.assertTrue(any("not valid JSON" in p for p in self.only().problems))


class ReleaseGateTests(WorkOnACopy):
    def test_check_passes_while_pending_and_the_gate_refuses_it(self) -> None:
        code, out = self.run_main("check", "--only", SIMPLE)
        self.assertEqual(code, 0, out)
        self.assertIn("1 pending approval", out)
        code, out = self.run_main("check", "--only", SIMPLE, "--require-approved")
        self.assertEqual(code, 1, out)
        self.assertIn("not approved yet", out)

    def test_the_gate_passes_once_the_scenario_is_signed(self) -> None:
        self.sign()
        code, out = self.run_main("check", "--only", SIMPLE, "--require-approved")
        self.assertEqual(code, 0, out)
        self.assertIn("1 approved, 0 pending", out)

    def test_a_difference_fails_the_check_with_exit_1(self) -> None:
        self.edit(SIMPLE, "expected.json", damage)
        code, out = self.run_main("check", "--only", SIMPLE)
        self.assertEqual(code, 1, out)
        self.assertIn("DIFFERENT", out)

    def test_an_unknown_scenario_is_a_usage_error_with_exit_2(self) -> None:
        code, out = self.run_main("check", "--only", "99-nothing")
        self.assertEqual(code, 2, out)

    def test_list_prints_every_scenario_with_its_status(self) -> None:
        code, out = self.run_main("list")
        self.assertEqual(code, 0, out)
        self.assertEqual(out.count("[readings]") + out.count("[cycle]"), 16)
        self.assertIn("PENDING", out)


class ScenarioFileTests(unittest.TestCase):
    """A scenario with a typo is refused with every reason, not run."""

    @classmethod
    def setUpClass(cls) -> None:
        cls.good = stored()["04-trend-up-all-valid"][0]
        cls.registry = g.world().registry

    def problems(self, mutate) -> list[str]:
        data = copy.deepcopy(self.good)
        mutate(data)
        return g.scenario_problems(data, "04-trend-up-all-valid", self.registry)

    def test_the_stored_scenarios_have_no_problems(self) -> None:
        for sid, (scenario, _e) in stored().items():
            self.assertEqual(g.scenario_problems(scenario, sid, self.registry), [], sid)

    def test_each_kind_of_mistake_is_named(self) -> None:
        cases = {
            "unknown key": lambda d: d.update(colour="red"),
            "missing key 'why'": lambda d: d.pop("why"),
            "missing key 'data_status'": lambda d: d.pop("data_status"),
            "cycle_slot is not": lambda d: d.update(cycle_slot="2026-10-05T14:31Z"),
            "data_status must be": lambda d: d.update(data_status="LATE"),
            "reference_close must be a positive number": lambda d: d.update(reference_close=-1),
            "forming_close must be a positive number": lambda d: d.update(forming_close="x"),
            "id must be the folder name": lambda d: d.update(id="05-other"),
            "schema must be": lambda d: d.update(schema="golden-scenario/2"),
            "sensors.MCD1.state must be a state of MCD1's register": lambda d: d["sensors"]["MCD1"].update(state="MCD1_UP_IN_CORRIDORR"),
            "sensors.MCD2.state must be a state of MCD2's register": lambda d: d["sensors"]["MCD2"].update(state="MCD1_UP_IN_CORRIDOR"),
            "sensors.MCD1.levels must hold exactly M15": lambda d: d["sensors"]["MCD1"]["levels"].update(M5=[3.0, 2.0, 1.0]),
            "from high to low": lambda d: d["sensors"]["MCD2"]["levels"].update(M5=[1.0, 2.0, 3.0]),
            "three prices from high to low": lambda d: d["sensors"]["MCD2"]["levels"].update(M5=[5.0, 5.0, 1.0]),
            "levels.M5 must be [UOEDT, baseline, LOEDT]": lambda d: d["sensors"]["MCD2"]["levels"].update(M5=[3.0, 2.0]),
            "a VALID reading has no reasons": lambda d: d["sensors"]["MCD1"].update(reasons=["MCD0_DEFECT_M15"]),
            "a CAUTIONARY reading needs reason codes": lambda d: d["sensors"]["MCD1"].update(status="CAUTIONARY"),
            "synthesis reads MCD1, MCD2 and MCD3 only": lambda d: d["sensors"].update(MCD0=copy.deepcopy(d["sensors"]["MCD1"])),
            "sensors must be an object with at least one": lambda d: d.update(sensors={}),
            "context_levels.M5.sr_17": lambda d: d.update(context_levels={"M5": {"sr_17": 4300.0}}),
            "status must be one of": lambda d: d["sensors"]["MCD1"].update(status="GOOD"),
            "no state and no levels": lambda d: d["sensors"]["MCD1"].update(status="STALE", reasons=["NO_STATS_AT_SLOT"]),
        }
        for expect, mutate in cases.items():
            with self.subTest(expect):
                self.assertTrue(any(expect in p for p in self.problems(mutate)), (expect, self.problems(mutate)))

    def test_a_cycle_scenario_needs_a_stored_bundle(self) -> None:
        good = stored()["01-real-18-sep-counter-trend-rally"][0]
        self.assertEqual(g.scenario_problems(good, "01-real-18-sep-counter-trend-rally", self.registry), [])
        self.assertTrue(any("no fixture" in p for p in g.scenario_problems({**good, "bundle": "2026-01-01T0000Z"}, "01-real-18-sep-counter-trend-rally", self.registry)))
        self.assertTrue(any("stem of a fixture" in p for p in g.scenario_problems({**good, "bundle": "../x"}, "01-real-18-sep-counter-trend-rally", self.registry)))
        self.assertTrue(any("unknown key" in p for p in g.scenario_problems({**good, "sensors": {}}, "01-real-18-sep-counter-trend-rally", self.registry)))

    def test_a_synthetic_bundle_has_one_closed_bar_and_the_bar_still_forming(self) -> None:
        inputs = g.build_inputs(self.good)
        self.assertEqual([b["close"] for b in closed_bars(inputs, "M5")], [self.good["reference_close"]])
        self.assertEqual(len(inputs.bars["M5"]), 2)  # the forming bar is in the bundle and is not closed
        self.assertEqual(float(reference_close(inputs)), self.good["reference_close"])
        without = {k: v for k, v in self.good.items() if k != "forming_close"}
        self.assertEqual(len(g.build_inputs(without).bars["M5"]), 1)
        self.assertEqual((inputs.cycle_slot, inputs.data_status, inputs.retuning), (self.good["cycle_slot"], "FRESH", False))
        self.assertEqual(g.build_inputs({**self.good, "context_levels": {"M15": {"sr_3": 4377.3}}}).context_levels["M15"]["sr_3"], 4377.3)

    def test_a_synthetic_reading_has_the_sensors_levels_in_the_order_the_sensors_give_them(self) -> None:
        both = g.build_envelope(self.registry, "MCD3", self.good["sensors"]["MCD3"], self.good["cycle_slot"])
        self.assertEqual(
            [(lv["tf"], lv["name"], lv["price"], lv["role"]) for lv in both["levels"]],
            [
                ("M15", "UOEDT", 4452.0, "resistance"), ("M15", "baseline", 4386.0, "mid"), ("M15", "LOEDT", 4320.0, "support"),
                ("M5", "UOEDT", 4406.0, "resistance"), ("M5", "baseline", 4376.0, "mid"), ("M5", "LOEDT", 4346.0, "support"),
            ],
        )
        self.assertEqual((both["status"], both["state_code"], both["bias"], both["regime_status"]), ("VALID", "MCD3_BULL_MID", "LONG", "BULLISH_CONSOLIDATED_EQUILIBRIUM"))
        stale = g.build_envelope(self.registry, "MCD1", {"status": "STALE", "reasons": ["NO_STATS_AT_SLOT"]}, self.good["cycle_slot"])
        self.assertEqual((stale["status"], stale["status_reasons"], stale["state_code"], stale["levels"]), ("STALE", ["NO_STATS_AT_SLOT"], None, []))

    def test_text_is_compared_and_hashed_with_lf_line_endings(self) -> None:
        self.assertEqual(g.lf("a\r\nb\r\n"), "a\nb\n")
        self.assertEqual(g.text_sha256("a\r\nb\r\n"), g.text_sha256("a\nb\n"))
        self.assertNotEqual(g.text_sha256("a\nb\n"), g.text_sha256("a\nb"))

    def test_synthesis_that_raised_is_not_a_scenario_output(self) -> None:
        """The runner and the synthesizer never raise, they answer with an error; a golden file made from that answer would approve a failure."""
        world = g.world()
        failed = world.synthesizer.failed("shadow")
        synthetic = stored()[SIMPLE][0]
        with mock.patch.object(world.synthesizer, "run", return_value=failed):
            with self.assertRaises(g.GoldenError) as raised:
                g._compute(synthetic)  # not compute(): its answers are kept per scenario
        self.assertIn("synthesis raised", str(raised.exception))
        real = stored()["01-real-18-sep-counter-trend-rally"][0]
        silent = mock.Mock(synthesis=None)
        with mock.patch.object(world.worker, "run_cycle", return_value=silent):
            with self.assertRaises(g.GoldenError) as raised:
                g._compute(real)
        self.assertIn("synthesis did not run", str(raised.exception))
        erroring = mock.Mock(synthesis=mock.Mock(error="SYNTHESIS_ERROR"))
        with mock.patch.object(world.worker, "run_cycle", return_value=erroring):
            with self.assertRaises(g.GoldenError):
                g._compute(real)

    def test_a_built_reading_that_breaks_the_schema_is_refused(self) -> None:
        with mock.patch.object(g.env, "schema_errors", return_value=["a made-up schema error"]):
            with self.assertRaises(g.GoldenError):
                g.build_envelope(self.registry, "MCD1", self.good["sensors"]["MCD1"], self.good["cycle_slot"])

    def test_an_unreadable_scenario_file_is_a_golden_error(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp) / "01-x"
            folder.mkdir()
            with self.assertRaises(g.GoldenError):
                g.load_scenario(folder)  # no scenario.json
            (folder / "scenario.json").write_text("{not json", encoding="utf-8")
            with self.assertRaises(g.GoldenError):
                g.load_scenario(folder)


# --------------------------------------------------------------------------- determinism


class DeterminismTests(unittest.TestCase):
    """Different hash seeds make Python order sets and dictionaries differently; the bytes of the set must not move."""

    def digest_in_a_process(self, seed: str) -> str:
        env = {**os.environ, "PYTHONHASHSEED": seed, "PYTHONDONTWRITEBYTECODE": "1", "PYTHONIOENCODING": "utf-8"}
        done = subprocess.run([sys.executable, "-B", "-m", "mcd_worker.tools.golden", "check"], capture_output=True, cwd=s.ENGINE, env=env, timeout=300)
        self.assertEqual(done.returncode, 0, done.stdout.decode("utf-8", "replace") + done.stderr.decode("utf-8", "replace"))
        found = re.search(r"golden set sha256 ([0-9a-f]{64})", done.stdout.decode("utf-8"))
        self.assertIsNotNone(found)
        return found.group(1)  # type: ignore[union-attr]

    def test_different_hash_seeds_give_the_same_set(self) -> None:
        reports, _ = g.check()
        here = g.set_digest(reports)
        for seed in ("0", "4242", "random"):
            self.assertEqual(self.digest_in_a_process(seed), here, seed)

    def test_the_digest_follows_the_content(self) -> None:
        a, b = g.Report("01-a", expected_sha256="1" * 64), g.Report("02-b", expected_sha256="2" * 64)
        self.assertEqual(g.set_digest([a, b]), g.set_digest([b, a]))
        self.assertNotEqual(g.set_digest([a, b]), g.set_digest([a, g.Report("02-b", expected_sha256="3" * 64)]))
        self.assertNotEqual(g.set_digest([a, b]), g.set_digest([a, g.Report("02-c", expected_sha256="2" * 64)]))


# --------------------------------------------------------------------------- the documents


def section(text: str, start: str, end: str) -> str:
    first = text.index(start)
    return text[first : text.index(end, first)]


@unittest.skipUnless(ARCHITECTURE.is_file(), "the architecture document is not beside the engine (a scratch copy, as the mutation check makes)")
class ArchitectureTests(unittest.TestCase):
    """Architecture 3.5 shows the stored 18 Sep Day Trader reading and 3.7 its figures: they are the golden scenario 1, not a sketch of it."""

    @classmethod
    def setUpClass(cls) -> None:
        cls.text = read(ARCHITECTURE)
        cls.expected = stored()["01-real-18-sep-counter-trend-rally"][1]
        cls.day = g.decoded(cls.expected)["DAY_TRADER"]

    def test_section_3_5_is_the_stored_day_trader_reading(self) -> None:
        block = re.search(r"```json\n(.*?)\n```", section(self.text, "### 3.5 ", "### 3.6 "), re.S)
        self.assertIsNotNone(block)
        shown = json.loads(block.group(1))  # type: ignore[union-attr]
        self.assertEqual(shown, self.day["reading"])
        self.assertEqual(list(shown), list(TOP_LEVEL_ORDER))
        for record in shown["inputs"].values():
            self.assertEqual(list(record), list(INPUT_ORDER))

    def test_section_3_7_holds_the_figures_of_the_stored_zones(self) -> None:
        text = section(self.text, "### 3.7 ", "### 3.8 ").replace("`", "")  # the section writes identifiers in code spans
        self.assertIn(f"{self.expected['reference_price']:.2f}", text)
        for z in self.day["zones"]:
            for needle in (
                f"{z['low']:.2f} – {z['high']:.2f}",
                f"{z['reference_price']:.2f}",
                f"{z['invalidation_price']:.2f}",
                f"${z['stop_distance']:.2f}",
                f"{z['runway_ratio']:.2f}",
                f"${z['runway']:.2f}",
                f"{z['next_opposing_level']['name']} {z['next_opposing_level']['price']:.2f}",
            ):
                self.assertIn(needle, text, (z["zone_id"], needle))
        self.assertEqual(self.day["pills"], [4367.2, 4350.16])
        for old in ("4384.28", "4349.72", "4278.71", "17.53", "71.51", "0.97"):
            self.assertNotIn(old, text, "3.7 still holds a figure of the earlier draft")

    def test_section_3_7_says_what_the_scalper_got_and_what_the_status_is(self) -> None:
        text = section(self.text, "### 3.7 ", "### 3.8 ")
        reading = {p: item["reading"] for p, item in g.decoded(self.expected).items()}
        self.assertEqual((reading["DAY_TRADER"]["rule_id"], reading["SCALPER"]["rule_id"]), ("R1_MACRO_COUNTER_TREND_RALLY", "R3S_TREND_CONTINUATION_M5"))
        for needle in ("1 · C macro counter-trend rally", "3s · A trend continuation (M5)", "CAUTIONARY", "MCD0", "LONG"):
            self.assertIn(needle, text)
        self.assertEqual({r["status"] for r in reading.values()}, {"CAUTIONARY"})

    def test_section_3_2_and_the_glossary_say_where_syn_is_stored(self) -> None:
        """Decision D9: its own tables, not rows of ``mcd_outputs``."""
        for text in (section(self.text, "### 3.2 ", "### 3.3 "), section(self.text, "### 0.6 ", "\n## 1. ")):
            self.assertIn("synthesis_readings", text)
        self.assertNotIn('stored like a sensor with `mcd_id = "SYN"`', self.text)


if __name__ == "__main__":
    unittest.main()
