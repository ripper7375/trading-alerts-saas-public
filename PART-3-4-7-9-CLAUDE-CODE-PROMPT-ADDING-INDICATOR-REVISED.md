# Agent 2 Implementation Prompt: PRO Indicators (Type-Safe Refactoring)

## ⚠️ CRITICAL: Type System First Approach

**This revision addresses TypeScript type mismatches discovered in initial implementation attempts.**

Previous implementations failed due to:

1. **Type hierarchy conflicts** between `ProIndicatorData` and `MT5ProIndicators`
2. **Inconsistent null/undefined handling** causing type assignment errors
3. **Time type mismatches** in chart data (`Time | undefined` vs `Time`)
4. **Missing environment configuration** (CRON_SECRET)

**Strategy:** Build with **type-safe foundations first**, then implement features.

---

## Background & Context

### Project Overview

Trading Alerts SaaS V7 is a trading platform that displays technical indicators from MetaTrader 5 (MT5). The system uses:

- **Flask MT5 Service** (Part 6): Python backend that reads indicator data from 15 MT5 terminals
- **Next.js Frontend**: Dashboard with interactive charts using Lightweight Charts library
- **Tier System**: FREE and PRO subscription tiers with different access levels

### Current State

Currently, the system supports 2 basic indicators available to both FREE and PRO tiers:

- **Fractals**: Support/resistance fractal points
- **Trendlines**: Diagonal trend lines

### Your Task

Add 6 **PRO-only** indicators to the frontend with **type-safe architecture**:

| Indicator            | MQL5 Source File                                              | Description                         |
| -------------------- | ------------------------------------------------------------- | ----------------------------------- |
| **Momentum Candles** | `Body Size Momentum Candle_V2.mq5`                            | Z-score based candle classification |
| **Keltner Channels** | `Keltner Channel_ATF_10 Bands.mq5`                            | 10-band ATR-based channel system    |
| **TEMA**             | `TEMA_HRMA_SMA-SMMA_Modified Buffers.mq5`                     | Triple Exponential Moving Average   |
| **HRMA**             | `TEMA_HRMA_SMA-SMMA_Modified Buffers.mq5`                     | Hull-like Responsive Moving Average |
| **SMMA**             | `TEMA_HRMA_SMA-SMMA_Modified Buffers.mq5`                     | Smoothed Moving Average             |
| **ZigZag**           | `ZigZagColor & MarketStructure_JSON Export_V27_TXT Input.mq5` | Peak/Bottom structure detection     |

---

## 🎯 Type System Design Principles (MANDATORY)

### 1. Null vs Undefined Convention

**Rule:** Use `undefined` for optional/missing data, NEVER use `null` in type definitions.

```typescript
// ❌ WRONG - causes type assignment errors
interface Example {
  value: string | null;
}

// ✅ CORRECT - TypeScript-friendly
interface Example {
  value?: string; // or: value: string | undefined
}
```

**Rationale:** TypeScript's optional chaining (`?.`) and intersection types (`&`) work cleanly with `undefined`, but break with `null`.

### 2. Time Type Safety for Charts

**Rule:** All chart data must have **non-undefined time values** before passing to Lightweight Charts.

```typescript
// ❌ WRONG - causes "Type 'undefined' is not assignable to type 'Time'"
const data = points.map((p) => ({ time: p.time, value: p.value }));

// ✅ CORRECT - filter out undefined times
const data = points.filter(
  (p): p is { time: Time; value: number } =>
    p.time !== undefined && p.value !== undefined
);
```

### 3. Type Hierarchy Alignment

**Rule:** Avoid complex intersection types (`A & B`) where possible. Use composition instead.

```typescript
// ❌ WRONG - intersection creates conflicts
interface Response {
  proIndicators: MT5ProIndicators & ProIndicatorData;
}

// ✅ CORRECT - single, well-defined type
interface Response {
  proIndicators: ProIndicatorData;
}
```

---

## Implementation Steps (Type-Safe Order)

### Phase 1: Foundation Types (MUST BE FIRST)

**Goal:** Establish type-safe contracts before any implementation.

### Phase 2: API Layer with Type Validation

**Goal:** Ensure API responses match type contracts exactly.

### Phase 3: UI Components with Type Guards

**Goal:** Render with runtime type safety.

---

## Part 1: Core Type Definitions (START HERE)

**File:** `types/indicator.ts`

