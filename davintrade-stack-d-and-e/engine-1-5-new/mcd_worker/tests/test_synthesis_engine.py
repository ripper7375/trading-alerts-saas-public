"""The synthesis engine against architecture 3.3 and 3.4 and Davin's decisions D1 and D3 (build step 4, part 1).

Four kinds of test: one block per row of the table (for the trader types it applies to), the mechanics (first match, precedence,
the primary sensor first, an unavailable sensor cannot match), MCD3 as modifier and caution inheritance, and a differential test: an
independent reading of the table, written here from the text of architecture 3.4 and not from ``draft-1.yaml``, is compared with the
engine over every combination of the sensors' states (9 x 9 x 10, both trader types).
"""

from __future__ import annotations

import itertools
import unittest

import yaml

from mcd_common import reason_codes as rc

from mcd_worker.synthesis import SynReading, decide, parse_rules, synthesize_cycle
from mcd_worker.synthesis.engine import MODIFIER_CAUTION, view_of
from mcd_worker.tests import synthesis_support as sy
from mcd_worker.tests.synthesis_support import DAY, SCALPER, cycle, rules, states

M1_UP_UPPER = "MCD1_UP_UPPER_BREAKOUT"
M1_UP_LOWER = "MCD1_UP_LOWER_BREAKDOWN"
M1_DOWN_UPPER = "MCD1_DOWN_UPPER_BREAKOUT"
M1_DOWN_LOWER = "MCD1_DOWN_LOWER_BREAKDOWN"
M1_UP_IN, M1_DOWN_IN, M1_SIDE_IN = "MCD1_UP_IN_CORRIDOR", "MCD1_DOWN_IN_CORRIDOR", "MCD1_SIDEWAYS_IN_CORRIDOR"
M2_UP_IN, M2_DOWN_IN, M2_SIDE_IN = "MCD2_UP_IN_CORRIDOR", "MCD2_DOWN_IN_CORRIDOR", "MCD2_SIDEWAYS_IN_CORRIDOR"
M2_UP_UPPER, M2_UP_LOWER = "MCD2_UP_UPPER_BREAKOUT", "MCD2_UP_LOWER_BREAKDOWN"
M2_DOWN_UPPER, M2_DOWN_LOWER = "MCD2_DOWN_UPPER_BREAKOUT", "MCD2_DOWN_LOWER_BREAKDOWN"
M2_SIDE_UPPER, M2_SIDE_LOWER = "MCD2_SIDEWAYS_UPPER_BREAKOUT", "MCD2_SIDEWAYS_LOWER_BREAKDOWN"
M3_CONFLICT = "MCD3_NON_CONSOLIDATED_TREND_CONFLICT"
M3_OVERFLOW = "MCD3_NON_CONSOLIDATED_OVERFLOW"
M3_ESCAPE = "MCD3_NON_CONSOLIDATED_ESCAPE"
M3_BULL_MID, M3_BEAR_MID = "MCD3_BULL_MID", "MCD3_BEAR_MID"


def day(**readings):
    return decide(rules(), DAY, cycle(**readings))


def scalper(**readings):
    return decide(rules(), SCALPER, cycle(**readings))


def verdict(decision):
    return (decision.rule_id, decision.branch_id, decision.bias, decision.archetype, decision.trend_relation)


class DataCheckTests(unittest.TestCase):
    """Row 0: the primary sensor must be VALID or CAUTIONARY, else STAND_ASIDE with a data reason (3.3 mechanic 1, D1 (a))."""

    def test_an_invalid_primary_sensor_stands_aside_with_an_invalid_reading(self) -> None:
        d = day(MCD1=("-", rc.INVALID), MCD2=M2_UP_IN)
        self.assertEqual(verdict(d), ("R0_DATA_CHECK", "PRIMARY_UNAVAILABLE", "STAND_ASIDE", None, None))
        self.assertEqual((d.status, d.status_reasons), (rc.INVALID, ("UPSTREAM_UNAVAILABLE:MCD1",)))
        self.assertTrue(d.stand_aside)

    def test_a_stale_primary_sensor_is_a_stale_reading(self) -> None:
        d = day(MCD1=("-", rc.STALE), MCD2=M2_UP_IN)
        self.assertEqual((d.rule_id, d.bias, d.status, d.status_reasons), ("R0_DATA_CHECK", "STAND_ASIDE", rc.STALE, ("UPSTREAM_STALE:MCD1",)))

    def test_an_absent_primary_sensor_is_unavailable(self) -> None:
        d = day(MCD2=M2_UP_IN)
        self.assertEqual((d.rule_id, d.status, d.status_reasons), ("R0_DATA_CHECK", rc.INVALID, ("UPSTREAM_UNAVAILABLE:MCD1",)))
        self.assertEqual(d.inputs["MCD1"]["status"], "ABSENT")

    def test_the_scalpers_primary_sensor_is_mcd2(self) -> None:
        d = scalper(MCD1=M1_UP_IN, MCD2=("-", rc.INVALID))
        self.assertEqual((d.rule_id, d.status_reasons), ("R0_DATA_CHECK", ("UPSTREAM_UNAVAILABLE:MCD2",)))
        d = scalper(MCD1=M1_UP_IN, MCD2=("-", rc.STALE))
        self.assertEqual((d.rule_id, d.status, d.status_reasons), ("R0_DATA_CHECK", rc.STALE, ("UPSTREAM_STALE:MCD2",)))

    def test_the_other_channel_sensor_unavailable_is_not_a_data_stand_aside(self) -> None:
        self.assertEqual(day(MCD1=M1_UP_IN, MCD2=("-", rc.INVALID)).rule_id, "NO_MATCH")
        d = scalper(MCD1=("-", rc.INVALID), MCD2=M2_UP_IN)
        self.assertEqual(verdict(d), ("R3S_TREND_CONTINUATION_M5", "TREND_UP", "LONG", "A", "WITH_TREND"))

    def test_a_cautionary_primary_sensor_is_usable(self) -> None:
        d = day(MCD1=(M1_DOWN_IN, rc.CAUTIONARY), MCD2=M2_DOWN_IN)
        self.assertEqual(d.rule_id, "R3_TREND_CONTINUATION")

    def test_mcd3_unavailable_never_triggers_the_data_check(self) -> None:
        self.assertEqual(day(MCD1=M1_DOWN_IN, MCD2=M2_DOWN_IN).rule_id, "R3_TREND_CONTINUATION")


