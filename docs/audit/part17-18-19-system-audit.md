# Parts 12–17–18–19 System Audit

**Scope:** Part 12 (E-commerce & Billing / Stripe), Part 17 (Affiliate Portal), Part 18 (dLocal Payments), Part 19 (RiseWorks Disbursement)
**Note:** Part 12 and Part 18 share many files (dLocal routes/services, both webhooks, checkout validation); those shared files were audited once and are reported under whichever finding applies.
**Audit focus:** (1) end-to-end workflow & operations, (2) module security, (3) automation coherence
**Date:** 2026-07-04
**Method:** Source-level trace of every integration seam (checkout → payment → commission → payout), webhook handlers, cron jobs, and auth gates. Findings verified against actual code, not documentation.

---

## Executive Summary

The four business parts (12, 17, 18, 19) are individually well-built (TDD, clean service layers, consistent patterns), but the audit found that **the money pipeline was broken at four seams**: dLocal payments never created affiliate commissions, discounts were validated but never applied to the charge on EITHER provider (dLocal F2, Stripe F14), and no mechanism ever approved commissions for payout. Additionally, **the entire automation layer was dormant** because no cron schedules were registered. All critical and high findings have been fixed in this audit (see "Fix Applied" per finding).

| Severity                            | Found | Fixed |
| ----------------------------------- | ----- | ----- |
| Critical                            | 5     | 5     |
| High                                | 5     | 5     |
| Medium/Low (documented, acceptable) | 3     | n/a   |

---

## Critical Findings

### F1 — dLocal payments never created affiliate commissions (Part 17 ↔ 18 seam broken)

- **Where:** `app/api/webhooks/dlocal/route.ts`
- **What:** The `payment.paid` handler created the subscription and upgraded the user to PRO, but never marked the affiliate code as USED nor created a `Commission` record. Only the Stripe webhook (`lib/stripe/webhook-handlers.ts → processAffiliateCommission`) did this. Any affiliate whose code was used through dLocal earned nothing.
- **Impact:** Silent revenue-share loss for affiliates in all 8 dLocal markets; affiliate dashboards and admin P&L undercount conversions.
- **Fix Applied:** New shared module `lib/affiliate/conversion-processor.ts` (`processAffiliateConversion()`) — marks code USED, creates PENDING commission, updates profile counters, all in one transaction, idempotent on webhook retries. The dLocal webhook now calls it after subscription creation (step 5b) for MONTHLY payments carrying a `discountCode`. Failures are logged but never fail the payment webhook.

### F2 — Discount validated but never applied to the dLocal charge

- **Where:** `app/api/payments/dlocal/create/route.ts`
- **What:** `const discountAmount = 0; // full discount validation would be in Part 18B` — a leftover Part 18A TODO. Customers who entered a valid code were charged full price.
- **Impact:** Customer-facing pricing bug; contradiction between the validate-discount response ("20% will be applied") and the actual charge.
- **Fix Applied:** The create route now looks up the affiliate code (ACTIVE, unexpired, active affiliate), rejects invalid codes with 400, computes `discountAmount` from the code's snapshotted `discountPercent`, converts the **discounted** USD amount to local currency, and passes the discounted amount to dLocal. `Payment.amountUSD` keeps the gross for correct commission math.

### F3 — No commission approval mechanism: Part 19 had nothing to pay

- **Where:** Commission lifecycle (17 → 19)
- **What:** Commissions are created PENDING; the disbursement aggregator only pays APPROVED commissions; **no code path anywhere transitioned PENDING → APPROVED.** The payout pipeline would run forever with zero payees.
- **Impact:** Complete automation dead-end; affiliates never paid without manual DB edits.
- **Fix Applied:** `DisbursementProcessor.approveMaturedCommissions()` — auto-approves PENDING commissions whose `earnedAt` is older than a refund window. Window is read from SystemConfig key `affiliate_commission_approval_days` (default 14, admin-tunable at runtime). Runs as step 0 of the daily `process-pending-disbursements` cron and is audit-logged (`cron.commissions_auto_approved`).

### F4 — All cron jobs dormant: vercel.json had no schedules

- **Where:** `vercel.json`
- **What:** All 8 cron route handlers existed and checked `CRON_SECRET`, but the `crons` array was missing entirely — nothing was ever scheduled. Additionally, three Part 17 cron routes (`distribute-codes`, `expire-codes`, `send-monthly-reports`) only exported POST, while Vercel Cron invokes GET — they would have returned 405 even if scheduled.
- **Impact:** No code distribution, no expiry, no renewal reminders, no downgrades, no automated payouts, no account sync. The whole automation layer described in the docs was inert.
- **Fix Applied:** `vercel.json` now registers all 8 crons (monthly: distribute-codes 1st 00:00, send-monthly-reports 1st 06:00, expire-codes 28–31 23:59; daily: check-expiring 00:00, downgrade-expired 01:00, process-pending-disbursements 02:00, sync-riseworks-accounts 03:00, daily-maintenance 04:00). The three POST-only routes now export a GET wrapper delegating to POST.

