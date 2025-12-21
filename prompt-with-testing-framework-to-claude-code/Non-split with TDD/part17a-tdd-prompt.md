# Part 17A: Affiliate Marketing Platform - Affiliate Portal with TDD

**Project:** Trading Alerts SaaS V7  
**Task:** Build Part 17A (Affiliate Portal) with Test-Driven Development  
**Files to Build:** 32 implementation files + 11 test files = **43 total files**  
**Estimated Time:** 10-12 hours (including TDD)  
**Current Status:** Parts 6-16 complete and merged to main  
**Testing Approach:** Red-Green-Refactor TDD + Supertest API Testing  
**Coverage Target:** 25% minimum

---

## YOUR MISSION

You are Claude Code, tasked with building **Part 17A: Affiliate Marketing Platform - Affiliate Portal** using **Test-Driven Development (TDD)**. You will:

1. Write **tests FIRST** (RED phase) for each feature
2. Build **minimal code** to pass tests (GREEN phase)
3. **Refactor** for quality while keeping tests green
4. Build 32 implementation files following all project policies
5. Create 11 test files (unit + integration + API tests)
6. Achieve **25% test coverage** minimum
7. Validate and commit each file individually

**CRITICAL DIFFERENCES FROM TRADITIONAL DEVELOPMENT:**

- ❌ Traditional: Write code → Test later → Fix bugs in production
- ✅ TDD: Write test → Code fails → Write code → Test passes → Refactor

**WHY TDD FOR AFFILIATE SYSTEM:**

- ✅ Catch commission calculation bugs before production (prevent revenue loss)
- ✅ Ensure code quality in ALL code paths
- ✅ Design cleaner APIs (tests force good architecture)
- ✅ Refactor safely (tests protect against regressions)
- ✅ Living documentation (tests show how code should work)

**⚠️ COMMISSION MODEL CHANGE:**

- **OLD (DEPRECATED):** Fixed $5 commission per sale
- **NEW (CURRENT):** Percentage-based commission
  - 20% discount for customers ($29.00 → $23.20)
  - 20% commission on net revenue ($23.20 × 20% = $4.64)
  - Both percentages configurable via SystemConfig
- **CRITICAL:** All tests and code MUST use percentage-based calculation

---

## ESSENTIAL FILES TO READ FIRST

**CRITICAL:** Read these files in order before writing any code. These files contain the "AI constitution" that guides all development.

### 1. **Project Overview & Current State**

```
PROGRESS-part-2.md                   # Current project status (Parts 6-16 complete)
README.md                            # Project overview
ARCHITECTURE-compress.md             # System architecture and design patterns
IMPLEMENTATION-GUIDE.md              # Implementation best practices
```

### 2. **Policy Files (MUST READ - These are your rules)**

```
docs/policies/00-tier-specifications.md              # FREE vs PRO tier rules
docs/policies/01-approval-policies.md                # When to approve/fix/escalate
docs/policies/02-quality-standards.md                # TypeScript, error handling
docs/policies/03-architecture-rules.md               # File structure, patterns
docs/policies/04-escalation-triggers.md              # When to ask for help
docs/policies/05-coding-patterns-part-1.md           # Copy-paste code patterns
docs/policies/05-coding-patterns-part-2.md           # More code patterns
docs/policies/06-aider-instructions.md               # Build workflow (Section 12)
```

### 3. **Part 17A Requirements & Build Order**

```
docs/build-orders/part-17a-affiliate-portal.md       # Build order for 32 files
docs/implementation-guides/v5_part_q.md              # Affiliate business logic
```

### 4. **Seed Code (MUST REFERENCE)**

```
seed-code/v0-components/part-17a-affiliate-dashboard/app/affiliate/dashboard/page.tsx
seed-code/v0-components/part-17a-affiliate-registration/app/affiliate/register/page.tsx
```

### 5. **Testing Documentation**

```
VALIDATION-SETUP-GUIDE.md                            # Validation tools
CLAUDE.md                                            # Automated validation
docs/testing/                                        # Testing frameworks
```

### 6. **OpenAPI & Dependencies**

```
docs/trading_alerts_openapi.yaml                     # API contracts
docs/build-orders/part-05-authentication.md          # NextAuth (DEPENDENCY)
docs/build-orders/part-12-ecommerce.md               # Stripe (DEPENDENCY)
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

1. Write test FIRST (RED phase) before any implementation code
2. Run test to confirm it fails with meaningful error
3. Write minimal code to pass (GREEN phase)
4. Run test to confirm it passes
5. Refactor while keeping tests green (REFACTOR phase)
6. Commit test + implementation together

❌ **NEVER:**

1. Write code before writing tests
2. Skip the RED phase (test must fail first)
3. Skip the refactor phase
4. Write tests that always pass (false positives)
5. Test implementation details (test behavior, not internals)
6. Mock excessively (keep tests realistic)

---

## UNIFIED AUTHENTICATION - CRITICAL CONCEPT

**CRITICAL:** Affiliates use the **same NextAuth authentication system** as SaaS users.

### Key Points:

1. **User Model** has `isAffiliate: Boolean` field (default false)
2. **AffiliateProfile** model links to User via `userId` (1-to-1)
3. **Single Session** for both SaaS and affiliate access
4. **No separate JWT** - use NextAuth session
5. **No separate login page** - users login via `/login`, then register as affiliate

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

export async function getAffiliateProfile() {
  const session = await getSession();
  if (!session?.user?.id || !session.user.isAffiliate) {
    return null;
  }
  return prisma.affiliateProfile.findUnique({
    where: { userId: session.user.id },
  });
}
```

### Registration Flow:

```
1. User logs in via /login (NextAuth)
2. User navigates to /affiliate/register (while authenticated)
3. Fills form: fullName, country, paymentMethod, paymentDetails
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
  COMMISSION_PERCENT: 20.0, // 20% of net revenue to affiliate
  CODES_PER_MONTH: 15, // Monthly allocation
  MINIMUM_PAYOUT: 50.0, // Min balance for payment
  CODE_EXPIRY_DAYS: 30, // Codes expire end of month
  PAYMENT_METHODS: ['BANK_TRANSFER', 'PAYPAL', 'CRYPTOCURRENCY', 'WISE'],
  PAYMENT_FREQUENCY: 'MONTHLY',
} as const;
```

