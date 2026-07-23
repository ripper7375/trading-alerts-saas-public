# Migration Order — Next.js 16 Upgrade & Codemods (`next@16.2.10`)

> `TEMPLATE-UPGRADE.md` variant. Read `00-SKELETON-AND-RULES.md` §4 first.
> **Creativity dial: Medium** — how you fix breakages is yours; "no behavior change, no
> metric regression" is not. One variable at a time: this session performs the
> **Next.js 16 Upgrade & Codemods ONLY** — no schema changes, no database migrations, no
> feature additions or architectural refactoring.
> **Status: CLOSED** — executed end-to-end and closed on 2026-07-23. All-green verification.
> 2026-07-23.

**Session:** 5-2 · **Phase:** Phase 5 (Next.js 16 Upgrade) · **Variant:** UPGRADE · **Status:** CLOSED ·
**Generated:** 2026-07-23 · **Flags touched:** F10 (Next.js 15→16 upgrade execution) ·
**Estimated time:** ~2.5h (version bump, codemods, manual fixes, build & Vercel preview verification).
**From → To:**

- `next`: `15.5.20` → `16.2.10` (root `package.json` target pinned per F2 in `DECISION-LOG.md`)
- `eslint-config-next`: `15.5.20` → `16.2.10`
- `@next/swc-win32-x64-msvc`: `15.5.20` → `16.2.10`
- `@next/bundle-analyzer`: `^16.1.1` (peer compatibility verified)
- `react`: `^19.2.1` (React 19 peer compatibility verified)

---

## Context & Strategy Background

- **Phase 5 Context:** Session 5-1 completed the read-only breaking-change audit and established pre-upgrade baselines (F10). Session 5-2 executes the framework bump to `next@16.2.10`, runs official Next.js 16 codemods, applies targeted manual fixes for cataloged hits, and verifies local builds and Vercel preview deployments.
- **Session 5-1 Audit Findings (Inputs for Session 5-2):**
  - **Async APIs (`cookies()`, `headers()`, `params`):** Already updated and awaited across key auth/webhook/chart routes (`app/api/auth/token-*`, `app/api/webhooks/stripe/route.ts`, `app/(dashboard)/charts/[symbol]/[timeframe]/page.tsx`).
  - **`useSearchParams()` Client Components:** Components in `app/(auth)/` (`forgot-password`, `reset-password`, `verify-2fa`, `verify-email`), `app/pricing/page.tsx`, and `app/(dashboard)/admin/` (`disbursement/audit`, `disbursement/transactions`) must be verified to sit inside `<Suspense>` boundaries per Next.js 16 requirements.
  - **Config & Peer Deps:** `next.config.js` experimental options (`experimental.serverActions`, `turbopack`) and peer dependencies must be aligned with Next 16 schema.

### Session 5-1 Audit Hit-List & Breaking Change Inventory

