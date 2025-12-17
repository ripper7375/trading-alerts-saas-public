# Part 17A: Affiliate Marketing Platform - Affiliate Portal - Claude Code Build Prompt

**Project:** Trading Alerts SaaS V7
**Task:** Build Part 17A (Affiliate Portal - Phases A-D) autonomously
**Files to Build:** 32 files
**Estimated Time:** 8 hours
**Current Status:** Parts 6-16 complete and merged to main

---

## YOUR MISSION

You are Claude Code, tasked with building **Part 17A: Affiliate Marketing Platform - Affiliate Portal** for the Trading Alerts SaaS V7 project. You will build 32 files autonomously following all project policies, architecture rules, and quality standards.

**CRITICAL:** This part uses **Unified Authentication** - affiliates use the same NextAuth session as SaaS users with an `isAffiliate` flag. NO separate JWT system.

**Your approach:**
1. Read ALL essential files listed below (policies, architecture, requirements)
2. Build files one-by-one in the specified order (grouped by phase)
3. Follow coding patterns from policy files
4. Reference seed code for affiliate dashboard and registration pages
5. Validate each file after creation (TypeScript, ESLint, Prettier)
6. Commit each file individually with descriptive commit messages
7. Test the affiliate portal after all files are built

---

## ESSENTIAL FILES TO READ FIRST

**CRITICAL:** Read these files in order before writing any code. These files contain the "AI constitution" that guides all development.

### 1. **Project Overview & Current State**
```
PROGRESS-part-2.md                   # Current project status (Parts 6-16 complete)
README.md                            # Project overview
ARCHITECTURE-compress.md             # System architecture and design patterns (compressed)
IMPLEMENTATION-GUIDE.md              # Implementation best practices
```

### 2. **Policy Files (MUST READ - These are your rules)**
```
docs/policies/00-tier-specifications.md              # FREE vs PRO tier rules (CRITICAL)
docs/policies/01-approval-policies.md                # When to approve/fix/escalate
docs/policies/02-quality-standards.md                # TypeScript, error handling standards
docs/policies/03-architecture-rules.md               # File structure, architecture patterns
docs/policies/04-escalation-triggers.md              # When to ask for human help
docs/policies/05-coding-patterns-part-1.md           # Copy-paste ready code patterns (Part 1)
docs/policies/05-coding-patterns-part-2.md           # Copy-paste ready code patterns (Part 2)
docs/policies/06-aider-instructions.md               # Build workflow instructions (Section 12 for Affiliate)
```

### 3. **Part 17A Requirements & Build Order**
```
docs/build-orders/part-17a-affiliate-portal.md       # Build order for all 32 files
docs/implementation-guides/v5_part_q.md              # Affiliate marketing business logic (CRITICAL)
```

### 4. **Seed Code (MUST REFERENCE)**
```
seed-code/v0-components/part-17a-affiliate-dashboard/app/affiliate/dashboard/page.tsx  # Dashboard reference
seed-code/v0-components/part-17a-affiliate-registration/app/affiliate/register/page.tsx  # Registration reference
```

### 5. **OpenAPI Specifications**
```
docs/trading_alerts_openapi.yaml                     # Next.js API contracts
```

### 6. **Validation & Testing**
```
VALIDATION-SETUP-GUIDE.md                            # Validation tools and process
CLAUDE.md                                            # Automated validation guide
```

### 7. **Previous Work (for context and dependencies)**
```
docs/build-orders/part-05-authentication.md          # NextAuth with isAffiliate support (DEPENDENCY)
docs/build-orders/part-12-ecommerce.md               # Stripe integration (DEPENDENCY)
```

---

## UNIFIED AUTHENTICATION - CRITICAL CONCEPT

**CRITICAL:** Affiliates use the **same NextAuth authentication system** as SaaS users.

### Key Points:
1. **User Model** has `isAffiliate: Boolean` field (default false)
2. **AffiliateProfile** model links to User via `userId` (1-to-1)
3. **Single Session** for both SaaS and affiliate access
4. **No separate JWT** - use NextAuth session
5. **No separate login page** - users login via `/login`, then register as affiliate at `/affiliate/register`

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

