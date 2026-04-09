'use client';

// components/charts/echarts/EChartsBPIGauge.tsx
import { EChartsGaugeChart } from './EChartsGaugeChart';

import type { HeatmapApiResponse } from '@/types/heatmap';

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
