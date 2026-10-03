import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { Timeframe } from '../../cycle/slot';
import { BAR_COLUMNS } from './bundle-types';

/**
 * The ONE query that reads bars WITH their channel columns out of market_data_v6,
 * for the sensor inputs.
 *
 * It sits BESIDE `cycle/closed-bars-query.ts`, not inside it, on purpose: that query
 * selects the OHLC spine only, so the closed-bars digest a cycle is declared ready
 * on never changes when a later cycle refits an indicator column
 * (closed-bars-digest.ts). The sensors need the indicator columns, which the digest
 * must not contain.
 *
 * It returns the newest `take` rows whose open time is at or before `maxOpenTime`
 * (the callers pass the open time of the last bar that is closed at the slot,
 * rule 2), newest first, with exactly BAR_COLUMNS: the open time, the close and the
 * channel columns of every candidate. Open, high, low and volume are not selected.
 */
export interface ChannelBarRow {
  timestamp: number;
  close: number;
  [column: string]: number | null;
}

export type FetchChannelBars = (
  timeframe: Timeframe,
  maxOpenTime: number,
  take: number
) => Promise<ChannelBarRow[]>;

const SELECT = Object.fromEntries(
  BAR_COLUMNS.map((column) => [column, true])
) as Prisma.MarketDataV6Select;

export function channelBarsFetcher(
  prisma: Pick<PrismaService, 'marketDataV6'>,
  symbol: string
): FetchChannelBars {
  return async (timeframe, maxOpenTime, take) =>
    (await prisma.marketDataV6.findMany({
      where: { symbol, timeframe, timestamp: { lte: maxOpenTime } },
      orderBy: { timestamp: 'desc' },
      take,
      select: SELECT,
    })) as unknown as ChannelBarRow[];
}
