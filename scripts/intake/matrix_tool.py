#!/usr/bin/env python3
"""Review tables and approval for the dispatch matrix (build step 6, part 4).

The dispatch matrix (`config/intake/dispatch-matrix.v1.json`, contract `dispatch-matrix/1`,
version `routing-v1`) says, per intent, which sensors a question needs in FULL
(M* = ALWAYS + EXTRA) and which knowledge it looks in (architecture 4.5, ADR-036, plan decisions
D2 and D10). Davin approves its cells. This tool makes that reading possible and records it. It
follows the pattern of `scripts/intake/glossary_tool.py` and `scripts/engine4/worked_examples.py`.

WHAT IT WRITES, under `config/intake/matrix-review/`:

  review.md      the matrix as tables, and every intent against the 16 golden cycles for each
                 trader type: the primary sensor, the warnings, M* with the sensors that come
                 from EXTRA marked, and the Explain row by the owner of the term. Written by
                 `record`; compared by `check`.
  approval.json  the sign-off. `record` writes it PENDING and NEVER writes APPROVED: a person
                 edits `status`, `approved_by` and `approved_on`. It holds the SHA-256 of the
                 content as it was reviewed (the matrix, every cell, the Explain table), so any
                 later change to the matrix, the roster, the glossary's owners or a golden cycle
                 shows up as "changed after approval" and `record` puts it back to PENDING.

THE RULES ARE WRITTEN TWICE, ON PURPOSE. The router is TypeScript (`lib/intake/router.ts`). This
tool computes the same cells with its own, independent code, derived from the same spec: the
primary sensor from the registry rung (not from the roster's `primary_for`), the warnings, the
five selectors. `__tests__/lib/intake/matrix-parity.test.ts` runs both over every cell and
requires them to agree, so a change to either that the other does not follow fails a test, and a
change to a cell makes the approval stale.

NO GENERATED FILE LISTS A STATUS (the lesson of glossary_tool.py): `review.md` holds content only,
so signing `approval.json` makes nothing stale and the gate opens the moment it is signed.

USAGE (from the repository root):
    python scripts/intake/matrix_tool.py list
    python scripts/intake/matrix_tool.py check [--require-approved]
    python scripts/intake/matrix_tool.py record

`check` writes nothing. It exits 1 when the matrix breaks a rule, `review.md` differs from a fresh
run, or the approval is stale; with `--require-approved` also while it is PENDING (the release
gate: routing-v1 does not ship unapproved). `--root DIR` points every command at another tree with
the same layout (the tests do). Standard library only.

Exit codes: 0 fine, 1 a difference, a stale approval or (with the gate) PENDING, 2 a file is unusable.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path
from typing import Any, Mapping, Sequence

REPO = Path(__file__).resolve().parents[2]

MATRIX_SCHEMA = "dispatch-matrix/1"
APPROVAL_SCHEMA = "matrix-approval/1"
PENDING = "PENDING"
APPROVED = "APPROVED"
AREA = "matrix"

# The ten intents, in the order of lib/intake/intents.ts: the eight of ADR-037 and the two instant labels.
INTENTS = (
    "DIRECTION",
    "ENTRY_TIMING",
    "EXIT_TARGETS",
    "RISK_SIZING",
    "EXPLAIN",
    "NEWS",
    "REPORT_2",
    "OUT_OF_SCOPE",
    "INSTANT_M5_INSPECT",
    "INSTANT_M15_INSPECT",
)
NO_READINGS = ("REPORT_2", "OUT_OF_SCOPE")
INSTANT_TIMEFRAME = {"INSTANT_M5_INSPECT": "M5", "INSTANT_M15_INSPECT": "M15"}
TRADERS = ("DAY_TRADER", "SCALPER")
SELECTORS = ("NONE", "ZONE_SOURCES", "TARGET_SIDE_LEVELS", "TERM_OWNERS", "TIMEFRAME_CHANNEL")
PLAYBOOKS = ("M_STAR", "NONE")
DOMAINS = ("D1", "D2", "D3", "D4", "D5")
PRIMARY_RUNG = "primary_structure"
NOTE_MAX = 240

MCD_ID = re.compile(r"^MCD([0-9]|1[0-5])$")
HEX64 = re.compile(r"^[0-9a-f]{64}$")
DATE = re.compile(r"^[0-9]{4}-[0-9]{2}-[0-9]{2}$")
VERSION_TS = re.compile(r"ROUTING_VERSION\s*=\s*'([^']+)'")

GOLDEN = Path("davintrade-stack-d-and-e") / "engine-1-5-new" / "mcd_worker" / "golden"


class ToolError(Exception):
    """A file or a request is not usable. `problems` lists every reason."""

    def __init__(self, problems: Sequence[str] | str) -> None:
        self.problems = [problems] if isinstance(problems, str) else list(problems)
        super().__init__("; ".join(self.problems))


# --------------------------------------------------------------------------- text and hashes


def lf(text: str) -> str:
    return text.replace("\r\n", "\n")


def read_text(path: Path) -> str:
    return lf(path.read_text(encoding="utf-8"))


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(lf(text).encode("utf-8"))  # LF on disk, whatever the platform


def dump_approval(data: Any) -> str:
    return json.dumps(data, indent=2, ensure_ascii=True, allow_nan=False) + "\n"


def content_sha256(content: Any) -> str:
    """The hash of what was reviewed: the content as sorted, compact, ASCII-only JSON."""
    text = json.dumps(content, sort_keys=True, separators=(",", ":"), ensure_ascii=True, allow_nan=True)
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def first_difference(stored: str, built: str) -> str:
    a, b = stored.split("\n"), built.split("\n")
    for index in range(max(len(a), len(b))):
        left = a[index] if index < len(a) else "<end of file>"
        right = b[index] if index < len(b) else "<end of file>"
        if left != right:
            return "line %d is %r, a fresh run has %r" % (index + 1, left[:100], right[:100])
    return "the files differ"


class Tree:
    """Where the files are. `root` is the repository, or a copy of the same layout."""

    def __init__(self, root: Path) -> None:
        self.root = root
        self.matrix = root / "config" / "intake" / "dispatch-matrix.v1.json"
        self.roster = root / "config" / "intake" / "sensor-roster.json"
        self.glossary = root / "config" / "intake" / "glossary.v1.json"
        self.version_ts = root / "lib" / "intake" / "version.ts"
        self.golden = root / GOLDEN
        self.review = root / "config" / "intake" / "matrix-review"


def load_json(path: Path) -> Any:
    if not path.is_file():
        raise ToolError("%s is missing" % path.as_posix())
    try:
        return json.loads(read_text(path))
    except json.JSONDecodeError as exc:
        raise ToolError("%s is not valid JSON (%s)" % (path.as_posix(), exc))


# --------------------------------------------------------------------------- the matrix


def routing_version(tree: Tree) -> str:
    if not tree.version_ts.is_file():
        raise ToolError("%s is missing" % tree.version_ts.as_posix())
    found = VERSION_TS.search(read_text(tree.version_ts))
    if found is None:
        raise ToolError("%s names no ROUTING_VERSION" % tree.version_ts.as_posix())
    return found.group(1)


def _is_text(value: Any) -> bool:
    return isinstance(value, str)


def matrix_problems(matrix: Any, version: str) -> list[str]:
    """Every rule the matrix must keep. The same rules as `parseMatrix` in lib/intake/matrix.ts."""
    problems: list[str] = []
    if not isinstance(matrix, dict):
        return ["the matrix is not an object"]
    for key in sorted(set(matrix) - {"schema", "version", "intents"}):
        problems.append("unknown key %r" % key)
    for key in sorted({"schema", "version", "intents"} - set(matrix)):
        problems.append("missing key %r" % key)
    if problems:
        return problems
    if matrix["schema"] != MATRIX_SCHEMA:
        problems.append("schema must be %r" % MATRIX_SCHEMA)
    if matrix["version"] != version:
        problems.append("version is %r; lib/intake/version.ts names %r" % (matrix["version"], version))
    rows = matrix["intents"]
    if not isinstance(rows, dict):
        return problems + ["intents is not an object"]
    for intent in sorted(set(rows) - set(INTENTS)):
        problems.append("intents.%s: not an intent" % intent)
    for intent in INTENTS:
        if intent not in rows:
            problems.append("intents.%s: missing" % intent)
            continue
        row = rows[intent]
        where = "intents.%s" % intent
        if not isinstance(row, dict):
            problems.append("%s: not an object" % where)
            continue
        keys = {"always", "extra", "domains", "playbooks", "note"}
        for key in sorted(set(row) - keys):
            problems.append("%s: unknown key %r" % (where, key))
        for key in sorted(keys - set(row)):
            problems.append("%s: missing key %r" % (where, key))
        if set(row) != keys:
            continue
        if not isinstance(row["always"], bool):
            problems.append("%s.always: must be true or false" % where)
        if row["extra"] not in SELECTORS:
            problems.append("%s.extra: %r is not a selector" % (where, row["extra"]))
        if row["playbooks"] not in PLAYBOOKS:
            problems.append("%s.playbooks: %r is not a scope" % (where, row["playbooks"]))
        if not (_is_text(row["note"]) and 1 <= len(row["note"]) <= NOTE_MAX):
            problems.append("%s.note: must be 1 to %d characters" % (where, NOTE_MAX))
        domains = row["domains"]
        if not isinstance(domains, list) or len(domains) > len(DOMAINS):
            problems.append("%s.domains: must be a list of at most %d" % (where, len(DOMAINS)))
        else:
            last = -1
            for domain in domains:
                if domain not in DOMAINS:
                    problems.append("%s.domains: %r is not a domain" % (where, domain))
                elif DOMAINS.index(domain) <= last:
                    problems.append("%s.domains: %s is repeated or out of order (D1 to D5)" % (where, domain))
                else:
                    last = DOMAINS.index(domain)
        gives = intent not in NO_READINGS
        if isinstance(row["always"], bool) and row["always"] != gives:
            problems.append("%s.always: must be %s" % (where, "true" if gives else "false"))
        if not gives and (row["extra"] != "NONE" or domains or row["playbooks"] != "NONE"):
            problems.append("%s: carries no readings, so it has no extra sensor and names no knowledge" % where)
    return problems


# --------------------------------------------------------------------------- the roster and the glossary


def load_roster(tree: Tree) -> dict[str, Any]:
    roster = load_json(tree.roster)
    if not isinstance(roster, dict) or not isinstance(roster.get("sensors"), list):
        raise ToolError("%s is not a roster" % tree.roster.as_posix())
    return roster


def board_sensors(roster: Mapping[str, Any]) -> list[dict[str, Any]]:
    return [s for s in roster["sensors"] if s.get("on_board")]


def primary_ids(roster: Mapping[str, Any], trader: str) -> list[str]:
    """The sensors on the board whose RUNG for the trader type is the primary one. Read from the rung, never from `primary_for`."""
    return [s["mcd_id"] for s in board_sensors(roster) if s.get("rung", {}).get(trader) == PRIMARY_RUNG]


def mcd_number(sensor_id: str) -> int:
    return int(sensor_id[3:])


def ordered(ids: Any) -> list[str]:
    return sorted({i for i in ids if MCD_ID.match(i)}, key=mcd_number)


def glossary_owners(tree: Tree) -> list[tuple[str, list[str]]]:
    glossary = load_json(tree.glossary)
    if not isinstance(glossary, dict) or not isinstance(glossary.get("terms"), list):
        raise ToolError("%s is not a glossary" % tree.glossary.as_posix())
    return [(term["id"], list(term["owners"])) for term in glossary["terms"]]


# --------------------------------------------------------------------------- the cycles


def load_cycles(tree: Tree) -> list[dict[str, Any]]:
    """The golden scenarios: what each sensor said and what each trader type's synthesis made of it."""
    if not tree.golden.is_dir():
        raise ToolError("%s is missing" % tree.golden.as_posix())
    cycles = []
    for folder in sorted(p for p in tree.golden.iterdir() if p.is_dir() and re.match(r"^\d\d-", p.name)):
        expected = load_json(folder / "expected.json")
        scenario = load_json(folder / "scenario.json")
        sensors: dict[str, dict[str, Any]] = {}
        for stored in expected["sensors"]:
            envelope = json.loads(stored["envelope_json"])
            sensors[stored["mcd_id"]] = {
                "status": envelope["status"],
                "bias": envelope["bias"],
                "levels": [level["price"] for level in envelope.get("levels", [])],
            }
        synthesis: dict[str, dict[str, Any]] = {}
        for reading in expected["synthesis"]["readings"]:
            body = json.loads(reading["reading_json"])
            zones = json.loads(reading["zones_json"])
            sources: set[str] = set()
            for zone in zones:
                sources.update(zone["source_sensors"])
            synthesis[reading["profile"]] = {
                "bias": body["bias"],
                "rule": body["rule_id"],
                "status": body["status"],
                "sources": ordered(sources),
                "entry": zones[0]["reference_price"] if zones else None,
                "reference": expected.get("reference_price"),
            }
        cycles.append(
            {
                "name": folder.name,
                "title": scenario["title"],
                "slot": expected["cycle_slot"],
                "sensors": sensors,
                "synthesis": synthesis,
            }
        )
    return cycles


