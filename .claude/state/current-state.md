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
  to F6 and the re-check findings G1 to G3 are fixed (215 tests); standard 1.0.2 documents the unknown
  `data_status` (INVALID + `SANITY_FAILED`); derived words stay allowed. G4 (a wrong sentence in the fix
  hand-off) is open. Next: P2 (MCD2 retrofit, needs D4 to D7 at its STOP).
  Hand-offs: [P1](../../docs/handoffs/2026-09-30-1448-p1-kit.md),
  [P6](../../docs/handoffs/2026-10-01-0015-p6-kit.md),
  [P6 fixes](../../docs/handoffs/2026-10-01-0040-p6-fixes-kit.md),
  [P6 re-check](../../docs/handoffs/2026-10-01-0156-p6-recheck-kit.md),
  [Step 0 commit](../../docs/handoffs/2026-10-01-0220-step0-kit-commit.md).
- **Open follow-ups:** see [waiting-on.md](./waiting-on.md). Database traps:
  [database-traps.md](../architecture/database-traps.md).

## Latest sessions (verbatim)

<!-- session 2026-10-01 mcd-step0-g1-g3-commit -->

> **Ad-hoc session (2026-10-01, phase/session unchanged), `main`, committed as "Step 0: shared MCD kit
> (mcd_common)" (hash in `git log`), not pushed. G1 to G3 on the kit are fixed with four new tests (215
> pass, 211 before); standard PATCHed to 1.0.2 for the unknown `data_status`; derived words stay allowed.**
> **Needs from Davin:** (1) the commit left out, on purpose, the Stack C `.mq5`/`.ex5` change
> (`InpTolerancePercent` 0.50 to 5.00, not made by this session), the two Advisor docs, the v2 to v4
> generators and raw exports, the other replica batches and the `.pptx` files: say which to commit
> ([the hand-off](../../docs/handoffs/2026-10-01-0220-step0-kit-commit.md) §6 and §7); (2) G4 (the wrong
> "CRLF" sentence in the fix hand-off) was not in the order and is unchanged; (3) next work: **P2 for
> MCD2** (needs D4 to D7 at its STOP).
> **Changed & verified:** four tests (G1 in `test_shared_checks.py`, G2a and G2b in
> `test_cycle_inputs.py`, G3 in `test_wording_and_budget.py`); a two-line comment in `wording.py`;
> standard §6 and §12 (version 1.0.2); the `market_data_v6_replicated_v4.xlsx` fixture is now committed
> because the kit's tests read it. From `engine-1-5-new/`: `python -m unittest discover -s mcd_common/tests
-t .` **215 OK, 0 skipped**. The five mutants that survived the re-check (G1 twice, G2a, G2b, G3) are
> all killed now, kit restored by bytes. Standard is Prettier-clean; new table cells fit the old widths.
> **Unconfirmed / found:** the forming bar inside the statistics fit windows is still unverified (MQL5
> source not checked, see [waiting-on](./waiting-on.md)). Not run: `test:ci`, `tsc`, lint, build (no app
> code touched). The oldest entry (the F1 to F6 fixes) was rotated into `history/2026-10-sessions.md`.

<!-- session 2026-10-01 mcd-p6-recheck-kit -->

> **Ad-hoc session (2026-10-01, phase/session unchanged), `main`, NOT committed. MCD task P6 on the
> shared kit `mcd_common/`, a fresh re-check of the lines changed for F1 to F6: all six fixes hold,
> 211 tests pass and the kit is unchanged. Four small findings G1 to G4 (three test gaps, one wrong
> sentence in the fix hand-off), none blocks P2.**
> **Needs from Davin:** (1) whether to fix G1 to G4 before P2 (recommended: one very short builder step
> for G1 to G3, about four small tests); (2) still open from the fix hand-off: whether derived words
> (`PROBABLE`, `LIKELY`, `SAFETY`) are banned too, and whether to PATCH standard §6 and the §12 T10 row
> for the unknown-status failure; (3) read [the hand-off](../../docs/handoffs/2026-10-01-0156-p6-recheck-kit.md)
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
> [waiting-on](./waiting-on.md)). MCD2's legacy commentary "safely within the EDT corridor" now fails
> T11 (for P2). Not run: `test:ci`, `tsc`, lint, build (no app code touched).
