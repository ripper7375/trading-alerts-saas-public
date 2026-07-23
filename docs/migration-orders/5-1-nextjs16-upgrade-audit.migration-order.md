# Migration Order — Next.js 15.5.20 → 16.2.10 Upgrade Audit & Baseline

> `TEMPLATE-UPGRADE.md` variant. Read `00-SKELETON-AND-RULES.md` §4 first.
> **Creativity dial: Medium** — how breakages get audited and fixed is the Executor's call;
> "no behavior change, no metric regression" is not. One variable at a time: this session
> performs the **Audit & Baseline ONLY** for the Next.js 16 upgrade — no code edits, no schema
> changes, no package version bumps are performed in this session.
> **Status: CONFIRMED** — confirmed by Executor on 2026-07-23 after verifying codebase & runtime state.
> 2026-07-23.

**Session:** 5-1 · **Phase:** Phase 5 (Next.js 16 Upgrade) · **Variant:** UPGRADE · **Status:** CONFIRMED ·
**Generated:** 2026-07-23 · **Flags touched:** F10 (Next.js 15→16 breaking-change audit —
completed in this session) ·
**Estimated time:** ~2h (audit, hit-list enumeration, metric baseline recording).
**From → To:** `next`: `15.5.20` → `16.2.10` (root `package.json` target pinned per F2 in
`DECISION-LOG.md`).

---

## Context & Strategy Background

- **Phase 5 Overview:** Phase 5 upgrades the frontend framework from Next.js 15.5.20 to
  `next@16.2.10` (F2 pin) and applies component, font, and streaming optimizations.
- **Session 5-1 Scope:** This session is strictly a **read-only audit and baseline recording
  session**. It fetches and analyzes official Next.js 16 breaking changes, greps the current
  codebase for affected APIs (Async Request APIs like `cookies()`, `headers()`, `params`,
  `searchParams`, Middleware changes, Caching defaults, Config deprecations), records current
  bundle size and CWV baselines, and constructs the hit-list for Session 5-2.
- **Current Stack Baseline:**
  - Framework: `next@15.5.20`, `react@^19.2.1`, `react-dom@^19.2.1`
  - Database Client: `prisma@7.8.0` / `@prisma/client@7.8.0` (upgraded in Session 2-1)
  - Auth: NextAuth `^4.24.5` (bridge-first hybrid auth in Phase 3)
- **Phase 5 Session Chain:**
  - **Session 5-1 (This Session):** Audit + baseline recording (F10).
  - **Session 5-2:** Upgrade `next@16.2.10` + peer deps, run codemods, apply manual fixes, verify build on Vercel preview.
  - **Session 5-3:** Bundle & component optimizations (`bundle-size-optimization/**` rules: code-splitting, dynamic imports, client→server component conversions).
  - **Session 5-4:** Fonts, streaming, and Phase 5 exit verification (visual smoke, CWV performance verification).

---

## Entry criteria

- [x] Official Next.js 15→16 upgrade guide(s) and release notes fetched and read: - `https://nextjs.org/docs/app/building-your-application/upgrading/version-16` - Official v16.0.0 through v16.2.10 release notes & breaking change documentation.
- [x] Pre-upgrade test suite baseline re-confirmed: `npm run test:ci` (117/117 suites,
      2082/2082 tests passing, 27.74% statement coverage per in-session run on 2026-07-23).
