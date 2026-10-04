"""The SYN reading: canonical form, schema, guards (build step 4, part 1; architecture 3.5; R4, R5, R9 of the MCD standard).

What must hold before a reading may be saved, and that the same decision is always the same bytes.
"""

from __future__ import annotations

import copy
import hashlib
import json
import math
import subprocess
import sys
import unittest

from mcd_common import reason_codes as rc

from mcd_worker.synthesis import SynReading, decide, make_reading, reading_problems, synthesize_cycle
from mcd_worker.synthesis import reading as rd
from mcd_worker.tests import support as s
from mcd_worker.tests import synthesis_support as sy
from mcd_worker.tests.synthesis_support import DAY, SCALPER, SLOT, cycle, rules

R1_CYCLE = dict(MCD1="MCD1_DOWN_UPPER_BREAKOUT", MCD2="MCD2_UP_IN_CORRIDOR", MCD3="MCD3_NON_CONSOLIDATED_TREND_CONFLICT")


def made(profile: str = DAY, *, data_status: str = "FRESH", zones=(), **readings) -> SynReading:
    readings = readings or R1_CYCLE
    return make_reading(rules(), profile, decide(rules(), profile, cycle(**readings)), cycle_slot=SLOT, data_status=data_status, zones=zones)


def base(profile: str = DAY, **readings) -> dict:
    """A valid reading as a plain dict to mutate."""
    return copy.deepcopy(dict(made(profile, **readings).reading))


def problems(mutate, profile: str = DAY, **readings) -> list[str]:
    reading = base(profile, **readings)
    mutate(reading)
    found = reading_problems(reading, rules())
    if not found:
        raise AssertionError("the guards accepted a reading they should have refused")
    return found


def found_in(mutate, profile: str = DAY, **readings) -> list[str]:
    """The problems of a mutated reading; an empty list is a legitimate answer here."""
    reading = base(profile, **readings)
    mutate(reading)
    return reading_problems(reading, rules())


def mentions(found: list[str], *needles: str) -> bool:
    joined = "\n".join(found)
    return all(n in joined for n in needles)


