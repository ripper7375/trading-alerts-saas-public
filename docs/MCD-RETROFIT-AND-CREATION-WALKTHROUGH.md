# MCD Retrofit and Creation Walkthrough

|              |                                                                                                                                                                                       |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**   | Working guide. Version 2.0, 30 September 2026 (agent instructions only; Davin's steps and prompts moved to the build user manual)                                                     |
| **Audience** | The agent (Antigravity or Claude Code). Davin's side of the work, including the prompts he pastes, is in [STACK-D-BUILD-USER-MANUAL.md](STACK-D-BUILD-USER-MANUAL.md)                 |
| **Owner**    | Davin (every approval named below is his)                                                                                                                                             |
| **Follows**  | [MCD-DEVELOPMENT-STANDARD.md](MCD-DEVELOPMENT-STANDARD.md) (Settled, [ADR-082](adr/082-mcd-development-standard.md)) and [STACK-D-ARCHITECTURE.md](STACK-D-ARCHITECTURE.md) chapter 2 |
| **Replaces** | `engine-1-5-new/prompt-to-antigravity-in-creating-mcd.md` and the workflow in §6 of `engine-1-5-new/HAND-OFF-REPORT-MCD1-TO-MCD-SERIES.md`                                            |
| **Language** | English. Every file an MCD session writes is in English (§A1)                                                                                                                         |

The standard says **what** an MCD must satisfy. This walkthrough says **in which order to do the work**,
for two paths:

- **Path R:** bring the existing MCD1, MCD2 and MCD3 into line with the standard, and build MCD0.
- **Path N:** create a new MCD (MCD4–MCD15) from a topic.

Both paths start with the same one-time setup (Part B). If the standard and this guide ever
disagree, the standard wins and this guide is corrected. This guide holds only the order of work and
the agent's instructions; Davin's steps and prompts are in the [build user manual](STACK-D-BUILD-USER-MANUAL.md).

---

## Contents

- [Part 0 — Where things stand (checked 30 September 2026)](#part-0--where-things-stand-checked-30-september-2026)
- [Part A — Ground rules for every MCD session](#part-a--ground-rules-for-every-mcd-session) (A5: the folder layout)
- [Part B — One-time setup (Step 0)](#part-b--one-time-setup-step-0)
- [Part C — Path R: retrofit MCD0–MCD3](#part-c--path-r-retrofit-mcd0mcd3)
- [Part D — Path N: create a new MCD](#part-d--path-n-create-a-new-mcd)
- [Part E — Builder rules and task cards (for the agent)](#part-e--builder-rules-and-task-cards-for-the-agent)
- [Part F — Records: registry, decisions, manifests](#part-f--records-registry-decisions-manifests)
- [Appendix 1 — Old output fields → envelope v1](#appendix-1--old-output-fields--envelope-v1)
- [Appendix 2 — Pitfalls seen in MCD1–MCD3](#appendix-2--pitfalls-seen-in-mcd1mcd3)

---

## Part 0 — Where things stand (checked 30 September 2026)

The facts below come from re-running the current code on the two replica workbooks
(Python 3.11, openpyxl 3.1.5), not from the documents.

### 0.1 The three packages today

|               | MCD1 · M15 primary trend                             | MCD2 · M5 corridor                   | MCD3 · consolidation + EDT stochastic          |
| ------------- | ---------------------------------------------------- | ------------------------------------ | ---------------------------------------------- |
| Files         | spec, plan, evaluator, 13 tests, output, manifest    | same                                 | same                                           |
| Tests         | 13 / 13 pass                                         | 13 / 13 pass                         | 13 / 13 pass                                   |
| Spec language | `mcd1.md`: 29 of 100 lines in Thai                   | `mcd2.md`: 76 of 165 lines in Thai   | English                                        |
| Reads         | Excel through openpyxl, including the still-open bar | same                                 | same                                           |
| Statistics    | Latest `captured_at` for the source                  | same                                 | First matching row for the source              |
| Output        | Own shape (15 keys)                                  | Own shape (15 keys)                  | Own shape (11 keys, `evaluator_version` 1.0.0) |
| Failure words | `UNIDENTIFIED`                                       | `MCD2_UNIDENTIFIED`, trend `INVALID` | `MCD3_INVALID`, `MCD3_UNKNOWN`                 |

### 0.2 What the re-runs showed

1. **Tier 1 fails on both workbooks without the test override.** Tier 1 today requires exactly one
   populated indicator. On M5 the fractal EDT is populated next to the channel indicator in both
   workbooks, and in v4 M15 has both `non_a` and `non_b`. Result without an override:

   | Workbook (slot)          | MCD1                                  | MCD2                                   | MCD3                        |
   | ------------------------ | ------------------------------------- | -------------------------------------- | --------------------------- |
   | v1 (`2026-09-18T20:55Z`) | DOWNTREND · COUNTER_TREND_EXPANSION   | INVALID (M5: `best_fit_a` + `fractal`) | `MCD3_INVALID` (same cause) |
   | v4 (`2026-09-28T23:15Z`) | UNIDENTIFIED (M15: `non_a` + `non_b`) | INVALID (M5: `cherry_a` + `fractal`)   | `MCD3_INVALID` (M15)        |

   MCD2's recorded output was produced with `target_indicator_override`. Reading the active
   indicator from the setting (rule 6, [ADR-010](adr/010-active-indicator-setting-per-timeframe.md)) is
   therefore the first thing every retrofit needs, and the meaning of "detection agrees" must be
   defined (decision D3 below).

2. **The evaluators read the still-open bar.** At slot 20:55 in v1 the last M5 row opens at 20:55 and
   the last M15 row at 20:45; both are still forming. Re-running on closed bars only (last closed M5
   bar 20:50, last closed M15 bar 20:30) gives the **same states** on this cycle: MCD1 DOWNTREND ·
   COUNTER_TREND_EXPANSION, MCD2 `MCD2_UP_IN_CORRIDOR` (with `best_fit_a`). The certified example
   survives the closed-bar rule; other cycles may not, which is what test T4 is for.

3. **MCD0 would flag both timeframes on both workbooks** with the settled thresholds (arch §2.4):

   | Workbook | Timeframe · source | R² A / B      | Fit ratio A / B | Geo ratio | Skew A / B    | Fails     |
   | -------- | ------------------ | ------------- | --------------- | --------- | ------------- | --------- |
   | v1       | M5 · `best_fit_a`  | −0.10 / −0.12 | 0.51 / 0.53     | 1.00      | −0.85 / −0.79 | R², fit   |
   | v1       | M15 · `non_b`      | 0.68 / 0.66   | 1.22 / 1.14     | 0.74      | −1.33 / −1.28 | R² A, fit |
   | v4       | M5 · `cherry_a`    | 0.69 / 0.69   | 2.24 / 2.31     | 1.08      | 0.50 / 0.56   | R² A      |
   | v4       | M15 · `non_b`      | 0.40 / 0.17   | 1.60 / 1.51     | 0.85      | −0.44 / −0.44 | R²        |

   (Fit ratio = half the channel width ÷ √MSE, from the `indicator_statistics` row at the slot.)
   If this holds on live data, every channel MCD would be CAUTIONARY on most cycles and Section 6
   would halve the pre-set risk on most setups ([ADR-061](adr/061-defect-flag-halves-the-pre-set-risk.md)).
   The shadow period (stage 4) must measure MCD0's flag rate before any MCD goes live.

4. **Wording.** MCD1 commentary says "high probability of soon V-shape price reversal" and prints
   breach rates with `%`; MCD2 commentary says "High probability of Mean Reversion"; MCD3 has
   `tactical_bias` values such as `HIGH_CONVICTION_BUY_DIP` and prints `%` in commentary. These fail
   test T11 (banned words, `%`). MCD2's `DIP_VALUE_BUY_OPPORTUNITY` and `RALLY_VALUE_SELL_OPPORTUNITY`
   and MCD3's `CAUTION_TAKE_PROFIT_BUY` and `HOLD_BULLISH_TREND_RUNNER` pass T11 but break standard
   §7.4's rule never to tell the trader what to do.

5. **MCD3 commentary.** The evaluator already has templates for all 10 states; its implementation
   plan §6 documents only 6. The retrofit moves all 10 into the registry and rewords them.

6. **MCD2 flags.** `mean_reversion_probability` is HIGH in exactly the 6 outside-corridor states and LOW in
   the other 3, so it repeats the state code; `trend_continuation_risk` is LOW in all 9 states.

### 0.3 Decisions Davin makes along the way

| #   | Decision                                                                                                                                                                                                      | Needed before | Recommendation in this guide                                                                                                                                                                                                                                                                            |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Approve [ADR-082](adr/082-mcd-development-standard.md), or proceed with the standard as provisional                                                                                                           | Part B        | Approve; the retrofits depend on it                                                                                                                                                                                                                                                                     |
| D2  | Active-indicator settings for the fixtures                                                                                                                                                                    | B2            | Test data only: v1: M5 `best_fit_a`, M15 `non_b` (as certified). v4: M5 `cherry_a`, M15 `non_a` or `non_b` (both populated). In live running the setting decides, and it can be any candidate (7 centroid variants on M15, `mcd1.md` §2; 8 EDT indicators on M5), so no MCD may assume a particular one |
| D3  | What "detection agrees" means in tier 1                                                                                                                                                                       | B2            | Mismatch = the set indicator has no value on the last closed bar while another candidate has. Other candidates populated alongside the set one go in `details` only; counting them as a mismatch would make every M5 cycle CAUTIONARY because of the fractal EDT                                        |
| D4  | Spec language                                                                                                                                                                                                 | C, D          | English for every spec (the no-Thai-bias rule). Chat may be in any language                                                                                                                                                                                                                             |
| D5  | MCD2 regime words containing BUY / SELL / OPPORTUNITY                                                                                                                                                         | C1            | Rename (proposals in C1); if kept, the spec says why                                                                                                                                                                                                                                                    |
| D6  | Bias per state for MCD1 and MCD3                                                                                                                                                                              | C2, C3        | Starting points in C2 and C3; Davin sets each                                                                                                                                                                                                                                                           |
| D7  | MCD3 levels                                                                                                                                                                                                   | C3            | Keep UOEDT and LOEDT on both timeframes and add the two baselines, as standard §8 requires of channel MCDs. Contributing none would need a change to §8 and arch §2.13                                                                                                                                  |
| D8  | MCD0 open questions (a)–(f)                                                                                                                                                                                   | C4            | Settle in `mcd0.md` before build                                                                                                                                                                                                                                                                        |
| D9  | Order of work                                                                                                                                                                                                 | Part C        | Step 0 → MCD2 → MCD1 → MCD3; MCD0 in parallel after Step 0                                                                                                                                                                                                                                              |
| D10 | MCD3 EDT Stochastic direction: the board says (UOEDT − SSA) ÷ width × 100; spec and code use (SSA − LOEDT) ÷ width × 100. The two are mirror images (they add up to 100), so the value and premium zones swap | C3            | Davin states which is intended; the other document is corrected                                                                                                                                                                                                                                         |

---

## Part A — Ground rules for every MCD session

### A1 Language

- **Every file is in English:** specs, plans, registry and parameter files, code, comments, commentary
  and summary templates, manifests, prompts. English is Stack D's pivot language for all 16
  trader languages ([ADR-038](adr/038-english-pivot-for-16-languages.md)); trader-facing words reach the
  other languages through the glossary and reason texts ([ADR-081](adr/081-safety-texts-in-all-16-languages.md)).
- **Chat is not a file.** Davin may talk with the builder in any language; nothing from the chat enters
  a file untranslated. The old instruction "communicate in Thai" is dropped from the prompts.
- Existing Thai passages (`mcd1.md`, `mcd2.md`) are rewritten in English during the retrofit, not
  kept alongside.

### A2 Roles

| Who                                  | Does                                                                                                                           |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| Davin                                | Chooses topics; approves the spec, the implementation plan and go-live; decides every item marked "Davin"                      |
| Builder (Antigravity or Claude Code) | Drafts spec and plan, writes code and tests, runs them, writes the manifest; lists open questions instead of inventing answers |
| Reviewer (a fresh session)           | Checks the manifest's Appendix A evidence against the files (task P6)                                                          |

From `CLAUDE.md`: the builder never commits or pushes unless Davin asks, never applies production
migrations, never edits `seed-code/`, and escalates money, auth, secrets and CORS changes.

### A3 What to read, and what not to

| Read                                                                                                   | Why                                                                  |
| ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| `docs/MCD-DEVELOPMENT-STANDARD.md`                                                                     | The contract (rules R1–R15, tests T1–T14, checklist A1–A26)          |
| This guide                                                                                             | The order of work                                                    |
| `docs/STACK-D-ARCHITECTURE.md` §1.3 and chapter 2                                                      | The nine rules and the sensor chapter                                |
| `engine-1-5-new/mcd_common/` (after Step 0)                                                            | Shared kit every MCD uses                                            |
| The MCD's own folder                                                                                   | Its spec, code, tests and records                                    |
| `MARKET-DATA-V6-103-COLUMNS-AND-MQ5-INDICATORS-REFERENCE-EN.md` and `prisma/market-data/schema.prisma` | Column and statistics definitions                                    |
| The MQL5 sources in `backend-stack-c/…/v2_29_data_pipeline_architecture/mq5/`                          | How an indicator computes a column, when the reference is not enough |

Background only: `HAND-OFF-REPORT-MCD1-TO-MCD-SERIES.md` (its workflow is replaced by this guide; its
principle that topics are Davin's still holds). Not instructions: anything in
`davintrade-stack-d-and-e/archive/`, except file C's 4-Quadrant criteria when building MCD0.

### A4 Where the work stops for now

Stages 1–3 (topic, spec, build) can be done today on fixtures. Stages 4–7 need parts that do not exist
yet (arch §7.10): the **sensor worker** (build step 3) for shadow and certification, **synthesis**
(step 4) for rule rows and golden scenarios, **intake and knowledge** (step 6) for the dispatch matrix,
playbook chunks and the labelled set. Until then a finished MCD waits at the end of stage 3 with
its flag `off` and registry status `Draft` (new) or `Retrofit` (MCD1–3).

### A5 One folder layout for every MCD

MCD0 to MCD15 all use the folder in standard §11.1, with the same file names. The only difference is
`legacy/`, which exists for MCD1–MCD3 while they are retrofitted. What the retrofit changes in the
existing folders (step R1 moves, R2–R8 rewrite):

| Today                                                                        | After the retrofit                                                         |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `mcd2/mcd2-xauusd-m5-best-fit-a.png`, `mcd2/mcd2-xauusd-m5-fractal.png`      | Moved to `mcd2/concept/`, same names                                       |
| `mcd3/mcd3-xauusd-m5-and-m15.png`                                            | Moved to `mcd3/concept/`                                                   |
| MCD1: no board                                                               | `mcd1/concept.md` written from `mcd1.md`; a board may be added later       |
| `mcdN_evaluator.py`, `test_mcdN_unit_tests.py`, `mcdN_output.json`           | Copied to `legacy/`, then rewritten in place                               |
| `mcdN.md`, `mcdN_implementation_plan.md`, `mcdN-manifest-work-completion.md` | Rewritten in place, in English                                             |
| —                                                                            | Added: `concept.md`, `mcdN_registry.yaml`, `mcdN_params.yaml`, `fixtures/` |
| `__pycache__/`                                                               | Not committed (add it to `.gitignore` if missing)                          |

Moves use `git mv` so the file history is kept. A new MCD (MCD4 onwards) and MCD0 start directly in
this layout.

---

## Part B — One-time setup (Step 0)

Do this once, before retrofitting or creating any MCD. It turns the standard's shared rules into code
so that each MCD only writes its own logic.

### B1 Approve the standard and retire the old instructions

1. Davin approves [ADR-082](adr/082-mcd-development-standard.md) (D1): its status becomes Settled, and
   the standard's header says so.
2. Add a banner to the top of `engine-1-5-new/HAND-OFF-REPORT-MCD1-TO-MCD-SERIES.md`, as ADR-082's note asks:

   ```markdown
   > **SUPERSEDED for engineering on <date>.** MCDs are built to
   > [`docs/MCD-DEVELOPMENT-STANDARD.md`](../../docs/MCD-DEVELOPMENT-STANDARD.md), in the order given by
   > [`docs/MCD-RETROFIT-AND-CREATION-WALKTHROUGH.md`](../../docs/MCD-RETROFIT-AND-CREATION-WALKTHROUGH.md).
   > This report is kept for history; its rule that each MCD's topic is Davin's still applies.
   ```

3. Add the same banner to `engine-1-5-new/prompt-to-antigravity-in-creating-mcd.md`, pointing to
   the build user manual (`docs/STACK-D-BUILD-USER-MANUAL.md`), or move that file to `archive/`.
4. In `PROMPT-TEMPLATE-REPLICATE-MARKET-DATA-EXCEL.md`, replace the Thai usage notes with:
   _"Copy the prompt block below into a new session. Replace `<XX>` with the batch number (e.g. 4),
   `<COUNT_OF_FILES>` with the number of exported files (e.g. 22), and `v<xx-1>` with the previous
   generator version."_ The prompt body is already in English.

### B2 Build the shared kit: `engine-1-5-new/mcd_common/`

**[new]** A small package every evaluator imports. Build it with task P1, review it like an MCD
(its own tests must pass), and treat its interfaces as fixed once MCD2's retrofit uses them.

| Module                      | Provides                                                                                                                                                                                                                      | Standard   |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `cycle_inputs.py`           | Frozen dataclasses `CycleInputs` and `Params` (loaded from `mcdN_params.yaml`)                                                                                                                                                | §4, §11.2  |
| `envelope.py`               | Builders `valid(...)`, `cautionary(...)`, `invalid(reasons)`, `stale(reasons)`; canonical JSON (fixed key order, prices rounded to 2 decimals); schema check against `mcd-output-1.schema.json` (Appendix B, saved as a file) | §5, R5, R7 |
| `preflight.py`              | The fixed order cycle → tier 1 → tier 4 → tier 2 → tier 3 → upstream, returning either "continue" (with any CAUTIONARY reasons) or the final status and reason codes; each MCD supplies its own tier content                  | §6         |
| `reason_codes.py`           | The Appendix D codes as constants; nothing else may be emitted                                                                                                                                                                | App. D     |
| `excel_fixture_provider.py` | Builds a `CycleInputs` from a replica workbook for one slot (rules below)                                                                                                                                                     | §4         |
| `wording.py`                | The banned-word list (§7.4), a `%` check, the 80-character summary check                                                                                                                                                      | T11        |
| `budget.py`                 | Token count of a serialised envelope (o200k_base, e.g. `tiktoken`) and evaluation timing                                                                                                                                      | T12, R15   |
| `testing.py`                | Shared tests any MCD can call: T4 forming bar, T5 wrong-slot statistics, T6 setting, T7 determinism, T8 schema, T10 corrupted bundle, T11 wording, T12 size                                                                   | §12        |

Proposed `CycleInputs` (field names become fixed when Davin approves the kit plan; then copy them into
standard §4 as a PATCH change):

```python
@dataclass(frozen=True)
class CycleInputs:
    symbol: str                                    # "XAUUSD"
    cycle_slot: str                                # "2026-09-18T20:55Z" (rule 1)
    data_status: str                               # FRESH | DELAYED | STALE | MARKET_CLOSED (rule 7)
    retuning: bool                                 # rule 9
    bars: Mapping[str, tuple[Mapping[str, Any], ...]]         # {"M5": (...), "M15": (...)}: closed bars only,
                                                   # ascending, keys = market_data_v6 column names (rule 2)
    statistics: Mapping[tuple[str, str], Mapping[str, Any]]   # {("M15", "non_b"): row captured at the slot};
                                                   # a missing key means no row at the slot (rule 5)
    active_indicator: Mapping[str, str]            # the setting per timeframe (rule 6)
    config_hash: Mapping[str, str]                 # per statistics source, from indicator_configs
    channel_mode: Mapping[str, str]                # per source: "dynamic" | "frozen" (arch §1.6)
```

Final field list, approved 30 September 2026 and built in task P1: the nine fields above plus
`stats_slot` (per timeframe, ISO 8601 UTC: the slot where that timeframe was last collected).
Standard §4 and `mcd_common/cycle_inputs.py` are authoritative.

Rules the fixture provider enforces (so evaluators cannot break them):

- **Closed bars only.** A bar is closed when `open time + timeframe length ≤ slot`. At slot 20:55 that
  keeps M5 bars up to 20:50 and M15 bars up to 20:30 (rule 1: an unchanged M15 reading at :05 and :10 is
  correct).
- **Statistics at the slot.** Only rows whose `captured_at` equals the slot where that timeframe was
  last collected; never "latest available". Map column prefixes to statistics sources explicitly
  (for example `fractal` → `fractal_edt`).
- **No live-bar fields.** Statistics fields that describe the forming bar (`live_close`,
  `channel_position`, `dist_to_*`, and `uoedt_value` / `baseline_value` / `loedt_value` taken at
  `live_bar_ts`) are dropped from the bundle. Evaluators use the fit descriptors (`regression_angle`,
  `containment_*`, `model_a_*`, `model_b_*`, offsets) and take prices from the last closed bar.
- **Setting from a file.** `mcd_common/fixtures/settings_<workbook>.yaml` holds the active indicator per
  timeframe for each fixture (D2). The evaluator never detects it on its own.
- **Tier-1 cross-check (D3).** No setting for a timeframe → INVALID + `NO_SETTING`. The set indicator
  has no value on the last closed bar while another candidate has → CAUTIONARY + `DETECTION_MISMATCH`;
  the later checks then usually end the reading as STALE or INVALID (the set indicator has no
  statistics or bars), and the reason tells the operator the setting looks wrong. Candidates populated
  alongside the set one (the fractal EDT on M5 in both workbooks; `non_a` beside `non_b` on M15 in v4)
  are listed in `details.populated_candidates` and do not change the status.
- **Forming-bar option.** A test-only flag appends the forming bar, for T4.

Exit condition: the kit's tests pass; the schema file validates a correct envelope and rejects one
with an extra top-level field; the provider reproduces the closed-bar cut-offs above on v1.

When the sensor worker is built (arch §7.10 step 3), a PostgreSQL provider replaces the Excel provider
and produces the same `CycleInputs`; evaluators do not change (R4, [ADR-020](adr/020-live-readings-vs-certification-history.md)).

### B3 Fixture policy

| Fixture                                                             | Slot                | Use                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **v1** `engine-1-5-new/market_data_v6_replicated.xlsx`              | `2026-09-18T20:55Z` | Regression fixture for MCD1–3 (the architecture's example cycle and the certified outputs come from it); T13 for every MCD                                                                                                                 |
| **v4** `davintrade-stack-d-and-e/market_data_v6_replicated_v4.xlsx` | `2026-09-28T23:15Z` | Second real cycle: two populated M15 indicators (proves the setting resolves what detection could not; under D3 the reading stays VALID) and a different market (M5 `cherry_a` and M15 `non_b` both slope about −21°; M15 `non_a` is flat) |
| **v3** `davintrade-stack-d-and-e/market_data_v6_replicated_v3.xlsx` | `2026-09-28T14:15Z` | MCD3 fixture (Davin, 1 October 2026): the only real consolidated trend (`MCD3_BEAR_BOTTOM`, M15 `non_b` + M5 `cherry_a`) and a real `MCD1_DOWN_LOWER_BREAKDOWN`                                                                            |
| Newer replicas                                                      | their own slot      | Add as further fixtures; never replace an existing one                                                                                                                                                                                     |

Rules:

1. **Freeze, don't edit.** A fixture workbook is never regenerated in place. A new export is a new
   file (`…_v5.xlsx`) with its own generator script, as the replica prompt template already does.
2. **Record the fixture.** Each MCD's `fixtures/` folder holds, per slot, `<slot>.inputs.json` (the
   bundle the provider produced), `<slot>.envelope.json` (the expected output) and `<slot>.source.md`
   (the workbook's path and SHA-256). A derived MCD (MCD3) also holds `<slot>.upstream.json`, the
   same-cycle envelopes of the MCDs it reads, because T9 replays JSON only (standard 1.0.4).
   `<slot>` has no colon, because Windows forbids it in file
   names: `2026-09-18T2055Z.inputs.json`. Replay test T9 reads the JSON, not the workbook.
3. **Synthetic cases** for T1–T3 are built as small in-memory bundles in the test file, not as extra
   workbooks.

---

## Part C — Path R: retrofit MCD0–MCD3

### C0 The common retrofit procedure

Run these ten steps for each of MCD1, MCD2 and MCD3. MCD0 is a new build and follows Part D with the
content in C4.

| Step                     | Do                                                                                                                                                                                                                        | Output                                | Exit                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ---------------------------------------------------------- |
| R1 Baseline              | Copy the current evaluator, tests and output into `mcdN/legacy/` (read-only); move any concept images into `mcdN/concept/` (A5). Record legacy results on v1 and v4 (with and without the override) in the manifest draft | `legacy/`, `concept/`, baseline table | Legacy tests still pass                                    |
| R2 Spec                  | Rewrite `mcdN.md` in English into the 14 sections of standard Appendix C.1. Carry the domain logic over unchanged, except the changes listed for this MCD below. Draft the state register                                 | `mcdN.md`                             | **Davin approves**                                         |
| R3 Registry + parameters | Move every constant into `mcdN_params.yaml` (value, unit, boundary, why); write `mcdN_registry.yaml` with the state register (Appendix C.2, C.3)                                                                          | Two YAML files                        | Every threshold in the spec appears once in the parameters |
| R4 Plan                  | List each change, the tests that prove it and the expected state differences from legacy                                                                                                                                  | `mcdN_implementation_plan.md`         | **Davin approves**                                         |
| R5 Evaluator             | Rewrite as `evaluate(inputs, params, upstream) -> Envelope` using the kit: no openpyxl, no file access, no `datetime.now()`, no printing; failures as status + reason codes; module content in `details`                  | `mcdN_evaluator.py`                   | Imports only the standard library, the kit and pure maths  |
| R6 Tests                 | T1–T14 (standard §12). Keep each of the 13 legacy scenarios as a case, re-expressed as bundles                                                                                                                            | `test_mcdN_unit_tests.py`             | All pass                                                   |
| R7 Equivalence           | Run legacy and new side by side on every legacy scenario and on v1 and v4; every state must map through the old → new table, except the intended changes in the plan                                                      | Table in the manifest                 | No unexplained difference                                  |
| R8 Real cycle            | Envelope for the v1 slot, validated, token-counted, timed                                                                                                                                                                 | `mcdN_output.json`, `fixtures/`       | Schema passes; ≤ 600 tokens; ≤ 1 s                         |
| R9 Manifest              | `mcdN-manifest-work-completion.md` with the Appendix A checklist; A18, A19, A23, A24 and A25 marked "pending, stage 4–7"                                                                                                  | Manifest                              | Reviewer session (task P6) finds no gap                    |
| R10 Records              | Version 2.0.0 (MAJOR: the output shape changes); registry row in arch §2.13 stays `Retrofit` with the new version noted; nothing goes live                                                                                | Arch §2.13 row                        | Davin signs off stage 3                                    |

### C1 MCD2 first (single timeframe; codes already follow the format)

| Area              | Change                                                                                                                                                                                                                                                                                      |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tier 1            | Setting for M5 replaces detection; the 8-candidate list becomes the cross-check (D3). Remove `target_indicator` from the evaluator; tests choose the indicator through the fixture setting                                                                                                  |
| Tier 4            | Statistics row at the slot for the set source (`fractal` → `fractal_edt`); none → STALE + `NO_STATS_AT_SLOT`; containment < 50% → INVALID + `CONTAINMENT_LOW` (one failure status, replacing `UNIDENTIFIED`)                                                                                |
| Window            | "Latest closed bar; statistics over min(T_EDT, 288)" (arch §2.5), counted in closed bars                                                                                                                                                                                                    |
| States            | Keep the 9 codes `MCD2_{UP,DOWN,SIDEWAYS}_{IN_CORRIDOR,UPPER_BREAKOUT,LOWER_BREAKDOWN}`; delete `MCD2_UNIDENTIFIED`                                                                                                                                                                         |
| Direction words   | `details.trend_direction` uses `UP` · `DOWN` · `SIDEWAYS` (standard §7.3); MCD3 will read it                                                                                                                                                                                                |
| Regime words (D5) | Keep TREND_ALIGNED_CONTINUATION, UPPER / LOWER_OVEREXTENSION_REVERSION, RANGE_EQUILIBRIUM, RANGE_RESISTANCE_REVERSION, RANGE_SUPPORT_REVERSION. Renamed (D5): `DIP_VALUE_BUY_OPPORTUNITY` → `UPTREND_DIP_BELOW_CORRIDOR`; `RALLY_VALUE_SELL_OPPORTUNITY` → `DOWNTREND_RALLY_ABOVE_CORRIDOR` |
| Flags             | `mean_reversion_probability` HIGH / LOW → `details.reversion_setup` (true in the 6 outside-corridor states), until `state_statistics` measure it; drop `trend_continuation_risk` (always LOW)                                                                                               |
| Commentary        | Remove every "probability" phrase; describe location only, e.g. `"The M5 {metric_name} is {dist_uoedt} above UOEDT {uoedt} while the channel slopes up ({angle}°)."` (`metric_name` is SSA for centroid sources and Close for the fractal EDT, as today)                                    |
| Levels            | UOEDT, baseline, LOEDT on M5, from the last closed bar                                                                                                                                                                                                                                      |
| `details`         | `trend_direction`, `regression_angle_deg`, `channel_position` (last closed bar), `window_bars`, `containment_rate`, `reversion_setup`, `populated_candidates`                                                                                                                               |
| Registry          | kind independent; `uses_channel: [M5]`; proposed rungs Day Trader trendlines & channels, Scalper primary structure (arch §2.13)                                                                                                                                                             |

### C2 MCD1 second

| Area          | Change                                                                                                                                                                                                                              |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tier 1        | Setting for M15; the 7 centroid variants become the cross-check (D3)                                                                                                                                                                |
| Tier 4        | At the slot, as MCD2; `UNIDENTIFIED` → INVALID + `CONTAINMENT_LOW`                                                                                                                                                                  |
| Tier 2        | A non-ascending timestamp becomes INVALID + `DISCONTINUITY` (today only a warning)                                                                                                                                                  |
| Window        | N_micro = max(96, round(5% × T_EDT)) closed M15 bars, ending at the last closed M15 bar                                                                                                                                             |
| Breakout rule | As certified ([ADR-023](adr/023-mcd1-same-slope-breakout-on-the-latest-bar.md)): same-slope breakout fires on the latest closed bar; counter-trend and sideways breakouts need ≥ 80% of N_micro. Correct `mcd1.md` §4B to match     |
| States        | 9 codes, one per trend × micro regime; the 5 regime words stay (table below)                                                                                                                                                        |
| Commentary    | Remove the "high probability of … reversal" phrases; replace `%` breach rates with counts, e.g. `"{upper_breach_count} of {n_micro} closed bars above UOEDT"`                                                                       |
| Levels        | Add the M15 baseline: UOEDT, baseline, LOEDT from the last closed M15 bar (arch §2.5)                                                                                                                                               |
| `details`     | `trend_direction`, `regression_angle_deg`, `containment_rate`, `n_micro`, `upper_breach_count`, `lower_breach_count`, `channel_position` (last closed bar), `populated_candidates`. Drop `channel_position_stat` (a live-bar value) |
| Registry      | kind independent; `uses_channel: [M15]`; proposed rungs Day Trader primary structure, Scalper trendlines & channels                                                                                                                 |

MCD1 state register draft (codes from the current logic; bias is Davin's, D6):

| State code                      | Macro trend | Micro regime                               | Regime word                | Bias (starting point) |
| ------------------------------- | ----------- | ------------------------------------------ | -------------------------- | --------------------- |
| `MCD1_UP_IN_CORRIDOR`           | UP          | inside, or below LOEDT on < 80% of N_micro | TREND_ALIGNED_CONTINUATION | LONG                  |
| `MCD1_UP_UPPER_BREAKOUT`        | UP          | above UOEDT, latest bar                    | BREAKOUT_SAME_SLOPE        | Davin                 |
| `MCD1_UP_LOWER_BREAKDOWN`       | UP          | below LOEDT, ≥ 80%                         | COUNTER_TREND_EXPANSION    | Davin                 |
| `MCD1_DOWN_IN_CORRIDOR`         | DOWN        | inside, or above UOEDT on < 80% of N_micro | TREND_ALIGNED_CONTINUATION | SHORT                 |
| `MCD1_DOWN_LOWER_BREAKDOWN`     | DOWN        | below LOEDT, latest bar                    | BREAKOUT_SAME_SLOPE        | Davin                 |
| `MCD1_DOWN_UPPER_BREAKOUT`      | DOWN        | above UOEDT, ≥ 80%                         | COUNTER_TREND_EXPANSION    | Davin                 |
| `MCD1_SIDEWAYS_IN_CORRIDOR`     | SIDEWAYS    | inside, or outside on < 80% of N_micro     | CONSOLIDATION              | NEUTRAL               |
| `MCD1_SIDEWAYS_UPPER_BREAKOUT`  | SIDEWAYS    | above UOEDT, ≥ 80%                         | RANGE_EXPANSION            | Davin                 |
| `MCD1_SIDEWAYS_LOWER_BREAKDOWN` | SIDEWAYS    | below LOEDT, ≥ 80%                         | RANGE_EXPANSION            | Davin                 |

On v1 the expected state is `MCD1_DOWN_UPPER_BREAKOUT` (COUNTER_TREND_EXPANSION), on closed bars as on
the legacy run.

### C3 MCD3 third (after MCD1 and MCD2 emit envelopes)

| Area                       | Change                                                                                                                                                                                                                                                                                                                                                                                 |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dependencies               | `depends_on: ["MCD1", "MCD2"]`. Condition 1 (trend alignment) reads `MCD1.details.trend_direction` (M15) and `MCD2.details.trend_direction` (M5) instead of recomputing ±5° from the statistics ([ADR-021](adr/021-mcd3-reads-mcd1-and-mcd2-readings.md))                                                                                                                              |
| Upstream check             | Upstream INVALID → INVALID + `UPSTREAM_UNAVAILABLE:<id>`; STALE → STALE + `UPSTREAM_STALE:<id>`; CAUTIONARY → continue with `UPSTREAM_CAUTIONARY:<id>`                                                                                                                                                                                                                                 |
| Own contribution           | Kept: nesting ≥ 75% over the M5 T_EDT, bar-0 engulfment, EDT stochastic 20 / 80 on the M15 corridor. It still reads M5 and M15 bars for these                                                                                                                                                                                                                                          |
| Nesting at non-M15 slots   | Each closed M5 bar is compared with the M15 bar that contains it; M5 bars newer than the last closed M15 bar are compared with that last closed M15 bar (rule 1). The spec states this                                                                                                                                                                                                 |
| States                     | Keep the 10 codes (7 consolidated, 3 non-consolidated); delete `MCD3_INVALID` and `MCD3_UNKNOWN`                                                                                                                                                                                                                                                                                       |
| Bias (D6)                  | Replace `tactical_bias` with `bias`. Starting point: BULL_VALUE and BULL_MID → LONG; BEAR_PREMIUM and BEAR_MID → SHORT; BULL_TOP, BEAR_BOTTOM, SIDEWAYS_EQUILIBRIUM → NEUTRAL; the 3 non-consolidated states → STAND_ASIDE (these always reach the prompt, [ADR-041](adr/041-warnings-and-the-primary-sensor-always-in-full.md)). Being derived, MCD3 modifies; it is not a third vote |
| Commentary                 | Move all 10 templates into the registry. Replace `%`: `"EDT stochastic {stoch} on the 0–100 corridor scale"`; `"{contained} of {total} M5 bars nested"`. Remove advice labels                                                                                                                                                                                                          |
| Levels (D7)                | UOEDT, baseline and LOEDT on M5 and on M15, from the last closed bars (standard §8; adds the two baselines)                                                                                                                                                                                                                                                                            |
| Registry                   | kind derived; `uses_channel: [M5, M15]`; proposed rung oscillators, as modifier, for both trader types                                                                                                                                                                                                                                                                                 |
| Stochastic direction (D10) | Settle which formula is intended before the retrofit: the board (`mcd3-xauusd-m5-and-m15.png`) and the code are mirror images                                                                                                                                                                                                                                                          |
| Extra test                 | T14: changing MCD1's trend in the upstream reading changes MCD3's state in the same cycle                                                                                                                                                                                                                                                                                              |

### C4 MCD0 (new build; can run beside C1–C3 once Step 0 is done)

Build with Part D stages 2–3, using this content for `mcd0.md`:

| Spec section         | Content                                                                                                                                                                                                                                                                                                                       |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Question             | Is each timeframe's active channel fitted well enough to trust the channel sensors?                                                                                                                                                                                                                                           |
| Kind, timeframes     | Gate; M5 and M15                                                                                                                                                                                                                                                                                                              |
| Inputs               | Only the `indicator_statistics` row at the slot for each timeframe's active source, whichever candidate the setting names (never a fixed indicator): `model_a_r2`, `model_b_r2`, `model_a_mse`, `model_b_mse`, `model_a_skew`, `model_b_skew`, `uoedt_offset`, `loedt_offset`, `channel_width`, span field (see (a)). No bars |
| Pillars per quadrant | Coverage ≥ 60 bars; R² Model A ≥ 0.70, Model B ≥ 0.65 ([ADR-019](adr/019-r-squared-threshold-per-model.md)); fit ratio 1.50–3.20; geo ratio 0.60–1.65 and \|skew\| ≤ 1.50 (arch §2.4; source: [file C](../davintrade-stack-d-and-e/archive/STACK-D-ENGINE-1.5A-1.5B-1.5C-ARCHITECTURE-PLAN.md) §4.1)                          |
| Timeframe verdict    | Defect when any pillar of either model fails (file C: any failure is a defect)                                                                                                                                                                                                                                                |
| States               | `MCD0_ALL_QUALIFIED`, `MCD0_M5_DEFECT`, `MCD0_M15_DEFECT`, `MCD0_M5_M15_DEFECT`; bias NEUTRAL; no levels; each pillar's value and pass / fail in `details`                                                                                                                                                                    |
| Status               | VALID when it could measure; STALE + `NO_STATS_AT_SLOT` when a row is missing; INVALID + `SANITY_FAILED` when a required field is null or the width is not positive                                                                                                                                                           |
| Worker effect        | The worker marks channel MCDs on a defective timeframe CAUTIONARY + `MCD0_DEFECT_<TF>`, using each registry's `uses_channel` (standard §9.2). MCD0 itself changes no other envelope                                                                                                                                           |

Open questions for Davin before build (D8):

- (a) **Coverage field.** File C defines N_span = live bar − start anchor + 1. The statistics offer
  `window_span_bars`, `line_span_bars`, `window_bars` and `model_x_n`; pick one.
- (b) **MSE per model.** File C writes RMSE = √MSE_close. Use `model_b_mse` for both quadrants, or
  each model's own MSE?
- (c) **Geo ratio versus the schema note.** The Prisma comment on `channel_asymmetry` says asymmetry is
  "reported, never penalised" because EDT bands come from the outermost touches, while the settled
  MCD0 criteria gate the geo ratio at 0.60–1.65. Confirm the gate.
- (d) **R² on flat channels.** A flat channel explains almost no variance by slope, whichever
  indicator draws it. In the test data the one flat channel happens to be v4 M15 `non_a` (angle
  −0.56°, containment 91%, R² −0.09), but any active candidate can be flat. Decide whether the R²
  pillar applies when the active indicator's `regression_angle` is within ±5° (SIDEWAYS). The rule
  is keyed to the angle of whatever indicator is active, and the tests run it with more than one
  candidate as the active source.
- (e) **Sources without Model A.** `fractal_edt` has no Model A values. Model A quadrant "not
  applicable" or defect?
- (f) **Informational flags.** Variance ratio and kurtosis are context only in file C; put them in
  `details` or leave them out.

Given Part 0 item 3, treat the thresholds as starting values: measure MCD0's flag rate during shadow,
and change a threshold only by a new decision entry (the values are settled in arch §2.4 and
[ADR-019](adr/019-r-squared-threshold-per-model.md)) and a MINOR version (standard §14).

---

## Part D — Path N: create a new MCD

Each stage names the task card to use (Part E), what goes in, what comes out and who closes it.

### Stage 1 — Concept board (supplied by Davin)

Davin describes a new MCD on one or more annotated chart screenshots in
`engine-1-5-new/mcdN/concept/` (for example `mcd4-concept-1.png`; a revision is
`mcd4-concept-1-v2.png`, and the old image stays), optionally with `concept/notes.md`. The board may
be written in any language; the agent turns it into English in stage 2.

A complete board shows the eight items below. In the readback (stage 2), the agent lists every
missing or unclear item as a question instead of filling it in:

| #   | Item                                                                                                                                                 | MCD3's board, for example                                                                          |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| 1   | **The core principle:** the question the MCD answers, in one or two sentences                                                                        | "Consolidated Trend and EDT Stochastic"                                                            |
| 2   | **Timeframe(s) and indicators:** which indicators may be the active one (any one of them, chosen by the setting)                                     | M15 channel + M5 channel                                                                           |
| 3   | **The rules:** each condition, formula and threshold                                                                                                 | Same trend on both; M5 inside M15 for ≥ 75% of the M5 EDT length; M5 inside M15 on the current bar |
| 4   | **The situations (states):** each case marked on the chart with circles or arrows                                                                    | Consolidated vs not consolidated                                                                   |
| 5   | **What each situation means** for a trader                                                                                                           | "Strongly confirmed trend"                                                                         |
| 6   | **When there is no answer**                                                                                                                          | "No consolidated trend → EDT Stochastic unavailable"                                               |
| 7   | **Example times:** the date and time of the bars marked on the board                                                                                 | 2026.09.16 05:45 and 2026.09.21 12:45                                                              |
| 8   | **Levels:** the prices where the market is expected to react, if any. Section 3 builds the entry zones from them; the MCD does not make zones itself | MCD2: UOEDT, baseline, LOEDT on M5                                                                 |

The agent also checks that every column the board relies on exists in `market_data_v6` or
`indicator_statistics` (if not, it says so: the indicator must write it first), and that the
dimension is new (otherwise it is a change to an existing MCD, standard §14, and task P7 applies).

### Stage 2 — Readback, specification and plan (agent drafts, Davin approves)

1. **Readback.** Task P4 starts by writing `mcdN/concept.md`: the board restated in English as
   numbered rules (layout below). Nothing else is written yet. **Davin checks** each rule against
   his board and corrects it. This is the step that catches a misread principle before any code
   exists: MCD3's board writes the EDT Stochastic as (UOEDT − SSA) ÷ (UOEDT − LOEDT) × 100, while
   its spec and code compute (SSA − LOEDT) ÷ (UOEDT − LOEDT) × 100, the mirror image (decision D10).
2. **Spec.** From the confirmed `concept.md`, the agent drafts `mcdN.md` (14 sections, Appendix C.1),
   `mcdN_registry.yaml` and `mcdN_params.yaml`, and lists open questions.
3. Davin answers the open questions and sets the bias of every state and the proposed rung.
4. The agent writes `mcdN_implementation_plan.md`: files, tests (T1–T14 mapped to states and
   thresholds), fixture slots, expected state on each fixture.
5. **Davin approves** spec and plan. The agent adds the registry row to arch §2.13 with status
   `Draft` (Part F).

Layout of `concept.md`:

```markdown
# MCDN concept (readback of Davin's concept board)

Source images: concept/…

1. Core principle (one or two sentences)
2. Timeframes and candidate indicators (any one active, from the setting)
3. Rules, numbered R1, R2 …: each with formula, threshold and boundary (≥ or >), as read from the board
4. States: name · when it happens · what it means (Davin's words, translated) · example time
5. No answer when …
6. Example times → test slots (real-data test only if a replica was exported at that time;
   otherwise a synthetic test built from the rule)
7. Data used: columns and statistics fields, each checked to exist
   7b. Levels contributed (name, timeframe, which channel width sets the zone), or "none"
8. Wording the standard will change (e.g. "high probability" → neutral description plus a bias)
9. Overlap with existing MCDs
10. Questions for Davin: anything the board leaves open or that could be read two ways
```

A replica workbook holds statistics for its export slot only, so a board time becomes a real-data
test only when a replica was exported at that time.

Spec checks that most often fail: a threshold without a stated boundary (≥ or >); a window counted in
"bars" rather than closed bars; a state without a bias; wording that tells the trader what to do; levels
without a stated channel width for zones (standard §8).

### Stage 3 — Build (builder)

Task P5. In order: parameters and registry files → evaluator on the kit → tests T1–T14 → real-cycle
envelopes on v1 and v4 → fixtures → manifest with Appendix A. Then a reviewer session runs task P6. Exit:
all tests pass, the reviewer finds no gap, Davin signs off. Flag stays `off`.

### Stage 4 — Shadow (needs the sensor worker)

Copy evaluator, parameters and registry entry unchanged into the worker; flag `shadow`. At least 5
trading days: saved every cycle, not on the sensor board, not in synthesis. Review the status mix,
every `EVALUATOR_ERROR` (must be none), CAUTIONARY rate (including MCD0 defects) and envelope size.

### Stage 5 — Certify (needs point-in-time history)

Replay on `market_data_point_in_time` → state history → forward outcomes at 2 h and 12 h →
`state_statistics`. States below n ≥ 30 stay provisional and get words only
([ADR-022](adr/022-minimum-sample-before-quoting-a-number.md)).

### Stage 6 — Integrate (needs synthesis and knowledge)

Dispatch-matrix row; `tags.yaml` entries; playbook (D2) and foundations (D1) chunks in English;
glossary terms and reason texts in all 16 languages; labelled questions; proposed rule rows (Davin's
to accept); golden scenarios re-approved if they change.

### Stage 7 — Go live (Davin)

Flag `live`; registry row `Live` with version; new rules version if rows were accepted; a decision entry
in `docs/adr/` (Part F).

### Stage 8 — Maintain

Every change follows standard §14: MAJOR for states, meanings, levels or dependencies; MINOR for a
threshold; PATCH for a fix that changes no output. MAJOR and MINOR start a new statistics series.
The work is task P7: a new board version in `concept/`, a recorded change
in `concept.md`, then spec, code, tests and a fresh check.

**What else gets checked scales with the change.** Only what the change touches is looked at; task
P7 lists it for Davin before editing:

| Change to an MCD                                                                 | Dependent MCDs (those that list it in `depends_on`) | Synthesis rules                                                                                | Golden scenarios                             |
| -------------------------------------------------------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------- |
| PATCH: a fix that changes no output                                              | Nothing to review                                   | Nothing to review                                                                              | Run; nothing should move                     |
| MINOR: a threshold only, state names unchanged                                   | Tests re-run automatically; no review               | No rule changes                                                                                | Run; Davin re-approves any result that moves |
| MAJOR: states added, renamed or removed; meaning, levels or dependencies changed | Reviewed only if they read a state that changed     | Only the rows that name this MCD's states are reviewed; a new rules version if any row changes | Run; Davin re-approves any result that moves |
| New MCD                                                                          | None yet: nothing reads it                          | It proposes new rows; existing rows stay unless Davin accepts a change                         | Run once its rows are accepted               |

Most MCDs have no dependents, so for most changes the dependent column is empty. MAJOR and MINOR
changes also start a new statistics series: numbers measured on the old version are not quoted for
the new one.

The **whole rules table** and the **dependencies between MCDs** are not reviewed at each change. That
is task P8, done occasionally (below).

### Occasional full review of dependencies and rules (task P8)

The per-change checks above look only at what one MCD touches. Now and then the whole set needs a
look: the dependencies between MCDs, and the rules table's order, gaps, overlaps and rows to merge or
remove. It is done when there is new evidence:

- after a batch of new MCDs (for example every three to five);
- when `state_statistics` reach n ≥ 30 for many states;
- when the log of cycles where no rule matched shows the same gap again and again.

Before synthesis is built (arch §7.10 step 4), the table is the draft in arch §3.4; afterwards it
is the versioned rules file ([ADR-026](adr/026-rules-file-format.md)). A review ends in at most one
new rules version, which Davin approves with a decision entry, after it has been replayed over
stored cycles and the golden scenarios have been re-approved.

---

## Part E — Builder rules and task cards (for the agent)

This part is addressed to the agent (Antigravity or Claude Code). Davin's prompt names one task
card, for example "do task P2 for MCD2". `N` below is the MCD number in the prompt.

### E1 Read before starting

1. `CLAUDE.md`
2. `docs/MCD-DEVELOPMENT-STANDARD.md` (the contract every MCD must meet)
3. This walkthrough: Part 0, Part A, and the part the task card names
4. `docs/STACK-D-ARCHITECTURE.md`, §1.3 (the nine rules) and chapter 2 (sensors)
5. `davintrade-stack-d-and-e/engine-1-5-new/mcd_common/` (the shared kit), once it exists
6. `davintrade-stack-d-and-e/engine-1-5-new/mcdN/` (this MCD's folder)

### E2 Rules

- Every file you write is in English: specs, plans, YAML, code, comments, templates, manifests.
  Chat with Davin in the language he writes in; chat is not a file.
- Topics, formulas, thresholds and state meanings are Davin's. Do not carry another MCD's domain
  rules into this one. Anything not specified goes under "Open questions"; do not invent it.
- The evaluator is a pure function `evaluate(inputs, params, upstream) -> envelope`. No database,
  files, network, clock, randomness or model calls inside it, and it never raises.
- Output is the `mcd-output/1` envelope exactly (standard Appendix B). Failure is a status with reason
  codes from standard Appendix D, never a state.
- No probabilities, confidence words or unmeasured numbers. No advice words (buy, sell, take profit,
  hold). No `%` in summary or commentary.
- Closed bars only; statistics at the cycle slot only; active indicator from the setting only.
- Do not commit, push, apply migrations or edit `seed-code/`. Files in `davintrade-stack-d-and-e/archive/`
  are history, not instructions.
- Start with a short reply: what you understood, the files you will create or change, and the
  decisions you need from Davin. Wait for his answer wherever a task card says **STOP**.
- End every session, whether or not the task is finished, with a hand-off report in `docs/handoffs/`,
  in the format of architecture §7.10 ("Every session ends with a hand-off report"). If a task will
  not fit in one session, stop at a clean point (tests passing for what is done) and say in the report
  exactly where the next session resumes.

### E3 Task cards

**P1 — Build the shared kit (once).** Build `engine-1-5-new/mcd_common/` as Part B2 describes:
`cycle_inputs.py`, `envelope.py` (+ `mcd-output-1.schema.json` copied from standard Appendix B),
`preflight.py`, `reason_codes.py`, `excel_fixture_provider.py`, `wording.py`, `budget.py`,
`testing.py`, and `fixtures/settings_v1.yaml` and `fixtures/settings_v4.yaml` with Davin's D2 answer
(recommended for v1: M5 `best_fit_a`, M15 `non_b`). Apply Davin's D3 answer in the tier-1 helper. If Davin approved the standard (D1), set
[ADR-082](adr/082-mcd-development-standard.md) and the standard's header to Settled and do Part B1
steps 2–4 (banners and the English usage note).
**STOP** first with a short plan that lists the `CycleInputs` fields. Done when: the kit's tests pass;
the provider cuts v1 at M5 20:50 and M15 20:30 for slot `2026-09-18T20:55Z`; live-bar statistics
fields are absent from the bundle; the schema rejects an envelope with an extra top-level field.

**P2 — Retrofit MCD1, MCD2 or MCD3: spec and plan.** If the MCD's manifest already records
`evaluator_version` 2.0.0 or later, the retrofit is done: stop and tell Davin to use P7. Otherwise, Part C0 steps R1–R4, with the changes in the
MCD's own section (C1 for MCD2, C2 for MCD1, C3 for MCD3).

- R1: copy the current evaluator, tests and output to `mcdN/legacy/`; move any concept images into
  `mcdN/concept/` with `git mv` (Part A5); record legacy results on v1 and v4, with and without the
  override.
- Write `mcdN/concept.md` (layout in Part D stage 2): from the board for MCD2 and MCD3, from `mcd1.md`
  for MCD1. Davin reviews it with the spec at the STOP below.
- R2: rewrite `mcdN.md` in English using the 14 sections of standard Appendix C.1. Keep the domain
  logic; apply only the listed changes. Translate any Thai passages. If the MCD folder holds concept
  images (MCD2 and MCD3 do), read them first and list every place where the current spec or code
  differs from the board, for Davin to decide.
- R3: `mcdN_params.yaml` and `mcdN_registry.yaml`.
- R4: `mcdN_implementation_plan.md`, including the expected legacy → new state mapping.
- List the decisions from Part 0.3 (D3, D5, D6, D7) that apply. **STOP** after R4 for approval.

**P3 — Retrofit: build.** Spec and plan are approved. Part C0 steps R5–R10: evaluator on the kit;
tests T1–T14, keeping all 13 legacy scenarios as cases; equivalence table against legacy; real-cycle
envelopes on v1 and v4 with token count and timing; `fixtures/`; manifest with the standard's
Appendix A checklist (A18, A19, A23, A24, A25 marked "pending, stage 4–7"). `evaluator_version`
2.0.0. R10: note the new version in the MCD's row of arch §2.13 (status stays `Retrofit`). Report
any state that differs from legacy and is not in the plan.

**P4 — New MCD: readback, then spec.** If `mcdN-manifest-work-completion.md` already exists, the MCD is
built: stop and tell Davin to use P7.
(a) Read the images in `engine-1-5-new/mcdN/concept/` (and
`notes.md` if present) and write `mcdN/concept.md` in English, using the layout in Part D stage 2.
Restate what the board says; do not add rules of your own; list every ambiguity as a question.
**STOP** until Davin confirms or corrects it. For MCD0 there is no board: Part C4 is the concept and
its open questions (a)–(f) go under "Open questions". (b) From the confirmed concept, draft `mcdN.md` (all 14 sections
of standard Appendix C.1), `mcdN_registry.yaml` (states with code, meaning, levels, summary and
template id; bias left as "DAVIN") and `mcdN_params.yaml` (value, unit, boundary and why for every
threshold). Use only the data the concept names; check each column exists in the 103-column reference
or the `IndicatorStatistic` model. State every window in closed bars. Propose the precedence rung per
trader type and any rule rows, as proposals. Then write `mcdN_implementation_plan.md`. **STOP** for
approval. No code. After Davin approves, add or update the MCD's row in arch §2.13 with status
`Draft` (Part F1).

**P5 — New MCD: build.** Spec and plan are approved. Part D stage 3: parameters and registry files,
evaluator on the kit, tests T1–T14 (T14 only if derived), envelopes for the v1 and v4 slots,
`fixtures/`, manifest with Appendix A. `evaluator_version` 1.0.0; flag off. Done when: all tests
pass; schema valid; envelope ≤ 600 tokens; evaluation ≤ 1 s.

**P6 — Independent check (always a fresh session).** You are checking, not building: change nothing,
and report failures only, each with file and line. What you check depends on the prompt:

- **An MCD** ("task P6 for MCDn"): for each line A1–A26 of `mcdN-manifest-work-completion.md`, open
  the evidence it cites and say pass, fail or not yet due. Run the tests. Search the evaluator for
  file, database, clock, random, network, print and openpyxl use. Validate `mcdN_output.json` against
  the schema. Check every state code and template against the banned-word list (standard §7.4).
  Compare the folder with standard §11.1 (A26).
- **The kit** ("task P6 for the kit"): check `mcd_common/` against Part B2 and the P1 "Done when"
  list, and run its tests.
- **A rules version from P8** ("task P6 for rules version <v>"): check that the written rules file
  matches the proposal Davin approved (same rows, same order); re-run the replay and confirm it
  reproduces the listed changes; run every MCD's test suite; confirm the decision entry exists.

**P7 — Change an existing MCD.** Use only for an MCD already built on the standard (its manifest
records a version and `mcdN_registry.yaml` exists). (a) Read the images in `mcdN/concept/` not yet listed under "Source images" in `concept.md`,
plus Davin's one-line description, and compare them with the current `concept.md`. Add a section to
`concept.md` headed "Change <date>" that lists each rule added, changed or removed, in English.
Classify the change as MAJOR, MINOR or PATCH (standard §14). List what else it touches: MCDs whose
`depends_on` includes this one, synthesis rule rows that name its states, golden scenarios.
**STOP** for Davin to confirm. (b) Update `mcdN.md`, the registry and parameters, the evaluator,
tests and fixtures; raise `evaluator_version`; re-run this MCD's tests and those of every MCD that
depends on it; update the manifest and the version in arch §2.13; draft the decision entry for
`docs/adr/` if the change is MAJOR, or if the value changed is fixed in the architecture or a
decision entry (Part F). Never delete old concept images.

**P8 — Full review: MCD dependencies and synthesis rules.** You are proposing, not changing; Davin
decides. Read the current rules table (the versioned rules file once synthesis is built, otherwise
the draft in arch §3.4), arch §3.2–§3.4 and §3.6, and every `engine-1-5-new/mcd*/mcdN_registry.yaml`
and `mcdN.md`. Where they exist, also read `state_statistics`, the log of cycles with no matching
rule, and the golden scenarios. Report on the dependencies between MCDs:

- every `depends_on` target exists and there are no dependency cycles;
- every upstream state or `details` field a derived MCD reads still exists in the upstream spec;
- every MCD's test suite passes when all are run together.

Then report on the rules, for each profile (Day Trader, Scalper):

- states that no rule uses, and rules that name states which no longer exist;
- rules that can never fire because an earlier rule always matches first;
- rules whose behaviour the statistics contradict (only states with n ≥ 30; say which);
- the most frequent no-match combinations, with a proposed row for each;
- MCDs whose levels never reach a zone because no rule names them.
  Then propose one new rules version: the full ordered table with each change marked and its reason.
  Replay it over the stored cycles (or the fixtures, before the worker exists) and list every cycle
  and golden scenario whose bias or zones would change. **STOP.** Change nothing until Davin
  approves; then write the rules file, the decision entry and the new version number.

---

## Part F — Records: registry, decisions, manifests

### F1 When each record changes

| Event                                      | Registry row (arch §2.13)            | `docs/adr/`                                                                               | Other                                                                                                       |
| ------------------------------------------ | ------------------------------------ | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| ADR-082 approved                           | —                                    | ADR-082 status → Settled                                                                  | Standard header; banners (B1)                                                                               |
| Kit plan approved                          | —                                    | —                                                                                         | Copy the `CycleInputs` fields into standard §4 (PATCH note)                                                 |
| Spec approved (new MCD)                    | Add row, status `Draft`              | —                                                                                         | —                                                                                                           |
| Spec approved (MCD0)                       | `To build` → `Draft`                 | —                                                                                         | —                                                                                                           |
| Retrofit stage 3 done                      | Stays `Retrofit`; note version 2.0.0 | —                                                                                         | Manifest                                                                                                    |
| Shadow starts                              | `Shadow`                             | —                                                                                         | Flag `shadow`                                                                                               |
| Go live                                    | `Live`, with version                 | New entry: "MCDN goes live" (stage 7)                                                     | Rules version if rows accepted                                                                              |
| MAJOR change                               | Version updated                      | New entry naming the change                                                               | New statistics series; golden outputs re-approved                                                           |
| MINOR change                               | Version updated                      | Only if the value is fixed in the architecture or a decision entry (e.g. MCD0 thresholds) | New statistics series; parameter rationale updated; golden results re-approved if they move                 |
| New reason code, level name or regime word | —                                    | Only if it changes the contract                                                           | In the same change: `tags.yaml`; for a reason code also standard App. D and its trader text in 16 languages |
| New envelope field or status               | —                                    | New entry first (`mcd-output/2`)                                                          | Architecture and standard edited after the decision                                                         |
| MCD retired                                | `Retired`                            | New entry                                                                                 | Rules and dispatch rows removed                                                                             |
| Full rules review (P8) approved            | —                                    | New entry naming the rules version                                                        | Rules file updated; golden scenarios re-approved                                                            |

### F2 Writing a decision entry

The next free number is 083. Use the same layout as the existing entries:

```markdown
# ADR-083: <MCDN goes live | MCDN threshold change | …>

- **Status:** Proposed | Settled
- **Date:** <YYYY-MM-DD>
- **Section:** 2 · Sensors (MCDs)
- **Architecture:** [STACK-D-ARCHITECTURE.md](../STACK-D-ARCHITECTURE.md) §2.13

## Decision

<one or two sentences>

## Alternative not chosen

<the option Davin rejected>

## Why

<the evidence: shadow results, statistics, test results>

## Changing this decision

Record a new decision that names this one; set this file's status to "Superseded by ADR-nnn";
update STACK-D-ARCHITECTURE.md in the same change.
```

Add the row to `docs/adr/README.md` and the reference link at the end of the architecture document.

### F3 The manifest

Each `mcdN-manifest-work-completion.md` has, in this order: what was built and the version; files
with a one-line purpose; test results (count, command, date); the equivalence table (retrofits); the
real-cycle envelopes; the standard's Appendix A checklist, each line with evidence (test name, file,
line) or "pending, stage n"; open questions; decisions Davin made during the work, with dates.

---

## Appendix 1 — Old output fields → envelope v1

| Old field (MCD1 / MCD2 / MCD3)                                                                                                            | Envelope v1                                                                                    |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `mcd_id` / `mcd_id` / `module`                                                                                                            | `mcd_id`                                                                                       |
| `name`                                                                                                                                    | Registry file only                                                                             |
| `symbol`, `timeframe`                                                                                                                     | Not in the envelope; timeframes appear as keys of `last_closed_bar` and `active_indicator`     |
| `evaluated_at`, `evaluated_epoch` / `timestamp`                                                                                           | Removed; the worker stores `evaluated_at` beside the row. The cycle is `cycle_slot`            |
| — / — / `evaluator_version`                                                                                                               | `evaluator_version` (semantic, from 2.0.0 for retrofits)                                       |
| `parameters`                                                                                                                              | Removed; identified by `evaluator_version`, kept in `mcdN_params.yaml`                         |
| `validation` (errors, warnings, checks)                                                                                                   | `status` + `status_reasons`; diagnostics to logs; `populated_candidates` in `details`          |
| `active_indicator`                                                                                                                        | `active_indicator` per timeframe, from the setting                                             |
| `macro_structure`, `micro_regime` / `trend_structure`, `corridor_dynamics` / `m15_metrics`, `m5_metrics`, `consolidated_trend_conditions` | `details`, trimmed to what spec section 11 lists (≤ 600 tokens overall)                        |
| — (MCD1 has no state code) / `synthesis.discrete_state_code` / `evaluation.discrete_state_code`                                           | `state_code` (MCD1: new, from trend × micro regime, C2)                                        |
| `regime_status`                                                                                                                           | `regime_status` (shared vocabulary)                                                            |
| `trend_state`                                                                                                                             | `details.trend_direction` (`UP` · `DOWN` · `SIDEWAYS`)                                         |
| — / `mean_reversion_probability` / `evaluation.tactical_bias`                                                                             | `details.reversion_setup` (MCD2) · `bias` (MCD3, mapped)                                       |
| `commentary`                                                                                                                              | `commentary` from a template, plus a new `summary_line` (≤ 80 characters, no prices)           |
| —                                                                                                                                         | `schema_version`, `cycle_slot`, `last_closed_bar`, `config_hash`, `levels`, `depends_on` (new) |

## Appendix 2 — Pitfalls seen in MCD1–MCD3

| Pitfall                                | Where it happened                                                   | Guard                                                               |
| -------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Reading the still-open bar             | All three (last Excel row)                                          | Provider cuts at the slot; T4                                       |
| "Latest" or first-found statistics row | MCD1, MCD2 (`captured_at` sort); MCD3 (first match)                 | Provider keys by slot; T5                                           |
| Detecting the active indicator         | All three; fails when fractal EDT or a second centroid is populated | Setting + D3 cross-check; T6                                        |
| Test switch in production code         | MCD2 `target_indicator_override`                                    | Setting only; override exists in tests                              |
| Failure as a state                     | `UNIDENTIFIED`, `MCD2_UNIDENTIFIED`, `MCD3_INVALID`, `MCD3_UNKNOWN` | Status + reason codes; schema forbids a state when INVALID or STALE |
| Probability and advice words           | MCD1 and MCD2 commentary, MCD2 regime words, MCD3 `tactical_bias`   | T11 banned-word test; spec review against §7.4                      |
| Recomputing an upstream result         | MCD3 recomputes both trends                                         | `depends_on`; T14                                                   |
| Wall-clock time in the output          | `evaluated_at`                                                      | Worker writes it; T7 determinism                                    |
| Spec and code disagree                 | MCD1 §4B breakout; MCD3 plan lists 6 of 10 templates                | Spec approved first; reviewer (task P6)                             |
| Non-English spec text                  | `mcd1.md`, `mcd2.md`                                                | A1; English-only prompts                                            |
