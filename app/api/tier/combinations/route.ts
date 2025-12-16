/**
 * Tier Combinations API Route
 *
 * GET /api/tier/combinations
 * Returns all allowed symbol+timeframe combinations for the authenticated user's tier.
 *
 * @module app/api/tier/combinations/route
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth/auth-options';
import {
  FREE_SYMBOLS,
  FREE_TIMEFRAMES,
  PRO_SYMBOLS,
  PRO_TIMEFRAMES,
} from '@/lib/tier-config';
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
  upgrade?: {
    additionalSymbols: number;
    additionalTimeframes: number;
    additionalCombinations: number;
    message: string;
  };
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONSTANTS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Timeframe labels for display
 */
const TIMEFRAME_LABELS: Record<string, string> = {
  M5: '5 Minutes',
  M15: '15 Minutes',
  M30: '30 Minutes',
  H1: '1 Hour',
  H2: '2 Hours',
  H4: '4 Hours',
  H8: '8 Hours',
  H12: '12 Hours',
  D1: '1 Day',
};

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HELPER FUNCTIONS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Get symbols accessible by tier
 */
function getSymbolsForTier(tier: Tier): readonly string[] {
  return tier === 'PRO' ? PRO_SYMBOLS : FREE_SYMBOLS;
}

/**
 * Get timeframes accessible by tier
 */
function getTimeframesForTier(tier: Tier): readonly string[] {
  return tier === 'PRO' ? PRO_TIMEFRAMES : FREE_TIMEFRAMES;
}

/**
 * Generate all combinations for a tier
 */
function generateCombinations(tier: Tier): Combination[] {
  const symbols = getSymbolsForTier(tier);
  const timeframes = getTimeframesForTier(tier);

  const combinations: Combination[] = [];

  for (const symbol of symbols) {
    for (const timeframe of timeframes) {
      combinations.push({ symbol, timeframe });
    }
  }

  return combinations;
}

/**
 * Build timeframe info array with proOnly flag
 */
function buildTimeframeInfo(tier: Tier): TimeframeInfo[] {
  const accessibleTimeframes = getTimeframesForTier(tier);

  return [...PRO_TIMEFRAMES]
    .map((tf) => ({
      value: tf,
      label: TIMEFRAME_LABELS[tf] || tf,
      proOnly: !FREE_TIMEFRAMES.includes(
        tf as (typeof FREE_TIMEFRAMES)[number]
      ),
    }))
    .filter((tf) => accessibleTimeframes.includes(tf.value));
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET HANDLER
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * GET /api/tier/combinations
 *
 * Returns all allowed symbol+timeframe combinations for the authenticated user's tier.
 * Used by frontend to populate dropdowns and validate selections.
 *
 * @returns 200: List of allowed combinations with metadata
 * @returns 401: Unauthorized (not logged in)
 * @returns 500: Internal server error
 *
 * @example Response (FREE tier):
 * {
 *   "success": true,
 *   "tier": "FREE",
 *   "combinations": [
 *     { "symbol": "BTCUSD", "timeframe": "H1" },
 *     { "symbol": "BTCUSD", "timeframe": "H4" },
 *     ...
 *   ],
 *   "count": 15,
 *   "totalPossible": 135,
 *   "symbols": ["BTCUSD", "EURUSD", ...],
 *   "timeframes": [...],
 *   "limits": { "symbolCount": 5, "timeframeCount": 3, "totalCombinations": 15 },
 *   "upgrade": { ... }
 * }
 */
export async function GET(): Promise<NextResponse> {
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
          message: 'You must be logged in to view available combinations',
        },
        { status: 401 }
      );
    }

    //───────────────────────────────────────────────────────
    // STEP 2: Get User Tier
    //───────────────────────────────────────────────────────
    const userTier = (session.user.tier as Tier) || 'FREE';

    //───────────────────────────────────────────────────────
    // STEP 3: Generate Combinations
    //───────────────────────────────────────────────────────
    const combinations = generateCombinations(userTier);
    const symbols = getSymbolsForTier(userTier);
    const timeframes = buildTimeframeInfo(userTier);

    //───────────────────────────────────────────────────────
    // STEP 4: Calculate PRO Totals (for comparison)
    //───────────────────────────────────────────────────────
    const proCombinations = PRO_SYMBOLS.length * PRO_TIMEFRAMES.length;

    //───────────────────────────────────────────────────────
    // STEP 5: Build Response
    //───────────────────────────────────────────────────────
    const response: CombinationsResponse = {
      success: true,
      tier: userTier,
      combinations,
      count: combinations.length,
      totalPossible: proCombinations,
      symbols,
      timeframes,
      limits: {
        symbolCount: symbols.length,
        timeframeCount: timeframes.length,
        totalCombinations: combinations.length,
      },
    };

    //───────────────────────────────────────────────────────
    // STEP 6: Add Upgrade Info for FREE Users
    //───────────────────────────────────────────────────────
    if (userTier === 'FREE') {
      const additionalSymbols = PRO_SYMBOLS.length - FREE_SYMBOLS.length;
      const additionalTimeframes =
        PRO_TIMEFRAMES.length - FREE_TIMEFRAMES.length;
      const additionalCombinations = proCombinations - combinations.length;

      response.upgrade = {
        additionalSymbols,
        additionalTimeframes,
        additionalCombinations,
        message: `Upgrade to PRO for ${additionalSymbols} more symbols, ${additionalTimeframes} more timeframes, and ${additionalCombinations} more chart combinations.`,
      };
    }

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    //───────────────────────────────────────────────────────
    // Error Handling
    //───────────────────────────────────────────────────────
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