| Category / Vector                 | File Path / Target                                                                                                       | Line / Context | Existing Pattern                                              | Required Strategy in Session 5-2                                                     |
| :-------------------------------- | :----------------------------------------------------------------------------------------------------------------------- | :------------- | :------------------------------------------------------------ | :----------------------------------------------------------------------------------- |
| **Async `cookies()`**             | `app/api/auth/token-2fa-backup-codes/route.ts`                                                                           | L47, L63       | `const cookieStore = await cookies();`                        | **Clean:** Already using `await cookies()`. Verify under Next 16 runtime.            |
| **Async `cookies()`**             | `app/api/auth/token-2fa-disable/route.ts`                                                                                | L18            | `const cookieStore = await cookies();`                        | **Clean:** Already using `await cookies()`. Verify under Next 16 runtime.            |
| **Async `cookies()`**             | `app/api/auth/token-2fa-setup/route.ts`                                                                                  | L21            | `const cookieStore = await cookies();`                        | **Clean:** Already using `await cookies()`. Verify under Next 16 runtime.            |
| **Async `cookies()`**             | `app/api/auth/token-2fa-status/route.ts`                                                                                 | L21            | `const cookieStore = await cookies();`                        | **Clean:** Already using `await cookies()`. Verify under Next 16 runtime.            |
| **Async `cookies()`**             | `app/api/auth/token-2fa-verify-setup/route.ts`                                                                           | L20            | `const cookieStore = await cookies();`                        | **Clean:** Already using `await cookies()`. Verify under Next 16 runtime.            |
| **Async `cookies()`**             | `app/api/auth/token-login/route.ts`                                                                                      | L90            | `const cookieStore = await cookies();`                        | **Clean:** Already using `await cookies()`. Verify under Next 16 runtime.            |
| **Async `cookies()`**             | `app/api/auth/token-logout/route.ts`                                                                                     | L19            | `const cookieStore = await cookies();`                        | **Clean:** Already using `await cookies()`. Verify under Next 16 runtime.            |
| **Async `cookies()`**             | `app/api/auth/token-refresh/route.ts`                                                                                    | L36            | `const cookieStore = await cookies();`                        | **Clean:** Already using `await cookies()`. Verify under Next 16 runtime.            |
| **Async `headers()`**             | `app/api/webhooks/stripe/route.ts`                                                                                       | L58            | `const headersList = await headers();`                        | **Clean:** Already using `await headers()`. Verify under Next 16 runtime.            |
| **Async `params` Prop**           | `app/(dashboard)/charts/[symbol]/[timeframe]/page.tsx`                                                                   | L23, L65       | `const { symbol, timeframe } = await params;`                 | **Clean:** Already typed as `Promise<{...}>` and awaited.                            |
| **Client Hook `useParams`**       | `app/(dashboard)/admin/disbursement/batches/[batchId]/page.tsx`                                                          | L160           | `useParams<{ batchId: string }>()`                            | **Clean:** Client component hook. No async issue.                                    |
| **Client Hook `useParams`**       | `app/(dashboard)/admin/fraud-alerts/[id]/page.tsx`                                                                       | L100           | `useParams()`                                                 | **Clean:** Client component hook. No async issue.                                    |
| **Client Hook `useParams`**       | `app/admin/affiliates/[id]/page.tsx`                                                                                     | L66            | `useParams()`                                                 | **Clean:** Client component hook. No async issue.                                    |
| **Client Hook `useSearchParams`** | `app/(auth)/forgot-password/page.tsx`, `reset-password`, `verify-2fa`, `verify-email`, `pricing`, `admin/disbursement/*` | Various        | `useSearchParams()` in `'use client'`                         | Ensure wrapped in `<Suspense>` per Next.js 16 requirements.                          |
| **Middleware Specs**              | `middleware.ts`                                                                                                          | L19-L65        | `getToken()` + `NextResponse.redirect()`                      | Verify matcher & token decoding behavior under Next 16 middleware runtime.           |
| **Next.js Config**                | `next.config.js`                                                                                                         | L52-L57        | `experimental.serverActions`                                  | Update `experimental.serverActions` to stable Next 16 config schema.                 |
| **Next.js Config**                | `next.config.js`                                                                                                         | L60            | `turbopack: {}`                                               | Validate Turbopack options against Next 16 config schema.                            |
| **Peer Dependencies**             | `package.json`                                                                                                           | L142, L160     | `@next/bundle-analyzer^16.1.1`, `eslint-config-next: 15.5.20` | Align `eslint-config-next` to `16.2.10` and `@next/swc-win32-x64-msvc` to `16.2.10`. |

---

## Entry criteria

