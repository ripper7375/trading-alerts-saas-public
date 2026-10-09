/**
 * @jest-environment node
 */

import {
  Engine4InputError,
  Rational,
  buildStopChoices,
  groupStopOptions,
  stopOptions,
  zoneDisagreement,
  zoneFromStored,
  zoneInvalidation,
} from '@/lib/engine4';
import type {
  Level,
  StructureProblem,
  StructureRead,
  ZoneInput,
} from '@/lib/engine4';

const r = (text: string): Rational => Rational.of(text);

const lv = (
  name: string,
  tf: 'M5' | 'M15',
  price: string,
  origin: Level['origin'] = 'sr_levels'
): Level => ({ name, tf, price: r(price), origin });

const prices = (options: ReturnType<typeof stopOptions>): string[] =>
  options.map((o) => o.stopPrice.toString());

describe('stop options for a BUY', () => {
  const levels = [
    lv('a', 'M5', '99'),
    lv('b', 'M5', '90'),
    lv('c', 'M15', '80'),
    lv('d', 'M15', '50'),
    lv('above', 'M5', '120'),
  ];

  test('every level on the stop side whose stop, $0.50 beyond it, is at least Min SLD away, nearest first', () => {
    const options = stopOptions(levels, {
      side: 'BUY',
      entry: '100',
      minSld: '13',
    });
    expect(prices(options)).toEqual(['79.5', '49.5']);
    expect(options.map((o) => o.stopDistance.toString())).toEqual([
      '20.5',
      '50.5',
    ]);
    expect(options.map((o) => o.level.name)).toEqual(['c', 'd']);
  });

  test('a stop exactly at Min SLD qualifies, a cent short does not', () => {
    // a level at 86.50 puts the stop at 86.00: exactly 14 from 100
    expect(
      prices(
        stopOptions([lv('x', 'M5', '86.5')], {
          side: 'BUY',
          entry: '100',
          minSld: '14',
        })
      )
    ).toEqual(['86']);
    expect(
      stopOptions([lv('x', 'M5', '86.51')], {
        side: 'BUY',
        entry: '100',
        minSld: '14',
      })
    ).toEqual([]);
    // and for the floor of 13: a level 13.50 below the entry
    expect(
      prices(
        stopOptions([lv('x', 'M5', '86.5')], {
          side: 'BUY',
          entry: '100',
          minSld: '13.5',
        })
      )
    ).toEqual(['86']);
  });

  test('a smaller Min SLD lets nearer levels in', () => {
    const options = stopOptions(levels, {
      side: 'BUY',
      entry: '100',
      minSld: '5',
    });
    expect(prices(options)).toEqual(['89.5', '79.5', '49.5']);
    expect(
      prices(stopOptions(levels, { side: 'BUY', entry: '100', minSld: '0.5' }))
    ).toEqual(['98.5', '89.5', '79.5', '49.5']);
  });

  test('a larger Min SLD takes the nearer ones out', () => {
    expect(
      prices(stopOptions(levels, { side: 'BUY', entry: '100', minSld: '30' }))
    ).toEqual(['49.5']);
    expect(
      stopOptions(levels, { side: 'BUY', entry: '100', minSld: '200' })
    ).toEqual([]);
  });

  test('a level at the entry, or on the other side of it, is no stop', () => {
    expect(
      stopOptions([lv('at', 'M5', '100'), lv('up', 'M5', '150')], {
        side: 'BUY',
        entry: '100',
        minSld: '0.5',
      })
    ).toEqual([]);
  });

  test('a SELL: a level at the entry, or below it, is no stop', () => {
    expect(
      stopOptions([lv('at', 'M5', '100'), lv('down', 'M5', '50')], {
        side: 'SELL',
        entry: '100',
        minSld: '0.5',
      })
    ).toEqual([]);
  });

  test('the order the levels come in does not matter', () => {
    const forward = stopOptions(levels, {
      side: 'BUY',
      entry: '100',
      minSld: '13',
    });
    const backward = stopOptions([...levels].reverse(), {
      side: 'BUY',
      entry: '100',
      minSld: '13',
    });
    expect(prices(backward)).toEqual(prices(forward));
  });

  test('levels are taken in cents, and the stop is $0.50 beyond the rounded level', () => {
    const options = stopOptions([lv('x', 'M5', '79.996')], {
      side: 'BUY',
      entry: '100',
      minSld: '13',
    });
    // 79.996 is 80.00 in cents
    expect(prices(options)).toEqual(['79.5']);
  });

  test('two levels at one price give one option, both named', () => {
    const options = stopOptions(
      [
        lv('sr_3', 'M15', '80'),
        lv('LOEDT', 'M5', '80', 'MCD2'),
        lv('sr_9', 'M5', '80', 'sr2_levels'),
      ],
      { side: 'BUY', entry: '100', minSld: '13' }
    );
    expect(options).toHaveLength(1);
    // M15 sorts before M5 as text
    expect(options[0]?.level).toMatchObject({ tf: 'M15', name: 'sr_3' });
    expect(options[0]?.alsoAt.map((l) => l.name).sort()).toEqual([
      'LOEDT',
      'sr_9',
    ]);
  });

  test('the level named at a shared price does not depend on the order the levels come in', () => {
    const forward = [
      lv('LOEDT', 'M5', '80', 'MCD2'),
      lv('sr_9', 'M5', '80', 'sr2_levels'),
      lv('sr_3', 'M15', '80'),
    ];
    for (const levels of [forward, [...forward].reverse()]) {
      const [option] = stopOptions(levels, {
        side: 'BUY',
        entry: '100',
        minSld: '13',
      });
      expect(option?.level).toMatchObject({ tf: 'M15', name: 'sr_3' });
      expect(option?.alsoAt.map((l) => l.name).sort()).toEqual([
        'LOEDT',
        'sr_9',
      ]);
    }
  });

  test('a stop that would sit at or below zero is not offered', () => {
    expect(
      stopOptions([lv('x', 'M5', '0.3'), lv('y', 'M5', '0.5')], {
        side: 'BUY',
        entry: '20',
        minSld: '13',
      })
    ).toEqual([]);
    expect(
      prices(
        stopOptions([lv('y', 'M5', '0.51')], {
          side: 'BUY',
          entry: '20',
          minSld: '13',
        })
      )
    ).toEqual(['0.01']);
  });

  test('the buffer is $0.50 unless told otherwise', () => {
    expect(
      prices(
        stopOptions([lv('x', 'M5', '80')], {
          side: 'BUY',
          entry: '100',
          minSld: '13',
          buffer: '1',
        })
      )
    ).toEqual(['79']);
    expect(
      prices(
        stopOptions([lv('x', 'M5', '80')], {
          side: 'BUY',
          entry: '100',
          minSld: '13',
          buffer: '0',
        })
      )
    ).toEqual(['80']);
  });

  test('the levels handed in are not changed', () => {
    const copy = JSON.stringify(levels);
    stopOptions(levels, { side: 'BUY', entry: '100', minSld: '13' });
    expect(JSON.stringify(levels)).toBe(copy);
  });
});

