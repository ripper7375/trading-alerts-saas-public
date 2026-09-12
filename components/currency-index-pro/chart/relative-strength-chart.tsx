'use client';

/**
 * RelativeStrengthChart — the 8-line multi-currency chart (spec Section 2/3).
 *
 * Mirrors `components/charts/trading-chart.tsx`'s exact lifecycle split: one
 * mount-only effect creates the chart + 8 `LineSeries`, separate reactive
 * effects push appearance/height/data/corridor/news changes via
 * `applyOptions()`/`setData()` without ever tearing the chart down.
 *
 * Corridor thresholds use `series.createPriceLine()` -- the first use of
 * this API anywhere in the codebase (confirmed via exploration), but it is
 * lightweight-charts' own standard, documented v5 mechanism for a
 * horizontal reference line, not a novel pattern. News markers reuse
 * `EventVerticalLine`/`attachPrimitive` exactly as `useEventMarkers.ts`
 * already does for the main terminal chart.
 *
 * @module components/currency-index-pro/chart/relative-strength-chart
 */

import {
  createChart,
  LineSeries,
  LineStyle,
  ColorType,
  type IChartApi,
  type ISeriesApi,
  type IPriceLine,
  type UTCTimestamp,
} from 'lightweight-charts';
import { useEffect, useRef, useState } from 'react';

import { useChartAppearance } from '@/components/providers/appearance-provider';
import { EventVerticalLine } from '@/components/charts/drawing/EventVerticalLine';
import {
  ALL_CURRENCIES,
  indexNameForCurrency,
  type CurrencyCode,
} from '@/lib/currency-index-pro/pairs';
import { currencyColor } from '@/lib/currency-index-pro/colors';

import { HighImpactNewsTooltip } from './high-impact-news-tooltip';
import type { CurrencyIndexChartData } from '../hooks/use-currency-index-chart';

interface RelativeStrengthChartProps {
  data: CurrencyIndexChartData | null;
  height?: number;
  /**
   * Overrides the corridor's threshold VALUES for display only (spec
   * Section 3.3's "0ms server roundtrip" client-side OB/OS override) --
   * `data.corridor` itself, and the system-wide `DailyVolatilityCorridor`
   * it comes from, are never touched. `undefined`/`null` falls back to
   * `data.corridor` (today's auto default), matching this component's
   * pre-Phase-4 behavior exactly.
   *
   * `extremeZonePct: null` deliberately draws ONLY the Tier 1 OB/OS lines --
   * the spec's own custom override is a single OB/OS pair, not a second
   * statistical tier, and Tier 2 is fundamentally `mean + 1*stddev`, a
   * quantity that has no meaning once the user has manually overridden the
   * corridor. Synthesizing one from the override value would be a
   * fabricated number, not a real "extreme" reading.
   */
  corridorOverride?: {
    strikeZonePct: number;
    extremeZonePct: number | null;
  } | null;
}

/** Mirrors `trading-chart.tsx`'s own private `chartChromeColors()` (not
 * exported there) -- duplicated here rather than modifying an unrelated,
 * already-tested file to export a helper for this one new consumer. */
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

const CORRIDOR_LINE_COLOR = 'rgba(234, 179, 8, 0.6)'; // amber -- Tier 1 strike zone
const EXTREME_LINE_COLOR = 'rgba(239, 68, 68, 0.6)'; // red -- Tier 2 extreme zone

