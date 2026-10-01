"""Pre-flight: fixed order, short-circuit, each tier's status and reason code, boundaries (T3-style)."""

import dataclasses
import unittest

from mcd_common import envelope as env
from mcd_common import preflight as pf
from mcd_common import reason_codes as rc
from mcd_common.cycle_inputs import DATA_STATUSES, channel_columns, slot_to_epoch, stats_slot_for, thaw
from mcd_common.testing import append_forming_bar

from .support import SLOT, synthetic_bars, synthetic_inputs

M5 = ("M5",)
SLOT_EPOCH = slot_to_epoch(SLOT)


def modified(inputs, **changes):
    return dataclasses.replace(inputs, **changes)


def with_stat(inputs, key=("M5", "best_fit_a"), **fields):
    stats = thaw(dict(inputs.statistics))
    stats[key] = {**stats[key], **fields}
    return modified(inputs, statistics=stats)


def with_last_bar(inputs, tf="M5", **fields):
    bars = thaw(inputs.bars)
    bars[tf][-1] = {**bars[tf][-1], **fields}
    return modified(inputs, bars=bars)


class RunnerTests(unittest.TestCase):
    def test_fixed_order_whatever_the_keyword_order(self):
        calls = []

        def tracer(name):
            def check(_inputs):
                calls.append(name)
                return pf.CheckResult(pf.PASS)

            return check

        outcome = pf.run_preflight(
            synthetic_inputs(),
            upstream=tracer("upstream"), tier3=tracer("tier3"), tier2=tracer("tier2"),
            tier4=tracer("tier4"), tier1=tracer("tier1"), cycle=tracer("cycle"),
        )
        self.assertEqual(calls, ["cycle", "tier1", "tier4", "tier2", "tier3", "upstream"])
        self.assertEqual((outcome.stop, outcome.status, outcome.reasons), (False, "VALID", ()))

    def test_first_failure_decides_and_later_checks_do_not_run(self):
        calls = []

        def make(name, result):
            def check(_inputs):
                calls.append(name)
                return result

            return check

        outcome = pf.run_preflight(
            synthetic_inputs(),
            tier1=make("tier1", pf.CheckResult(rc.INVALID, (rc.NO_SETTING,))),
            tier4=make("tier4", pf.CheckResult(rc.STALE, (rc.NO_STATS_AT_SLOT,))),
        )
        self.assertEqual(calls, ["tier1"])
        self.assertEqual((outcome.stop, outcome.status, outcome.reasons, outcome.failed_check), (True, "INVALID", ("NO_SETTING",), "tier1"))

    def test_cautionary_continues_and_its_reasons_stay_in_front_of_a_stopping_reason(self):
        outcome = pf.run_preflight(
            synthetic_inputs(retuning=True),
            tier1=lambda _i: pf.CheckResult(rc.CAUTIONARY, (rc.DETECTION_MISMATCH,)),
            tier4=lambda _i: pf.CheckResult(rc.STALE, (rc.NO_STATS_AT_SLOT,)),
        )
        self.assertEqual((outcome.status, outcome.reasons), ("STALE", ("RETUNING", "DETECTION_MISMATCH", "NO_STATS_AT_SLOT")))

    def test_all_cautionary_ends_cautionary_without_duplicates(self):
        outcome = pf.run_preflight(
            synthetic_inputs(retuning=True),
            tier1=lambda _i: pf.CheckResult(rc.CAUTIONARY, (rc.RETUNING, rc.DETECTION_MISMATCH)),
        )
        self.assertEqual((outcome.stop, outcome.status, outcome.reasons), (False, "CAUTIONARY", ("RETUNING", "DETECTION_MISMATCH")))

    def test_cycle_check_runs_by_default(self):
        outcome = pf.run_preflight(synthetic_inputs(data_status="STALE"))
        self.assertEqual((outcome.status, outcome.reasons, outcome.failed_check), ("STALE", ("DATA_STALE",), "cycle"))

    def test_unknown_status_is_a_programming_error(self):
        with self.assertRaises(ValueError):
            pf.run_preflight(synthetic_inputs(), tier1=lambda _i: pf.CheckResult("MAYBE"))

    def test_details_are_merged_for_the_evaluator(self):
        outcome = pf.run_preflight(synthetic_inputs(), tier1=pf.indicator_check(M5))
        self.assertEqual(outcome.details["populated_candidates"], {"M5": []})