class CounterTrendRallyTests(unittest.TestCase):
    """Row 1 (Day Trader): MCD1 COUNTER_TREND_EXPANSION and MCD2 trending in the breach direction."""

    def test_a_breach_up_with_the_m5_trending_up_is_long(self) -> None:
        for m2 in (M2_UP_IN, M2_UP_UPPER, M2_UP_LOWER):  # any position: "trending in that direction"
            d = day(MCD1=M1_DOWN_UPPER, MCD2=m2)
            self.assertEqual(verdict(d), ("R1_MACRO_COUNTER_TREND_RALLY", "BREACH_UP", "LONG", "C", "COUNTER_TREND"), m2)

    def test_a_breach_down_with_the_m5_trending_down_is_short(self) -> None:
        for m2 in (M2_DOWN_IN, M2_DOWN_UPPER, M2_DOWN_LOWER):
            d = day(MCD1=M1_UP_LOWER, MCD2=m2)
            self.assertEqual(verdict(d), ("R1_MACRO_COUNTER_TREND_RALLY", "BREACH_DOWN", "SHORT", "C", "COUNTER_TREND"), m2)

    def test_the_texts_are_the_architecture_example(self) -> None:
        d = day(MCD1=M1_DOWN_UPPER, MCD2=M2_UP_IN)
        self.assertEqual(d.reasons[:2], ("M15 breach up against a falling channel", "M5 uptrend"))
        self.assertEqual(d.summary, "Counter-trend rally, LONG")

    def test_the_m5_against_the_breach_is_not_this_row(self) -> None:
        for m2 in (M2_DOWN_IN, M2_SIDE_IN, M2_SIDE_UPPER):
            self.assertNotEqual(day(MCD1=M1_DOWN_UPPER, MCD2=m2).rule_id, "R1_MACRO_COUNTER_TREND_RALLY", m2)

    def test_the_row_is_for_day_traders_only(self) -> None:
        d = scalper(MCD1=M1_DOWN_UPPER, MCD2=M2_UP_IN)
        self.assertEqual(d.rule_id, "R3S_TREND_CONTINUATION_M5")

    def test_a_missing_mcd2_cannot_match(self) -> None:
        self.assertNotEqual(day(MCD1=M1_DOWN_UPPER).rule_id, "R1_MACRO_COUNTER_TREND_RALLY")
        self.assertNotEqual(day(MCD1=M1_DOWN_UPPER, MCD2=("-", rc.STALE)).rule_id, "R1_MACRO_COUNTER_TREND_RALLY")


class ExhaustionSnapbackTests(unittest.TestCase):
    """Row 2 (both): MCD1 BREAKOUT_SAME_SLOPE, or MCD2 UPPER / LOWER_OVEREXTENSION_REVERSION: against the spike."""

    def test_the_four_branches(self) -> None:
        self.assertEqual(verdict(day(MCD1=M1_UP_UPPER, MCD2=M2_UP_IN)), ("R2_EXHAUSTION_SNAPBACK", "MCD1_SPIKE_UP", "SHORT", "B", "COUNTER_TREND"))
        self.assertEqual(verdict(day(MCD1=M1_DOWN_LOWER, MCD2=M2_DOWN_IN)), ("R2_EXHAUSTION_SNAPBACK", "MCD1_SPIKE_DOWN", "LONG", "B", "COUNTER_TREND"))
        self.assertEqual(verdict(scalper(MCD2=M2_UP_UPPER)), ("R2_EXHAUSTION_SNAPBACK", "MCD2_SPIKE_UP", "SHORT", "B", "COUNTER_TREND"))
        self.assertEqual(verdict(scalper(MCD2=M2_DOWN_LOWER)), ("R2_EXHAUSTION_SNAPBACK", "MCD2_SPIKE_DOWN", "LONG", "B", "COUNTER_TREND"))

    def test_the_sensors_own_bias_is_not_the_result(self) -> None:
        # MCD1_UP_UPPER_BREAKOUT and MCD2_UP_UPPER_BREAKOUT say LONG; the row says against the spike (ADR-025, the MCD specs section 9)
        self.assertEqual(cycle(MCD1=M1_UP_UPPER)["MCD1"]["bias"], "LONG")
        self.assertEqual(cycle(MCD2=M2_UP_UPPER)["MCD2"]["bias"], "LONG")
        self.assertEqual(day(MCD1=M1_UP_UPPER, MCD2=M2_UP_IN).bias, "SHORT")
        self.assertEqual(scalper(MCD2=M2_UP_UPPER).bias, "SHORT")

    def test_the_row_applies_to_both_trader_types_through_either_sensor(self) -> None:
        self.assertEqual(day(MCD1=M1_UP_UPPER, MCD2=M2_UP_IN).branch_id, "MCD1_SPIKE_UP")
        self.assertEqual(day(MCD1=M1_UP_IN, MCD2=M2_DOWN_LOWER).branch_id, "MCD2_SPIKE_DOWN")
        self.assertEqual(scalper(MCD1=M1_DOWN_LOWER, MCD2=M2_DOWN_IN).branch_id, "MCD1_SPIKE_DOWN")  # D1 (c): "Both" as written

    def test_when_the_sensors_disagree_the_primary_sensor_decides(self) -> None:
        both = dict(MCD1=M1_UP_UPPER, MCD2=M2_DOWN_LOWER)  # MCD1 spike up (SHORT) against MCD2 spike down (LONG)
        self.assertEqual((day(**both).branch_id, day(**both).bias), ("MCD1_SPIKE_UP", "SHORT"))
        self.assertEqual((scalper(**both).branch_id, scalper(**both).bias), ("MCD2_SPIKE_DOWN", "LONG"))

    def test_when_the_sensors_agree_the_result_is_the_same_for_both(self) -> None:
        both = dict(MCD1=M1_UP_UPPER, MCD2=M2_UP_UPPER)
        self.assertEqual(day(**both).bias, scalper(**both).bias)

    def test_an_unavailable_primary_sensor_is_the_data_check_not_this_row(self) -> None:
        self.assertEqual(day(MCD1=("-", rc.INVALID), MCD2=M2_UP_UPPER).rule_id, "R0_DATA_CHECK")

    def test_row_1_comes_before_row_2_for_day_traders(self) -> None:
        # M15 sustained counter-trend breach up, M5 up and overextended: row 1 says LONG, row 2 would say SHORT
        inputs = dict(MCD1=M1_DOWN_UPPER, MCD2=M2_UP_UPPER)
        self.assertEqual(verdict(day(**inputs))[:3], ("R1_MACRO_COUNTER_TREND_RALLY", "BREACH_UP", "LONG"))
        self.assertEqual(verdict(scalper(**inputs))[:3], ("R2_EXHAUSTION_SNAPBACK", "MCD2_SPIKE_UP", "SHORT"))


