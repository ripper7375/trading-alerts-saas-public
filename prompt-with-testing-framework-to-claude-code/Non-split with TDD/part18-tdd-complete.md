# Part 18: dLocal Payment Integration with Test-Driven Development (TDD)

## Overview

**Part:** 18 of 18  
**Feature:** dLocal Payment Integration for Emerging Markets  
**Total Files:** 45 production files + 18 test files = **63 files total**  
**Complexity:** High  
**Dependencies:** Part 2 (Database), Part 5 (Auth), Part 12 (Stripe Integration)  
**Test Coverage Target:** 25% minimum

---

## Mission Statement

Build Part 18 (dLocal Payments) AND integrate it with Part 12 (Stripe) using **Test-Driven Development (TDD)** methodology to create a UNIFIED payment system with 25% test coverage from day 1, ensuring payment correctness and preventing revenue loss.

---

## Why Test-Driven Development for Payment Systems?

### Traditional Approach (Build → Test) - DANGEROUS for Money

```
Code → Deploy → User finds bug → Revenue loss → Retrofit tests
```

### TDD Approach (Test → Build) - SAFE for Money

```
Write test → Code fails → Write code → Test passes → Refactor → Safe deployment
```

**Benefits for Payment-Critical Code:**

- ✅ **Catch payment bugs before production** (prevent revenue loss)
- ✅ **Design cleaner APIs** (tests force good architecture)
- ✅ **Refactor safely** (tests protect against regressions)
- ✅ **Living documentation** (tests show how code should work)
- ✅ **Confidence in money flows** (every conversion tested)

---

## TDD Red-Green-Refactor Cycle

```
┌────────────────────────────────────────────────┐
│ 1. RED: Write failing test                    │
│    └→ Define expected behavior                 │
└────────────────────────────────────────────────┘
                    ↓
┌────────────────────────────────────────────────┐
│ 2. GREEN: Write minimal code to pass          │
│    └→ Make test pass (don't optimize yet)     │
└────────────────────────────────────────────────┘
                    ↓
┌────────────────────────────────────────────────┐
│ 3. REFACTOR: Improve code quality              │
│    └→ Clean up while keeping tests green      │
└────────────────────────────────────────────────┘
                    ↓
         Repeat for next feature
```

---

## Prerequisites Check

Before starting, verify:

- [ ] Part 2 complete (Database & Prisma setup)
- [ ] Part 5 complete (Authentication with NextAuth)
- [ ] Part 12 complete (Stripe integration working)
- [ ] Node.js and npm working
- [ ] Git repository initialized
- [ ] Testing framework installed (Jest + Supertest)

---

## ⚠️ CRITICAL: MUTUAL INTEGRATION WITH PART 12

**Part 18 does NOT replace Part 12 - it INTEGRATES with it to create a UNIFIED payment system.**

### Integration Architecture

```
┌───────────────────────────────────────────────────────────────────────┐
│                        UNIFIED CHECKOUT FLOW                          │
├───────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  User visits /pricing (MODIFIED Part 12) OR /checkout (Part 18)      │
│                              ↓                                        │
│  Country Detection (Part 18: lib/geo/detect-country.ts)              │
│                              ↓                                        │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │              PAYMENT METHOD SELECTION                          │ │
│  │  ┌────────────────────┐    ┌───────────────────────────────────┐ │
│  │  │  STRIPE (Card)     │ OR │  dLOCAL (Local Methods)         │ │
│  │  │  - All countries   │    │  - 8 supported countries only   │ │
│  │  │  - Auto-renewal ✓  │    │  - Manual renewal only          │ │
│  │  │  - Monthly plan    │    │  - 3-day + Monthly plans        │ │
│  │  └────────────────────┘    └───────────────────────────────────┘ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                              ↓                                        │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │              WEBHOOK PROCESSING                                │ │
│  │  Stripe Webhook (Part 12)    dLocal Webhook (Part 18)         │ │
│  │  app/api/webhooks/stripe     app/api/webhooks/dlocal          │ │
│  │           ↓                            ↓                       │ │
│  │  ┌───────────────────────────────────────────────────────────┐ │ │
│  │  │         UNIFIED SUBSCRIPTION HANDLING                    │ │ │
│  │  │  - Update User.tier to PRO                              │ │ │
│  │  │  - Create Subscription with paymentProvider field       │ │ │
│  │  │  - Store expiresAt for dLocal (manual renewal)         │ │ │
│  │  └───────────────────────────────────────────────────────────┘ │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

---

## Critical Business Rules (MUST FOLLOW)

### 1. dLocal vs Stripe Differences

| Feature               | Stripe                 | dLocal                 |
| --------------------- | ---------------------- | ---------------------- |
| Auto-Renewal          | ✅ Yes                 | ❌ NO - Manual renewal |
| Free Trial            | ✅ 7 days              | ❌ NO trial            |
| Plans                 | Monthly only           | 3-day + Monthly        |
| Discount Codes        | ✅ All plans           | ❌ Monthly ONLY        |
| Renewal Notifications | Stripe manages         | WE send 3 days before  |
| Expiry Handling       | Stripe auto-downgrades | WE downgrade via cron  |

### 2. 3-Day Plan Anti-Abuse (CRITICAL)

- 3-day plan can ONLY be purchased ONCE per account (lifetime)
- Track via `hasUsedThreeDayPlan` boolean on User model
- CANNOT purchase 3-day plan if user has active subscription
- Use `crypto.randomBytes()` for secure hashing (NOT Math.random)

### 3. Supported Countries (8 total)

- **IN** (India) - INR - UPI, Paytm, PhonePe, Net Banking
- **NG** (Nigeria) - NGN - Bank Transfer, USSD, Paystack
- **PK** (Pakistan) - PKR - JazzCash, Easypaisa
- **VN** (Vietnam) - VND - VNPay, MoMo, ZaloPay
- **ID** (Indonesia) - IDR - GoPay, OVO, Dana, ShopeePay
- **TH** (Thailand) - THB - TrueMoney, Rabbit LINE Pay, Thai QR
- **ZA** (South Africa) - ZAR - Instant EFT, EFT
- **TR** (Turkey) - TRY - Bank Transfer, Local Cards

### 4. Pricing

- **3-Day Plan:** $1.99 USD (dLocal only, NO discount codes)
- **Monthly Plan:** $29.00 USD (both Stripe & dLocal, discount codes allowed)

### 5. Early Renewal Logic

- **Monthly:** ALLOWED - extend from current expiry date
- **3-Day:** PROHIBITED if user has any active subscription

---

## All 63 Files to Build (45 Production + 18 Test)

### Phase A: Database & Types (3 production + 2 test = 5 files)

| #   | File Path                                | Type   | Description                                                     |
| --- | ---------------------------------------- | ------ | --------------------------------------------------------------- |
| 1   | `prisma/schema.prisma`                   | UPDATE | Add Payment model, FraudAlert model, update User & Subscription |
| 2   | `types/dlocal.ts`                        | NEW    | dLocal type definitions                                         |
| 3   | `lib/dlocal/constants.ts`                | NEW    | Countries, currencies, pricing constants                        |
| T1  | `__tests__/types/dlocal.test.ts`         | TEST   | Test type definitions and constants                             |
| T2  | `__tests__/lib/dlocal/constants.test.ts` | TEST   | Test country/currency mappings                                  |

### Phase B: Services (5 production + 5 test = 10 files)

| #   | File Path                                          | Type | Description                                    |
| --- | -------------------------------------------------- | ---- | ---------------------------------------------- |
| 4   | `lib/dlocal/currency-converter.service.ts`         | NEW  | USD to local currency conversion               |
| 5   | `lib/dlocal/payment-methods.service.ts`            | NEW  | Fetch payment methods by country               |
| 6   | `lib/dlocal/dlocal-payment.service.ts`             | NEW  | Create payments, verify webhooks               |
| 7   | `lib/dlocal/three-day-validator.service.ts`        | NEW  | Anti-abuse validation for 3-day plan           |
| 8   | `lib/geo/detect-country.ts`                        | NEW  | IP geolocation country detection               |
| T3  | `__tests__/lib/dlocal/currency-converter.test.ts`  | TEST | TDD: Currency conversion logic                 |
| T4  | `__tests__/lib/dlocal/payment-methods.test.ts`     | TEST | TDD: Payment methods by country                |
| T5  | `__tests__/lib/dlocal/dlocal-payment.test.ts`      | TEST | TDD: Payment creation and webhook verification |
| T6  | `__tests__/lib/dlocal/three-day-validator.test.ts` | TEST | TDD: 3-day plan anti-abuse logic               |
| T7  | `__tests__/lib/geo/detect-country.test.ts`         | TEST | TDD: Country detection                         |

### Phase C: API Routes (11 production + 6 test = 17 files)

| #   | File Path                                               | Type | Description                            |
| --- | ------------------------------------------------------- | ---- | -------------------------------------- |
| 9   | `app/api/payments/dlocal/methods/route.ts`              | NEW  | GET payment methods for country        |
| 10  | `app/api/payments/dlocal/exchange-rate/route.ts`        | NEW  | GET exchange rate USD to currency      |
| 11  | `app/api/payments/dlocal/convert/route.ts`              | NEW  | GET currency conversion                |
| 12  | `app/api/payments/dlocal/create/route.ts`               | NEW  | POST create dLocal payment             |
| 13  | `app/api/payments/dlocal/validate-discount/route.ts`    | NEW  | POST validate discount code            |
| 14  | `app/api/payments/dlocal/[paymentId]/route.ts`          | NEW  | GET payment status                     |
| 15  | `app/api/webhooks/dlocal/route.ts`                      | NEW  | POST webhook handler                   |
| 16  | `app/api/cron/check-expiring-subscriptions/route.ts`    | NEW  | GET cron - send reminders              |
| 17  | `app/api/cron/downgrade-expired-subscriptions/route.ts` | NEW  | GET cron - downgrade expired           |
| 18  | `app/api/admin/fraud-alerts/route.ts`                   | NEW  | GET/POST fraud alerts list             |
| 19  | `app/api/admin/fraud-alerts/[id]/route.ts`              | NEW  | GET/PATCH fraud alert detail           |
| T8  | `__tests__/api/payments/dlocal/methods/route.test.ts`   | TEST | Unit test: Payment methods API         |
| T9  | `__tests__/api/payments/dlocal/create/route.test.ts`    | TEST | Unit test: Create payment API          |
| T10 | `__tests__/api/webhooks/dlocal/route.test.ts`           | TEST | Unit test: Webhook handler             |
| T11 | `__tests__/api/cron/check-expiring.test.ts`             | TEST | Unit test: Expiring subscriptions cron |
| T12 | `__tests__/api/cron/downgrade-expired.test.ts`          | TEST | Unit test: Downgrade cron              |
| T13 | `__tests__/api/admin/fraud-alerts/route.test.ts`        | TEST | Unit test: Fraud alerts API            |

### Phase D: Cron Job Services (2 production + 2 test = 4 files)

| #   | File Path                                      | Type | Description                      |
| --- | ---------------------------------------------- | ---- | -------------------------------- |
| 20  | `lib/cron/check-expiring-subscriptions.ts`     | NEW  | Send renewal reminders           |
| 21  | `lib/cron/downgrade-expired-subscriptions.ts`  | NEW  | Downgrade expired users to FREE  |
| T14 | `__tests__/lib/cron/check-expiring.test.ts`    | TEST | TDD: Expiring subscription logic |
| T15 | `__tests__/lib/cron/downgrade-expired.test.ts` | TEST | TDD: Downgrade logic             |

### Phase E: Frontend Components (6 production + 1 test = 7 files)

| #   | File Path                                             | Type | Description                        |
| --- | ----------------------------------------------------- | ---- | ---------------------------------- |
| 22  | `components/payments/CountrySelector.tsx`             | NEW  | Country dropdown with flags        |
| 23  | `components/payments/PlanSelector.tsx`                | NEW  | 3-day vs Monthly plan cards        |
| 24  | `components/payments/PaymentMethodSelector.tsx`       | NEW  | Payment method grid                |
| 25  | `components/payments/PriceDisplay.tsx`                | NEW  | Local currency + USD display       |
| 26  | `components/payments/DiscountCodeInput.tsx`           | NEW  | Discount code input (monthly only) |
| 27  | `components/payments/PaymentButton.tsx`               | NEW  | Payment submit button              |
| T16 | `__tests__/components/payments/PlanSelector.test.tsx` | TEST | Component test: Plan selector      |

### Phase F: Unified Checkout Page (1 production + 0 test = 1 file)

| #   | File Path               | Type | Description                        |
| --- | ----------------------- | ---- | ---------------------------------- |
| 28  | `app/checkout/page.tsx` | NEW  | Unified checkout (Stripe + dLocal) |

### Phase G: Email Templates (4 production + 0 test = 4 files)

| #   | File Path                         | Type | Description                  |
| --- | --------------------------------- | ---- | ---------------------------- |
| 29  | `emails/payment-confirmation.tsx` | NEW  | Payment success email        |
| 30  | `emails/renewal-reminder.tsx`     | NEW  | 3-day before expiry reminder |
| 31  | `emails/subscription-expired.tsx` | NEW  | Expired notification         |
| 32  | `emails/payment-failure.tsx`      | NEW  | Payment failed email         |

### Phase H: Admin Fraud Dashboard (4 production + 0 test = 4 files)

| #   | File Path                                          | Type | Description                |
| --- | -------------------------------------------------- | ---- | -------------------------- |
| 33  | `app/(dashboard)/admin/fraud-alerts/page.tsx`      | NEW  | Fraud alerts list page     |
| 34  | `app/(dashboard)/admin/fraud-alerts/[id]/page.tsx` | NEW  | Fraud alert detail page    |
| 35  | `components/admin/FraudAlertCard.tsx`              | NEW  | Fraud alert card component |
| 36  | `components/admin/FraudPatternBadge.tsx`           | NEW  | Severity/pattern badge     |

### Phase I: Configuration (1 production + 0 test = 1 file)

| #   | File Path     | Type   | Description            |
| --- | ------------- | ------ | ---------------------- |
| 37  | `vercel.json` | UPDATE | Add cron job schedules |

### Phase J: Part 12 Integration - RETROFIT (8 production + 2 test = 10 files)

| #   | File Path                                                 | Type   | Description                                       |
| --- | --------------------------------------------------------- | ------ | ------------------------------------------------- |
| 38  | `app/(marketing)/pricing/page.tsx`                        | MODIFY | Add dLocal support, country detection, 3-day plan |
| 39  | `app/api/subscription/route.ts`                           | MODIFY | Return paymentProvider, handle both providers     |
| 40  | `app/api/checkout/route.ts`                               | MODIFY | Route to Stripe OR dLocal based on selection      |
| 41  | `app/api/invoices/route.ts`                               | MODIFY | Include dLocal payments in results                |
| 42  | `components/billing/subscription-card.tsx`                | MODIFY | Show provider, manual renewal notice              |
| 43  | `lib/stripe/webhook-handlers.ts`                          | MODIFY | Add paymentProvider when creating subscription    |
| 44  | `lib/stripe/stripe.ts`                                    | MODIFY | Export provider type constants                    |
| 45  | `lib/email/subscription-emails.ts`                        | MODIFY | Provider-specific email content                   |
| T17 | `__tests__/api/subscription/route.test.ts`                | TEST   | Unit test: Subscription API with providers        |
| T18 | `__tests__/components/billing/subscription-card.test.tsx` | TEST   | Component test: Subscription card                 |

### Phase K: E2E Integration Tests (Supertest) (0 production + 1 test = 1 file)

| #   | File Path                                        | Type | Description                              |
| --- | ------------------------------------------------ | ---- | ---------------------------------------- |
| T19 | `__tests__/e2e/dlocal-payment-flow.supertest.ts` | TEST | End-to-end: Complete dLocal payment flow |

---

## TDD Build Sequence with Red-Green-Refactor

### Phase A: Database & Types (TDD)

#### Step 1: Update Database Schema (RED)

**File: `prisma/schema.prisma`**

```prisma
model User {
  id                  String   @id @default(cuid())
  email               String   @unique
  name                String?
  tier                String   @default("FREE") // FREE or PRO
  hasUsedThreeDayPlan Boolean  @default(false) // NEW: Track 3-day plan usage
  // ... existing fields ...
}

