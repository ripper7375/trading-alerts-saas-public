"""MCD0 inheritance (ADR-018, Davin's Q5) and MCD3's use of its upstream readings (ADR-021, Q5 a).

Expected values are written out here from the rules, not read back from the runner or from the stored cycles.
"""

from __future__ import annotations

import dataclasses
import json
import unittest

from mcd_common import envelope as env
from mcd_common import reason_codes as rc
from mcd_common.cycle_inputs import thaw

from mcd_worker import inheritance
from mcd_worker.errors import ConfigError
from mcd_worker.tests import support as s

M5, M15, BOTH = "MCD0_M5_DEFECT", "MCD0_M15_DEFECT", "MCD0_M5_M15_DEFECT"
D5, D15 = "MCD0_DEFECT_M5", "MCD0_DEFECT_M15"


def run(gate: str = "MCD0_ALL_QUALIFIED", **kwargs):
    return s.synthetic_worker(s.synthetic_sensors(gate=gate, **kwargs)).run_cycle(s.tiny_inputs()).by_id()


def reasons(result) -> list[str]:
    return result.envelope["status_reasons"]


class TheMatrixTests(unittest.TestCase):
    """Which MCDs a defect marks, and with which reasons in which order."""

    def test_no_defect_marks_nobody(self) -> None:
        results = run("MCD0_ALL_QUALIFIED")
        for mcd_id in ("MCD1", "MCD2", "MCD3"):
            self.assertEqual(results[mcd_id].status, rc.VALID, mcd_id)
            self.assertEqual(reasons(results[mcd_id]), [], mcd_id)
            self.assertEqual(results[mcd_id].inherited_reasons, (), mcd_id)

    def test_an_m5_defect_marks_mcd2_and_mcd3_and_not_mcd1(self) -> None:
        results = run(M5)
        self.assertEqual(results["MCD1"].status, rc.VALID)
        self.assertEqual(reasons(results["MCD1"]), [])
        self.assertEqual(results["MCD2"].status, rc.CAUTIONARY)
        self.assertEqual(reasons(results["MCD2"]), [D5])
        self.assertEqual(results["MCD3"].status, rc.CAUTIONARY)
        # MCD3 reads MCD2, which is now CAUTIONARY, and uses the M5 channel itself: both reasons, upstream first.
        self.assertEqual(reasons(results["MCD3"]), ["UPSTREAM_CAUTIONARY:MCD2", D5])

    def test_an_m15_defect_marks_mcd1_and_mcd3_and_not_mcd2(self) -> None:
        results = run(M15)
        self.assertEqual(results["MCD2"].status, rc.VALID)
        self.assertEqual(reasons(results["MCD2"]), [])
        self.assertEqual(results["MCD1"].status, rc.CAUTIONARY)
        self.assertEqual(reasons(results["MCD1"]), [D15])
        self.assertEqual(reasons(results["MCD3"]), ["UPSTREAM_CAUTIONARY:MCD1", D15])

    def test_a_defect_on_both_marks_all_three_with_the_reasons_in_timeframe_order(self) -> None:
        results = run(BOTH)
        self.assertEqual(reasons(results["MCD1"]), [D15])
        self.assertEqual(reasons(results["MCD2"]), [D5])
        self.assertEqual(reasons(results["MCD3"]), ["UPSTREAM_CAUTIONARY:MCD1", "UPSTREAM_CAUTIONARY:MCD2", D5, D15])

    def test_the_gate_itself_is_never_marked(self) -> None:
        for gate in (M5, M15, BOTH):
            result = run(gate)["MCD0"]
            self.assertEqual(result.status, rc.VALID, gate)
            self.assertEqual(reasons(result), [], gate)
            self.assertEqual(result.inherited_reasons, (), gate)

    def test_the_marking_is_recorded_on_each_result(self) -> None:
        results = run(BOTH)
        self.assertEqual(results["MCD3"].inherited_reasons, (D5, D15))
        self.assertEqual(results["MCD1"].inherited_reasons, (D15,))

    def test_the_cycle_result_names_the_defective_timeframes(self) -> None:
        for gate, expected in ((M5, ("M5",)), (M15, ("M15",)), (BOTH, ("M5", "M15")), ("MCD0_ALL_QUALIFIED", ())):
            result = s.synthetic_worker(s.synthetic_sensors(gate=gate)).run_cycle(s.tiny_inputs())
            self.assertEqual(result.defect_timeframes, expected, gate)
            self.assertEqual(result.deterministic_dict()["gate"]["defect_timeframes"], list(expected), gate)


