# Migration Order — Session 6-8 — Payments / Checkout

> For a session that **closes the 4 PAYMENTS-surface gap-matrix rows** assigned to it (F61/A1-7, A1-8,
> A2-8, A2-9) — resolves `DECISION-LOG.md` **F61** (`GET /api/geo/detect` 404 on pricing page load),
> wires all 3 orphaned checkout endpoints (`[paymentId]`, `validate-code`, `exchange-rate`), and builds
> the two missing post-checkout landing pages (`/checkout/return`, `/upgrade/success`). Adapted from
> `TEMPLATE-UI-BUILD.md`, dial **High for the 2 new landing pages, Low for data**.

**Session:** 6-8 · **Phase:** Phase 6 (Frontend Redesign) · **Variant:** UI-BUILD (dial HIGH for the 2 new landing pages, LOW for data) · **Status:** CONFIRMED · **Generated:** 2026-08-10 ·
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

- [x] Session 6-7 CONFIRMED, executed, closed (2026-08-11 — see `CLAUDE.md` Current entry).
- [x] All 4 rows (F61/A1-7, A1-8, A2-8, A2-9) re-verified live at CONFIRM — with 3 material
      corrections found and resolved by Davin live (see Deviations).
- [x] `lib/geo/detect-country.ts` re-verified — signature exact match
      (`detectCountry(headers?: Headers): Promise<string>`), 100% statement/function/line
      coverage (95.2% branch).
- [x] 3-endpoint disposition resolved — Davin's live correction: only `[paymentId]` gets wired
      (into `/checkout/return`); `validate-code`/`exchange-rate` stay orphaned, `DiscountCodeInput`/
      `PriceDisplay` stay on their existing, already-working endpoints.
- [x] Monolith baseline re-measured at CONFIRM: `tsc --noEmit` clean; `eslint app components lib
  hooks --max-warnings 0` → exactly the same 4 pre-existing warnings; `test:ci` 142/142
      suites, 2261/2261 tests — exact match to 6-7's own close.
- [x] Davin APPROVED before CONFIRM — confirmed live as his own authentic authorization (the
      uncommitted-rewrite pattern flagged at CONFIRM, matching `LESSONS-LEARNED.md` L11).

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

- [x] F61 resolved — `GET /api/geo/detect` live and returning country data.
- [x] ~~`POST /api/checkout/validate-code` wired into promo code input~~ — **superseded by Davin's
      live Step 2 resolution**: `DiscountCodeInput.tsx` stays on its existing, working
      `/api/payments/dlocal/validate-discount` call. `validate-code` stays orphaned (a real,
      different, unauthenticated/IP-rate-limited endpoint — deliberately not wired this session).
- [x] ~~`GET /api/payments/dlocal/exchange-rate` wired into price display~~ — **superseded**:
      `PriceDisplay.tsx` stays on its existing `/api/payments/dlocal/convert` call, which already
      returns `localAmount` server-side (honoring the Service-Returned Math Rule). Wiring
      `exchange-rate` instead would have forced client-side multiplication, violating that same
      rule two paragraphs later in this order's own text.
- [x] `/checkout/return` page renders live dLocal payment status — wired to the real, previously
      orphaned `GET /api/payments/dlocal/[paymentId]`.
- [x] `/upgrade/success` page renders subscription success card — confirms real PRO status via
      `GET /api/subscription` rather than trusting the `upgrade` query param alone.
- [x] `tsc --noEmit` clean; `eslint app components lib hooks --max-warnings 0` → same 4
      pre-existing warnings, 0 new; `test:ci` **145/145 suites, 2278/2278 tests** (was 142/142,
      2261/2261 — +3 suites/+17 tests, exactly this session's own 3 new test files, zero
      regressions elsewhere).

## Rollback

Same-stack UI work; rollback is `git revert`.

## Retire

N/A.

## Deviations

