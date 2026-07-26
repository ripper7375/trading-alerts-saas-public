/**
 * Wise Recipient "Mine" API Route (Session 4A-W3b)
 *
 * GET /api/wise/recipients/me
 * Server-side proxy to money-service's GET /v1/wise/recipients/me.
 *
 * @module app/api/wise/recipients/me/route
 */

import { NextResponse } from 'next/server';

import { requireAffiliate } from '@/lib/auth/session';
import { AuthError } from '@/lib/auth/errors';
import { MoneyServiceError } from '@/lib/money-service/client';
import {
  getMoneyServiceToken,
  fetchWiseRecipientMe,
} from '@/lib/money-service/routes';
import type { WiseRecipientSummary } from '@/lib/money-service/wise-types';

export async function GET(): Promise<NextResponse> {
  try {
    await requireAffiliate();

    const token = await getMoneyServiceToken();
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data =
      await fetchWiseRecipientMe<Partial<WiseRecipientSummary>>(token);

    // money-service's own client.ts collapses a real 204's empty body into
    // `{}` (see callMoneyService's parseJsonBody) — the only two success
    // shapes for this endpoint are a full RecipientSummaryDto (always has
    // `id`) or a genuinely empty body, so `id` presence is a safe stand-in
    // for the original HTTP status the generic wrapper doesn't expose.
    if (!data || !data.id) {
      return new NextResponse(null, { status: 204 });
    }

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

    console.error('[Wise Recipients] me error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recipient' },
      { status: 500 }
    );
  }
}
