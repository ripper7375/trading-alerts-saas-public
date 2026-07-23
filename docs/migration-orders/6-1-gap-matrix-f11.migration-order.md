# Migration Order — Session 6-1 — Frontend Gap Matrix & Endpoint Mapping (F11)

> **Status: PRE-DRAFT** — Drafted by Executor upon Session 5-4 completion. Pending Advisor review & Davin authorization.

**Session:** 6-1 · **Phase:** Phase 6 (Frontend Redesign & Gap Matrix F11) · **Variant:** AUDIT · **Status:** PRE-DRAFT ·
**Generated:** 2026-07-23 · **Flags touched:** F11 (Frontend Gap Matrix & Endpoint Mapping F11) ·
**Estimated time:** ~1.5h (Frontend component audit, microservice API mapping, gap matrix formulation).

---

## Context & Strategy Background

- **Phase 5 Completion:** Phase 5 (Next.js 16 Optimization) closed with framework upgrade (`next@16.2.10`), Turbopack compatibility, 0-KB JS Server Component conversions, Google font fallback stack optimizations, and clean verification across 127/127 routes.
- **Phase 6 Trajectory:** Phase 6 initiates the systematic Frontend Redesign and Microservice Endpoint Wiring.
- **Session 6-1 Focus:** Audit all user-facing UI flows (`app/(marketing)/*`, `app/(auth)/*`, `app/(dashboard)/*`, `app/pricing/*`, `app/checkout/*`, `app/admin/*`) against extracted backend services (`money-service`, `operation-service`, auth/user services). Generate a comprehensive Gap Matrix cataloging missing endpoints, mock contracts, component refactoring targets, and Vercel React best practices (`vercel-react-best-practices`, `vercel-composition-patterns`).

---

## Entry criteria

- [ ] Phase 5 fully closed and documented in `CLAUDE.md`, `DECISION-LOG.md`, and `migration-cutover-table.md`.
- [ ] Baseline quality checks verified green (`npm run type-check` = 0 errors, `npm run validate:lint` = 0 errors, `npm run test:ci` = 2082 passing).
- [ ] Davin authorization of Session 6-1 order (Status: PRE-DRAFT → DRAFT → APPROVED).

---

## Proposed Changes

### [Gap Matrix & Component Inventory Audit]

#### [NEW] [docs/migration-orders/phase-6-frontend-gap-matrix.md](file:///d:/SaaS%20Project/trading-alerts-saas-public/docs/migration-orders/phase-6-frontend-gap-matrix.md)

- Construct detailed mapping matrix of UI components and routes to backend microservices APIs (`money-service`, `operation-service`).

#### [MODIFY] [CLAUDE.md](file:///d:/SaaS%20Project/trading-alerts-saas-public/CLAUDE.md)

- Update current state and next-session pointer following Davin approval.

---

## Ordered steps

1. **Frontend Route & Component Census:**
   - Catalog all page routes and interactive client components across `app/` and `components/`.
   - Identify direct database queries or monolithic API handlers that need microservice client extraction.

2. **Microservice API Alignment:**
   - Cross-reference existing endpoints in `money-service` (`/v1/affiliate/*`, `/v1/admin/disbursement/*`, `/v1/webhooks/*`) and `operation-service` with frontend requirements.

3. **Formulate Phase 6 Gap Matrix & Milestone Roadmap:**
   - Document missing endpoints, data fetching contracts, and React composition refactorings in `docs/migration-orders/phase-6-frontend-gap-matrix.md`.

4. **Phase 6 Handoff Preparation:**
   - Update `CLAUDE.md` and `DECISION-LOG.md` (F11 progress note).

---

## Done when

- [ ] Comprehensive Gap Matrix artifact created (`phase-6-frontend-gap-matrix.md`).
- [ ] All frontend routes mapped to their designated backend microservices or bridge handlers.
- [ ] Session 6-2 implementation order drafted and submitted for Advisor review and Davin approval.

---

## Deviations

_(filled during execution)_

---

## Next-session handoff

Session 6-2 (Frontend Component Refactoring & Microservice API Integration).
