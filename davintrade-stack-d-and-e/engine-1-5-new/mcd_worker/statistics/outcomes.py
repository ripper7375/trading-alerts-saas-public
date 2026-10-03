"""What price did after one occurrence of a state: the forward move and the adverse excursion (architecture section 2.8).

The arithmetic is Davin's decision of 2026-10-03 (build step 3, plan Q9 b):

* **Reference price** ``P_ref``: the close of the last closed M5 bar at the slot ``T``, that is the bar opened at ``T - 300``.
* **Horizon** ``H``: 2 h is 24 M5 bars, 12 h is 144. ``P_horizon`` is the close of the ``H``-th bar after the reference bar, the bar that
  closes at ``T + H``. The excursion window is those ``H`` bars: ``[T, T + H]``. The reference bar itself is in the past and is not in it.
* **Forward move** (price units, USD per ounce): LONG ``P_horizon - P_ref``, SHORT ``P_ref - P_horizon`` (positive is favourable for
  the bias); NEUTRAL and STAND_ASIDE the raw ``P_horizon - P_ref``.
* **Adverse excursion** (price units, never negative): LONG ``max(0, P_ref - min(low))``, SHORT ``max(0, max(high) - P_ref)``;
  NEUTRAL and STAND_ASIDE ``max(|P_ref - min(low)|, |max(high) - P_ref|)``.

What the decision did not say, and what is built (hand-off, decision 1): an outcome exists only when **every** M5 bar from the
reference bar to the horizon bar is present. A market closure or a hole in the history leaves the occurrence without an outcome at that
horizon; it is not stretched to "24 bars later". The occurrence is then not counted in ``n`` (``Unavailable``, with the reason).

All arithmetic is exact: a price is read as the decimal it prints as (``Decimal(repr(x))``), so ``4010.12 - 4005.37`` is ``4.75`` and the
stored numbers carry no binary-float noise. Pure functions; the caller passes closed bars only.
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, localcontext
from types import MappingProxyType
from typing import Iterable, Mapping

BAR_SECONDS = 300  # one M5 bar
HORIZON_BARS: Mapping[int, int] = MappingProxyType({2: 24, 12: 144})  # horizon in hours -> M5 bars (Scalper 2 h, Day Trader 12 h)
BIASES = ("LONG", "SHORT", "NEUTRAL", "STAND_ASIDE")

NO_REFERENCE_BAR = "NO_REFERENCE_BAR"  # the bar opened at T - 300 is not in the history
NO_HORIZON_BAR = "NO_HORIZON_BAR"  # the bar that closes at T + H is not in the history (the history ends, or the market was closed)
GAP_IN_WINDOW = "GAP_IN_WINDOW"  # the horizon bar exists but a bar between is missing (a closure or a hole)
UNAVAILABLE_REASONS = (NO_REFERENCE_BAR, NO_HORIZON_BAR, GAP_IN_WINDOW)

_ZERO = Decimal(0)


MAX_PROBLEMS_LISTED = 20


def cap_problems(problems: Iterable[str]) -> tuple[str, ...]:
    """The first ``MAX_PROBLEMS_LISTED`` problems and a count of the rest: a systematic fault must not print 26,000 lines."""
    listed = list(problems)
    if len(listed) <= MAX_PROBLEMS_LISTED:
        return tuple(listed)
    return (*listed[:MAX_PROBLEMS_LISTED], f"... and {len(listed) - MAX_PROBLEMS_LISTED} more")


class BarsError(ValueError):
    """The bars cannot be trusted (a bad value, a bar out of order). ``problems`` lists the ones found (the first 20, then a count)."""

    def __init__(self, problems: Iterable[str]) -> None:
        self.problems: tuple[str, ...] = cap_problems(problems)
        super().__init__("; ".join(self.problems))


def to_decimal(value: object) -> Decimal:
    """A real number as the decimal it prints as. ``bool``, NaN and the infinities are refused (``ValueError``)."""
    if isinstance(value, bool) or not isinstance(value, (int, float, Decimal)):
        raise ValueError(f"not a number: {value!r}")
    if isinstance(value, float):
        if value != value or value in (float("inf"), float("-inf")):
            raise ValueError(f"not a finite number: {value!r}")
        return Decimal(repr(value))
    if isinstance(value, Decimal) and not value.is_finite():
        raise ValueError(f"not a finite number: {value!r}")
    return Decimal(value)


@dataclass(frozen=True)
class Bar:
    timestamp: int  # the open time, unix UTC
    high: Decimal
    low: Decimal
    close: Decimal


class BarSeries:
    """Closed M5 bars, indexed by open time. Built once and shared by every occurrence.

    A bar is a mapping with ``timestamp`` (unix UTC seconds, the open time, on the 5-minute grid), ``high``, ``low`` and ``close``
    (other keys are ignored: the history may carry ``open`` and ``volume``). Bars must be strictly ascending, prices positive,
    ``low <= close <= high``. A bar that breaks any of that raises ``BarsError`` naming every offender: a statistic over bad
    prices is worse than none.
    """

    def __init__(self, bars: Iterable[Mapping[str, object]]) -> None:
        problems: list[str] = []
        index: dict[int, Bar] = {}
        previous: int | None = None
        for position, raw in enumerate(bars):
            where = f"bar {position}"
            if not isinstance(raw, Mapping):
                problems.append(f"{where}: not a mapping")
                continue
            stamp = raw.get("timestamp")
            if isinstance(stamp, bool) or not isinstance(stamp, int):
                problems.append(f"{where}: timestamp is not an integer")
                continue
            if stamp % BAR_SECONDS:
                problems.append(f"{where}: timestamp {stamp} is not on the 5-minute grid")
            if previous is not None and stamp <= previous:
                problems.append(f"{where}: timestamp {stamp} is not after the previous bar's {previous}")
            previous = stamp
            try:
                high, low, close = (to_decimal(raw.get(key)) for key in ("high", "low", "close"))
            except ValueError as error:
                problems.append(f"{where}: {error}")
                continue
            if low <= _ZERO:
                problems.append(f"{where}: low {low} is not a positive price")
            elif not low <= close <= high:
                problems.append(f"{where}: low {low}, close {close}, high {high} are not in order (low <= close <= high)")
            else:
                index[stamp] = Bar(stamp, high, low, close)
        if problems:
            raise BarsError(problems)
        self._bars = index

    def __len__(self) -> int:
        return len(self._bars)

    def get(self, timestamp: int) -> Bar | None:
        return self._bars.get(timestamp)


@dataclass(frozen=True)
class Outcome:
    forward_move: Decimal  # bias-aligned: positive is favourable (NEUTRAL and STAND_ASIDE: the raw change)
    adverse_excursion: Decimal  # never negative


@dataclass(frozen=True)
class Unavailable:
    reason: str  # one of UNAVAILABLE_REASONS


def check_bias(bias: object) -> str:
    if not isinstance(bias, str) or bias not in BIASES:
        raise ValueError(f"bias must be one of {', '.join(BIASES)}, not {bias!r}")
    return bias


def check_horizon(horizon_hours: object) -> int:
    if isinstance(horizon_hours, bool) or not isinstance(horizon_hours, int) or horizon_hours not in HORIZON_BARS:
        raise ValueError(f"horizon must be one of {', '.join(str(h) for h in sorted(HORIZON_BARS))} hours, not {horizon_hours!r}")
    return horizon_hours


def check_slot(slot: object) -> int:
    if isinstance(slot, bool) or not isinstance(slot, int) or slot % BAR_SECONDS:
        raise ValueError(f"slot must be unix seconds on the 5-minute grid, not {slot!r}")
    return slot


def outcome_at(series: BarSeries, slot: int, bias: str, horizon_hours: int) -> Outcome | Unavailable:
    """The forward move and the adverse excursion of a state seen at ``slot``, ``horizon_hours`` later.

    ``slot`` is unix UTC seconds on the 5-minute grid. Returns ``Unavailable`` when the bars that define the outcome are not all
    there; raises ``ValueError`` for a bias, a horizon or a slot that is not valid (that is the caller's mistake, not missing data).
    """
    check_bias(bias)
    bars_ahead = HORIZON_BARS[check_horizon(horizon_hours)]
    reference_open = check_slot(slot) - BAR_SECONDS  # the last closed bar at the slot
    reference = series.get(reference_open)
    if reference is None:
        return Unavailable(NO_REFERENCE_BAR)
    horizon_bar = series.get(reference_open + bars_ahead * BAR_SECONDS)
    if horizon_bar is None:
        return Unavailable(NO_HORIZON_BAR)
    window = [series.get(reference_open + step * BAR_SECONDS) for step in range(1, bars_ahead + 1)]
    if any(bar is None for bar in window):
        return Unavailable(GAP_IN_WINDOW)
    bars = [bar for bar in window if bar is not None]

    with localcontext() as context:
        context.prec = 50
        price = reference.close
        change = horizon_bar.close - price
        lowest = min(bar.low for bar in bars)
        highest = max(bar.high for bar in bars)
        if bias == "LONG":
            forward, adverse = change, max(_ZERO, price - lowest)
        elif bias == "SHORT":
            forward, adverse = price - horizon_bar.close, max(_ZERO, highest - price)
        else:  # NEUTRAL, STAND_ASIDE
            forward, adverse = change, max(abs(price - lowest), abs(highest - price))
    return Outcome(forward_move=forward, adverse_excursion=adverse)
