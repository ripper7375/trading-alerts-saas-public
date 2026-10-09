/**
 * @jest-environment node
 */

import {
  Engine4InputError,
  Rational,
  nextOpposingLevel,
  roomAhead,
  targetFitsBefore,
} from '@/lib/engine4';
import type { Level } from '@/lib/engine4';

const r = (text: string): Rational => Rational.of(text);

const lv = (
  name: string,
  tf: 'M5' | 'M15',
  price: string,
  origin: Level['origin'] = 'sr_levels'
): Level => ({ name, tf, price: r(price), origin });

// the 18 Sep levels (architecture 3.7), reduced to what a BUY at 4367.20 and a SELL at 4378 see
const SEP_18: Level[] = [
  lv('UOEDT', 'M5', '4384.23', 'MCD2'),
  lv('baseline', 'M5', '4367.20', 'MCD2'),
  lv('LOEDT', 'M5', '4350.16', 'MCD2'),
  lv('sr_6', 'M15', '4398.29'),
  lv('sr_5', 'M15', '4386.20'),
  lv('sr_1', 'M15', '4369.57'),
  lv('sr_2', 'M15', '4350.92'),
  lv('sr_3', 'M15', '4334.56'),
];

describe('the next opposing level', () => {
  test('a BUY looks up: the lowest level strictly above the entry', () => {
    const level = nextOpposingLevel(SEP_18, 'BUY', '4367.20');
    expect(level).toMatchObject({ name: 'sr_1', tf: 'M15' });
    expect(level?.price.toString()).toBe('4369.57');
  });

  test('a SELL looks down: the highest level strictly below the entry', () => {
    const level = nextOpposingLevel(SEP_18, 'SELL', '4367.20');
    expect(level?.price.toString()).toBe('4350.92');
    expect(level?.name).toBe('sr_2');
  });

  test('a level AT the entry is neither above nor below it', () => {
    // the M5 baseline sits at exactly 4367.20
    expect(nextOpposingLevel(SEP_18, 'BUY', '4367.20')?.name).not.toBe(
      'baseline'
    );
    expect(nextOpposingLevel(SEP_18, 'SELL', '4367.20')?.name).not.toBe(
      'baseline'
    );
    expect(nextOpposingLevel([lv('x', 'M5', '100')], 'BUY', '100')).toBeNull();
  });

  test('nothing beyond the entry is no level: unlimited room', () => {
    expect(nextOpposingLevel(SEP_18, 'BUY', '4500')).toBeNull();
    expect(nextOpposingLevel(SEP_18, 'SELL', '4000')).toBeNull();
    expect(nextOpposingLevel([], 'BUY', '4000')).toBeNull();
  });

  test('a level a cent beyond the entry is the level', () => {
    expect(
      nextOpposingLevel([lv('x', 'M5', '100.01')], 'BUY', '100')?.name
    ).toBe('x');
    expect(
      nextOpposingLevel([lv('x', 'M5', '99.99')], 'SELL', '100')?.name
    ).toBe('x');
  });

  test('levels are taken in cents, as the zone builder takes them', () => {
    // 100.004 is 100.00 in cents: at the entry, so not beyond it
    expect(
      nextOpposingLevel([lv('x', 'M5', '100.004')], 'BUY', '100')
    ).toBeNull();
    // 100.005 is 100.01
    expect(
      nextOpposingLevel(
        [lv('x', 'M5', '100.005')],
        'BUY',
        '100'
      )?.price.toString()
    ).toBe('100.01');
  });

  test('equal prices: the first by timeframe, name, origin is named', () => {
    const tied = [
      lv('sr_4', 'M5', '110'),
      lv('sr_2', 'M5', '110'),
      lv('sr_9', 'M15', '110', 'sr2_levels'),
    ];
    expect(nextOpposingLevel(tied, 'BUY', '100')).toMatchObject({
      tf: 'M15',
      name: 'sr_9',
    });
    expect(nextOpposingLevel(tied.slice(0, 2), 'BUY', '100')?.name).toBe(
      'sr_2'
    );
  });

  test('the order of the levels does not matter', () => {
    const shuffled = [...SEP_18].reverse();
    expect(nextOpposingLevel(shuffled, 'BUY', '4367.20')?.name).toBe('sr_1');
    expect(nextOpposingLevel(shuffled, 'SELL', '4367.20')?.name).toBe('sr_2');
  });

  test('it refuses an entry that is not a price', () => {
    expect(() => nextOpposingLevel(SEP_18, 'BUY', '0')).toThrow(
      Engine4InputError
    );
    expect(() => nextOpposingLevel(SEP_18, 'BUY', 'x')).toThrow(
      Engine4InputError
    );
  });
});

describe('room ahead', () => {
  test('the 18 Sep entry has 2.37 of room to M15 sr_1 at 4369.57', () => {
    const ahead = roomAhead(SEP_18, 'BUY', '4367.20');
    expect(ahead.level?.price.toString()).toBe('4369.57');
    expect(ahead.room?.toString()).toBe('2.37');
  });

  test('a SELL measures down', () => {
    const ahead = roomAhead(SEP_18, 'SELL', '4367.20');
    expect(ahead.room?.toString()).toBe('16.28');
  });

  test('no level means no room figure', () => {
    expect(roomAhead(SEP_18, 'BUY', '4500')).toEqual({
      level: null,
      room: null,
    });
  });

  test('the entry need not be a zone price', () => {
    const ahead = roomAhead(SEP_18, 'BUY', '4380');
    expect(ahead.level?.price.toString()).toBe('4384.23');
    expect(ahead.room?.toString()).toBe('4.23');
  });
});

describe('a target is recommended only strictly before the level (D8)', () => {
  const level = lv('sr_1', 'M15', '4369.57');

  test('a BUY target below the level fits, at the level or above it does not', () => {
    expect(targetFitsBefore('BUY', r('4369.56'), level)).toBe(true);
    expect(targetFitsBefore('BUY', r('4369.57'), level)).toBe(false);
    expect(targetFitsBefore('BUY', r('4369.58'), level)).toBe(false);
  });

  test('a SELL target above the level fits, at the level or below it does not', () => {
    const support = lv('sr_2', 'M15', '4350.92');
    expect(targetFitsBefore('SELL', r('4350.93'), support)).toBe(true);
    expect(targetFitsBefore('SELL', r('4350.92'), support)).toBe(false);
    expect(targetFitsBefore('SELL', r('4350.91'), support)).toBe(false);
  });

  test('with no level every target fits', () => {
    expect(targetFitsBefore('BUY', r('99999'), null)).toBe(true);
    expect(targetFitsBefore('SELL', r('1'), null)).toBe(true);
  });

  test('the comparison is exact, not rounded', () => {
    expect(targetFitsBefore('BUY', r('4369.569999999'), level)).toBe(true);
    expect(targetFitsBefore('BUY', r('4369.570000001'), level)).toBe(false);
  });
});
