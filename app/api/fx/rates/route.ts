/**
 * Public display snapshot for all subscription prices. Providers are fetched
 * through the shared server cache; a CDN may also serve this response for up to
 * an hour (M1.0: davintrade.com reads it), so a displayed rate can be that much
 * older than the server's. These rates are for display only: checkout quotes
 * come from /api/payments/dlocal/convert, which is never cached.
 * Includes provenance and the provider's publication time, never credentials.
 */
import { NextResponse } from 'next/server';
import { getDisplayUsdRates } from '@/lib/fx/usd-rates';

export async function GET(): Promise<NextResponse> {
  const rates = await getDisplayUsdRates();
  return NextResponse.json(rates, {
    headers: {
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=300',
    },
  });
}
