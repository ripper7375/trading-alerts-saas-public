# MCD0: Channel fit quality gate

Status: Approved (Davin, 1 October 2026; built in task P5) · Version: 1.0.0 · Kind: gate · Timeframe(s): M5 and M15

New MCD, built from walkthrough Part C4 (its concept is read back in `concept.md`, confirmed by Davin on 1 October 2026).
It replaces the 4-Quadrant gate of the archived file C (§3 and §4.1). Decisions applied: D3 (tier-1 meaning, in the
kit; MCD0 uses only its setting half, §4), D4 (English), D8 (the open questions (a) to (f) of Part C4, answered by
Davin on 1 October 2026 together with (g) to (j), see §14).

## 1. Question and purpose

**Question:** Is each timeframe's active channel fitted well enough to trust the channel sensors? That is, on M5 and on
M15, does the active EDT channel meet the four fit pillars (coverage, R-squared, fit ratio, symmetry) for each of the
two models, Model A (SSA crossings) and Model B (close price)?

**Purpose:** caution. MCD0 gives no direction, no entry zone and no stop. When a timeframe is a defect, the worker marks
every channel MCD that reads that timeframe CAUTIONARY with `MCD0_DEFECT_M5` or `MCD0_DEFECT_M15` (ADR-018), and
Section 6 then pre-sets half the risk ([ADR-061](../../../docs/adr/061-defect-flag-halves-the-pre-set-risk.md)).

## 2. Kind and horizon

- Kind: **gate** (standard §1, §9.2). It reads market statistics only and runs first in the cycle, before the independent
  MCDs (architecture §2.2).
- Horizon: none. A gate has no states that are measured on a trader horizon (no forward outcomes, no `state_statistics`);
  what is measured instead is its flag rate in the shadow period (§9).

## 3. Inputs

| Input       | Detail                                                                                                                                                                                                                                                                                                                                                                      |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Timeframes  | M5 and M15, both on every cycle                                                                                                                                                                                                                                                                                                                                             |
| Bars        | **None.** MCD0 reads no bar, so the closed-bar rule has nothing to cut; a forming bar in the bundle changes nothing (T4). The envelope's `last_closed_bar` is `{}` because no bar is read (question Q1)                                                                                                                                                                     |
| Statistics  | The `indicator_statistics` row for `(timeframe, source)` captured at `stats_slot[timeframe]`, for each timeframe. `source` is the setting's value, with `fractal` read as `fractal_edt`                                                                                                                                                                                     |
| Fields used | Every source: `window_span_bars`, `regression_angle`, `model_b_r2`, `model_b_mse`, `model_b_skew`, `uoedt_offset`, `loedt_offset`, `channel_width`. The seven centroid sources also: `model_a_r2`, `model_a_mse`, `model_a_skew`. Information only (never required): `model_a_var_ratio`, `model_a_kurt` (centroids), `model_b_var_ratio`, `model_b_kurt`                   |
| Upstream    | None (a gate)                                                                                                                                                                                                                                                                                                                                                               |
| Other       | `active_indicator[M5]` and `active_indicator[M15]` (the settings), `config_hash[source]`, cycle data status and the `retuning` flag                                                                                                                                                                                                                                         |
| **Window**  | None. MCD0 judges the fit the indicator already computed over its own window; the only count it reads is the span, `window_span_bars`, which runs from the leftmost evaluated bar to the live bar inclusive (Schema). The live bar is the still-open bar, so the span in closed bars is `window_span_bars − t_edt_open_bar_rows` (`t_edt_open_bar_rows` = 1, as in ADR-083) |

The statistics fields that describe the forming bar or the last price (`live_bar_ts`, `live_close`, `baseline_value`,
`uoedt_value`, `loedt_value`, `dist_to_*`, `channel_position`, `sr_nearest_*`, `sr_dist_*_pts`) are not in the bundle and
are not used. `channel_width`, `uoedt_offset` and `loedt_offset` are fit descriptors (the same on every bar of a
parallel channel), not prices, and stay in the bundle.

## 4. Active-indicator use

