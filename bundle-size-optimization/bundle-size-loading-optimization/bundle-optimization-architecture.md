# Architecture Design Document

## Trading Alerts SaaS Public: Bundle Size Reduction & Performance Optimization

**Document Version**: 1.1  
**Date**: December 30, 2025  
**Author**: Architecture Team  
**Status**: Reference Document for Implementation

---

## Executive Summary

This document outlines the architecture design for reducing bundle size from 375MB to <200MB (ultimately <150MB) while optimizing load performance and infrastructure costs for Trading Alerts SaaS Public. The design employs a phased approach allowing continued feature development while preventing bundle size degradation and setting foundation for comprehensive optimization during stabilization phase.

**Key Metrics:**

- **Current State**: 375MB bundle size (exceeds 370MB CI/CD threshold)
- **Immediate Goal**: Maintain development velocity while preventing further growth
- **Stabilization Goal**: Reduce to <200MB with sub-2-second load times
- **Production Goal**: Achieve <150MB with 90+ Lighthouse scores

---

## 1. Problem Statement & Background

### 1.1 Current Situation

**Context:**

- Trading Alerts SaaS Public is in active development (Phase 3: Authentication & MT5 Integration)
- Next.js 15 frontend + Flask MT5 backend architecture
- Two-tier business model:
  - **FREE**: 5 symbols (BTCUSD, EURUSD, USDJPY, US30, XAUUSD), 3 timeframes (H1, H4, D1), 5 max alerts
  - **PRO**: 15 symbols (all FREE + 10 more), 9 timeframes (M5, M15, M30, H1, H2, H4, H8, H12, D1), 20 max alerts, $29/month or $290/year
  - 7-day free trial for PRO tier
  - Indicator access: FREE (basic: fractals, trendlines), PRO (all 8 indicators including momentum_candles, keltner_channels, tema, hrma, smma, zigzag)
- Deployment on Railway PostgreSQL with GitHub Actions CI/CD
- Solo developer using AI-orchestrated methodology (Claude Chat → Aider + MiniMax M2 → Claude Code)

**The Problem:**

```
CI/CD Pipeline Failure:
✗ Bundle size: 375MB
✗ Threshold: 370MB
✗ Status: Build failing
```

**Immediate Impact:**

- Cannot deploy new features
- CI/CD pipeline blocked
- Development velocity impaired

**Long-term Risks:**

1. **User Experience**: Slow load times reduce conversions (FREE → PRO upgrades)
2. **SEO Impact**: Poor Core Web Vitals hurt search rankings
3. **Infrastructure Costs**: Large bundles increase bandwidth costs
4. **Technical Debt**: Bad patterns compound exponentially during development
5. **Competitive Disadvantage**: Traders need fast, real-time platforms for 15 symbols across 9 timeframes

### 1.2 Root Causes Analysis

**Primary Contributors to 375MB Bundle:**

1. **Heavy Client-Side Rendering** (Est. 120-150MB)
   - Entire dashboard rendered client-side with `'use client'`
   - All 15 trading symbols loaded regardless of user tier
   - All 8 indicators loaded for both FREE and PRO users
   - React state management for data that could be server-fetched

2. **Visualization Libraries** (Est. 80-100MB)
   - Chart libraries (likely TradingView, Chart.js, or Recharts)
   - Loaded upfront even when not immediately needed
   - Multiple charting solutions (redundancy)

3. **Form & Validation Libraries** (Est. 40-50MB)
   - Client-side form libraries (react-hook-form, formik)
   - Validation libraries (yup, zod)
   - API client libraries for form submission

4. **Dependency Bloat** (Est. 30-50MB)
   - Unused dependencies from experimentation
   - Heavy alternatives (moment.js instead of date-fns)
   - Full library imports instead of tree-shaken imports

5. **Static Assets** (Est. 20-25MB)
   - Unoptimized images
   - Multiple font weights/variants
   - Icons loaded globally

### 1.3 Why Solution Must Be Implemented During Development

**Argument for Immediate Action:**

1. **Compounding Technical Debt**

   ```
   Week 1: 375MB → Bad pattern established
   Week 4: 450MB → Pattern replicated across 20 components
   Week 12: 600MB → Would require rewriting 60% of codebase
   ```

