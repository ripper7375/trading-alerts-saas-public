/**
 * Affiliate Registration API Route
 *
 * POST /api/affiliate/auth/register
 * Registers the current user as an affiliate.
 *
 * @module app/api/affiliate/auth/register/route
 */

import { NextRequest, NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth/session';
import { registerAffiliate } from '@/lib/affiliate/registration';
import { affiliateRegistrationSchema } from '@/lib/affiliate/validators';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// POST /api/affiliate/auth/register
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Register current user as an affiliate
 *
 * Requires authenticated user who is not already an affiliate.
 * Creates AffiliateProfile and sends verification email.
 *
 * @param request - Next.js request with registration data
 * @returns JSON response with success status
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Require authentication
    const session = await requireAuth();

    // Check if already affiliate
    if (session.user?.isAffiliate) {
      return NextResponse.json(
        {
          error: 'Already registered',
          message: 'You are already registered as an affiliate',
          code: 'ALREADY_AFFILIATE',
        },
        { status: 409 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = affiliateRegistrationSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          message: 'Invalid registration data',
          code: 'VALIDATION_ERROR',
          details: validation.error.errors,
        },
        { status: 400 }
      );
    }

    const { fullName, country, paymentMethod, paymentDetails, ...socialUrls } =
      validation.data;

    // Register affiliate
    const result = await registerAffiliate({
      userId: session.user.id,
      fullName,
      country,
      paymentMethod,
      paymentDetails: paymentDetails as Record<string, unknown>,
      ...socialUrls,
    });

    return NextResponse.json(
      {
        success: result.success,
        message: result.message,
        profileId: result.profileId,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[Affiliate Register] Error:', error);

    // Handle specific errors
    if (error instanceof Error) {
      if (error.message === 'Already registered as affiliate') {
        return NextResponse.json(
          {
            error: 'Already registered',
            message: error.message,
            code: 'ALREADY_AFFILIATE',
          },
          { status: 409 }
        );
      }

      if (
        error.message.includes('Unauthorized') ||
        error.message.includes('UNAUTHORIZED')
      ) {
        return NextResponse.json(
          {
            error: 'Unauthorized',
            message: 'You must be logged in to register as an affiliate',
            code: 'UNAUTHORIZED',
          },
          { status: 401 }
        );
      }
    }

    return NextResponse.json(
      {
        error: 'Registration failed',
        message: 'Failed to register as affiliate. Please try again.',
        code: 'REGISTRATION_ERROR',
      },
      { status: 500 }
    );
  }
}
