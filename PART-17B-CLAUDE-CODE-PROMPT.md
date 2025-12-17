# Part 17B: Affiliate Marketing Platform - Admin & Automation - Claude Code Build Prompt

**Project:** Trading Alerts SaaS V7
**Task:** Build Part 17B (Admin Portal & Automation - Phases E-H) autonomously
**Files to Build:** 35 files
**Estimated Time:** 8 hours
**Current Status:** Parts 6-16 complete, Part 17A must be completed first

---

## ⚠️ CRITICAL: DEPENDENCIES ON PART 17A

**Part 17B MUST be built AFTER Part 17A is complete.**

### Required Files from Part 17A (Must Exist):
```
lib/affiliate/code-generator.ts          # Used by admin code distribution
lib/affiliate/commission-calculator.ts   # Used by admin reports
lib/affiliate/report-builder.ts          # Used by admin BI reports
lib/affiliate/validators.ts              # Used by admin validation
lib/affiliate/constants.ts               # Used everywhere
lib/email/templates/affiliate/*.tsx      # Base email templates
app/api/affiliate/dashboard/stats/route.ts  # Stats calculation patterns
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

You are Claude Code, tasked with building **Part 17B: Affiliate Marketing Platform - Admin Portal & Automation** for the Trading Alerts SaaS V7 project. You will build 35 files autonomously following all project policies, architecture rules, and quality standards.

**Your approach:**
1. **VERIFY** Part 17A files exist before starting
2. Read ALL essential files listed below (policies, architecture, requirements)
3. Build files one-by-one in the specified order (grouped by phase)
4. Import and reuse Part 17A functions (code generator, calculators, etc.)
5. Reference seed code for admin pages
6. Validate each file after creation
7. Commit each file individually
8. Test the admin portal after all files are built

---

## ESSENTIAL FILES TO READ FIRST

**CRITICAL:** Read these files in order before writing any code.

### 1. **Project Overview & Current State**
```
PROGRESS-part-2.md                   # Current project status
README.md                            # Project overview
ARCHITECTURE-compress.md             # System architecture (compressed)
IMPLEMENTATION-GUIDE.md              # Implementation best practices
```

### 2. **Policy Files (MUST READ - These are your rules)**
```
docs/policies/00-tier-specifications.md              # FREE vs PRO tier rules
docs/policies/01-approval-policies.md                # When to approve/fix/escalate
docs/policies/02-quality-standards.md                # TypeScript, error handling
docs/policies/03-architecture-rules.md               # File structure, architecture
docs/policies/04-escalation-triggers.md              # When to ask for human help
docs/policies/05-coding-patterns-part-1.md           # Code patterns (Part 1)
docs/policies/05-coding-patterns-part-2.md           # Code patterns (Part 2)
docs/policies/06-aider-instructions.md               # Build workflow (Section 12)
```

### 3. **Part 17B Requirements & Build Order**
```
docs/build-orders/part-17b-admin-automation.md       # Build order for all 35 files
docs/implementation-guides/v5_part_q.md              # Affiliate business logic (CRITICAL)
```

### 4. **Part 17A Files (DEPENDENCIES - Must Read)**
```
lib/affiliate/code-generator.ts          # Import: distributeCodes()
lib/affiliate/commission-calculator.ts   # Import: calculateCommission()
lib/affiliate/report-builder.ts          # Import: buildCodeInventoryReport(), buildCommissionReport()
lib/affiliate/validators.ts              # Import: validateCode()
lib/affiliate/constants.ts               # Import: AFFILIATE_CONFIG, PAYMENT_METHODS
```

### 5. **Seed Code (MUST REFERENCE)**
```
seed-code/v0-components/part-17b-admin-pnl-report/app/admin/affiliates/pnl-report/page.tsx
seed-code/v0-components/part-17b-admin-affiliate-management/app/admin/affiliates/page.tsx
```

### 6. **OpenAPI & Validation**
```
docs/trading_alerts_openapi.yaml         # API contracts
VALIDATION-SETUP-GUIDE.md                # Validation tools
CLAUDE.md                                # Automated validation guide
```

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

### Route Protection Pattern:
```typescript
import { requireAdmin } from '@/lib/auth/session';

