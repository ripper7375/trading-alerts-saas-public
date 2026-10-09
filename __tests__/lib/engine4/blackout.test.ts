/**
 * @jest-environment node
 */

/**
 * The Tier-1 blackout (build step 5, part 3; architecture 6.6, ADR-060).
 *
 * The ids below (9000000xx) are TEST IDS, clearly not MT5 event ids: the real
 * Tier-1 list must come from production `economic_events` (plan decision D13)
 * and is not known here. Every time is UTC, as the exporter stores it.
 */

import {
  BLACKOUT_APPROXIMATE_SECONDS,
  BLACKOUT_EXACT_SECONDS,
  CALENDAR_LATE_SECONDS,
  HOLDING_WINDOW_SECONDS,
  TIER1_KINDS,
  TIER1_SCHEMA_VERSION,
  checkBlackout,
  missingTier1Kinds,
  parseTier1List,
} from '@/lib/engine4';
import type {
  BlackoutInput,
  CalendarEvent,
  Tier1List,
  TraderType,
} from '@/lib/engine4';

const utc = (iso: string): number => Date.parse(iso) / 1000;
const MIN = 60;
const HOUR = 3600;

const TEST_LIST: Tier1List = {
  schemaVersion: 1,
  listVersion: 7,
  events: [
    { eventId: '900000001', kind: 'CPI', name: 'TEST US CPI' },
    { eventId: '900000002', kind: 'CORE_PCE', name: 'TEST US Core PCE' },
    { eventId: '900000003', kind: 'FOMC_RATE_DECISION', name: 'TEST FOMC' },
    { eventId: '900000004', kind: 'NFP', name: 'TEST NFP' },
  ],
};

const CPI = '900000001';
const NFP = '900000004';

let counter = 0;
function event(over: Partial<CalendarEvent> = {}): CalendarEvent {
  counter += 1;
  return {
    valueId: `v${counter}`,
    eventId: CPI,
    eventName: 'TEST US CPI',
    eventTime: utc('2026-10-14T12:30:00Z'),
    currency: 'USD',
    importance: 'HIGH',
    timeMode: 0,
    capturedAt: utc('2026-10-14T09:00:00Z'),
    ...over,
  };
}

function check(over: Partial<BlackoutInput> & { now: number }) {
  const { now, ...rest } = over;
  return checkBlackout({
    nowSeconds: now,
    traderType: 'DAY_TRADER',
    list: TEST_LIST,
    events: [],
    newestCapturedAt: utc('2026-10-14T12:20:00Z'),
    ...rest,
  });
}

const NOW = utc('2026-10-14T12:30:00Z');

describe('the constants', () => {
  test('both holding windows are longer than the widest blackout (the calendar reader looks that far ahead)', () => {
    for (const traderType of Object.keys(
      HOLDING_WINDOW_SECONDS
    ) as TraderType[]) {
      expect(
        HOLDING_WINDOW_SECONDS[traderType] > BLACKOUT_APPROXIMATE_SECONDS
      ).toBe(true);
    }
  });

  test('15 minutes, 60 minutes, 45 minutes, and the holding windows', () => {
    expect(BLACKOUT_EXACT_SECONDS).toBe(900n);
    expect(BLACKOUT_APPROXIMATE_SECONDS).toBe(3600n);
    expect(CALENDAR_LATE_SECONDS).toBe(2700n);
    expect(HOLDING_WINDOW_SECONDS).toEqual({
      SCALPER: 7200n,
      DAY_TRADER: 43200n,
    });
  });
});

