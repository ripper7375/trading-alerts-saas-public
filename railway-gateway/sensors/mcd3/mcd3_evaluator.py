"""MCD3: Consolidated trend and EDT stochastic. Evaluator 2.0.0.

Retrofit of the certified pre-retrofit MCD3 (kept in ``legacy/``). Specification: ``mcd3.md``.
Parameters: ``mcd3_params.yaml``. State register and templates: ``mcd3_registry.yaml``.

``evaluate(inputs, params, upstream) -> envelope`` is a pure function of the kit's frozen input
bundle and of the same-cycle readings of MCD1 and MCD2 (standard section 11.2, rules R4 and R8): no
file, database, network, clock, randomness, environment variable or model call. It never raises (R7):
``never_throws`` turns any error into INVALID + ``EVALUATOR_ERROR``. It reads closed bars only (R1),
the statistics rows at the slot (R2) and the active indicators from the setting (R3).

Question: do the active M15 and M5 channels agree in direction, is the M5 corridor nested inside the
M15 corridor (over the M5 channel's horizon and on the latest bar), and, if they form a consolidated
trend, where does the M15 SSA sit in the M15 corridor? MCD3 is derived: the two trend words come from
MCD1 and MCD2 (ADR-021), never from a second reading of the statistics.
"""

from __future__ import annotations

import bisect
from decimal import ROUND_HALF_UP, Decimal
from typing import Any, Mapping, Sequence

from mcd_common import envelope as env
from mcd_common import preflight as pf
from mcd_common import reason_codes as rc
from mcd_common.cycle_inputs import (
    CycleInputs,
    Params,
    channel_columns,
    closed_bars,
    is_number,
    statistics_source,
)

MCD_ID = "MCD3"
EVALUATOR_VERSION = "2.0.0"
M15 = "M15"
M5 = "M5"
TIMEFRAMES = (M15, M5)  # the order the per-timeframe checks run in (spec section 5)
UPSTREAM = ("MCD1", "MCD2")  # the order the upstream readings are checked in; ``depends_on``
UPSTREAM_TIMEFRAME = {"MCD1": M15, "MCD2": M5}
TRENDS = ("UP", "DOWN", "SIDEWAYS")

# Statistics fields that give T_EDT of the M5 channel, in order of preference (spec section 3).
T_EDT_FIELDS = ("containment_n", "visual_window_bars", "window_bars")

# State register: code -> (bias, regime_status, summary_line, commentary template id). Bias is
# decision D6 (Davin, 1 October 2026). Kept equal to mcd3_registry.yaml by a test.
STATES: Mapping[str, tuple[str, str, str, str]] = {
    "MCD3_BULL_VALUE": ("LONG", "BULLISH_CONSOLIDATED_VALUE_ZONE", "Consolidated uptrend, lower zone of the M15 corridor", "MCD3_T01"),
    "MCD3_BULL_MID": ("LONG", "BULLISH_CONSOLIDATED_EQUILIBRIUM", "Consolidated uptrend, middle zone of the M15 corridor", "MCD3_T02"),
    "MCD3_BULL_TOP": ("NEUTRAL", "BULLISH_CONSOLIDATED_OVERBOUGHT", "Consolidated uptrend, upper zone of the M15 corridor", "MCD3_T03"),
    "MCD3_BEAR_PREMIUM": ("SHORT", "BEARISH_CONSOLIDATED_PREMIUM_ZONE", "Consolidated downtrend, upper zone of the M15 corridor", "MCD3_T04"),
    "MCD3_BEAR_MID": ("SHORT", "BEARISH_CONSOLIDATED_EQUILIBRIUM", "Consolidated downtrend, middle zone of the M15 corridor", "MCD3_T05"),
    "MCD3_BEAR_BOTTOM": ("NEUTRAL", "BEARISH_CONSOLIDATED_OVERSOLD", "Consolidated downtrend, lower zone of the M15 corridor", "MCD3_T06"),
    "MCD3_SIDEWAYS_EQUILIBRIUM": ("NEUTRAL", "SIDEWAYS_CONSOLIDATED_EQUILIBRIUM", "Consolidated sideways, M5 corridor inside the M15 corridor", "MCD3_T07"),
    "MCD3_NON_CONSOLIDATED_TREND_CONFLICT": ("STAND_ASIDE", "TREND_MISALIGNMENT", "M15 and M5 trends differ, no consolidated trend", "MCD3_T08"),
    "MCD3_NON_CONSOLIDATED_OVERFLOW": ("STAND_ASIDE", "INSUFFICIENT_CORRIDOR_NESTING", "Trends agree, M5 corridor often outside the M15 corridor", "MCD3_T09"),
    "MCD3_NON_CONSOLIDATED_ESCAPE": ("STAND_ASIDE", "CURRENT_CORRIDOR_ESCAPE", "Trends agree, latest M5 corridor beyond the M15 corridor", "MCD3_T10"),
}