Reads the setting for **M5** (eight candidates: `best_fit_a`, `best_fit_b`, `cherry_a`, `cherry_b`, `most_recent`,
`non_a`, `non_b`, `fractal`) and for **M15** (the seven centroid candidates). Any one of them can be active on either
timeframe, so no rule assumes a particular one (rule 6, ADR-010). **Model A exists for the seven centroid sources and not
for `fractal_edt`**; this is decided by the source name, never by a null value (decision (e)).

Detection is not used. Tier 1 checks the setting only (decision (g)): MCD0 reads no bars, so it cannot compare candidates
on the last closed bar, and it emits neither `DETECTION_MISMATCH` nor `populated_candidates`. The channel MCDs, which read
bars, keep that cross-check.

## 5. Pre-flight checks

Order fixed by the standard: cycle, tier 1, tier 4, tier 2, tier 3. The first failing check decides and later checks do
not run. **There is one status for the whole envelope** (decision (h)): if either timeframe cannot be read, the reading is
STALE or INVALID, and the worker inherits nothing from MCD0 that cycle. Both timeframes pass a check before the next
check runs, in the order M5 then M15.

| Check               | What it tests                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Failure → status + reason code                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Cycle               | `data_status` is FRESH, DELAYED, STALE or MARKET_CLOSED; RETUNING flag                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Unknown value: INVALID + `SANITY_FAILED` · STALE: STALE + `DATA_STALE` · RETUNING: CAUTIONARY + `RETUNING` (continues) |
| Tier 1 · Indicator  | A setting exists for M5 and for M15 and is one of that timeframe's candidates. Nothing else (§4)                                                                                                                                                                                                                                                                                                                                                                                                                                      | No setting or not a candidate: INVALID + `NO_SETTING`                                                                  |
| Tier 4 · Statistics | A row for the active source at the slot, on each timeframe. Containment is **not** tested (decision (j))                                                                                                                                                                                                                                                                                                                                                                                                                              | No row or wrong slot: STALE + `NO_STATS_AT_SLOT`                                                                       |
| Tier 2 · Continuity | None: MCD0 reads no bars                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | —                                                                                                                      |
| Tier 3 · Sanity     | On each timeframe's row: every required field of §3 is a number (a string, a boolean, NaN or infinity is not); `uoedt_offset` > 0; `loedt_offset` < 0; `channel_width` > 0; each model's `MSE` > 0 (Model A only for a centroid source). Required fields are decided by the source name. A required field that is null is a missing field. The bundle's `config_hash` is a mapping, and its entry for an active source, when there is one, is a string (it is copied into the envelope; a missing entry is left out of `config_hash`) | INVALID + `SANITY_FAILED`                                                                                              |
| Upstream            | None (a gate)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | —                                                                                                                      |
| MCD0 inheritance    | Not applicable: MCD0 is the source of this flag, applied by the worker to the channel MCDs                                                                                                                                                                                                                                                                                                                                                                                                                                            | —                                                                                                                      |
| Unexpected error    | Any exception inside the evaluator                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | INVALID + `EVALUATOR_ERROR`, logged                                                                                    |

The reason codes `INSUFFICIENT_BARS`, `DISCONTINUITY`, `CONTAINMENT_LOW` and `DETECTION_MISMATCH` are never emitted by
MCD0 (no bars, no containment test, no cross-check). A defect is not a failure: it is a VALID reading whose state names
the defective timeframe.

## 6. Calculation

Symbols, for one timeframe (row = the statistics row of its active source): N = `window_span_bars`; θ =
`regression_angle` (degrees, signed); U = `uoedt_offset` (UOEDT − baseline, above 0); D = −`loedt_offset` (baseline −
LOEDT, above 0); W = `channel_width` (UOEDT − LOEDT = U + D); for a model m (A or B): R²_m, MSE_m, skew_m. Everything is
computed in full precision, compared on the unrounded values and rounded at output only.

**The eight pillars.** Coverage and the geo ratio belong to the channel and are tested once; the others are tested for
each applicable model.

