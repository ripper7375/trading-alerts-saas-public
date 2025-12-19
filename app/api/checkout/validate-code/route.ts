/**
 * Affiliate Code Validation API Route
 *
 * POST /api/checkout/validate-code
 * Validates an affiliate code for checkout.
 *
 * @module app/api/checkout/validate-code/route
 */

import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/db/prisma';
import { AFFILIATE_CONFIG } from '@/lib/affiliate/constants';
import { affiliateCodeSchema } from '@/lib/affiliate/validators';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// POST /api/checkout/validate-code
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Validate affiliate code for checkout
 *
 * Checks:
 * - Code exists
 * - Code is active
 * - Code is not expired
 * - Affiliate is active
 *
 * @param request - Next.js request with code
 * @returns JSON response with validation result and discount info
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Parse request body
    const body = await request.json();
    const { code } = body;

    if (!code) {
      return NextResponse.json(
        {
          valid: false,
          error: 'Code required',
          message: 'Please provide an affiliate code',
          code: 'CODE_REQUIRED',
        },
        { status: 400 }
      );
    }

    // Validate code format
    const validation = affiliateCodeSchema.safeParse(code);
    if (!validation.success) {
      return NextResponse.json(
        {
          valid: false,
          error: 'Invalid code format',
          message: 'Code must be 8 alphanumeric characters',
          code: 'INVALID_FORMAT',
        },
        { status: 400 }
      );
    }

    const normalizedCode = validation.data;

    // Find affiliate code
    const affiliateCode = await prisma.affiliateCode.findUnique({
      where: { code: normalizedCode },
      include: {
        affiliateProfile: {
          select: {
            id: true,
            status: true,
            fullName: true,
          },
        },
      },
    });

    // Check if code exists
    if (!affiliateCode) {
      return NextResponse.json(
        {
          valid: false,
          error: 'Invalid code',
          message: 'This affiliate code does not exist',
          code: 'CODE_NOT_FOUND',
        },
        { status: 404 }
      );
    }

    // Check if code is active
    if (affiliateCode.status !== 'ACTIVE') {
      const statusMessages = {
        USED: 'This code has already been used',
        EXPIRED: 'This code has expired',
        CANCELLED: 'This code has been cancelled',
      };

      return NextResponse.json(
        {
          valid: false,
          error: 'Code not active',
          message:
            statusMessages[
              affiliateCode.status as keyof typeof statusMessages
            ] || 'This code is not active',
          code: 'CODE_NOT_ACTIVE',
        },
        { status: 400 }
      );
    }

    // Check if code is expired
    if (affiliateCode.expiresAt < new Date()) {
      return NextResponse.json(
        {
          valid: false,
          error: 'Code expired',
          message: 'This affiliate code has expired',
          code: 'CODE_EXPIRED',
        },
        { status: 400 }
      );
    }

    // Check if affiliate is active
    if (affiliateCode.affiliateProfile.status !== 'ACTIVE') {
      return NextResponse.json(
        {
          valid: false,
          error: 'Affiliate inactive',
          message: 'This affiliate is not currently active',
          code: 'AFFILIATE_INACTIVE',
        },
        { status: 400 }
      );
    }

    // Calculate discount
    const discountPercent = affiliateCode.discountPercent;
    const regularPrice = AFFILIATE_CONFIG.BASE_PRICE_USD;
    const discountAmount = (regularPrice * discountPercent) / 100;
    const finalPrice = regularPrice - discountAmount;

    return NextResponse.json({
      valid: true,
      code: affiliateCode.code,
      affiliateId: affiliateCode.affiliateProfileId,
      discount: {
        percent: discountPercent,
        amount: discountAmount,
        regularPrice,
        finalPrice,
      },
      message: `${discountPercent}% discount will be applied!`,
    });
  } catch (error) {
    console.error('[Validate Code] Error:', error);

    return NextResponse.json(
      {
        valid: false,
        error: 'Validation failed',
        message: 'Failed to validate affiliate code',
        code: 'VALIDATION_ERROR',
      },
      { status: 500 }
    );
  }
}
