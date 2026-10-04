"""The synthesis rules file: load it, check it, and pin it (ADR-026; architecture 3.3, 3.4).

A rules version is one YAML file, ``rules/<version>.yaml``: ordered rows, first match wins, and a version name that is part of
every reading made with it. The file is Davin's to edit (ADR-026), so this loader is strict in the way that protects an editor:

* every problem is reported, not only the first (``ConfigError.problems``);
* an unknown key, a duplicate key, a YAML boolean where a word was meant (``NO`` for a value) and a value that cannot occur
  (a state code that is not in the sensor's register, a fact the sensor does not have) are all refused, because the alternative
  is a row that quietly never matches;
* every text passes the kit's wording check (banned words, ``%``, advice words), and a summary stays within 80 characters;
* the file's **checksum** is taken over the parsed document, not over the bytes, so a different line ending, a comment or the
  spacing cannot change it, and any change of meaning does. A reading carries the checksum next to the version, and a test pins
  both, so a rules file cannot change without a new version name.

Nothing here reads the market. ``vocabulary`` is the only thing a caller supplies from outside: the state codes and regime words of
each sensor's register (``vocabulary_from_registry``).
"""

from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable, Mapping, Sequence

import yaml

from mcd_common import wording

from ..errors import ConfigError
from . import facts as fx

RULES_SCHEMA = "synthesis-rules/1"
RULES_DIR = Path(__file__).with_name("rules")
DEFAULT_RULES_VERSION = "draft-1"

NO_MATCH_ID = "NO_MATCH"
PRIMARY = "PRIMARY"  # in a condition: the trader type's primary sensor (only its status may be tested)
DAY_TRADER, SCALPER = "DAY_TRADER", "SCALPER"
PROFILES = (DAY_TRADER, SCALPER)
DIRECTIONAL = ("LONG", "SHORT")
ARCHETYPES = ("A", "B", "C", "D")
TREND_RELATIONS = ("WITH_TREND", "COUNTER_TREND")
STATUSES = ("draft", "approved")
EFFECTS = ("confirm", "note", "caution")

_VERSION_RE = re.compile(r"[a-z0-9][a-z0-9._-]*")
_RULE_ID_RE = re.compile(r"R[0-9]+S?_[A-Z0-9_]+")
_ID_RE = re.compile(r"[A-Z0-9_]+")


# --------------------------------------------------------------------------- the parsed form


@dataclass(frozen=True)
class Condition:
    """One test: ``sensor`` (an id, or ``PRIMARY``), a ``fact`` of it, and the ``values`` it may have."""

    sensor: str
    fact: str
    values: tuple[str, ...]


@dataclass(frozen=True)
class Result:
    bias: str
    archetype: str | None
    trend_relation: str | None
    reasons: tuple[str, ...]
    summary: str
    data_stand_aside: bool = False


@dataclass(frozen=True)
class Branch:
    id: str
    sensor: str | None  # the sensor this branch belongs to; ``primary_first`` orders branches by it
    when: tuple[Condition, ...]  # all must hold
    result: Result

    def sensors_read(self, primary: str) -> tuple[str, ...]:
        """The sensors the branch's conditions name (``PRIMARY`` resolved), in sensor order: what "the rule read" means (D3)."""
        named = {primary if c.sensor == PRIMARY else c.sensor for c in self.when}
        return tuple(s for s in fx.SENSORS if s in named)


@dataclass(frozen=True)
class Rule:
    id: str
    table_row: str  # the row of architecture 3.4 this one transcribes
    name: str
    profiles: tuple[str, ...]
    primary_first: bool  # try the branches of the trader type's primary sensor first
    branches: tuple[Branch, ...]


@dataclass(frozen=True)
class ModifierCondition:
    fact: str
    values: tuple[str, ...]


@dataclass(frozen=True)
class Modifier:
    id: str
    rules: tuple[str, ...] | None  # only under these rows; ``None`` = under every row
    sensor: str
    when: tuple[ModifierCondition, ...]
    bias: tuple[str, ...]  # applies only to a result with one of these biases
    effect: str  # confirm | note | caution
    text: str


@dataclass(frozen=True)
class NoMatch:
    bias: str
    reasons: tuple[str, ...]
    summary: str


