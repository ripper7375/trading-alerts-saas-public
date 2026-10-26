/**
 * Change-plan API Route
 *
 * POST   /api/subscription/change-plan  { billingPeriod: 'yearly', prorationDate }
 * POST   /api/subscription/change-plan  { billingPeriod: 'monthly' }
 * DELETE /api/subscription/change-plan
 *
 * Manage Subscription S3, decision D2 (asymmetric) and D3 (the new period is
 * always priced at the current SystemConfig figure):
 *
 * - W5a, monthly to yearly, NOW. The PRO item moves to the yearly price at once
 *   with `proration_behavior: 'always_invoice'` and the quote's `prorationDate`,
 *   so the charge equals the amount the page showed. `error_if_incomplete`
 *   (decision E2): a declined card or a 3-D Secure request makes Stripe refuse the
 *   whole change, so the user stays monthly and is not charged. During the free
 *   trial (E3) the price changes now, the trial runs to its end and the first
 *   charge is the yearly price; nothing is charged at the switch.
 * - W5b, yearly to monthly, at the RENEWAL. A Stripe Subscription Schedule keeps
 *   the yearly item until `current_period_end` and then bills the monthly price;
 *   no refund and no prorated credit. Stored as `pendingPlanType`,
 *   `pendingPlanEffectiveAt` and `stripeScheduleId`.
 * - DELETE ("Keep yearly"): releases the schedule and clears the pending fields.
 *
 * @module app/api/subscription/change-plan/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { getAnnualPriceUsd, getBasePriceUsd } from '@/lib/affiliate/db';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/db/prisma';
import {
  sendPlanSwitchScheduledEmail,
  sendSubscriptionUpgradedEmail,
} from '@/lib/email/subscription-emails';
import { shouldUseMoneyServiceForStripeWrite } from '@/lib/money-service/flags';
import {
  forwardWriteRequestToMoneyService,
  MoneyServiceError,
} from '@/lib/money-service/write-routes';
import { loadPlanChangeContext } from '@/lib/stripe/plan-change-context';
import {
  STRIPE_PRO_PRICE_ID,
  buildProLineItem,
  isStripeCardError,
  releaseSubscriptionSchedule,
  scheduleSwitchToMonthly,
  upgradeToYearlyNow,
} from '@/lib/stripe/stripe';
import {
  parseChangePlanBody,
  sameUsdPrice,
} from '@/lib/stripe/subscription-actions';

const PARSE_MESSAGES = {
  INVALID_BILLING_PERIOD: 'Choose monthly or yearly billing',
  INVALID_PRORATION_DATE:
    'The quote is missing. Please review the amount again.',
  PRORATION_EXPIRED: 'The quote has expired. Please review the amount again.',
  INVALID_EXPECTED_PRICE: 'The price shown could not be read',
} as const;

function json(body: Record<string, unknown>, status: number): NextResponse {
  return NextResponse.json(body, { status });
}

function notAllowed(
  message: string,
  code = 'ACTION_NOT_ALLOWED'
): NextResponse {
  return json({ error: 'Not allowed', message, code }, 400);
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// POST /api/subscription/change-plan
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return json(
        {
          error: 'Unauthorized',
          message: 'You must be logged in to change your plan',
          code: 'UNAUTHORIZED',
        },
        401
      );
    }

    if (shouldUseMoneyServiceForStripeWrite()) {
      const data = await forwardWriteRequestToMoneyService(
        request,
        '/v1/stripe/subscriptions/change-plan'
      );
      return NextResponse.json(data);
    }

    const parsed = parseChangePlanBody(await request.json().catch(() => ({})));
    if (!parsed.ok) {
      return json(
        {
          error: 'Invalid request',
          message: PARSE_MESSAGES[parsed.code],
          code: parsed.code,
        },
        400
      );
    }

    if (!STRIPE_PRO_PRICE_ID) {
      console.error('[PlanChange] STRIPE_PRO_PRICE_ID is not set');
      return json(
        {
          error: 'Configuration error',
          message: 'Changing your plan is temporarily unavailable.',
          code: 'PLAN_CHANGE_UNAVAILABLE',
        },
        503
      );
    }

    const loaded = await loadPlanChangeContext(session.user.id);
    if (!loaded.ok) {
      return json(loaded.refusal.body, loaded.refusal.status);
    }
    const ctx = loaded.context;
    const userId = session.user.id;

    //━━ W5a: monthly to yearly, now ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (parsed.billingPeriod === 'yearly') {
      if (!ctx.allowed.includes('upgrade_to_yearly')) {
        return notAllowed('You cannot switch to yearly billing right now');
      }

      const yearlyPriceUsd = await getAnnualPriceUsd();
      if (
        parsed.expectedYearlyPriceUsd !== null &&
        !sameUsdPrice(parsed.expectedYearlyPriceUsd, yearlyPriceUsd)
      ) {
        return json(
          {
            error: 'Price changed',
            message:
              'The yearly price has changed. Please review the new amount.',
            code: 'PRICE_CHANGED',
            currentYearlyPriceUsd: yearlyPriceUsd,
          },
          409
        );
      }

      const yearlyLineItem = await buildProLineItem(
        STRIPE_PRO_PRICE_ID,
        yearlyPriceUsd,
        'yearly'
      );

      // A schedule left attached (the finished phase 2 of an earlier switch)
      // would keep managing the subscription: release it before changing it.
      if (ctx.liveScheduleId) {
        await releaseSubscriptionSchedule(ctx.liveScheduleId);
      }

      let updated;
      try {
        updated = await upgradeToYearlyNow({
          subscriptionId: ctx.row.stripeSubscriptionId,
          itemId: ctx.itemId,
          yearlyLineItem,
          prorationDate: parsed.prorationDate,
          // One quote, one charge: a double click or a retry replays the same
          // Stripe answer. A new quote has a new date, so a new key.
          idempotencyKey: `change-plan:${ctx.row.stripeSubscriptionId}:yearly:${parsed.prorationDate}`,
        });
      } catch (error) {
        if (isStripeCardError(error)) {
          // E2: Stripe refused the change; the subscription is still monthly
          // and nothing was charged.
          console.warn('[PlanChange] The upgrade charge was refused:', error);
          return json(
            {
              error: 'Payment failed',
              message:
                'Your card was not charged and you are still on the monthly plan. Update your card or try another one.',
              code: 'PAYMENT_FAILED',
            },
            402
          );
        }
        throw error;
      }

      const periodEnd = new Date(updated.current_period_end * 1000);
      const invoice =
        updated.latest_invoice && typeof updated.latest_invoice === 'object'
          ? updated.latest_invoice
          : null;
      const amountChargedUsd = invoice ? (invoice.amount_paid ?? 0) / 100 : 0;

      // The invoice webhook records YEARLY at the yearly price for a paid
      // switch, but a trial switch invoices $0 (which that handler skips), so the
      // row is written here for both. The webhook writes the same values.
      try {
        await prisma.subscription.update({
          where: { id: ctx.row.id },
          data: {
            planType: 'YEARLY',
            amountUsd: yearlyPriceUsd,
            stripeCurrentPeriodEnd: periodEnd,
            expiresAt: periodEnd,
            pendingPlanType: null,
            pendingPlanEffectiveAt: null,
            stripeScheduleId: null,
          },
        });
      } catch (dbError) {
        // Stripe has switched and charged: do not tell the user it failed. The
        // webhooks and GET /api/subscription (which reads Stripe's interval)
        // bring the row and the page in line.
        console.error(
          '[PlanChange] The switch was made in Stripe but the row was not updated:',
          dbError
        );
      }

      if (ctx.user.email) {
        try {
          await sendSubscriptionUpgradedEmail(
            ctx.user.email,
            ctx.user.name || 'User',
            'PRO',
            amountChargedUsd,
            yearlyPriceUsd,
            periodEnd,
            ctx.inTrial
          );
        } catch (emailError) {
          console.error(
            '[PlanChange] Error sending the upgrade e-mail:',
            emailError
          );
          // Don't fail the switch if the e-mail fails
        }
      }

      console.log(
        `[PlanChange] User ${userId} switched to yearly billing (charged $${amountChargedUsd})`
      );

      return json(
        {
          success: true,
          message: ctx.inTrial
            ? 'Your plan is now yearly. Nothing is charged until your free trial ends.'
            : 'Your plan is now yearly.',
          billingPeriod: 'yearly',
          amountChargedUsd,
          renewsOn: periodEnd.toISOString(),
          inTrial: ctx.inTrial,
        },
        200
      );
    }

    //━━ W5b: yearly to monthly, at the renewal ━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (ctx.pending) {
      return notAllowed(
        'A switch to monthly billing is already scheduled',
        'ALREADY_PENDING'
      );
    }
    if (!ctx.allowed.includes('switch_to_monthly')) {
      return notAllowed('You cannot switch to monthly billing right now');
    }

    const monthlyPriceUsd = await getBasePriceUsd();
    if (
      parsed.expectedMonthlyPriceUsd !== null &&
      !sameUsdPrice(parsed.expectedMonthlyPriceUsd, monthlyPriceUsd)
    ) {
      return json(
        {
          error: 'Price changed',
          message:
            'The monthly price has changed. Please review the new amount.',
          code: 'PRICE_CHANGED',
          currentMonthlyPriceUsd: monthlyPriceUsd,
        },
        409
      );
    }

    const monthlyLineItem = await buildProLineItem(
      STRIPE_PRO_PRICE_ID,
      monthlyPriceUsd,
      'monthly'
    );

    // A schedule attached while the row says nothing is pending is a leftover
    // or an orphan: it would clash with the new one.
    if (ctx.liveScheduleId) {
      await releaseSubscriptionSchedule(ctx.liveScheduleId);
    }

    const schedule = await scheduleSwitchToMonthly({
      subscriptionId: ctx.row.stripeSubscriptionId,
      monthlyLineItem,
    });
    const effectiveAt = new Date(ctx.live.current_period_end * 1000);

    try {
      await prisma.subscription.update({
        where: { id: ctx.row.id },
        data: {
          pendingPlanType: 'MONTHLY',
          pendingPlanEffectiveAt: effectiveAt,
          stripeScheduleId: schedule.id,
        },
      });
    } catch (dbError) {
      // A schedule the row does not know about would switch the plan with no
      // sign of it on the page: take it back and let the user retry.
      try {
        await releaseSubscriptionSchedule(schedule.id);
      } catch (releaseError) {
        console.error(
          '[PlanChange] Could not take back the schedule after a failed write:',
          releaseError
        );
      }
      throw dbError;
    }

    if (ctx.user.email) {
      try {
        await sendPlanSwitchScheduledEmail(
          ctx.user.email,
          ctx.user.name || 'User',
          'PRO',
          effectiveAt,
          monthlyPriceUsd
        );
      } catch (emailError) {
        console.error(
          '[PlanChange] Error sending the switch e-mail:',
          emailError
        );
        // Don't fail the switch if the e-mail fails
      }
    }

    console.log(
      `[PlanChange] User ${userId} scheduled a switch to monthly billing at ${effectiveAt.toISOString()}`
    );

    return json(
      {
        success: true,
        message:
          'Your plan will switch to monthly billing at your renewal date.',
        billingPeriod: 'monthly',
        effectiveAt: effectiveAt.toISOString(),
        monthlyPriceUsd,
      },
      200
    );
  } catch (error) {
    if (error instanceof MoneyServiceError) {
      return NextResponse.json(error.body, { status: error.status });
    }

    console.error('[PlanChange] Error changing the plan:', error);
    return json(
      {
        error: 'Plan change failed',
        message:
          'We could not change your plan. Nothing was charged. Please try again.',
        code: 'CHANGE_PLAN_ERROR',
      },
      500
    );
  }
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DELETE /api/subscription/change-plan  ("Keep yearly")
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return json(
        {
          error: 'Unauthorized',
          message: 'You must be logged in to change your plan',
          code: 'UNAUTHORIZED',
        },
        401
      );
    }

    if (shouldUseMoneyServiceForStripeWrite()) {
      const data = await forwardWriteRequestToMoneyService(
        request,
        '/v1/stripe/subscriptions/change-plan',
        { method: 'DELETE' }
      );
      return NextResponse.json(data);
    }

    const loaded = await loadPlanChangeContext(session.user.id);
    if (!loaded.ok) {
      return json(loaded.refusal.body, loaded.refusal.status);
    }
    const ctx = loaded.context;

    // Anything pending, in the row or in Stripe, is cleaned up. Keeping yearly
    // charges nothing and is safe to repeat, so a switch that Stripe already
    // dropped (a schedule released in its dashboard) is simply cleared here.
    const scheduleId = ctx.liveScheduleId ?? ctx.row.stripeScheduleId;
    if (!ctx.row.pendingPlanType && !scheduleId) {
      return json(
        {
          error: 'Nothing to undo',
          message: 'No switch to monthly billing is scheduled',
          code: 'NOT_PENDING',
        },
        400
      );
    }

    if (scheduleId) {
      await releaseSubscriptionSchedule(scheduleId);
    }

    await prisma.subscription.update({
      where: { id: ctx.row.id },
      data: {
        pendingPlanType: null,
        pendingPlanEffectiveAt: null,
        stripeScheduleId: null,
      },
    });

    console.log(
      `[PlanChange] User ${session.user.id} kept yearly billing (switch withdrawn)`
    );

    return json(
      {
        success: true,
        message: 'Your plan stays yearly.',
        billingPeriod: 'yearly',
      },
      200
    );
  } catch (error) {
    if (error instanceof MoneyServiceError) {
      return NextResponse.json(error.body, { status: error.status });
    }

    console.error('[PlanChange] Error withdrawing the switch:', error);
    return json(
      {
        error: 'Keep yearly failed',
        message: 'We could not keep your yearly plan. Please try again.',
        code: 'KEEP_YEARLY_ERROR',
      },
      500
    );
  }
}
