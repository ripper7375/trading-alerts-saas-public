"""The cycle runner: one input bundle in, one reading per enabled MCD out (architecture 2.2).

What one ``Worker.run_cycle`` does, in this order:

1. **Check the bundle can be keyed** (a slot, a symbol, a boolean ``retuning``). Bad market data is not
   checked here: the evaluators answer INVALID or STALE for it.
2. **RETUNING switch** (Davin, Q6). The ``retuning`` flag of the bundle is always read and recorded
   (``retuning_observed``). It reaches the evaluators only when ``retuning_enforced`` is true
   (``retuning_applied``); otherwise they see ``retuning = False`` and every reading is what it would be
   outside a promote. ``retuning_enforced`` defaults to **false**: until a promote has been rehearsed and
   Davin has settled how RETUNING ends (build step 3, B5), production sensors stay VALID during a promote.
3. **Order**: MCD0, then the independent MCDs, then the derived MCDs in dependency order.
4. For each MCD: call its evaluator with the bundle and a **copy** of the same-cycle readings of the MCDs it
   depends on (post-inheritance, Q5 a; an evaluator cannot change what a later MCD reads), run the output
   guards, then mark it CAUTIONARY if MCD0 found a defect on a timeframe it uses (``inheritance``).
5. Every enabled MCD yields **exactly one** reading. An evaluator that raises, returns something that is not
   an envelope, or returns one that fails its guards is replaced by INVALID with ``EVALUATOR_ERROR``; the
   problems are kept next to the reading, never inside it.

Everything that varies between two runs of the same bundle (timings, the Python version) sits under
``runtime`` in the result and nowhere else; two runs agree on the rest byte for byte (R4).
"""

from __future__ import annotations

import copy
import dataclasses
import hashlib
import json
import logging
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from types import MappingProxyType
from typing import Any, Mapping

from mcd_common import envelope as env
from mcd_common.cycle_inputs import CycleInputs, is_slot

from . import guards, inheritance
from .errors import BundleError, ConfigError
from .flags import (
    DEFAULT_CHECKLIST_DIR,
    DEFAULT_CONFIG_PATH,
    FLAG_OFF,
    Checklist,
    flag_problems,
    load_checklists,
    load_worker_config,
)
from .registry import ENGINE_DIR, GATE_ID, KIND_GATE, Registry, Sensor, execution_order, load_registry

RUNNER_VERSION = "1.0.0"
RESULT_SCHEMA = "mcd-cycle-result/1"

_LOG = logging.getLogger("mcd.worker")


# --------------------------------------------------------------------------- hashes


