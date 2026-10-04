"""What must hold for every zone the builder ever makes (build step 4, part 2; architecture 3.10).

The builder is run on thousands of random worlds (seeded, so every run sees the same ones) and every zone is checked against a recomputation written here
from the text of architecture 3.6 and decisions D4 to D7, not from the builder's code: the stop distance is never under $13, the invalidation lies on the
far side of the reference price, the runway is to the nearest level beyond it, the order is the documented one, there are never more than five zones, and so on.
Also: the order of the input levels never matters, a mirrored world gives mirrored zones, and ``zone_problems`` refuses each way a stored zone can be wrong.
"""

from __future__ import annotations

import copy
import dataclasses
import random
import unittest
from decimal import ROUND_HALF_UP, Decimal

from mcd_worker.synthesis.pills import pills
from mcd_worker.synthesis.zones import (
    BASIS_LEVEL,
    Level,
    build_entry_zones,
    rows_json,
    zone_problems,
)
from mcd_worker.tests import synthesis_support as sy
from mcd_worker.tests.synthesis_support import level, sr, zones

D = Decimal
CENT = D("0.01")
PARAMS = sy.zone_params()
SEEDS = 1500
BIGGER = dataclasses.replace(PARAMS, max_zones=50)  # the full ranking, to compare a cut one against


def cents(rng: random.Random, low: int, high: int) -> Decimal:
    return D(rng.randint(low * 100, high * 100)) / 100


def world(rng: random.Random) -> tuple[list[Level], Decimal]:
    """A random cycle: an M5 channel (sometimes two, from two sensors), an M15 channel, some support and resistance, and a price."""
    base = rng.randint(3000, 5000)
    levels: list[Level] = []
    for origin, tf, spread in (("MCD2", "M5", 300), ("MCD3", "M5", 300), ("MCD1", "M15", 800)):
        if origin == "MCD3" and rng.random() < 0.7:
            continue
        low = cents(rng, base - spread, base + spread)
        width = cents(rng, 1, spread)
        names = [("LOEDT", low), ("UOEDT", low + width)]
        if rng.random() < 0.8:
            names.append(("baseline", low + width * D(rng.randint(10, 90)) / 100))
        for name, price in names:
            levels.append(Level(name, tf, price.quantize(CENT, rounding=ROUND_HALF_UP), origin))
    for number in rng.sample(range(1, 17), rng.randint(0, 8)):
        levels.append(Level(f"sr_{number}", rng.choice(("M5", "M15")), cents(rng, base - 300, base + 300), "sr_levels" if number <= 8 else "sr2_levels"))
    p_ref = rng.choice([cents(rng, base - 200, base + 200), rng.choice(levels).price])  # sometimes exactly on a level
    return levels, p_ref


def structure_of(levels: list[Level]) -> list[Level]:
    """The levels as the builder sees them: each (timeframe, name, price) once."""
    seen, out = set(), []
    for lv in levels:
        key = (lv.tf, lv.name, lv.price)
        if key not in seen:
            seen.add(key)
            out.append(lv)
    return out


def places(value: float) -> int:
    exponent = D(repr(value)).normalize().as_tuple().exponent
    return -exponent if exponent < 0 else 0


