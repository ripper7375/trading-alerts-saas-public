/**
 * Currency Index PRO Plan (Phase 2) — Chart Data API Route
 *
 * GET /api/market/currency-index-pro/chart?timeframe=M5|M15
 *
 * Serves the multi-line relative-strength chart: today's per-index series
 * (M15-sampled by default, per Section 5's dual-timeframe split), the
 * latest Dynamic Volatility Corridor, and today's high-impact news markers.
 *
 * PRO-gated -- session check, then `hasPermission()` with a DB tier
 * re-check fallback, copied from `app/api/market/indicator-statistics/
 * route.ts` verbatim rather than re-invented: `requirePro()` trusts the
 * JWT's `tier` claim alone, which would refuse a user who has JUST paid for
 * PRO and still carries a stale FREE claim.
 *
 * @module app/api/market/currency-index-pro/chart/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth/auth-options';
import { hasPermission } from '@/lib/auth/permissions';
import { prisma } from '@/lib/db/prisma';
import { sampleM15Bars } from '@/lib/currency-index-pro/math';
import {
  ALL_CURRENCIES,
  indexNameForCurrency,
} from '@/lib/currency-index-pro/pairs';
import {
  getLatestCorridor,
  getTodaysSessionBarsForIndices,
} from '@/lib/currency-index-pro/queries';
import { getHighImpactEventsForDay } from '@/lib/economic-events/queries';

export const dynamic = 'force-dynamic';

const G8_CURRENCIES = ALL_CURRENCIES;
const FX_INDEX_NAMES = ALL_CURRENCIES.map(indexNameForCurrency);

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

  const timeframe =
    request.nextUrl.searchParams.get('timeframe') === 'M5' ? 'M5' : 'M15';

  const [barsByIndex, corridor] = await Promise.all([
    getTodaysSessionBarsForIndices(FX_INDEX_NAMES),
    getLatestCorridor(),
  ]);

  // All 8 FX indices roll over at the same instant (00:00 server time,
  // Phase 1 finding) -- any one of them that has data today carries the
  // shared session boundary.
  const todaySessionOpen =
    [...barsByIndex.values()][0]?.sessionOpenBarTime ?? null;

  const series: Record<string, { barTime: number; changePct: number }[]> = {};
  for (const indexName of FX_INDEX_NAMES) {
    const entry = barsByIndex.get(indexName);
    const bars = entry?.bars ?? [];
    const sampled =
      timeframe === 'M15'
        ? sampleM15Bars(bars, entry?.sessionOpenBarTime ?? 0)
        : bars;
    series[indexName] = sampled.map((bar) => ({
      barTime: bar.barTime,
      changePct: bar.changePct,
    }));
  }

  // The exact next-rollover instant is only known to the VPS engine's own
  // DST-aware logic (Phase 1); +24h is a good-enough approximation for a
  // chart's own "today" window -- a news marker landing a few minutes on
  // the wrong side of a DST-transition midnight is cosmetic, not a
  // correctness issue for a timeline overlay.
  const highImpactNews =
    todaySessionOpen !== null
      ? await getHighImpactEventsForDay(
          todaySessionOpen,
          todaySessionOpen + 86400,
          G8_CURRENCIES
        )
      : [];

  return NextResponse.json(
    {
      timeframe,
      serverTime: Math.floor(Date.now() / 1000),
      todaySessionOpen,
      corridor,
      highImpactNews,
      series,
    },
    {
      headers: {
        // Session+PRO gating already bounds request volume (unlike the
        // genuinely-public currency-gold-indices route), so a short private
        // cache is enough -- no Redis needed, matching indicator-statistics'
        // own established precedent.
        'Cache-Control': 'private, max-age=30',
      },
    }
  );
}
