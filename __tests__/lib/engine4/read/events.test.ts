/**
 * @jest-environment node
 */

/**
 * The reader of the news calendar and of the Tier-1 config (build step 5,
 * part 3). The ids are TEST IDS (9000000xx), not MT5 event ids.
 */

import { checkBlackout, parseTier1List } from '@/lib/engine4';
import type { Tier1List } from '@/lib/engine4';
import { loadTier1List, readCalendar } from '@/lib/engine4/read/events';
import type { CalendarClient, CalendarRow } from '@/lib/engine4/read/events';

// The reader imports the database client at load time; no test here touches it.
jest.mock('@/lib/db/market-prisma', () => ({ marketPrisma: {} }));

const NOW = 1_790_000_000;
const MIN = 60;
const HOUR = 3600;

const LIST: Tier1List = {
  schemaVersion: 1,
  listVersion: 2,
  events: [
    { eventId: '900000001', kind: 'CPI', name: 'TEST CPI' },
    { eventId: '900000002', kind: 'CORE_PCE', name: 'TEST PCE' },
    { eventId: '900000003', kind: 'FOMC_RATE_DECISION', name: 'TEST FOMC' },
    { eventId: '900000004', kind: 'NFP', name: 'TEST NFP' },
  ],
};

const row = (over: Partial<CalendarRow> = {}): CalendarRow => ({
  value_id: 'v1',
  event_id: '900000001',
  event_name: 'TEST CPI',
  event_time: NOW + 10 * MIN,
  currency: 'USD',
  importance: 'HIGH',
  time_mode: 0,
  captured_at: NOW - HOUR,
  ...over,
});

interface Calls {
  releases: unknown[];
  observations: unknown[];
  newest: unknown[];
}

function client(
  data: {
    releases?: { value_id: string }[];
    rows?: CalendarRow[];
    newest?: { captured_at: number } | null;
  },
  fail?: 'releases' | 'observations' | 'newest'
) {
  const calls: Calls = { releases: [], observations: [], newest: [] };
  const fake: CalendarClient = {
    releases: {
      findMany: async (args) => {
        calls.releases.push(args);
        if (fail === 'releases') throw new Error('releases down');
        return data.releases ?? [];
      },
    },
    observations: {
      findMany: async (args) => {
        calls.observations.push(args);
        if (fail === 'observations') throw new Error('observations down');
        return data.rows ?? [];
      },
    },
    newest: {
      findFirst: async (args) => {
        calls.newest.push(args);
        if (fail === 'newest') throw new Error('newest down');
        return data.newest === undefined
          ? { captured_at: NOW - HOUR }
          : data.newest;
      },
    },
  };
  return { fake, calls };
}

describe('loadTier1List', () => {
  test('the list the repository ships is valid and EMPTY (the real ids come from production)', () => {
    const loaded = loadTier1List();
    expect(loaded.problems).toEqual([]);
    expect(loaded.list).toEqual({
      schemaVersion: 1,
      listVersion: 1,
      events: [],
    });
  });

  test('so, as shipped, the blackout fails closed', () => {
    const { list } = loadTier1List();
    const result = checkBlackout({
      nowSeconds: NOW,
      traderType: 'DAY_TRADER',
      list,
      events: [],
      newestCapturedAt: NOW - HOUR,
    });
    expect(result.status).toBe('UNKNOWN');
    expect(result.unknownReasons).toEqual(['LIST_NOT_SET']);
  });

  test('reads a list it is given', () => {
    const loaded = loadTier1List({ ...LIST });
    expect(loaded).toEqual({ list: LIST, problems: [] });
  });

  test('a list that fails its checks is no list, and says why', () => {
    const loaded = loadTier1List({
      schemaVersion: 9,
      listVersion: 1,
      events: [],
    });
    expect(loaded.list).toBeNull();
    expect(loaded.problems.join('\n')).toMatch(/schemaVersion/);
  });

  test('agrees with the parser on everything', () => {
    for (const raw of [null, {}, LIST, { ...LIST, extra: 1 }]) {
      const parsed = parseTier1List(raw);
      expect(loadTier1List(raw).list).toEqual(parsed.ok ? parsed.list : null);
    }
  });
});

