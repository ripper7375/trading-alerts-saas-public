/**
 * What a subscriber can do about their subscription, and the state the billing
 * page shows (Manage Subscription S1 and S2, defects B2, B3, B5 and B7;
 * docs/handoffs/2026-10-21-manage-subscription-proposal.md §5 and §6).
 *
 * One server function decides `allowedActions`. `GET /api/subscription`
 * returns the list and every write route checks it, so the page never shows a
 * button the server would refuse. This file has no imports and is a byte copy
 * of money-service/src/stripe/subscription-actions.ts; a test fails on any
 * difference.
 *
 * S2 added `resume` and the CANCEL_SCHEDULED display state, and took `cancel`
 * away from dLocal (D8: a dLocal plan is prepaid and simply ends at
 * `expiresAt`). S3 added the billing-period actions (W5a upgrade now, W5b
 * switch to monthly at renewal, and the undo), the DOWNGRADE_PENDING display
 * state, and the checks both stacks share for a change-plan request. S4 extends
 * this file by renew.
 *
 * @module lib/stripe/subscription-actions
 */

export type SubscriptionProvider = 'STRIPE' | 'DLOCAL' | null;

/** The longest cancellation reason the cancel route stores (characters). */
export const CANCELLATION_REASON_MAX = 500;

export type ParsedCancellationReason =
  | { ok: true; reason: string | null }
  | { ok: false };

/**
 * Reads `reason` from a cancel request body (B6: the page collected it and
 * never sent it). It is optional and free text: a reason code from the form,
 * or "other: ..." with the user's own words. Control characters become spaces,
 * the ends are trimmed, an empty answer is `null`, and a value that is not a
 * string or is longer than CANCELLATION_REASON_MAX is refused.
 */
export function parseCancellationReason(
  body: unknown
): ParsedCancellationReason {
  const raw =
    body !== null && typeof body === 'object'
      ? (body as { reason?: unknown }).reason
      : undefined;
  if (raw === undefined || raw === null) return { ok: true, reason: null };
  if (typeof raw !== 'string') return { ok: false };
  const reason = raw.replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
  if (reason.length > CANCELLATION_REASON_MAX) return { ok: false };
  return { ok: true, reason: reason === '' ? null : reason };
}

/**
 * - `update_card`: open Stripe's card form (W1).
 * - `pay_now`: open the hosted page of the open invoice (W2).
 * - `cancel`: the cancel flow, which cancels at the end of the paid period (W3).
 * - `resume`: undo a scheduled cancellation before the period ends (W4).
 * - `upgrade_to_yearly`: monthly to yearly, charged now with proration (W5a).
 * - `switch_to_monthly`: yearly to monthly at the renewal date (W5b).
 * - `keep_yearly`: withdraw a switch to monthly that is scheduled (W5b undo).
 */
export type SubscriptionAction =
  | 'update_card'
  | 'pay_now'
  | 'cancel'
  | 'resume'
  | 'upgrade_to_yearly'
  | 'switch_to_monthly'
  | 'keep_yearly';

/**
 * `CANCEL_SCHEDULED` and `DOWNGRADE_PENDING` are display states derived from
 * stored data (`cancelAtPeriodEnd`, `pendingPlanType`), not statuses of their
 * own: the subscription is still ACTIVE or TRIALING in Stripe and PRO.
 */
export type SubscriptionDisplayState =
  | 'FREE'
  | 'TRIALING'
  | 'ACTIVE'
  | 'CANCEL_SCHEDULED'
  | 'DOWNGRADE_PENDING'
  | 'PAST_DUE'
  | 'UNPAID';

