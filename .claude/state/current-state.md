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
  hand-off) is open. **MCD2 is retrofitted to evaluator 2.0.0** (P2 and P3 done: spec, plan, evaluator,
  93 tests, fixtures, manifest; flag off), **checked by P6** (no failing A-line; the three low test gaps
  H1 to H3 are closed by one test) and **stage 3 signed off by Davin and committed (2026-10-01)**; standard
  PATCHed to 1.0.3 (`flag: 'off'` quoted in Appendix C.2); walkthrough C1 reads "Renamed (D5)". Next: P2 for MCD1.
  Hand-offs: [P1](../../docs/handoffs/2026-09-30-1448-p1-kit.md),
  [P6](../../docs/handoffs/2026-10-01-0015-p6-kit.md),
  [P6 fixes](../../docs/handoffs/2026-10-01-0040-p6-fixes-kit.md),
  [P6 re-check](../../docs/handoffs/2026-10-01-0156-p6-recheck-kit.md),
  [Step 0 commit](../../docs/handoffs/2026-10-01-0220-step0-kit-commit.md),
  [P2 MCD2](../../docs/handoffs/2026-10-01-0343-mcd2-p2.md),
  [P3 MCD2](../../docs/handoffs/2026-10-01-0410-mcd2-p3.md),
  [P6 MCD2](../../docs/handoffs/2026-10-01-0430-mcd2-p6.md).
- **Open follow-ups:** see [waiting-on.md](./waiting-on.md). Database traps:
  [database-traps.md](../architecture/database-traps.md).

## Latest sessions (verbatim)

<!-- session 2026-10-01 mcd2-p6 -->

> **Ad-hoc session (2026-10-01, phase/session unchanged), `main`, NOT committed. MCD task P6 for MCD2: a
> fresh independent check of the retrofit (evaluator 2.0.0) against its manifest. No line of A1 to A26
> fails (20 pass, A15 not applicable, 5 not yet due); three low test-gap findings H1 to H3. Nothing in the
> MCD2 folder or the kit was changed.**
> **Needs from Davin:** (1) answer [the hand-off](../../docs/handoffs/2026-10-01-0430-mcd2-p6.md) §7: sign off
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
> hand-off §5); the forming bar inside the statistics fit windows is still unverified ([waiting-on](./waiting-on.md));
> six states are still tested with synthetic bundles only (replica batches v2 and v3 not scanned); an
> unstaged rename of the MCD3 board image is in the tree (not this work). Not run: `test:ci`, `tsc`, lint,
> build (no app code touched). The oldest entry (MCD2 P2) was rotated into `history/2026-10-sessions.md`.

<!-- session 2026-10-01 mcd2-p3 -->

> **Ad-hoc session (2026-10-01, phase/session unchanged), `main`, NOT committed. MCD task P3 for MCD2
> (steps R5 to R10): evaluator 2.0.0 built on the kit; 92 tests pass; manifest, fixtures and the
> architecture records written. Flag `off`, registry status `Retrofit (2.0.0)`.**
> **Needs from Davin:** (1) a fresh session for **P6 on MCD2**, then **P2 for MCD1**; (2) the standard's
> Appendix C.2 shows `flag: off`, which YAML loads as `false`: PATCH it to 1.0.3? ([the hand-off](../../docs/handoffs/2026-10-01-0410-mcd2-p3.md)
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
> [waiting-on](./waiting-on.md)); all four real cycles are `IN_CORRIDOR`, so six states are synthetic only
> (the untracked replica batches v2/v3 were not scanned). Not run: `test:ci`, `tsc`, lint, build (no app code
> touched). The oldest entry (Step 0 commit) was rotated into `history/2026-10-sessions.md`.
