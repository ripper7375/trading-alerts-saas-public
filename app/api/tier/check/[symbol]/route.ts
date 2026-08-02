/**
 * Symbol Access Check API Route — V8 single-symbol architecture
 *
 * GET /api/tier/check/[symbol]
 * Access is tier-independent: XAUUSD is allowed for everyone,
 * anything else is not a valid platform symbol.
 *
 * @module app/api/tier/check/[symbol]/route
 */

import { type NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth/auth-options';
import { shouldUseOperationServiceForTier } from '@/lib/operation-service/flags';
import {
  forwardRequestToOperationService,
  OperationServiceError,
} from '@/lib/operation-service/write-routes';
import { SYMBOLS } from '@/lib/tier-config';
import type { Tier } from '@/types/tier';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface AccessCheckResponse {
  success: boolean;
  symbol: string;
  allowed: boolean;
  tier: Tier;
  reason?: string;
  accessibleSymbols?: readonly string[];
}

interface RouteParams {
  params: Promise<{
    symbol: string;
  }>;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET HANDLER
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * GET /api/tier/check/[symbol]
 *
 * V8: returns allowed=true only for XAUUSD, regardless of tier.
 * Unknown symbols return allowed=false (no upgrade prompt — no tier
 * unlocks additional symbols anymore).
 *
 * @returns 200: Access check result
 * @returns 401: Unauthorized (not logged in)
 * @returns 500: Internal server error
 *
 * @example Response (allowed):
 * {
 *   "success": true,
 *   "symbol": "XAUUSD",
 *   "allowed": true,
 *   "tier": "FREE"
 * }
 *
 * @example Response (denied):
 * {
 *   "success": true,
 *   "symbol": "EURUSD",
 *   "allowed": false,
 *   "tier": "PRO",
 *   "reason": "Symbol EURUSD is not supported. This platform provides XAUUSD data only.",
 *   "accessibleSymbols": ["XAUUSD"]
 * }
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
          message: 'You must be logged in to check symbol access',
        },
        { status: 401 }
      );
    }

    const { symbol } = await params;

    // Session 4B-10: when the flag is on, operation-service's
    // TierController (Session 4B-10 PORT) already re-implements the logic
    // below against the same lib/tier-config.ts constants — forward instead.
    if (shouldUseOperationServiceForTier()) {
      const { status: opStatus, body } = await forwardRequestToOperationService(
        request,
        `/tier/check/${symbol}`
      );
      return NextResponse.json(body, { status: opStatus });
    }

    const upperSymbol = symbol.toUpperCase();
    const userTier = (session.user.tier as Tier) || 'FREE';

    const allowed = (SYMBOLS as readonly string[]).includes(upperSymbol);

    const response: AccessCheckResponse = {
      success: true,
      symbol: upperSymbol,
      allowed,
      tier: userTier,
    };

    if (!allowed) {
      response.reason = `Symbol ${upperSymbol} is not supported. This platform provides XAUUSD data only.`;
      response.accessibleSymbols = SYMBOLS;
    }

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    if (error instanceof OperationServiceError) {
      return NextResponse.json(error.body, { status: error.status });
    }
    console.error('GET /api/tier/check/[symbol] error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to check symbol access',
        message:
          'An error occurred while checking symbol access. Please try again.',
      },
      { status: 500 }
    );
  }
}
