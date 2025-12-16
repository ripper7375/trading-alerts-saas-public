# Part 18: dLocal Payment Integration - Build Order

**From:** `docs/v5-structure-division.md` Part 18
**Total Files:** 37 files
**Estimated Time:** 20 hours (2.5 weeks)
**Priority:** ⭐⭐ Medium (Post-MVP)
**Complexity:** High

---

## Overview

**Scope:** Payment processing for emerging markets (India, Nigeria, Pakistan, Vietnam, Indonesia, Thailand, South Africa, Turkey) using local payment methods without international cards.

**Implementation Guide References:**

- `docs/implementation-guides/v5_part_r.md` - dLocal payment integration business requirements and workflows (comprehensive - 2680 lines)
- `docs/policies/06-aider-instructions.md` Section 13 (Step 1.7) - dLocal implementation architecture and specifications
- `docs/policies/07-dlocal-integration-rules.md` - dLocal-specific integration rules and policies
- `docs/dlocal-openapi-endpoints.yaml` - dLocal API endpoint specifications

**Why:** Stripe requires international cards. dLocal supports 50+ local payment methods (UPI, Paytm, JazzCash, GoPay, etc.).

**Key Features:**

- 8 supported countries
- 50+ local payment methods
- Unified checkout (Stripe + dLocal together)
- Country detection (IP geolocation)
- Real-time currency conversion
- 3-day PRO plan ($1.99) - dLocal exclusive
- Monthly PRO plan ($29) - both providers
- Manual renewal (NO auto-renewal for dLocal)
- Discount codes on monthly ONLY

**Dependencies:**

- Part 2 complete (Prisma schema updates for Payment model, Subscription fields)
- Part 12 complete (Stripe integration)

**V0 Seed Components (UI reference patterns):**

- `seed-code/v0-components/part-18-payment-method-selector/app/page.tsx`
- `seed-code/v0-components/part-18-price-display-component/app/page.tsx`
- `seed-code/v0-components/part-18-renewal-reminder-email/app/preview-renewal-email/page.tsx`
- `seed-code/v0-components/part-18-unified-checkout/app/checkout/page.tsx`

**V0 Custom Components (business logic patterns):**

- `seed-code/v0-components/part-18-payment-method-selector/components/payment-method-selector.tsx`
- `seed-code/v0-components/part-18-price-display-component/components/price-display.tsx`

---

## Build Summary

Due to the large number of files (37), this build order provides a high-level structure:

### Database Models (2 files)

- Prisma schema updates: Payment model, Subscription fields for dLocal
- Migration file

### Type Definitions (1 file)

- dLocal types

### Services (4 files)

- Currency converter service
- Payment methods service
- dLocal payment service
- Country detection service

### API Routes (9 files)

- Payment methods endpoint
- Exchange rate endpoint
- Currency conversion endpoint
- Create payment endpoint
- Validate discount endpoint
- Payment status endpoint
- Webhook handler
- 2 cron jobs (renewal reminders, expiry)

### Frontend Components (6 files)

- Country selector
- Plan selector (3-day vs Monthly)
- Payment method selector
- Price display (local currency)
- Discount code input
- Payment button

### Unified Checkout (1 file)

- Update checkout page to support both Stripe and dLocal

### Email Templates (4 files)

- Payment confirmation
- Renewal reminder (3-day, 1-day)
- Subscription expired
- Payment failure

### Cron Jobs (2 files)

- Check expiring subscriptions (renewal reminders)
- Downgrade expired subscriptions

### Documentation (4 files)

- Policy: 07-dlocal-integration-rules.md
- OpenAPI spec: dlocal-openapi-endpoints.yaml
- Implementation guide: v5_part_r.md
- Summary: DLOCAL-INTEGRATION-SUMMARY.md

### Configuration (2 files)

- vercel.json (cron jobs)
- .env updates

---

## Build Sequence

1. **Database Layer** (Files 1-2)
   - Add Payment model and Subscription fields
   - Run migration
   - Commit: `feat(dlocal): add payment tracking models`

2. **Types & Constants** (Files 3-5)
   - dLocal types
   - Country/currency constants
   - Payment method constants
   - Commit: `feat(dlocal): add type definitions`

3. **Services** (Files 6-9)
   - Currency converter
   - Payment methods fetcher
   - dLocal payment creator
   - Country detector
   - Commit: `feat(dlocal): add payment services`

4. **API Routes** (Files 10-18)
   - Payment endpoints
   - Webhook handler
   - Commit: `feat(dlocal): add payment API routes`

5. **Frontend Components** (Files 19-24)
   - Country selector
   - Plan selector
   - Payment method grid
   - Price display
   - Discount input
   - Payment button
   - Commit: `feat(dlocal): add payment components`

6. **Unified Checkout** (File 25)
   - Update checkout page
   - Support both Stripe and dLocal
   - Commit: `feat(dlocal): add unified checkout`

7. **Email Templates** (Files 26-29)
   - Confirmation email
   - Reminder emails
   - Expiry email
   - Failure email
   - Commit: `feat(dlocal): add payment email templates`

8. **Cron Jobs** (Files 30-31)
   - Renewal reminder job
   - Expiry downgrade job
   - Commit: `feat(dlocal): add subscription lifecycle jobs`

9. **Documentation** (Files 32-35)
   - Policy document
   - OpenAPI spec
   - Implementation guide
   - Summary doc
   - Commit: `docs(dlocal): add integration documentation`

10. **Configuration** (Files 36-37)
    - vercel.json cron config
    - Environment variables
    - Commit: `feat(dlocal): add deployment config`

---

## Success Criteria

- ✅ All 37 files created/updated
- ✅ Single checkout shows both Stripe and dLocal
- ✅ Country detection works
- ✅ Payment methods load for 8 countries
- ✅ Prices display in local currency
- ✅ 3-day plan works (dLocal only)
- ✅ Monthly plan works (both providers)
- ✅ Discount codes work (monthly only)
- ✅ Webhooks handle success/failure
- ✅ Renewal reminders sent
- ✅ Expired subscriptions downgraded

---

## Reference Documentation

- **Complete Spec:** `docs/v5-structure-division.md` Part 18
- **Policy:** `docs/policies/07-dlocal-integration-rules.md`
- **OpenAPI:** `docs/dlocal-openapi-endpoints.yaml`
- **Guide:** `docs/implementation-guides/v5_part_r.md`

---

**Last Updated:** 2025-11-18
