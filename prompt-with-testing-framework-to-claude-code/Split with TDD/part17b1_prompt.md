# Part 17B-1: Admin Portal - Backend & Reports with TDD

**Project:** Trading Alerts SaaS V7  
**Task:** Build Part 17B-1 (Admin Backend & Reports) with Test-Driven Development  
**Files to Build:** 14 implementation files + 6 test files = **20 total files**  
**Estimated Time:** 4-6 hours (including TDD)  
**Current Status:** Part 17A complete (Affiliate Portal)  
**Testing Approach:** Red-Green-Refactor TDD + Supertest API Testing  
**Coverage Target:** Maintain 25% minimum (combined)

---

## ⚠️ CRITICAL: THIS IS PART 17B-1 OF 2 - REQUIRES PART 17A

**Part 17B is split into TWO parts:**

- **Part 17B-1 (THIS PART)**: Admin Backend + Reports (20 files, Steps 1-23)
- **Part 17B-2 (NEXT PART)**: Automation + Components (22 files, Steps 24-45)

**DEPENDENCIES - MUST VERIFY FIRST:**

```bash
# Check Part 17A files exist (CRITICAL)
ls -la lib/affiliate/code-generator.ts
ls -la lib/affiliate/commission-calculator.ts
ls -la lib/affiliate/report-builder.ts
ls -la lib/affiliate/validators.ts
ls -la lib/affiliate/constants.ts
ls -la app/api/affiliate/auth/register/route.ts
ls -la __tests__/setup.ts

# All must exist - if ANY missing, STOP and escalate
```

**STOPPING POINT:** After completing Step 23 (F17: code inventory report page), you will:

1. Push code to branch `claude/admin-backend-{SESSION_ID}`
2. Run all validations
3. Inform user that Part 17B-1 is complete
4. **DO NOT** proceed to cron jobs or components - that's Part 17B-2

**WHY THIS SPLIT:**

- ✅ Natural breakpoint after admin reports complete
- ✅ Admin backend can be tested independently
- ✅ Manageable context (20 files vs 44)
- ✅ Clear deliverable: Working admin portal
- ✅ Part 17B-2 will build automation on this foundation

---

## YOUR MISSION

You are Claude Code, tasked with building **Part 17B-1: Admin Backend & Reports** using **Test-Driven Development (TDD)**. You will:

1. **Verify Part 17A dependencies** exist
2. Build **admin backend APIs** with TDD (Phase E)
3. Create **admin frontend pages** (Phase F)
4. Import and reuse Part 17A functions (NO duplication)
5. Maintain **25% test coverage** minimum
6. Stop at Step 23 (after all admin pages)
7. Push to feature branch and validate

**DELIVERABLE:** Complete admin portal with BI reports, ready for automation (Part 17B-2).

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
lib/affiliate/commission-calculator.ts   # calculateCommission()
lib/affiliate/report-builder.ts          # buildCodeInventoryReport()
lib/affiliate/validators.ts
lib/affiliate/constants.ts               # AFFILIATE_CONFIG
__tests__/setup.ts
__tests__/helpers/supertest-setup.ts
```

### 5. **Seed Code**

```
seed-code/v0-components/part-17b-admin-pnl-report/
seed-code/v0-components/part-17b-admin-affiliate-management/
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

## ADMIN AUTHENTICATION

**Admin routes use NextAuth with role check:**

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

1. **Pure Admin:** `admin@tradingalerts.com` (role='ADMIN')
2. **Admin + Affiliate:** `admin-affiliate@tradingalerts.com` (role='ADMIN', isAffiliate=true)

---

## PART 17B-1 BUILD SEQUENCE: 20 FILES