```typescript
// ============================================
// CORE TYPE PRINCIPLES
// ============================================
// 1. Use undefined (not null) for missing data
// 2. Arrays should never contain null - use undefined or filter
// 3. Optional fields use ?: syntax

/**
 * Momentum Candle classification based on Z-score
 * From: Body Size Momentum Candle_V2.mq5 (Buffer 4: ColorBuffer)
 */
export enum MomentumCandleType {
  UP_NORMAL = 0,
  UP_LARGE = 1,
  UP_EXTREME = 2,
  DOWN_NORMAL = 3,
  DOWN_LARGE = 4,
  DOWN_EXTREME = 5,
}

export interface MomentumCandleData {
  index: number;
  type: MomentumCandleType;
  zscore: number;
}

/**
 * Keltner Channel 10-band system
 * From: Keltner Channel_ATF_10 Bands.mq5 (Buffers 0-9)
 *
 * IMPORTANT: Array values use undefined for empty slots
 * Never use null - filter before rendering
 */
export interface KeltnerChannelData {
  ultraExtremeUpper: (number | undefined)[]; // Buffer 0
  extremeUpper: (number | undefined)[]; // Buffer 1
  upperMost: (number | undefined)[]; // Buffer 2
  upper: (number | undefined)[]; // Buffer 3
  upperMiddle: (number | undefined)[]; // Buffer 4
  lowerMiddle: (number | undefined)[]; // Buffer 5
  lower: (number | undefined)[]; // Buffer 6
  lowerMost: (number | undefined)[]; // Buffer 7
  extremeLower: (number | undefined)[]; // Buffer 8
  ultraExtremeLower: (number | undefined)[]; // Buffer 9
}

/**
 * Moving Average data (TEMA, HRMA, SMMA)
 * From: TEMA_HRMA_SMA-SMMA_Modified Buffers.mq5
 *
 * IMPORTANT: Use undefined (not null) for missing values
 */
export interface MovingAveragesData {
  smma: (number | undefined)[]; // Buffer 1
  hrma: (number | undefined)[]; // Buffer 2
  tema: (number | undefined)[]; // Buffer 3
}

/**
 * ZigZag peak/bottom point
 * From: ZigZagColor & MarketStructure.mq5 (Buffers 0-1)
 */
export interface ZigZagPoint {
  index: number;
  price: number;
  timestamp?: number; // Optional, not | undefined
}

export interface ZigZagData {
  peaks: ZigZagPoint[];
  bottoms: ZigZagPoint[];
}

/**
 * Complete PRO indicators response
 *
 * TYPE SAFETY NOTES:
 * - Arrays never contain null, only undefined for gaps
 * - Optional objects use ? not | null
 * - This is the SINGLE SOURCE OF TRUTH for PRO data types
 */
export interface ProIndicatorData {
  momentumCandles: MomentumCandleData[];
  keltnerChannels?: KeltnerChannelData; // Optional, not | null
  tema: (number | undefined)[];
  hrma: (number | undefined)[];
  smma: (number | undefined)[];
  zigzag?: ZigZagData; // Optional, not | null
}

/**
 * Raw MT5 service response (before transformation)
 * This matches Flask's JSON output format
 */
export interface MT5ProIndicators {
  momentum_candles?: unknown[];
  keltner_channels?: {
    ultra_extreme_upper?: (number | null)[];
    extreme_upper?: (number | null)[];
    upper_most?: (number | null)[];
    upper?: (number | null)[];
    upper_middle?: (number | null)[];
    lower_middle?: (number | null)[];
    lower?: (number | null)[];
    lower_most?: (number | null)[];
    extreme_lower?: (number | null)[];
    ultra_extreme_lower?: (number | null)[];
  };
  tema?: (number | null)[];
  hrma?: (number | null)[];
  smma?: (number | null)[];
  zigzag?: {
    peaks?: Array<{ index: number; price: number; timestamp?: number }>;
    bottoms?: Array<{ index: number; price: number; timestamp?: number }>;
  };
}

/**
 * Basic indicator types (existing, keep as-is)
 */
export interface FractalData {
  // Existing implementation
  [key: string]: unknown;
}

export interface TrendlineData {
  // Existing implementation
  [key: string]: unknown;
}

/**
 * Complete API response type
 * CRITICAL: proIndicators is ProIndicatorData (not intersection type)
 */
export interface IndicatorDataResponse {
  success: boolean;
  data: {
    fractals: FractalData;
    trendlines: TrendlineData;
    proIndicators: ProIndicatorData; // Single type, not intersection
  };
  metadata: {
    symbol: string;
    timeframe: string;
    tier: 'FREE' | 'PRO';
    bars: number;
  };
}

/**
 * Helper type for chart rendering
 * Ensures time is never undefined when passed to Lightweight Charts
 */
export interface ChartDataPoint {
  time: Time; // NEVER undefined
  value: number; // NEVER undefined
}
```