# Consolidated states: (trend, zone of the position) -> state. Sideways has one state for any position.
CONSOLIDATED_STATE: Mapping[tuple[str, str], str] = {
    ("UP", "LOWER"): "MCD3_BULL_VALUE",
    ("UP", "MIDDLE"): "MCD3_BULL_MID",
    ("UP", "UPPER"): "MCD3_BULL_TOP",
    ("DOWN", "UPPER"): "MCD3_BEAR_PREMIUM",
    ("DOWN", "MIDDLE"): "MCD3_BEAR_MID",
    ("DOWN", "LOWER"): "MCD3_BEAR_BOTTOM",
}
SIDEWAYS_STATE = "MCD3_SIDEWAYS_EQUILIBRIUM"
CONFLICT_STATE = "MCD3_NON_CONSOLIDATED_TREND_CONFLICT"
OVERFLOW_STATE = "MCD3_NON_CONSOLIDATED_OVERFLOW"
ESCAPE_STATE = "MCD3_NON_CONSOLIDATED_ESCAPE"

# Commentary templates (counts, prices, angles and the stochastic number only; no forecast, probability,
# advice or percent sign). Decision D10 option A: "(0 at LOEDT, 100 at UOEDT)". Kept equal to the registry by a test.
_NESTED = (
    "{nested} of {n} closed M5 bars have their corridor inside the M15 corridor, and the latest M5 corridor "
    "[{m5_loedt}, {m5_uoedt}] is inside the M15 corridor [{m15_loedt}, {m15_uoedt}]. "
    "The M15 SSA {m15_ssa} is {ssa_place}; the EDT stochastic is {stoch} (0 at LOEDT, 100 at UOEDT)"
)
TEMPLATES: Mapping[str, str] = {
    "MCD3_T01": "Both channels slope up (M15 {m15_angle}°, M5 {m5_angle}°). " + _NESTED + ", in the lower zone.",
    "MCD3_T02": "Both channels slope up (M15 {m15_angle}°, M5 {m5_angle}°). " + _NESTED + ", in the middle zone.",
    "MCD3_T03": "Both channels slope up (M15 {m15_angle}°, M5 {m5_angle}°). " + _NESTED + ", in the upper zone.",
    "MCD3_T04": "Both channels slope down (M15 {m15_angle}°, M5 {m5_angle}°). " + _NESTED + ", in the upper zone.",
    "MCD3_T05": "Both channels slope down (M15 {m15_angle}°, M5 {m5_angle}°). " + _NESTED + ", in the middle zone.",
    "MCD3_T06": "Both channels slope down (M15 {m15_angle}°, M5 {m5_angle}°). " + _NESTED + ", in the lower zone.",
    "MCD3_T07": "Both channels are flat (M15 {m15_angle}°, M5 {m5_angle}°). " + _NESTED + ".",
    "MCD3_T08": "The M15 channel {m15_phrase} ({m15_angle}°) while the M5 channel {m5_phrase} ({m5_angle}°), so the two timeframes do not form a consolidated trend and no EDT stochastic is given.",
    "MCD3_T09": "Both channels {both_phrase} (M15 {m15_angle}°, M5 {m5_angle}°), but only {nested} of {n} closed M5 bars have their corridor inside the M15 corridor, which is fewer than three quarters, so there is no consolidated trend and no EDT stochastic is given.",
    "MCD3_T10": "Both channels {both_phrase} (M15 {m15_angle}°, M5 {m5_angle}°) and {nested} of {n} closed M5 bars have their corridor inside the M15 corridor, but the latest M5 corridor [{m5_loedt}, {m5_uoedt}] extends beyond the M15 corridor [{m15_loedt}, {m15_uoedt}], so there is no consolidated trend and no EDT stochastic is given.",
}

