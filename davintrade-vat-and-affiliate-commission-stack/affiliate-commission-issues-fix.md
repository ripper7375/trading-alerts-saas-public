# Affiliate Commission — Timing, Refund & Clawback Fixes

**Source:** no separate design doc — this emerged from a working conversation about how discount codes and affiliate commissions interact with subscription cancellations and refunds, during the same session as the VAT/tax-invoicing rollout (see [`tax-invoicing-manifest-work-completion.md`](./tax-invoicing-manifest-work-completion.md), which this document has no overlap with).
**Date:** 2026-08-29 – 2026-08-30
**Status:** Code complete and verified; database changes applied to production; nothing here is blocked on a manual/external step. §5.1 below records this document's own prior recommendation against building a recurring-commission model without a deliberate decision — Davin supplied that decision (an explicit business case) later in the same session, so it was built; see §1.5.

---

## 1. What was built

Three related, sequential fixes to the affiliate commission flow, mirrored across the monolith (`lib/stripe/webhook-handlers.ts`) and its dark-launched `money-service` mirror throughout — the same discipline as the tax-invoicing work, since checkout writes are flag-gated between the two codepaths.

### 1.1 Commission-timing fix — don't pay before the money is actually collected

**The bug:** affiliate commissions were credited at `checkout.session.completed`. DavinTrade's checkout includes a 7-day free trial, so `checkout.session.completed` fires the moment a payment method is attached — before any charge happens. An affiliate could be paid a commission for a signup that later failed to charge, or was cancelled during the trial, with no way to know until someone noticed.

**The fix:** split into two phases —