---

## Part 2: MT5 Response Transformation (Type-Safe)

**File:** `lib/api/mt5-transform.ts` (NEW FILE - create this)

```typescript
import type {
  MT5ProIndicators,
  ProIndicatorData,
  KeltnerChannelData,
  MomentumCandleData,
  MomentumCandleType,
} from '@/types/indicator';

/**
 * Transform raw MT5 response to type-safe ProIndicatorData
 *
 * CRITICAL RULES:
 * 1. Convert null to undefined in arrays
 * 2. Validate data structure before returning
 * 3. Return empty/default values for FREE tier
 */
export function transformProIndicators(
  mt5Data: MT5ProIndicators | undefined,
  userTier: 'FREE' | 'PRO'
): ProIndicatorData {
  // FREE tier gets empty data
  if (userTier === 'FREE' || !mt5Data) {
    return {
      momentumCandles: [],
      keltnerChannels: undefined,
      tema: [],
      hrma: [],
      smma: [],
      zigzag: undefined,
    };
  }

  // Transform Momentum Candles
  const momentumCandles: MomentumCandleData[] = Array.isArray(
    mt5Data.momentum_candles
  )
    ? mt5Data.momentum_candles
        .filter(
          (item): item is Record<string, unknown> =>
            typeof item === 'object' && item !== null
        )
        .map((item) => ({
          index: Number(item.index) || 0,
          type: (Number(item.type) || 0) as MomentumCandleType,
          zscore: Number(item.zscore) || 0,
        }))
    : [];

  // Transform Keltner Channels (null -> undefined conversion)
  const keltnerChannels: KeltnerChannelData | undefined =
    mt5Data.keltner_channels
      ? {
          ultraExtremeUpper: convertNullToUndefined(
            mt5Data.keltner_channels.ultra_extreme_upper
          ),
          extremeUpper: convertNullToUndefined(
            mt5Data.keltner_channels.extreme_upper
          ),
          upperMost: convertNullToUndefined(
            mt5Data.keltner_channels.upper_most
          ),
          upper: convertNullToUndefined(mt5Data.keltner_channels.upper),
          upperMiddle: convertNullToUndefined(
            mt5Data.keltner_channels.upper_middle
          ),
          lowerMiddle: convertNullToUndefined(
            mt5Data.keltner_channels.lower_middle
          ),
          lower: convertNullToUndefined(mt5Data.keltner_channels.lower),
          lowerMost: convertNullToUndefined(
            mt5Data.keltner_channels.lower_most
          ),
          extremeLower: convertNullToUndefined(
            mt5Data.keltner_channels.extreme_lower
          ),
          ultraExtremeLower: convertNullToUndefined(
            mt5Data.keltner_channels.ultra_extreme_lower
          ),
        }
      : undefined;

  // Transform Moving Averages (null -> undefined)
  const tema = convertNullToUndefined(mt5Data.tema);
  const hrma = convertNullToUndefined(mt5Data.hrma);
  const smma = convertNullToUndefined(mt5Data.smma);

  // Transform ZigZag
  const zigzag = mt5Data.zigzag
    ? {
        peaks: Array.isArray(mt5Data.zigzag.peaks) ? mt5Data.zigzag.peaks : [],
        bottoms: Array.isArray(mt5Data.zigzag.bottoms)
          ? mt5Data.zigzag.bottoms
          : [],
      }
    : undefined;

  return {
    momentumCandles,
    keltnerChannels,
    tema,
    hrma,
    smma,
    zigzag,
  };
}

/**
 * Convert array of (number | null) to (number | undefined)
 * This ensures type compatibility with TypeScript's optional chaining
 */
function convertNullToUndefined(
  arr: (number | null)[] | undefined
): (number | undefined)[] {
  if (!Array.isArray(arr)) return [];
  return arr.map((val) => (val === null ? undefined : val));
}

/**
 * Type guard to validate ProIndicatorData structure
 */
export function isValidProIndicatorData(
  data: unknown
): data is ProIndicatorData {
  if (typeof data !== 'object' || data === null) return false;

  const d = data as Record<string, unknown>;

  return (
    Array.isArray(d.momentumCandles) &&
    Array.isArray(d.tema) &&
    Array.isArray(d.hrma) &&
    Array.isArray(d.smma)
  );
}
```

