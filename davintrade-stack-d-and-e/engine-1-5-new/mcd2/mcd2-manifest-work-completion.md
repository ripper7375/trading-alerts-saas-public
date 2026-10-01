# MCD2 manifest: work completion (retrofit 2.0.0, patched to 2.0.1)

|                       |                                                                                                                                                                                                                                                            |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **MCD**               | MCD2: M5 trend and corridor deviation · independent · M5                                                                                                                                                                                                   |
| **Evaluator version** | **2.0.1** (PATCH of 2.0.0, task P7, 1 October 2026: the window counts the channel's closed bars; 2.0.0 was the MAJOR retrofit, the output shape changed from the pre-retrofit evaluator, which had no version)                                             |
| **Stage**             | 3 (build) done on 1 October 2026 by task P3, checked by task P6 and signed off by Davin the same day. Patched to 2.0.1 by task P7 on 1 October 2026 (Davin confirmed the PATCH; §9). Flag `off`. Registry status in architecture §2.13: `Retrofit (2.0.1)` |
| **Built on**          | The shared kit `mcd_common/` (Step 0, 215 tests), standard 1.0.3, walkthrough Part C0 steps R5 to R10                                                                                                                                                      |
| **Specification**     | [mcd2.md](mcd2.md) (approved by Davin, 1 October 2026) · [plan](mcd2_implementation_plan.md) · [concept](concept.md)                                                                                                                                       |
| **Next**              | Stages 4 to 7 when the sensor worker, synthesis and the knowledge build exist                                                                                                                                                                              |

## 1. What was built

`evaluate(inputs, params, upstream) -> envelope`: a pure function on the kit's frozen input bundle that answers
one question per cycle: which way the active M5 EDT channel slopes (UP, DOWN, SIDEWAYS on a ±5° band), and where
the last **closed** M5 bar's SSA (Close, for the fractal EDT) sits against the corridor between LOEDT and UOEDT.
Nine states (trend × inside, above, below), a bias by trend (decision D6), the three M5 levels, a summary line
and a location-only commentary from nine templates. Failure is a status with a reason code, never a state.

Compared with the pre-retrofit MCD2 (`legacy/`): closed bars instead of the forming bar; the setting instead of
detection; statistics at the slot; containment checked in tier 4; no probability, advice or `UNIDENTIFIED`
words; two regime words renamed (D5); output is envelope `mcd-output/1`. The change list is plan §1.

## 2. Files

All in `davintrade-stack-d-and-e/engine-1-5-new/mcd2/` unless stated.

| Path                                  | Purpose                                                                                                                |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `mcd2.md`                             | Specification (14 sections), approved                                                                                  |
| `mcd2_implementation_plan.md`         | R4 plan, approved; the R1 baseline and the expected legacy to new mapping                                              |
| `concept.md`, `concept/`              | Readback of Davin's two boards (confirmed 1 Oct 2026) and the board images                                             |
| `mcd2_registry.yaml`                  | Registry entry, state register (nine states) and the nine commentary templates                                         |
| `mcd2_params.yaml`                    | Seven parameters with value, unit, boundary, why                                                                       |
| `mcd2_evaluator.py`                   | The evaluator. Imports the standard library, `decimal` and four kit modules only                                       |
| `test_mcd2_unit_tests.py`             | 102 tests (§3). Also holds `write_fixtures()`, the recipe that regenerates the fixtures                                |
| `fixtures/`                           | Per slot: `<slot>.inputs.json` (the bundle), `.envelope.json` (the expected output), `.source.md` (workbook, SHA-256)  |
| `mcd2_output.json`                    | The envelope of the v1 cycle (identical to `fixtures/2026-09-18T2055Z.envelope.json`)                                  |
| `legacy/`                             | Pre-retrofit evaluator, tests and output; read-only history. One path line differs in the test copy                    |
| `docs/STACK-D-ARCHITECTURE.md` (repo) | §2.13 MCD2 row notes 2.0.1; §2.5 window cell is `min(T_EDT − 1, 288)`; §2.5 and §3.4 use the renamed regime words (Q7) |

## 3. Test results

From `davintrade-stack-d-and-e/engine-1-5-new/`, Python 3.11.9, `unittest`, 1 October 2026:

| Command                                                                     | Result                                     |
| --------------------------------------------------------------------------- | ------------------------------------------ |
| `python -m unittest discover -s mcd2`                                       | **102 OK, 0 skipped**, about 10 s          |
| `python -m unittest discover -s mcd_common/tests -t .` (the kit, unchanged) | **215 OK**                                 |
| Legacy tests, from `mcd2/legacy/`                                           | 13 OK (the pre-retrofit baseline, plan §6) |
| `npx prettier --check` on the Markdown and YAML files of this folder        | Clean                                      |

The 102 tests: register and parameters (5), states T1 (9), metric (3), boundaries T2 (8), short channels P7 (9), pre-flight T3 (17),
legacy cases (5), real cycles T13 (4), shared checks T4 to T8, T10, T12 on four real cycles (28), never throws (2),
output T8, T9, T11, T12 and rounding (7), purity and folder layout (3), fixture provenance (2).

**Mutation pass** (scratch copy of the kit and this folder; the repo was not touched): 28 mutations of the evaluator (the two edges of the corridor and of the trend band, the closed-bar cut, the metric for
centroid and fractal, the bias, window cap and floor, the tier-3 window check, the angle bound and its check, the
reversion flag, populated candidates, output rounding and its half-up mode, the T_EDT order, tier 1, the containment
floor, summary and regime words, `never_throws`, the CAUTIONARY branch, a wall-clock call). The first pass killed 27 and one
survived (rounding of the angle in `details`: no test used an angle with more than two decimals). The test
`OutputTests.test_numbers_are_rounded_to_two_decimals_at_output_only` was added and now kills it: **28 of 28 killed**.

**Independent check (task P6, 1 October 2026)**: no line of A1 to A26 failed; the reviewer's own pass of 40 mutants left 4 alive, which were
three test gaps, H1 to H3, all in the tier-3 window checks (the window start, the strict `>` on a window bar other than the last, and
tier 3 reading a malformed forming bar). The evaluator was right in each case. They are closed by one test,
`PreflightTests.test_tier3_window_edges_strict_inequality_and_a_malformed_forming_bar` (an inverted bar at the first bar of the window and
just outside it; UOEDT equal to LOEDT at a window bar that is not the last; an inverted forming bar appended). On a scratch copy the four
mutants (window one bar short, one bar long, `>=`, raw bars instead of closed bars) are each killed by it. No change to the evaluator, the
version or any output.

**Patch 2.0.1 (task P7, 1 October 2026).** The window is `min(T_EDT − 1, 288)` closed M5 bars and a channel under 48 closed bars is
INVALID + `INSUFFICIENT_BARS` (spec §3, §6; `concept.md`, "Change 2026-10-01"). Re-run: MCD2 **102 OK** (93 before: nine new tests in
`ShortChannelTests`; three old tests pinned the old formula on synthetic bundles and were edited: `test_the_window_is_the_channel_length_between_48_and_288_bars`,
`test_the_bar_count_must_reach_the_window` and the 100 and 60 cases of `test_t_edt_falls_back_in_order_and_ends_at_288`; the register test lists the new
parameter); the kit **215 OK**, MCD1 **113 OK**, MCD3 **134 OK** (1 opt-in skip) and its opt-in scan of the 12 real pairings OK, the three legacy suites
**13 OK** each. **Mutation pass on the new logic** (scratch run on the repo files, restored after each mutant): 8 mutants of the window and floor code (the old
window, a hard-coded 1, `<=` against `<`, the floor never applied, the fallback off by one, `max` for the cap, the floor and the cap hard-coded) **8 of 8 killed**.
No fixture output changes except the stored `evaluator_version` label (`2.0.0` to `2.0.1`) in the four fixture envelopes, `mcd2_output.json` and MCD3's
stored upstream readings (the MCD3 T14 test requires them to equal the live output); every real `T_EDT` is 314 or more, so window, state and numbers are the same.

## 4. Legacy baseline (step R1)

Pre-retrofit evaluator on the frozen workbooks (it reads the forming bar, the one opening at the slot):

| Workbook · override | Legacy result                                                                      |
| ------------------- | ---------------------------------------------------------------------------------- |
| v1 · none           | FAIL, `trend_state` INVALID: multiple active indicators (`best_fit_a`, `fractal`)  |
| v1 · `best_fit_a`   | PASS `MCD2_UP_IN_CORRIDOR`, θ 6.94, containment 55.76, `T_EDT` 755, CP 0.7959      |
| v1 · `fractal`      | PASS `MCD2_UP_IN_CORRIDOR`, θ 10.61, containment 64.88, `T_EDT` 336, CP 0.0960     |
| v1 · the other six  | FAIL INVALID: no data (0 bars)                                                     |
| v4 · none           | FAIL INVALID: multiple active indicators (`cherry_a`, `fractal`)                   |
| v4 · `cherry_a`     | PASS `MCD2_DOWN_IN_CORRIDOR`, θ −20.94, containment 100.0, `T_EDT` 1134, CP 0.1846 |
| v4 · `fractal`      | PASS `MCD2_DOWN_IN_CORRIDOR`, θ −49.89, containment 99.51, `T_EDT` 410, CP 0.7887  |
| v4 · the other six  | FAIL INVALID: no data (0 bars)                                                     |

## 5. Equivalence table (step R7)

Legacy and new run side by side (scratch script, 1 October 2026). "Same state" means the state code is equal and
the regime word is equal after the D5 renames. Every row is explained; none is unexplained.

| Case                              | Legacy                                                                       | New                                                                              | Same state | Why it differs                                               |
| --------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------ |
| Real v1 `best_fit_a`              | `MCD2_UP_IN_CORRIDOR`, CP 0.7959                                             | `MCD2_UP_IN_CORRIDOR`, LONG, CP 0.8192                                           | yes        | Last closed bar (20:50) instead of the forming bar (20:55)   |
| Real v1 `fractal`                 | `MCD2_UP_IN_CORRIDOR`, CP 0.0960                                             | `MCD2_UP_IN_CORRIDOR`, LONG, CP 0.1065                                           | yes        | Same                                                         |
| Real v4 `cherry_a`                | `MCD2_DOWN_IN_CORRIDOR`, CP 0.1846                                           | `MCD2_DOWN_IN_CORRIDOR`, SHORT, CP 0.1753                                        | yes        | Same                                                         |
| Real v4 `fractal`                 | `MCD2_DOWN_IN_CORRIDOR`, CP 0.7887                                           | `MCD2_DOWN_IN_CORRIDOR`, SHORT, CP 0.7932                                        | yes        | Same                                                         |
| Legacy 10, v1 and v4, no override | INVALID: multiple active indicators                                          | VALID, `populated_candidates` lists the other candidate                          | n/a        | Setting decides, populated candidates are informational (D3) |
| Legacy 03 UP + inside             | `MCD2_UP_IN_CORRIDOR` / `TREND_ALIGNED_CONTINUATION`                         | same state and regime, LONG                                                      | yes        | Bias added (D6)                                              |
| Legacy 04 UP + above              | `MCD2_UP_UPPER_BREAKOUT` / `UPPER_OVEREXTENSION_REVERSION`                   | same, LONG, `reversion_setup` true                                               | yes        | `mean_reversion_probability` HIGH became `reversion_setup`   |
| Legacy 05 UP + below              | `MCD2_UP_LOWER_BREAKDOWN` / `DIP_VALUE_BUY_OPPORTUNITY`                      | `MCD2_UP_LOWER_BREAKDOWN` / `UPTREND_DIP_BELOW_CORRIDOR`, LONG                   | yes        | D5 rename                                                    |
| Legacy 06 DOWN + inside           | `MCD2_DOWN_IN_CORRIDOR` / `TREND_ALIGNED_CONTINUATION`                       | same, SHORT                                                                      | yes        | Bias (D6)                                                    |
| Legacy 07 DOWN + below            | `MCD2_DOWN_LOWER_BREAKDOWN` / `LOWER_OVEREXTENSION_REVERSION`                | same, SHORT, `reversion_setup` true                                              | yes        | Flag                                                         |
| Legacy 08 DOWN + above            | `MCD2_DOWN_UPPER_BREAKOUT` / `RALLY_VALUE_SELL_OPPORTUNITY`                  | `MCD2_DOWN_UPPER_BREAKOUT` / `DOWNTREND_RALLY_ABOVE_CORRIDOR`, SHORT             | yes        | D5 rename                                                    |
| Legacy 09a, 09b, 09c SIDEWAYS     | `RANGE_EQUILIBRIUM`, `RANGE_RESISTANCE_REVERSION`, `RANGE_SUPPORT_REVERSION` | same three states and regime words, NEUTRAL                                      | yes        | Bias (D6); flag on 09b and 09c                               |
| Legacy 11 zero active indicators  | `MCD2ValidationError` (no active indicator)                                  | INVALID + `DISCONTINUITY` (the set indicator has no data); `NO_SETTING` if unset | n/a        | Failure is a status with a reason code                       |
| Legacy 12 inverted channel        | `MCD2ValidationError` (corrupt channel boundary)                             | INVALID + `SANITY_FAILED`                                                        | n/a        | Same                                                         |
| Legacy 13a missing statistics row | `MCD2ValidationError` (no matching record)                                   | STALE + `NO_STATS_AT_SLOT`                                                       | n/a        | Same                                                         |
| Legacy 13b containment below 50%  | state `MCD2_UNIDENTIFIED`, `trend_state` UNIDENTIFIED                        | INVALID + `CONTAINMENT_LOW` (no state)                                           | n/a        | Walkthrough C1: one failure status                           |

Other intended differences (plan §6): the corridor is decided on unrounded prices (legacy used a CP already rounded to
4 decimals; the two differ only within 0.00005 of a band, tested in `BoundaryTests`); the window statistics,
`raw_slope`, `anchored_y_int` and provenance fields are gone from the output (Q3); all wording.

## 6. Real-cycle envelopes (step R8)

Four real cycles, each read through the stored fixture bundle. All VALID, schema errors none. Tokens are
`o200k_base`; time is the slowest of 20 runs.

| Workbook · setting | Slot · last closed bar                | State                   | CP     | Window | Populated beside | Tokens | Time   |
| ------------------ | ------------------------------------- | ----------------------- | ------ | ------ | ---------------- | ------ | ------ |
| v1 · `best_fit_a`  | 2026-09-18T20:55Z · 2026-09-18T20:50Z | `MCD2_UP_IN_CORRIDOR`   | 0.8192 | 288    | `fractal`        | 355    | 5.5 ms |
| v1 · `fractal`     | same                                  | `MCD2_UP_IN_CORRIDOR`   | 0.1065 | 288    | `best_fit_a`     | 355    | 8.7 ms |
| v4 · `cherry_a`    | 2026-09-28T23:15Z · 2026-09-28T23:10Z | `MCD2_DOWN_IN_CORRIDOR` | 0.1753 | 288    | `fractal`        | 359    | 5.4 ms |
| v4 · `fractal`     | same                                  | `MCD2_DOWN_IN_CORRIDOR` | 0.7932 | 288    | `cherry_a`       | 353    | 7.7 ms |

The largest envelope measured is 359 tokens (budget 600); one evaluation takes under 10 ms (budget 1 s).
`mcd2_output.json` is the first row (v1 · `best_fit_a`): VALID, `MCD2_UP_IN_CORRIDOR`, `TREND_ALIGNED_CONTINUATION`, LONG,
levels UOEDT 4384.23, baseline 4367.20, LOEDT 4350.16, summary "M5 uptrend, inside the corridor", commentary "The M5 SSA is
inside the corridor, between LOEDT 4350.16 and UOEDT 4384.23 (channel position 0.8192), while the channel slopes up
(+6.94°)." Fixtures are frozen: a workbook is never regenerated in place (`FixtureProvenanceTests` checks the SHA-256).

## 7. Standard Appendix A

| #   | Check                                                                             | Status                  | Evidence                                                                                                                                                                                                                                                         |
| --- | --------------------------------------------------------------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | Spec has all 14 sections and is approved by Davin                                 | Pass                    | `mcd2.md` §1 to §14; approved 1 Oct 2026 (§9 of this manifest)                                                                                                                                                                                                   |
| A2  | Implementation plan approved before coding                                        | Pass                    | `mcd2_implementation_plan.md`; approved 1 Oct 2026, before P3 started                                                                                                                                                                                            |
| A3  | Reads only the input bundle; no database, file, network, clock, randomness, model | Pass                    | `PurityTests` (imports allowed list; no file, clock, randomness, environment or print names); mutation "uses wall clock" killed                                                                                                                                  |
| A4  | Closed bars only; forming bar and last price never used                           | Pass                    | `_Shared.test_t4_forming_bar_is_ignored` on four cycles; `RealCycleTests.test_the_stored_bundles_hold_closed_bars_only`; mutation "reads forming bar" killed; for tier 3, `PreflightTests.test_tier3_window_edges_...` (a malformed forming bar changes nothing) |
| A5  | Statistics by slot and active source; no match is STALE                           | Pass                    | `_Shared.test_t5_wrong_slot_statistics_are_stale` (four cycles); `PreflightTests.test_tier4_no_row_and_a_row_from_another_slot`                                                                                                                                  |
| A6  | Active indicator from the setting; mismatch is CAUTIONARY                         | Pass                    | `_Shared.test_t6_setting_and_detection_mismatch`; `PreflightTests.test_tier1_*`. The mismatch check is CAUTIONARY and continues; the reading then ends STALE or INVALID with `DETECTION_MISMATCH` kept first (spec §5)                                           |
| A7  | Output validates against `mcd-output/1`; no extra top-level field                 | Pass                    | `OutputTests.test_t8_*`, `_Shared.test_t8_schema`, every `assert_reading` and state test calls `schema_errors`                                                                                                                                                   |
| A8  | Pre-flight order cycle, 1, 4, 2, 3; reason codes from Appendix D                  | Pass                    | `PreflightTests.test_the_first_failing_check_decides` (four orderings); the envelope builders reject any code outside Appendix D                                                                                                                                 |
| A9  | Never throws; errors become INVALID + `EVALUATOR_ERROR`                           | Pass                    | `_Shared.test_t10_corrupted_bundle_never_throws` (nine corruptions, four cycles); `NeverThrowsTests.test_t10_an_error_inside_the_evaluator_...`; mutation "never_throws removed" killed                                                                          |
| A10 | State register exhaustive and exclusive; codes follow §7.1                        | Pass                    | `RegisterTests` (nine states = trend × corridor; sweep over 63 inputs reaches all nine and matches an independent classifier); codes ≤ 29 characters                                                                                                             |
| A11 | Bias per state; null when INVALID or STALE                                        | Pass                    | `RegisterTests.test_the_register_is_exhaustive_and_exclusive_and_bias_follows_d6`; `PreflightTests.assert_reading` (state, bias, levels, details empty)                                                                                                          |
| A12 | No banned words, probabilities or unmeasured numbers                              | Pass                    | `OutputTests.test_t11_*` (codes, regime words, templates, summaries, rendered commentary, meanings); the old wording is rejected by the same check                                                                                                               |
| A13 | Summary ≤ 80 characters, no prices; commentary from templates                     | Pass                    | T11 summary check (longest summary 33 characters); `StateTests` compare each commentary with its literal template output                                                                                                                                         |
| A14 | Levels named, per timeframe, 2 decimals; zone width defined                       | Pass                    | `StateTests.assert_state` (names, `tf` M5, prices, roles); zone width is 10% of `U − L` of the same bar (spec §8, ADR-031); the zone builder is Section 3                                                                                                        |
| A15 | `depends_on` complete; a derived MCD modifies, does not re-vote                   | Not applicable          | Independent: `depends_on` is `[]` (`StateTests`); T14 is for derived MCDs                                                                                                                                                                                        |
| A16 | `uses_channel` declared if it is a channel MCD                                    | Pass                    | `mcd2_registry.yaml` `uses_channel: [M5]`; `RegisterTests.test_registry_and_params_describe_this_evaluator`                                                                                                                                                      |
| A17 | Precedence rung proposed; rule rows proposed (not applied)                        | Pass                    | Spec §9: rungs confirmed by Davin (Q6); no new rule rows proposed; the two renamed words updated in the draft table, architecture §3.4 (Q7)                                                                                                                      |
| A18 | Dispatch-matrix intents, tags, playbook and foundations chunks ready              | Pending, stage 6        | The content is listed in spec §10; the files need the knowledge build (architecture §4.6)                                                                                                                                                                        |
| A19 | Reason texts and new glossary terms in all 16 languages                           | Pending, stage 6        | Reason codes MCD2 can emit are listed in spec §10                                                                                                                                                                                                                |
| A20 | Parameters in `mcdN_params.yaml` with rationale                                   | Pass                    | `mcd2_params.yaml` loads through `Params.from_yaml` (the kit refuses a parameter without value, unit, boundary and why); the seven names equal spec §6                                                                                                           |
| A21 | Tests T1 to T14 pass (T14 for derived MCDs)                                       | Pass                    | 102 OK; T14 not applicable                                                                                                                                                                                                                                       |
| A22 | Envelope ≤ 600 tokens; evaluation ≤ 1 s                                           | Pass                    | `OutputTests.test_t12_*` (largest 359 tokens, `o200k_base`), `_Shared.test_t12_size_and_r15_time` (four cycles); §6 above                                                                                                                                        |
| A23 | Shadow period passed; point-in-time replay done; statistics stored                | Pending, stages 4 and 5 | Needs the sensor worker and `market_data_point_in_time`                                                                                                                                                                                                          |
| A24 | Added to golden scenarios and the labelled question set                           | Pending, stages 4 to 7  | Needs synthesis and the knowledge build                                                                                                                                                                                                                          |
| A25 | Registry row added to the architecture; decision entry written                    | Pending, stage 7        | Row exists and notes 2.0.1 (status `Retrofit`); the decision entry is written at go-live                                                                                                                                                                         |
| A26 | Folder matches §11.1: same file names, `concept.md` confirmed, nothing extra      | Pass                    | `PurityTests.test_the_folder_matches_the_standard_layout`; `concept.md` confirmed by Davin 1 Oct 2026; `__pycache__/` is git-ignored                                                                                                                             |

## 8. Open questions

None for the build. Carried forward:

- **Statistics fit windows and the forming bar** (`.claude/state/waiting-on.md`, MCD kit item): `regression_angle` and
  `containment_rate`, which MCD2 reads, may be fitted with the still-open bar. Settle it before certification (stage 5).
- **Standard Appendix C.2 template (resolved):** `flag: off` is read as the boolean `false` by YAML 1.1 parsers such as PyYAML.
  `mcd2_registry.yaml` quotes it (`'off'`); the standard's template does too since version 1.0.3.
- **Sub-cent wording (decided, left as-is):** a breakout under half a cent reads "0.00 above UOEDT"; accurate under the two-decimal rule.
- **All four real cycles are `IN_CORRIDOR`:** the six outside-corridor states and the three sideways states are covered
  by synthetic tests only. The untracked replica batches v2 and v3 were not scanned for a real example.

## 9. Decisions Davin made during the work

| Date       | Decision                                                                                                                                                                                                                                                                                          |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-30 | D3: tier-1 meaning (a mismatch is an empty set indicator while another has data; populated candidates are informational). Built into the kit                                                                                                                                                      |
| 2026-10-01 | D4 English specification. D5: `DIP_VALUE_BUY_OPPORTUNITY` to `UPTREND_DIP_BELOW_CORRIDOR`, `RALLY_VALUE_SELL_OPPORTUNITY` to `DOWNTREND_RALLY_ABOVE_CORRIDOR`. D6: UP LONG, DOWN SHORT, SIDEWAYS NEUTRAL                                                                                          |
| 2026-10-01 | Specification and plan approved; board readback confirmed                                                                                                                                                                                                                                         |
| 2026-10-01 | Q1 to Q7 approved as recommended: Close for the fractal; fallback 288; window statistics dropped; tier 3 on every window bar; angle bound 90; rungs (Day Trader trendlines and channels, Scalper primary structure); architecture word updates in P3                                              |
| 2026-10-01 | Task P6 found no failing line of A1 to A26 and three test gaps (H1 to H3). Davin: stage-3 sign-off for MCD2 granted; H1 to H3 closed with one test; standard PATCHed to 1.0.3 (`flag: 'off'` in Appendix C.2); walkthrough C1 reads "Renamed (D5)"; sub-cent wording left as-is                   |
| 2026-10-01 | Task P7: Davin confirmed the PATCH classification (evaluator 2.0.1) and asked to proceed. Questions Q1 to Q5 of `concept.md` were not answered one by one; built as recommended (the floor of 48 kept as a minimum, parameter `t_edt_open_bar_rows`, one decision entry draft, MCD3 note wording) |
