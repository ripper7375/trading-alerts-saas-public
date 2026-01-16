/**
 * Part 20 - Phase 05: Indicator Data API Route
 *
 * GET /api/indicators/[symbol]/[timeframe]
 * Fetches indicator data from PostgreSQL with Redis caching layer.
 * Uses cache-through pattern: check cache first, fallback to database.
 *
 * @see docs/sqlite-and-mt5service/part-20-architecture-design.md Section 7.3
 */

import { type NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth/auth-options';
import {
  getIndicatorDataCached,
  type CachedIndicatorResult,
  INDICATOR_CACHE_TTL,
} from '@/lib/cache/indicator-cache';
import {
  FREE_SYMBOLS,
  FREE_TIMEFRAMES,
  PRO_SYMBOLS,
  PRO_TIMEFRAMES,
} from '@/lib/tier-config';
import { isMarketOpen } from '@/lib/market-hours/validator';
import type { IndicatorData } from '@/lib/indicators/types';
import type { Tier } from '@/types/tier';

// ============================================================================
// TYPES
// ============================================================================

interface RouteParams {
  params: Promise<{
    symbol: string;
    timeframe: string;
  }>;
}

interface IndicatorDataResponse {
  success: boolean;
  data: IndicatorData;
  metadata: {
    symbol: string;
    timeframe: string;
    tier: Tier;
    data_source: 'cache' | 'postgresql';
    cached: boolean;
    bars_returned: number;
    last_update: string;
    market_status: 'OPEN' | 'CLOSED';
    cache_ttl_seconds: number;
  };
  requestedAt: string;
}

interface ErrorResponse {
  success: boolean;
  error: string;
  message: string;
  tier?: Tier;
  accessibleSymbols?: readonly string[];
  accessibleTimeframes?: readonly string[];
  upgradeRequired?: boolean;
  upgradeUrl?: string;
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

const ALL_SYMBOLS = PRO_SYMBOLS;
const ALL_TIMEFRAMES = PRO_TIMEFRAMES;

function isValidSymbol(symbol: string): boolean {
  return ALL_SYMBOLS.includes(symbol as (typeof ALL_SYMBOLS)[number]);
}

function isValidTimeframe(timeframe: string): boolean {
  return ALL_TIMEFRAMES.includes(timeframe as (typeof ALL_TIMEFRAMES)[number]);
}

function canAccessSymbol(tier: Tier, symbol: string): boolean {
  if (tier === 'PRO') {
    return PRO_SYMBOLS.includes(symbol as (typeof PRO_SYMBOLS)[number]);
  }
  return FREE_SYMBOLS.includes(symbol as (typeof FREE_SYMBOLS)[number]);
}

function canAccessTimeframe(tier: Tier, timeframe: string): boolean {
  if (tier === 'PRO') {
    return PRO_TIMEFRAMES.includes(
      timeframe as (typeof PRO_TIMEFRAMES)[number]
    );
  }
  return FREE_TIMEFRAMES.includes(
    timeframe as (typeof FREE_TIMEFRAMES)[number]
  );
}

function getAccessibleSymbols(tier: Tier): readonly string[] {
  return tier === 'PRO' ? PRO_SYMBOLS : FREE_SYMBOLS;
}

function getAccessibleTimeframes(tier: Tier): readonly string[] {
  return tier === 'PRO' ? PRO_TIMEFRAMES : FREE_TIMEFRAMES;
}

// ============================================================================
// GET HANDLER
// ============================================================================

/**
 * GET /api/indicators/[symbol]/[timeframe]
 *
 * Fetches indicator data from PostgreSQL with Redis caching (57-column schema).
 * First checks cache, then falls back to PostgreSQL if cache miss.
 *
 * Query Parameters:
 * - bars: Number of bars to fetch (100-5000, default: 1000)
 *
 * Response includes 57-column database schema:
 * - System columns (8): timestamp, open, high, low, close, volume, timeframe, collected_at
 * - FREE tier indicators (16 columns): fractal_diagonal (8), fractal_horizontal (8)
 * - PRO tier indicators (33 columns): moving_averages (3), body_momentum (2), heiken_ashi (7),
 *   keltner_channels (10), support_resistance (8), zigzag (3)
 * - metadata.data_source: 'cache' or 'postgresql'
 * - metadata.cached: true if served from cache
 *
 * @example Request:
 * GET /api/indicators/XAUUSD/H1?bars=500
 *
 * @example Response (success - PRO tier):
 * {
 *   "success": true,
 *   "data": {
 *     "timestamp": 1705324800,
 *     "open": 43265, "high": 43300, "low": 43200, "close": 43280,
 *     "volume": 12500,
 *     "timeframe": "H1",
 *     "collected_at": 1705324850,
 *     "diag_asc_line_1": 43200,     // FREE tier
 *     "horiz_peak_line_1": 43300,   // FREE tier
 *     "tema": 43260,                 // PRO tier
 *     "kc_ultra_extreme_upper": 43400, // PRO tier
 *     "zigzag_peak": 43500,          // PRO tier
 *     ... (total 57 columns for PRO, 24 for FREE)
 *   },
 *   "metadata": {
 *     "symbol": "XAUUSD",
 *     "timeframe": "H1",
 *     "tier": "PRO",
 *     "data_source": "cache",
 *     "cached": true,
 *     "bars_returned": 500,
 *     "cache_ttl_seconds": 30
 *   }
 * }
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    // ─────────────────────────────────────────────────────────
    // STEP 1: Authentication Check
    // ─────────────────────────────────────────────────────────
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

    // ─────────────────────────────────────────────────────────
    // STEP 2: Extract Parameters
    // ─────────────────────────────────────────────────────────
    const { symbol, timeframe } = await params;
    const upperSymbol = symbol.toUpperCase();
    const upperTimeframe = timeframe.toUpperCase();

    const { searchParams } = new URL(request.url);
    const barsParam = searchParams.get('bars');
    const bars = barsParam
      ? Math.min(Math.max(parseInt(barsParam, 10) || 1000, 100), 5000)
      : 1000;

    // ─────────────────────────────────────────────────────────
    // STEP 3: Validate Symbol
    // ─────────────────────────────────────────────────────────
    if (!isValidSymbol(upperSymbol)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid symbol',
          message: `Symbol ${upperSymbol} is not a valid trading symbol. Valid symbols: ${ALL_SYMBOLS.join(', ')}`,
        } as ErrorResponse,
        { status: 400 }
      );
    }

    // ─────────────────────────────────────────────────────────
    // STEP 4: Validate Timeframe
    // ─────────────────────────────────────────────────────────
    if (!isValidTimeframe(upperTimeframe)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid timeframe',
          message: `Timeframe ${upperTimeframe} is not valid. Valid timeframes: ${ALL_TIMEFRAMES.join(', ')}`,
        } as ErrorResponse,
        { status: 400 }
      );
    }

    // ─────────────────────────────────────────────────────────
    // STEP 5: Get User Tier
    // ─────────────────────────────────────────────────────────
    const userTier = (session.user.tier as Tier) || 'FREE';

    // ─────────────────────────────────────────────────────────
    // STEP 6: Validate Tier Access - Symbol
    // ─────────────────────────────────────────────────────────
    if (!canAccessSymbol(userTier, upperSymbol)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Tier restriction',
          message: `FREE tier cannot access ${upperSymbol}. Upgrade to PRO for access to all 15 symbols.`,
          tier: userTier,
          accessibleSymbols: getAccessibleSymbols(userTier),
          upgradeRequired: true,
          upgradeUrl: '/pricing',
        } as ErrorResponse,
        { status: 403 }
      );
    }

    // ─────────────────────────────────────────────────────────
    // STEP 7: Validate Tier Access - Timeframe
    // ─────────────────────────────────────────────────────────
    if (!canAccessTimeframe(userTier, upperTimeframe)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Tier restriction',
          message: `FREE tier cannot access ${upperTimeframe} timeframe. Upgrade to PRO for access to all 9 timeframes.`,
          tier: userTier,
          accessibleTimeframes: getAccessibleTimeframes(userTier),
          upgradeRequired: true,
          upgradeUrl: '/pricing',
        } as ErrorResponse,
        { status: 403 }
      );
    }

    // ─────────────────────────────────────────────────────────
    // STEP 8: Fetch Data (Cache-Through Pattern)
    // ─────────────────────────────────────────────────────────
    const result: CachedIndicatorResult = await getIndicatorDataCached(
      upperSymbol,
      upperTimeframe,
      bars
    );

    // ─────────────────────────────────────────────────────────
    // STEP 9: Get Market Status
    // ─────────────────────────────────────────────────────────
    const marketOpen = isMarketOpen(upperSymbol);

    // ─────────────────────────────────────────────────────────
    // STEP 10: Build Response
    // ─────────────────────────────────────────────────────────
    const response: IndicatorDataResponse = {
      success: true,
      data: result.data,
      metadata: {
        symbol: upperSymbol,
        timeframe: upperTimeframe,
        tier: userTier,
        data_source: result.dataSource,
        cached: result.cached,
        bars_returned: result.data.ohlc?.length || 0,
        last_update: new Date().toISOString(),
        market_status: marketOpen ? 'OPEN' : 'CLOSED',
        cache_ttl_seconds: INDICATOR_CACHE_TTL,
      },
      requestedAt: new Date().toISOString(),
    };

    return NextResponse.json(response, {
      status: 200,
      headers: {
        'X-Cache': result.cached ? 'HIT' : 'MISS',
        'X-Data-Source': result.dataSource,
        'Cache-Control': `private, max-age=${INDICATOR_CACHE_TTL}`,
      },
    });
  } catch (error) {
    // ─────────────────────────────────────────────────────────
    // Error Handling
    // ─────────────────────────────────────────────────────────
    console.error('GET /api/indicators/[symbol]/[timeframe] error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });

    // Handle database connection errors
    if (error instanceof Error) {
      const isDbError =
        error.message.includes('ECONNREFUSED') ||
        error.message.includes('Connection') ||
        error.message.includes('timeout') ||
        error.message.includes('relation') ||
        error.message.includes('does not exist');

      if (isDbError) {
        return NextResponse.json(
          {
            success: false,
            error: 'Database unavailable',
            message:
              'Unable to connect to the database. Please try again in a few moments.',
          } as ErrorResponse,
          { status: 503 }
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
