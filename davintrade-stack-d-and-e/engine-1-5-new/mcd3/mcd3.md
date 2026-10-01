# MCD3: Consolidated trend and EDT stochastic

Status: Approved (Davin, 1 October 2026; built in task P3) · Version: 2.0.0 · Kind: derived · Timeframe(s): M15 + M5

Retrofit of the certified pre-retrofit MCD3 (kept in `legacy/`). The domain logic is carried over; the changes
are listed in `mcd3_implementation_plan.md` §1. The board is read back in `concept.md`. Decisions applied: D3 (tier-1 meaning, built into the kit), D4 (English), and Davin's answers of 1 October 2026: **D10 option A** (0 at LOEDT, 100 at UOEDT), **D6** (the bias of §7), **D7** (six levels), and **Q1 to Q9 as recommended**, all in §14.

## 1. Question and purpose

**Question:** Do the active M15 and M5 channels agree in direction, is the M5 corridor nested inside the M15
corridor (over the M5 channel's whole horizon and on the latest bar), and, if they form a consolidated trend,
where does the M15 SSA sit in the M15 corridor?

**Purpose:** a **modifier** for MCD1 and MCD2 (the board: the EDT Stochastic is used together with them). A
consolidated trend confirms the direction the two sensors give; a trend conflict or a failed nesting adds
caution. Its levels (M15 and M5 channel levels) feed the entry-zone builder. It does not decide the trade
direction (synthesis does, ADR-025) and, being derived, it never votes (architecture §3.3, mechanic 3).

## 2. Kind and horizon

- Kind: **derived**. It declares `depends_on: [MCD1, MCD2]` and reads their same-cycle readings (ADR-021). It
  never recomputes an upstream result: the two trend words come from them.
- Horizons its states are measured on: Scalper 2 h, Day Trader 12 h (architecture §2.8).

## 3. Inputs

| Input       | Detail                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Timeframes  | M15 and M5. Closed bars, counted back from the last closed bar of each timeframe (rule 2, ADR-011). The forming bars are never read                                                                                                                                                                                                                                                                                                       |
| M15 columns | `timestamp`; for the active M15 indicator `{ind}_ssa`, `{ind}_uoedt`, `{ind}_loedt`, `{ind}_base_fl`. Candidate columns of the other indicators are read only to fill `populated_candidates`                                                                                                                                                                                                                                              |
| M5 columns  | `timestamp`; for the active M5 indicator `{ind}_uoedt`, `{ind}_loedt`, `{ind}_base_fl`; fractal `fractal_uoedt`, `fractal_loedt`, `fractal_best_fl`. The M5 SSA or Close is not used (MCD2 uses it)                                                                                                                                                                                                                                       |
| Statistics  | The `indicator_statistics` rows for `("M15", source)` at `stats_slot["M15"]` and `("M5", source)` at `stats_slot["M5"]`; `source` is the active indicator, with `fractal` read as `fractal_edt`. Fields: `containment_rate` (both), `containment_n` (else `visual_window_bars`, else `window_bars`) of the M5 row, `channel_width` (checked when present)                                                                                 |
| Upstream    | The same-cycle envelopes of MCD1 (M15) and MCD2 (M5): `status`, `details.trend_direction` (`UP`, `DOWN`, `SIDEWAYS`), `details.regression_angle_deg`                                                                                                                                                                                                                                                                                      |
| Other       | `active_indicator` for M15 and M5 (the setting), `config_hash` per source, the cycle data status and `retuning` flag                                                                                                                                                                                                                                                                                                                      |
| **Window**  | `T_EDT` is the first of `containment_n`, `visual_window_bars`, `window_bars` that is a number in the M5 row. **`N_nest = T_EDT − t_edt_open_bar_rows` closed M5 bars** (`t_edt_open_bar_rows` = 1), ending at the last closed M5 bar. There is no cap and no fallback: a missing `T_EDT` is INVALID + `SANITY_FAILED` (Q2). The buffer holds at most 2,999 closed bars per timeframe, so a larger window is INVALID + `INSUFFICIENT_BARS` |

The statistics fields that describe the forming bar or the last price (`live_bar_ts`, `live_close`,
`baseline_value`, `uoedt_value`, `loedt_value`, `dist_to_*`, `channel_position`, `sr_nearest_*`,
`sr_dist_*_pts`) are not in the bundle and are not used. MCD3 reads **no** `regression_angle` from the
statistics: the trends come from the upstream readings. Prices come from closed bars.

**Why `T_EDT − 1` (finding of task P2).** `T_EDT` is the number of rows on which the channel exists, and the last
of those rows is the still-open bar: in the replica workbooks the band columns (UOEDT, LOEDT, baseline) are
populated on exactly `T_EDT` rows ending at the forming bar, for all seven real channels checked (v1: M5
`best_fit_a` 755, M5 `fractal` 336, M15 `non_b` 1808; v4: M5 `cherry_a` 1134, M5 `fractal` 410, M15 `non_a` 968,
M15 `non_b` 2035). On closed bars (rule 2) the channel therefore has `T_EDT − 1` bars, and a window of `T_EDT`
closed bars would reach one bar before the channel exists and read a null there. The pre-retrofit evaluator hid
this by skipping null rows. The window is parameterised (`t_edt_open_bar_rows`) because the underlying question
(whether the fit window includes the open bar) is still open in `.claude/state/waiting-on.md`.

**The M15 bar of an M5 bar.** For an M5 bar opened at time `t`, the M15 bar is the **closed** M15 bar with the
greatest open time ≤ `t`. At a slot that is not a quarter hour the newest M5 bars are newer than the last closed
M15 bar and are compared with it (rule 1: an unchanged M15 reading at :05 and :10 is correct). At slot 20:55 the
last closed M5 bar is 20:50 and the last closed M15 bar is 20:30.

## 4. Active-indicator use

Reads the setting for **M15 and M5**. The M15 candidates are the seven centroid variants `best_fit_a`,
`best_fit_b`, `cherry_a`, `cherry_b`, `most_recent`, `non_a`, `non_b`; the M5 candidates are the same seven plus
`fractal`. Any one of them can be active on each timeframe, so the code assumes none in particular. The setting
is never inferred from which columns hold data (rule 6, ADR-010); detection only cross-checks it (§5, tier 1).
A target override exists in tests only.

## 5. Pre-flight checks

Order fixed by the standard: cycle, tier 1, tier 4, tier 2, tier 3, then the upstream check. The first failing
check decides and later checks do not run. CAUTIONARY results continue and keep their reason in front of any
later one.

| Check               | What it tests                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Failure → status + reason code                                                                                                                                                              |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cycle               | `data_status` is FRESH, DELAYED, STALE or MARKET_CLOSED; RETUNING flag                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Unknown value: INVALID + `SANITY_FAILED` · STALE: STALE + `DATA_STALE` · RETUNING: CAUTIONARY + `RETUNING` (continues)                                                                      |
| Tier 1 · Indicator  | A setting exists for M15 and for M5 and is one of that timeframe's candidates. Each set indicator has a value on the last closed bar of its timeframe. Other candidates populated beside a populated set indicator are listed in `details.populated_candidates` and change nothing (D3)                                                                                                                                                                                                                                | No setting or not a candidate: INVALID + `NO_SETTING` · a set indicator empty on the last closed bar while another candidate has a value: CAUTIONARY + `DETECTION_MISMATCH` (continues)     |
| Tier 4 · Statistics | A row for the active source at the slot, on M15 then M5. `containment_rate` is a number and ≥ `min_containment_rate` on both. The M5 row has a numeric `T_EDT`                                                                                                                                                                                                                                                                                                                                                         | No row or wrong slot: STALE + `NO_STATS_AT_SLOT` · containment below the floor: INVALID + `CONTAINMENT_LOW` · containment missing or not a number, or no `T_EDT`: INVALID + `SANITY_FAILED` |
| Tier 2 · Continuity | **M5:** `N_nest ≥ min_nesting_window_bars`; at least `N_nest` closed M5 bars; over the newest `N_nest` bars the timestamps strictly ascend and `timestamp`, UOEDT and LOEDT are numbers; the last closed bar's baseline is a number. **M15:** a closed M15 bar exists at or before the open time of the oldest window bar; from that bar to the last closed M15 bar the timestamps strictly ascend; the last closed M15 bar's SSA, UOEDT, LOEDT and baseline are numbers (older M15 bars may have no band yet, see §6) | Too few bars, or `N_nest` below the floor, or no M15 bar at or before the window start: INVALID + `INSUFFICIENT_BARS` · out of order, missing or null: INVALID + `DISCONTINUITY`            |
| Tier 3 · Sanity     | UOEDT > LOEDT on the last closed bar of each timeframe, on **every** window M5 bar and on every M15 bar that carries a band and is matched by a window bar; `channel_width` in each statistics row is > 0 when present                                                                                                                                                                                                                                                                                                 | INVALID + `SANITY_FAILED`                                                                                                                                                                   |
| Upstream            | MCD1 then MCD2, in that order. The envelope must exist and be readable (Q5): same `cycle_slot`, its `active_indicator` for its timeframe equal to the setting, `details.trend_direction` one of `UP`, `DOWN`, `SIDEWAYS`, `details.regression_angle_deg` a number                                                                                                                                                                                                                                                      | INVALID, missing or unreadable: INVALID + `UPSTREAM_UNAVAILABLE:<id>` · STALE: STALE + `UPSTREAM_STALE:<id>` · CAUTIONARY: CAUTIONARY + `UPSTREAM_CAUTIONARY:<id>` (continues)              |
| MCD0 inheritance    | Applied by the worker (`uses_channel: [M5, M15]`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | CAUTIONARY + `MCD0_DEFECT_M5` / `MCD0_DEFECT_M15`                                                                                                                                           |
| Unexpected error    | Any exception inside the evaluator                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | INVALID + `EVALUATOR_ERROR`, logged                                                                                                                                                         |

MCD3 runs its own tiers before it looks at the upstream readings, so a shared problem (a missing statistics row, a
low containment rate) is reported with MCD3's own reason, the same as MCD1 or MCD2 would give. The `UPSTREAM_*`
reasons appear when MCD3's own inputs are sound and an upstream reading is not (for example an upstream reading
that ended INVALID on a check MCD3 does not repeat, or one built from another cycle).

## 6. Calculation

Symbols: for the last closed M15 bar, S = SSA of the active M15 indicator, L = LOEDT, U = UOEDT; for the last
closed M5 bar, L5 and U5 = LOEDT and UOEDT of the active M5 indicator (all USD per ounce). Everything is
computed in full precision and rounded at output only.

**Condition 1: trend alignment.** `trends_aligned` is true when `MCD1.details.trend_direction` equals
`MCD2.details.trend_direction`. The ±5° band lives in MCD1 and MCD2 and is not applied again.

**Condition 2: historical nesting.** For each of the `N_nest` window bars, the M15 bar m is found by the rule in
§3. The bar is **nested** when m has numeric UOEDT and LOEDT and `LOEDT_M5 ≥ LOEDT_M15(m)` and
`UOEDT_M5 ≤ UOEDT_M15(m)` (the edges are inside). An M5 bar whose M15 bar has no band yet (the M15 channel is
younger than the M5 window) is **not nested** (pre-retrofit behaviour, Q3). Condition 2 holds when
`nested × 100 ≥ nesting_min_share × N_nest`, an exact integer test (754 bars: 566 nested pass, 565 fail).

**Condition 3: current bar.** On the last closed M5 bar and the last closed M15 bar: `L5 ≥ L` and `U5 ≤ U`.

**Consolidated trend** = condition 1 and 2 and 3. All three are evaluated and reported.

**Position and EDT stochastic** (only when consolidated): the position `P = (S − L) ÷ (U − L) × 100`, 0 at LOEDT
and 100 at UOEDT, the same direction as `channel_position` of MCD1 and MCD2. It is **not clipped**: it is below 0
or above 100 when the M15 SSA is outside the M15 corridor (Q6). **The zones are decided on P** (unrounded):

- lower zone: `P ≤ lower_zone_max_position` (20.0, the value is inside the zone)
- upper zone: `P ≥ upper_zone_min_position` (80.0, the value is inside the zone)
- middle zone: between the two

**The reported number depends on decision D10** (written on P so that nothing else depends on it):

|                                                                          | Option A: the pre-retrofit spec and code        | Option B: the concept board                                      |
| ------------------------------------------------------------------------ | ----------------------------------------------- | ---------------------------------------------------------------- |
| `details.edt_stochastic`                                                 | `P` (0 at LOEDT, 100 at UOEDT)                  | `100 − P` = `(U − S) ÷ (U − L) × 100` (0 at UOEDT, 100 at LOEDT) |
| Parenthesis in templates T01 to T07                                      | "(0 at LOEDT, 100 at UOEDT)"                    | "(0 at UOEDT, 100 at LOEDT)"                                     |
| Zones, states, bias, levels, thresholds (20, 80), `details` other fields | Same                                            | Same                                                             |
| Corrected in the other document                                          | The board (an image, so a note in `concept.md`) | `mcd3.md`, plan, manifest wording and the code's comments        |

**Davin chose option A on 1 October 2026 (D10).** The registry and templates use it, as the pre-retrofit evaluator and its tests do; the board's formula is noted in `concept.md` (§10a row 1) as the mirror image.

**State** (§7): consolidated → trend (both the same) × zone; sideways has one state for any `P`. Not
consolidated → the first failed condition in the order 1, 2, 3.

| Parameter                 | Value | Unit                                    | Boundary                                                           | Rationale                                                                                                                 |
| ------------------------- | ----- | --------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `min_containment_rate`    | 50.0  | percent                                 | ≥ value passes tier 4 (both timeframes)                            | Channel counted as intact at 50% containment (architecture §2.4)                                                          |
| `nesting_min_share`       | 75.0  | percent of the window                   | `nested × 100 ≥ value × N_nest` passes                             | The board: nesting for at least 75% of the M5 EDT length                                                                  |
| `min_nesting_window_bars` | 48    | closed M5 bars                          | `N_nest ≥ value` passes tier 2                                     | 4 hours of M5 (pre-retrofit M5 floor)                                                                                     |
| `t_edt_open_bar_rows`     | 1     | rows                                    | `N_nest = T_EDT − value`                                           | `T_EDT` counts rows ending at the forming bar (seven of seven real channels); closed bars exclude it                      |
| `lower_zone_max_position` | 20.0  | index points (0 at LOEDT, 100 at UOEDT) | `P ≤ value` is the lower zone                                      | Pre-retrofit stochastic threshold 20 (architecture §2.5)                                                                  |
| `upper_zone_min_position` | 80.0  | index points (0 at LOEDT, 100 at UOEDT) | `P ≥ value` is the upper zone                                      | Pre-retrofit stochastic threshold 80 (architecture §2.5)                                                                  |
| `stochastic_decimals`     | 2     | decimals                                | Output rounding only (half up); the zone is decided on unrounded P | Pre-retrofit output precision; the pre-retrofit code decided the zone on the rounded value, the retrofit does not (§11.2) |

## 7. State register

Exhaustive and exclusive: every VALID or CAUTIONARY evaluation maps to exactly one of ten states. **The bias column is decision D6, approved by Davin on 1 October 2026 (the walkthrough C3 starting points).** All states contribute the six levels of §8 (decision D7, approved). Machine-readable copy with the template texts: `mcd3_registry.yaml`.

| State code                             | Condition result                           | `regime_status`                     | Bias (D6)   | Meaning (market description, not advice)                                                                      | Summary / commentary |
| -------------------------------------- | ------------------------------------------ | ----------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------- | -------------------- |
| `MCD3_BULL_VALUE`                      | Consolidated, both UP, lower zone          | `BULLISH_CONSOLIDATED_VALUE_ZONE`   | LONG        | Both channels slope up and are nested, and the M15 SSA is in the lower zone of the M15 corridor               | S01 / T01            |
| `MCD3_BULL_MID`                        | Consolidated, both UP, middle zone         | `BULLISH_CONSOLIDATED_EQUILIBRIUM`  | LONG        | Both channels slope up and are nested, and the M15 SSA is in the middle zone of the M15 corridor              | S02 / T02            |
| `MCD3_BULL_TOP`                        | Consolidated, both UP, upper zone          | `BULLISH_CONSOLIDATED_OVERBOUGHT`   | NEUTRAL     | Both channels slope up and are nested, and the M15 SSA is in the upper zone of the M15 corridor               | S03 / T03            |
| `MCD3_BEAR_PREMIUM`                    | Consolidated, both DOWN, upper zone        | `BEARISH_CONSOLIDATED_PREMIUM_ZONE` | SHORT       | Both channels slope down and are nested, and the M15 SSA is in the upper zone of the M15 corridor             | S04 / T04            |
| `MCD3_BEAR_MID`                        | Consolidated, both DOWN, middle zone       | `BEARISH_CONSOLIDATED_EQUILIBRIUM`  | SHORT       | Both channels slope down and are nested, and the M15 SSA is in the middle zone of the M15 corridor            | S05 / T05            |
| `MCD3_BEAR_BOTTOM`                     | Consolidated, both DOWN, lower zone        | `BEARISH_CONSOLIDATED_OVERSOLD`     | NEUTRAL     | Both channels slope down and are nested, and the M15 SSA is in the lower zone of the M15 corridor             | S06 / T06            |
| `MCD3_SIDEWAYS_EQUILIBRIUM`            | Consolidated, both SIDEWAYS (any `P`)      | `SIDEWAYS_CONSOLIDATED_EQUILIBRIUM` | NEUTRAL     | Both channels are flat and nested                                                                             | S07 / T07            |
| `MCD3_NON_CONSOLIDATED_TREND_CONFLICT` | Condition 1 fails                          | `TREND_MISALIGNMENT`                | STAND_ASIDE | The channels slope in different directions, so there is no consolidated trend                                 | S08 / T08            |
| `MCD3_NON_CONSOLIDATED_OVERFLOW`       | Condition 1 holds, condition 2 fails       | `INSUFFICIENT_CORRIDOR_NESTING`     | STAND_ASIDE | The channels slope the same way, but the M5 corridor is inside the M15 corridor on too few of the window bars | S09 / T09            |
| `MCD3_NON_CONSOLIDATED_ESCAPE`         | Conditions 1 and 2 hold, condition 3 fails | `CURRENT_CORRIDOR_ESCAPE`           | STAND_ASIDE | The channels slope the same way and enough bars are nested, but the latest M5 corridor extends beyond M15     | S10 / T10            |

The ten regime words are the pre-retrofit ones (location words; `OVERBOUGHT` and `OVERSOLD` describe where the SSA
sits, like `PREMIUM` and `VALUE`, and pass the wording checks). They go into `tags.yaml` when it exists
(architecture §4.6, build step 6). The words "conviction", "buy", "sell", "take profit" and "hold" of the
pre-retrofit `tactical_bias` are gone.

**Summary lines** (≤ 80 characters, no prices): `S01` "Consolidated uptrend, lower zone of the M15 corridor" · `S02` "…, middle zone of the M15 corridor" ·
`S03` "…, upper zone of the M15 corridor" · `S04` to `S06` the same with "downtrend" (upper, middle, lower) · `S07`
"Consolidated sideways, M5 corridor inside the M15 corridor" · `S08` "M15 and M5 trends differ, no consolidated trend" ·
`S09` "Trends agree, M5 corridor often outside the M15 corridor" · `S10` "Trends agree, latest M5 corridor beyond the M15 corridor".

**Commentary templates** T01 to T10 are in the registry (counts, prices, angles and the stochastic number only; no
forecast, probability, advice or `%`). Placeholders: `{m15_angle}` and `{m5_angle}` signed with 2 decimals, from the
upstream `details`; `{nested}` and `{n}` integers; prices and `{m15_ssa}` with 2 decimals; `{stoch}` with 2 decimals
and not clipped; `{ssa_place}` is one of three fixed phrases: "inside the M15 corridor", "above UOEDT",
"below LOEDT"; `{both_phrase}` is "slope up", "slope down" or "are flat"; `{m15_phrase}` and `{m5_phrase}` are
"slopes up", "slopes down" or "is flat". The pre-retrofit percentages and confirmation phrases are replaced.

## 8. Levels

Decision D7 (approved by Davin on 1 October 2026: the walkthrough recommendation and standard §8, which says a channel MCD outputs UOEDT,
baseline and LOEDT for each timeframe it reads).

| Name       | `tf` | Computed from the last closed bar of that timeframe | Role         |
| ---------- | ---- | --------------------------------------------------- | ------------ |
| `UOEDT`    | M15  | `{ind}_uoedt`                                       | `resistance` |
| `baseline` | M15  | `{ind}_base_fl`                                     | `mid`        |
| `LOEDT`    | M15  | `{ind}_loedt`                                       | `support`    |
| `UOEDT`    | M5   | centroid `{ind}_uoedt`; fractal `fractal_uoedt`     | `resistance` |
| `baseline` | M5   | centroid `{ind}_base_fl`; fractal `fractal_best_fl` | `mid`        |
| `LOEDT`    | M5   | centroid `{ind}_loedt`; fractal `fractal_loedt`     | `support`    |

Prices are rounded to 2 decimals at output. All ten states contribute all six levels; INVALID and STALE readings
contribute none. **Zone width:** 10% of the width of the channel the level belongs to (`U − L` of that timeframe's
active channel on the same bar; the default in standard §8; ADR-031).

**Duplicate levels (for decision D7).** These are the same prices that MCD1 (M15) and MCD2 (M5) already emit from the
same bars. The zone builder (architecture §3.6, build step 4) must count one channel level once, or one channel
would show as confluence of two or three sensors. The alternative is that MCD3 contributes no levels, which needs a
change to standard §8 and to the architecture §2.13 row.

## 9. Synthesis role

- **Modifier**, not voter (derived sensors modify; architecture §3.3, mechanic 3).
- **Proposed rung** (Davin decides, §9.3): oscillators, as modifier, for both Day Traders and Scalpers. This
  matches architecture §2.13.
- **Rule rows:** none are proposed here. The draft rules table in architecture §3.4 names MCD3 in rule 5
  (`NON_CONSOLIDATED_*` with nothing above matched gives STAND_ASIDE) and in the paragraph after the table
  (consolidated in the same direction confirms; a trend conflict adds caution). Rule content is Davin's (ADR-026)
  and changes there are made when synthesis is built (build step 4).
- **Note on bias:** the sensor's own bias (§7) is what MCD3 alone suggests; synthesis decides (ADR-025). The three
  non-consolidated states are STAND_ASIDE, which always reaches the prompt in full (ADR-041) and is what the
  architecture's examples assume.
- **Data problems:** if MCD3 is not VALID or CAUTIONARY it is left out of synthesis and shown as unavailable on the
  sensor board (architecture §2.4); the primary-timeframe rule (§3.3, mechanic 1) concerns MCD1 and MCD2, not MCD3.

## 10. Routing and knowledge

| Item                    | Content                                                                                                                                                                                                                                                                                                                             |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dispatch-matrix intents | **Direction** (as the modifier that confirms or cautions), **Entry timing** (the EDT stochastic position), **Explain** (consolidated trend, nesting, EDT stochastic, M15 corridor)                                                                                                                                                  |
| `tags.yaml`             | `MCD3`; the ten state codes; the ten regime words of §7; level names `UOEDT`, `baseline`, `LOEDT`                                                                                                                                                                                                                                   |
| Playbook chunk (D2)     | Front-matter `mcd_id: MCD3`, `state_codes` (ten), `timeframe: M15+M5`, `version: 2.0.0`. Sections: what it measures; the three conditions; the ten states; how to read the stochastic and a value outside 0 to 100 (the board's principle in words, marked provisional until `state_statistics` reach n ≥ 30); what it does not say |
| Foundations chunk (D1)  | The M15 and M5 channels, nesting, UOEDT / baseline / LOEDT, SSA, the EDT stochastic scale                                                                                                                                                                                                                                           |
| Glossary                | Consolidated trend, nesting, EDT stochastic, lower / middle / upper zone (all 16 languages)                                                                                                                                                                                                                                         |
| Reason texts            | `DATA_STALE`, `RETUNING`, `NO_SETTING`, `DETECTION_MISMATCH`, `NO_STATS_AT_SLOT`, `CONTAINMENT_LOW`, `INSUFFICIENT_BARS`, `DISCONTINUITY`, `SANITY_FAILED`, `EVALUATOR_ERROR`, `MCD0_DEFECT_M5`, `MCD0_DEFECT_M15`, `UPSTREAM_CAUTIONARY:<id>`, `UPSTREAM_UNAVAILABLE:<id>`, `UPSTREAM_STALE:<id>` (all 16 languages)               |
| Labelled questions      | Timeframe-agreement and "where in the corridor" questions in all 16 languages (build step 6)                                                                                                                                                                                                                                        |

All of this is stage 6 work and waits for the sensor worker, synthesis and the knowledge build.

## 11. `details` contents

| Field                  | Type           | Meaning                                                                                                                       |
| ---------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `m15_trend_direction`  | string         | `UP`, `DOWN` or `SIDEWAYS`, read from MCD1                                                                                    |
| `m5_trend_direction`   | string         | `UP`, `DOWN` or `SIDEWAYS`, read from MCD2                                                                                    |
| `trends_aligned`       | boolean        | Condition 1                                                                                                                   |
| `nesting_window_bars`  | integer        | `N_nest`, in closed M5 bars                                                                                                   |
| `nested_bars`          | integer        | How many of the window bars are nested (condition 2 holds when `nested_bars × 100 ≥ nesting_min_share × nesting_window_bars`) |
| `nesting_met`          | boolean        | Condition 2                                                                                                                   |
| `current_bar_engulfed` | boolean        | Condition 3                                                                                                                   |
| `edt_stochastic`       | number or null | Per D10, 2 decimals, **not clipped to 0 to 100**; `null` when there is no consolidated trend                                  |
| `populated_candidates` | object         | `{"M15": [names], "M5": [names]}`: other candidates with a value on the last closed bar (informational)                       |

The upstream angles are not repeated here (the commentary quotes them and MCD1 and MCD2 carry them), and
"consolidated" is the state itself. INVALID and STALE readings carry an empty `details`. Size is the tightest of the three retrofitted MCDs, and MCD3 departs from the standard's 600-token "should" (§5) on purpose: Davin approved a ceiling of **670 tokens** on 1 October 2026 (manifest A22) for a derived sensor that carries six levels, two 64-character `config_hash` values and up to two upstream cautions. Measured with real prices: the real consolidated reading (replica v3) is 587 tokens, its CAUTIONARY variants with two upstream cautions are 607 and 611, and with the candidates of live data (every variant populated, so `populated_candidates` names 6 + 7) the largest of the ten states is 656 (task P6).

## 12. Worked example

**Slot `2026-09-18T20:55Z` (v1 replica), settings M15 = `non_b`, M5 = `best_fit_a`.** Last closed M5 bar
2026-09-18T20:50Z and last closed M15 bar 20:30Z (the 20:55 M5 bar and the 20:45 M15 bar are still forming).
Containment 73.95 (M15) and 55.76 (M5), both ≥ 50. `T_EDT` of the M5 row 755, so `N_nest = 754`. Upstream: MCD1
VALID `MCD1_DOWN_UPPER_BREAKOUT`, trend DOWN (−29.72°); MCD2 VALID `MCD2_UP_IN_CORRIDOR`, trend UP (+6.94°).

| Step                | Result                                                                                                                                                                  |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pre-flight          | All pass. The fractal EDT is populated on M5: `populated_candidates = {"M15": [], "M5": ["fractal"]}`, status stays VALID (D3)                                          |
| Condition 1         | DOWN against UP: **false**                                                                                                                                              |
| Condition 2         | 0 of 754 closed M5 bars nested (0.00): **false**                                                                                                                        |
| Condition 3         | M5 [4350.16, 4384.23] against M15 [4126.24, 4279.46]: **false**                                                                                                         |
| State, regime, bias | `MCD3_NON_CONSOLIDATED_TREND_CONFLICT` · `TREND_MISALIGNMENT` · STAND_ASIDE (Approved) · `edt_stochastic` null                                                          |
| Levels              | M15: UOEDT 4279.46 (resistance), baseline 4214.17 (mid), LOEDT 4126.24 (support) · M5: UOEDT 4384.23, baseline 4367.20, LOEDT 4350.16                                   |
| Summary             | "M15 and M5 trends differ, no consolidated trend"                                                                                                                       |
| Commentary (T08)    | "The M15 channel slopes down (-29.72°) while the M5 channel slopes up (+6.94°), so the two timeframes do not form a consolidated trend and no EDT stochastic is given." |

The pre-retrofit run on the still-open bars gave the same state (nesting 0 of 755). This is the situation the
concept board shows (M15 `non-b` down, M5 `best-fit-a` up).

**A real consolidated trend: replica v3, slot `2026-09-28T14:15Z`, M15 = `non_b`, M5 = `cherry_a`** (a fixture, Q7). MCD1 VALID `MCD1_DOWN_LOWER_BREAKDOWN`, trend DOWN (−15.61°); MCD2 VALID `MCD2_DOWN_LOWER_BREAKDOWN`,
trend DOWN (−11.01°). `T_EDT` 1038, so `N_nest = 1037`; 973 nested (93.83) ≥ 75: condition 2 true. M5 [4194.62,
4289.67] inside M15 [4148.18, 4331.53]: condition 3 true. M15 SSA 4146.30, so `P = −1.02`: the SSA is **below LOEDT**
and in the lower zone. State `MCD3_BEAR_BOTTOM` · `BEARISH_CONSOLIDATED_OVERSOLD` · NEUTRAL (Approved).
`edt_stochastic` is −1.02 under D10 option A and 101.02 under option B. Commentary (T06, option A): "Both channels
slope down (M15 -15.61°, M5 -11.01°). 973 of 1037 closed M5 bars have their corridor inside the M15 corridor, and the
latest M5 corridor [4194.62, 4289.67] is inside the M15 corridor [4148.18, 4331.53]. The M15 SSA 4146.30 is below
LOEDT; the EDT stochastic is -1.02 (0 at LOEDT, 100 at UOEDT), in the lower zone." The pre-retrofit run on the
still-open bar gave the same state with −2.74.

## 13. Tests

Standard §12, T1 to T14 (T14 applies: MCD3 is derived). Detail and the mapping of the 13 pre-retrofit tests:
`mcd3_implementation_plan.md` §3.

- T1: one test per state (ten), each from a synthetic bundle plus synthetic upstream envelopes.
- T2: boundaries just below, at and just above: nesting 74 / 75 / 76 nested of 100 bars and 565 / 566 of 754; `P` = 19.99 /
  20 / 20.01 and 79.99 / 80 / 80.01; M5 corridor edges equal to the M15 edges (inside) and a hair beyond each
  (outside), on the latest bar and on a window bar; containment 49.99 / 50 / 50.01 on each timeframe; `T_EDT` 48 / 49 /
  50 (`N_nest` 47 / 48 / 49); `T_EDT` 1,000 with 999 closed bars and with 1,000.
- T3: one test per pre-flight failure: `SANITY_FAILED` (unknown `data_status`, missing containment, no `T_EDT`, an
  inverted channel on a window bar, on a used M15 bar and on the last bar, a non-positive channel width),
  `DATA_STALE`, `RETUNING`, `NO_SETTING` and `DETECTION_MISMATCH` (each timeframe), `NO_STATS_AT_SLOT` and
  `CONTAINMENT_LOW` (each timeframe), `INSUFFICIENT_BARS` (M5 too few, `N_nest` below the floor, no M15 bar before the
  window), `DISCONTINUITY` (M5 order and null, M15 order and null at the last bar), `UPSTREAM_UNAVAILABLE`,
  `UPSTREAM_STALE` and `UPSTREAM_CAUTIONARY` for each of MCD1 and MCD2, an upstream from another cycle or
  indicator, an unreadable trend; and the check order.
- T4 to T8, T10 to T12: the kit's shared checks (forming bar on both timeframes, wrong-slot statistics, setting,
  determinism, schema, corrupted bundle, wording, size). T12 also holds the ceiling of 670 tokens (§11) for all ten states
  with every candidate populated, RETUNING and two upstream cautions.
- T9: replay of the stored fixtures with their stored upstream envelopes (Q7). T13: the real cycles (v1 and v4,
  and v3 if Q7 is approved).
- T14: changing MCD1's trend (or MCD2's) in the upstream reading changes MCD3's state in the same cycle; and the
  stored upstream envelopes equal what the committed MCD1 and MCD2 evaluators give on the same cycle.
