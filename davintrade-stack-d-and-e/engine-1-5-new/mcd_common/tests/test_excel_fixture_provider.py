"""Excel fixture provider on the two real replica workbooks (v1, v4) plus synthetic edge cases."""

import dataclasses
import json
import tempfile
import unittest
from pathlib import Path

from mcd_common import envelope as env
from mcd_common import excel_fixture_provider as provider
from mcd_common import preflight as pf
from mcd_common.cycle_inputs import (
    TF_SECONDS,
    closed_bars,
    epoch_to_slot,
    last_closed_bar_slots,
    slot_to_epoch,
)

from .support import REPO_DIR, SETTINGS, SLOTS, WORKBOOKS, real_inputs, real_inputs_with_report, tables

LIVE_BAR_FIELDS = set(provider.LIVE_BAR_STATISTICS_FIELDS) | set(provider.LAST_PRICE_STATISTICS_FIELDS)


def ts(slot: str) -> int:
    return slot_to_epoch(slot)


class ClosedBarCutoffTests(unittest.TestCase):
    def test_v1_cuts_at_m5_20_50_and_m15_20_30_for_slot_20_55(self):
        inputs, report = real_inputs_with_report("v1")
        self.assertEqual(inputs.cycle_slot, "2026-09-18T20:55Z")
        self.assertEqual(last_closed_bar_slots(inputs, ("M5", "M15")), {"M5": "2026-09-18T20:50Z", "M15": "2026-09-18T20:30Z"})
        by_tf = {c.timeframe: c for c in report.cutoffs}
        self.assertEqual((by_tf["M5"].last_closed_bar, by_tf["M5"].forming_bar), ("2026-09-18T20:50Z", "2026-09-18T20:55Z"))
        self.assertEqual((by_tf["M15"].last_closed_bar, by_tf["M15"].forming_bar), ("2026-09-18T20:30Z", "2026-09-18T20:45Z"))
        self.assertEqual((by_tf["M5"].sheet_rows, by_tf["M5"].closed_bars), (3000, 2999))
        self.assertEqual((by_tf["M15"].sheet_rows, by_tf["M15"].closed_bars), (3000, 2999))

    def test_v4_cuts_at_m5_23_10_and_m15_23_00_for_slot_23_15(self):
        inputs = real_inputs("v4")
        self.assertEqual(inputs.cycle_slot, "2026-09-28T23:15Z")
        self.assertEqual(last_closed_bar_slots(inputs, ("M5", "M15")), {"M5": "2026-09-28T23:10Z", "M15": "2026-09-28T23:00Z"})

    def test_every_bar_in_the_bundle_is_closed_and_ascending(self):
        for name in ("v1", "v4"):
            inputs = real_inputs(name, max_bars=None)
            for tf in ("M5", "M15"):
                stamps = [b["timestamp"] for b in inputs.bars[tf]]
                self.assertEqual(stamps, sorted(set(stamps)), (name, tf))
                self.assertTrue(all(t + TF_SECONDS[tf] <= ts(inputs.cycle_slot) for t in stamps), (name, tf))
                self.assertEqual(len(closed_bars(inputs, tf)), len(stamps))

    def test_forming_bar_is_appended_only_on_request_and_still_not_read(self):
        plain = real_inputs("v1")
        with_forming = real_inputs("v1", include_forming_bar=True)
        self.assertEqual(with_forming.bars["M5"][-1]["timestamp"], ts("2026-09-18T20:55Z"))
        self.assertEqual(with_forming.bars["M15"][-1]["timestamp"], ts("2026-09-18T20:45Z"))
        self.assertEqual(len(with_forming.bars["M5"]), len(plain.bars["M5"]) + 1)
        for tf in ("M5", "M15"):
            self.assertEqual(closed_bars(with_forming, tf), closed_bars(plain, tf))

    def test_max_bars_and_columns_trim_the_bundle(self):
        inputs = real_inputs("v1", max_bars={"M5": 10, "M15": 4}, columns=["close", "best_fit_a_uoedt"])
        self.assertEqual((len(inputs.bars["M5"]), len(inputs.bars["M15"])), (10, 4))
        self.assertEqual(set(inputs.bars["M5"][0]), {"timestamp", "close", "best_fit_a_uoedt"})
        self.assertEqual(epoch_to_slot(inputs.bars["M5"][-1]["timestamp"]), "2026-09-18T20:50Z")

    def test_storage_and_wall_clock_columns_are_dropped(self):
        inputs = real_inputs("v1")
        for column in provider.DROPPED_BAR_COLUMNS:
            self.assertNotIn(column, inputs.bars["M5"][-1])
        self.assertIn("best_fit_a_uoedt", inputs.bars["M5"][-1])


