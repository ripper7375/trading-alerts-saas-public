/**
 * Update-card session API Route (Manage Subscription S1, workflow W1)
 *
 * POST /api/subscription/payment-method-session
 * Creates a Stripe Billing Portal session that opens ONLY the card form
 * (`flow_data.type = payment_method_update`, decision D4), under the portal
 * configuration with every other feature off (STRIPE_PORTAL_CONFIGURATION_ID,
 * decision D5). Returns `{ url }`; the browser goes there, and Stripe sends the
 * user back to /settings/billing?done=card when the card is saved.
 *
 * Writes nothing and charges nothing. No idempotency cache on purpose: a
 * portal URL expires within minutes, so replaying a cached one would hand the
 * user a dead link.
 *
 * @module app/api/subscription/payment-method-session/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/db/prisma';
import { shouldUseMoneyServiceForStripeWrite } from '@/lib/money-service/flags';
import {
  forwardWriteRequestToMoneyService,
  MoneyServiceError,
} from '@/lib/money-service/write-routes';
import { createPaymentMethodUpdateSession } from '@/lib/stripe/stripe';
import {
  allowedActionsOf,
  providerOf,
} from '@/lib/stripe/subscription-actions';

/**
 * Open Stripe's card form for the signed-in user's own subscription.
 *
 * @example Response (success):
 * { "url": "https://billing.stripe.com/p/session/..." }
 *
 * @example Response (error):
 * { "error": "...", "message": "...", "code": "NO_STRIPE_SUBSCRIPTION" }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        {
          error: 'Unauthorized',
          message: 'You must be logged in to update your card',
          code: 'UNAUTHORIZED',
        },
        { status: 401 }
      );
    }

    // Same split as the cancel route: money-service re-implements this
    // endpoint, so both stacks run the same rules.
    if (shouldUseMoneyServiceForStripeWrite()) {
      const data = await forwardWriteRequestToMoneyService(
        request,
        '/v1/stripe/subscriptions/payment-method-session'
      );
      return NextResponse.json(data);
    }

    const userId = session.user.id;

    // Refused before anything is created, so a missing setting is visible
    // the moment S1 is deployed without it.
    const configurationId = process.env['STRIPE_PORTAL_CONFIGURATION_ID'];
    const baseUrl = process.env['NEXTAUTH_URL'];
    if (!configurationId || !baseUrl) {
      console.error(
        '[CardUpdate] STRIPE_PORTAL_CONFIGURATION_ID or NEXTAUTH_URL is not set; refusing to open the portal'
      );
      return NextResponse.json(
        {
          error: 'Configuration error',
          message:
            'Card updates are temporarily unavailable. Please try again later.',
          code: 'PORTAL_NOT_CONFIGURED',
        },
        { status: 503 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { tier: true },
    });

    if (!user) {
      return NextResponse.json(
        {
          error: 'User not found',
          message: 'User account not found',
          code: 'USER_NOT_FOUND',
        },
        { status: 404 }
      );
    }

    const subscription = await prisma.subscription.findUnique({
      where: { userId },
      select: {
        status: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        dLocalPaymentId: true,
      },
    });

    if (!subscription?.stripeCustomerId) {
      return NextResponse.json(
        {
          error: 'No card on file',
          message: 'You do not have a card subscription to update',
          code: 'NO_STRIPE_SUBSCRIPTION',
        },
        { status: 400 }
      );
    }

    const allowed = allowedActionsOf({
      tier: user.tier,
      status: subscription.status,
      provider: providerOf(subscription),
      openInvoiceUrl: null,
    });
    if (!allowed.includes('update_card')) {
      return NextResponse.json(
        {
          error: 'Not allowed',
          message: 'You cannot update your card for this subscription',
          code: 'ACTION_NOT_ALLOWED',
        },
        { status: 400 }
      );
    }

    const portal = await createPaymentMethodUpdateSession(
      subscription.stripeCustomerId,
      configurationId,
      `${baseUrl}/settings/billing`,
      `${baseUrl}/settings/billing?done=card`
    );

    return NextResponse.json({ url: portal.url });
  } catch (error) {
    if (error instanceof MoneyServiceError) {
      return NextResponse.json(error.body, { status: error.status });
    }

    console.error('[CardUpdate] Error creating the portal session:', error);
    return NextResponse.json(
      {
        error: 'Card update failed',
        message: 'Failed to open the card update page. Please try again.',
        code: 'PORTAL_SESSION_ERROR',
      },
      { status: 500 }
    );
  }
}
