# Migration Order — Session 5-4 — Fonts, Streaming & Phase 5 Exit Review

> **EXECUTOR PROTOCOL MANDATE:** Drafted at Session 5-3 close. Ready for Advisor upgrade to DRAFT & Davin approval.
> **Status: PRE-DRAFT** — Generated 2026-07-23.

**Session:** 5-4 · **Phase:** Phase 5 (Next.js 16 Optimization & Phase Exit) · **Variant:** UPGRADE · **Status:** PRE-DRAFT ·
**Generated:** 2026-07-23 · **Flags touched:** F10 (Next.js 16 optimization, font fallback & Phase 5 exit) ·
**Estimated time:** ~1.5h (Google font fallback optimization, React Suspense streaming verification, Phase 5 exit review).

---

## Context & Strategy Background

- **Phase 5 Context:** Session 5-1 established breaking-change audit baselines; Session 5-2 executed Next.js `16.2.10` upgrade and codemods; Session 5-3 optimized bundle size (`optimizePackageImports`, dynamic imports, RSC conversions) reducing production bundle size to 29.82 MB.
- **Session 5-4 Focus:**
  1. **Google Font Optimization & Fallback:** Configure fallback font stacks for `next/font/google` (Inter font in `app/layout.tsx`) to ensure zero-flash loading and prevent build time network resolution errors in offline/CI environments.
  2. **React 19 Suspense Streaming Verification:** Audit dynamic page routes (`app/(dashboard)/*`, `app/(auth)/*`, `admin/disbursement/*`) to confirm `<Suspense>` boundary streaming and loading fallbacks operate smoothly under Next.js 16 Turbopack / Webpack.
  3. **Phase 5 Exit Review & Handoff:** Execute full verification suite (`npm run type-check`, `npm run validate:lint`, `npm run build`, `npm run test:ci`), confirm all F10 requirements satisfied, and transition codebase to Phase 6.

---

## Entry criteria

- [ ] Session 5-3 (`next@16.2.10` bundle & component optimizations) closed and verified all-green.
- [ ] Baseline checks re-confirmed (`npm run type-check`, `npm run validate:lint`, `npm run test:ci`).
- [ ] Production build verified cleanly compiled across 127/127 routes.
- [ ] Blast-radius statement: Touches `app/layout.tsx`, `next.config.js`, and documentation artifacts (`CLAUDE.md`, `DECISION-LOG.md`, `migration-cutover-table.md`). No database schema or API route contracts altered.
- [ ] Davin approval of this Session 5-4 order (Status: PRE-DRAFT → DRAFT → APPROVED).

---

## Proposed Changes

### [Font Loading & Layout Optimization]

#### [MODIFY] [app/layout.tsx](file:///d:/SaaS%20Project/trading-alerts-saas-public/app/layout.tsx)
- Ensure `next/font/google` Inter font configuration includes fallback font definitions (`fallback: ['system-ui', 'arial']`) and `adjustFontFallback: true` to optimize CLS (Cumulative Layout Shift) and prevent build font fetch blocking.

#### [MODIFY] [next.config.js](file:///d:/SaaS%20Project/trading-alerts-saas-public/next.config.js)
- Verify `optimizePackageImports` and font optimization settings align cleanly under Next.js 16 production build rules.

---

## Ordered steps

1. **Font Optimization & Fallback Audit:**
   - Audit `app/layout.tsx` for `next/font/google` Inter configuration.
   - Add explicit system font fallbacks (`fallback: ['system-ui', 'sans-serif']`) and verify layout shift prevention.
   - _Verify:_ `npm run build` succeeds without font downloading warnings or blocking.

2. **React 19 Streaming & Suspense Verification:**
   - Verify dynamic route components utilizing `useSearchParams` or async server data fetching wrap boundaries with `<Suspense>`.
   - Test streaming fallback UI components (`loading.tsx` and custom skeletons).
   - _Verify:_ Dynamic routes stream cleanly without server-side hydration errors.

3. **Phase 5 Full Exit Verification Suite:**
   - Run `npm run type-check` (0 errors).
   - Run `npm run validate:lint` (0 errors / warnings).
   - Run `npm run build` (127/127 routes compiled successfully).
   - Run `npm run test:ci` (117/117 suites, 2082 tests passing).
   - _Verify:_ All verification gates pass 100% green.

4. **Phase 5 Exit Artifact Updates & Handoff:**
   - Update `CLAUDE.md` to declare Phase 5 CLOSED.
   - Update `DECISION-LOG.md` (F10 final Phase 5 resolution).
   - Update `migration-cutover-table.md` and PRE-DRAFT Phase 6 / Session 6-1 order.

---

## Rules specific to this variant

- **Zero Regression:** No metric or test regressions allowed.
- **No Behavioral Change:** Font and streaming optimizations must preserve exact UI appearance and functionality.
- **Scope Isolation:** No database changes, no API route alterations.

---

## Done when

- [ ] `app/layout.tsx` font configuration optimized with fallbacks.
- [ ] Type check (`npm run type-check`) and lint (`npm run validate:lint`) pass with 0 errors.
- [ ] Production build (`npm run build`) compiles 127/127 routes with 0 errors.
- [ ] Test suite (`npm run test:ci`) passes 117/117 suites (2082 tests).
- [ ] Phase 5 exit documented in `CLAUDE.md`, `DECISION-LOG.md`, and `migration-cutover-table.md`.

---

## Rollback

Revert code changes via `git revert`.

---

## Deviations

_(filled during execution)_

---

## Next-session handoff

Session 6-1 (Phase 6 Microservice Extraction / Operation Service API Integration).