class StatisticsAtTheSlotTests(unittest.TestCase):
    def test_stats_slot_v1_m15_is_20_45_and_v4_is_23_15(self):
        self.assertEqual(dict(real_inputs("v1").stats_slot), {"M5": "2026-09-18T20:55Z", "M15": "2026-09-18T20:45Z"})
        self.assertEqual(dict(real_inputs("v4").stats_slot), {"M5": "2026-09-28T23:15Z", "M15": "2026-09-28T23:15Z"})

    def test_accepted_rows_and_their_recorded_capture_time(self):
        inputs = real_inputs("v1")
        self.assertEqual(
            sorted(inputs.statistics),
            [("M15", "non_b"), ("M15", "sr_levels"), ("M5", "best_fit_a"), ("M5", "fractal_edt"), ("M5", "resistance"), ("M5", "support")],
        )
        # E1: recorded as captured at stats_slot[tf], although the workbook stamps 20:55
        self.assertEqual(inputs.statistics[("M15", "non_b")]["captured_at"], ts("2026-09-18T20:45Z"))
        self.assertEqual(inputs.statistics[("M5", "best_fit_a")]["captured_at"], ts("2026-09-18T20:55Z"))
        original = {(r["timeframe"], r["source"]): r for r in tables("v1").statistics}
        self.assertEqual(original[("M15", "non_b")]["captured_at"], ts("2026-09-18T20:55Z"))

    def test_live_bar_fields_are_absent_from_every_statistics_row(self):
        for name in ("v1", "v4"):
            for key, row in real_inputs(name).statistics.items():
                self.assertEqual(LIVE_BAR_FIELDS & set(row), set(), (name, key))
        self.assertIn("regression_angle", real_inputs("v1").statistics[("M15", "non_b")])
        self.assertIn("channel_width", real_inputs("v1").statistics[("M15", "non_b")])
        self.assertIn("containment_rate", real_inputs("v1").statistics[("M5", "best_fit_a")])

    def test_config_hash_and_channel_mode(self):
        inputs = real_inputs("v1")
        self.assertEqual(inputs.config_hash["non_b"][:10], "dbae8aa661")
        self.assertEqual(dict(inputs.channel_mode), {"best_fit_a": "dynamic", "fractal_edt": "dynamic", "non_b": "dynamic"})
        frozen = real_inputs("v1", channel_mode={"non_b": "frozen"})
        self.assertEqual(frozen.channel_mode["non_b"], "frozen")

    def test_setting_comes_from_the_file(self):
        self.assertEqual(dict(real_inputs("v1").active_indicator), {"M5": "best_fit_a", "M15": "non_b"})
        self.assertEqual(dict(real_inputs("v4").active_indicator), {"M5": "cherry_a", "M15": "non_b"})

    def test_cycle_flags_default_and_override(self):
        inputs = real_inputs("v1")
        self.assertEqual((inputs.data_status, inputs.retuning, inputs.symbol), ("FRESH", False, "XAUUSD"))
        other = real_inputs("v1", data_status="STALE", retuning=True)
        self.assertEqual((other.data_status, other.retuning), ("STALE", True))