class CanonicalFormTests(unittest.TestCase):
    def test_the_key_order_is_the_schemas_required_list(self) -> None:
        schema = json.loads(rd.SCHEMA_PATH.read_text(encoding="utf-8"))
        self.assertEqual(list(rd.TOP_LEVEL_ORDER), schema["required"])
        self.assertEqual(sorted(schema["properties"]), sorted(rd.TOP_LEVEL_ORDER))

    def test_a_reading_is_compact_ascii_json_in_that_order(self) -> None:
        syn = made()
        text = syn.canonical_json
        self.assertTrue(text.isascii())
        self.assertNotIn("\n", text)
        self.assertEqual(text, json.dumps(json.loads(text), separators=(",", ":"), ensure_ascii=True))  # no spaces between tokens
        self.assertEqual(list(json.loads(text)), list(rd.TOP_LEVEL_ORDER))
        self.assertEqual(list(syn.reading), list(rd.TOP_LEVEL_ORDER))
        self.assertEqual(json.loads(text), json.loads(json.dumps(syn.reading)))

    def test_non_ascii_text_is_written_as_escapes(self) -> None:
        reading = dict(base(), reasons=["caf\u00e9"])
        text = rd.canonical_json(reading)
        self.assertTrue(text.isascii())
        self.assertIn("caf\\u00e9", text)
        self.assertEqual(json.loads(text)["reasons"], ["caf\u00e9"])

    def test_nan_and_infinity_are_refused_wherever_they_sit(self) -> None:
        for bad in (math.nan, math.inf, -math.inf):
            reading = dict(base(), reasons=[bad])
            with self.assertRaises(ValueError):
                rd.canonical_json(reading)
            self.assertTrue(mentions(reading_problems(reading), "cannot be serialised"))

    def test_the_hash_is_the_sha256_of_the_text(self) -> None:
        syn = made()
        self.assertEqual(syn.sha256, hashlib.sha256(syn.canonical_json.encode("utf-8")).hexdigest())
        self.assertEqual(rd.sha256_text(syn.canonical_json), syn.sha256)

    def test_the_same_decision_is_the_same_bytes(self) -> None:
        self.assertEqual(made().canonical_json, made().canonical_json)
        self.assertNotEqual(made(DAY).sha256, made(SCALPER).sha256)

    def test_the_input_order_does_not_matter(self) -> None:
        reading = base()
        shuffled = dict(reversed(list(reading.items())))
        shuffled["inputs"] = {k: dict(reversed(list(v.items()))) for k, v in reversed(list(reading["inputs"].items()))}
        self.assertEqual(rd.canonical_json(shuffled), rd.canonical_json(reading))
        self.assertEqual(list(json.loads(rd.canonical_json(shuffled))["inputs"]), ["MCD1", "MCD2", "MCD3"])
        self.assertEqual(list(json.loads(rd.canonical_json(shuffled))["inputs"]["MCD1"]), list(rd.INPUT_ORDER))

    def test_keys_outside_the_schema_are_kept_so_the_schema_can_refuse_them(self) -> None:
        reading = dict(base(), zebra=1, apple=2)
        self.assertEqual(list(rd.canonical(reading))[-2:], ["apple", "zebra"])
        self.assertTrue(mentions(reading_problems(reading), "Additional properties"))

    def test_the_reading_names_its_rules(self) -> None:
        r = made().reading
        self.assertEqual((r["rules_version"], r["rules_sha256"]), (rules().version, rules().sha256))
        self.assertEqual((r["rule_id"], r["branch_id"], r["profile"], r["cycle_slot"]), ("R1_MACRO_COUNTER_TREND_RALLY", "BREACH_UP", DAY, SLOT))

    def test_the_architecture_example_fields(self) -> None:
        r = made().reading
        self.assertEqual((r["schema_version"], r["mcd_id"], r["archetype"], r["bias"], r["trend_relation"], r["stand_aside"]), ("syn-output/1", "SYN", "C", "LONG", "COUNTER_TREND", False))
        self.assertEqual(r["zones"], [])
        self.assertEqual(r["summary_line"], "Counter-trend rally, LONG")

    def test_the_inputs_name_every_synthesis_sensor_with_its_state_and_envelope_hash(self) -> None:
        r = made().reading
        self.assertEqual(list(r["inputs"]), ["MCD1", "MCD2", "MCD3"])
        self.assertEqual(r["inputs"]["MCD1"]["state_code"], "MCD1_DOWN_UPPER_BREAKOUT")
        self.assertEqual(r["inputs"]["MCD1"]["regime_status"], "COUNTER_TREND_EXPANSION")
        self.assertRegex(r["inputs"]["MCD1"]["envelope_sha256"], r"^[0-9a-f]{64}$")


