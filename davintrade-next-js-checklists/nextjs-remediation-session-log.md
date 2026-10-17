# Next.js 16 Remediation — Cross-Session Progress & Handoff Log

- **Document Role:** Living Cross-Session Continuity & Handoff Log (Read at Session Start · Update at Session End)
- **Implementation Plan Reference:** [`davintrade-next-js-checklists/nextjs-remediation-handoff-for-claude-code.md`](./nextjs-remediation-handoff-for-claude-code.md)
- **Consensus Master Plan:** [`davintrade-next-js-checklists/nextjs-production-remediation-master-plan.md`](./nextjs-production-remediation-master-plan.md)
- **Current Overall Status:** `IN_PROGRESS` (1 / 8 Sessions · 4 / 21 Units Completed — Session 1 done, committed locally as `f7a9e09b`, not pushed)

---

## 1. Master Progress Tracker (Update `[ ]` → `[x]` at the End of Each Session)

| Session       | Phase & Part          |    Order ID     | Status | Unit Summary                                                                                              |
| :------------ | :-------------------- | :-------------: | :----: | :-------------------------------------------------------------------------------------------------------- |
| **Session 1** | **Phase 1 — Part 1A** |    **P0-a**     | `[x]`  | Delete `app/api/test/seed/route.ts` & remove entry from `systemconfig-figures-guard.test.ts:124`          |
| **Session 1** | **Phase 1 — Part 1A** |    **P0-b**     | `[x]`  | Replace `'use server'` with `import 'server-only'` & prune dead functions in `fraud-detection.service.ts` |
| **Session 1** | **Phase 1 — Part 1A** |    **P0-c**     | `[x]`  | Harden NextAuth `redirect` callback (`lib/auth/auth-options.ts:643-666`) + unit tests                     |
| **Session 1** | **Phase 1 — Part 1A** |    **P0-d**     | `[x]`  | Harden `validateOrigin(request?)` (`lib/csrf.ts`) with exact origin + `Sec-Fetch-Site` + unit tests       |
| **Session 2** | **Phase 2 — Part 2A** |    **T1-a**     | `[ ]`  | Outbound 5s read timeouts, R2 `S3Client` `requestHandler` timeouts & `ip-api` removal                     |
| **Session 2** | **Phase 2 — Part 2A** | **T1-a-writes** | `[ ]`  | Outbound 15s write timeouts (no auto-retry) & Stripe client timeout/TTL                                   |
| **Session 2** | **Phase 2 — Part 2A** |    **T1-b**     | `[ ]`  | Amend ADR-099 D23: no primary retry on `TIMEOUT` in OpenRouter gateway (`openrouter.ts`)                  |
| **Session 2** | **Phase 2 — Part 2A** |    **T1-d**     | `[ ]`  | Prisma `PrismaPg` pool config (`5s` connect, `max: 5`) & Redis `globalThis` + `commandTimeout: 3_000`     |
| **Session 3** | **Phase 2 — Part 2B** |    **T1-c**     | `[ ]`  | Update Stack D guard tests first, then add `import 'server-only'` across server-only `lib/**` modules     |
| **Session 4** | **Phase 2 — Part 2C** |    **T1-e**     | `[ ]`  | Add cached `requireAdminPage()` to 8 Admin RSC pages, harden disbursement health & middleware routes      |
| **Session 4** | **Phase 2 — Part 2C** |    **T1-f**     | `[ ]`  | Central CSRF check (`validateOrigin(req)`) in `middleware.ts` for non-GET `/api/**` + unit tests          |
| **Session 5** | **Phase 3 — Part 3A** |    **T2-a**     | `[ ]`  | `React.cache()` deduplication on session/appearance/locale/tutorials + Academy `after()`                  |
| **Session 5** | **Phase 3 — Part 3A** |    **T2-b**     | `[ ]`  | Contract-safe `Promise.all()` waterfall elimination (Stack D readers + Admin BI & Dashboard pages)        |
| **Session 6** | **Phase 3 — Part 3B** |    **T2-c**     | `[ ]`  | Explicit Prisma `select` on `User` reads, omit `paymentDetails` in affiliate profile, delete dead file    |
| **Session 6** | **Phase 3 — Part 3B** |    **T2-d**     | `[ ]`  | Sanitize raw `error.message` in `app/error.tsx` & 5 API routes + `global-error.tsx` logging               |
| **Session 6** | **Phase 3 — Part 3B** |    **T2-e**     | `[ ]`  | Security headers (`X-XSS-Protection` off, 2y HSTS, prod CSP) & Vercel Blob `attachment` hardening         |
| **Session 7** | **Phase 4 — Part 4A** |    **T3-a**     | `[ ]`  | Split 1.4 MB static locale bundle into dynamic chunks & wrap heavy charts/modals in `next/dynamic`        |
| **Session 7** | **Phase 4 — Part 4A** |    **T3-b**     | `[ ]`  | Convert 8 static `'use client'` marketing pages to RSC + narrow Landing `<Suspense>` + client leaves      |
| **Session 8** | **Phase 4 — Part 4B** |    **T3-c**     | `[ ]`  | Fix `use-currency-index-chart.ts` abort race & add `document.visibilityState` polling pause guards        |
| **Session 8** | **Phase 4 — Part 4B** |    **T3-d**     | `[ ]`  | Add segment-level `error.tsx` and `loading.tsx` boundaries                                                |
| **Session 8** | **Phase 4 — Part 4B** |    **T3-e**     | `[ ]`  | Coordinate CI `pnpm audit --prod --audit-level=high`, expand secret scan & add `dependabot.yml`           |

