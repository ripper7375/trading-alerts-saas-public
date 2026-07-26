/**
 * Wise Recipient Revalidate API Route (Session 4A-W3b)
 *
 * POST /api/wise/recipients/[id]/revalidate
 * Server-side proxy to money-service's POST
 * /v1/wise/recipients/:id/revalidate. Guarded with requireAffiliate() (NOT
 * requireAdmin() as this order's own File 1 text originally said) — the
 * live backend endpoint is AffiliateGuard-scoped self-service only, derives
 * the recipient from the caller's OWN token, and only uses `:id` for an
 * ownership check. An admin-guarded proxy would either 403 (an admin isn't
 * necessarily an affiliate) or silently revalidate the admin's own
 * recipient instead of the target affiliate's. Confirmed with Davin live at
 * this session's build time: revalidate is an affiliate self-service
 * action on their own payout settings page, not an admin action.
 *
 * @module app/api/wise/recipients/[id]/revalidate/route
 */

import { NextRequest, NextResponse } from 'next/server';

import { requireAffiliate } from '@/lib/auth/session';
import { AuthError } from '@/lib/auth/errors';
import { MoneyServiceError } from '@/lib/money-service/client';
import {
  getMoneyServiceToken,
  revalidateWiseRecipient,
} from '@/lib/money-service/routes';
import type { WiseRecipientSummary } from '@/lib/money-service/wise-types';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(
  _request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    await requireAffiliate();

    const token = await getMoneyServiceToken();
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const data = await revalidateWiseRecipient<WiseRecipientSummary>(token, id);

    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    if (error instanceof MoneyServiceError) {
      return NextResponse.json(error.body, { status: error.status });
    }

    console.error('[Wise Recipients] revalidate error:', error);
    return NextResponse.json(
      { error: 'Failed to revalidate recipient' },
      { status: 500 }
    );
  }
}