describe('stop options for a SELL mirror those of a BUY', () => {
  test('levels above the entry, the stop $0.50 above the level', () => {
    const levels = [
      lv('a', 'M5', '101'),
      lv('b', 'M5', '110'),
      lv('c', 'M15', '120'),
      lv('d', 'M15', '150'),
      lv('below', 'M5', '80'),
    ];
    const options = stopOptions(levels, {
      side: 'SELL',
      entry: '100',
      minSld: '13',
    });
    expect(prices(options)).toEqual(['120.5', '150.5']);
    expect(options.map((o) => o.stopDistance.toString())).toEqual([
      '20.5',
      '50.5',
    ]);
  });

  test('exactly Min SLD qualifies and a cent short does not', () => {
    expect(
      prices(
        stopOptions([lv('x', 'M5', '113.5')], {
          side: 'SELL',
          entry: '100',
          minSld: '14',
        })
      )
    ).toEqual(['114']);
    expect(
      stopOptions([lv('x', 'M5', '113.49')], {
        side: 'SELL',
        entry: '100',
        minSld: '14',
      })
    ).toEqual([]);
  });
});

describe('stop options refuse what is not a price', () => {
  test.each([
    [{ entry: '0', minSld: '13' }],
    [{ entry: 'x', minSld: '13' }],
    [{ entry: '100', minSld: '0' }],
    [{ entry: '100', minSld: '-1' }],
    [{ entry: '100', minSld: '13', buffer: '-1' }],
  ])('%j', (input) => {
    expect(() => stopOptions([], { side: 'BUY', ...input })).toThrow(
      Engine4InputError
    );
  });
});

