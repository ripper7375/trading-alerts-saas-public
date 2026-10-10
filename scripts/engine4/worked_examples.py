#!/usr/bin/env python3
"""Worked examples for Engine 4 (build step 5, part 8; architecture 7.7 and 7.10).

A worked example is one situation, worked out by the independent oracle, that Davin
reads and approves, example by example. Each lives in a folder of
`__tests__/lib/engine4/worked-examples/` with four files:

  scenario.json  the input (every figure is TEXT, never a JSON number). Written by hand.
  expected.json  what the oracle makes of it. Written by `record`; compared by `check`
                 and, figure by figure, by `__tests__/lib/engine4/worked-examples.test.ts`
                 against the TypeScript engine.
  review.md      the same as tables for a person to read before signing. Written by
                 `record`; compared by `check`.
  approval.json  the sign-off. `record` writes it PENDING and NEVER writes APPROVED:
                 Davin edits `status`, `approved_by` and `approved_on`. It holds the
                 SHA-256 of scenario.json and expected.json as he reviewed them, so any
                 later change to either shows up as "changed after approval" and
                 `record` puts the example back to PENDING.

WHY IT IS INDEPENDENT. Sizing, scenarios and underflow help come from
`scripts/engine4/oracle.py` (Python `decimal`, no shared code with `lib/engine4`). The
rest (the structural stop options, the room to the next level and the badge, the
half-risk pre-set, the Tier-1 blackout, the age of `symbol_specs`) is written here from
the architecture (6.4 to 6.9) in integer and `decimal` arithmetic, with no TypeScript
in sight. Where the architecture is silent, the reading is the one the part 2, 3 and 4
hand-offs recorded and Davin approved.

USAGE (from the repository root):
    python scripts/engine4/worked_examples.py list
    python scripts/engine4/worked_examples.py check [--require-approved] [--only ID ...]
    python scripts/engine4/worked_examples.py record [--only ID ...]

`check` exits 1 when anything differs or an approval is stale, and with
`--require-approved` also while any example is still PENDING (the release gate of 7.7).
`--root DIR` points either command at another copy of the folder (the tests do).
"""

from __future__ import annotations

import argparse
import calendar
import hashlib
import json
import re
import sys
from datetime import datetime, timezone
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path
from typing import Any, Mapping, Sequence

HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))

import oracle  # noqa: E402  (the independent sizing oracle, same folder)

REPO = HERE.parents[1]
ROOT = REPO / "__tests__" / "lib" / "engine4" / "worked-examples"
WORKER = REPO / "davintrade-stack-d-and-e" / "engine-1-5-new" / "mcd_worker"
GOLDEN_DIR = WORKER / "golden"
FIXTURES_DIR = WORKER / "fixtures"

SCENARIO_SCHEMA = "worked-example-scenario/1"
EXPECTED_SCHEMA = "worked-example-expected/1"
APPROVAL_SCHEMA = "worked-example-approval/1"
GENERATOR_SCHEMA = "worked-example-generator/1"
PENDING, APPROVED = "PENDING", "APPROVED"
KINDS = ("setup", "blackout", "specs")
ID_RE = re.compile(r"[0-9]{2}-[a-z0-9]+(?:-[a-z0-9]+)*")
DATE_RE = re.compile(r"[0-9]{4}-[0-9]{2}-[0-9]{2}")
DEC_RE = re.compile(r"-?[0-9]+(?:\.[0-9]+)?")
INT_RE = re.compile(r"-?[0-9]+")
TIME_RE = re.compile(r"([0-9]{4})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2}):([0-9]{2})Z")

CENT = Decimal("0.01")
SCENARIO_ORDER = ("CONSERVATIVE", "NORMAL", "AGGRESSIVE")
LEVEL_ORIGINS = ("MCD1", "MCD2", "MCD3", "sr_levels", "sr2_levels")
SR_NAMES = tuple("sr_%d" % n for n in range(1, 17))
TRADER_TYPES = ("SCALPER", "DAY_TRADER")
# 6.6: the holding window of each trader type (2 h Scalper, 12 h Day Trader), in seconds
HOLDING_SECONDS = {"SCALPER": 2 * 3600, "DAY_TRADER": 12 * 3600}
BLACKOUT_EXACT_SECONDS = 15 * 60  # 6.6: 15 minutes either side
BLACKOUT_APPROXIMATE_SECONDS = 60 * 60  # 6.6: 60 minutes when the time is approximate
CALENDAR_LATE_SECONDS = 45 * 60  # 6.6, 7.6: not exported for 45 minutes
SPECS_MAX_AGE_SECONDS = 7 * 86400  # 6.9, 7.6: older than 7 days is stale
SPECS_FUTURE_TOLERANCE_SECONDS = 5 * 60  # a row dated further ahead than this cannot be trusted
SPECS_OFFER_CODE = {
    "NO_SPECS": "SPECS_MISSING",
    "SPECS_STALE": "SPECS_STALE",
    "SPECS_FROM_THE_FUTURE": "SPECS_FROM_THE_FUTURE",
}
OFFER_ROW_BROKER_FIGURES = "10"  # 6.4 lists nine rows; the broker figures are the tenth (6.9, 7.6)


class ExampleError(Exception):
    """A scenario, an approval or a request is not usable. `problems` lists every reason."""

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
    path.write_bytes(lf(text).encode("utf-8"))  # LF on disk, whatever the platform


def dump(data: Any) -> str:
    return json.dumps(data, indent=2, ensure_ascii=True, allow_nan=False) + "\n"


def file_sha256(path: Path) -> str:
    return text_sha256(path.read_text(encoding="utf-8"))


def first_difference(stored: str, built: str) -> str:
    a, b = stored.split("\n"), built.split("\n")
    for index in range(max(len(a), len(b))):
        left = a[index] if index < len(a) else "<end of file>"
        right = b[index] if index < len(b) else "<end of file>"
        if left != right:
            return "line %d: stored %r but a fresh run gives %r" % (index + 1, left[:100], right[:100])
    return "no difference found"


# --------------------------------------------------------------------------- small exact helpers


def dec(text: str) -> Decimal:
    return oracle.dec(text)


def frac(text: str) -> tuple[Decimal, Decimal]:
    """'n/d' or a decimal as (numerator, denominator), exact."""
    if "/" in text:
        n, d = text.split("/", 1)
        return (dec(n), dec(d))
    return (dec(text), oracle.ONE)


def cents(x: Decimal) -> Decimal:
    return x.quantize(CENT, rounding=ROUND_HALF_UP)


def epoch(text: str) -> int:
    match = TIME_RE.fullmatch(text)
    if match is None:
        raise ExampleError("not a UTC time like 2026-09-17T12:30:00Z: %r" % (text,))
    year, month, day, hour, minute, second = (int(part) for part in match.groups())
    return calendar.timegm(datetime(year, month, day, hour, minute, second).timetuple())