2. **Pattern Entrenchment**
   - Every new component following bad patterns multiplies refactoring cost
   - Client-side patterns become "the way we do things"
   - Later refactoring breaks working features (high risk)

3. **User Feedback Loss**
   - Current slow loads affecting FREE tier conversions (unknown impact)
   - Lost revenue that can't be measured until fixed
   - Competitive disadvantage in real-time trading space

4. **Cost Accumulation**
   - Every deploy consumes more bandwidth
   - Database queries could be cached but aren't
   - Flask backend handling requests that Next.js could cache

**Argument for Phased Approach (Not "Fix Everything Now"):**

1. **Development Velocity Critical**
   - Solo developer must maintain momentum
   - Authentication, payments, MT5 integration are business-critical
   - Premature optimization wastes effort if architecture changes

2. **Risk Management**
   - Full refactoring during active development = high breakage risk
   - Better to prevent worsening while continuing feature work
   - Comprehensive optimization when codebase stabilizes

3. **AI-Orchestrated Efficiency**
   - Aider + MiniMax M2 builds features efficiently
   - Context switching to optimization reduces effectiveness
   - Better to batch optimization work in dedicated phase

**Conclusion: Hybrid Approach Required**

✅ **NOW**: Prevent further degradation, set good defaults  
✅ **DURING DEVELOPMENT**: Use good patterns for new code  
✅ **STABILIZATION**: Comprehensive optimization refactoring

---

## 2. Architecture Design Principles

### 2.1 Core Principles

**P1: Zero-Bundle Server Components by Default**

- Server Components cost 0 bytes client-side
- Only use `'use client'` when absolutely necessary (interactivity, browser APIs)
- Read-only UI should never be client-side

**P2: Tier-Based Resource Allocation**

- FREE users receive minimal bundle (5 symbols, 3 timeframes, basic indicators only)
- PRO users receive full features (15 symbols, 9 timeframes, all 8 indicators - justified by $29/month revenue)
- No wasted bytes on features user can't access
- Indicator bundles loaded conditionally (basic vs all)

**P3: Progressive Enhancement**

- Core functionality works without JavaScript
- Enhancements load progressively (charts, animations)
- Fast initial paint, enhance later

**P4: Smart Caching Hierarchy**

- Static data cached indefinitely (symbol metadata)
- Slow-changing data cached with revalidation (alert history)
- Real-time data never cached (live alerts)
- Cache as close to user as possible (CDN → Full Route Cache → Data Cache)

**P5: Cost-Performance Balance**

- Optimization must reduce infrastructure costs
- Every MB saved = lower bandwidth costs
- Database queries reduced = lower Railway PostgreSQL costs
- FREE tier users should cost <$0.50/month

### 2.2 Architecture Constraints

**Technical Constraints:**

- Next.js 15 App Router (RSC architecture)
- Flask backend for MT5 integration (cannot change)
- Railway PostgreSQL (connection pooling limits)
- GitHub Actions CI/CD (build time limits)
- Vercel or similar deployment (bundle size limits)

**Business Constraints:**

- Solo developer (limited time for refactoring)
- Active development (features being added constantly)
- Two-tier model (FREE vs PRO feature gating)
- Real-time requirements (WebSocket for live alerts)

**Development Constraints:**

- AI-orchestrated workflow (Claude Chat → Aider → Claude Code)
- Cannot break existing features during optimization
- Must maintain test coverage
- Rollback strategy required

---

## 3. Rendering Strategy Architecture

### 3.1 Route-Level Rendering Decisions

**Framework: Match rendering mode to data characteristics**

| Data Characteristic          | Rendering Mode           | Example Routes              |
| ---------------------------- | ------------------------ | --------------------------- |
| Never changes                | **SSG**                  | Landing, Pricing, Docs      |
| Changes slowly (hours/days)  | **ISR** (3600s+)         | Symbol info, Trading hours  |
| Changes frequently (minutes) | **ISR** (60s)            | Alert history, Statistics   |
| User-specific                | **SSR**                  | Dashboard, Account settings |
| Real-time (seconds)          | **SSR + Streaming + WS** | Live alerts, MT5 status     |

**Route Classification for Trading Alerts SaaS Public:**