1. **L11 pattern, again:** the order file was modified-but-uncommitted at CONFIRM (committed
   `HEAD` had `Status: PRE-DRAFT`, citing `phase-6-frontend-gap-matrix.md`; the working copy was
   a full rewrite to `Status: APPROVED`, citing the less-authoritative
   `docs/files-completion-list/ui-page-gap-analysis.md`, with the PRE-DRAFT's own explicit "User
   Review Required" wire-vs-delete question for `validate-code`/`exchange-rate` silently resolved
   to "wire all 3" and a full 5-step plan added — no DRAFT-stage commit trail). Reported in full
   at CONFIRM before proceeding; Davin confirmed live it was his own authentic authorization.
2. **F61 was still OPEN in `DECISION-LOG.md` with an explicit, unresolved Davin-owned question**
   ("build the missing route, or delete both call sites... not a technical coin-flip" — geo-IP
   detection has cost/privacy/vendor implications, `detectCountryFromIP` calls a third-party
   plain-HTTP lookup, `ip-api.com`, with the caller's real IP) that the order's own Context section
   had silently treated as already resolved to "build it." Surfaced at CONFIRM; Davin confirmed
   live: build it as specified, keeping the existing IP-geolocation fallback as-is. F61 → RESOLVED.
3. **Step 2's own two "wire an orphan" instructions targeted components that already had live,
   working consumers of different endpoints — found by reading the components before editing
   them, not assumed from the order's prose (`LESSONS-LEARNED.md` L27 recurrence):**
   `DiscountCodeInput.tsx` already calls `POST /api/payments/dlocal/validate-discount` (session-
   authenticated, per-user rate-limited); the order's target, `POST /api/checkout/validate-code`,
   is a genuinely different, unauthenticated, per-IP-rate-limited endpoint with a different
   response shape (`{discount:{percent,amount,regularPrice,finalPrice}}` vs. the current
   `{discountPercent}`). `PriceDisplay.tsx` already calls `GET /api/payments/dlocal/convert`,
   which returns `localAmount` directly; the order's target, `GET /api/payments/dlocal/
exchange-rate`, returns only `{currency,rate}` — wiring it as literally instructed would have
   forced client-side `usdAmount * rate` math, **directly violating this same order's own
   "Service-Returned Math Rule"** two paragraphs later. Reported at CONFIRM; Davin's live
   resolution: leave both components untouched (both endpoints stay genuinely orphaned — the
   order's own A1-8 disposition narrows from "wire all 3" to "wire `[paymentId]` only").
4. **A2-9's own `?upgrade=PRO` premise was factually wrong** — both
   `app/api/checkout/route.ts` and money-service's byte-identical
   `stripe-checkout.controller.ts:95` built `successUrl = '${baseUrl}/dashboard?upgrade=success'`,
   not a redirect to `/upgrade/success` at all, and the query value was the literal string
   `success`, not `PRO` (`dashboard/page.tsx` confirmed to never read it either way — the order's
   "zero page reads it today" claim held). Reported at CONFIRM; Davin's live resolution: build
   `/upgrade/success` AND repoint `successUrl` to `${baseUrl}/upgrade/success?upgrade=success`.
5. **Found mid-execution, escalated separately: `app/api/checkout/route.ts` forwards the entire
   request to money-service whenever `shouldUseMoneyServiceForStripeWrite()` is true — which,
   per Session 4A-10b, is the live state in production (Stripe/Group A cut over).** This means
   the monolith's own `successUrl` construction is dead code in production today; money-service's
   copy is what real users actually see. Editing only the monolith file, as Davin's literal Step 4
   instruction named, would have shipped a fix with zero live effect. Asked directly via a
   clarifying question before committing Step 4; Davin's call: mirror both files identically,
   matching this migration's established precedent (e.g. F48's dLocal signing fix touched both
   copies). Both `app/api/checkout/route.ts` and
   `money-service/src/stripe/stripe-checkout.controller.ts` updated in the same commit; grepped
   both trees first to confirm no test asserts the old literal string (only the out-of-scope
   `frontend/` mirror does).
6. **`/checkout/return`'s status card was built against the real `PaymentStatus` vocabulary
   (`PENDING`/`COMPLETED`/`FAILED`/`CANCELLED`/`REFUNDED`, verified against `types/dlocal.ts` and
   the `Payment` model's own schema comment), not the order's own literal
   `PAID`/`PENDING`/`REJECTED`/`CANCELLED` list** — 2 of 4 values were wrong (`PAID`→`COMPLETED`,
   `REJECTED`→`FAILED`) and `REFUNDED` was missing entirely. Data Contract dial LOW: payloads must
   match the real, live schema, not the order's paraphrase.
7. **A real, pre-existing gap found reading `lib/dlocal/dlocal-payment.service.ts`'s
   `createPayment`, not fixed (out of this session's own scope):** no `return_url`/`success_url`
   is ever sent to dLocal when creating a payment — only `notification_url` (the server-to-server
   webhook). This means dLocal's own hosted payment page has no configured way to redirect a real
   customer back to `/checkout/return` today; the order's own hedge ("Extract `payment_id` /
   `paymentId`") was itself an acknowledgment of this ambiguity. Built the page to support both
   param names per the order's own text, and flagged this as a real, separate gap (see
   Next-session handoff / `CLAUDE.md` Waiting-on) rather than silently wiring a
   `return_url`/`callback_url` into the dLocal create-payment request, which would be a genuine
   payments-behavior change outside this UI-BUILD session's stated scope.
8. **A `lucide-react` import error caught by `tsc`, not anticipated:** `Headset` isn't exported by
   the installed version; swapped for `Headphones` (same icon family, same visual intent) in
   `app/upgrade/success/page.tsx`.
9. **A stable-mock-reference test bug caught before committing, matching a precedent already
   documented in `__tests__/pages/notifications/notifications-page.test.tsx`'s own comment:**
   both new page-level test files initially mocked `next/navigation`'s `useRouter`/
   `useSearchParams` with a fresh object literal per call, which made the pages' own
   `useCallback`-wrapped fetchers recompute every render and re-fire their mount effect in a loop
   — real state assertions still passed (the extra fetch's rejection was swallowed by the error
   branch after the primary assertion settled), but it produced console noise and flaky-adjacent
   behavior. Fixed by hoisting stable `mockRouter`/`mockSearchParams` objects, per the same
   established pattern.
10. **Harvested into `LESSONS-LEARNED.md` as new L63, at Davin's explicit direction despite the
    active file already being at 62 entries** (far past the stated 40 cap, flagged repeatedly
    since Sessions 4A-2/4A-4/6-7 without a consolidation pass happening): once a monolith write
    route has a flag-forwarding shim to money-service AND that flag is cut over in production,
    editing only the monolith copy of any downstream logic (URL construction, response shaping,
    etc.) has zero live effect — always check `migration-cutover-table.md`/`CLAUDE.md`'s own
    cutover state for that specific slice before treating a monolith-side-only edit as sufficient,
    and mirror the change into the money-service copy when it's the one actually serving traffic.
    Also added a short recurrence note to the existing **L59** (stable-mock-reference pattern),
    hit again this session in both new page-level test files (Deviation 9). The consolidation
    backlog itself is still not addressed — the file is now at 63 entries, one further over cap.

## Known wrinkles / do-not-touch

- `lib/api/index.ts` stays untouched (`EXECUTOR-PROTOCOL.md` §5).
- `frontend/` mirror tree is out of scope (`EXECUTOR-PROTOCOL.md` §5).
- RiseWorks stays archived (F42).
- `DECISION-LOG.md` **F49** (dLocal `payment_method_flow`), **F60** (Stripe webhook cutover), and **F63** (public legal pages, Session 6-10) stay open, non-blocking.

## Next-session handoff

Session **6-10** (Public/Marketing surface — resolves F63, the missing `/terms`/`/privacy`/`/disclaimer` pages) is next in Phase 6.
