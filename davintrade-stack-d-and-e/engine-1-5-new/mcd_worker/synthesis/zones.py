"""The entry-zone builder (architecture 3.6; ADR-030 to ADR-034; decisions D4 to D7 of the step 4 plan).

From the sensors' levels, the reference price and a LONG or SHORT bias it makes the zones a trader may enter in: where they are, how much room
there is behind them (the invalidation) and in front of them (the runway), and in which order they come. A pure function: the same levels, the
same price and the same parameters give the same zones to the cent. Prices are exact decimals; a float is only what a zone is written as.

**The reference price** (D4) is the close of the last closed M5 bar, as architecture 2.8 uses for forward moves: not the labelled last price (the
bar still forming), which is not in the bundle and whose availability is an open question.

**The levels.** *Zone sources* are the M5 channel levels of the sensors (UOEDT, baseline, LOEDT: the timing channel, D6) that lie strictly on the
bias side of the reference price (D7 (d): a level equal to it is on neither side). *Structure* is every level there is: the M5 and M15 channel
levels of the available sensors and the support and resistance levels `sr_1` to `sr_16` (D5, ADR-030). Structure serves three roles and makes no
zone of its own: it is the "next structural level" the invalidation sits behind, the "opposing level" the runway runs to, and confluence when it falls inside
a zone. An `sr_*` level has no channel, hence no half-width; M15 levels follow the same rules as `sr_*` (D6: "M15 as structure").

**Zones.** Each source gives its level plus and minus 10% of its channel's width (ADR-031), rounded half up to cents; zones that overlap or touch
merge. A merged zone's reference price is its member level nearest the price (the highest for LONG, the lowest for SHORT; D7 (b)) and its range is
the union. Its **confluence** is the number of distinct structure levels inside the range, edges included (the members among them).

**Invalidation** (ADR-032, D7 (a)): $0.50 beyond the nearest structure level strictly past the zone (below its low for LONG, above its high for SHORT).
The stop distance is measured from the reference price and is never under $13: when the nearest level gives less, or there is none, the invalidation
is exactly $13 from the reference price (not the next level); the basis says which.

**Runway** (D7 (e)): the distance from the reference price to the nearest structure level strictly beyond it on the far side from the entry; the
**runway ratio** is that distance over the stop distance, to two decimals. With no such level the runway and the ratio are empty and the zone ranks
first on that key (unlimited room). A level between the reference price and the zone's far edge is therefore both confluence and the opposing
level: the conservative reading, which keeps a resistance just above the entry from being walked through.

**Rank** (3.6 step 5, D7 (f)): confluence, then the runway ratio as stored (rounded), then the distance of the reference price from the price. At
most five are kept; zone `Zn` is the nth. Decision D7 (f) adds "then the lower price" for a full tie; it can never apply, because the reference prices of
distinct zones on one side of the price are distinct, so their distances differ.

Stand-aside, no match and every other non-directional bias build no zones (3.6: "Stand-aside means no zones").
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, replace
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path
from typing import Any, Iterable, Mapping, Sequence

import yaml

from mcd_common.cycle_inputs import TIMEFRAMES, CycleInputs, closed_bars

from ..errors import ConfigError
from . import facts as fx
from .engine import view_of
from .rules import Checker, StrictLoader, document_sha256

ZONE_PARAMS_SCHEMA = "synthesis-zone-params/1"
ZONE_PARAMS_PATH = Path(__file__).with_name("zone_params.yaml")
DIRECTIONAL = ("LONG", "SHORT")
CHANNEL_TF = "M5"  # the timing channel: where zones are made (D6)

BASIS_LEVEL = "LEVEL"  # the invalidation sits $0.50 beyond a structure level
BASIS_MINIMUM = "MINIMUM_STOP"  # the nearest level was closer than the minimum stop: raised to it
BASIS_NO_LEVEL = "NO_LEVEL"  # no structure level past the zone: the minimum stop
BASES = (BASIS_LEVEL, BASIS_MINIMUM, BASIS_NO_LEVEL)

NOT_DIRECTIONAL = "NOT_DIRECTIONAL"
NO_REFERENCE_PRICE = "NO_REFERENCE_PRICE"
NO_ZONE_SOURCES = "NO_ZONE_SOURCES"

ZONE_ORDER = (
    "zone_id",
    "rank",
    "bias",
    "low",
    "high",
    "reference_price",
    "source_sensors",
    "source_levels",
    "confluence_levels",
    "confluence_count",
    "invalidation_price",
    "invalidation_basis",
    "invalidation_level",
    "stop_distance",
    "next_opposing_level",
    "runway",
    "runway_ratio",
)
ROW_ORDER = ("cycle_slot", "profile", "zones_version", "zones_sha256", *ZONE_ORDER)
LEVEL_ORDER = ("name", "tf", "price", "origin")

_SR_NAME = re.compile(r"sr_([1-9]|1[0-6])")


# --------------------------------------------------------------------------- numbers


def to_decimal(value: Any) -> Decimal | None:
    """An exact decimal from an int or a float's shortest text, or ``None`` for anything else (a bool, NaN, a string)."""
    if isinstance(value, bool) or not isinstance(value, (int, float, Decimal)):
        return None
    number = Decimal(repr(value)) if isinstance(value, float) else Decimal(value)
    return number if number.is_finite() else None