### **Commission Model (Percentage-Based)**

- **20% discount** for customers using affiliate code
- **20% commission** calculated from net revenue (after discount)
- Example calculation:
  - Regular price: $29.00
  - Discount: $29.00 × 20% = $5.80
  - Customer pays (net revenue): $29.00 - $5.80 = $23.20
  - Commission: $23.20 × 20% = $4.64
- Company nets: $23.20 - $4.64 = $18.56

### **Code Distribution**

- Initial: 15 codes on email verification
- Monthly: 15 codes on 1st of each month
- Bonus: Admin can distribute extra codes
- Expiry: All codes expire end of month distributed

---

## PART 17A BUILD SEQUENCE: 43 FILES TOTAL

**Build Order Philosophy:**

- Test files come BEFORE implementation files (TDD principle)
- Each test file (T#) is followed by its implementation file(s) (F#)
- Commit after each file or logical group

**Total Files:**

- 11 Test Files (T1-T11)
- 32 Implementation Files (F1-F32)
- 43 Files Total

---

## COMPLETE BUILD SEQUENCE (In Order)

### **PHASE 0: TEST INFRASTRUCTURE (2 files)**

**Build these first - they enable all other tests**

### **PHASE 0: TEST INFRASTRUCTURE (2 files)**

**Build these first - they enable all other tests**

**1. T1:** `__tests__/setup.ts`

```typescript
// Test environment setup
```

**Commit:** `test(setup): add test infrastructure setup`

**2. T2:** `__tests__/helpers/supertest-setup.ts`

```typescript
// Supertest API testing setup
```

**Commit:** `test(api): add supertest testing setup`

---

### **PHASE A: FOUNDATION (13 files = 3 tests + 10 implementation)**

#### **Feature Group 1: Database Schema (1 file)**

**3. F1:** `prisma/schema.prisma` (VERIFY ONLY)

- Verify User.isAffiliate exists
- Verify AffiliateProfile, AffiliateCode, Commission models exist
  **Commit:** `chore(affiliate): verify schema for unified auth`

#### **Feature Group 2: Constants (1 file)**

**4. F2:** `lib/affiliate/constants.ts`

```typescript
export const AFFILIATE_CONFIG = { ... }
```

**Commit:** `feat(affiliate): add affiliate constants`

#### **Feature Group 3: Code Generator (TEST → IMPLEMENT → REFACTOR)**

**5. T3:** `__tests__/lib/affiliate/code-generator.test.ts` (RED)

- Test: generate 8-char code
- Test: unique codes
- Test: distribution logic
  **Commit:** `test(affiliate): add code generator unit tests (RED)`
  **Run:** `npm test` → ❌ FAILS (expected)

**6. F3:** `lib/affiliate/code-generator.ts` (GREEN - minimal implementation)

```typescript
export async function generateUniqueCode(): Promise<string> { ... }
export async function distributeCodes(...): Promise<void> { ... }
```

**Commit:** `feat(affiliate): add crypto-secure code generator (GREEN)`
**Run:** `npm test` → ✅ PASSES

**7. F3-REFACTOR:** `lib/affiliate/code-generator.ts` (REFACTOR - improve quality)

- Add logging
- Better error handling
- Parallel code generation
  **Commit:** `refactor(affiliate): improve code generator with logging`
  **Run:** `npm test` → ✅ STILL PASSES

#### **Feature Group 4: Commission Calculator (TEST → IMPLEMENT)**

**8. T4:** `__tests__/lib/affiliate/commission-calculator.test.ts` (RED)

- Test: fixed $5 commission
- Test: multiple scenarios
  **Commit:** `test(affiliate): add commission calculator tests (RED)`
  **Run:** `npm test` → ❌ FAILS

**9. F4:** `lib/affiliate/commission-calculator.ts` (GREEN)

```typescript
export function calculateCommission(
  netRevenue: number,
  discountPercent: number
): number {
  return AFFILIATE_CONFIG.COMMISSION_AMOUNT;
}
```

**Commit:** `feat(affiliate): add commission calculator (GREEN)`
**Run:** `npm test` → ✅ PASSES

#### **Feature Group 5: Supporting Files (5 files)**

**10. F5:** `lib/affiliate/report-builder.ts`
**Commit:** `feat(affiliate): add report builder for accounting reports`

**11. F6:** `lib/affiliate/validators.ts`
**Commit:** `feat(affiliate): add code validation helpers`

**12. F7:** `lib/email/templates/affiliate/welcome.tsx`
**Commit:** `feat(affiliate): add welcome email template`

**13. F8:** `lib/email/templates/affiliate/code-distributed.tsx`
**Commit:** `feat(affiliate): add code distribution email template`

**14. F9:** `lib/email/templates/affiliate/code-used.tsx`
**Commit:** `feat(affiliate): add code used email template`

**15. F10:** Migration (if needed)
**Commit:** `chore(db): add affiliate migrations`

---

### **PHASE B: BACKEND APIs (14 files = 3 tests + 11 implementation)**

#### **Feature Group 6: Affiliate Registration (TEST → IMPLEMENT)**

**16. T5:** `__tests__/lib/affiliate/registration.test.ts` (RED)

- Test: register user as affiliate
- Test: reject if already affiliate
- Test: validation
  **Commit:** `test(affiliate): add registration unit tests (RED)`
  **Run:** `npm test` → ❌ FAILS

**17. F11:** `app/api/affiliate/auth/register/route.ts` (GREEN)

```typescript
export async function POST(request: NextRequest): Promise<NextResponse> {
  // Register affiliate logic
}
```

**Commit:** `feat(api): add affiliate registration endpoint (GREEN)`
**Run:** `npm test` → ✅ PASSES

#### **Feature Group 7: Backend API Routes (10 files)**

**18. F12:** `app/api/affiliate/auth/verify-email/route.ts`
**Commit:** `feat(api): add affiliate email verification endpoint`

**19. F13:** `app/api/affiliate/dashboard/stats/route.ts`
**Commit:** `feat(api): add affiliate dashboard stats endpoint`

**20. F14:** `app/api/affiliate/dashboard/codes/route.ts`
**Commit:** `feat(api): add affiliate codes list endpoint`

**21. F15:** `app/api/affiliate/dashboard/code-inventory/route.ts`
**Commit:** `feat(api): add code inventory report endpoint`

**22. F16:** `app/api/affiliate/dashboard/commission-report/route.ts`
**Commit:** `feat(api): add commission report endpoint`

**23. F17:** `app/api/affiliate/profile/route.ts`
**Commit:** `feat(api): add affiliate profile endpoints`

**24. F18:** `app/api/affiliate/profile/payment/route.ts`
**Commit:** `feat(api): add affiliate payment method update endpoint`

**25. F19:** `app/api/checkout/validate-code/route.ts` (NEW)
**Commit:** `feat(api): add affiliate code validation for checkout`

**26. F20:** `app/api/checkout/create-session/route.ts` (UPDATE EXISTING)
**Commit:** `feat(checkout): integrate affiliate code discount`

**27. F21:** `app/api/webhooks/stripe/route.ts` (UPDATE EXISTING)
**Commit:** `feat(webhook): add commission creation for affiliate codes`

---

### **PHASE C: API E2E TESTING (3 test files)**

**After all backend APIs are built, test them end-to-end**

**28. T6:** `__tests__/api/affiliate-registration.supertest.ts`

- Test: POST /api/affiliate/auth/register
- Test: POST /api/affiliate/auth/verify-email
- Test: authorization checks
  **Commit:** `test(api): add affiliate registration supertest (API E2E)`
  **Run:** `npm test` → Should PASS (APIs already built)

**29. T7:** `__tests__/api/affiliate-dashboard.supertest.ts`

- Test: GET /api/affiliate/dashboard/stats
- Test: GET /api/affiliate/dashboard/codes
- Test: GET /api/affiliate/dashboard/code-inventory
- Test: GET /api/affiliate/dashboard/commission-report
  **Commit:** `test(api): add affiliate dashboard supertest`
  **Run:** `npm test` → Should PASS

**30. T8:** `__tests__/api/affiliate-conversion.supertest.ts`

- Test: End-to-end conversion flow
- Test: Commission creation via webhook
- Test: Affiliate balance update
  **Commit:** `test(api): add affiliate conversion E2E test`
  **Run:** `npm test` → Should PASS

---

### **PHASE D: FRONTEND (14 files = 3 tests + 11 implementation)**

#### **Feature Group 8: Reusable Components (TEST → IMPLEMENT)**

**31. T9:** `__tests__/components/affiliate/stats-card.test.tsx` (RED)

- Test: render title and value
- Test: render icon
- Test: show trend
  **Commit:** `test(components): add stats card unit tests (RED)`
  **Run:** `npm test` → ❌ FAILS

**32. F30:** `components/affiliate/stats-card.tsx` (GREEN)

```typescript
export function StatsCard({ title, value, icon, trend }: StatsCardProps) { ... }
```

**Commit:** `feat(components): add affiliate stats card (GREEN)`
**Run:** `npm test` → ✅ PASSES

**33. T10:** `__tests__/components/affiliate/code-table.test.tsx` (RED)
**Commit:** `test(components): add code table unit tests (RED)`

**34. F31:** `components/affiliate/code-table.tsx` (GREEN)
**Commit:** `feat(components): add affiliate code table (GREEN)`

**35. T11:** `__tests__/components/affiliate/commission-table.test.tsx` (RED)
**Commit:** `test(components): add commission table unit tests (RED)`

**36. F32:** `components/affiliate/commission-table.tsx` (GREEN)
**Commit:** `feat(components): add affiliate commission table (GREEN)`

#### **Feature Group 9: Frontend Pages (8 files)**

**37. F22:** `app/affiliate/layout.tsx`
**Commit:** `feat(affiliate): add affiliate portal layout`

**38. F23:** `app/affiliate/register/page.tsx`
**Commit:** `feat(affiliate): add registration page`

**39. F24:** `app/affiliate/verify/page.tsx`
**Commit:** `feat(affiliate): add email verification page`

**40. F25:** `app/affiliate/dashboard/page.tsx`
**Commit:** `feat(affiliate): add dashboard page`

**41. F26:** `app/affiliate/dashboard/codes/page.tsx`
**Commit:** `feat(affiliate): add code inventory report page`

**42. F27:** `app/affiliate/dashboard/commissions/page.tsx`
**Commit:** `feat(affiliate): add commission report page`

**43. F28:** `app/affiliate/dashboard/profile/page.tsx`
**Commit:** `feat(affiliate): add profile page`

**44. F29:** `app/affiliate/dashboard/profile/payment/page.tsx`
**Commit:** `feat(affiliate): add payment preferences page`

---

## VISUAL BUILD ORDER SUMMARY

```
PHASE 0: Test Infrastructure (2)
├─ T1: setup.ts
└─ T2: supertest-setup.ts

PHASE A: Foundation (13)
├─ F1: schema (verify)
├─ F2: constants
├─ T3: code-generator.test.ts (RED)
├─ F3: code-generator.ts (GREEN)
├─ F3: code-generator.ts (REFACTOR)
├─ T4: commission-calculator.test.ts (RED)
├─ F4: commission-calculator.ts (GREEN)
├─ F5: report-builder.ts
├─ F6: validators.ts
├─ F7: welcome email
├─ F8: code-distributed email
├─ F9: code-used email
└─ F10: migrations

PHASE B: Backend APIs (14)
├─ T5: registration.test.ts (RED)
├─ F11: register route (GREEN)
├─ F12: verify-email route
├─ F13: dashboard stats route
├─ F14: codes route
├─ F15: code-inventory route
├─ F16: commission-report route
├─ F17: profile route
├─ F18: payment route
├─ F19: validate-code route (NEW)
├─ F20: create-session route (UPDATE)
└─ F21: stripe webhook (UPDATE)

PHASE C: API E2E Tests (3)
├─ T6: affiliate-registration.supertest.ts
├─ T7: affiliate-dashboard.supertest.ts
└─ T8: affiliate-conversion.supertest.ts

PHASE D: Frontend (14)
├─ T9: stats-card.test.tsx (RED)
├─ F30: stats-card.tsx (GREEN)
├─ T10: code-table.test.tsx (RED)
├─ F31: code-table.tsx (GREEN)
├─ T11: commission-table.test.tsx (RED)
├─ F32: commission-table.tsx (GREEN)
├─ F22: layout.tsx
├─ F23: register page
├─ F24: verify page
├─ F25: dashboard page
├─ F26: codes page
├─ F27: commissions page
├─ F28: profile page
└─ F29: payment page

TOTAL: 46 BUILD STEPS (43 unique files + 3 refactors)
```

---

## BUILD SEQUENCE RULES

1. **Always build test files (T#) BEFORE implementation files (F#)**
2. **Run `npm test` after each test file** (should FAIL - RED phase)
3. **Run `npm test` after each implementation file** (should PASS - GREEN phase)
4. **Refactor after GREEN** if code quality can be improved (REFACTOR phase)
5. **Commit after each file or logical group**
6. **Phase C tests come AFTER all backend APIs** (they test existing endpoints)
7. **Components follow TDD**, pages can be built without tests (mostly UI)

```typescript
import {
  generateUniqueCode,
  distributeCodes,
} from '@/lib/affiliate/code-generator';
import { prismaMock } from '../../setup';

describe('Affiliate Code Generator', () => {
  describe('generateUniqueCode', () => {
    it('should generate 8-character alphanumeric code', async () => {
      prismaMock.affiliateCode.findUnique.mockResolvedValue(null);

      const code = await generateUniqueCode();

      expect(code).toMatch(/^[A-Z0-9]{8}$/);
      expect(code.length).toBe(8);
    });

    it('should generate unique codes', async () => {
      prismaMock.affiliateCode.findUnique.mockResolvedValue(null);

      const code1 = await generateUniqueCode();
      const code2 = await generateUniqueCode();

      expect(code1).not.toBe(code2);
    });

    it('should retry if code already exists', async () => {
      prismaMock.affiliateCode.findUnique
        .mockResolvedValueOnce({ code: 'EXISTING1' } as any)
        .mockResolvedValueOnce(null);

      const code = await generateUniqueCode();

      expect(code).toBeDefined();
      expect(prismaMock.affiliateCode.findUnique).toHaveBeenCalledTimes(2);
    });

    it('should throw error after max attempts', async () => {
      prismaMock.affiliateCode.findUnique.mockResolvedValue({
        code: 'EXISTS',
      } as any);

      await expect(generateUniqueCode()).rejects.toThrow(
        'Failed to generate unique code'
      );
    });
  });

  describe('distributeCodes', () => {
    it('should distribute specified number of codes', async () => {
      prismaMock.affiliateCode.findUnique.mockResolvedValue(null);
      prismaMock.affiliateCode.create.mockResolvedValue({} as any);
      prismaMock.affiliateProfile.update.mockResolvedValue({} as any);

      await distributeCodes('affiliate-id-123', 5, 'MONTHLY');

      expect(prismaMock.affiliateCode.create).toHaveBeenCalledTimes(5);
    });

    it('should set expiry to end of month', async () => {
      prismaMock.affiliateCode.findUnique.mockResolvedValue(null);
      prismaMock.affiliateCode.create.mockResolvedValue({} as any);
      prismaMock.affiliateProfile.update.mockResolvedValue({} as any);

      await distributeCodes('affiliate-id-123', 1, 'INITIAL');

      const createCall = prismaMock.affiliateCode.create.mock.calls[0][0];
      const expiresAt = createCall.data.expiresAt;

      expect(expiresAt.getDate()).toBeGreaterThan(27); // End of month
    });

    it('should update affiliate profile stats', async () => {
      prismaMock.affiliateCode.findUnique.mockResolvedValue(null);
      prismaMock.affiliateCode.create.mockResolvedValue({} as any);
      prismaMock.affiliateProfile.update.mockResolvedValue({} as any);

      await distributeCodes('affiliate-id-123', 15, 'MONTHLY');

      expect(prismaMock.affiliateProfile.update).toHaveBeenCalledWith({
        where: { id: 'affiliate-id-123' },
        data: { codesDistributed: { increment: 15 } },
      });
    });
  });
});
```

**Commit:** `test(affiliate): add code generator unit tests (RED)`

**Run test:** `npm test` → **❌ FAILS** (functions don't exist yet)

#### **File 1/32:** `prisma/schema.prisma` (VERIFY)

- Verify User.isAffiliate exists
- Verify AffiliateProfile, AffiliateCode, Commission models exist
  **Commit:** `chore(affiliate): verify schema for unified auth`

#### **File 2/32:** `lib/affiliate/constants.ts`

```typescript
export const AFFILIATE_CONFIG = {
  DISCOUNT_PERCENT: 20.0, // 20% discount for customers
  COMMISSION_PERCENT: 20.0, // 20% of net revenue to affiliate
  CODES_PER_MONTH: 15, // Monthly allocation
  MINIMUM_PAYOUT: 50.0, // Min balance for payment
  CODE_EXPIRY_DAYS: 30, // Codes expire end of month
  PAYMENT_METHODS: ['BANK_TRANSFER', 'PAYPAL', 'CRYPTOCURRENCY', 'WISE'],
  PAYMENT_FREQUENCY: 'MONTHLY',
} as const;

export const PAYMENT_METHODS = [
  'BANK_TRANSFER',
  'PAYPAL',
  'CRYPTOCURRENCY',
  'WISE',
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
```

**Commit:** `feat(affiliate): add affiliate constants`

#### **File 3/32:** `lib/affiliate/code-generator.ts` (GREEN)

```typescript
import crypto from 'crypto';
import { prisma } from '@/lib/db/prisma';

export async function generateUniqueCode(): Promise<string> {
  const maxAttempts = 10;

  for (let i = 0; i < maxAttempts; i++) {
    // Generate crypto-secure random bytes
    const bytes = crypto.randomBytes(6);
    const code = bytes.toString('hex').toUpperCase().slice(0, 8);

    // Check uniqueness
    const exists = await prisma.affiliateCode.findUnique({
      where: { code },
    });

    if (!exists) {
      return code;
    }
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

  // Update affiliate profile stats
  await prisma.affiliateProfile.update({
    where: { id: affiliateProfileId },
    data: {
      codesDistributed: { increment: count },
    },
  });
}
```

**Commit:** `feat(affiliate): add crypto-secure code generator (GREEN)`

**Run test:** `npm test` → **✅ PASSES**

#### **File 3/32 (REFACTORED):**

```typescript
// lib/affiliate/code-generator.ts (refactored with better error handling)
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
      data: {
        codesDistributed: { increment: count },
      },
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

**Run test:** `npm test` → **✅ STILL PASSES**

---

### **Feature 2: Commission Calculator**

#### **File T4/11:** `__tests__/lib/affiliate/commission-calculator.test.ts` (RED)

```typescript
import { calculateCommission } from '@/lib/affiliate/commission-calculator';

describe('Commission Calculator', () => {
  describe('calculateCommission', () => {
    it('should calculate fixed $5 commission', () => {
      const commission = calculateCommission(2610, 10); // $26.10, 10% discount
      expect(commission).toBe(5.0);
    });

    it('should always return fixed amount regardless of price', () => {
      expect(calculateCommission(2900, 0)).toBe(5.0);
      expect(calculateCommission(2610, 10)).toBe(5.0);
      expect(calculateCommission(1000, 50)).toBe(5.0);
    });

    it('should handle zero discount', () => {
      const commission = calculateCommission(2900, 0);
      expect(commission).toBe(5.0);
    });
  });
});
```

**Commit:** `test(affiliate): add commission calculator tests (RED)`

**Run test:** `npm test` → **❌ FAILS**

#### **File 4/32:** `lib/affiliate/commission-calculator.ts` (GREEN + REFACTOR)

```typescript
import { AFFILIATE_CONFIG } from './constants';

/**
 * Calculate affiliate commission
 * Returns fixed $5.00 per PRO upgrade regardless of discount
 */
export function calculateCommission(
  netRevenue: number,
  discountPercent: number
): number {
  return AFFILIATE_CONFIG.COMMISSION_AMOUNT;
}
```

**Commit:** `feat(affiliate): add commission calculator (GREEN)`

**Run test:** `npm test` → **✅ PASSES**

---

### **File 5/32:** `lib/affiliate/report-builder.ts`

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

**Commit:** `feat(affiliate): add report builder for accounting reports`

### **Files 6-10:** Validators, Email Templates

```typescript
// File 6: lib/affiliate/validators.ts
// File 7: lib/email/templates/affiliate/welcome.tsx
// File 8: lib/email/templates/affiliate/code-distributed.tsx
// File 9: lib/email/templates/affiliate/code-used.tsx
```

**Commit each separately**

---

## PHASE B: BACKEND APIs WITH TDD (11 files + 3 test files)

### **Feature 3: Affiliate Registration**

#### **File T5/11:** `__tests__/lib/affiliate/registration.test.ts` (RED)

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
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: 'user-123' },
      data: { isAffiliate: true },
    });
  });

  it('should reject if already affiliate', async () => {
    const mockUser = { id: 'user-123', isAffiliate: true };
    prismaMock.user.findUnique.mockResolvedValue(mockUser as any);

    await expect(
      registerAffiliate({
        userId: 'user-123',
        fullName: 'John Doe',
        country: 'US',
        paymentMethod: 'PAYPAL',
        paymentDetails: {},
      })
    ).rejects.toThrow('Already registered as affiliate');
  });
});
```

**Commit:** `test(affiliate): add registration unit tests (RED)`

**Run test:** `npm test` → **❌ FAILS**

#### **File 11/32:** `app/api/affiliate/auth/register/route.ts` (GREEN)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';
import crypto from 'crypto';

const registerSchema = z.object({
  fullName: z.string().min(2),
  country: z.string().min(2),
  paymentMethod: z.enum(['BANK_TRANSFER', 'PAYPAL', 'CRYPTOCURRENCY', 'WISE']),
  paymentDetails: z.record(z.unknown()),
  terms: z.boolean().refine((v) => v === true, 'Must accept terms'),
});

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
    const validation = registerSchema.safeParse(body);

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

    return NextResponse.json({
      success: true,
      message: 'Registration successful. Please verify your email.',
    });
  } catch (error) {
    console.error('Affiliate registration error:', error);
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 });
  }
}
```

**Commit:** `feat(api): add affiliate registration endpoint (GREEN)`

---

### **Files 12-21:** Backend APIs

Build remaining backend files following same TDD pattern:

- File 12: Email verification
- File 13: Dashboard stats
- File 14: Codes list
- File 15-21: Additional APIs

**Each with corresponding unit tests before implementation**

---

## PHASE C: API TESTING WITH SUPERTEST (After Backend Complete)

### **File T6/11:** `__tests__/api/affiliate-registration.supertest.ts`

```typescript
import {
  setupSupertestApp,
  teardownSupertestApp,
} from '../helpers/supertest-setup';
import { prisma } from '@/lib/db/prisma';

