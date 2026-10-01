# MCD2: M5 trend and corridor deviation

Status: Approved (Davin, 1 October 2026; built in task P3) · Version: 2.0.1 (PATCH, task P7, 1 October 2026: the window counts the channel's closed bars) · Kind: independent · Timeframe(s): M5

Retrofit of the certified pre-retrofit MCD2 (kept in `legacy/`). The domain logic is carried over; the
changes are listed in `mcd2_implementation_plan.md` §1. The board is read back in `concept.md`.
Decisions applied: D3 (tier-1 meaning, built into the kit), D4 (English), D5 (two regime words renamed),
D6 (bias by trend). D7 is MCD3's and does not apply.

## 1. Question and purpose

**Question:** On M5, which way does the active EDT channel slope, and where does the last closed bar's SSA
line (the Close, for the fractal EDT) sit relative to that channel's corridor, the band between LOEDT and
UOEDT?

**Purpose:** M5 direction context and deviation from the M5 channel. It supplies the M5 trend that MCD3
reads, the M5 levels (UOEDT, baseline, LOEDT) that entry zones are built from, and a neutral flag
(`reversion_setup`) when the metric is outside the corridor. It is the primary-timeframe sensor for
Scalpers (architecture §3.3). It does not decide the trade direction; synthesis does (ADR-025).

## 2. Kind and horizon

- Kind: **independent**. It reads market data only and runs in parallel with the other independent MCDs.
- Horizons its states are measured on: Scalper 2 h (primary), Day Trader 12 h (architecture §2.8).

## 3. Inputs

| Input       | Detail                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Timeframe   | M5 only. Closed bars, counted back from the last closed M5 bar (rule 2, ADR-011). The forming bar is never read                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Bar columns | `timestamp`, `close`, and for the active indicator: centroid `{ind}_ssa`, `{ind}_uoedt`, `{ind}_loedt`, `{ind}_base_fl`; fractal `fractal_best_fl`, `fractal_uoedt`, `fractal_loedt`. Candidate columns of the other indicators are read only to fill `populated_candidates`                                                                                                                                                                                                                                                                                                                                                             |
| Statistics  | The `indicator_statistics` row for `("M5", source)` captured at `stats_slot["M5"]`. `source` is the active indicator, with `fractal` read as `fractal_edt`. Fields: `regression_angle`, `containment_rate`, `containment_n` (else `visual_window_bars`, else `window_bars`), `channel_width`                                                                                                                                                                                                                                                                                                                                             |
| Upstream    | None                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Other       | `active_indicator["M5"]` (the setting), `config_hash[source]`, cycle data status and `retuning` flag                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **Window**  | `T_EDT` is the first of `containment_n`, `visual_window_bars`, `window_bars` that is a number; if none is, `N_window = max_window_bars`. Otherwise **`N_window = min(T_EDT − t_edt_open_bar_rows, max_window_bars)` closed M5 bars** (`t_edt_open_bar_rows` = 1) ending at the last closed bar. At most 288, inside the 3,000-bar buffer. `T_EDT` counts the rows on which the channel exists and the last of them is the still-open bar (7 of 7 real channels), so on closed bars the channel has `T_EDT − 1` rows and the window never reaches before it. A channel with fewer than `min_window_bars` closed bars is not read (tier 2) |

The statistics fields that describe the forming bar or the last price (`live_bar_ts`, `live_close`,
`baseline_value`, `uoedt_value`, `loedt_value`, `dist_to_*`, `channel_position`, `sr_nearest_*`,
`sr_dist_*_pts`) are not in the bundle and are not used. Prices come from the last closed bar.

## 4. Active-indicator use

Reads the setting for **M5** only. The eight candidates are `best_fit_a`, `best_fit_b`, `cherry_a`,
`cherry_b`, `most_recent`, `non_a`, `non_b` and `fractal`; any one of them can be active, so the code
assumes none in particular. The setting is never inferred from which columns hold data (rule 6, ADR-010).
Detection only cross-checks it (§5, tier 1). A target override exists in tests only.

## 5. Pre-flight checks

Order fixed by the standard: cycle, tier 1, tier 4, tier 2, tier 3. The first failing check decides and
later checks do not run. CAUTIONARY results continue and keep their reason in front of any later one.

| Check               | What it tests                                                                                                                                                                                                                                                                                        | Failure → status + reason code                                                                                                                                                        |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cycle               | `data_status` is FRESH, DELAYED, STALE or MARKET_CLOSED; RETUNING flag                                                                                                                                                                                                                               | Unknown value: INVALID + `SANITY_FAILED` · STALE: STALE + `DATA_STALE` · RETUNING: CAUTIONARY + `RETUNING` (continues)                                                                |
| Tier 1 · Indicator  | A setting exists for M5 and is one of the eight candidates. The set indicator has a value on the last closed bar. Other candidates populated beside a populated set indicator are listed in `details.populated_candidates` and change nothing (D3)                                                   | No setting or not a candidate: INVALID + `NO_SETTING` · set indicator empty on the last closed bar while another candidate has a value: CAUTIONARY + `DETECTION_MISMATCH` (continues) |
| Tier 4 · Statistics | A row for the active source at the slot. `containment_rate` is a number and ≥ `min_containment_rate`. `regression_angle` is a number                                                                                                                                                                 | No row or wrong slot: STALE + `NO_STATS_AT_SLOT` · containment below the floor: INVALID + `CONTAINMENT_LOW` · containment or angle missing or not a number: INVALID + `SANITY_FAILED` |
| Tier 2 · Continuity | `N_window` is at least `min_window_bars`: a channel shorter than the floor is not read. At least `N_window` closed M5 bars. Over the newest `N_window` bars the timestamps strictly ascend and every column the MCD reads (`timestamp`, `close`, the active indicator's channel columns) is a number | Channel shorter than the floor, or too few bars: INVALID + `INSUFFICIENT_BARS` · out of order, missing or null: INVALID + `DISCONTINUITY`                                             |
| Tier 3 · Sanity     | UOEDT > LOEDT on **every** bar of the window; `channel_width` in the statistics row is > 0 when present; \|`regression_angle`\| ≤ `max_abs_regression_angle_deg`                                                                                                                                     | INVALID + `SANITY_FAILED`                                                                                                                                                             |
| Upstream            | None (independent)                                                                                                                                                                                                                                                                                   | —                                                                                                                                                                                     |
| MCD0 inheritance    | Applied by the worker (`uses_channel: [M5]`)                                                                                                                                                                                                                                                         | CAUTIONARY + `MCD0_DEFECT_M5`                                                                                                                                                         |
| Unexpected error    | Any exception inside the evaluator                                                                                                                                                                                                                                                                   | INVALID + `EVALUATOR_ERROR`, logged                                                                                                                                                   |

After a `DETECTION_MISMATCH` the later checks usually end the reading as STALE (no statistics for the
set indicator) or INVALID (no bars), and the reason tells the operator that the setting looks wrong.

## 6. Calculation

Symbols: θ = `regression_angle` (degrees, signed, from the statistics row); m = the metric on the last
closed bar (SSA for the seven centroid indicators, Close for the fractal EDT); U, L, B = UOEDT, LOEDT and
baseline on the last closed bar (all USD per ounce). Everything is computed in full precision and rounded
at output only.

**Trend direction** (parameter `sideways_angle_deg`):

- `UP` when θ > +5.0°
- `DOWN` when θ < −5.0°
- `SIDEWAYS` when |θ| ≤ 5.0° (the boundaries ±5.0 are SIDEWAYS)

**Corridor position:**

- Channel position `CP = (m − L) ÷ (U − L)`; reported with 4 decimals (`channel_position_decimals`).
- `UPPER_BREAKOUT` when m > U (same as CP > 1)
- `LOWER_BREAKDOWN` when m < L (same as CP < 0)
- `IN_CORRIDOR` when L ≤ m ≤ U (both edges are inside)

The comparison uses the prices m, U and L, not the rounded CP. The corridor edges are the channel's own
bands, so they are not parameters.

**State** = trend direction × corridor position (§7).

| Parameter                      | Value | Unit           | Boundary                                                                                      | Rationale                                                                                                                                    |
| ------------------------------ | ----- | -------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `sideways_angle_deg`           | 5.0   | degrees        | \|θ\| ≤ value is SIDEWAYS; θ > value is UP; θ < −value is DOWN                                | ±5° trend band used by MCD1 to MCD3; architecture §2.6 keeps it                                                                              |
| `min_containment_rate`         | 50.0  | percent        | ≥ value passes tier 4                                                                         | Channel counted as intact at 50% containment (architecture §2.4)                                                                             |
| `min_window_bars`              | 48    | closed M5 bars | A minimum, not a window length: `N_window` below value is INVALID + `INSUFFICIENT_BARS`       | 4 hours of M5 (pre-retrofit floor); since 2.0.1 it no longer lengthens a short window past the channel                                       |
| `max_window_bars`              | 288   | closed M5 bars | `N_window` is never above value; also `N_window` when no `T_EDT` is available                 | 24 hours of M5 (architecture §2.5: statistics over `min(T_EDT, 288)`)                                                                        |
| `t_edt_open_bar_rows`          | 1     | rows           | `N_window = min(T_EDT − value, max_window_bars)`; not subtracted when no `T_EDT` is available | `T_EDT` counts rows ending at the forming bar (7 of 7 real channels), so closed bars hold `T_EDT − 1`; same name and value as MCD3 (task P7) |
| `max_abs_regression_angle_deg` | 90.0  | degrees        | \|θ\| ≤ value passes tier 3                                                                   | A regression angle beyond ±90° is not possible (named in the pre-retrofit plan, not in its code)                                             |
| `channel_position_decimals`    | 4     | decimals       | Output rounding only; the state is decided on the unrounded prices                            | Pre-retrofit output precision (0.7959 in the certified example)                                                                              |

## 7. State register

Exhaustive and exclusive: every VALID or CAUTIONARY evaluation maps to exactly one of nine states.
Bias is decision D6: UP states LONG, DOWN states SHORT, SIDEWAYS states NEUTRAL. All states contribute
the three M5 levels. Machine-readable copy with the template texts: `mcd2_registry.yaml`.

| State code                      | Trend / corridor       | `regime_status`                  | Bias    | Meaning (market description, not advice)                                                                         | Summary / commentary |
| ------------------------------- | ---------------------- | -------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------- | -------------------- |
| `MCD2_UP_IN_CORRIDOR`           | UP · inside            | `TREND_ALIGNED_CONTINUATION`     | LONG    | The M5 channel slopes up and the metric is inside the corridor                                                   | S01 / T01            |
| `MCD2_UP_UPPER_BREAKOUT`        | UP · above UOEDT       | `UPPER_OVEREXTENSION_REVERSION`  | LONG    | The M5 channel slopes up and the metric is above UOEDT, beyond the corridor in the direction of the slope        | S02 / T02            |
| `MCD2_UP_LOWER_BREAKDOWN`       | UP · below LOEDT       | `UPTREND_DIP_BELOW_CORRIDOR`     | LONG    | The M5 channel slopes up and the metric is below LOEDT, beyond the corridor against the direction of the slope   | S03 / T03            |
| `MCD2_DOWN_IN_CORRIDOR`         | DOWN · inside          | `TREND_ALIGNED_CONTINUATION`     | SHORT   | The M5 channel slopes down and the metric is inside the corridor                                                 | S04 / T04            |
| `MCD2_DOWN_LOWER_BREAKDOWN`     | DOWN · below LOEDT     | `LOWER_OVEREXTENSION_REVERSION`  | SHORT   | The M5 channel slopes down and the metric is below LOEDT, beyond the corridor in the direction of the slope      | S05 / T05            |
| `MCD2_DOWN_UPPER_BREAKOUT`      | DOWN · above UOEDT     | `DOWNTREND_RALLY_ABOVE_CORRIDOR` | SHORT   | The M5 channel slopes down and the metric is above UOEDT, beyond the corridor against the direction of the slope | S06 / T06            |
| `MCD2_SIDEWAYS_IN_CORRIDOR`     | SIDEWAYS · inside      | `RANGE_EQUILIBRIUM`              | NEUTRAL | The M5 channel is flat and the metric is inside the corridor                                                     | S07 / T07            |
| `MCD2_SIDEWAYS_UPPER_BREAKOUT`  | SIDEWAYS · above UOEDT | `RANGE_RESISTANCE_REVERSION`     | NEUTRAL | The M5 channel is flat and the metric is above UOEDT                                                             | S08 / T08            |
| `MCD2_SIDEWAYS_LOWER_BREAKDOWN` | SIDEWAYS · below LOEDT | `RANGE_SUPPORT_REVERSION`        | NEUTRAL | The M5 channel is flat and the metric is below LOEDT                                                             | S09 / T09            |

Regime words kept from the pre-retrofit register: `TREND_ALIGNED_CONTINUATION`,
`UPPER_OVEREXTENSION_REVERSION`, `LOWER_OVEREXTENSION_REVERSION`, `RANGE_EQUILIBRIUM`,
`RANGE_RESISTANCE_REVERSION`, `RANGE_SUPPORT_REVERSION`. Renamed by D5: `DIP_VALUE_BUY_OPPORTUNITY` →
`UPTREND_DIP_BELOW_CORRIDOR` and `RALLY_VALUE_SELL_OPPORTUNITY` → `DOWNTREND_RALLY_ABOVE_CORRIDOR`
(location words, no advice). The two new words go into `tags.yaml` when it exists (architecture §4.6, build step 6).

**Summary lines** (≤ 80 characters, no prices): `S01` "M5 uptrend, inside the corridor" · `S02` "M5 uptrend, above the corridor" · `S03` "M5 uptrend, below the corridor" · `S04` to `S06` the same with "downtrend" · `S07` to `S09` the same with "sideways". Pattern: `M5 {trend_word}, {inside|above|below} the corridor`.

**Commentary templates** (location only; no forecast, probability or advice; prices and distances with 2
decimals, `angle` signed with 2 decimals, `cp` with 4; `metric_name` is `SSA`, or `Close` for the fractal EDT):

| Id  | Template                                                                                                                                                  |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T01 | `The M5 {metric_name} is inside the corridor, between LOEDT {loedt} and UOEDT {uoedt} (channel position {cp}), while the channel slopes up ({angle}°).`   |
| T02 | `The M5 {metric_name} is {dist} above UOEDT {uoedt} while the channel slopes up ({angle}°).`                                                              |
| T03 | `The M5 {metric_name} is {dist} below LOEDT {loedt} while the channel slopes up ({angle}°).`                                                              |
| T04 | `The M5 {metric_name} is inside the corridor, between LOEDT {loedt} and UOEDT {uoedt} (channel position {cp}), while the channel slopes down ({angle}°).` |
| T05 | `The M5 {metric_name} is {dist} below LOEDT {loedt} while the channel slopes down ({angle}°).`                                                            |
| T06 | `The M5 {metric_name} is {dist} above UOEDT {uoedt} while the channel slopes down ({angle}°).`                                                            |
| T07 | `The M5 {metric_name} is inside the corridor, between LOEDT {loedt} and UOEDT {uoedt} (channel position {cp}), while the channel is flat ({angle}°).`     |
| T08 | `The M5 {metric_name} is {dist} above UOEDT {uoedt} while the channel is flat ({angle}°).`                                                                |
| T09 | `The M5 {metric_name} is {dist} below LOEDT {loedt} while the channel is flat ({angle}°).`                                                                |

`dist` is `m − U` (above) or `L − m` (below), always positive. The legacy commentary "…with SSA safely
within the EDT corridor…" is replaced by T01, T04 and T07 (location only; "safely" is a banned word, §7.4).

## 8. Levels

| Name       | `tf` | Computed from the last closed M5 bar                | Role         |
| ---------- | ---- | --------------------------------------------------- | ------------ |
| `UOEDT`    | M5   | centroid `{ind}_uoedt`; fractal `fractal_uoedt`     | `resistance` |
| `baseline` | M5   | centroid `{ind}_base_fl`; fractal `fractal_best_fl` | `mid`        |
| `LOEDT`    | M5   | centroid `{ind}_loedt`; fractal `fractal_loedt`     | `support`    |

Prices are rounded to 2 decimals at output. All nine states contribute all three levels; INVALID and STALE
readings contribute none. **Zone width:** 10% of the active M5 channel's width, `U − L` on the same bar
(the default, standard §8; ADR-031).

## 9. Synthesis role

- **Voter**, not modifier. Independent MCDs vote; MCD3 modifies.
- **Proposed rung** (Davin decides, §9.3): Scalper = primary-timeframe structure; Day Trader = trendlines
  and channels (the timing channel). This matches architecture §2.13.
- **Rule rows:** none are proposed here. The draft rules table in architecture §3.4 already has MCD2 rows
  (rules 1, 2, 3, 3s and 4). After D5 its rows 3 and 3s name `DIP_VALUE_BUY` and `RALLY_VALUE_SELL`; they
  should read `UPTREND_DIP_BELOW_CORRIDOR` and `DOWNTREND_RALLY_ABOVE_CORRIDOR`. Rule content is Davin's
  (ADR-026) and changes there are made when synthesis is built (build step 4).
- **Note on bias:** D6 gives the sensor's own bias by trend direction in all three states of a trend.
  In `MCD2_UP_UPPER_BREAKOUT` and `MCD2_DOWN_LOWER_BREAKDOWN` the draft rule 2 reads the same regime word as
  "bias against the spike", so the synthesis result there differs from the sensor's bias. Synthesis decides
  the final direction (ADR-025), so this is allowed.
- **Data problems:** if MCD2 is not VALID or CAUTIONARY, the Scalper result is STAND_ASIDE with a data reason
  (architecture §3.3, mechanic 1). That is synthesis's job, not MCD2's.

## 10. Routing and knowledge

| Item                    | Content                                                                                                                                                                                                                                                                                                                     |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dispatch-matrix intents | **Direction** (as the primary sensor for Scalpers), **Entry timing** (when its levels supplied the zones), **Exit / targets** (levels on the target side), **Explain** (the terms UOEDT, LOEDT, corridor, SSA, channel position)                                                                                            |
| `tags.yaml`             | `MCD2`; the nine state codes; the regime words of §7 (two new); level names `UOEDT`, `baseline`, `LOEDT`                                                                                                                                                                                                                    |
| Playbook chunk (D2)     | Front-matter `mcd_id: MCD2`, `state_codes` (nine), `timeframe: M5`, `version: 2.0.0`. Sections: what it measures; the nine states; how to read an outside-corridor reading (the board's principle in words, marked provisional until `state_statistics` reach n ≥ 30); centroid versus fractal metric; what it does not say |
| Foundations chunk (D1)  | The M5 channel, UOEDT / baseline / LOEDT, SSA, channel position, trend band                                                                                                                                                                                                                                                 |
| Glossary                | Corridor, channel position, outside-corridor reading (all 16 languages)                                                                                                                                                                                                                                                     |
| Reason texts            | `DATA_STALE`, `RETUNING`, `NO_SETTING`, `DETECTION_MISMATCH`, `NO_STATS_AT_SLOT`, `CONTAINMENT_LOW`, `INSUFFICIENT_BARS`, `DISCONTINUITY`, `SANITY_FAILED`, `EVALUATOR_ERROR`, `MCD0_DEFECT_M5` (all 16 languages)                                                                                                          |
| Labelled questions      | M5-direction and M5-timing questions in all 16 languages (build step 6)                                                                                                                                                                                                                                                     |

All of this is stage 6 work and waits for the sensor worker, synthesis and the knowledge build.

## 11. `details` contents

| Field                  | Type    | Meaning                                                                                                                       |
| ---------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `trend_direction`      | string  | `UP`, `DOWN` or `SIDEWAYS` (standard §7.3). MCD3 reads it                                                                     |
| `regression_angle_deg` | number  | θ, 2 decimals, signed                                                                                                         |
| `channel_position`     | number  | CP on the last closed bar, 4 decimals; below 0 or above 1 means outside the corridor                                          |
| `window_bars`          | integer | `N_window` in closed M5 bars                                                                                                  |
| `containment_rate`     | number  | The statistics row's containment rate, 2 decimals, in percent                                                                 |
| `reversion_setup`      | boolean | True in the six outside-corridor states, false in the three inside states. A neutral flag until `state_statistics` measure it |
| `populated_candidates` | object  | `{"M5": [names]}`: other candidates with a value on the last closed bar (the fractal EDT on most cycles). Informational       |

INVALID and STALE readings carry an empty `details`. Size stays far below the 600-token budget.

## 12. Worked example

**Slot `2026-09-18T20:55Z` (v1 replica), setting M5 = `best_fit_a`.** Last closed M5 bar 2026-09-18T20:50Z
(the 20:55 bar is still forming). Statistics row for `best_fit_a` captured at the slot: θ = 6.94°,
containment 55.76% (≥ 50, passes), `containment_n` 755, so `N_window = 288`. On the last closed bar SSA
4378.0693, UOEDT 4384.2279, baseline 4367.1957, LOEDT 4350.1634, so CP = 0.8192.

| Step                | Result                                                                                                                                        |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Pre-flight          | All pass. The fractal EDT is populated too: `populated_candidates = {"M5": ["fractal"]}`, status stays VALID (D3)                             |
| Trend, corridor     | θ > 5 → UP; LOEDT ≤ SSA ≤ UOEDT → IN_CORRIDOR                                                                                                 |
| State, regime, bias | `MCD2_UP_IN_CORRIDOR` · `TREND_ALIGNED_CONTINUATION` · LONG · `reversion_setup` false                                                         |
| Levels (M5)         | UOEDT 4384.23 (resistance) · baseline 4367.20 (mid) · LOEDT 4350.16 (support)                                                                 |
| Summary             | "M5 uptrend, inside the corridor"                                                                                                             |
| Commentary (T01)    | "The M5 SSA is inside the corridor, between LOEDT 4350.16 and UOEDT 4384.23 (channel position 0.8192), while the channel slopes up (+6.94°)." |

The pre-retrofit run on the still-open 20:55 bar gave CP 0.7959 and the same state. The other three real
cycles (v1 `fractal`: CP 0.1065; v4 `cherry_a`: θ −20.94°, CP 0.1753; v4 `fractal`: θ −49.89°, CP 0.7932)
also keep their pre-retrofit state: `MCD2_UP_IN_CORRIDOR` for v1, `MCD2_DOWN_IN_CORRIDOR` for v4.

## 13. Tests

Standard §12, T1 to T13 (T14 is for derived MCDs and does not apply). Detail and the mapping of the 13
pre-retrofit tests: `mcd2_implementation_plan.md` §3.

- T1: one test per state (nine), each from a synthetic bundle.
- T2: boundaries just below, at and just above: θ = ±5.0 (SIDEWAYS at and inside, UP and DOWN beyond);
  m = L and m = U (inside) and a hair beyond each (outside); containment 49.99 / 50.0 / 50.01;
  `T_EDT` 48 / 49 (a channel under 48 closed bars is not read) and 288 / 289 / 290 (the cap); |θ| 90 / 90.01.
- T3: one test per pre-flight failure: `SANITY_FAILED` (unknown `data_status`, missing containment or
  angle, inverted channel on an old window bar, impossible angle), `DATA_STALE`, `RETUNING`, `NO_SETTING`,
  `DETECTION_MISMATCH`, `NO_STATS_AT_SLOT`, `CONTAINMENT_LOW`, `INSUFFICIENT_BARS`, `DISCONTINUITY`.
- T2 and T3, short channels (task P7): a real-shaped channel (bands on `T_EDT − 1` closed bars, null before) is read over
  `T_EDT − 1` bars for `T_EDT` 49 to 288 on the centroid and the fractal, and from 289 over 288; 48 and below (also 0 and
  negative) is INVALID + `INSUFFICIENT_BARS`; the parameter moves the boundary (0 gives `DISCONTINUITY`, 2 gives `T_EDT − 2`);
  the floor and the cap are parameters; a missing `T_EDT` still gives 288; the order of the checks; the stored v1 cycle cut to
  a short channel changes only `window_bars`; tier 3 reads the short window and nothing older.
- T4 to T8, T10 to T12: the kit's shared checks
  schema, corrupted bundle, wording, size).
- T9: replay of the stored fixtures. T13: the real cycles (v1 and v4, each with its centroid indicator and
  the fractal).

## 14. Open questions

Answered by Davin on 1 October 2026: **Q1 to Q6 approved as recommended** (third column). Q7, the
architecture word updates, is in the implementation plan and was approved too.

| #   | Question                                                                                                                                                                                                                                                                                                                                                                                                                                 | Recommendation                                            |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Q1  | **Fractal metric.** The board gives the SSA as the metric and is silent on the fractal EDT, which has no SSA. The pre-retrofit code uses the Close of the bar for it. Keep?                                                                                                                                                                                                                                                              | Keep Close                                                |
| Q2  | **Window fallback.** If `containment_n`, `visual_window_bars` and `window_bars` are all null, the pre-retrofit code silently uses 288. `containment_n` and `containment_rate` sit in the same `[EDT CHANNEL]` block of the statistics row, so a row without a horizon will usually lack the rate too, and tier 4 stops it (missing `containment_rate` → INVALID). Keep the fallback or make a missing horizon INVALID + `SANITY_FAILED`? | Keep the fallback (carried over; practically unreachable) |
| Q3  | **Window statistics dropped.** The pre-retrofit output counted bars above, below and inside the corridor over the window and the largest excursions. They never changed a state, and walkthrough C1 does not list them in `details`. Confirm they are dropped (the window still drives tiers 2 and 3).                                                                                                                                   | Drop                                                      |
| Q4  | **Tier 3 scope.** Pre-retrofit: UOEDT > LOEDT on every bar of the window. The kit's helper checks the last closed bar only. This spec keeps every bar. Confirm.                                                                                                                                                                                                                                                                          | Keep every bar                                            |
| Q5  | **Angle bound.** The pre-retrofit plan (not its code) required \|θ\| ≤ 90. This spec adds it as a tier-3 check (`max_abs_regression_angle_deg`). Keep?                                                                                                                                                                                                                                                                                   | Keep                                                      |
| Q6  | **Rungs.** Proposed: Scalper primary structure, Day Trader trendlines and channels (§9). Confirm or change.                                                                                                                                                                                                                                                                                                                              | Confirm                                                   |

Not questions, recorded for the reader: (a) the statistics' fit windows may include the still-open bar
(unverified, tracked in `.claude/state/waiting-on.md`; MCD2 reads `regression_angle` and
`containment_rate` from those fits, so the item is inherited and must be settled before certification);
(b) the board's rule "more than one indicator is invalid" is covered by the setting and decision D3
(`concept.md` §10a, row 1).

**Change 2026-10-01 (task P7, PATCH 2.0.1; `concept.md`, section "Change 2026-10-01").** The window counted `T_EDT` bars, one more than the
channel has on closed bars, and the floor of 48 lengthened a short window further: for an M5 channel with `T_EDT` 288 or less the
reading ended INVALID + `DISCONTINUITY`. Now `N_window = min(T_EDT − 1, 288)`, and a channel under 48 closed bars is INVALID +
`INSUFFICIENT_BARS`. No state, level, threshold or fixture output changes (the smallest `T_EDT` in a fixture is 314; only the
stored `evaluator_version` label moved). Davin confirmed the PATCH on 1 October 2026; the floor kept as a minimum, the
parameter and the decision entry follow the recommended answers (`concept.md`, Q1 to Q5).
