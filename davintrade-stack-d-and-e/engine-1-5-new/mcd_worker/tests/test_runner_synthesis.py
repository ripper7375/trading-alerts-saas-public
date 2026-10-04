"""Synthesis inside the cycle runner (build step 4, part 3): the SYN flag, what synthesis may see, what it may never do, and the 12 envelope hashes.

Three promises are pinned here.

1. **Synthesis changes no sensor reading.** With ``SYN`` ``off`` a result is byte for byte what it was before synthesis existed; with it on, the
   ``results`` are the same bytes, and a bundle with or without ``context_levels`` gives the same 12 envelope hashes (4 MCDs x 3 stored cycles,
   pinned below from the cycles stored before this part).
2. **Synthesis cannot cost a cycle its sensor readings.** An exception in it ends in ``synthesis.error``, never in a missing or changed MCD row.
3. **Which sensors synthesis sees follows its flag** (decision D10): ``shadow`` reads the shadow and the live sensors, ``live`` the live ones only.
"""

from __future__ import annotations

import dataclasses
import io
import json
import logging
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from typing import Any, Mapping
from unittest import mock

from mcd_worker import cli
from mcd_worker import flags as flags_module
from mcd_worker.cycle_runner import CycleResult, Worker
from mcd_worker.errors import ConfigError
from mcd_worker.flags import (
    DEFAULT_CONFIG_PATH,
    DEFAULT_RULES_VERSION,
    SYN_ID,
    load_worker_config,
    synthesis_flag_problems,
    worker_config_from_dict,
)
from mcd_worker.synthesis import rules as rules_module
from mcd_worker.synthesis.cycle import (
    READING_REFUSED,
    SYNTHESIS_ERROR,
    ZONES_REFUSED,
    Synthesizer,
)
from mcd_worker.tests import support as s
from mcd_worker.tests import synthesis_support as sy

SYN_SHADOW = {**s.SHADOW_ALL, SYN_ID: "shadow"}
SYN_SHADOW_MCDS = {i: "shadow" for i in s.MCD_IDS}

# (slot, MCD) -> (envelope_sha256, evaluator_envelope_sha256), as stored in fixtures/<slot>.cycle.json before build step 4 part 3. These are the
# 12 envelope hashes the part promised to leave byte-identical: adding ``context_levels`` and synthesis moved none of them. A hash changes only with
# an evaluator, an envelope field, or the inheritance mark: regenerate it after reading what changed, never to make a test pass.
ENVELOPE_HASHES = {
    ("2026-09-18T20:55Z", "MCD0"): ("62100eb03d908e6d480d918b6faa6bea8e8ca6c7edfec6dc66d29417199ed0ec", "62100eb03d908e6d480d918b6faa6bea8e8ca6c7edfec6dc66d29417199ed0ec"),
    ("2026-09-18T20:55Z", "MCD1"): ("05c6264bb4486856a5a75b0358dce55c340122df7d1149706a0a398be938b705", "b1ccd443efa50842652f58510bb5d8458f755df36c260a63559756368514e121"),
    ("2026-09-18T20:55Z", "MCD2"): ("050acdd7cb324e519248c967824ca97038c34f77b394c0aab63eddd97a8c4347", "01b4b12cc0b6fd2a476762732a090175853259a13abfdd11dfef31da455f56d9"),
    ("2026-09-18T20:55Z", "MCD3"): ("131872b470035a33cf1d0212bf5004197850ab79a82ba13b53680f0f2c4e94d6", "937586112bac19537c0235d6809eb7d2ab836eb20ba35c92f55ae773dea9ac54"),
    ("2026-09-28T14:15Z", "MCD0"): ("f6634e45b6101b9732250fa1c5b24c977e5e5b7c7ee6749d8cd04ff54d3d48a4", "f6634e45b6101b9732250fa1c5b24c977e5e5b7c7ee6749d8cd04ff54d3d48a4"),
    ("2026-09-28T14:15Z", "MCD1"): ("4ce93d8947ed710031dc3c9d5080d64c2f30ffec03a2f911b3e4a46c645e57c7", "915e38b8b2fe2cc4856b8728483fd66c33ff8dd9e2a42116a1b8aaf772a23055"),
    ("2026-09-28T14:15Z", "MCD2"): ("ce8fe51f7a68782f8fa366a4ed4ac1277692f7259be969cf447eed836e1d015f", "0ea463ace40f079d0115119e86070698a763b52a9eb509bcf952aef317b64ad1"),
    ("2026-09-28T14:15Z", "MCD3"): ("00e5e99963842ecf566f8a1da35f8546e9dd98ce0a64f0399d9fea7e35effe90", "8280e816060f98c3d62335f37d437118c32ceb4ca533eead6efc6ecb66c0ff7f"),
    ("2026-09-28T23:15Z", "MCD0"): ("4c7aaf7a0db662af5d2d3fcc45ec735f2a8738b166c26d23492e602443a15c29", "4c7aaf7a0db662af5d2d3fcc45ec735f2a8738b166c26d23492e602443a15c29"),
    ("2026-09-28T23:15Z", "MCD1"): ("389b434354589e3e2ca30ca094f8c7a4891ffcc22235576e19a2182b19186fe0", "50666ba70ad183a22e88de85aecd81f1dd95bcba5019b963dc423e09dc4a6920"),
    ("2026-09-28T23:15Z", "MCD2"): ("6cb5123a89813eda8c102d4c7a8ce5e653358e9b605b0785a221e0b7e9ccf6e5", "bb1ac71b9ba2373cb4a74f6ecc3dd4c4c045fb581e137ced129dd947051a677c"),
    ("2026-09-28T23:15Z", "MCD3"): ("2cb3b351c2a3d56a74b9a54295589ed811c6523890696f2fb1a81cacc875fe93", "6778f75f8edc9ac58579407a51ba2214e04d060775f1e1ee6e9a32310e4e9abd"),
}