describe('API: Affiliate Registration', () => {
  let request: any;
  let userToken: string;

  beforeAll(async () => {
    request = await setupSupertestApp();

    // Create test user
    await request.post('/api/auth/signup').send({
      email: 'affiliate-test@example.com',
      password: 'SecurePass123!',
      name: 'Affiliate Test',
    });

    const loginRes = await request.post('/api/auth/signin').send({
      email: 'affiliate-test@example.com',
      password: 'SecurePass123!',
    });
    userToken = loginRes.body.token;
  });

  afterAll(async () => {
    await teardownSupertestApp();
  });

  describe('POST /api/affiliate/auth/register', () => {
    it('should register user as affiliate', async () => {
      const response = await request
        .post('/api/affiliate/auth/register')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          fullName: 'John Doe',
          country: 'US',
          paymentMethod: 'PAYPAL',
          paymentDetails: { email: 'john@paypal.com' },
          terms: true,
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: expect.stringContaining('verify'),
      });
    });

    it('should reject if already affiliate', async () => {
      const response = await request
        .post('/api/affiliate/auth/register')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          fullName: 'John Doe',
          country: 'US',
          paymentMethod: 'PAYPAL',
          paymentDetails: { email: 'john@paypal.com' },
          terms: true,
        })
        .expect(409);

      expect(response.body.error).toContain('already');
    });

    it('should validate required fields', async () => {
      const response = await request
        .post('/api/affiliate/auth/register')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          fullName: 'J', // Too short
          country: 'US',
          // Missing fields
        })
        .expect(400);

      expect(response.body.error).toContain('Validation');
    });
  });
});
```

**Commit:** `test(api): add affiliate registration supertest (API E2E)`

### **File T7/11:** `__tests__/api/affiliate-dashboard.supertest.ts`

```typescript
describe('API: Affiliate Dashboard', () => {
  // Test GET /api/affiliate/dashboard/stats
  // Test GET /api/affiliate/dashboard/codes
  // Test GET /api/affiliate/dashboard/code-inventory
  // Test authorization checks
});
```

**Commit:** `test(api): add affiliate dashboard supertest`

### **File T8/11:** `__tests__/api/affiliate-conversion.supertest.ts`

```typescript
describe('API: Affiliate Conversion Flow', () => {
  it('should credit commission on successful conversion', async () => {
    // Create affiliate
    // Generate referral code
    // Track click with referral code
    // New user signs up with referral cookie
    // New user upgrades to PRO
    // Verify commission created
    // Verify affiliate balance increased
  });
});
```

**Commit:** `test(api): add affiliate conversion E2E test`

---

## PHASE D: FRONTEND WITH TDD (11 files + 3 test files)

### **File T9/11:** `__tests__/components/affiliate/stats-card.test.tsx`

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
    render(<StatsCard title="Conversions" value="12" trend={{ value: 8.5, direction: 'up' }} />);

    expect(screen.getByText(/8.5%/)).toBeInTheDocument();
  });
});
```