class TrendContinuationTests(unittest.TestCase):
    """Rows 3 (Day Trader) and 3s (Scalper): the trend continues."""

    def test_day_trader_trend_up_and_down(self) -> None:
        for m2 in (M2_UP_IN, M2_UP_LOWER):
            self.assertEqual(verdict(day(MCD1=M1_UP_IN, MCD2=m2)), ("R3_TREND_CONTINUATION", "TREND_UP", "LONG", "A", "WITH_TREND"), m2)
        for m2 in (M2_DOWN_IN, M2_DOWN_UPPER):
            self.assertEqual(verdict(day(MCD1=M1_DOWN_IN, MCD2=m2)), ("R3_TREND_CONTINUATION", "TREND_DOWN", "SHORT", "A", "WITH_TREND"), m2)

    def test_the_m5_must_trend_the_same_way(self) -> None:
        self.assertEqual(day(MCD1=M1_UP_IN, MCD2=M2_DOWN_IN).rule_id, "NO_MATCH")
        self.assertEqual(day(MCD1=M1_DOWN_IN, MCD2=M2_UP_IN).rule_id, "NO_MATCH")
        self.assertEqual(day(MCD1=M1_UP_IN, MCD2=M2_SIDE_IN).rule_id, "R4_RANGE")  # a sideways M5 is row 4's middle, not row 3

    def test_an_overextended_m5_goes_to_row_2_not_row_3(self) -> None:
        self.assertEqual(day(MCD1=M1_UP_IN, MCD2=M2_UP_UPPER).rule_id, "R2_EXHAUSTION_SNAPBACK")

    def test_the_m5_dip_against_a_down_trend_is_not_a_continuation(self) -> None:
        self.assertEqual(day(MCD1=M1_DOWN_IN, MCD2=M2_DOWN_LOWER).rule_id, "R2_EXHAUSTION_SNAPBACK")
        self.assertEqual(day(MCD1=M1_UP_IN, MCD2=M2_UP_UPPER).rule_id, "R2_EXHAUSTION_SNAPBACK")

    def test_a_missing_mcd2_or_an_mcd1_regime_other_than_continuation_is_not_row_3(self) -> None:
        self.assertEqual(day(MCD1=M1_UP_IN).rule_id, "NO_MATCH")
        self.assertEqual(day(MCD1=M1_UP_LOWER, MCD2=M2_UP_IN).rule_id, "NO_MATCH")  # COUNTER_TREND_EXPANSION with the M5 against the breach

    def test_scalper_reads_only_mcd2(self) -> None:
        self.assertEqual(verdict(scalper(MCD2=M2_UP_IN)), ("R3S_TREND_CONTINUATION_M5", "TREND_UP", "LONG", "A", "WITH_TREND"))
        self.assertEqual(verdict(scalper(MCD2=M2_UP_LOWER)), ("R3S_TREND_CONTINUATION_M5", "TREND_UP", "LONG", "A", "WITH_TREND"))
        self.assertEqual(verdict(scalper(MCD2=M2_DOWN_IN)), ("R3S_TREND_CONTINUATION_M5", "TREND_DOWN", "SHORT", "A", "WITH_TREND"))
        self.assertEqual(verdict(scalper(MCD2=M2_DOWN_UPPER)), ("R3S_TREND_CONTINUATION_M5", "TREND_DOWN", "SHORT", "A", "WITH_TREND"))

    def test_scalper_ignores_mcd1(self) -> None:
        for m1 in (None, ("-", rc.STALE), M1_DOWN_IN, M1_UP_IN):
            self.assertEqual(scalper(MCD1=m1, MCD2=M2_UP_IN).rule_id, "R3S_TREND_CONTINUATION_M5", m1)

    def test_row_3s_is_not_for_day_traders(self) -> None:
        self.assertEqual(day(MCD1=M1_SIDE_IN, MCD2=M2_UP_IN).rule_id, "R4_RANGE")  # not R3S: the row names the Scalper only


class RangeTests(unittest.TestCase):
    """Row 4 (both): D, range. Edges only; the middle is STAND_ASIDE (D1 (d))."""

    def test_the_scalper_trades_the_m5_edges_and_stands_aside_in_the_middle(self) -> None:
        self.assertEqual(verdict(scalper(MCD2=M2_SIDE_UPPER)), ("R4_RANGE", "MCD2_EDGE_UP", "SHORT", "D", "COUNTER_TREND"))
        self.assertEqual(verdict(scalper(MCD2=M2_SIDE_LOWER)), ("R4_RANGE", "MCD2_EDGE_DOWN", "LONG", "D", "COUNTER_TREND"))
        self.assertEqual(verdict(scalper(MCD2=M2_SIDE_IN)), ("R4_RANGE", "MCD2_MIDDLE", "STAND_ASIDE", "D", None))

    def test_a_ranging_m15_stands_aside_for_the_day_trader(self) -> None:
        for m1 in ("MCD1_SIDEWAYS_IN_CORRIDOR", "MCD1_SIDEWAYS_UPPER_BREAKOUT", "MCD1_SIDEWAYS_LOWER_BREAKDOWN"):  # CONSOLIDATION, RANGE_EXPANSION x2
            d = day(MCD1=m1, MCD2=M2_UP_IN)
            self.assertEqual(verdict(d), ("R4_RANGE", "MCD1_RANGE", "STAND_ASIDE", "D", None), m1)

    def test_the_day_trader_trades_an_m5_edge_when_the_m15_is_not_ranging(self) -> None:
        self.assertEqual(verdict(day(MCD1=M1_UP_IN, MCD2=M2_SIDE_UPPER)), ("R4_RANGE", "MCD2_EDGE_UP", "SHORT", "D", "COUNTER_TREND"))
        self.assertEqual(verdict(day(MCD1=M1_UP_IN, MCD2=M2_SIDE_LOWER)), ("R4_RANGE", "MCD2_EDGE_DOWN", "LONG", "D", "COUNTER_TREND"))

    def test_the_primary_sensor_decides_when_the_two_ranges_disagree(self) -> None:
        both = dict(MCD1=M1_SIDE_IN, MCD2=M2_SIDE_LOWER)
        self.assertEqual((day(**both).branch_id, day(**both).bias), ("MCD1_RANGE", "STAND_ASIDE"))
        self.assertEqual((scalper(**both).branch_id, scalper(**both).bias), ("MCD2_EDGE_DOWN", "LONG"))

    def test_the_scalper_in_an_m15_range_with_a_trending_m5_follows_the_m5(self) -> None:
        self.assertEqual(scalper(MCD1=M1_SIDE_IN, MCD2=M2_UP_IN).rule_id, "R3S_TREND_CONTINUATION_M5")

    def test_a_sideways_m15_with_an_unavailable_m2_still_stands_aside(self) -> None:
        self.assertEqual(day(MCD1=M1_SIDE_IN).rule_id, "R4_RANGE")