```typescript
// TIER 1: Static Site Generation (SSG)
// Build once at deploy time, serve from CDN
app/
  page.tsx                    // Landing page
  pricing/page.tsx            // Pricing comparison (FREE vs PRO)
  docs/**/*.tsx               // Documentation
  terms/page.tsx              // Terms of Service
  privacy/page.tsx            // Privacy Policy

// TIER 2: Incremental Static Regeneration (ISR)
// Pre-render, cache, regenerate periodically
app/
  symbols/[symbol]/page.tsx   // Symbol information (15 symbols, revalidate: 3600)
  alerts/history/[symbol].tsx // Alert history per symbol (revalidate: 60)
  performance/[symbol].tsx    // Performance stats per symbol (revalidate: 300)
  indicators/page.tsx         // Indicator catalog (8 indicators, revalidate: 3600)

// TIER 3: Server-Side Rendering (SSR)
// Generate per-request with Server Components
app/
  dashboard/page.tsx          // User dashboard (tier-specific: 5 or 15 symbols)
  account/settings/page.tsx   // Account settings
  subscription/page.tsx       // Subscription management (trial status)

// TIER 4: SSR + Streaming + WebSocket
// Real-time updates
app/
  alerts/live/page.tsx        // Live alert feed (filtered by tier)
  mt5/status/page.tsx         // MT5 connection status
  charts/[symbol]/[timeframe] // Dynamic charts (tier-gated combinations)
```

### 3.2 Server vs Client Component Strategy

**Decision Tree:**

```
Does component need interactivity? (onClick, onChange, useState)
├─ NO → Server Component (0 bytes client bundle)
└─ YES → Does it need browser APIs? (localStorage, window)
    ├─ NO → Can you use Server Actions instead?
    │   ├─ YES → Server Component + Server Actions (0 bytes client)
    │   └─ NO → Small Client Component
    └─ YES → Client Component (but minimize scope)
```

**Component Classification:**

**Server Components (FREE - 0 bytes):**

- Alert list displays
- Symbol information cards
- Statistics displays
- Historical data tables
- Navigation headers
- Footers and layouts
- Form layouts (use Server Actions)
- Loading skeletons

**Client Components (PAID - costs bundle size):**

- Subscribe/Unsubscribe toggle buttons
- Real-time WebSocket clients
- Interactive charts (lazy loaded)
- Mobile navigation menu
- Notification toasts
- Payment modals (lazy loaded)
- Filter dropdowns (if complex state)

**Pattern: Client Component Islands in Server Component Ocean**

```typescript
// app/dashboard/page.tsx - Server Component
export default async function Dashboard() {
  const tier = await getUserTier() // 'FREE' or 'PRO'
  const alerts = await fetchAlerts(tier) // Fetches for appropriate symbols

  return (
    <div>
      {/* Server Component - free */}
      <DashboardHeader tier={tier} />

      {/* Server Component - free */}
      <AlertList alerts={alerts}>
        {alerts.map(alert => (
          <AlertCard key={alert.id} alert={alert}>
            {/* Tiny Client Component island */}
            <SubscribeButton symbol={alert.symbol} />
          </AlertCard>
        ))}
      </AlertList>

      {/* Conditionally load indicators based on tier */}
      {tier === 'PRO' && (
        <IndicatorPanel indicators={['momentum_candles', 'keltner_channels']} />
      )}

      {/* Client Component for real-time updates */}
      <RealtimeUpdates /> {/* ~10KB WebSocket */}
    </div>
  )
}
```

### 3.3 Streaming & Suspense Architecture

**Principle: Show fast content immediately, stream slow content**

**Three-Layer Streaming Strategy:**

```typescript
// Layer 1: Instant Shell (Cached)
<DashboardLayout> {/* SSG/ISR cached shell */}
  <Header />
  <Navigation />

  // Layer 2: Fast Server Data (50-200ms)
  <Suspense fallback={<UserSkeleton />}>
    <UserInfo /> {/* Simple DB query */}
  </Suspense>

  // Layer 3: Slow Server Data (500ms+)
  <Suspense fallback={<AlertsSkeleton />}>
    <AlertHistory /> {/* Complex aggregation */}
  </Suspense>
</DashboardLayout>
```

