#!/usr/bin/env python3
"""Build the sensor roster and the registry codes from the MCD registries.

Build step 6, part 1 (architecture chapter 4, plan section 4). The MCD registries
(`mcdN/mcdN_registry.yaml`) and the worker configuration (`mcd_worker/worker_config.yaml`)
are the one place that says which sensors exist, which is the primary sensor of a trader
type, and which state codes a sensor can report. The intake path (TypeScript) and the
knowledge service (Python) both need that list, and neither may type it again. This tool
reads the registries and writes two generated files:

  config/intake/sensor-roster.json                      the roster (TypeScript reads it)
  knowledge-service/config/registry-codes.json          MCD ids and state codes (the tag whitelist)

A future MCD4 appears by adding its registry file (and its flag in worker_config.yaml) and
running this tool again. The primary sensor is DERIVED, never named here: it is the sensor
whose `rung` for the trader type is `primary_structure` (standard 9.3), and exactly one
sensor must claim it for each trader type or the tool refuses to write anything.

Usage (from the repository root):

  python scripts/intake/build_roster.py            write both files
  python scripts/intake/build_roster.py --check    exit 1 if a file differs from a rebuild
                                                   (compares the parsed JSON, so Prettier or
                                                   the line endings of the checkout cannot
                                                   make a false difference)

Exit codes: 0 done / equal, 1 --check found a difference, 2 a source file is wrong.
"""

import argparse
import json
import re
import sys
from pathlib import Path

try:
    import yaml
except ImportError:  # pragma: no cover - the message is the point
    sys.stderr.write("PyYAML is required: pip install pyyaml\n")
    raise SystemExit(2)

REPO = Path(__file__).resolve().parents[2]
ENGINE = REPO / "davintrade-stack-d-and-e" / "engine-1-5-new"
DEFAULT_ROSTER = REPO / "config" / "intake" / "sensor-roster.json"
DEFAULT_CODES = REPO / "knowledge-service" / "config" / "registry-codes.json"

ROSTER_SCHEMA = "sensor-roster/1"
CODES_SCHEMA = "registry-codes/1"

TRADER_TYPES = ("DAY_TRADER", "SCALPER")
PRIMARY_RUNG = "primary_structure"
KINDS = ("gate", "independent", "derived")
FLAGS = ("off", "shadow", "live")
TIMEFRAMES = ("M5", "M15")
MCD_ID = re.compile(r"^MCD([0-9]|1[0-5])$")
REGISTRY_PATH = re.compile(r"^mcd(\d+)/mcd(\d+)_registry\.yaml$")


class SourceError(Exception):
    """A registry or the worker configuration is not what the roster can be built from."""


def load_yaml(path: Path):
    try:
        with path.open("rb") as handle:
            return yaml.safe_load(handle)
    except (OSError, yaml.YAMLError) as error:
        raise SourceError(f"{path}: cannot be read: {error}") from error


def registry_files(engine: Path):
    """The registry files in ascending order of the MCD number."""
    found = []
    for path in engine.glob("mcd[0-9]*/mcd[0-9]*_registry.yaml"):
        match = REGISTRY_PATH.match(path.relative_to(engine).as_posix())
        if match is None or match.group(1) != match.group(2):
            raise SourceError(f"{path}: the folder number and the file number differ")
        found.append((int(match.group(1)), path))
    if not found:
        raise SourceError(f"{engine}: no registry file (mcdN/mcdN_registry.yaml) found")
    return [path for _, path in sorted(found)]


def read_flag(value, where: str) -> str:
    if isinstance(value, bool):
        raise SourceError(f"{where}: the flag was read as a boolean; quote it ('off', not off)")
    if value not in FLAGS:
        raise SourceError(f"{where}: the flag must be one of {', '.join(FLAGS)}, not {value!r}")
    return value


def unique(items):
    seen = []
    for item in items:
        if item not in seen:
            seen.append(item)
    return seen


