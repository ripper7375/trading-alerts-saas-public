# DavinTrade — Decision Layer Blueprint

## Indicator Selection · Parameterization · Drift Alerting · Analysis Methodology · Trading Advice

**Status:** Forward design / north-star for the stacks to be built **on top of**
the certified v2.29/v6 data pipeline. Not yet implemented.
**Last Updated:** 2026-06-13
**Audience:** Stack-development team. This is the planning bible for the
"decision layer" — everything above the data pipeline.
**Reference image:** `methodology-of-providing-trading-recommendation.jpg`
(the 3-chart multi-timeframe methodology this layer must reproduce reliably).

> **Read this first.** The certified pipeline (see
> `DATA_COLLECTION_PIPELINE_BLUEPRINT_v2_29.md`) turns raw XAUUSD price into a
> clean, validated, per-bar feature table (`market_data`) plus a parameterized
> calculation engine. THIS document specifies the four workstreams that sit on
> that foundation and end in a trading recommendation:
>
> (1) Indicator selection + parameterization → the _right tools, fitted_
> (2) Drift alerting → _stay fitted as markets move_
> (3) Analysis methodology → _read the fitted charts_
> (4) Trading advice & recommendation → _turn the read into a call_
>
> **Sequencing law (do not violate):** (1) gates (3) gates (4). A perfect
> recommendation agent fed an ill-fitted indicator produces confident, wrong
> advice — garbage in, garbage out. (2) runs continuously to keep (1) valid.

---

## 0. First principles & non-negotiables

1. **Fitness is measured, not guessed.** Every indicator/parameter choice is
   scored by the statistics the calc stack already emits (R², MSE,
   variance-ratio, skew/kurtosis, touch counts, EDT containment, line angle).
   No component "eyeballs" fitness as its source of truth.
2. **Deterministic compute, AI judgment, human accountability.** Search and
   scoring are deterministic (cheap, reproducible). LLM agents interpret,
   propose, and explain within admin-defined bounds. A human owns the call
   that customers depend on.
3. **Overfitting is the enemy.** Every selection/parameterization decision is
   validated out-of-sample (walk-forward); parsimony and stability are rewarded;
   over-tuned configs are penalized. A setup that fits recent price perfectly
   but fails forward is worse than useless — it is actively misleading.
4. **Honesty of framing.** DavinTrade is a consistent, explainable analyst that
   applies a defined method 24/7 — **not a profit oracle**. Output is
   educational analysis/signals with explicit invalidation and disclaimers.
5. **Everything is auditable.** Selections, parameter sets, drift events, and
   recommendations are stored with provenance and rationale, so any call can be
   reconstructed and reviewed.

---

## 1. Foundation already in place (what these stacks build on)

| Asset (certified/built)                                                          | What the decision layer gets from it                                                                                                                                                                                     |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `market_data` (v6 schema)                                                        | Per-bar, validated features for XAUUSD M5/M15: OHLCV, 6 centroid families (channel baseline/UOEDT/LOEDT + ssa/ema_ssa/crossing), fractal/resistance/support lines, z-score candle set, zigzag pivots + structure metrics |
| `centroid_regression.py` + `CentroidRegressionParams` / `VARIANT_PRESETS`        | A **parameterized** engine — sweepable parameters (the prerequisite for dynamic selection)                                                                                                                               |
| `fractal_lines.py`, `zigzag_metrics.py`, `zscore_candle.py`                      | Parameterized line/structure/candle calculators                                                                                                                                                                          |
| Statistics buffers (R², MSE, var-ratio, skew, kurt, touches, angle, EDT offsets) | The **fitness substrate** — selection/drift scoring read these directly                                                                                                                                                  |
| `golden_certification` + `CERTIFICATION.md`                                      | Proof the Python outputs match MQL5 (M15 100%, M5 accepted) — the calc layer is trustworthy                                                                                                                              |

The two hardest prerequisites — a clean validated feature table and a
parameterized calc engine — are **done**. The decision layer is additive.

---

## 2. Workstream (1): Indicator Selection + Parameterization

**Goal:** for the current market, choose _which_ indicators (tools) to use and
_what_ parameter values fit them, producing the analytical setup the 3-chart
methodology consumes. Wrong here ⇒ everything downstream is wrong.

### 2.1 It is a measurable model-selection problem

For any indicator + parameter set evaluated over a window, define a **fitness
score** from the calc stack's own metrics, e.g.:

- **Centroid channel:** R² (close model), variance-ratio near 1 (residual
  stationarity), EDT containment rate (fraction of bars inside UOEDT/LOEDT),
  line angle within sane bounds, recent touch quality.
- **Fractal / S&R / wedge lines:** touch count, touch tolerance respected,
  angle, time-since-last-touch (still "live"), both-sides flip for the flip line.
- **ZigZag:** pivot cadence sanity (not too many/few for the regime), %-change
  classification distribution.
- **Z-score candle:** classification distribution stability.

Fitness is a **weighted, documented rubric** (admin-owned), not a single magic
number. Output per candidate: `{score, sub-scores, in-sample window,
out-of-sample window, parameters}`.

### 2.2 Components to build

| Component                 | Role                                                                                                                                       | AI?                |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------ |
| `param_search`            | For each indicator, sweep candidate parameter sets over recent history (coarse→fine, sensible ranges, metric pruning); return ranked top-N | No (deterministic) |
| `fitness_scorer`          | Compute the rubric scores (incl. out-of-sample) for a given indicator+params over a window                                                 | No (deterministic) |
| `regime_classifier`       | Label current regime (trend/range/volatility) from centroid slope + variance-ratio + zigzag structure; selection is regime-aware           | No / light         |
| `render_alternatives`     | Render the top-N configs as chart images (the "5–6 alternatives") over `market_data` for human comparison                                  | No                 |
| `selection_agent` (later) | Read scores + regime, **propose** a selection within bounds, explain why; human approves                                                   | Yes (bounded)      |
| `selection_store`         | Persist the chosen config per symbol/timeframe with provenance, score snapshot, and who/what selected it                                   | No                 |

### 2.3 Flow

```
market_data (recent window)
      │
      ▼
param_search  ──►  candidate (indicator, params) sets
      │
      ▼
fitness_scorer (in-sample + OUT-OF-SAMPLE)  +  regime_classifier
      │
      ▼
ranked top-N  ──►  render_alternatives (5–6 chart images)
      │                                   │
      ▼                                   ▼
selection_agent proposes (bounded)   human reviews & decides   ◄── start here
      │                                   │
      └──────────────►  selection_store  ◄┘   (active config per symbol/TF)
```

### 2.4 Overfitting controls (mandatory, not optional)

- Score on a **holdout/out-of-sample** window separate from the fit window.
- **Walk-forward**: fit on [t-N, t-k], validate on (t-k, t]; a config that only
  wins in-sample is rejected.
- **Parsimony/stability penalty**: prefer fewer parameters and configs whose
  score is stable across adjacent windows (low score variance) over a config
  that spikes on one window.
- **Sanity bounds**: hard parameter ranges (admin-set) so search can't wander
  into degenerate fits.

### 2.5 Start human-in-the-loop

Begin with `param_search` + `fitness_scorer` + `render_alternatives` + **manual
selection**. This: builds trust, satisfies the governance posture (a human signs
off on the analytical setup), and generates labeled preference data to later
train/guide `selection_agent`. Automate selection only once scores are shown to
correlate with good forward outcomes (§6 metrics).

---

## 3. Workstream (2): Drift Alerting

**Goal:** markets change continuously; a config fitted last week may misrepresent
today. Continuously re-score the **active** config and alert when re-selection
or re-parameterization is due.

### 3.1 Mechanism

- On each new bar/cycle, `fitness_scorer` re-evaluates the _currently active_
  config (from `selection_store`) against fresh `market_data`.
- Maintain a rolling fitness series; detect degradation by:
  - threshold breach (score < admin floor), and/or
  - regime change (the `regime_classifier` label flips), and/or
  - structural break (e.g. centroid R² collapse, EDT containment drop,
    line no longer touched for K bars).
- **Hysteresis + confirmation**: require the degraded condition to persist for
  M consecutive bars before alerting, so alerts don't flap.

### 3.2 Alert payload & routing

`{symbol, timeframe, active_config, current_score, floor, regime_before/after,
reason, suggested_action, top_alternative_preview}` → operator dashboard /
notification. The alert should carry a **proposed re-selection** (the new top-N
from §2) so the human can act in one step.

### 3.3 Components

| Component       | Role                                                                              |
| --------------- | --------------------------------------------------------------------------------- |
| `drift_monitor` | Re-score active config per cycle; maintain rolling series; apply hysteresis       |
| `drift_alert`   | Emit structured alert + suggested re-selection on confirmed degradation           |
| `drift_log`     | Persist every drift event (audit + later analysis of how often/why configs drift) |

