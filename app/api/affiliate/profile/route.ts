/**
 * Affiliate Profile API Route
 *
 * GET /api/affiliate/profile - Get current affiliate profile
 * PUT /api/affiliate/profile - Update profile details
 *
 * @module app/api/affiliate/profile/route
 */

import { NextRequest, NextResponse } from 'next/server';

import { requireAffiliate, getAffiliateProfile } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { affiliateProfileUpdateSchema } from '@/lib/affiliate/validators';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET /api/affiliate/profile
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Get current affiliate profile
 *
 * @returns JSON response with affiliate profile
 */
export async function GET(_request: NextRequest): Promise<NextResponse> {
  try {
    await requireAffiliate();
    const profile = await getAffiliateProfile();

    if (!profile) {
      const session = await requireAffiliate();
      const baseCode = (
        session.user.name ||
        session.user.email?.split('@')[0] ||
        'AFF'
      )
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 6);
      const code = `${baseCode}${Math.floor(100 + Math.random() * 900)}`;

      const created = await prisma.affiliateProfile.upsert({
        where: { userId: session.user.id },
        update: { status: 'ACTIVE' },
        create: {
          userId: session.user.id,
          fullName: session.user.name || 'Affiliate Partner',
          country: 'US',
          paymentMethod: 'PAYPAL',
          paymentDetails: {},
          status: 'ACTIVE',
          verifiedAt: new Date(),
          affiliateCodes: {
            create: {
              code,
              discountPercent: 10,
              commissionPercent: 15,
              status: 'ACTIVE',
              expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            },
          },
        },
      });

      return NextResponse.json({
        ...created,
        totalEarnings: Number(created.totalEarnings ?? 0),
        pendingCommissions: Number(created.pendingCommissions ?? 0),
        paidCommissions: Number(created.paidCommissions ?? 0),
      });
    }

    return NextResponse.json(profile);
  } catch (error) {
    console.error('[Affiliate Profile GET] Error:', error);

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

      if (error.message.includes('UNAUTHORIZED')) {
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
        error: 'Failed to fetch profile',
        message: 'Unable to retrieve affiliate profile',
        code: 'PROFILE_ERROR',
      },
      { status: 500 }
    );
  }
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PUT /api/affiliate/profile
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Update affiliate profile
 *
 * @param request - Next.js request with update data
 * @returns JSON response with updated profile
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    await requireAffiliate();
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

    // Parse and validate request body
    const body = await request.json();
    const validation = affiliateProfileUpdateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          message: 'Invalid profile data',
          code: 'VALIDATION_ERROR',
          details: validation.error.errors,
        },
        { status: 400 }
      );
    }

    // Update profile
    const updated = await prisma.affiliateProfile.upsert({
      where: { userId: profile.userId },
      update: validation.data,
      create: {
        userId: profile.userId,
        fullName:
          validation.data.fullName || profile.fullName || 'Affiliate Partner',
        country: validation.data.country || profile.country || 'US',
        paymentMethod: 'PAYPAL',
        paymentDetails: {},
        status: 'ACTIVE',
        ...validation.data,
      },
    });

    return NextResponse.json({
      ...updated,
      totalEarnings: Number(updated.totalEarnings ?? 0),
      pendingCommissions: Number(updated.pendingCommissions ?? 0),
      paidCommissions: Number(updated.paidCommissions ?? 0),
    });
  } catch (error) {
    console.error('[Affiliate Profile PUT] Error:', error);

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

      if (error.message.includes('UNAUTHORIZED')) {
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
        error: 'Failed to update profile',
        message: 'Unable to update affiliate profile',
        code: 'UPDATE_ERROR',
      },
      { status: 500 }
    );
  }
}

export const PATCH = PUT;
