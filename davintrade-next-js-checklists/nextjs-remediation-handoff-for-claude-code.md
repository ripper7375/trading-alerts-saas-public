# Next.js 16 Production Remediation — Multi-Session Implementation Plan & Handoff for Claude Code

- **Document Role:** Canonical Execution Handoff & Multi-Session Implementation Guide
- **Target Executor:** Claude Code (Next.js 16 / Full-Stack Executor)
- **Architectural Reviewer & Advisor:** Antigravity
- **Project Owner:** Davin
- **Date:** 2026-10-17
- **Target Runtime:** Next.js `16.4.1` (App Router) · React `19.3.0` · TypeScript `5.9` · Node.js `>=20`
- **Companion Reference Documents:**
  - Consensus Master Plan: [`davintrade-next-js-checklists/nextjs-production-remediation-master-plan.md`](./nextjs-production-remediation-master-plan.md)
  - Cross-Session Progress & Handoff Log: [`davintrade-next-js-checklists/nextjs-remediation-session-log.md`](./nextjs-remediation-session-log.md)
  - Claude Code Architectural Review: [`davintrade-next-js-checklists/nextjs-production-remediation-recommend-by-claude-code.md`](./nextjs-production-remediation-recommend-by-claude-code.md)
  - Baseline Security Checklist: [`davintrade-next-js-checklists/NEXTJS_SECURITY_CHECKLIST.md`](./NEXTJS_SECURITY_CHECKLIST.md)
  - Repository Non-Negotiables: [`.claude/rules/non-negotiables.md`](../.claude/rules/non-negotiables.md)
  - Verification Checklist: [`.claude/protocols/verification-checklist.md`](../.claude/protocols/verification-checklist.md)

---

## 1. Executive Summary: Total Phases, Parts (Sessions) & Units

To remediate all Security, Stability, and Performance findings without overwhelming context limits or mixing unrelated architectural domains, the consensus Master Plan is structured into:

- **4 Phases** (`Phase 1: P0`, `Phase 2: Tier 1`, `Phase 3: Tier 2`, `Phase 4: Tier 3`)
- **8 Parts / Claude Code Sessions** (`Session 1` through `Session 8`)
- **21 Atomic Execution Units** (`P0-a` through `T3-e`)

| Phase       | Phase Focus                                                         | Parts / Sessions                    | Units Included                                   |  Est. Effort   |
| :---------- | :------------------------------------------------------------------ | :---------------------------------- | :----------------------------------------------- | :------------: |
| **Phase 1** | **P0 — Immediate Production Security & Auth Hotfixes**              | **Part 1A (Session 1)**             | `P0-a`, `P0-b`, `P0-c`, `P0-d` (4 units)         |   1 Session    |
| **Phase 2** | **Tier 1 — Stability, Server Boundaries & Defense-in-Depth Auth**   | **Parts 2A, 2B, 2C (Sessions 2–4)** | `T1-a`, `T1-a-writes`, `T1-b`..`T1-f` (7 units)  |   3 Sessions   |
| **Phase 3** | **Tier 2 — Server-Side Performance, DTOs & Error/Header Hardening** | **Parts 3A, 3B (Sessions 5–6)**     | `T2-a`, `T2-b`, `T2-c`, `T2-d`, `T2-e` (5 units) |   2 Sessions   |
| **Phase 4** | **Tier 3 — Client Bundle Optimization, Polling Hygiene & CI Gates** | **Parts 4A, 4B (Sessions 7–8)**     | `T3-a`, `T3-b`, `T3-c`, `T3-d`, `T3-e` (5 units) |   2 Sessions   |
| **Total**   | **Full Next.js 16 Production Remediation**                          | **8 Sessions**                      | **21 Atomic Units**                              | **8 Sessions** |

---

## 2. Operating Protocol, Cross-Session Continuity & Architecture Guardrails

Before writing any code in any session, Claude Code **must** observe these rules:

1. **Cross-Session Continuity via `nextjs-remediation-session-log.md`:**
   - **At Session Start:** Always read [`davintrade-next-js-checklists/nextjs-remediation-session-log.md`](./nextjs-remediation-session-log.md) first, plus `git status --short`. Verify that all prerequisite units from earlier sessions are marked `[x]` and review the **Handoff Notes for Next Session** written by the previous Claude Code session.
   - **Scope Discipline:** Execute **only** the Session / Part explicitly assigned in Davin's prompt for the current session. Do not start subsequent sessions automatically.
   - **At Session End:** Update [`davintrade-next-js-checklists/nextjs-remediation-session-log.md`](./nextjs-remediation-session-log.md) before finishing (mark completed units `[x]` and fill in the session's handoff report section as specified in Section 7 of this document).
2. **Read Next.js 16 Installed Docs First (`CLAUDE.md` / `AGENTS.md` Rule):**
   - Before touching Next.js routing, caching, headers, or `middleware.ts`, inspect the relevant doc under `node_modules/next/dist/docs/` (specifically `01-app/02-guides/redirecting.md`, `01-app/03-api-reference/04-functions/after.md`, `01-app/03-api-reference/04-functions/cacheLife.md`, and `01-app/02-guides/upgrading/version-16.md`).
3. **Preserve Working Tree & Do Not Commit Without Instruction:**
   - Never run `git stash`, `git reset --hard`, or `git checkout --`. Preserve any untracked files or edits from prior sessions.
   - Commit or push **only** when Davin explicitly instructs you to do so.
4. **Checkpoint After Each Atomic Unit Within a Session:**
   - Each session contains 1 to 4 cohesive units (`Order ID`). Complete, type-check (`npx tsc --noEmit`), lint (`npx eslint <touched-files> --max-warnings 0`), and run targeted Jest tests after **each individual unit** before starting the next unit in that session.
5. **Explicit Owner Sign-Off Gates (`⚠`):**
   - Units marked `⚠ NEEDS EXPLICIT SIGN-OFF` touch auth/session (`lib/auth/*`, `lib/csrf.ts`, `middleware.ts`, `app/admin/**`), payment/disbursement/Stripe/OpenRouter callers (`lib/money-service/*`, `lib/dlocal/*`, `lib/stripe/*`, `lib/reply/gateway/*`, `app/api/disbursement/*`, `app/api/webhooks/stripe/*`), or global CSP/security headers (`next.config.js`).
   - When Davin's session prompt explicitly states `"I explicitly authorize the ⚠ NEEDS EXPLICIT SIGN-OFF gates for: ..."`, treat that instruction as the explicit owner sign-off for those exact units. Do not widen scope beyond the listed files.
6. **Critical Codebase Invariants (Do Not Violate):**
   - **`server-only` in Next.js 16:** Next.js `16.4.1` and `next/jest` natively resolve `'server-only'` via `node_modules/next/dist/compiled/server-only/` and `next/dist/build/jest/__mocks__/empty.js`. Do **not** add `server-only` to `package.json` unless you are coordinating a full lockfile update under `.claude/rules/security-overrides.md`.
   - **Shared Client/Server Files:** Never add `import 'server-only'` to `lib/dlocal/constants.ts` (imported by `'use client'` components `CountrySelector.tsx`, `CurrencySelector.tsx`, `PaymentMethodSelector.tsx`, `PriceDisplay.tsx`) or to pure Stack D directories (`lib/engine4/{types,constants,contracts,canon,sort,validate,select,cross}`, `lib/intake/{types,constants,contracts,normalize,validate}`, `lib/reply/{types,constants,contracts,canon,validate,prompt,state,errors}.ts`).
   - **Stack C Proxy Behavior:** When `MIGRATE_*` flags are `"true"`, proxied Next.js route handlers (`app/api/alerts/**`, `app/api/watchlist/**`, `app/api/user/**`, `app/api/admin/**`, `app/api/payments/**`, `app/api/disbursement/**`) do **not** fall back to local Prisma on throw (`app/api/alerts/route.ts:168-174`). Outbound timeouts fail fast with HTTP `504` (`Gateway timeout`).

---

## 3. Phase 1 Detailed Implementation Guide — Part 1A (Session 1: `P0-a` to `P0-d`)

### Unit `P0-a` (`⚠`): Delete `app/api/test/seed/route.ts` & Update Guard Test

- **Why:** In Next.js production builds (`next build`), `process.env.NODE_ENV` is inlined as `"production"`, so `const isDev = process.env.NODE_ENV !== 'production'` (`app/api/test/seed/route.ts:36`) is `false`, making the hardcoded fallback `const testSecret = process.env.TEST_SEED_SECRET || 'test-secret'` (`L37-39`) the active production code path. Any external caller sending `x-test-secret: test-secret` can seed:
  - `admin@test.com` (`role: 'ADMIN'`, known password `TestPassword123!`)
  - `pro@test.com` (`tier: 'PRO'`, active subscription)
  - `free@test.com` with active `AffiliateProfile` (`AFFILIATE123`)
  - Discount codes `TESTCODE10` and `TESTCODE20`
- **Verified Callers:** Zero runtime, E2E, or script callers (`grep -rn "api/test/seed" .`). Only referenced in `__tests__/lib/systemconfig-figures-guard.test.ts:124`.
- **Implementation Steps:**
  1. Delete `app/api/test/seed/route.ts`. (If `app/api/test/seed` and `app/api/test` become empty directories, remove the empty directories.)
  2. Open `__tests__/lib/systemconfig-figures-guard.test.ts` around line 124 and remove `'app/api/test/seed/route.ts'` from the `ALLOWED_TEST_FILES` (or equivalent allowlist) array.
  3. Include the following read-only SQL verification query in your Session 1 report so Davin can verify production DB hygiene:

     ```sql
     SELECT id, email, role, tier, "createdAt"
     FROM "User"
     WHERE email IN ('free@test.com', 'pro@test.com', 'admin@test.com');

     SELECT id, code, status, "createdAt"
     FROM "DiscountCode"
     WHERE code IN ('TESTCODE10', 'TESTCODE20');
     ```

- **Unit Verification:**
  - `npx jest __tests__/lib/systemconfig-figures-guard.test.ts` (must pass)
  - `npx tsc --noEmit` (must exit `0`)

---

### Unit `P0-b`: Replace `'use server'` with `import 'server-only'` & Prune Dead Fraud Functions

- **Why:** `lib/fraud/fraud-detection.service.ts:1` has `'use server'` at the top of the file. In Next.js App Router, a top-level `'use server'` directive exposes **every exported `async` function** in that module as a directly invokable HTTP Server Action endpoint (`Next-Action` POST). While `getFraudAlerts` (`L322`), `getFraudAlertStats` (`L380`), `updateFraudAlertStatus` (`L418`), and `blockUserFromFraudAlert` (`L440`) call `requireAdmin()`, the first three exported functions (`runFraudChecks:216`, `createFraudAlerts:253`, `detectAndAlertFraud:283`) have **zero auth checks** and **zero callers anywhere in the repository** (live fraud detection runs inside `app/api/affiliate/register/route.ts` and `lib/Affiliation/commission.service.ts`). Furthermore, none of the functions in this file are called from Client Components—they are only called from Server Route Handlers `app/api/admin/fraud-alerts/**`.
- **Implementation Steps:**
  1. Open `lib/fraud/fraud-detection.service.ts`.
  2. Replace line 1 (`'use server';`) with `import 'server-only';`.
  3. Delete the 3 unused exported functions (`runFraudChecks`, `createFraudAlerts`, `detectAndAlertFraud`) and their private helper functions (`checkMultipleAccountsFromSameIP`, `checkRapidConversions`, `checkSelfReferral`, `checkUnusualPaymentPatterns`, `checkCommissionSpike`) after confirming via `grep` that nothing in `app/`, `lib/`, `components/`, or `__tests__/` imports them.
  4. Keep `getFraudAlerts` (`L322`), `getFraudAlertStats` (`L380`), `updateFraudAlertStatus` (`L418`), `blockUserFromFraudAlert` (`L440`), and any types/interfaces used by those four functions or by `app/api/admin/fraud-alerts/**`.
- **Unit Verification:**
  - `npx tsc --noEmit`
  - `npx eslint lib/fraud/fraud-detection.service.ts --max-warnings 0`
  - `npx jest __tests__/api/admin/fraud` (or any fraud-related test files)

---

### Unit `P0-c` (`⚠`): Fix NextAuth `redirect` Callback Open Redirect (`lib/auth/auth-options.ts:643-666`)

- **Why:** `lib/auth/auth-options.ts:654-656` contains `if (targetHost.endsWith('.vercel.app')) return url;`, which allows open redirects after login/OAuth to **any attacker-controlled `*.vercel.app` domain**. Additionally, `url.startsWith(baseUrl)` (`L662`) is a prefix check rather than an exact origin match (`https://davintrade.app.attacker.com` matches `url.startsWith('https://davintrade.app')`), and `localhost` is unconditionally allowed in production (`L658-660`).
- **Critical Design Constraint:** Do **NOT** delegate the NextAuth `redirect` callback to `safeCallbackUrl(url, '')` (`lib/auth/callback-url.ts:44-69`), because `safeCallbackUrl` rejects `/login`, `/register`, and `/verify-2fa` via `AUTH_PATH_PREFIXES`, whereas `lib/auth/errors.ts:242`, `app/admin/users/[id]/page.tsx:53`, `app/(dashboard)/alerts/page.tsx:55`, and `app/affiliate/dashboard/*/page.tsx` legitimately redirect to `/login?callbackUrl=...` and `/verify-2fa`.
- **Implementation Steps:**
  1. Open `lib/auth/auth-options.ts` at lines `643-666` (`async redirect({ url, baseUrl })`).
  2. Implement the hardened `redirect` callback:

     ```ts
     async redirect({ url, baseUrl }) {
       // 1. Allow safe relative paths starting with a single '/' (no protocol-relative '//' or backslashes)
       if (url.startsWith('/') && !url.startsWith('//') && !url.includes('\\')) {
         return `${baseUrl}${url}`;
       }

       try {
         const target = new URL(url);
         const base = new URL(baseUrl);

         // 2. Exact origin match against baseUrl
         if (target.origin === base.origin) {
           return url;
         }

         // 3. Preserve apex <-> www equivalence on the same protocol & port
         const normalizeWww = (host: string) => host.replace(/^www\./i, '');
         if (
           target.protocol === base.protocol &&
           target.port === base.port &&
           normalizeWww(target.hostname) === normalizeWww(base.hostname)
         ) {
           return url;
         }

         // 4. Preview-only exact Vercel deployment hostname match (never blanket *.vercel.app)
         if (process.env.VERCEL_ENV === 'preview') {
           const allowedPreviewHosts = [
             process.env.VERCEL_URL,
             process.env.VERCEL_BRANCH_URL,
           ].filter((h): h is string => Boolean(h));

           if (
             target.protocol === 'https:' &&
             allowedPreviewHosts.includes(target.host)
           ) {
             return url;
           }
         }

         // 5. Non-production localhost / 127.0.0.1 allowance
         const nodeEnv =
           Reflect.get(process.env, 'NODE_ENV') ?? process.env.NODE_ENV;
         if (
           nodeEnv !== 'production' &&
           (target.hostname === 'localhost' || target.hostname === '127.0.0.1')
         ) {
           return url;
         }
       } catch {
         // Fall through to baseUrl on malformed URLs
       }

       return baseUrl;
     },
     ```

  3. Add unit tests covering the `redirect` callback (in `__tests__/lib/auth/`):
     - Allows `/login?callbackUrl=%2Fdashboard`, `/verify-2fa`, `/dashboard`
     - Rejects `//evil.com`, `/\evil.com`
     - Rejects `https://evil-phishing.vercel.app`
     - Rejects `https://davintrade.app.evil.com`
     - Allows `https://www.davintrade.app/dashboard` when `baseUrl` is `https://davintrade.app`
     - Allows exact `VERCEL_URL` / `VERCEL_BRANCH_URL` only when `VERCEL_ENV === 'preview'`
     - Rejects `http://localhost:3000/callback` when `NODE_ENV === 'production'`

- **Unit Verification:**
  - `npx tsc --noEmit`
  - `npx eslint lib/auth/auth-options.ts --max-warnings 0`
  - `npx jest __tests__/lib/auth`

---

### Unit `P0-d` (`⚠`): Fix `lib/csrf.ts` Exact Origin Match (`validateOrigin(request?)`) + Unit Tests

- **Why:** `lib/csrf.ts:9-27` currently checks `origin.startsWith(allowed)` (`L25`), so `Origin: https://davintrade.app.attacker.com` passes validation for `https://davintrade.app`. Because `POST /api/auth/token-login` (`app/api/auth/token-login/route.ts:36`) calls `validateOrigin()` before minting a session cookie, this prefix bug creates a **Login CSRF** vulnerability (an attacker can force a victim's browser into the attacker's account). It also allows `http://${host}` unconditionally in production (`L24`) and returns `true` when `!origin` (`L16`) without checking `Sec-Fetch-Site`.
- **Implementation Steps:**
  1. Open `lib/csrf.ts`.
  2. Update `validateOrigin` to accept an optional `request?: Request` (so both Route Handlers calling `validateOrigin()` with no arguments and `middleware.ts` in `T1-f` calling `validateOrigin(request)` work seamlessly):

     ```ts
     import { headers } from 'next/headers';

     export async function validateOrigin(request?: Request): Promise<boolean> {
       const reqHeaders = request ? request.headers : await headers();
       const origin = reqHeaders.get('origin');
       const host =
         reqHeaders.get('x-forwarded-host') || reqHeaders.get('host');

       if (!origin) {
         const secFetchSite = reqHeaders.get('sec-fetch-site');
         // Reject cross-site or sibling-subdomain requests that strip/omit Origin.
         // Note: 'same-site' is rejected because .davintrade.app session cookies are shared across subdomains.
         if (secFetchSite === 'cross-site' || secFetchSite === 'same-site') {
           return false;
         }
         return true;
       }

       if (!host) {
         return false;
       }

       let parsedOrigin: URL;
       try {
         parsedOrigin = new URL(origin);
       } catch {
         return false;
       }

       const nodeEnv =
         Reflect.get(process.env, 'NODE_ENV') ?? process.env.NODE_ENV;
       const allowedOrigins = new Set<string>([`https://${host}`]);
       if (nodeEnv !== 'production') {
         allowedOrigins.add(`http://${host}`);
       }

       return allowedOrigins.has(parsedOrigin.origin);
     }
     ```

  3. Create `__tests__/lib/csrf.test.ts` testing:
     - Exact match `Origin: https://davintrade.app` with `Host: davintrade.app` → `true`
     - Prefix-spoof `Origin: https://davintrade.app.attacker.com` with `Host: davintrade.app` → `false`
     - Subdomain `Origin: https://sub.davintrade.app` with `Host: davintrade.app` → `false`
     - Protocol downgrade `Origin: http://davintrade.app` in `NODE_ENV=production` → `false` (and `true` in `NODE_ENV=development`/`test`)
     - Missing `Origin` with `Sec-Fetch-Site: cross-site` → `false`
     - Missing `Origin` with `Sec-Fetch-Site: same-site` → `false`
     - Missing `Origin` with `Sec-Fetch-Site: same-origin` or no `Sec-Fetch-Site` header (unit tests / non-browser) → `true`
     - Passing a `Request` instance directly (`validateOrigin(request)`) vs falling back to `next/headers` (`validateOrigin()`).

