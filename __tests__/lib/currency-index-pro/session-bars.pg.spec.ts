/**
 * @jest-environment node
 */

/**
 * getTodaysSessionBarsForIndices() against a REAL PostgreSQL (ad-hoc order
 * docs/migration-orders/adhoc-pro-session-bars-latest-per-index.migration-order.md, B2).
 *
 * The helper used to read the newest bar of each requested index with Prisma's `distinct`, which the installed
 * client turns into "every historical row of those indices, then de-duplicate in the application". It now runs
 * ONE raw statement (the requested names, made distinct, each with a `LATERAL ... LIMIT 1` seek). What the unit
 * tests with mocks cannot show, and this spec does: the statement is accepted by the database and the real
 * client, the requested names are bound as a text[] parameter the driver adapter accepts, the types are the ones
 * the mapping expects, and the result is EXACTLY what the old read gave, entry for entry and in the same order.
 * The OLD function is kept below, verbatim in its logic, as the reference; both run over the same rows.
 *
 * Cases: all eight FX names; a subset; one name; names with no rows; a repeated name; unequal session opens; a
 * stale newest bar; an index that is in the table but NOT requested (must stay out); an unlisted name that IS
 * requested; a request in a different order from the table's (the Map must still be ordered by name, the chart
 * route reads its first entry); rows inserted newest first; a larger table; an empty request (no statement at
 * all); nothing found (one statement). Plus the statement count: one for the lookup and one for the bars.
 *
 * SKIPPED unless BOTH are set:
 *   CYCLE_PG_URL         a postgres URL on localhost or 127.0.0.1 (anything else is refused)
 *   CYCLE_PG_ALLOW_WIPE  "yes": it DELETES every row of `currency_gold_indices` in that database
 *
 * To run it on a throwaway database (see .claude/architecture/database-traps.md and environment-gotchas.md):
 *   1. start a scratch PostgreSQL (initdb on a high port, `Start-Process -WindowStyle Hidden postgres.exe`)
 *      and create an empty database;
 *   2. create the table from Prisma's own DDL (docs/handoffs/2026-10-20-b1-explain/cgi-ddl.sql is the
 *      `currency_gold_indices` table and its indexes as `prisma migrate diff` writes them);
 *   3. CYCLE_PG_URL=postgres://postgres@127.0.0.1:55471/<db> CYCLE_PG_ALLOW_WIPE=yes \
 *        npx jest --testMatch '**\/__tests__/lib/currency-index-pro/session-bars.pg.spec.ts' --coverage=false
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
// the module also imports the non-market client for the preference read; this spec never calls that
jest.mock('@/lib/db/prisma', () => ({ prisma: {} }));

import { marketPrisma } from '@/lib/db/market-prisma';
import {
  getTodaysSessionBarsForIndices,
  type IndexSessionBars,
} from '@/lib/currency-index-pro/queries';

const FX8 = [
  'USDX',
  'EURX',
  'GBPX',
  'JPYX',
  'AUDX',
  'CADX',
  'CHFX',
  'NZDX',
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
  sessionOpen: number
): Bar[] {
  return Array.from({ length: count }, (_, i) => {
    const change =
      ((i * 7 + name.length * 13 + name.charCodeAt(0)) % 97) * 0.01 - 0.5;
    return {
      index_name: name,
      bar_time: from + i * M5,
      value: 100 + change,
      change_pct: change,
      session_open_bar_time: sessionOpen,
    };
  });
}

/**
 * `days` days of 288 M5 bars from T0; each bar carries ITS day's session open (the start of its day, `offset` seconds later
 * for an index with a later daily inception, like XAUX), so older bars carry older session opens, as in real data.
 */