---

## 2. Session-by-Session Handoff Reports

> **Instructions for Claude Code:**
>
> - **At Session Start:** Read the handoff entry from the immediately preceding session below to understand what was changed, whether changes are committed or uncommitted, and any handoff notes left for your session.
> - **At Session End:** Fill in your session's section below (`Status`, `Date`, `Units Completed`, `Files Touched`, `Verification Results`, `Git Working Tree State`, and `Handoff Notes for Next Session`) and update the checkboxes in Section 1 above.

---

### Session 1 Handoff Report — Phase 1, Part 1A (`P0-a`, `P0-b`, `P0-c`, `P0-d`)

- **Status:** `COMPLETED`
- **Date:** 2026-10-17
- **Units Completed:** `P0-a`, `P0-b`, `P0-c`, `P0-d` (all four `⚠` gates for `P0-a`, `P0-c`, `P0-d` were authorized in Davin's session prompt)
- **Files Created / Modified / Deleted:**
  - **`P0-a`**
    - Deleted `app/api/test/seed/route.ts` (the empty `app/api/test/` directories went with it).
    - Modified `__tests__/lib/systemconfig-figures-guard.test.ts`: removed `'app/api/test/seed/route.ts'` and its comment from the `no price is assigned as a number literal` allow-list.
  - **`P0-b`**
    - Modified `lib/fraud/fraud-detection.service.ts` (470 → 205 lines): `'use server';` → `import 'server-only';`; deleted `runFraudChecks`, `createFraudAlerts`, `detectAndAlertFraud`, the five private checks (`checkThreeDayPlanAbuse`, `checkVelocityLimit`, `checkFailedPayments`, `checkIPCountryMismatch`, `checkSuspiciousIPChange`), the four threshold constants and the `FraudCheckContext` / `FraudCheckResult` types (nothing else in `app/`, `lib/`, `components/`, `__tests__/` referenced any of them). Kept `getFraudAlerts`, `getFraudAlertStats`, `updateFraudAlertStatus`, `blockUserFromFraudAlert` and the types `FraudAlertSeverity`, `FraudAlertStatus`, `FraudPattern`, `FraudAlertFilters`. Rewrote the module header (it described detection that no longer lives there).
    - Created `__tests__/lib/fraud/fraud-detection.service.test.ts` (not in the order; a small regression guard): the source has `import 'server-only'` and no `'use server'`, and the module exports exactly the four admin functions.
  - **`P0-c`**
    - Modified `lib/auth/auth-options.ts` (`callbacks.redirect`): relative paths need a single leading `/` and no `\`; absolute URLs need an exact origin match, or the apex↔www counterpart on the same scheme and port, or (only when `VERCEL_ENV === 'preview'`) `https:` and a host equal to `VERCEL_URL` / `VERCEL_BRANCH_URL`, or `localhost` / `127.0.0.1` over `http(s)` only when `NODE_ENV !== 'production'`. The blanket `.vercel.app` rule is gone. Not delegated to `safeCallbackUrl`.
    - Created `__tests__/lib/auth/redirect-callback.test.ts` (41 tests, through `authOptions.callbacks.redirect`).
  - **`P0-d`**
    - Modified `lib/csrf.ts`: `validateOrigin(request?: Request): Promise<boolean>`; the Origin is parsed and compared by origin, not by prefix; `csrfErrorResponse()` unchanged.
    - Created `__tests__/lib/csrf.test.ts` (51 tests; every case runs through both `validateOrigin(request)` and `validateOrigin()` over a mocked `next/headers`).
- **Verification Results (Exit Codes & Test Counts):**
  - `npx tsc --noEmit`: exit `0` after each unit and again at the end.
  - `npx eslint <touched files> --max-warnings 0`: exit `0` after each unit and for all 7 touched `.ts` files together at the end.
  - `npx jest --coverage=false` (per unit):
    - `P0-a`: `__tests__/lib/systemconfig-figures-guard.test.ts` — 1 suite, 6 tests, pass.
    - `P0-b`: new fraud test + the 3 existing fraud UI suites — 4 suites, 47 tests, pass. (There is no `__tests__/api/admin/fraud*`; no test imports the service directly.)
    - `P0-c`: `__tests__/lib/auth` + `__tests__/api/auth` — 11 suites, 235 tests, pass.
    - `P0-d`: `__tests__/lib/csrf.test.ts` + `__tests__/api/auth` + both `view-as` route tests (they mock `@/lib/csrf`) — 8 suites, 100 tests, pass.
  - Combined regression run at the end (`__tests__/api`, `__tests__/lib/auth`, `__tests__/lib/fraud`, `__tests__/lib/csrf.test.ts`, the figures guard, `__tests__/pages/admin`, `__tests__/components/admin`): **95 suites, 1462 tests, 0 failed, exit `0`**.
  - Red check: run against the old `redirect` callback the new test file fails 18 of 41; run against the old `lib/csrf.ts` it fails 35 of 51 (so the tests do detect the vulnerabilities).
  - `npm run build` was **not** run (Session 1 does not require it).
  - Running a subset with plain `npx jest <file>` prints `"global" coverage threshold … not met` lines because the repo's `jest.config.js` enforces global coverage; use `--coverage=false` for targeted runs.
- **Git Working Tree State:** **Committed locally on `main` as `f7a9e09b` (on Davin's word, by explicit paths: the 5 source files, the 3 new test files, the guard-test edit, this log and the 4 `.claude/state` files); not pushed, not deployed.** The pre-commit hook (lint-staged: ESLint `--fix` + Prettier) reformatted a few staged files; I re-ran ESLint (exit `0`), `tsc` (exit `0`) and Jest on the committed state: 14 suites, 294 tests, pass. Left uncommitted because they are not Session 1's: the many changes that were already in the tree (deleted `mobile-app/**` and `davintrade-nest-js-checklists/*`, modified `davintrade-next-js-checklists/nextjs-production-remediation-master-plan.md`, the untracked `davintrade-next-js-checklists/nextjs-remediation-handoff-for-claude-code.md` and `nextjs-session-prompts-for-davin.md`, other untracked folders). This log links to the handoff file, which is still untracked.
- **Read-only production check for Davin (`P0-a`)** — run against the production database. The live route seeded six `@trading-alerts.test` users and `AffiliateCode` rows (not `admin@test.com` / `DiscountCode` as the handoff's example SQL says; that SQL would error or match nothing). Table names assume Prisma's default mapping (no `@@map` on these models). If any row exists, deactivate or delete it; also confirm `TEST_SECRET` is not set to a guessable value in any deployment.

  ```sql
  SELECT id, email, role, tier, "isActive", "createdAt"
  FROM "User"
  WHERE email LIKE '%@trading-alerts.test';

  SELECT code, status, "discountPercent", "commissionPercent", "expiresAt", "usedBy"
  FROM "AffiliateCode"
  WHERE code IN ('TESTCODE10', 'TESTCODE20');

  SELECT s."userId", s.status, s."planType", s."expiresAt"
  FROM "Subscription" s JOIN "User" u ON u.id = s."userId"
  WHERE u.email LIKE '%@trading-alerts.test';

  SELECT p."userId", p.status
  FROM "AffiliateProfile" p JOIN "User" u ON u.id = p."userId"
  WHERE u.email LIKE '%@trading-alerts.test';
  ```

- **Deviations (plan vs live code — live code won, rule 7):**
  1. `P0-a`: the handoff describes `isDev` / `'test-secret'` and accounts `admin@test.com` etc.; the live route used `ALLOWED_ENVIRONMENTS` + `process.env['TEST_SECRET'] || 'test-secret'` and `*@trading-alerts.test` accounts (the master plan is right). Same conclusion: delete.
  2. `P0-b`: the handoff says the four kept functions "call `requireAdmin()`". **They do not — no function in this file ever did.** With the old top-level `'use server'`, all seven exports were Server Actions with no authorization (`blockUserFromFraudAlert` deactivates a user). The only authorization is `requireAdmin()` in the two route handlers (`app/api/admin/fraud-alerts/route.ts`, `…/[id]/route.ts`). The helper names in both plans were wrong; the real ones are listed above. The new header comment says the module does no authorization itself.
  3. `P0-b`: `import 'server-only';` sits under the module doc comment, not on line 1 (the file's header comment stays first).
  4. `P0-c`: the localhost branch also requires an `http:` / `https:` scheme (the plan's snippet did not), so `javascript://localhost/%0A…` is refused outside production. It uses the file's existing `Reflect.get(process.env, 'NODE_ENV')` idiom and bracket access (`process.env['VERCEL_URL']`) because of `noPropertyAccessFromIndexSignature`.
  5. `P0-d`: the handoff snippet and the master-plan decisions disagree. I followed the master plan's (a superset): besides `https://${host}` (and `http://${host}` only outside production) the allowed origins include the `NEXTAUTH_URL` origin (the old code allowed it), and each is also matched with its apex/www counterpart on the same scheme and port. The `x-forwarded-host` header is read first (first entry of a comma list), then `host`. An unparsable Origin (including the literal `null`) is refused.
- **Handoff Notes for Session 2 (and Session 4 regarding `validateOrigin(request?)`):**
  - **`validateOrigin(request?: Request): Promise<boolean>`** (`lib/csrf.ts`) — Session 4 / `T1-f` can call `validateOrigin(req)` with the `NextRequest`; the no-argument form for Route Handlers is unchanged. It decides only on `Origin` / `Sec-Fetch-Site`. **Method filtering (skip `GET` / `HEAD` / `OPTIONS`) and the machine-to-machine exemptions are the middleware's job**, and nothing in `validateOrigin` skips them. Without `Origin`: `Sec-Fetch-Site` of `cross-site` or `same-site` → `false`; `same-origin`, `none` or absent (non-browser client) → `true`.
  - **Check in Session 4:** `lib/csrf.ts` imports `headers` from `next/headers` at the top level. I did not build with it imported into `middleware.ts` (edge). Run `npm run build` in `T1-f`; if the edge bundle objects, switch the no-argument branch to `await import('next/headers')`.
  - **Wider effect than the plan states:** 12 route files call `validateOrigin()` (all of `app/api/auth/{forgot-password,resend-verification,reset-password,token-forgot-password,token-login,token-logout,token-refresh,token-register,token-resend-verification,token-reset-password}` and `app/api/admin/{users,affiliates}/view-as`), not only `token-login`. They are now stricter in production: `http://` origins, prefix spoofs, other ports and `Sec-Fetch-Site: cross-site|same-site` without `Origin` are refused. A native client that sends neither `Origin` nor `Sec-Fetch-Site` still passes. A webview that sends `Origin: capacitor://localhost` was refused before and still is.
  - **`P0-c` side effect:** preview deployments are accepted only at this deployment's own `VERCEL_URL` / `VERCEL_BRANCH_URL`. A custom alias domain on a preview, or a `callbackUrl` pointing to a different preview deployment, now falls back to `baseUrl`.
  - **`import 'server-only'` in `lib/`:** `lib/fraud/fraud-detection.service.ts` is now the first file in `lib/` to use it (the handoff said none did). It loads under `next/jest` (the new test imports the module). `T1-c` (Session 3) does not list `lib/fraud/**`, so it needs no change there; do not add it twice.
  - **Not touched, for Davin to decide:** `frontend/` is a tracked snapshot (553 files; `jest.config.js` calls it a "stale pre-V8 snapshot", excluded from `tsconfig.json` and Jest) with its own `package.json` and a `vercel.json` (`NEXT_PUBLIC_DEPLOYMENT_TYPE: modular-frontend`). It still contains `frontend/app/api/test/seed/route.ts` with the same `'test-secret'` fallback, `frontend/lib/csrf.ts` with the same `origin.startsWith(allowed)` check, and `frontend/lib/fraud/fraud-detection.service.ts` still starting with `'use server'`. (Its `auth-options.ts` has no `.vercel.app` rule; I did not review it further.) If any Vercel project uses `frontend/` as its root directory, those are live copies of the `P0-a`, `P0-b` and `P0-d` holes and need their own order or deletion of the snapshot. `e2e/archive/{global.setup.ts,global.teardown.ts,utils/api-helpers.ts}` still call `/api/test/seed`; no workflow under `.github/` and no `package.json` script references `e2e/archive`. They were left alone.

---

### Session 2 Handoff Report — Phase 2, Part 2A (`T1-a`, `T1-a-writes`, `T1-b`, `T1-d`)

- **Status:** `PENDING`
- **Date:** _TBD_
- **Units Completed:** _None yet_
- **Files Created / Modified / Deleted:**
  - _To be filled by Session 2_
- **Verification Results (Exit Codes & Test Counts):**
  - `npx tsc --noEmit`: _TBD_
  - `npx eslint`: _TBD_
  - `npx jest`: _TBD_
- **Git Working Tree State:** _TBD_
- **Handoff Notes for Session 3:**
  - _To be filled by Session 2_

---

### Session 3 Handoff Report — Phase 2, Part 2B (`T1-c`)

- **Status:** `PENDING`
- **Date:** _TBD_
- **Units Completed:** _None yet_
- **Files Created / Modified / Deleted:**
  - _To be filled by Session 3_
- **Verification Results (Exit Codes & Test Counts):**
  - `npx tsc --noEmit`: _TBD_
  - `npx eslint`: _TBD_
  - `npx jest`: _TBD_
  - `npm run build`: _TBD_
- **Git Working Tree State:** _TBD_
- **Handoff Notes for Session 4:**
  - _To be filled by Session 3_

---

### Session 4 Handoff Report — Phase 2, Part 2C (`T1-e`, `T1-f`)

- **Status:** `PENDING`
- **Date:** _TBD_
- **Units Completed:** _None yet_
- **Files Created / Modified / Deleted:**
  - _To be filled by Session 4_
- **Verification Results (Exit Codes & Test Counts):**
  - `npx tsc --noEmit`: _TBD_
  - `npx eslint`: _TBD_
  - `npx jest`: _TBD_
- **Git Working Tree State:** _TBD_
- **Handoff Notes for Session 5 (especially `getSession()` / `requireAdminPage()` in `lib/auth/session.ts`):**
  - _To be filled by Session 4_

---

### Session 5 Handoff Report — Phase 3, Part 3A (`T2-a`, `T2-b`)

- **Status:** `PENDING`
- **Date:** _TBD_
- **Units Completed:** _None yet_
- **Files Created / Modified / Deleted:**
  - _To be filled by Session 5_
- **Verification Results (Exit Codes & Test Counts):**
  - `npx tsc --noEmit`: _TBD_
  - `npx eslint`: _TBD_
  - `npx jest`: _TBD_
- **Git Working Tree State:** _TBD_
- **Handoff Notes for Session 6:**
  - _To be filled by Session 5_

---

### Session 6 Handoff Report — Phase 3, Part 3B (`T2-c`, `T2-d`, `T2-e`)

- **Status:** `PENDING`
- **Date:** _TBD_
- **Units Completed:** _None yet_
- **Files Created / Modified / Deleted:**
  - _To be filled by Session 6_
- **Verification Results (Exit Codes & Test Counts):**
  - `npx tsc --noEmit`: _TBD_
  - `npx eslint`: _TBD_
  - `npx jest`: _TBD_
  - `npm run build`: _TBD_
- **Git Working Tree State:** _TBD_
- **Handoff Notes for Session 7:**
  - _To be filled by Session 6_

---

### Session 7 Handoff Report — Phase 4, Part 4A (`T3-a`, `T3-b`)

- **Status:** `PENDING`
- **Date:** _TBD_
- **Units Completed:** _None yet_
- **Files Created / Modified / Deleted:**
  - _To be filled by Session 7_
- **Verification Results (Exit Codes & Test Counts):**
  - `npx tsc --noEmit`: _TBD_
  - `npx eslint`: _TBD_
  - `npx jest`: _TBD_
  - `npm run build`: _TBD_
- **Git Working Tree State:** _TBD_
- **Handoff Notes for Session 8:**
  - _To be filled by Session 7_

---

### Session 8 Handoff Report — Phase 4, Part 4B (`T3-c`, `T3-d`, `T3-e`) — Final Closeout

- **Status:** `PENDING`
- **Date:** _TBD_
- **Units Completed:** _None yet_
- **Files Created / Modified / Deleted:**
  - _To be filled by Session 8_
- **Verification Results (Exit Codes & Test Counts):**
  - `npx tsc --noEmit`: _TBD_
  - `npx eslint`: _TBD_
  - `npm test`: _TBD_
  - `npm run build`: _TBD_
- **Git Working Tree State:** _TBD_
- **Final Remediation Summary:**
  - _To be filled by Session 8_
