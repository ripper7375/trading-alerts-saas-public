"""Forward outcomes of one state occurrence (build step 3, part 6): the reference price, the horizon, the sign convention.

Davin's arithmetic of 2026-10-03 (plan Q9 b), one test per sentence of it, on bars built so that a one-bar slip changes the answer.
"""

from __future__ import annotations

import random
import unittest
from decimal import Decimal as D

from mcd_worker.statistics import HORIZON_BARS, BarSeries, BarsError, Outcome, Unavailable, outcome_at
from mcd_worker.statistics import outcomes as oc

SLOT = 1790000100  # unix UTC, on the 5-minute grid; the reference bar opens at SLOT - 300
REF_OPEN = SLOT - 300


def bars_from(
    closes: list,
    *,
    highs: dict[int, object] | None = None,
    lows: dict[int, object] | None = None,
    skip: tuple[int, ...] = (),
    first_open: int = REF_OPEN,
) -> list[dict]:
    """Bars from index 0 (the reference bar) on. Each high is its close + 1 and each low its close - 1 unless overridden by index."""
    out = []
    for i, close in enumerate(closes):
        if i in skip:
            continue
        close = D(str(close))
        out.append(
            {
                "timestamp": first_open + 300 * i,
                "high": (highs or {}).get(i, close + 1),
                "low": (lows or {}).get(i, close - 1),
                "close": close,
            }
        )
    return out


def rising(count: int, start: int = 4000) -> list:
    """Closes start, start + 1, start + 2, ...: every bar has its own close, so an off-by-one bar is visible in the answer."""
    return [start + i for i in range(count)]


def result(closes, bias, hours, **kw):
    return outcome_at(BarSeries(bars_from(closes, **kw)), SLOT, bias, hours)


