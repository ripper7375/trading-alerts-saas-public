/**
 * Subscription Resume API Route
 *
 * POST /api/subscription/resume
 * Undoes a scheduled cancellation (Manage Subscription S2, workflow W4): only
 * while the subscription is CANCEL_SCHEDULED and the paid period (or trial)
 * has not ended. After the period end Stripe has ended the subscription, and
 * the user subscribes again from /pricing.
 *
 * @module app/api/subscription/resume/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/db/prisma';
import { sendSubscriptionResumedEmail } from '@/lib/email/subscription-emails';
import { setCancelAtPeriodEnd } from '@/lib/stripe/stripe';
import {
  allowedActionsOf,
  providerOf,
} from '@/lib/stripe/subscription-actions';
import { shouldUseMoneyServiceForStripeWrite } from '@/lib/money-service/flags';
import {
  forwardWriteRequestToMoneyService,
  MoneyServiceError,
} from '@/lib/money-service/write-routes';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// POST /api/subscription/resume
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Resume a subscription that was scheduled to end
 *
 * @returns JSON response with the date the subscription renews
 *
 * @example Response (success):
 * {
 *   "success": true,
 *   "message": "Your subscription will continue",
 *   "tier": "PRO",
 *   "cancelAtPeriodEnd": false,
 *   "renewsAt": "2026-11-21T00:00:00.000Z"
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
          message: 'You must be logged in to resume your subscription',
          code: 'UNAUTHORIZED',
        },
        { status: 401 }
      );
    }

    if (shouldUseMoneyServiceForStripeWrite()) {
      const data = await forwardWriteRequestToMoneyService(
        request,
        '/v1/stripe/subscriptions/resume'
      );
      return NextResponse.json(data);
    }

    const userId = session.user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { tier: true, email: true, name: true },
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

    // Explicit select (F21): see the cancel route.
    const userSubscription = await prisma.subscription.findUnique({
      where: { userId },
      select: {
        id: true,
        status: true,
        stripeSubscriptionId: true,
        stripeCurrentPeriodEnd: true,
        dLocalPaymentId: true,
        cancelAtPeriodEnd: true,
      },
    });

    if (user.tier === 'FREE' || !userSubscription) {
      return NextResponse.json(
        {
          error: 'No subscription',
          message: "You don't have an active PRO subscription",
          code: 'NO_SUBSCRIPTION',
        },
        { status: 400 }
      );
    }

    const provider = providerOf(userSubscription);
    if (provider !== 'STRIPE' || !userSubscription.stripeSubscriptionId) {
      return NextResponse.json(
        {
          error: 'No card subscription',
          message: 'You do not have a card subscription to resume',
          code: 'NO_STRIPE_SUBSCRIPTION',
        },
        { status: 400 }
      );
    }

    if (!userSubscription.cancelAtPeriodEnd) {
      return NextResponse.json(
        {
          error: 'Not scheduled',
          message: 'Your subscription is not scheduled to end',
          code: 'NOT_SCHEDULED',
        },
        { status: 400 }
      );
    }

    const periodEnd = userSubscription.stripeCurrentPeriodEnd;
    if (periodEnd && periodEnd.getTime() <= Date.now()) {
      return NextResponse.json(
        {
          error: 'Period ended',
          message:
            'Your subscription period has ended. Subscribe again from the pricing page.',
          code: 'PERIOD_ENDED',
        },
        { status: 400 }
      );
    }

    const allowed = allowedActionsOf({
      tier: user.tier,
      status: userSubscription.status,
      provider,
      openInvoiceUrl: null,
      cancelAtPeriodEnd: userSubscription.cancelAtPeriodEnd,
      currentPeriodEnd: periodEnd,
    });
    if (!allowed.includes('resume')) {
      return NextResponse.json(
        {
          error: 'Not allowed',
          message: 'You cannot resume this subscription right now',
          code: 'ACTION_NOT_ALLOWED',
        },
        { status: 400 }
      );
    }

    // Stripe first: if it refuses (for example the subscription has just
    // ended), nothing is recorded.
    let renewsAt: Date;
    try {
      const updated = await setCancelAtPeriodEnd(
        userSubscription.stripeSubscriptionId,
        false
      );
      renewsAt = new Date(updated.current_period_end * 1000);
    } catch (error) {
      console.error('[Resume] Error resuming the Stripe subscription:', error);
      return NextResponse.json(
        {
          error: 'Resume failed',
          message: 'Failed to resume your subscription. Please try again.',
          code: 'RESUME_ERROR',
        },
        { status: 500 }
      );
    }

    await prisma.subscription.update({
      where: { id: userSubscription.id },
      data: {
        cancelAtPeriodEnd: false,
        cancelRequestedAt: null,
        cancellationReason: null,
      },
    });

    if (user.email) {
      try {
        await sendSubscriptionResumedEmail(
          user.email,
          user.name || 'User',
          'PRO',
          renewsAt
        );
      } catch (emailError) {
        console.error('[Resume] Error sending resume email:', emailError);
        // Don't fail the resume if email fails
      }
    }

    console.log(`[Resume] User ${userId} resumed their subscription`);

    return NextResponse.json({
      success: true,
      message: 'Your subscription will continue',
      tier: user.tier,
      cancelAtPeriodEnd: false,
      renewsAt: renewsAt.toISOString(),
    });
  } catch (error) {
    if (error instanceof MoneyServiceError) {
      return NextResponse.json(error.body, { status: error.status });
    }

    console.error('[Resume] Error resuming subscription:', error);
    return NextResponse.json(
      {
        error: 'Resume failed',
        message: 'Failed to resume your subscription. Please try again.',
        code: 'RESUME_ERROR',
      },
      { status: 500 }
    );
  }
}
