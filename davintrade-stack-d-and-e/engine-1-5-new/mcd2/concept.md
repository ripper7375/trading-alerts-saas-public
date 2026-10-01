# MCD2 concept (readback of Davin's concept board)

Source images: `concept/mcd2-xauusd-m5-best-fit-a.png`, `concept/mcd2-xauusd-m5-fractal.png`

Written in task P2 on 1 October 2026 from the two boards (Thai text translated here) and the pre-retrofit
specification (`legacy/`). Every rule is marked **Board** (read from an image) or **Legacy** (not on the
board; carried over from the pre-retrofit spec, the architecture or an earlier decision). Davin confirmed
the readback on 1 October 2026.

## 1. Core principle

On M5 the active EDT indicator's channel gives a trend (up, down or sideways). Where that indicator's
SSA line sits relative to the channel's corridor (between LOEDT and UOEDT) says how large the deviation
from the channel is. Inside the corridor the deviation is not high. Outside it the deviation is very
high: the board reads this as a breakout of the M5 trend's corridor, and still assumes the price keeps
following the original trend (up, down or sideways).

## 2. Timeframes and candidate indicators

- Timeframe: **M5** only. (Board 2: MCD2 reads the M5 trend; MCD1 reads the M15 trend.)
- Candidate indicators, any one of them active, chosen by the setting (Board): `best_fit_a`, `best_fit_b`,
  `cherry_a`, `cherry_b`, `most_recent`, `non_a`, `non_b` and `fractal`. The board's example uses
  `best_fit_a`.
- The fractal EDT can be used in MCD2. It cannot be used in MCD1 (Board 2).

## 3. Rules

| #   | Rule                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Source |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| R1  | The M5 trend is determined from the active EDT indicator (any one of the eight candidates).                                                                                                                                                                                                                                                                                                                                                            | Board  |
| R2  | Only one indicator may be active. More than one is invalid.                                                                                                                                                                                                                                                                                                                                                                                            | Board  |
| R3  | The corridor is the band between that indicator's LOEDT and UOEDT. The price metric is the **SSA** of that indicator.                                                                                                                                                                                                                                                                                                                                  | Board  |
| R4  | SSA inside the corridor (LOEDT ≤ SSA ≤ UOEDT): the deviation is not yet high enough to make a reversal (mean reversion to the corridor) likely.                                                                                                                                                                                                                                                                                                        | Board  |
| R5  | SSA outside the corridor (SSA > UOEDT or SSA < LOEDT) is a breakout of the corridor of the M5 trend. Implication: the deviation is high enough to bring a reversion to the corridor, but there is a low risk that the M5 trend stops. In short, an SSA breakout of UOEDT or LOEDT is an occasion for the trader to act on a very abnormal deviation only, while the price is still assumed to continue with the original trend (up, down or sideways). | Board  |
| R6  | The M5 trend direction is up when the regression angle is above +5°, down when below −5°, sideways when within ±5° (inclusive).                                                                                                                                                                                                                                                                                                                        | Legacy |
| R7  | For the fractal EDT, which has no SSA line, the price metric is the **Close** of the bar.                                                                                                                                                                                                                                                                                                                                                              | Legacy |
| R8  | The corridor is judged on the last bar only. Inside means CP between 0 and 1 inclusive, where CP = (metric − LOEDT) ÷ (UOEDT − LOEDT). Above means CP > 1, below means CP < 0.                                                                                                                                                                                                                                                                         | Legacy |
| R9  | Trend (3) × corridor position (3) gives nine states.                                                                                                                                                                                                                                                                                                                                                                                                   | Legacy |
| R10 | The channel must be intact: containment rate ≥ 50% (architecture §2.4, §2.6).                                                                                                                                                                                                                                                                                                                                                                          | Legacy |

## 4. States

The board shows two situations (inside the corridor, outside it) and three trend classes. The nine
states below are the pre-retrofit register (R9); their regime words and biases are decided in this
retrofit (D5, D6).