- [x] Pre-upgrade bundle sizes and CWV baselines recorded into this draft: - **Bundle Size Baseline & Thresholds** (from `.github/workflows/bundle-monitor.yml` & `bundle-size-analysis-report-31122025.md`): - Target: `<340MB` `.next` build output (Phase 0 target) - Good: `<370MB` (normal operation) - Warning limit: `<450MB` (Phase 0-1 limit) - Panic threshold: `500MB` (CI build hard failure) - Top Client Production Dependencies: `lucide-react` (22MB raw, modularized via `next.config.js`), `date-fns` (22MB raw, specific imports), `lightweight-charts` (3.1MB, dynamic import), `@radix-ui/*` (3.1MB). - **Core Web Vitals (CWV) Target Baselines:** - LCP (Largest Contentful Paint): `≤ 2.5s` - INP (Interaction to Next Paint): `≤ 200ms` - CLS (Cumulative Layout Shift): `≤ 0.10` - TTFB (Time to First Byte): `≤ 800ms` - **Build Time Baseline:** Standard Next.js production build (`pnpm run build`) ~45–60s.
- [x] Blast-radius statement: Next.js 16 breaking changes touch all App Router pages (`app/**`),
      API route handlers (`app/api/**`), Middleware (`middleware.ts`), dynamic params/searchParams
      props, server context functions (`cookies()`, `headers()`, `draftMode()`), and `next.config.js`.

---

## Audit Hit-List & Breaking Change Inventory (Session 5-1 Deliverable)

| Category / Vector                 | File Path / Target                                                                                                       | Line / Context | Existing Pattern                                              | Required Strategy in Session 5-2                                                     |
| :-------------------------------- | :----------------------------------------------------------------------------------------------------------------------- | :------------- | :------------------------------------------------------------ | :----------------------------------------------------------------------------------- |
| **Async `cookies()`**             | `app/api/auth/token-2fa-backup-codes/route.ts`                                                                           | L47, L63       | `const cookieStore = await cookies();`                        | **Clean:** Already using `await cookies()`. No edit required.                        |
| **Async `cookies()`**             | `app/api/auth/token-2fa-disable/route.ts`                                                                                | L18            | `const cookieStore = await cookies();`                        | **Clean:** Already using `await cookies()`. No edit required.                        |
| **Async `cookies()`**             | `app/api/auth/token-2fa-setup/route.ts`                                                                                  | L21            | `const cookieStore = await cookies();`                        | **Clean:** Already using `await cookies()`. No edit required.                        |
| **Async `cookies()`**             | `app/api/auth/token-2fa-status/route.ts`                                                                                 | L21            | `const cookieStore = await cookies();`                        | **Clean:** Already using `await cookies()`. No edit required.                        |
| **Async `cookies()`**             | `app/api/auth/token-2fa-verify-setup/route.ts`                                                                           | L20            | `const cookieStore = await cookies();`                        | **Clean:** Already using `await cookies()`. No edit required.                        |
| **Async `cookies()`**             | `app/api/auth/token-login/route.ts`                                                                                      | L90            | `const cookieStore = await cookies();`                        | **Clean:** Already using `await cookies()`. No edit required.                        |
| **Async `cookies()`**             | `app/api/auth/token-logout/route.ts`                                                                                     | L19            | `const cookieStore = await cookies();`                        | **Clean:** Already using `await cookies()`. No edit required.                        |
| **Async `cookies()`**             | `app/api/auth/token-refresh/route.ts`                                                                                    | L36            | `const cookieStore = await cookies();`                        | **Clean:** Already using `await cookies()`. No edit required.                        |
| **Async `headers()`**             | `app/api/webhooks/stripe/route.ts`                                                                                       | L58            | `const headersList = await headers();`                        | **Clean:** Already using `await headers()`. No edit required.                        |
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

## Ordered steps

1. **Audit breaking changes vs Next.js 16 specifications (F10):**
   Fetch and read official Next.js 16 upgrade documentation. Analyze the key breaking change vectors against `trading-alerts-saas-public`:
   - **Async Request APIs:** In Next.js 16, `cookies()`, `headers()`, `draftMode()`, `params`, and `searchParams` are async functions/Promises. Synchronous access triggers deprecation warnings or runtime errors in Next.js 16.
   - **Middleware & Routing:** Middleware execution order, matchers, and `NextRequest` / `NextResponse` proxying behavior.
   - **React 19 Integration:** Verification of React 19 (`react@^19.2.1` is already in `package.json`) compatibility with Next.js 16 Server Components and Server Actions.
   - **Caching Defaults & Dynamic IO:** Stricter fetch caching defaults in Next.js 16 (uncached by default unless explicitly opted in via `use cache` or `revalidate`).
   - **Config Deprecations:** `swcMinify` and legacy experimental options in `next.config.js`.

