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

/** PRO billing period: monthly (`affiliate_base_price`) or yearly (`affiliate_annual_price`). */
export type BillingPeriod = 'monthly' | 'yearly';

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

  /** STRIPE_PRO_PRICE_ID's Price object, fetched once per process. */
  private proPriceCache: { id: string; price: Promise<Stripe.Price> } | null =
    null;

  private getProPrice(priceId: string): Promise<Stripe.Price> {
    if (this.proPriceCache?.id !== priceId) {
      const price = this.getClient().prices.retrieve(priceId);
      // A failed lookup must not be cached: the next checkout retries.
      price.catch(() => {
        if (this.proPriceCache?.price === price) this.proPriceCache = null;
      });
      this.proPriceCache = { id: priceId, price };
    }
    return this.proPriceCache.price;
  }

  /**
   * The PRO line item for a checkout session, charging `unitAmountUsd` (the
   * SystemConfig price for the billing period) once per month or per year.
   * Mirrors lib/stripe/stripe.ts buildProLineItem().
   *
   * When the configured Stripe Price already charges that amount in USD on
   * that interval, it is used directly. Otherwise an inline price is built on
   * the same product and tax behaviour, so an admin price change (or the
   * annual plan) applies to new subscribers without editing Stripe. Existing
   * subscriptions keep the price they were created with.
   */
  async buildProLineItem(
    priceId: string,
    unitAmountUsd: number | undefined,
    billingPeriod: BillingPeriod = 'monthly'
  ): Promise<Stripe.Checkout.SessionCreateParams.LineItem> {
    const interval = billingPeriod === 'yearly' ? 'year' : 'month';
    if (unitAmountUsd === undefined) {
      if (billingPeriod === 'yearly') {
        throw new Error(
          'An annual checkout needs the SystemConfig annual price'
        );
      }
      return { price: priceId, quantity: 1 };
    }
    if (!Number.isFinite(unitAmountUsd) || unitAmountUsd <= 0) {
      throw new Error(`Invalid PRO price: ${unitAmountUsd}`);
    }
    const unitAmount = Math.round(unitAmountUsd * 100);
    const base = await this.getProPrice(priceId);
    if (
      base.currency === 'usd' &&
      base.unit_amount === unitAmount &&
      (base.recurring?.interval ?? 'month') === interval &&
      (base.recurring?.interval_count ?? 1) === 1
    ) {
      return { price: priceId, quantity: 1 };
    }
    const taxBehavior =
      base.tax_behavior && base.tax_behavior !== 'unspecified'
        ? base.tax_behavior
        : undefined;
    return {
      price_data: {
        currency: 'usd',
        unit_amount: unitAmount,
        product:
          typeof base.product === 'string' ? base.product : base.product.id,
        recurring: { interval, interval_count: 1 },
        ...(taxBehavior && { tax_behavior: taxBehavior }),
      },
      quantity: 1,
    };
  }

  /**
   * Deterministic Stripe idempotency key for a checkout attempt. Pure/no
   * I/O so the caller can derive it before calling `createCheckoutSession`.
   * A yearly attempt gets its own key (monthly keys are unchanged).
   */
  buildCheckoutIdempotencyKey(
    userId: string,
    affiliateCode: string | undefined,
    billingPeriod: BillingPeriod = 'monthly'
  ): string {
    const windowBucket = Math.floor(
      Date.now() / CHECKOUT_IDEMPOTENCY_WINDOW_MS
    );
    const period = billingPeriod === 'yearly' ? ':yearly' : '';
    return createHash('sha256')
      .update(
        `checkout:${userId}:${affiliateCode ?? 'none'}:${windowBucket}${period}`
      )
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
   * @param unitAmountUsd - The PRO price to charge per billing period, from
   *   SystemConfig (`getBasePriceUsd()` monthly, `getAnnualPriceUsd()`
   *   yearly). Omitted (monthly only): the Stripe Price's own amount.
   * @param billingPeriod - 'monthly' (default) or 'yearly'; recorded in the
   *   session and subscription metadata, which the webhook reads.
   */
  async createCheckoutSession(
    userId: string,
    userEmail: string,
    successUrl: string,
    cancelUrl: string,
    affiliateCode?: string,
    discountPercent?: number,
    idempotencyKey?: string,
    existingStripeCustomerId?: string,
    unitAmountUsd?: number,
    billingPeriod: BillingPeriod = 'monthly'
  ): Promise<Stripe.Checkout.Session> {
    const priceId = this.proTierPriceId;
    if (!priceId) {
      throw new Error('STRIPE_PRO_PRICE_ID environment variable is not set');
    }
    const lineItem = await this.buildProLineItem(
      priceId,
      unitAmountUsd,
      billingPeriod
    );

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: existingStripeCustomerId || undefined,
      customer_email: existingStripeCustomerId ? undefined : userEmail,
      line_items: [lineItem],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        userId,
        tier: 'PRO',
        billingPeriod,
        ...(affiliateCode && { affiliateCode }),
      },
      subscription_data: {
        metadata: {
          userId,
          tier: 'PRO',
          billingPeriod,
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