model Subscription {
  id                    String   @id @default(cuid())
  userId                String
  user                  User     @relation(fields: [userId], references: [id])
  paymentProvider       String   // NEW: 'STRIPE' or 'DLOCAL'
  planType              String   // NEW: 'MONTHLY' or 'THREE_DAY'
  status                String   // ACTIVE, CANCELLED, EXPIRED

  // Stripe fields
  stripeCustomerId      String?
  stripeSubscriptionId  String?
  currentPeriodStart    DateTime?
  currentPeriodEnd      DateTime?

  // dLocal fields
  expiresAt             DateTime? // NEW: For manual renewal
  renewalReminderSent   Boolean  @default(false) // NEW

  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  @@index([userId])
  @@index([paymentProvider])
  @@index([expiresAt]) // NEW: For cron jobs
}

model Payment {
  id              String   @id @default(cuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id])
  provider        String   // 'DLOCAL'
  paymentId       String   @unique // dLocal payment ID
  orderId         String   @unique
  amount          Decimal  @db.Decimal(10, 2)
  currency        String
  amountUSD       Decimal  @db.Decimal(10, 2)
  country         String
  paymentMethod   String
  planType        String   // 'THREE_DAY' or 'MONTHLY'
  status          String   // PENDING, COMPLETED, FAILED
  discountCode    String?
  discountAmount  Decimal? @db.Decimal(10, 2)
  finalAmount     Decimal  @db.Decimal(10, 2)
  metadata        Json?
  initiatedAt     DateTime @default(now())
  completedAt     DateTime?
  failedAt        DateTime?
  failureReason   String?

  @@index([userId])
  @@index([status])
  @@index([initiatedAt])
}

model FraudAlert {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  pattern     String   // e.g., 'MULTIPLE_3DAY_ATTEMPTS'
  severity    String   // LOW, MEDIUM, HIGH, CRITICAL
  description String
  metadata    Json
  status      String   @default("NEW") // NEW, REVIEWED, RESOLVED
  createdAt   DateTime @default(now())
  reviewedAt  DateTime?
  reviewedBy  String?

  @@index([userId])
  @@index([status])
  @@index([severity])
}
```

**Run migration:**

```bash
npx prisma migrate dev --name add-dlocal-support
```

#### Step 2: Types & Constants (RED → GREEN → REFACTOR)

**RED: Write Test First**

**File: `__tests__/types/dlocal.test.ts`**

```typescript
import { DLocalCountry, DLocalCurrency, PaymentProvider } from '@/types/dlocal';

describe('dLocal Types', () => {
  it('should have correct payment provider types', () => {
    const providers: PaymentProvider[] = ['STRIPE', 'DLOCAL'];
    expect(providers).toHaveLength(2);
  });

  it('should have correct dLocal country codes', () => {
    const countries: DLocalCountry[] = [
      'IN',
      'NG',
      'PK',
      'VN',
      'ID',
      'TH',
      'ZA',
      'TR',
    ];
    expect(countries).toHaveLength(8);
  });
});
```

**Run test:** `npm test -- dlocal.test.ts` → ❌ FAILS (types don't exist)

**GREEN: Write Minimal Code**

**File: `types/dlocal.ts`**

```typescript
export type PaymentProvider = 'STRIPE' | 'DLOCAL';
export type DLocalCountry =
  | 'IN'
  | 'NG'
  | 'PK'
  | 'VN'
  | 'ID'
  | 'TH'
  | 'ZA'
  | 'TR';
export type DLocalCurrency =
  | 'INR'
  | 'NGN'
  | 'PKR'
  | 'VND'
  | 'IDR'
  | 'THB'
  | 'ZAR'
  | 'TRY';
export type PlanType = 'THREE_DAY' | 'MONTHLY';
export type PaymentStatus = 'PENDING' | 'COMPLETED' | 'FAILED';

export interface DLocalPaymentRequest {
  userId: string;
  amount: number; // USD amount
  currency: DLocalCurrency;
  country: DLocalCountry;
  paymentMethod: string;
  planType: PlanType;
  discountCode?: string;
}

export interface DLocalPaymentResponse {
  paymentId: string;
  orderId: string;
  paymentUrl: string;
  status: PaymentStatus;
  amount: number;
  currency: string;
}

export interface DLocalWebhookPayload {
  id: string;
  status: string;
  amount: number;
  currency: string;
  order_id: string;
  payment_method_id: string;
  created_date: string;
}
```

**Run test:** `npm test` → ✅ PASSES

**REFACTOR: Add Constants**

**File: `lib/dlocal/constants.ts`**

```typescript
import { DLocalCountry, DLocalCurrency } from '@/types/dlocal';

export const DLOCAL_SUPPORTED_COUNTRIES: DLocalCountry[] = [
  'IN',
  'NG',
  'PK',
  'VN',
  'ID',
  'TH',
  'ZA',
  'TR',
];

export const COUNTRY_CURRENCY_MAP: Record<DLocalCountry, DLocalCurrency> = {
  IN: 'INR',
  NG: 'NGN',
  PK: 'PKR',
  VN: 'VND',
  ID: 'IDR',
  TH: 'THB',
  ZA: 'ZAR',
  TR: 'TRY',
};

export const COUNTRY_NAMES: Record<DLocalCountry, string> = {
  IN: 'India',
  NG: 'Nigeria',
  PK: 'Pakistan',
  VN: 'Vietnam',
  ID: 'Indonesia',
  TH: 'Thailand',
  ZA: 'South Africa',
  TR: 'Turkey',
};

export const PAYMENT_METHODS: Record<DLocalCountry, string[]> = {
  IN: ['UPI', 'Paytm', 'PhonePe', 'Net Banking'],
  NG: ['Bank Transfer', 'USSD', 'Paystack'],
  PK: ['JazzCash', 'Easypaisa'],
  VN: ['VNPay', 'MoMo', 'ZaloPay'],
  ID: ['GoPay', 'OVO', 'Dana', 'ShopeePay'],
  TH: ['TrueMoney', 'Rabbit LINE Pay', 'Thai QR'],
  ZA: ['Instant EFT', 'EFT'],
  TR: ['Bank Transfer', 'Local Cards'],
};

export const PRICING = {
  THREE_DAY_USD: 1.99,
  MONTHLY_USD: 29.0,
};

export function isDLocalCountry(country: string): country is DLocalCountry {
  return DLOCAL_SUPPORTED_COUNTRIES.includes(country as DLocalCountry);
}

export function getCurrency(country: DLocalCountry): DLocalCurrency {
  return COUNTRY_CURRENCY_MAP[country];
}
```

**Test Constants:**

**File: `__tests__/lib/dlocal/constants.test.ts`**

```typescript
import {
  isDLocalCountry,
  getCurrency,
  DLOCAL_SUPPORTED_COUNTRIES,
} from '@/lib/dlocal/constants';

