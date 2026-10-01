# MCD1: M15 primary trend and micro regime

Status: Approved (Davin, 1 October 2026) · Version: 2.0.0 · Kind: independent · Timeframe(s): M15

Retrofit of the certified pre-retrofit MCD1 (kept in `legacy/`). The domain logic is carried over; the changes
are listed in `mcd1_implementation_plan.md` §1. There is no concept board; the readback is `concept.md`
(confirmed by Davin on 1 October 2026). Decisions applied: D3 (tier-1 meaning, built into the kit), D4
(English), D6 (bias per state, §7 and §14) and Q1 to Q7 (§14), all settled by Davin on 1 October 2026. D5 and
D7 belong to MCD2 and MCD3 and do not apply. ADR-023 (Settled) corrects the old §4B: the same-slope breakout
fires on the latest bar.

## 1. Question and purpose

**Question:** On M15, which way does the active EDT channel slope (the primary trend), and what did the last
closed bars do against that channel's corridor, the band between LOEDT and UOEDT: stay in it, break out in the
direction of the slope, or break out against the slope?

**Purpose:** M15 direction context and short-term regime. It supplies the M15 trend that MCD3 reads, the M15
levels (UOEDT, baseline, LOEDT) that entry zones are built from, and one of five regime words that synthesis
reads. It is the primary-timeframe sensor for Day Traders (architecture §3.3). It does not decide the trade
direction; synthesis does (ADR-025).

## 2. Kind and horizon

- Kind: **independent**. It reads market data only and runs in parallel with the other independent MCDs.
- Horizons its states are measured on: Day Trader 12 h (primary), Scalper 2 h (architecture §2.8).

## 3. Inputs

