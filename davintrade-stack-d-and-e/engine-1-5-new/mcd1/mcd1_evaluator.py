"""MCD1: M15 primary trend and micro regime. Evaluator 2.0.0.

Retrofit of the certified pre-retrofit MCD1 (kept in ``legacy/``). Specification: ``mcd1.md``.
Parameters: ``mcd1_params.yaml``. State register and templates: ``mcd1_registry.yaml``.

``evaluate(inputs, params, upstream) -> envelope`` is a pure function of the kit's frozen input
bundle (standard section 11.2, rule R4): no file, database, network, clock, randomness, environment
variable or model call. It never raises (R7): ``never_throws`` turns any error into INVALID +
``EVALUATOR_ERROR``. It reads closed M15 bars only (R1), the statistics row at the slot (R2) and the
active indicator from the setting (R3).

Question: which way does the active M15 EDT channel slope (the primary trend), and what did the last
closed bars do against that channel's corridor, the band between LOEDT and UOEDT: stay in it, break out
in the direction of the slope, or break out against the slope? The metric is the bar's Close (Q1).
"""

from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal
from typing import Any, Mapping

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

MCD_ID = "MCD1"
EVALUATOR_VERSION = "2.0.0"
TF = "M15"
TIMEFRAMES = (TF,)

# Statistics fields that give T_EDT, in order of preference (spec section 3). The legacy order, kept.
T_EDT_FIELDS = ("containment_n", "visual_window_bars")

# State register: code -> (bias, regime_status, summary_line, commentary template id). Bias is decision D6
# (Davin, 1 October 2026): inside the corridor it follows the macro trend, a break follows the break
# direction (above UOEDT LONG, below LOEDT SHORT) for every trend. Kept equal to mcd1_registry.yaml by a test.
STATES: Mapping[str, tuple[str, str, str, str]] = {
    "MCD1_UP_IN_CORRIDOR": ("LONG", "TREND_ALIGNED_CONTINUATION", "M15 uptrend, no sustained break of the corridor", "MCD1_T01"),
    "MCD1_UP_UPPER_BREAKOUT": ("LONG", "BREAKOUT_SAME_SLOPE", "M15 uptrend, latest close above the corridor", "MCD1_T02"),
    "MCD1_UP_LOWER_BREAKDOWN": ("SHORT", "COUNTER_TREND_EXPANSION", "M15 uptrend, sustained close below the corridor", "MCD1_T03"),
    "MCD1_DOWN_IN_CORRIDOR": ("SHORT", "TREND_ALIGNED_CONTINUATION", "M15 downtrend, no sustained break of the corridor", "MCD1_T04"),
    "MCD1_DOWN_LOWER_BREAKDOWN": ("SHORT", "BREAKOUT_SAME_SLOPE", "M15 downtrend, latest close below the corridor", "MCD1_T05"),
    "MCD1_DOWN_UPPER_BREAKOUT": ("LONG", "COUNTER_TREND_EXPANSION", "M15 downtrend, sustained close above the corridor", "MCD1_T06"),
    "MCD1_SIDEWAYS_IN_CORRIDOR": ("NEUTRAL", "CONSOLIDATION", "M15 sideways, no sustained break of the corridor", "MCD1_T07"),
    "MCD1_SIDEWAYS_UPPER_BREAKOUT": ("LONG", "RANGE_EXPANSION", "M15 sideways, sustained close above the corridor", "MCD1_T08"),
    "MCD1_SIDEWAYS_LOWER_BREAKDOWN": ("SHORT", "RANGE_EXPANSION", "M15 sideways, sustained close below the corridor", "MCD1_T09"),
}

# Commentary templates (location and counts only; no forecast, probability or advice).
TEMPLATES: Mapping[str, str] = {
    "MCD1_T01": "The M15 channel slopes up ({angle}°). {inside} of the last {n_micro} closed bars closed inside the corridor; the latest closed bar has channel position {cp}.",
    "MCD1_T02": "The M15 channel slopes up ({angle}°). The latest closed bar closed {dist} above UOEDT {uoedt} (channel position {cp}); {upper} of the last {n_micro} closed bars closed above UOEDT.",
    "MCD1_T03": "The M15 channel slopes up ({angle}°). The latest closed bar closed {dist} below LOEDT {loedt} (channel position {cp}); {lower} of the last {n_micro} closed bars closed below LOEDT.",
    "MCD1_T04": "The M15 channel slopes down ({angle}°). {inside} of the last {n_micro} closed bars closed inside the corridor; the latest closed bar has channel position {cp}.",
    "MCD1_T05": "The M15 channel slopes down ({angle}°). The latest closed bar closed {dist} below LOEDT {loedt} (channel position {cp}); {lower} of the last {n_micro} closed bars closed below LOEDT.",
    "MCD1_T06": "The M15 channel slopes down ({angle}°). The latest closed bar closed {dist} above UOEDT {uoedt} (channel position {cp}); {upper} of the last {n_micro} closed bars closed above UOEDT.",
    "MCD1_T07": "The M15 channel is flat ({angle}°). {inside} of the last {n_micro} closed bars closed inside the corridor; the latest closed bar has channel position {cp}.",
    "MCD1_T08": "The M15 channel is flat ({angle}°). The latest closed bar closed {dist} above UOEDT {uoedt} (channel position {cp}); {upper} of the last {n_micro} closed bars closed above UOEDT.",
    "MCD1_T09": "The M15 channel is flat ({angle}°). The latest closed bar closed {dist} below LOEDT {loedt} (channel position {cp}); {lower} of the last {n_micro} closed bars closed below LOEDT.",
}


