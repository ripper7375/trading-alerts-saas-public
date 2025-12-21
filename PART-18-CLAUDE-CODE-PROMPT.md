# Part 18: dLocal Payment Integration - Claude Code Build Prompt

## Overview

**Part:** 18 of 18
**Feature:** dLocal Payment Integration for Emerging Markets
**Total Files:** 37 files
**Complexity:** High
**Dependencies:** Part 2 (Database), Part 5 (Auth), Part 12 (Stripe Integration)

---

## Prerequisites Check

Before starting, verify:

- [ ] Part 2 complete (Database & Prisma setup)
- [ ] Part 5 complete (Authentication with NextAuth)
- [ ] Part 12 complete (Stripe integration working)
- [ ] Node.js and npm working
- [ ] Git repository initialized

---

## Instructions for Claude Code

You are an autonomous code builder. Your task is to build **Part 18: dLocal Payment Integration** for the Trading Alerts SaaS application.

### Critical Business Rules (MUST FOLLOW)

1. **dLocal vs Stripe Differences:**
   | Feature | Stripe | dLocal |
   |---------|--------|--------|
   | Auto-Renewal | âœ… Yes | âŒ NO - Manual renewal |
   | Free Trial | âœ… 7 days | âŒ NO trial |
   | Plans | Monthly only | 3-day + Monthly |
   | Discount Codes | âœ… All plans | âŒ Monthly ONLY |
   | Renewal Notifications | Stripe manages | WE send 3 days before |
   | Expiry Handling | Stripe auto-downgrades | WE downgrade via cron |

2. **3-Day Plan Anti-Abuse (CRITICAL):**
   - 3-day plan can ONLY be purchased ONCE per account (lifetime)
   - Track via `hasUsedThreeDayPlan` boolean on User model
   - CANNOT purchase 3-day plan if user has active subscription
   - Use `crypto.randomBytes()` for secure hashing (NOT Math.random)

3. **Supported Countries (8 total):**
   - IN (India) - INR - UPI, Paytm, PhonePe, Net Banking
   - NG (Nigeria) - NGN - Bank Transfer, USSD, Paystack
   - PK (Pakistan) - PKR - JazzCash, Easypaisa
   - VN (Vietnam) - VND - VNPay, MoMo, ZaloPay
   - ID (Indonesia) - IDR - GoPay, OVO, Dana, ShopeePay
   - TH (Thailand) - THB - TrueMoney, Rabbit LINE Pay, Thai QR
   - ZA (South Africa) - ZAR - Instant EFT, EFT
   - TR (Turkey) - TRY - Bank Transfer, Local Cards

4. **Pricing:**
   - 3-Day Plan: $1.99 USD (dLocal only, NO discount codes)
   - Monthly Plan: $29.00 USD (both Stripe & dLocal, discount codes allowed)

5. **Early Renewal Logic:**
   - Monthly: ALLOWED - extend from current expiry date
   - 3-Day: PROHIBITED if user has any active subscription

---

## Documents to Read First

Read these documents IN ORDER before generating any code:

```
1. PROGRESS-part-2.md (current progress tracker)
2. ARCHITECTURE-compress.md (system architecture)
3. docs/policies/05-coding-patterns-part-1.md (coding standards)
4. docs/policies/05-coding-patterns-part-2.md (additional patterns)
5. docs/policies/07-dlocal-integration-rules.md (dLocal-specific rules)
6. docs/build-orders/part-18-dlocal.md (build sequence)
7. docs/implementation-guides/v5_part_r.md (detailed requirements)
```

---

## All 37 Files to Build

### Phase A: Database & Types (3 files)

| #   | File Path                 | Type   | Description                                                     |
| --- | ------------------------- | ------ | --------------------------------------------------------------- |
| 1   | `prisma/schema.prisma`    | UPDATE | Add Payment model, FraudAlert model, update User & Subscription |
| 2   | `types/dlocal.ts`         | NEW    | dLocal type definitions                                         |
| 3   | `lib/dlocal/constants.ts` | NEW    | Countries, currencies, pricing constants                        |

### Phase B: Services (5 files)

