/**
 * Stripe Client Configuration
 *
 * Centralized Stripe SDK initialization and helper functions
 * for subscription management in the 2-tier system (FREE/PRO).
 *
 * @module lib/stripe/stripe
 */

import 'server-only';

import { createHash } from 'crypto';

import Stripe from 'stripe';

import { invoicePlan, planLineOf } from './invoice-plan';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STRIPE CLIENT INITIALIZATION (LAZY)
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Cached Stripe client instance for lazy initialization.
 * This prevents errors during Next.js build when env vars are not available.
 */
let stripeClient: Stripe | null = null;

/** Per-request timeout of the Stripe SDK, in milliseconds. */
export const STRIPE_REQUEST_TIMEOUT_MS = 15_000;

/**
 * Get the Stripe SDK client instance (lazy initialization)
 * Configured with TypeScript support and latest API version.
 *
 * @returns Stripe client instance
 * @throws Error if STRIPE_SECRET_KEY is not set at runtime
 */
export function getStripeClient(): Stripe {
  if (stripeClient) {
    return stripeClient;
  }

  const secretKey = process.env['STRIPE_SECRET_KEY'];
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY environment variable is not set');
  }

  stripeClient = new Stripe(secretKey, {
    apiVersion: '2024-11-20.acacia' as Stripe.LatestApiVersion,
    typescript: true,
    // Without these the SDK waits 80 s per attempt (its default), well past a
    // Vercel function's budget. One network retry only: the SDK sends the same
    // Idempotency-Key on the retry, so a POST that did reach Stripe is not
    // executed twice.
    timeout: STRIPE_REQUEST_TIMEOUT_MS,
    maxNetworkRetries: 1,
  });

  return stripeClient;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONSTANTS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Stripe Price for the PRO tier. Checkout charges the admin's SystemConfig
 * price (`affiliate_base_price`); this Price supplies the product, billing
 * interval and tax behaviour, and is used as-is when its amount matches.
 */
export const STRIPE_PRO_PRICE_ID = process.env['STRIPE_PRO_PRICE_ID'];

/** How long STRIPE_PRO_PRICE_ID's Price object is trusted before it is fetched again. */
export const PRO_PRICE_CACHE_TTL_MS = 60 * 60 * 1000;

/** STRIPE_PRO_PRICE_ID's Price object, fetched once per process per hour. */
let proPriceCache: {
  id: string;
  price: Promise<Stripe.Price>;
  expiresAt: number;
} | null = null;

function getProPrice(priceId: string): Promise<Stripe.Price> {
  if (proPriceCache?.id !== priceId || Date.now() >= proPriceCache.expiresAt) {
    const price = getStripeClient().prices.retrieve(priceId);
    // A failed lookup must not be cached: the next checkout retries.
    price.catch(() => {
      if (proPriceCache?.price === price) proPriceCache = null;
    });
    proPriceCache = {
      id: priceId,
      price,
      expiresAt: Date.now() + PRO_PRICE_CACHE_TTL_MS,
    };
  }
  return proPriceCache.price;
}

/** For tests: forget the cached Price. */
export function resetProPriceCache(): void {
  proPriceCache = null;
}

/** PRO billing period: monthly (`affiliate_base_price`) or yearly (`affiliate_annual_price`). */
export type BillingPeriod = 'monthly' | 'yearly';

/**
 * The PRO line item for a checkout session, charging `unitAmountUsd` (the
 * SystemConfig price for the billing period) once per month or per year.
 *
 * When the configured Stripe Price already charges that amount in USD on
 * that interval, it is used directly. Otherwise an inline price is built on
 * the same product and tax behaviour, so an admin price change (or the
 * annual plan) applies to new subscribers without editing Stripe. Existing
 * subscriptions keep the price they were created with.
 */
