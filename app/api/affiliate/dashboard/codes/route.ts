/**
 * Affiliate Codes List API Route
 *
 * GET /api/affiliate/dashboard/codes
 * Returns paginated list of affiliate codes.
 *
 * @module app/api/affiliate/dashboard/codes/route
 */

import { NextRequest, NextResponse } from 'next/server';

import { requireAffiliate, getAffiliateProfile } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { codesListQuerySchema } from '@/lib/affiliate/validators';
import { MoneyServiceError } from '@/lib/money-service/client';
import { isAffiliateReadApiMigrated } from '@/lib/money-service/flags';
import {
  getMoneyServiceToken,
  fetchAffiliateDashboardCodes,
} from '@/lib/money-service/routes';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET /api/affiliate/dashboard/codes
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Get paginated list of affiliate codes
 *
 * Query params:
 * - status: Filter by code status (ACTIVE, USED, EXPIRED, CANCELLED)
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20, max: 100)
 *
 * @param request - Next.js request with query params
 * @returns JSON response with paginated codes
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
          const codes = await fetchAffiliateDashboardCodes(token, {
            status: searchParams['status'],
            page: searchParams['page']
              ? Number(searchParams['page'])
              : undefined,
            limit: searchParams['limit']
              ? Number(searchParams['limit'])
              : undefined,
          });
          return NextResponse.json(codes);
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

    const validation = codesListQuerySchema.safeParse(searchParams);

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

    const { page, limit, status } = validation.data;

    // Build where clause
    const where = {
      affiliateProfileId: profile.id,
      ...(status && { status }),
    };

    // Fetch codes with pagination
    const [codes, total] = await Promise.all([
      prisma.affiliateCode.findMany({
        where,
        orderBy: { distributedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.affiliateCode.count({ where }),
    ]);

    return NextResponse.json({
      codes,
      total,
      page,
      limit,
    });
  } catch (error) {
    console.error('[Affiliate Codes] Error:', error);

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
        error: 'Failed to fetch codes',
        message: 'Unable to retrieve affiliate codes',
        code: 'CODES_ERROR',
      },
      { status: 500 }
    );
  }
}
