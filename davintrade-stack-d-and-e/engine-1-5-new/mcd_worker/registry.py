"""The MCD registries as the worker reads them, and the order a cycle runs them in (architecture 2.2, 2.13).

``load_registry`` reads, for every folder ``mcdN/`` of the engine directory, the registry entry
(``mcdN_registry.yaml``), the parameters (``mcdN_params.yaml``) and the evaluator (``mcdN_evaluator.py``),
exactly as the folder keeps them (standard section 11.1: they are copied into the worker unchanged). It
refuses anything that would make a cycle ambiguous: a registry and an evaluator that disagree about the
version, a derived MCD with no dependency, a dependency on an MCD that does not exist, a dependency cycle
(standard 9.1), a flag written as a YAML boolean, a state register the worker cannot map.

``execution_order`` is the order of architecture 2.2: the gate (MCD0) first, then the independent MCDs by
number, then the derived MCDs in dependency order. The order is a pure function of the registry and of
which MCDs are enabled, so two runs can never disagree about it.
"""

from __future__ import annotations

import importlib.util
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from types import MappingProxyType
from typing import Any, Callable, Collection, Iterable, Iterator, Mapping

import yaml

from mcd_common.cycle_inputs import TIMEFRAMES, Params
from mcd_common.envelope import BIASES

from .errors import ConfigError
from .flags import FLAG_VALUES

ENGINE_DIR = Path(__file__).resolve().parents[1]
GATE_ID = "MCD0"
KIND_GATE, KIND_INDEPENDENT, KIND_DERIVED = "gate", "independent", "derived"
KINDS = (KIND_GATE, KIND_INDEPENDENT, KIND_DERIVED)

_MCD_ID_RE = re.compile(r"^MCD([0-9]|1[0-5])$")
_FOLDER_RE = re.compile(r"^mcd([0-9]|1[0-5])$")
_VERSION_RE = re.compile(r"^[0-9]+\.[0-9]+\.[0-9]+$")


def mcd_number(mcd_id: str) -> int:
    """``"MCD3"`` -> 3."""
    return int(mcd_id[3:])


@dataclass(frozen=True)
class StateEntry:
    """One row of an MCD's state register: what the worker checks a reading against."""

    code: str
    bias: str
    regime_status: str | None


@dataclass(frozen=True)
class Sensor:
    """One MCD as the worker runs it. ``evaluate`` is the evaluator's ``evaluate(inputs, params, upstream)``."""

    mcd_id: str
    name: str
    kind: str
    evaluator_version: str
    timeframes: tuple[str, ...]
    depends_on: tuple[str, ...]
    uses_channel: tuple[str, ...]
    registry_flag: str
    states: Mapping[str, StateEntry]
    params: Params
    evaluate: Callable[..., Any]

    @property
    def number(self) -> int:
        return mcd_number(self.mcd_id)


class Registry(Mapping[str, Sensor]):
    """The sensors by id, in numeric order. Building one checks the graph; a bad one raises ``ConfigError``."""

    def __init__(self, sensors: Iterable[Sensor]) -> None:
        ordered = sorted(sensors, key=lambda s: s.number if _MCD_ID_RE.match(s.mcd_id) else 99)
        self._sensors: dict[str, Sensor] = {}
        problems: list[str] = []
        for sensor in ordered:
            if sensor.mcd_id in self._sensors:
                problems.append(f"{sensor.mcd_id} appears twice")
            self._sensors[sensor.mcd_id] = sensor
        problems += graph_problems(self._sensors)
        if problems:
            raise ConfigError(problems)

    def __getitem__(self, mcd_id: str) -> Sensor:
        return self._sensors[mcd_id]

    def __iter__(self) -> Iterator[str]:
        return iter(self._sensors)

    def __len__(self) -> int:
        return len(self._sensors)


# --------------------------------------------------------------------------- the graph


