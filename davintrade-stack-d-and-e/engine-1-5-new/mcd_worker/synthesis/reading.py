"""The SYN reading (``syn-output/1``): build it, write it canonically, and refuse one that is not fit to be saved (architecture 3.5).

One reading per trader type per cycle, stored like a sensor reading: byte-stable canonical JSON (the same decision always gives
the same text and the same hash, R4), with the rule id, the rules version and the rules checksum it was made with, so a stored
reading can be replayed and traced to one row of one file (3.2 point 4, ADR-026).

``synthesize_cycle`` is the entry point: the sensors' readings of one cycle in, a ``SynReading`` for each trader type out. It never
raises on odd input. A reading that fails a guard is returned with its ``problems`` and must not be saved: the runner (build step 4
part 3) drops it and logs the problems, and no sensor reading is ever changed by synthesis.

Guards, in order (the same spirit as ``mcd_worker.guards`` for the sensors):

1. ``SCHEMA``     the reading validates against ``syn-output-1.schema.json``, which also states the invariants (stand-aside means no
                  zones and no direction beyond STAND_ASIDE; a data stand-aside is INVALID or STALE; a VALID reading has no reasons);
2. ``REASONS``    every status reason is a code of standard Appendix D, or ``MODIFIER_CAUTION:<state of MCD3>``, and the codes explain
                  the status;
3. ``IDENTITY``   the version, the checksum and the rule named are the rules' own, the rule applies to the trader type, the branch is
                  one of the rule's;
4. ``WORDING``    no banned word and no percent sign or percent word in the summary, the reasons or the ids (R9; architecture 2.11:
                  no percentage or confidence word unless it comes from ``state_statistics``; ADR-035: no confidence grades).

Part 1 builds no zones: ``zones`` is empty unless the caller passes ids (the zone builder of part 2).
"""

from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any, Mapping, Sequence

from mcd_common import reason_codes as rc
from mcd_common import wording
from mcd_common.cycle_inputs import is_slot

from .. import guards
from .engine import MODIFIER_CAUTION, Decision, decide
from .rules import NO_MATCH_ID, PROFILES, Rules

SYN_ID = "SYN"
SCHEMA_VERSION = "syn-output/1"
SCHEMA_PATH = Path(__file__).with_name("syn-output-1.schema.json")

# Top-level key order of the canonical form (the schema's ``required`` list).
TOP_LEVEL_ORDER = (
    "schema_version",
    "mcd_id",
    "profile",
    "cycle_slot",
    "rules_version",
    "rules_sha256",
    "rule_id",
    "branch_id",
    "status",
    "status_reasons",
    "data_status",
    "archetype",
    "bias",
    "trend_relation",
    "stand_aside",
    "inputs",
    "reasons",
    "zones",
    "summary_line",
)
INPUT_ORDER = ("status", "state_code", "regime_status", "bias", "envelope_sha256")
# The four statuses of rule 7, and the marker the gateway's loader puts on a cycle it refused to read (``REFUSED_DATA_STATUS``): the sensors answer
# INVALID for it, so synthesis stands aside (row 0) and must still be able to record why.
DATA_STATUSES = ("FRESH", "DELAYED", "STALE", "MARKET_CLOSED", "INPUTS_REFUSED")

_MODIFIER_CAUTION_RE = re.compile(rf"{MODIFIER_CAUTION}:MCD3_[A-Z0-9_]+")


@dataclass(frozen=True)
class SynReading:
    """One trader type's reading of one cycle, ready to save when ``ok``."""

    profile: str
    reading: Mapping[str, Any]
    canonical_json: str  # the exact text to store; ``sha256`` is the hash of its UTF-8 bytes
    sha256: str
    problems: tuple[str, ...]  # why it must not be saved; empty = it may

    @property
    def ok(self) -> bool:
        return not self.problems


# --------------------------------------------------------------------------- build