class CycleCheckTests(unittest.TestCase):
    def test_stale_data_is_stale(self):
        result = pf.cycle_check()(synthetic_inputs(data_status="STALE"))
        self.assertEqual((result.status, result.reasons), ("STALE", ("DATA_STALE",)))

    def test_retuning_is_cautionary_and_continues(self):
        result = pf.cycle_check()(synthetic_inputs(retuning=True))
        self.assertEqual((result.status, result.reasons), ("CAUTIONARY", ("RETUNING",)))

    def test_stale_beats_retuning(self):
        result = pf.cycle_check()(synthetic_inputs(data_status="STALE", retuning=True))
        self.assertEqual(result.status, "STALE")

    def test_fresh_delayed_and_market_closed_pass(self):
        for status in ("FRESH", "DELAYED", "MARKET_CLOSED"):
            self.assertEqual(pf.cycle_check()(synthetic_inputs(data_status=status)).status, pf.PASS, status)

    def test_the_known_statuses_are_the_four_of_rule_7(self):
        self.assertEqual(DATA_STATUSES, ("FRESH", "DELAYED", "STALE", "MARKET_CLOSED"))

    def test_an_unknown_status_is_invalid_and_sanity_failed(self):
        """F4 (Davin, 2026-10-01): never evaluated as if fresh."""
        for bad in (None, "", "Stale", "stale", "FRESH ", "OPEN", 3, True, ["STALE"]):
            result = pf.cycle_check()(synthetic_inputs(data_status=bad))
            self.assertEqual((result.status, result.reasons), ("INVALID", ("SANITY_FAILED",)), repr(bad))
            self.assertEqual(result.details["problem"], "data_status", repr(bad))

    def test_an_unknown_status_stops_even_when_retuning(self):
        result = pf.cycle_check()(synthetic_inputs(data_status="Stale", retuning=True))
        self.assertEqual((result.status, result.reasons), ("INVALID", ("SANITY_FAILED",)))

    def test_an_unknown_status_stops_the_runner_before_every_later_check(self):
        calls = []

        def tier1(_inputs):
            calls.append("tier1")
            return pf.CheckResult(pf.PASS)

        outcome = pf.run_preflight(synthetic_inputs(data_status=None), tier1=tier1)
        self.assertEqual(calls, [])
        self.assertEqual(
            (outcome.stop, outcome.status, outcome.reasons, outcome.failed_check),
            (True, "INVALID", ("SANITY_FAILED",), "cycle"),
        )


