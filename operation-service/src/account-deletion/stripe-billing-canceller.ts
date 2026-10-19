import { Injectable } from '@nestjs/common';
import Stripe from 'stripe';

import { PrismaService } from '../prisma/prisma.service';
import { BillingCancellation, BillingCanceller } from './billing-canceller';

/**
 * Cancels a deleted user's Stripe subscription (F21, decided by Davin 2026-10-19).
 *
 * The Stripe client, the live key and the Subscription tables belong to money-service
 * (StripeService). This service reaches Stripe on its own with a RESTRICTED key,
 * STRIPE_RESTRICTED_KEY, created in the Stripe Dashboard with only "Subscriptions: Write", so a
 * leak of this service's environment cannot read customers, issue refunds or create charges.
 *
 * It only cancels. It never writes the Subscription row: Stripe answers the cancellation with a
 * `customer.subscription.deleted` event, which money-service's webhook already turns into
 * status CANCELED (and the tier change through the outbox). The API version is the one
 * money-service pins.
 *
 * Only a user with a Stripe subscription needs the key: a free user or a dLocal-only user
 * completes without it, and a missing key throws only when there is something to cancel.
 *
 * @module account-deletion/stripe-billing-canceller
 */
const STRIPE_API_VERSION = '2024-11-20.acacia';

@Injectable()
export class StripeBillingCanceller extends BillingCanceller {
  private client: Stripe | null = null;

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async cancelForUser(userId: string): Promise<BillingCancellation> {
    // Read-only: core_app may SELECT Subscription, never write it (prisma/roles/roles.sql).
    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
      select: { stripeSubscriptionId: true, status: true },
    });
    const subscriptionId = subscription?.stripeSubscriptionId;
    if (!subscriptionId) return { stripeSubscriptionsCanceled: 0 }; // free, or dLocal only
    if (subscription.status === 'CANCELED') {
      return { stripeSubscriptionsCanceled: 0 }; // the webhook already recorded it
    }

    const stripe = this.getClient();

    // Ask Stripe, not the local row (a webhook can lag): cancelling a subscription that is
    // already cancelled is an error in Stripe, and a retry after a lost response must succeed.
    let live: Stripe.Subscription;
    try {
      live = await stripe.subscriptions.retrieve(subscriptionId);
    } catch (error) {
      if (isNoSuchSubscription(error))
        return { stripeSubscriptionsCanceled: 0 };
      throw error;
    }
    if (live.status === 'canceled') return { stripeSubscriptionsCanceled: 0 };

    try {
      await stripe.subscriptions.cancel(subscriptionId);
    } catch (error) {
      if (isNoSuchSubscription(error))
        return { stripeSubscriptionsCanceled: 0 };
      throw error;
    }
    return { stripeSubscriptionsCanceled: 1 };
  }

  private getClient(): Stripe {
    if (this.client) return this.client;
    const key = process.env['STRIPE_RESTRICTED_KEY'];
    if (!key) {
      throw new Error(
        'STRIPE_RESTRICTED_KEY is not set, so a Stripe subscription cannot be cancelled'
      );
    }
    this.client = this.createClient(key);
    return this.client;
  }

  /** Test seam: the one place a real Stripe client is built. */
  protected createClient(key: string): Stripe {
    return new Stripe(key, {
      apiVersion: STRIPE_API_VERSION as Stripe.LatestApiVersion,
      typescript: true,
      maxNetworkRetries: 2,
      timeout: 20_000,
    });
  }
}

function isNoSuchSubscription(error: unknown): boolean {
  return (
    error instanceof Stripe.errors.StripeInvalidRequestError &&
    error.code === 'resource_missing'
  );
}
