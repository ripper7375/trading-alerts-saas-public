/**
 * Trading Alerts SaaS - Tier Validation
 * Validates user access based on subscription tier
 */

import type { Tier } from './tier-config';
import { getRedisClient } from './redis/client';

export type { Tier };

export interface TierConfig {
  maxSymbols: number;
  allowedSymbols: string[];
  allowedTimeframes: string[];
  maxAlerts: number;
  maxWatchlistItems: number;
  rateLimit: number; // requests per hour
}

const TIER_CONFIGS: Record<Tier, TierConfig> = {
  FREE: {
    maxSymbols: 5,
    allowedSymbols: ['BTCUSD', 'EURUSD', 'USDJPY', 'US30', 'XAUUSD'],
    allowedTimeframes: ['H1', 'H4', 'D1'],
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

export interface ValidationResult {
  allowed: boolean;
  reason?: string;
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
 * Check if user can access symbol
 */
export function canAccessSymbol(tier: Tier, symbol: string): boolean {
  const result = validateTierAccess(tier, symbol);
  return result.allowed;
}

/**
 * Get symbol limit for tier
 */
export function getSymbolLimit(tier: Tier): number {
  return TIER_CONFIGS[tier].maxSymbols;
}

/**
 * Get alert limit for tier
 */
export function getAlertLimit(tier: Tier): number {
  return TIER_CONFIGS[tier].maxAlerts;
}

/**
 * Get watchlist limit for tier
 */
export function getWatchlistLimit(tier: Tier): number {
  return TIER_CONFIGS[tier].maxWatchlistItems;
}

/**
 * Get rate limit for tier
 */
export function getRateLimit(tier: Tier): number {
  return TIER_CONFIGS[tier].rateLimit;
}

/**
 * Check if user can create more alerts
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
    reason: `Alert limit reached (${limit}). Upgrade to PRO for ${TIER_CONFIGS.PRO.maxAlerts} alerts.`,
  };
}

/**
 * Check if user can create more watchlist items
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
    reason: `Watchlist limit reached (${limit}). Upgrade to PRO for ${TIER_CONFIGS.PRO.maxWatchlistItems} items.`,
  };
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

/**
 * Get all combinations count for a tier
 */
export function getCombinationCount(tier: Tier): number {
  const symbols = getAvailableSymbols(tier);
  const timeframes = getAvailableTimeframes(tier);

  if (symbols.includes('*') || timeframes.includes('*')) {
    return -1; // Unlimited
  }

  return symbols.length * timeframes.length;
}

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

// Rate limit key prefix for Redis
const RATE_LIMIT_KEY_PREFIX = 'rate_limit:';
// Rate limit window in seconds (1 hour = 3600 seconds)
const RATE_LIMIT_WINDOW_SECONDS = 3600;

/**
 * Get rate limit for a tier (alias for getRateLimit for clarity)
 */
export function getRateLimitForTier(tier: Tier): number {
  return getRateLimit(tier);
}

/**
 * Get the Redis key for a user's rate limit
 */
function getRateLimitKey(userId: string): string {
  return `${RATE_LIMIT_KEY_PREFIX}${userId}`;
}

/**
 * Check if a user has exceeded their rate limit
 * Uses Redis to track request counts per hour
 *
 * @param userId - The user's ID
 * @param tier - The user's subscription tier
 * @returns true if rate limit is exceeded, false otherwise
 */
export async function isRateLimitExceeded(
  userId: string,
  tier: Tier
): Promise<boolean> {
  try {
    const redis = getRedisClient();
    const key = getRateLimitKey(userId);
    const limit = getRateLimitForTier(tier);

    // Get current count
    const currentCount = await redis.get(key);

    if (!currentCount) {
      return false; // No requests yet, not exceeded
    }

    return parseInt(currentCount, 10) >= limit;
  } catch (error) {
    // If Redis is unavailable, don't block the request
    console.error('Rate limit check failed:', error);
    return false;
  }
}

/**
 * Increment the rate limit counter for a user
 * Returns the new count and whether the limit is exceeded
 *
 * @param userId - The user's ID
 * @param tier - The user's subscription tier
 * @returns Object with current count, limit, exceeded status, and remaining
 */
export async function incrementRateLimit(
  userId: string,
  tier: Tier
): Promise<{
  count: number;
  limit: number;
  exceeded: boolean;
  remaining: number;
  resetInSeconds: number;
}> {
  try {
    const redis = getRedisClient();
    const key = getRateLimitKey(userId);
    const limit = getRateLimitForTier(tier);

    // Increment counter
    const count = await redis.incr(key);

    // Set expiry on first request (TTL of 1 hour)
    if (count === 1) {
      await redis.expire(key, RATE_LIMIT_WINDOW_SECONDS);
    }

    // Get TTL for reset time
    const ttl = await redis.ttl(key);
    const resetInSeconds = ttl > 0 ? ttl : RATE_LIMIT_WINDOW_SECONDS;

    return {
      count,
      limit,
      exceeded: count > limit,
      remaining: Math.max(0, limit - count),
      resetInSeconds,
    };
  } catch (error) {
    // If Redis is unavailable, return safe defaults
    console.error('Rate limit increment failed:', error);
    const limit = getRateLimitForTier(tier);
    return {
      count: 0,
      limit,
      exceeded: false,
      remaining: limit,
      resetInSeconds: RATE_LIMIT_WINDOW_SECONDS,
    };
  }
}

/**
 * Get current rate limit status for a user
 *
 * @param userId - The user's ID
 * @param tier - The user's subscription tier
 * @returns Current rate limit status
 */
export async function getRateLimitStatus(
  userId: string,
  tier: Tier
): Promise<{
  count: number;
  limit: number;
  remaining: number;
  resetInSeconds: number;
}> {
  try {
    const redis = getRedisClient();
    const key = getRateLimitKey(userId);
    const limit = getRateLimitForTier(tier);

    const [countStr, ttl] = await Promise.all([redis.get(key), redis.ttl(key)]);

    const count = countStr ? parseInt(countStr, 10) : 0;
    const resetInSeconds = ttl > 0 ? ttl : RATE_LIMIT_WINDOW_SECONDS;

    return {
      count,
      limit,
      remaining: Math.max(0, limit - count),
      resetInSeconds,
    };
  } catch (error) {
    console.error('Rate limit status check failed:', error);
    const limit = getRateLimitForTier(tier);
    return {
      count: 0,
      limit,
      remaining: limit,
      resetInSeconds: RATE_LIMIT_WINDOW_SECONDS,
    };
  }
}

/**
 * Reset rate limit for a user (admin function)
 *
 * @param userId - The user's ID
 */
export async function resetRateLimit(userId: string): Promise<void> {
  try {
    const redis = getRedisClient();
    const key = getRateLimitKey(userId);
    await redis.del(key);
  } catch (error) {
    console.error('Rate limit reset failed:', error);
  }
}