describe('the modal shows the nearest three, the rest under "more levels" (D7 (b))', () => {
  const six = stopOptions(
    [20, 30, 40, 50, 60, 70].map((n) => lv(`l${n}`, 'M5', String(100 - n))),
    { side: 'BUY', entry: '100', minSld: '13' }
  );

  test('six options split three and three', () => {
    expect(six).toHaveLength(6);
    const { primary, more } = groupStopOptions(six);
    expect(primary.map((o) => o.level.name)).toEqual(['l20', 'l30', 'l40']);
    expect(more.map((o) => o.level.name)).toEqual(['l50', 'l60', 'l70']);
  });

  test('fewer than three have nothing under "more"', () => {
    expect(groupStopOptions(six.slice(0, 2))).toMatchObject({
      primary: expect.any(Array),
      more: [],
    });
    expect(groupStopOptions([])).toEqual({ primary: [], more: [] });
  });

  test('the count can be changed', () => {
    expect(groupStopOptions(six, 1).primary).toHaveLength(1);
    expect(groupStopOptions(six, 1).more).toHaveLength(5);
  });
});

describe("the zone builder's invalidation, rebuilt (ADR-032, D7 (a))", () => {
  const longZone = {
    bias: 'LONG' as const,
    low: r('4340'),
    high: r('4352'),
    referencePrice: r('4346'),
  };
  const shortZone = {
    bias: 'SHORT' as const,
    low: r('4400'),
    high: r('4412'),
    referencePrice: r('4406'),
  };

  test('LONG: $0.50 below the nearest level strictly below the zone', () => {
    const got = zoneInvalidation(
      [
        lv('far', 'M15', '4300'),
        lv('near', 'M15', '4320'),
        lv('in', 'M5', '4345'),
      ],
      longZone
    );
    expect(got.basis).toBe('LEVEL');
    expect(got.price.toString()).toBe('4319.5');
    expect(got.level?.name).toBe('near');
    expect(got.stopDistance.toString()).toBe('26.5');
  });

  test('SHORT: $0.50 above the nearest level strictly above the zone', () => {
    const got = zoneInvalidation(
      [
        lv('far', 'M15', '4450'),
        lv('near', 'M15', '4432'),
        lv('in', 'M5', '4407'),
      ],
      shortZone
    );
    expect(got.basis).toBe('LEVEL');
    expect(got.price.toString()).toBe('4432.5');
    expect(got.stopDistance.toString()).toBe('26.5');
  });

  test('a level inside the zone, or on its edge, is not past it', () => {
    const got = zoneInvalidation(
      [
        lv('edge', 'M5', '4340'),
        lv('in', 'M5', '4341'),
        lv('past', 'M15', '4300'),
      ],
      longZone
    );
    expect(got.level?.name).toBe('past');
    expect(got.price.toString()).toBe('4299.5');
  });

  test('a level that is too close raises the stop to exactly $13 from the reference price', () => {
    const got = zoneInvalidation([lv('close', 'M5', '4338')], longZone);
    // 4338 - 0.50 is 8.50 from the reference price
    expect(got.basis).toBe('MINIMUM_STOP');
    expect(got.price.toString()).toBe('4333');
    expect(got.stopDistance.toString()).toBe('13');
    // the level is still named: it is the one that was too close
    expect(got.level?.name).toBe('close');
  });

  test('with no level past the zone the stop is exactly $13', () => {
    const got = zoneInvalidation([lv('up', 'M5', '4376')], longZone);
    expect(got.basis).toBe('NO_LEVEL');
    expect(got.price.toString()).toBe('4333');
    expect(got.level).toBeNull();
    const short = zoneInvalidation([lv('down', 'M5', '4376')], shortZone);
    expect(short.basis).toBe('NO_LEVEL');
    expect(short.price.toString()).toBe('4419');
  });

  test('the floor is kept at exactly $13 and lost a cent short', () => {
    // a level at 4332.50 puts the stop at 4332.00: 14 from the reference price 4346
    const keeps = zoneInvalidation([lv('x', 'M5', '4332.5')], longZone);
    expect(keeps.basis).toBe('LEVEL');
    expect(keeps.price.toString()).toBe('4332');
    expect(keeps.stopDistance.toString()).toBe('14');
    // a level at 4333.50 puts the stop at 4333.00: exactly 13, which is allowed
    const exact = zoneInvalidation([lv('x', 'M5', '4333.5')], longZone);
    expect(exact.basis).toBe('LEVEL');
    expect(exact.price.toString()).toBe('4333');
    expect(exact.stopDistance.toString()).toBe('13');
    // a cent nearer would be 12.99: the stop is raised to exactly 13 and the basis says so
    const short = zoneInvalidation([lv('x', 'M5', '4333.51')], longZone);
    expect(short.basis).toBe('MINIMUM_STOP');
    expect(short.price.toString()).toBe('4333');
    expect(short.stopDistance.toString()).toBe('13');
  });

  test("SHORT: a level on the zone's edge is not past it either", () => {
    const got = zoneInvalidation(
      [
        lv('edge', 'M5', '4412'),
        lv('in', 'M5', '4411'),
        lv('past', 'M15', '4450'),
      ],
      shortZone
    );
    expect(got.level?.name).toBe('past');
    expect(got.price.toString()).toBe('4450.5');
  });

  test('a reference price with a part of a cent: the invalidation is put in cents, half up', () => {
    const below = zoneInvalidation([lv('up', 'M5', '4376')], {
      ...longZone,
      referencePrice: r('4346.004'),
    });
    // 4346.004 - 13 = 4333.004, which is 4333.00 in cents
    expect(below.price.toString()).toBe('4333');
    expect(below.stopDistance.toString()).toBe('13.004');
    const half = zoneInvalidation([lv('up', 'M5', '4376')], {
      ...longZone,
      referencePrice: r('4346.005'),
    });
    expect(half.price.toString()).toBe('4333.01');
  });

  test('the price is rounded to cents', () => {
    const got = zoneInvalidation([lv('x', 'M5', '4300.004')], longZone);
    expect(got.price.toString()).toBe('4299.5');
  });
});