class UnresolvedConflictTests(unittest.TestCase):
    """Row 5 (both): MCD3 NON_CONSOLIDATED_* and nothing above matched."""

    def test_each_non_consolidated_state_stands_aside_for_the_day_trader(self) -> None:
        for m3 in (M3_CONFLICT, M3_OVERFLOW, M3_ESCAPE):
            d = day(MCD1=M1_UP_IN, MCD2=M2_DOWN_IN, MCD3=m3)
            self.assertEqual(verdict(d), ("R5_UNRESOLVED_CONFLICT", "MCD3_NOT_CONSOLIDATED", "STAND_ASIDE", None, None), m3)
            self.assertEqual(d.sensors_read, ("MCD3",))

    def test_it_can_never_fire_for_a_scalper_in_draft_1(self) -> None:
        # rows 2, 3s and 4 between them cover every state of MCD2, and row 0 covers an MCD2 that is not usable: nothing is left for row 5
        for m2 in states("MCD2"):
            for m3 in (M3_CONFLICT, M3_OVERFLOW, M3_ESCAPE):
                self.assertNotEqual(scalper(MCD2=m2, MCD3=m3).rule_id, "R5_UNRESOLVED_CONFLICT", (m2, m3))

    def test_it_is_not_reached_when_an_earlier_row_matched(self) -> None:
        self.assertEqual(day(MCD1=M1_DOWN_UPPER, MCD2=M2_UP_IN, MCD3=M3_CONFLICT).rule_id, "R1_MACRO_COUNTER_TREND_RALLY")
        self.assertEqual(scalper(MCD2=M2_UP_IN, MCD3=M3_CONFLICT).rule_id, "R3S_TREND_CONTINUATION_M5")

    def test_a_consolidated_mcd3_is_not_a_conflict(self) -> None:
        self.assertEqual(day(MCD1=M1_UP_IN, MCD2=M2_DOWN_IN, MCD3=M3_BULL_MID).rule_id, "NO_MATCH")

    def test_the_conflict_row_reads_mcd3_so_an_unavailable_mcd3_cannot_match(self) -> None:
        self.assertEqual(day(MCD1=M1_UP_IN, MCD2=M2_DOWN_IN, MCD3=("-", rc.INVALID)).rule_id, "NO_MATCH")


class NoMatchTests(unittest.TestCase):
    """No row matched: NEUTRAL, recorded with every sensor's state (3.3 mechanic 5)."""

    def setUp(self) -> None:
        self.d = day(MCD1=M1_UP_IN, MCD2=M2_DOWN_IN, MCD3=M3_BULL_MID)

    def test_it_is_neutral_and_named(self) -> None:
        self.assertEqual(verdict(self.d), ("NO_MATCH", None, "NEUTRAL", None, None))
        self.assertFalse(self.d.stand_aside)
        self.assertEqual(self.d.summary, "No rule matched, NEUTRAL")

    def test_the_sensor_states_are_recorded(self) -> None:
        self.assertEqual({k: v["state_code"] for k, v in self.d.inputs.items()}, {"MCD1": M1_UP_IN, "MCD2": M2_DOWN_IN, "MCD3": M3_BULL_MID})
        self.assertEqual(self.d.inputs["MCD1"]["regime_status"], "TREND_ALIGNED_CONTINUATION")

    def test_an_unavailable_sensor_shows_in_the_record(self) -> None:
        d = day(MCD1=M1_UP_IN, MCD2=M2_DOWN_IN, MCD3=("-", rc.STALE))
        self.assertEqual((d.rule_id, d.inputs["MCD3"]["status"], d.inputs["MCD3"]["state_code"]), ("NO_MATCH", rc.STALE, None))
        self.assertEqual(d.sensors_read, ("MCD1", "MCD2"))  # only the sensors that were available count as read

    def test_the_scalper_never_reaches_it_with_a_usable_mcd2(self) -> None:
        for m2 in states("MCD2"):
            self.assertNotEqual(scalper(MCD2=m2).rule_id, "NO_MATCH", m2)

    def test_it_takes_caution_from_every_available_sensor(self) -> None:
        d = day(MCD1=(M1_UP_IN, rc.CAUTIONARY), MCD2=M2_DOWN_IN)
        self.assertEqual((d.rule_id, d.status, d.status_reasons), ("NO_MATCH", rc.CAUTIONARY, ("MCD0_DEFECT_M15",)))
        self.assertEqual(self.d.status, rc.VALID)


class MechanicsTests(unittest.TestCase):
    def test_the_first_row_that_holds_decides_and_the_order_is_part_of_the_version(self) -> None:
        # rows 4 (a ranging M15) and 5 (MCD3 not consolidated) overlap for this Day Trader reading
        inputs = cycle(MCD1=M1_SIDE_IN, MCD2=M2_UP_IN, MCD3=M3_CONFLICT)
        self.assertEqual(decide(rules(), DAY, inputs).rule_id, "R4_RANGE")
        document = yaml.safe_load(sy.rules_text())
        by_id = {row["id"]: row for row in document["rules"]}
        rows = [row for row in document["rules"] if row["id"] not in ("R4_RANGE", "R5_UNRESOLVED_CONFLICT")]
        swapped = dict(document, rules=[*rows, by_id["R5_UNRESOLVED_CONFLICT"], by_id["R4_RANGE"]])
        other = parse_rules(yaml.safe_dump(swapped, sort_keys=False), vocabulary=sy.vocabulary())
        self.assertEqual(decide(other, DAY, inputs).rule_id, "R5_UNRESOLVED_CONFLICT")
        self.assertNotEqual(other.sha256, rules().sha256)  # the order is part of the version: it changes the checksum

    def test_the_result_does_not_depend_on_the_order_of_the_readings(self) -> None:
        a = cycle(MCD1=M1_DOWN_UPPER, MCD2=M2_UP_IN, MCD3=M3_CONFLICT)
        b = dict(reversed(list(a.items())))
        self.assertEqual(decide(rules(), DAY, a), decide(rules(), DAY, b))

    def test_other_mcds_and_junk_keys_are_ignored(self) -> None:
        readings = cycle(MCD1=M1_DOWN_UPPER, MCD2=M2_UP_IN)
        extra = dict(readings, MCD0={"status": "VALID"}, MCD9=readings["MCD1"], SYN=readings["MCD2"])
        self.assertEqual(decide(rules(), DAY, readings), decide(rules(), DAY, extra))

    def test_the_inputs_are_not_changed(self) -> None:
        readings = cycle(MCD1=M1_DOWN_UPPER, MCD2=M2_UP_IN, MCD3=M3_CONFLICT)
        before = sy.unchanged(readings)
        decide(rules(), DAY, readings)
        decide(rules(), SCALPER, readings)
        self.assertEqual(readings, before)

    def test_the_same_readings_give_the_same_decision(self) -> None:
        readings = cycle(MCD1=M1_UP_UPPER, MCD2=M2_DOWN_LOWER, MCD3=M3_ESCAPE)
        self.assertEqual(decide(rules(), DAY, readings), decide(rules(), DAY, readings))

    def test_every_input_record_carries_the_envelope_hash_of_the_reading(self) -> None:
        from mcd_common import envelope as env
        import hashlib

        readings = cycle(MCD1=M1_DOWN_UPPER, MCD2=M2_UP_IN, MCD3=M3_CONFLICT)
        d = decide(rules(), DAY, readings)
        for sensor, reading in readings.items():
            self.assertEqual(d.inputs[sensor]["envelope_sha256"], hashlib.sha256(env.canonical_json(reading).encode()).hexdigest())

    def test_unusable_readings_are_handled_not_raised(self) -> None:
        self.assertEqual(view_of("MCD1", None).status, "ABSENT")
        self.assertEqual(view_of("MCD1", "text").status, "ABSENT")
        self.assertEqual(view_of("MCD1", {"status": "BOGUS"}).status, rc.INVALID)
        broken = dict(sy.envelope("MCD1", M1_UP_IN), state_code=None)
        self.assertEqual(view_of("MCD1", broken).status, rc.INVALID)
        bad_bias = dict(sy.envelope("MCD1", M1_UP_IN), bias="MAYBE")
        self.assertEqual(view_of("MCD1", bad_bias).status, rc.INVALID)
        unhashable = dict(sy.envelope("MCD1", M1_UP_IN), details={"x": float("nan")})
        self.assertEqual(view_of("MCD1", unhashable).status, rc.INVALID)
        d = decide(rules(), DAY, {"MCD1": "junk", "MCD2": 5, "MCD3": []})
        self.assertEqual(d.rule_id, "R0_DATA_CHECK")

    def test_a_sensors_reasons_are_read_whatever_their_container(self) -> None:
        reading = dict(sy.envelope("MCD1", M1_UP_IN, rc.CAUTIONARY), status_reasons=("MCD0_DEFECT_M15",))
        self.assertEqual(view_of("MCD1", reading).status_reasons, ("MCD0_DEFECT_M15",))
        reading = dict(sy.envelope("MCD1", M1_UP_IN, rc.CAUTIONARY), status_reasons="MCD0_DEFECT_M15")
        self.assertEqual(view_of("MCD1", reading).status_reasons, ())