class EveryZoneTests(unittest.TestCase):
    def check(self, bias: str, levels: list[Level], p_ref: Decimal) -> None:
        zone_set = build_entry_zones(bias, levels, p_ref, PARAMS)
        long = bias == "LONG"
        structure = structure_of(levels)
        context = (bias, p_ref, [(lv.name, lv.tf, lv.price) for lv in levels])
        found = zone_set.zones
        self.assertLessEqual(len(found), 5, context)
        self.assertEqual([z.zone_id for z in found], [f"Z{i}" for i in range(1, len(found) + 1)], context)
        self.assertEqual([z.rank for z in found], list(range(1, len(found) + 1)), context)
        self.assertEqual(zone_set.ids, [z.zone_id for z in found], context)
        self.assertEqual(bool(found), zone_set.reason is None, context)

        for z in found:
            # where it is
            self.assertLessEqual(z.low, z.reference_price, context)
            self.assertLessEqual(z.reference_price, z.high, context)
            self.assertTrue(z.reference_price < p_ref if long else z.reference_price > p_ref, context)  # on the bias side, strictly (D7 d)
            for source in z.source_levels:
                self.assertTrue(source.is_channel and source.tf == "M5", context)
                self.assertTrue(source.price < p_ref if long else source.price > p_ref, context)
                self.assertTrue(z.low <= source.price <= z.high, context)
            self.assertEqual(z.reference_price, max(m.price for m in z.source_levels) if long else min(m.price for m in z.source_levels), context)  # D7 (b)

            # confluence: every distinct level inside the range, edges included
            inside = sorted((lv for lv in structure if z.low <= lv.price <= z.high), key=lambda lv: (lv.price, lv.tf, lv.name, lv.origin))
            self.assertEqual(list(z.confluence_levels), inside, context)
            self.assertEqual(z.confluence_count, len(inside), context)
            self.assertGreaterEqual(z.confluence_count, 1, context)

            # invalidation (ADR-032, D7 a)
            self.assertGreaterEqual(z.stop_distance, D("13"), context)
            self.assertEqual(z.stop_distance, abs(z.reference_price - z.invalidation_price), context)
            self.assertTrue(z.invalidation_price < z.reference_price if long else z.invalidation_price > z.reference_price, context)
            past = [lv for lv in structure if (lv.price < z.low if long else lv.price > z.high)]
            if not past:
                self.assertEqual((z.invalidation_basis, z.invalidation_level), ("NO_LEVEL", None), context)
                self.assertEqual(z.stop_distance, D("13"), context)
            else:
                nearest = max(lv.price for lv in past) if long else min(lv.price for lv in past)
                self.assertEqual(z.invalidation_level.price, nearest, context)
                wanted = nearest - D("0.50") if long else nearest + D("0.50")
                if abs(z.reference_price - wanted) >= D("13"):
                    self.assertEqual((z.invalidation_basis, z.invalidation_price), (BASIS_LEVEL, wanted), context)
                else:
                    self.assertEqual((z.invalidation_basis, z.stop_distance), ("MINIMUM_STOP", D("13")), context)

            # runway (3.6 step 4, D7 e)
            beyond = [lv for lv in structure if (lv.price > z.reference_price if long else lv.price < z.reference_price)]
            if not beyond:
                self.assertEqual((z.next_opposing_level, z.runway, z.runway_ratio), (None, None, None), context)
            else:
                first = min(lv.price for lv in beyond) if long else max(lv.price for lv in beyond)
                self.assertEqual(z.next_opposing_level.price, first, context)
                self.assertEqual(z.runway, abs(first - z.reference_price), context)
                self.assertGreater(z.runway, 0, context)
                self.assertEqual(z.runway_ratio, (z.runway / z.stop_distance).quantize(CENT, rounding=ROUND_HALF_UP), context)

            # the written zone: cents, and consistent with itself
            written = z.to_dict()
            for key in ("low", "high", "reference_price", "invalidation_price", "stop_distance"):
                self.assertLessEqual(places(written[key]), 2, (key, context))
            self.assertEqual(zone_problems(written, PARAMS), [], context)

        # zones are separate: no two overlap or touch
        by_low = sorted(found, key=lambda z: z.low)
        for left, right in zip(by_low, by_low[1:]):
            self.assertLess(left.high, right.low, context)
        # every source is in one zone only
        sources = [(s.name, s.tf, s.price, s.origin) for z in found for s in z.source_levels]
        self.assertEqual(len(sources), len(set(sources)), context)

        # the order (3.6 step 5, D7 f): confluence, then the ratio (none first), then the distance from the price
        def key(z):
            return (-z.confluence_count, (0, D(0)) if z.runway_ratio is None else (1, -z.runway_ratio), abs(z.reference_price - p_ref))

        for better, worse in zip(found, found[1:]):
            self.assertLess(key(better), key(worse), context)  # strictly: no two zones tie on all three (so the order is total)

        # at most five, and the five are the best five of everything there is
        everything = build_entry_zones(bias, levels, p_ref, BIGGER).zones
        self.assertEqual([z.to_dict() for z in found], [z.to_dict() for z in everything[: len(found)]], context)
        self.assertEqual(len(found), min(5, len(everything)), context)

        # every source level on the bias side that has a channel width is in some zone of the full set
        widths = {}
        for lv in structure:
            if lv.is_channel and lv.name in ("UOEDT", "LOEDT"):
                widths.setdefault((lv.origin, lv.tf), {})[lv.name] = lv.price
        eligible = {
            (lv.name, lv.tf, lv.price, lv.origin)
            for lv in structure
            if lv.is_channel and lv.tf == "M5" and (lv.price < p_ref if long else lv.price > p_ref)
            and len(widths.get((lv.origin, lv.tf), {})) == 2 and widths[(lv.origin, lv.tf)]["UOEDT"] > widths[(lv.origin, lv.tf)]["LOEDT"]
        }
        self.assertEqual({(s.name, s.tf, s.price, s.origin) for z in everything for s in z.source_levels}, eligible, context)

        # the pills are the reference prices in rank order, one per zone, nothing else
        self.assertEqual(pills(found), tuple(float(z.reference_price) for z in found), context)
        self.assertEqual(len(pills(found)), len(found), context)

    def test_every_zone_of_a_thousand_random_worlds_is_what_the_architecture_says(self) -> None:
        made = 0
        for seed in range(SEEDS):
            levels, p_ref = world(random.Random(seed))
            for bias in ("LONG", "SHORT"):
                self.check(bias, levels, p_ref)
                made += len(build_entry_zones(bias, levels, p_ref, PARAMS).zones)
        self.assertGreater(made, SEEDS)  # the worlds do make zones; a test of nothing would pass too

    def test_the_random_worlds_reach_every_basis_and_every_ending(self) -> None:
        bases, none_opposing, merged, five = set(), 0, 0, 0
        for seed in range(SEEDS):
            levels, p_ref = world(random.Random(seed))
            for bias in ("LONG", "SHORT"):
                found = build_entry_zones(bias, levels, p_ref, PARAMS).zones
                five += len(found) == 5
                for z in found:
                    bases.add(z.invalidation_basis)
                    none_opposing += z.next_opposing_level is None
                    merged += len(z.source_levels) > 1
        self.assertEqual(bases, {"LEVEL", "MINIMUM_STOP", "NO_LEVEL"})
        self.assertGreater(none_opposing, 0)
        self.assertGreater(merged, 0)
        self.assertGreater(five, 0)  # the cut at five is reached

    def test_the_order_of_the_input_levels_never_matters(self) -> None:
        for seed in range(300):
            rng = random.Random(seed)
            levels, p_ref = world(rng)
            shuffled = levels[:]
            rng.shuffle(shuffled)
            for bias in ("LONG", "SHORT"):
                a = build_entry_zones(bias, levels, p_ref, PARAMS)
                b = build_entry_zones(bias, shuffled, p_ref, PARAMS)
                self.assertEqual(a.to_dicts(), b.to_dicts(), (seed, bias))
                self.assertEqual(rows_json(a.rows("DAY_TRADER", sy.SLOT)), rows_json(b.rows("DAY_TRADER", sy.SLOT)), (seed, bias))

    def test_two_processes_with_different_hash_seeds_write_the_same_bytes(self) -> None:
        import os
        import subprocess
        import sys

        from mcd_worker.tests import support as s

        script = (
            "import random\n"
            "from mcd_worker.synthesis.zones import build_entry_zones, rows_json\n"
            "from mcd_worker.tests import synthesis_support as sy\n"
            "from mcd_worker.tests.test_zones_invariants import world\n"
            "out = []\n"
            "for seed in range(80):\n"
            "    levels, p_ref = world(random.Random(seed))\n"
            "    for bias in ('LONG', 'SHORT'):\n"
            "        out.append(rows_json(build_entry_zones(bias, levels, p_ref, sy.zone_params()).rows('DAY_TRADER', sy.SLOT)))\n"
            "print('\\n'.join(out))\n"
        )

        def run(seed: str) -> str:
            env = {"PYTHONHASHSEED": seed, "PYTHONDONTWRITEBYTECODE": "1", "PATH": os.environ.get("PATH", ""), "SYSTEMROOT": os.environ.get("SYSTEMROOT", "")}
            done = subprocess.run([sys.executable, "-B", "-c", script], cwd=s.ENGINE, env=env, capture_output=True, encoding="utf-8", timeout=120)
            self.assertEqual(done.returncode, 0, done.stderr)
            return done.stdout

        a, b = run("0"), run("98765")
        self.assertEqual(a, b)
        self.assertGreater(len([line for line in a.splitlines() if line != "[]"]), 20)  # the worlds make zones: the comparison is not of nothing

    def test_the_same_level_listed_twice_changes_nothing(self) -> None:
        for seed in range(100):
            levels, p_ref = world(random.Random(seed))
            for bias in ("LONG", "SHORT"):
                self.assertEqual(
                    build_entry_zones(bias, levels, p_ref, PARAMS).to_dicts(),
                    build_entry_zones(bias, levels + levels, p_ref, PARAMS).to_dicts(),
                    (seed, bias),
                )

    def test_a_mirrored_world_gives_mirrored_zones(self) -> None:
        swap = {"UOEDT": "LOEDT", "LOEDT": "UOEDT"}
        k = D("20000")
        for seed in range(400):
            levels, p_ref = world(random.Random(seed))
            mirrored = [Level(swap.get(lv.name, lv.name), lv.tf, k - lv.price, lv.origin) for lv in levels]
            for bias, other in (("LONG", "SHORT"), ("SHORT", "LONG")):
                a = build_entry_zones(bias, levels, p_ref, PARAMS).zones
                b = build_entry_zones(other, mirrored, k - p_ref, PARAMS).zones
                self.assertEqual(len(a), len(b), (seed, bias))
                for x, y in zip(a, b):
                    self.assertEqual((k - x.high, k - x.low, k - x.reference_price), (y.low, y.high, y.reference_price), (seed, bias))
                    self.assertEqual((k - x.invalidation_price, x.stop_distance, x.invalidation_basis), (y.invalidation_price, y.stop_distance, y.invalidation_basis), (seed, bias))
                    self.assertEqual((x.confluence_count, x.runway, x.runway_ratio), (y.confluence_count, y.runway, y.runway_ratio), (seed, bias))
                    self.assertEqual(x.rank, y.rank, (seed, bias))

    def test_prices_with_more_than_two_decimals_come_out_in_cents(self) -> None:
        rng = random.Random(7)
        for _ in range(200):
            levels, p_ref = world(rng)
            fine = [Level(lv.name, lv.tf, lv.price + D(rng.randint(-499, 499)) / 100000, lv.origin) for lv in levels]
            for bias in ("LONG", "SHORT"):
                for z in build_entry_zones(bias, fine, p_ref, PARAMS).zones:
                    written = z.to_dict()
                    for key in ("low", "high", "reference_price", "invalidation_price", "stop_distance"):
                        self.assertLessEqual(places(written[key]), 2, key)
                    for lv in written["confluence_levels"] + written["source_levels"]:
                        self.assertLessEqual(places(lv["price"]), 2)
                    self.assertEqual(zone_problems(written, PARAMS), [])

    def test_no_zone_for_a_bias_that_is_not_a_direction_in_any_world(self) -> None:
        for seed in range(200):
            levels, p_ref = world(random.Random(seed))
            for bias in ("STAND_ASIDE", "NEUTRAL", None):
                self.assertEqual(build_entry_zones(bias, levels, p_ref, PARAMS).zones, ())


