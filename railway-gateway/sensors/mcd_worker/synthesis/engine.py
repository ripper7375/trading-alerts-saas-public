"""The synthesis engine: sensor readings in, one decision per trader type out (architecture 3.2, 3.3; ADR-025, ADR-026, ADR-029).

``decide`` is a pure function of a rules version, a trader type and the sensors' readings of one cycle. It reads no clock, no file
and no database, and it never raises on odd input: a reading it cannot use is an unavailable sensor, and an unavailable sensor can
only fail to match (Davin's decision D1 (b)).

What it does, in this order, for one trader type (``Rules.rules_for`` keeps the file's order):

1. **Views.** Each synthesis sensor (MCD1 to MCD3) becomes a ``SensorView``: its status, its facts, its reason codes and the hash of
   its envelope. A sensor that was not handed over is ``ABSENT``; one whose status is INVALID or STALE is left out of every
   condition except a test of its ``status``.
2. **First match.** Rows run top to bottom; inside a row the branches run in file order, except that a ``primary_first`` row tries the
   branches of the trader type's primary sensor first (D1 (c): when MCD1 and MCD2 disagree, the primary sensor decides). The first
   branch whose conditions all hold decides: rules decide the direction, never the model (ADR-025), and a lower rung never
   overrides a higher one because the file's order is the ladder (ADR-029).
3. **MCD3 modifies, it never votes** (ADR-029, D1 (e)). It is consulted only for a LONG or SHORT result: the first modifier whose
   conditions hold adds its text, and ``caution`` also makes the result CAUTIONARY.
4. **Caution is inherited** (3.3 mechanic 4, decision D3). The result is CAUTIONARY when any sensor the matched branch read, or MCD3
   when a modifier applied, is CAUTIONARY, and it carries those sensors' reason codes (an MCD0 defect, RETUNING, ...) but not the
   ``UPSTREAM_CAUTIONARY:<id>`` echoes of a derived sensor (Davin, 2026-10-04), which repeat what the upstream sensor says: they stay only when nothing
   else explains the caution. A cycle where no row matched is NEUTRAL, and counts every available sensor as read.
5. **No match** is recorded, never hidden: NEUTRAL, rule id ``NO_MATCH``, and ``inputs`` holds every sensor's state (3.3 mechanic 5).

A stand-aside because the primary sensor has no usable reading takes the status of why: STALE with ``UPSTREAM_STALE:<id>`` or INVALID
with ``UPSTREAM_UNAVAILABLE:<id>``, and still says STAND_ASIDE.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from typing import Any, Mapping

from mcd_common import envelope as env
from mcd_common import reason_codes as rc

from . import facts as fx
from .rules import NO_MATCH_ID, PRIMARY, Branch, Modifier, Rule, Rules

MODIFIER_CAUTION = "MODIFIER_CAUTION"
ECHO_PREFIX = "UPSTREAM_CAUTIONARY:"  # the kit's code for "a sensor I read is CAUTIONARY" (a derived sensor says it for each upstream one)


# --------------------------------------------------------------------------- views


@dataclass(frozen=True)
class SensorView:
    """One sensor's reading as synthesis sees it."""

    sensor: str
    status: str  # VALID | CAUTIONARY | INVALID | STALE | ABSENT
    state_code: str | None
    regime_status: str | None
    bias: str | None
    status_reasons: tuple[str, ...]
    envelope_sha256: str | None
    facts: Mapping[str, Any]

    @property
    def available(self) -> bool:
        return self.status in fx.AVAILABLE_STATUSES

    def input_record(self) -> dict[str, Any]:
        """What the SYN reading keeps of this sensor (``inputs``): enough to find the sensor row and to log a gap."""
        return {
            "status": self.status,
            "state_code": self.state_code,
            "regime_status": self.regime_status,
            "bias": self.bias,
            "envelope_sha256": self.envelope_sha256,
        }


def _absent(sensor: str) -> SensorView:
    return SensorView(sensor, fx.ABSENT, None, None, None, (), None, fx.facts_of(sensor, fx.ABSENT, None, None, None))


def _unusable(sensor: str, status: str, sha: str | None = None) -> SensorView:
    return SensorView(sensor, status, None, None, None, (), sha, fx.facts_of(sensor, status, None, None, None))


def view_of(sensor: str, reading: Any) -> SensorView:
    """The view of one sensor. Anything that is not a well-formed envelope is ABSENT or INVALID, never an error."""
    if not isinstance(reading, Mapping):
        return _absent(sensor)
    status = reading.get("status")
    if status not in rc.STATUSES:
        return _unusable(sensor, rc.INVALID)
    try:
        sha = hashlib.sha256(env.canonical_json(reading).encode("utf-8")).hexdigest()
    except Exception:  # noqa: BLE001 - an envelope that cannot be written canonically cannot be stored either
        return _unusable(sensor, rc.INVALID)
    if status not in fx.AVAILABLE_STATUSES:
        return _unusable(sensor, status, sha)
    state, regime, bias = reading.get("state_code"), reading.get("regime_status"), reading.get("bias")
    if not isinstance(state, str) or bias not in fx.BIASES or not (regime is None or isinstance(regime, str)):
        return _unusable(sensor, rc.INVALID, sha)
    reasons = reading.get("status_reasons")
    codes = tuple(c for c in reasons if isinstance(c, str)) if isinstance(reasons, (list, tuple)) else ()
    return SensorView(sensor, status, state, regime, bias, codes, sha, fx.facts_of(sensor, status, state, regime, bias))


