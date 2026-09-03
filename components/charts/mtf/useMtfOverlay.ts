'use client';

/**
 * useMtfOverlay — PRO-exclusive multi-timeframe visualization (V8).
 *
 * When enabled, fetches the M5 equal-distance channel (upper `uoedt`,
 * mid `base_fl`, lower `loedt` of a centroid variant) from
 * /api/market-data/channel and renders it as three line series overlaid
 * on the host chart (typically the M15 chart) — mirroring the
 * backend-stack-c v2.29 "same M5 channel on Chart B/C" design.
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

import type { CentroidVariant } from '@/types/indicator';

interface ChannelPoint {
  time: number;
  upper: number | null;
  mid: number | null;
  lower: number | null;
}

interface ChannelResponse {
  success: boolean;
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

export function useMtfOverlay(
  chart: IChartApi | null,
  enabled: boolean,
  options: {
    symbol: string;
    /** Timeframe of the channel to overlay (source), e.g. 'M5'. */
    sourceTimeframe: string;
    variant?: CentroidVariant;
  }
): UseMtfOverlayResult {
  const { symbol, sourceTimeframe, variant = 'best_fit_a' } = options;
  const seriesRef = useRef<ISeriesApi<'Line'>[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!chart || !enabled) return;

    let cancelled = false;
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
    };

    void (async (): Promise<void> => {
      try {
        const res = await fetch(
          `/api/market-data/channel?symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(sourceTimeframe)}&variant=${encodeURIComponent(variant)}`
        );
        const data = (await res.json()) as ChannelResponse;

        if (cancelled) return;

        if (!res.ok || !data.success || !data.points) {
          setError(data.message ?? data.error ?? 'Failed to load MTF channel');
          return;
        }

        removeSeries();

        const mkSeries = (key: 'upper' | 'mid' | 'lower'): ISeriesApi<'Line'> =>
          chart.addSeries(LineSeries, {
            color: COLORS[key],
            lineWidth: 1,
            lineStyle: key === 'mid' ? LineStyle.Dashed : LineStyle.Solid,
            priceLineVisible: false,
            lastValueVisible: false,
            crosshairMarkerVisible: false,
            title: `M5 ${key === 'mid' ? 'base' : key} (${variant})`,
          });

        for (const key of ['upper', 'mid', 'lower'] as const) {
          const series = mkSeries(key);
          series.setData(
            data.points
              .filter((p) => p[key] !== null)
              .map((p) => ({
                time: p.time as UTCTimestamp,
                value: p[key] as number,
              }))
          );
          seriesRef.current.push(series);
        }
      } catch {
        if (!cancelled) setError('Network error loading MTF channel');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return (): void => {
      cancelled = true;
      removeSeries();
    };
  }, [chart, enabled, symbol, sourceTimeframe, variant]);

  return { isLoading, error };
}