**Commit:** `test(components): add stats card unit tests (RED)`

### **File 30/32:** `components/affiliate/stats-card.tsx` (GREEN)

```typescript
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
            <p className={`text-sm mt-1 ${trend.direction === 'up' ? 'text-green-600' : 'text-red-600'}`}>
              {trend.direction === 'up' ? 'â†'' : 'â†"'} {trend.value}%
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

**Run test:** `npm test` → **✅ PASSES**

### **Files 22-32:** Frontend Pages

Build remaining frontend files:

- File 22: Affiliate layout
- File 23: Registration page
- File 24: Verification page
- File 25: Dashboard page
- Files 26-29: Report and profile pages
- Files 31-32: Additional components

**Add component tests for critical UI**

---

## TESTING SUMMARY

### **Test File Distribution**

```
✅ Phase 0: Test Infrastructure (2 files)
  - T1: setup.ts
  - T2: supertest-setup.ts

✅ Phase A: Foundation Tests (3 files)
  - T3: code-generator.test.ts
  - T4: commission-calculator.test.ts
  - T5: registration.test.ts

✅ Phase C: API Tests (3 files)
  - T6: affiliate-registration.supertest.ts
  - T7: affiliate-dashboard.supertest.ts
  - T8: affiliate-conversion.supertest.ts

