/**
 * The tier rule for a Stripe subscription status (Manage Subscription S1,
 * defect B1; docs/handoffs/2026-10-21-manage-subscription-proposal.md §5).
 *
 * `past_due` keeps PRO for as long as Stripe reports it: Stripe's own retry
 * schedule bounds the grace (decision E1), and when the last retry fails
 * Stripe moves the subscription to `canceled` or `unpaid`, which removes PRO.
 *
 * Both webhook handlers (lib/stripe/webhook-handlers.ts and
 * money-service/src/stripe/stripe-webhook.service.ts) decide the tier here.
 * This file is a byte copy of money-service/src/stripe/tier-rule.ts; a test
 * fails on any difference, so the two stacks cannot drift.
 *
 * @module lib/stripe/tier-rule
 */

import type Stripe from 'stripe';

export type StripeTier = 'PRO' | 'FREE';

const TIER_BY_STATUS: Record<Stripe.Subscription.Status, StripeTier> = {
  active: 'PRO',
  trialing: 'PRO',
  past_due: 'PRO',
  unpaid: 'FREE',
  canceled: 'FREE',
  incomplete: 'FREE',
  incomplete_expired: 'FREE',
  paused: 'FREE',
};

/**
 * The tier a subscription in this Stripe status is entitled to. A status
 * Stripe adds later, or one this table does not know, is FREE.
 */
export function tierForStripeStatus(status: string): StripeTier {
  return Object.prototype.hasOwnProperty.call(TIER_BY_STATUS, status)
    ? TIER_BY_STATUS[status as Stripe.Subscription.Status]
    : 'FREE';
}
