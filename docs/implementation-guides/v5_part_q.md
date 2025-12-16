# V5 Part Q: Affiliate Marketing Platform - Implementation Guide

**For:** Trading Alerts SaaS V7
**Part:** 17 - Affiliate Marketing Platform (2-Sided Marketplace)
**Total Files:** 67 files
**Complexity:** High
**Last Updated:** 2025-11-21

---

## Overview

This guide provides the business logic and requirements for implementing a complete 2-sided marketplace for affiliate-driven growth with self-service portal, automated code distribution, commission tracking, accounting-style reports, and admin BI dashboard.

### Purpose

Enable external affiliates to promote the Trading Alerts SaaS, earn commissions on PRO upgrades, and manage their affiliate business through a dedicated portal. Provide admins with tools to manage affiliates, distribute codes, process commissions, and track performance through BI reports.

### Key Features

- Self-service affiliate registration and onboarding
- Automated monthly discount code distribution (15 codes per affiliate)
- Commission tracking ($5 USD per PRO upgrade)
- Unified authentication system (NextAuth with isAffiliate flag for dual roles)
- Accounting-style reports with opening/closing balances
- Admin BI dashboard with 4 key reports
- Automated processes (code distribution, expiry, notifications)
- Integration with existing Stripe checkout flow

---

## Business Requirements

### 1. Affiliate System Overview

**What is an Affiliate?**

- External partner who promotes Trading Alerts to earn commissions
- Can be existing SaaS user or dedicated affiliate (dual roles supported)
- Receives monthly allocation of discount codes (15 codes)
- Earns $5 USD commission per PRO subscription via their code
- Accesses affiliate portal at /affiliate/\* routes (same login as SaaS users)
- Gets paid monthly when commission balance ≥ $50 USD

**Commission Structure:**

```typescript
const COMMISSION = {
  perUpgrade: 5.0, // $5 per PRO subscription
  minimumPayout: 50.0, // Must have ≥$50 to request payment
  paymentMethods: ['BANK_TRANSFER', 'PAYPAL', 'CRYPTOCURRENCY', 'WISE'],
  paymentFrequency: 'MONTHLY',
};
```

**Code Distribution:**

- New affiliates: 15 codes upon email verification
- Monthly: 15 codes on 1st of each month (00:00 UTC)
- Bonus: Admin can manually distribute additional codes
- Expiry: All codes expire on last day of month (23:59 UTC)

---

### 2. Affiliate Registration & Onboarding

**User Journey - Become an Affiliate:**

1. **Registration (app/affiliate/register/page.tsx)**
   - User visits `/affiliate/register`
   - Form fields:
     - Email (unique)
     - Password (min 8 chars)
     - Full name
     - Country (dropdown)
     - Payment method (BANK_TRANSFER | PAYPAL | CRYPTOCURRENCY | WISE)
     - Payment details (bank account, PayPal email, wallet address, etc.)
     - Terms of Service acceptance (checkbox)
   - Submit → POST `/api/affiliate/auth/register`

2. **Email Verification**
   - System sends verification email with token
   - Affiliate clicks link → GET `/api/affiliate/auth/verify-email?token=xxx`
   - System:
     - Marks affiliate as ACTIVE
     - Distributes 15 initial codes
     - Sends welcome email with codes

3. **First Login**
   - Affiliate visits `/affiliate/login`
   - Logs in with email + password
   - System issues JWT (AFFILIATE_JWT_SECRET, **separate** from user JWT)
   - Redirects to `/affiliate/dashboard`

**Validation Rules:**

- Email must be unique (no existing affiliate or user with same email)
- Password: min 8 chars, at least 1 uppercase, 1 lowercase, 1 number
- Country: must be from allowed list
- Payment details: required based on payment method selected

---

### 3. Affiliate Dashboard

**Dashboard Layout (app/affiliate/dashboard/page.tsx)**

**Quick Stats Cards:**

```typescript
interface DashboardStats {
  totalCodesDistributed: number; // All-time codes received
  activeCodesCount: number; // Current month unused codes
  usedCodesCount: number; // All-time codes used
  totalEarnings: number; // All-time commissions (USD)
  pendingCommissions: number; // Unpaid commissions (USD)
  paidCommissions: number; // Paid commissions (USD)
  currentMonthEarnings: number; // This month's commissions
  conversionRate: number; // usedCodes / totalCodes * 100
}
```

**Recent Activity Table:**

- Last 10 code uses
- Columns: Date | Code | User Email (masked) | Commission | Status

**Action Buttons:**

- View Code Inventory Report
- View Commission Report
- Update Payment Method

---

### 4. Code Inventory Report (Accounting-Style)

**Report Structure (app/affiliate/dashboard/codes/page.tsx)**

```typescript
interface CodeInventoryReport {
  period: { start: Date; end: Date }; // Current month
  openingBalance: number; // Codes at start of month
  additions: {
    monthlyDistribution: number; // 15 codes on 1st
    bonusDistribution: number; // Admin manual distribution
    total: number;
  };
  reductions: {
    used: number; // Codes redeemed by users
    expired: number; // Codes expired end-of-month
    cancelled: number; // Admin cancelled codes
    total: number;
  };
  closingBalance: number; // Current active codes
}
```