def iso(seconds: int) -> str:
    return datetime.fromtimestamp(seconds, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def as_decimal(value: Any) -> Decimal:
    """A stored JSON float as the decimal its shortest text names (4367.2 is 4367.20)."""
    return Decimal(repr(value))


# --------------------------------------------------------------------------- scenario files


def is_text(value: Any) -> bool:
    return isinstance(value, str)


def figure_problems(value: Any, where: str) -> list[str]:
    """Every figure is text: a JSON number anywhere is refused."""
    if value is None or isinstance(value, (bool, str)):
        return []
    if isinstance(value, (int, float)):
        return ["%s: a JSON number (every figure is text)" % where]
    if isinstance(value, list):
        return [p for i, item in enumerate(value) for p in figure_problems(item, "%s[%d]" % (where, i))]
    if isinstance(value, Mapping):
        return [p for key, item in value.items() for p in figure_problems(item, "%s.%s" % (where, key))]
    return ["%s: unsupported value" % where]


def need(data: Any, keys: Sequence[str], where: str, allowed: Sequence[str] = ()) -> list[str]:
    if not isinstance(data, Mapping):
        return ["%s is not an object" % where]
    problems = ["%s: missing %r" % (where, key) for key in keys if key not in data]
    known = set(keys) | set(allowed)
    problems += ["%s: unknown key %r" % (where, key) for key in data if key not in known]
    return problems


def decimal_field(data: Mapping[str, Any], key: str, where: str, pattern: re.Pattern[str] = DEC_RE) -> list[str]:
    value = data.get(key)
    if not (isinstance(value, str) and pattern.fullmatch(value)):
        return ["%s.%s must be a decimal as text" % (where, key)]
    return []


def scenario_problems(sc: Any, folder_name: str) -> list[str]:
    problems = need(sc, ("schema", "id", "title", "why", "kind"), "scenario", ("setup", "levels", "trend", "cycle", "stored", "blackout", "specs"))
    if problems:
        return problems
    problems += figure_problems(sc, "scenario")
    if sc["schema"] != SCENARIO_SCHEMA:
        problems.append("scenario.schema must be %r" % SCENARIO_SCHEMA)
    if sc["id"] != folder_name or not ID_RE.fullmatch(str(sc["id"])):
        problems.append("scenario.id must equal the folder name and look like 02-some-words")
    if not (is_text(sc["title"]) and is_text(sc["why"])):
        problems.append("scenario.title and scenario.why must be text")
    if sc["kind"] not in KINDS:
        return problems + ["scenario.kind must be one of %s" % ", ".join(KINDS)]
    if sc["kind"] == "setup":
        problems += setup_problems(sc)
    elif sc["kind"] == "blackout":
        problems += blackout_problems(sc)
    else:
        problems += specs_problems(sc)
    return problems


def spec_problems(spec: Any, where: str) -> list[str]:
    keys = ("contract_size", "volume_min", "volume_step", "volume_max", "typical_spread", "point")
    problems = need(spec, keys, where)
    if problems:
        return problems
    return [p for key in keys for p in decimal_field(spec, key, where)]


def setup_problems(sc: Mapping[str, Any]) -> list[str]:
    s = sc.get("setup")
    keys = (
        "side", "entry", "stop_distance", "equity", "risk_pct", "max_leverage", "commission",
        "spec", "target_rrr", "max_risk_pct", "min_sld", "counter_trend",
    )
    problems = need(s, keys, "scenario.setup", ("structural_stops",))
    if problems:
        return problems
    if s["side"] not in ("BUY", "SELL"):
        problems.append("scenario.setup.side must be BUY or SELL")
    for key in keys[1:7] + keys[8:11]:
        problems += decimal_field(s, key, "scenario.setup")
    problems += spec_problems(s["spec"], "scenario.setup.spec")
    if not isinstance(s["counter_trend"], bool):
        problems.append("scenario.setup.counter_trend must be true or false")
    stops = s.get("structural_stops", [])
    if not (isinstance(stops, list) and all(isinstance(x, str) and DEC_RE.fullmatch(x) for x in stops)):
        problems.append("scenario.setup.structural_stops must be a list of decimals as text")
    for key in ("trend", "cycle", "stored", "levels"):
        if key in sc and sc[key] is None:
            problems.append("scenario.%s must be left out, not null" % key)
    if "levels" in sc:
        levels = sc["levels"]
        if not isinstance(levels, list) or not levels:
            problems.append("scenario.levels must be a non-empty list")
        else:
            for i, level in enumerate(levels):
                where = "scenario.levels[%d]" % i
                problems += need(level, ("name", "tf", "price", "origin"), where)
                if isinstance(level, Mapping) and not need(level, ("name", "tf", "price", "origin"), where):
                    problems += decimal_field(level, "price", where)
                    if level["tf"] not in ("M5", "M15"):
                        problems.append("%s.tf must be M5 or M15" % where)
                    if level["origin"] not in LEVEL_ORIGINS:
                        problems.append("%s.origin must be one of %s" % (where, ", ".join(LEVEL_ORIGINS)))
                    if isinstance(level.get("price"), str) and DEC_RE.fullmatch(level["price"]) and cents(dec(level["price"])) != dec(level["price"]):
                        problems.append("%s.price must have at most two decimals (levels are in cents)" % where)
    if "trend" in sc:
        problems += need(sc["trend"], ("relation", "conflict", "both_timeframes"), "scenario.trend")
        t = sc["trend"]
        if isinstance(t, Mapping) and not need(t, ("relation", "conflict", "both_timeframes"), "scenario.trend"):
            if t["relation"] not in ("WITH_TREND", "COUNTER_TREND"):
                problems.append("scenario.trend.relation must be WITH_TREND or COUNTER_TREND")
            if not (isinstance(t["conflict"], bool) and isinstance(t["both_timeframes"], bool)):
                problems.append("scenario.trend.conflict and both_timeframes must be true or false")
        if "levels" not in sc:
            problems.append("scenario.trend needs scenario.levels (the badge is decided against the next level)")
    if "cycle" in sc:
        problems += need(sc["cycle"], ("status", "status_reasons", "retuning"), "scenario.cycle")
        c = sc["cycle"]
        if isinstance(c, Mapping) and not need(c, ("status", "status_reasons", "retuning"), "scenario.cycle"):
            if c["status"] not in ("VALID", "CAUTIONARY"):
                problems.append("scenario.cycle.status must be VALID or CAUTIONARY")
            if not (isinstance(c["status_reasons"], list) and all(isinstance(x, str) for x in c["status_reasons"])):
                problems.append("scenario.cycle.status_reasons must be a list of text")
            if not isinstance(c["retuning"], bool):
                problems.append("scenario.cycle.retuning must be true or false")
    if "stored" in sc:
        problems += need(sc["stored"], ("golden", "reading", "zone", "facts"), "scenario.stored")
        st = sc["stored"]
        if isinstance(st, Mapping) and not need(st, ("golden", "reading", "zone", "facts"), "scenario.stored"):
            problems += need(
                st["facts"],
                ("reference_price", "invalidation_price", "stop_distance", "next_opposing_price", "bias", "status", "status_reasons", "trend_relation"),
                "scenario.stored.facts",
            )
    return problems


def blackout_problems(sc: Mapping[str, Any]) -> list[str]:
    b = sc.get("blackout")
    problems = need(b, ("tier1", "releases", "probes"), "scenario.blackout")
    if problems:
        return problems
    ids = set()
    for i, entry in enumerate(b["tier1"]):
        where = "scenario.blackout.tier1[%d]" % i
        problems += need(entry, ("event_id", "kind", "name"), where)
        if isinstance(entry, Mapping) and isinstance(entry.get("event_id"), str):
            ids.add(entry["event_id"])
    names = set()
    for i, rel in enumerate(b["releases"]):
        where = "scenario.blackout.releases[%d]" % i
        keys = ("value_id", "event_id", "name", "time_utc", "currency", "importance", "time_mode")
        problems += need(rel, keys, where)
        if isinstance(rel, Mapping) and not need(rel, keys, where):
            names.add(rel["value_id"])
            if not (isinstance(rel["time_utc"], str) and TIME_RE.fullmatch(rel["time_utc"])):
                problems.append("%s.time_utc must be like 2026-09-17T12:30:00Z" % where)
            if not (isinstance(rel["time_mode"], str) and INT_RE.fullmatch(rel["time_mode"])):
                problems.append("%s.time_mode must be a whole number as text" % where)
    for i, probe in enumerate(b["probes"]):
        where = "scenario.blackout.probes[%d]" % i
        keys = ("label", "anchor", "offset_s", "trader_type", "calendar_age_s")
        problems += need(probe, keys, where)
        if isinstance(probe, Mapping) and not need(probe, keys, where):
            if probe["anchor"] not in names:
                problems.append("%s.anchor is not a release value_id" % where)
            for key in ("offset_s", "calendar_age_s"):
                if not (isinstance(probe[key], str) and INT_RE.fullmatch(probe[key])):
                    problems.append("%s.%s must be a whole number of seconds as text" % (where, key))
            if probe["trader_type"] not in TRADER_TYPES:
                problems.append("%s.trader_type must be SCALPER or DAY_TRADER" % where)
    return problems


def specs_problems(sc: Mapping[str, Any]) -> list[str]:
    sp = sc.get("specs")
    problems = need(sp, ("now_utc", "probes"), "scenario.specs")
    if problems:
        return problems
    if not (isinstance(sp["now_utc"], str) and TIME_RE.fullmatch(sp["now_utc"])):
        problems.append("scenario.specs.now_utc must be like 2026-09-18T20:57:30Z")
    for i, probe in enumerate(sp["probes"]):
        where = "scenario.specs.probes[%d]" % i
        problems += need(probe, ("label",), where, ("captured_offset_s", "no_row"))
        if isinstance(probe, Mapping):
            has_offset, no_row = "captured_offset_s" in probe, probe.get("no_row") is True
            if has_offset == no_row:
                problems.append("%s needs exactly one of captured_offset_s and no_row=true" % where)
            if has_offset and not (isinstance(probe["captured_offset_s"], str) and INT_RE.fullmatch(probe["captured_offset_s"])):
                problems.append("%s.captured_offset_s must be a whole number of seconds as text" % where)
    return problems


def load_scenario(folder: Path) -> tuple[dict[str, Any], str]:
    path = folder / "scenario.json"
    if not path.is_file():
        raise ExampleError("%s: scenario.json is missing" % folder.name)
    text = read_text(path)
    try:
        sc = json.loads(text)
    except json.JSONDecodeError as exc:
        raise ExampleError("%s: scenario.json is not valid JSON (%s)" % (folder.name, exc))
    problems = scenario_problems(sc, folder.name)
    if problems:
        raise ExampleError(["%s: %s" % (folder.name, p) for p in problems])
    return sc, text


def example_folders(root: Path = ROOT) -> list[Path]:
    if not root.is_dir():
        raise ExampleError("no such folder: %s" % root)
    return sorted(p for p in root.iterdir() if p.is_dir() and ID_RE.fullmatch(p.name))


# --------------------------------------------------------------------------- the stored 18 Sep cycle (bindings)


def golden_reading(stored: Mapping[str, Any]) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any], dict[str, Any]]:
    folder = GOLDEN_DIR / stored["golden"]
    if not folder.is_dir():
        raise ExampleError("stored.golden %r is not a golden scenario folder" % stored["golden"])
    golden = json.loads(read_text(folder / "scenario.json"))
    expected = json.loads(read_text(folder / "expected.json"))
    readings = [r for r in expected["synthesis"]["readings"] if r["profile"] == stored["reading"]]
    if not readings:
        raise ExampleError("stored: no %s reading in %s" % (stored["reading"], stored["golden"]))
    reading = json.loads(readings[0]["reading_json"])
    zones = [z for z in json.loads(readings[0]["zones_json"]) if z["zone_id"] == stored["zone"]]
    if not zones:
        raise ExampleError("stored: no zone %s in the %s reading of %s" % (stored["zone"], stored["reading"], stored["golden"]))
    return golden, expected, reading, zones[0]


