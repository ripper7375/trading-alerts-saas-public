/**
 * Indicator-statistics read layer.
 *
 * The table is APPEND-ONLY -- one row per (symbol, timeframe, source) per
 * capture cycle (prisma/market-data/schema.prisma's `IndicatorStatistic`
 * model, `@@unique([symbol, timeframe, source, captured_at])`). Every read
 * here collapses to the newest observation per (symbol, timeframe, source)
 * via Prisma's own `distinct`, the same pattern
 * lib/economic-events/queries.ts already established for its own
 * append-only table.
 *
 * Ships ONLY `containment_rate` -- a raw, already-computed percentage with
 * no scoring formula and no structural bias. Deliberately does NOT surface
 * model_a_r2/model_b_r2, EDT-fitness or baseline-symmetry composites: those
 * have four unresolved problems (contradictory Bar Coverage bands, an
 * off-by-5 EDT Fitness table, R2 that measured negative in real captured
 * data, and an asymmetry-penalty question that may be measuring the wrong
 * thing) -- see FRONTEND-UI-REVISION-RECOMMENDATIONS.md §2.3. Shipping a
 * composite "quality score" built on unresolved formulas would look
 * authoritative and would not be.
 *
 * @module lib/indicator-statistics/queries
 */

import { marketPrisma } from '@/lib/db/market-prisma';

export interface LatestContainmentRate {
  symbol: string;
  timeframe: string;
  source: string;
  /** Unix seconds, UTC -- when this observation was captured. */
  capturedAt: number;
  /** Percent of the fitted window that closed inside the channel. */
  containmentRate: number | null;
  containmentCount: number | null;
  containmentN: number | null;
}

/**
 * Latest containment-rate observation for every (symbol, timeframe, source)
 * combination that has reported one.
 *
 * Returns `[]` rather than throwing when the table does not exist yet, or
 * the VPS indicators have not emitted a capture with the containment fields
 * populated -- an unbuilt or not-yet-flowing lane should render as "nothing
 * yet", not as a broken panel.
 */
export async function getLatestContainmentRates(): Promise<
  LatestContainmentRate[]
> {
  try {
    // Ordering by (symbol, timeframe, source, captured_at desc) is what
    // makes `distinct` keep the NEWEST observation of each group rather
    // than an arbitrary one.
    const rows = await marketPrisma.indicatorStatistic.findMany({
      orderBy: [
        { symbol: 'asc' },
        { timeframe: 'asc' },
        { source: 'asc' },
        { captured_at: 'desc' },
      ],
      distinct: ['symbol', 'timeframe', 'source'],
      select: {
        symbol: true,
        timeframe: true,
        source: true,
        captured_at: true,
        containment_rate: true,
        containment_count: true,
        containment_n: true,
      },
    });

    return rows.map((r) => ({
      symbol: r.symbol,
      timeframe: r.timeframe,
      source: r.source,
      capturedAt: r.captured_at,
      containmentRate: r.containment_rate,
      containmentCount: r.containment_count,
      containmentN: r.containment_n,
    }));
  } catch (error) {
    // The table is created by a migration applied separately from the
    // application deploy, same as economic_events. Until then, and until
    // the VPS has actually emitted a capture, this must degrade to "nothing
    // to show" rather than a broken panel.
    console.error(
      '[indicator-statistics] containment-rate query failed:',
      error
    );
    return [];
  }
}