// ---------------------------------------------------------------------------
// The choices handed to the modal
// ---------------------------------------------------------------------------

const BASE_LEVELS: Level[] = [
  lv('LOEDT', 'M5', '4346', 'MCD2'),
  lv('baseline', 'M5', '4376', 'MCD2'),
  lv('LOEDT', 'M15', '4320', 'MCD1'),
  lv('sr_3', 'M15', '4300'),
];

function zone(overrides: Record<string, unknown> = {}): ZoneInput {
  const parsed = zoneFromStored({
    zone_id: 'Z1',
    rank: 1,
    bias: 'LONG',
    low: 4340,
    high: 4352,
    reference_price: 4346,
    invalidation_price: 4319.5,
    invalidation_basis: 'LEVEL',
    invalidation_level: {
      name: 'LOEDT',
      tf: 'M15',
      price: 4320,
      origin: 'MCD1',
    },
    stop_distance: 26.5,
    next_opposing_level: {
      name: 'baseline',
      tf: 'M5',
      price: 4376,
      origin: 'MCD2',
    },
    runway: 30,
    runway_ratio: 1.13,
    ...overrides,
  });
  if (parsed === null) throw new Error('the test zone is not well formed');
  return parsed;
}

const complete = (levels: Level[]): StructureRead => ({
  complete: true,
  levels,
  problems: [],
});

const unreadable = (code: StructureProblem['code']): StructureRead => ({
  complete: false,
  levels: [],
  problems: [{ code, detail: 'test' }],
});

