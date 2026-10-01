# MCD1 concept (readback of the pre-retrofit specification)

Source images: none. MCD1 has no concept board; this readback is written from the pre-retrofit
specification (`legacy/`: the Thai-language `mcd1.md`, its plan, its manifest and its evaluator), as
walkthrough Part A5 and standard §11.1 provide for. `concept/` is therefore not created (git cannot hold an
empty folder).

Written in task P2 on 1 October 2026 and **confirmed by Davin on 1 October 2026**. The Thai text of the old specification is translated here (decision D4:
every file is in English). Every rule is marked **Spec** (stated in the old `mcd1.md`), **Plan** (stated in the
old implementation plan only), **ADR** (a settled decision) or **Code** (done by the certified evaluator but not
written in the old spec). Davin reviews this readback together with `mcd1.md` and the plan.

## 1. Core principle

> Right now, what is the primary trend of XAUUSD on M15, and how is price behaving over the short term (the micro
> regime): in line with the primary structure, or against it?

MCD1 answers with a **dual-horizon** reading. The macro level is the structure of the active M15 EDT channel: its
length (the EDT time horizon, T_EDT), how well it contains price (containment rate, at least 50%) and its slope
(regression angle). The micro level is what the last closed bars did against that channel, over a window of at
least 5.0% of T_EDT and never fewer than 96 bars (24 hours, one full trading day of M15), so that a spike from
2 to 3 hours of news does not pass for a breakout.

## 2. Timeframes and candidate indicators

- Timeframe: **M15** only.
- Candidate indicators, any one of them active, chosen by the setting (Spec): the seven centroid variants
  `best_fit_a`, `best_fit_b`, `cherry_a`, `cherry_b`, `most_recent`, `non_a`, `non_b`. The certified example uses
  `non_b`.
- Never candidates for MCD1 (Spec): the fractal EDT (an M5 indicator), `resistance`, `support` and `sr_levels`
  (single lines and horizontal levels).
- The administrator may switch on only one centroid indicator on M15 at a time (the single-active-indicator rule).
  In this retrofit the setting names it (rule 6, ADR-010) and data detection only cross-checks it (decision D3).

## 3. Rules

| #   | Rule                                                                                                                                                                                                                                                                                          | Source              |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| R1  | Exactly one centroid indicator is active on M15. More than one, or none, is a failure.                                                                                                                                                                                                        | Spec                |
| R2  | The macro level reads the statistics row of the active indicator: T_EDT (`containment_n`, else `visual_window_bars`), containment rate, regression angle θ.                                                                                                                                   | Spec                |
| R3  | The channel must be intact: containment rate ≥ 50%. Below 50% the corridor is compromised and no trend is declared.                                                                                                                                                                           | Spec                |
| R4  | Macro trend: UP when θ > +5°, DOWN when θ < −5°, SIDEWAYS when −5° ≤ θ ≤ +5° (both ends inclusive).                                                                                                                                                                                           | Spec                |
| R5  | Micro window: N_micro = max(96, round(5% × T_EDT)) bars, ending at the newest bar. Example: T_EDT 1,808 gives round(90.4) = 90, so N_micro = 96.                                                                                                                                              | Spec                |
| R6  | Channel position of a bar: CP = (Close − LOEDT) ÷ (UOEDT − LOEDT). CP above 1 is above the corridor, below 0 is below it, between 0 and 1 inclusive is inside.                                                                                                                                | Spec                |
| R7  | **Same-slope breakout fires on the latest bar:** UP trend and the latest bar above UOEDT is `UPPER_BREAKOUT`; DOWN trend and the latest bar below LOEDT is `LOWER_BREAKDOWN`. No sustained share of the window is needed.                                                                     | ADR-023, Plan, Code |
| R8  | **Counter-trend and sideways breakouts need a sustained break:** the latest bar is outside the corridor on that side **and** at least 80.0% of the N_micro bars (for example 77 of 96) are outside on that side. UP trend: `LOWER_BREAKDOWN`. DOWN trend: `UPPER_BREAKOUT`. SIDEWAYS: either. | Spec, Plan, Code    |
| R9  | Everything else is `IN_CORRIDOR`: the latest bar is inside the corridor, or it is outside on the counter side without a sustained break (a false breakout is filtered out).                                                                                                                   | Spec, Code          |
| R10 | Trend (3) × micro regime (3) gives nine combinations, each with a regime word (see §4).                                                                                                                                                                                                       | Spec                |
| R11 | The channel must have a sane shape: UOEDT > LOEDT on every bar of the window.                                                                                                                                                                                                                 | Spec                |
| R12 | The bars of the window must be continuous: timestamps ascending, and `close`, SSA, UOEDT and LOEDT present on every bar.                                                                                                                                                                      | Spec                |

Rules R7 and R8 replace the old spec §4B, which said every breakout needs the 80% share. The certified code, the
plan, the manifest and test 13 always fired the same-slope breakout on the latest bar, and ADR-023 (Settled,
29 September 2026) keeps that behaviour and corrects the spec.