| #   | File Path                                   | Type | Description                          |
| --- | ------------------------------------------- | ---- | ------------------------------------ |
| 4   | `lib/dlocal/currency-converter.service.ts`  | NEW  | USD to local currency conversion     |
| 5   | `lib/dlocal/payment-methods.service.ts`     | NEW  | Fetch payment methods by country     |
| 6   | `lib/dlocal/dlocal-payment.service.ts`      | NEW  | Create payments, verify webhooks     |
| 7   | `lib/dlocal/three-day-validator.service.ts` | NEW  | Anti-abuse validation for 3-day plan |
| 8   | `lib/geo/detect-country.ts`                 | NEW  | IP geolocation country detection     |

### Phase C: API Routes (11 files)

| #   | File Path                                               | Type | Description                       |
| --- | ------------------------------------------------------- | ---- | --------------------------------- |
| 9   | `app/api/payments/dlocal/methods/route.ts`              | NEW  | GET payment methods for country   |
| 10  | `app/api/payments/dlocal/exchange-rate/route.ts`        | NEW  | GET exchange rate USD to currency |
| 11  | `app/api/payments/dlocal/convert/route.ts`              | NEW  | GET currency conversion           |
| 12  | `app/api/payments/dlocal/create/route.ts`               | NEW  | POST create dLocal payment        |
| 13  | `app/api/payments/dlocal/validate-discount/route.ts`    | NEW  | POST validate discount code       |
| 14  | `app/api/payments/dlocal/[paymentId]/route.ts`          | NEW  | GET payment status                |
| 15  | `app/api/webhooks/dlocal/route.ts`                      | NEW  | POST webhook handler              |
| 16  | `app/api/cron/check-expiring-subscriptions/route.ts`    | NEW  | GET cron - send reminders         |
| 17  | `app/api/cron/downgrade-expired-subscriptions/route.ts` | NEW  | GET cron - downgrade expired      |
| 18  | `app/api/admin/fraud-alerts/route.ts`                   | NEW  | GET/POST fraud alerts list        |
| 19  | `app/api/admin/fraud-alerts/[id]/route.ts`              | NEW  | GET/PATCH fraud alert detail      |

### Phase D: Cron Job Services (2 files)

| #   | File Path                                     | Type | Description                     |
| --- | --------------------------------------------- | ---- | ------------------------------- |
| 20  | `lib/cron/check-expiring-subscriptions.ts`    | NEW  | Send renewal reminders          |
| 21  | `lib/cron/downgrade-expired-subscriptions.ts` | NEW  | Downgrade expired users to FREE |

### Phase E: Frontend Components (6 files)

| #   | File Path                                       | Type | Description                        |
| --- | ----------------------------------------------- | ---- | ---------------------------------- |
| 22  | `components/payments/CountrySelector.tsx`       | NEW  | Country dropdown with flags        |
| 23  | `components/payments/PlanSelector.tsx`          | NEW  | 3-day vs Monthly plan cards        |
| 24  | `components/payments/PaymentMethodSelector.tsx` | NEW  | Payment method grid                |
| 25  | `components/payments/PriceDisplay.tsx`          | NEW  | Local currency + USD display       |
| 26  | `components/payments/DiscountCodeInput.tsx`     | NEW  | Discount code input (monthly only) |
| 27  | `components/payments/PaymentButton.tsx`         | NEW  | Payment submit button              |

### Phase F: Checkout Page (1 file)

| #   | File Path               | Type       | Description                        |
| --- | ----------------------- | ---------- | ---------------------------------- |
| 28  | `app/checkout/page.tsx` | NEW/UPDATE | Unified checkout (Stripe + dLocal) |

### Phase G: Email Templates (4 files)

| #   | File Path                         | Type | Description                  |
| --- | --------------------------------- | ---- | ---------------------------- |
| 29  | `emails/payment-confirmation.tsx` | NEW  | Payment success email        |
| 30  | `emails/renewal-reminder.tsx`     | NEW  | 3-day before expiry reminder |
| 31  | `emails/subscription-expired.tsx` | NEW  | Expired notification         |
| 32  | `emails/payment-failure.tsx`      | NEW  | Payment failed email         |

### Phase H: Admin Fraud Dashboard (4 files)

