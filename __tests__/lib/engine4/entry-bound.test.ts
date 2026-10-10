/**
 * @jest-environment node
 */

/**
 * The bound on a custom entry (build step 5, part 4; architecture 3.6 and 6.10
 * check 0, ADR-034, assumption A3). The bars are TEST bars: the stored bundles
 * keep closes only, not highs and lows.
 */

import {
  ENTRY_TYPO_FRACTION,
  M5_SECONDS,
  checkEntryBound,
  dayRange,
  entryBounds,
} from '@/lib/engine4';
import type { DayBar, DayRange } from '@/lib/engine4';

const NOW = 1_790_000_100;

/** A range holds bigints (times in seconds); this prints them as text so two can be compared. */
const text = (value: unknown): string =>
  JSON.stringify(value, (_key, item: unknown) =>
    typeof item === 'bigint' ? item.toString() : item
  );
const DAY = 86_400;

const bar = (openTime: number, high: string, low: string): DayBar => ({
  openTime,
  high,
  low,
});

function range(bars: DayBar[], now = NOW): Extract<DayRange, { ok: true }> {
  const result = dayRange(bars, now);
  if (!result.ok) throw new Error(`no range: ${result.code} ${result.detail}`);
  return result;
}

describe('the constants', () => {
  test('five minutes, and 5%', () => {
    expect(M5_SECONDS).toBe(300n);
    expect(ENTRY_TYPO_FRACTION).toBe('0.05');
  });
});

describe('dayRange: which bars count', () => {
  const edge = (openTime: number) =>
    dayRange([bar(openTime, '4400', '4300')], NOW);

  test.each([
    ['opened exactly 24 hours ago', NOW - DAY, true],
    ['opened one second before that', NOW - DAY - 1, false],
    ['closes exactly now', NOW - 300, true],
    ['closes one second from now (still forming)', NOW - 299, false],
    ['opened now', NOW, false],
    ['opened in the future', NOW + 600, false],
  ])('a bar that %s: counted %p', (_label, openTime, counted) => {
    expect(edge(openTime).ok).toBe(counted);
  });

  test('a bar outside the window or still forming does not move the range', () => {
    const result = range([
      bar(NOW - 600, '4400', '4300'),
      bar(NOW - 299, '9999', '1'),
      bar(NOW - DAY - 1, '9999', '1'),
    ]);
    expect(result.high.toString()).toBe('4400');
    expect(result.low.toString()).toBe('4300');
    expect(result.barCount).toBe(1);
  });

  test('no closed bar in the last 24 hours is an unknown range, not an empty one', () => {
    expect(dayRange([], NOW)).toEqual({
      ok: false,
      code: 'NO_CLOSED_BARS',
      detail: 'there is no closed M5 bar in the last 24 hours',
    });
    expect(dayRange([bar(NOW - 100, '4400', '4300')], NOW)).toMatchObject({
      ok: false,
      code: 'NO_CLOSED_BARS',
    });
  });
});

describe('dayRange: the range', () => {
  const bars = [
    bar(NOW - 3600, '4350.50', '4340.25'),
    bar(NOW - 7200, '4391.20', '4360'),
    bar(NOW - 10800, '4330', '4318.75'),
    bar(NOW - 600, '4380', '4370'),
  ];

  test('is the highest high and the lowest low', () => {
    const result = range(bars);
    expect(result.high.toString()).toBe('4391.2');
    expect(result.low.toString()).toBe('4318.75');
    expect(result.height.toString()).toBe('72.45');
    expect(result.barCount).toBe(4);
  });

  test('widened by half its height, exactly', () => {
    const result = range(bars);
    expect(result.lower.toString()).toBe('4282.525');
    expect(result.upper.toString()).toBe('4427.425');
  });

  test('a round example: 100 to 200 widens to 50 and 250', () => {
    const result = range([bar(NOW - 600, '200', '100')]);
    expect(result.lower.toString()).toBe('50');
    expect(result.upper.toString()).toBe('250');
  });

  test('a flat day has no width to add', () => {
    const result = range([bar(NOW - 600, '4380', '4380')]);
    expect(result.lower.toString()).toBe('4380');
    expect(result.upper.toString()).toBe('4380');
  });

  test('says which bars it is made of', () => {
    const result = range(bars);
    expect(result.firstOpen).toBe(BigInt(NOW - 10800));
    expect(result.lastClose).toBe(BigInt(NOW - 600 + 300));
  });

  test('does not depend on the order of the bars', () => {
    const forward = text(range(bars));
    expect(text(range([...bars].reverse()))).toBe(forward);
    expect(text(range([bars[2]!, bars[0]!, bars[3]!, bars[1]!]))).toBe(forward);
  });

  test('reads text and numbers alike', () => {
    const asText = range([
      bar(`${NOW - 600}` as unknown as number, '4400.10', '4300'),
    ]);
    const asNumbers = range([{ openTime: NOW - 600, high: 4400.1, low: 4300 }]);
    expect(text(asText)).toBe(text(asNumbers));
  });
});

