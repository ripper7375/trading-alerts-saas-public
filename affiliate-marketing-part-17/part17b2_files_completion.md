# Part 17B-2: Admin Portal - Automation & Components with TDD

**Project:** Trading Alerts SaaS V7  
**Task:** Build Part 17B-2 (Automation & Components) with Test-Driven Development  
**Files to Build:** 18 implementation files + 4 test files = **22 total files**  
**Estimated Time:** 4-6 hours (including TDD)  
**Current Status:** Part 17A complete, Part 17B-1 complete  
**Testing Approach:** Red-Green-Refactor TDD + Supertest API Testing  
**Coverage Target:** Maintain 25% minimum (combined)

---

## ⚠️ CRITICAL: THIS IS PART 17B-2 OF 2 - FINAL PART

**Part 17B is split into TWO parts:**

- **Part 17B-1 (COMPLETED)**: Admin Backend + Reports (20 files) ✅
- **Part 17B-2 (THIS PART - FINAL)**: Automation + Components (22 files)

**DEPENDENCIES - MUST VERIFY FIRST:**

```bash
# Check Part 17A files exist
ls -la lib/affiliate/code-generator.ts
ls -la lib/affiliate/commission-calculator.ts
ls -la lib/affiliate/constants.ts

# Check Part 17B-1 files exist
ls -la app/api/admin/affiliates/route.ts
ls -la app/api/admin/affiliates/reports/profit-loss/route.ts
ls -la app/admin/affiliates/page.tsx

# All must exist - if ANY missing, STOP and escalate
```

**COMPLETION POINT:** After Step 45 (F35: monthly report email), you will:

1. Run full test suite for entire Part 17B
2. Verify combined coverage ≥ 25%
3. Push code to same branch
4. Create Pull Request
5. Inform user **Part 17B is COMPLETE** (entire affiliate system done!)

---

## YOUR MISSION

You are Claude Code, tasked with building **Part 17B-2: Automation & Components** - the FINAL piece of the Affiliate Marketing Platform. You will:

1. **Verify Part 17A + Part 17B-1 dependencies** exist
2. Build **cron jobs** with TDD (Phase G)
3. Write **API E2E tests** with Supertest (Phase H)
4. Build **admin components** (Phase I)
5. Configure **Vercel cron** schedule
6. Maintain **25% test coverage** (combined)
7. Create **Pull Request** after completion
8. **CELEBRATE** - entire affiliate system complete!

**DELIVERABLE:** Complete affiliate marketing platform with automation, ready for production deployment.

---

## ESSENTIAL FILES TO READ FIRST

### 1. **Project Overview**

```
PROGRESS-part-2.md
README.md
ARCHITECTURE-compress.md
IMPLEMENTATION-GUIDE.md
```

### 2. **Policy Files**

```
docs/policies/00-tier-specifications.md
docs/policies/01-approval-policies.md
docs/policies/02-quality-standards.md
docs/policies/03-architecture-rules.md
docs/policies/04-escalation-triggers.md
docs/policies/05-coding-patterns-part-1.md
docs/policies/05-coding-patterns-part-2.md
docs/policies/06-aider-instructions.md
```

### 3. **Part 17B Requirements**

```
docs/build-orders/part-17b-admin-automation.md
docs/implementation-guides/v5_part_q.md
```

### 4. **Dependencies from Part 17A (MUST EXIST)**

```
lib/affiliate/code-generator.ts          # distributeCodes()
lib/affiliate/commission-calculator.ts
lib/affiliate/constants.ts               # AFFILIATE_CONFIG
__tests__/setup.ts
__tests__/helpers/supertest-setup.ts
```

### 5. **Dependencies from Part 17B-1 (MUST EXIST)**

```
app/api/admin/affiliates/route.ts
app/api/admin/affiliates/reports/profit-loss/route.ts
app/admin/affiliates/page.tsx
```

---

## TDD METHODOLOGY: RED-GREEN-REFACTOR

