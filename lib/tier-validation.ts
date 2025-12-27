/**
 * Trading Alerts SaaS - Tier Validation
 * Validates user access based on subscription tier
 * Enhanced with watchlist, indicator, and comprehensive tier limits
 */

import {
  FREE_SYMBOLS,
  FREE_TIMEFRAMES,
  PRO_SYMBOLS,
  PRO_TIMEFRAMES,
  type Tier,
} from './tier-config';

export type { Tier };

// =============================================
// Tier Limits Configuration
// =============================================

/**
 * Comprehensive tier limits based on tier specifications
 * FREE: 5 alerts, 1 watchlist/5 items, 60 req/hour, basic indicators
 * PRO: 20 alerts, 5 watchlists/50 items, 300 req/hour, all indicators
 */
export const TIER_LIMITS = {
  FREE: {
    maxAlerts: 5,
    maxWatchlists: 1,
    maxWatchlistItems: 5,
    rateLimit: 60, // requests per HOUR
    symbols: FREE_SYMBOLS,
    timeframes: FREE_TIMEFRAMES,
    chartCombinations: 15, // 5 × 3
    indicators: ['fractals', 'trendlines'] as const,
  },
  PRO: {
    maxAlerts: 20,
    maxWatchlists: 5,
    maxWatchlistItems: 50,
    rateLimit: 300, // requests per HOUR
    symbols: PRO_SYMBOLS,
    timeframes: PRO_TIMEFRAMES,
    chartCombinations: 135, // 15 × 9
    indicators: [
      'fractals',
      'trendlines',
      'momentum_candles',
      'keltner_channels',
      'tema',
      'hrma',
      'smma',
      'zigzag',
    ] as const,
  },
} as const;

// =============================================
// Type Definitions
// =============================================

export interface TierConfig {
  maxSymbols: number;
  allowedSymbols: string[];
  allowedTimeframes: string[];
  maxAlerts: number;
  maxWatchlistItems: number;
  rateLimit: number;
}

export interface ValidationResult {
  allowed: boolean;
  reason?: string;
}

// Legacy config for backward compatibility
const TIER_CONFIGS: Record<Tier, TierConfig> = {
  FREE: {
    maxSymbols: 5,
    allowedSymbols: [...FREE_SYMBOLS],
    allowedTimeframes: [...FREE_TIMEFRAMES],
    maxAlerts: 5,
    maxWatchlistItems: 5,
    rateLimit: 60,
  },
  PRO: {
    maxSymbols: 15,
    allowedSymbols: ['*'], // All symbols
    allowedTimeframes: ['*'], // All timeframes
    maxAlerts: 20,
    maxWatchlistItems: 50,
    rateLimit: 300,
  },
};

// =============================================
// Core Tier Functions
// =============================================

/**
 * Get tier limits
 */
export function getTierLimits(tier: Tier) {
  return TIER_LIMITS[tier];
}

/**
 * Get tier configuration (legacy)
 */
export function getTierConfig(tier: Tier): TierConfig {
  return TIER_CONFIGS[tier];
}

// =============================================
// Symbol Access Functions
// =============================================

/**
 * Check if tier can access symbol
 */
export function canAccessSymbol(tier: Tier, symbol: string): boolean {
  const limits = getTierLimits(tier);
  return (limits.symbols as readonly string[]).includes(symbol.toUpperCase());
}

/**
 * Validate if a tier can access a specific symbol
 */
export function validateTierAccess(
  tier: Tier,
  symbol: string
): ValidationResult {
  if (!TIER_CONFIGS[tier]) {
    throw new Error(`Invalid tier: ${tier}`);
  }

  const config = TIER_CONFIGS[tier];

  // Check if symbol is allowed
  if (config.allowedSymbols[0] === '*') {
    return { allowed: true };
  }

  if (config.allowedSymbols.includes(symbol)) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: `Symbol ${symbol} requires PRO tier. Please upgrade to access all ${config.allowedSymbols.length + 10} symbols.`,
  };
}

/**
 * Get symbol limit for tier
 */
export function getSymbolLimit(tier: Tier): number {
  return TIER_CONFIGS[tier].maxSymbols;
}