| #   | File Path                                          | Type | Description                |
| --- | -------------------------------------------------- | ---- | -------------------------- |
| 33  | `app/(dashboard)/admin/fraud-alerts/page.tsx`      | NEW  | Fraud alerts list page     |
| 34  | `app/(dashboard)/admin/fraud-alerts/[id]/page.tsx` | NEW  | Fraud alert detail page    |
| 35  | `components/admin/FraudAlertCard.tsx`              | NEW  | Fraud alert card component |
| 36  | `components/admin/FraudPatternBadge.tsx`           | NEW  | Severity/pattern badge     |

### Phase I: Configuration (1 file)

| #   | File Path     | Type   | Description            |
| --- | ------------- | ------ | ---------------------- |
| 37  | `vercel.json` | UPDATE | Add cron job schedules |

---

## Seed Code References (UI Patterns)

Use these seed files for UI reference patterns:

```
seed-code/v0-components/part-18-payment-method-selector/components/payment-method-selector.tsx
seed-code/v0-components/part-18-price-display-component/components/price-display.tsx
seed-code/v0-components/part-18-unified-checkout/app/checkout/page.tsx
seed-code/v0-components/part-18-renewal-reminder-email/app/preview-renewal-email/page.tsx
```

---

## Build Sequence

### Step 1: Database Updates (Files 1)

Update `prisma/schema.prisma`:

```prisma
// ADD to existing User model
model User {
  // ... existing fields ...

  // NEW: 3-day plan anti-abuse tracking
  hasUsedThreeDayPlan   Boolean   @default(false)
  threeDayPlanUsedAt    DateTime?

  // NEW: Fraud detection
  lastLoginIP           String?
  deviceFingerprint     String?

  // Relations
  payments              Payment[]
  fraudAlerts           FraudAlert[]
}

// ADD to existing Subscription model
model Subscription {
  // ... existing fields ...

  // NEW: Payment provider
  paymentProvider       PaymentProvider  @default(STRIPE)

  // NEW: dLocal-specific fields
  dlocalPaymentId       String?
  dlocalPaymentMethod   String?
  dlocalCountry         String?
  dlocalCurrency        String?

  // NEW: Plan type
  planType              PlanType         @default(MONTHLY)

  // NEW: Amount tracking
  amount                Decimal?
  amountUSD             Decimal?
  currency              String?

  // NEW: Manual renewal tracking
  expiresAt             DateTime?
  renewalReminderSent   Boolean          @default(false)

  // Relations
  payments              Payment[]
}

// NEW: Payment transaction log
model Payment {
  id                    String   @id @default(cuid())
  userId                String
  user                  User     @relation(fields: [userId], references: [id])
  subscriptionId        String?
  subscription          Subscription? @relation(fields: [subscriptionId], references: [id])

  provider              PaymentProvider
  providerPaymentId     String
  providerStatus        String

  amount                Decimal
  amountUSD             Decimal
  currency              String
  exchangeRate          Decimal?
  country               String
  paymentMethod         String

  planType              PlanType
  duration              Int

  discountCode          String?
  discountAmount        Decimal?

  status                PaymentStatus
  failureReason         String?

  // Anti-abuse tracking
  paymentMethodHash     String?
  purchaseIP            String?
  deviceFingerprint     String?
  accountAgeAtPurchase  Int?

  initiatedAt           DateTime   @default(now())
  completedAt           DateTime?
  failedAt              DateTime?

  metadata              Json?

  @@index([userId])
  @@index([provider, providerPaymentId])
  @@index([status])
  @@index([planType])
  @@index([paymentMethodHash])
}

// NEW: Fraud monitoring
model FraudAlert {
  id                    String   @id @default(cuid())
  userId                String
  user                  User     @relation(fields: [userId], references: [id])

  pattern               String
  metadata              Json
  severity              String

  status                String   @default("PENDING_REVIEW")
  reviewedAt            DateTime?
  reviewedBy            String?
  reviewNotes           String?

  createdAt             DateTime @default(now())

  @@index([userId])
  @@index([status])
  @@index([severity])
  @@index([createdAt])
}

// NEW: Enums
enum PaymentProvider {
  STRIPE
  DLOCAL
}

enum PlanType {
  THREE_DAY
  MONTHLY
}

enum PaymentStatus {
  PENDING
  COMPLETED
  FAILED
  REFUNDED
  CANCELLED
}
```

After updating schema, run:

```bash
npx prisma migrate dev --name add_dlocal_support
npx prisma generate
```

### Step 2: Types & Constants (Files 2-3)

