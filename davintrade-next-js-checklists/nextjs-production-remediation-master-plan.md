# Next.js Security, Stability & Performance Remediation Master Plan (Revision 2 — Consensus Edition)

> **Reference Standards:**
>
> - [`davintrade-next-js-checklists/NEXTJS_SECURITY_CHECKLIST.md`](./NEXTJS_SECURITY_CHECKLIST.md) (Sections 1–9, 45 Controls)
> - [`.agents/skills/vercel-react-best-practices/SKILL.md`](../.agents/skills/vercel-react-best-practices/SKILL.md) (Vercel React & Next.js Performance Guidelines)
> - Bundled Next.js 16.4.1 Documentation (`node_modules/next/dist/docs/`)
>
> **Review Incorporated:** [`davintrade-next-js-checklists/nextjs-production-remediation-recommend-by-claude-code.md`](./nextjs-production-remediation-recommend-by-claude-code.md) (Claude Code Executor Live-Code Verification & Review, 2026-10-17)  
> **Target Codebase:** Next.js 16.4.1 / React 19.3.0 App Router Monolith (`app/`, `components/`, `lib/`, `hooks/`, `middleware.ts`, `next.config.js`, `.github/workflows/`)  
> **Cutover & Architecture Context:** Verified against [`docs/migration-orders/migration-cutover-table.md`](../docs/migration-orders/migration-cutover-table.md), [`.claude/state/current-state.md`](../.claude/state/current-state.md), and [`docs/STACK-D-ARCHITECTURE.md`](../docs/STACK-D-ARCHITECTURE.md) at commit `f948c0cc`  
> **Status:** **REVISION 2 (CONSENSUS EDITION) — READY FOR DAVIN SIGN-OFF & SINGLE-UNIT EXECUTION**  
> **Date:** 2026-10-17

---

## 1. Executive Summary & Consensus Corrections

Following Claude Code's line-by-line verification of Draft 1 against live code (`f948c0cc`), the installed `next@16.4.1` runtime and bundled documentation (`node_modules/next/dist/docs/`), 11 live test suites (667 tests), and a throwaway worktree experiment on Stack D boundary guards, this **Revision 2 (Consensus Edition)** establishes the canonical, single-unit execution roadmap.

### 1.1 Key Corrections & Refinements Incorporated from Claude Code's Review

1. **P0-a (`POST /api/test/seed`) Elevated & Simplified to Deletion (`⚠ NEEDS EXPLICIT SIGN-OFF`):**
   - `next build` inlines `process.env.NODE_ENV` as `"production"` across all built deployments, meaning the `x-test-secret: test-secret` fallback in [`app/api/test/seed/route.ts:68-80`](../app/api/test/seed/route.ts) is the _only_ active path in any build. Beyond seeding `admin-test@trading-alerts.test` (`role: 'ADMIN'`, password `AdminPassword123!`), it also seeds an unpaid `ACTIVE` `PRO` user (`pro-test@trading-alerts.test`), an `ACTIVE` affiliate profile, and two live discount codes (`TESTCODE10`, `TESTCODE20`).
   - Because zero live workflows or Playwright configs call `/api/test/seed` (only archived `e2e/archive/global.setup.ts:32-35`), **P0-a deletes `app/api/test/seed/route.ts`** (and removes its allow-list entry in `__tests__/lib/systemconfig-figures-guard.test.ts:124`), paired with a read-only production DB check.
2. **P0-b (`'use server'` in Fraud Service) Reframed as High (Latent) + Dead-Code Removal:**
   - Next.js 16 encrypts action IDs and tree-shakes unused actions from client bundles (`data-security.md:283-291`). Since only two admin route handlers import [`lib/fraud/fraud-detection.service.ts`](../lib/fraud/fraud-detection.service.ts), the exposure is latent until imported by a client module. P0-b replaces `'use server'` with `import 'server-only'` and deletes the 3 dead functions with zero callers (`runFraudChecks`, `createFraudAlerts`, `detectAndAlertFraud`). Draft 1's `app/dev/report2/actions.ts` step is dropped (already guarded by `refuseInProduction()` in `world.ts:186-195`).
3. **P0-c (`⚠` NextAuth `redirect` Callback) Preserves Auth-Page Callbacks:**
   - Draft 1 proposed calling `safeCallbackUrl(url, '')`, which would break NextAuth callbacks targeting `/login`, `/register`, or `/verify-2fa` (`lib/auth/safe-callback-url.ts:24,56-63`). P0-c instead keeps relative paths starting with `/` (rejecting `//` and `\`), restricts `localhost`/`127.0.0.1` to non-production, and replaces the wildcard `.endsWith('.vercel.app')` check with exact origin matching against `baseUrl` plus `https://${VERCEL_URL}` / `https://${VERCEL_BRANCH_URL}` in preview environments.
4. **P0-d & T1-f (`⚠` CSRF) Reframed Around Login CSRF & Centralized in `middleware.ts`:**
   - Because session cookies are `SameSite=Lax` and Stack D POST routes already enforce `Content-Type: application/json`, the primary live exploit of `origin.startsWith(allowed)` in [`lib/csrf.ts:26`](../lib/csrf.ts) is **Login CSRF** on unauthenticated `POST /api/auth/token-login` (which parses `request.json()` without checking `Content-Type`).
   - Instead of editing ~45 route handlers and 4 Stack D wrappers (which have closed error catalogues and tests that build `Request` objects without `Origin`/`Host` headers), **P0-d** fixes `validateOrigin(request?: Request)` and adds `__tests__/lib/csrf.test.ts`, and **T1-f** enforces CSRF centrally in `middleware.ts` for non-GET `/api/**` routes (excluding explicit machine-to-machine webhook/cron/API-key routes).
5. **T1-a (Outbound Timeouts) Corrected for Proxy Error Semantics & Split Between Reads and Writes:**
   - **Correction to Draft 1 §1.1 & §4.1:** Proxied routes do **not** fall back to local Prisma when the proxy throws (`app/api/alerts/route.ts:168-174,280-289`); local Prisma runs only when a cutover flag is `false` or during Admin View-As. Timeouts therefore turn hangs into fast HTTP `504` errors rather than triggering Prisma fallbacks.
   - **Reads (`T1-a`):** Apply `5,000ms` timeouts mapped to a typed `TIMEOUT` / `504` (following `lib/active-indicator/gateway-client.ts:288-311`), configure socket/connection `requestHandler` timeouts on the R2 `S3Client` (avoiding mid-stream aborts during `transformToByteArray()`), and fix the unguarded plain-HTTP `http://ip-api.com` calls in `lib/security/device-detection.ts:159` and `lib/geo/detect-country.ts:24`.
   - **Writes (`T1-a-writes` `⚠`):** Separated into its own sign-off unit with longer timeout budgets (`>= 15,000ms`) so a slow committed write in `operation-service`, `money-service`, or `dLocal` is not prematurely aborted and retried as a duplicate.
6. **T1-b (`⚠` AI Reply Timeout vs. 55s Deadline) Aligned with Decision D23 (ADR-099):**
   - Keeps D23's `25s / 20s / 55s` constants intact by **not retrying a primary timeout** in `lib/reply/gateway/openrouter.ts:486-491,553-569` (retrying only `429` / `5xx` / transient network errors, and failing over immediately to the `20s` fallback in `lib/reply/gateway/fallback.ts:80-99` on a `25s` primary timeout: `25s + 20s = 45s < 55s`).
7. **T1-c (`import 'server-only'`) Uses Native Next.js 16 Support + Stack D Guard Test Updates:**
   - Next.js 16 and `next/jest` handle `server-only` natively without installing a package in `package.json` or editing `jest.config.js`.
   - Excludes `lib/dlocal/constants.ts` (imported by 4 Client Components) and pure Stack D folders, and updates the 3 Stack D guard test suites (`__tests__/lib/engine4/exactness-guard.test.ts`, `__tests__/lib/reply/boundaries.test.ts`, `__tests__/lib/intake/boundaries.test.ts`) to allow `'server-only'` in non-pure server folders (`read/`, `server/`, `store/`, `lib/platform/**`).
8. **T2-b (Waterfall Parallelization) Trimmed to Contract-Safe Reads Only:**
   - Drops Draft 1's unsafe Stack D parallelizations that violate fail-fast or trace-stage ordering contracts (`loadWorld` `readProfile`, `loadDetailForStyle`, `intake/pipeline.ts` `snapshot`+`events`, `intake/read/snapshot.ts` `synthesisReading`+`entryZone`, `intake/gate.ts`). Retains only verified-safe parallel reads in Engine 4 (`readOfferSnapshot`'s first 3 reads), Intake (`readSensorRows` + `readSynthesis`), Reply (`orchestrator.ts` and `state-api.ts`), and the Admin BI pages.