describe('a zone that agrees with its levels', () => {
  test('has no disagreement', () => {
    expect(zoneDisagreement(BASE_LEVELS, zone())).toEqual([]);
  });

  test.each([
    [
      'the invalidation price',
      { invalidation_price: 4319.6 },
      /invalidation 4319.6/,
    ],
    ['the basis', { invalidation_basis: 'MINIMUM_STOP' }, /basis MINIMUM_STOP/],
    [
      'the level behind it',
      {
        invalidation_level: {
          name: 'LOEDT',
          tf: 'M5',
          price: 4320,
          origin: 'MCD1',
        },
      },
      /level behind the invalidation/,
    ],
    ['the stop distance', { stop_distance: 26.6 }, /stop distance differs/],
    [
      'the next opposing level',
      {
        next_opposing_level: {
          name: 'baseline',
          tf: 'M5',
          price: 4377,
          origin: 'MCD2',
        },
      },
      /next opposing level differs/,
    ],
    ['the runway', { runway: 31 }, /runway differs/],
    ['the runway ratio', { runway_ratio: 1.14 }, /runway ratio differs/],
  ])('is caught when %s differs', (_what, change, message) => {
    const problems = zoneDisagreement(BASE_LEVELS, zone(change));
    expect(problems.join('|')).toMatch(message);
  });

  test('a zone with a runway where the levels have no opposing level is caught', () => {
    const noUp = BASE_LEVELS.filter((l) => l.name !== 'baseline');
    expect(zoneDisagreement(noUp, zone()).join('|')).toMatch(
      /next opposing level differs/
    );
    expect(
      zoneDisagreement(
        noUp,
        zone({ next_opposing_level: null, runway: 30, runway_ratio: 1.13 })
      ).join('|')
    ).toMatch(/runway but the levels give no opposing level/);
    expect(
      zoneDisagreement(
        noUp,
        zone({ next_opposing_level: null, runway: null, runway_ratio: null })
      )
    ).toEqual([]);
    // either figure alone is enough to be caught
    for (const alone of [
      { runway: 30, runway_ratio: null },
      { runway: null, runway_ratio: 1.13 },
    ]) {
      expect(
        zoneDisagreement(
          noUp,
          zone({ next_opposing_level: null, ...alone })
        ).join('|')
      ).toMatch(/runway but the levels give no opposing level/);
    }
  });
});

