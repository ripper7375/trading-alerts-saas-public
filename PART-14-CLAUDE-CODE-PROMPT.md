# Part 14: Admin Dashboard - Claude Code Build Prompt

**Project:** Trading Alerts SaaS V7
**Task:** Build Part 14 (Admin Dashboard) autonomously
**Files to Build:** 9 files
**Estimated Time:** 3 hours
**Current Status:** Parts 6-13 complete and merged to main

---

## YOUR MISSION

You are Claude Code, tasked with building **Part 14: Admin Dashboard** for the Trading Alerts SaaS V7 project. You will build 9 files autonomously following all project policies, architecture rules, and quality standards.

**Your approach:**

1. Read ALL essential files listed below (policies, architecture, requirements)
2. Build files one-by-one in the specified order
3. Follow coding patterns from policy files
4. Validate each file after creation (TypeScript, ESLint, Prettier)
5. Commit each file individually with descriptive commit messages
6. Test the admin dashboard after all files are built

---

## ESSENTIAL FILES TO READ FIRST

**CRITICAL:** Read these files in order before writing any code. These files contain the "AI constitution" that guides all development.

### 1. **Project Overview & Current State**

```
PROGRESS-part-2.md                   # Current project status (Parts 6-13 complete)
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
docs/policies/06-aider-instructions.md               # Build workflow instructions
```

### 3. **Part 14 Requirements & Build Order**

```
docs/build-orders/part-14-admin.md                   # Build order for all 9 files
docs/implementation-guides/v5_part_n.md              # Admin dashboard business logic
```

### 4. **OpenAPI Specifications**

```
docs/trading_alerts_openapi.yaml                     # Next.js API contracts
```

### 5. **Validation & Testing**

```
VALIDATION-SETUP-GUIDE.md                            # Validation tools and process
CLAUDE.md                                            # Automated validation guide
```

### 6. **Previous Work (for context and dependencies)**

```
docs/build-orders/part-05-authentication.md          # Authentication with admin role (DEPENDENCY)
docs/build-orders/part-12-ecommerce.md               # Billing data for revenue metrics (DEPENDENCY)
```

---

## PART 14 - FILES TO BUILD (In Order)

Build these 9 files in sequence:

### **Admin Pages (5 pages)**

### **File 1/9:** `app/(dashboard)/admin/layout.tsx`

- Admin layout with sidebar navigation
- ADMIN role check (403 if not admin)
- Sidebar: Dashboard, Users, Analytics, API Usage, Error Logs
- Top bar with admin badge
- "Back to App" link
- **Commit:** `feat(admin): add admin layout with role check`

### **File 2/9:** `app/(dashboard)/admin/page.tsx`

- Admin dashboard overview
- Metric cards: Total Users, FREE users, PRO users, MRR
- User growth chart (line chart, last 12 months)
- Tier distribution chart (pie chart)
- Recent activity feed
- Quick action buttons
- **Commit:** `feat(admin): add admin dashboard page`

### **File 3/9:** `app/(dashboard)/admin/users/page.tsx`

- User management table
- Columns: Name, Email, Tier, Created, Last Login, Status
- Search by name or email
- Filter by tier (ALL/FREE/PRO)
- Sort by created date, name, tier
- Pagination (50 per page)
- Row actions: View, Change Tier, Suspend
- **Commit:** `feat(admin): add user management page`

### **File 4/9:** `app/(dashboard)/admin/api-usage/page.tsx`

- API usage analytics by tier
- Table: Endpoint, Calls (FREE), Calls (PRO), Avg Response Time, Error Rate
- Usage over time chart (split by tier)
- Alert for endpoints with >5% error rate
- Date range filter
- **Commit:** `feat(admin): add API usage analytics`

### **File 5/9:** `app/(dashboard)/admin/errors/page.tsx`

- Error logs table
- Columns: Timestamp, Error Type, Message, User ID, Tier, Stack Trace
- Filter by error type, tier, date range
- Auto-refresh every 30 seconds
- Export to CSV button
- **Commit:** `feat(admin): add error logs page`