function dailySessions(name: string, days: number, offset = 0): Bar[] {
  return Array.from({ length: days * 288 }, (_, i) => {
    const change =
      ((i * 7 + name.length * 13 + name.charCodeAt(0)) % 97) * 0.01 - 0.5;
    return {
      index_name: name,
      bar_time: T0 + i * M5,
      value: 100 + change,
      change_pct: change,
      session_open_bar_time: T0 + Math.floor(i / 288) * DAY + offset,
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
 * The reference: getTodaysSessionBarsForIndices() as it was before this order (commit bfef7e74), with Prisma's
 * `distinct` for the lookup. Same second statement, same Map construction.
 */
async function referenceSessionBars(
  indexNames: readonly string[]
): Promise<Map<string, IndexSessionBars>> {
  const latest = await db().currencyGoldIndex.findMany({
    where: { index_name: { in: [...indexNames] } },
    orderBy: [{ index_name: 'asc' }, { bar_time: 'desc' }],
    distinct: ['index_name'],
    select: { index_name: true, session_open_bar_time: true },
  });
  if (latest.length === 0) return new Map();

  const rows = await db().currencyGoldIndex.findMany({
    where: {
      OR: latest.map((l: Bar) => ({
        index_name: l.index_name,
        bar_time: { gte: l.session_open_bar_time },
      })),
    },
    orderBy: [{ index_name: 'asc' }, { bar_time: 'asc' }],
    select: { index_name: true, bar_time: true, value: true, change_pct: true },
  });

  const byIndex = new Map<string, IndexSessionBars>();
  for (const l of latest as Bar[]) {
    byIndex.set(l.index_name, {
      sessionOpenBarTime: l.session_open_bar_time,
      bars: [],
    });
  }
  for (const row of rows as Bar[]) {
    byIndex.get(row.index_name)?.bars.push({
      barTime: row.bar_time,
      value: row.value,
      changePct: row.change_pct,
    });
  }
  return byIndex;
}

/** Both the new function and the reference for one request; the Maps must be identical, entry by entry and in order. */
async function expectSameAsReference(
  indexNames: readonly string[]
): Promise<Map<string, IndexSessionBars>> {
  const expected = await referenceSessionBars(indexNames);
  const actual = await getTodaysSessionBarsForIndices(indexNames);
  expect([...actual.entries()]).toEqual([...expected.entries()]);
  return actual;
}

suite('getTodaysSessionBarsForIndices on a real PostgreSQL', () => {
  jest.setTimeout(120_000);

  beforeAll(async () => {
    await db().$connect();
    await db().currencyGoldIndex.deleteMany({});
  });

  afterAll(async () => {
    await db().currencyGoldIndex.deleteMany({});
    await db().$disconnect();
  });

  it('gives what the old read gave for the eight FX names with many bars each', async () => {
    await load(FX8.flatMap((name) => series(name, T0, 600, T0 + 100 * M5)));

    const map = await expectSameAsReference(FX8);

    expect([...map.keys()]).toEqual([...FX8].sort());
    const first = [...map.values()][0];
    expect(first?.sessionOpenBarTime).toBe(T0 + 100 * M5);
    // from that index's own session open (bar 100) through the newest bar (599)
    expect(first?.bars).toHaveLength(500);
  });

  it('gives what the old read gave for a subset and for a single name', async () => {
    await load(FX8.flatMap((name) => series(name, T0, 80, T0)));

    const subset = await expectSameAsReference(['GBPX', 'AUDX', 'USDX']);
    expect([...subset.keys()]).toEqual(['AUDX', 'GBPX', 'USDX']);

    const one = await expectSameAsReference(['EURX']);
    expect([...one.keys()]).toEqual(['EURX']);
  });

  it('leaves out an index that is in the table but was not requested, and requested names with no rows', async () => {
    await load([
      ...series('EURX', T0, 40, T0),
      ...series('XAUX', T0, 40, T0 + 60),
      ...series('ZZ9X', T0, 5, T0),
    ]);

    const map = await expectSameAsReference(['EURX', 'NOPE', 'JPYX']);

    expect([...map.keys()]).toEqual(['EURX']);
  });

  it('returns an unlisted name when it IS requested', async () => {
    await load([
      ...series('EURX', T0, 20, T0),
      {
        index_name: 'ZZ1X',
        bar_time: T0 + 10 * M5,
        value: 99.5,
        change_pct: -0.5,
        session_open_bar_time: T0,
      },
    ]);

    const map = await expectSameAsReference(['ZZ1X', 'EURX']);
    expect([...map.keys()]).toEqual(['EURX', 'ZZ1X']);
    expect(map.get('ZZ1X')).toEqual({
      sessionOpenBarTime: T0,
      bars: [{ barTime: T0 + 10 * M5, value: 99.5, changePct: -0.5 }],
    });
  });

  it('gives one entry for a name requested twice', async () => {
    await load(series('EURX', T0, 30, T0));

    const map = await expectSameAsReference(['EURX', 'EURX', 'EURX']);
    expect([...map.keys()]).toEqual(['EURX']);
    expect(map.get('EURX')?.bars).toHaveLength(30);
  });

  it('orders the Map by index name whatever the order of the request (the chart route reads the first entry)', async () => {
    await load(
      ['NZDX', 'AUDX', 'EURX'].flatMap((name) => series(name, T0, 20, T0))
    );

    const map = await expectSameAsReference(['NZDX', 'EURX', 'AUDX']);
    expect([...map.keys()]).toEqual(['AUDX', 'EURX', 'NZDX']);
    expect([...map.values()][0]?.sessionOpenBarTime).toBe(T0);
  });

  it("bounds each index's bars by ITS OWN session open when the opens differ", async () => {
    await load([
      ...series('EURX', T0, 100, T0),
      ...series('JPYX', T0, 100, T0 + 60 * M5),
      ...series('GBPX', T0, 100, T0 + 99 * M5),
    ]);

    const map = await expectSameAsReference(['EURX', 'JPYX', 'GBPX']);

    expect(map.get('EURX')?.bars).toHaveLength(100);
    expect(map.get('JPYX')?.bars).toHaveLength(40);
    expect(map.get('GBPX')?.bars).toHaveLength(1);
  });

  it('keeps an index whose newest bar is old (a stale group) with that old bar and its own old session', async () => {
    await load([
      ...series('CHFX', T0, 100, T0),
      ...series('USDX', T0 + 40 * DAY, 100, T0 + 40 * DAY),
    ]);

    const map = await expectSameAsReference(['CHFX', 'USDX']);

    expect(map.get('CHFX')?.sessionOpenBarTime).toBe(T0);
    expect(map.get('CHFX')?.bars).toHaveLength(100);
    expect(map.get('USDX')?.sessionOpenBarTime).toBe(T0 + 40 * DAY);
  });

  it('takes the NEWEST bar by bar_time even when the rows were inserted newest first', async () => {
    const bars = [
      ...series('GBPX', T0, 40, T0),
      ...series('JPYX', T0, 40, T0),
    ].reverse();
    await load(bars);

    const map = await expectSameAsReference(['GBPX', 'JPYX']);
    expect(map.get('GBPX')?.bars.at(-1)?.barTime).toBe(T0 + 39 * M5);
  });

  it('takes the session open of the NEWEST bar when an index spans several sessions (the session rolls over each day)', async () => {
    // Real data: every day has its own session open. The bars of one index therefore carry DIFFERENT
    // session_open_bar_time values, and only the newest bar's is today's. (A fixture where all bars share one
    // session open cannot tell the newest bar from the oldest in this helper's two-column lookup.)
    await load(FX8.flatMap((name) => dailySessions(name, 3)));

    const map = await expectSameAsReference(FX8);

    expect(map.size).toBe(8);
    for (const entry of map.values()) {
      expect(entry.sessionOpenBarTime).toBe(T0 + 2 * DAY);
      // only the last day's 288 bars, not the three days
      expect(entry.bars).toHaveLength(288);
      expect(entry.bars[0]?.barTime).toBe(T0 + 2 * DAY);
    }
  });

  it('keeps each index on its own latest session when they roll over at different moments', async () => {
    // XAUX opens its session 60 s after the currency indices; EURX has no bar yet today (its newest is yesterday's last).
    await load([
      ...dailySessions('EURX', 2).slice(0, 2 * 288 - 20),
      ...dailySessions('XAUX', 2, 60),
      ...dailySessions('USDX', 2),
    ]);

    const map = await expectSameAsReference(['EURX', 'XAUX', 'USDX']);

    expect(map.get('USDX')?.sessionOpenBarTime).toBe(T0 + DAY);
    expect(map.get('XAUX')?.sessionOpenBarTime).toBe(T0 + DAY + 60);
    // EURX stopped 20 bars before the end of day 2: still day 2's session
    expect(map.get('EURX')?.sessionOpenBarTime).toBe(T0 + DAY);
    expect(map.get('EURX')?.bars).toHaveLength(288 - 20);
  });

  it('gives what the old read gave on a larger table (three days of M5 bars for nine indices)', async () => {
    const names = [...FX8, 'XAUX'];
    await load(
      names.flatMap((name) => dailySessions(name, 3, name === 'XAUX' ? 60 : 0))
    );

    const map = await expectSameAsReference(FX8);
    expect(map.size).toBe(8);
    // each index's session opened at the start of day 3, so its bars are that day's 288
    for (const entry of map.values()) expect(entry.bars).toHaveLength(288);
  });

  it('runs no statement at all for an empty request, and ONE when nothing is found', async () => {
    const statements: string[] = [];
    db().$on('query', (e: { query: string }) => {
      statements.push(e.query);
    });
    await load(series('EURX', T0, 10, T0));

    statements.length = 0;
    expect(await getTodaysSessionBarsForIndices([])).toEqual(new Map());
    expect(statements).toHaveLength(0);

    statements.length = 0;
    expect(await getTodaysSessionBarsForIndices(['NOPE'])).toEqual(new Map());
    expect(statements).toHaveLength(1);
    expect(statements[0]).toContain('LATERAL');
  });

  it('runs ONE statement for the lookup and ONE for the bars', async () => {
    const statements: string[] = [];
    db().$on('query', (e: { query: string }) => {
      statements.push(e.query);
    });
    await load(series('EURX', T0, 20, T0));

    statements.length = 0;
    const map = await getTodaysSessionBarsForIndices(['EURX', 'JPYX']);

    expect(map.size).toBe(1);
    expect(statements).toHaveLength(2);
    expect(statements[0]).toContain('LATERAL');
    expect(statements[1]).toContain('"currency_gold_indices"');
  });
});