# --------------------------------------------------------------------------- the router, again


def usable(status: str) -> bool:
    return status in ("VALID", "CAUTIONARY")


def warnings_of(cycle: Mapping[str, Any], live: Sequence[str], trader: str) -> list[dict[str, str]]:
    """A usable sensor that says STAND_ASIDE, or whose LONG or SHORT is the opposite of a LONG or SHORT synthesis (D2 b)."""
    syn_bias = cycle["synthesis"][trader]["bias"] if trader in cycle["synthesis"] else None
    found = []
    for sensor_id in live:
        facts = cycle["sensors"][sensor_id]
        if not usable(facts["status"]):
            continue
        if facts["bias"] == "STAND_ASIDE":
            found.append({"sensor": sensor_id, "kind": "STAND_ASIDE"})
        elif {facts["bias"], syn_bias} == {"LONG", "SHORT"}:
            found.append({"sensor": sensor_id, "kind": "OPPOSES_SYNTHESIS"})
    return found


def route(
    matrix: Mapping[str, Any],
    roster: Mapping[str, Any],
    owners: Mapping[str, Sequence[str]],
    cycle: Mapping[str, Any],
    trader: str,
    intent: str,
    terms: Sequence[str] = (),
    timeframes: Sequence[str] = (),
) -> dict[str, Any]:
    """M* = ALWAYS + EXTRA(intent), over a cycle whose live sensors are those it has a reading for."""
    row = matrix["intents"][intent]
    on_board = {s["mcd_id"]: s for s in board_sensors(roster)}
    live = ordered(cycle["sensors"])  # a sensor with a reading is live; the golden cycles have no other kind
    live = [i for i in live if i in on_board]
    syn = cycle["synthesis"].get(trader)

    primary = primary_ids(roster, trader)
    warnings = warnings_of(cycle, live, trader)
    always = ordered([i for i in primary if i in live] + [w["sensor"] for w in warnings]) if row["always"] else []

    frames = [INSTANT_TIMEFRAME[intent]] if intent in INSTANT_TIMEFRAME else sorted(set(timeframes))
    extra: list[str] = []
    if row["extra"] == "ZONE_SOURCES":
        extra = [i for i in (syn["sources"] if syn else []) if i in live]
    elif row["extra"] == "TARGET_SIDE_LEVELS":
        entry = None
        if syn is not None:
            entry = syn["entry"] if syn["entry"] is not None else syn["reference"]
        if syn is not None and syn["bias"] in ("LONG", "SHORT") and entry is not None:
            for sensor_id in live:
                facts = cycle["sensors"][sensor_id]
                if not usable(facts["status"]):
                    continue
                beyond = (lambda p: p > entry) if syn["bias"] == "LONG" else (lambda p: p < entry)
                if any(beyond(price) for price in facts["levels"]):
                    extra.append(sensor_id)
    elif row["extra"] == "TERM_OWNERS":
        for term in sorted(set(terms)):
            sensor_owners = [o for o in owners.get(term, ()) if o in on_board]
            if len(sensor_owners) == 1:
                extra.append(sensor_owners[0])
            else:
                for owner in sensor_owners:
                    own_frames = on_board[owner]["timeframes"]
                    if owner in primary or (len(own_frames) == 1 and own_frames[0] in frames):
                        extra.append(owner)
        extra = [i for i in extra if i in live]
    elif row["extra"] == "TIMEFRAME_CHANNEL":
        extra = [i for i in live if any(tf in frames for tf in on_board[i]["uses_channel"])]
    extra = ordered(extra)
    m_star = ordered(always + extra)
    return {
        "primary": primary,
        "warnings": warnings,
        "always": always,
        "extra": extra,
        "m_star": m_star,
        "domains": list(row["domains"]),
        "playbooks": m_star if row["playbooks"] == "M_STAR" else [],
    }


