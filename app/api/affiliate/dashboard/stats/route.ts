/**
 * Affiliate Dashboard Stats API Route
 *
 * GET /api/affiliate/dashboard/stats
 * Returns dashboard statistics for the authenticated affiliate.
 *
 * @module app/api/affiliate/dashboard/stats/route
 */

import { NextRequest, NextResponse } from 'next/server';

import { requireAffiliate, getAffiliateProfile } from '@/lib/auth/session';
import { buildDashboardStats } from '@/lib/affiliate/report-builder';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET /api/affiliate/dashboard/stats
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Get affiliate dashboard statistics
 *
 * Returns:
 * - Active/used/expired code counts
 * - Total earnings
 * - Pending/paid balances
 * - Conversion rate
 *
 * @returns JSON response with dashboard stats
 */
export async function GET(_request: NextRequest): Promise<NextResponse> {
  try {
    // Require affiliate access
    await requireAffiliate();

    // Get affiliate profile
    const profile = await getAffiliateProfile();

    if (!profile) {
      return NextResponse.json(
        {
          error: 'Profile not found',
          message: 'Affiliate profile not found',
          code: 'PROFILE_NOT_FOUND',
        },
        { status: 404 }
      );
    }

    // Build dashboard stats
    const stats = await buildDashboardStats(profile.id);

    return NextResponse.json(stats);
  } catch (error) {
    console.error('[Affiliate Stats] Error:', error);

    if (error instanceof Error) {
      if (
        error.message.includes('AFFILIATE_REQUIRED') ||
        error.message.includes('affiliate')
      ) {
        return NextResponse.json(
          {
            error: 'Forbidden',
            message: 'Affiliate access required',
            code: 'AFFILIATE_REQUIRED',
          },
          { status: 403 }
        );
      }

      if (
        error.message.includes('UNAUTHORIZED') ||
        error.message.includes('Unauthorized')
      ) {
        return NextResponse.json(
          {
            error: 'Unauthorized',
            message: 'Authentication required',
            code: 'UNAUTHORIZED',
          },
          { status: 401 }
        );
      }
    }

    return NextResponse.json(
      {
        error: 'Failed to fetch stats',
        message: 'Unable to retrieve dashboard statistics',
        code: 'STATS_ERROR',
      },
      { status: 500 }
    );
  }
}