class TheDecisionTests(unittest.TestCase):
    """Davin's Q9 b answers, one at a time."""

    def test_the_horizons_are_24_and_144_m5_bars(self) -> None:
        self.assertEqual(dict(HORIZON_BARS), {2: 24, 12: 144})
        self.assertEqual(oc.BAR_SECONDS, 300)
        self.assertEqual(oc.BIASES, ("LONG", "SHORT", "NEUTRAL", "STAND_ASIDE"))

    def test_the_reference_price_is_the_close_of_the_bar_opened_at_t_minus_300(self) -> None:
        # bar 0 opens at T-300 and closes at T: the last closed bar at the slot. Its neighbours close at 1 and 2 away.
        closes = [4100, 4000] + rising(24, 4001)  # bar 0 closes 4100, bar 1 4000, then 4001 ... 4024
        out = result(closes, "LONG", 2)
        self.assertEqual(out.forward_move, D(closes[24]) - D(4100))  # not 4000 (the bar after), not the bar before it

    def test_the_horizon_price_is_the_close_of_the_24th_bar_after_the_reference_for_2_hours(self) -> None:
        out = result(rising(30), "LONG", 2)  # closes 4000 .. 4029; 24 bars after bar 0 is bar 24
        self.assertEqual(out.forward_move, D(24))

    def test_the_horizon_price_is_the_close_of_the_144th_bar_after_the_reference_for_12_hours(self) -> None:
        out = result(rising(150), "LONG", 12)
        self.assertEqual(out.forward_move, D(144))

    def test_long_forward_move_is_positive_when_price_rises(self) -> None:
        self.assertEqual(result(rising(25), "LONG", 2).forward_move, D(24))

    def test_long_forward_move_is_negative_when_price_falls(self) -> None:
        self.assertEqual(result([4100 - i for i in range(25)], "LONG", 2).forward_move, D(-24))

    def test_short_forward_move_is_positive_when_price_falls(self) -> None:
        self.assertEqual(result([4100 - i for i in range(25)], "SHORT", 2).forward_move, D(24))

    def test_short_forward_move_is_negative_when_price_rises(self) -> None:
        self.assertEqual(result(rising(25), "SHORT", 2).forward_move, D(-24))

    def test_neutral_and_stand_aside_forward_move_is_the_raw_change_up_or_down(self) -> None:
        for bias in ("NEUTRAL", "STAND_ASIDE"):
            self.assertEqual(result(rising(25), bias, 2).forward_move, D(24), bias)
            self.assertEqual(result([4100 - i for i in range(25)], bias, 2).forward_move, D(-24), bias)

    def test_long_adverse_excursion_is_the_reference_minus_the_lowest_low(self) -> None:
        closes = [4000] * 25
        out = result(closes, "LONG", 2, lows={10: 3990})  # lows are close - 1 = 3999 elsewhere
        self.assertEqual(out.adverse_excursion, D(10))

    def test_short_adverse_excursion_is_the_highest_high_minus_the_reference(self) -> None:
        closes = [4000] * 25
        out = result(closes, "SHORT", 2, highs={10: 4007})
        self.assertEqual(out.adverse_excursion, D(7))

    def test_long_adverse_excursion_never_goes_below_zero(self) -> None:
        closes = [4000] + [4100] * 24  # every later low is 4099, above the reference 4000
        self.assertEqual(result(closes, "LONG", 2).adverse_excursion, D(0))

    def test_short_adverse_excursion_never_goes_below_zero(self) -> None:
        closes = [4000] + [3900] * 24  # every later high is 3901, below the reference
        self.assertEqual(result(closes, "SHORT", 2).adverse_excursion, D(0))

    def test_neutral_adverse_excursion_is_the_larger_distance_to_either_extreme(self) -> None:
        closes = [4000] * 25
        down_further = result(closes, "NEUTRAL", 2, lows={5: 3980}, highs={6: 4010})
        self.assertEqual(down_further.adverse_excursion, D(20))
        up_further = result(closes, "STAND_ASIDE", 2, lows={5: 3990}, highs={6: 4030})
        self.assertEqual(up_further.adverse_excursion, D(30))

    def test_neutral_excursion_is_an_absolute_distance_even_when_the_window_stays_on_one_side(self) -> None:
        above = result([4000] + [4100] * 24, "NEUTRAL", 2)  # lows 4099, highs 4101: |4000-4099| = 99, |4101-4000| = 101
        self.assertEqual(above.adverse_excursion, D(101))
        below = result([4000] + [3900] * 24, "NEUTRAL", 2)  # lows 3899, highs 3901: |4000-3899| = 101, |3901-4000| = 99
        self.assertEqual(below.adverse_excursion, D(101))

    def test_the_move_and_the_excursion_come_from_the_same_occurrence(self) -> None:
        out = result(rising(25), "LONG", 2, lows={3: 3980})
        self.assertEqual(out, Outcome(forward_move=D(24), adverse_excursion=D(20)))

    def test_the_two_horizons_of_one_slot_differ(self) -> None:
        closes = rising(150)
        series = BarSeries(bars_from(closes))
        self.assertEqual(outcome_at(series, SLOT, "LONG", 2).forward_move, D(24))
        self.assertEqual(outcome_at(series, SLOT, "LONG", 12).forward_move, D(144))