def stored_levels(golden: Mapping[str, Any], expected: Mapping[str, Any]) -> list[tuple[str, str, Decimal, str]]:
    """The levels the zone builder was handed for a stored real cycle: (tf, name, price in cents, origin)."""
    out: list[tuple[str, str, Decimal, str]] = []
    seen: set[tuple[str, str, Decimal]] = set()
    sensors = {s["mcd_id"]: s for s in expected["sensors"]}
    for mcd in ("MCD1", "MCD2", "MCD3"):
        envelope = json.loads(sensors[mcd]["envelope_json"])
        if envelope.get("status") not in ("VALID", "CAUTIONARY"):
            continue
        for level in envelope.get("levels", []):
            price = cents(as_decimal(level["price"]))
            key = (level["tf"], level["name"], price)
            if key not in seen:
                seen.add(key)
                out.append((level["tf"], level["name"], price, mcd))
    if golden.get("kind") != "cycle":
        raise ExampleError("stored.golden must be a real stored cycle (kind 'cycle')")
    bundle = json.loads(read_text(FIXTURES_DIR / ("%s.bundle.json" % golden["bundle"])))
    context = bundle.get("context_levels") or {}
    seen_sr: set[tuple[str, Decimal]] = set()
    for tf in ("M5", "M15"):
        row = context.get(tf) or {}
        for name in SR_NAMES:
            value = row.get(name)
            if value is None:
                continue
            price = as_decimal(value)
            if price <= 0 or (name, price) in seen_sr:
                continue
            seen_sr.add((name, price))
            out.append((tf, name, price, "sr_levels" if SR_NAMES.index(name) < 8 else "sr2_levels"))
    return out


def stored_problems(sc: Mapping[str, Any]) -> list[str]:
    """The figures an example copies from a stored cycle must still be the stored ones."""
    stored = sc.get("stored")
    if stored is None:
        return []
    golden, expected, reading, zone = golden_reading(stored)
    facts = stored["facts"]
    problems: list[str] = []

    def same(label: str, claimed: Any, found: Any, decimals: bool = False) -> None:
        if decimals and (claimed is None or found is None):
            ok = claimed is None and found is None
        elif decimals:
            ok = dec(claimed) == as_decimal(found)
        else:
            ok = claimed == found
        if not ok:
            problems.append("stored.facts.%s is %r but %s holds %r" % (label, claimed, stored["golden"], found))

    same("reference_price", facts["reference_price"], zone["reference_price"], True)
    same("invalidation_price", facts["invalidation_price"], zone["invalidation_price"], True)
    same("stop_distance", facts["stop_distance"], zone["stop_distance"], True)
    opposing = zone.get("next_opposing_level")
    same("next_opposing_price", facts["next_opposing_price"], None if opposing is None else opposing["price"], True)
    same("bias", facts["bias"], reading["bias"])
    same("status", facts["status"], reading["status"])
    same("status_reasons", facts["status_reasons"], reading["status_reasons"])
    same("trend_relation", facts["trend_relation"], reading["trend_relation"])
    setup = sc.get("setup")
    if setup is not None and dec(setup["entry"]) != as_decimal(zone["reference_price"]):
        problems.append("setup.entry %s is not the stored zone's reference price %s" % (setup["entry"], zone["reference_price"]))
    if "levels" in sc:
        claimed = sorted((l["tf"], l["name"], dec(l["price"]), l["origin"]) for l in sc["levels"])
        found = sorted(stored_levels(golden, expected))
        if claimed != found:
            problems.append(
                "levels differ from the stored cycle's: only in the example %s; only in the cycle %s"
                % (
                    [(a, b, str(c), d) for (a, b, c, d) in sorted(set(claimed) - set(found))],
                    [(a, b, str(c), d) for (a, b, c, d) in sorted(set(found) - set(claimed))],
                )
            )
    return problems


