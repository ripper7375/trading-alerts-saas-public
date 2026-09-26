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

import type Stripe from 'stripe';

export interface InvoicePlan {
  /** The subscription line bills per year. */
  yearly: boolean;
  /** List price per period in USD (before discounts and tax), when known. */
  listPriceUsd: number | null;
}

export function invoicePlan(invoice: Stripe.Invoice): InvoicePlan {
  const line = invoice.lines?.data?.find((l) => l.price?.recurring) ?? null;
  const price = line?.price ?? null;
  const yearly = price?.recurring?.interval === 'year';
  const listPriceUsd =
    price && price.currency === 'usd' && typeof price.unit_amount === 'number'
      ? price.unit_amount / 100
      : null;
  return { yearly, listPriceUsd };
}