export interface SubscriptionFacts {
  tier: 'FREE' | 'PRO';
  /** The stored Subscription.status; null when the user has no row. */
  status: string | null;
  provider: SubscriptionProvider;
  /** Hosted invoice URL of the latest open invoice, when one is known. */
  openInvoiceUrl: string | null;
  /** Admin "view as user": every action is hidden, nothing may be started. */
  viewing?: boolean;
  /**
   * Stripe's `cancel_at_period_end`: the live value when it was read, else the
   * stored column. Counts for a Stripe subscription only.
   */
  cancelAtPeriodEnd?: boolean;
  /**
   * End of the current paid period (the trial end during a trial). Resume is
   * offered only before it. Unknown (null or missing) counts as "before".
   */
  currentPeriodEnd?: Date | string | null;
  /**
   * The billing period the subscription runs on now: 'MONTHLY' or 'YEARLY'
   * (the live Stripe interval when it was read, else the stored `planType`).
   * Unknown (missing or anything else) offers no billing-period action.
   */
  planType?: string | null;
  /**
   * 'MONTHLY' while a switch to monthly waits for the renewal date (W5b),
   * else null. Counts for a Stripe subscription only.
   */
  pendingPlanType?: string | null;
  /** The clock; tests pass one. */
  now?: Date;
}

/** Same precedence the billing page has always used: dLocal, then Stripe. */
export function providerOf(row: {
  dLocalPaymentId?: string | null;
  stripeSubscriptionId?: string | null;
}): SubscriptionProvider {
  if (row.dLocalPaymentId) return 'DLOCAL';
  if (row.stripeSubscriptionId) return 'STRIPE';
  return null;
}

/**
 * True when the stored status is a failed-payment state. A user in one of
 * them may have been moved to FREE (UNPAID, or a PAST_DUE row downgraded
 * before S1 shipped) and still needs the subscription block to resolve it.
 */
export function isPaymentProblem(status: string | null): boolean {
  return status === 'PAST_DUE' || status === 'UNPAID';
}

/**
 * Whether `GET /api/subscription` returns the subscription block: while the
 * user is PRO, or while a failed payment is waiting to be resolved (B2).
 */
export function showsSubscription(
  tier: 'FREE' | 'PRO',
  status: string | null
): boolean {
  return status !== null && (tier === 'PRO' || isPaymentProblem(status));
}

/**
 * True while the paid period (or the trial) has not ended yet. A date that
 * cannot be read counts as "not ended": Stripe is the judge, and refuses a
 * resume on a subscription that is already gone.
 */
function beforePeriodEnd(
  currentPeriodEnd: Date | string | null | undefined,
  now: Date | undefined
): boolean {
  if (currentPeriodEnd === null || currentPeriodEnd === undefined) return true;
  const end = new Date(currentPeriodEnd).getTime();
  if (Number.isNaN(end)) return true;
  return end > (now ?? new Date()).getTime();
}

export function displayStateOf(
  facts: Pick<SubscriptionFacts, 'tier' | 'status'> &
    Partial<
      Pick<
        SubscriptionFacts,
        'provider' | 'cancelAtPeriodEnd' | 'pendingPlanType'
      >
    >
): SubscriptionDisplayState {
  if (!showsSubscription(facts.tier, facts.status)) return 'FREE';
  if (facts.status === 'PAST_DUE') return 'PAST_DUE';
  if (facts.status === 'UNPAID') return 'UNPAID';
  // A failed payment outranks a scheduled cancellation (checked above): the
  // user has to resolve it first. Only a Stripe subscription can be scheduled
  // to cancel; a dLocal row keeps whatever the column held.
  if (facts.cancelAtPeriodEnd === true && facts.provider === 'STRIPE') {
    return 'CANCEL_SCHEDULED';
  }
  // A cancellation outranks a pending switch to monthly: nothing renews, so
  // there is nothing to switch.
  if (facts.pendingPlanType === 'MONTHLY' && facts.provider === 'STRIPE') {
    return 'DOWNGRADE_PENDING';
  }
  if (facts.status === 'TRIALING') return 'TRIALING';
  return 'ACTIVE';
}

