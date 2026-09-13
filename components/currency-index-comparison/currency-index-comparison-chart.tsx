'use client';

/**
 * CurrencyIndexComparisonChart -- the PRO chart for /pro/currency-index/compare.
 *
 * The PRO counterpart of components/market/xaux-usdx-comparison-chart.tsx and
 * built on the same lifecycle split (one mount-only effect creates the chart
 * and every series; separate reactive effects push appearance and data via
 * applyOptions()/setData(), never tearing the chart down). Differences from the
 * Free chart, each a PRO requirement:
 *
 * - Any 1-2 of the 9 Lane 4 indices, in two fixed SLOTS (A, B).
 * - Three plot types: line, OHLC candles, Heiken Ashi candles.
 * - HRMA and SMMA per slot, each independently hideable.
 * - No watermark.
 *
 * WHY EVERY SERIES EXISTS UP FRONT: each slot owns a line, a candlestick, an
 * HRMA and an SMMA series, created once and shown/hidden with `visible`.
 * Recreating series on a plot-type switch would detach the drawing engine
 * (ComparisonDrawingLayer attaches its primitive to one series) and silently
 * delete every drawing the user made. The engine is instead attached to a
 * dedicated HOST line series that is never hidden (`lineVisible: false` hides
 * only its stroke; the series itself stays visible so its primitive keeps
 * painting) and always carries slot A's closes, so it spans the same time and
 * price range as whatever is drawn.
 *
 * COLOR FOLLOWS THE SLOT, not the index: only two indices are ever on screen,
 * and fixed slot hues keep that pair maximally distinct whichever two are
 * chosen (any 2 of 9 would otherwise need 9 mutually distinct hues -- more
 * than a categorical palette can separate). Validated with the dataviz skill's
 * validate_palette.js, all-pairs, against this chart's real surfaces:
 * light "#c98500,#2a78d6" on #ffffff and dark "#c98500,#3987e5" on #0a0e17 --
 * every check passes in both modes. HRMA/SMMA share their slot's hue and are
 * told apart by line style (dashed / dotted) plus an on-chart title, so
 * identity never rests on hue alone.
 *
 * @module components/currency-index-comparison/currency-index-comparison-chart
 */

