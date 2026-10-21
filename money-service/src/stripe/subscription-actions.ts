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
 * `expiresAt`). S3 and S4 extend this file by change-plan and renew.
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
 */
export type SubscriptionAction =
  | 'update_card'
  | 'pay_now'
  | 'cancel'
  | 'resume';

/**
 * `CANCEL_SCHEDULED` is a display state derived from the stored
 * `cancelAtPeriodEnd`, not a status of its own: the subscription is still
 * ACTIVE or TRIALING in Stripe and PRO until the period ends.
 */
export type SubscriptionDisplayState =
  | 'FREE'
  | 'TRIALING'
  | 'ACTIVE'
  | 'CANCEL_SCHEDULED'
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
    Partial<Pick<SubscriptionFacts, 'provider' | 'cancelAtPeriodEnd'>>
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

  // TRIALING or ACTIVE. Cancel and update card exist for a Stripe subscription
  // only: a dLocal plan is prepaid and ends at `expiresAt` (D8), and a row with
  // no provider has nothing to cancel.
  return facts.provider === 'STRIPE' ? ['update_card', 'cancel'] : [];
}
