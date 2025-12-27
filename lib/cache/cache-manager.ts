/**
 * Cache Manager
 *
 * High-level caching utilities built on Redis.
 * Provides get, set, delete operations with TTL support.
 * Includes specialized functions for caching prices and other data.
 */

import { getRedisClient } from '@/lib/redis/client';

/**
 * Default TTL values (in seconds)
 */
export const CACHE_TTL = {
  SHORT: 60, // 1 minute
  MEDIUM: 300, // 5 minutes
  LONG: 3600, // 1 hour
  DAY: 86400, // 24 hours
  PRICE: 60, // 1 minute for price data
  INDICATORS: 300, // 5 minutes for indicator data
  USER_SESSION: 3600, // 1 hour for user session data
} as const;

/**
 * Timeframe-specific TTL values (in seconds)
 * TTL equals the timeframe duration for optimal cache freshness
 * NO M1 or W1 in the system!
 */
export const TIMEFRAME_CACHE_TTL = {
  M5: 300, // 5 minutes
  M15: 900, // 15 minutes
  M30: 1800, // 30 minutes
  H1: 3600, // 1 hour
  H2: 7200, // 2 hours
  H4: 14400, // 4 hours
  H8: 28800, // 8 hours
  H12: 43200, // 12 hours
  D1: 86400, // 1 day
} as const;

export type ValidTimeframe = keyof typeof TIMEFRAME_CACHE_TTL;

/**
 * Cache key prefixes for organization
 */
export const CACHE_PREFIX = {
  PRICE: 'price',
  INDICATORS: 'indicators',
  USER: 'user',
  SESSION: 'session',
  RATE_LIMIT: 'ratelimit',
  ALERT: 'alert',
} as const;

/**
 * Get a value from cache
 *
 * @param key - Cache key
 * @returns Cached value or null if not found
 */
export async function getCache<T>(key: string): Promise<T | null> {
  try {
    const redis = getRedisClient();
    const value = await redis.get(key);

    if (!value) {
      return null;
    }

    return JSON.parse(value) as T;
  } catch (error) {
    console.error('Cache get error:', error);
    return null;
  }
}

/**
 * Set a value in cache
 *
 * @param key - Cache key
 * @param value - Value to cache (will be JSON serialized)
 * @param ttl - Time to live in seconds (default: 5 minutes)
 */
export async function setCache(
  key: string,
  value: unknown,
  ttl: number = CACHE_TTL.MEDIUM
): Promise<void> {
  try {
    const redis = getRedisClient();
    const serialized = JSON.stringify(value);
    await redis.setex(key, ttl, serialized);
  } catch (error) {
    console.error('Cache set error:', error);
  }
}

/**
 * Delete a value from cache
 *
 * @param key - Cache key to delete
 */
export async function deleteCache(key: string): Promise<void> {
  try {
    const redis = getRedisClient();
    await redis.del(key);
  } catch (error) {
    console.error('Cache delete error:', error);
  }
}

/**
 * Delete multiple keys matching a pattern
 *
 * @param pattern - Pattern to match (e.g., 'price:*')
 */
