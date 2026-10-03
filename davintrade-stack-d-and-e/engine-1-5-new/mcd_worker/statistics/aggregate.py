"""From outcomes to a ``state_statistics`` row, and the n >= 30 gate (architecture section 2.8, ADR-022).

One row is one *series*, state and horizon: the MCD, the evaluator's ``MAJOR.MINOR``, the sources' ``config_hash`` as one text, the state
code and the horizon (2 or 12 hours). ``n`` is the number of occurrences of the state in that series that have an outcome at that horizon
(``outcomes.outcome_at``); an occurrence whose bars are not all there is not counted.

**The gate.** Below ``MIN_SAMPLE`` (30) outcomes a row holds ``n`` and no number: ``measured_metrics`` raises ``SampleTooSmall`` for
fewer, ``aggregate_outcomes`` returns every figure as ``None`` for fewer, and the database refuses a row that disagrees
(``state_statistics_n_gate``). A number is therefore always stored beside the ``n`` it came from.

**The figures** (Davin, 2026-10-03, build step 3 plan Q9 b): the median, the first quartile and the third quartile of the forward move, and the
median and the third quartile of the adverse excursion. A quartile is the linear interpolation between the closest ranks (position
``(n - 1) * q`` of the sorted values, "R-7", the same as ``statistics.quantiles(..., method="inclusive")``); the median is the second
quartile. ``opposing_level_rate`` is always ``None``: it needs the levels and stops that build step 4 defines.

**What is not decided here:** which readings of an MCD count as occurrences (a CAUTIONARY reading, a reading made while RETUNING) is the
caller's choice, made when the point-in-time history is replayed (step 3, B4); every occurrence it passes is counted. Consecutive cycles
spent in one state are separate occurrences whose forward windows overlap, so ``n`` counts cycles, not independent episodes.

Pure functions; standard library only.
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, localcontext
from typing import Iterable, Mapping, Sequence

from .outcomes import (
    BIASES,
    HORIZON_BARS,
    UNAVAILABLE_REASONS,
    BarSeries,
    Outcome,
    cap_problems,
    check_bias,
    check_horizon,
    check_slot,
    outcome_at,
)

MIN_SAMPLE = 30  # ADR-022: n >= 30 per state and horizon before a number is quoted
HORIZONS: tuple[int, ...] = tuple(sorted(HORIZON_BARS))  # (2, 12)

# The columns of a row (the keys of ``state_statistics`` the engine owns; ``series_notes`` and the timestamps belong to the writer).
KEY_FIELDS = ("mcd_id", "evaluator_version_series", "config_hash_key", "state_code", "horizon_hours")
METRIC_FIELDS = (
    "forward_move_median",
    "forward_move_q1",
    "forward_move_q3",
    "opposing_level_rate",
    "adverse_excursion_median",
    "adverse_excursion_q3",
)
ROW_FIELDS = KEY_FIELDS + ("n",) + METRIC_FIELDS

_OCCURRENCE_TEXT_KEYS = ("mcd_id", "evaluator_version_series", "config_hash_key", "state_code")


class StatisticsError(ValueError):
    """The occurrences are not something a statistic can be made from. ``problems`` lists the ones found (the first 20, then a count)."""

    def __init__(self, problems: Iterable[str]) -> None:
        self.problems: tuple[str, ...] = cap_problems(problems)
        super().__init__("; ".join(self.problems))


class SampleTooSmall(StatisticsError):
    """A number was asked of fewer than ``MIN_SAMPLE`` outcomes."""

    def __init__(self, n: int) -> None:
        self.n = n
        super().__init__([f"n = {n} is below {MIN_SAMPLE}: no number may be computed"])


def quantile(values: Iterable[Decimal], quarters: int) -> Decimal:
    """The ``quarters``/4 quantile (1 first quartile, 2 median, 3 third quartile) by linear interpolation between closest ranks.

    Position ``(n - 1) * quarters / 4`` of the sorted values; exact, because the fraction is a multiple of one quarter.
    """
    if isinstance(quarters, bool) or quarters not in (1, 2, 3):
        raise ValueError(f"quarters must be 1, 2 or 3, not {quarters!r}")
    ordered = sorted(values)
    if not ordered:
        raise ValueError("a quantile needs at least one value")
    position = (len(ordered) - 1) * quarters
    below, remainder = divmod(position, 4)
    if remainder == 0:
        return ordered[below]
    with localcontext() as context:
        context.prec = 50
        return ordered[below] + Decimal(remainder) / Decimal(4) * (ordered[below + 1] - ordered[below])


def _number(value: Decimal) -> float:
    number = float(value)
    return 0.0 if number == 0 else number  # no negative zero in a stored figure


def measured_metrics(outcomes: Sequence[Outcome]) -> dict[str, float | None]:
    """The five figures of at least ``MIN_SAMPLE`` outcomes. Raises ``SampleTooSmall`` for fewer: the gate."""
    if len(outcomes) < MIN_SAMPLE:
        raise SampleTooSmall(len(outcomes))
    moves = [outcome.forward_move for outcome in outcomes]
    excursions = [outcome.adverse_excursion for outcome in outcomes]
    return {
        "forward_move_median": _number(quantile(moves, 2)),
        "forward_move_q1": _number(quantile(moves, 1)),
        "forward_move_q3": _number(quantile(moves, 3)),
        "opposing_level_rate": None,  # build step 4 defines the levels and the stops it needs
        "adverse_excursion_median": _number(quantile(excursions, 2)),
        "adverse_excursion_q3": _number(quantile(excursions, 3)),
    }


def aggregate_outcomes(outcomes: Sequence[Outcome]) -> dict[str, int | float | None]:
    """``n`` and the six figures of one series, state and horizon: every figure ``None`` unless ``n >= MIN_SAMPLE``."""
    n = len(outcomes)
    metrics: dict[str, float | None] = dict.fromkeys(METRIC_FIELDS)
    if n >= MIN_SAMPLE:
        metrics = measured_metrics(outcomes)
    return {"n": n, **metrics}


@dataclass(frozen=True)
class _Occurrence:
    mcd_id: str
    series: str
    config_hash_key: str
    state_code: str
    bias: str
    slot: int


def _read_occurrences(occurrences: Iterable[Mapping[str, object]]) -> list[_Occurrence]:
    """Every occurrence checked; ``StatisticsError`` names the problems (every one, up to the cap). Only the six documented keys are read."""
    problems: list[str] = []
    read: list[_Occurrence] = []
    for position, raw in enumerate(occurrences):
        where = f"occurrence {position}"
        if not isinstance(raw, Mapping):
            problems.append(f"{where}: not a mapping")
            continue
        text: dict[str, str] = {}
        for key in _OCCURRENCE_TEXT_KEYS:
            value = raw.get(key)
            if isinstance(value, str) and value:
                text[key] = value
            else:
                problems.append(f"{where}: {key} must be a non-empty string")
        checked: dict[str, object] = {}
        for key, check in (("bias", check_bias), ("slot", check_slot)):
            try:
                checked[key] = check(raw.get(key))
            except ValueError as error:
                problems.append(f"{where}: {error}")
        if len(text) == len(_OCCURRENCE_TEXT_KEYS) and len(checked) == 2:
            read.append(
                _Occurrence(
                    text["mcd_id"], text["evaluator_version_series"], text["config_hash_key"], text["state_code"], checked["bias"], checked["slot"]
                )
            )
    if problems:
        raise StatisticsError(problems)
    return read


def compute_state_statistics(
    occurrences: Iterable[Mapping[str, object]],
    bars: BarSeries | Iterable[Mapping[str, object]],
    horizons: Iterable[int] = HORIZONS,
) -> dict[str, object]:
    """Rows of ``state_statistics`` from state occurrences and the closed M5 bars that follow them.

    An occurrence is a mapping with ``mcd_id``, ``evaluator_version_series`` (``MAJOR.MINOR``), ``config_hash_key`` (the sources'
    ``config_hash`` as one canonical text), ``state_code``, ``bias`` and ``slot`` (unix UTC seconds). Occurrences are grouped by
    ``(mcd_id, evaluator_version_series, config_hash_key, state_code)``: a different version series or a different ``config_hash_key``
    is a different series and is never mixed in, which is how a retuned source or a MINOR change starts a new series. One group has
    one bias and one reading per slot, or ``StatisticsError`` is raised: a median over mixed signs would mean nothing.

    Returns ``{"rows": [...], "occurrences": int, "unavailable": {reason: count}}``. ``rows`` holds one row per group and horizon, with
    the keys of ``ROW_FIELDS``, sorted by key; ``unavailable`` counts the (occurrence, horizon) pairs that had no outcome, by reason.
    """
    wanted = sorted({check_horizon(h) for h in horizons})
    series = bars if isinstance(bars, BarSeries) else BarSeries(bars)
    read = _read_occurrences(occurrences)

    groups: dict[tuple[str, str, str, str], list[_Occurrence]] = {}
    for occurrence in read:
        key = (occurrence.mcd_id, occurrence.series, occurrence.config_hash_key, occurrence.state_code)
        groups.setdefault(key, []).append(occurrence)

    problems: list[str] = []
    seen_slots: dict[tuple[str, str, str, int], str] = {}
    for key, members in groups.items():
        label = f"{key[0]} {key[3]} (series {key[1]})"
        biases = sorted({m.bias for m in members}, key=BIASES.index)
        if len(biases) > 1:
            problems.append(f"{label} has more than one bias: {', '.join(biases)}")
        for member in members:
            slot_key = (member.mcd_id, member.series, member.config_hash_key, member.slot)
            if slot_key in seen_slots:
                other = seen_slots[slot_key]
                problems.append(f"{member.mcd_id} slot {member.slot} (series {member.series}) is read twice: as {other} and as {member.state_code}")
            seen_slots[slot_key] = member.state_code
    if problems:
        raise StatisticsError(problems)

    unavailable = dict.fromkeys(UNAVAILABLE_REASONS, 0)
    rows: list[dict[str, object]] = []
    for key in sorted(groups):
        for horizon in wanted:
            outcomes: list[Outcome] = []
            for member in groups[key]:
                result = outcome_at(series, member.slot, member.bias, horizon)
                if isinstance(result, Outcome):
                    outcomes.append(result)
                else:
                    unavailable[result.reason] += 1
            rows.append(
                {
                    "mcd_id": key[0],
                    "evaluator_version_series": key[1],
                    "config_hash_key": key[2],
                    "state_code": key[3],
                    "horizon_hours": horizon,
                    **aggregate_outcomes(outcomes),
                }
            )
    return {"rows": rows, "occurrences": len(read), "unavailable": unavailable}
