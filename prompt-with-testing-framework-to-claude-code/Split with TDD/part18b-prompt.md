# Part 18B: dLocal Subscription Lifecycle Management (Vertical Slice 2 of 3)

## Overview

**Part:** 18B of 18 (Slice 2 of 3)
**Feature:** Subscription Lifecycle & Part 12 API Integration
**Total Files:** 20 files (15 production + 5 test)
**Complexity:** High
**Dependencies:** Part 18A (MUST be complete), Part 2 (Database), Part 5 (Auth), Part 12 (Stripe)
**Test Coverage Target:** 25% minimum
**Status:** SECOND SLICE - Builds on 18A foundation

---

## Mission Statement

Build the subscription lifecycle management system for dLocal payments using Test-Driven Development (TDD). This slice creates a COMPLETE subscription management feature that validates 3-day plans, handles subscription creation/expiry, sends renewal reminders, and integrates with Part 12's API layer to create a UNIFIED payment system.

---

## What Part 18A Built (Foundation)

### Database Models

- Payment model (complete)
- Notification model (complete)

### Services Available

```typescript
// Currency Converter (READY TO USE)
getExchangeRate(currency: DLocalCurrency): Promise<number>
convertUSDToLocal(usdAmount, currency): Promise<CurrencyConversionResult>

// Payment Methods (READY TO USE)
getPaymentMethodsForCountry(country: DLocalCountry): Promise<string[]>
isValidPaymentMethod(country, method): boolean

// dLocal Payment (READY TO USE)
createPayment(request: DLocalPaymentRequest): Promise<DLocalPaymentResponse>
verifyWebhookSignature(payload, signature, secret?): boolean
getPaymentStatus(paymentId): Promise<PaymentStatusResponse>

// Country Detection (READY TO USE)
detectCountry(headers?: Headers): Promise<string>
detectCountryFromIP(ip): Promise<string>
```

### API Endpoints Available

- GET /api/payments/dlocal/methods
- GET /api/payments/dlocal/exchange-rate
- GET /api/payments/dlocal/convert
- POST /api/payments/dlocal/create
- GET /api/payments/dlocal/[paymentId]
- POST /api/webhooks/dlocal (BASIC - will be enhanced in 18B)

### Test Coverage

- 25%+ achieved in Part 18A
- All services working and tested

---

## What Part 18B Builds (Deliverable)

**END-TO-END TESTABLE FEATURE:**

- User can purchase 3-day plan (ONE TIME ONLY)
- System enforces 3-day plan anti-abuse rules
- Webhook creates PRO subscriptions
- System sends renewal reminders (3 days before expiry)
- System auto-downgrades expired subscriptions
- Part 12 APIs return unified payment data (Stripe + dLocal)

**NOT IN THIS SLICE:**

- Frontend components (18C)
- Unified checkout page (18C)
- Email templates (18C)
- Admin fraud dashboard (18C)
- Part 12 Frontend integration (18C)

---

## Prerequisites Check

Before starting Part 18B, verify:

- [ ] Part 18A COMPLETE and tested
- [ ] All Part 18A tests passing
- [ ] Part 18A services working
- [ ] Part 2 complete (Database)
- [ ] Part 5 complete (Auth)
- [ ] Part 12 complete (Stripe integration)
- [ ] Can create dLocal payment via Part 18A API
- [ ] Basic webhook working in Part 18A

**CRITICAL:** If Part 18A is not complete, STOP and finish Part 18A first.

---

## Critical Business Rules for Part 18B

### 1. 3-Day Plan Anti-Abuse (STRICT)

- 3-day plan can ONLY be purchased ONCE per account (lifetime)
- Track via `hasUsedThreeDayPlan` boolean on User model
- CANNOT purchase 3-day plan if user has active subscription
- Must validate BEFORE payment creation
- Must mark as used AFTER successful payment

### 2. Subscription Creation (Webhook)

- Create subscription ONLY on successful payment (status = 'PAID')
- Set expiresAt = now + 3 days (for 3-day plan) or now + 30 days (monthly)
- Set paymentProvider = 'DLOCAL' (distinguish from Stripe)
- Upgrade user to PRO tier
- Send notification to user

### 3. Renewal Reminders (Cron)

- Send reminder 3 days before expiry
- Only for dLocal subscriptions (Stripe auto-renews)
- Mark reminder as sent (renewalReminderSent = true)
- Don't send duplicate reminders

### 4. Auto-Downgrade (Cron)

- Run daily to check expired subscriptions
- Only downgrade dLocal subscriptions (Stripe manages itself)
- Set user tier to FREE
- Set subscription status to EXPIRED
- Send notification to user

