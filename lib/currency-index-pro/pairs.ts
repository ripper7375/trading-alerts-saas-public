/**
 * Currency Index PRO Plan — Phase 2 28-pair confluence screener (spec
 * Sections 6.1/6.2). Pure functions, no Prisma/I/O.
 *
 * @module lib/currency-index-pro/pairs
 */

import type { ZoneState, SignalType } from './signals';

export type CurrencyCode =
  | 'USD'
  | 'EUR'
  | 'GBP'
  | 'JPY'
  | 'AUD'
  | 'CAD'
  | 'CHF'
  | 'NZD';

/** The 8 G8 currencies this plan covers -- never XAUX, which has its own
 * unrelated 01:01 rollover and isn't part of the PRO screener. Single
 * source of truth: `screener/route.ts`, `detail/route.ts`, and the Phase 3
 * chart component all import this rather than each declaring their own
 * copy of the same 8-element array. */
export const ALL_CURRENCIES: readonly CurrencyCode[] = [
  'USD',
  'EUR',
  'GBP',
  'JPY',
  'AUD',
  'CAD',
  'CHF',
  'NZD',
];

/** `${currency}X` -- the index name a currency maps to in `CurrencyGoldIndex`. */
export function indexNameForCurrency(currency: CurrencyCode): string {
  return `${currency}X`;
}

export interface CurrencyPairDef {
  pair: string;
  base: CurrencyCode;
  quote: CurrencyCode;
}

/**
 * All 28 pure FX crosses from the G8 basket (C(8,2) = 28), base/quote per
 * real market quoting convention -- spec Section 6.2's own enumeration.
 */
export const CURRENCY_PAIRS: readonly CurrencyPairDef[] = [
  // USD pairs (7)
  { pair: 'EURUSD', base: 'EUR', quote: 'USD' },
  { pair: 'GBPUSD', base: 'GBP', quote: 'USD' },
  { pair: 'AUDUSD', base: 'AUD', quote: 'USD' },
  { pair: 'NZDUSD', base: 'NZD', quote: 'USD' },
  { pair: 'USDJPY', base: 'USD', quote: 'JPY' },
  { pair: 'USDCAD', base: 'USD', quote: 'CAD' },
  { pair: 'USDCHF', base: 'USD', quote: 'CHF' },
  // EUR crosses (6)
  { pair: 'EURGBP', base: 'EUR', quote: 'GBP' },
  { pair: 'EURJPY', base: 'EUR', quote: 'JPY' },
  { pair: 'EURAUD', base: 'EUR', quote: 'AUD' },
  { pair: 'EURNZD', base: 'EUR', quote: 'NZD' },
  { pair: 'EURCAD', base: 'EUR', quote: 'CAD' },
  { pair: 'EURCHF', base: 'EUR', quote: 'CHF' },
  // GBP crosses (5)
  { pair: 'GBPJPY', base: 'GBP', quote: 'JPY' },
  { pair: 'GBPAUD', base: 'GBP', quote: 'AUD' },
  { pair: 'GBPNZD', base: 'GBP', quote: 'NZD' },
  { pair: 'GBPCAD', base: 'GBP', quote: 'CAD' },
  { pair: 'GBPCHF', base: 'GBP', quote: 'CHF' },
  // AUD crosses (4)
  { pair: 'AUDJPY', base: 'AUD', quote: 'JPY' },
  { pair: 'AUDNZD', base: 'AUD', quote: 'NZD' },
  { pair: 'AUDCAD', base: 'AUD', quote: 'CAD' },
  { pair: 'AUDCHF', base: 'AUD', quote: 'CHF' },
  // NZD crosses (3)
  { pair: 'NZDJPY', base: 'NZD', quote: 'JPY' },
  { pair: 'NZDCAD', base: 'NZD', quote: 'CAD' },
  { pair: 'NZDCHF', base: 'NZD', quote: 'CHF' },
  // CAD crosses (2)
  { pair: 'CADJPY', base: 'CAD', quote: 'JPY' },
  { pair: 'CADCHF', base: 'CAD', quote: 'CHF' },
  // CHF cross (1)
  { pair: 'CHFJPY', base: 'CHF', quote: 'JPY' },
];

export interface IndexState {
  currency: CurrencyCode;
  changePct: number;
  zone: ZoneState;
  signal: SignalType;
}

