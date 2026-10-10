/**
 * Read the closed M5 bars of the last 24 hours from `market_data_v6`
 * (architecture 3.6 and 6.10 check 0, ADR-034, plan assumption A3): the
 * `timestamp`, `high` and `low` that `dayRange` turns into the one-day range
 * a custom entry is held to.
 *
 * `timestamp` is the bar's OPEN time in unix UTC seconds (architecture 1.3 rule
 * 2: a bar is closed when its open time plus its period is at or before the
 * clock). The query asks for the bars that opened from 24 hours ago up to five
 * minutes ago, which are the closed ones; `dayRange` applies the same two edges
 * again, so a bar still forming that a database returned anyway is dropped there.
 * The 288 rows of a day are the most this returns.
 *
 * Nothing here throws for a database error: the answer is `ok: false` and the
 * reason, and the range is then UNKNOWN, which refuses a custom entry rather
 * than guessing one (a zone's own price is never held to the range).
 *
 * @module lib/engine4/read/bars
 */

import { marketPrisma } from '@/lib/db/market-prisma';

import { M5_SECONDS, type DayBar } from '../entry-bound';
import type { DecimalLike } from '../exact';
import { DAY_SECONDS, readSeconds, toDbInt } from '../time';

const DEFAULT_SYMBOL = 'XAUUSD';

/** The one delegate of `marketPrisma` this reader calls: the real one fits with no cast; a test passes its own. */
export interface BarsClient {
  marketDataV6: {
    findMany(args: {
      where: {
        symbol: string;
        timeframe: 'M5';
        timestamp: { gte: number; lte: number };
      };
      orderBy: { timestamp: 'asc' };
      select: { timestamp: true; high: true; low: true };
    }): Promise<{ timestamp: number; high: number; low: number }[]>;
  };
}

export interface BarsRequest {
  /** the clock, unix UTC seconds; passed in so the reader holds no clock of its own */
  nowSeconds: DecimalLike;
  symbol?: string;
}

export type BarsRead =
  | { ok: true; bars: DayBar[] }
  | { ok: false; code: 'DATABASE_ERROR'; detail: string };

/** The closed M5 bars of the last 24 hours as of `nowSeconds`, oldest first. */
export async function readClosedM5Bars(
  request: BarsRequest,
  client: BarsClient = { marketDataV6: marketPrisma.marketDataV6 }
): Promise<BarsRead> {
  const now = readSeconds('nowSeconds', request.nowSeconds);
  // the first bar of the window opened 24 hours ago; the last closed bar opened five minutes ago
  const from = toDbInt('window start', now - DAY_SECONDS);
  const to = toDbInt('window end', now - M5_SECONDS);
  try {
    const rows = await client.marketDataV6.findMany({
      where: {
        symbol: request.symbol ?? DEFAULT_SYMBOL,
        timeframe: 'M5',
        timestamp: { gte: from, lte: to },
      },
      orderBy: { timestamp: 'asc' },
      select: { timestamp: true, high: true, low: true },
    });
    return {
      ok: true,
      bars: rows.map((row) => ({
        openTime: row.timestamp,
        high: row.high,
        low: row.low,
      })),
    };
  } catch (error) {
    return {
      ok: false,
      code: 'DATABASE_ERROR',
      detail: `the M5 bars could not be read: ${
        error instanceof Error ? error.message : 'unknown error'
      }`,
    };
  }
}
