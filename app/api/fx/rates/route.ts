/**
 * GET /api/fx/rates
 *
 * Public: the live USD display rates (units per 1 USD) for every display
 * currency, from the same hourly table dLocal charges with
 * (lib/fx/usd-rates.ts). The browser's LocaleProvider refreshes from here
 * hourly while a page stays open. Contains market rates only, nothing
 * user-specific.
 *
 * @module app/api/fx/rates/route
 */

import { NextResponse } from 'next/server';

import { getDisplayUsdRates } from '@/lib/fx/usd-rates';

export async function GET(): Promise<NextResponse> {
  const rates = await getDisplayUsdRates();
  return NextResponse.json(rates, {
    headers: {
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600',
    },
  });
}
