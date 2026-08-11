# Migration Order — Session 6-12 — A11y + Responsive Audit (Phase 6 Exit Review)

> For the final session of Phase 6 — audits every surface built or touched across 6-1 through
> 6-11 for accessibility and responsive-layout gaps, fixes what's found, deletes
> `app/test-api/page.tsx`, and runs the phase's own exit criteria one row at a time. Adapted from
> `TEMPLATE-UI-BUILD.md`, dial **MEDIUM** (fixing real gaps found by a real audit, not building
> new surfaces) per `monolith-to-microservices-migration-session-playbook.md`'s own Session 6-12
> entry.

**Session:** 6-12 · **Phase:** Phase 6 (Frontend Redesign) · **Variant:** UI-BUILD · **Status:**
PRE-DRAFT · **Generated:** 2026-08-11 (at Session 6-11 close) · **Flags touched:** none expected ·
**Estimated time:** ~4-6h (scope depends on what the audit itself finds — re-verify every citation
in this PRE-DRAFT at CONFIRM per `LESSONS-LEARNED.md` L27, same discipline every Phase 6 session
so far has needed)

**Surface:** whatever the a11y/responsive audit finds across `app/(dashboard)/*`,
`app/(marketing)/*`, `app/affiliate/*` (the surfaces built or touched across Sessions 6-1..6-11);
`app/test-api/page.tsx` (deletion).

**Feeds on:** `docs/migration-orders/phase-6-frontend-gap-matrix.md` (final triage sweep — every
row must land on built / internal-only / out-of-scope-ticketed, none may stay untriaged, per
`monolith-to-microservices-migration-implementation-plan.md` §6.7's own exit criteria),
`DECISION-LOG.md` **F11** (still OPEN — Davin's own row-by-row triage of the gap matrix, carried
since Session 6-1).

---

## Context

Phase 6's own exit criteria (`monolith-to-microservices-migration-implementation-plan.md`,
Phase 6 section, re-verify the exact wording at CONFIRM):

- Gap matrix fully triaged: every backend endpoint either consumed by UI, explicitly marked
  internal-only, or ticketed as out-of-scope.
