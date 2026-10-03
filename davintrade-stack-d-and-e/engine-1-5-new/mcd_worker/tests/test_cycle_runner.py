"""The cycle runner end to end (architecture 2.2, "Done when" items 1, 2 and 6 of section 2.11)."""

from __future__ import annotations

import copy
import dataclasses
import json
import logging
import unittest

from mcd_common import envelope as env
from mcd_common import reason_codes as rc
from mcd_common.cycle_inputs import CycleInputs

from mcd_worker import cycle_runner as cr
from mcd_worker.errors import BundleError, ConfigError
from mcd_worker.tests import support as s


class _quiet:
    """Keep the evaluators' error logs out of the test output."""

    def __enter__(self):
        self._logger = logging.getLogger("mcd")
        self._level = self._logger.level
        self._logger.setLevel(logging.CRITICAL)

    def __exit__(self, *exc):
        self._logger.setLevel(self._level)


def stored(path: str) -> dict:
    return json.loads((s.ENGINE / path).read_text(encoding="utf-8"))


def reference_envelopes(name: str) -> dict[str, dict]:
    """What each MCD's own task stored for this slot, before any inheritance. MCD1 and MCD2 for the slot with no
    fixture of their own come from MCD3's stored upstream, which is where MCD3's task kept them."""
    stem = s.stem(name)
    upstream = stored(f"mcd3/fixtures/{stem}.upstream.json")
    found = {
        "MCD0": stored(f"mcd0/fixtures/{stem}.envelope.json"),
        "MCD1": upstream["MCD1"],
        "MCD2": upstream["MCD2"],
        "MCD3": stored(f"mcd3/fixtures/{stem}.envelope.json"),
    }
    for mcd_id, folder in (("MCD1", "mcd1"), ("MCD2", "mcd2")):
        own = s.ENGINE / folder / "fixtures" / f"{stem}.envelope.json"
        if own.is_file():
            assert json.loads(own.read_text(encoding="utf-8")) == found[mcd_id], f"{folder} and MCD3's upstream disagree on {name}"
    return found


class StoredEnvelopeTests(unittest.TestCase):
    """The independent evidence: one shared bundle per slot reproduces the evaluators' stored readings byte for byte."""

    def test_shared_bundle_reproduces_every_stored_envelope(self) -> None:
        """MCD0, MCD1 and MCD2 read nothing but the bundle, so the runner's evaluator output is the stored reading, byte for byte.

        MCD3 also reads its upstream. The runner hands it the marked MCD1 and MCD2 (Q5 a), so its reading differs from the
        stored one in status and reasons only; the stored upstream readings, given directly, give the stored reading exactly.
        """
        for name in s.SLOTS:
            results = s.real_worker().run_cycle(s.bundle(name)).by_id()
            reference = reference_envelopes(name)
            for mcd_id in ("MCD0", "MCD1", "MCD2"):
                expected = cr.sha256_text(env.canonical_json(reference[mcd_id]))
                self.assertEqual(results[mcd_id].evaluator_envelope_sha256, expected, f"{name} {mcd_id}")
            mcd3 = s.real_worker().registry["MCD3"]
            direct = mcd3.evaluate(s.bundle(name), mcd3.params, copy.deepcopy(stored(f"mcd3/fixtures/{s.stem(name)}.upstream.json")))
            self.assertEqual(env.canonical_json(direct), env.canonical_json(reference["MCD3"]), f"{name} MCD3 with the stored upstream")
            via_runner = {k: v for k, v in results["MCD3"].envelope.items() if k not in ("status", "status_reasons")}
            stored_mcd3 = {k: v for k, v in env.canonical(reference["MCD3"]).items() if k not in ("status", "status_reasons")}
            self.assertEqual(via_runner, stored_mcd3, f"{name} MCD3 through the runner")

    def test_the_references_are_what_the_evaluators_stored_not_the_runners_output(self) -> None:
        """Guard the guard: the reference of MCD1 is VALID and unmarked, so a run that returned the marked reading would differ."""
        reference = reference_envelopes("v1")
        for mcd_id in ("MCD1", "MCD2", "MCD3"):
            self.assertEqual(reference[mcd_id]["status"], rc.VALID, mcd_id)
            self.assertEqual(reference[mcd_id]["status_reasons"], [], mcd_id)

    def test_the_cycle_equals_the_stored_cycle_fixture(self) -> None:
        for name in s.SLOTS:
            text = json.dumps(s.real_worker().run_cycle(s.bundle(name)).deterministic_dict(), indent=2, ensure_ascii=True) + "\n"
            self.assertEqual(text, s.stored_cycle_text(name), name)


