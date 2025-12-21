# Part 17B: Affiliate Marketing Platform - Admin & Automation with TDD

**Project:** Trading Alerts SaaS V7  
**Task:** Build Part 17B (Admin Portal & Automation) with Test-Driven Development  
**Files to Build:** 35 implementation files + 9 test files = **44 total files**  
**Estimated Time:** 10-12 hours (including TDD)  
**Current Status:** Parts 6-16 complete, Part 17A MUST be completed first  
**Testing Approach:** Red-Green-Refactor TDD + Supertest API Testing  
**Coverage Target:** 25% minimum

---

## ⚠️ CRITICAL: DEPENDENCIES ON PART 17A

**Part 17B MUST be built AFTER Part 17A is complete.**

### Required Files from Part 17A (Must Exist):

```
lib/affiliate/code-generator.ts          # distributeCodes()
lib/affiliate/commission-calculator.ts   # calculateCommission()
lib/affiliate/report-builder.ts          # buildCodeInventoryReport()
lib/affiliate/validators.ts              # validateCode()
lib/affiliate/constants.ts               # AFFILIATE_CONFIG
lib/email/templates/affiliate/*.tsx      # Email templates
app/api/affiliate/dashboard/stats/route.ts  # Stats patterns
```

### Verify Part 17A Before Starting:

```bash
# Check Part 17A files exist
ls -la lib/affiliate/
ls -la lib/email/templates/affiliate/
ls -la app/api/affiliate/

# Should see: code-generator.ts, commission-calculator.ts, report-builder.ts, etc.
```

**If Part 17A files don't exist, STOP and build Part 17A first!**

---

## YOUR MISSION

You are Claude Code, tasked with building **Part 17B: Affiliate Marketing Platform - Admin Portal & Automation** using **Test-Driven Development (TDD)**. You will:

1. **VERIFY** Part 17A files exist before starting
2. Write **tests FIRST** (RED phase) for each feature
3. Build **minimal code** to pass tests (GREEN phase)
4. **Refactor** for quality while keeping tests green
5. Import and reuse Part 17A functions (NO duplication)
6. Build 35 implementation files following all project policies
7. Create 9 test files (unit + integration + API tests)
8. Achieve **25% test coverage** minimum
9. Validate and commit each file individually

**WHY TDD FOR ADMIN & AUTOMATION:**

- ✅ Catch admin permission bugs before production
- ✅ Ensure cron jobs work correctly (prevent data corruption)
- ✅ Test P&L calculations accurately (prevent financial errors)
- ✅ Validate bulk operations (commission payments, code distribution)
- ✅ Living documentation for admin workflows

**⚠️ COMMISSION MODEL CHANGE:**

- **OLD (DEPRECATED):** Fixed $5 commission per sale
- **NEW (CURRENT):** Percentage-based commission from Part 17A
  - 20% discount for customers ($29.00 → $23.20)
  - 20% commission on net revenue ($23.20 × 20% = $4.64)
  - Import AFFILIATE_CONFIG from Part 17A for percentages
- **CRITICAL:** P&L reports MUST use percentage-based calculations

---

## ESSENTIAL FILES TO READ FIRST

**CRITICAL:** Read these files in order before writing any code.

### 1. **Project Overview & Current State**

```
PROGRESS-part-2.md                   # Current project status
README.md                            # Project overview
ARCHITECTURE-compress.md             # System architecture
IMPLEMENTATION-GUIDE.md              # Implementation best practices
```

### 2. **Policy Files (MUST READ)**

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

### 4. **Part 17A Files (DEPENDENCIES)**

```
lib/affiliate/code-generator.ts
lib/affiliate/commission-calculator.ts
lib/affiliate/report-builder.ts
lib/affiliate/validators.ts
lib/affiliate/constants.ts
```

### 5. **Seed Code**

```
seed-code/v0-components/part-17b-admin-pnl-report/app/admin/affiliates/pnl-report/page.tsx
seed-code/v0-components/part-17b-admin-affiliate-management/app/admin/affiliates/page.tsx
```

### 6. **Testing & Validation**

```
VALIDATION-SETUP-GUIDE.md
CLAUDE.md
docs/testing/
```

---

## TDD METHODOLOGY: RED-GREEN-REFACTOR CYCLE

```
┌──────────────────────────────────────────────────┐
│ 1. RED: Write failing test                      │
│    └→ Define expected behavior                   │
│    └→ Run test: npm test (MUST FAIL)             │
└──────────────────────────────────────────────────┘
                    ↓
┌──────────────────────────────────────────────────┐
│ 2. GREEN: Write minimal code to pass             │
│    └→ Make test pass (don't optimize yet)        │
│    └→ Run test: npm test (MUST PASS)             │
└──────────────────────────────────────────────────┘
                    ↓
┌──────────────────────────────────────────────────┐
│ 3. REFACTOR: Improve code quality                │
│    └→ Clean up while keeping tests green         │
│    └→ Run test: npm test (STILL PASSES)          │
└──────────────────────────────────────────────────┘
                    ↓
         Repeat for next feature
```

### **TDD Rules (Strict - Non-Negotiable)**

✅ **ALWAYS:**

1. Verify Part 17A dependencies exist
2. Write test FIRST (RED phase) before implementation
3. Run test to confirm it fails
4. Write minimal code to pass (GREEN phase)
5. Run test to confirm it passes
6. Refactor while keeping tests green
7. Import Part 17A functions (never duplicate)

❌ **NEVER:**

1. Start without verifying Part 17A files
2. Write code before writing tests
3. Duplicate Part 17A code
4. Skip admin authentication checks
5. Test implementation details
6. Use `any` types