@dataclass(frozen=True)
class Rules:
    version: str
    status: str
    approved: str
    sha256: str
    primary_sensor: Mapping[str, str]
    sensors: tuple[str, ...]
    no_match: NoMatch
    rules: tuple[Rule, ...]
    modifiers: tuple[Modifier, ...]

    def rules_for(self, profile: str) -> tuple[Rule, ...]:
        return tuple(r for r in self.rules if profile in r.profiles)

    @property
    def rule_ids(self) -> tuple[str, ...]:
        return tuple(r.id for r in self.rules)


@dataclass(frozen=True)
class SensorVocabulary:
    state_codes: frozenset[str]
    regime_words: frozenset[str]


def vocabulary_from_registry(registry: Mapping[str, Any]) -> dict[str, SensorVocabulary]:
    """The state codes and regime words of every synthesis sensor that the registry holds (``registry`` = ``mcd_worker.registry``)."""
    out: dict[str, SensorVocabulary] = {}
    for sensor_id in fx.SENSORS:
        if sensor_id in registry:
            states = registry[sensor_id].states
            out[sensor_id] = SensorVocabulary(
                state_codes=frozenset(states),
                regime_words=frozenset(s.regime_status for s in states.values() if s.regime_status),
            )
    return out


# --------------------------------------------------------------------------- reading the file


class StrictLoader(yaml.SafeLoader):
    """``safe_load`` that refuses a key written twice (PyYAML keeps the last one and says nothing)."""


def _construct_mapping(loader: StrictLoader, node: yaml.MappingNode, deep: bool = False) -> dict[Any, Any]:
    seen: set[Any] = set()
    for key_node, _ in node.value:
        key = loader.construct_object(key_node, deep=deep)
        try:
            if key in seen:
                raise yaml.constructor.ConstructorError(
                    None, None, f"duplicate key {key!r}", key_node.start_mark
                )
            seen.add(key)
        except TypeError:  # an unhashable key: the standard constructor reports it
            break
    return yaml.SafeLoader.construct_mapping(loader, node, deep=deep)


StrictLoader.add_constructor(yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG, _construct_mapping)


def document_sha256(document: Any) -> str:
    """The checksum of a parsed rules document: sorted keys, no spaces, ASCII. Independent of line endings and comments."""
    text = json.dumps(document, sort_keys=True, separators=(",", ":"), ensure_ascii=True, allow_nan=False)
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _is_text(value: Any) -> bool:
    return isinstance(value, str) and value.strip() != ""


class Checker:
    """Collects problems with the path of the thing being read."""

    def __init__(self) -> None:
        self.problems: list[str] = []

    def add(self, where: str, message: str) -> None:
        self.problems.append(f"{where}: {message}")

    def mapping(self, value: Any, where: str, required: Iterable[str], optional: Iterable[str] = ()) -> Mapping[str, Any] | None:
        if not isinstance(value, Mapping):
            self.add(where, f"must be a mapping, got {type(value).__name__}")
            return None
        known = set(required) | set(optional)
        for key in value:
            if key not in known:
                self.add(where, f"unknown key {key!r} (allowed: {', '.join(sorted(known))})")
        for key in required:
            if key not in value:
                self.add(where, f"missing key {key!r}")
        return value

    def text(self, value: Any, where: str) -> str | None:
        if not _is_text(value):
            self.add(where, f"must be a non-empty text, got {value!r}")
            return None
        return value

    def words(self, value: Any, where: str, allowed: Sequence[str] | frozenset[str], *, nonempty: bool = True) -> tuple[str, ...]:
        if not isinstance(value, list) or (nonempty and not value):
            self.add(where, f"must be a non-empty list, got {value!r}")
            return ()
        out: list[str] = []
        for item in value:
            if not isinstance(item, str):
                self.add(where, f"{item!r} is not a word (a YAML boolean or number? quote it)")
            elif item not in allowed:
                self.add(where, f"{item!r} is not allowed here (allowed: {', '.join(sorted(allowed))})")
            else:
                out.append(item)
        if len(set(value)) != len(value):
            self.add(where, "lists a value twice")
        return tuple(out)

    def wording(self, where: str, text: str, *, summary: bool = False) -> None:
        found = wording.check_summary_line(text) if summary else wording.check_text(where, text)
        for problem in found:
            self.add(where, problem)


