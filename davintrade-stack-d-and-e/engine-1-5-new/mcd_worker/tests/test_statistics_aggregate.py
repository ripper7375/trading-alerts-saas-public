"""The summary of outcomes and the n >= 30 gate (build step 3, part 6; ADR-022, architecture section 2.8).

Quartile arithmetic against the standard library as an independent oracle, the gate at 29 and at 30 (alone, and through the whole path
with occurrences that have no outcome), series splitting, and a golden set of rows that the gateway's writer also reads
(``railway-gateway/test/sensors-state-statistics-writer.spec.ts``): regenerate it with ``WRITE_FIXTURES=yes``.
"""

from __future__ import annotations

import copy
import json
import math
import os
import random
import statistics as stdlib_statistics
import unittest
from decimal import Decimal as D
from pathlib import Path

from mcd_worker.statistics import (
    HORIZONS,
    MIN_SAMPLE,
    ROW_FIELDS,
    BarSeries,
    Outcome,
    SampleTooSmall,
    StatisticsError,
    aggregate_outcomes,
    compute_state_statistics,
    measured_metrics,
    quantile,
)
from mcd_worker.statistics import aggregate as ag
from mcd_worker.statistics import outcomes as oc

GOLDEN = Path(__file__).resolve().parent / "data" / "state-statistics.rows.json"
BASE = 1790000100  # unix UTC, on the 5-minute grid
METRICS = ag.METRIC_FIELDS


def made(moves, excursions=None) -> list[Outcome]:
    excursions = excursions if excursions is not None else [abs(m) for m in moves]
    return [Outcome(D(str(m)), D(str(e))) for m, e in zip(moves, excursions)]


class QuantileTests(unittest.TestCase):
    def test_known_quartiles(self) -> None:
        values = [D(v) for v in (1, 2, 3, 4, 5)]
        self.assertEqual([quantile(values, q) for q in (1, 2, 3)], [D(2), D(3), D(4)])
        values = [D(v) for v in (1, 2, 3, 4)]
        self.assertEqual([quantile(values, q) for q in (1, 2, 3)], [D("1.75"), D("2.5"), D("3.25")])

    def test_one_and_two_values(self) -> None:
        for q in (1, 2, 3):
            self.assertEqual(quantile([D("7.5")], q), D("7.5"))
        self.assertEqual([quantile([D(10), D(20)], q) for q in (1, 2, 3)], [D("12.5"), D(15), D("17.5")])

    def test_thirty_values_give_the_interpolated_quartiles(self) -> None:
        values = [D(v) for v in range(1, 31)]  # 1 .. 30
        self.assertEqual(quantile(values, 2), D("15.5"))
        self.assertEqual(quantile(values, 1), D("8.25"))  # position 29/4 = 7.25 -> 8 + 0.25 * (9 - 8)
        self.assertEqual(quantile(values, 3), D("22.75"))  # position 87/4 = 21.75 -> 22 + 0.75 * (23 - 22)

    def test_the_input_order_does_not_matter_and_the_input_is_not_changed(self) -> None:
        values = [D(v) for v in (5, 1, 4, 2, 3)]
        before = list(values)
        self.assertEqual(quantile(values, 1), D(2))
        self.assertEqual(values, before)
        self.assertEqual(quantile(iter(values), 3), D(4))  # any iterable

    def test_equal_values_give_that_value(self) -> None:
        self.assertEqual(quantile([D("3.3")] * 31, 1), D("3.3"))

    def test_it_agrees_with_the_standard_library_on_random_lists(self) -> None:
        rng = random.Random(2026)
        for _ in range(300):
            count = rng.randint(2, 90)
            values = [D(rng.randint(-5000, 5000)) / 100 for _ in range(count)]
            expected = stdlib_statistics.quantiles(values, n=4, method="inclusive")
            self.assertEqual([quantile(values, q) for q in (1, 2, 3)], expected, count)
            self.assertEqual(quantile(values, 2), stdlib_statistics.median(values), count)

    def test_it_is_monotone_in_the_quartile(self) -> None:
        rng = random.Random(3)
        for _ in range(100):
            values = [D(rng.randint(-99, 99)) for _ in range(rng.randint(1, 40))]
            q1, q2, q3 = (quantile(values, q) for q in (1, 2, 3))
            self.assertLessEqual(min(values), q1)
            self.assertLessEqual(q1, q2)
            self.assertLessEqual(q2, q3)
            self.assertLessEqual(q3, max(values))

    def test_bad_arguments(self) -> None:
        for bad in (0, 4, -1, True, 1.5, "2", None):
            with self.assertRaises(ValueError, msg=repr(bad)):
                quantile([D(1), D(2)], bad)
        with self.assertRaises(ValueError):
            quantile([], 2)


