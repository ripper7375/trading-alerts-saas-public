/**
 * Business Rules and Constants
 *
 * Single source of truth for Trading Alerts SaaS V7
 *
 * Dependencies:
 * - Part 1 (Caching): Uses CACHE_TTL
 * - Part 2 (Rate Limiting): Uses RATE_LIMITS, TIER_CONFIG
 * - Part 3 (Indicator Filtering): Uses INDICATORS, SYMBOLS_BY_TIER
 * - Part 4 (Tests): Validates all constants
 */

// ============================================================================
// TIER SYSTEM
// ============================================================================

export const TIERS = ['FREE', 'PRO'] as const;
export type Tier = (typeof TIERS)[number];

export const TIER_CONFIG = {
  FREE: {
    name: 'Free',
    price: 0,
    symbolCount: 5,
    indicatorCount: 2,
    requestsPerHour: 60,
  },
  PRO: {
    name: 'Pro',
    monthlyPrice: 29,
    yearlyPrice: 290,
    symbolCount: 15,
    indicatorCount: 8,
    requestsPerHour: 300,
    trialDays: 7,
  },
} as const;

// ============================================================================
// SYMBOLS
// ============================================================================

/**
 * FREE tier symbols (5 total)
 * All users have access to these
 */
export const FREE_SYMBOLS = [
  'XAUUSD', // Gold - Primary symbol
  'BTCUSD', // Bitcoin
  'EURUSD', // Euro/USD
  'USDJPY', // USD/Yen
  'US30', // Dow Jones
] as const;

/**
 * PRO tier exclusive symbols (10 additional)
 * Only PRO tier users can access these
 */
export const PRO_SYMBOLS = [
  'AUDJPY', // Aussie/Yen
  'AUDUSD', // Aussie/USD
  'ETHUSD', // Ethereum
  'GBPJPY', // Pound/Yen
  'GBPUSD', // Pound/USD
  'NDX100', // Nasdaq 100
  'NZDUSD', // Kiwi/USD
  'USDCAD', // USD/Canadian
  'USDCHF', // USD/Swiss
  'XAGUSD', // Silver
] as const;

/**
 * All valid symbols (15 total)
 */
export const VALID_SYMBOLS = [...FREE_SYMBOLS, ...PRO_SYMBOLS] as const;

export type Symbol = (typeof VALID_SYMBOLS)[number];
export type FreeSymbol = (typeof FREE_SYMBOLS)[number];
export type ProSymbol = (typeof PRO_SYMBOLS)[number];

/**
 * Get accessible symbols for a tier
 */
export const SYMBOLS_BY_TIER: Record<Tier, readonly string[]> = {
  FREE: FREE_SYMBOLS,
  PRO: VALID_SYMBOLS,
} as const;

// ============================================================================
// TIMEFRAMES
// ============================================================================

/**
 * Valid timeframes (9 total)
 *
 * IMPORTANT: M1 (1 minute) and W1 (1 week) are NOT supported
 */
export const VALID_TIMEFRAMES = [
  'M5', // 5 minutes
  'M15', // 15 minutes
  'M30', // 30 minutes
  'H1', // 1 hour
  'H2', // 2 hours
  'H4', // 4 hours
  'H8', // 8 hours
  'H12', // 12 hours
  'D1', // 1 day
] as const;

export type Timeframe = (typeof VALID_TIMEFRAMES)[number];

/**
 * Timeframe display names
 */
export const TIMEFRAME_LABELS: Record<Timeframe, string> = {
  M5: '5 Minutes',
  M15: '15 Minutes',
  M30: '30 Minutes',
  H1: '1 Hour',
  H2: '2 Hours',
  H4: '4 Hours',
  H8: '8 Hours',
  H12: '12 Hours',
  D1: '1 Day',
} as const;

// ============================================================================
// INDICATORS
// ============================================================================

/**
 * Basic indicators (2 total)
 * Available to FREE tier
 */
export const BASIC_INDICATORS = ['fractals', 'trendlines'] as const;

/**
 * PRO-only indicators (6 additional)
 * Requires PRO tier subscription
 */
export const PRO_INDICATORS = [
  'momentum_candles',
  'keltner_channels',
  'tema',
  'hrma',
  'smma',
  'zigzag',
] as const;

/**
 * All indicators (8 total)
 */
export const ALL_INDICATORS = [...BASIC_INDICATORS, ...PRO_INDICATORS] as const;

export type Indicator = (typeof ALL_INDICATORS)[number];
export type BasicIndicator = (typeof BASIC_INDICATORS)[number];
export type ProIndicator = (typeof PRO_INDICATORS)[number];

/**
 * Indicator display names and descriptions
 */
export const INDICATOR_INFO: Record<
  Indicator,
  { name: string; description: string }
