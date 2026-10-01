# MCD0 implementation plan: new gate MCD, evaluator 1.0.0

Status: Approved (Davin, 1 October 2026, together with `mcd0.md`); built in task P5; checked by task P6; **stage 3 signed off by Davin on 1 October 2026** (§9) · Next: stages 4 to 7, which wait for the sensor worker, synthesis and the knowledge build · Follows:
[standard](../../../docs/MCD-DEVELOPMENT-STANDARD.md),
[walkthrough Part C4 and Part D stage 3](../../../docs/MCD-RETROFIT-AND-CREATION-WALKTHROUGH.md)

This plan is stage 2 step 4 of task P4. It lists what P5 builds, the tests that prove each rule, the fixtures and the
expected reading of each. Nothing in P4 touched code, tests or the manifest: MCD0 has no evaluator yet.

## 1. What is built

MCD0 is new (no `legacy/`, no equivalence table). The table lists each piece against the rule it comes from.

| #   | Area               | What P5 builds                                                                                                                                                                       | Source                          |
| --- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------- |
| 1   | Interface          | `evaluate(inputs, params, upstream) -> Envelope` on a `CycleInputs`; reads no bar; wrapped in `envelope.never_throws("MCD0", "1.0.0")`                                               | R4, R7, standard §11.2          |
| 2   | Tier 1             | Setting present for M5 and M15 and a candidate of that timeframe; INVALID + `NO_SETTING`. No detection cross-check, no `populated_candidates`                                        | Decision (g), rule 6            |
| 3   | Tier 4             | The kit's `statistics_check(["M5", "M15"])` with no containment floor; STALE + `NO_STATS_AT_SLOT`                                                                                    | R2, rule 5, decision (j)        |
| 4   | Tier 3             | Own check on the statistics rows: required fields are numbers (by source name), offsets of the right sign, width and each used MSE above 0; INVALID + `SANITY_FAILED`                | Decision (i), concept (C4)      |
| 5   | Pillars            | Eight pillars (`mcd0.md` §6) on unrounded values, inclusive bounds; coverage in closed bars; each model's own MSE and skew; flat skip; Model A not applicable for `fractal_edt`      | Decisions (a) to (e), Q2        |
| 6   | Verdict and state  | Non-compensatory timeframe verdict; the four-state table; bias NEUTRAL; no level; no regime word                                                                                     | Concept R6 to R8, standard §7.2 |
| 7   | Information fields | Variance ratio and kurtosis in `details` as values; `null` when missing, never a failure                                                                                             | Decision (f), Q3                |
| 8   | One status         | The first failing check decides for the whole envelope; both timeframes pass a check before the next one runs, M5 then M15                                                           | Decision (h), standard §6       |
| 9   | Output             | Envelope `mcd-output/1`; `details` per spec §11 (per timeframe: `failed`, `skipped`, `coverage`, `geo_ratio`, `model_a`, `model_b`); `last_closed_bar` `{}` (Q1); no wall-clock time | ADR-017, R5, R4, Q5             |
| 10  | Constants          | In `mcd0_params.yaml` (twelve parameters); the register, the pillar words and the templates in `mcd0_registry.yaml`                                                                  | R3, standard §11.2              |
| 11  | Wording            | Four summary lines S01 to S04 (≤ 80 characters, no prices) and four templates T01 to T04, fit description only                                                                       | Standard §7.4, R9, R11          |

Not built (stage 4 to 7, no sensor worker yet): the worker's `MCD0_DEFECT_<TF>` marking of the channel MCDs, the shadow
period, the point-in-time replay, the dispatch-matrix row, the playbook and foundations chunks, the 16-language texts.

## 2. Decisions

| Item          | Status                                                                                                                                                                                                                                                                    |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D3            | **Settled** (Davin, 30 Sep 2026), built into the kit. MCD0 uses only its setting half (decision (g))                                                                                                                                                                      |
| D4            | **Settled**: English                                                                                                                                                                                                                                                      |
| D8 (a) to (f) | **Answered** (Davin, 1 Oct 2026): `window_span_bars` in closed bars (minus `t_edt_open_bar_rows` = 1), at least 60; each model's own MSE; keep the geo gate; skip R² when \|θ\| ≤ 5.0°; Model A not applicable for the fractal EDT; variance ratio and kurtosis as values |
| (g) to (j)    | **Answered** (Davin, 1 Oct 2026): tier 1 is the setting only; one status for the whole envelope; sanity checks on MSE ≤ 0, `uoedt_offset` ≤ 0, `loedt_offset` ≥ 0 and non-numbers, Model A required for centroids only; no containment test                               |
| (k)           | **Answered**: no commit until P5 is built and verified; `package.json` and `pnpm-lock.yaml` stay out                                                                                                                                                                      |
| Q1 to Q5      | **For Davin's approval** (`mcd0.md` §14): `last_closed_bar` empty; each model's own skew; information fields never required; empty rung and no rule rows; the trimmed `details` and criterion-level commentary that fit the 600-token budget                              |

