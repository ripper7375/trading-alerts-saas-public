/**
 * Indicator Data API Route
 *
 * GET /api/indicators/[symbol]/[timeframe]
 * Fetches indicator data from Flask MT5 service with tier validation.
 * Includes PRO indicators (Keltner, TEMA, HRMA, SMMA, ZigZag, Momentum)
 * transformed to type-safe TypeScript types.
 *
 * @module app/api/indicators/[symbol]/[timeframe]/route
 */

import { type NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import {
  fetchIndicatorData,
  MT5AccessDeniedError,
  MT5ServiceError,
  type MT5IndicatorData,
} from '@/lib/api/mt5-client';
import { transformProIndicators } from '@/lib/api/mt5-transform';
import { authOptions } from '@/lib/auth/auth-options';
import {
  FREE_SYMBOLS,
  FREE_TIMEFRAMES,
  PRO_SYMBOLS,
  PRO_TIMEFRAMES,
} from '@/lib/tier-config';
import type { ProIndicatorData } from '@/types/indicator';
import type { Tier } from '@/types/tier';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface RouteParams {
  params: Promise<{
    symbol: string;
    timeframe: string;
  }>;
}

interface IndicatorDataResponse {
  success: boolean;
  data: MT5IndicatorData & {
    proIndicatorsTransformed: ProIndicatorData;
  };
  tier: Tier;
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

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// VALIDATION HELPERS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Valid symbols in the system
 */
const ALL_SYMBOLS = PRO_SYMBOLS;

/**
 * Valid timeframes in the system
 */
const ALL_TIMEFRAMES = PRO_TIMEFRAMES;

/**
 * Check if symbol is valid (exists in system)
 */
function isValidSymbol(symbol: string): boolean {
  return ALL_SYMBOLS.includes(symbol as (typeof ALL_SYMBOLS)[number]);
}

/**
 * Check if timeframe is valid (exists in system)
 */
function isValidTimeframe(timeframe: string): boolean {
  return ALL_TIMEFRAMES.includes(timeframe as (typeof ALL_TIMEFRAMES)[number]);
}

/**
 * Check if tier can access symbol
 */
function canAccessSymbol(tier: Tier, symbol: string): boolean {
  if (tier === 'PRO') {
    return PRO_SYMBOLS.includes(symbol as (typeof PRO_SYMBOLS)[number]);
  }
  return FREE_SYMBOLS.includes(symbol as (typeof FREE_SYMBOLS)[number]);
}

/**
 * Check if tier can access timeframe
 */
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

/**
 * Get accessible symbols for tier
 */
function getAccessibleSymbols(tier: Tier): readonly string[] {
  return tier === 'PRO' ? PRO_SYMBOLS : FREE_SYMBOLS;
}

/**
 * Get accessible timeframes for tier
 */
function getAccessibleTimeframes(tier: Tier): readonly string[] {
  return tier === 'PRO' ? PRO_TIMEFRAMES : FREE_TIMEFRAMES;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET HANDLER
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * GET /api/indicators/[symbol]/[timeframe]
 *
 * Fetches indicator data from Flask MT5 service.
 * Validates tier access before making the request.
 *
 * @param request - Next.js request object
 * @param params - Route parameters containing symbol and timeframe
 * @returns 200: Indicator data (OHLC, horizontal lines, diagonal lines, fractals)
 * @returns 400: Invalid symbol or timeframe
 * @returns 401: Unauthorized (not logged in)
 * @returns 403: Tier cannot access this symbol/timeframe
 * @returns 500: Internal server error or MT5 service error
 *
 * @example Request:
 * GET /api/indicators/XAUUSD/H1?bars=500
 *
 * @example Response (success):
 * {
 *   "success": true,
 *   "data": {
 *     "ohlc": [...],
 *     "horizontal": {...},
 *     "diagonal": {...},
 *     "fractals": {...},
 *     "metadata": {...}
 *   },
 *   "tier": "FREE",
 *   "requestedAt": "2025-12-09T12:00:00.000Z"
 * }
 *
 * @example Response (tier denied):
 * {
 *   "success": false,
 *   "error": "Tier restriction",
 *   "message": "FREE tier cannot access AUDJPY. Upgrade to PRO for access.",
 *   "tier": "FREE",
 *   "accessibleSymbols": ["BTCUSD", "EURUSD", ...],
 *   "upgradeRequired": true,
 *   "upgradeUrl": "/pricing"
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

    // Get bars parameter from query string (default: 1000)
    const { searchParams } = new URL(request.url);
    const barsParam = searchParams.get('bars');
    const bars = barsParam
      ? Math.min(Math.max(parseInt(barsParam, 10) || 1000, 100), 5000)
      : 1000;

    //───────────────────────────────────────────────────────
    // STEP 3: Validate Symbol
    //───────────────────────────────────────────────────────
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

    //───────────────────────────────────────────────────────
    // STEP 4: Validate Timeframe
    //───────────────────────────────────────────────────────
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

    //───────────────────────────────────────────────────────
    // STEP 5: Get User Tier
    //───────────────────────────────────────────────────────
    const userTier = (session.user.tier as Tier) || 'FREE';

    //───────────────────────────────────────────────────────
    // STEP 6: Validate Tier Access - Symbol
    //───────────────────────────────────────────────────────
    if (!canAccessSymbol(userTier, upperSymbol)) {
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Tier restriction',
        message: `FREE tier cannot access ${upperSymbol}. Upgrade to PRO for access to all 15 symbols.`,
        tier: userTier,
        accessibleSymbols: getAccessibleSymbols(userTier),
        upgradeRequired: true,
        upgradeUrl: '/pricing',
      };

      return NextResponse.json(errorResponse, { status: 403 });
    }

    //───────────────────────────────────────────────────────
    // STEP 7: Validate Tier Access - Timeframe
    //───────────────────────────────────────────────────────
    if (!canAccessTimeframe(userTier, upperTimeframe)) {
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Tier restriction',
        message: `FREE tier cannot access ${upperTimeframe} timeframe. Upgrade to PRO for access to all 9 timeframes.`,
        tier: userTier,
        accessibleTimeframes: getAccessibleTimeframes(userTier),
        upgradeRequired: true,
        upgradeUrl: '/pricing',
      };

      return NextResponse.json(errorResponse, { status: 403 });
    }

    //───────────────────────────────────────────────────────
    // STEP 8: Fetch Data from Flask MT5 Service
    //───────────────────────────────────────────────────────
    const data = await fetchIndicatorData(
      upperSymbol,
      upperTimeframe,
      userTier,
      bars
    );

    //───────────────────────────────────────────────────────
    // STEP 9: Transform PRO Indicators (null -> undefined)
    //───────────────────────────────────────────────────────
    const proIndicatorsTransformed = transformProIndicators(
      data.proIndicators,
      userTier
    );

    //───────────────────────────────────────────────────────
    // STEP 10: Return Response
    //───────────────────────────────────────────────────────
    const response: IndicatorDataResponse = {
      success: true,
      data: {
        ...data,
        proIndicatorsTransformed,
      },
      tier: userTier,
      requestedAt: new Date().toISOString(),
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    //───────────────────────────────────────────────────────
    // Error Handling
    //───────────────────────────────────────────────────────

    // Handle MT5 access denied errors
    if (error instanceof MT5AccessDeniedError) {
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Tier restriction',
        message: error.message,
        tier: error.tier,
        accessibleSymbols: error.accessibleSymbols,
        accessibleTimeframes: error.accessibleTimeframes,
        upgradeRequired: true,
        upgradeUrl: '/pricing',
      };

      return NextResponse.json(errorResponse, { status: 403 });
    }

    // Handle MT5 service errors
    if (error instanceof MT5ServiceError) {
      console.error('MT5 Service Error:', {
        statusCode: error.statusCode,
        message: error.message,
        responseBody: error.responseBody,
        timestamp: new Date().toISOString(),
      });

      return NextResponse.json(
        {
          success: false,
          error: 'MT5 service error',
          message:
            'Failed to fetch indicator data from MT5 service. Please try again later.',
        } as ErrorResponse,
        { status: 500 }
      );
    }

    // Handle unknown errors
    console.error('GET /api/indicators/[symbol]/[timeframe] error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });

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
