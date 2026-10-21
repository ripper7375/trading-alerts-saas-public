/**
 * invoicePlan: the billing period and list price an invoice bills, read from
 * the subscription's own line (Manage Subscription S3, defect B8).
 *
 * The line shapes below are the ones Stripe returned in test mode for a
 * monthly-to-yearly upgrade with `proration_behavior: 'always_invoice'`: the
 * credit for the unused monthly time (an `invoiceitem`, `proration: true`,
 * priced monthly) comes FIRST, then the yearly subscription line.
 */

import type Stripe from 'stripe';

import { invoicePlan } from '@/lib/stripe/invoice-plan';
import { invoicePlan as moneyServiceInvoicePlan } from '../../../money-service/src/stripe/invoice-plan';

type Line = Pick<
  Stripe.InvoiceLineItem,
  'type' | 'proration' | 'amount' | 'description'
> & {
  price: {
    currency: string;
    unit_amount: number | null;
    recurring: { interval: 'month' | 'year' } | null;
  } | null;
};

const MONTHLY_PRICE = {
  currency: 'usd',
  unit_amount: 2900,
  recurring: { interval: 'month' as const },
};
const YEARLY_PRICE = {
  currency: 'usd',
  unit_amount: 29000,
  recurring: { interval: 'year' as const },
};

const creditLine: Line = {
  description: 'Unused time on PRO after 31 Oct 2026',
  type: 'invoiceitem',
  proration: true,
  amount: -1965,
  price: MONTHLY_PRICE,
};
const yearlyLine: Line = {
  description: '1 × PRO (at $290.00 / year)',
  type: 'subscription',
  proration: false,
  amount: 29000,
  price: YEARLY_PRICE,
};
const monthlyLine: Line = {
  description: '1 × PRO (at $29.00 / month)',
  type: 'subscription',
  proration: false,
  amount: 2900,
  price: MONTHLY_PRICE,
};
const oneOffLine: Line = {
  description: 'Setup',
  type: 'invoiceitem',
  proration: false,
  amount: 500,
  price: { currency: 'usd', unit_amount: 500, recurring: null },
};

function invoiceWith(...lines: Line[]): Stripe.Invoice {
  return { lines: { data: lines } } as unknown as Stripe.Invoice;
}

const implementations: Array<[string, typeof invoicePlan]> = [
  ['the monolith copy', invoicePlan],
  ["money-service's copy", moneyServiceInvoicePlan],
];

describe.each(implementations)('invoicePlan (%s)', (_name, plan) => {
  it('an ordinary monthly invoice is monthly at the monthly price', () => {
    expect(plan(invoiceWith(monthlyLine))).toEqual({
      yearly: false,
      listPriceUsd: 29,
    });
  });

  it('an ordinary yearly invoice is yearly at the yearly price', () => {
    expect(plan(invoiceWith(yearlyLine))).toEqual({
      yearly: true,
      listPriceUsd: 290,
    });
  });

  it('B8: a prorated upgrade invoice is YEARLY at the yearly price when the credit line comes first', () => {
    expect(plan(invoiceWith(creditLine, yearlyLine))).toEqual({
      yearly: true,
      listPriceUsd: 290,
    });
  });

  it('B8: the result does not depend on line order', () => {
    expect(plan(invoiceWith(yearlyLine, creditLine))).toEqual(
      plan(invoiceWith(creditLine, yearlyLine))
    );
  });

  it('skips a one-off line that has no recurring price', () => {
    expect(plan(invoiceWith(oneOffLine, yearlyLine))).toEqual({
      yearly: true,
      listPriceUsd: 290,
    });
  });

  it('a downgrade renewal invoice (monthly line after a yearly period) is monthly', () => {
    expect(plan(invoiceWith(monthlyLine))).toMatchObject({ yearly: false });
  });

  it('falls back to a proration line only when it is the sole recurring line', () => {
    expect(plan(invoiceWith(creditLine))).toEqual({
      yearly: false,
      listPriceUsd: 29,
    });
  });

  it('prefers a non-proration line even if it is not typed as a subscription line', () => {
    const untyped: Line = { ...yearlyLine, type: 'invoiceitem' };
    expect(plan(invoiceWith(creditLine, untyped))).toMatchObject({
      yearly: true,
    });
  });

  it('an invoice with no lines is monthly with no known price', () => {
    expect(plan(invoiceWith())).toEqual({ yearly: false, listPriceUsd: null });
    expect(plan({} as Stripe.Invoice)).toEqual({
      yearly: false,
      listPriceUsd: null,
    });
  });

  it('does not report a list price for a non-USD line', () => {
    const eur: Line = {
      ...monthlyLine,
      price: { ...MONTHLY_PRICE, currency: 'eur' },
    };
    expect(plan(invoiceWith(eur))).toEqual({
      yearly: false,
      listPriceUsd: null,
    });
  });
});