class Tier1Tests(unittest.TestCase):
    def test_no_setting_is_invalid(self):
        result = pf.indicator_check(M5)(synthetic_inputs(active_indicator={}))
        self.assertEqual((result.status, result.reasons), ("INVALID", ("NO_SETTING",)))

    def test_a_setting_that_is_not_a_candidate_is_no_setting(self):
        for bad in ("fractal_edt", "non_b_typo", "", None):
            result = pf.indicator_check(M5)(synthetic_inputs(active_indicator={"M5": bad}))
            self.assertEqual((result.status, result.reasons), ("INVALID", ("NO_SETTING",)), repr(bad))

    def test_fractal_is_not_a_candidate_on_m15(self):
        result = pf.indicator_check(("M15",))(synthetic_inputs(active_indicator={"M15": "fractal"}))
        self.assertEqual(result.status, "INVALID")

    def test_set_indicator_populated_alone_passes(self):
        result = pf.indicator_check(M5)(synthetic_inputs())
        self.assertEqual((result.status, result.reasons), (pf.PASS, ()))
        self.assertEqual(result.details["populated_candidates"], {"M5": []})

    def test_d3_candidates_populated_alongside_are_listed_and_do_not_change_status(self):
        fractal = {"fractal_uoedt": 4060.0, "fractal_loedt": 3940.0, "fractal_best_fl": 4000.0}
        inputs = synthetic_inputs(bars={"M5": synthetic_bars("M5", last_open=SLOT_EPOCH - 300, count=60, extra=fractal)})
        result = pf.indicator_check(M5)(inputs)
        self.assertEqual((result.status, result.reasons), (pf.PASS, ()))
        self.assertEqual(result.details["populated_candidates"], {"M5": ["fractal"]})

    def test_d3_mismatch_set_indicator_empty_while_another_has_a_value(self):
        result = pf.indicator_check(M5)(synthetic_inputs(active_indicator={"M5": "non_b"}))
        self.assertEqual((result.status, result.reasons), ("CAUTIONARY", ("DETECTION_MISMATCH",)))
        self.assertEqual(result.details["populated_candidates"], {"M5": ["best_fit_a"]})

    def test_no_mismatch_when_nothing_at_all_is_populated(self):
        empty = synthetic_inputs(bars={"M5": [{"timestamp": SLOT_EPOCH - 300, "close": 1.0}]})
        result = pf.indicator_check(M5)(empty)
        self.assertEqual(result.status, pf.PASS)  # a later check reports the missing data

    def test_only_the_last_closed_bar_counts(self):
        """A forming bar with a populated candidate must not create a mismatch (R1)."""
        base = synthetic_inputs(active_indicator={"M5": "non_b"}, bars={"M5": [{"timestamp": SLOT_EPOCH - 300, "close": 1.0}]})
        forming = thaw(base.bars)
        forming["M5"].append({"timestamp": SLOT_EPOCH, "best_fit_a_uoedt": 1.0, "best_fit_a_loedt": 0.5, "best_fit_a_ssa": 0.7})
        result = pf.indicator_check(M5)(modified(base, bars=forming))
        self.assertEqual(result.status, pf.PASS)

    def test_mismatch_then_no_statistics_ends_stale_but_keeps_the_mismatch_reason(self):
        inputs = synthetic_inputs(active_indicator={"M5": "non_b"})
        outcome = pf.run_preflight(inputs, tier1=pf.indicator_check(M5), tier4=pf.statistics_check(M5))
        self.assertEqual((outcome.status, outcome.reasons), ("STALE", ("DETECTION_MISMATCH", "NO_STATS_AT_SLOT")))
        e = env.unavailable(outcome.status, "MCD9", "1.0.0", SLOT, list(outcome.reasons))
        self.assertEqual(env.schema_errors(e), [])


