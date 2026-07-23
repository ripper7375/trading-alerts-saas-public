# Migration Order: Session 5-3 — Bundle & Component Optimizations

> **EXECUTOR PROTOCOL MANDATE:** This migration order was pre-drafted following the closure of Session 5-2 per `EXECUTOR-PROTOCOL.md`.
> **Status: PRE-DRAFT** — Pre-drafted on 2026-07-23. Must be promoted to DRAFT/APPROVED and confirmed before execution.

**Session:** 5-3 · **Phase:** Phase 5 (Next.js 16 Optimization) · **Variant:** OPTIMIZE · **Status:** PRE-DRAFT ·
**Generated:** 2026-07-23 · **Flags touched:** F10 (Next.js 16 optimization) ·
**Estimated time:** ~2.0h (code splitting, dynamic imports, client-to-server component conversions, bundle size optimization).

---

## Objective

Optimize application bundle size and component rendering performance following the Next.js 16 framework upgrade, leveraging Vercel performance best practices (`vercel-react-best-practices`, `vercel-optimize`). Apply code-splitting, dynamic imports for heavy client libraries (e.g. `lightweight-charts`, `lucide-react` icon bundles), and convert non-interactive client components to server components where possible.

---

## Strategy & Guidelines

1. **Leverage Vercel Skills:** Use `vercel-react-best-practices` and `vercel-optimize` to identify dynamic import candidates and server component conversion opportunities.
2. **Heavy Client Dependencies:** Lazily import dynamic client components (`next/dynamic` with `ssr: false`) for heavy UI widgets like `lightweight-charts` (`components/charts/*`).
3. **Client-to-Server Component Conversions:** Audit components marked `'use client'` to remove directive if no hooks (`useState`, `useEffect`, `useSearchParams`, etc.) or event handlers are required.
4. **Verification & Guardrails:**
   - `npm run type-check`: 0 errors.
   - `npm run validate:lint`: 0 errors.
   - `npm run build`: Production build passes cleanly with bundle size `<340MB`.
   - `npm run test:ci`: 117/117 test suites (2082 tests) pass green.

---

## Proposed Changes

### [Component / Bundle Optimizations]

#### [MODIFY] [next.config.js](file:///d:/SaaS%20Project/trading-alerts-saas-public/next.config.js)
#### [MODIFY] [components/charts/trading-view-chart.tsx](file:///d:/SaaS%20Project/trading-alerts-saas-public/components/charts/trading-view-chart.tsx)

---

## Done when

- [ ] Heavy client libraries dynamically imported via `next/dynamic`.
- [ ] Non-interactive client components audited and converted to Server Components where applicable.
- [ ] Type check (`npm run type-check`) and lint (`npm run validate:lint`) pass with 0 errors.
- [ ] Production build (`npm run build`) succeeds cleanly.
- [ ] Full test suite (`npm run test:ci`) passes 117/117 suites (2082 tests).
- [ ] Results and bundle metrics documented in `DECISION-LOG.md`.

---

## Rollback

Revert code changes via git commit. No database schema or state changes are executed in this optimization session.
