# MCD0 manifest: work completion (new MCD, evaluator 1.0.0)

|                       |                                                                                                                                                                                                                                                              |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **MCD**               | MCD0: channel fit quality gate · gate · M5 and M15                                                                                                                                                                                                           |
| **Evaluator version** | **1.0.0** (a new MCD built on the standard; no pre-existing evaluator, so no legacy and no equivalence table)                                                                                                                                                |
| **Stage**             | 3 (build) done on 1 October 2026 by task P5. Independent check (task P6) done the same day: two findings, F1 and F2, both closed (§9). **Stage 3 signed off by Davin on 1 October 2026.** Flag `off`. Registry status in architecture §2.13: `Draft (1.0.0)` |
| **Built on**          | The shared kit `mcd_common/` (Step 0, 215 tests), standard 1.0.4, walkthrough Part C4 and Part D stage 3                                                                                                                                                     |
| **Specification**     | [mcd0.md](mcd0.md) (approved by Davin, 1 October 2026) · [plan](mcd0_implementation_plan.md) · [concept](concept.md) (confirmed 1 October 2026)                                                                                                              |
| **Next**              | Stages 4 to 7, when the sensor worker, synthesis and the knowledge build exist (the shadow period first: MCD0's flag rate)                                                                                                                                   |

## 1. What was built

`evaluate(inputs, params, upstream) -> envelope`: a pure function on the kit's frozen input bundle that answers one
question per cycle: is each timeframe's active channel fitted well enough to trust the channel sensors? For M5 and for
M15 it reads the statistics row at the slot for the active source and judges eight pillars (coverage in closed bars; R²
for Model A and Model B; fit ratio for each model with its own MSE; geo ratio; skew for each model), non-compensatory: a
timeframe is a defect when any applied pillar fails. Four states (both qualified, M5 defect, M15 defect, both defects),
bias NEUTRAL in all, no level, no regime word. **It reads no bar**, so the closed-bar rule has nothing to cut and
`last_closed_bar` is `{}`. The R² pillar is skipped on a flat channel (|angle| ≤ 5°) and Model A is not applicable for
the fractal EDT (decided by the source name). Failure is a status with a reason code, never a state. Tier 3 also requires the bundle's `config_hash` to be a mapping whose entry for each active source is a string, and only string hashes reach the envelope (P6 finding F1).

Not built (stages 4 to 7, no sensor worker yet): the worker's `MCD0_DEFECT_<TF>` marking of the channel MCDs, the shadow
period, the point-in-time replay, the dispatch-matrix row (Explain only), the playbook and foundations chunks, the
16-language texts.

## 2. Files

All in `davintrade-stack-d-and-e/engine-1-5-new/mcd0/` unless stated.

| Path                                  | Purpose                                                                                                                            |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `mcd0.md`                             | Specification (14 sections), approved                                                                                              |
| `mcd0_implementation_plan.md`         | Plan, approved                                                                                                                     |
| `concept.md`                          | Readback of walkthrough Part C4, confirmed by Davin with his answers (a) to (k) in §11. No `concept/` (there is no board)          |
| `mcd0_registry.yaml`                  | Registry entry, four-state register, pillar order and words, the four commentary templates                                         |
| `mcd0_params.yaml`                    | Twelve parameters with value, unit, boundary, why                                                                                  |
| `mcd0_evaluator.py`                   | The evaluator. Imports the standard library (`math`, `decimal`, `typing`) and four kit modules only                                |
| `test_mcd0_unit_tests.py`             | 124 tests (§3). Also holds `write_fixtures()`, the recipe that regenerates the fixtures                                            |
| `fixtures/`                           | Per slot (v1, v3, v4): `<slot>.inputs.json` (the bundle), `.envelope.json` (the expected output), `.source.md` (workbook, SHA-256) |
| `mcd0_output.json`                    | The envelope of the v1 cycle (identical to `fixtures/2026-09-18T2055Z.envelope.json`)                                              |
| `docs/STACK-D-ARCHITECTURE.md` (repo) | §2.13 MCD0 row: `Draft (1.0.0)`, spec link `engine-1-5-new/mcd0/mcd0.md`                                                           |

## 3. Test results

From `davintrade-stack-d-and-e/engine-1-5-new/`, Python 3.11.9, `unittest`, 1 October 2026:

| Command                                                                     | Result                                                          |
| --------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `python -m unittest discover -s mcd0`                                       | **124 OK, 0 skipped**, about 10 s                               |
| `python -m unittest discover -s mcd_common/tests -t .` (the kit, unchanged) | **215 OK**                                                      |
| `python -m unittest discover -s mcd1` / `mcd2` / `mcd3`                     | **113 OK** / **102 OK** / **134 OK** (1 opt-in skip), unchanged |
| Legacy tests of MCD1, MCD2 and MCD3, from their `legacy/` folders           | 13 OK each                                                      |
| `python -m pyflakes` on the evaluator and the test file                     | Clean                                                           |
| `npx prettier --check` on the Markdown and YAML files of this folder        | Clean                                                           |

The 124 tests (119 from P5, five added after P6): register and parameters (6), states T1 (7), boundaries T2 (17), decisions (13), pre-flight T3 (23), real
cycles T13 (6), shared checks T4 to T8, T10, T12 on five real bundles (35), output T8, T9, T11, T12, R15 (11), purity and
folder layout (4), fixture provenance (2).

**Mutation pass** (scratch run on the repo evaluator, restored byte for byte after every mutant): 37 mutants of the
evaluator (the closed-bar subtraction added and removed; every inclusive bound made strict: coverage, R², fit ratio at
both ends, geo ratio at both ends, skew; R² bounds swapped; geo ratio inverted; the half width; the flat band strict and
without `abs`; R² applied on flat channels; each model's own R², MSE and skew replaced by Model B's; Model A decided by a
null instead of the source name; the state logic (`and` to `or`, M5 and M15 swapped); tier 3 (`>` to `>=`, the Model A MSE
check removed, the offset sign); the required fields (the span dropped, Model A always required); tier 1 accepting any
string; `last_closed_bar` not emptied; a containment test added; the CAUTIONARY branch removed; banker's rounding; commentary
words not distinct; the skipped list; the pillar order; an information field made required; the ratio decimals ignored).
The first pass killed 36 and one survived (the span removed from the required fields): the test read the required list
from the evaluator itself, so removing a field removed the test too. The test now holds its own copy of the list from
spec §3, and the pass is **37 of 37 killed**.

**Independent mutation pass (task P6, a fresh session, scratch copy).** An AST-based tool (comparison, boolean and arithmetic
operators, constants, field-name and M5/M15 swaps, call unwrapping, branch tests, statement deletion, iteration order, rounding mode,
the decorator) made 382 mutants of the evaluator. 340 were killed, 4 died at import and 38 survived. 32 of the survivors were equivalent
and one was a real gap (F2: the rounding helper returned 1.0 for a zero statistic, and no test used a zero). After the fixes the same
tool made 403 mutants: 355 killed, 4 died at import, 44 survive, none a gap in what the tests check: 11 change only an iteration or
literal order that no envelope shows, 3 are dead initialisers, 7 are no-op wrappers (`bool`, `list`, `float`, and the exponent of
`Decimal(1)`), 18 rename a diagnostic key of a stopped pre-flight that is never written to an envelope, and 5 are the defensive `int()`
normalisations of a float `window_span_bars` and of the decimals parameters (no test feeds a float; real data are integers, so low).
A second pass over the parameter and registry files made 92 mutants: 85 killed; the 7 survivors are prose or paths (the registry `name`,
`spec` and `params`, and the four `meaning` sentences). Other P6 evidence: a differential test of 150,000 random cycles against an
independent implementation of spec §6 (no mismatch), a fuzz of about 23,000 corrupted bundles and 300 corrupted parameter sets (nothing raised; the only schema-breaking envelopes from a bundle were F1), identical output across four `PYTHONHASHSEED` values, and a run of the three fixtures with file, network, clock,
randomness, environment and `print` trapped (nothing tripped).

## 4. Legacy baseline and equivalence table (steps R1, R7)

Not applicable. MCD0 is a new MCD: there is no pre-retrofit evaluator, so no `legacy/` and no equivalence table. The old
4-Quadrant gate of file C was a design, not code.

## 5. Real readings and fixtures

Three slots, built with the kit's provider from the frozen workbooks (never regenerated): v1 `2026-09-18T20:55Z` (M5
`best_fit_a`, M15 `non_b`), v3 `2026-09-28T14:15Z` (`cherry_a`, `non_b`) and v4 `2026-09-28T23:15Z` (`cherry_a`, `non_b`).
Each bundle keeps one closed bar per timeframe (the shared T4 needs one to copy) and the statistics rows of the slot.
`FixtureProvenanceTests` checks each workbook's SHA-256 and that the stored bundles equal what the provider builds.