class ModifierTests(unittest.TestCase):
    """MCD3 modifies and never votes (ADR-029, D1 (e))."""

    def scalper_long(self, m3):
        return scalper(MCD2=M2_UP_IN, MCD3=m3)

    def scalper_short(self, m3):
        return scalper(MCD2=M2_DOWN_IN, MCD3=m3)

    def test_consolidated_in_the_direction_of_the_result_confirms_and_changes_nothing_else(self) -> None:
        for m3 in ("MCD3_BULL_VALUE", "MCD3_BULL_MID", "MCD3_BULL_TOP"):
            d = self.scalper_long(m3)
            self.assertEqual(d.reasons[-1], "M15 and M5 are consolidated in an uptrend", m3)
            self.assertEqual((d.status, d.status_reasons, d.modifier_id), (rc.VALID, (), "M3_CONFIRMS_UP"), m3)
        for m3 in ("MCD3_BEAR_PREMIUM", "MCD3_BEAR_MID", "MCD3_BEAR_BOTTOM"):
            d = self.scalper_short(m3)
            self.assertEqual((d.reasons[-1], d.modifier_id, d.status), ("M15 and M5 are consolidated in a downtrend", "M3_CONFIRMS_DOWN", rc.VALID), m3)

    def test_consolidated_against_the_result_is_a_note_only(self) -> None:
        d = self.scalper_long("MCD3_BEAR_MID")
        self.assertEqual((d.modifier_id, d.status, d.reasons[-1]), ("M3_AGAINST_DOWN", rc.VALID, "M15 and M5 are consolidated in a downtrend, against this direction"))
        d = self.scalper_short("MCD3_BULL_MID")
        self.assertEqual((d.modifier_id, d.status), ("M3_AGAINST_UP", rc.VALID))
        self.assertEqual((d.bias, d.rule_id), ("SHORT", "R3S_TREND_CONTINUATION_M5"))  # a note never flips the direction

    def test_a_flat_consolidation_has_no_effect(self) -> None:
        d = self.scalper_long("MCD3_SIDEWAYS_EQUILIBRIUM")
        self.assertEqual((d.modifier_id, d.status, len(d.reasons), d.sensors_read), (None, rc.VALID, 1, ("MCD2",)))

    def test_not_consolidated_makes_the_result_cautionary_with_its_own_code(self) -> None:
        expected = {
            M3_CONFLICT: ("M3_TREND_CONFLICT", "M15 and M5 slopes differ"),
            M3_OVERFLOW: ("M3_OVERFLOW", "M5 corridor sits inside the M15 corridor on too few bars"),
            M3_ESCAPE: ("M3_ESCAPE", "Latest M5 corridor extends beyond the M15 corridor"),
        }
        for state, (modifier, text) in expected.items():
            d = self.scalper_long(state)
            self.assertEqual((d.modifier_id, d.reasons[-1], d.status, d.bias), (modifier, text, rc.CAUTIONARY, "LONG"), state)
            self.assertEqual(d.status_reasons, (f"{MODIFIER_CAUTION}:{state}",), state)

    def test_a_trend_conflict_under_row_1_is_expected_and_only_a_note(self) -> None:
        d = day(MCD1=M1_DOWN_UPPER, MCD2=M2_UP_IN, MCD3=M3_CONFLICT)
        self.assertEqual((d.rule_id, d.modifier_id, d.status, d.status_reasons), ("R1_MACRO_COUNTER_TREND_RALLY", "M3_CONFLICT_EXPECTED_UNDER_R1", rc.VALID, ()))
        self.assertEqual(d.reasons[-1], "M15 and M5 slopes differ, expected while the M15 slope lags")

    def test_only_the_trend_conflict_is_expected_under_row_1(self) -> None:
        for state in (M3_OVERFLOW, M3_ESCAPE):
            d = day(MCD1=M1_DOWN_UPPER, MCD2=M2_UP_IN, MCD3=state)
            self.assertEqual((d.rule_id, d.status), ("R1_MACRO_COUNTER_TREND_RALLY", rc.CAUTIONARY), state)

    def test_the_same_conflict_under_another_row_adds_caution(self) -> None:
        d = day(MCD1=M1_DOWN_IN, MCD2=M2_DOWN_IN, MCD3=M3_CONFLICT)
        self.assertEqual((d.rule_id, d.status, d.status_reasons), ("R3_TREND_CONTINUATION", rc.CAUTIONARY, (f"{MODIFIER_CAUTION}:{M3_CONFLICT}",)))

    def test_mcd3_is_not_consulted_for_a_result_that_is_not_long_or_short(self) -> None:
        for build, kwargs in (
            (day, dict(MCD1=M1_SIDE_IN, MCD2=M2_UP_IN, MCD3=M3_OVERFLOW)),  # row 4, the M15 range: STAND_ASIDE
            (scalper, dict(MCD2=M2_SIDE_IN, MCD3=M3_OVERFLOW)),  # row 4, the M5 range middle: STAND_ASIDE
            (day, dict(MCD1=M1_UP_IN, MCD2=M2_DOWN_IN, MCD3=M3_BULL_MID)),  # no match: NEUTRAL
        ):
            d = build(**kwargs)
            self.assertIn(d.bias, ("STAND_ASIDE", "NEUTRAL"), kwargs)
            self.assertIsNone(d.modifier_id, kwargs)
            self.assertEqual(len(d.reasons), 1, kwargs)

    def test_an_unavailable_mcd3_has_no_effect_and_is_recorded(self) -> None:
        for m3 in (None, ("-", rc.INVALID), ("-", rc.STALE)):
            d = self.scalper_long(m3)
            self.assertEqual((d.rule_id, d.status, d.modifier_id, len(d.reasons)), ("R3S_TREND_CONTINUATION_M5", rc.VALID, None, 1), m3)
        self.assertEqual(self.scalper_long(("-", rc.STALE)).inputs["MCD3"]["status"], rc.STALE)

    def test_mcd3_never_votes(self) -> None:
        # MCD3's own bias is STAND_ASIDE in a conflict; under every row that gave a direction the direction stays
        for state in states("MCD3"):
            d = scalper(MCD2=M2_UP_IN, MCD3=state)
            self.assertEqual((d.rule_id, d.bias), ("R3S_TREND_CONTINUATION_M5", "LONG"), state)

    def test_the_modifier_table_covers_every_mcd3_state_for_both_directions(self) -> None:
        for state in states("MCD3"):
            for bias, build in (("LONG", self.scalper_long), ("SHORT", self.scalper_short)):
                d = build(state)
                if state.startswith("MCD3_NON_CONSOLIDATED_"):
                    expected = (rc.CAUTIONARY, True)
                elif state == "MCD3_SIDEWAYS_EQUILIBRIUM":
                    expected = (rc.VALID, False)
                else:
                    expected = (rc.VALID, True)
                self.assertEqual((d.status, d.modifier_id is not None), expected, (state, bias))
                if state.startswith(("MCD3_BULL_", "MCD3_BEAR_")):
                    towards = "LONG" if state.startswith("MCD3_BULL_") else "SHORT"
                    self.assertEqual(d.modifier_id.startswith("M3_CONFIRMS"), bias == towards, (state, bias))


