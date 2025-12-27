# Phase 2: Core Infrastructure

**Sequential Execution Plan: Phase 2 of 6**
**Total Tasks**: 8
**Estimated Duration**: 6-8 hours
**Priority**: 🟡 IMPORTANT - Security & Infrastructure hardening

---

## 🎯 Task 2.2: Implement Auth Rate Limiting

**Priority**: HIGH | **Time**: 1 hour

#### Implementation

```typescript
// Create lib/rate-limit.ts

import { Ratelimit } from '@upstash/ratelimit';
import { redis } from './redis';

// Auth endpoints: 5 requests per 15 minutes
export const authRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '15 m'),
  analytics: true,
  prefix: 'ratelimit:auth',
});

// ✅ CORRECT tier-based rate limits (per HOUR, not per minute!)
export const tierRateLimits = {
  FREE: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(60, '1 h'), // ✅ 60 per HOUR
    analytics: true,
    prefix: 'ratelimit:free',
  }),
  PRO: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(300, '1 h'), // ✅ 300 per HOUR
    analytics: true,
    prefix: 'ratelimit:pro',
  }),
};
```

---

## 🎯 Task 2.6: Create Validation Schemas

**Priority**: MEDIUM | **Time**: 1 hour

#### Implementation

```typescript
// Create lib/validations/indicators.ts

import { z } from 'zod';

// ✅ CORRECT symbol arrays from actual implementation
const FREE_SYMBOLS = ['BTCUSD', 'EURUSD', 'USDJPY', 'US30', 'XAUUSD'] as const;

const PRO_EXCLUSIVE_SYMBOLS = [
  'AUDJPY',
  'AUDUSD',
  'ETHUSD',
  'GBPJPY',
  'GBPUSD',
  'NDX100',
  'NZDUSD',
  'USDCAD',
  'USDCHF',
  'XAGUSD',
] as const;

const ALL_SYMBOLS = [...FREE_SYMBOLS, ...PRO_EXCLUSIVE_SYMBOLS] as const;

// ✅ CORRECT timeframe arrays (NO M1 or W1!)
const FREE_TIMEFRAMES = ['H1', 'H4', 'D1'] as const;

const PRO_EXCLUSIVE_TIMEFRAMES = [
  'M5',
  'M15',
  'M30',
  'H2',
  'H8',
  'H12',
] as const;

const ALL_TIMEFRAMES = [
  'M5',
  'M15',
  'M30', // Intraday short
  'H1',
  'H2',
  'H4',
  'H8',
  'H12', // Intraday medium
  'D1', // Daily
] as const;

/**
 * Symbol validation schema
 * Validates against ALL 15 symbols
 */
export const symbolSchema = z
  .string()
  .min(1, 'Symbol is required')
  .transform((val) => val.toUpperCase())
  .refine(
    (val) => ALL_SYMBOLS.includes(val as any),
    (val) => ({
      message: `Invalid symbol: ${val}. Must be one of: ${ALL_SYMBOLS.join(', ')}`,
    })
  );

/**
 * Timeframe validation schema
 * ✅ NO M1 or W1! Includes H2, H8, H12
 */
export const timeframeSchema = z
  .string()
  .min(1, 'Timeframe is required')
  .transform((val) => val.toUpperCase())
  .refine(
    (val) => ALL_TIMEFRAMES.includes(val as any),
    (val) => ({
      message: `Invalid timeframe: ${val}. Must be one of: ${ALL_TIMEFRAMES.join(', ')}`,
    })
  );

/**
 * Bars parameter validation
 */
export const barsSchema = z
  .string()
  .optional()
  .transform((val) => (val ? parseInt(val, 10) : 1000))
  .pipe(
    z
      .number()
      .int('Bars must be an integer')
      .min(1, 'Bars must be at least 1')
      .max(5000, 'Bars cannot exceed 5000')
  );

export const indicatorRequestSchema = z.object({
  symbol: symbolSchema,
  timeframe: timeframeSchema,
  bars: barsSchema,
});

// Export constants for use in tier validation
export { FREE_SYMBOLS, PRO_EXCLUSIVE_SYMBOLS, ALL_SYMBOLS };
export { FREE_TIMEFRAMES, PRO_EXCLUSIVE_TIMEFRAMES, ALL_TIMEFRAMES };
```

---

## 🎯 Task 2.7: Create Tier Validation Utility