The eight real readings (`RealCycleTests.test_the_eight_real_readings`), all VALID. The first three are the stored bundles
as they are; the others replace a setting in memory (M15 `non_a` is populated on v3 and v4; the fractal EDT on M5 on all
three). Coverage is in closed bars.

| Slot · settings (M5 / M15)       | M5: failed (skipped)                           | M5 coverage · geo | M15: failed (skipped)     | M15 coverage · geo | State                |
| -------------------------------- | ---------------------------------------------- | ----------------- | ------------------------- | ------------------ | -------------------- |
| v1 · `best_fit_a` / `non_b`      | R2_A, R2_B, FIT_A, FIT_B                       | 754 · 1.0000      | R2_A, FIT_A, FIT_B        | 1807 · 0.7425      | `MCD0_M5_M15_DEFECT` |
| v3 · `cherry_a` / `non_b`        | R2_A, R2_B                                     | 1037 · 0.8353     | R2_A, R2_B                | 1528 · 0.7524      | `MCD0_M5_M15_DEFECT` |
| v4 · `cherry_a` / `non_b`        | R2_A                                           | 1133 · 1.0761     | R2_A, R2_B                | 2034 · 0.8478      | `MCD0_M5_M15_DEFECT` |
| v3 · `cherry_a` / `non_a`        | R2_A, R2_B                                     | 1037 · 0.8353     | none                      | 487 · 1.4351       | `MCD0_M5_DEFECT`     |
| v4 · `cherry_a` / `non_a` (flat) | R2_A                                           | 1133 · 1.0761     | none (skipped R2_A, R2_B) | 967 · 1.3097       | `MCD0_M5_DEFECT`     |
| v1 · `fractal` / `non_b`         | R2_B, FIT_B, GEO (skipped R2_A, FIT_A, SKEW_A) | 335 · 0.5000      | R2_A, FIT_A, FIT_B        | 1807 · 0.7425      | `MCD0_M5_M15_DEFECT` |
| v3 · `fractal` / `non_a`         | GEO (skipped as above)                         | 313 · 0.5961      | none                      | 487 · 1.4351       | `MCD0_M5_DEFECT`     |
| v4 · `fractal` / `non_a` (flat)  | GEO (skipped as above)                         | 409 · 0.5961      | none (skipped R2_A, R2_B) | 967 · 1.3097       | `MCD0_M5_DEFECT`     |

