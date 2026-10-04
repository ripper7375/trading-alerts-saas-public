"""The rules file and its loader (build step 4, part 1; ADR-026; architecture 3.4).

``draft-1.yaml`` is the table of architecture 3.4 as Davin approved it on 2026-10-04. The tests pin what it says (the rows, the words
each row tests, the checksum) so that a change cannot slip in without a new version, and they prove the loader refuses every way a
hand-edited file can go wrong: a row that names a state that does not exist would otherwise never match and nobody would see it.
"""

from __future__ import annotations

import copy
import unittest

import yaml

from mcd_worker.errors import ConfigError
from mcd_worker.synthesis import facts as fx
from mcd_worker.synthesis import load_rules, parse_rules
from mcd_worker.synthesis.rules import PRIMARY, RULES_DIR, SensorVocabulary, document_sha256
from mcd_worker.tests import synthesis_support as sy

# The checksum of draft-1 over its parsed document. A change to a row, a text or the order changes it: write a new version file
# (draft-2.yaml) and a decision-log entry instead of editing draft-1, and never change this constant to make a test pass.
DRAFT_1_SHA256 = "42694707a43d65a4ec1b535f60cbc163f3a8a616ec47af87ddaa8daf3773d06e"


def document() -> dict:
    return yaml.safe_load(sy.rules_text())


def problems_of(mutate, *, vocabulary=None) -> list[str]:
    """Edit a copy of draft-1's document with ``mutate`` and return every problem the loader reports (the test fails if it accepts it)."""
    doc = copy.deepcopy(document())
    mutate(doc)
    try:
        parse_rules(yaml.safe_dump(doc, sort_keys=False), vocabulary=vocabulary or sy.vocabulary())
    except ConfigError as exc:
        return list(exc.problems)
    raise AssertionError("the loader accepted a file it should have refused")


def row(doc: dict, rule_id: str) -> dict:
    return next(r for r in doc["rules"] if r["id"] == rule_id)