# the hash of each bundle before it carried ``context_levels``: a bundle without the section must still hash to this
INPUTS_SHA256_WITHOUT_LEVELS = {
    "v1": "247ef8e1e59dec868191fd41f0bcf7c41b1a75538edf9e501cd8b9c8e7bd9738",
    "v3": "69fe11cf4623a2a855d155d7d80e6535747eea94603a96da9e68190a74d96d74",
    "v4": "ddab246f674100503f92454b7829f83aab705dd15f11f57924f972a915ed4eda",
}


def with_synthesis(flag: str = "shadow") -> Worker:
    return Worker.load(flags={**s.SHADOW_ALL, SYN_ID: flag})


def hashes_of(result: CycleResult) -> dict[tuple[str, str], tuple[str, str]]:
    return {(result.cycle_slot, r.mcd_id): (r.envelope_sha256, r.evaluator_envelope_sha256) for r in result.results}


def without_levels(name: str):
    return dataclasses.replace(s.bundle(name), context_levels={})


class Recorder(Synthesizer):
    """A synthesizer that remembers which readings the runner handed it."""

    def __init__(self, inner: Synthesizer) -> None:
        super().__init__(inner.rules, inner.params)
        self.seen: list[tuple[str, dict[str, Any]]] = []

    def run(self, flag, readings, inputs):
        self.seen.append((flag, dict(readings)))
        return super().run(flag, readings, inputs)


class Raiser(Synthesizer):
    def __init__(self, inner: Synthesizer) -> None:
        super().__init__(inner.rules, inner.params)

    def run(self, flag, readings, inputs):
        raise RuntimeError("a bug in synthesis")


def real_synthesizer() -> Synthesizer:
    return Synthesizer.load(sy.registry())


def worker_with(synthesizer: Synthesizer | None, mcd_flags: Mapping[str, str], synthesis_flag: str) -> Worker:
    """The real four MCDs with the flags given and checklists that allow any of them, over a synthesizer of the caller's choice."""
    registry = sy.registry()
    return Worker(registry, mcd_flags, s.all_passed(list(registry)), synthesis_flag=synthesis_flag, synthesizer=synthesizer)


# --------------------------------------------------------------------------- the flag rule


class SynthesisFlagRuleTests(unittest.TestCase):
    ALL = {"MCD0": "live", "MCD1": "live", "MCD2": "live", "MCD3": "live"}

    def test_off_is_always_allowed(self) -> None:
        for mcd_flags in ({}, {"MCD1": "off"}, {"MCD1": "off", "MCD2": "off"}, self.ALL):
            self.assertEqual(synthesis_flag_problems("off", mcd_flags), [])

    def test_shadow_needs_mcd1_and_mcd2_at_shadow_or_live(self) -> None:
        for one, two in (("shadow", "shadow"), ("live", "shadow"), ("shadow", "live"), ("live", "live")):
            self.assertEqual(synthesis_flag_problems("shadow", {"MCD1": one, "MCD2": two}), [], (one, two))
        for one, two in (("off", "shadow"), ("shadow", "off"), ("off", "off")):
            self.assertTrue(synthesis_flag_problems("shadow", {"MCD1": one, "MCD2": two}), (one, two))

    def test_live_needs_mcd1_and_mcd2_live(self) -> None:
        self.assertEqual(synthesis_flag_problems("live", self.ALL), [])
        self.assertEqual(len(synthesis_flag_problems("live", {"MCD1": "shadow", "MCD2": "shadow"})), 2)
        self.assertEqual(len(synthesis_flag_problems("live", {"MCD1": "live", "MCD2": "shadow"})), 1)
        self.assertEqual(len(synthesis_flag_problems("live", {"MCD1": "shadow", "MCD2": "live"})), 1)

    def test_each_problem_names_the_flag_and_the_sensor(self) -> None:
        problems = synthesis_flag_problems("live", {"MCD1": "shadow", "MCD2": "live"})
        self.assertEqual(len(problems), 1)
        self.assertIn("SYN", problems[0])
        self.assertIn("MCD1", problems[0])
        self.assertIn("'shadow'", problems[0])

    def test_a_sensor_with_no_flag_is_refused(self) -> None:
        problems = synthesis_flag_problems("shadow", {"MCD1": "shadow"})
        self.assertEqual(len(problems), 1)
        self.assertIn("MCD2", problems[0])
        self.assertIn("no flag", problems[0])

    def test_mcd0_and_mcd3_do_not_matter(self) -> None:
        """MCD3 only modifies a result and MCD0 is the gate the sensors already answer to: neither can hold synthesis back."""
        self.assertEqual(synthesis_flag_problems("live", {"MCD0": "off", "MCD1": "live", "MCD2": "live", "MCD3": "off"}), [])

    def test_a_value_that_is_not_a_flag_is_refused(self) -> None:
        for bad in ("on", "SHADOW", "", None, False, True, 0, 1, ["shadow"]):
            problems = synthesis_flag_problems(bad, self.ALL)
            self.assertEqual(len(problems), 1, bad)
            self.assertIn("SYN", problems[0])


# --------------------------------------------------------------------------- the configuration


