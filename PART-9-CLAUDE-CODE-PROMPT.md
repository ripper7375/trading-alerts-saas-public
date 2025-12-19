# Part 9: Charts & Visualization - Claude Code Build Prompt

**Project:** Trading Alerts SaaS V7
**Task:** Build Part 9 (Charts & Visualization) autonomously
**Files to Build:** 8 files
**Estimated Time:** 4 hours
**Current Status:** Parts 6, 7 & 8 complete and merged to main

---

## 🎯 YOUR MISSION

You are Claude Code, tasked with building **Part 9: Charts & Visualization** for the Trading Alerts SaaS V7 project. You will build 8 files autonomously following all project policies, architecture rules, and quality standards.

**Your approach:**

1. Read ALL essential files listed below (policies, architecture, requirements)
2. Build files one-by-one in the specified order
3. Follow coding patterns from policy files
4. Validate each file after creation (TypeScript, ESLint, Prettier)
5. Commit each file individually with descriptive commit messages
6. Test the charts page after all files are built

---

## 📋 ESSENTIAL FILES TO READ FIRST

**CRITICAL:** Read these files in order before writing any code. These files contain the "AI constitution" that guides all development.

### 1️⃣ **Project Overview & Current State**

```
PROGRESS.md                  # Current project status (Parts 6-8 complete)
README.md                    # Project overview
ARCHITECTURE.md              # System architecture and design patterns
IMPLEMENTATION-GUIDE.md      # Implementation best practices
```

### 2️⃣ **Policy Files (MUST READ - These are your rules)**

```
docs/policies/00-tier-specifications.md              # FREE vs PRO tier rules (CRITICAL for charts)
docs/policies/01-approval-policies.md                # When to approve/fix/escalate
docs/policies/02-quality-standards.md                # TypeScript, error handling standards
docs/policies/03-architecture-rules.md               # File structure, architecture patterns
docs/policies/04-escalation-triggers.md              # When to ask for human help
docs/policies/05-coding-patterns.md                  # Copy-paste ready code patterns
docs/policies/06-aider-instructions.md               # Build workflow instructions
```

### 3️⃣ **Part 9 Requirements & Build Order**

```
docs/build-orders/part-09-charts.md                  # Build order for all 8 files
docs/implementation-guides/v5_part_i.md              # Detailed specifications for charts
```

### 4️⃣ **OpenAPI Specifications**

```
docs/trading_alerts_openapi.yaml                     # Next.js API contracts
docs/flask_mt5_openapi.yaml                          # Flask MT5 API contracts
```

### 5️⃣ **Seed Code References (CRITICAL - Use these patterns)**

```
seed-code/v0-components/trading-chart-component/components/trading-chart.tsx   # Main chart component
seed-code/v0-components/chart-controls-component/components/chart-controls.tsx # Controls component
seed-code/v0-components/chart-controls-component/components/symbol-selector.tsx
seed-code/v0-components/chart-controls-component/components/timeframe-selector.tsx
seed-code/v0-components/chart-controls-component/components/upgrade-modal.tsx
```

### 6️⃣ **Validation & Testing**

```
VALIDATION-SETUP-GUIDE.md                            # Validation tools and process
CLAUDE.md                                            # Automated validation guide
```

### 7️⃣ **Previous Work (for context and dependencies)**

```
docs/build-orders/part-04-tier-system.md             # Tier system (DEPENDENCY)
docs/build-orders/part-07-indicators-api.md          # Indicators API (DEPENDENCY - charts use this)
docs/build-orders/part-08-dashboard.md               # Dashboard layout (Part 8 complete)
```

---

## 📦 PART 9 - FILES TO BUILD (In Order)

Build these 8 files in sequence:

### **File 1/8:** `app/(dashboard)/charts/page.tsx`

- Charts page with symbol/timeframe selectors
- Tier-filtered symbol list (5 for FREE, 15 for PRO)
- Tier-filtered timeframe list (3 for FREE, 9 for PRO)
- Redirect to default chart (XAUUSD/H1)
- Show upgrade prompt for FREE users
- **Dependencies:** Uses session from Part 5 authentication
- **Commit:** `feat(charts): add charts page with tier filtering`

### **File 2/8:** `app/(dashboard)/charts/[symbol]/[timeframe]/page.tsx`