---

## Part 3: API Route (Type-Safe Implementation)

**File:** `app/api/indicators/[symbol]/[timeframe]/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { transformProIndicators } from '@/lib/api/mt5-transform';
import type {
  IndicatorDataResponse,
  MT5ProIndicators,
} from '@/types/indicator';

interface MT5ServiceResponse {
  success: boolean;
  data: {
    fractals: unknown;
    trendlines: unknown;
    // Raw MT5 data (may have null values)
    momentum_candles?: unknown[];
    keltner_channels?: Record<string, (number | null)[]>;
    tema?: (number | null)[];
    hrma?: (number | null)[];
    smma?: (number | null)[];
    zigzag?: unknown;
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: { symbol: string; timeframe: string } }
) {
  try {
    // 1. Authentication & Authorization
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userTier = (session.user.tier as 'FREE' | 'PRO') || 'FREE';
    const { symbol, timeframe } = params;
    const bars = parseInt(
      request.nextUrl.searchParams.get('bars') || '1000',
      10
    );

    // 2. Fetch from MT5 Service
    const MT5_SERVICE_URL =
      process.env.MT5_SERVICE_URL || 'http://localhost:5000';
    const MT5_API_KEY = process.env.MT5_API_KEY || '';

    const mt5Response = await fetch(
      `${MT5_SERVICE_URL}/api/indicators/${encodeURIComponent(symbol)}/${encodeURIComponent(timeframe)}?bars=${bars}`,
      {
        headers: {
          'X-API-Key': MT5_API_KEY,
          'X-User-Tier': userTier,
        },
        next: { revalidate: 5 },
      }
    );

    if (!mt5Response.ok) {
      throw new Error(`MT5 service error: ${mt5Response.status}`);
    }

    const mt5Data: MT5ServiceResponse = await mt5Response.json();

    if (!mt5Data.success) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch indicators from MT5' },
        { status: 502 }
      );
    }

    // 3. Transform to type-safe format (null -> undefined conversion happens here)
    const proIndicators = transformProIndicators(
      mt5Data.data as MT5ProIndicators,
      userTier
    );

    // 4. Build response (type-safe, matches IndicatorDataResponse exactly)
    const response: IndicatorDataResponse = {
      success: true,
      data: {
        fractals: mt5Data.data.fractals as FractalData,
        trendlines: mt5Data.data.trendlines as TrendlineData,
        proIndicators, // Already type-safe from transform
      },
      metadata: {
        symbol,
        timeframe,
        tier: userTier,
        bars,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Indicators API Error]:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
```

---

## Part 4: Chart Rendering (Time Type Safety)

**File:** `components/charts/indicator-overlay.tsx`

