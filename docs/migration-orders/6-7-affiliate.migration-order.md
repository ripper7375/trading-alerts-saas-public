# Migration Order — Session 6-7 — Affiliate

> For a session that **closes the 6 AFFILIATE-surface gap-matrix rows** assigned to it (A1-15, A1-16,
> A2-6, A2-11, B2-19, B2-20) — real Wise payout data wiring on commissions/payouts pages, payment-setup consolidation, code inventory report view, monthly statements download, and affiliate resource center. Adapted from `TEMPLATE-UI-BUILD.md`, dial **High for consolidated payment-setup & report UI, Low for data**.

**Session:** 6-7 · **Phase:** Phase 6 (Frontend Redesign) · **Variant:** UI-BUILD (dial HIGH for consolidated payment-setup & report UI, LOW for data) · **Status:** APPROVED · **Generated:** 2026-08-10 ·
**Flags touched:** none · **Estimated time:** ~4-5h
**Surface:** [`app/affiliate/dashboard/commissions/page.tsx`](file:///d:/SaaS%20Project/trading-alerts-saas-public/app/affiliate/dashboard/commissions/page.tsx) (real Wise payout status), `app/affiliate/dashboard/payouts/page.tsx` (new payouts history page), [`app/affiliate/settings/payout/page.tsx`](file:///d:/SaaS%20Project/trading-alerts-saas-public/app/affiliate/settings/payout/page.tsx) (canonical payout setup), `app/affiliate/dashboard/profile/payment/page.tsx` (redirect to settings payout), `app/affiliate/dashboard/code-inventory/page.tsx` (new report view), `app/affiliate/dashboard/statements/page.tsx` (new monthly statements view), `app/affiliate/dashboard/resources/page.tsx` (new resource center) ·
**Feeds on:** `GET /api/affiliate/dashboard/code-inventory`, `GET /api/affiliate/dashboard/commission-report`, `GET /api/affiliate/dashboard/stats`, `GET /api/wise/recipients`.

---

## Context

Six rows from `docs/files-completion-list/ui-page-gap-analysis.md`, independently re-verified:

- **A1-15 & A2-11 (`/affiliate/dashboard/commissions` & `/affiliate/dashboard/payouts`):** The commissions page currently shows a static "Ready for payout" string. Wires real Wise transfer and payment batch status using real Prisma enum values (`PENDING`, `QUEUED`, `PROCESSING`, `COMPLETED`, `FAILED`, `CANCELLED`). Builds `/affiliate/dashboard/payouts` as a dedicated payout history view.
- **A1-16 (`/affiliate/dashboard/profile/payment` vs `/affiliate/settings/payout`):** Two duplicate payment-setup pages exist. Consolidates onto `/affiliate/settings/payout` as the single canonical payout configuration page (Wise recipient onboarding, payout currency, bank details). `/affiliate/dashboard/profile/payment` redirects to `/affiliate/settings/payout`.
- **A2-6 (`/affiliate/dashboard/code-inventory`):** `GET /api/affiliate/dashboard/code-inventory` is live with zero UI consumers — builds `app/affiliate/dashboard/code-inventory/page.tsx` displaying period opening/closing balance, additions, reductions, and active code count.
- **B2-19 (`/affiliate/dashboard/statements`):** Builds `app/affiliate/dashboard/statements/page.tsx` for viewing monthly payout statements and downloading CSV reports.
- **B2-20 (`/affiliate/dashboard/resources`):** Builds `app/affiliate/dashboard/resources/page.tsx` as the Affiliate Resource Center (referral link generator, promo assets, brand logos, FAQ).

## User Review Required

> [!IMPORTANT]
> **Payment-Setup Consolidation (A1-16):** Consolidate payout configuration into [`app/affiliate/settings/payout/page.tsx`](file:///d:/SaaS%20Project/trading-alerts-saas-public/app/affiliate/settings/payout/page.tsx). The legacy page `app/affiliate/dashboard/profile/payment/page.tsx` is converted into a transparent redirect to `/affiliate/settings/payout`.

> [!IMPORTANT]
> **Statements & Resources Scope (B2-19/B2-20):** Formally include both subpages in Session 6-7 scope:
>
> - `app/affiliate/dashboard/statements/page.tsx`: Monthly payout summary and CSV export.
> - `app/affiliate/dashboard/resources/page.tsx`: Link builder, promo code generator, and brand assets.

> [!NOTE]
> **Real Batch Enum Vocabulary:** All payout and commission status displays MUST use real Prisma enum values (`PENDING`, `QUEUED`, `PROCESSING`, `COMPLETED`, `FAILED`, `CANCELLED`).

## Entry criteria

- [ ] Session 6-6 CONFIRMED, executed, closed (2026-08-11 — see `CLAUDE.md` Current entry).
- [ ] All 6 gap-matrix rows (A1-15, A1-16, A2-6, A2-11, B2-19, B2-20) re-verified live at CONFIRM.
- [ ] Payment-setup consolidation resolved (redirect legacy profile payment page to payout settings).
- [ ] Statements and Resources scope resolved (built as new dashboard subpages).
- [ ] Monolith baseline re-measured at CONFIRM (`tsc --noEmit`, `eslint app components lib hooks --max-warnings 0`, `test:ci` — last known at 6-6's close: 138/138 suites, 2238/2238 tests, 4 pre-existing lint warnings).
- [ ] Advisor DRAFT review + Davin APPROVED before CONFIRM.

## Integration points

- **In:** `GET /api/affiliate/dashboard/code-inventory`, `GET /api/affiliate/dashboard/commission-report`, `GET /api/affiliate/dashboard/stats`, `GET /api/wise/recipients`.
- **Out:** No backend service changes.
- **Owns:** The 7 affiliate page files listed under Surface above.

## Ordered steps

### Step 1 — Consolidate Payment Setup Pages (`/affiliate/settings/payout` & redirect) (A1-16)

- Enhance [`app/affiliate/settings/payout/page.tsx`](file:///d:/SaaS%20Project/trading-alerts-saas-public/app/affiliate/settings/payout/page.tsx) as the single canonical payout setup page (Wise onboarding, currency selection, bank details).
- Update `app/affiliate/dashboard/profile/payment/page.tsx` to redirect to `/affiliate/settings/payout`.
- _Verify:_ Navigating to `/affiliate/dashboard/profile/payment` redirects to `/affiliate/settings/payout`; Wise payout settings load cleanly.
- _Commit:_ `feat(6-7): consolidate affiliate payout setup onto /affiliate/settings/payout`

### Step 2 — Wire Real Wise Payout Status on Commissions & Payouts Pages (A1-15, A2-11)

- Update [`app/affiliate/dashboard/commissions/page.tsx`](file:///d:/SaaS%20Project/trading-alerts-saas-public/app/affiliate/dashboard/commissions/page.tsx) and build `app/affiliate/dashboard/payouts/page.tsx`.
- Display real commission summaries, Wise transfer statuses, and payment batch states using real Prisma enum values (`PENDING`, `QUEUED`, `PROCESSING`, `COMPLETED`, `FAILED`, `CANCELLED`).
- _Verify:_ Commissions and payouts pages display live commission data and real batch status badges.
- _Commit:_ `feat(6-7): wire real Wise payout status on affiliate commissions and payouts pages`

### Step 3 — Build Code Inventory Report Page (`/affiliate/dashboard/code-inventory`) (A2-6)

- Create `app/affiliate/dashboard/code-inventory/page.tsx` fetching `GET /api/affiliate/dashboard/code-inventory`.
- Display period opening/closing balance, additions, reductions, active code count, and usage breakdown table.
- _Verify:_ Code inventory page loads report data and renders balance metrics.
- _Commit:_ `feat(6-7): build affiliate code inventory report page`

### Step 4 — Build Affiliate Statements Page (`/affiliate/dashboard/statements`) (B2-19)

- Create `app/affiliate/dashboard/statements/page.tsx` rendering monthly payout statement cards, tax summary notes, and downloadable CSV exports.
- _Verify:_ Statements page displays monthly history and triggers CSV download.
- _Commit:_ `feat(6-7): build affiliate monthly statements page with CSV export`

### Step 5 — Build Affiliate Resource Center Page (`/affiliate/dashboard/resources`) (B2-20)

- Create `app/affiliate/dashboard/resources/page.tsx` with referral link builder, promo code copy widgets, marketing brand logos, banner assets, and FAQ.
- _Verify:_ Resource center renders link builder, copy buttons, and downloadable asset cards.
- _Commit:_ `feat(6-7): build affiliate resource center page with link generator and assets`

### Step 6 — Unit Tests for Affiliate Pages

- Create `__tests__/pages/affiliate/payout-consolidation.test.tsx` and `__tests__/pages/affiliate/code-inventory-report.test.tsx` covering:
  - Payout settings redirect and form state.
  - Code inventory report fetching and metric rendering.
  - Commissions page Wise payout status display.
  - Statements CSV download function.
- _Verify:_ `test:ci` runs clean with all new and existing tests passing.
- _Commit:_ `test(6-7): add unit tests for affiliate dashboard report pages and payout setup`

## Rules specific to this variant

- **UI Creativity (Dial HIGH):** High latitude on payout setup UX, code inventory charts, monthly statement views, and resource center cards.
- **Data Contract (Dial LOW):** Payloads for `/api/affiliate/dashboard/*` must strictly match API schemas.
- **Real Enum Vocabulary:** Use real Prisma enum values (`PENDING`, `QUEUED`, `PROCESSING`, `COMPLETED`, `FAILED`, `CANCELLED`).
- **A11y Standards:** ARIA labels, keyboard navigation, and clear focus states.

## Done when

- [ ] `/affiliate/settings/payout` is canonical payout setup; legacy profile payment page redirects to it.
- [ ] `/affiliate/dashboard/commissions` and `/affiliate/dashboard/payouts` render real Wise payout data.
- [ ] `/affiliate/dashboard/code-inventory` wired to `GET /api/affiliate/dashboard/code-inventory`.
- [ ] `/affiliate/dashboard/statements` built with CSV export.
- [ ] `/affiliate/dashboard/resources` built with referral link builder and marketing assets.
- [ ] `tsc --noEmit` clean; `eslint --max-warnings 0` introduces 0 new warnings; `test:ci` green.

## Rollback

Same-stack UI work; rollback is `git revert`.

## Retire

Legacy `/affiliate/dashboard/profile/payment` page retired in favor of `/affiliate/settings/payout`.

## Deviations

_(filled during execution)_

## Known wrinkles / do-not-touch

- `lib/api/index.ts` stays untouched (`EXECUTOR-PROTOCOL.md` §5).
- `frontend/` mirror tree is out of scope (`EXECUTOR-PROTOCOL.md` §5).
- RiseWorks stays archived (F42).
- `DECISION-LOG.md` **F49** (dLocal `payment_method_flow`), **F60** (Stripe webhook cutover), and **F63** (public legal pages, Session 6-10) stay open, non-blocking.

## Next-session handoff

Session **6-8** (Payments/Checkout — resolves F61, the missing `/api/geo/detect` endpoint) is next in Phase 6.
