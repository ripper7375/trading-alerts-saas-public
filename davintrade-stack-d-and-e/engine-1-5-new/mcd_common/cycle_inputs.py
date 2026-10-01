"""The frozen input bundle (``CycleInputs``), the parameter set (``Params``) and shared helpers.

Standard section 4 and 11.2; walkthrough Part B2. An evaluator never queries a database or reads a
file: the sensor worker (or the Excel fixture provider, in tests) builds one ``CycleInputs`` per
cycle and hands it over. The same bundle can come from live tables, from point-in-time history or
from a test fixture, which is what makes replay byte-identical (R4).

This module also holds what both providers and the pre-flight helpers must agree on: slot and grid
arithmetic, the channel-indicator catalogue and the closed-bar rule.
"""

from __future__ import annotations

import calendar
import datetime as _dt
import re
from dataclasses import dataclass
from types import MappingProxyType
from typing import Any, Mapping, Sequence

# --------------------------------------------------------------------------- time and grid

TIMEFRAMES = ("M5", "M15")
TF_SECONDS: Mapping[str, int] = MappingProxyType({"M5": 300, "M15": 900})
SLOT_SECONDS = 300  # the cycle key is the 5-minute slot (rule 1)
DATA_STATUSES = ("FRESH", "DELAYED", "STALE", "MARKET_CLOSED")  # the values of ``data_status`` (rule 7)

_SLOT_RE = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:[0-5][05]Z$")
_MCD_ID_RE = re.compile(r"^MCD([0-9]|1[0-5])$")
_VERSION_RE = re.compile(r"^[0-9]+\.[0-9]+\.[0-9]+$")


def is_number(value: object) -> bool:
    """True for a real number (bool excluded, NaN excluded)."""
    return (
        isinstance(value, (int, float))
        and not isinstance(value, bool)
        and value == value  # NaN != NaN
        and value not in (float("inf"), float("-inf"))
    )


def is_slot(value: object) -> bool:
    return isinstance(value, str) and _SLOT_RE.match(value) is not None


def slot_to_epoch(slot: str) -> int:
    """``"2026-09-18T20:55Z"`` -> unix seconds (UTC)."""
    if not is_slot(slot):
        raise ValueError(f"not an ISO 8601 UTC slot (YYYY-MM-DDTHH:MMZ, minute a multiple of 5): {slot!r}")
    parsed = _dt.datetime.strptime(slot, "%Y-%m-%dT%H:%MZ")
    return calendar.timegm(parsed.timetuple())


def epoch_to_slot(epoch: int | float) -> str:
    """Unix seconds -> ``"YYYY-MM-DDTHH:MMZ"``. The instant must lie on the 5-minute grid."""
    if not is_number(epoch) or int(epoch) != epoch or int(epoch) % SLOT_SECONDS:
        raise ValueError(f"not a 5-minute-grid instant: {epoch!r}")
    return _dt.datetime.fromtimestamp(int(epoch), _dt.timezone.utc).strftime("%Y-%m-%dT%H:%MZ")


def floor_epoch(epoch: int, timeframe: str) -> int:
    """Floor an instant to the start of the timeframe's grid (M5: every 5 min, M15: :00 :15 :30 :45)."""
    length = TF_SECONDS[timeframe]
    return int(epoch) - int(epoch) % length


def stats_slot_for(cycle_slot: str, timeframe: str) -> str:
    """The slot at which ``timeframe`` was last collected, for a cycle slot (rules 1 and 5).

    M5 is collected every slot; M15 on :00, :15, :30 and :45, so at 20:55 the M15 statistics were
    captured at 20:45. Both providers use this function; only the Excel provider may tolerate a
    replica's export-slot stamp (decision E1) and it does so in its own module.
    """
    return epoch_to_slot(floor_epoch(slot_to_epoch(cycle_slot), timeframe))


def bar_is_closed(bar_open_epoch: int, timeframe: str, cycle_slot: str) -> bool:
    """Rule 2: a bar is closed when its open time plus its period is at or before the slot."""
    return int(bar_open_epoch) + TF_SECONDS[timeframe] <= slot_to_epoch(cycle_slot)


# --------------------------------------------------------------------------- freezing


def freeze(obj: Any) -> Any:
    """Deep read-only view: mappings become ``MappingProxyType``, lists become tuples.

    A ``MappingProxyType`` is not trusted: it may wrap lists or dicts that are still mutable, or a
    dict the caller still holds. Its contents are frozen and copied like those of any other mapping.
    """
    if isinstance(obj, Mapping):
        return MappingProxyType({k: freeze(v) for k, v in obj.items()})
    if isinstance(obj, (list, tuple)):
        return tuple(freeze(v) for v in obj)
    return obj


