"""MCD feature flags and the nine-item checklist behind them (architecture section 2.9, requirement R14).

A flag is ``off``, ``shadow`` or ``live``. Davin's decision Q7 (2026-10-03): **items 1 to 6 of the checklist
gate ``shadow``; all nine gate ``live``**, because items 7 to 9 (dispatch matrix, synthesis rows, statistics
measured) cannot exist before an MCD has run in shadow.

Synthesis (architecture chapter 3) has a flag of its own, ``SYN`` (build step 4, decision D10): ``off`` runs nothing, ``shadow`` makes the
Day Trader and Scalper readings and their zones from the sensors that are ``shadow`` or ``live`` (so the rules can be exercised before any MCD is
live), ``live`` reads the ``live`` sensors only. It has no checklist: it may not be higher than the sensors it requires, MCD1 and MCD2 (MCD3
only modifies, so it is not required), which keeps ``live`` out of reach until step 6.

The runtime flags live in ``worker_config.yaml`` beside this file; the evidence for each item lives in
``checklists/MCDn.yaml``. A flag higher than its checklist allows makes the worker refuse to start. A test
pins the four registries' ``flag`` lines to the same values, so a flag changed in one place only fails the
build.

Two more rules keep a flag from running ahead of what it reads (they are mine, not Davin's, and are listed
in the part 1 hand-off): a derived MCD may not be higher than any MCD it depends on, and a channel MCD may
not be higher than the gate (MCD0), whose defects it must inherit. Without them a ``live`` MCD3 could read a
``shadow`` MCD1, or a channel reading could go out with no quality gate behind it.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from types import MappingProxyType
from typing import TYPE_CHECKING, Any, Mapping

import yaml

from .errors import ConfigError

if TYPE_CHECKING:  # registry imports this module; the reverse is for annotations only
    from .registry import Registry

FLAG_OFF, FLAG_SHADOW, FLAG_LIVE = "off", "shadow", "live"
FLAG_VALUES = (FLAG_OFF, FLAG_SHADOW, FLAG_LIVE)
FLAG_RANK: Mapping[str, int] = MappingProxyType({FLAG_OFF: 0, FLAG_SHADOW: 1, FLAG_LIVE: 2})

PASSED, PENDING = "passed", "pending"

# Architecture section 2.9, in order. The names are pinned: a checklist that renames or reorders an item is refused.
CHECKLIST_ITEMS: tuple[tuple[int, str], ...] = (
    (1, "Spec approved by Davin"),
    (2, "Evaluator on the closed-bar view"),
    (3, "Tests (13-style suite, envelope and forming-bar case)"),
    (4, "State register entries (code, plain meaning, bias)"),
    (5, "Levels contributed (or none)"),
    (6, "depends_on"),
    (7, "Dispatch-matrix entry and playbook chunk"),
    (8, "Synthesis rows"),
    (9, "Statistics measured"),
)
SHADOW_ITEMS = (1, 2, 3, 4, 5, 6)
LIVE_ITEMS = tuple(item_id for item_id, _ in CHECKLIST_ITEMS)

SYN_ID = "SYN"  # the synthesis flag's key in ``worker_config.yaml``; it is not an MCD and has no registry or checklist
SYNTHESIS_REQUIRES = ("MCD1", "MCD2")  # the primary sensors of the two trader types (architecture 3.3)
DEFAULT_RULES_VERSION = "draft-1"  # the rules file used when the configuration names none (mcd_worker/synthesis/rules/<version>.yaml)

ENGINE_DIR = Path(__file__).resolve().parents[1]
WORKER_DIR = Path(__file__).resolve().parent
DEFAULT_CONFIG_PATH = WORKER_DIR / "worker_config.yaml"
DEFAULT_CHECKLIST_DIR = WORKER_DIR / "checklists"
CONFIG_SCHEMA = "mcd-worker-config/1"
CHECKLIST_SCHEMA = "mcd-checklist/1"


# --------------------------------------------------------------------------- the checklist


@dataclass(frozen=True)
class ChecklistItem:
    item_id: int
    name: str
    status: str
    evidence: str  # what shows it, in words (required when passed)
    files: tuple[str, ...]  # repository-relative paths the evidence points to (at least one when passed)
    waits_on: str  # what it waits for (required when pending)


@dataclass(frozen=True)
class Checklist:
    mcd_id: str
    items: tuple[ChecklistItem, ...]

    def passed(self) -> frozenset[int]:
        return frozenset(item.item_id for item in self.items if item.status == PASSED)

    def allowed_flag(self) -> str:
        """The highest flag the checklist allows: ``live`` at nine of nine, ``shadow`` at items 1 to 6, else ``off``."""
        passed = self.passed()
        if set(LIVE_ITEMS) <= passed:
            return FLAG_LIVE
        if set(SHADOW_ITEMS) <= passed:
            return FLAG_SHADOW
        return FLAG_OFF

    def pending_for(self, flag: str) -> tuple[int, ...]:
        """The items that still stop ``flag`` (empty when the checklist allows it)."""
        needed = {FLAG_SHADOW: SHADOW_ITEMS, FLAG_LIVE: LIVE_ITEMS}.get(flag, ())
        return tuple(i for i in needed if i not in self.passed())


def checklist_problems(data: Any) -> list[str]:
    """Every way ``data`` (one parsed ``checklists/MCDn.yaml``) breaks the checklist format. Empty list = fine."""
    if not isinstance(data, Mapping):
        return ["checklist: the file must hold a mapping"]
    problems: list[str] = []
    extra = sorted(set(data) - {"schema", "mcd_id", "items"})
    if extra:
        problems.append(f"checklist: unknown keys {extra}")
    if data.get("schema") != CHECKLIST_SCHEMA:
        problems.append(f"checklist: schema must be {CHECKLIST_SCHEMA!r}, got {data.get('schema')!r}")
    mcd_id = data.get("mcd_id")
    if not isinstance(mcd_id, str) or not mcd_id:
        problems.append(f"checklist: mcd_id must be a string, got {mcd_id!r}")
    items = data.get("items")
    if not isinstance(items, list) or len(items) != len(CHECKLIST_ITEMS):
        return problems + [f"checklist {mcd_id}: items must be a list of exactly {len(CHECKLIST_ITEMS)} entries"]
    for position, (item, (item_id, name)) in enumerate(zip(items, CHECKLIST_ITEMS), start=1):
        where = f"checklist {mcd_id} item {position}"
        if not isinstance(item, Mapping):
            problems.append(f"{where}: must be a mapping")
            continue
        extra = sorted(set(item) - {"id", "name", "status", "evidence", "files", "waits_on"})
        if extra:
            problems.append(f"{where}: unknown keys {extra}")
        if item.get("id") != item_id or item.get("name") != name:
            problems.append(f"{where}: must be item {item_id} {name!r}, got {item.get('id')!r} {item.get('name')!r}")
        status = item.get("status")
        if status not in (PASSED, PENDING):
            problems.append(f"{where}: status must be 'passed' or 'pending', got {status!r}")
        elif status == PASSED:
            if not (isinstance(item.get("evidence"), str) and item["evidence"].strip()):
                problems.append(f"{where}: a passed item needs evidence text")
            files = item.get("files")
            if not (isinstance(files, list) and files and all(isinstance(f, str) and f.strip() for f in files)):
                problems.append(f"{where}: a passed item needs at least one evidence file")
        else:
            if not (isinstance(item.get("waits_on"), str) and item["waits_on"].strip()):
                problems.append(f"{where}: a pending item must say what it waits on")
    return problems


def checklist_from_dict(data: Any) -> Checklist:
    problems = checklist_problems(data)
    if problems:
        raise ConfigError(problems)
    items = tuple(
        ChecklistItem(
            item_id=item["id"],
            name=item["name"],
            status=item["status"],
            evidence=str(item.get("evidence") or ""),
            files=tuple(item.get("files") or ()),
            waits_on=str(item.get("waits_on") or ""),
        )
        for item in data["items"]
    )
    return Checklist(mcd_id=data["mcd_id"], items=items)


def load_checklists(directory: str | Path = DEFAULT_CHECKLIST_DIR) -> dict[str, Checklist]:
    """Every ``MCDn.yaml`` in ``directory``, by MCD id. A file whose ``mcd_id`` differs from its name is refused."""
    folder = Path(directory)
    found: dict[str, Checklist] = {}
    problems: list[str] = []
    for path in sorted(folder.glob("MCD*.yaml")):
        try:
            data = yaml.safe_load(path.read_text(encoding="utf-8"))
            checklist = checklist_from_dict(data)
        except (OSError, yaml.YAMLError) as exc:
            problems.append(f"{path.name}: cannot be read ({exc})")
            continue
        except ConfigError as exc:
            problems += [f"{path.name}: {p}" for p in exc.problems]
            continue
        if checklist.mcd_id != path.stem:
            problems.append(f"{path.name}: mcd_id is {checklist.mcd_id!r}, the file name says {path.stem!r}")
            continue
        found[checklist.mcd_id] = checklist
    if problems:
        raise ConfigError(problems)
    return found


# --------------------------------------------------------------------------- the runtime flags


@dataclass(frozen=True)
class WorkerConfig:
    """``worker_config.yaml``: the flag of every MCD, the synthesis flag and the rules version synthesis uses.

    A flag change is a commit, with its evidence in the checklist. ``flags`` holds the MCDs only; ``SYN`` is read out of the same mapping into
    ``synthesis_flag`` so that the MCD flag rules never see it.
    """

    flags: Mapping[str, str]
    source: str = ""
    synthesis_flag: str = FLAG_OFF
    rules_version: str = DEFAULT_RULES_VERSION


_RULES_VERSION_RE = re.compile(r"[a-z0-9][a-z0-9._-]*")


def worker_config_from_dict(data: Any, *, source: str = "") -> WorkerConfig:
    if not isinstance(data, Mapping):
        raise ConfigError(f"{source or 'worker config'}: the file must hold a mapping")
    problems: list[str] = []
    extra = sorted(set(data) - {"schema", "flags", "synthesis"})
    if extra:
        problems.append(f"worker config: unknown keys {extra}")
    if data.get("schema") != CONFIG_SCHEMA:
        problems.append(f"worker config: schema must be {CONFIG_SCHEMA!r}, got {data.get('schema')!r}")
    flags = data.get("flags")
    if not isinstance(flags, Mapping) or not flags:
        problems.append("worker config: flags must be a non-empty mapping of MCD id to flag")
    else:
        for mcd_id, value in flags.items():
            if not isinstance(mcd_id, str):
                problems.append(f"worker config: flag key {mcd_id!r} must be an MCD id string")
            if not isinstance(value, str) or value not in FLAG_VALUES:
                problems.append(
                    f"worker config: flag of {mcd_id} must be one of {FLAG_VALUES} as a string, got {value!r}"
                    + (" (quote it: YAML 1.1 reads an unquoted off as false)" if isinstance(value, bool) else "")
                )
    rules_version = DEFAULT_RULES_VERSION
    if "synthesis" in data:
        synthesis = data["synthesis"]
        if not isinstance(synthesis, Mapping):
            problems.append("worker config: synthesis must be a mapping")
        else:
            unknown = sorted(set(synthesis) - {"rules_version"})
            if unknown:
                problems.append(f"worker config: synthesis has unknown keys {unknown}")
            if "rules_version" in synthesis:
                value = synthesis["rules_version"]
                if isinstance(value, str) and _RULES_VERSION_RE.fullmatch(value):
                    rules_version = value
                else:
                    problems.append(f"worker config: synthesis.rules_version must be a lower-case name such as draft-1, got {value!r}")
    if problems:
        raise ConfigError(problems)
    mcd_flags = {k: v for k, v in flags.items() if k != SYN_ID}
    return WorkerConfig(
        flags=MappingProxyType(mcd_flags),
        source=source,
        synthesis_flag=flags.get(SYN_ID, FLAG_OFF),
        rules_version=rules_version,
    )


def load_worker_config(path: str | Path = DEFAULT_CONFIG_PATH) -> WorkerConfig:
    try:
        data = yaml.safe_load(Path(path).read_text(encoding="utf-8"))
    except (OSError, yaml.YAMLError) as exc:
        raise ConfigError(f"worker config {path}: cannot be read ({exc})") from exc
    return worker_config_from_dict(data, source=str(path))


# --------------------------------------------------------------------------- the rules a flag set must obey


def required_mcds(registry: "Registry", mcd_id: str) -> tuple[str, ...]:
    """The MCDs that must be at least as high as ``mcd_id``: its dependencies, and the gate for a channel MCD."""
    from .registry import GATE_ID  # local: registry imports this module

    sensor = registry[mcd_id]
    required = list(sensor.depends_on)
    if sensor.kind != "gate" and sensor.uses_channel and GATE_ID in registry and GATE_ID not in required:
        required.append(GATE_ID)
    return tuple(required)


def flag_problems(flags: Mapping[str, str], registry: "Registry", checklists: Mapping[str, Checklist]) -> list[str]:
    """Every reason this flag set may not run. Empty list = it may.

    * every MCD of the registry has a flag, and no flag names an unknown MCD;
    * every flag is ``off``, ``shadow`` or ``live`` (a string);
    * a flag above ``off`` needs its checklist: items 1 to 6 for ``shadow``, all nine for ``live`` (Q7);
    * no MCD is higher than an MCD it depends on, and no channel MCD is higher than the gate.
    """
    problems: list[str] = []
    for mcd_id in flags:
        if mcd_id not in registry:
            problems.append(f"flag for unknown MCD {mcd_id!r}")
    for mcd_id in registry:
        if mcd_id not in flags:
            problems.append(f"{mcd_id} has no flag (add it as 'off')")
    for mcd_id, flag in flags.items():
        if mcd_id not in registry:
            continue
        if not isinstance(flag, str) or flag not in FLAG_VALUES:
            problems.append(f"{mcd_id}: flag must be one of {FLAG_VALUES} as a string, got {flag!r}")
            continue
        if flag == FLAG_OFF:
            continue
        checklist = checklists.get(mcd_id)
        if checklist is None:
            problems.append(f"{mcd_id}: flag '{flag}' needs a checklist and there is none")
            continue
        missing = checklist.pending_for(flag)
        if missing:
            problems.append(
                f"{mcd_id}: flag '{flag}' needs checklist items {list(missing)} passed "
                f"(it allows '{checklist.allowed_flag()}')"
            )
    for mcd_id in registry:
        flag = flags.get(mcd_id)
        if flag not in FLAG_RANK or flag == FLAG_OFF:
            continue
        for required in required_mcds(registry, mcd_id):
            other = flags.get(required)
            if other in FLAG_RANK and FLAG_RANK[other] < FLAG_RANK[flag]:
                problems.append(f"{mcd_id}: flag '{flag}' is higher than '{other}' of {required}, which it reads")
    from .registry import GATE_ID  # local: registry imports this module

    for mcd_id in registry:
        sensor = registry[mcd_id]
        if sensor.kind != "gate" and sensor.uses_channel and GATE_ID not in registry:
            problems.append(f"{mcd_id}: a channel MCD needs the gate {GATE_ID} in the registry")
    return problems


def synthesis_flag_problems(synthesis_flag: Any, mcd_flags: Mapping[str, str]) -> list[str]:
    """Every reason the synthesis flag may not run beside these MCD flags (decision D10). Empty list = it may.

    ``off`` is always fine. Otherwise the flag must be ``shadow`` or ``live`` and no higher than the flag of MCD1 or MCD2, which every reading needs
    (the primary sensors, architecture 3.3 mechanic 1): a ``live`` synthesis over a ``shadow`` sensor could publish what the sensor does not yet
    publish. MCD3 only modifies a result, so it is not required.
    """
    if not isinstance(synthesis_flag, str) or synthesis_flag not in FLAG_VALUES:
        return [f"{SYN_ID}: flag must be one of {FLAG_VALUES} as a string, got {synthesis_flag!r}"]
    if synthesis_flag == FLAG_OFF:
        return []
    problems: list[str] = []
    for required in SYNTHESIS_REQUIRES:
        other = mcd_flags.get(required)
        if other not in FLAG_RANK:
            problems.append(f"{SYN_ID}: flag '{synthesis_flag}' needs {required}, which has no flag")
        elif FLAG_RANK[other] < FLAG_RANK[synthesis_flag]:
            problems.append(f"{SYN_ID}: flag '{synthesis_flag}' is higher than '{other}' of {required}, which it reads")
    return problems


def check_flags(flags: Mapping[str, str], registry: "Registry", checklists: Mapping[str, Checklist]) -> None:
    problems = flag_problems(flags, registry, checklists)
    if problems:
        raise ConfigError(problems)
