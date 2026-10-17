# Next.js Security, Stability & Performance Remediation Master Plan (Draft 1)

> **Reference Standards:**
>
> - [`davintrade-next-js-checklists/NEXTJS_SECURITY_CHECKLIST.md`](./NEXTJS_SECURITY_CHECKLIST.md) (Sections 1–9, 38 Controls)
> - [`.agents/skills/vercel-react-best-practices/SKILL.md`](../.agents/skills/vercel-react-best-practices/SKILL.md) (Vercel React & Next.js Performance Guidelines)
>
> **Target Codebase:** Next.js 16.4.1 / React 19.3.0 App Router Monolith (`app/`, `components/`, `lib/`, `hooks/`, `middleware.ts`, `next.config.js`, `.github/workflows/`)  
> **Cutover & Architecture Context:** Verified against [`docs/migration-orders/migration-cutover-table.md`](../docs/migration-orders/migration-cutover-table.md), [`.claude/state/current-state.md`](../.claude/state/current-state.md), and [`docs/STACK-D-ARCHITECTURE.md`](../docs/STACK-D-ARCHITECTURE.md)  
> **Author:** Antigravity (Advisor)  
> **Status:** **DRAFT 1 — FOR CLAUDE CODE (EXECUTOR) REVIEW & DAVIN SIGN-OFF**  
> **Date:** 2026-10-17

---

## 1. Executive Summary & Architectural Context

This document establishes the evidence-verified remediation master plan for the Next.js App Router codebase across **Security** (all 38 controls in `NEXTJS_SECURITY_CHECKLIST.md`), **Stability / Resilience**, and **Performance / Bundle Optimization**.

### 1.1 Microservice Cutover & Monolith Scope Awareness

Per [`docs/migration-orders/migration-cutover-table.md`](../docs/migration-orders/migration-cutover-table.md) and [`.claude/rules/non-negotiables.md`](../.claude/rules/non-negotiables.md):

1. **Dual-Path Cutover Routes (`operation-service` & `money-service`):**
   - Slices 1–5 (`money-service`) and Slices 7–12 (`operation-service`, plus Auth Bridge) are cut over in production via feature flags ([`lib/money-service/flags.ts`](../lib/money-service/flags.ts), [`lib/operation-service/flags.ts`](../lib/operation-service/flags.ts)).
   - However, the Next.js route handlers (`app/api/**`) retain **active local Prisma fallback paths** that execute whenever a proxy call throws or when **Admin View-As** (`?view_as=user` in [`lib/admin/user-view-as.ts:26-28`](../lib/admin/user-view-as.ts) or Affiliate View-As in [`lib/affiliate/view-as.ts:15-18`](../lib/affiliate/view-as.ts)) is active.
   - Any changes to money/webhook mirrors (`app/api/webhooks/stripe/route.ts`, `lib/stripe/webhook-handlers.ts`, `lib/disbursement/**`) must maintain lockstep parity with `money-service` and require Davin's explicit sign-off (`⚠ NEEDS EXPLICIT SIGN-OFF`).
2. **Active Monolith-Only Domains (Primary Execution Scope):**
   - **Stack D (Steps 5, 6, 7):** `lib/engine4/**`, `lib/intake/**`, `lib/reply/**`, `lib/platform/**`, `app/api/engine4/{offer,size,consent,profile}/route.ts`, `app/api/intake/{route,instant/route}.ts`, `app/api/chat/{message,state,threads,threads/[id]}/route.ts`, `app/terminal/**`, `app/free/**`. _(Note: Stack D directories have strict architectural import-guard tests that must be respected during any refactor.)_
   - **Monolith APIs, Server Actions & Server Components:** `app/api/subscription/**`, `app/api/invoices/**`, `app/api/affiliate/profile/route.ts`, `app/api/affiliate/dashboard/resources/**`, `app/api/admin/**`, `app/api/disbursement/**`, `app/api/market/**`, `app/api/world-gold/route.ts`, `app/actions/{appearance,locale}.ts`, and all 114 `app/**/page.tsx` and 18 `app/**/layout.tsx` files.

### 1.2 Summary of Audit Findings

| Pillar                                        | Audit Result                                                        | Top-Priority Findings                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| :-------------------------------------------- | :------------------------------------------------------------------ | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Security (`NEXTJS_SECURITY_CHECKLIST.md`)** | **10 Pass · 8 Partial · 20 Fail** (38 controls)                     | **P0-1:** `POST /api/test/seed` (`app/api/test/seed/route.ts:68-80`) falls back to `'test-secret'` when `TEST_SECRET` is unset and overrides `NODE_ENV === 'production'`, allowing unauthenticated creation of an `ADMIN` user (`admin-test@trading-alerts.test` / `AdminPassword123!`) in the live DB.<br>**P0-2:** `lib/fraud/fraud-detection.service.ts:1` declares `'use server';` at the top of a service file, exposing 7 internal fraud DB functions (`blockUserFromFraudAlert`, `updateFraudAlertStatus`, `getFraudAlerts`, etc.) as unauthenticated public HTTP POST Server Action endpoints.<br>**P0-3:** `lib/auth/auth-options.ts:656` allows `targetHost.endsWith('.vercel.app')` in NextAuth's `redirect` callback (open redirect to any third-party `.vercel.app` domain).<br>**P0-4:** `lib/csrf.ts:26` uses `origin.startsWith(allowed)` (subdomain/suffix spoofing bypass) and returns `true` when `!origin`, while 45+ cookie-authenticated mutation routes omit `validateOrigin()`.                                                                                                                                                                                                                                                                |
| **Stability & Resilience**                    | **4 Critical / High Gaps**                                          | **STB-01:** Outbound `fetch` clients for `operation-service` (`lib/operation-service/client.ts:61-68`), `money-service` (`lib/money-service/client.ts:49-56`), `dLocal` (`lib/dlocal/dlocal-payment.service.ts:109,204`), and `Cloudflare R2` (`lib/storage/r2.ts:51-60`) have **no `AbortSignal.timeout()`**—a hung downstream service blocks monolith requests indefinitely and **prevents the local Prisma fallback from ever executing**.<br>**STB-02:** `lib/reply/gateway/openrouter.ts:69-73` allows two `25s` primary attempts (`50s` total with zero backoff jitter) inside `lib/reply/orchestrator.ts:102`'s `55s` total deadline, starving the `20s` fallback model.<br>**STB-03:** `new PrismaPg(...)` is instantiated unconditionally outside the `globalForPrisma` guard in `lib/db/prisma.ts:31-34` and `lib/db/market-prisma.ts:23-26` with no pool limits (`max`, `connectionTimeoutMillis`); `lib/redis/client.ts:11` is module-scoped without `globalThis` or `commandTimeout`.<br>**STB-04:** `use-currency-index-chart.ts:87-90` wipes chart data to `EMPTY_DATA` on aborted requests; client polling hooks lack `document.visibilityState` pause guards; `use-realtime-socket.ts:86-98` passes a static token that never refreshes on reconnect. |
| **Performance & Bundle Size**                 | **0 `React.cache()` · 1 `next/dynamic` · 64% `'use client'` pages** | **PRF-01:** `React.cache()` is used **0 times** across the repo, causing `getServerSession`, `prisma.userAppearance.findUnique`, `prisma.user.findUnique`, and `cookies()`/`headers()` to execute 2x–4x per page render.<br>**PRF-02:** Sequential `await` waterfalls in Engine 4 (`readOfferSnapshot`, `loadWorld`), Intake (`pipeline.ts`, `readSnapshot`), Reply (`orchestrator.ts`), and 5 Admin BI pages; blocking tutorial view-count increment (`app/(marketing)/academy/[id]/page.tsx:78`) instead of `after()`.<br>**PRF-03:** 73/114 (`64%`) `page.tsx` files have top-level `'use client'` (including 14 static marketing pages that only need `getServerLanguage()`); `lightweight-charts` and `recharts` modals/charts and 3 full locale JSON files (`lib/context/locale-context.tsx:45-47`) are bundled synchronously.                                                                                                                                                                                                                                                                                                                                                                                                                                   |

---

## 2. Master Cross-Reference Matrices

### 2.1 Security Checklist Matrix (`NEXTJS_SECURITY_CHECKLIST.md` — 38 Controls)