class TheGateTests(unittest.TestCase):
    def test_the_minimum_is_30_and_the_horizons_are_2_and_12(self) -> None:
        self.assertEqual(MIN_SAMPLE, 30)
        self.assertEqual(HORIZONS, (2, 12))

    def test_below_thirty_a_figure_cannot_be_computed(self) -> None:
        for count in (0, 1, 15, 29):
            with self.assertRaises(SampleTooSmall) as caught:
                measured_metrics(made(range(count)))
            self.assertEqual(caught.exception.n, count)
            self.assertIn(str(count), str(caught.exception))
            self.assertIn("30", str(caught.exception))
        self.assertTrue(issubclass(SampleTooSmall, StatisticsError))
        self.assertTrue(issubclass(StatisticsError, ValueError))

    def test_at_thirty_the_figures_exist(self) -> None:
        figures = measured_metrics(made(range(30)))
        for field in METRICS:
            if field != "opposing_level_rate":
                self.assertIsInstance(figures[field], float, field)

    def test_n_29_has_a_count_and_no_number(self) -> None:
        row = aggregate_outcomes(made(range(29)))
        self.assertEqual(row["n"], 29)
        for field in METRICS:
            self.assertIsNone(row[field], field)

    def test_n_30_has_every_figure_except_the_one_step_4_defines(self) -> None:
        row = aggregate_outcomes(made(range(30)))
        self.assertEqual(row["n"], 30)
        for field in METRICS:
            if field == "opposing_level_rate":
                self.assertIsNone(row[field])
            else:
                self.assertIsNotNone(row[field], field)

    def test_n_0_and_n_31(self) -> None:
        empty = aggregate_outcomes([])
        self.assertEqual(empty, {"n": 0, **dict.fromkeys(METRICS)})
        self.assertEqual(aggregate_outcomes(made(range(31)))["n"], 31)
        self.assertIsNotNone(aggregate_outcomes(made(range(31)))["forward_move_median"])

    def test_the_figures_of_thirty_known_outcomes(self) -> None:
        moves = list(range(-10, 20))  # -10 .. 19, in any order
        random.Random(5).shuffle(moves)
        excursions = [i / 4 for i in range(30)]  # 0 .. 7.25
        random.Random(6).shuffle(excursions)
        row = aggregate_outcomes(made(moves, excursions))
        self.assertEqual(row["forward_move_median"], 4.5)  # (4 + 5) / 2
        self.assertEqual(row["forward_move_q1"], -2.75)  # position 7.25: -3 + 0.25 * 1
        self.assertEqual(row["forward_move_q3"], 11.75)  # position 21.75: 11 + 0.75 * 1
        self.assertEqual(row["adverse_excursion_median"], 3.625)  # (3.5 + 3.75) / 2
        self.assertEqual(row["adverse_excursion_q3"], 5.4375)  # position 21.75: 5.25 + 0.75 * 0.25
        self.assertIsNone(row["opposing_level_rate"])

    def test_the_figures_are_each_taken_from_their_own_series_of_outcomes(self) -> None:
        # forward moves all 1, excursions all 9: swapping the two arrays would swap the figures
        row = aggregate_outcomes(made([1] * 30, [9] * 30))
        self.assertEqual((row["forward_move_median"], row["forward_move_q1"], row["forward_move_q3"]), (1.0, 1.0, 1.0))
        self.assertEqual((row["adverse_excursion_median"], row["adverse_excursion_q3"]), (9.0, 9.0))

    def test_the_opposing_level_rate_is_never_computed(self) -> None:
        self.assertIsNone(aggregate_outcomes(made(range(1000)))["opposing_level_rate"])
        self.assertIsNone(measured_metrics(made(range(30)))["opposing_level_rate"])

    def test_a_stored_figure_has_no_negative_zero_and_no_decimal(self) -> None:
        # 33 values: every quartile is an exact rank (positions 8, 16 and 24), so a stored -0.00 would come back as it is;
        # with 30 the quartiles are interpolated and the sum of two zeros is already +0
        row = aggregate_outcomes([Outcome(D("-0.00"), D("-0")) for _ in range(33)])
        for field in ("forward_move_median", "forward_move_q1", "forward_move_q3", "adverse_excursion_median", "adverse_excursion_q3"):
            self.assertEqual(row[field], 0.0, field)
            self.assertEqual(math.copysign(1.0, row[field]), 1.0, field)
            self.assertIs(type(row[field]), float, field)

    def test_quartiles_never_cross_whatever_the_outcomes(self) -> None:
        rng = random.Random(9)
        for _ in range(60):
            count = rng.randint(30, 80)
            moves = [rng.randint(-900, 900) / 100 for _ in range(count)]
            excursions = [rng.randint(0, 1500) / 100 for _ in range(count)]
            row = aggregate_outcomes(made(moves, excursions))
            self.assertLessEqual(row["forward_move_q1"], row["forward_move_median"])
            self.assertLessEqual(row["forward_move_median"], row["forward_move_q3"])
            self.assertLessEqual(row["adverse_excursion_median"], row["adverse_excursion_q3"])
            self.assertGreaterEqual(row["adverse_excursion_median"], 0)

    def test_a_row_has_exactly_the_documented_fields_in_order(self) -> None:
        self.assertEqual(
            ROW_FIELDS,
            (
                "mcd_id", "evaluator_version_series", "config_hash_key", "state_code", "horizon_hours", "n",
                "forward_move_median", "forward_move_q1", "forward_move_q3", "opposing_level_rate",
                "adverse_excursion_median", "adverse_excursion_q3",
            ),
        )  # fmt: skip
        self.assertEqual(tuple(aggregate_outcomes(made(range(30)))), ("n",) + METRICS)


