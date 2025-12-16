# Part 12: E-commerce & Billing - Build Order

**From:** `docs/v5-structure-division.md` Part 12
**Total Files:** 11 files
**Estimated Time:** 5 hours
**Priority:** ⭐⭐⭐ High (Revenue critical)
**Complexity:** High

---

## Overview

**Scope:** Stripe integration for 2-tier subscription system (FREE → PRO upgrades).

**Implementation Guide References:**

- `docs/implementation-guides/v5_part_l.md` - E-commerce & billing business logic, Stripe integration, and subscription management

**Pricing:**

- FREE: $0/month (5 symbols, 3 timeframes, 5 alerts)
- PRO: $29/month (15 symbols, 9 timeframes, 20 alerts)

**Key Changes from V4:**

- ✅ Remove ENTERPRISE tier completely
- ✅ Pricing page: FREE vs PRO only
- ✅ Upgrade/downgrade flows for 2 tiers

**Dependencies:**

- Part 2 complete (Subscription model)
- Part 4 complete (Tier plans config)

---

## File Build Order

**File 1/11:** `app/(marketing)/pricing/page.tsx`

- Pricing page
- FREE vs PRO comparison
- Upgrade button
- Symbol/timeframe comparison table
- Seed: `seed-code/v0-components/pricing-page-component-v3/app/pricing/page.tsx`
- Commit: `feat(pricing): add pricing page for 2-tier system`

**File 2/11:** `app/api/subscription/route.ts`

- GET: Get user subscription
- POST: Create PRO subscription (upgrade)
- Commit: `feat(api): add subscription management endpoints`

**File 3/11:** `app/api/subscription/cancel/route.ts`

- POST: Cancel subscription (downgrade to FREE)
- Update user tier
- Cancel Stripe subscription
- Commit: `feat(api): add subscription cancellation`

**File 4/11:** `app/api/checkout/route.ts`

- POST: Create Stripe checkout session
- PRO upgrade only
- Return checkout URL
- Commit: `feat(api): add Stripe checkout endpoint`

**File 5/11:** `app/api/invoices/route.ts`

- GET: List user invoices
- Fetch from Stripe
- Commit: `feat(api): add invoices endpoint`

**File 6/11:** `app/api/webhooks/stripe/route.ts`

- POST: Stripe webhook handler
- Events: checkout.session.completed, customer.subscription.updated, customer.subscription.deleted
- Update user tier based on subscription status
- Verify webhook signature
- Commit: `feat(api): add Stripe webhook handler`

**File 7/11:** `components/billing/subscription-card.tsx`

- Current subscription display
- Tier badge
- Upgrade/cancel buttons
- Next billing date
- Commit: `feat(billing): add subscription card component`

**File 8/11:** `components/billing/invoice-list.tsx`

- Invoice history table
- Download links
- Payment status
- Commit: `feat(billing): add invoice list component`

**File 9/11:** `lib/stripe/stripe.ts`

- Stripe client initialization
- Helper functions
- Commit: `feat(stripe): add Stripe client`

**File 10/11:** `lib/stripe/webhook-handlers.ts`

- Webhook event handlers
- Update user tier on subscription change
- Handle subscription created/updated/deleted
- Commit: `feat(stripe): add webhook handlers for 2-tier system`

**File 11/11:** `lib/email/subscription-emails.ts`

- Send upgrade confirmation email
- Send cancellation confirmation email
- Commit: `feat(email): add subscription email templates`

---

## Success Criteria

- ✅ All 11 files created
- ✅ Pricing page displays 2 tiers
- ✅ Checkout flow works
- ✅ Webhooks handle events
- ✅ Tier upgrades work
- ✅ Tier downgrades work

---

**Last Updated:** 2025-11-18
