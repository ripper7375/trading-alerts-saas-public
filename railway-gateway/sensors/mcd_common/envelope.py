"""Envelope v1 (``mcd-output/1``): builders, canonical JSON, schema check and the never-throw guard.

Standard section 5 and Appendix B; rules R4 (same inputs -> byte-identical output), R5 (exactly
envelope v1) and R7 (always emit, never throw). Failure is a ``status`` with reason codes from
``reason_codes``, never a state (standard section 6).

The evaluator returns the plain ``dict`` these builders produce. ``evaluated_at`` and run
durations are not part of it: the worker writes them next to the stored row (standard section 5).
"""

from __future__ import annotations

import functools
import json
import logging
import re
from decimal import ROUND_HALF_UP, Decimal
from functools import lru_cache
from pathlib import Path
from typing import Any, Callable, Iterable, Mapping, Sequence

from . import reason_codes as rc
from .cycle_inputs import (
    TIMEFRAMES,
    CycleInputs,
    is_number,
    is_slot,
    last_closed_bar_slots,
    statistics_source,
    thaw,
)

Envelope = dict[str, Any]

SCHEMA_VERSION = "mcd-output/1"
SCHEMA_PATH = Path(__file__).with_name("mcd-output-1.schema.json")

# Top-level key order of the canonical form (the schema's ``required`` list, Appendix B).
TOP_LEVEL_ORDER = (
    "schema_version",
    "mcd_id",
    "evaluator_version",
    "cycle_slot",
    "last_closed_bar",
    "active_indicator",
    "config_hash",
    "status",
    "status_reasons",
    "state_code",
    "regime_status",
    "bias",
    "levels",
    "depends_on",
    "summary_line",
    "commentary",
    "details",
)
LEVEL_ORDER = ("name", "tf", "price", "role")
BIASES = ("LONG", "SHORT", "NEUTRAL", "STAND_ASIDE")
LEVEL_ROLES = ("support", "resistance", "mid")
SUMMARY_MAX_CHARS = 80
STATE_CODE_MAX_CHARS = 48

_LOG = logging.getLogger("mcd")
_FALLBACK_SLOT = "1970-01-01T00:00Z"


# --------------------------------------------------------------------------- numbers


def round2(value: float) -> float:
    """Round half up to 2 decimals on the shortest decimal form of ``value``. Output only (section 11.2)."""
    if not is_number(value):
        raise ValueError(f"cannot round {value!r}")
    rounded = float(Decimal(repr(float(value))).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))
    return 0.0 if rounded == 0 else rounded  # no "-0.0"


# --------------------------------------------------------------------------- builders


def _check_identity(mcd_id: str, evaluator_version: str, cycle_slot: str) -> None:
    if not (isinstance(mcd_id, str) and re.match(r"^MCD([0-9]|1[0-5])$", mcd_id)):
        raise ValueError(f"bad mcd_id {mcd_id!r}")
    if not (isinstance(evaluator_version, str) and re.match(r"^[0-9]+\.[0-9]+\.[0-9]+$", evaluator_version)):
        raise ValueError(f"bad evaluator_version {evaluator_version!r}")
    if not is_slot(cycle_slot):
        raise ValueError(f"bad cycle_slot {cycle_slot!r}")


