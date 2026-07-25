# Migration Order — UI-BUILD variant (with embedded CONTRACT decisions)

> For **new/redesigned frontend surfaces** (UI-BUILD) and **specs/decisions** (CONTRACT).
> Read `00-SKELETON-AND-RULES.md` first — §4 applies with the dial at **High** for design, but
> **Low** for anything touching auth semantics: the contract constrains the data, not the design,
> and auth is not a place to be creative.

**Session:** 4A-7a · **Variant:** UI-BUILD (+ CONTRACT for decisions) · **Status:** CONFIRMED (2026-07-25, Executor — re-verified codebase/runtime state per EXECUTOR-PROTOCOL.md §1.3; type-check + eslint 100% clean per Davin's live clarification on the `npm run validate` gate, `validate:format`'s 287-file failure isolated to a pre-existing Windows CRLF checkout artifact, not a regression)
**Generated:** 2026-07-25 (Advisor) · **Estimated time:** 3–4h (split 4A-7a1/4A-7a2 if it overruns)
**Phase / plan section:** Phase 4A — money-service, blueprint §5.5 **Slice 3 (of 5)** — BUILD half of split Session 4A-7
**Flags touched:** **F44** (resolve — read-API shadow/verification mechanism) · **F45** (resolve — browser→money-service transport)
**Re-opens / updates:** CLAUDE.md Waiting-on **#34**
**Target service:** monolith frontend + Next.js route handlers (money-service unchanged)
**Contract:** 12 GET routes in money-service (Session 4A-6) — shapes are frozen; this session changes _who calls them and how_.

---

## Why this session exists (and why `4a-7-…` is SUPERSEDED)

`4a-7-money-service-read-apis-cutover.migration-order.md` was drafted as a VERIFY-RETIRE order carrying **real build work** (env vars, transport module, client-side header attachment). VERIFY-RETIRE forbids new build work. Furthermore, execution uncovered **two blockers (one architectural)**:

### Blocker 1 — The browser cannot read the JWT (planned mechanism impossible)

Waiting-on #34 recorded: _"The Next.js frontend will manually extract its JWT and attach it as a Bearer header when calling money-service's Read APIs."_
Verified against live code (2026-07-25), client-side JS **cannot** access the session token:

| Evidence                                                                        | Path                                                                                                                                      |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| NextAuth session cookies are `httpOnly: true` (×3 cookie definitions)           | [`lib/auth/auth-options.ts:552, 564, 576`](file:///d:/SaaS%20Project/trading-alerts-saas-public/lib/auth/auth-options.ts#L552-L576)       |
| _"token never reaches client JS — it lives only in this httpOnly cookie"_       | [`app/api/auth/token-refresh/route.ts:27`](file:///d:/SaaS%20Project/trading-alerts-saas-public/app/api/auth/token-refresh/route.ts#L27)  |
| `tokenCookieOptions()` sets `httpOnly: true`                                    | [`lib/operation-service/cookies.ts:34-40`](file:///d:/SaaS%20Project/trading-alerts-saas-public/lib/operation-service/cookies.ts#L34-L40) |
| _"Server-only fetch helper… browser never talks to operation-service directly"_ | [`lib/operation-service/client.ts:1-13`](file:///d:/SaaS%20Project/trading-alerts-saas-public/lib/operation-service/client.ts#L1-L13)     |

Client-side JavaScript has no access to an `httpOnly` cookie. **F45 resolves how browser requests reach money-service.**

### Blocker 2 — No shadow-run was started, and no mechanism exists for one

The cutover table shows `shadow start: —`, `diff clean?: —`. A 48h read shadow-run requires dual-calling old and new backends, or a staging environment (CC-A/**F34**, never built). Slice 1 hit this wall and Davin resolved it via **F35** (manual parity verification instead of a parallel run). **F44 resolves the verification standard for Slice 3.**

**Consequence:** `4a-7-…` is **SUPERSEDED** by `4a-7a-…` (this BUILD order) plus `4a-7b-…` (the eventual CUTOVER order). **This session (4A-7a) does NOT cut over any traffic.**

---

## Entry criteria

_ (verified at CONFIRM time — `EXECUTOR-PROTOCOL.md` §1.3)_

- [ ] **Davin available** — F45 (auth semantics) and F44 (verification standard) require authorizer decision.
- [ ] Session 4A-6 is `BUILT`: all 12 GET routes respond **401** to unauthenticated requests. Re-verify by actual request.
- [ ] The four Blocker-1 `httpOnly` evidence points above still hold (re-grep `lib/auth/auth-options.ts`).
- [ ] **Parity test baseline verified**: review [`4a-6_test-results_ready_to_proceed_with_4a-7a.md`](file:///d:/SaaS%20Project/trading-alerts-saas-public/docs/migration-orders/4a-6_test-results_ready_to_proceed_with_4a-7a.md) (12/12 GET routes parity match + 401/403 guard checks green).
- [ ] **Stale monitoring items checked**:
  - CLAUDE.md Waiting-on **#36**: Slice 1 cron tick logs in Railway (`money-service` UTC 00:00–04:00 window — clean).
  - CLAUDE.md Waiting-on **#38**: dLocal live webhook delivery log check.
- [ ] **Confirm monolith migration history covers money-service's `schema.prisma` subset** — read-only check (`prisma migrate status` from monolith). **Never run `db push` or `migrate deploy` from money-service** ([`LESSONS-LEARNED.md` L1](file:///d:/SaaS%20Project/trading-alerts-saas-public/docs/migration-orders/LESSONS-LEARNED.md)).
- [ ] `npm run validate` green on monolith before any edit.

---

## Integration points

- **In:** Browser, Next.js server components, Next.js route handlers.
- **Out:** money-service's 12 GET routes (`/v1/affiliate/dashboard/*`, `/v1/admin/*`).
- **Owns:** Transport module (`lib/money-service/client.ts`, `lib/money-service/routes.ts`) and feature flag `MIGRATE_READ_APIS_MONEY`. Owns **no business/money logic** and **no auth logic**.

---

## Ordered steps

### 1. Resolve F45 — How does a browser-initiated read reach money-service?

Present options to Davin with the Blocker-1 evidence. **Do not proceed to step 2 until he decides.**

| Option                                      | Mechanism                                                                                                                                                                                                                                   | Impact / Assessment                                                                                                                                                                                                                                                  |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **(a) Server-side proxy** — _(Recommended)_ | Next.js route handlers call money-service using `lib/operation-service/client.ts` pattern; session JWE read server-side from `httpOnly` cookie and forwarded as `Authorization: Bearer`. Browser talks only to its own origin (`/api/...`). | **Consistent with F30.** Token stays server-side in `httpOnly` cookie. No CORS needed. Makes 4A-7b a clean base-URL proxy swap. `NEXT_PUBLIC_MONEY_API_URL` replaced by server-only `MONEY_SERVICE_URL`. `ALLOWED_ORIGINS` in `money-service` becomes unused config. |
| (b) Token-vending endpoint                  | Next.js route reads `httpOnly` cookie and returns session JWE to client JS, which attaches `Bearer` on direct call to money-service.                                                                                                        | **Security risk:** Puts 30-day session JWE into JS-accessible memory. One XSS yields account takeover. Not recommended.                                                                                                                                              |
| (c) Short-lived scoped token                | Mint ~5-min money-service-scoped token for browser direct calls.                                                                                                                                                                            | High complexity for Slice 3; requires new token minting/refresh logic in money-service.                                                                                                                                                                              |

**Verification:** Record decision in [`DECISION-LOG.md`](file:///d:/SaaS%20Project/trading-alerts-saas-public/docs/migration-orders/DECISION-LOG.md) under **F45**, noting impact on blueprint §5.4 and `ALLOWED_ORIGINS`.

---

### 2. Resolve F44 — What verification standard replaces the 48h read shadow-run?

Present options to Davin:

| Option                                                             | Mechanism                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **(a) Manual Parity Verification** — _(Recommended, matching F35)_ | Accept the manual parity test results in [`4a-6_test-results_ready_to_proceed_with_4a-7a.md`](file:///d:/SaaS%20Project/trading-alerts-saas-public/docs/migration-orders/4a-6_test-results_ready_to_proceed_with_4a-7a.md) (12/12 routes + 401/403 negative cases verified) as the verification standard. |
| (b) Dual-call diff logger                                          | Route handler calls monolith and money-service, logs diffs for 48h. Costs temporary diff code that must be removed at 4A-7b.                                                                                                                                                                              |
| (c) Progressive cutover substitute                                 | No shadow. Cut over one route group at a time behind flag with instant rollback.                                                                                                                                                                                                                          |

**Verification:** Record decision in [`DECISION-LOG.md`](file:///d:/SaaS%20Project/trading-alerts-saas-public/docs/migration-orders/DECISION-LOG.md) under **F44**. Amend playbook & `SESSION-PROMPT-SCRIPT.md` accordingly per `00-SKELETON-AND-RULES.md` §5.

---

### 3. Build the transport module (server-only)

Build `lib/money-service/client.ts` and `lib/money-service/routes.ts` (shaped per F45 decision):

- **Invariants (Low creativity dial for auth/transport semantics):**
  - Reuse [`lib/operation-service/client.ts`](file:///d:/SaaS%20Project/trading-alerts-saas-public/lib/operation-service/client.ts)'s error-mapping shape (`MoneyServiceError` with `status` and `body`).
  - **Server-only:** Never imported by `'use client'` files ([`LESSONS-LEARNED.md` L6](file:///d:/SaaS%20Project/trading-alerts-saas-public/docs/migration-orders/LESSONS-LEARNED.md)).
  - Reuse `SESSION_COOKIE_NAME` from [`lib/operation-service/cookies.ts`](file:///d:/SaaS%20Project/trading-alerts-saas-public/lib/operation-service/cookies.ts). Do not re-derive cookie names.
  - Set `cache: 'no-store'` on every fetch call.
  - **Do NOT touch `lib/api/index.ts`** (known-broken, reserved for Phase 7).

---

### 4. Add the feature flag, defaulting OFF

Add `MIGRATE_READ_APIS_MONEY` (or fine-grained flags `MIGRATE_READ_APIS_MONEY_AFFILIATE`, `MIGRATE_READ_APIS_MONEY_ADMIN`).

- Default **OFF** in all environments (including local/dev).
- When flag is OFF, all 12 routes resolve strictly to the monolith.

**Verification:** `npm run validate` and full test suite remain 100% green with flag OFF.

---

### 5. Prove one signed-in browser call end-to-end

In local/preview environment with flag turned ON for test execution:

1. Sign in as a valid user in browser.
2. Load lowest-risk route group (`/api/affiliate/dashboard/stats`).
3. Verify response is served by money-service (check correlation ID / Railway logs).
4. Verify negative cases: unauthenticated returns 401, wrong role returns 403.
5. Record evidence in order's Deviations section.

**⚠️ Schema-gap rule ([`DECISION-LOG.md` F46](file:///d:/SaaS%20Project/trading-alerts-saas-public/docs/migration-orders/DECISION-LOG.md), [`LESSONS-LEARNED.md` L18](file:///d:/SaaS%20Project/trading-alerts-saas-public/docs/migration-orders/LESSONS-LEARNED.md)):**
If the DB read fails on a Prisma model/column/relation error when money-service hits Postgres, that is a **SCHEMA finding**, not a transport bug. Stop, log exact error in Deviations, report to Davin, and handle via separate schema session. Do **NOT** patch transport code, alter Prisma queries, or run Prisma write commands from money-service (L1).

---

### 6. Close per `EXECUTOR-PROTOCOL.md` §3

1. Mark `4a-7-money-service-read-apis-cutover.migration-order.md` as **SUPERSEDED**.
2. Update `CLAUDE.md`, `DECISION-LOG.md`, `migration-cutover-table.md`, and `migration-stack-analysis.md`.
3. **PRE-DRAFT `4a-7b-money-service-read-apis-cutover.migration-order.md`**.

---

## Done when

- [ ] **F45 resolved** and logged in Decision Log with impact on §5.4 / CORS documented.
- [ ] **F44 resolved** and logged in Decision Log; playbook & `SESSION-PROMPT-SCRIPT.md` amended.
- [ ] Transport module built, server-only, reusing cookie constants and error shapes.
- [ ] Feature flag `MIGRATE_READ_APIS_MONEY` implemented, defaulting **OFF**.
- [ ] Signed-in end-to-end call + 401/403 negative cases verified in preview/local.
- [ ] `4a-7-…` marked SUPERSEDED; `4a-7b-…` PRE-DRAFTed.
- [ ] **Zero production traffic cut over in this session.**

---

## Rollback

Revert the commit and redeploy. Since the feature flag defaults OFF, production behavior remains 100% untouched throughout this session.

---

## Rules specific to this variant

- Dial is **High** on transport module layout/structure, **Low** on auth semantics.
- Do not widen `ALLOWED_ORIGINS` on money-service to "fix CORS" — CORS is bypassed if F45 uses server proxying.
- Ported/existing tests may be extended, never weakened ([`LESSONS-LEARNED.md` L3](file:///d:/SaaS%20Project/trading-alerts-saas-public/docs/migration-orders/LESSONS-LEARNED.md)).

---

## Deviations

_(Filled DURING execution — what/why/impact)_

**Expected entries:** F45 decision & blast radius · F44 decision & playbook amendment · end-to-end browser call evidence · outcome of #36/#38 monitoring checks.

---

**CONFIRM-time findings (2026-07-25), before any step-3 code was written:**

- **F45 resolved** — Option (a), server-side proxy. Full decision + blast radius on `ALLOWED_ORIGINS`/§5.4 recorded in `DECISION-LOG.md` F45.
- **F44 resolved** — Option (a), manual parity verification, matching the F35 precedent. Full decision recorded in `DECISION-LOG.md` F44. Playbook + `SESSION-PROMPT-SCRIPT.md` amendment carried to step 6 close.
- **Waiting-on #36 — CLOSED clean.** Re-verified against Railway deployment `b401bc62` (live 2026-07-22 10:12 UTC → 2026-07-24 05:34 UTC, spanning the natural 2026-07-23 UTC 00:00–04:00 cron window). All five hourly `[CRON]` ticks fired and completed with `errorCount: 0`, zero duplicate `PaymentBatch`/`DisbursementTransaction` rows. This is the scheduler's own natural tick, not a manual-trigger bypass. Marked RESOLVED in CLAUDE.md.
- **Waiting-on #38 — audited, NOT closed, deliberately kept OPEN.** Walked every Railway deployment from the signature-fix commit (`8e681297`, live 2026-07-24 11:58 UTC) through the current deployment, using both HTTP edge logs and app stdout logs (the webhook controller logs `"dLocal webhook received"` on every hit). Findings: (1) two `shadow-run-cash`-labeled synthetic payloads hit the endpoint at 12:02/12:23 UTC on deployment `ea69c732` — both resolved `Payment record not found for webhook` (early-return, zero DB writes) and both predate the replay-guard fix (`1cc31b24`, live 13:48 UTC) by ~1h20m; (2) every deployment since 13:48 UTC (`cd5f12b4`, `94fdc812`, `a36a1306`, `d4bf22cf`) shows **zero** webhook activity of any kind — no real delivery, no further synthetic test. Raised the discrepancy against CLAUDE.md's/`migration-cutover-table.md`'s existing "confirmed yes — correct Payment/Subscription DB writes, second replay idempotent" language live with Davin. **Davin's live clarification (2026-07-25): the completion/replay-guard execution path against a live database record has not yet been exercised by a real HTTP request in production — only unit/integration tested during development.** Per Davin's explicit call: **non-blocking for Session 4A-7a** (this is a BUILD-only order, zero traffic cut over regardless), the live/synthetic completion-and-replay verification is carried forward rather than closed. CLAUDE.md's Waiting-on #38 stays OPEN with this corrected context; the cutover table's Slice 2 "confirmed live" language should be read alongside this correction, not relied on as-is.
- **Pre-existing Windows CRLF line-ending diff on `validate:format` noted; type-check and eslint verified 100% clean baseline.** `npm run validate`'s `validate:format` step (`prettier --check .`) fails on 287 files — confirmed traced to `core.autocrlf=true` on this Windows checkout (files carry CRLF terminators prettier's default LF expectation rejects), not a content/style regression, and not something touched by this session. Per Davin's live instruction, `tsc --noEmit` + `eslint app components lib hooks --max-warnings 0` (both 100% clean, re-verified after steps 3/4's edits) is the code baseline for proceeding — `prettier --write` across 287 files was explicitly declined as an out-of-scope drive-by fix.
- **Steps 3-4 complete.** Built `lib/money-service/client.ts` (mirrors `lib/operation-service/client.ts`'s `MoneyServiceError`/error-mapping shape exactly), `lib/money-service/routes.ts` (server-only cookie read via the existing `SESSION_COOKIE_NAME` + typed wrappers for all 12 Slice-3 routes), and `lib/money-service/flags.ts` (`MIGRATE_READ_APIS_MONEY_AFFILIATE` / `MIGRATE_READ_APIS_MONEY_ADMIN`, both default OFF — split per-group rather than one flag, so 4A-7b's own per-group flip order, and 4A-7b's "no code work" constraint, both hold). Wired the flag check into all 12 existing Next.js API route handlers: the monolith's own `requireAffiliate()`/`requireAdmin()` check always runs first unchanged (auth semantics untouched, Low dial honored), and only on a pass does the flag gate a branch to money-service — falling through to the existing Prisma logic when OFF or when the session cookie is unexpectedly absent. `MONEY_SERVICE_URL` + both flags added to `.env.example` following the `OPERATION_SERVICE_URL` pattern. `tsc --noEmit` and `eslint app components lib hooks --max-warnings 0` both clean with flags OFF (default) — confirms production behavior is unchanged by this session's edits.
- **Step 5 complete — end-to-end proof via script-minted session token (Davin's explicit direction, 2026-07-25).** Built a temporary scratch script (`scratch/mint-test-session.js`, deleted after use) that mints a real NextAuth v4 session token via `next-auth/jwt`'s own `encode()` (same function NextAuth itself uses, same `NEXTAUTH_SECRET`) for the project's canonical test fixtures (`affiliate-test@trading-alerts.test` / `free-test@trading-alerts.test`, seeded via the existing `/api/test/seed` dev-only endpoint — matching `e2e/utils/test-data.ts`, no real customer data touched). Ran a local Next.js dev server with `MIGRATE_READ_APIS_MONEY_AFFILIATE=true` and `MONEY_SERVICE_URL` pointed at the live production money-service instance.
  - **200/positive-path proxy proof:** the affiliate token's request to `/api/affiliate/dashboard/stats` was confirmed in money-service's Railway HTTP logs (`clientUa: "node"`, `GET /v1/affiliate/dashboard/stats`, `404`) — i.e. the request genuinely reached money-service, not the monolith fallback. The `404 "Affiliate profile not found"` is a _correct_ response, not a transport failure: local dev's `DATABASE_URL` (`turntable.proxy.rlwy.net:55082`, likely the F34 staging Postgres project) turned out to be a **different database** than money-service's production `DATABASE_URL` (`postgres.railway.internal` / public proxy `maglev.proxy.rlwy.net:58290`) — confirmed by directly querying each DB. The seeded test user/profile genuinely exists in the DB local dev writes to and genuinely does not exist in the DB money-service reads, so money-service's own Prisma lookup correctly reported not-found. Davin's explicit call (2026-07-25): this is **sufficient, clean proof for step 5** — do NOT write test data into the production database to force a 200. The chain this proves end-to-end: the forwarded request reached money-service on Railway; `JwtAuthGuard` correctly decoded the forwarded Bearer JWE; `AffiliateGuard` correctly authorized it (isAffiliate claim honored); money-service's own Prisma lookup executed for real (proving the full transport + auth-bridge path works, independent of this particular test fixture's DB placement).
  - **403 negative case:** the non-affiliate (`free-test`) token against the same route returned `403 {"error":"Forbidden","message":"Affiliate access required","code":"AFFILIATE_REQUIRED"}` — `AffiliateGuard` correctly rejecting a valid-but-wrong-role token, exactly as designed.
  - **401 negative case — pre-existing bug, not a regression:** the no-cookie request returned `500 "Failed to fetch stats"` instead of `401`. Traced to `LESSONS-LEARNED.md` **L12** (Session 4A-6 finding): `stats/route.ts`'s catch block checks `error.message.includes('UNAUTHORIZED')`, but `requireAffiliate()`'s thrown `AuthError` only ever sets the marker on `.code`, never `.message` — so the 401 branch is unreachable and every real auth failure falls through to a generic 500. This is a documented, pre-existing, zero-coverage monolith bug untouched by this session's edits (my added branch sits entirely inside the same `try` block, after `requireAffiliate()`, and never runs when that call throws) — out of scope to fix here per this order's own change-frozen/scope-discipline rules; flagged for a future session, not fixed as a drive-by.
  - Local dev server stopped and `scratch/mint-test-session.js` deleted after the run; no test data was written to production Postgres.
- **Session-close test run.** `npx jest __tests__/api/{admin-affiliates,admin-reports,admin,affiliate-dashboard}.test.ts` (the existing suites covering all 12 modified routes): **4/4 suites passed, 29/29 tests passed** — flag-off behavior unchanged, no regressions from the added branches. `tsc --noEmit` and `eslint --max-warnings 0` both clean (re-confirmed).
- **`npm run build` (L6 check — the only tool that actually catches a server-only import leaking into a client bundle).** Clean: `✓ Compiled successfully in 98s`, TypeScript finished in 30.7s, all **127/127 routes** generated (unchanged from the 5-4 exit-suite baseline), zero bundling errors. Confirms `lib/money-service/*` stayed server-only — no `'use client'` file pulled it in.
- **Two new lessons recorded** (`LESSONS-LEARNED.md` L19/L20 — both cost real diagnostic time this session): L19 — local dev's `DATABASE_URL` and money-service's production `DATABASE_URL` are different hosts, so a local-DB seed isn't visible to a Railway service reading production; compare masked hosts before trusting local-seeded test data against another service. L20 — `npm run validate`'s `validate:format`/`validate:policies` steps aren't part of this repo's actual green bar on Windows (pre-existing `core.autocrlf` CRLF issue, not a regression); treat `tsc`+`eslint`+`build`+relevant tests as the real gate until a dedicated session fixes it.

---

## Known wrinkles / do-not-touch

- `lib/api/index.ts` — known-broken by design (Phase 7).
- `lib/operation-service/*` — read-only reference for pattern; do not refactor live auth code.
- `middleware.ts` / Edge runtime — keep shared cookie imports Edge-safe.
- money-service source code is **unchanged** in this session.

---

## Next-session handoff

PRE-DRAFT `4a-7b-money-service-read-apis-cutover.migration-order.md` (variant VERIFY-RETIRE, ~10 lines). It will contain the concrete flag-flip steps (affiliate dashboard first, admin reports last), rollback procedure (flip flag back OFF), and F44 verification evidence check before flipping. No code work belongs in 4A-7b.