export function RelativeStrengthChart({
  data,
  height = 480,
  corridorOverride,
}: RelativeStrengthChartProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<Map<CurrencyCode, ISeriesApi<'Line'>>>(new Map());
  const priceLinesRef = useRef<IPriceLine[]>([]);
  const newsLinesRef = useRef<EventVerticalLine[]>([]);
  const isFirstLoadRef = useRef(true);
  const heightRef = useRef(height);
  heightRef.current = height;

  // Exposed once the chart exists so HighImpactNewsTooltip (a child) can
  // subscribe to its crosshair -- same reason trading-chart.tsx exposes
  // chartApi/seriesApi via state for its own child hooks/components.
  const [chartApi, setChartApi] = useState<IChartApi | null>(null);

  const { resolvedTheme, gridOpacityDecimal } = useChartAppearance();

  // Create the chart + 8 line series once.
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

    // Captured once here rather than read via the ref inside the cleanup
    // closure below -- the Map instance itself never changes, but the lint
    // rule can't know that; mirrors useFiredAlertMarkers.ts's own identical
    // "capture the ref's current value now" note.
    const seriesMap = seriesRef.current;

    for (const currency of ALL_CURRENCIES) {
      const series = chart.addSeries(LineSeries, {
        color: currencyColor(currency, resolvedTheme),
        lineWidth: 2,
        // A visible title + last-value label is the "direct label" the
        // dataviz skill's own relief rule requires for the 3 lower-contrast
        // slots in this palette (aqua/yellow/magenta) -- identity must never
        // rest on hue alone.
        title: currency,
        lastValueVisible: true,
        priceLineVisible: false,
      });
      seriesMap.set(currency, series);
    }

    chartRef.current = chart;
    setChartApi(chart);

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
      setChartApi(null);
      seriesMap.clear();
      priceLinesRef.current = [];
      newsLinesRef.current = [];
    };
    // Mount-once by design -- see trading-chart.tsx's own identical comment.
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
    for (const [currency, series] of seriesRef.current) {
      series.applyOptions({ color: currencyColor(currency, resolvedTheme) });
    }
  }, [resolvedTheme, gridOpacityDecimal]);

  useEffect(() => {
    chartRef.current?.applyOptions({ height });
  }, [height]);

  // Push new bar data into each of the 8 series.
  useEffect(() => {
    if (!data) return;
    for (const currency of ALL_CURRENCIES) {
      const series = seriesRef.current.get(currency);
      const points = data.series[indexNameForCurrency(currency)] ?? [];
      series?.setData(
        points.map((p) => ({
          time: p.barTime as UTCTimestamp,
          value: p.changePct,
        }))
      );
    }
    // Only fit the visible range on the first real data load -- every 30s
    // refresh after that must not reset a user's own zoom/pan.
    if (
      isFirstLoadRef.current &&
      data.series &&
      Object.keys(data.series).length > 0
    ) {
      chartRef.current?.timeScale().fitContent();
      isFirstLoadRef.current = false;
    }
  }, [data]);

  // Corridor threshold bands -- rebuilt on the reference (USD) series
  // whenever the corridor changes. Skipped entirely when null (Lane 4
  // hasn't finalized a day yet), matching this app's "absent is the honest
  // rendering" rule rather than a placeholder pair of lines at 0.
  useEffect(() => {
    const referenceSeries = seriesRef.current.get('USD');
    if (!referenceSeries) return;

    for (const line of priceLinesRef.current) {
      referenceSeries.removePriceLine(line);
    }
    priceLinesRef.current = [];

    const effectiveCorridor = corridorOverride ?? data?.corridor;
    if (!effectiveCorridor) return;
    const { strikeZonePct, extremeZonePct } = effectiveCorridor;

    const specs = [
      {
        price: strikeZonePct,
        color: CORRIDOR_LINE_COLOR,
        style: LineStyle.Dashed,
        title: 'Overbought',
      },
      {
        price: -strikeZonePct,
        color: CORRIDOR_LINE_COLOR,
        style: LineStyle.Dashed,
        title: 'Oversold',
      },
      // A manual override has no statistical "extreme" tier to show --
      // see this prop's own doc comment on why one is never fabricated.
      ...(extremeZonePct !== null
        ? [
            {
              price: extremeZonePct,
              color: EXTREME_LINE_COLOR,
              style: LineStyle.Dotted,
              title: 'Extreme',
            },
            {
              price: -extremeZonePct,
              color: EXTREME_LINE_COLOR,
              style: LineStyle.Dotted,
              title: 'Extreme',
            },
          ]
        : []),
    ];

    priceLinesRef.current = specs.map((spec) =>
      referenceSeries.createPriceLine({
        price: spec.price,
        color: spec.color,
        lineWidth: 1,
        lineStyle: spec.style,
        axisLabelVisible: true,
        title: spec.title,
      })
    );
  }, [data?.corridor, corridorOverride]);

  // High-impact news vertical markers -- attach the new set before
  // detaching the old one, same ordering `useEventMarkers.ts` uses, so a
  // 30s refresh never has a zero-marker frame.
  useEffect(() => {
    const chart = chartRef.current;
    const referenceSeries = seriesRef.current.get('USD');
    if (!chart || !referenceSeries || !data) return;

    const lines = data.highImpactNews.map((event) => {
      const line = new EventVerticalLine(
        chart,
        referenceSeries,
        event.eventTime as UTCTimestamp
      );
      referenceSeries.attachPrimitive(line);
      return line;
    });
    for (const line of newsLinesRef.current) {
      referenceSeries.detachPrimitive(line);
    }
    newsLinesRef.current = lines;
  }, [data, data?.highImpactNews]);

  return (
    <div className="relative w-full rounded-lg border bg-card p-4">
      <div ref={containerRef} className="w-full" />
      <HighImpactNewsTooltip
        chart={chartApi}
        events={data?.highImpactNews ?? []}
      />
    </div>
  );
}
