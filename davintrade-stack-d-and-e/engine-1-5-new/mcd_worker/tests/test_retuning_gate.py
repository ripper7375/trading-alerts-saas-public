"""The RETUNING switch (rule 9; Davin's Q6, 2026-10-03; "Done when" item 7 of section 2.11).

The ``retuning`` flag of the bundle is always read and recorded. It changes a reading only when RETUNING is
**enforced**, and enforcement is **off by default**: until a promote has been rehearsed and Davin has settled how
RETUNING ends (build step 3, B5), production sensors stay VALID during a promote although rule 9 says CAUTIONARY.
"""

from __future__ import annotations

import dataclasses
import inspect
import unittest

from mcd_common import reason_codes as rc

from mcd_worker import cycle_runner as cr
from mcd_worker.tests import support as s


def run(name: str, *, retuning: bool, enforced: bool | None = None):
    inputs = dataclasses.replace(s.bundle(name), retuning=retuning)
    worker = s.real_worker()
    return worker.run_cycle(inputs) if enforced is None else worker.run_cycle(inputs, retuning_enforced=enforced)


class TheDefaultIsNotEnforcedTests(unittest.TestCase):
    def test_run_cycle_defaults_to_not_enforced(self) -> None:
        parameter = inspect.signature(cr.Worker.run_cycle).parameters["retuning_enforced"]
        self.assertIs(parameter.default, False)
        self.assertEqual(parameter.kind, inspect.Parameter.KEYWORD_ONLY)

    def test_a_promote_changes_no_reading_by_default(self) -> None:
        for name in s.SLOTS:
            promoting = run(name, retuning=True)
            quiet = run(name, retuning=False)
            for a, b in zip(promoting.results, quiet.results):
                self.assertEqual(a.envelope_json, b.envelope_json, (name, a.mcd_id))
                self.assertNotIn(rc.RETUNING, a.envelope["status_reasons"], (name, a.mcd_id))

    def test_the_observation_is_recorded_and_the_application_is_not(self) -> None:
        result = run("v1", retuning=True)
        self.assertEqual((result.retuning_observed, result.retuning_enforced, result.retuning_applied), (True, False, False))
        self.assertEqual(result.deterministic_dict()["retuning"], {"observed": True, "enforced": False, "applied": False})

    def test_no_promote_is_recorded_as_not_observed(self) -> None:
        result = run("v1", retuning=False)
        self.assertEqual((result.retuning_observed, result.retuning_enforced, result.retuning_applied), (False, False, False))

    def test_the_evaluators_never_see_retuning_when_it_is_not_enforced(self) -> None:
        calls = s.Calls()
        worker = s.synthetic_worker(s.synthetic_sensors(mcd2=s.stub("MCD2", state="MCD2_UP", bias="LONG", calls=calls)))
        worker.run_cycle(s.tiny_inputs(retuning=True))
        self.assertEqual([seen for seen, _ in calls.items], [False])


class EnforcedTests(unittest.TestCase):
    def test_every_sensor_is_cautionary_with_retuning_when_enforced(self) -> None:
        """Item 7: during a promote every sensor reports CAUTIONARY, with RETUNING first (the cycle check runs first)."""
        for name in s.SLOTS:
            result = run(name, retuning=True, enforced=True)
            by = result.by_id()
            for mcd_id in ("MCD0", "MCD1", "MCD2", "MCD3"):
                self.assertEqual(by[mcd_id].status, rc.CAUTIONARY, (name, mcd_id))
                self.assertEqual(by[mcd_id].envelope["status_reasons"][0], rc.RETUNING, (name, mcd_id))
            self.assertEqual(by["MCD0"].envelope["status_reasons"], [rc.RETUNING], name)
            self.assertEqual(by["MCD1"].envelope["status_reasons"], [rc.RETUNING], name)
            self.assertEqual(by["MCD2"].envelope["status_reasons"], [rc.RETUNING], name)
            self.assertEqual(by["MCD3"].envelope["status_reasons"], [rc.RETUNING, "UPSTREAM_CAUTIONARY:MCD1", "UPSTREAM_CAUTIONARY:MCD2"], name)

    def test_a_cautionary_gate_passes_no_defect_on_so_only_retuning_is_the_reason(self) -> None:
        """Davin's Q5 b read literally: a CAUTIONARY MCD0 propagates nothing; the channel MCDs already carry RETUNING."""
        result = run("v1", retuning=True, enforced=True)
        self.assertEqual(result.gate_status, rc.CAUTIONARY)
        self.assertEqual(result.gate_state, "MCD0_M5_M15_DEFECT")
        self.assertEqual(result.defect_timeframes, ())
        for r in result.results:
            self.assertEqual(r.inherited_reasons, (), r.mcd_id)

    def test_the_states_and_levels_are_kept_while_retuning(self) -> None:
        enforced = run("v3", retuning=True, enforced=True).by_id()
        quiet = run("v3", retuning=False).by_id()
        for mcd_id in ("MCD1", "MCD2", "MCD3"):
            self.assertEqual(enforced[mcd_id].state_code, quiet[mcd_id].state_code, mcd_id)
            self.assertEqual(enforced[mcd_id].envelope["levels"], quiet[mcd_id].envelope["levels"], mcd_id)
            self.assertEqual(enforced[mcd_id].bias, quiet[mcd_id].bias, mcd_id)

    def test_applied_means_observed_and_enforced(self) -> None:
        for observed in (False, True):
            for enforced in (False, True):
                result = run("v1", retuning=observed, enforced=enforced)
                self.assertEqual(
                    (result.retuning_observed, result.retuning_enforced, result.retuning_applied), (observed, enforced, observed and enforced), (observed, enforced)
                )

    def test_enforced_with_no_promote_changes_nothing(self) -> None:
        a = run("v1", retuning=False, enforced=True)
        b = run("v1", retuning=False, enforced=False)
        self.assertEqual([r.envelope_json for r in a.results], [r.envelope_json for r in b.results])
        self.assertFalse(a.retuning_applied)

    def test_the_evaluators_see_retuning_exactly_when_it_is_applied(self) -> None:
        for observed, enforced, expected in ((True, True, True), (True, False, False), (False, True, False), (False, False, False)):
            calls = s.Calls()
            worker = s.synthetic_worker(s.synthetic_sensors(mcd2=s.stub("MCD2", state="MCD2_UP", bias="LONG", calls=calls)))
            worker.run_cycle(s.tiny_inputs(retuning=observed), retuning_enforced=enforced)
            self.assertEqual([seen for seen, _ in calls.items], [expected], (observed, enforced))

    def test_the_bundle_keeps_its_observed_value(self) -> None:
        inputs = dataclasses.replace(s.bundle("v1"), retuning=True)
        s.real_worker().run_cycle(inputs)
        s.real_worker().run_cycle(inputs, retuning_enforced=True)
        self.assertIs(inputs.retuning, True)

    def test_the_hash_is_of_the_bundle_as_received_whether_or_not_it_is_applied(self) -> None:
        inputs = dataclasses.replace(s.bundle("v1"), retuning=True)
        worker = s.real_worker()
        self.assertEqual(worker.run_cycle(inputs).inputs_sha256, worker.run_cycle(inputs, retuning_enforced=True).inputs_sha256)

    def test_stale_data_wins_over_retuning(self) -> None:
        inputs = dataclasses.replace(s.bundle("v1"), retuning=True, data_status="STALE")
        result = s.real_worker().run_cycle(inputs, retuning_enforced=True)
        for r in result.results:
            self.assertEqual(r.status, rc.STALE, r.mcd_id)


if __name__ == "__main__":
    unittest.main()