```
┌──────────────────────────────────────────────┐
│ 1. RED: Write failing test                  │
│    └→ Define expected behavior               │
│    └→ Run test: npm test (MUST FAIL)         │
└──────────────────────────────────────────────┘
                    ↓
┌──────────────────────────────────────────────┐
│ 2. GREEN: Write minimal code to pass        │
│    └→ Make test pass                         │
│    └→ Run test: npm test (MUST PASS)         │
└──────────────────────────────────────────────┘
                    ↓
┌──────────────────────────────────────────────┐
│ 3. REFACTOR: Improve code quality           │
│    └→ Clean up while keeping tests green     │
│    └→ Run test: npm test (STILL PASSES)      │
└──────────────────────────────────────────────┘
```

---

## PART 17B-2 BUILD SEQUENCE: 22 FILES

```
PHASE G: CRON JOBS WITH TDD (5 files)
├─ Step 24: T6 - __tests__/lib/cron/monthly-distribution.test.ts (RED)
├─ Step 25: F18 - app/api/cron/distribute-codes/route.ts (GREEN)
├─ Step 26: F19 - app/api/cron/expire-codes/route.ts
├─ Step 27: F20 - app/api/cron/send-monthly-reports/route.ts
└─ Step 28: F21 - vercel.json (UPDATE)

PHASE H: API E2E TESTS (3 test files)
├─ Step 29: T7 - __tests__/api/admin-affiliates.supertest.ts
├─ Step 30: T8 - __tests__/api/admin-reports.supertest.ts
└─ Step 31: T9 - __tests__/api/cron-jobs.supertest.ts

PHASE I: ADMIN COMPONENTS (14 files)
├─ Step 32: F22 - components/admin/affiliate-stats-banner.tsx
├─ Step 33: F23 - components/admin/affiliate-table.tsx
├─ Step 34: F24 - components/admin/affiliate-filters.tsx
├─ Step 35: F25 - components/admin/distribute-codes-modal.tsx
├─ Step 36: F26 - components/admin/suspend-affiliate-modal.tsx
├─ Step 37: F27 - components/admin/pay-commission-modal.tsx
├─ Step 38: F28 - components/admin/pnl-summary-cards.tsx
├─ Step 39: F29 - components/admin/pnl-breakdown-table.tsx
├─ Step 40: F30 - components/admin/pnl-trend-chart.tsx
├─ Step 41: F31 - components/admin/sales-performance-table.tsx
├─ Step 42: F32 - components/admin/commission-owings-table.tsx
├─ Step 43: F33 - components/admin/code-inventory-chart.tsx
├─ Step 44: F34 - lib/email/templates/affiliate/payment-processed.tsx
└─ Step 45: F35 - lib/email/templates/affiliate/monthly-report.tsx

TOTAL: 18 implementation files + 4 test files = 22 files
```

---

## DETAILED BUILD INSTRUCTIONS

### **PHASE G: CRON JOBS WITH TDD (Steps 24-28)**

#### **Step 24: T6 - Monthly Distribution Tests (RED)**

**File:** `__tests__/lib/cron/monthly-distribution.test.ts`

```typescript
import { runMonthlyDistribution } from '@/lib/cron/monthly-distribution';
import { distributeCodes } from '@/lib/affiliate/code-generator'; // Part 17A
import { AFFILIATE_CONFIG } from '@/lib/affiliate/constants'; // Part 17A
import { prismaMock } from '../../setup';

jest.mock('@/lib/affiliate/code-generator');

describe('Monthly Distribution Cron', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should distribute codes to all active affiliates', async () => {
    const mockAffiliates = [
      { id: '1', status: 'ACTIVE', user: { email: 'user1@test.com' } },
      { id: '2', status: 'ACTIVE', user: { email: 'user2@test.com' } },
    ];

    prismaMock.affiliateProfile.findMany.mockResolvedValue(
      mockAffiliates as any
    );
    (distributeCodes as jest.Mock).mockResolvedValue(undefined);

    const result = await runMonthlyDistribution();

    expect(result.distributed).toBe(2);
    expect(distributeCodes).toHaveBeenCalledTimes(2);
    expect(distributeCodes).toHaveBeenCalledWith(
      '1',
      AFFILIATE_CONFIG.CODES_PER_MONTH,
      'MONTHLY'
    );
    expect(distributeCodes).toHaveBeenCalledWith(
      '2',
      AFFILIATE_CONFIG.CODES_PER_MONTH,
      'MONTHLY'
    );
  });

  it('should skip inactive affiliates', async () => {
    const mockAffiliates = [
      { id: '1', status: 'ACTIVE', user: { email: 'active@test.com' } },
    ];

    prismaMock.affiliateProfile.findMany.mockResolvedValue(
      mockAffiliates as any
    );
    (distributeCodes as jest.Mock).mockResolvedValue(undefined);

    const result = await runMonthlyDistribution();

    expect(result.distributed).toBe(1);
    expect(distributeCodes).toHaveBeenCalledTimes(1);
  });

  it('should handle errors gracefully', async () => {
    const mockAffiliates = [
      { id: '1', status: 'ACTIVE', user: { email: 'user1@test.com' } },
    ];

    prismaMock.affiliateProfile.findMany.mockResolvedValue(
      mockAffiliates as any
    );
    (distributeCodes as jest.Mock).mockRejectedValue(
      new Error('Distribution failed')
    );

    const result = await runMonthlyDistribution();

    expect(result.errors).toHaveLength(1);
  });

  it('should send notification emails', async () => {
    const mockAffiliates = [
      { id: '1', status: 'ACTIVE', user: { email: 'user1@test.com' } },
    ];

    prismaMock.affiliateProfile.findMany.mockResolvedValue(
      mockAffiliates as any
    );
    (distributeCodes as jest.Mock).mockResolvedValue(undefined);

    const result = await runMonthlyDistribution();

    expect(result.emailsSent).toBe(1);
  });
});
```

