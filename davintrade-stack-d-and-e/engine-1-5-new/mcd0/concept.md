# MCD0 concept (readback of walkthrough Part C4)

Source images: none. MCD0 has no concept board; its concept is walkthrough Part C4, read together with standard §9.2,
architecture §2.4, [ADR-018](../../../docs/adr/018-quality-gate-becomes-mcd0.md),
[ADR-019](../../../docs/adr/019-r-squared-threshold-per-model.md) and the archived file C (§3 and §4.1, the 4-Quadrant
gate), as walkthrough Part E (task P4) and standard §11.1 provide for. `concept/` is therefore not created (git cannot
hold an empty folder).

Written in task P4 on 1 October 2026 and **confirmed by Davin on 1 October 2026**; his answers to questions (a) to (k) are in
section 11. Every rule is marked **C4** (walkthrough Part C4),
**Std** (standard §9.2 and §6), **Arch** (architecture §2.4), **ADR** (a settled decision), **File C** (the archived
4-Quadrant criteria) or **Schema** (a definition in `prisma/market-data/schema.prisma`). What these sources leave open is
in section 10 with a recommendation; nothing there is decided here.

## 1. Core principle

> Is each timeframe's active channel fitted well enough to trust the channel sensors (MCD1, MCD2, MCD3)?

MCD0 is a **gate**. It judges the fit of the M5 channel and of the M15 channel from the statistics the indicator wrote
for the cycle, never from the bars. It has no direction, no levels and no market view. When a timeframe's fit is
defective, the worker marks the channel MCDs that read that timeframe CAUTIONARY, and that makes Section 6 pre-set half
the risk ([ADR-061](../../../docs/adr/061-defect-flag-halves-the-pre-set-risk.md)).

## 2. Timeframes and candidate indicators

- Timeframes: **M5** and **M15**, both on every cycle (C4).
- Candidate indicators, any one of them active per timeframe, chosen by the setting (rule 6,
  [ADR-010](../../../docs/adr/010-active-indicator-setting-per-timeframe.md)): the seven centroid variants `best_fit_a`,
  `best_fit_b`, `cherry_a`, `cherry_b`, `most_recent`, `non_a`, `non_b` on both timeframes, plus the fractal EDT on M5
  (statistics source `fractal_edt`). MCD0 never assumes a particular one (C4).
- Never candidates (no channel, so no UOEDT or LOEDT): `resistance`, `support`, `sr_levels`, `sr2_levels`.
- The tests run MCD0 with more than one candidate as the active source (C4, question (d)).

## 3. Rules

The 2 × 2 grid is four quadrants: Model A (SSA crossings) and Model B (close price) on M5 and on M15 (File C §3). Each
quadrant has four pillars.

| #   | Rule                                                                                                                                                                                                                   | Source                |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| R1  | MCD0 reads only the `indicator_statistics` row captured at the slot for each timeframe's active source. No bars.                                                                                                       | C4, rule 5            |
| R2  | **Coverage:** N_span ≥ 60 bars (File C: N_span = live bar − start anchor + 1; at least 5 h of M5 and 15 h of M15). Which field holds N_span is question (a).                                                           | C4, File C            |
| R3  | **R²:** Model A ≥ 0.70 and Model B ≥ 0.65, each judged on its own.                                                                                                                                                     | ADR-019, Arch         |
| R4  | **Fit ratio** = ((UOEDT − LOEDT) ÷ 2) ÷ √MSE; it passes when 1.50 ≤ ratio ≤ 3.20. File C reads below 1.50 as over-fitted (wicks breach) and above 3.20 as under-fitted (too loose). Which model's MSE is question (b). | C4, Arch              |
| R5  | **Symmetry:** the geo ratio = (UOEDT − baseline) ÷ (baseline − LOEDT) lies in 0.60 to 1.65, **and** \|skew\| ≤ 1.50. Whether the geo ratio gates is question (c).                                                      | C4, Arch              |
| R6  | **Quadrant verdict is non-compensatory:** a quadrant passes only when all four pillars pass. No pillar can make up for another.                                                                                        | File C §4.1           |
| R7  | **Timeframe verdict:** a timeframe is a defect when any pillar of either model fails (File C: any failure is a defect).                                                                                                | C4, File C            |
| R8  | MCD0 emits **one envelope per cycle**. Its state says which timeframes are defective; each pillar's value and pass or fail, per timeframe, are in `details`; bias NEUTRAL; no levels; `depends_on` empty.              | C4, Std §9.2          |
| R9  | The **worker**, not MCD0, marks channel MCDs on a defective timeframe CAUTIONARY + `MCD0_DEFECT_M5` or `MCD0_DEFECT_M15`, using each registry's `uses_channel`. MCD0 itself changes no other envelope.                 | C4, Std §9.2, ADR-018 |
| R10 | The thresholds are **starting values**. MCD0's flag rate is measured in the shadow period; a threshold changes only by a new decision entry and a MINOR version (standard §14).                                        | C4, ADR-019           |