describe('dayRange: a bar that is not well formed makes the range unknown', () => {
  const good = bar(NOW - 600, '4400', '4300');

  test.each([
    ['an open time that is not a time', { ...good, openTime: 'noon' }],
    ['an open time of zero', { ...good, openTime: 0 }],
    ['a high that is not a number', { ...good, high: 'high' }],
    ['a high of zero', { ...good, high: 0 }],
    ['a low of zero', { ...good, low: 0 }],
    ['a negative low', { ...good, low: -5 }],
    ['a high below its low', { ...good, high: '4299', low: '4300' }],
  ])('%s', (_label, broken) => {
    const result = dayRange([good, broken], NOW);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('BAD_BAR');
  });

  test('wherever the bad bar is, even outside the window', () => {
    const old = bar(NOW - DAY - 5000, '4299', '4300');
    expect(dayRange([good, old], NOW)).toMatchObject({
      ok: false,
      code: 'BAD_BAR',
    });
    expect(dayRange([old, good], NOW)).toMatchObject({
      ok: false,
      code: 'BAD_BAR',
    });
  });

  test('a high equal to its low is fine', () => {
    expect(dayRange([bar(NOW - 600, '4300', '4300')], NOW).ok).toBe(true);
  });

  test('a clock that is not a time is refused', () => {
    expect(() => dayRange([good], 0)).toThrow(/nowSeconds/);
    expect(() => dayRange([good], 1.5)).toThrow(/nowSeconds/);
  });
});

describe('entryBounds', () => {
  const day = range([bar(NOW - 600, '4391.20', '4318.75')]);

  test('the day range and 5% of the live price, exactly', () => {
    const bounds = entryBounds(day, '4378.31');
    expect(bounds.day?.lower.toString()).toBe('4282.525');
    expect(bounds.day?.upper.toString()).toBe('4427.425');
    expect(bounds.typo?.lower.toString()).toBe('4159.3945');
    expect(bounds.typo?.upper.toString()).toBe('4597.2255');
  });

  test.each([null, 'live', 0, -4378])(
    'a live price of %p gives no typo bound',
    (live) => {
      const bounds = entryBounds(day, live);
      expect(bounds.typo).toBeNull();
      expect(bounds.day).not.toBeNull();
    }
  );

  test('an unknown range gives no day bound', () => {
    const bounds = entryBounds(dayRange([], NOW), 4378.31);
    expect(bounds.day).toBeNull();
    expect(bounds.typo).not.toBeNull();
  });
});

describe('checkEntryBound: the one-day range (check 0)', () => {
  const day = range([bar(NOW - 600, '4391.20', '4318.75')]);
  // widened: 4282.525 to 4427.425; 5% of the live price: 4159.3945 to 4597.2255
  const check = (entry: string) => checkEntryBound(entry, day, '4378.31');

  test.each([
    ['4282.525', true],
    ['4282.524', false],
    ['4427.425', true],
    ['4427.426', false],
    ['4378.31', true],
    ['4300', true],
    ['4282', false],
    ['4500', false],
  ])('an entry of %s: accepted %p', (entry, accepted) => {
    const result = check(entry);
    expect(result.ok).toBe(accepted);
    if (!result.ok) expect(result.code).toBe('ENTRY_OUTSIDE_DAY_RANGE');
  });

  test('the refusal names the bounds', () => {
    const result = check('4500');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.detail).toContain('4282.525');
      expect(result.detail).toContain('4427.425');
      expect(result.bounds.day?.upper.toString()).toBe('4427.425');
    }
  });

  test('the bounds come back with an acceptance too', () => {
    const result = check('4378.31');
    expect(result.ok).toBe(true);
    expect(result.bounds.typo?.lower.toString()).toBe('4159.3945');
  });
});

describe('checkEntryBound: the 5% typo filter', () => {
  // a day so wide that the filter, not the range, is what binds
  const wide = range([bar(NOW - 600, '4800', '4200')]);
  // widened: 3900 to 5100; 5% of 4378.31: 4159.3945 to 4597.2255
  const check = (entry: string) => checkEntryBound(entry, wide, '4378.31');

  test.each([
    ['4159.3945', true],
    ['4159.3944', false],
    ['4597.2255', true],
    ['4597.2256', false],
    ['43783.1', false],
    ['437.831', false],
  ])('an entry of %s: accepted %p', (entry, accepted) => {
    const result = check(entry);
    expect(result.ok).toBe(accepted);
    if (!result.ok) expect(result.code).toBe('ENTRY_TYPO');
  });

  test('the typo filter is looked at before the range', () => {
    // 43783.1 is outside both; the telling message is the typo
    const narrow = range([bar(NOW - 600, '4391.20', '4318.75')]);
    const result = checkEntryBound('43783.1', narrow, '4378.31');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('ENTRY_TYPO');
  });
});

describe('checkEntryBound: what is not known is a refusal', () => {
  const day = range([bar(NOW - 600, '4391.20', '4318.75')]);

  test('no live price', () => {
    const result = checkEntryBound('4378.31', day, null);
    expect(result).toMatchObject({ ok: false, code: 'LIVE_PRICE_UNKNOWN' });
  });

  test('no range, with the reason it is not known', () => {
    const result = checkEntryBound('4378.31', dayRange([], NOW), '4378.31');
    expect(result).toMatchObject({
      ok: false,
      code: 'DAY_RANGE_UNKNOWN',
      detail: 'there is no closed M5 bar in the last 24 hours',
    });
  });

  test('neither: the live price is named first', () => {
    const result = checkEntryBound('4378.31', dayRange([], NOW), null);
    expect(result).toMatchObject({ ok: false, code: 'LIVE_PRICE_UNKNOWN' });
  });

  test("an entry that is not a price is the caller's error", () => {
    expect(() => checkEntryBound('abc', day, '4378.31')).toThrow(/entry/);
    expect(() => checkEntryBound(0, day, '4378.31')).toThrow(/entry/);
    expect(() => checkEntryBound(-4378, day, '4378.31')).toThrow(/entry/);
  });
});
