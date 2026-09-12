/**
 * Currency Index PRO Plan (Phase 2) — Screener API Route
 *
 * GET /api/market/currency-index-pro/screener
 *
 * Serves the dual-table dataset (Requirement 5/6): a fast M5 dashboard
 * table, an M15 Stage A/B analysis table, the spread-delta "jackpot" gauge,
 * and the top-5 ranked pairs from the 28-pair confluence screener.
 *
 * Computed fresh per request from raw CurrencyGoldIndex rows, not persisted
 * into CurrencyIndexSignal -- that model exists for a future audit-trail
 * consumer, but wiring a periodic write job now would duplicate this exact
 * computation for no reader that needs it yet. Session+PRO gating (copied
 * from indicator-statistics' route, same reasoning as chart/route.ts)
 * already bounds request volume, so a short private cache header is enough.
 *
 * @module app/api/market/currency-index-pro/screener/route
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth/auth-options';
import { hasPermission } from '@/lib/auth/permissions';
import { prisma } from '@/lib/db/prisma';
import {
  sampleM15Bars,
  type CurrencyIndexBar,
} from '@/lib/currency-index-pro/math';
import {
  buildSignalSeries,
  detectStageBSignal,
} from '@/lib/currency-index-pro/signals';
import {
  scorePairs,
  ALL_CURRENCIES,
  indexNameForCurrency,
  type CurrencyCode,
  type IndexState,
} from '@/lib/currency-index-pro/pairs';
import {
  getLatestCorridor,
  getTodaysSessionBarsForIndices,
  getUserCurrencyIndexPreference,
} from '@/lib/currency-index-pro/queries';

export const dynamic = 'force-dynamic';

const G8_CURRENCIES = ALL_CURRENCIES;
const indexNameFor = indexNameForCurrency;

/** Spec Section 2.3's spread-delta status bands. */
function classifySpreadStatus(spreadPct: number): 'LOW' | 'ACTIVE' | 'EXTREME' {
  if (spreadPct >= 1.4) return 'EXTREME';
  if (spreadPct >= 0.8) return 'ACTIVE';
  return 'LOW';
}

/** DOUBLE_CONFLUENCE deserves a stronger action label than a bare
 * BUY/SELL -- spec's own top5Trades example shows "STRONG BUY" for exactly
 * this tier; the other 3 tiers' labels are a reasonable extrapolation the
 * spec doesn't spell out. */
function statusLabelFor(
  confluenceLevel: string,
  action: 'BUY' | 'SELL' | null
): string {
  if (!action) return 'NEUTRAL';
  if (confluenceLevel === 'DOUBLE_CONFLUENCE')
    return action === 'BUY' ? 'STRONG BUY' : 'STRONG SELL';
  if (confluenceLevel === 'SINGLE_CONFIRMED') return action;
  return `WATCH ${action}`;
}

