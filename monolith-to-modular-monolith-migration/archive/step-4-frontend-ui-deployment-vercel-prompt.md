# Frontend UI Deployment to Vercel - Step 4: Interactive/Readable Elements Separation

## Prompt for Claude Code (Web)

**Purpose**: Guide for implementing Step 4 of the Monolith to Modular Monolith Architecture Migration
**Focus**: Separating Interactive Elements from Readable Elements to minimize JavaScript bundle size
**Created**: 2026-01-09
**Status**: Ready for Implementation

---

## Context

You are implementing **Step 4** of the Monolith to Modular Monolith Architecture Migration for the Trading Alerts SaaS application. This step focuses on **separating Interactive Elements from Readable Elements** in the frontend to minimize JavaScript bundle size before deploying to Vercel.

### Migration Overview

- **Step 1**: Baseline Assessment ✅ (Completed)
- **Step 2**: Extract Frontend (UI components, pages, client-side logic) ✅ (Completed)
- **Step 3**: Extract Backend (API logic, database access, business rules) ✅ (Completed)
- **Step 4**: Frontend Optimization (Interactive/Readable Separation) ← **YOU ARE HERE**
- **Step 5-8**: Backend Upgrade, Connect, Testing (Future)

### Target Architecture

```
Frontend (Vercel)
├── Readable Elements (Server Components) - 0KB JS sent to client
│   ├── Layouts, static pages, reports, logs
│   └── Data displays, navigation, headers/footers
│
└── Interactive Elements (Client Components) - Minimal JS bundle
    ├── Forms, buttons, interactive widgets
    └── Real-time updates, charts, modals
```

---

## IMPORTANT: Fresh Vercel Deployment

**This deployment MUST be a NEW/FRESH Vercel project, separate from the existing monolith deployment.**

### Deployment Strategy

```
EXISTING (Keep Intact - DO NOT MODIFY)
├── Vercel Project: trading-alerts-saas (monolith)
│   ├── Domain: trading-alerts.vercel.app (or custom domain)
│   ├── Contains: Full Next.js monolith (frontend + backend)
│   └── Status: Production - Keep running
│
NEW (Create Fresh)
├── Vercel Project: trading-alerts-frontend (modular)
│   ├── Domain: trading-alerts-v2.vercel.app (or staging subdomain)
│   ├── Contains: Frontend only (optimized Server Components)
│   ├── Backend: Connects to Railway NestJS backend via API
│   └── Status: Staging → Production (after validation)
```

### Why Fresh Deployment?

1. **Zero Risk**: Old monolith remains functional during migration
2. **A/B Testing**: Can compare performance between old and new
3. **Rollback Ready**: If issues arise, old deployment is still live
4. **Gradual Migration**: Switch DNS/traffic only when ready

### Fresh Deployment Steps (Do This First)

#### Step A: Create New Vercel Project

```bash
# Option 1: Via Vercel CLI
vercel login
vercel link --yes  # Creates new project, don't link to existing

# Option 2: Via Vercel Dashboard
# 1. Go to https://vercel.com/new
# 2. Import the same GitHub repo
# 3. Name it: trading-alerts-frontend (different from existing)
# 4. Set root directory if using monorepo structure
```

#### Step B: Configure Environment Variables

In the NEW Vercel project, set these environment variables:

```bash
# Database (same as monolith during transition)
DATABASE_URL=<postgresql-connection-string>

# Auth (same secrets for session compatibility)
NEXTAUTH_SECRET=<same-as-monolith>
NEXTAUTH_URL=https://trading-alerts-v2.vercel.app

# Backend API (Railway NestJS - Step 5)
NEXT_PUBLIC_API_URL=https://api.trading-alerts.railway.app
# or localhost:5000 for local development

# Feature Flags (for gradual rollout)
NEXT_PUBLIC_USE_MODULAR_BACKEND=false  # Enable after Step 5
```

#### Step C: Set Up Preview Deployments

```bash
# In vercel.json (create if not exists)
{
  "git": {
    "deploymentEnabled": {
      "main": true,
      "claude/*": true
    }
  },
  "env": {
    "NEXT_PUBLIC_DEPLOYMENT_TYPE": "modular-frontend"
  }
}
```

#### Step D: Verify Fresh Deployment

After initial deploy, verify:

- [ ] New Vercel project created (separate from monolith)
- [ ] Deployment URL is different from existing monolith
- [ ] Old monolith deployment still working at original URL
- [ ] Environment variables configured correctly
- [ ] Preview deployments enabled for feature branches

---

## CRITICAL: Directory Structure - Keep Existing Files Intact

**DO NOT modify existing frontend files directly.** Create a new `frontend/` directory and copy files there for refactoring.

### Repository Structure (After Step 4)

```
trading-alerts-saas-public/
│
├── app/                              # EXISTING - DO NOT MODIFY
│   ├── (auth)/                       # Keep intact for monolith
│   ├── (dashboard)/                  # Keep intact for monolith
│   ├── (marketing)/                  # Keep intact for monolith
│   └── api/                          # Keep intact for monolith
│
├── components/                       # EXISTING - DO NOT MODIFY
│   ├── ui/                           # Keep intact
│   ├── charts/                       # Keep intact
│   └── ...                           # Keep intact
│
├── lib/                              # EXISTING - DO NOT MODIFY
│   ├── auth/                         # Keep intact
│   ├── db/                           # Keep intact
│   └── ...                           # Keep intact
│
├── frontend/                         # NEW DIRECTORY - Create this
│   ├── app/                          # Copied + refactored pages
│   │   ├── (auth)/                   # Server Components + Client islands
│   │   ├── (dashboard)/              # Server Components + Client islands
│   │   ├── (marketing)/              # Static/SSG pages
│   │   └── layout.tsx                # Root layout
│   │
│   ├── components/                   # Copied + optimized components
│   │   ├── ui/                       # Shared UI (can symlink)
│   │   ├── readable/                 # Server Components only
│   │   └── interactive/              # Client Components only
│   │
│   ├── lib/                          # Shared utilities
│   │   └── ...                       # Can symlink to root lib/
│   │
│   ├── next.config.js                # Separate Next.js config
│   ├── package.json                  # Frontend-specific dependencies
│   ├── tsconfig.json                 # TypeScript config
│   └── vercel.json                   # Vercel deployment config
│
└── backend/                          # Future - Step 5 (NestJS)
```

### Step E: Create Frontend Directory Structure

```bash
# Create the new frontend directory
mkdir -p frontend/{app,components,lib}

# Copy existing app structure (DO NOT delete originals)
cp -r app/* frontend/app/

# Copy components
cp -r components/* frontend/components/

# Copy lib utilities
cp -r lib/* frontend/lib/

# Copy config files
cp next.config.js frontend/
cp tsconfig.json frontend/
cp tailwind.config.ts frontend/
cp postcss.config.js frontend/

# Create frontend-specific package.json (subset of dependencies)
cp package.json frontend/
```

### Step F: Create Frontend-Specific Configuration

**frontend/next.config.js:**

```javascript
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Optimize for modular frontend
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
  },

  // Modularize imports for tree-shaking
  modularizeImports: {
    'lucide-react': {
      transform: 'lucide-react/dist/esm/icons/{{kebabCase member}}',
    },
  },

  // Environment indicator
  env: {
    DEPLOYMENT_TYPE: 'modular-frontend',
  },
};

module.exports = withBundleAnalyzer(nextConfig);
```

**frontend/vercel.json:**

```json
{
  "framework": "nextjs",
  "installCommand": "pnpm install",
  "buildCommand": "pnpm run build",
  "outputDirectory": ".next",
  "env": {
    "NEXT_PUBLIC_DEPLOYMENT_TYPE": "modular-frontend"
  }
}
```

### Step G: Configure Vercel Root Directory

In the NEW Vercel project settings:

1. Go to **Settings** → **General** → **Root Directory**
2. Set Root Directory to: `frontend`
3. Save changes

```
Vercel Project Settings:
┌─────────────────────────────────────────────────┐
│ Root Directory: frontend                        │
│ Framework Preset: Next.js                       │
│ Build Command: (default)                        │
│ Output Directory: (default)                     │
│ Install Command: pnpm install                   │
└─────────────────────────────────────────────────┘
```

### Step H: Organize Components by Type

After copying, reorganize components in `frontend/components/`:

```bash
# Create subdirectories for separation
mkdir -p frontend/components/{readable,interactive}

# Move pure display components to readable/
# (No useState, useEffect, onClick, etc.)
mv frontend/components/dashboard/stats-card.tsx frontend/components/readable/
mv frontend/components/admin/metric-card.tsx frontend/components/readable/

# Move interactive components to interactive/
# (Has hooks, event handlers, browser APIs)
mv frontend/components/charts/trading-chart.tsx frontend/components/interactive/
mv frontend/components/forms/login-form.tsx frontend/components/interactive/
```

**Component Classification Rule:**

```
┌─────────────────────────────────────────────────────────────────┐
│ READABLE (Server Components)         │ INTERACTIVE (Client)    │
├─────────────────────────────────────────────────────────────────┤
│ ✓ Display data only                  │ ✓ useState, useEffect   │
│ ✓ No event handlers                  │ ✓ onClick, onChange     │
│ ✓ No browser APIs                    │ ✓ window, localStorage  │
│ ✓ Can fetch data directly            │ ✓ Real-time updates     │
│ ✓ Static content                     │ ✓ Form inputs           │
│                                      │ ✓ Animations            │
│ → 0 KB JavaScript sent to client     │ → JS bundle required    │
└─────────────────────────────────────────────────────────────────┘
```

### Step I: Verification Checklist

Before proceeding to refactoring:

- [ ] `frontend/` directory created
- [ ] All files copied (not moved) from root
- [ ] Original `app/`, `components/`, `lib/` unchanged
- [ ] `frontend/next.config.js` configured
- [ ] `frontend/vercel.json` created
- [ ] Vercel project root directory set to `frontend`
- [ ] `pnpm install` works in `frontend/` directory
- [ ] `pnpm run build` succeeds in `frontend/` directory
- [ ] Original monolith still builds: `pnpm run build` (from root)

---

## Reference Documentation

Read these files before starting:

1. **Architecture Guide**: `monolith-to-modular-monolith-migration/monolith-to-modular-monolith-migration.md`
2. **Bundle Optimization Architecture**: `bundle-size-optimization/bundle-size-loading-optimization/bundle-optimization-architecture.md`
3. **Refactoring Guide**: `bundle-size-optimization/next-js-refactoring-for-bundle-size-reduction/refactoring-guide-for-converting-client-to-server-component-01012026.md`
4. **Frontend Pages List**: `docs/files-completion-list/frontend-ui-pages.md`

---

## Current State Analysis

### Frontend UI Pages Summary (62 files total)

- **Readable Elements (Server Components)**: 23 files (37%) ← Target: >90%
- **Interactive Elements (Client Components)**: 39 files (63%) ← Target: <10%

### Pages Currently Using `'use client'` (need conversion):

```
app/(auth)/forgot-password/page.tsx
app/(auth)/login/page.tsx
app/(auth)/register/page.tsx
app/(auth)/reset-password/page.tsx
app/(dashboard)/admin/page.tsx
app/(dashboard)/admin/users/page.tsx
app/(dashboard)/admin/disbursement/page.tsx
app/(dashboard)/admin/disbursement/affiliates/page.tsx
app/(dashboard)/admin/disbursement/batches/page.tsx
app/(dashboard)/admin/disbursement/config/page.tsx
app/(dashboard)/admin/disbursement/accounts/page.tsx
app/(dashboard)/admin/fraud-alerts/page.tsx
app/(dashboard)/admin/fraud-alerts/[id]/page.tsx
app/(dashboard)/settings/profile/page.tsx
app/(dashboard)/settings/appearance/page.tsx
app/(dashboard)/settings/account/page.tsx
app/(dashboard)/settings/privacy/page.tsx
app/(dashboard)/settings/billing/page.tsx
app/(dashboard)/settings/language/page.tsx
app/(dashboard)/settings/security/page.tsx
app/(dashboard)/settings/security/alerts/page.tsx
app/(dashboard)/charts/page.tsx
app/(dashboard)/charts/[symbol]/[timeframe]/page.tsx
app/(dashboard)/watchlist/page.tsx
app/(dashboard)/alerts/page.tsx
app/(dashboard)/alerts/new/page.tsx
app/(dashboard)/dashboard/page.tsx
app/(marketing)/page.tsx
app/(marketing)/pricing/page.tsx
app/admin/login/page.tsx
app/admin/affiliates/page.tsx
app/admin/affiliates/[id]/page.tsx
app/affiliate/register/page.tsx
app/affiliate/dashboard/page.tsx
app/affiliate/dashboard/profile/page.tsx
app/affiliate/dashboard/profile/payment/page.tsx
app/checkout/page.tsx
app/error.tsx
```

