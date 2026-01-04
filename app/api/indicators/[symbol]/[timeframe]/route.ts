/**
 * Indicator Data API Route
 *
 * Part 20 - Phase 04: Next.js API Routes
 *
 * GET /api/indicators/[symbol]/[timeframe]
 * Fetches indicator data from PostgreSQL with tier validation.
 * Replaces Flask MT5 service endpoints from Part 6.
 *
 * @module app/api/indicators/[symbol]/[timeframe]/route
 */

import { type NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { MT5ServiceError } from '@/lib/api/mt5-client';
import { authOptions } from '@/lib/auth/auth-options';
import {
  getCachedIndicatorData,
  setCachedIndicatorData,
} from '@/lib/cache/indicator-cache';
import { getIndicatorData } from '@/lib/db/queries';
import type { IndicatorMetadata } from '@/lib/indicators/types';
import { getMarketStatusMetadata } from '@/lib/market-hours/validator';
import type { Tier } from '@/lib/tier-config';
import {
  getAccessibleSymbols,
  getAccessibleTimeframes,
  isValidSymbol,
  isValidTimeframe,
  validateTierAccess,
} from '@/lib/tier/validation';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface RouteParams {
  params: Promise<{
    symbol: string;
    timeframe: string;
  }>;
}

interface SuccessResponse {
  success: true;
  data: unknown;
  tier: Tier;
  cached: boolean;
  requestedAt: string;
}

interface ErrorResponse {
  success: false;
  error: string;
  message: string;
  tier?: Tier;
  accessible_symbols?: readonly string[];
  accessible_timeframes?: readonly string[];
  upgrade_required?: boolean;
  upgrade_url?: string;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET HANDLER
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * GET /api/indicators/[symbol]/[timeframe]
 *
 * Fetches indicator data from PostgreSQL.
 * Validates tier access before retrieving data.
 *
 * @param request - Next.js request object
 * @param params - Route parameters containing symbol and timeframe
 * @returns 200: Indicator data with market status metadata
 * @returns 400: Invalid symbol or timeframe
 * @returns 401: Unauthorized (not logged in)
 * @returns 403: Tier cannot access this symbol/timeframe
 * @returns 500: Database error
 *
 * @example Request:
 * GET /api/indicators/XAUUSD/H1?limit=500
 *
 * @example Response (success):
 * {
 *   "success": true,
 *   "data": {
 *     "ohlc": [...],
 *     "fractals": {...},
 *     "horizontal_trendlines": {...},
 *     "diagonal_trendlines": {...},
 *     "metadata": {
 *       "market_status": "OPEN",
 *       "trading_hours": {...},
 *       "dst_active": false
 *     }
 *   },
 *   "tier": "FREE",
 *   "cached": false,
 *   "requestedAt": "2026-01-04T12:00:00.000Z"
 * }
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    //───────────────────────────────────────────────────────
    // STEP 1: Authentication Check
    //───────────────────────────────────────────────────────
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
          message: 'You must be logged in to fetch indicator data',
        } as ErrorResponse,
        { status: 401 }
      );
    }

    //───────────────────────────────────────────────────────
    // STEP 2: Extract Parameters
    //───────────────────────────────────────────────────────
    const { symbol, timeframe } = await params;
    const upperSymbol = symbol.toUpperCase();
    const upperTimeframe = timeframe.toUpperCase();

    // Get limit parameter from query string (default: 1000, max: 10000)
    // Also support 'bars' for backwards compatibility
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get('limit') || searchParams.get('bars');
    const limit = limitParam
      ? Math.min(Math.max(parseInt(limitParam, 10) || 1000, 1), 10000)
      : 1000;

    //───────────────────────────────────────────────────────
    // STEP 3: Validate Symbol
    //───────────────────────────────────────────────────────
    if (!isValidSymbol(upperSymbol)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid symbol',
          message: `Symbol ${upperSymbol} is not a valid trading symbol.`,
        } as ErrorResponse,
        { status: 400 }
      );
    }

    //───────────────────────────────────────────────────────
    // STEP 4: Validate Timeframe
    //───────────────────────────────────────────────────────
    if (!isValidTimeframe(upperTimeframe)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid timeframe',
          message: `Timeframe ${upperTimeframe} is not valid.`,
        } as ErrorResponse,
        { status: 400 }
      );
    }

    //───────────────────────────────────────────────────────
    // STEP 5: Get User Tier
    //───────────────────────────────────────────────────────
    const userTier = (session.user.tier as Tier) || 'FREE';

    //───────────────────────────────────────────────────────
    // STEP 6: Validate Tier Access
    //───────────────────────────────────────────────────────
    const tierAccess = validateTierAccess(upperSymbol, upperTimeframe, userTier);

    if (!tierAccess.allowed) {
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Tier restriction',
        message: tierAccess.message,
        tier: userTier,
        accessible_symbols: getAccessibleSymbols(userTier),
        accessible_timeframes: getAccessibleTimeframes(userTier),
        upgrade_required: true,
        upgrade_url: '/pricing',
      };

      return NextResponse.json(errorResponse, { status: 403 });
    }

    //───────────────────────────────────────────────────────
    // STEP 7: Check Cache First
    //───────────────────────────────────────────────────────
    const cachedData = await getCachedIndicatorData(
      upperSymbol,
      upperTimeframe,
      limit
    );

    if (cachedData) {
      console.log(`[API] Cache HIT: ${upperSymbol}/${upperTimeframe}`);

      // Get market status metadata
      const marketStatus = getMarketStatusMetadata(upperSymbol);

      return NextResponse.json(
        {
          success: true,
          data: {
            ...(cachedData as object),
            metadata: {
              symbol: upperSymbol,
              timeframe: upperTimeframe,
              tier: userTier,
              bars_returned: limit,
              data_source: 'cache',
              pro_indicators_enabled: userTier === 'PRO',
              ...marketStatus,
            } as IndicatorMetadata,
          },
          tier: userTier,
          cached: true,
          requestedAt: new Date().toISOString(),
        } as SuccessResponse,
        {
          status: 200,
          headers: {
            'X-Cache': 'HIT',
          },
        }
      );
    }

    console.log(`[API] Cache MISS: ${upperSymbol}/${upperTimeframe}`);

    //───────────────────────────────────────────────────────
    // STEP 8: Fetch Data from PostgreSQL
    //───────────────────────────────────────────────────────
    const indicatorData = await getIndicatorData(
      upperSymbol,
      upperTimeframe,
      limit
    );

    // Get market status metadata
    const marketStatus = getMarketStatusMetadata(upperSymbol);

    // Build metadata
    const metadata: IndicatorMetadata = {
      symbol: upperSymbol,
      timeframe: upperTimeframe,
      tier: userTier,
      bars_returned: indicatorData.ohlc.length,
      data_source: 'postgresql',
      last_sync: new Date().toISOString(),
      pro_indicators_enabled: userTier === 'PRO',
      ...marketStatus,
    };

    // Add metadata to response
    const responseData = {
      ...indicatorData,
      metadata,
    };

    //───────────────────────────────────────────────────────
    // STEP 9: Cache the Data
    //───────────────────────────────────────────────────────
    setCachedIndicatorData(upperSymbol, upperTimeframe, indicatorData, limit).catch(
      (err) => {
        console.error('[API] Failed to cache indicator data:', err);
      }
    );

    //───────────────────────────────────────────────────────
    // STEP 10: Return Response
    //───────────────────────────────────────────────────────
    const response: SuccessResponse = {
      success: true,
      data: responseData,
      tier: userTier,
      cached: false,
      requestedAt: new Date().toISOString(),
    };

    return NextResponse.json(response, {
      status: 200,
      headers: {
        'X-Cache': 'MISS',
        'X-Cache-Status': 'Stored',
      },
    });
  } catch (error) {
    //───────────────────────────────────────────────────────
    // Error Handling
    //───────────────────────────────────────────────────────
    console.error('GET /api/indicators/[symbol]/[timeframe] error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });

    // Handle MT5ServiceError
    if (error instanceof MT5ServiceError) {
      return NextResponse.json(
        {
          success: false,
          error: 'MT5 service error',
          message: error.message || 'Failed to fetch data from MT5 service',
        } as ErrorResponse,
        { status: 500 }
      );
    }

    // Check for database connection errors
    if (error instanceof Error) {
      const isDbError =
        error.message.includes('ECONNREFUSED') ||
        error.message.includes('connection') ||
        error.message.includes('timeout');

      if (isDbError) {
        return NextResponse.json(
          {
            success: false,
            error: 'Database unavailable',
            message:
              'Unable to connect to the database. Please try again later.',
          } as ErrorResponse,
          { status: 503 }
        );
      }

      // Check for table not found errors
      if (error.message.includes('does not exist')) {
        return NextResponse.json(
          {
            success: false,
            error: 'Data not available',
            message:
              'Indicator data for this symbol/timeframe combination is not yet available.',
          } as ErrorResponse,
          { status: 404 }
        );
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: 'An unexpected error occurred. Please try again later.',
      } as ErrorResponse,
      { status: 500 }
    );
  }
}
