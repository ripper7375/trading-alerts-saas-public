/**
 * Code Inventory Report API Route
 *
 * GET /api/affiliate/dashboard/code-inventory
 * Returns code inventory report for the current period.
 *
 * @module app/api/affiliate/dashboard/code-inventory/route
 */

import { NextRequest, NextResponse } from 'next/server';

import { requireAffiliate, getAffiliateProfile } from '@/lib/auth/session';
import { buildCodeInventoryReport } from '@/lib/affiliate/report-builder';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET /api/affiliate/dashboard/code-inventory
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Get code inventory report
 *
 * Returns:
 * - Opening balance
 * - Additions (monthly, initial, bonus)
 * - Reductions (used, expired, cancelled)
 * - Closing balance
 *
 * Query params:
 * - startDate: Period start date (default: 30 days ago)
 * - endDate: Period end date (default: today)
 *
 * @param request - Next.js request with optional date params
 * @returns JSON response with inventory report
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
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

    // Parse date range from query params
    const searchParams = request.nextUrl.searchParams;
    const endDateParam = searchParams.get('endDate');
    const startDateParam = searchParams.get('startDate');

    const endDate = endDateParam ? new Date(endDateParam) : new Date();
    const startDate = startDateParam
      ? new Date(startDateParam)
      : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Validate dates
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json(
        {
          error: 'Invalid dates',
          message: 'Invalid start or end date format',
          code: 'INVALID_DATES',
        },
        { status: 400 }
      );
    }

    // Build inventory report
    const report = await buildCodeInventoryReport(profile.id, {
      start: startDate,
      end: endDate,
    });

    return NextResponse.json(report);
  } catch (error) {
    console.error('[Code Inventory] Error:', error);

    if (error instanceof Error) {
      if (error.message.includes('AFFILIATE_REQUIRED')) {
        return NextResponse.json(
          {
            error: 'Forbidden',
            message: 'Affiliate access required',
            code: 'AFFILIATE_REQUIRED',
          },
          { status: 403 }
        );
      }

      if (error.message.includes('UNAUTHORIZED') || error.message === 'Unauthorized') {
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
        error: 'Failed to generate report',
        message: 'Unable to generate code inventory report',
        code: 'REPORT_ERROR',
      },
      { status: 500 }
    );
  }
}
