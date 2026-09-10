/**
 * Chart Render Download API Route
 *
 * GET /api/chart/download?variant=overlay|standard
 *
 * Checks the PRO entitlement, then redirects to a short-lived presigned R2 URL
 * for the requested render. Designed to be used as a plain `<a href>` so the
 * browser drives the download -- no client JS -- following the pattern set by
 * the affiliate resource download route.
 *
 * The redirect (rather than streaming the bytes) keeps egress on R2 and the
 * function memory-flat, while the short TTL means a shared link stops working
 * in about a minute.
 *
 * @module app/api/chart/download/route
 */

import { NextRequest, NextResponse } from 'next/server';

import { requireChartDownload } from '@/lib/auth/permissions';
import { parseChartVariant } from '@/lib/storage/chart-keys';
import { getSignedChartUrl } from '@/lib/storage/r2';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Safe to take from the client: BOTH variants are PRO-only, so this picks
    // which image, never whether the caller may have one. Unknown values fall
    // back to the default rather than erroring.
    //
    // Nothing sends it yet -- the `M5 on M15` toggle has not been ported to the
    // monolith, so there is no stored preference to read. It exists now so that
    // when the toggle lands the client can pass it with no change here.
    const variant = parseChartVariant(
      request.nextUrl.searchParams.get('variant')
    );

    await requireChartDownload();

    const signedUrl = await getSignedChartUrl(variant);
    return NextResponse.redirect(signedUrl, { status: 307 });
  } catch (error) {
    if (error instanceof Error) {
      const message = error.message;

      if (
        message.includes('PRO_REQUIRED') ||
        message.includes('PRO subscription')
      ) {
        return NextResponse.json(
          { error: 'PRO subscription required to download chart renders' },
          { status: 403 }
        );
      }

      if (
        message.includes('UNAUTHORIZED') ||
        message.includes('must be logged in') ||
        message === 'Unauthorized'
      ) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        );
      }

      // Misconfiguration is worth separating from a generic failure: it means
      // the R2 keys are absent, not that the caller did anything wrong.
      if (message.includes('is not set')) {
        console.error('[Chart Download] R2 not configured:', message);
        return NextResponse.json(
          { error: 'Chart downloads are not configured on this environment' },
          { status: 503 }
        );
      }
    }

    console.error('[Chart Download] Error:', error);
    return NextResponse.json(
      { error: 'Failed to prepare chart download' },
      { status: 500 }
    );
  }
}
