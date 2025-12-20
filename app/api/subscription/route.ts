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

import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/db/prisma';
import {
  getSubscription,
  getCustomerPaymentMethods,
} from '@/lib/stripe/stripe';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Unified subscription response supporting both Stripe and dLocal
 */
interface SubscriptionResponse {
  tier: 'FREE' | 'PRO';
  status: string;
  subscription: {
    id: string;
    status: string;
    provider: 'STRIPE' | 'DLOCAL' | null; // NEW: Payment provider
    planType: string | null;               // NEW: Plan type (MONTHLY, THREE_DAY)
    currentPeriodEnd: string | null;       // For Stripe
    expiresAt: string | null;              // NEW: For dLocal explicit expiry
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
  } | null;
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
 *   "subscription": null
 * }
 *
 * @example Response (PRO tier):
 * {
 *   "tier": "PRO",
 *   "status": "active",
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
export async function GET(): Promise<
  NextResponse<SubscriptionResponse | { error: string }>
> {
  try {
    // Authenticate user
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Get user with subscription from database
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { subscription: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // If no subscription or FREE tier, return basic response
    if (!user.subscription || user.tier === 'FREE') {
      return NextResponse.json({
        tier: user.tier,
        status: 'none',
        subscription: null,
      });
    }

    // Get Stripe subscription details if available
    let stripeSubscription = null;
    let paymentMethod = null;

    if (user.subscription.stripeSubscriptionId) {
      try {
        stripeSubscription = await getSubscription(
          user.subscription.stripeSubscriptionId
        );

        // Get payment method if customer exists
        if (user.subscription.stripeCustomerId) {
          const paymentMethods = await getCustomerPaymentMethods(
            user.subscription.stripeCustomerId
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
    const provider: 'STRIPE' | 'DLOCAL' | null = user.subscription.dLocalPaymentId
      ? 'DLOCAL'
      : user.subscription.stripeSubscriptionId
        ? 'STRIPE'
        : null;

    // Build unified response
    const response: SubscriptionResponse = {
      tier: user.tier,
      status: user.subscription.status,
      subscription: {
        id: user.subscription.id,
        status: user.subscription.status,
        provider,
        planType: user.subscription.planType,
        currentPeriodEnd:
          user.subscription.stripeCurrentPeriodEnd?.toISOString() || null,
        expiresAt: user.subscription.expiresAt?.toISOString() || null,
        cancelAtPeriodEnd: stripeSubscription?.cancel_at_period_end || false,
        trialEnd: stripeSubscription?.trial_end
          ? new Date(stripeSubscription.trial_end * 1000).toISOString()
          : null,
        paymentMethod,
        dLocalPaymentMethod: user.subscription.dLocalPaymentMethod,
        dLocalCountry: user.subscription.dLocalCountry,
      },
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