### 5. Early Renewal Logic

- Monthly plan: ALLOWED - extend from current expiry date
- 3-day plan: PROHIBITED if user has any active subscription

### 6. Part 12 Integration Rules

- **DON'T BREAK STRIPE:** Existing Stripe flow must continue working
- Add paymentProvider field to subscriptions
- Return provider in subscription APIs
- Include dLocal payments in invoices
- Keep Stripe webhook separate from dLocal webhook

---

## All 20 Files to Build

### Phase A: Database Updates (1 production + 0 test = 1 file)

| #   | File Path              | Type   | Description                        |
| --- | ---------------------- | ------ | ---------------------------------- |
| 1   | `prisma/schema.prisma` | UPDATE | Add subscription fields for dLocal |

### Phase B: Services (3 production + 3 test = 6 files)

| #   | File Path                                          | Type | Description                          |
| --- | -------------------------------------------------- | ---- | ------------------------------------ |
| 2   | `lib/dlocal/three-day-validator.service.ts`        | NEW  | Anti-abuse validation for 3-day plan |
| 3   | `lib/cron/check-expiring-subscriptions.ts`         | NEW  | Send renewal reminders               |
| 4   | `lib/cron/downgrade-expired-subscriptions.ts`      | NEW  | Downgrade expired users to FREE      |
| T1  | `__tests__/lib/dlocal/three-day-validator.test.ts` | TEST | TDD: 3-day plan validation           |
| T2  | `__tests__/lib/cron/check-expiring.test.ts`        | TEST | TDD: Expiring subscription logic     |
| T3  | `__tests__/lib/cron/downgrade-expired.test.ts`     | TEST | TDD: Downgrade logic                 |

### Phase C: Enhanced Webhook (1 production + 1 test = 2 files)

| #   | File Path                                     | Type   | Description                                 |
| --- | --------------------------------------------- | ------ | ------------------------------------------- |
| 5   | `app/api/webhooks/dlocal/route.ts`            | MODIFY | Complete webhook with subscription creation |
| T4  | `__tests__/api/webhooks/dlocal/route.test.ts` | UPDATE | Test subscription creation                  |

### Phase D: Cron API Routes (2 production + 2 test = 4 files)

| #   | File Path                                               | Type | Description                  |
| --- | ------------------------------------------------------- | ---- | ---------------------------- |
| 6   | `app/api/cron/check-expiring-subscriptions/route.ts`    | NEW  | GET cron - send reminders    |
| 7   | `app/api/cron/downgrade-expired-subscriptions/route.ts` | NEW  | GET cron - downgrade expired |
| T5  | `__tests__/api/cron/check-expiring.test.ts`             | TEST | Unit test: Expiring cron     |
| T6  | `__tests__/api/cron/downgrade-expired.test.ts`          | TEST | Unit test: Downgrade cron    |

### Phase E: Part 12 API Integration (5 production + 0 test = 5 files)

| #   | File Path                          | Type   | Description                                    |
| --- | ---------------------------------- | ------ | ---------------------------------------------- |
| 8   | `app/api/subscription/route.ts`    | MODIFY | Return paymentProvider, handle both providers  |
| 9   | `app/api/invoices/route.ts`        | MODIFY | Include dLocal payments in results             |
| 10  | `lib/stripe/stripe.ts`             | MODIFY | Export provider type constants                 |
| 11  | `lib/stripe/webhook-handlers.ts`   | MODIFY | Add paymentProvider when creating subscription |
| 12  | `lib/email/subscription-emails.ts` | NEW    | Provider-specific email templates              |

### Phase F: Configuration (1 production + 0 test = 1 file)

| #   | File Path     | Type   | Description            |
| --- | ------------- | ------ | ---------------------- |
| 13  | `vercel.json` | UPDATE | Add cron job schedules |

### Phase G: Documentation (1 production + 0 test = 1 file)

| #   | File Path                 | Type | Description              |
| --- | ------------------------- | ---- | ------------------------ |
| 14  | `docs/part18b-handoff.md` | NEW  | Handoff doc for Part 18C |

---

## TDD Build Sequence (Red-Green-Refactor)

### Phase A: Database Updates

#### Step 1: Update Prisma Schema for Subscriptions

**File: `prisma/schema.prisma`** (UPDATE - Add subscription fields)

