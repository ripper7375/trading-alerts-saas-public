/**
 * Affiliate Resource Download API Route
 *
 * GET /api/affiliate/dashboard/resources/[id]/download
 * Atomically records a download (partner-engagement counter) then redirects
 * to the asset's real file URL. Designed to be used as a plain `<a href>`
 * so the browser drives the actual download — no client JS required.
 *
 * @module app/api/affiliate/dashboard/resources/[id]/download/route
 */

import { NextRequest, NextResponse } from 'next/server';

import { requireAffiliate } from '@/lib/auth/session';
import { recordAssetEngagement } from '@/lib/marketing-resources/service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    await requireAffiliate();

    const { id } = await params;
    const asset = await recordAssetEngagement(id);

    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    if (asset.category === 'SWIPE_COPY' || !asset.fileUrl) {
      return NextResponse.json(
        {
          error:
            'This asset has no downloadable file — use the copy endpoint instead',
        },
        { status: 400 }
      );
    }

    // fileUrl may be a relative /public path (seeded assets) or an
    // absolute Vercel Blob URL (admin uploads) — NextResponse.redirect()
    // requires an absolute URL either way.
    const destination = new URL(asset.fileUrl, request.url);
    return NextResponse.redirect(destination, { status: 307 });
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

    console.error('[Affiliate Resource Download] Error:', error);
    return NextResponse.json(
      { error: 'Failed to process download' },
      { status: 500 }
    );
  }
}
