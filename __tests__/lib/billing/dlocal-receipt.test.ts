/**
 * dLocal receipt data + PDF rendering tests
 *
 * The figures on a receipt are the part that must be right: the USD list
 * price, the affiliate discount, the net USD charge, the local amount
 * dLocal actually collected and the rate that links them. The PDF tests
 * then prove that data really lands on the page (text is extracted from
 * the generated file, not assumed) and that a non-Latin customer name
 * can't crash the renderer.
 */

import { inflateSync } from 'zlib';

import {
  buildDlocalReceipt,
  getReceiptSeller,
  invoiceNumberFor,
  receiptNumberFor,
  type ReceiptPaymentInput,
} from '@/lib/billing/dlocal-receipt';
import {
  dLocalChargedUsd,
  formatChargedAmount,
  impliedExchangeRate,
  stripeAmountToMajor,
} from '@/lib/billing/invoice-amounts';
import {
  formatReceiptLocal,
  formatReceiptPeriod,
  renderReceiptPdf,
} from '@/lib/billing/receipt-pdf';

const SELLER = { name: 'DavinTrade', lines: ['support@davintrade.app'] };

const discountedInr: ReceiptPaymentInput = {
  id: 'cmfx7k2p90001abcd9xyz1234',
  createdAt: new Date('2026-09-01T08:15:00Z'),
  amount: '1930.34', // Prisma Decimal arrives as a Decimal/string
  amountUSD: '29',
  currency: 'INR',
  country: 'IN',
  paymentMethod: 'UPI',
  planType: 'MONTHLY',
  duration: 30,
  discountCode: 'DAVIN20',
  discountAmount: '5.8',
};

/** Pull the literal strings out of a pdf-lib file's (Flate) content streams. */
function pdfText(bytes: Uint8Array): string {
  const raw = Buffer.from(bytes).toString('latin1');
  const chunks: string[] = [];
  const re = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(raw)) !== null) {
    const body = Buffer.from(match[1] ?? '', 'latin1');
    try {
      chunks.push(inflateSync(body).toString('latin1'));
    } catch {
      chunks.push(body.toString('latin1'));
    }
  }
  // pdf-lib writes WinAnsi text as hex strings: <48656C6C6F> Tj
  return chunks
    .join('\n')
    .replace(/<([0-9A-Fa-f]+)>\s*Tj/g, (_, hex: string) =>
      Buffer.from(hex, 'hex').toString('latin1')
    );
}

describe('invoice-amounts', () => {
  it('nets the affiliate discount out of the gross USD list price', () => {
    expect(dLocalChargedUsd({ amountUSD: 29, discountAmount: 5.8 })).toBe(23.2);
    expect(dLocalChargedUsd({ amountUSD: '1.99', discountAmount: null })).toBe(
      1.99
    );
    expect(dLocalChargedUsd({ amountUSD: 29, discountAmount: 40 })).toBe(0);
  });

  it('respects Stripe zero-decimal currencies', () => {
    expect(stripeAmountToMajor(2900, 'usd')).toBe(29);
    expect(stripeAmountToMajor(2900, 'JPY')).toBe(2900);
  });

  it('derives the rate dLocal applied, or null when it cannot', () => {
    expect(impliedExchangeRate(1930.34, 23.2)).toBeCloseTo(83.2043, 4);
    expect(impliedExchangeRate(0, 0)).toBeNull();
  });

  it('formats a charge in its own currency, without converting it', () => {
    expect(formatChargedAmount(34.51, 'EUR', 'en-US')).toBe('€34.51');
    expect(formatChargedAmount(1930.34, 'inr', 'en-US')).toBe('₹1,930.34');
    // Unknown codes still show the code and the number (Intl separates
    // them with a no-break space).
    expect(formatChargedAmount(5, 'ZZZ', 'en-US')).toMatch(/^ZZZ\s5\.00$/);
  });
});