export async function GET(): Promise<NextResponse> {
  const session = await requireAdmin(); // Throws 403 if not admin
  // Admin-only logic here
}
```

---

## PART 17B - FILES TO BUILD (In Order, Grouped by Phase)

Build these 35 files in sequence:

### **Phase E: Admin Portal Backend (11 files)**

### **File 1/35:** `app/api/admin/affiliates/route.ts`
- **GET:** List all affiliates (paginated, filtered)
- **POST:** Manually create affiliate
- Query params: status, country, paymentMethod, page, limit
- **Auth:** requireAdmin()
- **Commit:** `feat(api): add admin affiliates list endpoint`

### **File 2/35:** `app/api/admin/affiliates/[id]/route.ts`
- **GET:** Get affiliate details with full stats
- **PATCH:** Update affiliate (status, payment info)
- **DELETE:** Soft delete affiliate
- **Auth:** requireAdmin()
- **Commit:** `feat(api): add admin affiliate detail endpoints`

### **File 3/35:** `app/api/admin/affiliates/[id]/distribute-codes/route.ts`
- **POST:** Distribute bonus codes to affiliate
- Body: `{ count, reason, expiresAt }`
- **DEPENDENCY:** Import `distributeCodes()` from `lib/affiliate/code-generator.ts`
- **Auth:** requireAdmin()
- **Commit:** `feat(api): add admin code distribution endpoint`

### **File 4/35:** `app/api/admin/affiliates/[id]/suspend/route.ts`
- **POST:** Suspend affiliate account
- Body: `{ reason }`
- Action: Set status to SUSPENDED, suspend all ACTIVE codes
- **Auth:** requireAdmin()
- **Commit:** `feat(api): add admin affiliate suspension endpoint`

### **File 5/35:** `app/api/admin/affiliates/[id]/reactivate/route.ts`
- **POST:** Reactivate suspended affiliate
- Action: Set status to ACTIVE, optionally redistribute codes
- **Auth:** requireAdmin()
- **Commit:** `feat(api): add admin affiliate reactivation endpoint`

### **File 6/35:** `app/api/admin/affiliates/reports/profit-loss/route.ts`
- **GET:** Profit & Loss report
- Query params: period (3months/6months/custom), startDate, endDate
- Return: `{ grossRevenue, discounts, netRevenue, commissions, profit, margin }`
- **DEPENDENCY:** Import from `lib/affiliate/commission-calculator.ts`
- **Auth:** requireAdmin()
- **Commit:** `feat(api): add admin P&L report endpoint`

### **File 7/35:** `app/api/admin/affiliates/reports/sales-performance/route.ts`
- **GET:** Sales performance by affiliate
- Query params: period, sortBy
- Return: Ranked list of affiliates with codes used, commissions, conversion rate
- **Auth:** requireAdmin()
- **Commit:** `feat(api): add admin sales performance report endpoint`

### **File 8/35:** `app/api/admin/affiliates/reports/commission-owings/route.ts`
- **GET:** Commission owings (unpaid balances)
- Query params: paymentEligibleOnly, paymentMethod
- Return: Affiliates with pending commissions ≥ threshold
- **Auth:** requireAdmin()
- **Commit:** `feat(api): add admin commission owings report endpoint`

### **File 9/35:** `app/api/admin/affiliates/reports/code-inventory/route.ts`
- **GET:** System-wide code inventory report
- Return: `{ totalAffiliates, totalCodes, activeCodes, usedCodes, expiredCodes, conversionRate }`
- **DEPENDENCY:** Import from `lib/affiliate/report-builder.ts`
- **Auth:** requireAdmin()
- **Commit:** `feat(api): add admin code inventory report endpoint`

### **File 10/35:** `app/api/admin/commissions/pay/route.ts`
- **POST:** Mark commission(s) as paid
- Body: `{ commissionIds, paymentReference, paymentMethod }`
- Action: Update commission status, update affiliate paidCommissions
- **Auth:** requireAdmin()
- **Commit:** `feat(api): add admin commission payment endpoint`

### **File 11/35:** `app/api/admin/codes/[code]/cancel/route.ts`
- **POST:** Cancel specific affiliate code
- Body: `{ reason }`
- Action: Set code status to CANCELLED
- **Auth:** requireAdmin()
- **Commit:** `feat(api): add admin code cancellation endpoint`

---

### **Phase F: Admin Portal Frontend (6 files)**

### **File 12/35:** `app/admin/affiliates/page.tsx`
- Affiliate management list page
- Stats cards: Total affiliates, Active this month, Commission payout, Rate
- Filters: status, country, paymentMethod
- Table with actions dropdown
- **Reference:** `seed-code/v0-components/part-17b-admin-affiliate-management/app/admin/affiliates/page.tsx`
- **Commit:** `feat(admin): add affiliate management page`

### **File 13/35:** `app/admin/affiliates/[id]/page.tsx`
- Affiliate detail page
- Overview card (name, email, country, status)
- Performance metrics cards
- Recent activity tables
- Action buttons (distribute codes, suspend, edit)
- **Commit:** `feat(admin): add affiliate detail page`

### **File 14/35:** `app/admin/affiliates/reports/profit-loss/page.tsx`
- P&L report page
- Period selector (3m, 6m, custom)
- Summary cards (gross revenue, discounts, net revenue, costs, profit, margin)
- Accounting-style breakdown table
- Trend chart (line chart: revenue, costs, profit)
- **Reference:** `seed-code/v0-components/part-17b-admin-pnl-report/app/admin/affiliates/pnl-report/page.tsx`
- **Commit:** `feat(admin): add P&L report page`

### **File 15/35:** `app/admin/affiliates/reports/sales-performance/page.tsx`
- Sales performance report page
- Ranked table of affiliates
- Columns: Rank, Name, Codes Used, Commissions, Conversion Rate
- Filters: country, min codes
- **Commit:** `feat(admin): add sales performance report page`

### **File 16/35:** `app/admin/affiliates/reports/commission-owings/page.tsx`
- Commission owings report page
- Table of affiliates with pending balances
- Columns: Name, Payment Method, Pending Amount, Oldest Unpaid, Eligible
- Bulk action: Mark selected as paid
- **Commit:** `feat(admin): add commission owings report page`

### **File 17/35:** `app/admin/affiliates/reports/code-inventory/page.tsx`
- System code inventory report page
- Aggregate stats cards
- Stacked bar chart (monthly: distributed, used, expired)
- **Commit:** `feat(admin): add code inventory report page`

---

### **Phase G: Cron Jobs (4 files)**

### **File 18/35:** `app/api/cron/distribute-codes/route.ts`
- **POST:** Monthly code distribution (runs 1st of month, 00:00 UTC)
- Vercel cron: `schedule: "0 0 1 * *"`
- Action: Distribute 15 codes to all ACTIVE affiliates
- **DEPENDENCY:** Import `distributeCodes()` from `lib/affiliate/code-generator.ts`
- Send notification email to each affiliate
- **Commit:** `feat(cron): add monthly code distribution job`

### **File 19/35:** `app/api/cron/expire-codes/route.ts`
- **POST:** Monthly code expiry (runs last day of month, 23:59 UTC)
- Vercel cron: `schedule: "59 23 28-31 * *"`
- Action: Update ACTIVE codes past expiresAt to EXPIRED
- **Commit:** `feat(cron): add monthly code expiry job`

### **File 20/35:** `app/api/cron/send-monthly-reports/route.ts`
- **POST:** Monthly report emails (runs 1st of month, 06:00 UTC)
- Vercel cron: `schedule: "0 6 1 * *"`
- Action: Generate and email monthly report to all ACTIVE affiliates
- **DEPENDENCY:** Import from `lib/affiliate/report-builder.ts`
- **Commit:** `feat(cron): add monthly report email job`

### **File 21/35:** `vercel.json` (UPDATE)
- Add cron job configurations
- 3 cron jobs: distribute-codes, expire-codes, send-monthly-reports
- **Commit:** `feat(cron): configure Vercel cron jobs`

---

### **Phase H: Components (14 files)**

### **File 22/35:** `components/admin/affiliate-stats-banner.tsx`
- Admin stats banner with 4 cards
- Props: `{ totalAffiliates, activeThisMonth, pendingPayout, commissionRate }`
- **Commit:** `feat(components): add admin affiliate stats banner`

### **File 23/35:** `components/admin/affiliate-table.tsx`
- Affiliate list table with pagination
- Props: `{ affiliates, onAction }`
- Columns: Avatar, Name, Email, Country, Codes, Earnings, Status, Actions
- **Commit:** `feat(components): add admin affiliate table`

### **File 24/35:** `components/admin/affiliate-filters.tsx`
- Filter bar component
- Props: `{ filters, onFilterChange, onClear }`
- Search, Status, Country, Payment Method dropdowns
- **Commit:** `feat(components): add admin affiliate filters`

### **File 25/35:** `components/admin/distribute-codes-modal.tsx`
- Modal for distributing bonus codes
- Props: `{ affiliate, open, onOpenChange, onDistribute }`
- Fields: Code count (1-50), Reason, Expiry date
- **Commit:** `feat(components): add distribute codes modal`

### **File 26/35:** `components/admin/suspend-affiliate-modal.tsx`
- Modal for suspending affiliate
- Props: `{ affiliate, open, onOpenChange, onSuspend }`
- Fields: Reason (required textarea)
- Warning about code suspension
- **Commit:** `feat(components): add suspend affiliate modal`

### **File 27/35:** `components/admin/pay-commission-modal.tsx`
- Modal for marking commissions as paid
- Props: `{ commissions, open, onOpenChange, onPay }`
- Fields: Payment reference, Payment method, Amount
- **Commit:** `feat(components): add pay commission modal`

### **File 28/35:** `components/admin/pnl-summary-cards.tsx`
- P&L summary cards (5 cards)
- Props: `{ grossRevenue, discounts, netRevenue, commissions, margin }`
- **Commit:** `feat(components): add P&L summary cards`

### **File 29/35:** `components/admin/pnl-breakdown-table.tsx`
- Accounting-style P&L breakdown table
- Props: `{ data }`
- Sections: Revenue, Discounts, Net Revenue, Costs, Profit
- **Commit:** `feat(components): add P&L breakdown table`

### **File 30/35:** `components/admin/pnl-trend-chart.tsx`
- Line chart for P&L trends
- Props: `{ data }`
- Lines: Revenue (green), Costs (red), Profit (blue)
- Uses recharts
- **Commit:** `feat(components): add P&L trend chart`

### **File 31/35:** `components/admin/sales-performance-table.tsx`
- Ranked sales performance table
- Props: `{ affiliates }`
- Columns: Rank, Name, Email, Codes Used, Commissions, Conversion Rate
- **Commit:** `feat(components): add sales performance table`

### **File 32/35:** `components/admin/commission-owings-table.tsx`
- Commission owings table with bulk selection
- Props: `{ owings, selectedIds, onSelectChange, onPaySelected }`
- Columns: Checkbox, Name, Payment Method, Pending Amount, Eligible
- **Commit:** `feat(components): add commission owings table`

### **File 33/35:** `components/admin/code-inventory-chart.tsx`
- Stacked bar chart for code inventory
- Props: `{ data }`
- Bars: Distributed, Used, Expired (per month)
- Uses recharts
- **Commit:** `feat(components): add code inventory chart`

### **File 34/35:** `lib/email/templates/affiliate/payment-processed.tsx`
- Payment processed email template
- Includes: Amount paid, payment method, reference, new balance
- **Commit:** `feat(email): add payment processed email template`

### **File 35/35:** `lib/email/templates/affiliate/monthly-report.tsx`
- Monthly report email template
- Includes: Performance summary, codes distributed/used/expired, commissions
- **Commit:** `feat(email): add monthly report email template`

---

## GIT WORKFLOW

### **Branch Strategy**
```bash
# Create new branch (MUST start with 'claude/' and end with session ID)
git checkout -b claude/admin-automation-{SESSION_ID}