class ConfigFileTests(unittest.TestCase):
    def test_the_committed_configuration_has_synthesis_off_with_the_draft_rules(self) -> None:
        config = load_worker_config(DEFAULT_CONFIG_PATH)
        self.assertEqual(config.synthesis_flag, "off")
        self.assertEqual(config.rules_version, "draft-1")
        self.assertNotIn(SYN_ID, config.flags)
        self.assertEqual(set(config.flags), {"MCD0", "MCD1", "MCD2", "MCD3"})

    def test_the_two_places_that_name_the_default_rules_version_agree(self) -> None:
        self.assertEqual(flags_module.DEFAULT_RULES_VERSION, rules_module.DEFAULT_RULES_VERSION)
        self.assertEqual(DEFAULT_RULES_VERSION, "draft-1")
        self.assertTrue((rules_module.RULES_DIR / f"{DEFAULT_RULES_VERSION}.yaml").is_file())

    def test_the_committed_rules_version_names_a_rules_file(self) -> None:
        config = load_worker_config(DEFAULT_CONFIG_PATH)
        self.assertTrue((rules_module.RULES_DIR / f"{config.rules_version}.yaml").is_file())

    def parse(self, **changes: Any):
        data: dict[str, Any] = {"schema": "mcd-worker-config/1", "flags": {"MCD0": "off", "MCD1": "off"}}
        data.update(changes)
        return worker_config_from_dict(data)

    def test_a_file_without_syn_has_it_off_and_the_default_rules(self) -> None:
        config = self.parse()
        self.assertEqual((config.synthesis_flag, config.rules_version), ("off", "draft-1"))

    def test_syn_is_read_out_of_the_flags_and_kept_apart_from_the_mcds(self) -> None:
        config = self.parse(flags={"MCD0": "shadow", "SYN": "shadow"})
        self.assertEqual(config.synthesis_flag, "shadow")
        self.assertEqual(dict(config.flags), {"MCD0": "shadow"})

    def test_a_syn_flag_that_is_not_a_flag_is_refused(self) -> None:
        for bad in ("on", False, None, 1):
            with self.assertRaises(ConfigError, msg=repr(bad)) as ctx:
                self.parse(flags={"MCD0": "off", "SYN": bad})
            self.assertIn("SYN", "\n".join(ctx.exception.problems))

    def test_the_rules_version_is_read_from_the_synthesis_section(self) -> None:
        self.assertEqual(self.parse(synthesis={"rules_version": "v2-trial.1"}).rules_version, "v2-trial.1")

    def test_a_rules_version_that_is_not_a_name_is_refused(self) -> None:
        for bad in ("", "Draft-1", "../draft-1", "draft 1", "-draft", 1, None, ["draft-1"]):
            with self.assertRaises(ConfigError, msg=repr(bad)):
                self.parse(synthesis={"rules_version": bad})

    def test_the_synthesis_section_must_be_a_mapping_with_known_keys(self) -> None:
        for bad in ("draft-1", ["draft-1"], 3, None):
            with self.assertRaises(ConfigError, msg=repr(bad)):
                self.parse(synthesis=bad)
        with self.assertRaises(ConfigError) as ctx:
            self.parse(synthesis={"rules_version": "draft-1", "zones": "x"})
        self.assertIn("zones", "\n".join(ctx.exception.problems))

    def test_unknown_top_level_keys_are_still_refused(self) -> None:
        with self.assertRaises(ConfigError):
            self.parse(synth={"rules_version": "draft-1"})

    def test_an_empty_synthesis_section_changes_nothing(self) -> None:
        config = self.parse(synthesis={})
        self.assertEqual((config.synthesis_flag, config.rules_version), ("off", "draft-1"))


# --------------------------------------------------------------------------- the worker


