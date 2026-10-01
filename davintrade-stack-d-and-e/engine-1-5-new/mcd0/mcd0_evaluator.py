"""MCD0: channel fit quality gate. Evaluator 1.0.0.

New MCD built from walkthrough Part C4. Specification: ``mcd0.md``. Parameters: ``mcd0_params.yaml``. State register,
pillar words and templates: ``mcd0_registry.yaml``.

``evaluate(inputs, params, upstream) -> envelope`` is a pure function of the kit's frozen input bundle (standard
section 11.2, rule R4): no file, database, network, clock, randomness, environment variable or model call. It never
raises (R7): ``never_throws`` turns any error into INVALID + ``EVALUATOR_ERROR``. It reads the statistics row at the
slot for the active source of M5 and of M15 (R2, R3) and **no bar at all**, so the closed-bar rule has nothing to cut.

Question: is each timeframe's active channel fitted well enough to trust the channel sensors? Each timeframe is judged on
eight pillars (coverage, R-squared, fit ratio, geo ratio, skew; per model where they are per model). A timeframe is a
defect when any applied pillar fails; the state is the pair of verdicts. A gate has no direction, no level and no regime
word; the worker, not this evaluator, marks the channel MCDs CAUTIONARY.
"""

from __future__ import annotations

import math
from decimal import ROUND_HALF_UP, Decimal
from typing import Any, Mapping

from mcd_common import envelope as env
from mcd_common import preflight as pf
from mcd_common import reason_codes as rc
from mcd_common.cycle_inputs import (
    CANDIDATES,
    CENTROID_CANDIDATES,
    CycleInputs,
    Params,
    is_number,
    statistics_source,
)

MCD_ID = "MCD0"
EVALUATOR_VERSION = "1.0.0"
TIMEFRAMES = ("M5", "M15")

# Model A (SSA crossings) exists for the seven centroid sources and not for the fractal EDT. Decided by the source name,
# never by a null value (decision (e)).
CENTROID_SOURCES = frozenset(CENTROID_CANDIDATES)

# Required statistics fields (spec section 3). Variance ratio and kurtosis are information only and never required.
COMMON_FIELDS = (
    "window_span_bars",
    "regression_angle",
    "model_b_r2",
    "model_b_mse",
    "model_b_skew",
    "uoedt_offset",
    "loedt_offset",
    "channel_width",
)
MODEL_A_FIELDS = ("model_a_r2", "model_a_mse", "model_a_skew")

# Pillar ids in the order they are listed in ``details`` and in commentary (spec section 6). Kept equal to
# ``mcd0_registry.yaml`` by a test.
PILLAR_ORDER = ("COVERAGE", "R2_A", "R2_B", "FIT_A", "FIT_B", "GEO", "SKEW_A", "SKEW_B")

# The word each pillar contributes to commentary. Commentary names the criterion, not the model, to stay inside the
# 600-token budget (spec question Q5); the model is in ``details.failed``.
PILLAR_LABELS: Mapping[str, str] = {
    "COVERAGE": "coverage",
    "R2_A": "R2",
    "R2_B": "R2",
    "FIT_A": "fit ratio",
    "FIT_B": "fit ratio",
    "GEO": "geo ratio",
    "SKEW_A": "skew",
    "SKEW_B": "skew",
}

# State register: code -> (bias, regime_status, summary_line, commentary template id). A gate is NEUTRAL in every state
# and has no regime word. Kept equal to mcd0_registry.yaml by a test.
STATES: Mapping[str, tuple[str, None, str, str]] = {
    "MCD0_ALL_QUALIFIED": ("NEUTRAL", None, "M5 and M15 channel fit meets every criterion", "MCD0_T01"),
    "MCD0_M5_DEFECT": ("NEUTRAL", None, "M5 channel fit misses a criterion, M15 meets all", "MCD0_T02"),
    "MCD0_M15_DEFECT": ("NEUTRAL", None, "M15 channel fit misses a criterion, M5 meets all", "MCD0_T03"),
    "MCD0_M5_M15_DEFECT": ("NEUTRAL", None, "M5 and M15 channel fits each miss a criterion", "MCD0_T04"),
}

# Commentary templates (fit description only; no forecast, probability or advice).
TEMPLATES: Mapping[str, str] = {
    "MCD0_T01": "The M5 channel ({m5_indicator}) and the M15 channel ({m15_indicator}) meet every fit criterion.",
    "MCD0_T02": "The M5 channel ({m5_indicator}) misses fit criteria: {m5_failed}. The M15 channel ({m15_indicator}) meets every fit criterion.",
    "MCD0_T03": "The M15 channel ({m15_indicator}) misses fit criteria: {m15_failed}. The M5 channel ({m5_indicator}) meets every fit criterion.",
    "MCD0_T04": "The M5 channel ({m5_indicator}) misses fit criteria: {m5_failed}. The M15 channel ({m15_indicator}) misses fit criteria: {m15_failed}.",
}