class OneReadingPerMcdTests(unittest.TestCase):
    def test_the_order_is_gate_independents_derived(self) -> None:
        for name in s.SLOTS:
            result = s.real_worker().run_cycle(s.bundle(name))
            self.assertEqual(result.order, ("MCD0", "MCD1", "MCD2", "MCD3"))
            self.assertEqual([r.mcd_id for r in result.results], ["MCD0", "MCD1", "MCD2", "MCD3"])

    def test_exactly_one_reading_per_enabled_mcd_and_none_for_the_others(self) -> None:
        worker = s.synthetic_worker(flags={"MCD0": "shadow", "MCD1": "shadow", "MCD2": "shadow", "MCD3": "off"})
        result = worker.run_cycle(s.tiny_inputs())
        self.assertEqual([r.mcd_id for r in result.results], ["MCD0", "MCD1", "MCD2"])
        self.assertEqual(len({r.mcd_id for r in result.results}), 3)

    def test_an_mcd_that_is_off_is_never_called(self) -> None:
        calls = s.Calls()
        worker = s.synthetic_worker(s.synthetic_sensors(mcd3=s.mcd3_stub(calls)), flags={"MCD0": "shadow", "MCD1": "shadow", "MCD2": "shadow", "MCD3": "off"})
        worker.run_cycle(s.tiny_inputs())
        self.assertEqual(len(calls), 0)

    def test_the_flag_is_recorded_on_every_reading(self) -> None:
        shadow = s.synthetic_worker().run_cycle(s.tiny_inputs())
        self.assertEqual({r.flag for r in shadow.results}, {"shadow"})
        mixed = s.synthetic_worker(flags={"MCD0": "live", "MCD1": "live", "MCD2": "shadow", "MCD3": "shadow"}, live=True)
        self.assertEqual({r.mcd_id: r.flag for r in mixed.run_cycle(s.tiny_inputs()).results}, {"MCD0": "live", "MCD1": "live", "MCD2": "shadow", "MCD3": "shadow"})

    def test_the_identity_of_each_reading_is_the_registrys(self) -> None:
        for name in s.SLOTS:
            result = s.real_worker().run_cycle(s.bundle(name))
            for r in result.results:
                self.assertEqual(r.envelope["mcd_id"], r.mcd_id)
                self.assertEqual(r.envelope["evaluator_version"], r.evaluator_version)
                self.assertEqual(r.envelope["cycle_slot"], s.SLOTS[name])
            self.assertEqual(
                {r.mcd_id: r.evaluator_version for r in result.results}, {"MCD0": "1.0.0", "MCD1": "2.0.1", "MCD2": "2.0.1", "MCD3": "2.0.0"}
            )

    def test_every_reading_validates_and_its_text_is_its_canonical_form(self) -> None:
        for name in s.SLOTS:
            for r in s.real_worker().run_cycle(s.bundle(name)).results:
                self.assertEqual(env.schema_errors(r.envelope), [], (name, r.mcd_id))
                self.assertEqual(r.envelope_json, env.canonical_json(r.envelope))
                self.assertEqual(r.envelope_sha256, cr.sha256_text(r.envelope_json))
                self.assertEqual(r.guard_problems, ())

    def test_status_state_and_bias_on_the_result_are_the_readings(self) -> None:
        for r in s.real_worker().run_cycle(s.bundle("v3")).results:
            self.assertEqual((r.status, r.state_code, r.bias), (r.envelope["status"], r.envelope["state_code"], r.envelope["bias"]))

    def test_the_result_carries_the_symbol_slot_and_flags(self) -> None:
        result = s.real_worker().run_cycle(s.bundle("v4"))
        self.assertEqual((result.symbol, result.cycle_slot), ("XAUUSD", "2026-09-28T23:15Z"))
        self.assertEqual(dict(result.flags), s.SHADOW_ALL)

    def test_the_gate_summary_is_mcd0s_reading(self) -> None:
        result = s.real_worker().run_cycle(s.bundle("v1"))
        self.assertEqual((result.gate_status, result.gate_state), ("VALID", "MCD0_M5_M15_DEFECT"))
        self.assertEqual(result.deterministic_dict()["gate"], {"mcd_id": "MCD0", "status": "VALID", "state_code": "MCD0_M5_M15_DEFECT", "defect_timeframes": ["M5", "M15"]})

    def test_a_run_that_has_no_gate_reports_none(self) -> None:
        worker = s.synthetic_worker(flags={"MCD0": "off", "MCD1": "off", "MCD2": "off", "MCD3": "off"})
        self.assertIsNone(worker.run_cycle(s.tiny_inputs()).deterministic_dict()["gate"])

    def test_durations_are_recorded_outside_the_deterministic_part(self) -> None:
        result = s.real_worker().run_cycle(s.bundle("v1"))
        self.assertEqual(set(result.to_dict()["runtime"]["timings_ms"]), {"MCD0", "MCD1", "MCD2", "MCD3"})
        self.assertNotIn("runtime", result.deterministic_dict())
        for r in result.results:
            self.assertGreaterEqual(r.duration_ms, 0)
            self.assertNotIn("duration_ms", r.to_dict())

    def test_each_mcd_takes_under_a_second_and_the_cycle_under_thirty(self) -> None:
        """Standard 11.2 (R15): one evaluation within 1 s, the whole cycle within 30 s. Starting values; the real bound is the 5 s worker."""
        result = s.real_worker().run_cycle(s.bundle("v4"))
        for r in result.results:
            self.assertLess(r.duration_ms, 1000, r.mcd_id)
        self.assertLess(sum(r.duration_ms for r in result.results), 30000)

    def test_the_result_is_json_and_round_trips(self) -> None:
        result = s.real_worker().run_cycle(s.bundle("v1"))
        text = json.dumps(result.to_dict(), ensure_ascii=True, allow_nan=False)
        back = json.loads(text)
        self.assertEqual(back["schema_version"], "mcd-cycle-result/1")
        for row, r in zip(back["results"], result.results):
            self.assertEqual(json.loads(row["envelope_json"]), r.envelope)


