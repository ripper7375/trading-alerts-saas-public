/**
 * @jest-environment node
 */

/**
 * The upcoming-events reader (`lib/intake/read/events.ts`, architecture 4.5 News row, 5.3,
 * decision D9 b). It follows `lib/engine4/read/events.ts` over the append-only
 * `economic_events` table: the NEWEST observation of each release is its state, a calendar
 * that cannot be read is SAID, and a clock is passed in.
 */

import tier1Config from '@/config/engine4/tier1-events.json';
import { CALENDAR_LATE_SECONDS as ENGINE4_LATE } from '@/lib/engine4/blackout';
import { EVENTS_MAX_ITEMS, validatePacket } from '@/lib/intake';
import {
  CALENDAR_LATE_SECONDS,
  NEXT_DAY_SECONDS,
  UPCOMING_HORIZON_SECONDS,
  readUpcomingEvents,
  tier1IdsOf,
  type CalendarRow,
  type IntakeCalendarClient,
  type NewestQuery,
  type ObservationsQuery,
  type ReleasesQuery,
} from '@/lib/intake/read/events';
import { timeIso } from '@/lib/intake/slots';

import { makeRng } from '../helpers/random';

import { runWorld } from '../helpers/assemble';
import { goldenWorlds } from '../helpers/world';

const NOW = Date.UTC(2026, 8, 18, 20, 55) / 1000;
const HOUR = 3600;

let counter = 0;
function row(over: Partial<CalendarRow> = {}): CalendarRow {
  counter += 1;
  return {
    value_id: `v${counter}`,
    event_id: `e${counter}`,
    event_name: `Release ${counter}`,
    event_time: NOW + HOUR,
    currency: 'USD',
    importance: 'HIGH',
    time_mode: 0,
    captured_at: NOW - 60,
    ...over,
  };
}

interface Calls {
  releases: ReleasesQuery[];
  observations: ObservationsQuery[];
  newest: NewestQuery[];
}

/** A client over a list of observations, answering the three queries the way the table would. */
function client(
  rows: CalendarRow[],
  options: { fail?: 'releases' | 'observations' | 'newest' } = {}
): { client: IntakeCalendarClient; calls: Calls } {
  const calls: Calls = { releases: [], observations: [], newest: [] };
  return {
    calls,
    client: {
      releases: {
        findMany: async (args) => {
          calls.releases.push(args);
          if (options.fail === 'releases')
            throw new Error('connection refused');
          const { gte, lte } = args.where.event_time;
          const ids = new Set(
            rows
              .filter((r) => r.event_time >= gte && r.event_time <= lte)
              .map((r) => r.value_id)
          );
          return [...ids].map((value_id) => ({ value_id }));
        },
      },
      observations: {
        findMany: async (args) => {
          calls.observations.push(args);
          if (options.fail === 'observations')
            throw new Error('connection refused');
          const wanted = new Set(args.where.value_id.in);
          return rows
            .filter((r) => wanted.has(r.value_id))
            .sort((a, b) =>
              a.value_id === b.value_id
                ? b.captured_at - a.captured_at
                : a.value_id < b.value_id
                  ? -1
                  : 1
            );
        },
      },
      newest: {
        findFirst: async (args) => {
          calls.newest.push(args);
          if (options.fail === 'newest') throw new Error('connection refused');
          if (rows.length === 0) return null;
          return { captured_at: Math.max(...rows.map((r) => r.captured_at)) };
        },
      },
    },
  };
}

const read = (
  rows: CalendarRow[],
  scope: 'UPCOMING_ALL' | 'NEXT_24H_HIGH' = 'NEXT_24H_HIGH',
  extra: { tier1Ids?: ReadonlySet<string>; nowSeconds?: number } = {}
) =>
  readUpcomingEvents({ nowSeconds: NOW, scope, ...extra }, client(rows).client);