```prisma
// UPDATE User model
model User {
  id                  String         @id @default(cuid())
  email               String         @unique
  name                String?
  tier                String         @default("FREE") // FREE or PRO
  hasUsedThreeDayPlan Boolean        @default(false) // NEW: Track 3-day plan usage

  // Existing fields...
  subscriptions       Subscription[] // Already exists from Part 12
  payments            Payment[]      // From Part 18A
  notifications       Notification[] // From Part 18A
}

// UPDATE Subscription model
model Subscription {
  id                    String   @id @default(cuid())
  userId                String
  user                  User     @relation(fields: [userId], references: [id])

  paymentProvider       String   // NEW: 'STRIPE' or 'DLOCAL'
  planType              String?  // NEW: 'MONTHLY' or 'THREE_DAY' (for dLocal)
  status                String   // ACTIVE, CANCELLED, EXPIRED

  // Stripe fields (from Part 12)
  stripeCustomerId      String?
  stripeSubscriptionId  String?
  currentPeriodStart    DateTime?
  currentPeriodEnd      DateTime?

  // dLocal fields (NEW)
  expiresAt             DateTime? // For manual renewal (dLocal only)
  renewalReminderSent   Boolean  @default(false) // NEW

  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  @@index([userId])
  @@index([paymentProvider]) // NEW
  @@index([expiresAt])       // NEW: For cron jobs
  @@index([status])
}

// Payment and Notification models already exist from Part 18A
```

**Run migration:**

```bash
npx prisma migrate dev --name add-subscription-dlocal-support
npx prisma generate
```

---

### Phase B: Services (TDD)

