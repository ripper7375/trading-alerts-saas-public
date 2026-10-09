/**
 * @jest-environment node
 */

/**
 * The broker figures (build step 5, part 3; architecture 6.9, ADR-066, 7.6).
 *
 * The row below is a TEST ROW: the figures are round numbers chosen for the
 * tests and are not a claim about any broker's real contract. No `symbol_specs`
 * row exists in production yet (the exporter has never run on a terminal).
 */

import {
  SPECS_FUTURE_TOLERANCE_SECONDS,
  SPECS_MAX_AGE_SECONDS,
  readBrokerFigures,
  sizeSetup,
} from '@/lib/engine4';
import type { BrokerResult } from '@/lib/engine4';

const NOW = 1_790_000_000;
const DAY = 86_400;

const ROW = {
  symbol: 'XAUUSD',
  version: 3,
  captured_at: NOW - DAY,
  contract_size: 100,
  volume_min: 0.01,
  volume_step: 0.01,
  volume_max: 100,
  tick_size: 0.01,
  typical_spread: 25,
  swap_long: -66.5,
  swap_short: 34.2,
  point: 0.01,
  digits: 2,
  swap_mode: 1,
};

const row = (over: Record<string, unknown> = {}) => ({ ...ROW, ...over });

function figuresOf(result: BrokerResult) {
  if (!result.ok) throw new Error(`refused: ${result.code} ${result.detail}`);
  return result.figures;
}

function refused(result: BrokerResult) {
  if (result.ok) throw new Error('expected the row to be refused');
  return result;
}

describe('the constants', () => {
  test('7 days, and five minutes of clock skew', () => {
    expect(SPECS_MAX_AGE_SECONDS).toBe(604_800n);
    expect(SPECS_FUTURE_TOLERANCE_SECONDS).toBe(300n);
  });
});

describe('a good row', () => {
  const figures = figuresOf(readBrokerFigures(ROW, NOW));

  test('carries what the consent record needs', () => {
    expect(figures.symbol).toBe('XAUUSD');
    expect(figures.version).toBe(3n);
    expect(figures.capturedAt).toBe(BigInt(NOW - DAY));
    expect(figures.ageSeconds).toBe(86_400n);
  });

  test('reads the doubles by their decimal text', () => {
    expect(figures.spec).toEqual({
      contractSize: '100',
      volumeMin: '0.01',
      volumeStep: '0.01',
      volumeMax: '100',
      typicalSpread: '25',
      point: '0.01',
    });
    expect(figures.resolved.spreadPrice.toString()).toBe('0.25');
    expect(figures.tickSize.toString()).toBe('0.01');
    expect(figures.swapLong.toString()).toBe('-66.5');
    expect(figures.swapShort.toString()).toBe('34.2');
    expect(figures.digits).toBe(2n);
    expect(figures.swapMode).toBe(1n);
  });

  test('is what part 1 sizes with', () => {
    const sized = sizeSetup({
      side: 'BUY',
      entry: '2545.00',
      stopDistance: '15.00',
      equity: '10000',
      riskPct: '1.00',
      maxLeverage: '5',
      commission: '4',
      spec: figures.spec,
    });
    expect(sized.status).toBe('OK');
  });

  test('a volume step that a double cannot hold exactly is still exact', () => {
    // 0.3 / 0.1 is 2.9999999999999996 in floating point; as decimals it is 3
    const result = readBrokerFigures(
      row({ volume_min: 0.3, volume_step: 0.1 }),
      NOW
    );
    expect(result.ok).toBe(true);
  });

  test('a typical spread of zero is allowed', () => {
    expect(readBrokerFigures(row({ typical_spread: 0 }), NOW).ok).toBe(true);
  });

  test('swaps may be zero or negative', () => {
    expect(
      readBrokerFigures(row({ swap_long: 0, swap_short: -3 }), NOW).ok
    ).toBe(true);
  });
});

describe('a change in the broker row changes the lot with no change in code (6.14 item 7)', () => {
  // the worked example of 6.7 (equity 10,000, BUY 2,545.00, risk 1%, stop 15.00, commission 4), no spread
  const lotFor = (over: Record<string, unknown>) => {
    const figures = figuresOf(
      readBrokerFigures(row({ typical_spread: 0, ...over }), NOW)
    );
    const sized = sizeSetup({
      side: 'BUY',
      entry: '2545.00',
      stopDistance: '15.00',
      equity: '10000',
      riskPct: '1.00',
      maxLeverage: '5',
      commission: '4',
      spec: figures.spec,
    });
    return sized.status === 'OK' ? sized.lot.toString() : sized.status;
  };

  test('the row of the worked example gives 0.06 lot', () => {
    expect(lotFor({})).toBe('0.06');
  });

  test('a smaller contract gives a bigger lot', () => {
    // 100 / (15 x 10 + 4) = 0.649 lot, rounded down to 0.64
    expect(lotFor({ contract_size: 10 })).toBe('0.64');
  });

  test('a coarser lot step rounds the same lot down further', () => {
    expect(lotFor({ volume_min: 0.05, volume_step: 0.05 })).toBe('0.05');
  });

  test('a higher minimum lot than the account can carry is an underflow, not a rounded-up lot', () => {
    expect(lotFor({ volume_min: 0.1, volume_step: 0.1 })).toBe('UNDERFLOW');
  });

  test('a lower maximum caps the lot', () => {
    expect(lotFor({ contract_size: 10, volume_max: 0.5 })).toBe('0.5');
  });
});

