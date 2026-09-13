'use client';

/**
 * XauxUsdxComparisonChart -- the 2-line XAUX vs USDX chart for the public
 * comparison page linked from the landing-page Hero widget.
 *
 * Mirrors components/currency-index-pro/chart/relative-strength-chart.tsx's
 * exact lifecycle split (one mount-only effect creates the chart + series,
 * separate reactive effects push appearance/height/data changes via
 * applyOptions()/setData() without ever tearing the chart down) -- the
 * proven pattern for a lightweight-charts line chart in this codebase.
 * Deliberately simpler than that component: 2 fixed series, no corridor
 * lines, no news markers, no PRO gating -- this is a public marketing page,
 * not the PRO screener.
 *
 * @module components/market/xaux-usdx-comparison-chart
 */

import {
  createChart,
  LineSeries,
  ColorType,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts';
import { useEffect, useRef } from 'react';

import { useChartAppearance } from '@/components/providers/appearance-provider';
import type { CurrencyGoldIndexHistorySeries } from '@/lib/currency-gold-indices/queries';

interface XauxUsdxComparisonChartProps {
  series: CurrencyGoldIndexHistorySeries[];
  height?: number;
}

// Gold for XAUX (matches this app's own amber brand accent), blue for USDX
// (the same USD slot currency-index-pro/colors.ts already uses) -- two
// high-contrast hues, correct in both themes.
const LINE_COLORS: Record<string, { light: string; dark: string }> = {
  XAUX: { light: '#c98500', dark: '#eda100' },
  USDX: { light: '#2a78d6', dark: '#3987e5' },
};

function lineColor(symbol: string, theme: 'light' | 'dark'): string {
  return (
    LINE_COLORS[symbol]?.[theme] ?? (theme === 'dark' ? '#94a3b8' : '#64748b')
  );
}

/** Mirrors relative-strength-chart.tsx's own private chartChromeColors(). */
function chartChromeColors(
  theme: 'light' | 'dark',
  gridOpacityDecimal: number
) {
  return theme === 'dark'
    ? {
        background: '#0a0e17',
        text: '#94a3b8',
        grid: `rgba(148, 163, 184, ${gridOpacityDecimal})`,
        border: '#1e293b',
      }
    : {
        background: '#ffffff',
        text: '#334155',
        grid: `rgba(203, 213, 225, ${gridOpacityDecimal})`,
        border: '#cbd5e1',
      };
}

export function XauxUsdxComparisonChart({
  series,
  height = 480,
}: XauxUsdxComparisonChartProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<Map<string, ISeriesApi<'Line'>>>(new Map());
  const isFirstLoadRef = useRef(true);
  const heightRef = useRef(height);
  heightRef.current = height;

  const { resolvedTheme, gridOpacityDecimal } = useChartAppearance();

  // Create the chart + 2 line series once.
  useEffect(() => {
    if (!containerRef.current || chartRef.current) return;

    const chrome = chartChromeColors(resolvedTheme, gridOpacityDecimal);
    const width = containerRef.current.clientWidth || 800;

    const chart = createChart(containerRef.current, {
      width,
      height: heightRef.current,
      layout: {
        background: { type: ColorType.Solid, color: chrome.background },
        textColor: chrome.text,
      },
      grid: {
        vertLines: { color: chrome.grid },
        horzLines: { color: chrome.grid },
      },
      rightPriceScale: { borderColor: chrome.border },
      timeScale: {
        borderColor: chrome.border,
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const seriesMap = seriesRef.current;
    for (const symbol of Object.keys(LINE_COLORS)) {
      const lineSeries = chart.addSeries(LineSeries, {
        color: lineColor(symbol, resolvedTheme),
        lineWidth: 2,
        // A visible direct label -- same relief-rule reasoning
        // relative-strength-chart.tsx already applies -- identity must never
        // rest on hue alone.
        title: symbol,
        lastValueVisible: true,
        priceLineVisible: false,
      });
      seriesMap.set(symbol, lineSeries);
    }

    chartRef.current = chart;

    const handleResize = (): void => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: containerRef.current.clientWidth || 800,
        });
      }
    };
    window.addEventListener('resize', handleResize);

    return (): void => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
      seriesMap.clear();
    };
    // Mount-once by design -- see relative-strength-chart.tsx's own identical comment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reactive appearance updates -- no teardown/recreate.
  useEffect(() => {
    if (!chartRef.current) return;
    const chrome = chartChromeColors(resolvedTheme, gridOpacityDecimal);
    chartRef.current.applyOptions({
      layout: {
        background: { type: ColorType.Solid, color: chrome.background },
        textColor: chrome.text,
      },
      grid: {
        vertLines: { color: chrome.grid },
        horzLines: { color: chrome.grid },
      },
      rightPriceScale: { borderColor: chrome.border },
      timeScale: { borderColor: chrome.border },
    });
    for (const [symbol, lineSeries] of seriesRef.current) {
      lineSeries.applyOptions({ color: lineColor(symbol, resolvedTheme) });
    }
  }, [resolvedTheme, gridOpacityDecimal]);

  useEffect(() => {
    chartRef.current?.applyOptions({ height });
  }, [height]);

  // Push new bar data into each of the 2 series.
  useEffect(() => {
    for (const s of series) {
      const lineSeries = seriesRef.current.get(s.symbol);
      lineSeries?.setData(
        s.bars.map((bar) => ({
          time: bar.barTime as UTCTimestamp,
          value: bar.value,
        }))
      );
    }
    // Only fit the visible range on the first real data load -- a 60s
    // refresh after that must not reset a user's own zoom/pan.
    if (isFirstLoadRef.current && series.some((s) => s.bars.length > 0)) {
      chartRef.current?.timeScale().fitContent();
      isFirstLoadRef.current = false;
    }
  }, [series]);

  return (
    <div className="relative w-full rounded-lg border border-border bg-card p-4">
      <div ref={containerRef} className="w-full" />
    </div>
  );
}