describe('the stop choices of a zone whose levels were read', () => {
  const read = complete(BASE_LEVELS);

  test("every structural option, nearest first, plus the zone's own invalidation pre-selected", () => {
    const choices = buildStopChoices({
      zone: zone(),
      entry: '4346',
      minSld: '13',
      structure: read,
    });
    expect(choices.mode).toBe('STRUCTURE');
    expect(choices.degradedBy).toEqual([]);
    expect(choices.structural.map((o) => o.stopPrice.toString())).toEqual([
      '4319.5',
      '4299.5',
    ]);
    expect(choices.minimumStop).toBeNull();
    expect(choices.custom.minDistance.toString()).toBe('13');
    expect(choices.preselected).toMatchObject({
      kind: 'ZONE_INVALIDATION',
    });
    if (choices.preselected.kind === 'ZONE_INVALIDATION') {
      expect(choices.preselected.stopPrice.toString()).toBe('4319.5');
      expect(choices.preselected.stopDistance.toString()).toBe('26.5');
      expect(choices.preselected.option?.level.name).toBe('LOEDT');
    }
  });

  test('the option beside the invalidation is found by its price, not taken as the first', () => {
    // a level inside the zone, below the entry, is a nearer option than the zone's own stop
    const levels = [...BASE_LEVELS, lv('inside', 'M5', '4342')];
    expect(zoneDisagreement(levels, zone())).toEqual([]);
    const choices = buildStopChoices({
      zone: zone(),
      entry: '4346',
      minSld: '3',
      structure: complete(levels),
    });
    expect(choices.structural.map((o) => o.stopPrice.toString())).toEqual([
      '4341.5',
      '4319.5',
      '4299.5',
    ]);
    expect(choices.preselected.kind).toBe('ZONE_INVALIDATION');
    if (choices.preselected.kind === 'ZONE_INVALIDATION') {
      expect(choices.preselected.option).toBe(choices.structural[1]);
      expect(choices.preselected.option?.stopPrice.toString()).toBe('4319.5');
    }
  });

  test("a Min SLD above the zone's stop pre-selects the nearest option that is far enough", () => {
    const choices = buildStopChoices({
      zone: zone(),
      entry: '4346',
      minSld: '30',
      structure: read,
    });
    expect(choices.structural.map((o) => o.stopPrice.toString())).toEqual([
      '4299.5',
    ]);
    expect(choices.preselected.kind).toBe('NEAREST_OPTION');
    if (choices.preselected.kind === 'NEAREST_OPTION') {
      expect(choices.preselected.option.stopPrice.toString()).toBe('4299.5');
    }
  });

  test('a Min SLD above every option leaves only a custom stop', () => {
    const choices = buildStopChoices({
      zone: zone(),
      entry: '4346',
      minSld: '100',
      structure: read,
    });
    expect(choices.structural).toEqual([]);
    expect(choices.preselected).toEqual({ kind: 'CUSTOM_REQUIRED' });
    expect(choices.custom.minDistance.toString()).toBe('100');
  });

  test('another entry price: the stored invalidation is measured from it', () => {
    const choices = buildStopChoices({
      zone: zone(),
      entry: '4350',
      minSld: '13',
      structure: read,
    });
    expect(choices.preselected).toMatchObject({ kind: 'ZONE_INVALIDATION' });
    if (choices.preselected.kind === 'ZONE_INVALIDATION') {
      expect(choices.preselected.stopDistance.toString()).toBe('30.5');
    }
  });

  test('an entry at or beyond the invalidation cannot pre-select it', () => {
    const choices = buildStopChoices({
      zone: zone(),
      entry: '4310',
      minSld: '13',
      structure: read,
    });
    expect(choices.preselected.kind).not.toBe('ZONE_INVALIDATION');
  });

  test('a MINIMUM_STOP invalidation is the minimum stop, never a structural level', () => {
    const levels = [...BASE_LEVELS, lv('close', 'M5', '4338')];
    const minimum = zone({
      invalidation_price: 4333,
      invalidation_basis: 'MINIMUM_STOP',
      invalidation_level: {
        name: 'close',
        tf: 'M5',
        price: 4338,
        origin: 'sr_levels',
      },
      stop_distance: 13,
      runway_ratio: 2.31,
    });
    expect(zoneDisagreement(levels, minimum)).toEqual([]);
    const choices = buildStopChoices({
      zone: minimum,
      entry: '4346',
      minSld: '13',
      structure: complete(levels),
    });
    expect(choices.mode).toBe('STRUCTURE');
    expect(choices.minimumStop?.stopPrice.toString()).toBe('4333');
    expect(choices.preselected.kind).toBe('MINIMUM_STOP');
    // the level too close is not an option: its own stop is 8.5 away
    expect(choices.structural.map((o) => o.stopPrice.toString())).toEqual([
      '4319.5',
      '4299.5',
    ]);
    // with a larger Min SLD the minimum stop is no longer enough, and the nearest option takes over
    const wider = buildStopChoices({
      zone: minimum,
      entry: '4346',
      minSld: '20',
      structure: complete(levels),
    });
    expect(wider.minimumStop).toBeNull();
    expect(wider.preselected.kind).toBe('NEAREST_OPTION');
  });

  test('a NO_LEVEL invalidation is the minimum stop too', () => {
    const levels = BASE_LEVELS.filter((l) => l.price.gt(r('4340')));
    const none = zone({
      invalidation_price: 4333,
      invalidation_basis: 'NO_LEVEL',
      invalidation_level: null,
      stop_distance: 13,
      runway_ratio: 2.31,
    });
    const choices = buildStopChoices({
      zone: none,
      entry: '4346',
      minSld: '13',
      structure: complete(levels),
    });
    expect(choices.mode).toBe('STRUCTURE');
    expect(choices.structural).toEqual([]);
    expect(choices.preselected.kind).toBe('MINIMUM_STOP');
  });

  test('a SHORT zone whose stored stop is nearer than Min SLD is not pre-selected', () => {
    const levels: Level[] = [
      lv('UOEDT', 'M5', '4406', 'MCD2'),
      lv('baseline', 'M5', '4376', 'MCD2'),
      lv('UOEDT', 'M15', '4432', 'MCD1'),
      lv('sr_3', 'M15', '4450'),
    ];
    const short = zone({
      bias: 'SHORT',
      low: 4400,
      high: 4412,
      reference_price: 4406,
      invalidation_price: 4432.5,
      invalidation_level: {
        name: 'UOEDT',
        tf: 'M15',
        price: 4432,
        origin: 'MCD1',
      },
      stop_distance: 26.5,
      next_opposing_level: {
        name: 'baseline',
        tf: 'M5',
        price: 4376,
        origin: 'MCD2',
      },
      runway: 30,
      runway_ratio: 1.13,
    });
    const choices = buildStopChoices({
      zone: short,
      entry: '4406',
      minSld: '30',
      structure: complete(levels),
    });
    // 26.5 is under 30: the next option, 44.5 away, is pre-selected
    expect(choices.preselected.kind).toBe('NEAREST_OPTION');
    expect(choices.structural.map((o) => o.stopPrice.toString())).toEqual([
      '4450.5',
    ]);
    // and an entry beyond the stored stop cannot use it
    const beyond = buildStopChoices({
      zone: short,
      entry: '4440',
      minSld: '13',
      structure: complete(levels),
    });
    expect(beyond.preselected.kind).not.toBe('ZONE_INVALIDATION');
  });

  test('a SHORT zone mirrors a LONG one', () => {
    const levels: Level[] = [
      lv('UOEDT', 'M5', '4406', 'MCD2'),
      lv('baseline', 'M5', '4376', 'MCD2'),
      lv('UOEDT', 'M15', '4432', 'MCD1'),
      lv('sr_3', 'M15', '4450'),
    ];
    const short = zone({
      bias: 'SHORT',
      low: 4400,
      high: 4412,
      reference_price: 4406,
      invalidation_price: 4432.5,
      invalidation_level: {
        name: 'UOEDT',
        tf: 'M15',
        price: 4432,
        origin: 'MCD1',
      },
      stop_distance: 26.5,
      next_opposing_level: {
        name: 'baseline',
        tf: 'M5',
        price: 4376,
        origin: 'MCD2',
      },
      runway: 30,
      runway_ratio: 1.13,
    });
    expect(zoneDisagreement(levels, short)).toEqual([]);
    const choices = buildStopChoices({
      zone: short,
      entry: '4406',
      minSld: '13',
      structure: complete(levels),
    });
    expect(choices.structural.map((o) => o.stopPrice.toString())).toEqual([
      '4432.5',
      '4450.5',
    ]);
    expect(choices.preselected.kind).toBe('ZONE_INVALIDATION');
  });
});

