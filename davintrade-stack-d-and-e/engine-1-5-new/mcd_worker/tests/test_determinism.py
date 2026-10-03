"""Determinism (requirement R4, "Done when" item 3 of section 2.11): the same bundle gives byte-identical readings.

Two runs, two processes with different ``PYTHONHASHSEED`` values, a bundle whose keys arrive in another order, a
registry listed in another order: all give the same bytes. Only ``runtime`` (timings, the Python version) may differ.
"""

from __future__ import annotations

import json
import os
import random
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from typing import Any

from mcd_common.cycle_inputs import CycleInputs

from mcd_worker.cycle_runner import Worker
from mcd_worker.registry import Registry
from mcd_worker.tests import support as s

SHADOW_CONFIG = "schema: mcd-worker-config/1\nflags:\n  MCD0: shadow\n  MCD1: shadow\n  MCD2: shadow\n  MCD3: shadow\n"


def deterministic(result) -> str:
    return json.dumps(result.deterministic_dict(), sort_keys=False)


def shuffled(node: Any, rng: random.Random) -> Any:
    """The same JSON value with the keys of every object in another order."""
    if isinstance(node, dict):
        items = list(node.items())
        rng.shuffle(items)
        return {k: shuffled(v, rng) for k, v in items}
    if isinstance(node, list):
        return [shuffled(v, rng) for v in node]
    return node


class InProcessTests(unittest.TestCase):
    def test_two_runs_give_the_same_result(self) -> None:
        for name in s.SLOTS:
            first = s.real_worker().run_cycle(s.bundle(name))
            second = s.real_worker().run_cycle(s.bundle(name))
            self.assertEqual(deterministic(first), deterministic(second), name)
            for a, b in zip(first.results, second.results):
                self.assertEqual(a.envelope_json.encode(), b.envelope_json.encode(), (name, a.mcd_id))

    def test_a_fresh_worker_gives_the_same_result_as_a_used_one(self) -> None:
        used = s.real_worker()
        used.run_cycle(s.bundle("v3"))
        used.run_cycle(s.bundle("v4"))
        fresh = Worker.load(flags=s.SHADOW_ALL)
        self.assertEqual(deterministic(used.run_cycle(s.bundle("v1"))), deterministic(fresh.run_cycle(s.bundle("v1"))))

    def test_the_order_of_cycles_does_not_matter(self) -> None:
        worker = Worker.load(flags=s.SHADOW_ALL)
        alone = deterministic(worker.run_cycle(s.bundle("v4")))
        for name in ("v1", "v3", "v4", "v3", "v1"):
            worker.run_cycle(s.bundle(name))
        self.assertEqual(deterministic(worker.run_cycle(s.bundle("v4"))), alone)

    def test_the_order_the_keys_of_the_bundle_arrive_in_does_not_change_the_result_or_the_hash(self) -> None:
        for name in s.SLOTS:
            base = s.real_worker().run_cycle(s.bundle(name))
            rng = random.Random(20261003)
            for _ in range(2):
                rearranged = CycleInputs.from_dict(shuffled(json.loads(s.bundle_text(name)), rng))
                other = s.real_worker().run_cycle(rearranged)
                self.assertEqual(other.inputs_sha256, base.inputs_sha256, name)
                self.assertEqual([r.envelope_json for r in other.results], [r.envelope_json for r in base.results], name)

    def test_the_order_the_registry_is_listed_in_does_not_change_the_result(self) -> None:
        real = s.real_worker()
        reversed_registry = Registry([real.registry[i] for i in reversed(list(real.registry))])
        other = Worker(reversed_registry, dict(reversed(list(real.flags.items()))), real.checklists)
        self.assertEqual(other.order, real.order)
        self.assertEqual(deterministic(other.run_cycle(s.bundle("v3"))), deterministic(real.run_cycle(s.bundle("v3"))))

    def test_nothing_but_runtime_differs_between_two_to_dict_calls(self) -> None:
        result = s.real_worker().run_cycle(s.bundle("v1"))
        a, b = result.to_dict(), result.to_dict()
        self.assertEqual(a, b)
        self.assertEqual(set(a) - set(result.deterministic_dict()), {"runtime", "bundle_canonical_json"})
        self.assertEqual(set(a["runtime"]), {"python", "timings_ms"})

    def test_a_marked_reading_is_as_stable_as_an_unmarked_one(self) -> None:
        """The mark is a pure function of the reading and the gate's state: marking twice gives the same bytes."""
        a = s.real_worker().run_cycle(s.bundle("v3")).by_id()
        b = s.real_worker().run_cycle(s.bundle("v3")).by_id()
        for mcd_id in ("MCD1", "MCD2", "MCD3"):
            self.assertEqual(a[mcd_id].envelope_sha256, b[mcd_id].envelope_sha256)
            self.assertNotEqual(a[mcd_id].envelope_sha256, a[mcd_id].evaluator_envelope_sha256)


class AcrossProcessesTests(unittest.TestCase):
    """Different hash seeds make Python order sets and string-keyed dictionaries' hashes differently; the bytes must not move."""

    def run_cli(self, config: Path, text: bytes, seed: str) -> dict[str, Any]:
        env = {**os.environ, "PYTHONHASHSEED": seed, "PYTHONDONTWRITEBYTECODE": "1"}
        done = subprocess.run(
            [sys.executable, "-B", "-m", "mcd_worker.cli", "--config", str(config)], input=text, capture_output=True, cwd=s.ENGINE, env=env, timeout=120
        )
        self.assertEqual(done.returncode, 0, done.stderr.decode())
        result = json.loads(done.stdout)
        result.pop("runtime")
        return result

    def test_different_hash_seeds_give_byte_identical_results(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            config = Path(tmp, "shadow.yaml")
            config.write_text(SHADOW_CONFIG, encoding="utf-8")
            for name in ("v1", "v4"):
                text = json.dumps({"request_version": "mcd-cycle-request/1", "bundle": json.loads(s.bundle_text(name))}).encode("utf-8")
                results = [self.run_cli(config, text, seed) for seed in ("0", "1", "4242", "random")]
                first = json.dumps(results[0], sort_keys=False)
                for seed, result in zip(("0", "1", "4242", "random"), results):
                    self.assertEqual(json.dumps(result, sort_keys=False), first, (name, seed))
                stored_text = results[0].pop("bundle_canonical_json")  # the echo of the bundle: equal across seeds (checked above), and the canonical text
                self.assertEqual(stored_text, json.dumps(json.loads(s.bundle_text(name)), sort_keys=True, separators=(",", ":"), ensure_ascii=True), name)
                self.assertEqual(results[0], json.loads(s.stored_cycle_text(name)), name)


if __name__ == "__main__":
    unittest.main()