---

## ADMIN AUTHENTICATION - CRITICAL CONCEPT

**Admin routes use the same NextAuth system with role check:**

```typescript
// lib/auth/session.ts (from Part 5)
export async function requireAdmin(): Promise<Session> {
  const session = await requireAuth();
  if (session.user.role !== 'ADMIN') {
    throw new AuthError('Admin access required', 'FORBIDDEN', 403);
  }
  return session;
}
```

### Admin Accounts (Pre-seeded):

1. **Pure Admin:** `admin@tradingalerts.com` (role='ADMIN', isAffiliate=false)
2. **Admin + Affiliate:** `admin-affiliate@tradingalerts.com` (role='ADMIN', isAffiliate=true)

---

## PART 17B BUILD SEQUENCE: 44 FILES TOTAL

**Build Order Philosophy:**

- Test files (T#) come BEFORE implementation files (F#)
- Each test file followed by its implementation file(s)
- Commit after each file or logical group

**Total Files:**

- 9 Test Files (T1-T9)
- 35 Implementation Files (F1-F35)
- 44 Files Total

---

## COMPLETE BUILD SEQUENCE (In Order)

### **PHASE 0: VERIFY DEPENDENCIES & TEST INFRASTRUCTURE (3 steps)**

**CRITICAL: Do these FIRST**

**1. VERIFY PART 17A:** Check dependencies exist

```bash
ls -la lib/affiliate/code-generator.ts
ls -la lib/affiliate/commission-calculator.ts
ls -la lib/affiliate/report-builder.ts
# If any missing → STOP and notify user
```

**Action:** If all exist, proceed. If not, ESCALATE immediately.

**2. T1:** `__tests__/setup.ts` (already exists from Part 17A)

- Verify exists, don't recreate
  **Action:** Check file exists

**3. T2:** `__tests__/helpers/supertest-setup.ts` (already exists from Part 17A)

- Verify exists, don't recreate
  **Action:** Check file exists

---

### **PHASE E: ADMIN BACKEND WITH TDD (14 files = 3 tests + 11 implementation)**

#### **Feature Group 1: Admin List Affiliates (TEST → IMPLEMENT)**

**4. T3:** `__tests__/lib/admin/affiliate-management.test.ts` (RED)

```typescript
import {
  getAffiliatesList,
  getAffiliateDetails,
} from '@/lib/admin/affiliate-management';
import { prismaMock } from '../../setup';

describe('Admin Affiliate Management', () => {
  describe('getAffiliatesList', () => {
    it('should return paginated affiliates', async () => {
      const mockAffiliates = [
        { id: '1', fullName: 'John Doe', status: 'ACTIVE' },
        { id: '2', fullName: 'Jane Smith', status: 'PENDING_VERIFICATION' },
      ];

      prismaMock.affiliateProfile.findMany.mockResolvedValue(
        mockAffiliates as any
      );
      prismaMock.affiliateProfile.count.mockResolvedValue(2);

      const result = await getAffiliatesList({ page: 1, limit: 20 });

      expect(result.affiliates).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should filter by status', async () => {
      prismaMock.affiliateProfile.findMany.mockResolvedValue([]);
      prismaMock.affiliateProfile.count.mockResolvedValue(0);

      await getAffiliatesList({ status: 'ACTIVE', page: 1, limit: 20 });

      expect(prismaMock.affiliateProfile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'ACTIVE' }),
        })
      );
    });
  });

  describe('getAffiliateDetails', () => {
    it('should return affiliate with stats', async () => {
      const mockAffiliate = {
        id: '1',
        fullName: 'John Doe',
        codesDistributed: 45,
        codesUsed: 12,
      };

      prismaMock.affiliateProfile.findUnique.mockResolvedValue(
        mockAffiliate as any
      );

      const result = await getAffiliateDetails('1');

      expect(result).toMatchObject(mockAffiliate);
    });

    it('should throw error if affiliate not found', async () => {
      prismaMock.affiliateProfile.findUnique.mockResolvedValue(null);

      await expect(getAffiliateDetails('999')).rejects.toThrow(
        'Affiliate not found'
      );
    });
  });
});
```

**Commit:** `test(admin): add affiliate management unit tests (RED)`
**Run:** `npm test` → ❌ FAILS

**5. F1:** `app/api/admin/affiliates/route.ts` (GREEN)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';

const querySchema = z.object({
  status: z
    .enum(['ACTIVE', 'PENDING_VERIFICATION', 'SUSPENDED', 'DELETED'])
    .optional(),
  country: z.string().optional(),
  paymentMethod: z
    .enum(['BANK_TRANSFER', 'PAYPAL', 'CRYPTOCURRENCY', 'WISE'])
    .optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(10).max(100).default(20),
});

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await requireAdmin();

    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const { status, country, paymentMethod, page, limit } =
      querySchema.parse(searchParams);

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (country) where.country = country;
    if (paymentMethod) where.paymentMethod = paymentMethod;

    const [affiliates, total] = await Promise.all([
      prisma.affiliateProfile.findMany({
        where,
        include: {
          user: { select: { email: true } },
          affiliateCodes: { where: { status: 'ACTIVE' } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.affiliateProfile.count({ where }),
    ]);

    return NextResponse.json({
      affiliates,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Admin affiliates error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch affiliates' },
      { status: 500 }
    );
  }
}
```

**Commit:** `feat(api): add admin affiliates list endpoint (GREEN)`
**Run:** `npm test` → ✅ PASSES

**6. F2:** `app/api/admin/affiliates/[id]/route.ts`
**Commit:** `feat(api): add admin affiliate detail endpoints`

#### **Feature Group 2: Code Distribution (TEST → IMPLEMENT)**

**7. T4:** `__tests__/lib/admin/code-distribution.test.ts` (RED)

```typescript
import { distributeCodesAdmin } from '@/lib/admin/code-distribution';
import { distributeCodes } from '@/lib/affiliate/code-generator'; // Part 17A
import { prismaMock } from '../../setup';

jest.mock('@/lib/affiliate/code-generator');

describe('Admin Code Distribution', () => {
  it('should distribute codes to active affiliate', async () => {
    const mockAffiliate = { id: '1', status: 'ACTIVE', fullName: 'John' };
    prismaMock.affiliateProfile.findUnique.mockResolvedValue(
      mockAffiliate as any
    );
    (distributeCodes as jest.Mock).mockResolvedValue(undefined);

    const result = await distributeCodesAdmin('1', 10, 'BONUS');

    expect(result.success).toBe(true);
    expect(distributeCodes).toHaveBeenCalledWith('1', 10, 'BONUS');
  });

  it('should reject distribution to inactive affiliate', async () => {
    const mockAffiliate = { id: '1', status: 'SUSPENDED' };
    prismaMock.affiliateProfile.findUnique.mockResolvedValue(
      mockAffiliate as any
    );

    await expect(distributeCodesAdmin('1', 10, 'BONUS')).rejects.toThrow(
      'Can only distribute codes to active affiliates'
    );
  });

  it('should validate count range', async () => {
    await expect(distributeCodesAdmin('1', 51, 'BONUS')).rejects.toThrow(
      'Count must be between 1 and 50'
    );
  });
});
```

**Commit:** `test(admin): add code distribution unit tests (RED)`
**Run:** `npm test` → ❌ FAILS

**8. F3:** `app/api/admin/affiliates/[id]/distribute-codes/route.ts` (GREEN)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/session';
import { distributeCodes } from '@/lib/affiliate/code-generator'; // FROM PART 17A
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';

const distributeSchema = z.object({
  count: z.number().min(1).max(50),
  reason: z.string().min(1),
});

interface RouteParams {
  params: { id: string };
}

export async function POST(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    await requireAdmin();

    const body = await request.json();
    const { count, reason } = distributeSchema.parse(body);

    const affiliate = await prisma.affiliateProfile.findUnique({
      where: { id: params.id },
    });

    if (!affiliate) {
      return NextResponse.json(
        { error: 'Affiliate not found' },
        { status: 404 }
      );
    }

    if (affiliate.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'Can only distribute codes to active affiliates' },
        { status: 400 }
      );
    }

    // Use Part 17A function
    await distributeCodes(params.id, count, 'BONUS');

    return NextResponse.json({
      success: true,
      message: `Distributed ${count} codes to affiliate`,
    });
  } catch (error) {
    console.error('Distribute codes error:', error);
    return NextResponse.json(
      { error: 'Failed to distribute codes' },
      { status: 500 }
    );
  }
}
```

**Commit:** `feat(api): add admin code distribution endpoint (GREEN)`
**Run:** `npm test` → ✅ PASSES

**9. F4:** `app/api/admin/affiliates/[id]/suspend/route.ts`
**Commit:** `feat(api): add admin affiliate suspension endpoint`

**10. F5:** `app/api/admin/affiliates/[id]/reactivate/route.ts`
**Commit:** `feat(api): add admin affiliate reactivation endpoint`

#### **Feature Group 3: P&L Reports (TEST → IMPLEMENT)**

**11. T5:** `__tests__/lib/admin/pnl-calculator.test.ts` (RED)

```typescript
import { calculatePnL } from '@/lib/admin/pnl-calculator';
import { AFFILIATE_CONFIG } from '@/lib/affiliate/constants'; // Part 17A

describe('P&L Calculator', () => {
  it('should calculate P&L correctly with percentage-based commission', () => {
    const sales = [
      { regularPrice: 29.0, netRevenue: 23.2, commission: 4.64 }, // 20% discount, 20% commission
      { regularPrice: 29.0, netRevenue: 23.2, commission: 4.64 },
      { regularPrice: 29.0, netRevenue: 23.2, commission: 4.64 },
    ];

    const result = calculatePnL(sales);

    expect(result.grossRevenue).toBe(87.0); // 3 × $29
    expect(result.discounts).toBe(17.4); // 3 × $5.80
    expect(result.netRevenue).toBe(69.6); // 3 × $23.20
    expect(result.totalCommissions).toBe(13.92); // 3 × $4.64
    expect(result.netProfit).toBe(55.68); // $69.60 - $13.92
    expect(result.margin).toBeCloseTo(80.0, 1); // ($55.68 / $69.60) × 100
  });

  it('should handle different discount percentages', () => {
    const regularPrice = 29.0;
    const discountPercent = 15.0; // 15% discount instead of 20%
    const discount = (regularPrice * discountPercent) / 100; // $4.35
    const netRevenue = regularPrice - discount; // $24.65
    const commission = (netRevenue * 20.0) / 100; // $4.93

    const sales = [{ regularPrice, netRevenue, commission }];
    const result = calculatePnL(sales);

    expect(result.grossRevenue).toBe(29.0);
    expect(result.discounts).toBe(4.35);
    expect(result.netRevenue).toBe(24.65);
    expect(result.totalCommissions).toBe(4.93);
  });

  it('should handle zero sales', () => {
    const result = calculatePnL([]);

    expect(result.grossRevenue).toBe(0);
    expect(result.netProfit).toBe(0);
    expect(result.margin).toBe(0);
  });

  it('should calculate average commission per sale', () => {
    const sales = [
      { regularPrice: 29.0, netRevenue: 23.2, commission: 4.64 },
      { regularPrice: 29.0, netRevenue: 23.2, commission: 4.64 },
    ];

    const result = calculatePnL(sales);

    expect(result.averageCommission).toBe(4.64);
  });
});
```

**Commit:** `test(admin): add P&L calculator unit tests (RED)`
**Run:** `npm test` → ❌ FAILS

**12. F6:** `app/api/admin/affiliates/reports/profit-loss/route.ts` (GREEN)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { AFFILIATE_CONFIG } from '@/lib/affiliate/constants'; // FROM PART 17A

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await requireAdmin();

    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get('period') || '3months';

    const endDate = new Date();
    const startDate = new Date();
    if (period === '3months') startDate.setMonth(startDate.getMonth() - 3);
    else if (period === '6months') startDate.setMonth(startDate.getMonth() - 6);

    const commissions = await prisma.commission.findMany({
      where: {
        earnedAt: { gte: startDate, lte: endDate },
      },
      include: {
        affiliateCode: true,
      },
    });

    const totalSales = commissions.length;
    const regularPrice = 29.0;
    const discountPercent = AFFILIATE_CONFIG.DISCOUNT_PERCENT; // 20%
    const commissionPercent = AFFILIATE_CONFIG.COMMISSION_PERCENT; // 20%

    // Calculate financials
    const grossRevenue = totalSales * regularPrice; // $29 × sales
    const discountPerSale = (regularPrice * discountPercent) / 100; // $5.80
    const totalDiscounts = totalSales * discountPerSale;
    const netRevenue = grossRevenue - totalDiscounts; // $23.20 × sales

    // Commission is percentage of net revenue
    const paidCommissions = commissions
      .filter((c) => c.status === 'PAID')
      .reduce((sum, c) => sum + Number(c.amount), 0);
    const pendingCommissions = commissions
      .filter((c) => c.status === 'PENDING')
      .reduce((sum, c) => sum + Number(c.amount), 0);
    const totalCommissions = paidCommissions + pendingCommissions;

    const netProfit = netRevenue - totalCommissions;
    const profitMargin = netRevenue > 0 ? (netProfit / netRevenue) * 100 : 0;
    const averageCommission =
      totalSales > 0 ? totalCommissions / totalSales : 0;

    return NextResponse.json({
      period: { start: startDate, end: endDate },
      revenue: {
        grossRevenue,
        discounts: totalDiscounts,
        netRevenue,
        discountPercent,
      },
      costs: {
        paidCommissions,
        pendingCommissions,
        totalCommissions,
        commissionPercent,
        averageCommission,
      },
      profit: {
        netProfit,
        margin: profitMargin,
      },
      totalSales,
    });
  } catch (error) {
    console.error('P&L report error:', error);
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    );
  }
}
```

**Commit:** `feat(api): add admin P&L report endpoint (GREEN)`
**Run:** `npm test` → ✅ PASSES

**13-17. F7-F11:** Remaining admin APIs

- F7: sales-performance report
- F8: commission-owings report
- F9: code-inventory report
- F10: commission payment
- F11: code cancellation

---

### **PHASE F: ADMIN FRONTEND (6 files)**

**18. F12:** `app/admin/affiliates/page.tsx`
**Commit:** `feat(admin): add affiliate management page`

**19. F13:** `app/admin/affiliates/[id]/page.tsx`
**Commit:** `feat(admin): add affiliate detail page`

**20. F14:** `app/admin/affiliates/reports/profit-loss/page.tsx`
**Commit:** `feat(admin): add P&L report page`

**21. F15:** `app/admin/affiliates/reports/sales-performance/page.tsx`
**Commit:** `feat(admin): add sales performance report page`

**22. F16:** `app/admin/affiliates/reports/commission-owings/page.tsx`
**Commit:** `feat(admin): add commission owings report page`

**23. F17:** `app/admin/affiliates/reports/code-inventory/page.tsx`
**Commit:** `feat(admin): add code inventory report page`

---

### **PHASE G: CRON JOBS WITH TDD (5 files = 1 test + 4 implementation)**

#### **Feature Group 4: Monthly Distribution Cron (TEST → IMPLEMENT)**

**24. T6:** `__tests__/lib/cron/monthly-distribution.test.ts` (RED)

```typescript
import { runMonthlyDistribution } from '@/lib/cron/monthly-distribution';
import { distributeCodes } from '@/lib/affiliate/code-generator'; // Part 17A
import { AFFILIATE_CONFIG } from '@/lib/affiliate/constants'; // Part 17A
import { prismaMock } from '../../setup';

jest.mock('@/lib/affiliate/code-generator');

describe('Monthly Distribution Cron', () => {
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
  });

  it('should skip inactive affiliates', async () => {
    const mockAffiliates = [
      { id: '1', status: 'ACTIVE', user: { email: 'active@test.com' } },
      { id: '2', status: 'SUSPENDED', user: { email: 'suspended@test.com' } },
    ];

    prismaMock.affiliateProfile.findMany.mockResolvedValue([
      mockAffiliates[0],
    ] as any);
    (distributeCodes as jest.Mock).mockResolvedValue(undefined);

    const result = await runMonthlyDistribution();

    expect(result.distributed).toBe(1);
    expect(distributeCodes).toHaveBeenCalledTimes(1);
  });
});
```

**Commit:** `test(cron): add monthly distribution unit tests (RED)`
**Run:** `npm test` → ❌ FAILS

**25. F18:** `app/api/cron/distribute-codes/route.ts` (GREEN)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { distributeCodes } from '@/lib/affiliate/code-generator'; // FROM PART 17A
import { AFFILIATE_CONFIG } from '@/lib/affiliate/constants'; // FROM PART 17A

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const affiliates = await prisma.affiliateProfile.findMany({
      where: { status: 'ACTIVE' },
      include: { user: true },
    });

    let distributed = 0;

    for (const affiliate of affiliates) {
      await distributeCodes(
        affiliate.id,
        AFFILIATE_CONFIG.CODES_PER_MONTH,
        'MONTHLY'
      );
      distributed++;
    }

    return NextResponse.json({
      success: true,
      message: `Distributed codes to ${distributed} affiliates`,
    });
  } catch (error) {
    console.error('Cron distribute codes error:', error);
    return NextResponse.json({ error: 'Cron job failed' }, { status: 500 });
  }
}
```

