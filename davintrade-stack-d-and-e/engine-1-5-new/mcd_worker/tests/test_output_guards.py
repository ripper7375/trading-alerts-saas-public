"""The output guards (architecture 2.2 rule 5, "Done when" items 1 and 8 of section 2.11).

A reading that fails a guard is replaced by INVALID with ``EVALUATOR_ERROR`` and is never saved as it came.
"""

from __future__ import annotations

import copy
import json
import unittest
from typing import Any

from mcd_common import envelope as env
from mcd_common import reason_codes as rc

from mcd_worker import guards
from mcd_worker.tests import support as s

SLOT = "2026-09-18T20:55Z"


def sensor():
    return s.sensor(
        "MCD2", "independent", s.stub("MCD2"), timeframes=("M5",), uses_channel=("M5",),
        states={"MCD2_UP": "LONG", "MCD2_DOWN": "SHORT"},
    )


def good(**changes: Any) -> dict[str, Any]:
    base = env.canonical(
        env.valid(
            "MCD2", s.VERSION, SLOT, state_code="MCD2_UP", bias="LONG", summary_line="Corridor up", commentary="Price sits inside the corridor.",
            levels=[{"name": "UOEDT", "tf": "M5", "price": 4384.28}], regime_status="TREND_ALIGNED_CONTINUATION",
            details={"note": "fine", "n": 3, "inner": {"list": ["a", "b"]}},
        )
    )
    base.update(changes)
    return base


def problems(envelope: Any) -> list[str]:
    return guards.envelope_problems(envelope, sensor(), s.tiny_inputs())


class CleanTests(unittest.TestCase):
    def test_a_good_reading_has_no_problem(self) -> None:
        self.assertEqual(problems(good()), [])

    def test_a_good_cautionary_reading_has_no_problem(self) -> None:
        reading = env.canonical(
            env.cautionary("MCD2", s.VERSION, SLOT, [rc.DETECTION_MISMATCH, "MCD0_DEFECT_M5"], state_code="MCD2_DOWN", bias="SHORT", summary_line="x", commentary="y")
        )
        self.assertEqual(problems(reading), [])

    def test_good_unavailable_readings_have_no_problem(self) -> None:
        for status, code in ((rc.INVALID, rc.SANITY_FAILED), (rc.STALE, rc.NO_STATS_AT_SLOT)):
            reading = env.canonical(env.unavailable(status, "MCD2", s.VERSION, SLOT, [code]))
            self.assertEqual(problems(reading), [], status)

    def test_the_stored_real_readings_pass_every_guard(self) -> None:
        for name in s.SLOTS:
            result = s.real_worker().run_cycle(s.bundle(name))
            for r in result.results:
                self.assertEqual(
                    guards.envelope_problems(r.envelope, s.real_worker().registry[r.mcd_id], s.bundle(name)), [], (name, r.mcd_id)
                )

    def test_every_stored_per_mcd_envelope_passes_its_guards(self) -> None:
        for name in s.SLOTS:
            for mcd_id, folder in (("MCD0", "mcd0"), ("MCD3", "mcd3")):
                text = (s.ENGINE / folder / "fixtures" / f"{s.stem(name)}.envelope.json").read_text(encoding="utf-8")
                self.assertEqual(guards.envelope_problems(json.loads(text), s.real_worker().registry[mcd_id], s.bundle(name)), [], (name, mcd_id))