## 3. Tests (T1 to T13; T14 does not apply)

`test_mcd0_unit_tests.py` is written on the kit: bundles built in memory from the stored v1 bundle for synthetic cases
(each case changes only statistics rows, settings or status), the stored fixtures for real ones, and the
`SharedSensorChecks` mixin for the shared checks.

| Standard test        | MCD0 cases                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T1                   | Four tests, one per state, checking `state_code`, `bias` NEUTRAL, `regime_status` null, empty `levels`, empty `depends_on`, each timeframe's `failed` (empty or not), summary and the template rendered (criterion words, distinct, in `pillar_order`). `MCD0_ALL_QUALIFIED` and `MCD0_M15_DEFECT` are synthetic; `MCD0_M5_DEFECT` and `MCD0_M5_M15_DEFECT` also have real readings (§5)                                                                                                                                                                                                                                                                                                                |
| T2                   | Coverage `window_span_bars` 59 / 60 / 61 / 62 (closed 58 / 59 / 60 / 61: the bound is 60 closed) and `t_edt_open_bar_rows` 0 and 2 moving it; R² A 0.6999 / 0.70 / 0.7001, R² B 0.6499 / 0.65 / 0.6501; fit ratio exactly 1.5 and 3.2 (built from W = 6, MSE = 4 and W = 32, MSE = 25) and a hair inside and outside, for each model with its own MSE (a case where A passes and B fails on the same row); geo ratio exactly 0.6 (3 ÷ 5) and 1.65 (33 ÷ 20) and a hair outside; \|skew\| 1.49 / 1.5 / 1.51 per model; \|θ\| −5.01 / −5.0 / 5.0 / 5.01 (R² skipped at and inside 5.0, applied beyond); MSE, `uoedt_offset`, `loedt_offset`, `channel_width` at 0 and just beyond                         |
| T3                   | One test per pre-flight failure: unknown `data_status` (INVALID + `SANITY_FAILED`), `DATA_STALE`, `RETUNING` (CAUTIONARY, the state kept), `NO_SETTING` (missing, and not a candidate: M15 set to `fractal`), `NO_STATS_AT_SLOT` (M5 and M15), `SANITY_FAILED` (each required field null, a string, `True`, NaN, infinity; MSE ≤ 0 for each model; wrong-signed offsets; width ≤ 0; Model A missing on a centroid), `EVALUATOR_ERROR`. The order: tier 4 before tier 3 (M15 STALE beats M5 INVALID), cycle before all, M5 before M15 inside a tier. The reason codes MCD0 never emits (`INSUFFICIENT_BARS`, `DISCONTINUITY`, `CONTAINMENT_LOW`, `DETECTION_MISMATCH`) are asserted absent in every case |
| Decisions            | (d): flat skip and its boundary, a flat channel with all other pillars good qualifies, a flat channel with a bad fit still fails the fit pillar. (e): the fractal EDT is judged on Model B, coverage and geo ratio; Model A values present on a fractal row are not read; a centroid with null Model A fields is `SANITY_FAILED`. (f): information fields null or a string give `null` in `details` and the same state. (g): bars absent, corrupt or too few change nothing; a setting that names an unpopulated candidate gives STALE + `NO_STATS_AT_SLOT` and never `DETECTION_MISMATCH`. (j): containment 10 reads normally. (a): coverage counts closed bars                                        |
| T4 to T8, T10 to T12 | The kit's shared checks (§3.1): forming bar changes nothing, statistics from another slot give STALE on each timeframe, setting (the no-setting half), determinism, schema, corrupted bundle (three bar corruptions skipped), wording (codes, templates, rendered summaries and commentary), size on the worst case (every pillar failed on both timeframes, centroid sources) and the time limit                                                                                                                                                                                                                                                                                                       |
| T9                   | Replay: each stored `<slot>.inputs.json` reproduces its `<slot>.envelope.json` byte for byte (three slots)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| T13                  | The real readings of §5, each with its expected state, `failed`, `skipped`, `coverage`, `geo_ratio` and per-model values                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

