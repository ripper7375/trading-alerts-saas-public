/**
 * Symbol Access Check API Route
 *
 * GET /api/tier/check/[symbol]
 * Check if user's tier can access a specific symbol.
 *
 * @module app/api/tier/check/[symbol]/route
 */

import { type NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth/auth-options';
import { FREE_SYMBOLS, PRO_SYMBOLS } from '@/lib/tier-config';
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
  upgradeRequired?: boolean;
  accessibleSymbols?: readonly string[];
}

interface RouteParams {
  params: Promise<{
    symbol: string;
  }>;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HELPER FUNCTIONS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Check if a symbol is valid (exists in PRO tier list)
 */
function isValidSymbol(symbol: string): boolean {
  return PRO_SYMBOLS.includes(symbol as (typeof PRO_SYMBOLS)[number]);
}

/**
 * Check if tier can access a symbol
 */
function canAccessSymbol(tier: Tier, symbol: string): boolean {
  if (tier === 'PRO') {
    return PRO_SYMBOLS.includes(symbol as (typeof PRO_SYMBOLS)[number]);
  }
  return FREE_SYMBOLS.includes(symbol as (typeof FREE_SYMBOLS)[number]);
}

/**
 * Get symbols accessible by tier
 */
function getAccessibleSymbols(tier: Tier): readonly string[] {
  return tier === 'PRO' ? PRO_SYMBOLS : FREE_SYMBOLS;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET HANDLER
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * GET /api/tier/check/[symbol]
 *
 * Check if the authenticated user's tier can access a specific symbol.
 *
 * @param request - Next.js request object
 * @param params - Route parameters containing symbol
 * @returns 200: Access check result
 * @returns 400: Invalid symbol
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
 *   "symbol": "AUDJPY",
 *   "allowed": false,
 *   "tier": "FREE",
 *   "reason": "FREE tier cannot access AUDJPY. Upgrade to PRO for access.",
 *   "upgradeRequired": true,
 *   "accessibleSymbols": ["BTCUSD", "EURUSD", "USDJPY", "US30", "XAUUSD"]
 * }
 */
export async function GET(
  _request: NextRequest,
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
          message: 'You must be logged in to check symbol access',
        },
        { status: 401 }
      );
    }

    //───────────────────────────────────────────────────────
    // STEP 2: Get Symbol from Params
    //───────────────────────────────────────────────────────
    const { symbol } = await params;
    const upperSymbol = symbol.toUpperCase();

    //───────────────────────────────────────────────────────
    // STEP 3: Validate Symbol
    //───────────────────────────────────────────────────────
    if (!isValidSymbol(upperSymbol)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid symbol',
          message: `Symbol ${upperSymbol} is not a valid trading symbol. Available symbols: ${PRO_SYMBOLS.join(', ')}`,
        },
        { status: 400 }
      );
    }

    //───────────────────────────────────────────────────────
    // STEP 4: Get User Tier
    //───────────────────────────────────────────────────────
    const userTier = (session.user.tier as Tier) || 'FREE';

    //───────────────────────────────────────────────────────
    // STEP 5: Check Access
    //───────────────────────────────────────────────────────
    const allowed = canAccessSymbol(userTier, upperSymbol);

    //───────────────────────────────────────────────────────
    // STEP 6: Build Response
    //───────────────────────────────────────────────────────
    const response: AccessCheckResponse = {
      success: true,
      symbol: upperSymbol,
      allowed,
      tier: userTier,
    };

    if (!allowed) {
      response.reason = `FREE tier cannot access ${upperSymbol}. Upgrade to PRO for access to all 15 symbols.`;
      response.upgradeRequired = true;
      response.accessibleSymbols = getAccessibleSymbols(userTier);
    }

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    //───────────────────────────────────────────────────────
    // Error Handling
    //───────────────────────────────────────────────────────
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