# --------------------------------------------------------------------------- the rest of the specification, in Decimal


def level_list(sc: Mapping[str, Any]) -> list[dict[str, Any]]:
    seen: set[tuple[str, str, Decimal]] = set()
    out: list[dict[str, Any]] = []
    for level in sc.get("levels", []):
        price = cents(dec(level["price"]))
        key = (level["tf"], level["name"], price)
        if key not in seen:
            seen.add(key)
            out.append({"name": level["name"], "tf": level["tf"], "origin": level["origin"], "price": price})
    return out


def pretty(x: Decimal) -> str:
    return oracle.plain(x)


def stop_options(levels: Sequence[Mapping[str, Any]], side: str, entry_text: str, min_sld_text: str) -> list[dict[str, Any]]:
    """6.5 and ADR-062: every level on the stop side, a $0.50 buffer beyond it, at least Min SLD from the entry. Nearest first."""
    entry, min_sld, buffer = dec(entry_text), dec(min_sld_text), Decimal("0.5")
    buy = side == "BUY"
    groups: dict[Decimal, list[Mapping[str, Any]]] = {}
    for level in levels:
        price = level["price"]
        if (buy and not price < entry) or (not buy and not price > entry):
            continue
        stop = oracle.sub(price, buffer) if buy else oracle.add(price, buffer)
        if stop <= 0:
            continue
        distance = oracle.sub(entry, stop) if buy else oracle.sub(stop, entry)
        if distance < min_sld:
            continue
        groups.setdefault(stop, []).append(level)
    options: list[dict[str, Any]] = []
    for stop, at in groups.items():
        ordered = sorted(at, key=lambda l: (l["tf"], l["name"], l["origin"]))
        first, rest = ordered[0], ordered[1:]
        distance = oracle.sub(entry, stop) if buy else oracle.sub(stop, entry)
        options.append(
            {
                "level": first["name"],
                "tf": first["tf"],
                "level_price": pretty(first["price"]),
                "stop_price": pretty(stop),
                "stop_distance": pretty(distance),
                "also_at": ["%s %s" % (l["tf"], l["name"]) for l in rest],
            }
        )
    options.sort(key=lambda o: Decimal(o["stop_distance"]))
    return options


def next_level(levels: Sequence[Mapping[str, Any]], side: str, entry_text: str) -> Mapping[str, Any] | None:
    """6.5: the nearest level STRICTLY beyond the entry on the profit side (above a BUY, below a SELL)."""
    entry, buy = dec(entry_text), side == "BUY"
    beyond = [l for l in levels if (l["price"] > entry if buy else l["price"] < entry)]
    if not beyond:
        return None
    return sorted(beyond, key=lambda l: (l["price"] if buy else -l["price"], l["tf"], l["name"], l["origin"]))[0]


def room_block(levels: Sequence[Mapping[str, Any]], side: str, entry_text: str) -> dict[str, Any]:
    level = next_level(levels, side, entry_text)
    if level is None:
        return {"next_level": None, "distance": None}
    entry = dec(entry_text)
    distance = abs(oracle.sub(level["price"], entry))
    return {"next_level": {"name": level["name"], "tf": level["tf"], "price": pretty(level["price"])}, "distance": pretty(distance)}


def fits_before(side: str, chart_level_text: str, level_price: Decimal) -> bool:
    """D8: strictly before the level. Compared by cross-multiplication so a quotient is never divided."""
    n, d = frac(chart_level_text)
    left, right = n, oracle.mul(level_price, d)
    return left < right if side == "BUY" else left > right


def badge_block(side: str, trend: Mapping[str, Any], scenarios: Sequence[Mapping[str, Any]], level: Mapping[str, Any] | None) -> dict[str, Any]:
    """The 6.5 table: no scenario fits -> none; counter-trend or conflict -> Conservative at most; with the trend -> Normal; on M5 and M15 -> Aggressive."""
    if trend["relation"] == "COUNTER_TREND":
        row, cap = "COUNTER_TREND", "CONSERVATIVE"
    elif trend["conflict"]:
        row, cap = "CONFLICT", "CONSERVATIVE"
    elif trend["both_timeframes"]:
        row, cap = "WITH_TREND_BOTH_TIMEFRAMES", "AGGRESSIVE"
    else:
        row, cap = "WITH_TREND", "NORMAL"
    by_name = {s["name"]: s for s in scenarios}
    fitting = [
        name
        for name in SCENARIO_ORDER
        if name in by_name and (level is None or fits_before(side, by_name[name]["target_chart_level"], level["price"]))
    ]
    allowed = SCENARIO_ORDER[: SCENARIO_ORDER.index(cap) + 1]
    badge = next((name for name in reversed(allowed) if name in fitting), None)
    reason = None
    if not fitting:
        reason = "NO_SCENARIO_FITS"
    elif badge is None:
        reason = "NO_SCENARIO_WITHIN_STYLE"
    return {"row": row, "cap": cap, "fitting": fitting, "badge": badge, "no_badge_reason": reason}


def risk_preset(max_risk_text: str, cycle: Mapping[str, Any]) -> dict[str, Any]:
    """6.4 row 3 and 6.6: half of Max RPT when the sensors are CAUTIONARY or the cycle is RETUNING; the trader may go up to Max RPT."""
    maximum = dec(max_risk_text)
    half = cycle["status"] == "CAUTIONARY" or cycle["retuning"]
    preset = oracle.div_exact(maximum, Decimal(2)) if half else maximum
    reasons = list(cycle["status_reasons"]) if cycle["status"] == "CAUTIONARY" else []
    if cycle["retuning"]:
        reasons.append("RETUNING")
    return {"max_pct": pretty(maximum), "preset_pct": pretty(preset), "half_risk": half, "reasons": reasons}


# --------------------------------------------------------------------------- compute: setup


def oracle_case(sc: Mapping[str, Any], stops: Sequence[str]) -> dict[str, Any]:
    s = sc["setup"]
    case = {key: s[key] for key in ("side", "entry", "stop_distance", "equity", "risk_pct", "max_leverage", "commission", "spec", "target_rrr", "max_risk_pct", "min_sld")}
    case.update({"id": sc["id"], "kind": "worked", "note": "", "structural_stops": list(stops)})
    return case


def compute_setup(sc: Mapping[str, Any]) -> dict[str, Any]:
    s = sc["setup"]
    levels = level_list(sc)
    options = stop_options(levels, s["side"], s["entry"], s["min_sld"]) if levels else None
    stops = [o["stop_distance"] for o in options] if options is not None else s.get("structural_stops", [])
    solved = oracle.solve(oracle_case(sc, stops))
    scenarios = solved["counter_trend" if s["counter_trend"] else "with_trend"]
    sizing = dict(solved["sizing"])
    if sizing["status"] != "OK":
        sizing.pop("limited_by", None)  # nothing was sized, so nothing limited it
    underflow = solved["underflow"]
    if underflow is not None:
        for fact in underflow["facts"]:
            fact["equity_at_least_2dp"] = format(oracle.q_ceil_to_hundredths(frac(fact["equity"])), "f")
    result: dict[str, Any] = {}
    if "cycle" in sc:
        result["risk_preset"] = risk_preset(s["max_risk_pct"], sc["cycle"])
    if options is not None:
        result["stop_options"] = options
    result["sizing"] = sizing
    result["scenarios"] = scenarios
    result["underflow"] = underflow
    if levels:
        result["room"] = room_block(levels, s["side"], s["entry"])
        if sizing["status"] == "OK" and "trend" in sc:
            result["badge"] = badge_block(s["side"], sc["trend"], scenarios["scenarios"], next_level(levels, s["side"], s["entry"]))
    return result