def _values_for(fact: str, sensor: str, vocabulary: Mapping[str, SensorVocabulary]) -> frozenset[str]:
    if fact == "state_code":
        return vocabulary[sensor].state_codes if sensor in vocabulary else frozenset()
    if fact == "regime_status":
        return vocabulary[sensor].regime_words if sensor in vocabulary else frozenset()
    return frozenset(fx.FIXED_VALUES.get(fact, ()))


def _check_condition(chk: Checker, raw: Any, where: str, sensors: Sequence[str], vocabulary: Mapping[str, SensorVocabulary]) -> Condition | None:
    body = chk.mapping(raw, where, ("sensor", "fact", "in"))
    if body is None or not all(k in body for k in ("sensor", "fact", "in")):
        return None
    sensor, fact = body["sensor"], body["fact"]
    if sensor != PRIMARY and sensor not in sensors:
        chk.add(where, f"sensor {sensor!r} is not one of {', '.join(sensors)} or {PRIMARY}")
        return None
    if sensor == PRIMARY:
        if fact != "status":
            chk.add(where, f"{PRIMARY} may only be tested for its status, not {fact!r}")
            return None
        known_facts: Sequence[str] = fx.COMMON_FACTS
        allowed_values: frozenset[str] = frozenset(fx.STATUS_VALUES)
    else:
        known_facts = fx.facts_available_for(sensor)
        allowed_values = _values_for(fact, sensor, vocabulary)
    if fact not in known_facts:
        chk.add(where, f"{sensor} has no fact {fact!r} (it has: {', '.join(known_facts)})")
        return None
    values = chk.words(body["in"], f"{where}.in", allowed_values)
    return Condition(sensor=sensor, fact=fact, values=values) if values else None


def _check_result(chk: Checker, raw: Any, where: str) -> Result | None:
    body = chk.mapping(raw, where, ("bias", "archetype", "trend_relation", "reasons", "summary"), ("data_stand_aside",))
    if body is None:
        return None
    bias = body.get("bias")
    if bias not in fx.BIASES:
        chk.add(f"{where}.bias", f"must be one of {', '.join(fx.BIASES)}, got {bias!r}")
    archetype, trend = body.get("archetype"), body.get("trend_relation")
    if archetype is not None and archetype not in ARCHETYPES:
        chk.add(f"{where}.archetype", f"must be one of {', '.join(ARCHETYPES)} or null, got {archetype!r}")
    if trend is not None and trend not in TREND_RELATIONS:
        chk.add(f"{where}.trend_relation", f"must be one of {', '.join(TREND_RELATIONS)} or null, got {trend!r}")
    if bias in DIRECTIONAL:
        if archetype is None or trend is None:
            chk.add(where, f"a {bias} result needs an archetype and a trend_relation")
    elif trend is not None:
        chk.add(f"{where}.trend_relation", f"a {bias} result has no trend relation")
    flag = body.get("data_stand_aside", False)
    if not isinstance(flag, bool):
        chk.add(f"{where}.data_stand_aside", f"must be true or false, got {flag!r}")
        flag = False
    reasons_raw = body.get("reasons")
    reasons: list[str] = []
    if not isinstance(reasons_raw, list) or not reasons_raw:
        chk.add(f"{where}.reasons", "must be a non-empty list of texts")
    else:
        for index, text in enumerate(reasons_raw):
            label = f"{where}.reasons[{index}]"
            if chk.text(text, label) is not None:
                chk.wording(label, text)
                reasons.append(text)
    summary = chk.text(body.get("summary"), f"{where}.summary")
    if summary is not None:
        chk.wording(f"{where}.summary", summary, summary=True)
    if bias not in fx.BIASES or summary is None or not reasons:
        return None
    return Result(bias=bias, archetype=archetype, trend_relation=trend, reasons=tuple(reasons), summary=summary, data_stand_aside=flag)