**Granularity Decision:**

- **Coarse-grained** (2-3 Suspense boundaries): Simple UX, fewer loading states
- **Fine-grained** (5-10 Suspense boundaries): Better perceived performance, more complex

**For Trading Alerts SaaS Public: Coarse-grained**

```
1. User info + tier badge + trial status (fast)
2. FREE tier symbols (5 symbols: BTCUSD, EURUSD, USDJPY, US30, XAUUSD - medium)
3. PRO exclusive symbols (10 additional symbols - slow, PRO only)
4. Advanced indicators (PRO only - lazy loaded)
```

---

## 4. Component Architecture

### 4.1 Dynamic Import Strategy

**Rule: Components >50KB or conditionally used → Dynamic Import**

**Priority 1 (Immediate - High Impact):**

```typescript
// Chart components (est. 40-80MB savings)
const TradingChart = dynamic(() => import('@/components/TradingChart'), {
  loading: () => <ChartSkeleton />,
  ssr: false // Charts don't need SSR
})

// Symbol-specific components (est. 30-50MB savings)
// PRO exclusive symbols - 10 components
const AUDJPYCard = dynamic(() => import('@/components/symbols/AUDJPYCard'))
const AUDUSDCard = dynamic(() => import('@/components/symbols/AUDUSDCard'))
const ETHUSDCard = dynamic(() => import('@/components/symbols/ETHUSDCard'))
const GBPJPYCard = dynamic(() => import('@/components/symbols/GBPJPYCard'))
const GBPUSDCard = dynamic(() => import('@/components/symbols/GBPUSDCard'))
const NDX100Card = dynamic(() => import('@/components/symbols/NDX100Card'))
const NZDUSDCard = dynamic(() => import('@/components/symbols/NZDUSDCard'))
const USDCADCard = dynamic(() => import('@/components/symbols/USDCADCard'))
const USDCHFCard = dynamic(() => import('@/components/symbols/USDCHFCard'))
const XAGUSDCard = dynamic(() => import('@/components/symbols/XAGUSDCard'))

// PRO-only indicators (est. 20-30MB savings)
const MomentumCandles = dynamic(() => import('@/components/indicators/MomentumCandles'))
const KeltnerChannels = dynamic(() => import('@/components/indicators/KeltnerChannels'))
const TEMA = dynamic(() => import('@/components/indicators/TEMA'))
const HRMA = dynamic(() => import('@/components/indicators/HRMA'))
const SMMA = dynamic(() => import('@/components/indicators/SMMA'))
const ZigZag = dynamic(() => import('@/components/indicators/ZigZag'))

// Payment/Upgrade modal (est. 10-15MB savings)
const UpgradeModal = dynamic(() => import('@/components/UpgradeModal'))
const TrialBanner = dynamic(() => import('@/components/TrialBanner'))
```

**Priority 2 (Medium Impact):**

```typescript
// Advanced analytics (PRO only)
const AnalyticsDashboard = dynamic(() => import('@/components/Analytics'));

// Export functionality
const ExportDialog = dynamic(() => import('@/components/ExportDialog'));

// Admin tools
const AdminPanel = dynamic(() => import('@/components/AdminPanel'));
```

**Priority 3 (Polish):**

```typescript
// Heavy UI libraries
const RichTextEditor = dynamic(() => import('@/components/RichTextEditor'));

// 3D visualizations
const PerformanceChart3D = dynamic(() => import('@/components/3DChart'));
```

### 4.2 Tier-Based Lazy Loading

**Architecture Pattern: Load only what user can access**

```typescript
// app/dashboard/page.tsx
export default async function Dashboard() {
  const tier = await getUserTier()

  if (tier === 'FREE') {
    return (
      <>
        <XAUUSDAlerts /> {/* Always loaded */}
        <UpgradeCTA />   {/* Encourage PRO upgrade */}
      </>
    )
  }

  // PRO users: Progressive loading
  return (
    <>
      <XAUUSDAlerts /> {/* Priority 1 */}

      <Suspense fallback={<SymbolsSkeleton count={9} />}>
        <OtherSymbolsAlerts /> {/* Priority 2 */}
      </Suspense>

      <Suspense fallback={<ChartSkeleton />}>
        <AdvancedCharts /> {/* Priority 3 - dynamic import */}
      </Suspense>
    </>
  )
}
```