class SchemaTests(unittest.TestCase):
    def test_each_schema_breach_is_reported(self) -> None:
        cases = {
            "an extra top-level field": good(surprise=1),
            "a summary over 80 characters": good(summary_line="x" * 81),
            "a missing field": {k: v for k, v in good().items() if k != "details"},
            "a VALID reading with no state": good(state_code=None),
            "a state code that is not MCDn_": good(state_code="STATE_UP"),
            "a bias outside the four": good(bias="BUY"),
            "levels with an extra key": good(levels=[{"name": "UOEDT", "tf": "M5", "price": 1.0, "colour": "red"}]),
            "a timeframe outside M5 and M15": good(levels=[{"name": "UOEDT", "tf": "H1", "price": 1.0}]),
            "an INVALID reading with a state": good(status="INVALID", status_reasons=[rc.SANITY_FAILED]),
        }
        for label, envelope in cases.items():
            found = problems(envelope)
            self.assertTrue(any(p.startswith("SCHEMA:") for p in found), f"{label}: {found}")

    def test_things_that_are_not_envelopes_are_reported_and_never_raise(self) -> None:
        for junk in (None, 5, "text", [], [good()], b"bytes", object()):
            found = problems(junk)
            self.assertEqual(len(found), 1, repr(junk))
            self.assertTrue(found[0].startswith("SCHEMA: the evaluator returned "), repr(junk))
            self.assertIn("not a mapping", found[0])

    def test_values_that_cannot_be_serialised_are_reported(self) -> None:
        for bad in (float("nan"), float("inf"), {1, 2}, b"x", object()):
            found = problems(good(details={"x": bad}))
            self.assertTrue(any("cannot be serialised" in p for p in found), repr(bad))


class IdentityTests(unittest.TestCase):
    def test_a_reading_that_names_the_wrong_mcd_version_slot_or_dependencies(self) -> None:
        cases = {
            "mcd_id": good(mcd_id="MCD1", state_code="MCD1_UP"),
            "evaluator_version": good(evaluator_version="9.9.9"),
            "cycle_slot": good(cycle_slot="2026-09-18T21:00Z"),
            "depends_on": good(depends_on=["MCD1"]),
        }
        for field, envelope in cases.items():
            found = problems(envelope)
            self.assertTrue(any(p.startswith(f"IDENTITY: {field} ") for p in found), f"{field}: {found}")

    def test_a_derived_sensor_must_name_its_dependencies_in_every_reading(self) -> None:
        derived = s.sensor("MCD3", "derived", s.mcd3_stub(), depends_on=("MCD1", "MCD2"), states={"MCD3_AGREE_UP": "LONG"})
        reading = env.canonical(env.unavailable(rc.INVALID, "MCD3", s.VERSION, SLOT, [rc.EVALUATOR_ERROR]))  # depends_on []
        found = guards.envelope_problems(reading, derived, s.tiny_inputs())
        self.assertTrue(any(p.startswith("IDENTITY: depends_on") for p in found), found)


class ReasonTests(unittest.TestCase):
    def test_each_reason_defect_is_reported(self) -> None:
        cases = {
            "an unknown code": good(status="CAUTIONARY", status_reasons=["TOO_SCARY"]),
            "a VALID reading with a reason": good(status_reasons=[rc.RETUNING]),
            "a CAUTIONARY reading with an INVALID code": good(status="CAUTIONARY", status_reasons=[rc.RETUNING, rc.SANITY_FAILED]),
            "an INVALID reading with only CAUTIONARY codes": good(
                status="INVALID", status_reasons=[rc.RETUNING], state_code=None, bias=None, regime_status=None, levels=[]
            ),
            "a STALE reading with an INVALID code": good(
                status="STALE", status_reasons=[rc.SANITY_FAILED], state_code=None, bias=None, regime_status=None, levels=[]
            ),
        }
        for label, envelope in cases.items():
            found = problems(envelope)
            self.assertTrue(any(p.startswith("REASONS:") for p in found), f"{label}: {found}")

    def test_an_upstream_code_is_known_and_a_malformed_one_is_not(self) -> None:
        reading = env.canonical(env.cautionary("MCD2", s.VERSION, SLOT, ["UPSTREAM_CAUTIONARY:MCD1"], state_code="MCD2_UP", bias="LONG", summary_line="x", commentary="y"))
        self.assertEqual(problems(reading), [])
        bad = copy.deepcopy(reading)
        bad["status_reasons"] = ["UPSTREAM_CAUTIONARY:MCD99"]
        self.assertTrue(any(p.startswith("REASONS: 'UPSTREAM_CAUTIONARY:MCD99' is not a reason code") for p in problems(bad)), problems(bad))

    def test_a_reasons_field_that_is_not_a_list_is_reported(self) -> None:
        found = problems(good(status_reasons="RETUNING"))
        self.assertIn("REASONS: status_reasons is not a list", found)
        self.assertTrue(any(p.startswith("SCHEMA:") for p in found), found)