class DraftOneIsTheApprovedTableTests(unittest.TestCase):
    def test_it_loads_against_the_real_registry(self) -> None:
        r = sy.rules()
        self.assertEqual((r.version, r.status), ("draft-1", "draft"))
        self.assertIn("Davin, 2026-10-04", r.approved)

    def test_the_checksum_is_pinned(self) -> None:
        self.assertEqual(sy.rules().sha256, DRAFT_1_SHA256)

    def test_the_rows_are_those_of_architecture_3_4_in_order(self) -> None:
        both = ("DAY_TRADER", "SCALPER")
        got = [(r.table_row, r.id, r.profiles) for r in sy.rules().rules]
        self.assertEqual(
            got,
            [
                ("0", "R0_DATA_CHECK", both),
                ("1", "R1_MACRO_COUNTER_TREND_RALLY", ("DAY_TRADER",)),
                ("2", "R2_EXHAUSTION_SNAPBACK", both),
                ("3", "R3_TREND_CONTINUATION", ("DAY_TRADER",)),
                ("3s", "R3S_TREND_CONTINUATION_M5", ("SCALPER",)),
                ("4", "R4_RANGE", both),
                ("5", "R5_UNRESOLVED_CONFLICT", both),
            ],
        )

    def test_the_primary_sensors_and_the_primary_first_rows(self) -> None:
        r = sy.rules()
        self.assertEqual(dict(r.primary_sensor), {"DAY_TRADER": "MCD1", "SCALPER": "MCD2"})
        self.assertEqual({x.id for x in r.rules if x.primary_first}, {"R2_EXHAUSTION_SNAPBACK", "R4_RANGE"})
        self.assertEqual(r.sensors, ("MCD1", "MCD2", "MCD3"))

    def test_each_row_tests_the_words_the_table_names(self) -> None:
        def words(rule_id: str, sensor: str, fact: str) -> set[str]:
            rule = next(x for x in sy.rules().rules if x.id == rule_id)
            return {v for b in rule.branches for c in b.when if (c.sensor, c.fact) == (sensor, fact) for v in c.values}

        self.assertEqual(words("R1_MACRO_COUNTER_TREND_RALLY", "MCD1", "regime_status"), {"COUNTER_TREND_EXPANSION"})
        self.assertEqual(words("R2_EXHAUSTION_SNAPBACK", "MCD1", "regime_status"), {"BREAKOUT_SAME_SLOPE"})
        self.assertEqual(words("R2_EXHAUSTION_SNAPBACK", "MCD2", "regime_status"), {"UPPER_OVEREXTENSION_REVERSION", "LOWER_OVEREXTENSION_REVERSION"})
        self.assertEqual(words("R3_TREND_CONTINUATION", "MCD1", "regime_status"), {"TREND_ALIGNED_CONTINUATION"})
        self.assertEqual(
            words("R3_TREND_CONTINUATION", "MCD2", "regime_status"),
            {"TREND_ALIGNED_CONTINUATION", "UPTREND_DIP_BELOW_CORRIDOR", "DOWNTREND_RALLY_ABOVE_CORRIDOR"},
        )
        self.assertEqual(
            words("R3S_TREND_CONTINUATION_M5", "MCD2", "regime_status"),
            {"TREND_ALIGNED_CONTINUATION", "UPTREND_DIP_BELOW_CORRIDOR", "DOWNTREND_RALLY_ABOVE_CORRIDOR"},
        )
        self.assertEqual(words("R4_RANGE", "MCD1", "regime_status"), {"CONSOLIDATION", "RANGE_EXPANSION"})
        self.assertEqual(
            words("R4_RANGE", "MCD2", "state_code"),
            {"MCD2_SIDEWAYS_UPPER_BREAKOUT", "MCD2_SIDEWAYS_LOWER_BREAKDOWN", "MCD2_SIDEWAYS_IN_CORRIDOR"},
        )
        self.assertEqual(
            words("R5_UNRESOLVED_CONFLICT", "MCD3", "state_code"),
            {"MCD3_NON_CONSOLIDATED_TREND_CONFLICT", "MCD3_NON_CONSOLIDATED_OVERFLOW", "MCD3_NON_CONSOLIDATED_ESCAPE"},
        )

    def test_the_data_check_is_the_first_row_and_only_tests_the_primary_sensors_status(self) -> None:
        first = sy.rules().rules[0]
        self.assertTrue(first.branches[0].result.data_stand_aside)
        for branch in first.branches:
            self.assertTrue(all((c.sensor, c.fact) == (PRIMARY, "status") for c in branch.when))
            self.assertEqual(sorted(branch.when[0].values), ["ABSENT", "INVALID", "STALE"])

    def test_the_example_texts_of_architecture_3_5_are_those_of_row_1(self) -> None:
        branch = next(x for x in sy.rules().rules if x.id == "R1_MACRO_COUNTER_TREND_RALLY").branches[0]
        self.assertEqual(branch.result.reasons, ("M15 breach up against a falling channel", "M5 uptrend"))
        self.assertEqual(branch.result.summary, "Counter-trend rally, LONG")

    def test_no_match_is_neutral(self) -> None:
        self.assertEqual(sy.rules().no_match.bias, "NEUTRAL")

    def test_the_modifiers_are_the_ones_of_decision_d1_e(self) -> None:
        effects = {m.id: (m.effect, m.bias, m.rules) for m in sy.rules().modifiers}
        self.assertEqual(effects["M3_CONFLICT_EXPECTED_UNDER_R1"], ("note", ("LONG", "SHORT"), ("R1_MACRO_COUNTER_TREND_RALLY",)))
        self.assertEqual({k for k, v in effects.items() if v[0] == "caution"}, {"M3_TREND_CONFLICT", "M3_OVERFLOW", "M3_ESCAPE"})
        self.assertEqual({k for k, v in effects.items() if v[0] == "confirm"}, {"M3_CONFIRMS_UP", "M3_CONFIRMS_DOWN"})
        # the more specific entry comes before the general one: the first that holds applies
        order = [m.id for m in sy.rules().modifiers]
        self.assertLess(order.index("M3_CONFLICT_EXPECTED_UNDER_R1"), order.index("M3_TREND_CONFLICT"))

    def test_the_file_name_is_the_version_name(self) -> None:
        self.assertEqual(sy.DRAFT_1_PATH.name, "draft-1.yaml")
        self.assertEqual(document()["rules_version"], "draft-1")

    def test_a_version_cannot_be_loaded_under_another_name(self) -> None:
        text = sy.rules_text()
        with self.assertRaises(ConfigError) as caught:
            parse_rules(text, vocabulary=sy.vocabulary(), expected_version="draft-2")
        self.assertIn("the version name and the file name must agree", str(caught.exception))

    def test_the_only_rules_file_in_the_folder_is_draft_1(self) -> None:
        self.assertEqual(sorted(p.name for p in RULES_DIR.iterdir()), ["draft-1.yaml"])


