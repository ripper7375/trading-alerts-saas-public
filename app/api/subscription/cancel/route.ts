/**
 * Subscription Cancel API Route
 *
 * POST /api/subscription/cancel
 * Schedules the cancellation of the user's Stripe subscription at the end of
 * the paid period (Manage Subscription S2, workflow W3, decision D1). PRO is
 * kept until then and the user can resume; the existing
 * `customer.subscription.deleted` webhook downgrades to FREE when the period
 * actually ends. During a trial the period is the trial: it ends then, with no
 * charge. A dLocal plan is prepaid and has no cancel (D8).
 *
 * @module app/api/subscription/cancel/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/db/prisma';
import { sendSubscriptionCanceledEmail } from '@/lib/email/subscription-emails';
import {
  getSubscription,
  releaseSubscriptionSchedule,
  setCancelAtPeriodEnd,
} from '@/lib/stripe/stripe';
import {
  allowedActionsOf,
  parseCancellationReason,
  providerOf,
  scheduleIdOf,
} from '@/lib/stripe/subscription-actions';
import { shouldUseMoneyServiceForStripeWrite } from '@/lib/money-service/flags';
import {
  forwardWriteRequestToMoneyService,
  MoneyServiceError,
} from '@/lib/money-service/write-routes';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// POST /api/subscription/cancel
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Cancel user's PRO subscription at the end of the paid period
 *
 * @param request - Body `{ reason?: string }` (optional, free text, 500 chars)
 * @returns JSON response with the date PRO ends
 *
 * @example Response (success):
 * {
 *   "success": true,
 *   "message": "Your subscription will end at the close of the current period",
 *   "tier": "PRO",
 *   "cancelAtPeriodEnd": true,
 *   "cancelAt": "2026-11-21T00:00:00.000Z"
 * }
 *
 * @example Response (error - dLocal plan):
 * {
 *   "error": "Nothing to cancel",
 *   "message": "Your plan is prepaid and ends on its expiry date. It does not renew automatically.",
 *   "code": "DLOCAL_NO_CANCEL",
 *   "expiresAt": "2026-11-21T00:00:00.000Z"
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

    // Session 4A-10a: money-service's StripeSubscriptionController
    // re-implements this route in full, including the OutboxEvent emission the
    // monolith path below has no equivalent for.
    if (shouldUseMoneyServiceForStripeWrite()) {
      const data = await forwardWriteRequestToMoneyService(
        request,
        '/v1/stripe/subscriptions/cancel'
      );
      return NextResponse.json(data);
    }

    const userId = session.user.id;

    const parsed = parseCancellationReason(
      await request.json().catch(() => ({}))
    );
    if (!parsed.ok) {
      return NextResponse.json(
        {
          error: 'Invalid reason',
          message: 'The reason must be text of at most 500 characters',
          code: 'INVALID_REASON',
        },
        { status: 400 }
      );
    }

    // Get user with subscription
    // Explicit select: the tier check and the cancellation email need only
    // these three fields.
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

    // User no longer carries a `subscription` relation (Session 2-3 FK
    // audit) — look it up separately by userId. Explicit select (F21): a
    // full-row read breaks the moment a column is added and the code is
    // deployed before its migration.
    const userSubscription = await prisma.subscription.findUnique({
      where: { userId },
      select: {
        id: true,
        status: true,
        stripeSubscriptionId: true,
        stripeCurrentPeriodEnd: true,
        dLocalPaymentId: true,
        expiresAt: true,
        cancelAtPeriodEnd: true,
        pendingPlanType: true,
        stripeScheduleId: true,
      },
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

    const provider = providerOf(userSubscription);

    // D8: a dLocal plan is prepaid, does not renew by itself and simply ends
    // at `expiresAt`, so there is nothing to cancel (and no days to forfeit).
    if (provider === 'DLOCAL') {
      return NextResponse.json(
        {
          error: 'Nothing to cancel',
          message:
            'Your plan is prepaid and ends on its expiry date. It does not renew automatically.',
          code: 'DLOCAL_NO_CANCEL',
          expiresAt: userSubscription.expiresAt?.toISOString() ?? null,
        },
        { status: 400 }
      );
    }

    if (provider !== 'STRIPE' || !userSubscription.stripeSubscriptionId) {
      return NextResponse.json(
        {
          error: 'No card subscription',
          message: 'You do not have a card subscription to cancel',
          code: 'NO_STRIPE_SUBSCRIPTION',
        },
        { status: 400 }
      );
    }

    if (userSubscription.cancelAtPeriodEnd) {
      return NextResponse.json(
        {
          error: 'Already scheduled',
          message: 'Your cancellation is already scheduled',
          code: 'ALREADY_SCHEDULED',
        },
        { status: 400 }
      );
    }

    // The server refuses what the page would not have offered (plan §6): a
    // failed payment has to be resolved first.
    const allowed = allowedActionsOf({
      tier: user.tier,
      status: userSubscription.status,
      provider,
      openInvoiceUrl: null,
      cancelAtPeriodEnd: userSubscription.cancelAtPeriodEnd,
      currentPeriodEnd: userSubscription.stripeCurrentPeriodEnd,
    });
    if (!allowed.includes('cancel')) {
      return NextResponse.json(
        {
          error: 'Not allowed',
          message: 'You cannot cancel this subscription right now',
          code: 'ACTION_NOT_ALLOWED',
        },
        { status: 400 }
      );
    }

    // A schedule managing the subscription (a scheduled switch to monthly, W5b,
    // or the finished phase 2 of one) makes Stripe refuse `cancel_at_period_end`,
    // and cancelling makes the switch pointless: release it first (W3) and drop
    // the pending fields at once, so a failure below cannot leave a switch the
    // row remembers and Stripe no longer has. Stripe's own subscription is read
    // too, because a schedule the row does not know about blocks the cancel the
    // same way.
    try {
      const live = await getSubscription(userSubscription.stripeSubscriptionId);
      const scheduleId =
        scheduleIdOf(live.schedule) ?? userSubscription.stripeScheduleId;
      if (scheduleId) {
        await releaseSubscriptionSchedule(scheduleId);
      }
      if (scheduleId || userSubscription.pendingPlanType) {
        await prisma.subscription.update({
          where: { id: userSubscription.id },
          data: {
            pendingPlanType: null,
            pendingPlanEffectiveAt: null,
            stripeScheduleId: null,
          },
        });
      }
    } catch (error) {
      console.error(
        '[Cancel] Error releasing the plan-switch schedule:',
        error
      );
      return NextResponse.json(
        {
          error: 'Cancellation failed',
          message: 'Failed to cancel subscription. Please try again.',
          code: 'CANCEL_ERROR',
        },
        { status: 500 }
      );
    }

    // Stripe first: if it refuses, nothing is recorded and the user can try
    // again. (The old route recorded the cancellation even when Stripe failed.)
    let cancelAt: Date;
    try {
      const updated = await setCancelAtPeriodEnd(
        userSubscription.stripeSubscriptionId,
        true
      );
      cancelAt = new Date(
        (updated.cancel_at ?? updated.current_period_end) * 1000
      );
    } catch (error) {
      console.error(
        '[Cancel] Error scheduling the Stripe cancellation:',
        error
      );
      return NextResponse.json(
        {
          error: 'Cancellation failed',
          message: 'Failed to cancel subscription. Please try again.',
          code: 'CANCEL_ERROR',
        },
        { status: 500 }
      );
    }

    // The user keeps PRO (tier and status unchanged); the webhook downgrades
    // when Stripe ends the subscription. If this write fails the flag is
    // already set in Stripe, the webhook syncs it, and a retry is allowed.
    await prisma.subscription.update({
      where: { id: userSubscription.id },
      data: {
        cancelAtPeriodEnd: true,
        cancelRequestedAt: new Date(),
        cancellationReason: parsed.reason,
      },
    });

    // Send the cancellation e-mail with the date PRO ends
    if (user.email) {
      try {
        await sendSubscriptionCanceledEmail(
          user.email,
          user.name || 'User',
          'PRO',
          cancelAt
        );
      } catch (emailError) {
        console.error('[Cancel] Error sending cancellation email:', emailError);
        // Don't fail the cancellation if email fails
      }
    }

    console.log(
      `[Cancel] User ${userId} scheduled cancellation at ${cancelAt.toISOString()}`
    );

    return NextResponse.json({
      success: true,
      message: 'Your subscription will end at the close of the current period',
      tier: user.tier,
      cancelAtPeriodEnd: true,
      cancelAt: cancelAt.toISOString(),
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