class EntryPointTests(unittest.TestCase):
    def test_a_day_trader_and_a_scalper_reading_per_cycle_each_saved_with_rule_and_version(self) -> None:
        both = synthesize_cycle(rules(), cycle(**R1_CYCLE), cycle_slot=SLOT, data_status="FRESH")
        self.assertEqual(list(both), [DAY, SCALPER])
        for profile, syn in both.items():
            self.assertTrue(syn.ok, syn.problems)
            self.assertEqual(syn.profile, profile)
            self.assertEqual((syn.reading["profile"], syn.reading["rules_version"]), (profile, "draft-1"))
            self.assertTrue(syn.reading["rule_id"])
        self.assertEqual(both[DAY].reading["rule_id"], "R1_MACRO_COUNTER_TREND_RALLY")
        self.assertEqual(both[SCALPER].reading["rule_id"], "R3S_TREND_CONTINUATION_M5")

    def test_zones_are_passed_through_for_the_trader_type_they_belong_to(self) -> None:
        both = synthesize_cycle(rules(), cycle(**R1_CYCLE), cycle_slot=SLOT, data_status="FRESH", zones={DAY: ["Z1", "Z2"]})
        self.assertEqual(both[DAY].reading["zones"], ["Z1", "Z2"])
        self.assertEqual(both[SCALPER].reading["zones"], [])
        self.assertTrue(both[DAY].ok)

    def test_zones_on_a_stand_aside_reading_are_refused(self) -> None:
        syn = made(DAY, zones=["Z1"], MCD1="MCD1_SIDEWAYS_IN_CORRIDOR", MCD2="MCD2_UP_IN_CORRIDOR")
        self.assertEqual(syn.reading["bias"], "STAND_ASIDE")
        self.assertFalse(syn.ok)
        self.assertTrue(mentions(list(syn.problems), "zones"))

    def test_every_data_status_is_recorded_and_an_unknown_one_is_refused(self) -> None:
        for status in rd.DATA_STATUSES:
            syn = made(data_status=status)
            self.assertTrue(syn.ok, status)
            self.assertEqual(syn.reading["data_status"], status)
        bad = made(data_status="OPEN")
        self.assertFalse(bad.ok)
        self.assertTrue(mentions(list(bad.problems), "data_status"))

    def test_a_bad_slot_is_refused(self) -> None:
        syn = make_reading(rules(), DAY, decide(rules(), DAY, cycle(**R1_CYCLE)), cycle_slot="2026-09-18T20:56Z", data_status="FRESH")
        self.assertFalse(syn.ok)
        self.assertTrue(mentions(list(syn.problems), "5-minute slot"))

    def test_a_reading_that_cannot_be_written_has_no_text_and_no_hash(self) -> None:
        decision = decide(rules(), DAY, cycle(**R1_CYCLE))
        broken = type(decision)(**{**decision.__dict__, "inputs": {"MCD1": {"status": "VALID", "bad": math.nan}}})
        syn = make_reading(rules(), DAY, broken, cycle_slot=SLOT, data_status="FRESH")
        self.assertFalse(syn.ok)
        self.assertEqual((syn.canonical_json, syn.sha256), ("", ""))
        self.assertTrue(mentions(list(syn.problems), "cannot be serialised"))

    def test_a_data_stand_aside_is_an_unavailable_reading_that_still_says_stand_aside(self) -> None:
        stale = made(DAY, MCD1=("-", rc.STALE), MCD2="MCD2_UP_IN_CORRIDOR")
        self.assertTrue(stale.ok, stale.problems)
        r = stale.reading
        self.assertEqual((r["status"], r["bias"], r["stand_aside"], r["archetype"], r["trend_relation"], r["zones"]), ("STALE", "STAND_ASIDE", True, None, None, []))
        self.assertEqual(r["status_reasons"], ["UPSTREAM_STALE:MCD1"])
        invalid = made(SCALPER, MCD1="MCD1_UP_IN_CORRIDOR", MCD2=("-", rc.INVALID))
        self.assertTrue(invalid.ok, invalid.problems)
        self.assertEqual((invalid.reading["status"], invalid.reading["status_reasons"]), ("INVALID", ["UPSTREAM_UNAVAILABLE:MCD2"]))

    def test_a_no_match_reading_is_neutral_valid_and_complete(self) -> None:
        syn = made(DAY, MCD1="MCD1_UP_IN_CORRIDOR", MCD2="MCD2_DOWN_IN_CORRIDOR", MCD3="MCD3_BULL_MID")
        self.assertTrue(syn.ok, syn.problems)
        r = syn.reading
        self.assertEqual((r["rule_id"], r["branch_id"], r["bias"], r["status"], r["stand_aside"], r["archetype"], r["trend_relation"]), ("NO_MATCH", None, "NEUTRAL", "VALID", False, None, None))
        self.assertEqual(r["inputs"]["MCD3"]["state_code"], "MCD3_BULL_MID")

    def test_odd_input_never_raises(self) -> None:
        for odd in (None, 5, [], "reading"):
            self.assertEqual(reading_problems(odd, rules()), [f"SCHEMA: the reading is a {type(odd).__name__}, not a mapping"])
        for odd in ({}, {"schema_version": "x"}):
            self.assertTrue(reading_problems(odd, rules()), odd)
        nan = base()
        nan["inputs"]["MCD1"]["envelope_sha256"] = math.nan
        self.assertTrue(mentions(reading_problems(nan), "cannot be serialised"))
        self.assertEqual(reading_problems(base(), None), [])  # without rules the identity guard is skipped, the rest still runs