# --------------------------------------------------------------------------- the whole path

SERIES = "2.0"
KEY = '{"best_fit_a":"h1"}'


def rising_bars(count: int, step: str = "0.25", start: str = "4005.00", skip: tuple[int, ...] = ()) -> list[dict]:
    """Bar i opens at BASE - 300 + 300 * i (bar 0 is the reference bar of an occurrence at BASE); each close is `step` above the last."""
    out = []
    for i in range(count):
        if i in skip:
            continue
        close = D(start) + D(step) * i
        out.append({"timestamp": BASE - 300 + 300 * i, "high": close + D("0.50"), "low": close - D("0.50"), "close": close})
    return out


def occurrence(slot_index: int, *, mcd="MCD2", series=SERIES, key=KEY, state="MCD2_CHANNEL_UP", bias="LONG") -> dict:
    return {
        "mcd_id": mcd,
        "evaluator_version_series": series,
        "config_hash_key": key,
        "state_code": state,
        "bias": bias,
        "slot": BASE + 300 * slot_index,
    }


def occurrences(first: int, count: int, **kw) -> list[dict]:
    return [occurrence(first + i, **kw) for i in range(count)]


class WholePathTests(unittest.TestCase):
    def rows(self, occs, bars, **kw) -> list[dict]:
        return compute_state_statistics(occs, bars, **kw)["rows"]

    def one(self, rows, horizon, **where) -> dict:
        found = [r for r in rows if r["horizon_hours"] == horizon and all(r[k] == v for k, v in where.items())]
        self.assertEqual(len(found), 1, (horizon, where))
        return found[0]

    def test_a_steady_rise_gives_the_same_move_for_every_occurrence(self) -> None:
        rows = self.rows(occurrences(0, 30), rising_bars(250))
        two = self.one(rows, 2)
        self.assertEqual(two["n"], 30)
        self.assertEqual((two["forward_move_q1"], two["forward_move_median"], two["forward_move_q3"]), (6.0, 6.0, 6.0))  # 24 bars x 0.25
        twelve = self.one(rows, 12)
        self.assertEqual(twelve["forward_move_median"], 36.0)  # 144 bars x 0.25

    def test_a_short_bias_turns_the_sign(self) -> None:
        rows = self.rows(occurrences(0, 30, bias="SHORT"), rising_bars(250))
        self.assertEqual(self.one(rows, 2)["forward_move_median"], -6.0)

    def test_n_30_through_the_whole_path_has_numbers_and_n_29_has_none(self) -> None:
        thirty = self.rows(occurrences(0, 30), rising_bars(250))
        twenty_nine = self.rows(occurrences(0, 29), rising_bars(250))
        self.assertEqual((self.one(thirty, 2)["n"], self.one(twenty_nine, 2)["n"]), (30, 29))
        self.assertIsNotNone(self.one(thirty, 2)["forward_move_median"])
        for field in METRICS:
            self.assertIsNone(self.one(twenty_nine, 2)[field], field)
            self.assertIsNone(self.one(twenty_nine, 12)[field], field)

    def test_an_occurrence_without_an_outcome_is_not_counted(self) -> None:
        bars = rising_bars(250)
        # 31 occurrences; the last one's 2-hour horizon bar (index 30 + 24 = 54) is removed: 30 of them have an outcome
        bars_one_short = [b for b in bars if b["timestamp"] != BASE - 300 + 300 * 54]
        rows = self.rows(occurrences(0, 31), bars_one_short)
        self.assertEqual(self.one(rows, 2)["n"], 30)
        self.assertIsNotNone(self.one(rows, 2)["forward_move_median"])
        # 30 occurrences with one missing: n = 29, no numbers, although 30 occurrences were seen
        rows = self.rows(occurrences(0, 30), [b for b in bars if b["timestamp"] != BASE - 300 + 300 * 53])
        self.assertEqual(self.one(rows, 2)["n"], 29)
        for field in METRICS:
            self.assertIsNone(self.one(rows, 2)[field], field)

    def test_the_two_horizons_have_their_own_n(self) -> None:
        # bars reach index 80: every 2-hour horizon bar (k + 24) exists for k <= 56, no 12-hour one (k + 144) does
        rows = self.rows(occurrences(0, 40), rising_bars(81))
        self.assertEqual(self.one(rows, 2)["n"], 40)
        self.assertEqual(self.one(rows, 12)["n"], 0)
        # bars reach index 170: 12-hour horizons exist for k <= 26 (k + 144 <= 170): 27 outcomes, below 30
        rows = self.rows(occurrences(0, 40), rising_bars(171))
        self.assertEqual(self.one(rows, 12)["n"], 27)
        self.assertIsNone(self.one(rows, 12)["forward_move_median"])
        self.assertIsNotNone(self.one(rows, 2)["forward_move_median"])

    def test_a_different_evaluator_series_is_a_different_row(self) -> None:
        occs = occurrences(0, 30, series="2.0") + occurrences(30, 12, series="2.1")
        rows = self.rows(occs, rising_bars(250), horizons=(2,))
        self.assertEqual(self.one(rows, 2, evaluator_version_series="2.0")["n"], 30)
        self.assertEqual(self.one(rows, 2, evaluator_version_series="2.1")["n"], 12)  # not 42: a MINOR change starts a new series
        self.assertIsNone(self.one(rows, 2, evaluator_version_series="2.1")["forward_move_median"])
        self.assertEqual(len(rows), 2)

    def test_the_same_series_text_is_one_row_whatever_the_patch(self) -> None:
        # the caller gives the series as MAJOR.MINOR: 2.0.0 and 2.0.1 are both "2.0" and so are one series
        rows = self.rows(occurrences(0, 20, series="2.0") + occurrences(20, 20, series="2.0"), rising_bars(250), horizons=(2,))
        self.assertEqual([r["n"] for r in rows], [40])

    def test_a_different_config_hash_is_a_different_row(self) -> None:
        other = '{"best_fit_a":"h2"}'
        rows = self.rows(occurrences(0, 30) + occurrences(30, 30, key=other), rising_bars(250), horizons=(2,))
        self.assertEqual(self.one(rows, 2, config_hash_key=KEY)["n"], 30)
        self.assertEqual(self.one(rows, 2, config_hash_key=other)["n"], 30)
        self.assertEqual(len(rows), 2)

    def test_a_different_mcd_or_state_is_a_different_row(self) -> None:
        occs = occurrences(0, 30) + occurrences(30, 5, mcd="MCD1", state="MCD1_TREND_UP") + occurrences(35, 6, state="MCD2_CHANNEL_DOWN", bias="SHORT")
        rows = self.rows(occs, rising_bars(250), horizons=(2,))
        self.assertEqual(
            sorted((r["mcd_id"], r["state_code"], r["n"]) for r in rows),
            [("MCD1", "MCD1_TREND_UP", 5), ("MCD2", "MCD2_CHANNEL_DOWN", 6), ("MCD2", "MCD2_CHANNEL_UP", 30)],
        )

    def test_the_rows_are_sorted_and_hold_exactly_the_row_fields(self) -> None:
        occs = occurrences(0, 3, mcd="MCD3", state="MCD3_X") + occurrences(3, 3, mcd="MCD1", state="MCD1_B") + occurrences(6, 3, mcd="MCD1", state="MCD1_A")
        result = compute_state_statistics(occs, rising_bars(250))
        keys = [(r["mcd_id"], r["evaluator_version_series"], r["config_hash_key"], r["state_code"], r["horizon_hours"]) for r in result["rows"]]
        self.assertEqual(keys, sorted(keys))
        self.assertEqual([k[3] for k in keys], ["MCD1_A", "MCD1_A", "MCD1_B", "MCD1_B", "MCD3_X", "MCD3_X"])
        for row in result["rows"]:
            self.assertEqual(tuple(row), ROW_FIELDS)

    def test_unavailable_outcomes_are_counted_by_reason(self) -> None:
        bars = rising_bars(60, skip=(40, 41))  # holes at 40 and 41
        # k = 0: reference 0, horizon 24: fine (40 and 41 are beyond). k = 17..40: the window k..k+24 includes 40 or 41
        result = compute_state_statistics(occurrences(0, 1) + occurrences(20, 1) + occurrences(41, 1) + occurrences(50, 1), bars, horizons=(2,))
        # k=0: ok. k=20: horizon index 44 exists, hole at 40 inside: GAP. k=41: the reference bar (index 41) is missing: NO_REFERENCE.
        # k=50: horizon index 74 does not exist: NO_HORIZON
        self.assertEqual(result["unavailable"], {"NO_REFERENCE_BAR": 1, "NO_HORIZON_BAR": 1, "GAP_IN_WINDOW": 1})
        self.assertEqual(result["occurrences"], 4)
        self.assertEqual(result["rows"][0]["n"], 1)

    def test_the_summary_counts_occurrences_and_every_reason_is_always_present(self) -> None:
        result = compute_state_statistics(occurrences(0, 3), rising_bars(250))
        self.assertEqual(result["occurrences"], 3)
        self.assertEqual(result["unavailable"], {"NO_REFERENCE_BAR": 0, "NO_HORIZON_BAR": 0, "GAP_IN_WINDOW": 0})
        self.assertEqual(set(result), {"rows", "occurrences", "unavailable"})

    def test_no_occurrences_give_no_rows(self) -> None:
        self.assertEqual(compute_state_statistics([], rising_bars(250))["rows"], [])
        self.assertEqual(compute_state_statistics([], [])["occurrences"], 0)

    def test_horizons_can_be_narrowed_and_repeats_are_ignored(self) -> None:
        self.assertEqual([r["horizon_hours"] for r in self.rows(occurrences(0, 3), rising_bars(250), horizons=(12,))], [12])
        self.assertEqual([r["horizon_hours"] for r in self.rows(occurrences(0, 3), rising_bars(250), horizons=[2, 2, 12, 2])], [2, 12])
        for bad in ((3,), (True,), (2.0,), ("2",)):
            with self.assertRaises(ValueError, msg=repr(bad)):
                compute_state_statistics(occurrences(0, 1), rising_bars(250), horizons=bad)

    def test_bars_may_be_given_as_a_series_or_a_list(self) -> None:
        bars = rising_bars(250)
        self.assertEqual(compute_state_statistics(occurrences(0, 30), bars), compute_state_statistics(occurrences(0, 30), BarSeries(bars)))

    def test_bad_bars_stop_the_run(self) -> None:
        bars = rising_bars(250)
        bars[10] = {**bars[10], "high": D("1.00")}
        with self.assertRaises(oc.BarsError):
            compute_state_statistics(occurrences(0, 30), bars)

    def test_one_group_must_have_one_bias(self) -> None:
        occs = occurrences(0, 29) + [occurrence(29, bias="SHORT")]
        with self.assertRaises(StatisticsError) as caught:
            compute_state_statistics(occs, rising_bars(250))
        self.assertIn("more than one bias: LONG, SHORT", str(caught.exception))
        self.assertIn("MCD2_CHANNEL_UP", str(caught.exception))

    def test_the_same_bias_under_two_neutral_names_is_still_two_biases(self) -> None:
        occs = occurrences(0, 5, bias="NEUTRAL") + occurrences(5, 5, bias="STAND_ASIDE")
        with self.assertRaises(StatisticsError):
            compute_state_statistics(occs, rising_bars(250))

    def test_one_mcd_has_one_reading_per_slot_in_a_series(self) -> None:
        occs = occurrences(0, 5) + [occurrence(2, state="MCD2_CHANNEL_DOWN", bias="SHORT")]
        with self.assertRaises(StatisticsError) as caught:
            compute_state_statistics(occs, rising_bars(250))
        self.assertIn("is read twice", str(caught.exception))
        self.assertIn("MCD2_CHANNEL_UP", str(caught.exception))
        self.assertIn("MCD2_CHANNEL_DOWN", str(caught.exception))
        compute_state_statistics(occurrences(0, 5) + occurrences(0, 5, series="2.1"), rising_bars(250))  # another series may read the same slot
        compute_state_statistics(occurrences(0, 5) + occurrences(0, 5, key='{"best_fit_a":"h2"}'), rising_bars(250))
        compute_state_statistics(occurrences(0, 5) + occurrences(0, 5, mcd="MCD1", state="MCD1_X"), rising_bars(250))

    def test_every_problem_in_the_occurrences_is_named(self) -> None:
        bad = [
            {**occurrence(0), "mcd_id": ""},
            {**occurrence(1), "bias": "BUY"},
            {**occurrence(2), "slot": BASE + 7},
            {k: v for k, v in occurrence(3).items() if k != "state_code"},
            "not a mapping",
            {**occurrence(5), "config_hash_key": None},
        ]
        with self.assertRaises(StatisticsError) as caught:
            compute_state_statistics(bad, rising_bars(250))
        problems = caught.exception.problems
        self.assertEqual(len(problems), 6)
        for position in range(6):
            self.assertTrue(any(p.startswith(f"occurrence {position}:") for p in problems), position)

    def test_a_long_list_of_problems_is_cut_after_twenty(self) -> None:
        bad = [{**occurrence(i), "bias": "BUY"} for i in range(25)]
        with self.assertRaises(StatisticsError) as caught:
            compute_state_statistics(bad, rising_bars(250))
        self.assertEqual(len(caught.exception.problems), 21)
        self.assertEqual(caught.exception.problems[-1], "... and 5 more")

    def test_a_bad_bias_and_a_bad_slot_in_one_occurrence_are_both_named(self) -> None:
        with self.assertRaises(StatisticsError) as caught:
            compute_state_statistics([{**occurrence(0), "bias": "BUY", "slot": BASE + 7}], rising_bars(250))
        self.assertEqual(len(caught.exception.problems), 2)
        self.assertTrue(any("bias must be" in p for p in caught.exception.problems))
        self.assertTrue(any("slot must be" in p for p in caught.exception.problems))

    def test_extra_keys_of_an_occurrence_are_ignored(self) -> None:
        extra = [{**o, "status": "CAUTIONARY", "evaluator_version": "2.0.1"} for o in occurrences(0, 30)]
        self.assertEqual(self.rows(extra, rising_bars(250)), self.rows(occurrences(0, 30), rising_bars(250)))

    def test_the_input_order_does_not_change_the_rows(self) -> None:
        occs = occurrences(0, 40) + occurrences(40, 35, state="MCD2_CHANNEL_DOWN", bias="SHORT") + occurrences(80, 10, mcd="MCD1", state="MCD1_Z", bias="NEUTRAL")
        shuffled = list(occs)
        random.Random(1).shuffle(shuffled)
        self.assertEqual(compute_state_statistics(occs, rising_bars(300)), compute_state_statistics(shuffled, rising_bars(300)))

    def test_the_inputs_are_not_changed_and_a_second_run_is_identical(self) -> None:
        occs, bars = occurrences(0, 40), rising_bars(250)
        occs_before, bars_before = copy.deepcopy(occs), copy.deepcopy(bars)
        first = compute_state_statistics(occs, bars)
        self.assertEqual((occs, bars), (occs_before, bars_before))
        self.assertEqual(json.dumps(first, sort_keys=True), json.dumps(compute_state_statistics(occs, bars), sort_keys=True))

    def test_the_result_is_plain_json(self) -> None:
        result = compute_state_statistics(occurrences(0, 40), rising_bars(250))
        self.assertEqual(json.loads(json.dumps(result)), result)


