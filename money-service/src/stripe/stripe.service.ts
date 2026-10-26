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

import { logger } from '../common/logger.util';

import { invoicePlan, planLineOf } from './invoice-plan';

/** What identifies the new price on a subscription item or a schedule phase. */
export type ProPriceFields =
  | { price: string; price_data?: undefined }
  | {
      price?: undefined;
      price_data: Stripe.SubscriptionUpdateParams.Item.PriceData;
    };

export interface YearlyUpgradePreview {
  /** What the customer pays now, tax included. 0 during the free trial. */
  amountDueNowUsd: number;
  /** The credit for the unused part of the current month, as a positive number. */
  creditUsd: number;
  taxUsd: number;
  /** When the yearly plan renews, or when the first charge is during a trial. */
  renewsOn: Date | null;
  inTrial: boolean;
}

/**
 * Stripe's refusal to release a schedule that is no longer active, or that no
 * longer exists. Matched on the error's code and wording because the SDK has no
 * dedicated type for it. Mirrors lib/stripe/stripe.ts.
 */
export function isScheduleAlreadyReleased(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const { code, message } = error as { code?: unknown; message?: unknown };
  if (code === 'resource_missing') return true;
  return (
    typeof message === 'string' &&
    /(already|not) .*(released|canceled|cancelled|completed|active)|No such subscription schedule/i.test(
      message
    )
  );
}

/** True when `error` is a Stripe card error: declined, or needs authentication. */
export function isStripeCardError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const { type, statusCode } = error as {
    type?: unknown;
    statusCode?: unknown;
  };
  return type === 'StripeCardError' || statusCode === 402;
}

/**
 * The one subscription item that carries the PRO plan. A PRO subscription has
 * exactly one; anything else is left alone (null). Mirrors lib/stripe/stripe.ts.
 */
