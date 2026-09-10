/**
 * Chart Render Download API Route
 *
 * GET /api/chart/download
 *
 * Checks the PRO entitlement, resolves which render variant the caller should
 * get from their stored `m5OnM15` preference, then redirects to a short-lived
 * presigned R2 URL. Designed to be used as a plain `<a href>` so the browser
 * drives the download -- no client JS -- following the pattern set by the
 * affiliate resource download route.
 *
 * The variant is read server-side rather than taken from a query parameter so
 * that **one source decides**: the chart toggle writes the preference, this
 * route reads it, and the future Pillar 6 vision fetch will read the same
 * thing. That is what keeps the downloaded PNG matching what the trader is
 * actually looking at.
 *
 * The redirect (rather than streaming the bytes) keeps egress on R2 and the
 * function memory-flat, while the short TTL means a shared link stops working
 * in about a minute.
 *
 * @module app/api/chart/download/route
 */

import { NextResponse } from 'next/server';

import { requireChartDownload } from '@/lib/auth/permissions';
import { getM5OnM15Preference } from '@/lib/preferences/server-preferences';
import { getSignedChartUrl } from '@/lib/storage/r2';

export async function GET(): Promise<NextResponse> {
  try {
    const session = await requireChartDownload();

    const m5OnM15 = await getM5OnM15Preference(session.user.id);
    const variant = m5OnM15 ? 'overlay' : 'standard';

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
