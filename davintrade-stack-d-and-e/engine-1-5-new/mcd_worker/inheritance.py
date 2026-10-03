"""MCD0 inheritance: a channel MCD on a defective timeframe is marked CAUTIONARY (ADR-018, standard 9.2).

MCD0 is a gate. It judges the fit of the active M5 channel and of the active M15 channel and says which
timeframes fail; it marks nobody itself. The worker then marks every channel MCD whose registry
``uses_channel`` names a failing timeframe, adding ``MCD0_DEFECT_<TF>`` to its reasons.

Davin's decisions (2026-10-03, plan questions Q5):

* **(a)** MCD3 reads the readings of MCD1 and MCD2 **after** this marking. The marking is applied the moment
  an MCD's reading is final, before any derived MCD runs, so MCD3 sees what the cycle holds.
* **(b)** Only a **VALID** MCD0 defect propagates CAUTIONARY. An INVALID or STALE MCD0 propagates nothing:
  the channel MCDs' own checks already catch missing data. I read "VALID" literally, so a CAUTIONARY MCD0
  (today only possible while RETUNING is enforced, when every MCD is CAUTIONARY already) propagates
  nothing either; ``PROPAGATING_STATUSES`` is the one line to change if Davin meant otherwise.

What marking keeps and changes: the state, bias, levels, regime word, texts and ``details`` stay as the
evaluator wrote them; only ``status`` becomes CAUTIONARY and the reasons grow. A reading that is already
INVALID or STALE is left alone (there is no reading to caution about). The reasons are appended after the
evaluator's own, in timeframe order (M5, then M15): the order the checks ran in, with this one last
(standard section 6).
"""

from __future__ import annotations

from typing import Any, Mapping

from mcd_common import envelope as env
from mcd_common import reason_codes as rc
from mcd_common.cycle_inputs import TIMEFRAMES

from .errors import ConfigError
from .registry import Sensor

# Which timeframes each MCD0 state calls defective. Pinned to ``mcd0_registry.yaml`` by ``gate_state_problems``.
DEFECT_TIMEFRAMES: Mapping[str, tuple[str, ...]] = {
    "MCD0_ALL_QUALIFIED": (),
    "MCD0_M5_DEFECT": ("M5",),
    "MCD0_M15_DEFECT": ("M15",),
    "MCD0_M5_M15_DEFECT": ("M5", "M15"),
}

# The MCD0 statuses whose defect reaches the channel MCDs (decision Q5 b).
PROPAGATING_STATUSES = (rc.VALID,)


def gate_state_problems(gate: Sensor) -> list[str]:
    """The worker must know what every state of the gate means; a state it cannot map is refused at load."""
    unknown = sorted(set(gate.states) - set(DEFECT_TIMEFRAMES))
    missing = sorted(set(DEFECT_TIMEFRAMES) - set(gate.states))
    problems = [f"{gate.mcd_id}: state {code} is not mapped to timeframes in mcd_worker.inheritance" for code in unknown]
    problems += [f"{gate.mcd_id}: the worker maps state {code}, which the register does not have" for code in missing]
    return problems


def defect_timeframes(gate_envelope: Mapping[str, Any]) -> tuple[str, ...]:
    """The timeframes MCD0's reading calls defective, in M5, M15 order; ``()`` when nothing propagates."""
    if gate_envelope.get("status") not in PROPAGATING_STATUSES:
        return ()
    state = gate_envelope.get("state_code")
    if state not in DEFECT_TIMEFRAMES:
        raise ConfigError(f"MCD0 returned state {state!r}, which the worker cannot map to timeframes")
    return tuple(tf for tf in TIMEFRAMES if tf in DEFECT_TIMEFRAMES[state])


def inherited_reasons(sensor: Sensor, defects: tuple[str, ...]) -> tuple[str, ...]:
    """The ``MCD0_DEFECT_<TF>`` codes ``sensor`` inherits: the defective timeframes it uses, M5 before M15."""
    return tuple(rc.mcd0_defect(tf) for tf in TIMEFRAMES if tf in defects and tf in sensor.uses_channel)


def apply_inheritance(
    reading: Mapping[str, Any], sensor: Sensor, defects: tuple[str, ...]
) -> tuple[dict[str, Any], tuple[str, ...]]:
    """``(reading, added)``: the reading marked CAUTIONARY, and the reasons added (``()`` when it is left as it is).

    ``reading`` is a canonical envelope. A VALID or CAUTIONARY one is rebuilt through the kit's ``cautionary``
    builder, so the result is checked the way every envelope is.
    """
    existing = list(reading["status_reasons"])
    added = tuple(code for code in inherited_reasons(sensor, defects) if code not in existing)
    if not added or reading["status"] not in (rc.VALID, rc.CAUTIONARY):
        return dict(reading), ()
    marked = env.cautionary(
        reading["mcd_id"],
        reading["evaluator_version"],
        reading["cycle_slot"],
        existing + list(added),
        state_code=reading["state_code"],
        bias=reading["bias"],
        summary_line=reading["summary_line"],
        commentary=reading["commentary"],
        levels=reading["levels"],
        regime_status=reading["regime_status"],
        details=reading["details"],
        last_closed_bar=reading["last_closed_bar"],
        active_indicator=reading["active_indicator"],
        config_hash=reading["config_hash"],
        depends_on=reading["depends_on"],
    )
    return env.canonical(marked), added