class DependencyOrderTests(unittest.TestCase):
    """The order is the dependency order, not the numeric one."""

    def test_a_derived_mcd_numbered_below_its_dependency_runs_after_it_and_reads_it(self) -> None:
        calls = s.Calls()

        def reads_mcd7(inputs, params, upstream):
            calls.items.append((inputs.retuning, copy.deepcopy(dict(upstream))))
            return s.reading("MCD2", inputs.cycle_slot, depends_on=("MCD7",))

        sensors = [
            s.sensor("MCD0", "gate", s.stub("MCD0", state="MCD0_ALL_QUALIFIED"), states={"MCD0_ALL_QUALIFIED": "NEUTRAL", "MCD0_M5_DEFECT": "NEUTRAL", "MCD0_M15_DEFECT": "NEUTRAL", "MCD0_M5_M15_DEFECT": "NEUTRAL"}),
            s.sensor("MCD2", "derived", reads_mcd7, depends_on=("MCD7",)),
            s.sensor("MCD7", "independent", s.stub("MCD7")),
        ]
        worker = s.synthetic_worker(sensors)
        result = worker.run_cycle(s.tiny_inputs())
        self.assertEqual(result.order, ("MCD0", "MCD7", "MCD2"))
        self.assertEqual([r.mcd_id for r in result.results], ["MCD0", "MCD7", "MCD2"])
        self.assertEqual(list(calls.last_upstream), ["MCD7"])
        self.assertEqual(calls.last_upstream["MCD7"]["state_code"], "MCD7_STATE")

    def test_execution_order_itself_refuses_a_cycle_it_is_given(self) -> None:
        """A registry cannot be built with a cycle; the order function refuses one that reaches it some other way."""
        from mcd_worker import registry as reg

        a = s.sensor("MCD3", "derived", s.stub("MCD3"), depends_on=("MCD4",))
        b = s.sensor("MCD4", "derived", s.stub("MCD4"), depends_on=("MCD3",))
        with self.assertRaises(ConfigError) as caught:
            reg.execution_order({"MCD3": a, "MCD4": b}, ["MCD3", "MCD4"])
        self.assertIn("dependency cycle among derived MCDs: MCD3, MCD4", "; ".join(caught.exception.problems))