- Individual chart page with dynamic routing
- Validate tier access to symbol AND timeframe combination
- Return 403 if user tier doesn't allow access
- Load trading-chart component
- Show indicator overlays
- **Commit:** `feat(charts): add dynamic chart page with tier validation`

### **File 3/8:** `components/charts/trading-chart.tsx`

- TradingView Lightweight Charts integration
- Load candlestick data from `/api/indicators/[symbol]/[timeframe]`
- Overlay indicators (fractal horizontal/diagonal lines)
- Real-time updates via polling or WebSocket
- Dark theme matching TradingView aesthetic
- **Reference Seed Code:** `seed-code/v0-components/trading-chart-component/components/trading-chart.tsx`
- **Commit:** `feat(charts): add TradingView chart component`

### **File 4/8:** `components/charts/indicator-overlay.tsx`

- Render indicator lines on chart
- Support/resistance horizontal lines
- Diagonal trend lines
- Peak/bottom fractal markers
- Color-coded by line type (P-P1 red, B-B1 green)
- **Commit:** `feat(charts): add indicator overlay component`

### **File 5/8:** `components/charts/chart-controls.tsx`

- Symbol selector (tier-filtered)
- Timeframe selector (tier-filtered)
- Refresh button with loading state
- Last updated timestamp
- Export button (PRO only)
- **Reference Seed Code:** `seed-code/v0-components/chart-controls-component/components/chart-controls.tsx`
- **Commit:** `feat(charts): add chart controls with tier filtering`

### **File 6/8:** `components/charts/timeframe-selector.tsx`

- Timeframe button group
- Disable PRO timeframes for FREE users (M5, M15, M30, H2, H8, H12)
- Show lock icon and upgrade prompt on disabled options
- Highlight active timeframe
- **Reference Seed Code:** `seed-code/v0-components/chart-controls-component/components/timeframe-selector.tsx`
- **Commit:** `feat(charts): add timeframe selector with tier gates`

### **File 7/8:** `hooks/use-indicators.ts`

- React hook for fetching indicator data
- Call `/api/indicators/[symbol]/[timeframe]`
- Handle loading, error, and success states
- Include tier validation before fetch
- Automatic refetch interval (60s FREE, 30s PRO)
- **Commit:** `feat(charts): add indicators data hook`

### **File 8/8:** `hooks/use-auth.ts`

- React hook for auth session
- Get user tier from session
- Check if authenticated
- Provide tier-based helper functions
- **Commit:** `feat(auth): add auth session hook`

---

## 🔧 GIT WORKFLOW

### **Branch Strategy**

```bash
# Create new branch (MUST start with 'claude/' and end with session ID)
git checkout -b claude/charts-visualization-{SESSION_ID}

# Build files one by one, commit each file individually
# After all 8 files complete:
git push -u origin claude/charts-visualization-{SESSION_ID}
```

### **Commit Message Format**

Use conventional commits:

```
feat(charts): add charts page with tier filtering
feat(charts): add dynamic chart page with tier validation
feat(charts): add TradingView chart component
fix(charts): correct TypeScript type error in indicator overlay
```

### **Push Requirements**

- ✅ Branch MUST start with `claude/`
- ✅ Branch MUST end with session ID
- ✅ Push ONLY after all validations pass
- ✅ Create PR after push (do NOT merge to main directly)

---

## ✅ VALIDATION REQUIREMENTS

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

- ✅ 0 TypeScript errors
- ✅ 0 ESLint errors (warnings OK if < 3)
- ✅ All files properly formatted
- ✅ No unused imports
- ✅ All functions have return types

---

## 🎯 KEY REQUIREMENTS FOR PART 9

### **1. Tier-Based Access Control (CRITICAL)**

This is the MOST IMPORTANT requirement for Part 9.

**FREE Tier Limits:**

- Symbols: 5 (BTCUSD, EURUSD, USDJPY, US30, XAUUSD)
- Timeframes: 3 (H1, H4, D1)
- Chart combinations: 15 total

**PRO Tier Access:**

- Symbols: 15 (AUDJPY, AUDUSD, BTCUSD, ETHUSD, EURUSD, GBPJPY, GBPUSD, NDX100, NZDUSD, US30, USDCAD, USDCHF, USDJPY, XAGUSD, XAUUSD)
- Timeframes: 9 (M5, M15, M30, H1, H2, H4, H8, H12, D1)
- Chart combinations: 135 total

**Validation Rules:**

