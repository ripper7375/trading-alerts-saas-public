/**
 * Timeframes API Route
 *
 * Part 20 - Phase 04: Next.js API Routes
 *
 * GET /api/timeframes
 * Returns list of timeframes accessible by the user's tier.
 *
 * @module app/api/timeframes/route
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth/auth-options';
import type { TimeframesResponse } from '@/lib/indicators/types';
import type { Tier } from '@/lib/tier-config';
import { getAccessibleTimeframes } from '@/lib/tier/validation';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET HANDLER
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * GET /api/timeframes
 *
 * Returns timeframes accessible by the authenticated user's tier.
 *
 * @returns 200: List of accessible timeframes
 * @returns 401: Unauthorized
 *
 * @example Response (FREE tier):
 * {
 *   "success": true,
 *   "tier": "FREE",
 *   "timeframes": ["H1", "H4", "D1"],
 *   "total_count": 3
 * }
 *
 * @example Response (PRO tier):
 * {
 *   "success": true,
 *   "tier": "PRO",
 *   "timeframes": ["M5", "M15", "M30", "H1", "H2", "H4", "H8", "H12", "D1"],
 *   "total_count": 9
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
          message: 'You must be logged in to access timeframes',
        },
        { status: 401 }
      );
    }

    // Get user tier
    const userTier = (session.user.tier as Tier) || 'FREE';

    // Get accessible timeframes for tier
    const timeframes = getAccessibleTimeframes(userTier);

    const response: TimeframesResponse = {
      success: true,
      tier: userTier,
      timeframes: [...timeframes],
      total_count: timeframes.length,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('[Timeframes API] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: 'Failed to retrieve timeframes',
      },
      { status: 500 }
    );
  }
}