class FailureHandlingTests(unittest.TestCase):
    """R7 at the cycle level: a reading is always saved, and a bad one is saved as INVALID."""

    def run_with(self, **sensors):
        return s.synthetic_worker(s.synthetic_sensors(**sensors)).run_cycle(s.tiny_inputs()).by_id()

    def test_an_evaluator_that_raises_becomes_invalid_with_evaluator_error(self) -> None:
        with self.assertLogs("mcd.worker", level="ERROR") as logs:
            results = self.run_with(mcd2=s.stub("MCD2", raises=ValueError("boom")))
        self.assertEqual(results["MCD2"].status, rc.INVALID)
        self.assertEqual(results["MCD2"].envelope["status_reasons"], [rc.EVALUATOR_ERROR])
        self.assertEqual(results["MCD2"].guard_problems, ("RAISED: ValueError: boom",))
        self.assertEqual(results["MCD2"].envelope["depends_on"], [])
        self.assertEqual(env.schema_errors(results["MCD2"].envelope), [])
        self.assertTrue(any(getattr(record, "mcd_id", None) == "MCD2" and getattr(record, "cycle_slot", None) == "2026-09-18T20:55Z" for record in logs.records))

    def test_the_others_are_unaffected_and_the_derived_one_sees_the_failure(self) -> None:
        with self.assertLogs("mcd.worker", level="ERROR"):
            results = self.run_with(mcd2=s.stub("MCD2", raises=RuntimeError("x")))
        self.assertEqual(results["MCD1"].status, rc.VALID)
        self.assertEqual(results["MCD0"].status, rc.VALID)
        self.assertEqual(results["MCD3"].status, rc.INVALID)
        self.assertEqual(results["MCD3"].envelope["status_reasons"], ["UPSTREAM_UNAVAILABLE:MCD2"])
        self.assertEqual(results["MCD3"].envelope["depends_on"], ["MCD1", "MCD2"])

    def test_every_evaluator_failing_still_gives_one_reading_each(self) -> None:
        boom = RuntimeError("boom")
        with self.assertLogs("mcd.worker", level="ERROR"):
            results = self.run_with(
                gate_evaluate=s.stub("MCD0", raises=boom), mcd1=s.stub("MCD1", raises=boom), mcd2=s.stub("MCD2", raises=boom),
                mcd3=s.stub("MCD3", raises=boom),
            )
        self.assertEqual(sorted(results), ["MCD0", "MCD1", "MCD2", "MCD3"])
        for mcd_id, r in results.items():
            self.assertEqual((r.status, r.envelope["status_reasons"]), (rc.INVALID, [rc.EVALUATOR_ERROR]), mcd_id)
            self.assertEqual(env.schema_errors(r.envelope), [], mcd_id)

    def test_the_kits_fallback_envelope_is_given_the_registrys_dependencies(self) -> None:
        """``never_throws`` cannot know ``depends_on``; the registry does, so the saved row names its dependencies."""
        decorated = env.never_throws("MCD3", s.VERSION)(lambda inputs, params, upstream: 1 / 0)
        with self.assertLogs("mcd", level="ERROR"):
            results = self.run_with(mcd3=decorated)
        self.assertEqual(results["MCD3"].envelope["status_reasons"], [rc.EVALUATOR_ERROR])
        self.assertEqual(results["MCD3"].envelope["depends_on"], ["MCD1", "MCD2"])
        self.assertEqual(results["MCD3"].guard_problems, ())

    def test_a_failed_gate_is_a_gate_that_marks_nobody(self) -> None:
        with self.assertLogs("mcd.worker", level="ERROR"):
            results = self.run_with(gate_evaluate=s.stub("MCD0", raises=RuntimeError("x")))
        self.assertEqual(results["MCD0"].status, rc.INVALID)
        self.assertEqual(results["MCD1"].status, rc.VALID)

    def test_what_a_failed_reading_did_not_do_is_not_remembered(self) -> None:
        """A raising evaluator in one cycle leaves nothing behind for the next."""
        worker = s.synthetic_worker(s.synthetic_sensors(mcd2=s.stub("MCD2", raises=RuntimeError("x"))))
        with self.assertLogs("mcd.worker", level="ERROR"):
            first = worker.run_cycle(s.tiny_inputs()).by_id()
        second = s.synthetic_worker().run_cycle(s.tiny_inputs()).by_id()
        self.assertEqual(first["MCD1"].envelope_json, second["MCD1"].envelope_json)


