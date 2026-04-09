// lib/charts/heatmapChartOption.ts
// Builds the ECharts option for the right-panel heatmap analytical chart.
// Z-order: blobs(0) → SSA(1) → EMA-SSA(2) → trendlines(3) → FractalDown(4) → FractalUp(5)
// Sandwich price labels rendered as graphic elements, bottom-left.
// All timestamps converted via toEChartsMs() — ECharts time axis requires milliseconds.

/* eslint-disable @typescript-eslint/no-explicit-any */
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
): any {
  // Layer 3: trendlines as markLine on a dummy line series.
  // Always visible — the hide/unhide toggle is left LWC panel only.
  const trendlineSeries: any[] =
    trendlines.length > 0
      ? [
          {
            name: 'Trendlines',
            type: 'line',
            z: 3,
            silent: true,
            data: [],
            markLine: {
              silent: true,
              symbol: ['none', 'none'],
              lineStyle: { color: '#f59e0b', width: 1.5, type: 'solid' },
              label: { show: false },
              data: trendlines.map((t) => [
                { coord: [toEChartsMs(t.startTime), t.startPrice] },
                { coord: [toEChartsMs(t.endTime), t.endPrice] },
              ]),
            },
          },
        ]
      : [];

  return {
    backgroundColor: 'transparent',
    animation: false,

    grid: {
      top: '5%',
      right: '3%',
      bottom: '20%',
      left: '5%',
    },

    xAxis: {
      type: 'time',
      splitLine: { show: false },
      axisLine: { lineStyle: { color: '#374151' } },
      axisLabel: { color: '#9ca3af', fontSize: 10 },
    },

    yAxis: {
      type: 'value',
      scale: true,
      splitLine: { lineStyle: { color: '#2d2d3d', type: 'dashed' } },
      axisLabel: { color: '#9ca3af', fontSize: 10 },
    },

    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
      backgroundColor: '#1f2937',
      borderColor: '#374151',
      textStyle: { color: '#e5e7eb', fontSize: 11 },
    },

    dataZoom: [
      { type: 'inside', xAxisIndex: 0 },
      {
        type: 'slider',
        xAxisIndex: 0,
        height: 18,
        bottom: 4,
        borderColor: '#374151',
        backgroundColor: '#111827',
        fillerColor: 'rgba(59,130,246,0.15)',
        handleStyle: { color: '#3b82f6' },
        textStyle: { color: '#9ca3af', fontSize: 9 },
      },
    ],

    // Sandwich price labels — graphic text, bottom-left of chart
    graphic: [
      {
        type: 'text',
        z: 100,
        left: 8,
        bottom: 42,
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
        bottom: 24,
        style: {
          text: `▼ ${sandwich.lower.toFixed(2)}`,
          fill: '#3b82f6', // blue — lower support
          fontSize: 12,
          fontWeight: 'bold',
        },
      },
    ],

    series: [
      // ── Layer 0: Heatmap polygon blobs (KDE heat zones) ──────────────────
      {
        name: 'HeatZones',
        type: 'custom',
        z: 0,
        renderItem: (_params: any, api: any) => {
          // polygon stored at value index 2; color at index 3
          const rawPolygon = api.value(2) as unknown as [number, number][];
          const screenPoints = rawPolygon.map(
            (c: [number, number]) =>
              api.coord([toEChartsMs(c[0]), c[1]]) as [number, number]
          );
          return {
            type: 'polygon',
            shape: { points: screenPoints },
            style: api.style({ fill: api.value(3) as string, stroke: 'none' }),
          };
        },
        data: heatZones.map((z) => [0, 0, z.polygon, z.color]),
        encode: { tooltip: [] },
        silent: true,
      },

      // ── Layer 1: SSA trend line ──────────────────────────────────────────
      {
        name: 'SSA',
        type: 'line',
        z: 1,
        symbol: 'none',
        smooth: true,
        lineStyle: { width: 2, color: '#a855f7' }, // purple
        data: ssaData.map((d) => [toEChartsMs(d.timestamp), d.ssa]),
        emphasis: { disabled: true },
      },

      // ── Layer 2: EMA-SSA signal line ─────────────────────────────────────
      {
        name: 'EMA-SSA',
        type: 'line',
        z: 2,
        symbol: 'none',
        smooth: true,
        lineStyle: { width: 1.5, color: '#06b6d4', type: 'dashed' }, // cyan dashed
        data: ssaData.map((d) => [toEChartsMs(d.timestamp), d.ema_ssa]),
        emphasis: { disabled: true },
      },

      // ── Layer 3: Trendlines (golden plots) — always visible ──────────────
      ...trendlineSeries,

      // ── Layer 4: Fractal down markers — MQL5 code 108 (▼) ───────────────
      {
        name: 'FractalDown',
        type: 'scatter',
        z: 4,
        symbol: 'triangle',
        symbolRotate: 180,
        symbolSize: 9,
        itemStyle: { color: '#ef4444' }, // red
        data: fractals
          .filter((f) => f.type === 108)
          .map((f) => [toEChartsMs(f.timestamp), f.price]),
      },

      // ── Layer 5: Fractal up markers — MQL5 code 119 (▲) ─────────────────
      {
        name: 'FractalUp',
        type: 'scatter',
        z: 5,
        symbol: 'triangle',
        symbolSize: 9,
        itemStyle: { color: '#22c55e' }, // green
        data: fractals
          .filter((f) => f.type === 119)
          .map((f) => [toEChartsMs(f.timestamp), f.price]),
      },
    ],
  };
}
