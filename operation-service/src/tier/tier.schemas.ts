import { z } from 'zod';

import {
  type Tier,
  SYMBOLS,
  TIMEFRAMES,
  canAccessSymbol,
} from '@trading-alerts/types/tier';

/**
 * Tier constants — now sourced directly from `@trading-alerts/types/tier`
 * (Session 11-2), the same canonical package `lib/tier-config.ts` consumes.
 * Previously these were re-defined locally because `operation-service`
 * "cannot import monolith `lib/*` code directly" (Session 4B-8's Drawings/
 * Alerts precedent) — but `@trading-alerts/types` is already a `file:`
 * dependency here (not monolith `lib/*`), so that constraint never applied
 * to it. `canAccessSymbol`'s argument order (`(symbol, tier)`) is unchanged
 * by this move — it already matched the canonical package.
 *
 * @module tier/tier.schemas
 */
export type { Tier };
export { SYMBOLS, TIMEFRAMES, canAccessSymbol };

export const FREE_SYMBOLS = SYMBOLS;
export const PRO_SYMBOLS = SYMBOLS;
export const FREE_TIMEFRAMES = TIMEFRAMES;
export const PRO_TIMEFRAMES = TIMEFRAMES;

/** Path-param validation for `GET /tier/check/:symbol` — just a non-empty string; the service itself uppercases and checks membership. */
export const tierSymbolParamSchema = z.string().min(1);
