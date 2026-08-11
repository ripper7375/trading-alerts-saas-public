# Migration Order — Session 6-7 — Affiliate

> For a session that **closes the 6 AFFILIATE-surface gap-matrix rows** assigned to it (A1-15, A1-16,
> A2-6, A2-11, B2-19, B2-20) — real Wise payout data wiring on commissions/payouts pages, payment-setup consolidation, code inventory report view, monthly statements download, and affiliate resource center. Adapted from `TEMPLATE-UI-BUILD.md`, dial **High for consolidated payment-setup & report UI, Low for data**.

**Session:** 6-7 · **Phase:** Phase 6 (Frontend Redesign) · **Variant:** UI-BUILD (dial HIGH for consolidated payment-setup & report UI, LOW for data) · **Status:** CONFIRMED, executed, CLOSED SUCCESSFUL · **Generated:** 2026-08-10 ·
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

- [x] Session 6-6 CONFIRMED, executed, closed (2026-08-11 — see `CLAUDE.md` Current entry).
- [x] All 6 gap-matrix rows (A1-15, A1-16, A2-6, A2-11, B2-19, B2-20) re-verified live at CONFIRM —
      found A1-15's own premise materially wrong (see Deviations); A1-16/A2-6/B2-19/B2-20 held.
- [x] Payment-setup consolidation resolved (redirect legacy profile payment page to payout settings)
      — Davin confirmed live at CONFIRM the working-copy rewrite (PRE-DRAFT→APPROVED, both open
      User Review questions resolved, Ordered Steps added) was his own authentic authorization.
- [x] Statements and Resources scope resolved (built as new dashboard subpages) — same live
      confirmation.
