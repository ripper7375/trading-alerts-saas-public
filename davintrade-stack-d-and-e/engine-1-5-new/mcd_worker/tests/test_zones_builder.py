"""The entry-zone builder, rule by rule (build step 4, part 2; architecture 3.6 and 3.7; decisions D4 to D7).

Each test builds a small world whose answer can be worked out by hand. The standard world is an M5 channel of width 20 (UOEDT 4010, baseline 4000,
LOEDT 3990, so the half-width is 2.00) with the price at 3995 for a LONG: one zone, at the LOEDT, 3988 to 3992.
"""

from __future__ import annotations

import dataclasses
import json
import unittest
from decimal import Decimal

from mcd_common.cycle_inputs import slot_to_epoch

from mcd_worker.synthesis import synthesize_cycle
from mcd_worker.synthesis.pills import pills
from mcd_worker.synthesis.zones import (
    BASIS_LEVEL,
    BASIS_MINIMUM,
    BASIS_NO_LEVEL,
    NO_REFERENCE_PRICE,
    NO_ZONE_SOURCES,
    NOT_DIRECTIONAL,
    ROW_ORDER,
    ZONE_ORDER,
    Level,
    build_entry_zones,
    levels_from_readings,
    reference_close,
    rows_json,
    sr_levels_from_context,
    to_decimal,
)
from mcd_worker.tests import support as s
from mcd_worker.tests import synthesis_support as sy
from mcd_worker.tests.synthesis_support import SLOT, channel, level, sr, zones

D = Decimal


def only(zone_set):
    assert len(zone_set.zones) == 1, [z.to_dict() for z in zone_set.zones]
    return zone_set.zones[0]


def standard_long(extra=(), p_ref=3995):
    return zones("LONG", channel("M5", 4010, 4000, 3990) + list(extra), p_ref)


class WorkedExampleTests(unittest.TestCase):
    """Architecture 3.7 on its own numbers: the table of the architecture, to the cent."""

    LEVELS = channel("M5", 4384.28, 4367.25, 4350.22) + [level("UOEDT", "M15", 4279.21, "MCD1"), level("LOEDT", "M15", 4125.99, "MCD1")]

    def setUp(self) -> None:
        self.zone_set = zones("LONG", self.LEVELS, "4377.99")  # the labelled last price of the example; D4 uses the closed bar's close in production

    def test_two_zones_best_first(self) -> None:
        self.assertEqual(self.zone_set.ids, ["Z1", "Z2"])
        self.assertIsNone(self.zone_set.reason)

    def test_z1_the_m5_baseline(self) -> None:
        z = self.zone_set.zones[0].to_dict()
        self.assertEqual((z["low"], z["high"], z["reference_price"]), (4363.84, 4370.66, 4367.25))
        self.assertEqual((z["invalidation_price"], z["invalidation_basis"], z["stop_distance"]), (4349.72, BASIS_LEVEL, 17.53))  # the LOEDT less 0.50
        self.assertEqual((z["next_opposing_level"]["name"], z["next_opposing_level"]["price"]), ("UOEDT", 4384.28))
        self.assertEqual((z["runway"], z["runway_ratio"], z["rank"], z["confluence_count"]), (17.03, 0.97, 1, 1))

    def test_z2_the_m5_loedt(self) -> None:
        z = self.zone_set.zones[1].to_dict()
        self.assertEqual((z["low"], z["high"], z["reference_price"]), (4346.81, 4353.63, 4350.22))
        self.assertEqual((z["invalidation_price"], z["invalidation_basis"], z["stop_distance"]), (4278.71, BASIS_LEVEL, 71.51))  # the M15 UOEDT less 0.50
        self.assertEqual((z["next_opposing_level"]["name"], z["next_opposing_level"]["price"]), ("baseline", 4367.25))
        self.assertEqual((z["runway"], z["runway_ratio"], z["rank"], z["confluence_count"]), (17.03, 0.24, 2, 1))

    def test_the_pills_are_the_two_reference_prices(self) -> None:
        self.assertEqual(pills(self.zone_set.zones), (4367.25, 4350.22))

    def test_the_m5_uoedt_is_not_a_zone_because_it_is_above_the_price(self) -> None:
        self.assertNotIn(4384.28, [z.reference_price for z in self.zone_set.zones])
        self.assertEqual(self.zone_set.zones[0].next_opposing_level.name, "UOEDT")  # it is the first opposing level of Z1


class ReferencePriceTests(unittest.TestCase):
    """D4: the close of the last closed M5 bar, as architecture 2.8 uses it."""

    def bundle(self, bars):
        return s.tiny_inputs(SLOT, bars={"M5": tuple(bars), "M15": ()})

    def test_the_real_cycles(self) -> None:
        self.assertEqual(reference_close(s.bundle("v1")), D("4378.31"))  # not 4377.99: that is the bar still forming at the slot
        self.assertEqual(reference_close(s.bundle("v3")), D("4138.78"))
        self.assertEqual(reference_close(s.bundle("v4")), D("4125.32"))

    def test_the_bar_still_forming_is_never_the_reference(self) -> None:
        slot = slot_to_epoch(SLOT)
        bars = [{"timestamp": slot - 300, "close": 100.5}, {"timestamp": slot, "close": 999.0}, {"timestamp": slot - 600, "close": 98.0}]
        self.assertEqual(reference_close(self.bundle(bars)), D("100.5"))

    def test_the_last_bar_is_found_by_its_time_not_its_place(self) -> None:
        slot = slot_to_epoch(SLOT)
        bars = [{"timestamp": slot - 300, "close": 100.5}, {"timestamp": slot - 900, "close": 97.0}, {"timestamp": slot - 600, "close": 98.0}]
        self.assertEqual(reference_close(self.bundle(bars)), D("100.5"))

    def test_nothing_usable_gives_none(self) -> None:
        slot = slot_to_epoch(SLOT)
        self.assertIsNone(reference_close(self.bundle([])))
        self.assertIsNone(reference_close(self.bundle([{"timestamp": slot, "close": 5.0}])))  # only the forming bar
        for bad in (None, "100", True, float("nan"), 0, -5):
            self.assertIsNone(reference_close(self.bundle([{"timestamp": slot - 300, "close": bad}])), bad)