def quantize(value: Decimal, places: int) -> Decimal:
    return value.quantize(Decimal(1).scaleb(-places), rounding=ROUND_HALF_UP)


# --------------------------------------------------------------------------- the parameters


@dataclass(frozen=True)
class ZoneParams:
    version: str
    status: str
    approved: str
    sha256: str
    half_width_fraction: Decimal
    invalidation_buffer: Decimal
    min_stop_distance: Decimal
    max_zones: int
    price_decimals: int
    ratio_decimals: int


# name -> (integer?, the allowed range in words, the test)
_PARAMETERS: Mapping[str, tuple[bool, str, Any]] = {
    "half_width_fraction": (False, "above 0 and at most 1", lambda v: 0 < v <= 1),
    "invalidation_buffer": (False, "0 or more", lambda v: v >= 0),
    "min_stop_distance": (False, "above 0", lambda v: v > 0),
    "max_zones": (True, "1 to 5 (zone ids are Z1 to Z5)", lambda v: 1 <= v <= 5),
    "price_decimals": (True, "0 to 4", lambda v: 0 <= v <= 4),
    "ratio_decimals": (True, "0 to 4", lambda v: 0 <= v <= 4),
}
_ENTRY_KEYS = ("value", "unit", "boundary", "why")


def parse_zone_params(text: str) -> ZoneParams:
    """Read and check a zone parameter file. Raises ``ConfigError`` listing every problem."""
    chk = Checker()
    try:
        document = yaml.load(text, Loader=StrictLoader)  # noqa: S506 - the strict loader is a SafeLoader
    except yaml.YAMLError as exc:
        raise ConfigError(f"the zone parameter file is not valid YAML: {exc}") from exc
    top = chk.mapping(document, "zone parameters", ("schema", "zones_version", "status", "approved", "parameters"))
    if top is None:
        raise ConfigError(chk.problems)
    if top.get("schema") != ZONE_PARAMS_SCHEMA:
        chk.add("schema", f"must be {ZONE_PARAMS_SCHEMA!r}, got {top.get('schema')!r}")
    version = top.get("zones_version")
    if not (isinstance(version, str) and re.fullmatch(r"zones-[0-9]+", version)):
        chk.add("zones_version", f"must look like zones-1, got {version!r}")
    status = top.get("status")
    if status not in ("draft", "approved"):
        chk.add("status", f"must be draft or approved, got {status!r}")
    approved = chk.text(top.get("approved"), "approved")

    values: dict[str, Any] = {}
    entries = chk.mapping(top.get("parameters"), "parameters", _PARAMETERS)
    if entries is not None:
        for name, (integer, allowed, ok) in _PARAMETERS.items():
            entry = chk.mapping(entries.get(name), f"parameters.{name}", _ENTRY_KEYS)
            if entry is None:
                continue
            for key in ("unit", "boundary", "why"):
                chk.text(entry.get(key), f"parameters.{name}.{key}")
            raw = entry.get("value")
            number = to_decimal(raw)
            if number is None or (integer and (isinstance(raw, float) or number != number.to_integral_value())):
                chk.add(f"parameters.{name}.value", f"must be {'a whole number' if integer else 'a number'}, got {raw!r}")
            elif not ok(number):
                chk.add(f"parameters.{name}.value", f"must be {allowed}, got {raw!r}")
            else:
                values[name] = int(number) if integer else number

    try:
        sha = document_sha256(document)
    except (TypeError, ValueError) as exc:
        chk.add("zone parameters", f"holds something that is not plain data ({exc}); quote dates and numbers")
        sha = ""
    if chk.problems or approved is None or not isinstance(version, str) or not isinstance(status, str):
        raise ConfigError(chk.problems or "the zone parameter file is incomplete")
    return ZoneParams(version=version, status=status, approved=approved, sha256=sha, **values)