describe('readCalendar: the queries', () => {
  test('a Day Trader: from an hour back to twelve hours ahead, by Tier-1 id or HIGH USD', async () => {
    const { fake, calls } = client({ releases: [] });
    await readCalendar(
      { nowSeconds: NOW, traderType: 'DAY_TRADER', list: LIST },
      fake
    );
    expect(calls.releases).toEqual([
      {
        where: {
          event_time: { gte: NOW - HOUR, lte: NOW + 12 * HOUR },
          OR: [
            {
              event_id: {
                in: ['900000001', '900000002', '900000003', '900000004'],
              },
            },
            { importance: 'HIGH', currency: 'USD' },
          ],
        },
        select: { value_id: true },
        distinct: ['value_id'],
      },
    ]);
  });

  test('a Scalper: two hours ahead', async () => {
    const { fake, calls } = client({ releases: [] });
    await readCalendar(
      { nowSeconds: NOW, traderType: 'SCALPER', list: LIST },
      fake
    );
    const where = (calls.releases[0] as { where: { event_time: unknown } })
      .where;
    expect(where.event_time).toEqual({ gte: NOW - HOUR, lte: NOW + 2 * HOUR });
  });

  test('with no usable list it asks for no id at all', async () => {
    const { fake, calls } = client({ releases: [] });
    await readCalendar(
      { nowSeconds: NOW, traderType: 'DAY_TRADER', list: null },
      fake
    );
    const where = (calls.releases[0] as { where: { OR: unknown[] } }).where;
    expect(where.OR[0]).toEqual({ event_id: { in: [] } });
  });

  test('then every observation of the releases found, release by release, newest first', async () => {
    const { fake, calls } = client({
      releases: [{ value_id: 'a' }, { value_id: 'b' }],
      rows: [],
    });
    await readCalendar(
      { nowSeconds: NOW, traderType: 'DAY_TRADER', list: LIST },
      fake
    );
    expect(calls.observations).toEqual([
      {
        where: { value_id: { in: ['a', 'b'] } },
        orderBy: [{ value_id: 'asc' }, { captured_at: 'desc' }],
        select: {
          value_id: true,
          event_id: true,
          event_name: true,
          event_time: true,
          currency: true,
          importance: true,
          time_mode: true,
          captured_at: true,
        },
      },
    ]);
  });

  test('and the newest observation of the whole table', async () => {
    const { fake, calls } = client({ releases: [] });
    await readCalendar(
      { nowSeconds: NOW, traderType: 'DAY_TRADER', list: LIST },
      fake
    );
    expect(calls.newest).toEqual([
      { orderBy: { captured_at: 'desc' }, select: { captured_at: true } },
    ]);
  });

  test('no release found: the second query is not made', async () => {
    const { fake, calls } = client({ releases: [] });
    const result = await readCalendar(
      { nowSeconds: NOW, traderType: 'DAY_TRADER', list: LIST },
      fake
    );
    expect(calls.observations).toEqual([]);
    expect(result.events).toEqual([]);
  });
});

describe('readCalendar: the answer', () => {
  test('maps the rows to calendar events and returns the newest observation', async () => {
    const { fake } = client({
      releases: [{ value_id: 'v1' }],
      rows: [row()],
      newest: { captured_at: NOW - 5 * MIN },
    });
    const result = await readCalendar(
      { nowSeconds: NOW, traderType: 'DAY_TRADER', list: LIST },
      fake
    );
    expect(result).toEqual({
      events: [
        {
          valueId: 'v1',
          eventId: '900000001',
          eventName: 'TEST CPI',
          eventTime: NOW + 10 * MIN,
          currency: 'USD',
          importance: 'HIGH',
          timeMode: 0,
          capturedAt: NOW - HOUR,
        },
      ],
      newestCapturedAt: NOW - 5 * MIN,
      problems: [],
    });
  });

  test.each([0, 1, 2, 3, null])(
    'carries the time mode %p of the row as it is',
    async (timeMode) => {
      const { fake } = client({
        releases: [{ value_id: 'v1' }],
        rows: [row({ time_mode: timeMode })],
      });
      const result = await readCalendar(
        { nowSeconds: NOW, traderType: 'DAY_TRADER', list: LIST },
        fake
      );
      expect(result.events?.[0]?.timeMode).toBe(timeMode);
    }
  );

  test('an empty table is an empty calendar, and the blackout then fails closed', async () => {
    const { fake } = client({ releases: [], newest: null });
    const result = await readCalendar(
      { nowSeconds: NOW, traderType: 'DAY_TRADER', list: LIST },
      fake
    );
    expect(result).toEqual({
      events: [],
      newestCapturedAt: null,
      problems: [],
    });
    const blackout = checkBlackout({
      nowSeconds: NOW,
      traderType: 'DAY_TRADER',
      list: LIST,
      events: result.events,
      newestCapturedAt: result.newestCapturedAt,
    });
    expect(blackout.unknownReasons).toEqual(['CALENDAR_EMPTY']);
  });

  test.each(['releases', 'observations', 'newest'] as const)(
    'a database error at the %s query is reported, not thrown, and the blackout fails closed',
    async (step) => {
      const { fake } = client(
        { releases: [{ value_id: 'v1' }], rows: [row()] },
        step
      );
      const result = await readCalendar(
        { nowSeconds: NOW, traderType: 'DAY_TRADER', list: LIST },
        fake
      );
      expect(result.events).toBeNull();
      expect(result.newestCapturedAt).toBeNull();
      expect(result.problems).toEqual([
        `the news calendar could not be read: ${step} down`,
      ]);
      const blackout = checkBlackout({
        nowSeconds: NOW,
        traderType: 'DAY_TRADER',
        list: LIST,
        events: result.events,
        newestCapturedAt: result.newestCapturedAt,
      });
      expect(blackout.status).toBe('UNKNOWN');
      expect(blackout.unknownReasons).toEqual(['CALENDAR_UNAVAILABLE']);
    }
  );

  test('a rejection that is not an Error is still reported', async () => {
    const { fake } = client({});
    fake.releases.findMany = () => Promise.reject('down');
    const result = await readCalendar(
      { nowSeconds: NOW, traderType: 'DAY_TRADER', list: LIST },
      fake
    );
    expect(result.problems).toEqual([
      'the news calendar could not be read: unknown error',
    ]);
  });
});