class LevelsTests(unittest.TestCase):
    def readings(self):
        import json as _json

        cycle = _json.loads(s.stored_cycle_text("v1"))
        return {r["mcd_id"]: _json.loads(r["envelope_json"]) for r in cycle["results"]}

    def test_the_channel_levels_of_the_available_sensors_each_once(self) -> None:
        found = levels_from_readings(self.readings())
        self.assertEqual(
            [(lv.origin, lv.tf, lv.name, lv.price) for lv in found],
            [
                ("MCD1", "M15", "UOEDT", D("4279.46")),
                ("MCD1", "M15", "baseline", D("4214.17")),
                ("MCD1", "M15", "LOEDT", D("4126.24")),
                ("MCD2", "M5", "UOEDT", D("4384.23")),
                ("MCD2", "M5", "baseline", D("4367.2")),
                ("MCD2", "M5", "LOEDT", D("4350.16")),
            ],
        )  # MCD3 repeats all six and is left out as a duplicate

    def test_a_sensor_that_is_not_available_gives_no_levels(self) -> None:
        readings = self.readings()
        readings["MCD2"] = sy.envelope("MCD2", "-", "INVALID")
        readings["MCD3"] = sy.envelope("MCD3", "-", "STALE")
        self.assertEqual({lv.tf for lv in levels_from_readings(readings)}, {"M15"})
        self.assertEqual(levels_from_readings({}), [])
        self.assertEqual(levels_from_readings({"MCD1": "junk", "MCD2": None}), [])

    def test_a_level_that_is_not_a_level_is_skipped(self) -> None:
        reading = dict(
            sy.envelope("MCD2", "MCD2_UP_IN_CORRIDOR"),
            levels=[
                {"name": "UOEDT", "tf": "M5", "price": 4384.28},
                {"name": "", "tf": "M5", "price": 4300.0},
                {"name": "X", "tf": "H1", "price": 4300.0},
                {"name": "Y", "tf": "M5", "price": "4300"},
                {"name": "Z", "tf": "M5", "price": 0},
                {"name": "W", "tf": "M5", "price": True},
                "junk",
            ],
        )
        self.assertEqual([(lv.name, lv.price) for lv in levels_from_readings({"MCD2": reading})], [("UOEDT", D("4384.28"))])

    def test_the_support_and_resistance_levels_of_the_context(self) -> None:
        context = {"M15": {"sr_1": 4369.57, "sr_2": None, "sr_5": 4386.2, "sr_9": 4300.0}, "M5": {"sr_1": 4369.57, "sr_3": 4334.56}}
        found = sr_levels_from_context(context)
        self.assertEqual(
            [(lv.name, lv.tf, lv.price, lv.origin) for lv in found],
            [
                ("sr_1", "M5", D("4369.57"), "sr_levels"),  # the same slot at the same price on both timeframes is one level
                ("sr_3", "M5", D("4334.56"), "sr_levels"),
                ("sr_5", "M15", D("4386.2"), "sr_levels"),
                ("sr_9", "M15", D("4300.0"), "sr2_levels"),  # sr_9 to sr_16 belong to the second calibration
            ],
        )

    def test_the_first_calibration_ends_at_sr_8_and_the_second_starts_at_sr_9(self) -> None:
        found = sr_levels_from_context({"M15": {"sr_8": 4300.0, "sr_9": 4301.0, "sr_16": 4302.0}})
        self.assertEqual([(lv.name, lv.origin) for lv in found], [("sr_8", "sr_levels"), ("sr_9", "sr2_levels"), ("sr_16", "sr2_levels")])

    def test_two_lines_of_two_timeframes_with_one_name_and_price_are_two_levels(self) -> None:
        from mcd_worker.synthesis.zones import _dedupe

        found = _dedupe([level("baseline", "M5", 4000, "MCD2"), level("baseline", "M15", 4000, "MCD1"), level("baseline", "M5", 4000, "MCD3")])
        self.assertEqual([(lv.tf, lv.origin) for lv in found], [("M5", "MCD2"), ("M15", "MCD1")])

    def test_the_same_slot_at_two_prices_is_two_levels(self) -> None:
        found = sr_levels_from_context({"M5": {"sr_1": 4369.57}, "M15": {"sr_1": 4370.0}})
        self.assertEqual([(lv.tf, lv.price) for lv in found], [("M5", D("4369.57")), ("M15", D("4370.0"))])

    def test_what_is_not_a_support_or_resistance_level_is_skipped(self) -> None:
        for context in (None, [], "x", {"M15": None}, {"M15": []}, {"H1": {"sr_1": 5.0}}):
            self.assertEqual(sr_levels_from_context(context), [], context)
        row = {"sr_17": 5.0, "sr_0": 5.0, "x": 5.0, "sr_1": 0, "sr_2": -3, "sr_3": True, "sr_4": float("nan"), "sr_5": "4300", 7: 5.0, "sr_6\\n": 5.0}
        self.assertEqual(sr_levels_from_context({"M15": row}), [])

    def test_to_decimal_takes_numbers_only(self) -> None:
        self.assertEqual(to_decimal(4367.25), D("4367.25"))
        self.assertEqual(to_decimal(13), D("13"))
        self.assertEqual(to_decimal(0.1), D("0.1"))  # the shortest text of the float, not its binary expansion
        for bad in (True, False, None, "1", [1], float("nan"), float("inf")):
            self.assertIsNone(to_decimal(bad), bad)


