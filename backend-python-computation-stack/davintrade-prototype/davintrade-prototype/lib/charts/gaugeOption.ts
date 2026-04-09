// lib/charts/gaugeOption.ts
// gauge-simple style — single blue arc, needle, 0–100 scale.
// progress: { show: true } — NO tri-color axisLine array.

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
    backgroundColor: 'transparent',
    tooltip: {
      formatter: '{a} <br/>{b} : {c}',
    },
    series: [
      {
        name: data.indexType,
        type: 'gauge',
        // gauge-simple style — single blue arc
        progress: {
          show: true,
          width: 14,
        },
        axisLine: {
          lineStyle: {
            width: 14,
            // Single color — NOT a tri-color array (that would violate the spec)
            color: [[1, '#1e3a5f']],
          },
        },
        axisTick: { show: false },
        splitLine: { length: 10, lineStyle: { color: '#374151', width: 2 } },
        axisLabel: { distance: 4, color: '#9ca3af', fontSize: 10 },
        pointer: {
          itemStyle: { color: '#3b82f6' },
        },
        anchor: {
          show: true,
          showAbove: true,
          size: 14,
          itemStyle: { borderWidth: 6, borderColor: '#3b82f6' },
        },
        title: {
          show: true,
          offsetCenter: [0, '-30%'],
          fontSize: 13,
          fontWeight: 'bold',
          color: '#d1d5db',
        },
        detail: {
          valueAnimation: true,
          formatter: (value: number) =>
            `{value|${Math.round(value)}}\n{active|${data.activeType}}\n{price|${data.sandwichLabel}: ${data.sandwichPrice.toFixed(2)}}`,
          rich: {
            value: {
              fontSize: 26,
              fontWeight: 'bold',
              color: '#3b82f6',
              lineHeight: 32,
            },
            active: { fontSize: 10, color: '#9ca3af', lineHeight: 16 },
            price: { fontSize: 10, color: '#6b7280', lineHeight: 16 },
          },
          offsetCenter: [0, '60%'],
        },
        data: [
          {
            value: Math.round(data.value),
            name: data.indexType,
          },
        ],
        min: 0,
        max: 100,
        radius: '88%',
      },
    ],
  };
}
