/**
 * GET /api/geo/detect
 *
 * Thin wrapper around lib/geo/detect-country.ts's detectCountry(). Detects
 * the caller's country from Cloudflare/Vercel geo headers, falling back to
 * IP geolocation.
 *
 * Response:
 * - 200: { country, countryCode }
 *
 * @module app/api/geo/detect/route
 */

import { NextRequest, NextResponse } from 'next/server';

import { detectCountry } from '@/lib/geo/detect-country';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const country = await detectCountry(request.headers);

  return NextResponse.json({ country, countryCode: country });
}
