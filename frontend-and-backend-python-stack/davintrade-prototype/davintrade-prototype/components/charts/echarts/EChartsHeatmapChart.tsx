'use client';

// components/charts/echarts/EChartsHeatmapChart.tsx
// Right panel top — Apache ECharts heatmap analytical chart.
// 7 data layers: blobs(z=0), SSA(z=1), EMA-SSA(z=2), trendlines(z=3),
//                fractal down(z=4), fractal up(z=5), sandwich labels(graphic).
// Trendlines here are ALWAYS visible — not affected by toolbar toggle.

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

  return (
    <div
      ref={containerRef}
      className="h-full w-full"
      style={{ minHeight: 0 }}
    />
  );
}