## PART 17A - FILES TO BUILD (In Order, Grouped by Phase)

Build these 32 files in sequence:

### **Phase A: Foundation (10 files)**

### **File 1/32:** `prisma/schema.prisma` (VERIFY ONLY)
- **Note:** Schema should already have affiliate models from Part 2
- Verify: User.isAffiliate Boolean field exists
- Verify: AffiliateProfile, AffiliateCode, Commission models exist
- Verify: Enums (AffiliateStatus, CodeStatus, etc.) exist
- **Commit:** `chore(affiliate): verify schema for unified auth`

### **File 2/32:** Migration (if needed)
- Run: `npx prisma migrate dev --name add_affiliate_models` (if not already done)
- **Commit:** (included in File 1 commit)

### **File 3/32:** `lib/affiliate/code-generator.ts`
- Generate crypto-secure affiliate codes (NO Math.random!)
- Function: `generateUniqueCode()` using `crypto.randomBytes()`
- Function: `distributeCodes(affiliateProfileId, count, reason)`
- Code format: 8 characters, alphanumeric uppercase
- **Commit:** `feat(affiliate): add crypto-secure code generator`

### **File 4/32:** `lib/affiliate/commission-calculator.ts`
- Calculate commission amounts
- Fixed $5 per PRO upgrade
- Functions: `calculateCommission(netRevenue, discount)`
- **Commit:** `feat(affiliate): add commission calculator`

### **File 5/32:** `lib/affiliate/report-builder.ts`
- Build accounting-style reports
- Functions: `buildCodeInventoryReport(affiliateProfileId, period)`
- Functions: `buildCommissionReport(affiliateProfileId, period)`
- Reconciliation: opening + additions - reductions = closing
- **Commit:** `feat(affiliate): add report builder for accounting reports`

### **File 6/32:** `lib/affiliate/validators.ts`
- Validate affiliate codes
- Functions: `validateCode(code)`, `isCodeActive(code)`, `isCodeExpired(code)`
- **Commit:** `feat(affiliate): add code validation helpers`

### **File 7/32:** `lib/email/templates/affiliate/welcome.tsx`
- Welcome email template (React Email)
- Includes: 15 initial codes, dashboard link, getting started tips
- **Commit:** `feat(affiliate): add welcome email template`

### **File 8/32:** `lib/email/templates/affiliate/code-distributed.tsx`
- Monthly code distribution email template
- Includes: code count, expiry date, current balance
- **Commit:** `feat(affiliate): add code distribution email template`

### **File 9/32:** `lib/email/templates/affiliate/code-used.tsx`
- Code used notification email template
- Includes: code, commission earned, new balance
- **Commit:** `feat(affiliate): add code used email template`

### **File 10/32:** `lib/affiliate/constants.ts`
- Affiliate system constants
- COMMISSION_AMOUNT = 5.00
- CODES_PER_MONTH = 15
- MINIMUM_PAYOUT = 50.00
- **Commit:** `feat(affiliate): add affiliate constants`

---

### **Phase B: Affiliate Portal Backend (11 files)**

### **File 11/32:** `app/api/affiliate/auth/register/route.ts`
- **POST:** Create affiliate account for existing authenticated user
- **Auth:** Require NextAuth session (user must be logged in)
- Body: `{ fullName, country, paymentMethod, paymentDetails, terms }`
- Validation: User not already affiliate (`session.user.isAffiliate === false`)
- Action: Set `User.isAffiliate = true`, create AffiliateProfile with PENDING_VERIFICATION status
- **Commit:** `feat(api): add affiliate registration endpoint`

### **File 12/32:** `app/api/affiliate/auth/verify-email/route.ts`
- **POST:** Verify email and activate affiliate
- **Auth:** Require NextAuth session
- Body: `{ token }`
- Action: Mark AffiliateProfile.status as ACTIVE, distribute 15 initial codes, send welcome email
- **Commit:** `feat(api): add affiliate email verification endpoint`