export function proItemOf(
  subscription: Stripe.Subscription
): { id: string; interval: string | null } | null {
  const items = subscription.items?.data ?? [];
  const item = items.length === 1 ? items[0] : undefined;
  if (!item) return null;
  return { id: item.id, interval: item.price?.recurring?.interval ?? null };
}

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
      // Multi-jurisdiction tax automation (davintrade-vat-stack, Section 3.1).
      // Enabled when STRIPE_TAX_ENABLED=true (e.g. UK Ltd entity with Stripe Tax).
      // Disabled for jurisdictions/accounts without Stripe Tax support (e.g. Thailand).
      ...(this.configService.get<string>('STRIPE_TAX_ENABLED') === 'true' && {
        automatic_tax: { enabled: true },
      }),
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
   * End a subscription at the end of the paid period, or stop that from
   * happening (W3 cancel, W4 resume). PRO continues until the period ends; in
   * a trial the period is the trial, so it ends then with no charge.
   * Idempotent: Stripe returns the subscription unchanged when the flag already
   * has that value. Mirrors lib/stripe/stripe.ts setCancelAtPeriodEnd().
   */
  async setCancelAtPeriodEnd(
    subscriptionId: string,
    cancelAtPeriodEnd: boolean
  ): Promise<Stripe.Subscription> {
    return this.getClient().subscriptions.update(subscriptionId, {
      cancel_at_period_end: cancelAtPeriodEnd,
    });
  }

  /** Retrieve a Stripe subscription by id. */
  async getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    return this.getClient().subscriptions.retrieve(subscriptionId);
  }

  /**
   * Reduces a checkout line item to the price fields an update call accepts:
   * the configured Stripe Price when its amount already matches, else an inline
   * price on the same product. Mirrors lib/stripe/stripe.ts proPriceFields().
   */
  proPriceFields(
    lineItem: Stripe.Checkout.SessionCreateParams.LineItem
  ): ProPriceFields {
    if (lineItem.price) return { price: lineItem.price };
    const data = lineItem.price_data;
    if (
      !data ||
      !data.product ||
      data.unit_amount === undefined ||
      !data.recurring
    ) {
      throw new Error('The PRO line item has no usable price');
    }
    return {
      price_data: {
        currency: data.currency,
        product: data.product,
        unit_amount: data.unit_amount,
        recurring: {
          interval: data.recurring.interval,
          interval_count: data.recurring.interval_count ?? 1,
        },
        ...(data.tax_behavior && { tax_behavior: data.tax_behavior }),
      },
    };
  }

  /**
   * The PRO line item for `unitAmountUsd` on `billingPeriod`, from the
   * configured STRIPE_PRO_PRICE_ID. Used by the plan-change flows (W5a, W5b).
   */
  async proLineItemFor(
    unitAmountUsd: number,
    billingPeriod: BillingPeriod
  ): Promise<Stripe.Checkout.SessionCreateParams.LineItem> {
    const priceId = this.proTierPriceId;
    if (!priceId) {
      throw new Error('STRIPE_PRO_PRICE_ID environment variable is not set');
    }
    return this.buildProLineItem(priceId, unitAmountUsd, billingPeriod);
  }

  /**
   * Stripe's preview of switching the PRO item to the yearly price right now
   * (W5a). Mirrors lib/stripe/stripe.ts previewYearlyUpgrade(): nothing is
   * created or charged, and the same `prorationDate` given to
   * `upgradeToYearlyNow` makes the charge equal this amount.
   */
  async previewYearlyUpgrade(input: {
    customerId: string;
    subscription: Stripe.Subscription;
    itemId: string;
    yearlyLineItem: Stripe.Checkout.SessionCreateParams.LineItem;
    prorationDate: number;
  }): Promise<YearlyUpgradePreview> {
    const upcoming = await this.getClient().invoices.retrieveUpcoming({
      customer: input.customerId,
      subscription: input.subscription.id,
      subscription_items: [
        { id: input.itemId, ...this.proPriceFields(input.yearlyLineItem) },
      ],
      subscription_proration_behavior: 'always_invoice',
      subscription_proration_date: input.prorationDate,
    });

    const inTrial = input.subscription.status === 'trialing';
    const lines = upcoming.lines?.data ?? [];
    const planLine = planLineOf(upcoming as unknown as Stripe.Invoice);
    const creditCents = lines
      .filter((l) => l.proration && l.amount < 0)
      .reduce((sum, l) => sum - l.amount, 0);
    const trialEnd = input.subscription.trial_end;
    const periodEnd = planLine?.period?.end;

    return {
      amountDueNowUsd: upcoming.amount_due / 100,
      creditUsd: creditCents / 100,
      taxUsd: (upcoming.tax ?? 0) / 100,
      renewsOn:
        inTrial && trialEnd
          ? new Date(trialEnd * 1000)
          : periodEnd
            ? new Date(periodEnd * 1000)
            : null,
      inTrial,
    };
  }

  /**
   * Monthly to yearly, now (W5a, decisions D2, E2, E3). With
   * `error_if_incomplete` a declined card or a 3-D Secure request makes Stripe
   * refuse the whole change (402): the subscription stays monthly and nothing
   * is charged. Mirrors lib/stripe/stripe.ts upgradeToYearlyNow().
   */
  async upgradeToYearlyNow(input: {
    subscriptionId: string;
    itemId: string;
    yearlyLineItem: Stripe.Checkout.SessionCreateParams.LineItem;
    prorationDate: number;
    idempotencyKey: string;
  }): Promise<Stripe.Subscription> {
    return this.getClient().subscriptions.update(
      input.subscriptionId,
      {
        items: [
          { id: input.itemId, ...this.proPriceFields(input.yearlyLineItem) },
        ],
        proration_behavior: 'always_invoice',
        proration_date: input.prorationDate,
        payment_behavior: 'error_if_incomplete',
        expand: ['latest_invoice'],
      },
      { idempotencyKey: input.idempotencyKey }
    );
  }

  /**
   * Yearly to monthly at the renewal date (W5b): a Subscription Schedule from
   * the subscription, phase 1 the current yearly item until its period end,
   * phase 2 the monthly price, no proration, `end_behavior: 'release'`. Mirrors
   * lib/stripe/stripe.ts scheduleSwitchToMonthly(); a schedule whose phases
   * cannot be set is released again.
   */
  async scheduleSwitchToMonthly(input: {
    subscriptionId: string;
    monthlyLineItem: Stripe.Checkout.SessionCreateParams.LineItem;
  }): Promise<Stripe.SubscriptionSchedule> {
    const stripe = this.getClient();
    const created = await stripe.subscriptionSchedules.create({
      from_subscription: input.subscriptionId,
    });
    try {
      const current = created.phases[0];
      if (!current || !current.end_date) {
        throw new Error('The schedule has no current phase to continue');
      }
      const keep = {
        ...(current.automatic_tax && {
          automatic_tax: { enabled: current.automatic_tax.enabled },
        }),
        ...(typeof current.default_payment_method === 'string' && {
          default_payment_method: current.default_payment_method,
        }),
      };
      return await stripe.subscriptionSchedules.update(created.id, {
        end_behavior: 'release',
        phases: [
          {
            start_date: current.start_date,
            end_date: current.end_date,
            items: current.items.map((item) => ({
              price:
                typeof item.price === 'string' ? item.price : item.price.id,
              quantity: item.quantity ?? 1,
            })),
            proration_behavior: 'none',
            ...keep,
          },
          {
            items: [
              { ...this.proPriceFields(input.monthlyLineItem), quantity: 1 },
            ],
            proration_behavior: 'none',
            ...keep,
          },
        ],
      });
    } catch (error) {
      try {
        await stripe.subscriptionSchedules.release(created.id);
      } catch (releaseError) {
        logger.error(
          '[PlanChange] Could not release the schedule after a failed setup',
          {
            error:
              releaseError instanceof Error
                ? releaseError.message
                : 'Unknown error',
          }
        );
      }
      throw error;
    }
  }

  /**
   * Releases a Subscription Schedule: the subscription keeps running exactly as
   * it is. A schedule that is already released or gone counts as released.
   * Mirrors lib/stripe/stripe.ts releaseSubscriptionSchedule().
   */
  async releaseSubscriptionSchedule(
    scheduleId: string
  ): Promise<'released' | 'already_released'> {
    try {
      await this.getClient().subscriptionSchedules.release(scheduleId);
      return 'released';
    } catch (error) {
      if (isScheduleAlreadyReleased(error)) return 'already_released';
      throw error;
    }
  }

  /**
   * How many months of subscription lifetime each of a subscription's invoices
   * covers (E4): 12 for a yearly plan line (the prorated upgrade invoice
   * included), 1 for a monthly one. Keyed by Stripe invoice id; one list call.
   */
  async getInvoiceMonthsById(
    subscriptionId: string
  ): Promise<Record<string, number>> {
    const invoices = await this.getClient().invoices.list({
      subscription: subscriptionId,
      limit: 100,
    });
    const months: Record<string, number> = {};
    for (const invoice of invoices.data) {
      if (invoice.id) months[invoice.id] = invoicePlan(invoice).yearly ? 12 : 1;
    }
    return months;
  }

  /**
   * Create a Billing Portal session that opens ONLY the card form (W1,
   * decision D4): `flow_data.type = payment_method_update`, under the portal
   * configuration kept with every other feature off (D5). Mirrors
   * lib/stripe/stripe.ts createPaymentMethodUpdateSession().
   */
  async createPaymentMethodUpdateSession(
    customerId: string,
    configurationId: string,
    returnUrl: string,
    completedUrl: string
  ): Promise<Stripe.BillingPortal.Session> {
    return this.getClient().billingPortal.sessions.create({
      customer: customerId,
      configuration: configurationId,
      return_url: returnUrl,
      flow_data: {
        type: 'payment_method_update',
        after_completion: {
          type: 'redirect',
          redirect: { return_url: completedUrl },
        },
      },
    });
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