- ❌ FREE tier CANNOT access PRO-only symbols
- ❌ FREE tier CANNOT access PRO-only timeframes (M5, M15, M30, H2, H8, H12)
- ✅ Chart access requires BOTH symbol AND timeframe validation
- ✅ Show upgrade prompt when accessing locked features

### **2. TypeScript Compliance (CRITICAL)**

- ✅ NO `any` types allowed
- ✅ All function parameters typed
- ✅ All return types specified
- ✅ Import types from generated OpenAPI types where applicable
- ✅ Use proper React types (`FC`, `ReactNode`, etc.)

### **3. TradingView Lightweight Charts**

- ✅ Use `lightweight-charts` package (v4.x)
- ✅ Dark theme colors matching TradingView:
  - Background: `#1e222d`
  - Text: `#d1d4dc`
  - Grid: `#2a2e39`
  - Bullish candles: `#00c853` (green)
  - Bearish candles: `#f23645` (red)
- ✅ Candlestick series for OHLC data
- ✅ Line series for indicator overlays
- ✅ Proper resize handling

### **4. Data Fetching from Indicators API**

- ✅ Call `/api/indicators/{symbol}/{timeframe}` endpoint
- ✅ Handle loading, error, and success states
- ✅ Cache data appropriately
- ✅ Automatic refresh (60s FREE, 30s PRO)
- ✅ Display "Data from: X seconds ago" indicator

### **5. Error Handling**

- ✅ Try-catch blocks in async operations
- ✅ User-friendly error messages
- ✅ Loading states for chart rendering
- ✅ Fallback UI for errors
- ✅ Handle 403 (tier access denied) gracefully

### **6. Responsive Design**

- ✅ Chart resizes with container
- ✅ Mobile-friendly controls
- ✅ Use Tailwind responsive classes (`sm:`, `md:`, `lg:`)

---

## 🧪 TESTING REQUIREMENTS

After building all 8 files:

### **1. Start Development Server**

```bash
npm run dev
# Should start on http://localhost:3000
```

### **2. Manual Testing Checklist**

- [ ] Visit `http://localhost:3000/charts`
- [ ] Verify charts page loads without errors
- [ ] Check symbol selector shows tier-appropriate options
- [ ] Check timeframe selector shows tier-appropriate options
- [ ] Verify locked PRO options show upgrade prompt
- [ ] Click on a symbol/timeframe to navigate to chart
- [ ] Visit `http://localhost:3000/charts/XAUUSD/H1`
- [ ] Verify TradingView chart renders correctly
- [ ] Check candlestick data loads from API
- [ ] Verify indicator overlays display
- [ ] Test chart refresh button
- [ ] Test tier access: FREE user cannot access `/charts/AUDJPY/M5`
- [ ] Test responsive layout on mobile/tablet/desktop

### **3. Console Checks**

- [ ] No console errors
- [ ] No React hydration warnings
- [ ] No missing key props warnings
- [ ] API calls return 200 status

### **4. TypeScript Build**

```bash
npm run build
# Should complete with 0 errors
```

---

## 📝 CODING PATTERNS TO FOLLOW

### **Pattern 1: Tier Constants (Use Exact Values)**

```typescript
// lib/tier-config.ts or directly in components

export const FREE_SYMBOLS = [
  'BTCUSD',
  'EURUSD',
  'USDJPY',
  'US30',
  'XAUUSD',
] as const;

export const PRO_SYMBOLS = [
  'AUDJPY',
  'AUDUSD',
  'BTCUSD',
  'ETHUSD',
  'EURUSD',
  'GBPJPY',
  'GBPUSD',
  'NDX100',
  'NZDUSD',
  'US30',
  'USDCAD',
  'USDCHF',
  'USDJPY',
  'XAGUSD',
  'XAUUSD',
] as const;

export const FREE_TIMEFRAMES = ['H1', 'H4', 'D1'] as const;

export const PRO_TIMEFRAMES = [
  'M5',
  'M15',
  'M30',
  'H1',
  'H2',
  'H4',
  'H8',
  'H12',
  'D1',
] as const;

export type UserTier = 'FREE' | 'PRO';

export function getSymbolsForTier(tier: UserTier): readonly string[] {
  return tier === 'PRO' ? PRO_SYMBOLS : FREE_SYMBOLS;
}

export function getTimeframesForTier(tier: UserTier): readonly string[] {
  return tier === 'PRO' ? PRO_TIMEFRAMES : FREE_TIMEFRAMES;
}

export function canAccessSymbol(tier: UserTier, symbol: string): boolean {
  const symbols = getSymbolsForTier(tier);
  return symbols.includes(symbol as any);
}

export function canAccessTimeframe(tier: UserTier, timeframe: string): boolean {
  const timeframes = getTimeframesForTier(tier);
  return timeframes.includes(timeframe as any);
}
```

