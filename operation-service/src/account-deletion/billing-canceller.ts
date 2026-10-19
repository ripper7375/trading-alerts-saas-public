export interface BillingCancellation {
  /** Stripe subscriptions this call cancelled (0 when there was nothing left to stop). */
  stripeSubscriptionsCanceled: number;
}

/**
 * Stops every recurring charge for a user whose account is being deleted (F21). The deletion
 * worker calls it BEFORE it completes the request, so a subscription is never left billing a
 * deleted account.
 *
 * Contract: idempotent (a second call for the same user changes nothing), and it THROWS if it
 * cannot be sure billing has stopped. The worker then leaves the request for the next run; it
 * never completes a deletion on a failed cancellation.
 *
 * An abstract class, not an interface, so it can be the Nest injection token. The binding is in
 * AccountDeletionModule (StripeBillingCanceller).
 */
export abstract class BillingCanceller {
  abstract cancelForUser(userId: string): Promise<BillingCancellation>;
}
