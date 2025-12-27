/**
 * Rate Limiting Service
 *
 * Implements sliding window rate limiting using Redis.
 * Provides configurable limits for different endpoints and user tiers.
 */

import { getRedisClient } from '@/lib/redis/client';

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  /** Maximum number of requests allowed */
  limit: number;
  /** Time window in seconds */
  window: number;
  /** Optional identifier prefix */
  prefix?: string;
}

/**
 * Rate limit result
 */
export interface RateLimitResult {
  /** Whether the request is allowed */
  success: boolean;
  /** Number of remaining requests */
  remaining: number;
  /** Total limit */
  limit: number;
  /** Time until reset in seconds */
  reset: number;
}

/**
 * Default rate limit configurations
 */
export const RATE_LIMITS = {
  /** Auth endpoints: 5 requests per minute */
  AUTH: {
    limit: 5,
    window: 60,
    prefix: 'rl:auth',
  },
  /** Register endpoint: 3 requests per minute */
  REGISTER: {
    limit: 3,
    window: 60,
    prefix: 'rl:register',
  },
  /** Password reset: 3 requests per 15 minutes */
  PASSWORD_RESET: {
    limit: 3,
    window: 900,
    prefix: 'rl:pwd-reset',
  },
  /** API endpoints by tier */
  API_FREE: {
    limit: 10,
    window: 60,
    prefix: 'rl:api:free',
  },
  API_BASIC: {
    limit: 30,
    window: 60,
    prefix: 'rl:api:basic',
  },
  API_PRO: {
    limit: 100,
    window: 60,
    prefix: 'rl:api:pro',
  },
} as const;

/**
 * Check rate limit using sliding window algorithm
 *
 * @param identifier - Unique identifier (IP, user ID, etc.)
 * @param config - Rate limit configuration
 * @returns Rate limit result
 */
export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  try {
    const redis = getRedisClient();
    const key = `${config.prefix || 'rl'}:${identifier}`;
    const now = Date.now();
    const windowStart = now - config.window * 1000;

    // Use Redis pipeline for atomic operations
    const pipeline = redis.pipeline();

    // Remove expired entries
    pipeline.zremrangebyscore(key, 0, windowStart);

    // Count current requests in window
    pipeline.zcard(key);

    // Add current request
    pipeline.zadd(key, now, `${now}-${Math.random()}`);

    // Set expiry
    pipeline.expire(key, config.window);

    const results = await pipeline.exec();

    if (!results) {
      // Redis error - allow request but log
      console.error('Rate limit check failed: no results from Redis');
      return {
        success: true,
        remaining: config.limit,
        limit: config.limit,
        reset: config.window,
      };
    }

    // Get count from zcard result (index 1)
    const count = (results[1]?.[1] as number) || 0;
    const remaining = Math.max(0, config.limit - count - 1);
    const success = count < config.limit;

    return {
      success,
      remaining,
      limit: config.limit,
      reset: config.window,
    };
  } catch (error) {
    // On Redis error, allow request but log
    console.error('Rate limit check error:', error);
    return {
      success: true,
      remaining: config.limit,
      limit: config.limit,
      reset: config.window,
    };
  }
}

/**
 * Get rate limit headers for response
 *
 * @param result - Rate limit result
 * @returns Headers object
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
 * Rate limit middleware helper for API routes
 *
 * @param request - Incoming request
 * @param config - Rate limit configuration
 * @returns Rate limit result with IP identifier
 */
export async function rateLimit(
  request: Request,
  config: RateLimitConfig
): Promise<RateLimitResult & { ip: string }> {
  // Get client IP from headers (supports proxies)
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const ip = forwarded?.split(',')[0]?.trim() || realIp || 'unknown';

  const result = await checkRateLimit(ip, config);

  return { ...result, ip };
}

/**
 * Get tier-based rate limit config
 *
 * @param tier - User tier (FREE, BASIC, PRO)
 * @returns Rate limit configuration
 */
export function getTierRateLimit(tier: string): RateLimitConfig {
  switch (tier.toUpperCase()) {
    case 'PRO':
      return RATE_LIMITS.API_PRO;
    case 'BASIC':
      return RATE_LIMITS.API_BASIC;
    default:
      return RATE_LIMITS.API_FREE;
  }
}
