/**
 * Part 20 - Phase 05: Admin Cache Clear Endpoint
 *
 * POST /api/admin/cache/clear
 * Clears Redis cache for indicator data.
 * Requires Admin API Key authentication.
 *
 * @see docs/sqlite-and-mt5service/part-20-architecture-design.md Section 7.3
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import {
  invalidateOnSync,
  invalidateAll,
  invalidateByPattern,
  getCacheStats,
} from '@/lib/cache/cache-invalidation';

// ============================================================================
// TYPES
// ============================================================================

interface CacheClearResponse {
  success: boolean;
  message: string;
  keys_cleared: number;
  pattern?: string;
  symbols?: string[];
  timestamp: string;
}

interface ErrorResponse {
  success: boolean;
  error: string;
  message: string;
}

// ============================================================================
// VALIDATION
// ============================================================================

const requestBodySchema = z.object({
  pattern: z.string().optional(),
  symbols: z.array(z.string()).optional(),
  clear_all: z.boolean().optional(),
});

// ============================================================================
// AUTHENTICATION
// ============================================================================

/**
 * Validate Admin API Key from request headers
 */
function validateAdminApiKey(request: NextRequest): boolean {
  const apiKey = request.headers.get('X-Admin-API-Key');
  const expectedKey = process.env['ADMIN_API_KEY'];

  if (!expectedKey) {
    console.error('[AdminCache] ADMIN_API_KEY environment variable not set');
    return false;
  }

  return apiKey === expectedKey;
}

// ============================================================================
// POST HANDLER
// ============================================================================

/**
 * POST /api/admin/cache/clear
 *
 * Clear Redis cache for indicator data.
 * Requires X-Admin-API-Key header for authentication.
 *
 * Request Body (optional):
 * - pattern: Redis key pattern to clear (e.g., "indicators:EURUSD:*")
 * - symbols: Array of symbols to invalidate (e.g., ["EURUSD", "XAUUSD"])
 * - clear_all: If true, clears entire indicator cache
 *
 * @example Clear all cache:
 * curl -X POST -H "X-Admin-API-Key: $ADMIN_KEY" \
 *   http://localhost:3000/api/admin/cache/clear \
 *   -H "Content-Type: application/json" \
 *   -d '{"clear_all": true}'
 *
 * @example Clear specific symbols:
 * curl -X POST -H "X-Admin-API-Key: $ADMIN_KEY" \
 *   http://localhost:3000/api/admin/cache/clear \
 *   -H "Content-Type: application/json" \
 *   -d '{"symbols": ["EURUSD", "XAUUSD"]}'
 *
 * @example Clear by pattern:
 * curl -X POST -H "X-Admin-API-Key: $ADMIN_KEY" \
 *   http://localhost:3000/api/admin/cache/clear \
 *   -H "Content-Type: application/json" \
 *   -d '{"pattern": "indicators:EURUSD:*"}'
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<CacheClearResponse | ErrorResponse>> {
  try {
    // ─────────────────────────────────────────────────────────
    // STEP 1: Authentication Check
    // ─────────────────────────────────────────────────────────
    if (!validateAdminApiKey(request)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
          message: 'Invalid or missing Admin API Key',
        },
        { status: 401 }
      );
    }

    // ─────────────────────────────────────────────────────────
    // STEP 2: Parse Request Body
    // ─────────────────────────────────────────────────────────
    let body: z.infer<typeof requestBodySchema> = {};

    try {
      const rawBody = await request.text();
      if (rawBody) {
        body = requestBodySchema.parse(JSON.parse(rawBody));
      }
    } catch {
      // Empty body is valid - will clear all by default
    }

    const { pattern, symbols, clear_all } = body;
    const timestamp = new Date().toISOString();

    // ─────────────────────────────────────────────────────────
    // STEP 3: Execute Cache Clear
    // ─────────────────────────────────────────────────────────
    let keysCleared = 0;
    let message = '';

    if (symbols && symbols.length > 0) {
      // Clear specific symbols
      const result = await invalidateOnSync(symbols);
      keysCleared = result.keysCleared;
      message = `Cleared cache for ${result.symbolsInvalidated.length} symbols`;

      console.log(`[AdminCache] Cleared ${keysCleared} keys for symbols: ${symbols.join(', ')}`);

      return NextResponse.json({
        success: true,
        message,
        keys_cleared: keysCleared,
        symbols: result.symbolsInvalidated,
        timestamp,
      });
    }

    if (pattern) {
      // Clear by pattern
      keysCleared = await invalidateByPattern(pattern);
      message = `Cleared cache matching pattern: ${pattern}`;

      console.log(`[AdminCache] Cleared ${keysCleared} keys for pattern: ${pattern}`);

      return NextResponse.json({
        success: true,
        message,
        keys_cleared: keysCleared,
        pattern,
        timestamp,
      });
    }

    // Default: clear all (if clear_all is true or no other option specified)
    if (clear_all || (!symbols && !pattern)) {
      const result = await invalidateAll();
      keysCleared = result.keysCleared;
      message = 'Cleared all indicator cache';

      console.log(`[AdminCache] Cleared all indicator cache: ${keysCleared} keys`);

      return NextResponse.json({
        success: true,
        message,
        keys_cleared: keysCleared,
        timestamp,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'No cache operation performed',
      keys_cleared: 0,
      timestamp,
    });
  } catch (error) {
    console.error('[AdminCache] Error clearing cache:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Failed to clear cache',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET HANDLER - Cache Stats
// ============================================================================

/**
 * GET /api/admin/cache/clear
 *
 * Get cache statistics.
 * Requires X-Admin-API-Key header for authentication.
 *
 * @example
 * curl -H "X-Admin-API-Key: $ADMIN_KEY" \
 *   http://localhost:3000/api/admin/cache/clear
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse> {
  try {
    // Authentication Check
    if (!validateAdminApiKey(request)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
          message: 'Invalid or missing Admin API Key',
        },
        { status: 401 }
      );
    }

    // Get cache stats
    const stats = await getCacheStats();

    return NextResponse.json({
      success: true,
      stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[AdminCache] Error getting cache stats:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Failed to get cache stats',
      },
      { status: 500 }
    );
  }
}