# --------------------------------------------------------------------------- what is reviewed


EXPLAIN_FRAMES: tuple[tuple[str, ...], ...] = ((), ("M5",), ("M15",), ("M5", "M15"))
EXPLAIN_BASE = "04-"  # the clean uptrend: all three sensors live and VALID, so only the rule decides


def compute(tree: Tree) -> dict[str, Any]:
    """Everything the approval covers: the matrix, every cell, and the Explain table."""
    matrix = load_json(tree.matrix)
    version = routing_version(tree)
    broken = matrix_problems(matrix, version)
    if broken:
        raise ToolError(broken)
    roster = load_roster(tree)
    pairs = glossary_owners(tree)
    owners = {term_id: term_owners for term_id, term_owners in pairs}
    cycles = load_cycles(tree)

    cells = []
    for cycle in cycles:
        for trader in TRADERS:
            entry = {"cycle": cycle["name"], "trader": trader, "intents": {}}
            for intent in INTENTS:
                entry["intents"][intent] = route(matrix, roster, owners, cycle, trader, intent)
            entry["live"] = ordered(cycle["sensors"])
            entry["warnings"] = warnings_of(cycle, ordered(cycle["sensors"]), trader)
            entry["primary"] = primary_ids(roster, trader)
            cells.append(entry)

    base = next((c for c in cycles if c["name"].startswith(EXPLAIN_BASE)), cycles[0])
    groups: dict[tuple[str, ...], list[str]] = {}
    for term_id, term_owners in pairs:
        groups.setdefault(tuple(term_owners), []).append(term_id)
    explain = []
    for pattern in sorted(groups):
        first = groups[pattern][0]
        row = {"owners": list(pattern), "terms": groups[pattern], "extra": {}}
        for trader in TRADERS:
            for frames in EXPLAIN_FRAMES:
                key = "%s|%s" % (trader, "+".join(frames) or "none")
                row["extra"][key] = route(matrix, roster, owners, base, trader, "EXPLAIN", [first], frames)["extra"]
        explain.append(row)

    return {
        "matrix": matrix,
        "roster": [
            {
                "mcd_id": s["mcd_id"],
                "name": s["name"],
                "timeframes": s["timeframes"],
                "uses_channel": s["uses_channel"],
                "rung": s["rung"],
            }
            for s in board_sensors(roster)
        ],
        "cycles": [{"name": c["name"], "title": c["title"], "slot": c["slot"]} for c in cycles],
        "cells": cells,
        "explain_base": base["name"],
        "explain": explain,
    }