- [x] Monolith baseline re-measured at CONFIRM — `tsc --noEmit` clean, `eslint --max-warnings 0` 4
      warnings/0 errors (exact match to 6-6's close), `test:ci` 138/138 suites, 2238/2238 tests
      (exact match). Post-execution: 142/142 suites, 2261/2261 tests (+4 suites/+23 tests, exactly
      this session's own new test files).
- [x] Advisor DRAFT review + Davin APPROVED before CONFIRM — the working copy's own
      `PRE-DRAFT → APPROVED` rewrite had no DRAFT-stage commit trail (the by-now-familiar
      `LESSONS-LEARNED.md` L11 pattern); confirmed live by Davin as his own authentic edit before
      CONFIRM proceeded.

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

- [x] `/affiliate/settings/payout` is canonical payout setup; legacy profile payment page redirects to it.
- [x] `/affiliate/dashboard/commissions` and `/affiliate/dashboard/payouts` render real Wise payout data
      (commissions keeps real `CommissionStatus`, payouts shows real `PaymentBatchStatus`/Wise
      transfer sub-status — Davin's live CONFIRM-time scoping, see Deviations).
- [x] `/affiliate/dashboard/code-inventory` wired to `GET /api/affiliate/dashboard/code-inventory`.
- [x] `/affiliate/dashboard/statements` built with CSV export.
- [x] `/affiliate/dashboard/resources` built with referral link builder and marketing assets.
- [x] `tsc --noEmit` clean; `eslint --max-warnings 0` introduces 0 new warnings (same 4 pre-existing);
      `test:ci` green — 142/142 suites, 2261/2261 tests.

## Rollback

Same-stack UI work; rollback is `git revert`.

## Retire

Legacy `/affiliate/dashboard/profile/payment` page retired in favor of `/affiliate/settings/payout`.

## Deviations

1. **L11 recurrence, confirmed authentic (blocking, resolved at CONFIRM):** the committed `HEAD`
   had this order at `Status: PRE-DRAFT`, no Ordered Steps, and two explicit open User Review
   questions (payment-setup consolidation approach; B2-19/B2-20 scope) — the working copy was a
   full uncommitted rewrite to `Status: APPROVED` with both questions resolved and 6 Ordered Steps
   added, no DRAFT-stage commit trail. Reported in full before proceeding; Davin confirmed live it
   was his own authentic authorization and additionally resolved 4 implementation-level questions
   directly in the same message (enum scoping, endpoint correction, statements/resources data
   source — see #2-#4 below).
2. **A1-15's own premise found materially wrong against live code, corrected before writing any
   code:** the order's Context (both PRE-DRAFT and APPROVED text) claimed
   `commissions/page.tsx` "shows only a static 'Ready for payout' string... no reference to real
   models" — read the file directly and found it already a fully live page: real
   `GET /api/affiliate/dashboard/commission-report` fetch, real `Commission` rows, real pagination/
   filtering/computed totals. The literal string is one label in a 4-item status-legend footer, not
   the whole page. Real narrower gap: no `PaymentBatch`/`WiseTransfer` join existed anywhere.
3. **Enum-scoping conflict found and resolved live (Davin):** the order's own "Real Batch Enum
   Vocabulary" note (`PaymentBatchStatus`: PENDING/QUEUED/PROCESSING/COMPLETED/FAILED/CANCELLED)
   would have been wrong if applied to the commissions page, which correctly uses the DIFFERENT
   `CommissionStatus` enum (PENDING/APPROVED/PAID/CANCELLED) for per-commission status. Resolved:
   commissions page keeps `CommissionStatus` unchanged; the new `/affiliate/dashboard/payouts` page
   is where `PaymentBatchStatus` (and, where present, `WiseTransfer.currentState`) is shown.
4. **`GET /api/wise/recipients` (cited in Feeds-on) confirmed admin-only, not self-service —
   corrected before Step 1:** read the route directly — `GET` calls `requireAdmin()` and returns a
   paginated list across ALL affiliates. Davin confirmed live: use the already-correct self-service
   `GET /api/wise/recipients/me` (which `settings/payout/page.tsx` already called correctly before
   this session — no code change needed there beyond a small copy addition).
5. **No backend endpoint exists for Steps 4/5 (statements, resources) — resolved live (Davin):**
   client-side aggregation of the existing `commission-report` endpoint (paginated fetch over a
   12-month window, grouped by `earnedAt`'s calendar month) for statements; a client-side resource
   hub (real referral-link generator off the existing `codes` endpoint + the real `?ref=` query
   param `register-form.tsx` already reads, FAQ off real `AFFILIATE_CONFIG` values) for resources.
   No new backend endpoint built for either — respects "Out: No backend service changes."
6. **A genuine, previously-live-breaking bug found and fixed while touching this exact code path
   (Step 2), not part of the order's own literal ask:** `commissions/page.tsx` and
   `CommissionTable` both read `commission.amount` — the real Prisma field is `commissionAmount`
   (a `Decimal`, serializes as a string over JSON, per this codebase's own established
   `Number(...)`-on-Decimal convention in `lib/affiliate/report-builder.ts`). Every real commission
   row would throw `TypeError` on `.amount.toFixed(2)` the instant it rendered — invisible because
   the only existing test (`commission-table.test.tsx`) mocked the same wrong field name. Fixed
   both consumers to read `commissionAmount` + `Number(...)`-convert; updated the existing test's
   mock data to the real field name (found and fixed one unrelated pre-existing lint error in the
   same file while there — an unused mock param, never caught before since `__tests__/` is out of
   this repo's `app components lib hooks` lint scope). New `LESSONS-LEARNED.md` **L62**.
7. **Step 6's own literal 2-file ask (`payout-consolidation.test.tsx`,
   `code-inventory-report.test.tsx`) covering 4 distinct areas was split into 4 test files instead**
   — `payout-consolidation.test.tsx` and `code-inventory-report.test.tsx` as named, plus
   `commissions-payouts.test.tsx` and `statements.test.tsx` for the other two named bullets (Wise
   payout status display, CSV download function) — real per-area coverage rather than cramming
   unrelated areas into 2 files. 23 tests total, all green.
8. **Nav links for all 4 new pages added in one edit to `app/affiliate/dashboard/layout.tsx`
   during Step 2**, rather than touching the shared file once per step across Steps 2-5 — avoids
   4 separate touches to the same array; recorded as a minor efficiency deviation, not a scope
   change (all 4 links point at pages this order itself builds).
9. **Live verification performed via unauthenticated redirect-gate checks, same standing gap as
   every Phase 6 session since 6-1b (Waiting-on #117):** started the real Next.js/Turbopack dev
   server and navigated to all 6 new/changed routes (`payouts`, `code-inventory`, `statements`,
   `resources`, the redirected `profile/payment`, `settings/payout`) — all compiled cleanly (zero
   server errors in `preview_logs`) and correctly redirected to `/login?callbackUrl=...`
   unauthenticated. No deep authenticated click-through possible in this environment — no test
   credentials available (`CredentialsProvider` removed at Session 4B-21).

## Known wrinkles / do-not-touch

- `lib/api/index.ts` stays untouched (`EXECUTOR-PROTOCOL.md` §5).
- `frontend/` mirror tree is out of scope (`EXECUTOR-PROTOCOL.md` §5).
- RiseWorks stays archived (F42).
- `DECISION-LOG.md` **F49** (dLocal `payment_method_flow`), **F60** (Stripe webhook cutover), and **F63** (public legal pages, Session 6-10) stay open, non-blocking.

## Next-session handoff

Session **6-8** (`6-8-payments-checkout.migration-order.md`, PRE-DRAFTed at this session's close —
resolves F61, the missing `/api/geo/detect` endpoint, plus the 3-orphaned-endpoint wire-vs-delete
decision on `/checkout`) is next in Phase 6. Not fast-path eligible — carries a real, unresolved
product/scope decision (User Review) forward, same shape as this session's own gate.