|     ID     | Control Item                                                           |   Risk   |   Status   | Live Codebase Evidence                                                                                                                                                                                                                                                                                                     | Assigned Phase & Unit                         |
| :--------: | :--------------------------------------------------------------------- | :------: | :--------: | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------- |
| **DAL-01** | Adopt a Unified Data Fetching Pattern                                  |   High   |  ❌ Fail   | 4 patterns coexist; Server Components (`app/dashboard/page.tsx:78-87`, `app/alerts/page.tsx:125-128`) query `prisma.alert` directly instead of `operation-service` or a shared DAL.                                                                                                                                        | **Tier 2** (§5.3)                             |
| **DAL-02** | Enforce Data Access Layer (DAL) Isolation                              | Critical |  ❌ Fail   | `@/lib/db/prisma` imported directly in 12 Server Components/Layouts, 1 Server Action (`app/actions/appearance.ts:6`), and 79 Route Handlers (`190` `prisma.*` calls in `app/`).                                                                                                                                            | **Tier 2** (§5.3)                             |
| **DAL-03** | Enforce DTO Minimization                                               | Critical |  ❌ Fail   | `108/190` `prisma.*` calls in `app/` omit `select`. `getAffiliateProfile()` (`lib/auth/session.ts:202-261`) and `app/api/affiliate/profile/route.ts:82,181` return full `AffiliateProfile` rows (including raw `paymentDetails` JSON). Raw `FraudAlert`, `Drawing`, and `DrawingAlert` rows returned in API routes.        | **Tier 2** (§5.3)                             |
| **DAL-04** | Use Class Instances for Sensitive Internal Records                     |  Medium  |  ❌ Fail   | Zero class-based DTOs or non-serializable wrappers exist in `lib/`; all helpers return plain serializable POJOs.                                                                                                                                                                                                           | **Tier 2** (§5.3 — via `select` + Taint APIs) |
| **DAL-05** | Restrict Prototype/Component-Level Queries                             |   High   |  ❌ Fail   | Full `User` rows (with `password` hash, `twoFactorSecret`, `twoFactorBackupCodes`) loaded into memory without `select` in `app/api/subscription/route.ts:119-131`, `app/api/subscription/cancel/route.ts:79-96`, `app/api/payments/dlocal/create/route.ts:122-132`.                                                        | **Tier 2** (§5.3)                             |
| **BND-01** | Guard Modules with `server-only`                                       | Critical |  ❌ Fail   | `server-only` is not in `package.json`; **0 files** use `import 'server-only'`. `lib/fraud/fraud-detection.service.ts:1` uses `'use server'` instead.                                                                                                                                                                      | **P0** (§3.2) · **Tier 1** (§4.2)             |
| **BND-02** | Strict `NEXT_PUBLIC_` Environment Auditing                             | Critical |  ✅ Pass   | Only 4 `NEXT_PUBLIC_*` vars exist (`NEXT_PUBLIC_AUTH_BRIDGE_ENABLED`, `NEXT_PUBLIC_SOCKET_CHAT_URL`, `NEXT_PUBLIC_MT5_WS_URL`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`); none are secrets.                                                                                                                                    | **Compliant**                                 |
| **BND-03** | Enforce Environment Access Boundary                                    |   High   |  ❌ Fail   | Client files read `process.env` directly in `components/auth/login-form.tsx:269-271`, `lib/socket-client.ts:43`, `hooks/use-ohlcv-socket.ts:76`, `lib/auth/auth-bridge-flag.ts:22`.                                                                                                                                        | **Tier 2** (§5.3)                             |
| **BND-04** | Enable React Taint Protection                                          |  Medium  |  ❌ Fail   | `experimental.taint` is not set in `next.config.js`; zero uses of `experimental_taintObjectReference` / `experimental_taintUniqueValue`.                                                                                                                                                                                   | **Tier 2** (§5.3)                             |
| **BND-05** | Sanitize Docker & Build Artifacts                                      |   High   | ⚠️ Partial | `.dockerignore:25-45` excludes `.env*` and `.git`, but `docker-compose.dev.yml:52` mounts `.:/app` and `docker-compose.yml:80-82` references a missing root `Dockerfile`.                                                                                                                                                  | **Tier 3** (§6.5)                             |
| **AUT-01** | Never Rely on Middleware as Sole Security Boundary                     | Critical |  ❌ Fail   | `middleware.ts:141-147` fails open on error; `/terminal` and `/free` are missing from `PROTECTED_PREFIXES` (`L42-57`); **8 `app/admin/**`RSC pages** query Prisma/analytics with no page-level or DAL-level`requireAdmin()` check.                                                                                         | **Tier 1** (§4.5)                             |
| **AUT-02** | Re-authorize Inside Every Server Action & Route                        | Critical |  ❌ Fail   | (1) `lib/fraud/fraud-detection.service.ts:1` exposes 7 unauthenticated Server Actions; (2) `POST /api/test/seed` (`app/api/test/seed/route.ts:68-80`) falls back to `'test-secret'`; (3) `GET /api/disbursement/health` (`app/api/disbursement/health/route.ts:39-151`) has no auth check.                                 | **P0** (§3.1, §3.2) · **Tier 1** (§4.5)       |
| **AUT-03** | Enforce Resource Ownership Checks (Prevent IDOR)                       | Critical |  ✅ Pass   | User-facing dynamic `[id]` routes (`/api/alerts/[id]`, `/api/drawings/[id]`, `/api/notifications/[id]`, `/api/invoices/[id]/receipt`, `/api/chat/threads/[id]`) strictly scope queries by `session.user.id`. (`app/admin/users/[id]/page.tsx` tracked in `AUT-01`).                                                        | **Compliant** (Admin RSC in §4.5)             |
| **AUT-04** | Treat Route Params & SearchParams as Hostile Input                     | Critical | ⚠️ Partial | Admin BI pages pass `searchParams` into analytics queries without page-level auth. View-as cookies (`lib/admin/user-view-as.ts:92-110`, `lib/affiliate/view-as.ts:77-95`) use unsigned strings (mitigated by server-side `session.user.role === 'ADMIN'` checks).                                                          | **Tier 1** (§4.5)                             |
| **AUT-05** | Cache User Session Queries via `React.cache`                           |  Medium  |  ❌ Fail   | Zero uses of `React.cache()` in `lib/auth/session.ts` or anywhere in the repo.                                                                                                                                                                                                                                             | **Tier 2** (§5.1)                             |
| **ACT-01** | Validate All Input Arguments with Schemas                              | Critical |  ❌ Fail   | `app/actions/appearance.ts` and `app/actions/locale.ts` validate inputs, but `lib/fraud/fraud-detection.service.ts:1` (`'use server'`) has zero runtime validation across 7 exported functions, and `app/dev/report2/actions.ts:26-42` lacks schema validation at the action boundary.                                     | **P0** (§3.2)                                 |
| **ACT-02** | Filter Server Action Return Values                                     |   High   | ⚠️ Partial | `appearance.ts` and `locale.ts` return `{ success: boolean }`, while `fraud-detection.service.ts:344-374,425-434` returns raw `FraudAlert` rows.                                                                                                                                                                           | **P0** (§3.2)                                 |
| **ACT-03** | Pin Multi-Server Encryption Key (`NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`) |   High   |  ❌ Fail   | Not documented in `.env.example` or configured for multi-instance standalone deployments.                                                                                                                                                                                                                                  | **Tier 3** (§6.5)                             |
| **ACT-04** | Audit `.bind()` Arguments                                              |   High   |  ✅ Pass   | Zero Server Actions use `.bind()`.                                                                                                                                                                                                                                                                                         | **Compliant**                                 |
| **ACT-05** | Configure Allowed Origins for Reverse Proxies                          |   High   | ⚠️ Partial | `next.config.js:57-59` configures `serverActions.bodySizeLimit: '2mb'` without explicit `allowedOrigins`.                                                                                                                                                                                                                  | **Tier 2** (§5.5)                             |
| **ACT-06** | Zero Side-Effects in Server Component Rendering                        | Critical |  ✅ Pass   | All Prisma queries in Server Components are read-only; cookie writes occur only in Server Actions and `middleware.ts`.                                                                                                                                                                                                     | **Compliant**                                 |
| **ACT-07** | Implement Action Rate Limiting & Abuse Protection                      |   High   |  ❌ Fail   | `saveAppearanceAction` (`app/actions/appearance.ts:20-64`, upserts `prisma.userAppearance`) and `syncLocaleCookiesAction` (`app/actions/locale.ts:40-76`) have no rate limiting.                                                                                                                                           | **Tier 1** (§4.4)                             |
| **RTE-01** | Explicit Method Handlers Only                                          |   High   |  ✅ Pass   | All 108 `app/api/**/route.ts` files export explicit HTTP verb handlers (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`).                                                                                                                                                                                                          | **Compliant**                                 |
| **RTE-02** | Manual CSRF & Origin Verification on Custom Endpoints                  |   High   |  ❌ Fail   | (1) `lib/csrf.ts:22-26` uses `origin.startsWith(allowed)` and returns `true` when `!origin`; (2) 45+ cookie-authenticated mutation routes (`engine4/*`, `chat/*`, `intake/*`, `user/2fa/*`, `user/password`, `checkout`, `subscription/*`, `alerts/*`, `admin/*`) omit `validateOrigin()`.                                 | **P0** (§3.4) · **Tier 1** (§4.6)             |
| **RTE-03** | Use Matcher Allowlists in Middleware / Proxy                           |   High   | ⚠️ Partial | `middleware.ts:42-61` uses `PROTECTED_PREFIXES` that omits `/terminal`, `/free`, and exact `/pro`.                                                                                                                                                                                                                         | **Tier 1** (§4.5)                             |
| **RTE-04** | In-App Request Screening & Rate Limiting                               |  Medium  |  ❌ Fail   | `checkAuthRateLimit` (`lib/rate-limit.ts:137`) and `checkTierRateLimit` (`lib/rate-limit.ts:151`) have **0 callers**; only 1 route (`app/api/payments/dlocal/validate-discount/route.ts:51`) calls `checkRateLimit()`. 2FA verification (`/api/user/2fa/verify`) and password change routes lack rate limiting in Next.js. | **Tier 1** (§4.4)                             |
| **INP-01** | Parameterize All SQL / NoSQL Queries                                   | Critical | ⚠️ Partial | Active Prisma raw queries are parameterized/safe, but unused helper `lib/candle-data-helpers.ts:181-196` interpolates `FROM ${symbol}_${timeframe}` directly into SQL.                                                                                                                                                     | **Tier 3** (§6.5)                             |
| **INP-02** | Restrict & Sanitize `dangerouslySetInnerHTML`                          | Critical |  ✅ Pass   | Only 2 occurrences in `app/layout.tsx:137-191`, both using static CSS and allowlist-validated values escaped with `.replace(/</g, '\\u003c')`.                                                                                                                                                                             | **Compliant**                                 |
| **INP-03** | Validate URL Redirect Targets (Open Redirect)                          |   High   |  ❌ Fail   | `lib/auth/auth-options.ts:643-666` trusts `targetHost.endsWith('.vercel.app')` (any third-party Vercel subdomain) and `url.startsWith('/')` without blocking `//` or `/\`.                                                                                                                                                 | **P0** (§3.3)                                 |
| **INP-04** | Sanitize Dynamic SVG & File Uploads                                    |   High   |  ❌ Fail   | `lib/marketing-resources/validators.ts:36-42` allows `'image/svg+xml'` without SVG sanitization; `lib/marketing-resources/storage.ts:27-34` uploads to Vercel Blob with `access: 'public'` and no `contentDisposition: 'attachment'`. `next.config.js:26-36` uses broad `*.vercel.app` and `*.railway.app` image patterns. | **Tier 2** (§5.5)                             |
| **HDR-01** | Content-Security-Policy (CSP)                                          | Critical | ⚠️ Partial | `next.config.js:130-144` includes `'unsafe-inline' 'unsafe-eval'` in `script-src` (`L133`) and hardcodes `http://localhost:3001 ws://localhost:3001` in production `connect-src` (`L137`).                                                                                                                                 | **Tier 2** (§5.5)                             |
| **HDR-02** | Strict-Transport-Security (HSTS)                                       |   High   |  ✅ Pass   | `next.config.js:111-114` sets `max-age=31536000; includeSubDomains; preload` (can be bumped to `63072000` / 2 years in §5.5).                                                                                                                                                                                              | **Compliant** (§5.5)                          |
| **HDR-03** | X-Content-Type-Options                                                 |  Medium  |  ✅ Pass   | `next.config.js:103-105` sets `nosniff`.                                                                                                                                                                                                                                                                                   | **Compliant**                                 |
| **HDR-04** | Referrer-Policy                                                        |  Medium  |  ✅ Pass   | `next.config.js:107-109` sets `strict-origin-when-cross-origin`.                                                                                                                                                                                                                                                           | **Compliant**                                 |
| **HDR-05** | Permissions-Policy                                                     |  Medium  |  ✅ Pass   | `next.config.js:116-120` sets `camera=(), microphone=(), geolocation=(), interest-cohort=()`.                                                                                                                                                                                                                              | **Compliant**                                 |
| **HDR-06** | Clickjacking Mitigation                                                |   High   |  ✅ Pass   | `next.config.js:99-101` sets `X-Frame-Options: SAMEORIGIN` and CSP `frame-ancestors 'self'` (`L139`).                                                                                                                                                                                                                      | **Compliant**                                 |
| **HDR-07** | Omit Deprecated Headers                                                |   Low    |  ❌ Fail   | `next.config.js:122-125` sets deprecated `X-XSS-Protection: 1; mode=block`.                                                                                                                                                                                                                                                | **Tier 2** (§5.5)                             |
| **ERR-01** | Strict `NODE_ENV=production` in Deployments                            | Critical |  ✅ Pass   | Verified in `next.config.js:76-85` and CI build workflows.                                                                                                                                                                                                                                                                 | **Compliant**                                 |
| **ERR-02** | Sanitize Thrown Error Messages                                         |   High   |  ❌ Fail   | `app/error.tsx:43` renders raw `{error.message}` in the DOM; 6 API routes (`dlocal/create`, `disbursement/pay`, `disbursement/batches/[batchId]/execute`, `test/seed`, `webhooks/stripe`, `admin/active-indicator`) return raw `error.message` or `String(error)` in HTTP error responses.                                 | **Tier 2** (§5.4)                             |
| **ERR-03** | Correlate Client Digest with Server Logs                               |  Medium  | ⚠️ Partial | `app/global-error.tsx:24-48` displays `error.digest` in UI but does not log `error` or `error.digest`; `lib/errors/error-logger.ts:54-56` has an unimplemented `TODO` for external telemetry.                                                                                                                              | **Tier 2** (§5.4)                             |
| **OPS-01** | Lockfile Integrity & Audit Gate                                        | Critical |  ❌ Fail   | `.github/workflows/dependencies-security.yml:68-75` runs `pnpm install --no-frozen-lockfile` and `pnpm audit` with `continue-on-error: true` and `\|\| echo`, so critical CVEs never fail CI.                                                                                                                              | **Tier 3** (§6.5)                             |
| **OPS-02** | Automated Dependency Updates                                           |   High   |  ❌ Fail   | No `.github/dependabot.yml` or `renovate.json` exists.                                                                                                                                                                                                                                                                     | **Tier 3** (§6.5)                             |
| **OPS-03** | Automated Secret Scanning                                              | Critical | ⚠️ Partial | `.github/workflows/security-checks.yml:87-117` runs 3 basic `grep` patterns (`sk_live_`, `AKIA`, `ghp_`) on `*.ts`/`*.tsx`/`*.js` files only; no Gitleaks/TruffleHog history scan.                                                                                                                                         | **Tier 3** (§6.5)                             |
| **OPS-04** | Enforce Strict Static Analysis                                         |   High   | ⚠️ Partial | `tsconfig.json:34-77` has full strict mode, but `eslint.config.mjs:60-76` disables `@typescript-eslint/no-explicit-any` across `app/`, `components/`, `lib/`, and `hooks/`.                                                                                                                                                | **Tier 3** (§6.5)                             |
| **OPS-05** | Periodic Penetration Testing & DAST                                    |  Medium  |  ❌ Fail   | No automated DAST scan workflow in `.github/workflows/`.                                                                                                                                                                                                                                                                   | **Tier 3** (§6.5)                             |