### **File 13/32:** `app/api/affiliate/dashboard/stats/route.ts`
- **GET:** Dashboard quick stats
- **Auth:** Require affiliate status (use `requireAffiliate()`)
- Return: totalCodesDistributed, activeCodesCount, usedCodesCount, totalEarnings, pendingCommissions, etc.
- **Commit:** `feat(api): add affiliate dashboard stats endpoint`

### **File 14/32:** `app/api/affiliate/dashboard/codes/route.ts`
- **GET:** List affiliate codes (paginated)
- **Auth:** Require affiliate status
- Query params: status, page, limit
- Return: codes array with status, distributed date, expiry, usage
- **Commit:** `feat(api): add affiliate codes list endpoint`

### **File 15/32:** `app/api/affiliate/dashboard/code-inventory/route.ts`
- **GET:** Code inventory report (accounting-style)
- **Auth:** Require affiliate status
- Query params: period (month/year)
- Return: `{ openingBalance, additions, reductions, closingBalance }`
- **Commit:** `feat(api): add code inventory report endpoint`

### **File 16/32:** `app/api/affiliate/dashboard/commission-report/route.ts`
- **GET:** Commission report (accounting-style)
- **Auth:** Require affiliate status
- Query params: period (month/year)
- Return: `{ openingBalance, earned, payments, closingBalance }`
- **Commit:** `feat(api): add commission report endpoint`

### **File 17/32:** `app/api/affiliate/profile/route.ts`
- **GET:** Get affiliate profile
- **PATCH:** Update affiliate profile (name, country)
- **Auth:** Require affiliate status
- **Commit:** `feat(api): add affiliate profile endpoints`

### **File 18/32:** `app/api/affiliate/profile/payment/route.ts`
- **PUT:** Update payment method and details
- **Auth:** Require affiliate status
- Body: `{ paymentMethod, paymentDetails }`
- **Commit:** `feat(api): add affiliate payment method update endpoint`

### **File 19/32:** `app/api/checkout/validate-code/route.ts` (NEW)
- **POST:** Validate affiliate code before checkout
- Body: `{ code }`
- Return: `{ valid: boolean, affiliateCode?: object, error?: string }`
- Validation: code exists, status ACTIVE, not expired
- **Commit:** `feat(api): add affiliate code validation for checkout`

### **File 20/32:** `app/api/checkout/create-session/route.ts` (UPDATE EXISTING)
- Add: affiliateCode parameter (optional)
- Validate code if provided
- Include affiliateCodeId and affiliateProfileId in Stripe metadata
- Apply discount when code valid (10% off: $29 → $26.10)
- **Commit:** `feat(checkout): integrate affiliate code discount`

### **File 21/32:** `app/api/webhooks/stripe/route.ts` (UPDATE EXISTING)
- Update: checkout.session.completed handler
- Check if metadata includes affiliateCodeId and affiliateProfileId
- Create Commission record ($5 fixed)
- Mark AffiliateCode as USED
- Update AffiliateProfile totalEarnings and codesUsed
- Send code-used email notification
- **CRITICAL:** Commission creation ONLY via webhook
- **Commit:** `feat(webhook): add commission creation for affiliate codes`

---

### **Phase D: Affiliate Portal Frontend (11 files)**

### **File 22/32:** `app/affiliate/layout.tsx`
- Affiliate-specific layout
- **Auth:** Check `session.user.isAffiliate` (redirect if false)
- Sidebar navigation: Dashboard, Codes, Commissions, Profile
- Header with affiliate name and signOut button
- **Reference:** `seed-code/v0-components/part-17a-affiliate-dashboard/app/affiliate/dashboard/page.tsx`
- **Commit:** `feat(affiliate): add affiliate portal layout`