**Reconciliation Formula:**

```
closingBalance = openingBalance + additions.total - reductions.total
```

**Drill-Down:**

- Click on any number → see individual transactions
- Example: Click "Used: 3" → shows 3 codes with dates, users, commissions

---

### 5. Commission Report (Accounting-Style)

**Report Structure (app/affiliate/dashboard/commissions/page.tsx)**

```typescript
interface CommissionReport {
  period: { start: Date; end: Date }; // Month selector
  openingBalance: number; // Unpaid balance from previous month
  earned: {
    codes: CodeCommission[]; // Each code that earned commission
    subtotal: number; // Total earned this period
  };
  payments: {
    transactions: Payment[]; // Each payment received
    subtotal: number; // Total paid this period
  };
  closingBalance: number; // Current unpaid balance
}

interface CodeCommission {
  date: Date;
  code: string;
  userEmail: string; // Masked: "u***@example.com"
  amount: number; // $5.00
  status: 'PENDING' | 'PAID';
}

interface Payment {
  date: Date;
  method: string; // "Bank Transfer", "PayPal", etc.
  amount: number; // Payment amount
  reference: string; // Transaction ID
}
```

**Reconciliation Formula:**

```
closingBalance = openingBalance + earned.subtotal - payments.subtotal
```

---

### 6. Affiliate Authentication (Unified System)

**Critical:** Affiliates use the **same NextAuth authentication system** as SaaS users with unified RBAC.

**Unified Auth Approach:**

- Users can be both SaaS users AND affiliates (dual roles)
- Single NextAuth session with `session.user.isAffiliate: boolean` flag
- Affiliate status grants access to affiliate portal routes
- No separate JWT secrets or authentication systems
- Simplified architecture (one auth system for all user types)

**Architecture Overview:**

```
┌─────────────────────────────────────────────────────┐
│     UNIFIED AUTHENTICATION (NextAuth + RBAC)        │
├─────────────────────────────────────────────────────┤
│                                                     │
│  User Types (all share same NextAuth session):     │
│                                                     │
│  1. SaaS User (FREE/PRO)                           │
│     └─ role='USER', tier='FREE'|'PRO', isAffiliate=false│
│                                                     │
│  2. SaaS User + Affiliate (dual role)              │
│     └─ role='USER', tier='FREE'|'PRO', isAffiliate=true │
│     └─ Has AffiliateProfile (1-to-1 via userId)    │
│                                                     │
│  3. Admin (pure admin)                             │
│     └─ role='ADMIN', tier='FREE', isAffiliate=false │
│                                                     │
│  4. Admin + Affiliate                              │
│     └─ role='ADMIN', tier='FREE', isAffiliate=true  │
│     └─ Has AffiliateProfile (1-to-1 via userId)    │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Database Schema (Unified):**

```prisma
model User {
  id               String    @id @default(cuid())
  email            String    @unique
  password         String?   // Nullable (OAuth-only users)
  role             UserRole  @default(USER)  // USER | ADMIN
  tier             UserTier  @default(FREE)  // FREE | PRO

  // Affiliate Support (Unified Auth)
  isAffiliate      Boolean   @default(false)  // Can be BOTH SaaS user AND affiliate

  // Relations
  affiliateProfile AffiliateProfile?  // 1-to-1, nullable (only if isAffiliate=true)
  accounts         Account[]          // OAuth providers
  // ... other relations

  @@index([isAffiliate])
}

model AffiliateProfile {
  id              String          @id @default(cuid())
  userId          String          @unique  // Links to User (NOT separate Affiliate model)
  user            User            @relation(fields: [userId], references: [id], onDelete: Cascade)

  fullName        String
  country         String
  paymentMethod   PaymentMethod
  paymentDetails  Json
  status          AffiliateStatus @default(PENDING_VERIFICATION)

  totalEarnings   Decimal         @default(0)
  paidCommissions Decimal         @default(0)
  codesDistributed Int            @default(0)
  codesUsed       Int             @default(0)

  // Relations
  affiliateCodes  AffiliateCode[]
  commissions     Commission[]

  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt
}

model AffiliateCode {
  code              String          @id
  affiliateProfileId String         // Links to AffiliateProfile (NOT affiliateId)
  affiliateProfile  AffiliateProfile @relation(fields: [affiliateProfileId], references: [id])

  status            CodeStatus      @default(ACTIVE)
  distributedAt     DateTime        @default(now())
  expiresAt         DateTime
  usedAt            DateTime?

  // Relations
  commissions       Commission[]

  @@index([affiliateProfileId])
  @@index([status])
}