describe('degradation is explicit', () => {
  test.each([
    'BUNDLE_MISSING',
    'BUNDLE_EXPIRED',
    'BUNDLE_TAMPERED',
    'SENSOR_READING_TAMPERED',
    'NO_SENSOR_READINGS',
  ] as const)(
    "%s: only the zone's own invalidation, and the reason",
    (code) => {
      const choices = buildStopChoices({
        zone: zone(),
        entry: '4346',
        minSld: '13',
        structure: unreadable(code),
      });
      expect(choices.mode).toBe('DEGRADED');
      expect(choices.degradedBy.map((p) => p.code)).toEqual([code]);
      expect(choices.structural).toHaveLength(1);
      expect(choices.structural[0]?.stopPrice.toString()).toBe('4319.5');
      expect(choices.structural[0]?.level.name).toBe('LOEDT');
      expect(choices.preselected.kind).toBe('ZONE_INVALIDATION');
      expect(choices.custom.minDistance.toString()).toBe('13');
    }
  );

  test("it never guesses a level: with a Min SLD above the zone's stop nothing is offered but a custom stop", () => {
    const choices = buildStopChoices({
      zone: zone(),
      entry: '4346',
      minSld: '30',
      structure: unreadable('BUNDLE_MISSING'),
    });
    expect(choices.mode).toBe('DEGRADED');
    expect(choices.structural).toEqual([]);
    expect(choices.preselected).toEqual({ kind: 'CUSTOM_REQUIRED' });
  });

  test('a MINIMUM_STOP zone that names the too-close level degrades to the minimum stop, not to that level', () => {
    const minimum = zone({
      invalidation_price: 4333,
      invalidation_basis: 'MINIMUM_STOP',
      invalidation_level: {
        name: 'close',
        tf: 'M5',
        price: 4338,
        origin: 'sr_levels',
      },
      stop_distance: 13,
      runway_ratio: 2.31,
    });
    const choices = buildStopChoices({
      zone: minimum,
      entry: '4346',
      minSld: '13',
      structure: unreadable('BUNDLE_MISSING'),
    });
    expect(choices.mode).toBe('DEGRADED');
    expect(choices.structural).toEqual([]);
    expect(choices.minimumStop?.stopPrice.toString()).toBe('4333');
    expect(choices.preselected.kind).toBe('MINIMUM_STOP');
  });

  test('a minimum-stop zone degrades to the minimum stop', () => {
    const none = zone({
      invalidation_price: 4333,
      invalidation_basis: 'NO_LEVEL',
      invalidation_level: null,
      stop_distance: 13,
    });
    const choices = buildStopChoices({
      zone: none,
      entry: '4346',
      minSld: '13',
      structure: unreadable('BUNDLE_EXPIRED'),
    });
    expect(choices.mode).toBe('DEGRADED');
    expect(choices.structural).toEqual([]);
    expect(choices.preselected.kind).toBe('MINIMUM_STOP');
  });

  test('every problem found is passed on', () => {
    const many: StructureRead = {
      complete: false,
      levels: [],
      problems: [
        { code: 'BUNDLE_TAMPERED', detail: 'a' },
        { code: 'SENSOR_READING_MISMATCH', detail: 'b', mcdId: 'MCD2' },
      ],
    };
    const choices = buildStopChoices({
      zone: zone(),
      entry: '4346',
      minSld: '13',
      structure: many,
    });
    expect(choices.degradedBy).toEqual(many.problems);
  });

  test("levels that are not the zone's levels degrade it too", () => {
    // the 4320 level is missing: the levels give NO_LEVEL where the zone says LEVEL
    const wrong = complete(BASE_LEVELS.filter((l) => !l.price.eq(r('4320'))));
    const choices = buildStopChoices({
      zone: zone(),
      entry: '4346',
      minSld: '13',
      structure: wrong,
    });
    expect(choices.mode).toBe('DEGRADED');
    expect(choices.degradedBy.map((p) => p.code)).toEqual([
      'ZONE_DISAGREES_WITH_LEVELS',
    ]);
    expect(choices.degradedBy[0]?.detail).toMatch(/invalidation/);
    expect(choices.structural).toHaveLength(1);
    expect(choices.structural[0]?.stopPrice.toString()).toBe('4319.5');
  });

  test('a read that is complete but empty of levels cannot back a LEVEL zone', () => {
    const choices = buildStopChoices({
      zone: zone(),
      entry: '4346',
      minSld: '13',
      structure: complete([]),
    });
    expect(choices.mode).toBe('DEGRADED');
  });

  test('it refuses an entry or a Min SLD that is not a price', () => {
    expect(() =>
      buildStopChoices({
        zone: zone(),
        entry: '0',
        minSld: '13',
        structure: complete(BASE_LEVELS),
      })
    ).toThrow(Engine4InputError);
    expect(() =>
      buildStopChoices({
        zone: zone(),
        entry: '4346',
        minSld: '-1',
        structure: complete(BASE_LEVELS),
      })
    ).toThrow(Engine4InputError);
  });
});