class TheWindowTests(unittest.TestCase):
    """The window is the H bars after the reference bar, [T, T + H]."""

    def test_the_reference_bars_own_low_is_not_in_the_window(self) -> None:
        out = result([4000] * 25, "LONG", 2, lows={0: 3900})
        self.assertEqual(out.adverse_excursion, D(1))  # only the 3999 lows of bars 1 to 24

    def test_the_first_bar_after_the_reference_is_in_the_window(self) -> None:
        out = result([4000] * 25, "LONG", 2, lows={1: 3900})
        self.assertEqual(out.adverse_excursion, D(100))

    def test_the_horizon_bar_is_in_the_window(self) -> None:
        out = result([4000] * 25, "LONG", 2, lows={24: 3900})
        self.assertEqual(out.adverse_excursion, D(100))

    def test_the_bar_after_the_horizon_is_not_in_the_window(self) -> None:
        out = result([4000] * 26, "LONG", 2, lows={25: 3900})
        self.assertEqual(out.adverse_excursion, D(1))

    def test_short_window_edges(self) -> None:
        self.assertEqual(result([4000] * 25, "SHORT", 2, highs={0: 4100}).adverse_excursion, D(1))
        self.assertEqual(result([4000] * 25, "SHORT", 2, highs={1: 4100}).adverse_excursion, D(100))
        self.assertEqual(result([4000] * 25, "SHORT", 2, highs={24: 4100}).adverse_excursion, D(100))
        self.assertEqual(result([4000] * 26, "SHORT", 2, highs={25: 4100}).adverse_excursion, D(1))

    def test_twelve_hour_window_edges(self) -> None:
        self.assertEqual(result([4000] * 145, "LONG", 12, lows={144: 3900}).adverse_excursion, D(100))
        self.assertEqual(result([4000] * 146, "LONG", 12, lows={145: 3900}).adverse_excursion, D(1))
        self.assertEqual(result([4000] * 145, "LONG", 12, lows={25: 3900}).adverse_excursion, D(100))  # beyond the 2-hour window, inside the 12

    def test_the_bars_beyond_the_horizon_do_not_matter(self) -> None:
        a = result(rising(25), "LONG", 2)
        b = result(rising(25) + [3000, 3500, 5000], "LONG", 2)
        self.assertEqual(a, b)


class UnavailableTests(unittest.TestCase):
    def test_a_missing_reference_bar_is_reported_first(self) -> None:
        out = result(rising(25), "LONG", 2, skip=(0,))
        self.assertEqual(out, Unavailable(oc.NO_REFERENCE_BAR))

    def test_the_history_before_the_slot_is_not_a_reference(self) -> None:
        # bars start one bar later than the reference: the bar opened at T - 300 is absent, the one at T - 600 is not substituted
        series = BarSeries(bars_from(rising(30), first_open=REF_OPEN + 300))
        self.assertEqual(outcome_at(series, SLOT, "LONG", 2), Unavailable(oc.NO_REFERENCE_BAR))
        earlier = BarSeries(bars_from(rising(30), first_open=REF_OPEN - 300))
        self.assertIsInstance(outcome_at(earlier, SLOT, "LONG", 2), Outcome)  # a bar at T - 300 exists here
        # the bar at T - 600 exists but the one at T - 300 does not: nothing stands in for it
        holed = BarSeries(bars_from(rising(30), first_open=REF_OPEN - 300, skip=(1,)))
        self.assertEqual(outcome_at(holed, SLOT, "LONG", 2), Unavailable(oc.NO_REFERENCE_BAR))

    def test_a_missing_horizon_bar_is_reported_when_the_history_ends_early(self) -> None:
        self.assertEqual(result(rising(24), "LONG", 2), Unavailable(oc.NO_HORIZON_BAR))  # bars 0..23: the 24th after is missing
        self.assertEqual(result(rising(144), "LONG", 12), Unavailable(oc.NO_HORIZON_BAR))

    def test_the_horizon_is_checked_before_a_gap(self) -> None:
        out = result(rising(25), "LONG", 2, skip=(10, 24))
        self.assertEqual(out, Unavailable(oc.NO_HORIZON_BAR))

    def test_a_hole_in_the_window_is_reported_even_though_the_horizon_bar_exists(self) -> None:
        for hole in (1, 12, 23):
            self.assertEqual(result(rising(25), "LONG", 2, skip=(hole,)), Unavailable(oc.GAP_IN_WINDOW), hole)

    def test_a_closure_is_not_stretched_to_the_24th_bar_later(self) -> None:
        # a one-hour closure inside the window: the 24th bar AFTER the reference in the list exists, but it is 3 hours away
        closes = rising(40)
        series = BarSeries(bars_from(closes, skip=tuple(range(5, 17))))  # 12 bars (one hour) missing
        self.assertEqual(outcome_at(series, SLOT, "LONG", 2), Unavailable(oc.GAP_IN_WINDOW))

    def test_a_gap_outside_the_window_does_not_matter(self) -> None:
        out = result(rising(40), "LONG", 2, skip=(30, 31, 32))
        self.assertIsInstance(out, Outcome)

    def test_an_empty_history_has_no_reference(self) -> None:
        self.assertEqual(outcome_at(BarSeries([]), SLOT, "LONG", 2), Unavailable(oc.NO_REFERENCE_BAR))
        self.assertEqual(len(BarSeries([])), 0)


