"""``python -B -m mcd_worker.tools.compute_statistics``: run ``compute_state_statistics`` from JSON on stdin, answer JSON on stdout.

This is the CLI entry point for Stage B4 certification (``docs/runbooks/deploy-stack-d-step3.md`` §6 item 1; build step 3 part 6 §5.2).
The gateway certification script (``railway-gateway/scripts/certify-state-statistics.js``) invokes this module to compute
``state_statistics`` rows over MCD occurrences and closed M5 bars before passing the resulting rows to ``StateStatisticsWriter.writeRows``.

Request (``mcd-statistics-request/1``), one JSON object on stdin (or ``--input <file>``)::

    {
      "request_version": "mcd-statistics-request/1",
      "occurrences": [
        {
          "mcd_id": "MCD2",
          "evaluator_version_series": "2.0",
          "config_hash_key": "{\"best_fit_a\":\"h1\"}",
          "state_code": "MCD2_CHANNEL_UP",
          "bias": "LONG",
          "slot": 1794321000
        }
      ],
      "bars": [
        {
          "timestamp": 1794320700,
          "high": 4010.5,
          "low": 4000.25,
          "close": 4005.0
        }
      ],
      "horizons": [2, 12]
    }

Result (``mcd-statistics-result/1``), one JSON line on stdout::

    {
      "result_version": "mcd-statistics-result/1",
      "rows": [...],
      "occurrences": 1,
      "unavailable": {
        "NO_REFERENCE_BAR": 0,
        "NO_HORIZON_BAR": 1,
        "GAP_IN_WINDOW": 0
      }
    }

Exit status: 0 a result was written; 2 the request, occurrences or bars are invalid (stderr names every problem as JSON);
1 an unexpected error.
"""

from __future__ import annotations

import argparse
import json
import sys
import traceback
from pathlib import Path
from typing import Any, Sequence

from ..statistics import HORIZONS, BarsError, StatisticsError, compute_state_statistics

REQUEST_VERSION = "mcd-statistics-request/1"
RESULT_VERSION = "mcd-statistics-result/1"
_REQUEST_KEYS = {"request_version", "occurrences", "bars", "horizons"}


class _RequestError(Exception):
    def __init__(self, problems: Sequence[str] | str) -> None:
        self.problems = [problems] if isinstance(problems, str) else list(problems)
        super().__init__("; ".join(self.problems))


def _reject_constant(name: str) -> Any:
    raise _RequestError(f"request: {name} is not a JSON value (NaN and infinity are not allowed)")


def parse_request(text: str) -> tuple[list[dict[str, Any]], list[dict[str, Any]], tuple[int, ...]]:
    """Parse and validate a ``mcd-statistics-request/1`` JSON payload."""
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
    occurrences = request.get("occurrences")
    if not isinstance(occurrences, list):
        raise _RequestError("request: occurrences must be a JSON array")
    bars = request.get("bars")
    if not isinstance(bars, list):
        raise _RequestError("request: bars must be a JSON array")
    horizons_raw = request.get("horizons")
    if horizons_raw is None:
        horizons: tuple[int, ...] = HORIZONS
    else:
        if not isinstance(horizons_raw, list) or not horizons_raw:
            raise _RequestError("request: horizons must be a non-empty JSON array of hours")
        if any(isinstance(h, bool) or not isinstance(h, int) for h in horizons_raw):
            raise _RequestError("request: horizons must contain whole hours only")
        horizons = tuple(horizons_raw)
    return occurrences, bars, horizons


def main(argv: Sequence[str] | None = None, *, stdin: Any = None, stdout: Any = None, stderr: Any = None) -> int:
    parser = argparse.ArgumentParser(prog="python -B -m mcd_worker.tools.compute_statistics", description=__doc__.split("\n\n")[0])
    parser.add_argument("--input", help="read request JSON from a file instead of stdin")
    args = parser.parse_args(argv)
    stdin, stdout, stderr = stdin or sys.stdin, stdout or sys.stdout, stderr or sys.stderr

    try:
        if args.input:
            raw = Path(args.input).read_text(encoding="utf-8")
        else:
            raw = stdin.buffer.read().decode("utf-8") if hasattr(stdin, "buffer") else stdin.read()
        occurrences, bars, horizons = parse_request(raw)
        computed = compute_state_statistics(occurrences, bars, horizons=horizons)
        payload = {
            "result_version": RESULT_VERSION,
            "rows": computed["rows"],
            "occurrences": computed["occurrences"],
            "unavailable": computed["unavailable"],
        }
        text = json.dumps(payload, ensure_ascii=True, separators=(",", ":"), allow_nan=False)
    except (_RequestError, StatisticsError, BarsError, ValueError) as exc:
        problems = list(getattr(exc, "problems", ())) or [str(exc)]
        stderr.write(json.dumps({"error": type(exc).__name__, "problems": problems}, ensure_ascii=True) + "\n")
        return 2
    except Exception:  # noqa: BLE001
        traceback.print_exc(file=stderr)
        return 1

    if hasattr(stdout, "buffer"):
        stdout.buffer.write((text + "\n").encode("ascii"))
        stdout.buffer.flush()
    else:
        stdout.write(text + "\n")
        stdout.flush()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