class SourcesTests(unittest.TestCase):
    """D6 and D7 (d): zones are made from the M5 channel levels on the bias side of the price."""

    def test_a_long_makes_zones_from_the_levels_below_the_price_only(self) -> None:
        zone_set = zones("LONG", channel("M5", 4010, 4000, 3990), 4005)
        self.assertEqual([z.reference_price for z in zone_set.zones], [D("4000"), D("3990")])  # nothing at 4010: it is above the price

    def test_a_short_makes_zones_from_the_levels_above_the_price_only(self) -> None:
        zone_set = zones("SHORT", channel("M5", 4010, 4000, 3990), 3995)
        self.assertEqual(sorted(z.reference_price for z in zone_set.zones), [D("4000"), D("4010")])

    def test_a_level_equal_to_the_price_is_on_neither_side(self) -> None:
        self.assertEqual([z.reference_price for z in zones("LONG", channel("M5", 4010, 4000, 3990), 4000).zones], [D("3990")])
        self.assertEqual([z.reference_price for z in zones("SHORT", channel("M5", 4010, 4000, 3990), 4000).zones], [D("4010")])

    def test_the_m15_levels_and_the_support_and_resistance_levels_are_never_sources(self) -> None:
        extra = channel("M15", 3900, 3850, 3800) + [sr("sr_1", 3980), sr("sr_2", 3970, "M5")]
        zone_set = standard_long(extra)
        self.assertEqual([z.reference_price for z in zone_set.zones], [D("3990")])

    def test_a_channel_without_a_width_makes_no_zone(self) -> None:
        for levels in (
            [level("baseline", "M5", 3990)],  # no UOEDT, no LOEDT
            [level("UOEDT", "M5", 4010), level("baseline", "M5", 3990)],  # no LOEDT
            [level("UOEDT", "M5", 3990), level("LOEDT", "M5", 4010)],  # upside down
            [level("UOEDT", "M5", 4000), level("LOEDT", "M5", 4000)],  # no width
        ):
            zone_set = zones("LONG", levels, 4100)
            self.assertEqual((zone_set.zones, zone_set.reason), ((), NO_ZONE_SOURCES), levels)

    def test_each_sensors_channel_has_its_own_width(self) -> None:
        wide = [level("UOEDT", "M5", 4100, "MCD3"), level("LOEDT", "M5", 3900, "MCD3")]  # width 200: half-width 20
        narrow = [level("UOEDT", "M5", 3810, "MCD2"), level("LOEDT", "M5", 3790, "MCD2")]  # width 20: half-width 2
        by_ref = {z.reference_price: z for z in zones("LONG", wide + narrow, 4500).zones}
        self.assertEqual((by_ref[D("3900")].low, by_ref[D("3900")].high), (D("3880"), D("3920")))
        self.assertEqual((by_ref[D("3790")].low, by_ref[D("3790")].high), (D("3788"), D("3792")))

    def test_a_source_that_is_not_m5_or_not_a_channel_is_not_used(self) -> None:
        levels = [level("UOEDT", "M15", 4010, "MCD1"), level("LOEDT", "M15", 3990, "MCD1"), level("baseline", "M15", 4000, "MCD1")]
        self.assertEqual(zones("LONG", levels, 4100).reason, NO_ZONE_SOURCES)


class HalfWidthTests(unittest.TestCase):
    """ADR-031, D7 (c): 10% of the source channel's width, rounded half up to cents."""

    def zone_at_loedt(self, width):
        levels = channel("M5", D("100") + D(str(width)), D("100") + D(str(width)) / 2, 100)
        return [z for z in zones("LONG", levels, 1000).zones if z.reference_price == D("100")][0]

    def test_ten_percent_of_the_width(self) -> None:
        z = self.zone_at_loedt(20)
        self.assertEqual((z.low, z.high), (D("98"), D("102")))

    def test_the_architecture_example_rounds_3_406_to_3_41(self) -> None:
        z = self.zone_at_loedt("34.06")
        self.assertEqual((z.low, z.high), (D("96.59"), D("103.41")))

    def test_it_rounds_half_up_not_to_even(self) -> None:
        self.assertEqual(self.zone_at_loedt("34.05").high - D("100"), D("3.41"))  # 3.405 up
        self.assertEqual(self.zone_at_loedt("34.04").high - D("100"), D("3.40"))  # 3.404 down
        self.assertEqual(self.zone_at_loedt("34.25").high - D("100"), D("3.43"))  # 3.425 up, where rounding to even would give 3.42

    def test_the_fraction_is_a_parameter(self) -> None:
        params = dataclasses.replace(sy.zone_params(), half_width_fraction=D("0.25"))
        z = zones("LONG", channel("M5", 4010, 4000, 3990), 3995, params).zones[0]
        self.assertEqual((z.low, z.high), (D("3985"), D("3995")))

    def test_the_m15_channel_does_not_set_the_width(self) -> None:
        z = standard_long(channel("M15", 5000, 4000, 3000)).zones[0]
        self.assertEqual((z.low, z.high), (D("3988"), D("3992")))


class MergeTests(unittest.TestCase):
    """ADR-031: overlapping zones merge and count as confluence; D7 (b): the reference price is the member nearest the price."""

    def merged(self, baseline, bias="LONG", p_ref=4100, extra=()):
        return zones(bias, channel("M5", 4000, baseline, 3940) + list(extra), p_ref)  # width 60: half-width 6

    def test_zones_that_overlap_merge_into_one_with_the_union_as_its_range(self) -> None:
        zone_set = self.merged(3948)  # [3934, 3946] and [3942, 3954]
        self.assertEqual(len(zone_set.zones), 2)
        z = [z for z in zone_set.zones if z.low < D("3960")][0]
        self.assertEqual((z.low, z.high), (D("3934"), D("3954")))
        self.assertEqual([m.price for m in z.source_levels], [D("3940"), D("3948")])

    def test_zones_that_touch_merge(self) -> None:
        zone_set = self.merged(3952)  # [3934, 3946] and [3946, 3958]: the edges meet
        z = [z for z in zone_set.zones if z.low < D("3960")][0]
        self.assertEqual((z.low, z.high), (D("3934"), D("3958")))

    def test_zones_with_a_gap_stay_apart(self) -> None:
        zone_set = self.merged(3953)  # [3934, 3946] and [3947, 3959]
        self.assertEqual(len(zone_set.zones), 3)

    def test_a_long_merged_zone_takes_the_highest_member_as_its_reference(self) -> None:
        z = [z for z in self.merged(3948).zones if z.low < D("3960")][0]
        self.assertEqual(z.reference_price, D("3948"))

    def test_a_short_merged_zone_takes_the_lowest_member_as_its_reference(self) -> None:
        z = [z for z in self.merged(3948, "SHORT", p_ref=3900).zones if z.low < D("3960")][0]
        self.assertEqual((z.reference_price, z.low, z.high), (D("3940"), D("3934"), D("3954")))

    def test_a_chain_of_overlaps_is_one_zone(self) -> None:
        mcd2 = channel("M5", 4000, 3948, 3940, origin="MCD2")
        mcd3 = channel("M5", 4005, 3955, 3945, origin="MCD3")
        zone_set = zones("LONG", mcd2 + mcd3, 4100)  # [3934,3946] [3939,3951] [3942,3954] [3949,3961] are one chain; 4000 and 4005 are the other
        self.assertEqual(len(zone_set.zones), 2)
        chain = [z for z in zone_set.zones if z.low < D("3970")][0]
        self.assertEqual((chain.low, chain.high, chain.reference_price, len(chain.source_levels)), (D("3934"), D("3961"), D("3955"), 4))
        self.assertEqual(chain.source_sensors, ("MCD2", "MCD3"))
        self.assertEqual(chain.confluence_count, 4)

    def test_confluence_counts_every_level_inside_the_range_edges_included(self) -> None:
        base = [z for z in self.merged(3948).zones if z.low < D("3960")][0]
        self.assertEqual(base.confluence_count, 2)  # the two members
        z = [z for z in self.merged(3948, extra=[sr("sr_1", 3950), level("baseline", "M15", 3945, "MCD1")]).zones if z.low < D("3960")][0]
        self.assertEqual(z.confluence_count, 4)  # a support and an M15 line inside count too
        z = [z for z in self.merged(3948, extra=[sr("sr_1", 3934), sr("sr_2", 3954)]).zones if z.low < D("3960")][0]
        self.assertEqual(z.confluence_count, 4)  # exactly on the low edge and on the high edge
        z = [z for z in self.merged(3948, extra=[sr("sr_1", 3933.99), sr("sr_2", 3954.01)]).zones if z.low < D("3960")][0]
        self.assertEqual(z.confluence_count, 2)  # a cent outside the range: not confluence

    def test_the_same_level_twice_counts_once_but_two_lines_at_one_price_count_twice(self) -> None:
        once = [z for z in self.merged(3948, extra=[level("LOEDT", "M5", 3940, "MCD3")]).zones if z.low < D("3960")][0]
        self.assertEqual(once.confluence_count, 2)  # the same line from MCD3 is the same level
        twice = [z for z in self.merged(3948, extra=[level("baseline", "M15", 3940, "MCD1")]).zones if z.low < D("3960")][0]
        self.assertEqual(twice.confluence_count, 3)  # another line at the same price is another level

    def test_a_zone_inside_a_bigger_one_does_not_shrink_it(self) -> None:
        wide = [level("UOEDT", "M5", 4200, "MCD3"), level("LOEDT", "M5", 4000, "MCD3")]  # width 200: half-width 20: zones 3980-4020 and 4180-4220
        narrow = [level("UOEDT", "M5", 4012, "MCD2"), level("LOEDT", "M5", 3992, "MCD2")]  # width 20: half-width 2: zones 4010-4014 and 3990-3994
        zone_set = zones("LONG", wide + narrow, 4500)
        first = [z for z in zone_set.zones if z.low < D("3985")][0]
        self.assertEqual((first.low, first.high), (D("3980"), D("4020")))  # 3990-3994 and 4010-4014 lie inside 3980-4020: the range stays the wide one
        self.assertEqual(len(first.source_levels), 3)

    def test_the_confluence_levels_are_listed_in_price_order(self) -> None:
        z = [z for z in self.merged(3948, extra=[sr("sr_1", 3950), sr("sr_2", 3936)]).zones if z.low < D("3960")][0]
        self.assertEqual([lv.price for lv in z.confluence_levels], [D("3936"), D("3940"), D("3948"), D("3950")])