| State                           | When                              | What it means (plain)                                                  | Example time                        |
| ------------------------------- | --------------------------------- | ---------------------------------------------------------------------- | ----------------------------------- |
| `MCD2_UP_IN_CORRIDOR`           | Slope up, inside the corridor     | The metric moves inside the channel that slopes up                     | v1 slot, `best_fit_a` and `fractal` |
| `MCD2_UP_UPPER_BREAKOUT`        | Slope up, above UOEDT             | The metric is above the upper band, in the direction of the slope      | None on the replicas (synthetic)    |
| `MCD2_UP_LOWER_BREAKDOWN`       | Slope up, below LOEDT             | The metric is below the lower band, against the direction of the slope | None on the replicas (synthetic)    |
| `MCD2_DOWN_IN_CORRIDOR`         | Slope down, inside the corridor   | The metric moves inside the channel that slopes down                   | v4 slot, `cherry_a` and `fractal`   |
| `MCD2_DOWN_LOWER_BREAKDOWN`     | Slope down, below LOEDT           | The metric is below the lower band, in the direction of the slope      | None on the replicas (synthetic)    |
| `MCD2_DOWN_UPPER_BREAKOUT`      | Slope down, above UOEDT           | The metric is above the upper band, against the direction of the slope | None on the replicas (synthetic)    |
| `MCD2_SIDEWAYS_IN_CORRIDOR`     | Flat channel, inside the corridor | The metric moves inside a flat channel                                 | None on the replicas (synthetic)    |
| `MCD2_SIDEWAYS_UPPER_BREAKOUT`  | Flat channel, above UOEDT         | The metric is above the upper band of a flat channel                   | None on the replicas (synthetic)    |
| `MCD2_SIDEWAYS_LOWER_BREAKDOWN` | Flat channel, below LOEDT         | The metric is below the lower band of a flat channel                   | None on the replicas (synthetic)    |

## 5. No answer when

The board says only that more than one active indicator is invalid (R2). Everything else comes from the
standard: no setting, no statistics row at the slot, containment below 50%, too few or broken bars and an
impossible channel each end the reading as INVALID or STALE with a reason code, never as a state (standard §6).

## 6. Example times and test slots

Both boards are the **v1 cycle, slot `2026-09-18T20:55Z`**. The numbers printed on the boards match the
replica's statistics row for that slot: board 1 shows angle 6.94°, raw slope 0.05268 and channel width
34.06 USD (`best_fit_a`); board 2 shows raw slope 0.08177852 and channel width 38.28 USD (fractal). A
real-data test therefore exists for both boards. The red circles on board 1 mark earlier SSA excursions
outside the corridor on 16 to 18 September; they illustrate the principle and are not separate test slots,
because a replica holds statistics for its export slot only. The v4 workbook (slot `2026-09-28T23:15Z`)
is a second real cycle: `cherry_a` slopes down about 21° and the fractal about 50°. All four real-data
readings (v1 and v4, each with its centroid indicator and the fractal) land in an `IN_CORRIDOR` state, so
the six outside-corridor states and the sideways states are tested with synthetic bundles.

## 7. Data used

Each column was checked in the M5 sheet of both replica workbooks (v1 and v4) and each statistics field in
`prisma/market-data/schema.prisma`.

| Data                                                                                                                     | Where                                                                              | Exists |
| ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- | ------ |
| `timestamp`, `close`                                                                                                     | `market_data_v6` (M5)                                                              | yes    |
| `{ind}_ssa`, `{ind}_uoedt`, `{ind}_loedt`, `{ind}_base_fl` for the seven centroid candidates                             | `market_data_v6` (M5)                                                              | yes    |
| `fractal_best_fl`, `fractal_uoedt`, `fractal_loedt`                                                                      | `market_data_v6` (M5)                                                              | yes    |
| `regression_angle`, `containment_rate`, `containment_n` (else `visual_window_bars`, else `window_bars`), `channel_width` | `indicator_statistics`, source = the active indicator (`fractal` is `fractal_edt`) | yes    |

7b. Levels contributed: **UOEDT, baseline, LOEDT on M5**, from the last closed M5 bar. Zones use 10% of
the active M5 channel's width (standard §8, ADR-031). The board marks no other level.

## 8. Wording the standard will change

