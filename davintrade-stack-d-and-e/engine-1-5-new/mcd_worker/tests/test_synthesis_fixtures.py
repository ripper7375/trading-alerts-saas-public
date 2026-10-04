"""Synthesis on the three real stored cycles (build step 4, part 1): 18 Sep 20:55, 28 Sep 14:15 and 28 Sep 23:15.

The sensors' readings are the ones the runner stored in ``fixtures/*.cycle.json`` (after MCD0 inheritance), so these tests show
what the draft rules say about cycles that really happened, and that a SYN reading joins to the sensor rows it was made from.

On all three cycles MCD0 flags both timeframes, so every channel sensor is CAUTIONARY and every SYN reading is CAUTIONARY too
(3.3 mechanic 4): the architecture's example shows VALID, the real cycles do not. That is the MCD0 flag-rate question of step 3, B3.
"""

from __future__ import annotations

import json
import unittest

from mcd_worker.synthesis import SynReading, synthesize_cycle
from mcd_worker.tests import support as s
from mcd_worker.tests import synthesis_support as sy
from mcd_worker.tests.synthesis_support import DAY, SCALPER

# rule, branch, bias, archetype, trend relation
EXPECTED = {
    ("v1", DAY): ("R1_MACRO_COUNTER_TREND_RALLY", "BREACH_UP", "LONG", "C", "COUNTER_TREND"),
    ("v1", SCALPER): ("R3S_TREND_CONTINUATION_M5", "TREND_UP", "LONG", "A", "WITH_TREND"),
    ("v3", DAY): ("R2_EXHAUSTION_SNAPBACK", "MCD1_SPIKE_DOWN", "LONG", "B", "COUNTER_TREND"),
    ("v3", SCALPER): ("R2_EXHAUSTION_SNAPBACK", "MCD2_SPIKE_DOWN", "LONG", "B", "COUNTER_TREND"),
    ("v4", DAY): ("R3_TREND_CONTINUATION", "TREND_DOWN", "SHORT", "A", "WITH_TREND"),
    ("v4", SCALPER): ("R3S_TREND_CONTINUATION_M5", "TREND_DOWN", "SHORT", "A", "WITH_TREND"),
}

# SHA-256 of each reading's canonical text under draft-1 (regenerated on 2026-10-04 for the removal of the UPSTREAM_CAUTIONARY echoes: only those codes left the readings). They change when a rule, a text, the schema's field order or an envelope
# changes: regenerate them only after reading what changed, and a change of a rule needs a new rules version, not a new hash here.
READING_SHA256 = {
    ("v1", DAY): "afbf6ea5b1920403d4426a8f5dc542ac85aa48437ae825ce1856cd635ffca190",
    ("v1", SCALPER): "32042e4cb4082ca950f2f33f24d83f79f37bfbfefe8fad6da1e261a92b645ac4",
    ("v3", DAY): "e209e0498f90731f4b380b1c057eb99debf469c98c3a70f56509fd650d6763a8",
    ("v3", SCALPER): "96042c375cc4137ca922463f2084aa603cfd593dbf8b8d5c57ddcfe0fa089850",
    ("v4", DAY): "854c8e39a48d05f4ddf8f752559683180c9fff5c52d17547e56d08a93d36225d",
    ("v4", SCALPER): "0820c3a44e22e5758aaa2fa2a1e4653c1eb2deae0ae08777d93f2fe1f0d813ba",
}


def stored(name: str) -> dict:
    return json.loads(s.stored_cycle_text(name))


def readings_of(name: str) -> dict:
    return {r["mcd_id"]: json.loads(r["envelope_json"]) for r in stored(name)["results"]}


def synthesize(name: str, **drop) -> dict[str, SynReading]:
    readings = {k: v for k, v in readings_of(name).items() if k not in drop.get("without", ())}
    return synthesize_cycle(sy.rules(), readings, cycle_slot=stored(name)["cycle_slot"], data_status="FRESH")