def load_zone_params(path: str | Path | None = None) -> ZoneParams:
    target = Path(path or ZONE_PARAMS_PATH)
    try:
        text = target.read_text(encoding="utf-8")
    except OSError as exc:
        raise ConfigError(f"cannot read the zone parameter file {target}: {exc}") from exc
    return parse_zone_params(text)


# --------------------------------------------------------------------------- the levels


@dataclass(frozen=True)
class Level:
    name: str
    tf: str
    price: Decimal
    origin: str  # the sensor (MCD1 to MCD3) that gave a channel level, or sr_levels / sr2_levels

    def to_dict(self) -> dict[str, Any]:
        return {"name": self.name, "tf": self.tf, "price": float(self.price), "origin": self.origin}

    @property
    def is_channel(self) -> bool:
        return self.origin in fx.SENSORS


def _level(raw: Any, origin: str) -> Level | None:
    if not isinstance(raw, Mapping):
        return None
    name, tf, price = raw.get("name"), raw.get("tf"), to_decimal(raw.get("price"))
    if not (isinstance(name, str) and name and tf in TIMEFRAMES and price is not None and price > 0):
        return None
    return Level(name=name, tf=tf, price=price, origin=origin)


def _dedupe(levels: Iterable[Level]) -> list[Level]:
    """The first of every level that appears twice (MCD3 repeats the levels of MCD1 and MCD2). Order kept."""
    seen: set[tuple[str, str, Decimal]] = set()
    out: list[Level] = []
    for level in levels:
        key = (level.tf, level.name, level.price)
        if key not in seen:
            seen.add(key)
            out.append(level)
    return out


def levels_from_readings(readings: Mapping[str, Any]) -> list[Level]:
    """The channel levels of every available sensor (VALID or CAUTIONARY), in sensor order, each level once."""
    out: list[Level] = []
    for sensor in fx.SENSORS:
        reading = readings.get(sensor)
        if not view_of(sensor, reading).available:
            continue
        raw_levels = reading.get("levels")
        for raw in raw_levels if isinstance(raw_levels, (list, tuple)) else ():
            level = _level(raw, sensor)
            if level is not None:
                out.append(level)
    return _dedupe(out)


def sr_levels_from_context(context: Any) -> list[Level]:
    """The support and resistance levels of the bundle's ``context_levels``: ``{"M5": {"sr_1": 4369.57, "sr_2": None, ...}, "M15": {...}}``.

    A slot that resolved no level is ``None`` and gives nothing. The same slot at the same price on both timeframes is one level.
    """
    if not isinstance(context, Mapping):
        return []
    out: list[Level] = []
    seen: set[tuple[str, Decimal]] = set()
    for tf in TIMEFRAMES:
        row = context.get(tf)
        if not isinstance(row, Mapping):
            continue
        for name in sorted((n for n in row if isinstance(n, str) and _SR_NAME.fullmatch(n)), key=lambda n: int(n[3:])):
            price = to_decimal(row[name])
            if price is None or price <= 0 or (name, price) in seen:
                continue
            seen.add((name, price))
            out.append(Level(name=name, tf=tf, price=price, origin="sr_levels" if int(name[3:]) <= 8 else "sr2_levels"))
    return out


def reference_close(inputs: CycleInputs) -> Decimal | None:
    """The close of the last closed M5 bar of the bundle (D4), or ``None`` when there is none or it is not a positive number."""
    bars = closed_bars(inputs, CHANNEL_TF)
    if not bars:
        return None
    last = max(bars, key=lambda b: b["timestamp"])
    price = to_decimal(last.get("close"))
    return price if price is not None and price > 0 else None


# --------------------------------------------------------------------------- the zones


