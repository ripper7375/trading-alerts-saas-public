# Part 18B Handoff Document for Part 18C

## Overview

**Part 18B Status:** COMPLETE
**Date:** 2024-12-20
**Next:** Part 18C (Frontend Components & Email Templates)

---

## What Part 18B Built

### 1. Database Schema (Already Present from Part 18A)

No new migrations needed - all required fields already existed:

**User Model:**
- `hasUsedThreeDayPlan: Boolean` - Tracks 3-day plan usage (anti-abuse)
- `threeDayPlanUsedAt: DateTime?` - When 3-day plan was used

**Subscription Model:**
- `planType: String?` - 'MONTHLY' or 'THREE_DAY'
- `dLocalPaymentId: String?` - dLocal payment reference
- `dLocalPaymentMethod: String?` - 'UPI', 'PAYTM', etc.
- `dLocalCountry: String?` - 'IN', 'ID', 'PK', etc.
- `dLocalCurrency: String?` - 'INR', 'IDR', 'PKR', etc.
- `expiresAt: DateTime?` - Explicit expiry date for dLocal
- `renewalReminderSent: Boolean` - Prevents duplicate reminders

---

### 2. Services Implemented

#### A. Three-Day Plan Validator Service
**Location:** `lib/dlocal/three-day-validator.service.ts`

```typescript
// Check if user can purchase 3-day plan
canPurchaseThreeDayPlan(userId: string): Promise<ThreeDayPlanEligibilityResult>

// Mark 3-day plan as used after payment
markThreeDayPlanUsed(userId: string): Promise<void>

// Unified validation for any plan type
validatePlanPurchase(userId: string, planType: PlanType): Promise<ThreeDayPlanEligibilityResult>
```

**Rules Enforced:**
- 3-day plan can only be purchased ONCE per account (lifetime)
- Cannot purchase 3-day plan with active subscription
- Returns detailed reason if not eligible

#### B. Check Expiring Subscriptions Service
**Location:** `lib/cron/check-expiring-subscriptions.ts`

```typescript
checkExpiringSubscriptions(options?: CheckExpiringOptions): Promise<CheckExpiringResult>
```

**Features:**
- Finds dLocal subscriptions expiring in 3 days
- Marks `renewalReminderSent = true` to prevent duplicates
- Returns list of users needing reminder emails
- Supports dry-run mode for testing

#### C. Downgrade Expired Subscriptions Service
**Location:** `lib/cron/downgrade-expired-subscriptions.ts`

```typescript
downgradeExpiredSubscriptions(options?: DowngradeExpiredOptions): Promise<DowngradeExpiredResult>
```

**Features:**
- Finds expired dLocal subscriptions (only dLocal, not Stripe)
- Sets user tier to FREE
- Sets subscription status to CANCELED
- Creates notification for user
- Supports dry-run mode for testing

---

### 3. Enhanced Webhook Handler

**Location:** `app/api/webhooks/dlocal/route.ts`

**New Capabilities (Part 18B):**
- Creates subscription record on payment completion
- Upgrades user to PRO tier
- Calculates correct expiry date (3 days or 30 days)
- Marks 3-day plan as used (anti-abuse)
- Links payment to subscription
- Uses database transaction for atomicity

**Flow on PAID webhook:**
1. Update payment status to COMPLETED
2. Upgrade user to PRO tier
3. Create/update subscription with expiry date
4. Link payment to subscription
5. Mark 3-day plan as used (if applicable)
6. Create success notification

---

### 4. Cron API Routes

**A. Check Expiring Subscriptions**
- **Endpoint:** `GET /api/cron/check-expiring-subscriptions`
- **Schedule:** Daily at 9:00 AM UTC (`0 9 * * *`)
- **Auth:** Bearer token (CRON_SECRET)

**B. Downgrade Expired Subscriptions**
- **Endpoint:** `GET /api/cron/downgrade-expired-subscriptions`
- **Schedule:** Daily at 10:00 AM UTC (`0 10 * * *`)
- **Auth:** Bearer token (CRON_SECRET)

---

### 5. Part 12 API Integration

#### A. Subscription API (`/api/subscription`)
**New Response Fields:**
```typescript
{
  tier: 'FREE' | 'PRO',
  status: string,
  subscription: {
    id: string,
    status: string,
    provider: 'STRIPE' | 'DLOCAL' | null,  // NEW
    planType: string | null,                 // NEW
    currentPeriodEnd: string | null,
    expiresAt: string | null,                // NEW
    cancelAtPeriodEnd: boolean,
    trialEnd: string | null,
    paymentMethod: {...} | null,
    dLocalPaymentMethod: string | null,      // NEW
    dLocalCountry: string | null,            // NEW
  } | null
}
```

#### B. Invoices API (`/api/invoices`)
**Now returns unified invoices from both providers:**
```typescript
{
  invoices: [
    {
      id: string,
      date: string,
      amount: number,
      currency: string,           // NEW
      status: 'paid' | 'open' | 'failed',
      description: string,
      invoicePdfUrl: string | null,
      provider: 'STRIPE' | 'DLOCAL',  // NEW
      planType: string | null,        // NEW
    }
  ],
  hasMore: boolean
}
```

---

### 6. Cron Schedule Updates

**vercel.json now includes:**
```json
{
  "crons": [
    { "path": "/api/cron/check-expiring-subscriptions", "schedule": "0 9 * * *" },
    { "path": "/api/cron/downgrade-expired-subscriptions", "schedule": "0 10 * * *" }
  ]
}
```

