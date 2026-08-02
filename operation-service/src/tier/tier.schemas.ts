import { z } from 'zod';

/**
 * Tier constants — mirrors `lib/tier-config.ts`'s SINGLE SOURCE OF TRUTH
 * exactly (V8 single-symbol architecture: one symbol, two timeframes, both
 * tiers identical, no tier gating applied by any of the 3 ported routes).
 * `operation-service` cannot import monolith `lib/*` code directly, so
 * these are re-defined locally, matching the established Drawings/Alerts
 * precedent (Session 4B-8) of locally re-implementing `lib/tier-validation.ts`'s
 * semantics rather than importing across the service boundary.
 *
 * `canAccessSymbol` here matches `lib/tier-config.ts`'s function of the same
 * name (argument order `(symbol, tier)`) — NOT `lib/tier-validation.ts`'s
 * differently-scoped, differently-ordered `canAccessSymbol(tier, symbol)`
 * already used by Drawings/Alerts. The 3 SOURCE tier routes only ever import
 * from `lib/tier-config.ts`.
 *
 * @module tier/tier.schemas
 */
export type Tier = 'FREE' | 'PRO';

export const SYMBOLS = ['XAUUSD'] as const;
export const TIMEFRAMES = ['M5', 'M15'] as const;

export const FREE_SYMBOLS = SYMBOLS;
export const PRO_SYMBOLS = SYMBOLS;
export const FREE_TIMEFRAMES = TIMEFRAMES;
export const PRO_TIMEFRAMES = TIMEFRAMES;

/**
 * Check if a tier can access a specific symbol.
 * V8: tier-independent — XAUUSD only.
 */
export function canAccessSymbol(symbol: string, _tier: Tier): boolean {
  return (SYMBOLS as readonly string[]).includes(symbol.toUpperCase());
}

/** Path-param validation for `GET /tier/check/:symbol` — just a non-empty string; the service itself uppercases and checks membership. */
export const tierSymbolParamSchema = z.string().min(1);
