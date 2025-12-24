# Part 17A-1: Affiliate Portal - Foundation & Backend APIs with TDD

**Project:** Trading Alerts SaaS V7  
**Task:** Build Part 17A-1 (Foundation & Backend) with Test-Driven Development  
**Files to Build:** 29 implementation files + 5 test files = **34 total files**  
**Estimated Time:** 6-8 hours (including TDD)  
**Current Status:** Parts 6-16 complete and merged to main  
**Testing Approach:** Red-Green-Refactor TDD + Unit Testing  
**Coverage Target:** 25% minimum

---

## CRITICAL: THIS IS PART 17A-1 OF 2

**Part 17A is split into TWO parts to prevent Long Running Agent issues:**

- **Part 17A-1 (THIS PART)**: Foundation + Backend APIs (29 files, Steps 1-27)
- **Part 17A-2 (NEXT PART)**: API Testing + Frontend (17 files, Steps 28-44)

**STOPPING POINT:** After completing Step 27 (F21: Stripe webhook update), you will:

1. Push code to branch `claude/affiliate-foundation-{SESSION_ID}`
2. Run all validations
3. Inform user that Part 17A-1 is complete
4. **DO NOT** proceed to API E2E tests or frontend - that's Part 17A-2

**WHY THIS SPLIT:**

- ✅ Natural breakpoint after backend APIs complete
- ✅ Backend can be fully tested independently
- ✅ Manageable context window (29 files vs 43)
- ✅ Clear deliverable: Working backend foundation
- ✅ Part 17A-2 will build frontend on this solid backend

---

## YOUR MISSION

You are Claude Code, tasked with building **Part 17A-1: Foundation & Backend APIs** for the Affiliate Marketing Platform using **Test-Driven Development (TDD)**. You will:

1. Build **test infrastructure** (Phase 0)
2. Create **foundation layer** with TDD (Phase A)
3. Develop **backend APIs** with TDD (Phase B)
4. Import Part 5 (NextAuth) and Part 12 (Stripe) correctly
5. Achieve **25% test coverage** minimum
6. Stop at Step 27 (after all backend APIs)
7. Push to feature branch and validate

**DELIVERABLE:** Complete, tested backend foundation ready for API E2E tests and frontend (Part 17A-2).

**CRITICAL DIFFERENCES FROM TRADITIONAL DEVELOPMENT:**

- ❌ Traditional: Write code → Test later → Fix bugs in production
- ✅ TDD: Write test → Code fails → Write code → Test passes → Refactor

**WHY TDD FOR AFFILIATE BACKEND:**

- ✅ Catch commission calculation bugs before production
- ✅ Ensure unified authentication works correctly
- ✅ Design cleaner APIs (tests force good architecture)
- ✅ Safe refactoring (tests protect against regressions)

**⚠️ COMMISSION MODEL:**

- **NEW (CURRENT):** Percentage-based commission
  - 20% discount for customers ($29.00 → $23.20)
  - 20% commission on net revenue ($23.20 × 20% = $4.64)
  - Both percentages configurable via AFFILIATE_CONFIG
- **CRITICAL:** All code MUST use percentage-based calculation

---

## ESSENTIAL FILES TO READ FIRST

**CRITICAL:** Read these files in order before writing any code.

### 1. **Project Overview & Current State**

```
PROGRESS-part-2.md                   # Current project status
README.md                            # Project overview
ARCHITECTURE-compress.md             # System architecture
IMPLEMENTATION-GUIDE.md              # Best practices
```

### 2. **Policy Files (YOUR RULES)**

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

### 3. **Part 17A-1 Requirements**

```
docs/build-orders/part-17a-affiliate-portal.md
docs/implementation-guides/v5_part_q.md
```

### 4. **Dependencies (MUST EXIST)**

```
lib/auth/session.ts                  # Part 5: requireAuth(), requireAffiliate()
lib/auth-options.ts                  # Part 5: NextAuth config
app/api/webhooks/stripe/route.ts     # Part 12: Stripe webhook
app/api/checkout/create-session/route.ts  # Part 12: Checkout
prisma/schema.prisma                 # Database schema
```

### 5. **Testing Documentation**

```
VALIDATION-SETUP-GUIDE.md
CLAUDE.md
docs/testing/
```

### 6. **OpenAPI Specification**

```
docs/trading_alerts_openapi.yaml     # API contracts
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
│    └→ Make test pass (don't optimize yet)    │
│    └→ Run test: npm test (MUST PASS)         │
└──────────────────────────────────────────────┘
                    ↓
┌──────────────────────────────────────────────┐
│ 3. REFACTOR: Improve code quality           │
│    └→ Clean up while keeping tests green     │
│    └→ Run test: npm test (STILL PASSES)      │
└──────────────────────────────────────────────┘
                    ↓
         Repeat for next feature
```

### **TDD Rules (Non-Negotiable)**

✅ **ALWAYS:**

1. Write test FIRST (RED phase)
2. Run test to confirm it fails
3. Write minimal code to pass (GREEN phase)
4. Run test to confirm it passes
5. Refactor while keeping tests green
6. Commit test + implementation together

❌ **NEVER:**

1. Write code before tests
2. Skip the RED phase
3. Skip refactoring
4. Test implementation details
5. Use `any` types

---

## UNIFIED AUTHENTICATION - CRITICAL

**Affiliates use the same NextAuth system as SaaS users.**

### Key Concepts:

1. **User Model** has `isAffiliate: Boolean` (default false)
2. **AffiliateProfile** links to User via `userId` (1-to-1)
3. **Single Session** for both SaaS and affiliate access
4. **No separate JWT** - use NextAuth session