# --------------------------------------------------------------------------- compute: blackout


def compute_blackout(sc: Mapping[str, Any]) -> dict[str, Any]:
    b = sc["blackout"]
    tier1 = {entry["event_id"] for entry in b["tier1"]}
    releases = {rel["value_id"]: rel for rel in b["releases"]}
    probes: list[dict[str, Any]] = []
    for probe in b["probes"]:
        now = epoch(releases[probe["anchor"]]["time_utc"]) + int(probe["offset_s"])
        holding = HOLDING_SECONDS[probe["trader_type"]]
        blocks: list[tuple[int, int, int, str]] = []  # (release time, window start, window end, value id)
        warnings: list[tuple[int, dict[str, Any]]] = []
        for rel in b["releases"]:
            time = epoch(rel["time_utc"])
            margin = BLACKOUT_APPROXIMATE_SECONDS if int(rel["time_mode"]) != 0 else BLACKOUT_EXACT_SECONDS
            if rel["event_id"] in tier1 and time - margin <= now <= time + margin:
                blocks.append((time, time - margin, time + margin, rel["value_id"]))
            elif rel["importance"] == "HIGH" and rel["currency"] == "USD" and now <= time <= now + holding:
                warnings.append(
                    (time, {"value_id": rel["value_id"], "tier1": rel["event_id"] in tier1, "seconds_until": str(time - now)})
                )
        blocks.sort()
        warnings.sort(key=lambda item: item[0])
        age = int(probe["calendar_age_s"])
        out: dict[str, Any] = {
            "label": probe["label"],
            "trader_type": probe["trader_type"],
            "now_utc": iso(now),
            "status": "BLOCKED" if blocks else "CLEAR",
            "blocked_by": [value_id for (_t, _s, _e, value_id) in blocks],
        }
        if blocks:
            first = blocks[0]
            out["window_start_utc"] = iso(first[1])
            out["window_end_utc"] = iso(max(e for (_t, _s, e, _v) in blocks))
            out["margin_s"] = str(first[2] - first[0])
        out["warnings"] = [w for (_t, w) in warnings]
        out["calendar_age_s"] = str(age)
        out["calendar_late"] = age > CALENDAR_LATE_SECONDS
        probes.append(out)
    return {"probes": probes}


# --------------------------------------------------------------------------- compute: specs


def compute_specs(sc: Mapping[str, Any]) -> dict[str, Any]:
    sp = sc["specs"]
    now = epoch(sp["now_utc"])
    probes: list[dict[str, Any]] = []
    for probe in sp["probes"]:
        out: dict[str, Any] = {"label": probe["label"]}
        if probe.get("no_row") is True:
            verdict = "NO_SPECS"
            out["age_s"] = None
        else:
            captured = now + int(probe["captured_offset_s"])
            age = max(0, now - captured)
            out["age_s"] = str(age)
            if captured - now > SPECS_FUTURE_TOLERANCE_SECONDS:
                verdict = "SPECS_FROM_THE_FUTURE"
                out["age_s"] = None  # a row from the future has no age
            elif age > SPECS_MAX_AGE_SECONDS:
                verdict = "SPECS_STALE"
            else:
                verdict = "OK"
        out["figures"] = verdict
        if verdict == "OK":
            out["offer_verdict"] = "OFFERED"
            out["offer_reason"] = None
            out["offer_row"] = None
        else:
            out["offer_verdict"] = "NOT_OFFERED"
            out["offer_reason"] = SPECS_OFFER_CODE[verdict]
            out["offer_row"] = OFFER_ROW_BROKER_FIGURES
        probes.append(out)
    return {"now_utc": sp["now_utc"], "probes": probes}


# --------------------------------------------------------------------------- compute


def generator_info() -> dict[str, str]:
    return {
        "schema": GENERATOR_SCHEMA,
        "tool": "scripts/engine4/worked_examples.py",
        "tool_sha256": file_sha256(Path(__file__).resolve()),
        "oracle": "scripts/engine4/oracle.py",
        "oracle_sha256": file_sha256(HERE / "oracle.py"),
    }


def compute(sc: Mapping[str, Any]) -> dict[str, Any]:
    problems = stored_problems(sc)
    if problems:
        raise ExampleError(["%s: %s" % (sc["id"], p) for p in problems])
    try:
        if sc["kind"] == "setup":
            result = compute_setup(sc)
        elif sc["kind"] == "blackout":
            result = compute_blackout(sc)
        else:
            result = compute_specs(sc)
    except (ArithmeticError, KeyError, ValueError) as exc:
        raise ExampleError("%s: the oracle could not work this example out (%s: %s)" % (sc["id"], type(exc).__name__, exc))
    return {"schema": EXPECTED_SCHEMA, "example": sc["id"], "kind": sc["kind"], "result": result}


# --------------------------------------------------------------------------- review.md


def thousands(text: str) -> str:
    """4367.2 -> 4,367.2: groups the integer part for a person; a quotient 'n/d' is left alone."""
    if "/" in text:
        return text
    whole, dot, rest = text.partition(".")
    sign = "-" if whole.startswith("-") else ""
    digits = whole.lstrip("-")
    groups = []
    while len(digits) > 3:
        groups.insert(0, digits[-3:])
        digits = digits[:-3]
    groups.insert(0, digits)
    return sign + ",".join(groups) + dot + rest


def money(text: str | None) -> str:
    return "n/a" if text is None else "$" + thousands(text)


def q4(text: str) -> str:
    return oracle.q_display(frac(text), 4)


def table(header: Sequence[str], rows: Sequence[Sequence[str]]) -> str:
    lines = ["| " + " | ".join(header) + " |", "| " + " | ".join("---" for _ in header) + " |"]
    lines += ["| " + " | ".join(row) + " |" for row in rows]
    return "\n".join(lines)


def approval_footer(sc: Mapping[str, Any]) -> str:
    return (
        "## To approve\n\n"
        "Read the tables above against the architecture (6.4 to 6.9). If every figure is right, edit `approval.json` yourself: "
        "set `status` to `APPROVED`, `approved_by` to your name and `approved_on` to the date (YYYY-MM-DD). "
        "Leave the two hashes as they are: they pin the exact `scenario.json` and `expected.json` you read. "
        "`record` never writes APPROVED, and puts this example back to PENDING if either file changes.\n"
    )


