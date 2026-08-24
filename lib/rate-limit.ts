/**
 * Rate Limiting Module
 * Implements sliding window rate limiting using Redis
 *
 * Auth endpoints: 5 requests per 15 minutes
 * Tier-based limits: 60/hour FREE, 300/hour PRO
 */

import { getRedisClient } from './redis/client';
import type { Tier } from './tier-config';

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp when the limit resets
}

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  /** Maximum number of requests allowed in the window */
  limit: number;
  /** Window duration in seconds */
  windowSeconds: number;
  /** Redis key prefix */
  prefix: string;
}

/**
 * Auth rate limit configuration
 * 5 requests per 15 minutes for authentication endpoints
 */
export const AUTH_RATE_LIMIT_CONFIG: RateLimitConfig = {
  limit: 5,
  windowSeconds: 15 * 60, // 15 minutes
  prefix: 'ratelimit:auth',
};

/**
 * Tier-based rate limit configurations
 * FREE: 60 requests per hour
 * PRO: 300 requests per hour
 */
export const TIER_RATE_LIMIT_CONFIGS: Record<Tier, RateLimitConfig> = {
  FREE: {
    limit: 60,
    windowSeconds: 60 * 60, // 1 hour
    prefix: 'ratelimit:free',
  },
  PRO: {
    limit: 300,
    windowSeconds: 60 * 60, // 1 hour
    prefix: 'ratelimit:pro',
  },
};

/**
 * Sliding window rate limiter implementation
 * Uses Redis sorted sets for efficient sliding window
 *
 * @param identifier - Unique identifier (e.g., user ID, IP address)
 * @param config - Rate limit configuration
 * @returns Rate limit result with success status and metadata
 */
export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const redis = getRedisClient();
  const key = `${config.prefix}:${identifier}`;
  const now = Date.now();
  const windowStart = now - config.windowSeconds * 1000;

  // Use Redis transaction for atomic operations
  const pipeline = redis.pipeline();

  // Remove entries outside the current window
  pipeline.zremrangebyscore(key, 0, windowStart);

  // Count current entries in the window
  pipeline.zcard(key);

  // Add current request
  pipeline.zadd(key, now.toString(), `${now}`);

  // Set expiry on the key
  pipeline.expire(key, config.windowSeconds);

  const results = await pipeline.exec();

  if (!results) {
    // Redis error - fail open with success
    return {
      success: true,
      limit: config.limit,
      remaining: config.limit - 1,
      reset: Math.floor((now + config.windowSeconds * 1000) / 1000),
    };
  }

  // Get the count before adding the current request
  const countResult = results[1];
  const currentCount =
    countResult && countResult[1] !== null ? (countResult[1] as number) : 0;

  const reset = Math.floor((now + config.windowSeconds * 1000) / 1000);

  if (currentCount >= config.limit) {
    // Remove the request we just added since we're over the limit
    await redis.zrem(key, `${now}`);

    return {
      success: false,
      limit: config.limit,
      remaining: 0,
      reset,
    };
  }

  return {
    success: true,
    limit: config.limit,
    remaining: config.limit - currentCount - 1,
    reset,
  };
}

/**
 * Check auth rate limit
 * 5 requests per 15 minutes
 *
 * @param identifier - User identifier (e.g., IP address, email)
 * @returns Rate limit result
 */
export async function checkAuthRateLimit(
  identifier: string
): Promise<RateLimitResult> {
  return checkRateLimit(identifier, AUTH_RATE_LIMIT_CONFIG);
}

/**
 * Check tier-based rate limit
 * FREE: 60/hour, PRO: 300/hour
 *
 * @param identifier - User identifier (e.g., user ID)
 * @param tier - User's subscription tier
 * @returns Rate limit result
 */
export async function checkTierRateLimit(
  identifier: string,
  tier: Tier
): Promise<RateLimitResult> {
  const config = TIER_RATE_LIMIT_CONFIGS[tier];
  return checkRateLimit(identifier, config);
}

/**
 * Get rate limit headers for HTTP response
 *
 * @param result - Rate limit result
 * @returns Headers object for rate limiting
 */
export function getRateLimitHeaders(
  result: RateLimitResult
): Record<string, string> {
  return {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': result.reset.toString(),
  };
}

/**
 * Reset rate limit for an identifier
 * Useful for testing or admin operations
 *
 * @param identifier - User identifier
 * @param config - Rate limit configuration
 */
export async function resetRateLimit(
  identifier: string,
  config: RateLimitConfig
): Promise<void> {
  const redis = getRedisClient();
  const key = `${config.prefix}:${identifier}`;
  await redis.del(key);
}

/**
 * AI token usage tracking result
 */
export interface TrackAiTokenUsageResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  currentUsage: number;
}

/** 35 days, so a mid-month TTL refresh never clips before the month's own quota resets */
const AI_TOKEN_TTL_SECONDS = 35 * 24 * 60 * 60;

/**
 * Track AI token usage against a monthly quota (Session 11-3, Core Area 4).
 * Reuses the existing Redis client -- no new rate-limit layer, no separate
 * connection pool. Monthly key pattern: `ratelimit:ai_tokens:{userId}:{yearMonth}`,
 * atomic INCRBY, 35-day TTL set once on first write.
 *
 * @param userId - User identifier
 * @param tokensUsed - Tokens consumed by this call (prompt + completion + image)
 * @param monthlyQuota - Monthly token quota (0 disallows all usage, e.g. FREE tier)
 * @returns Usage result: allowed, limit, remaining, and cumulative usage this month
 */
export async function trackAiTokenUsage(
  userId: string,
  tokensUsed: number,
  monthlyQuota: number
): Promise<TrackAiTokenUsageResult> {
  const redis = getRedisClient();
  const yearMonth = new Date().toISOString().slice(0, 7);
  const key = `ratelimit:ai_tokens:${userId}:${yearMonth}`;

  const currentUsage = await redis.incrby(key, tokensUsed);

  // Set the TTL only on first write -- ttl() returns -1 for a key with no expiry
  const ttl = await redis.ttl(key);
  if (ttl === -1) {
    await redis.expire(key, AI_TOKEN_TTL_SECONDS);
  }

  const allowed = currentUsage < monthlyQuota;

  return {
    allowed,
    limit: monthlyQuota,
    remaining: Math.max(0, monthlyQuota - currentUsage),
    currentUsage,
  };
}

/**
 * Get current rate limit status without consuming a request
 *
 * @param identifier - User identifier
 * @param config - Rate limit configuration
 * @returns Current rate limit status
 */
export async function getRateLimitStatus(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const redis = getRedisClient();
  const key = `${config.prefix}:${identifier}`;
  const now = Date.now();
  const windowStart = now - config.windowSeconds * 1000;

  // Remove old entries and count current
  const pipeline = redis.pipeline();
  pipeline.zremrangebyscore(key, 0, windowStart);
  pipeline.zcard(key);

  const results = await pipeline.exec();

  const countResult = results?.[1];
  const currentCount =
    countResult && countResult[1] !== null ? (countResult[1] as number) : 0;

  const reset = Math.floor((now + config.windowSeconds * 1000) / 1000);

  return {
    success: currentCount < config.limit,
    limit: config.limit,
    remaining: Math.max(0, config.limit - currentCount),
    reset,
  };
}
