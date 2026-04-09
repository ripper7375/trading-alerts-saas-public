# Dual-Panel Chart UI Architecture

**Document Version:** 2.0.0
**Last Updated:** 2026-04-08
**Purpose:** Implementation guide for Claude Code — dual-panel financial chart UI with TradingView Lightweight Charts (left) and Apache ECharts supplement panel (right)

**Aligned with:**

- `davintrade-python-backend-architecture-v2.md` (v2.2)
- `davintrade-heatmap-expansion-stack-v2.md` (v2.2)

---

## Revision Notes (v1.0.0 → v2.0.0)

| #   | Change                                                                                                                                 | Type         |
| --- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 1   | FastAPI references eliminated — `BACKEND_URL` now points to NestJS Controller (Railway)                                                | Critical Fix |
| 2   | Backend stack description corrected — Python Celery Worker + Redis → NestJS Controller pipeline                                        | Architecture |
| 3   | Top toolbar added — chart type switcher, symbol dropdown, timeframe buttons (M5/M15/M30/H1), light/dark toggle                         | New          |
| 4   | Left panel: chart type switching (Candle/Bar/Line) + trendlines (golden plots) with hide/unhide toggle                                 | Updated      |
| 5   | Right panel top: complete rewrite — SSA + EMA-SSA + fractal markers (108/119) + trendlines + polygon blobs + sandwich price labels     | Updated      |
| 6   | Right panel bottom: Radar + single Gauge + Matrix removed — replaced with HMI + RPI + BPI gauge charts (same blue, gauge-simple style) | Replaced     |
| 7   | Gauge implementation updated — gauge-simple style, single blue arc, Active Indication with sandwich price per gauge                    | Updated      |
| 8   | File structure updated — remove radar/matrix components, add 3 named gauge components + toolbar                                        | Updated      |
| 9   | Data flow diagram updated — FastAPI removed, NestJS Controller as single API surface                                                   | Updated      |
| 10  | API endpoints table updated — remove signals/score and signals/breakdown, add unified payload fields                                   | Updated      |
| 11  | Timeframe options corrected — M5, M15, M30, H1 only (not M15, H1, H4, D1)                                                              | Fixed        |
| 12  | ECharts tree-shaken registration updated — ScatterChart, GaugeChart, GraphicComponent added                                            | Updated      |
| 13  | Checklist completely rewritten to reflect new component architecture                                                                   | Updated      |
| 14  | Appendix A: removed radar/matrix seed code paths                                                                                       | Updated      |
| 15  | Appendix B: new pitfalls added — fractal source, trendline toggle scope, gauge-simple style                                            | Updated      |

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Technology Stack](#2-technology-stack)
3. [Screen Layout Specification](#3-screen-layout-specification)
4. [Left Panel — TradingView Lightweight Charts](#4-left-panel--tradingview-lightweight-charts)
5. [Right Panel — Apache ECharts Supplement](#5-right-panel--apache-echarts-supplement)
   - 5.1 [Heatmap Analytical Chart](#51-heatmap-analytical-chart)
   - 5.2 [Three Gauge Charts — HMI, RPI, BPI](#52-three-gauge-charts--hmi-rpi-bpi)
6. [Frontend Component Architecture (Next.js)](#6-frontend-component-architecture-nextjs)
7. [Data Flow & API Integration](#7-data-flow--api-integration)
8. [Cross-Panel State Synchronization](#8-cross-panel-state-synchronization)
9. [Key Implementation Patterns](#9-key-implementation-patterns)
10. [Vercel Deployment Notes](#10-vercel-deployment-notes)
11. [Implementation Checklist for Claude Code](#11-implementation-checklist-for-claude-code)
12. [Appendix A: Seed Code Reference Paths](#appendix-a-seed-code-reference-paths)
13. [Appendix B: Common Pitfalls](#appendix-b-common-pitfalls)

---

## 1. System Overview

This document defines the architecture for a **dual-panel financial chart UI** that combines two
complementary charting libraries on a single dashboard screen, with a shared top toolbar.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  TOP TOOLBAR (full width)                                                   │
│  [Line|Candle|Bar switcher]  [XAUUSD ▾]  [M5][M15][M30][H1]  [☀/☾ toggle]│
├──────────────────────────────────┬──────────────────────────────────────────┤
│                                  │                                          │
│  LEFT PANEL                      │  RIGHT PANEL TOP                        │
│  TradingView Lightweight Charts  │  Apache ECharts — Heatmap Chart         │
│                                  │                                          │
│  • Candle / Bar / Line           │  • Polygon color gradient blobs (z=0)   │
│    (switchable via toolbar)      │  • SSA line (z=1)                       │
│  • Trendlines — golden plots     │  • EMA-SSA line (z=2)                   │
│    (hide/unhide toggle)          │  • Trendlines — golden plots (z=3)      │
│                                  │  • Fractal down markers MQL5:108 (z=4)  │
│                                  │  • Fractal up markers MQL5:119 (z=5)    │
│                                  │  [▲ upper_sandwich_price] bottom-left   │
│                                  │  [▼ lower_sandwich_price] bottom-left   │
├──────────────────────────────────┼─────────────┬─────────────┬─────────────┤
│  (left panel spans full height)  │  HMI gauge  │  RPI gauge  │  BPI gauge  │
│                                  │  (blue arc) │  (blue arc) │  (blue arc) │
│                                  │  Active     │  Active     │  Active     │
│                                  │  Indication │  Indication │  Indication │
└──────────────────────────────────┴─────────────┴─────────────┴─────────────┘
```

### Design Rationale

| Decision                          | Reason                                                                                                                          |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| TradingView LWC for primary chart | Best-in-class financial chart performance; native candlestick/bar/line; switchable chart types                                  |
| ECharts for supplement panel      | Native support for custom polygon series (blob heatmap), scatter (fractals), gauge, graphic elements (sandwich labels)          |
| Two separate libraries            | Neither library alone covers all required chart types optimally; the split is architecturally clean                             |
| NestJS as single API surface      | Python Celery Worker computes and writes to Redis; NestJS reads Redis and serves all data. Frontend never calls Python directly |
| Next.js `'use client'` components | Both libraries are DOM-based; SSR must be disabled at component level                                                           |

### Index Gauge Interpretation

| Gauge   | Measures                              | Formula source                                                      |
| ------- | ------------------------------------- | ------------------------------------------------------------------- |
| **HMI** | Raw wall strength — distance-agnostic | Base structural power only (`Final_Score / global_max_score × 100`) |
| **RPI** | Wall danger right now                 | Base power × Gaussian proximity decay                               |
| **BPI** | Kinetic breakout probability          | SSA crawl detection + HTF multiplier + ignition bonus               |

High HMI + High RPI + High BPI = a very strong wall is being actively hammered right now.

---

## 2. Technology Stack

```
Frontend:
  Framework:         Next.js 16 (App Router)
  Language:          TypeScript (strict mode)
  Deployment:        Vercel

Charting Libraries:
  Primary:           lightweight-charts (TradingView) — v5.x
  Supplement:        echarts (Apache) — v6.0.0
                     (seed-code at seed-code/echarts/)

Backend API (consumed via NestJS Controller — never Python directly):
  API Server:        NestJS 11 TypeScript (Railway)
  Compute:           Python Celery Worker — Pandas, NumPy, SciPy (KDE), Shapely
  Cache:             Redis — heatmap:zones:{symbol}:{tf} keys
  Primary Endpoint:  GET /api/v1/heatmap/zones  (unified HMI+RPI+BPI+sandwich+blobs)
  OHLCV Endpoint:    GET /api/v1/ohlcv

State Management:
  Cross-panel sync:  React Context or Zustand store
  Chart state:       Local useRef per chart instance
  URL params:        symbol + timeframe stored in URL search params
```

### Package Dependencies

```jsonc
// package.json additions
{
  "dependencies": {
    "lightweight-charts": "^5.0.0",
    "echarts": "^6.0.0",
  },
}
```

> **Note:** Do NOT use `echarts-for-react` or any third-party React wrapper for ECharts. Integrate
> directly via `useRef` + `useEffect`. The seed code at `seed-code/echarts/` is the ECharts v6
> source — reference it for type imports and API understanding.

---

## 3. Screen Layout Specification

### Responsive Breakpoints

| Breakpoint        | Layout                                                 |
| ----------------- | ------------------------------------------------------ |
| `lg` (≥1024px)    | Two columns side-by-side (default)                     |
| `md` (768–1023px) | Two columns, reduced widths                            |
| `< md`            | Single column, stacked (ECharts panel below LWC panel) |

### Tailwind CSS Layout Structure

```tsx
// app/dashboard/chart/page.tsx — outer shell
<div className="flex h-screen w-full flex-col bg-gray-950">
  {/* TOP TOOLBAR — full width, shared controls */}
  <div className="flex h-12 flex-none items-center gap-3 border-b border-gray-800 bg-gray-950 px-3">
    <DashboardToolbar />
  </div>

  {/* MAIN CONTENT — two panels */}
  <div className="flex flex-1 flex-col gap-2 overflow-hidden p-2 lg:flex-row">
    {/* LEFT: TradingView Lightweight Charts */}
    <div className="min-h-[400px] flex-[3] overflow-hidden rounded-lg border border-blue-500/30 lg:min-h-0">
      <LWCPrimaryChart />
    </div>

    {/* RIGHT: ECharts supplement panel */}
    <div className="flex min-h-[600px] flex-[2] flex-col gap-2 lg:min-h-0">
      {/* RIGHT TOP: Heatmap Analytical Chart */}
      <div className="flex-[55] overflow-hidden rounded-lg border border-green-500/30">
        <EChartsHeatmapChart />
      </div>

      {/* RIGHT BOTTOM: 3 gauge charts — HMI | RPI | BPI */}
      <div className="flex flex-[45] flex-row gap-2">
        <div className="flex-1 overflow-hidden rounded-lg border border-green-500/20">
          <EChartsHMIGauge />
        </div>
        <div className="flex-1 overflow-hidden rounded-lg border border-green-500/20">
          <EChartsRPIGauge />
        </div>
        <div className="flex-1 overflow-hidden rounded-lg border border-green-500/20">
          <EChartsBPIGauge />
        </div>
      </div>
    </div>
  </div>
</div>
```

---

## 4. Left Panel — TradingView Lightweight Charts

### Overview

The left panel hosts the primary financial chart. TradingView Lightweight Charts renders directly
onto a `<div>` container via canvas. The component is wrapped in a `'use client'` Next.js component
with `useRef` + `useEffect`.

### Supported Series Types

| Series            | API Call                               | Use Case                      |
| ----------------- | -------------------------------------- | ----------------------------- |
| Candlestick       | `chart.addSeries(CandlestickSeries)`   | Default OHLCV view            |
| Bar               | `chart.addSeries(BarSeries)`           | Alternate OHLCV view          |
| Line              | `chart.addSeries(LineSeries)`          | Close price line view         |
| Trendline markers | `createSeriesMarkers(series, markers)` | Golden plot trendline markers |

### Chart Type Switching

The toolbar chart type switcher controls which series is active. Only one OHLCV series renders
at a time. Trendline markers are added on top of whichever series is active.

```typescript
type ChartType = 'candlestick' | 'bar' | 'line';
```

### Trendlines (Golden Plots)

Golden plot trendlines are rendered as `SeriesMarker` objects on the active OHLCV series.
The hide/unhide toggle applies to the **left panel only** — the ECharts right panel always
displays trendlines regardless of this toggle.

### Component Implementation

```tsx
// components/charts/lwc/LWCPrimaryChart.tsx
'use client';

import { useEffect, useRef } from 'react';
import {
  createChart,
  CandlestickSeries,
  BarSeries,
  LineSeries,
  IChartApi,
  ISeriesApi,
  CandlestickData,
  UTCTimestamp,
  createSeriesMarkers,
} from 'lightweight-charts';
import type { ChartType } from '@/types/chart';
import type { TrendlineMarker } from '@/types/trendline';

interface LWCPrimaryChartProps {
  ohlcvData: CandlestickData[];
  chartType: ChartType;
  showTrendlines: boolean;
  trendlines: TrendlineMarker[];
  onCrosshairMove?: (time: UTCTimestamp | null, price: number | null) => void;
}

export function LWCPrimaryChart({
  ohlcvData,
  chartType,
  showTrendlines,
  trendlines,
  onCrosshairMove,
}: LWCPrimaryChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick' | 'Bar' | 'Line'> | null>(
    null
  );
  const markerApiRef = useRef<ReturnType<typeof createSeriesMarkers> | null>(
    null
  );

  // Initialize chart instance once
  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: {
        background: { color: '#1a1a2e' },
        textColor: '#d1d5db',
      },
      grid: {
        vertLines: { color: '#2d2d3d' },
        horzLines: { color: '#2d2d3d' },
      },
      crosshair: { mode: 1 },
      rightPriceScale: { borderColor: '#374151' },
      timeScale: { borderColor: '#374151', timeVisible: true },
    });
    chartRef.current = chart;
    chart.timeScale().fitContent();

    if (onCrosshairMove) {
      chart.subscribeCrosshairMove((param) => {
        const price = param.seriesData.get(seriesRef.current!);
        onCrosshairMove(
          (param.time as UTCTimestamp) ?? null,
          price ? (price as CandlestickData).close : null
        );
      });
    }

    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, []);

  // Re-create series when chartType changes
  useEffect(() => {
    if (!chartRef.current) return;
    markerApiRef.current?.detach();
    if (seriesRef.current) chartRef.current.removeSeries(seriesRef.current);

    if (chartType === 'candlestick') {
      seriesRef.current = chartRef.current.addSeries(CandlestickSeries, {
        upColor: '#22c55e',
        downColor: '#ef4444',
        borderVisible: false,
        wickUpColor: '#22c55e',
        wickDownColor: '#ef4444',
      });
    } else if (chartType === 'bar') {
      seriesRef.current = chartRef.current.addSeries(BarSeries, {
        upColor: '#22c55e',
        downColor: '#ef4444',
      });
    } else {
      seriesRef.current = chartRef.current.addSeries(LineSeries, {
        color: '#60a5fa',
        lineWidth: 2,
      });
    }
    seriesRef.current.setData(ohlcvData);
  }, [chartType]);

  // Update OHLCV data without re-creating series
  useEffect(() => {
    seriesRef.current?.setData(ohlcvData);
  }, [ohlcvData]);

  // Update trendline markers — left panel only
  useEffect(() => {
    if (!seriesRef.current) return;
    markerApiRef.current?.detach();
    if (showTrendlines && trendlines.length > 0) {
      markerApiRef.current = createSeriesMarkers(seriesRef.current, trendlines);
    } else {
      markerApiRef.current = null;
    }
  }, [showTrendlines, trendlines]);

  return <div ref={containerRef} className="h-full w-full" />;
}
```

### LWC Data Types

```typescript
// types/chart.ts
export type ChartType = 'candlestick' | 'bar' | 'line';

// types/trendline.ts
import type { SeriesMarker, UTCTimestamp } from 'lightweight-charts';
export type TrendlineMarker = SeriesMarker<UTCTimestamp>;
```

---

## 5. Right Panel — Apache ECharts Supplement

### Base ECharts Hook

All ECharts components share the same initialization pattern via a reusable hook:

```tsx
// hooks/useECharts.ts
'use client';

import { useEffect, useRef, useCallback } from 'react';
import { echarts } from '@/lib/echartsInit'; // tree-shaken instance
import type { EChartsOption, ECharts } from 'echarts';

export function useECharts(option: EChartsOption | null) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ECharts | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = echarts.init(containerRef.current, undefined, {
      renderer: 'canvas',
    });
    chartRef.current = chart;
    const ro = new ResizeObserver(() => chart.resize());
    ro.observe(containerRef.current);
    return () => {
      ro.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!chartRef.current || !option) return;
    chartRef.current.setOption(option, { notMerge: false, lazyUpdate: true });
  }, [option]);

  const getChart = useCallback(() => chartRef.current, []);
  return { containerRef, getChart };
}
```

---

### 5.1 Heatmap Analytical Chart

#### Purpose

Renders KDE-computed heat blob polygons from the Python backend as a custom series, overlaid with
SSA / EMA-SSA lines, fractal markers, and golden trendlines. Sandwich price labels are displayed
bottom-left as graphic text elements.

#### Data Layer Z-Order

| Layer                      | z   | Series type            | Data source                                     |
| -------------------------- | --- | ---------------------- | ----------------------------------------------- |
| Heatmap polygon blobs      | 0   | `custom`               | `heat_zones[].polygon` from API                 |
| SSA trend line             | 1   | `line`                 | `ssa` column from Python pipeline               |
| EMA-SSA signal line        | 2   | `line`                 | `ema_ssa` column from Python pipeline           |
| Trendlines — golden plots  | 3   | `custom` or `markLine` | Filtered Golden S&R lines                       |
| Fractal down markers (108) | 4   | `scatter`              | `horiz_low_map` from fractal export             |
| Fractal up markers (119)   | 5   | `scatter`              | `horiz_high_map` from fractal export            |
| Sandwich price labels      | 6   | `graphic`              | `upper_sandwich_price` / `lower_sandwich_price` |

> **Fractal source disambiguation:** `horiz_high_map` = MQL5 arrow code 119 (fractal high ▲).
> `horiz_low_map` = MQL5 arrow code 108 (fractal low ▼). These come from
> `fractal-horizontal-trendline-export-window-period-v3.mq5`, NOT from `ohlcv-export.mq5`.

#### TypeScript Types

```typescript
// types/heatmap.ts
export interface HeatZone {
  id: string;
  intensity: 'high' | 'medium' | 'low' | string;
  color: string; // e.g. "rgba(255, 69, 0, 0.45)"
  polygon: [number, number][]; // [unix_seconds, price] — closed (first === last)
}

export interface SSADataPoint {
  timestamp: number; // Unix seconds
  ssa: number;
  ema_ssa: number;
}

export interface FractalPoint {
  timestamp: number; // Unix seconds
  price: number;
  type: 108 | 119; // 108 = fractal low ▼, 119 = fractal high ▲
}

export interface TrendlineSegment {
  startTime: number; // Unix seconds
  startPrice: number;
  endTime: number; // Unix seconds
  endPrice: number;
}

export interface SandwichPrices {
  upper: number; // upper_sandwich_price from API payload
  lower: number; // lower_sandwich_price from API payload
}

export interface HeatmapApiResponse {
  status: 'success' | 'pending';
  symbol: string;
  timeframe: string;
  last_updated: number;
  active_hmi: number;
  active_hmi_type: string;
  active_rpi: number;
  active_rpi_type: string;
  active_bpi: number;
  active_bpi_type: string;
  distance_to_active: number;
  entropy: number;
  ssa_regime: 'Trend' | 'Transition' | 'Chaotic';
  upper_sandwich_price: number;
  lower_sandwich_price: number;
  data: { heat_zones: HeatZone[] };
}
```

#### Timestamp Helper — Critical

```typescript
// constants/time.ts
// ECharts 'time' axis requires milliseconds.
// All API timestamps are Unix seconds. Convert at the boundary.
export const toEChartsMs = (unixSeconds: number): number => unixSeconds * 1000;
export const toLWCSeconds = (unixMs: number): number =>
  Math.floor(unixMs / 1000);
```

#### ECharts Option Builder

```typescript
// lib/charts/heatmapChartOption.ts
import type { EChartsOption } from 'echarts';
import { toEChartsMs } from '@/constants/time';
import type {
  HeatZone,
  SSADataPoint,
  FractalPoint,
  TrendlineSegment,
  SandwichPrices,
} from '@/types/heatmap';

export function buildHeatmapChartOption(
  ssaData: SSADataPoint[],
  fractals: FractalPoint[],
  trendlines: TrendlineSegment[],
  heatZones: HeatZone[],
  sandwich: SandwichPrices
): EChartsOption {
  return {
    backgroundColor: 'transparent',
    animation: false,
    xAxis: { type: 'time', splitLine: { show: false } },
    yAxis: {
      type: 'value',
      scale: true,
      splitLine: { lineStyle: { color: '#2d2d3d' } },
    },
    dataZoom: [
      { type: 'inside', xAxisIndex: 0 },
      { type: 'slider', xAxisIndex: 0, height: 20 },
    ],

    // Sandwich price labels — graphic elements, bottom-left
    graphic: [
      {
        type: 'text',
        z: 100,
        left: 8,
        bottom: 36,
        style: {
          text: `▲ ${sandwich.upper.toFixed(2)}`,
          fill: '#f59e0b', // amber — upper resistance
          fontSize: 12,
          fontWeight: 'bold',
        },
      },
      {
        type: 'text',
        z: 100,
        left: 8,
        bottom: 16,
        style: {
          text: `▼ ${sandwich.lower.toFixed(2)}`,
          fill: '#3b82f6', // blue — lower support
          fontSize: 12,
          fontWeight: 'bold',
        },
      },
    ],

    series: [
      // Layer 0: Heatmap polygon blobs
      {
        name: 'HeatZones',
        type: 'custom',
        z: 0,
        renderItem: (_params, api) => {
          const rawPolygon = api.value(2) as [number, number][];
          const screenPoints = rawPolygon.map((c) =>
            api.coord([toEChartsMs(c[0]), c[1]])
          );
          return {
            type: 'polygon',
            shape: { points: screenPoints },
            style: api.style({ fill: api.value(3) as string, stroke: 'none' }),
          };
        },
        data: heatZones.map((z) => [0, 0, z.polygon, z.color]),
        encode: { tooltip: [] },
      },

      // Layer 1: SSA trend line
      {
        name: 'SSA',
        type: 'line',
        z: 1,
        symbol: 'none',
        lineStyle: { width: 2, color: '#a855f7' }, // purple
        data: ssaData.map((d) => [toEChartsMs(d.timestamp), d.ssa]),
        emphasis: { disabled: true },
      },

      // Layer 2: EMA-SSA signal line
      {
        name: 'EMA-SSA',
        type: 'line',
        z: 2,
        symbol: 'none',
        lineStyle: { width: 1.5, color: '#06b6d4', type: 'dashed' }, // cyan dashed
        data: ssaData.map((d) => [toEChartsMs(d.timestamp), d.ema_ssa]),
        emphasis: { disabled: true },
      },

      // Layer 4: Fractal down markers — MQL5 code 108 (▼)
      {
        name: 'FractalDown',
        type: 'scatter',
        z: 4,
        symbol: 'triangle',
        symbolRotate: 180,
        symbolSize: 8,
        itemStyle: { color: '#ef4444' }, // red
        data: fractals
          .filter((f) => f.type === 108)
          .map((f) => [toEChartsMs(f.timestamp), f.price]),
      },

      // Layer 5: Fractal up markers — MQL5 code 119 (▲)
      {
        name: 'FractalUp',
        type: 'scatter',
        z: 5,
        symbol: 'triangle',
        symbolSize: 8,
        itemStyle: { color: '#22c55e' }, // green
        data: fractals
          .filter((f) => f.type === 119)
          .map((f) => [toEChartsMs(f.timestamp), f.price]),
      },
    ],
  };
}
```

> **Trendlines (Layer 3):** Golden plot trendlines span from `startTime/startPrice` to
> `endTime/endPrice`. Render as ECharts `markLine` within a helper line series, or as a `custom`
> series. Convert all timestamps via `toEChartsMs`. ECharts trendlines are **always visible**
> regardless of the left panel hide/unhide toggle.

#### Component

```tsx
// components/charts/echarts/EChartsHeatmapChart.tsx
'use client';

import { useMemo } from 'react';
import { useECharts } from '@/hooks/useECharts';
import { buildHeatmapChartOption } from '@/lib/charts/heatmapChartOption';
import type {
  SSADataPoint,
  FractalPoint,
  TrendlineSegment,
  HeatZone,
  SandwichPrices,
} from '@/types/heatmap';

interface Props {
  ssaData: SSADataPoint[];
  fractals: FractalPoint[];
  trendlines: TrendlineSegment[];
  heatZones: HeatZone[];
  sandwich: SandwichPrices;
}

export function EChartsHeatmapChart({
  ssaData,
  fractals,
  trendlines,
  heatZones,
  sandwich,
}: Props) {
  const option = useMemo(
    () =>
      buildHeatmapChartOption(
        ssaData,
        fractals,
        trendlines,
        heatZones,
        sandwich
      ),
    [ssaData, fractals, trendlines, heatZones, sandwich]
  );
  const { containerRef } = useECharts(option);
  return <div ref={containerRef} className="h-full w-full" />;
}
```

---

### 5.2 Three Gauge Charts — HMI, RPI, BPI

All three gauges use the **ECharts `gauge-simple` style** — single blue progress arc, needle,
numeric value center, 0–100 scale, same blue color for all three. Each gauge additionally shows
an **Active Indication** text label below the numeric value.

#### Active Indication

The Active Indication shows:

- The `active_*_type` string (e.g. `Resistance` / `Support Breakdown`)
- The closest active sandwich trendline **price level** (upper or lower depending on active type)

#### Gauge Option Builder

```typescript
// lib/charts/gaugeOption.ts
import type { EChartsOption } from 'echarts';

export interface GaugeData {
  indexType: 'HMI' | 'RPI' | 'BPI';
  value: number; // active_hmi / active_rpi / active_bpi (0–99.9)
  activeType: string; // e.g. 'Resistance' / 'Support Breakdown'
  sandwichPrice: number; // closest active sandwich price level
  sandwichLabel: string; // 'Upper' | 'Lower'
}

export function buildGaugeOption(data: GaugeData): EChartsOption {
  return {
    tooltip: {
      formatter: '{a} <br/>{b} : {c}',
    },
    series: [
      {
        name: data.indexType,
        type: 'gauge',
        progress: { show: true },
        detail: {
          valueAnimation: true,
          formatter: (value: number) =>
            `{value|${Math.round(value)}}\n{active|${data.activeType}}\n{price|${data.sandwichLabel}: ${data.sandwichPrice.toFixed(2)}}`,
          rich: {
            value: { fontSize: 28, fontWeight: 'bold', color: '#1e40af' },
            active: { fontSize: 11, color: '#6b7280', lineHeight: 18 },
            price: { fontSize: 11, color: '#6b7280', lineHeight: 18 },
          },
          offsetCenter: [0, '60%'],
        },
        data: [{ value: Math.round(data.value), name: data.indexType }],
      },
    ],
  };
}
```

#### Gauge Component (shared — instantiated 3 times)

```tsx
// components/charts/echarts/EChartsGaugeChart.tsx
'use client';

import { useMemo } from 'react';
import { useECharts } from '@/hooks/useECharts';
import { buildGaugeOption, type GaugeData } from '@/lib/charts/gaugeOption';

export function EChartsGaugeChart({ data }: { data: GaugeData }) {
  const option = useMemo(() => buildGaugeOption(data), [data]);
  const { containerRef } = useECharts(option);
  return <div ref={containerRef} className="h-full w-full" />;
}
```

#### Named Gauge Wrappers

```tsx
// components/charts/echarts/EChartsHMIGauge.tsx
import { EChartsGaugeChart } from './EChartsGaugeChart';
import type { HeatmapApiResponse } from '@/types/heatmap';

export function EChartsHMIGauge({ payload }: { payload: HeatmapApiResponse }) {
  const isResistance = payload.active_hmi_type
    .toLowerCase()
    .includes('resistance');
  return (
    <EChartsGaugeChart
      data={{
        indexType: 'HMI',
        value: payload.active_hmi,
        activeType: payload.active_hmi_type,
        sandwichPrice: isResistance
          ? payload.upper_sandwich_price
          : payload.lower_sandwich_price,
        sandwichLabel: isResistance ? 'Upper' : 'Lower',
      }}
    />
  );
}

// components/charts/echarts/EChartsRPIGauge.tsx
export function EChartsRPIGauge({ payload }: { payload: HeatmapApiResponse }) {
  const isResistance = payload.active_rpi_type
    .toLowerCase()
    .includes('resistance');
  return (
    <EChartsGaugeChart
      data={{
        indexType: 'RPI',
        value: payload.active_rpi,
        activeType: payload.active_rpi_type,
        sandwichPrice: isResistance
          ? payload.upper_sandwich_price
          : payload.lower_sandwich_price,
        sandwichLabel: isResistance ? 'Upper' : 'Lower',
      }}
    />
  );
}

// components/charts/echarts/EChartsBPIGauge.tsx
export function EChartsBPIGauge({ payload }: { payload: HeatmapApiResponse }) {
  const isResistance = payload.active_bpi_type
    .toLowerCase()
    .includes('resistance');
  return (
    <EChartsGaugeChart
      data={{
        indexType: 'BPI',
        value: payload.active_bpi,
        activeType: payload.active_bpi_type,
        sandwichPrice: isResistance
          ? payload.upper_sandwich_price
          : payload.lower_sandwich_price,
        sandwichLabel: isResistance ? 'Upper' : 'Lower',
      }}
    />
  );
}
```

---

## 6. Frontend Component Architecture (Next.js)

### File Structure

```
app/
  dashboard/
    chart/
      page.tsx                          ← Route entry, server component, fetches data
      loading.tsx                       ← Suspense loading skeleton

components/
  charts/
    lwc/
      LWCPrimaryChart.tsx               ← Left panel — LWC container
      LWCPrimaryChart.types.ts          ← Prop types

    echarts/
      EChartsHeatmapChart.tsx           ← Right panel top — blobs + SSA + fractals + trendlines
      EChartsGaugeChart.tsx             ← Shared gauge component (instantiated 3×)
      EChartsHMIGauge.tsx               ← HMI gauge wrapper
      EChartsRPIGauge.tsx               ← RPI gauge wrapper
      EChartsBPIGauge.tsx               ← BPI gauge wrapper

  layout/
    DualPanelLayout.tsx                 ← Two-column responsive wrapper

  controls/
    DashboardToolbar.tsx                ← Chart type switcher + symbol + timeframe + theme

hooks/
  useECharts.ts                         ← Shared ECharts init/resize hook
  useChartSync.ts                       ← Cross-panel crosshair synchronization

lib/
  charts/
    heatmapChartOption.ts               ← ECharts option: blobs + SSA + fractals + trendlines
    gaugeOption.ts                      ← ECharts option: gauge-simple
  echartsInit.ts                        ← Tree-shaken ECharts registration

constants/
  time.ts                               ← toEChartsMs / toLWCSeconds helpers

types/
  heatmap.ts                            ← HeatZone, SSADataPoint, FractalPoint, HeatmapApiResponse
  chart.ts                              ← ChartType
  trendline.ts                          ← TrendlineMarker, TrendlineSegment
  ohlcv.ts                              ← OHLCV bar types
```

### Top Toolbar Component

```tsx
// components/controls/DashboardToolbar.tsx
'use client';

import { useRouter, useSearchParams } from 'next/navigation';

const TIMEFRAMES = ['M5', 'M15', 'M30', 'H1'];
type ChartType = 'line' | 'candlestick' | 'bar';

interface ToolbarProps {
  chartType: ChartType;
  showTrendlines: boolean;
  onChartType: (t: ChartType) => void;
  onToggleTrendlines: () => void;
  onToggleTheme: () => void;
}

export function DashboardToolbar({
  chartType,
  showTrendlines,
  onChartType,
  onToggleTrendlines,
  onToggleTheme,
}: ToolbarProps) {
  const router = useRouter();
  const params = useSearchParams();
  const activeSymbol = params.get('symbol') ?? 'XAUUSD';
  const activeTimeframe = params.get('timeframe') ?? 'M5';

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    next.set(key, value);
    router.push(`?${next.toString()}`);
  };

  return (
    <div className="flex w-full items-center gap-3">
      {/* Chart type switcher — controls left panel */}
      <div className="flex gap-1">
        {(['line', 'candlestick', 'bar'] as ChartType[]).map((t) => (
          <button
            key={t}
            onClick={() => onChartType(t)}
            className={`rounded px-2 py-1 text-xs ${
              chartType === t
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400'
            }`}
          >
            {t === 'line' ? '〜' : t === 'candlestick' ? '┃┃' : '▌▌'}
          </button>
        ))}
      </div>

      {/* Trendlines toggle — left panel only */}
      <button
        onClick={onToggleTrendlines}
        className={`rounded px-2 py-1 text-xs ${
          showTrendlines
            ? 'bg-yellow-600 text-white'
            : 'bg-gray-800 text-gray-400'
        }`}
      >
        Trendlines
      </button>

      {/* Symbol dropdown */}
      <select
        className="rounded bg-gray-800 px-2 py-1 text-sm text-gray-200"
        value={activeSymbol}
        onChange={(e) => updateParam('symbol', e.target.value)}
      >
        <option value="XAUUSD">XAUUSD</option>
      </select>

      {/* Timeframe buttons — controls both panels simultaneously */}
      <div className="flex gap-1">
        {TIMEFRAMES.map((tf) => (
          <button
            key={tf}
            onClick={() => updateParam('timeframe', tf)}
            className={`rounded border px-2 py-1 text-xs ${
              activeTimeframe === tf
                ? 'border-green-400 bg-green-900/30 text-green-300'
                : 'border-gray-700 bg-gray-800 text-gray-400'
            }`}
          >
            {tf}
          </button>
        ))}
      </div>

      {/* Light / Dark mode toggle */}
      <button
        onClick={onToggleTheme}
        className="ml-auto rounded bg-gray-800 px-2 py-1 text-xs text-gray-300"
      >
        ☀/☾
      </button>
    </div>
  );
}
```

### Page Component (Server Route)

```tsx
// app/dashboard/chart/page.tsx
import { Suspense } from 'react';
import { DualPanelLayout } from '@/components/layout/DualPanelLayout';
import { ChartLoadingSkeleton } from './loading';

// Server component — BACKEND_URL = NestJS Controller on Railway (never Python directly)
export default async function ChartPage({
  searchParams,
}: {
  searchParams: { symbol?: string; timeframe?: string };
}) {
  const symbol = searchParams.symbol ?? 'XAUUSD';
  const timeframe = searchParams.timeframe ?? 'M5';

  const BACKEND_URL = process.env.BACKEND_URL; // NestJS Controller on Railway

  // Parallel fetch — unified heatmap/index payload + OHLCV
  const [heatmapRes, ohlcvRes] = await Promise.all([
    fetch(
      `${BACKEND_URL}/api/v1/heatmap/zones?symbol=${symbol}&timeframe=${timeframe}`,
      {
        next: { revalidate: 300 },
      }
    ),
    fetch(
      `${BACKEND_URL}/api/v1/ohlcv?symbol=${symbol}&timeframe=${timeframe}`,
      {
        next: { revalidate: 60 },
      }
    ),
  ]);

  const heatmap = await heatmapRes.json();
  const ohlcv = await ohlcvRes.json();

  return (
    <Suspense fallback={<ChartLoadingSkeleton />}>
      <DualPanelLayout
        heatmapPayload={heatmap}
        ohlcvData={ohlcv.data}
        symbol={symbol}
        timeframe={timeframe}
      />
    </Suspense>
  );
}
```

### DualPanelLayout Component

```tsx
// components/layout/DualPanelLayout.tsx
'use client';

import { useState, useCallback } from 'react';
import { LWCPrimaryChart } from '@/components/charts/lwc/LWCPrimaryChart';
import { EChartsHeatmapChart } from '@/components/charts/echarts/EChartsHeatmapChart';
import { EChartsHMIGauge } from '@/components/charts/echarts/EChartsHMIGauge';
import { EChartsRPIGauge } from '@/components/charts/echarts/EChartsRPIGauge';
import { EChartsBPIGauge } from '@/components/charts/echarts/EChartsBPIGauge';
import { DashboardToolbar } from '@/components/controls/DashboardToolbar';
import type { HeatmapApiResponse } from '@/types/heatmap';
import type { CandlestickData, UTCTimestamp } from 'lightweight-charts';
import type { ChartType } from '@/types/chart';

interface Props {
  heatmapPayload: HeatmapApiResponse;
  ohlcvData: CandlestickData[];
  symbol: string;
  timeframe: string;
}

export function DualPanelLayout({
  heatmapPayload,
  ohlcvData,
  symbol,
  timeframe,
}: Props) {
  const [chartType, setChartType] = useState<ChartType>('candlestick');
  const [showTrendlines, setShowTrendlines] = useState(true);
  const [darkMode, setDarkMode] = useState(true);

  const handleCrosshairMove = useCallback(
    (_time: UTCTimestamp | null, _price: number | null) => {
      // Extend: drive ECharts axisPointer programmatically if needed
    },
    []
  );

  const sandwich = {
    upper: heatmapPayload.upper_sandwich_price,
    lower: heatmapPayload.lower_sandwich_price,
  };

  return (
    <div
      className={`flex h-screen w-full flex-col ${darkMode ? 'bg-gray-950' : 'bg-white'}`}
    >
      {/* TOOLBAR */}
      <div className="flex h-12 flex-none items-center gap-3 border-b border-gray-800 px-3">
        <DashboardToolbar
          chartType={chartType}
          showTrendlines={showTrendlines}
          onChartType={setChartType}
          onToggleTrendlines={() => setShowTrendlines((v) => !v)}
          onToggleTheme={() => setDarkMode((v) => !v)}
        />
      </div>

      {/* MAIN */}
      <div className="flex flex-1 flex-col gap-2 overflow-hidden p-2 lg:flex-row">
        {/* LEFT: TradingView */}
        <div className="min-h-[400px] flex-[3] overflow-hidden rounded-lg border border-blue-500/30 lg:min-h-0">
          <LWCPrimaryChart
            ohlcvData={ohlcvData}
            chartType={chartType}
            showTrendlines={showTrendlines}
            trendlines={[]} // pass golden trendline markers from API here
            onCrosshairMove={handleCrosshairMove}
          />
        </div>

        {/* RIGHT: ECharts */}
        <div className="flex min-h-[600px] flex-[2] flex-col gap-2 lg:min-h-0">
          {/* TOP: Heatmap analytical chart */}
          <div className="flex-[55] overflow-hidden rounded-lg border border-green-500/30">
            <EChartsHeatmapChart
              ssaData={[]} // pass from API
              fractals={[]} // pass from API
              trendlines={[]} // pass from API
              heatZones={heatmapPayload.data.heat_zones}
              sandwich={sandwich}
            />
          </div>

          {/* BOTTOM: 3 gauges */}
          <div className="flex flex-[45] flex-row gap-2">
            <div className="flex-1 overflow-hidden rounded-lg border border-green-500/20">
              <EChartsHMIGauge payload={heatmapPayload} />
            </div>
            <div className="flex-1 overflow-hidden rounded-lg border border-green-500/20">
              <EChartsRPIGauge payload={heatmapPayload} />
            </div>
            <div className="flex-1 overflow-hidden rounded-lg border border-green-500/20">
              <EChartsBPIGauge payload={heatmapPayload} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

## 7. Data Flow & API Integration

### End-to-End Data Pipeline

```
MT5 terminals (Contabo VPS)
  → Export Advisor EA (MQL5)
  → BullMQ (NestJS 11, Railway)
  → NestJS Worker (Railway)
  → Redis Job Queue          ← Celery broker: async job handoff (NO FastAPI)
  → Python Celery Worker     ← Pandas + NumPy + SciPy (KDE) + Shapely (Railway)
      ├── Phase 1-3: Trendline scoring → Confluence Nodes
      ├── Phase 4.0: SSA + entropy (3-state, matches Entropy_IT.mq5)
      ├── Phase 4: BPI pipeline
      ├── Phase 5: RPI pipeline
      ├── Phase 5.1: HMI pipeline
      └── Heatmap: KDE → Shapely polygons
  → Redis heatmap cache      ← key: heatmap:zones:{symbol}:{timeframe}
  → NestJS Controller        ← reads Redis, single API surface (Railway)
  → Next.js page.tsx         ← server component, parallel fetch
      ├── LEFT:  LWCPrimaryChart (ohlcvData)
      └── RIGHT: EChartsHeatmapChart (blobs + SSA + fractals + trendlines)
                 EChartsHMIGauge  (active_hmi)
                 EChartsRPIGauge  (active_rpi)
                 EChartsBPIGauge  (active_bpi)
```

### API Endpoints

| Endpoint                | Method | Provider                             | Revalidate | Returns                                             |
| ----------------------- | ------ | ------------------------------------ | ---------- | --------------------------------------------------- |
| `/api/v1/heatmap/zones` | GET    | NestJS Controller (reads Redis)      | 300s       | Unified payload: HMI+RPI+BPI+sandwich+blobs+entropy |
| `/api/v1/ohlcv`         | GET    | NestJS Controller (reads PostgreSQL) | 60s        | OHLCV bars for LWC                                  |

### Unified API Response Shape

```typescript
// Single endpoint returns all frontend data needs:
GET /api/v1/heatmap/zones?symbol=XAUUSD&timeframe=M5

{
  status:               'success',
  symbol:               'XAUUSD',
  timeframe:            'M5',
  last_updated:         1775030400,
  active_hmi:           85.2,
  active_hmi_type:      'Resistance',
  active_rpi:           72.4,
  active_rpi_type:      'Resistance',
  active_bpi:           61.8,
  active_bpi_type:      'Resistance Breakout',
  distance_to_active:   4.25,
  entropy:              0.42,
  ssa_regime:           'Transition',
  upper_sandwich_price: 4747.70,
  lower_sandwich_price: 4666.96,
  data: {
    heat_zones: [
      {
        id:       'zone_high_XAUUSD_M5',
        intensity: 'high',
        color:    'rgba(255, 69, 0, 0.45)',
        polygon:  [[1775028900, 4720.50], [1775030400, 4735.00], ...]
      }
    ]
  }
}
```

### Environment Variables (Vercel)

```bash
# .env.local
BACKEND_URL=https://your-nestjs-railway-app.up.railway.app  # NestJS Controller — NOT Python
```

---

## 8. Cross-Panel State Synchronization

### Crosshair Synchronization (LWC → ECharts)

```tsx
// hooks/useChartSync.ts
'use client';

import { useState, useCallback, useRef } from 'react';
import type { ECharts } from 'echarts';

export interface CrosshairState {
  time: number | null;
  price: number | null;
}

export function useChartSync() {
  const [crosshair, setCrosshair] = useState<CrosshairState>({
    time: null,
    price: null,
  });
  const echartsRef = useRef<ECharts | null>(null);

  const onLWCCrosshairMove = useCallback(
    (time: number | null, price: number | null) => {
      setCrosshair({ time, price });
      if (echartsRef.current && time !== null) {
        echartsRef.current.dispatchAction({
          type: 'showTip',
          seriesIndex: 1, // SSA line series index
        });
      }
    },
    []
  );

  return { crosshair, onLWCCrosshairMove, echartsRef };
}
```

### Timeframe Selector Behaviour

- Options: **M5 | M15 | M30 | H1** only
- Changing timeframe updates URL search params → server component re-fetches → **both panels
  update simultaneously**
- Trendlines are always calculated from all timeframes (M5 through D1) and filtered to Golden
  plots. The timeframe selector only changes which timeframe's OHLCV is displayed on chart.

---

## 9. Key Implementation Patterns

### Pattern 1: SSR Safety

```tsx
// All chart components MUST have 'use client' at the top
'use client';
// Never import charting libraries in server components
```

For dynamic import at page level if needed:

```tsx
import dynamic from 'next/dynamic';
const DualPanelLayout = dynamic(
  () =>
    import('@/components/layout/DualPanelLayout').then(
      (m) => m.DualPanelLayout
    ),
  { ssr: false }
);
```

### Pattern 2: Chart Resize Handling

```tsx
// Both libraries need explicit resize on container change
const ro = new ResizeObserver(() => chartRef.current?.resize()); // ECharts
const ro = new ResizeObserver(() => {}); // LWC uses autoSize: true
```

### Pattern 3: ECharts Option Updates (No Re-init)

```tsx
// CORRECT — update existing instance, never re-create
chartRef.current?.setOption(option, { notMerge: false, lazyUpdate: true });
```

### Pattern 4: ECharts Tree-Shaking

```typescript
// lib/echartsInit.ts — import from here, not from 'echarts' directly
import * as echarts from 'echarts/core';
import {
  LineChart,
  CustomChart,
  ScatterChart,
  GaugeChart,
} from 'echarts/charts';
import {
  GridComponent,
  TooltipComponent,
  DataZoomComponent,
  GraphicComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([
  LineChart,
  CustomChart,
  ScatterChart,
  GaugeChart,
  GridComponent,
  TooltipComponent,
  DataZoomComponent,
  GraphicComponent,
  CanvasRenderer,
]);

export { echarts };
```

### Pattern 5: Timestamp Unit Consistency

```typescript
// constants/time.ts
export const toEChartsMs = (unixSeconds: number): number => unixSeconds * 1000;
export const toLWCSeconds = (unixMs: number): number =>
  Math.floor(unixMs / 1000);

// Rule: all API timestamps are Unix seconds
// ECharts 'time' axis requires milliseconds → always toEChartsMs() before passing
// LWC requires seconds → always toLWCSeconds() before passing
```

---

## 10. Vercel Deployment Notes

### Next.js Config

```typescript
// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: [],
  serverExternalPackages: [],

  // Proxy to NestJS Controller on Railway — NOT Python
  async rewrites() {
    return [
      {
        source: '/api/backend/:path*',
        destination: `${process.env.BACKEND_URL}/:path*`,
      },
    ];
  },
};

export default nextConfig;
```

### Vercel Environment Variables

| Variable      | Environment         | Value                                            |
| ------------- | ------------------- | ------------------------------------------------ |
| `BACKEND_URL` | Production, Preview | `https://your-nestjs-railway-app.up.railway.app` |
| `BACKEND_URL` | Development         | `http://localhost:3001` (NestJS local port)      |

> **Important:** `BACKEND_URL` points to the **NestJS Controller** on Railway, never to a Python
> service. Python Celery Worker writes to Redis; NestJS reads Redis and serves all frontend APIs.

### Bundle Size

ECharts full bundle ~1MB. Tree-shaking via `lib/echartsInit.ts` reduces to ~200–400KB.
Lightweight Charts ~50KB.

```bash
ANALYZE=true next build
```

### Runtime

```typescript
// app/dashboard/chart/page.tsx
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
```

---

## 11. Implementation Checklist for Claude Code

### Phase A: Setup

- [ ] Install `lightweight-charts@^5.0.0` and `echarts@6.0.0`
- [ ] Create `types/heatmap.ts` — `HeatZone`, `SSADataPoint`, `FractalPoint`, `TrendlineSegment`, `SandwichPrices`, `HeatmapApiResponse`
- [ ] Create `types/chart.ts` — `ChartType`
- [ ] Create `types/trendline.ts` — `TrendlineMarker`, `TrendlineSegment`
- [ ] Create `types/ohlcv.ts` — OHLCV bar types
- [ ] Create `hooks/useECharts.ts` — shared init/resize hook
- [ ] Create `hooks/useChartSync.ts` — crosshair sync
- [ ] Create `lib/echartsInit.ts` — tree-shaken registration (LineChart, CustomChart, ScatterChart, GaugeChart, GraphicComponent)
- [ ] Create `constants/time.ts` — `toEChartsMs`, `toLWCSeconds`

### Phase B: Toolbar

- [ ] Create `components/controls/DashboardToolbar.tsx`
  - [ ] Chart type icon switcher (line/candlestick/bar) — controls left panel
  - [ ] Trendlines hide/unhide toggle — left panel only
  - [ ] Symbol dropdown (XAUUSD)
  - [ ] Timeframe buttons: M5 | M15 | M30 | H1 — both panels
  - [ ] Light/Dark mode toggle

### Phase C: Left Panel — LWC

- [ ] Create `components/charts/lwc/LWCPrimaryChart.tsx`
  - [ ] `'use client'` directive
  - [ ] `useRef` for chart + series + markerApi instances
  - [ ] `useEffect` init/cleanup — `chart.remove()` on unmount
  - [ ] Chart type switching — `CandlestickSeries` / `BarSeries` / `LineSeries`
  - [ ] Trendline markers via `createSeriesMarkers()` — hidden when `showTrendlines=false`
  - [ ] Crosshair callback (`onCrosshairMove` prop)
  - [ ] Data update without re-init
  - [ ] `autoSize: true`

### Phase D: Right Panel Top — ECharts Heatmap

- [ ] Create `lib/charts/heatmapChartOption.ts`
  - [ ] Layer 0: heatmap polygon blobs — `custom` series, `z: 0`
  - [ ] Layer 1: SSA line — `z: 1`, purple
  - [ ] Layer 2: EMA-SSA line — `z: 2`, cyan dashed
  - [ ] Layer 3: trendlines (golden plots) — always visible
  - [ ] Layer 4: fractal down (code 108) — `scatter`, triangle rotated 180, red, `z: 4`
  - [ ] Layer 5: fractal up (code 119) — `scatter`, triangle, green, `z: 5`
  - [ ] Sandwich price labels — `graphic` text, bottom-left, amber upper / blue lower
  - [ ] `toEChartsMs()` on all timestamps
  - [ ] `animation: false`
  - [ ] `dataZoom` component
- [ ] Create `components/charts/echarts/EChartsHeatmapChart.tsx`
  - [ ] `'use client'` directive
  - [ ] `useECharts` hook
  - [ ] `useMemo` for option

### Phase E: Right Panel Bottom — Three Gauge Charts

- [ ] Create `lib/charts/gaugeOption.ts`
  - [ ] `gauge-simple` style — single blue arc, needle, 0–100
  - [ ] `progress: { show: true }`
  - [ ] `valueAnimation: true`
  - [ ] Rich text detail: numeric value + active type + sandwich price
- [ ] Create `components/charts/echarts/EChartsGaugeChart.tsx` — shared gauge component
- [ ] Create `components/charts/echarts/EChartsHMIGauge.tsx` — HMI wrapper
- [ ] Create `components/charts/echarts/EChartsRPIGauge.tsx` — RPI wrapper
- [ ] Create `components/charts/echarts/EChartsBPIGauge.tsx` — BPI wrapper

### Phase F: Layout & Integration

- [ ] Create `components/layout/DualPanelLayout.tsx`
  - [ ] Full-height flex column: toolbar + main
  - [ ] Main: `flex-[3]` left, `flex-[2]` right
  - [ ] Right: `flex-[55]` top, `flex-[45]` bottom
  - [ ] Bottom: 3× `flex-1` equal gauges
  - [ ] `chartType` + `showTrendlines` + `darkMode` state
- [ ] Create `app/dashboard/chart/page.tsx`
  - [ ] Server component
  - [ ] Parallel fetch: `heatmap/zones` + `ohlcv`
  - [ ] `BACKEND_URL` = NestJS Controller (verify not Python)
  - [ ] `next: { revalidate: 300 }` on heatmap, `60` on ohlcv
- [ ] Responsive layout: `flex-col` mobile, `flex-row` on `lg`

### Phase G: Validation

- [ ] No SSR errors (`window is not defined`) — all chart code in `'use client'`
- [ ] ECharts polygon blobs render at correct price/time coordinates
- [ ] Timestamp unit consistency: seconds at API boundary, ×1000 inside `toEChartsMs`
- [ ] Fractal 108 renders as red down-triangle, fractal 119 as green up-triangle
- [ ] Sandwich price labels visible bottom-left of heatmap panel
- [ ] All 3 gauges display correct values with Active Indication
- [ ] Trendline hide/unhide affects left panel only — right ECharts unaffected
- [ ] Timeframe change updates both panels simultaneously
- [ ] `ResizeObserver` cleanup on unmount — no memory leaks
- [ ] `chart.dispose()` / `chart.remove()` called on unmount
- [ ] `BACKEND_URL` points to NestJS Railway URL in Vercel env vars
- [ ] Vercel build succeeds (`next build`)

---

## Appendix A: Seed Code Reference Paths

| What                          | Path in Repo                                                                                                           |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| LWC candlestick series        | `seed-code/lightweight-charts/src/`                                                                                    |
| LWC createSeriesMarkers       | `seed-code/lightweight-charts/src/`                                                                                    |
| ECharts source                | `seed-code/echarts/src/`                                                                                               |
| ECharts custom series         | `seed-code/echarts/src/chart/custom/`                                                                                  |
| ECharts gauge                 | `seed-code/echarts/src/chart/gauge/`                                                                                   |
| ECharts scatter               | `seed-code/echarts/src/chart/scatter/`                                                                                 |
| ECharts all chart exports     | `seed-code/echarts/src/export/charts.ts`                                                                               |
| Python core backend blueprint | `backend-python-computation-stack/davintrade-python-backend-architecture/davintrade-python-backend-architecture-v2.md` |
| Python heatmap blueprint      | `backend-python-computation-stack/davintrade-heatmap-expansion-stack/davintrade-heatmap-expansion-stack-v2.md`         |

---

## Appendix B: Common Pitfalls

| Pitfall                              | Symptom                                        | Fix                                                                                             |
| ------------------------------------ | ---------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Missing `'use client'`               | `window is not defined` at build               | Add `'use client'` to every chart component file                                                |
| Timestamp in seconds for ECharts     | Polygons / fractal markers render at year 2001 | Use `toEChartsMs()` — multiply all timestamps ×1000 before ECharts                              |
| Re-creating ECharts on every render  | Chart flickers / loses zoom state              | Call `setOption()` on existing instance, never re-`init()`                                      |
| LWC `autoSize` not working           | Chart doesn't fill container                   | Ensure parent has explicit height (not `height: auto`)                                          |
| ECharts z-order wrong                | SSA line renders behind blobs                  | Blobs z=0, SSA z=1, EMA-SSA z=2, trendlines z=3, fractals z=4–5                                 |
| Polygon not closed                   | Shapely hull has visual gap                    | Ensure `polygon[0] === polygon[polygon.length-1]` — Python backend guarantees this              |
| ECharts bundle too large             | Slow initial load on Vercel                    | Use `lib/echartsInit.ts` tree-shaking — ScatterChart + GaugeChart + GraphicComponent required   |
| Memory leak on route change          | Browser tab slows over time                    | Call `chart.dispose()` / `chart.remove()` in `useEffect` cleanup                                |
| Fractal markers on wrong axis        | Markers appear at wrong price                  | Fractal 108 = `horiz_low_map`, code 119 = `horiz_high_map`. Both from fractal export, not OHLCV |
| Trendline toggle hides ECharts lines | Right panel trendlines disappear               | Hide/unhide toggle is left panel only. Remove any ECharts trendline visibility wiring           |
| `BACKEND_URL` pointing to Python     | 404 or wrong data from frontend                | `BACKEND_URL` must point to NestJS Railway URL. Python has no HTTP endpoints                    |
| Timeframe options include H4/D1      | Toolbar shows wrong options                    | Options are M5, M15, M30, H1 only — not H4, D1                                                  |
| Gauge uses tri-color axisLine        | Gauge doesn't match design                     | Use `gauge-simple` style — `progress: { show: true }`, no `axisLine.lineStyle.color` array      |
