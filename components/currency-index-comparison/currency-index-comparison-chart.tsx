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
 * - Any 1-2 of the 9 Lane 4 indices, in two fixed SLOTS (A, B). Both slots may
 *   hold the same index, each with its own indicators; slot hue and the
 *   "(A)"/"(B)" title keep the two apart.
 * - Four plot types: no plot, line, OHLC candles, Heiken Ashi candles.
 * - HRMA and SMMA per slot, each independently hideable.
 * - ZigZag and Z-score candles ("MC") per slot, each independently hideable.
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
 * ZIGZAG shows its segment class (lib/currency-index-comparison/zigzag.ts) by
 * LINE WEIGHT in the slot's hue -- Normal 1px, Large 2px, Extreme 4px -- not by
 * extra hues. Validated 2026-09-14: every palette hue left for two class
 * colors fails the CVD or normal-vision floor against one of the slot hues
 * (orange vs gold, violet vs dark-mode blue, red vs gold) or is taken by the
 * Z-score candles. Weight is ordinal, needs no new hue, and was Davin's call.
 * Each class is its own line series holding every pivot, with only that
 * class's segments painted (see zigzagSegmentStarts()).
 *
 * Z-SCORE CANDLES are a polarity x magnitude encoding: direction by hue, green
 * up / magenta down (the palette's green and magenta steps, CVD pair PASS in
 * both modes: dE 17.6 light / 13.0 dark), class by body strength -- Extreme
 * candles fully filled, Large candles with a tint of the same hue blended into
 * the chart surface (60%) and a full-hue outline. Each tint + full pair passes
 * validate_palette.js --ordinal against its surface. Against the slot hues
 * (--pairs all) the only non-PASS is green vs gold at CVD dE 6.9, a WARN whose
 * relief is the labelled legend key and the different mark (candle bodies vs
 * the gold line / hollow candles). Light magenta uses the palette's darker
 * magenta step, since the light step is 2.69:1 on white and its tint cannot
 * clear 2:1. Normal candles are not drawn at all.
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
import {
  classifyZigZagSegments,
  detectZigZagPivots,
  zigzagSegmentStarts,
  type ZigZagClass,
  type ZigZagPivot,
} from '@/lib/currency-index-comparison/zigzag';
import {
  isHighlightedZScoreClass,
  zscoreCandleClasses,
  type HighlightedZScoreClass,
  type ZScoreCandleClass,
} from '@/lib/currency-index-comparison/zscore-candle';
import { useChartTimeOptions } from '@/components/charts/use-chart-time-options';

export type PlotType = 'none' | 'line' | 'ohlc' | 'heikin-ashi';
export type SlotId = 'A' | 'B';

export const SLOT_IDS: readonly SlotId[] = ['A', 'B'];

export interface ChartSlot {
  symbol: ComparisonIndexName;
  /**
   * Price-scale title: the symbol, or e.g. "XAUX (A)" when both slots hold
   * the same index, so their labels stay distinguishable.
   */
  label: string;
  candles: IndexCandle[];
  /** Display-only rebase base, 50-150 (100 = real values). */
  base: number;
  showHrma: boolean;
  showSmma: boolean;
  showZigzag: boolean;
  showZscore: boolean;
}

interface CurrencyIndexComparisonChartProps {
  /** Slot B may be null (only one index selected). */
  slots: Record<SlotId, ChartSlot | null>;
  plotType: PlotType;
  hrmaPeriod: number;
  smmaPeriod: number;
  zigzagDepth: number;
  zscoreLength: number;
  zscoreThreshold1: number;
  zscoreThreshold2: number;
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

export const ZIGZAG_CLASSES: readonly ZigZagClass[] = [
  'normal',
  'large',
  'extreme',
];

export const ZIGZAG_LINE_WIDTH: Record<ZigZagClass, 1 | 2 | 4> = {
  normal: 1,
  large: 2,
  extreme: 4,
};

export const ZSCORE_HIGHLIGHT_CLASSES: readonly HighlightedZScoreClass[] = [
  'up-large',
  'up-extreme',
  'down-large',
  'down-extreme',
];

const ZSCORE_COLORS: Record<
  'light' | 'dark',
  Record<HighlightedZScoreClass, { body: string; outline: string }>
> = {
  // Tints: 60% of the hue over the chart surface (#ffffff / #0a0e17).
  light: {
    'up-large': { body: '#66b566', outline: '#008300' },
    'up-extreme': { body: '#008300', outline: '#008300' },
    'down-large': { body: '#e697b3', outline: '#d55181' },
    'down-extreme': { body: '#d55181', outline: '#d55181' },
  },
  dark: {
    'up-large': { body: '#045409', outline: '#008300' },
    'up-extreme': { body: '#008300', outline: '#008300' },
    'down-large': { body: '#843657', outline: '#d55181' },
    'down-extreme': { body: '#d55181', outline: '#d55181' },
  },
};

export function zscoreClassColors(
  cls: HighlightedZScoreClass,
  theme: 'light' | 'dark'
): { body: string; outline: string } {
  return ZSCORE_COLORS[theme][cls];
}

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
  zscore: ISeriesApi<'Candlestick'>;
  zigzag: Record<ZigZagClass, ISeriesApi<'Line'>>;
}