# --------------------------------------------------------------------------- small helpers


def _round_half_up(value: float, decimals: int) -> float:
    """Round half up on the shortest decimal form of ``value``. Output only (standard section 11.2)."""
    rounded = float(Decimal(repr(float(value))).quantize(Decimal(1).scaleb(-decimals), rounding=ROUND_HALF_UP))
    return 0.0 if rounded == 0 else rounded


def _source(inputs: CycleInputs, timeframe: str) -> str:
    return statistics_source(inputs.active_indicator[timeframe])


def _row(inputs: CycleInputs, timeframe: str) -> Mapping[str, Any]:
    return inputs.statistics[(timeframe, _source(inputs, timeframe))]


def _required_fields(source: str) -> tuple[str, ...]:
    return COMMON_FIELDS + (MODEL_A_FIELDS if source in CENTROID_SOURCES else ())


def _info(value: Any, decimals: int) -> float | None:
    """An information field (variance ratio, kurtosis): its value, or ``None`` when it is missing or not a number.
    Never a failure (decision (f), spec question Q3)."""
    return _round_half_up(value, decimals) if is_number(value) else None


# --------------------------------------------------------------------------- pre-flight content


def _tier1(inputs: CycleInputs) -> pf.CheckResult:
    """Tier 1 is the setting only (decision (g)): a setting exists for M5 and for M15 and is a candidate of that
    timeframe. MCD0 reads no bar, so there is no detection cross-check and no ``populated_candidates``."""
    for tf in TIMEFRAMES:
        name = inputs.active_indicator.get(tf)
        if not isinstance(name, str) or name not in CANDIDATES[tf]:
            return pf.CheckResult(rc.INVALID, (rc.NO_SETTING,), {"timeframe": tf})
    return pf.CheckResult(pf.PASS)


def _tier3(inputs: CycleInputs) -> pf.CheckResult:
    """Sanity of each timeframe's statistics row (decision (i)): every required field is a number (a string, a boolean,
    NaN or infinity is not; a null is a missing field), ``uoedt_offset`` above 0, ``loedt_offset`` below 0,
    ``channel_width`` above 0 and each used MSE above 0. The required fields follow the source name.

    The ``config_hash`` of the active source reaches the envelope, so when the bundle carries one for that source it must
    be a string (a missing entry is allowed and is simply left out), and the mapping itself must be a mapping (P6 finding
    F1, 2026-10-01)."""
    hashes = inputs.config_hash
    if not isinstance(hashes, Mapping):
        return pf.CheckResult(rc.INVALID, (rc.SANITY_FAILED,), {"problem": "config_hash_not_a_mapping"})
    for tf in TIMEFRAMES:
        source = _source(inputs, tf)
        row = _row(inputs, tf)
        for name in _required_fields(source):
            if not is_number(row.get(name)):
                return pf.CheckResult(rc.INVALID, (rc.SANITY_FAILED,), {"timeframe": tf, "problem": "required_field", "field": name})
        positive = ["channel_width", "uoedt_offset", "model_b_mse"]
        if source in CENTROID_SOURCES:
            positive.append("model_a_mse")
        for name in positive:
            if not row[name] > 0:
                return pf.CheckResult(rc.INVALID, (rc.SANITY_FAILED,), {"timeframe": tf, "problem": "not_above_zero", "field": name})
        if not row["loedt_offset"] < 0:
            return pf.CheckResult(rc.INVALID, (rc.SANITY_FAILED,), {"timeframe": tf, "problem": "loedt_offset_not_below_zero"})
        if source in hashes and not isinstance(hashes[source], str):
            return pf.CheckResult(rc.INVALID, (rc.SANITY_FAILED,), {"timeframe": tf, "problem": "config_hash_not_a_string", "source": source})
    return pf.CheckResult(pf.PASS)


# --------------------------------------------------------------------------- the judgement


