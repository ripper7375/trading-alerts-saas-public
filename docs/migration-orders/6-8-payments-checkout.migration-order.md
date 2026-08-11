# Migration Order — Session 6-8 — Payments / Checkout

> For a session that **closes the 4 PAYMENTS-surface gap-matrix rows** assigned to it (F61/A1-7, A1-8,
> A2-8, A2-9) — resolves `DECISION-LOG.md` **F61** (`GET /api/geo/detect` 404 on pricing page load),
> wires all 3 orphaned checkout endpoints (`[paymentId]`, `validate-code`, `exchange-rate`), and builds
> the two missing post-checkout landing pages (`/checkout/return`, `/upgrade/success`). Adapted from
> `TEMPLATE-UI-BUILD.md`, dial **High for the 2 new landing pages, Low for data**.

**Session:** 6-8 · **Phase:** Phase 6 (Frontend Redesign) · **Variant:** UI-BUILD (dial HIGH for the 2 new landing pages, LOW for data) · **Status:** APPROVED · **Generated:** 2026-08-10 ·
**Flags touched:** none · **Estimated time:** ~3-4h
**Surface:** `app/api/geo/detect/route.ts` (new route wrapper), [`app/(marketing)/pricing/page.tsx`](<file:///d:/SaaS%20Project/trading-alerts-saas-public/app/(marketing)/pricing/page.tsx>) (geo detect consumer), [`components/payments/CountrySelector.tsx`](file:///d:/SaaS%20Project/trading-alerts-saas-public/components/payments/CountrySelector.tsx) (geo detect consumer), [`app/checkout/page.tsx`](file:///d:/SaaS%20Project/trading-alerts-saas-public/app/checkout/page.tsx) (checkout page), [`components/payments/DiscountCodeInput.tsx`](file:///d:/SaaS%20Project/trading-alerts-saas-public/components/payments/DiscountCodeInput.tsx) (code validate consumer), [`components/payments/PriceDisplay.tsx`](file:///d:/SaaS%20Project/trading-alerts-saas-public/components/payments/PriceDisplay.tsx) (live exchange rate consumer), `app/checkout/return/page.tsx` (new return page), `app/upgrade/success/page.tsx` (new success page) ·
**Feeds on:** `lib/geo/detect-country.ts`, `GET /api/payments/dlocal/[paymentId]`, `GET /api/payments/dlocal/exchange-rate`, `POST /api/checkout/validate-code`, `GET /api/subscription`.

---

## Context

Four rows from `docs/files-completion-list/ui-page-gap-analysis.md`, independently re-verified:

- **F61 / A1-7 (`/api/geo/detect` 404):** `pricing/page.tsx` and `CountrySelector.tsx` both call `GET /api/geo/detect`. `lib/geo/detect-country.ts` already implements `detectCountry(headers)` with 100% test coverage. Builds `app/api/geo/detect/route.ts` as a thin wrapper around `detectCountry`.
- **A1-8 (`/checkout` & 3 orphaned endpoints):** Wires all 3 orphaned endpoints into real UI consumers:
  - `GET /api/payments/dlocal/[paymentId]` -> Data source for `/checkout/return`.
  - `POST /api/checkout/validate-code` -> Wires into `DiscountCodeInput.tsx` to validate promo codes.
  - `GET /api/payments/dlocal/exchange-rate` -> Wires into `PriceDisplay.tsx` to fetch and render live service-returned exchange rates.
- **A2-8 (`/checkout/return`):** Builds `app/checkout/return/page.tsx` for dLocal payment returns, displaying live payment status from `GET /api/payments/dlocal/[paymentId]`.
- **A2-9 (`/upgrade/success`):** Builds `app/upgrade/success/page.tsx` for Stripe / PRO checkout returns (`?upgrade=PRO`), displaying plan activation confirmation and feature summary.

## User Review Required

> [!IMPORTANT]
> **Orphaned Checkout Endpoints Disposition (A1-8):** Wire all 3 endpoints (`[paymentId]`, `validate-code`, `exchange-rate`) into active UI consumers rather than retiring any of them:
>
> - `[paymentId]` feeds `/checkout/return`.
> - `validate-code` feeds `DiscountCodeInput.tsx`.
> - `exchange-rate` feeds `PriceDisplay.tsx`.

> [!IMPORTANT]
> **Service-Returned Math Rule:** Price displays and currency conversions MUST render values returned directly by API services (`/api/payments/dlocal/exchange-rate`, `/api/subscription`). Client-side hardcoded currency math is forbidden.

## Entry criteria

- [ ] Session 6-7 CONFIRMED, executed, closed (2026-08-11 — see `CLAUDE.md` Current entry).
- [ ] All 4 rows (F61/A1-7, A1-8, A2-8, A2-9) re-verified live at CONFIRM.
- [ ] `lib/geo/detect-country.ts` re-verified (signature: `detectCountry(headers?: Headers)`).
- [ ] 3-endpoint disposition resolved (all 3 wired into UI consumers).
- [ ] Monolith baseline re-measured at CONFIRM (`tsc --noEmit`, `eslint app components lib hooks --max-warnings 0`, `test:ci` — last known at 6-7's close: 142/142 suites, 2261/2261 tests, 4 pre-existing lint warnings).
- [ ] Advisor DRAFT review + Davin APPROVED before CONFIRM.

## Integration points

- **In:** `lib/geo/detect-country.ts`, `GET /api/payments/dlocal/[paymentId]`, `GET /api/payments/dlocal/exchange-rate`, `POST /api/checkout/validate-code`, `GET /api/subscription`.
- **Out:** No backend service changes.
- **Owns:** `app/api/geo/detect/route.ts`, `app/checkout/return/page.tsx`, `app/upgrade/success/page.tsx`, `components/payments/DiscountCodeInput.tsx`, `components/payments/PriceDisplay.tsx`.

## Ordered steps

### Step 1 — Create Geo Detection API Route (`/api/geo/detect`) (F61 / A1-7)

- Create `app/api/geo/detect/route.ts`:
  - Call `detectCountry(request.headers)` from `lib/geo/detect-country.ts`.
  - Return JSON response `{ country: countryCode, countryCode }`.
- _Verify:_ `GET /api/geo/detect` returns 200 with country code; pricing page and country selector load without 404 errors.
- _Commit:_ `feat(6-8): create /api/geo/detect route wrapper around detectCountry (resolves F61)`

### Step 2 — Wire Code Validation & Live Exchange Rates on Checkout (A1-8)

- Update [`components/payments/DiscountCodeInput.tsx`](file:///d:/SaaS%20Project/trading-alerts-saas-public/components/payments/DiscountCodeInput.tsx) to call `POST /api/checkout/validate-code`.
- Update [`components/payments/PriceDisplay.tsx`](file:///d:/SaaS%20Project/trading-alerts-saas-public/components/payments/PriceDisplay.tsx) to fetch `GET /api/payments/dlocal/exchange-rate` when a local currency is selected and display service-returned rates.
- _Verify:_ Promo code validation calls `POST /api/checkout/validate-code`; price display renders service-returned exchange rates.
- _Commit:_ `feat(6-8): wire code validation and live exchange rates on checkout`

### Step 3 — Build Checkout Return Landing Page (`/checkout/return`) (A2-8)

- Create `app/checkout/return/page.tsx` & client component:
  - Extract `payment_id` / `paymentId` from search params and fetch `GET /api/payments/dlocal/[paymentId]`.
  - Render payment status card (`PAID`, `PENDING`, `REJECTED`, `CANCELLED`), order summary, and dashboard return button.
- _Verify:_ Navigating to `/checkout/return?payment_id=...` fetches payment status and displays confirmation card.
- _Commit:_ `feat(6-8): build checkout return landing page with live dLocal payment status`

### Step 4 — Build Upgrade Success Landing Page (`/upgrade/success`) (A2-9)

- Create `app/upgrade/success/page.tsx` & client component:
  - Extract `upgrade` query param (`?upgrade=PRO`) or fetch `GET /api/subscription`.
  - Render subscription success card ("Welcome to PRO!"), list unlocked features, and display "Go to Dashboard" button.
- _Verify:_ Navigating to `/upgrade/success?upgrade=PRO` displays subscription success card.
- _Commit:_ `feat(6-8): build upgrade success landing page for completed checkout`

### Step 5 — Unit Tests for Payments & Checkout Routes

- Create `__tests__/pages/checkout/geo-detect.test.tsx` and `__tests__/pages/checkout/checkout-return.test.tsx` covering:
  - `/api/geo/detect` route handling.
  - Discount code validation and live exchange rate fetching.
  - `/checkout/return` payment status display.
  - `/upgrade/success` plan confirmation view.
- _Verify:_ `test:ci` runs clean with all new and existing tests passing.
- _Commit:_ `test(6-8): add unit tests for geo detection, checkout return, and upgrade success pages`

## Rules specific to this variant

- **UI Creativity (Dial HIGH):** Full freedom on checkout return card layout, upgrade success graphics, and status badges.
- **Data Contract (Dial LOW):** Payloads must strictly match API route schemas.
- **Service-Returned Math:** Display exchange rates and pricing returned by API services — zero client math.
- **A11y Standards:** ARIA alerts, keyboard focus management, and screen reader announcements.

## Done when

- [ ] F61 resolved — `GET /api/geo/detect` live and returning country data.
- [ ] `POST /api/checkout/validate-code` wired into promo code input.
- [ ] `GET /api/payments/dlocal/exchange-rate` wired into price display.
- [ ] `/checkout/return` page renders live dLocal payment status.
- [ ] `/upgrade/success` page renders subscription success card.
- [ ] `tsc --noEmit` clean; `eslint --max-warnings 0` introduces 0 new warnings; `test:ci` green.

## Rollback

Same-stack UI work; rollback is `git revert`.

## Retire

N/A.

## Deviations

_(filled during execution)_

## Known wrinkles / do-not-touch

- `lib/api/index.ts` stays untouched (`EXECUTOR-PROTOCOL.md` §5).
- `frontend/` mirror tree is out of scope (`EXECUTOR-PROTOCOL.md` §5).
- RiseWorks stays archived (F42).
- `DECISION-LOG.md` **F49** (dLocal `payment_method_flow`), **F60** (Stripe webhook cutover), and **F63** (public legal pages, Session 6-10) stay open, non-blocking.

## Next-session handoff

Session **6-10** (Public/Marketing surface — resolves F63, the missing `/terms`/`/privacy`/`/disclaimer` pages) is next in Phase 6.