# --------------------------------------------------------------------------- the golden set

N_BARS = 420
CLOSURE = range(300, 306)  # a six-bar hole in the history


def lcg(seed: int):
    state = seed
    while True:
        state = (state * 1103515245 + 12345) & 0x7FFFFFFF
        yield state >> 8


def golden_bars() -> list[dict]:
    """A deterministic random walk in cents, no library randomness (its sequences are not promised across versions)."""
    draw = lcg(20261003)
    close = 400000
    bars = []
    for i in range(N_BARS):
        close = max(100000, close + next(draw) % 241 - 120)
        up, down = next(draw) % 61, next(draw) % 61
        if i in CLOSURE:
            continue
        bars.append(
            {"timestamp": BASE - 300 + 300 * i, "high": (close + up) / 100, "low": (close - down) / 100, "close": close / 100}
        )
    return bars


def golden_occurrences() -> list[dict]:
    occs: list[dict] = []
    up = '{"best_fit_a":"h1"}'
    occs += occurrences(0, 40, series="2.0", key=up)  # n 40 at both horizons
    occs += occurrences(50, 12, series="2.1", key=up)  # a MINOR change: its own series, below 30
    occs += occurrences(100, 31, series="2.0", key='{"best_fit_a":"h2"}')  # a retuned source: its own series, 31
    occs += occurrences(200, 30, series="2.0", key=up, state="MCD2_CHANNEL_DOWN", bias="SHORT")  # exactly 30 at 2 h
    occs += occurrences(240, 29, mcd="MCD3", series="2.0", key='{"best_fit_a":"h1","non_b":"h9"}', state="MCD3_ALIGNED_UP")  # 29 at 2 h
    occs += occurrences(330, 51, mcd="MCD1", series="2.0", key='{"non_b":"h9"}', state="MCD1_TREND_UP", bias="NEUTRAL")  # no 12 h horizon yet
    occs += occurrences(300, 6, mcd="MCD0", series="2.0", key="{}", state="MCD0_M5_DEFECT", bias="STAND_ASIDE")  # in the hole: no reference bar
    return occs


