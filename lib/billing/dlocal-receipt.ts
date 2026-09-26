/**
 * dLocal receipt data
 *
 * dLocal, unlike Stripe, issues no invoice document, so dLocal customers
 * had a row in their billing history and nothing to download. This module
 * turns a completed dLocal `Payment` into the data for a receipt laid out
 * like Stripe's own receipt PDF (receipt/invoice numbers, seller and
 * bill-to blocks, "X paid on DATE" headline, line-item table, totals).
 *
 * Pure: no Prisma, no I/O -- the route loads the rows, this shapes them,
 * `receipt-pdf.ts` draws them.
 *
 * Numbering: these are RECEIPTS for payments already taken, not tax
 * invoices, so the numbers are derived deterministically from the payment
 * itself (stable across every download, no counter table, no migration).
 * A jurisdiction that needs gap-free sequential invoice numbers would need
 * a persisted counter instead.
 *
 * @module lib/billing/dlocal-receipt
 */

import { createHash } from 'crypto';

import { COUNTRY_NAMES } from '@/lib/dlocal/constants';
import type { DLocalCountry } from '@/types/dlocal';

import {
  dLocalChargedUsd,
  impliedExchangeRate,
  roundMoney,
} from './invoice-amounts';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

type DecimalLike = number | string | { toString(): string };

export interface ReceiptPaymentInput {
  id: string;
  createdAt: Date;
  amount: DecimalLike; // local currency, after discount
  amountUSD: DecimalLike; // USD list price, BEFORE discount
  currency: string;
  country: string | null;
  paymentMethod: string | null;
  planType: string | null;
  duration: number | null;
  discountCode: string | null;
  discountAmount: DecimalLike | null; // USD
}

export interface ReceiptCustomerInput {
  name: string | null;
  email: string | null;
}

export interface ReceiptSeller {
  name: string;
  lines: string[];
}

export interface ReceiptLineItem {
  description: string;
  period: { start: Date; end: Date } | null;
  quantity: number;
  unitPriceUsd: number;
  amountUsd: number;
}

export interface ReceiptData {
  receiptNumber: string;
  invoiceNumber: string;
  datePaid: Date;
  paymentMethod: string | null;
  seller: ReceiptSeller;
  billTo: string[];
  items: ReceiptLineItem[];
  subtotalUsd: number;
  discount: { code: string | null; amountUsd: number } | null;
  totalUsd: number;
  amountPaid: { amount: number; currency: string };
  /** Local currency units per 1 USD, as applied by dLocal. */
  exchangeRate: number | null;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SELLER
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Seller block. The repo records no legal entity or registered address,
 * so these are env-driven with a brand-only default:
 * - BILLING_SELLER_NAME     (default "DavinTrade")
 * - BILLING_SELLER_ADDRESS  (newline- or "|"-separated lines, optional)
 * - BILLING_SELLER_TAX_ID   (optional, printed as "Tax ID: ...")
 */
export function getReceiptSeller(
  env: Record<string, string | undefined> = process.env
): ReceiptSeller {
  const address = (env['BILLING_SELLER_ADDRESS'] ?? '')
    .split(/\r?\n|\|/)
    .map((line) => line.trim())
    .filter(Boolean);
  const taxId = env['BILLING_SELLER_TAX_ID']?.trim();

  return {
    name: env['BILLING_SELLER_NAME']?.trim() || 'DavinTrade',
    lines: [
      ...address,
      ...(taxId ? [`Tax ID: ${taxId}`] : []),
      'support@davintrade.app',
      'davintrade.app',
    ],
  };
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// NUMBERING
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** Stripe-style "####-####" receipt number, stable per payment. */
export function receiptNumberFor(paymentId: string): string {
  const digest = createHash('sha256').update(paymentId).digest();
  const n = digest.readUInt32BE(0) % 100_000_000;
  const digits = String(n).padStart(8, '0');
  return `${digits.slice(0, 4)}-${digits.slice(4)}`;
}

/** "DT-YYYYMMDD-XXXXXXXX" invoice reference, stable per payment. */
export function invoiceNumberFor(paymentId: string, paidAt: Date): string {
  const ymd = paidAt.toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = paymentId.slice(-8).toUpperCase();
  return `DT-${ymd}-${suffix}`;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BUILDER
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const DAY_MS = 24 * 60 * 60 * 1000;

export function planDescription(planType: string | null): string {
  return planType === 'THREE_DAY'
    ? 'Trading Alerts PRO - 3 Day'
    : planType === 'YEARLY'
      ? 'Trading Alerts PRO - Annual'
      : 'Trading Alerts PRO - Monthly';
}

export function buildDlocalReceipt(
  payment: ReceiptPaymentInput,
  customer: ReceiptCustomerInput,
  seller: ReceiptSeller = getReceiptSeller()
): ReceiptData {
  const listUsd = roundMoney(Number(payment.amountUSD));
  const discountUsd = payment.discountAmount
    ? roundMoney(Number(payment.discountAmount))
    : 0;
  const totalUsd = dLocalChargedUsd(payment);
  const localAmount = roundMoney(Number(payment.amount));

  const days =
    payment.duration ??
    (payment.planType === 'THREE_DAY'
      ? 3
      : payment.planType === 'YEARLY'
        ? 365
        : 30);
  const start = payment.createdAt;

  const countryName = payment.country
    ? (COUNTRY_NAMES[payment.country as DLocalCountry] ?? payment.country)
    : null;

  const billTo = [customer.name, customer.email, countryName].filter(
    (line): line is string => Boolean(line && line.trim())
  );

  return {
    receiptNumber: receiptNumberFor(payment.id),
    invoiceNumber: invoiceNumberFor(payment.id, payment.createdAt),
    datePaid: payment.createdAt,
    paymentMethod: payment.paymentMethod,
    seller,
    billTo,
    items: [
      {
        description: planDescription(payment.planType),
        period: { start, end: new Date(start.getTime() + days * DAY_MS) },
        quantity: 1,
        unitPriceUsd: listUsd,
        amountUsd: listUsd,
      },
    ],
    subtotalUsd: listUsd,
    discount:
      discountUsd > 0
        ? { code: payment.discountCode, amountUsd: discountUsd }
        : null,
    totalUsd,
    amountPaid: { amount: localAmount, currency: payment.currency },
    exchangeRate: impliedExchangeRate(localAmount, totalUsd),
  };
}