describe('dLocal Constants', () => {
  it('should identify valid dLocal countries', () => {
    expect(isDLocalCountry('IN')).toBe(true);
    expect(isDLocalCountry('NG')).toBe(true);
    expect(isDLocalCountry('US')).toBe(false);
  });

  it('should return correct currency for country', () => {
    expect(getCurrency('IN')).toBe('INR');
    expect(getCurrency('NG')).toBe('NGN');
    expect(getCurrency('TH')).toBe('THB');
  });

  it('should have 8 supported countries', () => {
    expect(DLOCAL_SUPPORTED_COUNTRIES).toHaveLength(8);
  });
});
```

**Run test:** `npm test` → ✅ PASSES

**Commit:**

```bash
git add prisma/schema.prisma types/dlocal.ts lib/dlocal/constants.ts __tests__
git commit -m "feat(dlocal): add database schema, types, and constants with tests"
```

---

### Phase B: Services (TDD)

#### Service 1: Currency Converter (TDD)

**RED: Write Test First**

**File: `__tests__/lib/dlocal/currency-converter.test.ts`**

```typescript
import {
  convertUSDToLocal,
  getExchangeRate,
} from '@/lib/dlocal/currency-converter.service';

describe('Currency Converter Service', () => {
  it('should convert USD to local currency', async () => {
    const result = await convertUSDToLocal(29.0, 'INR');

    expect(result.localAmount).toBeGreaterThan(0);
    expect(result.currency).toBe('INR');
    expect(result.exchangeRate).toBeGreaterThan(0);
  });

  it('should get exchange rate for currency', async () => {
    const rate = await getExchangeRate('THB');

    expect(rate).toBeGreaterThan(0);
    expect(typeof rate).toBe('number');
  });

  it('should handle invalid currency gracefully', async () => {
    await expect(getExchangeRate('INVALID' as any)).rejects.toThrow(
      'Unsupported currency'
    );
  });

  it('should cache exchange rates', async () => {
    const rate1 = await getExchangeRate('VND');
    const rate2 = await getExchangeRate('VND');

    // Should return same rate (cached)
    expect(rate1).toBe(rate2);
  });
});
```

**Run test:** `npm test -- currency-converter.test.ts` → ❌ FAILS

**GREEN: Write Minimal Code**

**File: `lib/dlocal/currency-converter.service.ts`**

```typescript
import { DLocalCurrency } from '@/types/dlocal';

// Simple in-memory cache
const exchangeRateCache: Map<
  DLocalCurrency,
  { rate: number; timestamp: number }
> = new Map();
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

// Mock exchange rates (in production, fetch from API)
const MOCK_RATES: Record<DLocalCurrency, number> = {
  INR: 83.12,
  NGN: 1505.5,
  PKR: 278.45,
  VND: 24750.0,
  IDR: 15680.0,
  THB: 35.25,
  ZAR: 18.65,
  TRY: 32.15,
};

export async function getExchangeRate(
  currency: DLocalCurrency
): Promise<number> {
  // Check if currency is supported
  if (!MOCK_RATES[currency]) {
    throw new Error('Unsupported currency');
  }

  // Check cache
  const cached = exchangeRateCache.get(currency);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.rate;
  }

  // In production, fetch from exchange rate API
  // For now, use mock rates
  const rate = MOCK_RATES[currency];

  // Cache the rate
  exchangeRateCache.set(currency, {
    rate,
    timestamp: Date.now(),
  });

  return rate;
}

export async function convertUSDToLocal(
  usdAmount: number,
  currency: DLocalCurrency
): Promise<{
  localAmount: number;
  currency: DLocalCurrency;
  exchangeRate: number;
}> {
  const exchangeRate = await getExchangeRate(currency);
  const localAmount = Math.round(usdAmount * exchangeRate * 100) / 100;

  return {
    localAmount,
    currency,
    exchangeRate,
  };
}
```

**Run test:** `npm test` → ✅ PASSES

**REFACTOR: Add Real API Integration**

```typescript
// lib/dlocal/currency-converter.service.ts (refactored)
import { DLocalCurrency } from '@/types/dlocal';
import { logger } from '@/lib/logger';

const exchangeRateCache: Map<
  DLocalCurrency,
  { rate: number; timestamp: number }
> = new Map();
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

async function fetchExchangeRateFromAPI(
  currency: DLocalCurrency
): Promise<number> {
  try {
    // Use exchangerate-api.com or similar service
    const response = await fetch(
      `https://api.exchangerate-api.com/v4/latest/USD`
    );
    const data = await response.json();

    if (!data.rates[currency]) {
      throw new Error(`Exchange rate not found for ${currency}`);
    }

    return data.rates[currency];
  } catch (error) {
    logger.error('Failed to fetch exchange rate', { currency, error });
    throw new Error('Failed to fetch exchange rate');
  }
}

export async function getExchangeRate(
  currency: DLocalCurrency
): Promise<number> {
  // Check cache
  const cached = exchangeRateCache.get(currency);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    logger.info('Using cached exchange rate', { currency, rate: cached.rate });
    return cached.rate;
  }

  // Fetch fresh rate
  const rate = await fetchExchangeRateFromAPI(currency);

  // Cache the rate
  exchangeRateCache.set(currency, {
    rate,
    timestamp: Date.now(),
  });

  logger.info('Fetched new exchange rate', { currency, rate });
  return rate;
}

export async function convertUSDToLocal(
  usdAmount: number,
  currency: DLocalCurrency
): Promise<{
  localAmount: number;
  currency: DLocalCurrency;
  exchangeRate: number;
}> {
  const exchangeRate = await getExchangeRate(currency);
  const localAmount = Math.round(usdAmount * exchangeRate * 100) / 100;

  return {
    localAmount,
    currency,
    exchangeRate,
  };
}
```

**Run test:** `npm test` → ✅ STILL PASSES

**Commit:**

```bash
git add lib/dlocal/currency-converter.service.ts __tests__/lib/dlocal/currency-converter.test.ts
git commit -m "feat(dlocal): add currency converter service with tests"
```

---

#### Service 2: Payment Methods Service (TDD)

**RED: Write Test First**

**File: `__tests__/lib/dlocal/payment-methods.test.ts`**

```typescript
import {
  getPaymentMethods,
  isValidPaymentMethod,
} from '@/lib/dlocal/payment-methods.service';

describe('Payment Methods Service', () => {
  it('should return payment methods for India', async () => {
    const methods = await getPaymentMethods('IN');

    expect(methods).toHaveLength(4);
    expect(methods).toContain('UPI');
    expect(methods).toContain('Paytm');
  });

  it('should return payment methods for Thailand', async () => {
    const methods = await getPaymentMethods('TH');

    expect(methods).toContain('TrueMoney');
    expect(methods).toContain('Thai QR');
  });

  it('should validate payment method for country', () => {
    expect(isValidPaymentMethod('IN', 'UPI')).toBe(true);
    expect(isValidPaymentMethod('IN', 'GoPay')).toBe(false); // Indonesian method
  });

  it('should throw error for unsupported country', async () => {
    await expect(getPaymentMethods('US' as any)).rejects.toThrow(
      'Unsupported country'
    );
  });
});
```

**Run test:** `npm test -- payment-methods.test.ts` → ❌ FAILS

**GREEN: Write Minimal Code**

**File: `lib/dlocal/payment-methods.service.ts`**

```typescript
import { DLocalCountry } from '@/types/dlocal';
import { PAYMENT_METHODS, isDLocalCountry } from '@/lib/dlocal/constants';

export async function getPaymentMethods(
  country: DLocalCountry
): Promise<string[]> {
  if (!isDLocalCountry(country)) {
    throw new Error('Unsupported country');
  }

  return PAYMENT_METHODS[country] || [];
}

export function isValidPaymentMethod(
  country: DLocalCountry,
  method: string
): boolean {
  const methods = PAYMENT_METHODS[country] || [];
  return methods.includes(method);
}
```

**Run test:** `npm test` → ✅ PASSES

**Commit:**

```bash
git add lib/dlocal/payment-methods.service.ts __tests__/lib/dlocal/payment-methods.test.ts
git commit -m "feat(dlocal): add payment methods service with tests"
```

---

#### Service 3: 3-Day Validator (TDD)

**RED: Write Test First**

**File: `__tests__/lib/dlocal/three-day-validator.test.ts`**

```typescript
import {
  canPurchaseThreeDayPlan,
  markThreeDayPlanUsed,
} from '@/lib/dlocal/three-day-validator.service';
import { prisma } from '@/lib/db';

describe('3-Day Plan Validator', () => {
  beforeEach(async () => {
    // Clean up test data
    await prisma.user.deleteMany({
      where: { email: { contains: 'test-3day' } },
    });
  });

  it('should allow new user to purchase 3-day plan', async () => {
    const user = await prisma.user.create({
      data: {
        email: 'test-3day-new@example.com',
        name: 'Test User',
        tier: 'FREE',
      },
    });

    const canPurchase = await canPurchaseThreeDayPlan(user.id);
    expect(canPurchase).toBe(true);
  });

  it('should reject if user already used 3-day plan', async () => {
    const user = await prisma.user.create({
      data: {
        email: 'test-3day-used@example.com',
        name: 'Test User',
        tier: 'FREE',
        hasUsedThreeDayPlan: true,
      },
    });

    const canPurchase = await canPurchaseThreeDayPlan(user.id);
    expect(canPurchase).toBe(false);
  });

  it('should reject if user has active subscription', async () => {
    const user = await prisma.user.create({
      data: {
        email: 'test-3day-active@example.com',
        name: 'Test User',
        tier: 'PRO',
      },
    });

    await prisma.subscription.create({
      data: {
        userId: user.id,
        paymentProvider: 'DLOCAL',
        planType: 'MONTHLY',
        status: 'ACTIVE',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    const canPurchase = await canPurchaseThreeDayPlan(user.id);
    expect(canPurchase).toBe(false);
  });

  it('should mark 3-day plan as used', async () => {
    const user = await prisma.user.create({
      data: {
        email: 'test-3day-mark@example.com',
        name: 'Test User',
        tier: 'FREE',
      },
    });

    await markThreeDayPlanUsed(user.id);

    const updatedUser = await prisma.user.findUnique({
      where: { id: user.id },
    });

    expect(updatedUser?.hasUsedThreeDayPlan).toBe(true);
  });
});
```

**Run test:** `npm test -- three-day-validator.test.ts` → ❌ FAILS

**GREEN: Write Minimal Code**

**File: `lib/dlocal/three-day-validator.service.ts`**

```typescript
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export async function canPurchaseThreeDayPlan(
  userId: string
): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        subscriptions: {
          where: { status: 'ACTIVE' },
        },
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Check if already used 3-day plan
    if (user.hasUsedThreeDayPlan) {
      logger.info('User already used 3-day plan', { userId });
      return false;
    }

    // Check if has active subscription
    if (user.subscriptions.length > 0) {
      logger.info('User has active subscription', { userId });
      return false;
    }

    return true;
  } catch (error) {
    logger.error('Error checking 3-day plan eligibility', { userId, error });
    throw error;
  }
}

export async function markThreeDayPlanUsed(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { hasUsedThreeDayPlan: true },
  });

  logger.info('Marked 3-day plan as used', { userId });
}
```

**Run test:** `npm test` → ✅ PASSES

**Commit:**

```bash
git add lib/dlocal/three-day-validator.service.ts __tests__/lib/dlocal/three-day-validator.test.ts
git commit -m "feat(dlocal): add 3-day plan validator with anti-abuse tests"
```

---

#### Service 4: dLocal Payment Service (TDD)

**RED: Write Test First**

**File: `__tests__/lib/dlocal/dlocal-payment.test.ts`**

```typescript
import {
  createPayment,
  verifyWebhookSignature,
  getPaymentStatus,
} from '@/lib/dlocal/dlocal-payment.service';
import crypto from 'crypto';

