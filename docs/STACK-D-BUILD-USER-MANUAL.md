# Stack D — Build User Manual

|             |                                                                                                                                                                                                                                                                                                                                                                                |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Status**  | Version 1.4, 30 September 2026 (one fixed message to the advisor after every session)                                                                                                                                                                                                                                                                                          |
| **For**     | Davin. What you do, what you decide, and the prompt you paste at each step                                                                                                                                                                                                                                                                                                     |
| **Not for** | The agent. Its instructions are in [STACK-D-ARCHITECTURE.md](STACK-D-ARCHITECTURE.md) §7.10 (build steps), [MCD-RETROFIT-AND-CREATION-WALKTHROUGH.md](MCD-RETROFIT-AND-CREATION-WALKTHROUGH.md) (MCD task cards), [MCD-DEVELOPMENT-STANDARD.md](MCD-DEVELOPMENT-STANDARD.md) (MCD rules) and [STACK-D-ADVISOR-BRIEF.md](STACK-D-ADVISOR-BRIEF.md) (the advisor's instructions) |

## Contents

- [How to use this manual](#how-to-use-this-manual)
- [The overall order](#the-overall-order)
- [0. Before anything else: three decisions and the shared kit](#0-before-anything-else-three-decisions-and-the-shared-kit)
- [1. Build order roadmap](#1-build-order-roadmap)
- [2. Retrofit MCD2, then MCD1, then MCD3](#2-retrofit-mcd2-then-mcd1-then-mcd3)
- [3. Build MCD0](#3-build-mcd0)
- [4. Create a new MCD (MCD4 onwards)](#4-create-a-new-mcd-mcd4-onwards)
- [5. Change an MCD you have already built](#5-change-an-mcd-you-have-already-built)
- [6. Full review: MCD dependencies and synthesis rules](#6-full-review-mcd-dependencies-and-synthesis-rules)
- [7. Your advisor (Antigravity)](#7-your-advisor-antigravity)
- [Appendix — Every decision you will be asked for, across the whole build](#appendix--every-decision-you-will-be-asked-for-across-the-whole-build)

---

## How to use this manual

- **You never attach files.** Claude Code (or Antigravity) opens files in the repository itself; the
  prompt tells it which ones to read.
- **Every piece of work uses two sessions.**
  - **Session A** builds. It may stop and ask you something; answer in the chat, in any language.
    Everything it writes to files is in English.
  - **Session B** is always a **new session**. It checks session A's work without having seen it
    being built, so the work never grades itself.
- **When session A stops**, read what it wrote, answer its questions, then reply "approved" (or
  "confirmed" for a concept readback). It continues in the same session.
- **When session B finds failures**, copy its list into session A ("Fix these: …"), then run session B
  again in another new session.
- **When session B passes**, commit in session A, with the commit prompt the advisor gives you ("Commit
  this work." when nothing is open). The agent commits only when you ask, so each passed check becomes
  a point you can return to.
- **Database migrations**: the agent writes them as files; you apply them to production.
- Replace anything in `<angle brackets>` before pasting.

### Between sessions: the hand-off loop

Large work is split into parts, one session each; nothing is done "in one go". Every Claude Code
session ends by writing a **hand-off report** in `docs/handoffs/` (what it did, what it tested, what
is left, what it needs from you). Then:

1. Send your advisor in Antigravity this message. It is always the same, with nothing to fill in:

   ```text
   Read the newest hand-off report in docs/handoffs/ and write the next prompt, as your brief describes.
   ```

   Add one line only if something happened outside the reports, for example you committed yourself
   or changed a decision.

2. The advisor checks the report against the files and goes through every decision and surprise in
   it with you. Items that matter for the next task become extra lines in the prompt; items for later
   are recorded so they are not lost.
3. It gives you one of these, following the order of work below:
   - the session B prompt, when session A has finished;
   - a reply for session A with the fixes, when session B found failures;
   - the commit prompt for session A, when session B passed;
   - the prompt for the next piece of work.
4. Paste it where the advisor says: session A for fixes and the commit, a **new** Claude Code session
   for everything else.

The prompts in Sections 0–6 start each piece of work; the advisor writes the prompts that continue
it. Each session reads only the part of the architecture its step needs, not the whole document.

---

## The overall order

| #   | When                   | What                                                                                                                                   | Section |
| --- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 1   | First, once            | Three decisions and the shared kit `mcd_common/`                                                                                       | 0       |
| 2   | Next                   | Retrofit MCD2 → MCD1 → MCD3, on test data                                                                                              | 2       |
| 3   | Then                   | Build MCD0, on test data                                                                                                               | 3       |
| 4   | Then                   | Your changes to MCD2 → MCD1 → MCD3 (same order as the retrofit)                                                                        | 5       |
| 5   | Then                   | Build step 2: Market data & chart                                                                                                      | 1       |
| 6   | Then, in order         | Build steps 3 → 7: Sensors → Synthesis → Engine 4 & Report 2 → Intake & knowledge → Prompt & reply, with chapter 7 alongside steps 4–7 | 1       |
| —   | Any time after the kit | Create a new MCD (MCD4 onwards)                                                                                                        | 4       |
| —   | When needed            | Change an MCD you have already built                                                                                                   | 5       |
| —   | Occasionally           | Full review of MCD dependencies and synthesis rules                                                                                    | 6       |

Keep the retrofit and your changes as two separate passes (rows 2 and 4). The retrofit proves the
new version gives the same results as the old code; your changes are then measured against that
proven baseline. Change MCD2 and MCD1 before MCD3, because MCD3 reads both.

MCDs are finished on test data first and stay switched off. They run live, collect statistics and go
live as build steps 3–6 are completed (Section 1 says where).

### When Stack D reaches its MVP

Stack D is a complete MVP when all of these are true:

- build steps 2–7 have passed their session B checks, and the chapter 7 items (trace, entitlements,
  dashboard, alerts, retention) are built;
- MCD0–MCD3 have run in shadow, been certified and gone live (states with fewer than 30 measured
  cases are shown as "provisional", with words and no numbers, which is expected at launch);
- you have approved the rules table and the golden scenarios, and the default and fallback models
  have passed the evaluation;
- counsel has reviewed the disclaimers, consent wording, wording guide, retention and privacy notice
  for your launch markets.

MCD4–MCD15 and the roadmap items in architecture §7.10 (alerts to traders when a state changes,
memory of past setups, each trader's time zone, per-broker specs) come after the MVP.

---

## 0. Before anything else: three decisions and the shared kit

**Decide first** (the recommendation is in brackets):

| #   | Decision                                                             | Recommendation                                                                                                                                                                                                                                |
| --- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Approve the MCD development standard (ADR-082)                       | Approve                                                                                                                                                                                                                                       |
| D2  | The active indicator per timeframe in each test dataset              | v1: M5 `best_fit_a`, M15 `non_b` (as certified). v4: M5 `cherry_a`, M15 `non_b` (both `non_a` and `non_b` are populated; `non_b` matches v1). These apply to test data only; in live running the setting decides, and it can be any candidate |
| D3  | When the tier-1 check reports "detection disagrees with the setting" | Only when the set indicator has no value on the last closed bar while another candidate has. Other populated candidates (the fractal EDT is always there on M5) are recorded but do not change the status                                     |

**Session A** — builds `engine-1-5-new/mcd_common/`, records your D1 approval, adds the banners that
retire the old hand-off report and Thai prompt. It stops once with a short plan; approve it.

```text
Repository: D:\SaaS Project\trading-alerts-saas-public
Read docs/MCD-DEVELOPMENT-STANDARD.md and docs/MCD-RETROFIT-AND-CREATION-WALKTHROUGH.md.
Follow the builder rules in the walkthrough's Part E, then do task P1.
My decisions: D1 approved. D2: v1 = M5 best_fit_a, M15 non_b; v4 = M5 cherry_a, M15 non_b. D3 as recommended.
```

**Session B** (new session):

```text
Repository: D:\SaaS Project\trading-alerts-saas-public
Read docs/MCD-DEVELOPMENT-STANDARD.md and docs/MCD-RETROFIT-AND-CREATION-WALKTHROUGH.md.
Follow the builder rules in the walkthrough's Part E, then do task P6 for the kit.
```

---

## 1. Build order roadmap

Six build steps, in this order. Each one is a chapter of the architecture, and each chapter ends with
a "Done when" list that session B checks. Build step 2 can start while the MCD work in Sections 2–3
is going on; each later step needs the one before it.

The prompts for every step follow one pattern; only the last line changes.

### Step 2 — Market data & chart (chapter 1)

**What gets built:** the 5-minute cycles and their ready signal, data status (FRESH, DELAYED, STALE,
MARKET CLOSED), the closed-bar view, `symbol_specs`, the stamped chart.
**You decide:** settle the four "documents disagree" items in architecture §0.5; after the first
measured cycle, confirm the freshness thresholds (ADR-012). ADR-015 (RETUNING during a promote) is
settled (1 October 2026). You apply the database migrations.

Session A:

```text
Repository: D:\SaaS Project\trading-alerts-saas-public
Read CLAUDE.md and "Running a build step" in docs/STACK-D-ARCHITECTURE.md §7.10; read other parts only as it directs.
Follow it as session A, for build step 2 (chapter 1, Market data & chart).
```

Session B (new session):

```text
Repository: D:\SaaS Project\trading-alerts-saas-public
Read CLAUDE.md and "Running a build step" in docs/STACK-D-ARCHITECTURE.md §7.10; read other parts only as it directs.
Follow it as session B, for build step 2 (chapter 1, Market data & chart).
```

### Step 3 — Sensors (chapter 2)

**What gets built:** the sensor worker on Railway, the database version of the test-data loader,
`mcd_outputs`, and the historical replay that fills `state_statistics`. Every MCD built so far starts
running in shadow (saved every cycle, not shown to traders).
**You decide:** after at least 5 trading days of shadow running, review each MCD's status mix and
MCD0's flag rate. If MCD0 flags most cycles, its thresholds need a decision before anything goes live.

Session A:

```text
Repository: D:\SaaS Project\trading-alerts-saas-public
Read CLAUDE.md and "Running a build step" in docs/STACK-D-ARCHITECTURE.md §7.10; read other parts only as it directs.
Follow it as session A, for build step 3 (chapter 2, Sensors).
```

Session B (new session):

```text
Repository: D:\SaaS Project\trading-alerts-saas-public
Read CLAUDE.md and "Running a build step" in docs/STACK-D-ARCHITECTURE.md §7.10; read other parts only as it directs.
Follow it as session B, for build step 3 (chapter 2, Sensors).
```

### Step 4 — Synthesis & entry zones (chapter 3)

**What gets built:** the rules table as a versioned file, the synthesis reading for Day Trader and
Scalper, the entry-zone builder, the first golden scenarios (reference cycles with approved results).
**You decide:** the content of the rules table (architecture §3.4 is a starting draft); which rule
rows proposed by the MCD specs to accept; approve the golden scenarios.

**Before this step: review your design folders.** Six folders of your earlier designs sit in
`seed-code/txtai/` (chat UI, incoming chat alerts, markdown memory and transcripts, RAG scalability,
trading-strategy mode, dynamic chart and card). Until reviewed they are background only. In your
advisor's session:

```text
Do the design-folder review in your brief, section 9.
```

It classifies each part as kept, background, superseded or out of scope, and after your decisions
gives you the prompt that has Claude Code record the result in the architecture.

Session A:

```text
Repository: D:\SaaS Project\trading-alerts-saas-public
Read CLAUDE.md and "Running a build step" in docs/STACK-D-ARCHITECTURE.md §7.10; read other parts only as it directs.
Follow it as session A, for build step 4 (chapter 3, Synthesis & entry zones).
```

Session B (new session):

```text
Repository: D:\SaaS Project\trading-alerts-saas-public
Read CLAUDE.md and "Running a build step" in docs/STACK-D-ARCHITECTURE.md §7.10; read other parts only as it directs.
Follow it as session B, for build step 4 (chapter 3, Synthesis & entry zones).
```

### Step 5 — Engine 4 & Report 2 (chapter 6)

**What gets built:** the offer check, news blackout, sizing, the single validator, Report 2 from its
fixed template, the consent record.
**You decide:** have counsel review the disclaimers and consent wording (this can run in parallel).

Session A:

```text
Repository: D:\SaaS Project\trading-alerts-saas-public
Read CLAUDE.md and "Running a build step" in docs/STACK-D-ARCHITECTURE.md §7.10; read other parts only as it directs.
Follow it as session A, for build step 5 (chapter 6, Engine 4 & Report 2).
```

Session B (new session):

```text
Repository: D:\SaaS Project\trading-alerts-saas-public
Read CLAUDE.md and "Running a build step" in docs/STACK-D-ARCHITECTURE.md §7.10; read other parts only as it directs.
Follow it as session B, for build step 5 (chapter 6, Engine 4 & Report 2).
```

### Step 6 — Intake, routing & knowledge (chapter 4)

**What gets built:** the session gate, language handling, the dispatch matrix, the knowledge corpus
and its index, the glossary and reason texts in 16 languages, the labelled question set. Each MCD
gets its routing row and its knowledge chunks.
**You decide:** approve each knowledge area before it is built, and each MCD's playbook chunk.

Session A:

```text
Repository: D:\SaaS Project\trading-alerts-saas-public
Read CLAUDE.md and "Running a build step" in docs/STACK-D-ARCHITECTURE.md §7.10; read other parts only as it directs.
Follow it as session A, for build step 6 (chapter 4, Intake, routing & knowledge).
```

Session B (new session):

```text
Repository: D:\SaaS Project\trading-alerts-saas-public
Read CLAUDE.md and "Running a build step" in docs/STACK-D-ARCHITECTURE.md §7.10; read other parts only as it directs.
Follow it as session B, for build step 6 (chapter 4, Intake, routing & knowledge).
```

**After step 6, MCDs can go live**, one at a time, once each has passed shadow running and
certification. Session A:

```text
Repository: D:\SaaS Project\trading-alerts-saas-public
Read docs/MCD-DEVELOPMENT-STANDARD.md and docs/MCD-RETROFIT-AND-CREATION-WALKTHROUGH.md.
Follow the builder rules in the walkthrough's Part E, then take MCD2 live as Part D stage 7 describes.
```

Session B (new session): `…then do task P6 for MCD2.` (the three-line MCD prompt; see Section 2).

### Step 7 — Prompt & AI reply (chapter 5)

**What gets built:** the answer gate, the prompt assembler, Report 1 as checked data, the number and
wording checks, the model gateway and evaluation suite, metering.
**You decide:** the share of the Pro price allowed for model spend (sets the quota); which models
pass the evaluation (one default and one fallback at launch); counsel review of the wording guide.

Session A:

```text
Repository: D:\SaaS Project\trading-alerts-saas-public
Read CLAUDE.md and "Running a build step" in docs/STACK-D-ARCHITECTURE.md §7.10; read other parts only as it directs.
Follow it as session A, for build step 7 (chapter 5, Prompt & AI reply).
```

Session B (new session):

```text
Repository: D:\SaaS Project\trading-alerts-saas-public
Read CLAUDE.md and "Running a build step" in docs/STACK-D-ARCHITECTURE.md §7.10; read other parts only as it directs.
Follow it as session B, for build step 7 (chapter 5, Prompt & AI reply).
```

### Alongside steps 4–7 — Platform & governance (chapter 7)

**What gets built:** the trace, the entitlement table, the operations dashboard and alerts,
retention. **You decide:** the tier amounts after measurement; counsel review of retention figures
and the privacy notice.

Session A:

```text
Repository: D:\SaaS Project\trading-alerts-saas-public
Read CLAUDE.md and "Running a build step" in docs/STACK-D-ARCHITECTURE.md §7.10; read other parts only as it directs.
Follow it as session A, for the chapter 7 items built alongside steps 4–7 (Platform & governance, done when §7.13).
```

Session B (new session):

```text
Repository: D:\SaaS Project\trading-alerts-saas-public
Read CLAUDE.md and "Running a build step" in docs/STACK-D-ARCHITECTURE.md §7.10; read other parts only as it directs.
Follow it as session B, for the chapter 7 items built alongside steps 4–7 (Platform & governance, done when §7.13).
```

---

## 2. Retrofit MCD2, then MCD1, then MCD3

Do Section 0 first. The order matters: MCD2 is the simplest (one timeframe, codes already in the
right format), and MCD3 reads MCD1 and MCD2, so it comes last.

Each retrofit has one stop in session A. The agent moves the old code to `legacy/`, moves your concept
images into `concept/`, writes `concept.md`, rewrites the spec in English and writes a plan. You read
`concept.md` and the spec, answer its questions, and reply "approved". It then rebuilds the code and
tests in the same session.

### MCD2

**At the stop you decide:** D5, whether to rename the regime words that contain BUY / SELL /
OPPORTUNITY (proposed: `UPTREND_DIP_BELOW_CORRIDOR`, `DOWNTREND_RALLY_ABOVE_CORRIDOR`).

Session A:

```text
Repository: D:\SaaS Project\trading-alerts-saas-public
Read docs/MCD-DEVELOPMENT-STANDARD.md and docs/MCD-RETROFIT-AND-CREATION-WALKTHROUGH.md.
Follow the builder rules in the walkthrough's Part E, then do task P2 for MCD2, and after my approval do task P3 for MCD2.
```

Session B (new session):

```text
Repository: D:\SaaS Project\trading-alerts-saas-public
Read docs/MCD-DEVELOPMENT-STANDARD.md and docs/MCD-RETROFIT-AND-CREATION-WALKTHROUGH.md.
Follow the builder rules in the walkthrough's Part E, then do task P6 for MCD2.
```

### MCD1

**At the stop you decide:** D6, the bias for each of MCD1's nine states. MCD1 has no concept board,
so its `concept.md` is written from `mcd1.md`; check that it states your principles correctly.

Session A:

```text
Repository: D:\SaaS Project\trading-alerts-saas-public
Read docs/MCD-DEVELOPMENT-STANDARD.md and docs/MCD-RETROFIT-AND-CREATION-WALKTHROUGH.md.
Follow the builder rules in the walkthrough's Part E, then do task P2 for MCD1, and after my approval do task P3 for MCD1.
```

Session B (new session):

```text
Repository: D:\SaaS Project\trading-alerts-saas-public
Read docs/MCD-DEVELOPMENT-STANDARD.md and docs/MCD-RETROFIT-AND-CREATION-WALKTHROUGH.md.
Follow the builder rules in the walkthrough's Part E, then do task P6 for MCD1.
```

### MCD3

**At the stop you decide:**

- D10, which EDT Stochastic formula you intend. Your concept board says (UOEDT − SSA) ÷ (UOEDT −
  LOEDT) × 100; the spec and code compute (SSA − LOEDT) ÷ (UOEDT − LOEDT) × 100. They are mirror
  images, so the value and premium zones swap.
- D6, the bias for each of MCD3's ten states.
- D7, MCD3's levels (recommended: keep UOEDT and LOEDT on both timeframes and add the two baselines).

Session A:

```text
Repository: D:\SaaS Project\trading-alerts-saas-public
Read docs/MCD-DEVELOPMENT-STANDARD.md and docs/MCD-RETROFIT-AND-CREATION-WALKTHROUGH.md.
Follow the builder rules in the walkthrough's Part E, then do task P2 for MCD3, and after my approval do task P3 for MCD3.
```

Session B (new session):

```text
Repository: D:\SaaS Project\trading-alerts-saas-public
Read docs/MCD-DEVELOPMENT-STANDARD.md and docs/MCD-RETROFIT-AND-CREATION-WALKTHROUGH.md.
Follow the builder rules in the walkthrough's Part E, then do task P6 for MCD3.
```

---

## 3. Build MCD0

Any time after Section 0. MCD0 is the channel quality check (coverage, R², fit ratio, symmetry on
M5 and M15). It needs no concept board: its concept is already written in the walkthrough.

Session A stops twice, like a new MCD: first with `mcd0/concept.md`, written from the walkthrough and
ending with six open questions; then with the spec. Suggested answers to the six questions:

| #   | Question                                                                        | Suggested answer                                                                                                                                  |
| --- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| a   | Which statistics field counts the bars the channel covers (minimum 60)?         | `window_span_bars` ("bars from the leftmost evaluated bar to the live bar"), matching the old plan's definition                                   |
| b   | Fit ratio: each model's own error measure, or the close-price model's for both? | Each model's own; on the test data the results barely differ                                                                                      |
| c   | Keep the channel-symmetry check (geo ratio 0.60–1.65)?                          | Keep it, and measure how often it fails during shadow running                                                                                     |
| d   | Apply the R² check to flat channels?                                            | No: skip it when the active indicator's `regression_angle` is within ±5° (SIDEWAYS), whichever indicator is active. Have it written into the spec |
| e   | What if the active indicator has no Model A values (the fractal EDT)?           | Model A is "not applicable"; judge that timeframe on Model B                                                                                      |
| f   | Include variance ratio and kurtosis?                                            | Yes, in `details`, as information only                                                                                                            |

Expect MCD0 to flag both timeframes on the test data; its thresholds are starting values, checked
during shadow running (Section 1, step 3).

Session A:

```text
Repository: D:\SaaS Project\trading-alerts-saas-public
Read docs/MCD-DEVELOPMENT-STANDARD.md and docs/MCD-RETROFIT-AND-CREATION-WALKTHROUGH.md.
Follow the builder rules in the walkthrough's Part E, then do task P4 for MCD0, and after my approval do task P5 for MCD0.
```

Session B (new session):

```text
Repository: D:\SaaS Project\trading-alerts-saas-public
Read docs/MCD-DEVELOPMENT-STANDARD.md and docs/MCD-RETROFIT-AND-CREATION-WALKTHROUGH.md.
Follow the builder rules in the walkthrough's Part E, then do task P6 for MCD0.
```

---

## 4. Create a new MCD (MCD4 onwards)

Any time after Section 0. The example uses MCD4; change the number for later MCDs (`mcd10`, not
`mcd010`).

### Step 1 — Make the concept board

Explain the MCD on the chart, as you did for MCD2 and MCD3: one or more annotated screenshots, in any
language. Save them in `davintrade-stack-d-and-e/engine-1-5-new/mcd4/concept/` as
`mcd4-concept-1.png`, `mcd4-concept-2.png` and so on. A short `notes.md` in the same folder can add
what an image cannot show.

A complete board shows:

| #   | Show                                                                                         | Example (your MCD3 board)                                                                          |
| --- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| 1   | The core principle: the question the MCD answers                                             | "Consolidated Trend and EDT Stochastic"                                                            |
| 2   | Timeframe(s), and which indicators may be the active one                                     | M15 channel + M5 channel                                                                           |
| 3   | The rules: each condition, formula and threshold                                             | Same trend on both; M5 inside M15 for ≥ 75% of the M5 EDT length; M5 inside M15 on the current bar |
| 4   | The situations, each marked on the chart                                                     | Consolidated vs not consolidated                                                                   |
| 5   | What each situation means for a trader                                                       | "Strongly confirmed trend"                                                                         |
| 6   | When there is no answer                                                                      | "No consolidated trend → EDT Stochastic unavailable"                                               |
| 7   | The date and time of the bars you marked                                                     | 2026.09.16 05:45 and 2026.09.21 12:45                                                              |
| 8   | Levels: the prices where the market is expected to react, if any (they feed the entry zones) | MCD2: UOEDT, baseline, LOEDT on M5                                                                 |

Anything missing becomes a question from the agent, so the board does not have to be perfect.

### Step 2 — Session A

It stops twice:

1. **Readback.** It writes `mcd4/concept.md`: your board as numbered English rules, with questions
   where the board could be read two ways. Check each rule against your board, correct it, and reply
   "confirmed".
2. **Spec.** It drafts the spec, registry, parameters and plan. Answer its questions, set the bias of
   each state, reply "approved". It then builds.

```text
Repository: D:\SaaS Project\trading-alerts-saas-public
Read docs/MCD-DEVELOPMENT-STANDARD.md and docs/MCD-RETROFIT-AND-CREATION-WALKTHROUGH.md.
Follow the builder rules in the walkthrough's Part E, then do task P4 for MCD4, and after my approval do task P5 for MCD4.
```

### Step 3 — Session B (new session)

```text
Repository: D:\SaaS Project\trading-alerts-saas-public
Read docs/MCD-DEVELOPMENT-STANDARD.md and docs/MCD-RETROFIT-AND-CREATION-WALKTHROUGH.md.
Follow the builder rules in the walkthrough's Part E, then do task P6 for MCD4.
```

The MCD is then finished on test data and switched off. It starts shadow running with build step 3,
and it affects the bias and the entry zones only after you accept rule rows for it.

---

## 5. Change an MCD you have already built

Use this for any MCD built to the standard, including MCD1–MCD3 once retrofitted. Do not run the
retrofit or new-MCD prompts again on it: they start from scratch.

For your planned changes to MCD1–MCD3 (row 4 of the overall order), do MCD2, then MCD1, then MCD3,
one MCD at a time: each change re-runs the tests of the MCDs that read it, and MCD3 reads both.

### Step 1 — Commit the current state

In any Claude Code session: "Commit the current state." You can return to it if the change goes
wrong.

### Step 2 — Add the new concept board

Add the new or corrected images to the MCD's `concept/` folder with a version in the name, for
example `mcd3-concept-v2.png`. Keep the old images. If the change is only a number (for example
75% → 70%), skip the board and write the number in the prompt.

### Step 3 — Session A

It compares the new board with `concept.md`, lists every rule added, changed or removed, says how big
the change is and what else it touches (other MCDs that read this one, rule rows, golden scenarios),
and stops. Confirm or correct the list; it then updates the spec, code and tests.

```text
Repository: D:\SaaS Project\trading-alerts-saas-public
Read docs/MCD-DEVELOPMENT-STANDARD.md and docs/MCD-RETROFIT-AND-CREATION-WALKTHROUGH.md.
Follow the builder rules in the walkthrough's Part E, then do task P7 for MCD3: <one line on what you changed>.
```

### Step 4 — Session B (new session)

```text
Repository: D:\SaaS Project\trading-alerts-saas-public
Read docs/MCD-DEVELOPMENT-STANDARD.md and docs/MCD-RETROFIT-AND-CREATION-WALKTHROUGH.md.
Follow the builder rules in the walkthrough's Part E, then do task P6 for MCD3.
```

What gets checked depends on the size of the change:

| Change                                                      | Other MCDs that read this one              | Synthesis rules                                                        |
| ----------------------------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------- |
| A fix that changes no output                                | Nothing                                    | Nothing                                                                |
| A threshold only                                            | Their tests re-run; no review              | No rule changes; you re-approve any golden scenario whose result moves |
| States added, renamed or removed; meaning or levels changed | Reviewed if they read a state that changed | Rows that name this MCD's states are reviewed                          |

---

## 6. Full review: MCD dependencies and synthesis rules

Not after every change. Run it:

- after a batch of new MCDs (for example every three to five);
- when the statistics reach 30 or more samples for many states;
- when the log of cycles where no rule matched shows the same gap again and again.

It checks that every MCD that reads another still finds the states and fields it expects, then
reviews the whole rules table and proposes one new rules version, with the cycles whose bias or zones
would change. Before synthesis is built (build step 4), it reviews the draft rules in the
architecture (§3.4).

**Session A** stops with the proposal. Accept, edit or reject each change; after your approval, the
same session writes the rules file and the decision entry.

```text
Repository: D:\SaaS Project\trading-alerts-saas-public
Read docs/MCD-DEVELOPMENT-STANDARD.md and docs/MCD-RETROFIT-AND-CREATION-WALKTHROUGH.md.
Follow the builder rules in the walkthrough's Part E, then do task P8.
```

**Session B** (new session) — use the version number session A wrote:

```text
Repository: D:\SaaS Project\trading-alerts-saas-public
Read docs/MCD-DEVELOPMENT-STANDARD.md and docs/MCD-RETROFIT-AND-CREATION-WALKTHROUGH.md.
Follow the builder rules in the walkthrough's Part E, then do task P6 for rules version <version>.
```

---

## 7. Your advisor (Antigravity)

Use Antigravity as your advisor when Claude Code stops with something you are unsure about: a
question you cannot answer straight away, a check that keeps failing, two documents that disagree,
or anything unexpected. The advisor reads the same documents as the builder, tells you what is
already settled, lays out the options when it is not, recommends one, and writes the reply for you
to paste back into Claude Code.

It only advises: it does not change files, commit or decide for you. Its standing instructions are in
[STACK-D-ADVISOR-BRIEF.md](STACK-D-ADVISOR-BRIEF.md), so the prompts below stay short and never go
out of date.

**Start an advisor session** in Antigravity. Start a new one when a new build step begins, so it
reads the current documents:

```text
Repository: D:\SaaS Project\trading-alerts-saas-public
Read docs/STACK-D-ADVISOR-BRIEF.md and the files it lists, then act as my advisor for the Stack D build.
Start with a short summary of where the build stands, then wait for my first issue.
```

**For each issue**, paste what Claude Code said:

```text
Claude Code stopped during <build step 3 / task P3 for MCD2 / …> with this:
<paste Claude Code's message>
Advise me as your brief describes.
```

**After every Claude Code session**, send the advisor the fixed message in "Between sessions" at the
top, and it writes the next prompt.

The advisor answers with what is settled, the options, its recommendation, which parts are your call,
and a reply in English. Paste that reply into Claude Code's session A. If the advice changes a
document or a decision, Claude Code makes the change after you approve it; the advisor never does.

---

## Appendix — Every decision you will be asked for, across the whole build

MCD0's six questions are one row here (D8); the rest cover the shared kit, the retrofits and the
build steps.

| #   | Decision                                                                       | When                       | Recommendation                                                  |
| --- | ------------------------------------------------------------------------------ | -------------------------- | --------------------------------------------------------------- |
| D1  | Approve the MCD development standard                                           | Section 0                  | Approve                                                         |
| D2  | Active indicators for the test datasets                                        | Section 0                  | See Section 0                                                   |
| D3  | When tier 1 reports a detection mismatch                                       | Section 0                  | Only when the set indicator has no value on the last closed bar |
| D5  | MCD2 regime words with BUY / SELL / OPPORTUNITY                                | MCD2 retrofit              | Rename                                                          |
| D6  | Bias for each state of MCD1 and MCD3                                           | MCD1 and MCD3 retrofits    | Yours; the agent offers starting points                         |
| D7  | MCD3 levels                                                                    | MCD3 retrofit              | Keep, and add the two baselines                                 |
| D8  | MCD0 questions (a)–(f)                                                         | Section 3                  | See Section 3                                                   |
| D10 | MCD3 EDT Stochastic formula direction                                          | MCD3 retrofit              | State which one you intend                                      |
| —   | The four §0.5 items, freshness thresholds (ADR-015 settled 1 Oct 2026)         | Build step 2               | —                                                               |
| —   | Which parts of your six design folders to keep                                 | Before build step 4        | Your advisor recommends                                         |
| —   | Rules table content, accepted rule rows, golden scenarios                      | Build step 4               | —                                                               |
| —   | Knowledge areas and playbook chunks                                            | Build step 6               | —                                                               |
| —   | Model-spend share, passed models, tier amounts                                 | Build step 7 and chapter 7 | —                                                               |
| —   | Counsel review: disclaimers, consent, wording guide, retention, privacy notice | Steps 5, 7 and chapter 7   | Start early; it runs in parallel                                |

D4 (every spec in English) and D9 (the order of work) are already built into the steps above.
