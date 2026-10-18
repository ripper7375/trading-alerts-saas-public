'use client';

/**
 * useCurrencyIndexScreener — polls GET /api/market/currency-index-pro/screener.
 *
 * Same plain fetch+useEffect polling (`startVisiblePolling`) as
 * `useCurrencyIndexChart`. Phase 3 only consumes `spreadDelta` (the header's
 * "jackpot meter" gauge); the full response is typed here so Phase 4's
 * screener/analysis tables can reuse this same hook rather than a second,
 * near-identical one.
 *
 * @module components/currency-index-pro/hooks/use-currency-index-screener
 */

import { useEffect, useState } from 'react';

import {
  startVisiblePolling,
  type PollRequest,
} from '@/lib/utils/visible-polling';

const REFRESH_MS = 30 * 1000;

export interface SpreadDelta {
  spreadPct: number;
  status: 'LOW' | 'ACTIVE' | 'EXTREME';
  leader: { currency: string; changePct: number };
  laggard: { currency: string; changePct: number };
}

export interface DashboardRowM5 {
  currency: string;
  indexName: string;
  price: number;
  changePct: number;
  highPct: number;
  lowPct: number;
}

export interface AnalysisRowM15 {
  currency: string;
  indexName: string;
  currentPct: number;
  zone: string;
  hrma: number | null;
  smma: number | null;
  crossoverState: string;
  recommendedActions: Array<{ pair: string; action: 'BUY' | 'SELL' }>;
}

export interface TopTrade {
  rank: number;
  pair: string;
  action: string;
  divergenceSpread: number;
  confluenceLevel: string;
}

export interface CurrencyIndexScreenerData {
  serverTime: number;
  spreadDelta: SpreadDelta;
  dashboardTableM5: DashboardRowM5[];
  analysisTableM15: AnalysisRowM15[];
  top5Trades: TopTrade[];
}

const EMPTY_DATA: CurrencyIndexScreenerData = {
  serverTime: 0,
  spreadDelta: {
    spreadPct: 0,
    status: 'LOW',
    leader: { currency: '', changePct: 0 },
    laggard: { currency: '', changePct: 0 },
  },
  dashboardTableM5: [],
  analysisTableM15: [],
  top5Trades: [],
};

export function useCurrencyIndexScreener(): CurrencyIndexScreenerData | null {
  const [data, setData] = useState<CurrencyIndexScreenerData | null>(null);

  useEffect(() => {
    const load = async ({ signal, isStopped }: PollRequest): Promise<void> => {
      try {
        const res = await fetch('/api/market/currency-index-pro/screener', {
          signal,
        });
        const next = res.ok
          ? ((await res.json()) as CurrencyIndexScreenerData)
          : EMPTY_DATA;
        if (!isStopped()) setData(next);
      } catch {
        // Unmount aborts the request: stay silent. A timeout or a network
        // failure degrades to EMPTY_DATA.
        if (!isStopped()) setData(EMPTY_DATA);
      }
    };

    return startVisiblePolling(load, REFRESH_MS);
  }, []);

  return data;
}