def build_reading(
    rules: Rules,
    profile: str,
    decision: Decision,
    *,
    cycle_slot: str,
    data_status: str,
    zones: Sequence[str] = (),
) -> dict[str, Any]:
    """The reading as a dict in canonical key order. Not checked: ``make_reading`` and ``reading_problems`` do that."""
    return {
        "schema_version": SCHEMA_VERSION,
        "mcd_id": SYN_ID,
        "profile": profile,
        "cycle_slot": cycle_slot,
        "rules_version": rules.version,
        "rules_sha256": rules.sha256,
        "rule_id": decision.rule_id,
        "branch_id": decision.branch_id,
        "status": decision.status,
        "status_reasons": list(decision.status_reasons),
        "data_status": data_status,
        "archetype": decision.archetype,
        "bias": decision.bias,
        "trend_relation": decision.trend_relation,
        "stand_aside": decision.stand_aside,
        "inputs": {sensor: dict(record) for sensor, record in decision.inputs.items()},
        "reasons": list(decision.reasons),
        "zones": list(zones),
        "summary_line": decision.summary,
    }


# --------------------------------------------------------------------------- canonical form


def _norm(value: Any) -> Any:
    if isinstance(value, Mapping):
        return {str(k): _norm(value[k]) for k in sorted(value, key=str)}
    if isinstance(value, (list, tuple)):
        return [_norm(v) for v in value]
    if isinstance(value, float) and (value != value or value in (float("inf"), float("-inf"))):
        raise ValueError("NaN and infinity cannot appear in a reading")  # the one place they are refused: every path goes through here
    return value


def canonical(reading: Mapping[str, Any]) -> dict[str, Any]:
    """Fixed key order; ``inputs`` sorted by sensor with a fixed order inside. Keys outside the schema are kept (after the known
    ones, sorted) so the schema check rejects them instead of the canonical form hiding them."""
    out: dict[str, Any] = {}
    for key in TOP_LEVEL_ORDER:
        if key not in reading:
            continue
        value = reading[key]
        if key == "inputs" and isinstance(value, Mapping):
            inputs: dict[str, Any] = {}
            for sensor in sorted(value, key=str):
                record = value[sensor]
                if isinstance(record, Mapping):
                    ordered = {k: _norm(record[k]) for k in INPUT_ORDER if k in record}
                    ordered.update({str(k): _norm(record[k]) for k in sorted(record, key=str) if k not in INPUT_ORDER})
                    inputs[str(sensor)] = ordered
                else:
                    inputs[str(sensor)] = _norm(record)
            out[key] = inputs
        else:
            out[key] = _norm(value)
    for key in sorted((k for k in reading if k not in TOP_LEVEL_ORDER), key=str):
        out[str(key)] = _norm(reading[key])
    return out


def canonical_json(reading: Mapping[str, Any]) -> str:
    """The byte-stable text form of a reading: compact, ASCII, fixed key order (R4)."""
    return json.dumps(canonical(reading), ensure_ascii=True, separators=(",", ":"))


def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


# --------------------------------------------------------------------------- guards


@lru_cache(maxsize=1)
def _validator() -> Any:
    from jsonschema import Draft202012Validator

    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    Draft202012Validator.check_schema(schema)
    return Draft202012Validator(schema)


def schema_errors(reading: Mapping[str, Any]) -> list[str]:
    """Every way ``reading`` breaks ``syn-output/1`` (empty list = valid), in a stable order."""
    instance = json.loads(json.dumps(canonical(reading)))
    found = sorted(_validator().iter_errors(instance), key=lambda e: (list(map(str, e.absolute_path)), e.message))
    return [f"{'/'.join(map(str, e.absolute_path)) or '<root>'}: {e.message}" for e in found]


def reason_problems(canon: Mapping[str, Any]) -> list[str]:
    status, reasons = canon.get("status"), canon.get("status_reasons")
    if not isinstance(reasons, list):
        return ["REASONS: status_reasons is not a list"]
    statuses: list[str] = []
    problems: list[str] = []
    for code in reasons:
        if isinstance(code, str) and rc.is_known(code):
            statuses.append(rc.status_for(code))
        elif isinstance(code, str) and _MODIFIER_CAUTION_RE.fullmatch(code):
            statuses.append(rc.CAUTIONARY)
        else:
            problems.append(f"REASONS: {code!r} is not a reason code of standard Appendix D or {MODIFIER_CAUTION}:<state of MCD3>")
    if problems:
        return problems
    if status == rc.VALID and reasons:
        problems.append("REASONS: a VALID reading has reasons")
    elif status == rc.CAUTIONARY and (not reasons or any(s != rc.CAUTIONARY for s in statuses)):
        problems.append("REASONS: a CAUTIONARY reading needs CAUTIONARY reason codes only")
    elif status in (rc.INVALID, rc.STALE) and status not in statuses:
        problems.append(f"REASONS: a {status} reading needs at least one {status} reason code")
    return problems