class SchemaInvariantTests(unittest.TestCase):
    """The schema states the invariants, so a reading that breaks one is refused whoever built it."""

    def test_a_valid_reading_passes_every_guard(self) -> None:
        for readings in (R1_CYCLE, dict(MCD1="MCD1_SIDEWAYS_IN_CORRIDOR", MCD2="MCD2_UP_IN_CORRIDOR")):
            self.assertEqual(reading_problems(base(DAY, **readings), rules()), [])

    def test_stand_aside_means_no_zones_and_no_other_direction(self) -> None:
        stand_aside = dict(MCD1="MCD1_SIDEWAYS_IN_CORRIDOR", MCD2="MCD2_UP_IN_CORRIDOR")
        self.assertTrue(mentions(problems(lambda r: r.update(zones=["Z1"]), DAY, **stand_aside), "zones"))
        self.assertTrue(mentions(problems(lambda r: r.update(bias="LONG"), DAY, **stand_aside), "bias"))
        self.assertTrue(mentions(problems(lambda r: r.update(stand_aside=False), DAY, **stand_aside), "stand_aside"))
        self.assertTrue(mentions(problems(lambda r: r.update(stand_aside=True)), "bias"))  # a LONG reading cannot say stand_aside

    def test_an_unavailable_reading_carries_no_direction(self) -> None:
        unavailable = dict(MCD1=("-", rc.INVALID), MCD2="MCD2_UP_IN_CORRIDOR")
        self.assertTrue(mentions(problems(lambda r: r.update(bias="NEUTRAL", stand_aside=False), DAY, **unavailable), "bias"))
        self.assertTrue(mentions(problems(lambda r: r.update(archetype="A"), DAY, **unavailable), "archetype"))

    def test_reasons_and_status_agree(self) -> None:
        valid = dict(MCD1="MCD1_DOWN_IN_CORRIDOR", MCD2="MCD2_DOWN_IN_CORRIDOR")
        self.assertEqual(base(DAY, **valid)["status"], "VALID")
        self.assertTrue(mentions(problems(lambda r: r.update(status_reasons=["RETUNING"]), DAY, **valid), "status_reasons"))
        cautionary = dict(MCD1=("MCD1_DOWN_UPPER_BREAKOUT", rc.CAUTIONARY), MCD2="MCD2_UP_IN_CORRIDOR")
        self.assertEqual(base(DAY, **cautionary)["status"], "CAUTIONARY")
        self.assertTrue(mentions(problems(lambda r: r.update(status_reasons=[]), DAY, **cautionary), "status_reasons"))  # CAUTIONARY needs reasons
        self.assertTrue(mentions(problems(lambda r: r.update(status_reasons=["RETUNING", "RETUNING"])), "non-unique"))

    def test_a_direction_has_an_archetype_and_a_trend_relation_and_nothing_else_has_a_relation(self) -> None:
        self.assertTrue(mentions(problems(lambda r: r.update(archetype=None)), "archetype"))
        self.assertTrue(mentions(problems(lambda r: r.update(trend_relation=None)), "trend_relation"))
        no_match = dict(MCD1="MCD1_UP_IN_CORRIDOR", MCD2="MCD2_DOWN_IN_CORRIDOR", MCD3="MCD3_BULL_MID")
        self.assertTrue(mentions(problems(lambda r: r.update(trend_relation="WITH_TREND"), DAY, **no_match), "trend_relation"))

    def test_no_match_and_branch_ids_agree(self) -> None:
        no_match = dict(MCD1="MCD1_UP_IN_CORRIDOR", MCD2="MCD2_DOWN_IN_CORRIDOR", MCD3="MCD3_BULL_MID")
        self.assertTrue(mentions(problems(lambda r: r.update(bias="LONG", archetype="A", trend_relation="WITH_TREND", stand_aside=False), DAY, **no_match), "bias"))
        self.assertTrue(mentions(problems(lambda r: r.update(branch_id="X"), DAY, **no_match), "branch_id"))
        self.assertTrue(mentions(problems(lambda r: r.update(branch_id=None)), "branch_id"))

    def test_every_field_is_checked_for_its_shape(self) -> None:
        cases = {
            "schema_version": "syn-output/2",
            "mcd_id": "SYN2",
            "profile": "SWING",
            "cycle_slot": "2026-09-18T20:56Z",
            "rules_version": "Draft 1",
            "rules_sha256": "abc",
            "rule_id": "r1",
            "status": "OK",
            "data_status": "OPEN",
            "archetype": "E",
            "bias": "MAYBE",
            "trend_relation": "SIDEWAYS",
            "stand_aside": "no",
            "summary_line": "S" * 81,
            "zones": ["Z6"],
            "reasons": [],
        }
        for key, value in cases.items():
            self.assertTrue(mentions(problems(lambda r, k=key, v=value: r.update({k: v})), key), key)
        self.assertTrue(mentions(problems(lambda r: r.update(summary_line="")), "summary_line"))
        self.assertTrue(mentions(problems(lambda r: r.update(zones=["Z1"] * 2)), "zones"))
        self.assertTrue(mentions(problems(lambda r: r.update(zones=[f"Z{i}" for i in range(1, 7)])), "zones"))
        self.assertTrue(mentions(problems(lambda r: r.pop("rules_sha256")), "rules_sha256"))

    def test_every_input_record_is_checked(self) -> None:
        self.assertTrue(mentions(problems(lambda r: r["inputs"].update(MCD0=r["inputs"]["MCD1"])), "MCD0"))
        self.assertTrue(mentions(problems(lambda r: r["inputs"]["MCD1"].pop("bias")), "bias"))
        self.assertTrue(mentions(problems(lambda r: r["inputs"]["MCD1"].update(status="BOGUS")), "status"))
        self.assertTrue(mentions(problems(lambda r: r["inputs"]["MCD1"].update(state_code="lower")), "state_code"))
        self.assertTrue(mentions(problems(lambda r: r["inputs"]["MCD1"].update(envelope_sha256="abc")), "envelope_sha256"))
        self.assertTrue(mentions(problems(lambda r: r["inputs"]["MCD1"].update(extra=1)), "Additional properties"))
        self.assertTrue(mentions(problems(lambda r: r["inputs"]["MCD1"].update(bias="MAYBE")), "bias"))


