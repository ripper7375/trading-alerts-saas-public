"""Generate test/fixtures/market-hours-parity.json for test/market-hours.spec.ts.

src/cycle/market-hours.ts is a TypeScript port of the collector's own
is_market_open_xauusd() / is_dst_active(). The collector is the thing that
actually gates cycles, so the port is only trustworthy if it agrees with it.
This script runs the REAL Python functions (imported from the collector, not
copied) once a minute over 2025-2027 and stores where each answer FLIPS. The
spec then checks the port at every flip and one minute before it, which covers
every weekday open and close, every weekend and both DST changes of each year,
in a file of a few thousand numbers rather than 1.5 million samples.

Run from railway-gateway/ whenever the collector's gate changes:

    PYTHONIOENCODING=utf-8 python scripts/generate_market_hours_parity.py
"""

import importlib.util
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
COLLECTOR = (
    REPO_ROOT
    / "backend-stack-c"
    / "1_EA-and-backfill-worker-on-contabo-vps"
    / "v2_29_data_pipeline_architecture"
    / "export_collector_validator_v2.py"
)
OUT = Path(__file__).resolve().parents[1] / "test" / "fixtures" / "market-hours-parity.json"

START = int(datetime(2025, 1, 1, tzinfo=timezone.utc).timestamp())
END = int(datetime(2028, 1, 1, tzinfo=timezone.utc).timestamp())
STEP = 60  # every boundary in the gate falls on a whole minute


def load_collector():
    spec = importlib.util.spec_from_file_location("export_collector_validator_v2", COLLECTOR)
    module = importlib.util.module_from_spec(spec)
    sys.modules["export_collector_validator_v2"] = module
    spec.loader.exec_module(module)
    return module


def flips(predicate):
    """Return (state at START, [timestamps where the answer changes])."""
    initial = predicate(START)
    state = initial
    out = []
    for ts in range(START + STEP, END, STEP):
        now = predicate(ts)
        if now != state:
            out.append(ts)
            state = now
    return initial, out


def main():
    collector = load_collector()

    def is_open(ts):
        return bool(collector.is_market_open_xauusd(ts))

    def is_dst(ts):
        return bool(collector.is_dst_active(datetime.fromtimestamp(ts, tz=timezone.utc)))

    initial_open, open_flips = flips(is_open)
    initial_dst, dst_flips = flips(is_dst)

    payload = {
        "generatedFrom": "export_collector_validator_v2.is_market_open_xauusd / is_dst_active",
        "rangeStart": START,
        "rangeEnd": END,
        "stepSec": STEP,
        "initialOpen": initial_open,
        "openFlips": open_flips,
        "initialDst": initial_dst,
        "dstFlips": dst_flips,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, separators=(",", ":")) + "\n", encoding="utf-8", newline="\n")
    print(f"wrote {OUT} ({len(open_flips)} open flips, {len(dst_flips)} dst flips)")


if __name__ == "__main__":
    main()