class RegisterTests(unittest.TestCase):
    def test_a_state_outside_the_register_is_reported(self) -> None:
        found = problems(good(state_code="MCD2_SIDEWAYS_UP"))
        self.assertTrue(any("REGISTER: state 'MCD2_SIDEWAYS_UP' is not in the register of MCD2" in p for p in found), found)

    def test_a_bias_other_than_the_registers_is_reported(self) -> None:
        found = problems(good(bias="SHORT"))
        self.assertEqual(found, ["REGISTER: bias of MCD2_UP is 'SHORT', the register says 'LONG'"])

    def test_an_unavailable_reading_needs_no_register_entry(self) -> None:
        reading = env.canonical(env.unavailable(rc.STALE, "MCD2", s.VERSION, SLOT, [rc.NO_STATS_AT_SLOT]))
        self.assertEqual(problems(reading), [])


class WordingTests(unittest.TestCase):
    """No percentage or confidence word in any output unless it comes from ``state_statistics`` (item 8)."""

    def test_a_banned_word_in_any_text_is_reported(self) -> None:
        for field in ("summary_line", "commentary"):
            for text in ("High conviction setup", "This is safe", "A sure thing", "Probability is high", "Confidence grade A", "It is guaranteed"):
                found = problems(good(**{field: text}))
                self.assertTrue(any(p.startswith("WORDING:") and field in p for p in found), f"{field} {text!r}: {found}")

    def test_the_inflected_forms_the_kit_lists_are_caught_too(self) -> None:
        for text in ("Convictions grow", "He is confident", "Graded A", "Safer here", "Probabilities rise"):
            self.assertTrue(any(p.startswith("WORDING:") for p in problems(good(commentary=text))), text)

    def test_a_percent_sign_is_reported_wherever_it_hides(self) -> None:
        cases = {
            "summary": good(summary_line="Up 5%"),
            "commentary": good(commentary="Inside the band 75% of the time"),
            "details": good(details={"note": "contained 80%"}),
            "nested details": good(details={"a": {"b": ["x", "60% of bars"]}}),
            "a level name": good(levels=[{"name": "UOEDT 50%", "tf": "M5", "price": 1.0}]),
        }
        for label, envelope in cases.items():
            found = problems(envelope)
            self.assertTrue(any("contains '%'" in p for p in found), f"{label}: {found}")

    def test_a_spelled_out_percent_is_reported_wherever_it_hides(self) -> None:
        """The twin of the sign test: "70 percent" says what "70%" says (session B finding F5)."""
        cases = {
            "summary": good(summary_line="Up 70 percent"),
            "commentary": good(commentary="Inside the band 75 percent of the time"),
            "details": good(details={"note": "contained 80 percent"}),
            "nested details": good(details={"a": {"b": ["x", "60 percent of bars"]}}),
            "a level name": good(levels=[{"name": "UOEDT 50 percent", "tf": "M5", "price": 1.0}]),
            "capitals": good(commentary="PERCENT of bars"),
            "the long word": good(commentary="A percentage of the bars"),
            "the plural": good(commentary="Two percentages are shown"),
            "joined by a hyphen": good(commentary="A percent-based gap"),
        }
        for label, envelope in cases.items():
            found = problems(envelope)
            self.assertTrue(any("contains the percentage word" in p for p in found), f"{label}: {found}")

    def test_the_report_names_the_word_that_was_found(self) -> None:
        self.assertEqual(
            problems(good(commentary="Up 70 Percent")), ["WORDING: commentary contains the percentage word 'percent'"]
        )
        self.assertEqual(
            problems(good(summary_line="A percentage")), ["WORDING: summary_line contains the percentage word 'percentage'"]
        )

    def test_a_text_is_reported_once_however_often_the_word_appears(self) -> None:
        self.assertEqual(len(problems(good(commentary="70 percent and 80 percent, a percentage"))), 1)

    def test_words_that_only_start_with_percent_are_not_reported(self) -> None:
        for text in ("The percentile rank is steady", "A percentless gap", "The 5th percentile", "Percentual"):
            self.assertEqual(problems(good(commentary=text)), [], text)

    def test_a_banned_word_inside_details_is_reported(self) -> None:
        found = problems(good(details={"zone": {"label": "high conviction"}}))
        self.assertTrue(any("details.zone.label contains the banned word CONVICTION" in p for p in found), found)

    def test_a_regime_word_with_a_banned_word_is_reported(self) -> None:
        found = problems(good(regime_status="HIGH_CONVICTION_TREND"))
        self.assertTrue(any(p.startswith("WORDING: regime_status") for p in found), found)

    def test_a_banned_word_joined_to_others_by_underscores_is_reported(self) -> None:
        """A regime word is a code: the banned word is one of its underscore-separated parts, which plain text matching misses."""
        found = problems(good(regime_status="TREND_CONVICTION"))
        self.assertIn("WORDING: regime_status contains the banned word CONVICTION", found)

    def test_ordinary_words_that_contain_a_banned_one_are_not_reported(self) -> None:
        for text in ("The gradient is steady", "Measure the upgrade", "Pressure builds", "The corridor is wide"):
            self.assertEqual(problems(good(commentary=text)), [], text)

    def test_numbers_and_prices_in_text_are_not_a_problem(self) -> None:
        self.assertEqual(problems(good(commentary="The latest corridor [4350.22, 4384.28] holds 973 of 1037 bars.")), [])

    def test_advice_words_are_left_to_the_mcds_own_tests(self) -> None:
        self.assertEqual(problems(good(commentary="The channel holds above the baseline")), [])