export async function GET(): Promise<NextResponse> {
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

  const fxIndexNames = G8_CURRENCIES.map(indexNameFor);
  const [barsByIndex, corridor, preferences] = await Promise.all([
    getTodaysSessionBarsForIndices(fxIndexNames),
    getLatestCorridor(),
    getUserCurrencyIndexPreference(session.user.id),
  ]);

  const dashboardTableM5: unknown[] = [];
  const analysisTableM15: Array<{
    currency: CurrencyCode;
    indexName: string;
    currentPct: number;
    zone: string;
    hrma: number | null;
    smma: number | null;
    crossoverState: string;
  }> = [];
  const indexStates: Partial<Record<CurrencyCode, IndexState>> = {};

  for (const currency of G8_CURRENCIES) {
    const indexName = indexNameFor(currency);
    const entry = barsByIndex.get(indexName);
    const bars = entry?.bars ?? [];

    if (bars.length === 0) {
      // No data pushed yet for this index today -- degrade this row to
      // NEUTRAL/no-signal rather than fabricate a reading, same "absent is
      // the honest rendering" rule the rest of this app follows.
      indexStates[currency] = {
        currency,
        changePct: 0,
        zone: 'NEUTRAL',
        signal: 'NONE',
      };
      continue;
    }

    // Provably in-bounds: the `bars.length === 0` check above already
    // returned via `continue`.
    const latest = bars[bars.length - 1] as CurrencyIndexBar;
    const highPct = Math.max(...bars.map((b) => b.changePct));
    const lowPct = Math.min(...bars.map((b) => b.changePct));
    dashboardTableM5.push({
      currency,
      indexName,
      price: latest.value,
      changePct: latest.changePct,
      highPct,
      lowPct,
    });

    const m15Bars = sampleM15Bars(bars, entry!.sessionOpenBarTime);
    const signalSeries = buildSignalSeries(
      m15Bars,
      corridor,
      preferences.hrmaPeriod,
      preferences.smmaPeriod
    );
    const latestSignalBar = signalSeries[signalSeries.length - 1];
    const zone = latestSignalBar?.zone ?? 'NEUTRAL';
    // Gate on BOTH periods, not just SMMA's own null-based warm-up -- HRMA
    // is mathematically defined from bar 1, but a cross against an
    // unconverged HRMA is noise, not a confirmed reversal.
    const signal =
      signalSeries.length > 0
        ? detectStageBSignal(
            signalSeries,
            6,
            Math.max(preferences.hrmaPeriod, preferences.smmaPeriod)
          )
        : 'NONE';

    indexStates[currency] = {
      currency,
      changePct: latest.changePct,
      zone,
      signal,
    };

    analysisTableM15.push({
      currency,
      indexName,
      // The M15-sampled bar's own changePct, NOT the raw M5 `latest` used
      // by dashboardTableM5 above -- this table is fed strictly by M15
      // closed bars (spec Requirement 6), and the zone/HRMA/SMMA fields
      // right next to this value are already M15-derived; showing the M5
      // value here would let the displayed number visually disagree with
      // its own zone badge. Falls back to the M5 value only when no M15
      // bar exists yet at all (the first few minutes of a session).
      currentPct: latestSignalBar?.changePct ?? latest.changePct,
      zone,
      hrma: latestSignalBar?.hrma ?? null,
      smma: latestSignalBar?.smma ?? null,
      crossoverState: signal,
    });
  }

  // Spread-delta ("jackpot meter"): the real-time M5 spread across all 8,
  // per spec Section 2.3 -- not the M15-sampled series, since this gauge is
  // meant to reflect the current instant, not a noise-reduced one.
  const changePcts = G8_CURRENCIES.map((c) => indexStates[c]!.changePct);
  const maxIdx = changePcts.indexOf(Math.max(...changePcts));
  const minIdx = changePcts.indexOf(Math.min(...changePcts));
  // Both indexOf() calls always resolve within [0, 8) -- changePcts has
  // exactly one entry per G8_CURRENCIES, never empty.
  const maxChangePct = changePcts[maxIdx] as number;
  const minChangePct = changePcts[minIdx] as number;
  const spreadPct = maxChangePct - minChangePct;

  const spreadDelta = {
    spreadPct,
    status: classifySpreadStatus(spreadPct),
    leader: {
      currency: G8_CURRENCIES[maxIdx] as CurrencyCode,
      changePct: maxChangePct,
    },
    laggard: {
      currency: G8_CURRENCIES[minIdx] as CurrencyCode,
      changePct: minChangePct,
    },
  };

  const pairScores = scorePairs(
    indexStates as Record<CurrencyCode, IndexState>
  );
  const top5Trades = pairScores.slice(0, 5).map((p, i) => ({
    rank: i + 1,
    pair: p.pair,
    action: statusLabelFor(p.confluenceLevel, p.action),
    divergenceSpread: p.divergenceSpread,
    confluenceLevel: p.confluenceLevel,
  }));

  // Per-currency recommended pair actions for the analysis table (spec's
  // own example: an oversold JPY row lists BUY USDJPY/EURJPY/GBPJPY) --
  // every scored pair touching this currency with a resolved action.
  const analysisWithActions = analysisTableM15.map((row) => ({
    ...row,
    recommendedActions: pairScores
      .filter(
        (p) => p.action && (p.base === row.currency || p.quote === row.currency)
      )
      .map((p) => ({ pair: p.pair, action: p.action })),
  }));

  return NextResponse.json(
    {
      serverTime: Math.floor(Date.now() / 1000),
      spreadDelta,
      dashboardTableM5,
      analysisTableM15: analysisWithActions,
      top5Trades,
    },
    { headers: { 'Cache-Control': 'private, max-age=30' } }
  );
}
