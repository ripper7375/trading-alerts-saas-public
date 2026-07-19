# Migration Order — Enforcement Smoke Test + Phase 1 Exit Review

> `TEMPLATE-VERIFY-RETIRE.md` variant (EXIT-REVIEW block) — dial near zero, checklist
> exists to be obeyed. If this uncovers real work, stop and give it its own session.
> **Status: PRE-DRAFT** — written by the Executor at Session 1-3's close (2026-07-19).
> Fast-path eligible: PRE-DRAFT → APPROVED → CONFIRMED.

**Session:** 1-4 · **Phase:** Phase 1 (Railway PostgreSQL, Workstream 7) · **Variant:**
VERIFY-RETIRE · **Generated:** 2026-07-19 · **Estimated time:** <1h.

## Hard dependency

**Cannot run before Session 1-3b (PgBouncer) completes.** Plan §3 step 1.5's smoke test
and the exit criteria below both assume PgBouncer is live. If 1-3b hasn't run yet, this
order isn't ready to APPROVE regardless of what else is true.

## Context — this session is smaller than the playbook originally scoped

The playbook's Session 1-4 text predates the Option A pivot and still says
"`gateway_ingest` can only write market data" and "confirm `railway-gateway` ingest never
blipped." Both are moot — `railway-gateway`/`market_data_v6` were never deployed
(`DECISION-LOG.md`, Session 1-1 close-out / 1-2b pivot); there is no `gateway_ingest`
role and nothing ingesting to check. Flagging this rather than silently carrying stale
tasks forward.

What's actually left to verify, given 1-3 and 1-3b's own work already did most of the
positive/denial testing directly:

- **money_svc/core_app fences hold identically through the pooler as direct.** 1-3
  proved this direct; 1-3b's own step 2 proves it through PgBouncer. This session's job
  is a final, independent, combined re-check — not first-time discovery.
- **Phase 1 exit criteria** (plan §3, lines 229–234), walked explicitly:
  1. "Railway Postgres reachable; backups on; roles and PgBouncer live; grant script
     committed." — Postgres/roles/grant-script: done (1-3). PgBouncer: done (1-3b,
     assuming it closes clean). **Backups: F18's gap is still open** (automated-backup
     cadence unverified, dashboard-only) — this criterion cannot be marked fully met
     until that's checked.
  2. "`railway-gateway` still ingesting market data without interruption." — **N/A under
     Option A**; nothing exists to interrupt. Note as satisfied-by-inapplicability, not
     silently dropped.
  3. "Monolith still fully functional against the (possibly re-homed) database." — true
     throughout 1-3/1-3b if both sessions kept their "never break the always-on paths"
     promise (re-verify, don't assume).

## Entry criteria

- [ ] Session 1-3b's Done-when items all checked (PgBouncer live, pass-through verified).
- [ ] Railway CLI access to `trading-alerts` (re-verify `railway status`).
- [ ] F18 backup-cadence gap — check the Railway dashboard Backups tab if at all
      possible this session; if still unreachable, exit criterion 1 stays partially open
      and must be stated as such, not glossed over.

## Checklist (EXIT-REVIEW block)

1. Confirm stability precondition: 1-3 and 1-3b both closed with all their own
   Done-when items checked, no unresolved Deviations flagged as blocking.
2. Combined smoke test: connect as `money_svc` and `core_app`, through BOTH the direct
   URL and the pooled (PgBouncer) URL. Prove: `money_svc` cannot read `User` (either
   path); `core_app` cannot read `Payment`/`Commission` (either path); both can still act
   on their own tables (either path). Document exact errors, same discipline as 1-3.
3. Walk Phase 1's 3 exit criteria (plan §3) one by one, evidence per item — including
   the two known partial/N/A items above (F18 gap; Option A inapplicability). Don't
   mark the phase "exit-clean" if F18 is still genuinely open — say so.
4. Record: CLAUDE.md (Phase 1 formally closed or not, per step 3's honest answer),
   `DECISION-LOG.md` (F18 fully closed if the backup check succeeds this session),
   propose Phase 2's entry check (Session 2-1 — Prisma upgrade in isolation).

- **Rollback:** this is a verification-only session — no state changes to roll back
  (unless step 2 reveals an actual enforcement gap, in which case: stop, do not mark
  Phase 1 exit-clean, treat it as a new finding needing its own INFRA-variant fix
  session, same as F20 was handled in Session 1-3).

## Rules specific to this variant

- No new code, no fixes, no "while I'm here" — observation and execution only.
- Any red result (a fence that doesn't hold, an exit criterion that isn't actually met)
  = stop and document, never "probably fine."

## Deviations

_(should normally be empty; a deviation here is itself a warning sign)_

## Next-session handoff

_(PRE-DRAFT for Session 2-1 — Prisma upgrade in isolation — once this order closes,
assuming Phase 1 exit review passes clean)_