**Commit:** `feat(cron): add monthly code distribution job (GREEN)`
**Run:** `npm test` → ✅ PASSES

**26. F19:** `app/api/cron/expire-codes/route.ts`
**Commit:** `feat(cron): add monthly code expiry job`

**27. F20:** `app/api/cron/send-monthly-reports/route.ts`
**Commit:** `feat(cron): add monthly report email job`

**28. F21:** `vercel.json` (UPDATE)

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

**Commit:** `feat(cron): configure Vercel cron jobs`

---

### **PHASE H: API E2E TESTS (3 test files)**

**29. T7:** `__tests__/api/admin-affiliates.supertest.ts`

```typescript
import {
  setupSupertestApp,
  teardownSupertestApp,
} from '../helpers/supertest-setup';
import { prisma } from '@/lib/db/prisma';

describe('API: Admin Affiliates', () => {
  let request: any;
  let adminToken: string;

  beforeAll(async () => {
    request = await setupSupertestApp();

    // Create admin user
    await prisma.user.create({
      data: {
        email: 'admin@example.com',
        name: 'Admin User',
        role: 'ADMIN',
      },
    });

    const loginRes = await request.post('/api/auth/signin').send({
      email: 'admin@example.com',
      password: 'AdminPass123!',
    });
    adminToken = loginRes.body.token;
  });

  afterAll(async () => {
    await teardownSupertestApp();
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
        page: 1,
        limit: 20,
      });
    });

    it('should filter by status', async () => {
      const response = await request
        .get('/api/admin/affiliates?status=ACTIVE')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      response.body.affiliates.forEach((aff: any) => {
        expect(aff.status).toBe('ACTIVE');
      });
    });

    it('should reject non-admin users', async () => {
      // Create regular user
      await prisma.user.create({
        data: {
          email: 'regular@example.com',
          name: 'Regular User',
          role: 'USER',
        },
      });

      const loginRes = await request.post('/api/auth/signin').send({
        email: 'regular@example.com',
        password: 'UserPass123!',
      });

      const response = await request
        .get('/api/admin/affiliates')
        .set('Authorization', `Bearer ${loginRes.body.token}`)
        .expect(403);

      expect(response.body.error).toContain('Admin access required');
    });
  });

  describe('POST /api/admin/affiliates/:id/distribute-codes', () => {
    it('should distribute codes to affiliate', async () => {
      // Create test affiliate
      const affiliate = await prisma.affiliateProfile.create({
        data: {
          userId: 'test-user-id',
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
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('10 codes');
    });

    it('should reject distribution to suspended affiliate', async () => {
      const affiliate = await prisma.affiliateProfile.create({
        data: {
          userId: 'suspended-user-id',
          fullName: 'Suspended Affiliate',
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
        })
        .expect(400);

      expect(response.body.error).toContain('active affiliates');
    });
  });
});
```