- Also: an M15 channel younger than the M5 window (those bars are not nested); a window bar whose M15 bar is the last
  closed M15 bar at :05 and :10; an M5 stream that lags the M15 stream (the current corridor is still the last closed M15
  bar); an M15 bar with only one band value; equal bands, or an inverted band, on the M15 bar that only the oldest window
  bar maps to; a stochastic that rounds to -0.00 or to 1.00; the upper zone edge between 79.99 and 80 (task P6).

## 14. Open questions

### Decisions that are Davin's

**Answered by Davin on 1 October 2026:** D10 = option A; D6 = the bias of §7; D7 = the six levels; Q1 to Q9 approved as recommended (last column). The tables keep each question as it was asked.

| #   | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Default if you approve without comment                                                      |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| D10 | **EDT stochastic direction.** The board reads (UOEDT − SSA) ÷ width × 100 (0 at the ceiling); the pre-retrofit spec and code read (SSA − LOEDT) ÷ width × 100 (0 at the floor); they add up to 100. Option A keeps the code (same direction as the `channel_position` of MCD1 and MCD2, and the usual stochastic); option B follows your board. Only the reported number changes (§6). On the real consolidated cycle, replica v3, it is −1.02 (A) or 101.02 (B) | **None: it is your formula.** The draft uses A because the certified evaluator and tests do |
| D6  | **Bias per state.** The registry holds the walkthrough starting points: bull value and bull mid LONG; bear premium and bear mid SHORT; bull top, bear bottom and the sideways state NEUTRAL; the three non-consolidated states STAND_ASIDE. Confirm or set each                                                                                                                                                                                                  | The starting points                                                                         |
| D7  | **Levels.** UOEDT, baseline and LOEDT on M15 and on M5 (six levels), as standard §8 requires of channel MCDs. These are the same prices MCD1 and MCD2 emit, so the zone builder must count a price once (§8). Alternative: none, which changes §8 and the architecture §2.13 row                                                                                                                                                                                 | The six levels                                                                              |

