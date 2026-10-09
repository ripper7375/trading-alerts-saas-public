/**
 * @jest-environment node
 */

import { Engine4InputError, Rational } from '@/lib/engine4';

const r = (text: string): Rational => Rational.of(text);

describe('Rational.of: what it reads', () => {
  test.each([
    ['0', '0'],
    ['5', '5'],
    ['2545.00', '2545'],
    ['0.01', '0.01'],
    ['-0.5', '-0.5'],
    ['+3.25', '3.25'],
    ['007.50', '7.5'],
    ['1e3', '1000'],
    ['1.5e-3', '0.0015'],
    ['2E+2', '200'],
    ['-0', '0'],
    [
      '100000000000000000000.000000000000000000001',
      '100000000000000000000.000000000000000000001',
    ],
  ])('%s is %s', (text, canonical) => {
    expect(r(text).toString()).toBe(canonical);
  });

  test.each([
    '',
    ' ',
    ' 1',
    '1 ',
    '1,000.00',
    '.5',
    '5.',
    '1/2',
    '0x10',
    'abc',
    'NaN',
    'Infinity',
    '-Infinity',
    '1e',
    '--1',
    '1.2.3',
    '1e1e1',
    '٣',
  ])('refuses %j', (text) => {
    expect(() => r(text)).toThrow(Engine4InputError);
  });

  test('refuses an exponent that is a typo, not a price', () => {
    expect(() => r('1e999')).toThrow(/out of range/);
    expect(() => r('1e-999')).toThrow(/out of range/);
    expect(() => r('9'.repeat(201))).toThrow(Engine4InputError);
  });

  test('the exponent limit is 400 places either way, and the fraction counts toward it', () => {
    expect(r('1e400').num).toBe(10n ** 400n);
    expect(r('1e-400').den).toBe(10n ** 400n);
    expect(() => r('1e401')).toThrow(/out of range/);
    expect(() => r('1e-401')).toThrow(/out of range/);
    // 0.1e401 is 1e400: the one digit after the point takes one place off the exponent
    expect(r('0.1e401').num).toBe(10n ** 400n);
    expect(() => r('0.1e402')).toThrow(/out of range/);
    expect(() => r('1.5e-400')).toThrow(/out of range/);
  });

  test('the text limit is 200 characters', () => {
    expect(r('1'.repeat(200)).num).toBe(BigInt('1'.repeat(200)));
    expect(() => r('1'.repeat(201))).toThrow(/not a decimal number/);
  });

  test('says what is wrong, with the field when it has one', () => {
    expect(() => r('x')).toThrow('value is not a decimal number');
    expect(() => Rational.of('x', 'riskPct')).toThrow(
      'riskPct is not a decimal number'
    );
    expect(() => Rational.of('1e999', 'entry')).toThrow(
      'entry has an exponent that is out of range'
    );
    expect(() => Rational.of(null as never)).toThrow(
      'value is not a decimal number'
    );
  });

  test('names the field in a refusal', () => {
    try {
      Rational.of('x', 'riskPct');
      throw new Error('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(Engine4InputError);
      expect((error as Engine4InputError).field).toBe('riskPct');
      expect((error as Engine4InputError).code).toBe('NOT_A_DECIMAL');
      expect((error as Engine4InputError).name).toBe('Engine4InputError');
      expect((error as Error).message).toBe('riskPct is not a decimal number');
    }
  });

  test('a refusal without a field has none', () => {
    try {
      Rational.of('x');
      throw new Error('should have thrown');
    } catch (error) {
      expect((error as Engine4InputError).field).toBeUndefined();
    }
  });

  test('reads a number by its shortest decimal text, so a Float column means what it says', () => {
    expect(Rational.of(0.01).eq(r('0.01'))).toBe(true);
    expect(Rational.of(0.1).eq(r('0.1'))).toBe(true);
    expect(Rational.of(100).eq(r('100'))).toBe(true);
    expect(Rational.of(1e-7).eq(r('0.0000001'))).toBe(true);
    expect(Rational.of(1.5e21).eq(r('1500000000000000000000'))).toBe(true);
    expect(Rational.of(-0).eq(Rational.ZERO)).toBe(true);
    // the exact value of the double nearest 0.1 is NOT what the person means
    expect(Rational.of(0.1).eq(Rational.fromFraction(1n, 10n))).toBe(true);
  });

  test('refuses numbers that are not numbers', () => {
    expect(() => Rational.of(Number.NaN)).toThrow(Engine4InputError);
    expect(() => Rational.of(Number.POSITIVE_INFINITY)).toThrow(
      Engine4InputError
    );
    expect(() => Rational.of(Number.NEGATIVE_INFINITY)).toThrow(
      Engine4InputError
    );
  });

  test('refuses anything that is not text, a number or an integer', () => {
    expect(() => Rational.of(null as never)).toThrow(Engine4InputError);
    expect(() => Rational.of(undefined as never)).toThrow(Engine4InputError);
    expect(() => Rational.of({} as never)).toThrow(Engine4InputError);
    expect(() => Rational.of(true as never)).toThrow(Engine4InputError);
  });

  test('an integer and a Rational pass through', () => {
    expect(Rational.of(12n).toString()).toBe('12');
    const x = r('1.5');
    expect(Rational.of(x)).toBe(x);
  });
});

describe('Rational: exact arithmetic', () => {
  test('0.1 + 0.2 is exactly 0.3', () => {
    expect(r('0.1').add(r('0.2')).eq(r('0.3'))).toBe(true);
    expect(r('0.1').add(r('0.2')).toString()).toBe('0.3');
  });

  test('a third survives a round trip', () => {
    const third = r('1').div(r('3'));
    expect(third.mul(r('3')).eq(Rational.ONE)).toBe(true);
    expect(third.toExactDecimal()).toBeNull();
    expect(third.toString()).toBe('1/3');
  });

  test('always lowest terms with a positive denominator', () => {
    const x = Rational.fromFraction(-6n, -4n);
    expect(x.num).toBe(3n);
    expect(x.den).toBe(2n);
    const y = Rational.fromFraction(6n, -4n);
    expect(y.num).toBe(-3n);
    expect(y.den).toBe(2n);
    const zero = Rational.fromFraction(0n, -9n);
    expect(zero.num).toBe(0n);
    expect(zero.den).toBe(1n);
  });

  test('the four operations and the signs', () => {
    expect(r('7.5').sub(r('10')).toString()).toBe('-2.5');
    expect(r('-2.5').mul(r('-4')).toString()).toBe('10');
    expect(r('-10').div(r('4')).toString()).toBe('-2.5');
    expect(r('2.5').neg().toString()).toBe('-2.5');
    expect(r('-2.5').abs().toString()).toBe('2.5');
    expect(r('3').abs().toString()).toBe('3');
  });

  test('division by zero is refused', () => {
    expect(() => r('1').div(Rational.ZERO)).toThrow(RangeError);
    expect(() => r('1').div(Rational.ZERO)).toThrow(
      'Rational: division by zero'
    );
    expect(() => Rational.fromFraction(1n, 0n)).toThrow(RangeError);
    expect(() => Rational.fromFraction(1n, 0n)).toThrow(
      'Rational: the denominator is zero'
    );
    expect(Rational.ZERO.div(r('7')).isZero()).toBe(true);
  });

  test('comparison', () => {
    expect(r('0.1').lt(r('0.2'))).toBe(true);
    expect(r('0.2').lt(r('0.1'))).toBe(false);
    expect(r('0.2').lte(r('0.2'))).toBe(true);
    expect(r('0.2').gt(r('0.1'))).toBe(true);
    expect(r('0.2').gte(r('0.2'))).toBe(true);
    expect(r('1').div(r('3')).lt(r('0.3333333333333333'))).toBe(false);
    expect(r('1').div(r('3')).gt(r('0.3333333333333333'))).toBe(true);
    expect(r('-1').cmp(r('1'))).toBe(-1);
    expect(r('1').cmp(r('1'))).toBe(0);
    expect(r('2').cmp(r('1'))).toBe(1);
    expect(Rational.ZERO.isZero()).toBe(true);
    expect(r('0.0001').isPositive()).toBe(true);
    expect(r('-0.0001').isNegative()).toBe(true);
    expect(r('4').isInteger()).toBe(true);
    expect(r('4.5').isInteger()).toBe(false);
  });

  test('min and max', () => {
    expect(Rational.min(r('3'), r('1'), r('2')).toString()).toBe('1');
    expect(Rational.max(r('3'), r('1'), r('2')).toString()).toBe('3');
    expect(Rational.min(r('5')).toString()).toBe('5');
  });

  test('instances cannot be changed', () => {
    const x = r('1.5');
    expect(Object.isFrozen(x)).toBe(true);
    expect(() => {
      (x as unknown as { num: bigint }).num = 9n;
    }).toThrow(TypeError);
  });

  test('very large and very small values stay exact', () => {
    const huge = r('123456789012345678901234567890');
    expect(huge.mul(huge).div(huge).eq(huge)).toBe(true);
    const tiny = r('0.000000000000000000000000000001');
    expect(
      tiny.mul(r('1000000000000000000000000000000')).eq(Rational.ONE)
    ).toBe(true);
  });
});

describe('Rational: rounding down, up and to a step', () => {
  test.each([
    ['2.5', 2n, 3n],
    ['2', 2n, 2n],
    ['-2.5', -3n, -2n],
    ['-2', -2n, -2n],
    ['0.0001', 0n, 1n],
    ['-0.0001', -1n, 0n],
    ['0', 0n, 0n],
  ])('floor and ceil of %s', (text, floor, ceil) => {
    expect(r(text).floor()).toBe(floor);
    expect(r(text).ceil()).toBe(ceil);
  });

  test('floorToMultiple never rounds up: the lot rule', () => {
    expect(r('0.0665').floorToMultiple(r('0.01')).toString()).toBe('0.06');
    expect(r('0.06').floorToMultiple(r('0.01')).toString()).toBe('0.06');
    expect(
      r('0.0599999999999999999999').floorToMultiple(r('0.01')).toString()
    ).toBe('0.05');
    expect(r('0.0099999').floorToMultiple(r('0.01')).toString()).toBe('0');
    expect(r('1').div(r('3')).floorToMultiple(r('0.01')).toString()).toBe(
      '0.33'
    );
    expect(r('0.07').floorToMultiple(r('0.05')).toString()).toBe('0.05');
    expect(r('7').floorToMultiple(r('2.5')).toString()).toBe('5');
    expect(r('-0.015').floorToMultiple(r('0.01')).toString()).toBe('-0.02');
  });

  test('ceilToMultiple never rounds down', () => {
    expect(r('3.008').ceilToMultiple(r('0.01')).toString()).toBe('3.01');
    expect(r('3.01').ceilToMultiple(r('0.01')).toString()).toBe('3.01');
    expect(r('1').div(r('3')).ceilToMultiple(r('0.01')).toString()).toBe(
      '0.34'
    );
    expect(r('0.0000001').ceilToMultiple(r('0.01')).toString()).toBe('0.01');
  });

  test('a step that is not above zero is refused', () => {
    expect(() => r('1').floorToMultiple(Rational.ZERO)).toThrow(RangeError);
    expect(() => r('1').floorToMultiple(r('-0.01'))).toThrow(RangeError);
    expect(() => r('1').ceilToMultiple(Rational.ZERO)).toThrow(RangeError);
  });

  test.each([
    ['2.345', 2, 'HALF_UP', '2.35'],
    ['2.344999', 2, 'HALF_UP', '2.34'],
    ['-2.345', 2, 'HALF_UP', '-2.35'],
    ['0.005', 2, 'HALF_UP', '0.01'],
    ['0.004999', 2, 'HALF_UP', '0'],
    ['2.349', 2, 'FLOOR', '2.34'],
    ['-2.341', 2, 'FLOOR', '-2.35'],
    ['2.341', 2, 'CEIL', '2.35'],
    ['-2.349', 2, 'CEIL', '-2.34'],
    ['2.5', 0, 'HALF_UP', '3'],
    ['3.5', 0, 'HALF_UP', '4'],
    ['-0.5', 0, 'HALF_UP', '-1'],
  ] as const)('roundTo(%s, %d, %s) is %s', (text, places, mode, want) => {
    expect(r(text).roundTo(places, mode).toString()).toBe(want);
  });
});

describe('Rational: text out', () => {
  test.each([
    ['90.24', 2, '90.24'],
    ['90.2', 2, '90.20'],
    ['100', 2, '100.00'],
    ['0', 2, '0.00'],
    ['0.005', 2, '0.01'],
    ['0.004', 2, '0.00'],
    ['-0.004', 2, '0.00'],
    ['-0.005', 2, '-0.01'],
    ['-12.345', 2, '-12.35'],
    ['1.5269999', 3, '1.527'],
    ['0.5', 0, '1'],
    ['1234567.891', 1, '1234567.9'],
  ])('%s to %d places is %s', (text, places, want) => {
    expect(r(text).toDecimal(places)).toBe(want);
  });

  test('a negative that rounds to zero prints no sign', () => {
    expect(r('-0.0001').toDecimal(2)).toBe('0.00');
    expect(r('-0.4').toDecimal(0)).toBe('0');
  });

  test('toDecimal honours the rounding it is told', () => {
    expect(r('3.008').toDecimal(2, 'CEIL')).toBe('3.01');
    expect(r('3.008').toDecimal(2, 'FLOOR')).toBe('3.00');
    expect(r('3.008').toDecimal(2)).toBe('3.01');
    expect(r('3.004').toDecimal(2)).toBe('3.00');
  });

  test('toExactDecimal is exact, canonical and null for a third', () => {
    expect(r('90.2400').toExactDecimal()).toBe('90.24');
    expect(r('100').toExactDecimal()).toBe('100');
    expect(r('0.5').toExactDecimal()).toBe('0.5');
    expect(r('1').div(r('8')).toExactDecimal()).toBe('0.125');
    expect(r('1').div(r('3')).toExactDecimal()).toBeNull();
    expect(r('1').div(r('7')).toExactDecimal()).toBeNull();
    expect(r('-3').div(r('4')).toExactDecimal()).toBe('-0.75');
  });

  test('places must be a whole number from 0 to 60', () => {
    expect(() => r('1').toDecimal(-1)).toThrow(Engine4InputError);
    expect(() => r('1').toDecimal(61)).toThrow(Engine4InputError);
    expect(() => r('1').toDecimal(1.5)).toThrow(Engine4InputError);
    expect(r('1').toDecimal(60n)).toBe(`1.${'0'.repeat(60)}`);
  });

  test('JSON.stringify works and carries the exact text', () => {
    const value = { price: r('2567.60'), third: r('1').div(r('3')) };
    expect(JSON.stringify(value)).toBe('{"price":"2567.6","third":"1/3"}');
  });
});