def identity_problems(canon: Mapping[str, Any], rules: Rules) -> list[str]:
    problems: list[str] = []
    if canon.get("rules_version") != rules.version:
        problems.append(f"IDENTITY: rules_version is {canon.get('rules_version')!r}, the rules are {rules.version!r}")
    if canon.get("rules_sha256") != rules.sha256:
        problems.append("IDENTITY: rules_sha256 is not the checksum of the rules the reading names")
    profile, rule_id, branch_id = canon.get("profile"), canon.get("rule_id"), canon.get("branch_id")
    if rule_id == NO_MATCH_ID:
        return problems
    row = next((r for r in rules.rules if r.id == rule_id), None)
    if row is None:
        problems.append(f"IDENTITY: rule {rule_id!r} is not in the rules")
    else:
        if profile not in row.profiles:
            problems.append(f"IDENTITY: rule {rule_id} does not apply to {profile}")
        if branch_id not in {b.id for b in row.branches}:
            problems.append(f"IDENTITY: {branch_id!r} is not a branch of rule {rule_id}")
    return problems


def wording_problems(canon: Mapping[str, Any]) -> list[str]:
    """The sensors' own wording backstop, run over the texts of a reading, plus the banned words in its ids."""
    texts = {"summary_line": canon.get("summary_line"), "details": {"reasons": canon.get("reasons")}}
    problems = guards.wording_problems(texts)
    for key in ("rule_id", "branch_id"):
        value = canon.get(key)
        if isinstance(value, str):
            problems += [f"WORDING: {key} contains the banned word {word}" for word in wording.banned_in_code(value)]
    return problems


def reading_problems(reading: Any, rules: Rules | None = None) -> list[str]:
    """Every way ``reading`` may not be saved. Empty list = it may. Never raises."""
    if not isinstance(reading, Mapping):
        return [f"SCHEMA: the reading is a {type(reading).__name__}, not a mapping"]
    try:
        canon = canonical(reading)
        errors = schema_errors(reading)
    except Exception as exc:  # noqa: BLE001 - NaN, a set, bytes: it cannot be saved either way
        return [f"SCHEMA: the reading cannot be serialised ({type(exc).__name__}: {exc})"]
    problems = [f"SCHEMA: {error}" for error in errors]
    problems += reason_problems(canon)
    if rules is not None:
        problems += identity_problems(canon, rules)
    problems += wording_problems(canon)
    return problems


def make_reading(
    rules: Rules,
    profile: str,
    decision: Decision,
    *,
    cycle_slot: str,
    data_status: str,
    zones: Sequence[str] = (),
) -> SynReading:
    """Build, write canonically, hash and check one reading."""
    reading = build_reading(rules, profile, decision, cycle_slot=cycle_slot, data_status=data_status, zones=zones)
    problems = reading_problems(reading, rules)
    if not is_slot(cycle_slot):
        problems.append(f"IDENTITY: {cycle_slot!r} is not an ISO 8601 UTC 5-minute slot")
    text = canonical_json(reading) if not any(p.startswith("SCHEMA: the reading cannot be serialised") for p in problems) else ""
    return SynReading(
        profile=profile,
        reading=reading,  # already in canonical key order: ``build_reading`` writes it that way and a test pins it
        canonical_json=text,
        sha256=sha256_text(text) if text else "",
        problems=tuple(problems),
    )


def synthesize_cycle(
    rules: Rules,
    readings: Mapping[str, Any],
    *,
    cycle_slot: str,
    data_status: str,
    zones: Mapping[str, Sequence[str]] | None = None,
) -> dict[str, SynReading]:
    """A Day Trader and a Scalper reading of one cycle (3.2 principle 2).

    ``readings`` maps an MCD id to its final envelope; the caller decides which sensors synthesis may see (the SYN flag, decision
    D10) by leaving the others out. ``zones`` maps a trader type to the zone ids of its reading (part 2).
    """
    return {
        profile: make_reading(
            rules,
            profile,
            decide(rules, profile, readings),
            cycle_slot=cycle_slot,
            data_status=data_status,
            zones=(zones or {}).get(profile, ()),
        )
        for profile in PROFILES
    }