_SLOPE_PHRASE = {"UP": "slopes up", "DOWN": "slopes down", "SIDEWAYS": "is flat"}  # one channel: "The M15 channel ..."
_BOTH_PHRASE = {"UP": "slope up", "DOWN": "slope down", "SIDEWAYS": "are flat"}  # both channels: "Both channels ..."


# --------------------------------------------------------------------------- small helpers


def _round_half_up(value: float, decimals: int) -> float:
    """Round half up on the shortest decimal form of ``value``. Output only (standard section 11.2)."""
    rounded = float(Decimal(repr(float(value))).quantize(Decimal(1).scaleb(-decimals), rounding=ROUND_HALF_UP))
    return 0.0 if rounded == 0 else rounded


def _price(value: float) -> str:
    return f"{env.round2(value):.2f}"


def _statistics_row(inputs: CycleInputs, timeframe: str) -> Mapping[str, Any]:
    return inputs.statistics[(timeframe, statistics_source(inputs.active_indicator[timeframe]))]


def _t_edt(row: Mapping[str, Any]) -> int | None:
    """``T_EDT`` of the M5 channel: the first of ``T_EDT_FIELDS`` that is a number, else ``None`` (spec section 3)."""
    for name in T_EDT_FIELDS:
        value = row.get(name)
        if is_number(value):
            return int(value)
    return None


def _nesting_bars(inputs: CycleInputs, params: Params) -> int:
    """``N_nest = T_EDT - t_edt_open_bar_rows`` closed M5 bars (spec section 3, decision Q1)."""
    t_edt = _t_edt(_statistics_row(inputs, M5))
    assert t_edt is not None  # tier 4 has already ended a reading without one
    return t_edt - int(params["t_edt_open_bar_rows"])


def _m15_start(m15_bars: Sequence[Mapping[str, Any]], oldest_open: float) -> int | None:
    """Index of the closed M15 bar that holds a bar opened at ``oldest_open``: the last one opened at or before it."""
    start = None
    for index, bar in enumerate(m15_bars):
        if bar["timestamp"] <= oldest_open:
            start = index
    return start


def _matches(window: Sequence[Mapping[str, Any]], span: Sequence[Mapping[str, Any]]) -> list[int]:
    """For each M5 window bar, the index into ``span`` of its M15 bar: the closed M15 bar with the greatest open
    time at or before it (spec section 3). ``span`` is ascending (tier 2) and starts at or before the first bar."""
    stamps = [bar["timestamp"] for bar in span]
    return [bisect.bisect_right(stamps, bar["timestamp"]) - 1 for bar in window]


def _fail(status: str, *codes: str, **details: Any) -> pf.CheckResult:
    return pf.CheckResult(status, tuple(codes), details)


# --------------------------------------------------------------------------- pre-flight content


def _tier4(params: Params) -> pf.Check:
    """The kit's statistics check on M15 then M5 (row at the slot, containment), plus: the M5 row has a ``T_EDT``."""
    base = pf.statistics_check(TIMEFRAMES, min_containment=params["min_containment_rate"])

    def check(inputs: CycleInputs) -> pf.CheckResult:
        result = base(inputs)
        if result.status != pf.PASS:
            return result
        if _t_edt(_statistics_row(inputs, M5)) is None:
            return _fail(rc.INVALID, rc.SANITY_FAILED, timeframe=M5, missing="T_EDT")
        return result

    return check


