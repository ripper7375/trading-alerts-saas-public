# Phase 3: Build Parts 17A, 17B, 18 with Test-Driven Development (TDD)

## Context & Mission

You are tasked with building **THREE critical Tier 1 (Money) parts** for the Trading Alerts SaaS V7 platform using **Test-Driven Development (TDD)**:

- **Part 17A:** Affiliate Marketing - Affiliate Portal
- **Part 17B:** Affiliate Marketing - Admin & Automation
- **Part 18:** dLocal Payments (International Payment Gateway)

**Your mission:** Build these money-critical features with **25% test coverage from day 1** using TDD methodology, ensuring payment correctness and preventing revenue loss.

---

## Prerequisites

✅ **Phase 1 completed:** Parts 1-15 tested (25% Tier 1, 10% Tier 2, 2% Tier 3)
✅ **Phase 2 completed:** Part 16 (Utilities) built with 2% coverage

**Repository:** https://github.com/ripper7375/trading-alerts-saas-v7

---

## Why Test-Driven Development (TDD)?

### **Traditional Approach (Build → Test)**

```
Code → Deploy → User finds bug → Revenue loss → Retrofit tests
```

### **TDD Approach (Test → Build)**

```
Write test → Code fails → Write code → Test passes → Refactor → Safe deployment
```

**Benefits for Money-Critical Code:**

- ✅ **Catch payment bugs before production** (prevent revenue loss)
- ✅ **Design cleaner APIs** (tests force good architecture)
- ✅ **Refactor safely** (tests protect against regressions)
- ✅ **Living documentation** (tests show how code should work)

---

## TDD Red-Green-Refactor Cycle

```
┌──────────────────────────────────────────────────┐
│ 1. RED: Write failing test                      │
│    └─→ Define expected behavior                 │
└──────────────────────────────────────────────────┘
                    ↓
┌──────────────────────────────────────────────────┐
│ 2. GREEN: Write minimal code to pass            │
│    └─→ Make test pass (don't optimize yet)      │
└──────────────────────────────────────────────────┘
                    ↓
┌──────────────────────────────────────────────────┐
│ 3. REFACTOR: Improve code quality                │
│    └─→ Clean up while keeping tests green       │
└──────────────────────────────────────────────────┘
                    ↓
         Repeat for next feature
```

---

## Part 17A: Affiliate Marketing - Affiliate Portal

### **Overview**

Allow users to become affiliates, generate referral codes, track clicks, and earn commissions on conversions.

### **Business Logic**

- **Referral Code:** 8-character alphanumeric (e.g., `TRADER42`)
- **Commission:** 20% of first payment ($29 × 20% = $5.80 per conversion)
- **Cookie Duration:** 30 days
- **Payout Threshold:** $50 minimum balance
- **Payment Method:** Stripe Connect or manual payout

---

### **TDD Implementation: Part 17A**

#### **Feature 1: Generate Referral Code**

**STEP 1: RED - Write Failing Test**

```typescript
// __tests__/lib/affiliate/referral-code.test.ts
import {
  generateReferralCode,
  isReferralCodeUnique,
} from '@/lib/affiliate/referral-code';

describe('Referral Code Generation', () => {
  it('should generate 8-character alphanumeric code', async () => {
    const code = await generateReferralCode('user-123');

    expect(code).toMatch(/^[A-Z0-9]{8}$/);
    expect(code.length).toBe(8);
  });

  it('should generate unique codes for different users', async () => {
    const code1 = await generateReferralCode('user-1');
    const code2 = await generateReferralCode('user-2');

    expect(code1).not.toBe(code2);
  });

  it('should check if code is unique in database', async () => {
    const existingCode = 'TRADER42';
    // Assume this code exists in database

    const isUnique = await isReferralCodeUnique(existingCode);
    expect(isUnique).toBe(false);
  });
});
```

