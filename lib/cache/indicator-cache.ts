/**
 * Indicator Data Caching Utility
 *
 * Provides caching layer for MT5 indicator data with intelligent TTL.
 * Uses in-memory cache with automatic cleanup (Redis can be added later).
 *
 * Features:
 * - Automatic TTL based on timeframe from Part 0 constants
 * - Cache key generation for symbol/timeframe/bars combinations
 * - Symbol-level invalidation
 * - Cache statistics tracking
 * - Safe error handling (failures don't break requests)
 *
 * Dependencies:
 * - Part 0: CACHE_TTL, VALID_TIMEFRAMES, isValidTimeframe
 *
 * @module lib/cache/indicator-cache
 */

import {
  CACHE_TTL,
  DEFAULT_CACHE_TTL,
  isValidTimeframe,
  type Timeframe,
} from '@/lib/constants/business-rules';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Cache entry with expiration
 */
interface CacheEntry {
  value: string;
  expiresAt: number;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  hitRate: number;
}

// ============================================================================
// IN-MEMORY CACHE IMPLEMENTATION
// ============================================================================

/**
 * In-memory cache store
 * Uses Map with expiration timestamps
 */
class MemoryCache {
  private cache = new Map<string, CacheEntry>();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  /**
   * Get value from cache
   * Returns null if not found or expired
   */
  async get(key: string): Promise<string | null> {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  /**
   * Set value in cache with TTL
   * @param key Cache key
   * @param ttl Time-to-live in seconds
   * @param value Value to cache (as JSON string)
   */
  async set(key: string, ttl: number, value: string): Promise<void> {
    const expiresAt = Date.now() + ttl * 1000;
    this.cache.set(key, { value, expiresAt });
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  /**
   * Check if key exists and is not expired
   */
  async exists(key: string): Promise<boolean> {
    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Get all keys matching a pattern
   * Simple implementation: returns all keys containing the pattern
   */
  async keys(pattern: string): Promise<string[]> {
    const matchedKeys: string[] = [];
    const searchPattern = pattern.replace(/\*/g, '');

    for (const key of this.cache.keys()) {
      if (key.includes(searchPattern)) {
        matchedKeys.push(key);
      }
    }

    return matchedKeys;
  }

  /**
   * Start periodic cleanup of expired entries
   * Runs every minute by default
   */
  startCleanup(intervalMs = 60000): void {
    if (this.cleanupInterval) {
      return; // Already running
    }

    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      let cleaned = 0;

      for (const [key, entry] of this.cache.entries()) {
        if (now > entry.expiresAt) {
          this.cache.delete(key);
          cleaned++;
        }
      }

      if (cleaned > 0) {
        console.log(`[Cache] Cleanup: removed ${cleaned} expired entries`);
      }
    }, intervalMs);

    console.log('[Cache] Cleanup task started (interval: 60s)');
  }

  /**
   * Stop periodic cleanup
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      console.log('[Cache] Cleanup task stopped');
    }
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }
}

// ============================================================================
// CACHE CLIENT SINGLETON
// ============================================================================

/**
 * Global cache client instance
 * Uses in-memory cache (can be replaced with Redis later)
 */
const cacheClient = new MemoryCache();

// Start cleanup on module load
cacheClient.startCleanup();

// ============================================================================
// CACHE KEY GENERATION
// ============================================================================

/**
 * Generate cache key for indicator data
 *
 * Format: indicator:{SYMBOL}:{TIMEFRAME}:{BARS}
 * Example: indicator:XAUUSD:H1:1000
 *
 * @param symbol Trading symbol (e.g., "XAUUSD")
 * @param timeframe Timeframe (e.g., "H1")
 * @param bars Number of bars (optional)
 * @returns Cache key string
 */
function generateCacheKey(
  symbol: string,
  timeframe: string,
  bars?: number
): string {
  const normalizedSymbol = symbol.toUpperCase();
  const normalizedTimeframe = timeframe.toUpperCase();

  if (bars !== undefined) {
    return `indicator:${normalizedSymbol}:${normalizedTimeframe}:${bars}`;
  }

  return `indicator:${normalizedSymbol}:${normalizedTimeframe}`;
}

/**
 * Generate cache key pattern for symbol invalidation
 *
 * Format: indicator:{SYMBOL}:*
 * Example: indicator:XAUUSD:*
 *
 * @param symbol Trading symbol
 * @returns Cache key pattern
 */
function generateSymbolPattern(symbol: string): string {
  const normalizedSymbol = symbol.toUpperCase();
  return `indicator:${normalizedSymbol}:*`;
}

// ============================================================================
// TTL CALCULATION
// ============================================================================

/**
 * Get TTL for a timeframe
 * Uses CACHE_TTL from Part 0 constants
 *
 * @param timeframe Timeframe string
 * @returns TTL in seconds
 */
function getTTL(timeframe: string): number {
  const normalizedTimeframe = timeframe.toUpperCase();

  if (isValidTimeframe(normalizedTimeframe)) {
    const ttl = CACHE_TTL[normalizedTimeframe as Timeframe];
    return ttl;
  }

  console.warn(
    `[Cache] Unknown timeframe: ${timeframe}, using default TTL (${DEFAULT_CACHE_TTL}s)`
  );
  return DEFAULT_CACHE_TTL;
}

/**
 * Format TTL for logging
 * Converts seconds to human-readable format
 *
 * @param ttlSeconds TTL in seconds
 * @returns Human-readable string (e.g., "5min", "4hr", "1day")
 */
function formatTTL(ttlSeconds: number): string {
  if (ttlSeconds < 60) {
    return `${ttlSeconds}s`;
  }
  if (ttlSeconds < 3600) {
    return `${Math.round(ttlSeconds / 60)}min`;
  }
  if (ttlSeconds < 86400) {
    return `${Math.round(ttlSeconds / 3600)}hr`;
  }
  return `${Math.round(ttlSeconds / 86400)}day`;
}

// ============================================================================
// CACHE STATISTICS
// ============================================================================

/**
 * Cache statistics counters
 */
let statsCounters = {
  hits: 0,
  misses: 0,
  sets: 0,
  deletes: 0,
};

/**
 * Record a cache hit
 */
function recordHit(): void {
  statsCounters.hits++;
}

/**
 * Record a cache miss
 */
function recordMiss(): void {
  statsCounters.misses++;
}

/**
 * Record a cache set
 */
function recordSet(): void {
  statsCounters.sets++;
}

/**
 * Record a cache delete
 */
function recordDelete(): void {
  statsCounters.deletes++;
}

/**
 * Get cache statistics
 *
 * @returns Cache statistics object
 */
export function getCacheStats(): CacheStats {
  const total = statsCounters.hits + statsCounters.misses;
  const hitRate = total > 0 ? statsCounters.hits / total : 0;

  return {
    hits: statsCounters.hits,
    misses: statsCounters.misses,
    sets: statsCounters.sets,
    deletes: statsCounters.deletes,
    hitRate,
  };
}

/**
 * Reset cache statistics
 * Useful for testing or periodic resets
 */
export function resetCacheStats(): void {
  statsCounters = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
  };
  console.log('[Cache] Statistics reset');
}

// ============================================================================
// PUBLIC CACHE OPERATIONS
// ============================================================================

/**
 * Get cached indicator data
 *
 * Returns parsed JSON data if cache hit, null if cache miss
 * Automatically tracks hit/miss statistics
 *
 * @param symbol Trading symbol (e.g., "XAUUSD")
 * @param timeframe Timeframe (e.g., "H1")
 * @param bars Number of bars (optional)
 * @returns Parsed data object or null
 *
 * @example
 * const data = await getCachedIndicatorData('XAUUSD', 'H1', 1000);
 * if (data) {
 *   console.log('Cache hit!', data);
 * } else {
 *   console.log('Cache miss - need to fetch from MT5');
 * }
 */
export async function getCachedIndicatorData(
  symbol: string,
  timeframe: string,
  bars?: number
): Promise<any | null> {
  const key = generateCacheKey(symbol, timeframe, bars);

  try {
    const cached = await cacheClient.get(key);

    if (cached) {
      recordHit();
      console.log(
        `[Cache] HIT: ${symbol}/${timeframe}${bars ? `/${bars}` : ''}`
      );
      return JSON.parse(cached);
    }

    recordMiss();
    console.log(
      `[Cache] MISS: ${symbol}/${timeframe}${bars ? `/${bars}` : ''}`
    );
    return null;
  } catch (error) {
    console.error('[Cache] Error reading from cache:', error);
    recordMiss();
    return null;
  }
}

/**
 * Set cached indicator data
 *
 * Stores data with automatic TTL based on timeframe
 * TTL values from Part 0 constants (CACHE_TTL)
 *
 * @param symbol Trading symbol
 * @param timeframe Timeframe
 * @param data Data to cache (will be JSON.stringified)
 * @param bars Number of bars (optional)
 *
 * @example
 * await setCachedIndicatorData('XAUUSD', 'H1', indicatorData, 1000);
 * // Automatically uses 3600s (1 hour) TTL for H1
 */
export async function setCachedIndicatorData(
  symbol: string,
  timeframe: string,
  data: any,
  bars?: number
): Promise<void> {
  const key = generateCacheKey(symbol, timeframe, bars);
  const ttl = getTTL(timeframe);

  try {
    await cacheClient.set(key, ttl, JSON.stringify(data));
    recordSet();
    console.log(
      `[Cache] SET: ${symbol}/${timeframe}${bars ? `/${bars}` : ''} ` +
        `(TTL: ${ttl}s = ${formatTTL(ttl)})`
    );
  } catch (error) {
    console.error('[Cache] Error writing to cache:', error);
    // Don't throw - caching failures shouldn't break the request
  }
}

/**
 * Check if cached data exists
 *
 * @param symbol Trading symbol
 * @param timeframe Timeframe
 * @param bars Number of bars (optional)
 * @returns True if cached data exists and is not expired
 */
export async function hasCachedData(
  symbol: string,
  timeframe: string,
  bars?: number
): Promise<boolean> {
  const key = generateCacheKey(symbol, timeframe, bars);

  try {
    return await cacheClient.exists(key);
  } catch (error) {
    console.error('[Cache] Error checking cache existence:', error);
    return false;
  }
}

/**
 * Invalidate cached data for specific symbol/timeframe/bars
 *
 * @param symbol Trading symbol
 * @param timeframe Timeframe
 * @param bars Number of bars (optional)
 *
 * @example
 * await invalidateCachedData('XAUUSD', 'H1', 1000);
 */
export async function invalidateCachedData(
  symbol: string,
  timeframe: string,
  bars?: number
): Promise<void> {
  const key = generateCacheKey(symbol, timeframe, bars);

  try {
    await cacheClient.delete(key);
    recordDelete();
    console.log(
      `[Cache] INVALIDATED: ${symbol}/${timeframe}${bars ? `/${bars}` : ''}`
    );
  } catch (error) {
    console.error('[Cache] Error invalidating cache:', error);
  }
}

/**
 * Invalidate all cached data for a symbol
 *
 * Useful when symbol data needs to be refreshed across all timeframes
 *
 * @param symbol Trading symbol
 *
 * @example
 * await invalidateSymbolCache('XAUUSD');
 * // Invalidates XAUUSD data for all timeframes (M5, M15, H1, etc.)
 */
export async function invalidateSymbolCache(symbol: string): Promise<void> {
  const pattern = generateSymbolPattern(symbol);

  try {
    console.log(`[Cache] INVALIDATING SYMBOL: ${symbol} (pattern: ${pattern})`);

    // Find all matching keys
    const keys = await cacheClient.keys(pattern);

    if (keys.length === 0) {
      console.log(`[Cache] No cached data found for ${symbol}`);
      return;
    }

    // Delete all matching keys
    await Promise.all(keys.map((key) => cacheClient.delete(key)));
    recordDelete();

    console.log(
      `[Cache] INVALIDATED ${keys.length} cache entries for ${symbol}`
    );
  } catch (error) {
    console.error('[Cache] Error invalidating symbol cache:', error);
  }
}

/**
 * Clear all cached data
 *
 * WARNING: This clears ALL cache entries
 * Use with caution - typically only for testing or maintenance
 */
export async function clearAllCache(): Promise<void> {
  try {
    cacheClient.clear();
    console.log('[Cache] All cache entries cleared');
  } catch (error) {
    console.error('[Cache] Error clearing cache:', error);
  }
}

/**
 * Get cache size (number of entries)
 *
 * @returns Number of cache entries
 */
export function getCacheSize(): number {
  return cacheClient.size();
}

// ============================================================================
// EXPORT SUMMARY
// ============================================================================

/**
 * Exported functions:
 *
 * Core Operations:
 * - getCachedIndicatorData(symbol, timeframe, bars?)
 * - setCachedIndicatorData(symbol, timeframe, data, bars?)
 * - hasCachedData(symbol, timeframe, bars?)
 *
 * Invalidation:
 * - invalidateCachedData(symbol, timeframe, bars?)
 * - invalidateSymbolCache(symbol)
 * - clearAllCache()
 *
 * Statistics:
 * - getCacheStats()
 * - resetCacheStats()
 *
 * Utilities:
 * - getCacheSize()
 */