Formula note. With offsets measured from the baseline (Schema: `uoedt_offset` above it, `loedt_offset` below it, so
negative), UOEDT − baseline = `uoedt_offset`, baseline − LOEDT = −`loedt_offset` and UOEDT − LOEDT = `channel_width`.
On all 11 real channel rows `channel_width` equals `uoedt_offset − loedt_offset` to within 0.00001. These are fit
descriptors, not live-bar prices, so the kit keeps them in the bundle.

## 4. States

Four states, one per combination of the two timeframe verdicts (exhaustive and exclusive). The old File C wording
`QUALIFIED (ALL-PASS)` and `DEFECT_DETECTED` becomes the codes below. Bias is NEUTRAL for every state because a gate has
no direction (standard §7.2, C4).

| State                | When                                 | What it means (plain)                                                       | Bias    | Example time                                             |
| -------------------- | ------------------------------------ | --------------------------------------------------------------------------- | ------- | -------------------------------------------------------- |
| `MCD0_ALL_QUALIFIED` | Both timeframes pass every pillar    | The active M5 and M15 channels meet every fit criterion                     | NEUTRAL | None on the replicas (synthetic)                         |
| `MCD0_M5_DEFECT`     | M5 has a failed pillar, M15 has none | The M5 channel misses at least one fit criterion; the M15 channel meets all | NEUTRAL | v3 slot with M15 set to `non_a` (a real channel, see §6) |
| `MCD0_M15_DEFECT`    | M15 has a failed pillar, M5 has none | The M15 channel misses at least one fit criterion; the M5 channel meets all | NEUTRAL | None on the replicas (synthetic)                         |
| `MCD0_M5_M15_DEFECT` | Both timeframes have a failed pillar | Neither active channel meets every fit criterion                            | NEUTRAL | v1, v3 and v4 slots with the settings of D2 (all six)    |

## 5. No answer when

Failure is a status with a reason code, never a state (standard §6). The first failing check decides, and there is one
status for the whole envelope.

| Situation                                                          | Status and reason (standard §6, C4)             |
| ------------------------------------------------------------------ | ----------------------------------------------- |
| The cycle's data status is STALE                                   | STALE + `DATA_STALE`                            |
| The data status is none of the four known values                   | INVALID + `SANITY_FAILED`                       |
| A promote is in progress                                           | CAUTIONARY + `RETUNING` (the reading continues) |
| No setting for M5 or for M15                                       | INVALID + `NO_SETTING`                          |
| No statistics row at the slot for the active source of a timeframe | STALE + `NO_STATS_AT_SLOT` (C4)                 |
| A required field is null, or the channel width is not positive     | INVALID + `SANITY_FAILED` (C4)                  |
| Any exception inside the evaluator                                 | INVALID + `EVALUATOR_ERROR`                     |

C4 does not say what happens in these cases, and they are questions: whether MCD0 cross-checks detection without bars
(g), a timeframe that cannot be measured while the other can (h), the sanity checks beyond "null or width not positive"
(i), and containment (j).

## 6. Example times and test slots

The thresholds applied literally (each pillar as in section 3, own MSE per model, no exemptions) to the active channels
of the three stored real slots. The values come from the stored fixture bundles; nothing is run against a workbook.

| Slot                                 | Setting (M5 / M15)     | M5 channel                                                    | M15 channel                                                                                    | State                |
| ------------------------------------ | ---------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | -------------------- |
| v1 · `2026-09-18T20:55Z`             | `best_fit_a` / `non_b` | Defect: R² −0.10 and −0.12, fit ratio 0.51 and 0.53 (A and B) | Defect: R² A 0.68, fit ratio 1.22 and 1.14                                                     | `MCD0_M5_M15_DEFECT` |
| v3 · `2026-09-28T14:15Z`             | `cherry_a` / `non_b`   | Defect: R² 0.40 and 0.40                                      | Defect: R² 0.56 and 0.45                                                                       | `MCD0_M5_M15_DEFECT` |
| v4 · `2026-09-28T23:15Z`             | `cherry_a` / `non_b`   | Defect: R² A 0.6876 (below 0.70); B 0.6883 passes             | Defect: R² 0.40 and 0.17                                                                       | `MCD0_M5_M15_DEFECT` |
| v3 · `2026-09-28T14:15Z`, M15 re-set | `cherry_a` / `non_a`   | Defect (as above)                                             | **Qualified:** span 488, R² 0.77 and 0.73, fit 2.61 and 2.54, geo 1.44, \|skew\| 1.05 and 0.61 | `MCD0_M5_DEFECT`     |
| v4 · `2026-09-28T23:15Z`, M15 re-set | `cherry_a` / `non_a`   | Defect (as above)                                             | Defect only on R² (−0.09 and −0.16); the channel is flat (−0.56°). See question (d)            | `MCD0_M5_M15_DEFECT` |