class DecisionD3OnRealDataTests(unittest.TestCase):
    def test_v1_populated_alongside_is_listed_and_status_stays_valid(self):
        result = pf.indicator_check(("M5", "M15"))(real_inputs("v1"))
        self.assertEqual((result.status, result.reasons), (pf.PASS, ()))
        self.assertEqual(result.details["populated_candidates"], {"M5": ["fractal"], "M15": []})

    def test_v4_two_populated_m15_indicators_resolve_through_the_setting(self):
        result = pf.indicator_check(("M5", "M15"))(real_inputs("v4"))
        self.assertEqual((result.status, result.reasons), (pf.PASS, ()))
        self.assertEqual(result.details["populated_candidates"], {"M5": ["fractal"], "M15": ["non_a"]})

    def test_a_setting_the_data_contradicts_is_a_mismatch(self):
        for name, tf, wrong in (("v1", "M5", "cherry_a"), ("v1", "M15", "non_a"), ("v4", "M5", "best_fit_a")):
            inputs = real_inputs(name)
            settings = dict(inputs.active_indicator, **{tf: wrong})
            result = pf.indicator_check((tf,))(dataclasses.replace(inputs, active_indicator=settings))
            self.assertEqual((result.status, result.reasons), ("CAUTIONARY", ("DETECTION_MISMATCH",)), (name, tf))

    def test_full_preflight_is_valid_on_both_real_cycles(self):
        for name in ("v1", "v4"):
            inputs = real_inputs(name)
            outcome = pf.run_preflight(
                inputs,
                tier1=pf.indicator_check(("M5", "M15")),
                tier4=pf.statistics_check(("M5", "M15"), min_containment=50.0),
                tier2=pf.bars_check({"M5": 48, "M15": 96}),
                tier3=pf.sanity_check(("M5", "M15")),
            )
            self.assertEqual((outcome.stop, outcome.status, outcome.reasons), (False, "VALID", ()), name)


class ReplicaToleranceE1Tests(unittest.TestCase):
    """Decision E1: accept a row when captured_at == export slot AND live_bar_ts == stats_slot[tf];
    a row failing either condition is dropped and the tier-4 check reports STALE + NO_STATS_AT_SLOT."""

    def altered(self, timeframe, source, **fields):
        base = tables("v1")
        rows = [dict(r, **fields) if (r["timeframe"], r["source"]) == (timeframe, source) else r for r in base.statistics]
        return dataclasses.replace(base, statistics=rows)

    def build(self, tbl, **kwargs):
        return provider.build_cycle_inputs_with_report(tbl, SETTINGS["v1"], max_bars=60, **kwargs)

    def tier4(self, inputs, tf):
        return pf.statistics_check((tf,))(inputs)

    def decision(self, report, tf, source):
        return next(d for d in report.decisions if (d.timeframe, d.source) == (tf, source))

    def test_positive_control_both_conditions_hold(self):
        inputs, report = self.build(tables("v1"))
        for tf in ("M5", "M15"):
            self.assertEqual(self.tier4(inputs, tf).status, pf.PASS)
        self.assertTrue(self.decision(report, "M15", "non_b").accepted)
        self.assertIn("recorded as captured at 2026-09-18T20:45Z", self.decision(report, "M15", "non_b").reason)

    def test_captured_at_other_than_the_export_slot_is_dropped_and_stale(self):
        for tf, source, active in (("M15", "non_b", "M15"), ("M5", "best_fit_a", "M5")):
            for shift in (-300, -900, 300):
                tbl = self.altered(tf, source, captured_at=ts("2026-09-18T20:55Z") + shift)
                inputs, report = self.build(tbl)
                self.assertNotIn((tf, source), inputs.statistics, (tf, shift))
                self.assertFalse(self.decision(report, tf, source).accepted)
                self.assertIn("is not the export slot", self.decision(report, tf, source).reason)
                result = self.tier4(inputs, active)
                self.assertEqual((result.status, result.reasons), ("STALE", ("NO_STATS_AT_SLOT",)), (tf, shift))

    def test_captured_at_equal_to_stats_slot_but_not_the_export_slot_is_dropped_literal_e1(self):
        """A workbook stamped strictly at 20:45 for M15 fails E1's first condition. Recorded as found:
        say so if such replicas should be accepted too."""
        tbl = self.altered("M15", "non_b", captured_at=ts("2026-09-18T20:45Z"))
        inputs, _ = self.build(tbl)
        self.assertEqual(self.tier4(inputs, "M15").reasons, ("NO_STATS_AT_SLOT",))

    def test_live_bar_ts_other_than_stats_slot_is_dropped_and_stale(self):
        cases = (
            ("M15", "non_b", "2026-09-18T20:30Z"), ("M15", "non_b", "2026-09-18T20:55Z"),   # M15 wants 20:45
            ("M5", "best_fit_a", "2026-09-18T20:50Z"), ("M5", "best_fit_a", "2026-09-18T20:45Z"),  # M5 wants 20:55
        )
        for tf, source, live in cases:
            inputs, report = self.build(self.altered(tf, source, live_bar_ts=ts(live)))
            self.assertNotIn((tf, source), inputs.statistics, (tf, live))
            self.assertIn("is not stats_slot", self.decision(report, tf, source).reason)
            result = self.tier4(inputs, tf)
            self.assertEqual((result.status, result.reasons), ("STALE", ("NO_STATS_AT_SLOT",)), (tf, live))

    def test_missing_live_bar_ts_is_dropped(self):
        inputs, _ = self.build(self.altered("M15", "non_b", live_bar_ts=None))
        self.assertEqual(self.tier4(inputs, "M15").reasons, ("NO_STATS_AT_SLOT",))

    def test_asking_for_another_slot_than_the_export_slot_drops_every_row(self):
        inputs, report = self.build(tables("v1"), slot="2026-09-18T20:50Z")
        self.assertEqual(dict(inputs.statistics), {})
        self.assertFalse(any(d.accepted for d in report.decisions))
        self.assertEqual(self.tier4(inputs, "M5").reasons, ("NO_STATS_AT_SLOT",))

    def test_two_accepted_rows_for_one_key_make_the_fixture_ambiguous(self):
        base = tables("v1")
        twin = next(dict(r) for r in base.statistics if (r["timeframe"], r["source"]) == ("M15", "non_b"))
        with self.assertRaises(ValueError):
            self.build(dataclasses.replace(base, statistics=base.statistics + [twin]))

    def test_the_tolerance_is_not_in_the_evaluator_side_check(self):
        """The strict rule of the PostgreSQL provider: a row stamped with the export slot does not
        match an M15 stats_slot of 20:45, so tier 4 alone would call it STALE."""
        inputs = real_inputs("v1")
        stamped = {k: dict(v) for k, v in inputs.statistics.items()}
        stamped[("M15", "non_b")]["captured_at"] = ts("2026-09-18T20:55Z")
        self.assertEqual(pf.statistics_check(("M15",))(dataclasses.replace(inputs, statistics=stamped)).reasons, ("NO_STATS_AT_SLOT",))

    def test_only_the_excel_provider_mentions_live_bar_ts(self):
        """The tolerance reads live_bar_ts; no other kit module (evaluator-side helpers, envelope, ...)
        may. Guards 'keep this tolerance inside excel_fixture_provider.py only'."""
        kit = Path(provider.__file__).parent
        offenders = [
            p.name for p in sorted(kit.glob("*.py"))
            if p.name != "excel_fixture_provider.py" and "live_bar_ts" in p.read_text(encoding="utf-8")
        ]
        self.assertEqual(offenders, [])