This is the operations safety net that keeps Workstream (1) honest over time —
and the natural home for the "alert system upon revision/adjustment" requirement.

---

## 4. Workstream (3): Trading Analysis Methodology (the 3-chart read)

**Goal:** reproduce the `methodology-of-providing-trading-recommendation.jpg`
read **reliably**, using the _fitted_ indicators from (1). This is the bridge
between fitted setups and a recommendation.

### 4.1 Decompose the reference image into explicit, detectable facts

The image shows a multi-timeframe confluence:

| Panel         | Indicators                                                 | The read (must become a deterministic detector + label)                                                               |
| ------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| M15 context   | centroid regression channel                                | trend state (down/up/range) + "safety room" = distance from price to channel boundary (UOEDT/LOEDT) and direction     |
| M15 structure | zigzag + fractal lines + z-score candles + single-best R/S | pattern = converging trendlines ⇒ **wedge**; "could break resistance" = price near upper wedge boundary with momentum |
| M5 entry      | centroid regression channel                                | current short-TF trend = bullish; entry **zone (B)**                                                                  |
| Synthesis     | all of the above, time-aligned (the yellow zones)          | conditional plan: "approach (B) + confirmation (e.g. double bottom on M5) ⇒ buy"                                      |

### 4.2 Make every gestalt a detector (do not let the LLM eyeball patterns)

| Pattern / state                     | Deterministic detector (from `market_data`)                                                   |
| ----------------------------------- | --------------------------------------------------------------------------------------------- |
| Trend state                         | sign + magnitude of centroid slope/angle; R² as confidence                                    |
| Safety room                         | signed distance of close to UOEDT/LOEDT vs channel width                                      |
| Wedge                               | resistance & support lines converging (slopes opposite-signed, gap shrinking), N touches each |
| Channel position                    | where close sits between baseline and EDTs                                                    |
| Double bottom / confirmation candle | two near-equal zigzag troughs + a z-score "large/extreme" reversal candle                     |
| Breakout                            | close crossing a fitted line beyond tolerance, with candle confirmation                       |

Each detector emits `{present: bool, confidence, supporting_values}`. The agent
(Workstream 4) reasons over these _facts_, it does not invent them.

### 4.3 Time alignment

The yellow zones = same wall-clock window across M15 and M5. The analysis must
align panels on `timestamp_adj` (see the pipeline blueprint §7 — the
timestamp-conversion stack is a prerequisite for trustworthy cross-timeframe
alignment).

### 4.4 Components

| Component        | Role                                                                          |
| ---------------- | ----------------------------------------------------------------------------- |
| `detectors`      | The library of deterministic state/pattern detectors above                    |
| `mtf_aligner`    | Align M15 + M5 detector facts on a common window                              |
| `analysis_state` | The structured, time-aligned "board state" handed to the recommendation agent |

---

## 5. Workstream (4): Trading Advice & Recommendation

**Goal:** turn the time-aligned analysis state into a structured, explainable,
conditional recommendation — exactly the green box in the reference image.

### 5.1 The agent

An LLM agent (Claude Agent SDK shape) given:

- **the methodology as an explicit rubric** (the system prompt encodes how to
  combine the panels — context TF + structure + entry TF),
- **the detector facts** for the aligned window (from Workstream 3),
- **tools** to query history / fitness / `market_data` as needed.

It outputs a **structured recommendation**, e.g.:

```json
{
  "symbol": "XAUUSD",
  "as_of": 1781311800,
  "bias": "bullish",
  "context_m15": "downtrend with upside safety room (A)",
  "structure_m15": "bullish wedge; resistance breakout pending",
  "entry_m5": "bullish; entry zone (B) 4180-4195",
  "trigger": "price approaches (B) AND M5 double-bottom confirmation forms",
  "invalidation": "M5 close below 4150",
  "confidence": 0.62,
  "rationale": "…explicit chain referencing the detector facts…",
  "disclaimer": "Educational analysis, not financial advice."
}
```

### 5.2 Guardrails

- **Bounded outputs**: recommendation fields constrained to a schema; the agent
  cannot invent indicators or override the fitted setup.
- **Grounded rationale**: every claim must cite a detector fact; no generic
  trading lore.
- **Determinism aids**: low temperature, structured output; the _decision_ logic
  leans on detectors + rubric, the LLM does synthesis + explanation + edge cases.