class ReasonGuardTests(unittest.TestCase):
    def codes(self, status: str, codes: list[str], **readings) -> list[str]:
        return [p for p in found_in(lambda r: r.update(status=status, status_reasons=codes), DAY, **readings) if p.startswith("REASONS")]

    def test_an_unknown_code_is_refused(self) -> None:
        self.assertTrue(mentions(self.codes("CAUTIONARY", ["FOO_BAR"]), "FOO_BAR", "not a reason code"))

    def test_a_modifier_caution_must_name_a_state_of_mcd3(self) -> None:
        self.assertEqual(self.codes("CAUTIONARY", ["MODIFIER_CAUTION:MCD3_NON_CONSOLIDATED_OVERFLOW"]), [])
        self.assertTrue(mentions(self.codes("CAUTIONARY", ["MODIFIER_CAUTION:MCD1_UP_IN_CORRIDOR"]), "not a reason code"))
        self.assertTrue(mentions(self.codes("CAUTIONARY", ["MODIFIER_CAUTION:OVERFLOW"]), "not a reason code"))

    def test_a_cautionary_reading_needs_at_least_one_code(self) -> None:
        self.assertTrue(mentions(self.codes("CAUTIONARY", []), "CAUTIONARY reading needs"))

    def test_a_cautionary_reading_needs_cautionary_codes_only(self) -> None:
        self.assertTrue(mentions(self.codes("CAUTIONARY", ["MCD0_DEFECT_M5", "NO_SETTING"]), "CAUTIONARY reason codes only"))
        self.assertEqual(self.codes("CAUTIONARY", ["MCD0_DEFECT_M5", "RETUNING", "UPSTREAM_CAUTIONARY:MCD1"]), [])

    def test_an_unavailable_reading_needs_a_code_of_its_own_status(self) -> None:
        unavailable = dict(MCD1=("-", rc.INVALID), MCD2="MCD2_UP_IN_CORRIDOR")
        self.assertTrue(mentions(self.codes("INVALID", ["MCD0_DEFECT_M5"], **unavailable), "at least one INVALID"))
        self.assertTrue(mentions(self.codes("STALE", ["UPSTREAM_UNAVAILABLE:MCD1"], **unavailable), "at least one STALE"))
        self.assertEqual(self.codes("INVALID", ["UPSTREAM_UNAVAILABLE:MCD1"], **unavailable), [])
        self.assertEqual(self.codes("STALE", ["UPSTREAM_STALE:MCD1"], **unavailable), [])

    def test_a_valid_reading_has_none(self) -> None:
        valid = dict(MCD1="MCD1_DOWN_IN_CORRIDOR", MCD2="MCD2_DOWN_IN_CORRIDOR")
        self.assertTrue(mentions(self.codes("VALID", ["RETUNING"], **valid), "VALID reading has reasons"))

    def test_status_reasons_must_be_a_list(self) -> None:
        self.assertTrue(mentions(problems(lambda r: r.update(status_reasons="RETUNING")), "status_reasons"))