describe('what is asked', () => {
  it('asks for the releases in the window, then every observation of them, then the newest', async () => {
    const { client: c, calls } = client([row()]);
    await readUpcomingEvents({ nowSeconds: NOW, scope: 'NEXT_24H_HIGH' }, c);
    expect(calls.releases).toEqual([
      {
        where: { event_time: { gte: NOW, lte: NOW + NEXT_DAY_SECONDS } },
        select: { value_id: true },
        distinct: ['value_id'],
      },
    ]);
    expect(calls.observations).toHaveLength(1);
    expect(calls.observations[0]).toMatchObject({
      orderBy: [{ value_id: 'asc' }, { captured_at: 'desc' }],
    });
    expect(calls.newest).toEqual([
      { orderBy: { captured_at: 'desc' }, select: { captured_at: true } },
    ]);
  });

  it('looks a week ahead for the News intent and a day for the others', async () => {
    const { client: c, calls } = client([]);
    await readUpcomingEvents({ nowSeconds: NOW, scope: 'UPCOMING_ALL' }, c);
    expect(calls.releases[0]!.where.event_time.lte).toBe(
      NOW + UPCOMING_HORIZON_SECONDS
    );
    expect(UPCOMING_HORIZON_SECONDS).toBe(7 * 24 * HOUR);
    expect(NEXT_DAY_SECONDS).toBe(24 * HOUR);
  });

  it('does not ask for observations when no release is in the window', async () => {
    const { client: c, calls } = client([
      row({ event_time: NOW + 3 * 24 * HOUR }),
    ]);
    const result = await readUpcomingEvents(
      { nowSeconds: NOW, scope: 'NEXT_24H_HIGH' },
      c
    );
    expect(calls.observations).toEqual([]);
    expect(result.events.items).toEqual([]);
    expect(result.events.status).toBe('OK');
  });
});

describe('the scopes', () => {
  const rows = () => [
    row({ event_id: 'high', importance: 'HIGH', event_time: NOW + 2 * HOUR }),
    row({
      event_id: 'mid',
      importance: 'MODERATE',
      event_time: NOW + 1 * HOUR,
    }),
    row({ event_id: 'low', importance: 'LOW', event_time: NOW + 3 * HOUR }),
    row({
      event_id: 'week',
      importance: 'HIGH',
      event_time: NOW + 3 * 24 * HOUR,
    }),
    row({
      event_id: 'far',
      importance: 'HIGH',
      event_time: NOW + 8 * 24 * HOUR,
    }),
  ];

  it('NEXT_24H_HIGH holds the HIGH-impact events of the next day, soonest first', async () => {
    const { events } = await read(rows(), 'NEXT_24H_HIGH');
    expect(events.items.map((i) => i.event_id)).toEqual(['high']);
    expect(events.scope).toBe('NEXT_24H_HIGH');
  });

  it('UPCOMING_ALL holds every event of the next week, soonest first', async () => {
    const { events } = await read(rows(), 'UPCOMING_ALL');
    expect(events.items.map((i) => i.event_id)).toEqual([
      'mid',
      'high',
      'low',
      'week',
    ]);
    expect(events.scope).toBe('UPCOMING_ALL');
  });

  it('includes an event at the clock and at the end of the window, and not a second beyond', async () => {
    const edges = [
      row({ event_id: 'now', event_time: NOW }),
      row({ event_id: 'end', event_time: NOW + NEXT_DAY_SECONDS }),
      row({ event_id: 'after', event_time: NOW + NEXT_DAY_SECONDS + 1 }),
      row({ event_id: 'before', event_time: NOW - 1 }),
    ];
    const { events } = await read(edges, 'NEXT_24H_HIGH');
    expect(events.items.map((i) => i.event_id)).toEqual(['now', 'end']);
  });

  it('orders by time, then by id, whatever the order the rows came in', async () => {
    const same = [
      row({ event_id: 'b', event_time: NOW + 100 }),
      row({ event_id: 'a', event_time: NOW + 100 }),
      row({ event_id: 'c', event_time: NOW + 50 }),
    ];
    expect((await read(same)).events.items.map((i) => i.event_id)).toEqual([
      'c',
      'a',
      'b',
    ]);
  });
});

