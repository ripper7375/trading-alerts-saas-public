"""The modal's price pills (build step 4, part 2; architecture 3.6 step 6, ADR-033; architecture 3.10: "modal pills equal zone reference prices; no filler prices").

A pill is a price of a stored zone: the reference prices, best first, one per zone, and nothing else. The modal itself is Section 6 (build step 5).
"""

from __future__ import annotations

import random
import unittest
from decimal import Decimal

from mcd_worker.synthesis.pills import pills, pills_from_rows
from mcd_worker.synthesis.zones import build_entry_zones
from mcd_worker.tests import synthesis_support as sy
from mcd_worker.tests.synthesis_support import SLOT, channel, level, sr, zones
from mcd_worker.tests.test_zones_invariants import world

D = Decimal


class PillsTests(unittest.TestCase):
    def test_the_pills_are_the_reference_prices_in_rank_order(self) -> None:
        zone_set = zones("LONG", channel("M5", 4384.28, 4367.25, 4350.22) + [level("UOEDT", "M15", 4279.21, "MCD1")], 4377.99)
        self.assertEqual(pills(zone_set.zones), (4367.25, 4350.22))
        self.assertEqual(pills(zone_set.zones), tuple(z.to_dict()["reference_price"] for z in zone_set.zones))

    def test_one_pill_per_zone_never_more_and_never_fewer(self) -> None:
        for count, levels, price in ((1, channel("M5", 4010, 4000, 3990), 3995), (2, channel("M5", 4010, 4000, 3990), 4005), (3, channel("M5", 4010, 4000, 3990), 4100)):
            zone_set = zones("LONG", levels, price)
            self.assertEqual((len(zone_set.zones), len(pills(zone_set.zones))), (count, count))

    def test_fewer_zones_give_fewer_pills_and_no_filler(self) -> None:
        one = zones("LONG", channel("M5", 4010, 4000, 3990), 3995)
        self.assertEqual(pills(one.zones), (3990.0,))  # not padded to five with an evenly spaced ladder

    def test_no_zones_no_pills(self) -> None:
        for bias in ("STAND_ASIDE", "NEUTRAL", None):
            self.assertEqual(pills(build_entry_zones(bias, channel("M5", 4010, 4000, 3990), D("3995"), sy.zone_params()).zones), ())
        self.assertEqual(pills(zones("LONG", channel("M5", 4010, 4000, 3990), 3980).zones), ())  # the price is below every level
        self.assertEqual(pills(()), ())

    def test_at_most_five(self) -> None:
        many = channel("M5", 4300, 4200, 4100) + channel("M5", 4350, 4250, 4150, origin="MCD3")
        self.assertEqual(len(pills(zones("LONG", many, 4500).zones)), 5)

    def test_the_order_is_the_rank_not_the_position_in_the_list(self) -> None:
        zone_set = zones("LONG", channel("M5", 4300, 4200, 4100), 4400)
        self.assertEqual(pills(list(reversed(zone_set.zones))), pills(zone_set.zones))

    def test_a_pill_is_a_float_of_cents(self) -> None:
        for price in pills(zones("LONG", channel("M5", 4384.28, 4367.25, 4350.22), 4377.99).zones):
            self.assertIs(type(price), float)
            self.assertEqual(round(price, 2), price)


class PillsFromRowsTests(unittest.TestCase):
    """The reader of ``entry_zones`` has rows, not zone objects."""

    def rows(self):
        return zones("LONG", channel("M5", 4300, 4200, 4100) + [sr("sr_1", 4110)], 4400).rows("DAY_TRADER", SLOT)

    def test_the_rows_give_the_same_pills(self) -> None:
        zone_set = zones("LONG", channel("M5", 4300, 4200, 4100) + [sr("sr_1", 4110)], 4400)
        self.assertEqual(pills_from_rows(self.rows()), pills(zone_set.zones))

    def test_the_order_comes_from_the_rank_whatever_order_the_database_returns(self) -> None:
        rows = self.rows()
        self.assertEqual(pills_from_rows(list(reversed(rows))), pills_from_rows(rows))
        shuffled = rows[:]
        random.Random(3).shuffle(shuffled)
        self.assertEqual(pills_from_rows(shuffled), pills_from_rows(rows))

    def test_a_row_that_is_not_usable_is_not_a_pill(self) -> None:
        rows = self.rows()
        junk = [None, "row", {}, {"rank": 1}, {"reference_price": 4000.0}, {"rank": True, "reference_price": 4000.0}, {"rank": 1, "reference_price": True}, {"rank": "1", "reference_price": 4000.0}, {"rank": 1, "reference_price": "4000"}]
        self.assertEqual(pills_from_rows(junk + rows), pills_from_rows(rows))
        self.assertEqual(pills_from_rows([]), ())

    def test_integer_prices_are_accepted_and_written_as_floats(self) -> None:
        self.assertEqual(pills_from_rows([{"rank": 2, "reference_price": 4100}, {"rank": 1, "reference_price": 4300.5}]), (4300.5, 4100.0))


class NoFillerTests(unittest.TestCase):
    """A price in the modal is a price of a stored zone: over many random worlds, every pill is the reference price of a zone and nothing else is."""

    def test_every_pill_of_every_random_world_is_a_zone_reference_price(self) -> None:
        checked = 0
        for seed in range(600):
            levels, p_ref = world(random.Random(seed))
            for bias in ("LONG", "SHORT"):
                zone_set = build_entry_zones(bias, levels, p_ref, sy.zone_params())
                shown = pills(zone_set.zones)
                references = [float(z.reference_price) for z in zone_set.zones]
                self.assertEqual(list(shown), references, (seed, bias))
                self.assertEqual(len(set(shown)), len(shown), (seed, bias))  # no repeated price
                self.assertLessEqual(len(shown), 5)
                self.assertEqual(sorted(pills_from_rows(zone_set.rows("SCALPER", SLOT))), sorted(shown))
                checked += len(shown)
        self.assertGreater(checked, 600)

    def test_the_pills_are_not_an_evenly_spaced_ladder(self) -> None:
        # the old modal offered five prices $2.50 apart whatever the market was doing (3.8); the pills follow the levels
        zone_set = zones("LONG", channel("M5", 4384.28, 4367.25, 4350.22), 4377.99)
        gaps = {round(a - b, 2) for a, b in zip(pills(zone_set.zones), pills(zone_set.zones)[1:])}
        self.assertNotEqual(gaps, {2.5})
        self.assertEqual(len(pills(zone_set.zones)), 2)


if __name__ == "__main__":
    unittest.main()
