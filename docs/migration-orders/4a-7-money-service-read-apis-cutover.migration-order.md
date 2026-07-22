# Migration Order — VERIFY/RETIRE variant

> For **cutovers, deletions, and exit reviews**: every CUTOVER session, 8-1 deletion sweep,
> 8-5 close-out, phase-exit checks. Read `00-SKELETON-AND-RULES.md` first — §4 applies with
> the dial at **near zero**: checklists exist to be obeyed. Keep this order SHORT (~10
> lines for a cutover). If executing it uncovers real work, STOP — that work gets its own
> session with the right variant.

> **Status: PRE-DRAFT** — written by the Executor at Session 4A-6's close, per
> `EXECUTOR-PROTOCOL.md` §3.5. Needs the Advisor to produce the DRAFT, then Davin's
> APPROVAL. No fast-path here — unlike Session 4A-5's webhook cutover (a single provider-
> dashboard URL flip with no auth question), this cutover is the FIRST time the browser
> calls money-service directly with a user's own session — a genuinely open design
> question below, not just an open blocker.
>
> **Sequencing note for Davin/the Advisor:** this is now the SECOND pending cutover in the
> pipeline — Session 4A-5 (webhooks CUTOVER) is still sitting at DRAFT, blocked on its own
> entry criteria (secrets unset, no signed-payload replay yet), and was never resolved
> before Session 4A-6 (this order's own predecessor) went ahead and built Slice 3 anyway,
> on Davin's live instruction. Per `00-SKELETON-AND-RULES.md` §1.5 ("chain length is
> exactly one"), having TWO unresolved cutovers queued is already off the rails — please
> pick which of 4A-5 or 4A-7 goes first (they're independent, either order is safe), rather
> than letting a third BUILD session start before either resolves.

**Session:** 4A-7 · **Variant:** VERIFY-RETIRE · **Status:** PRE-DRAFT
**Generated:** 2026-07-22 · **Estimated time:** unknown — depends on the auth design
question below; could be <1h if the answer is simple, or this PRE-DRAFT may need to
become a small BUILD session first (a token-exchange endpoint, if that's the answer)
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

**Open design question, not yet answered anywhere in this repo's artifacts:** Slices 1
and 2 never needed the BROWSER to authenticate to money-service directly — crons are
server-triggered (Vercel cron → `CRON_SECRET`) and webhooks are provider-triggered (HMAC
signature, no user session involved). This slice is different: `AffiliateDashboardController`
and the 3 admin controllers all sit behind `JwtAuthGuard`, which expects a `Bearer <token>`
header carrying the SAME NextAuth-issued JWE the monolith's own `getServerSession()`
reads from an httpOnly cookie (see `money-service/src/auth/jwt-auth.guard.ts`, F6/F7's
bridge). A same-origin server-rendered page has that cookie automatically; a
browser-side `fetch()` to a DIFFERENT origin (`money.domain` per F16, not `api.domain`
or the frontend's own origin) does not — httpOnly cookies aren't readable by JS and
aren't sent cross-origin by default even if they were. Options, none yet evaluated:
(a) the frontend already has some mechanism for calling operation-service that this
slice can reuse — F30's own note says operation-service is "server-side proxied,
CORS unnecessary," which is a DIFFERENT approach than this money-service being called
"directly from the browser" (blueprint §5.4, quoted in `app.module.ts`'s own CORS
comment) — these two statements describe two different integration patterns for two
different services, so operation-service's approach may not transfer; (b) a small new
endpoint that exchanges the NextAuth session for a Bearer token the browser CAN hold
(e.g. in memory, from a same-origin Next.js API route that proxies the cookie); (c) the
frontend proxies these money-service calls server-side too (same-origin Next.js API
routes calling money-service with a server-to-server credential), which would make
`ALLOWED_ORIGINS` CORS config moot for these specific routes. **The Advisor should
resolve this against the blueprint (§5.4) and F16 before writing the DRAFT — this
PRE-DRAFT deliberately does not guess.**

## Entry criteria

- [ ] **The browser-auth design question above is answered** (blueprint §5.4 already
      committed to "browser calls money-service directly" — but the DECISION-LOG.md
      doesn't yet record how that's supposed to authenticate). Escalate per
      `EXECUTOR-PROTOCOL.md` §7 ("auth semantics" always escalates) if the answer isn't
      already implicit in an existing decision.
- [ ] **A real signed-in browser session has successfully called at least one of the 12
      new endpoints end-to-end** (not just the 401-unauthenticated check Session 4A-6
      already did) — proves whatever the auth answer above turns out to be actually
      works, not just compiles.
- [ ] **money-service's production database schema actually matches `schema.prisma`.**
      Per Session 4A-6's own Deviations: no session since 4A-1 has run `prisma db push`/
      `migrate deploy` against production — only `prisma generate` (client codegen,
      no DB connection). Any of these 12 routes hitting a real Postgres today would
      likely fail with "relation/column does not exist" the moment a real query runs
      past the auth guard. This has to happen before ANY real traffic reaches Slice 1,
      2, or 3 — verify `prisma migrate status`/`db push --accept-data-loss=false` (dry
      run first) against production before this cutover, regardless of which slice
      triggers it first.
- [ ] Davin present/available — cutovers require his live approval.
- [ ] `NEXT_PUBLIC_MONEY_API_URL` (or equivalent) is actually set somewhere the frontend
      build can read it — not confirmed either way in this repo's artifacts.

## Checklist

**CUTOVER block** — cannot be filled in further until the entry criteria above resolve
the auth design question. Sketch, to be replaced by the Advisor's DRAFT:

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

- No new code, no fixes, no "while I'm here" — observation and execution only. If
  resolving the auth design question requires new code (a token-exchange endpoint, a
  proxy route), that's a BUILD session, not this cutover.
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