def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def bundle_canonical_json(inputs: CycleInputs) -> str:
    """The byte-stable text of a bundle: sorted keys, no spaces. What ``inputs_sha256`` is the hash of.

    The text a caller sent may order its keys differently; the hash does not depend on it.
    """
    return json.dumps(inputs.to_dict(), sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def _bundle_sha256(inputs: CycleInputs) -> str | None:
    try:
        return sha256_text(bundle_canonical_json(inputs))
    except Exception:  # noqa: BLE001 - a malformed bundle must still be read by the evaluators, which answer INVALID
        _LOG.exception("bundle cannot be hashed", extra={"cycle_slot": inputs.cycle_slot, "mcd_id": None})
        return None


def _bundle_text(inputs: CycleInputs) -> str | None:
    """``bundle_canonical_json`` for the result, or ``None`` when the bundle cannot be written as JSON.

    ``_bundle_sha256`` has already logged that failure for the same bundle; this one stays quiet so one problem is one log line.
    """
    try:
        return bundle_canonical_json(inputs)
    except Exception:  # noqa: BLE001 - the same malformed bundle ``_bundle_sha256`` reported
        return None


def _check_bundle(inputs: Any) -> None:
    if not isinstance(inputs, CycleInputs):
        raise BundleError(f"run_cycle needs a CycleInputs, got {type(inputs).__name__}")
    if not is_slot(inputs.cycle_slot):
        raise BundleError(f"cycle_slot is not an ISO 8601 UTC 5-minute slot: {inputs.cycle_slot!r}")
    if not isinstance(inputs.symbol, str) or not inputs.symbol:
        raise BundleError(f"symbol must be a non-empty string, got {inputs.symbol!r}")
    if not isinstance(inputs.retuning, bool):
        raise BundleError(f"retuning must be a boolean, got {inputs.retuning!r}")


# --------------------------------------------------------------------------- results


@dataclass(frozen=True)
class MCDResult:
    """One MCD's reading of the cycle, as it is saved (``mcd_outputs``, part 2)."""

    mcd_id: str
    flag: str  # ``shadow`` or ``live``: the flag at the moment of writing
    evaluator_version: str
    status: str
    state_code: str | None
    bias: str | None
    envelope: Mapping[str, Any]  # the canonical envelope (after inheritance)
    envelope_json: str  # its compact canonical text: what is stored and hashed, byte for byte
    envelope_sha256: str
    evaluator_envelope_sha256: str  # the hash of the reading before inheritance (equal to ``envelope_sha256`` if unmarked)
    inherited_reasons: tuple[str, ...]  # ``MCD0_DEFECT_<TF>`` codes the worker added, in order
    guard_problems: tuple[str, ...]  # why the evaluator's reading was replaced (empty = it was kept)
    duration_ms: float  # wall time of this MCD (not part of the reading, kept under ``runtime``)

    def to_dict(self) -> dict[str, Any]:
        return {
            "mcd_id": self.mcd_id,
            "flag": self.flag,
            "evaluator_version": self.evaluator_version,
            "status": self.status,
            "state_code": self.state_code,
            "bias": self.bias,
            "envelope_json": self.envelope_json,
            "envelope_sha256": self.envelope_sha256,
            "evaluator_envelope_sha256": self.evaluator_envelope_sha256,
            "inherited_reasons": list(self.inherited_reasons),
            "guard_problems": list(self.guard_problems),
        }


@dataclass(frozen=True)
class CycleResult:
    symbol: str
    cycle_slot: str
    inputs_sha256: str | None
    bundle_canonical_json: str | None  # the text ``inputs_sha256`` is the hash of: what the worker stores for replay (``None`` with the hash)
    retuning_observed: bool
    retuning_enforced: bool
    retuning_applied: bool
    flags: Mapping[str, str]
    order: tuple[str, ...]
    gate_status: str | None  # MCD0's status, ``None`` when MCD0 did not run
    gate_state: str | None
    defect_timeframes: tuple[str, ...]  # what MCD0 passed on to the channel MCDs
    results: tuple[MCDResult, ...]
    python: str

    def by_id(self) -> dict[str, MCDResult]:
        return {r.mcd_id: r for r in self.results}

    def deterministic_dict(self) -> dict[str, Any]:
        """Everything two runs of the same bundle must agree on (R4)."""
        return {
            "schema_version": RESULT_SCHEMA,
            "runner_version": RUNNER_VERSION,
            "symbol": self.symbol,
            "cycle_slot": self.cycle_slot,
            "inputs_sha256": self.inputs_sha256,
            "retuning": {
                "observed": self.retuning_observed,
                "enforced": self.retuning_enforced,
                "applied": self.retuning_applied,
            },
            "flags": dict(self.flags),
            "order": list(self.order),
            "gate": None
            if self.gate_status is None
            else {
                "mcd_id": GATE_ID,
                "status": self.gate_status,
                "state_code": self.gate_state,
                "defect_timeframes": list(self.defect_timeframes),
            },
            "results": [r.to_dict() for r in self.results],
        }

    def to_dict(self) -> dict[str, Any]:
        out = self.deterministic_dict()
        # An echo of the input, not a reading: the stored fixtures already hold the bundle and carry its hash, so it stays out of
        # ``deterministic_dict`` (and out of every ``.cycle.json``). Two runs of one bundle still agree on it byte for byte.
        out["bundle_canonical_json"] = self.bundle_canonical_json
        out["runtime"] = {
            "python": self.python,
            "timings_ms": {r.mcd_id: r.duration_ms for r in self.results},
        }
        return out


# --------------------------------------------------------------------------- the worker


class Worker:
    """A registry, a set of flags and the checklists behind them, ready to run cycles.

    Building one refuses a flag set the checklists do not allow (``ConfigError`` lists every problem), so a
    ``Worker`` that exists is a ``Worker`` that may run.
    """

    def __init__(self, registry: Registry, flags: Mapping[str, str], checklists: Mapping[str, Checklist]) -> None:
        problems = flag_problems(flags, registry, checklists)
        if GATE_ID in registry:
            problems += inheritance.gate_state_problems(registry[GATE_ID])
        if problems:
            raise ConfigError(problems)
        self.registry = registry
        self.flags: Mapping[str, str] = MappingProxyType({i: flags[i] for i in registry})
        self.checklists = MappingProxyType(dict(checklists))
        self.enabled = tuple(i for i in registry if self.flags[i] != FLAG_OFF)
        self.order = execution_order(registry, self.enabled)

    @classmethod
    def load(
        cls,
        *,
        engine_dir: str | Path | None = None,
        config_path: str | Path | None = None,
        checklist_dir: str | Path | None = None,
        flags: Mapping[str, str] | None = None,
    ) -> "Worker":
        """The four MCDs of this checkout with ``worker_config.yaml`` and ``checklists/``.

        ``flags`` replaces single flags of the file (tests and the measurement kit); the result is checked
        exactly like the file's own, so a flag the checklists do not allow is refused either way.
        """
        registry = load_registry(engine_dir or ENGINE_DIR)
        config = load_worker_config(config_path or DEFAULT_CONFIG_PATH)
        checklists = load_checklists(checklist_dir or DEFAULT_CHECKLIST_DIR)
        return cls(registry, {**config.flags, **(flags or {})}, checklists)

    # ------------------------------------------------------------------ one cycle

    def run_cycle(self, inputs: CycleInputs, *, retuning_enforced: bool = False) -> CycleResult:
        """Run every enabled MCD on ``inputs``. Raises ``BundleError`` only when the bundle cannot be keyed."""
        _check_bundle(inputs)
        if not isinstance(retuning_enforced, bool):
            raise ConfigError(f"retuning_enforced must be a boolean, got {retuning_enforced!r}")
        observed = inputs.retuning
        applied = observed and retuning_enforced
        seen = dataclasses.replace(inputs, retuning=False) if observed and not applied else inputs

        envelopes: dict[str, dict[str, Any]] = {}  # the final reading of each MCD run so far
        results: list[MCDResult] = []
        defects: tuple[str, ...] = ()
        gate_status = gate_state = None
        for mcd_id in self.order:
            sensor = self.registry[mcd_id]
            started = time.perf_counter()
            upstream = {dep: envelopes[dep] for dep in sensor.depends_on if dep in envelopes}
            reading, problems = self._read(sensor, seen, upstream)
            evaluator_hash = sha256_text(env.canonical_json(reading))
            added: tuple[str, ...] = ()
            if sensor.kind == KIND_GATE:
                defects = inheritance.defect_timeframes(reading)
                gate_status, gate_state = reading["status"], reading["state_code"]
            else:
                marked, added = inheritance.apply_inheritance(reading, sensor, defects)
                if added:
                    extra = guards.envelope_problems(marked, sensor, seen)
                    if extra:
                        _LOG.error("marked reading failed its guards: %s", extra, extra={"cycle_slot": seen.cycle_slot, "mcd_id": mcd_id})
                        marked, added, problems = guards.replacement(sensor, seen), (), problems + extra
                    reading = marked
            text = env.canonical_json(reading)
            envelopes[mcd_id] = reading
            results.append(
                MCDResult(
                    mcd_id=mcd_id,
                    flag=self.flags[mcd_id],
                    evaluator_version=sensor.evaluator_version,
                    status=reading["status"],
                    state_code=reading["state_code"],
                    bias=reading["bias"],
                    envelope=reading,
                    envelope_json=text,
                    envelope_sha256=sha256_text(text),
                    evaluator_envelope_sha256=evaluator_hash,
                    inherited_reasons=added,
                    guard_problems=tuple(problems),
                    duration_ms=round((time.perf_counter() - started) * 1000, 3),
                )
            )
        return CycleResult(
            symbol=inputs.symbol,
            cycle_slot=inputs.cycle_slot,
            inputs_sha256=_bundle_sha256(inputs),
            bundle_canonical_json=_bundle_text(inputs),
            retuning_observed=observed,
            retuning_enforced=retuning_enforced,
            retuning_applied=applied,
            flags=self.flags,
            order=self.order,
            gate_status=gate_status,
            gate_state=gate_state,
            defect_timeframes=defects,
            results=tuple(results),
            python=sys.version.split()[0],
        )

    # ------------------------------------------------------------------ one MCD

    def _read(self, sensor: Sensor, seen: CycleInputs, upstream: Mapping[str, Any]) -> tuple[dict[str, Any], list[str]]:
        """``(canonical reading, guard problems)``: the evaluator's reading, or the replacement for it."""
        context = {"cycle_slot": seen.cycle_slot, "mcd_id": sensor.mcd_id}
        try:
            raw = sensor.evaluate(seen, sensor.params, copy.deepcopy(dict(upstream)))
        except Exception as exc:  # noqa: BLE001 - R7: the evaluator should never raise; if it does, one INVALID row exists
            _LOG.exception("evaluator raised", extra=context)
            return guards.replacement(sensor, seen), [f"RAISED: {type(exc).__name__}: {exc}"]
        if isinstance(raw, Mapping) and guards.is_kit_fallback(raw):
            raw = guards.replacement(sensor, seen)  # the kit's fallback does not know the dependencies; the registry does
        problems = guards.envelope_problems(raw, sensor, seen)
        if problems:
            _LOG.error("reading failed its guards: %s", problems, extra=context)
            return guards.replacement(sensor, seen), problems
        return env.canonical(raw), []