- **Unit Verification:**
  - `npx tsc --noEmit`
  - `npx eslint lib/csrf.ts __tests__/lib/csrf.test.ts --max-warnings 0`
  - `npx jest __tests__/lib/csrf.test.ts __tests__/api/auth`

---

## 4. Phase 2 Detailed Implementation Guide — Tier 1 (Sessions 2, 3 & 4)

### Part 2A (Session 2): Outbound Timeouts, Retry Budget & Connection Pools (`T1-a`, `T1-a-writes`, `T1-b`, `T1-d`)

#### Unit `T1-a`: Outbound Read Timeouts (5s), R2 `requestHandler` Timeouts & `ip-api` Fix

- **Why:** Outbound `fetch()` calls in `lib/operation-service/client.ts` and `lib/money-service/client.ts` have no `signal: AbortSignal.timeout(...)`. Note that when `MIGRATE_*` flags are `"true"`, proxied Next.js route handlers do **not** fall back to local Prisma on throw (`app/api/alerts/route.ts:168-174`); adding a timeout fails fast with HTTP `504` (`Gateway timeout`) instead of hanging Vercel functions until platform kill.
- **Implementation Steps:**
  1. **`lib/operation-service/client.ts` & `lib/money-service/client.ts` (Read Calls):**
     - Follow the existing timeout pattern in `lib/active-indicator/gateway-client.ts:288-311`.
     - For `GET` / `HEAD` calls across `callOperationService`, `callOperationServiceWithHeaders`, `forwardRequestToOperationService`, `forwardRequestToOperationServiceWithHeaders`, and `callMoneyService` / `callMoneyServiceWithHeaders`:
       - Attach a `5_000ms` `AbortController` / `AbortSignal.timeout(5_000)` (composable with any caller signal via `AbortSignal.any` if provided).
       - Map `AbortError` / `TimeoutError` to a typed timeout error (`status: 504`, `code: 'GATEWAY_TIMEOUT'`) so route handlers return `{ error: 'Gateway timeout' }` with status `504`.
  2. **`lib/dlocal/dlocal-payment.service.ts:204` (`getPaymentStatus`):**
     - Add `signal: AbortSignal.timeout(5_000)` to the `GET` `fetch()` call in `getPaymentStatus`.
  3. **`lib/storage/r2.ts:52` (Cloudflare R2 `S3Client`):**
     - Do **not** put a 5-second wall-clock `AbortSignal.timeout(5_000)` on `r2.send(GetObjectCommand)` (`L174`), because `response.Body.transformToByteArray()` (`L177`) streams multi-megabyte SQLite database files (`export-Candles.db`) over the same signal and would abort healthy downloads on cold starts.
     - Instead, configure the `@smithy/node-http-handler` (`NodeHttpHandler`) on `new S3Client({ ... })` at `lib/storage/r2.ts:52` with `connectionTimeout: 3_000` and `requestTimeout: 10_000` (socket inactivity timeout).
  4. **`lib/security/device-detection.ts:159` & `lib/geo/detect-country.ts:24` (`http://ip-api.com` Removal):**
     - Both files currently call unencrypted `http://ip-api.com/json/${ipAddress}` without any timeout (note: `ip-api.com` free tier returns `403` over HTTPS).
     - In `lib/geo/detect-country.ts:24`: prefer Vercel edge geo headers (`x-vercel-ip-country` / `cf-ipcountry`) when available on request headers, or use an HTTPS geo endpoint with `signal: AbortSignal.timeout(1_500)` and safe fallback on error/timeout.
     - In `lib/security/device-detection.ts:159`: remove the unencrypted `http://ip-api.com` call (or replace with HTTPS + `signal: AbortSignal.timeout(1_500)` failing open to unknown location without blocking login).
- **Unit Verification:**
  - `npx tsc --noEmit`
  - `npx eslint lib/operation-service/client.ts lib/money-service/client.ts lib/dlocal/dlocal-payment.service.ts lib/storage/r2.ts lib/security/device-detection.ts lib/geo/detect-country.ts --max-warnings 0`
  - `npx jest __tests__/lib/dlocal __tests__/lib/storage __tests__/lib/geo __tests__/lib/security`

---

#### Unit `T1-a-writes` (`⚠`): Outbound Write Timeouts (`15,000ms`, No Auto-Retry) & Stripe Client Hardening

