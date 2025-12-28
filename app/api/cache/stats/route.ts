/**
 * Cache Statistics API Route
 *
 * GET /api/cache/stats
 * Returns cache hit/miss statistics for monitoring
 *
 * @module app/api/cache/stats/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { getCacheStats, getCacheSize } from '@/lib/cache/indicator-cache';

/**
 * GET /api/cache/stats
 *
 * Returns current cache statistics
 * Requires authentication (optional: require admin role)
 *
 * @example Response:
 * {
 *   "success": true,
 *   "stats": {
 *     "hits": 150,
 *     "misses": 50,
 *     "sets": 50,
 *     "deletes": 5,
 *     "total": 200,
 *     "hitRate": "75.00%",
 *     "hitRateDecimal": 0.75,
 *     "cacheSize": 45
 *   },
 *   "timestamp": "2025-12-28T12:00:00.000Z"
 * }
 */
export async function GET(_request: NextRequest): Promise<NextResponse> {
  try {
    // Authentication check (optional: add admin role check)
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
          message: 'Authentication required to view cache statistics',
        },
        { status: 401 }
      );
    }

    // Get cache statistics
    const stats = getCacheStats();
    const cacheSize = getCacheSize();
    const total = stats.hits + stats.misses;

    // Format statistics
    const formattedStats = {
      hits: stats.hits,
      misses: stats.misses,
      sets: stats.sets,
      deletes: stats.deletes,
      total,
      hitRate: `${(stats.hitRate * 100).toFixed(2)}%`,
      hitRateDecimal: stats.hitRate,
      cacheSize,
    };

    return NextResponse.json(
      {
        success: true,
        stats: formattedStats,
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
