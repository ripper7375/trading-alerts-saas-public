/**
 * @jest-environment node
 */

/**
 * The period of the quota ledger: a UTC calendar month (build step 7 part 6; decision D2).
 */

import {
  FIRST_YEAR,
  LAST_YEAR,
  MONTH,
  isMonth,
  monthOf,
  monthStartMs,
  nextMonth,
  nextMonthStartMs,
} from '@/lib/platform/metering/period';

describe('monthOf', () => {
  it.each([
    [Date.UTC(2026, 9, 15, 10, 0, 0), '2026-10'],
    [Date.UTC(2026, 0, 1, 0, 0, 0, 0), '2026-01'],
    [Date.UTC(2026, 11, 31, 23, 59, 59, 999), '2026-12'],
    [Date.UTC(2028, 1, 29, 12), '2028-02'],
    [Date.UTC(2000, 0, 1), '2000-01'],
    [Date.UTC(9998, 11, 31, 23, 59, 59, 999), '9998-12'],
  ])('the instant %d is %s', (ms, month) => {
    expect(monthOf(ms)).toBe(month);
  });

  it('puts the last millisecond of October and the first of November in two months', () => {
    expect(monthOf(Date.UTC(2026, 9, 31, 23, 59, 59, 999))).toBe('2026-10');
    expect(monthOf(Date.UTC(2026, 10, 1, 0, 0, 0, 0))).toBe('2026-11');
  });

  it('rolls the year: the last millisecond of December and the first of January', () => {
    expect(monthOf(Date.UTC(2026, 11, 31, 23, 59, 59, 999))).toBe('2026-12');
    expect(monthOf(Date.UTC(2027, 0, 1, 0, 0, 0, 0))).toBe('2027-01');
  });

  it('is UTC, whatever the offset the instant was written with', () => {
    // 2026-11-01T01:30 in UTC+3 is still October 31 in UTC
    expect(monthOf(Date.parse('2026-11-01T01:30:00+03:00'))).toBe('2026-10');
    // 2026-10-31T22:30 in UTC-3 is already November 1 in UTC
    expect(monthOf(Date.parse('2026-10-31T22:30:00-03:00'))).toBe('2026-11');
  });

  it.each([
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    Date.UTC(1999, 11, 31, 23, 59, 59, 999),
    Date.UTC(9999, 0, 1),
    -1,
    8.64e15 + 1,
    '2026-10-15' as unknown as number,
    null as unknown as number,
    undefined as unknown as number,
  ])('is null for the non-instant %p', (ms) => {
    expect(monthOf(ms)).toBeNull();
  });

  it('knows the years of the ledger', () => {
    expect(FIRST_YEAR).toBe(2000);
    expect(LAST_YEAR).toBe(9998);
  });
});

describe('isMonth', () => {
  it.each(['2026-10', '2026-01', '2026-12', '2000-02', '9999-09'])(
    'accepts %s',
    (value) => {
      expect(isMonth(value)).toBe(true);
    }
  );

  it.each([
    '2026-00',
    '2026-13',
    '2026-1',
    '26-10',
    '2026/10',
    '2026-10-01',
    ' 2026-10',
    '2026-10 ',
    '2026-10\n',
    '',
    'oct 2026',
    null,
    undefined,
    202610,
  ])('refuses %p', (value) => {
    expect(isMonth(value)).toBe(false);
  });

  it('is the database’s pattern', () => {
    expect(MONTH.source).toBe('^[0-9]{4}-(0[1-9]|1[0-2])$');
  });
});

describe('monthStartMs and nextMonthStartMs', () => {
  it('are the first instants of a month and the one after', () => {
    expect(monthStartMs('2026-10')).toBe(Date.UTC(2026, 9, 1));
    expect(nextMonthStartMs('2026-10')).toBe(Date.UTC(2026, 10, 1));
    expect(nextMonthStartMs('2026-12')).toBe(Date.UTC(2027, 0, 1));
  });

  it('give a period of 28, 29, 30 and 31 days where the calendar does', () => {
    const days = (month: string): number =>
      ((nextMonthStartMs(month) as number) - (monthStartMs(month) as number)) /
      86_400_000;
    expect(days('2026-02')).toBe(28);
    expect(days('2028-02')).toBe(29);
    expect(days('2026-04')).toBe(30);
    expect(days('2026-10')).toBe(31);
  });

  it('agree with monthOf at the edges of every month of three years', () => {
    for (let year = 2026; year <= 2028; year += 1) {
      for (let index = 0; index < 12; index += 1) {
        const month = `${year}-${String(index + 1).padStart(2, '0')}`;
        const start = monthStartMs(month) as number;
        const next = nextMonthStartMs(month) as number;
        expect(monthOf(start)).toBe(month);
        expect(monthOf(next - 1)).toBe(month);
        expect(monthOf(next)).toBe(nextMonth(month));
      }
    }
  });

  it('are null for a string that is not a month', () => {
    expect(monthStartMs('2026-13')).toBeNull();
    expect(nextMonthStartMs('nope')).toBeNull();
    expect(nextMonth('2026-1')).toBeNull();
  });
});

describe('nextMonth', () => {
  it.each([
    ['2026-10', '2026-11'],
    ['2026-11', '2026-12'],
    ['2026-12', '2027-01'],
    ['2026-01', '2026-02'],
  ])('%s is followed by %s', (month, next) => {
    expect(nextMonth(month)).toBe(next);
  });
});

describe('the module reads no clock', () => {
  it('has no default time: every function takes one', () => {
    expect(monthOf.length).toBe(1);
    expect(monthStartMs.length).toBe(1);
  });
});