- **Backtest the recommendations**: replay historical `market_data` through the
  full chain; measure outcome stats (§6) before trusting it live.
- **Human review loop**: a person can approve/annotate; disclaimers always
  attached; no auto-execution.

### 5.3 Components

| Component                   | Role                                                                    |
| --------------------------- | ----------------------------------------------------------------------- |
| `recommendation_agent`      | Methodology rubric + detector facts → structured recommendation         |
| `recommendation_store`      | Persist every recommendation with inputs + rationale (audit + backtest) |
| `recommendation_backtester` | Replay history; score recommendations against forward outcomes          |

---

## 6. Cross-cutting: how we know it works (evaluation)

- **Selection/params:** out-of-sample fitness; stability across windows;
  correlation of fitness score with forward line-respect / pattern-validity.
- **Drift:** lead time of alert vs actual regime break; false-alarm rate.
- **Methodology detectors:** precision/recall vs human-labeled charts (the
  rendered alternatives generate this labeled set).
- **Recommendations:** forward hit-rate, R-multiple distribution, max adverse
  excursion — reported honestly, not cherry-picked.

A recommendation is only as trustworthy as the chain beneath it; each layer has
its own acceptance metric so failures are localized.

---

## 7. End-to-end picture

```
            ┌──────────────────────── CERTIFIED DATA PIPELINE (done) ───────────────────────┐
            │ 12 indicators → collector(validate+CALCULATE) → market_data → push → gateway   │
            └───────────────────────────────────────┬───────────────────────────────────────┘
                                                     │  market_data (validated features)
   ┌─────────────────────────────────────────────────┼─────────────────────────────────────────┐
   │ DECISION LAYER (this document)                   ▼                                           │
   │  (1) param_search + fitness_scorer + regime  →  render 5-6 alternatives  →  human/agent select│
   │                         │ active config (selection_store)                                     │
   │  (2) drift_monitor ◄────┘  re-score active config each cycle → drift_alert (re-select)        │
   │                         │                                                                     │
   │  (3) detectors + mtf_aligner  →  analysis_state (the 3-chart read, time-aligned)              │
   │                         │                                                                     │
   │  (4) recommendation_agent (methodology rubric + facts) → structured recommendation → review   │
   └──────────────────────────────────────────────────────────────────────────────────────────────┘
                                                     │
                                                     ▼
                              DavinTrade UI / alerts  (educational analysis, disclaimers)
```

---

## 8. Recommended build order (de-risked)

1. **`fitness_scorer`** — reuses the calc stack; turns the existing statistics
   into a fitness rubric. (Foundation for everything.)
2. **`param_search` + `render_alternatives`** — the human-in-the-loop selection
   studio the 3-chart quality depends on. Ship this first; it unblocks (3)/(4)
   on human-curated configs.
3. **`detectors` + `mtf_aligner`** — make the methodology's gestalts explicit.
   (Depends on the timestamp-conversion stack from the pipeline blueprint §7/§13
   for trustworthy M15/M5 alignment.)
4. **`recommendation_agent`** (+ store + backtester) — synthesis on
   human-approved setups; backtest before live.
5. **`drift_monitor` + `drift_alert`** — once a baseline of "good" scores exists
   to set floors against.
6. **`selection_agent`** — automate the human's selection only after scores are
   shown to correlate with good outcomes.

Each step is usable on its own and de-risks the next; nothing is blocked waiting
on a "perfect" auto-selector.

---

## 9. Open dependencies & risks (carried from the pipeline)

- **Timestamp-conversion stack** (pipeline blueprint §7/§13) — required for
  trustworthy multi-timeframe alignment in Workstream (3).
- **Gateway migration** (pipeline §9/§13) — so recommendations have a serving
  path.
- **Overfitting** — the dominant risk of Workstreams (1)/(2); the controls in
  §2.4 are mandatory.
- **Regulatory framing** — "advice" carries licensing weight; ship as
  educational analysis/signals with disclaimers and no auto-execution; confirm
  per jurisdiction.
- **LLM variability** — contained by detectors + rubric + structured output +
  low temperature; the LLM explains and synthesizes, it does not decide alone.

---

## 10. One-line summary

Build a **measured selection + drift layer** that keeps the right indicators
fitted to the live market, feed its fitted setups into **explicit detectors**
that reproduce the 3-chart read, and let a **bounded, grounded agent** turn that
read into an explainable, conditional recommendation — consistent and
transparent, never an oracle, always auditable, with a human accountable for the
call.