describe('a Tier-1 release with an exact time: +-15 minutes (6.6)', () => {
  // the release is at `now + offset`; the plan's "-16, -14, +14, +16 minutes"
  test.each([
    [-16 * MIN, 'CLEAR'],
    [-14 * MIN, 'BLOCKED'],
    [14 * MIN, 'BLOCKED'],
    [16 * MIN, 'CLEAR'],
  ])('a release %p seconds from now gives %s', (offset, status) => {
    const result = check({
      now: NOW,
      events: [event({ eventTime: NOW + offset })],
    });
    expect(result.status).toBe(status);
    expect(result.blocks.length).toBe(status === 'BLOCKED' ? 1 : 0);
  });

  test.each([
    [-15 * MIN - 1, 'CLEAR'],
    [-15 * MIN, 'BLOCKED'],
    [0, 'BLOCKED'],
    [15 * MIN, 'BLOCKED'],
    [15 * MIN + 1, 'CLEAR'],
  ])('the edge: %p seconds from now gives %s (inclusive)', (offset, status) => {
    const result = check({
      now: NOW,
      events: [event({ eventTime: NOW + offset })],
    });
    expect(result.status).toBe(status);
  });

  test('the block names the release and when its window ends', () => {
    const time = NOW + 10 * MIN;
    const result = check({
      now: NOW,
      events: [event({ valueId: 'cpi-oct', eventTime: time })],
    });
    expect(result.blocks).toEqual([
      {
        valueId: 'cpi-oct',
        eventId: CPI,
        eventName: 'TEST US CPI',
        kind: 'CPI',
        eventTime: BigInt(time),
        approximate: false,
        marginSeconds: 900n,
        windowStart: BigInt(time - 900),
        windowEnd: BigInt(time + 900),
      },
    ]);
    expect(result.windowEndsAt).toBe(BigInt(time + 900));
  });
});

describe('a release with an approximate time: +-60 minutes (6.6)', () => {
  test.each([
    [-61 * MIN, 'CLEAR'],
    [-59 * MIN, 'BLOCKED'],
    [59 * MIN, 'BLOCKED'],
    [61 * MIN, 'CLEAR'],
  ])('a release %p seconds from now gives %s', (offset, status) => {
    const result = check({
      now: NOW,
      events: [event({ eventTime: NOW + offset, timeMode: 1 })],
    });
    expect(result.status).toBe(status);
  });

  test.each([
    [-60 * MIN - 1, 'CLEAR'],
    [-60 * MIN, 'BLOCKED'],
    [60 * MIN, 'BLOCKED'],
    [60 * MIN + 1, 'CLEAR'],
  ])('the edge: %p seconds from now gives %s (inclusive)', (offset, status) => {
    const result = check({
      now: NOW,
      events: [event({ eventTime: NOW + offset, timeMode: 2 })],
    });
    expect(result.status).toBe(status);
  });

  test('every non-zero time mode is approximate, and so is an unknown one', () => {
    for (const timeMode of [1, 2, 3, null]) {
      const result = check({
        now: NOW,
        events: [event({ eventTime: NOW + 30 * MIN, timeMode })],
      });
      expect(result.status).toBe('BLOCKED');
      expect(result.blocks[0]?.approximate).toBe(true);
      expect(result.blocks[0]?.marginSeconds).toBe(3600n);
    }
  });

  test('time mode 0 is the only exact one', () => {
    const result = check({
      now: NOW,
      events: [event({ eventTime: NOW + 30 * MIN, timeMode: 0 })],
    });
    expect(result.status).toBe('CLEAR');
  });
});