```
PHASE 0: VERIFY DEPENDENCIES (3 steps)
├─ Step 1: VERIFY - Part 17A files exist
├─ Step 2: T1 - Verify setup.ts exists
└─ Step 3: T2 - Verify supertest-setup.ts exists

PHASE E: ADMIN BACKEND WITH TDD (14 files)
├─ Admin List & Detail (2 files)
│  ├─ Step 4: T3 - __tests__/lib/admin/affiliate-management.test.ts (RED)
│  ├─ Step 5: F1 - app/api/admin/affiliates/route.ts (GREEN)
│  └─ Step 6: F2 - app/api/admin/affiliates/[id]/route.ts
│
├─ Code Distribution (3 files)
│  ├─ Step 7: T4 - __tests__/lib/admin/code-distribution.test.ts (RED)
│  ├─ Step 8: F3 - app/api/admin/affiliates/[id]/distribute-codes/route.ts (GREEN)
│  ├─ Step 9: F4 - app/api/admin/affiliates/[id]/suspend/route.ts
│  └─ Step 10: F5 - app/api/admin/affiliates/[id]/reactivate/route.ts
│
├─ P&L Reports (6 files)
│  ├─ Step 11: T5 - __tests__/lib/admin/pnl-calculator.test.ts (RED)
│  ├─ Step 12: F6 - app/api/admin/affiliates/reports/profit-loss/route.ts (GREEN)
│  ├─ Step 13: F7 - app/api/admin/affiliates/reports/sales-performance/route.ts
│  ├─ Step 14: F8 - app/api/admin/affiliates/reports/commission-owings/route.ts
│  ├─ Step 15: F9 - app/api/admin/affiliates/reports/code-inventory/route.ts
│  ├─ Step 16: F10 - app/api/admin/commissions/pay/route.ts
│  └─ Step 17: F11 - app/api/admin/codes/[code]/cancel/route.ts

PHASE F: ADMIN FRONTEND (6 files)
├─ Step 18: F12 - app/admin/affiliates/page.tsx
├─ Step 19: F13 - app/admin/affiliates/[id]/page.tsx
├─ Step 20: F14 - app/admin/affiliates/reports/profit-loss/page.tsx
├─ Step 21: F15 - app/admin/affiliates/reports/sales-performance/page.tsx
├─ Step 22: F16 - app/admin/affiliates/reports/commission-owings/page.tsx
└─ Step 23: F17 - app/admin/affiliates/reports/code-inventory/page.tsx

TOTAL: 14 implementation files + 6 test files = 20 files
```

---

## DETAILED BUILD INSTRUCTIONS

### **PHASE 0: VERIFY DEPENDENCIES (Steps 1-3)**

#### **Step 1: VERIFY Part 17A**

```bash
# Check these files exist
ls -la lib/affiliate/code-generator.ts
ls -la lib/affiliate/commission-calculator.ts
ls -la lib/affiliate/report-builder.ts
ls -la lib/affiliate/validators.ts
ls -la lib/affiliate/constants.ts
```

**Action:** If all exist, proceed. If not, **ESCALATE immediately**.

---

#### **Step 2: Verify Test Setup**

**Action:** Verify `__tests__/setup.ts` exists from Part 17A-1

---

#### **Step 3: Verify Supertest Setup**

**Action:** Verify `__tests__/helpers/supertest-setup.ts` exists from Part 17A-1

---

### **PHASE E: ADMIN BACKEND WITH TDD (Steps 4-17)**

#### **Step 4: T3 - Admin Management Tests (RED)**

**File:** `__tests__/lib/admin/affiliate-management.test.ts`

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

    it('should filter by country', async () => {
      prismaMock.affiliateProfile.findMany.mockResolvedValue([]);
      prismaMock.affiliateProfile.count.mockResolvedValue(0);

      await getAffiliatesList({ country: 'US', page: 1, limit: 20 });

      expect(prismaMock.affiliateProfile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ country: 'US' }),
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

    it('should throw error if not found', async () => {
      prismaMock.affiliateProfile.findUnique.mockResolvedValue(null);

      await expect(getAffiliateDetails('999')).rejects.toThrow(
        'Affiliate not found'
      );
    });
  });
});
```

**Commit:** `test(admin): add affiliate management unit tests (RED)`

**Run:** `npm test` → ❌ MUST FAIL

---

#### **Step 5: F1 - Admin Affiliates List (GREEN)**

**File:** `app/api/admin/affiliates/route.ts`

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

**Run:** `npm test` → ✅ MUST PASS

---

#### **Step 6: F2 - Admin Affiliate Detail**

**File:** `app/api/admin/affiliates/[id]/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';

