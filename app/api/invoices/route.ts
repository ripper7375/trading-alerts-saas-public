/**
 * Invoices API Route
 *
 * GET /api/invoices
 * Returns user's invoice history from Stripe.
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

interface InvoiceItem {
  id: string;
  date: string;
  amount: number;
  status: 'paid' | 'open' | 'failed';
  description: string;
  invoicePdfUrl: string | null;
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

    // Get user's subscription to find Stripe customer ID
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
    });

    // If no subscription or no Stripe customer, return empty list
    if (!subscription?.stripeCustomerId) {
      return NextResponse.json({
        invoices: [],
        hasMore: false,
      });
    }

    // Fetch invoices from Stripe
    const stripeInvoices = await getCustomerInvoices(
      subscription.stripeCustomerId,
      limit + 1 // Fetch one extra to check if there are more
    );

    // Check if there are more invoices
    const hasMore = stripeInvoices.length > limit;
    const invoicesToReturn = hasMore
      ? stripeInvoices.slice(0, limit)
      : stripeInvoices;

    // Transform Stripe invoices to our format
    const invoices: InvoiceItem[] = invoicesToReturn.map((invoice) => ({
      id: invoice.id,
      date: new Date((invoice.created || 0) * 1000).toISOString(),
      amount: (invoice.amount_paid || 0) / 100, // Convert cents to dollars
      status: mapInvoiceStatus(invoice.status),
      description: getInvoiceDescription(invoice),
      invoicePdfUrl: invoice.invoice_pdf || null,
    }));

    return NextResponse.json({
      invoices,
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
