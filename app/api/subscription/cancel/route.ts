/**
 * Subscription Cancel API Route
 *
 * POST /api/subscription/cancel
 * Cancels the user's PRO subscription and downgrades to FREE tier.
 *
 * @module app/api/subscription/cancel/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/db/prisma';
import { sendCancellationEmail } from '@/lib/email/subscription-emails';
import { cancelSubscription } from '@/lib/stripe/stripe';
import { shouldUseMoneyServiceForStripeWrite } from '@/lib/money-service/flags';
import {
  forwardWriteRequestToMoneyService,
  MoneyServiceError,
} from '@/lib/money-service/write-routes';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// POST /api/subscription/cancel
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Cancel user's PRO subscription
 *
 * Immediately cancels the Stripe subscription and downgrades
 * the user to FREE tier.
 *
 * @returns JSON response with cancellation status
 *
 * @example Response (success):
 * {
 *   "success": true,
 *   "message": "Subscription cancelled successfully",
 *   "tier": "FREE"
 * }
 *
 * @example Response (error - no subscription):
 * {
 *   "error": "No subscription",
 *   "message": "You don't have an active PRO subscription",
 *   "code": "NO_SUBSCRIPTION"
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
          message: 'You must be logged in to cancel subscription',
          code: 'UNAUTHORIZED',
        },
        { status: 401 }
      );
    }

    // Session 4A-10a: money-service's StripeSubscriptionController (Session
    // 4A-9 PORT) already re-implements this route in full, including the
    // OutboxEvent emission the monolith path below has no equivalent for.
    if (shouldUseMoneyServiceForStripeWrite()) {
      const data = await forwardWriteRequestToMoneyService(
        request,
        '/v1/stripe/subscriptions/cancel'
      );
      return NextResponse.json(data);
    }

    const userId = session.user.id;

    // Get user with subscription
    const user = await prisma.user.findUnique({
      where: { id: userId },
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

    // User no longer carries a `subscription` relation (Session 2-3 FK
    // audit) — look it up separately by userId.
    const userSubscription = await prisma.subscription.findUnique({
      where: { userId },
    });

    // Check if user has an active subscription
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

    // Cancel Stripe subscription if exists
    if (userSubscription.stripeSubscriptionId) {
      try {
        await cancelSubscription(userSubscription.stripeSubscriptionId);
        console.log(
          `[Cancel] Cancelled Stripe subscription: ${userSubscription.stripeSubscriptionId}`
        );
      } catch (error) {
        console.error('[Cancel] Error cancelling Stripe subscription:', error);
        // Continue with local cancellation even if Stripe fails
        // The webhook will eventually sync the status
      }
    }

    // Update user tier to FREE
    await prisma.user.update({
      where: { id: userId },
      data: {
        tier: 'FREE',
        trialStatus: 'CANCELLED',
        trialCancelledAt: new Date(),
      },
    });

    // Update subscription status in database
    await prisma.subscription.update({
      where: { id: userSubscription.id },
      data: { status: 'CANCELED' },
    });

    // Send cancellation email
    if (user.email) {
      try {
        await sendCancellationEmail(user.email, user.name || 'User');
      } catch (emailError) {
        console.error('[Cancel] Error sending cancellation email:', emailError);
        // Don't fail the cancellation if email fails
      }
    }

    console.log(`[Cancel] User ${userId} cancelled subscription`);

    return NextResponse.json({
      success: true,
      message: 'Subscription cancelled successfully',
      tier: 'FREE',
    });
  } catch (error) {
    if (error instanceof MoneyServiceError) {
      return NextResponse.json(error.body, { status: error.status });
    }

    console.error('[Cancel] Error cancelling subscription:', error);
    return NextResponse.json(
      {
        error: 'Cancellation failed',
        message: 'Failed to cancel subscription. Please try again.',
        code: 'CANCEL_ERROR',
      },
      { status: 500 }
    );
  }
}