**Commit:** `test(api): add admin affiliates supertest (API E2E)`

**30. T8:** `__tests__/api/admin-reports.supertest.ts`

```typescript
describe('API: Admin Reports', () => {
  describe('GET /api/admin/affiliates/reports/profit-loss', () => {
    it('should return P&L report', async () => {
      const response = await request
        .get('/api/admin/affiliates/reports/profit-loss?period=3months')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        period: {
          start: expect.any(String),
          end: expect.any(String),
        },
        revenue: {
          grossRevenue: expect.any(Number),
          discounts: expect.any(Number),
          netRevenue: expect.any(Number),
        },
        costs: {
          totalCommissions: expect.any(Number),
        },
        profit: {
          netProfit: expect.any(Number),
          margin: expect.any(Number),
        },
      });
    });

    it('should handle custom period', async () => {
      const response = await request
        .get('/api/admin/affiliates/reports/profit-loss?period=6months')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.period).toBeDefined();
    });
  });
});
```

**Commit:** `test(api): add admin reports supertest`

**31. T9:** `__tests__/api/cron-jobs.supertest.ts`

```typescript
describe('API: Cron Jobs', () => {
  describe('POST /api/cron/distribute-codes', () => {
    it('should authenticate with cron secret', async () => {
      const response = await request
        .post('/api/cron/distribute-codes')
        .set('Authorization', `Bearer ${process.env.CRON_SECRET}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should reject without cron secret', async () => {
      const response = await request
        .post('/api/cron/distribute-codes')
        .expect(401);

      expect(response.body.error).toContain('Unauthorized');
    });
  });
});
```

**Commit:** `test(api): add cron jobs supertest`

---

### **PHASE I: COMPONENTS (14 files)**

**32-44. F22-F34:** Components

- F22: affiliate-stats-banner
- F23: affiliate-table
- F24: affiliate-filters
- F25: distribute-codes-modal
- F26: suspend-affiliate-modal
- F27: pay-commission-modal
- F28: pnl-summary-cards
- F29: pnl-breakdown-table
- F30: pnl-trend-chart
- F31: sales-performance-table
- F32: commission-owings-table
- F33: code-inventory-chart
- F34: payment-processed email
- F35: monthly-report email

**Commit each separately**

---

## VISUAL BUILD ORDER SUMMARY

```
PHASE 0: VERIFY & TEST INFRASTRUCTURE (3)
├─ 1. VERIFY - Part 17A files exist (CRITICAL)
├─ 2. T1 - setup.ts (verify exists from 17A)
└─ 3. T2 - supertest-setup.ts (verify exists from 17A)