class RealCorruptionTests(unittest.TestCase):
    """The real evaluators on a damaged bundle: still one reading each, none of them a state."""

    def results(self, inputs: CycleInputs):
        with _quiet():
            return s.real_worker().run_cycle(inputs)

    def test_stale_data_gives_stale_readings_and_no_inheritance(self) -> None:
        result = self.results(dataclasses.replace(s.bundle("v1"), data_status="STALE"))
        self.assertEqual({r.mcd_id: r.status for r in result.results}, {"MCD0": "STALE", "MCD1": "STALE", "MCD2": "STALE", "MCD3": "STALE"})
        for r in result.results:
            self.assertEqual(r.envelope["status_reasons"], [rc.DATA_STALE], r.mcd_id)
            self.assertEqual(r.inherited_reasons, ())
        self.assertEqual(result.defect_timeframes, ())

    def test_an_unknown_data_status_is_invalid_everywhere(self) -> None:
        result = self.results(dataclasses.replace(s.bundle("v1"), data_status="Stale"))
        for r in result.results:
            self.assertEqual((r.status, r.envelope["status_reasons"][0]), (rc.INVALID, rc.SANITY_FAILED), r.mcd_id)

    def test_no_statistics_gives_stale_everywhere(self) -> None:
        result = self.results(dataclasses.replace(s.bundle("v3"), statistics={}))
        self.assertEqual({r.mcd_id: r.status for r in result.results}, {"MCD0": "STALE", "MCD1": "STALE", "MCD2": "STALE", "MCD3": "STALE"})

    def test_no_bars_gives_no_state_and_one_reading_each(self) -> None:
        result = self.results(dataclasses.replace(s.bundle("v3"), bars={"M5": (), "M15": ()}))
        self.assertEqual(len(result.results), 4)
        for r in result.results:
            self.assertIn(r.status, ("INVALID", "STALE", "VALID", "CAUTIONARY"))
            if r.status in ("INVALID", "STALE"):
                self.assertIsNone(r.state_code, r.mcd_id)
                self.assertIsNone(r.bias, r.mcd_id)

    def test_junk_in_the_bundle_never_raises_and_never_saves_a_state_for_a_failure(self) -> None:
        for field, junk in (("bars", None), ("bars", 5), ("statistics", None), ("active_indicator", None), ("config_hash", "x"), ("stats_slot", None)):
            result = self.results(dataclasses.replace(s.bundle("v3"), **{field: junk}))
            self.assertEqual(len(result.results), 4, (field, junk))
            for r in result.results:
                self.assertEqual(env.schema_errors(r.envelope), [], (field, junk, r.mcd_id))
                self.assertEqual(r.guard_problems, (), (field, junk, r.mcd_id))