- **Why:** Financial, webhook, and mutation endpoints (`POST /api/payments/dlocal/create`, `POST /api/webhooks/dlocal`, `POST /api/webhooks/riseworks`, `POST /api/disbursement/pay`, `POST /api/disbursement/batches/[batchId]/execute`, `POST /api/alerts`) perform external provider calls or multi-row writes. A 5s timeout on non-idempotent writes risks severing the HTTP connection after the upstream provider has already charged or disbursed funds.
- **Implementation Steps:**
  1. **`lib/operation-service/client.ts` & `lib/money-service/client.ts` (Write Calls):**
     - For `POST`, `PUT`, `PATCH`, and `DELETE` requests, apply a `15_000ms` timeout (`WRITE_TIMEOUT_MS = 15_000`) with **zero automatic retries**.
  2. **`lib/dlocal/dlocal-payment.service.ts:109` (`createPayment`):**
     - Add `signal: AbortSignal.timeout(15_000)` to the `POST` `fetch()` call in `createPayment` (no automatic retry).
  3. **`lib/stripe/stripe.ts:41-44, 61`:**
     - Add `timeout: 15_000` and `maxNetworkRetries: 1` to `new Stripe(apiKey, { apiVersion: '2025-10-29.clover', typescript: true, timeout: 15_000, maxNetworkRetries: 1 })`.
     - Replace the unbounded module-global `let proPriceCache: Stripe.Price | null = null;` (`L61`) with a TTL-bounded cache (`const PRO_PRICE_CACHE_TTL_MS = 60 * 60 * 1000` — 1 hour) storing `{ price: Stripe.Price; expiresAt: number }`.
- **Unit Verification:**
  - `npx tsc --noEmit`
  - `npx eslint lib/operation-service/client.ts lib/money-service/client.ts lib/dlocal/dlocal-payment.service.ts lib/stripe/stripe.ts --max-warnings 0`
  - `npx jest __tests__/lib/stripe __tests__/lib/dlocal __tests__/api/payments __tests__/api/disbursement`

---

#### Unit `T1-b` (`⚠`): Amend ADR-099 D23 — No Primary Retry on `TIMEOUT` in OpenRouter Gateway

- **Why:** `lib/reply/constants.ts:52` sets `REPLY_DEADLINE_MS = 55_000`. Currently, `lib/reply/gateway/openrouter.ts:553` runs up to 2 primary attempts (`attempt < 2`) at `PRIMARY_TIMEOUT_MS = 25_000` (`L85`) before `lib/reply/gateway/fallback.ts:80-99` runs the fallback model at `FALLBACK_TIMEOUT_MS = 20_000` (`25s + 0.25s + 25s + 20s = 70.25s > 55s`).
- **Implementation Steps:**
  1. Open `lib/reply/gateway/openrouter.ts` around lines `486-491` (`isRetryableGatewayFailure`) and `553-569`.
  2. Change retry behavior so that when the primary attempt fails with `kind === 'TIMEOUT'` (or `AbortError` from the 25s primary timer), it does **not** retry the primary model—it immediately exits the primary loop so `fallback.ts` can invoke the `20_000ms` fallback model (`25s + 20s = 45s < 55s` `REPLY_DEADLINE_MS`).
  3. Keep the single primary retry (`attempt < 2` with `250ms` jitter) for fast transient failures (`HTTP 429`, `HTTP 5xx`, and fast network errors where `kind !== 'TIMEOUT'`).
  4. Update `docs/adr/099-prompt-and-reply-as-built-in-step-7.md` (Decision D23) to record this amendment (`no primary retry on timeout; 1 retry with 250ms jitter on 429/5xx/network error; 20s fallback model`).
  5. Update `__tests__/lib/reply/gateway/openrouter.test.ts` and `__tests__/lib/reply/gateway/fallback.test.ts` to assert:
     - Primary `TIMEOUT` triggers `0` primary retries and transitions directly to fallback.
     - Primary `429` or `503` still retries once before falling back.
- **Unit Verification:**
  - `npx tsc --noEmit`
  - `npx eslint lib/reply/gateway/openrouter.ts __tests__/lib/reply/gateway/openrouter.test.ts __tests__/lib/reply/gateway/fallback.test.ts --max-warnings 0`
  - `npx jest __tests__/lib/reply`

---

#### Unit `T1-d`: Prisma `PrismaPg` Pool Bounds & Redis `globalThis` Singleton + Timeouts

- **Why:** `lib/db/prisma.ts:31-50` and `lib/db/market-prisma.ts:23-42` pass `{ connectionString: databaseUrl }` directly to `new PrismaPg(...)` with no `connectionTimeoutMillis`, `idleTimeoutMillis`, or `max` pool size. `lib/redis/client.ts:11-27` creates `new Redis(...)` without `globalThis` caching or `commandTimeout`.
- **Implementation Steps:**
  1. **`lib/db/prisma.ts` & `lib/db/market-prisma.ts`:**
     - Inside the lazy initialization factory, pass pool configuration to `new PrismaPg({ connectionString: databaseUrl, connectionTimeoutMillis: 5_000, idleTimeoutMillis: 30_000, max: 5 })`.
     - Preserve the `Proxy` lazy-init structure so module import at build time does not instantiate a DB pool when `DATABASE_URL` / `MARKET_DATABASE_URL` is absent.
  2. **`lib/redis/client.ts:11-27`:**
     - Cache the `ioredis` instance on `globalThis` (`globalForRedis.redisClient`) in non-production to prevent HMR socket leaks.
     - Add `connectTimeout: 5_000` and `commandTimeout: 3_000` to `new Redis(redisUrl, { ... })`.
     - **Important:** Do **not** set `enableOfflineQueue: false` (it rejects commands synchronously while `ioredis` is still in `'connecting'` state on cold start).
- **Unit Verification:**
  - `npx tsc --noEmit`
  - `npx eslint lib/db/prisma.ts lib/db/market-prisma.ts lib/redis/client.ts --max-warnings 0`
  - `npx jest __tests__/lib/db __tests__/lib/redis` (or related suites)

---

### Part 2B (Session 3): `import 'server-only'` Boundary Hardening (`T1-c`)

#### Unit `T1-c`: Update Stack D Boundary Tests First, Then Add `import 'server-only'` Across Server Modules

- **Why:** Currently, **zero** files in `lib/` use `import 'server-only'`. Adding it ensures Next.js fails the build immediately if any `'use client'` component accidentally imports a server module containing Prisma, Redis, Stripe, or secrets.
- **Step 1 — Update Stack D Guard Tests First (Mandatory Prerequisite):**
  1. **`__tests__/lib/engine4/exactness-guard.test.ts:142-176`:**
     - Add `'server-only'` to `SERVER_IMPORTS` (`L142-154`), `STORE_IMPORTS` (`L156-168`), and `READER_IMPORTS` (`L170-176`).
     - Keep `PURE_DIRECTORIES` (`types`, `constants`, `contracts`, `canon`, `sort`, `validate`, `select`, `cross`) free of `'server-only'`.
  2. **`__tests__/lib/intake/boundaries.test.ts` & `__tests__/lib/reply/boundaries.test.ts`:**
     - Update the AST import checks for non-pure server folders (`read/`, `server/`, `store/`, `lib/platform/**`, `lib/reply/gateway/**`) to allow `'server-only'`.
     - Also update the regex `"imports only ... (exactly)"` tests in `__tests__/lib/intake/boundaries.test.ts:414-457` (and any equivalent in `__tests__/lib/reply/boundaries.test.ts`) to ignore `import 'server-only';` when asserting external specifiers, or include `'server-only'` in the expected set.
- **Step 2 — Add `import 'server-only';` to Server-Only Modules:**
  - Add `import 'server-only';` at the top of server-only modules in:
    - `lib/db/**` (`prisma.ts`, `market-prisma.ts`, `seed.ts`)
    - `lib/redis/**` (`client.ts`)
    - `lib/auth/**` (`auth-options.ts`, `session.ts`, `permissions.ts`, `two-factor.ts`, `account-lockout.ts`, — **verify first via `grep` that `lib/auth/callback-url.ts` and `lib/auth/errors.ts` are not imported by `'use client'` files; if any `'use client'` file imports `callback-url.ts` or `errors.ts`, leave those two shared utilities without `'server-only'`**)
    - `lib/stripe/**` (`stripe.ts`, `webhook-handlers.ts`)
    - `lib/dlocal/**` (**EXCEPT `lib/dlocal/constants.ts`**, which is imported by `'use client'` components!)
    - `lib/riseworks/**`
    - `lib/disbursement/**`
    - `lib/operation-service/**` & `lib/money-service/**`
    - `lib/storage/**` (`r2.ts`)
    - `lib/encryption/**`
    - `lib/email/**`
    - `lib/platform/**`
    - `lib/engine4/{read,server,store}/**` (non-pure folders only)
    - `lib/intake/{read,server,store}/**` (non-pure folders only)
    - `lib/reply/{gateway,read,server,store}/**` and `lib/reply/orchestrator.ts` (non-pure files only)
