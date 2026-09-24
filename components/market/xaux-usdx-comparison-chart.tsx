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
  createTextWatermark,
  LineSeries,
  ColorType,
  type IChartApi,
  type ISeriesApi,
  type ITextWatermarkPluginApi,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts';
import { useEffect, useRef, useState } from 'react';

import { useChartAppearance } from '@/components/providers/appearance-provider';
import type { CurrencyGoldIndexHistorySeries } from '@/lib/currency-gold-indices/queries';

import { ComparisonDrawingLayer } from './comparison-drawing-layer';
import { useChartTimeOptions } from '@/components/charts/use-chart-time-options';

interface XauxUsdxComparisonChartProps {
  series: CurrencyGoldIndexHistorySeries[];
  height?: number;
  /**
   * Per-index DISPLAY base value (default 100, each). Both XAUX and USDX are
   * rebased to exactly 100.00 at their own inception by construction (Lane 4's
   * own schema), so when overlaid their lines start from the same point and
   * can sit close together, making the two harder to visually tell apart. A
   * base of B shifts a series' plotted values by (B - 100) -- a constant,
   * shape-preserving vertical translation, not a rescale -- so the two curves
   * visually separate without altering their real, underlying values (the
   * real value is what setData() would show at base 100; the DB is never
   * touched, only what's drawn here).
   */
  rebase?: Partial<Record<string, number>>;
}

/** Slider bounds for the rebase controls -- matches the feature's own request. */
export const REBASE_MIN = 50;
export const REBASE_MAX = 150;
export const REBASE_DEFAULT = 100;

// Gold for XAUX (matches this app's own amber brand accent), blue for USDX
// (the same USD slot currency-index-pro/colors.ts already uses) -- two
// high-contrast hues, correct in both themes.
//
// XAUX's dark step was '#eda100' until 2026-09-13: the dataviz skill's
// validate_palette.js FAILS it on this chart's dark surface (#0a0e17) for the
// lightness band (OKLCH L 0.764, band 0.48-0.67 -- too bright, it glares next
// to the in-band blue). '#c98500' passes every check in both modes, all-pairs
// with the blue:
//   node validate_palette.js "#c98500,#2a78d6" --mode light --surface "#ffffff" --pairs all
//   node validate_palette.js "#c98500,#3987e5" --mode dark  --surface "#0a0e17" --pairs all
// -- the same values the PRO comparison chart uses.
const LINE_COLORS: Record<string, { light: string; dark: string }> = {
  XAUX: { light: '#c98500', dark: '#c98500' },
  USDX: { light: '#2a78d6', dark: '#3987e5' },
};

function lineColor(symbol: string, theme: 'light' | 'dark'): string {
  return (
    LINE_COLORS[symbol]?.[theme] ?? (theme === 'dark' ? '#94a3b8' : '#64748b')
  );
}

// "DavinTrade" background watermark -- this page is a public marketing
// surface (open to any visitor, no login), so a brand mark on the chart
// belongs here in a way it wouldn't on the authenticated PRO screener. Kept
// deliberately faint (low alpha) so it never competes with the two data
// lines, using the SAME muted axis-label tone as chartChromeColors()'s own
// `text` color in each theme, just at much lower opacity -- ties the mark
// into this chart's existing palette rather than inventing a third color.
function watermarkColor(theme: 'light' | 'dark'): string {
  return theme === 'dark'
    ? 'rgba(148, 163, 184, 0.12)'
    : 'rgba(51, 65, 85, 0.08)';
}

function watermarkLines(theme: 'light' | 'dark') {
  return [
    {
      text: 'DavinTrade',
      color: watermarkColor(theme),
      fontSize: 56,
      fontStyle: 'bold',
    },
  ];
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
  rebase,
}: XauxUsdxComparisonChartProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const chartTime = useChartTimeOptions(chartRef);
  const seriesRef = useRef<Map<string, ISeriesApi<'Line'>>>(new Map());
  const watermarkRef = useRef<ITextWatermarkPluginApi<Time> | null>(null);
  const isFirstLoadRef = useRef(true);
  const heightRef = useRef(height);
  heightRef.current = height;

  // Exposed once the chart + a series exist so ComparisonDrawingLayer (a
  // child, mounted below) can attach the drawing engine -- same reason
  // relative-strength-chart.tsx exposes its own chartApi via state. The XAUX
  // series is used as the drawing engine's host series; it's an arbitrary
  // pick (both series share the same right price scale, so coordinate
  // conversion is identical either way), matching relative-strength-chart.tsx's
  // own arbitrary choice of its USD series as the host for its price lines.
  const [chartApi, setChartApi] = useState<IChartApi | null>(null);
  const [primarySeries, setPrimarySeries] = useState<ISeriesApi<'Line'> | null>(
    null
  );

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

    // Text watermark -- a pane primitive (v5's official plugin API), not a
    // 3rd series or a CSS overlay, so it scales/positions itself correctly
    // with the pane and never intercepts pointer events meant for the
    // drawing layer or the chart's own pan/zoom.
    const pane = chart.panes()[0];
    if (pane) {
      watermarkRef.current = createTextWatermark(pane, {
        horzAlign: 'center',
        vertAlign: 'center',
        lines: watermarkLines(resolvedTheme),
      });
    }

    chartRef.current = chart;
    chartTime.applyTo(chart);
    setChartApi(chart);
    setPrimarySeries(seriesMap.get('XAUX') ?? null);

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
      watermarkRef.current?.detach();
      watermarkRef.current = null;
      chart.remove();
      chartRef.current = null;
      setChartApi(null);
      setPrimarySeries(null);
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
    // Re-applied wholesale (not just `color`) since a pane primitive's
    // `applyOptions` array fields are not guaranteed to deep-merge
    // element-by-element -- passing the full line definition every time
    // avoids relying on that.
    watermarkRef.current?.applyOptions({
      lines: watermarkLines(resolvedTheme),
    });
  }, [resolvedTheme, gridOpacityDecimal]);

  useEffect(() => {
    chartRef.current?.applyOptions({ height });
  }, [height]);

  // Push new bar data into each of the 2 series. Rebasing is a pure display
  // shift applied here, at the last possible moment before setData() -- the
  // `series` prop itself (and everything upstream of it: the API route, the
  // cache, the database) always carries the real, un-rebased value.
  useEffect(() => {
    for (const s of series) {
      const lineSeries = seriesRef.current.get(s.symbol);
      const offset = (rebase?.[s.symbol] ?? REBASE_DEFAULT) - REBASE_DEFAULT;
      lineSeries?.setData(
        s.bars.map((bar) => ({
          time: bar.barTime as UTCTimestamp,
          value: bar.value + offset,
        }))
      );
    }
    // Only fit the visible range on the first real data load -- a 60s
    // refresh after that must not reset a user's own zoom/pan.
    if (isFirstLoadRef.current && series.some((s) => s.bars.length > 0)) {
      chartRef.current?.timeScale().fitContent();
      isFirstLoadRef.current = false;
    }
    // `rebase` is a dependency too (not just `series`) so dragging a slider
    // re-runs this effect -- the isFirstLoadRef guard above already ensures
    // that re-run only calls setData(), never fitContent(), so a rebase
    // change can never reset the user's own zoom/pan.
  }, [series, rebase]);

  return (
    <div className="relative w-full rounded-lg border border-border bg-card p-4">
      <div ref={containerRef} className="w-full" />
      {chartApi && primarySeries && (
        <ComparisonDrawingLayer chart={chartApi} series={primarySeries} />
      )}
    </div>
  );
}