**Commit:** `test(cron): add monthly distribution unit tests (RED)`

**Run:** `npm test` → ❌ MUST FAIL

---

#### **Step 25: F18 - Distribute Codes Cron (GREEN)**

**File:** `app/api/cron/distribute-codes/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { distributeCodes } from '@/lib/affiliate/code-generator'; // FROM PART 17A
import { AFFILIATE_CONFIG } from '@/lib/affiliate/constants'; // FROM PART 17A

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[CRON] Starting monthly code distribution...');

    const affiliates = await prisma.affiliateProfile.findMany({
      where: { status: 'ACTIVE' },
      include: { user: true },
    });

    let distributed = 0;
    const errors: string[] = [];

    for (const affiliate of affiliates) {
      try {
        await distributeCodes(
          affiliate.id,
          AFFILIATE_CONFIG.CODES_PER_MONTH,
          'MONTHLY'
        );
        distributed++;
        console.log(`[CRON] Distributed codes to ${affiliate.user.email}`);

        // TODO: Send notification email
      } catch (error) {
        console.error(`[CRON] Failed for ${affiliate.user.email}:`, error);
        errors.push(`${affiliate.user.email}: ${error.message}`);
      }
    }

    console.log(
      `[CRON] Completed: ${distributed} affiliates, ${errors.length} errors`
    );

    return NextResponse.json({
      success: true,
      message: `Distributed codes to ${distributed} affiliates`,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('[CRON] Distribute codes error:', error);
    return NextResponse.json({ error: 'Cron job failed' }, { status: 500 });
  }
}
```

**Commit:** `feat(cron): add monthly code distribution job (GREEN)`

**Run:** `npm test` → ✅ MUST PASS

---

#### **Step 26: F19 - Expire Codes Cron**

**File:** `app/api/cron/expire-codes/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[CRON] Starting code expiry check...');

    const now = new Date();
    const result = await prisma.affiliateCode.updateMany({
      where: {
        status: 'ACTIVE',
        expiresAt: { lte: now },
      },
      data: {
        status: 'EXPIRED',
      },
    });

    console.log(`[CRON] Expired ${result.count} codes`);

    return NextResponse.json({
      success: true,
      message: `Expired ${result.count} codes`,
    });
  } catch (error) {
    console.error('[CRON] Expire codes error:', error);
    return NextResponse.json({ error: 'Cron job failed' }, { status: 500 });
  }
}
```

**Commit:** `feat(cron): add monthly code expiry job`

---

#### **Step 27: F20 - Monthly Reports Cron**

