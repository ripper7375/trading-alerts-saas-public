# MCD1 implementation plan: retrofit to evaluator 2.0.0

Status: Approved (Davin, 1 October 2026, together with `mcd1.md` and decision D6) · Built in task P3 on 1 October
2026 (§9) · Next: an independent check, task P6, in a fresh session · Follows: [standard](../../../docs/MCD-DEVELOPMENT-STANDARD.md),
[walkthrough Part C0 and C2](../../../docs/MCD-RETROFIT-AND-CREATION-WALKTHROUGH.md)

This plan is steps R1 to R4. It lists each change, the tests that prove it, the fixtures, and the expected
difference from the pre-retrofit evaluator. Nothing in P2 touched the evaluator, the tests or the manifest at
the top of the folder; the pre-retrofit plan that stood here is kept in git history and its content lives on in
`legacy/` and `mcd1.md`.

## 1. What changes from the pre-retrofit MCD1

| #   | Area             | Pre-retrofit (`legacy/`)                                                                                              | Retrofit 2.0.0                                                                                                                                                              | Source                      |
| --- | ---------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| 1   | Input            | Reads a workbook with openpyxl, still-open bar included                                                               | `evaluate(inputs, params, upstream)` on a `CycleInputs`; closed bars only through `closed_bars`                                                                             | R1, R4, standard §4, §11.2  |
| 2   | Active indicator | Detects populated candidates; zero or more than one means `UNIDENTIFIED`                                              | Setting `active_indicator["M15"]`; others populated beside it go to `details.populated_candidates`; no override in the evaluator (tests choose through the fixture setting) | R3, D3, ADR-010             |
| 3   | Statistics row   | Latest `captured_at` for the source                                                                                   | The row at `stats_slot["M15"]`; none gives STALE + `NO_STATS_AT_SLOT`                                                                                                       | R2, rule 5                  |
| 4   | Containment      | Checked after the window; below 50% still reports `PASS` with macro trend `UNIDENTIFIED`; a missing rate is tolerated | Tier 4: below 50% is INVALID + `CONTAINMENT_LOW`; missing or not a number is INVALID + `SANITY_FAILED`                                                                      | walkthrough C2, standard §6 |
| 5   | Pre-flight order | Tier 1, tier 4, window, tiers 2 and 3                                                                                 | Cycle, tier 1, tier 4, tier 2, tier 3, through `run_preflight`                                                                                                              | standard §6                 |
| 6   | Tier 2           | Non-ascending timestamps are a warning; a null column crashes with `TypeError`                                        | INVALID + `DISCONTINUITY` (order, null); INVALID + `INSUFFICIENT_BARS` (fewer than `N_micro`)                                                                               | walkthrough C2, standard §6 |
| 7   | Tier 3           | UOEDT > LOEDT on every window bar                                                                                     | Same, plus the kit's last-bar and channel-width check, plus \|θ\| ≤ 90 (Q4, Q5)                                                                                             | pre-retrofit spec, plan §2  |
| 8   | State decision   | Latest-bar test on a CP already rounded to 4 decimals; the 80% test on a percentage rounded to 2 decimals             | Prices for the latest bar; exact integer test `100 × count ≥ 80 × N_micro`; CP rounded at output only                                                                       | standard §11.2              |
| 9   | Window           | Ends at the last row where the active indicator has a value; `round()` (exact halves go to the even number)           | Ends at the last closed bar; 5% of `T_EDT` rounded half up in integer arithmetic (Q3)                                                                                       | rule 2, walkthrough C2      |
| 10  | State codes      | None (trend and one of five regime words)                                                                             | Nine codes `MCD1_{UP,DOWN,SIDEWAYS}_{IN_CORRIDOR,UPPER_BREAKOUT,LOWER_BREAKDOWN}`; the five regime words stay                                                               | walkthrough C2, standard §7 |
| 11  | Bias             | None                                                                                                                  | Per state, decision D6 (**settled**: inside the corridor the macro trend, a break the break direction)                                                                      | standard §7.2               |
| 12  | Failure          | `trend_state = UNIDENTIFIED`, `regime_status = UNCERTAIN`                                                             | Status INVALID or STALE with a reason code, no state                                                                                                                        | standard §6                 |
| 13  | Wording          | "high probability of V-shape reversal", "explosive buying climax", "healthy trend continuation", percentages          | Nine templates T01 to T09 (location and counts only), summary lines S01 to S09 (≤ 80 characters, no prices)                                                                 | standard §7.4, R9, R11      |
| 14  | Output           | Own shape (`validation`, `parameters`, `evaluated_at`, `macro_structure`, `micro_regime`, `synthesis`)                | Envelope `mcd-output/1`; `details` per spec §11; `levels` UOEDT, baseline (new), LOEDT on M15; no wall-clock time                                                           | ADR-017, R5, R4             |
| 15  | Constants        | In the evaluator                                                                                                      | In `mcd1_params.yaml` (seven parameters)                                                                                                                                    | R3, standard §11.2          |
| 16  | Specification    | Thai in 29 of 100 lines; §4B says every breakout needs the 80% share                                                  | English, 14 sections; §6 states the same-slope break on the latest bar                                                                                                      | D4, ADR-023                 |