- **Reserve** (at `checkout.session.completed`): the code is still validated and marked `USED` immediately — that's what stops the same code being redeemed twice. Its id is stamped onto `Subscription.affiliateCodeId` (a field that already existed in the schema, unused until now). No `Commission` row is created yet.
- **Credit** (at `invoice.payment_succeeded`, using the invoice's _actual_ `amount_paid`): only runs if a pending attribution exists on the subscription. Uses the real collected amount rather than a static/dynamic base-price fallback — strictly more accurate now that the trigger is tied to a real charge. Clears `Subscription.affiliateCodeId` back to `null` on success, which doubles as the idempotency guard against Stripe's at-least-once webhook redelivery and against a later renewal re-triggering the same code's payout.
- **Stale-attribution guard:** every checkout write now explicitly sets `affiliateCodeId` (to the newly reserved code's id, or `null`) rather than only setting it when a code is present — otherwise a user who abandons a code-based signup and later re-subscribes _without_ a code would carry the old attribution forward and wrongly credit the original affiliate for a conversion that didn't use their code this time.

In money-service, `ConversionProcessorService.processAffiliateConversion` (the existing atomic mark-used-and-pay method) was left untouched — it's still correct as-is for dLocal, whose webhook already fires only on a real completed payment, with no trial-driven timing gap. Two new methods, `reserveAffiliateCode` and `creditAffiliateCommission`, were added alongside it for the Stripe-specific two-phase flow.

### 1.2 Refund/dispute clawback — act on money coming back during the hold

A separate, pre-existing safety mechanism already existed but wasn't wired up: `Commission` rows sit as `PENDING` and only auto-approve for payout after a hold window (`SystemConfig.affiliate_commission_approval_days`, a daily cron job already built and scheduled in money-service). The hold bought time but nothing used it — a commission refunded on day 5 would still auto-approve on day 14 regardless, because the auto-approval job only checked "has enough time passed," never "was this refunded."

**The fix:** new `charge.refunded` and `charge.dispute.created` webhook handlers, routed to a shared `cancelCommissionForRefundOrDispute` (monolith) / equivalent method (money-service):

- If the matching commission is still `PENDING` or `APPROVED` (not yet disbursed): cancelled outright (`status: 'CANCELLED'`), and the affiliate's `pendingCommissions`/`totalEarnings`/`totalCodesUsed` are reversed — symmetric with how they were incremented at creation.
- If already `CANCELLED`: no-op (idempotent against webhook redelivery).
- If no matching commission at all: no-op (the common case — most refunds involve no affiliate code).
- If already `PAID`: see §1.3 below — this is where the design changed after the first pass.

For `charge.dispute.created` specifically, Stripe's payload only carries the charge id, not the customer — the handler fetches the charge first (via `getStripeClient()` in the monolith, a new `StripeService.retrieveCharge()` method in money-service) to resolve it.

**Also applied to production as part of this fix:** `SystemConfig.affiliate_commission_approval_days` didn't exist yet — the code was silently relying on its hardcoded 14-day fallback. Inserted with value `21` (a deliberate small safety-margin increase beyond the bare EU/UK statutory 14-day cooling-off minimum), matching the existing `affiliate`-category `SystemConfig` rows' style. This affects both codebases identically since they share the database; in practice only money-service's daily cron is actually live/scheduled, so this is what changed.

### 1.3 Clawback-via-netting — for a commission already paid out

**The gap in §1.2's first pass:** if a refund/dispute arrived for a commission that was already `PAID`, the original handler just logged an alert for manual recovery. That doesn't scale and rarely actually recovers the money in practice.

**The fix, on request:** when a refund/dispute hits an already-`PAID` commission, instead of an alert-only path, a **new negative-amount `Commission` row** is created — same `affiliateProfileId`/`affiliateCodeId`/`userId`/`subscriptionId` as the original, `grossRevenue`/`discountAmount`/`netRevenue`/`commissionAmount` all negated, `status: 'APPROVED'` immediately (it's a correction, not a new earning, so it skips the trial-safety hold), linked back to the original via a new `Commission.clawbackOfCommissionId` field. The affiliate's `totalEarnings`/`pendingCommissions` are decremented right away; `paidCommissions` is left untouched, since it's a historical record of money that was actually sent and the clawback hasn't been recovered yet.

This required **zero changes** to the payout aggregation logic. `CommissionAggregator` (disbursement) and `buildCommissionSummary` (dashboard stats) both already just sum `commissionAmount` across rows — a negative row nets against whatever the affiliate earns next automatically, wherever it's read. If they never earn again, the deduction sits uncollected forever; that's an accepted limitation shared by every real-world netting-based clawback system, not something this session tried to solve further (forced collection from an inactive affiliate is a manual/legal process, out of scope).

**On request, notification was scoped down to reporting only** — no email/outbox event is sent to the affiliate about a clawback (the original plan included one; explicitly dropped mid-build in favor of just making it visible as its own line in the existing reports).

### 1.4 Admin & affiliate report / UI updates

Both the affiliate-facing and admin-facing commission views now surface a clawback row distinctly, as requested:

- **Affiliate panel** (`components/affiliate/commission-table.tsx`, used by `/affiliate/dashboard/commissions`): a clawback row renders its amount in red with a leading `-`, plus a red **"Clawback"** badge next to the normal status badge (title-attribute tooltip explains why). The page's "Commission Status Guide" section gained a matching CLAWBACK entry.
- **Admin panel** (`app/admin/affiliates/[id]/page.tsx`, "Recent Commissions" table): same treatment — red negative amount, red **"CLAWBACK"** badge.
- Both reports needed their underlying `Commission.clawbackOfCommissionId` field wired through: the affiliate-facing `commission-report` API routes (monolith and money-service) needed **no changes** — they already do a bare `findMany`/`include` with no explicit `select`, so the new column flows through automatically. The admin-facing routes (`lib/admin/affiliate-management.ts`, money-service's `affiliate-management.service.ts`) use an explicit `select` list and needed the field added by hand.

### 1.5 Recurring/residual commission model — one-time discount, 24-cycle recurring commission

**Reopened after §5.1's original recommendation** (below): Davin supplied an explicit business case for affiliate-driven acquisition at scale (Facebook-group distribution, paid-ads viability, long-term partner incentives) and asked for it to be built, with the specific parameters resolved live in chat rather than left to a default:

- **Discount stays one-time.** The Stripe coupon is unchanged (`duration: 'once'`) — only the affiliate's _commission_ recurs, not the customer's discount. This was flagged as the better split during the advisory pass (all of the stated business benefits are about affiliate incentive, none require the customer to keep paying less), and Davin confirmed it.
- **Commission recurs at the same percentage for 24 total billing cycles** (cycle 1, the discounted signup, plus 23 further renewals) — then stops even if the customer keeps paying.
- **Recurring commission stops immediately on cancellation**, even if the 24-cycle cap hasn't been reached.
- **Resubscribing never re-opens the discount or a new attribution.** Once an account has ever had a `Subscription` row (any status — this is a `Subscription.userId`-unique lookup, so it also catches a long-cancelled account), a later checkout rejects any affiliate code outright (`400 AFFILIATE_CODE_FIRST_TIME_ONLY`) rather than silently ignoring it — the welcome discount is a first-subscription-only benefit, full stop.

**Mechanism:** `Subscription.affiliateCodeId` is no longer cleared after the first commission credit — it now stays in place across renewals so `handleInvoiceSucceeded` keeps checking it on every qualifying invoice, not just the first. Cycle 1 applies the code's actual `discountPercent`; cycles 2–24 pass `discountPercent: 0` into `calculateFullBreakdown` (the invoice really is at full price on a renewal, since the coupon is one-time) so only `commissionPercent` compounds. The cycle count is derived by counting non-clawback `Commission` rows for the code (no new counter field needed) — cap is `AFFILIATE_CONFIG.MAX_RECURRING_COMMISSION_CYCLES` (24). `affiliateCodeId` is cleared once the cap is hit (mid-credit) or on `customer.subscription.deleted` (immediate, explicit — not left to the implicit absence of further invoices).

**Idempotency changed shape.** With one commission per subscription, "does any commission exist for this code" was a sufficient duplicate guard. With up to 24 rows per subscription, that guard would have permanently blocked cycle 2 onward. New `Commission.stripeInvoiceId` field (nullable, additive) keys the guard to the _specific_ invoice instead — a redelivered webhook for the same invoice is still a no-op, but a genuinely later invoice (the next renewal) still creates its own row.

**A latent bug this surfaced and fixed as part of the same change:** the refund/dispute clawback (`cancelCommissionForRefundOrDispute`) used `commission.findFirst({ where: { subscriptionId } })` with no further qualifier — harmless when at most one commission ever existed per subscription, but with up to 24 rows now possible, it would have clawed back whichever commission happened to be found first, not the one actually tied to the refunded charge. Fixed by resolving the invoice id off the refunded/disputed `charge.invoice` and matching `Commission.stripeInvoiceId` against it, falling back to the old subscription-wide lookup only when the invoice id can't be resolved (e.g. a non-invoice charge).

**Deliberately out of scope, matching this document's existing dLocal boundary:** dLocal's payment flow (3-day/30-day plans, no Stripe-style recurring invoice cycle) is untouched — this entire feature is Stripe-subscription-specific, same scope line as §1.1's reserve/credit split.

---

## 2. Files changed

| File                                                                      | Change                                                                                                                        |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `prisma/non-market-data/schema.prisma`                                    | New `Commission.clawbackOfCommissionId` field + index                                                                         |
| `money-service/prisma/schema.prisma`                                      | Mirrored field + index                                                                                                        |
| `prisma/migrations/20260830000000_commission_clawback_link/migration.sql` | **Added.** One nullable column, one index                                                                                     |
| `lib/stripe/webhook-handlers.ts`                                          | Reserve/credit split; `handleChargeRefunded`/`handleChargeDisputeCreated`; clawback-row creation for already-PAID commissions |
| `app/api/webhooks/stripe/route.ts`                                        | Routes `charge.refunded` / `charge.dispute.created` to the new handlers                                                       |
| `money-service/src/affiliate/conversion-processor.service.ts`             | New `reserveAffiliateCode` / `creditAffiliateCommission` methods (dLocal's existing `processAffiliateConversion` untouched)   |
| `money-service/src/stripe/stripe-webhook.service.ts`                      | Same reserve/credit split, refund/dispute handlers, and clawback-row creation as the monolith                                 |
| `money-service/src/stripe/stripe-webhook.controller.ts`                   | Routes the two new charge events                                                                                              |
| `money-service/src/stripe/stripe.service.ts`                              | New `retrieveCharge()` method, used to resolve a dispute's customer                                                           |
| `lib/admin/affiliate-management.ts`                                       | Added `clawbackOfCommissionId` to the admin commission `select` + TS interface                                                |
| `money-service/src/admin/affiliate-management.service.ts`                 | Same addition, mirrored                                                                                                       |
| `components/affiliate/commission-table.tsx`                               | Clawback badge + red negative-amount styling                                                                                  |
| `app/affiliate/dashboard/commissions/page.tsx`                            | Interface field + CLAWBACK entry in the status guide                                                                          |
| `app/admin/affiliates/[id]/page.tsx`                                      | Interface field + clawback badge/styling in "Recent Commissions"                                                              |
| `__tests__/lib/stripe/webhook-handlers.test.ts`                           | +20 tests: reservation (5), deferred crediting (5), refund/dispute clawback incl. clawback-row creation (10)                  |
| `money-service/src/affiliate/conversion-processor.service.spec.ts`        | +8 tests: `reserveAffiliateCode` (4) / `creditAffiliateCommission` (4)                                                        |
| `money-service/src/stripe/stripe-webhook.service.spec.ts`                 | +15 tests: reservation (3), deferred crediting (3), refund/dispute clawback (9)                                               |
| `__tests__/components/affiliate/commission-table.test.tsx`                | +2 tests: clawback badge shown/not-shown                                                                                      |

18 files touched (17 modified, 1 added), 45 new tests.

### §1.5 recurring-commission follow-up — additional files changed

| File                                                                             | Change                                                                                                                                                                                   |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prisma/non-market-data/schema.prisma`                                           | New `Commission.stripeInvoiceId` field + index                                                                                                                                           |
| `money-service/prisma/schema.prisma`                                             | Mirrored field + index                                                                                                                                                                   |
| `prisma/migrations/20260830010000_commission_recurring_invoice_id/migration.sql` | **Added.** One nullable column, one index                                                                                                                                                |
| `lib/affiliate/constants.ts`                                                     | New `AFFILIATE_CONFIG.MAX_RECURRING_COMMISSION_CYCLES` (24)                                                                                                                              |
| `money-service/src/affiliate/affiliate.constants.ts`                             | Mirrored constant                                                                                                                                                                        |
| `app/api/checkout/route.ts`                                                      | Returning-subscriber gate on affiliate codes (`existingSubscription` check moved earlier, new `AFFILIATE_CODE_FIRST_TIME_ONLY` 400)                                                      |
| `money-service/src/stripe/stripe-checkout.controller.ts`                         | Same gate, mirrored                                                                                                                                                                      |
| `lib/stripe/webhook-handlers.ts`                                                 | `processAffiliateCommission` rewritten for per-cycle crediting/capping; `handleSubscriptionDeleted` clears `affiliateCodeId`; refund/dispute clawback resolves and matches by invoice id |
| `money-service/src/affiliate/conversion-processor.service.ts`                    | `creditAffiliateCommission` rewritten to match (adds `stripeInvoiceId` param, returns `capReached`)                                                                                      |
| `money-service/src/stripe/stripe-webhook.service.ts`                             | Caller updated for `capReached`-driven attribution clearing; `handleSubscriptionDeleted` and clawback matching mirrored                                                                  |
| `__tests__/lib/stripe/webhook-handlers.test.ts`                                  | Net +3 tests (cycle-1/renewal/cap-reached/cap-already-reached cases; invoice-precise clawback targeting)                                                                                 |
| `money-service/src/affiliate/conversion-processor.service.spec.ts`               | Net +3 tests (same cases for `creditAffiliateCommission`)                                                                                                                                |
| `money-service/src/stripe/stripe-webhook.service.spec.ts`                        | Net +3 tests (`capReached` handling; invoice-precise clawback targeting)                                                                                                                 |
| `money-service/src/stripe/stripe-checkout.controller.spec.ts`                    | Net +2 tests (returning-subscriber rejection; genuine first-time subscriber still works)                                                                                                 |

4 files touched for schema/migration/constants, 6 files touched for the crediting/gating logic, 4 test files updated, 11 net new tests.

---

## 3. Test verification

| Suite                         | Result                                                                                                                  |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Monolith `test:ci` (full run) | **151/151 suites · 2236/2236 tests**                                                                                    |
| money-service full suite      | **62/62 suites · 557/557 tests** — the SIGTERM-timing flake noted in the tax-invoicing report did not recur on this run |
| TypeScript — monolith         | `tsc --noEmit`, 0 errors                                                                                                |
| TypeScript — money-service    | `tsc --noEmit`, 0 errors                                                                                                |

**After the §1.5 recurring-commission follow-up, re-verified fresh:**

| Suite                         | Result                                                                                                                                                                                                                                            |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Monolith `test:ci` (full run) | **151/151 suites · 2239/2239 tests** (+3)                                                                                                                                                                                                         |
| money-service full suite      | **62/62 suites · 565/565 tests** (+8) — the SIGTERM-timing flake (`prisma.shutdown.spec.ts`) recurred again under concurrent load; re-run in isolation and passed cleanly, consistent with the prior sessions' documented flake, not a regression |
| TypeScript — monolith         | `tsc --noEmit`, 0 errors                                                                                                                                                                                                                          |
| TypeScript — money-service    | `tsc --noEmit`, 0 errors                                                                                                                                                                                                                          |

---

## 4. Database changes applied to production

Both changes were applied only after the same read-before-write discipline used for the tax-invoicing migration (live, read-only checks before any write; no schema-diffing tools used against the shared datasource).

1. **`Commission.clawbackOfCommissionId` column** — additive migration (`prisma/migrations/20260830000000_commission_clawback_link/`), one nullable `TEXT` column + one index. Applied via `prisma db execute` (not `migrate dev`/`db push`, for the same shared-datasource reason documented in the tax-invoicing report), then recorded in the migration ledger via `prisma migrate resolve --applied`. Verified live post-apply.
2. **`SystemConfig` row for `affiliate_commission_approval_days`** — didn't exist before this session; inserted with value `21`, `category: 'affiliate'`, matching the existing config rows' shape and description style. Confirmed empty beforehand via a read-only query, so this was a genuine insert, not an overwrite of an admin's prior choice.
3. **`Commission.stripeInvoiceId` column** (§1.5 follow-up) — additive migration (`prisma/migrations/20260830010000_commission_recurring_invoice_id/`), one nullable `TEXT` column + one index, same `db execute` + `migrate resolve --applied` pattern as #1. `prisma migrate status` re-checked immediately before and after — only the same pre-existing, unrelated `20260214000000_rag_dual_memory` migration remains pending, unchanged from every prior session.

---

## 5. Considered but not built

### 5.1 Recurring/residual commission model — SUPERSEDED, see §1.5

Originally raised as "what if the discount and the commission both continued for every renewal, not just the first payment," and the recommendation at the time was: don't build this without a deliberate decision, and if pursued, prefer a capped duration over an unbounded `forever` model. Davin came back later in the same session with an explicit business case (affiliate-driven acquisition at scale) and asked for it to be built — **implemented, see §1.5** for the actual design (one-time discount / 24-cycle capped recurring commission), which followed this section's own capped-duration recommendation rather than the unbounded `forever` alternative also considered here.

### 5.2 "No Refund" checkbox at checkout

Raised as a way to reduce refund exposure (and by extension, clawback frequency) by having customers explicitly agree to no refunds before paying. Flagged as a genuine legal question, not a technical one: in jurisdictions with a mandatory statutory cooling-off right (the EU and UK both have a 14-day right of withdrawal for most online purchases), that right generally **cannot be waived by a checkbox** — such a clause is typically void, and prominently telling customers they've waived a right they still legally have can itself be a separate compliance problem. The narrower, real mechanism that exists for digital content/services (explicit consent to immediate performance + explicit acknowledgment of losing the cooling-off right) was described, but drafting the actual consent wording was explicitly left to real legal counsel, not built or drafted here. **Not implemented** — no checkbox, no consent-recording infrastructure. If pursued later, the technical build (gate the payment button on the checkbox, store the consent as an auditable record with timestamp/wording-version/IP) is straightforward once the wording is legally confirmed.

### 5.3 Affiliate email/notification for a clawback

Originally planned as part of §1.3 (an email or outbox event telling the affiliate their payout would be reduced). Explicitly dropped mid-build in favor of the report-only approach in §1.4 — no email is sent, no `money-service` outbox event is emitted; visibility is entirely through the existing commission dashboards (affiliate and admin) now correctly labeling the deduction.

---

## 6. Also investigated (no code change)

**"Is there an algorithm disabling the refund button after the refund period ends?"** — confirmed there is no refund feature anywhere in this app: no button, no admin route, no API endpoint, no `stripe.refunds.create()` call anywhere in the codebase. Any refund today happens manually via the Stripe Dashboard, entirely outside this codebase. This is exactly why the webhook-based clawback approach (§1.2/§1.3) is the right one regardless of how a refund is initiated — it reacts to the Stripe event, not to an in-app action.

---

## 7. Explicitly out of scope

- **Forced collection from an affiliate who stops earning** after owing a clawback deduction — the netting mechanism (§1.3) only resolves against future earnings; if none ever accrue, the deduction sits uncollected indefinitely. Recovering it another way (direct invoicing, legal action) is a manual business process, not something this fix automates.
- **Reconciling a clawback that arrives after a commission has already been included in a disbursed payout batch** — the "already PAID" branch in §1.3 covers a commission whose _individual row_ is `PAID`; a batch-level reconciliation report (e.g. "this payout batch included a commission that was later refunded") was not built.
- **The admin affiliate-detail commission list's existing `take: 50` cap** (`lib/admin/affiliate-management.ts`, mirrored in money-service) — a pre-existing display limit (ordered `earnedAt: desc`, so it shows the most recent 50, not silent data loss) that predates §1.5 and already applied to any affiliate with 51+ one-time signups. §1.5 makes it easier to reach sooner, since one referred subscriber can now contribute up to 24 rows instead of 1. Not changed here — it wasn't part of what was asked, and raising the cap without real pagination would just move the same limit further out. Flagged as a real follow-up if an affiliate's detail view needs to show more than the most recent 50 commission rows. (The affiliate-facing and admin-facing commission _report_ API routes, by contrast, are already properly paginated — see `commission-report/route.ts` — so this is specific to the admin detail page's embedded list, not the reports.)