describe('the newest observation of a release is its state (append-only)', () => {
  it('takes a rescheduled event at its new time', async () => {
    const old = row({
      value_id: 'vx',
      event_id: 'cpi',
      event_time: NOW + 2 * HOUR,
      captured_at: NOW - 3600,
    });
    const moved = row({
      value_id: 'vx',
      event_id: 'cpi',
      event_time: NOW + 5 * HOUR,
      captured_at: NOW - 60,
    });
    const { events } = await read([old, moved]);
    expect(events.items).toHaveLength(1);
    expect(events.items[0]!.time).toBe(timeIso(NOW + 5 * HOUR));
  });

  it('drops an event whose new time is out of the window, though an old observation was inside it', async () => {
    const old = row({
      value_id: 'vx',
      event_time: NOW + 2 * HOUR,
      captured_at: NOW - 3600,
    });
    const moved = row({
      value_id: 'vx',
      event_time: NOW + 3 * 24 * HOUR,
      captured_at: NOW - 60,
    });
    expect((await read([old, moved])).events.items).toEqual([]);
  });

  it('drops an event that was moved into the past', async () => {
    const old = row({
      value_id: 'vx',
      event_time: NOW + 2 * HOUR,
      captured_at: NOW - 3600,
    });
    const moved = row({
      value_id: 'vx',
      event_time: NOW - 600,
      captured_at: NOW - 60,
    });
    expect((await read([old, moved])).events.items).toEqual([]);
  });

  it('uses the importance of the newest observation', async () => {
    const old = row({
      value_id: 'vx',
      importance: 'HIGH',
      captured_at: NOW - 3600,
    });
    const demoted = row({
      value_id: 'vx',
      importance: 'LOW',
      captured_at: NOW - 60,
    });
    expect((await read([old, demoted], 'NEXT_24H_HIGH')).events.items).toEqual(
      []
    );
    const promoted = [
      row({ value_id: 'vy', importance: 'LOW', captured_at: NOW - 3600 }),
      row({ value_id: 'vy', importance: 'HIGH', captured_at: NOW - 60 }),
    ];
    expect((await read(promoted, 'NEXT_24H_HIGH')).events.items).toHaveLength(
      1
    );
  });

  it('lists a release once however many times it was observed', async () => {
    const seen = [1, 2, 3, 4].map((n) =>
      row({ value_id: 'vz', captured_at: NOW - n * 600 })
    );
    expect((await read(seen)).events.items).toHaveLength(1);
  });
});

describe('the fields of an item', () => {
  it('carries the id, name, time, currency, importance, approximate and tier1', async () => {
    const { events } = await read(
      [
        row({
          event_id: '840030016',
          event_name: 'Core CPI m/m',
          event_time: NOW + 90 * 60,
          currency: 'USD',
          importance: 'HIGH',
          time_mode: 0,
        }),
      ],
      'NEXT_24H_HIGH',
      { tier1Ids: new Set(['840030016']) }
    );
    expect(events.items).toEqual([
      {
        event_id: '840030016',
        name: 'Core CPI m/m',
        time: '2026-09-18T22:25:00Z',
        currency: 'USD',
        importance: 'HIGH',
        approximate: false,
        tier1: true,
      },
    ]);
  });

  it.each([
    [0, false],
    [1, true],
    [2, true],
    [null, true],
  ])('time_mode %p is approximate: %p', async (timeMode, approximate) => {
    const { events } = await read([row({ time_mode: timeMode })]);
    expect(events.items[0]!.approximate).toBe(approximate);
  });

  it('marks tier1 only for an id of the list', async () => {
    const rows = [row({ event_id: 'a' }), row({ event_id: 'b' })];
    const { events } = await read(rows, 'NEXT_24H_HIGH', {
      tier1Ids: new Set(['b']),
    });
    expect(events.items.map((i) => [i.event_id, i.tier1])).toEqual([
      ['a', false],
      ['b', true],
    ]);
  });

  it('shortens a name of more than 120 characters and keeps one of exactly 120', async () => {
    const { events } = await read([
      row({ event_name: 'x'.repeat(121) }),
      row({ event_name: 'y'.repeat(120), event_time: NOW + 2 * HOUR }),
    ]);
    expect(events.items.map((i) => i.name.length)).toEqual([120, 120]);
  });

  it('trims a name', async () => {
    expect(
      (await read([row({ event_name: '  CPI  ' })])).events.items[0]!.name
    ).toBe('CPI');
  });
});

