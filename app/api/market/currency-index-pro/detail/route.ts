/**
 * Currency Index PRO Plan (Phase 3) — Per-Currency Detail API Route
 *
 * GET /api/market/currency-index-pro/detail?currency=EUR
 *
 * Serves the HRMA/SMMA line-plot modal: one currency's full M15 series
 * (value, HRMA, SMMA, zone per bar), the corridor thresholds, the
 * `minBarsForSignal` warm-up cutoff, and the latest-bar signal -- so a user
 * can visually verify a CONFIRMED_BUY/CONFIRMED_SELL badge instead of
 * trusting it blindly (the reason this endpoint exists at all: a table
 * badge alone asks for trust, this shows the actual cross).
 *
 * Also returns the exact `hrmaPeriod`/`smmaPeriod` used to compute this
 * response (the user's own saved preference) -- the modal's "what-if"
 * period sliders need a starting value, and re-deriving it from
 * `preferences` a second time client-side would need a redundant fetch of
 * an endpoint (`/preferences`) this route already reads internally.
 * Recomputing HRMA/SMMA for a NEW period never needs another request: the
 * response already carries every bar's raw `changePct`, and
 * `computeHrma`/`computeSmma` are pure client-safe functions -- the modal
 * imports them directly rather than asking this route again per slider tick.
 *
 * Deliberately a separate, on-demand endpoint rather than folding the full
 * per-bar series into `/screener` -- that route is polled every 30s by
 * every open cockpit, and 8 full-day HRMA/SMMA series is a needless payload
 * for the common case where no modal is open. This route is fetched only
 * while a user has the modal open for one specific currency.
 *
 * Same PRO-gate copy-pattern as the other 3 routes in this plan.
 *
 * @module app/api/market/currency-index-pro/detail/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth/auth-options';
import { hasPermission } from '@/lib/auth/permissions';
import { prisma } from '@/lib/db/prisma';
import { sampleM15Bars } from '@/lib/currency-index-pro/math';
import {
  buildSignalSeries,
  detectStageBSignal,
} from '@/lib/currency-index-pro/signals';
import {
  ALL_CURRENCIES,
  indexNameForCurrency,
} from '@/lib/currency-index-pro/pairs';
import {
  getLatestCorridor,
  getTodaysSessionBarsForIndices,
  getUserCurrencyIndexPreference,
} from '@/lib/currency-index-pro/queries';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!hasPermission(session.user, 'currency_index_pro')) {
    const dbUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { tier: true },
    });
    if (dbUser?.tier !== 'PRO') {
      return NextResponse.json(
        { error: 'PRO subscription required' },
        { status: 403 }
      );
    }
  }

  const currencyParam = request.nextUrl.searchParams.get('currency');
  const currency = ALL_CURRENCIES.find((c) => c === currencyParam);
  if (!currency) {
    return NextResponse.json(
      {
        error: 'currency must be one of USD, EUR, GBP, JPY, AUD, CAD, CHF, NZD',
      },
      { status: 400 }
    );
  }

  const indexName = indexNameForCurrency(currency);
  const [barsByIndex, corridor, preferences] = await Promise.all([
    getTodaysSessionBarsForIndices([indexName]),
    getLatestCorridor(),
    getUserCurrencyIndexPreference(session.user.id),
  ]);

  const entry = barsByIndex.get(indexName);
  const bars = entry?.bars ?? [];
  const m15Bars =
    bars.length > 0 ? sampleM15Bars(bars, entry!.sessionOpenBarTime) : [];

  const minBarsForSignal = Math.max(
    preferences.hrmaPeriod,
    preferences.smmaPeriod
  );
  const series = buildSignalSeries(
    m15Bars,
    corridor,
    preferences.hrmaPeriod,
    preferences.smmaPeriod
  );
  const signal =
    series.length > 0
      ? detectStageBSignal(series, 6, minBarsForSignal)
      : 'NONE';

  return NextResponse.json(
    {
      currency,
      indexName,
      serverTime: Math.floor(Date.now() / 1000),
      corridor,
      hrmaPeriod: preferences.hrmaPeriod,
      smmaPeriod: preferences.smmaPeriod,
      minBarsForSignal,
      signal,
      series,
    },
    { headers: { 'Cache-Control': 'private, max-age=30' } }
  );
}
