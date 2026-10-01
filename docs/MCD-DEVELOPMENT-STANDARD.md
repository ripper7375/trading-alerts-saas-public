# MCD Development Standard

|                  |                                                                                                                                                                                                                                                                         |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**       | Settled ([ADR-082](adr/082-mcd-development-standard.md), approved by Davin 30 September 2026). Version 1.0.3, 1 October 2026 (Appendix C.2: `flag` quoted, PATCH)                                                                                                       |
| **Owner**        | Davin (topics, specs and go-live approvals)                                                                                                                                                                                                                             |
| **Applies to**   | Every Market Condition Description sensor: MCD0 (quality gate), MCD1–MCD3 (examples, to retrofit), MCD4–MCD15 (to be defined)                                                                                                                                           |
| **Walkthrough**  | [MCD-RETROFIT-AND-CREATION-WALKTHROUGH.md](MCD-RETROFIT-AND-CREATION-WALKTHROUGH.md): the order of work for retrofitting MCD0–MCD3 and creating new MCDs, and the agent's task cards. Davin's prompts: [STACK-D-BUILD-USER-MANUAL.md](STACK-D-BUILD-USER-MANUAL.md)     |
| **Derived from** | [STACK-D-ARCHITECTURE.md](STACK-D-ARCHITECTURE.md), chapter 2 and the rules it depends on                                                                                                                                                                               |
| **Replaces**     | The engineering parts of `engine-1-5-new/HAND-OFF-REPORT-MCD1-TO-MCD-SERIES.md` where they conflict (data source, "latest row" statistics, output template, validation outcome words). Its principles on user-defined topics and workflow discipline are kept (§1, §11) |

This document tells whoever builds an MCD (Davin, Antigravity or Claude Code) how to design, code,
test and switch on a sensor so that it fits Stack D without changes elsewhere. The architecture
decides **what** Stack D does; this standard decides **how an MCD must be built to fit it**.

---

## How to read this standard

- **Must** = required for go-live. **Should** = expected; a spec that departs from it says why.
  **May** = allowed.
- Every **must** cites where it comes from: a decision (`ADR-nnn`), an architecture section
  (`arch §n.n`, meaning STACK-D-ARCHITECTURE.md) or a Section 1 rule (`rule n`, arch §1.3). A bare `§n` refers to this standard.
- Items marked **[new]** are conventions this standard adds so that fifteen sensors built at different
  times stay consistent (naming, reason codes, file layout, versioning, budgets). They are binding:
  ADR-082 was approved by Davin on 30 September 2026.
- Example values come from the 18 Sep 20:55 example cycle (test data), as in the architecture.

## Contents