class CautionTests(unittest.TestCase):
    """Caution is inherited from the sensors the matched branch read, and from MCD3 when a modifier applied (3.3 mechanic 4, D3)."""

    def test_all_valid_inputs_give_a_valid_reading_without_reasons(self) -> None:
        d = day(MCD1=M1_DOWN_IN, MCD2=M2_DOWN_IN, MCD3="MCD3_BEAR_MID")
        self.assertEqual((d.status, d.status_reasons), (rc.VALID, ()))

    def test_a_cautionary_sensor_that_was_read_makes_the_result_cautionary_with_its_codes(self) -> None:
        d = day(MCD1=(M1_DOWN_IN, rc.CAUTIONARY), MCD2=M2_DOWN_IN)
        self.assertEqual((d.status, d.status_reasons), (rc.CAUTIONARY, ("MCD0_DEFECT_M15",)))
        d = day(MCD1=M1_DOWN_IN, MCD2=(M2_DOWN_IN, rc.CAUTIONARY, [rc.RETUNING]))
        self.assertEqual((d.status, d.status_reasons), (rc.CAUTIONARY, ("RETUNING",)))

    def test_a_cautionary_sensor_the_branch_did_not_read_does_not_matter(self) -> None:
        # the Scalper's row 3s reads MCD2 only: a cautionary MCD1 changes nothing
        d = scalper(MCD1=(M1_DOWN_IN, rc.CAUTIONARY), MCD2=M2_UP_IN)
        self.assertEqual((d.rule_id, d.status, d.status_reasons, d.sensors_read), ("R3S_TREND_CONTINUATION_M5", rc.VALID, (), ("MCD2",)))
        # a cautionary MCD3 that no modifier used does not matter either
        d = scalper(MCD2=M2_UP_IN, MCD3=("MCD3_SIDEWAYS_EQUILIBRIUM", rc.CAUTIONARY))
        self.assertEqual((d.status, d.sensors_read), (rc.VALID, ("MCD2",)))

    def test_a_cautionary_mcd3_that_a_modifier_used_is_inherited(self) -> None:
        d = scalper(MCD2=M2_UP_IN, MCD3=(M3_BULL_MID, rc.CAUTIONARY))
        self.assertEqual((d.status, d.status_reasons, d.sensors_read), (rc.CAUTIONARY, ("MCD0_DEFECT_M5", "MCD0_DEFECT_M15"), ("MCD2", "MCD3")))

    def test_the_codes_come_in_sensor_order_without_repeats_and_the_modifier_code_last(self) -> None:
        d = scalper(
            MCD2=(M2_UP_IN, rc.CAUTIONARY, ["MCD0_DEFECT_M5", "DETECTION_MISMATCH"]),
            MCD3=(M3_CONFLICT, rc.CAUTIONARY, ["UPSTREAM_CAUTIONARY:MCD2", "MCD0_DEFECT_M5"]),
        )
        self.assertEqual(d.status_reasons, ("MCD0_DEFECT_M5", "DETECTION_MISMATCH", f"{MODIFIER_CAUTION}:{M3_CONFLICT}"))  # the echo of MCD2 is left out

    def test_the_echo_of_an_upstream_sensors_caution_is_left_out(self) -> None:
        # MCD3 says UPSTREAM_CAUTIONARY:<id> for each sensor it read that was CAUTIONARY: it only repeats what that sensor's own codes say
        d = scalper(MCD2=(M2_UP_IN, rc.CAUTIONARY), MCD3=(M3_CONFLICT, rc.CAUTIONARY, ["UPSTREAM_CAUTIONARY:MCD1", "UPSTREAM_CAUTIONARY:MCD2", "MCD0_DEFECT_M5"]))
        self.assertEqual(d.status_reasons, ("MCD0_DEFECT_M5", f"{MODIFIER_CAUTION}:{M3_CONFLICT}"))
        self.assertFalse([c for c in d.status_reasons if c.startswith("UPSTREAM_CAUTIONARY:")])

    def test_the_echo_is_left_out_whichever_sensor_it_comes_from(self) -> None:
        d = day(
            MCD1=(M1_DOWN_IN, rc.CAUTIONARY, ["UPSTREAM_CAUTIONARY:MCD2", "MCD0_DEFECT_M15"]),  # not a code an MCD1 emits, but the rule is about the code
            MCD2=M2_DOWN_IN,
        )
        self.assertEqual(d.status_reasons, ("MCD0_DEFECT_M15",))

    def test_the_echo_is_kept_when_nothing_else_explains_the_caution(self) -> None:
        # a CAUTIONARY reading must always say why: here the echoes are the only reasons there are
        d = scalper(MCD2=M2_UP_IN, MCD3=(M3_BULL_MID, rc.CAUTIONARY, ["UPSTREAM_CAUTIONARY:MCD1", "UPSTREAM_CAUTIONARY:MCD2", "UPSTREAM_CAUTIONARY:MCD1"]))
        self.assertEqual((d.status, d.status_reasons), (rc.CAUTIONARY, ("UPSTREAM_CAUTIONARY:MCD1", "UPSTREAM_CAUTIONARY:MCD2")))  # in order, once each
        made = synthesize_cycle(rules(), cycle(MCD2=M2_UP_IN, MCD3=(M3_BULL_MID, rc.CAUTIONARY, ["UPSTREAM_CAUTIONARY:MCD1"])), cycle_slot=sy.SLOT, data_status="FRESH")
        self.assertTrue(made[SCALPER].ok, made[SCALPER].problems)

    def test_a_modifier_caution_is_a_reason_of_its_own_so_the_echoes_are_not_needed(self) -> None:
        d = scalper(MCD2=M2_UP_IN, MCD3=(M3_CONFLICT, rc.CAUTIONARY, ["UPSTREAM_CAUTIONARY:MCD1"]))
        self.assertEqual(d.status_reasons, (f"{MODIFIER_CAUTION}:{M3_CONFLICT}",))

    def test_a_no_match_reading_drops_the_echoes_too(self) -> None:
        d = day(MCD1=M1_UP_IN, MCD2=M2_DOWN_IN, MCD3=(M3_BULL_MID, rc.CAUTIONARY, ["UPSTREAM_CAUTIONARY:MCD1", "MCD0_DEFECT_M15"]))
        self.assertEqual((d.rule_id, d.status, d.status_reasons), ("NO_MATCH", rc.CAUTIONARY, ("MCD0_DEFECT_M15",)))

    def test_a_modifier_caution_alone_makes_a_valid_input_set_cautionary(self) -> None:
        d = scalper(MCD2=M2_UP_IN, MCD3=M3_OVERFLOW)
        self.assertEqual((d.status, d.status_reasons), (rc.CAUTIONARY, (f"{MODIFIER_CAUTION}:{M3_OVERFLOW}",)))

    def test_the_real_cycles_all_come_out_cautionary(self) -> None:
        # every channel sensor of the three real cycles carries an MCD0 defect (step 3, the MCD0 flag-rate question)
        d = day(MCD1=(M1_DOWN_UPPER, rc.CAUTIONARY), MCD2=(M2_UP_IN, rc.CAUTIONARY))
        self.assertEqual((d.rule_id, d.status), ("R1_MACRO_COUNTER_TREND_RALLY", rc.CAUTIONARY))


