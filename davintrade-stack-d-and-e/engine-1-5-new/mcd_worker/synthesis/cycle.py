"""One cycle of synthesis: the sensors' readings in, two SYN readings and their entry zones out (build step 4 part 3; architecture 2.2, 3.1; ADR-027).

``Synthesizer.run`` is what the cycle runner calls right after the last MCD of the cycle, in the same process (ADR-027: synthesis runs in the sensor
worker, same cycle). It is a pure function of the readings it is given and the bundle: the Day Trader and the Scalper decision (``engine.decide``), the entry
zones of each (``zones.build_entry_zones``), the two guards (the reading's, and ``zone_problems`` for every zone), and the text and hash of what may be saved.

What it never does: change a sensor's reading, read anything but its arguments and its two files (the rules file and the zone parameters), or raise: the
runner turns an unexpected exception into a result with ``error`` set and no readings, so a bug here can only cost the SYN rows of one cycle.

**Refusal rules.** A reading that fails a guard is not saved (``reading_json`` is ``None``) and its zones are not saved either, because a zone is only
meaningful beside the reading that names it. Zones that fail ``zone_problems`` are dropped on their own and the reading is made with ``zones: []``;
both are listed in ``guard_problems`` so the measurement kit can count them. A cycle that gives no zones is not a failure: ``zones_reason`` says why
(``NOT_DIRECTIONAL``, ``NO_REFERENCE_PRICE``, ``NO_ZONE_SOURCES``) and Report 1 can say it too.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Mapping

from mcd_common.cycle_inputs import CycleInputs

from .engine import decide
from .reading import SynReading, make_reading
from .rules import DEFAULT_RULES_VERSION, PROFILES, Rules, load_rules, vocabulary_from_registry
from .zones import (
    ZoneParams,
    ZoneSet,
    build_entry_zones,
    levels_from_readings,
    load_zone_params,
    reference_close,
    rows_json,
    sr_levels_from_context,
    zone_problems,
)

ZONES_REFUSED = "ZONES_REFUSED"  # a zone failed its guard: none are kept
READING_REFUSED = "READING_REFUSED"  # the reading failed its guard: its zones are not kept either
SYNTHESIS_ERROR = "SYNTHESIS_ERROR"


def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


@dataclass(frozen=True)
class ProfileResult:
    """One trader type's reading of the cycle and its zones, as they are saved (``synthesis_readings`` and ``entry_zones``, parts 4 and 5)."""

    profile: str
    reading: SynReading
    zone_set: ZoneSet
    zones_json: str  # the compact text of the zone rows that are kept (``"[]"`` when none): what is stored and hashed
    guard_problems: tuple[str, ...]  # why a reading or some zones were refused; never put in the reading

    @property
    def saved(self) -> bool:
        """Whether the reading may be saved."""
        return self.reading.ok

    def to_dict(self) -> dict[str, Any]:
        return {
            "profile": self.profile,
            "reading_json": self.reading.canonical_json if self.saved else None,
            "reading_sha256": self.reading.sha256 if self.saved else None,
            "zones_json": self.zones_json,
            "zones_sha256": sha256_text(self.zones_json),
            "zones_reason": self.zone_set.reason,
            "guard_problems": list(self.guard_problems),
        }


@dataclass(frozen=True)
class SynthesisResult:
    """What synthesis made of one cycle. ``to_dict`` is the part of the runner's result that two runs of one bundle must agree on, byte for byte."""

    flag: str  # shadow | live: the SYN flag when it ran (``off`` never gets here)
    rules_version: str
    rules_sha256: str
    zones_version: str
    zones_sha256: str
    reference_price: float | None  # the close of the last closed M5 bar (D4), or ``None``
    profiles: tuple[ProfileResult, ...]
    error: str | None = None  # ``SYNTHESIS_ERROR`` when an unexpected exception stopped it: then there are no profiles

    def to_dict(self) -> dict[str, Any]:
        return {
            "flag": self.flag,
            "rules_version": self.rules_version,
            "rules_sha256": self.rules_sha256,
            "zones_version": self.zones_version,
            "zones_sha256": self.zones_sha256,
            "reference_price": self.reference_price,
            "error": self.error,
            "readings": [profile.to_dict() for profile in self.profiles],
        }


class Synthesizer:
    """The rules and the zone parameters of a worker, ready to run cycles. Building one reads and checks both files (``ConfigError`` lists every problem)."""

    def __init__(self, rules: Rules, params: ZoneParams) -> None:
        self.rules = rules
        self.params = params

    @classmethod
    def load(
        cls,
        registry: Mapping[str, Any],
        *,
        rules_version: str = DEFAULT_RULES_VERSION,
        rules_dir: str | Path | None = None,
        params_path: str | Path | None = None,
    ) -> "Synthesizer":
        """The rules ``rules/<rules_version>.yaml`` checked against the registry's state words, and ``zone_params.yaml``."""
        rules = load_rules(rules_version, vocabulary=vocabulary_from_registry(registry), directory=rules_dir)
        return cls(rules, load_zone_params(params_path))

    def _result(self, flag: str, p_ref: Any, profiles: tuple[ProfileResult, ...], error: str | None = None) -> SynthesisResult:
        return SynthesisResult(
            flag=flag,
            rules_version=self.rules.version,
            rules_sha256=self.rules.sha256,
            zones_version=self.params.version,
            zones_sha256=self.params.sha256,
            reference_price=None if p_ref is None else float(p_ref),
            profiles=profiles,
            error=error,
        )

    def failed(self, flag: str) -> SynthesisResult:
        """The result of a cycle in which synthesis raised: no readings, and ``error`` says so."""
        return self._result(flag, None, (), SYNTHESIS_ERROR)

    def run(self, flag: str, readings: Mapping[str, Any], inputs: CycleInputs) -> SynthesisResult:
        """Both trader types for one cycle. ``readings`` maps an MCD id to its final envelope: the caller decides which sensors synthesis may see."""
        p_ref = reference_close(inputs)
        levels = levels_from_readings(readings) + sr_levels_from_context(inputs.context_levels)
        profiles: list[ProfileResult] = []
        for profile in PROFILES:
            decision = decide(self.rules, profile, readings)
            zone_set = build_entry_zones(decision.bias, levels, p_ref, self.params)
            problems = [f"ZONES: {z['zone_id']}: {p}" for z in zone_set.to_dicts() for p in zone_problems(z, self.params)]
            if problems:  # a zone that is not consistent is never saved, and the reading then names none
                zone_set = ZoneSet(zone_set.bias, zone_set.reference_price, (), ZONES_REFUSED, zone_set.zones_version, zone_set.zones_sha256)
            reading = make_reading(
                self.rules, profile, decision, cycle_slot=inputs.cycle_slot, data_status=inputs.data_status, zones=zone_set.ids
            )
            if not reading.ok:  # a zone only means something beside its reading
                zone_set = ZoneSet(zone_set.bias, zone_set.reference_price, (), READING_REFUSED, zone_set.zones_version, zone_set.zones_sha256)
            profiles.append(
                ProfileResult(
                    profile=profile,
                    reading=reading,
                    zone_set=zone_set,
                    zones_json=rows_json(zone_set.rows(profile, inputs.cycle_slot)),
                    guard_problems=(*reading.problems, *problems),
                )
            )
        return self._result(flag, p_ref, tuple(profiles))