# --------------------------------------------------------------------------- small helpers


def _round_half_up(value: float, decimals: int) -> float:
    """Round half up on the shortest decimal form of ``value``. Output only (standard section 11.2)."""
    rounded = float(Decimal(repr(float(value))).quantize(Decimal(1).scaleb(-decimals), rounding=ROUND_HALF_UP))
    return 0.0 if rounded == 0 else rounded


def _price(value: float) -> str:
    return f"{env.round2(value):.2f}"


def _n_micro(row: Mapping[str, Any], params: Params) -> int:
    """``N_micro = max(min_micro_window_bars, micro_window_pct % of T_EDT rounded half up)`` closed M15 bars.

    ``T_EDT`` is the first of ``T_EDT_FIELDS`` that is a number; with none, ``N_micro`` is the floor
    (Q2). The percentage is taken in exact decimal arithmetic, so 5% of 1,930 is 96.5 and rounds to 97
    (Q3), where Python's ``round()`` would give the even number 96.
    """
    floor = int(params["min_micro_window_bars"])
    horizon = next((row[name] for name in T_EDT_FIELDS if is_number(row.get(name))), None)
    if horizon is None:
        return floor
    share = Decimal(repr(float(params["micro_window_pct"]))) * int(horizon) / 100
    return max(floor, int(share.quantize(Decimal(1), rounding=ROUND_HALF_UP)))


def _sustained(count: int, n_micro: int, params: Params) -> bool:
    """``100 x count >= sustained_breach_pct x N_micro``: an exact, inclusive test on counts (spec section 6)."""
    return Decimal(100 * count) >= Decimal(repr(float(params["sustained_breach_pct"]))) * n_micro


def _statistics_row(inputs: CycleInputs) -> Mapping[str, Any]:
    return inputs.statistics[(TF, statistics_source(inputs.active_indicator[TF]))]


# --------------------------------------------------------------------------- pre-flight content


def _tier4(params: Params) -> pf.Check:
    """The kit's statistics check, plus: ``regression_angle`` must be a number (INVALID + SANITY_FAILED)."""
    base = pf.statistics_check(TIMEFRAMES, min_containment=params["min_containment_rate"])

    def check(inputs: CycleInputs) -> pf.CheckResult:
        result = base(inputs)
        if result.status != pf.PASS:
            return result
        if not is_number(_statistics_row(inputs).get("regression_angle")):
            return pf.CheckResult(rc.INVALID, (rc.SANITY_FAILED,), {"timeframe": TF, "missing": "regression_angle"})
        return result

    return check


def _tier2(params: Params) -> pf.Check:
    """At least ``N_micro`` closed bars, ascending, and every column MCD1 reads is a number, over the newest ``N_micro``."""

    def check(inputs: CycleInputs) -> pf.CheckResult:
        indicator = inputs.active_indicator[TF]
        columns = ("timestamp", "close", *dict.fromkeys(channel_columns(indicator).values()))
        window = _n_micro(_statistics_row(inputs), params)
        return pf.bars_check({TF: window}, {TF: columns})(inputs)

    return check


def _tier3(params: Params) -> pf.Check:
    """The kit's sanity check (last closed bar, channel width), plus UOEDT > LOEDT on every window bar
    and |regression_angle| within the physical bound."""
    base = pf.sanity_check(TIMEFRAMES)

    def check(inputs: CycleInputs) -> pf.CheckResult:
        result = base(inputs)
        if result.status != pf.PASS:
            return result
        cols = channel_columns(inputs.active_indicator[TF])
        row = _statistics_row(inputs)
        for bar in closed_bars(inputs, TF)[-_n_micro(row, params):]:
            if not bar[cols["upper"]] > bar[cols["lower"]]:
                return pf.CheckResult(rc.INVALID, (rc.SANITY_FAILED,), {"timeframe": TF, "problem": "uoedt_not_above_loedt_in_window"})
        if abs(row["regression_angle"]) > params["max_abs_regression_angle_deg"]:
            return pf.CheckResult(rc.INVALID, (rc.SANITY_FAILED,), {"timeframe": TF, "problem": "regression_angle"})
        return result

    return check