# --------------------------------------------------------------------------- the review file


def cell(value: Any) -> str:
    return str(value).replace("|", "\\|").replace("\n", " ")


def table(header: Sequence[str], rows: Sequence[Sequence[Any]]) -> str:
    lines = ["| " + " | ".join(cell(h) for h in header) + " |", "| " + " | ".join("---" for _ in header) + " |"]
    lines += ["| " + " | ".join(cell(c) for c in row) + " |" for row in rows]
    return "\n".join(lines)


def ids(values: Sequence[str]) -> str:
    return " ".join(i[3:] for i in values) if values else "-"


def m_star_cell(result: Mapping[str, Any]) -> str:
    """`1 3 + 2`: the sensors of ALWAYS, then + the ones that come from EXTRA alone."""
    if not result["m_star"]:
        return "-"
    always = result["always"]
    only_extra = [i for i in result["extra"] if i not in always]
    text = ids(always) if always else "-"
    return text + (" + " + ids(only_extra) if only_extra else "")


def render_review(content: Mapping[str, Any]) -> str:
    matrix = content["matrix"]
    out: list[str] = []
    out.append("# Dispatch matrix %s: review tables\n" % matrix["version"])
    out.append(
        "Generated by `python scripts/intake/matrix_tool.py record`; do not edit. Read these tables, then sign "
        "`approval.json` (status, name, date). What you approve is the matrix file and every cell below: "
        "**which sensors a question gets in full, and which knowledge it looks in.**\n"
    )
    out.append("## How to read the cells\n")
    out.append(
        "- A sensor is written as its number: `1` is MCD1. **ALWAYS** is the trader type's primary sensor and every "
        "warning sensor (ADR-041); **EXTRA** is what the intent's row adds. A cell reads `ALWAYS + EXTRA-only`: "
        "`1 3 + 2` means MCD1 and MCD3 are always there and MCD2 comes from the intent's rule. `-` is none.\n"
        "- **Primary sensor**: the sensor whose registry rung is `primary_structure` for the trader type. "
        "**Warning**: a VALID or CAUTIONARY sensor that says STAND_ASIDE, or whose LONG or SHORT is the opposite "
        "of a LONG or SHORT synthesis (NEUTRAL is not a warning; a synthesis that stands aside has nothing to oppose).\n"
        "- A sensor is given in full only if it is live and has a reading for the cycle. In these 16 cycles every "
        "sensor that has a reading is live.\n"
    )
    out.append("## The matrix (the data file)\n")
    rows = []
    for intent in INTENTS:
        row = matrix["intents"][intent]
        rows.append(
            [
                intent,
                "yes" if row["always"] else "no",
                row["extra"],
                ", ".join(row["domains"]) or "-",
                "sensors of M*" if row["playbooks"] == "M_STAR" else "-",
                row["note"],
            ]
        )
    out.append(table(["Intent", "Always set", "Extra sensors", "Knowledge domains", "D2 playbooks", "Note"], rows))
    out.append("")
    out.append("## The sensors on the board\n")
    out.append(
        table(
            ["Sensor", "Name", "Timeframes", "Reads the channel of", "Rung, Day Trader", "Rung, Scalper"],
            [
                [s["mcd_id"], s["name"], ", ".join(s["timeframes"]), ", ".join(s["uses_channel"]), s["rung"].get("DAY_TRADER", "-"), s["rung"].get("SCALPER", "-")]
                for s in content["roster"]
            ],
        )
    )
    out.append("")
    out.append("## The 16 golden cycles\n")
    out.append(table(["#", "Cycle", "Slot"], [[c["name"][:2], c["title"], c["slot"]] for c in content["cycles"]]))
    out.append("")

    for trader in TRADERS:
        out.append("## %s\n" % trader.replace("_", " ").title())
        mine = [c for c in content["cells"] if c["trader"] == trader]
        out.append("### Primary sensor and warnings\n")
        out.append(
            table(
                ["#", "Primary", "Warnings (sensor: why)"],
                [
                    [
                        c["cycle"][:2],
                        ids(c["primary"]),
                        ", ".join("%s: %s" % (w["sensor"][3:], w["kind"]) for w in c["warnings"]) or "-",
                    ]
                    for c in mine
                ],
            )
        )
        out.append("")
        whole = [
            c["cycle"][:2]
            for c in mine
            if c["intents"]["DIRECTION"]["m_star"] and len(c["intents"]["DIRECTION"]["m_star"]) == len(c["live"])
        ]
        out.append(
            "For Direction, M* is **every live sensor** in cycle(s): %s. (There, each sensor is the primary sensor or a warning, so Direction "
            "gives the whole board in full. Look at these cycles first: it is where the warning rule is widest.)\n" % (", ".join(whole) if whole else "none")
        )
        out.append("### M* for every intent, in every golden cycle\n")
        columns = [i for i in INTENTS if i != "EXPLAIN"]
        out.append(
            table(
                ["#"] + [i.replace("INSTANT_", "INSTANT ").replace("_INSPECT", "") if i.startswith("INSTANT") else i for i in columns],
                [[c["cycle"][:2]] + [m_star_cell(c["intents"][i]) for i in columns] for c in mine],
            )
        )
        out.append("")
        out.append(
            "Explain is not in this table because it depends on the term in the question: see the Explain table below. "
            "With no term, Explain gives the always set.\n"
        )

    out.append("## Explain: the sensor that owns the term\n")
    out.append(
        "Shown on cycle `%s` (all three sensors live), by who owns the term in the glossary. `EXTRA` per trader type and per "
        "timeframe the question names. A term one sensor owns gives that sensor; a term several sensors own gives the primary "
        "sensor and the sensor of the timeframe named (one that reads that timeframe and no other); a term the synthesis or a "
        "knowledge domain owns gives no sensor.\n" % content["explain_base"]
    )
    header = ["Owners", "Terms"]
    for trader in TRADERS:
        for frames in EXPLAIN_FRAMES:
            header.append("%s, %s" % ("DT" if trader == "DAY_TRADER" else "SC", "+".join(frames) or "no timeframe"))
    out.append(
        table(
            header,
            [
                [", ".join(r["owners"]) or "-", ", ".join(r["terms"])]
                + [
                    ids(r["extra"]["%s|%s" % (trader, "+".join(frames) or "none")])
                    for trader in TRADERS
                    for frames in EXPLAIN_FRAMES
                ]
                for r in content["explain"]
            ],
        )
    )
    out.append("")
    out.append("## Readings of the rules to confirm\n")
    out.append(
        "These are the decisions D2 and D10 as the code reads them. Say if any is wrong.\n\n"
        "1. **Always** applies to every intent except Report 2 and Out of scope (they carry no readings at all). "
        "\"Board only\" for Risk means no *extra* sensor: the primary sensor and the warnings are still in full.\n"
        "2. **Entry timing** adds the sensors named as sources of the zones of the trader's reading. With no zones it adds none.\n"
        "3. **Exit and targets** adds a sensor if any of its levels is strictly beyond the entry on the target side. The "
        "entry is the first zone's reference price, or the close of the reading when there is no zone; the target side is "
        "above for a LONG and below for a SHORT; a synthesis with no direction adds none.\n"
        "4. **Explain** with several owners gives the primary sensor and the sensor that reads only the timeframe named. The "
        "sensor that reads both timeframes (MCD3) is never \"the sensor of the timeframe\".\n"
        "5. **The instant prompts** add the sensors that read the channel of the label's timeframe: M5 gives MCD2 and MCD3, "
        "M15 gives MCD1 and MCD3.\n"
        "6. **A primary sensor that is INVALID or STALE** is still given in full (its envelope says why it is unavailable). "
        "One with no reading at all (ABSENT) cannot be.\n"
        "7. **Knowledge** is the domains of the row; the domain-D2 playbooks are searched only for the sensors in M*.\n"
        "8. **Not here**: MCD0 is a gate, not a line on the board; its defects show as reasons on the channel sensors.\n"
    )
    return "\n".join(out)


