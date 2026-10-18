/**
 * Read the day of closed bars the prompt shows: 288 M5 and 96 M15 bars from `market_data_v6`,
 * with open, high, low and close, pinned to a cycle (build step 7 part 2, architecture 5.5,
 * ADR-003, ADR-011, plan decision D7). Imported by path, never through a barrel, like
 * `lib/engine4/read/bars.ts`, whose style this follows.
 *
 * POINT IN TIME. `timestamp` is a bar's OPEN time in unix UTC seconds. A bar is closed at the
 * cycle's slot when `timestamp + period <= slot`, so the reader asks for bars with
 * `timestamp <= slot - period` and for nothing newer: not the bar still forming, not a row a
 * later cycle wrote. The same query returns the same bars whenever it is run.
 *
 * THE WINDOW is the 24 hours that end at the LAST CLOSED BAR of each timeframe: the newest
 * closed bar at or before the slot is found first, and the window is the `N - 1` periods before
 * its open time (N = 288 for M5, 96 for M15) up to it. In a live market that bar opened one
 * period before the slot; on a weekend or a holiday it is Friday's last bar, so the block shows
 * the last day that traded, and its header says so by stating the real number of bars (a day
 * with a daily break has fewer than 288; nothing is padded).
 *
 * FAILS CLOSED. A database error, a slot that is not a slot, or a row that cannot be a bar
 * (a price that is not a number, a high under the low, an open or close outside the high-low
 * range, a time out of order or outside the window) is `ok: false` with the reason: the
 * caller then tells the model the OHLC is unavailable instead of showing numbers it cannot
 * vouch for. Nothing here throws for a database failure.
 *
 * @module lib/reply/read/day-bars
 */

import 'server-only';

import { marketPrisma } from '@/lib/db/market-prisma';

import { PACKET_SYMBOL, secondsOfSlot } from '../contracts/intake';
import type { Timeframe } from '../contracts/intake';
import { DAY_BAR_COUNT, PERIOD_SECONDS } from '../context/ohlc-compact';
import type { Bar, DayBars } from '../context/ohlc-compact';

export interface BarRow {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

/** The two delegates of `marketPrisma` this reader calls: the real one fits with no cast; a test passes its own. */
export interface DayBarsClient {
  marketDataV6: {
    findFirst(args: {
      where: {
        symbol: string;
        timeframe: Timeframe;
        timestamp: { lte: number };
      };
      orderBy: { timestamp: 'desc' };
      select: { timestamp: true };
    }): Promise<{ timestamp: number } | null>;
    findMany(args: {
      where: {
        symbol: string;
        timeframe: Timeframe;
        timestamp: { gte: number; lte: number };
      };
      orderBy: { timestamp: 'asc' };
      select: {
        timestamp: true;
        open: true;
        high: true;
        low: true;
        close: true;
      };
    }): Promise<BarRow[]>;
  };
}

export interface DayBarsRequest {
  /** the cycle's slot, `2026-09-18T20:55Z` */
  slot: string;
  symbol?: string;
}

export type DayBarsErrorCode = 'BAD_SLOT' | 'DATABASE_ERROR' | 'BAD_ROW';

export type DayBarsRead =
  | { ok: true; bars: DayBars }
  | { ok: false; code: DayBarsErrorCode; detail: string };

class BadRow extends Error {}

function badRow(timeframe: Timeframe, row: BarRow, why: string): BadRow {
  return new BadRow(`the ${timeframe} bar at ${String(row.timestamp)} ${why}`);
}

function toBars(
  timeframe: Timeframe,
  rows: readonly BarRow[],
  from: number,
  to: number
): Bar[] {
  let previous: number | null = null;
  return rows.map((row) => {
    const values = [row.open, row.high, row.low, row.close];
    if (
      !Number.isInteger(row.timestamp) ||
      values.some(
        (value) => typeof value !== 'number' || !Number.isFinite(value)
      )
    ) {
      throw badRow(timeframe, row, 'has a value that is not a number');
    }
    if (row.timestamp < from || row.timestamp > to) {
      throw badRow(timeframe, row, 'is outside the window of the cycle');
    }
    if (previous !== null && row.timestamp <= previous) {
      throw badRow(timeframe, row, 'is not after the bar before it');
    }
    if (
      row.high < row.low ||
      row.open > row.high ||
      row.open < row.low ||
      row.close > row.high ||
      row.close < row.low
    ) {
      throw badRow(
        timeframe,
        row,
        'has an open or close outside its high-low range'
      );
    }
    previous = row.timestamp;
    return {
      openTime: row.timestamp,
      open: row.open,
      high: row.high,
      low: row.low,
      close: row.close,
    };
  });
}

async function readTimeframe(
  client: DayBarsClient,
  symbol: string,
  timeframe: Timeframe,
  slotSeconds: number
): Promise<Bar[]> {
  const period = PERIOD_SECONDS[timeframe];
  const lastClosableOpen = slotSeconds - period;
  const newest = await client.marketDataV6.findFirst({
    where: { symbol, timeframe, timestamp: { lte: lastClosableOpen } },
    orderBy: { timestamp: 'desc' },
    select: { timestamp: true },
  });
  if (newest === null) return [];
  const anchor = newest.timestamp;
  if (!Number.isInteger(anchor) || anchor > lastClosableOpen) {
    throw new BadRow(
      `the newest ${timeframe} bar, ${String(anchor)}, is not a closed bar of the cycle`
    );
  }
  const from = anchor - (DAY_BAR_COUNT[timeframe] - 1) * period;
  const rows = await client.marketDataV6.findMany({
    where: { symbol, timeframe, timestamp: { gte: from, lte: anchor } },
    orderBy: { timestamp: 'asc' },
    select: { timestamp: true, open: true, high: true, low: true, close: true },
  });
  return toBars(timeframe, rows, from, anchor);
}

/** The closed M5 and M15 bars of the day that ends at the cycle's last closed bar, oldest first. */
export async function readDayBars(
  request: DayBarsRequest,
  client: DayBarsClient = { marketDataV6: marketPrisma.marketDataV6 }
): Promise<DayBarsRead> {
  const slotSeconds = secondsOfSlot(request.slot);
  if (slotSeconds === null) {
    return {
      ok: false,
      code: 'BAD_SLOT',
      detail:
        'the cycle slot is not a slot (a UTC time on the five-minute grid)',
    };
  }
  const symbol = request.symbol ?? PACKET_SYMBOL;
  try {
    const [m5, m15] = await Promise.all([
      readTimeframe(client, symbol, 'M5', slotSeconds),
      readTimeframe(client, symbol, 'M15', slotSeconds),
    ]);
    return { ok: true, bars: { symbol, slotSeconds, m5, m15 } };
  } catch (error) {
    if (error instanceof BadRow) {
      return { ok: false, code: 'BAD_ROW', detail: error.message };
    }
    return {
      ok: false,
      code: 'DATABASE_ERROR',
      detail: `the day's bars could not be read: ${
        error instanceof Error ? error.message : 'unknown error'
      }`,
    };
  }
}