#### Service 1: 3-Day Plan Validator (TDD)

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
    await prisma.subscription.deleteMany({
      where: { userId: { contains: 'test-3day' } },
    });
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
        hasUsedThreeDayPlan: false,
      },
    });

    const canPurchase = await canPurchaseThreeDayPlan(user.id);
    expect(canPurchase).toBe(true);

    await prisma.user.delete({ where: { id: user.id } });
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

    await prisma.user.delete({ where: { id: user.id } });
  });

  it('should reject if user has active subscription', async () => {
    const user = await prisma.user.create({
      data: {
        email: 'test-3day-active@example.com',
        name: 'Test User',
        tier: 'PRO',
        hasUsedThreeDayPlan: false,
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

    await prisma.subscription.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });

  it('should mark 3-day plan as used', async () => {
    const user = await prisma.user.create({
      data: {
        email: 'test-3day-mark@example.com',
        name: 'Test User',
        tier: 'FREE',
        hasUsedThreeDayPlan: false,
      },
    });

    await markThreeDayPlanUsed(user.id);

    const updatedUser = await prisma.user.findUnique({
      where: { id: user.id },
    });

    expect(updatedUser?.hasUsedThreeDayPlan).toBe(true);

    await prisma.user.delete({ where: { id: user.id } });
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
      logger.info('User has active subscription, cannot purchase 3-day plan', {
        userId,
      });
      return false;
    }

    return true;
  } catch (error) {
    logger.error('Error checking 3-day plan eligibility', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
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
git commit -m "feat(part18b): add 3-day plan validator with anti-abuse tests"
```

#### Service 2: Check Expiring Subscriptions (TDD)

**RED: Write Test First**

**File: `__tests__/lib/cron/check-expiring.test.ts`**

```typescript
import { checkExpiringSubscriptions } from '@/lib/cron/check-expiring-subscriptions';
import { prisma } from '@/lib/db';

describe('Check Expiring Subscriptions', () => {
  beforeEach(async () => {
    await prisma.subscription.deleteMany({
      where: { userId: { contains: 'test-expiring' } },
    });
    await prisma.user.deleteMany({
      where: { email: { contains: 'test-expiring' } },
    });
  });

  it('should find subscriptions expiring in 3 days', async () => {
    const user = await prisma.user.create({
      data: {
        email: 'test-expiring-user-1@example.com',
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
        expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        renewalReminderSent: false,
      },
    });

    const result = await checkExpiringSubscriptions();

    expect(result.reminders).toHaveLength(1);
    expect(result.reminders[0].userId).toBe(user.id);

    // Verify reminder marked as sent
    const subscription = await prisma.subscription.findFirst({
      where: { userId: user.id },
    });
    expect(subscription?.renewalReminderSent).toBe(true);

    await prisma.subscription.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });

  it('should not send reminder if already sent', async () => {
    const user = await prisma.user.create({
      data: {
        email: 'test-reminder-sent@example.com',
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
        renewalReminderSent: true,
      },
    });

    const result = await checkExpiringSubscriptions();

    expect(result.reminders).toHaveLength(0);

    await prisma.subscription.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });

  it('should not send reminder for Stripe subscriptions', async () => {
    const user = await prisma.user.create({
      data: {
        email: 'test-stripe-user@example.com',
        name: 'Stripe User',
        tier: 'PRO',
      },
    });

    await prisma.subscription.create({
      data: {
        userId: user.id,
        paymentProvider: 'STRIPE',
        status: 'ACTIVE',
        currentPeriodEnd: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      },
    });

    const result = await checkExpiringSubscriptions();

    expect(result.reminders).toHaveLength(0);

    await prisma.subscription.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });
});
```

**Run test:** `npm test -- check-expiring.test.ts` → ❌ FAILS

**GREEN: Write Minimal Code**

**File: `lib/cron/check-expiring-subscriptions.ts`**

```typescript
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export async function checkExpiringSubscriptions(): Promise<{
  reminders: Array<{ userId: string; email: string; expiresAt: Date }>;
}> {
  try {
    const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const twoDaysFromNow = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);

    // Find dLocal subscriptions expiring in 3 days
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
      if (!subscription.user.email || !subscription.expiresAt) continue;

      // Mark reminder as sent (email sending is in Part 18C)
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { renewalReminderSent: true },
      });

      reminders.push({
        userId: subscription.user.id,
        email: subscription.user.email,
        expiresAt: subscription.expiresAt,
      });

      logger.info('Renewal reminder marked for sending', {
        userId: subscription.user.id,
        expiresAt: subscription.expiresAt,
      });
    }

    return { reminders };
  } catch (error) {
    logger.error('Failed to check expiring subscriptions', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}
```

**Run test:** `npm test` → ✅ PASSES

**Commit:**

```bash
git add lib/cron/check-expiring-subscriptions.ts __tests__/lib/cron/check-expiring.test.ts
git commit -m "feat(part18b): add expiring subscriptions check with tests"
```

#### Service 3: Downgrade Expired Subscriptions (TDD)

**RED: Write Test First**

**File: `__tests__/lib/cron/downgrade-expired.test.ts`**

```typescript
import { downgradeExpiredSubscriptions } from '@/lib/cron/downgrade-expired-subscriptions';
import { prisma } from '@/lib/db';

describe('Downgrade Expired Subscriptions', () => {
  beforeEach(async () => {
    await prisma.subscription.deleteMany({
      where: { userId: { contains: 'test-expired' } },
    });
    await prisma.user.deleteMany({
      where: { email: { contains: 'test-expired' } },
    });
  });

  it('should downgrade users with expired subscriptions', async () => {
    const user = await prisma.user.create({
      data: {
        email: 'test-expired-user-1@example.com',
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
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
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

    await prisma.subscription.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });

  it('should not downgrade active subscriptions', async () => {
    const user = await prisma.user.create({
      data: {
        email: 'test-active-user@example.com',
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
        expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      },
    });

    const result = await downgradeExpiredSubscriptions();

    expect(result.downgrades).toHaveLength(0);

    const updatedUser = await prisma.user.findUnique({
      where: { id: user.id },
    });
    expect(updatedUser?.tier).toBe('PRO');

    await prisma.subscription.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });

  it('should not downgrade Stripe subscriptions', async () => {
    const user = await prisma.user.create({
      data: {
        email: 'test-stripe-expired@example.com',
        name: 'Stripe User',
        tier: 'PRO',
      },
    });

    await prisma.subscription.create({
      data: {
        userId: user.id,
        paymentProvider: 'STRIPE',
        status: 'ACTIVE',
        currentPeriodEnd: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
    });

    const result = await downgradeExpiredSubscriptions();

    expect(result.downgrades).toHaveLength(0);

    await prisma.subscription.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });
});
```

**Run test:** `npm test -- downgrade-expired.test.ts` → ❌ FAILS

**GREEN: Write Minimal Code**

**File: `lib/cron/downgrade-expired-subscriptions.ts`**

```typescript
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

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

      // Create notification
      await prisma.notification.create({
        data: {
          userId: subscription.userId,
          type: 'subscription_expired',
          message:
            'Your PRO subscription has expired. You have been downgraded to FREE tier.',
        },
      });

      if (subscription.user.email) {
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
    logger.error('Failed to downgrade expired subscriptions', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}
```

**Run test:** `npm test` → ✅ PASSES

**Commit:**

```bash
git add lib/cron/downgrade-expired-subscriptions.ts __tests__/lib/cron/downgrade-expired.test.ts
git commit -m "feat(part18b): add downgrade expired subscriptions with tests"
```

---

### Phase C: Enhanced Webhook Handler

**File: `app/api/webhooks/dlocal/route.ts`** (MODIFY - Add subscription creation)

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
      logger.warn('Invalid webhook signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const webhookData = JSON.parse(payload);
    logger.info('dLocal webhook received', {
      paymentId: webhookData.id,
      status: webhookData.status,
    });

    if (webhookData.status === 'PAID') {
      // Extract user ID from order_id
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
        logger.error('Payment record not found', {
          orderId: webhookData.order_id,
        });
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

      // Create subscription (NEW in Part 18B)
      const expiresAt =
        payment.planType === 'THREE_DAY'
          ? new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      await prisma.subscription.create({
        data: {
          userId,
          paymentProvider: 'DLOCAL',
          planType: payment.planType,
          status: 'ACTIVE',
          expiresAt,
        },
      });

      // Mark 3-day plan as used if applicable (NEW in Part 18B)
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
        planType: payment.planType,
      });
    } else if (webhookData.status === 'REJECTED') {
      // Handle payment failure (same as Part 18A)
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
    logger.error('Webhook processing error', { error: error.message });
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
```

**Update Test:**

**File: `__tests__/api/webhooks/dlocal/route.test.ts`** (UPDATE)

```typescript
// Add this test to existing file

it('should create subscription on payment success', async () => {
  const user = await prisma.user.create({
    data: {
      email: 'webhook-subscription@example.com',
      name: 'Webhook Test',
      tier: 'FREE',
    },
  });

  const payment = await prisma.payment.create({
    data: {
      userId: user.id,
      provider: 'DLOCAL',
      paymentId: 'payment-sub-123',
      orderId: `order-${user.id}-999999999`,
      amount: 29.0,
      currency: 'INR',
      amountUSD: 29.0,
      country: 'IN',
      paymentMethod: 'UPI',
      planType: 'MONTHLY',
      status: 'PENDING',
      finalAmount: 29.0,
    },
  });

  const webhookPayload = {
    id: 'payment-sub-123',
    status: 'PAID',
    amount: 29.0,
    currency: 'INR',
    order_id: `order-${user.id}-999999999`,
  };

  const payload = JSON.stringify(webhookPayload);
  const signature = generateSignature(payload);

  const request = new NextRequest('http://localhost/api/webhooks/dlocal', {
    method: 'POST',
    headers: { 'x-signature': signature },
    body: payload,
  });

  await POST(request);

  // Verify subscription created
  const subscription = await prisma.subscription.findFirst({
    where: { userId: user.id },
  });

  expect(subscription).toBeDefined();
  expect(subscription?.paymentProvider).toBe('DLOCAL');
  expect(subscription?.planType).toBe('MONTHLY');
  expect(subscription?.status).toBe('ACTIVE');
  expect(subscription?.expiresAt).toBeDefined();

  // Cleanup
  await prisma.subscription.deleteMany({ where: { userId: user.id } });
  await prisma.payment.delete({ where: { id: payment.id } });
  await prisma.user.delete({ where: { id: user.id } });
});
```

**Run test:** `npm test -- webhooks/dlocal/route.test.ts` → ✅ PASSES

**Commit:**

```bash
git add app/api/webhooks/dlocal/route.ts __tests__/api/webhooks/dlocal/route.test.ts
git commit -m "feat(part18b): enhance webhook to create subscriptions"
```

---

### Phase D: Cron API Routes

#### Cron 1: Check Expiring Subscriptions

**File: `app/api/cron/check-expiring-subscriptions/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { checkExpiringSubscriptions } from '@/lib/cron/check-expiring-subscriptions';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      logger.warn('Unauthorized cron request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    logger.info('Running check expiring subscriptions cron');

    const result = await checkExpiringSubscriptions();

    logger.info('Check expiring subscriptions complete', {
      remindersSent: result.reminders.length,
    });

    return NextResponse.json({
      success: true,
      remindersSent: result.reminders.length,
      reminders: result.reminders,
    });
  } catch (error: any) {
    logger.error('Cron job failed', { error: error.message });
    return NextResponse.json({ error: 'Cron job failed' }, { status: 500 });
  }
}
```

#### Cron 2: Downgrade Expired Subscriptions

**File: `app/api/cron/downgrade-expired-subscriptions/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { downgradeExpiredSubscriptions } from '@/lib/cron/downgrade-expired-subscriptions';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      logger.warn('Unauthorized cron request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    logger.info('Running downgrade expired subscriptions cron');

    const result = await downgradeExpiredSubscriptions();

    logger.info('Downgrade expired subscriptions complete', {
      usersDowngraded: result.downgrades.length,
    });

    return NextResponse.json({
      success: true,
      usersDowngraded: result.downgrades.length,
      downgrades: result.downgrades,
    });
  } catch (error: any) {
    logger.error('Cron job failed', { error: error.message });
    return NextResponse.json({ error: 'Cron job failed' }, { status: 500 });
  }
}
```

**Commit:**

```bash
git add app/api/cron/
git commit -m "feat(part18b): add cron API routes for subscription management"
```

---

### Phase E: Part 12 API Integration

#### Integration 1: Subscription API

**File: `app/api/subscription/route.ts`** (MODIFY)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        subscriptions: {
          where: { status: 'ACTIVE' },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const activeSubscription = user.subscriptions[0];

    // Return unified subscription data (works for both Stripe and dLocal)
    return NextResponse.json({
      tier: user.tier,
      hasActiveSubscription: !!activeSubscription,
      paymentProvider: activeSubscription?.paymentProvider || null, // NEW
      planType: activeSubscription?.planType || null, // NEW
      status: activeSubscription?.status || null,
      expiresAt: activeSubscription?.expiresAt || null, // NEW (dLocal)
      currentPeriodEnd: activeSubscription?.currentPeriodEnd || null, // (Stripe)
      stripeSubscriptionId: activeSubscription?.stripeSubscriptionId || null,
      createdAt: activeSubscription?.createdAt || null,
    });
  } catch (error: any) {
    logger.error('Failed to get subscription', { error: error.message });
    return NextResponse.json(
      { error: 'Failed to get subscription' },
      { status: 500 }
    );
  }
}
```

#### Integration 2: Invoices API

**File: `app/api/invoices/route.ts`** (MODIFY)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/db';
import { stripe } from '@/lib/stripe/stripe';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get dLocal payments (NEW)
    const dLocalPayments = await prisma.payment.findMany({
      where: {
        userId: session.user.id,
        provider: 'DLOCAL',
        status: 'COMPLETED',
      },
      orderBy: { completedAt: 'desc' },
    });

    // Get Stripe invoices (existing)
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        subscriptions: {
          where: { paymentProvider: 'STRIPE' },
          select: { stripeCustomerId: true },
        },
      },
    });

    let stripeInvoices: any[] = [];
    const stripeCustomerId = user?.subscriptions[0]?.stripeCustomerId;

    if (stripeCustomerId) {
      const invoices = await stripe.invoices.list({
        customer: stripeCustomerId,
        limit: 10,
      });
      stripeInvoices = invoices.data;
    }

    // Combine and format (NEW)
    const combinedInvoices = [
      // dLocal invoices
      ...dLocalPayments.map((payment) => ({
        id: payment.id,
        provider: 'DLOCAL',
        amount: payment.amount.toString(),
        currency: payment.currency,
        status: 'paid',
        created:
          payment.completedAt?.getTime() || payment.initiatedAt.getTime(),
        pdf: null,
        planType: payment.planType,
      })),
      // Stripe invoices
      ...stripeInvoices.map((invoice) => ({
        id: invoice.id,
        provider: 'STRIPE',
        amount: (invoice.amount_paid / 100).toFixed(2),
        currency: invoice.currency.toUpperCase(),
        status: invoice.status,
        created: invoice.created * 1000,
        pdf: invoice.invoice_pdf,
        planType: 'MONTHLY',
      })),
    ].sort((a, b) => b.created - a.created);

    return NextResponse.json({ invoices: combinedInvoices });
  } catch (error: any) {
    logger.error('Failed to get invoices', { error: error.message });
    return NextResponse.json(
      { error: 'Failed to get invoices' },
      { status: 500 }
    );
  }
}
```

#### Integration 3: Stripe Utilities

**File: `lib/stripe/stripe.ts`** (MODIFY - Add provider constants)

```typescript
import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
  typescript: true,
});

// Provider type constants (NEW)
export const PaymentProvider = {
  STRIPE: 'STRIPE' as const,
  DLOCAL: 'DLOCAL' as const,
};

export type PaymentProviderType =
  (typeof PaymentProvider)[keyof typeof PaymentProvider];
```

#### Integration 4: Stripe Webhook Handlers

**File: `lib/stripe/webhook-handlers.ts`** (MODIFY)

```typescript
// Find the function that creates subscriptions and ADD paymentProvider

// Example modification:
export async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session
) {
  // ... existing code ...

  // When creating subscription, ADD:
  await prisma.subscription.create({
    data: {
      userId: user.id,
      paymentProvider: 'STRIPE', // NEW: Add this field
      status: 'ACTIVE',
      stripeCustomerId: session.customer as string,
      stripeSubscriptionId: session.subscription as string,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    },
  });

  // ... rest of existing code ...
}
```

#### Integration 5: Email Templates

**File: `lib/email/subscription-emails.ts`** (NEW)

```typescript
export interface EmailTemplate {
  subject: string;
  html: string;
}

export function getRenewalReminderEmailTemplate(
  userName: string,
  expiresAt: Date,
  daysRemaining: number,
  renewUrl: string
): EmailTemplate {
  return {
    subject: `Your subscription expires in ${daysRemaining} days`,
    html: `
      <h1>Renewal Reminder</h1>
      <p>Hi ${userName},</p>
      <p>Your PRO subscription will expire on ${expiresAt.toLocaleDateString()}.</p>
      <p>To continue enjoying PRO features, please renew your subscription.</p>
      <a href="${renewUrl}" style="background: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
        Renew Now
      </a>
    `,
  };
}

export function getSubscriptionExpiredEmailTemplate(
  userName: string
): EmailTemplate {
  return {
    subject: 'Your PRO subscription has expired',
    html: `
      <h1>Subscription Expired</h1>
      <p>Hi ${userName},</p>
      <p>Your PRO subscription has expired. You've been downgraded to FREE tier.</p>
      <p>To regain access to PRO features, please subscribe again.</p>
    `,
  };
}
```

**Commit:**

```bash
git add app/api/subscription/ app/api/invoices/ lib/stripe/ lib/email/
git commit -m "feat(part18b): integrate dLocal with Part 12 API layer"
```

---

### Phase F: Configuration

**File: `vercel.json`** (UPDATE - Add cron schedules)

```json
{
  "crons": [
    {
      "path": "/api/cron/check-expiring-subscriptions",
      "schedule": "0 9 * * *"
    },
    {
      "path": "/api/cron/downgrade-expired-subscriptions",
      "schedule": "0 10 * * *"
    }
  ]
}
```

**Commit:**

```bash
git add vercel.json
git commit -m "feat(part18b): add cron job schedules for subscription management"
```

---

### Phase G: Documentation (Handoff for Part 18C)

**File: `docs/part18b-handoff.md`**

````markdown
# Part 18B Handoff Document for Part 18C

## What Part 18B Built

### Database Changes

- Added `hasUsedThreeDayPlan` to User model
- Added `paymentProvider`, `planType`, `expiresAt`, `renewalReminderSent` to Subscription model

### Services Implemented

1. **ThreeDayValidatorService**
   - `canPurchaseThreeDayPlan(userId)` - Validates 3-day plan eligibility
   - `markThreeDayPlanUsed(userId)` - Marks 3-day plan as used

2. **CheckExpiringSubscriptionsService**
   - Finds subscriptions expiring in 3 days
   - Marks reminders as sent
   - Returns list of users needing reminders

3. **DowngradeExpiredSubscriptionsService**
   - Finds expired dLocal subscriptions
   - Downgrades users to FREE
   - Marks subscriptions as EXPIRED

### Enhanced Features

- Webhook now creates subscriptions (not just updates payment status)
- Webhook marks 3-day plan as used
- Cron jobs scheduled for daily execution

### API Integration Complete

- `/api/subscription` now returns paymentProvider
- `/api/invoices` includes both Stripe and dLocal payments
- Stripe webhook handlers add paymentProvider field
- Email templates created for provider-specific content

### Test Coverage

- 25%+ coverage maintained
- 5 new test files
- All tests passing

## What Part 18C Needs to Build

### Frontend Components

- Country selector
- Plan selector (with 3-day option)
- Payment method selector
- Price display
- Discount code input
- Payment button

### Pages

- Unified checkout page
- Email rendering

### Admin Features

- Fraud alerts dashboard
- Alert detail pages

### Part 12 Frontend Integration

- Modify pricing page
- Modify subscription card component

## Validation Gate for Part 18B

Part 18B is COMPLETE when:

- [ ] All 20 files created/modified
- [ ] Database migration successful
- [ ] All tests passing (25%+ coverage)
- [ ] 3-day plan validation working
- [ ] Webhook creates subscriptions
- [ ] Cron jobs working
- [ ] Part 12 API returns unified data
- [ ] STRIPE FLOW STILL WORKS (critical!)

## Known Issues / Bugs

(None reported as of completion)

## Environment Variables

```bash
CRON_SECRET=your_secure_cron_secret
# All other variables from Part 18A
```
````

````

**Commit:**
```bash
git add docs/part18b-handoff.md
git commit -m "docs(part18b): add handoff document for Part 18C"
````

---

## Environment Variables for Part 18B

Add to `.env`:

```bash
# Cron Job Secret
CRON_SECRET=generate_a_secure_random_string_here

# All other variables from Part 18A should already be present
```

---

## Success Criteria for Part 18B

### Functionality

- [x] 3-day plan validation enforced
- [x] Webhook creates subscriptions
- [x] Subscriptions have correct expiry dates
- [x] Renewal reminders marked for sending
- [x] Expired subscriptions downgraded
- [x] Part 12 APIs return unified data
- [x] Stripe flow unaffected

### Testing

- [x] 25%+ coverage maintained
- [x] All new tests passing
- [x] Integration with Part 18A working

### Critical Check

- [x] **STRIPE STILL WORKS** - Test Stripe checkout flow

---

## Validation Checklist

```bash
# 1. Run all tests
npm test

# 2. Test 3-day plan validation
# - Try to purchase 3-day plan twice (should fail second time)
# - Try to purchase 3-day plan with active subscription (should fail)

# 3. Test webhook subscription creation
# - Create payment
# - Trigger webhook
# - Verify subscription created
# - Verify user upgraded to PRO

# 4. Test cron jobs
curl -H "Authorization: Bearer $CRON_SECRET" \
  http://localhost:3000/api/cron/check-expiring-subscriptions

curl -H "Authorization: Bearer $CRON_SECRET" \
  http://localhost:3000/api/cron/downgrade-expired-subscriptions

# 5. Test Part 12 integration
# - GET /api/subscription (should return paymentProvider)
# - GET /api/invoices (should include dLocal payments)

# 6. CRITICAL: Test Stripe flow
# - Create Stripe checkout
# - Complete payment
# - Verify subscription created with paymentProvider='STRIPE'
```

---

## Commit Strategy for Part 18B

```bash
git checkout -b feature/part-18b-subscription-lifecycle

# Phase A: Database
git add prisma/schema.prisma
git commit -m "feat(part18b): add subscription fields for dLocal"

# Phase B: Services
git add lib/dlocal/three-day-validator.service.ts __tests__/lib/dlocal/three-day-validator.test.ts
git commit -m "feat(part18b): add 3-day plan validator with anti-abuse tests"

git add lib/cron/check-expiring-subscriptions.ts __tests__/lib/cron/check-expiring.test.ts
git commit -m "feat(part18b): add expiring subscriptions check with tests"

git add lib/cron/downgrade-expired-subscriptions.ts __tests__/lib/cron/downgrade-expired.test.ts
git commit -m "feat(part18b): add downgrade expired subscriptions with tests"

# Phase C: Webhook
git add app/api/webhooks/dlocal/route.ts __tests__/api/webhooks/dlocal/route.test.ts
git commit -m "feat(part18b): enhance webhook to create subscriptions"

# Phase D: Cron Routes
git add app/api/cron/
git commit -m "feat(part18b): add cron API routes for subscription management"

# Phase E: Part 12 Integration
git add app/api/subscription/ app/api/invoices/ lib/stripe/ lib/email/
git commit -m "feat(part18b): integrate dLocal with Part 12 API layer"

# Phase F: Config
git add vercel.json
git commit -m "feat(part18b): add cron job schedules"

# Phase G: Docs
git add docs/part18b-handoff.md
git commit -m "docs(part18b): add handoff document for Part 18C"

# Merge
git checkout main
git merge feature/part-18b-subscription-lifecycle
git push origin main
```

---

## Troubleshooting

### Issue 1: Cron Jobs Not Running

**Solution:**

- Deploy to Vercel to test cron (doesn't work locally)
- Test endpoints manually with curl
- Check cron secret is correct

### Issue 2: Stripe Subscriptions Broken

**Solution:**

- Check paymentProvider field added to Stripe webhook handler
- Verify Stripe subscriptions have paymentProvider='STRIPE'
- Test Stripe checkout end-to-end

### Issue 3: 3-Day Plan Validation False Positives

**Solution:**

- Check hasUsedThreeDayPlan is boolean, not null
- Verify active subscription check includes all statuses
- Test with fresh user accounts

---

## Timeline Estimate

- **Phase A:** 0.5 days
- **Phase B:** 2 days
- **Phase C:** 1 day
- **Phase D:** 0.5 days
- **Phase E:** 1 day
- **Phase F-G:** 0.5 days

**Total: 5.5 days** for Part 18B

---

## Ready to Build Part 18B

After completing Part 18B, upload **Part 18C prompt** to a NEW Claude Code session.
