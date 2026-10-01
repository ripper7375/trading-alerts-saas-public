"""The shared checks (T4-T12) run against a stub MCD on the two real cycles, and each check is shown
to catch the violation it exists for (a deliberately buggy stub)."""

import dataclasses
import tempfile
import unittest
from pathlib import Path

from mcd_common import envelope as env
from mcd_common import excel_fixture_provider as provider
from mcd_common import testing as t
from mcd_common.cycle_inputs import DATA_STATUSES

from . import stub_mcd
from .support import SETTINGS, real_inputs, real_inputs_with_report, synthetic_inputs


def sensor_for(name, evaluate=stub_mcd.evaluate):
    return t.SensorUnderTest(evaluate, real_inputs(name), stub_mcd.PARAMS, {}, ("M5",))


class SharedChecksOnV1(t.SharedSensorChecks, unittest.TestCase):
    def sensor(self):
        return sensor_for("v1")


class SharedChecksOnV4(t.SharedSensorChecks, unittest.TestCase):
    def sensor(self):
        return sensor_for("v4")


class StubOnRealCyclesTests(unittest.TestCase):
    """T13-style: one real cycle gives the expected state, and the stub itself is a valid MCD."""

    def test_v1_reading(self):
        e = stub_mcd.evaluate(real_inputs("v1"), stub_mcd.PARAMS, {})
        self.assertEqual((e["status"], e["status_reasons"]), ("VALID", []))
        self.assertEqual(e["last_closed_bar"], {"M5": "2026-09-18T20:50Z"})
        self.assertEqual(e["active_indicator"], {"M5": "best_fit_a"})
        self.assertEqual(e["details"]["populated_candidates"], {"M5": ["fractal"]})     # D3: listed, status stays VALID
        self.assertEqual([lv["name"] for lv in e["levels"]], ["UOEDT", "baseline", "LOEDT"])
        env.assert_valid(e)

    def test_v4_reading(self):
        e = stub_mcd.evaluate(real_inputs("v4"), stub_mcd.PARAMS, {})
        self.assertEqual((e["status"], e["active_indicator"]), ("VALID", {"M5": "cherry_a"}))
        env.assert_valid(e)

    def test_wording_and_size_of_the_stub_output(self):
        e = stub_mcd.evaluate(real_inputs("v1"), stub_mcd.PARAMS, {})
        t.assert_wording_clean(
            mcd_id="MCD9", state_codes=list(stub_mcd.STATES),
            templates={code: tpl for code, (_b, _s, tpl) in stub_mcd.STATES.items()},
            summaries=[(e["summary_line"], e["levels"])],
        )
        result = t.check_size([e])
        self.assertLessEqual(result.largest_tokens, 600)
        self.assertEqual(result.method, "o200k_base") if not result.pending else None


class ReplayT9Tests(unittest.TestCase):
    def test_stored_fixture_reproduces_its_envelope(self):
        inputs, report = real_inputs_with_report("v1", max_bars=100)
        envelope = stub_mcd.evaluate(inputs, stub_mcd.PARAMS, {})
        with tempfile.TemporaryDirectory() as tmp:
            provider.write_fixture_files(tmp, inputs, report, envelope)
            self.assertEqual(t.check_replay(stub_mcd.evaluate, stub_mcd.PARAMS, tmp), 1)
            path = Path(tmp) / "2026-09-18T2055Z.envelope.json"
            path.write_text(path.read_text(encoding="utf-8").replace("MCD9_", "MCD9_X"), encoding="utf-8")
            with self.assertRaises(AssertionError):
                t.check_replay(stub_mcd.evaluate, stub_mcd.PARAMS, tmp)

    def test_replay_needs_a_fixture(self):
        with tempfile.TemporaryDirectory() as tmp, self.assertRaises(AssertionError):
            t.check_replay(stub_mcd.evaluate, stub_mcd.PARAMS, tmp)