✅ Phase D: Frontend Tests (3 files)
  - T9: stats-card.test.tsx
  - T10: code-table.test.tsx
  - T11: dashboard-page.test.tsx
```

### **Coverage Target: 25% Minimum**

```bash
# Run all tests with coverage
npm test -- --coverage

# Expected output:
# ------------------------|---------|----------|---------|---------|
# File                    | % Stmts | % Branch | % Funcs | % Lines |
# ------------------------|---------|----------|---------|---------|
# lib/affiliate/          |   28.5  |   25.3   |   30.2  |   27.8  |
# app/api/affiliate/      |   26.7  |   24.1   |   28.9  |   26.3  |
# components/affiliate/   |   24.2  |   22.8   |   25.6  |   23.9  |
# ------------------------|---------|----------|---------|---------|
```

---

## GIT WORKFLOW

### **Branch Strategy**

```bash
# Create new branch (MUST start with 'claude/' and end with session ID)
git checkout -b claude/affiliate-portal-tdd-{SESSION_ID}

# Commit pattern for TDD:
# 1. Commit RED (test file)
# 2. Commit GREEN (implementation passing test)
# 3. Commit REFACTOR (if changes made)

# Example:
git commit -m "test(affiliate): add code generator tests (RED)"
git commit -m "feat(affiliate): add code generator (GREEN)"
git commit -m "refactor(affiliate): improve code generator logging"

