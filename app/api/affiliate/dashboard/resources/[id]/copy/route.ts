/**
 * Affiliate Resource Copy-Tracking API Route
 *
 * POST /api/affiliate/dashboard/resources/[id]/copy
 * Records a swipe-copy usage (partner-engagement counter) and returns the
 * server-authoritative copy text, so the client never hardcodes it.
 *
 * @module app/api/affiliate/dashboard/resources/[id]/copy/route
 */

import { NextRequest, NextResponse } from 'next/server';

import { requireAffiliate } from '@/lib/auth/session';
import { recordAssetEngagement } from '@/lib/marketing-resources/service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(
  _request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    await requireAffiliate();

    const { id } = await params;
    const asset = await recordAssetEngagement(id);

    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    if (asset.category !== 'SWIPE_COPY' || !asset.copyText) {
      return NextResponse.json(
        {
          error:
            'This asset has no copy text — use the download endpoint instead',
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      text: asset.copyText,
      downloadCount: asset.downloadCount,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('AFFILIATE_REQUIRED')) {
        return NextResponse.json(
          { error: 'Affiliate access required' },
          { status: 403 }
        );
      }
      if (
        error.message.includes('UNAUTHORIZED') ||
        error.message === 'Unauthorized'
      ) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        );
      }
    }

    console.error('[Affiliate Resource Copy] Error:', error);
    return NextResponse.json(
      { error: 'Failed to record copy usage' },
      { status: 500 }
    );
  }
}
