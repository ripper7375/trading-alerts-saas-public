"""The entry-zone parameter file and its loader (build step 4, part 2; architecture 3.6; ADR-031, ADR-032, ADR-033).

The figures are pinned (value, unit, boundary and why, like the MCD parameter files) and so is the checksum, so a number cannot change without a
new version; the loader refuses every way a hand-edited file can be wrong.
"""

from __future__ import annotations

import copy
import hashlib
import json
import unittest
from decimal import Decimal

import yaml

from mcd_worker.errors import ConfigError
from mcd_worker.synthesis.zones import ZONE_PARAMS_PATH, load_zone_params, parse_zone_params
from mcd_worker.tests import synthesis_support as sy

# The checksum of zones-1 over its parsed document. A change of a value, a unit, a boundary or a reason changes it: write zones-2 and a decision-log
# entry instead of editing zones-1, and never change this constant to make a test pass.
ZONES_1_SHA256 = "afc334328b60b98bd01c523e431a720783ea97a32684e2843cb6e53c19dd2e4d"


def document() -> dict:
    return yaml.safe_load(sy.zone_params_text())


def problems_of(mutate) -> list[str]:
    doc = copy.deepcopy(document())
    mutate(doc)
    try:
        parse_zone_params(yaml.safe_dump(doc, sort_keys=False))
    except ConfigError as exc:
        return list(exc.problems)
    raise AssertionError("the loader accepted a file it should have refused")


class ZonesOneTests(unittest.TestCase):
    def test_the_figures_are_those_of_architecture_3_6(self) -> None:
        p = sy.zone_params()
        self.assertEqual((p.version, p.status), ("zones-1", "draft"))
        self.assertEqual(p.half_width_fraction, Decimal("0.10"))  # ADR-031
        self.assertEqual(p.invalidation_buffer, Decimal("0.50"))  # ADR-032
        self.assertEqual(p.min_stop_distance, Decimal("13"))  # ADR-032
        self.assertEqual(p.max_zones, 5)  # 3.6 step 5
        self.assertEqual((p.price_decimals, p.ratio_decimals), (2, 2))  # D7 (c), (f)

    def test_the_values_are_exact_decimals_and_whole_numbers_where_they_count(self) -> None:
        p = sy.zone_params()
        for value in (p.half_width_fraction, p.invalidation_buffer, p.min_stop_distance):
            self.assertIsInstance(value, Decimal)
        for value in (p.max_zones, p.price_decimals, p.ratio_decimals):
            self.assertIs(type(value), int)

    def test_the_checksum_is_pinned(self) -> None:
        self.assertEqual(sy.zone_params().sha256, ZONES_1_SHA256)

    def test_it_is_the_hash_of_sorted_compact_json(self) -> None:
        text = json.dumps(document(), sort_keys=True, separators=(",", ":"), ensure_ascii=True)
        self.assertEqual(hashlib.sha256(text.encode()).hexdigest(), ZONES_1_SHA256)

    def test_every_parameter_says_its_unit_its_boundary_and_why(self) -> None:
        entries = document()["parameters"]
        self.assertEqual(
            sorted(entries), ["half_width_fraction", "invalidation_buffer", "max_zones", "min_stop_distance", "price_decimals", "ratio_decimals"]
        )
        for name, entry in entries.items():
            self.assertEqual(sorted(entry), ["boundary", "unit", "value", "why"], name)
            for key in ("unit", "boundary", "why"):
                self.assertTrue(isinstance(entry[key], str) and entry[key].strip(), (name, key))

    def test_the_reasons_cite_the_decisions(self) -> None:
        why = {name: entry["why"] for name, entry in document()["parameters"].items()}
        self.assertIn("ADR-031", why["half_width_fraction"])
        self.assertIn("ADR-032", why["invalidation_buffer"])
        self.assertIn("ADR-032", why["min_stop_distance"])
        self.assertIn("ADR-033", why["max_zones"])
        self.assertIn("D7", why["price_decimals"])
        self.assertIn("D7", why["ratio_decimals"])

    def test_the_file_is_where_the_loader_looks(self) -> None:
        self.assertEqual(ZONE_PARAMS_PATH.name, "zone_params.yaml")
        self.assertEqual(load_zone_params().sha256, ZONES_1_SHA256)
        self.assertEqual(document()["zones_version"], "zones-1")


class ChecksumTests(unittest.TestCase):
    def test_line_endings_comments_and_key_order_do_not_change_it(self) -> None:
        text = sy.zone_params_text()
        self.assertEqual(parse_zone_params(text.replace("\r\n", "\n").replace("\n", "\r\n")).sha256, ZONES_1_SHA256)
        self.assertEqual(parse_zone_params("# one more comment\n" + text + "\n# and another\n").sha256, ZONES_1_SHA256)
        self.assertEqual(parse_zone_params(yaml.safe_dump(document(), sort_keys=True)).sha256, ZONES_1_SHA256)

    def test_any_change_of_meaning_changes_it(self) -> None:
        for mutate in (
            lambda d: d["parameters"]["min_stop_distance"].update(value=12),
            lambda d: d["parameters"]["half_width_fraction"].update(why="another reason"),
            lambda d: d["parameters"]["max_zones"].update(boundary="another boundary"),
            lambda d: d.update(approved="someone else"),
        ):
            doc = copy.deepcopy(document())
            mutate(doc)
            self.assertNotEqual(parse_zone_params(yaml.safe_dump(doc, sort_keys=False)).sha256, ZONES_1_SHA256)