**Bundle Impact:**

| User Tier | Components Loaded       | Bundle Size |
| --------- | ----------------------- | ----------- |
| FREE      | XAUUSD + Core UI        | ~30-50MB    |
| PRO       | All 10 symbols + Charts | ~100-150MB  |

**Business Alignment:**

- FREE users cost minimal bandwidth (low margin acceptable, limited features encourage upgrades)
- PRO users get full experience (justified by $29/month or $290/year)
- 7-day trial allows users to experience full PRO features before commitment

### 4.3 Component File Structure

**Standard Structure:**

```
app/
  dashboard/
    page.tsx                  # Server Component entry point
    loading.tsx               # Loading skeleton
    error.tsx                 # Error boundary

    _components/              # Private components (not routable)
      AlertList.tsx           # Server Component
      AlertCard.tsx           # Server Component
      SubscribeButton.tsx     # Client Component ('use client')
      RealtimeUpdates.tsx     # Client Component (WebSocket)

    _actions/                 # Server Actions
      subscribe.ts            # 'use server'
      unsubscribe.ts          # 'use server'
```

**File Naming Convention:**

- Server Components: No special prefix
- Client Components: Add `'use client'` directive at top
- Server Actions: Files in `_actions/` folder

---

## 5. Data Fetching & Caching Architecture

### 5.1 Caching Hierarchy

**Four-Layer Cache Strategy (from fastest to slowest):**

```
1. Router Cache (Client)
   ↓ MISS
2. Full Route Cache (Server/CDN)
   ↓ MISS
3. Data Cache (Server)
   ↓ MISS
4. Database / Flask API
```

### 5.2 Data Classification & Cache TTL

**Cache Strategy Table:**

| Data Type           | Change Frequency | Cache Strategy | TTL              | Revalidation     |
| ------------------- | ---------------- | -------------- | ---------------- | ---------------- |
| Symbol metadata     | Rarely (weeks)   | force-cache    | Indefinite       | Manual           |
| Trading hours       | Weekly           | ISR            | 604800s (7 days) | Time-based       |
| Alert history       | Minutes          | ISR            | 60s              | Time-based + Tag |
| Live alerts         | Seconds          | no-store       | N/A              | Real-time WS     |
| User tier           | Session          | ISR            | 300s             | On-demand        |
| Subscription status | On change        | ISR            | 60s              | On-demand        |

**Implementation Patterns:**

```typescript
// 1. Force cache (static data)
export async function getSymbolMetadata(symbol: string) {
  return fetch(`/api/symbols/${symbol}/metadata`, {
    cache: 'force-cache' // Cache indefinitely
  })
}

// 2. Time-based revalidation (ISR)
export async function getAlertHistory(symbol: string) {
  return fetch(`/api/alerts/${symbol}/history`, {
    next: {
      revalidate: 60,  // Refresh every 60 seconds
      tags: [`alerts-${symbol}`]  // Allow on-demand revalidation
    }
  })
}

// 3. No cache (real-time)
export async function getLiveAlerts() {
  return fetch('/api/alerts/live', {
    cache: 'no-store'  // Never cache
  })
}

// 4. On-demand revalidation (after mutations)
// app/actions/subscribe.ts
'use server'
import { revalidateTag } from 'next/cache'

export async function subscribeToSymbol(symbol: string) {
  await db.subscriptions.create({...})
  revalidateTag(`alerts-${symbol}`)  // Clear cache
}
```

### 5.3 Request Deduplication

**Problem: Multiple components fetching same data**

```typescript
// Dashboard renders 5 components, all need XAUUSD alerts
<ComponentA /> // Fetches XAUUSD
<ComponentB /> // Fetches XAUUSD (duplicate!)
<ComponentC /> // Fetches XAUUSD (duplicate!)
// Result: 5 database queries for same data
```

**Solution: React cache() wrapper**

```typescript
// lib/data.ts
import { cache } from 'react';

export const getAlerts = cache(async (symbol: string) => {
  // React automatically deduplicates within single request
  return fetch(`/api/alerts/${symbol}`);
});

// Now all 5 components call getAlerts('XAUUSD') → Only 1 query
```