model Commission {
  id                String          @id @default(cuid())
  affiliateProfileId String         // Links to AffiliateProfile
  affiliateProfile  AffiliateProfile @relation(fields: [affiliateProfileId], references: [id])

  affiliateCodeId   String
  affiliateCode     AffiliateCode   @relation(fields: [affiliateCodeId], references: [code])

  userId            String          // SaaS user who used the code
  user              User            @relation(fields: [userId], references: [id])

  amount            Decimal         // $5.00 fixed
  status            CommissionStatus @default(PENDING)

  earnedAt          DateTime        @default(now())
  paidAt            DateTime?

  @@index([affiliateProfileId])
  @@index([status])
}
```

**Session Helper Functions (Part 5):**

```typescript
// lib/auth/session.ts

// Helper to check if user is affiliate
export async function isAffiliate(): Promise<boolean> {
  const session = await getSession();
  return session?.user?.isAffiliate ?? false;
}

// Helper to require affiliate status (throws if not affiliate)
export async function requireAffiliate(): Promise<Session> {
  const session = await requireAuth();

  if (!session.user.isAffiliate) {
    throw new AuthError(
      'Affiliate status required to access this resource',
      'FORBIDDEN',
      403
    );
  }

  return session;
}

// Helper to get AffiliateProfile for affiliate users
export async function getAffiliateProfile() {
  const session = await getSession();

  if (!session?.user?.id || !session.user.isAffiliate) {
    return null;
  }

  const { prisma } = await import('@/lib/db/prisma');

  const profile = await prisma.affiliateProfile.findUnique({
    where: { userId: session.user.id },
    include: {
      affiliateCodes: {
        where: { status: 'ACTIVE' },
        take: 10,
        orderBy: { distributedAt: 'desc' },
      },
    },
  });

  return profile;
}
```

**Route Protection (Unified Auth):**

```typescript
// app/api/affiliate/dashboard/stats/route.ts
import { requireAffiliate } from '@/lib/auth/session';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  // Unified auth - uses NextAuth session
  const session = await requireAffiliate(); // Throws 403 if not affiliate

  // Fetch affiliate profile for session.user.id
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

  // Calculate stats from profile data
  const stats = {
    totalCodesDistributed: profile.codesDistributed,
    activeCodesCount: profile.affiliateCodes.filter(
      (c) => c.status === 'ACTIVE'
    ).length,
    usedCodesCount: profile.codesUsed,
    totalEarnings: profile.totalEarnings,
    pendingCommissions: profile.commissions
      .filter((c) => c.status === 'PENDING')
      .reduce((sum, c) => sum + Number(c.amount), 0),
    paidCommissions: profile.paidCommissions,
    currentMonthEarnings: calculateCurrentMonthEarnings(profile.commissions),
    conversionRate: calculateConversionRate(
      profile.codesDistributed,
      profile.codesUsed
    ),
  };

  return NextResponse.json(stats);
}
```

**Affiliate Registration Flow (Unified):**

```
User Flow:
1. User registers as SaaS user via /register (NextAuth)
   → Creates User with isAffiliate=false

2. User logs in via /login (NextAuth)
   → Session includes: { user: { id, role='USER', tier='FREE', isAffiliate=false } }

3. User navigates to /affiliate/register (while authenticated)
   → Fills form: fullName, country, paymentMethod, paymentDetails

4. Submit to POST /api/affiliate/auth/register
   → Checks: session.user.isAffiliate === false (not already affiliate)
   → Sets: User.isAffiliate = true
   → Creates: AffiliateProfile with PENDING_VERIFICATION status
   → Sends: Email verification

5. User clicks verification link
   → Verifies email → Sets AffiliateProfile.status = ACTIVE
   → Distributes 15 initial codes
   → Updates session: { user: { ..., isAffiliate=true } }

