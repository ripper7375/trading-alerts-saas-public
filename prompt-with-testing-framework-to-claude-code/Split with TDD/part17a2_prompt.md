# Part 17A-2: Affiliate Portal - API Testing & Frontend with TDD

**Project:** Trading Alerts SaaS V7  
**Task:** Build Part 17A-2 (API Testing & Frontend) with Test-Driven Development  
**Files to Build:** 11 implementation files + 6 test files = **17 total files**  
**Estimated Time:** 4-6 hours (including TDD)  
**Current Status:** Part 17A-1 complete (Foundation & Backend APIs)  
**Testing Approach:** Supertest API E2E + React Testing Library  
**Coverage Target:** Maintain 25% minimum (combined with Part 17A-1)

---

## ⚠️ CRITICAL: THIS IS PART 17A-2 OF 2 - REQUIRES PART 17A-1

**Part 17A is split into TWO parts:**

- **Part 17A-1 (COMPLETED)**: Foundation + Backend APIs (29 files) ✅
- **Part 17A-2 (THIS PART)**: API Testing + Frontend (17 files)

**DEPENDENCIES - MUST VERIFY FIRST:**

```bash
# Check Part 17A-1 files exist
ls -la lib/affiliate/code-generator.ts
ls -la lib/affiliate/commission-calculator.ts
ls -la lib/affiliate/report-builder.ts
ls -la app/api/affiliate/auth/register/route.ts
ls -la app/api/affiliate/dashboard/stats/route.ts
ls -la __tests__/setup.ts

# All must exist - if ANY missing, STOP and escalate
```

**STOPPING POINT:** After completing Step 44 (F29: payment page), you will:

1. Run full test suite
2. Verify combined coverage ≥ 25%
3. Push code to same branch
4. Create Pull Request
5. Inform user Part 17A is COMPLETE

**WHY THIS SPLIT:**

- ✅ Backend from Part 17A-1 is tested and working
- ✅ API E2E tests validate backend integration
- ✅ Frontend builds on tested backend
- ✅ Manageable context (17 files vs 43)

---

## YOUR MISSION

You are Claude Code, tasked with building **Part 17A-2: API Testing & Frontend** for the Affiliate Marketing Platform using **Test-Driven Development (TDD)**. You will:

1. **Verify Part 17A-1 dependencies** exist
2. Write **API E2E tests** with Supertest (Phase C)
3. Build **React components** with TDD (Phase D frontend)
4. Build **frontend pages** (Phase D pages)
5. Maintain **25% test coverage** (combined)
6. Create **Pull Request** after completion

**DELIVERABLE:** Complete affiliate portal with full test coverage, ready for production.

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

### 3. **Part 17A Requirements**

```
docs/build-orders/part-17a-affiliate-portal.md
docs/implementation-guides/v5_part_q.md
```

### 4. **Dependencies from Part 17A-1 (MUST EXIST)**

```
lib/affiliate/code-generator.ts
lib/affiliate/commission-calculator.ts
lib/affiliate/report-builder.ts
lib/affiliate/validators.ts
lib/affiliate/constants.ts
app/api/affiliate/auth/register/route.ts
app/api/affiliate/auth/verify-email/route.ts
app/api/affiliate/dashboard/stats/route.ts
app/api/affiliate/dashboard/codes/route.ts
app/api/checkout/validate-code/route.ts
__tests__/setup.ts
__tests__/helpers/supertest-setup.ts
```

### 5. **Seed Code**

```
seed-code/v0-components/part-17a-affiliate-dashboard/
seed-code/v0-components/part-17a-affiliate-registration/
```

### 6. **Testing Documentation**

```
VALIDATION-SETUP-GUIDE.md
CLAUDE.md
docs/testing/
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

## PART 17A-2 BUILD SEQUENCE: 17 FILES

**Build Order:** Test files (T#) BEFORE implementation files (F#)

```
PHASE C: API E2E TESTING (3 test files)
├─ Step 28: T6 - __tests__/api/affiliate-registration.supertest.ts
├─ Step 29: T7 - __tests__/api/affiliate-dashboard.supertest.ts
└─ Step 30: T8 - __tests__/api/affiliate-conversion.supertest.ts