### Session Helpers (from Part 5):

```typescript
// lib/auth/session.ts
export async function requireAffiliate(): Promise<Session> {
  const session = await requireAuth();
  if (!session.user.isAffiliate) {
    throw new AuthError('Affiliate status required', 'FORBIDDEN', 403);
  }
  return session;
}
```

### Registration Flow:

```
1. User logs in via /login (NextAuth)
2. User navigates to /affiliate/register
3. Fills form: fullName, country, paymentMethod
4. Submit sets User.isAffiliate = true, creates AffiliateProfile
5. Email verification activates affiliate
6. User can now access /affiliate/* routes
```

---

## AFFILIATE BUSINESS LOGIC

### **Core Constants**

```typescript
export const AFFILIATE_CONFIG = {
  DISCOUNT_PERCENT: 20.0, // 20% discount for customers
  COMMISSION_PERCENT: 20.0, // 20% of net revenue
  CODES_PER_MONTH: 15,
  MINIMUM_PAYOUT: 50.0,
  CODE_EXPIRY_DAYS: 30,
  PAYMENT_METHODS: ['BANK_TRANSFER', 'PAYPAL', 'CRYPTOCURRENCY', 'WISE'],
} as const;
```

### **Commission Calculation (Percentage-Based)**

```
Regular price: $29.00
Discount (20%): $5.80
Net revenue: $23.20
Commission (20% of net): $4.64
Company nets: $18.56
```

---

## PART 17A-1 BUILD SEQUENCE: 34 FILES

