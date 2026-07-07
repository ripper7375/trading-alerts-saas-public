/**
 * Tier Combinations API Route — V8 single-symbol architecture
 *
 * GET /api/tier/combinations
 * Returns the two supported combinations (XAUUSD × M5/M15), identical
 * for both tiers. No tier gating, no upgrade prompt — chart access is
 * no longer a tier differentiator.
 *
 * @module app/api/tier/combinations/route
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth/auth-options';
import { SYMBOLS, TIMEFRAMES } from '@/lib/tier-config';
import type { Tier } from '@/types/tier';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface Combination {
  symbol: string;
  timeframe: string;
}

interface TimeframeInfo {
  value: string;
  label: string;
  proOnly: boolean;
}

interface CombinationsResponse {
  success: boolean;
  tier: Tier;
  combinations: Combination[];
  count: number;
  totalPossible: number;
  symbols: readonly string[];
  timeframes: TimeframeInfo[];
  limits: {
    symbolCount: number;
    timeframeCount: number;
    totalCombinations: number;
  };
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONSTANTS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const TIMEFRAME_LABELS: Record<string, string> = {
  M5: '5 Minutes',
  M15: '15 Minutes',
};

/** The two supported combinations — XAUUSD × M5/M15 */
const COMBINATIONS: Combination[] = SYMBOLS.flatMap((symbol) =>
  TIMEFRAMES.map((timeframe) => ({ symbol, timeframe }))
);

const TIMEFRAMES_INFO: TimeframeInfo[] = TIMEFRAMES.map((tf) => ({
  value: tf,
  label: TIMEFRAME_LABELS[tf] || tf,
  proOnly: false, // V8: no PRO-only timeframes
}));

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET HANDLER
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * GET /api/tier/combinations
 *
 * @returns 200: The supported combinations with metadata
 * @returns 401: Unauthorized (not logged in)
 * @returns 500: Internal server error
 *
 * @example Response (any tier):
 * {
 *   "success": true,
 *   "tier": "PRO",
 *   "combinations": [
 *     { "symbol": "XAUUSD", "timeframe": "M5" },
 *     { "symbol": "XAUUSD", "timeframe": "M15" }
 *   ],
 *   "count": 2,
 *   "totalPossible": 2,
 *   "symbols": ["XAUUSD"],
 *   "timeframes": [...],
 *   "limits": { "symbolCount": 1, "timeframeCount": 2, "totalCombinations": 2 }
 * }
 */
export async function GET(): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
          message: 'You must be logged in to view available combinations',
        },
        { status: 401 }
      );
    }

    const userTier = (session.user.tier as Tier) || 'FREE';

    const response: CombinationsResponse = {
      success: true,
      tier: userTier,
      combinations: COMBINATIONS,
      count: COMBINATIONS.length,
      totalPossible: COMBINATIONS.length,
      symbols: SYMBOLS,
      timeframes: TIMEFRAMES_INFO,
      limits: {
        symbolCount: SYMBOLS.length,
        timeframeCount: TIMEFRAMES.length,
        totalCombinations: COMBINATIONS.length,
      },
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('GET /api/tier/combinations error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch combinations',
        message:
          'An error occurred while fetching available combinations. Please try again.',
      },
      { status: 500 }
    );
  }
}