describe('a row that is not well formed is left out, with a problem', () => {
  it.each([
    ['an empty name', { event_name: '   ' }],
    ['a currency of two letters', { currency: 'US' }],
    ['a currency in lower case', { currency: 'usd' }],
    ['an importance with a digit', { importance: 'HIGH2' }],
    ['an id with a space', { event_id: 'a b' }],
  ])('%s', async (_name, change) => {
    const good = row({ event_id: 'good' });
    const result = await read(
      [good, row(change as Partial<CalendarRow>)],
      'UPCOMING_ALL'
    );
    expect(result.events.items.map((i) => i.event_id)).toEqual(['good']);
    expect(result.problems).toHaveLength(1);
    expect(result.problems[0]).toContain('left out');
  });
});

describe('the cap', () => {
  it('holds at most 50 events, the soonest', async () => {
    const rows = Array.from({ length: 70 }, (_, i) =>
      row({
        event_id: `e${String(i).padStart(2, '0')}`,
        event_time: NOW + 100 + i,
      })
    );
    const { events } = await read(rows, 'UPCOMING_ALL');
    expect(events.items).toHaveLength(EVENTS_MAX_ITEMS);
    expect(events.items[0]!.event_id).toBe('e00');
    expect(events.items[49]!.event_id).toBe('e49');
  });
});

describe('an unavailable calendar is said, never read as “no news” (5.3)', () => {
  const unavailable = {
    status: 'UNAVAILABLE',
    calendar_age_seconds: null,
    items: [],
  };

  it('is UNAVAILABLE for a table with no row at all', async () => {
    const result = await read([]);
    expect(result.events).toMatchObject(unavailable);
    expect(result.problems).toEqual(['the news calendar holds no row']);
  });

  it.each(['releases', 'observations', 'newest'] as const)(
    'is UNAVAILABLE when the %s query fails',
    async (fail) => {
      const c = client([row()], { fail });
      const result = await readUpcomingEvents(
        { nowSeconds: NOW, scope: 'NEXT_24H_HIGH' },
        c.client
      );
      expect(result.events).toMatchObject(unavailable);
      expect(result.problems[0]).toContain('could not be read');
    }
  );

  it.each([NaN, -1, 1.5, Infinity])(
    'is UNAVAILABLE for a clock of %p',
    async (nowSeconds) => {
      const result = await readUpcomingEvents(
        { nowSeconds, scope: 'NEXT_24H_HIGH' },
        client([row()]).client
      );
      expect(result.events.status).toBe('UNAVAILABLE');
    }
  );

  it('keeps the scope it was asked for', async () => {
    expect((await read([], 'UPCOMING_ALL')).events.scope).toBe('UPCOMING_ALL');
  });
});

describe('the age of the calendar', () => {
  it('is the age of the newest observation of the whole table, not of the events shown', async () => {
    const rows = [
      row({ captured_at: NOW - 3000 }),
      row({ captured_at: NOW - 100, event_time: NOW + 10 * 24 * HOUR }),
    ];
    const { events } = await read(rows);
    expect(events.calendar_age_seconds).toBe(100);
    expect(events.items).toHaveLength(1);
  });

  it('is OK up to 45 minutes and LATE a second after', async () => {
    expect(CALENDAR_LATE_SECONDS).toBe(Number(ENGINE4_LATE));
    expect(CALENDAR_LATE_SECONDS).toBe(2700);
    expect((await read([row({ captured_at: NOW - 2700 })])).events.status).toBe(
      'OK'
    );
    expect((await read([row({ captured_at: NOW - 2701 })])).events.status).toBe(
      'LATE'
    );
    expect(
      (await read([row({ captured_at: NOW - 2701 })])).events
        .calendar_age_seconds
    ).toBe(2701);
  });

  it('is never negative when the clocks differ', async () => {
    const { events } = await read([row({ captured_at: NOW + 30 })]);
    expect(events.calendar_age_seconds).toBe(0);
    expect(events.status).toBe('OK');
  });

  it('keeps a LATE calendar’s events: it does not hide what it knows', async () => {
    const { events } = await read([row({ captured_at: NOW - 6000 })]);
    expect(events.status).toBe('LATE');
    expect(events.items).toHaveLength(1);
  });
});