describe('older than 7 days: not offered (ADR-078)', () => {
  test.each([
    [0, true],
    [DAY, true],
    [7 * DAY - 1, true],
    [7 * DAY, true],
    [7 * DAY + 1, false],
    [30 * DAY, false],
  ])('a row %p seconds old: usable %p', (age, usable) => {
    const result = readBrokerFigures(row({ captured_at: NOW - age }), NOW);
    expect(result.ok).toBe(usable);
    if (!usable) {
      const problem = refused(result);
      expect(problem.code).toBe('SPECS_STALE');
      expect(problem.version).toBe(3n);
      expect(problem.capturedAt).toBe(BigInt(NOW - age));
      expect(problem.ageSeconds).toBe(BigInt(age));
    }
  });

  test('a stale row is stale however broken its figures are', () => {
    const result = readBrokerFigures(
      row({ captured_at: NOW - 8 * DAY, contract_size: 'x' }),
      NOW
    );
    expect(refused(result).code).toBe('SPECS_STALE');
  });
});

describe('dated in the future: not trusted', () => {
  test.each([
    [-1, true],
    [0, true],
    [300, true],
    [301, false],
    [10 * DAY, false],
  ])('a row dated %p seconds ahead: usable %p', (ahead, usable) => {
    const result = readBrokerFigures(row({ captured_at: NOW + ahead }), NOW);
    expect(result.ok).toBe(usable);
    if (usable) {
      expect(figuresOf(result).ageSeconds).toBe(
        ahead > 0 ? 0n : BigInt(-ahead)
      );
    } else {
      const problem = refused(result);
      expect(problem.code).toBe('SPECS_FROM_THE_FUTURE');
      expect(problem.version).toBe(3n);
      expect(problem.ageSeconds).toBeNull();
    }
  });
});

describe('no row', () => {
  test.each([null, undefined])('%p is NO_SPECS', (value) => {
    const problem = refused(readBrokerFigures(value, NOW));
    expect(problem.code).toBe('NO_SPECS');
    expect(problem.version).toBeNull();
    expect(problem.capturedAt).toBeNull();
    expect(problem.ageSeconds).toBeNull();
  });
});

describe('an unreadable row', () => {
  test.each(['text', 5, true, [], [ROW]])('%p is not a row', (value) => {
    const problem = refused(readBrokerFigures(value, NOW));
    expect(problem.code).toBe('SPECS_UNREADABLE');
    expect(problem.detail).toBe('the symbol_specs row is not an object');
  });

  test.each([
    ['a missing version', { version: undefined }, /version/],
    ['a version of 0', { version: 0 }, /version/],
    ['a fractional version', { version: 1.5 }, /version/],
    ['a missing capture time', { captured_at: undefined }, /captured_at/],
    ['a capture time of 0', { captured_at: 0 }, /captured_at/],
    ['a fractional capture time', { captured_at: NOW + 0.5 }, /captured_at/],
  ])('refuses %s before looking at any figure', (_label, over, pattern) => {
    const problem = refused(readBrokerFigures(row(over), NOW));
    expect(problem.code).toBe('SPECS_UNREADABLE');
    expect(problem.detail).toMatch(pattern);
    expect(problem.version).toBeNull();
  });

  test.each([
    ['a missing symbol', { symbol: undefined }, /symbol/],
    ['an empty symbol', { symbol: '' }, /symbol/],
    ['a symbol that is not text', { symbol: 5 }, /symbol/],
    ['a contract size of 0', { contract_size: 0 }, /contract_size/],
    ['a negative contract size', { contract_size: -100 }, /contract_size/],
    [
      'a contract size that is not a number',
      { contract_size: NaN },
      /contract_size/,
    ],
    ['a missing contract size', { contract_size: null }, /contract_size/],
    ['a volume minimum of 0', { volume_min: 0 }, /volume_min/],
    ['a volume step of 0', { volume_step: 0 }, /volume_step/],
    ['a volume maximum of 0', { volume_max: 0 }, /volume_max/],
    ['a negative spread', { typical_spread: -1 }, /typical_spread/],
    ['a point of 0', { point: 0 }, /^point /],
    ['a tick size of 0', { tick_size: 0 }, /tick_size/],
    ['a swap that is not a number', { swap_long: 'a lot' }, /swap_long/],
    [
      'a swap that is not a number (short)',
      { swap_short: undefined },
      /swap_short/,
    ],
    ['a fractional digits count', { digits: 2.5 }, /digits/],
    ['negative digits', { digits: -1 }, /digits/],
    ['a fractional swap mode', { swap_mode: 0.5 }, /swap_mode/],
    ['a negative swap mode', { swap_mode: -1 }, /swap_mode/],
    [
      'a minimum that is not a multiple of the step',
      { volume_min: 0.015 },
      /multiple/,
    ],
    ['a maximum below the minimum', { volume_max: 0.005 }, /below/],
  ])('refuses %s', (_label, over, pattern) => {
    const problem = refused(readBrokerFigures(row(over), NOW));
    expect(problem.code).toBe('SPECS_UNREADABLE');
    expect(problem.detail).toMatch(pattern);
    // what could be read of the row is kept for the trace
    expect(problem.version).toBe(3n);
    expect(problem.capturedAt).toBe(BigInt(NOW - DAY));
    expect(problem.ageSeconds).toBe(86_400n);
  });

  test('zero digits and a zero swap mode are fine', () => {
    expect(readBrokerFigures(row({ digits: 0, swap_mode: 0 }), NOW).ok).toBe(
      true
    );
  });
});

describe('what is refused outright', () => {
  test.each([0, -1, 1.5, NaN, 'now', null])('a clock of %p', (clock) => {
    expect(() => readBrokerFigures(ROW, clock as number)).toThrow(/nowSeconds/);
  });
});
