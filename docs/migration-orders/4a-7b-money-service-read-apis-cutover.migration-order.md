# Migration Order — VERIFY/RETIRE variant

> For **cutovers, deletions, and exit reviews**. Read `00-SKELETON-AND-RULES.md` first — §4 applies
> with the dial at **near zero**: checklists exist to be obeyed. Keep this order SHORT (~10 lines for
> a cutover). **If executing it uncovers real work, STOP** — that work gets its own session with the
> right variant.

**Session:** 4A-7b · **Variant:** VERIFY-RETIRE · **Status:** CONFIRMED
**Generated:** 2026-07-26 (Advisor) · **Updated:** 2026-07-26 (Executor, at CONFIRM — re-verified
codebase+runtime; found `MONEY_SERVICE_URL`/both flags never actually existed in Vercel production
despite 4A-7a's close-out claim, added all 3 there (flags `false`), redeployed to establish a real
OFF baseline, re-verified clean, then confirmed)
**Estimated time:** <1h per group (2 groups)
**Phase / plan section:** Phase 4A — money-service, blueprint §5.5 **Slice 3 (of 5)**, CUTOVER half
**Supersedes:** `4a-7-money-service-read-apis-cutover.migration-order.md` (together with `4a-7a-…`)
**Flags:** `MIGRATE_READ_APIS_MONEY_AFFILIATE` (4 routes) and `MIGRATE_READ_APIS_MONEY_ADMIN` (8 routes) — **two** flags; both currently OFF everywhere. F44/F45 resolved in 4A-7a ([`DECISION-LOG.md`](file:///d:/SaaS%20Project/trading-alerts-saas-public/docs/migration-orders/DECISION-LOG.md)).

---

## Entry criteria

- [x] **4A-7a closed all-green**, and its end-to-end evidence is in its Deviations: a script-minted
      test-fixture token's request confirmed (via Railway logs) reaching money-service, correctly
      passing `JwtAuthGuard`+`AffiliateGuard`, and executing a real Prisma lookup. 403 (wrong role) verified clean. 401 (signed out) hit a pre-existing bug ([`LESSONS-LEARNED.md` L12](file:///d:/SaaS%20Project/trading-alerts-saas-public/docs/migration-orders/LESSONS-LEARNED.md)) — non-blocking for this cutover.
- [x] **Both `MIGRATE_READ_APIS_MONEY_AFFILIATE` and `MIGRATE_READ_APIS_MONEY_ADMIN` exist and are
      currently OFF in production** — **initially FAILED at CONFIRM**: value-blind `vercel env ls`
      showed neither flag nor `MONEY_SERVICE_URL` existed in Vercel production at all (4A-7a's
      "added to `.env.example`" was never carried into the real environment). Fixed this session,
      Davin-approved: added all 3 (flags `false`), redeployed
      (`trading-alerts-saas-frontend-bt69dabys.vercel.app`), re-verified value-blind — all 3 present.
      Smoke-tested both route groups post-redeploy: `admin/analytics` → 401 (guard correct, flag
      off); `affiliate/dashboard/stats` → 500, confirmed as the pre-existing L12 bug
      ([route.ts:82-98](file:///d:/SaaS%20Project/trading-alerts-saas-public/app/api/affiliate/dashboard/stats/route.ts)), not a regression from this change.
- [x] **The F44 evidence is in hand** — resolved to Option (a), manual parity verification: the
      12/12-route parity table in [`4a-6_test-results_ready_to_proceed_with_4a-7a.md`](file:///d:/SaaS%20Project/trading-alerts-saas-public/docs/migration-orders/4a-6_test-results_ready_to_proceed_with_4a-7a.md). No shadow-run clock to check; that evidence file itself is the gate.
- [x] **Davin present** — confirmed live in chat this session.

---

## Checklist

**CUTOVER block**

1. Present the F44 evidence (the 12/12 parity table). **Every mismatch explained?** (The only
   observed difference anywhere was `period.start`/`period.end` timestamps reflecting each request's
   own execution time — expected, not a real mismatch.) If anything else is unexplained → abort and
   schedule an investigation session.
2. Davin approves, **per group**. His ritual question — _"what's the rollback?"_ — answer below.
3. **Flip one group at a time**, confirming each is clean before the next:
   **(a)** `MIGRATE_READ_APIS_MONEY_AFFILIATE` (4 affiliate-dashboard routes) →
   **(b)** `MIGRATE_READ_APIS_MONEY_ADMIN` (all 8 admin/report routes together).
   Lowest blast radius first; money reports last.
4. Set the flag in Vercel's production environment variables and **redeploy** — Vercel does not
   re-read env vars into already-built serverless functions without a redeploy, so this is a
   config-only redeploy (no code change), not a silent runtime flip.
5. Monitor error rate and p95 for the flipped group (Vercel + Railway money-service logs) before
   proceeding to the next group. Green?
6. Record: `migration-cutover-table.md` (Slice 3 → `CUT-OVER`, noting F44's substitution), CLAUDE.md,
   DECISION-LOG. CC-F freeze on `app/api/affiliate/dashboard/*`,
   `app/api/admin/{affiliates,analytics}/*` and their `lib/` logic **stays until the RETIRE session**
   — deleting the monolith's copies is explicitly NOT this session's job.

- **Rollback (either group):** set the relevant flag back to `false` in Vercel's production
  environment and **redeploy**. No code change, no data migration — the monolith's own Prisma logic
  is untouched underneath the flag the whole time. **Not rehearsed in staging** — none exists
  (CC-A/**F34**) — so this is reasoned-about only, the same caveat carried by Slices 1 and 2. Davin
  should know that before approving.

---

## Rules specific to this variant

- No new code, no fixes, no "while I'm here". F44 resolved to manual parity verification, so there is no temporary diff path to delete — nothing to clean up beyond the flag flips themselves.
- Any red result = stop and document, never "probably fine".
- If flipping a group reveals that the transport needs a change, **that is 4A-7a's work reopening** —
  stop, flip back, and give it its own session. This split exists precisely so that cannot be
  improvised.

---

## Deviations

**CONFIRM-time (before any flip):** the order's entry criterion #2 initially FAILED. Value-blind
`vercel env ls` (all environments) showed `MONEY_SERVICE_URL`, `MIGRATE_READ_APIS_MONEY_AFFILIATE`,
and `MIGRATE_READ_APIS_MONEY_ADMIN` did not exist anywhere in the Vercel project — not "OFF", simply
never created — despite 4A-7a's close-out claiming they were "added to `.env.example`" (true, but
that's the checked-in example file only, never carried into the real environment). Impact if
undetected: [lib/money-service/client.ts:15](file:///d:/SaaS%20Project/trading-alerts-saas-public/lib/money-service/client.ts)
falls back to `http://localhost:3002` when `MONEY_SERVICE_URL` is unset — unreachable from a Vercel
serverless function — so flipping either flag with the URL still missing would have hard-failed
100% of that group's traffic (no fallback, since the flag itself is what disables the monolith path).
Stopped, reported to Davin, got live approval to fix rather than treat as a session-swap blocker.
**Fix (Davin-approved, live):** added all 3 vars to Vercel production (`MONEY_SERVICE_URL` set to
money-service's real Railway URL, both flags `false`), redeployed
(`trading-alerts-saas-frontend-bt69dabys.vercel.app`) to establish the real OFF baseline, re-verified
value-blind, smoke-tested both route groups (see `migration-cutover-table.md` Slice 3 row for exact
results) before proceeding with the checklist as ordered. No code changed — config only, matching
this variant's own scope rule.

**Execution:** both groups flipped and redeployed clean per the checklist. Unauthenticated
smoke-test after each flip surfaced no regression: the affiliate group's 500s trace to the
pre-existing L12 bug (confirmed present identically in all 4 route files, unrelated to this
session); the admin group returned 401 consistently across all 8 routes. **Not fully closed:** no
real authenticated request has yet been observed reaching money-service post-cutover in either
group — this session's monitoring was build health + guard-behavior smoke tests + log absence-of-
errors, not a live authenticated round trip (minting a fresh production auth token was judged out of
this VERIFY-RETIRE session's scope — that touches secrets/auth semantics beyond the order's explicit
steps). Same open-monitoring-caveat class as Slices 1 and 2 — carried to CLAUDE.md's Waiting-on.

**Session-close test results (`EXECUTOR-PROTOCOL.md` §3.1):** zero application code changed this
session (env vars + docs only), so the full existing baseline was re-run to confirm no drift:
`tsc --noEmit` clean (exit 0), `eslint app components lib hooks --max-warnings 0` clean (exit 0),
`npm run test:ci` → **117/117 suites, 2082/2082 tests**, exact parity with Session 5-4's last
recorded baseline. All green.

---

## Next-session handoff

_(PRE-DRAFT `4a-w1-…` is already DRAFTed and awaiting Davin's approval — Part 19.5 begins after this
session. Also note for a future RETIRE session: `app/api/affiliate/dashboard/*`,
`app/api/admin/{affiliates,analytics}/*` and the now-orphaned
`lib/affiliate/report-builder.ts` / `lib/affiliate/validators.ts` / `lib/admin/pnl-calculator.ts` /
`lib/admin/affiliate-management.ts` become deletable once this slice has been stable for a
Davin-agreed duration. Not yet scheduled.)_
