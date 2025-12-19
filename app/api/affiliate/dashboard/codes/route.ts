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

    // Parse query params
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
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
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
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
        error: 'Failed to fetch codes',
        message: 'Unable to retrieve affiliate codes',
        code: 'CODES_ERROR',
      },
      { status: 500 }
    );
  }
}
