/**
 * Part 20 - Phase 04e: Timeframes API Route
 *
 * GET /api/timeframes
 * Returns list of timeframes accessible by the authenticated user's tier.
 * Uses the Phase 04c tier validation utilities.
 *
 * @see docs/sqlite-and-mt5service/part-20-sqlite-sync-postgresql-openapi.yaml
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth/auth-options';
import { getAccessibleTimeframes, type Tier } from '@/lib/tier/validation';

interface TimeframesResponse {
  success: boolean;
  tier: Tier;
  timeframes: readonly string[];
  total_count: number;
}

interface ErrorResponse {
  success: boolean;
  error: string;
  message: string;
}

/**
 * GET /api/timeframes
 *
 * Returns list of timeframes accessible by the requesting user's tier.
 *
 * @returns 200: List of accessible timeframes
 * @returns 401: Unauthorized (not logged in)
 * @returns 500: Internal server error
 *
 * @example Response (FREE tier):
 * {
 *   "success": true,
 *   "tier": "FREE",
 *   "timeframes": ["H1", "H4", "D1"],
 *   "total_count": 3
 * }
 */
export async function GET(): Promise<NextResponse> {
  try {
    // Get user session
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Unauthorized',
        message: 'You must be logged in to view available timeframes',
      };
      return NextResponse.json(errorResponse, { status: 401 });
    }

    // Get user tier (default to FREE if not set)
    const userTier = (session.user.tier as Tier) || 'FREE';

    // Get accessible timeframes for user's tier
    const timeframes = getAccessibleTimeframes(userTier);

    const response: TimeframesResponse = {
      success: true,
      tier: userTier,
      timeframes,
      total_count: timeframes.length,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('GET /api/timeframes error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });

    const errorResponse: ErrorResponse = {
      success: false,
      error: 'Failed to fetch timeframes',
      message:
        'An error occurred while fetching available timeframes. Please try again.',
    };

    return NextResponse.json(errorResponse, { status: 500 });
  }
}