class CustomRulesTests(unittest.TestCase):
    """Edge cases of a rules file that draft-1 does not use but a later version may: the engine must stay correct for them."""

    def variant(self, mutate):
        doc = yaml.safe_load(sy.rules_text())
        mutate(doc)
        return parse_rules(yaml.safe_dump(doc, sort_keys=False), vocabulary=sy.vocabulary())

    def add_modifier(self, doc, **fields):
        entry = {"id": "M_CUSTOM", "sensor": "MCD3", "when": [], "bias": ["LONG", "SHORT"], "effect": "caution", "text": "A custom caution"}
        entry.update(fields)
        doc["modifiers"].insert(0, entry)

    def test_a_modifier_that_tests_status_never_applies_to_an_unavailable_sensor(self) -> None:
        other = self.variant(lambda d: self.add_modifier(d, when=[{"fact": "status", "in": ["STALE"]}]))
        d = decide(other, SCALPER, cycle(MCD2=M2_UP_IN, MCD3=("-", rc.STALE)))
        self.assertEqual((d.modifier_id, d.status, d.sensors_read, len(d.reasons)), (None, rc.VALID, ("MCD2",), 1))

    def test_a_modifier_with_two_conditions_needs_both(self) -> None:
        both = [{"fact": "consolidation", "in": ["UP"]}, {"fact": "state_code", "in": ["MCD3_BULL_TOP"]}]
        other = self.variant(lambda d: self.add_modifier(d, when=both, bias=["LONG"], effect="note"))
        self.assertEqual(decide(other, SCALPER, cycle(MCD2=M2_UP_IN, MCD3="MCD3_BULL_TOP")).modifier_id, "M_CUSTOM")
        self.assertEqual(decide(other, SCALPER, cycle(MCD2=M2_UP_IN, MCD3="MCD3_BULL_MID")).modifier_id, "M3_CONFIRMS_UP")  # one holds, one does not

    def test_the_codes_of_a_modifiers_sensor_come_in_sensor_order_whichever_sensor_it_is(self) -> None:
        other = self.variant(
            lambda d: d["modifiers"].insert(
                0,
                {"id": "M_FROM_MCD1", "sensor": "MCD1", "when": [{"fact": "trend", "in": ["UP"]}], "bias": ["LONG"], "effect": "note", "text": "M15 note"},
            )
        )
        d = decide(other, SCALPER, cycle(MCD1=(M1_UP_IN, rc.CAUTIONARY), MCD2=(M2_UP_IN, rc.CAUTIONARY)))
        self.assertEqual((d.modifier_id, d.sensors_read), ("M_FROM_MCD1", ("MCD1", "MCD2")))
        self.assertEqual(d.status_reasons, ("MCD0_DEFECT_M15", "MCD0_DEFECT_M5"))  # MCD1 first although the branch read MCD2 first

    def test_a_modifier_restricted_to_a_row_applies_to_that_row_only(self) -> None:
        other = self.variant(lambda d: self.add_modifier(d, when=[{"fact": "consolidation", "in": ["UP"]}], rules=["R3S_TREND_CONTINUATION_M5"], effect="note", bias=["LONG"]))
        self.assertEqual(decide(other, SCALPER, cycle(MCD2=M2_UP_IN, MCD3=M3_BULL_MID)).modifier_id, "M_CUSTOM")
        self.assertEqual(decide(other, DAY, cycle(MCD1=M1_UP_IN, MCD2=M2_UP_IN, MCD3=M3_BULL_MID)).modifier_id, "M3_CONFIRMS_UP")  # row 3: not restricted to 3s

    def test_a_data_check_reads_only_the_primary_sensor(self) -> None:
        branch = sy.rules().rules[0].branches[0]
        self.assertEqual(branch.sensors_read("MCD1"), ("MCD1",))
        self.assertEqual(branch.sensors_read("MCD2"), ("MCD2",))
        r1 = next(r for r in sy.rules().rules if r.id == "R1_MACRO_COUNTER_TREND_RALLY")
        self.assertEqual(r1.branches[0].sensors_read("MCD1"), ("MCD1", "MCD2"))


# --------------------------------------------------------------------------- the differential test


def _regime(mcd_id: str, state: str) -> str:
    return sy.registry()[mcd_id].states[state].regime_status


def _split(state: str) -> tuple[str, str]:
    """``MCD1_DOWN_UPPER_BREAKOUT`` -> ``("DOWN", "UPPER_BREAKOUT")``."""
    _, trend, position = state.split("_", 2)
    return trend, position


_BREACH = {"UPPER_BREAKOUT": "UP", "LOWER_BREAKDOWN": "DOWN"}
_WITH = {"UP": "LONG", "DOWN": "SHORT"}
_AGAINST = {"UP": "SHORT", "DOWN": "LONG"}
_CONTINUATION_OF_M5 = {
    "UP": {"TREND_ALIGNED_CONTINUATION", "UPTREND_DIP_BELOW_CORRIDOR"},
    "DOWN": {"TREND_ALIGNED_CONTINUATION", "DOWNTREND_RALLY_ABOVE_CORRIDOR"},
}