- All redesigned surfaces live behind completed flags; component tests green.
- No page renders hardcoded or mock data in place of a live endpoint.
- Zero dead internal links; `app/not-found.tsx` exists (built Session 6-2).
- F61, F62, F63 resolved (all three ARE resolved — Sessions 6-8, 6-2, 6-10 respectively; only
  F11's own row-by-row triage is still open).
- `app/test-api/page.tsx` deleted.

This session is where that list gets walked for real, not assumed. **F11 is this session's own
central blocker-shaped item**: it has stayed OPEN since Session 6-1 (2026-08-10) because it needs
Davin's own product judgment on the gap matrix's Triage column (currently "—" on every row) — not
something the Executor can resolve unilaterally. If Davin's triage pass hasn't happened by CONFIRM,
this session cannot close Phase 6 on that criterion alone and the order should say so plainly
rather than paper over it.

The a11y/responsive half of the scope has **no PRE-DRAFT-stage citations at all** — deliberately.
Every prior Phase 6 UI-BUILD session's own PRE-DRAFT that guessed at scope ahead of a real audit
(6-10, 6-11) was found to have drifted from ground truth at CONFIRM. This session's actual
Ordered Steps should be authored from a fresh audit pass (keyboard navigation, screen-reader
labels, color contrast, responsive breakpoints on mobile/tablet) across the real, current set of
pages — not guessed here.

## User Review Required

> [!IMPORTANT]
> **F11's own triage is a real, standing blocker for a clean phase-exit claim**, not just an
> Executor task. If Davin has not yet triaged the gap matrix's Triage column by CONFIRM, this
> order should either wait for it or explicitly record Phase 6 as closing with that one exit
> criterion still open — not silently treated as done.

## Entry criteria

- [ ] Session 6-11 CONFIRMED, executed, closed (2026-08-11 — see `CLAUDE.md` Current entry).
- [ ] `phase-6-frontend-gap-matrix.md` re-read in full at CONFIRM; every row's own "Target
      session" column confirmed to have actually been built (6-2 through 6-11) or explicitly
      flagged as still open.
- [ ] `DECISION-LOG.md` F11's real status checked live — has Davin's own triage pass happened?
      If not, escalate rather than assume.
- [ ] Monolith baseline re-measured at CONFIRM (`tsc --noEmit`, `eslint app components lib hooks
--max-warnings 0` clean [4 pre-existing warnings — confirm this count is still accurate, not
      stale], `test:ci` — last known at 6-11's close: 148/148 suites, 2312/2312 tests).
- [ ] Advisor DRAFT review + Davin APPROVED before CONFIRM — not fast-path eligible (a phase-exit
      session with a real, potentially-still-open blocking flag is not a routine build).

## Integration points

- **In:** every page built or touched across Sessions 6-1 through 6-11 (a real audit target, not
  a fixed file list — enumerate at DRAFT/CONFIRM).
- **Out:** no backend service changes expected (a11y/responsive are frontend-only concerns);
  `app/test-api/page.tsx` deletion is the one explicit destructive action.
- **Owns:** whatever files the audit finds needing a fix, plus the gap-matrix's own Triage column
  once Davin provides it.

## Ordered steps

_(to be finalized at DRAFT/CONFIRM from a real audit — this PRE-DRAFT intentionally leaves
step-level detail open, same discipline 6-10's and 6-11's own PRE-DRAFTs used before their DRAFT
passes)_

1. Re-verify Phase 6's own exit-criteria list against live code (not assumed from this PRE-DRAFT).
2. Confirm F11's triage status with Davin before treating the gap matrix as closeable.
3. Run a real accessibility pass (keyboard nav, ARIA labels/roles, color contrast, focus states)
   across the surfaces built in 6-2 through 6-11; fix what's found.
4. Run a real responsive pass (mobile/tablet breakpoints) across the same surfaces; fix what's
   found.
5. Delete `app/test-api/page.tsx`.
6. Final gap-matrix sweep: every row lands on built / internal-only / out-of-scope-ticketed.
7. Unit tests for whatever fixes Steps 3-4 produce.

## Rules specific to this variant

- **UI Creativity (Dial MEDIUM):** fixing real, found gaps — not redesigning working surfaces.
- **Data Discipline (Dial LOW, unchanged from every prior Phase 6 session):** no fabricated
  "operational"/"all clear" states introduced anywhere.
- **No new orphans:** any fix must stay reachable from its existing entry point.

## Done when

- [ ] Every Phase 6 exit criterion checked against live evidence, not assumed.
- [ ] F11 resolved (Davin's triage obtained) or explicitly, honestly recorded as still open with
      Phase 6's own close framed around that fact.
- [ ] Real a11y/responsive gaps found and fixed, or explicitly deferred with Davin's sign-off.
- [ ] `app/test-api/page.tsx` deleted.
- [ ] `tsc --noEmit` clean; `eslint --max-warnings 0` introduces 0 new warnings; `test:ci` green.

## Rollback

Same-stack UI work; rollback is `git revert`.

## Retire

`app/test-api/page.tsx` (per the playbook's own explicit instruction).

## Deviations

_(filled during execution)_

## Known wrinkles / do-not-touch

- `lib/api/index.ts` stays untouched (`EXECUTOR-PROTOCOL.md` §5) — Phase 7's concern, not this
  session's.
- `frontend/` mirror tree is out of scope (`EXECUTOR-PROTOCOL.md` §5).
- RiseWorks stays archived (F42).
- `DECISION-LOG.md` **F49** (dLocal `payment_method_flow`), **F60** (Stripe webhook cutover), and
  **F64** (subscription-card Undo flow) stay open, non-blocking — none are Phase 6 exit criteria.

## Next-session handoff

Phase 6 closes at this session (assuming its own exit criteria are genuinely met). Phase 7
(API client rewrite, Session 7-1 — "Re-verify + generate") is next per the session playbook.