class Tier4Tests(unittest.TestCase):
    def test_row_at_the_slot_passes(self):
        self.assertEqual(pf.statistics_check(M5)(synthetic_inputs()).status, pf.PASS)

    def test_no_row_is_stale(self):
        result = pf.statistics_check(M5)(synthetic_inputs(statistics={}))
        self.assertEqual((result.status, result.reasons), ("STALE", ("NO_STATS_AT_SLOT",)))

    def test_a_row_from_another_slot_is_stale_never_latest_available(self):
        for delta in (-300, -900, 300):
            result = pf.statistics_check(M5)(with_stat(synthetic_inputs(), captured_at=SLOT_EPOCH + delta))
            self.assertEqual((result.status, result.reasons), ("STALE", ("NO_STATS_AT_SLOT",)), delta)

    def test_a_row_for_another_source_is_not_used(self):
        stats = {("M5", "non_b"): {"timeframe": "M5", "source": "non_b", "captured_at": SLOT_EPOCH, "containment_rate": 90.0}}
        self.assertEqual(pf.statistics_check(M5)(synthetic_inputs(statistics=stats)).status, "STALE")

    def test_missing_stats_slot_is_stale(self):
        self.assertEqual(pf.statistics_check(M5)(synthetic_inputs(stats_slot={})).status, "STALE")

    def test_strict_rule_has_no_replica_tolerance_m15_row_at_the_export_slot_is_stale(self):
        """Decision E1: the export-slot tolerance lives in the Excel provider only. Here, at slot
        20:55, M15 statistics must be captured at 20:45; a row stamped 20:55 is STALE."""
        row = {"timeframe": "M15", "source": "non_b", "captured_at": SLOT_EPOCH, "containment_rate": 90.0}
        base = synthetic_inputs(
            statistics={("M15", "non_b"): row}, active_indicator={"M15": "non_b"},
            stats_slot={"M5": SLOT, "M15": stats_slot_for(SLOT, "M15")},
        )
        self.assertEqual(base.stats_slot["M15"], "2026-09-18T20:45Z")
        self.assertEqual(pf.statistics_check(("M15",))(base).status, "STALE")
        ok = modified(base, statistics={("M15", "non_b"): {**row, "captured_at": slot_to_epoch("2026-09-18T20:45Z")}})
        self.assertEqual(pf.statistics_check(("M15",))(ok).status, pf.PASS)

    def test_fractal_uses_the_fractal_edt_source(self):
        row = {"timeframe": "M5", "source": "fractal_edt", "captured_at": SLOT_EPOCH, "containment_rate": 70.0}
        inputs = synthetic_inputs(statistics={("M5", "fractal_edt"): row}, active_indicator={"M5": "fractal"})
        self.assertEqual(pf.statistics_check(M5, min_containment=50.0)(inputs).status, pf.PASS)
        wrong_key = synthetic_inputs(statistics={("M5", "fractal"): row}, active_indicator={"M5": "fractal"})
        self.assertEqual(pf.statistics_check(M5)(wrong_key).status, "STALE")

    def test_containment_boundary_is_inclusive_at_50(self):
        cases = [(49.99, "INVALID", ("CONTAINMENT_LOW",)), (50.0, pf.PASS, ()), (50.01, pf.PASS, ()), (0.0, "INVALID", ("CONTAINMENT_LOW",))]
        for rate, status, reasons in cases:
            result = pf.statistics_check(M5, min_containment=50.0)(with_stat(synthetic_inputs(), containment_rate=rate))
            self.assertEqual((result.status, result.reasons), (status, reasons), rate)

    def test_containment_is_not_checked_unless_asked(self):
        self.assertEqual(pf.statistics_check(M5)(with_stat(synthetic_inputs(), containment_rate=1.0)).status, pf.PASS)

    def test_missing_or_non_numeric_containment_is_sanity_failed(self):
        for value in (None, "x", True):
            result = pf.statistics_check(M5, min_containment=50.0)(with_stat(synthetic_inputs(), containment_rate=value))
            self.assertEqual((result.status, result.reasons), ("INVALID", ("SANITY_FAILED",)), repr(value))

    def test_stale_row_is_reported_before_containment(self):
        result = pf.statistics_check(M5, min_containment=50.0)(
            with_stat(synthetic_inputs(), captured_at=SLOT_EPOCH - 300, containment_rate=1.0)
        )
        self.assertEqual(result.reasons, ("NO_STATS_AT_SLOT",))


