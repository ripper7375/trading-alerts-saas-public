/**
 * Currency Index Comparison (PRO) API Route
 *
 * GET /api/market/currency-index-pro/comparison?indices=EURX,JPYX&timeframe=M5|M15
 *
 * Serves /pro/currency-index/compare: up to 3000 chained OHLC candles for each
 * of 1-2 of the 9 Lane 4 indices (8 currency indices + XAUX). HRMA, SMMA and
 * Heiken Ashi are deliberately NOT computed here -- they are pure functions of
 * these candles (lib/currency-index-comparison/indicators.ts) and the page
 * recomputes them instantly as a period slider moves, with no request.
 *
 * Same PRO-gate copy-pattern as the other routes under currency-index-pro/:
 * session check, then hasPermission() with a DB tier re-check so a user who
 * has just upgraded is not refused a feature they paid for.
 *
 * Candles are cached per (index, timeframe) in Redis -- shared across PRO
 * viewers, since the payload is not per-user -- and the response itself is
 * `private`, since it sits behind a session.
 *
 * @module app/api/market/currency-index-pro/comparison/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth/auth-options';
import { hasPermission } from '@/lib/auth/permissions';
import { prisma } from '@/lib/db/prisma';
import {
  cacheCurrencyIndexComparison,
  getCachedCurrencyIndexComparison,
} from '@/lib/cache/cache-manager';
import { getComparisonCandles } from '@/lib/currency-index-comparison/queries';
import {
  COMPARISON_INDEX_NAMES,
  isComparisonIndexName,
  MAX_SELECTED_INDICES,
  type ComparisonIndexName,
  type ComparisonSeries,
  type ComparisonTimeframe,
  type IndexCandle,
} from '@/lib/currency-index-comparison/series';

export const dynamic = 'force-dynamic';

// Index levels sit around 100; 4 decimals is 0.0001 of an index point, finer
// than the MQL5 references' own 2-digit display, and roughly halves the JSON
// for 6000 candles versus full float precision.
function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}

function roundCandles(candles: IndexCandle[]): IndexCandle[] {
  return candles.map((c) => ({
    time: c.time,
    open: round4(c.open),
    high: round4(c.high),
    low: round4(c.low),
    close: round4(c.close),
  }));
}

function parseTimeframe(value: string | null): ComparisonTimeframe {
  return value === 'M5' ? 'M5' : 'M15';
}

/** 1-2 distinct valid index names, or null. */
function parseIndices(value: string | null): ComparisonIndexName[] | null {
  if (!value) return null;
  const names = value
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  const unique = [...new Set(names)];
  if (unique.length === 0 || unique.length > MAX_SELECTED_INDICES) return null;
  if (!unique.every(isComparisonIndexName)) return null;
  return unique as ComparisonIndexName[];
}

async function candlesFor(
  indexName: ComparisonIndexName,
  timeframe: ComparisonTimeframe
): Promise<IndexCandle[]> {
  try {
    const cached = await getCachedCurrencyIndexComparison<IndexCandle[]>(
      indexName,
      timeframe
    );
    if (cached) return cached;
  } catch (error) {
    // Redis being unreachable must never break the page -- fall through to
    // Postgres, same principle as the rest of Lane 4.
    console.warn(
      '[currency-index-comparison] cache read failed, falling back to Postgres:',
      error
    );
  }

  const candles = roundCandles(
    await getComparisonCandles(indexName, timeframe)
  );

  try {
    await cacheCurrencyIndexComparison(indexName, timeframe, candles);
  } catch (error) {
    console.warn('[currency-index-comparison] cache write failed:', error);
  }
  return candles;
}

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

  const indices = parseIndices(request.nextUrl.searchParams.get('indices'));
  if (!indices) {
    return NextResponse.json(
      {
        error: `indices must be 1-${MAX_SELECTED_INDICES} distinct values from ${COMPARISON_INDEX_NAMES.join(', ')}`,
      },
      { status: 400 }
    );
  }
  const timeframe = parseTimeframe(
    request.nextUrl.searchParams.get('timeframe')
  );

  const series: ComparisonSeries[] = await Promise.all(
    indices.map(async (symbol) => ({
      symbol,
      candles: await candlesFor(symbol, timeframe),
    }))
  );

  return NextResponse.json(
    { timeframe, series },
    { headers: { 'Cache-Control': 'private, max-age=30' } }
  );
}