// =============================================
// Timeframe Access Functions
// =============================================

/**
 * Check if tier can access timeframe
 */
export function canAccessTimeframe(timeframe: string, tier: Tier): boolean {
  const limits = getTierLimits(tier);
  return (limits.timeframes as readonly string[]).includes(
    timeframe.toUpperCase()
  );
}

/**
 * Validate timeframe access
 */
export function validateTimeframeAccess(
  tier: Tier,
  timeframe: string
): ValidationResult {
  const config = TIER_CONFIGS[tier];

  if (config.allowedTimeframes[0] === '*') {
    return { allowed: true };
  }

  if (config.allowedTimeframes.includes(timeframe)) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: `Timeframe ${timeframe} requires PRO tier. Please upgrade to access all 9 timeframes.`,
  };
}

// =============================================
// Alert Functions
// =============================================

/**
 * Get alert limit for tier
 */
export function getAlertLimit(tier: Tier): number {
  return TIER_LIMITS[tier].maxAlerts;
}

/**
 * Check if tier can create more alerts
 * FREE: 5 alerts, PRO: 20 alerts
 */
export function canCreateAlert(
  tier: Tier,
  currentAlerts: number
): ValidationResult {
  const limit = getAlertLimit(tier);

  if (currentAlerts < limit) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: `Alert limit reached (${limit}). Upgrade to PRO for ${TIER_LIMITS.PRO.maxAlerts} alerts.`,
  };
}

// =============================================
// Watchlist Functions
// =============================================

/**
 * Get watchlist limit for tier
 */
export function getWatchlistLimit(tier: Tier): number {
  return TIER_LIMITS[tier].maxWatchlistItems;
}

/**
 * Get max watchlists for tier
 * FREE: 1 watchlist, PRO: 5 watchlists
 */
export function getMaxWatchlists(tier: Tier): number {
  return TIER_LIMITS[tier].maxWatchlists;
}

/**
 * Check if tier can create more watchlists
 * FREE: 1 watchlist, PRO: 5 watchlists
 */
export function canCreateWatchlist(
  currentCount: number,
  tier: Tier
): boolean {
  const limits = getTierLimits(tier);
  return currentCount < limits.maxWatchlists;
}

/**
 * Check if watchlist can accept more items
 * FREE: 5 items, PRO: 50 items
 */
export function canAddWatchlistItem(
  tier: Tier,
  currentItems: number
): ValidationResult {
  const limit = getWatchlistLimit(tier);

  if (currentItems < limit) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: `Watchlist limit reached (${limit}). Upgrade to PRO for ${TIER_LIMITS.PRO.maxWatchlistItems} items.`,
  };
}

// =============================================
// Indicator Functions
// =============================================

/**
 * Check if tier can access indicator
 * FREE: fractals, trendlines (2 basic)
 * PRO: all 8 indicators
 */
export function canAccessIndicator(indicator: string, tier: Tier): boolean {
  const limits = getTierLimits(tier);
  return (limits.indicators as readonly string[]).includes(
    indicator.toLowerCase()
  );
}

/**
 * Get accessible indicators for tier
 */
export function getAccessibleIndicators(tier: Tier): string[] {
  const limits = getTierLimits(tier);
  return [...limits.indicators];
}

/**
 * Get locked (PRO-only) indicators for FREE tier
 */
export function getLockedIndicators(tier: Tier): string[] {
  if (tier === 'PRO') return [];

  const proIndicators = TIER_LIMITS.PRO.indicators;
  const freeIndicators = TIER_LIMITS.FREE.indicators;

  return proIndicators.filter(
    (ind) => !(freeIndicators as readonly string[]).includes(ind)
  );
}

// =============================================
// Rate Limit Functions
// =============================================

/**
 * Get rate limit for tier (per HOUR)
 * FREE: 60/hour, PRO: 300/hour
 */
export function getRateLimit(tier: Tier): number {
  return TIER_LIMITS[tier].rateLimit;
}

/**
 * Alias for getRateLimit
 */
export function getRateLimitForTier(tier: Tier): number {
  return getRateLimit(tier);
}