### Pages Already Using Server Components (good examples):

```
app/(auth)/verify-email/page.tsx
app/(auth)/verify-email/pending/page.tsx
app/(dashboard)/settings/help/page.tsx
app/(dashboard)/settings/security/login-history/page.tsx
app/(dashboard)/admin/api-usage/page.tsx
app/(dashboard)/admin/errors/page.tsx
app/(dashboard)/admin/disbursement/batches/[batchId]/page.tsx
app/(dashboard)/admin/disbursement/transactions/page.tsx
app/(dashboard)/admin/disbursement/audit/page.tsx
app/admin/affiliates/reports/profit-loss/page.tsx
app/admin/affiliates/reports/sales-performance/page.tsx
app/admin/affiliates/reports/commission-owings/page.tsx
app/admin/affiliates/reports/code-inventory/page.tsx
app/affiliate/verify/page.tsx
app/affiliate/dashboard/codes/page.tsx
app/affiliate/dashboard/commissions/page.tsx
```

---

## Step-by-Step Implementation Guide

### Phase 1: Setup & Foundation (Day 1)

#### Step 1.1: Create loading.tsx Files for All Routes

For every route that will be converted to Server Component, create a `loading.tsx` file with a skeleton matching the page layout.

```bash
# Create loading skeletons for all major routes
touch app/(dashboard)/admin/loading.tsx
touch app/(dashboard)/settings/loading.tsx
touch app/(dashboard)/alerts/loading.tsx
touch app/(dashboard)/charts/loading.tsx
# ... continue for all routes
```

**Pattern for loading.tsx:**

```tsx
// app/(dashboard)/admin/loading.tsx
export default function Loading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-8 w-48 rounded bg-gray-700" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 rounded-lg bg-gray-800" />
        ))}
      </div>
      <div className="h-64 rounded-lg bg-gray-800" />
    </div>
  );
}
```

#### Step 1.2: Create Client Component Directory Structure

For each page that needs conversion, create a `_components` directory for interactive parts:

```
app/(dashboard)/admin/
├── page.tsx                    # Server Component (will be converted)
├── loading.tsx                 # Skeleton UI
├── admin-client.tsx            # Client Component (interactive parts)
└── _components/
    ├── MetricCards.tsx         # Server Component (display only)
    ├── AdminFilters.tsx        # Client Component ('use client')
    └── RefreshButton.tsx       # Client Component ('use client')
```

---

### Phase 2: Gradual Conversion (Days 2-5)

#### Priority 1: Quick Wins - Admin Pages with Minimal Interactivity

**Convert in this order:**

1. `app/(dashboard)/admin/errors/page.tsx` (already server)
2. `app/(dashboard)/admin/api-usage/page.tsx` (already server)
3. `app/(dashboard)/admin/page.tsx` (needs conversion)
4. `app/(dashboard)/admin/users/page.tsx` (needs conversion)

**Conversion Pattern:**

**BEFORE (Client Component):**

```tsx
// app/(dashboard)/admin/page.tsx
'use client';

import { useEffect, useState } from 'react';

export default function AdminDashboardPage() {
  const [metrics, setMetrics] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/analytics')
      .then(res => res.json())
      .then(data => {
        setMetrics(data);
        setIsLoading(false);
      });
  }, []);

  if (isLoading) return <Spinner />;

  return (
    <div>
      <h1>Admin Dashboard</h1>
      <MetricCards data={metrics} />
      <RefreshButton onClick={() => ...} />
    </div>
  );
}
```

**AFTER (Server Component + Client Component Island):**

