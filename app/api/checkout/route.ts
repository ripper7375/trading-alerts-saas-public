/**
 * Checkout API Route
 *
 * POST /api/checkout
 * Creates a Stripe Checkout session for PRO tier upgrade.
 *
 * @module app/api/checkout/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth/auth-options';
import {
  buildCheckoutIdempotencyKey,
  createCheckoutSession,
} from '@/lib/stripe/stripe';
import { prisma } from '@/lib/db/prisma';
import { shouldUseMoneyServiceForStripeWrite } from '@/lib/money-service/flags';
import {
  forwardWriteRequestToMoneyService,
  MoneyServiceError,
} from '@/lib/money-service/write-routes';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// POST /api/checkout
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Create Stripe Checkout session for PRO upgrade
 *
 * @param request - Next.js request object
 * @returns JSON response with checkout session URL or error
 *
 * @example Response (success):
 * {
 *   "sessionId": "cs_xxx",
 *   "url": "https://checkout.stripe.com/pay/cs_xxx"
 * }
 *
 * @example Response (error):
 * {
 *   "error": "Already subscribed",
 *   "message": "You are already on the PRO tier",
 *   "code": "ALREADY_PRO"
 * }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        {
          error: 'Unauthorized',
          message: 'You must be logged in to upgrade',
          code: 'UNAUTHORIZED',
        },
        { status: 401 }
      );
    }

    // Session 4A-10a: when the flag is on, money-service's StripeCheckoutController
    // (Session 4A-9 PORT) already re-implements every check below (already-PRO,
    // affiliate code validation, Stripe session creation) against the same schema --
    // forward the raw request there instead of running this logic twice.
    if (shouldUseMoneyServiceForStripeWrite()) {
      const data = await forwardWriteRequestToMoneyService(
        request,
        '/v1/stripe/checkout'
      );
      return NextResponse.json(data);
    }

    const { id: userId, email, tier } = session.user;

    // Validate email exists
    if (!email) {
      return NextResponse.json(
        {
          error: 'Email required',
          message: 'Your account must have an email address to upgrade',
          code: 'EMAIL_REQUIRED',
        },
        { status: 400 }
      );
    }

    // Check if user is already PRO
    if (tier === 'PRO') {
      return NextResponse.json(
        {
          error: 'Already subscribed',
          message: 'You are already on the PRO tier',
          code: 'ALREADY_PRO',
        },
        { status: 400 }
      );
    }

    // Parse optional affiliate code from request body
    let affiliateCode: string | undefined;
    try {
      const body = await request.json();
      affiliateCode = body.affiliateCode;
    } catch {
      // No body or invalid JSON - that's fine, affiliateCode is optional
    }

    // Validate the affiliate code and resolve its discount BEFORE creating
    // the Stripe session, so the customer is actually charged the
    // discounted price (and invalid codes are rejected up front).
    let discountPercent = 0;
    let normalizedAffiliateCode: string | undefined;

    if (affiliateCode) {
      normalizedAffiliateCode = String(affiliateCode).trim().toUpperCase();

      const codeRecord = await prisma.affiliateCode.findFirst({
        where: {
          code: normalizedAffiliateCode,
          status: 'ACTIVE',
          expiresAt: { gt: new Date() },
        },
        include: {
          affiliateProfile: { select: { status: true } },
        },
      });

      if (!codeRecord || codeRecord.affiliateProfile?.status !== 'ACTIVE') {
        return NextResponse.json(
          {
            error: 'Invalid code',
            message: 'This affiliate code is invalid or expired',
            code: 'INVALID_AFFILIATE_CODE',
          },
          { status: 400 }
        );
      }

      discountPercent = codeRecord.discountPercent;
    }

    // Build success and cancel URLs
    const baseUrl = process.env['NEXTAUTH_URL'] || 'http://localhost:3000';
    const successUrl = `${baseUrl}/dashboard?upgrade=success`;
    const cancelUrl = `${baseUrl}/pricing?upgrade=cancelled`;

    // Create Stripe Checkout session
    const idempotencyKey = buildCheckoutIdempotencyKey(
      userId,
      normalizedAffiliateCode
    );
    const checkoutSession = await createCheckoutSession(
      userId,
      email,
      successUrl,
      cancelUrl,
      normalizedAffiliateCode,
      discountPercent,
      idempotencyKey
    );

    // Return session details
    return NextResponse.json({
      sessionId: checkoutSession.id,
      url: checkoutSession.url,
    });
  } catch (error) {
    if (error instanceof MoneyServiceError) {
      return NextResponse.json(error.body, { status: error.status });
    }

    console.error('[Checkout] Error creating checkout session:', error);

    // Handle specific Stripe errors
    if (error instanceof Error) {
      if (error.message.includes('STRIPE_PRO_PRICE_ID')) {
        return NextResponse.json(
          {
            error: 'Configuration error',
            message: 'Stripe is not properly configured',
            code: 'STRIPE_CONFIG_ERROR',
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      {
        error: 'Checkout failed',
        message: 'Failed to create checkout session. Please try again.',
        code: 'CHECKOUT_ERROR',
      },
      { status: 500 }
    );
  }
}