| Pre-retrofit wording                                                        | New                                                                                                         |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| "high probability of Mean Reversion", "low risk", `HIGH` / `LOW` flags      | No probabilities (R9). One neutral flag `details.reversion_setup`, true outside the corridor                |
| "prime Buy Opportunity", "Sell the Rally", "Take Profit", "high-conviction" | No advice words. Regime words `UPTREND_DIP_BELOW_CORRIDOR`, `DOWNTREND_RALLY_ABOVE_CORRIDOR` (D5)           |
| "SSA safely within the EDT corridor"                                        | Location only: "The M5 SSA is inside the corridor, between LOEDT … and UOEDT …" ("safely" is a banned word) |
| Failure as a state (`MCD2_UNIDENTIFIED`, `trend_state = INVALID`)           | Status INVALID or STALE with a reason code                                                                  |

## 9. Overlap with existing MCDs

- **MCD1** reads the M15 trend and cannot use the fractal EDT; MCD2 reads the M5 trend and can. Same
  channel family, different timeframe, no shared state.
- **MCD3** (derived) will read MCD2's `details.trend_direction` instead of recomputing the ±5° band.
- **MCD0** (gate) will mark MCD2 CAUTIONARY when the M5 channel fit fails its quality criteria
  (`uses_channel: [M5]`).

## 10. Questions for Davin

### 10a. Where the pre-retrofit spec or code differs from the board

| #   | Board says                                                                                             | Pre-retrofit spec or code                                                                       | Proposal in this retrofit                                                                                                                                                      |
| --- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Only one indicator; more than one is invalid                                                           | Counts populated candidates in the data; two populated means INVALID                            | The setting names exactly one indicator (rule 6, D3). Others populated beside it go to `details.populated_candidates` and change nothing. Settled by D3; listed for the record |
| 2   | The metric is the SSA. Silent on the fractal EDT (it has no SSA)                                       | Close for the fractal EDT                                                                       | Keep Close for the fractal EDT. **Confirm** (spec §14, Q1)                                                                                                                     |
| 3   | Inside the corridor the deviation is "not high enough to make a reversal likely"; outside it is "high" | `mean_reversion_probability` HIGH / LOW and `trend_continuation_risk` LOW as fields and in text | The board's idea stays as `details.reversion_setup` plus words in the playbook chunk; no probability fields or words (R9)                                                      |
| 4   | "An occasion to open a buy or sell position"                                                           | Regime words `DIP_VALUE_BUY_OPPORTUNITY`, `RALLY_VALUE_SELL_OPPORTUNITY`; "take profit" in text | Renamed (D5); bias per D6; no advice words (standard §7.4)                                                                                                                     |
| 5   | The price is "still assumed to continue with the original trend", also for outside-corridor readings   | Different implied direction per outside state ("short scalp", "buy the dip")                    | D6 follows the board: bias follows the trend in all three states of a trend (UP is LONG, DOWN is SHORT, SIDEWAYS is NEUTRAL)                                                   |
| 6   | Silent on how the trend is found, the corridor edges, the window and the 50% containment gate          | ±5° band, CP < 0 or > 1, window `min(T_EDT, 288)`, containment ≥ 50%                            | Carried over (architecture §2.5, §2.6). Not a change                                                                                                                           |
| 7   | Silent on which bar is read                                                                            | The still-open bar (last Excel row)                                                             | The last **closed** bar (rule 2). On all four real cycles the state is unchanged; channel positions move slightly (implementation plan §6)                                     |

### 10b. Open

Everything that needs an answer before the specification is final is in `mcd2.md` section 14
(questions Q1 to Q6) and in the decisions list of the implementation plan.

## Change 2026-10-01

Written in task P7 (a) on 1 October 2026. **Status: the PATCH classification was confirmed by Davin on 1 October 2026 and the
change was built in task P7 (b) the same day (evaluator 2.0.1).** Questions Q1 to Q5 below were not answered one by one: the build
follows the recommended answers, and Davin may still change them. (The "What else it touches" table below was written before the build; its
"Action in P7 (b)" column is what was done.) Source images: none new. This is not a
board change. It comes from a finding in the MCD3 retrofit (hand-off
[2026-10-01-0703-mcd3-p2](../../../docs/handoffs/2026-10-01-0703-mcd3-p2.md) §7 item 2, recorded in
[waiting-on](../../../.claude/state/waiting-on.md)) and from Davin's description: adjust the channel window for short
channels. The same change is written for MCD1 in `mcd1/concept.md`; both go in one patch.