- [x] Official Next.js 15→16 upgrade guide and breaking change guide consulted (`https://nextjs.org/docs/app/building-your-application/upgrading/version-16`).
- [x] Session 5-1 read-only audit completed and hit-list verified ([5-1-nextjs16-upgrade-audit.migration-order.md](file:///d:/SaaS%20Project/trading-alerts-saas-public/docs/migration-orders/5-1-nextjs16-upgrade-audit.migration-order.md)).
- [x] Pre-upgrade baseline re-confirmed (`npm run test:ci` passing 117/117 suites, 2082/2082 tests; `npm run type-check` 0 errors).
- [x] Metric baselines recorded (`.next` target `<340MB`, warning `<450MB`; CWV targets: LCP `≤2.5s`, INP `≤200ms`, CLS `≤0.10`, TTFB `≤800ms`).
- [x] Blast-radius statement: Next.js 16 bump affects `package.json`, `pnpm-lock.yaml`, `next.config.js`, `middleware.ts`, `app/(auth)/*`, `app/(dashboard)/*`, `app/api/*`.
- [x] Vercel environment linked and authenticated for preview build verification (`vercel link`).
- [x] Davin approval of this Session 5-2 order (Status: PRE-DRAFT → DRAFT → APPROVED).

---

## Ordered steps

1. **Package Version Bumps:**
   - Update [package.json](file:///d:/SaaS%20Project/trading-alerts-saas-public/package.json) to set `next: "16.2.10"`, `eslint-config-next: "16.2.10"`, and `@next/swc-win32-x64-msvc: "16.2.10"`.
   - Verify compatibility of `@next/bundle-analyzer^16.1.1` and `react@^19.2.1` without peer dependency conflicts.
   - Run `pnpm install` (or `npm install`) to resolve dependencies and write updated lockfile (`pnpm-lock.yaml`).
   - _Verify:_ Lockfile updated cleanly with 0 dependency resolution warnings/errors.

2. **Execute Codemods & Targeted Manual Fixes:**
   - Run official Next.js 16 codemods: `npx @next/codemod@latest upgrade next-16`.
   - Apply targeted manual fixes based on Session 5-1 hit-list:
     - **Client `<Suspense>` Boundaries:** Inspect `app/(auth)/forgot-password/page.tsx`, `app/(auth)/reset-password/page.tsx`, `app/(auth)/verify-2fa/page.tsx`, `app/(auth)/verify-email/page.tsx`, `app/pricing/page.tsx`, `app/(dashboard)/admin/disbursement/audit/page.tsx`, and `app/(dashboard)/admin/disbursement/transactions/page.tsx`. Ensure all components accessing `useSearchParams()` are wrapped in `<Suspense>` boundaries per Next.js 16 requirements.
     - **`next.config.js` Config Schema:** Update `experimental.serverActions` and `turbopack` options in [next.config.js](file:///d:/SaaS%20Project/trading-alerts-saas-public/next.config.js) to conform to Next.js 16 configuration schema.
     - **Middleware & Async Context Verification:** Verify [middleware.ts](file:///d:/SaaS%20Project/trading-alerts-saas-public/middleware.ts) (L19-L65) token decoding and matcher routing under Next.js 16 runtime environment.
   - _Verify:_ Codemods and manual edits complete; project compiles cleanly without schema deprecation warnings.

3. **Local Build & Parity Verification:**
   - Execute `npm run type-check` — verify 0 TypeScript compilation errors.
   - Execute `npm run validate:lint` — verify 0 ESLint errors/warnings.
   - Execute `npm run build` — verify Next.js 16 production build succeeds and output size meets `<340MB` target (`<450MB` warning limit).
   - Execute `npm run test:ci` — verify all 117 test suites (2082 tests) pass green with zero regressions.
   - _Verify:_ Clean build, 0 type errors, 117/117 test suites green, bundle size within target.

4. **Vercel Preview Deployment Verification:**
   - Trigger Vercel preview deployment (`vercel` or push branch to trigger preview build).
   - **Deploy gate:** Deploy to preview environment.
   - Inspect Vercel preview build logs to ensure clean compilation without remote bundling warnings or errors.
   - Access public preview URL and conduct functional smoke checks on key routes (`/login`, `/dashboard`, `/pricing`, `/admin/disbursement/audit`, `/charts/BTCUSDT/1h`).
   - _Verify:_ Vercel preview deployment active & functioning green on live preview URL.

---

## Rules specific to this variant

- **Fix Forward or Roll Back:** Fix forward within the session or roll back fully — never leave a half-upgraded state.
- **Semantics & Findings:** A test failure after the Next.js 16 bump is a finding to be investigated, not a test to be blindly modified (per Lesson L3).
- **Scope Isolation:** Do not introduce code refactoring, schema changes, or UI redesigns in this upgrade session. One variable at a time.
- **Peer Dependencies:** Ensure `@next/bundle-analyzer` and `eslint-config-next` remain aligned with `next@16.2.10`.

---

## Done when

- [x] `package.json` and lockfile updated to `next@16.2.10`, `eslint-config-next@16.2.10`, `@next/swc-win32-x64-msvc@16.2.10`.
- [x] All codemods and manual hit-list fixes applied cleanly with zero build or deprecation errors.
- [x] Type check (`npm run type-check`) and lint (`npm run validate:lint`) pass with 0 errors.
- [x] Production build (`npm run build`) succeeds within target thresholds (`<340MB`).
- [x] Full test suite (`npm run test:ci`) passes 117/117 suites (2082 tests).
- [x] Vercel preview deployment verified live and functional on preview URL.
- [x] F10 execution results documented in `DECISION-LOG.md`.

---

## Rollback

Revert git commit and restore previous `package.json` / `pnpm-lock.yaml`. Clean rollback because no database schema migrations or stateful backend changes are executed in this frontend framework bump. Re-promote clean production deployment on Vercel if needed.

---

## Deviations

1. **`lucide-react` `modularizeImports` Removed from `next.config.js`:** The legacy `modularizeImports` configuration for `lucide-react` (`transform: 'lucide-react/dist/esm/icons/{{kebabCase member}}'`) in Next 15 appended `-icon` suffixes to icon filenames during build (e.g. `arrow-down-icon`), causing module resolution failures under Next 16 Turbopack. Removed `modularizeImports` for `lucide-react` as Next.js 16 natively tree-shakes `lucide-react` via standard ESM export maps.
2. **`transpilePackages: ['ioredis']` Added to `next.config.js`:** Added `transpilePackages: ['ioredis']` to ensure Turbopack transpiles `ioredis` CJS internal imports (`built/Command.js`) cleanly during Next 16 production bundling.
3. **TypeScript Prisma Decimal-to-Number Cast Aligments:** Fixed strict TypeScript 5.4/Next 16 type errors where Prisma `_sum` aggregate types (`Decimal | null`) were assigned to `number` parameters in `lib/affiliate/report-builder.ts` (`thisMonth`/`lastMonth` `_sum`), `lib/auth/session.ts` (`totalEarnings`), `lib/disbursement/services/batch-manager.ts` (`totalAmount`/`totalPayments`), `lib/disbursement/services/commission-aggregator.ts` (`commissionAmount`), and `lib/stripe/webhook-handlers.ts` (`Number(updatedProfile.totalEarnings)`).
4. **Dev Dependency Add:** Added `@testing-library/dom` explicitly to `package.json` `devDependencies` to ensure Jest test runner resolves `@testing-library/user-event` peer dependencies cleanly across node environment changes.

---

## Next-session handoff

Session 5-3 (`docs/migration-orders/5-3-bundle-component-optimizations.migration-order.md` — Bundle & Component Optimizations (`bundle-size-optimization/**` rules: code-splitting, dynamic imports, client→server component conversions)).