- **Step 3 — Before/After Verification:**
  - Before adding `import 'server-only'` to any file, check with `grep` that no `'use client'` file in `app/`, `components/`, or `hooks/` imports it (directly or transitively).
- **Unit Verification:**
  - `npx tsc --noEmit`
  - `npx jest __tests__/lib/engine4 __tests__/lib/intake __tests__/lib/reply`
  - `npm run build` (proves Next.js 16 client/server module graph compiles cleanly with `'server-only'` enforced)

---

### Part 2C (Session 4): Admin RSC Guards, Disbursement Health & Central Middleware CSRF (`T1-e`, `T1-f`)

#### Unit `T1-e` (`⚠`): Admin RSC `requireAdminPage()`, Disbursement Health Hardening & Middleware Prefixes

- **Why:**
  1. `app/admin/layout.tsx:16-31` checks `session?.user?.role !== 'ADMIN'`, **but in Next.js App Router, layouts and pages render in parallel**, and partial/client navigation can invoke page RSC payloads directly (`NEXTJS_SECURITY_CHECKLIST.md` `AUT-01`). Currently, all 8 `app/admin/**` RSC pages query Prisma/services directly without checking admin session inside `page.tsx`.
  2. `GET /api/disbursement/health` (`app/api/disbursement/health/route.ts:39-151`) is public (`middleware.ts:15` exempts `/api/disbursement/health`), runs live `provider.authenticate()` against RiseWorks, and returns `checks.configuration.issues`, `provider: 'MOCK' | 'RISE'`, `latency`, and `checks.database.error` to unauthenticated callers.
  3. `middleware.ts:42-61` `isProtectedPage` omits `/terminal` (`app/(dashboard)/terminal/page.tsx`) and `/free` (`app/free/page.tsx`) and uses `.startsWith(route)` instead of segment-boundary matching (`pathname === route || pathname.startsWith(`${route}/`)`).
- **Implementation Steps:**
  1. **Create `requireAdminPage()` helper (in `lib/auth/session.ts`):**
     - Export a `React.cache()`-wrapped helper `requireAdminPage()` that calls `getSession()`, redirects to `/login` if unauthenticated, and redirects to `/dashboard` if `session.user.role !== 'ADMIN'`, returning the typed admin `session`.
     - Call `await requireAdminPage();` at the very top of all 8 Admin RSC pages:
       - `app/admin/dashboards/affiliates/page.tsx`
       - `app/admin/dashboards/executive/page.tsx`
       - `app/admin/dashboards/regional/page.tsx`
       - `app/admin/dashboards/revenue/page.tsx`
       - `app/admin/dashboards/users/page.tsx`
       - `app/admin/system/config-history/page.tsx`
       - `app/admin/system/outbox/page.tsx`
       - `app/admin/users/[id]/page.tsx`
  2. **Harden `GET /api/disbursement/health` (`app/api/disbursement/health/route.ts:39-151`):**
     - Check if the caller has an authenticated `ADMIN` session (via `getServerSession(authOptions)`).
     - For **unauthenticated or non-admin callers**: only run the lightweight `prisma.$queryRaw\`SELECT 1\``check (do **not** call`provider.authenticate()`or`validateDisbursementConfig()`), and return only `{ status: 'healthy' | 'unhealthy' }`with HTTP`200`or`503`.
     - For **authenticated `ADMIN` callers**: return the full diagnostic payload (`provider`, `checks`, `latency`, `timestamp`) when not proxied to `money-service`.
  3. **Update `middleware.ts:42-61` (`isProtectedPage`):**
     - Add `'/terminal'` and `'/free'` to the protected page prefixes list.
     - Use segment-boundary matching: `protectedPrefixes.some((route) => pathname === route || pathname.startsWith(`${route}/`))`.
- **Unit Verification:**
  - `npx tsc --noEmit`
  - `npx eslint lib/auth/session.ts app/admin app/api/disbursement/health/route.ts middleware.ts --max-warnings 0`
  - `npx jest __tests__/middleware.test.ts __tests__/api/disbursement`

---

#### Unit `T1-f` (`⚠`): Central CSRF Validation in `middleware.ts` for Non-GET `/api/**` Routes

- **Why:** Only 1 of 108 API route handlers (`POST /api/auth/token-login`) currently calls `validateOrigin()`. All other cookie-authenticated state-changing endpoints (`POST`, `PUT`, `PATCH`, `DELETE` under `/api/**`) lack Origin validation (`NEXTJS_SECURITY_CHECKLIST.md` `RTE-02`).
- **Critical Design Constraint:** In `middleware.ts:272-279`, the `catch` block is intentionally fail-open (`NextResponse.next()`) for auth-token decoding errors. The CSRF check **must run BEFORE and OUTSIDE that `try/catch` block** so it cannot be bypassed by triggering an exception.
- **Implementation Steps:**
  1. Open `middleware.ts`.
  2. Import `validateOrigin` from `@/lib/csrf`.
  3. Define the explicit machine-to-machine prefix exemption list (endpoints authenticated via cryptographic signatures or Bearer `CRON_SECRET` / `INTERNAL_API_KEY`):
     ```ts
     const CSRF_EXEMPT_API_PREFIXES = [
       '/api/webhooks/stripe',
       '/api/webhooks/dlocal',
       '/api/webhooks/riseworks',
       '/api/cron/',
       '/api/admin/system/jobs/',
     ];
     ```
  4. At the top of `middleware(req: NextRequest)` (before the auth `try` block):
     - If `pathname.startsWith('/api/')` and `!['GET', 'HEAD', 'OPTIONS'].includes(req.method)`:
       - Check if `CSRF_EXEMPT_API_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix))`.
       - If not exempt, call `const isValidOrigin = await validateOrigin(req);`.
       - If `!isValidOrigin`, return `NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })`.
  5. Expand `__tests__/middleware.test.ts` to test:
     - `POST /api/alerts` with cross-origin `Origin: https://evil.com` → `403`
     - `POST /api/alerts` with matching `Origin: https://davintrade.app` and `Host: davintrade.app` → passes through
     - `POST /api/webhooks/stripe` without `Origin` or with external `Origin` → exempt (passes through)
     - `POST /api/cron/check-expiring-subscriptions` → exempt (passes through)
     - `GET /api/alerts` with cross-origin `Origin` → allowed (read method)
- **Unit Verification:**
  - `npx tsc --noEmit`
  - `npx eslint middleware.ts __tests__/middleware.test.ts --max-warnings 0`
  - `npx jest __tests__/middleware.test.ts`

---

## 5. Phase 3 Detailed Implementation Guide — Tier 2 (Sessions 5 & 6)

### Part 3A (Session 5): `React.cache()` Deduplication & Contract-Safe Waterfall Elimination (`T2-a`, `T2-b`)

#### Unit `T2-a`: `React.cache()` Deduplication on Session/Appearance/Locale/Tutorials + Academy `after()`