def render_setup(sc: Mapping[str, Any], expected: Mapping[str, Any]) -> str:
    s, r = sc["setup"], expected["result"]
    sizing, sset = r["sizing"], r["scenarios"]
    out = ["# Worked example %s" % sc["id"], "", "**%s**" % sc["title"], "", sc["why"], ""]
    out += ["## 1. What goes in", ""]
    rows = [
        ["Side", s["side"]],
        ["Entry (chart / bid price)", s["entry"]],
        ["Stop distance (SLD)", "$" + s["stop_distance"]],
        ["Equity", money(s["equity"])],
        ["Risk chosen", s["risk_pct"] + "%"],
        ["Max leverage", "1:" + s["max_leverage"]],
        ["Commission, round trip per lot", money(s["commission"])],
        ["Contract size, lot min / step / max", "%s, %s / %s / %s" % (s["spec"]["contract_size"], s["spec"]["volume_min"], s["spec"]["volume_step"], s["spec"]["volume_max"])],
        ["Typical spread (points x point)", "%s x %s = %s" % (s["spec"]["typical_spread"], s["spec"]["point"], sizing["spread_price"])],
        ["Target RRR of the profile", s["target_rrr"] + "x"],
        ["Max RPT, Min SLD", "%s%%, $%s" % (s["max_risk_pct"], s["min_sld"])],
        ["The setup is", "counter-trend (cap 2.50x)" if s["counter_trend"] else "with the trend"],
    ]
    out += [table(["Input", "Value"], rows), ""]
    if "stored" in sc:
        st = sc["stored"]
        out += [
            "The entry, the levels and the readings come from the stored, signed-off cycle `%s` (%s reading, zone %s); `check` fails if any of them stops matching it." % (st["golden"], st["reading"], st["zone"]),
            "",
        ]
    step = 2
    if "risk_preset" in r:
        rp = r["risk_preset"]
        out += [
            "## %d. The risk the modal opens on (6.4 row 3, 6.6)" % step, "",
            table(
                ["Max RPT", "Pre-set", "Halved?", "Why"],
                [[rp["max_pct"] + "%", rp["preset_pct"] + "%", "yes" if rp["half_risk"] else "no", ", ".join(rp["reasons"]) or "-"]],
            ),
            "",
            "The trader may enter any value up to Max RPT; the override and the reason shown are kept in the consent record.",
            "",
        ]
        step += 1
    if "stop_options" in r:
        out += [
            "## %d. Structural stop options (6.5): each $0.50 beyond its level, at least Min SLD from the entry" % step, "",
            table(
                ["Behind", "Level", "Stop price", "Stop distance"],
                [["%s %s" % (o["tf"], o["level"]), o["level_price"], o["stop_price"], "$" + o["stop_distance"]] for o in r["stop_options"]],
            ),
            "",
        ]
        step += 1
    out += ["## %d. The ten steps (6.7), as the oracle worked them" % step, ""]
    step += 1
    sell = s["side"] == "SELL"
    ok = sizing["status"] == "OK"
    steps = [
        [
            "Derived: fill price, loss per ounce, loss per lot",
            "%s, %s, %s" % (sizing["fill_price"], sizing["loss_per_ounce"], sizing["loss_per_lot"]),
            "a BUY fills at entry + spread, a SELL at the entry; loss per lot = loss per ounce x contract + commission",
        ],
        ["1 Max lot from leverage", q4(sizing["max_lot_by_leverage"]), "max leverage x equity / (fill price x contract) = %s" % sizing["max_lot_by_leverage"]],
        ["2 Lot at the stop", q4(sizing["lot_at_stop"]), "risk as a share of equity x equity / (100 x loss per lot) = %s" % sizing["lot_at_stop"]],
        [
            "3 Effective lot",
            sizing["lot"] if ok else "none",
            ("the smallest of the two and the broker maximum (%s), rounded DOWN to the lot step" % sizing["limited_by"])
            if ok
            else "rounds down to less than the broker minimum: underflow (%s)" % " + ".join(sizing["causes"]),
        ],
        [
            "4 Leverage used",
            (sizing["leverage_used_3dp"] + "x") if ok else "none",
            ("lot x contract x fill price / equity = %s" % sizing["leverage_used"]) if ok else "no lot",
        ],
        ["5 Declared risk", money(sizing["declared_risk_2dp"]), "risk % x equity"],
        [
            "6 Actual risk",
            ("%s (%s%% of equity)" % (money(sizing["actual_risk_2dp"]), sizing["actual_risk_pct_2dp"])) if ok else "none",
            "lot x loss per lot",
        ],
        [
            "7 Stop price (trigger / chart level)",
            "%s / %s" % (thousands(sizing["stop_price_2dp"]), thousands(sizing["stop_chart_level_2dp"])),
            "SELL: entry + SLD; its stop triggers on the ask, so the chart level is lower by the spread" if sell else "BUY: entry - SLD",
        ],
    ]
    out += [table(["Step", "Value", "How"], steps), ""]
    out += ["## %d. The scenarios (6.7, plan D5): Normal %sx%s" % (step, sset["normal_rrr"], " (capped from the profile's %sx)" % s["target_rrr"] if sset["normal_capped"] else ""), ""]
    step += 1
    rows = [
        [t["name"], t["rrr"] + "x", t["target_distance_2dp"], t["target_price_2dp"], t["target_chart_level_2dp"], money(t["net_profit_2dp"])]
        for t in sset["scenarios"]
    ]
    out += [table(["Scenario", "RRR", "Target distance", "Target price", "Chart level", "Net profit"], rows), ""]
    if sset["omitted"]:
        out += ["Left out: " + "; ".join("%s %sx (%s)" % (o["name"], o["rrr"], o["reason"]) for o in sset["omitted"]) + ".", ""]
    if r.get("underflow") is not None:
        u = r["underflow"]
        out += [
            "## %d. A lot below the broker minimum (6.8)" % step, "",
            "Causes: **%s**. One minimum lot would lose %s at the stop, which is %s%% of equity." % (" + ".join(u["causes"]), money(u["min_lot_loss"]), oracle.q_display(frac(u["min_lot_risk_pct"]), 4)), "",
        ]
        step += 1
        rows = []
        for o in u["options"]:
            if o["kind"] == "RAISE_RISK":
                rows.append(["Raise the risk", "to %s%% (exactly %s%%): lot %s, actual risk %s" % (o["risk_pct"], oracle.q_display(frac(o["risk_pct_exact"]), 4), o["lot"], money(o["actual_risk"]))])
            elif o["kind"] == "NEARER_STRUCTURAL_STOP":
                rows.append(["A nearer structural stop", "$%s: lot %s, actual risk %s" % (o["stop_distance"], o["lot"], money(o["actual_risk"]))])
            else:
                rows.append(["Decline", "-"])
        out += [table(["Option", "What it gives"], rows), ""]
        for f in u["facts"]:
            what = "needs at least %s of equity at %s%% risk" % (money(f["equity_at_least_2dp"]), f["at_risk_pct"]) if f["kind"] == "EQUITY_NEEDED_FOR_RISK" else "needs at least %s of equity at 1:%s leverage" % (money(f["equity_at_least_2dp"]), f["at_max_leverage"])
            out.append("- Fact (never a button): this setup %s." % what)
        out.append("")
    if "room" in r:
        room = r["room"]
        out += ["## %d. Room to the next opposing level (6.5)" % step, ""]
        step += 1
        if room["next_level"] is None:
            out += ["Nothing lies beyond the entry on the profit side: unlimited room.", ""]
        else:
            nl = room["next_level"]
            out += ["Next level: **%s %s at %s**, %s from the entry. A target at or past it is never recommended (D8: strictly before)." % (nl["tf"], nl["name"], nl["price"], money(room["distance"])), ""]
    if "badge" in r:
        bd = r["badge"]
        out += [
            "## %d. The badge (6.5, ADR-063)" % step, "",
            table(["Table row", "Highest badge", "Targets strictly before the level", "Badge"], [[bd["row"], bd["cap"], ", ".join(bd["fitting"]) or "none", bd["badge"] or "**no badge** (%s)" % bd["no_badge_reason"]]]),
            "",
        ]
    out.append(approval_footer(sc))
    return "\n".join(out)