No real M5 channel qualifies (a centroid misses R²; the fractal EDT misses the geo ratio on all three slots), so
`MCD0_ALL_QUALIFIED` and `MCD0_M15_DEFECT` are tested with synthetic bundles only (`StateTests`). The values closest to a
bound on the real rows are stated and tested (`RealCycleTests.test_the_boundary_close_real_values_decide_as_stated`): v4
M5 `cherry_a` R² A 0.6876 against 0.70 (fails), v4 M15 `non_b` fit ratio B 1.5058 against 1.50 (passes), v1 M15 `non_b`
R² B 0.6550 against 0.65 (passes). If this flag rate holds on live data, most channel readings would be CAUTIONARY; the
shadow period (stage 4) must measure it before any MCD goes live (walkthrough Part 0 item 3).

## 6. Envelope size and time (step R8)

Tokens are `o200k_base` (exact); time is the slowest of 20 runs.

| Envelope                                                                                                             | State                | Tokens  |
| -------------------------------------------------------------------------------------------------------------------- | -------------------- | ------- |
| **Worst case:** every pillar failed on both timeframes, the longest setting names, long numbers, 64-character hashes | `MCD0_M5_M15_DEFECT` | **546** |
| The same with RETUNING (CAUTIONARY)                                                                                  | `MCD0_M5_M15_DEFECT` | **552** |
| v1 (`mcd0_output.json`)                                                                                              | `MCD0_M5_M15_DEFECT` | 488     |
| v4                                                                                                                   | `MCD0_M5_M15_DEFECT` | 480     |
| v3                                                                                                                   | `MCD0_M5_M15_DEFECT` | 466     |
| Synthetic, both qualified                                                                                            | `MCD0_ALL_QUALIFIED` | 368     |