### **Pattern 2: Charts Page with Tier Filtering**

```typescript
// app/(dashboard)/charts/page.tsx
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { redirect } from 'next/navigation';
import { getSymbolsForTier, getTimeframesForTier } from '@/lib/tier-config';
import { ChartControls } from '@/components/charts/chart-controls';

export default async function ChartsPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/auth/login');
  }

  const tier = (session.user.tier as 'FREE' | 'PRO') || 'FREE';
  const symbols = getSymbolsForTier(tier);
  const timeframes = getTimeframesForTier(tier);

  // Default redirect to first available chart
  const defaultSymbol = symbols[0];
  const defaultTimeframe = timeframes[0];

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-2xl font-bold mb-6">Trading Charts</h1>

      {tier === 'FREE' && (
        <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm text-amber-800">
            <strong>Upgrade to PRO</strong> to access all 15 symbols, 9 timeframes, and faster updates.
          </p>
        </div>
      )}

      <ChartControls
        userTier={tier}
        symbols={symbols as string[]}
        timeframes={timeframes as string[]}
        defaultSymbol={defaultSymbol}
        defaultTimeframe={defaultTimeframe}
      />
    </div>
  );
}
```

### **Pattern 3: Dynamic Chart Page with Tier Validation**

```typescript
// app/(dashboard)/charts/[symbol]/[timeframe]/page.tsx
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { redirect, notFound } from 'next/navigation';
import { canAccessSymbol, canAccessTimeframe, PRO_SYMBOLS, PRO_TIMEFRAMES } from '@/lib/tier-config';
import { TradingChart } from '@/components/charts/trading-chart';
import { ChartControls } from '@/components/charts/chart-controls';
import Link from 'next/link';

interface ChartPageProps {
  params: {
    symbol: string;
    timeframe: string;
  };
}

export default async function ChartPage({ params }: ChartPageProps) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/auth/login');
  }

  const { symbol, timeframe } = params;
  const tier = (session.user.tier as 'FREE' | 'PRO') || 'FREE';

  // Validate symbol exists
  if (!PRO_SYMBOLS.includes(symbol as any)) {
    notFound();
  }

  // Validate timeframe exists
  if (!PRO_TIMEFRAMES.includes(timeframe as any)) {
    notFound();
  }

  // Check tier access
  const hasSymbolAccess = canAccessSymbol(tier, symbol);
  const hasTimeframeAccess = canAccessTimeframe(tier, timeframe);

  if (!hasSymbolAccess || !hasTimeframeAccess) {
    return (
      <div className="container mx-auto py-6">
        <div className="max-w-md mx-auto text-center p-8 bg-white rounded-lg shadow">
          <h2 className="text-xl font-bold text-red-600 mb-4">Access Denied</h2>
          <p className="text-gray-600 mb-4">
            {!hasSymbolAccess && `The symbol ${symbol} is not available in your ${tier} tier.`}
            {!hasTimeframeAccess && `The ${timeframe} timeframe is not available in your ${tier} tier.`}
          </p>
          <Link
            href="/pricing"
            className="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Upgrade to PRO
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <ChartControls
        userTier={tier}
        selectedSymbol={symbol}
        selectedTimeframe={timeframe}
      />

      <TradingChart
        symbol={symbol}
        timeframe={timeframe}
        tier={tier}
      />
    </div>
  );
}
```

### **Pattern 4: TradingChart Component**

