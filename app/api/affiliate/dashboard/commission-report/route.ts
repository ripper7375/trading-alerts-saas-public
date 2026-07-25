/**
 * Commission Report API Route
 *
 * GET /api/affiliate/dashboard/commission-report
 * Returns paginated list of commissions with summary.
 *
 * @module app/api/affiliate/dashboard/commission-report/route
 */

import { NextRequest, NextResponse } from 'next/server';

import { requireAffiliate, getAffiliateProfile } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { buildCommissionSummary } from '@/lib/affiliate/report-builder';
import { commissionReportQuerySchema } from '@/lib/affiliate/validators';
import { MoneyServiceError } from '@/lib/money-service/client';
import { isAffiliateReadApiMigrated } from '@/lib/money-service/flags';
import {
  getMoneyServiceToken,
  fetchAffiliateDashboardCommissionReport,
} from '@/lib/money-service/routes';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET /api/affiliate/dashboard/commission-report
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Get commission report with summary and paginated list
 *
 * Query params:
 * - status: Filter by commission status
 * - startDate: Filter by earned date start
 * - endDate: Filter by earned date end
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20)
 *
 * @param request - Next.js request with query params
 * @returns JSON response with commissions and summary
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Require affiliate access
    await requireAffiliate();

    // Parse query params (also needed for the money-service branch below)
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);

    // Session 4A-7a (F45 server-side proxy) — see stats/route.ts's comment.
    if (isAffiliateReadApiMigrated()) {
      const token = await getMoneyServiceToken();
      if (token) {
        try {
          const report = await fetchAffiliateDashboardCommissionReport(token, {
            status: searchParams['status'],
            startDate: searchParams['startDate'],
            endDate: searchParams['endDate'],
            page: searchParams['page']
              ? Number(searchParams['page'])
              : undefined,
            limit: searchParams['limit']
              ? Number(searchParams['limit'])
              : undefined,
          });
          return NextResponse.json(report);
        } catch (error) {
          if (error instanceof MoneyServiceError) {
            return NextResponse.json(error.body, { status: error.status });
          }
          throw error;
        }
      }
    }

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

    // Validate query params
    const validation = commissionReportQuerySchema.safeParse(searchParams);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          message: 'Invalid query parameters',
          code: 'VALIDATION_ERROR',
          details: validation.error.errors,
        },
        { status: 400 }
      );
    }

    const { page, limit, status, startDate, endDate } = validation.data;

    // Build where clause
    const where = {
      affiliateProfileId: profile.id,
      ...(status && { status }),
      ...((startDate || endDate) && {
        earnedAt: {
          ...(startDate && { gte: startDate }),
          ...(endDate && { lte: endDate }),
        },
      }),
    };

    // Fetch commissions and summary in parallel
    const [commissions, total, summary] = await Promise.all([
      prisma.commission.findMany({
        where,
        include: {
          affiliateCode: {
            select: {
              code: true,
              usedAt: true,
            },
          },
        },
        orderBy: { earnedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.commission.count({ where }),
      buildCommissionSummary(profile.id),
    ]);

    return NextResponse.json({
      summary,
      commissions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('[Commission Report] Error:', error);

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

      if (
        error.message.includes('UNAUTHORIZED') ||
        error.message === 'Unauthorized'
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
        error: 'Failed to generate report',
        message: 'Unable to generate commission report',
        code: 'REPORT_ERROR',
      },
      { status: 500 }
    );
  }
}