class InvalidationTests(unittest.TestCase):
    """ADR-032, D7 (a): $0.50 beyond the next structural level past the zone, never closer than $13 from the reference price."""

    def zone_with(self, *prices, names=None):
        extra = [level(f"M{i}", "M15", p, "MCD1") for i, p in enumerate(prices)]
        return only(standard_long(extra))  # the zone: 3988 to 3992, reference 3990

    def test_half_a_dollar_beyond_the_nearest_level_past_the_zone(self) -> None:
        z = self.zone_with(3970)
        self.assertEqual((z.invalidation_price, z.invalidation_basis, z.stop_distance), (D("3969.50"), BASIS_LEVEL, D("20.50")))
        self.assertEqual(z.invalidation_level.price, D("3970"))

    def test_the_nearest_level_is_the_one_used_not_the_farthest(self) -> None:
        z = self.zone_with(3950, 3970, 3960)
        self.assertEqual(z.invalidation_price, D("3969.50"))

    def test_the_stop_is_measured_from_the_reference_price_not_the_zone_edge(self) -> None:
        z = self.zone_with(3970)
        self.assertEqual(z.stop_distance, D("3990") - D("3969.50"))  # 20.50, not 3988 - 3969.50 = 18.50

    def test_a_level_closer_than_the_minimum_raises_the_stop_to_exactly_the_minimum(self) -> None:
        z = self.zone_with(3980)  # 3979.50 would be a stop of 10.50
        self.assertEqual((z.invalidation_price, z.invalidation_basis, z.stop_distance), (D("3977.00"), BASIS_MINIMUM, D("13.00")))
        self.assertEqual(z.invalidation_level.price, D("3980"))  # the level that was too close is recorded

    def test_it_does_not_move_on_to_the_next_level_when_the_nearest_is_too_close(self) -> None:
        z = self.zone_with(3980, 3960)
        self.assertEqual((z.invalidation_price, z.invalidation_basis), (D("3977.00"), BASIS_MINIMUM))  # not 3959.50

    def test_a_stop_of_exactly_the_minimum_is_allowed(self) -> None:
        z = self.zone_with("3977.5")  # 3977.00 is exactly 13.00 from 3990
        self.assertEqual((z.invalidation_price, z.invalidation_basis, z.stop_distance), (D("3977.00"), BASIS_LEVEL, D("13.00")))

    def test_a_cent_short_of_the_minimum_is_raised(self) -> None:
        z = self.zone_with("3977.51")  # 3977.01 would be 12.99
        self.assertEqual((z.invalidation_price, z.invalidation_basis, z.stop_distance), (D("3977.00"), BASIS_MINIMUM, D("13.00")))
        z = self.zone_with("3977.49")  # 3976.99 is 13.01
        self.assertEqual((z.invalidation_price, z.invalidation_basis), (D("3976.99"), BASIS_LEVEL))

    def test_with_no_level_past_the_zone_the_stop_is_the_minimum(self) -> None:
        z = standard_long()
        self.assertEqual((z.zones[0].invalidation_price, z.zones[0].invalidation_basis, z.zones[0].stop_distance), (D("3977.00"), BASIS_NO_LEVEL, D("13.00")))
        self.assertIsNone(z.zones[0].invalidation_level)

    def test_a_level_inside_the_zone_is_not_past_it(self) -> None:
        for price in (3989, 3988, 3992, 3991):  # inside, on the low edge, on the high edge, above the reference
            z = self.zone_with(price)
            self.assertEqual(z.invalidation_basis, BASIS_NO_LEVEL, price)

    def test_a_level_a_cent_below_the_zone_is_past_it(self) -> None:
        z = self.zone_with("3987.99")
        self.assertEqual((z.invalidation_basis, z.invalidation_level.price), (BASIS_MINIMUM, D("3987.99")))

    def test_levels_above_the_zone_are_not_behind_a_long(self) -> None:
        z = self.zone_with(4020, 4030)
        self.assertEqual(z.invalidation_basis, BASIS_NO_LEVEL)

    def test_every_kind_of_level_is_structure(self) -> None:
        for extra in (sr("sr_1", 3970), sr("sr_9", 3970), level("LOEDT", "M5", 3970, "MCD3"), level("baseline", "M15", 3970, "MCD1")):
            z = only(standard_long([extra]))
            self.assertEqual((z.invalidation_price, z.invalidation_basis), (D("3969.50"), BASIS_LEVEL), extra)

    def test_a_short_is_the_mirror_image(self) -> None:
        zone_set = zones("SHORT", channel("M5", 4010, 4000, 3990) + [level("baseline", "M15", 4030, "MCD1")], 4005)  # the UOEDT zone: 4008 to 4012
        z = only(zone_set)
        self.assertEqual((z.reference_price, z.invalidation_price, z.invalidation_basis, z.stop_distance), (D("4010"), D("4030.50"), BASIS_LEVEL, D("20.50")))
        close = only(zones("SHORT", channel("M5", 4010, 4000, 3990) + [level("baseline", "M15", 4020, "MCD1")], 4005))
        self.assertEqual((close.invalidation_price, close.invalidation_basis, close.stop_distance), (D("4023.00"), BASIS_MINIMUM, D("13.00")))
        bare = only(zones("SHORT", channel("M5", 4010, 4000, 3990), 4005))
        self.assertEqual((bare.invalidation_price, bare.invalidation_basis), (D("4023.00"), BASIS_NO_LEVEL))

    def test_the_decimals_are_parameters(self) -> None:
        whole = dataclasses.replace(sy.zone_params(), price_decimals=0)
        z = zones("LONG", channel("M5", 4010, 4000, 3990) + [level("baseline", "M15", "3970.4", "MCD1")], 3995, whole).zones[0]
        self.assertEqual((z.low, z.high), (D("3988"), D("3992")))
        self.assertEqual(z.invalidation_price, D("3970"))  # 3969.90 to a whole dollar
        self.assertEqual(z.stop_distance, D("20"))
        z = zones("LONG", channel("M5", 4010, 4000, 3990), 3995, dataclasses.replace(sy.zone_params(), ratio_decimals=0)).zones[0]
        self.assertEqual(z.runway_ratio, D("1"))  # 10 / 13 = 0.77 to a whole number
        z = zones("LONG", channel("M5", 4010, 4000, 3990), 3995, dataclasses.replace(sy.zone_params(), ratio_decimals=4)).zones[0]
        self.assertEqual(z.runway_ratio, D("0.7692"))

    def test_the_buffer_and_the_minimum_are_parameters(self) -> None:
        params = dataclasses.replace(sy.zone_params(), invalidation_buffer=D("1.25"), min_stop_distance=D("30"))
        z = zones("LONG", channel("M5", 4010, 4000, 3990) + [level("baseline", "M15", 3940, "MCD1")], 3995, params).zones[0]
        self.assertEqual((z.invalidation_price, z.invalidation_basis), (D("3938.75"), BASIS_LEVEL))
        z = zones("LONG", channel("M5", 4010, 4000, 3990) + [level("baseline", "M15", 3970, "MCD1")], 3995, params).zones[0]
        self.assertEqual((z.invalidation_price, z.invalidation_basis, z.stop_distance), (D("3960.00"), BASIS_MINIMUM, D("30.00")))

    def test_the_invalidation_is_rounded_half_up_to_cents(self) -> None:
        params = dataclasses.replace(sy.zone_params(), invalidation_buffer=D("0.125"))
        z = zones("LONG", channel("M5", 4010, 4000, 3990) + [level("baseline", "M15", 3970, "MCD1")], 3995, params).zones[0]
        self.assertEqual(z.invalidation_price, D("3969.88"))  # 3969.875 up
        self.assertEqual(z.stop_distance, D("20.12"))


