'use client';

// components/charts/echarts/EChartsHMIGauge.tsx
// HMI gauge wrapper — passes correct fields from unified API payload.

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