```typescript
// components/charts/trading-chart.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { createChart, IChartApi, ISeriesApi, UTCTimestamp } from 'lightweight-charts';
import { useIndicators } from '@/hooks/use-indicators';

interface TradingChartProps {
  symbol: string;
  timeframe: string;
  tier: 'FREE' | 'PRO';
}

export function TradingChart({ symbol, timeframe, tier }: TradingChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);

  const { data, isLoading, error, refetch } = useIndicators(symbol, timeframe);

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 600,
      layout: {
        background: { color: '#1e222d' },
        textColor: '#d1d4dc',
      },
      grid: {
        vertLines: { color: '#2a2e39' },
        horzLines: { color: '#2a2e39' },
      },
      crosshair: { mode: 1 },
      rightPriceScale: { borderColor: '#2a2e39' },
      timeScale: {
        borderColor: '#2a2e39',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#00c853',
      downColor: '#f23645',
      borderVisible: false,
      wickUpColor: '#00c853',
      wickDownColor: '#f23645',
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);

  // Update chart data
  useEffect(() => {
    if (!data?.data?.ohlc || !candleSeriesRef.current) return;

    candleSeriesRef.current.setData(data.data.ohlc);

    // Add indicator overlays
    if (data.data.horizontal && chartRef.current) {
      // Add resistance lines (red)
      // Add support lines (green)
    }
  }, [data]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[600px] bg-[#1e222d] rounded-lg">
        <div className="text-[#d1d4dc]">Loading chart...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[600px] bg-[#1e222d] rounded-lg">
        <div className="text-red-500">{error.message || 'Error loading chart'}</div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div ref={chartContainerRef} className="rounded-lg overflow-hidden" />
    </div>
  );
}
```

### **Pattern 5: useIndicators Hook**

```typescript
// hooks/use-indicators.ts
import { useQuery } from '@tanstack/react-query';
import { useAuth } from './use-auth';

interface IndicatorData {
  success: boolean;
  data: {
    ohlc: Array<{
      time: number;
      open: number;
      high: number;
      low: number;
      close: number;
    }>;
    horizontal: Record<string, Array<{ time: number; value: number }>>;
    diagonal: Record<string, Array<{ time: number; value: number }>>;
    fractals: {
      peaks: Array<{ time: number; value: number }>;
      bottoms: Array<{ time: number; value: number }>;
    };
  };
  cached: boolean;
}

export function useIndicators(symbol: string, timeframe: string) {
  const { tier } = useAuth();

  // Refresh interval based on tier
  const refetchInterval = tier === 'PRO' ? 30000 : 60000;

  return useQuery<IndicatorData>({
    queryKey: ['indicators', symbol, timeframe],
    queryFn: async () => {
      const res = await fetch(`/api/indicators/${symbol}/${timeframe}`);

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to fetch indicators');
      }

      return res.json();
    },
    refetchInterval,
    staleTime: refetchInterval / 2,
  });
}
```

### **Pattern 6: useAuth Hook**

```typescript
// hooks/use-auth.ts
'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export function useAuth() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const isLoading = status === 'loading';
  const isAuthenticated = status === 'authenticated';
  const tier = (session?.user?.tier as 'FREE' | 'PRO') || 'FREE';
  const userId = session?.user?.id;
  const userEmail = session?.user?.email;

  return {
    session,
    status,
    isLoading,
    isAuthenticated,
    tier,
    userId,
    userEmail,
  };
}

export function useRequireAuth(redirectUrl = '/auth/login') {
  const { isLoading, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push(redirectUrl);
    }
  }, [isLoading, isAuthenticated, router, redirectUrl]);

  return { isLoading, isAuthenticated };
}
```

### **Pattern 7: Timeframe Selector with Tier Gates**

```typescript
// components/charts/timeframe-selector.tsx
'use client';

import { FREE_TIMEFRAMES, PRO_TIMEFRAMES, UserTier } from '@/lib/tier-config';
import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TimeframeSelectorProps {
  userTier: UserTier;
  selectedTimeframe: string;
  onTimeframeChange: (timeframe: string) => void;
  onUpgradeClick?: () => void;
}

export function TimeframeSelector({
  userTier,
  selectedTimeframe,
  onTimeframeChange,
  onUpgradeClick,
}: TimeframeSelectorProps) {
  const allowedTimeframes = userTier === 'PRO' ? PRO_TIMEFRAMES : FREE_TIMEFRAMES;

  return (
    <div className="flex flex-wrap gap-2">
      {PRO_TIMEFRAMES.map((tf) => {
        const isAllowed = allowedTimeframes.includes(tf);
        const isSelected = tf === selectedTimeframe;

        return (
          <button
            key={tf}
            onClick={() => {
              if (isAllowed) {
                onTimeframeChange(tf);
              } else {
                onUpgradeClick?.();
              }
            }}
            disabled={!isAllowed}
            className={cn(
              'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
              isSelected && isAllowed && 'bg-blue-600 text-white',
              !isSelected && isAllowed && 'bg-gray-100 hover:bg-gray-200 text-gray-700',
              !isAllowed && 'bg-gray-50 text-gray-400 cursor-not-allowed'
            )}
          >
            <span className="flex items-center gap-1">
              {tf}
              {!isAllowed && <Lock className="h-3 w-3" />}
            </span>
          </button>
        );
      })}
    </div>
  );
}
```