On the six active channels the failed pillars are only R² and the fit ratio; coverage, geo ratio and skew never fail
there. The same literal reading flags **all six** active-channel readings. That is what Part 0 item 3 of the walkthrough expected: if it holds on live data, every channel
MCD would be CAUTIONARY on most cycles, so the shadow period must measure it before any MCD goes live. The Schema says
a low or negative Model B R² is "structurally expected" for lines fitted to centroids or touches and "not by itself a
fault"; the thresholds are settled ([ADR-019](../../../docs/adr/019-r-squared-threshold-per-model.md)) and are not
questioned here.

A replica holds statistics for its export slot only, so `MCD0_ALL_QUALIFIED` and `MCD0_M15_DEFECT` are tested with
synthetic bundles. Closest values to a boundary on the real rows: v4 M5 `cherry_a` R² A 0.6876 against 0.70, v4 M15
`non_b` fit ratio B 1.51 against 1.50, v1 M15 `non_b` R² B 0.655 against 0.65.

## 7. Data used

Each statistics field was checked in the `IndicatorStatistic` model of `prisma/market-data/schema.prisma` and in the 11
channel rows (v1: 3, v3: 4, v4: 4) of the stored fixture bundles, which hold all of them (the kit drops only live-bar,
last-price and storage fields). MCD0 reads no `market_data_v6` column.

| Data                                                                         | Where                                                 | Exists |
| ---------------------------------------------------------------------------- | ----------------------------------------------------- | ------ |
| `model_a_r2`, `model_b_r2`                                                   | `indicator_statistics`, source = the active indicator | yes    |
| `model_a_mse`, `model_b_mse`                                                 | same                                                  | yes    |
| `model_a_skew`, `model_b_skew`                                               | same                                                  | yes    |
| `uoedt_offset`, `loedt_offset`, `channel_width`                              | same                                                  | yes    |
| The span field: `window_span_bars` (recommended; alternatives in (a))        | same                                                  | yes    |
| `regression_angle` (for question (d))                                        | same                                                  | yes    |
| `model_a_var_ratio`, `model_b_var_ratio`, `model_a_kurt`, `model_b_kurt` (f) | same                                                  | yes    |
| `captured_at` (the slot match, tier 4)                                       | same                                                  | yes    |

On the fractal EDT, all `model_a_*` fields are null (3 of 3 real rows); Model B is present. `fractal_edt` has no Model A.

7b. Levels contributed: **none** (a gate). The row in architecture §2.13 already says "None".

## 8. Wording the standard will change

| File C wording                                                      | New                                                                                                                   |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `QUALIFIED (ALL-PASS)`, `DEFECT_DETECTED`                           | The four state codes in section 4                                                                                     |
| "Green light for high-conviction trade setups"                      | Removed (R9, standard §7.4): MCD0 describes channel fit and never advises                                             |
| "Over-fit (wicks breach)", "Under-fit (too loose)"                  | Each pillar's value and pass or fail only; no interpretive label in the output                                        |
| `FLAG: VOLATILITY_EXPANDING`, `HIGH_TAIL_RISK` and the other labels | See question (f): values, no label words                                                                              |
| "Defect Flags for the Trade Setup Card"                             | The worker's CAUTIONARY + `MCD0_DEFECT_<TF>` ([ADR-018](../../../docs/adr/018-quality-gate-becomes-mcd0.md), ADR-061) |

## 9. Overlap with existing MCDs

- **MCD1** (M15), **MCD2** (M5) and **MCD3** (M5 and M15) are the channel MCDs MCD0 gates; their registries already
  declare `uses_channel`. No shared state, and MCD0 is not in anyone's `depends_on`: the worker applies the flag, no MCD
  reads MCD0.
- MCD1 and MCD2 read the same statistics row (angle, containment) and already end INVALID + `CONTAINMENT_LOW` below 50%
  containment. MCD0 reads different fields (fit quality). See question (j).