def _tier2(params: Params) -> pf.Check:
    """M5: ``N_nest`` at the floor, enough closed bars, ascending, UOEDT and LOEDT numbers. M15: a closed bar at or
    before the window start, ascending from there, the last closed bar complete. Older M15 bars may have no band."""

    def check(inputs: CycleInputs) -> pf.CheckResult:
        nest = _nesting_bars(inputs, params)
        floor = int(params["min_nesting_window_bars"])
        if nest < floor:
            return _fail(rc.INVALID, rc.INSUFFICIENT_BARS, timeframe=M5, nesting_window=nest, needed=floor)
        cols5 = channel_columns(inputs.active_indicator[M5])
        result = pf.bars_check({M5: nest}, {M5: ("timestamp", cols5["upper"], cols5["lower"])})(inputs)
        if result.status != pf.PASS:
            return result
        last5 = closed_bars(inputs, M5)[-1]
        if not is_number(last5.get(cols5["baseline"])):
            return _fail(rc.INVALID, rc.DISCONTINUITY, timeframe=M5, problem="null", column=cols5["baseline"])

        if any(not is_number(bar.get("timestamp")) for bar in inputs.bars.get(M15, ())):
            return _fail(rc.INVALID, rc.DISCONTINUITY, timeframe=M15, problem="timestamp")
        m15 = closed_bars(inputs, M15)
        window = closed_bars(inputs, M5)[-nest:]
        start = _m15_start(m15, window[0]["timestamp"])
        if start is None:
            return _fail(rc.INVALID, rc.INSUFFICIENT_BARS, timeframe=M15, problem="no_bar_at_or_before_the_window_start")
        span = m15[start:]
        stamps = [bar["timestamp"] for bar in span]
        if any(later <= earlier for earlier, later in zip(stamps, stamps[1:])):
            return _fail(rc.INVALID, rc.DISCONTINUITY, timeframe=M15, problem="order")
        cols15 = channel_columns(inputs.active_indicator[M15])
        bad = [c for c in (cols15["fit"], cols15["upper"], cols15["lower"], cols15["baseline"]) if not is_number(span[-1].get(c))]
        if bad:
            return _fail(rc.INVALID, rc.DISCONTINUITY, timeframe=M15, problem="null", column=bad[0])
        return pf.CheckResult(pf.PASS)

    return check


def _tier3(params: Params) -> pf.Check:
    """The kit's sanity check (last closed bar of each timeframe, channel width), plus UOEDT > LOEDT on every window
    M5 bar and on every M15 bar that carries a band and is the M15 bar of a window bar."""
    base = pf.sanity_check(TIMEFRAMES)

    def check(inputs: CycleInputs) -> pf.CheckResult:
        result = base(inputs)
        if result.status != pf.PASS:
            return result
        nest = _nesting_bars(inputs, params)
        cols5 = channel_columns(inputs.active_indicator[M5])
        cols15 = channel_columns(inputs.active_indicator[M15])
        window = closed_bars(inputs, M5)[-nest:]
        for bar in window:
            if not bar[cols5["upper"]] > bar[cols5["lower"]]:
                return _fail(rc.INVALID, rc.SANITY_FAILED, timeframe=M5, problem="uoedt_not_above_loedt_in_window")
        m15 = closed_bars(inputs, M15)
        span = m15[_m15_start(m15, window[0]["timestamp"]):]
        for index in sorted(set(_matches(window, span))):
            upper, lower = span[index].get(cols15["upper"]), span[index].get(cols15["lower"])
            if is_number(upper) and is_number(lower) and not upper > lower:
                return _fail(rc.INVALID, rc.SANITY_FAILED, timeframe=M15, problem="uoedt_not_above_loedt_in_span")
        return result

    return check


def _upstream_problem(inputs: CycleInputs, mcd_id: str, envelope: Mapping[str, Any]) -> bool:
    """True when a VALID or CAUTIONARY upstream reading cannot be used (decision Q5): it was not made for this cycle
    or for the active indicator of its timeframe, or its trend word or angle is unreadable."""
    timeframe = UPSTREAM_TIMEFRAME[mcd_id]
    active = envelope.get("active_indicator")
    details = envelope.get("details")
    return not (
        envelope.get("cycle_slot") == inputs.cycle_slot
        and isinstance(active, Mapping)
        and active.get(timeframe) == inputs.active_indicator.get(timeframe)
        and isinstance(details, Mapping)
        and details.get("trend_direction") in TRENDS
        and is_number(details.get("regression_angle_deg"))
    )