def _norm_levels(levels: Iterable[Mapping[str, Any]]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for level in levels:
        name, tf, price = level.get("name"), level.get("tf"), level.get("price")
        if not isinstance(name, str) or not name:
            raise ValueError(f"level without a name: {dict(level)!r}")
        if tf not in TIMEFRAMES:
            raise ValueError(f"level {name}: tf must be one of {TIMEFRAMES}, got {tf!r}")
        item: dict[str, Any] = {"name": name, "tf": tf, "price": round2(price)}
        role = level.get("role")
        if role is not None:
            if role not in LEVEL_ROLES:
                raise ValueError(f"level {name}: role must be one of {LEVEL_ROLES}, got {role!r}")
            item["role"] = role
        out.append(item)
    return out


def _check_reasons(reasons: Sequence[str], status: str) -> list[str]:
    """Known codes only; the reasons must be able to explain ``status`` (section 6)."""
    codes = list(reasons)
    statuses = [rc.status_for(code) for code in codes]  # raises on unknown codes
    if status == rc.VALID:
        if codes:
            raise ValueError("a VALID reading has no status_reasons")
    elif status == rc.CAUTIONARY:
        if not codes or any(s != rc.CAUTIONARY for s in statuses):
            raise ValueError(f"CAUTIONARY needs CAUTIONARY reason codes only, got {codes!r}")
    else:
        if status not in statuses:
            raise ValueError(f"{status} needs at least one {status} reason code, got {codes!r}")
    return codes


def _build(
    *,
    mcd_id: str,
    evaluator_version: str,
    cycle_slot: str,
    status: str,
    status_reasons: Sequence[str],
    state_code: str | None,
    bias: str | None,
    regime_status: str | None,
    levels: Iterable[Mapping[str, Any]],
    depends_on: Sequence[str],
    summary_line: str,
    commentary: str,
    details: Mapping[str, Any] | None,
    last_closed_bar: Mapping[str, str] | None,
    active_indicator: Mapping[str, str] | None,
    config_hash: Mapping[str, str] | None,
) -> Envelope:
    _check_identity(mcd_id, evaluator_version, cycle_slot)
    reasons = _check_reasons(status_reasons, status)
    if status in (rc.VALID, rc.CAUTIONARY):
        if not (
            isinstance(state_code, str)
            and state_code.startswith(f"{mcd_id}_")
            and len(state_code) <= STATE_CODE_MAX_CHARS
        ):
            raise ValueError(f"state_code must start with '{mcd_id}_' and stay within {STATE_CODE_MAX_CHARS} chars: {state_code!r}")
        if bias not in BIASES:
            raise ValueError(f"bias must be one of {BIASES}, got {bias!r}")
    else:
        if state_code is not None or bias is not None:
            raise ValueError(f"{status} carries no state_code and no bias")
    level_list = _norm_levels(levels)
    if status in (rc.INVALID, rc.STALE) and level_list:
        raise ValueError(f"{status} carries no levels")
    return {
        "schema_version": SCHEMA_VERSION,
        "mcd_id": mcd_id,
        "evaluator_version": evaluator_version,
        "cycle_slot": cycle_slot,
        "last_closed_bar": dict(last_closed_bar or {}),
        "active_indicator": dict(active_indicator or {}),
        "config_hash": dict(config_hash or {}),
        "status": status,
        "status_reasons": reasons,
        "state_code": state_code,
        "regime_status": regime_status,
        "bias": bias,
        "levels": level_list,
        "depends_on": list(depends_on),
        "summary_line": summary_line,
        "commentary": commentary,
        "details": thaw(details) if details is not None else {},
    }


def valid(
    mcd_id: str,
    evaluator_version: str,
    cycle_slot: str,
    *,
    state_code: str,
    bias: str,
    summary_line: str,
    commentary: str,
    levels: Iterable[Mapping[str, Any]] = (),
    regime_status: str | None = None,
    details: Mapping[str, Any] | None = None,
    last_closed_bar: Mapping[str, str] | None = None,
    active_indicator: Mapping[str, str] | None = None,
    config_hash: Mapping[str, str] | None = None,
    depends_on: Sequence[str] = (),
) -> Envelope:
    return _build(
        mcd_id=mcd_id, evaluator_version=evaluator_version, cycle_slot=cycle_slot, status=rc.VALID,
        status_reasons=(), state_code=state_code, bias=bias, regime_status=regime_status, levels=levels,
        depends_on=depends_on, summary_line=summary_line, commentary=commentary, details=details,
        last_closed_bar=last_closed_bar, active_indicator=active_indicator, config_hash=config_hash,
    )


def cautionary(
    mcd_id: str,
    evaluator_version: str,
    cycle_slot: str,
    status_reasons: Sequence[str],
    *,
    state_code: str,
    bias: str,
    summary_line: str,
    commentary: str,
    levels: Iterable[Mapping[str, Any]] = (),
    regime_status: str | None = None,
    details: Mapping[str, Any] | None = None,
    last_closed_bar: Mapping[str, str] | None = None,
    active_indicator: Mapping[str, str] | None = None,
    config_hash: Mapping[str, str] | None = None,
    depends_on: Sequence[str] = (),
) -> Envelope:
    """A reading that keeps its state, bias and levels but carries reasons the trader is shown."""
    return _build(
        mcd_id=mcd_id, evaluator_version=evaluator_version, cycle_slot=cycle_slot, status=rc.CAUTIONARY,
        status_reasons=status_reasons, state_code=state_code, bias=bias, regime_status=regime_status,
        levels=levels, depends_on=depends_on, summary_line=summary_line, commentary=commentary,
        details=details, last_closed_bar=last_closed_bar, active_indicator=active_indicator,
        config_hash=config_hash,
    )


def _unavailable_texts(status: str, reasons: Sequence[str]) -> tuple[str, str]:
    codes = ", ".join(reasons)
    if status == rc.STALE:
        summary = f"Stale data, no reading: {codes}"
        commentary = f"No market reading this cycle because the inputs are stale. Reason codes: {codes}."
    else:
        summary = f"No reading: {codes}"
        commentary = f"No reading this cycle. Reason codes: {codes}."
    if len(summary) > SUMMARY_MAX_CHARS:
        summary = summary[: SUMMARY_MAX_CHARS - 3] + "..."
    return summary, commentary


def _unavailable(
    status: str,
    mcd_id: str,
    evaluator_version: str,
    cycle_slot: str,
    status_reasons: Sequence[str],
    *,
    last_closed_bar: Mapping[str, str] | None,
    active_indicator: Mapping[str, str] | None,
    config_hash: Mapping[str, str] | None,
    depends_on: Sequence[str],
    summary_line: str | None,
    commentary: str | None,
    details: Mapping[str, Any] | None,
) -> Envelope:
    default_summary, default_commentary = _unavailable_texts(status, status_reasons)
    return _build(
        mcd_id=mcd_id, evaluator_version=evaluator_version, cycle_slot=cycle_slot, status=status,
        status_reasons=status_reasons, state_code=None, bias=None, regime_status=None, levels=(),
        depends_on=depends_on, summary_line=summary_line or default_summary,
        commentary=commentary or default_commentary, details=details, last_closed_bar=last_closed_bar,
        active_indicator=active_indicator, config_hash=config_hash,
    )


def invalid(
    mcd_id: str,
    evaluator_version: str,
    cycle_slot: str,
    status_reasons: Sequence[str],
    *,
    last_closed_bar: Mapping[str, str] | None = None,
    active_indicator: Mapping[str, str] | None = None,
    config_hash: Mapping[str, str] | None = None,
    depends_on: Sequence[str] = (),
    summary_line: str | None = None,
    commentary: str | None = None,
    details: Mapping[str, Any] | None = None,
) -> Envelope:
    return _unavailable(
        rc.INVALID, mcd_id, evaluator_version, cycle_slot, status_reasons, last_closed_bar=last_closed_bar,
        active_indicator=active_indicator, config_hash=config_hash, depends_on=depends_on,
        summary_line=summary_line, commentary=commentary, details=details,
    )


def stale(
    mcd_id: str,
    evaluator_version: str,
    cycle_slot: str,
    status_reasons: Sequence[str],
    *,
    last_closed_bar: Mapping[str, str] | None = None,
    active_indicator: Mapping[str, str] | None = None,
    config_hash: Mapping[str, str] | None = None,
    depends_on: Sequence[str] = (),
    summary_line: str | None = None,
    commentary: str | None = None,
    details: Mapping[str, Any] | None = None,
) -> Envelope:
    return _unavailable(
        rc.STALE, mcd_id, evaluator_version, cycle_slot, status_reasons, last_closed_bar=last_closed_bar,
        active_indicator=active_indicator, config_hash=config_hash, depends_on=depends_on,
        summary_line=summary_line, commentary=commentary, details=details,
    )


def unavailable(status: str, *args: Any, **kwargs: Any) -> Envelope:
    """``invalid`` or ``stale`` chosen by ``status``: for turning a stopped pre-flight into an envelope."""
    if status == rc.INVALID:
        return invalid(*args, **kwargs)
    if status == rc.STALE:
        return stale(*args, **kwargs)
    raise ValueError(f"unavailable() takes INVALID or STALE, got {status!r}")


# --------------------------------------------------------------------------- what was read


def reading_context(inputs: CycleInputs, timeframes: Sequence[str]) -> dict[str, Any]:
    """``last_closed_bar``, ``active_indicator`` and ``config_hash`` for the timeframes an MCD reads.

    Standard section 5 wants these "per timeframe read" and "per source read", not the whole bundle.
    Pass the result to a builder with ``**``. Best effort: it is also used on the failure path, so a
    setting that is missing is simply left out, and bars that cannot be read give an empty
    ``last_closed_bar`` instead of an error.
    """
    settings = inputs.active_indicator if isinstance(inputs.active_indicator, Mapping) else {}
    active = {tf: settings[tf] for tf in timeframes if isinstance(settings.get(tf), str)}
    hashes = inputs.config_hash if isinstance(inputs.config_hash, Mapping) else {}
    used = {statistics_source(name): hashes[statistics_source(name)] for name in active.values() if statistics_source(name) in hashes}
    try:
        closed = last_closed_bar_slots(inputs, timeframes)
    except Exception:  # noqa: BLE001 - failure path: keep going with what can be read
        closed = {}
    return {"last_closed_bar": closed, "active_indicator": active, "config_hash": used}


# --------------------------------------------------------------------------- canonical JSON


def _norm(obj: Any) -> Any:
    if isinstance(obj, Mapping):
        return {str(k): _norm(obj[k]) for k in sorted(obj, key=str)}
    if isinstance(obj, (list, tuple)):
        return [_norm(v) for v in obj]
    if isinstance(obj, float):
        if obj != obj or obj in (float("inf"), float("-inf")):
            raise ValueError("NaN and infinity cannot appear in an envelope")
        return 0.0 if obj == 0 else obj
    return obj


def _canonical_level(level: Mapping[str, Any]) -> dict[str, Any]:
    ordered: dict[str, Any] = {}
    for key in LEVEL_ORDER:
        if key in level:
            value = level[key]
            ordered[key] = round2(value) if key == "price" and is_number(value) else _norm(value)
    for key in sorted(k for k in level if k not in LEVEL_ORDER):
        ordered[key] = _norm(level[key])
    return ordered


def canonical(envelope: Mapping[str, Any]) -> dict[str, Any]:
    """Fixed key order; ``levels`` prices rounded to 2 decimals; ``details`` keys sorted.

    Keys outside the schema are kept (after the known ones, sorted) so the schema check rejects them
    instead of the canonical form hiding them.
    """
    env = thaw(envelope)
    out: dict[str, Any] = {}
    for key in TOP_LEVEL_ORDER:
        if key not in env:
            continue
        value = env[key]
        if key == "levels" and isinstance(value, list) and all(isinstance(v, dict) for v in value):
            out[key] = [_canonical_level(level) for level in value]
        else:
            out[key] = _norm(value)
    for key in sorted(k for k in env if k not in TOP_LEVEL_ORDER):
        out[key] = _norm(env[key])
    return out


def canonical_json(envelope: Mapping[str, Any], *, pretty: bool = False) -> str:
    """The byte-stable text form of an envelope (same envelope -> same text; R4, test T7).

    Compact by default: this is the form the token budget measures and the worker stores.
    ``pretty=True`` indents for files such as ``mcdN_output.json``.
    """
    canon = canonical(envelope)
    if pretty:
        return json.dumps(canon, ensure_ascii=True, indent=2, allow_nan=False) + "\n"
    return json.dumps(canon, ensure_ascii=True, separators=(",", ":"), allow_nan=False)


# --------------------------------------------------------------------------- schema check


@lru_cache(maxsize=1)
def _validator() -> Any:
    from jsonschema import Draft202012Validator

    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    Draft202012Validator.check_schema(schema)
    return Draft202012Validator(schema)


def schema_errors(envelope: Mapping[str, Any]) -> list[str]:
    """Every way ``envelope`` breaks ``mcd-output/1`` (empty list = valid), in a stable order."""
    validator = _validator()
    instance = json.loads(json.dumps(canonical(envelope), allow_nan=False))
    found = sorted(validator.iter_errors(instance), key=lambda e: (list(map(str, e.absolute_path)), e.message))
    return [f"{'/'.join(map(str, e.absolute_path)) or '<root>'}: {e.message}" for e in found]


def assert_valid(envelope: Mapping[str, Any]) -> None:
    errors = schema_errors(envelope)
    if errors:
        raise AssertionError("envelope violates mcd-output/1:\n  " + "\n  ".join(errors))


# --------------------------------------------------------------------------- never throws (R7)


def _safe_slot(inputs: Any) -> str:
    slot = getattr(inputs, "cycle_slot", None)
    return slot if is_slot(slot) else _FALLBACK_SLOT


def never_throws(mcd_id: str, evaluator_version: str) -> Callable[[Callable[..., Envelope]], Callable[..., Envelope]]:
    """Decorator for ``evaluate``: any exception becomes INVALID + ``EVALUATOR_ERROR`` and is logged.

    The worker logs the exception with the slot (standard section 11.2). Only ``Exception`` is
    caught. If the slot itself is unreadable the envelope carries ``1970-01-01T00:00Z`` so it still
    validates.
    """
    _check_identity(mcd_id, evaluator_version, _FALLBACK_SLOT)  # fail at decoration time, not per cycle

    def decorate(evaluate: Callable[..., Envelope]) -> Callable[..., Envelope]:
        @functools.wraps(evaluate)
        def wrapper(inputs: Any, params: Any, upstream: Any) -> Envelope:
            try:
                return evaluate(inputs, params, upstream)
            except Exception:  # noqa: BLE001 - R7: always emit
                slot = _safe_slot(inputs)
                _LOG.exception(
                    "evaluator error", extra={"mcd_id": mcd_id, "cycle_slot": slot}
                )
                return invalid(mcd_id, evaluator_version, slot, [rc.EVALUATOR_ERROR])

        return wrapper

    return decorate