class BundleTests(unittest.TestCase):
    def test_a_bundle_that_cannot_be_keyed_is_refused(self) -> None:
        worker = s.real_worker()
        good = s.bundle("v1")
        for label, bad in (
            ("not a bundle", {"cycle_slot": "x"}),
            ("a slot not on the grid", dataclasses.replace(good, cycle_slot="2026-09-18T20:57Z")),
            ("no slot", dataclasses.replace(good, cycle_slot=None)),
            ("an empty symbol", dataclasses.replace(good, symbol="")),
            ("no symbol", dataclasses.replace(good, symbol=None)),
            ("retuning as text", dataclasses.replace(good, retuning="false")),
            ("retuning as a number", dataclasses.replace(good, retuning=1)),
            ("retuning missing", dataclasses.replace(good, retuning=None)),
        ):
            with self.assertRaises(BundleError, msg=label):
                worker.run_cycle(bad)  # type: ignore[arg-type]

    def test_retuning_enforced_must_be_a_boolean(self) -> None:
        for bad in ("true", 1, None, 0):
            with self.assertRaises(ConfigError, msg=repr(bad)):
                s.real_worker().run_cycle(s.bundle("v1"), retuning_enforced=bad)  # type: ignore[arg-type]

    def test_a_run_changes_nothing_in_the_bundle(self) -> None:
        inputs = s.bundle("v3")
        before = cr.bundle_canonical_json(inputs)
        s.real_worker().run_cycle(inputs)
        s.real_worker().run_cycle(dataclasses.replace(inputs, retuning=True), retuning_enforced=True)
        self.assertEqual(cr.bundle_canonical_json(inputs), before)


class InputsHashTests(unittest.TestCase):
    def test_the_hash_is_the_sha256_of_the_canonical_bundle(self) -> None:
        inputs = s.bundle("v1")
        result = s.real_worker().run_cycle(inputs)
        self.assertEqual(result.inputs_sha256, cr.sha256_text(cr.bundle_canonical_json(inputs)))
        self.assertEqual(len(result.inputs_sha256), 64)

    def test_the_canonical_text_has_sorted_keys_and_no_spaces(self) -> None:
        text = cr.bundle_canonical_json(s.bundle("v1"))
        self.assertNotIn(", ", text)
        self.assertNotIn(": ", text)
        self.assertEqual(json.dumps(json.loads(text), sort_keys=True, separators=(",", ":")), text)

    def test_one_changed_value_changes_the_hash_and_the_same_value_does_not(self) -> None:
        worker = s.real_worker()
        base = worker.run_cycle(s.bundle("v1")).inputs_sha256
        self.assertEqual(worker.run_cycle(s.bundle("v1")).inputs_sha256, base)
        changed = s.with_statistics(s.bundle("v1"), "M5", regression_angle=7.0)
        self.assertNotEqual(worker.run_cycle(changed).inputs_sha256, base)
        self.assertNotEqual(worker.run_cycle(dataclasses.replace(s.bundle("v1"), data_status="DELAYED")).inputs_sha256, base)

    def test_the_hash_covers_retuning_as_received(self) -> None:
        worker = s.real_worker()
        inputs = s.bundle("v1")
        self.assertNotEqual(
            worker.run_cycle(inputs).inputs_sha256, worker.run_cycle(dataclasses.replace(inputs, retuning=True)).inputs_sha256
        )

    def test_a_bundle_that_cannot_be_hashed_still_gets_its_readings(self) -> None:
        inputs = dataclasses.replace(s.bundle("v3"), statistics={"not a pair": {"x": 1}})
        with _quiet():
            result = s.real_worker().run_cycle(inputs)
        self.assertIsNone(result.inputs_sha256)
        self.assertIsNone(result.bundle_canonical_json, "no hash, no text: the two come from one serialisation or neither does")
        self.assertEqual(len(result.results), 4)