describe('across the broker clock change (US daylight saving ends 1 Nov 2026)', () => {
  // The events are stored in UTC (the exporter converts), so the arithmetic must not care what
  // date it is. The same four offsets, on both sides of the change and at the change itself:
  // NFP 2 Oct 12:30 UTC (summer time), the change at 06:00 UTC on 1 Nov, NFP 6 Nov 13:30 UTC.
  const releases = [
    '2026-10-02T12:30:00Z',
    '2026-10-31T23:30:00Z',
    '2026-11-01T05:59:00Z',
    '2026-11-01T06:00:00Z',
    '2026-11-01T06:01:00Z',
    '2026-11-06T13:30:00Z',
  ];
  test.each(releases)(
    'a release at %s: allowed, blocked, blocked, allowed',
    (iso) => {
      const time = utc(iso);
      const statuses = [-16 * MIN, -14 * MIN, 14 * MIN, 16 * MIN].map(
        (offset) =>
          check({
            now: time - offset,
            events: [event({ eventId: NFP, eventTime: time })],
          }).status
      );
      expect(statuses).toEqual(['CLEAR', 'BLOCKED', 'BLOCKED', 'CLEAR']);
    }
  );

  test('a window that spans the change is one window of 30 real minutes', () => {
    // 05:50 UTC to 06:10 UTC straddles the change; the release is at 06:00
    const time = utc('2026-11-01T06:00:00Z');
    const inside = check({
      now: utc('2026-11-01T05:45:00Z'),
      events: [event({ eventTime: time })],
    });
    const before = check({
      now: utc('2026-11-01T05:44:59Z'),
      events: [event({ eventTime: time })],
    });
    const after = check({
      now: utc('2026-11-01T06:15:01Z'),
      events: [event({ eventTime: time })],
    });
    expect(inside.status).toBe('BLOCKED');
    expect(before.status).toBe('CLEAR');
    expect(after.status).toBe('CLEAR');
  });
});

describe('the list is keyed on event ids, not names', () => {
  test('a listed id blocks whatever it is called', () => {
    const result = check({
      now: NOW,
      events: [event({ eventId: NFP, eventName: 'Something else entirely' })],
    });
    expect(result.status).toBe('BLOCKED');
    expect(result.blocks[0]?.kind).toBe('NFP');
    expect(result.blocks[0]?.eventName).toBe('Something else entirely');
  });

  test('an id that is not listed does not block, whatever it is called', () => {
    const result = check({
      now: NOW,
      events: [event({ eventId: '800000001', eventName: 'TEST US CPI' })],
    });
    expect(result.status).toBe('CLEAR');
    expect(result.blocks).toEqual([]);
  });

  test('a listed id blocks whatever its currency and importance', () => {
    const result = check({
      now: NOW,
      events: [event({ currency: 'EUR', importance: 'LOW' })],
    });
    expect(result.status).toBe('BLOCKED');
  });
});

describe('the newest observation of each release is its state', () => {
  test('a release moved out of the window no longer blocks', () => {
    const result = check({
      now: NOW,
      events: [
        event({ valueId: 'r', eventTime: NOW + 5 * MIN, capturedAt: 1000 }),
        event({ valueId: 'r', eventTime: NOW + 5 * HOUR, capturedAt: 2000 }),
      ],
    });
    expect(result.status).toBe('CLEAR');
  });

  test('a release moved into the window blocks', () => {
    const result = check({
      now: NOW,
      events: [
        event({ valueId: 'r', eventTime: NOW + 5 * HOUR, capturedAt: 1000 }),
        event({ valueId: 'r', eventTime: NOW + 5 * MIN, capturedAt: 2000 }),
      ],
    });
    expect(result.status).toBe('BLOCKED');
    expect(result.blocks.length).toBe(1);
  });

  test('the order the rows come in does not matter', () => {
    const rows = [
      event({ valueId: 'r', eventTime: NOW + 5 * MIN, capturedAt: 1000 }),
      event({ valueId: 'r', eventTime: NOW + 5 * HOUR, capturedAt: 2000 }),
    ];
    expect(check({ now: NOW, events: rows }).status).toBe('CLEAR');
    expect(check({ now: NOW, events: [...rows].reverse() }).status).toBe(
      'CLEAR'
    );
  });

  test('two different releases are two states', () => {
    const result = check({
      now: NOW,
      events: [
        event({ valueId: 'a', eventTime: NOW + 5 * MIN }),
        event({ valueId: 'b', eventId: NFP, eventTime: NOW + 6 * MIN }),
      ],
    });
    expect(result.blocks.map((b) => b.valueId)).toEqual(['a', 'b']);
  });
});