Create `types/dlocal.ts` with:

- DLocalCountry type (8 countries)
- DLocalCurrency type (8 currencies)
- PlanType, PaymentProvider, PaymentMethodType, PaymentFlow types
- PaymentMethod, DLocalPaymentRequest, DLocalPaymentResponse interfaces
- ExchangeRate, CurrencyConversion interfaces

Create `lib/dlocal/constants.ts` with:

- DLOCAL_SUPPORTED_COUNTRIES mapping
- DLOCAL_PRICING for 3-day and monthly plans
- FALLBACK_EXCHANGE_RATES
- isDLocalCountry() helper
- canApplyDiscountCode() helper

### Step 3: Services (Files 4-8)

Build services in order:

1. `currency-converter.service.ts` - Exchange rate caching, USD to local conversion
2. `payment-methods.service.ts` - Fetch methods by country, Stripe fallback
3. `dlocal-payment.service.ts` - Create payment, verify webhook signature
4. `three-day-validator.service.ts` - Anti-abuse validation (CRITICAL)
5. `lib/geo/detect-country.ts` - IP geolocation detection

**CRITICAL for three-day-validator.service.ts:**

```typescript
// Use crypto for secure hashing
import { createHash } from 'crypto';

// Check hasUsedThreeDayPlan flag
// Check for active subscription
// Detect multi-account abuse via payment method hash
// Log fraud alerts for suspicious patterns
```

### Step 4: API Routes (Files 9-19)

Build API routes:

1. Payment methods - GET by country
2. Exchange rate - GET USD to currency
3. Convert - GET currency conversion
4. Create payment - POST with full validation
5. Validate discount - POST (reject for 3-day plan)
6. Payment status - GET by paymentId
7. Webhook - POST with signature verification
8. Cron routes - GET with CRON_SECRET auth
9. Admin fraud routes - GET/PATCH with admin auth

**CRITICAL for create payment route:**

```typescript
// 1. Verify authentication
// 2. Validate request body with Zod
// 3. For 3-day plan: Call threeDayValidator.canPurchaseThreeDayPlan()
// 4. For monthly: Validate discount code if provided
// 5. Create payment in dLocal
// 6. Create Payment record in database
// 7. Return payment response with redirectUrl
```

**CRITICAL for webhook route:**

```typescript
// 1. Verify webhook signature FIRST
// 2. Find payment by providerPaymentId
// 3. Handle PAID status:
//    - Calculate expiry (extend if early renewal)
//    - Update payment to COMPLETED
//    - Create/update subscription
//    - Upgrade user to PRO
//    - Mark hasUsedThreeDayPlan if 3-day
// 4. Handle REJECTED status
// 5. Handle CANCELLED status
```

### Step 5: Cron Services (Files 20-21)

Create cron job services:

1. `check-expiring-subscriptions.ts` - Find dLocal subs expiring in 3 days, send reminder email
2. `downgrade-expired-subscriptions.ts` - Find expired dLocal subs, downgrade to FREE

### Step 6: Frontend Components (Files 22-27)

Build components using seed code patterns:

1. CountrySelector - Dropdown with flags, auto-detect
2. PlanSelector - 3-day vs Monthly cards, show restrictions
3. PaymentMethodSelector - Grid of methods by country
4. PriceDisplay - Local currency with USD equivalent
5. DiscountCodeInput - Hidden for 3-day plan
6. PaymentButton - Submit with provider indication

### Step 7: Checkout Page (File 28)

Build unified checkout page:

- Country detection on mount
- Load payment methods when country changes
- Plan selection affects discount code visibility
- Process payment based on selected provider
- Show order summary with price breakdown

### Step 8: Email Templates (Files 29-32)

Create React Email templates:

1. Payment confirmation with plan details
2. Renewal reminder (3 days before expiry)
3. Subscription expired notification
4. Payment failure with retry link

### Step 9: Admin Fraud Dashboard (Files 33-36)

Build admin pages:

1. Fraud alerts list with filtering
2. Fraud alert detail with review actions
3. FraudAlertCard component
4. FraudPatternBadge component

### Step 10: Configuration (File 37)

Update `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/check-expiring-subscriptions",
      "schedule": "0 0 * * *"
    },
    {
      "path": "/api/cron/downgrade-expired-subscriptions",
      "schedule": "0 * * * *"
    }
  ]
}
```