Also, as in MCD1 to MCD3: purity tests (the evaluator imports only the standard library and the kit; no file, clock,
randomness, print, openpyxl, environment or network), the folder-layout test (A26: `concept.md`, `mcd0.md`, plan,
registry, parameters, evaluator, tests, `fixtures/`, `mcd0_output.json`, manifest; no `legacy/` and no `concept/` by
design), parameters against spec §6 (every name once, equal values), registry against spec §7 (four states, templates
and summaries equal), and a test that no register word or template contains a banned word.

### 3.1 How the shared checks apply to a gate that reads no bars

The kit foresees a bar-less gate (`run_preflight`: "MCD0 reads no bars"; `check_never_throws(skip=…)`). The kit is not
changed; the test class overrides two methods of the mixin.

| Shared check | Use in MCD0                                                                                                                                                                                                                                                                              |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T4           | The bundle keeps one closed bar per timeframe (the check needs one to copy). Appending a forming bar changes nothing: true because MCD0 reads no bar, and the check still runs                                                                                                           |
| T5           | Unchanged, on both timeframes                                                                                                                                                                                                                                                            |
| T6           | The mixin method is overridden: the no-setting half runs for M5 and M15 (INVALID + `NO_SETTING`); the mismatch half is replaced by the (g) test above (a setting that names an unpopulated candidate gives STALE, no `DETECTION_MISMATCH`)                                               |
| T10          | The mixin method is overridden to call `check_never_throws(sensor, skip=("bars is None", "bar rows are strings", "last bar numbers are strings"))`: MCD0 reads no bar, so these three give a normal reading. The six other corruptions must end INVALID or STALE with an Appendix D code |
| T7, T8, T12  | Unchanged (T12 adds the worst-case envelope of the size test)                                                                                                                                                                                                                            |

## 4. Files P5 will create or change (in `engine-1-5-new/mcd0/` unless stated)

| File                                    | Action                                                                                                                                 |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `mcd0_evaluator.py`                     | New (R5): imports only the standard library and `mcd_common`                                                                           |
| `test_mcd0_unit_tests.py`               | New (R6)                                                                                                                               |
| `mcd0_output.json`                      | From the v1 slot                                                                                                                       |
| `fixtures/`                             | New: per slot `.inputs.json`, `.envelope.json`, `.source.md` (v1, v3, v4: nine files)                                                  |
| `mcd0-manifest-work-completion.md`      | New: Appendix A checklist, files, test results, real-cycle envelopes, decisions of Davin; A18, A19, A23, A24, A25 "pending, stage 4–7" |
| `../../../docs/STACK-D-ARCHITECTURE.md` | §2.13 MCD0 row: `To build` to `Draft` (done when Davin approves this plan, before P5), then note version 1.0.0 built                   |
| `../../../docs/handoffs/`               | Hand-off report                                                                                                                        |

Evaluator outline: `run_preflight(inputs, cycle=cycle_check(), tier1=_tier1, tier4=statistics_check(["M5", "M15"]),
tier3=_tier3(params))`, with no `tier2` and no `upstream`. A stopped outcome goes to `envelope.unavailable` with an empty
`details`. Otherwise `_judge(row, source, params)` returns the verdict, `failed`, `skipped` and the values for each
timeframe, the state is chosen from the pair, a template is filled, and `valid(...)` (or `cautionary(...)` when the
outcome carries RETUNING) is returned with `last_closed_bar={}`, `active_indicator` and `config_hash` from
`reading_context(inputs, ["M5", "M15"])` (its `last_closed_bar` is replaced by `{}`). No file, clock, randomness, print or
openpyxl.

## 5. Fixtures and expected readings

Three slots, built with the kit's provider from the frozen workbooks (never regenerated): v1 `2026-09-18T20:55Z`
(settings M5 `best_fit_a`, M15 `non_b`), v3 `2026-09-28T14:15Z` (`cherry_a`, `non_b`) and v4 `2026-09-28T23:15Z`
(`cherry_a`, `non_b`). Each bundle keeps one closed bar per timeframe and the `close` column (`max_bars` 1,
`columns=("close",)`), so the bundle is the statistics rows of the slot. Settings files exist
(`mcd_common/fixtures/settings_v1.yaml`, `settings_v3.yaml`, `settings_v4.yaml`); a re-set (M15 `non_a`, M5 `fractal`) is
the same bundle with the setting replaced in memory. Computed here from the stored bundles of MCD2 and MCD3 with the
decisions applied (exploration, not yet a test; values rounded to the output decimals):