---

## 🚨 CRITICAL RULES

### **DO:**

- ✅ Read ALL policy files before writing code
- ✅ Follow tier-based access control EXACTLY as specified
- ✅ Use TypeScript strictly (no `any` types)
- ✅ Reference seed code for component patterns
- ✅ Validate after each file
- ✅ Commit each file individually
- ✅ Use shadcn/ui components consistently
- ✅ Test thoroughly before pushing
- ✅ Use TradingView Lightweight Charts (v4.x)

### **DON'T:**

- ❌ Skip reading policy files
- ❌ Use `any` types
- ❌ Allow FREE users to access PRO features
- ❌ Commit multiple files at once (commit one-by-one)
- ❌ Push without validation passing
- ❌ Hardcode tier logic (use constants from tier-config)
- ❌ Create components from scratch if seed code exists
- ❌ Push to main branch directly (use feature branch)
- ❌ Skip testing

---

## 🎯 SUCCESS CRITERIA

Part 9 is complete when:

- ✅ All 8 files created and committed
- ✅ All TypeScript validations pass (0 errors)
- ✅ All ESLint checks pass
- ✅ Charts page loads at `/charts` without errors
- ✅ Individual chart pages work at `/charts/[symbol]/[timeframe]`
- ✅ TradingView chart renders with candlestick data
- ✅ Indicator overlays display correctly
- ✅ Tier filtering works correctly (FREE vs PRO)
- ✅ Symbol/timeframe selectors work
- ✅ Locked features show upgrade prompts
- ✅ All manual tests pass
- ✅ Code pushed to feature branch
- ✅ PR created (ready for review)

---

## 📊 PROGRESS TRACKING

Use the TodoWrite tool to track your progress:

```
1. Read all policy and architecture files
2. Build File 1/8: app/(dashboard)/charts/page.tsx
3. Build File 2/8: app/(dashboard)/charts/[symbol]/[timeframe]/page.tsx
4. Build File 3/8: components/charts/trading-chart.tsx
5. Build File 4/8: components/charts/indicator-overlay.tsx
6. Build File 5/8: components/charts/chart-controls.tsx
7. Build File 6/8: components/charts/timeframe-selector.tsx
8. Build File 7/8: hooks/use-indicators.ts
9. Build File 8/8: hooks/use-auth.ts
10. Run full validation suite
11. Test charts manually
12. Push to feature branch
13. Create pull request
```

---

## 🚀 START HERE

1. **First, read these files in order:**
   - `PROGRESS.md` - Understand current state
   - `docs/policies/00-tier-specifications.md` - Learn tier system (CRITICAL)
   - `docs/policies/05-coding-patterns.md` - Learn code patterns
   - `docs/build-orders/part-09-charts.md` - Understand Part 9
   - `docs/implementation-guides/v5_part_i.md` - Detailed specs
   - `seed-code/v0-components/trading-chart-component/` - Reference chart code

2. **Then, create your git branch:**

   ```bash
   git checkout main
   git pull origin main
   git checkout -b claude/charts-visualization-{SESSION_ID}
   ```

3. **Start building File 1/8:**
   - Read the build order for File 1
   - Reference seed code if needed
   - Write the file following patterns
   - Validate: `npm run validate`
   - Fix any issues: `npm run fix`
   - Commit: `git commit -m "feat(charts): add charts page with tier filtering"`

4. **Repeat for Files 2-8**

5. **After all files complete:**
   - Run final validation
   - Test manually
   - Push to remote
   - Create PR

---

## 💬 WHEN TO ASK FOR HELP

Escalate to the user if:

- 🚨 Critical security issues found
- 🚨 Ambiguous requirements (can't determine correct approach)
- 🚨 Missing dependencies or seed code
- 🚨 Validation errors you can't resolve
- 🚨 TradingView Lightweight Charts API questions
- 🚨 Unclear tier validation logic

Otherwise, work autonomously following the policies!

---

**Good luck! Build Part 9 with quality and precision. The user trusts you to follow all policies and deliver production-ready code.** 🚀