class Tier2Tests(unittest.TestCase):
    def test_enough_bars_passes_at_exactly_the_window(self):
        inputs = synthetic_inputs(bars={"M5": synthetic_bars("M5", last_open=SLOT_EPOCH - 300, count=48)})
        self.assertEqual(pf.bars_check({"M5": 48})(inputs).status, pf.PASS)

    def test_one_bar_short_is_insufficient(self):
        inputs = synthetic_inputs(bars={"M5": synthetic_bars("M5", last_open=SLOT_EPOCH - 300, count=47)})
        result = pf.bars_check({"M5": 48})(inputs)
        self.assertEqual((result.status, result.reasons), ("INVALID", ("INSUFFICIENT_BARS",)))
        self.assertEqual((result.details["closed_bars"], result.details["needed"]), (47, 48))

    def test_a_forming_bar_does_not_count_towards_the_window(self):
        short = synthetic_inputs(bars={"M5": synthetic_bars("M5", last_open=SLOT_EPOCH - 300, count=47)})
        result = pf.bars_check({"M5": 48})(append_forming_bar(short, "M5"))
        self.assertEqual(result.reasons, ("INSUFFICIENT_BARS",))

    def test_missing_timeframe_is_insufficient(self):
        self.assertEqual(pf.bars_check({"M15": 10})(synthetic_inputs()).reasons, ("INSUFFICIENT_BARS",))

    def test_out_of_order_or_duplicate_timestamps_are_a_discontinuity(self):
        for mutate in (
            lambda b: b.__setitem__(-1, {**b[-1], "timestamp": b[-2]["timestamp"]}),              # duplicate
            lambda b: b.__setitem__(slice(-2, None), [b[-1], b[-2]]),                            # swapped
        ):
            bars = thaw(synthetic_inputs().bars)
            mutate(bars["M5"])
            result = pf.bars_check({"M5": 48})(synthetic_inputs(bars=bars))
            self.assertEqual((result.status, result.reasons), ("INVALID", ("DISCONTINUITY",)))

    def test_null_in_a_required_column_inside_the_window_is_a_discontinuity(self):
        for column in ("close", "best_fit_a_uoedt", "best_fit_a_ssa"):
            result = pf.bars_check({"M5": 48})(with_last_bar(synthetic_inputs(), **{column: None}))
            self.assertEqual((result.status, result.reasons), ("INVALID", ("DISCONTINUITY",)), column)

    def test_null_older_than_the_window_is_ignored(self):
        bars = thaw(synthetic_inputs().bars)
        bars["M5"][0]["close"] = None
        self.assertEqual(pf.bars_check({"M5": 48})(synthetic_inputs(bars=bars)).status, pf.PASS)  # 60 bars, window 48

    def test_non_numeric_timestamp_is_a_discontinuity(self):
        bars = thaw(synthetic_inputs().bars)
        bars["M5"][5]["timestamp"] = None
        self.assertEqual(pf.bars_check({"M5": 48})(synthetic_inputs(bars=bars)).reasons, ("DISCONTINUITY",))

    def test_required_columns_can_be_overridden(self):
        inputs = with_last_bar(synthetic_inputs(), best_fit_a_ssa=None)
        self.assertEqual(pf.bars_check({"M5": 48}, {"M5": ("close",)})(inputs).status, pf.PASS)

    def test_default_columns_follow_the_active_indicator(self):
        self.assertIn("fractal_uoedt", pf.default_required_columns("fractal"))
        self.assertNotIn("fractal_ssa", pf.default_required_columns("fractal"))
        self.assertIn("non_b_base_fl", pf.default_required_columns("non_b"))


class Tier3Tests(unittest.TestCase):
    def test_sane_channel_passes(self):
        self.assertEqual(pf.sanity_check(M5)(synthetic_inputs()).status, pf.PASS)

    def test_uoedt_must_be_strictly_above_loedt(self):
        cols = channel_columns("best_fit_a")
        for upper, lower in ((3950.0, 3950.0), (3900.0, 3950.0), (None, 3950.0), (4050.0, None), ("x", 3950.0)):
            result = pf.sanity_check(M5)(with_last_bar(synthetic_inputs(), **{cols["upper"]: upper, cols["lower"]: lower}))
            self.assertEqual((result.status, result.reasons), ("INVALID", ("SANITY_FAILED",)), (upper, lower))

    def test_channel_width_must_be_positive_when_present(self):
        for width in (0.0, -1.0, "x"):
            result = pf.sanity_check(M5)(with_stat(synthetic_inputs(), channel_width=width))
            self.assertEqual(result.reasons, ("SANITY_FAILED",), width)
        self.assertEqual(pf.sanity_check(M5)(with_stat(synthetic_inputs(), channel_width=None)).status, pf.PASS)

    def test_no_setting_is_reported_not_raised(self):
        self.assertEqual(pf.sanity_check(M5)(synthetic_inputs(active_indicator={})).reasons, ("NO_SETTING",))