---

### 2.2 Stability & Performance Cross-Reference Matrix

|     ID     | Category & Topic                                                        |   Severity   | Live Codebase Evidence                                                                                                                                                                                                                                                                                                                                                  | Assigned Phase & Unit   |
| :--------: | :---------------------------------------------------------------------- | :----------: | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------- |
| **STB-01** | Outbound HTTP/SDK Request Timeouts (`AbortSignal.timeout`)              | **Critical** | `lib/operation-service/client.ts:61-68,114-122,150-158`, `lib/money-service/client.ts:49-56`, `lib/dlocal/dlocal-payment.service.ts:109,204`, and `lib/storage/r2.ts:51-60,126,167` have no request timeouts, blocking monolith Prisma fallbacks (`lib/operation-service/write-routes.ts:47-86`) when downstream services hang.                                         | **Tier 1** (§4.1)       |
| **STB-02** | AI Reply Gateway Retry Cascade vs. 55s Deadline                         |   **High**   | `lib/reply/gateway/openrouter.ts:69-73,544-569` allows two `25s` primary attempts (`50s` total, zero backoff) inside `lib/reply/orchestrator.ts:102`'s `55s` deadline, leaving `<= 5s` for the `20s` fallback model (`orchestrator.ts:505`).                                                                                                                            | **Tier 1** (§4.1)       |
| **STB-03** | Prisma Pool & Redis Singleton Hygiene                                   |   **High**   | `lib/db/prisma.ts:31-34` and `lib/db/market-prisma.ts:23-26` instantiate `new PrismaPg` unconditionally outside `globalForPrisma` without `max` or `connectionTimeoutMillis`; `lib/redis/client.ts:11-27` is module-scoped without `globalThis` or `commandTimeout`.                                                                                                    | **Tier 1** (§4.3)       |
| **STB-04** | Client Polling, Abort Race, Socket.IO Token Expiry & Error Boundaries   |  **Medium**  | `use-currency-index-chart.ts:87-90` calls `setData(EMPTY_DATA)` on aborted fetches; polling hooks lack `document.visibilityState` pause checks; `use-realtime-socket.ts:86-98` passes a static auth token on reconnect; only 1 root `app/error.tsx` exists.                                                                                                             | **Tier 3** (§6.3, §6.4) |
| **PRF-01** | Per-Request `React.cache()` Deduplication                               |   **High**   | `React.cache()` is used `0` times across `app/` and `lib/`; root layout + child layouts + pages execute `getServerSession`, `prisma.userAppearance.findUnique`, `prisma.user.findUnique`, and `cookies()`/`headers()` 2x–4x per request.                                                                                                                                | **Tier 2** (§5.1)       |
| **PRF-02** | Eliminating Sequential `await` Waterfalls & Non-Blocking `after()`      |   **High**   | Sequential independent `await` chains in Engine 4 (`lib/engine4/read/cycle.ts:224-343`, `lib/engine4/server/context.ts:120-166,215-238`), Intake (`lib/intake/pipeline.ts:383-420`, `lib/intake/read/snapshot.ts:392-541`), Reply (`lib/reply/orchestrator.ts:360-410`), and 5 Admin BI pages; blocking view count write in `app/(marketing)/academy/[id]/page.tsx:78`. | **Tier 2** (§5.2)       |
| **PRF-03** | Client Component Boundary, `next/dynamic` & Locale Dictionary Splitting |   **High**   | 73/114 (`64%`) `page.tsx` files have `'use client'` (including 14 static marketing pages); only 1 `next/dynamic` call in repo while `lightweight-charts` and `recharts` modals/charts are bundled synchronously; `lib/context/locale-context.tsx:45-59` bundles 3 full locale JSON files into every client page.                                                        | **Tier 3** (§6.1, §6.2) |