class ReplacementTests(unittest.TestCase):
    def test_the_replacement_is_invalid_with_evaluator_error_and_the_registrys_dependencies(self) -> None:
        derived = s.sensor("MCD3", "derived", s.mcd3_stub(), depends_on=("MCD1", "MCD2"), states={"MCD3_AGREE_UP": "LONG"})
        reading = guards.replacement(derived, s.tiny_inputs())
        self.assertEqual((reading["status"], reading["status_reasons"], reading["depends_on"]), ("INVALID", ["EVALUATOR_ERROR"], ["MCD1", "MCD2"]))
        self.assertEqual(env.schema_errors(reading), [])
        self.assertEqual(guards.envelope_problems(reading, derived, s.tiny_inputs()), [])
        self.assertIsNone(reading["state_code"])
        self.assertIsNone(reading["bias"])
        self.assertEqual(reading["levels"], [])

    def test_the_replacement_is_valid_for_every_real_sensor(self) -> None:
        for mcd_id, real in s.real_worker().registry.items():
            reading = guards.replacement(real, s.bundle("v1"))
            self.assertEqual(guards.envelope_problems(reading, real, s.bundle("v1")), [], mcd_id)
            self.assertEqual(reading["depends_on"], list(real.depends_on), mcd_id)

    def test_the_kit_fallback_is_recognised_and_other_invalid_readings_are_not(self) -> None:
        fallback = env.never_throws("MCD2", s.VERSION)(lambda i, p, u: 1 / 0)
        with self.assertLogs("mcd", level="ERROR"):
            produced = fallback(s.tiny_inputs(), None, {})
        self.assertTrue(guards.is_kit_fallback(produced))
        for other in (
            env.unavailable(rc.INVALID, "MCD2", s.VERSION, SLOT, [rc.SANITY_FAILED]),
            env.unavailable(rc.INVALID, "MCD2", s.VERSION, SLOT, [rc.EVALUATOR_ERROR], depends_on=("MCD1",)),
            env.unavailable(rc.INVALID, "MCD2", s.VERSION, SLOT, [rc.EVALUATOR_ERROR], details={"why": "x"}),
            env.unavailable(rc.INVALID, "MCD2", s.VERSION, SLOT, [rc.EVALUATOR_ERROR], last_closed_bar={"M5": "2026-09-18T20:50Z"}),
            env.unavailable(rc.STALE, "MCD2", s.VERSION, SLOT, [rc.NO_STATS_AT_SLOT]),
            {"status": "INVALID"},
            None,
        ):
            self.assertFalse(guards.is_kit_fallback(other), other)

    def test_an_evaluator_error_reading_with_details_of_its_own_is_kept(self) -> None:
        def own_error(inputs, params, upstream):
            return env.unavailable(rc.INVALID, "MCD2", s.VERSION, inputs.cycle_slot, [rc.EVALUATOR_ERROR], details={"why": "kept"})

        result = s.synthetic_worker(s.synthetic_sensors(mcd2=own_error)).run_cycle(s.tiny_inputs()).by_id()["MCD2"]
        self.assertEqual(result.envelope["details"], {"why": "kept"})
        self.assertEqual(result.guard_problems, ())


