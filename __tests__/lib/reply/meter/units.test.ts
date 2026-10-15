/**
 * @jest-environment node
 */

/**
 * Units (build step 7 part 6; decisions D2 and D4; ADR-073): a unit is one micro-dollar, the Pro
 * allowance is `floor(price × share ÷ unit cost)` in exact arithmetic, and `PRO_MONTHLY_UNITS`
 * unset or damaged means there is no allowance. The cases marked "by hand" were worked out on
 * paper, not by the function.
 */

import {
  MAX_UNITS,
  MICRO_USD_PER_USD,
  PRO_MONTHLY_UNITS_ENV,
  UNIT_MICRO_USD,
  microUsdToUnits,
  parseProMonthlyUnits,
  proMonthlyUnitsFromEnv,
  proQuotaUnits,
  unitsToMicroUsd,
  unitsToUsdText,
  usdToMicroUsd,
} from '@/lib/reply/meter/units';

describe('the unit (decision D2)', () => {
  it('is one micro-dollar: $1.00 is 1,000,000 units', () => {
    expect(UNIT_MICRO_USD).toBe(1);
    expect(MICRO_USD_PER_USD).toBe(1_000_000);
    expect(usdToMicroUsd(1)).toBe(1_000_000);
    expect(microUsdToUnits(usdToMicroUsd(1) as number)).toBe(1_000_000);
  });

  it('is capped at the ledger’s bound, $2,000', () => {
    expect(MAX_UNITS).toBe(2_000_000_000);
    expect(unitsToMicroUsd(MAX_UNITS)).toBe(2_000_000_000);
  });

  it('reads the Pro allowance from PRO_MONTHLY_UNITS', () => {
    expect(PRO_MONTHLY_UNITS_ENV).toBe('PRO_MONTHLY_UNITS');
  });
});

describe('microUsdToUnits and unitsToMicroUsd', () => {
  it('are the identity at a unit of one micro-dollar', () => {
    for (const n of [0, 1, 999, 1_000_000, 123_456_789, MAX_UNITS]) {
      expect(microUsdToUnits(n)).toBe(n);
      expect(unitsToMicroUsd(n)).toBe(n);
    }
  });

  it('round UP at a larger unit, so a cost is never under-charged (by hand: 10 micro at 3 per unit is 4 units)', () => {
    expect(microUsdToUnits(10, 3)).toBe(4);
    expect(microUsdToUnits(9, 3)).toBe(3);
    expect(microUsdToUnits(1, 3)).toBe(1);
    expect(microUsdToUnits(0, 3)).toBe(0);
    expect(unitsToMicroUsd(4, 3)).toBe(12);
  });

  it.each([
    -1,
    1.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    2 ** 53,
    '5' as unknown as number,
    null as unknown as number,
  ])('refuse the figure %p', (value) => {
    expect(microUsdToUnits(value)).toBeNull();
    expect(unitsToMicroUsd(value)).toBeNull();
  });

  it.each([0, -1, 1.5, Number.NaN])('refuse a unit of %p', (unit) => {
    expect(microUsdToUnits(10, unit)).toBeNull();
    expect(unitsToMicroUsd(10, unit)).toBeNull();
  });

  it('refuse a product that is not a safe integer', () => {
    expect(unitsToMicroUsd(2 ** 52, 4)).toBeNull();
  });
});

describe('usdToMicroUsd', () => {
  it.each([
    [1, 1_000_000],
    [0, 0],
    [0.000001, 1],
    [0.0000014, 1],
    [0.0000016, 2],
    [29.99, 29_990_000],
    [0.1 + 0.2, 300_000],
    [1234.567891, 1_234_567_891],
  ])('%p dollars is %p micro-dollars', (usd, micro) => {
    expect(usdToMicroUsd(usd)).toBe(micro);
  });

  it.each([
    -0.000001,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    1e300,
    '1' as unknown as number,
  ])('refuses %p', (usd) => {
    expect(usdToMicroUsd(usd)).toBeNull();
  });
});

describe('unitsToUsdText', () => {
  it.each([
    [0, '0.000000'],
    [1, '0.000001'],
    [999_999, '0.999999'],
    [1_000_000, '1.000000'],
    [12_345_678, '12.345678'],
    [MAX_UNITS, '2000.000000'],
  ])('%p units is %s', (units, text) => {
    expect(unitsToUsdText(units)).toBe(text);
  });

  it('is null for a figure that is not units', () => {
    expect(unitsToUsdText(-1)).toBeNull();
    expect(unitsToUsdText(1.5)).toBeNull();
  });
});

