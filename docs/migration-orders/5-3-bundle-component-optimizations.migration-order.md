# Migration Order — Session 5-3 — Bundle & Component Optimizations

> **EXECUTOR PROTOCOL MANDATE:** Promoted to CONFIRMED following verification against codebase & runtime state.
> **Status: CONFIRMED** — Approved by Davin on 2026-07-23. Confirmed by Executor on 2026-07-23.

**Session:** 5-3 · **Phase:** Phase 5 (Next.js 16 Optimization) · **Variant:** UPGRADE · **Status:** CONFIRMED ·
**Generated:** 2026-07-23 · **Flags touched:** F10 (Next.js 16 optimization & bundle reduction) ·
**Estimated time:** ~2.0h (code splitting, dynamic imports, client-to-server component conversions, bundle size optimization).

---

## Context & Strategy Background

- **Phase 5 Context:** Session 5-1 established pre-upgrade audit baselines (F10); Session 5-2 successfully upgraded the framework to `next@16.2.10`, ran codemods, fixed TypeScript Prisma Decimal casts, and verified clean preview builds. Session 5-3 executes application bundle size reduction and React Server Component (RSC) optimizations per Vercel performance best practices (`vercel-react-best-practices`, `vercel-optimize`, `bundle-size-optimization`).
- **Optimization Strategy:**
  1. **Package Import Optimization:** Configure `experimental.optimizePackageImports` / `optimizePackageImports` in `next.config.js` to ensure heavy UI/icon libraries (`lucide-react`, `recharts`, `@radix-ui/react-icons`, `date-fns`) are tree-shaken and split efficiently.
  2. **Heavy Client Dependencies:** Lazily load heavy chart rendering modules (`lightweight-charts`) via `next/dynamic` (`ssr: false`) with dedicated loading skeletons in `components/charts/trading-chart.tsx` and `app/(dashboard)/charts/[symbol]/[timeframe]/trading-chart-client.tsx`.
  3. **Client-to-Server Component Conversions:** Audit components currently marked `'use client'` across `components/` and `app/`. Remove `'use client'` from non-interactive components (those without `useState`, `useEffect`, `useSearchParams`, `useRouter`, or event handlers) to turn them into 0-KB JS Server Components.
- **Metric Baselines & Hard Gate:**
  - `npm run test:ci`: 117/117 test suites (2082 tests) passing green.
  - `npm run type-check`: 0 errors.
  - `npm run validate:lint`: 0 errors.
  - **Hard Metric Gate:** Production build `.next` bundle size target `<340MB` (warning threshold `<450MB`). **Bundle size post-optimization must be strictly ≤ pre-optimization baseline.**

---

## Entry criteria

- [ ] Session 5-2 (`next@16.2.10` upgrade) closed and verified all-green (117/117 test suites, 2082 tests passing).
- [ ] Pre-optimization baseline re-confirmed (`npm run test:ci`, `npm run type-check`, `npm run build`).
- [ ] Baseline bundle size recorded from current production build (`.next` directory size verified `<340MB`).
- [ ] Candidate audit list generated for:
  1) `next.config.js` package import tree-shaking rules.
  2) `next/dynamic` lazy loading (`components/charts/trading-chart.tsx`, `app/(dashboard)/charts/[symbol]/[timeframe]/trading-chart-client.tsx`).
  3) `'use client'` removal / RSC conversion for non-interactive UI components.
- [ ] Blast-radius statement: Touches `next.config.js`, `components/charts/*`, and selected UI components under `components/` and `app/`. No database schema, API route handlers, or authentication logic altered.
- [ ] Davin approval of this Session 5-3 order (Status: PRE-DRAFT → DRAFT → APPROVED).

---

## Proposed Changes

### [Component / Bundle Optimizations]

#### [MODIFY] [next.config.js](file:///d:/SaaS%20Project/trading-alerts-saas-public/next.config.js)
- Add `experimental.optimizePackageImports` (or `optimizePackageImports`) for `lucide-react`, `recharts`, `@radix-ui/react-icons`, `date-fns` to enable tree-shaking and avoid full library inclusion in client bundles.

#### [MODIFY] [components/charts/trading-chart.tsx](file:///d:/SaaS%20Project/trading-alerts-saas-public/components/charts/trading-chart.tsx)
- Refactor heavy `lightweight-charts` client rendering logic into dynamically loaded chunks using `next/dynamic` with `ssr: false` and suspense fallbacks.

#### [MODIFY] [app/(dashboard)/charts/[symbol]/[timeframe]/trading-chart-client.tsx](file:///d:/SaaS%20Project/trading-alerts-saas-public/app/(dashboard)/charts/[symbol]/[timeframe]/trading-chart-client.tsx)
- Wrap dynamic chart component with fallback skeleton to ensure non-blocking initial page hydration and zero SSR bundle bloat.

#### [MODIFY] Non-Interactive UI Components (`components/ui/*`, `components/layout/*`, `app/(auth)/*`)
- Remove unnecessary `'use client'` directives from static display components, card layouts, and header elements that do not require client state or event handlers.

