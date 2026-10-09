/**
 * @jest-environment node
 */

import { readFileSync } from 'fs';
import { join } from 'path';

import {
  Rational,
  SR_NAMES,
  ZONES_1,
  compareLevels,
  decimalOrNull,
  dedupeLevels,
  isAvailableReading,
  levelFromStored,
  levelsFromReadings,
  nearestLevel,
  sameLevel,
  srLevelsFromContext,
  toStructure,
} from '@/lib/engine4';
import type { Level } from '@/lib/engine4';

import { WORKER } from './helpers/stored';

const r = (text: string): Rational => Rational.of(text);

const lv = (
  name: string,
  tf: 'M5' | 'M15',
  price: string,
  origin: Level['origin'] = 'MCD2'
): Level => ({ name, tf, price: r(price), origin });

const reading = (
  status: string,
  levels: unknown,
  extra: Record<string, unknown> = {}
) => ({
  status,
  state_code: 'MCD2_UP_IN_CORRIDOR',
  regime_status: 'TREND_ALIGNED_CONTINUATION',
  bias: 'LONG',
  levels,
  ...extra,
});

const raw = (name: string, tf: string, price: unknown) => ({
  name,
  tf,
  price,
  role: 'x',
});

const text = (levels: Level[]): string[] =>
  levels.map(
    (level) =>
      `${level.origin}:${level.tf}:${level.name}:${level.price.toString()}`
  );

describe('which readings may give levels (the twin of view_of)', () => {
  test.each(['VALID', 'CAUTIONARY'])('%s gives levels', (status) => {
    expect(isAvailableReading(reading(status, []))).toBe(true);
  });

  test.each(['INVALID', 'STALE', 'ABSENT', 'valid', '', 5, null])(
    'status %j gives none',
    (status) => {
      expect(isAvailableReading(reading(status as string, []))).toBe(false);
    }
  );

  test('a missing or malformed field makes the reading unusable', () => {
    const base = reading('VALID', []);
    expect(isAvailableReading({ ...base, state_code: undefined })).toBe(false);
    expect(isAvailableReading({ ...base, state_code: 5 })).toBe(false);
    expect(isAvailableReading({ ...base, bias: 'UP' })).toBe(false);
    expect(isAvailableReading({ ...base, bias: undefined })).toBe(false);
    expect(isAvailableReading({ ...base, regime_status: 5 })).toBe(false);
  });

  test('a missing or null regime word is fine, and every bias word is', () => {
    expect(
      isAvailableReading({ ...reading('VALID', []), regime_status: null })
    ).toBe(true);
    const { regime_status: _dropped, ...without } = reading('VALID', []);
    expect(isAvailableReading(without)).toBe(true);
    for (const bias of ['LONG', 'SHORT', 'NEUTRAL', 'STAND_ASIDE']) {
      expect(isAvailableReading({ ...reading('VALID', []), bias })).toBe(true);
    }
  });

  test.each([null, undefined, 'VALID', 5, [], [{ status: 'VALID' }]])(
    '%j is not a reading',
    (value) => {
      expect(isAvailableReading(value)).toBe(false);
    }
  );
});