class RealCycleTests(unittest.TestCase):
    def test_18_sep_day_trader_rule_1_scalper_rule_3s(self) -> None:
        """Architecture 3.10, last item: the 18 Sep test cycle gives rule 1 for Day Traders and rule 3s for Scalpers under the draft rules."""
        made = synthesize("v1")
        self.assertEqual(stored("v1")["cycle_slot"], "2026-09-18T20:55Z")
        self.assertEqual(made[DAY].reading["rule_id"], "R1_MACRO_COUNTER_TREND_RALLY")
        self.assertEqual(made[SCALPER].reading["rule_id"], "R3S_TREND_CONTINUATION_M5")
        self.assertEqual((made[DAY].reading["bias"], made[DAY].reading["archetype"], made[DAY].reading["trend_relation"]), ("LONG", "C", "COUNTER_TREND"))
        self.assertEqual((made[SCALPER].reading["bias"], made[SCALPER].reading["archetype"], made[SCALPER].reading["trend_relation"]), ("LONG", "A", "WITH_TREND"))

    def test_every_real_cycle_gives_the_expected_rule_for_both_trader_types(self) -> None:
        for name in ("v1", "v3", "v4"):
            made = synthesize(name)
            for profile, syn in made.items():
                r = syn.reading
                self.assertEqual((r["rule_id"], r["branch_id"], r["bias"], r["archetype"], r["trend_relation"]), EXPECTED[(name, profile)], (name, profile))
                self.assertTrue(syn.ok, (name, profile, syn.problems))
                self.assertEqual((r["zones"], r["stand_aside"], r["data_status"], r["rules_version"]), ([], False, "FRESH", "draft-1"))

    def test_the_real_cycles_cover_four_rows_of_the_table(self) -> None:
        rows = {EXPECTED[key][0] for key in EXPECTED}
        self.assertEqual(rows, {"R1_MACRO_COUNTER_TREND_RALLY", "R2_EXHAUSTION_SNAPBACK", "R3_TREND_CONTINUATION", "R3S_TREND_CONTINUATION_M5"})

    def test_every_real_reading_is_cautionary_because_mcd0_flags_both_timeframes(self) -> None:
        for name in ("v1", "v3", "v4"):
            self.assertEqual(stored(name)["gate"]["defect_timeframes"], ["M5", "M15"])
            for profile, syn in synthesize(name).items():
                r = syn.reading
                self.assertEqual(r["status"], "CAUTIONARY", (name, profile))
                self.assertTrue({"MCD0_DEFECT_M5", "MCD0_DEFECT_M15"} & set(r["status_reasons"]), (name, profile))

    def test_the_18_sep_reasons(self) -> None:
        made = synthesize("v1")
        self.assertEqual(made[DAY].reading["status_reasons"], ["MCD0_DEFECT_M15", "MCD0_DEFECT_M5"])  # MCD3's UPSTREAM_CAUTIONARY echoes are left out
        self.assertEqual(
            made[DAY].reading["reasons"],
            ["M15 breach up against a falling channel", "M5 uptrend", "M15 and M5 slopes differ, expected while the M15 slope lags"],
        )
        self.assertEqual(
            made[SCALPER].reading["status_reasons"],
            ["MCD0_DEFECT_M5", "MCD0_DEFECT_M15", "MODIFIER_CAUTION:MCD3_NON_CONSOLIDATED_TREND_CONFLICT"],
        )
        self.assertEqual(made[SCALPER].reading["reasons"], ["M5 uptrend continuing", "M15 and M5 slopes differ"])

    def test_a_reading_joins_to_the_sensor_rows_it_was_made_from(self) -> None:
        for name in ("v1", "v3", "v4"):
            by_id = {r["mcd_id"]: r for r in stored(name)["results"]}
            for syn in synthesize(name).values():
                for sensor, record in syn.reading["inputs"].items():
                    self.assertEqual(record["envelope_sha256"], by_id[sensor]["envelope_sha256"], (name, sensor))
                    self.assertEqual((record["status"], record["state_code"], record["bias"]), (by_id[sensor]["status"], by_id[sensor]["state_code"], by_id[sensor]["bias"]))

    def test_the_readings_are_byte_stable(self) -> None:
        for name in ("v1", "v3", "v4"):
            for profile, syn in synthesize(name).items():
                self.assertEqual(syn.sha256, READING_SHA256[(name, profile)], (name, profile))
                self.assertEqual(syn.canonical_json, synthesize(name)[profile].canonical_json)

    def test_without_mcd3_the_modifier_and_its_caution_are_gone(self) -> None:
        # the SYN flag will let shadow sensors in or keep them out (decision D10): MCD3 absent is a legitimate input
        made = synthesize("v1", without=("MCD3",))
        self.assertEqual(made[DAY].reading["rule_id"], "R1_MACRO_COUNTER_TREND_RALLY")
        self.assertEqual(made[DAY].reading["reasons"], ["M15 breach up against a falling channel", "M5 uptrend"])
        self.assertEqual(made[DAY].reading["status_reasons"], ["MCD0_DEFECT_M15", "MCD0_DEFECT_M5"])
        self.assertEqual(made[SCALPER].reading["status_reasons"], ["MCD0_DEFECT_M5"])
        self.assertEqual(made[SCALPER].reading["inputs"]["MCD3"]["status"], "ABSENT")

    def test_without_the_primary_sensor_the_reading_is_a_data_stand_aside(self) -> None:
        made = synthesize("v1", without=("MCD1",))
        self.assertEqual((made[DAY].reading["rule_id"], made[DAY].reading["status"], made[DAY].reading["bias"]), ("R0_DATA_CHECK", "INVALID", "STAND_ASIDE"))
        self.assertEqual(made[SCALPER].reading["rule_id"], "R3S_TREND_CONTINUATION_M5")  # the Scalper's primary sensor is MCD2
        made = synthesize("v1", without=("MCD2",))
        self.assertEqual(made[SCALPER].reading["rule_id"], "R0_DATA_CHECK")
        self.assertEqual(made[SCALPER].reading["status_reasons"], ["UPSTREAM_UNAVAILABLE:MCD2"])


if __name__ == "__main__":
    unittest.main()