import {
  CandlestickSeries,
  ColorType,
  createChart,
  LineSeries,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts';
import { useEffect, useMemo, useRef, useState } from 'react';

import { useChartAppearance } from '@/components/providers/appearance-provider';
import { ComparisonDrawingLayer } from '@/components/market/comparison-drawing-layer';
import {
  heikinAshi,
  hrmaSeries,
  shiftCandle,
  smmaSeries,
  type IndicatorPoint,
} from '@/lib/currency-index-comparison/indicators';
import type {
  ComparisonIndexName,
  IndexCandle,
} from '@/lib/currency-index-comparison/series';

export type PlotType = 'line' | 'ohlc' | 'heikin-ashi';
export type SlotId = 'A' | 'B';

export const SLOT_IDS: readonly SlotId[] = ['A', 'B'];

export interface ChartSlot {
  symbol: ComparisonIndexName;
  candles: IndexCandle[];
  /** Display-only rebase base, 50-150 (100 = real values). */
  base: number;
  showHrma: boolean;
  showSmma: boolean;
}

interface CurrencyIndexComparisonChartProps {
  /** Slot B may be null (only one index selected). */
  slots: Record<SlotId, ChartSlot | null>;
  plotType: PlotType;
  hrmaPeriod: number;
  smmaPeriod: number;
  /** Changing this re-fits the visible range (e.g. on an M5/M15 switch). */
  fitKey: string;
  height?: number;
}

export const REBASE_DEFAULT = 100;

const SLOT_COLORS: Record<SlotId, { light: string; dark: string }> = {
  A: { light: '#c98500', dark: '#c98500' },
  B: { light: '#2a78d6', dark: '#3987e5' },
};

export function slotColor(slot: SlotId, theme: 'light' | 'dark'): string {
  return SLOT_COLORS[slot][theme];
}

const HOLLOW = 'rgba(0, 0, 0, 0)';

/** Mirrors xaux-usdx-comparison-chart.tsx's chartChromeColors(). */
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

/**
 * Candles in the slot's hue: rising candles hollow (outline only), falling
 * candles filled -- the "hollow candles" convention, so direction is readable
 * without introducing two more colors per index.
 */
function candleStyle(color: string) {
  return {
    upColor: HOLLOW,
    downColor: color,
    borderVisible: true,
    borderUpColor: color,
    borderDownColor: color,
    wickUpColor: color,
    wickDownColor: color,
  };
}

interface SlotSeries {
  line: ISeriesApi<'Line'>;
  candle: ISeriesApi<'Candlestick'>;
  hrma: ISeriesApi<'Line'>;
  smma: ISeriesApi<'Line'>;
}

interface SlotComputed {
  candles: IndexCandle[];
  heikinAshi: IndexCandle[];
  hrma: IndicatorPoint[];
  smma: IndicatorPoint[];
}

const EMPTY_COMPUTED: SlotComputed = {
  candles: [],
  heikinAshi: [],
  hrma: [],
  smma: [],
};

function computeSlot(
  slot: ChartSlot | null,
  hrmaPeriod: number,
  smmaPeriod: number
): SlotComputed {
  if (!slot) return EMPTY_COMPUTED;
  return {
    candles: slot.candles,
    heikinAshi: heikinAshi(slot.candles),
    hrma: hrmaSeries(slot.candles, hrmaPeriod),
    smma: smmaSeries(slot.candles, smmaPeriod),
  };
}

function toCandleData(candles: IndexCandle[], offset: number) {
  return candles.map((c) => {
    const s = shiftCandle(c, offset);
    return {
      time: s.time as UTCTimestamp,
      open: s.open,
      high: s.high,
      low: s.low,
      close: s.close,
    };
  });
}

function toLineData(points: { time: number; value: number }[], offset: number) {
  return points.map((p) => ({
    time: p.time as UTCTimestamp,
    value: p.value + offset,
  }));
}

export function CurrencyIndexComparisonChart({
  slots,
  plotType,
  hrmaPeriod,
  smmaPeriod,
  fitKey,
  height = 520,
}: CurrencyIndexComparisonChartProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<Partial<Record<SlotId, SlotSeries>>>({});
  const hostRef = useRef<ISeriesApi<'Line'> | null>(null);
  const fittedKeyRef = useRef<string | null>(null);
  const heightRef = useRef(height);
  heightRef.current = height;

  const [chartApi, setChartApi] = useState<IChartApi | null>(null);
  const [hostSeries, setHostSeries] = useState<ISeriesApi<'Line'> | null>(null);

  const { resolvedTheme, gridOpacityDecimal } = useChartAppearance();

  // Create the chart and every series once.
  useEffect(() => {
    if (!containerRef.current || chartRef.current) return;

    const chrome = chartChromeColors(resolvedTheme, gridOpacityDecimal);
    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth || 800,
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

    // The drawing engine's host. Added first so it sits beneath the data.
    const host = chart.addSeries(LineSeries, {
      lineVisible: false,
      lastValueVisible: false,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
      pointMarkersVisible: false,
    });

    for (const slot of SLOT_IDS) {
      const color = slotColor(slot, resolvedTheme);
      seriesRef.current[slot] = {
        candle: chart.addSeries(CandlestickSeries, {
          ...candleStyle(color),
          priceLineVisible: false,
          // The close LINE series carries the price-scale label in every plot
          // type: a candlestick's label takes the last bar's body color, which
          // is transparent for a rising (hollow) candle, so the label would
          // lose the slot's hue exactly when the index is going up. Found in
          // live verification, not in theory.
          lastValueVisible: false,
          visible: false,
        }),
        line: chart.addSeries(LineSeries, {
          color,
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: true,
          visible: false,
        }),
        hrma: chart.addSeries(LineSeries, {
          color,
          lineWidth: 2,
          lineStyle: LineStyle.Dashed,
          priceLineVisible: false,
          lastValueVisible: true,
          crosshairMarkerVisible: false,
          visible: false,
        }),
        smma: chart.addSeries(LineSeries, {
          color,
          lineWidth: 2,
          lineStyle: LineStyle.Dotted,
          priceLineVisible: false,
          lastValueVisible: true,
          crosshairMarkerVisible: false,
          visible: false,
        }),
      };
    }

    chartRef.current = chart;
    hostRef.current = host;
    setChartApi(chart);
    setHostSeries(host);

    const handleResize = (): void => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: containerRef.current.clientWidth || 800,
        });
      }
    };
    window.addEventListener('resize', handleResize);

    const seriesMap = seriesRef.current;
    return (): void => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
      hostRef.current = null;
      setChartApi(null);
      setHostSeries(null);
      for (const slot of SLOT_IDS) delete seriesMap[slot];
    };
    // Mount-once by design -- see xaux-usdx-comparison-chart.tsx.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reactive appearance -- no teardown.
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
    for (const slot of SLOT_IDS) {
      const s = seriesRef.current[slot];
      if (!s) continue;
      const color = slotColor(slot, resolvedTheme);
      s.candle.applyOptions(candleStyle(color));
      s.line.applyOptions({ color });
      s.hrma.applyOptions({ color });
      s.smma.applyOptions({ color });
    }
  }, [resolvedTheme, gridOpacityDecimal]);

  useEffect(() => {
    chartRef.current?.applyOptions({ height });
  }, [height]);

  // Indicator math runs only when candles or periods change -- never for a
  // rebase drag, a visibility toggle or a plot-type switch.
  const slotA = slots.A;
  const slotB = slots.B;
  const computedA = useMemo(
    () => computeSlot(slotA, hrmaPeriod, smmaPeriod),
    // Keyed on the candles array, not the slot object, which is rebuilt on
    // every base/toggle change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [slotA?.candles, hrmaPeriod, smmaPeriod]
  );
  const computedB = useMemo(
    () => computeSlot(slotB, hrmaPeriod, smmaPeriod),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [slotB?.candles, hrmaPeriod, smmaPeriod]
  );

  // Push data, visibility and titles.
  useEffect(() => {
    const computed: Record<SlotId, SlotComputed> = {
      A: computedA,
      B: computedB,
    };

    for (const slotId of SLOT_IDS) {
      const s = seriesRef.current[slotId];
      if (!s) continue;
      const slot = slots[slotId];
      const c = computed[slotId];
      const offset = (slot?.base ?? REBASE_DEFAULT) - REBASE_DEFAULT;
      const present = slot !== null && c.candles.length > 0;

      const candleSource =
        plotType === 'heikin-ashi' ? c.heikinAshi : c.candles;
      s.candle.setData(present ? toCandleData(candleSource, offset) : []);
      s.line.setData(
        present
          ? toLineData(
              c.candles.map((k) => ({ time: k.time, value: k.close })),
              offset
            )
          : []
      );
      s.hrma.setData(present ? toLineData(c.hrma, offset) : []);
      s.smma.setData(present ? toLineData(c.smma, offset) : []);

      const symbol = slot?.symbol ?? '';
      s.candle.applyOptions({ visible: present && plotType !== 'line' });
      // Always visible when present so its colored label shows in every plot
      // type (see the candle series' creation comment); only its STROKE is
      // hidden in candle modes. The label is the REAL close, also in Heiken
      // Ashi mode, where the HA close is a synthetic average.
      s.line.applyOptions({
        visible: present,
        lineVisible: plotType === 'line',
        crosshairMarkerVisible: plotType === 'line',
        title: symbol,
      });
      s.hrma.applyOptions({
        visible: present && !!slot?.showHrma && c.hrma.length > 0,
        title: `${symbol} HRMA(${hrmaPeriod})`,
      });
      s.smma.applyOptions({
        visible: present && !!slot?.showSmma && c.smma.length > 0,
        title: `${symbol} SMMA(${smmaPeriod})`,
      });
    }

    // Host carries slot A's (shifted) closes -- see the module doc comment.
    const hostSlot = slots.A;
    hostRef.current?.setData(
      hostSlot && computedA.candles.length > 0
        ? toLineData(
            computedA.candles.map((k) => ({ time: k.time, value: k.close })),
            hostSlot.base - REBASE_DEFAULT
          )
        : []
    );

    const hasData =
      computedA.candles.length > 0 || computedB.candles.length > 0;
    if (hasData && fittedKeyRef.current !== fitKey) {
      chartRef.current?.timeScale().fitContent();
      fittedKeyRef.current = fitKey;
    }
  }, [slots, plotType, computedA, computedB, hrmaPeriod, smmaPeriod, fitKey]);

  return (
    <div className="relative w-full rounded-lg border border-border bg-card p-4">
      <div ref={containerRef} className="w-full" />
      {chartApi && hostSeries && (
        <ComparisonDrawingLayer chart={chartApi} series={hostSeries} />
      )}
    </div>
  );
}