def build_sensor(registry: dict, path: Path, config_flag: str) -> dict:
    where = str(path)
    mcd_id = registry.get("mcd_id")
    if not isinstance(mcd_id, str) or not MCD_ID.match(mcd_id):
        raise SourceError(f"{where}: mcd_id {mcd_id!r} is not MCD0 to MCD15")
    if path.parent.name != mcd_id.lower():
        raise SourceError(f"{where}: mcd_id {mcd_id} does not match the folder {path.parent.name}")
    kind = registry.get("kind")
    if kind not in KINDS:
        raise SourceError(f"{where}: kind must be one of {', '.join(KINDS)}, not {kind!r}")
    name = registry.get("name")
    if not isinstance(name, str) or not name.strip():
        raise SourceError(f"{where}: name is missing")

    timeframes = registry.get("timeframes")
    if not isinstance(timeframes, list) or not timeframes or any(t not in TIMEFRAMES for t in timeframes):
        raise SourceError(f"{where}: timeframes must be a non-empty list of {', '.join(TIMEFRAMES)}")

    depends_on = registry.get("depends_on") or []
    uses_channel = registry.get("uses_channel") or []
    if any(not isinstance(d, str) or not MCD_ID.match(d) for d in depends_on):
        raise SourceError(f"{where}: depends_on must hold MCD ids")
    if any(t not in TIMEFRAMES for t in uses_channel):
        raise SourceError(f"{where}: uses_channel must hold timeframes")

    flag = read_flag(registry.get("flag"), f"{where} flag")
    if flag != config_flag:
        raise SourceError(
            f"{where}: the registry flag {flag!r} differs from worker_config.yaml {config_flag!r}"
        )

    rung_source = registry.get("rung") or {}
    if not isinstance(rung_source, dict):
        raise SourceError(f"{where}: rung must be a mapping")
    if kind == "gate":
        if rung_source:
            raise SourceError(f"{where}: a gate has no rung")
        rung = {}
    else:
        missing = [t for t in TRADER_TYPES if t not in rung_source]
        extra = [t for t in rung_source if t not in TRADER_TYPES]
        if missing or extra:
            raise SourceError(
                f"{where}: rung needs exactly {', '.join(TRADER_TYPES)} (missing {missing}, unknown {extra})"
            )
        if any(not isinstance(rung_source[t], str) or not rung_source[t] for t in TRADER_TYPES):
            raise SourceError(f"{where}: every rung must be a name")
        rung = {t: rung_source[t] for t in TRADER_TYPES}

    states = registry.get("states")
    if not isinstance(states, list) or not states:
        raise SourceError(f"{where}: states is missing")
    state_codes = []
    levels = []
    for state in states:
        code = state.get("code") if isinstance(state, dict) else None
        if not isinstance(code, str) or not code.startswith(f"{mcd_id}_"):
            raise SourceError(f"{where}: state code {code!r} does not start with {mcd_id}_")
        state_codes.append(code)
        for level in state.get("levels") or []:
            if not isinstance(level, str):
                raise SourceError(f"{where}: a level name of {code} is not a string")
            levels.append(level)
    if len(set(state_codes)) != len(state_codes):
        raise SourceError(f"{where}: a state code appears twice")

    return {
        "mcd_id": mcd_id,
        "name": name.strip(),
        "kind": kind,
        "timeframes": list(timeframes),
        "depends_on": list(depends_on),
        "uses_channel": list(uses_channel),
        "rung": rung,
        "primary_for": [t for t in TRADER_TYPES if rung.get(t) == PRIMARY_RUNG],
        "on_board": kind != "gate",
        "flag": flag,
        "owned_terms": unique(levels),
        "state_codes": state_codes,
    }


