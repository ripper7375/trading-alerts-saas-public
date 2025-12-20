/**
 * POST /api/payments/dlocal/validate-discount
 *
 * Validates a discount code for dLocal payments.
 *
 * Request Body:
 * - code: string (required) - The discount code to validate
 * - planType: 'THREE_DAY' | 'MONTHLY' (required) - The plan type
 *
 * Response:
 * - 200: { valid: boolean, discountPercent?: number, message?: string }
 * - 400: Invalid request
 * - 401: Unauthorized
 *
 * @module app/api/payments/dlocal/validate-discount/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

interface ValidateDiscountRequest {
  code: string;
  planType: 'THREE_DAY' | 'MONTHLY';
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Check authentication
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Parse request body
    const body: ValidateDiscountRequest = await request.json();
    const { code, planType } = body;

    // Validate required fields
    if (!code || typeof code !== 'string') {
      return NextResponse.json(
        { valid: false, message: 'Discount code is required' },
        { status: 400 }
      );
    }

    if (!planType || !['THREE_DAY', 'MONTHLY'].includes(planType)) {
      return NextResponse.json(
        { valid: false, message: 'Invalid plan type' },
        { status: 400 }
      );
    }

    // 3-day plan doesn't support discount codes
    if (planType === 'THREE_DAY') {
      return NextResponse.json({
        valid: false,
        message: 'Discount codes are not available for the 3-day plan',
      });
    }

    const normalizedCode = code.toUpperCase().trim();

    logger.info('Validating discount code', {
      code: normalizedCode,
      planType,
      userId: session.user.id,
    });

    // Look up the affiliate code in the database
    const affiliateCode = await prisma.affiliateCode.findFirst({
      where: {
        code: normalizedCode,
        status: 'ACTIVE',
      },
      include: {
        affiliateProfile: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    if (!affiliateCode) {
      logger.info('Discount code not found or inactive', { code: normalizedCode });
      return NextResponse.json({
        valid: false,
        message: 'Invalid or expired discount code',
      });
    }

    // Check if affiliate is active
    if (affiliateCode.affiliateProfile?.status !== 'ACTIVE') {
      logger.info('Affiliate not active', {
        code: normalizedCode,
        affiliateId: affiliateCode.affiliateProfileId,
      });
      return NextResponse.json({
        valid: false,
        message: 'This discount code is no longer valid',
      });
    }

    // Get discount percentage from system config or use default
    const discountPercent = 10; // Default 10% affiliate discount

    logger.info('Discount code validated successfully', {
      code: normalizedCode,
      discountPercent,
      userId: session.user.id,
    });

    return NextResponse.json({
      valid: true,
      discountPercent,
      message: `${discountPercent}% discount will be applied`,
    });
  } catch (error) {
    logger.error('Failed to validate discount code', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      { valid: false, message: 'Failed to validate discount code' },
      { status: 500 }
    );
  }
}
