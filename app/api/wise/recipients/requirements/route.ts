/**
 * Wise Recipient Account Requirements API Route (Session 4A-W3b)
 *
 * GET /api/wise/recipients/requirements
 * Server-side proxy to money-service's GET /v1/wise/recipients/requirements —
 * see lib/money-service/client.ts's header comment for why this can't be a
 * direct browser call (httpOnly session cookie, F45).
 *
 * @module app/api/wise/recipients/requirements/route
 */

import { NextRequest, NextResponse } from 'next/server';

import { requireAffiliate } from '@/lib/auth/session';
import { AuthError } from '@/lib/auth/errors';
import { MoneyServiceError } from '@/lib/money-service/client';
import {
  getMoneyServiceToken,
  fetchWiseRecipientRequirements,
} from '@/lib/money-service/routes';
import type { WiseRequirementsResponse } from '@/lib/money-service/wise-types';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await requireAffiliate();

    const token = await getMoneyServiceToken();
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const targetCurrency = searchParams.get('targetCurrency');
    if (!targetCurrency) {
      return NextResponse.json(
        { error: 'targetCurrency is required' },
        { status: 400 }
      );
    }

    const recipientCountry = searchParams.get('recipientCountry');
    const legalType = searchParams.get('legalType');
    const addressRequired = searchParams.get('addressRequired');

    const data = await fetchWiseRecipientRequirements<WiseRequirementsResponse>(
      token,
      {
        targetCurrency,
        recipientCountry: recipientCountry ?? undefined,
        legalType: legalType ?? undefined,
        addressRequired: addressRequired === 'true' ? true : undefined,
      }
    );

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

    console.error('[Wise Recipients] requirements error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch account requirements' },
      { status: 500 }
    );
  }
}