class IdentityGuardTests(unittest.TestCase):
    def test_the_version_and_checksum_must_be_those_of_the_rules(self) -> None:
        self.assertTrue(mentions(problems(lambda r: r.update(rules_version="draft-2")), "rules_version is 'draft-2'"))
        self.assertTrue(mentions(problems(lambda r: r.update(rules_sha256="0" * 64)), "rules_sha256 is not the checksum"))

    def test_the_rule_and_branch_must_exist_and_apply(self) -> None:
        self.assertTrue(mentions(problems(lambda r: r.update(rule_id="R7_NOWHERE")), "not in the rules"))
        self.assertTrue(mentions(problems(lambda r: r.update(branch_id="NO_SUCH_BRANCH")), "not a branch of rule"))
        self.assertTrue(mentions(problems(lambda r: r.update(rule_id="R1_MACRO_COUNTER_TREND_RALLY"), SCALPER, MCD2="MCD2_UP_IN_CORRIDOR"), "does not apply to SCALPER"))

    def test_no_match_needs_no_row(self) -> None:
        no_match = dict(MCD1="MCD1_UP_IN_CORRIDOR", MCD2="MCD2_DOWN_IN_CORRIDOR", MCD3="MCD3_BULL_MID")
        self.assertEqual(reading_problems(base(DAY, **no_match), rules()), [])


class WordingGuardTests(unittest.TestCase):
    def test_a_banned_word_a_percent_sign_or_a_percent_word_is_refused(self) -> None:
        self.assertTrue(mentions(problems(lambda r: r["reasons"].append("High conviction setup")), "WORDING", "CONVICTION"))
        self.assertTrue(mentions(problems(lambda r: r.update(summary_line="Confidence is high")), "WORDING", "CONFIDENCE"))
        self.assertTrue(mentions(problems(lambda r: r["reasons"].append("Moves 70% of the time")), "contains '%'"))
        self.assertTrue(mentions(problems(lambda r: r["reasons"].append("Up 70 percent of days")), "percentage word"))
        self.assertTrue(mentions(problems(lambda r: r["reasons"].append("A confident move")), "CONFIDENCE"))  # the kit's listed inflections

    def test_a_banned_word_in_an_id_is_refused(self) -> None:
        self.assertTrue(mentions(problems(lambda r: r.update(rule_id="R1_CONFIDENCE_RALLY")), "rule_id contains the banned word"))
        self.assertTrue(mentions(problems(lambda r: r.update(branch_id="SAFE_UP")), "branch_id contains the banned word"))

    def test_derived_words_stay_allowed(self) -> None:
        self.assertEqual(reading_problems(dict(base(), reasons=["A probable continuation"]), rules()), [])  # the kit allows PROBABLE (Davin, 2026-10-01)


class DeterminismTests(unittest.TestCase):
    """The same readings give the same bytes whatever the process's hash seed (R4)."""

    SCRIPT = (
        "import json, sys\n"
        "from mcd_worker.tests import synthesis_support as sy\n"
        "from mcd_worker.synthesis import synthesize_cycle\n"
        "from mcd_worker.tests import support as s\n"
        "out = []\n"
        "for name in ('v1', 'v3', 'v4'):\n"
        "    cyc = json.loads(s.stored_cycle_text(name))\n"
        "    readings = {r['mcd_id']: json.loads(r['envelope_json']) for r in cyc['results']}\n"
        "    for syn in synthesize_cycle(sy.rules(), readings, cycle_slot=cyc['cycle_slot'], data_status='FRESH').values():\n"
        "        out.append(syn.canonical_json)\n"
        "print(json.dumps(out))\n"
    )

    def run_with(self, seed: str) -> str:
        env = {"PYTHONHASHSEED": seed, "PYTHONDONTWRITEBYTECODE": "1", "PATH": __import__("os").environ.get("PATH", ""), "SYSTEMROOT": __import__("os").environ.get("SYSTEMROOT", "")}
        done = subprocess.run([sys.executable, "-B", "-c", self.SCRIPT], cwd=s.ENGINE, env=env, capture_output=True, encoding="utf-8", timeout=120)
        self.assertEqual(done.returncode, 0, done.stderr)
        return done.stdout

    def test_two_runs_with_different_hash_seeds_agree_byte_for_byte(self) -> None:
        a, b = self.run_with("0"), self.run_with("12345")
        self.assertEqual(a, b)
        self.assertEqual(len(json.loads(a)), 6)


if __name__ == "__main__":
    unittest.main()
