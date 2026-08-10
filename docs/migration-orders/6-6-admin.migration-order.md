# Migration Order — Session 6-6 — Admin

> For a session that **closes the 6 ADMIN-surface gap-matrix rows** assigned to it (A1-5, A1-6, A1-14,
> A1-17/A2-10, A2-5, A2-7) — the WISE disbursement provider option missing from the admin config
> UI, the RiseWorks-only accounts page's disposition, a per-code cancel action with a real,
> zero-consumer endpoint already live, a missing per-user detail page, and a real, zero-consumer
> code-flows report endpoint. Adapted from `TEMPLATE-UI-BUILD.md`, dial **High for new UI (user detail page, provider selector, report views), Low for data**.

**Session:** 6-6 · **Phase:** Phase 6 (Frontend Redesign) · **Variant:** UI-BUILD (dial HIGH for new UI, LOW for data) · **Status:** CONFIRMED, executed, CLOSED SUCCESSFUL · **Generated:** 2026-08-10 ·
**Flags touched:** none · **Estimated time:** ~4-6h
**Surface:** [`app/(dashboard)/admin/disbursement/config/page.tsx`](<file:///d:/SaaS%20Project/trading-alerts-saas-public/app/(dashboard)/admin/disbursement/config/page.tsx>) (WISE option), [`app/(dashboard)/admin/disbursement/accounts/page.tsx`](<file:///d:/SaaS%20Project/trading-alerts-saas-public/app/(dashboard)/admin/disbursement/accounts/page.tsx>) (Wise recipients rebuild), [`app/(dashboard)/admin/affiliates/reports/code-inventory/page.tsx`](<file:///d:/SaaS%20Project/trading-alerts-saas-public/app/(dashboard)/admin/affiliates/reports/code-inventory/page.tsx>) (per-code cancel action), [`app/(dashboard)/admin/users/page.tsx`](<file:///d:/SaaS%20Project/trading-alerts-saas-public/app/(dashboard)/admin/users/page.tsx>) (link to detail page), `app/(dashboard)/admin/users/[id]/page.tsx` (new user detail page), [`app/(dashboard)/admin/affiliates/reports/code-flows/page.tsx`](<file:///d:/SaaS%20Project/trading-alerts-saas-public/app/(dashboard)/admin/affiliates/reports/code-flows/page.tsx>) (wire report endpoint), [`app/(dashboard)/admin/disbursement/affiliates/[affiliateId]/page.tsx`](<file:///d:/SaaS%20Project/trading-alerts-saas-public/app/(dashboard)/admin/disbursement/affiliates/[affiliateId]/page.tsx>) (batch status vocabulary alignment) ·
**Feeds on:** `POST /api/admin/codes/[code]/cancel`, `GET /api/admin/affiliates/reports/code-flows`, `/api/disbursement/config`, `/api/admin/users`, direct Prisma queries.

---

## Context

Six rows from `docs/files-completion-list/ui-page-gap-analysis.md`, independently re-verified:

- **A1-5 (`/admin/disbursement/config`):** The provider radio selection only offers `MOCK`/`RISE` — `WISE` is missing, despite Wise being the live disbursement provider as of Session 4A-W7 (`DISBURSEMENT_PROVIDER=WISE` in production).
- **A1-6 (`/admin/disbursement/accounts`):** The accounts page is RiseWorks-driven. Since RiseWorks is archived (F42, Session 4A-W1), this page is rebuilt for Wise recipients (`AffiliateWiseRecipient` model data, email, currency, onboarding status), with RiseWorks historical records archived in a read-only tab.
- **A1-14 (`/admin/affiliates/reports/code-inventory`):** `POST /api/admin/codes/[code]/cancel` is live with zero UI consumers — needs a cancel action button with confirmation dialog.
- **A1-17/A2-10 (`/admin/users`, new `/admin/users/[id]`):** No per-user detail page exists. Builds `app/(dashboard)/admin/users/[id]/page.tsx` covering 5 comprehensive sections: Profile & Account, Subscription & Billing, Security & 2FA, Fraud Alerts, and Affiliate Info.
- **A2-5 (`/admin/affiliates/reports/code-flows`):** `GET /api/admin/affiliates/reports/code-flows` is live with zero UI consumers — needs wiring into a report view.
- **A2-7 (`/admin/disbursement/affiliates/[affiliateId]`):** Re-verify affiliate disbursement detail page and ensure batch lifecycle vocabulary matches money service cutover table (`DRAFTING`, `PENDING_APPROVAL`, `APPROVED`, `PROCESSING`, `COMPLETED`, `CANCELLED`).

## User Review Required

> [!IMPORTANT]
> **RiseWorks-Accounts Page Disposition (A1-6):** Rebuild `/admin/disbursement/accounts` to display active **Wise Recipients** (`AffiliateWiseRecipient` model data / `/wise/recipients` API). Legacy RiseWorks accounts are retained in a read-only historical tab without un-archiving RiseWorks backend paths (F42).

> [!IMPORTANT]
> **Admin User-Detail Page Scope (A1-17/A2-10):** Build `app/(dashboard)/admin/users/[id]/page.tsx` with 5 detailed sections:
>
> 1. Profile & Account Status (email, name, role, tier, verification status, registration date).
> 2. Subscription & Billing Info (tier, provider, subscription ID, period end, trial status).
> 3. Security & 2FA Info (2FA status, active sessions count, last login).
> 4. Fraud & Security Risk Flags (linked `FraudAlert` history).
> 5. Affiliate & Code Info (affiliate status, referral code count).

> [!IMPORTANT]
> **Money Service Batch Lifecycle Vocabulary:** All disbursement pages MUST strictly use the money service batch lifecycle vocabulary (`DRAFTING`, `PENDING_APPROVAL`, `APPROVED`, `PROCESSING`, `COMPLETED`, `CANCELLED`).

## Entry criteria

- [x] Session 6-5 CONFIRMED, executed, closed (2026-08-11 — see `CLAUDE.md` Current entry).
- [x] All 6 gap-matrix rows re-verified live at CONFIRM. A1-5/A1-14/A1-17/A2-10 held exactly as
      described. Two real drifts found: **A2-5**'s target page (`code-flows/page.tsx`) does not
      exist at all (needs creation, not wiring); **A2-7**'s target page
      (`disbursement/affiliates/[affiliateId]/page.tsx`) does not exist either (only a flat
      `affiliates/page.tsx` list exists — needs creation, not an audit). Also found:
      `admin/disbursement/recipients/page.tsx` already exists (Session 4A-W3b) and already renders
      Wise recipients — not mentioned anywhere in this order's own Surface/Context.
- [x] RiseWorks-accounts page disposition resolved by Davin, live, 2026-08-11: redirect
      `/admin/disbursement/accounts` → `/admin/disbursement/recipients`; add a read-only historical
      RiseWorks tab to `recipients/page.tsx` instead of rebuilding `accounts/page.tsx` separately;
      update admin nav to point at `/admin/disbursement/recipients`.
- [x] Admin user-detail page scope resolved — build as originally specified (5 sections), confirmed
      by Davin.
- [x] Monolith baseline re-measured at CONFIRM (2026-08-11): `tsc --noEmit` clean; `eslint app
  components lib hooks --max-warnings 0` — same 3 pre-existing warnings (2× `header.tsx`, 1×
      `disbursement/batches/[batchId]/page.tsx`), 0 new, exact match to 6-5's close; `test:ci`
      **136/136 suites, 2230/2230 tests**, exact match to 6-5's close.
- [x] Davin APPROVED live in chat, 2026-08-11 (the uncommitted `PRE-DRAFT → APPROVED` rewrite,
      including its two silently-resolved product decisions and the new batch-vocabulary rule,
      confirmed as his own authentic authorization — see Deviations).

## Integration points

- **In:** `POST /api/admin/codes/[code]/cancel`, `GET /api/admin/affiliates/reports/code-flows`, `/api/disbursement/config`, `/api/admin/users`, direct Prisma queries.
- **Out:** No backend service changes.
- **Owns:** The 7 admin page files listed under Surface above.

## Ordered steps

### Step 1 — Add WISE Provider Option to Disbursement Config (`/admin/disbursement/config`) (A1-5)

- Update [`app/(dashboard)/admin/disbursement/config/page.tsx`](<file:///d:/SaaS%20Project/trading-alerts-saas-public/app/(dashboard)/admin/disbursement/config/page.tsx>):
  - Add `WISE` alongside `MOCK` and `RISE` in the provider selection radio group and status badge.
  - Wire saving via `PATCH /api/disbursement/config`.
- _Verify:_ `WISE` provider option selectable and saves configuration cleanly.
- _Commit:_ `feat(6-6): add WISE provider option to admin disbursement config`

### Step 2 — Rebuild Disbursement Accounts Page for Wise Recipients (`/admin/disbursement/accounts`) (A1-6)

- Update [`app/(dashboard)/admin/disbursement/accounts/page.tsx`](<file:///d:/SaaS%20Project/trading-alerts-saas-public/app/(dashboard)/admin/disbursement/accounts/page.tsx>):
  - Rebuild main tab to display Wise recipient accounts (`AffiliateWiseRecipient` model data, email, currency, onboarding status).
  - Retain a secondary read-only tab for historical RiseWorks accounts without un-archiving RiseWorks backend routes (F42).
- _Verify:_ Active Wise recipients display account status; legacy RiseWorks records viewable in read-only tab.
- _Commit:_ `feat(6-6): rebuild disbursement accounts page for Wise recipients and archive RiseWorks`

### Step 3 — Wire Per-Code Cancel Action in Code Inventory (`/admin/affiliates/reports/code-inventory`) (A1-14)

- Update [`app/(dashboard)/admin/affiliates/reports/code-inventory/page.tsx`](<file:///d:/SaaS%20Project/trading-alerts-saas-public/app/(dashboard)/admin/affiliates/reports/code-inventory/page.tsx>):
  - Add "Cancel Code" action button with confirmation dialog on each active promo code row.
  - Fire `POST /api/admin/codes/[code]/cancel` on confirmation.
- _Verify:_ Clicking cancel opens confirmation modal; confirming executes `POST /api/admin/codes/[code]/cancel` and updates status to cancelled.
- _Commit:_ `feat(6-6): wire per-code cancel action on code inventory report`

### Step 4 — Build Admin User Detail Page & Link from User List (`/admin/users/[id]`) (A1-17/A2-10)

- Create server component `app/(dashboard)/admin/users/[id]/page.tsx` rendering 5 sections:
  1. Profile & Account Status
  2. Subscription & Billing Info
  3. Security & 2FA Info
  4. Fraud & Security Risk Flags
  5. Affiliate & Code Info
- Update [`app/(dashboard)/admin/users/page.tsx`](<file:///d:/SaaS%20Project/trading-alerts-saas-public/app/(dashboard)/admin/users/page.tsx>) to add a "View Details" button/link on each user row pointing to `/admin/users/${user.id}`.
- _Verify:_ Clicking "View Details" navigates to `/admin/users/[id]`; all 5 sections render populated data; 404 handled for missing user ID.
- _Commit:_ `feat(6-6): build admin user detail page /admin/users/[id] and link from users list`

### Step 5 — Wire Code Flows Report & Align Batch Lifecycle Vocabulary (A2-5, A2-7)

- Update [`app/(dashboard)/admin/affiliates/reports/code-flows/page.tsx`](<file:///d:/SaaS%20Project/trading-alerts-saas-public/app/(dashboard)/admin/affiliates/reports/code-flows/page.tsx>) to fetch `GET /api/admin/affiliates/reports/code-flows` and render code flow metrics.
- Audit [`app/(dashboard)/admin/disbursement/affiliates/[affiliateId]/page.tsx`](<file:///d:/SaaS%20Project/trading-alerts-saas-public/app/(dashboard)/admin/disbursement/affiliates/[affiliateId]/page.tsx>) to align batch status vocabulary (`DRAFTING`, `PENDING_APPROVAL`, `APPROVED`, `PROCESSING`, `COMPLETED`, `CANCELLED`).
- _Verify:_ Code flows report displays usage metrics; affiliate detail page displays batch statuses matching money service terms.
- _Commit:_ `feat(6-6): wire code-flows report and align batch lifecycle vocabulary on affiliate detail page`

### Step 6 — Unit Tests for Admin Pages & Actions

- Create `__tests__/pages/admin/user-detail.test.tsx` and `__tests__/pages/admin/code-cancel.test.tsx` covering:
  - Admin user detail page rendering and 404 handling.
  - Promo code cancel action confirmation and API call.
  - Disbursement config WISE option selection.
- _Verify:_ `test:ci` runs clean with all new and existing tests passing.
- _Commit:_ `test(6-6): add unit tests for admin user detail page, code cancel action, and disbursement config`

## Rules specific to this variant

- **UI Creativity (Dial HIGH):** Full freedom on user detail page layout, report metrics charts, provider selection UI, and code cancellation dialogs.
- **Data Contract (Dial LOW):** Payloads for `codes/[code]/cancel`, `code-flows`, and `/api/disbursement/config` must strictly match API route schemas.
- **Batch Lifecycle Vocabulary:** Strictly use the REAL `PaymentBatchStatus`/`DisbursementTransactionStatus` enum values (`PENDING`, `QUEUED`, `PROCESSING`, `COMPLETED`, `FAILED`, `CANCELLED`) — corrected at CONFIRM; `DRAFTING`/`PENDING_APPROVAL`/`APPROVED` do not exist anywhere in either Prisma schema (see Deviations).
- **A11y Standards:** Keyboard accessibility, ARIA dialogs, and clear focus states.

## Done when

- [x] `/admin/disbursement/config` includes `WISE` provider option (with an explicit "Configured via `DISBURSEMENT_PROVIDER` env var" notice, since `PATCH` is a known no-op placeholder).
- [x] `/admin/disbursement/accounts` redirects to `/admin/disbursement/recipients`, which now carries a read-only historical RiseWorks tab (Davin's resolution — consolidate rather than duplicate the already-existing Wise-recipients page from Session 4A-W3b).
- [x] `POST /api/admin/codes/[code]/cancel` has a real UI consumer with confirmation modal (a standalone code-lookup form, not a per-row action — no per-code listing UI/API exists anywhere in this codebase).
- [x] `/admin/users/[id]` exists with 5 sections, linked from `/admin/users`.
- [x] `/admin/affiliates/reports/code-flows` exists (built new — the page didn't exist, only the API route did) and is wired to `GET /api/admin/affiliates/reports/code-flows`.
- [x] Batch lifecycle vocabulary aligned across disbursement pages, using the real enum values — including the new `/admin/disbursement/affiliates/[affiliateId]` page (built new — didn't exist; only a flat list page existed at the parent route).
- [x] `tsc --noEmit` clean; `eslint --max-warnings 0` — 4 pre-existing warnings (2× `header.tsx`, 1× `disbursement/batches/[batchId]/page.tsx`, both tracked since Session 6-1; 1× `admin/page.tsx:308`, new to this session's own check but confirmed via `git status`/`git diff` to be untouched by any edit this session made — see Deviations), 0 introduced by this session's own edits; `test:ci` **138/138 suites, 2238/2238 tests** (was 136/136, 2230/2230 at 6-5's close — +2 suites/+8 tests, exactly this session's own 2 new test files, zero regressions elsewhere).

## Rollback

Same-stack UI work; rollback is `git revert`.

## Retire

RiseWorks active UI surfaces retired in favor of Wise recipients.

## Deviations

1. **L11 recurrence (found at CONFIRM, resolved live):** the order file was modified-but-uncommitted, `PRE-DRAFT → APPROVED`, with real body-content drift — the two "User Review Required" open product questions (RiseWorks-accounts disposition, admin user-detail-page scope) were silently resolved in the rewrite, and a new "Money Service Batch Lifecycle Vocabulary" mandate was added that turned out to be factually wrong (see #2). No DRAFT-stage commit trail existed between the committed PRE-DRAFT and this rewrite. Reported in full before proceeding; Davin confirmed live it was his own authentic authorization, and resolved all open questions directly in the same message (see CLAUDE.md's L11 recurrence log).
2. **The order's own "Money Service Batch Lifecycle Vocabulary" mandate (`DRAFTING`, `PENDING_APPROVAL`, `APPROVED`, `PROCESSING`, `COMPLETED`, `CANCELLED`) does not exist anywhere in this codebase.** Checked both Prisma schemas (which must mirror per L1) and grepped the whole repo: real `PaymentBatchStatus` is `PENDING, QUEUED, PROCESSING, COMPLETED, FAILED, CANCELLED`; real `WiseBatchGroupStatus` is `NEW, COMPLETED, AWAITING_MANUAL_FUNDING, FUNDED, MARKED_FOR_CANCELLATION, PROCESSING_CANCEL, CANCELLED`; `DRAFTING`/`PENDING_APPROVAL` appear zero times repo-wide. Reported at CONFIRM; Davin corrected the mandate live to "use the real Prisma `PaymentBatchStatus` enum and `WiseBatchGroupStatus` enum for all badge displays" — built accordingly.
3. **A2-5 (`code-flows`) and A2-7 (`disbursement/affiliates/[affiliateId]`) don't exist at all**, contrary to the order's own Step 5 phrasing ("wire"/"audit", implying existing pages needing a small edit). `app/(dashboard)/admin/affiliates/reports/` had no `code-flows/` directory (only `code-inventory`, `commission-owings`, `profit-loss`, `sales-performance`); `app/(dashboard)/admin/disbursement/affiliates/` had only a flat `page.tsx` list, no `[affiliateId]/` dynamic route. Both real API routes/backing logic already existed and were live (`GET /api/admin/affiliates/reports/code-flows`, `GET /api/disbursement/affiliates/[affiliateId]`) — built both pages new, consuming those routes as-is. Davin's own resolution named `code-flows`/`users/[id]` explicitly as pages to create; `disbursement/affiliates/[affiliateId]` was built the same way since it's one of the order's own 6 named gap-matrix rows (A2-7) and "align vocabulary" is impossible on a file that doesn't exist.
4. **A1-6's disposition changed from "rebuild" to "redirect + consolidate"**, found before building: `app/(dashboard)/admin/disbursement/recipients/page.tsx` already existed (Session 4A-W3b) and already rendered live Wise recipients — the order's own Surface/Context never mentioned it. Rebuilding a second Wise-recipient view on `accounts/page.tsx` would have duplicated it. Davin's resolution: `accounts/page.tsx` now redirects to `recipients/page.tsx`, which gained a tab switcher (Wise Recipients / RiseWorks Historical, read-only, no create/sync actions — RiseWorks backend routes stay archived per F42). The separate "RiseWorks Accounts" nav entry was removed (redundant with the consolidated page); the top-bar provider badge and sidebar "Payment Provider" widget were changed from a hardcoded "RiseWorks" string to `getDefaultProvider()`, matching the session's own "keep the UI truthful" theme.
5. **A1-14's literal "each active promo code row" isn't buildable** — `code-inventory/page.tsx` only ever showed aggregate counts by status/reason, never individual code rows, and no per-code listing endpoint (`/api/admin/codes` as a list) exists anywhere in this codebase. Built as a standalone code-lookup form instead (type a code, confirm, fires the real `POST /api/admin/codes/[code]/cancel`) — the real intent (give that endpoint a UI consumer with a confirmation step) is satisfied without inventing a new backend listing endpoint.
6. **A1-5 needed two real backend fixes beyond "add a UI option", found while implementing it, contradicting the order's own "Out: No backend service changes"** — approved as narrow, necessary exceptions: (a) `lib/disbursement/constants.ts`/`provider-factory.ts` had never been updated for WISE (only money-service's own copy had — the exact `LESSONS-LEARNED.md` L31/L32 class, a PORT session moving code without syncing the sibling copy), so `isProviderAvailable('WISE')` always returned `false` and `getDefaultProvider()` could never return `'WISE'` even with the env var set; fixed additively, mirroring money-service's own semantics exactly. (b) `GET /api/disbursement/config`'s `available` list never included WISE. Also fixed, while in this exact code path: a genuine pre-existing bug where the frontend's `DisbursementConfig` type treated `config.provider` as a flat string, but the real API returns a nested `{default, available, riseEnabled}` object — rendering `{config.provider}` directly would have thrown a React child-type error the first time this page was actually loaded with real data (never caught before since no live browser testing has been possible in this environment since Session 4B-21, per Waiting-on #117). `PATCH /api/disbursement/config` itself was left as its existing no-op placeholder (per Davin's resolution) — the page now shows an explicit "Configured via `DISBURSEMENT_PROVIDER` env var" notice instead of implying Save switches the live provider.
7. **A new, unexplained lint warning appeared during this session that this session did not cause:** `app/(dashboard)/admin/page.tsx:308` (`@next/next/no-html-link-for-pages` on a bare `<a href="/admin/users?tier=PRO">`) — confirmed via `git status`/`git diff` that this file has zero changes in this session's history. The scoped baseline (`eslint app components lib hooks --max-warnings 0`) showed exactly 3 warnings before any edit this session made and 4 after, with the 4th being this untouched file. Not chased further (root cause unclear — possibly an eslint cache/state artifact from an earlier session); flagged in Waiting-on, not fixed (out of this session's own scope, a genuinely different file).
8. **One pre-existing test broke correctly, not a regression:** `__tests__/lib/disbursement/constants.test.ts` hard-coded `SUPPORTED_PROVIDERS` to `['RISE', 'MOCK']` — Step 1's WISE addition (Deviation #6) correctly changed the real array; updated the assertion to `['RISE', 'MOCK', 'WISE']` with a comment explaining why, per `LESSONS-LEARNED.md` L3 (a ported/pre-existing test needing its assertion changed is a finding, not a silent fix).

## Known wrinkles / do-not-touch

- `lib/api/index.ts` stays untouched (`EXECUTOR-PROTOCOL.md` §5).
- `frontend/` mirror tree is out of scope (`EXECUTOR-PROTOCOL.md` §5).
- RiseWorks backend routes stay archived (F42).
- `DECISION-LOG.md` **F49** (dLocal `payment_method_flow`) and **F60** (Stripe webhook cutover) stay open, non-blocking.

## Next-session handoff

Session **6-7** (Affiliate — commissions page real-data wiring, payment-setup consolidation) is next in Phase 6.