The largest envelope in the tests is 552 tokens (budget 600, margin 48 for those inputs; the realistic margin is 20 to 30 tokens, see below); one evaluation of the worst case takes under 1 ms (budget 1 s).
The first layout (a per-timeframe verdict, the source and the angle in `details`, the model named in commentary) measured
660 tokens worst case and was replaced before any code was written (spec question Q5, approved). `mcd0_output.json` is the
v1 envelope: VALID, `MCD0_M5_M15_DEFECT`, NEUTRAL, no level, summary "M5 and M15 channel fits each miss a criterion",
commentary "The M5 channel (best_fit_a) misses fit criteria: R2, fit ratio. The M15 channel (non_b) misses fit criteria:
R2, fit ratio." Fixtures are frozen: a workbook is never regenerated in place.

**Realistic ceiling (task P6).** The test's worst case uses `best_fit_a` and `most_recent`; other setting names tokenise longer
(`cherry_b` with `cherry_a` adds about 12 tokens), 64-character hashes vary by a few tokens, and each integer digit of a statistic
beyond three costs a fraction of a token. With realistic statistics (up to four integer digits) the largest envelope P6 found is
**570 to 580 tokens, a margin of 20 to 30 tokens**; six-digit statistics reach 593 and 600 is crossed only with seven-digit
statistics. A22 holds, but the margin is thinner than the 48 above: a change that adds a `details` field must re-measure.

## 7. Standard Appendix A

