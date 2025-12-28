/**
 * Indicator Data API Route
 *
 * GET /api/indicators/[symbol]/[timeframe]
 * Fetches indicator data from Flask MT5 service with tier validation.
 * Includes PRO indicators (Keltner, TEMA, HRMA, SMMA, ZigZag, Momentum)
 * transformed to type-safe TypeScript types.
 *
 * Features:
 * - Tier-based rate limiting (60/hour FREE, 300/hour PRO)
 * - Timeframe-specific caching with smart TTL
 * - Tier-based indicator filtering
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
  getCachedIndicatorData,
  setCachedIndicatorData,
} from '@/lib/cache/cache-manager';
import {
  ERROR_DETAILS,
  ERROR_MESSAGES,
  HTTP_STATUS,
  isMT5AccessDeniedError,
  isMT5ServiceError,
} from '@/lib/constants/errors';
import {
  filterIndicatorData,
  getIndicatorUpgradeInfo,
} from '@/lib/indicator-filter';
import {
  checkTierRateLimit,
  getRateLimitHeaders,
  type RateLimitResult,
} from '@/lib/rate-limit';
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
  cached: boolean;
  requestedAt: string;
  upgrade?: {
    required: boolean;
    message: string;
    locked: string[];
    tier: 'PRO';
    pricing: {
      monthly: string;
      yearly: string;
      trial: string;
    };
  };
}

interface RateLimitErrorResponse {
  success: boolean;
  error: string;
  message: string;
  limit: number;
  remaining: number;
  reset: string;
  upgrade?: {
    tier: 'PRO';
    newLimit: number;
    price: string;
    trial: string;
  };
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
  let rateLimitResult: RateLimitResult | null = null;

  try {
    //───────────────────────────────────────────────────────
    // STEP 1: Authentication Check
    //───────────────────────────────────────────────────────
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        {
          success: false,
          error: ERROR_MESSAGES.UNAUTHORIZED,
          message: 'You must be logged in to fetch indicator data',
        } as ErrorResponse,
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }

    //───────────────────────────────────────────────────────
    // STEP 2: Get User Tier & Apply Rate Limiting
    //───────────────────────────────────────────────────────
    const userTier = (session.user.tier as Tier) || 'FREE';

    // Apply tier-specific rate limit (60/hour FREE, 300/hour PRO)
    rateLimitResult = await checkTierRateLimit(session.user.id, userTier);

    if (!rateLimitResult.success) {
      const rateLimitResponse: RateLimitErrorResponse = {
        success: false,
        error: ERROR_MESSAGES.RATE_LIMIT_EXCEEDED,
        message:
          userTier === 'FREE'
            ? 'Free tier: 60 requests per hour. Upgrade to Pro for 300 requests/hour.'
            : 'Pro tier: 300 requests per hour limit reached.',
        limit: rateLimitResult.limit,
        remaining: 0,
        reset: new Date(rateLimitResult.reset * 1000).toISOString(),
        upgrade:
          userTier === 'FREE'
            ? {
                tier: 'PRO',
                newLimit: 300,
                price: '$29/month or $290/year',
                trial: '7-day free trial available',
              }
            : undefined,
      };

      return NextResponse.json(rateLimitResponse, {
        status: HTTP_STATUS.TOO_MANY_REQUESTS,
        headers: getRateLimitHeaders(rateLimitResult),
      });
    }

    //───────────────────────────────────────────────────────
    // STEP 3: Extract Parameters
    //───────────────────────────────────────────────────────
    const { symbol, timeframe } = await params;
    const upperSymbol = symbol.toUpperCase();
    const upperTimeframe = timeframe.toUpperCase();

    // Get bars and indicators from query string
    const { searchParams } = new URL(request.url);
    const barsParam = searchParams.get('bars');
    const bars = barsParam
      ? Math.min(Math.max(parseInt(barsParam, 10) || 1000, 100), 5000)
      : 1000;
    const requestedIndicators =
      searchParams.get('indicators')?.split(',').filter(Boolean) || [];

    //───────────────────────────────────────────────────────
    // STEP 4: Validate Symbol
    //───────────────────────────────────────────────────────
    if (!isValidSymbol(upperSymbol)) {
      return NextResponse.json(
        {
          success: false,
          error: ERROR_MESSAGES.INVALID_SYMBOL,
          message: `Symbol ${upperSymbol} is not a valid trading symbol. Valid symbols: ${ALL_SYMBOLS.join(', ')}`,
        } as ErrorResponse,
        {
          status: HTTP_STATUS.BAD_REQUEST,
          headers: getRateLimitHeaders(rateLimitResult),
        }
      );
    }

    //───────────────────────────────────────────────────────
    // STEP 5: Validate Timeframe
    //───────────────────────────────────────────────────────
    if (!isValidTimeframe(upperTimeframe)) {
      return NextResponse.json(
        {
          success: false,
          error: ERROR_MESSAGES.INVALID_TIMEFRAME,
          message: `Timeframe ${upperTimeframe} is not valid. Valid timeframes: ${ALL_TIMEFRAMES.join(', ')}`,
        } as ErrorResponse,
        {
          status: HTTP_STATUS.BAD_REQUEST,
          headers: getRateLimitHeaders(rateLimitResult),
        }
      );
    }

    //───────────────────────────────────────────────────────
    // STEP 6: Validate Tier Access - Symbol
    //───────────────────────────────────────────────────────
    if (!canAccessSymbol(userTier, upperSymbol)) {
      const errorResponse: ErrorResponse = {
        success: false,
        error: ERROR_MESSAGES.TIER_RESTRICTION,
        message: `FREE tier cannot access ${upperSymbol}. Upgrade to PRO for access to all 15 symbols.`,
        tier: userTier,
        accessibleSymbols: getAccessibleSymbols(userTier),
        upgradeRequired: true,
        upgradeUrl: '/pricing',
      };

      return NextResponse.json(errorResponse, {
        status: HTTP_STATUS.FORBIDDEN,
        headers: getRateLimitHeaders(rateLimitResult),
      });
    }

    //───────────────────────────────────────────────────────
    // STEP 7: Validate Tier Access - Timeframe
    //───────────────────────────────────────────────────────
    if (!canAccessTimeframe(userTier, upperTimeframe)) {
      const errorResponse: ErrorResponse = {
        success: false,
        error: ERROR_MESSAGES.TIER_RESTRICTION,
        message: `FREE tier cannot access ${upperTimeframe} timeframe. Upgrade to PRO for access to all 9 timeframes.`,
        tier: userTier,
        accessibleTimeframes: getAccessibleTimeframes(userTier),
        upgradeRequired: true,
        upgradeUrl: '/pricing',
      };

      return NextResponse.json(errorResponse, {
        status: HTTP_STATUS.FORBIDDEN,
        headers: getRateLimitHeaders(rateLimitResult),
      });
    }

    //───────────────────────────────────────────────────────
    // STEP 8: Check Cache First
    //───────────────────────────────────────────────────────
    type CachedData = MT5IndicatorData & {
      proIndicatorsTransformed: ProIndicatorData;
      [key: string]: unknown;
    };

    const cachedData = await getCachedIndicatorData<CachedData>(
      upperSymbol,
      upperTimeframe
    );

    if (cachedData) {
      // Filter indicators based on tier for cached response
      const filteredData = filterIndicatorData(cachedData, userTier);

      // Generate upgrade info for FREE users
      const upgradeInfo =
        userTier === 'FREE' && requestedIndicators.length > 0
          ? getIndicatorUpgradeInfo(requestedIndicators, userTier)
          : null;

      const response: IndicatorDataResponse = {
        success: true,
        data: filteredData as CachedData,
        tier: userTier,
        cached: true,
        requestedAt: new Date().toISOString(),
        ...(upgradeInfo?.upgradeRequired && {
          upgrade: {
            required: true,
            message:
              upgradeInfo.upgradeMessage ||
              'Upgrade to Pro for all indicators.',
            locked: upgradeInfo.lockedIndicators,
            tier: 'PRO',
            pricing: {
              monthly: '$29',
              yearly: '$290',
              trial: '7 days free',
            },
          },
        }),
      };

      return NextResponse.json(response, {
        status: 200,
        headers: getRateLimitHeaders(rateLimitResult),
      });
    }

    //───────────────────────────────────────────────────────
    // STEP 9: Fetch Data from Flask MT5 Service
    //───────────────────────────────────────────────────────
    const data = await fetchIndicatorData(
      upperSymbol,
      upperTimeframe,
      userTier,
      bars
    );

    //───────────────────────────────────────────────────────
    // STEP 10: Transform PRO Indicators (null -> undefined)
    //───────────────────────────────────────────────────────
    const proIndicatorsTransformed = transformProIndicators(
      data.proIndicators,
      userTier
    );

    const fullData: CachedData = {
      ...data,
      proIndicatorsTransformed,
    };

    //───────────────────────────────────────────────────────
    // STEP 11: Cache the Data with Timeframe-Specific TTL
    //───────────────────────────────────────────────────────
    await setCachedIndicatorData(upperSymbol, upperTimeframe, fullData);

    //───────────────────────────────────────────────────────
    // STEP 12: Filter Indicators Based on Tier
    //───────────────────────────────────────────────────────
    const filteredData = filterIndicatorData(fullData, userTier);

    // Generate upgrade info for FREE users
    const upgradeInfo =
      userTier === 'FREE' && requestedIndicators.length > 0
        ? getIndicatorUpgradeInfo(requestedIndicators, userTier)
        : null;

    //───────────────────────────────────────────────────────
    // STEP 13: Return Response with Rate Limit Headers
    //───────────────────────────────────────────────────────
    const response: IndicatorDataResponse = {
      success: true,
      data: filteredData as CachedData,
      tier: userTier,
      cached: false,
      requestedAt: new Date().toISOString(),
      ...(upgradeInfo?.upgradeRequired && {
        upgrade: {
          required: true,
          message:
            upgradeInfo.upgradeMessage || 'Upgrade to Pro for all indicators.',
          locked: upgradeInfo.lockedIndicators,
          tier: 'PRO',
          pricing: {
            monthly: '$29',
            yearly: '$290',
            trial: '7 days free',
          },
        },
      }),
    };

    return NextResponse.json(response, {
      status: 200,
      headers: getRateLimitHeaders(rateLimitResult),
    });
  } catch (error) {
    //───────────────────────────────────────────────────────
    // Error Handling
    //───────────────────────────────────────────────────────

    const headers = rateLimitResult
      ? getRateLimitHeaders(rateLimitResult)
      : undefined;

    // Handle MT5 access denied errors
    // Use utility function for Jest mock compatibility
    if (
      error instanceof MT5AccessDeniedError ||
      isMT5AccessDeniedError(error)
    ) {
      const accessError = error as MT5AccessDeniedError;
      const errorResponse: ErrorResponse = {
        success: false,
        error: ERROR_MESSAGES.TIER_RESTRICTION,
        message: accessError.message,
        tier: accessError.tier,
        accessibleSymbols: accessError.accessibleSymbols,
        accessibleTimeframes: accessError.accessibleTimeframes,
        upgradeRequired: true,
        upgradeUrl: '/pricing',
      };

      return NextResponse.json(errorResponse, {
        status: HTTP_STATUS.FORBIDDEN,
        headers,
      });
    }

    // Handle MT5 service errors
    // Use utility function for Jest mock compatibility
    if (error instanceof MT5ServiceError || isMT5ServiceError(error)) {
      const mt5Error = error as MT5ServiceError;
      console.error('MT5 Service Error:', {
        statusCode: mt5Error.statusCode,
        message: mt5Error.message,
        responseBody: mt5Error.responseBody,
        timestamp: new Date().toISOString(),
      });

      return NextResponse.json(
        {
          success: false,
          error: ERROR_MESSAGES.MT5_SERVICE,
          message: ERROR_DETAILS.MT5_SERVICE_FAILURE,
        } as ErrorResponse,
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR, headers }
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
        error: ERROR_MESSAGES.INTERNAL_SERVER,
        message: ERROR_DETAILS.UNEXPECTED_ERROR,
      } as ErrorResponse,
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR, headers }
    );
  }
}