@dataclass(frozen=True)
class Zone:
    zone_id: str
    rank: int
    bias: str
    low: Decimal
    high: Decimal
    reference_price: Decimal
    source_levels: tuple[Level, ...]
    confluence_levels: tuple[Level, ...]
    invalidation_price: Decimal
    invalidation_basis: str
    invalidation_level: Level | None
    stop_distance: Decimal
    next_opposing_level: Level | None
    runway: Decimal | None
    runway_ratio: Decimal | None

    @property
    def confluence_count(self) -> int:
        return len(self.confluence_levels)

    @property
    def source_sensors(self) -> tuple[str, ...]:
        return tuple(sorted({level.origin for level in self.source_levels}))

    def to_dict(self) -> dict[str, Any]:
        def number(value: Decimal | None) -> float | None:
            return None if value is None else float(value)

        def level(value: Level | None) -> dict[str, Any] | None:
            return None if value is None else value.to_dict()

        return {
            "zone_id": self.zone_id,
            "rank": self.rank,
            "bias": self.bias,
            "low": number(self.low),
            "high": number(self.high),
            "reference_price": number(self.reference_price),
            "source_sensors": list(self.source_sensors),
            "source_levels": [lv.to_dict() for lv in self.source_levels],
            "confluence_levels": [lv.to_dict() for lv in self.confluence_levels],
            "confluence_count": self.confluence_count,
            "invalidation_price": number(self.invalidation_price),
            "invalidation_basis": self.invalidation_basis,
            "invalidation_level": level(self.invalidation_level),
            "stop_distance": number(self.stop_distance),
            "next_opposing_level": level(self.next_opposing_level),
            "runway": number(self.runway),
            "runway_ratio": number(self.runway_ratio),
        }


@dataclass(frozen=True)
class ZoneSet:
    bias: str | None
    reference_price: Decimal | None
    zones: tuple[Zone, ...]
    reason: str | None  # why there are no zones; ``None`` when there are some
    zones_version: str
    zones_sha256: str

    @property
    def ids(self) -> list[str]:
        """The zone ids in rank order: what a SYN reading's ``zones`` holds."""
        return [zone.zone_id for zone in self.zones]

    def to_dicts(self) -> list[dict[str, Any]]:
        return [zone.to_dict() for zone in self.zones]

    def rows(self, profile: str, cycle_slot: str) -> list[dict[str, Any]]:
        """One row per zone as ``entry_zones`` will hold it (architecture 3.6): the slot, the trader type and the parameters' version first."""
        head = {"cycle_slot": cycle_slot, "profile": profile, "zones_version": self.zones_version, "zones_sha256": self.zones_sha256}
        return [{**head, **zone.to_dict()} for zone in self.zones]


def rows_json(rows: Sequence[Mapping[str, Any]]) -> str:
    """The byte-stable text of a list of zone rows: compact, ASCII, the keys in ``ROW_ORDER``."""
    return json.dumps([_ordered(row) for row in rows], ensure_ascii=True, separators=(",", ":"))


def _ordered(row: Mapping[str, Any]) -> dict[str, Any]:
    out = {key: row[key] for key in ROW_ORDER if key in row}
    out.update({str(key): row[key] for key in sorted(row, key=str) if key not in ROW_ORDER})
    return out


def _empty(reason: str, bias: Any, p_ref: Decimal | None, params: ZoneParams) -> ZoneSet:
    return ZoneSet(bias if bias in DIRECTIONAL else None, p_ref, (), reason, params.version, params.sha256)


def _widths(structure: Sequence[Level]) -> dict[tuple[str, str], Decimal]:
    """The width of each channel (UOEDT minus LOEDT) by sensor and timeframe, for the channels that have both lines and a positive width."""
    lines: dict[tuple[str, str], dict[str, Decimal]] = {}
    for level in structure:
        if level.is_channel and level.name in ("UOEDT", "LOEDT"):
            lines.setdefault((level.origin, level.tf), {})[level.name] = level.price
    return {key: pair["UOEDT"] - pair["LOEDT"] for key, pair in lines.items() if len(pair) == 2 and pair["UOEDT"] > pair["LOEDT"]}


def _nearest(candidates: Sequence[Level], *, highest: bool) -> Level | None:
    """The candidate with the highest (or lowest) price; among equal prices the first by timeframe and name, so the choice is fixed."""
    if not candidates:
        return None
    best = max(c.price for c in candidates) if highest else min(c.price for c in candidates)
    return sorted((c for c in candidates if c.price == best), key=lambda c: (c.tf, c.name, c.origin))[0]


