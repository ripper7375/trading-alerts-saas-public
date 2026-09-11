/**
 * Currency & Gold Index (Lane 4) read layer.
 *
 * Unlike economic-events/indicator-statistics, `currency_gold_indices` is NOT
 * an append-only revision stream: (index_name, bar_time) has exactly one
 * correct, deterministically-recomputed value (see
 * currency_gold_index_engine.py's index_value() docstring), so there is
 * nothing to collapse via `distinct` in the append-only sense those two
 * queries use it for. `distinct` is still used here, but only to pick the
 * latest BAR per index -- a genuinely different bar, not a revision of the
 * same one.
 *
 * @module lib/currency-gold-indices/queries
 */

import { marketPrisma } from '@/lib/db/market-prisma';

export interface CurrencyGoldIndexSnapshot {
  symbol: string;
  price: number;
  changePct: number;
  /**
   * Always 100.00: every index is rebased to exactly 100.00 at its own
   * session-open bar by construction (the C_i normalization constant for the
   * 8 currency indices; a direct ratio for XAUX), so there is no separate
   * "previous close" to look up. Kept as an explicit field because the
   * frontend's FloatingSparkline component takes it as a prop (the floating
   * reference line), not because it varies.
   */
  previousClose: number;
  /** Values from this index's own session-open bar through the latest bar, ascending by time. */
  sparkline: number[];
  /** Unix UTC of the latest bar -- lets the widget show data freshness. */
  barTime: number;
}

const ALL_INDEX_NAMES = [
  'XAUX',
  'USDX',
  'EURX',
  'JPYX',
  'GBPX',
  'AUDX',
  'NZDX',
  'CADX',
  'CHFX',
] as const;

export async function getCurrencyGoldIndexSnapshots(): Promise<
  CurrencyGoldIndexSnapshot[]
> {
  try {
    // Latest bar per index. Also carries THAT index's own current
    // session_open_bar_time, which bounds the sparkline query below --
    // currency indices and XAUX can be mid-different-sessions at the same
    // instant (independent daily inceptions: 00:00 vs 01:01 server time), so
    // this must be read per-index rather than assumed shared.
    const latest = await marketPrisma.currencyGoldIndex.findMany({
      orderBy: [{ index_name: 'asc' }, { bar_time: 'desc' }],
      distinct: ['index_name'],
      select: {
        index_name: true,
        bar_time: true,
        value: true,
        change_pct: true,
        session_open_bar_time: true,
      },
    });

    if (latest.length === 0) return [];

    // Sparkline: every bar for each index from ITS OWN session-open bar
    // (from `latest`, above) through now. One query, one OR clause per index,
    // rather than 9 separate round trips.
    const sparklineRows = await marketPrisma.currencyGoldIndex.findMany({
      where: {
        OR: latest.map((l) => ({
          index_name: l.index_name,
          bar_time: { gte: l.session_open_bar_time },
        })),
      },
      orderBy: [{ index_name: 'asc' }, { bar_time: 'asc' }],
      select: { index_name: true, value: true },
    });

    const sparklineByIndex = new Map<string, number[]>();
    for (const row of sparklineRows) {
      const arr = sparklineByIndex.get(row.index_name) ?? [];
      arr.push(row.value);
      sparklineByIndex.set(row.index_name, arr);
    }

    return latest.map((l) => ({
      symbol: l.index_name,
      price: l.value,
      changePct: l.change_pct,
      previousClose: 100.0,
      sparkline: sparklineByIndex.get(l.index_name) ?? [l.value],
      barTime: l.bar_time,
    }));
  } catch (error) {
    // The table is created by a migration applied separately from the
    // application deploy, and the VPS engine may not have pushed anything
    // yet -- both must degrade to "nothing to show", not a broken widget,
    // matching lib/economic-events/queries.ts's own established precedent.
    console.error('[currency-gold-indices] snapshot query failed:', error);
    return [];
  }
}

export { ALL_INDEX_NAMES };
