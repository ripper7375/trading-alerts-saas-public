# MCD3 implementation plan: retrofit to evaluator 2.0.0

Status: Approved (Davin, 1 October 2026, together with `mcd3.md`; D10 option A, D6 and D7 as proposed, Q1 to Q9 as recommended) · Built in task P3 on 1 October 2026 (§9) · Independent check (task P6) done and stage 3 signed off by Davin, 1 October 2026 · Follows: [standard](../../../docs/MCD-DEVELOPMENT-STANDARD.md),
[walkthrough Part C0 and C3](../../../docs/MCD-RETROFIT-AND-CREATION-WALKTHROUGH.md)

This plan is steps R1 to R4. It lists each change, the tests that prove it, the fixtures, and the expected
difference from the pre-retrofit evaluator. Nothing in P2 touched the evaluator, the tests or the manifest at
the top of the folder; the pre-retrofit plan that stood here is kept in git history and its content lives on in
`legacy/` and `mcd3.md`.

## 1. What changes from the pre-retrofit MCD3

| #   | Area                 | Pre-retrofit (`legacy/`)                                                                                                                | Retrofit 2.0.0                                                                                                                                          |
| --- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Input                | Reads a workbook with openpyxl, both sheets, still-open bars included                                                                   | `evaluate(inputs, params, upstream)` on a `CycleInputs`; closed bars only through `closed_bars`                                                         |
| 2   | Dependencies         | None; recomputes everything                                                                                                             | `depends_on: [MCD1, MCD2]`; reads their same-cycle envelopes; `UPSTREAM_*` reasons (ADR-021)                                                            |
| 3   | Trend words          | Recomputes ±5° from `regression_angle` of the two statistics rows                                                                       | `details.trend_direction` of MCD1 (M15) and MCD2 (M5); angles for the commentary come from their `details`                                              |
| 4   | Active indicator     | Detects populated candidates; zero or more than one means INVALID (overrides in the constructor)                                        | The setting per timeframe; others populated beside it go to `details.populated_candidates`; no override in the evaluator (D3)                           |
| 5   | Statistics rows      | First row matching symbol, timeframe and source                                                                                         | The row at `stats_slot[tf]` for the active source on each timeframe; none gives STALE + `NO_STATS_AT_SLOT`                                              |
| 6   | Containment          | ≥ 50% on both timeframes; a missing rate is INVALID                                                                                     | Tier 4, both timeframes: below 50% INVALID + `CONTAINMENT_LOW`; missing or not a number INVALID + `SANITY_FAILED`                                       |
| 7   | Pre-flight order     | Tier 1, tier 4, tiers 2 and 3 together; any failure raises and is caught into `MCD3_INVALID`                                            | Cycle, tier 1, tier 4, tier 2, tier 3, upstream, through `run_preflight`; failures are statuses with reason codes                                       |
| 8   | Tier 2               | Skips rows with a null value; non-ascending time is an error; floors 96 (M15) and 48 (M5) valid bars; M15 to M5 time-overlap check      | `N_nest` closed M5 bars ascending and numeric (`DISCONTINUITY`, `INSUFFICIENT_BARS`); M5 floor 48 kept; the 96 floor and the overlap check dropped (Q4) |
| 9   | Tier 3               | UOEDT > LOEDT on every populated bar of both buffers                                                                                    | UOEDT > LOEDT on every window M5 bar, every used M15 bar, both last bars; channel width > 0 (Q3)                                                        |
| 10  | Nesting window       | The last `min(containment_n, populated rows)` rows, still-open bar included; silent defaults 755 and 1808 when the field is missing     | `N_nest = T_EDT − 1` closed M5 bars (spec §3, Q1); a missing `T_EDT` is INVALID + `SANITY_FAILED` (Q2)                                                  |
| 11  | M15 bar of an M5 bar | Backward as-of match on the populated M15 rows; unmatched bars count as not nested                                                      | Backward as-of match on the closed M15 bars; a bar whose M15 bar has no band counts as not nested; a missing M15 bar is INVALID (Q3)                    |
| 12  | Condition 2 test     | Percentage as a float, `>= 75.0`                                                                                                        | Exact integer test `nested × 100 ≥ 75 × N_nest`                                                                                                         |
| 13  | Condition 3          | The last row of each sheet (the still-open bars), by row                                                                                | The last closed M5 bar against the last closed M15 bar (its as-of match)                                                                                |
| 14  | Stochastic           | `(SSA − LOEDT) ÷ (UOEDT − LOEDT) × 100`, rounded to 2 decimals, zones decided on the rounded value, `50.0` if the width is not positive | Number per decision D10; zones decided on the unrounded position; the zero-width fallback is unreachable (tier 3) and removed; never clipped (Q6)       |
| 15  | State codes          | Ten plus `MCD3_INVALID` and `MCD3_UNKNOWN`                                                                                              | Ten codes; failure is a status (INVALID or STALE) with a reason code, no state                                                                          |
| 16  | Bias                 | `tactical_bias` strings (`HIGH_CONVICTION_BUY_DIP`, `CAUTION_TAKE_PROFIT_SELL`, …)                                                      | `bias` per state, decision D6 (mapping in §6)                                                                                                           |
| 17  | Wording              | "Prime Buy Dip Opportunity", "Hold long positions", "strongly confirmed", percentages                                                   | Ten templates T01 to T10 (counts, prices, angles, the stochastic number), summary lines S01 to S10 (≤ 80 characters, no prices)                         |
| 18  | Output               | Own shape (11 keys, `evaluator_version` 1.0.0, a wall-clock `timestamp` in the INVALID payload)                                         | Envelope `mcd-output/1`; `details` per spec §11; six levels (D7); no wall-clock time                                                                    |
| 19  | Constants            | In the evaluator, with the v1 values as hidden defaults                                                                                 | In `mcd3_params.yaml` (seven parameters)                                                                                                                |
| 20  | Specification        | English; header says "Certified"; stochastic orientation differs from the board                                                         | `mcd3.md` rewritten into the 14 sections; status Draft until approved                                                                                   |