### **API Routes (4 routes)**

### **File 6/9:** `app/api/admin/users/route.ts`

- **GET:** List all users with pagination
- Query params: page, search, tier, sortBy
- Return: users array, total count, pagination info
- Admin role check
- **Commit:** `feat(api): add admin users endpoint`

### **File 7/9:** `app/api/admin/analytics/route.ts`

- **GET:** Analytics data
- Return: tier distribution, revenue metrics, conversion rates, engagement metrics
- Admin role check
- **Commit:** `feat(api): add admin analytics endpoint`

### **File 8/9:** `app/api/admin/api-usage/route.ts`

- **GET:** API usage stats by tier
- Query params: startDate, endDate
- Return: endpoint stats, usage trends
- Admin role check
- **Commit:** `feat(api): add API usage endpoint`

### **File 9/9:** `app/api/admin/error-logs/route.ts`

- **GET:** Error logs with pagination
- Query params: page, type, tier, startDate, endDate
- Return: logs array, total count
- Admin role check
- **Commit:** `feat(api): add error logs endpoint`

---

## GIT WORKFLOW

### **Branch Strategy**

```bash
# Create new branch (MUST start with 'claude/' and end with session ID)
git checkout -b claude/admin-dashboard-{SESSION_ID}

# Build files one by one, commit each file individually
# After all 9 files complete:
git push -u origin claude/admin-dashboard-{SESSION_ID}
```

### **Commit Message Format**

Use conventional commits:

```
feat(admin): add admin layout with role check
feat(admin): add admin dashboard page
feat(api): add admin users endpoint
fix(admin): correct TypeScript type error in analytics
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

### **Validation Must Pass Before Committing**

- 0 TypeScript errors
- 0 ESLint errors (warnings OK if < 3)
- All files properly formatted
- No unused imports
- All functions have return types

---

## KEY REQUIREMENTS FOR PART 14

### **1. Admin Role Check (CRITICAL)**

```typescript
// EVERY admin route must check role
const session = await getServerSession(authOptions);

if (!session) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

if (session.user.role !== 'ADMIN') {
  return NextResponse.json(
    { error: 'Forbidden: Admin access required' },
    { status: 403 }
  );
}
```

### **2. Admin Navigation Structure**

```typescript
const adminTabs = [
  { id: 'dashboard', icon: '📊', label: 'Dashboard', href: '/admin' },
  { id: 'users', icon: '👥', label: 'Users', href: '/admin/users' },
  { id: 'analytics', icon: '📈', label: 'Analytics', href: '/admin/analytics' },
  { id: 'api-usage', icon: '🔌', label: 'API Usage', href: '/admin/api-usage' },
  { id: 'errors', icon: '🚨', label: 'Error Logs', href: '/admin/errors' },
];
```

### **3. Dashboard Metrics**

**Key Metrics to Display:**

```typescript
interface AdminMetrics {
  totalUsers: number;
  freeUsers: number;
  proUsers: number;
  freePercentage: number;
  proPercentage: number;
  mrr: number; // PRO users × $29
  arr: number; // MRR × 12
  conversionRate: number; // (PRO / Total) × 100
  newUsersThisMonth: number;
  churnedThisMonth: number;
}
```

**Revenue Calculation:**

```typescript
const PRO_MONTHLY_PRICE = 29;

function calculateMRR(proUserCount: number): number {
  return proUserCount * PRO_MONTHLY_PRICE;
}

