"""Shared test support: the stored cycle bundles, the real worker, and a small synthetic world of stub MCDs.

The synthetic world has the same shape as the real four (a gate, two independent channel MCDs, one derived MCD)
but its evaluators are stubs, so a test can say exactly what each MCD returns and watch what the runner does.
"""

from __future__ import annotations

import copy
import dataclasses
import json
from functools import lru_cache
from pathlib import Path
from typing import Any, Callable, Iterable, Mapping, Sequence

from mcd_common import envelope as env
from mcd_common import preflight as pf
from mcd_common import reason_codes as rc
from mcd_common.cycle_inputs import CycleInputs, Params, slot_to_epoch, stats_slot_for, thaw

from mcd_worker.cycle_runner import Worker
from mcd_worker.flags import CHECKLIST_ITEMS, PASSED, PENDING, Checklist, ChecklistItem
from mcd_worker.registry import Registry, Sensor, StateEntry

WORKER_DIR = Path(__file__).resolve().parents[1]
ENGINE = WORKER_DIR.parent
STACK = ENGINE.parent
REPO = STACK.parent
FIXTURES = WORKER_DIR / "fixtures"

SLOTS = {"v1": "2026-09-18T20:55Z", "v3": "2026-09-28T14:15Z", "v4": "2026-09-28T23:15Z"}
SHADOW_ALL = {f"MCD{n}": "shadow" for n in range(4)}
MCD_IDS = tuple(f"MCD{n}" for n in range(4))


def stem(name: str) -> str:
    return SLOTS[name].replace(":", "")


# --------------------------------------------------------------------------- the real thing


@lru_cache(maxsize=None)
def bundle_text(name: str) -> str:
    return (FIXTURES / f"{stem(name)}.bundle.json").read_text(encoding="utf-8")


@lru_cache(maxsize=None)
def bundle(name: str) -> CycleInputs:
    return CycleInputs.from_dict(json.loads(bundle_text(name)))


@lru_cache(maxsize=None)
def real_worker() -> Worker:
    """The four real MCDs, every flag at ``shadow`` (the committed configuration has them ``off``)."""
    return Worker.load(flags=SHADOW_ALL)


def stored_cycle_text(name: str) -> str:
    return (FIXTURES / f"{stem(name)}.cycle.json").read_text(encoding="utf-8")


def with_statistics(inputs: CycleInputs, timeframe: str, **changes: Any) -> CycleInputs:
    """``inputs`` with fields of the active statistics row of ``timeframe`` changed."""
    stats = dict(inputs.statistics)
    key = (timeframe, inputs.active_indicator[timeframe])
    row = thaw(stats[key])
    row.update(changes)
    stats[key] = row
    return dataclasses.replace(inputs, statistics=stats)


# --------------------------------------------------------------------------- a bundle for stubs


def tiny_inputs(slot: str = "2026-09-18T20:55Z", **overrides: Any) -> CycleInputs:
    """A bundle the stubs never read: only the identity fields matter to the runner."""
    fields: dict[str, Any] = dict(
        symbol="XAUUSD",
        cycle_slot=slot,
        data_status="FRESH",
        retuning=False,
        bars={"M5": (), "M15": ()},
        statistics={},
        stats_slot={"M5": stats_slot_for(slot, "M5"), "M15": stats_slot_for(slot, "M15")},
        active_indicator={"M5": "best_fit_a", "M15": "non_b"},
        config_hash={},
        channel_mode={},
    )
    fields.update(overrides)
    return CycleInputs(**fields)


# --------------------------------------------------------------------------- stub MCDs

VERSION = "1.0.0"


def params_for(mcd_id: str, version: str = VERSION) -> Params:
    return Params.from_dict(
        {"mcd_id": mcd_id, "evaluator_version": version, "parameters": {"p": {"value": 1, "unit": "x", "boundary": ">=", "why": "test"}}}
    )