describe('several releases at once', () => {
  test('the blocks are soonest first and the window ends with the latest', () => {
    const result = check({
      now: NOW,
      events: [
        event({ valueId: 'late', eventTime: NOW + 10 * MIN }),
        event({ valueId: 'early', eventId: NFP, eventTime: NOW - 10 * MIN }),
        event({ valueId: 'approx', eventTime: NOW + 50 * MIN, timeMode: 1 }),
      ],
    });
    expect(result.blocks.map((b) => b.valueId)).toEqual([
      'early',
      'late',
      'approx',
    ]);
    // the approximate one ends last: 50 + 60 minutes
    expect(result.windowEndsAt).toBe(BigInt(NOW + 110 * MIN));
  });

  test('the window ends with the block that ends last, not the one that comes last', () => {
    // an approximate release at +10 minutes ends at +70; an exact one at +30 ends at +45
    const result = check({
      now: NOW + 20 * MIN,
      events: [
        event({ valueId: 'exact', eventTime: NOW + 30 * MIN }),
        event({ valueId: 'approx', eventTime: NOW + 10 * MIN, timeMode: 1 }),
      ],
    });
    expect(result.blocks.map((b) => b.valueId)).toEqual(['approx', 'exact']);
    expect(result.windowEndsAt).toBe(BigInt(NOW + 70 * MIN));
  });

  test('no block means no end', () => {
    expect(check({ now: NOW }).windowEndsAt).toBeNull();
  });

  test('releases at the same time keep the order they were given', () => {
    const rows = ['a', 'b', 'c', 'd'].map((valueId) =>
      event({ valueId, eventTime: NOW + 5 * MIN })
    );
    const ids = (events: CalendarEvent[]) =>
      check({ now: NOW, events }).blocks.map((b) => b.valueId);
    expect(ids(rows)).toEqual(['a', 'b', 'c', 'd']);
    expect(ids([...rows].reverse())).toEqual(['d', 'c', 'b', 'a']);
    const warned = ['a', 'b', 'c'].map((valueId) =>
      event({ valueId, eventId: '800000001', eventTime: NOW + 3 * HOUR })
    );
    expect(
      check({ now: NOW, events: warned }).warnings.map((w) => w.valueId)
    ).toEqual(['a', 'b', 'c']);
  });
});

describe('other HIGH-impact USD releases inside the holding window are a warning, not a block', () => {
  const other = (over: Partial<CalendarEvent>) =>
    event({ eventId: '800000001', eventName: 'TEST Other USD', ...over });

  test.each<[TraderType, number, boolean]>([
    ['SCALPER', 2 * HOUR, true],
    ['SCALPER', 2 * HOUR + 1, false],
    ['DAY_TRADER', 2 * HOUR + 1, true],
    ['DAY_TRADER', 12 * HOUR, true],
    ['DAY_TRADER', 12 * HOUR + 1, false],
  ])('%s, a release in %p seconds: warned %p', (traderType, offset, warned) => {
    const result = check({
      now: NOW,
      traderType,
      events: [other({ valueId: 'o', eventTime: NOW + offset })],
    });
    expect(result.status).toBe('CLEAR');
    expect(result.blocks).toEqual([]);
    expect(result.warnings.length).toBe(warned ? 1 : 0);
  });

  test('the warning says what, when and how far', () => {
    const time = NOW + 3 * HOUR;
    const result = check({
      now: NOW,
      events: [other({ valueId: 'o', eventTime: time })],
    });
    expect(result.warnings).toEqual([
      {
        valueId: 'o',
        eventId: '800000001',
        eventName: 'TEST Other USD',
        eventTime: BigInt(time),
        approximate: false,
        tier1: false,
        secondsUntil: BigInt(3 * HOUR),
      },
    ]);
    expect(result.holdingWindowSeconds).toBe(43200n);
  });

  test('only HIGH importance, only USD, only the future', () => {
    const result = check({
      now: NOW,
      events: [
        other({
          valueId: 'moderate',
          importance: 'MODERATE',
          eventTime: NOW + HOUR,
        }),
        other({ valueId: 'eur', currency: 'EUR', eventTime: NOW + HOUR }),
        other({ valueId: 'past', eventTime: NOW - MIN }),
        other({ valueId: 'now', eventTime: NOW }),
        other({ valueId: 'ok', eventTime: NOW + HOUR }),
      ],
    });
    expect(result.warnings.map((w) => w.valueId)).toEqual(['now', 'ok']);
  });

  test('warnings are soonest first and flag an approximate time', () => {
    const result = check({
      now: NOW,
      events: [
        other({ valueId: 'b', eventTime: NOW + 4 * HOUR, timeMode: 1 }),
        other({ valueId: 'a', eventTime: NOW + 3 * HOUR }),
      ],
    });
    expect(result.warnings.map((w) => [w.valueId, w.approximate])).toEqual([
      ['a', false],
      ['b', true],
    ]);
  });

  test('a Tier-1 release that has not reached its window yet is a warning that says so', () => {
    const result = check({
      now: NOW,
      traderType: 'SCALPER',
      events: [
        event({ valueId: 't', eventId: NFP, eventTime: NOW + 90 * MIN }),
      ],
    });
    expect(result.status).toBe('CLEAR');
    expect(result.warnings.map((w) => [w.valueId, w.tier1])).toEqual([
      ['t', true],
    ]);
  });

  test('a release that blocks is not also a warning', () => {
    const result = check({
      now: NOW,
      events: [event({ valueId: 't', eventTime: NOW + 5 * MIN })],
    });
    expect(result.status).toBe('BLOCKED');
    expect(result.warnings).toEqual([]);
  });
});