def _check_branch(chk: Checker, raw: Any, where: str, sensors: Sequence[str], vocabulary: Mapping[str, SensorVocabulary], *, needs_sensor: bool) -> Branch | None:
    body = chk.mapping(raw, where, ("id", "when", "result"), ("sensor",))
    if body is None:
        return None
    branch_id = body.get("id")
    if not (isinstance(branch_id, str) and _ID_RE.fullmatch(branch_id)):
        chk.add(f"{where}.id", f"must be upper-case letters, digits and _, got {branch_id!r}")
    elif wording.banned_in_code(branch_id):
        chk.add(f"{where}.id", f"{branch_id!r} contains a banned word")
    sensor = body.get("sensor")
    if sensor is not None and sensor not in sensors:
        chk.add(f"{where}.sensor", f"{sensor!r} is not one of {', '.join(sensors)}")
    if needs_sensor and sensor is None:
        chk.add(where, "needs a `sensor` because its row is primary_first")
    conditions: list[Condition] = []
    raw_when = body.get("when")
    if not isinstance(raw_when, list) or not raw_when:
        chk.add(f"{where}.when", "must be a non-empty list of conditions")
    else:
        for index, item in enumerate(raw_when):
            condition = _check_condition(chk, item, f"{where}.when[{index}]", sensors, vocabulary)
            if condition is not None:
                conditions.append(condition)
    result = _check_result(chk, body.get("result"), f"{where}.result")
    if result is not None and result.data_stand_aside:
        if result.bias != "STAND_ASIDE":
            chk.add(f"{where}.result", "a data_stand_aside result must be STAND_ASIDE")
        if result.archetype is not None:
            chk.add(f"{where}.result", "a data_stand_aside result has no archetype")
        if raw_when and any(c.sensor != PRIMARY or c.fact != "status" for c in conditions):
            chk.add(f"{where}.when", f"a data_stand_aside branch may only test the status of {PRIMARY}")
    if (
        not isinstance(branch_id, str)
        or result is None
        or not isinstance(raw_when, list)
        or len(conditions) != len(raw_when)
        or sensor not in (None, *sensors)
    ):
        return None
    return Branch(id=branch_id, sensor=sensor, when=tuple(conditions), result=result)


def _check_rule(chk: Checker, raw: Any, where: str, sensors: Sequence[str], vocabulary: Mapping[str, SensorVocabulary]) -> Rule | None:
    body = chk.mapping(raw, where, ("id", "table_row", "name", "profiles", "branches"), ("primary_first",))
    if body is None:
        return None
    rule_id = body.get("id")
    if not (isinstance(rule_id, str) and _RULE_ID_RE.fullmatch(rule_id)):
        chk.add(f"{where}.id", f"must look like R1_NAME or R3S_NAME, got {rule_id!r}")
    elif wording.banned_in_code(rule_id):
        chk.add(f"{where}.id", f"{rule_id!r} contains a banned word")
    table_row = chk.text(body.get("table_row"), f"{where}.table_row")
    name = chk.text(body.get("name"), f"{where}.name")
    profiles = chk.words(body.get("profiles"), f"{where}.profiles", PROFILES)
    primary_first = body.get("primary_first", False)
    if not isinstance(primary_first, bool):
        chk.add(f"{where}.primary_first", f"must be true or false, got {primary_first!r}")
        primary_first = False
    branches: list[Branch] = []
    raw_branches = body.get("branches")
    if not isinstance(raw_branches, list) or not raw_branches:
        chk.add(f"{where}.branches", "must be a non-empty list")
    else:
        seen: set[str] = set()
        for index, item in enumerate(raw_branches):
            branch = _check_branch(chk, item, f"{where}.branches[{index}]", sensors, vocabulary, needs_sensor=primary_first)
            if branch is not None:
                if branch.id in seen:
                    chk.add(f"{where}.branches[{index}]", f"branch id {branch.id} is used twice in this row")
                seen.add(branch.id)
                branches.append(branch)
    if not (isinstance(rule_id, str) and table_row and name and profiles and isinstance(raw_branches, list) and len(branches) == len(raw_branches)):
        return None
    return Rule(id=rule_id, table_row=table_row, name=name, profiles=profiles, primary_first=primary_first, branches=tuple(branches))