# --------------------------------------------------------------------------- approval


def approval_keys() -> set[str]:
    return {"schema", "area", "status", "approved_by", "approved_on", "content_sha256", "note"}


def approval_problems(approval: Any, digest: str) -> list[str]:
    if not isinstance(approval, Mapping):
        return ["approval.json is not an object"]
    keys = approval_keys()
    problems = ["approval.json: unknown key %r" % key for key in sorted(set(approval) - keys)]
    problems += ["approval.json: missing key %r" % key for key in sorted(keys - set(approval))]
    if problems:
        return problems
    if approval["schema"] != APPROVAL_SCHEMA:
        problems.append("approval.json: schema must be %r" % APPROVAL_SCHEMA)
    if approval["area"] != AREA:
        problems.append("approval.json: area is %r, not %r" % (approval["area"], AREA))
    if not _is_text(approval["note"]):
        problems.append("approval.json: note must be a text")
    if approval["status"] not in (PENDING, APPROVED):
        return problems + ["approval.json: status must be %s or %s" % (PENDING, APPROVED)]
    if not (_is_text(approval["content_sha256"]) and HEX64.fullmatch(approval["content_sha256"])):
        problems.append("approval.json: content_sha256 is not a SHA-256")
    elif approval["content_sha256"] != digest:
        problems.append(
            "approval.json: content_sha256 is not the hash of the content"
            + (" (changed after approval)" if approval["status"] == APPROVED else "")
        )
    if approval["status"] == APPROVED:
        if not (_is_text(approval["approved_by"]) and approval["approved_by"].strip()):
            problems.append("approval.json: APPROVED needs approved_by")
        if not (_is_text(approval["approved_on"]) and DATE.fullmatch(approval["approved_on"])):
            problems.append("approval.json: APPROVED needs approved_on as YYYY-MM-DD")
    return problems