### F14 — Stripe checkout never applied the affiliate discount (Part 12)

- **Where:** `lib/stripe/stripe.ts` (`createCheckoutSession`), `app/api/checkout/route.ts`
- **What:** The affiliate code was stored in session metadata (so the commission WAS created on the webhook), but no coupon/discount was attached to the Stripe session — the customer paid full price after `validate-code` told them "20% discount will be applied!". The checkout route also never validated the code, so invalid codes silently produced full-price sessions with no commission. Mirror image of F2 on the dLocal side.
- **Impact:** Customer-facing pricing bug on the primary (Stripe) payment path; broken promise on every Stripe checkout with a code.
- **Fix Applied:** The checkout route now validates the code up front (ACTIVE, unexpired, active affiliate — 400 `INVALID_AFFILIATE_CODE` otherwise) and passes the code's `discountPercent` to `createCheckoutSession`, which creates a one-time Stripe coupon (`percent_off`, `duration: 'once'`) and attaches it via `discounts`. Note: Stripe forbids `discounts` + `allow_promotion_codes` together, so promotion codes are disabled only when an affiliate discount is applied.

---

## High Findings

### F5 — Payout completion never moved affiliate balances

- **Where:** `lib/disbursement/webhook/event-processor.ts` (`payment.completed`)
- **What:** The RiseWorks webhook marked the transaction COMPLETED and the commission PAID, but never touched `AffiliateProfile.pendingCommissions` / `paidCommissions`. The Stripe/dLocal side increments `pendingCommissions` when a commission is earned, so after every payout the affiliate dashboard and the commission-owings report would drift permanently.
- **Fix Applied:** The handler now runs transaction-complete + commission-PAID + balance move (`pendingCommissions` decrement, `paidCommissions` increment) atomically in one `$transaction`.

### F6 — Stripe commissions used static config instead of SystemConfig

- **Where:** `lib/stripe/webhook-handlers.ts`
- **What:** Commission breakdown used hardcoded `AFFILIATE_CONFIG.BASE_PRICE_USD`, defeating the SystemConfig design ("admin can change without redeploy"). The dynamic helper `getBasePriceUsd()` existed but was unused here.
- **Fix Applied:** Now calls `getBasePriceUsd()` (SystemConfig) with the static constant as fallback on lookup failure. Percentages continue to come from the code's snapshot — correct, since that is what the customer was promised.

### F7 — Code-validation endpoints had no rate limiting (enumeration risk)

- **Where:** `app/api/checkout/validate-code/route.ts` (public), `app/api/payments/dlocal/validate-discount/route.ts` (authenticated)
- **What:** Both endpoints confirm whether an 8-char code exists and is active, with no throttle. `lib/rate-limit.ts` (Redis sliding window) existed but was not wired in.
- **Fix Applied:** Both endpoints now enforce 10 attempts/minute (per-IP for the public endpoint via `x-forwarded-for`, per-user for the authenticated one), returning 429. The limiter fails open on Redis outage, so checkout is never blocked by infrastructure.

### F10 — dLocal subscriptions hardcoded amountUsd: 29 for every plan

- **Where:** `app/api/webhooks/dlocal/route.ts`
- **What:** Both the create and update paths wrote `amountUsd: 29` even for the $1.99 3-day plan.
- **Impact:** Wrong revenue reporting, wrong invoice display.
- **Fix Applied:** `planAmountUsd` derived from `payment.amountUSD` (actual) with plan-based `PRICING` fallback.

### F12 — validate-discount returned a hardcoded 10% discount

- **Where:** `app/api/payments/dlocal/validate-discount/route.ts`
- **What:** `const discountPercent = 10; // Default` — ignored the code's real `discountPercent` (20% by default from SystemConfig). Checkout showed a different discount than commission math used. The route also called `getServerSession()` without `authOptions`, which can yield a session without `user.id`.
- **Fix Applied:** Returns `affiliateCode.discountPercent`; session call now passes `authOptions`.

---

## Medium / Low (documented, no change required)