| Pillar id  | Test                                                                                    | Parameters                                 |
| ---------- | --------------------------------------------------------------------------------------- | ------------------------------------------ |
| `COVERAGE` | N_closed = N − `t_edt_open_bar_rows`; passes when N_closed ≥ `min_coverage_bars`        | `min_coverage_bars`, `t_edt_open_bar_rows` |
| `R2_A`     | R²_A ≥ `min_r2_model_a`                                                                 | `min_r2_model_a`                           |
| `R2_B`     | R²_B ≥ `min_r2_model_b`                                                                 | `min_r2_model_b`                           |
| `FIT_A`    | fit ratio_A = (W ÷ 2) ÷ √MSE_A; passes when `min_fit_ratio` ≤ ratio ≤ `max_fit_ratio`   | `min_fit_ratio`, `max_fit_ratio`           |
| `FIT_B`    | fit ratio_B = (W ÷ 2) ÷ √MSE_B, with Model B's own MSE (decision (b)), same bounds      | `min_fit_ratio`, `max_fit_ratio`           |
| `GEO`      | geo ratio = U ÷ D; passes when `min_geo_ratio` ≤ ratio ≤ `max_geo_ratio` (decision (c)) | `min_geo_ratio`, `max_geo_ratio`           |
| `SKEW_A`   | \|skew_A\| ≤ `max_abs_skew`                                                             | `max_abs_skew`                             |
| `SKEW_B`   | \|skew_B\| ≤ `max_abs_skew`                                                             | `max_abs_skew`                             |

Every bound is inclusive (≥, ≤); a value exactly at a bound passes. The fit ratio uses W ÷ 2 because File C defines the
half height as (UOEDT − LOEDT) ÷ 2; the geo ratio is (UOEDT − baseline) ÷ (baseline − LOEDT), which is U ÷ D.

**Pillars not applied** (`skipped`, decisions (d) and (e)):

- Flat channel: when |θ| ≤ `flat_angle_deg`, `R2_A` and `R2_B` are not applied. Above the angle they are applied. The rule
  is keyed to the angle of whatever indicator is active.
- Fractal EDT: `R2_A`, `FIT_A` and `SKEW_A` are not applied (no Model A); that timeframe is judged on Model B, coverage
  and geo ratio. The Model A fields are not read even if present.

**Timeframe verdict:** `DEFECT` when any applied pillar fails, `QUALIFIED` when none does (non-compensatory: no pillar
makes up for another). `failed` lists the failed pillars and `skipped` the pillars not applied, both in `pillar_order`; a
pillar in neither passed. A timeframe is a `DEFECT` exactly when its `failed` list is not empty.

**State** = the pair of verdicts (M5, M15):

| M5          | M15         | State                |
| ----------- | ----------- | -------------------- |
| `QUALIFIED` | `QUALIFIED` | `MCD0_ALL_QUALIFIED` |
| `DEFECT`    | `QUALIFIED` | `MCD0_M5_DEFECT`     |
| `QUALIFIED` | `DEFECT`    | `MCD0_M15_DEFECT`    |
| `DEFECT`    | `DEFECT`    | `MCD0_M5_M15_DEFECT` |

**Information only** (decision (f)): `model_a_var_ratio`, `model_a_kurt`, `model_b_var_ratio` and `model_b_kurt` are
reported in `details` as values. They have no label words and no effect on the state, and a missing or non-numeric
value is reported as `null` without changing the status (question Q3).

| Parameter             | Value | Unit        | Boundary                                                     | Rationale                                                                                        |
| --------------------- | ----- | ----------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `min_coverage_bars`   | 60    | closed bars | N_closed ≥ value passes                                      | File C pillar 1: at least 5 h of M5 and 15 h of M15                                              |
| `t_edt_open_bar_rows` | 1     | rows        | N_closed = N − value                                         | `window_span_bars` includes the still-open bar; same name and value as MCD1 to MCD3 (ADR-083)    |
| `min_r2_model_a`      | 0.70  | R-squared   | ≥ value passes                                               | ADR-019, architecture §2.4                                                                       |
| `min_r2_model_b`      | 0.65  | R-squared   | ≥ value passes                                               | ADR-019, architecture §2.4                                                                       |
| `flat_angle_deg`      | 5.0   | degrees     | \|θ\| ≤ value: the R-squared pillars are not applied         | A flat channel explains almost no variance by slope; the ±5° band of MCD1 to MCD3 (decision (d)) |
| `min_fit_ratio`       | 1.50  | ratio       | ≥ value passes                                               | File C pillar 3: below it the channel is over-fitted                                             |
| `max_fit_ratio`       | 3.20  | ratio       | ≤ value passes                                               | File C pillar 3: above it the channel is under-fitted                                            |
| `min_geo_ratio`       | 0.60  | ratio       | ≥ value passes                                               | File C pillar 4, kept by decision (c); the flag rate is measured in shadow                       |
| `max_geo_ratio`       | 1.65  | ratio       | ≤ value passes                                               | File C pillar 4                                                                                  |
| `max_abs_skew`        | 1.50  | skewness    | \|skew\| ≤ value passes                                      | File C pillar 4; each model's own skew (question Q2)                                             |
| `ratio_decimals`      | 4     | decimals    | Output rounding only (R-squared, fit ratio, geo ratio)       | Verdicts sit close to their bounds on real data (R² 0.6876 against 0.70)                         |
| `statistic_decimals`  | 2     | decimals    | Output rounding only (skew, variance ratio, kurtosis, angle) | The indicator stores these at two decimals                                                       |