---

## 3. Phase 0 (P0) — Immediate Production Security & Auth Hotfixes

> **Goal:** Eliminate immediate high-severity attack vectors in the Next.js monolith with minimal blast radius.  
> **Governance Gate:** Unit 0.3 touches [`lib/auth/auth-options.ts`](../lib/auth/auth-options.ts) and therefore requires Davin's explicit sign-off (`⚠ NEEDS EXPLICIT SIGN-OFF`, Non-Negotiable #5).

### Unit 0.1 — Lock Down `POST /api/test/seed` in Production (`AUT-02` — CRITICAL)

- **Target File:** [`app/api/test/seed/route.ts`](../app/api/test/seed/route.ts) (`L15, L66-80`)
- **Defect Verified in Live Code:**
  - `GET` (`L235`) and `DELETE` (`L256`) unconditionally block when `!ALLOWED_ENVIRONMENTS.includes(nodeEnv)`.
  - However, `POST` (`L68-72`) computes:
    ```typescript
    const testSecret = request.headers.get('x-test-secret');
    const expectedSecret = process.env['TEST_SECRET'] || 'test-secret';
    const hasValidSecret = testSecret && testSecret === expectedSecret;
    if (!ALLOWED_ENVIRONMENTS.includes(nodeEnv) && !hasValidSecret) {
    ```
  - If `TEST_SECRET` is unset in production (`NODE_ENV=production`), `expectedSecret` defaults to `'test-secret'`. An unauthenticated attacker sending `POST /api/test/seed` with `x-test-secret: test-secret` bypasses the environment guard and seeds `admin-test@trading-alerts.test` (`role: 'ADMIN'`, password `AdminPassword123!`, `isActive: true`, `L34-39, 95-116`) into the production database.
  - Because the 2026-10-16 P0 auth hotfix (`bd67b30c`) removed `admin-test@trading-alerts.test` from `FIXED_TEST_ACCOUNTS` so that it authenticates against the real database `User` record, seeding this row into production grants live `ADMIN` access with a known password and no 2FA.
- **Remediation:**
  1. Unconditionally refuse `POST`, `GET`, and `DELETE` whenever `process.env.NODE_ENV === 'production' || process.env['VERCEL_ENV'] === 'production'` or `!ALLOWED_ENVIRONMENTS.includes(nodeEnv)`.
  2. Remove the `'test-secret'` literal fallback completely; if `TEST_SECRET` is configured as an additional defense-in-depth header check inside `development`/`test`, compare it using `crypto.timingSafeEqual` only after `ALLOWED_ENVIRONMENTS.includes(nodeEnv)` passes.
  3. Sanitize the catch blocks at `L225` and `L284` so they do not return `details: String(error)` (`ERR-02`).

### Unit 0.2 — Remove Misplaced `'use server'` from `lib/fraud/fraud-detection.service.ts` (`BND-01`, `AUT-02`, `ACT-01`, `ACT-02` — CRITICAL)

- **Target File:** [`lib/fraud/fraud-detection.service.ts`](../lib/fraud/fraud-detection.service.ts) (`L1`)
- **Defect Verified in Live Code:**
  - Line 1 contains `'use server';`. In Next.js App Router, `'use server'` at module scope exposes all 7 exported async functions (`runFraudChecks:216`, `createFraudAlerts:253`, `detectAndAlertFraud:283`, `getFraudAlerts:322`, `getFraudAlertStats:380`, `updateFraudAlertStatus:418`, `blockUserFromFraudAlert:440`) as publicly callable HTTP POST Server Action endpoints.
  - None of those 7 functions checks `getSession()` or `requireAdmin()`, and none validates its arguments with Zod. All callers (`app/api/admin/fraud-alerts/route.ts`, `app/api/admin/fraud-alerts/[id]/route.ts`, `app/api/admin/fraud-alerts/[id]/block-user/route.ts`, `app/api/payments/dlocal/create/route.ts`) are server-side Route Handlers, never Client Components.
- **Remediation:**
  1. Remove `'use server';` from line 1 of `lib/fraud/fraud-detection.service.ts` (and replace with `import 'server-only';` once `server-only` is added in Unit 1.2).
  2. In [`app/dev/report2/actions.ts:1`](../app/dev/report2/actions.ts), keep `refuseInProduction()` at the top of `devOffer`, `devSize`, and `devConsent` before any argument handling so the dev harness fails closed immediately in production.

### Unit 0.3 — `⚠` Fix Wildcard `.vercel.app` Open Redirect in NextAuth `redirect` Callback (`INP-03` — HIGH)

- **Governance Gate:** `⚠ NEEDS EXPLICIT SIGN-OFF` (modifies [`lib/auth/auth-options.ts`](../lib/auth/auth-options.ts)).
- **Target File:** [`lib/auth/auth-options.ts`](../lib/auth/auth-options.ts) (`L643-666`)
- **Defect Verified in Live Code:**
  - Line 656 checks `targetHost.endsWith('.vercel.app')`, which allows NextAuth login/logout flows (`callbackUrl=...`) to redirect users to **any third-party `.vercel.app` domain** (`https://evil-phishing.vercel.app`).
  - Line 645 checks `if (url.startsWith('/')) return `${baseUrl}${url}`;` without rejecting protocol-relative paths (`//evil.com`) or backslash paths (`/\evil.com`), unlike [`safeCallbackUrl()`](../lib/auth/safe-callback-url.ts) (`L27-66`).
- **Remediation:**
  1. For relative URLs (`url.startsWith('/')`), validate via `safeCallbackUrl(url, '')` (or reject `url.startsWith('//')` and `url.includes('\\')`) before prepending `baseUrl`.
  2. Replace the blanket `targetHost.endsWith('.vercel.app')` check with an exact match against `process.env['VERCEL_URL']` (when `process.env['VERCEL_ENV'] === 'preview'`) or an explicit project preview hostname pattern (e.g., `^trading-alerts-saas[a-z0-9-]*\.vercel\.app$`).