- **F8 — dLocal webhook idempotency** relies on the payment-status guard (skip if already COMPLETED) rather than an event store like Part 19's `RiseWorksWebhookEvent` table. Acceptable; the new conversion processor adds its own USED-code guard. Consider a `DLocalWebhookEvent` table during the NestJS migration.
- **F11 — `/api/disbursement/health` is unauthenticated.** Reasonable for uptime monitors; it leaks only coarse counts. Consider a monitor token when migrating.
- **F13 — Admin code reporting was census-only.** The admin side had point-in-time status counts but no period reconciliation. **Feature added:** `buildGlobalCodeInventoryReport()` in `lib/affiliate/report-builder.ts` and new admin endpoint `GET /api/admin/affiliates/reports/code-flows?start=&end=` — global opening balance, additions by reason, reductions (used/expired/cancelled), closing balance, plus `affiliatesWithActivity`.

### Part 12 seams confirmed good (no action)

- Stripe webhook (`app/api/webhooks/stripe/route.ts`) verifies `stripe-signature` on the raw body via `constructEvent`.
- Checkout → metadata → webhook → `processAffiliateCommission` linkage works (the commission side of the Part 12↔17 seam was already sound).
- `subscription`, `subscription/cancel`, and `invoices` routes all authenticate with `getServerSession(authOptions)`; invoices merge Stripe + dLocal payments (18B integration present).

### Security posture confirmed good (no action)

- All three webhook receivers (Stripe, dLocal, RiseWorks) verify HMAC-SHA256 signatures before processing.
- All admin routes checked enforce ADMIN role (via `requireAdmin()` or inline session checks).
- All 8 cron routes require `CRON_SECRET` bearer token.
- Disbursement operations are audit-logged (`DisbursementAuditLog`); config changes audited via `SystemConfigHistory`.
- Anti-abuse: 3-day plan lifetime limit, KYC gating before payout, fraud-alert dashboard.

---

## The Automated Pipeline After This Audit

```
Customer pays (Stripe or dLocal, code applied & discount charged)   [F1, F2, F14]
  → webhook verified → subscription + PRO tier + commission PENDING
  → (daily 02:00) auto-approve commissions past refund window        [F3]
  → aggregate APPROVED ≥ $50, KYC-approved → batch → RiseWorks USDC
  → payment.completed webhook → commission PAID + balances moved     [F5]
  → dashboards, code-flows report, P&L all reconcile                 [F13]
All of it actually scheduled.                                        [F4]
```

## Files Changed

| File                                                                         | Change                                                           |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `lib/affiliate/conversion-processor.ts`                                      | **NEW** — shared conversion processing (both providers)          |
| `app/api/webhooks/dlocal/route.ts`                                           | Commission creation (5b), real plan amount, PaymentRecord fields |
| `app/api/payments/dlocal/create/route.ts`                                    | Real discount validation + application to charge                 |
| `app/api/payments/dlocal/validate-discount/route.ts`                         | Real discount %, authOptions, rate limit                         |
| `app/api/checkout/validate-code/route.ts`                                    | Per-IP rate limit                                                |
| `lib/disbursement/webhook/event-processor.ts`                                | Atomic balance move on payout completion                         |
| `lib/disbursement/cron/disbursement-processor.ts`                            | `approveMaturedCommissions()` + cron step 0                      |
| `lib/stripe/webhook-handlers.ts`                                             | Dynamic base price from SystemConfig                             |
| `lib/stripe/stripe.ts`                                                       | Affiliate discount applied via one-time coupon (F14)             |
| `app/api/checkout/route.ts`                                                  | Upfront code validation + discount pass-through (F14)            |
| `lib/affiliate/report-builder.ts`                                            | `GlobalCodeFlowsReport` + `buildGlobalCodeInventoryReport()`     |
| `app/api/admin/affiliates/reports/code-flows/route.ts`                       | **NEW** — admin global code-flows endpoint                       |
| `app/api/cron/{distribute-codes,expire-codes,send-monthly-reports}/route.ts` | GET wrappers for Vercel Cron                                     |
| `vercel.json`                                                                | All 8 cron schedules registered                                  |

## Recommended Follow-ups (not blocking)

1. Add tests: `conversion-processor.test.ts`, `code-flows` route test, auto-approval test (repo is TDD; these should land with the next test pass).
2. New SystemConfig row: seed `affiliate_commission_approval_days` (category `affiliate`, valueType `number`, value `14`) so admins see it in the settings UI.
3. Admin manual approve/reject commission endpoint for exceptions (chargebacks) — auto-approval covers the happy path only.
4. Consider a `DLocalWebhookEvent` store for full webhook audit parity with Part 19.
5. Frontend mirrors: `frontend/` copies of the dLocal create/validate routes should be re-synced from the fixed backend versions before next frontend deploy.
