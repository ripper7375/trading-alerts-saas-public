'use client';

/**
 * HrmaSmmaDetailModal — per-currency HRMA/SMMA line-plot modal, with
 * instant "what-if" period sliders.
 *
 * Built at Davin's explicit request: a table badge (`CONFIRMED_BUY`/
 * `CONFIRMED_SELL`) asks the user to trust a black box; this shows the
 * actual HRMA/SMMA cross, the corridor bands, and the warm-up boundary so
 * the user can verify a signal instead -- and, per a same-day follow-up
 * request, lets the user drag the HRMA/SMMA period sliders and see the
 * lines, the corridor-relative crossing, and the confirmed-signal readout
 * update instantly, with zero server round-trip per change.
 *
 * That instant recompute is possible because `/detail` already returns
 * every bar's raw `changePct` alongside the server-computed hrma/smma, and
 * `computeHrma`/`computeSmma`/`classifyZone`/`detectStageBSignal` are pure,
 * client-safe functions (no Prisma, no server-only imports) -- the same
 * functions the API route itself uses. Dragging a slider re-runs the exact
 * same computation locally over ~100 data points, which is sub-millisecond,
 * so `onValueChange` (continuous, not `onValueCommit`) is used throughout.
 *
 * This is a SESSION-LOCAL exploration, not a silent preference write: the
 * sliders start at the user's saved `hrmaPeriod`/`smmaPeriod` (echoed back
 * by `/detail` for exactly this reason) and reset to that saved value every
 * time the modal is freshly opened, matching "explore, don't discard your
 * real settings" semantics. An explicit "Save as my default" button
 * (visible only once the sliders actually differ from the saved values)
 * commits the explored periods via the `/preferences` PUT route already
 * built in Phase 2.
 *
 * The modal chart's own lifecycle differs from `RelativeStrengthChart`'s
 * mount-once pattern: `DialogContent` unmounts its children when closed
 * (the container div itself leaves the DOM), so the chart must be
 * recreated on every open, not created once and reused.
 *
 * @module components/currency-index-pro/chart/hrma-smma-detail-modal
 */