class WhatSurvivesTheMarkTests(unittest.TestCase):
    def test_state_bias_levels_regime_texts_and_details_survive(self) -> None:
        levels = [{"name": "UOEDT", "tf": "M5", "price": 4384.28, "role": "resistance"}, {"name": "LOEDT", "tf": "M5", "price": 4350.22}]
        details = {"zone": {"a": 1, "b": [2, 3]}, "note": "kept"}

        def full(inputs, params, upstream):
            return env.valid(
                "MCD2", s.VERSION, inputs.cycle_slot, state_code="MCD2_UP", bias="LONG", summary_line="Corridor up", commentary="Price sits in the corridor.",
                levels=levels, regime_status="TREND_ALIGNED_CONTINUATION", details=details, last_closed_bar={"M5": "2026-09-18T20:50Z"},
                active_indicator={"M5": "best_fit_a"}, config_hash={"best_fit_a": "abc"},
            )

        unmarked = run("MCD0_ALL_QUALIFIED", mcd2=full)["MCD2"].envelope
        marked = run(M5, mcd2=full)["MCD2"].envelope
        self.assertEqual(marked["status"], rc.CAUTIONARY)
        self.assertEqual(marked["status_reasons"], [D5])
        changed = {k for k in marked if marked[k] != unmarked[k]}
        self.assertEqual(changed, {"status", "status_reasons"})

    def test_the_marked_reading_validates_against_the_schema(self) -> None:
        for gate in (M5, M15, BOTH):
            for result in run(gate).values():
                self.assertEqual(env.schema_errors(result.envelope), [], (gate, result.mcd_id))

    def test_the_stored_text_is_the_marked_reading(self) -> None:
        marked = run(M5)["MCD2"]
        self.assertEqual(json.loads(marked.envelope_json), marked.envelope)
        self.assertEqual(marked.envelope_json, env.canonical_json(marked.envelope))
        self.assertNotEqual(marked.envelope_sha256, marked.evaluator_envelope_sha256)

    def test_an_unmarked_reading_has_equal_hashes(self) -> None:
        result = run(M5)["MCD1"]
        self.assertEqual(result.envelope_sha256, result.evaluator_envelope_sha256)