describe('the Tier-1 list', () => {
  it('ships empty, so no event is marked tier1 yet (D13)', () => {
    expect(tier1IdsOf()).toEqual(new Set());
    expect((tier1Config as { events: unknown[] }).events).toEqual([]);
  });

  it('reads the ids of a list and nothing else', () => {
    expect(
      tier1IdsOf({
        events: [
          { eventId: '123', kind: 'CPI', name: 'CPI' },
          { eventId: '45678901234567890123', kind: 'NFP', name: 'NFP' }, // 20 digits
          { eventId: 'x1' },
          { eventId: '123456789012345678901' }, // 21 digits
          { eventId: 12 },
          'text',
          null,
          {},
        ],
      })
    ).toEqual(new Set(['123', '45678901234567890123']));
  });

  it.each([
    null,
    undefined,
    'text',
    4,
    [],
    {},
    { events: 'x' },
    { events: {} },
  ])('gives an empty set for %p', (raw) => {
    expect(tier1IdsOf(raw)).toEqual(new Set());
  });
});

describe('an events block the packet validator accepts', () => {
  it('is accepted in a packet, for both scopes, whatever the status', async () => {
    const w = goldenWorlds()[3]!;
    const rows = [
      row({ event_id: 'cpi', event_time: NOW + HOUR, importance: 'HIGH' }),
      row({ event_id: 'minor', event_time: NOW + 2 * HOUR, importance: 'LOW' }),
    ];
    for (const [intent, scope] of [
      ['DIRECTION', 'NEXT_24H_HIGH'],
      ['NEWS', 'UPCOMING_ALL'],
    ] as const) {
      for (const captured of [NOW - 60, NOW - 6000]) {
        const { events } = await read(
          rows.map((r) => ({ ...r, captured_at: captured })),
          scope
        );
        const run = await runWorld(w, 'DAY_TRADER', intent);
        const packet = { ...run.packet!, events };
        expect(validatePacket(packet)).toEqual({
          ok: true,
          packet: expect.any(Object),
        });
      }
    }
    const down = await readUpcomingEvents(
      { nowSeconds: NOW, scope: 'NEXT_24H_HIGH' },
      client([], {}).client
    );
    const run = await runWorld(w, 'DAY_TRADER', 'DIRECTION');
    expect(validatePacket({ ...run.packet!, events: down.events }).ok).toBe(
      true
    );
  });
});