def golden_result() -> dict:
    return compute_state_statistics(golden_occurrences(), golden_bars())


class GoldenTests(unittest.TestCase):
    def test_the_scenario_has_the_counts_it_was_built_for(self) -> None:
        rows = {(r["mcd_id"], r["evaluator_version_series"], r["config_hash_key"], r["state_code"], r["horizon_hours"]): r for r in golden_result()["rows"]}
        up = '{"best_fit_a":"h1"}'
        n = {key: row["n"] for key, row in rows.items()}
        self.assertEqual(n[("MCD2", "2.0", up, "MCD2_CHANNEL_UP", 2)], 40)
        self.assertEqual(n[("MCD2", "2.0", up, "MCD2_CHANNEL_UP", 12)], 40)
        self.assertEqual(n[("MCD2", "2.1", up, "MCD2_CHANNEL_UP", 2)], 12)
        self.assertEqual(n[("MCD2", "2.0", '{"best_fit_a":"h2"}', "MCD2_CHANNEL_UP", 2)], 31)
        self.assertEqual(n[("MCD2", "2.0", up, "MCD2_CHANNEL_DOWN", 2)], 30)
        self.assertEqual(n[("MCD2", "2.0", up, "MCD2_CHANNEL_DOWN", 12)], 0)  # the hole is inside every 12 h window
        self.assertEqual(n[("MCD3", "2.0", '{"best_fit_a":"h1","non_b":"h9"}', "MCD3_ALIGNED_UP", 2)], 29)
        self.assertEqual(n[("MCD1", "2.0", '{"non_b":"h9"}', "MCD1_TREND_UP", 2)], 51)
        self.assertEqual(n[("MCD1", "2.0", '{"non_b":"h9"}', "MCD1_TREND_UP", 12)], 0)  # beyond the end of the history
        self.assertEqual(n[("MCD0", "2.0", "{}", "MCD0_M5_DEFECT", 2)], 0)
        self.assertEqual(len(rows), 14)
        measured = sorted(key for key, row in rows.items() if row["forward_move_median"] is not None)
        self.assertEqual(len(measured), 6)  # 40 at both horizons, 31 at both, 30 and 51 at 2 h: the others are provisional
        self.assertEqual(
            golden_result()["unavailable"], {"NO_REFERENCE_BAR": 12, "NO_HORIZON_BAR": 51, "GAP_IN_WINDOW": 59}
        )

    def test_the_engine_still_gives_the_stored_rows(self) -> None:
        result = golden_result()
        if os.environ.get("WRITE_FIXTURES") == "yes":
            GOLDEN.parent.mkdir(exist_ok=True)
            GOLDEN.write_text(json.dumps({"schema": "state-statistics-rows/1", "result": result}, indent=2) + "\n", encoding="utf-8", newline="\n")
        stored = json.loads(GOLDEN.read_text(encoding="utf-8"))
        self.assertEqual(stored["schema"], "state-statistics-rows/1")
        self.assertEqual(stored["result"], result)

    def test_the_stored_rows_are_what_the_gateway_writer_accepts(self) -> None:
        # the gateway's spec reads this same file; here only its shape is pinned
        stored = json.loads(GOLDEN.read_text(encoding="utf-8"))
        for row in stored["result"]["rows"]:
            self.assertEqual(tuple(row), ROW_FIELDS)
            if row["n"] < MIN_SAMPLE:
                for field in METRICS:
                    self.assertIsNone(row[field])


if __name__ == "__main__":
    unittest.main()