describe('it fails closed', () => {
  const release = event({ eventTime: NOW + 5 * HOUR });

  test('a Tier-1 list that could not be read', () => {
    const result = check({ now: NOW, list: null, events: [release] });
    expect(result.status).toBe('UNKNOWN');
    expect(result.unknownReasons).toEqual(['LIST_INVALID']);
    expect(result.listVersion).toBeNull();
  });

  test('an empty list is "not set"', () => {
    const result = check({
      now: NOW,
      list: { schemaVersion: 1, listVersion: 1, events: [] },
      events: [release],
    });
    expect(result.status).toBe('UNKNOWN');
    expect(result.unknownReasons).toEqual(['LIST_NOT_SET']);
    expect(result.listVersion).toBe(1);
  });

  test.each(TIER1_KINDS)('a list without %s is incomplete', (kind) => {
    const list: Tier1List = {
      ...TEST_LIST,
      events: TEST_LIST.events.filter((e) => e.kind !== kind),
    };
    expect(missingTier1Kinds(list)).toEqual([kind]);
    const result = check({ now: NOW, list, events: [release] });
    expect(result.status).toBe('UNKNOWN');
    expect(result.unknownReasons).toEqual(['LIST_INCOMPLETE']);
  });

  test('a complete list is not incomplete, and two ids for one kind are fine', () => {
    const list: Tier1List = {
      ...TEST_LIST,
      events: [
        ...TEST_LIST.events,
        { eventId: '900000005', kind: 'CPI', name: 'TEST US CPI y/y' },
      ],
    };
    expect(missingTier1Kinds(TEST_LIST)).toEqual([]);
    expect(missingTier1Kinds(list)).toEqual([]);
    expect(check({ now: NOW, list, events: [release] }).status).toBe('CLEAR');
  });

  test('a calendar that could not be read', () => {
    const result = check({ now: NOW, events: null });
    expect(result.status).toBe('UNKNOWN');
    expect(result.unknownReasons).toEqual(['CALENDAR_UNAVAILABLE']);
  });

  test('a calendar with no row at all', () => {
    const result = check({ now: NOW, events: [], newestCapturedAt: null });
    expect(result.status).toBe('UNKNOWN');
    expect(result.unknownReasons).toEqual(['CALENDAR_EMPTY']);
    expect(result.calendar).toEqual({
      newestObservationAt: null,
      ageSeconds: null,
      late: false,
    });
  });

  test('an unreadable newest time is an unavailable calendar', () => {
    const result = check({ now: NOW, newestCapturedAt: 'yesterday' });
    expect(result.status).toBe('UNKNOWN');
    expect(result.unknownReasons).toEqual(['CALENDAR_UNAVAILABLE']);
  });

  test('a row with an unreadable time', () => {
    const result = check({
      now: NOW,
      events: [event({ eventTime: 'soon' }), release],
    });
    expect(result.status).toBe('UNKNOWN');
    expect(result.unknownReasons).toEqual(['EVENT_UNREADABLE']);
  });

  test('a row with an unreadable capture time', () => {
    const result = check({
      now: NOW,
      events: [event({ capturedAt: 0 })],
    });
    expect(result.unknownReasons).toEqual(['EVENT_UNREADABLE']);
  });

  test('every reason is given once, in a fixed order', () => {
    const result = check({
      now: NOW,
      list: null,
      events: [event({ eventTime: 'soon' }), event({ eventTime: 'later' })],
      newestCapturedAt: null,
    });
    expect(result.unknownReasons).toEqual([
      'LIST_INVALID',
      'CALENDAR_EMPTY',
      'EVENT_UNREADABLE',
    ]);
  });

  test('a block outranks an unknown, and the unknowns are still listed', () => {
    const result = check({
      now: NOW,
      list: { ...TEST_LIST, events: TEST_LIST.events.slice(0, 3) },
      events: [
        event({ eventId: NFP }),
        event({ eventId: CPI, eventTime: NOW + MIN }),
      ],
    });
    // NFP is not on the three-event list, CPI is
    expect(result.status).toBe('BLOCKED');
    expect(result.unknownReasons).toEqual(['LIST_INCOMPLETE']);
  });

  test('a clear answer has no unknowns', () => {
    const result = check({ now: NOW, events: [release] });
    expect(result.status).toBe('CLEAR');
    expect(result.unknownReasons).toEqual([]);
    expect(result.listVersion).toBe(7);
  });
});