interface RouteParams {
  params: { id: string };
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    await requireAdmin();

    const affiliate = await prisma.affiliateProfile.findUnique({
      where: { id: params.id },
      include: {
        user: { select: { email: true, name: true } },
        affiliateCodes: true,
      },
    });

    if (!affiliate) {
      return NextResponse.json(
        { error: 'Affiliate not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(affiliate);
  } catch (error) {
    console.error('Affiliate detail error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch affiliate' },
      { status: 500 }
    );
  }
}
```

**Commit:** `feat(api): add admin affiliate detail endpoint`

---

#### **Step 7: T4 - Code Distribution Tests (RED)**

**File:** `__tests__/lib/admin/code-distribution.test.ts`

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

**Run:** `npm test` → ❌ MUST FAIL

---

#### **Step 8: F3 - Distribute Codes API (GREEN)**

**File:** `app/api/admin/affiliates/[id]/distribute-codes/route.ts`

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

    // Use Part 17A function - NO DUPLICATION
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

**Run:** `npm test` → ✅ MUST PASS

---

#### **Steps 9-10: Suspend & Reactivate**

**Step 9: F4 - Suspend Affiliate**
**File:** `app/api/admin/affiliates/[id]/suspend/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';

interface RouteParams {
  params: { id: string };
}

export async function POST(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    await requireAdmin();

    const { reason } = await request.json();

    const affiliate = await prisma.affiliateProfile.update({
      where: { id: params.id },
      data: {
        status: 'SUSPENDED',
        suspensionReason: reason,
        suspendedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Affiliate suspended',
      affiliate,
    });
  } catch (error) {
    console.error('Suspend error:', error);
    return NextResponse.json(
      { error: 'Failed to suspend affiliate' },
      { status: 500 }
    );
  }
}
```

**Commit:** `feat(api): add admin affiliate suspension endpoint`

---

**Step 10: F5 - Reactivate Affiliate**
**File:** `app/api/admin/affiliates/[id]/reactivate/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';

interface RouteParams {
  params: { id: string };
}

export async function POST(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    await requireAdmin();

    const affiliate = await prisma.affiliateProfile.update({
      where: { id: params.id },
      data: {
        status: 'ACTIVE',
        suspensionReason: null,
        suspendedAt: null,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Affiliate reactivated',
      affiliate,
    });
  } catch (error) {
    console.error('Reactivate error:', error);
    return NextResponse.json(
      { error: 'Failed to reactivate affiliate' },
      { status: 500 }
    );
  }
}
```

**Commit:** `feat(api): add admin affiliate reactivation endpoint`

---

#### **Step 11: T5 - P&L Calculator Tests (RED)**

**File:** `__tests__/lib/admin/pnl-calculator.test.ts`

```typescript
import { calculatePnL } from '@/lib/admin/pnl-calculator';
import { AFFILIATE_CONFIG } from '@/lib/affiliate/constants'; // Part 17A

describe('P&L Calculator', () => {
  it('should calculate P&L with percentage-based commission', () => {
    const sales = [
      { regularPrice: 29.0, netRevenue: 23.2, commission: 4.64 },
      { regularPrice: 29.0, netRevenue: 23.2, commission: 4.64 },
      { regularPrice: 29.0, netRevenue: 23.2, commission: 4.64 },
    ];

    const result = calculatePnL(sales);

    expect(result.grossRevenue).toBe(87.0);
    expect(result.discounts).toBe(17.4);
    expect(result.netRevenue).toBe(69.6);
    expect(result.totalCommissions).toBe(13.92);
    expect(result.netProfit).toBe(55.68);
    expect(result.margin).toBeCloseTo(80.0, 1);
  });

  it('should handle different discount percentages', () => {
    const regularPrice = 29.0;
    const discountPercent = 15.0;
    const discount = (regularPrice * discountPercent) / 100;
    const netRevenue = regularPrice - discount;
    const commission = (netRevenue * 20.0) / 100;

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
});
```

**Commit:** `test(admin): add P&L calculator unit tests (RED)`

**Run:** `npm test` → ❌ MUST FAIL

---

#### **Step 12: F6 - P&L Report API (GREEN)**

**File:** `app/api/admin/affiliates/reports/profit-loss/route.ts`

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
    else if (period === '1year')
      startDate.setFullYear(startDate.getFullYear() - 1);

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
    const discountPercent = AFFILIATE_CONFIG.DISCOUNT_PERCENT;
    const commissionPercent = AFFILIATE_CONFIG.COMMISSION_PERCENT;

    // Calculate financials
    const grossRevenue = totalSales * regularPrice;
    const discountPerSale = (regularPrice * discountPercent) / 100;
    const totalDiscounts = totalSales * discountPerSale;
    const netRevenue = grossRevenue - totalDiscounts;

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

**Run:** `npm test` → ✅ MUST PASS

---

#### **Steps 13-17: Remaining Admin APIs**

Build these following the same pattern (no TDD for simpler reports):

**Step 13: F7 - Sales Performance Report**
**File:** `app/api/admin/affiliates/reports/sales-performance/route.ts`

- Top performing affiliates by conversions
- Group by affiliate, count conversions
- Calculate total commissions per affiliate

**Commit:** `feat(api): add sales performance report endpoint`

---

**Step 14: F8 - Commission Owings Report**
**File:** `app/api/admin/affiliates/reports/commission-owings/route.ts`

- Affiliates with pending commissions ≥ MINIMUM_PAYOUT ($50)
- Calculate pending balance per affiliate
- Sort by amount owed

**Commit:** `feat(api): add commission owings report endpoint`

---

**Step 15: F9 - Code Inventory Report**
**File:** `app/api/admin/affiliates/reports/code-inventory/route.ts`

- Use buildCodeInventoryReport() from Part 17A
- Global view (all affiliates combined)
- Show distribution, usage, expiry stats

**Commit:** `feat(api): add code inventory report endpoint`

---

**Step 16: F10 - Pay Commission**
**File:** `app/api/admin/commissions/pay/route.ts`

- Mark commissions as PAID
- Update affiliate paidBalance
- Clear pendingBalance

**Commit:** `feat(api): add commission payment endpoint`

---

**Step 17: F11 - Cancel Code**
**File:** `app/api/admin/codes/[code]/cancel/route.ts`

- Mark code as CANCELLED
- Require admin authorization

**Commit:** `feat(api): add code cancellation endpoint`

---

### **PHASE F: ADMIN FRONTEND (Steps 18-23)**

#### **Step 18: F12 - Affiliate Management Page**

**File:** `app/admin/affiliates/page.tsx`

```typescript
'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

interface Affiliate {
  id: string;
  fullName: string;
  country: string;
  status: string;
  codesDistributed: number;
  codesUsed: number;
  user: { email: string };
}

export default function AdminAffiliatesPage() {
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: '',
    country: '',
  });

  useEffect(() => {
    fetchAffiliates();
  }, [filters]);

  const fetchAffiliates = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.status) params.set('status', filters.status);
      if (filters.country) params.set('country', filters.country);