def _check_modifier(chk: Checker, raw: Any, where: str, sensors: Sequence[str], vocabulary: Mapping[str, SensorVocabulary], rule_ids: set[str]) -> Modifier | None:
    body = chk.mapping(raw, where, ("id", "sensor", "when", "bias", "effect", "text"), ("rules",))
    if body is None:
        return None
    mod_id = body.get("id")
    if not (isinstance(mod_id, str) and _ID_RE.fullmatch(mod_id)):
        chk.add(f"{where}.id", f"must be upper-case letters, digits and _, got {mod_id!r}")
    sensor = body.get("sensor")
    if sensor not in sensors:
        chk.add(f"{where}.sensor", f"{sensor!r} is not one of {', '.join(sensors)}")
    effect = body.get("effect")
    if effect not in EFFECTS:
        chk.add(f"{where}.effect", f"must be one of {', '.join(EFFECTS)}, got {effect!r}")
    bias = chk.words(body.get("bias"), f"{where}.bias", DIRECTIONAL)
    rules_only: tuple[str, ...] | None = None
    if "rules" in body:
        rules_only = chk.words(body["rules"], f"{where}.rules", rule_ids)
    text = chk.text(body.get("text"), f"{where}.text")
    if text is not None:
        chk.wording(f"{where}.text", text)
    conditions: list[ModifierCondition] = []
    raw_when = body.get("when")
    if not isinstance(raw_when, list) or not raw_when:
        chk.add(f"{where}.when", "must be a non-empty list of conditions")
    elif sensor in sensors:
        for index, item in enumerate(raw_when):
            label = f"{where}.when[{index}]"
            leaf = chk.mapping(item, label, ("fact", "in"))
            if leaf is None or not all(k in leaf for k in ("fact", "in")):
                continue
            fact = leaf["fact"]
            known = fx.facts_available_for(sensor)
            if fact not in known:
                chk.add(label, f"{sensor} has no fact {fact!r} (it has: {', '.join(known)})")
                continue
            values = chk.words(leaf["in"], f"{label}.in", _values_for(fact, sensor, vocabulary))
            if values:
                conditions.append(ModifierCondition(fact=fact, values=values))
    if (
        not (isinstance(mod_id, str) and sensor in sensors and effect in EFFECTS and bias and text)
        or not isinstance(raw_when, list)
        or len(conditions) != len(raw_when)
    ):
        return None
    return Modifier(id=mod_id, rules=rules_only, sensor=sensor, when=tuple(conditions), bias=bias, effect=effect, text=text)


