/**
 * @jest-environment node
 */

/**
 * getCurrencyGoldIndexSnapshots() against a REAL PostgreSQL (ad-hoc order
 * docs/migration-orders/adhoc-currency-snapshot-latest-per-index.migration-order.md, B1).
 *
 * The helper used to read the newest bar of every index with Prisma's `distinct`, which the installed client
 * turns into "all rows, then de-duplicate in the application". It now runs ONE raw statement (a recursive
 * walk over the index names plus a `LATERAL ... LIMIT 1` per name). What the unit tests with mocks cannot
 * show, and this spec does: the statement is accepted by the database and the real client, returns the
 * types the mapping expects, and gives EXACTLY what the old read gave. The OLD function is kept below,
 * verbatim in its logic, as the reference, and both are run over the same rows and compared.
 *
 * Cases: many bars per index and all nine indices, unequal session opens (XAUX opens 60 s later); only some
 * indices present; a stale newest bar; an index with one bar; an index name that is NOT one of the nine;
 * equal values and negative changes; rows inserted newest first (the heap is not in time order); an empty
 * table; a larger table. Plus the statement count: one for the lookup and one for the sparkline.
 *
 * SKIPPED unless BOTH are set:
 *   CYCLE_PG_URL         a postgres URL on localhost or 127.0.0.1 (anything else is refused)
 *   CYCLE_PG_ALLOW_WIPE  "yes": it DELETES every row of `currency_gold_indices` in that database
 *
 * To run it on a throwaway database (see .claude/architecture/database-traps.md and environment-gotchas.md):
 *   1. start a scratch PostgreSQL (initdb on a high port, `Start-Process -WindowStyle Hidden postgres.exe`)
 *      and create an empty database;
 *   2. create the table from Prisma's own DDL (a scratch Prisma config OUTSIDE the repo with
 *      `{ schema, datasource: { url } }`, then `prisma migrate diff --config <it> --from-empty
 *      --to-schema prisma/market-data/schema.prisma --script`; the `currency_gold_indices` table and its two
 *      indexes are enough);
 *   3. CYCLE_PG_URL=postgres://postgres@127.0.0.1:55471/<db> CYCLE_PG_ALLOW_WIPE=yes \
 *        npx jest --testMatch '**\/__tests__/lib/currency-gold-indices/latest-per-index.pg.spec.ts' --coverage=false
 *      (the root Jest configuration only collects *.test.ts, so a plain `npx jest` never runs this file);
 *   4. stop and remove the instance.
 */

const URL = process.env['CYCLE_PG_URL'] ?? '';
const enabled = URL !== '' && process.env['CYCLE_PG_ALLOW_WIPE'] === 'yes';
if (
  enabled &&
  !/^postgres(ql)?:\/\/[^@]*@(localhost|127\.0\.0\.1):\d+\//.test(URL)
) {
  throw new Error('CYCLE_PG_URL must point at localhost or 127.0.0.1');
}
const suite = enabled ? describe : describe.skip;

// the real market client, pointed at the scratch database
jest.mock('@/lib/db/market-prisma', () => {
  if (
    process.env['CYCLE_PG_URL'] === undefined ||
    process.env['CYCLE_PG_ALLOW_WIPE'] !== 'yes'
  ) {
    return { __esModule: true, marketPrisma: {} };
  }
  const { PrismaClient } = require('.prisma/market-client');
  const { PrismaPg } = require('@prisma/adapter-pg');
  return {
    __esModule: true,
    marketPrisma: new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env['CYCLE_PG_URL'] }),
      log: [{ emit: 'event', level: 'query' }],
    }),
  };
});

import { marketPrisma } from '@/lib/db/market-prisma';
import {
  getCurrencyGoldIndexSnapshots,
  type CurrencyGoldIndexSnapshot,
} from '@/lib/currency-gold-indices/queries';