describe('channel levels from the readings (levels_from_readings)', () => {
  test('every available sensor in sensor order, each level with its sensor as origin', () => {
    const levels = levelsFromReadings({
      MCD2: reading('VALID', [raw('LOEDT', 'M5', 4350.16)]),
      MCD1: reading('CAUTIONARY', [
        raw('UOEDT', 'M15', 4279.46),
        raw('baseline', 'M15', 4214.17),
      ]),
    });
    expect(text(levels)).toEqual([
      'MCD1:M15:UOEDT:4279.46',
      'MCD1:M15:baseline:4214.17',
      'MCD2:M5:LOEDT:4350.16',
    ]);
  });

  test('an INVALID or STALE sensor gives no level, an absent one neither', () => {
    const levels = levelsFromReadings({
      MCD1: reading('INVALID', [raw('UOEDT', 'M15', 4279.46)]),
      MCD2: reading('STALE', [raw('LOEDT', 'M5', 4350.16)]),
      MCD3: reading('VALID', [raw('baseline', 'M5', 4367.2)]),
    });
    expect(text(levels)).toEqual(['MCD3:M5:baseline:4367.2']);
    expect(levelsFromReadings({})).toEqual([]);
  });

  test('MCD3 repeats the levels of MCD1 and MCD2: each level counts once, the first sensor keeping it', () => {
    const levels = levelsFromReadings({
      MCD1: reading('VALID', [raw('UOEDT', 'M15', 4279.46)]),
      MCD2: reading('VALID', [raw('LOEDT', 'M5', 4350.16)]),
      MCD3: reading('VALID', [
        raw('UOEDT', 'M15', 4279.46),
        raw('LOEDT', 'M5', 4350.16),
        raw('LOEDT', 'M15', 4126.24),
      ]),
    });
    expect(text(levels)).toEqual([
      'MCD1:M15:UOEDT:4279.46',
      'MCD2:M5:LOEDT:4350.16',
      'MCD3:M15:LOEDT:4126.24',
    ]);
  });

  test('the same name at another price, or on another timeframe, is another level', () => {
    const levels = levelsFromReadings({
      MCD1: reading('VALID', [
        raw('UOEDT', 'M15', 4279.46),
        raw('UOEDT', 'M15', 4279.47),
        raw('UOEDT', 'M5', 4279.46),
      ]),
    });
    expect(levels).toHaveLength(3);
  });

  test.each([
    ['no name', raw('', 'M5', 1)],
    ['a name that is not text', { ...raw('x', 'M5', 1), name: 5 }],
    ['an unknown timeframe', raw('x', 'H1', 1)],
    ['no timeframe', { name: 'x', price: 1 }],
    ['a price of zero', raw('x', 'M5', 0)],
    ['a negative price', raw('x', 'M5', -1)],
    ['a price in text', raw('x', 'M5', '4350.16')],
    ['a price that is a boolean', raw('x', 'M5', true)],
    ['a null price', raw('x', 'M5', null)],
    ['no price', { name: 'x', tf: 'M5' }],
    ['not an object', 'x'],
    ['null', null],
  ])('a level with %s is skipped, the rest are kept', (_why, bad) => {
    const levels = levelsFromReadings({
      MCD2: reading('VALID', [bad, raw('ok', 'M5', 4000)]),
    });
    expect(text(levels)).toEqual(['MCD2:M5:ok:4000']);
  });

  test('a `levels` that is not a list gives nothing', () => {
    expect(levelsFromReadings({ MCD2: reading('VALID', 'oops') })).toEqual([]);
    expect(levelsFromReadings({ MCD2: reading('VALID', null) })).toEqual([]);
    expect(levelsFromReadings({ MCD2: reading('VALID', { a: 1 }) })).toEqual(
      []
    );
  });

  test('a price is read by its decimal text, and an integer is a price', () => {
    const [level] = levelsFromReadings({
      MCD2: reading('VALID', [raw('x', 'M5', 4350.165)]),
    });
    expect(level?.price.toString()).toBe('4350.165');
    expect(
      levelsFromReadings({
        MCD2: reading('VALID', [raw('x', 'M5', 4000)]),
      })[0]?.price.toString()
    ).toBe('4000');
  });
});

