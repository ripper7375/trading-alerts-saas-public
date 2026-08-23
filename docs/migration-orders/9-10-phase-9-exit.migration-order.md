# Migration Order — Session 9-10 — Phase 9 Exit (VERIFY-RETIRE)

> For **cutovers, deletions, and exit reviews**: read `00-SKELETON-AND-RULES.md` first — §4
> applies with the dial at **near zero**: checklists exist to be obeyed. If executing it
> uncovers real work, STOP — that work gets its own session with the right variant.
> **PRE-DRAFTed by the Executor at Session 9-9's close (2026-08-23)**, per
> `MASTER-ROADMAP-PHASES-7-15.md` §3's own obligation. Fast-path eligible per
> `EXECUTOR-PROTOCOL.md` §4 (`PRE-DRAFT → APPROVED → CONFIRMED`, VERIFY-RETIRE skips DRAFT) —
> Advisor/Davin's call whether to take it.

**Session:** 9-10 · **Phase:** 9 (Frontend Stack Replacement) · **Variant:** VERIFY-RETIRE ·
**Status:** PRE-DRAFT
**Generated:** 2026-08-23 (Executor, at Session 9-9's close) · **Flags touched:** none known yet
(closes Phase 9's own residual flags if found still open).
**Estimated time:** ~2–3h (exit review across 9 prior sessions' worth of surface, not a single
cutover — heavier than the template's usual "~10 lines/<1h" cutover case, matching Phase 6's own
exit-session precedent).

---

## Why this session exists

Per `MASTER-ROADMAP-PHASES-7-15.md` §3: Session 9-9 (this order's own predecessor) shipped the
last of Phase 9's 10 sessions — all 85 CB1 routes ported across `app/layout.tsx`, `(marketing)`,
`(public)`, `(auth)`, `(dashboard)` core, `(dashboard)/settings`, root commerce, `app/affiliate/*`,
`(dashboard)/admin` core, and `(dashboard)/admin/disbursement`. Session 9-10 is the phase-exit
check: **prove** the swap is complete and clean, not just that each session's own order said so.

## Entry criteria (re-verify all at CONFIRM)

- [ ] **Session 9-9 CONFIRMED, executed, CLOSED** — disbursement nested layout live on `main`,
      route-manifest diff clean.
- [ ] **`frontend-swap-route-map.md` available and current** — the 9-0 map is this session's own
      contract; if any session's own Deviations amended it, confirm those amendments landed in
      the map file itself, not just in that session's own CLAUDE.md entry.
- [ ] **Admin test account confirmed active** (`admin-test@trading-alerts.test`, `role: ADMIN`).
- [ ] **Sequential test suite baselines green** (`LESSONS-LEARNED.md` L24):
  ```powershell
  npx tsc --noEmit
  npx eslint app components lib hooks --max-warnings 5
  npm run test:ci
  cd money-service; npm test -- --maxWorkers=1; cd ..
  cd operation-service; npm test -- --maxWorkers=1; cd ..
  ```

## Checklist (RETIRE / EXIT-REVIEW block)

1. **Route-map closure.** Walk `frontend-swap-route-map.md` row by row — every one of the 97
   rows (85 CB1 + the triaged codebase-2 extras) marked with a real disposition (ported / retired
   / consolidated), zero rows left unresolved. Cross-check against the 9 prior sessions'
   CLAUDE.md entries (now split across this file and `history/sessions-archive.md`) for any row a
   session's own Deviations moved, retired, or reassigned without the map being updated to match
   — per `LESSONS-LEARNED.md` L39, a map row's disposition needs its own evidence, not a sibling
   session's summary.
2. **Zero mock constants, repo-wide.** Grep `app/` + `components/` for fabricated data patterns
   (hardcoded arrays standing in for API responses, `Math.random()`-seeded stats, TODO-flagged
   placeholder copy) — the roadmap's own §6 risk statement names this as Phase 9's single biggest
   failure mode. Every prior session self-reported "Zero Mock Data" compliance; this session
   verifies it holds in aggregate, not just per-session.
3. **Component tests rebuilt, `test:ci` net-neutral-or-better.** Compare current suite count/pass
   rate against Session 9-0's own entry-criterion baseline (pre-swap). Per `LESSONS-LEARNED.md`
   L3 in this roadmap's own context (roadmap §6 point 2): a test needing its assertion changed
   across the phase is a finding, not a fix — reconcile any net test-count drop explicitly.
4. **Light + dark verified on every route.** Spot-check a representative page per prior session's
   layout boundary (9-1 through 9-9) in both themes; the `codebase-2-parity-audit/` batches
   already did this once per `LESSONS-LEARNED.md` L39's own citation, but re-verify post-swap
   since real data bindings (empty states, error states, badges) render paths the static parity
   audit couldn't exercise against seed-code alone.
5. **Dead codebase-1 components deleted.** Identify components/pages superseded by the swap
   (old, un-routed codebase-1 originals still on disk) and remove them — full test suite after
   each deletion batch, per the template's own RETIRE-block discipline.
6. **`phase-6-frontend-gap-matrix.md` marked SUPERSEDED-BY-PHASE-9** (not deleted — it is Phase
   6's own record, per the roadmap's explicit instruction).
7. **Route-manifest diff against the 9-0 map.** The full, final diff — every URL the map
   promised, present; nothing extra; nothing double-resolving (the `app/about/` +
   `app/(marketing)/about/` class of bug the roadmap's own §"Per-session exit check" names).
8. **Walk the phase exit criteria from `MASTER-ROADMAP-PHASES-7-15.md` §3 literally, one by
   one, evidence per item:** route parity with the 9-0 map · no dead internal links · no
   fabricated data · a11y + responsive at least at Session 6-12's own standard · `test:ci`
   net-neutral-or-better · a clean route-manifest diff against the 9-0 map.
9. **Record:** `migration-cutover-table.md` (only if any row's status genuinely moved — Phase 9
   was additive builds throughout, so this may correctly stay a no-op), `CLAUDE.md`,
   `DECISION-LOG.md` (close any Phase-9-scoped flags still open — check **F81** specifically:
   registered 9-9, may or may not be in scope for this session to resolve vs. hand off), propose
   Phase 10's entry check per the roadmap's own §0 running order (Phase 10 — Drawing Engine &
   Line-Alert closure — is next; per the roadmap, **9-10 also writes `HANDOVER-PROMPT-phase-10.md`
   per the roadmap's own closing-row convention**, unless F65/F66-style prior-phase precedent
   says otherwise — confirm at CONFIRM).

- **Rollback:** git revert of this session's own deletion/edit commits (deletions are the easy
  rollback per the template).

## Rules specific to this variant

- No new code, no fixes, no "while I'm here" — observation, deletion of already-dead surface, and
  documentation only. If a route map row turns out to hide real unbuilt work, STOP — that's a new,
  properly-scoped session, not a fold-in here.
- Any red result (a failing test, an unresolved map row, a fabricated-data hit) = stop and
  document, never "probably fine."

## Deviations

<!-- should normally be empty; a deviation here is itself a warning sign -->

## Next-session handoff

- **Next session:** Per `MASTER-ROADMAP-PHASES-7-15.md` §0's running order, **Phase 10** (Drawing
  Engine & Line-Alert closure) begins at **Session 10-1** — resolve **F67** (where the live
  drawing-alert smoke test runs) first.
- **Prerequisite:** Session 9-10 CLOSED — Phase 9 fully verified and exited.
