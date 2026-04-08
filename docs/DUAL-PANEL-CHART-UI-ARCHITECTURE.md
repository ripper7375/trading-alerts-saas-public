# Dual-Panel Chart UI Architecture

**Document Version:** 1.0.0
**Last Updated:** 2026-04-08
**Branch:** `claude/heatmap-line-chart-overlay-efKQV`
**Purpose:** Implementation guide for Claude Code — dual-panel financial chart UI with TradingView Lightweight Charts (left) and Apache ECharts supplement panel (right)

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Technology Stack](#2-technology-stack)
3. [Screen Layout Specification](#3-screen-layout-specification)
4. [Left Panel — TradingView Lightweight Charts](#4-left-panel--tradingview-lightweight-charts)
5. [Right Panel — Apache ECharts Supplement](#5-right-panel--apache-echarts-supplement)
   - 5.1 [Heatmap + Line Overlay Chart](#51-heatmap--line-overlay-chart)
   - 5.2 [Radar Chart](#52-radar-chart)
   - 5.3 [Gauge Chart](#53-gauge-chart)
   - 5.4 [Matrix Chart](#54-matrix-chart)
6. [Frontend Component Architecture (Next.js)](#6-frontend-component-architecture-nextjs)
7. [Data Flow & API Integration](#7-data-flow--api-integration)
8. [Cross-Panel State Synchronization](#8-cross-panel-state-synchronization)
9. [Key Implementation Patterns](#9-key-implementation-patterns)
10. [Vercel Deployment Notes](#10-vercel-deployment-notes)
11. [Implementation Checklist for Claude Code](#11-implementation-checklist-for-claude-code)

---

## 1. System Overview

This document defines the architecture for a **dual-panel financial chart UI** that combines two complementary charting libraries on a single dashboard screen:

```
┌─────────────────────────────────────────────────────────────────────┐
│                     DASHBOARD SCREEN                                │
├──────────────────────────────┬──────────────────────────────────────┤
│                              │                                      │
│   LEFT PANEL (≈60%)          │   RIGHT PANEL (≈40%)                │
│   TradingView                │   Apache ECharts                    │
│   Lightweight Charts         │   (Supplement)                      │
│                              │                                      │
│   • Candlestick series       │   TOP (≈55%):                       │
│   • Bar series               │   • Line + Heatmap Overlay          │
│   • Line series              │     (KDE blob polygons from         │
│   • Symbol/marker plots      │      Python backend)                │
│                              │                                      │
│                              │   BOTTOM (≈45%), split 3-ways:      │
│                              │   • Radar chart                     │
│                              │   • Gauge chart                     │
│                              │   • Matrix chart                    │
│                              │                                      │
└──────────────────────────────┴──────────────────────────────────────┘
```

### Design Rationale

| Decision | Reason |
|---|---|
| Lightweight Charts for primary chart | Best-in-class financial chart performance; native candlestick/bar/line; plugin system for custom overlays |
| ECharts for supplement panel | Native support for custom polygon series (blob heatmap), radar, gauge, and matrix coordinate system — all required in one library |
| Two separate libraries | Neither library alone covers all required chart types optimally; the split is clean and avoids hacking one library to do what the other does natively |
| Next.js `'use client'` components | Both libraries are DOM-based; SSR must be disabled at component level |

---

## 2. Technology Stack

```
Frontend:
  Framework:       Next.js 16 (App Router)
  Language:        TypeScript (strict mode)
  Deployment:      Vercel

Charting Libraries:
  Primary:         lightweight-charts (TradingView) — v5.x
  Supplement:      echarts (Apache) — v6.0.0
                   (seed-code at seed-code/echarts/)

Backend (existing — consumed via API):
  Runtime:         Python / FastAPI
  Computation:     NumPy, SciPy (KDE), Shapely (geometry)
  Cache:           Redis (polygon blob results)
  API Endpoint:    GET /api/v1/heatmap/zones

State Management:
  Cross-panel sync: React Context or Zustand store
  Chart state:     Local useRef per chart instance
```

### Package Dependencies to Install

```jsonc
// package.json additions
{
  "dependencies": {
    "lightweight-charts": "^5.0.0",
    "echarts": "^6.0.0"
  }
}
```

> **Note:** Do NOT use `echarts-for-react` or any third-party React wrapper for ECharts. Integrate directly via `useRef` + `useEffect`. The seed code at `seed-code/echarts/` is the ECharts v6 source — reference it for type imports and API understanding.

---

## 3. Screen Layout Specification

### Responsive Breakpoints

| Breakpoint | Layout |
|---|---|
| `lg` (≥1024px) | Two columns side-by-side (default, as shown in image) |
| `md` (768–1023px) | Two columns, reduced widths |
| `< md` | Single column, stacked (ECharts panel below LWC panel) |

### Tailwind CSS Layout Structure

```tsx
// app/dashboard/chart/page.tsx
<div className="flex flex-col lg:flex-row h-screen w-full gap-2 p-2">

  {/* LEFT: Primary Chart — TradingView Lightweight Charts */}
  <div className="flex-[3] min-h-[400px] lg:min-h-0 border border-blue-400/50 rounded-lg overflow-hidden">
    <LWCPrimaryChart />
  </div>

  {/* RIGHT: Supplement Panel — Apache ECharts */}
  <div className="flex-[2] flex flex-col gap-2 min-h-[600px] lg:min-h-0">

    {/* TOP: Heatmap + Line Overlay */}
    <div className="flex-[55] border border-green-400/50 rounded-lg overflow-hidden">
      <EChartsHeatmapLineChart />
    </div>

    {/* BOTTOM: Explanatory Charts — 3 equal columns */}
    <div className="flex-[45] flex flex-row gap-2">
      <div className="flex-1 border border-green-400/30 rounded-lg overflow-hidden">
        <EChartsRadarChart />
      </div>
      <div className="flex-1 border border-green-400/30 rounded-lg overflow-hidden">
        <EChartsGaugeChart />
      </div>
      <div className="flex-1 border border-green-400/30 rounded-lg overflow-hidden">
        <EChartsMatrixChart />
      </div>
    </div>

  </div>
</div>
```

---

## 4. Left Panel — TradingView Lightweight Charts

### Overview

The left panel hosts the primary financial chart. TradingView Lightweight Charts renders directly onto a `<div>` container via canvas. The component is wrapped in a `'use client'` Next.js component with `useRef` + `useEffect`.

### Supported Series Types

| Series | API Call | Use Case |
|---|---|---|
| Candlestick | `chart.addSeries(CandlestickSeries)` | OHLCV price action |
| Bar | `chart.addSeries(BarSeries)` | Alternate OHLCV display |
| Line | `chart.addSeries(LineSeries)` | Close price / indicator line |
| Area | `chart.addSeries(AreaSeries)` | Filled line for trend |
| Histogram | `chart.addSeries(HistogramSeries)` | Volume bars |
| Symbol Markers | `createSeriesMarkers(series, markers)` | Signal/alert plots on chart |

### Component Implementation

```tsx
// components/charts/lwc/LWCPrimaryChart.tsx
'use client';

import { useEffect, useRef } from 'react';
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  IChartApi,
  ISeriesApi,
  CandlestickData,
  UTCTimestamp,
} from 'lightweight-charts';

interface LWCPrimaryChartProps {
  ohlcvData: CandlestickData[];
  onCrosshairMove?: (time: UTCTimestamp | null, price: number | null) => void;
}

export function LWCPrimaryChart({ ohlcvData, onCrosshairMove }: LWCPrimaryChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize chart
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

    // Candlestick series
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });
    candleSeriesRef.current = candleSeries;
    candleSeries.setData(ohlcvData);

    // Crosshair event — broadcasts to ECharts panel via callback
    if (onCrosshairMove) {
      chart.subscribeCrosshairMove((param) => {
        const price = param.seriesData.get(candleSeries);
        onCrosshairMove(
          param.time as UTCTimestamp ?? null,
          price ? (price as CandlestickData).close : null
        );
      });
    }

    // Fit content
    chart.timeScale().fitContent();

    // Cleanup
    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, []);

  // Update data without re-creating chart
  useEffect(() => {
    if (candleSeriesRef.current && ohlcvData.length > 0) {
      candleSeriesRef.current.setData(ohlcvData);
    }
  }, [ohlcvData]);

  return <div ref={containerRef} className="w-full h-full" />;
}
```

### Symbol Markers (Signal Plots)

```tsx
import { createSeriesMarkers, SeriesMarker, UTCTimestamp } from 'lightweight-charts';

// After series is created:
const markers: SeriesMarker<UTCTimestamp>[] = [
  {
    time: 1704067200 as UTCTimestamp,
    position: 'belowBar',
    color: '#22c55e',
    shape: 'arrowUp',
    text: 'BUY',
  },
  {
    time: 1704153600 as UTCTimestamp,
    position: 'aboveBar',
    color: '#ef4444',
    shape: 'arrowDown',
    text: 'SELL',
  },
];

const markerApi = createSeriesMarkers(candleSeries, markers);
// Cleanup: markerApi.detach() on unmount
```

### LWC Data Types

```typescript
// Types imported from 'lightweight-charts'
import type {
  CandlestickData,   // { time, open, high, low, close }
  LineData,          // { time, value }
  BarData,           // { time, open, high, low, close }
  HistogramData,     // { time, value, color? }
  UTCTimestamp,      // number (Unix seconds)
} from 'lightweight-charts';
```

---

## 5. Right Panel — Apache ECharts Supplement

### Base ECharts Hook

All four ECharts charts share the same initialization pattern. Extract it into a reusable hook:

```tsx
// hooks/useECharts.ts
'use client';

import { useEffect, useRef, useCallback } from 'react';
import * as echarts from 'echarts';
import type { EChartsOption, ECharts } from 'echarts';

export function useECharts(option: EChartsOption | null) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ECharts | null>(null);

  // Initialize
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = echarts.init(containerRef.current, 'dark', {
      renderer: 'canvas',
    });
    chartRef.current = chart;

    // Resize observer
    const ro = new ResizeObserver(() => chart.resize());
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  // Update option
  useEffect(() => {
    if (!chartRef.current || !option) return;
    chartRef.current.setOption(option, { notMerge: false, lazyUpdate: true });
  }, [option]);

  // Expose chart instance for event binding
  const getChart = useCallback(() => chartRef.current, []);

  return { containerRef, getChart };
}
```

---

### 5.1 Heatmap + Line Overlay Chart

#### Purpose

Renders KDE-computed "heat blob" polygon zones (from Python backend) as a custom series, overlaid with a price line — matching the visual in `trendline-heatmap.png`.

#### Data Source

```
Python Backend → Redis → GET /api/v1/heatmap/zones
```

Response shape (from `heatmap-expansion-stack.md`):

```typescript
// types/heatmap.ts
export interface HeatZone {
  id: string;
  intensity: 'high' | 'medium' | 'low';
  color: string;          // e.g. "rgba(255, 69, 0, 0.4)"
  polygon: [number, number][];  // [[timestamp, price], ...] — closed (first === last)
}

export interface HeatmapApiResponse {
  status: 'success';
  symbol: string;
  last_updated: number;
  data: {
    heat_zones: HeatZone[];
  };
}

// Line data point (price line overlay)
export interface LinePricePoint {
  timestamp: number;   // Unix seconds
  price: number;
}
```

#### ECharts Option Builder

```typescript
// lib/charts/heatmapLineOption.ts
import type { EChartsOption, CustomSeriesRenderItemReturn } from 'echarts';
import type { HeatZone, LinePricePoint } from '@/types/heatmap';

export function buildHeatmapLineOption(
  lineData: LinePricePoint[],
  heatZones: HeatZone[]
): EChartsOption {
  return {
    backgroundColor: 'transparent',
    animation: false,        // Disable for performance on dense polygon data
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
    },
    xAxis: {
      type: 'time',
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      scale: true,           // Auto-scale Y axis to data range
      splitLine: { lineStyle: { color: '#2d2d3d' } },
    },
    dataZoom: [
      { type: 'inside', xAxisIndex: 0 },
      { type: 'slider', xAxisIndex: 0, height: 20 },
    ],
    series: [
      // LAYER 0: Heat blob polygons (renders BEHIND line)
      {
        type: 'custom',
        name: 'HeatZones',
        z: 0,
        renderItem: (params, api): CustomSeriesRenderItemReturn => {
          // api.value(2) carries the polygon coordinate array
          const rawPolygon = api.value(2) as [number, number][];
          const color = api.value(3) as string;

          // Map each [timestamp, price] pair to screen [x, y] pixels
          const screenPoints = rawPolygon.map((coord) =>
            api.coord([coord[0] * 1000, coord[1]])  // ECharts 'time' axis expects ms
          );

          return {
            type: 'polygon',
            shape: { points: screenPoints },
            style: {
              fill: color,
              stroke: 'none',
            },
          };
        },
        // Encode polygon + color in data slots [0, 1, polygon, color]
        // Slots 0 and 1 are dummy values required by ECharts custom series
        data: heatZones.map((zone) => [0, 0, zone.polygon, zone.color]),
        encode: { tooltip: [] },
      },
      // LAYER 1: Price line (renders ON TOP of heat zones)
      {
        type: 'line',
        name: 'Price',
        z: 1,
        data: lineData.map((d) => [d.timestamp * 1000, d.price]),
        symbol: 'none',
        lineStyle: { color: '#60a5fa', width: 1.5 },
        emphasis: { disabled: true },
      },
    ],
  };
}
```

#### Component

```tsx
// components/charts/echarts/EChartsHeatmapLineChart.tsx
'use client';

import { useMemo } from 'react';
import { useECharts } from '@/hooks/useECharts';
import { buildHeatmapLineOption } from '@/lib/charts/heatmapLineOption';
import type { HeatZone, LinePricePoint } from '@/types/heatmap';

interface Props {
  lineData: LinePricePoint[];
  heatZones: HeatZone[];
}

export function EChartsHeatmapLineChart({ lineData, heatZones }: Props) {
  const option = useMemo(
    () => buildHeatmapLineOption(lineData, heatZones),
    [lineData, heatZones]
  );

  const { containerRef } = useECharts(option);

  return <div ref={containerRef} className="w-full h-full" />;
}
```

#### Critical Implementation Notes

1. **Timestamp units:** ECharts `'time'` axis expects **milliseconds**. The Python API returns Unix **seconds**. Always multiply by 1000: `timestamp * 1000`.
2. **Polygon must be closed:** The first and last `[timestamp, price]` pair in each zone's polygon array must be identical (from `heatmap-expansion-stack.md`).
3. **Z-ordering:** Set `z: 0` on the custom series and `z: 1` on the line series to ensure blobs render behind the price line.
4. **Animation off:** Set `animation: false` for polygon-heavy datasets to avoid render lag.
5. **`api.coord()` coordinate mapping:** This function is the core mechanism that translates data-space coordinates to pixel-space — it automatically handles pan/zoom state.

---

### 5.2 Radar Chart

#### Purpose

Displays multi-dimensional scoring for the selected trendline/signal — e.g., confluence score, Gaussian touch score, price density, timeframe strength, ATR proximity.

#### Data Types

```typescript
// types/radar.ts
export interface RadarIndicator {
  name: string;
  max: number;
}

export interface RadarDataPoint {
  value: number[];      // One value per indicator, same order
  name: string;
  itemStyle?: { color: string };
}
```

#### ECharts Option Builder

```typescript
// lib/charts/radarOption.ts
import type { EChartsOption } from 'echarts';
import type { RadarIndicator, RadarDataPoint } from '@/types/radar';

export function buildRadarOption(
  indicators: RadarIndicator[],
  dataPoints: RadarDataPoint[]
): EChartsOption {
  return {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item' },
    legend: {
      data: dataPoints.map((d) => d.name),
      bottom: 0,
      textStyle: { color: '#9ca3af', fontSize: 10 },
    },
    radar: {
      indicator: indicators,
      shape: 'polygon',
      splitNumber: 4,
      axisName: { color: '#9ca3af', fontSize: 10 },
      splitLine: { lineStyle: { color: '#374151' } },
      splitArea: { show: false },
      axisLine: { lineStyle: { color: '#374151' } },
    },
    series: [
      {
        type: 'radar',
        data: dataPoints.map((dp) => ({
          value: dp.value,
          name: dp.name,
          itemStyle: dp.itemStyle,
          areaStyle: { opacity: 0.15 },
          lineStyle: { width: 1.5 },
        })),
      },
    ],
  };
}
```

#### Example Usage (scoring dimensions)

```typescript
const indicators: RadarIndicator[] = [
  { name: 'Confluence',    max: 10 },
  { name: 'Gaussian',      max: 10 },
  { name: 'Price Density', max: 10 },
  { name: 'HTF Weight',    max: 10 },
  { name: 'ATR Prox.',     max: 10 },
];

const data: RadarDataPoint[] = [
  {
    name: 'Current Signal',
    value: [8.2, 6.5, 7.1, 9.0, 5.3],
    itemStyle: { color: '#60a5fa' },
  },
];
```

---

### 5.3 Gauge Chart

#### Purpose

Displays a single scalar metric as a speedometer — e.g., overall signal confidence score (0–100), or current confluence score as a percentage of maximum.

#### ECharts Option Builder

```typescript
// lib/charts/gaugeOption.ts
import type { EChartsOption } from 'echarts';

export interface GaugeData {
  label: string;    // Metric name shown below needle
  value: number;    // 0–100
}

export function buildGaugeOption(data: GaugeData): EChartsOption {
  return {
    backgroundColor: 'transparent',
    series: [
      {
        type: 'gauge',
        startAngle: 200,
        endAngle: -20,
        min: 0,
        max: 100,
        splitNumber: 5,
        axisLine: {
          lineStyle: {
            width: 10,
            color: [
              [0.3, '#ef4444'],   // 0–30: red (weak)
              [0.7, '#f59e0b'],   // 30–70: amber (moderate)
              [1,   '#22c55e'],   // 70–100: green (strong)
            ],
          },
        },
        pointer: {
          itemStyle: { color: 'auto' },
          length: '60%',
          width: 4,
        },
        axisTick: { show: false },
        splitLine: {
          distance: -12,
          length: 8,
          lineStyle: { color: '#6b7280', width: 1 },
        },
        axisLabel: {
          color: '#9ca3af',
          fontSize: 9,
          distance: -18,
        },
        detail: {
          valueAnimation: true,
          formatter: '{value}',
          color: '#e5e7eb',
          fontSize: 18,
          offsetCenter: [0, '60%'],
        },
        title: {
          color: '#9ca3af',
          fontSize: 10,
          offsetCenter: [0, '85%'],
        },
        data: [{ value: data.value, name: data.label }],
      },
    ],
  };
}
```

---

### 5.4 Matrix Chart

#### Purpose

Displays a structured table/grid of explanatory data aligned to the trendlines or signals shown on the Lightweight Charts primary panel — e.g., timeframe breakdown, score components per line, zone classification.

#### Background: ECharts Matrix Coordinate System

ECharts v6 includes a **native matrix coordinate system** (`coord/matrix/` in seed code). It supports:
- Cell-based layout with row/column headers
- Body cells, corner cells, dimension levels
- Fully integrated with ECharts series types including heatmap

Reference files in seed code:
- `seed-code/echarts/src/coord/matrix/Matrix.ts`
- `seed-code/echarts/src/coord/matrix/MatrixModel.ts`
- `seed-code/echarts/src/coord/matrix/MatrixDim.ts`

#### Alternative: Custom Series as Table

For maximum layout control, render the matrix as a `custom` series on a `grid` coordinate system. This gives pixel-perfect control without depending on the matrix coordinate system's API stability.

```typescript
// lib/charts/matrixOption.ts
import type { EChartsOption } from 'echarts';

export interface MatrixRow {
  timeframe: string;      // e.g. "H4"
  lineType: string;       // e.g. "Resistance"
  score: number;          // e.g. 8.7
  touches: number;        // e.g. 4
  confluences: number;    // e.g. 3
  status: 'active' | 'broken' | 'pending';
}

export function buildMatrixOption(rows: MatrixRow[]): EChartsOption {
  const columns = ['TF', 'Type', 'Score', 'Touches', 'Conf.', 'Status'];
  const statusColor = (s: MatrixRow['status']) =>
    s === 'active' ? '#22c55e' : s === 'broken' ? '#ef4444' : '#f59e0b';

  // Flatten rows into ECharts dataset
  const source = rows.map((r) => [
    r.timeframe,
    r.lineType,
    r.score.toFixed(1),
    r.touches,
    r.confluences,
    r.status,
  ]);

  return {
    backgroundColor: 'transparent',
    dataset: { source: [columns, ...source] },
    grid: { top: 30, bottom: 10, left: 5, right: 5, containLabel: true },
    xAxis: { type: 'category', data: columns, show: false },
    yAxis: { type: 'category', data: rows.map((r) => r.timeframe), show: false },
    series: [
      {
        type: 'custom',
        renderItem: (params, api) => {
          const rowIdx = params.dataIndex;
          const row = rows[rowIdx];
          const colCount = columns.length;
          const cellWidth = (params.coordSys as { width: number }).width / colCount;
          const cellHeight = (params.coordSys as { height: number }).height / rows.length;
          const x = (params.coordSys as { x: number }).x;
          const y = (params.coordSys as { y: number }).y + rowIdx * cellHeight;

          const cells = [
            row.timeframe,
            row.lineType,
            row.score.toFixed(1),
            String(row.touches),
            String(row.confluences),
            row.status,
          ];

          return {
            type: 'group',
            children: cells.map((text, colIdx) => ({
              type: 'rect',
              shape: {
                x: x + colIdx * cellWidth,
                y,
                width: cellWidth - 1,
                height: cellHeight - 1,
              },
              style: {
                fill: colIdx === 5 ? statusColor(row.status) + '33' : '#1f2937',
                stroke: '#374151',
                lineWidth: 0.5,
              },
              children: [],
            })).concat(
              cells.map((text, colIdx) => ({
                type: 'text' as const,
                style: {
                  x: x + colIdx * cellWidth + cellWidth / 2,
                  y: y + cellHeight / 2,
                  text,
                  textAlign: 'center' as const,
                  textVerticalAlign: 'middle' as const,
                  fill: colIdx === 5 ? statusColor(row.status) : '#d1d5db',
                  fontSize: 10,
                },
              }))
            ),
          };
        },
        data: rows.map((r) => [r.timeframe, r.score]),
        encode: { x: 0, y: 1 },
      },
    ],
  };
}
```

---

## 6. Frontend Component Architecture (Next.js)

### File Structure

```
app/
  dashboard/
    chart/
      page.tsx                          ← Route entry, fetches data, composes layout
      loading.tsx                       ← Suspense loading skeleton

components/
  charts/
    lwc/
      LWCPrimaryChart.tsx               ← Left panel — Lightweight Charts container
      LWCPrimaryChart.types.ts          ← Prop types / data types

    echarts/
      EChartsHeatmapLineChart.tsx       ← Right panel top — heatmap + line overlay
      EChartsRadarChart.tsx             ← Right panel bottom-left — radar
      EChartsGaugeChart.tsx             ← Right panel bottom-center — gauge
      EChartsMatrixChart.tsx            ← Right panel bottom-right — matrix

  layout/
    DualPanelLayout.tsx                 ← Two-column responsive wrapper

hooks/
  useECharts.ts                         ← Shared ECharts init/resize hook
  useChartSync.ts                       ← Cross-panel crosshair synchronization

lib/
  charts/
    heatmapLineOption.ts                ← ECharts option builder: heatmap+line
    radarOption.ts                      ← ECharts option builder: radar
    gaugeOption.ts                      ← ECharts option builder: gauge
    matrixOption.ts                     ← ECharts option builder: matrix

types/
  heatmap.ts                            ← HeatZone, HeatmapApiResponse, LinePricePoint
  radar.ts                              ← RadarIndicator, RadarDataPoint
  ohlcv.ts                              ← OHLCV bar types
```

### Page Component (Route)

```tsx
// app/dashboard/chart/page.tsx
import { Suspense } from 'react';
import { DualPanelLayout } from '@/components/layout/DualPanelLayout';
import { ChartLoadingSkeleton } from './loading';

// Server component — fetch data here, pass to client children
export default async function ChartPage({
  searchParams,
}: {
  searchParams: { symbol?: string; timeframe?: string };
}) {
  const symbol = searchParams.symbol ?? 'XAUUSD';
  const timeframe = searchParams.timeframe ?? 'H4';

  // Parallel fetch — OHLCV from primary backend + heatmap zones
  const [ohlcvRes, heatmapRes] = await Promise.all([
    fetch(`${process.env.BACKEND_URL}/api/v1/ohlcv?symbol=${symbol}&timeframe=${timeframe}`, {
      next: { revalidate: 60 },
    }),
    fetch(`${process.env.BACKEND_URL}/api/v1/heatmap/zones?symbol=${symbol}`, {
      next: { revalidate: 300 },  // 5 min — matches Redis update interval
    }),
  ]);

  const ohlcv = await ohlcvRes.json();
  const heatmap = await heatmapRes.json();

  return (
    <Suspense fallback={<ChartLoadingSkeleton />}>
      <DualPanelLayout
        ohlcvData={ohlcv.data}
        heatZones={heatmap.data.heat_zones}
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
import { EChartsHeatmapLineChart } from '@/components/charts/echarts/EChartsHeatmapLineChart';
import { EChartsRadarChart } from '@/components/charts/echarts/EChartsRadarChart';
import { EChartsGaugeChart } from '@/components/charts/echarts/EChartsGaugeChart';
import { EChartsMatrixChart } from '@/components/charts/echarts/EChartsMatrixChart';
import type { HeatZone } from '@/types/heatmap';
import type { CandlestickData } from 'lightweight-charts';

interface Props {
  ohlcvData: CandlestickData[];
  heatZones: HeatZone[];
  symbol: string;
  timeframe: string;
}

export function DualPanelLayout({ ohlcvData, heatZones, symbol, timeframe }: Props) {
  // Crosshair state broadcast from LWC → ECharts supplement panel
  const [crosshairTime, setCrosshairTime] = useState<number | null>(null);

  const handleCrosshairMove = useCallback(
    (time: number | null, price: number | null) => {
      setCrosshairTime(time);
      // Extend here: derive ECharts supplement data for the selected time
    },
    []
  );

  // Derive line data for ECharts heatmap panel from OHLCV closes
  const lineData = ohlcvData.map((bar) => ({
    timestamp: bar.time as number,
    price: bar.close,
  }));

  return (
    <div className="flex flex-col lg:flex-row h-screen w-full gap-2 p-2 bg-gray-950">

      {/* LEFT: TradingView Lightweight Charts */}
      <div className="flex-[3] min-h-[400px] lg:min-h-0 border border-blue-500/30 rounded-lg overflow-hidden">
        <LWCPrimaryChart
          ohlcvData={ohlcvData}
          onCrosshairMove={handleCrosshairMove}
        />
      </div>

      {/* RIGHT: ECharts supplement panel */}
      <div className="flex-[2] flex flex-col gap-2 min-h-[600px] lg:min-h-0">

        {/* TOP: Heatmap + Line Overlay */}
        <div className="flex-[55] border border-green-500/30 rounded-lg overflow-hidden">
          <EChartsHeatmapLineChart lineData={lineData} heatZones={heatZones} />
        </div>

        {/* BOTTOM: 3 explanatory charts */}
        <div className="flex-[45] flex flex-row gap-2">
          <div className="flex-1 border border-green-500/20 rounded-lg overflow-hidden">
            <EChartsRadarChart symbol={symbol} timeframe={timeframe} />
          </div>
          <div className="flex-1 border border-green-500/20 rounded-lg overflow-hidden">
            <EChartsGaugeChart symbol={symbol} timeframe={timeframe} />
          </div>
          <div className="flex-1 border border-green-500/20 rounded-lg overflow-hidden">
            <EChartsMatrixChart symbol={symbol} timeframe={timeframe} />
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
MQL5 Export (MT5)
    │
    ▼
Python Core Backend (davintrade-python-backend-architecture-v2)
    ├── Phase 1: Time-series alignment (M5 base, HTF merge, interpolate)
    ├── Phase 2: Scoring (Gaussian, Price Density, Confluence modules)
    ├── Phase 3: Aggregation + JSON serialization
    └── Phase 4: SSA pre-processing (entropy-driven window)
    │
    ▼
Confluence Nodes: [ timestamp, price, weight ]
    │
    ▼
Heatmap Expansion Stack (heatmap-expansion-stack.md)
    ├── Data Normalization (MinMaxScaler — time and price independently)
    ├── KDE (scipy.stats.gaussian_kde on 100×100 grid)
    ├── Thresholding (top 15% density)
    ├── Shapely convex_hull → polygon exterior coords
    └── Redis cache (5-min TTL, keyed by symbol+timeframe)
    │
    ▼
FastAPI REST Endpoint
    GET /api/v1/heatmap/zones?symbol=XAUUSD&lookback=500
    │
    ▼
Next.js Page (Server Component)
    ├── fetch() with next: { revalidate: 300 }
    └── Props passed to DualPanelLayout (Client Component)
         │
         ├── LEFT: LWCPrimaryChart (OHLCV data)
         └── RIGHT: EChartsHeatmapLineChart (polygon blobs + line)
              EChartsRadarChart   (scoring dimensions)
              EChartsGaugeChart   (overall confidence)
              EChartsMatrixChart  (per-trendline breakdown)
```

### API Endpoints Required

| Endpoint | Method | Consumers | Revalidate |
|---|---|---|---|
| `/api/v1/ohlcv` | GET | LWCPrimaryChart, EChartsHeatmapLineChart (line series) | 60s |
| `/api/v1/heatmap/zones` | GET | EChartsHeatmapLineChart (blob polygons) | 300s |
| `/api/v1/signals/score` | GET | EChartsRadarChart, EChartsGaugeChart | 60s |
| `/api/v1/signals/breakdown` | GET | EChartsMatrixChart | 60s |

### Query Parameters

```
/api/v1/ohlcv
  ?symbol=XAUUSD
  &timeframe=H4
  &limit=500

/api/v1/heatmap/zones
  ?symbol=XAUUSD
  &lookback=500

/api/v1/signals/score
  ?symbol=XAUUSD
  &timeframe=H4

/api/v1/signals/breakdown
  ?symbol=XAUUSD
  &timeframe=H4
```

### Environment Variables (Vercel)

```bash
# .env.local
BACKEND_URL=https://your-python-backend.com   # FastAPI base URL
NEXT_PUBLIC_WS_URL=wss://your-backend/ws      # Optional: WebSocket for live updates
```

---

## 8. Cross-Panel State Synchronization

### Crosshair Synchronization (LWC → ECharts)

When the user moves the crosshair on the Lightweight Charts panel, the ECharts supplement panel should highlight the corresponding time slice.

```tsx
// hooks/useChartSync.ts
'use client';

import { useState, useCallback, useRef } from 'react';

export interface CrosshairState {
  time: number | null;
  price: number | null;
}

export function useChartSync() {
  const [crosshair, setCrosshair] = useState<CrosshairState>({ time: null, price: null });
  const echartsRef = useRef<import('echarts').ECharts | null>(null);

  const onLWCCrosshairMove = useCallback(
    (time: number | null, price: number | null) => {
      setCrosshair({ time, price });

      // Drive ECharts axisPointer programmatically
      if (echartsRef.current && time !== null) {
        echartsRef.current.dispatchAction({
          type: 'showTip',
          seriesIndex: 1,        // Line series index
          dataIndex: undefined,
          x: undefined,
          // Use time value directly — ECharts resolves internally
        });
      }
    },
    []
  );

  return { crosshair, onLWCCrosshairMove, echartsRef };
}
```

### Symbol / Timeframe Selector

Both panels respond to a shared symbol/timeframe selector. Store selection in URL search params for shareability:

```tsx
// components/controls/ChartControls.tsx
'use client';

import { useRouter, useSearchParams } from 'next/navigation';

const SYMBOLS = ['XAUUSD', 'EURUSD', 'BTCUSD'];
const TIMEFRAMES = ['M15', 'H1', 'H4', 'D1'];

export function ChartControls() {
  const router = useRouter();
  const params = useSearchParams();

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    next.set(key, value);
    router.push(`?${next.toString()}`);
  };

  return (
    <div className="flex gap-2 p-2 bg-gray-900 rounded-lg">
      <select
        className="bg-gray-800 text-gray-200 rounded px-2 py-1 text-sm"
        value={params.get('symbol') ?? 'XAUUSD'}
        onChange={(e) => update('symbol', e.target.value)}
      >
        {SYMBOLS.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <select
        className="bg-gray-800 text-gray-200 rounded px-2 py-1 text-sm"
        value={params.get('timeframe') ?? 'H4'}
        onChange={(e) => update('timeframe', e.target.value)}
      >
        {TIMEFRAMES.map((tf) => <option key={tf} value={tf}>{tf}</option>)}
      </select>
    </div>
  );
}
```

---

## 9. Key Implementation Patterns

### Pattern 1: SSR Safety for Chart Components

Both charting libraries access the DOM — they must never run during server-side rendering.

```tsx
// WRONG — will crash on server
import { createChart } from 'lightweight-charts';
import * as echarts from 'echarts';

// CORRECT — defer to client
'use client';
// All chart components must have this directive at the top
```

For dynamic imports at the page level (if not using 'use client' layout):

```tsx
import dynamic from 'next/dynamic';

const DualPanelLayout = dynamic(
  () => import('@/components/layout/DualPanelLayout').then((m) => m.DualPanelLayout),
  { ssr: false }
);
```

### Pattern 2: Chart Resize Handling

Both libraries need explicit resize calls when the container changes size. Use `ResizeObserver`:

```tsx
// For Lightweight Charts
useEffect(() => {
  if (!containerRef.current || !chartRef.current) return;
  const ro = new ResizeObserver(() => chartRef.current?.applyOptions({ autoSize: true }));
  ro.observe(containerRef.current);
  return () => ro.disconnect();
}, []);

// For ECharts (handled in useECharts hook via ResizeObserver → chart.resize())
```

### Pattern 3: ECharts Option Updates (No Re-init)

Never destroy and re-create an ECharts instance on data change. Use `setOption` with `notMerge: false`:

```tsx
// WRONG — re-creates chart every render
useEffect(() => {
  const chart = echarts.init(ref.current);
  chart.setOption(option);
}, [option]);

// CORRECT — update existing instance
useEffect(() => {
  chartRef.current?.setOption(option, { notMerge: false, lazyUpdate: true });
}, [option]);
```

### Pattern 4: ECharts Tree-shaking (Bundle Size)

ECharts v6 supports selective imports to reduce bundle size:

```typescript
// lib/echartsInit.ts — register only what you use
import * as echarts from 'echarts/core';
import { LineChart, CustomChart } from 'echarts/charts';
import {
  GridComponent,
  TooltipComponent,
  DataZoomComponent,
  LegendComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([
  LineChart,
  CustomChart,
  GridComponent,
  TooltipComponent,
  DataZoomComponent,
  LegendComponent,
  CanvasRenderer,
]);

export { echarts };
```

Import from this file instead of `'echarts'` directly across chart components.

### Pattern 5: Timestamp Unit Mismatch Prevention

```typescript
// constants/time.ts
export const toEChartsMs = (unixSeconds: number): number => unixSeconds * 1000;
export const toLWCSeconds = (unixMs: number): number => Math.floor(unixMs / 1000);

// Usage in heatmapLineOption.ts:
data: lineData.map((d) => [toEChartsMs(d.timestamp), d.price])

// Usage in polygon mapping:
const screenPoints = rawPolygon.map((coord) =>
  api.coord([toEChartsMs(coord[0]), coord[1]])
);
```

---

## 10. Vercel Deployment Notes

### Next.js Config

```typescript
// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // ECharts and lightweight-charts are client-only — transpile if needed
  transpilePackages: [],

  // Allow backend API URL in server components
  serverExternalPackages: [],

  // If CORS issues arise with Python backend
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

Set in Vercel dashboard under Project → Settings → Environment Variables:

| Variable | Environment | Value |
|---|---|---|
| `BACKEND_URL` | Production, Preview | `https://your-python-api.com` |
| `BACKEND_URL` | Development | `http://localhost:8000` |

### Bundle Size Considerations

ECharts full bundle is ~1MB. Apply tree-shaking via Pattern 4 above to reduce to ~200–400KB depending on charts used. Lightweight Charts is ~50KB.

```bash
# Analyze bundle after build
ANALYZE=true next build
```

### Edge vs Node.js Runtime

Chart page uses standard Node.js runtime (not Edge) because:
- `fetch()` with large JSON payloads from Python backend
- No need for ultra-low latency (charts data is not real-time at this stage)

```typescript
// app/dashboard/chart/page.tsx — explicitly set runtime if needed
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';  // Or 'force-static' with revalidate
```

---

## 11. Implementation Checklist for Claude Code

Use this checklist when implementing the dual-panel chart UI:

### Phase A: Setup

- [ ] Install `lightweight-charts` and `echarts` packages
- [ ] Create `types/heatmap.ts`, `types/radar.ts`, `types/ohlcv.ts`
- [ ] Create `hooks/useECharts.ts` (shared init/resize hook)
- [ ] Create `lib/echartsInit.ts` (tree-shaken ECharts registration)
- [ ] Create `constants/time.ts` (timestamp unit helpers)

### Phase B: Left Panel — Lightweight Charts

- [ ] Create `components/charts/lwc/LWCPrimaryChart.tsx`
  - [ ] `'use client'` directive
  - [ ] `useRef` for container and chart instance
  - [ ] `useEffect` for init/cleanup
  - [ ] `CandlestickSeries` as default series
  - [ ] Crosshair move callback (`onCrosshairMove` prop)
  - [ ] `useEffect` for data updates without re-init
  - [ ] `ResizeObserver` or `autoSize: true`
- [ ] Symbol marker support via `createSeriesMarkers()`

### Phase C: Right Panel Top — ECharts Heatmap + Line

- [ ] Create `lib/charts/heatmapLineOption.ts`
  - [ ] `custom` series with `renderItem` for polygon blobs
  - [ ] `z: 0` for heat zones, `z: 1` for line series
  - [ ] Timestamp × 1000 conversion (`toEChartsMs`)
  - [ ] `animation: false`
  - [ ] `dataZoom` component
- [ ] Create `components/charts/echarts/EChartsHeatmapLineChart.tsx`
  - [ ] `'use client'` directive
  - [ ] Use `useECharts` hook
  - [ ] `useMemo` for option computation

### Phase D: Right Panel Bottom — Radar, Gauge, Matrix

- [ ] Create `lib/charts/radarOption.ts` + `EChartsRadarChart.tsx`
  - [ ] Indicator definitions with `max` values
  - [ ] `areaStyle` on series for filled radar
- [ ] Create `lib/charts/gaugeOption.ts` + `EChartsGaugeChart.tsx`
  - [ ] Three-color `axisLine` (red/amber/green)
  - [ ] `valueAnimation: true`
- [ ] Create `lib/charts/matrixOption.ts` + `EChartsMatrixChart.tsx`
  - [ ] Custom series rendering rows × columns
  - [ ] Color-coded status column

### Phase E: Layout & Integration

- [ ] Create `components/layout/DualPanelLayout.tsx`
  - [ ] Responsive Tailwind layout (flex-row on lg, flex-col below)
  - [ ] Flex ratios: left `flex-[3]`, right `flex-[2]`
  - [ ] Right panel: top `flex-[55]`, bottom `flex-[45]`
  - [ ] Bottom 3-way split: equal `flex-1` per chart
- [ ] Create `app/dashboard/chart/page.tsx`
  - [ ] Server component with parallel `fetch()`
  - [ ] `next: { revalidate }` on both fetches
  - [ ] Props passed down to `DualPanelLayout`
- [ ] Create `components/controls/ChartControls.tsx` (symbol/timeframe selector)
- [ ] Wire `onCrosshairMove` in `DualPanelLayout`

### Phase F: Validation

- [ ] Verify no SSR errors (`window is not defined`) — all chart code inside `'use client'`
- [ ] Verify ECharts `custom` series polygons render at correct price/time coordinates
- [ ] Verify timestamp unit consistency (seconds vs milliseconds at every boundary)
- [ ] Verify `ResizeObserver` cleanup on component unmount (no memory leaks)
- [ ] Verify chart instances are disposed on unmount
- [ ] Test responsive layout at lg, md, and mobile breakpoints
- [ ] Verify Vercel build succeeds (`next build`) without bundle errors

---

## Appendix A: Seed Code Reference Paths

| What | Path in Repo |
|---|---|
| LWC heatmap custom series example | `seed-code/lightweight-charts/plugin-examples/src/plugins/heatmap-series/example/example2.ts` |
| LWC custom series renderer | `seed-code/lightweight-charts/plugin-examples/src/plugins/heatmap-series/renderer.ts` |
| LWC data types | `seed-code/lightweight-charts/plugin-examples/src/plugins/heatmap-series/data.ts` |
| ECharts source | `seed-code/echarts/src/` |
| ECharts heatmap chart | `seed-code/echarts/src/chart/heatmap/` |
| ECharts custom series | `seed-code/echarts/src/chart/custom/` |
| ECharts radar | `seed-code/echarts/src/chart/radar/` |
| ECharts gauge | `seed-code/echarts/src/chart/gauge/` |
| ECharts matrix coord system | `seed-code/echarts/src/coord/matrix/` |
| ECharts all chart exports | `seed-code/echarts/src/export/charts.ts` |
| Python blob generation | `backend-python-computation-stack/davintrade-heatmap-expansion-stack/heatmap-expansion-stack.md` |
| Python core backend | `backend-python-computation-stack/davintrade-python-backend-architecture/davintrade-python-backend-architecture-v2.md` |

---

## Appendix B: Common Pitfalls

| Pitfall | Symptom | Fix |
|---|---|---|
| Missing `'use client'` | `window is not defined` at build | Add `'use client'` to every chart component file |
| Timestamp in seconds for ECharts | Polygons render at year 2001 | Multiply all timestamps by 1000 before passing to ECharts |
| Re-creating ECharts on every render | Chart flickers / loses zoom state | Call `setOption()` on existing instance, never re-`init()` |
| LWC `autoSize` not working | Chart doesn't fill container | Ensure parent container has explicit height (not `height: auto`) |
| ECharts custom series wrong z-order | Line renders behind blob zones | Set `z: 0` on custom series, `z: 1` on line series |
| Polygon not closed | Shapely hull has gap | Ensure `polygon[0] === polygon[polygon.length-1]` (Python backend guarantee) |
| ECharts bundle too large | Slow initial load on Vercel | Use selective imports via `lib/echartsInit.ts` (Pattern 4) |
| Memory leak on route change | Browser tab slows over time | Call `chart.dispose()` / `chart.remove()` in `useEffect` cleanup |