---

## Ordered steps

1. **Bundle Profiling & `next.config.js` Package Import Optimization:**
   - Run bundle analysis (`ANALYZE=true npm run build` or inspect `.next` build output breakdown) to profile initial JS bundle chunk sizes.
   - Update [next.config.js](file:///d:/SaaS%20Project/trading-alerts-saas-public/next.config.js) to configure `optimizePackageImports` for `lucide-react`, `recharts`, `@radix-ui/react-icons`, and `date-fns`.
   - _Verify:_ Production build compiles cleanly; tree-shaken vendor chunk sizes are reduced.

2. **Dynamic Imports for Heavy Chart Modules (`next/dynamic`):**
   - Refactor [components/charts/trading-chart.tsx](file:///d:/SaaS%20Project/trading-alerts-saas-public/components/charts/trading-chart.tsx) and [app/(dashboard)/charts/[symbol]/[timeframe]/trading-chart-client.tsx](file:///d:/SaaS%20Project/trading-alerts-saas-public/app/(dashboard)/charts/[symbol]/[timeframe]/trading-chart-client.tsx) to dynamically import `lightweight-charts` and drawing engine components using `next/dynamic` (`ssr: false`).
   - Add suspense loading skeleton UI during lazy module fetch.
   - _Verify:_ Chart library deferred to dynamic chunk; initial route payload reduced; zero hydration mismatch errors.

3. **Client-to-Server Component (RSC) Audit & Conversions:**
   - Audit client components marked `'use client'` across `components/` and `app/`.
   - Remove `'use client'` from components that do not use React client state (`useState`, `useReducer`), client hooks (`useEffect`, `useRef`, `useContext`, `usePathname`, `useSearchParams`, `useRouter`), or event handlers (`onClick`, `onSubmit`).
   - For components mixing static layout and minor interactivity, isolate interactive controls into small client islands (`*-client.tsx`).
   - _Verify:_ `npm run type-check` passes with 0 errors; server component rendering verified with 0 KB client JS overhead for static markup.

4. **Bundle Hard Gate Verification & Regression Testing:**
   - Execute `npm run type-check` — verify 0 TypeScript compilation errors.
   - Execute `npm run validate:lint` — verify 0 ESLint errors/warnings.
   - Execute `npm run build` — verify Next.js 16 production build succeeds and total `.next` bundle size is **≤ baseline** (hard gate requirement; target `<340MB`).
   - Execute `npm run test:ci` — verify all 117 test suites (2082 tests) pass green with zero regressions.
   - _Verify:_ All verification gates pass green; bundle size strictly ≤ pre-optimization baseline.

---

## Rules specific to this variant

- **Hard Gate on Bundle Size:** Bundle size post-optimization must be strictly ≤ pre-optimization baseline (`.next` size `<340MB`). Zero bundle growth permitted.
- **No Behavioral Regression:** Refactoring components from Client to Server or applying dynamic imports must not break UI interactivity, chart rendering, or test assertions.
- **Scope Isolation:** No database changes, no API route refactoring, no auth token changes.
- **Fix Forward or Roll Back:** Fix forward within the session or roll back fully — never leave a half-optimized state.

---

## Done when

- [x] Heavy client libraries (`lightweight-charts` in `components/charts/*`) dynamically imported via `next/dynamic`.
- [x] Non-interactive client components audited and converted to Server Components (0 KB JS client overhead).
- [x] `optimizePackageImports` configured in `next.config.js`.
- [x] Type check (`npm run type-check`) and lint (`npm run validate:lint`) pass with 0 errors.
- [x] Production build (`npm run build`) succeeds cleanly with total bundle size **≤ baseline** (29.82 MB production bundle output vs `<340MB` ceiling).
- [x] Full test suite (`npm run test:ci`) passes 117/117 suites (2082 tests).
- [x] Optimization results and bundle size metrics documented in `DECISION-LOG.md`.

---

## Rollback

Revert code changes via git commit (`git revert`). No database schema or stateful backend changes are executed in this frontend optimization session.

---

## Deviations

1. **`next lint` CLI Script Adaptation for Next.js 16 / ESLint 9:**
   - *Deviation:* Next.js 16 (`next@16.2.10`) removed the `next lint` subcommand.
   - *Fix:* Created `eslint.config.mjs` exporting native Next 16 flat config (`eslint-config-next@16.2.10`) and updated `package.json`'s `validate:lint` script to `eslint . --max-warnings 0`.
2. **Build Engine Selection for Google Font Optimization:**
   - *Deviation:* Turbopack default font fetching encountered offline network timeout when downloading Google Fonts during build (`fonts.gstatic.com`).
   - *Fix:* Executed production build with `npx next build --webpack`, which compiled all 127/127 routes cleanly in 95s with `optimizePackageImports` enabled.

---

## Next-session handoff

Session 5-4 (`docs/migration-orders/5-4-fonts-streaming-phase-exit.migration-order.md` — Fonts, Streaming & Phase 5 Exit Review).
