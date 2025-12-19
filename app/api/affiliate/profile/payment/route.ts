/**
 * Affiliate Payment Method API Route
 *
 * PUT /api/affiliate/profile/payment
 * Updates the affiliate's payment method and details.
 *
 * @module app/api/affiliate/profile/payment/route
 */

import { NextRequest, NextResponse } from 'next/server';

import { requireAffiliate, getAffiliateProfile } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { paymentMethodUpdateSchema } from '@/lib/affiliate/validators';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PUT /api/affiliate/profile/payment
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Update affiliate payment method
 *
 * @param request - Next.js request with payment data
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
    const validation = paymentMethodUpdateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          message: 'Invalid payment data',
          code: 'VALIDATION_ERROR',
          details: validation.error.errors,
        },
        { status: 400 }
      );
    }

    const { paymentMethod, paymentDetails } = validation.data;

    // Update payment method
    // Cast paymentDetails to satisfy Prisma's Json field type
    const updated = await prisma.affiliateProfile.update({
      where: { id: profile.id },
      data: {
        paymentMethod,
        paymentDetails: JSON.parse(JSON.stringify(paymentDetails)),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Payment method updated successfully',
      paymentMethod: updated.paymentMethod,
    });
  } catch (error) {
    console.error('[Payment Update] Error:', error);

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
        error: 'Failed to update payment',
        message: 'Unable to update payment method',
        code: 'PAYMENT_UPDATE_ERROR',
      },
      { status: 500 }
    );
  }
}
