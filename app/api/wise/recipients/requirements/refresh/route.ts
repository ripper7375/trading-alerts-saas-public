/**
 * Wise Recipient Requirements Refresh API Route (Session 4A-W3b)
 *
 * POST /api/wise/recipients/requirements/refresh
 * Server-side proxy to money-service's POST
 * /v1/wise/recipients/requirements/refresh. Not in this order's own File 1
 * route-handler list — added because the Contract section documents this
 * endpoint and File 2's refreshRequirementsOnChange interaction needs it
 * (recorded as a Deviation).
 *
 * @module app/api/wise/recipients/requirements/refresh/route
 */

import { NextRequest, NextResponse } from 'next/server';

import { requireAffiliate } from '@/lib/auth/session';
import { AuthError } from '@/lib/auth/errors';
import { MoneyServiceError } from '@/lib/money-service/client';
import {
  getMoneyServiceToken,
  refreshWiseRecipientRequirements,
} from '@/lib/money-service/routes';
import type { WiseAccountRequirementGroup } from '@/lib/money-service/wise-types';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    await requireAffiliate();

    const token = await getMoneyServiceToken();
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    if (
      !body ||
      typeof body.quoteId !== 'string' ||
      typeof body.partial !== 'object'
    ) {
      return NextResponse.json(
        { error: 'quoteId and partial are required' },
        { status: 400 }
      );
    }

    const data = await refreshWiseRecipientRequirements<{
      groups: WiseAccountRequirementGroup[];
    }>(token, { quoteId: body.quoteId, partial: body.partial });

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

    console.error('[Wise Recipients] requirements refresh error:', error);
    return NextResponse.json(
      { error: 'Failed to refresh account requirements' },
      { status: 500 }
    );
  }
}