**Build Order:** Test files (T#) BEFORE implementation files (F#)

```
PHASE 0: TEST INFRASTRUCTURE (2 files)
├─ Step 1:  T1 - __tests__/setup.ts
└─ Step 2:  T2 - __tests__/helpers/supertest-setup.ts

PHASE A: FOUNDATION (13 files)
├─ Step 3:  F1 - prisma/schema.prisma (VERIFY)
├─ Step 4:  F2 - lib/affiliate/constants.ts
├─ Step 5:  T3 - __tests__/lib/affiliate/code-generator.test.ts (RED)
├─ Step 6:  F3 - lib/affiliate/code-generator.ts (GREEN)
├─ Step 7:  F3 - lib/affiliate/code-generator.ts (REFACTOR)
├─ Step 8:  T4 - __tests__/lib/affiliate/commission-calculator.test.ts (RED)
├─ Step 9:  F4 - lib/affiliate/commission-calculator.ts (GREEN)
├─ Step 10: F5 - lib/affiliate/report-builder.ts
├─ Step 11: F6 - lib/affiliate/validators.ts
├─ Step 12: F7 - lib/email/templates/affiliate/welcome.tsx
├─ Step 13: F8 - lib/email/templates/affiliate/code-distributed.tsx
├─ Step 14: F9 - lib/email/templates/affiliate/code-used.tsx
└─ Step 15: F10 - Migration (if needed)

PHASE B: BACKEND APIs (14 files)
├─ Step 16: T5 - __tests__/lib/affiliate/registration.test.ts (RED)
├─ Step 17: F11 - app/api/affiliate/auth/register/route.ts (GREEN)
├─ Step 18: F12 - app/api/affiliate/auth/verify-email/route.ts
├─ Step 19: F13 - app/api/affiliate/dashboard/stats/route.ts
├─ Step 20: F14 - app/api/affiliate/dashboard/codes/route.ts
├─ Step 21: F15 - app/api/affiliate/dashboard/code-inventory/route.ts
├─ Step 22: F16 - app/api/affiliate/dashboard/commission-report/route.ts
├─ Step 23: F17 - app/api/affiliate/profile/route.ts
├─ Step 24: F18 - app/api/affiliate/profile/payment/route.ts
├─ Step 25: F19 - app/api/checkout/validate-code/route.ts (NEW)
├─ Step 26: F20 - app/api/checkout/create-session/route.ts (UPDATE)
└─ Step 27: F21 - app/api/webhooks/stripe/route.ts (UPDATE)

TOTAL: 29 implementation files + 5 test files = 34 files
```

---

## DETAILED BUILD INSTRUCTIONS

### **PHASE 0: TEST INFRASTRUCTURE (Steps 1-2)**

#### **Step 1: T1 - Test Setup**

**File:** `__tests__/setup.ts`

```typescript
import { jest } from '@jest/globals';
import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';
import prisma from '@/lib/db/prisma';

jest.mock('@/lib/db/prisma', () => ({
  __esModule: true,
  default: mockDeep<PrismaClient>(),
}));

export const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

beforeEach(() => {
  mockReset(prismaMock);
});
```

**Commit:** `test(setup): add test infrastructure setup`

**Verify:** `npm test` should work

---

#### **Step 2: T2 - Supertest Setup**

**File:** `__tests__/helpers/supertest-setup.ts`

```typescript
import { NextRequest } from 'next/server';
import { createMocks } from 'node-mocks-http';

export async function setupSupertestApp() {
  // Setup test app configuration
  process.env.NODE_ENV = 'test';
  process.env.NEXTAUTH_SECRET = 'test-secret';

  return {
    // Helper methods for testing
    get: (url: string) => createMocks({ method: 'GET', url }),
    post: (url: string) => createMocks({ method: 'POST', url }),
    put: (url: string) => createMocks({ method: 'PUT', url }),
    delete: (url: string) => createMocks({ method: 'DELETE', url }),
  };
}

export async function teardownSupertestApp() {
  // Cleanup
}
```

**Commit:** `test(api): add supertest testing setup`

---

### **PHASE A: FOUNDATION (Steps 3-15)**

#### **Step 3: F1 - Verify Schema**

**Action:** Verify these models exist in `prisma/schema.prisma`:

- User (with isAffiliate field)
- AffiliateProfile
- AffiliateCode
- Commission

**Commit:** `chore(affiliate): verify schema for unified auth`

---

#### **Step 4: F2 - Constants**

**File:** `lib/affiliate/constants.ts`

```typescript
export const AFFILIATE_CONFIG = {
  DISCOUNT_PERCENT: 20.0,
  COMMISSION_PERCENT: 20.0,
  CODES_PER_MONTH: 15,
  MINIMUM_PAYOUT: 50.0,
  CODE_EXPIRY_DAYS: 30,
  PAYMENT_METHODS: [
    'BANK_TRANSFER',
    'PAYPAL',
    'CRYPTOCURRENCY',
    'WISE',
  ] as const,
  PAYMENT_FREQUENCY: 'MONTHLY',
} as const;

export type PaymentMethod = (typeof AFFILIATE_CONFIG.PAYMENT_METHODS)[number];
```

**Commit:** `feat(affiliate): add affiliate constants`

---

#### **Step 5: T3 - Code Generator Tests (RED)**

**File:** `__tests__/lib/affiliate/code-generator.test.ts`

```typescript
import {
  generateUniqueCode,
  distributeCodes,
} from '@/lib/affiliate/code-generator';
import { prismaMock } from '../../setup';

describe('Code Generator', () => {
  describe('generateUniqueCode', () => {
    it('should generate 8-character alphanumeric code', async () => {
      prismaMock.affiliateCode.findUnique.mockResolvedValue(null);
      const code = await generateUniqueCode();
      expect(code).toMatch(/^[A-Z0-9]{8}$/);
    });

    it('should generate unique codes', async () => {
      prismaMock.affiliateCode.findUnique.mockResolvedValue(null);
      const code1 = await generateUniqueCode();
      const code2 = await generateUniqueCode();
      expect(code1).not.toBe(code2);
    });

    it('should retry if code exists', async () => {
      prismaMock.affiliateCode.findUnique
        .mockResolvedValueOnce({ code: 'EXISTS1' } as any)
        .mockResolvedValueOnce(null);
      const code = await generateUniqueCode();
      expect(code).toBeDefined();
      expect(prismaMock.affiliateCode.findUnique).toHaveBeenCalledTimes(2);
    });

    it('should throw after max attempts', async () => {
      prismaMock.affiliateCode.findUnique.mockResolvedValue({
        code: 'EXISTS',
      } as any);
      await expect(generateUniqueCode()).rejects.toThrow(
        'Failed to generate unique code'
      );
    });
  });

  describe('distributeCodes', () => {
    it('should distribute specified number', async () => {
      prismaMock.affiliateCode.findUnique.mockResolvedValue(null);
      prismaMock.affiliateCode.create.mockResolvedValue({} as any);
      prismaMock.affiliateProfile.update.mockResolvedValue({} as any);

      await distributeCodes('aff-id-123', 5, 'MONTHLY');
      expect(prismaMock.affiliateCode.create).toHaveBeenCalledTimes(5);
    });

    it('should set expiry to end of month', async () => {
      prismaMock.affiliateCode.findUnique.mockResolvedValue(null);
      prismaMock.affiliateCode.create.mockResolvedValue({} as any);
      prismaMock.affiliateProfile.update.mockResolvedValue({} as any);

      await distributeCodes('aff-id-123', 1, 'INITIAL');
      const createCall = prismaMock.affiliateCode.create.mock.calls[0][0];
      const expiresAt = createCall.data.expiresAt;
      expect(expiresAt.getDate()).toBeGreaterThan(27);
    });

    it('should update profile stats', async () => {
      prismaMock.affiliateCode.findUnique.mockResolvedValue(null);
      prismaMock.affiliateCode.create.mockResolvedValue({} as any);
      prismaMock.affiliateProfile.update.mockResolvedValue({} as any);

      await distributeCodes('aff-id-123', 15, 'MONTHLY');
      expect(prismaMock.affiliateProfile.update).toHaveBeenCalledWith({
        where: { id: 'aff-id-123' },
        data: { codesDistributed: { increment: 15 } },
      });
    });
  });
});
```

**Commit:** `test(affiliate): add code generator tests (RED)`

**Run:** `npm test` → ❌ MUST FAIL

---

#### **Step 6: F3 - Code Generator (GREEN)**

**File:** `lib/affiliate/code-generator.ts`

```typescript
import crypto from 'crypto';
import { prisma } from '@/lib/db/prisma';

export async function generateUniqueCode(): Promise<string> {
  const maxAttempts = 10;

  for (let i = 0; i < maxAttempts; i++) {
    const bytes = crypto.randomBytes(6);
    const code = bytes.toString('hex').toUpperCase().slice(0, 8);

    const exists = await prisma.affiliateCode.findUnique({
      where: { code },
    });

    if (!exists) return code;
  }

  throw new Error('Failed to generate unique code after 10 attempts');
}

export async function distributeCodes(
  affiliateProfileId: string,
  count: number,
  reason: 'MONTHLY' | 'INITIAL' | 'BONUS'
): Promise<void> {
  const endOfMonth = new Date();
  endOfMonth.setMonth(endOfMonth.getMonth() + 1);
  endOfMonth.setDate(0);
  endOfMonth.setHours(23, 59, 59, 999);

  for (let i = 0; i < count; i++) {
    const code = await generateUniqueCode();
    await prisma.affiliateCode.create({
      data: {
        code,
        affiliateProfileId,
        status: 'ACTIVE',
        distributedAt: new Date(),
        distributionReason: reason,
        expiresAt: endOfMonth,
      },
    });
  }

  await prisma.affiliateProfile.update({
    where: { id: affiliateProfileId },
    data: { codesDistributed: { increment: count } },
  });
}
```

**Commit:** `feat(affiliate): add code generator (GREEN)`

**Run:** `npm test` → ✅ MUST PASS

---

#### **Step 7: F3 - Code Generator (REFACTOR)**

**File:** `lib/affiliate/code-generator.ts` (improve with logging)

```typescript
import crypto from 'crypto';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';

export async function generateUniqueCode(): Promise<string> {
  const maxAttempts = 10;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const bytes = crypto.randomBytes(6);
    const code = bytes.toString('hex').toUpperCase().slice(0, 8);

    const exists = await prisma.affiliateCode.findUnique({
      where: { code },
    });

    if (!exists) {
      logger.debug('Generated unique affiliate code', { code, attempt });
      return code;
    }
  }

  logger.error('Failed to generate unique code', { maxAttempts });
  throw new Error('Failed to generate unique code after 10 attempts');
}

export async function distributeCodes(
  affiliateProfileId: string,
  count: number,
  reason: 'MONTHLY' | 'INITIAL' | 'BONUS'
): Promise<void> {
  try {
    const endOfMonth = calculateEndOfMonth();

    const codes = await Promise.all(
      Array.from({ length: count }, async () => {
        const code = await generateUniqueCode();
        return prisma.affiliateCode.create({
          data: {
            code,
            affiliateProfileId,
            status: 'ACTIVE',
            distributedAt: new Date(),
            distributionReason: reason,
            expiresAt: endOfMonth,
          },
        });
      })
    );

    await prisma.affiliateProfile.update({
      where: { id: affiliateProfileId },
      data: { codesDistributed: { increment: count } },
    });

    logger.info('Codes distributed', { affiliateProfileId, count, reason });
  } catch (error) {
    logger.error('Failed to distribute codes', { error, affiliateProfileId });
    throw error;
  }
}

function calculateEndOfMonth(): Date {
  const endOfMonth = new Date();
  endOfMonth.setMonth(endOfMonth.getMonth() + 1);
  endOfMonth.setDate(0);
  endOfMonth.setHours(23, 59, 59, 999);
  return endOfMonth;
}
```

**Commit:** `refactor(affiliate): improve code generator with logging`

**Run:** `npm test` → ✅ STILL PASSES

---

#### **Step 8: T4 - Commission Calculator Tests (RED)**

**File:** `__tests__/lib/affiliate/commission-calculator.test.ts`

```typescript
import { calculateCommission } from '@/lib/affiliate/commission-calculator';
import { AFFILIATE_CONFIG } from '@/lib/affiliate/constants';

describe('Commission Calculator', () => {
  it('should calculate 20% commission on net revenue', () => {
    const netRevenue = 23.2; // After 20% discount from $29
    const commission = calculateCommission(netRevenue);
    expect(commission).toBe(4.64); // 20% of $23.20
  });

  it('should handle different net revenues', () => {
    expect(calculateCommission(100.0)).toBe(20.0);
    expect(calculateCommission(50.0)).toBe(10.0);
    expect(calculateCommission(23.2)).toBe(4.64);
  });

  it('should use AFFILIATE_CONFIG percentage', () => {
    const netRevenue = 100.0;
    const expected = (netRevenue * AFFILIATE_CONFIG.COMMISSION_PERCENT) / 100;
    expect(calculateCommission(netRevenue)).toBe(expected);
  });

  it('should handle zero revenue', () => {
    expect(calculateCommission(0)).toBe(0);
  });
});
```

**Commit:** `test(affiliate): add commission calculator tests (RED)`

**Run:** `npm test` → ❌ MUST FAIL

---

#### **Step 9: F4 - Commission Calculator (GREEN)**

**File:** `lib/affiliate/commission-calculator.ts`

```typescript
import { AFFILIATE_CONFIG } from './constants';

/**
 * Calculate affiliate commission (percentage-based)
 * @param netRevenue - Revenue after discount
 * @returns Commission amount (20% of net revenue)
 */
export function calculateCommission(netRevenue: number): number {
  return (netRevenue * AFFILIATE_CONFIG.COMMISSION_PERCENT) / 100;
}
```

**Commit:** `feat(affiliate): add percentage-based commission calculator (GREEN)`

**Run:** `npm test` → ✅ MUST PASS

---

#### **Steps 10-15: Supporting Files**

**Step 10: F5 - Report Builder**
**File:** `lib/affiliate/report-builder.ts`

```typescript
import { prisma } from '@/lib/db/prisma';

interface CodeInventoryReport {
  period: { start: Date; end: Date };
  openingBalance: number;
  additions: {
    monthlyDistribution: number;
    bonusDistribution: number;
    total: number;
  };
  reductions: {
    used: number;
    expired: number;
    cancelled: number;
    total: number;
  };
  closingBalance: number;
}

export async function buildCodeInventoryReport(
  affiliateProfileId: string,
  period: { start: Date; end: Date }
): Promise<CodeInventoryReport> {
  const codesAtStart = await prisma.affiliateCode.count({
    where: {
      affiliateProfileId,
      distributedAt: { lt: period.start },
      OR: [{ usedAt: null }, { usedAt: { gte: period.start } }],
    },
  });

  const additions = await prisma.affiliateCode.groupBy({
    by: ['distributionReason'],
    where: {
      affiliateProfileId,
      distributedAt: { gte: period.start, lte: period.end },
    },
    _count: true,
  });

  const reductions = await prisma.affiliateCode.groupBy({
    by: ['status'],
    where: {
      affiliateProfileId,
      OR: [
        { usedAt: { gte: period.start, lte: period.end } },
        {
          expiresAt: { gte: period.start, lte: period.end },
          status: 'EXPIRED',
        },
      ],
    },
    _count: true,
  });

  const monthlyDistribution =
    additions.find((a) => a.distributionReason === 'MONTHLY')?._count || 0;
  const bonusDistribution =
    additions.find((a) => a.distributionReason === 'BONUS')?._count || 0;
  const totalAdditions = monthlyDistribution + bonusDistribution;

  const used = reductions.find((r) => r.status === 'USED')?._count || 0;
  const expired = reductions.find((r) => r.status === 'EXPIRED')?._count || 0;
  const cancelled =
    reductions.find((r) => r.status === 'CANCELLED')?._count || 0;
  const totalReductions = used + expired + cancelled;

  return {
    period,
    openingBalance: codesAtStart,
    additions: {
      monthlyDistribution,
      bonusDistribution,
      total: totalAdditions,
    },
    reductions: {
      used,
      expired,
      cancelled,
      total: totalReductions,
    },
    closingBalance: codesAtStart + totalAdditions - totalReductions,
  };
}
```

**Commit:** `feat(affiliate): add report builder`

---

**Step 11: F6 - Validators**
**File:** `lib/affiliate/validators.ts`

```typescript
import { z } from 'zod';
import { AFFILIATE_CONFIG } from './constants';

export const affiliateRegistrationSchema = z.object({
  fullName: z.string().min(2).max(100),
  country: z.string().length(2),
  paymentMethod: z.enum(AFFILIATE_CONFIG.PAYMENT_METHODS),
  paymentDetails: z.record(z.unknown()),
  terms: z.boolean().refine((v) => v === true, 'Must accept terms'),
});

export function validateAffiliateCode(code: string): boolean {
  return /^[A-Z0-9]{8}$/.test(code);
}
```

**Commit:** `feat(affiliate): add validators`

---

**Step 12: F7 - Welcome Email**
**File:** `lib/email/templates/affiliate/welcome.tsx`

```typescript
import * as React from 'react';
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from '@react-email/components';

interface WelcomeEmailProps {
  affiliateName: string;
  verificationLink: string;
}

export default function AffiliateWelcomeEmail({
  affiliateName,
  verificationLink,
}: WelcomeEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Welcome to the Trading Alerts Affiliate Program</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Welcome, {affiliateName}!</Heading>
          <Text style={text}>
            Thank you for joining the Trading Alerts Affiliate Program.
            Please verify your email to activate your affiliate account.
          </Text>
          <Link href={verificationLink} style={button}>
            Verify Email
          </Link>
          <Text style={text}>
            Once verified, you'll receive 15 affiliate codes to start
            earning commissions.
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
const button = {
  backgroundColor: '#5469d4',
  borderRadius: '4px',
  color: '#fff',
  fontSize: '16px',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'block',
  padding: '12px',
};
```

**Commit:** `feat(email): add affiliate welcome template`

---

**Step 13: F8 - Code Distributed Email**
**File:** `lib/email/templates/affiliate/code-distributed.tsx`

```typescript
import * as React from 'react';
import { Body, Container, Head, Heading, Html, Text } from '@react-email/components';

interface CodeDistributedEmailProps {
  affiliateName: string;
  codesCount: number;
  reason: string;
}

export default function CodeDistributedEmail({
  affiliateName,
  codesCount,
  reason,
}: CodeDistributedEmailProps) {
  return (
    <Html>
      <Head />
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>New Codes Distributed</Heading>
          <Text style={text}>
            Hi {affiliateName}, {codesCount} new affiliate codes have been
            distributed to your account.
          </Text>
          <Text style={text}>Reason: {reason}</Text>
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

**Commit:** `feat(email): add code distributed template`

---

**Step 14: F9 - Code Used Email**
**File:** `lib/email/templates/affiliate/code-used.tsx`

```typescript
import * as React from 'react';
import { Body, Container, Head, Heading, Html, Text } from '@react-email/components';

interface CodeUsedEmailProps {
  affiliateName: string;
  code: string;
  commission: number;
}

export default function CodeUsedEmail({
  affiliateName,
  code,
  commission,
}: CodeUsedEmailProps) {
  return (
    <Html>
      <Head />
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Code Used - Commission Earned!</Heading>
          <Text style={text}>
            Great news {affiliateName}! Your code {code} was used for a purchase.
          </Text>
          <Text style={text}>
            Commission earned: ${commission.toFixed(2)}
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

**Commit:** `feat(email): add code used notification template`

---

**Step 15: F10 - Migration (if needed)**
Check if schema changes require migration:

```bash
npx prisma migrate dev --name add-affiliate-models
```

**Commit:** `chore(db): add affiliate migrations`

---

### **PHASE B: BACKEND APIs (Steps 16-27)**

#### **Step 16: T5 - Registration Tests (RED)**

**File:** `__tests__/lib/affiliate/registration.test.ts`

```typescript
import { registerAffiliate } from '@/lib/affiliate/registration';
import { prismaMock } from '../../setup';

describe('Affiliate Registration', () => {
  it('should register user as affiliate', async () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      isAffiliate: false,
    };

    prismaMock.user.findUnique.mockResolvedValue(mockUser as any);
    prismaMock.user.update.mockResolvedValue({
      ...mockUser,
      isAffiliate: true,
    } as any);
    prismaMock.affiliateProfile.create.mockResolvedValue({} as any);

    const result = await registerAffiliate({
      userId: 'user-123',
      fullName: 'John Doe',
      country: 'US',
      paymentMethod: 'PAYPAL',
      paymentDetails: { email: 'john@paypal.com' },
    });

    expect(result.success).toBe(true);
  });

  it('should reject if already affiliate', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-123',
      isAffiliate: true,
    } as any);

    await expect(
      registerAffiliate({
        userId: 'user-123',
        fullName: 'John Doe',
        country: 'US',
        paymentMethod: 'PAYPAL',
        paymentDetails: {},
      })
    ).rejects.toThrow('Already registered');
  });
});
```

**Commit:** `test(affiliate): add registration tests (RED)`

**Run:** `npm test` → ❌ MUST FAIL

---

#### **Step 17: F11 - Registration API (GREEN)**

**File:** `app/api/affiliate/auth/register/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db/prisma';
import { affiliateRegistrationSchema } from '@/lib/affiliate/validators';
import crypto from 'crypto';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.isAffiliate) {
      return NextResponse.json(
        { error: 'Already registered as affiliate' },
        { status: 409 }
      );
    }

    const body = await request.json();
    const validation = affiliateRegistrationSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { fullName, country, paymentMethod, paymentDetails } =
      validation.data;
    const verificationToken = crypto.randomBytes(32).toString('hex');

    await prisma.$transaction([
      prisma.user.update({
        where: { id: session.user.id },
        data: { isAffiliate: true },
      }),
      prisma.affiliateProfile.create({
        data: {
          userId: session.user.id,
          fullName,
          country,
          paymentMethod,
          paymentDetails,
          status: 'PENDING_VERIFICATION',
          emailVerificationToken: verificationToken,
        },
      }),
    ]);

    // TODO: Send verification email

    return NextResponse.json({
      success: true,
      message: 'Registration successful. Please verify your email.',
    });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 });
  }
}
```

**Commit:** `feat(api): add affiliate registration endpoint (GREEN)`

**Run:** `npm test` → ✅ MUST PASS

---

#### **Steps 18-27: Remaining Backend APIs**

**Step 18: F12 - Email Verification**
**File:** `app/api/affiliate/auth/verify-email/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { distributeCodes } from '@/lib/affiliate/code-generator';
import { AFFILIATE_CONFIG } from '@/lib/affiliate/constants';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { token } = await request.json();

    const profile = await prisma.affiliateProfile.findFirst({
      where: { emailVerificationToken: token },
    });

    if (!profile) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
    }

    await prisma.affiliateProfile.update({
      where: { id: profile.id },
      data: {
        status: 'ACTIVE',
        emailVerificationToken: null,
        emailVerifiedAt: new Date(),
      },
    });

    // Distribute initial codes
    await distributeCodes(
      profile.id,
      AFFILIATE_CONFIG.CODES_PER_MONTH,
      'INITIAL'
    );

    return NextResponse.json({
      success: true,
      message: 'Email verified. Initial codes distributed.',
    });
  } catch (error) {
    console.error('Verification error:', error);
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}
```

**Commit:** `feat(api): add email verification endpoint`

---

**Step 19: F13 - Dashboard Stats**
**File:** `app/api/affiliate/dashboard/stats/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireAffiliate, getAffiliateProfile } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await requireAffiliate();
    const profile = await getAffiliateProfile();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const [activeCodes, usedCodes, totalCommissions, pendingCommissions] =
      await Promise.all([
        prisma.affiliateCode.count({
          where: { affiliateProfileId: profile.id, status: 'ACTIVE' },
        }),
        prisma.affiliateCode.count({
          where: { affiliateProfileId: profile.id, status: 'USED' },
        }),
        prisma.commission.aggregate({
          where: { affiliateCode: { affiliateProfileId: profile.id } },
          _sum: { amount: true },
        }),
        prisma.commission.aggregate({
          where: {
            affiliateCode: { affiliateProfileId: profile.id },
            status: 'PENDING',
          },
          _sum: { amount: true },
        }),
      ]);

    return NextResponse.json({
      activeCodes,
      usedCodes,
      totalEarnings: Number(totalCommissions._sum.amount || 0),
      pendingBalance: Number(pendingCommissions._sum.amount || 0),
      paidBalance: Number(profile.paidBalance || 0),
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
```

**Commit:** `feat(api): add dashboard stats endpoint`

---

**Step 20: F14 - Codes List**
**File:** `app/api/affiliate/dashboard/codes/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireAffiliate, getAffiliateProfile } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await requireAffiliate();
    const profile = await getAffiliateProfile();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status') || 'ACTIVE';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const [codes, total] = await Promise.all([
      prisma.affiliateCode.findMany({
        where: {
          affiliateProfileId: profile.id,
          status: status as any,
        },
        orderBy: { distributedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.affiliateCode.count({
        where: {
          affiliateProfileId: profile.id,
          status: status as any,
        },
      }),
    ]);

    return NextResponse.json({
      codes,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Codes list error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch codes' },
      { status: 500 }
    );
  }
}
```

**Commit:** `feat(api): add codes list endpoint`

---

**Step 21: F15 - Code Inventory Report**
**File:** `app/api/affiliate/dashboard/code-inventory/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireAffiliate, getAffiliateProfile } from '@/lib/auth/session';
import { buildCodeInventoryReport } from '@/lib/affiliate/report-builder';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await requireAffiliate();
    const profile = await getAffiliateProfile();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 1);

    const report = await buildCodeInventoryReport(profile.id, {
      start: startDate,
      end: endDate,
    });

    return NextResponse.json(report);
  } catch (error) {
    console.error('Code inventory error:', error);
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    );
  }
}
```

**Commit:** `feat(api): add code inventory report endpoint`

---

**Step 22: F16 - Commission Report**
**File:** `app/api/affiliate/dashboard/commission-report/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireAffiliate, getAffiliateProfile } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await requireAffiliate();
    const profile = await getAffiliateProfile();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const [commissions, total] = await Promise.all([
      prisma.commission.findMany({
        where: {
          affiliateCode: { affiliateProfileId: profile.id },
        },
        include: {
          affiliateCode: true,
        },
        orderBy: { earnedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.commission.count({
        where: {
          affiliateCode: { affiliateProfileId: profile.id },
        },
      }),
    ]);

    return NextResponse.json({
      commissions,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Commission report error:', error);
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    );
  }
}
```

**Commit:** `feat(api): add commission report endpoint`

---

**Step 23: F17 - Profile**
**File:** `app/api/affiliate/profile/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireAffiliate, getAffiliateProfile } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await requireAffiliate();
    const profile = await getAffiliateProfile();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    return NextResponse.json(profile);
  } catch (error) {
    console.error('Profile error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch profile' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    await requireAffiliate();
    const profile = await getAffiliateProfile();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const body = await request.json();
    const { fullName, country } = body;

    const updated = await prisma.affiliateProfile.update({
      where: { id: profile.id },
      data: { fullName, country },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Profile update error:', error);
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    );
  }
}
```

**Commit:** `feat(api): add profile endpoints`

---

**Step 24: F18 - Payment Method Update**
**File:** `app/api/affiliate/profile/payment/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireAffiliate, getAffiliateProfile } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';
import { AFFILIATE_CONFIG } from '@/lib/affiliate/constants';

const paymentSchema = z.object({
  paymentMethod: z.enum(AFFILIATE_CONFIG.PAYMENT_METHODS),
  paymentDetails: z.record(z.unknown()),
});

export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    await requireAffiliate();
    const profile = await getAffiliateProfile();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const body = await request.json();
    const validation = paymentSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { paymentMethod, paymentDetails } = validation.data;

    const updated = await prisma.affiliateProfile.update({
      where: { id: profile.id },
      data: { paymentMethod, paymentDetails },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Payment update error:', error);
    return NextResponse.json(
      { error: 'Failed to update payment' },
      { status: 500 }
    );
  }
}
```

**Commit:** `feat(api): add payment method update endpoint`

---

**Step 25: F19 - Validate Code (NEW)**
**File:** `app/api/checkout/validate-code/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { AFFILIATE_CONFIG } from '@/lib/affiliate/constants';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { code } = await request.json();

    if (!code) {
      return NextResponse.json({ error: 'Code required' }, { status: 400 });
    }

    const affiliateCode = await prisma.affiliateCode.findUnique({
      where: { code },
      include: { affiliateProfile: true },
    });

    if (!affiliateCode) {
      return NextResponse.json({ error: 'Invalid code' }, { status: 404 });
    }

    if (affiliateCode.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Code not active' }, { status: 400 });
    }

    if (affiliateCode.expiresAt < new Date()) {
      return NextResponse.json({ error: 'Code expired' }, { status: 400 });
    }

    return NextResponse.json({
      valid: true,
      discountPercent: AFFILIATE_CONFIG.DISCOUNT_PERCENT,
      affiliateId: affiliateCode.affiliateProfileId,
    });
  } catch (error) {
    console.error('Validate code error:', error);
    return NextResponse.json({ error: 'Validation failed' }, { status: 500 });
  }
}
```

**Commit:** `feat(api): add affiliate code validation for checkout`

---

**Step 26: F20 - Create Session (UPDATE)**
**File:** `app/api/checkout/create-session/route.ts`

Update existing checkout to support affiliate codes:

```typescript
// Add affiliate code support to existing checkout
import { AFFILIATE_CONFIG } from '@/lib/affiliate/constants';

// In POST handler, add:
const { affiliateCode } = await request.json();

let discountPercent = 0;
let affiliateCodeId = null;

if (affiliateCode) {
  const code = await prisma.affiliateCode.findUnique({
    where: { code: affiliateCode },
  });

  if (code && code.status === 'ACTIVE' && code.expiresAt > new Date()) {
    discountPercent = AFFILIATE_CONFIG.DISCOUNT_PERCENT;
    affiliateCodeId = code.id;
  }
}

// Calculate discounted price
const regularPrice = 29.0;
const discountAmount = (regularPrice * discountPercent) / 100;
const finalPrice = regularPrice - discountAmount;

// Store affiliateCodeId in session metadata
const session = await stripe.checkout.sessions.create({
  // ... existing config
  metadata: {
    userId: session.user.id,
    affiliateCodeId, // Add this
  },
  line_items: [
    {
      price_data: {
        currency: 'usd',
        product_data: { name: 'PRO Subscription' },
        unit_amount: Math.round(finalPrice * 100),
      },
      quantity: 1,
    },
  ],
});
```

**Commit:** `feat(checkout): integrate affiliate code discount`

---

**Step 27: F21 - Stripe Webhook (UPDATE)**
**File:** `app/api/webhooks/stripe/route.ts`

Update existing webhook to create commissions:

```typescript
// Add commission creation to existing webhook
import { calculateCommission } from '@/lib/affiliate/commission-calculator';

// In checkout.session.completed handler, add:
const affiliateCodeId = session.metadata?.affiliateCodeId;

if (affiliateCodeId) {
  const affiliateCode = await prisma.affiliateCode.findUnique({
    where: { id: affiliateCodeId },
  });

  if (affiliateCode) {
    // Mark code as used
    await prisma.affiliateCode.update({
      where: { id: affiliateCodeId },
      data: {
        status: 'USED',
        usedAt: new Date(),
        usedByUserId: userId,
      },
    });

    // Calculate commission
    const netRevenue = session.amount_total! / 100; // Stripe uses cents
    const commissionAmount = calculateCommission(netRevenue);

    // Create commission record
    await prisma.commission.create({
      data: {
        affiliateCodeId,
        amount: commissionAmount,
        status: 'PENDING',
        earnedAt: new Date(),
        subscriptionId,
      },
    });

    // Update affiliate balance
    await prisma.affiliateProfile.update({
      where: { id: affiliateCode.affiliateProfileId },
      data: {
        pendingBalance: { increment: commissionAmount },
        codesUsed: { increment: 1 },
      },
    });

    // TODO: Send email notification
  }
}
```

**Commit:** `feat(webhook): add commission creation for affiliate codes`

---

## STOPPING POINT - PART 17A-1 COMPLETE

**After Step 27, you MUST:**

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
   git push -u origin claude/affiliate-foundation-{SESSION_ID}
   ```

4. **Inform user:**

   ```
   Part 17A-1 (Foundation & Backend) is COMPLETE!

   ✅ 29 implementation files built
   ✅ 5 test files created
   ✅ All tests passing
   ✅ Backend APIs ready for testing

   NEXT STEP: Part 17A-2 will build:
   - API E2E tests (3 files)
   - Frontend pages and components (14 files)

   Branch: claude/affiliate-foundation-{SESSION_ID}
   Ready for Part 17A-2 prompt.
   ```

5. **DO NOT proceed to:**
   - API E2E tests (Phase C)
   - Frontend pages (Phase D)
   - These are in Part 17A-2

---

## VALIDATION REQUIREMENTS

After each file:

```bash
npm test                    # Tests pass
npm run validate:types      # TypeScript OK
npm run validate:lint       # ESLint OK
npm run validate:format     # Prettier OK
```

---

## SUCCESS CRITERIA FOR PART 17A-1

Part 17A-1 is complete when:

- ✅ All 5 test files created (RED phase)
- ✅ All 29 implementation files created (GREEN phase)
- ✅ All tests passing (npm test)
- ✅ Coverage ≥ 25%
- ✅ TypeScript validations pass
- ✅ ESLint checks pass
- ✅ Backend APIs functional
- ✅ Commission calculation uses percentage
- ✅ Unified auth works
- ✅ Code pushed to branch
- ✅ User informed Part 17A-1 complete

---

## EXECUTION CHECKLIST

### **Phase 0: Test Infrastructure**

- [ ] Step 1: T1 - setup.ts
- [ ] Step 2: T2 - supertest-setup.ts
- [ ] Verify: `npm test` works

### **Phase A: Foundation with TDD**

- [ ] Step 3: F1 - Verify schema
- [ ] Step 4: F2 - Constants
- [ ] Step 5: T3 - Code generator tests (RED) → `npm test` ❌
- [ ] Step 6: F3 - Code generator (GREEN) → `npm test` ✅
- [ ] Step 7: F3 - Refactor → `npm test` ✅
- [ ] Step 8: T4 - Commission tests (RED) → `npm test` ❌
- [ ] Step 9: F4 - Commission calculator (GREEN) → `npm test` ✅
- [ ] Steps 10-15: F5-F10 - Supporting files

### **Phase B: Backend APIs with TDD**

- [ ] Step 16: T5 - Registration tests (RED) → `npm test` ❌
- [ ] Step 17: F11 - Registration API (GREEN) → `npm test` ✅
- [ ] Steps 18-27: F12-F21 - Remaining APIs

### **Final Validation**

- [ ] Run: `npm test` (all pass)
- [ ] Run: `npm test -- --coverage` (≥ 25%)
- [ ] Run: `npm run validate`
- [ ] Push to branch
- [ ] Inform user Part 17A-1 complete
- [ ] **STOP - Do not proceed to Part 17A-2**

---

## FILE COUNT RECONCILIATION

**Part 17A-1 Files:**

- Phase 0: 2 test files
- Phase A: 3 test files + 10 implementation files
- Phase B: 0 test files + 14 implementation files (11 new + 3 updates)

**Total Part 17A-1:**

- 5 test files
- 29 implementation files (27 new + 2 updates)
- **34 total files**

**Remaining for Part 17A-2:**

- Phase C: 3 API E2E test files
- Phase D: 3 component test files + 11 implementation files
- **17 total files**

**Part 17A Total Verification:**

- Part 17A-1: 34 files
- Part 17A-2: 17 files
- **Combined: 51 steps (43 unique files + 8 test/refactor steps)**
- **Matches original Part 17A: 43 files ✅**

---

## WHEN TO ASK FOR HELP

Escalate if:

- Part 5 (NextAuth) files missing
- Part 12 (Stripe) files missing
- Critical security issues
- Schema migration errors
- More than 3 tests failing
- Coverage below 20%

Otherwise, work autonomously!

---

**Ready to build Part 17A-1! Follow TDD strictly: Write tests FIRST, watch them FAIL, make them PASS, then REFACTOR. Stop at Step 27 and inform user. Part 17A-2 will complete the affiliate portal.**