### Questions

| #   | Question                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Recommendation                                        |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Q1  | **Nesting window.** `N_nest = T_EDT − 1` closed M5 bars (§3: the channel's `T_EDT` rows end at the forming bar; seven of seven real channels). The alternative, `T_EDT` closed bars, reads a null on the oldest bar and ends every real cycle as `DISCONTINUITY`; the pre-retrofit evaluator used the populated rows including the open bar. Approve?                                                                                                                                                         | `T_EDT − 1`, as a parameter                           |
| Q2  | **No hidden horizon.** The pre-retrofit code uses 755 (M5) and 1808 (M15), the v1 values, when `containment_n` is missing. Make a missing `T_EDT` INVALID + `SANITY_FAILED`?                                                                                                                                                                                                                                                                                                                                  | INVALID + `SANITY_FAILED`                             |
| Q3  | **Nesting edge cases and tier 3.** (a) An M5 bar whose M15 bar has no band yet counts as not nested (pre-retrofit); a missing M15 _bar_ is INVALID + `INSUFFICIENT_BARS`. (b) Tier 3 checks UOEDT > LOEDT on every window bar and every used M15 bar, not the last bar only (as MCD1 and MCD2). Confirm?                                                                                                                                                                                                      | Both                                                  |
| Q4  | **Legacy checks dropped.** The M15 floor of 96 bars (MCD1 enforces its own window), the M15 to M5 time-overlap check (the as-of match makes it redundant) and \|θ\| ≤ 90 (the angles now come from MCD1 and MCD2, which check it). The M5 floor of 48 stays. Confirm?                                                                                                                                                                                                                                         | Drop the three                                        |
| Q5  | **Upstream consistency.** Beyond the status, require each upstream envelope to carry the same `cycle_slot`, the same active indicator as the setting, a readable trend and a numeric angle, else INVALID + `UPSTREAM_UNAVAILABLE:<id>`. The kit's `upstream_check` tests the status only; MCD3 adds the rest on top (as MCD2 added tier helpers). Keep?                                                                                                                                                       | Keep                                                  |
| Q6  | **Outside 0 to 100.** When the M15 SSA is outside the M15 corridor (real: replica v3) the stochastic is below 0 or above 100 under either formula. Keep it unclipped, with the zones and states unchanged and the template naming the SSA's place in words? And keep `MCD3_SIDEWAYS_EQUILIBRIUM` for any value (its pre-retrofit label says "in corridor")? A new state would be a MAJOR change that is yours to make.                                                                                        | Keep unclipped; keep the sideways state for any value |
| Q7  | **Fixtures for a derived MCD.** T9 replays JSON only, so the stored upstream envelopes must sit next to the bundle. Add `<slot>.upstream.json` per slot (standard §11.1 and walkthrough B3 would get a PATCH sentence, version 1.0.4; no kit change). And add **replica v3** as a third fixture slot (the only real consolidated trend): needs `mcd_common/fixtures/settings_v3.yaml` (data only) and v3 tracked in git (a 2 MB workbook you commit)? Without v3, `MCD3_BEAR_BOTTOM` has synthetic tests only | `upstream.json` yes; v3 yes                           |
| Q8  | **Rungs.** Proposed: oscillators, as modifier, for both trader types (§9). Confirm or change.                                                                                                                                                                                                                                                                                                                                                                                                                 | Confirm                                               |
| Q9  | **Documentation edits in P3** (docs only). Architecture §2.13: MCD3 version 2.0.0 and Levels per D7; §2.5 MCD3 column: remove `MCD3_INVALID` from the states (failure is a status) and write the window as `T_EDT − 1` closed M5 bars. May P3 make them?                                                                                                                                                                                                                                                      | Yes, in P3                                            |

Not questions, recorded for the reader: (a) the statistics' fit windows may include the still-open bar
(unverified, `.claude/state/waiting-on.md`); the `T_EDT` finding in §3 is new evidence for it, not a proof, and it
must be settled before certification. (b) The board's rule that more than one active indicator is invalid is
covered by the setting and decision D3 (`concept.md` §10a, row 11). (c) MCD2 and MCD1 ended as INVALID +
`DISCONTINUITY` on a short channel (M5 `T_EDT` ≤ 288, M15 `T_EDT` ≤ 96: their windows reached before the channel), and
an MCD2 INVALID reached MCD3 as `UPSTREAM_UNAVAILABLE:MCD2` (hand-off §7). Fixed in the 2.0.1 PATCH of both (task P7,
1 October 2026); MCD3's own window has been `T_EDT − 1` from the start. No replica triggered it (the smallest real
`T_EDT` is 314 on M5).