class SyntheticTableTests(unittest.TestCase):
    def synthetic_tables(self):
        def bar(tf, t, close=100.0):
            return {"symbol": "XAUUSD", "timeframe": tf, "timestamp": t, "close": close, "id": "x", "cycle_id": 3}

        base = ts("2026-09-18T20:55Z")
        m5 = [bar("M5", base - 300 * i) for i in range(5, -2, -1)]       # 20:30 .. 20:55 plus 21:00 (future)
        m5[0], m5[1] = m5[1], m5[0]                                        # unsorted
        m15 = [bar("M15", ts("2026-09-18T20:45Z") - 900 * i) for i in range(3, -1, -1)]
        stats = [
            {"symbol": "XAUUSD", "timeframe": "M5", "source": "best_fit_a", "captured_at": base, "live_bar_ts": base, "config_hash": "h"},
            {"symbol": "EURUSD", "timeframe": "M5", "source": "best_fit_a", "captured_at": base, "live_bar_ts": base},
        ]
        return provider.WorkbookTables("mem.xlsx", "0" * 64, {"M5": m5, "M15": m15}, stats)

    def build(self, **kwargs):
        setting = provider.settings_from_dict(
            {"slot": "2026-09-18T20:55Z", "active_indicator": {"M5": "best_fit_a", "M15": "non_b"}}
        )
        return provider.build_cycle_inputs_with_report(self.synthetic_tables(), setting, **kwargs)

    def test_rows_are_sorted_future_rows_dropped_other_symbols_ignored(self):
        inputs, report = self.build()
        stamps = [b["timestamp"] for b in inputs.bars["M5"]]
        self.assertEqual(stamps, sorted(stamps))
        self.assertEqual(epoch_to_slot(stamps[-1]), "2026-09-18T20:50Z")     # 20:55 forming, 21:00 in the future
        self.assertEqual(list(inputs.statistics), [("M5", "best_fit_a")])    # EURUSD row ignored
        self.assertEqual(report.cutoffs[0].forming_bar, "2026-09-18T20:55Z")
        self.assertNotIn("id", inputs.bars["M5"][0])
        self.assertNotIn("cycle_id", inputs.bars["M5"][0])

    def test_settings_validation(self):
        good = {"slot": "2026-09-18T20:55Z", "active_indicator": {"M5": "fractal", "M15": "non_a"}}
        self.assertEqual(provider.settings_from_dict(good).active_indicator["M5"], "fractal")
        for change in (
            {"active_indicator": {"M5": "fractal", "M15": "fractal"}},   # no fractal on M15
            {"active_indicator": {"M5": "fractal"}},                      # M15 missing
            {"active_indicator": {"M5": "fractal_edt", "M15": "non_a"}},  # statistics name, not an indicator
            {"active_indicator": "best_fit_a"},
            {"slot": "2026-09-18T20:57Z"},
        ):
            with self.assertRaises(ValueError, msg=str(change)):
                provider.settings_from_dict({**good, **change})

    def test_the_settings_files_match_decision_d2(self):
        v1 = provider.load_settings(SETTINGS["v1"])
        v4 = provider.load_settings(SETTINGS["v4"])
        self.assertEqual((v1.slot, dict(v1.active_indicator)), (SLOTS["v1"], {"M5": "best_fit_a", "M15": "non_b"}))
        self.assertEqual((v4.slot, dict(v4.active_indicator)), (SLOTS["v4"], {"M5": "cherry_a", "M15": "non_b"}))