- **Why:** Zero files in `lib/` currently use `React.cache()`. A single page render in `app/(dashboard)` or `app/admin` triggers redundant `getServerSession(authOptions)` JWT decryptions, repeated `cookies()` / Prisma reads for appearance/locale/view-as helpers, and duplicate `getPublishedTutorialById(id)` queries across `generateMetadata()` and `AcademyVideoPage()`. Also, `app/(marketing)/academy/[id]/page.tsx:78` executes a database `UPDATE` (`incrementTutorialViewCount(id)`) directly inside the RSC render body (`ACT-06`).
- **Implementation Steps:**
  1. **Wrap request-scoped zero-arg / primitive-arg readers in `cache()` from `'react'`:**
     - `lib/auth/session.ts:29` (`getSession`) and `L168` (`getAffiliateProfile`)
     - `lib/appearance/server-appearance.ts:24` (`getServerAppearance`)
     - `lib/i18n/server-locale.ts:65, 73` (`getServerLanguage`, `getServerLocalePreferences`)
     - `lib/affiliate/view-as.ts:141` (`getAdminViewAs`)
     - `lib/admin/user-view-as.ts:132`: Because `React.cache()` uses `Object.is` reference equality, keep `getAdminUserViewAs(session)` as a thin wrapper that validates `session?.user?.role === 'ADMIN'`, reads the cookie `userId: string`, and delegates the Prisma `user.findUnique` + `subscription.findFirst` lookup to a `cache(async (userId: string) => ...)` helper keyed by the primitive `userId` string.
     - `lib/tutorials/service.ts:210` (`getPublishedTutorialById`)
  2. **Deduplicate `getServerSession(authOptions)` across RSC layouts & pages:**
     - Update RSC layouts and pages (`app/(dashboard)/layout.tsx`, `app/admin/layout.tsx`, `app/affiliate/dashboard/layout.tsx`, and RSC pages under those segments) to call the cached `getSession()` from `@/lib/auth/session` instead of calling `getServerSession(authOptions)` directly.
  3. **Move `incrementTutorialViewCount(id)` into Next.js `after()` (`app/(marketing)/academy/[id]/page.tsx:78`):**
     - Import `{ after } from 'next/server'`.
     - Replace `void incrementTutorialViewCount(id);` during render with:
       ```ts
       after(async () => {
         await incrementTutorialViewCount(id);
       });
       ```
- **Unit Verification:**
  - `npx tsc --noEmit`
  - `npx eslint lib/auth/session.ts lib/appearance/server-appearance.ts lib/i18n/server-locale.ts lib/affiliate/view-as.ts lib/admin/user-view-as.ts lib/tutorials/service.ts "app/(marketing)/academy/[id]/page.tsx" --max-warnings 0`
  - `npx jest __tests__/lib/tutorials __tests__/lib/auth`

---

#### Unit `T2-b`: Contract-Safe `Promise.all()` Waterfall Elimination (Stack D Readers + Admin BI Pages)

- **Why:** Multiple hot-path Stack D readers and Admin/User/Affiliate RSC pages execute independent database queries sequentially.
- **Strict Stack D Ordering Rules (Must Follow Exactly):**
  1. **Engine 4 (`lib/engine4/read/cycle.ts:224-345` — `readOfferSnapshot`):**
     - Parallelize the first 3 independent queries in `Promise.all([queryTouchRows, queryHookRows, queryFractalRows])` (`L224`, `L244`, `L339`).
     - **Do NOT** include `zoneRows` (`L294`) in that first batch because `zoneIdSet` (`L275-286`) is derived from `touchRows` and `hookRows`; run `zoneRows` after the first `Promise.all` resolves.
     - **Preserve `problems` array order:** Append touch problems first, then hook problems, then zone problems, then fractal problems in the exact original sequence (`__tests__/lib/engine4/cycle.test.ts`).
  2. **Intake (`lib/intake/read/snapshot.ts:526-540` — `readSnapshot`):**
     - Parallelize `readRegistryRows(marketDb, symbol, regProblems)` and `readProgressionRows(marketDb, symbol, progProblems)` with `Promise.all` using **separate temporary problem arrays** (`regProblems`, `progProblems`), then push `...regProblems` followed by `...progProblems` into `problems`.
  3. **Reply Orchestrator (`lib/reply/orchestrator.ts:360-410`) & State API (`lib/reply/server/state-api.ts:124-145`):**
     - In `lib/reply/orchestrator.ts`:
       - Batch 1: `Promise.all([deps.market.getRecentDayBars(...), deps.threads.loadContext(...)])` (`L360-374`).
       - Keep the `if (!context.hasPriorHistory)` short-circuit (`L376-380`) intact so `previousStates` is **not** queried when `hasPriorHistory === false` (preserving the `NO_PRIOR_HISTORY` reason code).
       - Batch 2 (when `hasPriorHistory === true`): run `deps.threads.loadPreviousStates(...)` (`L383-388`) in parallel with `deps.intake.readChart(...)` (`L406-410`).
     - In `lib/reply/server/state-api.ts:124-145`:
       - Parallelize `deps.ledger.readBalance(auth.userId)` (`L124`) and `deps.profile.readProfile(auth.userId)` (`L145`) via `Promise.all`.
       - Keep `deps.threads.readActiveSummary` (`L174`) after `resolveActiveEntitlement` (`L165`) so blocked/unentitled users do not trigger unnecessary thread summary reads.
  4. **Admin BI & Dashboard RSC Pages:**
     - Wrap independent sequential queries in `Promise.all()` in:
       - `app/admin/dashboards/executive/page.tsx:52-77` (6 sequential queries)
       - `app/admin/dashboards/revenue/page.tsx:79-103` (7 sequential queries)
       - `app/admin/dashboards/users/page.tsx:66-76` (5 sequential queries)
       - `app/admin/dashboards/affiliates/page.tsx:54-68` (3 sequential queries)
       - `app/admin/dashboards/regional/page.tsx:48-55` (2 sequential queries)
       - `app/admin/users/[id]/page.tsx:94-106` (after `getAdminUserViewAsTarget` resolves `user`, parallelize `fraudAlerts`, `loginHistory`, `paymentReceipts`, `webhookEvents`)
       - `app/dashboard/page.tsx:51-87` (parallelize `alertCount` and `watchlistCount`)
       - `app/(dashboard)/alerts/page.tsx`, `app/(dashboard)/alerts/new/page.tsx`, `app/alerts/[symbol]/[timeframe]/page.tsx`
       - `app/affiliate/dashboard/payouts/page.tsx:61-90` (parallelize `aggregate` + `findMany` + `count`)
       - `app/api/user/login-history/route.ts:89-108` and `app/api/user/security-alerts/route.ts:68-86` (flag-off fallbacks)
- **Unit Verification:**
  - `npx tsc --noEmit`
  - `npx eslint <touched-files> --max-warnings 0`
  - `npx jest __tests__/lib/engine4 __tests__/lib/intake __tests__/lib/reply`

---

### Part 3B (Session 6): Prisma `select` Minimization, Error Sanitization & Security Headers (`T2-c`, `T2-d`, `T2-e`)

#### Unit `T2-c`: Explicit Prisma `select` on `User` Reads, Omit `paymentDetails` in Affiliate Profile, Delete `candle-data-helpers.ts`

- **Why:** Several route handlers call `prisma.user.findUnique` without `select`, loading full `User` rows (including `password`, `twoFactorSecret`, `twoFactorBackupCodes`, `resetToken`, `verificationToken`) into memory (`DAL-03`), and `app/api/affiliate/profile/route.ts:82,180` returns the full `AffiliateProfile` row (including `paymentDetails` JSON containing bank/wallet details) to the client (`DAL-05`). Also, `lib/candle-data-helpers.ts` is a dead file with zero importers that contains string-interpolated `$queryRawUnsafe`.
- **Implementation Steps:**
  1. Add explicit `select` clauses to `prisma.user.findUnique` in:
     - `app/api/subscription/route.ts:69`
     - `app/api/subscription/cancel/route.ts:47`
     - `app/api/payments/dlocal/create/route.ts:91`
     - `app/api/user/profile/route.ts:127`
     - `app/api/auth/forgot-password/route.ts:28`
     - `app/api/auth/resend-verification/route.ts:29`
  2. In `app/api/affiliate/profile/route.ts:82` (`GET`) and `L180` (`PUT`), return an explicit DTO (or destructure out `paymentDetails` / return only masked summary fields) so raw `paymentDetails` JSON is not serialized in the response body. Verify `app/affiliate/dashboard/settings/page.tsx` does not read `profile.paymentDetails`.
  3. Confirm via `grep -rn "candle-data-helpers" .` that `lib/candle-data-helpers.ts` has zero importers, then delete `lib/candle-data-helpers.ts`.
  4. _(Note: Do **not** enable `experimental.taint` in `next.config.js`.)_
