'use client';

/**
 * useMtfOverlay — PRO-exclusive multi-timeframe visualization (V8).
 *
 * When enabled, fetches the M5 equal-distance channel (upper `uoedt`,
 * mid `base_fl`, lower `loedt` of the ACTIVE channel indicator) from
 * /api/market-data/channel and renders it as three line series overlaid
 * on the host chart (typically the M15 chart) — mirroring the
 * backend-stack-c v2.29 "same M5 channel on Chart B/C" design.
 *
 * WHICH INDICATOR (rule 6, ADR-010). The hook does not choose: it sends no
 * variant, and the route answers with the indicator the active-indicator
 * setting names for the timeframe (and says which in `variant` and
 * `activeIndicator`), so the overlay is on the same indicator as the sensors and
 * the renderer. The series are titled with what the route answered.
 *
 * STAYING CURRENT. The setting can change at a slot while the chart is open, and
 * a new cycle brings new bars every five minutes, so the overlay asks again
 * shortly after each slot boundary, when the new cycle has become ready
 * (REFRESH_AFTER_SLOT_MS). If the indicator is the same it updates the three
 * series in place; if it changed it replaces them. A refresh that fails keeps what
 * is on screen and reports the error; the next one tries again.
 *
 * The hook is inert while `enabled` is false, so FREE users never fetch.
 *
 * @module components/charts/mtf/useMtfOverlay
 */

import {
  LineSeries,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts';
import { useEffect, useRef, useState } from 'react';

import type { ChannelSource } from '@/lib/active-indicator/sources';

interface ChannelPoint {
  time: number;
  upper: number | null;
  mid: number | null;
  lower: number | null;
}

interface ChannelResponse {
  success: boolean;
  variant?: ChannelSource;
  points?: ChannelPoint[];
  message?: string;
  error?: string;
}

interface UseMtfOverlayResult {
  isLoading: boolean;
  error: string | null;
}

const COLORS = {
  upper: '#f2c94c', // gold — upper EDT
  mid: '#9aa0ae', // grey dashed — base fit line
  lower: '#f2c94c', // gold — lower EDT
};

const SLOT_MS = 5 * 60 * 1000;

/**
 * How long after a slot boundary the new cycle is normally ready (about a minute
 * in the first measurements, ADR-012's deadline is two): the overlay looks again
 * then, not at the boundary itself, when the answer would still be the old cycle's.
 */
export const REFRESH_AFTER_SLOT_MS = 90 * 1000;

/** Milliseconds until the next instant that is REFRESH_AFTER_SLOT_MS past a slot boundary, strictly in the future. */
export function msUntilNextCycleCheck(nowMs: number): number {
  const thisSlot =
    Math.floor(nowMs / SLOT_MS) * SLOT_MS + REFRESH_AFTER_SLOT_MS;
  return thisSlot > nowMs ? thisSlot - nowMs : thisSlot + SLOT_MS - nowMs;
}

export function useMtfOverlay(
  chart: IChartApi | null,
  enabled: boolean,
  options: {
    symbol: string;
    /** Timeframe of the channel to overlay (source), e.g. 'M5'. */
    sourceTimeframe: string;
    /**
     * Pins an indicator, for callers that must not follow the setting. Leave it
     * out to follow the active-indicator setting (the route ignores a pin while
     * the setting is resolved from the gateway).
     */
    variant?: ChannelSource;
  }
): UseMtfOverlayResult {
  const { symbol, sourceTimeframe, variant } = options;
  const seriesRef = useRef<ISeriesApi<'Line'>[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!chart || !enabled) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    // The indicator the three series on screen belong to.
    let shownSource: string | null = null;
    setIsLoading(true);
    setError(null);

    const removeSeries = (): void => {
      for (const s of seriesRef.current) {
        try {
          chart.removeSeries(s);
        } catch {
          // chart may already be disposed
        }
      }
      seriesRef.current = [];
      shownSource = null;
    };

    const keys = ['upper', 'mid', 'lower'] as const;
    const dataFor = (points: ChannelPoint[], key: (typeof keys)[number]) =>
      points
        .filter((p) => p[key] !== null)
        .map((p) => ({
          time: p.time as UTCTimestamp,
          value: p[key] as number,
        }));

    const url =
      `/api/market-data/channel?symbol=${encodeURIComponent(symbol)}` +
      `&timeframe=${encodeURIComponent(sourceTimeframe)}` +
      (variant ? `&variant=${encodeURIComponent(variant)}` : '');

    const scheduleNext = (): void => {
      if (cancelled) return;
      timer = setTimeout(() => void load(), msUntilNextCycleCheck(Date.now()));
    };

    const load = async (): Promise<void> => {
      try {
        const res = await fetch(url);
        const data = (await res.json()) as ChannelResponse;

        if (cancelled) return;

        if (!res.ok || !data.success || !data.points) {
          setError(data.message ?? data.error ?? 'Failed to load MTF channel');
          return;
        }
        setError(null);

        const source = data.variant ?? variant ?? '';
        if (
          seriesRef.current.length === keys.length &&
          shownSource === source
        ) {
          // Same indicator: new bars, update the lines where they are.
          keys.forEach((key, i) =>
            seriesRef.current[i]?.setData(dataFor(data.points!, key))
          );
          return;
        }

        // First draw, or the active indicator changed: replace the three lines.
        removeSeries();
        for (const key of keys) {
          const series = chart.addSeries(LineSeries, {
            color: COLORS[key],
            lineWidth: 1,
            lineStyle: key === 'mid' ? LineStyle.Dashed : LineStyle.Solid,
            priceLineVisible: false,
            lastValueVisible: false,
            crosshairMarkerVisible: false,
            title: `M5 ${key === 'mid' ? 'base' : key} (${source})`,
          });
          series.setData(dataFor(data.points, key));
          seriesRef.current.push(series);
        }
        shownSource = source;
      } catch {
        if (!cancelled) setError('Network error loading MTF channel');
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          scheduleNext();
        }
      }
    };

    void load();

    return (): void => {
      cancelled = true;
      if (timer !== null) clearTimeout(timer);
      removeSeries();
    };
  }, [chart, enabled, symbol, sourceTimeframe, variant]);

  return { isLoading, error };
}
