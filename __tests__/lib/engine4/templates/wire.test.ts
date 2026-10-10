/**
 * @jest-environment node
 */

/**
 * The wire format (build step 5, part 7): what the browser receives and how it reads
 * an exact number back from it.
 */

import { Engine4InputError, Rational } from '@/lib/engine4';
import { readWire, wireDecimal } from '@/lib/engine4/templates/wire';

describe('readWire', () => {
  test('reads decimal text exactly', () => {
    expect(readWire('4367.2').eq(Rational.of('4367.20'))).toBe(true);
    expect(readWire('0.75').toString()).toBe('0.75');
    expect(readWire('-0.5').toString()).toBe('-0.5');
    expect(readWire('10000').toString()).toBe('10000');
  });

  test('reads the text a value with no finite decimal form writes itself as', () => {
    const third = Rational.fromFraction(1n, 3n);
    expect(third.toJSON()).toBe('1/3');
    expect(readWire(third.toJSON()).eq(third)).toBe(true);
    const negative = Rational.fromFraction(-7n, 2n);
    expect(readWire('-7/2').eq(negative)).toBe(true);
    expect(readWire('22/7').eq(Rational.fromFraction(22n, 7n))).toBe(true);
  });

  test('is the inverse of what the routes write, for any rational', () => {
    for (const [n, d] of [
      [1n, 3n],
      [-2n, 7n],
      [4367n, 1n],
      [6049n, 8n],
      [0n, 5n],
      [1n, 1_000_000n],
    ] as const) {
      const value = Rational.fromFraction(n, d);
      const wire = JSON.parse(JSON.stringify({ v: value })).v as string;
      expect(readWire(wire).eq(value)).toBe(true);
    }
  });

  test('refuses what is not a number, naming it an input error', () => {
    for (const text of ['', 'abc', '1/0x', '1.2.3', '--1']) {
      expect(() => readWire(text)).toThrow(Engine4InputError);
    }
  });

  test('a fraction with a zero denominator is refused', () => {
    expect(() => readWire('1/0')).toThrow();
  });
});

describe('wireDecimal', () => {
  test('rounds half away from zero, exactly, without a JavaScript number', () => {
    expect(wireDecimal('0.125', 2)).toBe('0.13');
    expect(wireDecimal('0.124999999999999999999', 2)).toBe('0.12');
    expect(wireDecimal('-0.125', 2)).toBe('-0.13');
    expect(wireDecimal('2/3', 2)).toBe('0.67');
    expect(wireDecimal('1/3', 4)).toBe('0.3333');
    expect(wireDecimal('4367.2', 2)).toBe('4367.20');
    expect(wireDecimal('90.236', 2)).toBe('90.24');
  });

  test('pads to the places asked', () => {
    expect(wireDecimal('5', 2)).toBe('5.00');
    expect(wireDecimal('0', 2)).toBe('0.00');
  });
});