class RunwayTests(unittest.TestCase):
    """3.6 step 4, D7 (e): the distance to the nearest level beyond the reference price on the far side; the ratio is that over the stop distance."""

    def test_the_nearest_level_above_a_long_sets_the_runway(self) -> None:
        z = only(standard_long())  # the baseline at 4000
        self.assertEqual((z.next_opposing_level.name, z.next_opposing_level.price, z.runway, z.stop_distance, z.runway_ratio), ("baseline", D("4000"), D("10"), D("13"), D("0.77")))

    def test_level_just_above_entry_is_the_next_opposing_level(self) -> None:
        """Architecture 3.10: a test cycle with a level just above entry. The zone says where the first obstacle is, so Section 6 (6.5) can refuse targets beyond it."""
        z = only(standard_long([sr("sr_5", "3992.5")]))
        self.assertEqual((z.next_opposing_level.name, z.next_opposing_level.price), ("sr_5", D("3992.5")))
        self.assertEqual((z.runway, z.runway_ratio), (D("2.5"), D("0.19")))

    def test_a_level_inside_the_zone_above_the_reference_is_the_opposing_level_too(self) -> None:
        z = only(standard_long([sr("sr_5", 3991)]))  # D7 (e): "beyond the reference price"; it is confluence as well
        self.assertEqual((z.next_opposing_level.price, z.runway, z.runway_ratio, z.confluence_count), (D("3991"), D("1"), D("0.08"), 2))

    def test_a_level_at_the_reference_price_is_not_beyond_it(self) -> None:
        z = only(standard_long([sr("sr_5", 3990)]))
        self.assertEqual((z.next_opposing_level.name, z.runway, z.confluence_count), ("baseline", D("10"), 2))

    def test_a_level_below_the_reference_is_not_opposing_for_a_long(self) -> None:
        z = only(standard_long([sr("sr_5", 3989)]))
        self.assertEqual(z.next_opposing_level.name, "baseline")

    def test_the_nearest_of_several_is_used(self) -> None:
        z = only(standard_long([sr("sr_5", 3999), sr("sr_6", 3995.5), sr("sr_7", 4050)]))
        self.assertEqual((z.next_opposing_level.name, z.runway), ("sr_6", D("5.5")))

    def test_every_kind_of_level_can_oppose(self) -> None:
        for extra in (sr("sr_5", 3995.5), sr("sr_13", 3995.5), level("baseline", "M15", 3995.5, "MCD1"), level("UOEDT", "M5", 3995.5, "MCD3")):
            self.assertEqual(only(standard_long([extra])).runway, D("5.5"), extra)

    def test_with_no_level_beyond_there_is_no_runway_and_no_ratio(self) -> None:
        zone_set = zones("LONG", channel("M5", 4010, 4000, 3990), 4100)
        top = [z for z in zone_set.zones if z.reference_price == D("4010")][0]
        self.assertEqual((top.next_opposing_level, top.runway, top.runway_ratio), (None, None, None))

    def test_the_ratio_is_rounded_half_up_to_two_places(self) -> None:
        self.assertEqual(only(standard_long()).runway_ratio, D("0.77"))  # 10 / 13 = 0.76923
        lone = [level("UOEDT", "M5", 4010), level("LOEDT", "M5", 3990)]  # no baseline: the nearest level above the LOEDT is whatever we put there
        for price, expected in (("4003", "1.00"), ("3996.5", "0.50"), ("3990.65", "0.05")):  # runway 13, 6.5 and 0.65 over the stop of 13
            self.assertEqual(only(zones("LONG", lone + [sr("sr_5", price)], 3995)).runway_ratio, D(expected), price)

    def test_a_tie_at_the_third_decimal_rounds_up_not_to_even(self) -> None:
        # stop exactly 20.00 (a level at 3970.50, less 0.50) and runway 1.30: 1.30 / 20 = 0.065 exactly: half up gives 0.07, to-even gives 0.06
        z = only(zones("LONG", [level("UOEDT", "M5", 4010), level("LOEDT", "M5", 3990), level("baseline", "M15", "3970.5", "MCD1"), sr("sr_5", "3991.3")], 3995))
        self.assertEqual((z.stop_distance, z.runway), (D("20.00"), D("1.30")))
        self.assertEqual(z.runway_ratio, D("0.07"))

    def test_a_short_runs_down_to_the_nearest_level_below(self) -> None:
        z = only(zones("SHORT", channel("M5", 4010, 4000, 3990), 4005))  # the UOEDT zone; the baseline at 4000 is the nearest level below 4010
        self.assertEqual((z.next_opposing_level.name, z.runway, z.runway_ratio), ("baseline", D("10"), D("0.77")))
        z = only(zones("SHORT", channel("M5", 4010, 4000, 3990) + [sr("sr_1", "4006.5")], 4005))
        self.assertEqual((z.next_opposing_level.name, z.runway), ("sr_1", D("3.5")))

    def test_equal_prices_choose_the_same_level_every_time(self) -> None:
        a = only(standard_long([level("baseline", "M15", 3995.5, "MCD1"), sr("sr_5", 3995.5)]))
        b = only(standard_long([sr("sr_5", 3995.5), level("baseline", "M15", 3995.5, "MCD1")]))
        self.assertEqual(a.next_opposing_level, b.next_opposing_level)
        self.assertEqual(a.next_opposing_level.name, "baseline")  # first by timeframe then name