# Build files one by one, commit each file individually
# After all 35 files complete:
git push -u origin claude/admin-automation-{SESSION_ID}
```

### **Commit Message Format**
```
feat(api): add admin affiliates list endpoint
feat(admin): add affiliate management page
feat(cron): add monthly code distribution job
feat(components): add admin affiliate table
```

---

## VALIDATION REQUIREMENTS

After building each file, run validation:

```bash
npm run validate:types
npm run validate:lint
npm run validate:format
npm run validate
```

---

## KEY REQUIREMENTS FOR PART 17B

### **1. Import Part 17A Dependencies**

```typescript
// CORRECT - Import from Part 17A files
import { distributeCodes, generateUniqueCode } from '@/lib/affiliate/code-generator';
import { calculateCommission } from '@/lib/affiliate/commission-calculator';
import { buildCodeInventoryReport, buildCommissionReport } from '@/lib/affiliate/report-builder';
import { validateCode, isCodeActive, isCodeExpired } from '@/lib/affiliate/validators';
import { AFFILIATE_CONFIG, PAYMENT_METHODS } from '@/lib/affiliate/constants';
```

### **2. Admin List Affiliates API**

```typescript
// app/api/admin/affiliates/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';

const querySchema = z.object({
  status: z.enum(['ACTIVE', 'PENDING_VERIFICATION', 'SUSPENDED', 'DELETED']).optional(),
  country: z.string().optional(),
  paymentMethod: z.enum(['BANK_TRANSFER', 'PAYPAL', 'CRYPTOCURRENCY', 'WISE']).optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(10).max(100).default(20),
});

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await requireAdmin(); // Admin only

    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const { status, country, paymentMethod, page, limit } = querySchema.parse(searchParams);

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
    return NextResponse.json({ error: 'Failed to fetch affiliates' }, { status: 500 });
  }
}
```

### **3. Distribute Codes Admin API**

```typescript
// app/api/admin/affiliates/[id]/distribute-codes/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/session';
import { distributeCodes } from '@/lib/affiliate/code-generator'; // FROM PART 17A
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';

