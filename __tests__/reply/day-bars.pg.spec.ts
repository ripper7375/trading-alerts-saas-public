/**
 * @jest-environment node
 */

/**
 * The reader of the prompt's day of bars against a REAL PostgreSQL (build step 7, part 2):
 * `lib/reply/read/day-bars.ts` asking the real `market_data_v6` table, through the real
 * generated Prisma client, what it asks a fake in the unit tests.
 *
 * What it shows that the unit tests (`__tests__/lib/reply/context/day-bars.test.ts`) cannot:
 *  - the queries the reader writes are accepted by the database and the real client, with the
 *    types of the real schema (`timestamp` an INTEGER, the prices DOUBLE PRECISION);
 *  - the real database gives the same answer as the fake the unit tests use, bar for bar, so
 *    the fake is a faithful stand-in (the same bars are read through both and compared);
 *  - CLOSED BARS ONLY, in the database: a bar that opened at the slot (the one forming) and every
 *    bar after it is in the table and is never returned; a bar closes at exactly its open time
 *    plus its period;
 *  - POINT IN TIME: the answer for a cycle does not change when later bars are added to the
 *    table or removed from it, and an earlier cycle reads as it was then;
 *  - the unique key (symbol, timeframe, timestamp) means the table cannot hold two rows for one
 *    bar, so the reader never has to choose between two;
 *  - a gap in the table (a market break, a weekend) gives fewer rows, never padding;
 *  - a database that cannot be reached is a `DATABASE_ERROR` result, not an exception.
 *
 * SKIPPED unless BOTH are set:
 *   CYCLE_PG_URL         a postgres URL on localhost or 127.0.0.1 (anything else is refused)
 *   CYCLE_PG_ALLOW_WIPE  "yes": it DELETES every row of `market_data_v6` for the symbols it
 *                        uses (XAUUSD and ZZTEST) in that database
 *
 * To run it on a throwaway database (see .claude/architecture/database-traps.md and
 * environment-gotchas.md):
 *   1. start a scratch PostgreSQL (initdb on a high port, `Start-Process postgres.exe`) and
 *      create an empty database;
 *   2. create the table from the market schema (a scratch Prisma config OUTSIDE the repo with
 *      `{ schema, datasource: { url } }`):
 *        prisma migrate diff --config <scratch config> --from-empty \
 *          --to-schema prisma/market-data/schema.prisma --script
 *      and apply the text with `psql -v ON_ERROR_STOP=1 -f ...`;
 *   3. CYCLE_PG_URL=postgres://postgres@127.0.0.1:55433/<db> CYCLE_PG_ALLOW_WIPE=yes \
 *        npx jest --testMatch '**\/__tests__/reply/day-bars.pg.spec.ts' --coverage=false
 *      (the root Jest configuration only collects *.test.ts, so a plain `npx jest` never runs
 *      this file);
 *   4. stop and remove the instance.
 */

import { readDayBars } from '@/lib/reply/read/day-bars';
import type { DayBarsClient } from '@/lib/reply/read/day-bars';

import {
  M15_SECONDS,
  M5_SECONDS,
  fakeClient,
  worldFor,
} from '../lib/reply/context/helpers/context-fixtures';
import type { StoredBar } from '../lib/reply/context/helpers/context-fixtures';

// the reader imports the database client at load time; this spec passes its own
jest.mock('@/lib/db/market-prisma', () => ({ marketPrisma: {} }));

const URL = process.env['CYCLE_PG_URL'] ?? '';
const enabled = URL !== '' && process.env['CYCLE_PG_ALLOW_WIPE'] === 'yes';
if (
  enabled &&
  !/^postgres(ql)?:\/\/[^@]*@(localhost|127\.0\.0\.1):\d+\//.test(URL)
) {
  throw new Error('CYCLE_PG_URL must point at localhost or 127.0.0.1');
}
const suite = enabled ? describe : describe.skip;

jest.setTimeout(120_000);

const SLOT = '2026-09-18T20:55Z'; // a Friday
const SLOT_S = Date.UTC(2026, 8, 18, 20, 55) / 1000;
const at = (iso: string): number => Date.parse(iso) / 1000;
const SYMBOLS = ['XAUUSD', 'ZZTEST'];

interface MarketClient {
  marketDataV6: DayBarsClient['marketDataV6'] & {
    createMany(args: {
      data: Record<string, unknown>[];
    }): Promise<{ count: number }>;
    create(args: { data: Record<string, unknown> }): Promise<unknown>;
    deleteMany(args: {
      where: Record<string, unknown>;
    }): Promise<{ count: number }>;
    count(args: { where: Record<string, unknown> }): Promise<number>;
  };
  $connect(): Promise<void>;
  $disconnect(): Promise<void>;
}

