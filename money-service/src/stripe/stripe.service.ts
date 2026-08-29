/**
 * Stripe Service (Session 4A-9, File 1/10)
 *
 * Ported from lib/stripe/stripe.ts. Preserves the lazy-init Stripe client,
 * the fixed `2024-11-20.acacia` API version, and the 60s idempotency-key
 * derivation added in 4A-8 (CC-C) verbatim.
 *
 * Deviation: the 4A-9 order's Invariants section describes a
 * "PRO_MONTHLY / PRO_ANNUAL price ID mapping" -- no such mapping exists in
 * the real SOURCE file. There is a single STRIPE_PRO_PRICE_ID used for
 * every checkout session; billingPeriod is read downstream (webhook
 * handler) from session metadata that the current checkout route never
 * actually sets. Ported as-is (single price ID) -- behavior preservation,
 * not a design fix.
 */

import { createHash } from 'crypto';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

/**
 * 60s idempotency window -- collapses a double-click/client retry into the
 * same Stripe request (Stripe caches and returns the original session
 * instead of creating a second one for 24h against this key) without
 * blocking a deliberate later checkout attempt.
 */
export const CHECKOUT_IDEMPOTENCY_WINDOW_MS = 60_000;

@Injectable()
export class StripeService {
  private stripeClient: Stripe | null = null;

  constructor(private readonly configService: ConfigService) {}

  private getClient(): Stripe {
    if (this.stripeClient) {
      return this.stripeClient;
    }

    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY environment variable is not set');
    }

    this.stripeClient = new Stripe(secretKey, {
      apiVersion: '2024-11-20.acacia' as Stripe.LatestApiVersion,
      typescript: true,
    });

    return this.stripeClient;
  }

  private get proTierPriceId(): string | undefined {
    return this.configService.get<string>('STRIPE_PRO_PRICE_ID');
  }

  /**
   * Deterministic Stripe idempotency key for a checkout attempt. Pure/no
   * I/O so the caller can derive it before calling `createCheckoutSession`.
   */
  buildCheckoutIdempotencyKey(
    userId: string,
    affiliateCode: string | undefined
  ): string {
    const windowBucket = Math.floor(
      Date.now() / CHECKOUT_IDEMPOTENCY_WINDOW_MS
    );
    return createHash('sha256')
      .update(`checkout:${userId}:${affiliateCode ?? 'none'}:${windowBucket}`)
      .digest('hex');
  }

  /**
   * Create a Stripe Checkout Session for PRO tier upgrade.
   *
   * @param idempotencyKey - When provided, Stripe dedupes retried requests
   *   carrying the same key for 24h, returning the original session
   *   instead of creating a second one. Omitted entirely (not just
   *   `undefined`) when absent so existing callers/tests that don't pass
   *   one see no behavior change.
   * @param existingStripeCustomerId - Mirrors lib/stripe/stripe.ts
   *   (davintrade-vat-stack, Section 3.1): when set, attaches `customer`
   *   + `customer_update` instead of `customer_email` so the address/name
   *   entered at checkout is saved onto the existing customer record.
   */
  async createCheckoutSession(
    userId: string,
    userEmail: string,
    successUrl: string,
    cancelUrl: string,
    affiliateCode?: string,
    discountPercent?: number,
    idempotencyKey?: string,
    existingStripeCustomerId?: string
  ): Promise<Stripe.Checkout.Session> {
    const priceId = this.proTierPriceId;
    if (!priceId) {
      throw new Error('STRIPE_PRO_PRICE_ID environment variable is not set');
    }

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: existingStripeCustomerId || undefined,
      customer_email: existingStripeCustomerId ? undefined : userEmail,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        userId,
        tier: 'PRO',
        ...(affiliateCode && { affiliateCode }),
      },
      subscription_data: {
        metadata: {
          userId,
          tier: 'PRO',
          ...(affiliateCode && { affiliateCode }),
        },
        trial_period_days: 7,
      },
      // Multi-jurisdiction tax automation (davintrade-vat-stack, Section 3.1)
      automatic_tax: { enabled: true },
      tax_id_collection: { enabled: true },
      billing_address_collection: 'required',
      ...(existingStripeCustomerId && {
        customer_update: { address: 'auto', name: 'auto' },
      }),
    };

    if (affiliateCode && discountPercent && discountPercent > 0) {
      // Stripe does not allow `discounts` together with
      // `allow_promotion_codes`, so promotion codes are disabled when an
      // affiliate discount is applied.
      const coupon = await this.getClient().coupons.create(
        {
          percent_off: discountPercent,
          duration: 'once',
          name: `Affiliate ${affiliateCode}`,
          metadata: { affiliateCode },
        },
        idempotencyKey
          ? { idempotencyKey: `${idempotencyKey}:coupon` }
          : undefined
      );
      sessionParams.discounts = [{ coupon: coupon.id }];
    } else {
      sessionParams.allow_promotion_codes = true;
    }

    return idempotencyKey
      ? this.getClient().checkout.sessions.create(sessionParams, {
          idempotencyKey,
        })
      : this.getClient().checkout.sessions.create(sessionParams);
  }

  /**
   * Cancel a Stripe subscription immediately.
   */
  async cancelSubscription(
    subscriptionId: string
  ): Promise<Stripe.Subscription> {
    return this.getClient().subscriptions.cancel(subscriptionId);
  }

  /**
   * Retrieve a Charge by id. Used by the refund/dispute commission-clawback
   * path: a `charge.dispute.created` payload only carries the charge id,
   * not the customer, so the charge is fetched to resolve it.
   */
  async retrieveCharge(chargeId: string): Promise<Stripe.Charge> {
    return this.getClient().charges.retrieve(chargeId);
  }

  /**
   * Construct and verify a Stripe webhook event.
   *
   * @throws Error if signature verification fails, or STRIPE_WEBHOOK_SECRET
   *   is not set.
   */
  constructEvent(payload: string | Buffer, signature: string): Stripe.Event {
    const webhookSecret = this.configService.get<string>(
      'STRIPE_WEBHOOK_SECRET'
    );

    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET environment variable is not set');
    }

    return this.getClient().webhooks.constructEvent(
      payload,
      signature,
      webhookSecret
    );
  }
}
