import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { Timeframe } from '../../cycle/slot';
import { SR_COLUMNS } from './bundle-types';

/**
 * The ONE query that reads a bar's support and resistance levels (`sr_1` to `sr_16`) out of
 * market_data_v6, for the bundle's `context_levels` (build step 4 part 5; kit standard 1.0.6).
 *
 * It asks for exactly one bar: the one the bundle already holds as its last closed bar of the
 * timeframe, by its open time. It sits BESIDE `channel-bars-query.ts`, not inside it, for two
 * reasons. The bars query is read once per timeframe so the last bar and its window come from one
 * read, and it selects the columns the evaluators read; `sr_*` are not among them (no evaluator reads
 * them), and adding sixteen columns to every one of up to three thousand rows would cost far more
 * than one extra row. And the bar is named by its open time rather than "the newest at or before the
 * slot", so the levels belong to the very bar the bundle's last bar is, whatever arrived in between.
 */
export type FetchContextLevels = (
  timeframe: Timeframe,
  openTime: number
) => Promise<Record<string, number | null> | null>;

const SELECT = Object.fromEntries(
  SR_COLUMNS.map((column) => [column, true])
) as Prisma.MarketDataV6Select;

export function contextLevelsFetcher(
  prisma: Pick<PrismaService, 'marketDataV6'>,
  symbol: string
): FetchContextLevels {
  return async (timeframe, openTime) =>
    (await prisma.marketDataV6.findFirst({
      where: { symbol, timeframe, timestamp: openTime },
      select: SELECT,
    })) as Record<string, number | null> | null;
}
