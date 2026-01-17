/**
 * Part 20 - Phase 05: Redis Caching Layer
 *
 * Redis client wrapper for indicator data caching.
 * TTL of 30 seconds matches the sync interval from SQLite to PostgreSQL.
 *
 * @see docs/sqlite-and-mt5service/part-20-architecture-design.md Section 7.3
 */

import { getRedisClient, isRedisConnected, getRedisStatus } from '@/lib/redis/client';

/**
 * Default cache TTL in seconds (30 seconds to match sync interval)
 */
export const CACHE_TTL = 30;

/**
 * Cache key prefix for indicator data
 */
export const CACHE_PREFIX = 'indicators';

/**
 * Ensure Redis connection is ready before operations
 * Handles reconnection if connection is closed
 *
 * @returns true if Redis is ready, false otherwise
 */
async function ensureRedisReady(): Promise<boolean> {
  try {
    const { connected, status } = getRedisStatus();

    // If already ready, return immediately
    if (connected && status === 'ready') {
      return true;
    }

    // If connecting, wait briefly and retry
    if (status === 'connecting' || status === 'wait') {
      await new Promise((resolve) => setTimeout(resolve, 100));
      const retryStatus = getRedisStatus();
      return retryStatus.connected && retryStatus.status === 'ready';
    }

    // If closed or ended, attempt to reconnect
    if (status === 'close' || status === 'end' || status === 'not_initialized') {
      const redis = getRedisClient();
      await redis.connect();
      const newStatus = getRedisStatus();
      return newStatus.connected && newStatus.status === 'ready';
    }

    return false;
  } catch (error) {
    console.error('[Redis] Connection check error:', error);
    return false;
  }
}

/**
 * Check if Redis is available
 * Used for graceful fallback to PostgreSQL
 */
export async function isRedisAvailable(): Promise<boolean> {
  try {
    return await isRedisConnected();
  } catch {
    return false;
  }
}

/**
 * Get a value from Redis cache
 *
 * @param key - Cache key
 * @returns Parsed value or null if not found/error
 */
export async function get<T>(key: string): Promise<T | null> {
  try {
    // Check if Redis is ready before operation
    const isReady = await ensureRedisReady();
    if (!isReady) {
      return null;
    }

    const redis = getRedisClient();
    const value = await redis.get(key);

    if (!value) {
      return null;
    }

    return JSON.parse(value) as T;
  } catch (error) {
    console.error('[Redis] Get error:', error);
    return null;
  }
}

/**
 * Set a value in Redis cache with TTL
 *
 * @param key - Cache key
 * @param value - Value to cache (will be JSON serialized)
 * @param ttl - Time to live in seconds (default: 30s)
 */
export async function set(
  key: string,
  value: unknown,
  ttl: number = CACHE_TTL
): Promise<void> {
  try {
    // Check if Redis is ready before operation
    const isReady = await ensureRedisReady();
    if (!isReady) {
      return;
    }

    const redis = getRedisClient();
    const serialized = JSON.stringify(value);
    await redis.setex(key, ttl, serialized);
  } catch (error) {
    console.error('[Redis] Set error:', error);
    // Don't throw - caching failures shouldn't break requests
  }
}

/**
 * Delete a value from Redis cache
 *
 * @param key - Cache key
 */
export async function del(key: string): Promise<void> {
  try {
    // Check if Redis is ready before operation
    const isReady = await ensureRedisReady();
    if (!isReady) {
      return;
    }

    const redis = getRedisClient();
    await redis.del(key);
  } catch (error) {
    console.error('[Redis] Delete error:', error);
  }
}

/**
 * Delete all keys matching a pattern
 *
 * @param pattern - Pattern to match (e.g., 'indicators:EURUSD:*')
 * @returns Number of keys deleted
 */
export async function invalidatePattern(pattern: string): Promise<number> {
  try {
    // Check if Redis is ready before operation
    const isReady = await ensureRedisReady();
    if (!isReady) {
      return 0;
    }

    const redis = getRedisClient();
    const keys = await redis.keys(pattern);

    if (keys.length === 0) {
      return 0;
    }

    await redis.del(...keys);
    return keys.length;
  } catch (error) {
    console.error('[Redis] Invalidate pattern error:', error);
    return 0;
  }
}

/**
 * Get all keys matching a pattern
 *
 * @param pattern - Pattern to match
 * @returns Array of matching keys
 */
export async function keys(pattern: string): Promise<string[]> {
  try {
    // Check if Redis is ready before operation
    const isReady = await ensureRedisReady();
    if (!isReady) {
      return [];
    }

    const redis = getRedisClient();
    return await redis.keys(pattern);
  } catch (error) {
    console.error('[Redis] Keys error:', error);
    return [];
  }
}

/**
 * Get Redis memory usage info
 */
export async function getMemoryInfo(): Promise<{
  usedMemory: string;
  usedMemoryPeak: string;
} | null> {
  try {
    // Check if Redis is ready before operation
    const isReady = await ensureRedisReady();
    if (!isReady) {
      return null;
    }

    const redis = getRedisClient();
    const info = await redis.info('memory');

    const usedMemoryMatch = info.match(/used_memory_human:(\S+)/);
    const usedMemoryPeakMatch = info.match(/used_memory_peak_human:(\S+)/);

    return {
      usedMemory: usedMemoryMatch?.[1] || 'unknown',
      usedMemoryPeak: usedMemoryPeakMatch?.[1] || 'unknown',
    };
  } catch (error) {
    console.error('[Redis] Memory info error:', error);
    return null;
  }
}

/**
 * Get number of keys in the database
 */
export async function getKeyCount(): Promise<number> {
  try {
    // Check if Redis is ready before operation
    const isReady = await ensureRedisReady();
    if (!isReady) {
      return 0;
    }

    const redis = getRedisClient();
    return await redis.dbsize();
  } catch (error) {
    console.error('[Redis] Key count error:', error);
    return 0;
  }
}

// Re-export Redis client for direct access if needed
export { getRedisClient } from '@/lib/redis/client';
