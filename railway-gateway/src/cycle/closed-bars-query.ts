import { PrismaService } from '../prisma/prisma.service';
import { FetchBars } from './closed-bars-digest';

/**
 * The ONE query that reads closed bars out of market_data_v6.
 *
 * Both the digest the gateway stores when it declares a cycle READY and every
 * reader of the closed-bar view go through this function, so a digest computed
 * later from the readers is comparable with the stored one by construction: they
 * cannot disagree because one query was tuned and the other forgotten.
 *
 * It returns the newest `take` rows whose open time is at or before `maxOpenTime`
 * (callers pass the open time of the last bar that is closed at the slot, rule 2),
 * newest first. It selects the OHLC spine only: indicator columns are left out on
 * purpose (they are refit by later cycles; see closed-bars-digest.ts).
 */
export function closedBarsFetcher(
  prisma: Pick<PrismaService, 'marketDataV6'>,
  symbol: string
): FetchBars {
  return (timeframe, maxOpenTime, take) =>
    prisma.marketDataV6.findMany({
      where: { symbol, timeframe, timestamp: { lte: maxOpenTime } },
      orderBy: { timestamp: 'desc' },
      take,
      select: {
        timestamp: true,
        open: true,
        high: true,
        low: true,
        close: true,
        volume: true,
      },
    });
}