| #   | Check                                                                             | Status                  | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --- | --------------------------------------------------------------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | Spec has all 14 sections and is approved by Davin                                 | Pass                    | `mcd0.md` §1 to §14; approved 1 Oct 2026 (§9 of this manifest)                                                                                                                                                                                                                                                                                                                                                                     |
| A2  | Implementation plan approved before coding                                        | Pass                    | `mcd0_implementation_plan.md`; approved 1 Oct 2026, before P5 started                                                                                                                                                                                                                                                                                                                                                              |
| A3  | Reads only the input bundle; no database, file, network, clock, randomness, model | Pass                    | `PurityTests` (imports allowed list: standard library, `decimal`, `math`, four kit modules; no file, clock, randomness, environment or print names)                                                                                                                                                                                                                                                                                |
| A4  | Closed bars only; forming bar and last price never used                           | Pass                    | MCD0 reads no bar: `PurityTests.test_the_evaluator_reads_no_bar`, `DecisionTests.test_g_the_bars_are_not_read` (absent, junk, null and many bars change nothing), `_Shared.test_t4_forming_bar_is_ignored` on five bundles; the kit drops live-bar and last-price fields                                                                                                                                                           |
| A5  | Statistics by slot and active source; no match is STALE                           | Pass                    | `_Shared.test_t5_wrong_slot_statistics_are_stale` (five bundles, both timeframes); `PreflightTests.test_no_statistics_row_at_the_slot_on_either_timeframe`, `test_a_row_from_another_slot_is_stale`                                                                                                                                                                                                                                |
| A6  | Active indicator from the setting; mismatch is CAUTIONARY                         | Pass, adapted           | The setting decides: `_Shared.test_t6_*` (overridden: the no-setting half on both timeframes), `PreflightTests.test_no_setting_for_either_timeframe`, `test_a_setting_that_is_not_a_candidate_of_the_timeframe`. By decision (g) MCD0 reads no bar, so there is no `DETECTION_MISMATCH` here (the channel MCDs keep it): `DecisionTests.test_g_tier_1_is_the_setting_only...`                                                      |
| A7  | Output validates against `mcd-output/1`; no extra top-level field                 | Pass                    | `OutputTests.test_t8_*`, `_Shared.test_t8_schema`, every `StateTests` and `PreflightTests` assertion calls `schema_errors`; with a bad `config_hash`: `PreflightTests.test_a_config_hash_that_is_not_a_string_is_sanity_failed_and_never_reaches_the_envelope` (P6 F1)                                                                                                                                                             |
| A8  | Pre-flight order cycle, 1, 4, 2, 3; reason codes from Appendix D                  | Pass                    | `PreflightTests.test_the_order_of_the_checks` (cycle before tier 1, tier 1 before tier 4, tier 4 before tier 3 across both timeframes), `test_the_reason_codes_mcd0_never_emits`; the envelope builders reject any code outside Appendix D. Tier 2 does not exist (no bars)                                                                                                                                                        |
| A9  | Never throws; errors become INVALID + `EVALUATOR_ERROR`                           | Pass                    | `_Shared.test_t10_corrupted_bundle_never_throws` (six corruptions, five bundles; the three bar corruptions are skipped because MCD0 reads no bar); `PreflightTests.test_t10_an_error_inside_the_evaluator_becomes_evaluator_error`; for a corrupted `config_hash` (P6 F1): `PreflightTests.test_a_config_hash_that_is_not_a_mapping_is_sanity_failed`, `test_a_bad_config_hash_is_dropped_when_an_earlier_check_stops_the_reading` |
| A10 | State register exhaustive and exclusive; codes follow §7.1                        | Pass                    | `RegisterTests` (four states = the pair of verdicts), `StateTests.test_a_sweep_agrees_with_an_independent_classifier`; longest code 18 characters                                                                                                                                                                                                                                                                                  |
| A11 | Bias per state; gates NEUTRAL; null when INVALID or STALE                         | Pass                    | `RegisterTests.test_the_register_is_exhaustive_and_exclusive_and_every_bias_is_neutral`; `PreflightTests.assert_unavailable` (state, bias, levels, details empty)                                                                                                                                                                                                                                                                  |
| A12 | No banned words, probabilities or unmeasured numbers                              | Pass                    | `OutputTests.test_t11_*` (codes, templates, rendered summaries and commentary, meanings, pillar words); the file C wording is rejected by the same check                                                                                                                                                                                                                                                                           |
| A13 | Summary ≤ 80 characters, no prices; commentary from templates                     | Pass                    | T11 summary check (longest summary 48 characters); `StateTests` compare each commentary with its literal output                                                                                                                                                                                                                                                                                                                    |
| A14 | Levels named, per timeframe, 2 decimals; zone width defined                       | Not applicable          | A gate contributes no level (`levels: []` in every state, `StateTests`); spec §8                                                                                                                                                                                                                                                                                                                                                   |
| A15 | `depends_on` complete; a derived MCD modifies, does not re-vote                   | Not applicable          | A gate: `depends_on` is `[]` (`StateTests`); T14 is for derived MCDs                                                                                                                                                                                                                                                                                                                                                               |
| A16 | `uses_channel` declared if it is a channel MCD                                    | Pass                    | MCD0 is a gate, not a channel MCD: `mcd0_registry.yaml` `uses_channel: []`; the worker marks the channel MCDs through their own `uses_channel` (standard §9.2). `RegisterTests.test_registry_and_params_describe_this_evaluator`                                                                                                                                                                                                   |
| A17 | Precedence rung proposed; rule rows proposed (not applied)                        | Pass                    | Spec §9: a gate has an empty rung (`rung: {}`) and proposes no rule row; confirmed by Davin (Q4)                                                                                                                                                                                                                                                                                                                                   |
| A18 | Dispatch-matrix intents, tags, playbook and foundations chunks ready              | Pending, stage 6        | The content is listed in spec §10 (Explain only, decided by Davin); the files need the knowledge build (architecture §4.6)                                                                                                                                                                                                                                                                                                         |
| A19 | Reason texts and new glossary terms in all 16 languages                           | Pending, stage 6        | Reason codes MCD0 can emit, and the two flags it causes, are listed in spec §10                                                                                                                                                                                                                                                                                                                                                    |
| A20 | Parameters in `mcdN_params.yaml` with rationale                                   | Pass                    | `mcd0_params.yaml` loads through `Params.from_yaml` (the kit refuses a parameter without value, unit, boundary and why); `RegisterTests.test_every_threshold_of_spec_section_6_is_in_the_parameters_once_with_the_same_value` (twelve parameters)                                                                                                                                                                                  |
| A21 | Tests T1 to T14 pass (T14 for derived MCDs)                                       | Pass                    | 124 OK; T14 not applicable                                                                                                                                                                                                                                                                                                                                                                                                         |
| A22 | Envelope ≤ 600 tokens; evaluation ≤ 1 s                                           | Pass                    | `OutputTests.test_t12_the_largest_envelope_is_within_600_tokens` (worst case 546, with RETUNING 552, `o200k_base`), `test_r15_*`, `_Shared.test_t12_size_and_r15_time` (five bundles); §6 above (P6: realistic ceiling 570 to 580 tokens, margin 20 to 30)                                                                                                                                                                         |
| A23 | Shadow period passed; point-in-time replay done; statistics stored                | Pending, stages 4 and 5 | Needs the sensor worker and `market_data_point_in_time`. MCD0's flag rate is the first thing to measure                                                                                                                                                                                                                                                                                                                            |
| A24 | Added to golden scenarios and the labelled question set                           | Pending, stages 4 to 7  | Needs synthesis and the knowledge build                                                                                                                                                                                                                                                                                                                                                                                            |
| A25 | Registry row added to the architecture; decision entry written                    | Pending, stage 7        | Row exists, status `Draft (1.0.0)`; the decision entry is written at go-live                                                                                                                                                                                                                                                                                                                                                       |
| A26 | Folder matches §11.1: same file names, `concept.md` confirmed, nothing extra      | Pass                    | `PurityTests.test_the_folder_matches_the_standard_layout` (no `legacy/`: a new MCD; no `concept/`: there is no board); `concept.md` confirmed by Davin 1 Oct 2026; `__pycache__/` is git-ignored                                                                                                                                                                                                                                   |