Unchanged: the two candidate lists, the 75% share, the 20 / 80 zones, the as-of match of an M5 bar to an M15
bar, edges counted as inside, the three conditions and the order in which the failure states are chosen, the ten
states and their regime words, the 50% containment floor, the M5 floor of 48 bars.

## 2. Decisions

| Item     | Status                                                                                                                                                                           |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D3       | Settled 30 September 2026 (tier-1 meaning), built into the kit                                                                                                                   |
| D4       | English for every specification: settled by walkthrough A1; `mcd3.md` and `concept.md` are English                                                                               |
| D10      | **Settled (Davin, 1 October 2026): option A**, 0 at LOEDT and 100 at UOEDT, the pre-retrofit formula                                                                             |
| D6       | **Settled (Davin, 1 October 2026)**: the walkthrough C3 starting points, as in the registry                                                                                      |
| D7       | **Settled (Davin, 1 October 2026)**: six levels; the zone builder must count a duplicate price once (spec §8)                                                                    |
| Q1 to Q9 | **Settled (Davin, 1 October 2026): approved as recommended**, including Q1 (window `T_EDT − 1`), Q7 (`<slot>.upstream.json` and the replica v3 slot) and Q9 (architecture edits) |

## 3. Tests (T1 to T14)

Written in `test_mcd3_unit_tests.py`, from synthetic bundles (small, in memory) and the stored fixtures. Upstream
envelopes for synthetic bundles are built with the kit's `envelope.valid` (and its status variants), not by running
MCD1 and MCD2, so each test controls exactly what it feeds.