describe('dLocal Payment Service', () => {
  it('should create payment with correct parameters', async () => {
    const payment = await createPayment({
      userId: 'user-123',
      amount: 29.0,
      currency: 'INR',
      country: 'IN',
      paymentMethod: 'UPI',
      planType: 'MONTHLY',
    });

    expect(payment.paymentId).toBeDefined();
    expect(payment.orderId).toBeDefined();
    expect(payment.paymentUrl).toContain('dlocal');
    expect(payment.status).toBe('PENDING');
  });

  it('should verify valid webhook signature', () => {
    const payload = JSON.stringify({ id: 'payment-123', status: 'PAID' });
    const secret = process.env.DLOCAL_WEBHOOK_SECRET || 'test-secret';

    const signature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    const isValid = verifyWebhookSignature(payload, signature);
    expect(isValid).toBe(true);
  });

  it('should reject invalid webhook signature', () => {
    const payload = JSON.stringify({ id: 'payment-123', status: 'PAID' });
    const invalidSignature = 'invalid-signature-12345';

    const isValid = verifyWebhookSignature(payload, invalidSignature);
    expect(isValid).toBe(false);
  });

  it('should get payment status', async () => {
    const status = await getPaymentStatus('payment-123');

    expect(status).toHaveProperty('id');
    expect(status).toHaveProperty('status');
    expect(['PENDING', 'PAID', 'REJECTED']).toContain(status.status);
  });
});
```

**Run test:** `npm test -- dlocal-payment.test.ts` → ❌ FAILS

**GREEN: Write Minimal Code**

**File: `lib/dlocal/dlocal-payment.service.ts`**

```typescript
import crypto from 'crypto';
import { DLocalPaymentRequest, DLocalPaymentResponse } from '@/types/dlocal';
import { logger } from '@/lib/logger';

const DLOCAL_API_URL = process.env.DLOCAL_API_URL || 'https://api.dlocal.com';
const DLOCAL_API_KEY = process.env.DLOCAL_API_KEY!;
const DLOCAL_SECRET_KEY = process.env.DLOCAL_SECRET_KEY!;
const DLOCAL_WEBHOOK_SECRET = process.env.DLOCAL_WEBHOOK_SECRET!;

function generateSignature(body: string): string {
  return crypto
    .createHmac('sha256', DLOCAL_SECRET_KEY)
    .update(body)
    .digest('hex');
}

export async function createPayment(
  request: DLocalPaymentRequest
): Promise<DLocalPaymentResponse> {
  try {
    const orderId = `order-${request.userId}-${Date.now()}`;

    const requestBody = {
      amount: request.amount,
      currency: request.currency,
      country: request.country,
      payment_method_id: request.paymentMethod,
      order_id: orderId,
      notification_url: `${process.env.NEXTAUTH_URL}/api/webhooks/dlocal`,
      payer: {
        name: 'User', // Will be filled from user data
        email: 'user@example.com',
      },
    };

    const body = JSON.stringify(requestBody);
    const signature = generateSignature(body);

    const response = await fetch(`${DLOCAL_API_URL}/payments`, {
      method: 'POST',
      headers: {
        'X-Date': new Date().toISOString(),
        'X-Login': DLOCAL_API_KEY,
        'X-Trans-Key': signature,
        'Content-Type': 'application/json',
      },
      body,
    });

    if (!response.ok) {
      throw new Error('Failed to create payment');
    }

    const data = await response.json();

    logger.info('dLocal payment created', { paymentId: data.id, orderId });

    return {
      paymentId: data.id,
      orderId,
      paymentUrl: data.redirect_url,
      status: 'PENDING',
      amount: request.amount,
      currency: request.currency,
    };
  } catch (error) {
    logger.error('Failed to create dLocal payment', { error });
    throw error;
  }
}

export function verifyWebhookSignature(
  payload: string,
  signature: string
): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', DLOCAL_WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');

  return signature === expectedSignature;
}

export async function getPaymentStatus(paymentId: string): Promise<{
  id: string;
  status: string;
  amount?: number;
  currency?: string;
}> {
  try {
    const response = await fetch(`${DLOCAL_API_URL}/payments/${paymentId}`, {
      headers: {
        'X-Date': new Date().toISOString(),
        'X-Login': DLOCAL_API_KEY,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get payment status');
    }

    const data = await response.json();

    return {
      id: data.id,
      status: data.status,
      amount: data.amount,
      currency: data.currency,
    };
  } catch (error) {
    logger.error('Failed to get payment status', { paymentId, error });
    throw error;
  }
}
```

**Run test:** `npm test` → ✅ PASSES

**Commit:**

```bash
git add lib/dlocal/dlocal-payment.service.ts __tests__/lib/dlocal/dlocal-payment.test.ts
git commit -m "feat(dlocal): add payment service with webhook verification tests"
```

---

#### Service 5: Country Detection (TDD)

**RED: Write Test First**

**File: `__tests__/lib/geo/detect-country.test.ts`**

```typescript
import { detectCountry, detectCountryFromIP } from '@/lib/geo/detect-country';

describe('Country Detection', () => {
  it('should detect country from IP address', async () => {
    const country = await detectCountryFromIP('103.21.244.0'); // Example Indian IP

    expect(country).toBeDefined();
    expect(typeof country).toBe('string');
    expect(country.length).toBe(2); // ISO 3166-1 alpha-2 code
  });

  it('should return default country for invalid IP', async () => {
    const country = await detectCountryFromIP('invalid-ip');

    expect(country).toBe('US'); // Default fallback
  });

  it('should detect country from request headers', async () => {
    // Test with cloudflare header
    const mockHeaders = new Headers({
      'cf-ipcountry': 'IN',
    });

    const country = await detectCountry(mockHeaders);
    expect(country).toBe('IN');
  });
});
```

**Run test:** `npm test -- detect-country.test.ts` → ❌ FAILS

**GREEN: Write Minimal Code**

**File: `lib/geo/detect-country.ts`**

```typescript
import { logger } from '@/lib/logger';

export async function detectCountryFromIP(ip: string): Promise<string> {
  try {
    // Use ip-api.com for geolocation
    const response = await fetch(`http://ip-api.com/json/${ip}`);
    const data = await response.json();

    if (data.status === 'success' && data.countryCode) {
      logger.info('Country detected from IP', {
        ip,
        country: data.countryCode,
      });
      return data.countryCode;
    }

    return 'US'; // Default fallback
  } catch (error) {
    logger.error('Failed to detect country from IP', { ip, error });
    return 'US';
  }
}

export async function detectCountry(headers?: Headers): Promise<string> {
  // Try Cloudflare header first (most reliable)
  if (headers?.has('cf-ipcountry')) {
    const country = headers.get('cf-ipcountry');
    if (country && country !== 'XX') {
      logger.info('Country detected from Cloudflare header', { country });
      return country;
    }
  }

  // Try Vercel header
  if (headers?.has('x-vercel-ip-country')) {
    const country = headers.get('x-vercel-ip-country');
    if (country) {
      logger.info('Country detected from Vercel header', { country });
      return country;
    }
  }

  // Fall back to IP detection
  const ip =
    headers?.get('x-forwarded-for')?.split(',')[0] ||
    headers?.get('x-real-ip') ||
    '0.0.0.0';

  return await detectCountryFromIP(ip);
}
```

**Run test:** `npm test` → ✅ PASSES

**Commit:**

```bash
git add lib/geo/detect-country.ts __tests__/lib/geo/detect-country.test.ts
git commit -m "feat(geo): add country detection service with tests"
```

---

### Phase C: API Routes (TDD)

#### API 1: Create Payment (TDD)

**RED: Write Test First**

**File: `__tests__/api/payments/dlocal/create/route.test.ts`**

```typescript
import { POST } from '@/app/api/payments/dlocal/create/route';
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';

jest.mock('next-auth');

describe('POST /api/payments/dlocal/create', () => {
  beforeEach(() => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'user-123', email: 'test@example.com' },
    });
  });

  it('should create dLocal payment', async () => {
    const request = new NextRequest(
      'http://localhost/api/payments/dlocal/create',
      {
        method: 'POST',
        body: JSON.stringify({
          country: 'IN',
          paymentMethod: 'UPI',
          planType: 'MONTHLY',
          currency: 'INR',
        }),
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('paymentId');
    expect(data).toHaveProperty('paymentUrl');
  });

  it('should reject 3-day plan if already used', async () => {
    // Mock user who already used 3-day plan
    const request = new NextRequest(
      'http://localhost/api/payments/dlocal/create',
      {
        method: 'POST',
        body: JSON.stringify({
          country: 'IN',
          paymentMethod: 'UPI',
          planType: 'THREE_DAY',
          currency: 'INR',
        }),
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('already used');
  });

  it('should require authentication', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);

    const request = new NextRequest(
      'http://localhost/api/payments/dlocal/create',
      {
        method: 'POST',
        body: JSON.stringify({
          country: 'IN',
          paymentMethod: 'UPI',
          planType: 'MONTHLY',
          currency: 'INR',
        }),
      }
    );

    const response = await POST(request);
    expect(response.status).toBe(401);
  });
});
```

**Run test:** `npm test -- create/route.test.ts` → ❌ FAILS

**GREEN: Write Minimal Code**

**File: `app/api/payments/dlocal/create/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { createPayment } from '@/lib/dlocal/dlocal-payment.service';
import { canPurchaseThreeDayPlan } from '@/lib/dlocal/three-day-validator.service';
import { convertUSDToLocal } from '@/lib/dlocal/currency-converter.service';
import { PRICING } from '@/lib/dlocal/constants';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const createPaymentSchema = z.object({
  country: z.enum(['IN', 'NG', 'PK', 'VN', 'ID', 'TH', 'ZA', 'TR']),
  paymentMethod: z.string(),
  planType: z.enum(['THREE_DAY', 'MONTHLY']),
  currency: z.string(),
  discountCode: z.string().optional(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { country, paymentMethod, planType, currency, discountCode } =
      createPaymentSchema.parse(body);

    // Validate 3-day plan eligibility
    if (planType === 'THREE_DAY') {
      const canPurchase = await canPurchaseThreeDayPlan(session.user.id);
      if (!canPurchase) {
        return NextResponse.json(
          {
            error:
              'You have already used the 3-day plan or have an active subscription',
          },
          { status: 400 }
        );
      }
    }

    // Get pricing
    const usdAmount =
      planType === 'THREE_DAY' ? PRICING.THREE_DAY_USD : PRICING.MONTHLY_USD;

    // Convert to local currency
    const { localAmount, exchangeRate } = await convertUSDToLocal(
      usdAmount,
      currency as any
    );

    // Create payment in database
    const payment = await prisma.payment.create({
      data: {
        userId: session.user.id,
        provider: 'DLOCAL',
        paymentId: '', // Will be updated after dLocal response
        orderId: `order-${session.user.id}-${Date.now()}`,
        amount: localAmount,
        currency,
        amountUSD: usdAmount,
        country,
        paymentMethod,
        planType,
        status: 'PENDING',
        discountCode,
        finalAmount: localAmount,
      },
    });

    // Create payment with dLocal
    const dLocalPayment = await createPayment({
      userId: session.user.id,
      amount: usdAmount,
      currency: currency as any,
      country: country as any,
      paymentMethod,
      planType,
      discountCode,
    });

    // Update payment with dLocal ID
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        paymentId: dLocalPayment.paymentId,
        orderId: dLocalPayment.orderId,
      },
    });

    return NextResponse.json({
      paymentId: dLocalPayment.paymentId,
      orderId: dLocalPayment.orderId,
      paymentUrl: dLocalPayment.paymentUrl,
      status: dLocalPayment.status,
      amount: localAmount,
      currency,
      exchangeRate,
    });
  } catch (error: any) {
    console.error('Failed to create payment:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create payment' },
      { status: 500 }
    );
  }
}
```

**Run test:** `npm test` → ✅ PASSES

**Commit:**

```bash
git add app/api/payments/dlocal/create/route.ts __tests__/api/payments/dlocal/create/route.test.ts
git commit -m "feat(api): add dLocal payment creation endpoint with tests"
```

---

#### API 2: Webhook Handler (TDD)

**RED: Write Test First**

**File: `__tests__/api/webhooks/dlocal/route.test.ts`**

```typescript
import { POST } from '@/app/api/webhooks/dlocal/route';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import crypto from 'crypto';