def thaw(obj: Any) -> Any:
    """Inverse of ``freeze``, for JSON and for building modified copies in tests."""
    if isinstance(obj, Mapping):
        return {k: thaw(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [thaw(v) for v in obj]
    return obj


# --------------------------------------------------------------------------- channel catalogue

# Candidate channel indicators per timeframe (mcd1.md section 2: 7 centroid variants on M15;
# mcd2 tier 1: 8 EDT indicators on M5). Any one of them can be the active indicator, chosen by the
# setting (rule 6), so no MCD may assume a particular one.
CENTROID_CANDIDATES = (
    "best_fit_a",
    "best_fit_b",
    "cherry_a",
    "cherry_b",
    "most_recent",
    "non_a",
    "non_b",
)
CANDIDATES: Mapping[str, tuple[str, ...]] = MappingProxyType(
    {"M15": CENTROID_CANDIDATES, "M5": CENTROID_CANDIDATES + ("fractal",)}
)


def statistics_source(indicator: str) -> str:
    """The ``indicator_statistics.source`` for an active indicator (``fractal`` -> ``fractal_edt``)."""
    return "fractal_edt" if indicator == "fractal" else indicator


def channel_columns(indicator: str) -> Mapping[str, str]:
    """``market_data_v6`` column names of one candidate: ``upper``, ``lower``, ``baseline``, ``fit``."""
    if indicator == "fractal":
        return {
            "upper": "fractal_uoedt",
            "lower": "fractal_loedt",
            "baseline": "fractal_best_fl",
            "fit": "fractal_best_fl",
        }
    return {
        "upper": f"{indicator}_uoedt",
        "lower": f"{indicator}_loedt",
        "baseline": f"{indicator}_base_fl",
        "fit": f"{indicator}_ssa",
    }


def is_populated(bar: Mapping[str, Any], indicator: str) -> bool:
    """True when the candidate has a channel on this bar (fit line and both bands are numbers)."""
    cols = channel_columns(indicator)
    upper, lower, fit = bar.get(cols["upper"]), bar.get(cols["lower"]), bar.get(cols["fit"])
    return is_number(upper) and is_number(lower) and is_number(fit) and upper > 0


# --------------------------------------------------------------------------- the bundle


@dataclass(frozen=True)
class CycleInputs:
    """Everything one evaluation may read. Deeply read-only after construction.

    Fields are those of walkthrough Part B2 plus ``stats_slot`` (decision E1, 2026-09-30).
    """

    symbol: str
    """``"XAUUSD"``."""
    cycle_slot: str
    """The cycle, ISO 8601 UTC, e.g. ``"2026-09-18T20:55Z"`` (rule 1)."""
    data_status: str
    """``FRESH`` | ``DELAYED`` | ``STALE`` | ``MARKET_CLOSED`` (rule 7). Any other value is a provider
    bug: the cycle check ends the reading as INVALID + ``SANITY_FAILED``."""
    retuning: bool
    """A promote is in progress (rule 9)."""
    bars: Mapping[str, tuple[Mapping[str, Any], ...]]
    """``{"M5": (...), "M15": (...)}``: closed bars, ascending; keys are ``market_data_v6`` column
    names (rule 2). Use ``closed_bars`` to read them: it also drops any bar not closed at the slot."""
    statistics: Mapping[tuple[str, str], Mapping[str, Any]]
    """``{("M15", "non_b"): row}``: the ``indicator_statistics`` row captured at ``stats_slot`` for
    that timeframe, live-bar fields removed. A missing key means no row at the slot (rule 5)."""
    stats_slot: Mapping[str, str]
    """Per timeframe, the slot at which it was last collected (ISO 8601 UTC). Tier 4 compares each
    row's ``captured_at`` with it, so a row from another slot is STALE, never "latest available"."""
    active_indicator: Mapping[str, str]
    """The setting per timeframe (rule 6): ``{"M5": "best_fit_a", "M15": "non_b"}``."""
    config_hash: Mapping[str, str]
    """Per statistics source, from ``indicator_configs``."""
    channel_mode: Mapping[str, str]
    """Per statistics source: ``"dynamic"`` | ``"frozen"`` (architecture section 1.6)."""

    def __post_init__(self) -> None:
        for name in ("bars", "statistics", "stats_slot", "active_indicator", "config_hash", "channel_mode"):
            object.__setattr__(self, name, freeze(getattr(self, name)))

    # JSON form: statistics are nested {tf: {source: row}} because JSON keys must be strings.
    def to_dict(self) -> dict[str, Any]:
        stats: dict[str, dict[str, Any]] = {}
        for (tf, source), row in self.statistics.items():
            stats.setdefault(tf, {})[source] = thaw(row)
        return {
            "symbol": self.symbol,
            "cycle_slot": self.cycle_slot,
            "data_status": self.data_status,
            "retuning": self.retuning,
            "bars": thaw(self.bars),
            "statistics": stats,
            "stats_slot": thaw(self.stats_slot),
            "active_indicator": thaw(self.active_indicator),
            "config_hash": thaw(self.config_hash),
            "channel_mode": thaw(self.channel_mode),
        }

    @classmethod
    def from_dict(cls, data: Mapping[str, Any]) -> "CycleInputs":
        statistics = {
            (tf, source): row for tf, sources in data["statistics"].items() for source, row in sources.items()
        }
        return cls(
            symbol=data["symbol"],
            cycle_slot=data["cycle_slot"],
            data_status=data["data_status"],
            retuning=data["retuning"],
            bars=data["bars"],
            statistics=statistics,
            stats_slot=data["stats_slot"],
            active_indicator=data["active_indicator"],
            config_hash=data["config_hash"],
            channel_mode=data["channel_mode"],
        )


def closed_bars(inputs: CycleInputs, timeframe: str) -> tuple[Mapping[str, Any], ...]:
    """The bars of ``timeframe`` that are closed at the cycle slot, in the order given (rule 2).

    Evaluators read bars through this function, so a forming bar in the bundle changes nothing
    (test T4). Bars without a numeric ``timestamp`` are skipped here; the tier-2 check reports them.
    """
    length = TF_SECONDS[timeframe]
    slot = slot_to_epoch(inputs.cycle_slot)
    return tuple(
        bar
        for bar in inputs.bars.get(timeframe, ())
        if is_number(bar.get("timestamp")) and bar["timestamp"] + length <= slot
    )


def last_closed_bar_slots(inputs: CycleInputs, timeframes: Sequence[str]) -> dict[str, str]:
    """``{"M5": "2026-09-18T20:50Z"}``: open time of the last closed bar per timeframe, for the envelope."""
    out: dict[str, str] = {}
    for tf in timeframes:
        bars = closed_bars(inputs, tf)
        if bars:
            out[tf] = epoch_to_slot(bars[-1]["timestamp"])
    return out


# --------------------------------------------------------------------------- parameters


@dataclass(frozen=True)
class Params:
    """One MCD's parameters, from ``mcdN_params.yaml`` (standard Appendix C.3).

    ``params["name"]`` returns the value. Every parameter must carry value, unit, boundary and why
    (checklist A20); ``meta`` keeps the last three for documentation and reviews.
    """

    mcd_id: str
    evaluator_version: str
    values: Mapping[str, Any]
    meta: Mapping[str, Mapping[str, Any]]

    def __post_init__(self) -> None:
        object.__setattr__(self, "values", freeze(self.values))
        object.__setattr__(self, "meta", freeze(self.meta))

    def __getitem__(self, name: str) -> Any:
        return self.values[name]

    def get(self, name: str, default: Any = None) -> Any:
        return self.values.get(name, default)

    @classmethod
    def from_dict(cls, data: Mapping[str, Any]) -> "Params":
        mcd_id, version = data.get("mcd_id"), data.get("evaluator_version")
        if not isinstance(mcd_id, str) or not _MCD_ID_RE.match(mcd_id):
            raise ValueError(f"params: bad mcd_id {mcd_id!r}")
        if not isinstance(version, str) or not _VERSION_RE.match(version):
            raise ValueError(f"params: bad evaluator_version {version!r} (need MAJOR.MINOR.PATCH)")
        raw = data.get("parameters")
        if not isinstance(raw, Mapping) or not raw:
            raise ValueError("params: 'parameters' must be a non-empty mapping")
        values: dict[str, Any] = {}
        meta: dict[str, dict[str, Any]] = {}
        for name, entry in raw.items():
            if not isinstance(entry, Mapping) or "value" not in entry:
                raise ValueError(f"params: parameter {name!r} needs value, unit, boundary and why")
            missing = [k for k in ("unit", "boundary", "why") if not str(entry.get(k, "")).strip()]
            if missing:
                raise ValueError(f"params: parameter {name!r} is missing {', '.join(missing)}")
            values[name] = entry["value"]
            meta[name] = {k: entry[k] for k in ("unit", "boundary", "why")}
        return cls(mcd_id=mcd_id, evaluator_version=version, values=values, meta=meta)

    @classmethod
    def from_yaml(cls, path: str) -> "Params":
        """Load a parameters file. For workers and tests, never called from inside an evaluator."""
        import yaml  # local import: evaluators that only receive a ``Params`` never need it

        with open(path, "r", encoding="utf-8") as handle:
            return cls.from_dict(yaml.safe_load(handle))