| #   | Test                            | What it proves in MCD3                                                                                                                                                                                                                                                                                           |
| --- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T1  | One test per state (ten)        | Every state in the register is reachable; the register equals `mcd3_registry.yaml` (codes, regime words, bias, summaries, templates)                                                                                                                                                                             |
| T2  | Boundary tests                  | Nesting 74 / 75 / 76 of 100 and 565 / 566 of 754; position 19.99 / 20 / 20.01 and 79.99 / 80 / 80.01; edges equal to and a hair beyond the M15 edges (latest bar and a window bar); containment 49.99 / 50 / 50.01 on each timeframe; `T_EDT` 48 / 49 / 50; a window equal to and one above the closed bars held |
| T3  | One test per pre-flight failure | Each check of spec §5 gives its status and reason code, for each timeframe or upstream id where it applies, and the check order holds                                                                                                                                                                            |
| T4  | Forming bar                     | An open bar appended on M5, on M15 and on both changes nothing (shared check)                                                                                                                                                                                                                                    |
| T5  | Wrong-slot statistics           | A row from another slot on either timeframe gives STALE (shared check)                                                                                                                                                                                                                                           |
| T6  | Setting                         | No setting on either timeframe is INVALID; a detection mismatch is CAUTIONARY; two populated candidates stay VALID (D3) (shared check plus own)                                                                                                                                                                  |
| T7  | Determinism                     | Two runs and a rebuilt bundle give byte-identical JSON (shared check)                                                                                                                                                                                                                                            |
| T8  | Schema                          | Output validates against `mcd-output/1` (shared check, on every state and every status)                                                                                                                                                                                                                          |
| T9  | Replay                          | Each stored `<slot>.inputs.json` with its `<slot>.upstream.json` reproduces its `<slot>.envelope.json` byte for byte (own loop; the kit's `check_replay` takes one upstream for all slots)                                                                                                                       |
| T10 | Never throws                    | Corrupted bundles and corrupted upstream envelopes give INVALID or STALE with Appendix D codes (shared check plus own)                                                                                                                                                                                           |
| T11 | Wording                         | Codes, regime words, templates, rendered texts and summaries are clean (shared check)                                                                                                                                                                                                                            |
| T12 | Size                            | The plain real envelopes (515, 550 and 587 tokens) and the synthetic ones stay within 600; one evaluation within 1 s. The real CAUTIONARY variants (607 and 611) and the worst case with live candidates (656) stay within the ceiling of 670 that Davin approved (manifest A22; §9)                             |
| T13 | Real data                       | The v1 and v4 cycles (and v3 if Q7) from the stored fixtures give the expected state (§5); a scan over the other pairings when the workbooks are present                                                                                                                                                         |
| T14 | Derived only                    | Changing MCD1's trend, then MCD2's, in the upstream reading changes MCD3's state in the same cycle; the stored upstream equals what the committed MCD1 and MCD2 evaluators give on the same cycle                                                                                                                |

Mapping of the 13 pre-retrofit tests (each stays as a case, re-expressed as a bundle):

| Legacy test                                                 | New case                                                                                                                                         |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 01 real data, non-consolidated (v1)                         | T13 on v1, and the T1 case for `MCD3_NON_CONSOLIDATED_TREND_CONFLICT`                                                                            |
| 02 to 08 the seven consolidated states                      | T1, seven cases (the same positions 10, 50, 90 and the same angles, the corridor 4300 to 4400)                                                   |
| 09 condition 1 fails                                        | T1 conflict and T2                                                                                                                               |
| 10 condition 2 fails (50% nested)                           | T1 overflow and T2 boundaries                                                                                                                    |
| 11 condition 3 fails (latest M5 upper edge 4410 above 4400) | T1 escape and T2 boundaries                                                                                                                      |
| 12 tier 1: several indicators, none                         | T6: no setting is INVALID + `NO_SETTING`; **several populated candidates are now VALID** (a documented change, D3), real v1 and v4 are the proof |
| 13 tier 3 inverted channel, tier 4 low containment          | T3: `SANITY_FAILED` and `CONTAINMENT_LOW` (and the other checks)                                                                                 |

The legacy synthetic builder (constant channels, 100 M15 and 300 M5 bars) becomes a bundle builder whose M5 channel
exists on `T_EDT − 1` closed bars, so the synthetic cases obey the same rule as the real data.

## 4. Files P3 will create or change (in `engine-1-5-new/mcd3/` unless stated)

| Path                                                                       | Purpose                                                                                                                                                                |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mcd3_evaluator.py` (rewritten)                                            | The evaluator on the kit: standard library, the kit and pure maths only; tier helpers on top of the kit (as MCD2); `never_throws`; the upstream consistency check (Q5) |
| `test_mcd3_unit_tests.py` (rewritten)                                      | T1 to T14 and the 13 legacy cases                                                                                                                                      |
| `fixtures/` (new)                                                          | Per slot `<slot>.inputs.json`, `<slot>.upstream.json` (Q7), `<slot>.envelope.json`, `<slot>.source.md`; v1 and v4, and v3 if Q7                                        |
| `mcd3_output.json` (rewritten)                                             | The v1 envelope                                                                                                                                                        |
| `mcd3-manifest-work-completion.md` (rewritten)                             | Appendix A with evidence, the baseline and equivalence tables (§6), the real envelopes, decisions with dates                                                           |
| `mcd3_params.yaml`, `mcd3_registry.yaml`, `mcd3.md`, `concept.md`          | Approval lines; D6 and D10 applied; any answer to Q1 to Q9 written in                                                                                                  |
| `docs/STACK-D-ARCHITECTURE.md` §2.13 and §2.5                              | Q9: MCD3 version 2.0.0 and Levels per D7; `MCD3_INVALID` removed from the states; the window as `T_EDT − 1` closed M5 bars (docs only)                                 |
| `docs/MCD-DEVELOPMENT-STANDARD.md` §11.1 and walkthrough B3 rule 2 (if Q7) | PATCH 1.0.4: a derived MCD's fixtures also hold `<slot>.upstream.json`                                                                                                 |
| `mcd_common/fixtures/settings_v3.yaml` (if Q7)                             | Data only: M15 `non_b`, M5 `cherry_a` for replica v3                                                                                                                   |
| `docs/handoffs/`, `.claude/state/`                                         | Hand-off and state files                                                                                                                                               |

Not touched: the kit's code, MCD1, MCD2, `seed-code/`, any app code. `.prettierignore` already excludes
`mcd*/fixtures/*.json` and `mcd*/mcd*_output.json`, so the hook leaves the canonical JSON alone.

## 5. Fixtures and expected readings

Expected states come from a scratch run of the rules in `mcd3.md` §6 on the kit's closed-bar view, with the upstream
readings from the committed MCD1 and MCD2 evaluators (task P2; not a test, the P3 tests will prove them).

| Fixture slot                        | Setting (M15 + M5)     | MCD1 / MCD2 trend (angle)       | `N_nest`, nested (share) | C1 / C2 / C3 | Expected MCD3 state                                    |
| ----------------------------------- | ---------------------- | ------------------------------- | ------------------------ | ------------ | ------------------------------------------------------ |
| v1 `2026-09-18T20:55Z`              | `non_b` + `best_fit_a` | DOWN (−29.72°) / UP (+6.94°)    | 754, 0 (0.00)            | F / F / F    | `MCD3_NON_CONSOLIDATED_TREND_CONFLICT`                 |
| v4 `2026-09-28T23:15Z`              | `non_b` + `cherry_a`   | DOWN (−20.98°) / DOWN (−20.94°) | 1133, 483 (42.63)        | T / F / F    | `MCD3_NON_CONSOLIDATED_OVERFLOW`                       |
| v3 `2026-09-28T14:15Z` (only if Q7) | `non_b` + `cherry_a`   | DOWN (−15.61°) / DOWN (−11.01°) | 1037, 973 (93.83)        | T / T / T    | `MCD3_BEAR_BOTTOM`, stochastic −1.02 (A) or 101.02 (B) |

All other real pairings in the five replica batches, closed-bar view against the pre-retrofit run (every state is
unchanged; the nesting denominator drops by one because the open bar is excluded):

| Workbook | M15 + M5             | MCD1 / MCD2 trend | New: nested of `N_nest` (share) | C1 / C2 / C3 | State              | Pre-retrofit: nested of total (share), state       |
| -------- | -------------------- | ----------------- | ------------------------------- | ------------ | ------------------ | -------------------------------------------------- |
| v1       | `non_b` + `fractal`  | DOWN / UP         | 0 of 335 (0.00)                 | F / F / F    | TREND_CONFLICT     | 0 of 336, TREND_CONFLICT                           |
| v4       | `non_b` + `fractal`  | DOWN / DOWN       | 283 of 409 (69.19)              | T / F / F    | OVERFLOW           | 283 of 410 (69.02), OVERFLOW                       |
| v4       | `non_a` + `cherry_a` | SIDEWAYS / DOWN   | 77 of 1133 (6.80)               | F / F / F    | TREND_CONFLICT     | 77 of 1134 (6.79), TREND_CONFLICT                  |
| v4       | `non_a` + `fractal`  | SIDEWAYS / DOWN   | 68 of 409 (16.63)               | F / F / F    | TREND_CONFLICT     | 68 of 410 (16.59), TREND_CONFLICT                  |
| v2       | `non_b` + `cherry_a` | DOWN / DOWN       | 811 of 1689 (48.02)             | T / F / F    | OVERFLOW           | 811 of 1690 (47.99), OVERFLOW                      |
| v2       | `non_b` + `fractal`  | DOWN / UP         | 328 of 422 (77.73)              | F / T / F    | TREND_CONFLICT     | 328 of 423 (77.54), TREND_CONFLICT                 |
| v3       | `non_b` + `cherry_a` | DOWN / DOWN       | 973 of 1037 (93.83)             | T / T / T    | **BEAR_BOTTOM**    | 974 of 1038 (93.83), BEAR_BOTTOM, stochastic −2.74 |
| v3       | `non_b` + `fractal`  | DOWN / DOWN       | 228 of 313 (72.84)              | T / F / F    | OVERFLOW (near 75) | 228 of 314 (72.61), OVERFLOW                       |
| v3       | `non_a` + `cherry_a` | DOWN / DOWN       | 0 of 1037 (0.00)                | T / F / F    | OVERFLOW           | 0 of 1038, OVERFLOW                                |
| v3       | `non_a` + `fractal`  | DOWN / DOWN       | 30 of 313 (9.58)                | T / F / F    | OVERFLOW           | 30 of 314 (9.55), OVERFLOW                         |

What the replicas do not give: **no real example of `MCD3_NON_CONSOLIDATED_ESCAPE`** (conditions 1 and 2 true, 3
false) and none of the six other consolidated states. The seven consolidated states other than `MCD3_BEAR_BOTTOM`
and the escape state are tested with synthetic bundles. v2 `non_b` + `fractal` shows condition 2 true with
condition 1 false: the state follows the first failed condition (1).

## 6. Legacy baseline (step R1) and the expected legacy → new mapping

**R1 done.** `legacy/` holds byte-identical copies of the evaluator and `mcd3_output.json` (SHA-256 checked) and the
tests with one line edited (the workbook path gets one more `..`). The 13 legacy tests pass from `legacy/`. The
board image was moved into `concept/` (it was already renamed in the working tree; the content is byte-identical to the
committed `xauusd-m5-and-m15.png`, so git records a rename). `legacy/mcd3_evaluator.py` was **not** run as a script
(it writes `mcd3_output.json` next to itself); only its class and the tests were used.

Legacy results (override = the constructor's target indicator; the legacy code has no setting):

| Workbook | Override (M15 / M5)    | Legacy result                                                                                                                                                                  |
| -------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| v1       | none                   | `MCD3_INVALID`: tier 1, M5 has two populated candidates (`best_fit_a`, `fractal`)                                                                                              |
| v1       | M5 `best_fit_a`        | TREND_CONFLICT: M15 `non_b` −29.72° DOWN (containment 73.95, horizon 1808), M5 `best_fit_a` +6.94° UP (55.76, 755), nesting 0 of 755, condition 3 false (the certified output) |
| v1       | `non_b` / `best_fit_a` | The same                                                                                                                                                                       |
| v1       | `non_b` / `fractal`    | TREND_CONFLICT: M5 `fractal` +10.61° UP (64.88), horizon 336, nesting 0 of 336                                                                                                 |
| v1       | `non_b` / none         | `MCD3_INVALID` (M5 two candidates)                                                                                                                                             |
| v1       | `non_a` / `best_fit_a` | `MCD3_INVALID`: `non_a` has no data on v1                                                                                                                                      |
| v4       | none, or M5 only       | `MCD3_INVALID`: tier 1, M15 has two populated candidates (`non_a`, `non_b`)                                                                                                    |
| v4       | `non_b` / `cherry_a`   | OVERFLOW: M15 −20.98° DOWN (93.17, horizon 2035), M5 −20.94° DOWN (100.0, 1134), nesting 483 of 1134 (42.59), condition 3 false                                                |
| v4       | `non_a` / `cherry_a`   | TREND_CONFLICT: M15 `non_a` −0.56° SIDEWAYS (91.01, 968), nesting 77 of 1134 (6.79)                                                                                            |
| v4       | `non_b` / `fractal`    | OVERFLOW: M5 `fractal` −49.89° DOWN (99.51, 410), nesting 283 of 410 (69.02)                                                                                                   |
| v4       | `non_a` / `fractal`    | TREND_CONFLICT: 68 of 410 (16.59)                                                                                                                                              |

The §7 sample output of the pre-retrofit plan (nesting 20.53%, 155 of 755, M15 horizon 336) matches no real run and is
not carried over (`concept.md` §10a, row 9).

Expected legacy → new mapping:

| Legacy `discrete_state_code`, `tactical_bias`              | New state, bias (D6 proposal)                   | Note                                                                       |
| ---------------------------------------------------------- | ----------------------------------------------- | -------------------------------------------------------------------------- |
| `MCD3_BULL_VALUE`, `HIGH_CONVICTION_BUY_DIP`               | `MCD3_BULL_VALUE`, LONG                         | The code is kept; the pre-retrofit words are gone                          |
| `MCD3_BULL_MID`, `HOLD_BULLISH_TREND_RUNNER`               | `MCD3_BULL_MID`, LONG                           |                                                                            |
| `MCD3_BULL_TOP`, `CAUTION_TAKE_PROFIT_BUY`                 | `MCD3_BULL_TOP`, NEUTRAL                        |                                                                            |
| `MCD3_BEAR_PREMIUM`, `HIGH_CONVICTION_SELL_RALLY`          | `MCD3_BEAR_PREMIUM`, SHORT                      |                                                                            |
| `MCD3_BEAR_MID`, `HOLD_BEARISH_TREND_RUNNER`               | `MCD3_BEAR_MID`, SHORT                          |                                                                            |
| `MCD3_BEAR_BOTTOM`, `CAUTION_TAKE_PROFIT_SELL`             | `MCD3_BEAR_BOTTOM`, NEUTRAL                     |                                                                            |
| `MCD3_SIDEWAYS_EQUILIBRIUM`, `RANGE_BOUND_MEAN_REVERSION`  | `MCD3_SIDEWAYS_EQUILIBRIUM`, NEUTRAL            |                                                                            |
| The three `MCD3_NON_CONSOLIDATED_*`, `NEUTRAL_STAND_ASIDE` | Same three codes, STAND_ASIDE                   |                                                                            |
| `MCD3_INVALID` (any pre-flight failure)                    | No state: status INVALID or STALE + reason code | Missing statistics row: INVALID before, **STALE** + `NO_STATS_AT_SLOT` now |
| `MCD3_UNKNOWN`                                             | Unreachable: removed                            | It was only the initial value of a variable                                |

Intended differences from the pre-retrofit run, all expected and none a surprise to P3:

1. The nesting denominator drops by one (the open bar is excluded): 0 of 755 becomes 0 of 754.
2. The M15 SSA is the last closed bar's, not the open bar's: v3 `MCD3_BEAR_BOTTOM` goes from −2.74 to −1.02, the same state.
3. Two populated candidates on one timeframe no longer end the reading (D3): v1 without an override and v4 without an override are now VALID readings.
4. The zone is decided on the unrounded position; it differs from the pre-retrofit rounded test only when the position is within 0.005 of 20 or 80.
5. A missing statistics row is STALE, not INVALID; low containment, inverted channels and so on keep INVALID with their reason codes.
6. Everything about wording, bias, output shape and levels (§1).

P3 must report any state that differs from legacy and is not in this section.

## 7. Records and follow-ups

- **If Q7 is approved:** standard PATCH 1.0.4 (`<slot>.upstream.json` for derived MCDs) and one sentence in walkthrough B3
  rule 2; `mcd_common/fixtures/settings_v3.yaml`; replica v3 must be tracked in git (Davin commits the workbook) before
  the fixture's `source.md` can point to it.
- **Architecture §2.13 and §2.5** (Q9): MCD3 version 2.0.0 (status stays `Retrofit`), Levels per D7, `MCD3_INVALID`
  out of the states, the window as `T_EDT − 1` closed M5 bars. The §3.7 worked example still shows the level
  prices of the still-open bar (4384.28 and so on); MCD1's and MCD2's retrofits did not change it and P3 will not.
- **`.claude/state/waiting-on.md`** (written in P2): new evidence for the open "fit window includes the open bar" item
  (band columns on exactly `T_EDT` rows ending at the forming bar, seven of seven channels), and a new item: the
  committed MCD2 ends INVALID + `DISCONTINUITY` on an M5 channel with `T_EDT` ≤ 288, and MCD1 on an M15 channel with
  `T_EDT` ≤ 96 (simulated on v1; no replica has such a channel). Not fixed here: a change to MCD2 or MCD1 is task P7.
- **Duplicate levels** (decision D7): the zone builder (build step 4) must count one channel level once.
- **Kit helpers:** MCD3 adds its own tier-2 and tier-3 helpers on top of the kit (the third evaluator to do so, after
  MCD1 and MCD2). Moving the shared ones into the kit is a kit change for Davin to schedule.
- **Inherited and unverified:** the statistics' fit windows may include the still-open bar. MCD3 reads
  `containment_rate` and `T_EDT` from those rows (not the angles); settle it before certification (stage 5).

## 8. P3 is done when

1. Davin has approved `mcd3.md` and this plan and answered D10, D6, D7 and Q1 to Q9 (or approved the recommendations).
2. `python -m unittest discover -s mcd3` passes from `engine-1-5-new/`; the kit's 215 tests, MCD1's, MCD2's and the
   13 legacy tests still pass.
3. The v1 and v4 (and v3, if Q7) fixtures replay byte for byte (T9); the envelope is valid, at most 600 tokens and
   evaluates in at most 1 s (T12).
4. The equivalence table of §6 is filled with real numbers; any state that differs from legacy and is not listed is reported.
5. The manifest carries Appendix A with evidence (A18, A19, A23, A24, A25 "pending, stage 4 to 7"), the baseline and
   equivalence tables, and the decisions with dates; architecture §2.13 and §2.5 carry the version note (Q9).
6. `evaluator_version` is 2.0.0; nothing is committed or pushed unless Davin says so; a fresh P6 session checks the work.

## 9. Build result (task P3, 1 October 2026)

Built as planned. `mcd3_evaluator.py` (about 400 lines), `test_mcd3_unit_tests.py` (127 tests; the 13 legacy scenarios kept as cases), three fixture slots (v1, v4, v3) with their stored upstream
readings, `mcd3_output.json`, the manifest with Appendix A, architecture §2.5 and §2.13, standard 1.0.4 and walkthrough B3. Evidence and numbers: `mcd3-manifest-work-completion.md`.

| P3 exit condition (§8)                                                | Result                                                                                                                                                                      |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Approval and answers                                               | Done on 1 October 2026 (§2)                                                                                                                                                 |
| 2. MCD3 tests pass; kit, MCD1, MCD2 and legacy suites still pass      | 127 OK (1 opt-in skip); kit 215, MCD1 105, MCD2 93, legacy 13                                                                                                               |
| 3. Fixtures replay byte for byte; envelope valid, ≤ 600 tokens, ≤ 1 s | Replay OK (T9, three slots). Valid. Plain real envelopes 515, 550, 587 tokens; **real CAUTIONARY variants 607 and 611 (Davin approved a ceiling of 670, A22)**; 16 to 24 ms |
| 4. Equivalence table filled with real numbers                         | Manifest §4: ten synthetic scenarios equal; 12 real pairings, every state unchanged                                                                                         |
| 5. Manifest with Appendix A; architecture version note                | Done; A18, A19, A23, A24 pending (stage 4 to 7), A25 row done and the decision entry pending                                                                                |
| 6. Version 2.0.0; nothing committed; fresh P6 session                 | Done; nothing committed or pushed; P6 is the next task                                                                                                                      |

**Differences from the plan, all small.** (a) The envelope is larger than the stand-in estimate (533) because real prices and two 64-character hashes cost more tokens: 587 for the real consolidated reading.
(b) The evaluator's `evaluate` wraps the kit's `never_throws` so that an `EVALUATOR_ERROR` envelope still declares `depends_on` (the kit's wrapper declares none). (c) The tests add a clean-room
reference sweep (400 random cycles) and a scratch mutation pass (90 mutants; the gaps it found are closed). (d) Evaluation on a full 3,000-bar bundle is 68 to 95 ms (the trimmed fixtures 16 to 24 ms),
because `closed_bars` filters each timeframe several times; within budget, not optimised. **No state differs from the pre-retrofit one that is not listed in §6.**

**Task P6 and the stage-3 sign-off (1 October 2026).** A fresh session checked A1 to A26 line by line, reproduced the numbers, fuzzed the evaluator against a clean-room restatement of the spec (24,000 bundles, no difference) and ran its own mutation pass
(477 mutants). Result: A22 over 600 in the real CAUTIONARY case and, with the candidates of live data, up to 656 (Davin decided a ceiling of 670); seven test gaps, closed by seven tests (134 tests now); one wording fix in `mcd3.md`. Davin signed off stage 3.
Details: [the hand-off](../../../docs/handoffs/2026-10-01-1407-mcd3-p6.md).
