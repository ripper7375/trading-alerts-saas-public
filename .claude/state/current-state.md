---
type: Concept/AgentState
status: active
updated_at: 2026-10-01
last_numbered_session: '14-3 (CLOSED SUCCESSFUL 2026-08-30) — Phase 14 complete'
next_numbered_session: '12-0 (Phase 12, Stack D) — blocked on the handover-prompt re-draft, see waiting-on.md'
git_branch: main
max_sessions: 2
related_docs:
  - ./waiting-on.md
  - ./history/index.md
  - ../protocols/session-lifecycle.md
---

# Active session state

Holds **at most 2** session entries (newest first). When you add a third, move the oldest into
`history/YYYY-MM-sessions.md` per [session-lifecycle](../protocols/session-lifecycle.md).
Every entry older than these two is in [history](./history/index.md).

## Where the project stands

- **Playbook position:** last numbered session is **14-3** (Cutover + Runbook), closed
  2026-08-30; **Phase 14 (Web Chat) is complete**. Every session since then has been an
  ad-hoc session ("phase/session unchanged"). Next numbered work is **Phase 12 / Session 12-0**
  (`docs/migration-orders/12-0-decisions-and-contracts.migration-order.md`), gated on the
  Advisor re-drafting the Phase 12 handover prompt (see [waiting-on](./waiting-on.md)).
- **Status correction (2026-09-26, OKF refactor):** round 5 (now in [history](./history/2026-09-sessions.md)) says "NOT committed, NOT
  deployed". It has since been committed and merged to `main` via PR #474 (`31c2e8d4`).
  Deployment was not verified during the refactor.
- **OKF fine-tuning for Opus 5.5 (2026-09-27, docs only):** non-negotiable 8 (settled answers),
  `active-tasks.md` checklist + action-first close entry in
  [session-lifecycle](../protocols/session-lifecycle.md), new
  [subagent-orchestration](../protocols/subagent-orchestration.md); `tsc`/lint clean.