# After all files complete:
git push -u origin claude/affiliate-portal-tdd-{SESSION_ID}
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

- ✅ Write test FIRST (RED phase)
- ✅ Run test to confirm it fails
- ✅ Write minimal code to pass (GREEN phase)
- ✅ Run test to confirm it passes
- ✅ Refactor while keeping tests green
- ✅ Test behavior, not implementation
- ✅ Use realistic test data
- ✅ Commit test + implementation together
- ✅ Use percentage-based commission (20% of net revenue)
- ✅ Calculate net revenue before commission (regularPrice - discount)

### **DON'T:**

- ❌ Write code before tests
- ❌ Skip the RED phase
- ❌ Write tests that always pass
- ❌ Test implementation details
- ❌ Mock excessively
- ❌ Skip refactoring
- ❌ Use `any` types
- ❌ Use fixed $5 commission (outdated model)
- ❌ Calculate commission before applying discount in tests or code

---

## SUCCESS CRITERIA

Part 17A is complete when:

- ✅ All 11 test files created (RED phase)
- ✅ All 32 implementation files created (GREEN phase)
- ✅ All tests passing (npm test shows 0 failures)
- ✅ Coverage ≥ 25% (npm test -- --coverage)
- ✅ TypeScript validations pass (0 errors)
- ✅ ESLint checks pass
- ✅ Unified auth works (single NextAuth session)
- ✅ Affiliate registration flow tested
- ✅ Dashboard and reports tested
- ✅ Commission creation via webhook tested
- ✅ Code pushed to feature branch
- ✅ PR created (ready for review)