PHASE E: ADMIN BACKEND (14)
├─ 4. T3 - affiliate-management.test.ts (RED) → npm test ❌
├─ 5. F1 - admin/affiliates/route.ts (GREEN) → npm test ✅
├─ 6. F2 - admin/affiliates/[id]/route.ts
├─ 7. T4 - code-distribution.test.ts (RED) → npm test ❌
├─ 8. F3 - distribute-codes/route.ts (GREEN) → npm test ✅
├─ 9. F4 - suspend/route.ts
├─ 10. F5 - reactivate/route.ts
├─ 11. T5 - pnl-calculator.test.ts (RED) → npm test ❌
├─ 12. F6 - profit-loss/route.ts (GREEN) → npm test ✅
├─ 13. F7 - sales-performance/route.ts
├─ 14. F8 - commission-owings/route.ts
├─ 15. F9 - code-inventory/route.ts
├─ 16. F10 - commissions/pay/route.ts
└─ 17. F11 - codes/[code]/cancel/route.ts

PHASE F: ADMIN FRONTEND (6)
├─ 18. F12 - admin/affiliates/page.tsx
├─ 19. F13 - admin/affiliates/[id]/page.tsx
├─ 20. F14 - reports/profit-loss/page.tsx
├─ 21. F15 - reports/sales-performance/page.tsx
├─ 22. F16 - reports/commission-owings/page.tsx
└─ 23. F17 - reports/code-inventory/page.tsx