class EachSharedCheckCatchesItsViolationTests(unittest.TestCase):
    """Mutation checks on the checks themselves: a buggy evaluator must make the matching check fail."""

    def test_t4_catches_reading_the_forming_bar(self):
        with self.assertRaisesRegex(AssertionError, "T4"):
            t.check_forming_bar_ignored(sensor_for("v1", stub_mcd.evaluator_with_bug("reads_forming_bar")))

    def test_t5_catches_latest_available_statistics(self):
        with self.assertRaisesRegex(AssertionError, "T5"):
            t.check_wrong_slot_statistics(sensor_for("v1", stub_mcd.evaluator_with_bug("latest_stats")))

    def test_t6_catches_a_hard_coded_indicator(self):
        with self.assertRaisesRegex(AssertionError, "T6"):
            t.check_setting(sensor_for("v1", stub_mcd.evaluator_with_bug("ignores_setting")))

    def test_t7_catches_nondeterminism(self):
        with self.assertRaisesRegex(AssertionError, "T7"):
            t.check_determinism(sensor_for("v1", stub_mcd.evaluator_with_bug("nondeterministic")))

    def test_t8_catches_a_schema_break(self):
        broken = stub_mcd.evaluator_with_bug("schema_breaker")(real_inputs("v1"), stub_mcd.PARAMS, {})
        with self.assertRaises(AssertionError):
            t.check_schema(broken)

    def test_t10_catches_an_unguarded_exception(self):
        with self.assertRaisesRegex(AssertionError, "T10"):
            t.check_never_throws(sensor_for("v1", stub_mcd.evaluator_with_bug("raises")))

    def test_t10_catches_a_valid_reading_from_corrupted_data(self):
        def naive(inputs, params, upstream):      # never looks at anything, always VALID
            return env.valid("MCD9", "1.0.0", "2026-09-18T20:55Z", state_code="MCD9_A", bias="NEUTRAL", summary_line="s", commentary="c")

        with self.assertRaisesRegex(AssertionError, "T10"):
            t.check_never_throws(sensor_for("v1", naive))

    def test_t11_catches_banned_words_and_percent(self):
        with self.assertRaisesRegex(AssertionError, "T11"):
            t.assert_wording_clean(mcd_id="MCD3", state_codes=["MCD3_HIGH_CONVICTION_BUY_DIP"])
        with self.assertRaisesRegex(AssertionError, "T11"):
            t.assert_wording_clean(mcd_id="MCD3", templates={"T01": "Nested on 80% of bars"})

    def test_the_clean_stub_passes_every_check_on_both_cycles(self):
        for name in ("v1", "v4"):
            s = sensor_for(name)
            t.check_forming_bar_ignored(s)
            t.check_wrong_slot_statistics(s)
            t.check_setting(s)
            t.check_determinism(s)
            t.check_never_throws(s)
            t.check_time(s)

    def test_never_throws_decorator_makes_an_internal_error_pass_t10(self):
        """The unguarded stub fails T10; the same logic behind ``never_throws`` passes."""
        raising = stub_mcd.evaluator_with_bug("raises")
        guarded = env.never_throws("MCD9", "1.0.0")(raising)
        import logging

        with self.assertLogs("mcd", level=logging.ERROR):
            t.check_never_throws(sensor_for("v1", guarded))


class HelperTests(unittest.TestCase):
    def test_append_forming_bar_is_open_and_different(self):
        inputs = synthetic_inputs()
        changed = t.append_forming_bar(inputs, "M5")
        forming = changed.bars["M5"][-1]
        self.assertGreater(forming["close"], inputs.bars["M5"][-1]["close"])
        with self.assertRaises(ValueError):
            t.append_forming_bar(dataclasses.replace(inputs, bars={"M5": ()}), "M5")

    def test_corrupted_bundles_are_all_different_from_the_original(self):
        inputs = real_inputs("v1")
        bundles = t.corrupted_bundles(inputs, ("M5",))
        self.assertGreaterEqual(len(bundles), 8)
        for name, bundle in bundles.items():
            self.assertNotEqual(bundle, inputs, name)

    def test_t10_keeps_all_nine_corruptions_including_the_unknown_data_status(self):
        """G1: deleting a corruption from the list left every test green, and T10 would have stopped
        proving it in every MCD. The ninth (F4) is the one that went unpinned."""
        required = (
            "bars is None",
            "bar rows are strings",
            "last bar numbers are strings",
            "statistics is None",
            "statistics values are strings",
            "stats_slot is None",
            "active_indicator is None",
            "cycle_slot is garbage",
            "data_status is unknown",
        )
        bundles = t.corrupted_bundles(real_inputs("v1"), ("M5",))
        self.assertTrue(set(required) <= set(bundles), sorted(set(required) - set(bundles)))
        # The unknown value must really be unknown, or the corruption would pass as a fresh cycle.
        self.assertNotIn(bundles["data_status is unknown"].data_status, DATA_STATUSES)


if __name__ == "__main__":
    unittest.main()