---

## EXECUTION CHECKLIST

Use TodoWrite to track progress:

### **Phase 0: Test Infrastructure (Steps 1-2)**

- [ ] 1. T1: Create test setup file
- [ ] 2. T2: Create supertest setup
- [ ] Verify test commands work: `npm test`

### **Phase A: Foundation with TDD (Steps 3-15)**

- [ ] 3. F1: Verify Prisma schema
- [ ] 4. F2: Create constants
- [ ] 5. T3: RED - Code generator tests → `npm test` (FAILS)
- [ ] 6. F3: GREEN - Code generator implementation → `npm test` (PASSES)
- [ ] 7. F3: REFACTOR - Improve code generator → `npm test` (PASSES)
- [ ] 8. T4: RED - Commission calculator tests → `npm test` (FAILS)
- [ ] 9. F4: GREEN - Commission calculator → `npm test` (PASSES)
- [ ] 10-15. F5-F10: Supporting files (report builder, validators, emails, migrations)

### **Phase B: Backend with TDD (Steps 16-27)**

- [ ] 16. T5: RED - Registration tests → `npm test` (FAILS)
- [ ] 17. F11: GREEN - Registration API → `npm test` (PASSES)
- [ ] 18-27. F12-F21: Remaining backend APIs (10 files)

### **Phase C: API E2E Testing (Steps 28-30)**

- [ ] 28. T6: Registration API supertest → `npm test` (PASSES)
- [ ] 29. T7: Dashboard API supertest → `npm test` (PASSES)
- [ ] 30. T8: Conversion flow E2E test → `npm test` (PASSES)

### **Phase D: Frontend with TDD (Steps 31-44)**

- [ ] 31. T9: RED - StatsCard test → `npm test` (FAILS)
- [ ] 32. F30: GREEN - StatsCard component → `npm test` (PASSES)
- [ ] 33. T10: RED - CodeTable test → `npm test` (FAILS)
- [ ] 34. F31: GREEN - CodeTable component → `npm test` (PASSES)
- [ ] 35. T11: RED - CommissionTable test → `npm test` (FAILS)
- [ ] 36. F32: GREEN - CommissionTable component → `npm test` (PASSES)
- [ ] 37-44. F22-F29: Frontend pages (8 files)

### **Final Validation**

- [ ] Run full test suite: `npm test`
- [ ] Check coverage: `npm test -- --coverage` (≥ 25%)
- [ ] Run TypeScript validation: `npm run validate:types`
- [ ] Run linting: `npm run validate:lint`
- [ ] Run formatting: `npm run validate:format`
- [ ] Manual testing checklist
- [ ] Push to remote: `git push -u origin claude/affiliate-portal-tdd-{SESSION_ID}`
- [ ] Create PR

---

## QUICK REFERENCE: FILE COUNT BY PHASE

| Phase       | Test Files | Implementation Files | Total  | Build Steps  |
| ----------- | ---------- | -------------------- | ------ | ------------ |
| **Phase 0** | 2          | 0                    | 2      | 1-2          |
| **Phase A** | 2          | 11                   | 13     | 3-15         |
| **Phase B** | 1          | 13                   | 14     | 16-27        |
| **Phase C** | 3          | 0                    | 3      | 28-30        |
| **Phase D** | 3          | 11                   | 14     | 31-44        |
| **TOTAL**   | **11**     | **35\***             | **46** | **44 steps** |

\*Note: 35 includes schema verification (F1) + 32 implementation files + 2 file updates (F20, F21)

---

## SIMPLIFIED BUILD SEQUENCE (Quick Reference)

**Just follow these 44 steps in order:**