class WhatIsLeftAloneTests(unittest.TestCase):
    def test_an_invalid_channel_reading_is_left_alone(self) -> None:
        results = run(M15, mcd1=s.stub("MCD1", status=rc.INVALID, reasons=[rc.NO_SETTING]))
        self.assertEqual(results["MCD1"].status, rc.INVALID)
        self.assertEqual(reasons(results["MCD1"]), [rc.NO_SETTING])
        self.assertEqual(results["MCD1"].inherited_reasons, ())

    def test_a_stale_channel_reading_is_left_alone(self) -> None:
        results = run(M5, mcd2=s.stub("MCD2", status=rc.STALE, reasons=[rc.NO_STATS_AT_SLOT]))
        self.assertEqual(results["MCD2"].status, rc.STALE)
        self.assertEqual(reasons(results["MCD2"]), [rc.NO_STATS_AT_SLOT])

    def test_a_cautionary_channel_reading_keeps_its_reasons_and_gains_the_defect(self) -> None:
        results = run(M5, mcd2=s.stub("MCD2", state="MCD2_UP", bias="LONG", status=rc.CAUTIONARY, reasons=[rc.DETECTION_MISMATCH]))
        self.assertEqual(reasons(results["MCD2"]), [rc.DETECTION_MISMATCH, D5])
        self.assertEqual(results["MCD2"].inherited_reasons, (D5,))

    def test_a_reason_already_there_is_not_added_twice(self) -> None:
        sensor = s.synthetic_sensors()[2]
        marked, added = inheritance.apply_inheritance(
            s.reading("MCD2", "2026-09-18T20:55Z", status=rc.CAUTIONARY, state="MCD2_UP", bias="LONG", reasons=[D5]), sensor, ("M5",)
        )
        self.assertEqual(added, ())
        self.assertEqual(marked["status_reasons"], [D5])

    def test_an_invalid_gate_marks_nobody(self) -> None:
        results = run(gate_status=rc.INVALID, gate_reasons=[rc.SANITY_FAILED], gate_evaluate=None, gate=BOTH)
        self.assertEqual(results["MCD0"].status, rc.INVALID)
        for mcd_id in ("MCD1", "MCD2", "MCD3"):
            self.assertEqual(results[mcd_id].status, rc.VALID, mcd_id)
            self.assertEqual(reasons(results[mcd_id]), [], mcd_id)

    def test_a_stale_gate_marks_nobody(self) -> None:
        results = run(gate_status=rc.STALE, gate_reasons=[rc.NO_STATS_AT_SLOT], gate=BOTH)
        self.assertEqual(results["MCD0"].status, rc.STALE)
        for mcd_id in ("MCD1", "MCD2", "MCD3"):
            self.assertEqual(results[mcd_id].status, rc.VALID, mcd_id)

    def test_a_cautionary_gate_marks_nobody(self) -> None:
        """Davin's Q5 b says only a VALID defect propagates; a CAUTIONARY MCD0 is read literally (hand-off question)."""
        results = run(gate_status=rc.CAUTIONARY, gate_reasons=[rc.RETUNING], gate=BOTH)
        self.assertEqual(results["MCD0"].status, rc.CAUTIONARY)
        for mcd_id in ("MCD1", "MCD2", "MCD3"):
            self.assertEqual(results[mcd_id].status, rc.VALID, mcd_id)
            self.assertEqual(reasons(results[mcd_id]), [], mcd_id)

    def test_no_gate_in_the_cycle_marks_nobody(self) -> None:
        sensors = s.synthetic_sensors()
        worker = s.synthetic_worker(sensors, flags={"MCD0": "off", "MCD1": "off", "MCD2": "off", "MCD3": "off"})
        self.assertEqual(worker.run_cycle(s.tiny_inputs()).results, ())

    def test_an_mcd_that_does_not_use_the_timeframe_is_not_marked(self) -> None:
        sensor = dataclasses.replace(s.synthetic_sensors()[1], uses_channel=())
        self.assertEqual(inheritance.inherited_reasons(sensor, ("M5", "M15")), ())

    def test_mcd0_state_codes_are_the_whole_map(self) -> None:
        self.assertEqual(set(inheritance.DEFECT_TIMEFRAMES), set(s.GATE_STATES))


class DefectTimeframesTests(unittest.TestCase):
    def envelope(self, status: str, state: str | None) -> dict:
        return {"status": status, "state_code": state}

    def test_each_state_and_the_order(self) -> None:
        cases = {"MCD0_ALL_QUALIFIED": (), M5: ("M5",), M15: ("M15",), BOTH: ("M5", "M15")}
        for state, expected in cases.items():
            self.assertEqual(inheritance.defect_timeframes(self.envelope(rc.VALID, state)), expected, state)

    def test_only_a_valid_reading_propagates(self) -> None:
        for status in (rc.CAUTIONARY, rc.INVALID, rc.STALE):
            self.assertEqual(inheritance.defect_timeframes(self.envelope(status, BOTH)), (), status)
        self.assertEqual(inheritance.PROPAGATING_STATUSES, (rc.VALID,))

    def test_an_unknown_state_is_refused_not_ignored(self) -> None:
        with self.assertRaises(ConfigError):
            inheritance.defect_timeframes(self.envelope(rc.VALID, "MCD0_M7_DEFECT"))

    def test_the_reasons_a_sensor_inherits_follow_its_uses_channel(self) -> None:
        sensors = {x.mcd_id: x for x in s.synthetic_sensors()}
        self.assertEqual(inheritance.inherited_reasons(sensors["MCD1"], ("M5", "M15")), (D15,))
        self.assertEqual(inheritance.inherited_reasons(sensors["MCD2"], ("M5", "M15")), (D5,))
        self.assertEqual(inheritance.inherited_reasons(sensors["MCD3"], ("M5", "M15")), (D5, D15))
        self.assertEqual(inheritance.inherited_reasons(sensors["MCD3"], ("M15",)), (D15,))
        self.assertEqual(inheritance.inherited_reasons(sensors["MCD3"], ()), ())


