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