def build_entry_zones(bias: Any, levels: Iterable[Level], p_ref: Decimal | None, params: ZoneParams) -> ZoneSet:
    """The entry zones for a bias, the levels of the cycle and the reference price, best first. Never raises on odd input."""
    if bias not in DIRECTIONAL:
        return _empty(NOT_DIRECTIONAL, bias, p_ref, params)
    if p_ref is None or p_ref <= 0:
        return _empty(NO_REFERENCE_PRICE, bias, None, params)
    long = bias == "LONG"
    places = params.price_decimals
    structure = _dedupe(replace(level, price=quantize(level.price, places)) for level in levels)  # prices are in cents (D7 (c))
    widths = _widths(structure)

    # zone sources: the M5 channel levels strictly on the bias side that belong to a channel with a width
    sources = [
        level
        for level in structure
        if level.tf == CHANNEL_TF
        and (level.price < p_ref if long else level.price > p_ref)
        and (level.origin, level.tf) in widths  # only a sensor's channel has a width: a support or resistance level never is a source
    ]
    if not sources:
        return _empty(NO_ZONE_SOURCES, bias, p_ref, params)

    spans = sorted(
        (
            (level.price - half, level.price + half, level)
            for level in sources
            for half in [quantize(params.half_width_fraction * widths[(level.origin, level.tf)], places)]
        ),
        key=lambda s: (s[0], s[2].price, s[2].name),
    )
    groups: list[list[Any]] = []  # [low, high, members]
    for low, high, level in spans:
        if groups and low <= groups[-1][1]:  # overlapping or touching: one zone
            groups[-1][1] = max(groups[-1][1], high)
            groups[-1][2].append(level)
        else:
            groups.append([low, high, [level]])

    built: list[Zone] = []
    for low, high, members in groups:
        reference = max(m.price for m in members) if long else min(m.price for m in members)
        inside = tuple(sorted((lv for lv in structure if low <= lv.price <= high), key=lambda lv: (lv.price, lv.tf, lv.name, lv.origin)))

        past = _nearest([lv for lv in structure if (lv.price < low if long else lv.price > high)], highest=long)
        basis, level_used = BASIS_NO_LEVEL, None
        invalidation = reference - params.min_stop_distance if long else reference + params.min_stop_distance
        if past is not None:
            level_used = past
            from_level = past.price - params.invalidation_buffer if long else past.price + params.invalidation_buffer
            if (reference - from_level if long else from_level - reference) >= params.min_stop_distance:
                basis, invalidation = BASIS_LEVEL, from_level
            else:
                basis = BASIS_MINIMUM
        invalidation = quantize(invalidation, places)
        stop = abs(reference - invalidation)

        opposing = _nearest([lv for lv in structure if (lv.price > reference if long else lv.price < reference)], highest=not long)
        runway = None if opposing is None else abs(opposing.price - reference)
        ratio = None if runway is None else quantize(runway / stop, params.ratio_decimals)

        built.append(
            Zone(
                zone_id="", rank=0, bias=bias, low=low, high=high, reference_price=reference,
                source_levels=tuple(sorted(members, key=lambda m: (m.price, m.name))), confluence_levels=inside,
                invalidation_price=invalidation, invalidation_basis=basis, invalidation_level=level_used, stop_distance=stop,
                next_opposing_level=opposing, runway=runway, runway_ratio=ratio,
            )
        )

    def key(zone: Zone) -> tuple[Any, ...]:
        ratio_key = (0, Decimal(0)) if zone.runway_ratio is None else (1, -zone.runway_ratio)  # no opposing level: the most room, first
        # every zone is on the same side of the price and no two share a reference price (zones with one would have merged), so their distances
        # from the price differ: the order is total after these three keys and D7 (f)'s last tie-break, the lower price, can never apply
        return (-zone.confluence_count, ratio_key, abs(zone.reference_price - p_ref))

    ranked = sorted(built, key=key)[: params.max_zones]
    numbered = tuple(
        Zone(**{**zone.__dict__, "zone_id": f"Z{index}", "rank": index}) for index, zone in enumerate(ranked, start=1)
    )
    return ZoneSet(bias, p_ref, numbered, None, params.version, params.sha256)


# --------------------------------------------------------------------------- the guard