9. **Harmful / No-Op Draft 1 Items Dropped:**
   - _Dropped:_ `experimental.taint: true` (`BND-04` — switches `app/` onto React's experimental channel).
   - _Dropped:_ Adding single-component `@radix-ui/*` packages or already-default `lucide-react`/`recharts`/`date-fns` to `optimizePackageImports` (`optimizePackageImports.md:21-48`).
   - _Corrected:_ `lib/context/locale-context.tsx:45-59` static bundling of `th.json` (666 KB), `en-GB.json` (374 KB), and `en-US.json` (374 KB) (**~1.4 MB raw / ~328 KB gzip on every page**) is elevated to the #1 client bundle priority in **T3-a** using cacheable per-language dynamic chunks rather than RSC prop serialization.

---

## 2. Master Cross-Reference Matrices (Corrected Counts)

### 2.1 Security Checklist Matrix (`NEXTJS_SECURITY_CHECKLIST.md` — All 45 Controls: 12 Pass · 10 Partial · 23 Fail)

|     ID     | Control Item                                                           |   Risk   |   Status   | Verified Live Codebase Evidence (`f948c0cc`)                                                                                                                                                                                                                                                                                               | Assigned Unit                                       |
| :--------: | :--------------------------------------------------------------------- | :------: | :--------: | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------- |
| **DAL-01** | Adopt a Unified Data Fetching Pattern                                  |   High   |  ❌ Fail   | `app/dashboard/page.tsx:78-87` and `app/alerts/page.tsx:125-128` query `prisma.alert` directly instead of `operation-service` or a shared DAL.                                                                                                                                                                                             | **T2-c** (§5.3)                                     |
| **DAL-02** | Enforce Data Access Layer (DAL) Isolation                              | Critical |  ❌ Fail   | `@/lib/db/prisma` imported directly in **12 Server Components/Layouts**, **1 Server Action** (`app/actions/appearance.ts:6`), and **76 Route Handlers**.                                                                                                                                                                                   | **T2-c** (§5.3)                                     |
| **DAL-03** | Enforce DTO Minimization                                               | Critical |  ❌ Fail   | `getAffiliateProfile()` (`lib/auth/session.ts:202-261`) and `app/api/affiliate/profile/route.ts:82,180` return full `AffiliateProfile` rows including `paymentDetails` JSON (unused by `app/affiliate/dashboard/profile/page.tsx`). Raw `FraudAlert`, `Drawing`, and `DrawingAlert` rows returned in API routes.                           | **T2-c** (§5.3)                                     |
| **DAL-04** | Use Class Instances for Sensitive Internal Records                     |  Medium  |  ❌ Fail   | Zero class-based DTOs in `lib/`. Mitigated via explicit Prisma `select` projections in **T2-c**.                                                                                                                                                                                                                                           | **T2-c** (§5.3)                                     |
| **DAL-05** | Restrict Prototype/Component-Level Queries                             |   High   |  ❌ Fail   | Full `User` rows (including `password` hash, `twoFactorSecret`, `twoFactorBackupCodes`) loaded into memory without `select` in `app/api/subscription/route.ts:119-131`, `app/api/subscription/cancel/route.ts:79-96`, and `app/api/payments/dlocal/create/route.ts:122-132`.                                                               | **T2-c** (§5.3)                                     |
| **BND-01** | Guard Modules with `server-only`                                       | Critical |  ❌ Fail   | **0 files** use `import 'server-only'`; `lib/fraud/fraud-detection.service.ts:1` uses `'use server'` instead. (Next.js 16 supports `import 'server-only'` natively without adding a package.)                                                                                                                                              | **P0-b** (§3.2) · **T1-c** (§4.3)                   |
| **BND-02** | Strict `NEXT_PUBLIC_` Environment Auditing                             | Critical |  ✅ Pass   | Only 3 `NEXT_PUBLIC_*` vars exist in source (`NEXT_PUBLIC_AUTH_BRIDGE_ENABLED`, `NEXT_PUBLIC_SOCKET_CHAT_URL`, `NEXT_PUBLIC_MT5_WS_URL`); none are secrets.                                                                                                                                                                                | **Compliant**                                       |
| **BND-03** | Enforce Environment Access Boundary                                    |   High   |  ❌ Fail   | Client files read `process.env.NEXT_PUBLIC_*` directly in `components/auth/login-form.tsx:269-271`, `lib/socket-client.ts:43`, `hooks/use-ohlcv-socket.ts:76`, `lib/auth/auth-bridge-flag.ts:22` (low-risk tidiness item).                                                                                                                 | **T2-c** (§5.3)                                     |
| **BND-04** | Enable React Taint Protection                                          |  Medium  |  ❌ Fail   | Not enabled. **Deferred by consensus:** `experimental.taint: true` switches `app/` onto React's experimental channel (`taint.md`). Use `select` projections (`T2-c`) instead.                                                                                                                                                              | **Deferred** (§1.1)                                 |
| **BND-05** | Sanitize Docker & Build Artifacts                                      |   High   | ⚠️ Partial | `.dockerignore:25-45` excludes `.env*` and `.git`. App deploys to Vercel (`output: 'standalone'` and root `Dockerfile` not used today).                                                                                                                                                                                                    | **N/A on Vercel**                                   |
| **AUT-01** | Never Rely on Middleware as Sole Security Boundary                     | Critical |  ❌ Fail   | `middleware.ts:141-147` fails open on error; `/terminal` and `/free` are missing from `PROTECTED_PREFIXES` (`L42-57`); **8 `app/admin/**`RSC pages** lack page-level`requireAdmin()`checks (relying on`app/admin/layout.tsx:194-215`and`middleware.ts:116-124`).                                                                           | **T1-e** (§4.5)                                     |
| **AUT-02** | Re-authorize Inside Every Server Action & Route                        | Critical |  ❌ Fail   | (1) `POST /api/test/seed` (`app/api/test/seed/route.ts:68-80`) falls back to `'test-secret'`; (2) `lib/fraud/fraud-detection.service.ts:1` (`'use server'`, latent); (3) `GET /api/disbursement/health` (`app/api/disbursement/health/route.ts:39-151`) is unauthenticated and triggers `provider.authenticate()` (`L62-66`) on every hit. | **P0-a** (§3.1) · **P0-b** (§3.2) · **T1-e** (§4.5) |
| **AUT-03** | Enforce Resource Ownership Checks (Prevent IDOR)                       | Critical |  ✅ Pass   | User-facing dynamic `[id]` routes scope queries by `session.user.id`. (`app/admin/users/[id]/page.tsx` is covered under `AUT-01` / **T1-e**).                                                                                                                                                                                              | **Compliant**                                       |
| **AUT-04** | Treat Route Params & SearchParams as Hostile Input                     | Critical | ⚠️ Partial | Admin BI pages pass `searchParams` into analytics queries without page-level auth (`T1-e`). View-as cookies (`lib/admin/user-view-as.ts:157-170`) are bound to the authenticated admin's own `session.user.id` and `role === 'ADMIN'`.                                                                                                     | **T1-e** (§4.5)                                     |
| **AUT-05** | Cache User Session Queries via `React.cache`                           |  Medium  |  ❌ Fail   | Zero uses of `React.cache()` in `lib/auth/session.ts` or anywhere in the repo.                                                                                                                                                                                                                                                             | **T2-a** (§5.1)                                     |
| **ACT-01** | Validate All Input Arguments with Schemas                              | Critical |  ❌ Fail   | `appearance.ts` and `locale.ts` validate inputs, and `app/dev/report2/actions.ts` refuses in production first (`world.ts:186-195`), but `lib/fraud/fraud-detection.service.ts:1` has `'use server'` without input validation.                                                                                                              | **P0-b** (§3.2)                                     |
| **ACT-02** | Filter Server Action Return Values                                     |   High   | ⚠️ Partial | `appearance.ts` and `locale.ts` return `{ success: boolean }`; `fraud-detection.service.ts` returns raw rows (resolved by removing `'use server'` in **P0-b**).                                                                                                                                                                            | **P0-b** (§3.2)                                     |
| **ACT-03** | Pin Multi-Server Encryption Key (`NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`) |   High   |  ❌ Fail   | Managed automatically by Vercel per deployment; only needed if self-hosting multi-instance containers in the future.                                                                                                                                                                                                                       | **N/A on Vercel**                                   |
| **ACT-04** | Audit `.bind()` Arguments                                              |   High   |  ✅ Pass   | Zero Server Actions use `.bind()`.                                                                                                                                                                                                                                                                                                         | **Compliant**                                       |
| **ACT-05** | Configure Allowed Origins for Reverse Proxies                          |   High   | ⚠️ Partial | Next.js compares `Origin` with `Host` / `X-Forwarded-Host` automatically; `allowedOrigins` is only needed if an alternate front domain is introduced.                                                                                                                                                                                      | **Low / Optional**                                  |
| **ACT-06** | Zero Side-Effects in Server Component Rendering                        | Critical |  ✅ Pass   | All RSC Prisma calls are read-only except `incrementTutorialViewCount(id)` in `app/(marketing)/academy/[id]/page.tsx:78`, which moves to `after()` in **T2-a**.                                                                                                                                                                            | **T2-a** (§5.1)                                     |
| **ACT-07** | Implement Action Rate Limiting & Abuse Protection                      |   High   |  ❌ Fail   | `saveAppearanceAction` (`app/actions/appearance.ts:20-64`, idempotent single-row upsert per user) and `syncLocaleCookiesAction` (cookies only) have no rate limit (low risk).                                                                                                                                                              | **Low** (§7.3)                                      |
| **RTE-01** | Explicit Method Handlers Only                                          |   High   |  ✅ Pass   | All **148** `app/api/**/route.ts` files export explicit HTTP verb handlers (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`).                                                                                                                                                                                                                      | **Compliant**                                       |
| **RTE-02** | Manual CSRF & Origin Verification on Custom Endpoints                  |   High   |  ❌ Fail   | `lib/csrf.ts:18,22-26` accepts `http://${host}` in production, returns `true` when `!origin`, and uses `origin.startsWith(allowed)` (enabling **Login CSRF** on `POST /api/auth/token-login`). Non-GET `/api/**` routes lack a central origin check against sibling `.davintrade.app` subdomains.                                          | **P0-d** (§3.4) · **T1-f** (§4.6)                   |
| **RTE-03** | Use Matcher Allowlists in Middleware / Proxy                           |   High   | ⚠️ Partial | `middleware.ts:42-61` omits `/terminal` and `/free` from `PROTECTED_PREFIXES` (use segment-aware matching so `/free` does not match `/freebies`).                                                                                                                                                                                          | **T1-e** (§4.5)                                     |
| **RTE-04** | In-App Request Screening & Rate Limiting                               |  Medium  |  ❌ Fail   | `checkAuthRateLimit` (`lib/rate-limit.ts:137`) and `checkTierRateLimit` (`L151`) have 0 callers. Note: in production, `/api/user/2fa/*` and `/api/user/password` forward to `operation-service`, which is directly reachable by the browser (§7.3).                                                                                        | **Section 7** (§7.3)                                |
| **INP-01** | Parameterize All SQL / NoSQL Queries                                   | Critical | ⚠️ Partial | Active Prisma raw queries are parameterized/safe. Unused file `lib/candle-data-helpers.ts:181-196` interpolates `FROM ${symbol}_${timeframe}` and has **0 importers**—delete the file.                                                                                                                                                     | **T2-c** (§5.3)                                     |
| **INP-02** | Restrict & Sanitize `dangerouslySetInnerHTML`                          | Critical |  ✅ Pass   | Only 2 occurrences in `app/layout.tsx:137,146` with static CSS and allowlist-validated values escaped via `.replace(/</g, '\\u003c')`.                                                                                                                                                                                                     | **Compliant**                                       |
| **INP-03** | Validate URL Redirect Targets (Open Redirect)                          |   High   |  ❌ Fail   | `lib/auth/auth-options.ts:656-658` trusts `targetHost.endsWith('.vercel.app')` (any third-party Vercel subdomain) and `localhost`/`127.0.0.1` in production.                                                                                                                                                                               | **P0-c** (§3.3)                                     |
| **INP-04** | Sanitize Dynamic SVG & File Uploads                                    |   High   |  ❌ Fail   | Admin-only upload (`app/api/admin/resources/route.ts:84`) allows `'image/svg+xml'` (`lib/marketing-resources/validators.ts:36-42`) stored on `*.public.blob.vercel-storage.com` without `contentDisposition: 'attachment'` (`lib/marketing-resources/storage.ts:27-34`).                                                                   | **T2-e** (§5.5)                                     |
| **HDR-01** | Content-Security-Policy (CSP)                                          | Critical | ⚠️ Partial | `next.config.js:133,137` includes `'unsafe-eval'` (not needed in Next.js production builds, `content-security-policy.md:42`) and `http://localhost:3001 ws://localhost:3001` in production `connect-src`.                                                                                                                                  | **T2-e** (§5.5)                                     |
| **HDR-02** | Strict-Transport-Security (HSTS)                                       |   High   |  ✅ Pass   | `next.config.js:111-114` sets `max-age=31536000; includeSubDomains; preload` (bump to `63072000` / 2 years in **T2-e**).                                                                                                                                                                                                                   | **Compliant** (§5.5)                                |
| **HDR-03** | X-Content-Type-Options                                                 |  Medium  |  ✅ Pass   | `next.config.js:103-105` sets `nosniff`.                                                                                                                                                                                                                                                                                                   | **Compliant**                                       |
| **HDR-04** | Referrer-Policy                                                        |  Medium  |  ✅ Pass   | `next.config.js:107-109` sets `strict-origin-when-cross-origin`.                                                                                                                                                                                                                                                                           | **Compliant**                                       |
| **HDR-05** | Permissions-Policy                                                     |  Medium  |  ✅ Pass   | `next.config.js:116-120` sets `camera=(), microphone=(), geolocation=(), interest-cohort=()`.                                                                                                                                                                                                                                              | **Compliant**                                       |
| **HDR-06** | Clickjacking Mitigation                                                |   High   |  ✅ Pass   | `next.config.js:99-101` sets `X-Frame-Options: SAMEORIGIN` and CSP `frame-ancestors 'self'` (`L139`).                                                                                                                                                                                                                                      | **Compliant**                                       |
| **HDR-07** | Omit Deprecated Headers                                                |   Low    |  ❌ Fail   | `next.config.js:122-125` sets deprecated `X-XSS-Protection: 1; mode=block`.                                                                                                                                                                                                                                                                | **T2-e** (§5.5)                                     |
| **ERR-01** | Strict `NODE_ENV=production` in Deployments                            | Critical |  ✅ Pass   | `next build` inlines `NODE_ENV=production` and `next.config.js:76-85` disables `poweredByHeader` and `productionBrowserSourceMaps`.                                                                                                                                                                                                        | **Compliant**                                       |
| **ERR-02** | Sanitize Thrown Error Messages                                         |   High   |  ❌ Fail   | `app/error.tsx:43` renders raw client `{error.message}`; 6 API routes (`dlocal/create`, `disbursement/pay`, `disbursement/batches/[batchId]/execute`, `test/seed`, `webhooks/stripe`, `admin/active-indicator`) return raw `error.message` or `String(error)` (`⚠` 4 are money routes).                                                   | **T2-d** (§5.4)                                     |
| **ERR-03** | Correlate Client Digest with Server Logs                               |  Medium  | ⚠️ Partial | `app/global-error.tsx:24-48` loads the dictionary in `useEffect` (`L35-47`) but never logs `error` or `error.digest`.                                                                                                                                                                                                                      | **T2-d** (§5.4)                                     |
| **OPS-01** | Lockfile Integrity & Audit Gate                                        | Critical |  ❌ Fail   | `.github/workflows/dependencies-security.yml:63-75` uses `continue-on-error: true` and `\|\| echo` (`--no-frozen-lockfile` at `L66-67` is deliberate for `pnpm.overrides`; must coordinate with `.claude/rules/security-overrides.md`).                                                                                                    | **T3-e** (§6.5)                                     |
| **OPS-02** | Automated Dependency Updates                                           |   High   |  ❌ Fail   | No `.github/dependabot.yml` or `renovate.json` exists.                                                                                                                                                                                                                                                                                     | **T3-e** (§6.5)                                     |
| **OPS-03** | Automated Secret Scanning                                              | Critical | ⚠️ Partial | `.github/workflows/security-checks.yml:95,101,107` only greps 3 patterns (`sk_live_`, `AKIA`, `ghp_`) on `*.ts`/`*.tsx`/`*.js`.                                                                                                                                                                                                            | **T3-e** (§6.5)                                     |
| **OPS-04** | Enforce Strict Static Analysis                                         |   High   | ⚠️ Partial | `tsconfig.json:34-77` is strict, but `eslint.config.mjs:59-76` disables `no-explicit-any`, `explicit-function-return-type`, and `no-console` across app directories.                                                                                                                                                                       | **T3-e** (§6.5)                                     |
| **OPS-05** | Periodic Penetration Testing & DAST                                    |  Medium  |  ❌ Fail   | No automated DAST workflow in `.github/workflows/`.                                                                                                                                                                                                                                                                                        | **T3-e** (§6.5)                                     |

---

### 2.2 Stability & Performance Matrix (Verified Against Live Code & Tests)

|     ID     | Category & Topic                                                                                |   Severity   | Verified Live Codebase Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                       | Assigned Unit                                              |
| :--------: | :---------------------------------------------------------------------------------------------- | :----------: | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------- |
| **STB-01** | Outbound Read/Write Request Timeouts & Plain-HTTP `ip-api.com`                                  | **Critical** | No timeouts on `callOperationService*` / `forwardRequestToOperationService*` (`lib/operation-service/client.ts:61,114,150`), `callMoneyService*` / `forwardWriteRequestToMoneyService` (`lib/money-service/client.ts:49`), `DLocalPaymentService` (`lib/dlocal/dlocal-payment.service.ts:109,204`), R2 `S3Client` (`lib/storage/r2.ts:52,126,167`), or plain-HTTP `http://ip-api.com` calls (`lib/security/device-detection.ts:159`, `lib/geo/detect-country.ts:24`). | **T1-a** (§4.1 Reads) · **T1-a-writes** (§4.1 Writes `⚠`) |
| **STB-02** | AI Reply Gateway Primary Timeout Retry vs. 55s Deadline (**D23 / ADR-099**)                     |   **High**   | `lib/reply/gateway/openrouter.ts:69-73,486-491,553-569` retries a `25s` primary timeout immediately (`25s + 25s = 50s`) against `lib/reply/orchestrator.ts:102`'s `55s` deadline, starving the `20s` fallback in `lib/reply/gateway/fallback.ts:80-99`.                                                                                                                                                                                                               | **T1-b** (§4.2 `⚠` D23)                                   |
| **STB-03** | Prisma `connectionTimeoutMillis` / Per-Instance Pool `max` & Redis `commandTimeout`             |   **High**   | `PrismaPg` (`lib/db/prisma.ts:31-34`, `lib/db/market-prisma.ts:23-26`) leaves `connectionTimeoutMillis` at `0` (wait forever when pool is exhausted) and `max` at `10` per serverless instance; `lib/redis/client.ts:11-27` omits `commandTimeout` and `connectTimeout`.                                                                                                                                                                                              | **T1-d** (§4.4)                                            |
| **STB-04** | Client Polling Abort Race, Background Tab Polling & Segment `error.tsx`                         |  **Medium**  | `use-currency-index-chart.ts:87-90` calls `setData(EMPTY_DATA)` even when `controller.signal.aborted` is `true`; polling hooks lack `document.visibilityState` pause checks; only 1 root `app/error.tsx` exists across 114 pages.                                                                                                                                                                                                                                     | **T3-c** (§6.3) · **T3-d** (§6.4)                          |
| **PRF-01** | Per-Request `React.cache()` Deduplication                                                       |   **High**   | `0` uses of `React.cache()`. Every authenticated page render runs session JWE decryption 3–4x and `prisma.userAppearance.findUnique` (`getServerAppearance`) 2x across `app/layout.tsx` and child layouts; `app/(marketing)/academy/[id]/page.tsx:46,72` runs `getPublishedTutorialById` (`lib/tutorials/service.ts:210`) twice.                                                                                                                                      | **T2-a** (§5.1)                                            |
| **PRF-02** | Contract-Safe `Promise.all()` Waterfalls & Academy `after()`                                    |   **High**   | Parallelizable independent reads in Engine 4 (`lib/engine4/read/cycle.ts:224,244,339`), Intake (`lib/intake/read/snapshot.ts:526,535`), Reply (`lib/reply/orchestrator.ts:363-400`, `lib/reply/server/state-api.ts:126-138`), and 5 Admin BI pages (`app/admin/dashboards/*/page.tsx`); blocking write `incrementTutorialViewCount` in `app/(marketing)/academy/[id]/page.tsx:78`.                                                                                    | **T2-a** (§5.1) · **T2-b** (§5.2)                          |
| **PRF-03** | Static Locale Dictionary Bundle (**1.4 MB raw / 328 KB gzip**), `next/dynamic` & Marketing RSCs |   **High**   | `lib/context/locale-context.tsx:45-59` statically bundles `th.json` (666 KB), `en-GB.json` (374 KB), and `en-US.json` (374 KB) into every page; `lightweight-charts` and `recharts` modals/charts are statically imported; 8 purely static marketing pages are marked `'use client'` solely for `useLocale()`.                                                                                                                                                        | **T3-a** (§6.1) · **T3-b** (§6.2)                          |

---

## 3. Phase 0 (P0) — Immediate Production Security & Auth Hotfixes (4 Single-Unit Orders)

> **Execution Rule (Non-Negotiable #2):** Each unit below (`P0-a` through `P0-d`) is an independent, single-concern verifiable order with its own `Decisions taken`.

### Unit P0-a — `⚠` Delete `app/api/test/seed/route.ts` & Verify Production DB (`AUT-02` — CRITICAL)

- **Governance Gate:** `⚠ NEEDS EXPLICIT SIGN-OFF` (touches authentication / admin account creation).
- **Decisions Taken:**
  1. Because zero live GitHub Actions workflows or Playwright configs call `/api/test/seed` (verified: only archived `e2e/archive/global.setup.ts:32-35` references it), **delete `app/api/test/seed/route.ts`** rather than keeping a dead test-seeding endpoint in the production build.
  2. Remove the corresponding allow-list entry `'app/api/test/seed/route.ts'` from [`__tests__/lib/systemconfig-figures-guard.test.ts:124`](../__tests__/lib/systemconfig-figures-guard.test.ts).
- **Why Deletion Is Critical:**
  - `next build` inlines `process.env.NODE_ENV` as `"production"`, so `POST /api/test/seed` (`L68-72`) relies solely on `process.env['TEST_SECRET'] || 'test-secret'`. When `TEST_SECRET` is unset, any caller sending `x-test-secret: test-secret` seeds:
    - `admin-test@trading-alerts.test` (`role: 'ADMIN'`, password `AdminPassword123!`, `L34-39, 95-116`) — a live database admin login since `bd67b30c` removed it from `FIXED_TEST_ACCOUNTS`;
    - `pro-test@trading-alerts.test` with an unpaid `ACTIVE` PRO subscription (`L126-145`);
    - an `ACTIVE` `AffiliateProfile` (`L147-171`) and two live checkout discount codes `TESTCODE10` (10% off) and `TESTCODE20` (20% off, 20% commission, `L178-213`).
- **Read-Only Production Verification for Davin:**
  - Run against the production database:
    ```sql
    SELECT id, email, role, tier, "isActive", "createdAt" FROM "User" WHERE email LIKE '%@trading-alerts.test';
    SELECT code, status, "discountPercent", "commissionPercent" FROM "AffiliateCode" WHERE code IN ('TESTCODE10', 'TESTCODE20');
    ```
  - If any rows exist, deactivate/delete them immediately.

---

### Unit P0-b — Replace `'use server'` with `import 'server-only'` & Prune Dead Code in `lib/fraud/fraud-detection.service.ts` (`BND-01`, `AUT-02`, `ACT-01`, `ACT-02` — HIGH LATENT)

- **Governance Gate:** Standard order approval (no live behavior change; only `app/api/admin/fraud-alerts/route.ts` and `app/api/admin/fraud-alerts/[id]/route.ts` import this file).
- **Decisions Taken:**
  1. Replace `'use server';` at [`lib/fraud/fraud-detection.service.ts:1`](../lib/fraud/fraud-detection.service.ts) with `import 'server-only';` (supported natively by Next.js 16 and mapped automatically by `next/jest` without installing any package).
  2. Delete the 3 unused exported functions (`runFraudChecks` at `L216`, `createFraudAlerts` at `L253`, `detectAndAlertFraud` at `L283`, and their private helper functions `checkMultiple3DayAttempts`, `checkVelocityLimit`, `checkIpCountryMismatch`, `checkMultipleFailedPayments`, `checkDeviceFingerprintChange` if unreferenced by tests) that have zero callers in the codebase. Keep `getFraudAlerts` (`L322`), `getFraudAlertStats` (`L380`), `updateFraudAlertStatus` (`L418`), and `blockUserFromFraudAlert` (`L440`).

---

### Unit P0-c — `⚠` Fix NextAuth `redirect` Callback Open Redirect (`INP-03` — HIGH)

- **Governance Gate:** `⚠ NEEDS EXPLICIT SIGN-OFF` (modifies [`lib/auth/auth-options.ts:643-666`](../lib/auth/auth-options.ts)).
- **Decisions Taken:**
  1. Do **not** delegate to `safeCallbackUrl(url, '')`, because `safeCallbackUrl` rejects `/login`, `/register`, and `/verify-2fa` (`lib/auth/safe-callback-url.ts:24,56-63`).
  2. For relative URLs (`url.startsWith('/')`), allow when `!url.startsWith('//') && !url.includes('\\')`, returning `${baseUrl}${url}`.
  3. For absolute URLs:
     - Require exact origin match (`targetUrl.protocol === currentBase.protocol && targetHost === baseHost` with `^www\.` stripped, preserving apex/www equivalence).
     - Remove the blanket `targetHost.endsWith('.vercel.app')` check (`L656`). Instead, when `process.env['VERCEL_ENV'] === 'preview'`, allow exact hostname matches against `process.env['VERCEL_URL']` and `process.env['VERCEL_BRANCH_URL']` over `https:`.
     - Allow `localhost` and `127.0.0.1` **only** when `(Reflect.get(process.env, 'NODE_ENV') ?? process.env.NODE_ENV) !== 'production'`.
  4. Add unit tests covering relative paths, `//evil.com`, `/\evil.com`, `/login`, apex/www equivalence, `https://evil.vercel.app` rejection, preview `VERCEL_URL` acceptance, and `localhost` rejection in production.

---

### Unit P0-d — `⚠` Fix `lib/csrf.ts` Prefix Bypass (Login CSRF) & Add Unit Tests (`RTE-02` — HIGH)

- **Governance Gate:** `⚠ NEEDS EXPLICIT SIGN-OFF` (protects unauthenticated login/register/password-reset routes in `app/api/auth/*`).
- **Decisions Taken:**
  1. Change signature to `export async function validateOrigin(request?: Request): Promise<boolean>` in [`lib/csrf.ts`](../lib/csrf.ts), reading `request.headers` when a `Request` is passed and falling back to `await headers()` from `next/headers` otherwise.
  2. Build `allowedOrigins` using exact origin strings (`new URL(process.env.NEXTAUTH_URL).origin` and `https://${host}` in production; allow `http://${host}` **only** when `(Reflect.get(process.env, 'NODE_ENV') ?? process.env.NODE_ENV) !== 'production'`). Support apex/www equivalence matching `auth-options.ts`.
  3. Replace `origin.startsWith(allowed)` (`L26`) with exact parsed origin comparison (`new URL(origin).origin === allowedOrigin`), closing the `https://davintrade.app.attacker.com` Login CSRF vector on `POST /api/auth/token-login`.
  4. When `!origin`: check `Sec-Fetch-Site`. If `Sec-Fetch-Site` is `'cross-site'` or `'same-site'` (since `.davintrade.app` session cookies are shared across sibling subdomains), return `false`; if absent (non-browser / server-to-server / unit test `new Request(...)` without headers) or `'same-origin'` / `'none'`, return `true`.
  5. Create `__tests__/lib/csrf.test.ts` testing exact match, suffix spoof (`davintrade.app.attacker.com`), port mismatch, `http://` rejection in production, apex vs `www`, and missing `Origin` with `Sec-Fetch-Site: cross-site`, `same-site`, `same-origin`, and absent.

---

## 4. Tier 1 — Stability, Server Boundary Enforcement & Defense-in-Depth Auth (Single-Unit Orders)

### Unit T1-a — Outbound Read Timeouts, R2 Socket Timeouts & `ip-api` Hardening (`STB-01` — HIGH)

- **Scope:** Read-only outbound calls and infrastructure client timeouts (zero write-duplication risk).
- **Decisions Taken:**
  1. **`operation-service` & `money-service` Read Helpers:** Add a `5_000ms` `AbortController` timeout (mapped to a typed `TIMEOUT` / HTTP `504`, following [`lib/active-indicator/gateway-client.ts:288-311`](../lib/active-indicator/gateway-client.ts)) on `GET`/`HEAD` calls in [`lib/operation-service/client.ts`](../lib/operation-service/client.ts) (`callOperationService`, `forwardRequestToOperationService`) and [`lib/money-service/client.ts`](../lib/money-service/client.ts) (`callMoneyService`), and on `DLocalPaymentService.getPaymentStatus` (`lib/dlocal/dlocal-payment.service.ts:204`).
  2. **Cloudflare R2 (`lib/storage/r2.ts:52`):** Configure connection and socket timeouts via `requestHandler` on `new S3Client(...)` (e.g., `connectionTimeout: 3_000`, `requestTimeout: 10_000`) rather than a short wall-clock `AbortSignal` that could cut `getChartImage`'s `transformToByteArray()` stream (`L177`) mid-download.
  3. **Plain-HTTP `ip-api.com` Removal / Timeout (`lib/security/device-detection.ts:159`, `lib/geo/detect-country.ts:24`):** Both files currently send user IP addresses in cleartext over `http://ip-api.com/json/...` with **no timeout** on the 2FA, password, and login-tracking paths (and `ip-api.com`'s free tier does not support HTTPS). Prefer reading Vercel's edge geolocation headers (`x-vercel-ip-country`, `x-vercel-ip-city`, `cf-ipcountry`) first, or switch to an HTTPS geo endpoint with a strict `1_500ms` `AbortSignal.timeout` so a stalled geo lookup never delays login or 2FA verification.

### Unit T1-a-writes — `⚠` Outbound Write Timeouts & Idempotency Alignment (`STB-01` — HIGH)

- **Governance Gate:** `⚠ NEEDS EXPLICIT SIGN-OFF` (touches proxied writes in `operation-service`, `money-service`, `DLocalPaymentService.createPayment`, and `lib/stripe/stripe.ts`).
- **Decisions Taken:**
  1. Set a longer write timeout (`15_000ms`, exceeding downstream transaction budgets) on non-GET calls in `callOperationService*`, `forwardRequestToOperationService*`, `callMoneyService*`, `forwardWriteRequestToMoneyService`, and `DLocalPaymentService.createPayment` (`lib/dlocal/dlocal-payment.service.ts:109`), with **no automatic retry** on timeout.
  2. Set `timeout: 15_000` and `maxNetworkRetries: 1` on `new Stripe(...)` in [`lib/stripe/stripe.ts:41-44`](../lib/stripe/stripe.ts) (Stripe SDK automatically attaches idempotency keys to retries), and add a 1-hour TTL to `proPriceCache` (`L61`).

### Unit T1-b — `⚠` Amend Decision D23 (ADR-099): No Primary Retry on Timeout in AI Reply Gateway (`STB-02` — HIGH)

- **Governance Gate:** `⚠ NEEDS EXPLICIT SIGN-OFF` (amends settled Decision **D23** in [`docs/adr/099-prompt-and-reply-as-built-in-step-7.md:103-105`](../docs/adr/099-prompt-and-reply-as-built-in-step-7.md)).
- **Decisions Taken:**
  1. Keep D23's timeouts unchanged (`ANSWER_TIMEOUT_MS = 25_000`, `FALLBACK_TIMEOUT_MS = 20_000` in [`lib/reply/gateway/fallback.ts:80-99`](../lib/reply/gateway/fallback.ts), `REPLY_DEADLINE_MS = 55_000` in [`lib/reply/orchestrator.ts:102`](../lib/reply/orchestrator.ts)).
  2. In [`lib/reply/gateway/openrouter.ts:486-491, 553-569`](../lib/reply/gateway/openrouter.ts), **do not retry when the primary attempt fails with `TIMEOUT`**: immediately return the timeout failure so `fallback.ts` invokes the secondary vendor (`25s + 20s = 45s < 55s`). Keep the 1 retry (`GATEWAY_RETRIES = 1`) for fast `429` / `5xx` / network errors with a `250ms` jittered delay.
  3. Update the doc comment at `openrouter.ts:25-29`, ADR-099 D23, and the unit tests in `__tests__/lib/reply/gateway/{fallback,openrouter}.test.ts`.

### Unit T1-c — Enforce `import 'server-only'` Across Server Modules & Update Stack D Boundary Guards (`BND-01` — HIGH)

- **Governance Gate:** Standard order approval (no `package.json` changes needed).
- **Decisions Taken:**
  1. Use Next.js 16's built-in `server-only` handling (`data-security.md:255`) and `next/jest`'s built-in mock (`next/dist/build/jest/jest.js:187-188`) — **do not install `server-only` in `package.json`**.
  2. Update the 3 Stack D boundary guard suites first:
     - [`__tests__/lib/engine4/exactness-guard.test.ts:142-176`](../__tests__/lib/engine4/exactness-guard.test.ts): add `'server-only'` to `SERVER_IMPORTS`, `STORE_IMPORTS`, and `READER_IMPORTS`.
     - [`__tests__/lib/reply/boundaries.test.ts`](../__tests__/lib/reply/boundaries.test.ts) and [`__tests__/lib/intake/boundaries.test.ts:414-457`](../__tests__/lib/intake/boundaries.test.ts): treat `'server-only'` as an allowed side-effect import in non-pure server folders (`read/`, `server/`, `store/`, `lib/platform/**`, `lib/reply/gateway/**`), skipping it in both the AST check and the regex `"exactly"` check while still forbidding it in pure files. Add self-test assertions for both allowed (`server/`) and forbidden (pure) cases.
  3. Add `import 'server-only';` to server-only modules across `lib/{db,redis,storage,auth,admin,affiliate,operation-service,money-service,stripe,disbursement}/**`, `lib/dlocal/{currency-converter,dlocal-payment,payment-methods,three-day-validator}.service.ts` (**excluding** `lib/dlocal/constants.ts`, which 4 Client Components import by value), and the non-pure Stack D folders (`lib/{engine4,intake,reply}/{server,store,read,gateway}/**`, `lib/intake/knowledge-client.ts`, `lib/platform/**`).

### Unit T1-d — Prisma `connectionTimeoutMillis` / Pool `max` & Redis `commandTimeout` (`STB-03` — HIGH)

- **Target Files:** [`lib/db/prisma.ts:31-50`](../lib/db/prisma.ts), [`lib/db/market-prisma.ts:23-42`](../lib/db/market-prisma.ts), [`lib/redis/client.ts:11-27`](../lib/redis/client.ts)
- **Decisions Taken:**
  1. In `lib/db/prisma.ts` and `lib/db/market-prisma.ts`, pass `connectionTimeoutMillis: 5_000`, `idleTimeoutMillis: 30_000`, and a conservative per-serverless-instance `max: 5` to `new PrismaPg(...)` (since each Vercel instance creates its own pool behind PgBouncer), and move `new PrismaPg(...)` inside a lazy factory function so dev HMR does not re-create adapters.
  2. In `lib/redis/client.ts:11-27`, attach `redisClient` to `globalThis` for dev HMR hygiene and add `connectTimeout: 5_000` and `commandTimeout: 3_000` to `REDIS_OPTIONS` (do **not** set `enableOfflineQueue: false`, which breaks the initial command under `lazyConnect: true`).

### Unit T1-e — `⚠` Admin RSC Page-Level Guard, Disbursement Health Lockdown & Middleware Prefixes (`AUT-01`, `AUT-02`, `RTE-03` — HIGH)

- **Governance Gate:** `⚠ NEEDS EXPLICIT SIGN-OFF` (touches admin authorization, `middleware.ts`, and disbursement health).
- **Decisions Taken:**
  1. Create a `React.cache()`-wrapped `requireAdminPage()` helper (verifying session + `role === 'ADMIN'`, redirecting non-admins) and call it in the 8 admin Server Component pages (`app/admin/dashboards/{affiliates,executive,regional,revenue,users}/page.tsx`, `app/admin/system/{config-history,outbox}/page.tsx`, `app/admin/users/[id]/page.tsx`) as defense-in-depth behind `middleware.ts` and `app/admin/layout.tsx`.
  2. In [`app/api/disbursement/health/route.ts:39-151`](../app/api/disbursement/health/route.ts), check for an authenticated admin session (or internal service token): for anonymous callers, skip `provider.authenticate()` (`L62-66`) and detailed Prisma counts, returning only `{ status: 'healthy' | 'unhealthy' }` based on `SELECT 1`. Update the `GET /api/disbursement/health` test suite accordingly.
  3. In [`middleware.ts:42-61`](../middleware.ts), add `/terminal` and `/free` to `PROTECTED_PREFIXES` using segment-boundary matching (`pathname === prefix || pathname.startsWith(prefix + '/')`) so `/free` matches `/free` and `/free/...` without matching a future `/freebies` route.

### Unit T1-f — `⚠` Central CSRF Enforcement in `middleware.ts` for Non-GET `/api/**` (`RTE-02` — HIGH)

- **Governance Gate:** `⚠ NEEDS EXPLICIT SIGN-OFF` (replaces Draft 1 Unit 1.6; protects all cookie-authenticated `/api/**` mutations from sibling-subdomain CSRF without touching Stack D closed error catalogues).
- **Decisions Taken:**
  1. In [`middleware.ts`](../middleware.ts) (**outside** the fail-open `try` block at `L87-147`), when `targetPathname.startsWith('/api/')` and `request.method` is not `GET`, `HEAD`, or `OPTIONS`, and `targetPathname` is not in `CSRF_EXEMPT_API_PREFIXES`:
     - Verify `await validateOrigin(request)`. If `false`, return `csrfErrorResponse()` (`403`).
  2. Define `CSRF_EXEMPT_API_PREFIXES` explicitly from the live route inventory (machine-to-machine callers authenticated by signatures or secrets, not cookies):
     - `/api/webhooks/stripe`
     - `/api/webhooks/dlocal`
     - `/api/webhooks/riseworks`
     - `/api/cron/`
     - `/api/admin/system/jobs/` (API-key / secret triggered)
     - `/api/auth/[...nextauth]` OAuth POST callbacks if any external IdP uses `response_mode=form_post` (verify OAuth providers: Google, GitHub, Twitter/X, LinkedIn all use GET query callbacks).

---

## 5. Tier 2 — Server-Side Performance, DTO Minimization & Error/Header Hardening (Single-Unit Orders)

### Unit T2-a — `React.cache()` Per-Request Deduplication & Academy `after()` (`AUT-05`, `ACT-06`, `PRF-01` — HIGH)

- **Decisions Taken:**
  1. Wrap in `cache(...)` from `'react'`:
     - `getSession()` in [`lib/auth/session.ts:29`](../lib/auth/session.ts) (deduplicates JWE decryption across root layout, segment layout, and page)
     - `getAffiliateProfile()` in [`lib/auth/session.ts:168`](../lib/auth/session.ts)
     - `getServerAppearance()` in [`lib/appearance/server-appearance.ts:24`](../lib/appearance/server-appearance.ts) (eliminates duplicate `prisma.userAppearance.findUnique` between `app/layout.tsx:93` and child layouts)
     - `getServerLanguage()` and `getServerLocalePreferences()` in [`lib/i18n/server-locale.ts:65,73`](../lib/i18n/server-locale.ts)
     - `getAdminViewAs()` in [`lib/affiliate/view-as.ts:141`](../lib/affiliate/view-as.ts) and primitive-keyed `loadUserViewAsTarget(userId)` in [`lib/admin/user-view-as.ts:132`](../lib/admin/user-view-as.ts) (since `getAdminUserViewAs(sessionUser)` takes an object reference)
     - `getPublishedTutorialById(id)` in [`lib/tutorials/service.ts:210`](../lib/tutorials/service.ts) (deduplicates `generateMetadata` at `L46` and `TutorialDetailPage` at `L72` in `app/(marketing)/academy/[id]/page.tsx`).
  2. Replace direct `getServerSession(authOptions)` calls in `app/{dashboard,alerts,free,notifications,pro/currency-index,terminal,settings,admin}/layout.tsx`, `app/admin/disbursement/layout.tsx`, and `app/{dashboard,terminal,free,pro/currency-index,pro/currency-index/compare}/page.tsx` with the cached `getSession()`.
  3. In [`app/(marketing)/academy/[id]/page.tsx:78`](../app/%28marketing%29/academy/%5Bid%5D/page.tsx), wrap `incrementTutorialViewCount(id)` inside Next.js `after()` (`from 'next/server'`).

### Unit T2-b — Contract-Safe `Promise.all()` Waterfall Elimination (`PRF-02` — HIGH)

- **Decisions Taken (Verified Against Stack D Contracts & Test Suites in Review §5 Q5):**
  1. **Engine 4 [`lib/engine4/read/cycle.ts:224-343`](../lib/engine4/read/cycle.ts) (`readOfferSnapshot`):** Run `newestRow` (`L224`), `pinnedRow` (`L244`), and `cycleRow` (`L339`) in `Promise.all()` (starting calls in today's order and merging per-branch `problems` arrays in today's deterministic order after the join), then run `zoneRows` (`L294`) once `pinnedRow` is validated. _(Do not touch `loadWorld` or `loadDetailForStyle`.)_
  2. **Intake [`lib/intake/read/snapshot.ts:526-541`](../lib/intake/read/snapshot.ts) (`readSnapshot`):** Run `readSensorRows(pinned.slot, traderType)` and `readSynthesis(pinned.slot, traderType)` in `Promise.all()` using separate `problems` arrays concatenated in today's order. _(Do not touch `pipeline.ts`, `gate.ts`, or `readSynthesis` internal queries.)_
  3. **Reply [`lib/reply/orchestrator.ts:360-410`](../lib/reply/orchestrator.ts) & [`lib/reply/server/state-api.ts:124-145`](../lib/reply/server/state-api.ts):** In `orchestrator.ts`, run `ports.dayBars(packet.data.cycle_slot)` concurrently with `ports.threads.context`, then run `ports.previousStates` and `readChart` concurrently in `Promise.all()`. In `state-api.ts`, run `deps.ledger.balance` concurrently with `deps.profile(userId)`.
  4. **Admin BI & Monolith Pages/Routes:** Wrap independent `getServerLocalePreferences()` + `getDisplayUsdRates()` + analytics/Prisma reads in `Promise.all()` across `app/admin/dashboards/{executive,revenue,regional,affiliates,users}/page.tsx`, `app/admin/users/[id]/page.tsx:94-106`, `app/dashboard/page.tsx:51-87`, `app/alerts/{page,new/page,[id]/edit/page}.tsx`, `app/affiliate/dashboard/payouts/page.tsx:61-90`, `app/api/user/login-history/route.ts:90-114`, and `app/api/user/security-alerts/route.ts:72-91`.

### Unit T2-c — Prisma `select` Projections, Affiliate `paymentDetails` Scrubbing & Dead SQL File Deletion (`DAL-01`–`DAL-05`, `INP-01` — HIGH)

- **Decisions Taken:**
  1. Add explicit `select` clauses to `prisma.user.findUnique` in [`app/api/subscription/route.ts:119-131`](../app/api/subscription/route.ts), [`app/api/subscription/cancel/route.ts:79-96,127-137`](../app/api/subscription/cancel/route.ts), [`app/api/payments/dlocal/create/route.ts:122-132`](../app/api/payments/dlocal/create/route.ts), [`app/api/user/profile/route.ts:131-133`](../app/api/user/profile/route.ts), [`app/api/auth/forgot-password/route.ts:41`](../app/api/auth/forgot-password/route.ts), and [`app/api/auth/resend-verification/route.ts:28`](../app/api/auth/resend-verification/route.ts) so `password`, `twoFactorSecret`, and `twoFactorBackupCodes` are never loaded into memory.
  2. Omit `paymentDetails` from the `GET` and `PUT`/`POST` JSON responses in [`app/api/affiliate/profile/route.ts:82,180`](../app/api/affiliate/profile/route.ts) (verified unused by `app/affiliate/dashboard/profile/page.tsx`).
  3. Delete dead file [`lib/candle-data-helpers.ts`](../lib/candle-data-helpers.ts) (0 importers; contains unparameterized `FROM ${tableName}` SQL interpolation at `L181-196`).

### Unit T2-d — `⚠` Sanitize Client & API Error Responses + `global-error.tsx` Logging (`ERR-02`, `ERR-03` — HIGH)

- **Governance Gate:** `⚠ NEEDS EXPLICIT SIGN-OFF` (touches 4 money/webhook routes: `dlocal/create`, `disbursement/pay`, `disbursement/batches/[batchId]/execute`, and `webhooks/stripe`).
- **Decisions Taken:**
  1. In [`app/error.tsx:43`](../app/error.tsx), replace `{error.message || t('errors.page.unexpected', ...)}` with `t('errors.page.unexpected', ...)` (matching `app/global-error.tsx:68-71`), keeping `error.digest`.
  2. In [`app/global-error.tsx`](../app/global-error.tsx), log `error` and `error.digest` via `console.error` / `logError` inside `useEffect`.
  3. In [`app/api/payments/dlocal/create/route.ts:320-323`](../app/api/payments/dlocal/create/route.ts), [`app/api/disbursement/pay/route.ts:163-167`](../app/api/disbursement/pay/route.ts), [`app/api/disbursement/batches/[batchId]/execute/route.ts:114-118`](../app/api/disbursement/batches/%5BbatchId%5D/execute/route.ts), [`app/api/webhooks/stripe/route.ts:112-115`](../app/api/webhooks/stripe/route.ts), and [`app/api/admin/active-indicator/route.ts:86`](../app/api/admin/active-indicator/route.ts), log the full error server-side and return fixed generic error messages to the caller.

### Unit T2-e — `⚠` Security Headers, Production CSP & Marketing Asset Upload Hardening (`HDR-01`, `HDR-02`, `HDR-07`, `INP-04` — HIGH)

- **Governance Gate:** `⚠ NEEDS EXPLICIT SIGN-OFF` (modifies CSP/security headers in [`next.config.js`](../next.config.js)).
- **Decisions Taken:**
  1. Remove `'X-XSS-Protection': '1; mode=block'` from [`next.config.js:122-125`](../next.config.js) (`HDR-07`).
  2. Bump `Strict-Transport-Security` (`next.config.js:113`) to `max-age=63072000; includeSubDomains; preload` (2 years, `HDR-02`).
  3. In `next.config.js:133,137` (`Content-Security-Policy`):
     - Include `'unsafe-eval'` in `script-src` and `http://localhost:3001 ws://localhost:3001` in `connect-src` **only** when `process.env.NODE_ENV !== 'production'` (`content-security-policy.md:42`). Verify TradingView and Stripe embeds in a production build (`npm run build && npm start`).
  4. In [`lib/marketing-resources/storage.ts:27-34`](../lib/marketing-resources/storage.ts), add `contentDisposition: 'attachment'` and sanitize `file.name` when uploading to Vercel Blob (`INP-04`).

---

## 6. Tier 3 — Client Bundle Optimization, Polling Hygiene & CI Gates (Single-Unit Orders)

### Unit T3-a — Locale Dictionary Chunk Splitting (1.4 MB Raw / 328 KB Gzip) & Chart `next/dynamic` (`PRF-03` — HIGH)

- **Decisions Taken:**
  1. **Per-Language Dictionary Chunk Loading (`lib/context/locale-context.tsx:45-59`):**
     - Replace the 3 static imports (`th.json` 666 KB, `en-GB.json` 374 KB, `en-US.json` 374 KB = **~1.4 MB raw / ~328 KB gzip on every page**) with cacheable per-language dynamic `import()` chunks (using `en-US` as a small diff overlay over `en-GB`), preloading/resolving only the active language so first paint remains translated without re-serializing ~145 KB gzip across RSC props on every `router.refresh()`. Add a test verifying runtime language switching without page reload.
  2. **Chart & Modal `next/dynamic`:**
     - Wrap closed-by-default modals (`HrmaSmmaDetailModal`, `PairChartModal` in [`components/currency-index-pro/pro-currency-index-cockpit.tsx:24-29`](../components/currency-index-pro/pro-currency-index-cockpit.tsx)) and heavy chart canvases (`RelativeStrengthChart`, `CurrencyIndexComparisonChart`, `XauxUsdxComparisonChart`, `HistoricalTrendChart`) in `next/dynamic(..., { ssr: false })` with fixed-height skeletons to prevent layout shift.
     - For `DonutMarketShare` in [`app/admin/dashboards/regional/page.tsx:1`](../app/admin/dashboards/regional/page.tsx) (which is a Server Component where `ssr: false` is forbidden by Next.js 16 `lazy-loading.md:94-95`), place the `next/dynamic(..., { ssr: false })` call inside a small Client Component wrapper.

### Unit T3-b — Convert Static `'use client'` Marketing Pages to Server Components (`PRF-03` — MEDIUM)

- **Decisions Taken:**
  1. **Batch 1 (8 Purely Static Pages):** Convert `app/(marketing)/{about,careers,changelog,disclaimer,pricing,privacy,terms}/page.tsx` and `app/affiliate/join/page.tsx` from `'use client'` + `useLocale()` to async Server Components using `getDictionary(await getServerLanguage())` (matching [`app/(marketing)/academy/page.tsx:77-78`](../app/%28marketing%29/academy/page.tsx)).
  2. **Batch 2 (Landing Page `<Suspense>` & 6 Interactive Marketing Pages):** Narrow the `<Suspense>` boundary in [`app/(marketing)/page.tsx:26-36`](../app/%28marketing%29/page.tsx) to wrap only `<LandingPricing />`, and extract the interactive state/handlers of `blog`, `docs`, `econ-news`, `help`, `xaux-vs-usdx`, and `affiliate` into small leaf Client Components.

### Unit T3-c — Client Polling Abort Fix & Background-Tab Pause Guards (`STB-04` — MEDIUM)

- **Decisions Taken:**
  1. In [`components/currency-index-pro/hooks/use-currency-index-chart.ts:87-90`](../components/currency-index-pro/hooks/use-currency-index-chart.ts), guard `setData(EMPTY_DATA)` behind `if (controller.signal.aborted) return;` so rapid currency/timeframe switches or unmounts do not wipe active chart data.
  2. Add `document.visibilityState === 'hidden'` pause checks and in-flight overlap guards (matching [`lib/fx/use-display-usd-rates.ts:159,197`](../lib/fx/use-display-usd-rates.ts)) to `use-currency-index-chart.ts`, `use-currency-index-screener.ts`, `useEventMarkers.ts`, `useUpcomingEvents.ts`, and `useContainmentRates.ts`.

### Unit T3-d — Segment-Level `error.tsx` & `loading.tsx` Boundaries (`STB-04` — MEDIUM)

- **Decisions Taken:**
  - Add segment-level `error.tsx` (and missing `loading.tsx`) boundaries to `app/admin/dashboards/`, `app/affiliate/dashboard/`, `app/terminal/`, `app/free/`, and `app/pro/currency-index/` so segment failures render an inline recovery card inside the navigation layout rather than unmounting the whole app via root `app/error.tsx`.

### Unit T3-e — CI/CD Audit Gate, Secret Scanning & Dependabot (`OPS-01`–`OPS-04` — MEDIUM)

- **Decisions Taken:**
  1. Coordinate `.github/workflows/dependencies-security.yml:63-75` with `.claude/rules/security-overrides.md` (`check-overrides.yml`, `lockfile-regen.yml`) so `pnpm audit --prod --audit-level=high` acts as a real blocking gate while keeping `pnpm.overrides` intact.
  2. Expand `.github/workflows/security-checks.yml:87-117` to scan for private keys (`-----BEGIN`), Resend keys (`re_`), Vercel Blob tokens (`vercel_blob_rw_`), and credentialed database URLs across tracked text files.
  3. Add `.github/dependabot.yml` for weekly security alerts (`OPS-02`).

---

## 7. Separate Owner Decisions for Davin (Not Scheduled as Orders Yet)

Claude Code's review identified 5 cross-cutting architectural/product questions that require Davin's explicit policy decision before drafting orders for them:

1. **Realtime Socket Handshake Token (`app/api/realtime/token/route.ts:21-28` — `⚠` Re-opens Decision F8 Q4):**
   - Today, `GET /api/realtime/token` returns `getOperationServiceToken()`, which is the raw 30-day `httpOnly` session JWE cookie value (`lib/operation-service/client.ts:179-187`), exposing it to JavaScript (`hooks/use-realtime-socket.ts`). By contrast, `GET /api/chat/token` (`app/api/chat/token/route.ts:10-40`) mints a short-lived 300s JWT scoped strictly to the socket handshake.
   - _Question for Davin:_ Should `/api/realtime/token` (and `operation-service`'s `RealtimeGateway`) switch to a short-lived 300s handshake JWT like `/api/chat/token`, or keep F8 Q4 as built?
2. **PII Email Logging in NextAuth Callbacks (`lib/auth/auth-options.ts:551, 625` — `⚠` Auth):**
   - `auth-options.ts:625` logs `console.log('[Session] Built session for user:', session.user.email, ...)` on every session build, writing plaintext user emails into production logs on every request.
   - _Question for Davin:_ Approve removing plaintext email logging (or replacing `session.user.email` with `token.id`) in `lib/auth/auth-options.ts:551,625`?
3. **Where 2FA & Password Rate Limiting Lives (`operation-service` vs. Monolith Fallback — `⚠` Auth):**
   - With `MIGRATE_USER_2FA=true` and `MIGRATE_USER_PROFILE=true`, `/api/user/2fa/*` and `POST /api/user/password` forward to `operation-service`, which is also directly reachable by browsers (`connect-src` includes `operation-service-production.up.railway.app`). Rate-limiting must therefore be enforced primarily in `operation-service` (NestJS Tier 3 §8.6), while `lib/rate-limit.ts` in Next.js only covers the flag-off fallback and forgot/reset-password routes.
   - Additionally, in `lib/rate-limit.ts:86`, `zadd(key, now, `${now}`)` uses the millisecond timestamp as the sorted-set member (colliding on same-millisecond bursts) and has no `try/catch` around `pipeline.exec()`.
   - _Question for Davin:_ When Redis is unreachable or throws, should `lib/rate-limit.ts` fail **open** (allow request through) or fail **closed** (`503` / `429`) on auth/2FA routes?
4. **Vercel Preview Database Isolation & Function `maxDuration` Inventory:**
   - Confirm whether Vercel Preview deployments connect to a separate staging/preview database or share the production database (since `FIXED_TEST_ACCOUNTS` is enabled when `VERCEL_ENV === 'preview'` in `lib/auth/auth-options.ts:223-260`), and confirm the Vercel plan's `maxDuration` limit before executing `T1-a-writes`.
5. **Next.js 16 `middleware.ts` → `proxy.ts` Migration (`upgrading/version-16.md:588-613`):**
   - Next.js 16 deprecates `middleware.ts` in favor of `proxy.ts` (running on the Node.js runtime). Schedule as a dedicated standalone unit after `T1-e` and `T1-f` are complete.

---

## 8. Master Single-Unit Execution Schedule

Each row below is **one session = one verifiable unit of work** (Non-Negotiable #2):

|    Order ID     | Unit Title                                                                                                         |        Sign-Off Gate         | Primary Files Touched                                                                                                                                                                                                                             |
| :-------------: | :----------------------------------------------------------------------------------------------------------------- | :--------------------------: | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
|    **P0-a**     | Delete `app/api/test/seed/route.ts` & check prod DB                                                                | `⚠ NEEDS EXPLICIT SIGN-OFF` | `app/api/test/seed/route.ts` (delete), `__tests__/lib/systemconfig-figures-guard.test.ts:124`                                                                                                                                                     |
|    **P0-b**     | Replace `'use server'` with `import 'server-only'` & prune dead fraud functions                                    |           Standard           | `lib/fraud/fraud-detection.service.ts`                                                                                                                                                                                                            |
|    **P0-c**     | Fix NextAuth `redirect` callback `.vercel.app` open redirect                                                       | `⚠ NEEDS EXPLICIT SIGN-OFF` | `lib/auth/auth-options.ts:643-666`, `__tests__/lib/auth/`                                                                                                                                                                                         |
|    **P0-d**     | Fix `lib/csrf.ts` exact origin match (`validateOrigin(request?)`) + unit tests                                     | `⚠ NEEDS EXPLICIT SIGN-OFF` | `lib/csrf.ts`, `__tests__/lib/csrf.test.ts` (new)                                                                                                                                                                                                 |
|    **T1-a**     | Outbound read timeouts (5s), R2 `requestHandler` timeouts & `ip-api` fix                                           |           Standard           | `lib/operation-service/client.ts`, `lib/money-service/client.ts`, `lib/dlocal/dlocal-payment.service.ts`, `lib/storage/r2.ts`, `lib/security/device-detection.ts`, `lib/geo/detect-country.ts`                                                    |
| **T1-a-writes** | Outbound write timeouts (>=15s) & Stripe client timeout/TTL                                                        | `⚠ NEEDS EXPLICIT SIGN-OFF` | `lib/operation-service/client.ts`, `lib/money-service/client.ts`, `lib/dlocal/dlocal-payment.service.ts`, `lib/stripe/stripe.ts`                                                                                                                  |
|    **T1-b**     | Amend D23 (ADR-099): no primary retry on timeout in OpenRouter gateway                                             | `⚠ NEEDS EXPLICIT SIGN-OFF` | `lib/reply/gateway/openrouter.ts`, `docs/adr/099-prompt-and-reply-as-built-in-step-7.md`, `__tests__/lib/reply/gateway/`                                                                                                                          |
|    **T1-c**     | Add `import 'server-only'` across server modules + Stack D guard test updates                                      |           Standard           | `__tests__/lib/{engine4,intake,reply}/*guard*.test.ts`, `lib/**` server files (excluding `lib/dlocal/constants.ts` and pure Stack D files)                                                                                                        |
|    **T1-d**     | Prisma `connectionTimeoutMillis` (5s) / `max` (5) & Redis `commandTimeout` (3s)                                    |           Standard           | `lib/db/prisma.ts`, `lib/db/market-prisma.ts`, `lib/redis/client.ts`                                                                                                                                                                              |
|    **T1-e**     | Admin RSC `requireAdminPage()`, disbursement health bare status & middleware prefixes                              | `⚠ NEEDS EXPLICIT SIGN-OFF` | `app/admin/**` (8 RSC pages), `app/api/disbursement/health/route.ts`, `middleware.ts`                                                                                                                                                             |
|    **T1-f**     | Central CSRF check in `middleware.ts` for non-GET `/api/**` (with machine exemptions)                              | `⚠ NEEDS EXPLICIT SIGN-OFF` | `middleware.ts`, `__tests__/middleware.test.ts`                                                                                                                                                                                                   |
|    **T2-a**     | `React.cache()` deduplication on session/appearance/locale/tutorials + Academy `after()`                           |           Standard           | `lib/auth/session.ts`, `lib/appearance/server-appearance.ts`, `lib/i18n/server-locale.ts`, `lib/affiliate/view-as.ts`, `lib/admin/user-view-as.ts`, `lib/tutorials/service.ts`, `app/(marketing)/academy/[id]/page.tsx`, layouts/pages            |
|    **T2-b**     | Contract-safe `Promise.all()` waterfall elimination (Stack D readers + Admin BI pages)                             |           Standard           | `lib/engine4/read/cycle.ts`, `lib/intake/read/snapshot.ts`, `lib/reply/orchestrator.ts`, `lib/reply/server/state-api.ts`, `app/admin/dashboards/*/page.tsx`, `app/dashboard/page.tsx`, `app/alerts/**`                                            |
|    **T2-c**     | Prisma `select` on `User` reads, omit `paymentDetails` in affiliate profile, delete `candle-data-helpers.ts`       |           Standard           | `app/api/subscription/**`, `app/api/payments/dlocal/create/route.ts`, `app/api/user/profile/route.ts`, `app/api/auth/{forgot-password,resend-verification}/route.ts`, `app/api/affiliate/profile/route.ts`, `lib/candle-data-helpers.ts` (delete) |
|    **T2-d**     | Sanitize raw `error.message` in `app/error.tsx` & 6 API routes + `global-error.tsx` logging                        | `⚠ NEEDS EXPLICIT SIGN-OFF` | `app/error.tsx`, `app/global-error.tsx`, `app/api/payments/dlocal/create/route.ts`, `app/api/disbursement/**`, `app/api/webhooks/stripe/route.ts`, `app/api/admin/active-indicator/route.ts`                                                      |
|    **T2-e**     | Security headers (`X-XSS-Protection` off, HSTS 2y, prod CSP without `'unsafe-eval'`/`localhost`) & Blob attachment | `⚠ NEEDS EXPLICIT SIGN-OFF` | `next.config.js`, `lib/marketing-resources/storage.ts`                                                                                                                                                                                            |
|    **T3-a**     | Dynamic locale dictionary chunks (-1.4 MB raw) & `next/dynamic` for charts/modals                                  |           Standard           | `lib/context/locale-context.tsx`, `components/currency-index-pro/**`, `components/currency-index-comparison/**`, `components/market/**`, `components/admin/analytics/**`                                                                          |
|    **T3-b**     | Convert static `'use client'` marketing pages to Server Components + narrow Landing `<Suspense>`                   |           Standard           | `app/(marketing)/**`, `app/affiliate/{page,join/page}.tsx`                                                                                                                                                                                        |
|    **T3-c**     | Fix `use-currency-index-chart.ts` abort race & add `visibilityState` pause guards                                  |           Standard           | `components/currency-index-pro/hooks/**`, `components/charts/drawing/useEventMarkers.ts`, `components/market-sessions/**`                                                                                                                         |
|    **T3-d**     | Add segment-level `error.tsx` and `loading.tsx` boundaries                                                         |           Standard           | `app/admin/dashboards/`, `app/affiliate/dashboard/`, `app/terminal/`, `app/free/`, `app/pro/currency-index/`                                                                                                                                      |
|    **T3-e**     | CI dependency audit gate (coordinated with overrides), secret scan & Dependabot                                    |           Standard           | `.github/workflows/{dependencies-security,security-checks}.yml`, `.github/dependabot.yml`                                                                                                                                                         |

---

## 9. Verification Baselines & Commands

Every session executing an order from this plan must verify and report exit codes and test counts against the live repository baselines ([`.claude/protocols/verification-checklist.md`](../.claude/protocols/verification-checklist.md)):

- **TypeScript Type Check (Source):**
  - `npx tsc --noEmit` (must exit `0` with `0` errors)
- **ESLint:**
  - `npx eslint <touched-files> --max-warnings 0` (must exit `0`)
- **Jest Test Suite (539 test files listed by `npx jest --listTests`; re-baseline count at session open):**
  - Targeted unit/integration suites for touched modules (`npx jest <path>`)
  - Full suite check before phase closeout (`npm test`)
- **Operating Docs & Sensor Kit Integrity (only when applicable):**
  - `node scripts/agents/check-operating-docs.mjs` (when operating docs are touched)
  - `npm --prefix railway-gateway run check:sensor-kit` (only if `railway-gateway/sensors/` or sensor kit files are touched)
- **Production Build & Browser Verification (for UI / `next.config.js` / CSP / RSC changes):**
  - `npm run build` (must exit `0`)
  - Browser verification at desktop and mobile viewports (`320px`, `375px`, `1280px`) for `T2-e`, `T3-a`, `T3-b`, and `T3-d`.