def new_approval(digest: str, old: Mapping[str, Any] | None) -> dict[str, Any]:
    """PENDING unless an approval is still true of exactly this content. Never APPROVED on its own."""
    fresh = {
        "schema": APPROVAL_SCHEMA,
        "area": AREA,
        "status": PENDING,
        "approved_by": None,
        "approved_on": None,
        "content_sha256": digest,
        "note": "",
    }
    if not isinstance(old, Mapping):
        return fresh
    if old.get("status") == APPROVED and not approval_problems(old, digest):
        return dict(old)
    if old.get("status") == APPROVED:
        fresh["note"] = (
            "Reset by record: the content changed after %s approved it on %s. It needs a new approval."
            % (old.get("approved_by"), old.get("approved_on"))
        )
    elif isinstance(old.get("note"), str):
        fresh["note"] = old["note"]
    return fresh


def read_approval(tree: Tree) -> Any:
    path = tree.review / "approval.json"
    if not path.is_file():
        return None
    try:
        return json.loads(read_text(path))
    except json.JSONDecodeError:
        return None


def status_of(approval: Any, digest: str) -> str:
    """APPROVED only for an approval that is whole and true of the content now."""
    if isinstance(approval, Mapping) and approval.get("status") == APPROVED and not approval_problems(approval, digest):
        return APPROVED
    return PENDING