**File:** `app/api/cron/send-monthly-reports/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[CRON] Starting monthly report distribution...');

    const affiliates = await prisma.affiliateProfile.findMany({
      where: { status: 'ACTIVE' },
      include: { user: true },
    });

    let sent = 0;

    for (const affiliate of affiliates) {
      try {
        // TODO: Generate and send monthly report email
        sent++;
        console.log(`[CRON] Sent report to ${affiliate.user.email}`);
      } catch (error) {
        console.error(
          `[CRON] Failed to send report to ${affiliate.user.email}:`,
          error
        );
      }
    }

    console.log(`[CRON] Sent ${sent} monthly reports`);

    return NextResponse.json({
      success: true,
      message: `Sent ${sent} monthly reports`,
    });
  } catch (error) {
    console.error('[CRON] Send reports error:', error);
    return NextResponse.json({ error: 'Cron job failed' }, { status: 500 });
  }
}
```

**Commit:** `feat(cron): add monthly report email job`

---

#### **Step 28: F21 - Configure Vercel Cron**

**File:** `vercel.json` (UPDATE or CREATE)

```json
{
  "crons": [
    {
      "path": "/api/cron/distribute-codes",
      "schedule": "0 0 1 * *"
    },
    {
      "path": "/api/cron/expire-codes",
      "schedule": "59 23 28-31 * *"
    },
    {
      "path": "/api/cron/send-monthly-reports",
      "schedule": "0 6 1 * *"
    }
  ]
}
```

**Cron Schedule Explanation:**

- `0 0 1 * *` - Monthly distribution: 00:00 on 1st of month
- `59 23 28-31 * *` - Expiry check: 23:59 on days 28-31 (end of month)
- `0 6 1 * *` - Monthly reports: 06:00 on 1st of month

**Commit:** `feat(cron): configure Vercel cron jobs`

---

### **PHASE H: API E2E TESTS (Steps 29-31)**

#### **Step 29: T7 - Admin Affiliates E2E Test**

**File:** `__tests__/api/admin-affiliates.supertest.ts`

```typescript
import {
  setupSupertestApp,
  teardownSupertestApp,
} from '../helpers/supertest-setup';
import { prisma } from '@/lib/db/prisma';

describe('API E2E: Admin Affiliates', () => {
  let request: any;
  let adminToken: string;
  let adminUserId: string;

  beforeAll(async () => {
    request = await setupSupertestApp();

    // Create admin user
    const admin = await prisma.user.create({
      data: {
        email: 'admin@example.com',
        name: 'Admin User',
        hashedPassword: 'hashed',
        role: 'ADMIN',
      },
    });
    adminUserId = admin.id;

    adminToken = 'mock-admin-token';
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { id: adminUserId } }).catch(() => {});
    await teardownSupertestApp();
  });

  describe('GET /api/admin/affiliates', () => {
    it('should list all affiliates', async () => {
      const response = await request
        .get('/api/admin/affiliates')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        affiliates: expect.any(Array),
        total: expect.any(Number),
        page: 1,
        limit: 20,
      });
    });

    it('should filter by status', async () => {
      const response = await request
        .get('/api/admin/affiliates?status=ACTIVE')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      response.body.affiliates.forEach((aff: any) => {
        expect(aff.status).toBe('ACTIVE');
      });
    });

    it('should reject non-admin users', async () => {
      // Create regular user
      const user = await prisma.user.create({
        data: {
          email: 'regular@example.com',
          name: 'Regular User',
          hashedPassword: 'hashed',
          role: 'USER',
        },
      });

      const response = await request
        .get('/api/admin/affiliates')
        .set('Authorization', 'Bearer regular-token');

      expect(response.status).toBe(403);
    });
  });

  describe('POST /api/admin/affiliates/:id/distribute-codes', () => {
    it('should distribute codes to affiliate', async () => {
      // Create test affiliate
      const user = await prisma.user.create({
        data: {
          email: 'test-aff@example.com',
          name: 'Test Affiliate',
          hashedPassword: 'hashed',
          isAffiliate: true,
        },
      });

      const affiliate = await prisma.affiliateProfile.create({
        data: {
          userId: user.id,
          fullName: 'Test Affiliate',
          country: 'US',
          paymentMethod: 'PAYPAL',
          status: 'ACTIVE',
        },
      });

      const response = await request
        .post(`/api/admin/affiliates/${affiliate.id}/distribute-codes`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          count: 10,
          reason: 'Bonus for good performance',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('10 codes');
    });

    it('should reject distribution to suspended affiliate', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'suspended@example.com',
          name: 'Suspended',
          hashedPassword: 'hashed',
          isAffiliate: true,
        },
      });

      const affiliate = await prisma.affiliateProfile.create({
        data: {
          userId: user.id,
          fullName: 'Suspended',
          country: 'US',
          paymentMethod: 'PAYPAL',
          status: 'SUSPENDED',
        },
      });

      const response = await request
        .post(`/api/admin/affiliates/${affiliate.id}/distribute-codes`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          count: 10,
          reason: 'Test',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('active');
    });
  });
});
```