> = {
  fractals: {
    name: 'Fractals',
    description: 'Identifies key support and resistance levels',
  },
  trendlines: {
    name: 'Trendlines',
    description: 'Automatic trendline detection',
  },
  momentum_candles: {
    name: 'Momentum Candles',
    description: 'Candles colored by momentum strength',
  },
  keltner_channels: {
    name: 'Keltner Channels',
    description: 'Volatility-based trading bands',
  },
  tema: {
    name: 'TEMA',
    description: 'Triple Exponential Moving Average',
  },
  hrma: {
    name: 'HRMA',
    description: 'Hull Moving Average for trend detection',
  },
  smma: {
    name: 'SMMA',
    description: 'Smoothed Moving Average',
  },
  zigzag: {
    name: 'ZigZag',
    description: 'Filters out market noise to show trends',
  },
} as const;

/**
 * Get accessible indicators for a tier
 */
export const INDICATORS_BY_TIER: Record<Tier, readonly Indicator[]> = {
  FREE: BASIC_INDICATORS,
  PRO: ALL_INDICATORS,
} as const;

// ============================================================================
// RATE LIMITING
// ============================================================================

/**
 * Rate limit configuration by tier
 * Window is always 1 hour (3600 seconds)
 */
export const RATE_LIMITS = {
  FREE: {
    requests: 60,
    window: 3600, // 1 hour in seconds
    windowLabel: 'hour',
  },
  PRO: {
    requests: 300,
    window: 3600, // 1 hour in seconds
    windowLabel: 'hour',
  },
} as const;

// ============================================================================
// CACHING
// ============================================================================

/**
 * Cache TTL (Time-to-Live) by timeframe in seconds
 *
 * Short TTL allows real-time price updates while reducing MT5 service load.
 * Auto-refresh intervals: FREE=60s, PRO=30s. Cache TTL should be shorter.
 */
export const CACHE_TTL: Record<Timeframe, number> = {
  M5: 15, // 15 seconds - allows real-time updates
  M15: 15, // 15 seconds
  M30: 15, // 15 seconds
  H1: 15, // 15 seconds
  H2: 15, // 15 seconds
  H4: 15, // 15 seconds
  H8: 15, // 15 seconds
  H12: 15, // 15 seconds
  D1: 15, // 15 seconds
} as const;

/**
 * Default cache TTL for unknown timeframes
 */
export const DEFAULT_CACHE_TTL = 15; // 15 seconds for real-time updates

// ============================================================================
// HTTP STATUS CODES
// ============================================================================

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

// ============================================================================
// ERROR MESSAGES
// ============================================================================

export const ERROR_MESSAGES = {
  // Symbol errors
  INVALID_SYMBOL: 'Invalid symbol',
  SYMBOL_REQUIRES_PRO: 'Symbol requires PRO tier',

  // Timeframe errors
  INVALID_TIMEFRAME: 'Invalid timeframe',
  TIMEFRAME_NOT_SUPPORTED: 'Timeframe not supported',

  // Indicator errors
  INVALID_INDICATOR: 'Invalid indicator',
  INDICATOR_REQUIRES_PRO: 'Indicator requires PRO tier',

  // Rate limiting
  RATE_LIMIT_EXCEEDED: 'Rate limit exceeded',

  // Service errors
  MT5_SERVICE_ERROR: 'MT5 service error',
  INTERNAL_SERVER_ERROR: 'Internal server error',

  // Auth errors
  UNAUTHORIZED: 'Unauthorized',
  FORBIDDEN: 'Forbidden',
} as const;

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Check if a symbol is valid
 */
export function isValidSymbol(symbol: string): symbol is Symbol {
  return ([...VALID_SYMBOLS] as string[]).includes(symbol.toUpperCase());
}

/**
 * Check if a timeframe is valid
 */
export function isValidTimeframe(timeframe: string): timeframe is Timeframe {
  return ([...VALID_TIMEFRAMES] as string[]).includes(timeframe.toUpperCase());
}

/**
 * Check if an indicator is valid
 */
export function isValidIndicator(indicator: string): indicator is Indicator {
  return ([...ALL_INDICATORS] as string[]).includes(indicator.toLowerCase());
}

/**
 * Check if a symbol is accessible for a tier
 */
export function canAccessSymbol(symbol: string, tier: Tier): boolean {
  const upperSymbol = symbol.toUpperCase();
  if (!isValidSymbol(upperSymbol)) return false;

  if (tier === 'PRO') return true;
  return ([...FREE_SYMBOLS] as string[]).includes(upperSymbol);
}

/**
 * Check if an indicator is accessible for a tier
 */
export function canAccessIndicator(indicator: string, tier: Tier): boolean {
  const lowerIndicator = indicator.toLowerCase();
  if (!isValidIndicator(lowerIndicator)) return false;

  if (tier === 'PRO') return true;
  return ([...BASIC_INDICATORS] as string[]).includes(lowerIndicator);
}

/**
 * Get upgrade message for a locked resource
 *
 * Note: Does not include specific price as it's configurable via SystemConfig.
 * For price display, use useAffiliateConfig() hook on frontend
 * or getBasePriceUsd() from lib/affiliate/constants on backend.
 */
export function getUpgradeMessage(
  _resourceType: 'symbol' | 'indicator',
  resourceName: string
): string {
  return `${resourceName} requires PRO tier. Upgrade to PRO with a 7-day free trial.`;
}