# --------------------------------------------------------------------------- commands


def record(tree: Tree) -> list[str]:
    """Write review.md and a PENDING approval.json where the approval is not still true. Returns what was written."""
    content = compute(tree)
    digest = content_sha256(content)
    written = []
    for name, text in (
        ("review.md", render_review(content)),
        ("approval.json", dump_approval(new_approval(digest, read_approval(tree)))),
    ):
        path = tree.review / name
        if not path.is_file() or read_text(path) != text:
            write_text(path, text)
            written.append(name)
    return written


def check(tree: Tree) -> tuple[list[str], str]:
    """Check the rules and compare the stored files with a fresh run. Returns the problems and the status."""
    content = compute(tree)
    digest = content_sha256(content)
    problems: list[str] = []
    review_path = tree.review / "review.md"
    fresh = render_review(content)
    if not review_path.is_file():
        problems.append("review.md is missing (run record)")
    elif read_text(review_path) != fresh:
        problems.append("review.md differs from a fresh run: %s" % first_difference(read_text(review_path), fresh))
    path = tree.review / "approval.json"
    status = PENDING
    if not path.is_file():
        problems.append("approval.json is missing (run record)")
    else:
        try:
            approval = json.loads(read_text(path))
        except json.JSONDecodeError as exc:
            approval = None
            problems.append("approval.json is not valid JSON (%s)" % exc)
        if approval is not None:
            problems += approval_problems(approval, digest)
            status = status_of(approval, digest)
    return problems, status