def render_blackout(sc: Mapping[str, Any], expected: Mapping[str, Any]) -> str:
    b = sc["blackout"]
    out = ["# Worked example %s" % sc["id"], "", "**%s**" % sc["title"], "", sc["why"], "", "## 1. What goes in", ""]
    out += [
        table(
            ["Release", "Event id", "Time (UTC)", "Time mode", "Impact", "Tier-1?"],
            [[r["name"], r["event_id"], r["time_utc"], "exact" if int(r["time_mode"]) == 0 else "approximate", r["currency"] + " " + r["importance"], "yes" if any(t["event_id"] == r["event_id"] for t in b["tier1"]) else "no"] for r in b["releases"]],
        ),
        "",
        "The event ids are TEST ids (900000001 to 900000004 and 900000099), not MT5 calendar ids: the real list is Davin's decision D13.",
        "",
        "## 2. Probes: is a Tier-1 release within the window? (6.6)",
        "",
        "Blocked from 15 minutes before to 15 minutes after an exact Tier-1 release (60 minutes when the time is approximate); both edges are inclusive. A calendar not exported for more than 45 minutes still blocks, and its age is shown.",
        "",
    ]
    rows = []
    for p, e in zip(b["probes"], expected["result"]["probes"]):
        rows.append(
            [
                p["label"], e["trader_type"], e["now_utc"], e["status"],
                ("%s to %s" % (e["window_start_utc"], e["window_end_utc"])) if e["status"] == "BLOCKED" else "-",
                ", ".join("%s in %ss%s" % (w["value_id"], w["seconds_until"], " (Tier-1)" if w["tier1"] else "") for w in e["warnings"]) or "-",
                "%ss%s" % (e["calendar_age_s"], " (late)" if e["calendar_late"] else ""),
            ]
        )
    out += [table(["Probe", "Trader", "Now (UTC)", "Result", "Window", "Warnings (holding window)", "Calendar age"], rows), ""]
    out.append(approval_footer(sc))
    return "\n".join(out)


def render_specs(sc: Mapping[str, Any], expected: Mapping[str, Any]) -> str:
    sp = sc["specs"]
    out = ["# Worked example %s" % sc["id"], "", "**%s**" % sc["title"], "", sc["why"], "", "## 1. What goes in", ""]
    out += [
        "Now is %s. Every other row of the offer check passes (the stored 18 Sep cycle: LONG, FRESH, no release in the window, price inside the zone), so only the broker figures decide." % sp["now_utc"],
        "",
        "## 2. Probes: how old may the `symbol_specs` row be? (6.9, 7.6)",
        "",
        "Older than 7 days is stale (the boundary second still counts as fresh). A row dated more than 5 minutes ahead of our clock is refused too, because its clock cannot be trusted and a far-future date would never go stale.",
        "",
    ]
    rows = []
    for e in expected["result"]["probes"]:
        rows.append([e["label"], "-" if e["age_s"] is None else e["age_s"] + " s", e["figures"], e["offer_verdict"], e["offer_reason"] or "-"])
    out += [table(["Probe", "Age", "Figures", "Report 2", "Reason shown"], rows), ""]
    out.append(approval_footer(sc))
    return "\n".join(out)


def render_review(sc: Mapping[str, Any], expected: Mapping[str, Any]) -> str:
    if sc["kind"] == "setup":
        return render_setup(sc, expected)
    if sc["kind"] == "blackout":
        return render_blackout(sc, expected)
    return render_specs(sc, expected)


def headline(sc: Mapping[str, Any], expected: Mapping[str, Any]) -> str:
    r = expected["result"]
    if sc["kind"] == "blackout":
        blocked = sum(1 for p in r["probes"] if p["status"] == "BLOCKED")
        return "%d probes: %d blocked, %d clear" % (len(r["probes"]), blocked, len(r["probes"]) - blocked)
    if sc["kind"] == "specs":
        fresh = sum(1 for p in r["probes"] if p["figures"] == "OK")
        return "%d probes: %d fresh, %d refused" % (len(r["probes"]), fresh, len(r["probes"]) - fresh)
    sizing = r["sizing"]
    if sizing["status"] == "OK":
        text = "lot %s, actual risk %s of %s declared (%s%%)" % (sizing["lot"], money(sizing["actual_risk_2dp"]), money(sizing["declared_risk_2dp"]), sizing["actual_risk_pct_2dp"])
    else:
        text = "underflow (%s)" % " + ".join(sizing["causes"])
    if "badge" in r:
        bd, nl = r["badge"], r["room"]["next_level"]
        if bd["badge"] is not None:
            text += "; %s badge" % bd["badge"].lower()
        elif nl is not None:
            text += "; no badge, names %s" % nl["price"]
        else:
            text += "; no badge"
    return text


def render_index(entries: Sequence[tuple[Mapping[str, Any], Mapping[str, Any]]]) -> str:
    """The list of examples. It holds NO approval status: a person's sign-off must never make a generated file stale."""
    lines = [
        "# Engine 4 worked examples",
        "",
        "Generated by `python scripts/engine4/worked_examples.py record`; compared by `check`. Each example is computed by the independent oracle",
        "(`scripts/engine4/oracle.py` and `scripts/engine4/worked_examples.py`) and compared figure by figure with `lib/engine4` by",
        "`__tests__/lib/engine4/worked-examples.test.ts`. An example counts only when Davin has approved it: see its `approval.json`,",
        "or run `python scripts/engine4/worked_examples.py list`.",
        "",
        table(
            ["Example", "Kind", "Headline"],
            [["`%s`" % sc["id"], sc["kind"], headline(sc, ex)] for sc, ex in entries],
        ),
        "",
    ]
    return "\n".join(lines)


# --------------------------------------------------------------------------- approval


def new_approval(example_id: str, scenario_text: str, expected_text: str, old: Mapping[str, Any] | None) -> dict[str, Any]:
    """The approval `record` writes: PENDING unless an approval is still true of exactly these two files. Never APPROVED on its own."""
    fresh = {
        "schema": APPROVAL_SCHEMA,
        "example": example_id,
        "status": PENDING,
        "approved_by": None,
        "approved_on": None,
        "scenario_sha256": text_sha256(scenario_text),
        "expected_sha256": text_sha256(expected_text),
        "note": "",
    }
    if not isinstance(old, Mapping):
        return fresh
    if old.get("status") == APPROVED and not approval_problems(old, example_id, scenario_text, expected_text):
        return dict(old)
    if old.get("status") == APPROVED:
        fresh["note"] = (
            "Reset by record: the scenario or its expected output changed after %s approved it on %s. It needs a new approval."
            % (old.get("approved_by"), old.get("approved_on"))
        )
    elif isinstance(old.get("note"), str):
        fresh["note"] = old["note"]
    return fresh