function calculateARR(mrr: number): number {
  return mrr * 12;
}
```

### **4. User Management**

**User List Response:**

```typescript
interface AdminUserListResponse {
  users: AdminUser[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface AdminUser {
  id: string;
  name: string | null;
  email: string;
  tier: 'FREE' | 'PRO';
  role: 'USER' | 'ADMIN';
  status: 'active' | 'suspended';
  createdAt: Date;
  lastLoginAt: Date | null;
  alertCount: number;
  watchlistCount: number;
}
```

### **5. API Usage Tracking**

**Endpoint Stats:**

```typescript
interface EndpointStats {
  endpoint: string;
  method: string;
  callsFree: number;
  callsPro: number;
  avgResponseTime: number; // in ms
  errorRate: number; // percentage
  lastCalled: Date;
}
```

### **6. Error Log Structure**

```typescript
interface ErrorLog {
  id: string;
  timestamp: Date;
  type:
    | 'API_ERROR'
    | 'DATABASE_ERROR'
    | 'AUTH_ERROR'
    | 'PAYMENT_ERROR'
    | 'MT5_ERROR';
  message: string;
  userId: string | null;
  userTier: 'FREE' | 'PRO' | null;
  endpoint: string;
  stackTrace: string | null;
  metadata: Record<string, unknown>;
}
```

### **7. TypeScript Compliance (CRITICAL)**

- NO `any` types allowed
- All function parameters typed
- All return types specified
- Use Prisma-generated types where applicable
- Use proper React types

---

## TESTING REQUIREMENTS

After building all 9 files:

### **1. Start Development Server**

```bash
npm run dev
# Should start on http://localhost:3000
```

### **2. Manual Testing Checklist**

- [ ] Visit `http://localhost:3000/admin` as non-admin user
- [ ] Verify 403 Forbidden response
- [ ] Login as admin user
- [ ] Verify admin dashboard loads
- [ ] Check all metric cards display
- [ ] Navigate to Users page
- [ ] Test search functionality
- [ ] Test tier filter (ALL/FREE/PRO)
- [ ] Test pagination
- [ ] Navigate to API Usage page
- [ ] Verify endpoint stats display
- [ ] Navigate to Error Logs page
- [ ] Verify logs display
- [ ] Test date range filter
- [ ] Test export to CSV

### **3. API Testing**

```bash
# GET users (as admin)
curl http://localhost:3000/api/admin/users

# GET users with search
curl "http://localhost:3000/api/admin/users?search=john&tier=PRO"

# GET analytics
curl http://localhost:3000/api/admin/analytics

# GET API usage
curl "http://localhost:3000/api/admin/api-usage?startDate=2025-01-01"

# GET error logs
curl "http://localhost:3000/api/admin/error-logs?type=API_ERROR"
```

### **4. Console Checks**

- [ ] No console errors
- [ ] No React hydration warnings
- [ ] API calls return correct status codes

### **5. TypeScript Build**

```bash
npm run build
# Should complete with 0 errors
```

---

## CODING PATTERNS TO FOLLOW

### **Pattern 1: Admin Layout with Role Check**

```typescript
// app/(dashboard)/admin/layout.tsx
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth-options';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface AdminLayoutProps {
  children: React.ReactNode;
}

const adminTabs = [
  { id: 'dashboard', icon: '📊', label: 'Dashboard', href: '/admin' },
  { id: 'users', icon: '👥', label: 'Users', href: '/admin/users' },
  { id: 'analytics', icon: '📈', label: 'Analytics', href: '/admin/analytics' },
  { id: 'api-usage', icon: '🔌', label: 'API Usage', href: '/admin/api-usage' },
  { id: 'errors', icon: '🚨', label: 'Error Logs', href: '/admin/errors' },
];

export default async function AdminLayout({ children }: AdminLayoutProps) {
  const session = await getServerSession(authOptions);

  // Check authentication
  if (!session) {
    redirect('/login?callbackUrl=/admin');
  }

  // Check admin role
  if (session.user.role !== 'ADMIN') {
    redirect('/dashboard?error=forbidden');
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Top Bar */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold">Admin Panel</h1>
            <span className="bg-red-600 text-white text-xs px-2 py-1 rounded-full">
              ADMIN
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-gray-400 text-sm">
              {session.user.name || session.user.email}
            </span>
            <Link
              href="/dashboard"
              className="text-blue-400 hover:text-blue-300 text-sm"
            >
              ← Back to App
            </Link>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 bg-gray-800 min-h-[calc(100vh-73px)] p-4">
          <nav className="space-y-2">
            {adminTabs.map((tab) => (
              <Link
                key={tab.id}
                href={tab.href}
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
              >
                <span className="text-xl">{tab.icon}</span>
                <span>{tab.label}</span>
              </Link>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
```

### **Pattern 2: Admin Users API Route**

```typescript
// app/api/admin/users/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(10).max(100).default(50),
  search: z.string().optional(),
  tier: z.enum(['ALL', 'FREE', 'PRO']).default('ALL'),
  sortBy: z.enum(['createdAt', 'name', 'tier']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Auth check
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Admin role check
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    // Parse query params
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const validation = querySchema.safeParse(searchParams);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { page, pageSize, search, tier, sortBy, sortOrder } = validation.data;

    // Build where clause
    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (tier !== 'ALL') {
      where.tier = tier;
    }

    // Get total count
    const total = await prisma.user.count({ where });

    // Get users
    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        tier: true,
        role: true,
        createdAt: true,
        _count: {
          select: {
            alerts: true,
            watchlistItems: true,
          },
        },
      },
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    // Transform response
    const transformedUsers = users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      tier: user.tier,
      role: user.role,
      status: 'active', // TODO: Add status field to User model
      createdAt: user.createdAt,
      lastLoginAt: null, // TODO: Add lastLoginAt field to User model
      alertCount: user._count.alerts,
      watchlistCount: user._count.watchlistItems,
    }));

    return NextResponse.json({
      users: transformedUsers,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error('Admin users error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}
```

### **Pattern 3: Admin Analytics API Route**

```typescript
// app/api/admin/analytics/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db/prisma';

const PRO_MONTHLY_PRICE = 29;

export async function GET(): Promise<NextResponse> {
  try {
    // Auth check
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Admin role check
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    // Get user counts by tier
    const [totalUsers, freeUsers, proUsers] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { tier: 'FREE' } }),
      prisma.user.count({ where: { tier: 'PRO' } }),
    ]);

    // Calculate percentages
    const freePercentage = totalUsers > 0 ? (freeUsers / totalUsers) * 100 : 0;
    const proPercentage = totalUsers > 0 ? (proUsers / totalUsers) * 100 : 0;

    // Calculate revenue
    const mrr = proUsers * PRO_MONTHLY_PRICE;
    const arr = mrr * 12;

    // Calculate conversion rate
    const conversionRate = totalUsers > 0 ? (proUsers / totalUsers) * 100 : 0;

    // Get new users this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const newUsersThisMonth = await prisma.user.count({
      where: {
        createdAt: { gte: startOfMonth },
      },
    });

    // Get user growth over last 12 months
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const userGrowth = await prisma.$queryRaw`
      SELECT
        DATE_TRUNC('month', "createdAt") as month,
        COUNT(*) as count
      FROM "User"
      WHERE "createdAt" >= ${twelveMonthsAgo}
      GROUP BY DATE_TRUNC('month', "createdAt")
      ORDER BY month ASC
    `;

    // Get average alerts per tier
    const alertStats = await prisma.user.groupBy({
      by: ['tier'],
      _avg: {
        // Note: This would need a computed field or subquery
      },
    });

    return NextResponse.json({
      overview: {
        totalUsers,
        freeUsers,
        proUsers,
        freePercentage: Math.round(freePercentage * 100) / 100,
        proPercentage: Math.round(proPercentage * 100) / 100,
      },
      revenue: {
        mrr,
        arr,
        conversionRate: Math.round(conversionRate * 100) / 100,
        pricePerUser: PRO_MONTHLY_PRICE,
      },
      growth: {
        newUsersThisMonth,
        churnedThisMonth: 0, // TODO: Track cancellations
        userGrowth,
      },
    });
  } catch (error) {
    console.error('Admin analytics error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}
```

### **Pattern 4: Admin Dashboard Page**

```typescript
// app/(dashboard)/admin/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface AdminMetrics {
  overview: {
    totalUsers: number;
    freeUsers: number;
    proUsers: number;
    freePercentage: number;
    proPercentage: number;
  };
  revenue: {
    mrr: number;
    arr: number;
    conversionRate: number;
  };
  growth: {
    newUsersThisMonth: number;
    churnedThisMonth: number;
  };
}

export default function AdminDashboardPage() {
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchMetrics() {
      try {
        const response = await fetch('/api/admin/analytics');
        if (!response.ok) {
          throw new Error('Failed to fetch analytics');
        }
        const data = await response.json();
        setMetrics(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    }

    fetchMetrics();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="text-center text-red-500 py-8">
        {error || 'Failed to load metrics'}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-gray-400 mt-1">System overview and key metrics</p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Users */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-400">Total Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-white">
              {metrics.overview.totalUsers.toLocaleString()}
            </div>
            <p className="text-green-400 text-sm mt-1">
              +{metrics.growth.newUsersThisMonth} this month
            </p>
          </CardContent>
        </Card>

        {/* FREE Users */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-400 flex items-center gap-2">
              FREE Users
              <Badge className="bg-gray-600">
                {metrics.overview.freePercentage.toFixed(1)}%
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-white">
              {metrics.overview.freeUsers.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        {/* PRO Users */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-400 flex items-center gap-2">
              PRO Users
              <Badge className="bg-blue-600">
                {metrics.overview.proPercentage.toFixed(1)}%
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-blue-400">
              {metrics.overview.proUsers.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        {/* MRR */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-400">
              Monthly Recurring Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-green-400">
              ${metrics.revenue.mrr.toLocaleString()}
            </div>
            <p className="text-gray-400 text-sm mt-1">
              ARR: ${metrics.revenue.arr.toLocaleString()}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">Conversion Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-bold text-blue-400">
              {metrics.revenue.conversionRate.toFixed(1)}%
            </div>
            <p className="text-gray-400 text-sm mt-2">FREE → PRO</p>
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">Tier Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-400">FREE</span>
                  <span className="text-white">
                    {metrics.overview.freePercentage.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-gray-500 h-2 rounded-full"
                    style={{ width: `${metrics.overview.freePercentage}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-400">PRO</span>
                  <span className="text-white">
                    {metrics.overview.proPercentage.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full"
                    style={{ width: `${metrics.overview.proPercentage}%` }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <a
              href="/admin/errors"
              className="block w-full text-left px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition-colors"
            >
              🚨 View Latest Errors
            </a>
            <a
              href="/admin/users?tier=PRO"
              className="block w-full text-left px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition-colors"
            >
              👥 View PRO Users
            </a>
            <button className="w-full text-left px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition-colors">
              📊 Export Data
            </button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

### **Pattern 5: Error Logs API Route**

```typescript
// app/api/admin/error-logs/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(10).max(100).default(50),
  type: z
    .enum([
      'ALL',
      'API_ERROR',
      'DATABASE_ERROR',
      'AUTH_ERROR',
      'PAYMENT_ERROR',
      'MT5_ERROR',
    ])
    .default('ALL'),
  tier: z.enum(['ALL', 'FREE', 'PRO']).default('ALL'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Auth check
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Admin role check
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    // Parse query params
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const validation = querySchema.safeParse(searchParams);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { page, pageSize, type, tier, startDate, endDate } = validation.data;

    // Build where clause
    const where: Record<string, unknown> = {};

    if (type !== 'ALL') {
      where.type = type;
    }

    if (tier !== 'ALL') {
      where.userTier = tier;
    }

    if (startDate) {
      where.timestamp = {
        ...(where.timestamp as object),
        gte: new Date(startDate),
      };
    }

    if (endDate) {
      where.timestamp = {
        ...(where.timestamp as object),
        lte: new Date(endDate),
      };
    }

    // Get total count
    const total = await prisma.errorLog.count({ where });

    // Get error logs
    const logs = await prisma.errorLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return NextResponse.json({
      logs,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error('Admin error logs error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch error logs' },
      { status: 500 }
    );
  }
}
```

---

## CRITICAL RULES

### **DO:**

- Read ALL policy files before writing code
- Check ADMIN role on EVERY admin route
- Return 403 Forbidden for non-admin users
- Log admin actions for audit trail
- Use dark theme for admin UI
- Display tier-based metrics prominently
- Validate all query parameters
- Reference seed code for component patterns
- Validate after each file
- Commit each file individually
- Test with both admin and non-admin users

### **DON'T:**

- Skip admin role checks
- Use `any` types
- Expose sensitive user data
- Allow non-admins to access admin routes
- Skip validation on query parameters
- Commit multiple files at once
- Push without validation passing
- Push to main branch directly
- Skip testing

---

## SUCCESS CRITERIA

Part 14 is complete when:

- All 9 files created and committed
- All TypeScript validations pass (0 errors)
- All ESLint checks pass
- Non-admin users get 403 on admin routes
- Admin layout loads at `/admin` without errors
- Dashboard shows correct metrics (users, MRR, tiers)
- User management page works (search, filter, pagination)
- API Usage page displays endpoint stats
- Error Logs page displays and filters logs
- All API endpoints work with admin auth
- All manual tests pass
- Code pushed to feature branch
- PR created (ready for review)

---

## PROGRESS TRACKING

Use the TodoWrite tool to track your progress:

```
1. Read all policy and architecture files
2. Build File 1/9: app/(dashboard)/admin/layout.tsx
3. Build File 2/9: app/(dashboard)/admin/page.tsx
4. Build File 3/9: app/(dashboard)/admin/users/page.tsx
5. Build File 4/9: app/(dashboard)/admin/api-usage/page.tsx
6. Build File 5/9: app/(dashboard)/admin/errors/page.tsx
7. Build File 6/9: app/api/admin/users/route.ts
8. Build File 7/9: app/api/admin/analytics/route.ts
9. Build File 8/9: app/api/admin/api-usage/route.ts
10. Build File 9/9: app/api/admin/error-logs/route.ts
11. Run full validation suite
12. Test admin dashboard manually
13. Test with non-admin user (expect 403)
14. Push to feature branch
15. Create pull request
```

---

## START HERE

1. **First, read these files in order:**
   - `PROGRESS-part-2.md` - Understand current state
   - `docs/policies/00-tier-specifications.md` - Learn tier system (CRITICAL)
   - `docs/policies/05-coding-patterns-part-1.md` - Learn code patterns
   - `docs/policies/05-coding-patterns-part-2.md` - More code patterns
   - `docs/build-orders/part-14-admin.md` - Understand Part 14
   - `docs/implementation-guides/v5_part_n.md` - Admin dashboard business logic

2. **Then, create your git branch:**

   ```bash
   git checkout main
   git pull origin main
   git checkout -b claude/admin-dashboard-{SESSION_ID}
   ```

3. **Start building File 1/9:**
   - Read the build order for File 1
   - Write the file following patterns
   - Validate: `npm run validate`
   - Fix any issues: `npm run fix`
   - Commit: `git commit -m "feat(admin): add admin layout with role check"`

4. **Repeat for Files 2-9**

5. **After all files complete:**
   - Run final validation
   - Test manually (as admin AND non-admin)
   - Push to remote
   - Create PR

---

## WHEN TO ASK FOR HELP

Escalate to the user if:

- Critical security issues found
- Ambiguous requirements (can't determine correct approach)
- Missing dependencies
- Validation errors you can't resolve
- Database schema questions (e.g., ErrorLog model missing)
- Admin role field missing from User model
- Charts/visualization library questions

Otherwise, work autonomously following the policies!

---

**Good luck! Build Part 14 with quality and precision. The user trusts you to follow all policies and deliver production-ready code.**