### Unit 0.4 — Fix `lib/csrf.ts` Prefix Bypass & Missing `Origin` Handling (`RTE-02` — HIGH)

- **Target File:** [`lib/csrf.ts`](../lib/csrf.ts) (`L9-27`)
- **Defect Verified in Live Code:**
  1. Line 26 uses `allowedOrigins.some((allowed) => origin.startsWith(allowed as string))`. An attacker origin `https://davintrade.app.attacker.com` passes `origin.startsWith('https://davintrade.app')`.
  2. Lines 22–24 (`if (!origin) return true;`) allow requests where the `Origin` header is absent without checking `Sec-Fetch-Site` or `Referer`.
- **Remediation:**
  1. Parse `origin` and each `allowed` entry with `new URL(...)` and compare `parsedOrigin.origin === parsedAllowed.origin` (exact scheme + hostname + port equality), supporting `x-forwarded-host` / `host` and `NEXTAUTH_URL`.
  2. When `!origin`, check `headersList.get('sec-fetch-site')`: if `sec-fetch-site` is `'cross-site'`, return `false`. If `referer` is present, verify `new URL(referer).origin` against `allowedOrigins`.

---

## 4. Tier 1 — Stability, Server Boundary Enforcement & Defense-in-Depth Auth

> **Goal:** Prevent cascading monolith hangs when downstream services stall, enforce compile-time server boundaries (`server-only`), fix DB/Redis singleton pools, and close auth/rate-limit/CSRF gaps on live routes.

### Unit 1.1 — Outbound Request Timeouts (`AbortSignal.timeout`) & AI Reply Deadline Tuning (`STB-01`, `STB-02` — CRITICAL)

- **Target Files:**
  1. [`lib/operation-service/client.ts`](../lib/operation-service/client.ts) (`L61-68, L114-122, L150-158`) & [`lib/api/generated/operation-api/client.ts`](../lib/api/generated/operation-api/client.ts) (`L47-55`)
  2. [`lib/money-service/client.ts`](../lib/money-service/client.ts) (`L49-56`) & [`lib/api/generated/money-api/client.ts`](../lib/api/generated/money-api/client.ts) (`L42-50`)
  3. [`lib/dlocal/dlocal-payment.service.ts`](../lib/dlocal/dlocal-payment.service.ts) (`L109-119, L204-211`) (`⚠` money mirror)
  4. [`lib/storage/r2.ts`](../lib/storage/r2.ts) (`L51-60, L126, L167`) & [`lib/reply/orchestrator.ts`](../lib/reply/orchestrator.ts) (`L400`)
  5. [`lib/reply/gateway/openrouter.ts`](../lib/reply/gateway/openrouter.ts) (`L69-73, L544-569`)
  6. [`lib/stripe/stripe.ts`](../lib/stripe/stripe.ts) (`L41-44, L61-73`) (`⚠` money mirror)
- **Remediation:**
  - Add a default `AbortSignal.timeout(5_000)` (unless caller supplies `init.signal`) to `callOperationService`, `forwardToOperationService`, `forwardJsonToOperationService`, and `createOperationApi`, and `AbortSignal.timeout(8_000)` to `forwardToMoneyService` and `createMoneyApi`. This guarantees that if `operation-service` hangs, the monolith proxy fails fast within 5s and executes its local Prisma fallback (`lib/operation-service/write-routes.ts:47-86`).
  - Add `AbortSignal.timeout(10_000)` to `DLocalPaymentService.createPayment` and `getPaymentStatus`.
  - Add an explicit `AbortSignal.timeout(5_000)` (or combine with caller `abortSignal` via `AbortSignal.any`) to `S3Client.send(command, { abortSignal })` in `lib/storage/r2.ts:126,167`.
  - In `lib/reply/gateway/openrouter.ts:69-73,544-569`, add a `250ms–500ms` jittered backoff before retrying a `429`/`5xx` error, and skip the second primary-vendor retry if the caller's `signal` / deadline budget has `< 25_000ms` remaining so the `20,000ms` fallback vendor (`lib/reply/orchestrator.ts:505`) always gets its full window before the `55,000ms` `REPLY_DEADLINE_MS` expires.
  - Set `timeout: 15_000` and `maxNetworkRetries: 2` on `new Stripe(...)` in `lib/stripe/stripe.ts:41-44`, and add a 1-hour TTL to `proPriceCache` (`L61`).

### Unit 1.2 — Install `server-only` & Guard Server Modules (`BND-01` — CRITICAL)