def parse_rules(text: str, *, vocabulary: Mapping[str, SensorVocabulary], expected_version: str | None = None) -> Rules:
    """Read and check a rules document. Raises ``ConfigError`` listing every problem; returns the ``Rules`` otherwise."""
    chk = Checker()
    try:
        document = yaml.load(text, Loader=StrictLoader)  # noqa: S506 - the strict loader is a SafeLoader
    except yaml.YAMLError as exc:
        raise ConfigError(f"the rules file is not valid YAML: {exc}") from exc
    top = chk.mapping(
        document, "rules file", ("schema", "rules_version", "status", "approved", "profiles", "sensors", "no_match", "rules", "modifiers")
    )
    if top is None:
        raise ConfigError(chk.problems)
    if top.get("schema") != RULES_SCHEMA:
        chk.add("schema", f"must be {RULES_SCHEMA!r}, got {top.get('schema')!r}")
    version = top.get("rules_version")
    if not (isinstance(version, str) and _VERSION_RE.fullmatch(version)):
        chk.add("rules_version", f"must be a lower-case name such as draft-1, got {version!r}")
    elif expected_version is not None and version != expected_version:
        chk.add("rules_version", f"is {version!r} but the file is {expected_version}.yaml: the version name and the file name must agree")
    status = top.get("status")
    if status not in STATUSES:
        chk.add("status", f"must be one of {', '.join(STATUSES)}, got {status!r}")
    approved = chk.text(top.get("approved"), "approved")

    sensors = chk.words(top.get("sensors"), "sensors", fx.SENSORS)
    for sensor in sensors:
        if sensor not in vocabulary:
            chk.add("sensors", f"{sensor} is not in the registry the rules were loaded against")
        else:
            for problem in fx.register_problems(sensor, vocabulary[sensor].state_codes):
                chk.add("registry", problem)

    primary: dict[str, str] = {}
    profiles = chk.mapping(top.get("profiles"), "profiles", PROFILES)
    if profiles is not None:
        for profile in PROFILES:
            entry = chk.mapping(profiles.get(profile), f"profiles.{profile}", ("primary_sensor",))
            if entry is not None:
                sensor = entry.get("primary_sensor")
                if sensor not in fx.CHANNEL_SENSORS or sensor not in sensors:
                    chk.add(f"profiles.{profile}.primary_sensor", f"must be a channel sensor in `sensors`, got {sensor!r}")
                else:
                    primary[profile] = sensor

    no_match: NoMatch | None = None
    body = chk.mapping(top.get("no_match"), "no_match", ("bias", "reasons", "summary"))
    if body is not None:
        if body.get("bias") != "NEUTRAL":
            chk.add("no_match.bias", f"a cycle with no matching rule is NEUTRAL (ADR-026), got {body.get('bias')!r}")
        reasons_raw = body.get("reasons")
        reasons: list[str] = []
        if not isinstance(reasons_raw, list) or not reasons_raw:
            chk.add("no_match.reasons", "must be a non-empty list of texts")
        else:
            for index, item in enumerate(reasons_raw):
                if chk.text(item, f"no_match.reasons[{index}]") is not None:
                    chk.wording(f"no_match.reasons[{index}]", item)
                    reasons.append(item)
        summary = chk.text(body.get("summary"), "no_match.summary")
        if summary is not None:
            chk.wording("no_match.summary", summary, summary=True)
        if body.get("bias") == "NEUTRAL" and reasons and summary is not None:
            no_match = NoMatch(bias="NEUTRAL", reasons=tuple(reasons), summary=summary)

    rows: list[Rule] = []
    raw_rows = top.get("rules")
    if not isinstance(raw_rows, list) or not raw_rows:
        chk.add("rules", "must be a non-empty list")
    else:
        seen_ids: set[str] = set()
        for index, item in enumerate(raw_rows):
            rule = _check_rule(chk, item, f"rules[{index}]", sensors, vocabulary)
            if rule is None:
                continue
            if rule.id in seen_ids:
                chk.add(f"rules[{index}]", f"rule id {rule.id} is used twice")
            seen_ids.add(rule.id)
            rows.append(rule)
        for profile in PROFILES:
            if raw_rows and not any(profile in r.profiles for r in rows):
                chk.add("rules", f"no row applies to {profile}")
            first = next((r for r in rows if profile in r.profiles), None)
            if first is not None and profile in primary and any(
                not (c.sensor == PRIMARY and c.fact == "status") for b in first.branches for c in b.when
            ):
                chk.add("rules", f"the first row for {profile} must be the data check (PRIMARY status), as architecture 3.3 mechanic 1 says; got {first.id}")

    mods: list[Modifier] = []
    raw_mods = top.get("modifiers")
    if not isinstance(raw_mods, list):
        chk.add("modifiers", "must be a list (it may be empty)")
    else:
        seen_mods: set[str] = set()
        for index, item in enumerate(raw_mods):
            modifier = _check_modifier(chk, item, f"modifiers[{index}]", sensors, vocabulary, {r.id for r in rows})
            if modifier is None:
                continue
            if modifier.id in seen_mods:
                chk.add(f"modifiers[{index}]", f"modifier id {modifier.id} is used twice")
            seen_mods.add(modifier.id)
            mods.append(modifier)

    try:
        sha = document_sha256(document)
    except (TypeError, ValueError) as exc:
        chk.add("rules file", f"holds something that is not plain data ({exc}); quote dates and numbers")
        sha = ""

    if chk.problems or no_match is None or approved is None or not isinstance(version, str) or not isinstance(status, str):
        raise ConfigError(chk.problems or "the rules file is incomplete")
    return Rules(
        version=version,
        status=status,
        approved=approved,
        sha256=sha,
        primary_sensor=dict(primary),
        sensors=tuple(sensors),
        no_match=no_match,
        rules=tuple(rows),
        modifiers=tuple(mods),
    )


def load_rules(
    version: str = DEFAULT_RULES_VERSION,
    *,
    vocabulary: Mapping[str, SensorVocabulary],
    directory: str | Path | None = None,
) -> Rules:
    """Load ``rules/<version>.yaml``. The file name is the version name, so a version cannot be loaded under another name."""
    if not (isinstance(version, str) and _VERSION_RE.fullmatch(version)):
        raise ConfigError(f"not a rules version name: {version!r}")
    path = Path(directory or RULES_DIR) / f"{version}.yaml"
    try:
        text = path.read_text(encoding="utf-8")
    except OSError as exc:
        raise ConfigError(f"cannot read the rules file {path}: {exc}") from exc
    return parse_rules(text, vocabulary=vocabulary, expected_version=version)