```
PHASE 0: TEST INFRASTRUCTURE
1.  T1  - __tests__/setup.ts
2.  T2  - __tests__/helpers/supertest-setup.ts

PHASE A: FOUNDATION
3.  F1  - prisma/schema.prisma (verify)
4.  F2  - lib/affiliate/constants.ts
5.  T3  - __tests__/lib/affiliate/code-generator.test.ts (RED) → npm test ❌
6.  F3  - lib/affiliate/code-generator.ts (GREEN) → npm test ✅
7.  F3  - lib/affiliate/code-generator.ts (REFACTOR) → npm test ✅
8.  T4  - __tests__/lib/affiliate/commission-calculator.test.ts (RED) → npm test ❌
9.  F4  - lib/affiliate/commission-calculator.ts (GREEN) → npm test ✅
10. F5  - lib/affiliate/report-builder.ts
11. F6  - lib/affiliate/validators.ts
12. F7  - lib/email/templates/affiliate/welcome.tsx
13. F8  - lib/email/templates/affiliate/code-distributed.tsx
14. F9  - lib/email/templates/affiliate/code-used.tsx
15. F10 - prisma migration (if needed)

PHASE B: BACKEND APIs
16. T5  - __tests__/lib/affiliate/registration.test.ts (RED) → npm test ❌
17. F11 - app/api/affiliate/auth/register/route.ts (GREEN) → npm test ✅
18. F12 - app/api/affiliate/auth/verify-email/route.ts
19. F13 - app/api/affiliate/dashboard/stats/route.ts
20. F14 - app/api/affiliate/dashboard/codes/route.ts
21. F15 - app/api/affiliate/dashboard/code-inventory/route.ts
22. F16 - app/api/affiliate/dashboard/commission-report/route.ts
23. F17 - app/api/affiliate/profile/route.ts
24. F18 - app/api/affiliate/profile/payment/route.ts
25. F19 - app/api/checkout/validate-code/route.ts (NEW)
26. F20 - app/api/checkout/create-session/route.ts (UPDATE)
27. F21 - app/api/webhooks/stripe/route.ts (UPDATE)

PHASE C: API E2E TESTS
28. T6  - __tests__/api/affiliate-registration.supertest.ts → npm test ✅
29. T7  - __tests__/api/affiliate-dashboard.supertest.ts → npm test ✅
30. T8  - __tests__/api/affiliate-conversion.supertest.ts → npm test ✅

PHASE D: FRONTEND
31. T9  - __tests__/components/affiliate/stats-card.test.tsx (RED) → npm test ❌
32. F30 - components/affiliate/stats-card.tsx (GREEN) → npm test ✅
33. T10 - __tests__/components/affiliate/code-table.test.tsx (RED) → npm test ❌
34. F31 - components/affiliate/code-table.tsx (GREEN) → npm test ✅
35. T11 - __tests__/components/affiliate/commission-table.test.tsx (RED) → npm test ❌
36. F32 - components/affiliate/commission-table.tsx (GREEN) → npm test ✅
37. F22 - app/affiliate/layout.tsx
38. F23 - app/affiliate/register/page.tsx
39. F24 - app/affiliate/verify/page.tsx
40. F25 - app/affiliate/dashboard/page.tsx
41. F26 - app/affiliate/dashboard/codes/page.tsx
42. F27 - app/affiliate/dashboard/commissions/page.tsx
43. F28 - app/affiliate/dashboard/profile/page.tsx
44. F29 - app/affiliate/dashboard/profile/payment/page.tsx
```

**Legend:**

- **T#** = Test file (write BEFORE implementation)
- **F#** = Implementation file (write AFTER test)
- **❌** = Test should FAIL (RED phase)
- **✅** = Test should PASS (GREEN phase)
- **(RED)** = Write failing test first
- **(GREEN)** = Write code to pass test
- **(REFACTOR)** = Improve code quality

**Remember:** Always run `npm test` after each test file and implementation file to verify TDD cycle!

---

Escalate to user if:

- Critical security issues found
- Ambiguous test requirements
- Missing dependencies
- Prisma schema issues
- NextAuth session problems
- Stripe webhook questions
- Test coverage below 20% after all work
- More than 3 tests failing after implementation

Otherwise, work autonomously following TDD!

---

## START HERE - STEP BY STEP

1. **Read all policy files** (listed in "Essential Files to Read First" section)

2. **Create git branch:**

   ```bash
   git checkout main
   git pull origin main
   git checkout -b claude/affiliate-portal-tdd-{SESSION_ID}
   ```

3. **Build Phase 0 (Steps 1-2): Test Infrastructure**

   ```bash
   # Step 1: Create T1 (__tests__/setup.ts)
   # Step 2: Create T2 (__tests__/helpers/supertest-setup.ts)
   npm test  # Verify test infrastructure works
   ```

4. **Build Phase A (Steps 3-15): Foundation with TDD**

   ```bash
   # Step 3: F1 - Verify schema
   # Step 4: F2 - Create constants

   # Step 5-7: Code Generator (TDD cycle)
   # Step 5: T3 - Write test → npm test (RED - FAILS)
   # Step 6: F3 - Write implementation → npm test (GREEN - PASSES)
   # Step 7: F3 - Refactor → npm test (STILL PASSES)

   # Step 8-9: Commission Calculator (TDD cycle)
   # Step 8: T4 - Write test → npm test (RED - FAILS)
   # Step 9: F4 - Write implementation → npm test (GREEN - PASSES)

   # Steps 10-15: Supporting files (F5-F10)
   ```

5. **Build Phase B (Steps 16-27): Backend APIs with TDD**

   ```bash
   # Step 16-17: Registration (TDD cycle)
   # Step 16: T5 - Write test → npm test (RED - FAILS)
   # Step 17: F11 - Write API → npm test (GREEN - PASSES)

   # Steps 18-27: Additional APIs (F12-F21)
   ```

6. **Build Phase C (Steps 28-30): API E2E Tests**

   ```bash
   # Step 28: T6 - Registration supertest → npm test (PASSES)
   # Step 29: T7 - Dashboard supertest → npm test (PASSES)
   # Step 30: T8 - Conversion E2E test → npm test (PASSES)
   ```

7. **Build Phase D (Steps 31-44): Frontend with TDD**

   ```bash
   # Steps 31-36: Components with TDD
   # Step 31: T9 - StatsCard test → npm test (RED - FAILS)
   # Step 32: F30 - StatsCard component → npm test (GREEN - PASSES)
   # (Repeat for CodeTable and CommissionTable)

   # Steps 37-44: Pages (F22-F29)
   ```

8. **Final Validation**

   ```bash
   npm test                          # All tests pass
   npm test -- --coverage            # ≥ 25% coverage
   npm run validate                  # All validations pass
   ```

9. **Push and Create PR**
   ```bash
   git push -u origin claude/affiliate-portal-tdd-{SESSION_ID}
   # Create pull request on GitHub
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
# Write code
npm test  # ✅ MUST PASS
git commit -m "feat: add [feature] (GREEN)"

# 3. REFACTOR: Improve code (if needed)
# Edit [feature].ts
npm test  # ✅ STILL PASSES
git commit -m "refactor: improve [feature]"
```

---

**Ready to build Part 17A with Test-Driven Development? Start with Phase 0 test infrastructure, then follow the RED-GREEN-REFACTOR cycle for each feature. The user trusts you to write tests first and deliver production-ready, well-tested code!**
