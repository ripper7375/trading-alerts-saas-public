/**
 * Subscription API Route
 *
 * GET /api/subscription - Get user's current subscription
 * POST /api/subscription - Create/upgrade to PRO subscription (redirects to checkout)
 *
 * @module app/api/subscription/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import {
  VIEW_AS_DENIED_BODY,
  resolveViewAsSubject,
} from '@/lib/admin/user-view-as';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/db/prisma';
import {
  getSubscription,
  getCustomerPaymentMethods,
  getOpenInvoiceUrl,
} from '@/lib/stripe/stripe';
import {
  allowedActionsOf,
  displayStateOf,
  isPaymentProblem,
  providerOf,
  showsSubscription,
  type SubscriptionAction,
  type SubscriptionDisplayState,
} from '@/lib/stripe/subscription-actions';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Unified subscription response supporting both Stripe and dLocal
 */
interface SubscriptionResponse {
  tier: 'FREE' | 'PRO';
  status: string;
  /**
   * What the billing page may offer, decided here (plan §6): the server
   * refuses any action that is not in this list. Empty in admin view-as.
   */
  allowedActions: SubscriptionAction[];
  displayState: SubscriptionDisplayState;
  subscription: {
    id: string;
    status: string;
    provider: 'STRIPE' | 'DLOCAL' | null; // NEW: Payment provider
    planType: string | null; // MONTHLY, YEARLY, THREE_DAY
    /** This subscriber's own price per billing period (USD), as charged */
    amountUsd: number | null;
    currentPeriodEnd: string | null; // For Stripe
    expiresAt: string | null; // NEW: For dLocal explicit expiry
    cancelAtPeriodEnd: boolean;
    trialEnd: string | null;
    paymentMethod: {
      brand: string;
      last4: string;
      expiryMonth: number;
      expiryYear: number;
    } | null;
    // NEW: dLocal-specific fields
    dLocalPaymentMethod: string | null;
    dLocalCountry: string | null;
    /**
     * Hosted invoice page of the latest open invoice ("Pay now"); only set
     * for a Stripe subscription whose renewal failed (PAST_DUE or UNPAID).
     */
    openInvoiceUrl: string | null;
  } | null;
  // NEW (Session 6-1b): trial state, read from the User model. Additive
  // only — every existing consumer of this response is unaffected.
  trial: {
    status: string;
    convertedAt: string | null;
    cancelledAt: string | null;
    hasUsedFreeTrial: boolean;
  };
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET /api/subscription
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Get user's current subscription details
 *
 * @returns JSON response with subscription status and details
 *
 * @example Response (FREE tier):
 * {
 *   "tier": "FREE",
 *   "status": "none",
 *   "allowedActions": [],
 *   "displayState": "FREE",
 *   "subscription": null
 * }
 *
 * @example Response (PRO tier):
 * {
 *   "tier": "PRO",
 *   "status": "active",
 *   "allowedActions": ["update_card", "cancel"],
 *   "displayState": "ACTIVE",
 *   "subscription": {
 *     "id": "sub_xxx",
 *     "status": "active",
 *     "currentPeriodEnd": "2024-01-15T00:00:00.000Z",
 *     "cancelAtPeriodEnd": false,
 *     "trialEnd": null,
 *     "paymentMethod": {
 *       "brand": "visa",
 *       "last4": "4242",
 *       "expiryMonth": 12,
 *       "expiryYear": 2025
 *     }
 *   }
 * }
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<SubscriptionResponse | { error: string }>> {
  try {
    // Authenticate user
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Admin read-only "view as user": ?view_as=user reads the viewed user.
    const subject = await resolveViewAsSubject(request, session.user);
    if (subject.kind === 'denied') {
      return NextResponse.json(VIEW_AS_DENIED_BODY, { status: 403 });
    }
    const userId = subject.userId;

    // Get user with subscription from database
    // Explicit select: only the tier and trial fields this route returns
    // (never `password`, `twoFactorSecret`, tokens, ...).
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        tier: true,
        trialStatus: true,
        trialConvertedAt: true,
        trialCancelledAt: true,
        hasUsedFreeTrial: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // User no longer carries a `subscription` relation (Session 2-3 FK
    // audit) — look it up separately by userId.
    // Explicit select (F21): a full-row read breaks the moment a column is
    // added and this code is deployed before its migration. Only what the
    // response below uses.
    const userSubscription = await prisma.subscription.findUnique({
      where: { userId },
      select: {
        id: true,
        status: true,
        planType: true,
        amountUsd: true,
        expiresAt: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        stripeCurrentPeriodEnd: true,
        dLocalPaymentId: true,
        dLocalPaymentMethod: true,
        dLocalCountry: true,
        cancelAtPeriodEnd: true,
      },
    });

    const trial = {
      status: user.trialStatus,
      convertedAt: user.trialConvertedAt?.toISOString() || null,
      cancelledAt: user.trialCancelledAt?.toISOString() || null,
      hasUsedFreeTrial: user.hasUsedFreeTrial,
    };

    // No subscription block for a FREE user, unless a failed payment is
    // waiting to be resolved: after UNPAID (or a PAST_DUE row downgraded before
    // the grace fix) the user must still see "Pay now" and "Update card" (B2).
    if (
      !userSubscription ||
      !showsSubscription(user.tier, userSubscription.status)
    ) {
      return NextResponse.json({
        tier: user.tier,
        status: 'none',
        allowedActions: [],
        displayState: 'FREE',
        subscription: null,
        trial,
      });
    }

    // Get Stripe subscription details if available
    let stripeSubscription = null;
    let paymentMethod = null;

    if (userSubscription.stripeSubscriptionId) {
      try {
        stripeSubscription = await getSubscription(
          userSubscription.stripeSubscriptionId
        );

        // Get payment method if customer exists
        if (userSubscription.stripeCustomerId) {
          const paymentMethods = await getCustomerPaymentMethods(
            userSubscription.stripeCustomerId
          );

          const firstPaymentMethod = paymentMethods[0];
          if (firstPaymentMethod?.card) {
            const card = firstPaymentMethod.card;
            paymentMethod = {
              brand: card.brand,
              last4: card.last4,
              expiryMonth: card.exp_month,
              expiryYear: card.exp_year,
            };
          }
        }
      } catch (error) {
        console.error('[Subscription] Error fetching Stripe data:', error);
        // Continue without Stripe data - use database data
      }
    }

    // Determine payment provider
    const provider = providerOf(userSubscription);

    // W2: the page for paying the failed renewal. Looked up only for a Stripe
    // subscription in a failed-payment state, and not in admin view-as (the
    // admin cannot act on it; its absence also hides "Pay now").
    let openInvoiceUrl: string | null = null;
    if (
      subject.kind === 'self' &&
      provider === 'STRIPE' &&
      userSubscription.stripeSubscriptionId &&
      isPaymentProblem(userSubscription.status)
    ) {
      try {
        openInvoiceUrl = await getOpenInvoiceUrl(
          userSubscription.stripeSubscriptionId
        );
      } catch (error) {
        console.error('[Subscription] Error fetching open invoice:', error);
        // "Update card" still works; only "Pay now" is missing.
      }
    }

    // Stripe's own answer wins when it was read (a cancellation can also be
    // scheduled or undone outside this app, and the webhook may lag); the
    // stored columns are the fallback. The period end matters twice: it is the
    // date the page promises ("PRO until ..."), and during a trial the stored
    // value is only an estimate until the first webhook corrects it.
    const cancelAtPeriodEnd =
      typeof stripeSubscription?.cancel_at_period_end === 'boolean'
        ? stripeSubscription.cancel_at_period_end
        : userSubscription.cancelAtPeriodEnd;
    const currentPeriodEnd =
      typeof stripeSubscription?.current_period_end === 'number'
        ? new Date(stripeSubscription.current_period_end * 1000)
        : userSubscription.stripeCurrentPeriodEnd;

    const actionFacts = {
      tier: user.tier,
      status: userSubscription.status,
      provider,
      openInvoiceUrl,
      viewing: subject.kind !== 'self',
      cancelAtPeriodEnd,
      currentPeriodEnd,
    };

    // Build unified response
    const response: SubscriptionResponse = {
      tier: user.tier,
      status: userSubscription.status,
      allowedActions: allowedActionsOf(actionFacts),
      displayState: displayStateOf(actionFacts),
      subscription: {
        id: userSubscription.id,
        status: userSubscription.status,
        provider,
        planType: userSubscription.planType,
        amountUsd:
          userSubscription.amountUsd > 0 ? userSubscription.amountUsd : null,
        currentPeriodEnd: currentPeriodEnd?.toISOString() || null,
        expiresAt: userSubscription.expiresAt?.toISOString() || null,
        cancelAtPeriodEnd,
        trialEnd: stripeSubscription?.trial_end
          ? new Date(stripeSubscription.trial_end * 1000).toISOString()
          : null,
        paymentMethod,
        dLocalPaymentMethod: userSubscription.dLocalPaymentMethod,
        dLocalCountry: userSubscription.dLocalCountry,
        openInvoiceUrl,
      },
      trial,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Subscription] Error fetching subscription:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscription' },
      { status: 500 }
    );
  }
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// POST /api/subscription
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Create/upgrade to PRO subscription
 *
 * This endpoint redirects to the checkout endpoint since
 * all subscription creation goes through Stripe Checkout.
 *
 * @param request - Next.js request object
 * @returns JSON response redirecting to checkout
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // Redirect to checkout endpoint
  // All subscription creation goes through Stripe Checkout
  const baseUrl = process.env['NEXTAUTH_URL'] || 'http://localhost:3000';

  try {
    // Forward the request to checkout endpoint
    const checkoutResponse = await fetch(`${baseUrl}/api/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: request.headers.get('cookie') || '',
      },
      body: JSON.stringify(await request.json().catch(() => ({}))),
    });

    const data = await checkoutResponse.json();

    if (!checkoutResponse.ok) {
      return NextResponse.json(data, { status: checkoutResponse.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('[Subscription] Error creating subscription:', error);
    return NextResponse.json(
      { error: 'Failed to create subscription' },
      { status: 500 }
    );
  }
}
