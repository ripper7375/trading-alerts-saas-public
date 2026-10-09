"""Golden scenarios: cycles with expected outputs that Davin approves, file by file (architecture 7.7; build step 4 part 7, plan decision D13).

A golden scenario is one cycle and what the sensor-to-zones layer makes of it: the sensors' readings, the Day Trader and Scalper SYN readings, the
entry zones and the modal pills. Each lives in a folder of ``mcd_worker/golden/`` with four files:

* ``scenario.json``: the input. ``"kind": "cycle"`` names a stored bundle of ``mcd_worker/fixtures/`` (a real cycle: the runner makes the sensors'
  readings, then synthesis); ``"kind": "readings"`` gives the sensors' readings and the few bundle facts synthesis reads (a synthetic cycle: only
  the synthesis layer runs, on readings built through the kit so they validate);
* ``expected.json``: the exact expected output (the sensors' canonical envelopes with their hashes, the ``synthesis`` section the runner makes, the
  pills). Written by ``record``; compared byte for byte by ``check``;
* ``review.md``: the same, as tables for a person to read before signing. Written by ``record``; compared by ``check``;
* ``approval.json``: the sign-off. ``record`` writes it ``PENDING`` and **never** writes ``APPROVED``: Davin edits the three fields ``status``,
  ``approved_by`` and ``approved_on``. It records the SHA-256 of ``scenario.json`` and of ``expected.json`` as he reviewed them, so any later change
  to either shows up as "changed after approval" and ``record`` puts the scenario back to ``PENDING``.

``golden/INDEX.md`` lists the scenarios, what each decided and which rows of the rules table the set covers.

Run from ``davintrade-stack-d-and-e/engine-1-5-new/``::

    python -B -m mcd_worker.tools.golden list                      # the scenarios, their outcomes and their approval status
    python -B -m mcd_worker.tools.golden check [--require-approved] [--only ID ...]
    python -B -m mcd_worker.tools.golden record [--only ID ...]    # rewrite expected.json, review.md, INDEX.md and (PENDING) approval.json

``check`` exits 1 when anything differs or an approval is stale, and with ``--require-approved`` also when any scenario is still ``PENDING`` (the
release gate of 7.7). Reading a file is newline-insensitive (a CRLF checkout compares equal) and the hashes are taken over LF text.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Any, Mapping, Sequence

from mcd_common import envelope as env
from mcd_common import reason_codes as rc
from mcd_common.cycle_inputs import DATA_STATUSES, CycleInputs, is_number, is_slot, slot_to_epoch

from ..cycle_runner import Worker, bundle_canonical_json
from ..flags import DEFAULT_CONFIG_PATH, load_worker_config
from ..registry import ENGINE_DIR, load_registry
from ..synthesis import cycle as syn_cycle
from ..synthesis.pills import pills_from_rows
from ..synthesis.rules import NO_MATCH_ID, PROFILES, Rules

WORKER_DIR = ENGINE_DIR / "mcd_worker"
GOLDEN_DIR = WORKER_DIR / "golden"
FIXTURES_DIR = WORKER_DIR / "fixtures"

SCENARIO_SCHEMA = "golden-scenario/1"
EXPECTED_SCHEMA = "golden-expected/1"
APPROVAL_SCHEMA = "golden-approval/1"
PENDING, APPROVED = "PENDING", "APPROVED"
KIND_CYCLE, KIND_READINGS = "cycle", "readings"
SYNTHESIS_SHADOW = {**{f"MCD{n}": "shadow" for n in range(4)}, "SYN": "shadow"}
ID_RE = re.compile(r"[0-9]{2}-[a-z0-9]+(?:-[a-z0-9]+)*")
DATE_RE = re.compile(r"[0-9]{4}-[0-9]{2}-[0-9]{2}")
SR_RE = re.compile(r"sr_([1-9]|1[0-6])")

# Which timeframes' channel lines each synthesis sensor gives (the registers' `levels`; MCD3 gives both channels, MCD2's M5 one is the zone source).
SENSOR_CHANNELS: Mapping[str, tuple[str, ...]] = {"MCD1": ("M15",), "MCD2": ("M5",), "MCD3": ("M15", "M5")}
LEVEL_NAMES = ("UOEDT", "baseline", "LOEDT")
LEVEL_ROLES = {"UOEDT": "resistance", "baseline": "mid", "LOEDT": "support"}
SENSOR_STATUSES = (rc.VALID, rc.CAUTIONARY, rc.INVALID, rc.STALE)
SYNTHETIC_COMMENTARY = "Synthetic reading written for a golden scenario; the evaluator did not produce it."
SYNTHETIC_SUMMARY = "Golden scenario reading"
BAR_SECONDS = 300

# Cells of the rules table (trader type, rule) that no input can reach, pinned by tests/test_synthesis_engine.py and written in synthesis.md section 7:
# rows 2, 3s and 4 together cover every state of MCD2, so a Scalper with a usable MCD2 always matches one of them before row 5 or "no match".
UNREACHABLE: frozenset[tuple[str, str]] = frozenset({("SCALPER", "R5_UNRESOLVED_CONFLICT"), ("SCALPER", NO_MATCH_ID)})


class GoldenError(Exception):
    """A scenario, an approval or a request is not usable. ``problems`` lists every reason."""

    def __init__(self, problems: Sequence[str] | str) -> None:
        self.problems = [problems] if isinstance(problems, str) else list(problems)
        super().__init__("; ".join(self.problems))


# --------------------------------------------------------------------------- text and hashes


def lf(text: str) -> str:
    return text.replace("\r\n", "\n")


def text_sha256(text: str) -> str:
    return hashlib.sha256(lf(text).encode("utf-8")).hexdigest()


def read_text(path: Path) -> str:
    return lf(path.read_text(encoding="utf-8"))


def write_text(path: Path, text: str) -> None:
    path.write_bytes(lf(text).encode("utf-8"))  # LF on disk, whatever the platform (the checkout's tools write LF)


def dump(data: Any) -> str:
    return json.dumps(data, indent=2, ensure_ascii=True, allow_nan=False) + "\n"


def first_difference(stored: str, built: str) -> str:
    """Where two texts first differ, as a line number and the two lines."""
    a, b = stored.split("\n"), built.split("\n")
    for number, (left, right) in enumerate(zip(a, b), start=1):
        if left != right:
            return f"line {number}: stored {left.strip()[:90]!r}, rebuilt {right.strip()[:90]!r}"
    return f"one text is longer: stored {len(a)} lines, rebuilt {len(b)} lines"


# --------------------------------------------------------------------------- the world a run needs


@dataclass(frozen=True)
class World:
    registry: Any
    synthesizer: syn_cycle.Synthesizer
    worker: Worker

    @property
    def rules(self) -> Rules:
        return self.synthesizer.rules


@lru_cache(maxsize=1)
def world() -> World:
    """The real registry, the rules and zone parameters of ``worker_config.yaml``, and a worker with every MCD and ``SYN`` at ``shadow``."""
    registry = load_registry(ENGINE_DIR)
    config = load_worker_config(DEFAULT_CONFIG_PATH)
    synthesizer = syn_cycle.Synthesizer.load(registry, rules_version=config.rules_version)
    return World(registry, synthesizer, Worker.load(flags=SYNTHESIS_SHADOW))


# --------------------------------------------------------------------------- scenarios


def _is_price(value: Any) -> bool:
    return is_number(value) and value > 0


def scenario_problems(data: Any, folder_name: str, registry: Any) -> list[str]:
    """Every way a ``scenario.json`` is not usable (empty list = usable). Strict: an unknown key is a problem, so a typo cannot go unnoticed."""
    if not isinstance(data, Mapping):
        return [f"the scenario is a {type(data).__name__}, not an object"]
    problems: list[str] = []
    common = {"schema", "id", "title", "why", "kind"}
    kind = data.get("kind")
    if kind == KIND_CYCLE:
        allowed = common | {"bundle"}
    elif kind == KIND_READINGS:
        allowed = common | {"cycle_slot", "data_status", "reference_close", "forming_close", "context_levels", "sensors"}
    else:
        return [f"kind must be {KIND_CYCLE!r} or {KIND_READINGS!r}, got {kind!r}"]
    for key in sorted(set(data) - allowed):
        problems.append(f"unknown key {key!r}")
    for key in sorted(allowed - set(data) - {"forming_close", "context_levels"}):
        problems.append(f"missing key {key!r}")
    if data.get("schema") != SCENARIO_SCHEMA:
        problems.append(f"schema must be {SCENARIO_SCHEMA!r}")
    if data.get("id") != folder_name or not (isinstance(folder_name, str) and ID_RE.fullmatch(folder_name)):
        problems.append(f"id must be the folder name {folder_name!r} (NN-words-with-dashes)")
    for key in ("title", "why"):
        if key in data and not (isinstance(data[key], str) and data[key].strip()):
            problems.append(f"{key} must be a non-empty text")
    if kind == KIND_CYCLE:
        bundle = data.get("bundle")
        if not (isinstance(bundle, str) and re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{4}Z", bundle)):
            problems.append("bundle must be the stem of a fixture, like 2026-09-18T2055Z")
        elif not (FIXTURES_DIR / f"{bundle}.bundle.json").is_file():
            problems.append(f"no fixture {bundle}.bundle.json")
        return problems
    slot = data.get("cycle_slot")
    if not is_slot(slot):
        problems.append(f"cycle_slot is not an ISO 8601 UTC 5-minute slot: {slot!r}")
    if "data_status" in data and data["data_status"] not in DATA_STATUSES:
        problems.append(f"data_status must be one of {', '.join(DATA_STATUSES)}")
    if "reference_close" in data and not _is_price(data["reference_close"]):
        problems.append("reference_close must be a positive number")
    if data.get("forming_close") is not None and not _is_price(data["forming_close"]):
        problems.append("forming_close must be a positive number")
    context = data.get("context_levels", {})
    if not isinstance(context, Mapping):
        problems.append("context_levels must be an object")
    else:
        for tf, row in context.items():
            if tf not in ("M5", "M15") or not isinstance(row, Mapping):
                problems.append(f"context_levels.{tf} must be M5 or M15 holding an object")
                continue
            for name, price in row.items():
                if not SR_RE.fullmatch(name) or not (price is None or _is_price(price)):
                    problems.append(f"context_levels.{tf}.{name} must be sr_1 to sr_16 holding a positive number or null")
    sensors = data.get("sensors")
    if not isinstance(sensors, Mapping) or not sensors:
        problems.append("sensors must be an object with at least one sensor")
        return problems
    for mcd_id, spec in sensors.items():
        where = f"sensors.{mcd_id}"
        if mcd_id not in SENSOR_CHANNELS:
            problems.append(f"{where}: synthesis reads MCD1, MCD2 and MCD3 only")
            continue
        problems += _sensor_problems(where, mcd_id, spec, registry)
    return problems


def _sensor_problems(where: str, mcd_id: str, spec: Any, registry: Any) -> list[str]:
    if not isinstance(spec, Mapping):
        return [f"{where} must be an object"]
    problems: list[str] = []
    status = spec.get("status")
    if status not in SENSOR_STATUSES:
        return [f"{where}.status must be one of {', '.join(SENSOR_STATUSES)}"]
    usable = status in (rc.VALID, rc.CAUTIONARY)
    allowed = {"status", "state", "levels", "reasons"} if usable else {"status", "reasons"}
    for key in sorted(set(spec) - allowed):
        problems.append(f"{where}: unknown key {key!r}" + ("" if usable else f" (a {status} reading has no state and no levels)"))
    reasons = spec.get("reasons", [])
    if not (isinstance(reasons, list) and all(isinstance(r, str) and r for r in reasons)):
        problems.append(f"{where}.reasons must be a list of reason codes")
        reasons = []
    if status == rc.VALID and reasons:
        problems.append(f"{where}: a VALID reading has no reasons")
    if status != rc.VALID and not reasons:
        problems.append(f"{where}: a {status} reading needs reason codes")
    if not usable:
        return problems
    states = registry[mcd_id].states
    if spec.get("state") not in states:
        problems.append(f"{where}.state must be a state of {mcd_id}'s register")
    levels = spec.get("levels")
    channels = SENSOR_CHANNELS[mcd_id]
    if not (isinstance(levels, Mapping) and set(levels) == set(channels)):
        problems.append(f"{where}.levels must hold exactly {', '.join(channels)}")
        return problems
    for tf, triple in levels.items():
        if not (isinstance(triple, list) and len(triple) == 3 and all(_is_price(p) for p in triple) and triple[0] > triple[1] > triple[2]):
            problems.append(f"{where}.levels.{tf} must be [UOEDT, baseline, LOEDT], three prices from high to low")
    return problems


def load_scenario(folder: Path) -> tuple[dict[str, Any], str]:
    """``(scenario, its text)``. Raises ``GoldenError`` listing why a scenario is unusable."""
    path = folder / "scenario.json"
    if not path.is_file():
        raise GoldenError(f"{folder.name}: scenario.json is missing")
    text = read_text(path)
    try:
        data = json.loads(text)
    except json.JSONDecodeError as exc:
        raise GoldenError(f"{folder.name}: scenario.json is not valid JSON ({exc})") from exc
    problems = scenario_problems(data, folder.name, world().registry)
    if problems:
        raise GoldenError([f"{folder.name}: {p}" for p in problems])
    return data, text


def scenario_folders(root: Path = GOLDEN_DIR) -> list[Path]:
    return sorted(p for p in root.iterdir() if p.is_dir() and not p.name.startswith((".", "_")))


# --------------------------------------------------------------------------- running a scenario


def build_envelope(registry: Any, mcd_id: str, spec: Mapping[str, Any], slot: str) -> dict[str, Any]:
    """One synthetic sensor reading, built through the kit and checked against ``mcd-output/1``."""
    sensor = registry[mcd_id]
    common = dict(depends_on=sensor.depends_on)
    status = spec["status"]
    if status in (rc.INVALID, rc.STALE):
        build = env.invalid if status == rc.INVALID else env.stale
        reading = env.canonical(build(mcd_id, sensor.evaluator_version, slot, spec["reasons"], **common))
    else:
        entry = sensor.states[spec["state"]]
        levels = [
            {"name": name, "tf": tf, "price": price, "role": LEVEL_ROLES[name]}
            for tf in SENSOR_CHANNELS[mcd_id]
            for name, price in zip(LEVEL_NAMES, spec["levels"][tf])
        ]
        fields = dict(
            state_code=entry.code, bias=entry.bias, regime_status=entry.regime_status, levels=levels,
            summary_line=SYNTHETIC_SUMMARY, commentary=SYNTHETIC_COMMENTARY, **common,
        )
        if status == rc.CAUTIONARY:
            reading = env.canonical(env.cautionary(mcd_id, sensor.evaluator_version, slot, spec["reasons"], **fields))
        else:
            reading = env.canonical(env.valid(mcd_id, sensor.evaluator_version, slot, **fields))
    errors = env.schema_errors(reading)
    if errors:
        raise GoldenError(f"{mcd_id}: the built reading breaks mcd-output/1: {errors[:3]}")
    return reading


def build_inputs(scenario: Mapping[str, Any]) -> CycleInputs:
    """The smallest bundle synthesis can read: one closed M5 bar (the reference price), the bar still forming (which must be ignored), ``context_levels``."""
    slot = scenario["cycle_slot"]
    epoch = slot_to_epoch(slot)
    bars: list[dict[str, Any]] = [{"timestamp": epoch - BAR_SECONDS, "close": scenario["reference_close"]}]
    if scenario.get("forming_close") is not None:
        bars.append({"timestamp": epoch, "close": scenario["forming_close"]})  # open at the slot: not closed (ADR-011), never the reference price
    return CycleInputs(
        symbol="XAUUSD", cycle_slot=slot, data_status=scenario.get("data_status", "FRESH"), retuning=False,
        bars={"M5": tuple(bars), "M15": ()}, statistics={}, stats_slot={}, active_indicator={}, config_hash={}, channel_mode={},
        context_levels=scenario.get("context_levels") or {},
    )


def _sensor_record(mcd_id: str, envelope_json: str, envelope: Mapping[str, Any]) -> dict[str, Any]:
    return {
        "mcd_id": mcd_id,
        "status": envelope["status"],
        "state_code": envelope["state_code"],
        "bias": envelope["bias"],
        "envelope_sha256": hashlib.sha256(envelope_json.encode("utf-8")).hexdigest(),
        "envelope_json": envelope_json,
    }


def compute(scenario: Mapping[str, Any]) -> dict[str, Any]:
    """The expected output of a scenario, as a plain dict in file order.

    The answer is kept for the life of the process, keyed by the scenario's content: the runner is the slow part (a real cycle runs every evaluator), and ``record``
    builds the index from every scenario again. A scenario is a pure input, so the same content always gives the same answer.
    """
    return json.loads(_compute_text(json.dumps(scenario, sort_keys=True)))


@lru_cache(maxsize=None)
def _compute_text(scenario_text: str) -> str:
    return json.dumps(_compute(json.loads(scenario_text)))


def _compute(scenario: Mapping[str, Any]) -> dict[str, Any]:
    w = world()
    if scenario["kind"] == KIND_CYCLE:
        inputs = CycleInputs.from_dict(json.loads(read_text(FIXTURES_DIR / f"{scenario['bundle']}.bundle.json")))
        result = w.worker.run_cycle(inputs)
        if result.synthesis is None or result.synthesis.error:
            raise GoldenError(f"{scenario['id']}: synthesis did not run ({result.synthesis and result.synthesis.error})")
        sensors = [_sensor_record(r.mcd_id, r.envelope_json, r.envelope) for r in result.results]
        synthesis = result.synthesis
    else:
        inputs = build_inputs(scenario)
        readings = {m: build_envelope(w.registry, m, spec, inputs.cycle_slot) for m, spec in scenario["sensors"].items()}
        synthesis = w.synthesizer.run("shadow", readings, inputs)
        if synthesis.error:
            raise GoldenError(f"{scenario['id']}: synthesis raised ({synthesis.error})")
        sensors = [_sensor_record(m, env.canonical_json(readings[m]), readings[m]) for m in sorted(readings)]
    section = synthesis.to_dict()
    return {
        "schema": EXPECTED_SCHEMA,
        "scenario": scenario["id"],
        "kind": scenario["kind"],
        "cycle_slot": inputs.cycle_slot,
        "data_status": inputs.data_status,
        "inputs_sha256": hashlib.sha256(bundle_canonical_json(inputs).encode("utf-8")).hexdigest(),
        "reference_price": section["reference_price"],
        "sensors": sensors,
        "synthesis": section,
        "pills": {item["profile"]: list(pills_from_rows(json.loads(item["zones_json"]))) for item in section["readings"]},
    }


# --------------------------------------------------------------------------- reading an expected output


def decoded(expected: Mapping[str, Any]) -> dict[str, dict[str, Any]]:
    """Per trader type: the SYN reading, the zone rows, why there are none, the pills. A refused reading has ``reading`` of ``None``."""
    out: dict[str, dict[str, Any]] = {}
    for item in expected["synthesis"]["readings"]:
        out[item["profile"]] = {
            "reading": json.loads(item["reading_json"]) if item["reading_json"] is not None else None,
            "zones": json.loads(item["zones_json"]),
            "zones_reason": item["zones_reason"],
            "guard_problems": item["guard_problems"],
            "pills": expected["pills"][item["profile"]],
        }
    return out


def outcome(item: Mapping[str, Any]) -> str:
    """One line for a trader type: ``R3_TREND_CONTINUATION/TREND_UP LONG A WITH_TREND CAUTIONARY, 2 zones``."""
    reading = item["reading"]
    if reading is None:
        return "READING REFUSED: " + "; ".join(item["guard_problems"])
    head = f"{reading['rule_id']}" + (f"/{reading['branch_id']}" if reading["branch_id"] else "")
    kind = " ".join(x for x in (reading["bias"], reading["archetype"], reading["trend_relation"]) if x)
    zones = f"{len(item['zones'])} zone(s)" if item["zones"] else f"no zones ({item['zones_reason']})"
    return f"{head} {kind} {reading['status']}, {zones}"


# --------------------------------------------------------------------------- review.md and INDEX.md


def money(value: Any) -> str:
    return "" if value is None else f"{value:.2f}"


def level_text(level: Mapping[str, Any] | None) -> str:
    return "none" if level is None else f"{level['tf']} {level['name']} {money(level['price'])}"


def render_review(scenario: Mapping[str, Any], expected: Mapping[str, Any]) -> str:
    lines = [
        f"# {scenario['id']}: {scenario['title']}",
        "",
        "Generated by `python -B -m mcd_worker.tools.golden record`; do not edit. The exact expected output is `expected.json`; "
        "the sign-off is `approval.json`.",
        "",
        f"**Why this scenario:** {scenario['why']}",
        "",
        f"**Cycle:** `{expected['cycle_slot']}`, data status {expected['data_status']}, kind `{expected['kind']}`"
        + (f", stored bundle `{scenario['bundle']}`" if scenario["kind"] == KIND_CYCLE else "")
        + f". **Reference price** (close of the last closed M5 bar): {money(expected['reference_price'])}.",
    ]
    if scenario["kind"] == KIND_READINGS and scenario.get("forming_close") is not None:
        lines.append(f"The bar still forming closes at {money(scenario['forming_close'])}; it is not the reference price (ADR-011, D4).")
    if scenario.get("context_levels"):
        shown = ", ".join(f"{tf} {name} {money(p)}" for tf, row in scenario["context_levels"].items() for name, p in row.items() if p is not None)
        lines.append(f"Support and resistance levels in the bundle: {shown}.")
    lines += ["", "## What the sensors said", "", "| Sensor | Status | State | Bias | Reason codes | Levels (UOEDT / baseline / LOEDT) |", "| --- | --- | --- | --- | --- | --- |"]
    for sensor in expected["sensors"]:
        reading = json.loads(sensor["envelope_json"])
        by_tf: dict[str, dict[str, float]] = {}
        for level in reading["levels"]:
            by_tf.setdefault(level["tf"], {})[level["name"]] = level["price"]
        levels = "; ".join(f"{tf} " + " / ".join(money(p.get(n)) for n in LEVEL_NAMES) for tf, p in by_tf.items()) or "none"
        reasons = ", ".join(reading["status_reasons"]) or "none"
        lines.append(f"| {sensor['mcd_id']} | {sensor['status']} | {sensor['state_code'] or '-'} | {sensor['bias'] or '-'} | {reasons} | {levels} |")
    section = expected["synthesis"]
    lines += [
        "",
        f"## What synthesis made (rules `{section['rules_version']}`, zone parameters `{section['zones_version']}`)",
    ]
    for profile, item in decoded(expected).items():
        title = "Day Trader" if profile == "DAY_TRADER" else "Scalper"
        reading = item["reading"]
        lines += ["", f"### {title}", ""]
        if reading is None:
            lines += [f"The reading was refused: {'; '.join(item['guard_problems'])}"]
            continue
        lines += [
            "| Rule | Branch | Bias | Archetype | Trend relation | Status | Stand aside |",
            "| --- | --- | --- | --- | --- | --- | --- |",
            f"| {reading['rule_id']} | {reading['branch_id'] or '-'} | {reading['bias']} | {reading['archetype'] or '-'} | "
            f"{reading['trend_relation'] or '-'} | {reading['status']} | {'yes' if reading['stand_aside'] else 'no'} |",
            "",
            f"Summary line: **{reading['summary_line']}**",
            "",
            "Status reasons: " + (", ".join(reading["status_reasons"]) or "none"),
            "",
            "Reasons shown: " + ("; ".join(reading["reasons"]) or "none"),
            "",
        ]
        if item["zones"]:
            lines += [
                "| Zone | Range | Reference price | Invalidation | Stop | Opposing level | Runway | Runway ratio | Confluence | Source |",
                "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
            ]
            for z in item["zones"]:
                lines.append(
                    f"| {z['zone_id']} | {money(z['low'])} to {money(z['high'])} | {money(z['reference_price'])} | "
                    f"{money(z['invalidation_price'])} ({z['invalidation_basis']}) | {money(z['stop_distance'])} | {level_text(z['next_opposing_level'])} | "
                    f"{money(z['runway']) or 'none'} | {money(z['runway_ratio']) or 'none'} | {z['confluence_count']} | "
                    + ", ".join(f"{lv['tf']} {lv['name']} {money(lv['price'])}" for lv in z["source_levels"])
                    + " |"
                )
            lines += ["", "Modal pills: " + ", ".join(money(p) for p in item["pills"])]
        else:
            lines += [f"No zones: {item['zones_reason']}. Modal pills: none."]
    lines += ["", "## Hashes", ""]
    for item in section["readings"]:
        lines.append(f"- {item['profile']}: reading `{item['reading_sha256']}`, zones `{item['zones_sha256']}`")
    return "\n".join(lines) + "\n"


def short(scenario_id: str) -> str:
    return scenario_id.split("-", 1)[0]


def decisions(entries: Sequence[tuple[Mapping[str, Any], Mapping[str, Any]]]) -> dict[tuple[str, str, str | None], list[str]]:
    """``(trader type, rule id, branch id) -> scenario numbers`` over every scenario."""
    found: dict[tuple[str, str, str | None], list[str]] = {}
    for scenario, expected in entries:
        for profile, item in decoded(expected).items():
            if item["reading"] is not None:
                reading = item["reading"]
                found.setdefault((profile, reading["rule_id"], reading["branch_id"]), []).append(short(scenario["id"]))
    return found


def coverage(entries: Sequence[tuple[Mapping[str, Any], Mapping[str, Any]]], rules: Rules) -> tuple[list[tuple[str, str, str]], list[tuple[str, str, str]]]:
    """``(rule cells, branch rows)``: for each rule and trader type the scenarios that decided it, and for each branch the same."""
    found = decisions(entries)
    cells: list[tuple[str, str, str]] = []
    for rule_id in (*rules.rule_ids, NO_MATCH_ID):
        row = []
        for profile in PROFILES:
            applies = rule_id == NO_MATCH_ID or profile in next(r for r in rules.rules if r.id == rule_id).profiles
            ids = sorted({n for (p, r, _b), numbers in found.items() if p == profile and r == rule_id for n in numbers})
            if not applies:
                row.append("not a row for this trader type")
            elif ids:
                row.append(", ".join(ids))
            elif (profile, rule_id) in UNREACHABLE:
                row.append("unreachable (synthesis.md section 7)")
            else:
                row.append("NOT COVERED")
        cells.append((rule_id, row[0], row[1]))
    branches: list[tuple[str, str, str]] = []
    for rule in rules.rules:
        for branch in rule.branches:
            ids = sorted({n for (_p, r, b), numbers in found.items() if r == rule.id and b == branch.id for n in numbers})
            branches.append((rule.id, branch.id, ", ".join(ids) or "NOT COVERED"))
    return cells, branches


def render_index(entries: Sequence[tuple[Mapping[str, Any], Mapping[str, Any]]], rules: Rules) -> str:
    cells, branches = coverage(entries, rules)
    lines = [
        "# Golden scenarios",
        "",
        "Generated by `python -B -m mcd_worker.tools.golden record`; do not edit. What a scenario is, how to read it and how to sign it off: `README.md`. "
        "The sign-off of each scenario is its `approval.json`, so it is not repeated here.",
        "",
        f"Rules `{rules.version}`. {len(entries)} scenarios.",
        "",
        "## The scenarios",
        "",
        "| # | Scenario | Kind | Day Trader | Scalper |",
        "| --- | --- | --- | --- | --- |",
    ]
    for scenario, expected in entries:
        item = decoded(expected)
        lines.append(
            f"| {short(scenario['id'])} | [{scenario['id']}]({scenario['id']}/review.md): {scenario['title']} | {scenario['kind']} | "
            f"{outcome(item['DAY_TRADER'])} | {outcome(item['SCALPER'])} |"
        )
    lines += ["", "## Coverage of the rules table", "", "Numbers are the scenarios in which the rule decided the reading.", "", "| Rule | Day Trader | Scalper |", "| --- | --- | --- |"]
    lines += [f"| {rule} | {day} | {scalper} |" for rule, day, scalper in cells]
    lines += ["", "## Coverage by branch", "", "| Rule | Branch | Scenarios (either trader type) |", "| --- | --- | --- |"]
    lines += [f"| {rule} | {branch} | {ids} |" for rule, branch, ids in branches]
    return "\n".join(lines) + "\n"


# --------------------------------------------------------------------------- approval


def new_approval(scenario_id: str, scenario_text: str, expected_text: str, old: Mapping[str, Any] | None) -> dict[str, Any]:
    """The approval ``record`` writes: PENDING unless an approval is still true of exactly these two files. Never APPROVED on its own."""
    fresh = {
        "schema": APPROVAL_SCHEMA,
        "scenario": scenario_id,
        "status": PENDING,
        "approved_by": None,
        "approved_on": None,
        "scenario_sha256": text_sha256(scenario_text),
        "expected_sha256": text_sha256(expected_text),
        "note": "",
    }
    if not isinstance(old, Mapping):
        return fresh
    if old.get("status") == APPROVED and not approval_problems(old, scenario_id, scenario_text, expected_text):
        return dict(old)
    if old.get("status") == APPROVED:
        fresh["note"] = (
            f"Reset by record: the scenario or its expected output changed after {old.get('approved_by')} approved it on {old.get('approved_on')}. "
            "It needs a new approval."
        )
    elif isinstance(old.get("note"), str):
        fresh["note"] = old["note"]
    return fresh


def approval_problems(approval: Any, scenario_id: str, scenario_text: str, expected_text: str) -> list[str]:
    if not isinstance(approval, Mapping):
        return ["approval.json is not an object"]
    problems: list[str] = []
    keys = {"schema", "scenario", "status", "approved_by", "approved_on", "scenario_sha256", "expected_sha256", "note"}
    for key in sorted(set(approval) - keys):
        problems.append(f"approval.json: unknown key {key!r}")
    for key in sorted(keys - set(approval)):
        problems.append(f"approval.json: missing key {key!r}")
    if problems:
        return problems
    if approval["schema"] != APPROVAL_SCHEMA:
        problems.append(f"approval.json: schema must be {APPROVAL_SCHEMA!r}")
    if approval["scenario"] != scenario_id:
        problems.append(f"approval.json: scenario is {approval['scenario']!r}, not {scenario_id!r}")
    if approval["status"] not in (PENDING, APPROVED):
        problems.append(f"approval.json: status must be {PENDING} or {APPROVED}")
        return problems
    if approval["scenario_sha256"] != text_sha256(scenario_text):
        problems.append("approval.json: scenario_sha256 is not the hash of scenario.json" + (" (changed after approval)" if approval["status"] == APPROVED else ""))
    if approval["expected_sha256"] != text_sha256(expected_text):
        problems.append("approval.json: expected_sha256 is not the hash of expected.json" + (" (changed after approval)" if approval["status"] == APPROVED else ""))
    if approval["status"] == APPROVED:
        if not (isinstance(approval["approved_by"], str) and approval["approved_by"].strip()):
            problems.append("approval.json: APPROVED needs approved_by")
        if not (isinstance(approval["approved_on"], str) and DATE_RE.fullmatch(approval["approved_on"])):
            problems.append("approval.json: APPROVED needs approved_on as YYYY-MM-DD")
    return problems


# --------------------------------------------------------------------------- record and check


@dataclass
class Report:
    scenario: str
    problems: list[str] = field(default_factory=list)
    approval_status: str | None = None
    expected_sha256: str | None = None

    @property
    def ok(self) -> bool:
        return not self.problems


def _all_entries(root: Path) -> list[tuple[dict[str, Any], dict[str, Any]]]:
    """``(scenario, expected)`` for every scenario of ``root``, freshly computed."""
    return [(scenario, compute(scenario)) for scenario in (load_scenario(folder)[0] for folder in scenario_folders(root))]


def record(root: Path = GOLDEN_DIR, only: Sequence[str] = ()) -> list[str]:
    """Rewrite ``expected.json``, ``review.md``, ``INDEX.md`` and a PENDING ``approval.json`` where the approval is not still true. Returns what was written."""
    folders = scenario_folders(root)
    if only:
        unknown = sorted(set(only) - {f.name for f in folders})
        if unknown:
            raise GoldenError(f"no such scenario: {', '.join(unknown)}")
    written: list[str] = []
    for folder in folders:
        if only and folder.name not in only:
            continue
        scenario, scenario_text = load_scenario(folder)
        expected = compute(scenario)
        expected_text = dump(expected)
        old = None
        if (folder / "approval.json").is_file():
            try:
                old = json.loads(read_text(folder / "approval.json"))
            except json.JSONDecodeError:
                old = None
        approval_text = dump(new_approval(folder.name, scenario_text, expected_text, old))
        for name, text in (("expected.json", expected_text), ("review.md", render_review(scenario, expected)), ("approval.json", approval_text)):
            path = folder / name
            if not path.is_file() or read_text(path) != text:
                write_text(path, text)
                written.append(f"{folder.name}/{name}")
    index = render_index(_all_entries(root), world().rules)
    if not (root / "INDEX.md").is_file() or read_text(root / "INDEX.md") != index:
        write_text(root / "INDEX.md", index)
        written.append("INDEX.md")
    return written


def check(root: Path = GOLDEN_DIR, only: Sequence[str] = ()) -> tuple[list[Report], list[str]]:
    """Rebuild every scenario and compare with the stored files. Returns one report per scenario and the problems of the set (INDEX.md)."""
    folders = scenario_folders(root)
    if only:
        unknown = sorted(set(only) - {f.name for f in folders})
        if unknown:
            raise GoldenError(f"no such scenario: {', '.join(unknown)}")
    reports: list[Report] = []
    built: list[tuple[dict[str, Any], dict[str, Any]]] = []
    for folder in folders:
        if only and folder.name not in only:
            continue  # a partial run rebuilds only what it was asked for
        report = Report(folder.name)
        try:
            scenario, scenario_text = load_scenario(folder)
            expected = compute(scenario)
        except GoldenError as exc:
            report.problems += exc.problems
            reports.append(report)
            continue
        built.append((scenario, expected))
        expected_text = dump(expected)
        report.expected_sha256 = text_sha256(expected_text)
        for name, text in (("expected.json", expected_text), ("review.md", render_review(scenario, expected))):
            path = folder / name
            if not path.is_file():
                report.problems.append(f"{name} is missing (run record)")
            elif read_text(path) != text:
                report.problems.append(f"{name} differs from a fresh run: {first_difference(read_text(path), text)}")
        path = folder / "approval.json"
        if not path.is_file():
            report.problems.append("approval.json is missing (run record)")
        else:
            try:
                approval = json.loads(read_text(path))
            except json.JSONDecodeError as exc:
                approval = None
                report.problems.append(f"approval.json is not valid JSON ({exc})")
            if approval is not None:
                report.problems += approval_problems(approval, folder.name, scenario_text, expected_text)
                report.approval_status = approval.get("status") if isinstance(approval, Mapping) else None
        reports.append(report)
    set_problems: list[str] = []
    if len(built) == len(folders):  # every scenario was rebuilt (a partial run says nothing about the set)
        index = render_index(built, world().rules)
        path = root / "INDEX.md"
        if not path.is_file():
            set_problems.append("INDEX.md is missing (run record)")
        elif read_text(path) != index:
            set_problems.append(f"INDEX.md differs from a fresh run: {first_difference(read_text(path), index)}")
    return reports, set_problems


def set_digest(reports: Sequence[Report]) -> str:
    """One hash over the scenario ids and the hashes of their expected outputs: equal across processes, hash seeds and platforms."""
    text = "\n".join(f"{r.scenario} {r.expected_sha256}" for r in sorted(reports, key=lambda r: r.scenario))
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


# --------------------------------------------------------------------------- command line


def _list(root: Path) -> int:
    for folder in scenario_folders(root):
        scenario, _text = load_scenario(folder)
        expected = compute(scenario)
        item = decoded(expected)
        approval = "no approval.json"
        if (folder / "approval.json").is_file():
            try:
                approval = json.loads(read_text(folder / "approval.json")).get("status", "?")
            except json.JSONDecodeError:
                approval = "approval.json unreadable"
        print(f"{folder.name}  [{scenario['kind']}]  {approval}")
        print(f"    Day Trader: {outcome(item['DAY_TRADER'])}")
        print(f"    Scalper:    {outcome(item['SCALPER'])}")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -B -m mcd_worker.tools.golden", description=__doc__.split("\n\n")[0])
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("list", help="the scenarios, their outcomes and their approval status")
    check_parser = sub.add_parser("check", help="rebuild every scenario and compare with the stored files; write nothing")
    check_parser.add_argument("--require-approved", action="store_true", help="also fail while any scenario is still PENDING (the release gate)")
    check_parser.add_argument("--only", nargs="+", default=[], metavar="ID")
    record_parser = sub.add_parser("record", help="write expected.json, review.md, INDEX.md and (PENDING) approval.json; never writes APPROVED")
    record_parser.add_argument("--only", nargs="+", default=[], metavar="ID")
    args = parser.parse_args(argv)
    try:
        if args.command == "list":
            return _list(GOLDEN_DIR)
        if args.command == "record":
            written = record(GOLDEN_DIR, args.only)
            for name in written:
                print(f"wrote  {name}")
            print(f"{len(written)} file(s) written" if written else "nothing to write: every file is already what a fresh run makes")
            return 0
        reports, set_problems = check(GOLDEN_DIR, args.only)
    except GoldenError as exc:
        for problem in exc.problems:
            print(f"ERROR  {problem}", file=sys.stderr)
        return 2
    failed = pending = 0
    for report in reports:
        status = report.approval_status or "-"
        if report.ok:
            print(f"same  {report.scenario}  ({status})")
        else:
            failed += 1
            print(f"DIFFERENT  {report.scenario}  ({status})")
            for problem in report.problems:
                print(f"    {problem}")
        pending += report.approval_status != APPROVED
    for problem in set_problems:
        failed += 1
        print(f"DIFFERENT  {problem}")
    print(f"{len(reports)} scenario(s), {len(reports) - pending} approved, {pending} pending approval, {failed} problem(s)")
    print(f"golden set sha256 {set_digest(reports)}")
    if failed:
        return 1
    if args.require_approved and pending:
        print(f"{pending} scenario(s) are not approved yet (--require-approved)", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
