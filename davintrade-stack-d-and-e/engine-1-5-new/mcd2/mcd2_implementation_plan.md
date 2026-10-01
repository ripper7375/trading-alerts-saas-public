# MCD2 implementation plan: retrofit to evaluator 2.0.0

Status: Approved (Davin, 1 October 2026, together with `mcd2.md`; built in task P3) ·
Next task: P3 (build) · Follows: [standard](../../../docs/MCD-DEVELOPMENT-STANDARD.md),
[walkthrough Part C0 and C1](../../../docs/MCD-RETROFIT-AND-CREATION-WALKTHROUGH.md)

This plan is steps R1 to R4. It lists each change, the tests that prove it, the fixtures, and the expected
difference from the pre-retrofit evaluator. Nothing in P2 touched the evaluator, the tests or the manifest.

## 1. What changes from the pre-retrofit MCD2

| #   | Area             | Pre-retrofit (`legacy/`)                                                                                    | Retrofit 2.0.0                                                                                                                                                             | Source                      |
| --- | ---------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| 1   | Input            | Reads a workbook with openpyxl, still-open bar included                                                     | `evaluate(inputs, params, upstream)` on a `CycleInputs`; closed bars only through `closed_bars`                                                                            | R1, R4, standard §4, §11.2  |
| 2   | Active indicator | Detects populated candidates; two populated means INVALID; `target_indicator` switch in the evaluator       | Setting `active_indicator["M5"]`; others populated beside it go to `details.populated_candidates`; no override in the evaluator (tests choose through the fixture setting) | R3, D3, ADR-010             |
| 3   | Statistics row   | Latest `captured_at` for the source                                                                         | The row at `stats_slot["M5"]`; none gives STALE + `NO_STATS_AT_SLOT`                                                                                                       | R2, rule 5                  |
| 4   | Containment      | Checked last; below 50% gives the state `MCD2_UNIDENTIFIED`                                                 | Tier 4: below 50% is INVALID + `CONTAINMENT_LOW`; missing or not a number is INVALID + `SANITY_FAILED`                                                                     | walkthrough C1, standard §6 |
| 5   | Pre-flight order | Tier 1, tier 4, window, tiers 2 and 3, containment                                                          | Cycle, tier 1, tier 4, tier 2, tier 3, through `run_preflight`                                                                                                             | standard §6                 |
| 6   | Tier 2           | Non-monotonic timestamps are a warning; a null column crashes with `TypeError`                              | INVALID + `DISCONTINUITY` (order, null); INVALID + `INSUFFICIENT_BARS` (fewer than `N_window`)                                                                             | standard §6                 |
| 7   | Tier 3           | UOEDT > LOEDT on every window bar                                                                           | Same, plus the kit's last-bar and channel-width check, plus \|θ\| ≤ 90 (Q4, Q5)                                                                                            | pre-retrofit spec, plan §2  |
| 8   | State decision   | Corridor classified on CP already rounded to 4 decimals                                                     | Classified on the unrounded prices (m against U and L); CP rounded at output only                                                                                          | standard §11.2              |
| 9   | Window           | Statistics over the window in the output                                                                    | `N_window = max(48, min(T_EDT, 288))` closed bars drives tiers 2 and 3 and `details.window_bars`; breach counts and excursions dropped (Q3)                                | walkthrough C1, arch §2.5   |
| 10  | Regime words     | `DIP_VALUE_BUY_OPPORTUNITY`, `RALLY_VALUE_SELL_OPPORTUNITY`                                                 | `UPTREND_DIP_BELOW_CORRIDOR`, `DOWNTREND_RALLY_ABOVE_CORRIDOR`                                                                                                             | D5                          |
| 11  | Bias             | None                                                                                                        | UP states LONG, DOWN states SHORT, SIDEWAYS states NEUTRAL                                                                                                                 | D6, standard §7.2           |
| 12  | Flags            | `mean_reversion_probability` HIGH / LOW; `trend_continuation_risk` always LOW                               | `details.reversion_setup` (true in the six outside-corridor states); the second flag is dropped                                                                            | walkthrough C1, ADR-022     |
| 13  | Wording          | "high probability", "prime Buy Opportunity", "safely within", `channel_position=…`                          | Nine templates T01 to T09, location only, summary lines S01 to S09 (≤ 80 characters, no prices)                                                                            | standard §7.4, R9, R11      |
| 14  | Output           | Own shape (`validation`, `parameters`, `evaluated_at`, `trend_structure`, `corridor_dynamics`, `synthesis`) | Envelope `mcd-output/1`; `details` per spec §11; `levels` UOEDT, baseline, LOEDT (M5); no wall-clock time                                                                  | ADR-017, R5, R4             |
| 15  | Constants        | In the evaluator                                                                                            | In `mcd2_params.yaml` (six parameters)                                                                                                                                     | R3, standard §11.2          |