def views_of(rules: Rules, readings: Mapping[str, Any]) -> dict[str, SensorView]:
    """A view for each sensor of the rules, in the order the rules list them. Readings of other MCDs are ignored."""
    return {sensor: view_of(sensor, readings.get(sensor)) for sensor in rules.sensors}


# --------------------------------------------------------------------------- the decision


@dataclass(frozen=True)
class Decision:
    rule_id: str
    branch_id: str | None
    bias: str
    archetype: str | None
    trend_relation: str | None
    reasons: tuple[str, ...]  # fixed English texts: the branch's, then the modifier's
    summary: str
    status: str  # VALID | CAUTIONARY | INVALID | STALE
    status_reasons: tuple[str, ...]
    sensors_read: tuple[str, ...]
    modifier_id: str | None
    inputs: Mapping[str, Mapping[str, Any]]

    @property
    def stand_aside(self) -> bool:
        return self.bias == "STAND_ASIDE"


def _holds(branch: Branch, views: Mapping[str, SensorView], primary: str) -> bool:
    for condition in branch.when:
        view = views.get(primary if condition.sensor == PRIMARY else condition.sensor)
        if view is None or view.facts.get(condition.fact) not in condition.values:
            return False
    return True


def _ordered(rule: Rule, primary: str) -> tuple[Branch, ...]:
    if not rule.primary_first:
        return rule.branches
    return tuple(sorted(rule.branches, key=lambda b: 0 if b.sensor == primary else 1))  # stable: file order within each group


def _modifier_for(rules: Rules, rule: Rule, bias: str, views: Mapping[str, SensorView]) -> Modifier | None:
    """The modifier that applies to a result, or ``None``. The loader keeps every modifier's ``bias`` to LONG and SHORT, so a result that is
    neither never gets one."""
    for modifier in rules.modifiers:
        view = views.get(modifier.sensor)
        if view is None or not view.available:
            continue
        if modifier.rules is not None and rule.id not in modifier.rules:
            continue
        if bias not in modifier.bias:
            continue
        if all(view.facts.get(c.fact) in c.values for c in modifier.when):
            return modifier
    return None


def _carried(views: Mapping[str, SensorView], read: tuple[str, ...], extra: str | None) -> tuple[str, tuple[str, ...]]:
    """The status and reason codes the result inherits from the sensors it read (D3).

    A derived sensor (MCD3) lists ``UPSTREAM_CAUTIONARY:<id>`` for each sensor it read that was CAUTIONARY. Those codes only echo what the
    upstream sensor says in its own codes, so they are left out (Davin, 2026-10-04) unless nothing else explains the caution: a CAUTIONARY
    reading must always say why (the schema requires it), and then the echoes are the reason.
    """
    codes: list[str] = []
    echoes: list[str] = []
    cautionary = False
    for sensor in read:
        view = views[sensor]
        if view.status == rc.CAUTIONARY:
            cautionary = True
            for code in view.status_reasons:
                bucket = echoes if code.startswith(ECHO_PREFIX) else codes
                if code not in bucket:
                    bucket.append(code)
    if extra is not None:
        cautionary = True
        codes.append(extra)
    if cautionary and not codes:
        codes = echoes
    return (rc.CAUTIONARY, tuple(codes)) if cautionary else (rc.VALID, ())


def decide(rules: Rules, profile: str, readings: Mapping[str, Any]) -> Decision:
    """One trader type's decision for one cycle. ``readings`` maps an MCD id to its final envelope (after MCD0 inheritance)."""
    primary = rules.primary_sensor[profile]
    views = views_of(rules, readings)
    inputs = {sensor: view.input_record() for sensor, view in views.items()}
    for rule in rules.rules_for(profile):
        for branch in _ordered(rule, primary):
            if not _holds(branch, views, primary):
                continue
            result = branch.result
            if result.data_stand_aside:
                unavailable = views[primary]
                stale = unavailable.status == rc.STALE
                code = rc.upstream_stale(primary) if stale else rc.upstream_unavailable(primary)
                return Decision(
                    rule_id=rule.id, branch_id=branch.id, bias=result.bias, archetype=None, trend_relation=None,
                    reasons=result.reasons, summary=result.summary, status=rc.STALE if stale else rc.INVALID,
                    status_reasons=(code,), sensors_read=(primary,), modifier_id=None, inputs=inputs,
                )
            read = list(branch.sensors_read(primary))
            reasons = list(result.reasons)
            modifier = _modifier_for(rules, rule, result.bias, views)
            extra: str | None = None
            if modifier is not None:
                reasons.append(modifier.text)
                if modifier.sensor not in read:
                    read.append(modifier.sensor)
                if modifier.effect == "caution":
                    extra = f"{MODIFIER_CAUTION}:{views[modifier.sensor].state_code}"
            read_sorted = tuple(s for s in fx.SENSORS if s in read)
            status, codes = _carried(views, read_sorted, extra)
            return Decision(
                rule_id=rule.id, branch_id=branch.id, bias=result.bias, archetype=result.archetype,
                trend_relation=result.trend_relation, reasons=tuple(reasons), summary=result.summary, status=status,
                status_reasons=codes, sensors_read=read_sorted, modifier_id=modifier.id if modifier else None, inputs=inputs,
            )
    available = tuple(s for s in fx.SENSORS if s in views and views[s].available)
    status, codes = _carried(views, available, None)
    no_match = rules.no_match
    return Decision(
        rule_id=NO_MATCH_ID, branch_id=None, bias=no_match.bias, archetype=None, trend_relation=None,
        reasons=no_match.reasons, summary=no_match.summary, status=status, status_reasons=codes,
        sensors_read=available, modifier_id=None, inputs=inputs,
    )