def find_cycle(depends_on: Mapping[str, Collection[str]]) -> list[str]:
    """One dependency cycle as a list of ids (first id repeated at the end), or ``[]``. Deterministic."""
    state: dict[str, int] = {}  # 1 = on the current path, 2 = finished
    path: list[str] = []

    def visit(node: str) -> list[str]:
        state[node] = 1
        path.append(node)
        for dep in sorted(depends_on.get(node, ()), key=lambda d: (mcd_number(d) if _MCD_ID_RE.match(d) else 99, d)):
            if dep not in depends_on:
                continue
            if state.get(dep) == 1:
                return path[path.index(dep):] + [dep]
            if state.get(dep) is None:
                found = visit(dep)
                if found:
                    return found
        path.pop()
        state[node] = 2
        return []

    for node in sorted(depends_on, key=lambda d: (mcd_number(d) if _MCD_ID_RE.match(d) else 99, d)):
        if state.get(node) is None:
            found = visit(node)
            if found:
                return found
    return []


def graph_problems(sensors: Mapping[str, Sensor]) -> list[str]:
    """Everything wrong with the sensors taken together (standard 9.1 and 9.2). Empty list = fine."""
    problems: list[str] = []
    gates = [s.mcd_id for s in sensors.values() if s.kind == KIND_GATE]
    if gates and gates != [GATE_ID]:
        problems.append(f"the only gate is {GATE_ID}; found gates {gates} (a new gate needs its own inheritance rule first)")
    for sensor in sensors.values():
        for dep in sensor.depends_on:
            if dep == sensor.mcd_id:
                problems.append(f"{sensor.mcd_id} depends on itself")
            elif dep not in sensors:
                problems.append(f"{sensor.mcd_id} depends on {dep}, which is not in the registry")
    cycle = find_cycle({s.mcd_id: s.depends_on for s in sensors.values()})
    if cycle:
        problems.append("dependency cycle: " + " -> ".join(cycle))
    return problems


def execution_order(registry: Mapping[str, Sensor], enabled: Iterable[str]) -> tuple[str, ...]:
    """The gate, then the independent MCDs by number, then the derived MCDs in dependency order.

    Derived MCDs are taken in waves: every one whose derived dependencies are already placed goes into the
    next wave, by number. A dependency on an MCD that is not enabled does not hold a derived MCD back (the
    flag rules refuse that combination before a cycle runs; here the order is only computed).
    """
    chosen = set(enabled)
    unknown = sorted(chosen - set(registry))
    if unknown:
        raise ConfigError(f"cannot order unknown MCDs {unknown}")

    def by_number(ids: Iterable[str]) -> list[str]:
        return sorted(ids, key=mcd_number)

    order = by_number(i for i in chosen if registry[i].kind == KIND_GATE)
    order += by_number(i for i in chosen if registry[i].kind == KIND_INDEPENDENT)
    waiting = {
        i: {d for d in registry[i].depends_on if d in chosen and registry[d].kind == KIND_DERIVED and d != i}
        for i in chosen
        if registry[i].kind == KIND_DERIVED
    }
    while waiting:
        wave = by_number(i for i, deps in waiting.items() if not deps)
        if not wave:
            raise ConfigError("dependency cycle among derived MCDs: " + ", ".join(by_number(waiting)))
        order += wave
        for i in wave:
            del waiting[i]
        for deps in waiting.values():
            deps.difference_update(wave)
    return tuple(order)


# --------------------------------------------------------------------------- reading one MCD folder


def _tuple_of_strings(value: Any) -> tuple[str, ...] | None:
    if isinstance(value, list) and all(isinstance(v, str) for v in value):
        return tuple(value)
    return None


