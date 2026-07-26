/**
 * Wise Recipients API Route (Session 4A-W3b)
 *
 * POST /api/wise/recipients — affiliate submits their bank details, proxies
 *   to money-service's POST /v1/wise/recipients.
 * GET /api/wise/recipients — admin paginated list, proxies to money-service's
 *   GET /v1/wise/recipients.
 *
 * @module app/api/wise/recipients/route
 */

import { NextRequest, NextResponse } from 'next/server';

import { requireAffiliate, requireAdmin } from '@/lib/auth/session';
import { AuthError } from '@/lib/auth/errors';
import { MoneyServiceError } from '@/lib/money-service/client';
import {
  getMoneyServiceToken,
  createWiseRecipient,
  fetchWiseRecipientsAdmin,
} from '@/lib/money-service/routes';
import type {
  CreateWiseRecipientPayload,
  WiseRecipientSummary,
  WiseRecipientsAdminList,
} from '@/lib/money-service/wise-types';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    await requireAffiliate();

    const token = await getMoneyServiceToken();
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as CreateWiseRecipientPayload;

    const data = await createWiseRecipient<WiseRecipientSummary>(token, body);

    return NextResponse.json(data, { status: 201 });
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

    console.error('[Wise Recipients] create error:', error);
    return NextResponse.json(
      { error: 'Failed to create recipient' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await requireAdmin();

    const token = await getMoneyServiceToken();
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const page = searchParams.get('page');
    const pageSize = searchParams.get('pageSize');

    const data = await fetchWiseRecipientsAdmin<WiseRecipientsAdminList>(
      token,
      {
        status: status ?? undefined,
        page: page ? Number(page) : undefined,
        pageSize: pageSize ? Number(pageSize) : undefined,
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

    console.error('[Wise Recipients] admin list error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recipients' },
      { status: 500 }
    );
  }
}