describe('support and resistance from context_levels (sr_levels_from_context)', () => {
  test('a slot that resolved no level is null and gives nothing', () => {
    const levels = srLevelsFromContext({
      M5: { sr_1: null, sr_2: null },
      M15: { sr_1: 4369.57, sr_2: null, sr_3: 4334.56 },
    });
    expect(text(levels)).toEqual([
      'sr_levels:M15:sr_1:4369.57',
      'sr_levels:M15:sr_3:4334.56',
    ]);
  });

  test('levels come in number order, not in the order the row lists them', () => {
    const levels = srLevelsFromContext({
      M5: { sr_10: 4010, sr_2: 4002, sr_9: 4009, sr_1: 4001 },
    });
    expect(levels.map((l) => l.name)).toEqual([
      'sr_1',
      'sr_2',
      'sr_9',
      'sr_10',
    ]);
  });

  test('sr_1 to sr_8 have the origin sr_levels, sr_9 to sr_16 sr2_levels', () => {
    const row: Record<string, number> = {};
    SR_NAMES.forEach((name, index) => {
      row[name] = 4000 + index;
    });
    const levels = srLevelsFromContext({ M5: row });
    expect(levels).toHaveLength(16);
    expect(levels.slice(0, 8).every((l) => l.origin === 'sr_levels')).toBe(
      true
    );
    expect(levels.slice(8).every((l) => l.origin === 'sr2_levels')).toBe(true);
    expect(SR_NAMES).toHaveLength(16);
  });

  test('the same slot at the same price on both timeframes is one level, M5 first', () => {
    const levels = srLevelsFromContext({
      M5: { sr_1: 4369.57 },
      M15: { sr_1: 4369.57, sr_2: 4369.57 },
    });
    expect(text(levels)).toEqual([
      'sr_levels:M5:sr_1:4369.57',
      'sr_levels:M15:sr_2:4369.57',
    ]);
  });

  test('the same slot at another price on the other timeframe is another level', () => {
    const levels = srLevelsFromContext({
      M5: { sr_1: 4369.57 },
      M15: { sr_1: 4369.58 },
    });
    expect(levels).toHaveLength(2);
  });

  test.each([
    ['a price in text', '4369.57'],
    ['zero', 0],
    ['a negative', -4],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['a boolean', true],
    ['an object', {}],
  ])('%s gives nothing', (_why, value) => {
    expect(srLevelsFromContext({ M5: { sr_1: value } })).toEqual([]);
  });

  test('names that are not sr_1 to sr_16 are ignored', () => {
    expect(
      srLevelsFromContext({
        M5: { sr_0: 1, sr_17: 2, sr_01: 3, SR_1: 4, other: 5, sr_: 6 },
      })
    ).toEqual([]);
  });

  test.each([
    null,
    undefined,
    'x',
    5,
    [],
    { M5: 'x' },
    { M5: null },
    { H1: {} },
  ])('a context of %j gives nothing', (context) => {
    expect(srLevelsFromContext(context)).toEqual([]);
  });
});

describe('the zone builder works in cents (toStructure)', () => {
  test('prices are rounded half up to two places', () => {
    const rounded = toStructure([
      lv('a', 'M5', '4350.165'),
      lv('b', 'M5', '4350.164'),
      lv('c', 'M5', '4350.1649999'),
      lv('d', 'M5', '4350.175'),
      lv('e', 'M5', '4350'),
    ]).map((l) => l.price.toString());
    expect(rounded).toEqual([
      '4350.17',
      '4350.16',
      '4350.16',
      '4350.18',
      '4350',
    ]);
  });

  test('two levels that become equal in cents are one', () => {
    const out = toStructure([
      lv('x', 'M5', '4350.161'),
      lv('x', 'M5', '4350.164'),
      lv('x', 'M15', '4350.164'),
    ]);
    expect(text(out)).toEqual(['MCD2:M5:x:4350.16', 'MCD2:M15:x:4350.16']);
  });

  test('it changes nothing the second time', () => {
    const once = toStructure([
      lv('a', 'M5', '4350.165'),
      lv('a', 'M5', '4350.164'),
      lv('b', 'M15', '1.005'),
    ]);
    expect(text(toStructure(once))).toEqual(text(once));
  });

  test('the parameters of zones-1', () => {
    expect(ZONES_1.version).toBe('zones-1');
    expect(ZONES_1.priceDecimals).toBe(2);
    expect(ZONES_1.ratioDecimals).toBe(2);
    expect(ZONES_1.invalidationBuffer.toString()).toBe('0.5');
    expect(ZONES_1.minStopDistance.toString()).toBe('13');
  });

  test('every figure of the twin is the one in zone_params.yaml', () => {
    const yaml = readFileSync(
      join(WORKER, 'synthesis', 'zone_params.yaml'),
      'utf8'
    );
    const value = (name: string): string => {
      const match = new RegExp(`\\n  ${name}:\\n    value: ([0-9.]+)`).exec(
        yaml
      );
      if (match === null || match[1] === undefined) throw new Error(name);
      return match[1];
    };
    expect(/zones_version: (zones-\d+)/.exec(yaml)?.[1]).toBe(ZONES_1.version);
    expect(r(value('invalidation_buffer')).eq(ZONES_1.invalidationBuffer)).toBe(
      true
    );
    expect(r(value('min_stop_distance')).eq(ZONES_1.minStopDistance)).toBe(
      true
    );
    expect(r(value('price_decimals')).toString()).toBe(
      String(ZONES_1.priceDecimals)
    );
    expect(r(value('ratio_decimals')).toString()).toBe(
      String(ZONES_1.ratioDecimals)
    );
  });
});

