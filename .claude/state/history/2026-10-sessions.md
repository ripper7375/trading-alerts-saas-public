---
type: Concept/SessionHistory
status: archived
period: 2026-10-01..2026-10-31
source: .claude/state/current-state.md (rotated entries)
tags: [history, sessions, 2026-10]
---

# Session history — October 2026

Entries rotated out of `current-state.md` by [session-lifecycle](../../protocols/session-lifecycle.md), verbatim, newest first (only the relative link prefixes are adjusted for this folder's depth).

Back to [history index](./index.md).

<!-- session 2026-10-01 mcd0-p4b -->

> **Ad-hoc session (2026-10-01, phase/session unchanged), `main`, NOT committed (HEAD `4ae42610` is Davin's Next.js security update). MCD
> task P4 part (b) for MCD0 after Davin confirmed `mcd0/concept.md` and answered (a) to (k): `mcd0.md`, `mcd0_registry.yaml`,
> `mcd0_params.yaml` (12 parameters) and `mcd0_implementation_plan.md` are written and the work STOPS at the second STOP for his approval.
> No code.**
> **Needs from Davin:** (1) approve or correct the four files and answer spec Q1 to Q5: `last_closed_bar` is `{}`; each model's own skew;
> variance ratio and kurtosis never required; empty rung and no rule rows; **Q5, the trimmed envelope**: the first layout measured 660
> tokens worst case (582 for the real v1 reading) against the 600 budget, so the spec drops `verdict`, `source` and the angle from `details`
> and names the criterion, not the model, in commentary (555 tokens, 561 with RETUNING); the alternative is a higher ceiling for MCD0, as
> for MCD3; (2) then the architecture §2.13 MCD0 row goes from `To build` to `Draft` and P5 follows (evaluator, tests T1 to T13, fixtures
> v1, v3 and v4, manifest); `active-tasks.md` is left in place with STOP 2 and P5 open; (3) commit only after P5 is built and verified
> (decision (k)); `package.json` and `pnpm-lock.yaml` were committed by him in `4ae42610`, so nothing is left to exclude.
> **Changed & verified:** new `mcd0/mcd0.md`, `mcd0_registry.yaml`, `mcd0_params.yaml`, `mcd0_implementation_plan.md`; `mcd0/concept.md`
> (confirmed, and §11 holds his answers); the hand-off ([P4 (b) MCD0](../../../docs/handoffs/2026-10-01-1536-mcd0-p4b.md)) and these state
> files. Scratch (nothing in the repo): the expected reading of every real channel row with the decisions applied (eight real cases, four
> `MCD0_M5_M15_DEFECT` and four `MCD0_M5_DEFECT`); token counts of hand-built envelopes with the kit's counter; a consistency check (the 12
> parameters in spec §6 equal the parameters file loaded through the kit; the registry and the rendered commentary pass the kit's wording
> check). Prettier clean, LF, no Thai. MCD0 has no code, test, fixture or manifest yet, so no suite was run; not run: `test:ci`, `tsc`, lint,
> build.
> **Unconfirmed / found:** the 600-token budget decides the layout (the mandatory part is about 230 tokens, the two `config_hash` entries
> about 90); the margin is about 40 and P5's T12 must confirm it on the built evaluator; no real M5 channel qualifies, so
> `MCD0_ALL_QUALIFIED` and `MCD0_M15_DEFECT` are synthetic only; the fit-window question reaches MCD0 ([waiting-on](../waiting-on.md)); the
> shared T6 and T10 are overridden in MCD0's tests because it reads no bars (no kit change). The oldest entry (P7 (b)) was rotated into
> `history/2026-10-sessions.md`.

<!-- session 2026-10-01 mcd0-p4a -->

> **Ad-hoc session (2026-10-01, phase/session unchanged), `main`, NOT committed (HEAD `dfb17331`). ADR-083 settled (Proposed to Settled) and
> Q1 to Q5 of the MCD2 and MCD1 2.0.1 patch recorded as approved as built; then MCD task P4 part (a) for MCD0: `mcd0/concept.md` (a readback
> of walkthrough Part C4; MCD0 has no board) is written and the work STOPS for Davin to confirm it and answer its open questions.**
> **Needs from Davin:** (1) confirm or correct `mcd0/concept.md`; (2) answer questions (a) to (f) of walkthrough C4 (decision D8) and (g) to (j)
> found while reading (concept §10, each with a recommendation; (a) to (f) are the build user manual §3 suggestions: `window_span_bars` counted
> in closed bars, each model's own MSE, keep the geo gate, skip R² on a flat channel, Model A not applicable for the fractal EDT, variance
> ratio and kurtosis as values in `details`; (g) to (j): tier 1 without bars, one unreadable timeframe makes the whole reading STALE or INVALID,
> sanity checks for MSE and offsets, no containment test); (3) then P4 part (b): `mcd0.md`, registry, parameters and the plan (a second STOP),
> and after his approval P5; `active-tasks.md` is left in place with both STOPs open; (4) what to commit: the ADR-083 and manifest edits and
> `mcd0/` are uncommitted, and `package.json` and `pnpm-lock.yaml` show a Next.js 16.3.3 to 16.3.8 bump (including `overrides`) that is not from
> this session and should stay out of it.
> **Changed & verified:** `docs/adr/083-…md` and its row in `docs/adr/README.md` (Settled); one row in §9 of the MCD2 and MCD1 manifests; new
> `mcd0/concept.md` (176 lines); the hand-off ([P4 (a) MCD0](../../../docs/handoffs/2026-10-01-1519-mcd0-p4a.md)) and these state files. A scratch
> probe (nothing in the repo) computed the four pillars on the 11 real channel rows of the stored fixtures (v1, v3, v4): the literal thresholds
> flag all six active-channel readings (only R² and the fit ratio fail), `channel_width` equals `uoedt_offset - loedt_offset` on all 11, and the
> two MSE readings never differ in verdict on the 8 rows with Model A values. Prettier clean, LF, no Thai on every edited Markdown file. No
> evaluator, test, fixture, spec, registry or parameter was touched, so no suite was run; not run: `test:ci`, `tsc`, lint, build.
> **Unconfirmed / found:** `window_span_bars` counts through the still-open bar (closed bars are one fewer, the ADR-083 fact), and MCD0 becomes a
> new reader of the fit fields whose forming-bar question is still open ([waiting-on](../waiting-on.md), now lists MCD0); the kit's tier-1
> cross-check and the shared T6 need bars, which C4 says MCD0 does not read (question (g)); no real M5 channel qualifies, so two of the four
> states need synthetic bundles. The oldest entry (P7 (a)) was rotated into `history/2026-10-sessions.md`.

<!-- session 2026-10-01 p7b-mcd2-mcd1 -->

> **Ad-hoc session (2026-10-01, phase/session unchanged), `main`, committed by explicit path ("Patch MCD2 and MCD1 to 2.0.1: window
> counts the channel's closed bars (task P7)"; the hash is in `git log`), NOT pushed. MCD task P7 part (b) for MCD2 and MCD1 after
> Davin confirmed the PATCH (evaluator 2.0.1): MCD2's window is `min(T_EDT - 1, 288)` and a channel under 48 closed bars is INVALID +
> `INSUFFICIENT_BARS`; MCD1 requires the channel to hold `N_micro` closed bars (`T_EDT - 1 >= N_micro`), same reason code; no real
> reading changes.**
> **Needs from Davin:** (1) nothing blocks. Q1 to Q5 of the concept sections were not answered one by one, so the build follows the
> recommended answers (floors kept as minimums, parameter `t_edt_open_bar_rows` = 1, ADR-083 drafted, MCD3 note wording): say if any
> should change; (2) settle **ADR-083** (status Proposed); (3) optionally a fresh **P6 check** of the two patched MCDs (a short one);
> (4) next work: **MCD0** (Part D with the C4 content; its open questions (a) to (f) are his). `active-tasks.md` was deleted (every item done).
> **Changed & verified:** both evaluators, params, registries, specs, plans, manifests and `concept.md` sections of MCD1 and MCD2;
> `MCD2` 93 to **102** tests and `MCD1` 105 to **113** (`ShortChannelTests`; three MCD2 tests that pinned the old formula edited, MCD1
> only its register test); `evaluator_version` label `2.0.0` to `2.0.1` in nine stored JSON files (MCD1 and MCD2 fixture envelopes and
> outputs, MCD3's three `upstream.json`: MCD3 T14 needs them equal to the live output); architecture §2.5 and §2.13; ADR-083 and its
> index row; two MCD3 notes (wording); the `waiting-on.md` item moved to resolved; hand-off
> ([P7 (b)](../../../docs/handoffs/2026-10-01-1453-p7b-mcd2-mcd1.md)). From `engine-1-5-new/`: MCD2 **102 OK**, MCD1 **113 OK**, MCD3
> **134 OK** (1 opt-in skip; the opt-in scan of the 12 real pairings OK), the kit **215 OK**, legacy **13 OK** each; pyflakes and Prettier
> clean. Own mutation pass on the new logic: 14 of 14 killed. The test run after the commit is in the terminal report, not in a file.
> **Unconfirmed / found:** with the floors kept, MCD1 changes only a reason code (`DISCONTINUITY` to `INSUFFICIENT_BARS`) and MCD2 gains
> VALID readings for `T_EDT` 49 to 288. The fit-window question stays open ([waiting-on](../waiting-on.md)); the parameter makes a
> different answer a one-value change. The "T_EDT helper" is now in three evaluators (a kit change for Davin to schedule). Not run:
> `test:ci`, `tsc`, lint, build (no app code touched). The oldest entry (MCD3 P6) was rotated into `history/2026-10-sessions.md`.

<!-- session 2026-10-01 p7a-mcd2-mcd1 -->

> **Ad-hoc session (2026-10-01, phase/session unchanged), `main`, NOT committed (HEAD `6599c74f` is Davin's). MCD task P7 part (a) for
> MCD2 and MCD1, the short-channel window: the "Change 2026-10-01" section is written in `mcd2/concept.md` and `mcd1/concept.md`
> (PATCH, evaluator 2.0.1, no fixture output moves) and the work STOPS for Davin's confirmation. Also the cosmetic edit on line 168 of
> the MCD3 plan ("(D6 proposal)" to "(Approved)").**
> **Needs from Davin:** (1) confirm the two Change sections and answer **Q1 first: keep the 48-bar (MCD2) and 96-bar (MCD1) floors as
> minimums** (INVALID + `INSUFFICIENT_BARS` for a shorter channel; recommended), because `min(T_EDT - 1, cap)` applied literally drops
> them (a channel of 30 closed M5 bars would read VALID over 29 bars); (2) Q2 to Q5 in the sections, each with a recommendation:
> `t_edt_open_bar_rows` as a parameter, PATCH not MINOR (three MCD2 tests pin the old formula), one decision entry (ADR-083) for both,
> and the wording of two MCD3 notes; (3) what to commit. Then **P7 (b)** (spec, parameters, registry, evaluator, tests, version 2.0.1,
> manifests, architecture §2.5 and §2.13, the draft decision entry, the suites, a fresh P6), then MCD0. `active-tasks.md` is left in
> place with the STOP and part (b) open.
> **Changed & verified:** the two `concept.md` files (84 and 76 added lines, none removed) and one line of
> `mcd3/mcd3_implementation_plan.md`; the hand-off ([P7 (a)](../../../docs/handoffs/2026-10-01-1435-p7a-mcd2-mcd1.md)) and these state
> files. No evaluator, test, spec, registry, parameter, fixture or output was touched. Prettier clean, LF, no Thai. A scratch probe
> (nothing in the repo): the fixtures' `T_EDT` are 314 or more on M5 and 500 or more on M15, so no fixture output moves; the committed
> MCD2 reads INVALID + `DISCONTINUITY` at `T_EDT` 288 and below, MCD1 at 96 and below (as the waiting-on item said). Not run: the test
> suites (no code touched), `test:ci`, `tsc`, lint, build.
> **Unconfirmed / found:** with the floors kept, the MCD1 patch changes only a reason code (`DISCONTINUITY` to `INSUFFICIENT_BARS`);
> MCD2 gains VALID readings for `T_EDT` 49 to 288. MCD3 reads only the upstream status, trend and angle, so the MCD1 reason-code
> change is invisible to it. The fit-window question stays open ([waiting-on](../waiting-on.md)); the patch does not depend on it. The
> "T_EDT helper" now exists in three evaluators (a kit change for Davin to schedule). The oldest entry (MCD3 P3) was rotated into
> `history/2026-10-sessions.md`.

<!-- session 2026-10-01 mcd3-p6 -->

> **Ad-hoc session (2026-10-01, phase/session unchanged), `main`, committed by explicit path ("Retrofit MCD3: evaluator 2.0.0, tests,
> fixtures, manifest (Stage 3 sign-off)"; the hash is in `git log`), NOT pushed. MCD task P6 for MCD3, a fresh independent check, then
> Davin's stage-3 sign-off and the wrap-up he asked for: one A line failed (A22, envelope over 600 tokens) and Davin decided it (ceiling of
> 670 tokens for this derived sensor); seven test gaps found by the check's own mutation pass are closed. MCD3 is retrofitted, checked,
> signed off and committed: MCD1, MCD2 and MCD3 are done.**
> **Needs from Davin:** (1) next work: the deferred **P7** for the MCD2 and MCD1 short-channel window (a PATCH, now unblocked;
> [waiting-on](../waiting-on.md)); then **MCD0** (Part D with the C4 content; its open questions (a) to (f) are his); (2) nothing else is
> open from this session. `active-tasks.md` was deleted (every item done).
> **Changed & verified:** seven new tests and a T12 ceiling test in `engine-1-5-new/mcd3/test_mcd3_unit_tests.py` (134 tests; each of the
> seven kills the mutant that had survived; the ceiling test runs all ten states with every candidate populated, RETUNING and two upstream
> cautions against 670); `mcd3.md` ("(Approved)" in the §12 worked example, §11 and §13 on the ceiling and the new cases); the manifest (A22 "Pass
> (Approved by Davin: derived dual-horizon ceiling <= 670 tokens)", a P6 paragraph, counts, §8 rows) and the plan; the hand-off
> ([P6 MCD3](../../../docs/handoffs/2026-10-01-1407-mcd3-p6.md)) and these state files. From `engine-1-5-new/`: `python -m unittest discover -s mcd3`
> **134 OK** (1 opt-in skip; the opt-in full scan of all 12 real pairings OK), the kit **215 OK**, MCD1 **105 OK**, MCD2 **93 OK**, legacy **13 OK**;
> Prettier clean. The check itself: a clean-room oracle fuzz on 24,000 bundles (0 differences), its own mutation pass (477 mutants; the 10
> non-equivalent survivors, in 7 groups, are the gaps; all killed now), the schema taken from the standard's Appendix B, its own banned-word
> scan, token sizes re-derived (515, 550, 587; 607 and 611; 656 worst case with every candidate populated; MCD1 392 and MCD2 386 in the same
> case, so the three-sensor worst case is about 1,430 of 2,000). The test run after the commit (the hook left the fixtures untouched) is in
> the terminal report, not in a file.
> **Unconfirmed / found:** `details.populated_candidates` is the cost driver of the envelope size (up to 13 names on live data, about 40
> tokens); the statistics fit windows may include the still-open bar (inherited; [waiting-on](../waiting-on.md)); the kit writes absolute
> workbook paths into `.source.md` for v3 and v4 (open, [waiting-on](../waiting-on.md)); `mcd3_implementation_plan.md` line 168 still says
> "(D6 proposal)" in a column header (left as it is: Davin named only `mcd3.md`). Not run: `test:ci`, `tsc`, lint, build (no app code touched).
> The oldest entry (MCD3 P2) was rotated into `history/2026-10-sessions.md`.

<!-- session 2026-10-01 mcd3-p3 -->

> **Ad-hoc session (2026-10-01, phase/session unchanged), `main`, NOT committed (HEAD `dde1420e` is Davin's). MCD task P3 for MCD3
> (steps R5 to R10): evaluator 2.0.0 built on the kit with Davin's D10 option A, D6, D7 and Q1 to Q9; 127 tests pass; manifest,
> fixtures, architecture and standard records written. Flag `off`, registry status `Retrofit (2.0.0)`.**
> **Needs from Davin:** (1) a decision on the **envelope size**: the real CAUTIONARY readings are **607 and 611 tokens**, over the
> standard's 600 ("should"); the plain real ones pass (515, 550, 587). Options: accept; shorten templates T01 to T07 (about 35
> tokens); drop the two trend words from `details` (about 15); (2) a fresh session for **P6 on MCD3** (ask it to run its own mutation
> pass), then his stage-3 sign-off; (3) what to commit (this session's files; the P2 files are in `dde1420e`); (4) after the sign-off:
> the deferred **P7** for the MCD2 and MCD1 short-channel window (a task chip is open). `active-tasks.md` was deleted (every item done).
> **Changed & verified:** in `engine-1-5-new/mcd3/`: `mcd3_evaluator.py`, `test_mcd3_unit_tests.py`, `fixtures/` (v1, v4, v3: inputs,
> upstream, envelope, source), `mcd3_output.json`, the manifest, approval lines in the spec, concept, plan, params and registry; plus
> `mcd_common/fixtures/settings_v3.yaml`, architecture §2.5 and §2.13, standard **1.0.4** (PATCH: `<slot>.upstream.json`) and walkthrough
> B3; [the hand-off](../../../docs/handoffs/2026-10-01-0859-mcd3-p3.md). From `engine-1-5-new/`: `python -m unittest discover -s mcd3`
> **127 OK** (1 opt-in skip); the opt-in scan of all 12 real pairings OK; kit **215 OK**, MCD1 **105 OK**, MCD2 **93 OK**, legacy **13 OK**;
> Prettier and pyflakes clean. Equivalence: ten synthetic scenarios equal to the pre-retrofit evaluator; all 12 real pairings keep their state
> (v3 is a real `MCD3_BEAR_BOTTOM`, 973 of 1037 bars nested). Own mutation pass: 90 mutants, 7 test gaps closed, 3 equivalent.
> **Unconfirmed / found:** real envelopes are larger than the P2 estimate (587, not 533: real prices and two 64-character hashes). The
> kit writes an absolute workbook path into `<slot>.source.md` (v3 and v4 as for MCD1 and MCD2). Replica v3 is now tracked (Davin's
> commit; the blob's SHA-256 matches the fixture). The fit-window question stays open; the MCD2 and MCD1 short-channel window is deferred
> by Davin. Not run: `test:ci`, `tsc`, lint, build (no app code touched). The oldest entry (MCD1 P6) was rotated into
> `history/2026-10-sessions.md`.

<!-- session 2026-10-01 mcd3-p2 -->

> **Ad-hoc session (2026-10-01, phase/session unchanged), `main`, NOT committed (the index holds one staged rename: the MCD3
> board image). MCD task P2 for MCD3 (steps R1 to R4): concept readback, English spec, parameters, registry and plan written;
> stopped at the STOP. P3 has not started and cannot start before D10. Flag `off`; registry status stays `Retrofit`.**
> **Needs from Davin:** (1) **D10**, which EDT stochastic formula is intended (the board reads 0 at UOEDT; the spec and code
> read 0 at LOEDT; only the reported number changes; no default); (2) **D6** (bias per state; the registry holds the walkthrough
> starting points, unapproved) and **D7** (six levels; the zone builder must count a duplicate price once); (3) questions Q1 to
> Q9 of [the spec §14](../../../davintrade-stack-d-and-e/engine-1-5-new/mcd3/mcd3.md) with recommendations, and the readback of
> `concept.md` (the board's two times match no replica; is v1 an acceptable stand-in?); (4) approval of `mcd3.md` and the plan,
> then **P3 for MCD3**; (5) what to commit (the MCD3 P2 files, and replica v3 if Q7); (6) optional: a **P7** task for the MCD2
> and MCD1 short-channel window (below). `active-tasks.md` was left in place (the STOP item is open).
> **Changed & verified:** in `engine-1-5-new/mcd3/`: `legacy/` (evaluator and output byte-identical, tests with one path line
> edited), the board in `concept/` (staged rename), `concept.md`, `mcd3.md`, `mcd3_params.yaml`, `mcd3_registry.yaml`,
> `mcd3_implementation_plan.md`; [the hand-off](../../../docs/handoffs/2026-10-01-0703-mcd3-p2.md). From `engine-1-5-new/`:
> legacy **13 OK** from `legacy/`, kit **215 OK**, MCD1 **105 OK**, MCD2 **93 OK**; params and registry load with the kit,
> wording clean, the spec tables equal the YAML, Prettier clean. All 12 real pairings in replicas v1 to v4 keep their legacy
> state on closed bars; one is a **real consolidated trend** (v3, `MCD3_BEAR_BOTTOM`, 973 of 1037 bars nested). Largest
> envelope estimated at 533 of 600 tokens.
> **Unconfirmed / found:** `T_EDT` counts the forming bar (the band columns exist on exactly `T_EDT` rows ending at the open
> bar, 7 of 7 real channels), so MCD3's window is `T_EDT − 1`; new evidence for the open fit-window item in
> [waiting-on](../waiting-on.md). The committed MCD2 ends INVALID + `DISCONTINUITY` for an M5 channel with `T_EDT` ≤ 288
> (MCD1 at ≤ 96), simulated; no replica triggers it (smallest real `T_EDT` 314); not fixed. Not run: `test:ci`, `tsc`, lint,
> build (no app code touched). The oldest entry (MCD1 P3) was rotated into `history/2026-10-sessions.md`.

<!-- session 2026-10-01 mcd1-p6 -->

> **Ad-hoc session (2026-10-01, phase/session unchanged), `main`, committed by explicit path ("Retrofit MCD1:
> evaluator 2.0.0, tests, fixtures, manifest (Stage 3 sign-off)"; the hash is in `git log`), NOT pushed. MCD task P6
> for MCD1, a fresh independent check: no line of A1 to A26 fails (20 pass, A15 not applicable, 5 not yet due);
> three low findings F1 to F3, all closed after Davin granted the stage-3 sign-off. MCD1 is retrofitted, checked,
> signed off and committed.**
> **Needs from Davin:** (1) next work: **P2 for MCD3** (it stops for D7, the levels, and D10, the direction of the EDT
> stochastic); (2) optional: add replica v3 as an MCD1 fixture slot (a real `MCD1_DOWN_LOWER_BREAKDOWN`;
> [the hand-off](../../../docs/handoffs/2026-10-01-0628-mcd1-p6.md) §6a); (3) nothing else is open from this session.
> `active-tasks.md` was deleted (every item done).
> **Changed & verified:** F1 and F2: one test in `engine-1-5-new/mcd1/test_mcd1_unit_tests.py` (105 tests; it kills
> the two mutants that had survived); F3: four `meaning` sentences in `mcd1.md` §7 now equal the registry's;
> architecture §2.5, MCD1 "States" cell: nine codes plus five regime statuses; the manifest and plan updated; the
> hand-off and these state files written. From `engine-1-5-new/`: `python -m unittest discover -s mcd1` **105 OK**,
> MCD2 **93 OK**, the kit **215 OK**, the legacy tests **13 OK** each; Prettier clean. The check itself: its own
> mutation pass (424 mutants, 399 killed, 23 of the 25 survivors equivalent), a clean-room reference fuzzed on 220,000
> bundles (0 differences), every number of the manifest reproduced (365, 356 and 367 tokens; the legacy files equal
> HEAD), the schema taken from the standard's Appendix B, its own banned-word regex. The test run after the commit
> (the hook left the fixtures untouched) is in the terminal report, not in a file.
> **Unconfirmed / found:** the statistics fit windows may include the still-open bar (inherited; see
> [waiting-on](../waiting-on.md)); five of nine states have synthetic examples only (replica v3 gives a real
> `MCD1_DOWN_LOWER_BREAKDOWN`, not yet a fixture); a break under half a cent reads "0.00 above UOEDT" (left as it is,
> as for MCD2). Not run: `test:ci`, `tsc`, lint, build (no app code touched). The oldest entry (MCD1 P2) was rotated
> into `history/2026-10-sessions.md`.

<!-- session 2026-10-01 mcd1-p3 -->

> **Ad-hoc session (2026-10-01, phase/session unchanged), `main`, NOT committed. MCD task P3 for MCD1
> (steps R5 to R10): evaluator 2.0.0 built on the kit with Davin's D6 bias and Q1 to Q7; 104 tests pass;
> manifest, fixtures and the architecture records written. Flag `off`, registry status `Retrofit (2.0.0)`.**
> **Needs from Davin:** (1) a fresh session for **P6 on MCD1** (an independent check; the first mutation pass
> left two test gaps, now closed, so ask it to run its own), then his stage-3 sign-off; (2) what to commit and
> when ([the hand-off](../../../docs/handoffs/2026-10-01-0544-mcd1-p3.md) §6a: the MCD1 folder, the architecture
> doc, two hand-offs and the state files are uncommitted); (3) optional: the architecture §2.5 "States" cell for
> MCD1 still lists the five regime words (§6b); (4) next work after P6: **P2 for MCD3** (needs D7 and D10).
> `active-tasks.md` was deleted (every item done).
> **Changed & verified:** in `engine-1-5-new/mcd1/`: `mcd1_evaluator.py`, `test_mcd1_unit_tests.py`,
> `fixtures/` (new), `mcd1_output.json`, the manifest, the registry (D6 applied), approvals in the spec, plan,
> parameters and concept; architecture §2.13 (2.0.0, Levels) and §2.5 (baseline). From `engine-1-5-new/`:
> `python -m unittest discover -s mcd1` **104 OK**; MCD2 **93 OK**; the kit **215 OK**; the legacy tests **13 OK**
> each (the `legacy/` evaluator and output are byte-identical to `HEAD`). Mutation pass on a scratch copy: 57 of 57
> killed (two survived the first pass: no test had a window bar closing exactly on a band; closed with a test).
> The three real cycles keep their legacy state (`MCD1_DOWN_UPPER_BREAKOUT`, `MCD1_DOWN_IN_CORRIDOR`,
> `MCD1_SIDEWAYS_LOWER_BREAKDOWN`); legacy and new side by side, every difference explained. Largest envelope 367
> tokens, evaluation about 2.5 ms. Pyflakes and Prettier clean.
> **Unconfirmed / found:** the statistics fit windows may include the still-open bar (inherited, see
> [waiting-on](../waiting-on.md); MCD1 reads the same three fields and `N_micro` depends on `containment_n`); six of
> nine states are tested with synthetic bundles only (replica batches v2 and v3 not scanned); under D6 two
> same-slope break states take the bias of the break, while the draft synthesis rule 2 reads them as "against the
> spike" (synthesis decides; for the rules review). Not run: `test:ci`, `tsc`, lint, build (no app code touched).
> The oldest entry (MCD2 P6) was rotated into `history/2026-10-sessions.md`.

<!-- session 2026-10-01 mcd1-p2 -->

> **Ad-hoc session (2026-10-01, phase/session unchanged), `main`. (1) MCD2 closed and committed
> (`ecbb3f94`, "Retrofit MCD2: evaluator 2.0.0, tests, fixtures, manifest (Stage 3 sign-off)"). (2) MCD task P2
> for MCD1 (steps R1 to R4): concept readback, English spec, parameters, registry and plan written; stopped at
> the STOP. P3 is not started and the MCD1 files are NOT committed.**
> **Needs from Davin:** (1) answer [the hand-off](../../../docs/handoffs/2026-10-01-0457-mcd1-p2.md) §6, **D6
> first** (bias per MCD1 state: no default, the registry holds `DAVIN` for six states), then Q1 to Q7, check the
> English readback (`concept.md`), and approve `mcd1.md` and the plan; (2) say when to commit the MCD1 P2 files;
> (3) keep or change the five lines added to the repo-wide `.prettierignore` (in the MCD2 commit); (4) then **P3
> for MCD1**. `active-tasks.md` is left in place with the STOP item open.
> **Changed & verified:** MCD2: one test for H1 to H3 (93 tests; the four tier-3 mutants die on a scratch
> mirror), standard 1.0.3 (`flag: 'off'` in Appendix C.2), walkthrough C1 "Renamed (D5)", manifest at 93 tests
> with the sign-off, committed by explicit path (31 files). MCD1, in `engine-1-5-new/mcd1/`: `legacy/`
> (byte-identical evaluator and output; one path line edited in the test copy), new `concept.md`,
> `mcd1_params.yaml`, `mcd1_registry.yaml`, rewritten `mcd1.md` and `mcd1_implementation_plan.md`. From
> `engine-1-5-new/`: `python -m unittest discover -s mcd2` **93 OK** (also on the committed tree); the kit
> **215 OK**; the legacy tests **13 OK** for MCD1 and MCD2. Params load through the kit; nine states, wording
> checks, spec against registry and params all clean; Prettier clean. Closed-bar readings keep the legacy
> state on all three real cycles (v1 `non_b`: `MCD1_DOWN_UPPER_BREAKOUT`; v4 `non_b`: `MCD1_DOWN_IN_CORRIDOR`;
> v4 `non_a`: `MCD1_SIDEWAYS_LOWER_BREAKDOWN`), so three of nine states have real examples.
> **Unconfirmed / found:** the pre-commit hook (`lint-staged` + prettier) reformatted the one-line canonical
> JSON fixtures of the first MCD2 commit and broke two replay tests on the committed tree; fixed with
> `.prettierignore` entries, regenerated files and an amend of the local commit (details: hand-off §7, gotchas
> file). The forming bar inside the statistics fit windows is still unverified ([waiting-on](../waiting-on.md));
> MCD1 reads the same fields. 17 old `lint-staged automatic backup` stashes sit in `git stash list` (not from
> this session, untouched). Not run: `test:ci`, `tsc`, lint, build (no app code touched). The oldest entry
> (MCD2 P3) was rotated into `history/2026-10-sessions.md`.

<!-- session 2026-10-01 mcd2-p6 -->

> **Ad-hoc session (2026-10-01, phase/session unchanged), `main`, NOT committed. MCD task P6 for MCD2: a
> fresh independent check of the retrofit (evaluator 2.0.0) against its manifest. No line of A1 to A26
> fails (20 pass, A15 not applicable, 5 not yet due); three low test-gap findings H1 to H3. Nothing in the
> MCD2 folder or the kit was changed.**
> **Needs from Davin:** (1) answer [the hand-off](../../../docs/handoffs/2026-10-01-0430-mcd2-p6.md) §7: sign off
> stage 3 for MCD2 (I would not hold it for H1 to H3) and say whether to add the one short test for H1 to H3;
> (2) the three items still open from the P3 hand-off §6: PATCH the standard to 1.0.3 for `flag: 'off'`, what
> and when to commit, walkthrough C1 "Proposed renames"; (3) next work: **P2 for MCD1** (needs D6 at its STOP).
> **Changed & verified:** nothing in the MCD2 folder, the kit, the standard or the architecture; this report,
> the state entries and two gotchas. From `engine-1-5-new/`: `python -m unittest discover -s mcd2` **92 OK, 0
> skipped**; the kit **215 OK**; the 13 legacy tests OK (from `mcd2/legacy/`). Legacy evaluator and output are
> byte-identical to HEAD; the manifest's legacy baseline, tokens (355, 355, 359, 353), time and SHA-256 values
> all reproduce; output and fixtures validate against the schema taken from the standard; no banned word in any
> code, template or summary; Prettier clean. Own mutation pass on a scratch mirror: 40 mutants, 36 killed; the 4
> survivors are the three gaps H1 to H3 (tier-3 window edges, strict `>` on older bars, raw bars in tier 3);
> direct probes show the evaluator is right in each case.
> **Unconfirmed / found:** a breakout under half a cent reads "0.00 above UOEDT" (accurate, may read oddly;
> hand-off §5); the forming bar inside the statistics fit windows is still unverified ([waiting-on](../waiting-on.md));
> six states are still tested with synthetic bundles only (replica batches v2 and v3 not scanned); an
> unstaged rename of the MCD3 board image is in the tree (not this work). Not run: `test:ci`, `tsc`, lint,
> build (no app code touched). The oldest entry (MCD2 P2) was rotated into `history/2026-10-sessions.md`.

<!-- session 2026-10-01 mcd2-p3 -->

> **Ad-hoc session (2026-10-01, phase/session unchanged), `main`, NOT committed. MCD task P3 for MCD2
> (steps R5 to R10): evaluator 2.0.0 built on the kit; 92 tests pass; manifest, fixtures and the
> architecture records written. Flag `off`, registry status `Retrofit (2.0.0)`.**
> **Needs from Davin:** (1) a fresh session for **P6 on MCD2**, then **P2 for MCD1**; (2) the standard's
> Appendix C.2 shows `flag: off`, which YAML loads as `false`: PATCH it to 1.0.3? ([the hand-off](../../../docs/handoffs/2026-10-01-0410-mcd2-p3.md)
> §6a); (3) what to commit and when (§6b: P2 and P3 left the MCD2 folder, the architecture doc,
> `docs/handoffs/` and `.claude/state/` uncommitted, plus two staged image renames); (4) optional: walkthrough
> C1 still says "Proposed renames" (§6c).
> **Changed & verified:** `mcd2_evaluator.py`, `test_mcd2_unit_tests.py`, `fixtures/`, `mcd2_output.json`,
> the manifest, the registry (`flag` quoted), approvals in the spec, plan and concept; architecture §2.13
> (2.0.0), §2.5 and §3.4 (renamed regime words). From `engine-1-5-new/`: `python -m unittest discover -s mcd2`
> **92 OK**; the kit **215 OK** (untouched); the 13 legacy tests OK. Mutation pass on a scratch copy: 28 of 28
> killed (one survivor closed with a test). Largest envelope 359 tokens, evaluation about 9 ms.
> Legacy and new side by side: the four real cycles and all nine states keep their state, every difference
> explained. Prettier clean.
> **Unconfirmed / found:** the statistics fit windows may include the still-open bar (inherited, see
> [waiting-on](../waiting-on.md)); all four real cycles are `IN_CORRIDOR`, so six states are synthetic only
> (the untracked replica batches v2/v3 were not scanned). Not run: `test:ci`, `tsc`, lint, build (no app code
> touched). The oldest entry (Step 0 commit) was rotated into `history/2026-10-sessions.md`.

<!-- session 2026-10-01 mcd2-p2 -->

> **Ad-hoc session (2026-10-01, phase/session unchanged), `main`, NOT committed. MCD task P2 for MCD2
> (steps R1 to R4): concept readback, English spec, parameters, registry and implementation plan are
> written; stopped at the STOP. P3 (build) is not started.**
> **Needs from Davin:** (1) approve `mcd2.md` and the plan, and answer Q1 to Q7 ([the hand-off](../../../docs/handoffs/2026-10-01-0343-mcd2-p2.md)
> §6; recommendations are the P3 defaults); (2) check the English readback of the two Thai boards
> (`concept.md` §3), which the builder translated; (3) then **P3 for MCD2**; (4) commit when ready (two
> staged board renames; the rest of the work is untracked or modified).
> **Changed & verified:** in `engine-1-5-new/mcd2/`: `legacy/` (byte-identical evaluator, tests, output; one
> path line edited in the test copy), `concept/` (two images, `git mv`), new `concept.md`,
> `mcd2_params.yaml`, `mcd2_registry.yaml`, rewritten `mcd2.md` and `mcd2_implementation_plan.md`.
> Legacy tests **13 OK** from `legacy/`; kit suite **215 OK** (unchanged); params load through the kit,
> nine states and D6 bias checked, `wording` checks clean on codes, regime words, templates and summaries;
> spec §6 and the params file list the same six parameters; Prettier clean. Closed-bar readings on all
> four real cycles keep the legacy state (v1 and v4, centroid and fractal).
> **Unconfirmed / found:** all four real cycles are `IN_CORRIDOR`, so the other states are synthetic
> only (the untracked replica batches v2/v3 were not scanned); the statistics fit windows may include the
> still-open bar (inherited, see [waiting-on](../waiting-on.md)); architecture §2.5 and §3.4 still name the
> old regime words (Q7). Not run: `test:ci`, `tsc`, lint, build (no app code touched). The oldest entry (the
> P6 re-check) was rotated into `history/2026-10-sessions.md`.

<!-- session 2026-10-01 mcd-step0-g1-g3-commit -->

> **Ad-hoc session (2026-10-01, phase/session unchanged), `main`, committed as "Step 0: shared MCD kit
> (mcd_common)" (hash in `git log`), not pushed. G1 to G3 on the kit are fixed with four new tests (215
> pass, 211 before); standard PATCHed to 1.0.2 for the unknown `data_status`; derived words stay allowed.**
> **Needs from Davin:** (1) the commit left out, on purpose, the Stack C `.mq5`/`.ex5` change
> (`InpTolerancePercent` 0.50 to 5.00, not made by this session), the two Advisor docs, the v2 to v4
> generators and raw exports, the other replica batches and the `.pptx` files: say which to commit
> ([the hand-off](../../../docs/handoffs/2026-10-01-0220-step0-kit-commit.md) §6 and §7); (2) G4 (the wrong
> "CRLF" sentence in the fix hand-off) was not in the order and is unchanged; (3) next work: **P2 for
> MCD2** (needs D4 to D7 at its STOP).
> **Changed & verified:** four tests (G1 in `test_shared_checks.py`, G2a and G2b in
> `test_cycle_inputs.py`, G3 in `test_wording_and_budget.py`); a two-line comment in `wording.py`;
> standard §6 and §12 (version 1.0.2); the `market_data_v6_replicated_v4.xlsx` fixture is now committed
> because the kit's tests read it. From `engine-1-5-new/`: `python -m unittest discover -s mcd_common/tests
-t .` **215 OK, 0 skipped**. The five mutants that survived the re-check (G1 twice, G2a, G2b, G3) are
> all killed now, kit restored by bytes. Standard is Prettier-clean; new table cells fit the old widths.
> **Unconfirmed / found:** the forming bar inside the statistics fit windows is still unverified (MQL5
> source not checked, see [waiting-on](../waiting-on.md)). Not run: `test:ci`, `tsc`, lint, build (no app
> code touched). The oldest entry (the F1 to F6 fixes) was rotated into `history/2026-10-sessions.md`.

<!-- session 2026-10-01 mcd-p6-recheck-kit -->

> **Ad-hoc session (2026-10-01, phase/session unchanged), `main`, NOT committed. MCD task P6 on the
> shared kit `mcd_common/`, a fresh re-check of the lines changed for F1 to F6: all six fixes hold,
> 211 tests pass and the kit is unchanged. Four small findings G1 to G4 (three test gaps, one wrong
> sentence in the fix hand-off), none blocks P2.**
> **Needs from Davin:** (1) whether to fix G1 to G4 before P2 (recommended: one very short builder step
> for G1 to G3, about four small tests); (2) still open from the fix hand-off: whether derived words
> (`PROBABLE`, `LIKELY`, `SAFETY`) are banned too, and whether to PATCH standard §6 and the §12 T10 row
> for the unknown-status failure; (3) read [the hand-off](../../../docs/handoffs/2026-10-01-0156-p6-recheck-kit.md)
> §4.3 and §6; (4) next work: **P2 for MCD2** (needs D4 to D7 at its STOP); (5) commit when ready
> (`mcd_common/` and `docs/handoffs/` are untracked).
> **Changed & verified:** nothing in the kit (read-only check); only the hand-off, this entry, and the
> oldest entry rotated into the new `history/2026-10-sessions.md`. From `engine-1-5-new/`:
> `python -m unittest discover -s mcd_common/tests -t .` **211 OK, 0 skipped**. Own probes, 57 checks, all
> pass: F1 to F5, and the P1 "Done when" and Part B2 items on both workbooks and the standard's text.
> Own mutation pass on a scratch copy: 34 mutations on the changed lines, 29 killed, 5 survived (1
> equivalent; the other 4 are G1 to G3).
> **Unconfirmed / found:** G4: the fix hand-off says the kit files are CRLF; measured with Python they
> are LF only, with no mixed endings (do not check line endings with `grep` in Git Bash). The forming bar
> inside the statistics fit windows is still unverified (MQL5 source not checked, see
> [waiting-on](../waiting-on.md)). MCD2's legacy commentary "safely within the EDT corridor" now fails
> T11 (for P2). Not run: `test:ci`, `tsc`, lint, build (no app code touched).

<!-- session 2026-10-01 mcd-p6-fixes-kit -->

> **Ad-hoc session (2026-10-01, phase/session unchanged), `main`, NOT committed. The six P6 findings
> F1 to F6 on the shared kit `mcd_common/` are fixed with Davin's choices for F4 and F5; 211 tests
> pass (192 before).**
> **Needs from Davin:** (1) read [the hand-off](../../../docs/handoffs/2026-10-01-0040-p6-fixes-kit.md) §6:
> the F5 inflection list is a little wider than "plural, -ED, -LY" (adds `-ING`, comparatives,
> `CONFIDENT`, `GUARANTEE`), and derived words such as `PROBABLE` or `LIKELY` are still not caught;
> standard §6 does not yet name the new cycle failure; (2) next work: a fresh session for **task P6
> on the kit**, re-checking only the changed lines, then **P2 for MCD2** (needs D4 to D7 at its
> STOP); (3) commit when ready (`mcd_common/` is still untracked).
> **Changed & verified:** F1 `freeze()` now freezes and copies the contents of a `MappingProxyType`;
> F2 preflight docstring and README say the checks can raise on a corrupt bundle and every evaluator
> needs `never_throws`; F3 budget comment says 3.6 MB; F4 `cycle_check` gives INVALID + `SANITY_FAILED`
> for a `data_status` outside the four values (T10 gets a ninth corruption); F5 `BANNED_INFLECTIONS`
> in `wording.py`, whole-word matching kept; F6 two missing tests (earlier upstream reason kept, `-0.0`
> in `details`). From `engine-1-5-new/`: `python -m unittest discover -s mcd_common/tests -t .`
> **211 OK, 0 skipped**; own mutation pass on a scratch copy: 11 mutations, 11 killed;
> `BANNED_WORDS` still equals standard §7.4; provider cut-offs unchanged (last closed M5 bar 20:50).
> **Unconfirmed / found:** the forming bar inside the statistics fit windows is still unverified (MQL5
> source not checked, see [waiting-on](../waiting-on.md)). Re-freezing a frozen 3,000-bar bundle now
> costs about 0.7 s (construction and `dataclasses.replace` only, not evaluation). Not run: `test:ci`,
> `tsc`, lint, build (no app code touched).

<!-- session 2026-10-01 mcd-p6-kit-check -->

> **Ad-hoc session (2026-10-01, phase/session unchanged), `main`, NOT committed. MCD task P6 on the
> shared kit `mcd_common/`: every Part B2 and P1 "Done when" item holds and the kit is unchanged; six
> small findings (F1 to F6), none blocks P2.**
> **Needs from Davin:** (1) F4: what an unknown `data_status` should produce (recommended: INVALID +
> `SANITY_FAILED`); (2) F5: whether the wording check T11 should also catch inflections of the banned
> words, such as `PROBABILITIES` or `graded` (recommended: yes); (3) whether to fix F1 to F6 before P2
> (recommended: yes, a short builder session, then a fresh re-check of those lines); (4) read
> [the hand-off](../../../docs/handoffs/2026-10-01-0015-p6-kit.md) §4 to §6; (5) commit when ready
> (`mcd_common/` is still untracked).
> **Changed & verified:** nothing in the kit (read-only check); only the hand-off report and this
> entry. From `engine-1-5-new/`: `python -m unittest discover -s mcd_common/tests -t .` **192 OK, 0
> skipped**. Own scripts: provider cuts v1 at M5 20:50 / M15 20:30 and v4 at 23:10 / 23:00; no live-bar
> or last-price statistics field in any bundle row; schema file equals standard Appendix B and rejects
> an extra top-level field; reason codes, banned words, `CycleInputs` fields and pre-flight order equal
> the standard. Own mutation pass on a scratch copy: 26 mutations, 23 killed, 2 real test gaps (F6),
> 1 equivalent mutant.
> **Unconfirmed / found:** the forming bar inside the statistics fit windows is still unverified (MQL5
> source not checked; `window_high`, `window_low`, `window_range`, `breach_*` and `max_excursion_*`
> are the same class, see [waiting-on](../waiting-on.md)). Not run: `test:ci`, `tsc`, lint, build (no
> app code touched).
