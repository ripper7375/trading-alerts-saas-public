'use client';

// components/charts/lwc/LWCPrimaryChart.tsx
// Left panel — TradingView Lightweight Charts.
// Supports candlestick / bar / line switching and trendline markers toggle.
// chart.remove() called on unmount — no memory leaks.

import {
  createChart,
  CandlestickSeries,
  BarSeries,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type UTCTimestamp,
  createSeriesMarkers,
} from 'lightweight-charts';
import { useEffect, useRef } from 'react';

import type { ChartType } from '@/types/chart';
import type { TrendlineMarker } from '@/types/trendline';

interface LWCPrimaryChartProps {
  ohlcvData: CandlestickData[];
  chartType: ChartType;
  showTrendlines: boolean;
  trendlines: TrendlineMarker[];
  onCrosshairMove?: (time: UTCTimestamp | null, price: number | null) => void;
  darkMode?: boolean;
}

export function LWCPrimaryChart({
  ohlcvData,
  chartType,
  showTrendlines,
  trendlines,
  onCrosshairMove,
  darkMode = true,
}: LWCPrimaryChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick' | 'Bar' | 'Line'> | null>(
    null
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerApiRef = useRef<any>(null);

  // ── Init chart once — cleanup calls chart.remove() ──────────────────────
  useEffect(() => {
    if (!containerRef.current) return;

    const bgColor = darkMode ? '#0f1118' : '#ffffff';
    const textColor = darkMode ? '#d1d5db' : '#374151';
    const gridColor = darkMode ? '#1f2937' : '#e5e7eb';

    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: {
        background: { color: bgColor },
        textColor,
      },
      grid: {
        vertLines: { color: gridColor },
        horzLines: { color: gridColor },
      },
      crosshair: { mode: 1 },
      rightPriceScale: { borderColor: '#374151' },
      timeScale: {
        borderColor: '#374151',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    chartRef.current = chart;
    chart.timeScale().fitContent();

    if (onCrosshairMove) {
      chart.subscribeCrosshairMove((param) => {
        if (!seriesRef.current) return;
        const priceData = param.seriesData.get(seriesRef.current);
        const close = priceData
          ? 'close' in priceData
            ? (priceData as CandlestickData).close
            : null
          : null;
        onCrosshairMove((param.time as UTCTimestamp) ?? null, close);
      });
    }

    return () => {
      chart.remove(); // ← required — cleans up DOM + internal listeners
      chartRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Re-create series when chartType changes ───────────────────────────────
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    // Detach old marker API before removing series
    markerApiRef.current?.detach();
    markerApiRef.current = null;

    if (seriesRef.current) {
      chart.removeSeries(seriesRef.current);
      seriesRef.current = null;
    }

    if (chartType === 'candlestick') {
      seriesRef.current = chart.addSeries(CandlestickSeries, {
        upColor: '#22c55e',
        downColor: '#ef4444',
        borderVisible: false,
        wickUpColor: '#22c55e',
        wickDownColor: '#ef4444',
      });
    } else if (chartType === 'bar') {
      seriesRef.current = chart.addSeries(BarSeries, {
        upColor: '#22c55e',
        downColor: '#ef4444',
      });
    } else {
      seriesRef.current = chart.addSeries(LineSeries, {
        color: '#60a5fa',
        lineWidth: 2,
      });
    }

    if (ohlcvData.length > 0) {
      seriesRef.current.setData(ohlcvData);
      chart.timeScale().fitContent();
    }
  }, [chartType]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Update OHLCV data without re-creating series ──────────────────────────
  useEffect(() => {
    if (seriesRef.current && ohlcvData.length > 0) {
      seriesRef.current.setData(ohlcvData);
    }
  }, [ohlcvData]);

  // ── Update trendline markers — LEFT PANEL ONLY ────────────────────────────
  // The hide/unhide toggle applies ONLY here. ECharts trendlines are always visible.
  useEffect(() => {
    if (!seriesRef.current) return;
    markerApiRef.current?.detach();
    markerApiRef.current = null;

    if (showTrendlines && trendlines.length > 0) {
      markerApiRef.current = createSeriesMarkers(seriesRef.current, trendlines);
    }
  }, [showTrendlines, trendlines]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full"
      style={{ minHeight: 0 }} // prevents flex children from overflowing
    />
  );
}