### **File 23/32:** `app/affiliate/register/page.tsx`
- Affiliate registration page for existing authenticated users
- **Auth:** Require NextAuth session (user must be logged in first)
- Form: fullName, country, paymentMethod, paymentDetails, terms checkbox
- Submit to POST /api/affiliate/auth/register
- **Reference:** `seed-code/v0-components/part-17a-affiliate-registration/app/affiliate/register/page.tsx`
- **Commit:** `feat(affiliate): add registration page`

### **File 24/32:** `app/affiliate/verify/page.tsx`
- Email verification page
- **Auth:** Require NextAuth session
- Extracts token from URL query (?token=xxx)
- Calls POST /api/affiliate/auth/verify-email
- Shows success/error message
- **Commit:** `feat(affiliate): add email verification page`

### **File 25/32:** `app/affiliate/dashboard/page.tsx`
- Main affiliate dashboard
- Quick stats cards (using /api/affiliate/dashboard/stats)
- Recent activity table (last 10 code uses)
- Action buttons (View Reports, Update Payment)
- **Reference:** `seed-code/v0-components/part-17a-affiliate-dashboard/app/affiliate/dashboard/page.tsx`
- **Commit:** `feat(affiliate): add dashboard page`

### **File 26/32:** `app/affiliate/dashboard/codes/page.tsx`
- Code inventory report page
- Fetch data from GET /api/affiliate/dashboard/code-inventory
- Display: opening balance, additions, reductions, closing balance
- Drill-down: click numbers to see details
- Chart: Bar chart showing monthly trends
- **Commit:** `feat(affiliate): add code inventory report page`

### **File 27/32:** `app/affiliate/dashboard/commissions/page.tsx`
- Commission report page
- Fetch data from GET /api/affiliate/dashboard/commission-report
- Display: opening balance, earned (with code details), payments, closing balance
- Period selector (month/year)
- **Commit:** `feat(affiliate): add commission report page`

### **File 28/32:** `app/affiliate/dashboard/profile/page.tsx`
- Profile overview page
- Display: name, email, country, status, registration date
- Edit button → navigate to payment page
- **Commit:** `feat(affiliate): add profile page`

### **File 29/32:** `app/affiliate/dashboard/profile/payment/page.tsx`
- Payment preferences page
- Form: paymentMethod dropdown, paymentDetails (conditional fields)
- Submit to PUT /api/affiliate/profile/payment
- **Commit:** `feat(affiliate): add payment preferences page`

### **File 30/32:** `components/affiliate/stats-card.tsx`
- Reusable stats card component
- Props: `{ title, value, icon, trend }`
- **Commit:** `feat(components): add affiliate stats card`

### **File 31/32:** `components/affiliate/code-table.tsx`
- Reusable code list table
- Props: `{ codes, onCopy }`
- Columns: Code, Status, Distributed, Expires, Used
- **Commit:** `feat(components): add affiliate code table`

### **File 32/32:** `components/affiliate/commission-table.tsx`
- Reusable commission table
- Props: `{ commissions }`
- Columns: Date, Code, User (masked), Amount, Status
- **Commit:** `feat(components): add affiliate commission table`

---

## GIT WORKFLOW

### **Branch Strategy**
```bash
# Create new branch (MUST start with 'claude/' and end with session ID)
git checkout -b claude/affiliate-portal-{SESSION_ID}

# Build files one by one, commit each file individually
# After all 32 files complete:
git push -u origin claude/affiliate-portal-{SESSION_ID}
```

### **Commit Message Format**
Use conventional commits:
```
feat(affiliate): add crypto-secure code generator
feat(api): add affiliate registration endpoint
feat(webhook): add commission creation for affiliate codes
fix(affiliate): correct TypeScript type error
```

### **Push Requirements**
- Branch MUST start with `claude/`
- Branch MUST end with session ID
- Push ONLY after all validations pass
- Create PR after push (do NOT merge to main directly)

---

## VALIDATION REQUIREMENTS

After building each file, run validation:

```bash
# Validate TypeScript types
npm run validate:types

# Validate code quality
npm run validate:lint

# Validate formatting
npm run validate:format

# Run all validations together
npm run validate
```

### **Auto-Fix Minor Issues**
```bash
# Auto-fix ESLint and Prettier issues
npm run fix
```

---

## KEY REQUIREMENTS FOR PART 17A

### **1. Affiliate Constants**

```typescript
// lib/affiliate/constants.ts
export const AFFILIATE_CONFIG = {
  COMMISSION_AMOUNT: 5.00,        // $5 per PRO upgrade
  CODES_PER_MONTH: 15,            // Monthly allocation
  MINIMUM_PAYOUT: 50.00,          // Min balance for payment
  CODE_EXPIRY_DAYS: 30,           // Codes expire end of month
  DISCOUNT_PERCENT: 10,           // 10% discount for customers
} as const;

export const PAYMENT_METHODS = [
  'BANK_TRANSFER',
  'PAYPAL',
  'CRYPTOCURRENCY',
  'WISE',
] as const;

export type PaymentMethod = typeof PAYMENT_METHODS[number];
```

### **2. Code Generator (Crypto-Secure)**

```typescript
// lib/affiliate/code-generator.ts
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

### **3. Affiliate Registration API**

```typescript
// app/api/affiliate/auth/register/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';

const registerSchema = z.object({
  fullName: z.string().min(2),
  country: z.string().min(2),
  paymentMethod: z.enum(['BANK_TRANSFER', 'PAYPAL', 'CRYPTOCURRENCY', 'WISE']),
  paymentDetails: z.record(z.unknown()),
  terms: z.boolean().refine((v) => v === true, 'Must accept terms'),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Require authenticated session
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check not already affiliate
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

    const { fullName, country, paymentMethod, paymentDetails } = validation.data;

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // Create affiliate profile and update user in transaction
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

    // Send verification email
    // await sendVerificationEmail(session.user.email, verificationToken);

    return NextResponse.json({
      success: true,
      message: 'Registration successful. Please verify your email.',
    });
  } catch (error) {
    console.error('Affiliate registration error:', error);
    return NextResponse.json(
      { error: 'Registration failed' },
      { status: 500 }
    );
  }
}
```

### **4. Dashboard Stats API**

```typescript
// app/api/affiliate/dashboard/stats/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAffiliate } from '@/lib/auth/session';

