/**
 * Symbols API Route
 *
 * Part 20 - Phase 04: Next.js API Routes
 *
 * GET /api/symbols
 * Returns list of symbols accessible by the user's tier.
 *
 * @module app/api/symbols/route
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth/auth-options';
import type { SymbolsResponse } from '@/lib/indicators/types';
import type { Tier } from '@/lib/tier-config';
import { getAccessibleSymbols } from '@/lib/tier/validation';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET HANDLER
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * GET /api/symbols
 *
 * Returns symbols accessible by the authenticated user's tier.
 *
 * @returns 200: List of accessible symbols
 * @returns 401: Unauthorized
 *
 * @example Response (FREE tier):
 * {
 *   "success": true,
 *   "tier": "FREE",
 *   "symbols": ["BTCUSD", "EURUSD", "USDJPY", "US30", "XAUUSD"],
 *   "total_count": 5
 * }
 *
 * @example Response (PRO tier):
 * {
 *   "success": true,
 *   "tier": "PRO",
 *   "symbols": ["AUDJPY", "AUDUSD", "BTCUSD", ...],
 *   "total_count": 15
 * }
 */
export async function GET(): Promise<NextResponse> {
  try {
    // Get session
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
          message: 'You must be logged in to access symbols',
        },
        { status: 401 }
      );
    }

    // Get user tier
    const userTier = (session.user.tier as Tier) || 'FREE';

    // Get accessible symbols for tier
    const symbols = getAccessibleSymbols(userTier);

    const response: SymbolsResponse = {
      success: true,
      tier: userTier,
      symbols: [...symbols],
      total_count: symbols.length,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('[Symbols API] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: 'Failed to retrieve symbols',
      },
      { status: 500 }
    );
  }
}