class UpstreamTests(unittest.TestCase):
    @staticmethod
    def ups(**statuses):
        return {k: {"status": v} for k, v in statuses.items()}

    def run_check(self, required, upstream):
        return pf.upstream_check(required, upstream)(synthetic_inputs())

    def test_all_valid_passes(self):
        self.assertEqual(self.run_check(["MCD1", "MCD2"], self.ups(MCD1="VALID", MCD2="VALID")).status, pf.PASS)

    def test_missing_or_invalid_upstream_is_unavailable(self):
        for upstream in ({}, self.ups(MCD1="INVALID"), {"MCD1": None}, {"MCD1": {"status": "??"}}, {"MCD1": {}}):
            result = self.run_check(["MCD1"], upstream)
            self.assertEqual((result.status, result.reasons), ("INVALID", ("UPSTREAM_UNAVAILABLE:MCD1",)), upstream)

    def test_stale_upstream_is_stale(self):
        result = self.run_check(["MCD1"], self.ups(MCD1="STALE"))
        self.assertEqual((result.status, result.reasons), ("STALE", ("UPSTREAM_STALE:MCD1",)))

    def test_cautionary_upstream_continues_with_a_reason(self):
        result = self.run_check(["MCD1", "MCD2"], self.ups(MCD1="CAUTIONARY", MCD2="CAUTIONARY"))
        self.assertEqual((result.status, result.reasons), ("CAUTIONARY", ("UPSTREAM_CAUTIONARY:MCD1", "UPSTREAM_CAUTIONARY:MCD2")))

    def test_first_stopping_upstream_decides_and_earlier_cautions_stay(self):
        result = self.run_check(["MCD1", "MCD2"], self.ups(MCD1="CAUTIONARY", MCD2="STALE"))
        self.assertEqual((result.status, result.reasons), ("STALE", ("UPSTREAM_CAUTIONARY:MCD1", "UPSTREAM_STALE:MCD2")))
        result = self.run_check(["MCD2", "MCD1"], self.ups(MCD1="STALE", MCD2="INVALID"))
        self.assertEqual(result.reasons, ("UPSTREAM_UNAVAILABLE:MCD2",))

    def test_an_invalid_or_missing_upstream_after_a_cautionary_one_keeps_the_earlier_reason(self):
        """F6 (a): the CAUTIONARY reason of MCD1 is not dropped when MCD2 then stops the reading."""
        for upstream in (self.ups(MCD1="CAUTIONARY", MCD2="INVALID"), self.ups(MCD1="CAUTIONARY")):
            result = self.run_check(["MCD1", "MCD2"], upstream)
            self.assertEqual(
                (result.status, result.reasons), ("INVALID", ("UPSTREAM_CAUTIONARY:MCD1", "UPSTREAM_UNAVAILABLE:MCD2"))
            )
            e = env.invalid("MCD3", "2.0.0", SLOT, list(result.reasons))
            self.assertEqual(env.schema_errors(e), [])
            self.assertEqual(e["status_reasons"], ["UPSTREAM_CAUTIONARY:MCD1", "UPSTREAM_UNAVAILABLE:MCD2"])


class EveryFailureBuildsAValidEnvelopeTests(unittest.TestCase):
    """A stopped pre-flight must always be expressible as a schema-valid INVALID or STALE envelope."""

    def test_each_path(self):
        cases = {
            "cycle": (synthetic_inputs(data_status="STALE"), dict()),
            "cycle unknown status": (synthetic_inputs(data_status="Stale"), dict()),
            "tier1": (synthetic_inputs(active_indicator={}), dict(tier1=pf.indicator_check(M5))),
            "tier4 stale": (synthetic_inputs(statistics={}), dict(tier4=pf.statistics_check(M5))),
            "tier4 containment": (with_stat(synthetic_inputs(), containment_rate=10.0), dict(tier4=pf.statistics_check(M5, min_containment=50.0))),
            "tier2": (synthetic_inputs(bars={"M5": []}), dict(tier2=pf.bars_check({"M5": 48}))),
            "tier3": (with_stat(synthetic_inputs(), channel_width=0.0), dict(tier3=pf.sanity_check(M5))),
            "upstream": (synthetic_inputs(), dict(upstream=pf.upstream_check(["MCD1"], {}))),
        }
        for name, (inputs, checks) in cases.items():
            outcome = pf.run_preflight(inputs, **checks)
            self.assertTrue(outcome.stop, name)
            e = env.unavailable(outcome.status, "MCD9", "1.0.0", SLOT, list(outcome.reasons))
            self.assertEqual(env.schema_errors(e), [], name)


if __name__ == "__main__":
    unittest.main()
