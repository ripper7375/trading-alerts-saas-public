/**
 * Test support for the context assembler (build step 7 part 2): a deterministic day of M5 and
 * M15 bars, a fake `DayBarsClient` that answers the reader's two queries from those bars the way
 * PostgreSQL would, and packets for the signed-off golden cycles with the day's bars read
 * through the real reader.
 *
 * Nothing here is market data of the real world: the bars are a seeded random walk around the
 * price of the 18 Sep cycle, so a test can count rows, find a gap and compare bytes.
 */

import { secondsOfSlot } from '@/lib/reply/contracts/intake';
import type { IntakePacket, TraderType } from '@/lib/reply/contracts/intake';
import { readDayBars } from '@/lib/reply/read/day-bars';
import type { BarRow, DayBarsClient } from '@/lib/reply/read/day-bars';
import type { DayBars } from '@/lib/reply/context/ohlc-compact';

import { GOLDENS, packetFromGolden } from '../../../intake/helpers/packets';
import type { PacketOptions } from '../../../intake/helpers/packets';

export type Timeframe = 'M5' | 'M15';

export interface StoredBar extends BarRow {
  timeframe: Timeframe;
  symbol: string;
}

export const M5_SECONDS = 300;
export const M15_SECONDS = 900;

/** A small seeded generator: the same numbers on every machine. */
export function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

const round2 = (value: number): number => Math.round(value * 100) / 100;

export interface WorldOptions {
  /** unix seconds of the first M5 bar's open */
  from: number;
  /** unix seconds of the last M5 bar's open */
  to: number;
  seed?: number;
  start?: number;
  /** M5 bars whose open time is in a listed [from, to) range are left out (a market break) */
  skip?: readonly [number, number][];
  symbol?: string;
}

/** M5 bars on the five-minute grid, and the M15 bars aggregated from them. */
export function makeWorld(options: WorldOptions): StoredBar[] {
  const random = lcg(options.seed ?? 20260918);
  const symbol = options.symbol ?? 'XAUUSD';
  const skip = options.skip ?? [];
  const m5: StoredBar[] = [];
  let close = options.start ?? 4331.4;
  for (let t = options.from; t <= options.to; t += M5_SECONDS) {
    const open = close;
    close = round2(open + (random() - 0.5) * 3);
    const high = round2(Math.max(open, close) + random() * 0.8);
    const low = round2(Math.min(open, close) - random() * 0.8);
    if (skip.some(([a, b]) => t >= a && t < b)) continue;
    m5.push({
      timeframe: 'M5',
      symbol,
      timestamp: t,
      open,
      high,
      low,
      close,
    });
  }
  const m15 = new Map<number, StoredBar>();
  for (const bar of m5) {
    const key = Math.floor(bar.timestamp / M15_SECONDS) * M15_SECONDS;
    const have = m15.get(key);
    if (have === undefined) {
      m15.set(key, { ...bar, timeframe: 'M15', timestamp: key });
    } else {
      have.high = Math.max(have.high, bar.high);
      have.low = Math.min(have.low, bar.low);
      have.close = bar.close;
    }
  }
  return [...m5, ...m15.values()].sort(
    (a, b) =>
      a.timestamp - b.timestamp || a.timeframe.localeCompare(b.timeframe)
  );
}

/** A world that covers the two days before a slot, to the last bar that is closed at it. */
export function worldFor(
  slot: string,
  extra: Partial<WorldOptions> = {}
): StoredBar[] {
  const seconds = secondsOfSlot(slot) as number;
  return makeWorld({
    from: seconds - 2 * 86_400,
    to: seconds + 6 * M5_SECONDS, // bars that opened after the slot exist, to prove they are not read
    ...extra,
  });
}

export interface QueryLog {
  findFirst: unknown[];
  findMany: unknown[];
}

/** A `DayBarsClient` over arrays of bars: it applies `where`, `orderBy` and `select` the way the database does. */
export function fakeClient(
  bars: readonly StoredBar[]
): DayBarsClient & { log: QueryLog } {
  const log: QueryLog = { findFirst: [], findMany: [] };
  const matching = (where: {
    symbol: string;
    timeframe: string;
    timestamp: { gte?: number; lte: number };
  }): StoredBar[] =>
    bars.filter(
      (bar) =>
        bar.symbol === where.symbol &&
        bar.timeframe === where.timeframe &&
        bar.timestamp <= where.timestamp.lte &&
        (where.timestamp.gte === undefined ||
          bar.timestamp >= where.timestamp.gte)
    );
  return {
    log,
    marketDataV6: {
      async findFirst(args) {
        log.findFirst.push(args);
        const rows = matching(args.where).sort(
          (a, b) => b.timestamp - a.timestamp
        );
        const first = rows[0];
        return first === undefined ? null : { timestamp: first.timestamp };
      },
      async findMany(args) {
        log.findMany.push(args);
        return matching(args.where)
          .sort((a, b) => a.timestamp - b.timestamp)
          .map(({ timestamp, open, high, low, close }) => ({
            timestamp,
            open,
            high,
            low,
            close,
          }));
      },
    },
  };
}

/** The day of bars the reader finds for a slot in a world. */
export async function dayBarsFor(
  slot: string,
  bars: readonly StoredBar[] = worldFor(slot)
): Promise<DayBars> {
  const read = await readDayBars({ slot }, fakeClient(bars));
  if (!read.ok)
    throw new Error(`fixture day could not be read: ${read.detail}`);
  return read.bars;
}

export function goldenPacket(
  prefix: string,
  options: PacketOptions = {}
): IntakePacket {
  const found = GOLDENS.find((g) => g.id.startsWith(prefix));
  if (found === undefined) throw new Error(`no golden ${prefix}`);
  return packetFromGolden(found, options);
}

export const ALL_GOLDEN_IDS: readonly string[] = GOLDENS.map((g) => g.id);
export const TRADER_TYPES_FOR_TESTS: readonly TraderType[] = [
  'DAY_TRADER',
  'SCALPER',
];