# --------------------------------------------------------------------------- the reading


def _micro_regime(trend: str, latest_above: bool, latest_below: bool, upper_sustained: bool, lower_sustained: bool) -> str:
    """The micro regime of spec section 6 (ADR-023): a same-slope break fires on the latest bar alone; a
    counter-trend or sideways break also needs the sustained share. Anything else is IN_CORRIDOR."""
    if trend == "UP":
        if latest_above:
            return "UPPER_BREAKOUT"
        if latest_below and lower_sustained:
            return "LOWER_BREAKDOWN"
    elif trend == "DOWN":
        if latest_below:
            return "LOWER_BREAKDOWN"
        if latest_above and upper_sustained:
            return "UPPER_BREAKOUT"
    else:
        if latest_above and upper_sustained:
            return "UPPER_BREAKOUT"
        if latest_below and lower_sustained:
            return "LOWER_BREAKDOWN"
    return "IN_CORRIDOR"


def _evaluate(inputs: CycleInputs, params: Params) -> dict[str, Any]:
    outcome = pf.run_preflight(
        inputs,
        tier1=pf.indicator_check(TIMEFRAMES),
        tier4=_tier4(params),
        tier2=_tier2(params),
        tier3=_tier3(params),
    )
    context = env.reading_context(inputs, TIMEFRAMES)
    if outcome.stop:
        return env.unavailable(outcome.status, MCD_ID, EVALUATOR_VERSION, inputs.cycle_slot, list(outcome.reasons), **context)

    indicator = inputs.active_indicator[TF]
    cols = channel_columns(indicator)
    row = _statistics_row(inputs)
    n_micro = _n_micro(row, params)
    window = closed_bars(inputs, TF)[-n_micro:]  # ends at the last closed bar (rule 2)
    last = window[-1]
    close = float(last["close"])
    upper, lower, baseline = float(last[cols["upper"]]), float(last[cols["lower"]]), float(last[cols["baseline"]])
    angle = float(row["regression_angle"])

    band = params["sideways_angle_deg"]
    trend = "UP" if angle > band else "DOWN" if angle < -band else "SIDEWAYS"

    # Decided on prices and exact counts, never on the rounded channel position (standard section 11.2).
    upper_count = sum(1 for bar in window if bar["close"] > bar[cols["upper"]])
    lower_count = sum(1 for bar in window if bar["close"] < bar[cols["lower"]])
    regime = _micro_regime(
        trend,
        latest_above=close > upper,
        latest_below=close < lower,
        upper_sustained=_sustained(upper_count, n_micro, params),
        lower_sustained=_sustained(lower_count, n_micro, params),
    )
    state = f"MCD1_{trend}_{regime}"
    bias, regime_word, summary, template_id = STATES[state]

    decimals = int(params["channel_position_decimals"])
    position = _round_half_up((close - lower) / (upper - lower), decimals)
    commentary = TEMPLATES[template_id].format(
        angle=f"{env.round2(angle):+.2f}",
        inside=n_micro - upper_count - lower_count,
        n_micro=n_micro,
        cp=f"{position:.{decimals}f}",
        dist=_price(max(close - upper, lower - close, 0.0)),
        uoedt=_price(upper),
        loedt=_price(lower),
        upper=upper_count,
        lower=lower_count,
    )
    details = {
        "trend_direction": trend,
        "regression_angle_deg": env.round2(angle),
        "containment_rate": env.round2(row["containment_rate"]),
        "n_micro": n_micro,
        "upper_breach_count": upper_count,
        "lower_breach_count": lower_count,
        "channel_position": position,
        "populated_candidates": outcome.details.get("populated_candidates", {}),
    }
    levels = [
        {"name": "UOEDT", "tf": TF, "price": upper, "role": "resistance"},
        {"name": "baseline", "tf": TF, "price": baseline, "role": "mid"},
        {"name": "LOEDT", "tf": TF, "price": lower, "role": "support"},
    ]
    reading = dict(
        state_code=state, bias=bias, summary_line=summary, commentary=commentary, levels=levels,
        regime_status=regime_word, details=details, **context,
    )
    if outcome.status == rc.CAUTIONARY:
        return env.cautionary(MCD_ID, EVALUATOR_VERSION, inputs.cycle_slot, list(outcome.reasons), **reading)
    return env.valid(MCD_ID, EVALUATOR_VERSION, inputs.cycle_slot, **reading)


@env.never_throws(MCD_ID, EVALUATOR_VERSION)
def evaluate(inputs: CycleInputs, params: Params, upstream: Mapping[str, Any]) -> dict[str, Any]:
    """One envelope per cycle, always (INVALID and STALE included). ``upstream`` is unused: independent MCD."""
    return _evaluate(inputs, params)
