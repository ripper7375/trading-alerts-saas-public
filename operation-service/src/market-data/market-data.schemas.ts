import { z } from 'zod';

/**
 * Market-data channel constants + query schema — mirrors `types/indicator.ts`'s
 * `CENTROID_VARIANTS` and `lib/tier-config.ts`'s `SYMBOLS`/`TIMEFRAMES` exactly.
 * `operation-service` cannot import monolith `types/*`/`lib/*` directly, so
 * these are re-defined locally, matching the established Drawings/Tier
 * precedent (Sessions 4B-8/4B-10) of locally re-implementing shared
 * constants rather than importing across the service boundary.
 *
 * @module market-data/market-data.schemas
 */
export type Tier = 'FREE' | 'PRO';

export const SYMBOLS = ['XAUUSD'] as const;
export const TIMEFRAMES = ['M5', 'M15'] as const;

export const CENTROID_VARIANTS = [
  'best_fit',
  'cherry_a',
  'cherry_b',
  'most_recent',
  'non_a',
  'non_b',
] as const;

export type CentroidVariant = (typeof CENTROID_VARIANTS)[number];

const DEFAULT_LIMIT = 300;
const MAX_LIMIT = 1000;

/**
 * Structural defaulting only (uppercase symbol/timeframe, default variant,
 * clamp limit) — mirrors `app/api/market-data/channel/route.ts`'s own
 * defaulting logic exactly, including its `Number(limit) || DEFAULT_LIMIT`
 * NaN-tolerant fallback (a non-numeric/absent `limit` becomes the default,
 * not a validation error). Membership validation (is this symbol/timeframe/
 * variant actually supported?) is deliberately NOT done here —
 * `MarketDataService` does it, matching SOURCE's own manual if/else checks
 * and exact per-field error strings (same split as `DrawingsService`'s own
 * symbol/timeframe checks) — a generic Zod enum error would not reproduce
 * SOURCE's hand-written messages.
 */
export const channelQuerySchema = z.object({
  symbol: z
    .string()
    .optional()
    .default('XAUUSD')
    .transform((s) => s.toUpperCase()),
  timeframe: z
    .string()
    .optional()
    .default('M5')
    .transform((s) => s.toUpperCase()),
  variant: z.string().optional().default('best_fit'),
  limit: z
    .preprocess((val) => {
      const n = Number(val);
      return n || DEFAULT_LIMIT;
    }, z.number())
    .transform((n) => Math.min(Math.max(n, 1), MAX_LIMIT)),
});

export type ChannelQueryInput = z.infer<typeof channelQuerySchema>;