Unchanged: the ±5° band and its boundaries, the corridor edges, the 50% containment floor, the 288-bar cap
and 48-bar floor, SSA for centroids and Close for the fractal EDT (pending Q1), the nine state codes.

## 2. Decisions

| Item  | Status                                                                                                                                                                                                                                                                                                                    |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D3    | **Settled** (Davin, 30 Sep 2026), built into the kit's tier-1 helper. Used as is                                                                                                                                                                                                                                          |
| D4    | **Settled** (Davin, 1 Oct 2026): English specification. `mcd2.md` has no Thai left                                                                                                                                                                                                                                        |
| D5    | **Applied** (Davin, 1 Oct 2026): the two regime words renamed                                                                                                                                                                                                                                                             |
| D6    | **Applied** (Davin, 1 Oct 2026): UP states LONG, DOWN states SHORT, SIDEWAYS states NEUTRAL, for all nine states                                                                                                                                                                                                          |
| D7    | Does not apply (MCD3's decision)                                                                                                                                                                                                                                                                                          |
| Q1–Q6 | **Approved as recommended** (Davin, 1 Oct 2026): Close for the fractal, fallback 288, breach counts dropped, every bar for tier 3, angle bound 90, rungs confirmed (`mcd2.md` §14)                                                                                                                                        |
| Q7    | **Approved: yes** (Davin, 1 Oct 2026). After D5, architecture §2.5 (the MCD2 "States" cell) and §3.4 (draft rules 3 and 3s) still name `DIP_VALUE_BUY` and `RALLY_VALUE_SELL`. May P3 update those two places (documentation only, with the registry-row change in R10)? Recommended: yes. The rule content stays Davin's |

## 3. Tests (T1 to T13; T14 does not apply)

`test_mcd2_unit_tests.py` is rewritten on the kit: bundles built in memory for synthetic cases, the stored
fixtures for real ones, and the `SharedSensorChecks` mixin for the shared checks.

| Standard test  | MCD2 cases                                                                                                                                                                                                                                                                                                                                                                                                  |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T1             | Nine tests, one per state (trend × corridor), checking `state_code`, `regime_status`, `bias`, `reversion_setup`, levels and the template rendered                                                                                                                                                                                                                                                           |
| T2             | θ = −5.0, −4.99, +4.99, +5.0 (SIDEWAYS) and −5.01, +5.01 (DOWN, UP); m = L and m = U exactly (IN_CORRIDOR) and one tick beyond each; a case where the rounded CP would be 1.0000 but m > U (state follows the prices); containment 49.99 / 50.0 / 50.01; `T_EDT` 47 / 48 / 49 and 287 / 288 / 289 (window 48, 48, 49, 287, 288, 288); \|θ\| 90 / 90.01                                                      |
| T3             | One test per pre-flight failure: unknown `data_status` (INVALID + `SANITY_FAILED`), `DATA_STALE`, `RETUNING`, `NO_SETTING` (missing and not-a-candidate), `DETECTION_MISMATCH`, `NO_STATS_AT_SLOT`, `CONTAINMENT_LOW`, `SANITY_FAILED` (containment missing, angle missing, inverted channel on an old window bar, channel width ≤ 0, angle beyond ±90), `INSUFFICIENT_BARS`, `DISCONTINUITY` (order, null) |
| T4–T8, T10–T12 | The kit's shared checks on the v1 bundle: forming bar changes nothing, statistics from another slot give STALE, setting, determinism, schema, corrupted bundle, wording (codes, regime words, templates, rendered summaries), size                                                                                                                                                                          |
| T9             | Replay: each stored `<slot>.inputs.json` reproduces its `<slot>.envelope.json`                                                                                                                                                                                                                                                                                                                              |
| T13            | The four real cycles of §5, each with its expected state, `channel_position`, `window_bars`, `populated_candidates`                                                                                                                                                                                                                                                                                         |

The 13 pre-retrofit tests stay as cases:

| Legacy test                              | New case                                                                                                                                                                                                                        |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 01 real data `best_fit_a`                | T13: v1 `best_fit_a` → `MCD2_UP_IN_CORRIDOR`, θ 6.94, containment 55.76, `T_EDT` 755 → window 288                                                                                                                               |
| 02 real data `fractal`                   | T13: v1 `fractal` → `MCD2_UP_IN_CORRIDOR`, θ 10.61, metric Close, source `fractal_edt`, `T_EDT` 336 → window 288                                                                                                                |
| 03 to 08 the six trending states         | T1: all six, one test each                                                                                                                                                                                                      |
| 09 sideways, three states                | T1: three tests                                                                                                                                                                                                                 |
| 10 two active indicators → INVALID       | **Replaced** (D3): v1 with setting `best_fit_a` stays VALID with `populated_candidates = {"M5": ["fractal"]}`; a missing setting gives INVALID + `NO_SETTING`                                                                   |
| 11 zero active indicators → error        | T3: setting names an indicator with no data and another candidate has data → CAUTIONARY `DETECTION_MISMATCH`, then STALE + `NO_STATS_AT_SLOT` (reasons kept in order); no candidate populated at all → STALE or INVALID by tier |
| 12 inverted channel → error              | T3: INVALID + `SANITY_FAILED`                                                                                                                                                                                                   |
| 13 missing statistics, containment < 50% | T3: STALE + `NO_STATS_AT_SLOT`; INVALID + `CONTAINMENT_LOW` (replaces `MCD2_UNIDENTIFIED`)                                                                                                                                      |

## 4. Files P3 will create or change (in `engine-1-5-new/mcd2/`)

| File                                    | Action                                                                                         |
| --------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `mcd2_evaluator.py`                     | Rewrite (R5): imports only the standard library and `mcd_common`                               |
| `test_mcd2_unit_tests.py`               | Rewrite (R6)                                                                                   |
| `mcd2_output.json`                      | Regenerate from the v1 slot (R8)                                                               |
| `fixtures/`                             | New (R8): per slot `.inputs.json`, `.envelope.json`, `.source.md`                              |
| `mcd2-manifest-work-completion.md`      | Rewrite (R9): Appendix A checklist, equivalence table, this plan's §6 baseline                 |
| `../../../docs/STACK-D-ARCHITECTURE.md` | §2.13 MCD2 row: stays `Retrofit`, version 2.0.0 noted (R10); the two word updates if Q7 is yes |
| `../../../docs/handoffs/`               | Hand-off report                                                                                |

Evaluator outline: wrapped in `envelope.never_throws("MCD2", "2.0.0")`. `run_preflight` with `cycle_check()`,
`indicator_check(["M5"])`, a tier-4 wrapper (`statistics_check(["M5"], min_containment=…)` plus the angle
check), a tier-2 closure that derives `N_window` from the statistics row and calls `bars_check` with the
columns MCD2 reads (`timestamp`, `close`, the active indicator's channel columns), and a tier-3 wrapper
(`sanity_check(["M5"])` plus the window-wide and angle checks). A stopped outcome goes to
`envelope.unavailable`; otherwise the state is chosen, a template filled and `valid(...)` or
`cautionary(...)` returned with `reading_context(inputs, ["M5"])`. No file, clock, randomness, print or openpyxl.

## 5. Fixtures and expected readings

Two slots, built with the kit's provider from the frozen workbooks (never regenerated): v1
`2026-09-18T20:55Z` (setting `best_fit_a`) and v4 `2026-09-28T23:15Z` (setting `cherry_a`). Each bundle
keeps the newest 288 closed M5 bars and the columns of its centroid indicator and of the fractal, so the
fractal reading is the same bundle with the setting replaced in memory. Settings files already exist
(`mcd_common/fixtures/settings_v1.yaml`, `settings_v4.yaml`). Measured here with the kit's provider on the
closed-bar cut (exploration, not yet a test):

| Workbook · setting | Last closed M5 bar | θ (°)  | Containment | `T_EDT` → window | CP (4 dec.) | Expected state          | `populated_candidates` |
| ------------------ | ------------------ | ------ | ----------- | ---------------- | ----------- | ----------------------- | ---------------------- |
| v1 · `best_fit_a`  | 2026-09-18T20:50Z  | 6.94   | 55.76       | 755 → 288        | 0.8192      | `MCD2_UP_IN_CORRIDOR`   | `["fractal"]`          |
| v1 · `fractal`     | 2026-09-18T20:50Z  | 10.61  | 64.88       | 336 → 288        | 0.1065      | `MCD2_UP_IN_CORRIDOR`   | `["best_fit_a"]`       |
| v4 · `cherry_a`    | 2026-09-28T23:10Z  | −20.94 | 100.00      | 1134 → 288       | 0.1753      | `MCD2_DOWN_IN_CORRIDOR` | `["fractal"]`          |
| v4 · `fractal`     | 2026-09-28T23:10Z  | −49.89 | 99.51       | 410 → 288        | 0.7932      | `MCD2_DOWN_IN_CORRIDOR` | `["cherry_a"]`         |

All four are VALID. The other six candidates have no statistics row on either slot (so a setting that names
one of them is STALE).

## 6. Legacy baseline (step R1) and the expected legacy → new mapping

**Legacy tests:** the three legacy files were copied byte-identically to `legacy/`. The legacy test copy
needed one edit (its workbook path, one folder deeper). Run from `legacy/`: **13 of 13 pass**.

**Legacy results** (pre-retrofit evaluator on the frozen workbooks; it reads the forming bar, which is the
bar opening at the slot):

| Workbook · override | Legacy result                                                                          |
| ------------------- | -------------------------------------------------------------------------------------- |
| v1 · none           | FAIL, `trend_state` INVALID: multiple active indicators (`best_fit_a`, `fractal`)      |
| v1 · `best_fit_a`   | PASS `MCD2_UP_IN_CORRIDOR`, θ 6.94, containment 55.76, `T_EDT` 755, CP 0.7959 (SSA)    |
| v1 · `fractal`      | PASS `MCD2_UP_IN_CORRIDOR`, θ 10.61, containment 64.88, `T_EDT` 336, CP 0.0960 (Close) |
| v1 · the other six  | FAIL INVALID: no data (0 bars)                                                         |
| v4 · none           | FAIL INVALID: multiple active indicators (`cherry_a`, `fractal`)                       |
| v4 · `cherry_a`     | PASS `MCD2_DOWN_IN_CORRIDOR`, θ −20.94, containment 100.0, `T_EDT` 1134, CP 0.1846     |
| v4 · `fractal`      | PASS `MCD2_DOWN_IN_CORRIDOR`, θ −49.89, containment 99.51, `T_EDT` 410, CP 0.7887      |
| v4 · the other six  | FAIL INVALID: no data (0 bars)                                                         |

So, without the override, neither workbook is readable by the pre-retrofit evaluator (walkthrough Part 0.2
item 1); with the setting both are.

**Expected legacy → new mapping:**

| Legacy output                                                       | New                                                                                                                                                                                                        |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The nine state codes `MCD2_{UP,DOWN,SIDEWAYS}_{IN_CORRIDOR,…}`      | Unchanged, one to one                                                                                                                                                                                      |
| Regime `DIP_VALUE_BUY_OPPORTUNITY` / `RALLY_VALUE_SELL_OPPORTUNITY` | `UPTREND_DIP_BELOW_CORRIDOR` / `DOWNTREND_RALLY_ABOVE_CORRIDOR`; the other six regime words unchanged                                                                                                      |
| `MCD2_UNIDENTIFIED`, `trend_state` UNIDENTIFIED (containment < 50%) | No state: INVALID + `CONTAINMENT_LOW`                                                                                                                                                                      |
| Containment missing                                                 | INVALID + `SANITY_FAILED`                                                                                                                                                                                  |
| `trend_state` INVALID, two active indicators                        | Not a failure any more: VALID with `populated_candidates` (D3)                                                                                                                                             |
| `trend_state` INVALID, no active indicator or too little data       | INVALID + `NO_SETTING` (no usable setting), or the set indicator has no data: CAUTIONARY `DETECTION_MISMATCH` (if another candidate has data) then STALE + `NO_STATS_AT_SLOT` or INVALID + `DISCONTINUITY` |
| INVALID, no statistics row                                          | STALE + `NO_STATS_AT_SLOT`                                                                                                                                                                                 |
| INVALID, UOEDT ≤ LOEDT                                              | INVALID + `SANITY_FAILED`                                                                                                                                                                                  |
| INVALID, fewer bars than the window                                 | INVALID + `INSUFFICIENT_BARS`                                                                                                                                                                              |
| Non-monotonic timestamps (warning)                                  | INVALID + `DISCONTINUITY`                                                                                                                                                                                  |
| `trend_state` UPTREND / DOWNTREND / SIDEWAYS                        | `details.trend_direction` UP / DOWN / SIDEWAYS                                                                                                                                                             |
| `mean_reversion_probability` HIGH / LOW                             | `details.reversion_setup` true / false (true in the six outside-corridor states)                                                                                                                           |

**Intended differences that are not state changes** (to be listed in the equivalence table at R7): the
last closed bar replaces the forming bar, so channel positions move (v1 `best_fit_a` 0.7959 → 0.8192,
`fractal` 0.0960 → 0.1065; v4 `cherry_a` 0.1846 → 0.1753, `fractal` 0.7887 → 0.7932) while all four states
stay; the state is decided on unrounded prices, which differs from the legacy rounded CP only when the
metric is within 0.00005 of a band; the window statistics, `raw_slope`, `anchored_y_int` and provenance
fields are gone from the output; all wording.

## 7. Records and follow-ups

- Part F: the architecture §2.13 row stays `Retrofit`; P3 notes version 2.0.0. No decision entry is needed
  for stage 3. Nothing goes live: flag `off`.
- `tags.yaml` (architecture §4.6) does not exist yet. The two new regime words and the level names are listed
  in `mcd2.md` §10 for build step 6.
- The standard's A18, A19, A23, A24 and A25 are marked "pending, stage 4–7" in the manifest.
- Inherited and unverified: the statistics' fit windows may include the still-open bar
  (`.claude/state/waiting-on.md`, MCD kit item). It affects `regression_angle` and `containment_rate`, which
  MCD2 reads. It must be settled before certification, not before P3.

## 8. P3 is done when

- All tests T1 to T13 pass from `engine-1-5-new/` (`python -m unittest discover -s mcd2 -t .` plus the kit's
  suite still green), and the 13 legacy scenarios each have a case.
- `mcd2_output.json` and the fixture envelopes validate against `mcd-output/1`; the largest envelope is
  ≤ 600 tokens; one evaluation ≤ 1 s.
- The four real cycles of §5 give the expected states; every legacy → new difference is in the equivalence
  table and none is unexplained.
- The evaluator imports only the standard library, the kit and pure maths; no file, clock, randomness, print
  or openpyxl.
- The manifest carries Appendix A with evidence; the architecture §2.13 row notes 2.0.0; a hand-off report
  is written.