## 8. Open questions

None for the build. Carried forward:

- **Statistics fit windows and the forming bar** (`.claude/state/waiting-on.md`, MCD kit item): R², MSE, skew and the
  offsets, which MCD0 reads, may be fitted with the still-open bar. `window_span_bars` includes it (the schema says "to the
  live bar, inclusive"), which coverage subtracts. Settle it before certification (stage 5).
- **Flag rate:** the thresholds flag every real channel under the fixture settings (§5). The shadow period measures it;
  a threshold changes only by a new decision entry and a MINOR version (standard §14). The Prisma schema notes that a low
  or negative Model B R² is structurally expected for lines fitted to centroids or touches and "not by itself a fault".
- **Envelope margin:** 48 tokens under the budget in the tests' worst case, **20 to 30 tokens for realistic inputs** (P6, §6). A longer setting name or a larger count of digits in
  a real statistic uses part of it; `OutputTests.test_t12_*` fails over 600.
- **Two states are synthetic only:** `MCD0_ALL_QUALIFIED` and `MCD0_M15_DEFECT`. No replica holds a qualifying real M5
  channel.
- **A copy of one helper:** the half-up rounding function now exists in MCD0, MCD1, MCD2 and MCD3 (a kit change for Davin
  to schedule, as for the T_EDT helper).

- **Kit hardening, `config_hash` (P6 finding F1):** `reading_context` in `mcd_common/envelope.py` copies the bundle's hash into the
  envelope without a type check, and the shared T10 corruptions never touch `config_hash`, so MCD1 to MCD3 still pass a non-string
  hash into a VALID envelope that breaks the schema (checked on MCD2). MCD0 guards it itself; the kit change and a `config_hash` case
  for the shared T10 are listed in `.claude/state/waiting-on.md` for Davin to schedule.
- **Parameter file with a non-finite value (P6, very low):** `Params.from_yaml` accepts `.inf` (checked with
  `t_edt_open_bar_rows: .inf`), which would give a non-finite `coverage`. The parameters are version-pinned and approved by Davin, so
  this is not a bundle corruption; listed with the `config_hash` item in `.claude/state/waiting-on.md`.
- **Untested defensive code (P6, low):** the `int()` normalisations of a float `window_span_bars` and of the decimals parameters
  (`mcd0_evaluator.py`, the `coverage` and `ratio_decimals` lines). Nothing in real data exercises them.

## 9. Decisions Davin made during the work

| Date       | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-30 | D3: tier-1 meaning (the kit's helper). MCD0 uses only its setting half (decision (g))                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 2026-10-01 | D4: English. ADR-083 settled and Q1 to Q5 of the MCD2 and MCD1 2.0.1 patch approved as built (the `t_edt_open_bar_rows` parameter MCD0 reuses)                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2026-10-01 | Concept confirmed. Decisions (a) to (k): coverage in closed bars (`window_span_bars − t_edt_open_bar_rows`, at least 60); each model's own MSE; keep the geo gate; skip R² when \|angle\| ≤ 5.0°; Model A not applicable for the fractal EDT, by source name; variance ratio and kurtosis as values; tier 1 is the setting only; one status for the whole envelope; sanity checks on MSE, offsets and non-numbers, Model A required for centroids only; no containment test; commit only after P5 is verified, without `package.json` and `pnpm-lock.yaml`                                                          |
| 2026-10-01 | Specification, registry, parameters and plan approved. Q1 `last_closed_bar` `{}`; Q2 each model's own skew; Q3 variance ratio and kurtosis optional (`null` when missing, never a failure); Q4 empty rung and no rule rows; Q5 the trimmed envelope (555 tokens estimated, 546 measured on the built evaluator). Routing: Explain only. Architecture §2.13 MCD0 `To build` to `Draft`                                                                                                                                                                                                                               |
| 2026-10-01 | Task P6 for MCD0 (fresh session) found no failing line of A1 to A26 except A7 and A9 for a non-string `config_hash` (F1, the root cause in the shared kit) and one test gap under A21 (F2, a zero statistic). Davin granted the **stage-3 sign-off** and asked for both to be closed in MCD0: F1 by a tier-3 check (`config_hash[source]` must be a string when present, else INVALID + `SANITY_FAILED`) and by keeping only string hashes in the envelope, with a test; F2 by a test that an exact 0.0 is reported as 0.0; the kit hardening to go to `waiting-on.md`; and the commit by explicit path, not pushed |
| 2026-10-01 | Builder note on F1: a `config_hash` that is not a mapping at all is also INVALID + `SANITY_FAILED` (the same defect class; before, it gave a VALID reading with an empty `config_hash`, and `source in hashes` on a non-mapping would have raised). It is one line and one test; Davin can revert it. The evaluator stays at 1.0.0 (never live, no fixture output changes; standard §14)                                                                                                                                                                                                                            |