class FixtureFilesTests(unittest.TestCase):
    def test_write_and_replay_round_trip(self):
        inputs, report = real_inputs_with_report("v1", max_bars=60)
        envelope = env.stale("MCD9", "1.0.0", inputs.cycle_slot, ["NO_STATS_AT_SLOT"])
        with tempfile.TemporaryDirectory() as tmp:
            written = provider.write_fixture_files(tmp, inputs, report, envelope, base_dir=REPO_DIR / "davintrade-stack-d-and-e")
            names = sorted(p.name for p in written)
            self.assertEqual(names, ["2026-09-18T2055Z.envelope.json", "2026-09-18T2055Z.inputs.json", "2026-09-18T2055Z.source.md"])
            self.assertTrue(all(":" not in n for n in names))
            again = provider.load_inputs(Path(tmp) / "2026-09-18T2055Z.inputs.json")
            self.assertEqual(again, inputs)
            self.assertEqual(json.loads((Path(tmp) / "2026-09-18T2055Z.envelope.json").read_text(encoding="utf-8")), json.loads(env.canonical_json(envelope)))

    def test_source_md_records_workbook_sha_cutoffs_and_the_e1_reason(self):
        inputs, report = real_inputs_with_report("v1", max_bars=60)
        text = provider.render_source_md(report, base_dir=REPO_DIR / "davintrade-stack-d-and-e")
        self.assertIn(provider.file_sha256(WORKBOOKS["v1"]), text)
        self.assertIn("`engine-1-5-new/market_data_v6_replicated.xlsx`", text)
        self.assertIn("decision E1", text)
        self.assertIn("captured_at` equals the export slot", text)
        self.assertIn("`live_bar_ts` equals `stats_slot[tf]`", text)
        self.assertIn("NO_STATS_AT_SLOT", text)
        self.assertIn("| M15 | non_b | 2026-09-18T20:55Z | 2026-09-18T20:45Z | accepted", text)
        self.assertIn("2026-09-18T20:30Z", text)   # last closed M15 bar
        self.assertIn("M15 `2026-09-18T20:45Z`", text)

    def test_source_md_shows_a_dropped_row_with_its_reason(self):
        base = tables("v1")
        rows = [dict(r, live_bar_ts=ts("2026-09-18T20:30Z")) if (r["timeframe"], r["source"]) == ("M15", "non_b") else r for r in base.statistics]
        _inputs, report = provider.build_cycle_inputs_with_report(dataclasses.replace(base, statistics=rows), SETTINGS["v1"], max_bars=10)
        text = provider.render_source_md(report)
        self.assertIn("dropped: live_bar_ts 2026-09-18T20:30Z is not stats_slot[M15] 2026-09-18T20:45Z", text)

    def test_slot_file_stem_has_no_colon(self):
        self.assertEqual(provider.slot_file_stem("2026-09-28T23:15Z"), "2026-09-28T2315Z")


if __name__ == "__main__":
    unittest.main()