### Evidence

The band columns (UOEDT, baseline, LOEDT) exist on exactly `T_EDT` rows ending at the still-open bar, on 7 of 7 real
channels in replicas v1 and v4 (M5 `best_fit_a` 755, `fractal` 336, `cherry_a` 1134, `fractal` 410). On closed bars
(rule 2) a channel therefore has `T_EDT − 1` rows. MCD2 reads `max(48, min(T_EDT, 288))` closed M5 bars and needs a
number in every column on every one of them (tier 2). For an M5 channel with `T_EDT` of 288 or less that window
reaches one bar before the channel (more, for `T_EDT` under 48), meets a null and ends INVALID + `DISCONTINUITY`.
Re-run on 1 October 2026 on the v1 bundle (`best_fit_a`) with the bands removed beyond `T_EDT − 1` rows: `T_EDT` 289
and above is VALID with window 288; 288 and below is INVALID + `DISCONTINUITY`. No replica or fixture triggers it
(the smallest M5 `T_EDT` in any fixture of MCD1, MCD2 or MCD3 is 314), but a live channel can be short. An MCD2
INVALID reaches MCD3 as `UPSTREAM_UNAVAILABLE:MCD2`.

Whether the statistics' fit window also includes the open bar is a separate open question (waiting-on). This change
does not depend on it: it only stops the window from reading rows where no channel exists.

### Rules changed

| Rule                                                                                  | Before                                                           | After                                                                                                                                                         |
| ------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Window length (carried over from the old spec; §10a row 6)                            | `N_window = max(48, min(T_EDT, 288))` closed M5 bars             | **Changed:** `N_window = min(T_EDT − 1, 288)` closed M5 bars. The 1 is a new parameter, `t_edt_open_bar_rows` (Q2): the channel's last row is the forming bar |
| 48-bar floor                                                                          | Lengthens a short window to 48, which reaches before the channel | **Changed:** a channel with fewer than 48 closed bars is not read: INVALID + `INSUFFICIENT_BARS`. The floor stays a minimum, not a window length (Q1)         |
| `T_EDT` unknown (all of `containment_n`, `visual_window_bars`, `window_bars` missing) | `N_window` = 288                                                 | Unchanged. With no `T_EDT` there is nothing to subtract (spec Q2, carried over)                                                                               |
| The 288 cap, the ±5° band, containment ≥ 50%, CP 0 and 1, tier order                  | as in §3 and the spec                                            | Unchanged                                                                                                                                                     |

Resulting behaviour on a real channel (bands on `T_EDT − 1` closed rows), with the recommended answer to Q1:

| `T_EDT`     | Before                    | After                                 |
| ----------- | ------------------------- | ------------------------------------- |
| 48 or less  | INVALID + `DISCONTINUITY` | INVALID + `INSUFFICIENT_BARS`         |
| 49 to 288   | INVALID + `DISCONTINUITY` | VALID, window `T_EDT − 1` (48 to 287) |
| 289 or more | VALID, window 288         | The same                              |

Not changed: the nine states and their codes, regime words, bias, levels, thresholds, the `details` fields
(`window_bars` differs only where `T_EDT` is 288 or less), the closed-bar rule, the envelope, every stored fixture
envelope and `mcd2_output.json`. The bound of 288 (24 hours of M5) stays.

### Classification

**PATCH: evaluator version 2.0.0 to 2.0.1** (standard §14), as Davin classed it. No state, meaning, level or
dependency changes and no threshold value changes; the output changes only where the old output was a defect (a
channel that exists, read as broken). **Zero existing fixture outputs change:** every M5 channel in the fixtures has
`T_EDT` of 314 or more, so the window is 288 before and after. There are no golden scenarios yet (synthesis is not
built). A PATCH does not start a new statistics series.

One caveat, for Davin (Q3): §14 says a PATCH leaves "tests pass unchanged". Three existing MCD2 unit tests pin the
old formula on synthetic bundles whose bands cover every row, so they must be edited:
`test_the_window_is_between_48_and_288_bars`, `test_the_bar_count_must_reach_the_window`, and the 100 and 60 cases of
`test_t_edt_falls_back_in_order_and_ends_at_288`. They are not fixtures or golden scenarios. New tests with a
realistic short channel are added.