describe("the calendar's age (7.6)", () => {
  const ageOf = (age: number) =>
    check({ now: NOW, newestCapturedAt: NOW - age }).calendar;

  test.each([
    [0, false],
    [44 * MIN + 59, false],
    [45 * MIN, false],
    [45 * MIN + 1, true],
    [6 * HOUR, true],
  ])('an age of %p seconds: late %p', (age, late) => {
    expect(ageOf(age)).toEqual({
      newestObservationAt: BigInt(NOW - age),
      ageSeconds: BigInt(age),
      late,
    });
  });

  test('a capture time in the future is an age of zero, not a negative age', () => {
    expect(ageOf(-5 * MIN)).toEqual({
      newestObservationAt: BigInt(NOW + 5 * MIN),
      ageSeconds: 0n,
      late: false,
    });
  });

  test('a late calendar does not lift the blackout', () => {
    const result = check({
      now: NOW,
      newestCapturedAt: NOW - 6 * HOUR,
      events: [event({ eventTime: NOW + 5 * MIN })],
    });
    expect(result.calendar.late).toBe(true);
    expect(result.status).toBe('BLOCKED');
  });
});

describe('what is refused outright', () => {
  test('a bad clock', () => {
    expect(() => check({ now: 0 })).toThrow(/nowSeconds/);
    expect(() => check({ now: 1.5 })).toThrow(/nowSeconds/);
  });

  test.each(['TRADER', '__proto__', 'toString', '', undefined])(
    'a trader type of %p',
    (traderType) => {
      expect(() =>
        check({ now: NOW, traderType: traderType as unknown as TraderType })
      ).toThrow(/traderType/);
    }
  );
});

