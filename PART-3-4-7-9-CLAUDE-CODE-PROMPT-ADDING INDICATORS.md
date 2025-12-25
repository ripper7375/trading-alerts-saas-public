# Agent 2 Implementation Prompt: PRO Indicators (Parts 3, 4, 7, 9)

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

Data is fetched from these MQL5 indicators:

- `Fractal Diagonal Line_V4.mq5`
- `Fractal Horizontal Line_V5.mq5`

### Your Task

Add 6 **PRO-only** indicators to the frontend. These indicators will only be accessible to PRO tier users:
| Indicator | MQL5 Source File | Description |
|-----------|------------------|-------------|
| **Momentum Candles** | `Body Size Momentum Candle_V2.mq5` | Z-score based candle classification (Normal/Large/Extreme) |
| **Keltner Channels** | `Keltner Channel_ATF_10 Bands.mq5` | 10-band ATR-based channel system |
| **TEMA** | `TEMA_HRMA_SMA-SMMA_Modified Buffers.mq5` | Triple Exponential Moving Average |
| **HRMA** | `TEMA_HRMA_SMA-SMMA_Modified Buffers.mq5` | Hull-like Responsive Moving Average |
| **SMMA** | `TEMA_HRMA_SMA-SMMA_Modified Buffers.mq5` | Smoothed Moving Average |
| **ZigZag** | `ZigZagColor & MarketStructure_JSON Export_V27_TXT Input.mq5` | Peak/Bottom structure detection |
---

## Architecture Principle

### Simplified Approach (IMPORTANT)

We are using a **simplified architecture** where:

- **NO new API endpoints** - extend existing `/api/indicators/[symbol]/[timeframe]` endpoint
- **Tier filtering in response** - PRO indicators return empty arrays for FREE users
- **Update existing files** - minimize new file creation

### Data Flow

```
MT5 Terminals → Flask MT5 Service → Next.js API → Frontend Components
(Agent 1) → (Agent 2) → (Agent 2)
```

Agent 1 (parallel) is implementing the Flask backend to fetch PRO indicator data. Your task is the TypeScript/Next.js side.
---

## Files to Modify

### Part 3: Types