def build(engine: Path):
    """The roster and the registry codes, from the registries under `engine`."""
    config = load_yaml(engine / "mcd_worker" / "worker_config.yaml")
    if not isinstance(config, dict) or not isinstance(config.get("flags"), dict):
        raise SourceError("worker_config.yaml: flags is missing")
    flags = config["flags"]
    synthesis = config.get("synthesis") or {}

    sensors = []
    for path in registry_files(engine):
        registry = load_yaml(path)
        if not isinstance(registry, dict):
            raise SourceError(f"{path}: is not a mapping")
        mcd_id = registry.get("mcd_id")
        if mcd_id not in flags:
            raise SourceError(f"worker_config.yaml: no flag for {mcd_id}; add it under flags")
        sensors.append(build_sensor(registry, path, read_flag(flags[mcd_id], f"worker_config.yaml {mcd_id}")))

    ids = [s["mcd_id"] for s in sensors]
    if len(set(ids)) != len(ids):
        raise SourceError("two registries declare the same mcd_id")
    for name in flags:
        if name != "SYN" and name not in ids:
            raise SourceError(f"worker_config.yaml: a flag for {name}, which has no registry file")
    for sensor in sensors:
        for dependency in sensor["depends_on"]:
            if dependency not in ids:
                raise SourceError(f"{sensor['mcd_id']} depends on {dependency}, which has no registry")

    for trader_type in TRADER_TYPES:
        claimants = [s["mcd_id"] for s in sensors if s["on_board"] and trader_type in s["primary_for"]]
        if len(claimants) != 1:
            raise SourceError(
                f"{trader_type} needs exactly one primary sensor (rung {PRIMARY_RUNG}); found {claimants or 'none'}"
            )

    roster = {
        "schema": ROSTER_SCHEMA,
        "synthesis": {
            "flag": read_flag(flags.get("SYN"), "worker_config.yaml SYN"),
            "rules_version": str(synthesis.get("rules_version", "")),
        },
        "sensors": sensors,
    }
    if not roster["synthesis"]["rules_version"]:
        raise SourceError("worker_config.yaml: synthesis.rules_version is missing")
    codes = {
        "schema": CODES_SCHEMA,
        "mcd_ids": ids,
        "board_mcd_ids": [s["mcd_id"] for s in sensors if s["on_board"]],
        "state_codes": {s["mcd_id"]: s["state_codes"] for s in sensors},
        "timeframes": list(TIMEFRAMES),
    }
    return roster, codes


def render(document: dict) -> bytes:
    """LF line endings on every platform (Path.write_text would write CRLF on Windows)."""
    return (json.dumps(document, indent=2, ensure_ascii=False) + "\n").encode("utf-8")


def differs(path: Path, document: dict) -> bool:
    try:
        return json.loads(path.read_bytes().decode("utf-8")) != document
    except (OSError, ValueError):
        return True


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--check", action="store_true", help="exit 1 if a file differs from a rebuild")
    parser.add_argument("--engine-dir", type=Path, default=ENGINE, help="the engine-1-5-new folder")
    parser.add_argument("--roster", type=Path, default=DEFAULT_ROSTER, help="where the roster goes")
    parser.add_argument("--codes", type=Path, default=DEFAULT_CODES, help="where the registry codes go")
    args = parser.parse_args(argv)

    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    try:
        roster, codes = build(args.engine_dir)
    except SourceError as error:
        sys.stderr.write(f"build_roster: {error}\n")
        return 2

    targets = ((args.roster, roster), (args.codes, codes))
    if args.check:
        stale = [str(path) for path, document in targets if differs(path, document)]
        if stale:
            sys.stdout.write("build_roster --check: differs from a rebuild: " + ", ".join(stale) + "\n")
            return 1
        sys.stdout.write(
            f"build_roster --check: equal ({len(roster['sensors'])} sensors, "
            f"{sum(len(c) for c in codes['state_codes'].values())} state codes)\n"
        )
        return 0

    for path, document in targets:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(render(document))
        sys.stdout.write(f"wrote {path}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
