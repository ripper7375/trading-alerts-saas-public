"""A stub channel MCD (``MCD9``) built on the kit, used only to exercise the shared checks.

It answers one question: is the last closed M5 close inside, above or below the active M5
corridor? It is not one of the fifteen MCDs. ``bug`` switches on one deliberate violation so the
tests can prove that each shared check notices it.
"""

from __future__ import annotations

from typing import Any, Mapping

from mcd_common import envelope as env
from mcd_common import preflight as pf
from mcd_common.cycle_inputs import (
    CycleInputs,
    Params,
    channel_columns,
    closed_bars,
)

MCD_ID = "MCD9"
VERSION = "1.0.0"
TIMEFRAMES = ("M5",)

STATES = {
    "MCD9_INSIDE_CORRIDOR": ("NEUTRAL", "M5 price inside the corridor", "Close {close} is inside the corridor between LOEDT {loedt} and UOEDT {uoedt}."),
    "MCD9_ABOVE_CORRIDOR": ("NEUTRAL", "M5 price above the corridor", "Close {close} is above UOEDT {uoedt}."),
    "MCD9_BELOW_CORRIDOR": ("NEUTRAL", "M5 price below the corridor", "Close {close} is below LOEDT {loedt}."),
}

PARAMS = Params.from_dict(
    {
        "mcd_id": MCD_ID,
        "evaluator_version": VERSION,
        "parameters": {
            "min_containment_rate": {"value": 50.0, "unit": "percent", "boundary": ">= value passes tier 4", "why": "Channel intact at 50% containment"},
            "min_window_bars": {"value": 48, "unit": "closed M5 bars", "boundary": ">= value", "why": "4 hours of M5"},
        },
    }
)


def _evaluate(inputs: CycleInputs, params: Params, upstream: Mapping[str, Any], bug: str | None) -> dict[str, Any]:
    window = int(params["min_window_bars"])
    outcome = pf.run_preflight(
        inputs,
        tier1=pf.indicator_check(TIMEFRAMES) if bug != "ignores_setting" else None,
        tier4=pf.statistics_check(TIMEFRAMES, min_containment=params["min_containment_rate"]) if bug != "latest_stats" else None,
        tier2=pf.bars_check({"M5": window}),
        tier3=pf.sanity_check(TIMEFRAMES),
    )
    indicator = inputs.active_indicator.get("M5") if bug != "ignores_setting" else "best_fit_a"
    common = env.reading_context(inputs, TIMEFRAMES)
    if outcome.stop:
        return env.unavailable(outcome.status, MCD_ID, VERSION, inputs.cycle_slot, list(outcome.reasons), **common)

    if bug == "reads_forming_bar":
        bars = list(inputs.bars["M5"])  # unfiltered: includes an open bar if the bundle has one
    else:
        bars = closed_bars(inputs, "M5")
    if bug == "nondeterministic":
        import random

        random.seed()
        jitter = random.random()
    else:
        jitter = 0.0
    last = bars[-1]
    cols = channel_columns(indicator)
    close, upper, lower, base = last["close"] + jitter, last[cols["upper"]], last[cols["lower"]], last[cols["baseline"]]
    if close > upper:
        state = "MCD9_ABOVE_CORRIDOR"
    elif close < lower:
        state = "MCD9_BELOW_CORRIDOR"
    else:
        state = "MCD9_INSIDE_CORRIDOR"
    bias, summary, template = STATES[state]
    levels = [
        {"name": "UOEDT", "tf": "M5", "price": upper, "role": "resistance"},
        {"name": "baseline", "tf": "M5", "price": base, "role": "mid"},
        {"name": "LOEDT", "tf": "M5", "price": lower, "role": "support"},
    ]
    commentary = template.format(close=f"{close:.2f}", uoedt=f"{upper:.2f}", loedt=f"{lower:.2f}")
    details = {"populated_candidates": outcome.details.get("populated_candidates", {}), "window_bars": window}
    if bug == "schema_breaker":
        summary = "x" * 200  # longer than 80 characters
    if outcome.status == "CAUTIONARY":
        return env.cautionary(MCD_ID, VERSION, inputs.cycle_slot, list(outcome.reasons), state_code=state, bias=bias,
                              summary_line=summary, commentary=commentary, levels=levels, details=details, **common)
    return env.valid(MCD_ID, VERSION, inputs.cycle_slot, state_code=state, bias=bias, summary_line=summary,
                     commentary=commentary, levels=levels, details=details, **common)


@env.never_throws(MCD_ID, VERSION)
def evaluate(inputs: CycleInputs, params: Params, upstream: Mapping[str, Any]) -> dict[str, Any]:
    return _evaluate(inputs, params, upstream, None)


def evaluator_with_bug(bug: str):
    """The stub with one deliberate violation. ``raises`` is not wrapped, so it really throws."""
    if bug == "raises":
        def evaluate_raises(inputs, params, upstream):
            return _evaluate(inputs, params, upstream, None)["details"]["missing"]  # KeyError, unguarded

        return evaluate_raises
    if bug == "schema_breaker":
        return lambda inputs, params, upstream: _evaluate(inputs, params, upstream, bug)

    @env.never_throws(MCD_ID, VERSION)
    def buggy(inputs, params, upstream):
        return _evaluate(inputs, params, upstream, bug)

    return buggy
