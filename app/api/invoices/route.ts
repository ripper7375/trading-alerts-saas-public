/**
 * Invoices API Route
 *
 * GET /api/invoices
 * Returns the user's COMPLETE unified invoice history from Stripe and
 * dLocal, newest first.
 *
 * Part 18B: includes dLocal payments alongside Stripe invoices.
 *
 * Amount semantics (2026-09-24):
 * - `amount` + `currency` are EXACTLY what was charged -- the same figure
 *   the downloadable PDF shows. For dLocal that is the local-currency
 *   amount (e.g. INR), not the USD price.
 * - `amountUsd` is the USD value of that charge (net of any affiliate
 *   discount), so the UI can show an indicative conversion into the
 *   viewer's display currency. `null` when unknown (a Stripe invoice
 *   charged in a non-USD currency).
 * - dLocal rows link `invoicePdfUrl` to our own generated receipt,
 *   GET /api/invoices/[id]/receipt, since dLocal issues no PDF.
 *
 * History: previously capped at 12 per provider. Now everything is
 * returned (Stripe via cursor pagination, bounded by MAX_INVOICE_HISTORY);
 * the billing page pages through it client-side. `?limit=N` still caps
 * the response for any caller that wants fewer.
 *
 * @module app/api/invoices/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import {
  VIEW_AS_DENIED_BODY,
  resolveViewAsSubject,
} from '@/lib/admin/user-view-as';
import { authOptions } from '@/lib/auth/auth-options';
import { planDescription } from '@/lib/billing/dlocal-receipt';
import {
  dLocalChargedUsd,
  roundMoney,
  stripeAmountToMajor,
} from '@/lib/billing/invoice-amounts';
import { prisma } from '@/lib/db/prisma';
import { invoicePlan } from '@/lib/stripe/invoice-plan';
import {
  getAllCustomerInvoices,
  MAX_INVOICE_HISTORY,
} from '@/lib/stripe/stripe';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Unified invoice item supporting both Stripe and dLocal
 */
interface InvoiceItem {
  id: string;
  date: string;
  amount: number; // exactly what was charged, in `currency`
  currency: string; // ISO code of the charge
  amountUsd: number | null; // USD value of the charge, when known
  status: 'paid' | 'open' | 'failed';
  description: string;
  invoicePdfUrl: string | null;
  provider: 'STRIPE' | 'DLOCAL';
  planType: string | null;
  hostedInvoiceUrl: string | null; // davintrade-vat-stack: Stripe-hosted invoice page
  taxAmount: number; // davintrade-vat-stack: VAT/GST collected, in `currency`
  taxRate: number; // e.g. 0.19 for German 19% VAT, 0 for reverse charge/no tax
  taxCountry: string | null; // ISO country the tax was assessed for
  customerTaxId: string | null; // EU VAT number etc., when supplied
  reverseCharge: boolean; // true when B2B 0% reverse charge applied
}