```tsx
// app/(dashboard)/admin/page.tsx
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { AdminClient } from './admin-client';

export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  // Direct database access - no API call needed
  const [totalUsers, proUsers, totalAlerts, activeAlerts] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { tier: 'PRO' } }),
    prisma.alert.count(),
    prisma.alert.count({ where: { isActive: true } }),
  ]);

  const metrics = {
    totalUsers,
    proUsers,
    freeUsers: totalUsers - proUsers,
    totalAlerts,
    activeAlerts,
  };

  return (
    <div className="space-y-6">
      {/* Static content - Server rendered (0 KB JS) */}
      <div>
        <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
        <p className="text-gray-400">System overview and key metrics</p>
      </div>

      {/* Static metric cards - Server Component */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Total Users" value={metrics.totalUsers} />
        <MetricCard title="PRO Users" value={metrics.proUsers} />
        <MetricCard title="FREE Users" value={metrics.freeUsers} />
        <MetricCard title="Active Alerts" value={metrics.activeAlerts} />
      </div>

      {/* Interactive parts only - Client Component */}
      <AdminClient initialMetrics={metrics} />
    </div>
  );
}

function MetricCard({ title, value }: { title: string; value: number }) {
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
      <p className="text-sm text-gray-400">{title}</p>
      <p className="text-2xl font-bold text-white">{value.toLocaleString()}</p>
    </div>
  );
}
```

```tsx
// app/(dashboard)/admin/admin-client.tsx
'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

interface AdminClientProps {
  initialMetrics: {
    totalUsers: number;
    proUsers: number;
    freeUsers: number;
    totalAlerts: number;
    activeAlerts: number;
  };
}

export function AdminClient({ initialMetrics }: AdminClientProps) {
  const [isPending, startTransition] = useTransition();

  const handleRefresh = () => {
    startTransition(() => {
      // router.refresh() will re-fetch server data
      window.location.reload();
    });
  };

  return (
    <div className="flex justify-end">
      <Button onClick={handleRefresh} disabled={isPending} variant="outline">
        <RefreshCw
          className={`mr-2 h-4 w-4 ${isPending ? 'animate-spin' : ''}`}
        />
        {isPending ? 'Refreshing...' : 'Refresh Data'}
      </Button>
    </div>
  );
}
```

#### Priority 2: Auth Pages (Special Handling)

Auth pages need forms which require client-side state. Use this pattern:

```tsx
// app/(auth)/login/page.tsx
import { LoginForm } from './login-form';

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md space-y-6">
        {/* Server rendered - 0 KB JS */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white">Welcome Back</h1>
          <p className="text-gray-400">Sign in to your account</p>
        </div>

        {/* Form - Client Component */}
        <LoginForm />

        {/* Server rendered links */}
        <p className="text-center text-sm text-gray-400">
          Don't have an account?{' '}
          <a href="/register" className="text-blue-400 hover:underline">
            Sign up
          </a>
        </p>
      </div>
    </div>
  );
}
```

```tsx
// app/(auth)/login/login-form.tsx
'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError('Invalid credentials');
      } else {
        router.push('/dashboard');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        required
        className="w-full rounded border border-gray-700 bg-gray-800 px-4 py-2"
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        required
        className="w-full rounded border border-gray-700 bg-gray-800 px-4 py-2"
      />
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={isLoading}
        className="w-full rounded bg-blue-600 py-2 text-white disabled:opacity-50"
      >
        {isLoading ? 'Signing in...' : 'Sign In'}
      </button>
    </form>
  );
}
```

#### Priority 3: Dashboard & Charts (Heavy Components)

For pages with heavy components like charts, use dynamic imports:

```tsx
// app/(dashboard)/charts/[symbol]/[timeframe]/page.tsx
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { validateChartAccess } from '@/lib/tier-validation';
import { ChartClient } from './chart-client';

export const dynamic = 'force-dynamic';

interface ChartPageProps {
  params: { symbol: string; timeframe: string };
}

export default async function ChartPage({ params }: ChartPageProps) {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  // Validate tier access
  const validation = validateChartAccess(
    session.user.tier,
    params.symbol,
    params.timeframe
  );

  if (!validation.allowed) {
    return (
      <div className="flex h-full flex-col items-center justify-center">
        <h1 className="text-xl font-bold text-white">PRO Feature</h1>
        <p className="text-gray-400">{validation.reason}</p>
        <a href="/pricing" className="mt-4 text-blue-400">
          Upgrade to PRO
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Server rendered header */}
      <div>
        <h1 className="text-2xl font-bold text-white">
          {params.symbol} - {params.timeframe}
        </h1>
      </div>

      {/* Chart loaded dynamically on client */}
      <ChartClient symbol={params.symbol} timeframe={params.timeframe} />
    </div>
  );
}
```