describe('parseTier1List', () => {
  const good = {
    $schema: './tier1-events.schema.json',
    schemaVersion: 1,
    listVersion: 3,
    description: 'x',
    events: [{ eventId: '900000001', kind: 'CPI', name: 'TEST CPI' }],
  };
  const problems = (raw: unknown): string[] => {
    const parsed = parseTier1List(raw);
    if (parsed.ok) throw new Error('expected the list to be refused');
    return parsed.problems;
  };

  test('reads a good list', () => {
    expect(parseTier1List(good)).toEqual({
      ok: true,
      list: {
        schemaVersion: TIER1_SCHEMA_VERSION,
        listVersion: 3,
        events: [{ eventId: '900000001', kind: 'CPI', name: 'TEST CPI' }],
      },
    });
  });

  test('reads an empty list, and the optional keys may be missing', () => {
    const parsed = parseTier1List({
      schemaVersion: 1,
      listVersion: 1,
      events: [],
    });
    expect(parsed).toEqual({
      ok: true,
      list: { schemaVersion: 1, listVersion: 1, events: [] },
    });
  });

  test.each<[string, unknown, RegExp]>([
    ['null', null, /not an object/],
    ['a list', [], /not an object/],
    ['an unknown key', { ...good, extra: 1 }, /unknown key extra/],
    ['a wrong schema version', { ...good, schemaVersion: 2 }, /schemaVersion/],
    [
      'a missing schema version',
      { ...good, schemaVersion: undefined },
      /schemaVersion/,
    ],
    ['a version of 0', { ...good, listVersion: 0 }, /listVersion/],
    ['a fractional version', { ...good, listVersion: 1.5 }, /listVersion/],
    ['a version as text', { ...good, listVersion: '3' }, /listVersion/],
    [
      'a description that is not text',
      { ...good, description: 5 },
      /description/,
    ],
    [
      'events that are not a list',
      { ...good, events: {} },
      /events must be a list/,
    ],
    [
      'an event that is not an object',
      { ...good, events: [5] },
      /events\[0\] is not an object/,
    ],
    [
      'an event with an unknown key',
      { ...good, events: [{ ...good.events[0], extra: 1 }] },
      /events\[0\] has an unknown key extra/,
    ],
    [
      'an id with letters',
      { ...good, events: [{ ...good.events[0], eventId: '84A' }] },
      /eventId must be digits/,
    ],
    [
      'an id as a number',
      { ...good, events: [{ ...good.events[0], eventId: 840010013 }] },
      /eventId must be digits/,
    ],
    [
      'an empty id',
      { ...good, events: [{ ...good.events[0], eventId: '' }] },
      /eventId must be digits/,
    ],
    [
      'an id of 21 digits',
      { ...good, events: [{ ...good.events[0], eventId: '1'.repeat(21) }] },
      /eventId must be digits/,
    ],
    [
      'an unknown kind',
      { ...good, events: [{ ...good.events[0], kind: 'GDP' }] },
      /kind must be one of/,
    ],
    [
      'a name that is blank',
      { ...good, events: [{ ...good.events[0], name: '  ' }] },
      /name must be text/,
    ],
    [
      'a name that is missing',
      { ...good, events: [{ eventId: '1', kind: 'NFP' }] },
      /name must be text/,
    ],
    [
      'an id listed twice',
      { ...good, events: [good.events[0], { ...good.events[0], kind: 'NFP' }] },
      /listed twice/,
    ],
  ])('refuses %s', (_label, raw, pattern) => {
    expect(problems(raw).join('\n')).toMatch(pattern);
  });

  test('an id of 20 digits is the longest allowed', () => {
    const parsed = parseTier1List({
      ...good,
      events: [{ ...good.events[0], eventId: '9'.repeat(20) }],
    });
    expect(parsed.ok).toBe(true);
  });

  test('says every problem, not only the first', () => {
    const list = problems({
      schemaVersion: 2,
      listVersion: 0,
      events: [{ eventId: 'x', kind: 'y', name: '' }],
    });
    expect(list.length).toBe(5);
  });
});