export type PairAction = 'BUY' | 'SELL' | null;

/**
 * Spec Section 6.1's quoting invariant. A currency overbought is expected
 * to weaken; a currency oversold is expected to strengthen. Whether that
 * means BUY or SELL the pair depends on whether the currency is the base
 * or the quote:
 *   base overbought (weakens)  -> pair falls -> SELL
 *   base oversold  (strengthens) -> pair rises -> BUY
 *   quote overbought (weakens) -> pair rises (more of a cheaper quote per base) -> BUY
 *   quote oversold  (strengthens) -> pair falls -> SELL
 * Base is checked first: if both base and quote happen to read a zone at
 * once (rare -- normally only one currency at a time is most extreme), the
 * base's own signal is the more direct read on this specific pair.
 * Returns null when neither side has a Stage A zone reading at all.
 */
export function resolvePairAction(
  base: IndexState,
  quote: IndexState
): PairAction {
  if (base.zone === 'OVERBOUGHT') return 'SELL';
  if (base.zone === 'OVERSOLD') return 'BUY';
  if (quote.zone === 'OVERBOUGHT') return 'BUY';
  if (quote.zone === 'OVERSOLD') return 'SELL';
  return null;
}

export type ConfluenceLevel =
  | 'BASELINE_DIVERGENCE'
  | 'SINGLE_CONFLUENCE'
  | 'SINGLE_CONFIRMED'
  | 'DOUBLE_CONFLUENCE';

const CONFLUENCE_WEIGHT: Record<ConfluenceLevel, number> = {
  BASELINE_DIVERGENCE: 1.0,
  SINGLE_CONFLUENCE: 1.5,
  SINGLE_CONFIRMED: 2.5,
  DOUBLE_CONFLUENCE: 4.0,
};

/** Spec Section 6.2's W-weight tiers, in the spec's own naming. */
export function classifyConfluence(
  base: IndexState,
  quote: IndexState
): ConfluenceLevel {
  // "Golden Setup": one side CONFIRMED_SELL and the other CONFIRMED_BUY,
  // order-independent -- the pair's two currencies confirming opposite
  // directions is the strongest possible reading regardless of which one
  // is base/quote.
  const isDoubleConfluence =
    (base.signal === 'CONFIRMED_SELL' && quote.signal === 'CONFIRMED_BUY') ||
    (base.signal === 'CONFIRMED_BUY' && quote.signal === 'CONFIRMED_SELL');
  if (isDoubleConfluence) return 'DOUBLE_CONFLUENCE';

  if (base.signal !== 'NONE' || quote.signal !== 'NONE') {
    return 'SINGLE_CONFIRMED';
  }
  if (base.zone !== 'NEUTRAL' || quote.zone !== 'NEUTRAL') {
    return 'SINGLE_CONFLUENCE';
  }
  return 'BASELINE_DIVERGENCE';
}

export interface PairScore {
  pair: string;
  base: CurrencyCode;
  quote: CurrencyCode;
  action: PairAction;
  divergenceSpread: number;
  confluenceLevel: ConfluenceLevel;
  score: number;
}

/**
 * Scores and ranks all 28 pairs per spec Section 6.2's
 * `S = |Index_Base - Index_Quote| * W_Stage` formula. `states` must have an
 * entry for every one of the 8 G8 currencies -- a missing one throws rather
 * than silently scoring against `undefined`, since that would be a real
 * upstream bug (Lane 4 not yet having pushed all 8 indices today).
 */
export function scorePairs(
  states: Record<CurrencyCode, IndexState>
): PairScore[] {
  return CURRENCY_PAIRS.map(({ pair, base, quote }) => {
    const baseState = states[base];
    const quoteState = states[quote];
    if (!baseState || !quoteState) {
      throw new Error(
        `scorePairs: missing index state for ${!baseState ? base : quote}`
      );
    }

    const divergenceSpread = Math.abs(
      baseState.changePct - quoteState.changePct
    );
    const confluenceLevel = classifyConfluence(baseState, quoteState);

    return {
      pair,
      base,
      quote,
      action: resolvePairAction(baseState, quoteState),
      divergenceSpread,
      confluenceLevel,
      score: divergenceSpread * CONFLUENCE_WEIGHT[confluenceLevel],
    };
  }).sort((a, b) => b.score - a.score);
}