1. [What an MCD is](#1-what-an-mcd-is)
2. [The fifteen rules at a glance](#2-the-fifteen-rules-at-a-glance)
3. [Designing an MCD: the specification](#3-designing-an-mcd-the-specification)
4. [Inputs and data access](#4-inputs-and-data-access)
5. [Output: envelope v1, field by field](#5-output-envelope-v1-field-by-field)
6. [Pre-flight checks and status](#6-pre-flight-checks-and-status)
7. [States, bias and wording](#7-states-bias-and-wording)
8. [Levels](#8-levels)
9. [Dependencies, gates and synthesis](#9-dependencies-gates-and-synthesis)
10. [Routing, knowledge and languages](#10-routing-knowledge-and-languages)
11. [Engineering: package, interface, code](#11-engineering-package-interface-code)
12. [Tests](#12-tests)
13. [Lifecycle: from topic to live](#13-lifecycle-from-topic-to-live)
14. [Changing an MCD after go-live](#14-changing-an-mcd-after-go-live)
15. [Retrofitting MCD0–MCD3](#15-retrofitting-mcd0mcd3)
16. [What goes into STACK-D-ARCHITECTURE.md](#16-what-goes-into-stack-d-architecturemd)

- [Appendix A — Compliance checklist](#appendix-a--compliance-checklist)
- [Appendix B — Envelope JSON Schema (`mcd-output/1`)](#appendix-b--envelope-json-schema-mcd-output1)
- [Appendix C — Templates](#appendix-c--templates)
- [Appendix D — Reason codes](#appendix-d--reason-codes)

---

## 1. What an MCD is

An MCD is a **sensor**. Once per 5-minute cycle it answers **one question about one market
dimension**, from closed bars, as **one discrete state** with a bias, price levels and a one-line
summary. It is saved every cycle and read by synthesis, routing and the reply (architecture chapters 3–5).

An MCD does **not**:

- decide the trade direction (the synthesis rules do, ADR-025);
- size a position, set a stop or a target (Engine 4 does, chapter 6);
- talk to a language model, or run when a user asks a question (ADR-016, arch §2.2);
- quote probabilities, grades or unmeasured numbers (ADR-022, ADR-024).

**Topics are Davin's.** Each MCD captures a distinct dimension with its own principles, maths and
states. What is common to all MCDs is the engineering contract in this standard, not MCD1's domain
rules (kept from the hand-off report).

Three kinds of MCD ([new] names for existing ideas):

| Kind            | Reads                                                  | Example                           | Notes                                                                |
| --------------- | ------------------------------------------------------ | --------------------------------- | -------------------------------------------------------------------- |
| **Gate**        | Market data                                            | MCD0 (4-Quadrant channel quality) | Changes the _status_ of other sensors; has no direction (ADR-018)    |
| **Independent** | Market data                                            | MCD1, MCD2                        | Runs in parallel with other independent MCDs                         |
| **Derived**     | Other MCDs' readings of the same cycle (+ market data) | MCD3                              | Declares `depends_on`; never recomputes an upstream result (ADR-021) |

---

## 2. The fifteen rules at a glance

| #   | Rule                                                                                                                                         | Source                     |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| R1  | **Closed bars only.** Never read the still-open bar or the last price                                                                        | rule 2, ADR-011            |
| R2  | **One cycle, one slot.** Every input belongs to the cycle's slot; never "latest available"                                                   | rules 1, 5; ADR-008        |
| R3  | **Active indicator from the setting,** never inferred from which columns hold data                                                           | rule 6, ADR-010            |
| R4  | **Pure and deterministic.** Same inputs → byte-identical output: no clock, randomness, network, database or model calls inside the evaluator | arch §2.2                  |
| R5  | **Envelope v1, exactly.** No extra top-level fields                                                                                          | ADR-017, arch §2.3         |
| R6  | **One status scale** (VALID · CAUTIONARY · INVALID · STALE) with reason codes                                                                | arch §2.4                  |
| R7  | **Always emit, never throw.** Every cycle yields one envelope, including INVALID and STALE                                                   | arch §2.2                  |
| R8  | **Declare dependencies;** derived MCDs read readings, never recompute them                                                                   | ADR-021                    |
| R9  | **No unmeasured numbers or confidence words;** neutral state names                                                                           | ADR-022, ADR-024           |
| R10 | **Levels are named prices** with a timeframe the zone builder can use                                                                        | arch §2.3, §3.6            |
| R11 | **Canonical English** codes, summaries and commentary from fixed templates                                                                   | arch §4.3, hand-off report |
| R12 | **Runs only in the sensor worker,** once per cycle                                                                                           | ADR-016                    |
| R13 | **Versioned:** `evaluator_version` + `config_hash`; any output change starts a new statistics series                                         | arch §2.8                  |
| R14 | **Off until the checklist passes;** statistics measured before go-live                                                                       | arch §2.9                  |
| R15 | **Fits the budget:** envelope ≤ 600 tokens; evaluation ≤ 1 s **[new]**                                                                       | ADR-048                    |

Appendix A turns these into the checklist every MCD manifest must include.

---

## 3. Designing an MCD: the specification

Every MCD starts with a specification (`mcdN.md`) that Davin approves before any code is written
(hand-off workflow step 2; arch §2.9 item 1). The spec is written in English, like everything an MCD
session produces (codes, templates, the playbook chunk; R11); discussion with the builder may be in any language.

The spec **must** contain these sections (template in Appendix C.1):

| #   | Section               | What it settles                                                                                                                |
| --- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Question and purpose  | One-sentence question; what the answer is for: direction, entry zones, stops or caution                                        |
| 2   | Kind and horizon      | Gate / independent / derived; the trader horizon(s) its states will be measured on (Scalper 2 h, Day Trader 12 h, arch §2.8)   |
| 3   | Inputs                | Timeframe(s); tables and columns; `indicator_statistics` sources; upstream MCDs; the window in **closed bars**                 |
| 4   | Active-indicator use  | Which setting key(s) it reads, or "none"                                                                                       |
| 5   | Pre-flight checks     | The checks for tiers 1, 4, 2, 3 as they apply to this MCD, each with the status and reason code it produces (§6)               |
| 6   | Calculation           | Formulas with symbols and units; every threshold as a named parameter with value, inclusive / exclusive boundary and rationale |
| 7   | State register        | Every state: code, plain meaning, bias, levels contributed, summary and commentary templates (§7)                              |
| 8   | Levels                | Names, timeframe, how each is computed, role, zone width (§8)                                                                  |
| 9   | Synthesis role        | Precedence rung per trader type (arch §3.3); voter or modifier; proposed rule rows (Davin's to accept, §9)                     |
| 10  | Routing and knowledge | Intents that should route to it; outline of its playbook chunk (§10)                                                           |
| 11  | `details` contents    | Every field under `details`, with type and meaning (Section 5 reads it)                                                        |
| 12  | Worked example        | One real cycle (slot named) with inputs, state and levels                                                                      |
| 13  | Tests                 | The test list (§12), including one per state and one per boundary                                                              |
| 14  | Open questions        | Anything not yet decided                                                                                                       |

A spec **must not** contain: direction advice, sizing, probability or confidence language, or rules
that depend on who is asking (style and personal limits are applied in architecture chapters 5 and 6).

---

## 4. Inputs and data access

The sensor worker loads everything once per cycle and hands each MCD a frozen **input bundle**
(`CycleInputs`) **[new]**. The evaluator never queries a database or reads a file. This makes R4 and
replay possible: the same bundle can come from live tables, from point-in-time history or from a
test fixture.

| Input                    | Rule                                                                                                                                                                  | Source          |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| Bars                     | Closed bars only, ascending, counted back from the last closed bar of each timeframe; the window is defined in closed bars                                            | rule 2, ADR-011 |
| Forming bar / last price | **Not available to MCDs.** The labelled last price is for Section 5 only                                                                                              | rule 3          |
| M15 at non-M15 slots     | The last closed M15 bar; an unchanged M15 reading at :05 / :10 is correct                                                                                             | rule 1          |
| Statistics               | The `indicator_statistics` row captured at the slot where that timeframe was last collected, for the active source; no match → STALE                                  | rule 5          |
| Active indicator         | From the setting per timeframe; detection may only cross-check (mismatch → CAUTIONARY)                                                                                | rule 6, ADR-010 |
| Channel mode             | Dynamic or frozen, and the `config_hash` per source, from `indicator_configs`                                                                                         | arch §1.6       |
| Cycle status             | Data status and RETUNING flag, from `market_cycles`                                                                                                                   | rules 7, 9      |
| Upstream readings        | Same-cycle envelopes of the MCDs in `depends_on`                                                                                                                      | ADR-021         |
| Live vs certification    | Live runs read `market_data_v6`; certification replays read `market_data_point_in_time` (`snapshot_age_bars = 1`). **Same evaluator code**, different bundle provider | ADR-020         |
| Excel replica            | Test fixture only                                                                                                                                                     | arch §2.5       |

**`CycleInputs` fields** (fixed when Davin approved the kit plan on 30 September 2026; **PATCH** note,
version 1.0.1). The bundle is a frozen dataclass and every mapping in it is read-only after
construction. Implemented in `davintrade-stack-d-and-e/engine-1-5-new/mcd_common/cycle_inputs.py`.

| Field              | Type                              | Meaning                                                                                                                                                                                                               |
| ------------------ | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `symbol`           | str                               | `"XAUUSD"`                                                                                                                                                                                                            |
| `cycle_slot`       | str                               | The cycle, ISO 8601 UTC, e.g. `"2026-09-18T20:55Z"` (rule 1)                                                                                                                                                          |
| `data_status`      | str                               | `FRESH` · `DELAYED` · `STALE` · `MARKET_CLOSED` (rule 7)                                                                                                                                                              |
| `retuning`         | bool                              | A promote is in progress (rule 9)                                                                                                                                                                                     |
| `bars`             | `{timeframe: tuple of bars}`      | Closed bars only, ascending; keys are `market_data_v6` column names (rule 2). Read through `closed_bars(inputs, tf)`, which also drops any bar not closed at the slot                                                 |
| `statistics`       | `{(timeframe, source): row}`      | The `indicator_statistics` row captured at `stats_slot[timeframe]`, live-bar fields removed; a missing key means no row at the slot (rule 5)                                                                          |
| `stats_slot`       | `{timeframe: ISO 8601 UTC slot}`  | **Added by decision E1.** The slot where each timeframe was last collected: M5 every 5 minutes, M15 on :00, :15, :30 and :45. Tier 4 needs `captured_at == stats_slot[tf]`; no match gives STALE + `NO_STATS_AT_SLOT` |
| `active_indicator` | `{timeframe: indicator}`          | The setting per timeframe (rule 6)                                                                                                                                                                                    |
| `config_hash`      | `{source: hash}`                  | From `indicator_configs`                                                                                                                                                                                              |
| `channel_mode`     | `{source: "dynamic" or "frozen"}` | Architecture §1.6                                                                                                                                                                                                     |

Rules that come with the fields:

- **Strict slot rule; the tolerance lives in one place.** The PostgreSQL provider and every evaluator
  use the strict rule above. Only the Excel fixture provider tolerates a replica workbook that
  stamps each row with its export slot: it accepts a row when `captured_at` equals the export slot
  **and** `live_bar_ts` equals `stats_slot[tf]`, records it as captured at `stats_slot[tf]`, and drops
  any other row (which then gives STALE). The reason is written in each fixture's `<slot>.source.md`
  (decision E1).
- **No live-bar fields in the bundle.** Statistics fields that describe the forming bar
  (`live_bar_ts`, `live_close`, `baseline_value`, `uoedt_value`, `loedt_value`, `dist_to_*`,
  `channel_position`) or are measured from the last price (`sr_nearest_*`, `sr_dist_*_pts`) are
  removed. Evaluators use the fit descriptors and take prices from the last closed bar.

Window sizing: the spec states the maximum window. It **must** fit inside the 3,000-bar buffer; if a
cycle has fewer closed bars than the window needs, the result is INVALID with `INSUFFICIENT_BARS`.

---

## 5. Output: envelope v1, field by field

Every MCD returns exactly the envelope in arch §2.3 (ADR-017). No field may be added at the top level;
module-specific content goes in `details`. A new top-level field means a new schema version
(`mcd-output/2`) and a decision entry. The JSON Schema is in Appendix B.

| Field               | Required content                                                                                                                                                             |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `schema_version`    | `"mcd-output/1"`                                                                                                                                                             |
| `mcd_id`            | `"MCD0"` … `"MCD15"`. `SYN` is reserved for synthesis                                                                                                                        |
| `evaluator_version` | Semantic version (§14)                                                                                                                                                       |
| `cycle_slot`        | The slot in ISO 8601 UTC, e.g. `"2026-09-18T20:55Z"`                                                                                                                         |
| `last_closed_bar`   | Per timeframe read, the open time of the last closed bar in ISO 8601 UTC, e.g. `{"M5": "2026-09-18T20:50Z"}` **[new: full timestamp; the arch §2.3 example abbreviates it]** |
| `active_indicator`  | Per timeframe read, the setting's value; `{}` if the MCD reads no channel indicator                                                                                          |
| `config_hash`       | Per source read, from `indicator_configs`; `{}` if none                                                                                                                      |
| `status`            | VALID · CAUTIONARY · INVALID · STALE (§6)                                                                                                                                    |
| `status_reasons`    | Reason codes (Appendix D); empty only when VALID                                                                                                                             |
| `state_code`        | A code from the MCD's state register when VALID or CAUTIONARY; `null` when INVALID or STALE **[new clarification]**                                                          |
| `regime_status`     | Optional shared regime word (§7.3), or `null`                                                                                                                                |
| `bias`              | LONG · SHORT · NEUTRAL · STAND_ASIDE when VALID or CAUTIONARY; `null` when INVALID or STALE **[new clarification]**                                                          |
| `levels`            | Named prices (§8); `[]` when INVALID or STALE, or when the MCD contributes none                                                                                              |
| `depends_on`        | MCD ids read, e.g. `["MCD1","MCD2"]`; `[]` for independent MCDs and gates                                                                                                    |
| `summary_line`      | English, from a template, ≤ 80 characters, **no prices** (they are in `levels`) **[new]**; used on the sensor board (ADR-040)                                                |
| `commentary`        | English, from a template; may quote values from this reading (2 decimals for prices); no forecasts, probabilities or advice                                                  |
| `details`           | Module-specific object documented in spec section 11                                                                                                                         |

Rules on content:

- **No wall-clock time inside the envelope.** `evaluated_at` and run durations are written by the
  worker next to the stored row, not by the evaluator; otherwise replay could never be
  byte-identical (R4).
- **No parameters inside the envelope.** They are identified by `evaluator_version` and kept in the
  versioned parameter file (§11).
- **Size:** the serialised envelope, `details` included, **should** stay within **600 tokens**
  (starting value; measure with the model's tokenizer) so that three full readings and the zones fit
  Section 5's 2,000-token cap (ADR-048). Bulky diagnostics belong in logs, not in `details`.

---

## 6. Pre-flight checks and status

The order and the status scale are fixed for every MCD (arch §2.4): **cycle check → tier 1 → tier 4 →
tier 2 → tier 3**, then calculation. The content of each tier is adapted per MCD in spec section 5.
The first failing check decides the status; later checks do not run.

| Check                   | Typical content                                                         | On failure → status + reason                                                                                                          |
| ----------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Cycle                   | Data status is one of the four values; RETUNING flag                    | STALE + `DATA_STALE` · CAUTIONARY + `RETUNING` (continues) · INVALID + `SANITY_FAILED` for an unknown `data_status` **[new]**         |
| Tier 1 · Indicator      | Setting present for every timeframe read; detection agrees              | INVALID + `NO_SETTING` · CAUTIONARY + `DETECTION_MISMATCH` (continues)                                                                |
| Tier 4 · Statistics     | Row at the slot for the active source; containment ≥ 50% (channel MCDs) | STALE + `NO_STATS_AT_SLOT` · INVALID + `CONTAINMENT_LOW`                                                                              |
| Tier 2 · Continuity     | Enough closed bars; ascending; no nulls                                 | INVALID + `INSUFFICIENT_BARS` / `DISCONTINUITY`                                                                                       |
| Tier 3 · Sanity         | Values physically possible (e.g. UOEDT > LOEDT, width > 0)              | INVALID + `SANITY_FAILED`                                                                                                             |
| Upstream (derived only) | Required upstream readings usable                                       | CAUTIONARY + `UPSTREAM_CAUTIONARY:<id>` (continues) · INVALID + `UPSTREAM_UNAVAILABLE:<id>` · STALE + `UPSTREAM_STALE:<id>` **[new]** |
| MCD0 inheritance        | Applied by the worker, not the MCD (§9.2)                               | CAUTIONARY + `MCD0_DEFECT_<TF>`                                                                                                       |
| Unexpected error        | Any exception inside the evaluator                                      | INVALID + `EVALUATOR_ERROR`, error logged **[new]**                                                                                   |

A `data_status` outside the four values in §4 is a provider fault. It is the first thing the cycle
check tests, before STALE and RETUNING, so a cycle is never evaluated as if it were fresh: the reading is
INVALID + `SANITY_FAILED` (no new reason code).

CAUTIONARY readings keep their state, bias and levels; each reason is shown to traders (translated,
§10) and makes Section 6 pre-set half the risk (ADR-061). INVALID and STALE readings are saved but
left out of synthesis and listed as unavailable on the sensor board (arch §2.4, ADR-040).

Words such as `UNIDENTIFIED` or a state named `…_INVALID` are not used: failure is expressed by
`status`, never by a state.

---

## 7. States, bias and wording

### 7.1 The state register

Every state **must** have one entry (template in Appendix C.2):

| Field                    | Rule                                                                                                                                        |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `state_code`             | `MCD{n}_{PART}_{PART}…`: upper case, ASCII, `_` separators, ≤ 48 characters, prefixed with the MCD id **[new]** (MCD2 already follows this) |
| `meaning`                | One plain English sentence describing the market, not advice                                                                                |
| `bias`                   | LONG · SHORT · NEUTRAL · STAND_ASIDE (§7.2)                                                                                                 |
| `levels`                 | Which level names this state contributes, or none                                                                                           |
| `summary` / `commentary` | Template ids (§7.4)                                                                                                                         |
| `regime_status`          | Optional, from the shared vocabulary (§7.3)                                                                                                 |

The register **must** be exhaustive and exclusive: every VALID or CAUTIONARY evaluation maps to
exactly one state, and a test proves each state is reachable (§12).

### 7.2 Bias

`bias` is what this sensor alone suggests; synthesis decides the final direction (ADR-025).

- LONG / SHORT: the sensor's own logic points one way.
- NEUTRAL: the sensor sees no directional edge (e.g. mid-range).
- STAND_ASIDE: the sensor's own logic says not to take a view (e.g. MCD3's trend conflict). Any
  STAND_ASIDE sensor always reaches the prompt in full (ADR-041).
- Gates (MCD0) always report NEUTRAL.

### 7.3 Shared vocabulary

To keep synthesis rules and routing readable, reuse existing words when the meaning is the same
**[new]**: regime words such as `TREND_ALIGNED_CONTINUATION`, `COUNTER_TREND_EXPANSION`,
`BREAKOUT_SAME_SLOPE`, `CONSOLIDATION`, `RANGE_EXPANSION`; direction words `UP` · `DOWN` ·
`SIDEWAYS`; level names in §8. A new word is added to the register and to `tags.yaml` (arch §4.6) in the
same change.

### 7.4 Wording

- **Neutral names** (ADR-024). Codes and templates **must not** contain: `CONVICTION`,
  `PROBABILITY`, `CONFIDENCE`, `GRADE`, `GUARANTEED`, `SAFE`, `SURE`, `STRONG_BUY`, `STRONG_SELL`,
  `HIGH_CONVICTION`, or any percentage presented as a likelihood. Market terms that describe
  location (`PREMIUM`, `VALUE`, `OVEREXTENSION`) are fine.
- **No unmeasured numbers.** An MCD never outputs a probability or hit rate. Measured statistics
  come from `state_statistics` and are added by Section 5, always with n (ADR-022).
- **Templates, not free text.** Summary and commentary are filled from fixed English templates with
  values from the reading; no model writes them.
- Consistent with the wording guide (ADR-056): describe what the market is doing; never tell the
  trader what to do.

---

## 8. Levels

Levels are what entry zones, invalidation prices and room-to-target are built from (arch §3.6, ADR-031,
ADR-032). Each level is `{ "name", "tf", "price", "role" }` **[new: optional `role`]**:

| Field   | Rule                                                                                                           |
| ------- | -------------------------------------------------------------------------------------------------------------- |
| `name`  | From the shared list: `UOEDT`, `LOEDT`, `baseline`, `sr_1`…`sr_16`, or a new name registered in `tags.yaml`    |
| `tf`    | `M5` or `M15`                                                                                                  |
| `price` | The level's value valid at the cycle slot, computed from closed-bar data, rounded to 2 decimals at output only |
| `role`  | Optional: `support`, `resistance`, `mid`                                                                       |

- **Only structural prices.** Output a level only if the market is expected to react there. An MCD
  whose answer has no price meaning contributes none (`levels: []`).
- **Zone width must be computable.** The zone builder uses 10% of the source channel's width
  (ADR-031). Channel MCDs output both bounds (and the baseline). A non-channel MCD's spec **must**
  state which channel width applies to its levels (default: the active channel on the same
  timeframe) **[new]**.
- Channel MCDs output **UOEDT, baseline and LOEDT** for each timeframe they read (MCD1 must add the
  baseline, arch §2.5).

---

## 9. Dependencies, gates and synthesis

### 9.1 Dependencies

- `depends_on` lists every MCD whose reading is read (ADR-021). Dependencies form a graph with no
  cycles; the worker runs gates, then independent MCDs in parallel, then derived MCDs in dependency
  order (arch §2.2).
- A derived MCD **modifies** (confirms or cautions); it does not add a second vote for evidence it
  took from upstream (arch §3.3, mechanic 3).
- No MCD reads `SYN` or any per-user data.

### 9.2 Gates (MCD0)

MCD0 evaluates the 4-Quadrant criteria on each timeframe: coverage ≥ 60 bars; R² Model A ≥ 0.70,
Model B ≥ 0.65 (ADR-019); fit ratio 1.50–3.20; symmetry (geo ratio 0.60–1.65, |skew| ≤ 1.50). It emits
one envelope per cycle **[new clarification]**: its own status is VALID when it could measure; its
state says which timeframes fail (e.g. `MCD0_M5_DEFECT`), with per-timeframe results in `details`;
bias NEUTRAL; no levels. The **worker** then marks every channel MCD on a failing timeframe
CAUTIONARY with `MCD0_DEFECT_<TF>` (ADR-018). Each channel MCD declares `uses_channel` in the
registry so the worker knows which to mark (Appendix C.3).

### 9.3 Synthesis

- Each spec proposes its **precedence rung** for each trader type (arch §3.3): primary-timeframe structure, support &
  resistance, trendlines and channels, or oscillators. The rung can differ by trader type: MCD2 is
  primary structure for Scalpers but the timing channel for Day Traders. Davin decides the final rungs.
- An MCD's states enter synthesis only through the **rules table**: new or changed rows make a new
  rules version and a decision entry; the rule content is Davin's (ADR-026). The spec may propose
  rows.
- A new MCD must not change the result of an existing golden scenario unless Davin approves the new
  expected output (ADR-079).

---

## 10. Routing, knowledge and languages

| Item                   | Required for go-live                                                                                             | Source             |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------ |
| Dispatch matrix        | The intents (Direction, Entry timing, Exit / targets, Explain, …) that put this MCD in M\*                       | ADR-036, arch §4.5 |
| `tags.yaml`            | Its id, state codes, regime words and level names; the index build fails on unknown tags                         | arch §4.6          |
| Playbook chunk (D2)    | One English chunk per MCD with front-matter (`mcd_id`, `state_codes`, `timeframe`, `version`); approved by Davin | ADR-042            |
| Foundations chunk (D1) | What the MCD measures and how, in plain English                                                                  | arch §4.6          |
| Glossary               | Any new trading term a trader will see, in all 16 languages                                                      | ADR-038, ADR-081   |
| Reason texts           | Every reason code it can emit has a trader-facing text in all 16 languages                                       | ADR-081            |
| Labelled questions     | Questions that should route to it, in the labelled set, all 16 languages                                         | ADR-044            |

State codes are part of the retrieval query (ADR-043), so codes built from meaningful English
words help retrieval; opaque codes (`MCD7_S3`) do not.

---

## 11. Engineering: package, interface, code

### 11.1 Package

Every MCD, MCD0 to MCD15, retrofitted or new, has the **same folder** with the same file names. The
hand-off report's five deliverables stay; the rest is **[new]**:

```
engine-1-5-new/                       in davintrade-stack-d-and-e/ (not archive/)
├── mcd_common/                       shared kit every evaluator imports (walkthrough Part B2)
└── mcdN/                             N without a leading zero: mcd0, mcd4, mcd10
    ├── concept/                      Davin's concept board: annotated chart images, optional notes.md  [new]
    ├── concept.md                    the board restated in English as numbered rules; Davin confirms   [new]
    ├── mcdN.md                       specification (§3), approved by Davin
    ├── mcdN_implementation_plan.md   plan, approved before coding
    ├── mcdN_registry.yaml            registry entry + state register (Appendix C.2)                   [new]
    ├── mcdN_params.yaml              versioned parameters with rationale (Appendix C.3)               [new]
    ├── mcdN_evaluator.py             pure evaluator (§11.2)
    ├── test_mcdN_unit_tests.py       test suite (§12)
    ├── fixtures/                     per test slot: <slot>.inputs.json, <slot>.envelope.json,
    │                                 <slot>.source.md (workbook path and SHA-256)                     [new]
    ├── mcdN_output.json              envelope from one real cycle
    ├── mcdN-manifest-work-completion.md  hand-off manifest, including Appendix A
    └── legacy/                       MCD1–MCD3 only: the pre-retrofit evaluator, tests and output,
                                      read-only history                                                [new]
```

Folder rules **[new]**:

- Nothing else sits at the top of the folder: images go in `concept/`, workbooks stay where they
  are and are referenced from `<slot>.source.md`, and `__pycache__/` is not committed.
- `<slot>` in a file name is the cycle slot without the colon, because Windows forbids `:` in file
  names: `2026-09-18T2055Z.inputs.json` for slot `2026-09-18T20:55Z`.
- For MCD0 the concept comes from walkthrough Part C4; for MCD1, which has no board, `concept.md` is
  written from its spec. `concept/` may then be empty.
- `legacy/` is the only item that differs between retrofitted and new MCDs.

When the sensor worker exists (build step 3, arch §7.10), the evaluator, parameters and registry entry
are copied into the worker's codebase unchanged; the folder above stays the record.

### 11.2 Interface

```python
def evaluate(inputs: CycleInputs, params: Params, upstream: dict[str, Envelope]) -> Envelope:
    """Pure: no database, files, network, clock, randomness, environment variables or model calls."""
```

- The evaluator never raises: it catches its own errors and returns INVALID + `EVALUATOR_ERROR`
  (R7). The worker logs the exception with the slot.
- **Parameters** live in `mcdN_params.yaml` with value, unit and rationale. Changing one is a
  version change (§14). `target_indicator_override` and similar test switches exist only in tests
  (arch §2.6).
- **Numbers:** compute in full precision; round only at output (prices 2 decimals, angles 2
  decimals); each threshold comparison states ≥ or > in the spec and in code.
- **Budget [new]:** one evaluation ≤ 1 s on the worker; the whole cycle (all MCDs + synthesis) ≤ 30 s
  after the cycle-ready signal. Starting values, to measure.
- **Logging:** structured, keyed by `cycle_slot` and `mcd_id`; nothing printed.

---

## 12. Tests

The 13-test discipline of MCD1–MCD3 stays and is extended. Every MCD **must** have:

| #   | Test                            | Proves                                                                              |
| --- | ------------------------------- | ----------------------------------------------------------------------------------- |
| T1  | One test per state              | Every state in the register is reachable (§7.1)                                     |
| T2  | Boundary tests                  | Each threshold just below, at and just above its value                              |
| T3  | One test per pre-flight failure | Correct status and reason code for each check (§6)                                  |
| T4  | Forming bar                     | Appending an open bar to the fixture changes nothing (R1)                           |
| T5  | Wrong-slot statistics           | A statistics row from another slot gives STALE (R2)                                 |
| T6  | Setting                         | No setting → INVALID; detection mismatch → CAUTIONARY (R3)                          |
| T7  | Determinism                     | Two runs on the same bundle give byte-identical JSON (R4)                           |
| T8  | Schema                          | Output validates against `mcd-output/1` (Appendix B) (R5)                           |
| T9  | Replay                          | The stored fixture reproduces its expected envelope (arch §2.2)                     |
| T10 | Never throws                    | A corrupted bundle gives INVALID or STALE with an Appendix D code, no raise (R7)    |
| T11 | Wording                         | No banned word in codes or templates; no `%` in summary or commentary (R9)          |
| T12 | Size                            | The largest envelope stays within the token budget (R15)                            |
| T13 | Real data                       | One cycle from the fixture data gives the expected state                            |
| T14 | Derived only                    | Changing an upstream reading changes this MCD's reading in the same cycle (ADR-021) |

T10 accepts any INVALID or STALE reading whose reason codes are all in Appendix D: `EVALUATOR_ERROR` when
the evaluator catches the error itself (§11.2), or the code of the pre-flight check that caught the
corruption first. An unknown `data_status` is one such case: INVALID + `SANITY_FAILED` (§6).

Before go-live the MCD also joins the golden scenarios (ADR-079) and the labelled question set
(ADR-044), and its states are replayed on point-in-time history (arch §2.8).

---

## 13. Lifecycle: from topic to live

| Stage              | What happens                                                                                                               | Exit condition                                                     |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 1 Topic            | Davin names the question, timeframe and data                                                                               | Topic written down                                                 |
| 2 Spec             | `mcdN.md` and the implementation plan                                                                                      | **Davin approves**                                                 |
| 3 Build            | Evaluator, parameters, registry entry, tests                                                                               | All tests in §12 pass                                              |
| 4 Shadow **[new]** | Runs in the worker every cycle; saved to `mcd_outputs`; flag `shadow`: not on the board, not in synthesis                  | At least 5 trading days; no `EVALUATOR_ERROR`; status mix reviewed |
| 5 Certify          | Point-in-time replay → `state_statistics` per state and horizon (2 h, 12 h)                                                | Replay done; states below n ≥ 30 stay "provisional" (ADR-022)      |
| 6 Integrate        | Dispatch-matrix row, playbook and foundations chunks, tags, glossary, reason texts, labelled questions, proposed rule rows | Index build and labelled-set bars pass (ADR-044)                   |
| 7 Go live          | Flag `live`; registry row in the architecture (§16); new rules version if rows were accepted; decision entry               | **Davin approves**                                                 |
| 8 Maintain         | Changes follow §14                                                                                                         | —                                                                  |

The flag stays off until every item of the arch §2.9 checklist passes (R14). Each stage's inputs
and outputs are in [walkthrough Part D](MCD-RETROFIT-AND-CREATION-WALKTHROUGH.md#part-d--path-n-create-a-new-mcd); Davin's prompts are in the
[build user manual](STACK-D-BUILD-USER-MANUAL.md).

---

## 14. Changing an MCD after go-live

`evaluator_version` follows MAJOR.MINOR.PATCH **[new]**:

| Change                                                           | Version | Also required                                                                                 |
| ---------------------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------- |
| New or removed state, changed meaning, new level, new dependency | MAJOR   | Decision entry; spec, register, tags, playbook and rules reviewed; golden outputs re-approved |
| Threshold or parameter value                                     | MINOR   | Parameter rationale updated; golden outputs re-approved if they change                        |
| Fix that changes no output on the fixtures or golden scenarios   | PATCH   | Tests pass unchanged                                                                          |

Any MAJOR or MINOR change, and any new `config_hash` from the indicator side, **starts a new
statistics series** (arch §2.8): numbers measured on the old version are not quoted for the new one.

---

## 15. Retrofitting MCD0–MCD3

| MCD  | Work to comply                                                                                                                                                                                                                                                                              |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MCD0 | Build from [file C](../davintrade-stack-d-and-e/archive/STACK-D-ENGINE-1.5A-1.5B-1.5C-ARCHITECTURE-PLAN.md)'s 4-Quadrant gate as a gate MCD (§9.2); spec as `mcd0.md`                                                                                                                       |
| MCD1 | Envelope v1; add state codes (one per trend × regime); output the M15 baseline; N_micro in closed bars; breakout on the latest bar with `mcd1.md` corrected (ADR-023); `UNIDENTIFIED` → status INVALID with reason codes                                                                    |
| MCD2 | Envelope v1; setting instead of detection (override only in tests); rename the HIGH / LOW "probability" to a neutral setup flag; one failure status for tier 4 (INVALID vs UNIDENTIFIED)                                                                                                    |
| MCD3 | Envelope v1; `depends_on` MCD1, MCD2 and read their readings; neutral names instead of `HIGH_CONVICTION_BUY_DIP` and similar; `MCD3_INVALID` → status INVALID; commentary templates for all 10 states in the registry (the evaluator has all 10; its plan §6 lists 6), reworded to pass T11 |
| All  | Closed-bar view instead of the Excel replica (kept as fixture); statistics by slot, not `ORDER BY captured_at DESC LIMIT 1`; registry entry; parameters file; tests T1–T14                                                                                                                  |

Order of work, step by step: [walkthrough Part C](MCD-RETROFIT-AND-CREATION-WALKTHROUGH.md#part-c--path-r-retrofit-mcd0mcd3). Davin's prompts: [build user manual](STACK-D-BUILD-USER-MANUAL.md).

---

## 16. What goes into STACK-D-ARCHITECTURE.md

Not the MCDs themselves. The architecture holds the **contract** (this standard and chapter 2) and
one **registry row per MCD** (arch §2.13). Everything else has its own home:

| Item                                                                                  | Home                               |
| ------------------------------------------------------------------------------------- | ---------------------------------- |
| Question, maths, thresholds, states, `details`                                        | `mcdN.md` and `mcdN_registry.yaml` |
| Parameter values                                                                      | `mcdN_params.yaml`                 |
| How its states combine with others                                                    | The rules file (new rules version) |
| When it is routed                                                                     | The dispatch matrix (config)       |
| What traders and the model read about it                                              | Knowledge corpus D1 and D2 chunks  |
| Terms and reason texts in 16 languages                                                | Glossary and reason-text files     |
| That it went live, and why                                                            | A decision entry in `docs/adr/`    |
| Registry row: id, question, timeframe, kind, rung, levels, spec link, version, status | STACK-D-ARCHITECTURE.md §2.13      |

The architecture document changes beyond the registry row only when an MCD needs something the
contract does not allow (a new envelope field, a new status, a new level role). That is a decision
entry first, then an edit.

---

## Appendix A — Compliance checklist

Copy into every `mcdN-manifest-work-completion.md` and tick each line with evidence (test name, file
or link).

| #   | Check                                                                                         | Source |
| --- | --------------------------------------------------------------------------------------------- | ------ |
| A1  | Spec has all 14 sections and is approved by Davin                                             | §3     |
| A2  | Implementation plan approved before coding                                                    | §13    |
| A3  | Reads only the input bundle; no database, file, network, clock, randomness or model calls     | R4     |
| A4  | Closed bars only; forming bar and last price never used                                       | R1     |
| A5  | Statistics looked up by slot and active source; no match → STALE                              | R2     |
| A6  | Active indicator from the setting; mismatch → CAUTIONARY                                      | R3     |
| A7  | Output validates against `mcd-output/1`; no extra top-level fields                            | R5     |
| A8  | Pre-flight order cycle → 1 → 4 → 2 → 3; reason codes from Appendix D                          | §6     |
| A9  | Never throws; errors → INVALID + `EVALUATOR_ERROR`                                            | R7     |
| A10 | State register exhaustive and exclusive; codes follow §7.1                                    | §7     |
| A11 | Bias set per state; gates NEUTRAL; `null` when INVALID or STALE                               | §7.2   |
| A12 | No banned words, probabilities or unmeasured numbers                                          | R9     |
| A13 | Summary ≤ 80 characters, no prices; commentary from templates                                 | §5     |
| A14 | Levels named, per timeframe, 2 decimals; zone width defined                                   | §8     |
| A15 | `depends_on` complete; derived MCD modifies, does not re-vote                                 | §9     |
| A16 | `uses_channel` declared if it is a channel MCD                                                | §9.2   |
| A17 | Precedence rung proposed; rule rows proposed (not applied)                                    | §9.3   |
| A18 | Dispatch-matrix intents, tags, playbook and foundations chunks ready                          | §10    |
| A19 | Reason texts and new glossary terms in all 16 languages                                       | §10    |
| A20 | Parameters in `mcdN_params.yaml` with rationale                                               | §11    |
| A21 | Tests T1–T14 pass (T14 for derived MCDs)                                                      | §12    |
| A22 | Envelope ≤ 600 tokens; evaluation ≤ 1 s                                                       | R15    |
| A23 | Shadow period passed; point-in-time replay done; statistics stored                            | §13    |
| A24 | Added to golden scenarios and the labelled question set                                       | §12    |
| A25 | Registry row added to the architecture; decision entry written                                | §16    |
| A26 | Folder matches §11.1: same file names, `concept.md` confirmed, nothing extra at the top level | §11.1  |

---

## Appendix B — Envelope JSON Schema (`mcd-output/1`)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "mcd-output/1",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "schema_version",
    "mcd_id",
    "evaluator_version",
    "cycle_slot",
    "last_closed_bar",
    "active_indicator",
    "config_hash",
    "status",
    "status_reasons",
    "state_code",
    "regime_status",
    "bias",
    "levels",
    "depends_on",
    "summary_line",
    "commentary",
    "details"
  ],
  "properties": {
    "schema_version": { "const": "mcd-output/1" },
    "mcd_id": { "type": "string", "pattern": "^MCD([0-9]|1[0-5])$" },
    "evaluator_version": {
      "type": "string",
      "pattern": "^[0-9]+\\.[0-9]+\\.[0-9]+$"
    },
    "cycle_slot": {
      "type": "string",
      "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-5][05]Z$"
    },
    "last_closed_bar": {
      "type": "object",
      "propertyNames": { "enum": ["M5", "M15"] },
      "additionalProperties": {
        "type": "string",
        "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-5][05]Z$"
      }
    },
    "active_indicator": {
      "type": "object",
      "propertyNames": { "enum": ["M5", "M15"] },
      "additionalProperties": { "type": "string" }
    },
    "config_hash": {
      "type": "object",
      "additionalProperties": { "type": "string" }
    },
    "status": { "enum": ["VALID", "CAUTIONARY", "INVALID", "STALE"] },
    "status_reasons": {
      "type": "array",
      "items": { "type": "string", "pattern": "^[A-Z0-9_]+(:[A-Z0-9_]+)?$" }
    },
    "state_code": {
      "type": ["string", "null"],
      "pattern": "^MCD([0-9]|1[0-5])_[A-Z0-9_]+$",
      "maxLength": 48
    },
    "regime_status": { "type": ["string", "null"], "pattern": "^[A-Z0-9_]+$" },
    "bias": { "enum": ["LONG", "SHORT", "NEUTRAL", "STAND_ASIDE", null] },
    "levels": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["name", "tf", "price"],
        "properties": {
          "name": { "type": "string" },
          "tf": { "enum": ["M5", "M15"] },
          "price": { "type": "number" },
          "role": { "enum": ["support", "resistance", "mid"] }
        }
      }
    },
    "depends_on": {
      "type": "array",
      "uniqueItems": true,
      "items": { "type": "string", "pattern": "^MCD([0-9]|1[0-5])$" }
    },
    "summary_line": { "type": "string", "maxLength": 80 },
    "commentary": { "type": "string" },
    "details": { "type": "object" }
  },
  "allOf": [
    {
      "if": { "properties": { "status": { "enum": ["VALID", "CAUTIONARY"] } } },
      "then": {
        "properties": {
          "state_code": { "type": "string" },
          "bias": { "type": "string" }
        }
      }
    },
    {
      "if": { "properties": { "status": { "enum": ["INVALID", "STALE"] } } },
      "then": {
        "properties": {
          "state_code": { "const": null },
          "bias": { "const": null },
          "levels": { "maxItems": 0 }
        }
      }
    },
    {
      "if": {
        "properties": {
          "status": { "enum": ["CAUTIONARY", "INVALID", "STALE"] }
        }
      },
      "then": { "properties": { "status_reasons": { "minItems": 1 } } }
    }
  ]
}
```

---

## Appendix C — Templates

### C.1 Specification skeleton (`mcdN.md`)

```markdown
# MCDN: <name>

Status: Draft | Approved · Version: 1.0.0 · Kind: gate | independent | derived · Timeframe(s): M5 | M15

1. Question and purpose
2. Kind and horizon (Scalper 2 h / Day Trader 12 h)
3. Inputs (tables, columns, statistics sources, upstream MCDs, window in closed bars)
4. Active-indicator use
5. Pre-flight checks (tier 1, 4, 2, 3 → status + reason code)
6. Calculation (formulas; parameters with value, boundary, rationale)
7. State register (see mcdN_registry.yaml)
8. Levels (name, tf, computation, role, zone width)
9. Synthesis role (rung per trader type; voter or modifier; proposed rule rows)
10. Routing and knowledge (intents; playbook chunk outline)
11. details (every field, type, meaning)
12. Worked example (slot, inputs, state, levels)
13. Tests
14. Open questions
```

### C.2 Registry entry and state register (`mcdN_registry.yaml`)

```yaml
mcd_id: MCD2
name: M5 trend and corridor deviation
evaluator_version: 2.0.0
kind: independent # gate | independent | derived
timeframes: [M5]
depends_on: []
uses_channel: [M5] # timeframes on which MCD0 defects make this MCD CAUTIONARY
rung: # per trader type; values: primary_structure | support_resistance | trendlines_channels | oscillators
  DAY_TRADER: trendlines_channels
  SCALPER: primary_structure
flag: 'off' # off | shadow | live (quote it: an unquoted off is the boolean false in YAML 1.1)
spec: engine-1-5-new/mcd2/mcd2.md
params: engine-1-5-new/mcd2/mcd2_params.yaml
states:
  - code: MCD2_UP_IN_CORRIDOR
    meaning: M5 channel slopes up and price is inside the corridor.
    bias: LONG
    regime_status: TREND_ALIGNED_CONTINUATION
    levels: [UOEDT, baseline, LOEDT]
    summary: 'M5 uptrend, price inside the corridor'
    commentary: MCD2_T01
```

(Illustrative: the rungs shown are proposals; Davin decides rungs per §9.3.)

### C.3 Parameters file (`mcdN_params.yaml`)

```yaml
mcd_id: MCD2
evaluator_version: 2.0.0
parameters:
  sideways_angle_deg:
    {
      value: 5.0,
      unit: degrees,
      boundary: 'abs(angle) <= value is SIDEWAYS',
      why: '±5° trend band used by MCD1–MCD3',
    }
  min_containment_rate:
    {
      value: 50.0,
      unit: percent,
      boundary: '>= value passes tier 4',
      why: 'Channel considered intact at 50% containment',
    }
  min_window_bars:
    {
      value: 48,
      unit: closed M5 bars,
      boundary: '>= value',
      why: '4 hours of M5',
    }
```

---

## Appendix D — Reason codes

Codes are stable identifiers; the trader-facing text for each is kept per language (§10) **[new]**.

| Code                                 | Status     | Meaning                                                           |
| ------------------------------------ | ---------- | ----------------------------------------------------------------- |
| `DATA_STALE`                         | STALE      | The cycle's data status is STALE                                  |
| `RETUNING`                           | CAUTIONARY | A promote is in progress (ADR-015, proposed)                      |
| `NO_SETTING`                         | INVALID    | No active-indicator setting for a timeframe this MCD reads        |
| `DETECTION_MISMATCH`                 | CAUTIONARY | Detection from data disagrees with the setting                    |
| `NO_STATS_AT_SLOT`                   | STALE      | No `indicator_statistics` row at the slot for the active source   |
| `CONTAINMENT_LOW`                    | INVALID    | Containment below the MCD's floor (50% for channel MCDs)          |
| `INSUFFICIENT_BARS`                  | INVALID    | Fewer closed bars than the window needs                           |
| `DISCONTINUITY`                      | INVALID    | Bars out of order, missing or null                                |
| `SANITY_FAILED`                      | INVALID    | Values impossible (e.g. UOEDT ≤ LOEDT)                            |
| `UPSTREAM_CAUTIONARY:<id>`           | CAUTIONARY | A required upstream reading is CAUTIONARY                         |
| `UPSTREAM_UNAVAILABLE:<id>`          | INVALID    | A required upstream reading is INVALID                            |
| `UPSTREAM_STALE:<id>`                | STALE      | A required upstream reading is STALE                              |
| `MCD0_DEFECT_M5` / `MCD0_DEFECT_M15` | CAUTIONARY | Channel quality gate failed on that timeframe (set by the worker) |
| `EVALUATOR_ERROR`                    | INVALID    | Unexpected error inside the evaluator (logged)                    |

A new code is added here, to the trader-facing texts in all 16 languages, and to `tags.yaml` in the
same change.