      const response = await fetch(`/api/admin/affiliates?${params}`);
      const data = await response.json();
      setAffiliates(data.affiliates);
    } catch (error) {
      console.error('Failed to fetch affiliates:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Affiliate Management</h1>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="w-full px-3 py-2 border rounded"
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="PENDING_VERIFICATION">Pending</option>
              <option value="SUSPENDED">Suspended</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Country</label>
            <input
              type="text"
              value={filters.country}
              onChange={(e) => setFilters({ ...filters, country: e.target.value })}
              placeholder="US, UK, etc."
              className="w-full px-3 py-2 border rounded"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Country
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Codes
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {affiliates.map((affiliate) => (
                <tr key={affiliate.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {affiliate.fullName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {affiliate.user.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {affiliate.country}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 text-xs rounded ${
                        affiliate.status === 'ACTIVE'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {affiliate.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {affiliate.codesUsed} / {affiliate.codesDistributed}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Link
                      href={`/admin/affiliates/${affiliate.id}`}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      View Details
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

**Commit:** `feat(admin): add affiliate management page`

---

#### **Steps 19-23: Remaining Admin Pages**

Build these following the same pattern:

**Step 19: F13 - Affiliate Detail Page**
**File:** `app/admin/affiliates/[id]/page.tsx`

- Show full affiliate details
- Distribution, suspend, reactivate buttons
- Commission history

**Commit:** `feat(admin): add affiliate detail page`

---

**Step 20: F14 - P&L Report Page**
**File:** `app/admin/affiliates/reports/profit-loss/page.tsx`

- Fetch from F6 API
- Display revenue, costs, profit
- Charts for visual representation

**Commit:** `feat(admin): add P&L report page`

---

**Step 21: F15 - Sales Performance Page**
**File:** `app/admin/affiliates/reports/sales-performance/page.tsx`

- Top performers table
- Conversion rates

**Commit:** `feat(admin): add sales performance report page`

---

**Step 22: F16 - Commission Owings Page**
**File:** `app/admin/affiliates/reports/commission-owings/page.tsx`

- Affiliates ready for payout
- Bulk payment option

**Commit:** `feat(admin): add commission owings report page`

---

**Step 23: F17 - Code Inventory Page**
**File:** `app/admin/affiliates/reports/code-inventory/page.tsx`

- Global code stats
- Distribution vs usage

**Commit:** `feat(admin): add code inventory report page`

---

## STOPPING POINT - PART 17B-1 COMPLETE

**After Step 23, you MUST:**

1. **Run all tests:**

   ```bash
   npm test
   ```

2. **Run all validations:**

   ```bash
   npm run validate
   ```

3. **Push to feature branch:**

   ```bash
   git push -u origin claude/admin-backend-{SESSION_ID}
   ```

4. **Inform user:**

   ```
   Part 17B-1 (Admin Backend & Reports) is COMPLETE!

   ✅ 14 implementation files built
   ✅ 6 test files created
   ✅ All tests passing
   ✅ Admin backend ready
   ✅ All 4 BI reports working

   NEXT STEP: Part 17B-2 will build:
   - Cron jobs & automation (5 files)
   - API E2E tests (3 files)
   - Admin components (14 files)

   Branch: claude/admin-backend-{SESSION_ID}
   Ready for Part 17B-2 prompt.
   ```

5. **DO NOT proceed to:**
   - Cron jobs (Phase G)
   - API E2E tests (Phase H)
   - Components (Phase I)
   - These are in Part 17B-2

---

## SUCCESS CRITERIA FOR PART 17B-1

Part 17B-1 is complete when:

- ✅ Part 17A dependencies verified
- ✅ All 6 test files created
- ✅ All 14 implementation files created
- ✅ All tests passing
- ✅ Admin routes protected with requireAdmin()
- ✅ Part 17A functions imported correctly
- ✅ All 4 BI reports working
- ✅ Code pushed to branch
- ✅ User informed Part 17B-1 complete

---

## FILE COUNT RECONCILIATION

**Part 17B-1 Files:**

- Phase 0: 3 verification steps
- Phase E: 3 test files + 11 implementation files
- Phase F: 0 test files + 6 implementation files

**Total Part 17B-1:**

- 3 test files (unit tests, not E2E yet)
- 17 implementation files (11 backend + 6 frontend)
- **20 total files**

**Remaining for Part 17B-2:**

- Phase G: 1 test file + 4 implementation files
- Phase H: 3 API E2E test files
- Phase I: 0 test files + 14 implementation files
- **22 total files**

**Part 17B Total Verification:**

- Part 17B-1: 20 files
- Part 17B-2: 22 files
- **Combined: 42 files**
- **Close to original Part 17B: 44 files ✅**
  (Small difference due to test infrastructure already existing from Part 17A)

---

## WHEN TO ASK FOR HELP

Escalate if:

- Part 17A files missing
- Import errors from Part 17A
- Critical security issues
- Admin authentication not working
- More than 3 tests failing
- Coverage below 20%

Otherwise, work autonomously!

---

**Ready to build Part 17B-1! Verify Part 17A exists, import (never duplicate), write tests FIRST, then build admin backend and reports. Stop at Step 23 and inform user!**
