# MCD3 concept (readback of Davin's concept board)

Source images: `concept/mcd3-xauusd-m5-and-m15.png`

Written in task P2 on 1 October 2026 from the board (Thai text translated here) and the pre-retrofit
specification, plan and code (`legacy/`). Every rule is marked **Board** (read from the image) or **Legacy**
(not on the board; carried over from the pre-retrofit spec, plan, code, the architecture or an earlier decision).
**Status: confirmed by Davin on 1 October 2026** (replica v1 is an acceptable stand-in for the board's situation). The translation is the builder's; a misread principle is what this step exists to catch.

## 1. Core principle

MCD3 asks whether the M15 and M5 channels form one **Consolidated Trend**, and, if they do, where the price
sits inside the M15 corridor (the **EDT Stochastic**). A Consolidated Trend is a strongly confirmed trend: the
gold price direction stays firmly under the influence of that trend. The EDT Stochastic is the product of a
Consolidated Trend. If there is no Consolidated Trend there is no EDT Stochastic. The value is meant to be used
together with the analysis of MCD1 and MCD2.

## 2. Timeframes and candidate indicators

- Timeframes: **M15 and M5** (Board: the example draws the M15 channel and the M5 channel).
- Candidate indicators, any one active per timeframe, chosen by the setting (Legacy; the board's example uses
  `non-b` on M15 and `best-fit-a` on M5): M15 has the seven centroid variants `best_fit_a`, `best_fit_b`,
  `cherry_a`, `cherry_b`, `most_recent`, `non_a`, `non_b`; M5 has the same seven plus `fractal`.

## 3. Rules

| #   | Rule                                                                                                                                                                                                                                                      | Source |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| R1  | A Consolidated Trend occurs only when all three of R2, R3 and R4 hold.                                                                                                                                                                                    | Board  |
| R2  | **Condition 1.** The M15 trend and the M5 trend are the same kind of trend.                                                                                                                                                                               | Board  |
| R3  | **Condition 2.** The M5 EDT corridor is inside the M15 EDT corridor for at least **75%** of the M5 EDT length (the M5 EDT time horizon).                                                                                                                  | Board  |
| R4  | **Condition 3.** The M5 EDT corridor at the current bar is inside the M15 EDT corridor at the current bar. In short: the M5 EDT corridor is totally inside the M15 EDT corridor.                                                                          | Board  |
| R5  | When all three hold the trend is called a Consolidated Trend, a strongly confirmed trend.                                                                                                                                                                 | Board  |
| R6  | The EDT Stochastic is measured as **[(M15 UOEDT, current bar − M15 SSA, current bar) ÷ (M15 UOEDT, current bar − M15 LOEDT, current bar)] × 100**.                                                                                                        | Board  |
| R7  | The result indicates the position of the gold price on the M15 EDT corridor.                                                                                                                                                                              | Board  |
| R8  | The EDT Stochastic is used together with MCD1 and MCD2.                                                                                                                                                                                                   | Board  |
| R9  | If there is no Consolidated Trend, there is no EDT Stochastic (it is unavailable).                                                                                                                                                                        | Board  |
| R10 | Example on the board: the M15 `non-b` channel slopes down and the M5 `best-fit-a` channel slopes up, so the conditions are not met and the EDT Stochastic cannot be calculated.                                                                           | Board  |
| R11 | The trend of a timeframe is up when the regression angle is above +5°, down below −5°, sideways within ±5° (inclusive).                                                                                                                                   | Legacy |
| R12 | Both channels must be intact: containment rate ≥ 50% on M15 and on M5 (architecture §2.4, §2.6).                                                                                                                                                          | Legacy |
| R13 | "Inside" means LOEDT(M5) ≥ LOEDT(M15) and UOEDT(M5) ≤ UOEDT(M15), edges included. Each M5 bar is compared with the M15 bar that holds it (backward as-of match on the open time).                                                                         | Legacy |
| R14 | The M5 EDT length is `T_EDT` of the M5 channel, read from the statistics row (`containment_n`).                                                                                                                                                           | Legacy |
| R15 | The price metric of the stochastic is the **SSA of the M15 channel**. The corridor edges are the M15 channel's UOEDT and LOEDT.                                                                                                                           | Board  |
| R16 | Zones of the stochastic: lower zone ≤ 20, upper zone ≥ 80, middle zone between (the zone values are written for the pre-retrofit formula, see §10a row 1).                                                                                                | Legacy |
| R17 | Consolidated with both trends up gives three states (lower, middle, upper zone); both down gives three; both sideways gives one (any value). Not consolidated gives three failure states by the first failed condition: trend conflict, overflow, escape. | Legacy |

## 4. States

The board shows two situations: a Consolidated Trend (with the EDT Stochastic) and no Consolidated Trend
(without it). The ten states are the pre-retrofit register (R17); their bias and wording are decided in this
retrofit (D6, standard §7.4).

| State                                  | When                                       | What it means (plain)                                                                        | Example                                                       |
| -------------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `MCD3_BULL_VALUE`                      | Both up, nested; M15 SSA in the lower zone | Both channels slope up and are nested; the SSA is at the lower end of the M15 corridor       | None on the replicas (synthetic)                              |
| `MCD3_BULL_MID`                        | Both up, nested; middle zone               | The same, with the SSA in the middle of the M15 corridor                                     | None on the replicas (synthetic)                              |
| `MCD3_BULL_TOP`                        | Both up, nested; upper zone                | The same, with the SSA at the upper end of the M15 corridor                                  | None on the replicas (synthetic)                              |
| `MCD3_BEAR_PREMIUM`                    | Both down, nested; upper zone              | Both channels slope down and are nested; the SSA is at the upper end of the M15 corridor     | None on the replicas (synthetic)                              |
| `MCD3_BEAR_MID`                        | Both down, nested; middle zone             | The same, with the SSA in the middle of the M15 corridor                                     | None on the replicas (synthetic)                              |
| `MCD3_BEAR_BOTTOM`                     | Both down, nested; lower zone              | The same, with the SSA at the lower end of the M15 corridor                                  | **Replica v3** (slot 2026-09-28T14:15Z), `non_b` + `cherry_a` |
| `MCD3_SIDEWAYS_EQUILIBRIUM`            | Both flat, nested                          | Both channels are flat and nested                                                            | None on the replicas (synthetic)                              |
| `MCD3_NON_CONSOLIDATED_TREND_CONFLICT` | Condition 1 fails                          | The trends differ, so there is no Consolidated Trend (the board's own example)               | **v1 slot** (the board's situation); v4 `non_a`; v2 `fractal` |
| `MCD3_NON_CONSOLIDATED_OVERFLOW`       | Condition 1 holds, condition 2 fails       | The trends agree but the M5 corridor is inside the M15 corridor on too few window bars       | **v4 slot**, `cherry_a` and `fractal`; v2, v3                 |
| `MCD3_NON_CONSOLIDATED_ESCAPE`         | Conditions 1 and 2 hold, condition 3 fails | The trends agree and the nesting share is met, but the latest M5 corridor extends beyond M15 | None on the replicas (synthetic)                              |

## 5. No answer when

The board says only that without a Consolidated Trend there is no EDT Stochastic (R9); that is a state
(`details.edt_stochastic` is `null`), not a failure. A reading that cannot be made at all (no setting, no
statistics row at the slot, containment below 50%, too few or broken bars, an impossible channel, an unusable
MCD1 or MCD2 reading) ends as INVALID or STALE with a reason code, never as a state (standard §6).

## 6. Example times and test slots

The board marks two times, **2026.09.16 05:45** and **2026.09.21 12:45**, with arrows to dashed vertical lines
on both charts. It does not say what they mean; they look like the start and the end of the window the two charts
show (§10a row 6). **No replica was exported at either time** (v1 is slot
`2026-09-18T20:55Z`, v2 `2026-09-27T23:40Z`, v3 `2026-09-28T14:15Z`, v4 `2026-09-28T23:15Z`), and a replica
holds statistics for its export slot only, so the board times cannot be real-data tests.
The board's **situation** is reproduced by the v1 cycle: M15 `non_b` slopes down (−29.72°), M5 `best_fit_a` slopes up
(+6.94°), the conditions fail, and the EDT Stochastic is unavailable, which is what the board says of its chart.
Real readings from the replicas (closed-bar view; implementation plan §5): trend conflict on v1, v4 (`non_a`)
and v2 (`fractal`); overflow on v4, v3 and v2; one **real consolidated trend**, `MCD3_BEAR_BOTTOM` on v3. The
escape state and the six other consolidated states are tested with synthetic bundles.

## 7. Data used

Each column was checked in the M5 and M15 sheets of the replica workbooks (v1 to v4) and each statistics
field in `prisma/market-data/schema.prisma`.

| Data                                                                                                                                                  | Where                                                                              | Exists                                |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------- |
| `timestamp`; for the active M15 indicator `{ind}_ssa`, `{ind}_uoedt`, `{ind}_loedt`, `{ind}_base_fl`                                                  | `market_data_v6` (M15)                                                             | yes                                   |
| `timestamp`; for the active M5 indicator `{ind}_uoedt`, `{ind}_loedt`, `{ind}_base_fl` (fractal: `fractal_uoedt`, `fractal_loedt`, `fractal_best_fl`) | `market_data_v6` (M5)                                                              | yes                                   |
| `containment_rate` (both timeframes), `containment_n` (else `visual_window_bars`, else `window_bars`) (M5)                                            | `indicator_statistics`, source = the active indicator (`fractal` is `fractal_edt`) | yes                                   |
| `trend_direction` and `regression_angle_deg` of MCD1 (M15) and MCD2 (M5)                                                                              | The upstream readings of the same cycle                                            | yes (both evaluators are retrofitted) |

7b. Levels contributed (proposed, decision D7): **UOEDT, baseline, LOEDT on M15 and on M5**, from the last
closed bars. Zones use 10% of the width of the channel the level belongs to (standard §8, ADR-031). The board
marks no level.

## 8. Wording the standard will change

| Pre-retrofit wording                                                                                                                                                                                        | New                                                                                                           |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `tactical_bias` values `HIGH_CONVICTION_BUY_DIP`, `HIGH_CONVICTION_SELL_RALLY`, `CAUTION_TAKE_PROFIT_BUY` / `_SELL`, `HOLD_BULLISH_TREND_RUNNER`, `HOLD_BEARISH_TREND_RUNNER`, `RANGE_BOUND_MEAN_REVERSION` | `bias` ∈ LONG · SHORT · NEUTRAL · STAND_ASIDE per state (D6); no advice words (standard §7.2, §7.4)           |
| "Prime Buy Dip Opportunity", "Hold long positions", "Take Profit", "Gold price is strongly confirmed to be under persistent bullish channel governance"                                                     | Location, counts and the stochastic number only; no advice, no confirmation language (T01 to T10)             |
| "{stoch}%", "{nesting_pct}%" in commentary                                                                                                                                                                  | No `%` in commentary (T11): "973 of 1037 closed M5 bars"; the stochastic is an index number, not a percentage |
| `MCD3_INVALID`, `MCD3_UNKNOWN`, `trend_state = INVALID`                                                                                                                                                     | Status INVALID or STALE with a reason code, no state                                                          |
| `stochastic_zone`, `consolidated_trend_state`, the pre-retrofit `validation` block                                                                                                                          | The state code and `details`; diagnostics to logs                                                             |

## 9. Overlap with existing MCDs

- **MCD1** (M15) and **MCD2** (M5) each give a trend, a state and levels. MCD3 **reads** their `details.trend_direction`
  (ADR-021) and adds only what they do not measure: the nesting of the two corridors and the EDT Stochastic.
  It re-emits the same channel levels (decision D7: spec §8 explains the duplicate-level point).
- **MCD0** (gate) will mark MCD3 CAUTIONARY when either channel fit fails its quality criteria
  (`uses_channel: [M5, M15]`).
- MCD3 modifies (confirms or cautions); it does not vote (architecture §3.3, mechanic 3).

## 10. Questions for Davin

### 10a. Where the pre-retrofit spec, plan or code differs from the board, or from each other

| #   | Board says                                                                                                         | Pre-retrofit spec, plan or code                                                                                                                                                                            | Proposal in this retrofit                                                                                                                                                                                                                                                                                |
| --- | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | EDT Stochastic = (UOEDT − SSA) ÷ (UOEDT − LOEDT) × 100: **0 at the ceiling (UOEDT), 100 at the floor (LOEDT)**     | (SSA − LOEDT) ÷ (UOEDT − LOEDT) × 100: **0 at the floor, 100 at the ceiling** ("Standard Stochastic Orientation", spec header, 21 September 2026). The two add up to 100                                   | **Decision D10: option A** (Davin, 1 October 2026), the pre-retrofit formula. Nothing else depends on it: the zones are written on the position from LOEDT, so the states, levels and thresholds are the same either way; only the reported number and one parenthesis in six templates change (spec §6) |
| 2   | Silent on the 20 / 80 zones, the seven consolidated states and on bias                                             | Seven consolidated states from the zones 20 / 80; bias values such as `HIGH_CONVICTION_BUY_DIP`                                                                                                            | Zones and states carried over (Legacy). Bias is decision D6 (starting points in the registry, not yet approved)                                                                                                                                                                                          |
| 3   | The trends are "the same kind"                                                                                     | Recomputes ±5° from `regression_angle` of the two statistics rows                                                                                                                                          | Reads MCD1's and MCD2's `details.trend_direction` (ADR-021; walkthrough C3). Same bands, applied once, upstream                                                                                                                                                                                          |
| 4   | Nesting for 75% of "the M5 EDT length (time horizon)"                                                              | Window = `containment_n` of M5, evaluated on the populated bars including the open bar; silent defaults 755 (M5) and 1808 (M15) when the field is missing, which are the v1 values                         | **Finding (spec §3, Q1):** the channel's `T_EDT` rows end at the still-open bar, so on closed bars the window is `T_EDT − 1`. No hidden default: a missing horizon is INVALID + `SANITY_FAILED` (Q2)                                                                                                     |
| 5   | "At current bar"                                                                                                   | Compares the last row of each sheet (the still-open bars), by row, not by time                                                                                                                             | The last closed M5 bar against the closed M15 bar that holds it (as-of match; at :05 and :10 the last closed M15 bar, rule 1)                                                                                                                                                                            |
| 6   | The board's example times 2026.09.16 05:45 and 2026.09.21 12:45                                                    | Plan and manifest certify on the v1 export (2026-09-18T20:55Z)                                                                                                                                             | The board times match no replica. v1 reproduces the board's situation (§6). Davin confirmed on 1 October 2026 that v1 is an acceptable stand-in                                                                                                                                                          |
| 7   | "0 to 100" is not stated; the board says only "an indicator of the position of the gold price on the M15 corridor" | Spec says "0% … 100%"; the code never clips: the value is below 0 or above 100 when the M15 SSA is outside its corridor, and the zones then still apply. Real example: replica v3, −1.02 (A) or 101.02 (B) | Keep the value unclipped; zones follow the position (Q7)                                                                                                                                                                                                                                                 |
| 8   | —                                                                                                                  | `MCD3_SIDEWAYS_EQUILIBRIUM` is described as "In Corridor (0 ≤ Stoch ≤ 100)", but the code assigns it for any value                                                                                         | Keep it for any value; the template names the SSA's place in words (Q7)                                                                                                                                                                                                                                  |
| 9   | —                                                                                                                  | Plan §7 sample output (nesting 20.53%, 155 of 755, M15 horizon 336, M15 corridor 4350.59 to 4443.37) disagrees with the real output (0.0%, 0 of 755, 1808, 4125.99 to 4279.21) and with the spec §6        | The stale sample is dropped with the old plan. The real v1 numbers are in the plan §6                                                                                                                                                                                                                    |
| 10  | —                                                                                                                  | Plan §6 lists 6 of the 10 commentary templates; its conflict template hard-codes a `+` before the M5 angle; the code has all 10                                                                            | Ten templates in the registry (T01 to T10); the angle sign comes from the value                                                                                                                                                                                                                          |
| 11  | —                                                                                                                  | Tier 1 requires exactly one populated candidate per timeframe (v1 on M5 and v4 on M15 fail without an override)                                                                                            | The setting decides (rule 6, D3). Populated others go to `details.populated_candidates`                                                                                                                                                                                                                  |

### 10b. Open

Everything that needs an answer before the specification is final is in `mcd3.md` section 14 (decisions D10, D6
and D7, and questions Q1 to Q9) and in the decisions list of the implementation plan.