describe('helpers', () => {
  test('dedupeLevels keeps the first of each (timeframe, name, price)', () => {
    const out = dedupeLevels([
      lv('a', 'M5', '1', 'MCD1'),
      lv('a', 'M5', '1', 'MCD2'),
      lv('a', 'M5', '2', 'MCD2'),
      lv('b', 'M5', '1', 'MCD2'),
    ]);
    expect(text(out)).toEqual(['MCD1:M5:a:1', 'MCD2:M5:a:2', 'MCD2:M5:b:1']);
  });

  test('nearestLevel: highest or lowest price, and among equals the first by timeframe, name, origin', () => {
    const candidates = [
      lv('z', 'M5', '10'),
      lv('b', 'M5', '10'),
      lv('a', 'M5', '9'),
      lv('c', 'M15', '10'),
      lv('b', 'M5', '10', 'MCD1'),
    ];
    // "M15" sorts before "M5" as text, as it does in the Python
    expect(nearestLevel(candidates, true)).toMatchObject({
      tf: 'M15',
      name: 'c',
    });
    expect(nearestLevel(candidates, false)).toMatchObject({ name: 'a' });
    expect(nearestLevel(candidates.slice(0, 2), true)).toMatchObject({
      name: 'b',
    });
    expect(
      nearestLevel(
        [lv('b', 'M5', '10', 'MCD2'), lv('b', 'M5', '10', 'MCD1')],
        true
      )?.origin
    ).toBe('MCD1');
    expect(nearestLevel([], true)).toBeNull();
  });

  test('compareLevels orders by timeframe, then name, then origin', () => {
    expect(compareLevels(lv('a', 'M15', '1'), lv('a', 'M5', '1'))).toBe(-1);
    expect(compareLevels(lv('b', 'M5', '1'), lv('a', 'M5', '1'))).toBe(1);
    expect(
      compareLevels(lv('a', 'M5', '1', 'MCD1'), lv('a', 'M5', '9', 'MCD2'))
    ).toBe(-1);
    expect(compareLevels(lv('a', 'M5', '1'), lv('a', 'M5', '2'))).toBe(0);
  });

  test('sameLevel compares name, timeframe, origin and price', () => {
    const a = lv('a', 'M5', '1.50');
    expect(sameLevel(a, lv('a', 'M5', '1.5'))).toBe(true);
    expect(sameLevel(a, lv('b', 'M5', '1.5'))).toBe(false);
    expect(sameLevel(a, lv('a', 'M15', '1.5'))).toBe(false);
    expect(sameLevel(a, lv('a', 'M5', '1.5', 'MCD1'))).toBe(false);
    expect(sameLevel(a, lv('a', 'M5', '1.51'))).toBe(false);
    expect(sameLevel(null, null)).toBe(true);
    expect(sameLevel(a, null)).toBe(false);
    expect(sameLevel(null, a)).toBe(false);
  });

  test('levelFromStored reads a level as a stored zone writes it', () => {
    expect(
      levelFromStored({
        name: 'sr_1',
        tf: 'M15',
        price: 4369.57,
        origin: 'sr_levels',
      })
    ).toMatchObject({ name: 'sr_1', tf: 'M15', origin: 'sr_levels' });
    for (const bad of [
      null,
      'x',
      { name: 'sr_1', tf: 'M15', price: 4369.57 },
      { name: 'sr_1', tf: 'M15', price: 4369.57, origin: 'MCD0' },
      { name: 'sr_1', tf: 'H1', price: 4369.57, origin: 'sr_levels' },
      { name: 'sr_1', tf: 'M15', price: 0, origin: 'sr_levels' },
    ]) {
      expect(levelFromStored(bad)).toBeNull();
    }
  });

  test('decimalOrNull', () => {
    expect(decimalOrNull(1.5)?.toString()).toBe('1.5');
    expect(decimalOrNull(3n)?.toString()).toBe('3');
    for (const bad of ['1', true, null, undefined, Number.NaN, {}, []]) {
      expect(decimalOrNull(bad)).toBeNull();
    }
  });
});