- ADR-018 says "MCD0 per timeframe"; standard §9.2 settles it as one envelope per cycle with a state that names the
  defective timeframes. This readback follows the standard.

## 10. Questions for Davin

### 10a. The six open questions of walkthrough Part C4 (decision D8)

Each recommendation is the suggestion in the [build user manual](../../../docs/STACK-D-BUILD-USER-MANUAL.md) §3, checked
against the stored fixtures. Davin decides.

| #   | Question                                                                                                                                                                                                                                           | What the data and the sources show                                                                                                                                                                                                                                                                                                                                           | Recommendation                                                                                                                                                                                                                                   |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| (a) | **Coverage field.** File C defines N_span = live bar − start anchor + 1. The statistics offer `window_span_bars`, `line_span_bars`, `window_bars` and `model_x_n`. Which counts the 60 bars?                                                       | `window_span_bars` is, in the Schema, "bars from the leftmost evaluated bar to the live bar, inclusive": File C's definition. On the 11 real rows it is 314 to 2035 (the 60 never binds) and equals `line_span_bars` on 10 of 11 (v3 M15 `non_a`: 488 against 500). It reaches the still-open bar, so on closed bars it is `window_span_bars − 1` (the fact behind ADR-083). | `window_span_bars`, counted in closed bars as `window_span_bars − t_edt_open_bar_rows` (parameter, value 1, the name ADR-083 gives MCD1 to MCD3); passes at 60 or more (inclusive). `window_bars` and `model_x_n` count samples, not the span    |
| (b) | **MSE per model.** File C writes RMSE = √MSE_close. Use `model_b_mse` for both quadrants, or each model's own MSE?                                                                                                                                 | On the 8 rows that have Model A values, the two readings give the same pass or fail on all 8 (the fit ratios of A and B differ by 0.01 to 0.09; closest to a bound: v4 M15 `non_b`, A 1.60, B 1.51 against 1.50). Read literally, File C gives both models of a timeframe the same fit ratio.                                                                                | Each model's own MSE: each quadrant is judged independently, as in the Part 0 table of the walkthrough                                                                                                                                           |
| (c) | **Geo ratio versus the Schema note.** The Prisma comment on `channel_asymmetry` says asymmetry is "reported, never penalised" (EDT bands come from outermost touches), but the settled criteria gate the geo ratio at 0.60 to 1.65. Keep the gate? | Geo ratio is inside 0.60 to 1.65 on all 8 centroid rows (0.74 to 1.44), so there it never decides alone. On the fractal EDT it is 0.50 (v1), 0.596 (v3) and 0.596 (v4): it fails on all three, and on v3 and v4 it is the only failed pillar.                                                                                                                                | Keep the gate (it is settled, Arch §2.4 and File C) and measure in the shadow period how often it alone flags a timeframe. A change is a new decision entry and a MINOR version (R10)                                                            |
| (d) | **R² on flat channels.** A flat channel explains almost no variance by slope, whichever indicator draws it. Does the R² pillar apply when the active indicator's `regression_angle` is within ±5°?                                                 | The one flat channel on the replicas is v4 M15 `non_a` (−0.56°): R² −0.09 and −0.16, and every other pillar passes (fit 2.09 and 2.10, geo 1.31, \|skew\| 0.11 and 0.05). The other 10 rows have \|angle\| from 6.94° to 49.89°, so none is exempt (closest: v1 M5 `best_fit_a`, 6.94°).                                                                                     | No: skip the R² pillar, for both models, when \|`regression_angle`\| ≤ 5° (inclusive, the SIDEWAYS band of MCD1 to MCD3), for whichever indicator is active. Its own parameter, written into the spec; `details` shows the pillar as not applied |
| (e) | **Sources without Model A.** `fractal_edt` has no Model A values. Is the Model A quadrant "not applicable" or a defect?                                                                                                                            | `model_a_*` is null on 3 of 3 real fractal rows. Counting that as a defect would flag M5 on every cycle the fractal EDT is the active M5 indicator, whatever its fit.                                                                                                                                                                                                        | "Not applicable": the Model A quadrant is skipped and that timeframe is judged on Model B alone. Decided by the source name (a centroid has Model A, the fractal EDT does not), not by a null value                                              |
| (f) | **Informational flags.** Variance ratio and kurtosis are context only in File C. Put them in `details` or leave them out?                                                                                                                          | The four fields exist (`model_a_var_ratio`, `model_b_var_ratio`, `model_a_kurt`, `model_b_kurt`). File C's labels (`VOLATILITY_EXPANDING`, `HIGH_TAIL_RISK` and the others) would be new regime words, which standard §7.3 requires in `tags.yaml` in the same change.                                                                                                       | Values only, in `details`, as information: no label words, no effect on the state. The plan checks the size against the 600-token budget                                                                                                         |

