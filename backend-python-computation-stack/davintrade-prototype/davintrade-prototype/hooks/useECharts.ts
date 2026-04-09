'use client';

// hooks/useECharts.ts
// Shared ECharts initialization, resize (ResizeObserver), and dispose hook.
// All chart components use this hook — never re-init on option change.

import type { EChartsOption } from 'echarts';
import { useEffect, useRef, useCallback } from 'react';

import { echarts } from '@/lib/echartsInit';
// Use EChartsType from core to match what echarts.init() returns
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EChartsInstance = any;

export function useECharts(option: EChartsOption | null) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<EChartsInstance | null>(null);

  // Initialize chart instance once — cleanup calls dispose()
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = echarts.init(containerRef.current, undefined, {
      renderer: 'canvas',
    });
    chartRef.current = chart;

    // ResizeObserver keeps chart filling its container
    const ro = new ResizeObserver(() => {
      chart.resize();
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.dispose(); // ← required — prevent memory leak
      chartRef.current = null;
    };
  }, []);

  // Re-apply option whenever it changes — never re-init
  useEffect(() => {
    if (!chartRef.current || !option) return;
    chartRef.current.setOption(option, { notMerge: false, lazyUpdate: true });
  }, [option]);

  const getChart = useCallback(() => chartRef.current, []);

  return { containerRef, getChart };
}
