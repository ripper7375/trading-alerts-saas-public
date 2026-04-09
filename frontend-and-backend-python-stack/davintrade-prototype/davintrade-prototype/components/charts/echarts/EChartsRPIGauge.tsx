'use client';

// components/charts/echarts/EChartsRPIGauge.tsx
import { EChartsGaugeChart } from './EChartsGaugeChart';

import type { HeatmapApiResponse } from '@/types/heatmap';

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
