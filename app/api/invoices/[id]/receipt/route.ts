/**
 * GET /api/invoices/[id]/receipt
 *
 * PDF receipt for a completed dLocal payment. dLocal issues no invoice
 * document of its own (Stripe does -- its PDFs are linked directly from
 * GET /api/invoices), so this renders one in Stripe's receipt layout. See
 * lib/billing/dlocal-receipt.ts and lib/billing/receipt-pdf.ts.
 *
 * `id` is our `Payment.id` (what GET /api/invoices returns as the row id).
 *
 * - 401: not signed in
 * - 404: no such payment, OR it belongs to someone else, OR it is not a
 *        completed dLocal payment. One status for all three, so the route
 *        can't be used to probe which payment ids exist.
 *
 * @module app/api/invoices/[id]/receipt/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import {
  VIEW_AS_DENIED_BODY,
  resolveViewAsSubject,
} from '@/lib/admin/user-view-as';
import { authOptions } from '@/lib/auth/auth-options';
import { buildDlocalReceipt } from '@/lib/billing/dlocal-receipt';
import { renderReceiptPdf } from '@/lib/billing/receipt-pdf';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    // Admin read-only "view as user": ?view_as=user renders the viewed
    // user's receipt. The payment must still belong to that user.
    const subject = await resolveViewAsSubject(request, session.user);
    if (subject.kind === 'denied') {
      return NextResponse.json(VIEW_AS_DENIED_BODY, { status: 403 });
    }

    const payment = await prisma.payment.findFirst({
      where: {
        id,
        userId: subject.userId,
        provider: 'DLOCAL',
        status: 'COMPLETED',
      },
    });

    if (!payment) {
      return NextResponse.json({ error: 'Receipt not found' }, { status: 404 });
    }

    const user = await prisma.user.findUnique({
      where: { id: subject.userId },
      select: { name: true, email: true },
    });

    const receipt = buildDlocalReceipt(payment, {
      name: user?.name ?? null,
      email: user?.email ?? null,
    });
    const pdf = await renderReceiptPdf(receipt);

    return new NextResponse(Buffer.from(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="DavinTrade-Receipt-${receipt.receiptNumber}.pdf"`,
        'Content-Length': String(pdf.byteLength),
        // Personal financial document: never cache it in a shared cache.
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    console.error('[Receipt] Failed to generate receipt:', error);
    return NextResponse.json(
      { error: 'Failed to generate receipt' },
      { status: 500 }
    );
  }
}