class GateRegisterTests(unittest.TestCase):
    def gate(self, states: dict[str, str]):
        return s.sensor("MCD0", "gate", s.stub("MCD0"), states=states)

    def test_the_real_gate_is_mapped_completely(self) -> None:
        self.assertEqual(inheritance.gate_state_problems(self.gate({code: "NEUTRAL" for code in s.GATE_STATES})), [])

    def test_an_unmapped_state_is_a_problem(self) -> None:
        problems = inheritance.gate_state_problems(self.gate({**{c: "NEUTRAL" for c in s.GATE_STATES}, "MCD0_M30_DEFECT": "NEUTRAL"}))
        self.assertEqual(len(problems), 1)
        self.assertIn("MCD0_M30_DEFECT", problems[0])

    def test_a_state_the_register_lacks_is_a_problem(self) -> None:
        problems = inheritance.gate_state_problems(self.gate({c: "NEUTRAL" for c in s.GATE_STATES if c != M15}))
        self.assertEqual(len(problems), 1)
        self.assertIn(M15, problems[0])

    def test_a_worker_with_an_unmappable_gate_does_not_start(self) -> None:
        sensors = s.synthetic_sensors()
        sensors[0] = self.gate({"MCD0_ALL_QUALIFIED": "NEUTRAL"})
        with self.assertRaises(ConfigError):
            s.synthetic_worker(sensors)


class UpstreamWiringTests(unittest.TestCase):
    """ADR-021: MCD3 reads the same cycle's readings of MCD1 and MCD2; Q5 a: the readings as they stand after marking."""

    def test_mcd3_gets_exactly_its_dependencies_and_the_marked_readings(self) -> None:
        calls = s.Calls()
        run(BOTH, mcd3=s.mcd3_stub(calls))
        self.assertEqual(len(calls), 1)
        upstream = calls.last_upstream
        self.assertEqual(list(upstream), ["MCD1", "MCD2"])  # not MCD0, in depends_on order
        self.assertEqual(upstream["MCD1"]["status"], rc.CAUTIONARY)
        self.assertEqual(upstream["MCD1"]["status_reasons"], [D15])
        self.assertEqual(upstream["MCD2"]["status_reasons"], [D5])

    def test_the_upstream_reading_is_the_reading_that_is_saved(self) -> None:
        calls = s.Calls()
        results = run(BOTH, mcd3=s.mcd3_stub(calls))
        self.assertEqual(calls.last_upstream["MCD1"], results["MCD1"].envelope)
        self.assertEqual(calls.last_upstream["MCD2"], results["MCD2"].envelope)

    def test_independent_mcds_and_the_gate_get_no_upstream(self) -> None:
        calls = {i: s.Calls() for i in ("MCD0", "MCD1", "MCD2")}
        run(
            BOTH,
            gate_evaluate=s.stub("MCD0", state=BOTH, calls=calls["MCD0"]),
            mcd1=s.stub("MCD1", state="MCD1_UP", bias="LONG", calls=calls["MCD1"]),
            mcd2=s.stub("MCD2", state="MCD2_UP", bias="LONG", calls=calls["MCD2"]),
        )
        for mcd_id, record in calls.items():
            self.assertEqual(len(record), 1, mcd_id)
            self.assertEqual(record.last_upstream, {}, mcd_id)

    def test_every_evaluator_runs_exactly_once_per_cycle(self) -> None:
        calls = {i: s.Calls() for i in ("MCD1", "MCD2", "MCD3")}
        run(
            BOTH,
            mcd1=s.stub("MCD1", state="MCD1_UP", bias="LONG", calls=calls["MCD1"]),
            mcd2=s.stub("MCD2", state="MCD2_UP", bias="LONG", calls=calls["MCD2"]),
            mcd3=s.mcd3_stub(calls["MCD3"]),
        )
        self.assertEqual({i: len(c) for i, c in calls.items()}, {"MCD1": 1, "MCD2": 1, "MCD3": 1})

    def test_an_evaluator_cannot_change_what_a_later_mcd_reads(self) -> None:
        results = run(mcd3=s.stub("MCD3", state="MCD3_NO_AGREEMENT", bias="STAND_ASIDE", depends_on=("MCD1", "MCD2"), mutate_upstream=True))
        self.assertEqual(results["MCD1"].state_code, "MCD1_UP")
        self.assertEqual(reasons(results["MCD1"]), [])
        self.assertEqual(results["MCD1"].envelope_json, env.canonical_json(results["MCD1"].envelope))

    def test_changing_mcd1s_trend_changes_mcd3_in_the_same_cycle(self) -> None:
        up = run(mcd1=s.stub("MCD1", state="MCD1_UP", bias="LONG"))
        down = run(mcd1=s.stub("MCD1", state="MCD1_DOWN", bias="SHORT"))
        self.assertEqual(up["MCD3"].state_code, "MCD3_AGREE_UP")
        self.assertEqual(down["MCD3"].state_code, "MCD3_NO_AGREEMENT")
        self.assertNotEqual(up["MCD3"].envelope_json, down["MCD3"].envelope_json)

    def test_mcd3_follows_the_stored_mcd1_not_a_second_reading(self) -> None:
        """MCD3's stub reads nothing but its upstream, so whatever MCD1 said is what MCD3 acted on."""
        for state, bias, expected in (("MCD1_UP", "LONG", "MCD3_AGREE_UP"), ("MCD1_DOWN", "SHORT", "MCD3_NO_AGREEMENT")):
            results = run(mcd1=s.stub("MCD1", state=state, bias=bias))
            self.assertEqual(results["MCD1"].state_code, state)
            self.assertEqual(results["MCD3"].state_code, expected)

    def test_an_unavailable_upstream_makes_mcd3_unavailable_not_recomputed(self) -> None:
        results = run(mcd1=s.stub("MCD1", status=rc.INVALID, reasons=[rc.NO_SETTING]))
        self.assertEqual(results["MCD3"].status, rc.INVALID)
        self.assertEqual(reasons(results["MCD3"]), ["UPSTREAM_UNAVAILABLE:MCD1"])
        results = run(mcd2=s.stub("MCD2", status=rc.STALE, reasons=[rc.NO_STATS_AT_SLOT]))
        self.assertEqual(results["MCD3"].status, rc.STALE)
        self.assertEqual(reasons(results["MCD3"]), ["UPSTREAM_STALE:MCD2"])