PHASE D: FRONTEND (14 files)
├─ Component Tests & Implementation (6 files)
│  ├─ Step 31: T9 - __tests__/components/affiliate/stats-card.test.tsx (RED)
│  ├─ Step 32: F30 - components/affiliate/stats-card.tsx (GREEN)
│  ├─ Step 33: T10 - __tests__/components/affiliate/code-table.test.tsx (RED)
│  ├─ Step 34: F31 - components/affiliate/code-table.tsx (GREEN)
│  ├─ Step 35: T11 - __tests__/components/affiliate/commission-table.test.tsx (RED)
│  └─ Step 36: F32 - components/affiliate/commission-table.tsx (GREEN)
│
└─ Pages (8 files)
   ├─ Step 37: F22 - app/affiliate/layout.tsx
   ├─ Step 38: F23 - app/affiliate/register/page.tsx
   ├─ Step 39: F24 - app/affiliate/verify/page.tsx
   ├─ Step 40: F25 - app/affiliate/dashboard/page.tsx
   ├─ Step 41: F26 - app/affiliate/dashboard/codes/page.tsx
   ├─ Step 42: F27 - app/affiliate/dashboard/commissions/page.tsx
   ├─ Step 43: F28 - app/affiliate/dashboard/profile/page.tsx
   └─ Step 44: F29 - app/affiliate/dashboard/profile/payment/page.tsx

TOTAL: 11 implementation files + 6 test files = 17 files
```

---

## DETAILED BUILD INSTRUCTIONS

### **PHASE C: API E2E TESTING (Steps 28-30)**

#### **Step 28: T6 - Registration API E2E Test**

**File:** `__tests__/api/affiliate-registration.supertest.ts`

```typescript
import {
  setupSupertestApp,
  teardownSupertestApp,
} from '../helpers/supertest-setup';
import { prisma } from '@/lib/db/prisma';