```tsx
// app/(dashboard)/charts/[symbol]/[timeframe]/chart-client.tsx
'use client';

import dynamic from 'next/dynamic';

const TradingChart = dynamic(
  () =>
    import('@/components/charts/trading-chart').then((mod) => mod.TradingChart),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[500px] w-full animate-pulse items-center justify-center rounded-lg bg-gray-800">
        <p className="text-gray-400">Loading chart...</p>
      </div>
    ),
  }
);

interface ChartClientProps {
  symbol: string;
  timeframe: string;
}

export function ChartClient({ symbol, timeframe }: ChartClientProps) {
  return <TradingChart symbol={symbol} timeframe={timeframe} />;
}
```

---

### Phase 3: Tier-Based Optimization (Day 6)

Implement tier-based loading to minimize bundle for FREE tier users:

```tsx
// app/(dashboard)/dashboard/page.tsx
import { Suspense } from 'react';
import { getSession } from '@/lib/auth/session';
import { getUserTier, getTrialStatus } from '@/lib/tier-helpers';
import dynamic from 'next/dynamic';

// FREE tier symbols (always loaded)
import { AlertList } from './_components/alert-list';

// PRO-only components (lazy loaded)
const ProIndicatorPanel = dynamic(
  () => import('./_components/pro-indicator-panel'),
  { loading: () => <div className="h-32 animate-pulse rounded bg-gray-800" /> }
);

export default async function DashboardPage() {
  const session = await getSession();
  const tier = await getUserTier(session.user.id);
  const trialStatus = await getTrialStatus(session.user.id);
  const isPro = tier === 'PRO' || trialStatus === 'ACTIVE';

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard - {tier} Tier</h1>

      {/* FREE tier: 5 symbols */}
      <Suspense fallback={<div>Loading FREE symbols...</div>}>
        <AlertList symbols={['BTCUSD', 'EURUSD', 'USDJPY', 'US30', 'XAUUSD']} />
      </Suspense>

      {/* PRO tier: Additional 10 symbols (lazy loaded) */}
      {isPro && (
        <Suspense fallback={<div>Loading PRO symbols...</div>}>
          <AlertList
            symbols={[
              'AUDJPY',
              'AUDUSD',
              'ETHUSD',
              'GBPJPY',
              'GBPUSD',
              'NDX100',
              'NZDUSD',
              'USDCAD',
              'USDCHF',
              'XAGUSD',
            ]}
          />
        </Suspense>
      )}

      {/* PRO indicators (lazy loaded) */}
      {isPro && (
        <Suspense fallback={<div>Loading indicators...</div>}>
          <ProIndicatorPanel />
        </Suspense>
      )}

      {/* Upgrade CTA for FREE users */}
      {!isPro && (
        <div className="rounded-lg bg-gradient-to-r from-blue-900 to-purple-900 p-6">
          <h2 className="text-xl font-bold text-white">Upgrade to PRO</h2>
          <p className="text-gray-300">
            Get access to 15 symbols, 9 timeframes, and all indicators
          </p>
          <a
            href="/pricing"
            className="mt-4 inline-block rounded bg-blue-600 px-4 py-2 text-white"
          >
            View Pricing
          </a>
        </div>
      )}
    </div>
  );
}
```

---

### Phase 4: Validation & Testing (Day 7)

#### Step 4.1: Build Analysis

```bash
# Run build with bundle analyzer
ANALYZE=true pnpm run build

# Check bundle size
BUNDLE_SIZE=$(du -sm .next/ | cut -f1)
echo "Bundle size: ${BUNDLE_SIZE}MB"

# Target: <200MB (down from ~380MB)
```

#### Step 4.2: Verify Server Components

After build, check the output:

```bash
# Look for route types in build output:
# ○ = Static (SSG) - Best
# λ = Server-rendered (SSR) - Good
# ƒ = Dynamic functions - OK
# ● = Client-side - Should be minimal

pnpm run build | grep -E "^(○|λ|ƒ|●)"
```

#### Step 4.3: Run Tests

```bash
# Run all tests to ensure nothing is broken
pnpm run test:ci

# Run E2E tests (if configured)
pnpm run test:e2e
```

#### Step 4.4: Mobile Performance Testing

```bash
# Run Lighthouse audit
npx lighthouse http://localhost:3000 --view
npx lighthouse http://localhost:3000/dashboard --view
```

**Target Metrics:**

- First Contentful Paint: <1.8s
- Time to Interactive: <3.5s (mobile)
- Lighthouse Performance Score: >90