class RefusalTests(unittest.TestCase):
    def assertMentions(self, problems: list[str], *needles: str) -> None:
        joined = "\n".join(problems)
        for needle in needles:
            self.assertIn(needle, joined)

    def test_a_file_that_is_not_yaml_or_not_a_mapping(self) -> None:
        with self.assertRaises(ConfigError) as caught:
            parse_zone_params("parameters: [unclosed")
        self.assertIn("not valid YAML", str(caught.exception))
        with self.assertRaises(ConfigError) as caught:
            parse_zone_params("- a\n- list\n")
        self.assertIn("must be a mapping", str(caught.exception))

    def test_a_key_written_twice(self) -> None:
        text = sy.zone_params_text().replace("status: draft\n", "status: draft\nstatus: approved\n", 1)
        with self.assertRaises(ConfigError) as caught:
            parse_zone_params(text)
        self.assertIn("duplicate key", str(caught.exception))

    def test_an_unreadable_file(self) -> None:
        with self.assertRaises(ConfigError) as caught:
            load_zone_params(ZONE_PARAMS_PATH.with_name("nope.yaml"))
        self.assertIn("cannot read the zone parameter file", str(caught.exception))

    def test_a_date_is_not_plain_data(self) -> None:
        text = sy.zone_params_text().replace("approved: 'Davin", "approved: 2026-10-04\nunused: 'Davin", 1)
        with self.assertRaises(ConfigError):
            parse_zone_params(text)

    def test_header_problems(self) -> None:
        self.assertMentions(problems_of(lambda d: d.update(schema="synthesis-zone-params/2")), "schema")
        self.assertMentions(problems_of(lambda d: d.update(zones_version="v1")), "zones_version")
        self.assertMentions(problems_of(lambda d: d.update(zones_version="zones-1\n")), "zones_version")
        self.assertMentions(problems_of(lambda d: d.update(status="final")), "status")
        self.assertMentions(problems_of(lambda d: d.update(approved="")), "approved")
        self.assertMentions(problems_of(lambda d: d.update(extra=1)), "unknown key 'extra'")
        self.assertMentions(problems_of(lambda d: d.pop("parameters")), "missing key 'parameters'")

    def test_a_parameter_that_is_missing_unknown_or_incomplete(self) -> None:
        self.assertMentions(problems_of(lambda d: d["parameters"].pop("max_zones")), "missing key 'max_zones'")
        self.assertMentions(problems_of(lambda d: d["parameters"].update(spread=1)), "unknown key 'spread'")
        self.assertMentions(problems_of(lambda d: d["parameters"]["max_zones"].pop("why")), "missing key 'why'")
        self.assertMentions(problems_of(lambda d: d["parameters"]["max_zones"].update(note="x")), "unknown key 'note'")
        self.assertMentions(problems_of(lambda d: d["parameters"]["max_zones"].update(unit="")), "parameters.max_zones.unit")
        self.assertMentions(problems_of(lambda d: d["parameters"]["max_zones"].update(boundary=None)), "parameters.max_zones.boundary")
        self.assertMentions(problems_of(lambda d: d["parameters"]["max_zones"].update(why=" ")), "parameters.max_zones.why")

    def test_a_value_of_the_wrong_kind(self) -> None:
        for bad in (True, "13", None, [13], float("nan")):
            self.assertMentions(problems_of(lambda d, v=bad: d["parameters"]["min_stop_distance"].update(value=v)), "parameters.min_stop_distance.value")
        for bad in (2.0, 2.5, True, "2"):
            self.assertMentions(problems_of(lambda d, v=bad: d["parameters"]["price_decimals"].update(value=v)), "whole number")

    def test_a_value_out_of_range(self) -> None:
        cases = {
            "half_width_fraction": (0, -0.1, 1.5),
            "invalidation_buffer": (-0.5,),
            "min_stop_distance": (0, -13),
            "max_zones": (0, 6, -1),
            "price_decimals": (-1, 5),
            "ratio_decimals": (-1, 5),
        }
        for name, values in cases.items():
            for bad in values:
                self.assertMentions(problems_of(lambda d, n=name, v=bad: d["parameters"][n].update(value=v)), f"parameters.{name}.value")

    def test_the_edges_of_the_ranges_are_allowed(self) -> None:
        for name, value in (("half_width_fraction", 1), ("invalidation_buffer", 0), ("max_zones", 1), ("max_zones", 5), ("price_decimals", 0), ("ratio_decimals", 4)):
            doc = copy.deepcopy(document())
            doc["parameters"][name]["value"] = value
            parse_zone_params(yaml.safe_dump(doc, sort_keys=False))

    def test_every_problem_is_reported_at_once(self) -> None:
        def mutate(d: dict) -> None:
            d["status"] = "final"
            d["parameters"]["max_zones"]["value"] = 9
            d["parameters"]["min_stop_distance"]["value"] = 0

        self.assertGreaterEqual(len(problems_of(mutate)), 3)


if __name__ == "__main__":
    unittest.main()
