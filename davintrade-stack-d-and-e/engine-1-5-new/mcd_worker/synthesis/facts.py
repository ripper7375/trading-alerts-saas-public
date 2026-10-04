"""The facts a synthesis rule may test about one sensor's reading (architecture 3.3, 3.4).

A rule row never looks inside an envelope: it names a sensor and a **fact**, and the engine computes the fact from the
reading. Keeping the vocabulary here, in one place, is what lets the rules loader refuse a row that names a fact or a value
that cannot exist (a misspelled state would otherwise never match and nobody would notice).

Facts of every sensor
    ``status``         VALID, CAUTIONARY, INVALID, STALE, or ABSENT (no reading was handed to synthesis)
    ``state_code``     the reading's state code, ``None`` unless the status is VALID or CAUTIONARY
    ``regime_status``  the regime word, ``None`` as above
    ``bias``           the sensor's own bias (a vote's input, never the result: ADR-025), ``None`` as above

Facts of the channel sensors (MCD1 on M15, MCD2 on M5), read from the state code ``MCDn_<TREND>_<POSITION>``
    ``trend``          UP, DOWN or SIDEWAYS: the slope of the channel
    ``position``       IN_CORRIDOR, UPPER_BREAKOUT or LOWER_BREAKDOWN: where the latest closed bar sits against the corridor
    ``breach``         UP when the position is UPPER_BREAKOUT, DOWN when it is LOWER_BREAKDOWN, else NONE: the side the
                       price left the corridor on

Facts of MCD3 (a derived sensor, a modifier), read from the state code
    ``consolidation``  UP (a BULL state), DOWN (a BEAR state), FLAT (SIDEWAYS_EQUILIBRIUM) or NONE (a NON_CONSOLIDATED state)

A fact other than ``status`` is ``None`` for a sensor that has no usable reading, so a condition on it can never hold:
that is how "a rule that names an unavailable sensor cannot match" (Davin's decision D1 (b)) falls out without a special case.
"""

from __future__ import annotations

import re
from typing import Any, Mapping

AVAILABLE_STATUSES = ("VALID", "CAUTIONARY")
UNAVAILABLE_STATUSES = ("INVALID", "STALE")
ABSENT = "ABSENT"
STATUS_VALUES = (*AVAILABLE_STATUSES, *UNAVAILABLE_STATUSES, ABSENT)

# The sensors synthesis can read. MCD0 is a gate: its effect arrives as CAUTIONARY on the channel sensors (ADR-018).
SENSORS = ("MCD1", "MCD2", "MCD3")
CHANNEL_SENSORS = ("MCD1", "MCD2")
DERIVED_SENSORS = ("MCD3",)

TRENDS = ("UP", "DOWN", "SIDEWAYS")
POSITIONS = ("IN_CORRIDOR", "UPPER_BREAKOUT", "LOWER_BREAKDOWN")
BREACHES = ("UP", "DOWN", "NONE")
CONSOLIDATIONS = ("UP", "DOWN", "FLAT", "NONE")
BIASES = ("LONG", "SHORT", "NEUTRAL", "STAND_ASIDE")

COMMON_FACTS = ("status", "state_code", "regime_status", "bias")
CHANNEL_FACTS = (*COMMON_FACTS, "trend", "position", "breach")
DERIVED_FACTS = (*COMMON_FACTS, "consolidation")

# The values a fact may be compared with. ``state_code`` and ``regime_status`` come from each sensor's register (see ``vocabulary``).
FIXED_VALUES: Mapping[str, tuple[str, ...]] = {
    "status": STATUS_VALUES,
    "bias": BIASES,
    "trend": TRENDS,
    "position": POSITIONS,
    "breach": BREACHES,
    "consolidation": CONSOLIDATIONS,
}

_CHANNEL_STATE_RE = re.compile(r"MCD[0-9]+_(UP|DOWN|SIDEWAYS)_(IN_CORRIDOR|UPPER_BREAKOUT|LOWER_BREAKDOWN)")
_BREACH_OF = {"IN_CORRIDOR": "NONE", "UPPER_BREAKOUT": "UP", "LOWER_BREAKDOWN": "DOWN"}


def facts_available_for(sensor_id: str) -> tuple[str, ...]:
    if sensor_id in CHANNEL_SENSORS:
        return CHANNEL_FACTS
    if sensor_id in DERIVED_SENSORS:
        return DERIVED_FACTS
    return ()


def channel_facts(state_code: str) -> dict[str, str] | None:
    """``trend``, ``position`` and ``breach`` of a channel state code, or ``None`` if the code does not have the form."""
    found = _CHANNEL_STATE_RE.fullmatch(state_code) if isinstance(state_code, str) else None
    if not found:
        return None
    trend, position = found.group(1), found.group(2)
    return {"trend": trend, "position": position, "breach": _BREACH_OF[position]}


def consolidation_of(state_code: str) -> str | None:
    """UP, DOWN, FLAT or NONE for an MCD3 state code, or ``None`` if the code is not one of the three families."""
    if not isinstance(state_code, str):
        return None
    if state_code.startswith("MCD3_BULL_"):
        return "UP"
    if state_code.startswith("MCD3_BEAR_"):
        return "DOWN"
    if state_code == "MCD3_SIDEWAYS_EQUILIBRIUM":
        return "FLAT"
    if state_code.startswith("MCD3_NON_CONSOLIDATED_"):
        return "NONE"
    return None


def facts_of(sensor_id: str, status: str, state_code: str | None, regime_status: str | None, bias: str | None) -> dict[str, Any]:
    """Every fact of one sensor's reading (``None`` where the reading has no value for it)."""
    facts: dict[str, Any] = {name: None for name in facts_available_for(sensor_id)}
    facts["status"] = status
    if status not in AVAILABLE_STATUSES:
        return facts
    facts["state_code"], facts["regime_status"], facts["bias"] = state_code, regime_status, bias
    if sensor_id in CHANNEL_SENSORS:
        facts.update(channel_facts(state_code) or {})
    elif sensor_id in DERIVED_SENSORS:
        facts["consolidation"] = consolidation_of(state_code)
    return facts


def register_problems(sensor_id: str, state_codes: Any) -> list[str]:
    """Every state code of a register that the fact computation cannot read. A new state that fails here must be taught to
    this module (and to the rules file) before synthesis can use it; without this check it would silently never match."""
    problems: list[str] = []
    for code in sorted(state_codes):
        if sensor_id in CHANNEL_SENSORS and channel_facts(code) is None:
            problems.append(f"{sensor_id}: state {code} is not of the form {sensor_id}_<UP|DOWN|SIDEWAYS>_<IN_CORRIDOR|UPPER_BREAKOUT|LOWER_BREAKDOWN>")
        if sensor_id in DERIVED_SENSORS and consolidation_of(code) is None:
            problems.append(f"{sensor_id}: state {code} is not a BULL, BEAR, SIDEWAYS_EQUILIBRIUM or NON_CONSOLIDATED state")
    return problems