export async function deleteCachePattern(pattern: string): Promise<void> {
  try {
    const redis = getRedisClient();
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (error) {
    console.error('Cache delete pattern error:', error);
  }
}

/**
 * Check if a key exists in cache
 *
 * @param key - Cache key to check
 * @returns true if key exists, false otherwise
 */
export async function hasCache(key: string): Promise<boolean> {
  try {
    const redis = getRedisClient();
    const exists = await redis.exists(key);
    return exists === 1;
  } catch (error) {
    console.error('Cache exists error:', error);
    return false;
  }
}

/**
 * Get remaining TTL for a key
 *
 * @param key - Cache key
 * @returns TTL in seconds, -1 if no expiry, -2 if key doesn't exist
 */
export async function getCacheTTL(key: string): Promise<number> {
  try {
    const redis = getRedisClient();
    return await redis.ttl(key);
  } catch (error) {
    console.error('Cache TTL error:', error);
    return -2;
  }
}

// ============================================
// Price Caching Functions
// ============================================

/**
 * Generate price cache key
 */
function getPriceKey(symbol: string, timeframe: string): string {
  return `${CACHE_PREFIX.PRICE}:${symbol}:${timeframe}`;
}

/**
 * Cache a price value
 *
 * @param symbol - Trading symbol (e.g., XAUUSD)
 * @param timeframe - Chart timeframe (e.g., H1)
 * @param price - Current price
 */
export async function cachePrice(
  symbol: string,
  timeframe: string,
  price: number
): Promise<void> {
  const key = getPriceKey(symbol, timeframe);
  await setCache(key, { price, timestamp: Date.now() }, CACHE_TTL.PRICE);
}

/**
 * Get cached price
 *
 * @param symbol - Trading symbol
 * @param timeframe - Chart timeframe
 * @returns Cached price or null if not found/expired
 */
export async function getCachedPrice(
  symbol: string,
  timeframe: string
): Promise<number | null> {
  const key = getPriceKey(symbol, timeframe);
  const cached = await getCache<{ price: number; timestamp: number }>(key);
  return cached?.price ?? null;
}

// ============================================
// Indicator Caching Functions
// ============================================

/**
 * Generate indicator cache key
 */
function getIndicatorKey(symbol: string, timeframe: string): string {
  return `${CACHE_PREFIX.INDICATORS}:${symbol}:${timeframe}`;
}

/**
 * Cache indicator data
 *
 * @param symbol - Trading symbol
 * @param timeframe - Chart timeframe
 * @param indicators - Indicator data object
 */
export async function cacheIndicators(
  symbol: string,
  timeframe: string,
  indicators: Record<string, unknown>
): Promise<void> {
  const key = getIndicatorKey(symbol, timeframe);
  await setCache(
    key,
    { indicators, timestamp: Date.now() },
    CACHE_TTL.INDICATORS
  );
}

/**
 * Get cached indicators
 *
 * @param symbol - Trading symbol
 * @param timeframe - Chart timeframe
 * @returns Cached indicators or null if not found/expired
 */
export async function getCachedIndicators(
  symbol: string,
  timeframe: string
): Promise<Record<string, unknown> | null> {
  const key = getIndicatorKey(symbol, timeframe);
  const cached = await getCache<{
    indicators: Record<string, unknown>;
    timestamp: number;
  }>(key);
  return cached?.indicators ?? null;
}

/**
 * Get TTL for a specific timeframe
 * Falls back to H1 (1 hour) if timeframe is not recognized
 *
 * @param timeframe - Chart timeframe (e.g., M5, H1, D1)
 * @returns TTL in seconds
 */
export function getTimeframeTTL(timeframe: string): number {
  const upperTimeframe = timeframe.toUpperCase() as ValidTimeframe;
  return TIMEFRAME_CACHE_TTL[upperTimeframe] ?? TIMEFRAME_CACHE_TTL.H1;
}

/**
 * Cache indicator data with timeframe-specific TTL
 *
 * @param symbol - Trading symbol (e.g., XAUUSD)
 * @param timeframe - Chart timeframe (e.g., H1, D1)
 * @param data - Indicator data to cache
 */
export async function setCachedIndicatorData(
  symbol: string,
  timeframe: string,
  data: unknown
): Promise<void> {
  const key = getIndicatorKey(symbol, timeframe);
  const ttl = getTimeframeTTL(timeframe);

  try {
    await setCache(key, { data, timestamp: Date.now() }, ttl);
    console.log(`Cached: ${symbol}/${timeframe} for ${ttl}s`);
  } catch (error) {
    console.error(`Cache set error for ${symbol}/${timeframe}:`, error);
  }
}

/**
 * Get cached indicator data
 *
 * @param symbol - Trading symbol
 * @param timeframe - Chart timeframe
 * @returns Cached data or null if not found/expired
 */
export async function getCachedIndicatorData<T>(
  symbol: string,
  timeframe: string
): Promise<T | null> {
  const key = getIndicatorKey(symbol, timeframe);

  try {
    const cached = await getCache<{ data: T; timestamp: number }>(key);

    if (cached) {
      console.log(`Cache HIT: ${symbol}/${timeframe}`);
      return cached.data;
    }

    console.log(`Cache MISS: ${symbol}/${timeframe}`);
    return null;
  } catch (error) {
    console.error(`Cache get error for ${symbol}/${timeframe}:`, error);
    return null;
  }
}

/**
 * Invalidate cache for a symbol across all timeframes
 *
 * @param symbol - Trading symbol to invalidate
 */
export async function invalidateSymbolCache(symbol: string): Promise<void> {
  try {
    const timeframes = Object.keys(TIMEFRAME_CACHE_TTL);
    const keys = timeframes.map((tf) => getIndicatorKey(symbol, tf));

    if (keys.length > 0) {
      const redis = getRedisClient();
      await Promise.all(keys.map((key) => redis.del(key)));
      console.log(`Invalidated cache for ${symbol}`);
    }
  } catch (error) {
    console.error(`Cache invalidation error for ${symbol}:`, error);
  }
}

/**
 * Invalidate cache for a specific symbol/timeframe
 *
 * @param symbol - Trading symbol
 * @param timeframe - Chart timeframe
 */
export async function invalidateIndicatorCache(
  symbol: string,
  timeframe: string
): Promise<void> {
  const key = getIndicatorKey(symbol, timeframe);
  await deleteCache(key);
  console.log(`Invalidated cache: ${symbol}/${timeframe}`);
}

// ============================================
// User Session Caching Functions
// ============================================

/**
 * Cache user session data
 *
 * @param userId - User ID
 * @param sessionData - Session data to cache
 */
export async function cacheUserSession(
  userId: string,
  sessionData: Record<string, unknown>
): Promise<void> {
  const key = `${CACHE_PREFIX.USER}:${userId}:session`;
  await setCache(key, sessionData, CACHE_TTL.USER_SESSION);
}

/**
 * Get cached user session
 *
 * @param userId - User ID
 * @returns Cached session data or null
 */
export async function getCachedUserSession(
  userId: string
): Promise<Record<string, unknown> | null> {
  const key = `${CACHE_PREFIX.USER}:${userId}:session`;
  return getCache<Record<string, unknown>>(key);
}

/**
 * Invalidate user session cache
 *
 * @param userId - User ID
 */
export async function invalidateUserSession(userId: string): Promise<void> {
  const pattern = `${CACHE_PREFIX.USER}:${userId}:*`;
  await deleteCachePattern(pattern);
}

// ============================================
// Rate Limiting Functions
// ============================================

/**
 * Increment rate limit counter
 *
 * @param identifier - Rate limit identifier (e.g., userId or IP)
 * @param windowSeconds - Time window in seconds
 * @returns Current count and remaining TTL
 */
export async function incrementRateLimit(
  identifier: string,
  windowSeconds: number = 3600
): Promise<{ count: number; ttl: number }> {
  try {
    const redis = getRedisClient();
    const key = `${CACHE_PREFIX.RATE_LIMIT}:${identifier}`;

    const multi = redis.multi();
    multi.incr(key);
    multi.ttl(key);

    const results = await multi.exec();

    if (!results) {
      return { count: 1, ttl: windowSeconds };
    }

    const count = (results[0]?.[1] as number) ?? 1;
    let ttl = (results[1]?.[1] as number) ?? -1;

    // Set expiry if key is new (ttl = -1 means no expiry set)
    if (ttl === -1) {
      await redis.expire(key, windowSeconds);
      ttl = windowSeconds;
    }

    return { count, ttl };
  } catch (error) {
    console.error('Rate limit increment error:', error);
    return { count: 1, ttl: windowSeconds };
  }
}

/**
 * Get current rate limit count
 *
 * @param identifier - Rate limit identifier
 * @returns Current count or 0 if not found
 */
export async function getRateLimitCount(identifier: string): Promise<number> {
  try {
    const redis = getRedisClient();
    const key = `${CACHE_PREFIX.RATE_LIMIT}:${identifier}`;
    const count = await redis.get(key);
    return count ? parseInt(count, 10) : 0;
  } catch (error) {
    console.error('Rate limit get error:', error);
    return 0;
  }
}