import {
  createChart,
  createSeriesMarkers,
  LineSeries,
  LineStyle,
  ColorType,
  type IChartApi,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type IPriceLine,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts';
import { useEffect, useMemo, useRef, useState } from 'react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { useChartAppearance } from '@/components/providers/appearance-provider';
import { EventVerticalLine } from '@/components/charts/drawing/EventVerticalLine';
import { computeHrma, computeSmma } from '@/lib/currency-index-pro/math';
import {
  classifyZone,
  detectStageBSignal,
  type SignalBar,
  type SignalType,
} from '@/lib/currency-index-pro/signals';
import type { CurrencyCode } from '@/lib/currency-index-pro/pairs';

import { useCurrencyIndexDetail } from '../hooks/use-currency-index-detail';

interface HrmaSmmaDetailModalProps {
  open: boolean;
  currency: CurrencyCode | null;
  onOpenChange: (open: boolean) => void;
}

const CHART_HEIGHT = 280;

// Spec Sections 4.1/4.2's own customization ranges.
const HRMA_MIN = 10;
const HRMA_MAX = 100;
const SMMA_MIN = 5;
const SMMA_MAX = 50;

/** Mirrors relative-strength-chart.tsx's own duplicated copy of
 * trading-chart.tsx's private chartChromeColors(). */
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

// Deliberately NOT reused from the currency palette (colors.ts) -- HRMA/SMMA
// are indicator lines, not currency identities, and reusing e.g. USD's blue
// here would visually suggest a (nonexistent) link to that currency.
const HRMA_COLOR = { light: '#2a78d6', dark: '#3987e5' };
const SMMA_COLOR = { light: '#eb6834', dark: '#d95926' };
const CORRIDOR_LINE_COLOR = 'rgba(234, 179, 8, 0.6)';
const WARMUP_LINE_OPTIONS = { color: 'rgba(148, 163, 184, 0.6)', width: 1 };

interface RecomputedSeries {
  bars: (SignalBar & { barTime: number })[];
  minBarsForSignal: number;
  signal: SignalType;
}

export function HrmaSmmaDetailModal({
  open,
  currency,
  onOpenChange,
}: HrmaSmmaDetailModalProps): React.JSX.Element {
  // A state-backed callback ref, not `useRef` -- `DialogContent` renders
  // through a Radix portal, so a plain `useRef` + `useEffect(..., [open])`
  // can fire before the container div has actually attached to the DOM
  // (confirmed live: the chart silently never got created, 0 canvases).
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const hrmaSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const smmaSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const markersPluginRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const priceLinesRef = useRef<IPriceLine[]>([]);
  const warmupLineRef = useRef<EventVerticalLine | null>(null);

  const { resolvedTheme, gridOpacityDecimal } = useChartAppearance();
  const { data, isLoading } = useCurrencyIndexDetail(open, currency);

  // Defaults match UserCurrencyIndexPreference's own Prisma-schema defaults
  // -- overwritten as soon as `data` arrives with the user's real saved
  // values (see the sync effect below).
  const [hrmaPeriod, setHrmaPeriod] = useState(36);
  const [smmaPeriod, setSmmaPeriod] = useState(13);
  const [savingDefault, setSavingDefault] = useState(false);
  // Tracks whether THIS open session has already synced the sliders to the
  // freshly-fetched saved default -- reset on close so the next open starts
  // a clean exploration rather than carrying over a prior what-if value.
  const syncedThisOpenRef = useRef(false);

  useEffect(() => {
    if (!open) syncedThisOpenRef.current = false;
  }, [open]);

  useEffect(() => {
    if (data && !syncedThisOpenRef.current) {
      setHrmaPeriod(data.hrmaPeriod);
      setSmmaPeriod(data.smmaPeriod);
      syncedThisOpenRef.current = true;
    }
  }, [data]);

  // The instant "what-if" recompute -- pure, client-side, zero server
  // round-trip. Re-runs on every slider tick, not just on release.
  const recomputed = useMemo<RecomputedSeries | null>(() => {
    if (!data) return null;
    const changePcts = data.series.map((bar) => bar.changePct);
    const hrmaValues = computeHrma(changePcts, hrmaPeriod);
    const smmaValues = computeSmma(changePcts, smmaPeriod);

    const bars = data.series.map((bar, i) => ({
      barTime: bar.barTime,
      zone: classifyZone(bar.changePct, data.corridor),
      hrma: hrmaValues[i] as number,
      smma: smmaValues[i] as number | null,
    }));

    const minBarsForSignal = Math.max(hrmaPeriod, smmaPeriod);
    const signal =
      bars.length > 0 ? detectStageBSignal(bars, 6, minBarsForSignal) : 'NONE';

    return { bars, minBarsForSignal, signal };
  }, [data, hrmaPeriod, smmaPeriod]);

  // Recreated every time the modal opens (and the container div actually
  // attaches -- a plain useRef + useEffect([open]) can fire before a Radix
  // portal has attached its content, confirmed live during Phase 3).
  useEffect(() => {
    if (!open || !container || chartRef.current) return;

    const chrome = chartChromeColors(resolvedTheme, gridOpacityDecimal);
    const width = container.clientWidth || 480;

    const chart = createChart(container, {
      width,
      height: CHART_HEIGHT,
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

    const hrmaSeries = chart.addSeries(LineSeries, {
      color: HRMA_COLOR[resolvedTheme],
      lineWidth: 2,
      title: 'HRMA',
      lastValueVisible: true,
      priceLineVisible: false,
    });
    const smmaSeries = chart.addSeries(LineSeries, {
      color: SMMA_COLOR[resolvedTheme],
      lineWidth: 2,
      lineStyle: LineStyle.Dashed,
      title: 'SMMA',
      lastValueVisible: true,
      priceLineVisible: false,
    });
    const markersPlugin = createSeriesMarkers(hrmaSeries, []);

    chartRef.current = chart;
    hrmaSeriesRef.current = hrmaSeries;
    smmaSeriesRef.current = smmaSeries;
    markersPluginRef.current = markersPlugin;

    return (): void => {
      markersPlugin.detach();
      chart.remove();
      chartRef.current = null;
      hrmaSeriesRef.current = null;
      smmaSeriesRef.current = null;
      markersPluginRef.current = null;
      priceLinesRef.current = [];
      warmupLineRef.current = null;
    };
    // Recreated per `open`/`container` transition, not on every appearance
    // change -- this modal chart is short-lived enough that a stale theme
    // on an already-open modal is an acceptable, rare rough edge.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, container]);

  // Repaint the chart whenever the recomputed (what-if) series changes --
  // on every slider tick, not just when new data arrives from the server.
  useEffect(() => {
    const chart = chartRef.current;
    const hrmaSeries = hrmaSeriesRef.current;
    const smmaSeries = smmaSeriesRef.current;
    if (!chart || !hrmaSeries || !smmaSeries || !recomputed) return;

    hrmaSeries.setData(
      recomputed.bars.map((bar) => ({
        time: bar.barTime as UTCTimestamp,
        value: bar.hrma,
      }))
    );
    smmaSeries.setData(
      recomputed.bars
        .filter((bar) => bar.smma !== null)
        .map((bar) => ({
          time: bar.barTime as UTCTimestamp,
          value: bar.smma as number,
        }))
    );

    for (const line of priceLinesRef.current) hrmaSeries.removePriceLine(line);
    priceLinesRef.current = data?.corridor
      ? [
          hrmaSeries.createPriceLine({
            price: data.corridor.strikeZonePct,
            color: CORRIDOR_LINE_COLOR,
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            title: 'Overbought',
            axisLabelVisible: true,
          }),
          hrmaSeries.createPriceLine({
            price: -data.corridor.strikeZonePct,
            color: CORRIDOR_LINE_COLOR,
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            title: 'Oversold',
            axisLabelVisible: true,
          }),
        ]
      : [];

    // Confirmed-cross marker on the latest bar -- signals are always
    // evaluated against the most recent closed bar (spec Section 4.3), not
    // a historical scan, so there is at most one marker to show.
    const latest = recomputed.bars[recomputed.bars.length - 1];
    if (recomputed.signal !== 'NONE' && latest) {
      const marker: SeriesMarker<Time> = {
        time: latest.barTime as unknown as Time,
        position:
          recomputed.signal === 'CONFIRMED_BUY' ? 'belowBar' : 'aboveBar',
        color: recomputed.signal === 'CONFIRMED_BUY' ? '#10b981' : '#ef4444',
        shape: recomputed.signal === 'CONFIRMED_BUY' ? 'arrowUp' : 'arrowDown',
        text: recomputed.signal === 'CONFIRMED_BUY' ? 'BUY' : 'SELL',
      };
      markersPluginRef.current?.setMarkers([marker]);
    } else {
      markersPluginRef.current?.setMarkers([]);
    }

    if (warmupLineRef.current) {
      hrmaSeries.detachPrimitive(warmupLineRef.current);
      warmupLineRef.current = null;
    }
    const warmupBar = recomputed.bars[recomputed.minBarsForSignal - 1];
    if (warmupBar) {
      const line = new EventVerticalLine(
        chart,
        hrmaSeries,
        warmupBar.barTime as UTCTimestamp,
        WARMUP_LINE_OPTIONS
      );
      hrmaSeries.attachPrimitive(line);
      warmupLineRef.current = line;
    }

    // Only fit content once per fresh data load (a new bar range), not on
    // every slider tick -- otherwise dragging a slider would keep resetting
    // any zoom/pan the user just did to inspect the cross more closely.
  }, [recomputed, data?.corridor]);

  useEffect(() => {
    chartRef.current?.timeScale().fitContent();
  }, [data]);

  const handleSaveDefault = async (): Promise<void> => {
    setSavingDefault(true);
    try {
      await fetch('/api/market/currency-index-pro/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hrmaPeriod, smmaPeriod }),
      });
    } catch (error) {
      console.error(
        '[currency-index-pro] failed to save what-if periods as default:',
        error
      );
    } finally {
      setSavingDefault(false);
    }
  };

  const hasData = !!data && data.series.length > 0;
  const periodsChanged =
    !!data &&
    (hrmaPeriod !== data.hrmaPeriod || smmaPeriod !== data.smmaPeriod);
  const warmedUp = recomputed
    ? recomputed.bars.length >= recomputed.minBarsForSignal
    : false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {currency ? `${currency} — HRMA × SMMA Detail` : 'Detail'}
          </DialogTitle>
        </DialogHeader>

        {hasData && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-muted-foreground">
                  HRMA period
                </span>
                <span className="font-mono tabular-nums">{hrmaPeriod}</span>
              </div>
              <Slider
                value={[hrmaPeriod]}
                min={HRMA_MIN}
                max={HRMA_MAX}
                step={1}
                onValueChange={(val) => setHrmaPeriod(val[0] ?? hrmaPeriod)}
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-muted-foreground">
                  SMMA period
                </span>
                <span className="font-mono tabular-nums">{smmaPeriod}</span>
              </div>
              <Slider
                value={[smmaPeriod]}
                min={SMMA_MIN}
                max={SMMA_MAX}
                step={1}
                onValueChange={(val) => setSmmaPeriod(val[0] ?? smmaPeriod)}
              />
            </div>
          </div>
        )}

        <div className="relative" style={{ height: CHART_HEIGHT }}>
          <div ref={setContainer} className="w-full" />
          {isLoading && (
            <div className="bg-card/70 absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
              Loading…
            </div>
          )}
          {!isLoading && data && !hasData && (
            <div className="bg-card/70 absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
              No data for {currency} yet today.
            </div>
          )}
        </div>

        {hasData && recomputed && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {warmedUp
                ? `Signals are reliable from bar ${recomputed.minBarsForSignal} onward (dashed grey line). `
                : `Still warming up — needs ${recomputed.minBarsForSignal} bars (has ${recomputed.bars.length}) before a crossing can confirm. `}
              What-if reading:{' '}
              {recomputed.signal !== 'NONE' ? (
                <span
                  className={
                    recomputed.signal === 'CONFIRMED_BUY'
                      ? 'font-semibold text-emerald-600 dark:text-emerald-400'
                      : 'font-semibold text-red-600 dark:text-red-400'
                  }
                >
                  {recomputed.signal.replace('_', ' ')}
                </span>
              ) : (
                <span className="font-semibold">no confirmed signal</span>
              )}
            </p>
            {periodsChanged && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={savingDefault}
                onClick={() => void handleSaveDefault()}
              >
                {savingDefault ? 'Saving…' : 'Save as my default'}
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