## 7. State register

Exhaustive and exclusive: every VALID or CAUTIONARY evaluation maps to exactly one of four states. Bias is NEUTRAL in all
four (a gate has no direction, standard §7.2). No state contributes a level and none has a regime word. Machine-readable
copy with the template texts: `mcd0_registry.yaml`.

| State code           | M5 / M15              | `regime_status` | Bias    | Meaning (market description, not advice)                                                           | Summary / commentary |
| -------------------- | --------------------- | --------------- | ------- | -------------------------------------------------------------------------------------------------- | -------------------- |
| `MCD0_ALL_QUALIFIED` | qualified / qualified | none            | NEUTRAL | The active M5 channel and the active M15 channel meet every fit criterion                          | S01 / T01            |
| `MCD0_M5_DEFECT`     | defect / qualified    | none            | NEUTRAL | The active M5 channel misses at least one fit criterion and the active M15 channel meets every one | S02 / T02            |
| `MCD0_M15_DEFECT`    | qualified / defect    | none            | NEUTRAL | The active M15 channel misses at least one fit criterion and the active M5 channel meets every one | S03 / T03            |
| `MCD0_M5_M15_DEFECT` | defect / defect       | none            | NEUTRAL | Both the active M5 channel and the active M15 channel miss at least one fit criterion              | S04 / T04            |

**Summary lines** (≤ 80 characters, no prices): `S01` "M5 and M15 channel fit meets every criterion" · `S02` "M5 channel
fit misses a criterion, M15 meets all" · `S03` "M15 channel fit misses a criterion, M5 meets all" · `S04` "M5 and M15
channel fits each miss a criterion".

**Commentary templates** (fit description only; no forecast, probability or advice; no `%`):

| Id  | Template                                                                                                                                 |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| T01 | `The M5 channel ({m5_indicator}) and the M15 channel ({m15_indicator}) meet every fit criterion.`                                        |
| T02 | `The M5 channel ({m5_indicator}) misses fit criteria: {m5_failed}. The M15 channel ({m15_indicator}) meets every fit criterion.`         |
| T03 | `The M15 channel ({m15_indicator}) misses fit criteria: {m15_failed}. The M5 channel ({m5_indicator}) meets every fit criterion.`        |
| T04 | `The M5 channel ({m5_indicator}) misses fit criteria: {m5_failed}. The M15 channel ({m15_indicator}) misses fit criteria: {m15_failed}.` |

`{m5_indicator}` and `{m15_indicator}` are the settings' values (`best_fit_a`, `non_b`, `fractal`, …). `{m5_failed}` and
`{m15_failed}` are the distinct words of the failed pillars of that timeframe, in `pillar_order`, joined by ", ": coverage
· R2 · fit ratio · geo ratio · skew. Commentary names the criterion and not the model (R2 stands for `R2_A` and `R2_B`
alike); the model is in `details.failed`. This keeps the largest envelope inside the 600-token budget (question Q5). File
C's "Green light for high-conviction trade setups" and "Over-fit (wicks breach)" are not carried over (standard §7.4).

## 8. Levels

