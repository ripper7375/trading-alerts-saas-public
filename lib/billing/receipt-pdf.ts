/**
 * Receipt PDF renderer
 *
 * Draws a `ReceiptData` as a one-page A4 PDF modelled on Stripe's receipt
 * PDF, so a dLocal customer's download reads like the Stripe one a card
 * customer gets: title + business name, the number/date/method block,
 * seller and "Bill to" columns, an "<amount> paid on <date>" headline, the
 * line-item table, the totals stack and a numbered footer.
 *
 * One deliberate addition Stripe doesn't need: dLocal prices are set in
 * USD but collected in local currency, so the totals are in USD and the
 * receipt closes with the local amount actually paid and the exchange rate
 * dLocal applied -- the reconciliation a customer needs when the figure on
 * their bank statement differs from the USD price.
 *
 * `pdf-lib` with the 14 standard fonts: pure JS, no font files to bundle
 * (so it runs unchanged on Vercel). The trade-off is that standard fonts
 * only encode WinAnsi (Latin-1-ish). Currency amounts therefore use ISO
 * codes ("INR 1,930.00") rather than symbols like ₹ or ฿, and a bill-to
 * line that can't be encoded (e.g. a name in Thai or Arabic script) is
 * omitted rather than printed as "????" -- the email line still identifies
 * the customer.
 *
 * @module lib/billing/receipt-pdf
 */

import {
  PDFDocument,
  type PDFFont,
  type PDFPage,
  StandardFonts,
  rgb,
} from 'pdf-lib';

import type { ReceiptData } from './dlocal-receipt';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FORMATTING
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Intl emits no-break / thin spaces (U+00A0, U+2007, U+2009, U+202F) that
 * WinAnsi fonts can't all encode; `\s` matches every one of them.
 */
function normalizeSpaces(text: string): string {
  return text.replace(/\s/g, ' ');
}

export function formatReceiptDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(date);
}

export function formatReceiptPeriod(start: Date, end: Date): string {
  const short = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
  const long = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
  return `${(sameYear ? short : long).format(start)} – ${long.format(end)}`;
}

export function formatReceiptUsd(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

/** Local currency by ISO code, e.g. "INR 1,930.00" -- WinAnsi-safe. */
export function formatReceiptLocal(amount: number, currency: string): string {
  try {
    return normalizeSpaces(
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency.toUpperCase(),
        currencyDisplay: 'code',
      }).format(amount)
    );
  } catch {
    return `${currency.toUpperCase()} ${amount.toFixed(2)}`;
  }
}

export function formatReceiptRate(rate: number): string {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: rate >= 100 ? 2 : 4,
  }).format(rate);
}

/** The text if the font can encode every character of it, else null. */
function encodable(font: PDFFont, text: string): string | null {
  const normalized = normalizeSpaces(text.normalize('NFC'));
  try {
    font.encodeText(normalized);
    return normalized;
  } catch {
    return null;
  }
}