describe('proQuotaUnits (ADR-073): floor(price × share ÷ unit cost)', () => {
  it.each([
    // by hand: 29 dollars is 29,000,000 micro; 35% of it is 10,150,000
    [29, 0.35, 10_150_000],
    [29, 0.5, 14_500_000],
    [29, 1, 29_000_000],
    [29.99, 0.5, 14_995_000],
    [49, 0.1, 4_900_000],
    // 29,000,000 × 333,333 / 1,000,000 = 9,666,657 exactly
    [29, 0.333333, 9_666_657],
    [1, 0.000001, 1],
  ])('price %p and share %p give %p units', (priceUsd, share, units) => {
    expect(proQuotaUnits({ priceUsd, share })).toEqual({ ok: true, units });
  });

  it('rounds DOWN: a unit the margin does not pay for is never promised (by hand: 5,000,000.5 is 5,000,000)', () => {
    expect(proQuotaUnits({ priceUsd: 10.000001, share: 0.5 })).toEqual({
      ok: true,
      units: 5_000_000,
    });
  });

  it('divides by the size of a unit', () => {
    expect(
      proQuotaUnits({ priceUsd: 29, share: 0.5, unitMicroUsd: 2 })
    ).toEqual({
      ok: true,
      units: 7_250_000,
    });
    // by hand: 14,500,000 / 3 = 4,833,333.33...
    expect(
      proQuotaUnits({ priceUsd: 29, share: 0.5, unitMicroUsd: 3 })
    ).toEqual({
      ok: true,
      units: 4_833_333,
    });
  });

  it('is exact where a float product would not be', () => {
    // 0.1 + 0.2 is 0.30000000000000004 as a float; as a share it is 300,000 millionths
    expect(proQuotaUnits({ priceUsd: 100, share: 0.1 + 0.2 })).toEqual({
      ok: true,
      units: 30_000_000,
    });
    // 4.35 dollars × 100 is 434.99999999999994 as a float
    expect(proQuotaUnits({ priceUsd: 4.35, share: 1 })).toEqual({
      ok: true,
      units: 4_350_000,
    });
  });

  it.each([
    [{ priceUsd: 0, share: 0.5 }, 'PRICE'],
    [{ priceUsd: -1, share: 0.5 }, 'PRICE'],
    [{ priceUsd: Number.NaN, share: 0.5 }, 'PRICE'],
    [{ priceUsd: 0.0000001, share: 0.5 }, 'PRICE'],
    [{ priceUsd: 29, share: 0 }, 'SHARE'],
    [{ priceUsd: 29, share: -0.1 }, 'SHARE'],
    [{ priceUsd: 29, share: 1.000001 }, 'SHARE'],
    [{ priceUsd: 29, share: Number.NaN }, 'SHARE'],
    [{ priceUsd: 29, share: 0.0000001 }, 'SHARE'],
    [{ priceUsd: 29, share: 0.5, unitMicroUsd: 0 }, 'UNIT'],
    [{ priceUsd: 29, share: 0.5, unitMicroUsd: -1 }, 'UNIT'],
    [{ priceUsd: 29, share: 0.5, unitMicroUsd: 1.5 }, 'UNIT'],
    [{ priceUsd: 3_000, share: 1 }, 'TOO_LARGE'],
  ])('refuses %j with %s', (input, code) => {
    expect(proQuotaUnits(input)).toEqual({ ok: false, code });
  });

  it('accepts exactly the bound', () => {
    expect(proQuotaUnits({ priceUsd: 2_000, share: 1 })).toEqual({
      ok: true,
      units: MAX_UNITS,
    });
  });
});

describe('PRO_MONTHLY_UNITS (decision D4): while it is not a whole number above zero there is no allowance', () => {
  it.each([
    ['1', 1],
    ['5000', 5000],
    ['10150000', 10_150_000],
    ['2000000000', 2_000_000_000],
  ])('%s is %p units', (raw, units) => {
    expect(parseProMonthlyUnits(raw)).toBe(units);
  });

  it.each([
    undefined,
    '',
    '0',
    '00',
    '007',
    '-5',
    '+5',
    '1.5',
    '1e6',
    '1,000',
    ' 5',
    '5 ',
    '5\n',
    '0x10',
    'ten',
    '2000000001',
    '99999999999',
    'Infinity',
    'NaN',
  ])('%p is no allowance', (raw) => {
    expect(parseProMonthlyUnits(raw)).toBeNull();
  });

  it('reads the variable of an environment, and an unset one is no allowance', () => {
    expect(proMonthlyUnitsFromEnv({ PRO_MONTHLY_UNITS: '5000' })).toBe(5000);
    expect(proMonthlyUnitsFromEnv({})).toBeNull();
    expect(proMonthlyUnitsFromEnv({ PRO_MONTHLY_UNITS: undefined })).toBeNull();
    expect(proMonthlyUnitsFromEnv({ OTHER: '5000' })).toBeNull();
  });
});