class RankTests(unittest.TestCase):
    """3.6 step 5, D7 (f): confluence first, then the runway ratio, then the distance from the price."""

    WIDE = channel("M5", 4300, 4200, 4100)  # width 200: zones 4080-4120, 4180-4220, 4280-4320

    def order(self, extra=(), params=None):
        return [z.reference_price for z in zones("LONG", self.WIDE + list(extra), 4400, params).zones]

    def test_no_opposing_level_ranks_first_then_the_better_ratio(self) -> None:
        # the 4300 zone has nothing above it (no ratio: most room), the 4100 zone has ratio 7.69, the 4200 zone 1.00
        self.assertEqual(self.order(), [D("4300"), D("4100"), D("4200")])

    def test_confluence_comes_before_everything(self) -> None:
        self.assertEqual(self.order([sr("sr_1", 4110), sr("sr_2", 4115)]), [D("4100"), D("4300"), D("4200")])

    def test_the_ratio_comes_before_the_distance(self) -> None:
        # equal confluence; the 4200 zone is nearer the price (4400) but has the worse ratio
        order = self.order()
        self.assertGreater(order.index(D("4200")), order.index(D("4100")))

    def test_a_tied_ratio_is_broken_by_the_distance_from_the_price(self) -> None:
        levels = [level("UOEDT", "M5", 4200), level("LOEDT", "M5", 4100), level("baseline", "M15", "4972.8", "MCD1")]  # both zones come out at 7.69
        zone_set = zones("LONG", levels, 4300)
        self.assertEqual([z.runway_ratio for z in zone_set.zones], [D("7.69"), D("7.69")])
        self.assertEqual([z.reference_price for z in zone_set.zones], [D("4200"), D("4100")])  # 100 from the price, then 200

    def test_a_short_ranks_the_same_way(self) -> None:
        zone_set = zones("SHORT", self.WIDE, 4000)
        self.assertEqual([z.reference_price for z in zone_set.zones], [D("4100"), D("4300"), D("4200")])  # nothing below the 4100 zone: first; then 7.69; then 1.00

    def test_ids_and_ranks_follow_the_order(self) -> None:
        zone_set = zones("LONG", self.WIDE, 4400)
        self.assertEqual([(z.zone_id, z.rank) for z in zone_set.zones], [("Z1", 1), ("Z2", 2), ("Z3", 3)])
        self.assertEqual(zone_set.ids, ["Z1", "Z2", "Z3"])

    def test_at_most_five_are_kept(self) -> None:
        mcd3 = channel("M5", 4350, 4250, 4150, origin="MCD3")
        full = zones("LONG", self.WIDE + mcd3, 4500, dataclasses.replace(sy.zone_params(), max_zones=5))
        self.assertEqual(len(full.zones), 5)  # six zones exist
        self.assertEqual(full.ids, ["Z1", "Z2", "Z3", "Z4", "Z5"])
        self.assertEqual(len(zones("LONG", self.WIDE + mcd3, 4500).zones), 5)  # the shipped parameters keep five

    def test_the_kept_ones_are_the_best_ones(self) -> None:
        mcd3 = channel("M5", 4350, 4250, 4150, origin="MCD3")
        everything = zones("LONG", self.WIDE + mcd3, 4500, dataclasses.replace(sy.zone_params(), max_zones=5))
        two = zones("LONG", self.WIDE + mcd3, 4500, dataclasses.replace(sy.zone_params(), max_zones=2))
        self.assertEqual([z.to_dict() for z in two.zones], [z.to_dict() for z in everything.zones[:2]])