export async function GET(): Promise<NextResponse> {
  try {
    const session = await requireAffiliate();

    const profile = await prisma.affiliateProfile.findUnique({
      where: { userId: session.user.id },
      include: {
        affiliateCodes: true,
        commissions: true,
      },
    });

    if (!profile) {
      return NextResponse.json(
        { error: 'Affiliate profile not found' },
        { status: 404 }
      );
    }

    const stats = {
      totalCodesDistributed: profile.codesDistributed,
      activeCodesCount: profile.affiliateCodes.filter(
        (c) => c.status === 'ACTIVE'
      ).length,
      usedCodesCount: profile.codesUsed,
      totalEarnings: Number(profile.totalEarnings),
      pendingCommissions: profile.commissions
        .filter((c) => c.status === 'PENDING')
        .reduce((sum, c) => sum + Number(c.amount), 0),
      paidCommissions: Number(profile.paidCommissions),
      currentMonthEarnings: profile.commissions
        .filter((c) => {
          const startOfMonth = new Date();
          startOfMonth.setDate(1);
          startOfMonth.setHours(0, 0, 0, 0);
          return new Date(c.earnedAt) >= startOfMonth;
        })
        .reduce((sum, c) => sum + Number(c.amount), 0),
      conversionRate: profile.codesDistributed > 0
        ? (profile.codesUsed / profile.codesDistributed) * 100
        : 0,
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
```

### **5. Stripe Webhook Commission Creation**

```typescript
// app/api/webhooks/stripe/route.ts (UPDATE - add commission logic)

// Inside checkout.session.completed handler:
if (event.type === 'checkout.session.completed') {
  const session = event.data.object;
  const { userId, affiliateCodeId, affiliateProfileId } = session.metadata || {};

  // Create subscription (existing logic)
  // ...

  // Handle affiliate commission if code was used
  if (affiliateCodeId && affiliateProfileId) {
    const COMMISSION_AMOUNT = 5.00;

    // Create commission record
    await prisma.commission.create({
      data: {
        affiliateProfileId,
        affiliateCodeId,
        userId,
        amount: COMMISSION_AMOUNT,
        status: 'PENDING',
        earnedAt: new Date(),
      },
    });

    // Mark code as USED
    await prisma.affiliateCode.update({
      where: { code: affiliateCodeId },
      data: {
        status: 'USED',
        usedAt: new Date(),
        usedBy: userId,
      },
    });

    // Update affiliate profile stats
    await prisma.affiliateProfile.update({
      where: { id: affiliateProfileId },
      data: {
        totalEarnings: { increment: COMMISSION_AMOUNT },
        codesUsed: { increment: 1 },
      },
    });

    // Send notification email to affiliate
    const profile = await prisma.affiliateProfile.findUnique({
      where: { id: affiliateProfileId },
      include: { user: true },
    });

    if (profile) {
      // await sendCodeUsedEmail(profile.user.email, affiliateCodeId, COMMISSION_AMOUNT);
    }
  }
}
```

### **6. TypeScript Compliance (CRITICAL)**
- NO `any` types allowed
- All function parameters typed
- All return types specified
- Use Prisma-generated types
- Use proper React types

---

## TESTING REQUIREMENTS

After building all 32 files:

### **1. Start Development Server**
```bash
npm run dev
# Should start on http://localhost:3000
```

### **2. Manual Testing Checklist**

**Registration Flow:**
- [ ] Login as regular user via /login
- [ ] Navigate to /affiliate/register
- [ ] Fill out registration form
- [ ] Submit creates AffiliateProfile with PENDING_VERIFICATION
- [ ] User.isAffiliate is now true

**Verification Flow:**
- [ ] Visit /affiliate/verify?token=xxx
- [ ] Profile status changes to ACTIVE
- [ ] 15 codes distributed automatically
- [ ] Welcome email sent

**Dashboard:**
- [ ] /affiliate/dashboard loads
- [ ] Stats cards display correct data
- [ ] Recent activity table shows
- [ ] Quick actions work

**Reports:**
- [ ] Code inventory report reconciles (opening + additions - reductions = closing)
- [ ] Commission report reconciles
- [ ] Period selector works

**Checkout Integration:**
- [ ] POST /api/checkout/validate-code works
- [ ] Code validation in checkout
- [ ] Discount applied correctly
- [ ] Commission created via webhook

### **3. API Testing**
```bash
# Register as affiliate (authenticated)
curl -X POST http://localhost:3000/api/affiliate/auth/register \
  -H "Content-Type: application/json" \
  -d '{"fullName":"John Doe","country":"US","paymentMethod":"PAYPAL","paymentDetails":{"email":"john@example.com"},"terms":true}'

# Get dashboard stats
curl http://localhost:3000/api/affiliate/dashboard/stats

# Get codes list
curl "http://localhost:3000/api/affiliate/dashboard/codes?status=ACTIVE"

# Validate code
curl -X POST http://localhost:3000/api/checkout/validate-code \
  -H "Content-Type: application/json" \
  -d '{"code":"AF7K9M2P"}'
```

### **4. TypeScript Build**
```bash
npm run build
# Should complete with 0 errors
```

---

## CODING PATTERNS TO FOLLOW

### **Pattern 1: requireAffiliate Helper Usage**
```typescript
// Always use requireAffiliate() for affiliate-only routes
import { requireAffiliate } from '@/lib/auth/session';

export async function GET(): Promise<NextResponse> {
  try {
    const session = await requireAffiliate(); // Throws 403 if not affiliate

    // Use session.user.id to get affiliate profile
    const profile = await prisma.affiliateProfile.findUnique({
      where: { userId: session.user.id },
    });

    // ... rest of handler
  } catch (error) {
    // Handle error
  }
}
```

### **Pattern 2: Accounting Report Structure**
```typescript
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

// Reconciliation: closingBalance = openingBalance + additions.total - reductions.total
```

### **Pattern 3: Affiliate Layout**
```typescript
// app/affiliate/layout.tsx
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth-options';

interface AffiliateLayoutProps {
  children: React.ReactNode;
}

export default async function AffiliateLayout({ children }: AffiliateLayoutProps) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/login?callbackUrl=/affiliate/dashboard');
  }

  if (!session.user.isAffiliate) {
    redirect('/affiliate/register');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar navigation */}
      <aside className="w-64 bg-white border-r">
        {/* Navigation links */}
      </aside>

      <main className="ml-64 p-6">
        {children}
      </main>
    </div>
  );
}
```

---

## CRITICAL RULES

### **DO:**
- Read ALL policy files before writing code
- Use unified authentication (NextAuth session)
- Use `requireAffiliate()` helper for all affiliate routes
- Generate codes with crypto.randomBytes (NOT Math.random)
- Create commissions ONLY via Stripe webhook
- Reference seed code for UI patterns
- Validate after each file
- Commit each file individually

### **DON'T:**
- Create separate JWT system for affiliates
- Create separate login page for affiliates
- Allow manual commission creation via API
- Use Math.random for code generation
- Skip ownership checks
- Use `any` types
- Commit multiple files at once
- Push without validation passing

---

## SUCCESS CRITERIA

Part 17A is complete when:

- All 32 files created and committed
- All TypeScript validations pass (0 errors)
- All ESLint checks pass
- Unified auth works (single NextAuth session)
- Affiliate registration flow works
- Email verification activates affiliate and distributes codes
- Dashboard displays correct stats
- Accounting reports reconcile correctly
- Code validation at checkout works
- Commission creation via webhook works
- Code pushed to feature branch
- PR created (ready for review)

---

## PROGRESS TRACKING

Use the TodoWrite tool to track your progress:

```
1. Read all policy and architecture files
2. Read seed code for dashboard and registration
3. Build Phase A files (1-10): Foundation
4. Build Phase B files (11-21): Backend APIs
5. Build Phase D files (22-32): Frontend
6. Run full validation suite
7. Test registration flow
8. Test dashboard and reports
9. Test checkout integration
10. Push to feature branch
11. Create pull request
```

---

## START HERE

1. **First, read these files in order:**
   - `PROGRESS-part-2.md` - Understand current state
   - `docs/policies/00-tier-specifications.md` - Learn tier system
   - `docs/policies/05-coding-patterns-part-1.md` - Learn code patterns
   - `docs/policies/05-coding-patterns-part-2.md` - More code patterns
   - `docs/build-orders/part-17a-affiliate-portal.md` - Understand Part 17A
   - `docs/implementation-guides/v5_part_q.md` - Affiliate business logic (CRITICAL)
   - Seed code files for UI patterns

2. **Then, create your git branch:**
   ```bash
   git checkout main
   git pull origin main
   git checkout -b claude/affiliate-portal-{SESSION_ID}
   ```

3. **Start building File 1/32:**
   - Verify Prisma schema has affiliate models
   - Validate: `npm run validate`
   - Commit: `git commit -m "chore(affiliate): verify schema for unified auth"`

4. **Repeat for Files 2-32**

5. **After all files complete:**
   - Run final validation
   - Test manually
   - Push to remote
   - Create PR

---

## WHEN TO ASK FOR HELP

Escalate to the user if:

- Critical security issues found
- Ambiguous requirements
- Missing dependencies
- Prisma schema missing affiliate models
- NextAuth session not including isAffiliate
- Stripe webhook configuration questions
- Commission calculation questions

Otherwise, work autonomously following the policies!

---

**Good luck! Build Part 17A with quality and precision. The user trusts you to follow all policies and deliver production-ready code.**