- **MCD kit (2026-10-01):** Step 0 is committed ("Step 0: shared MCD kit (mcd_common)"). P6 findings F1
  to F6 and the re-check findings G1 to G3 are fixed (215 tests); standard 1.0.3 documents the unknown
  `data_status` (INVALID + `SANITY_FAILED`) and quotes `flag: 'off'` in Appendix C.2; derived words stay
  allowed. G4 (a wrong sentence in the fix hand-off) is open. **MCD2 is retrofitted to evaluator 2.0.0,
  checked by P6, signed off by Davin and committed (`ecbb3f94`).** **MCD1 is retrofitted to evaluator 2.0.0
  (spec, plan, D6 and Q1 to Q7 approved by Davin; 105 tests), checked by P6 (no A line fails; F1 to F3 closed
  by one test and one alignment), signed off by Davin and committed ("Retrofit MCD1: evaluator 2.0.0, tests,
  fixtures, manifest (Stage 3 sign-off)").** Both stay flag `off`, registry status `Retrofit (2.0.0)`. **MCD3 is retrofitted to evaluator 2.0.0** (spec, plan, D10 option A, D6, D7 and Q1 to Q9 approved by Davin; 134 tests; fixtures v1, v4 and v3 with stored upstream; standard 1.0.4), checked by P6 (A22 over 600 decided by Davin: a ceiling of 670 tokens for this derived sensor; seven test gaps closed by seven tests), signed off by Davin and committed ("Retrofit MCD3: evaluator 2.0.0, tests, fixtures, manifest (Stage 3 sign-off)"). Flag `off`, registry status `Retrofit (2.0.0)`. **MCD1, MCD2 and MCD3 are all retrofitted, checked, signed off and committed.** Next: the deferred **P7** for the MCD2 and MCD1 short-channel window (unblocked now), then MCD0 (Part D, content in walkthrough C4). The pre-commit prettier hook must not touch canonical JSON:
  `.prettierignore` excludes the MCD fixtures and outputs (gotchas file).
  Hand-offs: [P1](../../docs/handoffs/2026-09-30-1448-p1-kit.md),
  [P6](../../docs/handoffs/2026-10-01-0015-p6-kit.md),
  [P6 fixes](../../docs/handoffs/2026-10-01-0040-p6-fixes-kit.md),
  [P6 re-check](../../docs/handoffs/2026-10-01-0156-p6-recheck-kit.md),
  [Step 0 commit](../../docs/handoffs/2026-10-01-0220-step0-kit-commit.md),
  [P2 MCD2](../../docs/handoffs/2026-10-01-0343-mcd2-p2.md),
  [P3 MCD2](../../docs/handoffs/2026-10-01-0410-mcd2-p3.md),
  [P6 MCD2](../../docs/handoffs/2026-10-01-0430-mcd2-p6.md),
  [MCD2 close-out + P2 MCD1](../../docs/handoffs/2026-10-01-0457-mcd1-p2.md),
  [P3 MCD1](../../docs/handoffs/2026-10-01-0544-mcd1-p3.md),
  [P6 MCD1](../../docs/handoffs/2026-10-01-0628-mcd1-p6.md),
  [P2 MCD3](../../docs/handoffs/2026-10-01-0703-mcd3-p2.md),
  [P3 MCD3](../../docs/handoffs/2026-10-01-0859-mcd3-p3.md),
  [P6 MCD3](../../docs/handoffs/2026-10-01-1407-mcd3-p6.md).
- **Open follow-ups:** see [waiting-on.md](./waiting-on.md). Database traps:
  [database-traps.md](../architecture/database-traps.md).

## Latest sessions (verbatim)

<!-- session 2026-10-01 mcd3-p6 -->

> **Ad-hoc session (2026-10-01, phase/session unchanged), `main`, committed by explicit path ("Retrofit MCD3: evaluator 2.0.0, tests,
> fixtures, manifest (Stage 3 sign-off)"; the hash is in `git log`), NOT pushed. MCD task P6 for MCD3, a fresh independent check, then
> Davin's stage-3 sign-off and the wrap-up he asked for: one A line failed (A22, envelope over 600 tokens) and Davin decided it (ceiling of
> 670 tokens for this derived sensor); seven test gaps found by the check's own mutation pass are closed. MCD3 is retrofitted, checked,
> signed off and committed: MCD1, MCD2 and MCD3 are done.**
> **Needs from Davin:** (1) next work: the deferred **P7** for the MCD2 and MCD1 short-channel window (a PATCH, now unblocked;
> [waiting-on](./waiting-on.md)); then **MCD0** (Part D with the C4 content; its open questions (a) to (f) are his); (2) nothing else is
> open from this session. `active-tasks.md` was deleted (every item done).
> **Changed & verified:** seven new tests and a T12 ceiling test in `engine-1-5-new/mcd3/test_mcd3_unit_tests.py` (134 tests; each of the
> seven kills the mutant that had survived; the ceiling test runs all ten states with every candidate populated, RETUNING and two upstream
> cautions against 670); `mcd3.md` ("(Approved)" in the §12 worked example, §11 and §13 on the ceiling and the new cases); the manifest (A22 "Pass
> (Approved by Davin: derived dual-horizon ceiling <= 670 tokens)", a P6 paragraph, counts, §8 rows) and the plan; the hand-off
> ([P6 MCD3](../../docs/handoffs/2026-10-01-1407-mcd3-p6.md)) and these state files. From `engine-1-5-new/`: `python -m unittest discover -s mcd3`
> **134 OK** (1 opt-in skip; the opt-in full scan of all 12 real pairings OK), the kit **215 OK**, MCD1 **105 OK**, MCD2 **93 OK**, legacy **13 OK**;
> Prettier clean. The check itself: a clean-room oracle fuzz on 24,000 bundles (0 differences), its own mutation pass (477 mutants; the 10
> non-equivalent survivors, in 7 groups, are the gaps; all killed now), the schema taken from the standard's Appendix B, its own banned-word
> scan, token sizes re-derived (515, 550, 587; 607 and 611; 656 worst case with every candidate populated; MCD1 392 and MCD2 386 in the same
> case, so the three-sensor worst case is about 1,430 of 2,000). The test run after the commit (the hook left the fixtures untouched) is in
> the terminal report, not in a file.
> **Unconfirmed / found:** `details.populated_candidates` is the cost driver of the envelope size (up to 13 names on live data, about 40
> tokens); the statistics fit windows may include the still-open bar (inherited; [waiting-on](./waiting-on.md)); the kit writes absolute
> workbook paths into `.source.md` for v3 and v4 (open, [waiting-on](./waiting-on.md)); `mcd3_implementation_plan.md` line 168 still says
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
> B3; [the hand-off](../../docs/handoffs/2026-10-01-0859-mcd3-p3.md). From `engine-1-5-new/`: `python -m unittest discover -s mcd3`
> **127 OK** (1 opt-in skip); the opt-in scan of all 12 real pairings OK; kit **215 OK**, MCD1 **105 OK**, MCD2 **93 OK**, legacy **13 OK**;
> Prettier and pyflakes clean. Equivalence: ten synthetic scenarios equal to the pre-retrofit evaluator; all 12 real pairings keep their state
> (v3 is a real `MCD3_BEAR_BOTTOM`, 973 of 1037 bars nested). Own mutation pass: 90 mutants, 7 test gaps closed, 3 equivalent.
> **Unconfirmed / found:** real envelopes are larger than the P2 estimate (587, not 533: real prices and two 64-character hashes). The
> kit writes an absolute workbook path into `<slot>.source.md` (v3 and v4 as for MCD1 and MCD2). Replica v3 is now tracked (Davin's
> commit; the blob's SHA-256 matches the fixture). The fit-window question stays open; the MCD2 and MCD1 short-channel window is deferred
> by Davin. Not run: `test:ci`, `tsc`, lint, build (no app code touched). The oldest entry (MCD1 P6) was rotated into
> `history/2026-10-sessions.md`.
