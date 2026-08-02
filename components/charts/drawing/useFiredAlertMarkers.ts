'use client';

/**
 * useFiredAlertMarkers — listens for fired line-touch alerts on the live
 * notification socket and renders "fired here" markers on the chart series
 * (Lightweight Charts v5 `createSeriesMarkers`). Filters to the current
 * symbol/timeframe.
 *
 * @module components/charts/drawing/useFiredAlertMarkers
 */

import {
  createSeriesMarkers,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type SeriesMarker,
  type Time,
} from 'lightweight-charts';
import { useEffect, useRef } from 'react';

import { useRealtimeSocket } from '@/hooks/use-realtime-socket';

import { FiredMarkerStore, type FiredMarkerView } from './firedMarkers';

function toSeriesMarkers(views: FiredMarkerView[]): SeriesMarker<Time>[] {
  return views.map((v) => ({
    time: v.time as unknown as Time,
    position: 'atPriceMiddle',
    price: v.price,
    color: '#f59e0b',
    shape: 'circle',
    text: v.levelId,
  }));
}

export function useFiredAlertMarkers(
  series: ISeriesApi<'Candlestick'> | null,
  symbol: string,
  timeframe: string
): void {
  const storeRef = useRef<FiredMarkerStore>(new FiredMarkerStore());
  const pluginRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);

  useEffect(() => {
    if (!series) return;
    const plugin = createSeriesMarkers(series, []);
    pluginRef.current = plugin;
    // Capture the store instance now — by the time this cleanup runs,
    // storeRef.current could in principle point elsewhere, so read it
    // once here rather than inside the closure (react-hooks/exhaustive-deps).
    const store = storeRef.current;
    return (): void => {
      plugin.detach();
      pluginRef.current = null;
      store.clear();
    };
  }, [series]);

  useRealtimeSocket({
    onAlertFired: (marker) => {
      if (marker.symbol !== symbol || marker.timeframe !== timeframe) return;
      const views = storeRef.current.add(
        {
          time: marker.time,
          price: marker.touchPrice,
          levelId: marker.levelId,
        },
        Date.now()
      );
      pluginRef.current?.setMarkers(toSeriesMarkers(views));
    },
  });
}