def listing(tree: Tree) -> list[str]:
    content = compute(tree)
    digest = content_sha256(content)
    status = status_of(read_approval(tree), digest)
    cells = sum(len(INTENTS) for _ in content["cells"])
    return [
        "%s [%s]  %s, %d intents, %d cycles, %d cells" % (AREA, status, content["matrix"]["version"], len(INTENTS), len(content["cycles"]), cells)
    ]


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="matrix_tool.py", description=__doc__.split("\n\n")[0])
    parser.add_argument("--root", default=str(REPO), help="the tree to work on (default: the repository)")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("list", help="the matrix, its version and its approval status")
    check_parser = sub.add_parser("check", help="check the rules and compare the stored files with a fresh run; write nothing")
    check_parser.add_argument("--require-approved", action="store_true", help="also fail while the approval is PENDING (the release gate)")
    sub.add_parser("record", help="write review.md and a PENDING approval.json; never writes APPROVED")
    args = parser.parse_args(argv)
    tree = Tree(Path(args.root))
    try:
        if args.command == "list":
            for line in listing(tree):
                print(line)
            return 0
        if args.command == "record":
            written = record(tree)
            for name in written:
                print("wrote  %s" % name)
            print("%d file(s) written" % len(written) if written else "nothing to write: every file is already what a fresh run makes")
            return 0
        problems, status = check(tree)
    except ToolError as exc:
        for problem in exc.problems:
            print("ERROR  %s" % problem, file=sys.stderr)
        return 2
    if problems:
        print("DIFFERENT  %s  (%s)" % (AREA, status))
        for problem in problems:
            print("    %s" % problem)
    else:
        print("same  %s  (%s)" % (AREA, status))
    print("1 area, %d approved, %d pending approval, %d problem(s)" % (status == APPROVED, status != APPROVED, len(problems)))
    if problems:
        return 1
    if args.require_approved and status != APPROVED:
        print("the matrix is not approved yet (--require-approved)", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