class ChecksumTests(unittest.TestCase):
    def test_line_endings_comments_and_spacing_do_not_change_it(self) -> None:
        text = sy.rules_text()
        vocabulary = sy.vocabulary()
        crlf = parse_rules(text.replace("\r\n", "\n").replace("\n", "\r\n"), vocabulary=vocabulary)
        self.assertEqual(crlf.sha256, DRAFT_1_SHA256)
        commented = parse_rules("# one more comment\n" + text + "\n# and another\n", vocabulary=vocabulary)
        self.assertEqual(commented.sha256, DRAFT_1_SHA256)
        reordered = yaml.safe_dump(document(), sort_keys=True)
        self.assertEqual(parse_rules(reordered, vocabulary=vocabulary).sha256, DRAFT_1_SHA256)

    def test_any_change_of_meaning_changes_it(self) -> None:
        for mutate in (
            lambda d: row(d, "R1_MACRO_COUNTER_TREND_RALLY")["branches"][0]["result"].update(summary="Counter-trend rally, LONG!"),
            lambda d: row(d, "R2_EXHAUSTION_SNAPBACK")["branches"][0]["result"].update(bias="LONG"),
            lambda d: d["modifiers"].reverse(),
            lambda d: d["rules"].insert(2, d["rules"].pop(5)),
            lambda d: d.update(approved="someone else"),
        ):
            doc = copy.deepcopy(document())
            mutate(doc)
            self.assertNotEqual(document_sha256(doc), DRAFT_1_SHA256)

    def test_non_ascii_text_is_hashed_as_ascii_json(self) -> None:
        import hashlib
        import json

        doc = copy.deepcopy(document())
        doc["approved"] = "Davin, 2026-10-04, caf\u00e9"
        loaded = parse_rules(yaml.safe_dump(doc, sort_keys=False, allow_unicode=True), vocabulary=sy.vocabulary())
        text = json.dumps(doc, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
        self.assertIn("\\u00e9", text)
        self.assertEqual(loaded.sha256, hashlib.sha256(text.encode()).hexdigest())

    def test_it_is_the_hash_of_sorted_compact_json(self) -> None:
        import hashlib
        import json

        text = json.dumps(document(), sort_keys=True, separators=(",", ":"), ensure_ascii=True)
        self.assertEqual(hashlib.sha256(text.encode()).hexdigest(), DRAFT_1_SHA256)


class RefusalTests(unittest.TestCase):
    """The loader reports every way a hand-edited file can be wrong."""

    def assertMentions(self, problems: list[str], *needles: str) -> None:
        joined = "\n".join(problems)
        for needle in needles:
            self.assertIn(needle, joined)

    # ------------------------------------------------------------------ the file itself
    def test_a_file_that_is_not_yaml(self) -> None:
        with self.assertRaises(ConfigError) as caught:
            parse_rules("rules: [unclosed", vocabulary=sy.vocabulary())
        self.assertIn("not valid YAML", str(caught.exception))

    def test_a_file_that_is_not_a_mapping(self) -> None:
        with self.assertRaises(ConfigError) as caught:
            parse_rules("- just\n- a list\n", vocabulary=sy.vocabulary())
        self.assertIn("must be a mapping", str(caught.exception))

    def test_a_key_written_twice(self) -> None:
        text = sy.rules_text().replace("status: draft\n", "status: draft\nstatus: approved\n", 1)
        with self.assertRaises(ConfigError) as caught:
            parse_rules(text, vocabulary=sy.vocabulary())
        self.assertIn("duplicate key", str(caught.exception))

    def test_a_missing_file_and_a_bad_version_name(self) -> None:
        with self.assertRaises(ConfigError) as caught:
            load_rules("draft-2", vocabulary=sy.vocabulary())
        self.assertIn("cannot read the rules file", str(caught.exception))
        for bad in ("../draft-1", "Draft-1", "", "a b"):
            with self.assertRaises(ConfigError, msg=bad):
                load_rules(bad, vocabulary=sy.vocabulary())

    def test_a_name_with_a_trailing_newline_is_not_a_version_name(self) -> None:
        for bad in ("draft-1\n", "draft-1 ", "draft-1/x"):
            with self.assertRaises(ConfigError, msg=repr(bad)):
                load_rules(bad, vocabulary=sy.vocabulary())
        self.assertMentions(problems_of(lambda d: d.update(rules_version="draft-1\n")), "rules_version")
        self.assertMentions(problems_of(lambda d: d["rules"][1].update(id="R1_NAME\n")), "rules[1].id")
        self.assertMentions(problems_of(lambda d: d["rules"][1]["branches"][0].update(id="UP\n")), "branches[0].id")
        self.assertMentions(problems_of(lambda d: d["modifiers"][0].update(id="M\n")), "modifiers[0].id")

    def test_a_date_or_other_non_plain_value(self) -> None:
        text = sy.rules_text().replace("approved: 'Davin", "approved: 2026-10-04\nunused: 'Davin", 1)
        with self.assertRaises(ConfigError):
            parse_rules(text, vocabulary=sy.vocabulary())

    def test_every_problem_is_reported_at_once(self) -> None:
        def mutate(d: dict) -> None:
            d["status"] = "final"
            d["rules"][1]["id"] = "bad id"
            d["no_match"]["bias"] = "LONG"

        problems = problems_of(mutate)
        self.assertGreaterEqual(len(problems), 3)
        self.assertMentions(problems, "status", "rules[1].id", "no_match.bias")

    # ------------------------------------------------------------------ header
    def test_header_problems(self) -> None:
        self.assertMentions(problems_of(lambda d: d.update(schema="synthesis-rules/2")), "schema")
        self.assertMentions(problems_of(lambda d: d.update(rules_version="Draft 1")), "rules_version")
        self.assertMentions(problems_of(lambda d: d.update(rules_version="Draft-1")), "rules_version")  # upper case alone: no space, no other fault
        self.assertMentions(problems_of(lambda d: d.update(status="final")), "status")
        self.assertMentions(problems_of(lambda d: d.update(approved="")), "approved")
        self.assertMentions(problems_of(lambda d: d.update(extra=1)), "unknown key 'extra'")
        self.assertMentions(problems_of(lambda d: d.pop("modifiers")), "missing key 'modifiers'")

    def test_profile_and_sensor_problems(self) -> None:
        self.assertMentions(problems_of(lambda d: d["profiles"]["DAY_TRADER"].update(primary_sensor="MCD3")), "primary_sensor")
        self.assertMentions(problems_of(lambda d: d["profiles"].pop("SCALPER")), "SCALPER")
        self.assertMentions(problems_of(lambda d: d["profiles"].update(SWING={"primary_sensor": "MCD1"})), "unknown key 'SWING'")
        self.assertMentions(problems_of(lambda d: d.update(sensors=["MCD1", "MCD2", "MCD9"])), "MCD9")
        self.assertMentions(problems_of(lambda d: d.update(sensors=["MCD1", "MCD2", "MCD2"])), "lists a value twice")
        missing = {k: v for k, v in sy.vocabulary().items() if k != "MCD3"}
        self.assertMentions(problems_of(lambda d: None, vocabulary=missing), "MCD3 is not in the registry")

    def test_a_register_state_the_facts_cannot_read(self) -> None:
        vocabulary = dict(sy.vocabulary())
        vocabulary["MCD2"] = SensorVocabulary(vocabulary["MCD2"].state_codes | {"MCD2_UP_SIDEWAYS"}, vocabulary["MCD2"].regime_words)
        self.assertMentions(problems_of(lambda d: None, vocabulary=vocabulary), "MCD2_UP_SIDEWAYS", "is not of the form")
        vocabulary = dict(sy.vocabulary())
        vocabulary["MCD3"] = SensorVocabulary(vocabulary["MCD3"].state_codes | {"MCD3_MYSTERY"}, vocabulary["MCD3"].regime_words)
        self.assertMentions(problems_of(lambda d: None, vocabulary=vocabulary), "MCD3_MYSTERY")

    def test_no_match_problems(self) -> None:
        self.assertMentions(problems_of(lambda d: d["no_match"].update(bias="STAND_ASIDE")), "NEUTRAL")
        self.assertMentions(problems_of(lambda d: d["no_match"].update(reasons=[])), "no_match.reasons")
        self.assertMentions(problems_of(lambda d: d["no_match"].update(summary="x" * 81)), "81 characters")
        self.assertMentions(problems_of(lambda d: d["no_match"].update(rule_id="NO_MATCH")), "unknown key 'rule_id'")

    # ------------------------------------------------------------------ rows
    def test_row_problems(self) -> None:
        self.assertMentions(problems_of(lambda d: d.update(rules=[])), "rules")
        self.assertMentions(problems_of(lambda d: d["rules"][1].update(id="r1_lowercase")), "R1_NAME")
        self.assertMentions(problems_of(lambda d: d["rules"][2].update(id=d["rules"][1]["id"])), "used twice")
        self.assertMentions(problems_of(lambda d: d["rules"][1].update(id="NO_MATCH")), "R1_NAME")
        self.assertMentions(problems_of(lambda d: d["rules"][1].update(profiles=["SWING"])), "profiles")
        self.assertMentions(problems_of(lambda d: d["rules"][1].update(profiles=[])), "profiles")
        self.assertMentions(problems_of(lambda d: d["rules"][1].update(primary_first="yes please")), "primary_first")
        self.assertMentions(problems_of(lambda d: d["rules"][1].update(branches=[])), "branches")
        self.assertMentions(problems_of(lambda d: d["rules"][1].update(table_row="")), "table_row")
        self.assertMentions(problems_of(lambda d: d["rules"][1].update(colour="red")), "unknown key 'colour'")
        self.assertMentions(problems_of(lambda d: d["rules"][1].update(id="R1_HIGH_CONVICTION_RALLY")), "banned word")

    def test_the_data_check_must_come_first_for_every_trader_type(self) -> None:
        def move(d: dict) -> None:
            d["rules"].append(d["rules"].pop(0))

        self.assertMentions(problems_of(move), "the first row for DAY_TRADER must be the data check")

    def test_a_trader_type_with_no_row(self) -> None:
        def only_day(d: dict) -> None:
            for r in d["rules"]:
                r["profiles"] = ["DAY_TRADER"]

        self.assertMentions(problems_of(only_day), "no row applies to SCALPER")

    # ------------------------------------------------------------------ branches and conditions
    def test_branch_problems(self) -> None:
        def r1(d: dict) -> dict:
            return row(d, "R1_MACRO_COUNTER_TREND_RALLY")

        self.assertMentions(problems_of(lambda d: r1(d)["branches"][0].update(id="lower case")), "branches[0].id")
        self.assertMentions(problems_of(lambda d: r1(d)["branches"][1].update(id=r1(d)["branches"][0]["id"])), "used twice in this row")
        self.assertMentions(problems_of(lambda d: r1(d)["branches"][0].update(sensor="MCD7")), "branches[0].sensor")
        self.assertMentions(problems_of(lambda d: r1(d)["branches"][0].update(when=[])), "branches[0].when")
        self.assertMentions(problems_of(lambda d: r1(d)["branches"][0].pop("result")), "missing key 'result'")
        self.assertMentions(problems_of(lambda d: row(d, "R2_EXHAUSTION_SNAPBACK")["branches"][0].pop("sensor")), "needs a `sensor`")
        self.assertMentions(problems_of(lambda d: r1(d)["branches"][0].update(id="HIGH_CONVICTION")), "banned word")

    def test_condition_problems(self) -> None:
        def cond(d: dict) -> dict:
            return row(d, "R1_MACRO_COUNTER_TREND_RALLY")["branches"][0]["when"][0]

        self.assertMentions(problems_of(lambda d: cond(d).update(sensor="MCD9")), "is not one of")
        self.assertMentions(problems_of(lambda d: cond(d).update(fact="trend")), "is not allowed here")  # trend has no COUNTER_TREND_EXPANSION value
        self.assertMentions(problems_of(lambda d: cond(d).update(fact="mood")), "has no fact 'mood'")
        self.assertMentions(problems_of(lambda d: cond(d).update(sensor="MCD3", fact="trend", **{"in": ["UP"]})), "MCD3 has no fact 'trend'")
        self.assertMentions(problems_of(lambda d: cond(d).update(**{"in": ["NOT_A_REGIME"]})), "NOT_A_REGIME")
        self.assertMentions(problems_of(lambda d: cond(d).update(**{"in": []})), "non-empty list")
        self.assertMentions(problems_of(lambda d: cond(d).update(**{"in": "COUNTER_TREND_EXPANSION"})), "non-empty list")
        self.assertMentions(problems_of(lambda d: cond(d).update(**{"in": ["COUNTER_TREND_EXPANSION", "COUNTER_TREND_EXPANSION"]})), "lists a value twice")
        self.assertMentions(problems_of(lambda d: cond(d).update(extra=1)), "unknown key 'extra'")
        self.assertMentions(problems_of(lambda d: cond(d).pop("fact")), "missing key 'fact'")

    def test_a_state_code_that_is_not_in_the_register(self) -> None:
        def mutate(d: dict) -> None:
            cond = row(d, "R4_RANGE")["branches"][1]["when"][0]
            cond["in"] = ["MCD2_SIDEWAYS_UPPER_BREAKOUT_TYPO"]

        self.assertMentions(problems_of(mutate), "MCD2_SIDEWAYS_UPPER_BREAKOUT_TYPO")

    def test_a_state_code_of_another_sensor(self) -> None:
        def mutate(d: dict) -> None:
            row(d, "R4_RANGE")["branches"][1]["when"][0]["in"] = ["MCD1_SIDEWAYS_IN_CORRIDOR"]

        self.assertMentions(problems_of(mutate), "MCD1_SIDEWAYS_IN_CORRIDOR")

    def test_a_yaml_boolean_where_a_word_was_meant(self) -> None:
        # unquoted NO is the boolean false in YAML 1.1
        text = sy.rules_text().replace("in: [UP]", "in: [NO]", 1)
        with self.assertRaises(ConfigError) as caught:
            parse_rules(text, vocabulary=sy.vocabulary())
        self.assertIn("quote it", str(caught.exception))

    def test_primary_may_only_be_tested_for_its_status(self) -> None:
        def mutate(d: dict) -> None:
            row(d, "R0_DATA_CHECK")["branches"][0]["when"][0].update(fact="state_code", **{"in": ["MCD1_UP_IN_CORRIDOR"]})

        self.assertMentions(problems_of(mutate), "PRIMARY may only be tested for its status")

    def test_status_values_are_checked(self) -> None:
        def mutate(d: dict) -> None:
            row(d, "R0_DATA_CHECK")["branches"][0]["when"][0]["in"] = ["BROKEN"]

        self.assertMentions(problems_of(mutate), "BROKEN")

    # ------------------------------------------------------------------ results
    def test_result_problems(self) -> None:
        def result(d: dict) -> dict:
            return row(d, "R1_MACRO_COUNTER_TREND_RALLY")["branches"][0]["result"]

        self.assertMentions(problems_of(lambda d: result(d).update(bias="MAYBE")), "result.bias")
        self.assertMentions(problems_of(lambda d: result(d).update(archetype="Z")), "archetype")
        self.assertMentions(problems_of(lambda d: result(d).update(archetype=None)), "needs an archetype and a trend_relation")
        self.assertMentions(problems_of(lambda d: result(d).update(trend_relation=None)), "needs an archetype and a trend_relation")
        self.assertMentions(problems_of(lambda d: result(d).update(trend_relation="SIDEWAYS")), "trend_relation")
        self.assertMentions(problems_of(lambda d: result(d).update(bias="NEUTRAL")), "has no trend relation")
        self.assertMentions(problems_of(lambda d: result(d).update(reasons=[])), "reasons")
        self.assertMentions(problems_of(lambda d: result(d).update(reasons=[""])), "non-empty text")
        self.assertMentions(problems_of(lambda d: result(d).update(summary="")), "summary")
        self.assertMentions(problems_of(lambda d: result(d).update(data_stand_aside="maybe")), "data_stand_aside")
        self.assertMentions(problems_of(lambda d: result(d).update(mood="up")), "unknown key 'mood'")

    def test_a_data_stand_aside_must_be_a_stand_aside_that_only_tests_primary_status(self) -> None:
        def result(d: dict) -> dict:
            return row(d, "R0_DATA_CHECK")["branches"][0]["result"]

        self.assertMentions(problems_of(lambda d: result(d).update(bias="NEUTRAL")), "must be STAND_ASIDE")
        self.assertMentions(problems_of(lambda d: result(d).update(archetype="A")), "has no archetype")

        def other_sensor(d: dict) -> None:
            row(d, "R0_DATA_CHECK")["branches"][0]["when"].append({"sensor": "MCD2", "fact": "status", "in": ["STALE"]})

        self.assertMentions(problems_of(other_sensor), "may only test the status of PRIMARY")

    def test_wording_is_checked_in_every_text(self) -> None:
        def reason(d: dict) -> list:
            return row(d, "R3_TREND_CONTINUATION")["branches"][0]["result"]["reasons"]

        self.assertMentions(problems_of(lambda d: reason(d).append("High conviction trend")), "banned word CONVICTION")
        self.assertMentions(problems_of(lambda d: reason(d).append("Trend holds 70% of the time")), "contains '%'")
        self.assertMentions(problems_of(lambda d: reason(d).append("Buy the dip")), "advice word BUY")
        self.assertMentions(problems_of(lambda d: row(d, "R3_TREND_CONTINUATION")["branches"][0]["result"].update(summary="S" * 81)), "81 characters")
        self.assertMentions(problems_of(lambda d: row(d, "R3_TREND_CONTINUATION")["branches"][0]["result"].update(summary="Trend at 4384 up")), "looks like a price")
        self.assertMentions(problems_of(lambda d: d["no_match"]["reasons"].append("Safe to ignore")), "banned word SAFE")
        self.assertMentions(problems_of(lambda d: d["modifiers"][0].update(text="Guaranteed conflict")), "banned word GUARANTEED")

    # ------------------------------------------------------------------ modifiers
    def test_modifier_problems(self) -> None:
        def mod(d: dict, index: int = 0) -> dict:
            return d["modifiers"][index]

        self.assertMentions(problems_of(lambda d: mod(d).update(effect="veto")), "effect")
        self.assertMentions(problems_of(lambda d: mod(d).update(bias=["STAND_ASIDE"])), "bias")
        self.assertMentions(problems_of(lambda d: mod(d).update(bias=[])), "bias")
        self.assertMentions(problems_of(lambda d: mod(d).update(rules=["R7_NOWHERE"])), "R7_NOWHERE")
        self.assertMentions(problems_of(lambda d: mod(d).update(rules=[])), "rules")
        self.assertMentions(problems_of(lambda d: mod(d).update(sensor="MCD1")), "is not allowed here")  # MCD3's state code is not a state of MCD1
        self.assertMentions(problems_of(lambda d: mod(d).update(sensor="MCD8")), "sensor")
        self.assertMentions(problems_of(lambda d: mod(d).update(text="")), "text")
        self.assertMentions(problems_of(lambda d: mod(d).update(when=[])), "when")
        self.assertMentions(problems_of(lambda d: mod(d).update(id=mod(d, 1)["id"])), "used twice")
        self.assertMentions(problems_of(lambda d: mod(d).update(id="lower")), "modifiers[0].id")
        self.assertMentions(problems_of(lambda d: mod(d)["when"][0].update(fact="trend")), "MCD3 has no fact 'trend'")
        self.assertMentions(problems_of(lambda d: mod(d)["when"][0].update(**{"in": ["MCD3_NOWHERE"]})), "MCD3_NOWHERE")
        self.assertMentions(problems_of(lambda d: d.update(modifiers="none")), "must be a list")

    def test_a_file_with_no_modifiers_is_allowed(self) -> None:
        doc = copy.deepcopy(document())
        doc["modifiers"] = []
        loaded = parse_rules(yaml.safe_dump(doc, sort_keys=False), vocabulary=sy.vocabulary())
        self.assertEqual(loaded.modifiers, ())


class FactsTests(unittest.TestCase):
    def test_every_state_of_the_real_registers_has_facts(self) -> None:
        for sensor in fx.SENSORS:
            self.assertEqual(fx.register_problems(sensor, sy.states(sensor)), [], sensor)

    def test_the_channel_facts(self) -> None:
        self.assertEqual(fx.channel_facts("MCD1_DOWN_UPPER_BREAKOUT"), {"trend": "DOWN", "position": "UPPER_BREAKOUT", "breach": "UP"})
        self.assertEqual(fx.channel_facts("MCD2_UP_LOWER_BREAKDOWN"), {"trend": "UP", "position": "LOWER_BREAKDOWN", "breach": "DOWN"})
        self.assertEqual(fx.channel_facts("MCD2_SIDEWAYS_IN_CORRIDOR"), {"trend": "SIDEWAYS", "position": "IN_CORRIDOR", "breach": "NONE"})
        for bad in ("MCD2_UP", "MCD2_UP_SIDEWAYS", "MCD2_FLAT_IN_CORRIDOR", "MCD2_UP_IN_CORRIDOR\n", "MCD2_UP_IN_CORRIDOR_X", "X_MCD2_UP_IN_CORRIDOR", None, 5, ""):
            self.assertIsNone(fx.channel_facts(bad), bad)

    def test_the_consolidation_facts(self) -> None:
        self.assertEqual(fx.consolidation_of("MCD3_BULL_TOP"), "UP")
        self.assertEqual(fx.consolidation_of("MCD3_BEAR_PREMIUM"), "DOWN")
        self.assertEqual(fx.consolidation_of("MCD3_SIDEWAYS_EQUILIBRIUM"), "FLAT")
        self.assertEqual(fx.consolidation_of("MCD3_NON_CONSOLIDATED_ESCAPE"), "NONE")
        for bad in ("MCD3_MYSTERY", "MCD3_BULLISH", None, 3):
            self.assertIsNone(fx.consolidation_of(bad), bad)

    def test_an_unusable_sensor_has_only_a_status(self) -> None:
        for status in ("INVALID", "STALE", "ABSENT"):
            facts = fx.facts_of("MCD1", status, "MCD1_UP_IN_CORRIDOR", "TREND_ALIGNED_CONTINUATION", "LONG")  # whatever was passed is ignored
            self.assertEqual(facts["status"], status)
            self.assertTrue(all(v is None for k, v in facts.items() if k != "status"), status)

    def test_a_usable_sensor_has_every_fact(self) -> None:
        facts = fx.facts_of("MCD1", "CAUTIONARY", "MCD1_DOWN_UPPER_BREAKOUT", "COUNTER_TREND_EXPANSION", "LONG")
        self.assertEqual(
            facts,
            {
                "status": "CAUTIONARY", "state_code": "MCD1_DOWN_UPPER_BREAKOUT", "regime_status": "COUNTER_TREND_EXPANSION",
                "bias": "LONG", "trend": "DOWN", "position": "UPPER_BREAKOUT", "breach": "UP",
            },
        )
        facts = fx.facts_of("MCD3", "VALID", "MCD3_BULL_MID", "BULLISH_CONSOLIDATED_EQUILIBRIUM", "LONG")
        self.assertEqual(facts["consolidation"], "UP")
        self.assertNotIn("trend", facts)

    def test_an_unknown_sensor_has_no_facts(self) -> None:
        self.assertEqual(fx.facts_available_for("MCD0"), ())
        self.assertEqual(fx.facts_of("MCD0", "VALID", "MCD0_X", None, "NEUTRAL"), {"status": "VALID", "state_code": "MCD0_X", "regime_status": None, "bias": "NEUTRAL"})

    def test_every_fixed_value_set_is_a_non_empty_tuple_of_words(self) -> None:
        for fact, values in fx.FIXED_VALUES.items():
            self.assertTrue(values and all(isinstance(v, str) and v for v in values), fact)


if __name__ == "__main__":
    unittest.main()