class ZoneGuardTests(unittest.TestCase):
    """``zone_problems`` is the guard the runner will put between the builder and the database: it must refuse every way a zone can be wrong."""

    @classmethod
    def setUpClass(cls) -> None:
        extra = [level("baseline", "M15", 3970, "MCD1"), sr("sr_5", 3995.5), sr("sr_1", 3991)]
        cls.good = zones("LONG", [level("UOEDT", "M5", 4010), level("LOEDT", "M5", 3990)] + extra, 3995).zones[0].to_dict()
        cls.bare = zones("LONG", [level("UOEDT", "M5", 4010), level("LOEDT", "M5", 3990)], 4100).zones[0].to_dict()  # no level beyond: no runway

    def bad(self, mutate, base=None) -> list[str]:
        zone = copy.deepcopy(base or self.good)
        mutate(zone)
        found = zone_problems(zone, PARAMS)
        self.assertTrue(found, "the guard accepted a zone it should have refused")
        return found

    def mentions(self, found: list[str], needle: str) -> bool:
        return any(needle in problem for problem in found)

    def test_a_good_zone_has_no_problems(self) -> None:
        self.assertEqual(zone_problems(self.good, PARAMS), [])
        self.assertEqual(zone_problems(self.bare, PARAMS), [])
        self.assertEqual(self.good["invalidation_basis"], BASIS_LEVEL)
        self.assertIsNotNone(self.good["next_opposing_level"])
        self.assertIsNone(self.bare["next_opposing_level"])

    def test_not_a_zone_at_all(self) -> None:
        for odd in (None, 5, [], "zone"):
            self.assertEqual(zone_problems(odd, PARAMS), [f"the zone is a {type(odd).__name__}, not a mapping"])
        found = zone_problems({}, PARAMS)
        self.assertTrue(self.mentions(found, "missing keys") and self.mentions(found, "zone_id"))
        found = self.bad(lambda z: z.pop("runway"))
        self.assertTrue(self.mentions(found, "missing keys: runway"))

    def test_a_price_that_is_not_a_positive_number(self) -> None:
        for key in ("low", "high", "reference_price", "invalidation_price", "stop_distance"):
            for bad in (None, "4000", 0, -1, True, float("nan")):
                self.assertTrue(self.mentions(self.bad(lambda z, k=key, v=bad: z.update({k: v})), "not a positive number"), (key, bad))

    def test_rank_and_id(self) -> None:
        self.assertTrue(self.mentions(self.bad(lambda z: z.update(rank=0)), "rank"))
        self.assertTrue(self.mentions(self.bad(lambda z: z.update(rank=6)), "rank"))
        self.assertTrue(self.mentions(self.bad(lambda z: z.update(rank=True)), "rank"))
        self.assertTrue(self.mentions(self.bad(lambda z: z.update(rank="1")), "rank"))
        self.assertTrue(self.mentions(self.bad(lambda z: z.update(zone_id="Z2")), "zone_id"))

    def test_the_bias(self) -> None:
        self.assertTrue(self.mentions(self.bad(lambda z: z.update(bias="NEUTRAL")), "bias"))

    def test_cents(self) -> None:
        for key in ("low", "high", "reference_price", "invalidation_price", "stop_distance"):
            self.assertTrue(self.mentions(self.bad(lambda z, k=key: z.update({k: z[k] + 0.001})), "decimals"), key)

    def test_the_reference_price_must_be_inside_the_zone(self) -> None:
        self.assertTrue(self.mentions(self.bad(lambda z: z.update(reference_price=z["high"] + 1)), "not inside the zone"))
        self.assertTrue(self.mentions(self.bad(lambda z: z.update(reference_price=z["low"] - 1)), "not inside the zone"))

    def test_the_invalidation_must_be_on_the_far_side(self) -> None:
        self.assertTrue(self.mentions(self.bad(lambda z: z.update(invalidation_price=z["reference_price"] + 20, stop_distance=20.0)), "far side"))
        short = copy.deepcopy(self.good)
        short["bias"] = "SHORT"
        self.assertTrue(self.mentions(self.bad(lambda z: None, short), "far side"))  # a LONG zone's invalidation is on the wrong side for a SHORT

    def test_the_stop_distance(self) -> None:
        self.assertTrue(self.mentions(self.bad(lambda z: z.update(stop_distance=z["stop_distance"] + 1)), "not the distance"))
        self.assertTrue(self.mentions(self.bad(lambda z: z.update(invalidation_price=round(z["reference_price"] - 12.99, 2), stop_distance=12.99)), "under"))

    def test_the_basis(self) -> None:
        self.assertTrue(self.mentions(self.bad(lambda z: z.update(invalidation_basis="GUESS")), "invalidation_basis"))
        self.assertTrue(self.mentions(self.bad(lambda z: z.update(invalidation_level=None)), "names no structure level"))
        self.assertTrue(self.mentions(self.bad(lambda z: z.update(invalidation_basis="NO_LEVEL")), "names one"))
        self.assertTrue(self.mentions(self.bad(lambda z: z.update(invalidation_basis="MINIMUM_STOP")), "raised stop"))
        self.assertTrue(self.mentions(self.bad(lambda z: z["invalidation_level"].update(price=z["invalidation_level"]["price"] + 1)), "buffer"))

    def test_a_raised_stop_is_exactly_the_minimum(self) -> None:
        raised = zones("LONG", [level("UOEDT", "M5", 4010), level("LOEDT", "M5", 3990), level("baseline", "M15", 3980, "MCD1")], 3995).zones[0].to_dict()
        self.assertEqual((raised["invalidation_basis"], raised["stop_distance"]), ("MINIMUM_STOP", 13.0))
        self.assertEqual(zone_problems(raised, PARAMS), [])
        self.assertTrue(self.mentions(self.bad(lambda z: z.update(invalidation_price=3975.0, stop_distance=15.0), raised), "raised stop"))

    def test_confluence(self) -> None:
        self.assertTrue(self.mentions(self.bad(lambda z: z.update(confluence_count=z["confluence_count"] + 1)), "confluence_count"))
        self.assertTrue(self.mentions(self.bad(lambda z: z.update(confluence_levels=[], confluence_count=0)), "confluence_count"))
        self.assertTrue(self.mentions(self.bad(lambda z: z.update(confluence_levels="x")), "confluence_count"))

    def test_the_runway(self) -> None:
        self.assertEqual((self.good["runway"], self.good["next_opposing_level"]["name"]), (1.0, "sr_1"))  # the nearest level above the entry
        self.assertTrue(self.mentions(self.bad(lambda z: z.update(runway=1.0), self.bare), "no opposing level has a runway"))
        self.assertTrue(self.mentions(self.bad(lambda z: z.update(runway_ratio=0.5), self.bare), "runway"))
        self.assertTrue(self.mentions(self.bad(lambda z: z.update(runway=None)), "needs a runway and a ratio"))
        self.assertTrue(self.mentions(self.bad(lambda z: z.update(runway_ratio=None)), "needs a runway and a ratio"))
        self.assertTrue(self.mentions(self.bad(lambda z: z.update(runway=z["runway"] + 1)), "runway is not the distance"))
        self.assertTrue(self.mentions(self.bad(lambda z: z.update(runway_ratio=z["runway_ratio"] + 0.01)), "ratio is not"))
        self.assertTrue(self.mentions(self.bad(lambda z: z["next_opposing_level"].update(price=z["reference_price"] - 1)), "not beyond"))
        self.assertTrue(self.mentions(self.bad(lambda z: z.update(next_opposing_level="x")), "needs a runway and a ratio"))


if __name__ == "__main__":
    unittest.main()