interface InvoicesResponse {
  invoices: InvoiceItem[];
  hasMore: boolean;
  total: number;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET /api/invoices
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Get user's invoice history
 *
 * @example Response:
 * {
 *   "invoices": [
 *     {
 *       "id": "in_xxx",
 *       "date": "2024-01-01T00:00:00.000Z",
 *       "amount": 29.00,
 *       "currency": "USD",
 *       "amountUsd": 29.00,
 *       "status": "paid",
 *       "description": "Trading Alerts PRO - Monthly",
 *       "invoicePdfUrl": "https://pay.stripe.com/invoice/xxx/pdf"
 *     }
 *   ],
 *   "hasMore": false,
 *   "total": 1
 * }
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<InvoicesResponse | { error: string }>> {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Admin read-only "view as user": ?view_as=user reads the viewed user.
    const subject = await resolveViewAsSubject(request, session.user);
    if (subject.kind === 'denied') {
      return NextResponse.json(VIEW_AS_DENIED_BODY, { status: 403 });
    }
    const userId = subject.userId;
    // Receipt links must carry the opt-in too, or they'd resolve to the admin.
    const receiptQuery = subject.kind === 'view-as' ? '?view_as=user' : '';

    // Optional cap; default is the full history.
    const limitParam = request.nextUrl.searchParams.get('limit');
    const parsedLimit = limitParam ? parseInt(limitParam, 10) : NaN;
    const limit = Number.isFinite(parsedLimit)
      ? Math.min(Math.max(parsedLimit, 1), MAX_INVOICE_HISTORY)
      : MAX_INVOICE_HISTORY;

    const allInvoices: InvoiceItem[] = [];

    // 1. dLocal payments (completed ones only)
    const dLocalPayments = await prisma.payment.findMany({
      where: {
        userId,
        provider: 'DLOCAL',
        status: 'COMPLETED',
      },
      orderBy: { createdAt: 'desc' },
      take: MAX_INVOICE_HISTORY,
    });

    for (const payment of dLocalPayments) {
      allInvoices.push({
        id: payment.id,
        date: payment.createdAt.toISOString(),
        amount: roundMoney(Number(payment.amount)),
        currency: payment.currency.toUpperCase(),
        // amountUSD is the gross list price; the charge was net of discount.
        amountUsd: dLocalChargedUsd(payment),
        status: 'paid',
        description: planDescription(payment.planType),
        // dLocal issues no PDF -- we generate a Stripe-style receipt.
        invoicePdfUrl: `/api/invoices/${encodeURIComponent(payment.id)}/receipt${receiptQuery}`,
        provider: 'DLOCAL',
        planType: payment.planType,
        // davintrade-vat-stack Section 1.1: dLocal markets are flat-rate,
        // 0% local tax for MVP -- no per-invoice breakdown to surface.
        hostedInvoiceUrl: null,
        taxAmount: 0,
        taxRate: 0,
        taxCountry: payment.country,
        customerTaxId: null,
        reverseCharge: false,
      });
    }

    // 2. Stripe invoices, if the user has a Stripe customer
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
    });

    if (subscription?.stripeCustomerId) {
      try {
        const stripeInvoices = await getAllCustomerInvoices(
          subscription.stripeCustomerId
        );

        // Tax breakdown for these invoices is captured separately, by the
        // invoice.payment_succeeded webhook (davintrade-vat-stack, Nuance
        // 1: the live Stripe API list above doesn't carry the finalized
        // tax_rate/tax_country the same way our own persisted record does).
        // Look those up once and merge by ID instead of a query per invoice.
        const taxRecords = await prisma.invoice.findMany({
          where: { stripeCustomerId: subscription.stripeCustomerId },
        });
        const taxRecordsById = new Map(
          taxRecords.map((record) => [record.stripeInvoiceId, record])
        );

        for (const invoice of stripeInvoices) {
          const taxRecord = taxRecordsById.get(invoice.id);
          const currency = (invoice.currency || 'usd').toUpperCase();
          const amount = stripeAmountToMajor(
            invoice.amount_paid || 0,
            currency
          );
          allInvoices.push({
            id: invoice.id,
            date: new Date((invoice.created || 0) * 1000).toISOString(),
            amount,
            currency,
            amountUsd: currency === 'USD' ? amount : null,
            status: mapInvoiceStatus(invoice.status),
            description: getInvoiceDescription(invoice),
            invoicePdfUrl: invoice.invoice_pdf || taxRecord?.invoicePdf || null,
            provider: 'STRIPE',
            planType: invoicePlan(invoice).yearly ? 'YEARLY' : 'MONTHLY',
            hostedInvoiceUrl:
              taxRecord?.hostedInvoiceUrl ?? invoice.hosted_invoice_url ?? null,
            taxAmount: taxRecord ? Number(taxRecord.taxAmount) : 0,
            taxRate: taxRecord ? Number(taxRecord.taxRate) : 0,
            taxCountry: taxRecord?.taxCountry ?? null,
            customerTaxId: taxRecord?.customerTaxId ?? null,
            reverseCharge: taxRecord?.reverseCharge ?? false,
          });
        }
      } catch (error) {
        // Log but don't fail - dLocal invoices are still available
        console.error('[Invoices] Error fetching Stripe invoices:', error);
      }
    }

    // Newest first across both providers
    allInvoices.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    return NextResponse.json({
      invoices: allInvoices.slice(0, limit),
      hasMore: allInvoices.length > limit,
      total: allInvoices.length,
    });
  } catch (error) {
    console.error('[Invoices] Error fetching invoices:', error);
    return NextResponse.json(
      { error: 'Failed to fetch invoices' },
      { status: 500 }
    );
  }
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HELPER FUNCTIONS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Map Stripe invoice status to our simplified status
 *
 * @param stripeStatus - Stripe invoice status
 * @returns Simplified status for UI
 */
function mapInvoiceStatus(
  stripeStatus: string | null
): 'paid' | 'open' | 'failed' {
  switch (stripeStatus) {
    case 'paid':
      return 'paid';
    case 'open':
    case 'draft':
      return 'open';
    case 'uncollectible':
    case 'void':
      return 'failed';
    default:
      return 'open';
  }
}

/**
 * Get human-readable description for invoice
 *
 * @param invoice - Stripe invoice object
 * @returns Description string
 */
function getInvoiceDescription(invoice: {
  lines?: { data?: Array<{ description?: string | null }> };
}): string {
  // Try to get description from first line item
  const firstLine = invoice.lines?.data?.[0];
  if (firstLine?.description) {
    return firstLine.description;
  }

  // Default description
  return 'Trading Alerts PRO - Monthly';
}