### What else it touches

| Item                                               | Effect                                                                                                                                                                                                                   | Action in P7 (b)                                                                                                                                |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| MCD3 (`depends_on` MCD1 and MCD2)                  | Its three stored `upstream.json` readings do not change. For a short M5 channel (`T_EDT` 49 to 288) MCD3 no longer receives `UPSTREAM_UNAVAILABLE:MCD2` because of this defect. MCD3's own window is `T_EDT − 1` already | Re-run the MCD3 suite (134 tests and the opt-in scan of the 12 real pairings). No review (PATCH). Wording of two notes in MCD3's documents (Q5) |
| Synthesis rule rows that name MCD2's states        | None: no state is added, renamed or removed (draft table, architecture §3.4)                                                                                                                                             | Nothing to review                                                                                                                               |
| Golden scenarios                                   | None exist yet                                                                                                                                                                                                           | Run them when they exist; nothing should move                                                                                                   |
| `mcd2.md`                                          | §3 window row, §6 formula and parameter table, §13 test list (the `T_EDT` 47, 48, 49 and 287, 288, 289 cases), the new case for a short channel                                                                          | Edit; note the change in the status line                                                                                                        |
| `mcd2_params.yaml`, `mcd2_registry.yaml`           | New parameter `t_edt_open_bar_rows` (1); the `min_window_bars` and `max_window_bars` boundary text; `evaluator_version` 2.0.1                                                                                            | Edit                                                                                                                                            |
| `mcd2_evaluator.py` and its tests                  | `_window_bars` and the tier 2 check; the three tests named above; new tests                                                                                                                                              | Edit; a fresh P6 check afterwards                                                                                                               |
| `mcd2_implementation_plan.md`, manifest            | Version, a change record, test counts                                                                                                                                                                                    | Edit                                                                                                                                            |
| Architecture §2.5 (MCD2 window cell) and §2.13 row | "stats over min(T_EDT, 288)" is stated there; the row's version reads 2.0.0                                                                                                                                              | Edit both, 2.0.1                                                                                                                                |
| Decision entry                                     | The window is stated in the architecture, so P7 (b) drafts one (Q4)                                                                                                                                                      | Draft as ADR-083, for MCD1 and MCD2 together                                                                                                    |
| `.claude/state/waiting-on.md`                      | The item "MCD2 and MCD1 windows reach one bar before a short channel" closes                                                                                                                                             | Move to the resolved file                                                                                                                       |

### Questions for Davin

| #   | Question                                                                                                                                                                                                                                                                                                                                                                                                                         | Recommended          |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| Q1  | **The floor.** Applying `min(T_EDT − 1, 288)` alone drops the 48-bar floor: a channel of 30 closed bars would give a VALID reading over 29 bars (re-run today). Keep 48 as a minimum (the channel must hold at least 48 closed bars, else INVALID + `INSUFFICIENT_BARS`, as MCD3 already does with its `min_nesting_window_bars` of 48, so the two agree on when an M5 channel is too short), or let the window shrink below 48? | Keep 48 as a minimum |
| Q2  | **A parameter or a constant.** Add `t_edt_open_bar_rows` = 1 to `mcd2_params.yaml` under the same name and value as MCD3, so the 1 is stated once with its reason and a different answer to the fit-window question is a one-value change (a MINOR change then)? Or a constant in the code?                                                                                                                                      | Parameter            |
| Q3  | **PATCH or MINOR.** Keep PATCH although three unit tests change (see Classification)? MINOR would start a new statistics series; none exists yet.                                                                                                                                                                                                                                                                                | PATCH                |
| Q4  | **Decision entry.** Architecture §2.5 states the window, so the walkthrough asks for a draft. Draft one entry, ADR-083, for MCD1 and MCD2 together?                                                                                                                                                                                                                                                                              | Yes                  |
| Q5  | **MCD3 wording.** `mcd3.md` §14 (c) and `mcd3_implementation_plan.md` lines 202 to 203 say the defect is outside the MCD3 task. May P7 (b) change those two notes to say it is fixed? Wording only; no change to MCD3's rules, code, tests or version.                                                                                                                                                                           | Yes                  |