describe('readCalendar with the blackout: a release that was moved', () => {
  // The reader asks for the releases that have ANY observation in the window, then for ALL of
  // their observations, so the blackout can keep the newest of each.
  const request = {
    nowSeconds: NOW,
    traderType: 'DAY_TRADER' as const,
    list: LIST,
  };

  async function blackoutFor(rows: CalendarRow[]) {
    const { fake } = client({
      releases: [...new Set(rows.map((r) => r.value_id))].map((value_id) => ({
        value_id,
      })),
      rows,
      newest: { captured_at: Math.max(...rows.map((r) => r.captured_at)) },
    });
    const read = await readCalendar(request, fake);
    return checkBlackout({
      nowSeconds: NOW,
      traderType: 'DAY_TRADER',
      list: LIST,
      events: read.events,
      newestCapturedAt: read.newestCapturedAt,
    });
  }

  test('moved out of the window: the old observation inside it does not block', async () => {
    const result = await blackoutFor([
      row({ event_time: NOW + 5 * HOUR, captured_at: NOW - 5 * MIN }),
      row({ event_time: NOW + 5 * MIN, captured_at: NOW - 2 * HOUR }),
    ]);
    expect(result.status).toBe('CLEAR');
  });

  test('moved into the window: blocks', async () => {
    const result = await blackoutFor([
      row({ event_time: NOW + 5 * MIN, captured_at: NOW - 5 * MIN }),
      row({ event_time: NOW + 5 * HOUR, captured_at: NOW - 2 * HOUR }),
    ]);
    expect(result.status).toBe('BLOCKED');
  });
});

describe('what is refused outright', () => {
  test('a trader type that is not one', async () => {
    const { fake, calls } = client({});
    await expect(
      readCalendar(
        { nowSeconds: NOW, traderType: 'TRADER' as never, list: LIST },
        fake
      )
    ).rejects.toThrow(/traderType/);
    expect(calls.releases).toEqual([]);
  });

  test.each([0, -1, 1.5, 'now', null])('a clock of %p', async (clock) => {
    const { fake, calls } = client({});
    await expect(
      readCalendar(
        { nowSeconds: clock as number, traderType: 'DAY_TRADER', list: LIST },
        fake
      )
    ).rejects.toThrow(/nowSeconds/);
    expect(calls.releases).toEqual([]);
  });

  test('a clock too late for a database integer (year 2038)', async () => {
    const { fake, calls } = client({});
    await expect(
      readCalendar(
        { nowSeconds: 2_147_483_000, traderType: 'DAY_TRADER', list: LIST },
        fake
      )
    ).rejects.toThrow(/window end/);
    expect(calls.releases).toEqual([]);
  });

  test('a clock too early for the window to start after zero', async () => {
    const { fake } = client({});
    await expect(
      readCalendar(
        { nowSeconds: 3600, traderType: 'DAY_TRADER', list: LIST },
        fake
      )
    ).rejects.toThrow(/window start/);
  });
});