class NoZonesTests(unittest.TestCase):
    def test_a_bias_that_is_not_a_direction_builds_nothing(self) -> None:
        for bias in ("STAND_ASIDE", "NEUTRAL", None, "MAYBE", "long", 5):
            zone_set = zones_for(bias)
            self.assertEqual((zone_set.zones, zone_set.reason, zone_set.ids), ((), NOT_DIRECTIONAL, []), bias)
            self.assertEqual(zone_set.to_dicts(), [])
            self.assertEqual(zone_set.rows("DAY_TRADER", SLOT), [])
            self.assertEqual(pills(zone_set.zones), ())

    def test_no_reference_price_builds_nothing(self) -> None:
        for p_ref in (None, D("0"), D("-5")):
            zone_set = build_entry_zones("LONG", channel("M5", 4010, 4000, 3990), p_ref, sy.zone_params())
            self.assertEqual((zone_set.zones, zone_set.reason), ((), NO_REFERENCE_PRICE), p_ref)
            self.assertIsNone(zone_set.reference_price)

    def test_no_level_on_the_bias_side_builds_nothing(self) -> None:
        zone_set = zones("LONG", channel("M5", 4010, 4000, 3990), 3980)  # the price is below every level
        self.assertEqual((zone_set.zones, zone_set.reason), ((), NO_ZONE_SOURCES))
        self.assertEqual(zone_set.reference_price, D("3980"))

    def test_no_levels_at_all(self) -> None:
        self.assertEqual(zones("LONG", [], 4000).reason, NO_ZONE_SOURCES)

    def test_a_zone_set_names_the_parameters_it_was_built_with(self) -> None:
        for zone_set in (zones("LONG", channel("M5", 4010, 4000, 3990), 3995), zones("NEUTRAL", [], 4000), build_entry_zones("LONG", [], None, sy.zone_params())):
            self.assertEqual((zone_set.zones_version, zone_set.zones_sha256), ("zones-1", sy.zone_params().sha256))


def zones_for(bias):
    return build_entry_zones(bias, channel("M5", 4010, 4000, 3990), D("3995"), sy.zone_params())


class OutputTests(unittest.TestCase):
    def setUp(self) -> None:
        self.zone_set = zones("LONG", channel("M5", 4010, 4000, 3990) + [sr("sr_1", 3991)], 4100)

    def test_a_zone_is_written_in_the_documented_key_order(self) -> None:
        for z in self.zone_set.to_dicts():
            self.assertEqual(list(z), list(ZONE_ORDER))

    def test_the_numbers_are_floats_of_cents_and_the_rest_is_plain_data(self) -> None:
        z = self.zone_set.to_dicts()[0]
        for key in ("low", "high", "reference_price", "invalidation_price", "stop_distance"):
            self.assertIs(type(z[key]), float, key)
        self.assertIs(type(z["confluence_count"]), int)
        self.assertEqual(json.loads(json.dumps(z)), z)

    def test_a_row_carries_the_slot_the_trader_type_and_the_parameters_first(self) -> None:
        rows = self.zone_set.rows("SCALPER", SLOT)
        self.assertEqual(list(rows[0]), list(ROW_ORDER))
        self.assertEqual((rows[0]["cycle_slot"], rows[0]["profile"], rows[0]["zones_version"]), (SLOT, "SCALPER", "zones-1"))
        self.assertEqual(rows[0]["zones_sha256"], sy.zone_params().sha256)

    def test_the_text_of_the_rows_is_compact_ascii_and_stable(self) -> None:
        rows = self.zone_set.rows("DAY_TRADER", SLOT)
        text = rows_json(rows)
        self.assertTrue(text.isascii())
        self.assertEqual(text, json.dumps(json.loads(text), separators=(",", ":"), ensure_ascii=True))
        self.assertEqual(list(json.loads(text)[0]), list(ROW_ORDER))
        self.assertEqual(rows_json(self.zone_set.rows("DAY_TRADER", SLOT)), text)
        self.assertEqual(rows_json([]), "[]")

    def test_the_text_does_not_depend_on_the_order_of_the_keys_of_a_row(self) -> None:
        row = self.zone_set.rows("DAY_TRADER", SLOT)[0]
        shuffled = dict(reversed(list(row.items())))
        shuffled["zebra"] = 1
        self.assertEqual(list(json.loads(rows_json([shuffled]))[0])[: len(ROW_ORDER)], list(ROW_ORDER))
        self.assertEqual(list(json.loads(rows_json([shuffled]))[0])[-1], "zebra")

    def test_a_zone_names_where_its_levels_came_from(self) -> None:
        z = self.zone_set.to_dicts()[0]  # the LOEDT zone holds sr_1 (confluence 2), so it ranks first
        self.assertEqual((z["reference_price"], z["source_sensors"]), (3990.0, ["MCD2"]))
        self.assertEqual([(lv["name"], lv["origin"]) for lv in z["source_levels"]], [("LOEDT", "MCD2")])
        self.assertEqual([(lv["name"], lv["origin"]) for lv in z["confluence_levels"]], [("LOEDT", "MCD2"), ("sr_1", "sr_levels")])
        self.assertEqual(z["confluence_count"], 2)