**Priority**: MEDIUM | **Time**: 45 minutes

#### Implementation

```typescript
// Create lib/tier-validation.ts

import { Tier } from '@prisma/client';
import {
  FREE_SYMBOLS,
  FREE_TIMEFRAMES,
  PRO_SYMBOLS,
  PRO_TIMEFRAMES,
} from './tier-config';

/**
 * ✅ CORRECT tier limits from actual implementation
 */
export const TIER_LIMITS = {
  FREE: {
    maxAlerts: 5, // ✅ 5 alerts, not 3!
    maxWatchlists: 1, // ✅ 1 watchlist
    maxWatchlistItems: 5, // ✅ 5 items per watchlist
    rateLimit: 60, // ✅ 60 per HOUR
    symbols: FREE_SYMBOLS,
    timeframes: FREE_TIMEFRAMES,
    chartCombinations: 15, // ✅ 5 × 3
    indicators: ['fractals', 'trendlines'], // ✅ Basic indicators only
  },
  PRO: {
    maxAlerts: 20, // ✅ 20 alerts
    maxWatchlists: 5, // ✅ 5 watchlists
    maxWatchlistItems: 50, // ✅ 50 items per watchlist
    rateLimit: 300, // ✅ 300 per HOUR
    symbols: PRO_SYMBOLS,
    timeframes: PRO_TIMEFRAMES,
    chartCombinations: 135, // ✅ 15 × 9
    indicators: [
      // ✅ All 8 indicators
      'fractals',
      'trendlines',
      'momentum_candles',
      'keltner_channels',
      'tema',
      'hrma',
      'smma',
      'zigzag',
    ],
  },
} as const;

/**
 * Get tier limits
 */
export function getTierLimits(tier: Tier) {
  return TIER_LIMITS[tier];
}

/**
 * Check if tier can access symbol
 */
export function canAccessSymbol(symbol: string, tier: Tier): boolean {
  const limits = getTierLimits(tier);
  return limits.symbols.includes(symbol.toUpperCase());
}

/**
 * Check if tier can access timeframe
 */
export function canAccessTimeframe(timeframe: string, tier: Tier): boolean {
  const limits = getTierLimits(tier);
  return limits.timeframes.includes(timeframe.toUpperCase() as any);
}

/**
 * ✅ Check if tier can create more alerts (5 for FREE, 20 for PRO)
 */
export function canCreateAlert(currentCount: number, tier: Tier): boolean {
  const limits = getTierLimits(tier);
  return currentCount < limits.maxAlerts;
}

/**
 * ✅ NEW: Check if tier can create more watchlists
 */
export function canCreateWatchlist(currentCount: number, tier: Tier): boolean {
  const limits = getTierLimits(tier);
  return currentCount < limits.maxWatchlists;
}

/**
 * ✅ NEW: Check if watchlist can accept more items
 */
export function canAddWatchlistItem(currentItems: number, tier: Tier): boolean {
  const limits = getTierLimits(tier);
  return currentItems < limits.maxWatchlistItems;
}

/**
 * ✅ NEW: Check if tier can access indicator
 */
export function canAccessIndicator(indicator: string, tier: Tier): boolean {
  const limits = getTierLimits(tier);
  return limits.indicators.includes(indicator.toLowerCase());
}

/**
 * ✅ Get accessible indicators for tier
 */
export function getAccessibleIndicators(tier: Tier): string[] {
  const limits = getTierLimits(tier);
  return [...limits.indicators];
}

/**
 * ✅ Get locked (PRO-only) indicators for FREE tier
 */
export function getLockedIndicators(tier: Tier): string[] {
  if (tier === 'PRO') return [];

  const proIndicators = TIER_LIMITS.PRO.indicators;
  const freeIndicators = TIER_LIMITS.FREE.indicators;

  return proIndicators.filter((ind) => !freeIndicators.includes(ind));
}

/**
 * Validate full tier access
 */
export function validateTierAccess(params: {
  tier: Tier;
  symbol?: string;
  timeframe?: string;
  alertCount?: number;
  watchlistCount?: number;
  watchlistItemCount?: number;
  indicator?: string;
}): string | null {
  const {
    tier,
    symbol,
    timeframe,
    alertCount,
    watchlistCount,
    watchlistItemCount,
    indicator,
  } = params;

  if (symbol && !canAccessSymbol(symbol, tier)) {
    const tierName = tier === 'FREE' ? 'Free' : 'Pro';
    return `Your ${tierName} tier does not have access to ${symbol}. Upgrade to access all 15 symbols.`;
  }

  if (timeframe && !canAccessTimeframe(timeframe, tier)) {
    const tierName = tier === 'FREE' ? 'Free' : 'Pro';
    return `Your ${tierName} tier does not have access to ${timeframe} timeframe. Upgrade to access all 9 timeframes.`;
  }

  if (alertCount !== undefined && !canCreateAlert(alertCount, tier)) {
    const limits = getTierLimits(tier);
    return `You have reached your alert limit (${limits.maxAlerts}). Upgrade to create more alerts.`;
  }

  if (
    watchlistCount !== undefined &&
    !canCreateWatchlist(watchlistCount, tier)
  ) {
    const limits = getTierLimits(tier);
    return `You have reached your watchlist limit (${limits.maxWatchlists}). Upgrade to create more watchlists.`;
  }

  if (
    watchlistItemCount !== undefined &&
    !canAddWatchlistItem(watchlistItemCount, tier)
  ) {
    const limits = getTierLimits(tier);
    return `You have reached your watchlist item limit (${limits.maxWatchlistItems}). Upgrade for more space.`;
  }

  if (indicator && !canAccessIndicator(indicator, tier)) {
    return `Your Free tier does not have access to ${indicator}. Upgrade to Pro for all 8 indicators.`;
  }

  return null; // Access allowed
}

/**
 * ✅ Get rate limit for tier (per HOUR, not per minute!)
 */
export function getRateLimitForTier(tier: Tier): number {
  const limits = getTierLimits(tier);
  return limits.rateLimit; // 60/hour for FREE, 300/hour for PRO
}

/**
 * ✅ Get chart combinations for tier
 */
export function getChartCombinations(tier: Tier): number {
  const limits = getTierLimits(tier);
  return limits.chartCombinations; // 15 for FREE, 135 for PRO
}
```