class RealEvaluatorTests(unittest.TestCase):
    """The four real evaluators on the three stored cycles. MCD0 calls both timeframes defective on all three."""

    def results(self, name: str, inputs=None):
        return s.real_worker().run_cycle(inputs or s.bundle(name)).by_id()

    def test_a_defect_on_both_timeframes_marks_every_channel_mcd_on_all_three_cycles(self) -> None:
        expected_states = {
            "v1": ("MCD1_DOWN_UPPER_BREAKOUT", "MCD2_UP_IN_CORRIDOR", "MCD3_NON_CONSOLIDATED_TREND_CONFLICT"),
            "v3": ("MCD1_DOWN_LOWER_BREAKDOWN", "MCD2_DOWN_LOWER_BREAKDOWN", "MCD3_BEAR_BOTTOM"),
            "v4": ("MCD1_DOWN_IN_CORRIDOR", "MCD2_DOWN_IN_CORRIDOR", "MCD3_NON_CONSOLIDATED_OVERFLOW"),
        }
        for name, (s1, s2, s3) in expected_states.items():
            results = self.results(name)
            self.assertEqual(results["MCD0"].state_code, BOTH, name)
            self.assertEqual(results["MCD0"].status, rc.VALID, name)
            self.assertEqual((results["MCD1"].state_code, results["MCD2"].state_code, results["MCD3"].state_code), (s1, s2, s3), name)
            self.assertEqual(reasons(results["MCD1"]), [D15], name)
            self.assertEqual(reasons(results["MCD2"]), [D5], name)
            self.assertEqual(reasons(results["MCD3"]), ["UPSTREAM_CAUTIONARY:MCD1", "UPSTREAM_CAUTIONARY:MCD2", D5, D15], name)
            for mcd_id in ("MCD1", "MCD2", "MCD3"):
                self.assertEqual(results[mcd_id].status, rc.CAUTIONARY, (name, mcd_id))
                self.assertEqual(results[mcd_id].guard_problems, (), (name, mcd_id))

    def test_changing_mcd1s_trend_changes_mcd3_on_a_real_cycle(self) -> None:
        inputs = s.bundle("v3")  # a real consolidated downtrend: M15 slope -15.61, M5 slope -11.01
        base = self.results("v3")
        flipped = self.results("v3", s.with_statistics(inputs, "M15", regression_angle=25.0))
        self.assertEqual(base["MCD3"].state_code, "MCD3_BEAR_BOTTOM")
        self.assertEqual(base["MCD3"].envelope["details"]["m15_trend_direction"], "DOWN")
        self.assertTrue(base["MCD3"].envelope["details"]["trends_aligned"])
        self.assertEqual(flipped["MCD1"].state_code, "MCD1_UP_IN_CORRIDOR")
        self.assertEqual(flipped["MCD2"].envelope, base["MCD2"].envelope)  # the M5 channel did not change
        self.assertEqual(flipped["MCD3"].state_code, "MCD3_NON_CONSOLIDATED_TREND_CONFLICT")
        self.assertEqual(flipped["MCD3"].envelope["details"]["m15_trend_direction"], "UP")
        self.assertFalse(flipped["MCD3"].envelope["details"]["trends_aligned"])

    def test_the_real_mcd3_takes_its_trend_from_mcd1s_reading_not_from_the_statistics(self) -> None:
        """MCD1 is made to say UP while the bundle's statistics still say DOWN: MCD3 follows what MCD1 said."""
        real = s.real_worker()

        def says_up(evaluate):
            def wrapped(inputs, params, upstream):
                reading = evaluate(inputs, params, upstream)
                reading = thaw(reading)
                reading["details"]["trend_direction"] = "UP"
                return reading

            return wrapped

        worker = s.worker_replacing("MCD1", says_up)
        base = real.run_cycle(s.bundle("v3")).by_id()["MCD3"].envelope["details"]
        rewired = worker.run_cycle(s.bundle("v3")).by_id()["MCD3"].envelope["details"]
        self.assertEqual(base["m15_trend_direction"], "DOWN")
        self.assertEqual(rewired["m15_trend_direction"], "UP")
        self.assertEqual(rewired["m5_trend_direction"], "DOWN")
        self.assertFalse(rewired["trends_aligned"])

    def test_a_gate_that_passes_marks_nobody_on_a_real_cycle(self) -> None:
        """Fit descriptors that meet every criterion make MCD0 call both timeframes fine; the four readings are then the evaluators' own."""
        base = self.results("v3")
        inputs = s.bundle("v3")
        for tf in ("M5", "M15"):
            inputs = s.with_statistics(
                inputs, tf, window_span_bars=500, model_a_r2=0.9, model_b_r2=0.9, model_a_mse=400.0, model_b_mse=400.0,
                model_a_skew=0.0, model_b_skew=0.0, uoedt_offset=50.0, loedt_offset=-50.0, channel_width=100.0,
            )
        clean = self.results("v3", inputs)
        self.assertEqual(clean["MCD0"].state_code, "MCD0_ALL_QUALIFIED")
        for mcd_id in ("MCD1", "MCD2", "MCD3"):
            self.assertEqual(clean[mcd_id].status, rc.VALID, mcd_id)
            self.assertEqual(clean[mcd_id].inherited_reasons, (), mcd_id)
            self.assertEqual(clean[mcd_id].envelope_sha256, clean[mcd_id].evaluator_envelope_sha256, mcd_id)
        # MCD1 and MCD2 say exactly what they said in the marked run, before the mark. MCD3 does not: it read marked
        # upstream readings there (Q5 a), so its own evaluator output was already CAUTIONARY.
        for mcd_id in ("MCD1", "MCD2"):
            self.assertEqual(clean[mcd_id].envelope_sha256, base[mcd_id].evaluator_envelope_sha256, mcd_id)
        self.assertEqual(base["MCD3"].envelope["status_reasons"][:2], ["UPSTREAM_CAUTIONARY:MCD1", "UPSTREAM_CAUTIONARY:MCD2"])
        self.assertEqual(clean["MCD3"].envelope["status_reasons"], [])


if __name__ == "__main__":
    unittest.main()