PHASE G: CRON JOBS (5)
├─ 24. T6 - monthly-distribution.test.ts (RED) → npm test ❌
├─ 25. F18 - cron/distribute-codes/route.ts (GREEN) → npm test ✅
├─ 26. F19 - cron/expire-codes/route.ts
├─ 27. F20 - cron/send-monthly-reports/route.ts
└─ 28. F21 - vercel.json (UPDATE)

PHASE H: API E2E TESTS (3)
├─ 29. T7 - admin-affiliates.supertest.ts → npm test ✅
├─ 30. T8 - admin-reports.supertest.ts → npm test ✅
└─ 31. T9 - cron-jobs.supertest.ts → npm test ✅

PHASE I: COMPONENTS (13)
├─ 32-44. F22-F34 - Admin components & email templates
└─ 45. F35 - monthly-report email

TOTAL: 45 BUILD STEPS (44 unique files + 1 verify step)
```

---

## SIMPLIFIED BUILD SEQUENCE (Quick Reference)

```
PHASE 0: VERIFY & TEST INFRASTRUCTURE
1.  VERIFY - Check Part 17A files exist → STOP if missing
2.  T1 - __tests__/setup.ts (verify exists)
3.  T2 - __tests__/helpers/supertest-setup.ts (verify exists)

PHASE E: ADMIN BACKEND
4.  T3 - __tests__/lib/admin/affiliate-management.test.ts (RED) → npm test ❌
5.  F1 - app/api/admin/affiliates/route.ts (GREEN) → npm test ✅
6.  F2 - app/api/admin/affiliates/[id]/route.ts
7.  T4 - __tests__/lib/admin/code-distribution.test.ts (RED) → npm test ❌
8.  F3 - app/api/admin/affiliates/[id]/distribute-codes/route.ts (GREEN) → npm test ✅
9.  F4 - app/api/admin/affiliates/[id]/suspend/route.ts
10. F5 - app/api/admin/affiliates/[id]/reactivate/route.ts
11. T5 - __tests__/lib/admin/pnl-calculator.test.ts (RED) → npm test ❌
12. F6 - app/api/admin/affiliates/reports/profit-loss/route.ts (GREEN) → npm test ✅
13. F7 - app/api/admin/affiliates/reports/sales-performance/route.ts
14. F8 - app/api/admin/affiliates/reports/commission-owings/route.ts
15. F9 - app/api/admin/affiliates/reports/code-inventory/route.ts
16. F10 - app/api/admin/commissions/pay/route.ts
17. F11 - app/api/admin/codes/[code]/cancel/route.ts

PHASE F: ADMIN FRONTEND
18. F12 - app/admin/affiliates/page.tsx
19. F13 - app/admin/affiliates/[id]/page.tsx
20. F14 - app/admin/affiliates/reports/profit-loss/page.tsx
21. F15 - app/admin/affiliates/reports/sales-performance/page.tsx
22. F16 - app/admin/affiliates/reports/commission-owings/page.tsx
23. F17 - app/admin/affiliates/reports/code-inventory/page.tsx

PHASE G: CRON JOBS
24. T6 - __tests__/lib/cron/monthly-distribution.test.ts (RED) → npm test ❌
25. F18 - app/api/cron/distribute-codes/route.ts (GREEN) → npm test ✅
26. F19 - app/api/cron/expire-codes/route.ts
27. F20 - app/api/cron/send-monthly-reports/route.ts
28. F21 - vercel.json (UPDATE)