Unchanged: the ±5° band and its boundaries, the corridor edges, the 50% containment floor, the 5% window and
the 96-bar floor, the 80% share for counter-trend and sideways breaks, the same-slope break on the latest bar,
the Close as the metric (pending Q1), the five regime words.

## 2. Decisions

| Item    | Status                                                                                                                                                                                                                                                                            |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D3      | **Settled** (Davin, 30 Sep 2026), built into the kit's tier-1 helper. Used as is: on v4 the lone `non_b` setting is VALID with `non_a` listed in `populated_candidates`                                                                                                           |
| D4      | **Settled** (Davin, 1 Oct 2026): English specification. `mcd1.md` has no Thai left                                                                                                                                                                                                |
| D5      | Does not apply (MCD2's decision)                                                                                                                                                                                                                                                  |
| D6      | **Settled** (Davin, 1 Oct 2026). Bias per state: inside the corridor it follows the macro trend (UP LONG, DOWN SHORT, SIDEWAYS NEUTRAL); a break follows the break direction (above UOEDT LONG, below LOEDT SHORT), for all three trends. The registry no longer carries `DAVIN`. |
| D7      | Does not apply (MCD3's decision). The M15 baseline is added because standard §8 and architecture §2.5 require it of every channel MCD                                                                                                                                             |
| Q1 – Q6 | **Settled**, all as recommended (Davin, 1 Oct 2026): Close as the metric, keep the `T_EDT` fallback (96), rounding half up, every bar for tier 3, angle bound 90, rungs (Day Trader primary structure, Scalper trendlines and channels)                                           |
| Q7      | **Settled** as recommended (Davin, 1 Oct 2026). Done in P3: architecture §2.13 (MCD1 row: version 2.0.0, Levels "UOEDT, baseline, LOEDT") and §2.5 ("(baseline to add)" removed). Documentation only; the rule content stays Davin's                                              |

## 3. Tests (T1 to T13; T14 does not apply)

`test_mcd1_unit_tests.py` is rewritten on the kit, in the same shape as MCD2's: bundles built in memory for
synthetic cases, the stored fixtures for real ones, and the kit's shared checks mixin for T4 to T8, T10 and T12.

| Standard test  | MCD1 cases                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| T1             | Nine tests, one per state (trend × micro regime), checking `state_code`, `regime_status`, `bias`, levels, the template rendered and the `details` counts                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| T2             | θ = −5.0, −4.99, +4.99, +5.0 (SIDEWAYS) and −5.01, +5.01 (DOWN, UP); latest Close = UOEDT and = LOEDT exactly (inside) and one tick beyond each; a case where the rounded CP would be 1.0000 but Close > UOEDT (state follows the prices); sustained at 76 / 77 of 96 and 81 / 82 of 102; counter-trend with the latest bar outside and 76 / 77 bars; the latest bar inside with 77 or more bars on one side (stays inside); a same-slope break with one bar; containment 49.99 / 50.0 / 50.01; `T_EDT` 545, 1808, 1909, 1910, 1929, 1930, 3000 (`N_micro` 96, 96, 96, 96, 96, 97, 150); exactly `N_micro` closed bars and one fewer; \|θ\| 90 / 90.01 |
| T3             | One test per pre-flight failure: unknown `data_status` (INVALID + `SANITY_FAILED`), `DATA_STALE`, `RETUNING`, `NO_SETTING` (missing and not-a-candidate, including `fractal`), `DETECTION_MISMATCH`, `NO_STATS_AT_SLOT`, `CONTAINMENT_LOW`, `SANITY_FAILED` (containment missing, angle missing, inverted channel on an old window bar, channel width ≤ 0, angle beyond ±90), `INSUFFICIENT_BARS`, `DISCONTINUITY` (order, null)                                                                                                                                                                                                                       |
| T3 (tier 3)    | The three gaps found in MCD2's independent check, pinned from the start: the first bar of the window and the bar just outside it; UOEDT = LOEDT on a window bar that is not the last; a malformed forming bar appended, which changes nothing                                                                                                                                                                                                                                                                                                                                                                                                          |
| T4–T8, T10–T12 | The kit's shared checks on the v1 bundle: forming bar changes nothing, statistics from another slot give STALE, setting, determinism, schema, corrupted bundle, wording (codes, regime words, templates, rendered summaries), size                                                                                                                                                                                                                                                                                                                                                                                                                     |
| T9             | Replay: each stored `<slot>.inputs.json` reproduces its `<slot>.envelope.json`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| T13            | The three real cycles of §5, each with its expected state, `channel_position`, `n_micro`, breach counts and `populated_candidates`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

The 13 pre-retrofit tests stay as cases:

| Legacy test                                     | New case                                                                                                                                                                                                                 |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 01 real data `non_b`, counter-trend             | T13: v1 `non_b` → `MCD1_DOWN_UPPER_BREAKOUT`, θ −29.72, containment 73.95, `T_EDT` 1808 → `N_micro` 96, 96 bars above, CP 1.6622                                                                                         |
| 02 micro window floor and percentage            | T2: `T_EDT` 545, 1808, 3000 as before (96, 96, 150); the custom 10% case becomes a `Params` built in the test (181); new half-up cases                                                                                   |
| 03 UP, IN_CORRIDOR                              | T1: `MCD1_UP_IN_CORRIDOR`                                                                                                                                                                                                |
| 04 DOWN, LOWER_BREAKDOWN (massive dump)         | T1: `MCD1_DOWN_LOWER_BREAKDOWN`                                                                                                                                                                                          |
| 05 UP, UPPER_BREAKOUT (massive pump)            | T1: `MCD1_UP_UPPER_BREAKOUT`                                                                                                                                                                                             |
| 06 UP, LOWER_BREAKDOWN (counter-trend)          | T1: `MCD1_UP_LOWER_BREAKDOWN`                                                                                                                                                                                            |
| 07 SIDEWAYS, IN_CORRIDOR and UPPER_BREAKOUT     | T1: `MCD1_SIDEWAYS_IN_CORRIDOR`, `MCD1_SIDEWAYS_UPPER_BREAKOUT`, and the lower state, which has a real example (v4 `non_a`)                                                                                              |
| 08 two active indicators → fail                 | **Replaced** (D3): v4 with setting `non_b` stays VALID with `populated_candidates = {"M15": ["non_a"]}`; a missing setting gives INVALID + `NO_SETTING`                                                                  |
| 09 zero active indicators → fail                | T3: setting names an indicator with no data and another candidate has data → CAUTIONARY `DETECTION_MISMATCH`, then STALE + `NO_STATS_AT_SLOT` (reasons kept in order); no candidate populated → STALE or INVALID by tier |
| 10 UOEDT ≤ LOEDT → fail                         | T3: INVALID + `SANITY_FAILED`                                                                                                                                                                                            |
| 11 containment 35.5% → `UNIDENTIFIED`           | T3: INVALID + `CONTAINMENT_LOW` (the state `UNIDENTIFIED` no longer exists)                                                                                                                                              |
| 12 80% share filters a false breakout           | T2: 77 of 96 sustained and 76 of 96 not; 50 of 96 stays `IN_CORRIDOR`                                                                                                                                                    |
| 13 same-slope V-shape trigger on the latest bar | T1 and T2: DOWN with 3 bars below LOEDT, UP with 2 bars above UOEDT, both fire (ADR-023); the old "V-shape reversal" text is gone                                                                                        |

## 4. Files P3 will create or change (in `engine-1-5-new/mcd1/`)

| File                                    | Action                                                                                                              |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `mcd1_evaluator.py`                     | Rewrite (R5): imports only the standard library and `mcd_common`                                                    |
| `test_mcd1_unit_tests.py`               | Rewrite (R6)                                                                                                        |
| `mcd1_registry.yaml`                    | Replace the six `DAVIN` placeholders with Davin's D6 answer (done); mark approval                                   |
| `mcd1_output.json`                      | Regenerate from the v1 slot (R8)                                                                                    |
| `fixtures/`                             | New (R8): per slot `.inputs.json`, `.envelope.json`, `.source.md`                                                   |
| `mcd1-manifest-work-completion.md`      | Rewrite (R9): Appendix A checklist, equivalence table, this plan's §6 baseline                                      |
| `../../../docs/STACK-D-ARCHITECTURE.md` | §2.13 MCD1 row: stays `Retrofit`, version 2.0.0 noted (R10); the Levels cell and §2.5 baseline wording if Q7 is yes |
| `../../../docs/handoffs/`               | Hand-off report                                                                                                     |

Evaluator outline: wrapped in `envelope.never_throws("MCD1", "2.0.0")`. `run_preflight` with `cycle_check()`,
`indicator_check(["M15"])`, a tier-4 wrapper (`statistics_check(["M15"], min_containment=…)` plus the
angle-is-a-number check), a tier-2 closure that derives `N_micro` from the statistics row and calls `bars_check`
with the columns MCD1 reads (`timestamp`, `close`, the active indicator's SSA, UOEDT, LOEDT and baseline), and a
tier-3 wrapper (`sanity_check(["M15"])` plus the window-wide and angle checks). A stopped outcome goes to
`envelope.unavailable`; otherwise the trend and micro regime are chosen on prices and counts, a template is
filled and `valid(...)` or `cautionary(...)` returned with `reading_context(inputs, ["M15"])`. No file, clock,
randomness, print or openpyxl. The tier-3 window loop reads `closed_bars(...)`, never the raw bars.

`concept/` is not created: MCD1 has no board and git cannot hold an empty folder. The folder-layout test in P3
must allow its absence for MCD1 (standard §11.1 says it "may be empty").

## 5. Fixtures and expected readings

Two slots, built with the kit's provider from the frozen workbooks (never regenerated): v1
`2026-09-18T20:55Z` (setting `non_b`) and v4 `2026-09-28T23:15Z` (setting `non_b`). Each bundle keeps the
newest 150 closed M15 bars (the largest practical `N_micro`) and the channel columns of all seven candidates,
so the second v4 reading (`non_a`) is the same bundle with the setting replaced in memory. Settings files
already exist (`mcd_common/fixtures/settings_v1.yaml`, `settings_v4.yaml`; both name `non_b` for M15).
Measured here with the kit's provider on the closed-bar cut and the rules of `mcd1.md` §6 (exploration, not
yet a test):

| Workbook · setting | Last closed M15 bar | θ (°)  | Containment | `T_EDT` → `N_micro` | Bars above / below | CP (4 dec.) | Expected state                  | `populated_candidates` |
| ------------------ | ------------------- | ------ | ----------- | ------------------- | ------------------ | ----------- | ------------------------------- | ---------------------- |
| v1 · `non_b`       | 2026-09-18T20:30Z   | −29.72 | 73.95       | 1808 → 96           | 96 / 0             | 1.6622      | `MCD1_DOWN_UPPER_BREAKOUT`      | `[]`                   |
| v4 · `non_b`       | 2026-09-28T23:00Z   | −20.98 | 93.17       | 2035 → 102          | 0 / 0              | 0.1071      | `MCD1_DOWN_IN_CORRIDOR`         | `["non_a"]`            |
| v4 · `non_a`       | 2026-09-28T23:00Z   | −0.56  | 91.01       | 968 → 96            | 0 / 86             | −0.6473     | `MCD1_SIDEWAYS_LOWER_BREAKDOWN` | `["non_b"]`            |

All three are VALID and each shows a different state, so three of the nine states have a real example (the
other six are synthetic). The v4 `non_a` reading is the only real SIDEWAYS cycle; 86 of 96 bars is 89.6%, above
the 80% share. The other five candidates have no statistics row on either slot (a setting naming one is STALE).

## 6. Legacy baseline (step R1) and the expected legacy → new mapping

**Legacy tests:** the three legacy files were copied byte-identically to `legacy/` (SHA-256 checked). The legacy
test copy needed one edit (its workbook path, one folder deeper). Run from `legacy/`: **13 of 13 pass**.

**Legacy results** (pre-retrofit evaluator on the frozen workbooks; it reads the forming bar, which is the M15
bar opening at 20:45 on v1 and at 23:15 on v4). MCD1 has no override switch, so the "set" rows restrict the
module's candidate list to one indicator in a scratch script, which is what an override would do; the legacy
files were not changed:

| Workbook · override | Legacy result                                                                                                                          |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| v1 · none           | PASS `non_b`, `DOWNTREND` · `COUNTER_TREND_EXPANSION`: θ −29.72, containment 73.95, `T_EDT` 1808, `N_micro` 96, CP 1.6447, 96 above    |
| v1 · `non_b`        | Same                                                                                                                                   |
| v1 · the other six  | FAIL `UNIDENTIFIED`: no active centroid indicator (0 bars)                                                                             |
| v4 · none           | FAIL `UNIDENTIFIED`: multiple active indicators (`non_a`, `non_b`)                                                                     |
| v4 · `non_b`        | PASS `DOWNTREND` · `TREND_ALIGNED_CONTINUATION`: θ −20.98, containment 93.17, `T_EDT` 2035, `N_micro` 102, CP 0.1037, 0 above, 0 below |
| v4 · `non_a`        | PASS `SIDEWAYS` · `RANGE_EXPANSION` (lower breakdown): θ −0.56, containment 91.01, `T_EDT` 968, `N_micro` 96, CP −0.6524, 87 below     |
| v4 · the other five | FAIL `UNIDENTIFIED`: no active centroid indicator (0 bars)                                                                             |

So v1 is readable by the pre-retrofit evaluator as it stands (only `non_b` is populated), and v4 is not without
an override (walkthrough Part 0.2 item 1); with the setting both are.

**Expected legacy → new mapping:**

| Legacy output                                                                                | New                                                                                                                                                                                                        |
| -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `UPTREND` + `TREND_ALIGNED_CONTINUATION` / `BREAKOUT_SAME_SLOPE` / `COUNTER_TREND_EXPANSION` | `MCD1_UP_IN_CORRIDOR` / `MCD1_UP_UPPER_BREAKOUT` / `MCD1_UP_LOWER_BREAKDOWN`                                                                                                                               |
| `DOWNTREND` + the same three regimes                                                         | `MCD1_DOWN_IN_CORRIDOR` / `MCD1_DOWN_LOWER_BREAKDOWN` / `MCD1_DOWN_UPPER_BREAKOUT`                                                                                                                         |
| `SIDEWAYS` + `CONSOLIDATION`                                                                 | `MCD1_SIDEWAYS_IN_CORRIDOR`                                                                                                                                                                                |
| `SIDEWAYS` + `RANGE_EXPANSION`                                                               | `MCD1_SIDEWAYS_UPPER_BREAKOUT` or `MCD1_SIDEWAYS_LOWER_BREAKDOWN`, by the side of the break                                                                                                                |
| `trend_state UNIDENTIFIED`, multiple active indicators                                       | Not a failure any more: VALID with `populated_candidates` (D3)                                                                                                                                             |
| `UNIDENTIFIED`, no active indicator or too little data                                       | INVALID + `NO_SETTING` (no usable setting), or the set indicator has no data: CAUTIONARY `DETECTION_MISMATCH` (if another candidate has data) then STALE + `NO_STATS_AT_SLOT` or INVALID + `DISCONTINUITY` |
| `UNIDENTIFIED`, containment below 50% (reported as `PASS`)                                   | No state: INVALID + `CONTAINMENT_LOW`                                                                                                                                                                      |
| Containment missing (tolerated)                                                              | INVALID + `SANITY_FAILED`                                                                                                                                                                                  |
| FAIL, no statistics row                                                                      | STALE + `NO_STATS_AT_SLOT`                                                                                                                                                                                 |
| FAIL, UOEDT ≤ LOEDT                                                                          | INVALID + `SANITY_FAILED`                                                                                                                                                                                  |
| FAIL, fewer bars than the window                                                             | INVALID + `INSUFFICIENT_BARS`                                                                                                                                                                              |
| Non-ascending timestamps (warning)                                                           | INVALID + `DISCONTINUITY`                                                                                                                                                                                  |
| `trend_state` UPTREND / DOWNTREND / SIDEWAYS                                                 | `details.trend_direction` UP / DOWN / SIDEWAYS                                                                                                                                                             |

**Intended differences that are not state changes** (to be listed in the equivalence table at R7): the last
closed bar replaces the forming bar, so channel positions and counts move (v1 `non_b` CP 1.6447 → 1.6622; v4
`non_b` 0.1037 → 0.1071; v4 `non_a` −0.6524 → −0.6473, 87 → 86 bars below) while all three states stay; the
state is decided on unrounded prices and exact counts, which differs from the legacy rounded CP only when Close
is within 0.00005 of a band; `N_micro` rounds half up, which differs from Python `round()` only when 5% of
`T_EDT` is exactly x.5 with x even; v4 without an override is now readable; the M15 baseline level is new; the
per-side percentages, `contained_bar_count`, `channel_position_stat`, `raw_slope` and the provenance block are
gone from the output; all wording.

## 7. Records and follow-ups

- Part F: the architecture §2.13 row stays `Retrofit`; P3 notes version 2.0.0. No decision entry is needed for
  stage 3. Nothing goes live: flag `off`.
- `tags.yaml` (architecture §4.6) does not exist yet. The state codes, regime words and level names are listed in
  `mcd1.md` §10 for build step 6.
- The standard's A18, A19, A23, A24 and A25 are marked "pending, stage 4–7" in the manifest.
- Inherited and unverified: the statistics' fit windows may include the still-open bar
  (`.claude/state/waiting-on.md`, MCD kit item). It affects `regression_angle`, `containment_rate` and
  `containment_n`, which MCD1 reads (and with them `N_micro`). It must be settled before certification, not
  before P3.
- The three tier helpers MCD2 added on top of the kit (angle is a number, window-wide channel sanity, a
  `required_columns` override for `bars_check`) will now exist in two evaluators. Moving them into the kit
  would be a kit change with its own review, not part of P3. Suggested after MCD3, when three copies exist.
- The MCD2 hand-off's note stands: every `git` call warns "LF will be replaced by CRLF"; and the pre-commit
  hook runs prettier on staged files, so generated canonical JSON must stay in `.prettierignore` (the MCD1
  fixtures and `mcd1_output.json` are already covered by the existing patterns).

## 8. P3 is done when

- Davin has answered D6 and Q1 to Q7, and approved `mcd1.md`, `concept.md` and this plan (done, 1 October 2026).
- All tests T1 to T13 pass from `engine-1-5-new/` (`python -m unittest discover -s mcd1` plus the kit's suite
  still green), and the 13 legacy scenarios each have a case.
- `mcd1_output.json` and the fixture envelopes validate against `mcd-output/1`; the largest envelope is
  ≤ 600 tokens; one evaluation ≤ 1 s.
- The three real cycles of §5 give the expected states; every legacy → new difference is in the equivalence
  table and none is unexplained.
- The evaluator imports only the standard library, the kit and pure maths; no file, clock, randomness, print or
  openpyxl.
- The manifest carries Appendix A with evidence; the architecture §2.13 row notes 2.0.0; a hand-off report is
  written; the tests are run again **after** the commit, if Davin asks for one.

## 9. Build result (task P3, 1 October 2026)

Everything in §8 is met; the evidence is in `mcd1-manifest-work-completion.md`. What the build added or decided
beyond this plan, so that nothing is a surprise:

- **Tests: 105** (104 at the end of P3; the independent check added one). Beyond §3 the suite also pins: a breach bar just outside the
  window is not counted and the first bar of the window is; a window bar exactly on a band is inside and is not
  counted (found by the mutation pass: the first run left two mutants alive on exactly this); the channel position
  rounds half up at an exact half (1/32 gives 0.0313); the reading is unchanged at the five- and ten-minute
  slots (rule 1); a row stamped with the export slot is STALE under the strict rule; the fractal EDT is never an
  M15 candidate; `window_bars` is not a `T_EDT` source for MCD1.
- **States and numbers match §5 and §6 exactly** on the three real cycles. No state differs from the legacy
  mapping and none is unexplained (manifest §5).
- **Fixtures:** two slots (v1, v4), 150 closed M15 bars each with the channel columns of all seven candidates, and
  one M5 bar to show M5 is ignored. `concept/` is not created, and the folder-layout test allows its absence.
- **Records (Q7):** architecture §2.13 MCD1 row notes 2.0.0 and its Levels cell; §2.5 no longer says "(baseline to
  add)". The row's status stays `Retrofit`.
- **Independent check (task P6, 1 October 2026) and sign-off.** No line of A1 to A26 failed; three low findings were
  closed the same day: F1 and F2 (test gaps: a break under 1.00 in the commentary; the negative-zero guard on the
  channel position) by one test, F3 (four `meaning` sentences in `mcd1.md` §7) by aligning them to the registry.
  Davin granted the stage-3 sign-off. See manifest §3 and `docs/handoffs/2026-10-01-0628-mcd1-p6.md`.
- **Not done here, by design:** committing (done after the sign-off, by explicit path); moving the three
  tier helpers shared with MCD2 into the kit (§7); stages 4 to 7.