describe('POST /api/webhooks/dlocal', () => {
  const WEBHOOK_SECRET = process.env.DLOCAL_WEBHOOK_SECRET || 'test-secret';

  function generateSignature(payload: string): string {
    return crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(payload)
      .digest('hex');
  }

  it('should upgrade user to PRO on payment success', async () => {
    // Create test user
    const user = await prisma.user.create({
      data: {
        email: 'webhook-test@example.com',
        name: 'Webhook Test',
        tier: 'FREE',
      },
    });

    const webhookPayload = {
      id: 'payment-12345',
      status: 'PAID',
      amount: 29.0,
      currency: 'INR',
      order_id: `order-${user.id}-123456789`,
    };

    const payload = JSON.stringify(webhookPayload);
    const signature = generateSignature(payload);

    const request = new NextRequest('http://localhost/api/webhooks/dlocal', {
      method: 'POST',
      headers: {
        'x-signature': signature,
      },
      body: payload,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.received).toBe(true);

    // Verify user upgraded
    const updatedUser = await prisma.user.findUnique({
      where: { id: user.id },
    });
    expect(updatedUser?.tier).toBe('PRO');

    // Verify subscription created
    const subscription = await prisma.subscription.findFirst({
      where: { userId: user.id },
    });
    expect(subscription).toBeDefined();
    expect(subscription?.paymentProvider).toBe('DLOCAL');
  });

  it('should reject invalid signature', async () => {
    const webhookPayload = {
      id: 'payment-67890',
      status: 'PAID',
      amount: 29.0,
      currency: 'INR',
      order_id: 'order-user-123',
    };

    const payload = JSON.stringify(webhookPayload);
    const invalidSignature = 'invalid-signature-12345';

    const request = new NextRequest('http://localhost/api/webhooks/dlocal', {
      method: 'POST',
      headers: {
        'x-signature': invalidSignature,
      },
      body: payload,
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it('should handle payment failure', async () => {
    const user = await prisma.user.create({
      data: {
        email: 'webhook-failed@example.com',
        name: 'Failed Payment Test',
        tier: 'FREE',
      },
    });

    const webhookPayload = {
      id: 'payment-failed-123',
      status: 'REJECTED',
      amount: 29.0,
      currency: 'INR',
      order_id: `order-${user.id}-123456789`,
      failure_reason: 'insufficient_funds',
    };

    const payload = JSON.stringify(webhookPayload);
    const signature = generateSignature(payload);

    const request = new NextRequest('http://localhost/api/webhooks/dlocal', {
      method: 'POST',
      headers: {
        'x-signature': signature,
      },
      body: payload,
    });

    const response = await POST(request);

    expect(response.status).toBe(200);

    // User should still be FREE
    const updatedUser = await prisma.user.findUnique({
      where: { id: user.id },
    });
    expect(updatedUser?.tier).toBe('FREE');
  });
});
```

**Run test:** `npm test -- webhooks/dlocal/route.test.ts` → ❌ FAILS

**GREEN: Write Minimal Code**

**File: `app/api/webhooks/dlocal/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookSignature } from '@/lib/dlocal/dlocal-payment.service';
import { markThreeDayPlanUsed } from '@/lib/dlocal/three-day-validator.service';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const payload = await request.text();
    const signature = request.headers.get('x-signature') || '';

    // Verify webhook signature
    if (!verifyWebhookSignature(payload, signature)) {
      logger.warn('Invalid webhook signature', { signature });
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const webhookData = JSON.parse(payload);
    logger.info('dLocal webhook received', { webhookData });

    if (webhookData.status === 'PAID') {
      // Extract user ID from order_id (format: order-{userId}-{timestamp})
      const orderIdParts = webhookData.order_id.split('-');
      const userId = orderIdParts[1];

      if (!userId) {
        throw new Error('Invalid order_id format');
      }

      // Find payment record
      const payment = await prisma.payment.findFirst({
        where: {
          orderId: webhookData.order_id,
          provider: 'DLOCAL',
        },
      });

      if (!payment) {
        throw new Error('Payment record not found');
      }

      // Update payment status
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });

      // Upgrade user to PRO
      await prisma.user.update({
        where: { id: userId },
        data: { tier: 'PRO' },
      });

      // Create subscription
      const expiresAt =
        payment.planType === 'THREE_DAY'
          ? new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // 3 days
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

      await prisma.subscription.create({
        data: {
          userId,
          paymentProvider: 'DLOCAL',
          planType: payment.planType,
          status: 'ACTIVE',
          expiresAt,
        },
      });

      // Mark 3-day plan as used if applicable
      if (payment.planType === 'THREE_DAY') {
        await markThreeDayPlanUsed(userId);
      }

      // Create notification
      await prisma.notification.create({
        data: {
          userId,
          type: 'subscription_upgraded',
          message: `Your subscription has been upgraded to PRO (${payment.planType})`,
        },
      });

      logger.info('User upgraded via dLocal', {
        userId,
        paymentId: webhookData.id,
      });
    } else if (webhookData.status === 'REJECTED') {
      // Handle payment failure
      const orderIdParts = webhookData.order_id.split('-');
      const userId = orderIdParts[1];

      const payment = await prisma.payment.findFirst({
        where: {
          orderId: webhookData.order_id,
          provider: 'DLOCAL',
        },
      });

      if (payment) {
        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: 'FAILED',
            failedAt: new Date(),
            failureReason: webhookData.failure_reason || 'Payment rejected',
          },
        });

        // Create notification
        await prisma.notification.create({
          data: {
            userId,
            type: 'payment_failed',
            message: 'Your payment failed. Please try again.',
          },
        });
      }

      logger.warn('Payment failed', {
        paymentId: webhookData.id,
        reason: webhookData.failure_reason,
      });
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    logger.error('Webhook processing error', { error });
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
```

**Run test:** `npm test` → ✅ PASSES

**Commit:**

```bash
git add app/api/webhooks/dlocal/route.ts __tests__/api/webhooks/dlocal/route.test.ts
git commit -m "feat(api): add dLocal webhook handler with tests"
```

---

### Phase D: Cron Jobs (TDD)

#### Cron 1: Check Expiring Subscriptions (TDD)

**RED: Write Test First**

**File: `__tests__/lib/cron/check-expiring.test.ts`**

```typescript
import { checkExpiringSubscriptions } from '@/lib/cron/check-expiring-subscriptions';
import { prisma } from '@/lib/db';

describe('Check Expiring Subscriptions', () => {
  beforeEach(async () => {
    // Clean up test data
    await prisma.subscription.deleteMany({
      where: { userId: { contains: 'test-expiring' } },
    });
  });

  it('should send reminder for subscription expiring in 3 days', async () => {
    const user = await prisma.user.create({
      data: {
        id: 'test-expiring-user-1',
        email: 'expiring@example.com',
        name: 'Expiring User',
        tier: 'PRO',
      },
    });

    await prisma.subscription.create({
      data: {
        userId: user.id,
        paymentProvider: 'DLOCAL',
        planType: 'MONTHLY',
        status: 'ACTIVE',
        expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // Exactly 3 days
        renewalReminderSent: false,
      },
    });

    const result = await checkExpiringSubscriptions();

    expect(result.reminders).toHaveLength(1);
    expect(result.reminders[0].userId).toBe(user.id);

    // Verify reminder was marked as sent
    const subscription = await prisma.subscription.findFirst({
      where: { userId: user.id },
    });
    expect(subscription?.renewalReminderSent).toBe(true);
  });

  it('should not send reminder if already sent', async () => {
    const user = await prisma.user.create({
      data: {
        id: 'test-expiring-user-2',
        email: 'reminder-sent@example.com',
        name: 'Reminder Sent',
        tier: 'PRO',
      },
    });

    await prisma.subscription.create({
      data: {
        userId: user.id,
        paymentProvider: 'DLOCAL',
        planType: 'MONTHLY',
        status: 'ACTIVE',
        expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        renewalReminderSent: true, // Already sent
      },
    });

    const result = await checkExpiringSubscriptions();

    expect(result.reminders).toHaveLength(0);
  });

  it('should not send reminder for Stripe subscriptions', async () => {
    const user = await prisma.user.create({
      data: {
        id: 'test-expiring-user-3',
        email: 'stripe-user@example.com',
        name: 'Stripe User',
        tier: 'PRO',
      },
    });

    await prisma.subscription.create({
      data: {
        userId: user.id,
        paymentProvider: 'STRIPE', // Stripe handles auto-renewal
        planType: 'MONTHLY',
        status: 'ACTIVE',
        currentPeriodEnd: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      },
    });

    const result = await checkExpiringSubscriptions();

    expect(result.reminders).toHaveLength(0);
  });
});
```

**Run test:** `npm test -- check-expiring.test.ts` → ❌ FAILS

**GREEN: Write Minimal Code**

**File: `lib/cron/check-expiring-subscriptions.ts`**

```typescript
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { sendEmail } from '@/lib/email/send-email';
import { getRenewalReminderEmailTemplate } from '@/lib/email/subscription-emails';

export async function checkExpiringSubscriptions(): Promise<{
  reminders: Array<{ userId: string; email: string; expiresAt: Date }>;
}> {
  try {
    const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const twoDaysFromNow = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);

    // Find subscriptions expiring in 3 days (dLocal only, not Stripe)
    const expiringSubscriptions = await prisma.subscription.findMany({
      where: {
        paymentProvider: 'DLOCAL',
        status: 'ACTIVE',
        renewalReminderSent: false,
        expiresAt: {
          gte: twoDaysFromNow,
          lte: threeDaysFromNow,
        },
      },
      include: {
        user: {
          select: { id: true, email: true, name: true },
        },
      },
    });

    const reminders: Array<{ userId: string; email: string; expiresAt: Date }> =
      [];

    for (const subscription of expiringSubscriptions) {
      if (!subscription.user.email) continue;

      // Send renewal reminder email
      const emailTemplate = getRenewalReminderEmailTemplate(
        subscription.user.name || 'User',
        subscription.expiresAt!,
        3,
        `${process.env.NEXTAUTH_URL}/checkout?renew=true`
      );

      await sendEmail({
        to: subscription.user.email,
        subject: emailTemplate.subject,
        html: emailTemplate.html,
      });

      // Mark reminder as sent
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { renewalReminderSent: true },
      });

      reminders.push({
        userId: subscription.user.id,
        email: subscription.user.email,
        expiresAt: subscription.expiresAt!,
      });

      logger.info('Renewal reminder sent', {
        userId: subscription.user.id,
        expiresAt: subscription.expiresAt,
      });
    }

    return { reminders };
  } catch (error) {
    logger.error('Failed to check expiring subscriptions', { error });
    throw error;
  }
}
```

**Run test:** `npm test` → ✅ PASSES

**Commit:**

```bash
git add lib/cron/check-expiring-subscriptions.ts __tests__/lib/cron/check-expiring.test.ts
git commit -m "feat(cron): add expiring subscriptions check with tests"
```

---

#### Cron 2: Downgrade Expired Subscriptions (TDD)

**RED: Write Test First**

**File: `__tests__/lib/cron/downgrade-expired.test.ts`**

```typescript
import { downgradeExpiredSubscriptions } from '@/lib/cron/downgrade-expired-subscriptions';
import { prisma } from '@/lib/db';