| Slot · settings (M5 / M15)       | M5 verdict · failed                                     | M5 coverage · geo | M15 verdict · failed                 | M15 coverage · geo | Expected state       |
| -------------------------------- | ------------------------------------------------------- | ----------------- | ------------------------------------ | ------------------ | -------------------- |
| v1 · `best_fit_a` / `non_b`      | DEFECT · R2_A, R2_B, FIT_A, FIT_B                       | 754 · 1.0000      | DEFECT · R2_A, FIT_A, FIT_B          | 1807 · 0.7425      | `MCD0_M5_M15_DEFECT` |
| v3 · `cherry_a` / `non_b`        | DEFECT · R2_A, R2_B                                     | 1037 · 0.8353     | DEFECT · R2_A, R2_B                  | 1528 · 0.7524      | `MCD0_M5_M15_DEFECT` |
| v4 · `cherry_a` / `non_b`        | DEFECT · R2_A                                           | 1133 · 1.0761     | DEFECT · R2_A, R2_B                  | 2034 · 0.8478      | `MCD0_M5_M15_DEFECT` |
| v3 · `cherry_a` / `non_a`        | DEFECT · R2_A, R2_B                                     | 1037 · 0.8353     | QUALIFIED · none                     | 487 · 1.4351       | `MCD0_M5_DEFECT`     |
| v4 · `cherry_a` / `non_a` (flat) | DEFECT · R2_A                                           | 1133 · 1.0761     | QUALIFIED · none, skipped R2_A, R2_B | 967 · 1.3097       | `MCD0_M5_DEFECT`     |
| v1 · `fractal` / `non_b`         | DEFECT · R2_B, FIT_B, GEO (skipped R2_A, FIT_A, SKEW_A) | 335 · 0.5000      | DEFECT · R2_A, FIT_A, FIT_B          | 1807 · 0.7425      | `MCD0_M5_M15_DEFECT` |
| v3 · `fractal` / `non_a`         | DEFECT · GEO (skipped as above)                         | 313 · 0.5961      | QUALIFIED · none                     | 487 · 1.4351       | `MCD0_M5_DEFECT`     |
| v4 · `fractal` / `non_a` (flat)  | DEFECT · GEO (skipped as above)                         | 409 · 0.5961      | QUALIFIED · none, skipped R2_A, R2_B | 967 · 1.3097       | `MCD0_M5_DEFECT`     |

All eight are VALID. Two facts follow: no real M5 channel qualifies (a centroid misses R²; the fractal EDT misses the geo
ratio on all three slots, with R² 0.8344 and 0.8866 passing on v3 and v4), so `MCD0_ALL_QUALIFIED` and `MCD0_M15_DEFECT`
are tested with synthetic bundles; and the boundary-close real values are v4 M5 `cherry_a` R² A 0.6876 against 0.70, v4
M15 `non_b` fit ratio B 1.5058 against 1.50 and v1 M15 `non_b` R² B 0.6550 against 0.65.

## 6. What the plan does not decide

- No legacy baseline (step R1) and no equivalence table (step R7): MCD0 is new, so the manifest has neither.
- The shadow-period flag rate is stage 4. The thresholds are starting values; the plan changes none.
- **Envelope size, measured in P4** with the kit's counter (`o200k_base`) on hand-built envelopes, because the first
  design did not fit: with a per-timeframe verdict, the source and the angle in `details` and the model named in
  commentary, every pillar failed on both timeframes is **660 tokens** (the real v1 reading 582), over the 600 budget
  (the two `config_hash` entries alone are about 90 tokens, the skeleton about 230). The design in `mcd0.md` drops the
  verdict (it is `failed` being non-empty), the source (it is in `active_indicator`) and the angle (it is shown by
  `skipped`), and names the criterion, not the model, in commentary: **555 tokens valid, 561 with RETUNING**, a margin of
  about 40. Spec question Q5 asks Davin to confirm. P5 measures the built evaluator (T12); if it lands above 600, the plan
  stops and reports it rather than loosening the budget silently.