| Input       | Detail                                                                                                                                                                                                                                                                                                                           |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Timeframe   | M15 only. Closed bars, counted back from the last closed M15 bar (rule 2, ADR-011). The forming bar is never read. At slots that are not on a quarter hour the last closed M15 bar is older than the slot, and an unchanged reading is correct (rule 1)                                                                          |
| Bar columns | `timestamp`, `close`, and for the active indicator `{ind}_ssa`, `{ind}_uoedt`, `{ind}_loedt`, `{ind}_base_fl`. Candidate columns of the other six indicators are read only to fill `populated_candidates`                                                                                                                        |
| Statistics  | The `indicator_statistics` row for `("M15", source)` captured at `stats_slot["M15"]` (the last quarter hour). `source` is the active indicator. Fields: `regression_angle`, `containment_rate`, `containment_n` (else `visual_window_bars`), `channel_width`                                                                     |
| Upstream    | None                                                                                                                                                                                                                                                                                                                             |
| Other       | `active_indicator["M15"]` (the setting), `config_hash[source]`, cycle data status and `retuning` flag                                                                                                                                                                                                                            |
| **Window**  | `T_EDT` is the first of `containment_n`, `visual_window_bars` that is a number; if neither is, `N_micro` is the floor (96). **`N_micro = max(96, round half up of 5% × T_EDT)` closed M15 bars** ending at the last closed bar. At most 150 in practice (`T_EDT` ≤ 3,000, the indicator's lookback), inside the 3,000-bar buffer |

The statistics fields that describe the forming bar or the last price (`live_bar_ts`, `live_close`,
`baseline_value`, `uoedt_value`, `loedt_value`, `dist_to_*`, `channel_position`, `sr_nearest_*`,
`sr_dist_*_pts`) are not in the bundle and are not used. Prices come from the closed bars.

## 4. Active-indicator use

Reads the setting for **M15** only. The seven candidates are the centroid variants `best_fit_a`, `best_fit_b`,
`cherry_a`, `cherry_b`, `most_recent`, `non_a` and `non_b`; any one of them can be active, so the code assumes
none in particular. The fractal EDT, `resistance`, `support` and `sr_levels` are never candidates. The setting
is never inferred from which columns hold data (rule 6, ADR-010). Detection only cross-checks it (§5, tier 1).
No target override exists outside tests.

## 5. Pre-flight checks

Order fixed by the standard: cycle, tier 1, tier 4, tier 2, tier 3. The first failing check decides and later
checks do not run. CAUTIONARY results continue and keep their reason in front of any later one.

| Check               | What it tests                                                                                                                                                                                                                                       | Failure → status + reason code                                                                                                                                                        |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cycle               | `data_status` is FRESH, DELAYED, STALE or MARKET_CLOSED; RETUNING flag                                                                                                                                                                              | Unknown value: INVALID + `SANITY_FAILED` · STALE: STALE + `DATA_STALE` · RETUNING: CAUTIONARY + `RETUNING` (continues)                                                                |
| Tier 1 · Indicator  | A setting exists for M15 and is one of the seven candidates. The set indicator has a value on the last closed bar. Other candidates populated beside a populated set indicator are listed in `details.populated_candidates` and change nothing (D3) | No setting or not a candidate: INVALID + `NO_SETTING` · set indicator empty on the last closed bar while another candidate has a value: CAUTIONARY + `DETECTION_MISMATCH` (continues) |
| Tier 4 · Statistics | A row for the active source at the slot. `containment_rate` is a number and ≥ `min_containment_rate`. `regression_angle` is a number                                                                                                                | No row or wrong slot: STALE + `NO_STATS_AT_SLOT` · containment below the floor: INVALID + `CONTAINMENT_LOW` · containment or angle missing or not a number: INVALID + `SANITY_FAILED` |
| Tier 2 · Continuity | At least `N_micro` closed M15 bars. Over the newest `N_micro` bars the timestamps strictly ascend and every column the MCD reads (`timestamp`, `close`, the active indicator's SSA, UOEDT, LOEDT and baseline) is a number                          | Too few: INVALID + `INSUFFICIENT_BARS` · out of order, missing or null: INVALID + `DISCONTINUITY`                                                                                     |
| Tier 3 · Sanity     | UOEDT > LOEDT on **every** bar of the window; `channel_width` in the statistics row is > 0 when present; \|`regression_angle`\| ≤ `max_abs_regression_angle_deg`                                                                                    | INVALID + `SANITY_FAILED`                                                                                                                                                             |
| Upstream            | None (independent)                                                                                                                                                                                                                                  | —                                                                                                                                                                                     |
| MCD0 inheritance    | Applied by the worker (`uses_channel: [M15]`)                                                                                                                                                                                                       | CAUTIONARY + `MCD0_DEFECT_M15`                                                                                                                                                        |
| Unexpected error    | Any exception inside the evaluator                                                                                                                                                                                                                  | INVALID + `EVALUATOR_ERROR`, logged                                                                                                                                                   |

After a `DETECTION_MISMATCH` the later checks usually end the reading as STALE (no statistics for the set
indicator) or INVALID (no bars), and the reason tells the operator that the setting looks wrong. The old
`UNIDENTIFIED` outcome no longer exists: every failure is a status with a reason code.

## 6. Calculation

Symbols: θ = `regression_angle` (degrees, signed, from the statistics row). `N` = `N_micro`. The window is
the newest `N` closed M15 bars; bar `i` has Close `c_i`, UOEDT `U_i`, LOEDT `L_i` and baseline `B_i` (all USD per
ounce); bar `N` is the last closed bar. Everything is computed in full precision and rounded at output only.

**Window length** (parameters `micro_window_pct`, `min_micro_window_bars`):

- `N_micro = max(96, ⌊(5 × T_EDT + 50) ÷ 100⌋)`, which is 5% of `T_EDT` rounded half up, in integer arithmetic.
  Examples: `T_EDT` 1,808 gives 90, so 96; 2,035 gives 102; 3,000 gives 150.
- If neither `containment_n` nor `visual_window_bars` is a number, `N_micro = 96`.

**Trend direction** (parameter `sideways_angle_deg`):

- `UP` when θ > +5.0°
- `DOWN` when θ < −5.0°
- `SIDEWAYS` when |θ| ≤ 5.0° (the boundaries ±5.0 are SIDEWAYS)

**Where the bars closed:**

- Bar `i` is **above** when `c_i > U_i`, **below** when `c_i < L_i`, **inside** otherwise (both edges are inside).
- `upper_breach_count` = number of window bars that are above; `lower_breach_count` = number that are below.
- The **latest bar** is bar `N`. Its channel position is `CP = (c_N − L_N) ÷ (U_N − L_N)`, reported with 4
  decimals (`channel_position_decimals`).
- A side is **sustained** when `100 × breach_count ≥ 80.0 × N` (parameter `sustained_breach_pct`, inclusive).
  With `N` = 96 that is 77 bars, with `N` = 102 it is 82 bars.

The comparisons use prices and counts, not the rounded CP. The corridor edges are the channel's own bands, so
they are not parameters.

**Micro regime** (decided on the latest bar and the counts; this is ADR-023):

| Trend    | `UPPER_BREAKOUT`                         | `LOWER_BREAKDOWN`                        | `IN_CORRIDOR` |
| -------- | ---------------------------------------- | ---------------------------------------- | ------------- |
| UP       | Latest bar above (same slope, no count)  | Latest bar below **and** lower sustained | Otherwise     |
| DOWN     | Latest bar above **and** upper sustained | Latest bar below (same slope, no count)  | Otherwise     |
| SIDEWAYS | Latest bar above **and** upper sustained | Latest bar below **and** lower sustained | Otherwise     |

`IN_CORRIDOR` therefore also covers a latest bar that is outside on the counter side without a sustained break:
a false breakout is filtered out, as in the certified evaluator.

**State** = `MCD1_{trend}_{micro regime}` (§7).

| Parameter                      | Value | Unit                 | Boundary                                                               | Rationale                                                                                        |
| ------------------------------ | ----- | -------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `sideways_angle_deg`           | 5.0   | degrees              | \|θ\| ≤ value is SIDEWAYS; θ > value is UP; θ < −value is DOWN         | ±5° trend band used by MCD1 to MCD3; architecture §2.6 keeps it                                  |
| `min_containment_rate`         | 50.0  | percent              | ≥ value passes tier 4                                                  | Channel counted as intact at 50% containment (architecture §2.4)                                 |
| `micro_window_pct`             | 5.0   | percent of `T_EDT`   | `N_micro` = value% of `T_EDT` rounded half up, never below the floor   | The recent behaviour is judged over at least 5% of the channel length (pre-retrofit MCD1)        |
| `min_micro_window_bars`        | 96    | closed M15 bars      | `N_micro` is never below value; also the value when `T_EDT` is missing | 24 hours, one full trading day of M15; filters 2 to 3 hours of news (pre-retrofit MCD1)          |
| `sustained_breach_pct`         | 80.0  | percent of `N_micro` | sustained when 100 × count ≥ value × `N_micro` (inclusive)             | A counter-trend or sideways break counts only when most of the window is outside (pre-retrofit)  |
| `max_abs_regression_angle_deg` | 90.0  | degrees              | \|θ\| ≤ value passes tier 3                                            | A regression angle beyond ±90° is not possible (named in the pre-retrofit plan, not in its code) |
| `channel_position_decimals`    | 4     | decimals             | Output rounding only; the state is decided on prices and counts        | Pre-retrofit output precision (1.6447 in the certified example)                                  |

## 7. State register

Exhaustive and exclusive: every VALID or CAUTIONARY evaluation maps to exactly one of nine states. All states
contribute the three M15 levels. Machine-readable copy with the template texts: `mcd1_registry.yaml`.

**Bias is decision D6 (Davin, 1 October 2026).** One rule: inside the corridor the bias follows the macro trend
(UP is LONG, DOWN is SHORT, SIDEWAYS is NEUTRAL); a break follows the break direction (above UOEDT is LONG,
below LOEDT is SHORT), for all three trends. The sensor's bias is what this sensor alone suggests; synthesis
decides the final direction (ADR-025).

| State code                      | Trend / micro regime                     | `regime_status`              | Bias    | Meaning (market description, not advice)                                                                                                           | Summary / commentary |
| ------------------------------- | ---------------------------------------- | ---------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| `MCD1_UP_IN_CORRIDOR`           | UP · inside, or no sustained break       | `TREND_ALIGNED_CONTINUATION` | LONG    | The M15 channel slopes up and the latest closed bar is inside the corridor, or below it without a sustained break                                  | S01 / T01            |
| `MCD1_UP_UPPER_BREAKOUT`        | UP · latest bar above UOEDT              | `BREAKOUT_SAME_SLOPE`        | LONG    | The M15 channel slopes up and the latest closed bar is above UOEDT, beyond the corridor in the direction of the slope                              | S02 / T02            |
| `MCD1_UP_LOWER_BREAKDOWN`       | UP · below LOEDT, sustained              | `COUNTER_TREND_EXPANSION`    | SHORT   | The M15 channel slopes up and the latest closed bar is below LOEDT with the sustained-break rule met, a break against the direction of the slope   | S03 / T03            |
| `MCD1_DOWN_IN_CORRIDOR`         | DOWN · inside, or no sustained break     | `TREND_ALIGNED_CONTINUATION` | SHORT   | The M15 channel slopes down and the latest closed bar is inside the corridor, or above it without a sustained break                                | S04 / T04            |
| `MCD1_DOWN_LOWER_BREAKDOWN`     | DOWN · latest bar below LOEDT            | `BREAKOUT_SAME_SLOPE`        | SHORT   | The M15 channel slopes down and the latest closed bar is below LOEDT, beyond the corridor in the direction of the slope                            | S05 / T05            |
| `MCD1_DOWN_UPPER_BREAKOUT`      | DOWN · above UOEDT, sustained            | `COUNTER_TREND_EXPANSION`    | LONG    | The M15 channel slopes down and the latest closed bar is above UOEDT with the sustained-break rule met, a break against the direction of the slope | S06 / T06            |
| `MCD1_SIDEWAYS_IN_CORRIDOR`     | SIDEWAYS · inside, or no sustained break | `CONSOLIDATION`              | NEUTRAL | The M15 channel is flat and the latest closed bar is inside the corridor, or outside it without a sustained break                                  | S07 / T07            |
| `MCD1_SIDEWAYS_UPPER_BREAKOUT`  | SIDEWAYS · above UOEDT, sustained        | `RANGE_EXPANSION`            | LONG    | The M15 channel is flat and the latest closed bar is above UOEDT with the sustained-break rule met                                                 | S08 / T08            |
| `MCD1_SIDEWAYS_LOWER_BREAKDOWN` | SIDEWAYS · below LOEDT, sustained        | `RANGE_EXPANSION`            | SHORT   | The M15 channel is flat and the latest closed bar is below LOEDT with the sustained-break rule met                                                 | S09 / T09            |

The five regime words are unchanged from the pre-retrofit register (`TREND_ALIGNED_CONTINUATION`,
`BREAKOUT_SAME_SLOPE`, `COUNTER_TREND_EXPANSION`, `CONSOLIDATION`, `RANGE_EXPANSION`). None is renamed: none
contains a banned or advice word. Their old descriptions ("massive pump with high probability of V-shape
reversal") are replaced by the meanings above, which state where price closed and nothing about what follows.

**Summary lines** (≤ 80 characters, no prices; the registry file holds the same strings):

| Id  | Summary                                         | Id  | Summary                                           | Id  | Summary                                          |
| --- | ----------------------------------------------- | --- | ------------------------------------------------- | --- | ------------------------------------------------ |
| S01 | M15 uptrend, no sustained break of the corridor | S04 | M15 downtrend, no sustained break of the corridor | S07 | M15 sideways, no sustained break of the corridor |
| S02 | M15 uptrend, latest close above the corridor    | S05 | M15 downtrend, latest close below the corridor    | S08 | M15 sideways, sustained close above the corridor |
| S03 | M15 uptrend, sustained close below the corridor | S06 | M15 downtrend, sustained close above the corridor | S09 | M15 sideways, sustained close below the corridor |

**Commentary templates** (location and counts only; no forecast, probability or advice; prices and `dist` with 2
decimals, `angle` signed with 2 decimals, `cp` with 4; no `%`). `inside` = `N_micro` − `upper` − `lower`; `upper`
and `lower` are the breach counts:

| Id  | Template                                                                                                                                                                                 |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T01 | `The M15 channel slopes up ({angle}°). {inside} of the last {n_micro} closed bars closed inside the corridor; the latest closed bar has channel position {cp}.`                          |
| T02 | `The M15 channel slopes up ({angle}°). The latest closed bar closed {dist} above UOEDT {uoedt} (channel position {cp}); {upper} of the last {n_micro} closed bars closed above UOEDT.`   |
| T03 | `The M15 channel slopes up ({angle}°). The latest closed bar closed {dist} below LOEDT {loedt} (channel position {cp}); {lower} of the last {n_micro} closed bars closed below LOEDT.`   |
| T04 | `The M15 channel slopes down ({angle}°). {inside} of the last {n_micro} closed bars closed inside the corridor; the latest closed bar has channel position {cp}.`                        |
| T05 | `The M15 channel slopes down ({angle}°). The latest closed bar closed {dist} below LOEDT {loedt} (channel position {cp}); {lower} of the last {n_micro} closed bars closed below LOEDT.` |
| T06 | `The M15 channel slopes down ({angle}°). The latest closed bar closed {dist} above UOEDT {uoedt} (channel position {cp}); {upper} of the last {n_micro} closed bars closed above UOEDT.` |
| T07 | `The M15 channel is flat ({angle}°). {inside} of the last {n_micro} closed bars closed inside the corridor; the latest closed bar has channel position {cp}.`                            |
| T08 | `The M15 channel is flat ({angle}°). The latest closed bar closed {dist} above UOEDT {uoedt} (channel position {cp}); {upper} of the last {n_micro} closed bars closed above UOEDT.`     |
| T09 | `The M15 channel is flat ({angle}°). The latest closed bar closed {dist} below LOEDT {loedt} (channel position {cp}); {lower} of the last {n_micro} closed bars closed below LOEDT.`     |

`dist` is `c_N − U_N` (above) or `L_N − c_N` (below), always positive. The old commentary
("…high probability of structural reversal…", "…healthy trend continuation…", "…96/96 bars = 100.0% >= 80.0%
threshold…") is replaced by these nine templates.

## 8. Levels

| Name       | `tf` | Computed from the last closed M15 bar | Role         |
| ---------- | ---- | ------------------------------------- | ------------ |
| `UOEDT`    | M15  | `{ind}_uoedt`                         | `resistance` |
| `baseline` | M15  | `{ind}_base_fl`                       | `mid`        |
| `LOEDT`    | M15  | `{ind}_loedt`                         | `support`    |

Prices are rounded to 2 decimals at output. All nine states contribute all three levels; INVALID and STALE
readings contribute none. The baseline is new (the pre-retrofit MCD1 gave UOEDT and LOEDT only; standard §8 and
architecture §2.5 require it). **Zone width:** 10% of the active M15 channel's width, `U − L` on the same bar
(the default, standard §8; ADR-031).

## 9. Synthesis role

- **Voter**, not modifier. Independent MCDs vote; MCD3 modifies.
- **Rung** (confirmed by Davin, 1 October 2026, Q6): Day Trader = primary-timeframe structure; Scalper =
  trendlines and channels (the timing channel). This matches architecture §2.13.
- **Rule rows:** none are proposed here. The draft rules table in architecture §3.4 already names MCD1's regime
  words (rules 1 to 4), and none of them changes. Rule content is Davin's (ADR-026).
- **Note on bias:** under D6 the bias in `MCD1_UP_UPPER_BREAKOUT` (LONG) and `MCD1_DOWN_LOWER_BREAKDOWN` (SHORT)
  follows the break, while the draft rule 2 reads the same regime word (`BREAKOUT_SAME_SLOPE`) as "bias against
  the spike". So in those two states the synthesis result can differ from the sensor's own bias. Synthesis
  decides the final direction (ADR-025), so this is allowed; it is recorded here for whoever reviews the rules
  table (task P8).
- **Data problems:** if MCD1 is not VALID or CAUTIONARY, the Day Trader result is STAND_ASIDE with a data reason
  (architecture §3.3, mechanic 1). That is synthesis's job, not MCD1's.

## 10. Routing and knowledge

| Item                    | Content                                                                                                                                                                                                                                                                                                      |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Dispatch-matrix intents | **Direction** (as the primary sensor for Day Traders), **Entry timing** (when its levels supplied the zones), **Exit / targets** (levels on the target side), **Explain** (the terms M15 primary trend, corridor, UOEDT, LOEDT, channel position, sustained break)                                           |
| `tags.yaml`             | `MCD1`; the nine state codes; the five regime words; level names `UOEDT`, `baseline`, `LOEDT`                                                                                                                                                                                                                |
| Playbook chunk (D2)     | Front-matter `mcd_id: MCD1`, `state_codes` (nine), `timeframe: M15`, `version: 2.0.0`. Sections: what it measures; the nine states; how to read a same-slope break versus a sustained counter-trend break (marked provisional until `state_statistics` reach n ≥ 30); the micro window; what it does not say |
| Foundations chunk (D1)  | The M15 channel, UOEDT / baseline / LOEDT, channel position, the trend band, the micro window and the sustained-break share                                                                                                                                                                                  |
| Glossary                | Corridor, channel position, sustained break, micro window (all 16 languages)                                                                                                                                                                                                                                 |
| Reason texts            | `DATA_STALE`, `RETUNING`, `NO_SETTING`, `DETECTION_MISMATCH`, `NO_STATS_AT_SLOT`, `CONTAINMENT_LOW`, `INSUFFICIENT_BARS`, `DISCONTINUITY`, `SANITY_FAILED`, `EVALUATOR_ERROR`, `MCD0_DEFECT_M15` (all 16 languages)                                                                                          |
| Labelled questions      | M15-direction and M15-regime questions in all 16 languages (build step 6)                                                                                                                                                                                                                                    |

All of this is stage 6 work and waits for the sensor worker, synthesis and the knowledge build.

## 11. `details` contents

| Field                  | Type    | Meaning                                                                                                                      |
| ---------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `trend_direction`      | string  | `UP`, `DOWN` or `SIDEWAYS` (standard §7.3). MCD3 reads it                                                                    |
| `regression_angle_deg` | number  | θ, 2 decimals, signed                                                                                                        |
| `containment_rate`     | number  | The statistics row's containment rate, 2 decimals, in percent                                                                |
| `n_micro`              | integer | `N_micro` in closed M15 bars                                                                                                 |
| `upper_breach_count`   | integer | Window bars that closed above UOEDT                                                                                          |
| `lower_breach_count`   | integer | Window bars that closed below LOEDT                                                                                          |
| `channel_position`     | number  | CP on the last closed bar, 4 decimals; below 0 or above 1 means outside the corridor                                         |
| `populated_candidates` | object  | `{"M15": [names]}`: other candidates with a value on the last closed bar (for example `non_a` beside `non_b`). Informational |

INVALID and STALE readings carry an empty `details`. The pre-retrofit `channel_position_stat` (a live-bar value),
`raw_slope`, the provenance block, the per-side percentages and `contained_bar_count` are not carried over (the
last is `n_micro − upper − lower`). Size stays far below the 600-token budget.

## 12. Worked example

**Slot `2026-09-18T20:55Z` (v1 replica), setting M15 = `non_b`.** The last closed M15 bar opened at
2026-09-18T20:30Z (the 20:45 bar is still forming). The M15 statistics row was captured at the slot 20:45
(`stats_slot["M15"]`): θ = −29.72°, containment 73.95% (≥ 50, passes), `containment_n` 1,808, so
`N_micro` = max(96, 90) = 96. On the last closed bar Close 4380.93, UOEDT 4279.46, baseline 4214.17, LOEDT
4126.24, so CP = 1.6622. All 96 window bars closed above UOEDT.

| Step                | Result                                                                                                                                                                        |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pre-flight          | All pass. No other candidate is populated: `populated_candidates = {"M15": []}`, status VALID                                                                                 |
| Trend               | θ < −5 → DOWN                                                                                                                                                                 |
| Micro regime        | Latest bar above UOEDT and 96 × 100 ≥ 80 × 96 → upper sustained → `UPPER_BREAKOUT`                                                                                            |
| State, regime, bias | `MCD1_DOWN_UPPER_BREAKOUT` · `COUNTER_TREND_EXPANSION` · LONG (the break is above UOEDT, D6)                                                                                  |
| Levels (M15)        | UOEDT 4279.46 (resistance) · baseline 4214.17 (mid) · LOEDT 4126.24 (support)                                                                                                 |
| Summary             | "M15 downtrend, sustained close above the corridor"                                                                                                                           |
| Commentary (T06)    | "The M15 channel slopes down (-29.72°). The latest closed bar closed 101.47 above UOEDT 4279.46 (channel position 1.6622); 96 of the last 96 closed bars closed above UOEDT." |

The pre-retrofit run on the still-open 20:45 bar gave CP 1.6447 and the same state. The other two real
cycles (v4, slot `2026-09-28T23:15Z`, last closed bar 23:00) also keep their pre-retrofit state: `non_b` gives
`MCD1_DOWN_IN_CORRIDOR` (θ −20.98°, `N_micro` 102, CP 0.1071, `populated_candidates = {"M15": ["non_a"]}`) and
`non_a` gives `MCD1_SIDEWAYS_LOWER_BREAKDOWN` (θ −0.56°, `N_micro` 96, 86 of 96 bars below LOEDT, CP −0.6473).

## 13. Tests

Standard §12, T1 to T13 (T14 is for derived MCDs and does not apply). Detail and the mapping of the 13
pre-retrofit tests: `mcd1_implementation_plan.md` §3.

- T1: one test per state (nine), each from a synthetic bundle.
- T2: boundaries just below, at and just above: θ = ±5.0 (SIDEWAYS at and inside, UP and DOWN beyond); the
  latest Close = UOEDT and = LOEDT (inside) and a hair beyond each (outside); sustained break at 76 / 77 of 96
  and at 81 / 82 of 102; a same-slope break with a single bar in the window; a counter-side latest bar with 76
  and with 77 bars (not sustained / sustained); the latest bar inside with 77 or more bars on one side (still
  inside); containment 49.99 / 50.0 / 50.01; `T_EDT` 545, 1,808, 1,909, 1,910, 1,929, 1,930 and 3,000 (96, 96,
  96, 96, 96, 97, 150); exactly `N_micro` closed bars and one fewer; |θ| 90 / 90.01; a breach bar just outside the
  window is not counted and the first bar of the window is; a window bar exactly on a band is inside; the channel
  position rounds half up at an exact half (1/32 gives 0.0313); a break under 1.00 reads as it is (0.25, 0.01) and a
  Close a hair below LOEDT reads channel position 0.0000, never −0.0000 (the two gaps found by the independent check).
- T3: one test per pre-flight failure: `SANITY_FAILED` (unknown `data_status`, missing containment or angle,
  inverted channel on an old window bar, channel width ≤ 0, impossible angle), `DATA_STALE`, `RETUNING`,
  `NO_SETTING`, `DETECTION_MISMATCH`, `NO_STATS_AT_SLOT`, `CONTAINMENT_LOW`, `INSUFFICIENT_BARS`,
  `DISCONTINUITY` (order, null).
- T4 to T8, T10 to T12: the kit's shared checks (forming bar, wrong-slot statistics, setting, determinism,
  schema, corrupted bundle, wording, size).
- T9: replay of the stored fixtures. T13: the three real cycles (v1 `non_b`; v4 `non_b` and `non_a`).
- Tier 3 window checks are pinned at both ends of the window and on a malformed forming bar (the three gaps
  found in MCD2's independent check, H1 to H3).

## 14. Open questions

None. Every decision asked in the first draft was answered by Davin on 1 October 2026 and is built into this
specification, the registry and the parameters.

### Decision D6: bias per state (Davin, 1 October 2026)

The bias is what this sensor alone suggests; synthesis decides the final direction (ADR-025). Davin's answer is
one rule, shown per state in §7:

- **Inside the corridor** the bias follows the macro trend: `MCD1_UP_IN_CORRIDOR` is **LONG**,
  `MCD1_DOWN_IN_CORRIDOR` is **SHORT**, `MCD1_SIDEWAYS_IN_CORRIDOR` is **NEUTRAL**.
- **A break** follows the break direction, for all three trends: `MCD1_UP_UPPER_BREAKOUT`,
  `MCD1_DOWN_UPPER_BREAKOUT` and `MCD1_SIDEWAYS_UPPER_BREAKOUT` are **LONG** (the latest close is above UOEDT);
  `MCD1_UP_LOWER_BREAKDOWN`, `MCD1_DOWN_LOWER_BREAKDOWN` and `MCD1_SIDEWAYS_LOWER_BREAKDOWN` are **SHORT** (below
  LOEDT).

This is the first recommendation of the draft: the bias follows the direction price is moving. No state is
STAND_ASIDE, and the only NEUTRAL state is a flat channel with price inside the corridor.

### Questions Q1 to Q7 (all approved as recommended, Davin, 1 October 2026)

| #   | Question                                                                                                                                                                                                   | Decision                                                                      |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Q1  | **Metric.** MCD1 measures the bar's **Close** against the bands, for every candidate (MCD2 uses the SSA for centroid indicators). This is the certified behaviour and the old spec's channel position      | Keep Close                                                                    |
| Q2  | **Window fallback.** With `containment_n` and `visual_window_bars` both missing, `T_EDT` is unknown and `N_micro` is the floor, 96 (the pre-retrofit code did the same with a warning)                     | Keep the fallback (carried over; practically unreachable, tier 4 stops first) |
| Q3  | **Rounding of `N_micro`.** Half up in integer arithmetic. The pre-retrofit `round()` sent exact halves to the even number: `T_EDT` 1,930 gave 96, now 97                                                   | Half up (exact, easy to state and test)                                       |
| Q4  | **Tier 3 scope.** UOEDT > LOEDT on every bar of the window (the kit's helper checks the last bar only)                                                                                                     | Every bar                                                                     |
| Q5  | **Angle bound.** \|θ\| ≤ 90 as a tier-3 check (`max_abs_regression_angle_deg`), as in MCD2                                                                                                                 | Keep                                                                          |
| Q6  | **Rungs.** Day Trader primary structure, Scalper trendlines and channels (§9)                                                                                                                              | Confirmed                                                                     |
| Q7  | **Architecture records.** In P3 the §2.13 MCD1 row gets version 2.0.0 and its Levels cell becomes "UOEDT, baseline, LOEDT"; §2.5 loses "(baseline to add)". Documentation only; rule content stays Davin's | Done in P3                                                                    |

Not questions, recorded for the reader: (a) the statistics' fit windows may include the still-open bar
(unverified, tracked in `.claude/state/waiting-on.md`; MCD1 reads `regression_angle`, `containment_rate` and
`containment_n` from those fits, so the item is inherited and must be settled before certification); (b) the
old §4B, which required the 80% share for every breakout, is replaced by §6 as ADR-023 settled; (c) on all
three real cycles the state is the same as before the retrofit, but the numbers move because the last closed
bar replaces the still-open one (implementation plan §5 and §6).