6. User can now access /affiliate/* routes
   → requireAffiliate() helper grants access
   → Same session works for both SaaS features AND affiliate portal
```

**Benefits of Unified Approach:**

1. **Single Authentication System**: One login for both SaaS and affiliate access
2. **Dual Roles**: Users can be both SaaS customers AND affiliates
3. **Simpler Architecture**: No separate JWT secrets, auth systems, or login pages
4. **Consistent Sessions**: Single session management across entire application
5. **Easier Maintenance**: One auth system to maintain, debug, and secure
6. **Admin Support**: Admins can also be affiliates if needed (dual role)

**No Separate Files Needed:**

❌ `lib/auth/affiliate-auth.ts` - NOT NEEDED (use Part 5 session helpers)
❌ `app/api/affiliate/auth/login/route.ts` - NOT NEEDED (use /api/auth/signin)
❌ `app/api/affiliate/auth/logout/route.ts` - NOT NEEDED (use /api/auth/signout)
❌ `app/affiliate/login/page.tsx` - NOT NEEDED (use /login)

---

### 7. Code Generation (Crypto-Secure)

**Requirements:**

- Codes must be cryptographically secure (NO Math.random())
- Codes must be unique (check before creation)
- Format: 8-12 alphanumeric characters, uppercase
- Example: `AF7K9M2P`

**Implementation:**

```typescript
// lib/affiliate/code-generator.ts

import crypto from 'crypto';

async function generateUniqueCode(): Promise<string> {
  const maxAttempts = 10;

  for (let i = 0; i < maxAttempts; i++) {
    // Generate 16 random bytes
    const bytes = crypto.randomBytes(6);

    // Convert to base36 (0-9, A-Z) and take first 8 chars
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

// Distribute codes to affiliate
async function distributeCodes(
  affiliateProfileId: string, // Links to AffiliateProfile (NOT affiliateId)
  count: number,
  reason: 'MONTHLY' | 'INITIAL' | 'BONUS'
): Promise<AffiliateCode[]> {
  const codes: AffiliateCode[] = [];

  for (let i = 0; i < count; i++) {
    const code = await generateUniqueCode();

    const affiliateCode = await prisma.affiliateCode.create({
      data: {
        code,
        affiliateProfileId, // Uses unified auth schema
        status: 'ACTIVE',
        distributedAt: new Date(),
        distributionReason: reason,
        expiresAt: getEndOfMonth(), // Last day of month, 23:59:59 UTC
      },
    });

    codes.push(affiliateCode);
  }

  return codes;
}
```

---

### 8. Commission Calculation (Webhook-Only)

**Critical:** Commissions can **ONLY** be created via Stripe webhook. NO manual API creation allowed.

**Why?**

- Prevents fraud (affiliates can't create fake commissions)
- Ensures commissions tied to real payments
- Single source of truth (Stripe)

**Flow:**

1. **User Checkout with Code**

   ```typescript
   // app/api/checkout/create-session/route.ts

   // Validate code
   const affiliateCode = await prisma.affiliateCode.findUnique({
     where: { code },
     include: { affiliateProfile: true }, // Unified auth: includes profile
   });

   if (!affiliateCode || affiliateCode.status !== 'ACTIVE') {
     return NextResponse.json({ error: 'Invalid code' }, { status: 400 });
   }

   if (new Date() > affiliateCode.expiresAt) {
     return NextResponse.json({ error: 'Code expired' }, { status: 400 });
   }

   // Create Stripe checkout session
   const session = await stripe.checkout.sessions.create({
     // ... normal checkout fields
     metadata: {
       userId: user.id,
       tier: 'PRO',
       affiliateCodeId: affiliateCode.id, // ← Store code ID
       affiliateProfileId: affiliateCode.affiliateProfileId, // ← Store affiliate profile ID (unified auth)
     },
     discounts: [
       {
         coupon: '10PERCENTOFF', // $29 → $26.10
       },
     ],
   });
   ```

2. **Stripe Webhook Handler**

   ```typescript
   // app/api/webhooks/stripe/route.ts

   if (event.type === 'checkout.session.completed') {
     const session = event.data.object;
     const { userId, affiliateCodeId, affiliateProfileId } = session.metadata; // Unified auth

     if (affiliateCodeId && affiliateProfileId) {
       // Calculate commission
       const netRevenue = 26.1; // $29 - $2.90 discount
       const commissionAmount = 5.0; // Fixed $5 per upgrade

       // Create commission
       await prisma.commission.create({
         data: {
           affiliateProfileId, // Unified auth: links to AffiliateProfile
           affiliateCodeId,
           userId,
           amount: commissionAmount,
           netRevenue,
           discount: 2.9,
           status: 'PENDING',
           earnedAt: new Date(),
           stripePaymentId: session.payment_intent,
         },
       });

       // Mark code as USED
       await prisma.affiliateCode.update({
         where: { id: affiliateCodeId },
         data: {
           status: 'USED',
           usedAt: new Date(),
           usedBy: userId,
         },
       });

       // Update affiliate profile total earnings
       await prisma.affiliateProfile.update({
         where: { id: affiliateProfileId }, // Unified auth: update profile
         data: {
           totalEarnings: { increment: commissionAmount },
           codesUsed: { increment: 1 },
         },
       });

       // Get user email for notification (unified auth: profile.user.email)
       const affiliateProfile = await prisma.affiliateProfile.findUnique({
         where: { id: affiliateProfileId },
         include: { user: true }, // Get user for email
       });

       // Send notification email
       await sendEmail({
         to: affiliateProfile.user.email, // Unified auth: user email
         template: 'code-used',
         data: { code, commission: commissionAmount },
       });
     }
   }
   ```

---

### 9. Admin Portal - Affiliate Management

**Admin Authentication (Unified System):**

Admins use the **same NextAuth authentication system** as SaaS users and affiliates, with role-based access control (RBAC).

**Admin Accounts:**

- **2 fixed admin accounts** (pre-seeded via Prisma seed)
  - Admin 1: Pure admin (`role='ADMIN'`, `isAffiliate=false`, `tier='FREE'`)
    - Email: `admin@tradingalerts.com`
    - Password: Set via seed script (bcrypt hashed)
  - Admin 2: Admin + Affiliate (`role='ADMIN'`, `isAffiliate=true`, `tier='FREE'`)
    - Email: `admin-affiliate@tradingalerts.com`
    - Password: Set via seed script (bcrypt hashed)
    - Has `AffiliateProfile` with ACTIVE status

**Admin Login:**

- Dedicated admin login page: `/admin/login`
- Credentials only (no Google OAuth for security)
- Post-login verification: checks `session.user.role === 'ADMIN'`
- Redirects to `/admin/dashboard` after successful login
- Non-admin users see error: "Admin credentials required"

**Admin Access Control:**

```typescript
// lib/auth/session.ts (Part 5)
export async function requireAdmin(): Promise<Session> {
  const session = await requireAuth();

  if (session.user.role !== 'ADMIN') {
    throw new AuthError('Admin access required', 'FORBIDDEN', 403);
  }

  return session;
}

// app/api/admin/affiliates/route.ts
import { requireAdmin } from '@/lib/auth/session';

export async function GET(req: NextRequest) {
  const session = await requireAdmin(); // Throws 403 if not admin

  // Admin API logic...
}
```

**Admin Features:**

#### 9.1 Affiliate List (app/admin/affiliates/page.tsx)

**Filters:**

- Status: ACTIVE | SUSPENDED | PENDING_VERIFICATION
- Country
- Payment method
- Date registered

**Columns:**

- Name | Email | Country | Codes (Active/Total) | Earnings (Pending/Total) | Status | Actions

**Actions:**

- View details
- Distribute codes (bonus)
- Suspend account
- Delete affiliate

#### 9.2 Affiliate Details (app/admin/affiliates/[id]/page.tsx)

**Overview Card:**

- Name, email, country, payment method
- Registration date, verification date
- Status badge

**Performance Metrics:**

- Total codes distributed
- Codes used (with conversion rate)
- Total earnings, pending commissions, paid commissions
- Last code use date

**Recent Activity:**

- Code uses (last 20)
- Commission payments (last 10)
- Code distributions (all)

**Actions:**

- Distribute bonus codes (modal)
- Suspend account (modal with reason)
- Process commission payment (if balance ≥ $50)
- Edit payment details

#### 9.3 Manual Code Distribution

**Use Cases:**

- Bonus codes for high-performing affiliates
- Make up for technical issues
- Special promotions

**Modal:**

```typescript
interface DistributeCodesModal {
  affiliateId: string;
  affiliateName: string;
  count: number; // Input 1-50
  reason: string; // Textarea
  expiresAt: Date; // Date picker (default: end of month)
}
```

**API:** `POST /api/admin/affiliates/[id]/distribute-codes`

#### 9.4 Account Suspension

**Reasons:**

- Fraud detection
- Terms of service violation
- Spam/abuse

**Effects:**

- Affiliate can't login
- All ACTIVE codes become SUSPENDED
- No new codes distributed
- Can be reversed by admin

---

### 10. Admin BI Reports

#### 10.1 Profit & Loss Report (app/admin/affiliates/reports/profit-loss/page.tsx)

**Time Range:** Last 3 months (default), custom date range

```typescript
interface ProfitLossReport {
  period: { start: Date; end: Date };
  revenue: {
    grossRevenue: number; // All PRO subscriptions ($29 each)
    discounts: number; // Total discounts given via codes
    netRevenue: number; // Gross - Discounts
  };
  costs: {
    commissionsPaid: number; // Commissions paid to affiliates
    commissionsPending: number; // Unpaid commissions
    totalCommissions: number; // Paid + Pending
  };
  profit: {
    beforeCommissions: number; // Net revenue
    afterCommissions: number; // Net revenue - Total commissions
    margin: number; // (After / Net) * 100
  };
}
```

**Chart:** Line chart showing monthly profit trend

#### 10.2 Sales Performance Report (app/admin/affiliates/reports/sales-performance/page.tsx)

**Time Range:** Current month (default), custom

**Table:**

```typescript
interface AffiliateSalesRow {
  rank: number;
  affiliateName: string;
  affiliateEmail: string;
  codesUsed: number;
  commissionsEarned: number;
  conversionRate: number; // (Used / Distributed) * 100
  averageOrderValue: number; // Net revenue per code used
}
```

**Sorted by:** Codes used (descending)

**Filters:**

- Country
- Payment method
- Min codes used

#### 10.3 Commission Owings Report (app/admin/affiliates/reports/commission-owings/page.tsx)

**Purpose:** Track unpaid commissions for payment processing

**Table:**

```typescript
interface CommissionOwingRow {
  affiliateId: string;
  affiliateName: string;
  affiliateEmail: string;
  paymentMethod: string;
  paymentDetails: string; // Bank account, PayPal, etc.
  pendingCommissions: number; // Total unpaid amount
  oldestUnpaidDate: Date; // Earliest unpaid commission
  paymentEligible: boolean; // pendingCommissions >= $50
}
```

**Filters:**

- Payment eligible only
- Payment method
- Country

**Bulk Actions:**

- Select affiliates
- Mark selected as paid (with payment reference)

#### 10.4 Code Inventory Report (app/admin/affiliates/reports/code-inventory/page.tsx)

**Purpose:** System-wide code distribution overview

**Aggregate Stats:**

```typescript
interface SystemCodeInventory {
  totalAffiliates: number;
  activeAffiliates: number;
  currentMonth: {
    totalCodesDistributed: number; // All affiliates
    activeCodesCount: number; // Unused
    usedCodesCount: number; // Redeemed
    expiredCodesCount: number; // Expired
    conversionRate: number; // (Used / Distributed) * 100
  };
  allTime: {
    totalCodesDistributed: number;
    usedCodesCount: number;
    conversionRate: number;
  };
}
```

**Chart:** Stacked bar chart showing monthly distribution, usage, expiry

---

### 11. Automated Processes (Cron Jobs)

#### 11.1 Monthly Code Distribution

**Schedule:** 1st of every month, 00:00 UTC

**File:** `app/api/cron/distribute-codes/route.ts`

**Process:**

```typescript
async function monthlyDistribution() {
  // Get all ACTIVE affiliates
  const affiliates = await prisma.affiliate.findMany({
    where: { status: 'ACTIVE' },
  });

  for (const affiliate of affiliates) {
    // Distribute 15 codes
    await distributeCodes(affiliate.id, 15, 'MONTHLY');

    // Send email notification
    await sendEmail({
      to: affiliate.email,
      template: 'code-distributed',
      data: {
        count: 15,
        month: currentMonth,
        expiryDate: endOfMonth,
      },
    });
  }

  console.log(`Distributed codes to ${affiliates.length} affiliates`);
}
```

**Vercel Cron Config:**

```json
{
  "path": "/api/cron/distribute-codes",
  "schedule": "0 0 1 * *"
}
```

#### 11.2 Monthly Code Expiry

**Schedule:** Last day of month, 23:59 UTC

**File:** `app/api/cron/expire-codes/route.ts`

**Process:**

```typescript
async function monthlyExpiry() {
  // Get all ACTIVE codes expiring today
  const today = new Date();

  const expiredCodes = await prisma.affiliateCode.updateMany({
    where: {
      status: 'ACTIVE',
      expiresAt: { lte: today },
    },
    data: {
      status: 'EXPIRED',
    },
  });

  console.log(`Expired ${expiredCodes.count} codes`);
}
```

**Vercel Cron Config:**

```json
{
  "path": "/api/cron/expire-codes",
  "schedule": "59 23 28-31 * *"
}
```

**Note:** Schedule runs on days 28-31 to catch last day of any month

#### 11.3 Monthly Report Emails

**Schedule:** 1st of every month, 06:00 UTC (after code distribution)

**File:** `app/api/cron/send-monthly-reports/route.ts`

**Process:**

```typescript
async function sendMonthlyReports() {
  const lastMonth = getPreviousMonth();

  const affiliates = await prisma.affiliate.findMany({
    where: { status: 'ACTIVE' },
    include: {
      codes: {
        where: {
          distributedAt: {
            gte: lastMonth.start,
            lte: lastMonth.end,
          },
        },
      },
      commissions: {
        where: {
          earnedAt: {
            gte: lastMonth.start,
            lte: lastMonth.end,
          },
        },
      },
    },
  });

  for (const affiliate of affiliates) {
    const report = generateMonthlyReport(affiliate, lastMonth);

    await sendEmail({
      to: affiliate.email,
      template: 'monthly-report',
      data: report,
    });
  }
}
```

---

### 12. Email Notifications

**8 Email Templates:**

1. **Welcome Email** (after email verification)
   - Congratulations on becoming an affiliate
   - 15 initial codes distributed
   - Link to dashboard
   - Getting started tips

2. **Code Distributed** (monthly, on 1st)
   - 15 new codes for this month
   - Expiry date (last day of month)
   - Current balance
   - Link to code inventory

3. **Code Used** (when user redeems code)
   - Code redeemed: [CODE]
   - Commission earned: $5.00
   - Current balance
   - Link to dashboard

4. **Payment Processed** (when admin pays commission)
   - Payment details
   - Amount paid
   - New balance
   - Transaction reference

5. **Monthly Report** (1st of month)
   - Last month performance summary
   - Codes distributed, used, expired
   - Commissions earned
   - Current balance

6. **Payment Eligible** (when balance ≥ $50)
   - You're eligible for payment
   - Current balance: $XX.XX
   - How to request payment
   - Payment processing timeline

7. **Account Suspended** (admin action)
   - Account suspended
   - Reason
   - Contact admin for appeal

8. **Account Reactivated** (admin action)
   - Account reactivated
   - Codes redistributed
   - Welcome back message

---

### 13. Database Schema

```prisma
// Affiliate model
model Affiliate {
  id                   String   @id @default(cuid())
  email                String   @unique
  password             String
  fullName             String
  country              String

  // Payment preferences
  paymentMethod        PaymentMethod
  paymentDetails       Json                  // Bank account, PayPal email, etc.

  // Status
  status               AffiliateStatus       @default(PENDING_VERIFICATION)
  emailVerified        DateTime?
  emailVerificationToken String?

  // Stats (denormalized for performance)
  totalCodesDistributed Int                  @default(0)
  codesUsed            Int                    @default(0)
  totalEarnings        Decimal               @default(0)
  pendingCommissions   Decimal               @default(0)
  paidCommissions      Decimal               @default(0)

  // Relationships
  codes                AffiliateCode[]
  commissions          Commission[]

  // Timestamps
  createdAt            DateTime              @default(now())
  updatedAt            DateTime              @updatedAt
  lastLoginAt          DateTime?

  @@index([email])
  @@index([status])
  @@index([country])
}

// Affiliate code model
model AffiliateCode {
  id                   String   @id @default(cuid())
  code                 String   @unique                // e.g., "AF7K9M2P"

  // Ownership
  affiliateId          String
  affiliate            Affiliate @relation(fields: [affiliateId], references: [id], onDelete: Cascade)

  // Status
  status               CodeStatus            @default(ACTIVE)
  distributedAt        DateTime
  distributionReason   DistributionReason    // MONTHLY | INITIAL | BONUS
  expiresAt            DateTime

  // Usage
  usedAt               DateTime?
  usedBy               String?               // userId who redeemed
  user                 User?                 @relation(fields: [usedBy], references: [id])

  // Relationships
  commissions          Commission[]

  @@index([affiliateId])
  @@index([code])
  @@index([status])
  @@index([expiresAt])
}

// Commission model
model Commission {
  id                   String   @id @default(cuid())

  // Ownership
  affiliateId          String
  affiliate            Affiliate @relation(fields: [affiliateId], references: [id])

  affiliateCodeId      String
  affiliateCode        AffiliateCode @relation(fields: [affiliateCodeId], references: [id])

  userId               String                // User who upgraded
  user                 User     @relation(fields: [userId], references: [id])

  // Amounts
  amount               Decimal               // Commission amount ($5)
  netRevenue           Decimal               // Net revenue from subscription
  discount             Decimal               // Discount given via code

  // Status
  status               CommissionStatus      @default(PENDING)
  earnedAt             DateTime              @default(now())
  paidAt               DateTime?
  paymentReference     String?               // Transaction ID when paid

  // Stripe reference
  stripePaymentId      String?

  @@index([affiliateId])
  @@index([status])
  @@index([earnedAt])
}

// Enums
enum AffiliateStatus {
  PENDING_VERIFICATION
  ACTIVE
  SUSPENDED
  DELETED
}

enum CodeStatus {
  ACTIVE
  USED
  EXPIRED
  SUSPENDED
  CANCELLED
}

enum DistributionReason {
  INITIAL
  MONTHLY
  BONUS
}

enum PaymentMethod {
  BANK_TRANSFER
  PAYPAL
  CRYPTOCURRENCY
  WISE
}

enum CommissionStatus {
  PENDING
  PAID
  REVERSED
}
```

**Database Relationships:**

- Affiliate → AffiliateCode (1:many)
- Affiliate → Commission (1:many)
- AffiliateCode → Commission (1:many)
- User → AffiliateCode (1:many, via usedBy)
- User → Commission (1:many)

**Subscription Model Update:**

```prisma
model Subscription {
  // ... existing fields ...

  // NEW: Affiliate tracking
  affiliateCodeId      String?
  affiliateCode        AffiliateCode? @relation(fields: [affiliateCodeId], references: [id])
}
```

---

### 14. API Endpoints Summary

**Affiliate Portal (11 endpoints):**

- `POST /api/affiliate/auth/register` - Register new affiliate
- `POST /api/affiliate/auth/verify-email` - Verify email, activate account
- `POST /api/affiliate/auth/login` - Login (returns JWT)
- `POST /api/affiliate/auth/logout` - Logout (invalidate token)
- `GET /api/affiliate/dashboard/stats` - Dashboard quick stats
- `GET /api/affiliate/dashboard/codes` - List codes (paginated)
- `GET /api/affiliate/dashboard/code-inventory` - Code inventory report
- `GET /api/affiliate/dashboard/commission-report` - Commission report
- `GET /api/affiliate/profile` - Get profile
- `PATCH /api/affiliate/profile` - Update profile
- `PUT /api/affiliate/profile/payment` - Update payment method

**Admin Portal (14 endpoints):**

- `GET /api/admin/affiliates` - List all affiliates (paginated, filtered)
- `POST /api/admin/affiliates` - Manually create affiliate
- `GET /api/admin/affiliates/[id]` - Get affiliate details
- `PATCH /api/admin/affiliates/[id]` - Update affiliate
- `DELETE /api/admin/affiliates/[id]` - Delete affiliate
- `POST /api/admin/affiliates/[id]/distribute-codes` - Distribute bonus codes
- `POST /api/admin/affiliates/[id]/suspend` - Suspend account
- `GET /api/admin/affiliates/reports/profit-loss` - P&L report
- `GET /api/admin/affiliates/reports/sales-performance` - Sales performance
- `GET /api/admin/affiliates/reports/commission-owings` - Commission owings
- `GET /api/admin/affiliates/reports/code-inventory` - System code inventory
- `POST /api/admin/codes/[id]/cancel` - Cancel specific code
- `POST /api/admin/commissions/pay` - Mark commission as paid
- `POST /api/admin/commissions/bulk-pay` - Mark multiple as paid

**User Integration (2 endpoints - MODIFIED):**

- `POST /api/checkout/validate-code` - NEW: Validate affiliate code before checkout
- `POST /api/checkout/create-session` - MODIFIED: Accept affiliateCode parameter
- `POST /api/webhooks/stripe` - MODIFIED: Create commission on checkout.session.completed

**Cron Jobs (3 endpoints):**

- `POST /api/cron/distribute-codes` - Monthly distribution (1st, 00:00 UTC)
- `POST /api/cron/expire-codes` - Monthly expiry (last day, 23:59 UTC)
- `POST /api/cron/send-monthly-reports` - Monthly emails (1st, 06:00 UTC)

---

### 15. Security Considerations

**Critical Security Rules:**

1. **Separate Authentication**
   - Affiliates use AFFILIATE_JWT_SECRET (different from JWT_SECRET)
   - JWT includes `type: 'AFFILIATE'` discriminator
   - No shared sessions between affiliates and users

2. **Commission Creation**
   - ONLY via Stripe webhook
   - NO manual API endpoint to create commissions
   - Prevents affiliate fraud

3. **Code Validation**
   - Check status (ACTIVE only)
   - Check expiry date
   - Check not already used
   - Mark as USED immediately after successful payment

4. **Payment Details Encryption**
   - Store payment details in JSON field
   - Consider encryption at rest for sensitive data (bank accounts)
   - Never expose full bank account numbers in API responses

5. **Admin Actions**
   - Require admin authentication for all admin endpoints
   - Log all admin actions (code distribution, suspension, payment processing)
   - Rate limiting on sensitive endpoints

6. **Email Verification**
   - Required before code distribution
   - Token expires after 24 hours
   - One-time use tokens

---

### 16. Testing Checklist

**Affiliate Portal:**

- [ ] Registration creates affiliate with PENDING_VERIFICATION status
- [ ] Email verification activates affiliate and distributes 15 codes
- [ ] Login returns JWT with correct structure
- [ ] Dashboard displays correct stats
- [ ] Code inventory report reconciles correctly
- [ ] Commission report reconciles correctly
- [ ] Payment method update works
- [ ] Suspended affiliate can't login

**Code Usage Flow:**

- [ ] User can apply affiliate code at checkout
- [ ] Invalid/expired/used code is rejected
- [ ] Stripe checkout includes code in metadata
- [ ] Webhook creates commission correctly
- [ ] Code marked as USED after successful payment
- [ ] Affiliate earnings updated correctly
- [ ] Notification emails sent

**Admin Portal:**

- [ ] Affiliate list displays with correct filters
- [ ] Affiliate details show accurate stats
- [ ] Manual code distribution works
- [ ] Account suspension works (affiliate can't login, codes suspended)
- [ ] All 4 BI reports display correct data
- [ ] Bulk commission payment works

**Cron Jobs:**

- [ ] Monthly distribution runs on 1st of month
- [ ] 15 codes distributed to all ACTIVE affiliates
- [ ] Code expiry runs on last day of month
- [ ] ACTIVE codes become EXPIRED
- [ ] Monthly report emails sent

**Security:**

- [ ] User JWT rejected by affiliate routes
- [ ] Affiliate JWT rejected by user routes
- [ ] Can't create commission via API (only webhook)
- [ ] Suspended affiliate can't login
- [ ] Deleted affiliate codes become SUSPENDED

---

### 17. Success Criteria

- ✅ All 67 files created and functional
- ✅ Affiliate registration and onboarding works end-to-end
- ✅ Separate authentication system works (no cross-contamination)
- ✅ Code distribution (initial + monthly) works automatically
- ✅ Commission creation via webhook works correctly
- ✅ Accounting reports reconcile (opening + earned - paid = closing)
- ✅ Admin portal displays all 4 BI reports
- ✅ All 3 cron jobs run successfully
- ✅ All 8 email notifications sent correctly
- ✅ Security rules enforced (no manual commission creation, separate JWT, etc.)

---

### 18. Integration with Existing System

**Modified Files:**

1. **prisma/schema.prisma**
   - Add Affiliate, AffiliateCode, Commission models
   - Add enums (AffiliateStatus, CodeStatus, etc.)
   - Add affiliateCodeId to Subscription model

2. **app/api/checkout/create-session/route.ts**
   - Add affiliateCode parameter validation
   - Include affiliateCodeId and affiliateId in Stripe metadata
   - Apply discount when code valid

3. **app/api/webhooks/stripe/route.ts**
   - Add commission creation logic in checkout.session.completed handler
   - Mark code as USED
   - Update affiliate earnings
   - Send notification email

4. **vercel.json**
   - Add 3 cron job configurations

**No Breaking Changes:**

- Existing user flows unaffected
- Checkout works without affiliate code (optional)
- No changes to existing API contracts

---

**End of Implementation Guide**