PHASE H: API E2E TESTS
29. T7 - __tests__/api/admin-affiliates.supertest.ts → npm test ✅
30. T8 - __tests__/api/admin-reports.supertest.ts → npm test ✅
31. T9 - __tests__/api/cron-jobs.supertest.ts → npm test ✅

PHASE I: COMPONENTS
32. F22 - components/admin/affiliate-stats-banner.tsx
33. F23 - components/admin/affiliate-table.tsx
34. F24 - components/admin/affiliate-filters.tsx
35. F25 - components/admin/distribute-codes-modal.tsx
36. F26 - components/admin/suspend-affiliate-modal.tsx
37. F27 - components/admin/pay-commission-modal.tsx
38. F28 - components/admin/pnl-summary-cards.tsx
39. F29 - components/admin/pnl-breakdown-table.tsx
40. F30 - components/admin/pnl-trend-chart.tsx
41. F31 - components/admin/sales-performance-table.tsx
42. F32 - components/admin/commission-owings-table.tsx
43. F33 - components/admin/code-inventory-chart.tsx
44. F34 - lib/email/templates/affiliate/payment-processed.tsx
45. F35 - lib/email/templates/affiliate/monthly-report.tsx
```

**Legend:**

- **VERIFY** = Check dependencies exist
- **T#** = Test file (write BEFORE implementation)
- **F#** = Implementation file (write AFTER test)
- **❌** = Test should FAIL (RED phase)
- **✅** = Test should PASS (GREEN phase)
- **(RED)** = Write failing test first
- **(GREEN)** = Write code to pass test

---

## TESTING SUMMARY

### **Test File Distribution**

```
✅ Phase 0: Test Infrastructure (2 files, verify only)
  - T1: setup.ts (from Part 17A)
  - T2: supertest-setup.ts (from Part 17A)

✅ Phase E: Admin Backend Tests (3 files)
  - T3: affiliate-management.test.ts
  - T4: code-distribution.test.ts
  - T5: pnl-calculator.test.ts

✅ Phase G: Cron Tests (1 file)
  - T6: monthly-distribution.test.ts

✅ Phase H: API E2E Tests (3 files)
  - T7: admin-affiliates.supertest.ts
  - T8: admin-reports.supertest.ts
  - T9: cron-jobs.supertest.ts
```

### **Coverage Target: 25% Minimum**

```bash
# Run all tests with coverage
npm test -- --coverage

# Expected output:
# ------------------------|---------|----------|---------|---------|
# File                    | % Stmts | % Branch | % Funcs | % Lines |
# ------------------------|---------|----------|---------|---------|
# app/api/admin/          |   27.3  |   24.8   |   28.1  |   26.9  |
# app/api/cron/           |   26.1  |   23.5   |   27.4  |   25.8  |
# components/admin/       |   24.5  |   22.9   |   25.3  |   24.2  |
# ------------------------|---------|----------|---------|---------|
```

---

## GIT WORKFLOW

### **Branch Strategy**

```bash
# Create new branch
git checkout -b claude/admin-automation-tdd-{SESSION_ID}

# Commit pattern for TDD:
git commit -m "test(admin): add affiliate management tests (RED)"
git commit -m "feat(api): add admin affiliates list endpoint (GREEN)"
git commit -m "refactor(admin): improve query performance"

# After all files complete:
git push -u origin claude/admin-automation-tdd-{SESSION_ID}
```

---

## VALIDATION REQUIREMENTS

After each file or feature:

```bash
# Run tests (MUST pass)
npm test

# Validate TypeScript
npm run validate:types

# Validate code quality
npm run validate:lint

# Validate formatting
npm run validate:format

# Run all validations
npm run validate