**Commit:** `test(api): add admin affiliates E2E tests`

**Run:** `npm test` → Should PASS (APIs from Part 17B-1 exist)

---

#### **Step 30: T8 - Admin Reports E2E Test**

**File:** `__tests__/api/admin-reports.supertest.ts`

```typescript
import {
  setupSupertestApp,
  teardownSupertestApp,
} from '../helpers/supertest-setup';

describe('API E2E: Admin Reports', () => {
  let request: any;
  let adminToken: string;

  beforeAll(async () => {
    request = await setupSupertestApp();
    adminToken = 'mock-admin-token';
  });

  afterAll(async () => {
    await teardownSupertestApp();
  });

  describe('GET /api/admin/affiliates/reports/profit-loss', () => {
    it('should return P&L report', async () => {
      const response = await request
        .get('/api/admin/affiliates/reports/profit-loss?period=3months')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        period: {
          start: expect.any(String),
          end: expect.any(String),
        },
        revenue: {
          grossRevenue: expect.any(Number),
          discounts: expect.any(Number),
          netRevenue: expect.any(Number),
          discountPercent: 20.0,
        },
        costs: {
          totalCommissions: expect.any(Number),
          commissionPercent: 20.0,
        },
        profit: {
          netProfit: expect.any(Number),
          margin: expect.any(Number),
        },
        totalSales: expect.any(Number),
      });
    });

    it('should handle custom period', async () => {
      const response = await request
        .get('/api/admin/affiliates/reports/profit-loss?period=6months')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.period).toBeDefined();
    });

    it('should require admin authentication', async () => {
      const response = await request
        .get('/api/admin/affiliates/reports/profit-loss')
        .set('Authorization', '');

      expect(response.status).toBe(401);
    });
  });
});
```

**Commit:** `test(api): add admin reports E2E tests`

**Run:** `npm test` → Should PASS

---

#### **Step 31: T9 - Cron Jobs E2E Test**

**File:** `__tests__/api/cron-jobs.supertest.ts`