def _places(value: Any) -> int | None:
    number = to_decimal(value)
    if number is None:
        return None
    exponent = number.normalize().as_tuple().exponent
    return -exponent if isinstance(exponent, int) and exponent < 0 else 0


def zone_problems(zone: Any, params: ZoneParams) -> list[str]:
    """Every way a zone (as ``Zone.to_dict`` writes it, or as a row holds it) is not consistent with itself and with the parameters. Never raises."""
    if not isinstance(zone, Mapping):
        return [f"the zone is a {type(zone).__name__}, not a mapping"]
    missing = [k for k in ZONE_ORDER if k not in zone]
    if missing:
        return [f"missing keys: {', '.join(missing)}"]
    problems: list[str] = []
    num = {k: to_decimal(zone[k]) for k in ("low", "high", "reference_price", "invalidation_price", "stop_distance")}
    bad = [k for k, v in num.items() if v is None or v <= 0]
    if bad:
        return [f"not a positive number: {', '.join(bad)}"]
    low, high, ref, inv, stop = (num[k] for k in ("low", "high", "reference_price", "invalidation_price", "stop_distance"))
    if not (isinstance(zone["rank"], int) and not isinstance(zone["rank"], bool) and 1 <= zone["rank"] <= params.max_zones):
        problems.append(f"rank {zone['rank']!r} is not 1 to {params.max_zones}")
    elif zone["zone_id"] != f"Z{zone['rank']}":
        problems.append(f"zone_id {zone['zone_id']!r} is not Z{zone['rank']}")
    if zone["bias"] not in DIRECTIONAL:
        problems.append(f"bias {zone['bias']!r} is not LONG or SHORT")
    for key in ("low", "high", "reference_price", "invalidation_price", "stop_distance"):
        if (_places(zone[key]) or 0) > params.price_decimals:
            problems.append(f"{key} has more than {params.price_decimals} decimals")
    if not low <= ref <= high:
        problems.append("the reference price is not inside the zone")
    long = zone["bias"] == "LONG"
    if zone["bias"] in DIRECTIONAL and not (inv < ref if long else inv > ref):
        problems.append("the invalidation is not on the far side of the reference price")
    if stop != abs(ref - inv):
        problems.append("the stop distance is not the distance from the reference price to the invalidation")
    if stop < params.min_stop_distance:
        problems.append(f"the stop distance is under {params.min_stop_distance}")
    basis, level = zone["invalidation_basis"], zone["invalidation_level"]
    if basis not in BASES:
        problems.append(f"invalidation_basis {basis!r} is not one of {', '.join(BASES)}")
    elif basis == BASIS_NO_LEVEL and level is not None:
        problems.append("a zone with no structure level past it names one")
    elif basis != BASIS_NO_LEVEL and level is None:
        problems.append(f"{basis} names no structure level")
    if basis in (BASIS_MINIMUM, BASIS_NO_LEVEL) and stop != params.min_stop_distance:
        problems.append("a raised stop is not exactly the minimum")
    if basis == BASIS_LEVEL and isinstance(level, Mapping):
        price = to_decimal(level.get("price"))
        if price is not None and inv != price - params.invalidation_buffer * (1 if long else -1):
            problems.append("the invalidation is not exactly the buffer beyond its level")
    count, levels = zone["confluence_count"], zone["confluence_levels"]
    if not isinstance(levels, list) or count != len(levels) or count < 1:
        problems.append("confluence_count is not the number of confluence levels, or is under 1")
    runway, ratio, opposing = to_decimal(zone["runway"]), to_decimal(zone["runway_ratio"]), zone["next_opposing_level"]
    if opposing is None:
        if zone["runway"] is not None or zone["runway_ratio"] is not None:
            problems.append("a zone with no opposing level has a runway")
    else:
        price = to_decimal(opposing.get("price")) if isinstance(opposing, Mapping) else None
        if price is None or runway is None or ratio is None:
            problems.append("an opposing level needs a runway and a ratio")
        else:
            if not (price > ref if long else price < ref):
                problems.append("the opposing level is not beyond the reference price")
            if runway != abs(price - ref):
                problems.append("the runway is not the distance to the opposing level")
            if ratio != quantize(runway / stop, params.ratio_decimals):
                problems.append("the runway ratio is not the runway over the stop distance")
    return problems
