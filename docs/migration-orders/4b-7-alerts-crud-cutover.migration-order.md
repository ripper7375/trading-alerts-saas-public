# Migration Order: Alerts CRUD CUTOVER & RETIRE (Session 4B-7)

> Fast-path eligible per `EXECUTOR-PROTOCOL.md` §4 (VERIFY-RETIRE: PRE-DRAFT → APPROVED directly).

**Session:** 4B-7 (CUTOVER & RETIRE) · **Variant:** VERIFY-RETIRE (Creativity Dial: **near zero**)
**Target service:** Monolith (`app/api/alerts/**`) write path + Railway/Vercel env (`MIGRATE_ALERTS_CRUD`)
**Status:** PRE-DRAFT
**Generated:** 2026-08-01 (Executor, at Session 4B-6's close)
**Flags touched:** `MIGRATE_ALERTS_CRUD` (`false` → `true`)

---

## Entry criteria

- [ ] Session 4B-6 CONFIRMED and closed (2026-08-01) — all 4 monolith routes flag-wired
      (`shouldUseOperationServiceForAlertsCrud()` checked immediately after each handler's own auth
      check), commit `29ab43c5` (last of 6 this session) pushed to `origin/main`.
- [ ] No shadow/mirror-run mechanism exists for this flag — a single on/off gate, no traffic to
      diff pre-flip (same root cause as F44/Slice 3 and F51/Slice 5). Per that established
      precedent, Davin's own live authenticated test IS this session's verification method — **do
      not fabricate a shadow-run diff or an elapsed-time claim that doesn't apply here** (per the
      standing rule at `CLAUDE.md` Waiting-on #75/#84/#88).
- [ ] `OPERATION_SERVICE_URL` confirmed present (value-blind) on Vercel production — this is a
      pre-existing dependency (since Session 3-3, already used by the live 2FA routes), re-verify
      rather than assume it's still correct.
- [ ] Davin present/available for the live flip approval and the first authenticated test request
      per route.

---

## Checklist

**CUTOVER block**

1. No shadow-run diff exists to present (see Entry criteria) — skip straight to Davin's live
   authenticated test per route as the verification method (same shape as Slice 3's 4A-7b / Slice
   4's 4A-10b/10c).
2. Davin approves the flip live. His question ritual: "what's the rollback?" — answer: flag-only
   revert, see below.
3. Flip `MIGRATE_ALERTS_CRUD=true` on Vercel production, redeploy.
4. Run one real authenticated request per handler (8 total: `GET`/`POST /api/alerts`,
   `GET`/`PATCH`/`DELETE /api/alerts/[id]`, `GET`/`POST /api/alerts/line`,
   `PATCH`/`DELETE /api/alerts/line/[id]`) — cross-check `operation-service`'s own Railway logs that
   each request genuinely reached `AlertsController`/`LineAlertsController`, not just that the
   monolith returned a plausible-looking response (L18: an auth/guard success alone proves nothing
   about the schema/downstream logic actually running).
5. Monitor `operation-service` error logs + response codes for a short window after all 8 are
   confirmed. Green?
6. Record: `migration-cutover-table.md` (Slice 7 row → CUT-OVER), `CLAUDE.md`.

- **Rollback:** `MIGRATE_ALERTS_CRUD=false`, redeploy. Both sides already read/write the identical
  Prisma tables — a flag-only revert, no data migration to reverse either direction.

**RETIRE block** — open scope question, needs Davin/Advisor's call before DRAFT, not decided here

1. Confirm the cutover above is genuinely stable — per Davin's own live judgment, not a timer (no
   wait-clock mechanism applies to this flag class, same as the CUTOVER block's own entry
   criterion).
2. **Scope not yet settled — flag for the Advisor/Davin at DRAFT time:** Slices 3 and 4 (4A-7b,
   4A-10b/10c) both left their monolith routes' own Prisma fallback branch in place indefinitely
   after cutover (no dedicated RETIRE session has run for either, per `CLAUDE.md`'s own carried-
   forward note under "Next session"). Slice 6 (4B-3), by contrast, deleted the monolith's dead
   alert-engine code in the SAME session as its cutover. This order was PRE-DRAFTed at 4B-5's close
   already naming this session "CUTOVER & RETIRE" — but whether "retire" here means (a) delete each
   route handler's now-dead `else` branch (Prisma fallback) while keeping the flag check and files
   themselves, matching Slice 6's shape, or (b) leave the fallback in place like Slices 3/4 and
   defer real deletion to a later, separately-scoped session, has not been decided. **Do not delete
   any monolith Prisma logic without this being resolved explicitly** — if unresolved by CONFIRM,
   treat this as a stop-and-ask trigger and execute CUTOVER only, re-PRE-DRAFTing a narrower RETIRE
   session once Davin decides.
3. If retiring code this session (per the resolved scope above): full monolith test suite green
   after the change, `tsc --noEmit`/`eslint --max-warnings 0` clean.
4. Record: `migration-cutover-table.md`, `CLAUDE.md`, `migration-stack-analysis.md` if any file's
   line count changed materially.

- **Rollback:** if code was deleted, `git revert` of the deletion commit (deletions are the easy
  rollback per this variant's own template). If RETIRE was skipped this session, nothing to revert.

---

## Rules specific to this variant

- No new code, no fixes, no "while I'm here" — observation and execution only.
- Any red result = stop and document, never "probably fine".

---

## Deviations

_(should normally be empty; a deviation here is itself a warning sign)_

---

## Next-session handoff

Session playbook's own remaining Phase 4B domain-slice order (per `CLAUDE.md`'s "Next session"
note at 4B-6's close): drawings + drawing-alerts → notifications → tier (guard) →
user/profile/2FA/sessions → market-data channel proxy.
