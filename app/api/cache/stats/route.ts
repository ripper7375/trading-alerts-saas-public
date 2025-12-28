/**
 * Cache Statistics API Route
 *
 * GET /api/cache/stats
 * Returns cache hit/miss statistics for monitoring.
 *
 * @module app/api/cache/stats/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth/auth-options';
import {
  getCacheStats,
  isUsingMemoryCacheMode,
} from '@/lib/cache/indicator-cache';

/**
 * GET /api/cache/stats
 *
 * Returns cache statistics for monitoring cache performance.
 * Requires authentication.
 *
 * @returns 200: Cache statistics
 * @returns 401: Unauthorized
 * @returns 500: Internal server error
 *
 * @example Response:
 * {
 *   "success": true,
 *   "stats": {
 *     "hits": 100,
 *     "misses": 25,
 *     "total": 125,
 *     "hitRate": "80.00%",
 *     "hitRateDecimal": 0.8,
 *     "cacheType": "redis"
 *   },
 *   "timestamp": "2025-12-28T12:00:00.000Z"
 * }
 */
export async function GET(_req: NextRequest): Promise<NextResponse> {
  try {
    // Require authentication
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
          message: 'You must be logged in to view cache statistics',
        },
        { status: 401 }
      );
    }

    const stats = getCacheStats();
    const isMemoryCache = isUsingMemoryCacheMode();

    return NextResponse.json(
      {
        success: true,
        stats: {
          hits: stats.hits,
          misses: stats.misses,
          total: stats.hits + stats.misses,
          hitRate: `${(stats.hitRate * 100).toFixed(2)}%`,
          hitRateDecimal: stats.hitRate,
          cacheType: isMemoryCache ? 'memory' : 'redis',
        },
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Cache Stats] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: 'Failed to retrieve cache statistics',
      },
      { status: 500 }
    );
  }
}