export function allowedActionsOf(
  facts: SubscriptionFacts
): SubscriptionAction[] {
  if (facts.viewing) return [];

  const state = displayStateOf(facts);
  if (state === 'FREE') return [];

  if (state === 'PAST_DUE' || state === 'UNPAID') {
    // Only Stripe retries and invoices; and no cancel until the payment is
    // resolved (plan §6).
    if (facts.provider !== 'STRIPE') return [];
    return facts.openInvoiceUrl ? ['pay_now', 'update_card'] : ['update_card'];
  }

  if (state === 'CANCEL_SCHEDULED') {
    // Resume only before the period ends; the card can still be updated.
    return beforePeriodEnd(facts.currentPeriodEnd, facts.now)
      ? ['resume', 'update_card']
      : ['update_card'];
  }

  // TRIALING, ACTIVE or DOWNGRADE_PENDING. Cancel, update card and the
  // billing-period actions exist for a Stripe subscription only: a dLocal plan
  // is prepaid and ends at `expiresAt` (D8), and a row with no provider has
  // nothing to cancel.
  if (facts.provider !== 'STRIPE') return [];

  if (state === 'DOWNGRADE_PENDING') {
    // Cancel is offered here too: the server releases the pending switch first
    // (plan §6, W3).
    return ['keep_yearly', 'update_card', 'cancel'];
  }

  const actions: SubscriptionAction[] = ['update_card'];
  if (facts.planType === 'MONTHLY') {
    // Also during the free trial (decision E3): the price changes now, the
    // first charge at the trial end is the yearly price.
    actions.push('upgrade_to_yearly');
  } else if (facts.planType === 'YEARLY' && state === 'ACTIVE') {
    actions.push('switch_to_monthly');
  }
  actions.push('cancel');
  return actions;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BILLING PERIOD (Manage Subscription S3, workflows W5a and W5b)
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** `Subscription.planType` for a Stripe recurring interval, null if neither. */
export function planTypeForInterval(
  interval: string | null | undefined
): 'MONTHLY' | 'YEARLY' | null {
  if (interval === 'month') return 'MONTHLY';
  if (interval === 'year') return 'YEARLY';
  return null;
}

/**
 * The recurring interval of a Stripe subscription's one PRO item, null when the
 * subscription is unknown or does not have exactly one item. Structural, so the
 * routes and the webhooks read it the same way without importing Stripe types.
 */
export function liveIntervalOf(
  subscription:
    | {
        items?: {
          data?: ReadonlyArray<{
            price?: { recurring?: { interval?: string | null } | null } | null;
          }>;
        };
      }
    | null
    | undefined
): string | null {
  const items = subscription?.items?.data ?? [];
  return items.length === 1
    ? (items[0]?.price?.recurring?.interval ?? null)
    : null;
}

/** The id of the schedule a Stripe subscription points at (string or object). */
export function scheduleIdOf(
  schedule: string | { id: string } | null | undefined
): string | null {
  if (typeof schedule === 'string') return schedule === '' ? null : schedule;
  return schedule && typeof schedule.id === 'string' ? schedule.id : null;
}

/**
 * The pending switch to monthly that is real. The stored columns say what was
 * scheduled; Stripe says whether it still is. With Stripe's answer in hand
 * (`live`), the switch is pending only while a schedule is attached and the
 * subscription still bills yearly: a schedule released in Stripe's dashboard, or
 * a renewal that already moved to phase 2, ends it even if the webhook is late.
 * Without it, the stored date decides.
 */
export function effectivePendingPlan(
  stored: {
    pendingPlanType?: string | null;
    pendingPlanEffectiveAt?: Date | string | null;
  },
  live: { hasSchedule: boolean; interval: string | null } | null,
  now: Date = new Date()
): { planType: 'MONTHLY'; effectiveAt: Date | null } | null {
  if (stored.pendingPlanType !== 'MONTHLY') return null;
  const raw = stored.pendingPlanEffectiveAt;
  const effectiveAt = raw ? new Date(raw) : null;
  const validDate =
    effectiveAt !== null && !Number.isNaN(effectiveAt.getTime())
      ? effectiveAt
      : null;
  if (live) {
    return live.hasSchedule && live.interval === 'year'
      ? { planType: 'MONTHLY', effectiveAt: validDate }
      : null;
  }
  return validDate === null || validDate.getTime() > now.getTime()
    ? { planType: 'MONTHLY', effectiveAt: validDate }
    : null;
}

/**
 * How old a quote's `prorationDate` may be when the charge is made. The credit
 * for the unused monthly time grows the earlier the date, so an old date would
 * be a cheaper upgrade: the date is bounded on the server, not trusted.
 */
export const PRORATION_MAX_AGE_SECONDS = 30 * 60;
/** Clock slack allowed for a `prorationDate` ahead of the server's clock. */
export const PRORATION_MAX_FUTURE_SECONDS = 60;

export type ParsedChangePlan =
  | {
      ok: true;
      billingPeriod: 'yearly';
      prorationDate: number;
      /** The yearly price the user was shown, USD; null when not sent. */
      expectedYearlyPriceUsd: number | null;
    }
  | {
      ok: true;
      billingPeriod: 'monthly';
      /** The monthly price the user was shown, USD; null when not sent. */
      expectedMonthlyPriceUsd: number | null;
    }
  | {
      ok: false;
      code:
        | 'INVALID_BILLING_PERIOD'
        | 'INVALID_PRORATION_DATE'
        | 'PRORATION_EXPIRED'
        | 'INVALID_EXPECTED_PRICE';
    };

/**
 * Reads a change-plan request body: `{ billingPeriod: 'monthly',
 * expectedMonthlyPriceUsd? }` for the switch at renewal, `{ billingPeriod:
 * 'yearly', prorationDate, expectedYearlyPriceUsd? }` for the upgrade now.
 * `prorationDate` is the Unix time (seconds) of the quote the user confirmed;
 * the expected price is the one on screen, so a price changed meanwhile is
 * caught before anything is charged or scheduled.
 */
export function parseChangePlanBody(
  body: unknown,
  nowSeconds: number = Math.floor(Date.now() / 1000)
): ParsedChangePlan {
  const input =
    body !== null && typeof body === 'object'
      ? (body as Record<string, unknown>)
      : {};

  if (input['billingPeriod'] === 'monthly') {
    const expectedMonthly = input['expectedMonthlyPriceUsd'];
    if (expectedMonthly === undefined || expectedMonthly === null) {
      return {
        ok: true,
        billingPeriod: 'monthly',
        expectedMonthlyPriceUsd: null,
      };
    }
    if (
      typeof expectedMonthly !== 'number' ||
      !Number.isFinite(expectedMonthly) ||
      expectedMonthly <= 0
    ) {
      return { ok: false, code: 'INVALID_EXPECTED_PRICE' };
    }
    return {
      ok: true,
      billingPeriod: 'monthly',
      expectedMonthlyPriceUsd: expectedMonthly,
    };
  }
  if (input['billingPeriod'] !== 'yearly') {
    return { ok: false, code: 'INVALID_BILLING_PERIOD' };
  }

  const prorationDate = input['prorationDate'];
  if (
    typeof prorationDate !== 'number' ||
    !Number.isInteger(prorationDate) ||
    prorationDate <= 0
  ) {
    return { ok: false, code: 'INVALID_PRORATION_DATE' };
  }
  if (
    prorationDate < nowSeconds - PRORATION_MAX_AGE_SECONDS ||
    prorationDate > nowSeconds + PRORATION_MAX_FUTURE_SECONDS
  ) {
    return { ok: false, code: 'PRORATION_EXPIRED' };
  }

  const expected = input['expectedYearlyPriceUsd'];
  if (expected === undefined || expected === null) {
    return {
      ok: true,
      billingPeriod: 'yearly',
      prorationDate,
      expectedYearlyPriceUsd: null,
    };
  }
  if (
    typeof expected !== 'number' ||
    !Number.isFinite(expected) ||
    expected <= 0
  ) {
    return { ok: false, code: 'INVALID_EXPECTED_PRICE' };
  }
  return {
    ok: true,
    billingPeriod: 'yearly',
    prorationDate,
    expectedYearlyPriceUsd: expected,
  };
}

/** True when two USD prices are the same amount to the cent. */
export function sameUsdPrice(a: number, b: number): boolean {
  return Math.round(a * 100) === Math.round(b * 100);
}