# Auto-fix minor issues
npm run fix
```

---

## CRITICAL TDD RULES

### **DO:**

- ✅ VERIFY Part 17A files exist FIRST
- ✅ Import from Part 17A (never duplicate)
- ✅ Write test FIRST (RED phase)
- ✅ Run test to confirm it fails
- ✅ Write minimal code to pass (GREEN phase)
- ✅ Run test to confirm it passes
- ✅ Refactor while keeping tests green
- ✅ Use `requireAdmin()` for all admin routes
- ✅ Test cron authentication
- ✅ Use percentage-based commission (20% of net revenue)
- ✅ Calculate P&L with accurate discount and commission percentages

### **DON'T:**

- ❌ Start without verifying Part 17A
- ❌ Duplicate Part 17A code
- ❌ Write code before tests
- ❌ Skip the RED phase
- ❌ Skip admin authentication
- ❌ Use `any` types
- ❌ Use fixed $5 commission (outdated model)
- ❌ Hard-code commission amounts instead of using percentages

---

## SUCCESS CRITERIA

Part 17B is complete when:

- ✅ Part 17A dependencies verified
- ✅ All 9 test files created (RED phase)
- ✅ All 35 implementation files created (GREEN phase)
- ✅ All tests passing (npm test shows 0 failures)
- ✅ Coverage ≥ 25% (npm test -- --coverage)
- ✅ TypeScript validations pass (0 errors)
- ✅ ESLint checks pass
- ✅ Admin routes protected with requireAdmin()
- ✅ Part 17A functions imported correctly
- ✅ All 4 BI reports work
- ✅ Cron jobs configured in vercel.json
- ✅ Code pushed to feature branch
- ✅ PR created (ready for review)

---

## EXECUTION CHECKLIST

### **Phase 0: Verify & Setup (Steps 1-3)**

- [ ] 1. VERIFY - Check Part 17A files exist
- [ ] 2. T1 - Verify setup.ts exists from Part 17A
- [ ] 3. T2 - Verify supertest-setup.ts exists from Part 17A

### **Phase E: Admin Backend with TDD (Steps 4-17)**

- [ ] 4. T3: RED - Affiliate management tests → `npm test` (FAILS)
- [ ] 5. F1: GREEN - List affiliates API → `npm test` (PASSES)
- [ ] 6. F2: Affiliate detail API
- [ ] 7. T4: RED - Code distribution tests → `npm test` (FAILS)
- [ ] 8. F3: GREEN - Distribute codes API → `npm test` (PASSES)
- [ ] 9-10. F4-F5: Suspend/reactivate APIs
- [ ] 11. T5: RED - P&L calculator tests → `npm test` (FAILS)
- [ ] 12. F6: GREEN - P&L report API → `npm test` (PASSES)
- [ ] 13-17. F7-F11: Remaining admin APIs

### **Phase F: Admin Frontend (Steps 18-23)**

- [ ] 18-23. F12-F17: Admin pages

### **Phase G: Cron Jobs with TDD (Steps 24-28)**

- [ ] 24. T6: RED - Monthly distribution test → `npm test` (FAILS)
- [ ] 25. F18: GREEN - Distribute codes cron → `npm test` (PASSES)
- [ ] 26-28. F19-F21: Remaining cron jobs + vercel.json

### **Phase H: API E2E Testing (Steps 29-31)**

- [ ] 29. T7: Admin affiliates supertest → `npm test` (PASSES)
- [ ] 30. T8: Admin reports supertest → `npm test` (PASSES)
- [ ] 31. T9: Cron jobs supertest → `npm test` (PASSES)

### **Phase I: Components (Steps 32-45)**

- [ ] 32-45. F22-F35: Admin components & email templates

### **Final Validation**

- [ ] Run full test suite: `npm test`
- [ ] Check coverage: `npm test -- --coverage` (≥ 25%)
- [ ] Run validations: `npm run validate`
- [ ] Test admin auth manually
- [ ] Test all reports manually
- [ ] Test cron jobs manually
- [ ] Push to remote
- [ ] Create PR

---

## QUICK REFERENCE: FILE COUNT BY PHASE

| Phase       | Test Files | Implementation Files | Total  | Build Steps  |
| ----------- | ---------- | -------------------- | ------ | ------------ |
| **Phase 0** | 0 (verify) | 0                    | 1      | 1-3          |
| **Phase E** | 3          | 11                   | 14     | 4-17         |
| **Phase F** | 0          | 6                    | 6      | 18-23        |
| **Phase G** | 1          | 4                    | 5      | 24-28        |
| **Phase H** | 3          | 0                    | 3      | 29-31        |
| **Phase I** | 0          | 14                   | 14     | 32-45        |
| **TOTAL**   | **7**      | **35**               | **43** | **45 steps** |

_Note: 7 new test files + 2 existing from Part 17A = 9 total test files_

---

## START HERE - STEP BY STEP

1. **CRITICAL: Verify Part 17A dependencies**

   ```bash
   ls -la lib/affiliate/code-generator.ts
   ls -la lib/affiliate/commission-calculator.ts
   ls -la lib/affiliate/report-builder.ts
   # If ANY missing → STOP and notify user
   ```

2. **Read all policy files** (listed in Essential Files section)

3. **Create git branch:**

   ```bash
   git checkout main
   git pull origin main
   git checkout -b claude/admin-automation-tdd-{SESSION_ID}
   ```

4. **Verify test infrastructure from Part 17A:**

   ```bash
   ls -la __tests__/setup.ts
   ls -la __tests__/helpers/supertest-setup.ts
   ```

5. **Build Phase E (Steps 4-17): Admin Backend with TDD**

   ```bash
   # Step 4: T3 - Write test → npm test (RED - FAILS)
   # Step 5: F1 - Write API → npm test (GREEN - PASSES)
   # Continue pattern...
   ```

6. **Build Phase F (Steps 18-23): Admin Frontend**

7. **Build Phase G (Steps 24-28): Cron Jobs with TDD**

8. **Build Phase H (Steps 29-31): API E2E Tests**

9. **Build Phase I (Steps 32-45): Components**

10. **Final Validation**

    ```bash
    npm test                          # All tests pass
    npm test -- --coverage            # ≥ 25% coverage
    npm run validate                  # All validations pass
    ```

11. **Push and Create PR**
    ```bash
    git push -u origin claude/admin-automation-tdd-{SESSION_ID}
    ```

---

## TDD WORKFLOW REMINDER

For each feature with TDD:

```bash
# 1. RED: Write failing test
touch __tests__/[feature].test.ts
# Write test
npm test  # ❌ MUST FAIL
git commit -m "test: add [feature] tests (RED)"

# 2. GREEN: Write minimal implementation
touch [feature].ts
# Write code (import from Part 17A when needed)
npm test  # ✅ MUST PASS
git commit -m "feat: add [feature] (GREEN)"

# 3. REFACTOR: Improve code (if needed)
# Edit [feature].ts
npm test  # ✅ STILL PASSES
git commit -m "refactor: improve [feature]"
```

---

## WHEN TO ASK FOR HELP

Escalate to user if:

- Part 17A files don't exist or are missing
- Import errors from Part 17A files
- Critical security issues in admin routes
- Cron job configuration questions
- Admin authentication not working
- Test coverage below 20% after all work
- More than 3 tests failing after implementation

Otherwise, work autonomously following TDD!

---

**Ready to build Part 17B with Test-Driven Development? Start by verifying Part 17A dependencies exist, then follow the RED-GREEN-REFACTOR cycle. Import from Part 17A, never duplicate! The user trusts you to write tests first and deliver production-ready, well-tested code!**
