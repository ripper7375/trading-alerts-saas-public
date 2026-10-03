"""The command line: one JSON request in, one JSON result out (how the gateway's sensor worker calls it)."""

from __future__ import annotations

import hashlib
import io
import json
import logging
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from typing import Any
from unittest import mock

from mcd_worker import cli
from mcd_worker.tests import support as s

REQUEST_VERSION = "mcd-cycle-request/1"
SHADOW_CONFIG = "schema: mcd-worker-config/1\nflags:\n  MCD0: shadow\n  MCD1: shadow\n  MCD2: shadow\n  MCD3: shadow\n"


def request(name: str, **extra: Any) -> str:
    body = {"request_version": REQUEST_VERSION, "bundle": json.loads(s.bundle_text(name)), **extra}
    return json.dumps(body)


def drop_runtime(result: dict[str, Any]) -> dict[str, Any]:
    """The part of a result two runs and the stored cycles agree on: no ``runtime``, and not the echo of the bundle (see ``BundleTextTests``)."""
    return {k: v for k, v in result.items() if k not in ("runtime", "bundle_canonical_json")}


class CliCase(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.shadow = Path(self._tmp.name, "shadow.yaml")
        self.shadow.write_text(SHADOW_CONFIG, encoding="utf-8")
        logger = logging.getLogger("mcd")
        saved = (logger.handlers[:], logger.level, logger.propagate)
        self.addCleanup(lambda: (logger.handlers.__setitem__(slice(None), saved[0]), logger.setLevel(saved[1]), setattr(logger, "propagate", saved[2])))

    def call(self, text: str, *args: str) -> tuple[int, str, str]:
        out, err = io.StringIO(), io.StringIO()
        code = cli.main(list(args), stdin=io.StringIO(text), stdout=out, stderr=err)
        return code, out.getvalue(), err.getvalue()


class SuccessTests(CliCase):
    def test_a_good_request_gives_one_json_line_equal_to_the_library_result(self) -> None:
        code, out, err = self.call(request("v1"), "--config", str(self.shadow))
        self.assertEqual(code, 0, err)
        self.assertTrue(out.endswith("\n"))
        self.assertEqual(out.count("\n"), 1)
        result = json.loads(out)
        expected = s.real_worker().run_cycle(s.bundle("v1")).deterministic_dict()
        self.assertEqual(drop_runtime(result), expected)
        self.assertEqual(err, "")

    def test_the_result_is_the_stored_cycle_for_each_slot(self) -> None:
        for name in s.SLOTS:
            code, out, _ = self.call(request(name), "--config", str(self.shadow))
            self.assertEqual(code, 0)
            self.assertEqual(drop_runtime(json.loads(out)), json.loads(s.stored_cycle_text(name)), name)

    def test_the_committed_configuration_has_every_mcd_off_so_nothing_runs(self) -> None:
        code, out, _ = self.call(request("v1"))
        self.assertEqual(code, 0)
        result = json.loads(out)
        self.assertEqual((result["order"], result["results"], result["gate"]), ([], [], None))
        self.assertEqual(result["retuning"], {"observed": False, "enforced": False, "applied": False})

    def test_retuning_enforced_defaults_to_false(self) -> None:
        body = json.loads(request("v1"))
        body["bundle"]["retuning"] = True
        code, out, _ = self.call(json.dumps(body), "--config", str(self.shadow))
        self.assertEqual(code, 0)
        self.assertEqual(json.loads(out)["retuning"], {"observed": True, "enforced": False, "applied": False})

    def test_retuning_enforced_true_is_applied_when_a_promote_is_seen(self) -> None:
        body = json.loads(request("v1", retuning_enforced=True))
        body["bundle"]["retuning"] = True
        code, out, _ = self.call(json.dumps(body), "--config", str(self.shadow))
        result = json.loads(out)
        self.assertEqual(result["retuning"], {"observed": True, "enforced": True, "applied": True})
        self.assertEqual({r["status"] for r in result["results"]}, {"CAUTIONARY"})

    def test_the_output_is_ascii_only_json_with_no_non_finite_numbers(self) -> None:
        _, out, _ = self.call(request("v3"), "--config", str(self.shadow))
        out.encode("ascii")
        json.loads(out, parse_constant=lambda name: self.fail(f"non-finite constant {name}"))

    def test_the_stored_envelope_text_survives_the_round_trip_byte_for_byte(self) -> None:
        _, out, _ = self.call(request("v4"), "--config", str(self.shadow))
        for row in json.loads(out)["results"]:
            self.assertEqual(row["envelope_json"], json.dumps(json.loads(row["envelope_json"]), ensure_ascii=True, separators=(",", ":")))

    def test_an_evaluator_error_is_a_result_not_a_failure_and_is_logged_as_json(self) -> None:
        body = json.loads(request("v1"))
        body["bundle"]["bars"] = {"M5": 5, "M15": 5}  # junk the evaluators cannot read
        code, out, err = self.call(json.dumps(body), "--config", str(self.shadow))
        self.assertEqual(code, 0)
        result = json.loads(out)
        self.assertEqual(len(result["results"]), 4)
        lines = [json.loads(line) for line in err.splitlines() if line.strip()]
        self.assertTrue(lines, "the evaluators' errors are logged")
        self.assertTrue(all({"level", "logger", "message"} <= set(line) for line in lines))
        self.assertTrue(any(line.get("mcd_id") and line.get("cycle_slot") == "2026-09-18T20:55Z" for line in lines), lines)


class BundleTextTests(CliCase):
    """The CLI returns the exact canonical text of the bundle it was sent, so the gateway can store it (part 3, decision 3, option a)."""

    def test_the_result_carries_the_canonical_text_and_its_hash_is_inputs_sha256(self) -> None:
        for name in s.SLOTS:
            code, out, err = self.call(request(name), "--config", str(self.shadow))
            self.assertEqual(code, 0, err)
            result = json.loads(out)
            expected = json.dumps(json.loads(s.bundle_text(name)), sort_keys=True, separators=(",", ":"), ensure_ascii=True)
            self.assertEqual(result["bundle_canonical_json"], expected, name)
            self.assertEqual(hashlib.sha256(result["bundle_canonical_json"].encode("utf-8")).hexdigest(), result["inputs_sha256"], name)

    def test_the_text_is_a_string_inside_the_one_json_line_and_the_line_is_still_one_line(self) -> None:
        _, out, _ = self.call(request("v1"), "--config", str(self.shadow))
        self.assertEqual(out.count("\n"), 1)
        self.assertIsInstance(json.loads(out)["bundle_canonical_json"], str)
        out.encode("ascii")

    def test_the_text_keeps_retuning_as_the_cycle_said_when_it_is_not_enforced(self) -> None:
        body = json.loads(request("v1"))
        body["bundle"]["retuning"] = True
        _, out, _ = self.call(json.dumps(body), "--config", str(self.shadow))
        result = json.loads(out)
        self.assertEqual(result["retuning"], {"observed": True, "enforced": False, "applied": False})
        self.assertTrue(json.loads(result["bundle_canonical_json"])["retuning"])

    def test_a_replay_of_the_returned_text_gives_the_same_result(self) -> None:
        """Sending the stored text back (as a request) reproduces the readings and the same text: replay is byte-identical."""
        _, first, _ = self.call(request("v3"), "--config", str(self.shadow))
        first = json.loads(first)
        again = json.dumps({"request_version": REQUEST_VERSION, "bundle": json.loads(first["bundle_canonical_json"])})
        _, second, _ = self.call(again, "--config", str(self.shadow))
        second = json.loads(second)
        self.assertEqual(drop_runtime(second), drop_runtime(first))
        self.assertEqual(second["bundle_canonical_json"], first["bundle_canonical_json"])

    def test_the_committed_configuration_still_returns_the_text(self) -> None:
        _, out, _ = self.call(request("v1"))
        self.assertIsInstance(json.loads(out)["bundle_canonical_json"], str)


class RequestErrorTests(CliCase):
    def assertRefused(self, text: str, fragment: str, *args: str) -> None:
        code, out, err = self.call(text, *args)
        self.assertEqual(code, 2, err)
        self.assertEqual(out, "", "nothing is written to stdout when the request is refused")
        problem = json.loads(err.strip().splitlines()[-1])
        self.assertIn(fragment, "; ".join(problem["problems"]))

    def test_each_bad_request_is_refused_with_exit_2_and_names_the_problem(self) -> None:
        good = json.loads(request("v1"))
        cases = [
            ("", "not JSON"),
            ("{", "not JSON"),
            ("[]", "must be a JSON object"),
            ('"text"', "must be a JSON object"),
            (json.dumps({**good, "extra": 1}), "unknown keys ['extra']"),
            (json.dumps({**good, "request_version": "mcd-cycle-request/2"}), "request_version must be"),
            (json.dumps({k: v for k, v in good.items() if k != "request_version"}), "request_version must be"),
            (json.dumps({k: v for k, v in good.items() if k != "bundle"}), "bundle must be a JSON object"),
            (json.dumps({**good, "bundle": []}), "bundle must be a JSON object"),
            (json.dumps({**good, "bundle": {"symbol": "XAUUSD"}}), "bundle is not a CycleInputs"),
        ]
        for text, fragment in cases:
            self.assertRefused(text, fragment, "--config", str(self.shadow))

    def test_retuning_enforced_must_be_a_json_boolean(self) -> None:
        for bad in ("true", 1, 0, None, [], {}):
            body = json.loads(request("v1"))
            body["retuning_enforced"] = bad
            self.assertRefused(json.dumps(body), "retuning_enforced must be a JSON boolean", "--config", str(self.shadow))

    def test_nan_and_infinity_are_not_json_values_here(self) -> None:
        for token in ("NaN", "Infinity", "-Infinity"):
            text = request("v1").replace('"retuning": false', f'"retuning": false, "junk": {token}', 1)
            self.assertIn(token, text)
            self.assertRefused(text, "NaN and infinity are not allowed", "--config", str(self.shadow))

    def test_a_bundle_whose_retuning_is_not_a_boolean_is_refused(self) -> None:
        body = json.loads(request("v1"))
        body["bundle"]["retuning"] = "false"
        self.assertRefused(json.dumps(body), "retuning must be a boolean", "--config", str(self.shadow))

    def test_a_bundle_with_no_slot_is_refused(self) -> None:
        body = json.loads(request("v1"))
        body["bundle"]["cycle_slot"] = "yesterday"
        self.assertRefused(json.dumps(body), "cycle_slot is not an ISO 8601", "--config", str(self.shadow))


class ConfigErrorTests(CliCase):
    def test_a_flag_above_its_checklist_is_refused_before_any_cycle_runs(self) -> None:
        path = Path(self._tmp.name, "live.yaml")
        path.write_text(SHADOW_CONFIG.replace("MCD0: shadow", "MCD0: live"), encoding="utf-8")
        code, out, err = self.call(request("v1"), "--config", str(path))
        self.assertEqual(code, 2)
        self.assertEqual(out, "")
        self.assertIn("needs checklist items [7, 8, 9]", err)

    def test_a_config_file_that_is_missing_is_refused(self) -> None:
        code, out, err = self.call(request("v1"), "--config", str(Path(self._tmp.name, "nope.yaml")))
        self.assertEqual((code, out), (2, ""))
        self.assertIn("cannot be read", err)

    def test_an_unquoted_off_is_refused(self) -> None:
        path = Path(self._tmp.name, "bool.yaml")
        path.write_text("schema: mcd-worker-config/1\nflags:\n  MCD0: off\n  MCD1: off\n  MCD2: off\n  MCD3: off\n", encoding="utf-8")
        code, _, err = self.call(request("v1"), "--config", str(path))
        self.assertEqual(code, 2)
        self.assertIn("quote it", err)

    def test_an_engine_folder_with_no_mcd_is_refused(self) -> None:
        code, out, err = self.call(request("v1"), "--engine-dir", self._tmp.name)
        self.assertEqual((code, out), (2, ""))
        self.assertIn("no mcdN folder", err)


class UnexpectedErrorTests(CliCase):
    def test_an_unexpected_exception_is_exit_1_with_nothing_on_stdout(self) -> None:
        with mock.patch.object(cli.Worker, "run_cycle", side_effect=RuntimeError("disk on fire")):
            code, out, err = self.call(request("v1"), "--config", str(self.shadow))
        self.assertEqual((code, out), (1, ""))
        line = json.loads(err.strip().splitlines()[-1])
        self.assertEqual(line["level"], "ERROR")
        self.assertIn("disk on fire", line["exception"])


class RealProcessTests(unittest.TestCase):
    """The same thing through a real interpreter, the way the gateway calls it."""

    def run_process(self, text: bytes, *args: str, seed: str = "0") -> subprocess.CompletedProcess:
        env = {**__import__("os").environ, "PYTHONHASHSEED": seed, "PYTHONDONTWRITEBYTECODE": "1"}
        return subprocess.run(
            [sys.executable, "-B", "-m", "mcd_worker.cli", *args], input=text, capture_output=True, cwd=s.ENGINE, env=env, timeout=120
        )

    def test_a_process_answers_a_cycle_and_exits_zero(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            config = Path(tmp, "shadow.yaml")
            config.write_text(SHADOW_CONFIG, encoding="utf-8")
            done = self.run_process(request("v1").encode("utf-8"), "--config", str(config))
        self.assertEqual(done.returncode, 0, done.stderr.decode())
        self.assertEqual(done.stdout.count(b"\n"), 1)
        self.assertNotIn(b"\r", done.stdout)  # the same bytes on Windows and on Linux
        self.assertEqual(drop_runtime(json.loads(done.stdout)), json.loads(s.stored_cycle_text("v1")))

    def test_a_process_refuses_a_bad_request_with_exit_2_and_empty_stdout(self) -> None:
        done = self.run_process(b"not json")
        self.assertEqual((done.returncode, done.stdout), (2, b""))
        self.assertIn(b"not JSON", done.stderr)

    def test_a_process_reads_utf8_bytes(self) -> None:
        body = json.loads(request("v1"))
        body["bundle"]["note_in_utf8"] = "café"  # an unknown bundle key is not read by the kit; the bytes must still decode
        done = self.run_process(json.dumps(body, ensure_ascii=False).encode("utf-8"))
        self.assertEqual(done.returncode, 0, done.stderr.decode())


if __name__ == "__main__":
    unittest.main()