```typescript
'use client';

import { useEffect, useRef } from 'react';
import type { IChartApi, ISeriesApi, LineData, Time } from 'lightweight-charts';
import type { ProIndicatorData, KeltnerChannelData } from '@/types/indicator';

const KELTNER_COLORS: Record<keyof KeltnerChannelData, string> = {
  ultraExtremeUpper: '#9C27B0',
  extremeUpper: '#AB47BC',
  upperMost: '#BA68C8',
  upper: '#CE93D8',
  upperMiddle: '#FF5722',
  lowerMiddle: '#FF7043',
  lower: '#CE93D8',
  lowerMost: '#BA68C8',
  extremeLower: '#AB47BC',
  ultraExtremeLower: '#9C27B0',
};

const MA_COLORS = {
  tema: '#808080',
  hrma: '#00CED1',
  smma: '#0000FF',
};

interface IndicatorOverlayProps {
  chart: IChartApi | null;
  proData: ProIndicatorData | null;
  selectedIndicators: string[];
  timeData: Time[]; // MUST be valid Time[] with no undefined
}

export function IndicatorOverlay({
  chart,
  proData,
  selectedIndicators,
  timeData,
}: IndicatorOverlayProps) {
  const seriesRefs = useRef<Map<string, ISeriesApi<'Line'>>>(new Map());

  useEffect(() => {
    if (!chart || !proData || timeData.length === 0) return;

    // Clean up existing series
    seriesRefs.current.forEach((series) => {
      try {
        chart.removeSeries(series);
      } catch {
        // Series already removed
      }
    });
    seriesRefs.current.clear();

    // Render Keltner Channels
    if (
      selectedIndicators.includes('keltner_channels') &&
      proData.keltnerChannels
    ) {
      const kc = proData.keltnerChannels;

      (Object.keys(kc) as (keyof KeltnerChannelData)[]).forEach((band) => {
        const values = kc[band];
        if (!values || values.length === 0) return;

        const series = chart.addLineSeries({
          color: KELTNER_COLORS[band],
          lineWidth: band.includes('Middle') ? 3 : 2,
          priceLineVisible: false,
          lastValueVisible: false,
        });

        // CRITICAL: Filter out undefined values AND ensure time exists
        const lineData: LineData<Time>[] = values
          .map((value, i) => ({
            time: timeData[i],
            value: value,
          }))
          .filter(
            (d): d is LineData<Time> =>
              d.time !== undefined && d.value !== undefined && !isNaN(d.value)
          );

        if (lineData.length > 0) {
          series.setData(lineData);
          seriesRefs.current.set(`keltner_${band}`, series);
        } else {
          chart.removeSeries(series);
        }
      });
    }

    // Render Moving Averages with same pattern
    const renderMA = (
      id: string,
      data: (number | undefined)[],
      color: string
    ) => {
      if (!selectedIndicators.includes(id) || data.length === 0) return;

      const series = chart.addLineSeries({
        color,
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: true,
      });

      const lineData: LineData<Time>[] = data
        .map((value, i) => ({
          time: timeData[i],
          value: value,
        }))
        .filter(
          (d): d is LineData<Time> =>
            d.time !== undefined && d.value !== undefined && !isNaN(d.value)
        );

      if (lineData.length > 0) {
        series.setData(lineData);
        seriesRefs.current.set(id, series);
      } else {
        chart.removeSeries(series);
      }
    };

    renderMA('tema', proData.tema, MA_COLORS.tema);
    renderMA('hrma', proData.hrma, MA_COLORS.hrma);
    renderMA('smma', proData.smma, MA_COLORS.smma);

    // Cleanup on unmount
    return () => {
      seriesRefs.current.forEach((series) => {
        try {
          chart.removeSeries(series);
        } catch {
          // Ignore
        }
      });
      seriesRefs.current.clear();
    };
  }, [chart, proData, selectedIndicators, timeData]);

  return null;
}
```

---

## Part 5: Tier System & Controls

**File:** `lib/tier/constants.ts`

```typescript
export const PRO_ONLY_INDICATORS = [
  'momentum_candles',
  'keltner_channels',
  'tema',
  'hrma',
  'smma',
  'zigzag',
] as const;

export type ProOnlyIndicator = (typeof PRO_ONLY_INDICATORS)[number];

export const BASIC_INDICATORS = ['fractals', 'trendlines'] as const;
export type BasicIndicator = (typeof BASIC_INDICATORS)[number];

export const ALL_INDICATORS = [
  ...BASIC_INDICATORS,
  ...PRO_ONLY_INDICATORS,
] as const;
export type IndicatorType = (typeof ALL_INDICATORS)[number];
```

**File:** `lib/tier/validator.ts`

```typescript
import { PRO_ONLY_INDICATORS, type ProOnlyIndicator } from './constants';

export function canAccessIndicator(
  tier: 'FREE' | 'PRO',
  indicator: string
): boolean {
  if (PRO_ONLY_INDICATORS.includes(indicator as ProOnlyIndicator)) {
    return tier === 'PRO';
  }
  return true;
}
```

**File:** `components/charts/chart-controls.tsx`

