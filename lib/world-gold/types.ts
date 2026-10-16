import type { WorldGoldCurrency } from './catalog';
export interface GoldQuote {
  price: number;
  /** M5 bar END time, not its opening timestamp or the pipeline collection time. */
  updatedAt: string;
  stale: boolean;
}
export interface WorldGoldFx {
  provider: 'currencybeacon';
  rates: Record<WorldGoldCurrency, number>;
  updatedAt: string;
  observedAt: string;
  expiresAt: string;
}
export interface DerivedClose {
  marketId: string;
  sessionDate: string;
  formulaVersion: string;
  closedAt: string;
  goldBarClosedAt: string;
  fxPublishedAt: string;
  fxObservedAt: string;
  prices: Record<string, number>;
}
export interface CloseHistory {
  available: boolean;
  closes: DerivedClose[];
}
export interface WorldGoldSnapshot {
  generatedAt: string;
  gold: GoldQuote | null;
  fx: { provider: 'currencybeacon'; updatedAt: string; stale: boolean } | null;
  historyAvailable: boolean;
  markets: {
    id: string;
    status: 'open' | 'closed';
    units: {
      id: string;
      price: number | null;
      previousClose: number | null;
      change: number | null;
      changePercent: number | null;
    }[];
    updatedAt: string | null;
    previousCloseAt: string | null;
  }[];
}
