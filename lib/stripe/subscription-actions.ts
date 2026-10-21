/**
 * What a subscriber can do about their Stripe subscription, and the state the
 * billing page shows (Manage Subscription S1, defects B2 and B3;
 * docs/handoffs/2026-10-21-manage-subscription-proposal.md §5 and §6).
 *
 * One server function decides `allowedActions`. `GET /api/subscription`
 * returns the list and every write route checks it, so the page never shows a
 * button the server would refuse. This file has no imports and is a byte copy
 * of money-service/src/stripe/subscription-actions.ts; a test fails on any
 * difference.
 *
 * S1 knows three actions. Later sessions add resume, change plan and renew
 * (S2 to S4) by extending this file in both stacks.
 *
 * @module lib/stripe/subscription-actions
 */

export type SubscriptionProvider = 'STRIPE' | 'DLOCAL' | null;

/**
 * - `update_card`: open Stripe's card form (W1).
 * - `pay_now`: open the hosted page of the open invoice (W2).
 * - `cancel`: the cancel flow. In S1 this is today's immediate cancel; S2
 *   replaces it (cancel at period end, no dLocal cancel).
 */
export type SubscriptionAction = 'update_card' | 'pay_now' | 'cancel';

export type SubscriptionDisplayState =
  | 'FREE'
  | 'TRIALING'
  | 'ACTIVE'
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

export function displayStateOf(
  facts: Pick<SubscriptionFacts, 'tier' | 'status'>
): SubscriptionDisplayState {
  if (!showsSubscription(facts.tier, facts.status)) return 'FREE';
  if (facts.status === 'PAST_DUE') return 'PAST_DUE';
  if (facts.status === 'UNPAID') return 'UNPAID';
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

  // TRIALING or ACTIVE. A card can be updated only on a Stripe subscription;
  // the cancel button keeps showing for every PRO user until S2 changes it.
  return facts.provider === 'STRIPE' ? ['update_card', 'cancel'] : ['cancel'];
}