class ExactArithmeticTests(unittest.TestCase):
    def test_a_price_is_read_as_the_decimal_it_prints_as(self) -> None:
        bars = bars_from([D("4005.37")] + [D("4005.37")] * 23 + [D("4010.12")])
        out = outcome_at(BarSeries(bars), SLOT, "LONG", 2)
        self.assertEqual(out.forward_move, D("4.75"))  # in binary floats 4010.12 - 4005.37 is 4.7500000000000...

    def test_float_prices_give_the_same_exact_result(self) -> None:
        bars = [
            {"timestamp": REF_OPEN + 300 * i, "high": 4012.0, "low": 4000.0, "close": 4005.37 if i < 24 else 4010.12}
            for i in range(25)
        ]
        out = outcome_at(BarSeries(bars), SLOT, "LONG", 2)
        self.assertEqual(out.forward_move, D("4.75"))
        self.assertEqual(out.adverse_excursion, D("5.37"))

    def test_the_classic_binary_float_difference_is_exact(self) -> None:
        bars = [
            {"timestamp": REF_OPEN + 300 * i, "high": 1.0, "low": 0.05, "close": 0.1 if i < 24 else 0.3} for i in range(25)
        ]
        out = outcome_at(BarSeries(bars), SLOT, "LONG", 2)
        self.assertEqual(out.forward_move, D("0.2"))  # 0.3 - 0.1 is 0.19999999999999998 in binary floats
        self.assertEqual(out.adverse_excursion, D("0.05"))  # 0.1 - 0.05 is 0.05 exactly, not 0.05000000000000000277