---

## 🎯 Unit Tests with CORRECT Values

```typescript
// Create __tests__/lib/tier-validation.test.ts

describe('Tier Validation', () => {
  describe('Symbol Access', () => {
    it('FREE tier can access 5 symbols', () => {
      expect(canAccessSymbol('BTCUSD', 'FREE')).toBe(true);
      expect(canAccessSymbol('EURUSD', 'FREE')).toBe(true);
      expect(canAccessSymbol('USDJPY', 'FREE')).toBe(true);
      expect(canAccessSymbol('US30', 'FREE')).toBe(true);
      expect(canAccessSymbol('XAUUSD', 'FREE')).toBe(true);
    });

    it('FREE tier cannot access PRO-exclusive symbols', () => {
      expect(canAccessSymbol('ETHUSD', 'FREE')).toBe(false);
      expect(canAccessSymbol('NDX100', 'FREE')).toBe(false);
      expect(canAccessSymbol('XAGUSD', 'FREE')).toBe(false);
    });

    it('PRO tier can access all 15 symbols', () => {
      expect(canAccessSymbol('BTCUSD', 'PRO')).toBe(true);
      expect(canAccessSymbol('ETHUSD', 'PRO')).toBe(true);
      expect(canAccessSymbol('XAGUSD', 'PRO')).toBe(true);
    });
  });

  describe('Timeframe Access', () => {
    it('FREE tier can access 3 timeframes', () => {
      expect(canAccessTimeframe('H1', 'FREE')).toBe(true);
      expect(canAccessTimeframe('H4', 'FREE')).toBe(true);
      expect(canAccessTimeframe('D1', 'FREE')).toBe(true);
    });

    it('FREE tier cannot access PRO-exclusive timeframes', () => {
      expect(canAccessTimeframe('M5', 'FREE')).toBe(false);
      expect(canAccessTimeframe('H2', 'FREE')).toBe(false);
      expect(canAccessTimeframe('H12', 'FREE')).toBe(false);
    });

    it('NO M1 or W1 in the system', () => {
      expect(canAccessTimeframe('M1', 'FREE')).toBe(false);
      expect(canAccessTimeframe('M1', 'PRO')).toBe(false);
      expect(canAccessTimeframe('W1', 'FREE')).toBe(false);
      expect(canAccessTimeframe('W1', 'PRO')).toBe(false);
    });

    it('PRO tier can access all 9 timeframes', () => {
      expect(canAccessTimeframe('M5', 'PRO')).toBe(true);
      expect(canAccessTimeframe('H2', 'PRO')).toBe(true);
      expect(canAccessTimeframe('H12', 'PRO')).toBe(true);
    });
  });

  describe('Alert Limits', () => {
    it('FREE tier can create up to 5 alerts', () => {
      expect(canCreateAlert(0, 'FREE')).toBe(true);
      expect(canCreateAlert(4, 'FREE')).toBe(true);
      expect(canCreateAlert(5, 'FREE')).toBe(false);
    });

    it('PRO tier can create up to 20 alerts', () => {
      expect(canCreateAlert(19, 'PRO')).toBe(true);
      expect(canCreateAlert(20, 'PRO')).toBe(false);
    });
  });

  describe('Watchlist Limits', () => {
    it('FREE tier can have 1 watchlist with 5 items', () => {
      expect(canCreateWatchlist(0, 'FREE')).toBe(true);
      expect(canCreateWatchlist(1, 'FREE')).toBe(false);
      expect(canAddWatchlistItem(4, 'FREE')).toBe(true);
      expect(canAddWatchlistItem(5, 'FREE')).toBe(false);
    });

    it('PRO tier can have 5 watchlists with 50 items each', () => {
      expect(canCreateWatchlist(4, 'PRO')).toBe(true);
      expect(canCreateWatchlist(5, 'PRO')).toBe(false);
      expect(canAddWatchlistItem(49, 'PRO')).toBe(true);
      expect(canAddWatchlistItem(50, 'PRO')).toBe(false);
    });
  });

  describe('Indicator Access', () => {
    it('FREE tier can access 2 basic indicators', () => {
      expect(canAccessIndicator('fractals', 'FREE')).toBe(true);
      expect(canAccessIndicator('trendlines', 'FREE')).toBe(true);
    });

    it('FREE tier cannot access 6 PRO-only indicators', () => {
      expect(canAccessIndicator('momentum_candles', 'FREE')).toBe(false);
      expect(canAccessIndicator('keltner_channels', 'FREE')).toBe(false);
      expect(canAccessIndicator('tema', 'FREE')).toBe(false);
      expect(canAccessIndicator('hrma', 'FREE')).toBe(false);
      expect(canAccessIndicator('smma', 'FREE')).toBe(false);
      expect(canAccessIndicator('zigzag', 'FREE')).toBe(false);
    });

    it('PRO tier can access all 8 indicators', () => {
      const indicators = [
        'fractals',
        'trendlines',
        'momentum_candles',
        'keltner_channels',
        'tema',
        'hrma',
        'smma',
        'zigzag',
      ];
      indicators.forEach((ind) => {
        expect(canAccessIndicator(ind, 'PRO')).toBe(true);
      });
    });
  });

  describe('Rate Limits', () => {
    it('returns correct rate limits per HOUR', () => {
      expect(getRateLimitForTier('FREE')).toBe(60); // 60/hour
      expect(getRateLimitForTier('PRO')).toBe(300); // 300/hour
    });
  });

  describe('Chart Combinations', () => {
    it('FREE tier has 15 combinations (5 × 3)', () => {
      expect(getChartCombinations('FREE')).toBe(15);
    });

    it('PRO tier has 135 combinations (15 × 9)', () => {
      expect(getChartCombinations('PRO')).toBe(135);
    });
  });
});
```

---

## ✅ Phase 2 Completion Checklist

### Infrastructure ✅

- [ ] Rate limiting: 60/hour FREE, 300/hour PRO (not per minute!)
- [ ] CSRF protection active
- [ ] Middleware configured

### Validation ✅

- [ ] Symbol validation: 5 FREE, 15 total
- [ ] Timeframe validation: 3 FREE (H1/H4/D1), 9 PRO (NO M1/W1!)
- [ ] Alert limits: 5 FREE, 20 PRO
- [ ] Watchlist validation: 1 watchlist/5 items FREE, 5 watchlists/50 items PRO
- [ ] Indicator validation: 2 basic FREE, 8 total PRO

### Quality ✅

- [ ] All tests passing
- [ ] Correct tier limits tested
- [ ] Chart combinations: 15 FREE, 135 PRO

---
