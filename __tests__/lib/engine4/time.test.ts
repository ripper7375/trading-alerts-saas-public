/**
 * @jest-environment node
 */

import {
  DAY_SECONDS,
  HOUR_SECONDS,
  MINUTE_SECONDS,
  readSeconds,
  toDbInt,
  utcClock,
} from '@/lib/engine4/time';
import { Engine4InputError } from '@/lib/engine4';

describe('the units', () => {
  test('a minute, an hour and a day', () => {
    expect(MINUTE_SECONDS).toBe(60n);
    expect(HOUR_SECONDS).toBe(3600n);
    expect(DAY_SECONDS).toBe(86400n);
  });
});

describe('readSeconds', () => {
  test.each([
    [1, 1n],
    [1760000000, 1760000000n],
    [1760000000n, 1760000000n],
    ['1760000000', 1760000000n],
    ['1760000000.0', 1760000000n],
  ])('reads %p as %p', (input, expected) => {
    expect(readSeconds('t', input)).toBe(expected);
  });

  test.each([
    [0, 'NOT_POSITIVE'],
    [-5, 'NOT_POSITIVE'],
    [1.5, 'OUT_OF_RANGE'],
    ['1760000000.5', 'OUT_OF_RANGE'],
    [Number.NaN, 'NOT_A_DECIMAL'],
    [Number.POSITIVE_INFINITY, 'NOT_A_DECIMAL'],
    ['soon', 'NOT_A_DECIMAL'],
    [null, 'NOT_A_DECIMAL'],
    [undefined, 'NOT_A_DECIMAL'],
  ])('refuses %p with %s', (input, code) => {
    let caught: unknown;
    try {
      readSeconds('when', input);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(Engine4InputError);
    expect((caught as Engine4InputError).code).toBe(code);
  });

  test('names the field it refuses', () => {
    expect(() => readSeconds('nowSeconds', 0)).toThrow(/nowSeconds/);
    expect(() => readSeconds('nowSeconds', 1.5)).toThrow(/nowSeconds/);
  });
});

describe('utcClock', () => {
  test.each([
    [0n, '00:00'],
    [60n, '00:01'],
    [3599n, '00:59'],
    // before the epoch the clock still runs forward from midnight
    [-1n, '23:59'],
    [-3600n, '23:00'],
    [3600n, '01:00'],
    [75600n + 3000n, '21:50'],
    [86399n, '23:59'],
    [86400n, '00:00'],
    // 2026-09-18 20:50:00 UTC
    [1789764600n, '20:50'],
    // 2026-11-01 01:30:00 UTC, the day the US clocks change
    [1793496600n, '01:30'],
  ])('%p is %s', (seconds, text) => {
    expect(utcClock(seconds)).toBe(text);
  });

  test('is two digits everywhere', () => {
    expect(utcClock(9n * 3600n + 5n * 60n)).toBe('09:05');
  });
});

describe('toDbInt', () => {
  test('converts a time that fits a database integer', () => {
    expect(toDbInt('t', 1760000000n)).toBe(1760000000);
    expect(toDbInt('t', 1n)).toBe(1);
    expect(toDbInt('t', 2147483647n)).toBe(2147483647);
  });

  test.each([0n, -1n, 2147483648n, 99999999999n])('refuses %p', (value) => {
    expect(() => toDbInt('window end', value)).toThrow(Engine4InputError);
    expect(() => toDbInt('window end', value)).toThrow(/window end/);
  });
});