None. MCD0 contributes no level (`levels: []` in every reading), so no zone width applies (standard §8: "an MCD whose
answer has no price meaning contributes none").

## 9. Synthesis role

- **Gate**, neither voter nor modifier. MCD0 has no rung (`rung: {}`; architecture §2.13 shows a dash) and proposes no
  rule row: its effect reaches synthesis only as CAUTIONARY on the channel MCDs, applied by the worker (ADR-018,
  standard §9.2), and from there as the pre-set half risk (ADR-061). MCD0 changes no other envelope.
- **Not an input to any MCD:** no MCD lists MCD0 in `depends_on`, and MCD3 does not read it.
- **Flag rate:** on the three real slots the thresholds flag every channel under the fixture settings (`concept.md` §6),
  and the decisions of 1 October 2026 change none of those six readings. Of the other populated channels, only M15 `non_a`
  qualifies: v3 on its own merits, v4 because it is flat and the R² pillars are skipped. If this holds live, most channel
  readings would be CAUTIONARY, so the shadow period (stage 4) must measure MCD0's flag rate before any MCD goes live
  (walkthrough Part 0 item 3). A threshold changes only by a new decision entry and a MINOR version.
- **Data problems:** if MCD0 is STALE or INVALID, the worker applies no flag that cycle (decision (h)); the same missing row
  already makes the channel MCDs on that timeframe unavailable.

## 10. Routing and knowledge

Proposals; all of this is stage 6 work and waits for the sensor worker, synthesis and the knowledge build.

| Item                    | Content                                                                                                                                                                                                                                                                                                                                  |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dispatch-matrix intents | **Explain** (the terms MCD0 owns: coverage, R-squared, fit ratio, geo ratio, skew, channel fit). Warnings always reach the prompt in full (ADR-041), so a defect is visible through the CAUTIONARY channel MCDs and the Section 6 defect flag; **Explain only** (Davin, 1 October 2026): MCD0 is not routed to Direction or Entry timing |
| `tags.yaml`             | `MCD0`; the four state codes; no regime words; no level names                                                                                                                                                                                                                                                                            |
| Playbook chunk (D2)     | Front-matter `mcd_id: MCD0`, `state_codes` (four), `timeframe: [M5, M15]`, `version: 1.0.0`. Sections: what it checks; the four pillars and their bounds; how to read a defect (provisional until the shadow flag rate is known); what a skipped pillar means (flat channel, fractal EDT); what it does not say (no direction)           |
| Foundations chunk (D1)  | The EDT channel fit: coverage, R-squared, fit ratio, geo ratio, skew, Model A and Model B in plain English                                                                                                                                                                                                                               |
| Glossary                | Coverage, R-squared, fit ratio, geo ratio (symmetry), skew, Model A, Model B (all 16 languages)                                                                                                                                                                                                                                          |
| Reason texts            | `DATA_STALE`, `RETUNING`, `NO_SETTING`, `NO_STATS_AT_SLOT`, `SANITY_FAILED`, `EVALUATOR_ERROR` and the two flags MCD0 causes, `MCD0_DEFECT_M5` and `MCD0_DEFECT_M15` (all 16 languages)                                                                                                                                                  |
| Labelled questions      | "Is the channel reliable?" and "why is this setup flagged?" in all 16 languages (build step 6)                                                                                                                                                                                                                                           |

## 11. `details` contents

`details` has one object per timeframe, `M5` and `M15`.

| Field (per timeframe) | Type            | Meaning                                                                                                                                           |
| --------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `failed`              | list of strings | The pillar ids that failed, in `pillar_order` (empty when the timeframe is qualified; non-empty exactly when it is a defect)                      |
| `skipped`             | list of strings | The pillar ids not applied: `R2_A` and `R2_B` on a flat channel; `R2_A`, `FIT_A` and `SKEW_A` on the fractal EDT. A pillar in neither list passed |
| `coverage`            | integer         | N_closed: `window_span_bars − t_edt_open_bar_rows`, in closed bars                                                                                |
| `geo_ratio`           | number          | U ÷ D, `ratio_decimals` decimals                                                                                                                  |
| `model_a`             | object or null  | `r2`, `fit_ratio` (`ratio_decimals` decimals), `skew`, `var_ratio`, `kurtosis` (`statistic_decimals` decimals); `null` on the fractal EDT         |
| `model_b`             | object          | The same fields for Model B                                                                                                                       |

Not in `details`, to stay inside the token budget (question Q5): the statistics source and the setting are already in the
envelope's `active_indicator` (`fractal` stands for the source `fractal_edt`); the timeframe verdict is `failed` being
non-empty and is the state; the regression angle is used only for the flat test and is shown by `skipped`.

INVALID and STALE readings carry an empty `details`. Measured on hand-built envelopes with the kit's counter
(`o200k_base`): the largest case, every pillar failed on both timeframes with Model A and Model B values, is 555 tokens
(561 with the RETUNING reason). The built evaluator is measured in task P5 (T12).

## 12. Worked example

**Slot `2026-09-18T20:55Z` (v1 replica), settings M5 = `best_fit_a`, M15 = `non_b`.** Statistics slots: M5 20:55, M15
20:45. The bundle holds one closed bar per timeframe (T4 needs one); MCD0 reads none.

| Timeframe · source | Coverage (closed) | R² A / B          | Fit ratio A / B | Geo ratio | Skew A / B    | Angle (input) | Failed                   |
| ------------------ | ----------------- | ----------------- | --------------- | --------- | ------------- | ------------- | ------------------------ |
| M5 · `best_fit_a`  | 754               | −0.1016 / −0.1210 | 0.5130 / 0.5331 | 1.0000    | −0.85 / −0.79 | 6.94          | R2_A, R2_B, FIT_A, FIT_B |
| M15 · `non_b`      | 1807              | 0.6828 / 0.6550   | 1.2242 / 1.1369 | 0.7425    | −1.33 / −1.28 | −29.72        | R2_A, FIT_A, FIT_B       |

| Step                | Result                                                                                                                                                     |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pre-flight          | All pass (no tier-1 cross-check, no containment test)                                                                                                      |
| State, bias, status | `MCD0_M5_M15_DEFECT` · NEUTRAL · VALID (both timeframes have a non-empty `failed`)                                                                         |
| Levels              | none                                                                                                                                                       |
| Summary             | "M5 and M15 channel fits each miss a criterion"                                                                                                            |
| Commentary (T04)    | "The M5 channel (best_fit_a) misses fit criteria: R2, fit ratio. The M15 channel (non_b) misses fit criteria: R2, fit ratio."                              |
| `details.M5`        | `failed` R2_A, R2_B, FIT_A, FIT_B · `skipped` none · `coverage` 754 · `geo_ratio` 1.0 · `model_a` r2 −0.1016, fit_ratio 0.513, skew −0.85, … · `model_b` … |

Two other real readings: v3 `2026-09-28T14:15Z` with M15 set to `non_a` gives `MCD0_M5_DEFECT` (M5 `cherry_a` misses
`R2_A` and `R2_B`; M15 `non_a` meets every pillar: coverage 487, R² 0.7712 / 0.7274, fit ratio 2.6059 / 2.5428, geo ratio
1.4351, skew 1.05 / 0.61). v4 `2026-09-28T23:15Z` with M15 set to `non_a` gives `MCD0_M5_DEFECT` too: `non_a` is flat
(−0.56°), so `R2_A` and `R2_B` are skipped and it meets the remaining pillars (R² −0.0856 / −0.1572 would have failed
them), while M5 `cherry_a` misses `R2_A` (0.6876 against 0.70).

## 13. Tests

Standard §12, T1 to T13 (T14 is for derived MCDs and does not apply). Detail: `mcd0_implementation_plan.md` §3.

- T1: one test per state (four), from synthetic bundles (`MCD0_ALL_QUALIFIED` and `MCD0_M15_DEFECT` have no real example).
- T2: boundaries just below, at and just above each bound: coverage `window_span_bars` 60 / 61 / 62 (closed 59 / 60 / 61)
  and the parameter `t_edt_open_bar_rows`; R² A 0.6999 / 0.70 / 0.7001; R² B 0.6499 / 0.65 / 0.6501; fit ratio at 1.5 and
  3.2 (just inside and outside), with each model's own MSE; geo ratio at 0.6 and 1.65; \|skew\| at 1.5; \|θ\| at 5.0 / 5.01
  (flat skip); MSE, `uoedt_offset`, `loedt_offset` and `channel_width` at 0 and just beyond.
- T3: one test per pre-flight failure: `SANITY_FAILED` (unknown `data_status`; each required field null, a string, a
  boolean, NaN; MSE ≤ 0 per model; offsets of the wrong sign; width ≤ 0; Model A missing on a centroid; a `config_hash` that is not a mapping or has a non-string entry for an active source), `DATA_STALE`,
  `RETUNING` (continues, state kept), `NO_SETTING` (missing and not a candidate, on each timeframe), `NO_STATS_AT_SLOT`
  (each timeframe), `EVALUATOR_ERROR`; the order of the checks (M15 STALE before M5 INVALID); the codes MCD0 never emits.
- Decisions (d) to (j) as tests: flat skip and its boundary; fractal EDT with and without Model A values; a centroid
  without them; informational fields null; no containment test (a row at 10% containment reads normally); bars absent,
  corrupt or too few change nothing; a setting that names an unpopulated candidate gives STALE and never
  `DETECTION_MISMATCH`.
- T4 to T8, T10 to T12: the kit's shared checks (T6 as the no-setting half only, T10 skipping the three bar corruptions,
  because MCD0 reads no bars); T12 on the worst case, every pillar failed on both timeframes (and its RETUNING variant).