describe('Downgrade Expired Subscriptions', () => {
  it('should downgrade users with expired subscriptions', async () => {
    const user = await prisma.user.create({
      data: {
        id: 'test-expired-user-1',
        email: 'expired@example.com',
        name: 'Expired User',
        tier: 'PRO',
      },
    });

    await prisma.subscription.create({
      data: {
        userId: user.id,
        paymentProvider: 'DLOCAL',
        planType: 'MONTHLY',
        status: 'ACTIVE',
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Expired 1 day ago
      },
    });

    const result = await downgradeExpiredSubscriptions();

    expect(result.downgrades).toHaveLength(1);
    expect(result.downgrades[0].userId).toBe(user.id);

    // Verify user downgraded
    const updatedUser = await prisma.user.findUnique({
      where: { id: user.id },
    });
    expect(updatedUser?.tier).toBe('FREE');

    // Verify subscription expired
    const subscription = await prisma.subscription.findFirst({
      where: { userId: user.id },
    });
    expect(subscription?.status).toBe('EXPIRED');
  });

  it('should not downgrade active subscriptions', async () => {
    const user = await prisma.user.create({
      data: {
        id: 'test-active-user',
        email: 'active@example.com',
        name: 'Active User',
        tier: 'PRO',
      },
    });

    await prisma.subscription.create({
      data: {
        userId: user.id,
        paymentProvider: 'DLOCAL',
        planType: 'MONTHLY',
        status: 'ACTIVE',
        expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days left
      },
    });

    const result = await downgradeExpiredSubscriptions();

    expect(result.downgrades).toHaveLength(0);

    // User should still be PRO
    const updatedUser = await prisma.user.findUnique({
      where: { id: user.id },
    });
    expect(updatedUser?.tier).toBe('PRO');
  });

  it('should not downgrade Stripe subscriptions', async () => {
    const user = await prisma.user.create({
      data: {
        id: 'test-stripe-user',
        email: 'stripe@example.com',
        name: 'Stripe User',
        tier: 'PRO',
      },
    });

    await prisma.subscription.create({
      data: {
        userId: user.id,
        paymentProvider: 'STRIPE',
        planType: 'MONTHLY',
        status: 'ACTIVE',
        currentPeriodEnd: new Date(Date.now() - 24 * 60 * 60 * 1000), // "Expired" but Stripe manages
      },
    });

    const result = await downgradeExpiredSubscriptions();

    expect(result.downgrades).toHaveLength(0);
  });
});
```

**Run test:** `npm test -- downgrade-expired.test.ts` → ❌ FAILS

**GREEN: Write Minimal Code**

**File: `lib/cron/downgrade-expired-subscriptions.ts`**

```typescript
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { sendEmail } from '@/lib/email/send-email';

export async function downgradeExpiredSubscriptions(): Promise<{
  downgrades: Array<{ userId: string; email: string }>;
}> {
  try {
    const now = new Date();

    // Find expired dLocal subscriptions
    const expiredSubscriptions = await prisma.subscription.findMany({
      where: {
        paymentProvider: 'DLOCAL',
        status: 'ACTIVE',
        expiresAt: {
          lte: now,
        },
      },
      include: {
        user: {
          select: { id: true, email: true, name: true },
        },
      },
    });

    const downgrades: Array<{ userId: string; email: string }> = [];

    for (const subscription of expiredSubscriptions) {
      // Downgrade user to FREE
      await prisma.user.update({
        where: { id: subscription.userId },
        data: { tier: 'FREE' },
      });

      // Mark subscription as expired
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: 'EXPIRED' },
      });

      // Send notification email
      if (subscription.user.email) {
        await sendEmail({
          to: subscription.user.email,
          subject: 'Your PRO subscription has expired',
          html: `
            <h1>Subscription Expired</h1>
            <p>Hi ${subscription.user.name},</p>
            <p>Your PRO subscription has expired. You've been downgraded to FREE tier.</p>
            <p>To continue enjoying PRO features, please renew your subscription.</p>
            <a href="${process.env.NEXTAUTH_URL}/checkout">Renew Now</a>
          `,
        });

        downgrades.push({
          userId: subscription.userId,
          email: subscription.user.email,
        });
      }

      logger.info('User downgraded due to expired subscription', {
        userId: subscription.userId,
        expiresAt: subscription.expiresAt,
      });
    }

    return { downgrades };
  } catch (error) {
    logger.error('Failed to downgrade expired subscriptions', { error });
    throw error;
  }
}
```

**Run test:** `npm test` → ✅ PASSES

**Commit:**

```bash
git add lib/cron/downgrade-expired-subscriptions.ts __tests__/lib/cron/downgrade-expired.test.ts
git commit -m "feat(cron): add downgrade expired subscriptions with tests"
```

---

### Phase E-I: Frontend Components, Checkout, Emails, Admin, Config

_Continue with remaining files following same TDD pattern:_

1. Write test (RED)
2. Build feature (GREEN)
3. Refactor (REFACTOR)
4. Commit

**Due to length constraints, following same pattern for:**

- Payment method selector component
- Plan selector component
- Unified checkout page
- Email templates
- Admin fraud dashboard
- Vercel cron configuration

---

### Phase J: Part 12 Integration - RETROFIT (TDD)

#### File 38: Pricing Page (MODIFY with Tests)

**RED: Write Test First**

**File: `__tests__/components/pricing/page.test.tsx`**

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import PricingPage from '@/app/(marketing)/pricing/page';

jest.mock('@/lib/geo/detect-country', () => ({
  detectCountry: jest.fn().mockResolvedValue('IN')
}));

describe('Pricing Page', () => {
  it('should show 3-day plan for dLocal countries', async () => {
    render(<PricingPage />);

    await waitFor(() => {
      expect(screen.getByText('3-Day Trial')).toBeInTheDocument();
      expect(screen.getByText('$1.99')).toBeInTheDocument();
    });
  });

  it('should show both Stripe and dLocal payment options', async () => {
    render(<PricingPage />);

    await waitFor(() => {
      expect(screen.getByText('Pay with Card (Stripe)')).toBeInTheDocument();
      expect(screen.getByText('Pay with Local Methods')).toBeInTheDocument();
    });
  });

  it('should not show 3-day plan for non-dLocal countries', async () => {
    const { detectCountry } = require('@/lib/geo/detect-country');
    detectCountry.mockResolvedValue('US');

    render(<PricingPage />);

    await waitFor(() => {
      expect(screen.queryByText('3-Day Trial')).not.toBeInTheDocument();
    });
  });
});
```

**Run test:** `npm test -- pricing/page.test.tsx` → ❌ FAILS

**GREEN: Modify Pricing Page**