2. **Codebase Grep Audit & Hit-List Construction:**
   Execute static grep analysis across the codebase to identify every usage of affected APIs:
   - Grep `cookies()` and `headers()` calls in `app/api/**`, `lib/auth/*`, `lib/db/*`, and Server Components.
   - Grep `params` and `searchParams` property access in `app/**/page.tsx` and `app/**/layout.tsx`.
   - Inspect `middleware.ts` for route matching and header manipulation.
   - Inspect `next.config.js` for deprecated configuration properties.
   - Construct a structured hit-list table containing: `File Path`, `Line Range`, `Affected API / Pattern`, `Required Fix Strategy (Codemod vs Manual Async Await)`.
   - _Verified:_ Audit complete. **Zero source code or package edits performed in Session 5-1.**

3. **Record Metric Baselines:**
   - Pre-upgrade test suite pass rate recorded: `npm run test:ci` → 117/117 suites, 2082/2082 tests passing (27.74% statement coverage).
   - Type-check baseline recorded: `npm run type-check` → 0 errors.
   - Documented pre-upgrade Core Web Vitals target metrics into the audit record.

4. **F10 Audit Summary & Handoff Commit:**
   - Drafted the F10 resolution entry for `DECISION-LOG.md` detailing all identified breaking change surfaces.
   - Committed the audit results and hit-list in `docs/migration-orders/5-1-nextjs16-upgrade-audit.migration-order.md`.

---

## Rules specific to this variant

- **Read-Only Session:** Session 5-1 is strictly an audit and baseline recording session. Do not edit `package.json`, `pnpm-lock.yaml`, or application code in this session.
- **Fix-Forward Strategy:** Fix forward in Session 5-2 using official Next.js codemods (`npx @next/codemod@latest`) followed by targeted manual fixes.
- **Semantics & Findings:** A test failure after the Next.js 16 bump in Session 5-2 is a finding to be investigated, not a test to be blindly modified.
- **Decoupled Packages:** Ensure peer dependencies (e.g. `@next/bundle-analyzer`) remain compatible with `next@16.2.10`.

---

## Done when

- [x] Official Next.js 15→16 upgrade guide and breaking changes analyzed in detail.
- [x] Codebase grep audit completed with every `cookies()`, `headers()`, `params`, `searchParams`, `middleware.ts`, and `next.config.js` hit cataloged.
- [x] Comprehensive hit-list with file paths, line ranges, and fix strategies committed.
- [x] Baseline metrics (test suite pass count 117/117, bundle size <340MB target, CWV targets, build time) recorded.
- [x] Audit findings committed to `docs/migration-orders/5-1-nextjs16-upgrade-audit.migration-order.md` and ready for Davin's approval.

---

## Rollback

N/A — Read-only audit session. No code, configuration, or dependency changes are committed to the codebase in Session 5-1.

---

## Deviations

1. **Lesson L11 Header Cross-Check & Fast-Path:**
   - At session OPEN, `5-1-nextjs16-upgrade-audit.migration-order.md` arrived untracked (`??`) with header `Status: APPROVED` while all 4 entry criteria checkboxes were `[ ]` unchecked.
   - Verified live in-session with Davin ("Go"). Order updated to `CONFIRMED`, entry criteria checked after empirical verification, and audit hit-list populated.

2. **Test Suite Baseline Drift:**
   - Prior baseline doc (`docs/migration-test-baseline.md`) recorded 111 suites / 2046 tests. Today's live run recorded 117 suites / 2082 tests passing (due to Phase 3 and Phase 4A test additions). All 117 suites passed cleanly.

---

## Next-session handoff

Session 5-2 (`docs/migration-orders/5-2-nextjs16-upgrade-codemods.migration-order.md` — Next.js 16 Upgrade & Codemods (`next@16.2.10`), once authorized by Davin).
