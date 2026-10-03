"""``python -m mcd_worker.cli``: run one cycle from a JSON request on stdin, answer one JSON result on stdout.

This is how the sensor worker in the gateway (build step 3, part 4) calls the evaluators: one process per
cycle, nothing kept between cycles (Davin, Q2 and Q3). Run it from ``davintrade-stack-d-and-e/engine-1-5-new/``
(or with that folder on ``PYTHONPATH``).

Request (``mcd-cycle-request/1``), one JSON object::

    {"request_version": "mcd-cycle-request/1",
     "bundle": { ... the ``CycleInputs`` JSON form ... },
     "retuning_enforced": false}

``retuning_enforced`` is optional and defaults to ``false``; when present it must be a JSON boolean. Any other
key is refused, so a misspelt option can never be taken for "off". The flag of every MCD comes from
``worker_config.yaml`` (``--config`` names another file, for tests); it is never part of a request.

Result (``mcd-cycle-result/1``): see ``CycleResult``. ``runtime`` is the only part that differs between two runs. Beside
``inputs_sha256`` it carries ``bundle_canonical_json``, the exact text that hash is of, for the worker to store (it never rebuilds it).

Exit status: 0 a result was written (some readings may be INVALID or STALE: that is data, not failure);
2 the request or the configuration is wrong (stderr names every problem, nothing is written to stdout);
1 an unexpected error (the traceback is on stderr, nothing is written to stdout). Logs are JSON lines on stderr.
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from typing import Any, Sequence

from mcd_common.cycle_inputs import CycleInputs

from .cycle_runner import Worker
from .errors import WorkerError

REQUEST_VERSION = "mcd-cycle-request/1"
_REQUEST_KEYS = {"request_version", "bundle", "retuning_enforced"}
_LOG_RESERVED = set(logging.LogRecord("", 0, "", 0, "", (), None).__dict__) | {"message", "asctime"}


class _RequestError(WorkerError):
    pass


class _JsonLines(logging.Formatter):
    """One JSON object per log record, keyed by whatever ``extra`` fields the caller gave (``mcd_id``, ``cycle_slot``)."""

    def format(self, record: logging.LogRecord) -> str:
        entry: dict[str, Any] = {"level": record.levelname, "logger": record.name, "message": record.getMessage()}
        for key, value in record.__dict__.items():
            if key not in _LOG_RESERVED:
                entry[key] = value
        if record.exc_info:
            entry["exception"] = self.formatException(record.exc_info)
        return json.dumps(entry, ensure_ascii=True, default=str)


def _reject_constant(name: str) -> Any:
    raise _RequestError(f"request: {name} is not a JSON value (NaN and infinity are not allowed)")


def parse_request(text: str) -> tuple[CycleInputs, bool]:
    """The bundle and the ``retuning_enforced`` switch of a request, or a ``WorkerError`` naming what is wrong."""
    try:
        request = json.loads(text, parse_constant=_reject_constant)
    except json.JSONDecodeError as exc:
        raise _RequestError(f"request: not JSON ({exc})") from exc
    if not isinstance(request, dict):
        raise _RequestError("request: must be a JSON object")
    extra = sorted(set(request) - _REQUEST_KEYS)
    if extra:
        raise _RequestError(f"request: unknown keys {extra}")
    if request.get("request_version") != REQUEST_VERSION:
        raise _RequestError(f"request: request_version must be {REQUEST_VERSION!r}, got {request.get('request_version')!r}")
    enforced = request.get("retuning_enforced", False)
    if not isinstance(enforced, bool):
        raise _RequestError(f"request: retuning_enforced must be a JSON boolean, got {enforced!r}")
    if not isinstance(request.get("bundle"), dict):
        raise _RequestError("request: bundle must be a JSON object")
    try:
        inputs = CycleInputs.from_dict(request["bundle"])
    except Exception as exc:  # noqa: BLE001 - a missing key or a wrong shape: the bundle cannot be built at all
        raise _RequestError(f"request: bundle is not a CycleInputs ({type(exc).__name__}: {exc})") from exc
    return inputs, enforced


def main(argv: Sequence[str] | None = None, *, stdin: Any = None, stdout: Any = None, stderr: Any = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m mcd_worker.cli", description=__doc__.split("\n\n")[0])
    parser.add_argument("--config", help="worker configuration file (default: mcd_worker/worker_config.yaml)")
    parser.add_argument("--engine-dir", help="folder holding mcd_common and mcd0, mcd1, ... (default: this checkout's)")
    args = parser.parse_args(argv)
    stdin, stdout, stderr = stdin or sys.stdin, stdout or sys.stdout, stderr or sys.stderr

    handler = logging.StreamHandler(stderr)
    handler.setFormatter(_JsonLines())
    logger = logging.getLogger("mcd")
    logger.handlers[:] = [handler]
    logger.setLevel(logging.INFO)
    logger.propagate = False

    try:
        raw = stdin.buffer.read().decode("utf-8") if hasattr(stdin, "buffer") else stdin.read()
        inputs, enforced = parse_request(raw)
        worker = Worker.load(engine_dir=args.engine_dir, config_path=args.config)
        result = worker.run_cycle(inputs, retuning_enforced=enforced)
        text = json.dumps(result.to_dict(), ensure_ascii=True, separators=(",", ":"), allow_nan=False)
    except WorkerError as exc:
        problems = list(getattr(exc, "problems", ())) or [str(exc)]
        stderr.write(json.dumps({"error": type(exc).__name__, "problems": problems}, ensure_ascii=True) + "\n")
        return 2
    except Exception:  # noqa: BLE001 - the caller treats exit 1 as "no result"; it must not invent one
        logger.exception("unexpected error")
        return 1
    if hasattr(stdout, "buffer"):  # bytes, so Windows does not turn the newline into two characters
        stdout.buffer.write((text + "\n").encode("ascii"))
        stdout.buffer.flush()
    else:
        stdout.write(text + "\n")
        stdout.flush()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