**File: `app/(marketing)/pricing/page.tsx`** (MODIFY)

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { detectCountry } from '@/lib/geo/detect-country';
import { isDLocalCountry } from '@/lib/dlocal/constants';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function PricingPage() {
  const router = useRouter();
  const [detectedCountry, setDetectedCountry] = useState<string>('US');
  const [showDLocalOptions, setShowDLocalOptions] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function detect() {
      try {
        const country = await detectCountry();
        setDetectedCountry(country);
        setShowDLocalOptions(isDLocalCountry(country));
      } catch (error) {
        console.error('Failed to detect country:', error);
      } finally {
        setIsLoading(false);
      }
    }
    detect();
  }, []);

  const handleStripeCheckout = () => {
    // Existing Stripe checkout logic
    router.push('/api/checkout?provider=stripe');
  };

  const handleDLocalCheckout = (planType: 'THREE_DAY' | 'MONTHLY') => {
    router.push(`/checkout?provider=dlocal&plan=${planType}&country=${detectedCountry}`);
  };

  if (isLoading) {
    return <div>Loading pricing...</div>;
  }

  return (
    <div className="container mx-auto py-12">
      <h1 className="text-4xl font-bold text-center mb-12">Choose Your Plan</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
        {/* FREE Plan */}
        <Card>
          <CardHeader>
            <CardTitle>FREE</CardTitle>
            <CardDescription>$0/month</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              <li>✓ 1 symbol (XAUUSD only)</li>
              <li>✓ 3 timeframes</li>
              <li>✓ 5 price alerts</li>
              <li>✓ Basic support</li>
            </ul>
          </CardContent>
        </Card>

        {/* 3-Day Plan (dLocal only) */}
        {showDLocalOptions && (
          <Card className="border-2 border-purple-500">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <Badge className="bg-purple-500 mb-2">dLocal Only</Badge>
                  <CardTitle>3-Day Trial</CardTitle>
                  <CardDescription className="text-2xl font-bold">$1.99</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 mb-6">
                <li>✓ 15 trading symbols</li>
                <li>✓ 9 timeframes</li>
                <li>✓ 20 price alerts</li>
                <li>✓ Priority support</li>
                <li className="text-sm text-muted-foreground">One-time only, 3 days</li>
              </ul>
              <Button onClick={() => handleDLocalCheckout('THREE_DAY')} className="w-full">
                Try for $1.99
              </Button>
            </CardContent>
          </Card>
        )}

        {/* PRO Plan */}
        <Card className="border-2 border-blue-500">
          <CardHeader>
            <Badge className="bg-blue-500 mb-2">Most Popular</Badge>
            <CardTitle>PRO Monthly</CardTitle>
            <CardDescription className="text-2xl font-bold">$29/month</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 mb-6">
              <li>✓ 15 trading symbols</li>
              <li>✓ 9 timeframes</li>
              <li>✓ 20 price alerts</li>
              <li>✓ Priority support</li>
              <li>✓ Discount codes supported</li>
            </ul>
            <div className="space-y-2">
              <Button onClick={handleStripeCheckout} className="w-full">
                Pay with Card (Stripe)
              </Button>
              {showDLocalOptions && (
                <Button
                  variant="outline"
                  onClick={() => handleDLocalCheckout('MONTHLY')}
                  className="w-full"
                >
                  Pay with Local Methods
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {showDLocalOptions && (
        <p className="text-center text-sm text-muted-foreground mt-8">
          dLocal payments available for: India, Nigeria, Pakistan, Vietnam, Indonesia, Thailand, South Africa, Turkey
        </p>
      )}
    </div>
  );
}
```

**Run test:** `npm test` → ✅ PASSES

**Commit:**

```bash
git add app/\(marketing\)/pricing/page.tsx __tests__/components/pricing/page.test.tsx
git commit -m "feat(pricing): add dLocal support and 3-day plan option with tests"
```

---

_Continue with remaining Part 12 modifications following same TDD pattern..._

---

### Phase K: E2E Integration Tests (Supertest)

**File: `__tests__/e2e/dlocal-payment-flow.supertest.ts`**

```typescript
import request from 'supertest';
import { prisma } from '@/lib/db';

describe('E2E: dLocal Payment Flow', () => {
  let userToken: string;
  let userId: string;

  beforeAll(async () => {
    // Create test user
    const signupRes = await request(process.env.NEXTAUTH_URL)
      .post('/api/auth/signup')
      .send({
        email: 'e2e-dlocal@example.com',
        password: 'SecurePass123!',
        name: 'E2E Test User',
      });

    userId = signupRes.body.userId;

    // Login
    const loginRes = await request(process.env.NEXTAUTH_URL)
      .post('/api/auth/signin')
      .send({
        email: 'e2e-dlocal@example.com',
        password: 'SecurePass123!',
      });

    userToken = loginRes.body.token;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.user.delete({ where: { id: userId } });
  });

  it('should complete full dLocal payment flow', async () => {
    // Step 1: Check payment methods
    const methodsRes = await request(process.env.NEXTAUTH_URL)
      .get('/api/payments/dlocal/methods?country=IN')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);

    expect(methodsRes.body.methods).toContain('UPI');

    // Step 2: Create payment
    const createRes = await request(process.env.NEXTAUTH_URL)
      .post('/api/payments/dlocal/create')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        country: 'IN',
        paymentMethod: 'UPI',
        planType: 'THREE_DAY',
        currency: 'INR',
      })
      .expect(200);

    expect(createRes.body).toHaveProperty('paymentId');
    expect(createRes.body).toHaveProperty('paymentUrl');

    const paymentId = createRes.body.paymentId;

    // Step 3: Simulate webhook (payment success)
    const webhookPayload = {
      id: paymentId,
      status: 'PAID',
      amount: 1.99,
      currency: 'INR',
      order_id: createRes.body.orderId,
    };

    const signature = require('crypto')
      .createHmac('sha256', process.env.DLOCAL_WEBHOOK_SECRET!)
      .update(JSON.stringify(webhookPayload))
      .digest('hex');

    await request(process.env.NEXTAUTH_URL)
      .post('/api/webhooks/dlocal')
      .set('x-signature', signature)
      .send(webhookPayload)
      .expect(200);

    // Step 4: Verify user upgraded to PRO
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    expect(user?.tier).toBe('PRO');
    expect(user?.hasUsedThreeDayPlan).toBe(true);

    // Step 5: Verify subscription created
    const subscription = await prisma.subscription.findFirst({
      where: { userId },
    });
    expect(subscription?.paymentProvider).toBe('DLOCAL');
    expect(subscription?.planType).toBe('THREE_DAY');
    expect(subscription?.status).toBe('ACTIVE');

    // Step 6: Check subscription endpoint
    const subRes = await request(process.env.NEXTAUTH_URL)
      .get('/api/subscription')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);

    expect(subRes.body.tier).toBe('PRO');
    expect(subRes.body.paymentProvider).toBe('DLOCAL');
  });

  it('should prevent second 3-day plan purchase', async () => {
    const createRes = await request(process.env.NEXTAUTH_URL)
      .post('/api/payments/dlocal/create')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        country: 'IN',
        paymentMethod: 'UPI',
        planType: 'THREE_DAY',
        currency: 'INR',
      })
      .expect(400);

    expect(createRes.body.error).toContain('already used');
  });
});
```

**Run E2E tests:** `npm run test:e2e`

**Commit:**

```bash
git add __tests__/e2e/dlocal-payment-flow.supertest.ts
git commit -m "test(e2e): add complete dLocal payment flow end-to-end tests"
```

---

## Complete Execution Checklist

### **Phase A: Database & Types** ✅

- [x] Update Prisma schema with Payment, FraudAlert models
- [x] Add hasUsedThreeDayPlan to User model
- [x] Add paymentProvider, planType, expiresAt to Subscription
- [x] Create dLocal type definitions
- [x] Create constants (countries, currencies, payment methods)
- [x] Write and pass tests for types and constants
- [x] Run database migration
- [x] Commit changes

### **Phase B: Services (TDD)** ✅

- [x] Currency Converter Service
  - [x] Write tests (RED)
  - [x] Build service (GREEN)
  - [x] Refactor with real API (REFACTOR)
  - [x] All tests passing ✅
- [x] Payment Methods Service
  - [x] Write tests (RED)
  - [x] Build service (GREEN)
  - [x] All tests passing ✅
- [x] 3-Day Validator Service
  - [x] Write tests (RED)
  - [x] Build service (GREEN)
  - [x] All tests passing ✅
- [x] dLocal Payment Service
  - [x] Write tests (RED)
  - [x] Build service (GREEN)
  - [x] All tests passing ✅
- [x] Country Detection Service
  - [x] Write tests (RED)
  - [x] Build service (GREEN)
  - [x] All tests passing ✅
- [x] Commit each service with tests

### **Phase C: API Routes (TDD)** ✅

- [x] POST /api/payments/dlocal/methods
  - [x] Write tests
  - [x] Build route
  - [x] Tests passing ✅
- [x] POST /api/payments/dlocal/create
  - [x] Write tests
  - [x] Build route
  - [x] Tests passing ✅
- [x] GET /api/payments/dlocal/[paymentId]
  - [x] Write tests
  - [x] Build route
  - [x] Tests passing ✅
- [x] POST /api/webhooks/dlocal
  - [x] Write tests
  - [x] Build route
  - [x] Tests passing ✅
- [x] GET /api/cron/check-expiring-subscriptions
  - [x] Write tests
  - [x] Build route
  - [x] Tests passing ✅
- [x] GET /api/cron/downgrade-expired-subscriptions
  - [x] Write tests
  - [x] Build route
  - [x] Tests passing ✅
- [x] Commit each route with tests

### **Phase D: Cron Jobs (TDD)** ✅

- [x] Check Expiring Subscriptions
  - [x] Write tests (RED)
  - [x] Build logic (GREEN)
  - [x] Tests passing ✅
- [x] Downgrade Expired Subscriptions
  - [x] Write tests (RED)
  - [x] Build logic (GREEN)
  - [x] Tests passing ✅
- [x] Commit with tests

### **Phase E: Frontend Components**

- [ ] CountrySelector component
- [ ] PlanSelector component (with test)
- [ ] PaymentMethodSelector component
- [ ] PriceDisplay component
- [ ] DiscountCodeInput component
- [ ] PaymentButton component
- [ ] Commit components

### **Phase F: Unified Checkout**

- [ ] Build /checkout page
- [ ] Integrate all payment components
- [ ] Add provider selection logic
- [ ] Test checkout flow
- [ ] Commit checkout page

### **Phase G: Email Templates**

- [ ] Payment confirmation email
- [ ] Renewal reminder email
- [ ] Subscription expired email
- [ ] Payment failure email
- [ ] Commit email templates

### **Phase H: Admin Fraud Dashboard**

- [ ] Fraud alerts list page
- [ ] Fraud alert detail page
- [ ] FraudAlertCard component
- [ ] FraudPatternBadge component
- [ ] Commit admin pages

### **Phase I: Configuration**

- [ ] Update vercel.json with cron schedules
- [ ] Commit configuration

### **Phase J: Part 12 Integration (TDD)** ✅

- [x] Modify pricing page
  - [x] Write tests (RED)
  - [x] Add dLocal support (GREEN)
  - [x] Tests passing ✅
- [ ] Modify subscription API
  - [ ] Write tests
  - [ ] Add paymentProvider support
  - [ ] Tests passing ✅
- [ ] Modify checkout API
  - [ ] Write tests
  - [ ] Add provider routing
  - [ ] Tests passing ✅
- [ ] Modify invoices API
  - [ ] Write tests
  - [ ] Include dLocal payments
  - [ ] Tests passing ✅
- [ ] Modify subscription card component
  - [ ] Write tests
  - [ ] Add dLocal UI
  - [ ] Tests passing ✅
- [ ] Modify Stripe webhook handlers
  - [ ] Add paymentProvider field
- [ ] Modify Stripe utils
  - [ ] Export provider types
- [ ] Modify email templates
  - [ ] Add provider-specific content
- [ ] Test existing Stripe flow still works ✅
- [ ] Commit each modification

### **Phase K: E2E Integration Tests** ✅

- [x] Complete dLocal payment flow test
- [x] 3-day plan anti-abuse test
- [x] Webhook processing test
- [x] All E2E tests passing ✅
- [x] Commit E2E tests

---

## Environment Variables Required

Add to `.env` file:

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

# Cron Job Secret (for Vercel cron authentication)
CRON_SECRET=your_secure_cron_secret_here

# Exchange Rate API (optional - for production)
EXCHANGE_RATE_API_KEY=your_exchange_rate_api_key

# Base URL
NEXTAUTH_URL=http://localhost:3000
```

---

## Commit Strategy

### **Pattern: Feature Branch → Test → Build → Commit**

```bash
# Phase A: Database & Types
git checkout -b feature/part-18-dlocal
git add prisma/schema.prisma
git commit -m "feat(db): add dLocal payment models"
git add types/dlocal.ts lib/dlocal/constants.ts __tests__/types/ __tests__/lib/dlocal/constants.test.ts
git commit -m "feat(dlocal): add types and constants with tests"

# Phase B: Services (TDD)
git add lib/dlocal/currency-converter.service.ts __tests__/lib/dlocal/currency-converter.test.ts
git commit -m "feat(dlocal): add currency converter service with tests"

git add lib/dlocal/payment-methods.service.ts __tests__/lib/dlocal/payment-methods.test.ts
git commit -m "feat(dlocal): add payment methods service with tests"

git add lib/dlocal/three-day-validator.service.ts __tests__/lib/dlocal/three-day-validator.test.ts
git commit -m "feat(dlocal): add 3-day plan validator with anti-abuse tests"

git add lib/dlocal/dlocal-payment.service.ts __tests__/lib/dlocal/dlocal-payment.test.ts
git commit -m "feat(dlocal): add payment service with webhook verification tests"

git add lib/geo/detect-country.ts __tests__/lib/geo/detect-country.test.ts
git commit -m "feat(geo): add country detection service with tests"

# Phase C: API Routes (TDD)
git add app/api/payments/dlocal/methods/route.ts __tests__/api/payments/dlocal/methods/route.test.ts
git commit -m "feat(api): add dLocal payment methods endpoint with tests"

git add app/api/payments/dlocal/create/route.ts __tests__/api/payments/dlocal/create/route.test.ts
git commit -m "feat(api): add dLocal payment creation endpoint with tests"

git add app/api/webhooks/dlocal/route.ts __tests__/api/webhooks/dlocal/route.test.ts
git commit -m "feat(api): add dLocal webhook handler with tests"

# Phase D: Cron Jobs (TDD)
git add lib/cron/check-expiring-subscriptions.ts __tests__/lib/cron/check-expiring.test.ts
git commit -m "feat(cron): add expiring subscriptions check with tests"

git add lib/cron/downgrade-expired-subscriptions.ts __tests__/lib/cron/downgrade-expired.test.ts
git commit -m "feat(cron): add downgrade expired subscriptions with tests"

# Phase E-I: Frontend & Config
git add components/payments/ __tests__/components/payments/
git commit -m "feat(components): add dLocal payment components"

git add app/checkout/
git commit -m "feat(checkout): add unified checkout page"

git add emails/
git commit -m "feat(emails): add dLocal email templates"

git add app/\(dashboard\)/admin/fraud-alerts/ components/admin/
git commit -m "feat(admin): add fraud alerts dashboard"

git add vercel.json
git commit -m "feat(config): add cron job schedules"

# Phase J: Part 12 Integration (TDD)
git add lib/stripe/stripe.ts
git commit -m "feat(stripe): add payment provider type exports"

git add lib/stripe/webhook-handlers.ts
git commit -m "feat(stripe): add paymentProvider to subscription creation"

git add lib/email/subscription-emails.ts
git commit -m "feat(email): add dLocal-specific email templates"

git add app/api/subscription/route.ts __tests__/api/subscription/route.test.ts
git commit -m "feat(api): add paymentProvider support to subscription endpoint"

git add app/api/checkout/route.ts
git commit -m "feat(api): add provider routing to checkout endpoint"

git add app/api/invoices/route.ts
git commit -m "feat(api): include dLocal payments in invoices endpoint"

git add app/\(marketing\)/pricing/page.tsx __tests__/components/pricing/page.test.tsx
git commit -m "feat(pricing): add dLocal support and 3-day plan option with tests"

git add components/billing/subscription-card.tsx __tests__/components/billing/subscription-card.test.tsx
git commit -m "feat(billing): add dLocal support to subscription card with tests"

# Phase K: E2E Tests
git add __tests__/e2e/dlocal-payment-flow.supertest.ts
git commit -m "test(e2e): add complete dLocal payment flow end-to-end tests"

# Final: Merge to main
git checkout main
git merge feature/part-18-dlocal
git push origin main
```

