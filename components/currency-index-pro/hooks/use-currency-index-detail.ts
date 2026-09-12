'use client';

/**
 * useCurrencyIndexDetail — on-demand fetch of one currency's full HRMA/SMMA
 * series for the detail modal.
 *
 * Gated on `{open, currency}`, mirroring `useMtfPreference`'s own
 * `active`-gated discipline: the modal is closed far more often than open,
 * so this must not poll in the background -- it fetches once when the
 * modal opens (or the selected currency changes while open) and stops.
 *
 * @module components/currency-index-pro/hooks/use-currency-index-detail
 */

import { useEffect, useState } from 'react';

import type {
  CurrencyIndexCorridor,
  CurrencyIndexBarPoint,
} from './use-currency-index-chart';
import type { ZoneState, SignalType } from '@/lib/currency-index-pro/signals';

export interface DetailSignalBar extends CurrencyIndexBarPoint {
  zone: ZoneState;
  hrma: number;
  smma: number | null;
}

export interface CurrencyIndexDetailData {
  currency: string;
  indexName: string;
  serverTime: number;
  corridor: CurrencyIndexCorridor | null;
  /** The user's saved periods, used to compute this response's own
   * `series`/`signal`. The modal's what-if sliders start here, then
   * recompute locally from `series[].changePct` for any other period --
   * never a second fetch of this same route. */
  hrmaPeriod: number;
  smmaPeriod: number;
  minBarsForSignal: number;
  signal: SignalType;
  series: DetailSignalBar[];
}

interface UseCurrencyIndexDetailResult {
  data: CurrencyIndexDetailData | null;
  isLoading: boolean;
}

export function useCurrencyIndexDetail(
  open: boolean,
  currency: string | null
): UseCurrencyIndexDetailResult {
  const [data, setData] = useState<CurrencyIndexDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!open || !currency) return;

    const controller = new AbortController();
    setIsLoading(true);
    setData(null);

    void (async (): Promise<void> => {
      try {
        const res = await fetch(
          `/api/market/currency-index-pro/detail?currency=${encodeURIComponent(currency)}`,
          { signal: controller.signal }
        );
        if (!res.ok) return;
        setData((await res.json()) as CurrencyIndexDetailData);
      } catch {
        // Includes the AbortError from the modal closing mid-request.
      } finally {
        setIsLoading(false);
      }
    })();

    return (): void => {
      controller.abort();
    };
  }, [open, currency]);

  return { data, isLoading };
}