class BarSeriesTests(unittest.TestCase):
    def good(self, **change) -> dict:
        return {"timestamp": REF_OPEN, "high": 4001, "low": 3999, "close": 4000, **change}

    def refuses(self, bars, *fragments: str) -> BarsError:
        with self.assertRaises(BarsError) as caught:
            BarSeries(bars)
        text = str(caught.exception)
        for fragment in fragments:
            self.assertIn(fragment, text)
        return caught.exception

    def test_a_good_series_holds_its_bars(self) -> None:
        series = BarSeries([self.good(), self.good(timestamp=REF_OPEN + 300)])
        self.assertEqual(len(series), 2)
        self.assertEqual(series.get(REF_OPEN).close, D(4000))
        self.assertIsNone(series.get(REF_OPEN + 600))

    def test_other_keys_are_ignored(self) -> None:
        series = BarSeries([self.good(open=3999.5, volume=12, tick_volume=3)])
        self.assertEqual(len(series), 1)

    def test_bars_must_ascend_strictly(self) -> None:
        self.refuses([self.good(timestamp=REF_OPEN + 300), self.good()], "bar 1", "not after the previous")
        self.refuses([self.good(), self.good()], "bar 1", "not after the previous")  # a duplicate

    def test_a_timestamp_must_be_an_integer_on_the_grid(self) -> None:
        self.refuses([self.good(timestamp=REF_OPEN + 1)], "bar 0", "5-minute grid")
        self.refuses([self.good(timestamp=float(REF_OPEN))], "timestamp is not an integer")
        self.refuses([self.good(timestamp=True)], "timestamp is not an integer")
        self.refuses([self.good(timestamp="1790000100")], "timestamp is not an integer")
        self.refuses([{"high": 1, "low": 1, "close": 1}], "timestamp is not an integer")

    def test_a_price_must_be_a_finite_number(self) -> None:
        for key in ("high", "low", "close"):
            for bad in (None, "4000", True, float("nan"), float("inf"), float("-inf"), [4000]):
                self.refuses([self.good(**{key: bad})], "bar 0", "not a")

    def test_a_missing_price_is_refused(self) -> None:
        bar = self.good()
        del bar["high"]
        self.refuses([bar], "not a number")

    def test_a_price_must_be_positive(self) -> None:
        self.refuses([self.good(low=0, close=0, high=1)], "not a positive price")
        self.refuses([self.good(low=-1, close=0, high=1)], "not a positive price")

    def test_low_close_high_must_be_in_order(self) -> None:
        self.refuses([self.good(high=3998)], "not in order")  # high below low
        self.refuses([self.good(close=4002)], "not in order")  # close above high
        self.refuses([self.good(close=3998)], "not in order")  # close below low
        BarSeries([self.good(high=4000, low=4000, close=4000)])  # a flat bar is fine

    def test_a_bar_that_is_not_a_mapping_is_refused(self) -> None:
        self.refuses([[REF_OPEN, 4001, 3999, 4000]], "bar 0: not a mapping")

    def test_every_problem_is_listed_up_to_twenty_and_then_counted(self) -> None:
        error = self.refuses([self.good(timestamp=REF_OPEN + 1 + 300 * i, close=None) for i in range(25)], "... and ")
        self.assertEqual(len(error.problems), 21)
        self.assertEqual(error.problems[-1], "... and " + str(50 - 20) + " more")  # two problems per bar: grid and close
        few = self.refuses([self.good(close=None), self.good(timestamp=REF_OPEN + 301)], "bar 0", "bar 1")
        self.assertEqual(len(few.problems), 2)
        self.assertEqual(oc.cap_problems(["a"] * 20), ("a",) * 20)
        self.assertEqual(oc.cap_problems(["a"] * 21)[-1], "... and 1 more")

    def test_a_decimal_price_is_accepted_and_an_integer_too(self) -> None:
        BarSeries([self.good(high=D("4001.5"), low=D("3999.25"), close=D("4000.75"))])
        BarSeries([self.good(high=4001, low=3999, close=4000)])

    def test_the_conversion_keeps_the_printed_value(self) -> None:
        self.assertEqual(oc.to_decimal(4005.37), D("4005.37"))
        self.assertEqual(oc.to_decimal(5), D(5))
        self.assertEqual(oc.to_decimal(D("1.10")), D("1.10"))
        for bad in (True, None, "1", float("nan"), float("inf"), D("NaN"), D("Infinity")):
            with self.assertRaises(ValueError, msg=repr(bad)):
                oc.to_decimal(bad)


class ArgumentTests(unittest.TestCase):
    def setUp(self) -> None:
        self.series = BarSeries(bars_from(rising(30)))

    def test_a_bias_outside_the_four_is_refused(self) -> None:
        for bad in (None, "long", "BUY", "", 1, True, ["LONG"]):
            with self.assertRaises(ValueError, msg=repr(bad)):
                outcome_at(self.series, SLOT, bad, 2)

    def test_a_horizon_outside_2_and_12_is_refused(self) -> None:
        for bad in (0, 1, 3, 24, True, "2", 2.0, None):
            with self.assertRaises(ValueError, msg=repr(bad)):
                outcome_at(self.series, SLOT, "LONG", bad)

    def test_a_slot_off_the_grid_or_not_an_integer_is_refused(self) -> None:
        for bad in (SLOT + 1, SLOT + 299, float(SLOT), True, "1790000100", None):
            with self.assertRaises(ValueError, msg=repr(bad)):
                outcome_at(self.series, bad, "LONG", 2)

    def test_a_bad_argument_is_an_error_but_missing_bars_are_not(self) -> None:
        self.assertIsInstance(outcome_at(BarSeries([]), SLOT, "LONG", 2), Unavailable)
        with self.assertRaises(ValueError):
            outcome_at(BarSeries([]), SLOT, "BUY", 2)  # checked before the data is looked at