def reading(
    mcd_id: str,
    slot: str,
    *,
    status: str = rc.VALID,
    state: str | None = None,
    bias: str = "NEUTRAL",
    reasons: Sequence[str] = (),
    depends_on: Sequence[str] = (),
    version: str = VERSION,
    levels: Sequence[Mapping[str, Any]] = (),
    details: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    """An envelope of a stub MCD, built through the kit so it is well formed."""
    state = state or f"{mcd_id}_STATE"
    common = dict(depends_on=depends_on, details=details)
    if status == rc.VALID:
        return env.valid(mcd_id, version, slot, state_code=state, bias=bias, summary_line="Stub reading", commentary="A stub reading.", levels=levels, **common)
    if status == rc.CAUTIONARY:
        return env.cautionary(mcd_id, version, slot, list(reasons), state_code=state, bias=bias, summary_line="Stub reading", commentary="A stub reading.", levels=levels, **common)
    return env.unavailable(status, mcd_id, version, slot, list(reasons), depends_on=depends_on, details=details)


class Calls:
    """Records what a stub evaluator was called with: ``(retuning, upstream copy)`` per call."""

    def __init__(self) -> None:
        self.items: list[tuple[bool, dict[str, Any]]] = []

    def __len__(self) -> int:
        return len(self.items)

    @property
    def last_upstream(self) -> dict[str, Any]:
        return self.items[-1][1]


def stub(
    mcd_id: str,
    *,
    state: str | None = None,
    bias: str = "NEUTRAL",
    status: str = rc.VALID,
    reasons: Sequence[str] = (),
    depends_on: Sequence[str] = (),
    version: str = VERSION,
    calls: Calls | None = None,
    raises: Exception | None = None,
    returns: Any = None,
    use_returns: bool = False,
    mutate_upstream: bool = False,
) -> Callable[..., Any]:
    """An evaluator that always answers the same thing (or raises, or returns junk, as told)."""

    def evaluate(inputs: CycleInputs, params: Params, upstream: Mapping[str, Any]) -> Any:
        if calls is not None:
            calls.items.append((inputs.retuning, copy.deepcopy(dict(upstream))))
        if mutate_upstream:
            for value in upstream.values():
                value["state_code"] = "MCD9_CHANGED"
                value["status_reasons"].append("EVALUATOR_ERROR")
        if raises is not None:
            raise raises
        if use_returns:
            return returns
        return reading(mcd_id, inputs.cycle_slot, status=status, state=state, bias=bias, reasons=reasons, depends_on=depends_on, version=version)

    return evaluate


def mcd3_stub(calls: Calls | None = None, version: str = VERSION) -> Callable[..., Any]:
    """A derived MCD built the way the real MCD3 is: the kit's upstream check, then a state from the upstream states."""

    def evaluate(inputs: CycleInputs, params: Params, upstream: Mapping[str, Any]) -> Any:
        if calls is not None:
            calls.items.append((inputs.retuning, copy.deepcopy(dict(upstream))))
        outcome = pf.upstream_check(["MCD1", "MCD2"], upstream)(inputs)
        if outcome.status in (rc.INVALID, rc.STALE):
            return env.unavailable(outcome.status, "MCD3", version, inputs.cycle_slot, list(outcome.reasons), depends_on=("MCD1", "MCD2"))
        up = {k: upstream[k]["state_code"].endswith("_UP") for k in ("MCD1", "MCD2")}
        state, bias = ("MCD3_AGREE_UP", "LONG") if all(up.values()) else ("MCD3_NO_AGREEMENT", "STAND_ASIDE")
        kwargs = dict(state_code=state, bias=bias, summary_line="Stub reading", commentary="A stub reading.", depends_on=("MCD1", "MCD2"))
        if outcome.status == rc.CAUTIONARY:
            return env.cautionary("MCD3", version, inputs.cycle_slot, list(outcome.reasons), **kwargs)
        return env.valid("MCD3", version, inputs.cycle_slot, **kwargs)

    return evaluate


GATE_STATES = ("MCD0_ALL_QUALIFIED", "MCD0_M5_DEFECT", "MCD0_M15_DEFECT", "MCD0_M5_M15_DEFECT")


def sensor(
    mcd_id: str,
    kind: str,
    evaluate: Callable[..., Any],
    *,
    depends_on: Sequence[str] = (),
    uses_channel: Sequence[str] = (),
    timeframes: Sequence[str] = ("M5", "M15"),
    states: Mapping[str, str] | None = None,
    version: str = VERSION,
    registry_flag: str = "off",
) -> Sensor:
    """A ``Sensor`` for tests. ``states`` maps state code to bias; the default is one state ``<ID>_STATE``."""
    register = states if states is not None else {f"{mcd_id}_STATE": "NEUTRAL"}
    return Sensor(
        mcd_id=mcd_id,
        name=f"stub {mcd_id}",
        kind=kind,
        evaluator_version=version,
        timeframes=tuple(timeframes),
        depends_on=tuple(depends_on),
        uses_channel=tuple(uses_channel),
        registry_flag=registry_flag,
        states={code: StateEntry(code, bias, None) for code, bias in register.items()},
        params=params_for(mcd_id, version),
        evaluate=evaluate,
    )


def synthetic_sensors(
    *,
    gate: str = "MCD0_ALL_QUALIFIED",
    gate_status: str = rc.VALID,
    gate_reasons: Sequence[str] = (),
    mcd1: Callable[..., Any] | None = None,
    mcd2: Callable[..., Any] | None = None,
    mcd3: Callable[..., Any] | None = None,
    gate_evaluate: Callable[..., Any] | None = None,
) -> list[Sensor]:
    """The shape of the real four: gate MCD0, independent MCD1 (M15) and MCD2 (M5), derived MCD3 reading both."""
    gate_register = {code: "NEUTRAL" for code in GATE_STATES}
    trend = {"MCD1_UP": "LONG", "MCD1_DOWN": "SHORT"}
    trend2 = {"MCD2_UP": "LONG", "MCD2_DOWN": "SHORT"}
    return [
        sensor("MCD0", "gate", gate_evaluate or stub("MCD0", state=gate, status=gate_status, reasons=gate_reasons), states=gate_register),
        sensor("MCD1", "independent", mcd1 or stub("MCD1", state="MCD1_UP", bias="LONG"), uses_channel=("M15",), timeframes=("M15",), states=trend),
        sensor("MCD2", "independent", mcd2 or stub("MCD2", state="MCD2_UP", bias="LONG"), uses_channel=("M5",), timeframes=("M5",), states=trend2),
        sensor(
            "MCD3",
            "derived",
            mcd3 or mcd3_stub(),
            depends_on=("MCD1", "MCD2"),
            uses_channel=("M5", "M15"),
            states={"MCD3_AGREE_UP": "LONG", "MCD3_NO_AGREEMENT": "STAND_ASIDE"},
        ),
    ]


# --------------------------------------------------------------------------- checklists


def checklist(mcd_id: str, passed: Iterable[int] = ()) -> Checklist:
    """A checklist with exactly ``passed`` items passed and the rest pending."""
    done = set(passed)
    items = tuple(
        ChecklistItem(
            item_id=item_id,
            name=name,
            status=PASSED if item_id in done else PENDING,
            evidence="test evidence" if item_id in done else "",
            files=("somewhere.md",) if item_id in done else (),
            waits_on="" if item_id in done else "a later step",
        )
        for item_id, name in CHECKLIST_ITEMS
    )
    return Checklist(mcd_id, items)


def all_passed(ids: Iterable[str]) -> dict[str, Checklist]:
    return {i: checklist(i, range(1, 10)) for i in ids}


def shadow_ready(ids: Iterable[str]) -> dict[str, Checklist]:
    return {i: checklist(i, range(1, 7)) for i in ids}


def synthetic_worker(sensors: Sequence[Sensor] | None = None, *, flags: Mapping[str, str] | None = None, live: bool = False) -> Worker:
    """A worker over stub MCDs, every flag ``shadow`` (``live`` when asked), with checklists that allow it."""
    chosen = list(sensors or synthetic_sensors())
    ids = [s.mcd_id for s in chosen]
    return Worker(
        Registry(chosen),
        flags or {i: ("live" if live else "shadow") for i in ids},
        all_passed(ids) if live else shadow_ready(ids),
    )


def envelope_text_without(result_envelope: Mapping[str, Any], *drop: str) -> str:
    return json.dumps({k: v for k, v in result_envelope.items() if k not in drop}, sort_keys=True)


def slot_epoch(slot: str) -> int:
    return slot_to_epoch(slot)


def worker_replacing(mcd_id: str, wrap: Callable[[Callable[..., Any]], Callable[..., Any]]) -> Worker:
    """The real worker with one real evaluator wrapped (``wrap(evaluate) -> evaluate``), checklists and flags as the real one's."""
    real = real_worker()
    sensors = [dataclasses.replace(real.registry[i], evaluate=wrap(real.registry[i].evaluate)) if i == mcd_id else real.registry[i] for i in real.registry]
    return Worker(Registry(sensors), real.flags, real.checklists)
