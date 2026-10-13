/**
 * Public display snapshot for all subscription prices. Providers are fetched
 * through the shared server cache; browser/CDN caching must not add another hour.
 * Includes provenance and the provider's publication time, never credentials.
 */
import { NextResponse } from 'next/server';
import { getDisplayUsdRates } from '@/lib/fx/usd-rates';

export async function GET(): Promise<NextResponse> {
  const rates = await getDisplayUsdRates();
  return NextResponse.json(rates, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
