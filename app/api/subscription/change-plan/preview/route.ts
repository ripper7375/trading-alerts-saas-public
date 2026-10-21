/**
 * Change-plan preview API Route
 *
 * GET /api/subscription/change-plan/preview?billingPeriod=yearly
 * The quote for the upgrade from monthly to yearly billing (Manage Subscription
 * S3, workflow W5a): what Stripe would charge right now if the PRO item moved to
 * the yearly SystemConfig price (decision D3), with the unused part of the
 * current month credited (D2). Nothing is created or charged. The page shows the
 * numbers, and the confirm call sends back `prorationDate` so the charge equals
 * the amount shown.
 *
 * @module app/api/subscription/change-plan/preview/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { getAnnualPriceUsd } from '@/lib/affiliate/db';
import { authOptions } from '@/lib/auth/auth-options';
import { shouldUseMoneyServiceForStripeWrite } from '@/lib/money-service/flags';
import {
  forwardWriteRequestToMoneyService,
  MoneyServiceError,
} from '@/lib/money-service/write-routes';
import { loadPlanChangeContext } from '@/lib/stripe/plan-change-context';
import {
  STRIPE_PRO_PRICE_ID,
  buildProLineItem,
  previewYearlyUpgrade,
} from '@/lib/stripe/stripe';

const NO_STORE = { 'Cache-Control': 'no-store' };

/**
 * @returns `{ amountDueNowUsd, prorationDate, renewsOn, yearlyPriceUsd,
 *   creditUsd, taxUsd, inTrial }`
 *
 * @example Response (success):
 * {
 *   "amountDueNowUsd": 270.35,
 *   "prorationDate": 1793412900,
 *   "renewsOn": "2027-10-31T03:15:00.000Z",
 *   "yearlyPriceUsd": 290,
 *   "creditUsd": 19.65,
 *   "taxUsd": 0,
 *   "inTrial": false
 * }
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        {
          error: 'Unauthorized',
          message: 'You must be logged in to change your plan',
          code: 'UNAUTHORIZED',
        },
        { status: 401 }
      );
    }

    if (shouldUseMoneyServiceForStripeWrite()) {
      const data = await forwardWriteRequestToMoneyService(
        request,
        `/v1/stripe/subscriptions/change-plan/preview${request.nextUrl.search}`,
        { method: 'GET' }
      );
      return NextResponse.json(data, { headers: NO_STORE });
    }

    // Only the upgrade has an amount to quote: the switch to monthly charges
    // and refunds nothing.
    if (request.nextUrl.searchParams.get('billingPeriod') !== 'yearly') {
      return NextResponse.json(
        {
          error: 'Invalid billing period',
          message: 'Only a switch to yearly billing has a quote',
          code: 'INVALID_BILLING_PERIOD',
        },
        { status: 400 }
      );
    }

    const loaded = await loadPlanChangeContext(session.user.id);
    if (!loaded.ok) {
      return NextResponse.json(loaded.refusal.body, {
        status: loaded.refusal.status,
      });
    }
    const ctx = loaded.context;

    if (!ctx.allowed.includes('upgrade_to_yearly')) {
      return NextResponse.json(
        {
          error: 'Not allowed',
          message: 'You cannot switch to yearly billing right now',
          code: 'ACTION_NOT_ALLOWED',
        },
        { status: 400 }
      );
    }

    if (!STRIPE_PRO_PRICE_ID) {
      console.error('[PlanChange] STRIPE_PRO_PRICE_ID is not set');
      return NextResponse.json(
        {
          error: 'Configuration error',
          message: 'Changing your plan is temporarily unavailable.',
          code: 'PLAN_CHANGE_UNAVAILABLE',
        },
        { status: 503 }
      );
    }

    const yearlyPriceUsd = await getAnnualPriceUsd();
    const yearlyLineItem = await buildProLineItem(
      STRIPE_PRO_PRICE_ID,
      yearlyPriceUsd,
      'yearly'
    );
    const customerId =
      typeof ctx.live.customer === 'string'
        ? ctx.live.customer
        : ctx.live.customer.id;
    const prorationDate = Math.floor(Date.now() / 1000);

    const preview = await previewYearlyUpgrade({
      customerId,
      subscription: ctx.live,
      itemId: ctx.itemId,
      yearlyLineItem,
      prorationDate,
    });

    return NextResponse.json(
      {
        amountDueNowUsd: preview.amountDueNowUsd,
        prorationDate,
        renewsOn: preview.renewsOn?.toISOString() ?? null,
        yearlyPriceUsd,
        creditUsd: preview.creditUsd,
        taxUsd: preview.taxUsd,
        inTrial: preview.inTrial,
      },
      { headers: NO_STORE }
    );
  } catch (error) {
    if (error instanceof MoneyServiceError) {
      return NextResponse.json(error.body, { status: error.status });
    }

    console.error('[PlanChange] Error building the upgrade quote:', error);
    return NextResponse.json(
      {
        error: 'Preview failed',
        message: 'We could not calculate the charge. Please try again.',
        code: 'PREVIEW_ERROR',
      },
      { status: 500 }
    );
  }
}
