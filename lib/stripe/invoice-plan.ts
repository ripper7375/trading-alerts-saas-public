/**
 * Billing interval and list price of a paid Stripe invoice, read from the
 * invoice's own subscription line instead of inferred from the amount paid.
 *
 * The PRO price is admin-editable (SystemConfig `affiliate_base_price`), so a
 * threshold such as "paid >= $280 means yearly" or a fixed "$29" would go
 * wrong as soon as the price changes. Mirrored in
 * money-service/src/stripe/invoice-plan.ts.
 *
 * @module lib/stripe/invoice-plan
 */

import 'server-only';

import type Stripe from 'stripe';

export interface InvoicePlan {
  /** The subscription line bills per year. */
  yearly: boolean;
  /** List price per period in USD (before discounts and tax), when known. */
  listPriceUsd: number | null;
}

/**
 * The line that names the plan an invoice bills: the subscription's own
 * recurring line, never a proration line. A prorated upgrade invoice also
 * carries the credit for the unused monthly time, priced monthly, and Stripe
 * lists it FIRST (observed in test mode, Manage Subscription S3, defect B8), so
 * the first recurring line would record a yearly upgrade as MONTHLY. The choice
 * does not depend on line order; a proration line is used only when the invoice
 * has no other recurring line.
 */
export function planLineOf(
  invoice: Stripe.Invoice
): Stripe.InvoiceLineItem | null {
  const recurring = (invoice.lines?.data ?? []).filter(
    (l) => l.price?.recurring
  );
  return (
    recurring.find((l) => !l.proration && l.type === 'subscription') ??
    recurring.find((l) => !l.proration) ??
    recurring[0] ??
    null
  );
}

export function invoicePlan(invoice: Stripe.Invoice): InvoicePlan {
  const line = planLineOf(invoice);
  const price = line?.price ?? null;
  const yearly = price?.recurring?.interval === 'year';
  const listPriceUsd =
    price && price.currency === 'usd' && typeof price.unit_amount === 'number'
      ? price.unit_amount / 100
      : null;
  return { yearly, listPriceUsd };
}