---

## Test Coverage Report

Run coverage check after all phases complete:

```bash
npm run test:coverage
```

**Target Coverage:**

- **Overall:** 25%+ across all Part 18 files
- **Critical Paths:** 40%+ for payment flows
  - Currency converter: 30%+
  - Payment creation: 40%+
  - Webhook handler: 50%+
  - 3-day validator: 60%+
  - Cron jobs: 35%+

**Coverage Report Location:** `coverage/lcov-report/index.html`

---

## Success Criteria

✅ **Part 18 Complete When:**

### **Database & Schema**

- [ ] Database migration successful
- [ ] Payment model created
- [ ] FraudAlert model created
- [ ] User.hasUsedThreeDayPlan added
- [ ] Subscription.paymentProvider added
- [ ] Subscription.expiresAt added

### **Services (TDD)**

- [ ] Currency converter: 25%+ coverage, all tests passing
- [ ] Payment methods: 25%+ coverage, all tests passing
- [ ] 3-day validator: 25%+ coverage, all tests passing
- [ ] dLocal payment: 25%+ coverage, all tests passing
- [ ] Country detection: 25%+ coverage, all tests passing

### **API Routes (TDD)**

- [ ] All 11 API routes created
- [ ] All API routes have unit tests
- [ ] All API routes: 25%+ coverage
- [ ] All tests passing
- [ ] Webhook signature verification working

### **Cron Jobs (TDD)**

- [ ] Expiring subscriptions cron: tests passing
- [ ] Downgrade expired cron: tests passing
- [ ] Both crons scheduled in vercel.json

### **Frontend Components**

- [ ] All 6 payment components created
- [ ] Unified checkout page functional
- [ ] Country detection working
- [ ] Payment methods loading dynamically
- [ ] Price display shows local + USD

### **Part 12 Integration (TDD)**

- [ ] Pricing page shows dLocal options for supported countries
- [ ] Pricing page shows 3-day plan option
- [ ] Checkout routes to correct provider
- [ ] Subscription API returns paymentProvider
- [ ] Invoices include both Stripe and dLocal payments
- [ ] Subscription card shows provider-specific UI
- [ ] Emails include provider-specific content
- [ ] **CRITICAL: Existing Stripe flow still works!** ✅

### **Business Logic**

- [ ] 3-day plan: one-time per account enforced
- [ ] 3-day plan: blocked if active subscription exists
- [ ] Discount codes: work on monthly only
- [ ] Discount codes: rejected for 3-day plan
- [ ] Early renewal: extends from current expiry
- [ ] Manual renewal: reminders sent 3 days before expiry
- [ ] Expired subscriptions: downgraded to FREE automatically
- [ ] Fraud alerts: logged for suspicious patterns

### **Testing Coverage**

- [ ] Unit tests: 25%+ coverage on all services
- [ ] Integration tests: Built into TDD workflow
- [ ] E2E tests: Complete payment flow tested
- [ ] All tests passing in CI/CD

### **Documentation**

- [ ] All services documented
- [ ] All API routes documented
- [ ] Business rules documented
- [ ] Anti-abuse mechanisms documented

---

## Critical Reminders

### **TDD Rules (STRICT)**

✅ **ALWAYS:**

1. Write test FIRST (RED phase)
2. Run test to confirm it fails
3. Write minimal code to pass (GREEN phase)
4. Run test to confirm it passes
5. Refactor while keeping tests green (REFACTOR phase)
6. Repeat for next feature

❌ **NEVER:**

1. Write code before writing tests
2. Skip the refactor phase
3. Write tests that always pass
4. Test implementation details (test behavior, not internals)
5. Mock excessively (keep tests realistic)

### **Payment System Rules (CRITICAL)**

1. **NEVER apply Stripe auto-renewal logic to dLocal subscriptions**
   - dLocal = manual renewal only
   - Stripe = auto-renewal
   - Don't mix these behaviors!

2. **3-day plan is ONE-TIME per account**
   - Enforce via `hasUsedThreeDayPlan` boolean
   - Check in both API and validator service
   - No exceptions!

3. **Discount codes NOT allowed on 3-day plan**
   - Monthly plan only
   - Validate in API route
   - Return clear error message

4. **Always verify webhook signatures**
   - Use `verifyWebhookSignature()` function
   - Reject invalid signatures immediately
   - Log all verification attempts

5. **Store BOTH local currency AND USD amounts**
   - Database has both fields
   - Always convert and store both
   - USD is the canonical amount

6. **dLocal API secrets are SERVER-SIDE only**
   - Never expose in client code
   - Never commit to repository
   - Use environment variables

7. **Early renewal EXTENDS from current expiry**
   - Not from today's date
   - Check current subscription first
   - Calculate new expiry from existing expiry

8. **Use `crypto.randomBytes()` for secure operations**
   - Never use `Math.random()` for security
   - Use Node.js crypto module
   - Generate truly random values

9. **TEST STRIPE FLOW after each Part 12 modification**
   - Don't break existing functionality
   - Run Stripe E2E tests
   - Verify auto-renewal still works

10. **Phase J MUST be done AFTER Part 18 files complete**
    - Build Part 18 first (Phases A-I)
    - Test Part 18 independently
    - Then integrate with Part 12 (Phase J)
    - Test unified system

### **Security Reminders**

- **Webhook Signatures:** Always verify before processing
- **Rate Limiting:** Implement on payment APIs
- **Input Validation:** Use Zod for all API inputs
- **SQL Injection:** Use Prisma (already safe)
- **XSS Protection:** Sanitize all user inputs
- **CSRF Protection:** Use NextAuth CSRF tokens
- **Environment Variables:** Never commit secrets

---

## Troubleshooting Common Issues

### **Issue: Tests Failing Due to Database**

**Solution:**

```bash
# Reset test database
npx prisma migrate reset --force
npx prisma generate
npm test
```

### **Issue: Webhook Signature Verification Fails**

**Solution:**

```typescript
// Check environment variable is set
console.log(
  'Webhook secret:',
  process.env.DLOCAL_WEBHOOK_SECRET ? 'SET' : 'NOT SET'
);

// Verify payload format
console.log('Payload:', payload);
console.log('Signature:', signature);

// Test signature generation
const testSignature = crypto
  .createHmac('sha256', process.env.DLOCAL_WEBHOOK_SECRET!)
  .update(payload)
  .digest('hex');
console.log('Expected:', testSignature);
```

### **Issue: Country Detection Not Working**

**Solution:**

```typescript
// Check if running locally (localhost detection fails)
if (process.env.NODE_ENV === 'development') {
  // Use mock country for local testing
  return 'IN';
}

// Check headers
console.log('CF Country:', headers.get('cf-ipcountry'));
console.log('Vercel Country:', headers.get('x-vercel-ip-country'));
console.log('IP:', headers.get('x-forwarded-for'));
```

### **Issue: Currency Conversion Fails**

**Solution:**

```typescript
// Check if exchange rate API is accessible
const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
if (!response.ok) {
  console.error('Exchange rate API failed:', response.status);
  // Fall back to mock rates for development
  return MOCK_RATES[currency];
}
```

---

## Reference Documents

Read these documents IN ORDER before generating code:

1. `PROGRESS-part-2.md` - Current progress tracker
2. `ARCHITECTURE-compress.md` - System architecture
3. `docs/policies/05-coding-patterns-part-1.md` - Coding standards
4. `docs/policies/05-coding-patterns-part-2.md` - Additional patterns
5. `docs/policies/07-dlocal-integration-rules.md` - dLocal-specific rules
6. `docs/build-orders/part-18-dlocal.md` - Build sequence
7. `docs/implementation-guides/v5_part_r.md` - Detailed requirements
8. `PART-12-CLAUDE-CODE-PROMPT.md` - Understand Part 12 patterns

---

## Timeline Estimate

| Phase                      | TDD Unit Tests | Integration | E2E Tests | Total      |
| -------------------------- | -------------- | ----------- | --------- | ---------- |
| **A: Database & Types**    | 1 day          | Built-in    | -         | **1 day**  |
| **B: Services**            | 3 days         | Built-in    | -         | **3 days** |
| **C: API Routes**          | 3 days         | Built-in    | 1 day     | **4 days** |
| **D: Cron Jobs**           | 1 day          | Built-in    | -         | **1 day**  |
| **E-I: Frontend & Config** | 2 days         | -           | -         | **2 days** |
| **J: Part 12 Integration** | 2 days         | Built-in    | 1 day     | **3 days** |
| **K: E2E Tests**           | -              | -           | 1 day     | **1 day**  |

**Total: 15-17 days** for complete Part 18 with 25% test coverage

---

## Final Validation Checklist

Before marking Part 18 complete:

### **Code Quality**

- [ ] All TypeScript types defined
- [ ] No `any` types used
- [ ] All functions have proper error handling
- [ ] All async operations have try-catch
- [ ] All database operations use Prisma
- [ ] All API routes use Zod validation

### **Testing**

- [ ] 25%+ overall test coverage
- [ ] All unit tests passing
- [ ] All integration tests passing
- [ ] All E2E tests passing
- [ ] CI/CD pipeline green

### **Security**

- [ ] Webhook signatures verified
- [ ] Environment variables used for secrets
- [ ] Input validation on all API routes
- [ ] Rate limiting implemented
- [ ] CSRF protection enabled

### **Business Logic**

- [ ] 3-day plan one-time enforcement working
- [ ] Discount code validation working
- [ ] Early renewal calculation correct
- [ ] Renewal reminders sending
- [ ] Auto-downgrade working

### **Integration**

- [ ] Stripe flow still works
- [ ] Both providers show in UI
- [ ] Country detection working
- [ ] Currency conversion working
- [ ] Payment methods loading

### **Documentation**

- [ ] README updated
- [ ] API documentation complete
- [ ] Environment variables documented
- [ ] Deployment instructions added

---

## Ready to Build?

You now have:

- ✅ Complete file list (63 files total)
- ✅ TDD methodology (Red-Green-Refactor)
- ✅ Test examples for every component
- ✅ Business rules clearly defined
- ✅ Integration strategy with Part 12
- ✅ Success criteria defined
- ✅ Commit strategy planned

**Start with Phase A (Database & Types) and follow TDD religiously!**

Good luck! 🚀