export async function buildProLineItem(
  priceId: string,
  unitAmountUsd: number | undefined,
  billingPeriod: BillingPeriod = 'monthly'
): Promise<Stripe.Checkout.SessionCreateParams.LineItem> {
  const interval = billingPeriod === 'yearly' ? 'year' : 'month';
  if (unitAmountUsd === undefined) {
    if (billingPeriod === 'yearly') {
      throw new Error('An annual checkout needs the SystemConfig annual price');
    }
    return { price: priceId, quantity: 1 };
  }
  if (!Number.isFinite(unitAmountUsd) || unitAmountUsd <= 0) {
    throw new Error(`Invalid PRO price: ${unitAmountUsd}`);
  }
  const unitAmount = Math.round(unitAmountUsd * 100);
  const base = await getProPrice(priceId);
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

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// IDEMPOTENCY (Session 4A-8, CC-C)
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * 60s idempotency window -- collapses a double-click/client retry into the
 * same Stripe request (Stripe caches and returns the original session
 * instead of creating a second one for 24h against this key) without
 * blocking a deliberate later checkout attempt (e.g. retrying after
 * cancelling).
 */
export const CHECKOUT_IDEMPOTENCY_WINDOW_MS = 60_000;

/**
 * Deterministic Stripe idempotency key for a checkout attempt. Pure/no I/O
 * so the caller (app/api/checkout/route.ts) can derive it before calling
 * `createCheckoutSession`. A yearly attempt gets its own key, so switching
 * from monthly to yearly within the window is not answered with the monthly
 * session (monthly keys are unchanged).
 */
export function buildCheckoutIdempotencyKey(
  userId: string,
  affiliateCode: string | undefined,
  billingPeriod: BillingPeriod = 'monthly'
): string {
  const windowBucket = Math.floor(Date.now() / CHECKOUT_IDEMPOTENCY_WINDOW_MS);
  const period = billingPeriod === 'yearly' ? ':yearly' : '';
  return createHash('sha256')
    .update(
      `checkout:${userId}:${affiliateCode ?? 'none'}:${windowBucket}${period}`
    )
    .digest('hex');
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CHECKOUT FUNCTIONS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Create a Stripe Checkout Session for PRO tier upgrade
 *
 * @param userId - User's database ID (stored in metadata)
 * @param userEmail - User's email for pre-filling checkout
 * @param successUrl - URL to redirect after successful payment
 * @param cancelUrl - URL to redirect if user cancels
 * @param affiliateCode - Optional affiliate code for discount tracking
 * @param discountPercent - Optional discount percent to APPLY to the charge
 *   (from the affiliate code; validated by the caller). When > 0, a
 *   one-time Stripe coupon is created and attached to the session so the
 *   customer actually pays the discounted price.
 * @param idempotencyKey - Optional Stripe idempotency key (4A-8, CC-C).
 *   When provided, Stripe itself dedupes retried requests carrying the same
 *   key for 24h, returning the original session instead of creating a
 *   second one -- protects against double-click / client-retry double
 *   billing on this write path. Omitted entirely (not just `undefined`)
 *   when absent so existing callers/tests that don't pass one see no
 *   behavior change.
 * @param existingStripeCustomerId - Optional existing Stripe customer ID
 *   (davintrade-vat-stack, Section 3.1). When a returning customer already
 *   has one on file (e.g. re-subscribing after cancellation), passing it
 *   instead of `customer_email` lets Stripe attach `customer_update` so the
 *   address/name entered at checkout is saved back onto that customer
 *   record -- required for the EU two-factor location-proof rule. Stripe
 *   rejects `customer` and `customer_email` together, so this is mutually
 *   exclusive with the email path.
 * @param unitAmountUsd - The PRO price to charge per billing period, from
 *   SystemConfig (`getBasePriceUsd()` monthly, `getAnnualPriceUsd()` yearly).
 *   Omitted (monthly only): the Stripe Price's own amount.
 * @param billingPeriod - 'monthly' (default) or 'yearly'; recorded in the
 *   session and subscription metadata, which the webhook reads.
 * @returns Stripe Checkout Session
 */
export async function createCheckoutSession(
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
  if (!STRIPE_PRO_PRICE_ID) {
    throw new Error('STRIPE_PRO_PRICE_ID environment variable is not set');
  }
  const lineItem = await buildProLineItem(
    STRIPE_PRO_PRICE_ID,
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
      trial_period_days: 7, // 7-day free trial
    },
    // Multi-jurisdiction tax automation (davintrade-vat-stack, Section 3.1):
    // Stripe Tax calculates VAT/GST from the customer's IP, billing
    // address, and card BIN in real time (EU B2C, UK, dLocal-adjacent
    // markets), and validates any EU VAT number entered against VIES,
    // applying 0% reverse charge automatically when valid.
    // Enabled when STRIPE_TAX_ENABLED=true (e.g. UK Ltd entity with Stripe Tax).
    // Disabled for jurisdictions/accounts without Stripe Tax support (e.g. Thailand).
    ...(process.env['STRIPE_TAX_ENABLED'] === 'true' && {
      automatic_tax: { enabled: true },
    }),
    tax_id_collection: { enabled: true },
    billing_address_collection: 'required',
    ...(existingStripeCustomerId && {
      customer_update: { address: 'auto', name: 'auto' },
    }),
  };

  if (affiliateCode && discountPercent && discountPercent > 0) {
    // Apply the affiliate discount to the first invoice via a one-time
    // coupon. Note: Stripe does not allow `discounts` together with
    // `allow_promotion_codes`, so promotion codes are disabled when an
    // affiliate discount is applied.
    const coupon = await getStripeClient().coupons.create(
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
    sessionParams.allow_promotion_codes = true; // Allow Stripe coupon codes
  }

  const session = idempotencyKey
    ? await getStripeClient().checkout.sessions.create(sessionParams, {
        idempotencyKey,
      })
    : await getStripeClient().checkout.sessions.create(sessionParams);
  return session;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SUBSCRIPTION FUNCTIONS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Cancel a Stripe subscription immediately
 *
 * @param subscriptionId - Stripe subscription ID to cancel
 * @returns Cancelled Stripe Subscription object
 */
export async function cancelSubscription(
  subscriptionId: string
): Promise<Stripe.Subscription> {
  const subscription =
    await getStripeClient().subscriptions.cancel(subscriptionId);
  return subscription;
}

/**
 * Retrieve a Stripe subscription by ID
 *
 * @param subscriptionId - Stripe subscription ID
 * @returns Stripe Subscription object
 */
export async function getSubscription(
  subscriptionId: string
): Promise<Stripe.Subscription> {
  const subscription =
    await getStripeClient().subscriptions.retrieve(subscriptionId);
  return subscription;
}

/**
 * Update a Stripe subscription
 *
 * @param subscriptionId - Stripe subscription ID
 * @param params - Update parameters
 * @returns Updated Stripe Subscription object
 */
export async function updateSubscription(
  subscriptionId: string,
  params: Stripe.SubscriptionUpdateParams
): Promise<Stripe.Subscription> {
  const subscription = await getStripeClient().subscriptions.update(
    subscriptionId,
    params
  );
  return subscription;
}

/**
 * End a subscription at the end of the paid period, or stop that from
 * happening (W3 cancel, W4 resume). PRO continues until the period ends. In
 * a trial the period is the trial: the trial ends and nothing is charged.
 * Idempotent: Stripe returns the subscription unchanged when the flag already
 * has that value.
 *
 * @param subscriptionId - Stripe subscription ID
 * @param cancelAtPeriodEnd - true to schedule the cancellation, false to undo it
 */
export async function setCancelAtPeriodEnd(
  subscriptionId: string,
  cancelAtPeriodEnd: boolean
): Promise<Stripe.Subscription> {
  return updateSubscription(subscriptionId, {
    cancel_at_period_end: cancelAtPeriodEnd,
  });
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PLAN CHANGE (Manage Subscription S3, workflows W5a and W5b)
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * What identifies the new price on a subscription item or a schedule phase: the
 * configured Stripe Price when its amount already matches, else an inline
 * price on the same product (the two shapes `buildProLineItem` returns).
 */
export type ProPriceFields =
  | { price: string; price_data?: undefined }
  | {
      price?: undefined;
      price_data: Stripe.SubscriptionUpdateParams.Item.PriceData;
    };

/** Reduces a checkout line item to the price fields an update call accepts. */
export function proPriceFields(
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
 * The one subscription item that carries the PRO plan. A PRO subscription has
 * exactly one; anything else is left alone (null), so a plan change can never
 * touch an item it does not understand.
 */
export function proItemOf(
  subscription: Stripe.Subscription
): { id: string; interval: string | null } | null {
  const items = subscription.items?.data ?? [];
  const item = items.length === 1 ? items[0] : undefined;
  if (!item) return null;
  return { id: item.id, interval: item.price?.recurring?.interval ?? null };
}

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
 * Stripe's preview of switching the PRO item to the yearly price right now
 * (W5a): the invoice `subscriptions.update(... 'always_invoice')` would create.
 * Passing the same `prorationDate` to the update makes the charge equal this
 * amount. Nothing is created or charged.
 */
export async function previewYearlyUpgrade(input: {
  customerId: string;
  subscription: Stripe.Subscription;
  itemId: string;
  yearlyLineItem: Stripe.Checkout.SessionCreateParams.LineItem;
  prorationDate: number;
}): Promise<YearlyUpgradePreview> {
  const upcoming = await getStripeClient().invoices.retrieveUpcoming({
    customer: input.customerId,
    subscription: input.subscription.id,
    subscription_items: [
      { id: input.itemId, ...proPriceFields(input.yearlyLineItem) },
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
 * Monthly to yearly, now (W5a, decisions D2, E2, E3). The prorated invoice is
 * charged at once; with `error_if_incomplete` a declined card or a 3-D Secure
 * request makes Stripe refuse the whole change (402), so the subscription stays
 * monthly and nothing is charged (E2). During a free trial the price changes now
 * and the first charge at the trial end is the yearly price (E3). The latest
 * invoice is expanded for the amount charged.
 */
export async function upgradeToYearlyNow(input: {
  subscriptionId: string;
  itemId: string;
  yearlyLineItem: Stripe.Checkout.SessionCreateParams.LineItem;
  prorationDate: number;
  idempotencyKey: string;
}): Promise<Stripe.Subscription> {
  return getStripeClient().subscriptions.update(
    input.subscriptionId,
    {
      items: [{ id: input.itemId, ...proPriceFields(input.yearlyLineItem) }],
      proration_behavior: 'always_invoice',
      proration_date: input.prorationDate,
      payment_behavior: 'error_if_incomplete',
      expand: ['latest_invoice'],
    },
    { idempotencyKey: input.idempotencyKey }
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
 * Yearly to monthly at the renewal date (W5b, decision D2): a Subscription
 * Schedule created from the subscription. Phase 1 is the current yearly item
 * until `current_period_end`; phase 2 is the monthly price; `end_behavior:
 * 'release'` hands the subscription back when phase 2 ends. No proration in
 * either phase: no refund and no credit. If the phases cannot be set, the
 * schedule just created is released again.
 */
export async function scheduleSwitchToMonthly(input: {
  subscriptionId: string;
  monthlyLineItem: Stripe.Checkout.SessionCreateParams.LineItem;
}): Promise<Stripe.SubscriptionSchedule> {
  const stripe = getStripeClient();
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
            price: typeof item.price === 'string' ? item.price : item.price.id,
            quantity: item.quantity ?? 1,
          })),
          proration_behavior: 'none',
          ...keep,
        },
        {
          items: [{ ...proPriceFields(input.monthlyLineItem), quantity: 1 }],
          proration_behavior: 'none',
          ...keep,
        },
      ],
    });
  } catch (error) {
    try {
      await stripe.subscriptionSchedules.release(created.id);
    } catch (releaseError) {
      console.error(
        '[PlanChange] Could not release the schedule after a failed setup:',
        releaseError
      );
    }
    throw error;
  }
}

/**
 * Releases a Subscription Schedule: the subscription keeps running exactly as it
 * is, with no phases left to apply ("Keep yearly", and the cancel flow, since
 * Stripe refuses `cancel_at_period_end` while a schedule manages the
 * subscription). A schedule that is already released or gone counts as released.
 */
export async function releaseSubscriptionSchedule(
  scheduleId: string
): Promise<'released' | 'already_released'> {
  try {
    await getStripeClient().subscriptionSchedules.release(scheduleId);
    return 'released';
  } catch (error) {
    if (isScheduleAlreadyReleased(error)) return 'already_released';
    throw error;
  }
}

/**
 * Stripe's refusal to release a schedule that is no longer active, or that no
 * longer exists. Matched on the error's code and wording because the SDK has no
 * dedicated type for it.
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

/**
 * How many months of subscription lifetime each of a subscription's invoices
 * covers (E4): 12 for an invoice whose plan line is yearly (the prorated upgrade
 * invoice included), 1 for a monthly one. Keyed by Stripe invoice id; one list
 * call, the most recent 100 invoices.
 */
export async function getInvoiceMonthsById(
  subscriptionId: string
): Promise<Record<string, number>> {
  const invoices = await getStripeClient().invoices.list({
    subscription: subscriptionId,
    limit: 100,
  });
  const months: Record<string, number> = {};
  for (const invoice of invoices.data) {
    if (invoice.id) months[invoice.id] = invoicePlan(invoice).yearly ? 12 : 1;
  }
  return months;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CUSTOMER FUNCTIONS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * The hosted invoice page of a subscription's latest open invoice: where a
 * subscriber with a failed renewal pays it ("Pay now", W2). Null when no
 * invoice is open or Stripe has no hosted page for it.
 *
 * @param subscriptionId - Stripe subscription ID
 */
export async function getOpenInvoiceUrl(
  subscriptionId: string
): Promise<string | null> {
  const invoices = await getStripeClient().invoices.list({
    subscription: subscriptionId,
    status: 'open',
    limit: 1,
  });
  return invoices.data[0]?.hosted_invoice_url ?? null;
}

/**
 * Get customer's invoices from Stripe
 *
 * @param customerId - Stripe customer ID
 * @param limit - Maximum number of invoices to return (default: 12)
 * @returns Array of Stripe Invoice objects
 */
export async function getCustomerInvoices(
  customerId: string,
  limit: number = 12
): Promise<Stripe.Invoice[]> {
  const invoices = await getStripeClient().invoices.list({
    customer: customerId,
    limit,
  });
  return invoices.data;
}

/**
 * Hard ceiling on a single customer's invoice history. A monthly
 * subscriber accrues 12 a year, so this is decades of billing -- it only
 * exists so a pathological customer can't turn one page load into an
 * unbounded Stripe pagination loop.
 */
export const MAX_INVOICE_HISTORY = 1000;

/**
 * Get a customer's COMPLETE invoice history from Stripe, following
 * Stripe's cursor pagination (100 per page, the API maximum) rather than
 * stopping at the first page the way `getCustomerInvoices` does.
 *
 * @param customerId - Stripe customer ID
 * @returns Every invoice for the customer, newest first (Stripe's order)
 */
export async function getAllCustomerInvoices(
  customerId: string
): Promise<Stripe.Invoice[]> {
  return getStripeClient()
    .invoices.list({ customer: customerId, limit: 100 })
    .autoPagingToArray({ limit: MAX_INVOICE_HISTORY });
}

/**
 * Get customer's payment methods from Stripe
 *
 * @param customerId - Stripe customer ID
 * @returns Array of Stripe PaymentMethod objects
 */
export async function getCustomerPaymentMethods(
  customerId: string
): Promise<Stripe.PaymentMethod[]> {
  const paymentMethods = await getStripeClient().paymentMethods.list({
    customer: customerId,
    type: 'card',
  });
  return paymentMethods.data;
}

/**
 * Retrieve a Stripe customer by ID
 *
 * @param customerId - Stripe customer ID
 * @returns Stripe Customer object
 */
export async function getCustomer(
  customerId: string
): Promise<Stripe.Customer | Stripe.DeletedCustomer> {
  const customer = await getStripeClient().customers.retrieve(customerId);
  return customer;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// WEBHOOK FUNCTIONS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Construct and verify a Stripe webhook event
 *
 * @param payload - Raw request body as string
 * @param signature - Stripe signature from headers
 * @returns Verified Stripe Event object
 * @throws Error if signature verification fails
 */
export function constructWebhookEvent(
  payload: string,
  signature: string
): Stripe.Event {
  const webhookSecret = process.env['STRIPE_WEBHOOK_SECRET'];

  if (!webhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET environment variable is not set');
  }

  const event = getStripeClient().webhooks.constructEvent(
    payload,
    signature,
    webhookSecret
  );
  return event;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BILLING PORTAL
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Create a Stripe Billing Portal session for customer self-service
 *
 * @param customerId - Stripe customer ID
 * @param returnUrl - URL to redirect after portal session
 * @returns Billing Portal Session with URL
 */
export async function createBillingPortalSession(
  customerId: string,
  returnUrl: string
): Promise<Stripe.BillingPortal.Session> {
  const session = await getStripeClient().billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
  return session;
}

/**
 * Create a Stripe Billing Portal session that opens ONLY the card form
 * (W1, decision D4): `flow_data.type = payment_method_update`, under the
 * portal configuration Davin keeps with every other feature off (D5). Stripe
 * sends the customer to `completedUrl` when the new card is saved.
 *
 * @param customerId - Stripe customer ID
 * @param configurationId - STRIPE_PORTAL_CONFIGURATION_ID
 * @param returnUrl - Where the portal's own "return" link goes
 * @param completedUrl - Where Stripe redirects after the card is saved
 */
export async function createPaymentMethodUpdateSession(
  customerId: string,
  configurationId: string,
  returnUrl: string,
  completedUrl: string
): Promise<Stripe.BillingPortal.Session> {
  return getStripeClient().billingPortal.sessions.create({
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