**File:** `types/indicator.ts` (UPDATE or CREATE if doesn't exist)

### Part 4: Tier System

**File:** `lib/tier/constants.ts` (UPDATE)
**File:** `lib/tier/validator.ts` (UPDATE or CREATE)

### Part 7: Indicators API

**File:** `app/api/indicators/[symbol]/[timeframe]/route.ts` (UPDATE)
**File:** `lib/api/mt5-client.ts` (UPDATE)

### Part 9: Charts UI

**File:** `components/charts/chart-controls.tsx` (UPDATE)
**File:** `components/charts/indicator-overlay.tsx` (UPDATE)
**File:** `hooks/use-indicators.ts` (UPDATE)
---

## Implementation Details

### 1. Part 3: Type Definitions

Add these TypeScript types to `types/indicator.ts`:

```typescript
// ============================================
// PRO INDICATOR TYPES
// ============================================

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
 */
export interface KeltnerChannelData {
  ultraExtremeUpper: (number | null)[]; // Buffer 0
  extremeUpper: (number | null)[]; // Buffer 1
  upperMost: (number | null)[]; // Buffer 2
  upper: (number | null)[]; // Buffer 3
  upperMiddle: (number | null)[]; // Buffer 4
  lowerMiddle: (number | null)[]; // Buffer 5
  lower: (number | null)[]; // Buffer 6
  lowerMost: (number | null)[]; // Buffer 7
  extremeLower: (number | null)[]; // Buffer 8
  ultraExtremeLower: (number | null)[]; // Buffer 9
}

/**
 * Moving Average data (TEMA, HRMA, SMMA)
 * From: TEMA_HRMA_SMA-SMMA_Modified Buffers.mq5
 */
export interface MovingAveragesData {
  smma: (number | null)[]; // Buffer 1
  hrma: (number | null)[]; // Buffer 2
  tema: (number | null)[]; // Buffer 3
}

/**
 * ZigZag peak/bottom point
 * From: ZigZagColor & MarketStructure.mq5 (Buffers 0-1)
 */
export interface ZigZagPoint {
  index: number;
  price: number;
  timestamp?: number;
}

export interface ZigZagData {
  peaks: ZigZagPoint[];
  bottoms: ZigZagPoint[];
}

/**
 * Complete PRO indicators response
 */
export interface ProIndicatorData {
  momentumCandles: MomentumCandleData[];
  keltnerChannels: KeltnerChannelData | null;
  tema: (number | null)[];
  hrma: (number | null)[];
  smma: (number | null)[];
  zigzag: ZigZagData | null;
}

/**
 * Extended indicator response (includes basic + PRO)
 */
export interface IndicatorResponse {
  success: boolean;
  data: {
    // Basic indicators (FREE + PRO)
    fractals: FractalData;
    trendlines: TrendlineData;
    // PRO indicators (empty for FREE tier)
    proIndicators: ProIndicatorData;
  };
  metadata: {
    symbol: string;
    timeframe: string;
    tier: 'FREE' | 'PRO';
    bars: number;
  };
}
```

---

### 2. Part 4: Tier System

**File: `lib/tier/constants.ts`** - Add:

```typescript
// PRO-only indicators list
export const PRO_ONLY_INDICATORS = [
  'momentum_candles',
  'keltner_channels',
  'tema',
  'hrma',
  'smma',
  'zigzag',
] as const;

export type ProOnlyIndicator = (typeof PRO_ONLY_INDICATORS)[number];

// Basic indicators (available to all tiers)
export const BASIC_INDICATORS = ['fractals', 'trendlines'] as const;

export type BasicIndicator = (typeof BASIC_INDICATORS)[number];

// All indicators combined
export const ALL_INDICATORS = [
  ...BASIC_INDICATORS,
  ...PRO_ONLY_INDICATORS,
] as const;
export type IndicatorType = (typeof ALL_INDICATORS)[number];
```

**File: `lib/tier/validator.ts`** - Add function:

```typescript
import { PRO_ONLY_INDICATORS, ProOnlyIndicator } from './constants';

/**
 * Check if user tier can access a specific indicator
 */
export function canAccessIndicator(
  tier: 'FREE' | 'PRO',
  indicator: string
): boolean {
  // PRO-only indicators require PRO tier
  if (PRO_ONLY_INDICATORS.includes(indicator as ProOnlyIndicator)) {
    return tier === 'PRO';
  }
  // Basic indicators available to all
  return true;
}

/**
 * Filter indicators based on user tier
 */
export function filterIndicatorsByTier<T extends Record<string, unknown>>(
  indicators: T,
  tier: 'FREE' | 'PRO'
): T {
  if (tier === 'PRO') {
    return indicators; // PRO gets everything
  }

  // FREE tier: null out PRO indicators
  const filtered = { ...indicators };
  PRO_ONLY_INDICATORS.forEach((indicator) => {
    const key = indicator as keyof T;
    if (key in filtered) {
      (filtered as Record<string, unknown>)[key as string] = null;
    }
  });
  return filtered;
}
```

---

### 3. Part 7: Indicators API

**File: `lib/api/mt5-client.ts`** - Update to handle PRO indicators:

```typescript
// Add to existing MT5 client

interface MT5IndicatorResponse {
  success: boolean;
  data: {
    fractals: unknown;
    trendlines: unknown;
    // PRO indicators from Flask
    momentum_candles?: unknown;
    keltner_channels?: unknown;
    tema?: unknown;
    hrma?: unknown;
    smma?: unknown;
    zigzag?: unknown;
  };
}

/**
 * Fetch indicators from Flask MT5 service
 * PRO indicators are included when user tier is PRO
 */
export async function fetchIndicators(
  symbol: string,
  timeframe: string,
  userTier: 'FREE' | 'PRO',
  bars: number = 1000
): Promise<MT5IndicatorResponse> {
  const MT5_SERVICE_URL =
    process.env.MT5_SERVICE_URL || 'http://localhost:5000';
  const MT5_API_KEY = process.env.MT5_API_KEY || '';

  const response = await fetch(
    `${MT5_SERVICE_URL}/api/indicators/${symbol}/${timeframe}?bars=${bars}`,
    {
      headers: {
        'X-API-Key': MT5_API_KEY,
        'X-User-Tier': userTier, // Flask will include PRO data if tier is PRO
      },
      next: { revalidate: 5 }, // Cache for 5 seconds
    }
  );

  if (!response.ok) {
    throw new Error(`MT5 service error: ${response.status}`);
  }

  return response.json();
}
```

**File: `app/api/indicators/[symbol]/[timeframe]/route.ts`** - Update:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { fetchIndicators } from '@/lib/api/mt5-client';
import { canAccessIndicator } from '@/lib/tier/validator';

export async function GET(
  request: NextRequest,
  { params }: { params: { symbol: string; timeframe: string } }
) {
  try {
    // Get user session and tier
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userTier = (session.user?.tier as 'FREE' | 'PRO') || 'FREE';
    const { symbol, timeframe } = params;
    const bars = parseInt(request.nextUrl.searchParams.get('bars') || '1000');

    // Fetch from Flask MT5 service (includes PRO indicators if tier allows)
    const mt5Response = await fetchIndicators(
      symbol,
      timeframe,
      userTier,
      bars
    );

    if (!mt5Response.success) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch indicators' },
        { status: 502 }
      );
    }

    // Transform response to match frontend types
    const response = {
      success: true,
      data: {
        fractals: mt5Response.data.fractals,
        trendlines: mt5Response.data.trendlines,
        proIndicators: {
          momentumCandles:
            userTier === 'PRO' ? mt5Response.data.momentum_candles || [] : [],
          keltnerChannels:
            userTier === 'PRO'
              ? mt5Response.data.keltner_channels || null
              : null,
          tema: userTier === 'PRO' ? mt5Response.data.tema || [] : [],
          hrma: userTier === 'PRO' ? mt5Response.data.hrma || [] : [],
          smma: userTier === 'PRO' ? mt5Response.data.smma || [] : [],
          zigzag: userTier === 'PRO' ? mt5Response.data.zigzag || null : null,
        },
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
    console.error('Indicator fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

---

### 4. Part 9: Charts UI

**File: `components/charts/chart-controls.tsx`** - Add indicator selection panel:

```tsx
'use client';

import { useSession } from 'next-auth/react';
import { Lock } from 'lucide-react';
import { BASIC_INDICATORS, PRO_ONLY_INDICATORS } from '@/lib/tier/constants';

interface IndicatorOption {
  id: string;
  label: string;
  description: string;
}

const INDICATOR_OPTIONS: Record<string, IndicatorOption> = {
  // Basic
  fractals: {
    id: 'fractals',
    label: 'Fractals',
    description: 'Support/resistance fractals',
  },
  trendlines: {
    id: 'trendlines',
    label: 'Trendlines',
    description: 'Diagonal trend lines',
  },
  // PRO
  momentum_candles: {
    id: 'momentum_candles',
    label: 'Momentum Candles',
    description: 'Z-score body classification',
  },
  keltner_channels: {
    id: 'keltner_channels',
    label: 'Keltner Channels',
    description: '10-band ATR channels',
  },
  tema: { id: 'tema', label: 'TEMA', description: 'Triple EMA' },
  hrma: { id: 'hrma', label: 'HRMA', description: 'Hull-like Responsive MA' },
  smma: { id: 'smma', label: 'SMMA', description: 'Smoothed MA' },
  zigzag: {
    id: 'zigzag',
    label: 'ZigZag',
    description: 'Peak/Bottom detection',
  },
};

interface ChartControlsProps {
  selectedIndicators: string[];
  onIndicatorToggle: (indicatorId: string) => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onReset?: () => void;
}

export function ChartControls({
  selectedIndicators,
  onIndicatorToggle,
  onZoomIn,
  onZoomOut,
  onReset,
}: ChartControlsProps) {
  const { data: session } = useSession();
  const isPro = session?.user?.tier === 'PRO';

  return (
    <div className="flex flex-col gap-4 p-4 bg-background border rounded-lg">
      {/* Zoom Controls */}
      <div className="flex gap-2">
        <button
          onClick={onZoomIn}
          className="px-3 py-1 border rounded hover:bg-accent"
        >
          +
        </button>
        <button
          onClick={onZoomOut}
          className="px-3 py-1 border rounded hover:bg-accent"
        >
          -
        </button>
        <button
          onClick={onReset}
          className="px-3 py-1 border rounded hover:bg-accent"
        >
          Reset
        </button>
      </div>

      {/* Indicators Panel */}
      <div className="space-y-4">
        <h4 className="text-sm font-semibold">Technical Indicators</h4>

        {/* Basic Indicators */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground uppercase">Basic</p>
          {BASIC_INDICATORS.map((id) => {
            const option = INDICATOR_OPTIONS[id];
            return (
              <label
                key={id}
                className="flex items-center gap-2 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedIndicators.includes(id)}
                  onChange={() => onIndicatorToggle(id)}
                  className="rounded border-gray-300"
                />
                <span className="text-sm">{option.label}</span>
              </label>
            );
          })}
        </div>

        {/* PRO Indicators */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <p className="text-xs text-muted-foreground uppercase">
              Pro Indicators
            </p>
            {!isPro && (
              <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-medium">
                PRO
              </span>
            )}
          </div>

          {PRO_ONLY_INDICATORS.map((id) => {
            const option = INDICATOR_OPTIONS[id];
            return (
              <label
                key={id}
                className={`flex items-center gap-2 ${
                  !isPro ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                }`}
                title={
                  !isPro
                    ? 'Upgrade to PRO to access this indicator'
                    : option.description
                }
              >
                <input
                  type="checkbox"
                  checked={selectedIndicators.includes(id)}
                  onChange={() => isPro && onIndicatorToggle(id)}
                  disabled={!isPro}
                  className="rounded border-gray-300"
                />
                <span className="text-sm">{option.label}</span>
                {!isPro && <Lock className="h-3 w-3 text-muted-foreground" />}
              </label>
            );
          })}

          {!isPro && (
            <a
              href="/pricing"
              className="inline-block text-xs text-primary hover:underline mt-2"
            >
              Upgrade to PRO for advanced indicators →
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
```

**File: `hooks/use-indicators.ts`** - Update to handle PRO data:

```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import type { IndicatorResponse, ProIndicatorData } from '@/types/indicator';

interface UseIndicatorsOptions {
  symbol: string;
  timeframe: string;
  bars?: number;
  enabled?: boolean;
}

interface UseIndicatorsReturn {
  data: IndicatorResponse['data'] | null;
  proData: ProIndicatorData | null;
  loading: boolean;
  error: string | null;
  isPro: boolean;
  refetch: () => void;
}

export function useIndicators({
  symbol,
  timeframe,
  bars = 1000,
  enabled = true,
}: UseIndicatorsOptions): UseIndicatorsReturn {
  const { data: session } = useSession();
  const [data, setData] = useState<IndicatorResponse['data'] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPro = session?.user?.tier === 'PRO';

  const fetchData = useCallback(async () => {
    if (!symbol || !timeframe || !enabled) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/indicators/${encodeURIComponent(symbol)}/${encodeURIComponent(timeframe)}?bars=${bars}`
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result: IndicatorResponse = await response.json();

      if (result.success) {
        setData(result.data);
      } else {
        throw new Error('Failed to fetch indicators');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [symbol, timeframe, bars, enabled]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    proData: data?.proIndicators ?? null,
    loading,
    error,
    isPro,
    refetch: fetchData,
  };
}
```

**File: `components/charts/indicator-overlay.tsx`** - Add PRO indicator rendering:

```tsx
'use client';

import { useEffect, useRef } from 'react';
import type { IChartApi, ISeriesApi, LineData, Time } from 'lightweight-charts';
import type { ProIndicatorData, KeltnerChannelData } from '@/types/indicator';

// Color schemes for PRO indicators
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
  timeData: Time[]; // Array of timestamps matching OHLC data
}

export function IndicatorOverlay({
  chart,
  proData,
  selectedIndicators,
  timeData,
}: IndicatorOverlayProps) {
  const seriesRefs = useRef<Map<string, ISeriesApi<'Line'>>>(new Map());

  useEffect(() => {
    if (!chart || !proData) return;

    // Clean up existing series
    seriesRefs.current.forEach((series) => {
      try {
        chart.removeSeries(series);
      } catch (e) {
        // Series may already be removed
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

        const lineData: LineData[] = values
          .map((value, i) => ({
            time: timeData[i],
            value: value ?? undefined,
          }))
          .filter((d): d is LineData => d.value !== undefined);

        series.setData(lineData);
        seriesRefs.current.set(`keltner_${band}`, series);
      });
    }

    // Render TEMA
    if (selectedIndicators.includes('tema') && proData.tema?.length) {
      const series = chart.addLineSeries({
        color: MA_COLORS.tema,
        lineWidth: 2,
        priceLineVisible: false,
      });
      const lineData: LineData[] = proData.tema
        .map((value, i) => ({ time: timeData[i], value: value ?? undefined }))
        .filter((d): d is LineData => d.value !== undefined);
      series.setData(lineData);
      seriesRefs.current.set('tema', series);
    }

    // Render HRMA
    if (selectedIndicators.includes('hrma') && proData.hrma?.length) {
      const series = chart.addLineSeries({
        color: MA_COLORS.hrma,
        lineWidth: 2,
        priceLineVisible: false,
      });
      const lineData: LineData[] = proData.hrma
        .map((value, i) => ({ time: timeData[i], value: value ?? undefined }))
        .filter((d): d is LineData => d.value !== undefined);
      series.setData(lineData);
      seriesRefs.current.set('hrma', series);
    }

    // Render SMMA
    if (selectedIndicators.includes('smma') && proData.smma?.length) {
      const series = chart.addLineSeries({
        color: MA_COLORS.smma,
        lineWidth: 2,
        priceLineVisible: false,
      });
      const lineData: LineData[] = proData.smma
        .map((value, i) => ({ time: timeData[i], value: value ?? undefined }))
        .filter((d): d is LineData => d.value !== undefined);
      series.setData(lineData);
      seriesRefs.current.set('smma', series);
    }

    // Note: ZigZag and Momentum Candles need special handling
    // ZigZag: Use markers on the main candlestick series
    // Momentum Candles: Modify candlestick colors based on classification

    return () => {
      seriesRefs.current.forEach((series) => {
        try {
          chart.removeSeries(series);
        } catch (e) {
          // Ignore
        }
      });
      seriesRefs.current.clear();
    };
  }, [chart, proData, selectedIndicators, timeData]);

  return null; // This component renders directly to the chart
}
```

---

## Integration Notes

### Flask API Response Format (Agent 1 is implementing)

The Flask backend will return data in this format when `X-User-Tier: PRO` header is set:

```json
{
"success": true,
"data": {
"fractals": { ... },
"trendlines": { ... },
"momentum_candles": [
{ "index": 0, "type": 2, "zscore": 2.5 },
...
],
"keltner_channels": {
"ultra_extreme_upper": [1.234, 1.235, ...],
"extreme_upper": [1.232, 1.233, ...],
...
},
"tema": [1.234, 1.235, null, ...],
"hrma": [1.234, 1.235, null, ...],
"smma": [1.234, 1.235, null, ...],
"zigzag": {
"peaks": [{ "index": 10, "price": 1.25 }, ...],
"bottoms": [{ "index": 15, "price": 1.20 }, ...]
}
}
}
```

### Key Points

1. **Null values** represent empty/invalid indicator values (EMPTY_VALUE from MT5)
2. **Index** values correspond to OHLC bar indices
3. **FREE tier** receives empty arrays/null for PRO indicators
4. **PRO tier** receives full indicator data

---

## Testing Checklist

After implementation, verify:

- [ ] FREE users see PRO indicators as disabled/locked in chart controls
- [ ] FREE users cannot enable PRO indicators
- [ ] PRO users can toggle all indicators
- [ ] API returns empty PRO data for FREE tier
- [ ] API returns full PRO data for PRO tier
- [ ] Keltner Channels render as 10 lines on chart
- [ ] Moving averages (TEMA/HRMA/SMMA) render correctly
- [ ] Indicator overlay updates when toggling indicators
- [ ] No console errors during indicator rendering

---

## Summary

| Part   | Files to Modify                                    | Action                   |
| ------ | -------------------------------------------------- | ------------------------ |
| Part 3 | `types/indicator.ts`                               | Add PRO indicator types  |
| Part 4 | `lib/tier/constants.ts`                            | Add PRO_ONLY_INDICATORS  |
| Part 4 | `lib/tier/validator.ts`                            | Add canAccessIndicator() |
| Part 7 | `lib/api/mt5-client.ts`                            | Handle PRO tier header   |
| Part 7 | `app/api/indicators/[symbol]/[timeframe]/route.ts` | Include proIndicators    |
| Part 9 | `components/charts/chart-controls.tsx`             | Add indicator checkboxes |
| Part 9 | `hooks/use-indicators.ts`                          | Handle PRO data          |
| Part 9 | `components/charts/indicator-overlay.tsx`          | Render PRO indicators    |

**Branch:** Work on the same branch as Agent 1 or create a feature branch and merge later.
**Communication:** Agent 1 is implementing Flask Part 6. Coordinate on the API response format if needed.
