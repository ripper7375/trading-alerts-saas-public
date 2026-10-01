# MCD1 manifest: work completion (retrofit 2.0.0)

|                       |                                                                                                                                                                                                                                                             |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **MCD**               | MCD1: M15 primary trend and micro regime · independent · M15                                                                                                                                                                                                |
| **Evaluator version** | **2.0.0** (MAJOR: the output shape changed from the pre-retrofit evaluator, which had no version)                                                                                                                                                           |
| **Stage**             | 3 (build) done on 1 October 2026 by task P3. **Independent check (task P6) done the same day (findings F1 to F3, all closed); Davin granted the stage-3 sign-off on 1 October 2026.** Flag `off`. Registry status in architecture §2.13: `Retrofit (2.0.0)` |
| **Built on**          | The shared kit `mcd_common/` (Step 0, 215 tests), standard 1.0.3, walkthrough Part C0 steps R5 to R10                                                                                                                                                       |
| **Specification**     | [mcd1.md](mcd1.md) (approved by Davin, 1 October 2026) · [plan](mcd1_implementation_plan.md) · [concept](concept.md) (readback confirmed 1 October 2026)                                                                                                    |
| **Next**              | Stages 4 to 7 when the sensor worker, synthesis and the knowledge build exist; the next retrofit is MCD3 (task P2, needs D7 and D10)                                                                                                                        |

## 1. What was built