---

### 7. Test Coverage

**New Test Files:**
- `__tests__/lib/dlocal/three-day-validator.test.ts`
- `__tests__/lib/cron/check-expiring-subscriptions.test.ts`
- `__tests__/lib/cron/downgrade-expired-subscriptions.test.ts`

**Test Count:** 25+ new test cases

---

## What Part 18C Needs to Build

### 1. Frontend Components

**A. Country Selector Component**
- Auto-detect user country
- Allow manual selection
- Display available payment methods

**B. Plan Selector Component**
- Show 3-day plan option (if eligible)
- Show monthly plan
- Apply discounts

**C. Payment Method Selector**
- Display country-specific methods (UPI, GoPay, etc.)
- Show method logos

**D. Checkout Form**
- Price display with currency conversion
- Discount code input
- Payment button

### 2. Pages

**A. dLocal Checkout Page**
- `/checkout/dlocal` or unified `/checkout`
- Integration with Part 18A/18B services

**B. Subscription Management Updates**
- Show dLocal subscription details
- Renewal instructions for dLocal users

### 3. Email Templates

**A. Renewal Reminder Email**
- Sent 3 days before expiry
- dLocal-specific renewal instructions

**B. Subscription Expired Email**
- Sent when downgraded to FREE
- Re-subscription CTA

**C. dLocal Payment Receipt**
- Provider-specific receipt format

### 4. Admin Features (Optional)

**A. Fraud Alerts Dashboard**
- View 3-day plan abuse attempts
- Review fraud alerts

---

## API Endpoints Available for Part 18C

### From Part 18A:
- `GET /api/payments/dlocal/methods` - Get payment methods for country
- `GET /api/payments/dlocal/exchange-rate` - Get exchange rate
- `GET /api/payments/dlocal/convert` - Convert USD to local currency
- `POST /api/payments/dlocal/create` - Create dLocal payment
- `GET /api/payments/dlocal/[paymentId]` - Get payment status

### From Part 18B:
- `GET /api/subscription` - Get subscription with provider info
- `GET /api/invoices` - Get unified invoice history
- `GET /api/cron/check-expiring-subscriptions` - Check expiring (cron)
- `GET /api/cron/downgrade-expired-subscriptions` - Downgrade expired (cron)
- `POST /api/webhooks/dlocal` - Enhanced webhook with subscription creation

### Service Functions:
```typescript
// 3-day plan validation
import { canPurchaseThreeDayPlan, validatePlanPurchase } from '@/lib/dlocal/three-day-validator.service';

// Currency conversion
import { convertUSDToLocal, getExchangeRate } from '@/lib/dlocal/currency-converter.service';

// Payment methods
import { getPaymentMethodsForCountry } from '@/lib/dlocal/payment-methods.service';

// Country detection
import { detectCountry } from '@/lib/geo/detect-country';
```

---

## Environment Variables Required

```bash
# From Part 18A (already set)
DLOCAL_API_URL=https://sandbox.dlocal.com
DLOCAL_API_KEY=your_api_key
DLOCAL_SECRET_KEY=your_secret_key
DLOCAL_WEBHOOK_SECRET=your_webhook_secret

# For cron jobs
CRON_SECRET=your_secure_cron_secret

# Email (for Part 18C)
# Add email provider config when implementing emails
```

---

## Validation Checklist for Part 18B

### Functionality
- [x] 3-day plan validation enforced
- [x] Webhook creates subscriptions with correct expiry
- [x] User upgraded to PRO on payment success
- [x] 3-day plan marked as used after purchase
- [x] Renewal reminders identified (not sent yet - Part 18C)
- [x] Expired subscriptions downgraded
- [x] Part 12 APIs return unified data
- [x] Stripe flow unaffected

### Testing
- [x] All new tests passing
- [x] Integration with Part 18A services working

### Critical Check
- [x] **STRIPE STILL WORKS** - No breaking changes to Stripe flow

---

## Known Limitations / Future Work

1. **Email Sending Not Implemented**
   - Cron jobs mark reminders as sent but don't actually send emails
   - Part 18C should implement actual email sending

2. **PDF Invoices for dLocal**
   - dLocal doesn't provide PDF invoices
   - Consider generating our own invoice PDFs

3. **Renewal Flow**
   - dLocal subscriptions require manual renewal
   - Part 18C should create renewal flow UI

---

## Files Created/Modified in Part 18B

### New Files (7):
1. `lib/dlocal/three-day-validator.service.ts`
2. `lib/cron/check-expiring-subscriptions.ts`
3. `lib/cron/downgrade-expired-subscriptions.ts`
4. `app/api/cron/check-expiring-subscriptions/route.ts`
5. `app/api/cron/downgrade-expired-subscriptions/route.ts`
6. `__tests__/lib/dlocal/three-day-validator.test.ts`
7. `__tests__/lib/cron/check-expiring-subscriptions.test.ts`
8. `__tests__/lib/cron/downgrade-expired-subscriptions.test.ts`
9. `docs/part18b-handoff.md`

### Modified Files (4):
1. `app/api/webhooks/dlocal/route.ts` - Added subscription creation
2. `app/api/subscription/route.ts` - Added provider info
3. `app/api/invoices/route.ts` - Added dLocal payments
4. `vercel.json` - Added cron schedules

---

**Part 18B Complete!**

Ready for Part 18C implementation.