def approval_problems(approval: Any, example_id: str, scenario_text: str, expected_text: str) -> list[str]:
    keys = {"schema", "example", "status", "approved_by", "approved_on", "scenario_sha256", "expected_sha256", "note"}
    if not isinstance(approval, Mapping):
        return ["approval.json is not an object"]
    problems = ["approval.json: unknown key %r" % key for key in sorted(set(approval) - keys)]
    problems += ["approval.json: missing key %r" % key for key in sorted(keys - set(approval))]
    if problems:
        return problems
    if approval["schema"] != APPROVAL_SCHEMA:
        problems.append("approval.json: schema must be %r" % APPROVAL_SCHEMA)
    if approval["example"] != example_id:
        problems.append("approval.json: example is %r, not %r" % (approval["example"], example_id))
    if approval["status"] not in (PENDING, APPROVED):
        return problems + ["approval.json: status must be %s or %s" % (PENDING, APPROVED)]
    changed = " (changed after approval)" if approval["status"] == APPROVED else ""
    if approval["scenario_sha256"] != text_sha256(scenario_text):
        problems.append("approval.json: scenario_sha256 is not the hash of scenario.json" + changed)
    if approval["expected_sha256"] != text_sha256(expected_text):
        problems.append("approval.json: expected_sha256 is not the hash of expected.json" + changed)
    if approval["status"] == APPROVED:
        if not (isinstance(approval["approved_by"], str) and approval["approved_by"].strip()):
            problems.append("approval.json: APPROVED needs approved_by")
        if not (isinstance(approval["approved_on"], str) and DATE_RE.fullmatch(approval["approved_on"])):
            problems.append("approval.json: APPROVED needs approved_on as YYYY-MM-DD")
    return problems


# --------------------------------------------------------------------------- record and check


def _entries(root: Path, only: Sequence[str] = ()) -> list[tuple[dict[str, Any], str, dict[str, Any], Path]]:
    folders = example_folders(root)
    if only:
        unknown = sorted(set(only) - {f.name for f in folders})
        if unknown:
            raise ExampleError("no such example: %s" % ", ".join(unknown))
    out = []
    for folder in folders:
        if only and folder.name not in only:
            continue
        sc, text = load_scenario(folder)
        out.append((sc, text, compute(sc), folder))
    return out


def _status_of(folder: Path) -> str:
    path = folder / "approval.json"
    if not path.is_file():
        return PENDING
    try:
        status = json.loads(read_text(path)).get("status")
    except (json.JSONDecodeError, AttributeError):
        return PENDING
    return status if status in (PENDING, APPROVED) else PENDING


def generator_text(root: Path) -> str:
    info = generator_info()
    info["examples"] = [f.name for f in example_folders(root)]
    return dump(info)


def record(root: Path = ROOT, only: Sequence[str] = ()) -> list[str]:
    """Rewrite expected.json, review.md, INDEX.md, generator.json and a PENDING approval.json where the approval is not still true. Returns what was written."""
    written: list[str] = []
    for sc, scenario_text, expected, folder in _entries(root, only):
        expected_text = dump(expected)
        old = None
        if (folder / "approval.json").is_file():
            try:
                old = json.loads(read_text(folder / "approval.json"))
            except json.JSONDecodeError:
                old = None
        approval_text = dump(new_approval(folder.name, scenario_text, expected_text, old))
        for name, text in (("expected.json", expected_text), ("review.md", render_review(sc, expected)), ("approval.json", approval_text)):
            path = folder / name
            if not path.is_file() or read_text(path) != text:
                write_text(path, text)
                written.append("%s/%s" % (folder.name, name))
    everything = _entries(root)
    index = render_index([(sc, ex) for (sc, _t, ex, _f) in everything])
    for name, text in (("INDEX.md", index), ("generator.json", generator_text(root))):
        if not (root / name).is_file() or read_text(root / name) != text:
            write_text(root / name, text)
            written.append(name)
    return written


class Report:
    def __init__(self, example: str) -> None:
        self.example = example
        self.problems: list[str] = []
        self.status: str | None = None


def check(root: Path = ROOT, only: Sequence[str] = ()) -> tuple[list[Report], list[str]]:
    """Rebuild every example and compare with the stored files. Returns one report each and the problems of the set."""
    reports: list[Report] = []
    entries = _entries(root, only)
    for sc, scenario_text, expected, folder in entries:
        report = Report(folder.name)
        expected_text = dump(expected)
        for name, text in (("expected.json", expected_text), ("review.md", render_review(sc, expected))):
            path = folder / name
            if not path.is_file():
                report.problems.append("%s is missing (run record)" % name)
            elif read_text(path) != text:
                report.problems.append("%s differs from a fresh run: %s" % (name, first_difference(read_text(path), text)))
        path = folder / "approval.json"
        if not path.is_file():
            report.problems.append("approval.json is missing (run record)")
        else:
            try:
                approval = json.loads(read_text(path))
            except json.JSONDecodeError as exc:
                approval = None
                report.problems.append("approval.json is not valid JSON (%s)" % exc)
            if approval is not None:
                report.problems += approval_problems(approval, folder.name, scenario_text, expected_text)
                report.status = approval.get("status") if isinstance(approval, Mapping) else None
        reports.append(report)
    set_problems: list[str] = []
    if not only:
        everything = [(sc, ex) for (sc, _t, ex, _f) in entries]
        for name, text in (
            ("INDEX.md", render_index(everything)),
            ("generator.json", generator_text(root)),
        ):
            path = root / name
            if not path.is_file():
                set_problems.append("%s is missing (run record)" % name)
            elif read_text(path) != text:
                set_problems.append("%s differs from a fresh run: %s" % (name, first_difference(read_text(path), text)))
    return reports, set_problems


# --------------------------------------------------------------------------- command line


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="worked_examples.py", description=__doc__.split("\n\n")[0])
    parser.add_argument("--root", default=str(ROOT), help="the examples folder (default: the repository's)")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("list", help="the examples, their headline results and their approval status")
    check_parser = sub.add_parser("check", help="rebuild every example and compare with the stored files; write nothing")
    check_parser.add_argument("--require-approved", action="store_true", help="also fail while any example is still PENDING (the release gate)")
    check_parser.add_argument("--only", nargs="+", default=[], metavar="ID")
    record_parser = sub.add_parser("record", help="write expected.json, review.md, INDEX.md, generator.json and (PENDING) approval.json; never writes APPROVED")
    record_parser.add_argument("--only", nargs="+", default=[], metavar="ID")
    args = parser.parse_args(argv)
    root = Path(args.root)
    try:
        if args.command == "list":
            for sc, _t, expected, folder in _entries(root):
                print("%s  [%s]  %s" % (folder.name, sc["kind"], _status_of(folder)))
                print("    %s" % headline(sc, expected))
            return 0
        if args.command == "record":
            written = record(root, args.only)
            for name in written:
                print("wrote  %s" % name)
            print("%d file(s) written" % len(written) if written else "nothing to write: every file is already what a fresh run makes")
            return 0
        reports, set_problems = check(root, args.only)
    except ExampleError as exc:
        for problem in exc.problems:
            print("ERROR  %s" % problem, file=sys.stderr)
        return 2
    failed = pending = 0
    for report in reports:
        status = report.status or "-"
        if report.problems:
            failed += 1
            print("DIFFERENT  %s  (%s)" % (report.example, status))
            for problem in report.problems:
                print("    %s" % problem)
        else:
            print("same  %s  (%s)" % (report.example, status))
        pending += report.status != APPROVED
    for problem in set_problems:
        failed += 1
        print("DIFFERENT  %s" % problem)
    print("%d example(s), %d approved, %d pending approval, %d problem(s)" % (len(reports), len(reports) - pending, pending, failed))
    if failed:
        return 1
    if args.require_approved and pending:
        print("%d example(s) are not approved yet (--require-approved)" % pending, file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