class ThroughTheRunnerTests(unittest.TestCase):
    """What the runner saves when an evaluator hands back something it must not."""

    def run_with(self, **sensors):
        with self.assertLogs("mcd.worker", level="ERROR") as logs:
            result = s.synthetic_worker(s.synthetic_sensors(**sensors)).run_cycle(s.tiny_inputs())
        return result.by_id(), logs

    def assertReplaced(self, results, mcd_id: str, prefix: str) -> None:
        r = results[mcd_id]
        self.assertEqual((r.status, r.envelope["status_reasons"]), (rc.INVALID, [rc.EVALUATOR_ERROR]), mcd_id)
        self.assertTrue(r.guard_problems and r.guard_problems[0].startswith(prefix), (mcd_id, r.guard_problems))
        self.assertEqual(env.schema_errors(r.envelope), [])

    def test_a_reading_that_breaks_the_schema_is_never_saved(self) -> None:
        def evaluate(inputs, params, upstream):
            reading = s.reading("MCD2", inputs.cycle_slot, state="MCD2_UP", bias="LONG")
            reading["surprise"] = 1
            return reading

        results, _ = self.run_with(mcd2=evaluate)
        self.assertReplaced(results, "MCD2", "SCHEMA:")

    def test_things_that_are_not_readings_are_replaced(self) -> None:
        for junk in (None, 5, "text", [], {}):
            results, _ = self.run_with(mcd1=s.stub("MCD1", use_returns=True, returns=junk))
            self.assertReplaced(results, "MCD1", "SCHEMA:")

    def test_a_percent_sign_and_a_banned_word_are_replaced_and_logged(self) -> None:
        def percent(inputs, params, upstream):
            return env.valid("MCD2", s.VERSION, inputs.cycle_slot, state_code="MCD2_UP", bias="LONG", summary_line="Up 5%", commentary="x")

        def banned(inputs, params, upstream):
            return env.valid("MCD1", s.VERSION, inputs.cycle_slot, state_code="MCD1_UP", bias="LONG", summary_line="x", commentary="A sure thing")

        results, logs = self.run_with(mcd2=percent, mcd1=banned)
        self.assertReplaced(results, "MCD2", "WORDING:")
        self.assertReplaced(results, "MCD1", "WORDING:")
        self.assertTrue(any("failed its guards" in r.getMessage() for r in logs.records))

    def test_a_spelled_out_percent_is_replaced_and_logged(self) -> None:
        def spelled(inputs, params, upstream):
            return env.valid("MCD2", s.VERSION, inputs.cycle_slot, state_code="MCD2_UP", bias="LONG", summary_line="Up 70 percent", commentary="x")

        results, logs = self.run_with(mcd2=spelled)
        self.assertReplaced(results, "MCD2", "WORDING:")
        self.assertEqual(results["MCD2"].guard_problems, ("WORDING: summary_line contains the percentage word 'percent'",))
        self.assertTrue(any("failed its guards" in r.getMessage() for r in logs.records))

    def test_an_evaluator_that_drifted_from_its_registry_is_replaced(self) -> None:
        results, _ = self.run_with(mcd2=s.stub("MCD2", state="MCD2_UP", bias="LONG", version="9.9.9"))
        self.assertReplaced(results, "MCD2", "IDENTITY:")

    def test_a_state_outside_the_register_or_with_the_wrong_bias_is_replaced(self) -> None:
        results, _ = self.run_with(mcd1=s.stub("MCD1", state="MCD1_SIDEWAYS", bias="NEUTRAL"))
        self.assertReplaced(results, "MCD1", "REGISTER:")
        results, _ = self.run_with(mcd2=s.stub("MCD2", state="MCD2_UP", bias="SHORT"))
        self.assertReplaced(results, "MCD2", "REGISTER:")

    def test_a_reading_for_another_slot_is_replaced(self) -> None:
        def stale_slot(inputs, params, upstream):
            return s.reading("MCD2", "2026-09-18T20:50Z", state="MCD2_UP", bias="LONG")

        results, _ = self.run_with(mcd2=stale_slot)
        self.assertReplaced(results, "MCD2", "IDENTITY:")

    def test_a_replaced_reading_is_what_a_later_mcd_reads(self) -> None:
        results, _ = self.run_with(mcd1=s.stub("MCD1", use_returns=True, returns=None))
        self.assertEqual(results["MCD3"].status, rc.INVALID)
        self.assertEqual(results["MCD3"].envelope["status_reasons"], ["UPSTREAM_UNAVAILABLE:MCD1"])

    def test_a_replaced_reading_is_not_marked_by_the_gate(self) -> None:
        results, _ = self.run_with(gate="MCD0_M15_DEFECT", mcd1=s.stub("MCD1", use_returns=True, returns=None))
        self.assertEqual(results["MCD1"].envelope["status_reasons"], [rc.EVALUATOR_ERROR])
        self.assertEqual(results["MCD1"].inherited_reasons, ())

    def test_a_reading_the_guards_accept_is_kept_exactly_as_the_evaluator_made_it(self) -> None:
        result = s.synthetic_worker().run_cycle(s.tiny_inputs()).by_id()["MCD2"]
        expected = env.canonical(s.reading("MCD2", SLOT, state="MCD2_UP", bias="LONG"))
        self.assertEqual(result.envelope, expected)
        self.assertEqual(result.guard_problems, ())


class MarkedReadingGuardTests(unittest.TestCase):
    def test_a_marked_reading_that_fails_its_guards_is_replaced_and_the_mark_is_dropped(self) -> None:
        """If marking could ever produce a reading the guards refuse, the row is the INVALID replacement, not the mark."""
        from unittest import mock

        from mcd_worker import inheritance

        original = inheritance.apply_inheritance

        def bad_mark(reading, sensor_, defects):
            marked, added = original(reading, sensor_, defects)
            marked = dict(marked)
            marked["surprise"] = 1
            return marked, added

        with mock.patch.object(inheritance, "apply_inheritance", bad_mark), self.assertLogs("mcd.worker", level="ERROR"):
            results = s.synthetic_worker(s.synthetic_sensors(gate="MCD0_M15_DEFECT")).run_cycle(s.tiny_inputs()).by_id()
        self.assertEqual(results["MCD1"].status, rc.INVALID)
        self.assertEqual(results["MCD1"].envelope["status_reasons"], [rc.EVALUATOR_ERROR])
        self.assertEqual(results["MCD1"].inherited_reasons, ())
        self.assertTrue(results["MCD1"].guard_problems[0].startswith("SCHEMA:"))


if __name__ == "__main__":
    unittest.main()
