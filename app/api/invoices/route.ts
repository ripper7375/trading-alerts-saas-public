/**
 * Invoices API Route
 *
 * GET /api/invoices
 * Returns user's unified invoice history from both Stripe and dLocal.
 *
 * Part 18B: Now includes dLocal payments alongside Stripe invoices.
 *
 * @module app/api/invoices/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/db/prisma';
import { getCustomerInvoices } from '@/lib/stripe/stripe';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Unified invoice item supporting both Stripe and dLocal
 */
interface InvoiceItem {
  id: string;
  date: string;
  amount: number;
  currency: string; // NEW: Currency code
  status: 'paid' | 'open' | 'failed';
  description: string;
  invoicePdfUrl: string | null;
  provider: 'STRIPE' | 'DLOCAL'; // NEW: Payment provider
  planType: string | null; // NEW: Plan type (for dLocal)
}

interface InvoicesResponse {
  invoices: InvoiceItem[];
  hasMore: boolean;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET /api/invoices
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Get user's invoice history
 *
 * @param request - Next.js request object with optional limit query param
 * @returns JSON response with invoice list
 *
 * @example Request:
 * GET /api/invoices?limit=12
 *
 * @example Response:
 * {
 *   "invoices": [
 *     {
 *       "id": "in_xxx",
 *       "date": "2024-01-01T00:00:00.000Z",
 *       "amount": 29.00,
 *       "status": "paid",
 *       "description": "Trading Alerts PRO - Monthly",
 *       "invoicePdfUrl": "https://pay.stripe.com/invoice/xxx/pdf"
 *     }
 *   ],
 *   "hasMore": false
 * }
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<InvoicesResponse | { error: string }>> {
  try {
    // Authenticate user
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Get limit from query params (default: 12, max: 100)
    const searchParams = request.nextUrl.searchParams;
    const limitParam = searchParams.get('limit');
    const limit = Math.min(Math.max(parseInt(limitParam || '12', 10), 1), 100);

    // Collect invoices from all providers
    const allInvoices: InvoiceItem[] = [];

    // 1. Get dLocal payments (completed ones only)
    const dLocalPayments = await prisma.payment.findMany({
      where: {
        userId,
        provider: 'DLOCAL',
        status: 'COMPLETED',
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // Transform dLocal payments to invoice format
    for (const payment of dLocalPayments) {
      allInvoices.push({
        id: payment.id,
        date: payment.createdAt.toISOString(),
        amount: Number(payment.amountUSD),
        currency: payment.currency,
        status: 'paid',
        description:
          payment.planType === 'THREE_DAY'
            ? 'Trading Alerts PRO - 3 Day'
            : 'Trading Alerts PRO - Monthly',
        invoicePdfUrl: null, // dLocal doesn't provide PDF invoices
        provider: 'DLOCAL',
        planType: payment.planType,
      });
    }

    // 2. Get Stripe invoices if customer exists
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
    });

    if (subscription?.stripeCustomerId) {
      try {
        const stripeInvoices = await getCustomerInvoices(
          subscription.stripeCustomerId,
          limit
        );

        // Transform Stripe invoices to our format
        for (const invoice of stripeInvoices) {
          allInvoices.push({
            id: invoice.id,
            date: new Date((invoice.created || 0) * 1000).toISOString(),
            amount: (invoice.amount_paid || 0) / 100, // Convert cents to dollars
            currency: (invoice.currency || 'usd').toUpperCase(),
            status: mapInvoiceStatus(invoice.status),
            description: getInvoiceDescription(invoice),
            invoicePdfUrl: invoice.invoice_pdf || null,
            provider: 'STRIPE',
            planType: 'MONTHLY',
          });
        }
      } catch (error) {
        // Log but don't fail - dLocal invoices are still available
        console.error('[Invoices] Error fetching Stripe invoices:', error);
      }
    }

    // Sort all invoices by date (newest first)
    allInvoices.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    // Apply limit and check for hasMore
    const hasMore = allInvoices.length > limit;
    const invoicesToReturn = allInvoices.slice(0, limit);

    return NextResponse.json({
      invoices: invoicesToReturn,
      hasMore,
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
