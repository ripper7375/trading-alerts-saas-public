/**
 * Invoice amount helpers shared by the invoice-history API, the billing
 * page and the dLocal PDF receipt.
 *
 * Three facts about stored billing data drive everything here:
 *
 * 1. `Payment.amountUSD` is the GROSS list price, before any affiliate
 *    discount (see app/api/payments/dlocal/create/route.ts and
 *    money-service's dlocal-payment.controller.ts). What the customer was
 *    actually charged in USD terms is `amountUSD - discountAmount`.
 * 2. `Payment.amount` is what dLocal actually collected, in the local
 *    currency (`Payment.currency`), after discount -- converted by dLocal
 *    at its own rate at payment time.
 * 3. Stripe amounts are in the currency's minor unit, except for Stripe's
 *    zero-decimal currencies (JPY, KRW, VND, ...), which are already whole
 *    units: https://docs.stripe.com/currencies#zero-decimal
 *
 * @module lib/billing/invoice-amounts
 */

const STRIPE_ZERO_DECIMAL_CURRENCIES = new Set([
  'BIF',
  'CLP',
  'DJF',
  'GNF',
  'JPY',
  'KMF',
  'KRW',
  'MGA',
  'PYG',
  'RWF',
  'UGX',
  'VND',
  'VUV',
  'XAF',
  'XOF',
  'XPF',
]);

/** Round to 2 decimal places without binary-float drift (1.005 -> 1.01). */
export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Convert a Stripe integer amount to major units (e.g. 2900 USD -> 29.00,
 * but 2900 JPY -> 2900).
 */
export function stripeAmountToMajor(amount: number, currency: string): number {
  return STRIPE_ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase())
    ? amount
    : amount / 100;
}

/**
 * The USD-denominated amount a dLocal customer was actually charged, net
 * of any affiliate discount. Never negative.
 */
export function dLocalChargedUsd(payment: {
  amountUSD: number | string | { toString(): string };
  discountAmount?: number | string | { toString(): string } | null;
}): number {
  const gross = Number(payment.amountUSD);
  const discount = payment.discountAmount ? Number(payment.discountAmount) : 0;
  return Math.max(0, roundMoney(gross - discount));
}

/**
 * Units of local currency per 1 USD that dLocal applied, derived from the
 * two amounts it produced. `null` when it can't be derived (a fully
 * discounted payment has no USD amount to divide by).
 */
export function impliedExchangeRate(
  localAmount: number,
  chargedUsd: number
): number | null {
  if (!(chargedUsd > 0) || !(localAmount > 0)) return null;
  return localAmount / chargedUsd;
}

/**
 * Format an amount in the currency it was ACTUALLY charged in -- no
 * conversion. This is the sanctioned non-`formatCurrency()` path from
 * docs/policies/08-locale-i18n-compliance.md §4: the figure is already
 * in its real currency, and running it through `formatCurrency()` would
 * convert it a second time.
 */
export function formatChargedAmount(
  amount: number,
  currency: string,
  language?: string
): string {
  try {
    return new Intl.NumberFormat(language || 'en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount);
  } catch {
    // Unknown ISO code -- still show the number and the code.
    return `${currency.toUpperCase()} ${amount.toFixed(2)}`;
  }
}
