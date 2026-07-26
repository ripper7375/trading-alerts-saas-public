# Migration Order — UI-BUILD variant (form & admin UI)

> For sessions that build frontend surfaces. Read `00-SKELETON-AND-RULES.md` first — §4 applies
> with the dial at **High** for layout, component architecture, dynamic form rendering, and UX
> interactions. The DATA contract is constrained by `4A-W3a`'s `/v1/wise/recipients/*` backend endpoints.

**Session:** 4A-W3b · **Variant:** UI-BUILD · **Status:** PRE-DRAFT
**Generated:** 2026-07-26 (Advisor) · **Estimated time:** ~2h
**Phase / plan section:** Phase 4A — money-service · Part 19.5 (RiseWorks → Wise), session 3b of 9
**Target service:** monolith (`app/(dashboard)/admin/disbursement/recipients` & dynamic form component)
**Seeded from:** `docs/migration-orders/replace-rise-with-wise/04-rise-to-wise-migration-plan.md` §4 "4A-W3b" and `4A-W3a`'s backend endpoints

---

## Entry criteria

- [ ] `4A-W3a` closed CONFIRMED; `/v1/wise/recipients/*` endpoints live on Railway and returning 401 unauthenticated.
- [ ] F39 answer acknowledged (controls whether the form component renders on affiliate self-service vs admin UI).
- [ ] Monolith frontend dev environment running cleanly.

---

## Ordered File Breakdown (UI Surface)

### File 1/4 — Schema-Driven Dynamic Recipient Form Component

- **TARGET:** `components/affiliate/wise-recipient-form.tsx`
- **Kind:** Dynamic Form Component (UI-BUILD dial: **High**)
- **Description:** Render dynamic form controls from Wise `AccountRequirementGroup` API response.
  - Handles text, numeric, and select inputs.
  - Listens for `refreshRequirementsOnChange: true` blur/change events to trigger requirements refresh.
  - Enforces client-side validation (minLength, maxLength, regex).

### File 2/4 — Admin Recipient Management Page

- **TARGET:** `app/(dashboard)/admin/disbursement/recipients/page.tsx`
- **Kind:** Next.js Admin Page (UI-BUILD dial: **High**)
- **Description:** Table listing affiliate recipients, status badges (`ACTIVE`, `INVALID`, `ARCHIVED`), target currency, and `accountTail` (last 4 digits).

### File 3/4 — Component Unit Tests

- **TARGET:** `__tests__/components/wise-recipient-form.test.tsx`
- **Kind:** React Testing Library Test Suite

### File 4/4 — Artefact Updates & Handoff

- Update `CLAUDE.md`, `DECISION-LOG.md`, and PRE-DRAFT `4A-W4`.