## 4. States

The nine combinations below are the old decision matrix. Their state codes are new (the old MCD1 had none); the
regime words are unchanged. Bias is decision D6 (Davin's) and is proposed in `mcd1.md` §7 and §14.

| State                           | When                                                                         | What it means (plain)                                        | Regime word                  | Example time                           |
| ------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------ | ---------------------------- | -------------------------------------- |
| `MCD1_UP_IN_CORRIDOR`           | Slope up; latest bar inside, or below LOEDT without a sustained break        | Price moves normally in an up-sloping channel                | `TREND_ALIGNED_CONTINUATION` | None on the replicas (synthetic)       |
| `MCD1_UP_UPPER_BREAKOUT`        | Slope up; latest bar above UOEDT                                             | Price is above the upper band, in the direction of the slope | `BREAKOUT_SAME_SLOPE`        | None on the replicas (synthetic)       |
| `MCD1_UP_LOWER_BREAKDOWN`       | Slope up; latest bar below LOEDT and at least 80% of the window below it     | Sustained trading below the lower band, against the slope    | `COUNTER_TREND_EXPANSION`    | None on the replicas (synthetic)       |
| `MCD1_DOWN_IN_CORRIDOR`         | Slope down; latest bar inside, or above UOEDT without a sustained break      | Price moves normally in a down-sloping channel               | `TREND_ALIGNED_CONTINUATION` | v4 slot, `non_b`                       |
| `MCD1_DOWN_LOWER_BREAKDOWN`     | Slope down; latest bar below LOEDT                                           | Price is below the lower band, in the direction of the slope | `BREAKOUT_SAME_SLOPE`        | None on the replicas (synthetic)       |
| `MCD1_DOWN_UPPER_BREAKOUT`      | Slope down; latest bar above UOEDT and at least 80% of the window above it   | Sustained trading above the upper band, against the slope    | `COUNTER_TREND_EXPANSION`    | v1 slot, `non_b` (the certified cycle) |
| `MCD1_SIDEWAYS_IN_CORRIDOR`     | Flat channel; latest bar inside, or outside without a sustained break        | Price moves sideways in a flat channel                       | `CONSOLIDATION`              | None on the replicas (synthetic)       |
| `MCD1_SIDEWAYS_UPPER_BREAKOUT`  | Flat channel; latest bar above UOEDT and at least 80% of the window above it | Sustained trading above the upper band of a flat channel     | `RANGE_EXPANSION`            | None on the replicas (synthetic)       |
| `MCD1_SIDEWAYS_LOWER_BREAKDOWN` | Flat channel; latest bar below LOEDT and at least 80% of the window below it | Sustained trading below the lower band of a flat channel     | `RANGE_EXPANSION`            | v4 slot, `non_a`                       |

## 5. No answer when

The old spec called every failure `UNIDENTIFIED` (and the regime `UNCERTAIN`). Under the standard a failure is a
status with a reason code, never a state: no setting, no statistics row at the slot, containment below 50%, too
few or broken bars, or an impossible channel each end the reading as INVALID or STALE (standard §6).

## 6. Example times and test slots

| Slot                                             | Setting (M15) | Closed-bar reading                                         |
| ------------------------------------------------ | ------------- | ---------------------------------------------------------- |
| v1 · `2026-09-18T20:55Z` (last closed bar 20:30) | `non_b`       | `MCD1_DOWN_UPPER_BREAKOUT`: the certified cycle            |
| v4 · `2026-09-28T23:15Z` (last closed bar 23:00) | `non_b`       | `MCD1_DOWN_IN_CORRIDOR`; `non_a` is also populated         |
| v4 · `2026-09-28T23:15Z`                         | `non_a`       | `MCD1_SIDEWAYS_LOWER_BREAKDOWN`; `non_b` is also populated |

The certified output (`legacy/mcd1_output.json`) was produced on the still-open 20:45 bar; the closed-bar rule
(rule 2) moves its numbers slightly and keeps its state (implementation plan §5). A replica holds statistics for
its export slot only, so the six other states are tested with synthetic bundles.

## 7. Data used

Each column was checked in the M15 sheet of both replica workbooks (v1 and v4) and each statistics field in
`prisma/market-data/schema.prisma`.

| Data                                                                                                 | Where                                                 | Exists |
| ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ------ |
| `timestamp`, `close`                                                                                 | `market_data_v6` (M15)                                | yes    |
| `{ind}_ssa`, `{ind}_uoedt`, `{ind}_loedt`, `{ind}_base_fl` for the seven centroid candidates         | `market_data_v6` (M15)                                | yes    |
| `regression_angle`, `containment_rate`, `containment_n` (else `visual_window_bars`), `channel_width` | `indicator_statistics`, source = the active indicator | yes    |

7b. Levels contributed: **UOEDT, baseline and LOEDT on M15**, from the last closed M15 bar. The old MCD1 gave
UOEDT and LOEDT only; the baseline is added as standard §8 and architecture §2.5 require. Zones use 10% of the
active M15 channel's width (standard §8, ADR-031).

## 8. Wording the standard will change

| Pre-retrofit wording                                                                                  | New                                                                                                |
| ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| "massive pump / massive dump with high probability of soon V-shape price reversal"                    | No probability (R9). Location and counts only                                                      |
| "high probability of structural trend reversal", "high likelihood of structural trend reversal"       | Removed. The regime word `COUNTER_TREND_EXPANSION` stays; its meaning is stated without a forecast |
| "explosive buying climax", "massive sell-off panic dump", "aggressive counter-trend selling pressure" | Removed. Neutral description of where the latest bar closed                                        |
| "healthy trend continuation", "confirming healthy / steady trend continuation"                        | Removed. The state says where price is, not whether the trend is healthy                           |
| "96/96 bars = 100.0% >= 80.0% threshold" (percentages in commentary)                                  | Counts: "96 of the last 96 closed bars closed above UOEDT"                                         |
| `channel_position=1.6447 > 1.0` style fragments                                                       | "channel position 1.6622" in a sentence                                                            |
| Failure as `trend_state = UNIDENTIFIED`, `regime_status = UNCERTAIN`                                  | Status INVALID or STALE with a reason code                                                         |

## 9. Overlap with existing MCDs

- **MCD2** reads the M5 trend and can use the fractal EDT; MCD1 reads the M15 trend and cannot. Same channel
  family, different timeframe, no shared state. MCD1's metric is the Close; MCD2's is the SSA (or the Close for
  the fractal).
- **MCD3** (derived) will read MCD1's `details.trend_direction` instead of recomputing the ±5° band.
- **MCD0** (gate) will mark MCD1 CAUTIONARY when the M15 channel fit fails its quality criteria
  (`uses_channel: [M15]`).

## 10. Questions for Davin

### 10a. Where the old spec, plan and code disagree with each other

MCD1 has no board, so the comparison is between the old specification, the old plan and the certified code.

| #   | Old spec or plan says                                                          | Certified code does                                                                                      | Proposal in this retrofit                                                                                                  |
| --- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| 1   | Spec §4B: every breakout needs at least 80% of the window outside the corridor | Same-slope breakout fires on the latest bar; only counter-trend and sideways need 80%                    | Code is right (ADR-023, Settled). The new spec states R7 and R8 as above. Listed for the record                            |
| 2   | Spec §3 tier 1: scan the data; zero or more than one active indicator fails    | Detects populated indicators; two populated (v4) fails with `UNIDENTIFIED`                               | The setting names the indicator (rule 6, D3). Others populated beside it go to `details.populated_candidates`              |
| 3   | Spec §3 tier 4 and plan §2.3: the statistics row with the latest `captured_at` | Same (`ORDER BY captured_at DESC LIMIT 1`)                                                               | The row captured at the slot (rule 5); none gives STALE. Settled by the standard                                           |
| 4   | Spec §3 tier 4: containment below 50% fails the run                            | The run still reports `PASS`, with macro trend `UNIDENTIFIED` and a warning; a missing rate is tolerated | INVALID + `CONTAINMENT_LOW`; a missing or non-numeric rate is INVALID + `SANITY_FAILED`                                    |
| 5   | Spec §3 tier 2: timestamps ascending                                           | A non-ascending timestamp is a warning only                                                              | INVALID + `DISCONTINUITY` (walkthrough C2)                                                                                 |
| 6   | Plan §2.3: θ is in [−90°, +90°]                                                | No check                                                                                                 | A tier-3 check, as in MCD2 (spec §14, Q5)                                                                                  |
| 7   | Spec §4B: inside is 0 ≤ CP ≤ 1                                                 | The latest-bar test uses CP already rounded to 4 decimals; the counts use prices                         | Decide on prices and counts; CP is rounded at output only (standard §11.2)                                                 |
| 8   | Spec §5: the worked example is the 18 September cycle                          | Reads the still-open 20:45 bar as the latest bar                                                         | The last **closed** bar (rule 2). The state is unchanged; CP moves from 1.6447 to 1.6622                                   |
| 9   | Spec is silent when `containment_n` and `visual_window_bars` are both null     | Uses T_EDT = 96, so N_micro = 96, with a warning                                                         | Carried over (spec §14, Q2)                                                                                                |
| 10  | Spec §1: the window ends at the latest bar                                     | Ends at the last row where the active indicator has a value, not at the last row of the sheet            | Ends at the last closed bar. If the set indicator is empty there, tier 1 reports the mismatch and tier 2 stops the reading |

### 10b. Open

Everything that needs an answer before the specification is final is in `mcd1.md` section 14 (decision D6 and
questions Q1 to Q7) and in the decisions list of the implementation plan.