### 5.4 Parallel vs Sequential Fetching

**Anti-Pattern: Waterfall Requests**

```typescript
// ❌ BAD: 2500ms total
const tier = await getUserTier(); // 500ms, wait
const symbols = await getSymbols(tier); // 800ms, wait
const alerts = await getAlerts(symbols); // 1200ms, wait
```

**Best Practice: Parallel Fetching**

```typescript
// ✅ GOOD: 1200ms total (limited by slowest)
const [tier, xauusd, other] = await Promise.all([
  getUserTier(), // 500ms
  getAlerts('XAUUSD'), // 800ms  } parallel
  getAlerts('ALL'), // 1200ms }
]);
```

**Selective Parallelization:**

```typescript
// Fetch user data first (needed for authorization)
const user = await getUser();

// Then fetch content in parallel based on tier
const alerts =
  user.tier === 'PRO'
    ? await Promise.all([
        getAlerts('XAUUSD'),
        getAlerts('EURUSD'),
        // ... all 10 symbols in parallel
      ])
    : await getAlerts('XAUUSD');
```

---

## 6. Cost Optimization Architecture

### 6.1 Database Query Optimization

**Current Problem:**

- Every request hits Railway PostgreSQL
- Same queries repeated across users
- Static data queried dynamically

**Solution: Multi-Layer Caching**

**Layer 1: Next.js Data Cache**

```typescript
// Queries cached in Next.js, not hitting database
const symbolInfo = await fetch('/api/symbols/XAUUSD', {
  next: { revalidate: 3600 }, // Cached 1 hour
});
// First user: DB query (500ms)
// Next 1000 users: Cache hit (5ms)
```

**Layer 2: Database Connection Pooling**

```typescript
// lib/db.ts
import { Pool } from 'pg';

const pool = new Pool({
  max: 10, // Railway limit
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Reuse connections instead of creating new ones
```

**Layer 3: Query Optimization**

```typescript
// ❌ N+1 Query Problem
for (const symbol of symbols) {
  const alerts = await db.query('SELECT * FROM alerts WHERE symbol = $1', [
    symbol,
  ]);
}

// ✅ Single Batch Query
const alerts = await db.query('SELECT * FROM alerts WHERE symbol = ANY($1)', [
  symbols,
]);
```

**Expected Savings:**

- Database queries: -60%
- Railway PostgreSQL costs: -40%
- Query latency: -70%

### 6.2 Flask Backend Optimization

**Current Problem:**

- Next.js calls Flask for every request
- Flask handles queries that could be cached
- Unnecessary network round-trips

**Solution: Next.js Caching Layer**

```typescript
// lib/mt5-api.ts

export async function getMT5Symbols() {
  // Check Next.js cache first
  const cached = await fetch(`${FLASK_URL}/mt5/symbols`, {
    next: { revalidate: 86400 }, // Cache 24 hours
  });

  // Flask only called once per day, cached for all users
  return cached.json();
}

export async function getLivePrice(symbol: string) {
  // No cache - real-time data
  const response = await fetch(`${FLASK_URL}/mt5/price/${symbol}`, {
    cache: 'no-store',
  });
  return response.json();
}
```

**Impact:**

- Flask requests: -90% (most data cached)
- Flask can scale down (lower costs)
- Faster response times (cache hits)

### 6.3 CDN & Edge Optimization

**Strategy: Push static content to edge**

```typescript
// next.config.js
module.exports = {
  async headers() {
    return [
      {
        source: '/api/symbols/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=3600, stale-while-revalidate=7200',
          },
        ],
      },
    ];
  },
};
```

**Edge Functions for Auth:**

```typescript
// app/api/tier-check/route.ts
export const runtime = 'edge'; // Runs on Vercel Edge globally

export async function GET(request: Request) {
  const session = await getSession(request);
  return Response.json({ tier: session?.tier || 'FREE' });
}
```

**Benefits:**

- Auth checks run globally (low latency)
- Static API responses cached at edge
- Origin server load reduced

### 6.4 Bandwidth Optimization

**Image Optimization:**