describe('buildDlocalReceipt', () => {
  it('reconciles list price, discount, net USD and the local amount paid', () => {
    const receipt = buildDlocalReceipt(
      discountedInr,
      { name: 'Priya Sharma', email: 'priya@example.com' },
      SELLER
    );

    expect(receipt.subtotalUsd).toBe(29);
    expect(receipt.discount).toEqual({ code: 'DAVIN20', amountUsd: 5.8 });
    expect(receipt.totalUsd).toBe(23.2);
    expect(receipt.amountPaid).toEqual({ amount: 1930.34, currency: 'INR' });
    expect(receipt.exchangeRate).toBeCloseTo(1930.34 / 23.2, 6);
    expect(receipt.items).toHaveLength(1);
    expect(receipt.items[0]?.unitPriceUsd).toBe(29);
    expect(receipt.items[0]?.period?.end.toISOString()).toBe(
      '2026-10-01T08:15:00.000Z'
    );
    expect(receipt.billTo).toEqual([
      'Priya Sharma',
      'priya@example.com',
      'India',
    ]);
  });

  it('omits the discount row when there was none', () => {
    const receipt = buildDlocalReceipt(
      { ...discountedInr, discountCode: null, discountAmount: null },
      { name: null, email: 'a@b.c' },
      SELLER
    );
    expect(receipt.discount).toBeNull();
    expect(receipt.totalUsd).toBe(29);
    expect(receipt.billTo).toEqual(['a@b.c', 'India']);
  });

  it('numbers receipts deterministically, so every download matches', () => {
    expect(receiptNumberFor(discountedInr.id)).toMatch(/^\d{4}-\d{4}$/);
    expect(receiptNumberFor(discountedInr.id)).toBe(
      receiptNumberFor(discountedInr.id)
    );
    expect(receiptNumberFor(discountedInr.id)).not.toBe(
      receiptNumberFor('another-payment-id')
    );
    expect(invoiceNumberFor(discountedInr.id, discountedInr.createdAt)).toBe(
      'DT-20260901-9XYZ1234'
    );
  });

  it('reads the seller block from env, with a brand-only default', () => {
    expect(getReceiptSeller({}).name).toBe('DavinTrade');
    const seller = getReceiptSeller({
      BILLING_SELLER_NAME: 'DavinTrade Ltd',
      BILLING_SELLER_ADDRESS: '1 Example Street|London',
      BILLING_SELLER_TAX_ID: 'GB123',
    });
    expect(seller.name).toBe('DavinTrade Ltd');
    expect(seller.lines.slice(0, 3)).toEqual([
      '1 Example Street',
      'London',
      'Tax ID: GB123',
    ]);
  });
});

describe('renderReceiptPdf', () => {
  it('produces a PDF carrying the reconciled figures', async () => {
    const receipt = buildDlocalReceipt(
      discountedInr,
      { name: 'Priya Sharma', email: 'priya@example.com' },
      SELLER
    );
    const bytes = await renderReceiptPdf(receipt);
    expect(Buffer.from(bytes.slice(0, 5)).toString('latin1')).toBe('%PDF-');

    const text = pdfText(bytes);
    for (const expected of [
      'Receipt',
      receipt.receiptNumber,
      'INR 1,930.34 paid on September 1, 2026',
      'Discount (DAVIN20)',
      '-$5.80',
      '$23.20',
      'Amount paid',
      '1 USD = 83.2043 INR',
      'Priya Sharma',
    ]) {
      expect(text).toContain(expected);
    }
  });

  it('is byte-identical across renders of the same payment', async () => {
    const receipt = buildDlocalReceipt(
      discountedInr,
      { name: 'x', email: 'y' },
      SELLER
    );
    const a = Buffer.from(await renderReceiptPdf(receipt));
    const b = Buffer.from(await renderReceiptPdf(receipt));
    expect(a.equals(b)).toBe(true);
  });

  it('omits a name the standard font cannot encode instead of throwing', async () => {
    const receipt = buildDlocalReceipt(
      { ...discountedInr, currency: 'THB', country: 'TH' },
      { name: 'สมชาย ใจดี', email: 'somchai@example.com' },
      SELLER
    );
    const text = pdfText(await renderReceiptPdf(receipt));
    expect(text).toContain('somchai@example.com');
    expect(text).toContain('Thailand');
  });

  it('keeps currency amounts and periods WinAnsi-safe', () => {
    expect(formatReceiptLocal(1930.34, 'INR')).toBe('INR 1,930.34');
    expect(
      formatReceiptPeriod(
        new Date('2026-12-30T00:00:00Z'),
        new Date('2027-01-02T00:00:00Z')
      )
    ).toBe('Dec 30, 2026 – Jan 2, 2027');
  });
});
