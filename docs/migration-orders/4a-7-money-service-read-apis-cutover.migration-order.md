# Migration Order — VERIFY/RETIRE variant

> For **cutovers, deletions, and exit reviews**: every CUTOVER session, 8-1 deletion sweep,
> 8-5 close-out, phase-exit checks. Read `00-SKELETON-AND-RULES.md` first — §4 applies with
> the dial at **near zero**: checklists exist to be obeyed. Keep this order SHORT (~10
> lines for a cutover). If executing it uncovers real work, STOP — that work gets its own
> session with the right variant.

> **Status: DRAFT** — updated by Advisor after Session 4A-5 (webhooks cutover) completed. Unblocked for shadow-run verification and cutover.

**Session:** 4A-7 · **Variant:** VERIFY-RETIRE · **Status:** DRAFT
**Generated:** 2026-07-22 · **Estimated time:** <1h once unblocked (auth design resolved,
frontend-side change only, no new backend code)
**Phase / plan section:** Phase 4A — money-service, blueprint §5.5 Slice 3 (of 5), CUTOVER
half
**Target service:** money-service / frontend data-fetching hooks

## Why this session, why now

Session 4A-6 (this close) BUILT 12 read-only GET endpoints into money-service
(`/v1/affiliate/dashboard/*`, `/v1/admin/*`) and deployed them to Railway production —
at unique paths the frontend doesn't call yet (Safety Gate), so they carry zero live
traffic. 4A-7 is the small, separate cutover session that repoints the frontend's data
hooks at money-service instead of the monolith's own `/api/*` routes. Per the playbook,
never combine BUILD and CUTOVER — same reasoning already established for Slice 1
(4A-2/4A-3) and Slice 2 (4A-4/4A-5).

**Browser-auth design question — RESOLVED same-day by Davin (blueprint §4.2):** Slices 1
and 2 never needed the BROWSER to authenticate to money-service directly — crons are
server-triggered (Vercel cron → `CRON_SECRET`) and webhooks are provider-triggered (HMAC
signature, no user session involved). This slice is different: `AffiliateDashboardController`
and the 3 admin controllers all sit behind `JwtAuthGuard`, which expects a `Bearer <token>`
header. §4.2's answer: **no cookie sharing across domains at all** — the frontend
manually extracts its own JWT (from wherever it already holds the NextAuth session
client-side) and attaches it as `Authorization: Bearer <token>` on every call to
money-service. This is a frontend-side change only; `JwtAuthGuard`/`AdminGuard`/
`AffiliateGuard` already expect exactly this header shape (Session 4A-6) and need no
changes — Davin confirmed the guards are correct as built. The 3 alternative mechanisms
this PRE-DRAFT originally sketched (token-exchange endpoint, server-side proxy, reusing
operation-service's pattern) are moot — none needed.

## Entry criteria

- [x] **The browser-auth design question is answered** — blueprint §4.2, Bearer-header
      pattern, confirmed by Davin 2026-07-22 (see UPDATE note above). No guard changes
      needed.
- [x] **Chain-length-one: Session 4A-5 (webhooks CUTOVER) has completed first.** (dLocal cutover completed 2026-07-24).
- [ ] **A real signed-in browser session has successfully called at least one of the 12
      new endpoints end-to-end using the Bearer-header pattern above** (not just the
      401-unauthenticated check Session 4A-6 already did) — proves the frontend's
      manual-JWT-attach actually works, not just that the design is decided.
- [ ] **Confirm the MONOLITH's own migration history already covers whatever
      money-service's `schema.prisma` subset assumes.** Corrected understanding
      (Davin, 2026-07-22): money-service shares the monolith's ONE database (blueprint
      §5.1, `money_svc` role) — this is a READ-ONLY verification (`prisma migrate
status` against the shared DB, or asking the monolith side directly), never a
      `db push`/`migrate deploy` run FROM money-service (`LESSONS-LEARNED.md` L1 now
      forbids that outright).
- [ ] Davin present/available — cutovers require his live approval.
- [ ] `NEXT_PUBLIC_MONEY_API_URL` (or equivalent) is actually set somewhere the frontend
      build can read it — not confirmed either way in this repo's artifacts.

## Checklist

**CUTOVER block** — auth design is resolved, but this order stays parked until the
chain-length-one entry criterion (4A-5 completing first) clears. Sketch, to be replaced
by the Advisor's DRAFT once unblocked:

1. Present the end-to-end signed-in-browser verification evidence (Entry criteria
   above). Missing → abort, this session cannot proceed.
2. Davin approves. His question ritual: "what's the rollback?" — answer TBD, depends on
   whether the cutover is a frontend env-var flip (fast, revertable) or a code change
   (needs its own revert/redeploy).
3. Flip the frontend's data-fetching for these 12 routes from the monolith's `/api/*` to
   money-service's `/v1/*` — one route group at a time (affiliate dashboard first, then
   admin), monitoring for errors before proceeding to the next group.
4. Record: `migration-cutover-table.md` (Slice 3 row → CUT-OVER), CLAUDE.md,
   DECISION-LOG.md (the auth-design decision, once made). Freeze (CC-F on
   `app/api/affiliate/dashboard/*`, `app/api/admin/{affiliates,analytics}/*` +
   `lib/affiliate/report-builder.ts`/`lib/admin/*`) stays until the RETIRE session.

- **Rollback:** TBD — depends on the cutover mechanism decided above.

## Rules specific to this variant

- No new code, no fixes, no "while I'm here" — observation and execution only. The
  auth design (Bearer header, frontend-side) needs no new backend code, but any
  frontend data-hook change to attach the header is itself real work — if it turns out
  more involved than a straightforward header attach, that's its own scoped change, not
  something to improvise mid-cutover.
- Any red result = stop and document, never "probably fine".

## Deviations

_(should normally be empty; a deviation here is itself a warning sign)_

## Next-session handoff

_(RETIRE session — delete `app/api/affiliate/dashboard/*`, `app/api/admin/{affiliates,
analytics}/*`, and their now-orphaned `lib/affiliate/report-builder.ts`/
`lib/affiliate/validators.ts`/`lib/admin/pnl-calculator.ts`/
`lib/admin/affiliate-management.ts` source once this slice has been stable in
production for a Davin-agreed duration; update `migration-stack-analysis.md`'s
money-service file inventory accordingly. Not yet scheduled.)_