describe('a stored zone is read strictly', () => {
  const good = {
    zone_id: 'Z2',
    rank: 2,
    bias: 'SHORT',
    low: 4400,
    high: 4412,
    reference_price: 4406,
    invalidation_price: 4432.5,
    invalidation_basis: 'LEVEL',
    invalidation_level: {
      name: 'UOEDT',
      tf: 'M15',
      price: 4432,
      origin: 'MCD1',
    },
    stop_distance: 26.5,
    next_opposing_level: null,
    runway: null,
    runway_ratio: null,
  };

  test('a well-formed zone, with nothing beyond its entry', () => {
    const parsed = zoneFromStored(good);
    expect(parsed?.zoneId).toBe('Z2');
    expect(parsed?.nextOpposingLevel).toBeNull();
    expect(parsed?.runway).toBeNull();
  });

  test.each([
    ['a zone id that is not Z1 to Z5', { zone_id: 'Z6' }],
    ['a sixth zone', { zone_id: 'Z6', rank: 6 }],
    ['a zone Z0', { zone_id: 'Z0', rank: 0 }],
    ['a zone Z10', { zone_id: 'Z10', rank: 10 }],
    ['a zone id that is only a number', { zone_id: '2', rank: 2 }],
    [
      'an opposing level that is not a level',
      { next_opposing_level: { name: 'x' } },
    ],
    ["a rank that is not the id's", { rank: 3 }],
    ['a bias that is not a direction', { bias: 'NEUTRAL' }],
    ['a basis that is unknown', { invalidation_basis: 'GUESS' }],
    ['a low of zero', { low: 0 }],
    ['a price in text', { reference_price: '4406' }],
    ['a missing stop distance', { stop_distance: undefined }],
    [
      'an invalidation level that is not a level',
      { invalidation_level: { name: 'x' } },
    ],
    [
      'a runway that is not a number',
      { runway: 'x', next_opposing_level: null },
    ],
    ['a ratio that is not a number', { runway_ratio: 'x' }],
  ])('%s reads as null', (_why, change) => {
    expect(zoneFromStored({ ...good, ...change })).toBeNull();
  });

  test.each([null, undefined, 'Z1', 5, []])('%j reads as null', (value) => {
    expect(zoneFromStored(value)).toBeNull();
  });
});
