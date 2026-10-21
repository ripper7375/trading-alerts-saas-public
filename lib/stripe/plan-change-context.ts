/**
 * What the three change-plan routes (preview, switch, keep yearly) all need to
 * know before they touch Stripe (Manage Subscription S3, workflows W5a and W5b):
 * the user, the subscription row, Stripe's live subscription, and what the user
 * may do. The row is read with an explicit `select` (F21): a full-row read
 * breaks when the code is deployed before a migration.
 *
 * Stripe's answer wins where it differs from the row. The plan the subscription
 * bills now is the live item's interval, and a switch to monthly is pending
 * only while a schedule is still attached and the subscription still bills
 * yearly (`effectivePendingPlan`), so a schedule released in Stripe's dashboard
 * or a renewal whose webhook is late cannot show a switch that is not there.
 *
 * @module lib/stripe/plan-change-context
 */

import 'server-only';

import type Stripe from 'stripe';

import { prisma } from '@/lib/db/prisma';
import { getSubscription, proItemOf } from '@/lib/stripe/stripe';
import {
  allowedActionsOf,
  effectivePendingPlan,
  planTypeForInterval,
  providerOf,
  scheduleIdOf,
  type SubscriptionAction,
} from '@/lib/stripe/subscription-actions';

/** A refusal, ready to become a JSON response. */
export interface PlanChangeRefusal {
  status: number;
  body: { error: string; message: string; code: string };
}

export interface PlanChangeContext {
  user: { tier: 'FREE' | 'PRO'; email: string | null; name: string | null };
  row: {
    id: string;
    status: string;
    planType: string | null;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string;
    stripeCurrentPeriodEnd: Date | null;
    cancelAtPeriodEnd: boolean;
    pendingPlanType: string | null;
    pendingPlanEffectiveAt: Date | null;
    stripeScheduleId: string | null;
  };
  /** Stripe's live subscription. */
  live: Stripe.Subscription;
  /** The one PRO item on it. */
  itemId: string;
  /** The billing period the subscription runs on now, from the live interval. */
  livePlanType: 'MONTHLY' | 'YEARLY' | null;
  /** The switch to monthly that is really waiting, else null. */
  pending: ReturnType<typeof effectivePendingPlan>;
  /** The schedule attached to the live subscription, if any. */
  liveScheduleId: string | null;
  inTrial: boolean;
  allowed: SubscriptionAction[];
}

function refusal(
  status: number,
  error: string,
  message: string,
  code: string
): { ok: false; refusal: PlanChangeRefusal } {
  return { ok: false, refusal: { status, body: { error, message, code } } };
}

export async function loadPlanChangeContext(
  userId: string
): Promise<
  | { ok: true; context: PlanChangeContext }
  | { ok: false; refusal: PlanChangeRefusal }
> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { tier: true, email: true, name: true },
  });
  if (!user) {
    return refusal(
      404,
      'User not found',
      'User account not found',
      'USER_NOT_FOUND'
    );
  }

  const row = await prisma.subscription.findUnique({
    where: { userId },
    select: {
      id: true,
      status: true,
      planType: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
      stripeCurrentPeriodEnd: true,
      dLocalPaymentId: true,
      cancelAtPeriodEnd: true,
      pendingPlanType: true,
      pendingPlanEffectiveAt: true,
      stripeScheduleId: true,
    },
  });
  if (user.tier === 'FREE' || !row) {
    return refusal(
      400,
      'No subscription',
      "You don't have an active PRO subscription",
      'NO_SUBSCRIPTION'
    );
  }

  const provider = providerOf(row);
  // A dLocal plan is prepaid: the period is chosen again when it is renewed.
  if (provider === 'DLOCAL') {
    return refusal(
      400,
      'Nothing to change',
      'Your plan is prepaid. You choose the billing period each time you renew it.',
      'DLOCAL_NO_CHANGE'
    );
  }
  if (provider !== 'STRIPE' || !row.stripeSubscriptionId) {
    return refusal(
      400,
      'No card subscription',
      'You do not have a card subscription to change',
      'NO_STRIPE_SUBSCRIPTION'
    );
  }

  const live = await getSubscription(row.stripeSubscriptionId);
  const item = proItemOf(live);
  if (!item) {
    return refusal(
      400,
      'Unsupported subscription',
      'This subscription cannot be changed online. Please contact support.',
      'UNSUPPORTED_SUBSCRIPTION'
    );
  }

  const livePlanType = planTypeForInterval(item.interval);
  const liveScheduleId = scheduleIdOf(live.schedule);
  const pending = effectivePendingPlan(row, {
    hasSchedule: liveScheduleId !== null,
    interval: item.interval,
  });
  const inTrial = live.status === 'trialing';
  // The row can still say ACTIVE for a while after checkout, until the first
  // webhook of the trial arrives; Stripe's word decides.
  const status = row.status === 'ACTIVE' && inTrial ? 'TRIALING' : row.status;

  const allowed = allowedActionsOf({
    tier: user.tier,
    status,
    provider,
    openInvoiceUrl: null,
    cancelAtPeriodEnd:
      typeof live.cancel_at_period_end === 'boolean'
        ? live.cancel_at_period_end
        : row.cancelAtPeriodEnd,
    currentPeriodEnd:
      typeof live.current_period_end === 'number'
        ? new Date(live.current_period_end * 1000)
        : row.stripeCurrentPeriodEnd,
    planType: livePlanType ?? row.planType,
    pendingPlanType: pending?.planType ?? null,
  });

  return {
    ok: true,
    context: {
      user,
      row: { ...row, stripeSubscriptionId: row.stripeSubscriptionId },
      live,
      itemId: item.id,
      livePlanType,
      pending,
      liveScheduleId,
      inTrial,
      allowed,
    },
  };
}
