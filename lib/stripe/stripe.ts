/**
 * Stripe Client Configuration
 *
 * Centralized Stripe SDK initialization and helper functions
 * for subscription management in the 2-tier system (FREE/PRO).
 *
 * @module lib/stripe/stripe
 */

import { createHash } from 'crypto';

import Stripe from 'stripe';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STRIPE CLIENT INITIALIZATION (LAZY)
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Cached Stripe client instance for lazy initialization.
 * This prevents errors during Next.js build when env vars are not available.
 */
let stripeClient: Stripe | null = null;

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

/** STRIPE_PRO_PRICE_ID's Price object, fetched once per process. */
let proPriceCache: { id: string; price: Promise<Stripe.Price> } | null = null;

function getProPrice(priceId: string): Promise<Stripe.Price> {
  if (proPriceCache?.id !== priceId) {
    const price = getStripeClient().prices.retrieve(priceId);
    // A failed lookup must not be cached: the next checkout retries.
    price.catch(() => {
      if (proPriceCache?.price === price) proPriceCache = null;
    });
    proPriceCache = { id: priceId, price };
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
    automatic_tax: { enabled: true },
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

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CUSTOMER FUNCTIONS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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