// =============================================
// Chart Combination Functions
// =============================================

/**
 * Get chart combinations for tier
 * FREE: 15 (5 × 3), PRO: 135 (15 × 9)
 */
export function getChartCombinations(tier: Tier): number {
  return TIER_LIMITS[tier].chartCombinations;
}

/**
 * Get all combinations count for a tier (legacy)
 */
export function getCombinationCount(tier: Tier): number {
  const symbols = getAvailableSymbols(tier);
  const timeframes = getAvailableTimeframes(tier);

  if (symbols.includes('*') || timeframes.includes('*')) {
    return -1; // Unlimited (PRO with wildcard)
  }

  return symbols.length * timeframes.length;
}

// =============================================
// Chart Access Validation
// =============================================

/**
 * Validate chart access (symbol + timeframe combination)
 */
export function validateChartAccess(
  tier: Tier,
  symbol: string,
  timeframe: string
): ValidationResult {
  const symbolResult = validateTierAccess(tier, symbol);
  if (!symbolResult.allowed) {
    return symbolResult;
  }

  const timeframeResult = validateTimeframeAccess(tier, timeframe);
  if (!timeframeResult.allowed) {
    return timeframeResult;
  }

  return { allowed: true };
}

// =============================================
// Comprehensive Validation
// =============================================

/**
 * Validate full tier access with all parameters
 */
export function validateFullTierAccess(params: {
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

  if (symbol && !canAccessSymbol(tier, symbol)) {
    const tierName = tier === 'FREE' ? 'Free' : 'Pro';
    return `Your ${tierName} tier does not have access to ${symbol}. Upgrade to access all 15 symbols.`;
  }

  if (timeframe && !canAccessTimeframe(timeframe, tier)) {
    const tierName = tier === 'FREE' ? 'Free' : 'Pro';
    return `Your ${tierName} tier does not have access to ${timeframe} timeframe. Upgrade to access all 9 timeframes.`;
  }

  if (alertCount !== undefined) {
    const result = canCreateAlert(tier, alertCount);
    if (!result.allowed) {
      const limits = getTierLimits(tier);
      return `You have reached your alert limit (${limits.maxAlerts}). Upgrade to create more alerts.`;
    }
  }

  if (watchlistCount !== undefined && !canCreateWatchlist(watchlistCount, tier)) {
    const limits = getTierLimits(tier);
    return `You have reached your watchlist limit (${limits.maxWatchlists}). Upgrade to create more watchlists.`;
  }

  if (watchlistItemCount !== undefined) {
    const result = canAddWatchlistItem(tier, watchlistItemCount);
    if (!result.allowed) {
      const limits = getTierLimits(tier);
      return `You have reached your watchlist item limit (${limits.maxWatchlistItems}). Upgrade for more space.`;
    }
  }

  if (indicator && !canAccessIndicator(indicator, tier)) {
    return `Your Free tier does not have access to ${indicator}. Upgrade to Pro for all 8 indicators.`;
  }

  return null; // Access allowed
}

// =============================================
// Utility Functions
// =============================================

/**
 * Get available symbols for a tier
 */
export function getAvailableSymbols(tier: Tier): string[] {
  return TIER_CONFIGS[tier]?.allowedSymbols ?? [];
}

/**
 * Get available timeframes for a tier
 */
export function getAvailableTimeframes(tier: Tier): string[] {
  return TIER_CONFIGS[tier]?.allowedTimeframes ?? [];
}

/**
 * Get all combinations for a tier
 */
export function getAllCombinations(
  tier: Tier
): Array<{ symbol: string; timeframe: string }> {
  const symbols = getAvailableSymbols(tier);
  const timeframes = getAvailableTimeframes(tier);

  // If wildcard, return empty (would be too many combinations)
  if (symbols.includes('*') || timeframes.includes('*')) {
    return [];
  }

  const combinations: Array<{ symbol: string; timeframe: string }> = [];

  for (const symbol of symbols) {
    for (const timeframe of timeframes) {
      combinations.push({ symbol, timeframe });
    }
  }

  return combinations;
}