- Output: a bad `config_hash` never reaches the envelope, even when an earlier check stops the reading; a statistic of exactly zero is shown as 0.0, never as −0.0 or another value (P6 findings F1 and F2).
- T9: replay of the stored fixtures. T13: the real readings of §12 and `mcd0_implementation_plan.md` §5.

## 14. Open questions

Davin answered the concept's questions (a) to (k) on 1 October 2026; they are applied above and recorded in `concept.md`
§11. He answered Q1 to Q5 below on 1 October 2026 as recommended (approved: `last_closed_bar` `{}`, each model's own
skew, information fields optional, empty rung and no rule rows, the trimmed envelope) and routed MCD0 to the Explain intent
only (§10). The questions below were not in the concept; each carries the recommendation this specification follows.

| #   | Question                                                                                                                                                                                                                                                                                                                                                                                                                             | Recommendation                                                             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| Q1  | **`last_closed_bar`.** The envelope field is "per timeframe read, the open time of the last closed bar" (standard §5). MCD0 reads no bar, so it is `{}`. The alternative reports the bundle's last closed bar of each timeframe for provenance, which would suggest MCD0 read it                                                                                                                                                     | `{}`, with `active_indicator` and `config_hash` filled for both timeframes |
| Q2  | **Skew per model.** File C names the close-price skew; Part C4 lists `model_a_skew` and `model_b_skew` and puts \|skew\| in every quadrant. This specification tests each model's own skew (`SKEW_A`, `SKEW_B`), as it tests each model's own R² and MSE. On the 11 real channel rows no skew pillar fails                                                                                                                           | Each model's own skew                                                      |
| Q3  | **Information fields.** Variance ratio and kurtosis are not required: a null or non-numeric value is `null` in `details` and never a failure, because they cannot change the state (decision (f))                                                                                                                                                                                                                                    | Never required                                                             |
| Q4  | **Rungs and rule rows.** None for a gate (§9). Confirm that MCD0 has an empty rung and proposes no rule rows                                                                                                                                                                                                                                                                                                                         | Confirm                                                                    |
| Q5  | **Envelope size.** With the verdict, the source and the angle in `details` and the model named in commentary, the worst case measured 660 tokens (the real v1 reading 582) against the 600 budget. The design above drops those three, names the criterion rather than the model in commentary, and measures 555 (561 with RETUNING). The alternative keeps them and asks for a higher ceiling for MCD0, as Davin did for MCD3 (A22) | The trimmed design (every value and every pass or fail stays in `details`) |

Not questions, recorded for the reader: (a) the statistics' fit windows may include the still-open bar (unverified,
tracked in `.claude/state/waiting-on.md`); MCD0 reads R², MSE, skew and the offsets from those fits, so the item is
inherited and must be settled before certification. (b) `regression_angle` is used only for the flat test, so MCD0 has no
angle bound of its own (MCD2 checks \|θ\| ≤ 90) and does not output it. (c) Model A and Model B of one timeframe share coverage and the geo
ratio, so those two pillars are listed once, not twice, in `failed`.