class PropertyTests(unittest.TestCase):
    """Invariants over seeded random walks, for all four biases and both horizons."""

    def walk(self, rng: random.Random, count: int) -> list[dict]:
        price = D("4000.00")
        bars = []
        for i in range(count):
            step = D(rng.randint(-150, 150)) / 100
            close = max(D("1.00"), price + step)
            high = close + D(rng.randint(0, 80)) / 100
            low = max(D("0.50"), close - D(rng.randint(0, 80)) / 100)
            bars.append({"timestamp": REF_OPEN + 300 * i, "high": high, "low": low, "close": close})
            price = close
        return bars

    def test_the_excursion_is_never_negative_and_the_signs_mirror(self) -> None:
        rng = random.Random(7)
        for _ in range(40):
            bars = self.walk(rng, 150)
            series = BarSeries(bars)
            for hours in (2, 12):
                outs = {bias: outcome_at(series, SLOT, bias, hours) for bias in oc.BIASES}
                for bias, out in outs.items():
                    self.assertIsInstance(out, Outcome)
                    self.assertGreaterEqual(out.adverse_excursion, 0, bias)
                self.assertEqual(outs["SHORT"].forward_move, -outs["LONG"].forward_move)
                self.assertEqual(outs["NEUTRAL"], outs["STAND_ASIDE"])
                self.assertEqual(outs["NEUTRAL"].forward_move, outs["LONG"].forward_move)
                self.assertEqual(
                    outs["NEUTRAL"].adverse_excursion,
                    max(outs["LONG"].adverse_excursion, outs["SHORT"].adverse_excursion),
                )

    def test_the_forward_move_is_the_difference_of_the_two_closes_from_the_bars(self) -> None:
        rng = random.Random(11)
        bars = self.walk(rng, 150)
        series = BarSeries(bars)
        for hours, ahead in ((2, 24), (12, 144)):
            expected = bars[ahead]["close"] - bars[0]["close"]
            self.assertEqual(outcome_at(series, SLOT, "LONG", hours).forward_move, expected)

    def test_the_excursion_is_the_extreme_of_exactly_the_window_bars(self) -> None:
        rng = random.Random(13)
        bars = self.walk(rng, 150)
        series = BarSeries(bars)
        ref = bars[0]["close"]
        low = min(b["low"] for b in bars[1:25])
        high = max(b["high"] for b in bars[1:25])
        self.assertEqual(outcome_at(series, SLOT, "LONG", 2).adverse_excursion, max(D(0), ref - low))
        self.assertEqual(outcome_at(series, SLOT, "SHORT", 2).adverse_excursion, max(D(0), high - ref))

    def test_the_answer_does_not_depend_on_the_bars_outside_the_window(self) -> None:
        rng = random.Random(17)
        bars = self.walk(rng, 150)
        changed = [dict(b) for b in bars]
        for i in (26, 60, 149):  # beyond the 2-hour horizon: whatever happens there is not in the 2-hour outcome
            changed[i] = {**changed[i], "low": D("0.50"), "high": D("9999"), "close": changed[i]["close"]}
        for bias in oc.BIASES:
            self.assertEqual(
                outcome_at(BarSeries(bars), SLOT, bias, 2),
                outcome_at(BarSeries(changed), SLOT, bias, 2),
                bias,
            )


if __name__ == "__main__":
    unittest.main()