def _load_evaluator(path: Path, module_name: str) -> Any:
    """Import ``mcdN_evaluator.py`` by path, under the module name the MCD's own tests use (``mcdN_evaluator``)."""
    existing = sys.modules.get(module_name)
    if existing is not None and Path(getattr(existing, "__file__", "") or "").resolve() == path.resolve():
        return existing
    spec = importlib.util.spec_from_file_location(module_name, path)
    if spec is None or spec.loader is None:
        raise ImportError(f"cannot load {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    try:
        spec.loader.exec_module(module)
    except BaseException:
        sys.modules.pop(module_name, None)
        raise
    return module


def sensor_from_entry(
    entry: Any,
    *,
    folder_number: int | None,
    params: Params,
    evaluate: Callable[..., Any],
    evaluator_version: str | None = None,
    module_mcd_id: str | None = None,
) -> Sensor:
    """One registry entry (the parsed YAML) as a ``Sensor``, or ``ConfigError`` listing what is wrong.

    ``evaluator_version`` and ``module_mcd_id`` are the evaluator module's own ``EVALUATOR_VERSION`` and
    ``MCD_ID``; when given, the registry and the params file must agree with them.
    """
    if not isinstance(entry, Mapping):
        raise ConfigError("registry entry must be a mapping")
    problems: list[str] = []
    mcd_id = entry.get("mcd_id")
    if not isinstance(mcd_id, str) or not _MCD_ID_RE.match(mcd_id):
        raise ConfigError(f"registry entry: bad mcd_id {mcd_id!r}")
    where = mcd_id
    if folder_number is not None and mcd_number(mcd_id) != folder_number:
        problems.append(f"{where}: lives in folder mcd{folder_number}")
    version = entry.get("evaluator_version")
    if not isinstance(version, str) or not _VERSION_RE.match(version):
        problems.append(f"{where}: evaluator_version must be MAJOR.MINOR.PATCH text, got {version!r}")
    else:
        if params.evaluator_version != version:
            problems.append(f"{where}: registry says {version}, the params file says {params.evaluator_version}")
        if evaluator_version is not None and evaluator_version != version:
            problems.append(f"{where}: registry says {version}, the evaluator says {evaluator_version}")
    if params.mcd_id != mcd_id:
        problems.append(f"{where}: the params file is for {params.mcd_id}")
    if module_mcd_id is not None and module_mcd_id != mcd_id:
        problems.append(f"{where}: the evaluator says it is {module_mcd_id}")
    kind = entry.get("kind")
    if kind not in KINDS:
        problems.append(f"{where}: kind must be one of {KINDS}, got {kind!r}")
    if kind == KIND_GATE and mcd_id != GATE_ID:
        problems.append(f"{where}: only {GATE_ID} is a gate")
    timeframes = _tuple_of_strings(entry.get("timeframes"))
    if not timeframes or len(set(timeframes)) != len(timeframes) or any(tf not in TIMEFRAMES for tf in timeframes):
        problems.append(f"{where}: timeframes must be a non-empty list from {TIMEFRAMES}, got {entry.get('timeframes')!r}")
        timeframes = timeframes or ()
    depends_on = _tuple_of_strings(entry.get("depends_on"))
    if depends_on is None or any(not _MCD_ID_RE.match(d) for d in depends_on) or len(set(depends_on)) != len(depends_on):
        problems.append(f"{where}: depends_on must be a list of distinct MCD ids, got {entry.get('depends_on')!r}")
        depends_on = ()
    if kind in (KIND_GATE, KIND_INDEPENDENT) and depends_on:
        problems.append(f"{where}: kind {kind} has no dependencies, got {list(depends_on)}")
    if kind == KIND_DERIVED and not depends_on:
        problems.append(f"{where}: a derived MCD must name at least one dependency")
    uses_channel = _tuple_of_strings(entry.get("uses_channel"))
    if uses_channel is None or any(tf not in TIMEFRAMES for tf in uses_channel) or len(set(uses_channel)) != len(uses_channel):
        problems.append(f"{where}: uses_channel must be a list of distinct timeframes from {TIMEFRAMES}, got {entry.get('uses_channel')!r}")
        uses_channel = ()
    if kind == KIND_GATE and uses_channel:
        problems.append(f"{where}: a gate is not itself marked, uses_channel must be []")
    flag = entry.get("flag")
    if not isinstance(flag, str) or flag not in FLAG_VALUES:
        problems.append(
            f"{where}: flag must be one of {FLAG_VALUES} as a string, got {flag!r}"
            + (" (quote it: YAML 1.1 reads an unquoted off as false)" if isinstance(flag, bool) else "")
        )
        flag = "off"
    states: dict[str, StateEntry] = {}
    raw_states = entry.get("states")
    if not isinstance(raw_states, list) or not raw_states:
        problems.append(f"{where}: states must be a non-empty list")
    else:
        for row in raw_states:
            code = row.get("code") if isinstance(row, Mapping) else None
            if not isinstance(code, str) or not code.startswith(f"{mcd_id}_"):
                problems.append(f"{where}: a state code must start with '{mcd_id}_', got {code!r}")
                continue
            if code in states:
                problems.append(f"{where}: state {code} appears twice")
                continue
            bias, regime = row.get("bias"), row.get("regime_status")
            if bias not in BIASES:
                problems.append(f"{where}: state {code} has bias {bias!r}, expected one of {BIASES}")
                continue
            if regime is not None and not isinstance(regime, str):
                problems.append(f"{where}: state {code} has a regime_status that is not text")
                continue
            states[code] = StateEntry(code=code, bias=bias, regime_status=regime)
    if not callable(evaluate):
        problems.append(f"{where}: the evaluator has no callable evaluate")
    if problems:
        raise ConfigError(problems)
    return Sensor(
        mcd_id=mcd_id,
        name=str(entry.get("name") or mcd_id),
        kind=kind,
        evaluator_version=version,
        timeframes=timeframes,
        depends_on=depends_on,
        uses_channel=uses_channel,
        registry_flag=flag,
        states=MappingProxyType(states),
        params=params,
        evaluate=evaluate,
    )


def load_registry(engine_dir: str | Path = ENGINE_DIR) -> Registry:
    """Read every ``mcdN/`` folder of ``engine_dir`` into a ``Registry``. Raises ``ConfigError`` with every problem."""
    root = Path(engine_dir)
    folders = sorted((p for p in root.iterdir() if p.is_dir() and _FOLDER_RE.match(p.name)), key=lambda p: int(p.name[3:]))
    if not folders:
        raise ConfigError(f"no mcdN folder under {root}")
    sensors: list[Sensor] = []
    problems: list[str] = []
    for folder in folders:
        name = folder.name
        number = int(name[3:])
        files = {kind: folder / f"{name}_{kind}" for kind in ("registry.yaml", "params.yaml", "evaluator.py")}
        missing = [p.name for p in files.values() if not p.is_file()]
        if missing:
            problems.append(f"{name}: missing {', '.join(missing)}")
            continue
        try:
            entry = yaml.safe_load(files["registry.yaml"].read_text(encoding="utf-8"))
            params = Params.from_yaml(str(files["params.yaml"]))
            module = _load_evaluator(files["evaluator.py"], f"{name}_evaluator")
            absent = [n for n in ("MCD_ID", "EVALUATOR_VERSION", "evaluate") if not hasattr(module, n)]
            if absent:
                raise ConfigError(f"{name}: the evaluator has no {', '.join(absent)}")
            sensors.append(
                sensor_from_entry(
                    entry,
                    folder_number=number,
                    params=params,
                    evaluate=getattr(module, "evaluate", None),
                    evaluator_version=getattr(module, "EVALUATOR_VERSION", None),
                    module_mcd_id=getattr(module, "MCD_ID", None),
                )
            )
        except ConfigError as exc:
            problems += exc.problems
        except Exception as exc:  # noqa: BLE001 - a broken folder is a configuration problem, reported with the rest
            problems.append(f"{name}: cannot be loaded ({type(exc).__name__}: {exc})")
    if problems:
        raise ConfigError(problems)
    return Registry(sensors)