---

## Validation Checklist

After each file, verify:

- [ ] TypeScript compiles without errors
- [ ] ESLint passes
- [ ] Imports resolve correctly
- [ ] Authentication checks present (protected routes)
- [ ] Error handling comprehensive
- [ ] Zod validation for POST/PATCH requests

Run validation:

```bash
npm run validate
```

---

## Commit Strategy

Make commits after each phase:

```bash
# Phase A
git add prisma/ types/
git commit -m "feat(dlocal): add database models and types"

# Phase B
git add lib/dlocal/ lib/geo/
git commit -m "feat(dlocal): add payment services"

# Phase C
git add app/api/payments/ app/api/webhooks/ app/api/cron/ app/api/admin/
git commit -m "feat(dlocal): add payment API routes"

# Phase D
git add lib/cron/
git commit -m "feat(dlocal): add subscription lifecycle cron jobs"

# Phase E
git add components/payments/
git commit -m "feat(dlocal): add payment UI components"

# Phase F
git add app/checkout/
git commit -m "feat(dlocal): add unified checkout page"

# Phase G
git add emails/
git commit -m "feat(dlocal): add payment email templates"

# Phase H
git add app/\(dashboard\)/admin/fraud-alerts/ components/admin/
git commit -m "feat(dlocal): add fraud monitoring dashboard"

# Phase I
git add vercel.json
git commit -m "feat(dlocal): add cron configuration"
```

---

## Environment Variables Required

Add to `.env`:

```bash
# dLocal API Configuration
DLOCAL_API_URL=https://api.dlocal.com
DLOCAL_API_LOGIN=your_dlocal_login
DLOCAL_API_KEY=your_dlocal_api_key
DLOCAL_API_SECRET=your_dlocal_secret_key
DLOCAL_WEBHOOK_SECRET=your_webhook_secret

# dLocal Pricing (USD)
DLOCAL_3DAY_PRICE_USD=1.99
DLOCAL_MONTHLY_PRICE_USD=29.00

# Feature Flags
ENABLE_DLOCAL_PAYMENTS=true
ENABLE_3DAY_PLAN=true

# Cron Job Secret
CRON_SECRET=your_cron_secret_here
```

---

## Success Criteria

Part 18 is complete when:

- [ ] All 37 files created/updated
- [ ] Database migration successful
- [ ] Single checkout shows both Stripe and dLocal options
- [ ] Country detection works with manual override
- [ ] Payment methods load dynamically for 8 countries
- [ ] Prices display in local currency with USD equivalent
- [ ] 3-day plan works (dLocal only, one-time per account)
- [ ] Monthly plan works (both providers)
- [ ] Discount codes work on monthly only (rejected for 3-day)
- [ ] Webhook handles payment success/failure correctly
- [ ] Early renewal extends subscription correctly
- [ ] Renewal reminders sent 3 days before expiry
- [ ] Expired subscriptions downgraded to FREE
- [ ] Fraud alerts logged for suspicious patterns
- [ ] Admin can review fraud alerts
- [ ] All validation passes

---

## Critical Reminders

1. **NEVER apply Stripe auto-renewal logic to dLocal subscriptions**
2. **3-day plan is ONE-TIME per account - enforce via hasUsedThreeDayPlan**
3. **Discount codes NOT allowed on 3-day plan**
4. **Always verify webhook signatures before processing**
5. **Store BOTH local currency AND USD amounts in database**
6. **dLocal API secrets are SERVER-SIDE only**
7. **Early renewal EXTENDS from current expiry, not from today**
8. **Use crypto.randomBytes() for secure hashing, NOT Math.random()**

---

## Reference Files

- Implementation Guide: `docs/implementation-guides/v5_part_r.md`
- Policy Document: `docs/policies/07-dlocal-integration-rules.md`
- Build Order: `docs/build-orders/part-18-dlocal.md`
- Coding Patterns: `docs/policies/05-coding-patterns-part-1.md` and `05-coding-patterns-part-2.md`
- Architecture: `ARCHITECTURE-compress.md`
- Progress: `PROGRESS-part-2.md`

---

**BEGIN BUILDING PART 18**

Start with Phase A (Database & Types), then proceed through each phase sequentially. Validate after each file. Commit after each phase.