`evaluate(inputs, params, upstream) -> envelope`: a pure function on the kit's frozen input bundle that answers one
question per cycle: which way the active M15 EDT channel slopes (UP, DOWN, SIDEWAYS on a ±5° band, from the
statistics row at the slot), and what the last `N_micro` **closed** M15 bars did against that channel's corridor
between LOEDT and UOEDT (the bar's Close is the metric). `N_micro` is 5% of `T_EDT` rounded half up, never below 96.
A same-slope break fires on the latest closed bar alone (ADR-023); a counter-trend or sideways break also needs 80%
of the window outside on that side. Nine states (trend × inside, upper break, lower break), a bias per state
(decision D6), the three M15 levels, a summary line and a counts-and-location commentary from nine templates.
Failure is a status with a reason code, never a state.

Compared with the pre-retrofit MCD1 (`legacy/`): closed bars instead of the forming bar; the setting instead of
detection (two populated indicators are no longer a failure, D3); statistics at the slot; containment checked in
tier 4 and a compromised corridor is INVALID + `CONTAINMENT_LOW`, never `UNIDENTIFIED`; non-ascending timestamps
are `DISCONTINUITY`; no probability, forecast or percentage wording; the M15 baseline level is new; the output is
envelope `mcd-output/1`. The change list is plan §1.

## 2. Files

All in `davintrade-stack-d-and-e/engine-1-5-new/mcd1/` unless stated.

| Path                                  | Purpose                                                                                                               |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `mcd1.md`                             | Specification (14 sections), approved                                                                                 |
| `mcd1_implementation_plan.md`         | R4 plan, approved; the R1 baseline (§6), the expected legacy to new mapping, and the build result (§9)                |
| `concept.md`                          | Readback of the pre-retrofit specification (MCD1 has no board), confirmed                                             |
| `mcd1_registry.yaml`                  | Registry entry, state register (nine states, bias per D6) and the nine commentary templates                           |
| `mcd1_params.yaml`                    | Seven parameters with value, unit, boundary, why                                                                      |
| `mcd1_evaluator.py`                   | The evaluator. Imports the standard library, `decimal` and four kit modules only                                      |
| `test_mcd1_unit_tests.py`             | 105 tests (§3). Also holds `write_fixtures()`, the recipe that regenerates the fixtures                               |
| `fixtures/`                           | Per slot: `<slot>.inputs.json` (the bundle), `.envelope.json` (the expected output), `.source.md` (workbook, SHA-256) |
| `mcd1_output.json`                    | The envelope of the v1 cycle (identical to `fixtures/2026-09-18T2055Z.envelope.json`)                                 |
| `legacy/`                             | Pre-retrofit evaluator, tests and output; read-only history. One path line differs in the test copy                   |
| `docs/STACK-D-ARCHITECTURE.md` (repo) | §2.13 MCD1 row notes 2.0.0 and its levels; §2.5 no longer says "(baseline to add)" (Q7)                               |

`concept/` does not exist: MCD1 has no board and git cannot hold an empty folder (standard §11.1 allows an empty
`concept/`; `PurityTests.test_the_folder_matches_the_standard_layout` allows its absence).

## 3. Test results

From `davintrade-stack-d-and-e/engine-1-5-new/`, Python 3.11.9, `unittest`, 1 October 2026:

| Command                                                                     | Result                                  |
| --------------------------------------------------------------------------- | --------------------------------------- |
| `python -m unittest discover -s mcd1`                                       | **105 OK, 0 skipped**, about 10 s       |
| `python -m unittest discover -s mcd2`                                       | 93 OK (MCD2, unchanged)                 |
| `python -m unittest discover -s mcd_common/tests -t .` (the kit, unchanged) | **215 OK**                              |
| Legacy tests, from `mcd1/legacy/` and `mcd2/legacy/`                        | 13 OK each (the pre-retrofit baselines) |
| `npx prettier --check` on the Markdown and YAML files of this folder        | Clean                                   |

The 105 tests: register and parameters (5), states T1 (9 states plus inside count, placement and same-slope
independence: 12), metric and candidates (3), boundaries T2 (17), pre-flight T3 (18), rule 1 at the five- and
ten-minute slots (1), legacy cases (9), real cycles T13 (5), shared checks T4 to T8, T10, T12 on three real cycles
(21), never throws (2), output T8, T9, T11, T12 and rounding (7), purity and folder layout (3), fixture provenance (2).

**Mutation pass** (scratch copy of the kit and this folder; the repo was not touched; the script is in the session
scratchpad): 57 mutations of the evaluator: the two edges of the trend band, of the corridor and of the window
counts (latest bar and every window bar), the inclusive sustained test and its percentage, the rounding mode and
floor of `N_micro`, the `T_EDT` field order and the fallback, the window start and end, the closed-bar cut, the
metric (Close, not SSA), the levels, six bias and regime entries, every branch of the micro regime for each trend,
the inside count, the distance, the channel position decimals and rounding, the CAUTIONARY branch, populated
candidates, the reading context, `never_throws`, tier 1, tier 2 (constant window), tier 3 (last bar only, strict `>`,
raw bars, window one short and one long, the angle bound and its check), tier 4 (angle check, containment floor), a
wall-clock import and a file read. **First pass: 55 killed, 2 survived**, both on the same gap: no test had a window
bar that closes exactly on UOEDT or LOEDT (it must count as inside; the mutants used `>=` and `<=` in the counts).
The test `BoundaryTests.test_a_window_bar_that_closes_exactly_on_a_band_is_inside_and_not_counted` was added and
kills both: **57 of 57 killed**. The evaluator was right in each case; only a test was missing.

**Independent check (task P6, a fresh session, 1 October 2026).** No line of A1 to A26 failed. The checker's own
mutation pass (424 mutants generated from the evaluator's syntax tree, on a scratch copy; the provenance tests left
out because they never call the evaluator) left 25 alive: 23 equivalent (annotation tuples, `Decimal(1)` against
`Decimal(0)` or `Decimal(2)` in `quantize`, diagnostic strings in tier-3 and tier-4 results that nothing reads, one
dead branch) and two real test gaps. **F1:** nothing pinned the commentary distance for a break under 1.00 (a floor of
1.00 on `{dist}` passed every test). **F2:** nothing pinned the negative-zero guard on the channel position (without it
the commentary reads "channel position -0.0000"; the test compared with `== 0.0`, which `-0.0` also satisfies). Both
are closed by `BoundaryTests.test_a_small_break_is_written_as_it_is_and_a_hair_below_loedt_is_never_a_negative_zero`
(105 tests); it kills both mutants. **F3:** four `meaning` sentences in `mcd1.md` §7 differed in wording from the
registry; the spec now matches the registry (bias, regime, summaries and templates already matched). A clean-room
reference written from spec §5 to §7 agreed with the evaluator on 220,000 random bundles, and moving each of the
seven parameter values by one step is caught by the behavioural tests (the one exception, 80.0 to 79.9, changes no
reading for a window of 150 bars or fewer). Report: `docs/handoffs/2026-10-01-0628-mcd1-p6.md`.

## 4. Legacy baseline (step R1)

Run before any change, and recorded in full in plan §6. The pre-retrofit evaluator reads the forming bar (the M15
bar opening at the slot's quarter hour). MCD1 has no override switch, so the "set" rows restrict the module's
candidate list to one indicator in a scratch script; the legacy files were not changed:

| Workbook · override | Legacy result                                                                                                                          |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| v1 · none           | PASS `non_b`, `DOWNTREND` · `COUNTER_TREND_EXPANSION`: θ −29.72, containment 73.95, `T_EDT` 1808, `N_micro` 96, CP 1.6447, 96 above    |
| v1 · `non_b`        | Same                                                                                                                                   |
| v1 · the other six  | FAIL `UNIDENTIFIED`: no active centroid indicator                                                                                      |
| v4 · none           | FAIL `UNIDENTIFIED`: multiple active indicators (`non_a`, `non_b`)                                                                     |
| v4 · `non_b`        | PASS `DOWNTREND` · `TREND_ALIGNED_CONTINUATION`: θ −20.98, containment 93.17, `T_EDT` 2035, `N_micro` 102, CP 0.1037, 0 above, 0 below |
| v4 · `non_a`        | PASS `SIDEWAYS` · `RANGE_EXPANSION` (lower breakdown): θ −0.56, containment 91.01, `T_EDT` 968, `N_micro` 96, CP −0.6524, 87 below     |
| v4 · the other five | FAIL `UNIDENTIFIED`: no active centroid indicator                                                                                      |

## 5. Equivalence table (step R7)

Legacy and new run side by side (scratch script, 1 October 2026; only the legacy class is called, so
`legacy/mcd1_output.json` is untouched). "Same state" means the state code is the legacy trend plus micro regime
under the plan §6 mapping, and the regime word is equal (none was renamed). Every row is explained; none is
unexplained.

| Case                                   | Legacy                                                              | New                                                                                                                | Same state | Why it differs                                                              |
| -------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ---------- | --------------------------------------------------------------------------- |
| Real v1 `non_b`                        | `DOWNTREND` · `COUNTER_TREND_EXPANSION`, CP 1.6447, 96 above        | `MCD1_DOWN_UPPER_BREAKOUT`, LONG, CP 1.6622, 96 above                                                              | yes        | Last closed bar (20:30) instead of the forming bar (20:45); bias added (D6) |
| Real v4 `non_b`                        | `DOWNTREND` · `TREND_ALIGNED_CONTINUATION`, CP 0.1037               | `MCD1_DOWN_IN_CORRIDOR`, SHORT, CP 0.1071                                                                          | yes        | Same                                                                        |
| Real v4 `non_a`                        | `SIDEWAYS` · `RANGE_EXPANSION`, CP −0.6524, 87 below                | `MCD1_SIDEWAYS_LOWER_BREAKDOWN`, SHORT, CP −0.6473, 86 below                                                       | yes        | Same; one fewer bar below because the window ends one bar earlier           |
| v1 and v4, no override                 | v1 PASS as above; v4 FAIL `UNIDENTIFIED` (two populated indicators) | v1 and v4 VALID; v4 lists `non_a` in `populated_candidates`                                                        | n/a        | The setting decides, populated candidates are informational (D3)            |
| Legacy 03 UP + inside                  | `TREND_ALIGNED_CONTINUATION`                                        | `MCD1_UP_IN_CORRIDOR`, LONG                                                                                        | yes        | Bias added (D6)                                                             |
| Legacy 05 UP + above                   | `BREAKOUT_SAME_SLOPE`                                               | `MCD1_UP_UPPER_BREAKOUT`, LONG                                                                                     | yes        | Bias added                                                                  |
| Legacy 06 UP + below, sustained        | `COUNTER_TREND_EXPANSION`                                           | `MCD1_UP_LOWER_BREAKDOWN`, SHORT                                                                                   | yes        | Bias added                                                                  |
| DOWN + inside                          | `TREND_ALIGNED_CONTINUATION`                                        | `MCD1_DOWN_IN_CORRIDOR`, SHORT                                                                                     | yes        | Bias added                                                                  |
| Legacy 04 DOWN + below                 | `BREAKOUT_SAME_SLOPE`                                               | `MCD1_DOWN_LOWER_BREAKDOWN`, SHORT                                                                                 | yes        | Bias added                                                                  |
| DOWN + above, sustained                | `COUNTER_TREND_EXPANSION`                                           | `MCD1_DOWN_UPPER_BREAKOUT`, LONG                                                                                   | yes        | Bias added                                                                  |
| Legacy 07 SIDEWAYS, three combos       | `CONSOLIDATION`, `RANGE_EXPANSION`, `RANGE_EXPANSION`               | `MCD1_SIDEWAYS_IN_CORRIDOR` NEUTRAL; `_UPPER_BREAKOUT` LONG; `_LOWER_BREAKDOWN` SHORT                              | yes        | The two `RANGE_EXPANSION` cases split by the side of the break; bias added  |
| Legacy 08 two active indicators        | FAIL, `UNIDENTIFIED`                                                | VALID, `populated_candidates` lists the other candidate                                                            | n/a        | D3                                                                          |
| Legacy 09 zero active indicators       | FAIL, `UNIDENTIFIED`                                                | CAUTIONARY `DETECTION_MISMATCH` then STALE + `NO_STATS_AT_SLOT`; INVALID + `DISCONTINUITY` if nothing is populated | n/a        | Failure is a status with reason codes                                       |
| Legacy 10 UOEDT ≤ LOEDT                | FAIL                                                                | INVALID + `SANITY_FAILED`                                                                                          | n/a        | Same                                                                        |
| Legacy 11 containment 35.5%            | PASS with trend `UNIDENTIFIED`, regime `UNCERTAIN`                  | INVALID + `CONTAINMENT_LOW`, no state                                                                              | n/a        | Walkthrough C2: one failure status                                          |
| Legacy 12 80% share, 80 and 50 of 96   | `UPPER_BREAKOUT` (counter-trend) and `IN_CORRIDOR`                  | `MCD1_DOWN_UPPER_BREAKOUT` and `MCD1_DOWN_IN_CORRIDOR`                                                             | yes        | None; the share test is now exact integer arithmetic                        |
| Legacy 13 same-slope on the latest bar | `LOWER_BREAKDOWN` with 3 bars, `UPPER_BREAKOUT` with 2 bars         | `MCD1_DOWN_LOWER_BREAKDOWN` and `MCD1_UP_UPPER_BREAKOUT`                                                           | yes        | None (ADR-023); the "V-shape" wording is gone                               |

Other intended differences (plan §6): the state is decided on unrounded prices and exact counts, which differs from
the legacy rounded channel position only when Close is within 0.00005 of a band (tested in `BoundaryTests`);
`N_micro` rounds half up, which differs from Python `round()` only when 5% of `T_EDT` is exactly x.5 with x even
(`T_EDT` 1,930 gives 97, was 96; tested); the per-side percentages, `contained_bar_count`, `channel_position_stat`,
`raw_slope` and the provenance block are gone from the output; all wording. **No state differs from legacy that the
plan did not list.**

## 6. Real-cycle envelopes (step R8)

Three real cycles, each read through the stored fixture bundle. All VALID, schema errors none. Tokens are
`o200k_base`; time is the slowest of 5 runs.

| Workbook · setting | Slot · last closed bar                | State                           | CP      | `N_micro` | Above / below | Populated beside | Tokens | Time   |
| ------------------ | ------------------------------------- | ------------------------------- | ------- | --------- | ------------- | ---------------- | ------ | ------ |
| v1 · `non_b`       | 2026-09-18T20:55Z · 2026-09-18T20:30Z | `MCD1_DOWN_UPPER_BREAKOUT`      | 1.6622  | 96        | 96 / 0        | none             | 365    | 2.5 ms |
| v4 · `non_b`       | 2026-09-28T23:15Z · 2026-09-28T23:00Z | `MCD1_DOWN_IN_CORRIDOR`         | 0.1071  | 102       | 0 / 0         | `non_a`          | 356    | 2.5 ms |
| v4 · `non_a`       | same                                  | `MCD1_SIDEWAYS_LOWER_BREAKDOWN` | −0.6473 | 96        | 0 / 86        | `non_b`          | 367    | 2.4 ms |

The largest envelope measured is 367 tokens (budget 600); the largest synthetic one is 337 (a CAUTIONARY reading);
one evaluation takes about 2.5 ms (budget 1 s). `mcd1_output.json` is the first row: VALID,
`MCD1_DOWN_UPPER_BREAKOUT`, `COUNTER_TREND_EXPANSION`, LONG, levels UOEDT 4279.46, baseline 4214.17, LOEDT 4126.24,
summary "M15 downtrend, sustained close above the corridor", commentary "The M15 channel slopes down (-29.72°). The
latest closed bar closed 101.47 above UOEDT 4279.46 (channel position 1.6622); 96 of the last 96 closed bars closed
above UOEDT." Three of the nine states have a real example, each on a different cycle; the other six are covered by
synthetic bundles. Fixtures are frozen: a workbook is never regenerated in place (`FixtureProvenanceTests` checks
the SHA-256).

## 7. Standard Appendix A

| #   | Check                                                                             | Status                  | Evidence                                                                                                                                                                                                                                                                                                              |
| --- | --------------------------------------------------------------------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | Spec has all 14 sections and is approved by Davin                                 | Pass                    | `mcd1.md` §1 to §14; approved 1 Oct 2026 (§9 of this manifest)                                                                                                                                                                                                                                                        |
| A2  | Implementation plan approved before coding                                        | Pass                    | `mcd1_implementation_plan.md`; approved 1 Oct 2026, before P3 started                                                                                                                                                                                                                                                 |
| A3  | Reads only the input bundle; no database, file, network, clock, randomness, model | Pass                    | `PurityTests` (imports allowed list; no file, clock, randomness, environment or print names); mutations "a wall-clock import" and "file read" killed                                                                                                                                                                  |
| A4  | Closed bars only; forming bar and last price never used                           | Pass                    | `_Shared.test_t4_forming_bar_is_ignored` on three cycles; `RealCycleTests.test_the_stored_bundles_hold_closed_bars_only`; mutation "window reads raw bars" killed; `PreflightTests.test_tier3_window_edges_...` (a malformed forming bar changes nothing)                                                             |
| A5  | Statistics by slot and active source; no match is STALE                           | Pass                    | `_Shared.test_t5_wrong_slot_statistics_are_stale` (three cycles); `PreflightTests.test_tier4_no_row_and_a_row_from_another_slot` (including a row stamped with the export slot)                                                                                                                                       |
| A6  | Active indicator from the setting; mismatch is CAUTIONARY                         | Pass                    | `_Shared.test_t6_setting_and_detection_mismatch`; `PreflightTests.test_tier1_*`; `MetricTests` (all seven candidates; the fractal EDT and the single lines are not candidates). The mismatch check is CAUTIONARY and continues; the reading then ends STALE or INVALID with `DETECTION_MISMATCH` kept first (spec §5) |
| A7  | Output validates against `mcd-output/1`; no extra top-level field                 | Pass                    | `OutputTests.test_t8_*`, `_Shared.test_t8_schema`, every `assert_reading` and state test calls `schema_errors`                                                                                                                                                                                                        |
| A8  | Pre-flight order cycle, 1, 4, 2, 3; reason codes from Appendix D                  | Pass                    | `PreflightTests.test_the_first_failing_check_decides` (four orderings); the envelope builders reject any code outside Appendix D                                                                                                                                                                                      |
| A9  | Never throws; errors become INVALID + `EVALUATOR_ERROR`                           | Pass                    | `_Shared.test_t10_corrupted_bundle_never_throws` (nine corruptions, three cycles); `NeverThrowsTests.test_t10_an_error_inside_the_evaluator_...`; mutation "never_throws removed" killed                                                                                                                              |
| A10 | State register exhaustive and exclusive; codes follow §7.1                        | Pass                    | `RegisterTests` (nine states = trend × micro regime; a sweep over 378 inputs reaches all nine and matches an independent classifier); codes ≤ 29 characters                                                                                                                                                           |
| A11 | Bias per state; null when INVALID or STALE                                        | Pass                    | `RegisterTests.test_the_register_is_exhaustive_and_exclusive_and_bias_follows_d6` (no `DAVIN` left); `PreflightTests.assert_reading` (state, bias, levels, details empty)                                                                                                                                             |
| A12 | No banned words, probabilities or unmeasured numbers                              | Pass                    | `OutputTests.test_t11_*` (codes, regime words, templates, summaries, rendered commentary, meanings); the legacy wording is rejected by the same check                                                                                                                                                                 |
| A13 | Summary ≤ 80 characters, no prices; commentary from templates                     | Pass                    | T11 summary check (longest summary 49 characters); `StateTests` compare each commentary with its literal template output                                                                                                                                                                                              |
| A14 | Levels named, per timeframe, 2 decimals; zone width defined                       | Pass                    | `StateTests.assert_state` (names, `tf` M15, prices, roles); zone width is 10% of `U − L` of the same bar (spec §8, ADR-031); the zone builder is Section 3                                                                                                                                                            |
| A15 | `depends_on` complete; a derived MCD modifies, does not re-vote                   | Not applicable          | Independent: `depends_on` is `[]` (`StateTests`); T14 is for derived MCDs                                                                                                                                                                                                                                             |
| A16 | `uses_channel` declared if it is a channel MCD                                    | Pass                    | `mcd1_registry.yaml` `uses_channel: [M15]`; `RegisterTests.test_registry_and_params_describe_this_evaluator`                                                                                                                                                                                                          |
| A17 | Precedence rung proposed; rule rows proposed (not applied)                        | Pass                    | Spec §9: rungs confirmed by Davin (Q6); no new rule rows proposed; the bias note for the draft rule 2 is recorded there                                                                                                                                                                                               |
| A18 | Dispatch-matrix intents, tags, playbook and foundations chunks ready              | Pending, stage 6        | The content is listed in spec §10; the files need the knowledge build (architecture §4.6)                                                                                                                                                                                                                             |
| A19 | Reason texts and new glossary terms in all 16 languages                           | Pending, stage 6        | Reason codes MCD1 can emit are listed in spec §10                                                                                                                                                                                                                                                                     |
| A20 | Parameters in `mcdN_params.yaml` with rationale                                   | Pass                    | `mcd1_params.yaml` loads through `Params.from_yaml` (the kit refuses a parameter without value, unit, boundary and why); the seven names and values equal spec §6 (`RegisterTests`)                                                                                                                                   |
| A21 | Tests T1 to T14 pass (T14 for derived MCDs)                                       | Pass                    | 105 OK; T14 not applicable                                                                                                                                                                                                                                                                                            |
| A22 | Envelope ≤ 600 tokens; evaluation ≤ 1 s                                           | Pass                    | `OutputTests.test_t12_*` (largest 367 tokens, `o200k_base`), `_Shared.test_t12_size_and_r15_time` (three cycles); §6 above                                                                                                                                                                                            |
| A23 | Shadow period passed; point-in-time replay done; statistics stored                | Pending, stages 4 and 5 | Needs the sensor worker and `market_data_point_in_time`                                                                                                                                                                                                                                                               |
| A24 | Added to golden scenarios and the labelled question set                           | Pending, stages 4 to 7  | Needs synthesis and the knowledge build                                                                                                                                                                                                                                                                               |
| A25 | Registry row added to the architecture; decision entry written                    | Pending, stage 7        | Row exists and notes 2.0.0 (status `Retrofit (2.0.0)`); the decision entry is written at go-live                                                                                                                                                                                                                      |
| A26 | Folder matches §11.1: same file names, `concept.md` confirmed, nothing extra      | Pass                    | `PurityTests.test_the_folder_matches_the_standard_layout` (`concept/` absent by design, see §2); `concept.md` confirmed by Davin 1 Oct 2026; `__pycache__/` is git-ignored                                                                                                                                            |

## 8. Open questions

None for the build. Carried forward:

- **Statistics fit windows and the forming bar** (`.claude/state/waiting-on.md`, MCD kit item): `regression_angle`,
  `containment_rate` and `containment_n`, which MCD1 reads (and `N_micro` with them), may be fitted with the
  still-open bar. Settle it before certification (stage 5). It does not change the closed-bar reading of prices.
- **Five of nine states have synthetic examples only.** The fixtures give `MCD1_DOWN_UPPER_BREAKOUT`,
  `MCD1_DOWN_IN_CORRIDOR` and `MCD1_SIDEWAYS_LOWER_BREAKDOWN`. The independent check also ran the untracked replica
  batches v2 and v3 (every M15 candidate with a statistics row): no error, and v3 (`non_a` and `non_b`) gives a real
  `MCD1_DOWN_LOWER_BREAKDOWN`. v3 is not a fixture yet.
- **Sub-cent wording:** a break under half a cent reads "0.00 above UOEDT" (accurate under the two-decimal rule;
  Davin left the same wording as it is for MCD2).
- **Shared tier helpers:** the three helpers MCD2 added on top of the kit (angle is a number, window-wide channel sanity,
  a `required_columns` override for `bars_check`) are now written in two evaluators. Moving them into the kit is a kit
  change with its own review, best done after MCD3 when there are three copies (plan §7).
- **Draft rule 2 and the bias** (spec §9): under D6 the sensor bias in the two same-slope break states follows the
  break, while the draft rule 2 reads the same regime word as "bias against the spike". Synthesis decides; recorded
  for the rules review (task P8).

## 9. Decisions Davin made during the work

| Date       | Decision                                                                                                                                                                                                                                                                                                          |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-30 | D3: tier-1 meaning (a mismatch is an empty set indicator while another has data; populated candidates are informational). Built into the kit                                                                                                                                                                      |
| 2026-10-01 | D4 English specification                                                                                                                                                                                                                                                                                          |
| 2026-10-01 | Specification and plan approved; concept readback confirmed                                                                                                                                                                                                                                                       |
| 2026-10-01 | D6 bias per state: inside the corridor the bias follows the macro trend (UP LONG, DOWN SHORT, SIDEWAYS NEUTRAL); a break follows the break direction (above UOEDT LONG, below LOEDT SHORT) for all trends                                                                                                         |
| 2026-10-01 | Q1 to Q7 approved as recommended: Close as the metric; `T_EDT` fallback 96; `N_micro` rounds half up; tier 3 on every window bar; angle bound 90; rungs (Day Trader primary structure, Scalper trendlines and channels); architecture §2.13 and §2.5 documentation edits in P3                                    |
| 2026-10-01 | Stage-3 sign-off for MCD1 after the independent check (task P6). Wrap-up instructions: close F1 and F2 with one test, align the four `meaning` sentences of `mcd1.md` §7 to the registry (F3), write the architecture §2.5 "States" cell for MCD1 (nine codes plus five regime statuses), commit by explicit path |
