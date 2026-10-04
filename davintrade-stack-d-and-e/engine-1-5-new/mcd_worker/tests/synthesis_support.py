"""Shared support for the synthesis tests (build step 4, part 1): the real rules against the real registry, and readings of
sensors built through the kit so they are well formed.

``cycle(MCD1=..., MCD2=..., MCD3=...)`` builds the readings a cycle hands to synthesis. A value is
    a state code                       VALID reading of that state,
    ``(state, status)``                the reading with that status (CAUTIONARY gets the MCD0 defect reason of its timeframe),
    ``(state, status, reasons)``       the same with the reason codes given,
    ``("-", "INVALID" | "STALE")``     an unusable reading,
    ``None``                           no reading at all (the sensor is absent).
"""

from __future__ import annotations

import copy
from decimal import Decimal
from functools import lru_cache
from typing import Any, Mapping

from mcd_common import envelope as env
from mcd_common import reason_codes as rc

from mcd_worker.registry import ENGINE_DIR, Registry, load_registry
from mcd_worker.synthesis import DEFAULT_RULES_VERSION, Rules, load_rules, vocabulary_from_registry
from mcd_worker.synthesis.rules import RULES_DIR, SensorVocabulary
from mcd_worker.synthesis.zones import ZONE_PARAMS_PATH, Level, ZoneParams, build_entry_zones, load_zone_params

SLOT = "2026-09-18T20:55Z"
DAY, SCALPER = "DAY_TRADER", "SCALPER"
PROFILES = (DAY, SCALPER)
DRAFT_1_PATH = RULES_DIR / f"{DEFAULT_RULES_VERSION}.yaml"

_DEFECT_OF = {"MCD1": [rc.MCD0_DEFECT_M15], "MCD2": [rc.MCD0_DEFECT_M5], "MCD3": [rc.MCD0_DEFECT_M5, rc.MCD0_DEFECT_M15]}


@lru_cache(maxsize=1)
def registry() -> Registry:
    return load_registry(ENGINE_DIR)


@lru_cache(maxsize=1)
def vocabulary() -> dict[str, SensorVocabulary]:
    return vocabulary_from_registry(registry())


@lru_cache(maxsize=1)
def rules() -> Rules:
    return load_rules(vocabulary=vocabulary())


def rules_text() -> str:
    return DRAFT_1_PATH.read_text(encoding="utf-8")


def states(mcd_id: str) -> tuple[str, ...]:
    return tuple(registry()[mcd_id].states)


def envelope(mcd_id: str, state: str, status: str = rc.VALID, reasons: list[str] | None = None) -> dict[str, Any]:
    """An envelope of ``mcd_id`` for ``state``, built through the kit (so it validates), with the register's bias and regime word."""
    sensor = registry()[mcd_id]
    common = dict(depends_on=sensor.depends_on)
    if status in (rc.INVALID, rc.STALE):
        default = [rc.SANITY_FAILED] if status == rc.INVALID else [rc.NO_STATS_AT_SLOT]
        build = env.invalid if status == rc.INVALID else env.stale
        return env.canonical(build(mcd_id, sensor.evaluator_version, SLOT, reasons or default, **common))
    entry = sensor.states[state]
    fields = dict(state_code=state, bias=entry.bias, regime_status=entry.regime_status, summary_line="reading", commentary="reading", **common)
    if status == rc.CAUTIONARY:
        return env.canonical(env.cautionary(mcd_id, sensor.evaluator_version, SLOT, reasons or _DEFECT_OF[mcd_id], **fields))
    return env.canonical(env.valid(mcd_id, sensor.evaluator_version, SLOT, **fields))


def cycle(**readings: Any) -> dict[str, dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    for mcd_id, spec in readings.items():
        if spec is None:
            continue
        if isinstance(spec, str):
            out[mcd_id] = envelope(mcd_id, spec)
        else:
            state, status, *rest = spec
            out[mcd_id] = envelope(mcd_id, state, status, list(rest[0]) if rest else None)
    return out


def unchanged(readings: Mapping[str, Any]) -> Mapping[str, Any]:
    """A deep copy to compare against after a call, to show the call did not change what it was given."""
    return copy.deepcopy(dict(readings))


# --------------------------------------------------------------------------- zones (build step 4, part 2)


@lru_cache(maxsize=1)
def zone_params() -> ZoneParams:
    return load_zone_params()


def zone_params_text() -> str:
    return ZONE_PARAMS_PATH.read_text(encoding="utf-8")


def level(name: str, tf: str, price: Any, origin: str = "MCD2") -> Level:
    return Level(name=name, tf=tf, price=Decimal(str(price)), origin=origin)


def channel(tf: str, uoedt: Any, baseline: Any, loedt: Any, origin: str | None = None) -> list[Level]:
    """The three lines of a channel as the sensors' envelopes give them (M5 is MCD2's, M15 is MCD1's unless ``origin`` says otherwise)."""
    origin = origin or ("MCD2" if tf == "M5" else "MCD1")
    return [level("UOEDT", tf, uoedt, origin), level("baseline", tf, baseline, origin), level("LOEDT", tf, loedt, origin)]


def sr(name: str, price: Any, tf: str = "M15") -> Level:
    return level(name, tf, price, "sr_levels" if int(name[3:]) <= 8 else "sr2_levels")


def zones(bias: str, levels: list[Level], p_ref: Any, params: ZoneParams | None = None):
    return build_entry_zones(bias, levels, Decimal(str(p_ref)), params or zone_params())
