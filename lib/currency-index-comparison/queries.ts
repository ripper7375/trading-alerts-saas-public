/**
 * Currency Index Comparison (PRO) -- read layer.
 *
 * Server-only (Prisma). Reads raw `currency_gold_indices` rows for ONE index
 * and hands them to buildComparisonCandles(). One index per call so the route
 * can cache and fail each index independently -- one index's data gap or query
 * failure must never blank the other one's chart.
 *
 * @module lib/currency-index-comparison/queries
 */

import { marketPrisma } from '@/lib/db/market-prisma';

import {
  buildComparisonCandles,
  MAX_COMPARISON_CANDLES,
  type ComparisonIndexName,
  type ComparisonTimeframe,
  type IndexCandle,
  type RawIndexBar,
} from './series';

// An M15 candle is up to 3 stored M5 rows. Read 3 more than an exact multiple
// so there is at least one spare bucket at the OLD edge of the window -- the
// oldest bucket can be cut part-way through by `take`, and the final
// slice(-MAX_COMPARISON_CANDLES) then drops that partial one rather than
// charting it.
const ROW_LIMIT: Record<ComparisonTimeframe, number> = {
  M5: MAX_COMPARISON_CANDLES,
  M15: MAX_COMPARISON_CANDLES * 3 + 3,
};

export async function getComparisonCandles(
  indexName: ComparisonIndexName,
  timeframe: ComparisonTimeframe
): Promise<IndexCandle[]> {
  try {
    const rows = await marketPrisma.currencyGoldIndex.findMany({
      where: { index_name: indexName },
      orderBy: { bar_time: 'desc' },
      take: ROW_LIMIT[timeframe],
      select: {
        bar_time: true,
        session_open_bar_time: true,
        value: true,
        open: true,
        high: true,
        low: true,
      },
    });
    // Newest-first so `take` bounds the right end; candles want ascending.
    rows.reverse();

    const raw: RawIndexBar[] = rows.map((row) => ({
      barTime: row.bar_time,
      sessionOpenBarTime: row.session_open_bar_time,
      open: row.open,
      high: row.high,
      low: row.low,
      close: row.value,
    }));
    return buildComparisonCandles(raw, timeframe);
  } catch (error) {
    // Same degrade as the rest of Lane 4: an absent row is the honest
    // rendering, never a broken chart.
    console.error(
      `[currency-index-comparison] query failed for ${indexName} ${timeframe}:`,
      error
    );
    return [];
  }
}