const distributeSchema = z.object({
  count: z.number().min(1).max(50),
  reason: z.string().min(1),
  expiresAt: z.string().datetime().optional(),
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

    // Verify affiliate exists
    const affiliate = await prisma.affiliateProfile.findUnique({
      where: { id: params.id },
    });

    if (!affiliate) {
      return NextResponse.json({ error: 'Affiliate not found' }, { status: 404 });
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
    return NextResponse.json({ error: 'Failed to distribute codes' }, { status: 500 });
  }
}
```

### **4. P&L Report API**

```typescript
// app/api/admin/affiliates/reports/profit-loss/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { AFFILIATE_CONFIG } from '@/lib/affiliate/constants'; // FROM PART 17A

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await requireAdmin();

    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get('period') || '3months';

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    if (period === '3months') startDate.setMonth(startDate.getMonth() - 3);
    else if (period === '6months') startDate.setMonth(startDate.getMonth() - 6);

    // Get commissions in period
    const commissions = await prisma.commission.findMany({
      where: {
        earnedAt: { gte: startDate, lte: endDate },
      },
    });

    const totalSales = commissions.length;
    const regularPrice = 29.0;
    const discountPercent = 10;
    const discountedPrice = regularPrice * (1 - discountPercent / 100);

    const grossRevenue = totalSales * regularPrice;
    const totalDiscounts = totalSales * (regularPrice - discountedPrice);
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

    return NextResponse.json({
      period: { start: startDate, end: endDate },
      revenue: {
        grossRevenue,
        discounts: totalDiscounts,
        netRevenue,
      },
      costs: {
        paidCommissions,
        pendingCommissions,
        totalCommissions,
      },
      profit: {
        netProfit,
        margin: profitMargin,
      },
      totalSales,
    });
  } catch (error) {
    console.error('P&L report error:', error);
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
  }
}
```

### **5. Cron Job - Monthly Distribution**

```typescript
// app/api/cron/distribute-codes/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { distributeCodes } from '@/lib/affiliate/code-generator'; // FROM PART 17A
import { AFFILIATE_CONFIG } from '@/lib/affiliate/constants'; // FROM PART 17A

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Verify cron secret (Vercel sends this header)
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all ACTIVE affiliates
    const affiliates = await prisma.affiliateProfile.findMany({
      where: { status: 'ACTIVE' },
      include: { user: true },
    });

    let distributed = 0;

    for (const affiliate of affiliates) {
      // Use Part 17A function
      await distributeCodes(
        affiliate.id,
        AFFILIATE_CONFIG.CODES_PER_MONTH,
        'MONTHLY'
      );

      // TODO: Send email notification
      // await sendCodeDistributedEmail(affiliate.user.email, AFFILIATE_CONFIG.CODES_PER_MONTH);

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

### **6. Vercel Cron Configuration**

```json
// vercel.json (UPDATE)
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

### **7. TypeScript Compliance (CRITICAL)**
- NO `any` types allowed
- All function parameters typed
- All return types specified
- Use Prisma-generated types
- Import types from Part 17A files

---

## TESTING REQUIREMENTS

After building all 35 files:

### **1. Verify Part 17A Dependencies**
```bash
# Ensure Part 17A files exist and are importable
npm run validate:types
```

### **2. Start Development Server**
```bash
npm run dev
```

### **3. Manual Testing Checklist**

**Admin Authentication:**
- [ ] Login as admin@tradingalerts.com
- [ ] Access /admin/affiliates works
- [ ] Non-admin users get 403

**Affiliate Management:**
- [ ] /admin/affiliates lists all affiliates
- [ ] Filters work (status, country, payment method)
- [ ] Pagination works
- [ ] View affiliate detail page
- [ ] Distribute codes modal works
- [ ] Suspend affiliate works

**BI Reports:**
- [ ] P&L report displays correct data
- [ ] Period selector works
- [ ] Chart renders
- [ ] Sales performance ranked correctly
- [ ] Commission owings shows eligible affiliates
- [ ] Code inventory shows system totals

**Cron Jobs (Manual Test):**
```bash
# Test distribute codes cron (local)
curl -X POST http://localhost:3000/api/cron/distribute-codes \
  -H "Authorization: Bearer test-cron-secret"

# Test expire codes cron
curl -X POST http://localhost:3000/api/cron/expire-codes \
  -H "Authorization: Bearer test-cron-secret"
```

### **4. TypeScript Build**
```bash
npm run build
# Should complete with 0 errors
```

---

## CODING PATTERNS TO FOLLOW

### **Pattern 1: Admin Route Protection**
```typescript
import { requireAdmin } from '@/lib/auth/session';

export async function GET(): Promise<NextResponse> {
  try {
    await requireAdmin(); // ALWAYS first line
    // Admin-only logic
  } catch (error) {
    if (error.code === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
```

### **Pattern 2: Import Part 17A Functions**
```typescript
// ALWAYS import from Part 17A, never duplicate code
import { distributeCodes } from '@/lib/affiliate/code-generator';
import { AFFILIATE_CONFIG } from '@/lib/affiliate/constants';

// Use the imported functions
await distributeCodes(affiliateProfileId, AFFILIATE_CONFIG.CODES_PER_MONTH, 'MONTHLY');
```

### **Pattern 3: Cron Job Authentication**
```typescript
export async function POST(request: NextRequest): Promise<NextResponse> {
  // Verify Vercel cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Cron job logic
}
```

---

## CRITICAL RULES

### **DO:**
- Verify Part 17A files exist before starting
- Import functions from Part 17A (code-generator, etc.)
- Use `requireAdmin()` for all admin routes
- Reference seed code for UI patterns
- Use Vercel cron secret for cron jobs
- Validate after each file
- Commit each file individually

### **DON'T:**
- Start without verifying Part 17A dependencies
- Duplicate Part 17A code (import instead)
- Skip admin authentication
- Use `any` types
- Hard-code commission/discount values (use constants)
- Commit multiple files at once
- Push without validation passing

---

## SUCCESS CRITERIA

Part 17B is complete when:

- All Part 17A dependencies verified
- All 35 files created and committed
- All TypeScript validations pass (0 errors)
- All ESLint checks pass
- Admin routes protected correctly
- Part 17A functions imported and used
- All 4 BI reports work correctly
- Cron jobs configured in vercel.json
- Code pushed to feature branch
- PR created (ready for review)

---

## PROGRESS TRACKING

Use the TodoWrite tool to track progress:

```
1. Verify Part 17A dependencies exist
2. Read all policy and architecture files
3. Read seed code for admin pages
4. Build Phase E files (1-11): Admin Backend
5. Build Phase F files (12-17): Admin Frontend
6. Build Phase G files (18-21): Cron Jobs
7. Build Phase H files (22-35): Components & Templates
8. Run full validation suite
9. Test admin authentication
10. Test affiliate management
11. Test all 4 BI reports
12. Test cron jobs manually
13. Push to feature branch
14. Create pull request
```

---

## START HERE

1. **First, verify Part 17A dependencies:**
   ```bash
   ls -la lib/affiliate/
   # Should see: code-generator.ts, commission-calculator.ts, report-builder.ts, etc.
   ```

2. **If Part 17A files missing, STOP and notify user**

3. **Read these files in order:**
   - `PROGRESS-part-2.md`
   - `docs/policies/00-tier-specifications.md`
   - `docs/policies/05-coding-patterns-part-1.md`
   - `docs/policies/05-coding-patterns-part-2.md`
   - `docs/build-orders/part-17b-admin-automation.md`
   - `docs/implementation-guides/v5_part_q.md`
   - Part 17A files (to understand imports)
   - Seed code files

4. **Create your git branch:**
   ```bash
   git checkout main
   git pull origin main
   git checkout -b claude/admin-automation-{SESSION_ID}
   ```

5. **Start building File 1/35**

---

## WHEN TO ASK FOR HELP

Escalate to the user if:

- Part 17A files don't exist
- Import errors from Part 17A files
- Critical security issues
- Cron job configuration questions
- Vercel deployment questions
- Admin seed account questions

Otherwise, work autonomously following the policies!

---

**Good luck! Build Part 17B with quality and precision. Remember to import from Part 17A rather than duplicating code!**
