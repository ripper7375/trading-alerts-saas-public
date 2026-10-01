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
  fixtures, manifest (Stage 3 sign-off)").** Both stay flag `off`, registry status `Retrofit (2.0.0)`. Next:
  **P2 for MCD3** (stops for D7 and D10). The pre-commit prettier hook must not touch canonical JSON:
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
  [P6 MCD1](../../docs/handoffs/2026-10-01-0628-mcd1-p6.md).
- **Open follow-ups:** see [waiting-on.md](./waiting-on.md). Database traps:
  [database-traps.md](../architecture/database-traps.md).

## Latest sessions (verbatim)

<!-- session 2026-10-01 mcd1-p6 -->

> **Ad-hoc session (2026-10-01, phase/session unchanged), `main`, committed by explicit path ("Retrofit MCD1:
> evaluator 2.0.0, tests, fixtures, manifest (Stage 3 sign-off)"; the hash is in `git log`), NOT pushed. MCD task P6
> for MCD1, a fresh independent check: no line of A1 to A26 fails (20 pass, A15 not applicable, 5 not yet due);
> three low findings F1 to F3, all closed after Davin granted the stage-3 sign-off. MCD1 is retrofitted, checked,
> signed off and committed.**
> **Needs from Davin:** (1) next work: **P2 for MCD3** (it stops for D7, the levels, and D10, the direction of the EDT
> stochastic); (2) optional: add replica v3 as an MCD1 fixture slot (a real `MCD1_DOWN_LOWER_BREAKDOWN`;
> [the hand-off](../../docs/handoffs/2026-10-01-0628-mcd1-p6.md) §6a); (3) nothing else is open from this session.
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
> [waiting-on](./waiting-on.md)); five of nine states have synthetic examples only (replica v3 gives a real
> `MCD1_DOWN_LOWER_BREAKDOWN`, not yet a fixture); a break under half a cent reads "0.00 above UOEDT" (left as it is,
> as for MCD2). Not run: `test:ci`, `tsc`, lint, build (no app code touched). The oldest entry (MCD1 P2) was rotated
> into `history/2026-10-sessions.md`.

<!-- session 2026-10-01 mcd1-p3 -->

> **Ad-hoc session (2026-10-01, phase/session unchanged), `main`, NOT committed. MCD task P3 for MCD1
> (steps R5 to R10): evaluator 2.0.0 built on the kit with Davin's D6 bias and Q1 to Q7; 104 tests pass;
> manifest, fixtures and the architecture records written. Flag `off`, registry status `Retrofit (2.0.0)`.**
> **Needs from Davin:** (1) a fresh session for **P6 on MCD1** (an independent check; the first mutation pass
> left two test gaps, now closed, so ask it to run its own), then his stage-3 sign-off; (2) what to commit and
> when ([the hand-off](../../docs/handoffs/2026-10-01-0544-mcd1-p3.md) §6a: the MCD1 folder, the architecture
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
> [waiting-on](./waiting-on.md); MCD1 reads the same three fields and `N_micro` depends on `containment_n`); six of
> nine states are tested with synthetic bundles only (replica batches v2 and v3 not scanned); under D6 two
> same-slope break states take the bias of the break, while the draft synthesis rule 2 reads them as "against the
> spike" (synthesis decides; for the rules review). Not run: `test:ci`, `tsc`, lint, build (no app code touched).
> The oldest entry (MCD2 P6) was rotated into `history/2026-10-sessions.md`.