## 7. Records and follow-ups

- Part F: when Davin approves this plan, the architecture §2.13 MCD0 row goes from `To build` to `Draft` (spec link to
  `engine-1-5-new/mcd0/mcd0.md`). Stage 3 leaves it `Draft`; nothing goes live (flag `off`). No decision entry is needed
  for stage 3 (the thresholds are settled in ADR-019 and architecture §2.4; a change later is a decision entry).
- `tags.yaml` (architecture §4.6) does not exist yet. MCD0's id and four state codes are listed in `mcd0.md` §10 for build
  step 6.
- The standard's A18, A19, A23, A24 and A25 are marked "pending, stage 4–7" in the manifest. A14 (levels) and A15
  (`depends_on`) are "not applicable: a gate with no level and no upstream", A16 is "a gate: `uses_channel: []`", A17 is
  "no rung, no rule row" (Q4).
- Inherited and unverified: the statistics' fit windows may include the still-open bar (`.claude/state/waiting-on.md`).
  MCD0 reads R², MSE, skew and the offsets from those fits, so it must be settled before certification, not before P5.
- Commit timing (decision (k)): no commit until P5 is built and verified; `package.json` and `pnpm-lock.yaml` are
  excluded.

## 8. P5 is done when

- All tests T1 to T13 pass from `engine-1-5-new/` (`python -m unittest discover -s mcd0 -t .` plus the kit's suite and the
  MCD1, MCD2, MCD3 and legacy suites still green).
- `mcd0_output.json` and the fixture envelopes validate against `mcd-output/1`; the largest envelope is ≤ 600 tokens; one
  evaluation ≤ 1 s.
- The eight real readings of §5 give the expected states; the verdict logic survives a mutation pass (each mutant of a
  bound, a comparison, the skip rule, the closed-bar subtraction and the order of checks is killed by a test).
- The evaluator imports only the standard library, the kit and pure maths; no file, clock, randomness, print or openpyxl.
- The manifest carries Appendix A with evidence; the architecture §2.13 row notes 1.0.0 built; a hand-off report is
  written; a fresh P6 session is the next task.

## 9. P6 and stage-3 sign-off (1 October 2026)

- **Task P6** ran in a fresh session on the built MCD0: all of A1 to A26 checked against their evidence, the suites run, the evaluator
  searched for file, clock, random, network and print use (statically and with every one trapped), the output and fixtures validated
  against the schema, the wording scanned, the folder compared with standard §11.1, a differential test of 150,000 random cycles
  against an independent implementation of spec §6 (no mismatch), a fuzz of about 23,300 corrupted bundles, and an independent
  mutation pass (382 mutants of the evaluator, 92 of the parameter and registry files). It changed nothing and reported two findings.
- **F1 (A7 and A9, test T10):** a non-string `config_hash` value was copied into a VALID envelope that broke `mcd-output/1` (for bytes,
  NaN or an object it could not even be serialised). Closed in MCD0: tier 3 rejects a `config_hash` that is not a mapping, or whose
  entry for an active source is not a string (INVALID + `SANITY_FAILED`), and `_evaluate` keeps only string hashes in the envelope,
  which also covers a reading that an earlier check stopped. The root cause is in the shared kit and is listed as a kit item in
  `.claude/state/waiting-on.md`.
- **F2 (A21, a test gap):** a rounding helper that returned 1.0 for a zero statistic passed all tests. Closed by one test (an exact 0.0
  and a negative that rounds to −0.0 in every `details` number).
- **Tests:** five were added (four for F1, one for F2): 124 in all. The three F1 tests fail on the evaluator as it was before; the
  mutation pass on the fixed evaluator kills the F2 mutant, and every survivor is an equivalent mutant (iteration order, dead
  initialisers, no-op wrappers, diagnostic keys that never reach an envelope) or one of five defensive `int()` normalisations that
  no test exercises (low; real data are integers, Prisma types `window_span_bars` as `Int?`).
- The evaluator stays at **1.0.0**: MCD0 was never live nor committed, and the change alters no output on the fixtures (standard §14).
- **Stage 3 is signed off by Davin** (1 October 2026). The flag stays `off` and the registry status `Draft (1.0.0)`.
- **Commit:** "Build MCD0: evaluator 1.0.0, tests, fixtures, manifest (Stage 3 sign-off)" (not pushed).