suite('readDayBars against PostgreSQL (market_data_v6)', () => {
  let prisma: MarketClient;

  const row = (bar: StoredBar): Record<string, unknown> => ({
    terminal_id: 'A',
    timestamp: bar.timestamp,
    symbol: bar.symbol,
    timeframe: bar.timeframe,
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
    volume: 100,
    // the two other columns the table requires (cycle provenance of the gateway's contract)
    cycle_id: 1,
    collected_at: bar.timestamp,
  });

  async function load(bars: readonly StoredBar[]): Promise<void> {
    await prisma.marketDataV6.deleteMany({
      where: { symbol: { in: SYMBOLS } },
    });
    for (let i = 0; i < bars.length; i += 500) {
      await prisma.marketDataV6.createMany({
        data: bars.slice(i, i + 500).map(row),
      });
    }
  }

  beforeAll(async () => {
    const { PrismaClient } = require('.prisma/market-client');
    const { PrismaPg } = require('@prisma/adapter-pg');
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: URL }),
    });
    await prisma.$connect();
    await prisma.marketDataV6.deleteMany({
      where: { symbol: { in: SYMBOLS } },
    });
  });

  afterAll(async () => {
    try {
      await prisma.marketDataV6.deleteMany({
        where: { symbol: { in: SYMBOLS } },
      });
    } finally {
      await prisma?.$disconnect();
    }
  });

  test('the table is the one the Prisma schema describes: the unique key and the types the reader relies on', async () => {
    const { Client } = require('pg') as typeof import('pg');
    const db = new Client({ connectionString: URL });
    await db.connect();
    try {
      const columns = await db.query<{
        column_name: string;
        data_type: string;
      }>(
        `SELECT column_name, data_type FROM information_schema.columns
          WHERE table_name = 'market_data_v6'
            AND column_name IN ('timestamp','open','high','low','close','symbol','timeframe')
          ORDER BY column_name`
      );
      expect(
        Object.fromEntries(
          columns.rows.map((r) => [r.column_name, r.data_type])
        )
      ).toEqual({
        close: 'double precision',
        high: 'double precision',
        low: 'double precision',
        open: 'double precision',
        symbol: 'text',
        timeframe: 'text',
        timestamp: 'integer',
      });
      const unique = await db.query<{ indexdef: string }>(
        `SELECT indexdef FROM pg_indexes
          WHERE tablename = 'market_data_v6' AND indexdef LIKE 'CREATE UNIQUE%'`
      );
      expect(
        unique.rows.map((r) => r.indexdef.replace(/^.*\((.*)\)$/, '$1'))
      ).toContain('symbol, timeframe, "timestamp"');
    } finally {
      await db.end();
    }
  });

  test('reads 288 M5 and 96 M15 closed bars, the same ones the fake reads from the same world', async () => {
    const world = worldFor(SLOT, { symbol: 'ZZTEST' });
    await load(world);
    const real = await readDayBars({ slot: SLOT, symbol: 'ZZTEST' }, prisma);
    const fake = await readDayBars(
      { slot: SLOT, symbol: 'ZZTEST' },
      fakeClient(world)
    );
    if (!real.ok) throw new Error(real.detail);
    expect(real.bars.m5).toHaveLength(288);
    expect(real.bars.m15).toHaveLength(96);
    expect(JSON.stringify(real)).toBe(JSON.stringify(fake));
    // the double precision round trip is exact for the two-decimal prices of the world
    const stored = world.find(
      (b) => b.timeframe === 'M5' && b.timestamp === real.bars.m5[10]?.openTime
    ) as StoredBar;
    expect(real.bars.m5[10]).toEqual({
      openTime: stored.timestamp,
      open: stored.open,
      high: stored.high,
      low: stored.low,
      close: stored.close,
    });
  });

  test('ends at the last closed bar of each timeframe and begins 24 hours before its close', async () => {
    await load(worldFor(SLOT, { symbol: 'ZZTEST' }));
    const real = await readDayBars({ slot: SLOT, symbol: 'ZZTEST' }, prisma);
    if (!real.ok) throw new Error(real.detail);
    const { m5, m15 } = real.bars;
    expect(m5[m5.length - 1]?.openTime).toBe(SLOT_S - M5_SECONDS);
    expect(m5[0]?.openTime).toBe(SLOT_S - M5_SECONDS - 287 * M5_SECONDS);
    expect(m15[m15.length - 1]?.openTime).toBe(at('2026-09-18T20:30:00Z'));
    expect(m15[0]?.openTime).toBe(
      at('2026-09-18T20:30:00Z') - 95 * M15_SECONDS
    );
  });

  describe('closed bars only (the table holds the forming bar and later ones)', () => {
    test('the bar that opened at the slot, and every bar after it, is in the table and is not read', async () => {
      const world = worldFor(SLOT, { symbol: 'ZZTEST' });
      await load(world);
      const inTable = await prisma.marketDataV6.count({
        where: {
          symbol: 'ZZTEST',
          timeframe: 'M5',
          timestamp: { gte: SLOT_S },
        },
      });
      expect(inTable).toBe(7); // the slot's own bar and six after it
      const m15Forming = await prisma.marketDataV6.count({
        where: {
          symbol: 'ZZTEST',
          timeframe: 'M15',
          timestamp: at('2026-09-18T20:45:00Z'),
        },
      });
      expect(m15Forming).toBe(1);
      const real = await readDayBars({ slot: SLOT, symbol: 'ZZTEST' }, prisma);
      if (!real.ok) throw new Error(real.detail);
      for (const bar of real.bars.m5)
        expect(bar.openTime + M5_SECONDS).toBeLessThanOrEqual(SLOT_S);
      for (const bar of real.bars.m15)
        expect(bar.openTime + M15_SECONDS).toBeLessThanOrEqual(SLOT_S);
    });

    test('a bar closes at exactly its open time plus its period: the 20:45 M15 bar is read at 21:00 and not at 20:55', async () => {
      await load(worldFor('2026-09-18T21:00Z', { symbol: 'ZZTEST' }));
      const early = await readDayBars(
        { slot: '2026-09-18T20:55Z', symbol: 'ZZTEST' },
        prisma
      );
      const onTime = await readDayBars(
        { slot: '2026-09-18T21:00Z', symbol: 'ZZTEST' },
        prisma
      );
      if (!early.ok || !onTime.ok) throw new Error('read failed');
      expect(early.bars.m15.slice(-1)[0]?.openTime).toBe(
        at('2026-09-18T20:30:00Z')
      );
      expect(onTime.bars.m15.slice(-1)[0]?.openTime).toBe(
        at('2026-09-18T20:45:00Z')
      );
      expect(early.bars.m5.slice(-1)[0]?.openTime).toBe(
        at('2026-09-18T20:50:00Z')
      );
      expect(onTime.bars.m5.slice(-1)[0]?.openTime).toBe(
        at('2026-09-18T20:55:00Z')
      );
    });
  });

  describe('point in time', () => {
    test('the answer for a cycle is the same whether the table holds later bars or not', async () => {
      const world = worldFor(SLOT, { symbol: 'ZZTEST' });
      await load(world);
      const withLater = await readDayBars(
        { slot: SLOT, symbol: 'ZZTEST' },
        prisma
      );
      await prisma.marketDataV6.deleteMany({
        where: { symbol: 'ZZTEST', timestamp: { gte: SLOT_S } },
      });
      const without = await readDayBars(
        { slot: SLOT, symbol: 'ZZTEST' },
        prisma
      );
      expect(JSON.stringify(without)).toBe(JSON.stringify(withLater));
      // and adding a later bar afterwards changes nothing either
      await prisma.marketDataV6.create({
        data: row({
          timeframe: 'M5',
          symbol: 'ZZTEST',
          timestamp: SLOT_S + 600,
          open: 1,
          high: 2,
          low: 0.5,
          close: 1.5,
        }),
      });
      expect(
        JSON.stringify(
          await readDayBars({ slot: SLOT, symbol: 'ZZTEST' }, prisma)
        )
      ).toBe(JSON.stringify(withLater));
    });

    test('an earlier cycle reads as it was then, with the later bars in the table', async () => {
      const world = worldFor(SLOT, { symbol: 'ZZTEST' });
      await load(world);
      const earlier = await readDayBars(
        { slot: '2026-09-18T12:00Z', symbol: 'ZZTEST' },
        prisma
      );
      if (!earlier.ok) throw new Error(earlier.detail);
      expect(earlier.bars.slotSeconds).toBe(at('2026-09-18T12:00:00Z'));
      expect(earlier.bars.m5[earlier.bars.m5.length - 1]?.openTime).toBe(
        at('2026-09-18T11:55:00Z')
      );
      expect(earlier.bars.m15[earlier.bars.m15.length - 1]?.openTime).toBe(
        at('2026-09-18T11:45:00Z')
      );
      const fake = await readDayBars(
        { slot: '2026-09-18T12:00Z', symbol: 'ZZTEST' },
        fakeClient(world)
      );
      expect(JSON.stringify(earlier)).toBe(JSON.stringify(fake));
    });
  });

  describe('gaps', () => {
    test('a market break inside the day gives fewer rows, never padding', async () => {
      const start = at('2026-09-17T21:00:00Z');
      const world = worldFor(SLOT, {
        symbol: 'ZZTEST',
        skip: [[start, start + 3600]],
      });
      await load(world);
      const real = await readDayBars({ slot: SLOT, symbol: 'ZZTEST' }, prisma);
      if (!real.ok) throw new Error(real.detail);
      expect(real.bars.m5).toHaveLength(276);
      expect(real.bars.m15).toHaveLength(92);
      expect(real.bars.m5[0]?.openTime).toBe(
        SLOT_S - M5_SECONDS - 287 * M5_SECONDS
      );
      expect(JSON.stringify(real)).toBe(
        JSON.stringify(
          await readDayBars({ slot: SLOT, symbol: 'ZZTEST' }, fakeClient(world))
        )
      );
    });

    test('on a weekend the last day that traded is read', async () => {
      const friday = at('2026-09-18T21:00:00Z');
      const sunday = at('2026-09-20T22:00:00Z');
      const world = worldFor('2026-09-19T10:00Z', {
        symbol: 'ZZTEST',
        skip: [[friday, sunday]],
      });
      await load(world);
      const real = await readDayBars(
        { slot: '2026-09-19T10:00Z', symbol: 'ZZTEST' },
        prisma
      );
      if (!real.ok) throw new Error(real.detail);
      expect(real.bars.m5).toHaveLength(288);
      expect(real.bars.m5[real.bars.m5.length - 1]?.openTime).toBe(
        at('2026-09-18T20:55:00Z')
      );
      expect(real.bars.m15[real.bars.m15.length - 1]?.openTime).toBe(
        at('2026-09-18T20:45:00Z')
      );
    });

    test('an empty table is an empty day, not an error', async () => {
      await prisma.marketDataV6.deleteMany({
        where: { symbol: { in: SYMBOLS } },
      });
      const real = await readDayBars({ slot: SLOT, symbol: 'ZZTEST' }, prisma);
      expect(real).toMatchObject({ ok: true, bars: { m5: [], m15: [] } });
    });
  });

  describe('the symbol', () => {
    test('reads only the symbol asked for, and XAUUSD when none is named', async () => {
      const gold = worldFor(SLOT, { symbol: 'XAUUSD', start: 4300 });
      const other = worldFor(SLOT, { symbol: 'ZZTEST', start: 1.5 });
      await load([...gold, ...other]);
      const defaultRead = await readDayBars({ slot: SLOT }, prisma);
      const test = await readDayBars({ slot: SLOT, symbol: 'ZZTEST' }, prisma);
      if (!defaultRead.ok || !test.ok) throw new Error('read failed');
      expect(defaultRead.bars.symbol).toBe('XAUUSD');
      expect(defaultRead.bars.m5[0]?.open).toBeGreaterThan(1000);
      expect(test.bars.m5[0]?.open).toBeLessThan(100);
    });
  });

  describe('the table cannot hold a bar twice', () => {
    test('a second row for one symbol, timeframe and time is refused by the unique key', async () => {
      await load(worldFor(SLOT, { symbol: 'ZZTEST' }));
      await expect(
        prisma.marketDataV6.create({
          data: row({
            timeframe: 'M5',
            symbol: 'ZZTEST',
            timestamp: SLOT_S - M5_SECONDS,
            open: 1,
            high: 2,
            low: 0.5,
            close: 1.5,
          }),
        })
      ).rejects.toThrow();
    });
  });

  describe('when the database cannot be reached', () => {
    test('is a DATABASE_ERROR result and not an exception', async () => {
      const { PrismaClient } = require('.prisma/market-client');
      const { PrismaPg } = require('@prisma/adapter-pg');
      const unreachable = new PrismaClient({
        adapter: new PrismaPg({
          connectionString: 'postgres://postgres@127.0.0.1:1/none',
        }),
      });
      try {
        const result = await readDayBars(
          { slot: SLOT, symbol: 'ZZTEST' },
          unreachable
        );
        expect(result).toMatchObject({ ok: false, code: 'DATABASE_ERROR' });
        expect((result as { detail: string }).detail).toMatch(
          /^the day's bars could not be read: /
        );
      } finally {
        await unreachable.$disconnect();
      }
    });
  });
});