- **Target Files:** [`package.json`](../package.json) and server-only modules in `lib/**`.
- **Remediation:**
  1. Add `"server-only": "^0.0.1"` to `dependencies` in `package.json` (`⚠ NEEDS EXPLICIT SIGN-OFF` per `.claude/rules/security-overrides.md` / dependency rule; never touch `overrides` / `pnpm.overrides`).
  2. Add `import 'server-only';` to:
     - Database & Infra: `lib/db/prisma.ts`, `lib/db/market-prisma.ts`, `lib/redis/client.ts`, `lib/storage/r2.ts`, `lib/tokens.ts`, `lib/csrf.ts`, `lib/rate-limit.ts`
     - Auth & Admin: `lib/auth/auth-options.ts`, `lib/auth/session.ts`, `lib/auth/two-factor.ts`, `lib/auth/permissions.ts`, `lib/admin/user-view-as.ts`, `lib/affiliate/view-as.ts`, `lib/admin/analytics/*.ts`, `lib/fraud/fraud-detection.service.ts`
     - Service Clients & Billing: `lib/operation-service/client.ts`, `lib/operation-service/write-routes.ts`, `lib/money-service/client.ts`, `lib/money-service/write-routes.ts`, `lib/stripe/stripe.ts`, `lib/stripe/webhook-handlers.ts`, `lib/dlocal/*.ts`, `lib/disbursement/**`
     - Stack D Server/Store/Read Layers: `lib/engine4/server/*.ts`, `lib/engine4/store/*.ts`, `lib/engine4/read/*.ts`, `lib/intake/server/*.ts`, `lib/intake/read/*.ts`, `lib/intake/knowledge-client.ts`, `lib/reply/server/*.ts`, `lib/reply/read/*.ts`, `lib/reply/gateway/openrouter.ts`, `lib/platform/**`. _(Note for Claude Code: verify whether Stack D's import-guard tests in `__tests__/lib/{engine4,intake,reply,platform}` inspect import specifiers and ensure `'server-only'` is allowed in those guard tests and mapped in `jest.config.js` `moduleNameMapper` if needed.)_

### Unit 1.3 — Prisma Pool & Redis Singleton Hygiene (`STB-03` — HIGH)

- **Target Files:** [`lib/db/prisma.ts`](../lib/db/prisma.ts) (`L31-50`), [`lib/db/market-prisma.ts`](../lib/db/market-prisma.ts) (`L23-42`), [`lib/redis/client.ts`](../lib/redis/client.ts) (`L11-27`)
- **Remediation:**
  1. In `lib/db/prisma.ts` and `lib/db/market-prisma.ts`, move `new PrismaPg(...)` inside a factory function `createPrismaClient()` so the `pg.Pool` is only created when `globalForPrisma.prisma` (or `globalForMarketPrisma.marketPrisma`) is undefined, and assign `globalForPrisma.prisma = prisma` unconditionally.
  2. Configure explicit pool parameters on `new PrismaPg({ connectionString: process.env['DATABASE_URL'], ssl: { rejectUnauthorized: false }, max: 10, connectionTimeoutMillis: 5_000, idleTimeoutMillis: 30_000 })`.
  3. In `lib/redis/client.ts`, store `redisClient` on `globalThis` (preventing HMR connection leaks) and add `connectTimeout: 5_000` and `commandTimeout: 3_000` to `REDIS_OPTIONS`.

### Unit 1.4 — Wire Rate Limiting on Sensitive Auth, 2FA & Action Endpoints (`RTE-04`, `ACT-07` — HIGH)

- **Target Files:**
  - [`lib/rate-limit.ts`](../lib/rate-limit.ts) (`L70-105, L137-160`)
  - [`app/api/user/2fa/verify/route.ts`](../app/api/user/2fa/verify/route.ts) (`L48`)
  - [`app/api/user/2fa/verify-setup/route.ts`](../app/api/user/2fa/verify-setup/route.ts) (`L56`)
  - [`app/api/user/2fa/disable/route.ts`](../app/api/user/2fa/disable/route.ts) (`L54`)
  - [`app/api/user/password/route.ts`](../app/api/user/password/route.ts) (`L47`)
  - [`app/api/auth/forgot-password/route.ts`](../app/api/auth/forgot-password/route.ts) (`L14`)
  - [`app/api/auth/reset-password/route.ts`](../app/api/auth/reset-password/route.ts) (`L14`)
  - [`app/actions/appearance.ts`](../app/actions/appearance.ts) (`L20`)
- **Remediation:**
  1. In `lib/rate-limit.ts:70-105`, wrap `getRedisClient()` inside the `try/catch` block so that if `REDIS_URL` is unset in local/test environments, `checkRateLimit()` logs a warning and degrades gracefully rather than throwing an unhandled synchronous error.
  2. Enforce `checkAuthRateLimit` (5–10 attempts / 15 min keyed by user ID or client IP) at the start of `POST /api/user/2fa/verify`, `POST /api/user/2fa/verify-setup`, `POST /api/user/2fa/disable`, `PUT /api/user/password`, `POST /api/auth/forgot-password`, and `POST /api/auth/reset-password` (returning HTTP `429` with `Retry-After` when exceeded).
  3. Add a per-user rate limit (e.g., 20 writes/min) before the Prisma upsert in `saveAppearanceAction` (`app/actions/appearance.ts:36`).

### Unit 1.5 — Admin RSC Page-Level Auth, Disbursement Health Auth & Middleware Prefix Alignment (`AUT-01`, `AUT-02`, `RTE-03` — HIGH)

- **Target Files:**
  - [`lib/admin/analytics/{executive,revenue,affiliates,regional,users}.ts`](../lib/admin/analytics/executive.ts)
  - [`app/admin/users/[id]/page.tsx`](../app/admin/users/%5Bid%5D/page.tsx) (`L91`), [`app/admin/system/config-history/page.tsx`](../app/admin/system/config-history/page.tsx) (`L25`), [`app/admin/system/outbox/page.tsx`](../app/admin/system/outbox/page.tsx) (`L40`)
  - [`app/api/disbursement/health/route.ts`](../app/api/disbursement/health/route.ts) (`L39`)
  - [`middleware.ts`](../middleware.ts) (`L42-57`)
- **Remediation:**
  1. Add an explicit admin session verification (`await requireAdmin()` or a cached RSC admin guard that redirects non-admins) inside the 8 admin Server Component pages (or at the entry of `lib/admin/analytics/*.ts`) so they never rely solely on `app/admin/layout.tsx` or `middleware.ts`.
  2. Gate detailed operational counts and provider authentication in `GET /api/disbursement/health` (`app/api/disbursement/health/route.ts:39`) behind admin session or internal service token auth (or return only `{ status: 'healthy' | 'unhealthy' }` to unauthenticated probes).
  3. Add `'/terminal'` and `'/free'` (and handle exact `'/pro'`) to `PROTECTED_PREFIXES` in `middleware.ts:42-57`.

### Unit 1.6 — Enforce CSRF `validateOrigin()` Across Cookie-Authenticated Mutation Routes (`RTE-02` — HIGH)

- **Target Files:**
  - Shared Stack D route wrappers: [`lib/engine4/server/respond.ts:91`](../lib/engine4/server/respond.ts), [`lib/intake/server/respond.ts:67`](../lib/intake/server/respond.ts), [`lib/reply/server/respond.ts:92`](../lib/reply/server/respond.ts), [`lib/reply/server/threads-api.ts:64`](../lib/reply/server/threads-api.ts)
  - Cookie-authenticated `POST`/`PUT`/`PATCH`/`DELETE` handlers in `app/api/{user,alerts,drawings,admin,affiliate,checkout,subscription,payments,disbursement}/**/route.ts` (excluding machine-to-machine webhook and cron routes `/api/webhooks/**` and `/api/cron/**`).
- **Remediation:**
  - Call `if (!(await validateOrigin())) return csrfErrorResponse();` in the shared route wrappers and state-changing cookie-authenticated route handlers (or enforce it centrally for cookie-authenticated non-webhook `/api/**` mutations).

---

## 5. Tier 2 — Server-Side Performance, DTO Minimization & Error/Header Hardening

> **Goal:** Eliminate duplicate per-request auth/DB lookups via `React.cache()`, parallelize sequential server waterfalls, enforce strict Prisma `select` DTO projections, and sanitize error/header disclosures.

### Unit 2.1 — Per-Request Deduplication via `React.cache()` (`AUT-05`, `PRF-01` — HIGH)

- **Target Files:**
  - [`lib/auth/session.ts`](../lib/auth/session.ts) (`getSession` at `L29`, `getAffiliateProfile` at `L168`)
  - [`lib/appearance/server-appearance.ts`](../lib/appearance/server-appearance.ts) (`getServerAppearance` at `L24`)
  - [`lib/i18n/server-locale.ts`](../lib/i18n/server-locale.ts) (`getServerLanguage` at `L65`, `getServerLocalePreferences` at `L73`)
  - [`lib/affiliate/view-as.ts`](../lib/affiliate/view-as.ts) (`getAdminViewAs` at `L141`)
  - [`lib/admin/user-view-as.ts`](../lib/admin/user-view-as.ts) (`getAdminUserViewAs` at `L157`)
  - [`lib/tutorials/tutorial-ReadService.ts`](../lib/tutorials/tutorial-ReadService.ts) (`getPublishedTutorialById` at `L120`)
- **Remediation:**
  - Wrap these request-scoped read helpers with `cache(...)` from `'react'`.
  - In layouts and pages that currently call `getServerSession(authOptions)` directly (`app/{dashboard,alerts,free,notifications,pro/currency-index,terminal,settings,admin}/layout.tsx`, `app/admin/disbursement/layout.tsx`, `app/{dashboard,terminal,free}/page.tsx`), switch to the cached `getSession()` helper so `RootLayout` -> child `Layout` -> `Page` executes session decryption and `userAppearance` / `user` lookup **once** per request instead of 2–4 times.

### Unit 2.2 — Eliminate Sequential `await` Waterfalls & Use `after()` for Non-Blocking Writes (`PRF-02` — HIGH)

- **Target Files:**
  1. **Engine 4:**
     - [`lib/engine4/read/cycle.ts:224-343`](../lib/engine4/read/cycle.ts) (`readOfferSnapshot`): After `newestRow` resolves `pinnedSlot` (`L241`), execute `marketPrisma.synthesisReading.findFirst` (`L244`), `marketPrisma.entryZone.findMany` (`L294`), and `marketPrisma.marketCycle.findFirst` (`L339`) concurrently in `Promise.all()`.
     - [`lib/engine4/server/context.ts:120-166,215-238`](../lib/engine4/server/context.ts) (`loadWorld` & `loadDetailForStyle`): Run `readProfile` concurrently with `fetchCurrentCycle`, `readNewestBrokerFigures`, and `readClosedM5Bars`; parallelize `readSynthesisDetail` and `readStructureLevels`.
  2. **Intake & Reply:**
     - [`lib/intake/pipeline.ts:383-420`](../lib/intake/pipeline.ts): Parallelize `ports.snapshot({ traderType })` and `ports.events({ nowSeconds, scope })`.
     - [`lib/intake/read/snapshot.ts:392-541`](../lib/intake/read/snapshot.ts): Parallelize `readSensorRows(pinned.slot, traderType)` and `readSynthesis(pinned.slot, traderType)`, and inside `readSynthesis` parallelize `synthesisReading.findFirst` and `entryZone.findMany`.
     - [`lib/intake/gate.ts:239-259`](../lib/intake/gate.ts): Parallelize `ports.thread.check` and `ports.profile.read`.
     - [`lib/reply/orchestrator.ts:360-410`](../lib/reply/orchestrator.ts): Start `ports.dayBars(packet.data.cycle_slot)` in parallel with `ports.threads.context`, then run `ports.previousStates` and `readChart` concurrently in `Promise.all()`.
     - [`lib/reply/server/state-api.ts:124-145`](../lib/reply/server/state-api.ts) & [`lib/reply/server/threads-api.ts:251-262`](../lib/reply/server/threads-api.ts): Parallelize independent `ledger.balance` + `profile` reads, and `getThread` + `listMessages`.
  3. **Server Components & Route Handlers:**
     - Parallelize analytics + locale + FX rate reads in `app/admin/dashboards/{executive,revenue,regional,affiliates,users}/page.tsx`, `app/admin/users/[id]/page.tsx:94-106`, `app/dashboard/page.tsx:51-87`, `app/alerts/{page,new/page,[id]/edit/page}.tsx`, `app/affiliate/dashboard/payouts/page.tsx:61-90`, `app/api/user/login-history/route.ts:90-114`, and `app/api/user/security-alerts/route.ts:72-91`.
     - In [`app/(marketing)/academy/[id]/page.tsx:78`](../app/%28marketing%29/academy/%5Bid%5D/page.tsx), wrap `incrementTutorialViewCount(id)` in `after()` from `'next/server'` so the view-count DB write does not block page streaming.

### Unit 2.3 — Enforce Prisma `select` Projections, DTO Minimization & React Taint (`DAL-01`–`DAL-05`, `BND-03`, `BND-04` — HIGH)

- **Target Files:**
  - [`lib/auth/session.ts:202-261`](../lib/auth/session.ts) & [`app/api/affiliate/profile/route.ts:82,164-184`](../app/api/affiliate/profile/route.ts)
  - [`app/api/subscription/route.ts:119-131`](../app/api/subscription/route.ts), [`app/api/subscription/cancel/route.ts:79-96,127-137`](../app/api/subscription/cancel/route.ts), [`app/api/payments/dlocal/create/route.ts:122-132`](../app/api/payments/dlocal/create/route.ts), [`app/api/user/profile/route.ts:131-133`](../app/api/user/profile/route.ts), [`app/api/auth/forgot-password/route.ts:41`](../app/api/auth/forgot-password/route.ts), [`app/api/auth/resend-verification/route.ts:28`](../app/api/auth/resend-verification/route.ts)
  - [`app/api/admin/fraud-alerts/[id]/route.ts:44-83,162-196`](../app/api/admin/fraud-alerts/%5Bid%5D/route.ts), [`app/api/drawings/route.ts:68-78,175-187`](../app/api/drawings/route.ts), [`app/api/drawings/[id]/route.ts:66,93,153`](../app/api/drawings/%5Bid%5D/route.ts), [`app/api/alerts/line/route.ts:68-80`](../app/api/alerts/line/route.ts)
  - [`next.config.js:49-67`](../next.config.js)
- **Remediation:**
  1. Add explicit `select` clauses to all `prisma.user.findUnique` calls so `password`, `twoFactorSecret`, `twoFactorBackupCodes`, `verifyToken`, and `resetToken` are never loaded into memory unless specifically required by an auth handler.
  2. Add an explicit DTO mapper / `select` to `getAffiliateProfile()` and `app/api/affiliate/profile/route.ts` that masks sensitive bank/payout fields inside `paymentDetails` (returning only masked last-4 digits or safe summary fields to the browser), and add explicit `select` clauses to `FraudAlert`, `Drawing`, and `DrawingAlert` queries.
  3. Enable `experimental: { taint: true }` in `next.config.js` (`BND-04`) and apply `experimental_taintObjectReference` / `experimental_taintUniqueValue` on any internal helper that loads raw `User` credentials or tokens.
  4. Consolidate client-side `process.env.NEXT_PUBLIC_*` reads into a single typed `lib/config/public-env.ts` module (`BND-03`).

### Unit 2.4 — Sanitize Client & API Error Messages (`ERR-02`, `ERR-03` — HIGH)

- **Target Files:**
  - [`app/error.tsx:43`](../app/error.tsx) & [`app/global-error.tsx:24-48`](../app/global-error.tsx)
  - [`app/api/payments/dlocal/create/route.ts:320-323`](../app/api/payments/dlocal/create/route.ts)
  - [`app/api/disbursement/pay/route.ts:163-167`](../app/api/disbursement/pay/route.ts)
  - [`app/api/disbursement/batches/[batchId]/execute/route.ts:114-118`](../app/api/disbursement/batches/%5BbatchId%5D/execute/route.ts)
  - [`app/api/webhooks/stripe/route.ts:112-115`](../app/api/webhooks/stripe/route.ts)
  - [`app/api/admin/active-indicator/route.ts:86`](../app/api/admin/active-indicator/route.ts)
- **Remediation:**
  1. In `app/error.tsx:43`, replace `{error.message || t('errors.page.unexpected', ...)}` with the generic localized message `t('errors.page.unexpected', ...)` (matching `app/global-error.tsx:68-71`), while preserving `error.digest` display for support correlation.
  2. In `app/global-error.tsx`, add a `useEffect` calling `logError(error, { digest: error.digest, boundary: 'global-error' })` so global crashes are recorded.
  3. In the API routes listed above, log the full `error` server-side and return generic error strings (e.g., `'Failed to create payment'`, `'Internal server error'`, `'Invalid signature'`) without concatenating raw `error.message` or `String(error)`.

### Unit 2.5 — `⚠` Security Headers, CSP & SVG Upload Hardening (`HDR-01`, `HDR-02`, `HDR-07`, `INP-04`, `ACT-05` — HIGH)

- **Governance Gate:** `⚠ NEEDS EXPLICIT SIGN-OFF` (modifies CSP/headers in [`next.config.js`](../next.config.js)).
- **Target Files:** [`next.config.js:14-40, 88-146`](../next.config.js), [`lib/marketing-resources/validators.ts:36-42`](../lib/marketing-resources/validators.ts), [`lib/marketing-resources/storage.ts:27-34`](../lib/marketing-resources/storage.ts)
- **Remediation:**
  1. Remove the deprecated `'X-XSS-Protection': '1; mode=block'` header at `next.config.js:122-125` (`HDR-07`).
  2. Update `Strict-Transport-Security` (`next.config.js:113`) from `max-age=31536000` to `max-age=63072000; includeSubDomains; preload` (`HDR-02`).
  3. In `next.config.js:137` (`Content-Security-Policy` `connect-src`), include `http://localhost:3001 ws://localhost:3001` **only** when `process.env.NODE_ENV !== 'production'` (`HDR-01`).
  4. In `lib/marketing-resources/validators.ts:36-42` and `lib/marketing-resources/storage.ts:27-34` (`INP-04`): either remove `'image/svg+xml'` from `ACCEPTED_ASSET_MIME_TYPES` (preferring PNG/WebP/PDF) or sanitize uploaded SVG XML and set `contentDisposition: 'attachment'` + sanitize `file.name` path characters before calling Vercel Blob `put()`.

---

## 6. Tier 3 — Client Bundle Optimization, Polling Hygiene & CI Security Gates

> **Goal:** Reduce client JS bundle weight, eliminate background tab polling and abort races, add segment-level error/loading boundaries, and harden CI dependency/secret gates.

### Unit 3.1 — Dynamic Imports (`next/dynamic`), Locale Dictionary Splitting & Package Optimization (`PRF-03` — HIGH)

- **Target Files:**
  - [`components/currency-index-pro/pro-currency-index-cockpit.tsx:24-29`](../components/currency-index-pro/pro-currency-index-cockpit.tsx) (`HrmaSmmaDetailModal`, `PairChartModal`, `RelativeStrengthChart`)
  - [`components/currency-index-comparison/currency-index-comparison-workspace.tsx:67`](../components/currency-index-comparison/currency-index-comparison-workspace.tsx) (`CurrencyIndexComparisonChart`)
  - [`app/(marketing)/xaux-vs-usdx/page.tsx:14`](../app/%28marketing%29/xaux-vs-usdx/page.tsx) (`XauxUsdxComparisonChart`)
  - [`app/admin/dashboards/regional/page.tsx:1`](../app/admin/dashboards/regional/page.tsx) (`DonutMarketShare`) & [`components/admin/analytics/historical-trend-chart.tsx`](../components/admin/analytics/historical-trend-chart.tsx)
  - [`lib/context/locale-context.tsx:45-59`](../lib/context/locale-context.tsx)
  - [`next.config.js:61-66`](../next.config.js)
- **Remediation:**
  1. Load closed-by-default chart modals (`HrmaSmmaDetailModal`, `PairChartModal`) and heavy `lightweight-charts` / `recharts` canvas/SVG components via `next/dynamic(..., { ssr: false })`.
  2. In `lib/context/locale-context.tsx:45-59`, pass the initial server-resolved dictionary from `app/layout.tsx` (or lazy-load non-active locale JSON files via dynamic `import()`) so the root client bundle does not statically pack all 3 full locale dictionaries (`th.json`, `en-GB.json`, `en-US.json`) on every page load.
  3. Expand `experimental.optimizePackageImports` in `next.config.js:61-66` to include `@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-select`, `@radix-ui/react-tabs`, `@radix-ui/react-tooltip`, and `@radix-ui/react-popover`.

### Unit 3.2 — Convert 14 Static `'use client'` Marketing Pages to Server Components (`PRF-03` — MEDIUM)

- **Target Files:**
  - `app/(marketing)/{about,blog,careers,changelog,disclaimer,docs,econ-news,help,pricing,privacy,terms,xaux-vs-usdx}/page.tsx`
  - `app/affiliate/page.tsx`, `app/affiliate/join/page.tsx`
- **Remediation:**
  - Replace top-level `'use client'` + `useLocale()` with async Server Components using `getServerLanguage()` + `createTranslator()` (matching the established pattern in [`app/(marketing)/academy/page.tsx:78-79`](../app/%28marketing%29/academy/page.tsx)), extracting only interactive leaf controls into small Client Components.
  - In [`app/(marketing)/page.tsx:26-36`](../app/%28marketing%29/page.tsx), narrow the `<Suspense>` boundary to wrap only `<LandingPricing />` (which calls `useSearchParams()`) rather than wrapping `<LandingHero />` and `<LandingFeatures />` as well.

### Unit 3.3 — Fix Client Polling Abort Race, Background Tab Polling & Socket.IO Token Refresh (`STB-04` — MEDIUM)

- **Target Files:**
  - [`components/currency-index-pro/hooks/use-currency-index-chart.ts:74-99`](../components/currency-index-pro/hooks/use-currency-index-chart.ts)
  - [`components/currency-index-pro/hooks/use-currency-index-screener.ts:79-102`](../components/currency-index-pro/hooks/use-currency-index-screener.ts)
  - [`components/charts/drawing/useEventMarkers.ts:40-85`](../components/charts/drawing/useEventMarkers.ts), [`components/market-sessions/useUpcomingEvents.ts:32-58`](../components/market-sessions/useUpcomingEvents.ts), [`components/market-sessions/useContainmentRates.ts:25-51`](../components/market-sessions/useContainmentRates.ts)
  - [`hooks/use-realtime-socket.ts:86-98`](../hooks/use-realtime-socket.ts) & [`hooks/use-ohlcv-socket.ts:78-82`](../hooks/use-ohlcv-socket.ts)
- **Remediation:**
  1. In `use-currency-index-chart.ts:87-90`, guard `setData(EMPTY_DATA)` behind `if (controller.signal.aborted) return;` so aborted in-flight requests do not wipe active chart data.
  2. Add `document.visibilityState === 'hidden'` pause checks and in-flight overlap guards to the polling hooks (following `lib/fx/use-display-usd-rates.ts:159,197`).
  3. In `hooks/use-realtime-socket.ts:86-98`, pass an async `auth: async (cb) => { ... }` callback to `io(...)` so reconnects fetch a fresh `/api/realtime/token` instead of looping with an expired token, and configure `reconnectionDelayMax: 30_000` + `randomizationFactor: 0.5`.

### Unit 3.4 — Add Segment-Level `error.tsx` & `loading.tsx` Boundaries (`STB-04`, `PRF-02` — MEDIUM)

- **Target Directories:** `app/admin/dashboards/`, `app/affiliate/dashboard/`, `app/terminal/`, `app/free/`, `app/pro/currency-index/`
- **Remediation:**
  - Add segment-level `error.tsx` and `loading.tsx` boundaries so a failed dashboard query or chart load renders an inline recovery card inside the existing dashboard shell instead of unmounting the entire page via root `app/error.tsx`.

### Unit 3.5 — CI/CD Audit Gate, Secret Scanning & Unused SQL Helper Cleanup (`OPS-01`–`OPS-04`, `INP-01` — MEDIUM)

- **Target Files:**
  - [`.github/workflows/dependencies-security.yml:68-75`](../.github/workflows/dependencies-security.yml)
  - [`.github/workflows/security-checks.yml:87-117`](../.github/workflows/security-checks.yml)
  - [`.github/dependabot.yml`](../.github/dependabot.yml) (new)
  - [`lib/candle-data-helpers.ts:181-196`](../lib/candle-data-helpers.ts)
- **Remediation:**
  1. In `dependencies-security.yml:68-75`, replace `pnpm install --no-frozen-lockfile` with `pnpm install --frozen-lockfile` and make `pnpm audit --prod --audit-level=high` a blocking check (removing `continue-on-error: true` and `|| echo`).
  2. Expand `security-checks.yml:87-117` (or integrate Gitleaks) to scan for private keys (`-----BEGIN`), Resend keys (`re_`), Vercel Blob tokens (`vercel_blob_rw_`), and database URLs with embedded credentials across all tracked text files.
  3. Add `.github/dependabot.yml` for weekly dependency security alerts (`OPS-02`).
  4. In `lib/candle-data-helpers.ts:181-196`, either remove the unused `getFromPostgreSQL` function or enforce a strict allowlist check on `symbol` and `timeframe` before constructing `${symbol}_${timeframe}` (`INP-01`).

---

## 7. Specific Review Questions for Claude Code (Executor)

When reviewing this Draft 1 Master Plan against the live codebase, please verify and advise on the following points:

1. **Unit 0.1 (`/api/test/seed`):** Does any GitHub Actions workflow (`.github/workflows/*.yml`) or Playwright E2E configuration (`e2e/**`) invoke `POST /api/test/seed` against a non-local `NODE_ENV=production` preview server using `x-test-secret`, or is `/api/test/seed` only ever called in `NODE_ENV=development` / `test`?
2. **Unit 0.2 (`lib/fraud/fraud-detection.service.ts`):** Confirm that no Client Component (`'use client'`) anywhere in `app/` or `components/` imports from `@/lib/fraud/fraud-detection.service`, so replacing `'use server'` with `import 'server-only'` is 100% non-breaking.
3. **Unit 0.4 & Unit 1.6 (CSRF `validateOrigin()` in Stack D Route Wrappers):** If `validateOrigin()` is added inside `runRoute` (`lib/engine4/server/respond.ts`), `runIntakeRoute` (`lib/intake/server/respond.ts`), `runMessageRoute` (`lib/reply/server/respond.ts`), and `createChatAuth` (`lib/reply/server/threads-api.ts`), how do the existing unit/integration tests in `__tests__/api/{engine4,intake}` and `__tests__/lib/reply` construct `Request` objects (do they omit the `Origin` header, or pass `http://localhost` without a `Host` header)? Should `validateOrigin()` inspect `request.headers` directly when a `Request` instance is passed, rather than calling `next/headers` `headers()`?
4. **Unit 1.2 (`import 'server-only'` & Stack D Import Guards):** Do the repository guard tests in `__tests__/lib/{engine4,intake,reply,platform}` restrict allowed external package specifiers in `lib/{engine4,intake,reply,platform}/**`? If so, which guard test files need `'server-only'` added to their allowlist, and does `jest.config.js` need a `moduleNameMapper` stub for `'server-only'`?
5. **Unit 2.2 (Stack D Parallelization via `Promise.all()`):** Do any unit tests or mutation tests in `__tests__/lib/{engine4,intake,reply}` assert strict sequential call order or fail-fast order between:
   - `readSynthesisReading`, `entryZone.findMany`, and `marketCycle.findFirst` in `lib/engine4/read/cycle.ts:244-339`?
   - `ports.snapshot` and `ports.events` in `lib/intake/pipeline.ts:383-420` (e.g., if `snapshot` returns a refusal, does a test assert `ports.events` was not called)?
   - `ports.threads.context`, `ports.previousStates`, `ports.dayBars`, and `readChart` in `lib/reply/orchestrator.ts:360-410`?
     _(Where a test or contract requires fail-fast refusal before calling the next port, keep the refusal gate sequential and parallelize only the side-effect-free DB queries inside the reader implementation!)_

---

## 8. Verification Baselines & Commands

Every session executing a unit from this plan must verify and report exit codes and test counts against the repository baselines ([`.claude/protocols/verification-checklist.md`](../.claude/protocols/verification-checklist.md)):

- **TypeScript Type Check (Source):**
  - `npx tsc --noEmit` (must exit `0` with `0` errors)
- **ESLint:**
  - `npx eslint <touched-files> --max-warnings 0` (must exit `0`)
- **Jest Test Suite (Baseline: 518 suites / 18,174 tests passing):**
  - Targeted unit/integration suites for touched modules (`npx jest <path>`)
  - Full suite check before phase closeout (`npm test`)
- **Sensor Kit & Operating Docs Integrity (when applicable):**
  - `npm run check:sensor-kit` (exit `0`)
  - `node scripts/agents/check-operating-docs.mjs` (exit `0`)
- **Production Build & Browser Verification (for UI / `next.config.js` / RSC changes):**
  - `npm run build` (exit `0`)
  - Browser evidence at desktop and mobile viewports (`320px`, `375px`, `1280px`) for any UI or client-boundary refactor (Unit 3.1, Unit 3.2, Unit 3.4).
