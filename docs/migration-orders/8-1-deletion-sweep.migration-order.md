# Migration Order — Session 8-1 — Deletion Sweep

> Read `00-SKELETON-AND-RULES.md` first — §4 applies with the dial at **near zero**: this is a
> **VERIFY-RETIRE** session (named explicitly in `00-SKELETON-AND-RULES.md` §2's variant table —
> "every CUTOVER, 8-1, 8-5, phase exits"). Deletion of migrated surface only, no new code, no
> fixes, no "while I'm here." **PRE-DRAFTed by the Executor at Session 10-3's close (2026-08-24)**
> per `MASTER-ROADMAP-PHASES-7-15.md` §"Phase 8A". **Fast-path eligible**
> (`EXECUTOR-PROTOCOL.md` §4): as a VERIFY-RETIRE session, this PRE-DRAFT may go straight to
> Davin for `APPROVED`, skipping the Advisor DRAFT step — but see the open question below, which
> the Advisor should resolve first if it upgrades to a full DRAFT.

**Session:** 8-1 · **Phase:** 8A (Decommission, part 1 — first of 2 sessions) · **Variant:**
VERIFY-RETIRE · **Status:** PRE-DRAFT
**Generated:** 2026-08-24 (Executor, at Session 10-3's close) · **Estimated time:** ~2–3h (real
blast radius: deleting production route files, not pure documentation).

---

## Why this session exists

Per `MASTER-ROADMAP-PHASES-7-15.md` §"Phase 8A": "8-1 — Deletion sweep. Delete migrated
`app/api/**` except keepers, the `frontend/` mirror dLocal slice, empty `vercel.json` crons, and
the 6 dead `token-2fa-*` files if 7-2 left them." This is Phase 8A's first of two sessions —
removing dead monolith surface now that Phases 7, 9, and 10 have proven the migrated replacements
live, and clearing space before Session 8-2's gateway/schema work.

---

## Open question the Advisor should resolve first (not resolved here — PD1 judgment call, not a Davin escalation)

The roadmap's own literal instruction ("delete migrated `app/api/**`") predates **F65**'s actual
resolution. F65 resolved — Session 9-0 (2026-08-22) — to **retain `app/api/**`permanently as the
BFF proxy layer**, not retire it. That means the route *files* under`app/api/**`are not
generically deletable just because their underlying logic moved to`operation-service`/
`money-service` — most of them are the live forwarding layer the browser still calls. What this
session can actually delete is narrower than the roadmap's own shorthand suggests: candidates are
routes with **zero remaining callers at all** (pre-BFF direct-implementation code fully superseded
and never re-pointed, or genuinely orphaned handlers), not the BFF routes themselves. The Advisor
should cross-check `migration-cutover-table.md`'s per-slice status against a real `app/api/**`
inventory before this order's checklist names specific files — do not let the roadmap's own
pre-F65 phrasing stand in as the deletion list.

---

## Entry criteria (re-verify all at CONFIRM)

- [ ] **Phase 4X (4A-13, 4A-14, 4A-15, 4A-16) CLOSED** — F49/F60/F76 all RESOLVED in
      `DECISION-LOG.md`. **Currently FAILING as of this PRE-DRAFT**: 4A-13/14/15 are closed, but
      **4A-16 has not run and F76 is still OPEN** (dLocal `payment_method_id` sent to the Payins
      API is a display name, not the real method code; `MIGRATE_WRITE_APIS_MONEY_DLOCAL` stays
      `false`). This is the roadmap's own explicit gate ("all four CLOSED before Session 8-1
      opens") — re-verify at this session's own CONFIRM; do not open if still failing.
- [ ] **Phase 9 (9-0…9-10) CLOSED** — true as of Session 9-10 (2026-08-22).
- [ ] **Phase 10 (10-1…10-3) CLOSED** — true as of this session's own close (2026-08-24).
- [ ] **F65 (BFF boundary) resolved** — true, Session 9-0 (2026-08-22); see the open question
      above for what its resolution actually implies about scope.
- [ ] **Baseline test suites 100% green** — re-verify fresh at CONFIRM: monolith `test:ci`
      (153 suites, 2198 tests), `operation-service` (42 suites, 395 tests), `money-service`
      (62 suites, 526 tests) as of this PRE-DRAFT's own writing.

---

## Checklist

**RETIRE / EXIT-REVIEW block**

1. Confirm the Phase 4X gate above is actually met (not just re-read — check `DECISION-LOG.md`'s
   live F76 row). If 4A-16 hasn't run, **stop and ask Davin** whether to schedule it first or
   whether this session's scope should exclude anything dLocal-adjacent.
2. Build the real deletion list against `migration-cutover-table.md` and a live `app/api/**`
   inventory — per the open question above, this is **not** simply "every migrated route,"
   since F65 retains the BFF layer. Delete only routes with zero remaining callers: the `6 dead
token-2fa-*` files (re-verify they still exist — a repo search at this PRE-DRAFT's own writing
   found none under `app/api/**`, likely already removed by Session 7-2), empty `vercel.json`
   cron entries, and any other route confirmed dead by the cutover table. Keep the `frontend/`
   mirror dLocal slice explicitly (`EXECUTOR-PROTOCOL.md` §5 exception).
3. Full test suite after each deletion batch, not just at the end — a stale `app/about/`-class
   collision (two files resolving to one route) fails the Next.js build, not `tsc`/`test:ci`.
4. Record: `migration-cutover-table.md` (any slice retired), `CLAUDE.md`, `DECISION-LOG.md` if any
   new finding surfaces; propose Session 8-2's entry check.

- **Rollback:** `git revert` of the deletion commit(s) — deletions are the easy rollback, per this
  variant's own standing note.

---

## Rules specific to this variant

- No new code, no fixes, no "while I'm here" — observation and execution only.
- Any red test result = stop and document, never "probably fine."
- Money-adjacent: anything touching a still-live dLocal code path escalates
  (`EXECUTOR-PROTOCOL.md` §7) rather than being deleted on the assumption it's dead.

---

## Deviations

<!-- Filled by Executor during execution per EXECUTOR-PROTOCOL.md §3 -->

---

## Next-session handoff

- **Next session:** `8-2` — Gateway deployment & schema dedup (Phase 8A, second of 2 sessions).
  Must run before Session 13-1, which adds a PL/pgSQL trigger to the same `market_data_v6` schema
  this session deduplicates. Touches `railway-gateway/` — the ingest path
  `EXECUTOR-PROTOCOL.md` §5 says must never blip.
- **Prerequisite:** Session 8-1 CLOSED SUCCESSFUL.
