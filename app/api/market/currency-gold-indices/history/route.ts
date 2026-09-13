/**
 * XAUX vs USDX Comparison Chart API Route (Lane 4)
 *
 * GET /api/market/currency-gold-indices/history?timeframe=M5|M15
 *
 * Serves the public "XAUX vs USDX Comparison chart" page linked from the
 * landing-page Hero widget -- up to 3000 bars each for XAUX and USDX, on
 * either the M5 or M15 timeframe. Public and unauthenticated, same as the
 * sibling snapshot route this lane already serves (both free and PRO
 * visitors, and anonymous ones, can reach this page).
 *
 * Cache-aside via lib/cache/cache-manager.ts, same 60s TTL and same
 * Postgres/Redis-outage fallback shape as
 * app/api/market/currency-gold-indices/route.ts -- see that file's own
 * header for why a real cache is needed here (no session to bound request
 * volume).
 *
 * @module app/api/market/currency-gold-indices/history/route
 */

import { NextRequest, NextResponse } from 'next/server';

import {
  getCachedCurrencyGoldIndexHistory,
  cacheCurrencyGoldIndexHistory,
} from '@/lib/cache/cache-manager';
import {
  getCurrencyGoldIndexHistory,
  type CurrencyGoldIndexHistorySeries,
} from '@/lib/currency-gold-indices/queries';
import type { ComparisonTimeframe } from '@/lib/currency-gold-indices/history';

export const dynamic = 'force-dynamic';

const RESPONSE_CACHE_CONTROL = 'public, s-maxage=60, stale-while-revalidate=30';

function parseTimeframe(value: string | null): ComparisonTimeframe {
  return value === 'M5' ? 'M5' : 'M15';
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const timeframe = parseTimeframe(
    request.nextUrl.searchParams.get('timeframe')
  );

  try {
    const cached =
      await getCachedCurrencyGoldIndexHistory<CurrencyGoldIndexHistorySeries[]>(
        timeframe
      );
    if (cached) {
      return NextResponse.json(
        { timeframe, series: cached },
        { headers: { 'Cache-Control': RESPONSE_CACHE_CONTROL } }
      );
    }
  } catch (error) {
    // Redis being unreachable must never break this route -- fall through to
    // Postgres, same principle as the sibling snapshot route.
    console.warn(
      '[currency-gold-indices] history cache read failed, falling back to Postgres:',
      error
    );
  }

  const series = await getCurrencyGoldIndexHistory(timeframe);

  try {
    await cacheCurrencyGoldIndexHistory(timeframe, series);
  } catch (error) {
    console.warn('[currency-gold-indices] history cache write failed:', error);
  }

  return NextResponse.json(
    { timeframe, series },
    { headers: { 'Cache-Control': RESPONSE_CACHE_CONTROL } }
  );
}
