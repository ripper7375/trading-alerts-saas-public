'use client';

// components/charts/echarts/EChartsGaugeChart.tsx
// Shared gauge component — instantiated 3× for HMI, RPI, BPI.
// gauge-simple style: single blue arc, progress: { show: true }, no tri-color axisLine.

import { useMemo } from 'react';

import { useECharts } from '@/hooks/useECharts';
import { buildGaugeOption, type GaugeData } from '@/lib/charts/gaugeOption';

export function EChartsGaugeChart({ data }: { data: GaugeData }) {
  const option = useMemo(() => buildGaugeOption(data), [data]);
  const { containerRef } = useECharts(option);

  return (
    <div
      ref={containerRef}
      className="h-full w-full"
      style={{ minHeight: 0 }}
    />
  );
}