interface SlotComputed {
  candles: IndexCandle[];
  heikinAshi: IndexCandle[];
  hrma: IndicatorPoint[];
  smma: IndicatorPoint[];
  pivots: ZigZagPivot[];
  segmentClasses: (ZigZagClass | null)[];
  zscore: (ZScoreCandleClass | null)[];
}

const EMPTY_CANDLES: IndexCandle[] = [];

/**
 * Each indicator is memoized on only its own inputs, so a slider recomputes
 * one indicator, and a rebase drag, a toggle or a plot-type switch recomputes
 * none. Keyed on the candles array, not the slot object, which is rebuilt on
 * every base/toggle change.
 */
function useSlotComputed(
  candles: IndexCandle[] | undefined,
  hrmaPeriod: number,
  smmaPeriod: number,
  zigzagDepth: number,
  zscoreLength: number,
  zscoreThreshold1: number,
  zscoreThreshold2: number
): SlotComputed {
  const source = candles ?? EMPTY_CANDLES;
  const ha = useMemo(() => heikinAshi(source), [source]);
  const hrma = useMemo(
    () => hrmaSeries(source, hrmaPeriod),
    [source, hrmaPeriod]
  );
  const smma = useMemo(
    () => smmaSeries(source, smmaPeriod),
    [source, smmaPeriod]
  );
  const zigzag = useMemo(() => {
    const pivots = detectZigZagPivots(source, zigzagDepth);
    return { pivots, segmentClasses: classifyZigZagSegments(pivots) };
  }, [source, zigzagDepth]);
  const zscore = useMemo(
    () =>
      zscoreCandleClasses(source, {
        length: zscoreLength,
        thresholdZ1: zscoreThreshold1,
        thresholdZ2: zscoreThreshold2,
      }),
    [source, zscoreLength, zscoreThreshold1, zscoreThreshold2]
  );
  return useMemo(
    () => ({
      candles: source,
      heikinAshi: ha,
      hrma,
      smma,
      pivots: zigzag.pivots,
      segmentClasses: zigzag.segmentClasses,
      zscore,
    }),
    [source, ha, hrma, smma, zigzag, zscore]
  );
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

/** Every pivot, painted only where it starts a segment of class `cls`. */
function toZigzagData(
  c: SlotComputed,
  cls: ZigZagClass,
  color: string,
  offset: number
) {
  const starts = zigzagSegmentStarts(c.segmentClasses, cls);
  return c.pivots.map((p, k) => ({
    time: p.time as UTCTimestamp,
    value: p.price + offset,
    color: starts[k] ? color : HOLLOW,
  }));
}

/** Only Large and Extreme candles; every other bar is simply absent. */
function toZscoreData(
  c: SlotComputed,
  theme: 'light' | 'dark',
  offset: number
) {
  const data = [];
  for (let i = 0; i < c.candles.length; i++) {
    const cls = c.zscore[i] ?? null;
    if (!isHighlightedZScoreClass(cls)) continue;
    const { body, outline } = zscoreClassColors(cls, theme);
    const s = shiftCandle(c.candles[i] as IndexCandle, offset);
    data.push({
      time: s.time as UTCTimestamp,
      open: s.open,
      high: s.high,
      low: s.low,
      close: s.close,
      color: body,
      borderColor: outline,
      wickColor: outline,
    });
  }
  return data;
}

export function CurrencyIndexComparisonChart({
  slots,
  plotType,
  hrmaPeriod,
  smmaPeriod,
  zigzagDepth,
  zscoreLength,
  zscoreThreshold1,
  zscoreThreshold2,
  fitKey,
  height = 520,
}: CurrencyIndexComparisonChartProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const chartTime = useChartTimeOptions(chartRef);
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

    // Created in layers so z-order is the same for both slots: candles, then
    // Z-score candles over them, then the close lines and averages, then the
    // ZigZag on top.
    const candles = {} as Record<SlotId, ISeriesApi<'Candlestick'>>;
    const zscores = {} as Record<SlotId, ISeriesApi<'Candlestick'>>;
    for (const slot of SLOT_IDS) {
      candles[slot] = chart.addSeries(CandlestickSeries, {
        ...candleStyle(slotColor(slot, resolvedTheme)),
        priceLineVisible: false,
        // The close LINE series carries the price-scale label in every plot
        // type: a candlestick's label takes the last bar's body color, which
        // is transparent for a rising (hollow) candle, so the label would
        // lose the slot's hue exactly when the index is going up. Found in
        // live verification, not in theory.
        lastValueVisible: false,
        visible: false,
      });
    }
    for (const slot of SLOT_IDS) {
      // Colors come per bar with the data (toZscoreData).
      zscores[slot] = chart.addSeries(CandlestickSeries, {
        borderVisible: true,
        wickVisible: true,
        priceLineVisible: false,
        lastValueVisible: false,
        visible: false,
      });
    }
    for (const slot of SLOT_IDS) {
      const color = slotColor(slot, resolvedTheme);
      seriesRef.current[slot] = {
        candle: candles[slot],
        zscore: zscores[slot],
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
        zigzag: {} as Record<ZigZagClass, ISeriesApi<'Line'>>,
      };
    }
    for (const slot of SLOT_IDS) {
      const s = seriesRef.current[slot];
      if (!s) continue;
      for (const cls of ZIGZAG_CLASSES) {
        // Colors come per pivot with the data (toZigzagData).
        s.zigzag[cls] = chart.addSeries(LineSeries, {
          color: slotColor(slot, resolvedTheme),
          lineWidth: ZIGZAG_LINE_WIDTH[cls],
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
          pointMarkersVisible: false,
          visible: false,
        });
      }
    }

    chartRef.current = chart;
    chartTime.applyTo(chart);
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

  const computedA = useSlotComputed(
    slots.A?.candles,
    hrmaPeriod,
    smmaPeriod,
    zigzagDepth,
    zscoreLength,
    zscoreThreshold1,
    zscoreThreshold2
  );
  const computedB = useSlotComputed(
    slots.B?.candles,
    hrmaPeriod,
    smmaPeriod,
    zigzagDepth,
    zscoreLength,
    zscoreThreshold1,
    zscoreThreshold2
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
      // Per-bar colors are baked into the Z-score and ZigZag data, so both are
      // re-pushed on a theme change too.
      s.zscore.setData(present ? toZscoreData(c, resolvedTheme, offset) : []);
      s.zscore.applyOptions({ visible: present && !!slot?.showZscore });
      const color = slotColor(slotId, resolvedTheme);
      for (const cls of ZIGZAG_CLASSES) {
        s.zigzag[cls].setData(
          present ? toZigzagData(c, cls, color, offset) : []
        );
        s.zigzag[cls].applyOptions({
          visible: present && !!slot?.showZigzag && c.pivots.length >= 2,
        });
      }

      const symbol = slot?.label ?? '';
      s.candle.applyOptions({
        visible: present && (plotType === 'ohlc' || plotType === 'heikin-ashi'),
      });
      // Visible in every plot type but 'none', so its colored label shows in
      // both candle modes too (see the candle series' creation comment); only
      // its STROKE is hidden there. The label is the REAL close, also in
      // Heiken Ashi mode, where the HA close is a synthetic average. No Plot
      // hides the index itself, label included, leaving only its indicators.
      s.line.applyOptions({
        visible: present && plotType !== 'none',
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
  }, [
    slots,
    plotType,
    computedA,
    computedB,
    hrmaPeriod,
    smmaPeriod,
    resolvedTheme,
    fitKey,
  ]);

  return (
    <div className="relative w-full rounded-lg border border-border bg-card p-4">
      <div ref={containerRef} className="w-full" />
      {chartApi && hostSeries && (
        <ComparisonDrawingLayer chart={chartApi} series={hostSeries} />
      )}
    </div>
  );
}
