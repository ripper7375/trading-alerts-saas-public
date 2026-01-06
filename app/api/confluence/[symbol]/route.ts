/**
 * Part 20 - Phase 06: Confluence Score API Endpoint
 *
 * GET /api/confluence/[symbol]?timestamp=2026-01-03T17:00:00Z
 *
 * Calculates multi-timeframe confluence score (PRO only).
 * Analyzes 117 indicators (13 indicators × 9 timeframes) at a specific point in time.
 *
 * @see docs/sqlite-and-mt5service/part-20-sqlite-sync-postgresql-openapi.yaml
 * @see docs/sqlite-and-mt5service/part-20-architecture-design.md Section 9
 * @see docs/sqlite-and-mt5service/part-20-implementation-plan.md Phase 6
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { calculateConfluenceScore } from '@/lib/confluence/calculator';
import { getMultiTimeframeData } from '@/lib/db/multi-timeframe-query';
import {
  getCachedConfluence,
  cacheConfluence,
} from '@/lib/cache/confluence-cache';
import { isValidSymbol } from '@/lib/constants/business-rules';
import type { ConfluenceResponse } from '@/lib/confluence/types';

interface RouteContext {
  params: Promise<{
    symbol: string;
  }>;
}

/**
 * GET /api/confluence/[symbol]
 *
 * Calculate confluence score for a symbol at a specific timestamp.
 *
 * Query Parameters:
 * - timestamp (optional): ISO 8601 timestamp. Defaults to current time.
 *
 * Access Control:
 * - PRO tier required (returns 403 for FREE tier)
 *
 * Caching:
 * - Historical timestamps: cached indefinitely
 * - Current timestamp: cached 30 seconds
 *
 * @example
 * GET /api/confluence/EURUSD
 * GET /api/confluence/EURUSD?timestamp=2026-01-03T17:00:00Z
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
): Promise<
  NextResponse<ConfluenceResponse | { success: false; error: string }>
> {
  try {
    // Next.js 15: params is a Promise that must be awaited
    const { symbol } = await context.params;

    // Validate symbol exists
    if (!symbol || typeof symbol !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid symbol parameter',
        },
        { status: 400 }
      );
    }

    const upperSymbol = symbol.toUpperCase();

    // ========================================================================
    // 1. VALIDATE SYMBOL
    // ========================================================================
    if (!isValidSymbol(upperSymbol)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid symbol: ${symbol}. Must be one of 15 supported symbols.`,
        },
        { status: 400 }
      );
    }

    // ========================================================================
    // 2. VALIDATE PRO TIER
    // ========================================================================
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required',
        },
        { status: 401 }
      );
    }

    const userTier = session.user.tier || 'FREE';

    if (userTier !== 'PRO') {
      return NextResponse.json(
        {
          success: false,
          error:
            'PRO tier required for confluence analysis. Upgrade to PRO with a 7-day free trial.',
        },
        { status: 403 }
      );
    }

    // ========================================================================
    // 3. GET TIMESTAMP PARAMETER
    // ========================================================================
    const searchParams = request.nextUrl.searchParams;
    const timestampParam = searchParams.get('timestamp');
    const timestamp = timestampParam || new Date().toISOString();

    // Validate timestamp format
    const timestampDate = new Date(timestamp);
    if (isNaN(timestampDate.getTime())) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid timestamp format: ${timestamp}. Use ISO 8601 format.`,
        },
        { status: 400 }
      );
    }

    // ========================================================================
    // 4. CHECK CACHE
    // ========================================================================
    const cached = await getCachedConfluence(upperSymbol, timestamp);
    if (cached) {
      return NextResponse.json({
        success: true,
        symbol: upperSymbol,
        timestamp,
        confluence_score: cached.confluence_score,
        max_score: cached.max_score,
        signals: cached.signals,
        breakdown: cached.breakdown,
        all_117_indicators: cached.all_117_indicators,
      });
    }

    // ========================================================================
    // 5. QUERY MULTI-TIMEFRAME DATA (117 INDICATORS)
    // ========================================================================
    const multiTfData = await getMultiTimeframeData(upperSymbol, timestamp);

    // Verify we have at least some data
    const hasData = Object.values(multiTfData).some((data) => data !== null);
    if (!hasData) {
      return NextResponse.json(
        {
          success: false,
          error: `No indicator data available for ${upperSymbol} at ${timestamp}`,
        },
        { status: 404 }
      );
    }

    // ========================================================================
    // 6. CALCULATE CONFLUENCE SCORE
    // ========================================================================
    const confluenceResult = calculateConfluenceScore(multiTfData);

    // ========================================================================
    // 7. CACHE RESULT
    // ========================================================================
    await cacheConfluence(upperSymbol, timestamp, confluenceResult);

    // ========================================================================
    // 8. RETURN RESPONSE
    // ========================================================================
    return NextResponse.json({
      success: true,
      symbol: upperSymbol,
      timestamp,
      confluence_score: confluenceResult.confluence_score,
      max_score: confluenceResult.max_score,
      signals: confluenceResult.signals,
      breakdown: confluenceResult.breakdown,
      all_117_indicators: confluenceResult.all_117_indicators,
    });
  } catch (error) {
    console.error('[ConfluenceAPI] Error calculating confluence:', error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Internal server error calculating confluence score',
      },
      { status: 500 }
    );
  }
}