def oracle(profile: str, s1: str, s2: str, s3: str) -> tuple[str, str, str | None, str | None]:
    """Architecture 3.4 read afresh (rule id, bias, archetype, trend relation), with Davin's readings D1 (a) to (d). All sensors VALID."""
    r1, r2 = _regime("MCD1", s1), _regime("MCD2", s2)
    t1, p1 = _split(s1)
    t2, p2 = _split(s2)
    day_trader = profile == DAY
    # row 1, Day Trader: M15 counter-trend expansion and the M5 trending in the breach direction
    if day_trader and r1 == "COUNTER_TREND_EXPANSION" and t2 == _BREACH[p1]:
        return ("R1_MACRO_COUNTER_TREND_RALLY", _WITH[_BREACH[p1]], "C", "COUNTER_TREND")
    # row 2, both: M15 same-slope breakout or an M5 overextension, against the spike; the primary sensor wins a disagreement
    spikes = {}
    if r1 == "BREAKOUT_SAME_SLOPE":
        spikes["MCD1"] = _AGAINST[_BREACH[p1]]
    if r2 in ("UPPER_OVEREXTENSION_REVERSION", "LOWER_OVEREXTENSION_REVERSION"):
        spikes["MCD2"] = _AGAINST[_BREACH[p2]]
    if spikes:
        primary = "MCD1" if day_trader else "MCD2"
        chosen = spikes[primary] if primary in spikes else next(iter(spikes.values()))
        return ("R2_EXHAUSTION_SNAPBACK", chosen, "B", "COUNTER_TREND")
    # row 3, Day Trader: M15 trend continuation and the M5 in the same trend (in the corridor, a dip against it)
    if day_trader and r1 == "TREND_ALIGNED_CONTINUATION" and t1 == t2 and t1 in _WITH and r2 in _CONTINUATION_OF_M5[t1]:
        return ("R3_TREND_CONTINUATION", _WITH[t1], "A", "WITH_TREND")
    # row 3s, Scalper: the M5 trend continues
    if not day_trader and t2 in _WITH and r2 in _CONTINUATION_OF_M5[t2]:
        return ("R3S_TREND_CONTINUATION_M5", _WITH[t2], "A", "WITH_TREND")
    # row 4, both: a range. An M15 range and an M5 range middle stand aside; an M5 range edge is traded against the excursion
    ranges = {}
    if r1 in ("CONSOLIDATION", "RANGE_EXPANSION"):
        ranges["MCD1"] = ("STAND_ASIDE", None)
    if s2 == "MCD2_SIDEWAYS_UPPER_BREAKOUT":
        ranges["MCD2"] = ("SHORT", "COUNTER_TREND")
    elif s2 == "MCD2_SIDEWAYS_LOWER_BREAKDOWN":
        ranges["MCD2"] = ("LONG", "COUNTER_TREND")
    elif s2 == "MCD2_SIDEWAYS_IN_CORRIDOR":
        ranges["MCD2"] = ("STAND_ASIDE", None)
    if ranges:
        primary = "MCD1" if day_trader else "MCD2"
        bias, relation = ranges[primary] if primary in ranges else next(iter(ranges.values()))
        return ("R4_RANGE", bias, "D", relation)
    # row 5, both: MCD3 not consolidated and nothing above matched
    if s3.startswith("MCD3_NON_CONSOLIDATED_"):
        return ("R5_UNRESOLVED_CONFLICT", "STAND_ASIDE", None, None)
    return ("NO_MATCH", "NEUTRAL", None, None)


class DifferentialTests(unittest.TestCase):
    """The engine against the independent reading of 3.4, over every combination of states: 9 x 9 x 10 for each trader type."""

    @classmethod
    def setUpClass(cls) -> None:
        cls.combos = list(itertools.product(states("MCD1"), states("MCD2"), states("MCD3")))

    def test_the_engine_equals_the_table_for_every_combination(self) -> None:
        self.assertEqual(len(self.combos), 810)
        for profile in (DAY, SCALPER):
            for s1, s2, s3 in self.combos:
                d = decide(rules(), profile, cycle(MCD1=s1, MCD2=s2, MCD3=s3))
                self.assertEqual((d.rule_id, d.bias, d.archetype, d.trend_relation), oracle(profile, s1, s2, s3), (profile, s1, s2, s3))

    def test_every_reading_is_a_valid_syn_reading_and_both_profiles_are_made(self) -> None:
        for s1, s2, s3 in self.combos:
            readings = cycle(MCD1=s1, MCD2=s2, MCD3=s3)
            made = synthesize_cycle(rules(), readings, cycle_slot=sy.SLOT, data_status="FRESH")
            self.assertEqual(list(made), [DAY, SCALPER])
            for syn in made.values():
                self.assertIsInstance(syn, SynReading)
                self.assertEqual(syn.problems, (), (s1, s2, s3, syn.profile))

    def test_the_rule_ids_that_occur_are_exactly_the_rows_of_the_table(self) -> None:
        seen = {profile: set() for profile in (DAY, SCALPER)}
        for s1, s2, s3 in self.combos:
            for profile in (DAY, SCALPER):
                seen[profile].add(oracle(profile, s1, s2, s3)[0])
        self.assertEqual(seen[DAY], {"R1_MACRO_COUNTER_TREND_RALLY", "R2_EXHAUSTION_SNAPBACK", "R3_TREND_CONTINUATION", "R4_RANGE", "R5_UNRESOLVED_CONFLICT", "NO_MATCH"})
        self.assertEqual(seen[SCALPER], {"R2_EXHAUSTION_SNAPBACK", "R3S_TREND_CONTINUATION_M5", "R4_RANGE"})

    def test_a_directional_result_always_has_an_archetype_and_a_trend_relation(self) -> None:
        for profile in (DAY, SCALPER):
            for s1, s2, s3 in self.combos:
                d = decide(rules(), profile, cycle(MCD1=s1, MCD2=s2, MCD3=s3))
                if d.bias in ("LONG", "SHORT"):
                    self.assertIsNotNone(d.archetype)
                    self.assertIn(d.trend_relation, ("WITH_TREND", "COUNTER_TREND"))
                else:
                    self.assertIsNone(d.trend_relation)

    def test_modifiers_never_change_the_rule_or_the_direction(self) -> None:
        for profile in (DAY, SCALPER):
            for s1, s2 in itertools.product(states("MCD1"), states("MCD2")):
                without = decide(rules(), profile, cycle(MCD1=s1, MCD2=s2))
                for s3 in states("MCD3"):
                    with_mcd3 = decide(rules(), profile, cycle(MCD1=s1, MCD2=s2, MCD3=s3))
                    if without.rule_id in ("NO_MATCH",) and s3.startswith("MCD3_NON_CONSOLIDATED_"):
                        self.assertEqual(with_mcd3.rule_id, "R5_UNRESOLVED_CONFLICT")  # the one place MCD3 changes the row: row 5 reads it
                        continue
                    self.assertEqual((with_mcd3.rule_id, with_mcd3.bias), (without.rule_id, without.bias), (profile, s1, s2, s3))


if __name__ == "__main__":
    unittest.main()