### 10b. Found while reading (not in C4)

| #   | Question                                                                                                                                                                                                                                                         | What the sources show                                                                                                                                                                                                                                                                                                            | Recommendation                                                                                                                                                                                                                |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| (g) | **Tier 1 without bars.** C4 says MCD0 reads no bars. Tier 1's detection cross-check (decision D3) compares the candidates on the last closed bar, and the shared test T6 builds its `DETECTION_MISMATCH` case from bars. Does MCD0 cross-check?                  | Without bars MCD0 can only check that a setting exists for M5 and for M15 and names a candidate (`NO_SETTING`). The kit's `run_preflight` already lets a gate skip the bar checks ("MCD0 reads no bars").                                                                                                                        | No bars: tier 1 is the setting only. `DETECTION_MISMATCH` stays in the channel MCDs, which read bars. The plan says how T4 (trivially true) and the mismatch half of T6 apply to a gate with no bars                          |
| (h) | **One timeframe cannot be measured, the other can.** One envelope per cycle and the first failing check decides. If M5 has no statistics row, the whole reading is STALE and the worker inherits nothing from MCD0 that cycle, even if M15 is defective. Accept? | The same missing row already makes the M5 channel MCDs unavailable (STALE). Only the other timeframe's channel MCDs lose the gate that cycle. A STALE reading is a data problem, not a market reading (architecture §2.4).                                                                                                       | Accept: it follows the one status scale (standard §6). The alternative (a per-timeframe verdict kept on a STALE or INVALID envelope) needs a change to the contract, so it would be a decision entry first                    |
| (i) | **Sanity checks beyond C4's "a required field is null or the width is not positive".** Which other values are impossible?                                                                                                                                        | The fit ratio divides by √MSE and the geo ratio by −`loedt_offset`, so MSE ≤ 0, `uoedt_offset` ≤ 0 or `loedt_offset` ≥ 0 cannot be evaluated. A non-number (a string, a boolean) in a required field is also unusable. Which fields are required depends on the source: Model A fields for a centroid, none for the fractal EDT. | INVALID + `SANITY_FAILED` for all of these. The spec lists the required fields per source (Model A required for the seven centroids, not applicable for `fractal_edt`), in the same tier-3 position as C4 puts the null check |
| (j) | **Containment.** C4 lists no containment pillar, while standard §6 tier 4 lists "containment ≥ 50% (channel MCDs)". Does MCD0 test it?                                                                                                                           | MCD1 and MCD2 already end INVALID + `CONTAINMENT_LOW` below 50%. On the 11 real rows containment is 55.76 to 100, so none is below 50. MCD0 is a fit gate, and an INVALID MCD0 would flag nothing.                                                                                                                               | No: MCD0 neither tests nor reads containment. A channel below 50% still has its pillars measured, and the channel MCDs reject it themselves                                                                                   |

## 11. Answers (Davin, 1 October 2026)

Davin confirmed and approved this concept and answered every question as recommended in section 10. The specification
(`mcd0.md`) applies them.

| #   | Answer                                                                                                                                                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| (a) | Coverage field: `window_span_bars` counted in closed bars (`window_span_bars − t_edt_open_bar_rows`, parameter 1); at least 60 closed bars              |
| (b) | Each model uses its own MSE for its fit ratio                                                                                                           |
| (c) | Keep the geo-ratio gate (0.60 to 1.65); the flag rate is measured during shadow running                                                                 |
| (d) | Skip the R² pillar when \|`regression_angle`\| ≤ 5.0° (SIDEWAYS) for the active indicator                                                               |
| (e) | Fractal EDT has no Model A: Model A is "not applicable" and the timeframe is judged on Model B alone, decided by source name                            |
| (f) | Variance ratio and kurtosis go into `details` as values only                                                                                            |
| (g) | Tier 1 validates the presence of the setting only; `DETECTION_MISMATCH` stays in the channel MCDs                                                       |
| (h) | One status scale, per standard §6: the whole envelope is STALE or INVALID if one timeframe is missing or unusable                                       |
| (i) | MSE ≤ 0, `uoedt_offset` ≤ 0, `loedt_offset` ≥ 0 and non-numeric values are INVALID + `SANITY_FAILED`; Model A is required for the centroid sources only |
| (j) | MCD0 does not test containment                                                                                                                          |
| (k) | Commit timing: defer the commit until P5 is built and verified; exclude `package.json` and `pnpm-lock.yaml`                                             |