const ALL = [
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

const T0 = 1_700_000_000;
const M5 = 300;
const DAY = 86_400;

interface Bar {
  index_name: string;
  bar_time: number;
  value: number;
  change_pct: number;
  session_open_bar_time: number;
}

const db = (): any => marketPrisma;

/** `count` M5 bars of one index from `from` on, with the given session open. */
function series(
  name: string,
  from: number,
  count: number,
  sessionOpen: number,
  base = 100
): Bar[] {
  return Array.from({ length: count }, (_, i) => {
    const change = ((i * 7 + name.length * 13) % 97) * 0.01 - 0.5;
    return {
      index_name: name,
      bar_time: from + i * M5,
      value: base + change,
      change_pct: change,
      session_open_bar_time: sessionOpen,
    };
  });
}

async function load(bars: readonly Bar[]): Promise<void> {
  await db().currencyGoldIndex.deleteMany({});
  for (let i = 0; i < bars.length; i += 1000) {
    await db().currencyGoldIndex.createMany({
      data: bars.slice(i, i + 1000).map((b) => ({
        id: `${b.index_name}:${b.bar_time}`,
        terminal_id: 'PG-SPEC',
        ...b,
      })),
    });
  }
}

/**
 * The reference: getCurrencyGoldIndexSnapshots() as it was before this order (commit 6eca87f4), with
 * Prisma's `distinct` for the lookup. Same second statement, same mapping.
 */
async function referenceSnapshots(): Promise<CurrencyGoldIndexSnapshot[]> {
  const latest = await db().currencyGoldIndex.findMany({
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

  const sparklineRows = await db().currencyGoldIndex.findMany({
    where: {
      OR: latest.map((l: Bar) => ({
        index_name: l.index_name,
        bar_time: { gte: l.session_open_bar_time },
      })),
    },
    orderBy: [{ index_name: 'asc' }, { bar_time: 'asc' }],
    select: { index_name: true, value: true },
  });

  const sparklineByIndex = new Map<string, number[]>();
  for (const row of sparklineRows as Array<{
    index_name: string;
    value: number;
  }>) {
    const arr = sparklineByIndex.get(row.index_name) ?? [];
    arr.push(row.value);
    sparklineByIndex.set(row.index_name, arr);
  }

  return latest.map((l: Bar) => ({
    symbol: l.index_name,
    price: l.value,
    changePct: l.change_pct,
    previousClose: 100.0,
    sparkline: sparklineByIndex.get(l.index_name) ?? [l.value],
    barTime: l.bar_time,
  }));
}

/** Both the new function and the reference on the rows now in the table; they must be identical. */
async function expectSameAsReference(): Promise<CurrencyGoldIndexSnapshot[]> {
  const expected = await referenceSnapshots();
  const actual = await getCurrencyGoldIndexSnapshots();
  expect(actual).toEqual(expected);
  return actual;
}

suite('getCurrencyGoldIndexSnapshots on a real PostgreSQL', () => {
  jest.setTimeout(120_000);

  beforeAll(async () => {
    await db().$connect();
    await db().currencyGoldIndex.deleteMany({});
  });

  afterAll(async () => {
    await db().currencyGoldIndex.deleteMany({});
    await db().$disconnect();
  });

  it('gives what the old read gave for nine indices with many bars and unequal session opens', async () => {
    const bars = ALL.flatMap((name) =>
      series(name, T0, 600, T0 + (name === 'XAUX' ? 60 : 0))
    );
    await load(bars);

    const snapshots = await expectSameAsReference();

    expect(snapshots.map((s) => s.symbol)).toEqual([...ALL].sort());
    const xaux = snapshots.find((s) => s.symbol === 'XAUX');
    expect(xaux?.barTime).toBe(T0 + 599 * M5);
    expect(xaux?.previousClose).toBe(100);
    // the sparkline starts at that index's own session open (XAUX's is 60 s later, so its first bar is out)
    expect(xaux?.sparkline).toHaveLength(599);
    expect(snapshots.find((s) => s.symbol === 'USDX')?.sparkline).toHaveLength(
      600
    );
  });

  it('gives what the old read gave when only some of the indices have data', async () => {
    await load(
      ['EURX', 'XAUX', 'AUDX'].flatMap((name) => series(name, T0, 50, T0))
    );
    const snapshots = await expectSameAsReference();
    expect(snapshots.map((s) => s.symbol)).toEqual(['AUDX', 'EURX', 'XAUX']);
  });

  it('keeps an index whose newest bar is old (a stale group), with that old bar', async () => {
    const stale = series('CHFX', T0, 100, T0);
    const fresh = series('USDX', T0 + 40 * DAY, 100, T0 + 40 * DAY);
    await load([...stale, ...fresh]);

    const snapshots = await expectSameAsReference();

    const chfx = snapshots.find((s) => s.symbol === 'CHFX');
    expect(chfx?.barTime).toBe(T0 + 99 * M5);
    expect(snapshots.find((s) => s.symbol === 'USDX')?.barTime).toBe(
      T0 + 40 * DAY + 99 * M5
    );
  });

  it('returns an index with a single bar, and an index name that is not one of the nine', async () => {
    const lone: Bar = {
      index_name: 'ZZ1X',
      bar_time: T0 + 10 * M5,
      value: 99.5,
      change_pct: -0.5,
      session_open_bar_time: T0,
    };
    await load([...series('EURX', T0, 30, T0), lone]);

    const snapshots = await expectSameAsReference();

    expect(snapshots.map((s) => s.symbol)).toEqual(['EURX', 'ZZ1X']);
    const zz = snapshots.find((s) => s.symbol === 'ZZ1X');
    expect(zz).toEqual({
      symbol: 'ZZ1X',
      price: 99.5,
      changePct: -0.5,
      previousClose: 100,
      sparkline: [99.5],
      barTime: T0 + 10 * M5,
    });
  });

  it('takes the NEWEST bar by bar_time even when the rows were inserted newest first', async () => {
    const bars = [
      ...series('GBPX', T0, 40, T0),
      ...series('JPYX', T0, 40, T0),
    ].reverse();
    await load(bars);

    const snapshots = await expectSameAsReference();
    expect(snapshots.map((s) => s.barTime)).toEqual([
      T0 + 39 * M5,
      T0 + 39 * M5,
    ]);
  });

  it('handles equal values on different bars and a negative change', async () => {
    await load([
      {
        index_name: 'NZDX',
        bar_time: T0,
        value: 99.7,
        change_pct: -0.3,
        session_open_bar_time: T0,
      },
      {
        index_name: 'NZDX',
        bar_time: T0 + M5,
        value: 99.7,
        change_pct: -0.3,
        session_open_bar_time: T0,
      },
    ]);

    const snapshots = await expectSameAsReference();
    expect(snapshots).toEqual([
      {
        symbol: 'NZDX',
        price: 99.7,
        changePct: -0.3,
        previousClose: 100,
        sparkline: [99.7, 99.7],
        barTime: T0 + M5,
      },
    ]);
  });

  it('returns nothing for an empty table', async () => {
    await load([]);
    expect(await expectSameAsReference()).toEqual([]);
  });

  it('gives what the old read gave on a larger table (three days of M5 bars for nine indices)', async () => {
    const bars = ALL.flatMap((name) =>
      series(name, T0, 3 * 288, T0 + 2 * DAY, 100 + name.length / 10)
    );
    await load(bars);

    const snapshots = await expectSameAsReference();
    expect(snapshots).toHaveLength(9);
    // each index's session opens on day 3, so the sparkline holds that day's 288 bars
    for (const s of snapshots) expect(s.sparkline).toHaveLength(288);
  });

  it('runs ONE statement for the lookup and ONE for the sparkline (and one when the table is empty)', async () => {
    const statements: string[] = [];
    const onQuery = (e: { query: string }): void => {
      statements.push(e.query);
    };
    db().$on('query', onQuery);

    await load(series('EURX', T0, 20, T0));
    statements.length = 0;
    const filled = await getCurrencyGoldIndexSnapshots();
    const forFilled = [...statements];

    await load([]);
    statements.length = 0;
    const empty = await getCurrencyGoldIndexSnapshots();
    const forEmpty = [...statements];

    expect(filled).toHaveLength(1);
    expect(forFilled).toHaveLength(2);
    expect(forFilled[0]).toContain('WITH RECURSIVE');
    expect(forFilled[1]).toContain('"currency_gold_indices"');
    expect(empty).toEqual([]);
    expect(forEmpty).toHaveLength(1);
    expect(forEmpty[0]).toContain('WITH RECURSIVE');
  });
});