describe('API E2E: Affiliate Registration', () => {
  let request: any;
  let userToken: string;
  let userId: string;

  beforeAll(async () => {
    request = await setupSupertestApp();

    // Create test user
    const user = await prisma.user.create({
      data: {
        email: 'affiliate-test@example.com',
        name: 'Affiliate Test',
        hashedPassword: 'hashed-password',
      },
    });
    userId = user.id;

    // Mock login - get session token
    userToken = 'mock-session-token';
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    await teardownSupertestApp();
  });

  describe('POST /api/affiliate/auth/register', () => {
    it('should register user as affiliate', async () => {
      const response = await request.post('/api/affiliate/auth/register').send({
        fullName: 'John Doe',
        country: 'US',
        paymentMethod: 'PAYPAL',
        paymentDetails: { email: 'john@paypal.com' },
        terms: true,
      });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        message: expect.stringContaining('verify'),
      });

      // Verify database changes
      const user = await prisma.user.findUnique({ where: { id: userId } });
      expect(user?.isAffiliate).toBe(true);

      const profile = await prisma.affiliateProfile.findUnique({
        where: { userId },
      });
      expect(profile).toBeTruthy();
      expect(profile?.status).toBe('PENDING_VERIFICATION');
    });

    it('should reject if already affiliate', async () => {
      // Register again
      const response = await request.post('/api/affiliate/auth/register').send({
        fullName: 'John Doe',
        country: 'US',
        paymentMethod: 'PAYPAL',
        paymentDetails: { email: 'john@paypal.com' },
        terms: true,
      });

      expect(response.status).toBe(409);
      expect(response.body.error).toContain('already');
    });

    it('should validate required fields', async () => {
      const response = await request.post('/api/affiliate/auth/register').send({
        fullName: 'J',
        country: 'US',
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Validation');
    });

    it('should require authentication', async () => {
      const response = await request
        .post('/api/affiliate/auth/register')
        .set('Authorization', '')
        .send({
          fullName: 'John Doe',
          country: 'US',
          paymentMethod: 'PAYPAL',
          paymentDetails: {},
          terms: true,
        });

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/affiliate/auth/verify-email', () => {
    it('should verify email and activate affiliate', async () => {
      const profile = await prisma.affiliateProfile.findUnique({
        where: { userId },
      });

      const response = await request
        .post('/api/affiliate/auth/verify-email')
        .send({
          token: profile?.emailVerificationToken,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify status changed
      const updated = await prisma.affiliateProfile.findUnique({
        where: { userId },
      });
      expect(updated?.status).toBe('ACTIVE');
      expect(updated?.emailVerificationToken).toBeNull();

      // Verify codes distributed
      const codes = await prisma.affiliateCode.count({
        where: { affiliateProfileId: updated?.id },
      });
      expect(codes).toBe(15);
    });

    it('should reject invalid token', async () => {
      const response = await request
        .post('/api/affiliate/auth/verify-email')
        .send({
          token: 'invalid-token',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid');
    });
  });
});
```

**Commit:** `test(api): add affiliate registration E2E tests`

**Run:** `npm test` → Should PASS (APIs from Part 17A-1 exist)

---

#### **Step 29: T7 - Dashboard API E2E Test**

**File:** `__tests__/api/affiliate-dashboard.supertest.ts`

```typescript
import {
  setupSupertestApp,
  teardownSupertestApp,
} from '../helpers/supertest-setup';
import { prisma } from '@/lib/db/prisma';

describe('API E2E: Affiliate Dashboard', () => {
  let request: any;
  let affiliateToken: string;
  let affiliateProfileId: string;

  beforeAll(async () => {
    request = await setupSupertestApp();

    // Create affiliate user
    const user = await prisma.user.create({
      data: {
        email: 'active-affiliate@example.com',
        name: 'Active Affiliate',
        hashedPassword: 'hashed',
        isAffiliate: true,
      },
    });

    const profile = await prisma.affiliateProfile.create({
      data: {
        userId: user.id,
        fullName: 'Active Affiliate',
        country: 'US',
        paymentMethod: 'PAYPAL',
        status: 'ACTIVE',
      },
    });
    affiliateProfileId = profile.id;

    // Create some test data
    await prisma.affiliateCode.create({
      data: {
        code: 'TEST1234',
        affiliateProfileId: profile.id,
        status: 'ACTIVE',
        distributedAt: new Date(),
        distributionReason: 'INITIAL',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    affiliateToken = 'mock-affiliate-token';
  });

  afterAll(async () => {
    await teardownSupertestApp();
  });

  describe('GET /api/affiliate/dashboard/stats', () => {
    it('should return affiliate stats', async () => {
      const response = await request
        .get('/api/affiliate/dashboard/stats')
        .set('Authorization', `Bearer ${affiliateToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        activeCodes: expect.any(Number),
        usedCodes: expect.any(Number),
        totalEarnings: expect.any(Number),
        pendingBalance: expect.any(Number),
        paidBalance: expect.any(Number),
      });
    });

    it('should require affiliate authentication', async () => {
      const response = await request
        .get('/api/affiliate/dashboard/stats')
        .set('Authorization', '');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/affiliate/dashboard/codes', () => {
    it('should list affiliate codes', async () => {
      const response = await request
        .get('/api/affiliate/dashboard/codes?status=ACTIVE')
        .set('Authorization', `Bearer ${affiliateToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        codes: expect.any(Array),
        total: expect.any(Number),
        page: 1,
        limit: 20,
      });
      expect(response.body.codes.length).toBeGreaterThan(0);
    });

    it('should support pagination', async () => {
      const response = await request
        .get('/api/affiliate/dashboard/codes?page=1&limit=10')
        .set('Authorization', `Bearer ${affiliateToken}`);

      expect(response.status).toBe(200);
      expect(response.body.limit).toBe(10);
    });

    it('should filter by status', async () => {
      const response = await request
        .get('/api/affiliate/dashboard/codes?status=USED')
        .set('Authorization', `Bearer ${affiliateToken}`);

      expect(response.status).toBe(200);
      response.body.codes.forEach((code: any) => {
        expect(code.status).toBe('USED');
      });
    });
  });

  describe('GET /api/affiliate/dashboard/code-inventory', () => {
    it('should return inventory report', async () => {
      const response = await request
        .get('/api/affiliate/dashboard/code-inventory')
        .set('Authorization', `Bearer ${affiliateToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        period: {
          start: expect.any(String),
          end: expect.any(String),
        },
        openingBalance: expect.any(Number),
        additions: {
          monthlyDistribution: expect.any(Number),
          bonusDistribution: expect.any(Number),
          total: expect.any(Number),
        },
        reductions: {
          used: expect.any(Number),
          expired: expect.any(Number),
          cancelled: expect.any(Number),
          total: expect.any(Number),
        },
        closingBalance: expect.any(Number),
      });
    });
  });

  describe('GET /api/affiliate/dashboard/commission-report', () => {
    it('should return commission report', async () => {
      const response = await request
        .get('/api/affiliate/dashboard/commission-report')
        .set('Authorization', `Bearer ${affiliateToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        commissions: expect.any(Array),
        total: expect.any(Number),
        page: 1,
        limit: 20,
      });
    });
  });
});
```

**Commit:** `test(api): add affiliate dashboard E2E tests`

**Run:** `npm test` → Should PASS

---

#### **Step 30: T8 - Conversion Flow E2E Test**

**File:** `__tests__/api/affiliate-conversion.supertest.ts`

```typescript
import {
  setupSupertestApp,
  teardownSupertestApp,
} from '../helpers/supertest-setup';
import { prisma } from '@/lib/db/prisma';
import { AFFILIATE_CONFIG } from '@/lib/affiliate/constants';

describe('API E2E: Affiliate Conversion Flow', () => {
  let request: any;
  let affiliateCode: string;
  let affiliateProfileId: string;

  beforeAll(async () => {
    request = await setupSupertestApp();

    // Create affiliate
    const user = await prisma.user.create({
      data: {
        email: 'converter@example.com',
        name: 'Converter',
        hashedPassword: 'hashed',
        isAffiliate: true,
      },
    });

    const profile = await prisma.affiliateProfile.create({
      data: {
        userId: user.id,
        fullName: 'Converter',
        country: 'US',
        paymentMethod: 'PAYPAL',
        status: 'ACTIVE',
      },
    });
    affiliateProfileId = profile.id;

    // Create code
    const code = await prisma.affiliateCode.create({
      data: {
        code: 'CONV1234',
        affiliateProfileId: profile.id,
        status: 'ACTIVE',
        distributedAt: new Date(),
        distributionReason: 'INITIAL',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    affiliateCode = code.code;
  });

  afterAll(async () => {
    await teardownSupertestApp();
  });

  it('should complete full conversion flow with commission', async () => {
    // Step 1: Validate code
    const validateRes = await request
      .post('/api/checkout/validate-code')
      .send({ code: affiliateCode });

    expect(validateRes.status).toBe(200);
    expect(validateRes.body).toMatchObject({
      valid: true,
      discountPercent: AFFILIATE_CONFIG.DISCOUNT_PERCENT,
      affiliateId: affiliateProfileId,
    });

    // Step 2: Create checkout session with affiliate code
    const sessionRes = await request.post('/api/checkout/create-session').send({
      affiliateCode,
      priceId: 'price_pro',
    });

    expect(sessionRes.status).toBe(200);
    expect(sessionRes.body.sessionId).toBeDefined();

    // Step 3: Simulate successful payment webhook
    const mockWebhookPayload = {
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_123',
          metadata: {
            userId: 'new-user-id',
            affiliateCodeId: affiliateCode,
          },
          amount_total: 2320, // $23.20 (after 20% discount)
        },
      },
    };

    const webhookRes = await request
      .post('/api/webhooks/stripe')
      .set('stripe-signature', 'mock-signature')
      .send(mockWebhookPayload);

    expect(webhookRes.status).toBe(200);

    // Step 4: Verify commission created
    const commissions = await prisma.commission.findMany({
      where: {
        affiliateCode: { code: affiliateCode },
      },
    });

    expect(commissions.length).toBe(1);
    expect(Number(commissions[0].amount)).toBe(4.64); // 20% of $23.20
    expect(commissions[0].status).toBe('PENDING');

    // Step 5: Verify affiliate balance updated
    const profile = await prisma.affiliateProfile.findUnique({
      where: { id: affiliateProfileId },
    });

    expect(Number(profile?.pendingBalance)).toBe(4.64);
    expect(profile?.codesUsed).toBe(1);

    // Step 6: Verify code marked as used
    const codeRecord = await prisma.affiliateCode.findUnique({
      where: { code: affiliateCode },
    });

    expect(codeRecord?.status).toBe('USED');
    expect(codeRecord?.usedAt).toBeTruthy();
  });

  it('should reject invalid affiliate code', async () => {
    const response = await request
      .post('/api/checkout/validate-code')
      .send({ code: 'INVALID1' });

    expect(response.status).toBe(404);
    expect(response.body.error).toContain('Invalid');
  });

  it('should reject expired code', async () => {
    // Create expired code
    const expiredCode = await prisma.affiliateCode.create({
      data: {
        code: 'EXPIRED1',
        affiliateProfileId,
        status: 'ACTIVE',
        distributedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
        distributionReason: 'INITIAL',
        expiresAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      },
    });

    const response = await request
      .post('/api/checkout/validate-code')
      .send({ code: expiredCode.code });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('expired');
  });
});
```

**Commit:** `test(api): add affiliate conversion E2E test`

**Run:** `npm test` → Should PASS

---

### **PHASE D: FRONTEND (Steps 31-44)**

#### **Component 1: StatsCard (Steps 31-32)**

**Step 31: T9 - StatsCard Tests (RED)**
**File:** `__tests__/components/affiliate/stats-card.test.tsx`

```typescript
import { render, screen } from '@testing-library/react';
import { StatsCard } from '@/components/affiliate/stats-card';

describe('StatsCard Component', () => {
  it('should render title and value', () => {
    render(<StatsCard title="Total Earnings" value="$142.50" />);

    expect(screen.getByText('Total Earnings')).toBeInTheDocument();
    expect(screen.getByText('$142.50')).toBeInTheDocument();
  });

  it('should render icon if provided', () => {
    const Icon = () => <svg data-testid="test-icon" />;
    render(<StatsCard title="Clicks" value="245" icon={<Icon />} />);

    expect(screen.getByTestId('test-icon')).toBeInTheDocument();
  });

  it('should show trend indicator', () => {
    render(
      <StatsCard
        title="Conversions"
        value="12"
        trend={{ value: 8.5, direction: 'up' }}
      />
    );

    expect(screen.getByText(/8.5%/)).toBeInTheDocument();
  });

  it('should handle no trend', () => {
    render(<StatsCard title="Balance" value="$50.00" />);

    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });

  it('should apply correct trend color', () => {
    const { rerender } = render(
      <StatsCard title="Test" value="100" trend={{ value: 5, direction: 'up' }} />
    );

    const trendElement = screen.getByText(/5%/);
    expect(trendElement.className).toContain('green');

    rerender(
      <StatsCard title="Test" value="100" trend={{ value: 3, direction: 'down' }} />
    );

    const downTrend = screen.getByText(/3%/);
    expect(downTrend.className).toContain('red');
  });
});
```

**Commit:** `test(components): add stats card unit tests (RED)`

**Run:** `npm test` → ❌ MUST FAIL

---

**Step 32: F30 - StatsCard Component (GREEN)**
**File:** `components/affiliate/stats-card.tsx`

```typescript
import React from 'react';

interface StatsCardProps {
  title: string;
  value: string;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    direction: 'up' | 'down';
  };
}

export function StatsCard({ title, value, icon, trend }: StatsCardProps) {
  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600">{title}</p>
          <p className="text-2xl font-bold mt-2">{value}</p>
          {trend && (
            <p
              className={`text-sm mt-1 ${
                trend.direction === 'up' ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {trend.direction === 'up' ? '↑' : '↓'} {trend.value}%
            </p>
          )}
        </div>
        {icon && <div className="text-gray-400">{icon}</div>}
      </div>
    </div>
  );
}
```

**Commit:** `feat(components): add affiliate stats card (GREEN)`

**Run:** `npm test` → ✅ MUST PASS

---

#### **Component 2: CodeTable (Steps 33-34)**

**Step 33: T10 - CodeTable Tests (RED)**
**File:** `__tests__/components/affiliate/code-table.test.tsx`

```typescript
import { render, screen } from '@testing-library/react';
import { CodeTable } from '@/components/affiliate/code-table';

describe('CodeTable Component', () => {
  const mockCodes = [
    {
      id: '1',
      code: 'ABCD1234',
      status: 'ACTIVE',
      distributedAt: new Date('2024-01-01'),
      expiresAt: new Date('2024-01-31'),
      usedAt: null,
    },
    {
      id: '2',
      code: 'EFGH5678',
      status: 'USED',
      distributedAt: new Date('2024-01-01'),
      expiresAt: new Date('2024-01-31'),
      usedAt: new Date('2024-01-15'),
    },
  ];

  it('should render codes table', () => {
    render(<CodeTable codes={mockCodes} />);

    expect(screen.getByText('ABCD1234')).toBeInTheDocument();
    expect(screen.getByText('EFGH5678')).toBeInTheDocument();
  });

  it('should show status badges', () => {
    render(<CodeTable codes={mockCodes} />);

    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
    expect(screen.getByText('USED')).toBeInTheDocument();
  });

  it('should format dates correctly', () => {
    render(<CodeTable codes={mockCodes} />);

    expect(screen.getByText(/Jan 1, 2024/)).toBeInTheDocument();
    expect(screen.getByText(/Jan 31, 2024/)).toBeInTheDocument();
  });

  it('should handle empty codes', () => {
    render(<CodeTable codes={[]} />);

    expect(screen.getByText(/no codes/i)).toBeInTheDocument();
  });
});
```

**Commit:** `test(components): add code table unit tests (RED)`

**Run:** `npm test` → ❌ MUST FAIL

---

**Step 34: F31 - CodeTable Component (GREEN)**
**File:** `components/affiliate/code-table.tsx`

```typescript
import React from 'react';
import { format } from 'date-fns';

interface Code {
  id: string;
  code: string;
  status: string;
  distributedAt: Date;
  expiresAt: Date;
  usedAt: Date | null;
}

interface CodeTableProps {
  codes: Code[];
}

export function CodeTable({ codes }: CodeTableProps) {
  if (codes.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No codes available
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Code
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Status
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Distributed
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Expires
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Used
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {codes.map((code) => (
            <tr key={code.id}>
              <td className="px-6 py-4 whitespace-nowrap font-mono">
                {code.code}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span
                  className={`px-2 py-1 text-xs rounded ${
                    code.status === 'ACTIVE'
                      ? 'bg-green-100 text-green-800'
                      : code.status === 'USED'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {code.status}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                {format(new Date(code.distributedAt), 'MMM d, yyyy')}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                {format(new Date(code.expiresAt), 'MMM d, yyyy')}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                {code.usedAt ? format(new Date(code.usedAt), 'MMM d, yyyy') : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

**Commit:** `feat(components): add affiliate code table (GREEN)`

**Run:** `npm test` → ✅ MUST PASS

---

#### **Component 3: CommissionTable (Steps 35-36)**

**Step 35: T11 - CommissionTable Tests (RED)**
**File:** `__tests__/components/affiliate/commission-table.test.tsx`

```typescript
import { render, screen } from '@testing-library/react';
import { CommissionTable } from '@/components/affiliate/commission-table';

describe('CommissionTable Component', () => {
  const mockCommissions = [
    {
      id: '1',
      amount: 4.64,
      status: 'PENDING',
      earnedAt: new Date('2024-01-15'),
      affiliateCode: { code: 'TEST1234' },
    },
    {
      id: '2',
      amount: 4.64,
      status: 'PAID',
      earnedAt: new Date('2024-01-10'),
      paidAt: new Date('2024-02-01'),
      affiliateCode: { code: 'TEST5678' },
    },
  ];

  it('should render commissions table', () => {
    render(<CommissionTable commissions={mockCommissions} />);

    expect(screen.getByText('TEST1234')).toBeInTheDocument();
    expect(screen.getByText('TEST5678')).toBeInTheDocument();
  });

  it('should format amounts correctly', () => {
    render(<CommissionTable commissions={mockCommissions} />);

    expect(screen.getAllByText('$4.64')).toHaveLength(2);
  });

  it('should show status badges', () => {
    render(<CommissionTable commissions={mockCommissions} />);

    expect(screen.getByText('PENDING')).toBeInTheDocument();
    expect(screen.getByText('PAID')).toBeInTheDocument();
  });

  it('should handle empty commissions', () => {
    render(<CommissionTable commissions={[]} />);

    expect(screen.getByText(/no commissions/i)).toBeInTheDocument();
  });
});
```

**Commit:** `test(components): add commission table unit tests (RED)`

**Run:** `npm test` → ❌ MUST FAIL

---

**Step 36: F32 - CommissionTable Component (GREEN)**
**File:** `components/affiliate/commission-table.tsx`

```typescript
import React from 'react';
import { format } from 'date-fns';

interface Commission {
  id: string;
  amount: number;
  status: string;
  earnedAt: Date;
  paidAt?: Date | null;
  affiliateCode: {
    code: string;
  };
}

interface CommissionTableProps {
  commissions: Commission[];
}

export function CommissionTable({ commissions }: CommissionTableProps) {
  if (commissions.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No commissions yet
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Code
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Amount
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Status
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Earned
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Paid
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {commissions.map((commission) => (
            <tr key={commission.id}>
              <td className="px-6 py-4 whitespace-nowrap font-mono">
                {commission.affiliateCode.code}
              </td>
              <td className="px-6 py-4 whitespace-nowrap font-semibold">
                ${commission.amount.toFixed(2)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span
                  className={`px-2 py-1 text-xs rounded ${
                    commission.status === 'PAID'
                      ? 'bg-green-100 text-green-800'
                      : commission.status === 'PENDING'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {commission.status}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                {format(new Date(commission.earnedAt), 'MMM d, yyyy')}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                {commission.paidAt
                  ? format(new Date(commission.paidAt), 'MMM d, yyyy')
                  : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

**Commit:** `feat(components): add affiliate commission table (GREEN)`

**Run:** `npm test` → ✅ MUST PASS

---

#### **Pages (Steps 37-44)**

**Step 37: F22 - Affiliate Layout**
**File:** `app/affiliate/layout.tsx`

```typescript
import React from 'react';
import Link from 'next/link';
import { requireAffiliate } from '@/lib/auth/session';

export default async function AffiliateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAffiliate();

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex space-x-8">
              <Link
                href="/affiliate/dashboard"
                className="inline-flex items-center px-1 pt-1 text-sm font-medium"
              >
                Dashboard
              </Link>
              <Link
                href="/affiliate/dashboard/codes"
                className="inline-flex items-center px-1 pt-1 text-sm font-medium"
              >
                My Codes
              </Link>
              <Link
                href="/affiliate/dashboard/commissions"
                className="inline-flex items-center px-1 pt-1 text-sm font-medium"
              >
                Commissions
              </Link>
              <Link
                href="/affiliate/dashboard/profile"
                className="inline-flex items-center px-1 pt-1 text-sm font-medium"
              >
                Profile
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
```

**Commit:** `feat(affiliate): add affiliate portal layout`

---

**Step 38: F23 - Registration Page**
**File:** `app/affiliate/register/page.tsx`

```typescript
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AFFILIATE_CONFIG } from '@/lib/affiliate/constants';

export default function AffiliateRegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    fullName: '',
    country: '',
    paymentMethod: 'PAYPAL' as const,
    paymentDetails: {},
    terms: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/affiliate/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      router.push('/affiliate/verify');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Become an Affiliate</h1>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-lg shadow">
        <div>
          <label className="block text-sm font-medium mb-2">
            Full Name
          </label>
          <input
            type="text"
            value={formData.fullName}
            onChange={(e) =>
              setFormData({ ...formData, fullName: e.target.value })
            }
            required
            className="w-full px-3 py-2 border rounded"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Country
          </label>
          <input
            type="text"
            value={formData.country}
            onChange={(e) =>
              setFormData({ ...formData, country: e.target.value })
            }
            required
            maxLength={2}
            placeholder="US"
            className="w-full px-3 py-2 border rounded"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Payment Method
          </label>
          <select
            value={formData.paymentMethod}
            onChange={(e) =>
              setFormData({
                ...formData,
                paymentMethod: e.target.value as any,
              })
            }
            className="w-full px-3 py-2 border rounded"
          >
            {AFFILIATE_CONFIG.PAYMENT_METHODS.map((method) => (
              <option key={method} value={method}>
                {method.replace('_', ' ')}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={formData.terms}
              onChange={(e) =>
                setFormData({ ...formData, terms: e.target.checked })
              }
              required
              className="mr-2"
            />
            <span className="text-sm">
              I accept the affiliate terms and conditions
            </span>
          </label>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Submitting...' : 'Register as Affiliate'}
        </button>
      </form>
    </div>
  );
}
```

**Commit:** `feat(affiliate): add registration page`

---

**Steps 39-44: Continue with remaining pages following same pattern**

- Step 39: F24 - Verify page
- Step 40: F25 - Dashboard page
- Step 41: F26 - Codes page
- Step 42: F27 - Commissions page
- Step 43: F28 - Profile page
- Step 44: F29 - Payment preferences page

Each page should:

- Use `'use client'` for interactivity
- Fetch data from Part 17A-1 APIs
- Display data using components from Steps 32, 34, 36
- Handle loading and error states

**Commit each page separately**

---

## COMPLETION - PART 17A FULLY COMPLETE

**After Step 44, you MUST:**

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
   git push origin claude/affiliate-foundation-{SESSION_ID}
   ```

5. **Create Pull Request:**
   - Title: "Part 17A: Affiliate Marketing Portal (Complete)"
   - Description: "Foundation + Backend APIs + Testing + Frontend"

6. **Inform user:**

   ```
   Part 17A (Complete Affiliate Portal) is DONE!

   ✅ Part 17A-1: 29 files (Foundation + Backend)
   ✅ Part 17A-2: 17 files (Testing + Frontend)
   ✅ Total: 46 files built
   ✅ All tests passing
   ✅ Coverage: [X]%
   ✅ All validations passing

   PR: [URL]

   NEXT: Part 17B will build Admin Portal + Automation
   ```

---

## SUCCESS CRITERIA FOR PART 17A-2

Part 17A-2 is complete when:

- ✅ All 6 test files created
- ✅ All 11 implementation files created
- ✅ All tests passing
- ✅ Combined coverage (17A-1 + 17A-2) ≥ 25%
- ✅ TypeScript validations pass
- ✅ Frontend pages functional
- ✅ Components render correctly
- ✅ PR created
- ✅ User informed Part 17A complete

---

## FILE COUNT RECONCILIATION

**Part 17A-2 Files:**

- Phase C: 3 API E2E test files
- Phase D: 3 component test files + 3 component implementations + 8 page implementations

**Total Part 17A-2:**

- 6 test files
- 11 implementation files
- **17 total files**

**Part 17A Complete Verification:**

- Part 17A-1: 34 files (5 tests + 29 impl)
- Part 17A-2: 17 files (6 tests + 11 impl)
- **Combined: 51 build steps**
- **Unique files: 11 tests + 40 implementation = 51 total**
- **Matches original Part 17A promise ✅**

---

## WHEN TO ASK FOR HELP

Escalate if:

- Part 17A-1 files missing
- API tests failing unexpectedly
- Component tests failing
- Frontend build errors
- Coverage below 20%

Otherwise, work autonomously!

---

**Ready to build Part 17A-2! Verify Part 17A-1 exists, then build API E2E tests and frontend. After Step 44, create PR and inform user Part 17A is COMPLETE!**