- **Unit Verification:**
  - `npx tsc --noEmit`
  - `npx eslint <touched-files> --max-warnings 0`
  - `npx jest __tests__/api/subscription __tests__/api/payments __tests__/api/user __tests__/api/affiliate __tests__/api/auth`

---

#### Unit `T2-d` (`⚠`): Sanitize Raw `error.message` in `app/error.tsx` & 5 API Routes + `global-error.tsx` Logging

- **Why:** `app/error.tsx:43` renders `{error.message || ...}` directly in the DOM, and 5 remaining API route catch blocks return raw `error.message` to HTTP clients (`ERR-02`, `ERR-03`).
- **Implementation Steps:**
  1. **`app/error.tsx:43`:**
     - Replace `{error.message || 'An unexpected error occurred...'}` with a generic user-safe message, and display `error.digest` when present so users/support can correlate errors with server logs.
     - Log `error` and `error.digest` in a `useEffect`.
  2. **`app/global-error.tsx`:**
     - Add a `useEffect` logging `error` and `error.digest` (and display `error.digest` if present).
  3. **Sanitize the 5 API Route Catch Blocks:**
     - `app/api/payments/dlocal/create/route.ts:320` → log `error` server-side; return generic `'Failed to create payment'` (`500`).
     - `app/api/disbursement/pay/route.ts:163` → log `error` server-side; return generic `'Failed to process payment'` (`500`).
     - `app/api/disbursement/batches/[batchId]/execute/route.ts:114` → log `error` server-side; return generic `'Failed to execute batch'` (`500`).
     - `app/api/webhooks/stripe/route.ts:112` → log `err.message` server-side; return `{ error: 'Invalid webhook signature' }` (`400`) instead of interpolating `err.message`.
     - `app/api/admin/active-indicator/route.ts:86` → log `error` server-side; return generic `'Failed to update indicator configuration'` (`500`).
- **Unit Verification:**
  - `npx tsc --noEmit`
  - `npx eslint app/error.tsx app/global-error.tsx app/api/payments/dlocal/create/route.ts app/api/disbursement/pay/route.ts "app/api/disbursement/batches/[batchId]/execute/route.ts" app/api/webhooks/stripe/route.ts app/api/admin/active-indicator/route.ts --max-warnings 0`
  - `npx jest __tests__/api/payments __tests__/api/disbursement __tests__/api/webhooks`

---

#### Unit `T2-e` (`⚠`): Security Headers (`next.config.js`) & Vercel Blob Upload Hardening (`lib/marketing-resources/storage.ts`)

- **Why:** `next.config.js` sets deprecated `X-XSS-Protection: 1; mode=block` (`L122-125`), 1-year HSTS without `preload` (`L113`), and unconditionally includes `'unsafe-eval'` (`L133`) and `http://localhost:3001 ws://localhost:3001` (`L137`) in production CSP (`HDR-01`..`HDR-07`). Additionally, `lib/marketing-resources/storage.ts:27-34` uploads admin files to public Vercel Blob without `contentDisposition: 'attachment'` or filename sanitization (`INP-04`).
- **Implementation Steps:**
  1. **`next.config.js` (`headers()`):**
     - Remove the `{ key: 'X-XSS-Protection', value: '1; mode=block' }` entry (`L122-125`).
     - Update `Strict-Transport-Security` (`L113`) to `'max-age=63072000; includeSubDomains; preload'`.
     - Gate `'unsafe-eval'` in `script-src` (`L133`) and `http://localhost:3001 ws://localhost:3001` in `connect-src` (`L137`) on `process.env.NODE_ENV !== 'production'`.
  2. **`lib/marketing-resources/storage.ts:27-34`:**
     - Sanitize `file.name` (strip path separators and non-alphanumeric/dot/dash/underscore characters: `const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')`).
     - Pass `contentDisposition: 'attachment'` to `@vercel/blob`'s `put(...)` options so uploaded files cannot execute inline in a browser context.
- **Unit Verification:**
  - `npx tsc --noEmit`
  - `npx eslint next.config.js lib/marketing-resources/storage.ts --max-warnings 0`
  - `npm run build` (must exit `0`)

---

## 6. Phase 4 Detailed Implementation Guide — Tier 3 (Sessions 7 & 8)

### Part 4A (Session 7): Dynamic Locale Chunks (-1.4 MB), `next/dynamic` Charts & RSC Marketing Pages (`T3-a`, `T3-b`)

#### Unit `T3-a`: Split Static 1.4 MB Locale Dictionary Bundle & `next/dynamic` Heavy Charts/Modals

- **Why:** `lib/context/locale-context.tsx:45-59` statically imports all 9 locale JSON files (`de.json`, `en-GB.json`, `en-US.json`, `es.json`, `fr.json`, `ja.json`, `ko.json`, `pt.json`, `th.json`)—totaling **1.4 MB raw / ~328 KB gzip**—into the shared root Client Component bundle (`LocaleProvider` is mounted in `app/providers.tsx:16`). Every visitor downloads all 9 languages even though they only use 1 language.
- **Implementation Steps:**
  1. **Dynamic Locale Loading in `lib/context/locale-context.tsx`:**
     - Keep `en-GB.json` as the synchronous fallback dictionary (or pass the initial server-resolved dictionary from `app/layout.tsx` into `Providers` / `LocaleProvider`).
     - Load non-default language dictionaries on demand via dynamic `import(\`@/locales/\${lang}.json\`)`.
     - Preserve the `en-US` overlay semantics (`{ ...enGB, ...enUS }`) when `language === 'en-US'`.
     - Follow `.claude/rules/i18n-compliance.md` and ensure all existing `useLocale()` / `t()` signatures remain 100% backward-compatible.
  2. **`next/dynamic` for Heavy Client Charts & Modals:**
     - Wrap `CurrencyIndexChartPanel` (`components/currency-index-pro/currency-index-chart-panel.tsx`), `ComparisonChartPanel` (`components/currency-index-comparison/comparison-chart-panel.tsx`), and `ProChartInstance` (`components/market/pro-chart-instance.tsx`) in `next/dynamic(..., { ssr: false, loading: () => <div className="..." /> })` with fixed-height skeleton placeholders matching the chart container height (preventing CLS).
     - Wrap `AddAlertModal` (`components/currency-index-pro/add-alert-modal.tsx`) in `next/dynamic` so it loads only when opened.
     - For `DonutMarketShare` in `app/admin/dashboards/regional/page.tsx`: because `next/dynamic(..., { ssr: false })` is not allowed directly inside a Server Component in Next.js 16, create a thin `'use client'` wrapper component (or convert `DonutMarketShare` entry wrapper) that dynamically imports the chart with `{ ssr: false }`.
- **Unit Verification:**
  - `npx tsc --noEmit`
  - `npx eslint <touched-files> --max-warnings 0`
  - `npx jest` (verify i18n and component tests pass)
  - `npm run build`

---

#### Unit `T3-b`: Convert Static `'use client'` Marketing Pages to Server Components + Narrow Landing `<Suspense>`