```typescript
import {
  setupSupertestApp,
  teardownSupertestApp,
} from '../helpers/supertest-setup';

describe('API E2E: Cron Jobs', () => {
  let request: any;

  beforeAll(async () => {
    request = await setupSupertestApp();
  });

  afterAll(async () => {
    await teardownSupertestApp();
  });

  describe('POST /api/cron/distribute-codes', () => {
    it('should authenticate with cron secret', async () => {
      const response = await request
        .post('/api/cron/distribute-codes')
        .set('Authorization', `Bearer ${process.env.CRON_SECRET}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should reject without cron secret', async () => {
      const response = await request
        .post('/api/cron/distribute-codes')
        .set('Authorization', 'Bearer wrong-secret');

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Unauthorized');
    });
  });

  describe('POST /api/cron/expire-codes', () => {
    it('should expire old codes', async () => {
      const response = await request
        .post('/api/cron/expire-codes')
        .set('Authorization', `Bearer ${process.env.CRON_SECRET}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/cron/send-monthly-reports', () => {
    it('should send monthly reports', async () => {
      const response = await request
        .post('/api/cron/send-monthly-reports')
        .set('Authorization', `Bearer ${process.env.CRON_SECRET}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});
```

**Commit:** `test(api): add cron jobs E2E tests`

**Run:** `npm test` → Should PASS

---

### **PHASE I: ADMIN COMPONENTS (Steps 32-45)**

Build these components without tests (mostly UI presentation):

#### **Steps 32-43: Admin UI Components**

Build these following standard React component patterns:

**Step 32: F22 - Affiliate Stats Banner**
**File:** `components/admin/affiliate-stats-banner.tsx`

- Total affiliates, active, pending
- Total commissions paid/pending
- Total codes distributed/used

**Commit:** `feat(components): add affiliate stats banner`

---

**Step 33: F23 - Affiliate Table**
**File:** `components/admin/affiliate-table.tsx`

- Reusable table for affiliate lists
- Sortable columns
- Action buttons

**Commit:** `feat(components): add affiliate table`

---

**Step 34: F24 - Affiliate Filters**
**File:** `components/admin/affiliate-filters.tsx`

- Status dropdown
- Country filter
- Payment method filter

**Commit:** `feat(components): add affiliate filters`

---

**Step 35: F25 - Distribute Codes Modal**
**File:** `components/admin/distribute-codes-modal.tsx`

- Form for count and reason
- Calls distribute-codes API
- Success/error handling

**Commit:** `feat(components): add distribute codes modal`

---

**Step 36: F26 - Suspend Affiliate Modal**
**File:** `components/admin/suspend-affiliate-modal.tsx`

- Confirmation dialog
- Reason input
- Calls suspend API

**Commit:** `feat(components): add suspend affiliate modal`

---

**Step 37: F27 - Pay Commission Modal**
**File:** `components/admin/pay-commission-modal.tsx`

- List of pending commissions
- Bulk payment confirmation
- Calls pay API

**Commit:** `feat(components): add pay commission modal`

---

**Step 38: F28 - P&L Summary Cards**
**File:** `components/admin/pnl-summary-cards.tsx`

- Revenue card
- Costs card
- Profit card
- Margin indicator

**Commit:** `feat(components): add P&L summary cards`

---

**Step 39: F29 - P&L Breakdown Table**
**File:** `components/admin/pnl-breakdown-table.tsx`

- Detailed breakdown by month
- Revenue vs costs vs profit

**Commit:** `feat(components): add P&L breakdown table`

---

**Step 40: F30 - P&L Trend Chart**
**File:** `components/admin/pnl-trend-chart.tsx`

- Line chart showing trends
- Use recharts library
- Profit margin over time

**Commit:** `feat(components): add P&L trend chart`

---

**Step 41: F31 - Sales Performance Table**
**File:** `components/admin/sales-performance-table.tsx`

- Top performers
- Conversion rates
- Commission totals

**Commit:** `feat(components): add sales performance table`

---

**Step 42: F32 - Commission Owings Table**
**File:** `components/admin/commission-owings-table.tsx`

- Affiliates ready for payout
- Amount owed
- Payment actions

**Commit:** `feat(components): add commission owings table`

---

**Step 43: F33 - Code Inventory Chart**
**File:** `components/admin/code-inventory-chart.tsx`

- Pie chart or bar chart
- Distribution vs usage
- Active vs expired

**Commit:** `feat(components): add code inventory chart`

---

#### **Steps 44-45: Email Templates**

**Step 44: F34 - Payment Processed Email**
**File:** `lib/email/templates/affiliate/payment-processed.tsx`

```typescript
import * as React from 'react';
import { Body, Container, Head, Heading, Html, Text } from '@react-email/components';

interface PaymentProcessedEmailProps {
  affiliateName: string;
  amount: number;
  paymentMethod: string;
}

export default function PaymentProcessedEmail({
  affiliateName,
  amount,
  paymentMethod,
}: PaymentProcessedEmailProps) {
  return (
    <Html>
      <Head />
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Payment Processed</Heading>
          <Text style={text}>
            Hi {affiliateName}, your commission payment of ${amount.toFixed(2)}
            has been processed via {paymentMethod}.
          </Text>
          <Text style={text}>
            Thank you for being a valued affiliate partner!
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const main = { backgroundColor: '#f6f9fc', fontFamily: 'sans-serif' };
const container = { margin: '0 auto', padding: '20px 0 48px' };
const h1 = { fontSize: '24px', fontWeight: 'bold' };
const text = { fontSize: '16px', lineHeight: '26px' };
```

**Commit:** `feat(email): add payment processed template`

---

**Step 45: F35 - Monthly Report Email**
**File:** `lib/email/templates/affiliate/monthly-report.tsx`

```typescript
import * as React from 'react';
import { Body, Container, Head, Heading, Html, Text } from '@react-email/components';

interface MonthlyReportEmailProps {
  affiliateName: string;
  month: string;
  stats: {
    codesDistributed: number;
    codesUsed: number;
    commissionsEarned: number;
    balance: number;
  };
}

export default function MonthlyReportEmail({
  affiliateName,
  month,
  stats,
}: MonthlyReportEmailProps) {
  return (
    <Html>
      <Head />
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Monthly Affiliate Report - {month}</Heading>
          <Text style={text}>Hi {affiliateName},</Text>
          <Text style={text}>
            Here's your performance summary for {month}:
          </Text>
          <Text style={text}>
            • Codes Distributed: {stats.codesDistributed}<br />
            • Codes Used: {stats.codesUsed}<br />
            • Commissions Earned: ${stats.commissionsEarned.toFixed(2)}<br />
            • Current Balance: ${stats.balance.toFixed(2)}
          </Text>
          <Text style={text}>
            Keep up the great work!
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const main = { backgroundColor: '#f6f9fc', fontFamily: 'sans-serif' };
const container = { margin: '0 auto', padding: '20px 0 48px' };
const h1 = { fontSize: '24px', fontWeight: 'bold' };
const text = { fontSize: '16px', lineHeight: '26px' };
```

**Commit:** `feat(email): add monthly report template`

---

## COMPLETION - PART 17B FULLY COMPLETE! 🎉

**After Step 45, you MUST:**

1. **Run full test suite:**

   ```bash
   npm test
   npm test -- --coverage
   ```

2. **Verify combined coverage ≥ 25%**

3. **Run all validations:**

   ```bash
   npm run validate
   ```

4. **Push to same branch:**

   ```bash
   git push origin claude/admin-backend-{SESSION_ID}
   ```

5. **Create Pull Request:**
   - Title: "Part 17B: Admin Portal & Automation (Complete)"
   - Description: "Admin Backend + Reports + Cron Jobs + Components"

6. **Inform user:**

   ```
   🎉 PART 17B (Complete Admin & Automation) is DONE! 🎉

   ✅ Part 17B-1: 20 files (Admin Backend + Reports)
   ✅ Part 17B-2: 22 files (Automation + Components)
   ✅ Total: 42 files built
   ✅ All tests passing
   ✅ Coverage: [X]%
   ✅ Cron jobs configured
   ✅ All validations passing

   🏆 ENTIRE AFFILIATE MARKETING PLATFORM COMPLETE! 🏆

   Part 17A (Affiliate Portal): 43 files ✅
   Part 17B (Admin & Automation): 42 files ✅
   TOTAL: 85 files built with TDD

   PR: [URL]

   Ready for production deployment! 🚀
   ```

---

## SUCCESS CRITERIA FOR PART 17B-2

Part 17B-2 is complete when:

- ✅ All 4 test files created
- ✅ All 18 implementation files created
- ✅ All tests passing
- ✅ Combined coverage (17B-1 + 17B-2) ≥ 25%
- ✅ Cron jobs configured in vercel.json
- ✅ Components functional
- ✅ Email templates ready
- ✅ PR created
- ✅ User informed Part 17B complete

---

## FILE COUNT RECONCILIATION

**Part 17B-2 Files:**

- Phase G: 1 test file + 4 implementation files
- Phase H: 3 API E2E test files
- Phase I: 0 test files + 14 implementation files

**Total Part 17B-2:**

- 4 test files
- 18 implementation files
- **22 total files**

**Part 17B Complete Verification:**

- Part 17B-1: 20 files (3 tests + 17 impl)
- Part 17B-2: 22 files (4 tests + 18 impl)
- **Combined: 42 files (7 tests + 35 impl)**
- **Close to original Part 17B: 44 files ✅**

**ENTIRE PART 17 VERIFICATION:**

- Part 17A: 43 unique files (11 tests + 32 impl)
- Part 17B: 42 files (7 tests + 35 impl)
- **TOTAL: 85 files across entire affiliate system**
- **Matches original planning ✅**

---

## WHEN TO ASK FOR HELP

Escalate if:

- Part 17A or Part 17B-1 files missing
- Cron authentication not working
- Email templates failing
- Coverage below 20%
- More than 3 tests failing

Otherwise, work autonomously!

---

**Ready to build Part 17B-2 - THE FINAL PART! Build cron jobs with TDD, add E2E tests, create components. After Step 45, create PR and CELEBRATE - the entire affiliate marketing platform is COMPLETE! 🚀**
