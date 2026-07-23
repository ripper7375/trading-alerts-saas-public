# Migration Order — Next.js 16 Upgrade & Codemods (`next@16.2.10`)

> `TEMPLATE-UPGRADE.md` variant. Read `00-SKELETON-AND-RULES.md` §4 first.
> **Creativity dial: Medium** — how you fix breakages is yours; "no behavior change, no
> metric regression" is not. One variable at a time: this session performs the
> **Next.js 16 Upgrade & Codemods ONLY** — no schema changes, no database migrations, no
> feature additions or architectural refactoring.
> **Status: PRE-DRAFT** — generated at Session 5-1 close. Awaiting Advisor upgrade to DRAFT & Davin's approval.
> 2026-07-23.

**Session:** 5-2 · **Phase:** Phase 5 (Next.js 16 Upgrade) · **Variant:** UPGRADE · **Status:** PRE-DRAFT ·
**Generated:** 2026-07-23 · **Flags touched:** F10 (Next.js 15→16 upgrade execution) ·
**Estimated time:** ~2.5h (version bump, codemods, manual fixes, build & Vercel preview verification).
**From → To:**

- `next`: `15.5.20` → `16.2.10` (root `package.json` target pinned per F2 in `DECISION-LOG.md`)
- `eslint-config-next`: `15.5.20` → `16.2.10`
- `@next/swc-win32-x64-msvc`: `15.5.20` → `16.2.10`

---

## Context & Strategy Background

- **Phase 5 Context:** Session 5-1 completed the read-only breaking-change audit and established pre-upgrade baselines (F10). Session 5-2 executes the framework bump to `next@16.2.10`, runs official Next.js 16 codemods, applies manual fixes for cataloged hits, and verifies local builds and Vercel preview deployments.
- **Session 5-1 Audit Findings (Inputs for Session 5-2):**
  - **Async APIs (`cookies()`, `headers()`, `params`):** Already updated and awaited across key auth/webhook/chart routes in current codebase.
  - **`useSearchParams()` Client Components:** Components in `app/(auth)/` (`forgot-password`, `reset-password`, `verify-2fa`, `verify-email`) and `app/(dashboard)/admin/` (`disbursement/audit`, `disbursement/transactions`) must be verified to sit inside `<Suspense>` boundaries per Next.js 16 requirements.
  - **Config & Peer Deps:** `next.config.js` experimental options (`experimental.serverActions`, `turbopack`) and peer dependencies must be aligned with Next 16 schema.

---

## Entry criteria

- [ ] Session 5-1 read-only audit completed and hit-list verified (`5-1-nextjs16-upgrade-audit.migration-order.md`).
- [ ] Pre-upgrade baseline re-confirmed (`npm run test:ci` passing 117/117 suites, 2082/2082 tests; `npm run type-check` 0 errors).
- [ ] Vercel environment linked and authenticated for preview build verification (`vercel link`).
- [ ] Davin approval of this Session 5-2 order (Status upgraded from `PRE-DRAFT` → `DRAFT` → `APPROVED`).

---

## Ordered steps

1. **Package Version Bumps:**
   - Update `package.json` to set `next: "16.2.10"`, `eslint-config-next: "16.2.10"`, and `@next/swc-win32-x64-msvc: "16.2.10"`.
   - Ensure `@next/bundle-analyzer^16.1.1` and `react@^19.2.1` remain compatible without peer-dependency conflicts.
   - Run `pnpm install` (or `npm install`) to update lockfile cleanly.

2. **Execute Codemods & Targeted Manual Fixes:**
   - Run official Next.js 16 codemods: `npx @next/codemod@latest upgrade next-16`.
   - Apply manual fixes based on Session 5-1 hit-list:
     - Verify `<Suspense>` boundaries wrap all `useSearchParams()` client component consumers.
     - Align `next.config.js` configuration keys (`experimental.serverActions`, `turbopack`) with Next.js 16 schema.
     - Verify `middleware.ts` token decoding and route matcher execution under Next 16 runtime.

3. **Local Build & Parity Verification:**
   - Execute `npm run type-check` — verify 0 TypeScript compilation errors.
   - Execute `npm run validate:lint` — verify 0 ESLint errors/warnings.
   - Execute `npm run build` — verify Next.js production build succeeds and output size meets `<340MB` target (`<450MB` warning limit).
   - Execute `npm run test:ci` — verify all 117 test suites (2082 tests) pass with zero metric regressions.

4. **Vercel Preview Deployment Verification:**
   - Trigger Vercel preview deployment or push branch to verify remote Vercel build succeeds.
   - Verify public preview deployment URL and conduct visual/functional smoke checks on key routes (`/login`, `/dashboard`, `/pricing`).

---

## Rules specific to this variant

- **Fix Forward or Roll Back:** Fix forward within the session or roll back fully — never leave a half-upgraded state.
- **Semantics & Findings:** A test failure after the Next.js 16 bump is a finding to be investigated, not a test to be blindly modified (per Lesson L3).
- **Scope Isolation:** Do not introduce code refactoring, schema changes, or UI redesigns in this upgrade session.

---

## Done when

- [ ] `package.json` and lockfile updated to `next@16.2.10`.
- [ ] All codemods and manual fixes applied cleanly with zero build errors.
- [ ] Full test suite (`117/117` suites, `2082` tests) passing green.
- [ ] Local build (`npm run build`) succeeds within target thresholds.
- [ ] Vercel preview deployment verified green and functioning on live URL.

---

## Rollback

Revert commit and restore previous `package.json` / `pnpm-lock.yaml`. Clean rollback because no database schema migrations or stateful backend changes are executed in this frontend framework bump.

---

## Deviations

_(filled during execution)_

---

## Next-session handoff

_(DRAFT order for Session 5-3 — Bundle & Component Optimizations (`bundle-size-optimization/**` rules: code-splitting, dynamic imports, client→server component conversions))_