---

## Conversion Checklist

Use this checklist for each page conversion:

### Before Starting

- [ ] Read the page.tsx file completely
- [ ] Identify all useState, useEffect, and event handlers
- [ ] List what MUST be client-side vs what can be server-side
- [ ] Check if a loading.tsx exists for the route

### During Conversion

- [ ] Remove 'use client' from page.tsx
- [ ] Add `export const dynamic = 'force-dynamic'` if needed
- [ ] Move data fetching to server-side (Prisma queries)
- [ ] Create \*-client.tsx for interactive parts only
- [ ] Pass data via props from server to client

### After Conversion

- [ ] Build succeeds: `pnpm run build`
- [ ] Tests pass: `pnpm run test`
- [ ] Page loads correctly (manual test)
- [ ] Interactive features work
- [ ] No console errors

---

## Expected Outcomes

### Bundle Size Reduction

| User Tier | Before    | After    | Reduction |
| --------- | --------- | -------- | --------- |
| FREE      | ~150KB JS | ~30KB JS | 80%       |
| PRO       | ~200KB JS | ~50KB JS | 75%       |

### Performance Improvement

| Metric                       | Before | After  |
| ---------------------------- | ------ | ------ |
| Time to Interactive (Mobile) | 8-12s  | 1.5-2s |
| First Contentful Paint       | 3-5s   | 0.5-1s |
| Lighthouse Score             | 45     | 90+    |

### Component Distribution

| Category          | Before   | After    |
| ----------------- | -------- | -------- |
| Server Components | 23 (37%) | 54 (87%) |
| Client Components | 39 (63%) | 8 (13%)  |

---

## Key Files to Reference

When implementing, use these existing files as reference:

1. **Tier Validation**: `lib/tier-validation.ts`, `lib/tier-config.ts`, `lib/tier-helpers.ts`
2. **Session Management**: `lib/auth/session.ts`
3. **Database Access**: `lib/db/prisma.ts`
4. **Good Examples**:
   - `app/(dashboard)/alerts/page.tsx` (if already server)
   - `app/(dashboard)/settings/help/page.tsx`

---

## Commit Messages

Follow this pattern for commits:

```bash
# For converting a page
git commit -m "refactor: convert admin/page.tsx to Server Component pattern"

# For creating client wrappers
git commit -m "feat: add admin-client.tsx for interactive admin features"

# For loading skeletons
git commit -m "feat: add loading.tsx skeleton for admin routes"

# For bundle optimization
git commit -m "perf: implement dynamic imports for chart components"
```

---

## Troubleshooting

### Issue: "useState is not defined"

**Cause**: Using React hooks in Server Component
**Fix**: Move hook usage to a separate `*-client.tsx` file with `'use client'`

### Issue: "window is not defined"

**Cause**: Using browser APIs in Server Component
**Fix**: Add `'use client'` or use `typeof window !== 'undefined'` check

### Issue: "Cannot use import statement outside a module"

**Cause**: Next.js dynamic import with `ssr: false` in Server Component
**Fix**: Create a Client Component wrapper file

### Issue: Build shows ● (Client) for page that should be Server

**Cause**: Likely a parent layout has `'use client'`
**Fix**: Check all parent layouts and remove unnecessary `'use client'` directives

---

## Final Notes

1. **Don't rush** - Convert pages gradually, test each conversion
2. **Prioritize by traffic** - Convert high-traffic pages first for maximum impact
3. **Keep client components small** - Only what NEEDS interactivity
4. **Test on mobile** - Mobile users benefit most from bundle size reduction
5. **Document changes** - Update `frontend-ui-pages.md` as you convert pages

After completing this step, the frontend will be ready for Vercel deployment with optimized bundle sizes and improved performance metrics.

---

## Related Documentation

- `monolith-to-modular-monolith-migration/monolith-to-modular-monolith-migration.md` - Full migration guide
- `bundle-size-optimization/bundle-size-loading-optimization/bundle-optimization-architecture.md` - Architecture details
- `bundle-size-optimization/next-js-refactoring-for-bundle-size-reduction/refactoring-guide-for-converting-client-to-server-component-01012026.md` - Detailed refactoring patterns
- `docs/files-completion-list/frontend-ui-pages.md` - Complete list of frontend pages
- `docs/files-completion-list/test-files.md` - Test files for validation
