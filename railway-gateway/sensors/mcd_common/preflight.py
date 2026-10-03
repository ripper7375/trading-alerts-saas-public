"""Pre-flight checks in the fixed order (standard section 6, architecture section 2.4).

Order: cycle -> tier 1 (indicator) -> tier 4 (statistics) -> tier 2 (continuity) -> tier 3 (sanity)
-> upstream (derived MCDs only). The runner fixes the order; each MCD supplies the content of each
tier through the check factories below or its own checks. The first failing check decides the
status (INVALID or STALE) and later checks do not run. CAUTIONARY results continue: their reasons
are collected and, if a later check stops the reading, they are kept in front of the stopping
reason, so a wrong setting stays visible to the operator (walkthrough Part B2, tier-1 cross-check).

Tier 1 applies decision D3 (Davin, 2026-09-30): a detection mismatch means the set indicator has
no value on the last closed bar while another candidate has. Candidates populated alongside a
populated set indicator go to ``details["populated_candidates"]`` only and never change the
status (on M5 the fractal EDT is populated next to the channel indicator on every cycle).

Checks are pure: they read the bundle only. They report the bad data they are written for (a
missing setting, a missing statistics row, too few bars, a null column, an unknown data status) as
a result, but they assume a well-formed bundle and may raise on a corrupt one (``None`` bars or
statistics, string rows, a garbage ``cycle_slot``). Rule R7 (always emit, never throw) is kept by
``envelope.never_throws`` around the evaluator, which turns any exception into INVALID +
``EVALUATOR_ERROR`` (test T10). Every evaluator must be wrapped: ``run_preflight`` alone does not
give R7.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable, Mapping, Sequence

from . import reason_codes as rc
from .cycle_inputs import (
    CANDIDATES,
    DATA_STATUSES,
    CycleInputs,
    channel_columns,
    closed_bars,
    is_number,
    is_slot,
    is_populated,
    slot_to_epoch,
    statistics_source,
)

PASS = "PASS"


@dataclass(frozen=True)
class CheckResult:
    """One check's verdict: PASS, CAUTIONARY (continue), or INVALID / STALE (stop)."""

    status: str
    reasons: tuple[str, ...] = ()
    details: Mapping[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class Outcome:
    """The pre-flight result: continue with ``status`` VALID / CAUTIONARY, or stop with INVALID / STALE."""

    stop: bool
    status: str
    reasons: tuple[str, ...]
    details: Mapping[str, Any]
    failed_check: str | None = None


Check = Callable[[CycleInputs], CheckResult]

ORDER = ("cycle", "tier1", "tier4", "tier2", "tier3", "upstream")


def run_preflight(
    inputs: CycleInputs,
    *,
    cycle: Check | None = None,
    tier1: Check | None = None,
    tier4: Check | None = None,
    tier2: Check | None = None,
    tier3: Check | None = None,
    upstream: Check | None = None,
) -> Outcome:
    """Run the supplied checks in the fixed order. ``cycle`` defaults to ``cycle_check()``; the
    others are skipped when not supplied (a gate has no upstream, MCD0 reads no bars, ...)."""
    checks = {
        "cycle": cycle if cycle is not None else cycle_check(),
        "tier1": tier1,
        "tier4": tier4,
        "tier2": tier2,
        "tier3": tier3,
        "upstream": upstream,
    }
    reasons: list[str] = []
    details: dict[str, Any] = {}
    cautionary = False
    for name in ORDER:
        check = checks[name]
        if check is None:
            continue
        result = check(inputs)
        for code in result.reasons:
            if code not in reasons:
                reasons.append(code)
        details.update(result.details)
        if result.status == PASS:
            continue
        if result.status == rc.CAUTIONARY:
            cautionary = True
            continue
        if result.status in (rc.INVALID, rc.STALE):
            return Outcome(True, result.status, tuple(reasons), details, failed_check=name)
        raise ValueError(f"check {name!r} returned unknown status {result.status!r}")
    return Outcome(False, rc.CAUTIONARY if cautionary else rc.VALID, tuple(reasons), details)


def _fail(status: str, *codes: str, **details: Any) -> CheckResult:
    return CheckResult(status, tuple(codes), details)


_OK = CheckResult(PASS)


# --------------------------------------------------------------------------- cycle


def cycle_check() -> Check:
    """Data status STALE -> STALE + DATA_STALE; RETUNING -> CAUTIONARY + RETUNING (continue).

    DELAYED and MARKET_CLOSED pass: architecture rule 7 leaves what they allow to the sections
    that consume them. (Assumption recorded in the P1 hand-off.) A value outside ``DATA_STATUSES``
    (``None``, a misspelling such as ``"Stale"``) is a provider bug and ends the reading as
    INVALID + SANITY_FAILED, so the cycle is never evaluated as if it were fresh (Davin,
    2026-10-01, finding F4 of the P6 check).
    """

    def check(inputs: CycleInputs) -> CheckResult:
        if inputs.data_status not in DATA_STATUSES:
            return _fail(rc.INVALID, rc.SANITY_FAILED, problem="data_status")
        if inputs.data_status == "STALE":
            return _fail(rc.STALE, rc.DATA_STALE)
        if inputs.retuning:
            return _fail(rc.CAUTIONARY, rc.RETUNING)
        return _OK

    return check


# --------------------------------------------------------------------------- tier 1


def indicator_check(timeframes: Sequence[str]) -> Check:
    """Tier 1: the setting decides; detection only cross-checks (rule 6, ADR-010, decision D3).

    * no setting, or one that is not a candidate for the timeframe -> INVALID + NO_SETTING;
    * the set indicator has no value on the last closed bar while another candidate has ->
      CAUTIONARY + DETECTION_MISMATCH (continue);
    * candidates populated next to a populated set indicator -> ``populated_candidates`` only.
    """

    def check(inputs: CycleInputs) -> CheckResult:
        populated: dict[str, list[str]] = {}
        mismatch = False
        for tf in timeframes:
            name = inputs.active_indicator.get(tf)
            if not isinstance(name, str) or name not in CANDIDATES[tf]:
                return _fail(rc.INVALID, rc.NO_SETTING, timeframe=tf)
            bars = closed_bars(inputs, tf)
            last = bars[-1] if bars else {}
            others = [c for c in CANDIDATES[tf] if c != name and is_populated(last, c)]
            populated[tf] = others
            if others and not is_populated(last, name):
                mismatch = True
        details = {"populated_candidates": populated}
        if mismatch:
            return CheckResult(rc.CAUTIONARY, (rc.DETECTION_MISMATCH,), details)
        return CheckResult(PASS, (), details)

    return check


# --------------------------------------------------------------------------- tier 4


def statistics_check(timeframes: Sequence[str], *, min_containment: float | None = None) -> Check:
    """Tier 4: the row at the slot for the active source (rule 5).

    * no row for (timeframe, source), or its ``captured_at`` is not ``stats_slot[timeframe]``
      -> STALE + NO_STATS_AT_SLOT. "Latest available" is never used;
    * with ``min_containment`` (percent; channel MCDs use 50): ``containment_rate`` below it ->
      INVALID + CONTAINMENT_LOW; at or above passes (the boundary is inclusive);
    * a missing or non-numeric ``containment_rate`` when it is required -> INVALID + SANITY_FAILED.
    """

    def check(inputs: CycleInputs) -> CheckResult:
        for tf in timeframes:
            indicator = inputs.active_indicator.get(tf)
            if not isinstance(indicator, str):
                return _fail(rc.INVALID, rc.NO_SETTING, timeframe=tf)
            source = statistics_source(indicator)
            row = inputs.statistics.get((tf, source))
            slot = inputs.stats_slot.get(tf)
            if row is None or not is_slot(slot) or row.get("captured_at") != slot_to_epoch(slot):
                return _fail(rc.STALE, rc.NO_STATS_AT_SLOT, timeframe=tf, source=source)
            if min_containment is not None:
                rate = row.get("containment_rate")
                if not is_number(rate):
                    return _fail(rc.INVALID, rc.SANITY_FAILED, timeframe=tf, missing="containment_rate")
                if rate < min_containment:
                    return _fail(rc.INVALID, rc.CONTAINMENT_LOW, timeframe=tf, containment_rate=rate)
        return _OK

    return check


# --------------------------------------------------------------------------- tier 2


def default_required_columns(indicator: str) -> tuple[str, ...]:
    """OHLC plus the channel columns of ``indicator``: what a channel MCD needs on every bar."""
    return ("timestamp", "open", "high", "low", "close", *dict.fromkeys(channel_columns(indicator).values()))


def bars_check(
    windows: Mapping[str, int],
    required_columns: Mapping[str, Sequence[str]] | None = None,
) -> Check:
    """Tier 2: enough closed bars, ascending, no nulls.

    ``windows`` is ``{timeframe: minimum closed bars}`` as the spec states it. Over the newest
    ``window`` closed bars the timestamps must be strictly ascending and every required column a
    number (default: ``default_required_columns`` of the active indicator).

    * fewer closed bars than the window -> INVALID + INSUFFICIENT_BARS;
    * out of order, or a null / non-numeric value -> INVALID + DISCONTINUITY.
    """

    def check(inputs: CycleInputs) -> CheckResult:
        for tf, window in windows.items():
            raw = inputs.bars.get(tf, ())
            if any(not is_number(bar.get("timestamp")) for bar in raw):
                return _fail(rc.INVALID, rc.DISCONTINUITY, timeframe=tf, problem="timestamp")
            bars = closed_bars(inputs, tf)
            if len(bars) < window:
                return _fail(rc.INVALID, rc.INSUFFICIENT_BARS, timeframe=tf, closed_bars=len(bars), needed=window)
            tail = bars[-window:] if window > 0 else ()
            stamps = [bar["timestamp"] for bar in tail]
            if any(later <= earlier for earlier, later in zip(stamps, stamps[1:])):
                return _fail(rc.INVALID, rc.DISCONTINUITY, timeframe=tf, problem="order")
            if required_columns is not None and tf in required_columns:
                columns = required_columns[tf]
            else:
                indicator = inputs.active_indicator.get(tf)
                if not isinstance(indicator, str):
                    return _fail(rc.INVALID, rc.NO_SETTING, timeframe=tf)
                columns = default_required_columns(indicator)
            for bar in tail:
                bad = [c for c in columns if not is_number(bar.get(c))]
                if bad:
                    return _fail(rc.INVALID, rc.DISCONTINUITY, timeframe=tf, problem="null", column=bad[0])
        return _OK

    return check


# --------------------------------------------------------------------------- tier 3


def sanity_check(timeframes: Sequence[str]) -> Check:
    """Tier 3: UOEDT > LOEDT on the last closed bar, and channel width > 0 in the statistics row
    when it has one. Anything else -> INVALID + SANITY_FAILED."""

    def check(inputs: CycleInputs) -> CheckResult:
        for tf in timeframes:
            indicator = inputs.active_indicator.get(tf)
            if not isinstance(indicator, str):
                return _fail(rc.INVALID, rc.NO_SETTING, timeframe=tf)
            cols = channel_columns(indicator)
            bars = closed_bars(inputs, tf)
            last = bars[-1] if bars else {}
            upper, lower = last.get(cols["upper"]), last.get(cols["lower"])
            if not (is_number(upper) and is_number(lower)) or not upper > lower:
                return _fail(rc.INVALID, rc.SANITY_FAILED, timeframe=tf, problem="uoedt_not_above_loedt")
            row = inputs.statistics.get((tf, statistics_source(indicator)))
            width = row.get("channel_width") if row is not None else None
            if width is not None and (not is_number(width) or not width > 0):
                return _fail(rc.INVALID, rc.SANITY_FAILED, timeframe=tf, problem="channel_width")
        return _OK

    return check


# --------------------------------------------------------------------------- upstream (derived MCDs)


def upstream_check(required: Sequence[str], upstream: Mapping[str, Mapping[str, Any]]) -> Check:
    """Derived MCDs: every required upstream reading must be usable (standard section 6).

    A missing envelope or an INVALID one -> INVALID + ``UPSTREAM_UNAVAILABLE:<id>``; STALE ->
    STALE + ``UPSTREAM_STALE:<id>``; CAUTIONARY -> continue with ``UPSTREAM_CAUTIONARY:<id>``.
    The first stopping upstream in ``required`` order decides.
    """

    def check(_inputs: CycleInputs) -> CheckResult:
        cautions: list[str] = []
        for mcd_id in required:
            envelope = upstream.get(mcd_id)
            status = envelope.get("status") if isinstance(envelope, Mapping) else None
            if status == rc.STALE:
                return CheckResult(rc.STALE, tuple(cautions) + (rc.upstream_stale(mcd_id),))
            if status == rc.CAUTIONARY:
                cautions.append(rc.upstream_cautionary(mcd_id))
            elif status != rc.VALID:  # INVALID, missing, or anything unreadable
                return CheckResult(rc.INVALID, tuple(cautions) + (rc.upstream_unavailable(mcd_id),))
        if cautions:
            return CheckResult(rc.CAUTIONARY, tuple(cautions))
        return _OK

    return check