describe('what the reader is exact about', () => {
  it('asks the table for exactly the eight columns it reads', async () => {
    const { client: c, calls } = client([row()]);
    await readUpcomingEvents({ nowSeconds: NOW, scope: 'NEXT_24H_HIGH' }, c);
    expect(calls.observations[0]!.select).toEqual({
      value_id: true,
      event_id: true,
      event_name: true,
      event_time: true,
      currency: true,
      importance: true,
      time_mode: true,
      captured_at: true,
    });
  });

  it.each([
    ['a currency with a prefix', { currency: 'xUSD' }],
    ['a currency with a suffix', { currency: 'USDx' }],
    ['an importance with a prefix', { importance: ' HIGH' }],
    ['an importance of 13 letters', { importance: 'HIGHHIGHHIGHH' }],
    ['a name that is not text', { event_name: null as unknown as string }],
  ])('leaves out a row with %s and says so', async (_name, change) => {
    const result = await read(
      [row({ event_id: 'good', event_time: NOW + 2 * HOUR }), row(change)],
      'UPCOMING_ALL'
    );
    expect(result.events.items.map((i) => i.event_id)).toEqual(['good']);
    expect(result.problems).toHaveLength(1);
  });

  it('goes on to the rows after one that is left out, whatever the reason', async () => {
    // rows come ordered by value_id, so the bad ones are named to come first
    const rows = [
      row({ value_id: 'a1', event_id: 'past', event_time: NOW - HOUR }),
      row({ value_id: 'a2', event_id: 'far', event_time: NOW + 3 * 24 * HOUR }),
      row({ value_id: 'a3', event_id: 'mid', importance: 'MODERATE' }),
      row({ value_id: 'a4', event_id: 'bad id', importance: 'HIGH' }),
      row({ value_id: 'z9', event_id: 'good', importance: 'HIGH' }),
    ];
    const { events } = await read(rows, 'NEXT_24H_HIGH');
    expect(events.items.map((i) => i.event_id)).toEqual(['good']);
    const week = await read(rows, 'UPCOMING_ALL');
    expect(week.events.items.map((i) => i.event_id)).toEqual([
      'good',
      'mid',
      'far',
    ]);
  });

  it('goes on past a release that was moved out of the window to the ones after it', async () => {
    // a1 was inside the window once and its newest observation moved it a week away; z9 is a plain release
    const rows = [
      row({
        value_id: 'a1',
        event_id: 'moved',
        event_time: NOW + 2 * HOUR,
        captured_at: NOW - 3600,
      }),
      row({
        value_id: 'a1',
        event_id: 'moved',
        event_time: NOW + 7 * 24 * HOUR,
        captured_at: NOW - 60,
      }),
      row({
        value_id: 'a2',
        event_id: 'past',
        event_time: NOW + 3 * HOUR,
        captured_at: NOW - 3600,
      }),
      row({
        value_id: 'a2',
        event_id: 'past',
        event_time: NOW - HOUR,
        captured_at: NOW - 60,
      }),
      row({ value_id: 'z9', event_id: 'good', event_time: NOW + 4 * HOUR }),
    ];
    const { events } = await read(rows, 'NEXT_24H_HIGH');
    expect(events.items.map((i) => i.event_id)).toEqual(['good']);
  });

  it('reads an id of the Tier-1 list that comes after one that is not an id', () => {
    expect(
      tier1IdsOf({
        events: [
          null,
          'text',
          { eventId: 'x1' },
          { eventId: '77' },
          {},
          { eventId: '88' },
        ],
      })
    ).toEqual(new Set(['77', '88']));
  });

  it('says what is wrong with a clock that is not a time', async () => {
    const result = await readUpcomingEvents(
      { nowSeconds: NaN, scope: 'UPCOMING_ALL' },
      client([row()]).client
    );
    expect(result.problems).toEqual(['nowSeconds is not a time']);
    expect(result.events.scope).toBe('UPCOMING_ALL');
  });

  it('says what the database said when it fails, and “unknown error” when it said nothing', async () => {
    const failing = (thrown: unknown): IntakeCalendarClient => ({
      ...client([row()]).client,
      releases: {
        findMany: async () => {
          throw thrown;
        },
      },
    });
    const withMessage = await readUpcomingEvents(
      { nowSeconds: NOW, scope: 'NEXT_24H_HIGH' },
      failing(new Error('connection refused'))
    );
    expect(withMessage.problems).toEqual([
      'the news calendar could not be read: connection refused',
    ]);
    const plain = await readUpcomingEvents(
      { nowSeconds: NOW, scope: 'NEXT_24H_HIGH' },
      failing('plain text')
    );
    expect(plain.problems).toEqual([
      'the news calendar could not be read: unknown error',
    ]);
  });

  it('treats a newest observation that is not a number as an empty calendar', async () => {
    const base = client([row()]).client;
    for (const captured of [NaN, Infinity]) {
      const result = await readUpcomingEvents(
        { nowSeconds: NOW, scope: 'NEXT_24H_HIGH' },
        {
          ...base,
          newest: { findFirst: async () => ({ captured_at: captured }) },
        }
      );
      expect(result.events.status).toBe('UNAVAILABLE');
      expect(result.problems).toEqual(['the news calendar holds no row']);
    }
  });

  it('rounds the age of the calendar down to whole seconds', async () => {
    const { events } = await read([row({ captured_at: NOW - 60.5 })]);
    expect(events.calendar_age_seconds).toBe(60);
  });

  it('orders any set of events by time and then by id, in whatever order the table answers', async () => {
    const rng = makeRng(2026n);
    for (let round = 0; round < 200; round += 1) {
      const count = Number(rng.int(2n, 8n));
      const rows = Array.from({ length: count }, (_, i) =>
        row({
          value_id: `v${String(Number(rng.int(0n, 99n))).padStart(2, '0')}-${i}`,
          event_id: `e${String(Number(rng.int(0n, 9n)))}-${i}`,
          event_time: NOW + 100 + Number(rng.int(0n, 3n)),
        })
      );
      const { events } = await read(rows, 'UPCOMING_ALL');
      const expected = [...rows]
        .sort((a, b) =>
          a.event_time !== b.event_time
            ? a.event_time - b.event_time
            : a.event_id < b.event_id
              ? -1
              : 1
        )
        .map((r) => r.event_id);
      expect(events.items.map((i) => i.event_id)).toEqual(expected);
    }
  });
});