**Run test:** `npm run test` → **❌ FAILS** (functions don't exist yet)

**STEP 2: GREEN - Write Minimal Code**

```typescript
// lib/affiliate/referral-code.ts
import { prisma } from '@/lib/db';

export async function generateReferralCode(userId: string): Promise<string> {
  let code: string;
  let isUnique = false;

  while (!isUnique) {
    code = Math.random().toString(36).substring(2, 10).toUpperCase();
    isUnique = await isReferralCodeUnique(code);
  }

  // Save to database
  await prisma.affiliate.upsert({
    where: { userId },
    update: { referralCode: code },
    create: {
      userId,
      referralCode: code,
      commissionRate: 0.2, // 20%
    },
  });

  return code;
}

export async function isReferralCodeUnique(code: string): Promise<boolean> {
  const existing = await prisma.affiliate.findUnique({
    where: { referralCode: code },
  });

  return existing === null;
}
```

**Run test:** `npm run test` → **✅ PASSES**

**STEP 3: REFACTOR - Improve Code**

```typescript
// lib/affiliate/referral-code.ts (refactored)
import { prisma } from '@/lib/db';
import { customAlphabet } from 'nanoid';

// More secure random ID generator
const generateId = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 8);

export async function generateReferralCode(userId: string): Promise<string> {
  const maxAttempts = 5;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const code = generateId();

    if (await isReferralCodeUnique(code)) {
      await saveReferralCode(userId, code);
      return code;
    }
  }

  throw new Error('Failed to generate unique referral code');
}

export async function isReferralCodeUnique(code: string): Promise<boolean> {
  const count = await prisma.affiliate.count({
    where: { referralCode: code },
  });

  return count === 0;
}

async function saveReferralCode(userId: string, code: string): Promise<void> {
  await prisma.affiliate.upsert({
    where: { userId },
    update: { referralCode: code },
    create: {
      userId,
      referralCode: code,
      commissionRate: 0.2,
      balance: 0,
    },
  });
}
```

**Run test:** `npm run test` → **✅ STILL PASSES** (refactoring successful)

---

#### **Feature 2: Track Referral Click**

**STEP 1: RED - Write Failing Test**

```typescript
// __tests__/lib/affiliate/tracking.test.ts
import { trackReferralClick, getReferralStats } from '@/lib/affiliate/tracking';

describe('Referral Tracking', () => {
  it('should track referral click', async () => {
    const result = await trackReferralClick('TRADER42', '192.168.1.1');

    expect(result.success).toBe(true);
    expect(result.clickId).toBeDefined();
  });

  it('should retrieve referral stats', async () => {
    const stats = await getReferralStats('user-123');

    expect(stats).toHaveProperty('totalClicks');
    expect(stats).toHaveProperty('totalConversions');
    expect(stats).toHaveProperty('totalEarnings');
  });

  it('should increment click count', async () => {
    const beforeStats = await getReferralStats('user-123');
    await trackReferralClick('TRADER42', '192.168.1.100');
    const afterStats = await getReferralStats('user-123');

    expect(afterStats.totalClicks).toBe(beforeStats.totalClicks + 1);
  });
});
```

**STEP 2: GREEN - Write Minimal Code**

```typescript
// lib/affiliate/tracking.ts
import { prisma } from '@/lib/db';

export async function trackReferralClick(
  referralCode: string,
  ipAddress: string
): Promise<{ success: boolean; clickId: string }> {
  const affiliate = await prisma.affiliate.findUnique({
    where: { referralCode },
  });

  if (!affiliate) {
    throw new Error('Invalid referral code');
  }

  const click = await prisma.referralClick.create({
    data: {
      affiliateId: affiliate.id,
      ipAddress,
      userAgent: 'unknown', // TODO: Extract from request
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    },
  });

  return { success: true, clickId: click.id };
}

export async function getReferralStats(userId: string) {
  const affiliate = await prisma.affiliate.findUnique({
    where: { userId },
    include: {
      clicks: true,
      conversions: true,
    },
  });

  if (!affiliate) {
    return { totalClicks: 0, totalConversions: 0, totalEarnings: 0 };
  }

  return {
    totalClicks: affiliate.clicks.length,
    totalConversions: affiliate.conversions.length,
    totalEarnings: affiliate.balance,
  };
}
```

**STEP 3: REFACTOR - Add Error Handling**

```typescript
// lib/affiliate/tracking.ts (refactored)
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export async function trackReferralClick(
  referralCode: string,
  ipAddress: string,
  userAgent?: string
): Promise<{ success: boolean; clickId: string }> {
  try {
    const affiliate = await prisma.affiliate.findUnique({
      where: { referralCode },
    });

    if (!affiliate) {
      logger.warn('Invalid referral code used', { referralCode });
      throw new Error('Invalid referral code');
    }

    // Check for duplicate clicks (same IP within 1 hour)
    const recentClick = await prisma.referralClick.findFirst({
      where: {
        affiliateId: affiliate.id,
        ipAddress,
        createdAt: {
          gte: new Date(Date.now() - 60 * 60 * 1000),
        },
      },
    });

    if (recentClick) {
      logger.info('Duplicate click detected', { ipAddress, referralCode });
      return { success: true, clickId: recentClick.id };
    }

    const click = await prisma.referralClick.create({
      data: {
        affiliateId: affiliate.id,
        ipAddress,
        userAgent: userAgent || 'unknown',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    logger.info('Referral click tracked', { clickId: click.id, referralCode });

    return { success: true, clickId: click.id };
  } catch (error) {
    logger.error('Failed to track referral click', { error });
    throw error;
  }
}
```

---

#### **Feature 3: Process Conversion (Paid Subscription)**

**STEP 1: RED - Write Failing Test**

```typescript
// __tests__/lib/affiliate/conversion.test.ts
import {
  processConversion,
  calculateCommission,
} from '@/lib/affiliate/conversion';

describe('Affiliate Conversion', () => {
  it('should process conversion and credit commission', async () => {
    const result = await processConversion({
      userId: 'new-user-123',
      referralCode: 'TRADER42',
      amount: 2900, // $29.00 in cents
    });

    expect(result.success).toBe(true);
    expect(result.commission).toBe(580); // 20% of $29.00 = $5.80
  });

  it('should calculate commission correctly', () => {
    const commission = calculateCommission(2900, 0.2);
    expect(commission).toBe(580);
  });

  it('should update affiliate balance', async () => {
    const beforeStats = await getReferralStats('affiliate-user');

    await processConversion({
      userId: 'new-user-456',
      referralCode: 'TRADER42',
      amount: 2900,
    });

    const afterStats = await getReferralStats('affiliate-user');
    expect(afterStats.totalEarnings).toBeGreaterThan(beforeStats.totalEarnings);
  });
});
```

**STEP 2: GREEN - Write Minimal Code**

```typescript
// lib/affiliate/conversion.ts
import { prisma } from '@/lib/db';

export function calculateCommission(amount: number, rate: number): number {
  return Math.floor(amount * rate);
}

export async function processConversion({
  userId,
  referralCode,
  amount,
}: {
  userId: string;
  referralCode: string;
  amount: number;
}): Promise<{ success: boolean; commission: number }> {
  const affiliate = await prisma.affiliate.findUnique({
    where: { referralCode },
  });

  if (!affiliate) {
    throw new Error('Invalid referral code');
  }

  const commission = calculateCommission(amount, affiliate.commissionRate);

  // Create conversion record
  await prisma.conversion.create({
    data: {
      affiliateId: affiliate.id,
      userId,
      amount,
      commission,
      status: 'pending', // Will be 'paid' after payout
    },
  });

  // Update affiliate balance
  await prisma.affiliate.update({
    where: { id: affiliate.id },
    data: {
      balance: { increment: commission },
      totalEarnings: { increment: commission },
    },
  });

  return { success: true, commission };
}
```

---

### **Database Schema for Part 17A**

Add to `prisma/schema.prisma`:

```prisma
model Affiliate {
  id             String   @id @default(cuid())
  userId         String   @unique
  user           User     @relation(fields: [userId], references: [id])
  referralCode   String   @unique
  commissionRate Float    @default(0.20)
  balance        Int      @default(0) // in cents
  totalEarnings  Int      @default(0) // in cents
  clicks         ReferralClick[]
  conversions    Conversion[]
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}

model ReferralClick {
  id          String   @id @default(cuid())
  affiliateId String
  affiliate   Affiliate @relation(fields: [affiliateId], references: [id])
  ipAddress   String
  userAgent   String
  expiresAt   DateTime
  createdAt   DateTime @default(now())

  @@index([affiliateId])
  @@index([ipAddress, createdAt])
}

model Conversion {
  id          String   @id @default(cuid())
  affiliateId String
  affiliate   Affiliate @relation(fields: [affiliateId], references: [id])
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  amount      Int      // in cents
  commission  Int      // in cents
  status      String   @default("pending") // pending, paid
  createdAt   DateTime @default(now())
  paidAt      DateTime?

  @@index([affiliateId])
  @@index([userId])
}
```

---

### **API Routes for Part 17A**

#### **GET /api/affiliate/dashboard**

```typescript
// app/api/affiliate/dashboard/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getReferralStats } from '@/lib/affiliate/tracking';
import { authOptions } from '@/lib/auth/auth-options';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const stats = await getReferralStats(session.user.id);

  return NextResponse.json({ stats });
}
```

**Test:**

```typescript
// __tests__/api/affiliate/dashboard/route.test.ts
import { GET } from '@/app/api/affiliate/dashboard/route';

describe('GET /api/affiliate/dashboard', () => {
  it('should return affiliate stats', async () => {
    const request = new NextRequest('http://localhost/api/affiliate/dashboard');
    const response = await GET(request);
    const data = await response.json();

    expect(data.stats).toHaveProperty('totalClicks');
    expect(data.stats).toHaveProperty('totalEarnings');
  });
});
```

---

## Part 17B: Affiliate Admin & Automation

### **Overview**

Admin tools for managing affiliates, approving payouts, and automating commission tracking.

---

### **TDD Implementation: Part 17B**

#### **Feature 1: Admin - List All Affiliates**

**STEP 1: RED - Write Failing Test**

```typescript
// __tests__/api/admin/affiliates/route.test.ts
import { GET } from '@/app/api/admin/affiliates/route';

describe('GET /api/admin/affiliates', () => {
  it('should list all affiliates with stats', async () => {
    const request = new NextRequest('http://localhost/api/admin/affiliates');
    const response = await GET(request);
    const data = await response.json();

    expect(Array.isArray(data.affiliates)).toBe(true);
    expect(data.affiliates[0]).toHaveProperty('userId');
    expect(data.affiliates[0]).toHaveProperty('referralCode');
    expect(data.affiliates[0]).toHaveProperty('balance');
  });

  it('should require admin role', async () => {
    // Mock non-admin user
    const request = new NextRequest('http://localhost/api/admin/affiliates');
    const response = await GET(request);

    expect(response.status).toBe(403);
  });
});
```

**STEP 2: GREEN - Build Route**

```typescript
// app/api/admin/affiliates/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/db';
import { authOptions } from '@/lib/auth/auth-options';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const affiliates = await prisma.affiliate.findMany({
    include: {
      user: {
        select: { email: true, name: true },
      },
      _count: {
        select: { clicks: true, conversions: true },
      },
    },
    orderBy: { totalEarnings: 'desc' },
  });

  return NextResponse.json({ affiliates });
}
```

---

#### **Feature 2: Process Payout**

**STEP 1: RED - Write Failing Test**

```typescript
// __tests__/lib/affiliate/payout.test.ts
import { processPayout, canRequestPayout } from '@/lib/affiliate/payout';

describe('Affiliate Payout', () => {
  it('should process payout if balance meets threshold', async () => {
    const result = await processPayout('affiliate-user-123');

    expect(result.success).toBe(true);
    expect(result.amountPaid).toBeGreaterThan(0);
  });

  it('should reject payout if balance below threshold', async () => {
    await expect(processPayout('low-balance-user')).rejects.toThrow(
      'Balance below minimum payout threshold'
    );
  });

  it('should check if user can request payout', async () => {
    const canPayout = await canRequestPayout('affiliate-user-123');
    expect(typeof canPayout).toBe('boolean');
  });
});
```

**STEP 2: GREEN - Build Payout Logic**

```typescript
// lib/affiliate/payout.ts
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

const MINIMUM_PAYOUT = 5000; // $50.00 in cents

export async function canRequestPayout(userId: string): Promise<boolean> {
  const affiliate = await prisma.affiliate.findUnique({
    where: { userId },
  });

  return affiliate ? affiliate.balance >= MINIMUM_PAYOUT : false;
}

export async function processPayout(userId: string): Promise<{
  success: boolean;
  amountPaid: number;
}> {
  const affiliate = await prisma.affiliate.findUnique({
    where: { userId },
  });

  if (!affiliate) {
    throw new Error('Affiliate not found');
  }

  if (affiliate.balance < MINIMUM_PAYOUT) {
    throw new Error('Balance below minimum payout threshold');
  }

  const amountPaid = affiliate.balance;

  // Create payout record
  await prisma.payout.create({
    data: {
      affiliateId: affiliate.id,
      amount: amountPaid,
      status: 'processing',
    },
  });

  // Reset balance
  await prisma.affiliate.update({
    where: { id: affiliate.id },
    data: { balance: 0 },
  });

  logger.info('Payout processed', { userId, amountPaid });

  return { success: true, amountPaid };
}
```

---

## Part 18: dLocal Payments (International Gateway)

### **Overview**

Integrate dLocal payment gateway for international users (Latin America, Asia, Africa) who cannot use Stripe.

**Key Features:**

- Alternative to Stripe for 100+ countries
- Local payment methods (PIX, OXXO, UPI, etc.)
- Multi-currency support
- Webhook handling for payment status

---

### **TDD Implementation: Part 18**

#### **Feature 1: Create dLocal Payment**

**STEP 1: RED - Write Failing Test**

```typescript
// __tests__/lib/dlocal/payment.test.ts
import {
  createDLocalPayment,
  getDLocalPaymentStatus,
} from '@/lib/dlocal/payment';

describe('dLocal Payment', () => {
  it('should create payment with correct amount', async () => {
    const payment = await createDLocalPayment({
      userId: 'user-123',
      amount: 2900,
      currency: 'USD',
      country: 'BR', // Brazil
    });

    expect(payment.id).toBeDefined();
    expect(payment.paymentUrl).toBeDefined();
    expect(payment.status).toBe('pending');
  });

  it('should get payment status', async () => {
    const status = await getDLocalPaymentStatus('payment-id-123');

    expect(status).toHaveProperty('status');
    expect(['pending', 'paid', 'failed']).toContain(status.status);
  });
});
```

**STEP 2: GREEN - Build dLocal Integration**

```typescript
// lib/dlocal/client.ts
import axios from 'axios';
import crypto from 'crypto';

const DLOCAL_API_KEY = process.env.DLOCAL_API_KEY!;
const DLOCAL_SECRET_KEY = process.env.DLOCAL_SECRET_KEY!;
const DLOCAL_BASE_URL = process.env.DLOCAL_BASE_URL || 'https://api.dlocal.com';

export interface DLocalPaymentRequest {
  amount: number;
  currency: string;
  country: string;
  payer: {
    name: string;
    email: string;
  };
}

function generateSignature(body: string): string {
  return crypto
    .createHmac('sha256', DLOCAL_SECRET_KEY)
    .update(body)
    .digest('hex');
}

export async function createDLocalPayment(
  paymentData: DLocalPaymentRequest
): Promise<{ id: string; paymentUrl: string; status: string }> {
  const requestBody = {
    amount: paymentData.amount,
    currency: paymentData.currency,
    country: paymentData.country,
    payment_method_id: 'CARD',
    payment_method_flow: 'DIRECT',
    payer: paymentData.payer,
    order_id: `order-${Date.now()}`,
    notification_url: `${process.env.NEXTAUTH_URL}/api/webhooks/dlocal`,
  };

  const body = JSON.stringify(requestBody);
  const signature = generateSignature(body);

  const response = await axios.post(
    `${DLOCAL_BASE_URL}/payments`,
    requestBody,
    {
      headers: {
        'X-Date': new Date().toISOString(),
        'X-Login': DLOCAL_API_KEY,
        'X-Trans-Key': signature,
        'Content-Type': 'application/json',
      },
    }
  );

  return {
    id: response.data.id,
    paymentUrl: response.data.redirect_url,
    status: response.data.status,
  };
}
```

---

#### **Feature 2: Webhook Handler**

**STEP 1: RED - Write Failing Test**

```typescript
// __tests__/api/webhooks/dlocal/route.test.ts
import { POST } from '@/app/api/webhooks/dlocal/route';
import { NextRequest } from 'next/server';

describe('POST /api/webhooks/dlocal', () => {
  it('should process payment success webhook', async () => {
    const webhookPayload = {
      id: 'payment-123',
      status: 'PAID',
      amount: 2900,
      order_id: 'order-123',
    };

    const request = new NextRequest('http://localhost/api/webhooks/dlocal', {
      method: 'POST',
      body: JSON.stringify(webhookPayload),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
  });

  it('should upgrade user to PRO on payment success', async () => {
    // Test that user tier is updated
    // Test that notification is sent
  });
});
```

**STEP 2: GREEN - Build Webhook Handler**

```typescript
// app/api/webhooks/dlocal/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const payload = await request.json();

    logger.info('dLocal webhook received', { payload });

    if (payload.status === 'PAID') {
      // Extract user ID from order_id
      const userId = payload.order_id.split('-')[1];

      // Upgrade user to PRO
      await prisma.user.update({
        where: { id: userId },
        data: {
          tier: 'PRO',
          stripeCustomerId: payload.id, // Store dLocal payment ID
        },
      });

      // Create notification
      await prisma.notification.create({
        data: {
          userId,
          type: 'subscription_upgraded',
          message: 'Your subscription has been upgraded to PRO',
        },
      });

      logger.info('User upgraded via dLocal', {
        userId,
        paymentId: payload.id,
      });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    logger.error('dLocal webhook error', { error });
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
```

---

## Coverage Target: 25% for All Three Parts

### **Test Distribution**

| Part    | Features                            | Test Files   | Target Coverage |
| ------- | ----------------------------------- | ------------ | --------------- |
| **17A** | Referral code, tracking, conversion | 5 test files | 25%             |
| **17B** | Admin, payouts, automation          | 3 test files | 25%             |
| **18**  | dLocal integration, webhooks        | 3 test files | 25%             |

**Total: ~11 test files, 40+ test cases**

---

## Execution Checklist

### **Part 17A: Affiliate Portal**

- [ ] TDD: Generate referral code
  - [ ] Write test (RED)
  - [ ] Build feature (GREEN)
  - [ ] Refactor (REFACTOR)
- [ ] TDD: Track referral clicks
  - [ ] Write test (RED)
  - [ ] Build feature (GREEN)
  - [ ] Refactor (REFACTOR)

- [ ] TDD: Process conversion
  - [ ] Write test (RED)
  - [ ] Build feature (GREEN)
  - [ ] Refactor (REFACTOR)

- [ ] Update Prisma schema
- [ ] Build API routes
- [ ] Achieve 25% coverage

### **Part 17B: Affiliate Admin**

- [ ] TDD: List affiliates (admin)
  - [ ] Write test (RED)
  - [ ] Build feature (GREEN)
  - [ ] Refactor (REFACTOR)

- [ ] TDD: Process payout
  - [ ] Write test (RED)
  - [ ] Build feature (GREEN)
  - [ ] Refactor (REFACTOR)

- [ ] TDD: Automate commission tracking
  - [ ] Write test (RED)
  - [ ] Build feature (GREEN)
  - [ ] Refactor (REFACTOR)

- [ ] Build admin dashboard
- [ ] Achieve 25% coverage

### **Part 18: dLocal Payments**

- [ ] TDD: Create payment
  - [ ] Write test (RED)
  - [ ] Build feature (GREEN)
  - [ ] Refactor (REFACTOR)

- [ ] TDD: Webhook handler
  - [ ] Write test (RED)
  - [ ] Build feature (GREEN)
  - [ ] Refactor (REFACTOR)

- [ ] TDD: Payment status check
  - [ ] Write test (RED)
  - [ ] Build feature (GREEN)
  - [ ] Refactor (REFACTOR)

- [ ] Build API routes
- [ ] Achieve 25% coverage

---

## Constraints & Guidelines

### **TDD Rules (Strict)**

✅ **ALWAYS:**

1. Write test FIRST (RED phase)
2. Run test to confirm it fails
3. Write minimal code to pass (GREEN phase)
4. Run test to confirm it passes
5. Refactor while keeping tests green
6. Repeat for next feature

❌ **NEVER:**

1. Write code before writing tests
2. Skip the refactor phase
3. Write tests that always pass
4. Test implementation details
5. Mock excessively (keep tests realistic)

---

## Deliverables

Upon completion, provide:

1. **Test files** (RED phase) for all features
2. **Implementation files** (GREEN phase) passing all tests
3. **Refactored code** (REFACTOR phase) with clean architecture
4. **Database schema updates** in Prisma
5. **API routes** for all endpoints
6. **Coverage report** showing 25%+ for each part
7. **Documentation** of business logic and API contracts

---

## Success Criteria

✅ **Phase 3 Complete When:**

- Part 17A: 25%+ coverage, all tests passing
- Part 17B: 25%+ coverage, all tests passing
- Part 18: 25%+ coverage, all tests passing
- All critical money flows tested (conversions, payouts)
- Webhook handlers tested and functional
- CI/CD pipeline succeeds
- No critical bugs in payment logic

---

---

## Step 4: API Testing with Supertest (After TDD)

**CRITICAL:** TDD builds unit and integration tests, but you must also validate **actual HTTP endpoints** with Supertest.

### **Why Supertest for TDD Parts?**

TDD tests call functions directly, but **don't catch:**

- ❌ Route handler doesn't await async Stripe call
- ❌ API returns 200 instead of 201
- ❌ Response body missing required fields
- ❌ Affiliate referral code not captured from query params
- ❌ dLocal webhook signature validation broken

---

### **10 Critical API Endpoint Tests**

#### **API Test Group 1: Affiliate APIs (Part 17A)**

```typescript
// __tests__/api/affiliate.supertest.ts
import {
  setupSupertestApp,
  teardownSupertestApp,
} from '../helpers/supertest-setup';

describe('API Tests: Affiliate System', () => {
  let request: any;
  let userToken: string;
  let affiliateCode: string;

  beforeAll(async () => {
    request = await setupSupertestApp();

    // Create user who will become affiliate
    await request.post('/api/auth/signup').send({
      email: 'affiliate@example.com',
      password: 'SecurePass123!',
      name: 'Affiliate User',
    });

    const loginRes = await request.post('/api/auth/signin').send({
      email: 'affiliate@example.com',
      password: 'SecurePass123!',
    });
    userToken = loginRes.body.token;
  });

  afterAll(async () => {
    await teardownSupertestApp();
  });

  describe('POST /api/affiliate/register', () => {
    it('should register user as affiliate', async () => {
      const response = await request
        .post('/api/affiliate/register')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        referralCode: expect.stringMatching(/^[A-Z0-9]{8}$/),
        commissionRate: 0.2,
      });

      affiliateCode = response.body.referralCode;
    });

    it('should reject if already an affiliate', async () => {
      const response = await request
        .post('/api/affiliate/register')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);

      expect(response.body.error).toContain('already an affiliate');
    });
  });

  describe('GET /api/affiliate/dashboard', () => {
    it('should return affiliate stats', async () => {
      const response = await request
        .get('/api/affiliate/dashboard')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        stats: {
          referralCode: affiliateCode,
          totalClicks: expect.any(Number),
          totalConversions: expect.any(Number),
          totalEarnings: expect.any(Number),
          balance: expect.any(Number),
        },
      });
    });

    it('should reject non-affiliate users', async () => {
      // Create non-affiliate user
      await request.post('/api/auth/signup').send({
        email: 'regular@example.com',
        password: 'SecurePass123!',
        name: 'Regular User',
      });
      const loginRes = await request.post('/api/auth/signin').send({
        email: 'regular@example.com',
        password: 'SecurePass123!',
      });

      const response = await request
        .get('/api/affiliate/dashboard')
        .set('Authorization', `Bearer ${loginRes.body.token}`)
        .expect(403);

      expect(response.body.error).toContain('not an affiliate');
    });
  });

  describe('POST /api/affiliate/track', () => {
    it('should track referral click from query param', async () => {
      const response = await request
        .get(`/pricing?ref=${affiliateCode}`)
        .expect(200);

      // Check that click was tracked
      const statsRes = await request
        .get('/api/affiliate/dashboard')
        .set('Authorization', `Bearer ${userToken}`);

      expect(statsRes.body.stats.totalClicks).toBeGreaterThan(0);
    });

    it('should set referral cookie', async () => {
      const response = await request.get(`/pricing?ref=${affiliateCode}`);

      expect(response.headers['set-cookie']).toBeDefined();
      expect(response.headers['set-cookie'][0]).toContain('referral_code');
    });

    it('should reject invalid referral code', async () => {
      const response = await request.get('/pricing?ref=INVALID99').expect(200); // Page still loads

      // But click should not be tracked
      const statsRes = await request
        .get('/api/affiliate/dashboard')
        .set('Authorization', `Bearer ${userToken}`);

      // Click count should not increase
      const initialClicks = statsRes.body.stats.totalClicks;

      await request.get('/pricing?ref=INVALID99');

      const afterStatsRes = await request
        .get('/api/affiliate/dashboard')
        .set('Authorization', `Bearer ${userToken}`);

      expect(afterStatsRes.body.stats.totalClicks).toBe(initialClicks);
    });
  });

  describe('Affiliate Conversion Flow', () => {
    it('should credit commission on conversion', async () => {
      // Get initial balance
      const beforeRes = await request
        .get('/api/affiliate/dashboard')
        .set('Authorization', `Bearer ${userToken}`);
      const initialBalance = beforeRes.body.stats.balance;

      // Simulate new user signup via referral
      const newUserRes = await request
        .post('/api/auth/signup')
        .set('Cookie', [`referral_code=${affiliateCode}`])
        .send({
          email: 'referred-user@example.com',
          password: 'SecurePass123!',
          name: 'Referred User',
        })
        .expect(201);

      const newUserToken = (
        await request.post('/api/auth/signin').send({
          email: 'referred-user@example.com',
          password: 'SecurePass123!',
        })
      ).body.token;

      // New user upgrades to PRO
      const checkoutRes = await request
        .post('/api/checkout')
        .set('Authorization', `Bearer ${newUserToken}`)
        .send({ tier: 'PRO' });

      // Simulate successful Stripe payment
      await request
        .post('/api/webhooks/stripe')
        .set('stripe-signature', 'test-signature')
        .send({
          type: 'checkout.session.completed',
          data: {
            object: {
              id: checkoutRes.body.sessionId,
              customer: 'cus_new_user',
              subscription: 'sub_new_user',
              amount_total: 2900, // $29.00
            },
          },
        });

      // Check affiliate earned commission
      const afterRes = await request
        .get('/api/affiliate/dashboard')
        .set('Authorization', `Bearer ${userToken}`);

      const expectedCommission = 580; // 20% of $29.00
      expect(afterRes.body.stats.balance).toBe(
        initialBalance + expectedCommission
      );
      expect(afterRes.body.stats.totalConversions).toBe(1);
    });
  });
});
```

---

#### **API Test Group 2: Affiliate Admin APIs (Part 17B)**

```typescript
// __tests__/api/affiliate-admin.supertest.ts
describe('API Tests: Affiliate Admin', () => {
  let request: any;
  let adminToken: string;

  beforeAll(async () => {
    request = await setupSupertestApp();

    // Create admin user
    await request.post('/api/auth/signup').send({
      email: 'admin@example.com',
      password: 'SecurePass123!',
      name: 'Admin User',
    });

    // Upgrade to admin
    await prisma.user.update({
      where: { email: 'admin@example.com' },
      data: { role: 'ADMIN' },
    });

    const loginRes = await request.post('/api/auth/signin').send({
      email: 'admin@example.com',
      password: 'SecurePass123!',
    });
    adminToken = loginRes.body.token;
  });

  describe('GET /api/admin/affiliates', () => {
    it('should list all affiliates', async () => {
      const response = await request
        .get('/api/admin/affiliates')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        affiliates: expect.any(Array),
        total: expect.any(Number),
      });

      if (response.body.affiliates.length > 0) {
        expect(response.body.affiliates[0]).toMatchObject({
          userId: expect.any(String),
          referralCode: expect.any(String),
          totalClicks: expect.any(Number),
          totalConversions: expect.any(Number),
          balance: expect.any(Number),
        });
      }
    });

    it('should reject non-admin users', async () => {
      // Create regular user
      await request.post('/api/auth/signup').send({
        email: 'regular-admin@example.com',
        password: 'SecurePass123!',
        name: 'Regular User',
      });
      const loginRes = await request.post('/api/auth/signin').send({
        email: 'regular-admin@example.com',
        password: 'SecurePass123!',
      });

      const response = await request
        .get('/api/admin/affiliates')
        .set('Authorization', `Bearer ${loginRes.body.token}`)
        .expect(403);

      expect(response.body.error).toContain('Admin access required');
    });
  });

  describe('POST /api/admin/affiliates/:id/payout', () => {
    it('should process payout for affiliate', async () => {
      // Create affiliate with balance
      const affiliateUser = await prisma.user.create({
        data: {
          email: 'payout-affiliate@example.com',
          name: 'Payout Affiliate',
          tier: 'FREE',
        },
      });

      await prisma.affiliate.create({
        data: {
          userId: affiliateUser.id,
          referralCode: 'PAYOUT01',
          balance: 10000, // $100.00
          commissionRate: 0.2,
        },
      });

      const response = await request
        .post(`/api/admin/affiliates/${affiliateUser.id}/payout`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ amount: 10000 })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        amountPaid: 10000,
        payoutId: expect.any(String),
      });

      // Verify balance reset
      const affiliate = await prisma.affiliate.findUnique({
        where: { userId: affiliateUser.id },
      });
      expect(affiliate?.balance).toBe(0);
    });

    it('should reject payout below minimum threshold', async () => {
      // Create affiliate with low balance
      const affiliateUser = await prisma.user.create({
        data: {
          email: 'low-balance@example.com',
          name: 'Low Balance Affiliate',
          tier: 'FREE',
        },
      });

      await prisma.affiliate.create({
        data: {
          userId: affiliateUser.id,
          referralCode: 'LOWBAL01',
          balance: 3000, // $30.00 (below $50 threshold)
          commissionRate: 0.2,
        },
      });

      const response = await request
        .post(`/api/admin/affiliates/${affiliateUser.id}/payout`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ amount: 3000 })
        .expect(400);

      expect(response.body.error).toContain('minimum payout threshold');
    });
  });
});
```

---

#### **API Test Group 3: dLocal Payment APIs (Part 18)**

```typescript
// __tests__/api/dlocal.supertest.ts
describe('API Tests: dLocal Payments', () => {
  let request: any;
  let userToken: string;

  beforeAll(async () => {
    request = await setupSupertestApp();

    // Create user
    await request.post('/api/auth/signup').send({
      email: 'dlocal-test@example.com',
      password: 'SecurePass123!',
      name: 'dLocal Test User',
    });

    const loginRes = await request.post('/api/auth/signin').send({
      email: 'dlocal-test@example.com',
      password: 'SecurePass123!',
    });
    userToken = loginRes.body.token;
  });

  describe('POST /api/payment/dlocal/create', () => {
    it('should create dLocal payment', async () => {
      const response = await request
        .post('/api/payment/dlocal/create')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          amount: 2900,
          currency: 'BRL', // Brazilian Real
          country: 'BR',
        })
        .expect(200);

      expect(response.body).toMatchObject({
        paymentId: expect.any(String),
        paymentUrl: expect.stringContaining('dlocal'),
        status: 'pending',
      });
    });

    it('should validate currency for country', async () => {
      const response = await request
        .post('/api/payment/dlocal/create')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          amount: 2900,
          currency: 'USD', // Wrong currency for Brazil
          country: 'BR',
        })
        .expect(400);

      expect(response.body.error).toContain('Invalid currency for country');
    });

    it('should reject if user already PRO', async () => {
      // Upgrade user to PRO
      await prisma.user.update({
        where: { email: 'dlocal-test@example.com' },
        data: { tier: 'PRO' },
      });

      const response = await request
        .post('/api/payment/dlocal/create')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          amount: 2900,
          currency: 'BRL',
          country: 'BR',
        })
        .expect(400);

      expect(response.body.error).toContain('already PRO');

      // Reset for other tests
      await prisma.user.update({
        where: { email: 'dlocal-test@example.com' },
        data: { tier: 'FREE' },
      });
    });
  });

  describe('GET /api/payment/dlocal/:id', () => {
    it('should get payment status', async () => {
      // Create payment first
      const createRes = await request
        .post('/api/payment/dlocal/create')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          amount: 2900,
          currency: 'BRL',
          country: 'BR',
        });

      const paymentId = createRes.body.paymentId;

      const response = await request
        .get(`/api/payment/dlocal/${paymentId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: paymentId,
        status: expect.stringMatching(/pending|paid|failed/),
        amount: 2900,
        currency: 'BRL',
      });
    });

    it('should reject unauthorized access to payment', async () => {
      // Create another user
      await request.post('/api/auth/signup').send({
        email: 'other-user@example.com',
        password: 'SecurePass123!',
        name: 'Other User',
      });
      const otherLoginRes = await request.post('/api/auth/signin').send({
        email: 'other-user@example.com',
        password: 'SecurePass123!',
      });

      const response = await request
        .get('/api/payment/dlocal/payment_12345')
        .set('Authorization', `Bearer ${otherLoginRes.body.token}`)
        .expect(403);

      expect(response.body.error).toContain('not authorized');
    });
  });

  describe('POST /api/webhooks/dlocal', () => {
    it('should handle payment success webhook', async () => {
      const webhookPayload = {
        id: 'payment_12345',
        status: 'PAID',
        amount: 2900,
        currency: 'BRL',
        order_id: 'order_user_12345',
      };

      const response = await request
        .post('/api/webhooks/dlocal')
        .set('x-dlocal-signature', 'valid-signature')
        .send(webhookPayload)
        .expect(200);

      expect(response.body).toMatchObject({
        received: true,
      });

      // Verify user upgraded
      const user = await prisma.user.findFirst({
        where: { id: 'user_12345' },
      });
      expect(user?.tier).toBe('PRO');
    });

    it('should handle payment failure webhook', async () => {
      const webhookPayload = {
        id: 'payment_67890',
        status: 'FAILED',
        amount: 2900,
        currency: 'BRL',
        order_id: 'order_user_67890',
        failure_reason: 'insufficient_funds',
      };

      const response = await request
        .post('/api/webhooks/dlocal')
        .set('x-dlocal-signature', 'valid-signature')
        .send(webhookPayload)
        .expect(200);

      // User should still be FREE
      const user = await prisma.user.findFirst({
        where: { id: 'user_67890' },
      });
      expect(user?.tier).toBe('FREE');

      // Notification should be created
      const notification = await prisma.notification.findFirst({
        where: {
          userId: 'user_67890',
          type: 'payment_failed',
        },
      });
      expect(notification).toBeDefined();
    });

    it('should reject invalid webhook signature', async () => {
      const response = await request
        .post('/api/webhooks/dlocal')
        .set('x-dlocal-signature', 'invalid-signature')
        .send({ id: 'payment_12345', status: 'PAID' })
        .expect(400);

      expect(response.body.error).toContain('Invalid signature');
    });
  });
});
```

---

### **API Test Execution Checklist**

Add this to your Phase 3 checklist:

#### **Supertest API Tests (10 Endpoints)**

**Part 17A: Affiliate Portal**

- [ ] POST /api/affiliate/register
- [ ] GET /api/affiliate/dashboard
- [ ] POST /api/affiliate/track (via query param)
- [ ] Affiliate conversion flow (end-to-end)

**Part 17B: Affiliate Admin**

- [ ] GET /api/admin/affiliates
- [ ] POST /api/admin/affiliates/:id/payout

**Part 18: dLocal Payments**

- [ ] POST /api/payment/dlocal/create
- [ ] GET /api/payment/dlocal/:id
- [ ] POST /api/webhooks/dlocal (success)
- [ ] POST /api/webhooks/dlocal (failure)

---

## Timeline Estimate (Updated with Supertest)

| Part    | Unit Tests (TDD) | Integration Tests | **Supertest API** | Total          |
| ------- | ---------------- | ----------------- | ----------------- | -------------- |
| **17A** | 3-4 days         | Built-in          | **1.5-2 days**    | **5-6 days**   |
| **17B** | 1.5-2 days       | Built-in          | **1 day**         | **2.5-3 days** |
| **18**  | 2-3 days         | Built-in          | **1.5-2 days**    | **4-5 days**   |

**Total: 13-16 days** for all three parts with TDD + Supertest.

---

## Success Criteria (Updated)

✅ **Phase 3 Complete When:**

- **Unit Tests (TDD):**
  - Part 17A: 25%+ coverage, all tests passing
  - Part 17B: 25%+ coverage, all tests passing
  - Part 18: 25%+ coverage, all tests passing
- **Integration Tests:**
  - Built into TDD workflow, all passing
- **Supertest API Tests:**
  - 10+ critical endpoints tested
  - Affiliate registration, tracking, and conversion verified
  - Admin payout flow validated
  - dLocal payment and webhook flow confirmed
- All critical money flows tested
- CI/CD pipeline succeeds

---

**Ready to begin? Start with Part 17A TDD → then add Supertest API tests → repeat for 17B and 18.**