/** Always-drawable variant: unencodable characters become "?". */
function safe(font: PDFFont, text: string): string {
  const whole = encodable(font, text);
  if (whole !== null) return whole;
  return Array.from(normalizeSpaces(text.normalize('NFC')))
    .map((ch) => encodable(font, ch) ?? '?')
    .join('');
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LAYOUT
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 50;
const RIGHT = A4[0] - MARGIN;
const INK = rgb(0.1, 0.12, 0.16);
const MUTED = rgb(0.42, 0.45, 0.5);
const RULE = rgb(0.85, 0.86, 0.88);

interface Pen {
  page: PDFPage;
  regular: PDFFont;
  bold: PDFFont;
}

function text(
  pen: Pen,
  value: string,
  x: number,
  y: number,
  opts: { size?: number; bold?: boolean; muted?: boolean; align?: 'right' } = {}
): void {
  const font = opts.bold ? pen.bold : pen.regular;
  const size = opts.size ?? 9;
  const str = safe(font, value);
  const drawX =
    opts.align === 'right' ? x - font.widthOfTextAtSize(str, size) : x;
  pen.page.drawText(str, {
    x: drawX,
    y,
    size,
    font,
    color: opts.muted ? MUTED : INK,
  });
}

function rule(pen: Pen, y: number, from = MARGIN, to = RIGHT): void {
  pen.page.drawLine({
    start: { x: from, y },
    end: { x: to, y },
    thickness: 0.75,
    color: RULE,
  });
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// RENDER
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function renderReceiptPdf(
  receipt: ReceiptData
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage(A4);
  const pen: Pen = {
    page,
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
  };

  const paidDate = formatReceiptDate(receipt.datePaid);
  const paidLocal = formatReceiptLocal(
    receipt.amountPaid.amount,
    receipt.amountPaid.currency
  );

  // Deterministic metadata: the same payment always yields the same file.
  doc.setTitle(`Receipt ${receipt.receiptNumber}`);
  doc.setAuthor(receipt.seller.name);
  doc.setCreator(receipt.seller.name);
  doc.setProducer(receipt.seller.name);
  doc.setCreationDate(receipt.datePaid);
  doc.setModificationDate(receipt.datePaid);

  // ── Title row ────────────────────────────────────────────────
  let y = A4[1] - MARGIN - 10;
  text(pen, 'Receipt', MARGIN, y, { size: 22, bold: true });
  text(pen, receipt.seller.name, RIGHT, y + 4, {
    size: 14,
    bold: true,
    align: 'right',
  });

  // ── Number / date / method block ─────────────────────────────
  y -= 36;
  const meta: Array<[string, string]> = [
    ['Invoice number', receipt.invoiceNumber],
    ['Receipt number', receipt.receiptNumber],
    ['Date paid', paidDate],
  ];
  if (receipt.paymentMethod)
    meta.push(['Payment method', receipt.paymentMethod]);
  for (const [label, value] of meta) {
    text(pen, label, MARGIN, y, { bold: true });
    text(pen, value, MARGIN + 110, y);
    y -= 14;
  }

  // ── Seller | Bill to ─────────────────────────────────────────
  y -= 18;
  const blockTop = y;
  text(pen, receipt.seller.name, MARGIN, y, { bold: true });
  for (const line of receipt.seller.lines) {
    y -= 13;
    text(pen, line, MARGIN, y);
  }
  const sellerBottom = y;

  y = blockTop;
  const billX = MARGIN + 230;
  text(pen, 'Bill to', billX, y, { bold: true });
  for (const line of receipt.billTo) {
    const drawable = encodable(pen.regular, line);
    if (drawable === null) continue; // see module doc: omit, don't mangle
    y -= 13;
    text(pen, drawable, billX, y);
  }
  y = Math.min(y, sellerBottom);

  // ── Headline ─────────────────────────────────────────────────
  y -= 40;
  text(pen, `${paidLocal} paid on ${paidDate}`, MARGIN, y, {
    size: 16,
    bold: true,
  });
  y -= 16;
  text(
    pen,
    `Paid in ${receipt.amountPaid.currency.toUpperCase()} via dLocal. Prices are set in USD; the conversion is shown below.`,
    MARGIN,
    y,
    { muted: true }
  );

  // ── Line items ───────────────────────────────────────────────
  const COL_QTY = MARGIN + 320;
  const COL_UNIT = MARGIN + 410;
  y -= 34;
  text(pen, 'Description', MARGIN, y, { muted: true });
  text(pen, 'Qty', COL_QTY, y, { muted: true, align: 'right' });
  text(pen, 'Unit price', COL_UNIT, y, { muted: true, align: 'right' });
  text(pen, 'Amount', RIGHT, y, { muted: true, align: 'right' });
  y -= 7;
  rule(pen, y);

  for (const item of receipt.items) {
    y -= 16;
    text(pen, item.description, MARGIN, y);
    text(pen, String(item.quantity), COL_QTY, y, { align: 'right' });
    text(pen, formatReceiptUsd(item.unitPriceUsd), COL_UNIT, y, {
      align: 'right',
    });
    text(pen, formatReceiptUsd(item.amountUsd), RIGHT, y, { align: 'right' });
    if (item.period) {
      y -= 12;
      text(
        pen,
        formatReceiptPeriod(item.period.start, item.period.end),
        MARGIN,
        y,
        {
          muted: true,
        }
      );
    }
  }
  y -= 12;
  rule(pen, y);

  // ── Totals ───────────────────────────────────────────────────
  const TOTALS_X = MARGIN + 270;
  const totalRow = (label: string, value: string, bold = false): void => {
    y -= 16;
    text(pen, label, TOTALS_X, y, { bold });
    text(pen, value, RIGHT, y, { bold, align: 'right' });
  };
  totalRow('Subtotal', formatReceiptUsd(receipt.subtotalUsd));
  if (receipt.discount) {
    const label = receipt.discount.code
      ? `Discount (${receipt.discount.code})`
      : 'Discount';
    totalRow(label, `-${formatReceiptUsd(receipt.discount.amountUsd)}`);
  }
  totalRow('Total', formatReceiptUsd(receipt.totalUsd));
  y -= 8;
  rule(pen, y, TOTALS_X);
  totalRow('Amount paid', paidLocal, true);

  if (receipt.exchangeRate !== null) {
    y -= 22;
    text(
      pen,
      `Exchange rate applied by dLocal at the time of payment: 1 USD = ${formatReceiptRate(receipt.exchangeRate)} ${receipt.amountPaid.currency.toUpperCase()}`,
      MARGIN,
      y,
      { muted: true }
    );
  }

  // ── Questions + footer ───────────────────────────────────────
  y -= 30;
  text(
    pen,
    `Questions? Contact ${receipt.seller.name} at support@davintrade.app`,
    MARGIN,
    y,
    { muted: true }
  );

  rule(pen, MARGIN + 14);
  text(
    pen,
    `${receipt.receiptNumber} · ${paidLocal} paid on ${paidDate}`,
    MARGIN,
    MARGIN,
    { size: 8, muted: true }
  );
  text(pen, 'Page 1 of 1', RIGHT, MARGIN, {
    size: 8,
    muted: true,
    align: 'right',
  });

  return doc.save();
}