```typescript
import Image from 'next/image'

<Image
  src="/chart.png"
  alt="Chart"
  width={800}
  height={400}
  quality={75}  // Balance quality vs size
  priority={false}  // Lazy load below fold
/>
```

**Font Subsetting:**

```typescript
// app/layout.tsx
import { Inter } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'], // Only Latin characters
  display: 'swap',
  preload: true,
});
```

**Compression:**

- Next.js automatically serves Brotli/Gzip
- Images converted to WebP/AVIF
- ~60% bandwidth savings

---

## 7. Phased Implementation Strategy

### Phase 0: Damage Control (Week 1)

**Goal**: Unblock CI/CD, prevent further degradation  
**Bundle Target**: 375MB → 340MB

**Actions:**

1. Install bundle analyzer (visibility)
2. Implement top 3 dynamic imports (charts, payment, symbols)
3. Remove obvious unused dependencies
4. Set monitoring (warning-only, doesn't block)
5. Convert landing/pricing to SSG (quick win)

**Deliverables:**

- CI/CD passing
- Bundle monitoring active
- Good patterns documented

### Phase 1: Smart Defaults (Weeks 2-8, During Development)

**Goal**: Don't make it worse  
**Bundle Target**: Maintain <450MB

**Principles:**

- New heavy components use dynamic imports
- New static pages use SSG
- Forms use Server Actions (not client libraries)
- Monthly bundle health checks

**No Refactoring:**

- Don't touch working dashboard code
- Don't migrate existing forms
- Don't restructure data fetching

**Outcome:**

- Development continues unimpeded
- Bundle growth controlled
- Foundation set for Phase 2

### Phase 2: Quick Wins (Week 9, Feature Freeze)

**Goal**: Low-hanging fruit before full optimization  
**Bundle Target**: 450MB → 300MB

**Actions (1 week):**

1. Convert all marketing pages to SSG (2 days)
2. Dynamic imports for existing components (2 days)
3. Dependency cleanup audit (1 day)
4. Image/font optimization (1 day)

**Safe Because:**

- No architectural changes
- Marketing pages already static content
- Dynamic imports don't change logic

### Phase 3: Full Optimization (Weeks 10-13, Stabilization)

**Goal**: Production-ready performance  
**Bundle Target**: 300MB → 100-150MB

**Major Refactoring:**

1. Dashboard → Server Components migration (Week 10)
2. ISR for alert history routes (Week 11)
3. Streaming + Suspense implementation (Week 11)
4. Server Actions for all forms (Week 12)
5. Caching strategy deployment (Week 12)
6. Performance testing + tuning (Week 13)

**High Risk:**

- Changes working code
- Requires comprehensive testing
- Rollback plan essential

### Phase 4: Monitoring & Iteration (Ongoing)

**Goal**: Maintain performance, continuous improvement  
**Bundle Target**: <200MB sustained

**Activities:**

- Weekly bundle size checks
- Monthly performance audits
- Cost analysis dashboards
- A/B testing of optimizations

---

## 8. Success Metrics

### 8.1 Bundle Size Metrics

| Phase   | Target | Threshold | Hard Limit |
| ------- | ------ | --------- | ---------- |
| Phase 0 | 340MB  | 450MB     | 500MB      |
| Phase 1 | <450MB | 450MB     | 500MB      |
| Phase 2 | 300MB  | 370MB     | 450MB      |
| Phase 3 | 150MB  | 200MB     | 250MB      |
| Phase 4 | <150MB | 200MB     | 250MB      |

**Measurement:**

```bash
# Automated in CI/CD
BUNDLE_SIZE=$(du -sm .next | cut -f1)
```

### 8.2 Performance Metrics (Lighthouse)

**Targets:**

- Performance Score: 90+
- First Contentful Paint: <1.8s
- Largest Contentful Paint: <2.5s
- Time to Interactive: <3.5s
- Cumulative Layout Shift: <0.1

**By Route Type:**

| Route Type      | LCP Target | TTI Target |
| --------------- | ---------- | ---------- |
| SSG (Landing)   | <1.0s      | <1.5s      |
| ISR (History)   | <1.5s      | <2.0s      |
| SSR (Dashboard) | <2.0s      | <3.0s      |

### 8.3 Cost Metrics

**Infrastructure Costs:**

| Resource             | Current | Target | Savings |
| -------------------- | ------- | ------ | ------- |
| Database queries/day | 100K    | 40K    | -60%    |
| Bandwidth/month      | 500GB   | 300GB  | -40%    |
| Flask requests/day   | 50K     | 5K     | -90%    |

**Cost per User:**

| Tier | Current | Target       | Notes                   |
| ---- | ------- | ------------ | ----------------------- |
| FREE | Unknown | <$0.50/month | Incentivize PRO upgrade |
| PRO  | Unknown | <$5/month    | 83% margin on $29/month |

### 8.4 Business Metrics

**Conversion Impact:**

- FREE → PRO conversion rate baseline
- Target: +10-20% improvement post-optimization
- Hypothesis: Faster load = more trust = more upgrades

**SEO Impact:**

- Google Search Console rankings
- Core Web Vitals improvements
- Organic traffic growth

---

## 9. Risk Mitigation

### 9.1 Development Risks

**Risk: Breaking existing features during refactoring**

Mitigation:

- Comprehensive test coverage before Phase 3
- Feature flags for gradual rollout
- Rollback plan for every major change

**Risk: Bundle size increasing during Phase 1**

Mitigation:

- Weekly monitoring
- Hard limit at 500MB (CI fails)
- Monthly review of top contributors

**Risk: Optimization not delivering expected results**

Mitigation:

- Baseline metrics before each phase
- A/B testing of major changes
- Incremental rollout with monitoring

### 9.2 Rollback Strategies

**Phase 0-1: Low Risk**

- Simple git revert
- No architectural changes
- Can roll back individual commits

**Phase 2: Medium Risk**

- Feature flags for SSG pages
- Keep old routes during transition
- Gradual traffic shifting

**Phase 3: High Risk**

```typescript
// Feature flag pattern
const USE_NEW_DASHBOARD = process.env.NEXT_PUBLIC_NEW_DASHBOARD === 'true'

export default async function DashboardRoute() {
  if (USE_NEW_DASHBOARD) {
    return <NewServerComponentDashboard />
  }
  return <OldClientDashboard />
}
```

**Rollback Procedure:**

1. Disable feature flag
2. Redeploy previous stable version
3. Investigate issue
4. Fix forward or stay on old version

### 9.3 Performance Monitoring

**Real-User Monitoring (RUM):**

```typescript
// app/layout.tsx
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
```

**Alert Thresholds:**

- Bundle size >200MB → Slack notification
- LCP >3s for 5% of users → Investigate
- Database queries spike +50% → Alert

---

## 10. Conclusion

This architecture design provides a comprehensive, phased approach to reducing bundle size from 375MB to <150MB while maintaining development velocity and optimizing costs.

**Key Takeaways:**

1. **Hybrid Approach**: Immediate damage control + long-term optimization
2. **Server-First**: Leverage Server Components for 0-byte client bundles
3. **Smart Caching**: Multi-layer strategy from CDN to database
4. **Tier-Based**: FREE users get minimal bundle, PRO gets full experience
5. **Measurable**: Clear metrics at every phase

**Next Steps:**

1. Review this architecture design
2. Proceed to Implementation Plan document
3. Begin Phase 0 implementation with Claude Code
4. Maintain weekly progress reviews

**Success Criteria:**

✅ CI/CD pipeline unblocked  
✅ Bundle size <150MB  
✅ Load times <2s  
✅ Lighthouse score 90+  
✅ Infrastructure costs -50%  
✅ Development velocity maintained

---

**Document Control:**

- **Review Cycle**: Monthly during implementation
- **Updates**: As new optimizations discovered
- **Ownership**: Architecture team
- **Related Documents**: Implementation Plan (separate document)

**Important Notes:**

- Tier system implemented in `lib/tier-config.ts`, `lib/tier-validation.ts`, `lib/tier-helpers.ts`, and `lib/tier/` directory
- Symbol and timeframe constants defined in `types/tier.ts`
- Indicator tier system in `lib/tier/constants.ts` and `lib/tier/validator.ts`
- All tier validation functions already exist - use them for access control
- Trial system supports 7-day free PRO access with automatic expiration handling