- **Why:** 8 purely static marketing pages are marked `'use client'` solely to call `useLocale()` / `useGlossary()` for static text, shipping all page markup and copy inside JavaScript bundles instead of pre-rendered RSC HTML. Additionally, `app/(marketing)/page.tsx:26-36` wraps the entire `<HomeContent />` above-the-fold hero inside `<Suspense>` while waiting for `getAffiliateSystemConfig()`, delaying LCP.
- **Implementation Steps:**
  1. **Server-Side Dictionary Helper:**
     - Create a server-side `getDictionary(lang: Language)` helper (e.g., in `lib/i18n/server-locale.ts`) that resolves the dictionary for `await getServerLanguage()` on the server.
  2. **Convert the 8 Static Marketing Pages to Server Components (remove `'use client'`):**
     - `app/(marketing)/about/page.tsx`
     - `app/(marketing)/careers/page.tsx`
     - `app/(marketing)/changelog/page.tsx`
     - `app/(marketing)/disclaimer/page.tsx`
     - `app/(marketing)/pricing/page.tsx`
     - `app/(marketing)/privacy/page.tsx`
     - `app/(marketing)/terms/page.tsx`
     - `app/affiliate/join/page.tsx`
  3. **Narrow `<Suspense>` on `app/(marketing)/page.tsx:26-36`:**
     - Render the static Hero, Features, How It Works, and Pillars sections immediately without blocking on `getAffiliateSystemConfig()`, and scope `<Suspense>` specifically around the async pricing section (`<LandingPricing />`) that consumes `discountPercent` / `commissionPercent`.
  4. **Extract Interactive Client Leaves on the 6 Remaining Marketing Pages:**
     - Keep the outer `page.tsx` as a Server Component and move interactive state (`useState` filter tabs, search inputs, accordion toggles, calculators) into small leaf Client Components for:
       - `app/(marketing)/blog/page.tsx`
       - `app/(marketing)/docs/page.tsx`
       - `app/(marketing)/econ-news/page.tsx`
       - `app/(marketing)/help/page.tsx`
       - `app/(marketing)/xaux-vs-usdx/page.tsx`
       - `app/affiliate/page.tsx`
- **Unit Verification:**
  - `npx tsc --noEmit`
  - `npx eslint "app/(marketing)" app/affiliate --max-warnings 0`
  - `npm run build`

---

### Part 4B (Session 8): Client Polling/Abort Race Fixes, Segment Boundaries & CI Gates (`T3-c`, `T3-d`, `T3-e`)

#### Unit `T3-c`: Fix `use-currency-index-chart.ts` Abort Race & Add `visibilityState` Pause Guards

- **Why:** In `components/currency-index-pro/hooks/use-currency-index-chart.ts:87-90`, when a rapid symbol/timeframe switch aborts an in-flight `fetch`, the `catch` block suppresses the error text via `if (!controller.signal.aborted)` (`L87`), **but line 90 unconditionally executes `setData(EMPTY_DATA)` outside the guard**, wiping out newer state or causing chart flicker. Additionally, several `setInterval` hooks continue firing background HTTP requests while the browser tab is hidden.
- **Implementation Steps:**
  1. **`components/currency-index-pro/hooks/use-currency-index-chart.ts:86-93`:**
     - Return early at the top of the `catch` block when aborted (`if (controller.signal.aborted) return;`) and guard `finally` (`if (!controller.signal.aborted) setIsLoading(false);`) so an aborted request never mutates `data` or `isLoading`.
  2. **Add `document.visibilityState === 'hidden'` Pause + In-Flight Overlap Guards:**
     - Follow the pattern in `components/dashboard/indicator-tier-selector.tsx:468-503` (skip interval tick when `document.visibilityState === 'hidden'`, prevent overlapping in-flight requests, and refresh when visibility returns to `'visible'`) in:
       - `components/currency-index-pro/hooks/use-currency-index-chart.ts:116`
       - `components/currency-index-pro/hooks/use-currency-index-alerts.ts:44`
       - `components/currency-index-pro/hooks/use-currency-index-watchlist.ts:39`
       - `components/charts/drawing/useEventMarkers.ts:113`
       - `components/market-sessions/market-sessions-grid.tsx:167`
- **Unit Verification:**
  - `npx tsc --noEmit`
  - `npx eslint components/currency-index-pro/hooks components/charts/drawing/useEventMarkers.ts components/market-sessions/market-sessions-grid.tsx --max-warnings 0`
  - `npx jest`

---

#### Unit `T3-d`: Add Segment-Level `error.tsx` and `loading.tsx` Boundaries

- **Why:** Only 2 `error.tsx` files (`app/error.tsx`, `app/(dashboard)/error.tsx`) and 3 `loading.tsx` files exist across 113 pages. An unhandled error or slow fetch in Admin BI dashboards, Affiliate dashboard, `/terminal`, `/free`, or `/pro/currency-index` tears down the whole layout or blocks navigation without a segment skeleton.
- **Implementation Steps:**
  1. Add segment-level `error.tsx` (`'use client'`, sanitized message + `error.digest` + "Try again" `reset()` button) in:
     - `app/admin/dashboards/error.tsx`
     - `app/affiliate/dashboard/error.tsx`
     - `app/(dashboard)/terminal/error.tsx`
     - `app/free/error.tsx`
  2. Add segment-level `loading.tsx` skeleton boundaries in:
     - `app/admin/dashboards/loading.tsx`
     - `app/affiliate/dashboard/loading.tsx`
     - `app/(dashboard)/terminal/loading.tsx`
     - `app/free/loading.tsx`
     - `app/pro/currency-index/loading.tsx`
- **Unit Verification:**
  - `npx tsc --noEmit`
  - `npx eslint app/admin/dashboards app/affiliate/dashboard "app/(dashboard)/terminal" app/free app/pro/currency-index --max-warnings 0`
  - `npm run build`

---

#### Unit `T3-e`: CI Dependency Audit Gate, Expanded Secret Scan & Dependabot

- **Why:** `.github/workflows/dependencies-security.yml:63-75` runs `pnpm audit` with `continue-on-error: true` and `|| true`, `.github/workflows/security-checks.yml:87-117` only greps 4 hardcoded secret regexes, and no `.github/dependabot.yml` exists (`OPS-01`, `OPS-02`).
- **Implementation Steps:**
  1. **`.github/workflows/dependencies-security.yml:63-75`:**
     - Coordinate with `.claude/rules/security-overrides.md`: first run `pnpm audit --prod --audit-level=high` locally to verify whether existing `pnpm.overrides` in `package.json` already yield 0 high/critical production vulnerabilities.
     - If `pnpm audit --prod --audit-level=high` exits `0`, remove `continue-on-error: true` and `|| true` on the high/critical production audit step so regressions fail CI. (If any upstream transitive advisory lacks a patched release, document the exact advisory ID or `--ignore-registry-errors` / override per `.claude/rules/security-overrides.md` rather than breaking CI.)
  2. **`.github/workflows/security-checks.yml:87-117`:**
     - Expand the secret scanning patterns to cover `whsec_`, `rk_live_`, `dlocal`, `OPENROUTER_API_KEY`, `NEXTAUTH_SECRET`, and `INTERNAL_API_KEY`.
  3. **Create `.github/dependabot.yml`:**
     - Configure weekly `npm` (pnpm) security & version updates and `github-actions` updates with grouped minor/patch PRs.
- **Unit Verification:**
  - `npx tsc --noEmit`
  - `npm test`
  - `npm run build`

---

## 7. Cross-Session Handoff & Closeout Protocol (Mandatory at the End of Every Session)

To guarantee 100% continuity across all 8 Claude Code sessions, every session **must** complete both steps below before finishing:

1. **Update [`davintrade-next-js-checklists/nextjs-remediation-session-log.md`](./nextjs-remediation-session-log.md):**
   - Mark the completed units (`[x]`) in the Master Progress Tracker table.
   - Fill in the **Session N Handoff Report** block inside `nextjs-remediation-session-log.md` with:
     - Date & status (`COMPLETED`)
     - Exact files created, modified, or deleted per unit
     - Verification command exit codes and test counts (`npx tsc --noEmit`, `npx eslint`, `npx jest`, `npm run build`)
     - Git tree state (whether changes were committed or remain uncommitted in the working tree)
     - **Handoff Notes for Session `N+1`** (any exports added, helper signatures introduced—such as `validateOrigin(request?)` in Session 1 for Session 4, or `requireAdminPage()` in Session 4 for Session 5—and any caveats for the next session).
2. **Output a Concise Session Closeout Summary in Chat for Davin:**
   - Summarize the completed Order IDs, verification exit codes, and confirm that `davintrade-next-js-checklists/nextjs-remediation-session-log.md` has been updated for the next session.