class RealCycleTests(unittest.TestCase):
    """The three stored cycles, with the zones that follow from their readings (every number checked by hand against the levels)."""

    # sr_1 to sr_8 of the last closed M15 bar of the 18 Sep 20:55 slot, from the replica workbook (market_data_v6_M15, open time 1789763400); the M5 rows
    # carry none. The other two cycles have no support and resistance values yet: the bundle will hold them from build step 4 part 3.
    SR_V1 = {"M15": {"sr_1": 4369.57, "sr_2": 4350.92, "sr_3": 4334.56, "sr_4": None, "sr_5": 4386.2, "sr_6": 4398.29, "sr_7": None, "sr_8": None}}

    def levels_of(self, name, context=None):
        cycle = json.loads(s.stored_cycle_text(name))
        readings = {r["mcd_id"]: json.loads(r["envelope_json"]) for r in cycle["results"]}
        return readings, levels_from_readings(readings) + sr_levels_from_context(context)

    def test_18_sep_long_without_support_and_resistance_is_the_architecture_example(self) -> None:
        _, levels = self.levels_of("v1")
        zone_set = build_entry_zones("LONG", levels, reference_close(s.bundle("v1")), sy.zone_params())
        z1, z2 = zone_set.to_dicts()
        self.assertEqual((z1["low"], z1["high"], z1["reference_price"], z1["invalidation_price"], z1["stop_distance"], z1["runway"], z1["runway_ratio"]), (4363.79, 4370.61, 4367.2, 4349.66, 17.54, 17.03, 0.97))
        self.assertEqual((z2["low"], z2["high"], z2["reference_price"], z2["invalidation_price"], z2["stop_distance"], z2["runway"], z2["runway_ratio"]), (4346.75, 4353.57, 4350.16, 4278.96, 71.2, 17.04, 0.24))

    def test_18_sep_long_with_support_and_resistance(self) -> None:
        _, levels = self.levels_of("v1", self.SR_V1)
        zone_set = build_entry_zones("LONG", levels, reference_close(s.bundle("v1")), sy.zone_params())
        z1, z2 = zone_set.to_dicts()
        # Z1: the baseline zone holds sr_1 (confluence 2); the nearest level behind it is sr_2 (4350.92); sr_1, just above the entry, is the first obstacle
        self.assertEqual((z1["reference_price"], z1["confluence_count"], z1["invalidation_price"], z1["invalidation_basis"], z1["stop_distance"]), (4367.2, 2, 4350.42, "LEVEL", 16.78))
        self.assertEqual((z1["next_opposing_level"]["name"], z1["runway"], z1["runway_ratio"]), ("sr_1", 2.37, 0.14))
        # Z2: the LOEDT zone holds sr_2 (confluence 2); behind it sr_3 (4334.56); sr_2, 0.76 above the entry, is the first obstacle
        self.assertEqual((z2["reference_price"], z2["confluence_count"], z2["invalidation_price"], z2["stop_distance"]), (4350.16, 2, 4334.06, 16.1))
        self.assertEqual((z2["next_opposing_level"]["name"], z2["runway"], z2["runway_ratio"]), ("sr_2", 0.76, 0.05))

    def test_18_sep_short_shows_the_mirror_roles(self) -> None:
        _, levels = self.levels_of("v1", self.SR_V1)
        z = only(build_entry_zones("SHORT", levels, reference_close(s.bundle("v1")), sy.zone_params()))
        self.assertEqual((z.reference_price, z.confluence_count, z.invalidation_price, z.stop_distance), (D("4384.23"), 2, D("4398.79"), D("14.56")))  # sr_5 inside, sr_6 behind
        self.assertEqual((z.next_opposing_level.name, z.runway, z.runway_ratio), ("sr_1", D("14.66"), D("1.01")))

    def test_28_sep_14_15_has_a_long_reading_and_no_zone_to_enter_in(self) -> None:
        # the price (4138.78) is below the whole M5 channel, so no M5 level lies on the bias side of a LONG: the reading is LONG, there are no zones
        _, levels = self.levels_of("v3")
        zone_set = build_entry_zones("LONG", levels, reference_close(s.bundle("v3")), sy.zone_params())
        self.assertEqual((zone_set.zones, zone_set.reason), ((), NO_ZONE_SOURCES))

    def test_28_sep_23_15_short(self) -> None:
        _, levels = self.levels_of("v4")
        z1, z2 = build_entry_zones("SHORT", levels, reference_close(s.bundle("v4")), sy.zone_params()).to_dicts()
        self.assertEqual((z1["low"], z1["high"], z1["reference_price"], z1["invalidation_price"], z1["invalidation_basis"], z1["stop_distance"]), (4154.89, 4185.37, 4170.13, 4214.5, "LEVEL", 44.37))
        self.assertEqual((z1["next_opposing_level"]["name"], z1["runway"], z1["runway_ratio"]), ("LOEDT", 66.68, 1.5))
        self.assertEqual((z2["low"], z2["high"], z2["reference_price"], z2["invalidation_price"], z2["stop_distance"]), (4233.9, 4264.38, 4249.14, 4308.22, 59.08))
        self.assertEqual((z2["next_opposing_level"]["name"], z2["runway"], z2["runway_ratio"]), ("baseline", 35.14, 0.59))

    def test_a_reading_carries_the_ids_of_its_zones(self) -> None:
        readings, levels = self.levels_of("v1", self.SR_V1)
        zone_set = build_entry_zones("LONG", levels, reference_close(s.bundle("v1")), sy.zone_params())
        made = synthesize_cycle(sy.rules(), readings, cycle_slot=SLOT, data_status="FRESH", zones={"DAY_TRADER": zone_set.ids, "SCALPER": zone_set.ids})
        for syn in made.values():
            self.assertTrue(syn.ok, syn.problems)
            self.assertEqual(syn.reading["zones"], ["Z1", "Z2"])

    def test_a_stand_aside_reading_cannot_carry_zones_and_the_builder_builds_none(self) -> None:
        readings, levels = self.levels_of("v1", self.SR_V1)
        stand_aside = dict(readings, MCD1=sy.envelope("MCD1", "-", "INVALID"))
        made = synthesize_cycle(sy.rules(), stand_aside, cycle_slot=SLOT, data_status="FRESH")
        reading = made["DAY_TRADER"].reading
        self.assertEqual((reading["bias"], reading["stand_aside"], reading["zones"]), ("STAND_ASIDE", True, []))
        zone_set = build_entry_zones(reading["bias"], levels, reference_close(s.bundle("v1")), sy.zone_params())
        self.assertEqual((zone_set.ids, zone_set.reason), ([], NOT_DIRECTIONAL))
        refused = synthesize_cycle(sy.rules(), stand_aside, cycle_slot=SLOT, data_status="FRESH", zones={"DAY_TRADER": ["Z1"]})
        self.assertFalse(refused["DAY_TRADER"].ok)


class LevelClassTests(unittest.TestCase):
    def test_a_level_knows_whether_it_is_a_channel_line(self) -> None:
        self.assertTrue(level("UOEDT", "M5", 1, "MCD2").is_channel)
        self.assertFalse(sr("sr_1", 1).is_channel)
        self.assertFalse(sr("sr_9", 1).is_channel)

    def test_a_level_is_written_with_a_float_price(self) -> None:
        self.assertEqual(level("UOEDT", "M5", "4384.28", "MCD2").to_dict(), {"name": "UOEDT", "tf": "M5", "price": 4384.28, "origin": "MCD2"})
        self.assertIsInstance(Level("x", "M5", D("1"), "MCD2").price, Decimal)

    def test_prices_are_taken_to_cents_on_the_way_in(self) -> None:
        z = only(zones("LONG", [level("UOEDT", "M5", "4010.004"), level("LOEDT", "M5", "3990.005")], 3995))
        self.assertEqual(z.reference_price, D("3990.01"))  # 3990.005 half up
        self.assertEqual(z.low.as_tuple().exponent, -2)


if __name__ == "__main__":
    unittest.main()