def _judge(source: str, row: Mapping[str, Any], params: Params) -> dict[str, Any]:
    """The eight pillars on one timeframe's row (spec section 6), every comparison on the unrounded values.

    Returns the pillar ids that failed and those not applied (both in ``PILLAR_ORDER``) and the ``details`` of the
    timeframe. A pillar in neither list passed.
    """
    open_rows = params["t_edt_open_bar_rows"]
    coverage = row["window_span_bars"] - open_rows  # closed bars: the live bar is the still-open one
    upper, lower = row["uoedt_offset"], -row["loedt_offset"]
    geo = upper / lower
    half = row["channel_width"] / 2
    flat = abs(row["regression_angle"]) <= params["flat_angle_deg"]

    outcome: dict[str, bool | None] = {pillar: None for pillar in PILLAR_ORDER}  # None: not applied
    outcome["COVERAGE"] = coverage >= params["min_coverage_bars"]
    outcome["GEO"] = params["min_geo_ratio"] <= geo <= params["max_geo_ratio"]

    models: dict[str, dict[str, Any] | None] = {"A": None, "B": None}
    for model, min_r2 in (("A", params["min_r2_model_a"]), ("B", params["min_r2_model_b"])):
        if model == "A" and source not in CENTROID_SOURCES:
            continue  # no Model A on the fractal EDT: R2_A, FIT_A and SKEW_A are not applied
        key = model.lower()
        r2, mse, skew = row[f"model_{key}_r2"], row[f"model_{key}_mse"], row[f"model_{key}_skew"]
        fit = half / math.sqrt(mse)  # each model's own MSE (decision (b))
        if not flat:  # a flat channel explains almost no variance by slope (decision (d))
            outcome[f"R2_{model}"] = r2 >= min_r2
        outcome[f"FIT_{model}"] = params["min_fit_ratio"] <= fit <= params["max_fit_ratio"]
        outcome[f"SKEW_{model}"] = abs(skew) <= params["max_abs_skew"]  # each model's own skew (spec question Q2)
        ratio_decimals, stat_decimals = int(params["ratio_decimals"]), int(params["statistic_decimals"])
        models[model] = {
            "r2": _round_half_up(r2, ratio_decimals),
            "fit_ratio": _round_half_up(fit, ratio_decimals),
            "skew": _round_half_up(skew, stat_decimals),
            "var_ratio": _info(row.get(f"model_{key}_var_ratio"), stat_decimals),
            "kurtosis": _info(row.get(f"model_{key}_kurt"), stat_decimals),
        }

    failed = [pillar for pillar in PILLAR_ORDER if outcome[pillar] is False]
    skipped = [pillar for pillar in PILLAR_ORDER if outcome[pillar] is None]
    return {
        "failed": failed,
        "details": {
            "failed": failed,
            "skipped": skipped,
            "coverage": int(coverage) if float(coverage).is_integer() else coverage,
            "geo_ratio": _round_half_up(geo, int(params["ratio_decimals"])),
            "model_a": models["A"],
            "model_b": models["B"],
        },
    }


def _words(pillars: list[str]) -> str:
    """The distinct commentary words of the failed pillars, in ``PILLAR_ORDER``."""
    return ", ".join(dict.fromkeys(PILLAR_LABELS[pillar] for pillar in pillars))


# --------------------------------------------------------------------------- the reading


def _evaluate(inputs: CycleInputs, params: Params) -> dict[str, Any]:
    outcome = pf.run_preflight(
        inputs,
        tier1=_tier1,
        tier4=pf.statistics_check(TIMEFRAMES),  # the row at the slot; no containment test (decision (j))
        tier3=_tier3,
    )
    context = env.reading_context(inputs, TIMEFRAMES)
    context["last_closed_bar"] = {}  # MCD0 reads no bar (spec question Q1)
    # Only text hashes may reach the envelope (schema: config_hash values are strings). Tier 3 rejects a bad hash of an
    # active source; this also covers a reading that an earlier check stopped (P6 finding F1, 2026-10-01).
    context["config_hash"] = {k: v for k, v in context.get("config_hash", {}).items() if isinstance(v, str)}
    if outcome.stop:
        return env.unavailable(outcome.status, MCD_ID, EVALUATOR_VERSION, inputs.cycle_slot, list(outcome.reasons), **context)

    judged = {tf: _judge(_source(inputs, tf), _row(inputs, tf), params) for tf in TIMEFRAMES}
    m5_defect, m15_defect = bool(judged["M5"]["failed"]), bool(judged["M15"]["failed"])
    state = (
        "MCD0_M5_M15_DEFECT" if m5_defect and m15_defect
        else "MCD0_M5_DEFECT" if m5_defect
        else "MCD0_M15_DEFECT" if m15_defect
        else "MCD0_ALL_QUALIFIED"
    )
    bias, regime, summary, template_id = STATES[state]
    commentary = TEMPLATES[template_id].format(
        m5_indicator=inputs.active_indicator["M5"],
        m15_indicator=inputs.active_indicator["M15"],
        m5_failed=_words(judged["M5"]["failed"]),
        m15_failed=_words(judged["M15"]["failed"]),
    )
    reading = dict(
        state_code=state, bias=bias, summary_line=summary, commentary=commentary, regime_status=regime,
        details={tf: judged[tf]["details"] for tf in TIMEFRAMES}, **context,
    )
    if outcome.status == rc.CAUTIONARY:
        return env.cautionary(MCD_ID, EVALUATOR_VERSION, inputs.cycle_slot, list(outcome.reasons), **reading)
    return env.valid(MCD_ID, EVALUATOR_VERSION, inputs.cycle_slot, **reading)


@env.never_throws(MCD_ID, EVALUATOR_VERSION)
def evaluate(inputs: CycleInputs, params: Params, upstream: Mapping[str, Any]) -> dict[str, Any]:
    """One envelope per cycle, always (INVALID and STALE included). ``upstream`` is unused: a gate has none."""
    return _evaluate(inputs, params)