class WorkerStartTests(unittest.TestCase):
    def test_the_committed_worker_has_synthesis_off_and_no_synthesizer(self) -> None:
        worker = Worker.load()
        self.assertEqual(worker.synthesis_flag, "off")
        self.assertIsNone(worker.synthesizer)

    def test_a_worker_with_synthesis_off_never_reads_the_rules(self) -> None:
        with mock.patch.object(Synthesizer, "load", side_effect=AssertionError("the rules were read")):
            worker = Worker.load(flags=s.SHADOW_ALL)
        self.assertIsNone(worker.synthesizer)

    def test_shadow_loads_the_rules_and_the_zone_parameters(self) -> None:
        worker = with_synthesis("shadow")
        self.assertEqual(worker.synthesis_flag, "shadow")
        self.assertIsInstance(worker.synthesizer, Synthesizer)
        self.assertEqual(worker.synthesizer.rules.version, "draft-1")

    def test_the_flag_given_to_load_replaces_the_files(self) -> None:
        self.assertEqual(Worker.load(flags={SYN_ID: "off"}).synthesis_flag, "off")
        self.assertEqual(with_synthesis("shadow").synthesis_flag, "shadow")

    def test_syn_does_not_leak_into_the_mcd_flags(self) -> None:
        worker = with_synthesis("shadow")
        self.assertNotIn(SYN_ID, worker.flags)
        self.assertEqual(worker.order, s.real_worker().order)

    def test_a_value_that_is_not_a_flag_stops_the_worker(self) -> None:
        with self.assertRaises(ConfigError) as ctx:
            Worker.load(flags={**s.SHADOW_ALL, SYN_ID: "on"})
        self.assertIn("SYN", "\n".join(ctx.exception.problems))

    def test_synthesis_higher_than_a_sensor_it_reads_stops_the_worker(self) -> None:
        for mcd_flags in ({**s.SHADOW_ALL}, {**s.SHADOW_ALL, "MCD2": "off"}):
            with self.assertRaises(ConfigError) as ctx:
                Worker.load(flags={**mcd_flags, SYN_ID: "live"})
            self.assertIn("SYN", "\n".join(ctx.exception.problems))

    def test_synthesis_beside_sensors_that_are_off_stops_the_worker(self) -> None:
        with self.assertRaises(ConfigError):
            Worker.load(flags={"MCD0": "off", "MCD1": "off", "MCD2": "off", "MCD3": "off", SYN_ID: "shadow"})

    def test_a_worker_over_a_flag_that_needs_a_synthesizer_and_has_none_is_refused(self) -> None:
        for flag in ("shadow", "live"):
            with self.assertRaises(ConfigError) as ctx:
                worker_with(None, {i: "live" for i in s.MCD_IDS}, flag)
            self.assertIn("synthesizer", "\n".join(ctx.exception.problems), flag)

    def test_a_synthesizer_with_the_flag_off_is_never_run(self) -> None:
        recorder = Recorder(real_synthesizer())
        worker = worker_with(recorder, {i: "live" for i in s.MCD_IDS}, "off")
        result = worker.run_cycle(s.bundle("v1"))
        self.assertEqual(recorder.seen, [])
        self.assertIsNone(result.synthesis)

    def test_the_rules_version_is_a_named_file_and_a_missing_one_stops_the_worker(self) -> None:
        with self.assertRaises(ConfigError):
            Worker.load(flags=SYN_SHADOW, rules_version="no-such-rules")

    def test_a_rules_version_is_not_looked_for_when_synthesis_is_off(self) -> None:
        self.assertIsNone(Worker.load(flags=s.SHADOW_ALL, rules_version="no-such-rules").synthesizer)

    def test_synthesizer_load_checks_the_rules_against_the_registry(self) -> None:
        synthesizer = Synthesizer.load(sy.registry())
        self.assertEqual(synthesizer.rules.version, DEFAULT_RULES_VERSION)
        self.assertEqual(synthesizer.rules.sha256, sy.rules().sha256)
        self.assertEqual(synthesizer.params.sha256, sy.zone_params().sha256)

    def test_synthesizer_load_refuses_a_missing_rules_file_and_a_missing_parameters_file(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaises(ConfigError):
                Synthesizer.load(sy.registry(), rules_dir=tmp)
            with self.assertRaises(ConfigError):
                Synthesizer.load(sy.registry(), params_path=Path(tmp, "zone_params.yaml"))


# --------------------------------------------------------------------------- the result


class OffIsInvisibleTests(unittest.TestCase):
    def test_with_synthesis_off_the_result_has_no_synthesis_anywhere(self) -> None:
        for name in s.SLOTS:
            result = s.real_worker().run_cycle(s.bundle(name))
            self.assertEqual((result.synthesis_flag, result.synthesis, result.synthesis_ms), ("off", None, None), name)
            self.assertNotIn("synthesis", result.deterministic_dict())
            self.assertNotIn("synthesis", result.to_dict())
            self.assertEqual(set(result.to_dict()["runtime"]), {"python", "timings_ms"})

    def test_the_result_is_the_stored_cycle_byte_for_byte(self) -> None:
        for name in s.SLOTS:
            text = json.dumps(s.real_worker().run_cycle(s.bundle(name)).deterministic_dict(), indent=2, ensure_ascii=True) + "\n"
            self.assertEqual(text, s.stored_cycle_text(name).replace("\r\n", "\n"), name)


class OnLeavesTheSensorsAloneTests(unittest.TestCase):
    def test_the_sensor_rows_are_the_same_bytes_with_synthesis_on(self) -> None:
        for name in s.SLOTS:
            off = s.real_worker().run_cycle(s.bundle(name)).deterministic_dict()
            on = with_synthesis("shadow").run_cycle(s.bundle(name)).deterministic_dict()
            self.assertEqual(json.dumps(on["results"]), json.dumps(off["results"]), name)
            on_rest = {k: v for k, v in on.items() if k != "synthesis"}
            self.assertEqual(json.dumps(on_rest), json.dumps(off), name)
            self.assertIn("synthesis", on)

    def test_every_other_part_of_the_result_object_is_the_same_too(self) -> None:
        off = s.real_worker().run_cycle(s.bundle("v3"))
        on = with_synthesis("shadow").run_cycle(s.bundle("v3"))
        fields = ("inputs_sha256", "order", "flags", "gate_status", "gate_state", "defect_timeframes", "retuning_observed", "retuning_applied")
        self.assertEqual([getattr(on, f) for f in fields], [getattr(off, f) for f in fields])
        self.assertEqual(on.synthesis_flag, "shadow")

    def test_the_runtime_gains_only_the_synthesis_time(self) -> None:
        runtime = with_synthesis("shadow").run_cycle(s.bundle("v1")).to_dict()["runtime"]
        self.assertEqual(set(runtime), {"python", "timings_ms", "synthesis_ms"})
        self.assertGreaterEqual(runtime["synthesis_ms"], 0)
        self.assertEqual(set(runtime["timings_ms"]), set(s.MCD_IDS))

    def test_synthesis_does_not_change_the_readings_it_is_handed(self) -> None:
        recorder = Recorder(real_synthesizer())
        result = worker_with(recorder, SYN_SHADOW_MCDS, "shadow").run_cycle(s.bundle("v4"))
        (_, seen), = recorder.seen
        for row in result.results:
            self.assertEqual(json.dumps(seen[row.mcd_id], sort_keys=True), json.dumps(json.loads(row.envelope_json), sort_keys=True), row.mcd_id)


class EnvelopeHashTests(unittest.TestCase):
    """The 12 envelope hashes: 4 sensors on each of the 3 stored cycles, with the SYN flag off or on, and with or without ``context_levels``."""

    def test_pinned_hashes_cover_every_sensor_of_every_stored_cycle(self) -> None:
        self.assertEqual(len(ENVELOPE_HASHES), 12)
        self.assertEqual({slot for slot, _ in ENVELOPE_HASHES}, set(s.SLOTS.values()))
        self.assertEqual({mcd for _, mcd in ENVELOPE_HASHES}, set(s.MCD_IDS))

    def expected(self, name: str) -> dict[tuple[str, str], tuple[str, str]]:
        return {key: value for key, value in ENVELOPE_HASHES.items() if key[0] == s.SLOTS[name]}

    def test_with_synthesis_off_and_the_levels_in_the_bundle(self) -> None:
        for name in s.SLOTS:
            self.assertEqual(hashes_of(s.real_worker().run_cycle(s.bundle(name))), self.expected(name), name)

    def test_with_synthesis_off_and_no_levels(self) -> None:
        for name in s.SLOTS:
            self.assertEqual(hashes_of(s.real_worker().run_cycle(without_levels(name))), self.expected(name), name)

    def test_with_synthesis_on_and_the_levels_in_the_bundle(self) -> None:
        for name in s.SLOTS:
            self.assertEqual(hashes_of(with_synthesis("shadow").run_cycle(s.bundle(name))), self.expected(name), name)

    def test_with_synthesis_on_and_no_levels(self) -> None:
        for name in s.SLOTS:
            self.assertEqual(hashes_of(with_synthesis("shadow").run_cycle(without_levels(name))), self.expected(name), name)

    def test_the_stored_cycles_carry_the_same_hashes(self) -> None:
        for name in s.SLOTS:
            stored = json.loads(s.stored_cycle_text(name))
            found = {(stored["cycle_slot"], r["mcd_id"]): (r["envelope_sha256"], r["evaluator_envelope_sha256"]) for r in stored["results"]}
            self.assertEqual(found, self.expected(name), name)

    def test_the_levels_change_the_hash_of_the_bundle_and_nothing_else(self) -> None:
        for name in s.SLOTS:
            plain = s.real_worker().run_cycle(without_levels(name))
            full = s.real_worker().run_cycle(s.bundle(name))
            self.assertEqual(plain.inputs_sha256, INPUTS_SHA256_WITHOUT_LEVELS[name], name)  # a bundle without the section hashes as it always did
            self.assertEqual(full.inputs_sha256, json.loads(s.stored_cycle_text(name))["inputs_sha256"], name)
            self.assertNotEqual(full.inputs_sha256, plain.inputs_sha256, name)
            self.assertEqual([r.envelope_json for r in full.results], [r.envelope_json for r in plain.results], name)

    def test_a_bundle_with_the_levels_still_in_another_order_gives_the_same_hashes(self) -> None:
        data = json.loads(s.bundle_text("v3"))
        data["context_levels"] = {tf: dict(reversed(list(levels.items()))) for tf, levels in reversed(list(data["context_levels"].items()))}
        shuffled = type(s.bundle("v3")).from_dict(data)
        self.assertEqual(s.real_worker().run_cycle(shuffled).inputs_sha256, s.real_worker().run_cycle(s.bundle("v3")).inputs_sha256)


# --------------------------------------------------------------------------- what synthesis sees (D10)


class VisibilityTests(unittest.TestCase):
    def seen(self, mcd_flags: Mapping[str, str], synthesis_flag: str, name: str = "v1") -> tuple[str, ...]:
        recorder = Recorder(real_synthesizer())
        worker_with(recorder, mcd_flags, synthesis_flag).run_cycle(s.bundle(name))
        (flag, readings), = recorder.seen
        self.assertEqual(flag, synthesis_flag)
        return tuple(sorted(readings))

    def test_shadow_reads_every_shadow_sensor(self) -> None:
        self.assertEqual(self.seen(SYN_SHADOW_MCDS, "shadow"), ("MCD0", "MCD1", "MCD2", "MCD3"))

    def test_shadow_reads_live_sensors_as_well_as_shadow_ones(self) -> None:
        mixed = {"MCD0": "live", "MCD1": "live", "MCD2": "shadow", "MCD3": "shadow"}
        self.assertEqual(self.seen(mixed, "shadow"), ("MCD0", "MCD1", "MCD2", "MCD3"))

    def test_shadow_does_not_see_a_sensor_that_is_off(self) -> None:
        self.assertEqual(self.seen({"MCD0": "shadow", "MCD1": "shadow", "MCD2": "shadow", "MCD3": "off"}, "shadow"), ("MCD0", "MCD1", "MCD2"))

    def test_live_reads_the_live_sensors_only(self) -> None:
        mixed = {"MCD0": "live", "MCD1": "live", "MCD2": "live", "MCD3": "shadow"}
        self.assertEqual(self.seen(mixed, "live"), ("MCD0", "MCD1", "MCD2"))

    def test_live_reads_all_four_when_all_four_are_live(self) -> None:
        self.assertEqual(self.seen({i: "live" for i in s.MCD_IDS}, "live"), ("MCD0", "MCD1", "MCD2", "MCD3"))

    def test_what_synthesis_is_handed_is_what_the_runner_made(self) -> None:
        recorder = Recorder(real_synthesizer())
        result = worker_with(recorder, SYN_SHADOW_MCDS, "shadow").run_cycle(s.bundle("v3"))
        (_, readings), = recorder.seen
        self.assertEqual({k: v["state_code"] for k, v in readings.items()}, {r.mcd_id: r.state_code for r in result.results})
        self.assertEqual({k: v["status"] for k, v in readings.items()}, {r.mcd_id: r.status for r in result.results})

    def test_synthesis_is_handed_the_marked_readings_not_the_evaluators_own(self) -> None:
        """After MCD0 inheritance (every real cycle is flagged on both timeframes): the reading synthesis sees is the final one the sensor row holds."""
        recorder = Recorder(real_synthesizer())
        result = worker_with(recorder, SYN_SHADOW_MCDS, "shadow").run_cycle(s.bundle("v1"))
        (_, readings), = recorder.seen
        by_id = result.by_id()
        for mcd_id in ("MCD1", "MCD2", "MCD3"):
            self.assertEqual(json.dumps(readings[mcd_id], sort_keys=True), json.dumps(json.loads(by_id[mcd_id].envelope_json), sort_keys=True))
            self.assertNotEqual(by_id[mcd_id].envelope_sha256, by_id[mcd_id].evaluator_envelope_sha256)

    def test_synthesis_runs_once_per_cycle(self) -> None:
        recorder = Recorder(real_synthesizer())
        worker = worker_with(recorder, SYN_SHADOW_MCDS, "shadow")
        for name in ("v1", "v3", "v4"):
            worker.run_cycle(s.bundle(name))
        self.assertEqual(len(recorder.seen), 3)

    def test_the_sensors_that_synthesis_cannot_see_are_still_in_the_result(self) -> None:
        mixed = {"MCD0": "live", "MCD1": "live", "MCD2": "live", "MCD3": "shadow"}
        result = worker_with(real_synthesizer(), mixed, "live").run_cycle(s.bundle("v1"))
        self.assertEqual([r.mcd_id for r in result.results], [i for i in result.order])
        self.assertIn("MCD3", {r.mcd_id for r in result.results})


# --------------------------------------------------------------------------- never costing a cycle its readings


class FailureIsolationTests(unittest.TestCase):
    def failing(self) -> Worker:
        return worker_with(Raiser(real_synthesizer()), SYN_SHADOW_MCDS, "shadow")

    def test_an_exception_in_synthesis_leaves_every_sensor_row_as_it_was(self) -> None:
        for name in s.SLOTS:
            with self.assertLogs("mcd.worker", level="ERROR"):
                broken = self.failing().run_cycle(s.bundle(name)).deterministic_dict()
            plain = s.real_worker().run_cycle(s.bundle(name)).deterministic_dict()
            self.assertEqual(json.dumps(broken["results"]), json.dumps(plain["results"]), name)

    def test_the_result_says_what_happened_and_has_no_readings(self) -> None:
        with self.assertLogs("mcd.worker", level="ERROR"):
            result = self.failing().run_cycle(s.bundle("v1"))
        self.assertEqual(result.synthesis.error, SYNTHESIS_ERROR)
        self.assertEqual(result.synthesis.profiles, ())
        out = result.deterministic_dict()["synthesis"]
        self.assertEqual((out["error"], out["readings"], out["flag"]), (SYNTHESIS_ERROR, [], "shadow"))
        self.assertIsNone(out["reference_price"])
        self.assertEqual((out["rules_version"], out["zones_version"]), ("draft-1", real_synthesizer().params.version))

    def test_the_exception_is_logged_with_the_cycle_and_the_synthesis_id(self) -> None:
        with self.assertLogs("mcd.worker", level="ERROR") as logs:
            self.failing().run_cycle(s.bundle("v3"))
        (record,) = logs.records
        self.assertEqual((record.cycle_slot, record.mcd_id), ("2026-09-28T14:15Z", "SYN"))
        self.assertIsNotNone(record.exc_info)

    def test_the_next_cycle_is_not_affected(self) -> None:
        worker = self.failing()
        with self.assertLogs("mcd.worker", level="ERROR"):
            worker.run_cycle(s.bundle("v1"))
        worker.synthesizer = real_synthesizer()
        result = worker.run_cycle(s.bundle("v1"))
        self.assertIsNone(result.synthesis.error)
        self.assertEqual(len(result.synthesis.profiles), 2)

    def test_a_cycle_whose_synthesis_failed_still_serialises_for_the_cli(self) -> None:
        with self.assertLogs("mcd.worker", level="ERROR"):
            result = self.failing().run_cycle(s.bundle("v1"))
        json.dumps(result.to_dict(), allow_nan=False)

    def test_an_exception_in_an_evaluator_is_still_the_runners_business_not_synthesis(self) -> None:
        """A failing MCD becomes an INVALID reading as before, and synthesis then reads that INVALID reading (a stand-aside): it does not fail."""

        def explode(evaluate):
            def run(inputs, params, upstream):
                raise RuntimeError("the evaluator broke")

            return run

        real = with_synthesis("shadow")
        broken = s.worker_replacing("MCD2", explode)
        worker = Worker(broken.registry, broken.flags, broken.checklists, synthesis_flag="shadow", synthesizer=real.synthesizer)
        with self.assertLogs("mcd.worker", level="ERROR"):
            result = worker.run_cycle(s.bundle("v1"))
        self.assertIsNone(result.synthesis.error)
        self.assertEqual(result.by_id()["MCD2"].status, "INVALID")


class RefusalTests(unittest.TestCase):
    def test_a_reading_that_fails_its_guard_is_not_saved_and_names_no_zones(self) -> None:
        result = with_synthesis("shadow").run_cycle(dataclasses.replace(s.bundle("v1"), data_status="BOGUS"))
        for profile in result.synthesis.profiles:
            self.assertFalse(profile.saved)
            out = profile.to_dict()
            self.assertEqual((out["reading_json"], out["reading_sha256"]), (None, None))
            self.assertEqual((out["zones_json"], out["zones_reason"]), ("[]", READING_REFUSED))
            self.assertTrue(any("data_status" in p for p in out["guard_problems"]), out["guard_problems"])

    def test_a_refused_reading_does_not_touch_the_sensor_rows(self) -> None:
        refused = with_synthesis("shadow").run_cycle(dataclasses.replace(s.bundle("v1"), data_status="BOGUS"))
        plain = s.real_worker().run_cycle(dataclasses.replace(s.bundle("v1"), data_status="BOGUS"))
        self.assertEqual([r.envelope_json for r in refused.results], [r.envelope_json for r in plain.results])

    def test_inputs_refused_is_a_data_status_a_reading_may_carry(self) -> None:
        result = with_synthesis("shadow").run_cycle(dataclasses.replace(s.bundle("v1"), data_status="INPUTS_REFUSED"))
        for profile in result.synthesis.profiles:
            self.assertTrue(profile.saved, profile.guard_problems)
            self.assertEqual(profile.reading.reading["data_status"], "INPUTS_REFUSED")

    def test_zones_that_fail_their_guard_are_dropped_and_the_reading_names_none(self) -> None:
        with mock.patch("mcd_worker.synthesis.cycle.zone_problems", return_value=["too wide"]):
            result = with_synthesis("shadow").run_cycle(s.bundle("v1"))
        for profile in result.synthesis.profiles:
            out = profile.to_dict()
            self.assertTrue(profile.saved)  # the reading itself is fine: it simply names no zone
            self.assertEqual(profile.reading.reading["zones"], [])
            self.assertEqual((out["zones_json"], out["zones_reason"]), ("[]", ZONES_REFUSED))
            self.assertTrue(out["guard_problems"])
            self.assertTrue(all(p.startswith("ZONES: ") and p.endswith("too wide") for p in out["guard_problems"]), out["guard_problems"])

    def test_the_stored_cycle_has_zones_so_the_refusal_test_is_not_empty(self) -> None:
        stored = json.loads((s.FIXTURES / "2026-09-18T2055Z.synthesis.json").read_text(encoding="utf-8"))
        self.assertTrue(all(json.loads(r["zones_json"]) for r in stored["readings"]))

    def test_the_words_a_result_uses_for_a_refusal_are_these(self) -> None:
        """Report 1 and the measurement kit read these strings: a rename is a decision, not a refactoring."""
        self.assertEqual((ZONES_REFUSED, READING_REFUSED, SYNTHESIS_ERROR), ("ZONES_REFUSED", "READING_REFUSED", "SYNTHESIS_ERROR"))

    def test_a_cycle_with_no_bars_at_all_has_no_reference_price_and_is_not_a_failure(self) -> None:
        result = with_synthesis("shadow").run_cycle(s.tiny_inputs())
        self.assertIsNone(result.synthesis.error)
        self.assertIsNone(result.synthesis.reference_price)
        self.assertEqual(result.deterministic_dict()["synthesis"]["reference_price"], None)
        for profile in result.synthesis.profiles:
            self.assertTrue(profile.saved, profile.guard_problems)
            self.assertEqual((profile.zones_json, profile.zone_set.reason), ("[]", "NOT_DIRECTIONAL"))

    def test_a_cycle_that_gives_no_zones_is_not_a_failure(self) -> None:
        result = with_synthesis("shadow").run_cycle(s.bundle("v3"))
        for profile in result.synthesis.profiles:
            self.assertTrue(profile.saved)
            self.assertEqual(profile.guard_problems, ())
            self.assertEqual(profile.zone_set.reason, "NO_ZONE_SOURCES")
            self.assertEqual(profile.zones_json, "[]")


# --------------------------------------------------------------------------- the stored synthesis of the three cycles


class StoredSynthesisTests(unittest.TestCase):
    def stored(self, name: str) -> dict[str, Any]:
        return json.loads((s.FIXTURES / f"{s.stem(name)}.synthesis.json").read_text(encoding="utf-8"))

    def test_the_stored_synthesis_is_what_a_run_makes_of_the_bundle(self) -> None:
        for name in s.SLOTS:
            fresh = with_synthesis("shadow").run_cycle(s.bundle(name)).deterministic_dict()["synthesis"]
            self.assertEqual(fresh, self.stored(name), name)

    def test_the_stored_text_is_the_canonical_form_of_the_dictionary(self) -> None:
        for name in s.SLOTS:
            text = (s.FIXTURES / f"{s.stem(name)}.synthesis.json").read_text(encoding="utf-8").replace("\r\n", "\n")
            self.assertEqual(text, json.dumps(self.stored(name), indent=2, ensure_ascii=True) + "\n", name)

    def test_each_stored_reading_hashes_to_its_text(self) -> None:
        import hashlib

        for name in s.SLOTS:
            for row in self.stored(name)["readings"]:
                self.assertEqual(hashlib.sha256(row["reading_json"].encode("utf-8")).hexdigest(), row["reading_sha256"], (name, row["profile"]))
                self.assertEqual(hashlib.sha256(row["zones_json"].encode("utf-8")).hexdigest(), row["zones_sha256"], (name, row["profile"]))
                self.assertEqual(row["guard_problems"], [], (name, row["profile"]))

    def test_each_stored_reading_names_the_zones_it_has_and_joins_to_the_cycle(self) -> None:
        for name in s.SLOTS:
            cycle = json.loads(s.stored_cycle_text(name))
            for row in self.stored(name)["readings"]:
                reading = json.loads(row["reading_json"])
                zones = json.loads(row["zones_json"])
                self.assertEqual(reading["zones"], [z["zone_id"] for z in zones], (name, row["profile"]))
                self.assertEqual(reading["cycle_slot"], cycle["cycle_slot"])
                for zone in zones:
                    self.assertEqual(zone["cycle_slot"], cycle["cycle_slot"])

    def test_a_stored_synthesis_is_the_same_with_the_levels_gone_only_where_no_zone_needs_them(self) -> None:
        """Without ``context_levels`` the sensors' own channel lines are the only zone sources: the readings are the same, the zones are not."""
        for name in s.SLOTS:
            bare = with_synthesis("shadow").run_cycle(without_levels(name)).deterministic_dict()["synthesis"]
            for a, b in zip(bare["readings"], self.stored(name)["readings"]):
                ra, rb = json.loads(a["reading_json"]), json.loads(b["reading_json"])
                ra.pop("zones"), rb.pop("zones")
                self.assertEqual(ra, rb, (name, a["profile"]))


# --------------------------------------------------------------------------- across processes and through the command line


class CommandLineTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        logger = logging.getLogger("mcd")
        saved = (logger.handlers[:], logger.level, logger.propagate)
        self.addCleanup(lambda: (logger.handlers.__setitem__(slice(None), saved[0]), logger.setLevel(saved[1]), setattr(logger, "propagate", saved[2])))

    def config(self, syn: str | None) -> Path:
        lines = ["schema: mcd-worker-config/1", "flags:", *[f"  MCD{n}: shadow" for n in range(4)]]
        if syn is not None:
            lines.append(f"  SYN: {syn}")
        path = Path(self._tmp.name, f"config-{syn}.yaml")
        path.write_text("\n".join(lines) + "\n", encoding="utf-8")
        return path

    def call(self, name: str, config: Path) -> dict[str, Any]:
        body = json.dumps({"request_version": "mcd-cycle-request/1", "bundle": json.loads(s.bundle_text(name))})
        out, err = io.StringIO(), io.StringIO()
        code = cli.main(["--config", str(config)], stdin=io.StringIO(body), stdout=out, stderr=err)
        self.assertEqual(code, 0, err.getvalue())
        return json.loads(out.getvalue())

    def test_the_result_has_a_synthesis_section_only_when_the_flag_is_on(self) -> None:
        self.assertNotIn("synthesis", self.call("v1", self.config(None)))
        self.assertNotIn("synthesis", self.call("v1", self.config("'off'")))
        on = self.call("v1", self.config("shadow"))
        self.assertEqual(on["synthesis"]["flag"], "shadow")
        self.assertEqual([r["profile"] for r in on["synthesis"]["readings"]], ["DAY_TRADER", "SCALPER"])
        self.assertIn("synthesis_ms", on["runtime"])

    def test_the_cli_result_carries_the_stored_synthesis(self) -> None:
        for name in s.SLOTS:
            result = self.call(name, self.config("shadow"))
            stored = json.loads((s.FIXTURES / f"{s.stem(name)}.synthesis.json").read_text(encoding="utf-8"))
            self.assertEqual(result["synthesis"], stored, name)

    def test_a_config_whose_syn_is_higher_than_its_sensors_is_refused_with_exit_2(self) -> None:
        body = json.dumps({"request_version": "mcd-cycle-request/1", "bundle": json.loads(s.bundle_text("v1"))})
        out, err = io.StringIO(), io.StringIO()
        code = cli.main(["--config", str(self.config("live"))], stdin=io.StringIO(body), stdout=out, stderr=err)
        self.assertEqual((code, out.getvalue()), (2, ""))
        self.assertIn("SYN", err.getvalue())

    def test_a_bundle_carrying_levels_is_accepted_and_one_without_them_too(self) -> None:
        data = json.loads(s.bundle_text("v1"))
        del data["context_levels"]
        out, err = io.StringIO(), io.StringIO()
        body = json.dumps({"request_version": "mcd-cycle-request/1", "bundle": data})
        self.assertEqual(cli.main(["--config", str(self.config("shadow"))], stdin=io.StringIO(body), stdout=out, stderr=err), 0, err.getvalue())
        self.assertEqual(json.loads(out.getvalue())["inputs_sha256"], INPUTS_SHA256_WITHOUT_LEVELS["v1"])


class AcrossProcessesTests(unittest.TestCase):
    """Synthesis too must not depend on the hash seed: the readings, the zones and every hash are the same bytes in another process."""

    def run_cli(self, config: Path, text: bytes, seed: str) -> dict[str, Any]:
        env = {**os.environ, "PYTHONHASHSEED": seed, "PYTHONDONTWRITEBYTECODE": "1"}
        done = subprocess.run(
            [sys.executable, "-B", "-m", "mcd_worker.cli", "--config", str(config)], input=text, capture_output=True, cwd=s.ENGINE, env=env, timeout=120
        )
        self.assertEqual(done.returncode, 0, done.stderr.decode())
        result = json.loads(done.stdout)
        result.pop("runtime")
        return result

    def test_different_hash_seeds_give_byte_identical_synthesis(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            config = Path(tmp, "syn.yaml")
            config.write_text("schema: mcd-worker-config/1\nflags:\n  MCD0: shadow\n  MCD1: shadow\n  MCD2: shadow\n  MCD3: shadow\n  SYN: shadow\n", encoding="utf-8")
            for name in ("v1", "v3", "v4"):
                text = json.dumps({"request_version": "mcd-cycle-request/1", "bundle": json.loads(s.bundle_text(name))}).encode("utf-8")
                results = [self.run_cli(config, text, seed) for seed in ("0", "1", "4242", "random")]
                first = json.dumps(results[0]["synthesis"], sort_keys=False)
                for seed, result in zip(("0", "1", "4242", "random"), results):
                    self.assertEqual(json.dumps(result["synthesis"], sort_keys=False), first, (name, seed))
                stored = json.loads((s.FIXTURES / f"{s.stem(name)}.synthesis.json").read_text(encoding="utf-8"))
                self.assertEqual(results[0]["synthesis"], stored, name)

    def test_two_runs_in_one_process_give_the_same_synthesis(self) -> None:
        worker = with_synthesis("shadow")
        for name in s.SLOTS:
            a = json.dumps(worker.run_cycle(s.bundle(name)).deterministic_dict(), sort_keys=False)
            b = json.dumps(with_synthesis("shadow").run_cycle(s.bundle(name)).deterministic_dict(), sort_keys=False)
            self.assertEqual(a, b, name)


if __name__ == "__main__":
    unittest.main()
