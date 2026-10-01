"""MCD2: M5 trend and corridor deviation. Evaluator 2.0.0.

Retrofit of the certified pre-retrofit MCD2 (kept in ``legacy/``). Specification: ``mcd2.md``.
Parameters: ``mcd2_params.yaml``. State register and templates: ``mcd2_registry.yaml``.

``evaluate(inputs, params, upstream) -> envelope`` is a pure function of the kit's frozen input
bundle (standard section 11.2, rule R4): no file, database, network, clock, randomness, environment
variable or model call. It never raises (R7): ``never_throws`` turns any error into INVALID +
``EVALUATOR_ERROR``. It reads closed M5 bars only (R1), the statistics row at the slot (R2) and the
active indicator from the setting (R3).

Question: which way does the active M5 EDT channel slope, and where does the last closed bar's SSA
(Close, for the fractal EDT) sit relative to that channel's corridor, the band between LOEDT and UOEDT?
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

MCD_ID = "MCD2"
EVALUATOR_VERSION = "2.0.0"
TF = "M5"
TIMEFRAMES = (TF,)

# Statistics fields that give T_EDT, in order of preference (spec section 3). Legacy order, kept.
T_EDT_FIELDS = ("containment_n", "visual_window_bars", "window_bars")

# State register: code -> (bias, regime_status, summary_line, commentary template id). Bias is
# decision D6; regime words follow D5. Kept equal to mcd2_registry.yaml by a test.
STATES: Mapping[str, tuple[str, str, str, str]] = {
    "MCD2_UP_IN_CORRIDOR": ("LONG", "TREND_ALIGNED_CONTINUATION", "M5 uptrend, inside the corridor", "MCD2_T01"),
    "MCD2_UP_UPPER_BREAKOUT": ("LONG", "UPPER_OVEREXTENSION_REVERSION", "M5 uptrend, above the corridor", "MCD2_T02"),
    "MCD2_UP_LOWER_BREAKDOWN": ("LONG", "UPTREND_DIP_BELOW_CORRIDOR", "M5 uptrend, below the corridor", "MCD2_T03"),
    "MCD2_DOWN_IN_CORRIDOR": ("SHORT", "TREND_ALIGNED_CONTINUATION", "M5 downtrend, inside the corridor", "MCD2_T04"),
    "MCD2_DOWN_LOWER_BREAKDOWN": ("SHORT", "LOWER_OVEREXTENSION_REVERSION", "M5 downtrend, below the corridor", "MCD2_T05"),
    "MCD2_DOWN_UPPER_BREAKOUT": ("SHORT", "DOWNTREND_RALLY_ABOVE_CORRIDOR", "M5 downtrend, above the corridor", "MCD2_T06"),
    "MCD2_SIDEWAYS_IN_CORRIDOR": ("NEUTRAL", "RANGE_EQUILIBRIUM", "M5 sideways, inside the corridor", "MCD2_T07"),
    "MCD2_SIDEWAYS_UPPER_BREAKOUT": ("NEUTRAL", "RANGE_RESISTANCE_REVERSION", "M5 sideways, above the corridor", "MCD2_T08"),
    "MCD2_SIDEWAYS_LOWER_BREAKDOWN": ("NEUTRAL", "RANGE_SUPPORT_REVERSION", "M5 sideways, below the corridor", "MCD2_T09"),
}

# Commentary templates (location only; no forecast, probability or advice).
TEMPLATES: Mapping[str, str] = {
    "MCD2_T01": "The M5 {metric_name} is inside the corridor, between LOEDT {loedt} and UOEDT {uoedt} (channel position {cp}), while the channel slopes up ({angle}°).",
    "MCD2_T02": "The M5 {metric_name} is {dist} above UOEDT {uoedt} while the channel slopes up ({angle}°).",
    "MCD2_T03": "The M5 {metric_name} is {dist} below LOEDT {loedt} while the channel slopes up ({angle}°).",
    "MCD2_T04": "The M5 {metric_name} is inside the corridor, between LOEDT {loedt} and UOEDT {uoedt} (channel position {cp}), while the channel slopes down ({angle}°).",
    "MCD2_T05": "The M5 {metric_name} is {dist} below LOEDT {loedt} while the channel slopes down ({angle}°).",
    "MCD2_T06": "The M5 {metric_name} is {dist} above UOEDT {uoedt} while the channel slopes down ({angle}°).",
    "MCD2_T07": "The M5 {metric_name} is inside the corridor, between LOEDT {loedt} and UOEDT {uoedt} (channel position {cp}), while the channel is flat ({angle}°).",
    "MCD2_T08": "The M5 {metric_name} is {dist} above UOEDT {uoedt} while the channel is flat ({angle}°).",
    "MCD2_T09": "The M5 {metric_name} is {dist} below LOEDT {loedt} while the channel is flat ({angle}°).",
}


# --------------------------------------------------------------------------- small helpers


def _round_half_up(value: float, decimals: int) -> float:
    """Round half up on the shortest decimal form of ``value``. Output only (standard section 11.2)."""
    rounded = float(Decimal(repr(float(value))).quantize(Decimal(1).scaleb(-decimals), rounding=ROUND_HALF_UP))
    return 0.0 if rounded == 0 else rounded


def _price(value: float) -> str:
    return f"{env.round2(value):.2f}"


def _window_bars(row: Mapping[str, Any], params: Params) -> int:
    """``N_window = max(min_window_bars, min(T_EDT, max_window_bars))`` closed M5 bars (spec sections 3 and 6).

    ``T_EDT`` is the first of ``T_EDT_FIELDS`` that is a number; with none, ``max_window_bars``.
    """
    horizon = next((row[name] for name in T_EDT_FIELDS if is_number(row.get(name))), params["max_window_bars"])
    return max(int(params["min_window_bars"]), min(int(horizon), int(params["max_window_bars"])))


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
    """Enough closed bars, ascending, and every column MCD2 reads is a number, over ``N_window`` bars."""

    def check(inputs: CycleInputs) -> pf.CheckResult:
        indicator = inputs.active_indicator[TF]
        columns = ("timestamp", "close", *dict.fromkeys(channel_columns(indicator).values()))
        window = _window_bars(_statistics_row(inputs), params)
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
        for bar in closed_bars(inputs, TF)[-_window_bars(row, params):]:
            if not bar[cols["upper"]] > bar[cols["lower"]]:
                return pf.CheckResult(rc.INVALID, (rc.SANITY_FAILED,), {"timeframe": TF, "problem": "uoedt_not_above_loedt_in_window"})
        if abs(row["regression_angle"]) > params["max_abs_regression_angle_deg"]:
            return pf.CheckResult(rc.INVALID, (rc.SANITY_FAILED,), {"timeframe": TF, "problem": "regression_angle"})
        return result

    return check


# --------------------------------------------------------------------------- the reading


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
    last = closed_bars(inputs, TF)[-1]  # the last closed bar (rule 2)
    is_fractal = indicator == "fractal"
    metric = float(last["close"] if is_fractal else last[cols["fit"]])
    upper, lower, baseline = float(last[cols["upper"]]), float(last[cols["lower"]]), float(last[cols["baseline"]])
    angle = float(row["regression_angle"])

    band = params["sideways_angle_deg"]
    trend = "UP" if angle > band else "DOWN" if angle < -band else "SIDEWAYS"
    # Decided on the prices, not on the rounded channel position (standard section 11.2).
    corridor = "UPPER_BREAKOUT" if metric > upper else "LOWER_BREAKDOWN" if metric < lower else "IN_CORRIDOR"
    state = f"MCD2_{trend}_{corridor}"
    bias, regime, summary, template_id = STATES[state]

    decimals = int(params["channel_position_decimals"])
    position = _round_half_up((metric - lower) / (upper - lower), decimals)
    commentary = TEMPLATES[template_id].format(
        metric_name="Close" if is_fractal else "SSA",
        loedt=_price(lower),
        uoedt=_price(upper),
        cp=f"{position:.{decimals}f}",
        angle=f"{env.round2(angle):+.2f}",
        dist=_price(max(metric - upper, lower - metric, 0.0)),
    )
    details = {
        "trend_direction": trend,
        "regression_angle_deg": env.round2(angle),
        "channel_position": position,
        "window_bars": _window_bars(row, params),
        "containment_rate": env.round2(row["containment_rate"]),
        "reversion_setup": corridor != "IN_CORRIDOR",
        "populated_candidates": outcome.details.get("populated_candidates", {}),
    }
    levels = [
        {"name": "UOEDT", "tf": TF, "price": upper, "role": "resistance"},
        {"name": "baseline", "tf": TF, "price": baseline, "role": "mid"},
        {"name": "LOEDT", "tf": TF, "price": lower, "role": "support"},
    ]
    reading = dict(
        state_code=state, bias=bias, summary_line=summary, commentary=commentary, levels=levels,
        regime_status=regime, details=details, **context,
    )
    if outcome.status == rc.CAUTIONARY:
        return env.cautionary(MCD_ID, EVALUATOR_VERSION, inputs.cycle_slot, list(outcome.reasons), **reading)
    return env.valid(MCD_ID, EVALUATOR_VERSION, inputs.cycle_slot, **reading)


@env.never_throws(MCD_ID, EVALUATOR_VERSION)
def evaluate(inputs: CycleInputs, params: Params, upstream: Mapping[str, Any]) -> dict[str, Any]:
    """One envelope per cycle, always (INVALID and STALE included). ``upstream`` is unused: independent MCD."""
    return _evaluate(inputs, params)