class BundleTextTests(unittest.TestCase):
    """``bundle_canonical_json``: the exact text the hash is of, returned so the worker stores it (Davin, part 3 decision 3, option a).

    JavaScript and Python write a float differently (``1e-05`` against ``0.00001``), so the gateway must not rebuild this text.
    """

    def test_the_text_is_the_canonical_bundle_and_its_hash_is_inputs_sha256(self) -> None:
        for name in s.SLOTS:
            inputs = s.bundle(name)
            result = s.real_worker().run_cycle(inputs)
            self.assertEqual(result.bundle_canonical_json, cr.bundle_canonical_json(inputs), name)
            self.assertEqual(cr.sha256_text(result.bundle_canonical_json), result.inputs_sha256, name)

    def test_the_text_is_the_bundle_as_received_not_the_one_the_sensors_saw(self) -> None:
        """RETUNING is switched off for the evaluators when it is not enforced; the stored bundle keeps what the cycle said."""
        inputs = dataclasses.replace(s.bundle("v1"), retuning=True)
        result = s.real_worker().run_cycle(inputs, retuning_enforced=False)
        self.assertFalse(result.retuning_applied)
        self.assertTrue(json.loads(result.bundle_canonical_json)["retuning"])
        self.assertEqual(result.bundle_canonical_json, cr.bundle_canonical_json(inputs))

    def test_the_text_does_not_depend_on_the_order_the_keys_arrived_in(self) -> None:
        raw = json.loads(s.bundle_text("v3"))
        reversed_keys = {k: raw[k] for k in reversed(list(raw))}
        a = s.real_worker().run_cycle(CycleInputs.from_dict(raw)).bundle_canonical_json
        b = s.real_worker().run_cycle(CycleInputs.from_dict(reversed_keys)).bundle_canonical_json
        self.assertEqual(a, b)

    def test_the_text_survives_a_json_round_trip_byte_for_byte(self) -> None:
        """Parsed and written again by Python it is the same text: what a replay sends back hashes to the same value."""
        text = s.real_worker().run_cycle(s.bundle("v4")).bundle_canonical_json
        again = cr.bundle_canonical_json(CycleInputs.from_dict(json.loads(text)))
        self.assertEqual(again, text)

    def test_the_text_is_ascii_so_its_byte_length_is_its_character_length(self) -> None:
        text = s.real_worker().run_cycle(s.bundle("v1")).bundle_canonical_json
        self.assertEqual(len(text.encode("ascii")), len(text))

    def test_the_text_is_returned_even_when_no_mcd_is_enabled(self) -> None:
        """The committed configuration runs nothing; the text is a fact about the input, not about a reading (the worker decides to store it)."""
        nothing = cr.Worker.load()
        result = nothing.run_cycle(s.bundle("v1"))
        self.assertEqual(result.results, ())
        self.assertEqual(result.bundle_canonical_json, cr.bundle_canonical_json(s.bundle("v1")))

    def test_to_dict_carries_the_text_and_deterministic_dict_does_not(self) -> None:
        result = s.real_worker().run_cycle(s.bundle("v1"))
        self.assertEqual(result.to_dict()["bundle_canonical_json"], result.bundle_canonical_json)
        self.assertNotIn("bundle_canonical_json", result.deterministic_dict())


if __name__ == "__main__":
    unittest.main()