def _upstream(upstream: Any) -> pf.Check:
    """MCD1 then MCD2. The kit's status rules (INVALID or missing, STALE, CAUTIONARY) for each, then the consistency
    rule above; CAUTIONARY reasons of the earlier one stay in front of a later stop."""
    readings: Mapping[str, Any] = upstream if isinstance(upstream, Mapping) else {}

    def check(inputs: CycleInputs) -> pf.CheckResult:
        cautions: list[str] = []
        for mcd_id in UPSTREAM:
            result = pf.upstream_check((mcd_id,), readings)(inputs)
            if result.status in (rc.INVALID, rc.STALE):
                return pf.CheckResult(result.status, tuple(cautions) + result.reasons)
            cautions.extend(result.reasons)
            if _upstream_problem(inputs, mcd_id, readings[mcd_id]):
                return pf.CheckResult(rc.INVALID, tuple(cautions) + (rc.upstream_unavailable(mcd_id),))
        if cautions:
            return pf.CheckResult(rc.CAUTIONARY, tuple(cautions))
        return pf.CheckResult(pf.PASS)

    return check


# --------------------------------------------------------------------------- the reading


def _evaluate(inputs: CycleInputs, params: Params, upstream: Mapping[str, Any]) -> dict[str, Any]:
    outcome = pf.run_preflight(
        inputs,
        tier1=pf.indicator_check(TIMEFRAMES),
        tier4=_tier4(params),
        tier2=_tier2(params),
        tier3=_tier3(params),
        upstream=_upstream(upstream),
    )
    context = env.reading_context(inputs, TIMEFRAMES)
    if outcome.stop:
        return env.unavailable(
            outcome.status, MCD_ID, EVALUATOR_VERSION, inputs.cycle_slot, list(outcome.reasons),
            depends_on=list(UPSTREAM), **context,
        )

    ind15, ind5 = inputs.active_indicator[M15], inputs.active_indicator[M5]
    cols15, cols5 = channel_columns(ind15), channel_columns(ind5)
    m15 = closed_bars(inputs, M15)
    m5 = closed_bars(inputs, M5)
    nest = _nesting_bars(inputs, params)
    window = m5[-nest:]
    span = m15[_m15_start(m15, window[0]["timestamp"]):]
    last5, last15 = m5[-1], m15[-1]  # the last closed bars (rule 2); the M15 bar of the last M5 bar is the last one

    # Condition 1: the trend words of MCD1 (M15) and MCD2 (M5) agree.
    details1, details2 = upstream["MCD1"]["details"], upstream["MCD2"]["details"]
    trend15, trend5 = details1["trend_direction"], details2["trend_direction"]
    aligned = trend15 == trend5

    # Condition 2: the M5 corridor is inside the M15 corridor of its M15 bar on enough window bars. A bar whose M15 bar
    # has no band yet is not nested. Exact integer test.
    nested = 0
    for bar, index in zip(window, _matches(window, span)):
        upper15, lower15 = span[index].get(cols15["upper"]), span[index].get(cols15["lower"])
        if is_number(upper15) and is_number(lower15) and bar[cols5["lower"]] >= lower15 and bar[cols5["upper"]] <= upper15:
            nested += 1
    nesting_met = nested * 100 >= params["nesting_min_share"] * nest

    # Condition 3: on the last closed bars.
    upper15, lower15 = float(last15[cols15["upper"]]), float(last15[cols15["lower"]])
    upper5, lower5 = float(last5[cols5["upper"]]), float(last5[cols5["lower"]])
    engulfed = lower5 >= lower15 and upper5 <= upper15

    consolidated = aligned and nesting_met and engulfed
    ssa15 = float(last15[cols15["fit"]])
    angle15, angle5 = float(details1["regression_angle_deg"]), float(details2["regression_angle_deg"])

    stochastic: float | None = None
    place = ""
    if consolidated:
        # Position from LOEDT, 0 to 100 inside the corridor, not clipped; decision D10 option A reports it as is.
        position = (ssa15 - lower15) * 100.0 / (upper15 - lower15)
        if trend15 == "SIDEWAYS":
            state = SIDEWAYS_STATE
        else:
            zone = "LOWER" if position <= params["lower_zone_max_position"] else "UPPER" if position >= params["upper_zone_min_position"] else "MIDDLE"
            state = CONSOLIDATED_STATE[(trend15, zone)]
        stochastic = _round_half_up(position, int(params["stochastic_decimals"]))
        place = "above UOEDT" if ssa15 > upper15 else "below LOEDT" if ssa15 < lower15 else "inside the M15 corridor"
    elif not aligned:
        state = CONFLICT_STATE
    elif not nesting_met:
        state = OVERFLOW_STATE
    else:
        state = ESCAPE_STATE

    bias, regime, summary, template_id = STATES[state]
    commentary = TEMPLATES[template_id].format(
        m15_angle=f"{env.round2(angle15):+.2f}",
        m5_angle=f"{env.round2(angle5):+.2f}",
        nested=nested,
        n=nest,
        m5_loedt=_price(lower5),
        m5_uoedt=_price(upper5),
        m15_loedt=_price(lower15),
        m15_uoedt=_price(upper15),
        m15_ssa=_price(ssa15),
        ssa_place=place,
        stoch="" if stochastic is None else f"{stochastic:.{int(params['stochastic_decimals'])}f}",
        m15_phrase=_SLOPE_PHRASE[trend15],
        m5_phrase=_SLOPE_PHRASE[trend5],
        both_phrase=_BOTH_PHRASE[trend15],
    )
    details = {
        "m15_trend_direction": trend15,
        "m5_trend_direction": trend5,
        "trends_aligned": aligned,
        "nesting_window_bars": nest,
        "nested_bars": nested,
        "nesting_met": nesting_met,
        "current_bar_engulfed": engulfed,
        "edt_stochastic": stochastic,
        "populated_candidates": outcome.details.get("populated_candidates", {}),
    }
    levels = [
        {"name": "UOEDT", "tf": M15, "price": upper15, "role": "resistance"},
        {"name": "baseline", "tf": M15, "price": float(last15[cols15["baseline"]]), "role": "mid"},
        {"name": "LOEDT", "tf": M15, "price": lower15, "role": "support"},
        {"name": "UOEDT", "tf": M5, "price": upper5, "role": "resistance"},
        {"name": "baseline", "tf": M5, "price": float(last5[cols5["baseline"]]), "role": "mid"},
        {"name": "LOEDT", "tf": M5, "price": lower5, "role": "support"},
    ]
    reading = dict(
        state_code=state, bias=bias, summary_line=summary, commentary=commentary, levels=levels,
        regime_status=regime, details=details, depends_on=list(UPSTREAM), **context,
    )
    if outcome.status == rc.CAUTIONARY:
        return env.cautionary(MCD_ID, EVALUATOR_VERSION, inputs.cycle_slot, list(outcome.reasons), **reading)
    return env.valid(MCD_ID, EVALUATOR_VERSION, inputs.cycle_slot, **reading)


_guarded = env.never_throws(MCD_ID, EVALUATOR_VERSION)(_evaluate)


def evaluate(inputs: CycleInputs, params: Params, upstream: Mapping[str, Any]) -> dict[str, Any]:
    """One envelope per cycle, always (INVALID and STALE included). ``upstream`` holds the same-cycle envelopes of
    MCD1 and MCD2 (``{"MCD1": ..., "MCD2": ...}``). An error inside the evaluator ends as INVALID + ``EVALUATOR_ERROR``,
    which still declares the dependencies."""
    result = _guarded(inputs, params, upstream)
    if result["status_reasons"] == [rc.EVALUATOR_ERROR]:
        result = {**result, "depends_on": list(UPSTREAM)}
    return result