```tsx
'use client';

import { useSession } from 'next-auth/react';
import { Lock } from 'lucide-react';
import { BASIC_INDICATORS, PRO_ONLY_INDICATORS } from '@/lib/tier/constants';

const INDICATOR_LABELS: Record<string, { label: string; description: string }> =
  {
    fractals: { label: 'Fractals', description: 'Support/resistance' },
    trendlines: { label: 'Trendlines', description: 'Diagonal trends' },
    momentum_candles: {
      label: 'Momentum Candles',
      description: 'Z-score classification',
    },
    keltner_channels: { label: 'Keltner Channels', description: '10-band ATR' },
    tema: { label: 'TEMA', description: 'Triple EMA' },
    hrma: { label: 'HRMA', description: 'Hull-like Responsive MA' },
    smma: { label: 'SMMA', description: 'Smoothed MA' },
    zigzag: { label: 'ZigZag', description: 'Peak/Bottom detection' },
  };

interface ChartControlsProps {
  selectedIndicators: string[];
  onIndicatorToggle: (id: string) => void;
}

export function ChartControls({
  selectedIndicators,
  onIndicatorToggle,
}: ChartControlsProps) {
  const { data: session } = useSession();
  const isPro = session?.user?.tier === 'PRO';

  return (
    <div className="space-y-4 p-4 border rounded-lg">
      <h4 className="font-semibold text-sm">Technical Indicators</h4>

      {/* Basic Indicators */}
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground uppercase">Basic</p>
        {BASIC_INDICATORS.map((id) => (
          <label key={id} className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={selectedIndicators.includes(id)}
              onChange={() => onIndicatorToggle(id)}
              className="rounded"
            />
            <span className="text-sm">{INDICATOR_LABELS[id].label}</span>
          </label>
        ))}
      </div>

      {/* PRO Indicators */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <p className="text-xs text-muted-foreground uppercase">Pro</p>
          {!isPro && (
            <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
              PRO
            </span>
          )}
        </div>

        {PRO_ONLY_INDICATORS.map((id) => (
          <label
            key={id}
            className={`flex items-center gap-2 ${
              !isPro ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
            }`}
          >
            <input
              type="checkbox"
              checked={selectedIndicators.includes(id)}
              onChange={() => isPro && onIndicatorToggle(id)}
              disabled={!isPro}
              className="rounded"
            />
            <span className="text-sm">{INDICATOR_LABELS[id].label}</span>
            {!isPro && <Lock className="h-3 w-3" />}
          </label>
        ))}

        {!isPro && (
          <a
            href="/pricing"
            className="text-xs text-primary hover:underline inline-block mt-2"
          >
            Upgrade to PRO →
          </a>
        )}
      </div>
    </div>
  );
}
```

---

## Part 6: Environment Configuration

**File:** `.github/workflows/ci-nextjs-progressive.yml`

Add environment variable:

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    env:
      CRON_SECRET: ${{ secrets.CRON_SECRET }}
      # ... other env vars
```

**Action Required:**

- Add `CRON_SECRET` to GitHub repository secrets
- Value can be any secure random string (e.g., `openssl rand -hex 32`)

---

## Testing Checklist

### Type Compilation

- [ ] No TypeScript errors in `types/indicator.ts`
- [ ] No type assignment errors in API route
- [ ] No `Time | undefined` errors in chart components

### Runtime Behavior

- [ ] FREE users see empty arrays for PRO indicators
- [ ] PRO users receive full indicator data
- [ ] Chart renders without console errors
- [ ] Keltner Channels show 10 distinct lines
- [ ] Moving averages render correctly

### Edge Cases

- [ ] Handles missing/undefined time values gracefully
- [ ] Filters out NaN values before rendering
- [ ] No crashes when indicator data is empty

---

## Common Pitfalls & Solutions

### ❌ Problem: "Type 'null' is not assignable to type 'X | undefined'"

**Solution:** Use `undefined` in type definitions, convert `null` to `undefined` in transform functions.

### ❌ Problem: "Type 'Time | undefined' is not assignable to type 'Time'"

**Solution:** Filter data with type guard:

```typescript
.filter((d): d is { time: Time; value: number } =>
  d.time !== undefined && d.value !== undefined
)
```

### ❌ Problem: "Type 'ProIndicatorData' is not assignable to 'MT5ProIndicators & ProIndicatorData'"

**Solution:** Don't use intersection types. Use single, well-defined type (`ProIndicatorData`).

---

## Summary

| Priority | Part      | Files                                     | Action                               |
| -------- | --------- | ----------------------------------------- | ------------------------------------ |
| 🔥 1     | Types     | `types/indicator.ts`                      | Define with `undefined` (not `null`) |
| 🔥 2     | Transform | `lib/api/mt5-transform.ts`                | Convert `null` → `undefined`         |
| 🔥 3     | API       | `app/api/indicators/.../route.ts`         | Use transform, single type           |
| 4        | Charts    | `components/charts/indicator-overlay.tsx` | Filter `undefined` times             |
| 5        | Controls  | `components/charts/chart-controls.tsx`    | Tier-based UI                        |
| 6        | Config    | `.github/workflows/...`                   | Add `CRON_SECRET`                    |

**Start with Part 1 (types), then Part 2 (transform). Do NOT skip ahead.**
