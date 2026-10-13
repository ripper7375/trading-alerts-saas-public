/**
 * @jest-environment node
 */

/**
 * Cycle slots and event times as text, with no `Date` in the code under test
 * (`lib/intake/slots.ts`). The calendar arithmetic is held to `Date` here, which the pure
 * files may not use, over every slot of two years and the edges of the range.
 */

import {
  MAX_SECONDS,
  SLOT_SECONDS,
  boardStamp,
  clockOf,
  isEpochSeconds,
  isSlotSeconds,
  secondsOfSlot,
  shiftSlot,
  slotIso,
  timeIso,
} from '@/lib/intake';

const dateIso = (seconds: number): string =>
  new Date(seconds * 1000).toISOString();

describe('slotIso and timeIso', () => {
  it('equal Date for every slot of 2026 and 2027', () => {
    const from = Date.UTC(2026, 0, 1) / 1000;
    const to = Date.UTC(2028, 0, 1) / 1000;
    let checked = 0;
    for (let s = from; s < to; s += SLOT_SECONDS) {
      const expected = dateIso(s);
      if (slotIso(s) !== `${expected.slice(0, 16)}Z`) {
        throw new Error(`slotIso(${s}) = ${slotIso(s)}, Date says ${expected}`);
      }
      checked += 1;
    }
    expect(checked).toBe(210_240);
  });

  it.each([
    ['the epoch', 0],
    ['the last second of 1999', Date.UTC(1999, 11, 31, 23, 59, 59) / 1000],
    ['a leap day, 2000', Date.UTC(2000, 1, 29, 12, 30, 45) / 1000],
    [
      'the day after 28 Feb 2100, which is not a leap year',
      Date.UTC(2100, 2, 1, 0, 0, 5) / 1000,
    ],
    ['29 Feb 2028', Date.UTC(2028, 1, 29, 23, 59, 59) / 1000],
    ['1 Mar 1970', Date.UTC(1970, 2, 1, 0, 0, 1) / 1000],
    ['the end of the range', MAX_SECONDS],
  ])('timeIso equals Date at %s', (_name, seconds) => {
    expect(timeIso(seconds)).toBe(`${dateIso(seconds).slice(0, 19)}Z`);
  });

  it('writes the cycle the plan and the architecture name', () => {
    expect(slotIso(Date.UTC(2026, 8, 18, 20, 55) / 1000)).toBe(
      '2026-09-18T20:55Z'
    );
    expect(timeIso(Date.UTC(2026, 8, 18, 21, 30) / 1000)).toBe(
      '2026-09-18T21:30:00Z'
    );
  });

  it.each([-1, 1.5, NaN, Infinity, MAX_SECONDS + 1])('refuses %p', (value) => {
    expect(() => slotIso(value)).toThrow(RangeError);
    expect(() => timeIso(value)).toThrow(RangeError);
    expect(() => boardStamp(value)).toThrow(RangeError);
    expect(() => clockOf(value)).toThrow(RangeError);
  });
});

describe('secondsOfSlot', () => {
  it('reads back what slotIso wrote, for every slot of a leap year', () => {
    const from = Date.UTC(2028, 0, 1) / 1000;
    const to = Date.UTC(2029, 0, 1) / 1000;
    for (let s = from; s < to; s += SLOT_SECONDS) {
      if (secondsOfSlot(slotIso(s)) !== s)
        throw new Error(`no round trip at ${s}`);
    }
  });

  it.each([
    '2026-02-30T10:00Z', // no 30 February
    '2026-02-29T10:00Z', // 2026 is not a leap year
    '2026-04-31T10:00Z',
    '2026-13-01T10:00Z',
    '2026-00-10T10:00Z',
    '2026-09-00T10:00Z',
    '2026-09-18T24:00Z',
    '2026-09-18T20:60Z',
    '2026-09-18T20:57Z', // not a multiple of five minutes
    '2026-09-18T20:55:00Z', // seconds: that is a time, not a slot
    '2026-09-18 20:55Z',
    '2026-9-18T20:55Z',
    '26-09-18T20:55Z',
    '2026-09-18T20:55',
    '',
  ])('refuses %p', (text) => {
    expect(secondsOfSlot(text)).toBeNull();
  });

  it('accepts a real leap day', () => {
    expect(secondsOfSlot('2028-02-29T10:00Z')).toBe(
      Date.UTC(2028, 1, 29, 10) / 1000
    );
  });

  it.each([null, undefined, 5, {}, []])('refuses a non-string %p', (value) => {
    expect(secondsOfSlot(value)).toBeNull();
  });
});

describe('shiftSlot', () => {
  it('moves by whole slots, across an hour, a day and a year', () => {
    expect(shiftSlot('2026-09-18T20:55Z', 1)).toBe('2026-09-18T21:00Z');
    expect(shiftSlot('2026-09-18T20:55Z', -1)).toBe('2026-09-18T20:50Z');
    expect(shiftSlot('2026-12-31T23:55Z', 1)).toBe('2027-01-01T00:00Z');
    expect(shiftSlot('2026-09-18T00:00Z', -1)).toBe('2026-09-17T23:55Z');
    expect(shiftSlot('2026-09-18T20:55Z', 0)).toBe('2026-09-18T20:55Z');
  });

  it('answers null for a bad slot, a fraction, or a result outside the range', () => {
    expect(shiftSlot('nonsense', 1)).toBeNull();
    expect(shiftSlot('2026-09-18T20:55Z', 0.5)).toBeNull();
    expect(shiftSlot('1970-01-01T00:00Z', -1)).toBeNull();
    expect(shiftSlot('9999-12-31T23:55Z', 1)).toBeNull();
  });
});

describe('the board stamp and the clock', () => {
  it('writes the header stamp of 4.4', () => {
    const at = Date.UTC(2026, 8, 18, 20, 55) / 1000;
    expect(boardStamp(at)).toBe('18 SEP 20:55');
    expect(clockOf(at)).toBe('20:55');
  });

  it('names all twelve months and pads day and time', () => {
    const names = [
      'JAN',
      'FEB',
      'MAR',
      'APR',
      'MAY',
      'JUN',
      'JUL',
      'AUG',
      'SEP',
      'OCT',
      'NOV',
      'DEC',
    ];
    names.forEach((name, month) => {
      expect(boardStamp(Date.UTC(2026, month, 1, 5, 5) / 1000)).toBe(
        `01 ${name} 05:05`
      );
    });
  });
});

describe('the range guards', () => {
  it('knows a slot from a time and a time from nothing', () => {
    expect(isEpochSeconds(0)).toBe(true);
    expect(isEpochSeconds(MAX_SECONDS)).toBe(true);
    expect(isEpochSeconds(MAX_SECONDS + 1)).toBe(false);
    expect(isEpochSeconds(-1)).toBe(false);
    expect(isEpochSeconds('5')).toBe(false);
    expect(isSlotSeconds(300)).toBe(true);
    expect(isSlotSeconds(301)).toBe(false);
    expect(isSlotSeconds(0)).toBe(true);
  });
});

describe('the calendar, day by day', () => {
  const DAY = 86_400;
  const FIRST = 0;
  const LAST = Date.UTC(2600, 11, 31) / 1000 / DAY;

  it('equals Date at the first and the last second of every day from 1970 to 2600', () => {
    let checked = 0;
    for (let day = FIRST; day <= LAST; day += 1) {
      for (const at of [day * DAY, day * DAY + DAY - 1]) {
        const expected = new Date(at * 1000)
          .toISOString()
          .replace('.000Z', 'Z');
        if (timeIso(at) !== expected) {
          throw new Error(
            `timeIso(${at}) = ${timeIso(at)}, Date says ${expected}`
          );
        }
      }
      checked += 1;
    }
    expect(checked).toBe(LAST + 1);
  });

  it('reads back the midnight of every day from 1970 to 2600', () => {
    for (let day = FIRST; day <= LAST; day += 1) {
      const at = day * DAY;
      if (secondsOfSlot(slotIso(at)) !== at)
        throw new Error(`no round trip on day ${day}`);
    }
  });

  it.each([
    ['2000-03-01', [2000, 2, 1]],
    ['2100-03-01, which is not after a leap day', [2100, 2, 1]],
    ['2400-03-01', [2400, 2, 1]],
    ['2800-03-01', [2800, 2, 1]],
    ['2000-12-31 and 2400-12-31', [2000, 11, 31]],
  ])('is right across the era edge at %s', (_name, [year, month, day]) => {
    const start =
      Date.UTC(year as number, month as number, day as number) / 1000;
    for (let offset = -6 * DAY; offset <= 6 * DAY; offset += 3_600) {
      const at = start + offset;
      expect(timeIso(at)).toBe(
        new Date(at * 1000).toISOString().replace('.000Z', 'Z')
      );
      expect(secondsOfSlot(slotIso(at))).toBe(at - (at % 60));
    }
  });

  it('knows the last second of the range and the year 9999', () => {
    expect(MAX_SECONDS).toBe(253_402_300_799);
    expect(MAX_SECONDS).toBe(Date.UTC(9999, 11, 31, 23, 59, 59) / 1000);
    expect(timeIso(MAX_SECONDS)).toBe('9999-12-31T23:59:59Z');
    expect(slotIso(MAX_SECONDS - 59)).toBe('9999-12-31T23:59Z');
    expect(secondsOfSlot('9999-12-31T23:55Z')).toBe(MAX_SECONDS - 299);
    expect(secondsOfSlot('9999-12-31T23:59Z')).toBeNull(); // not a multiple of five minutes
    expect(isEpochSeconds(MAX_SECONDS)).toBe(true);
    expect(isEpochSeconds(MAX_SECONDS + 1)).toBe(false);
  });
});

describe('the parts of a slot text', () => {
  it.each([
    'x2026-09-18T20:55Z',
    ' 2026-09-18T20:55Z',
    '2026-09-18T20:55Zx',
    '2026-09-18T20:55Z ',
    '2026-09-18T20:55Z\n',
    '12026-09-18T20:55Z',
  ])('refuses text around a slot: %j', (text) => {
    expect(secondsOfSlot(text)).toBeNull();
  });

  it.each([
    ['2026-12-31T23:55Z', true],
    ['2026-12-32T10:00Z', false],
    ['2026-01-00T10:00Z', false],
    ['2026-00-15T10:00Z', false],
    ['2026-13-15T10:00Z', false],
    ['2026-09-18T23:55Z', true],
    ['2026-09-18T24:00Z', false],
    ['2026-09-18T00:00Z', true],
    ['2026-09-18T20:59Z', false],
    ['2026-09-18T20:60Z', false],
    ['2026-09-18T20:00Z', true],
    ['2026-02-28T10:00Z', true],
    ['2028-02-29T10:00Z', true],
    ['2100-02-29T10:00Z', false],
    ['2000-02-29T10:00Z', true],
    ['0000-01-01T00:00Z', false],
    ['1969-12-31T23:55Z', false],
    ['1970-01-01T00:00Z', true],
  ])('%s is a slot: %s', (text, valid) => {
    expect(secondsOfSlot(text) !== null).toBe(valid);
  });
});

describe('the wording of the refusals and the padding of a clock', () => {
  it('names the range in every refusal', () => {
    for (const call of [
      () => slotIso(-1),
      () => timeIso(-1),
      () => boardStamp(-1),
      () => clockOf(-1),
    ]) {
      expect(call).toThrow(new RangeError('not a time in 1970..9999'));
    }
  });

  it('pads the hour and the minute of a clock', () => {
    expect(clockOf(Date.UTC(2026, 0, 1, 5, 5) / 1000)).toBe('05:05');
    expect(clockOf(Date.UTC(2026, 0, 1, 0, 0) / 1000)).toBe('00:00');
    expect(clockOf(Date.UTC(2026, 0, 1, 23, 59) / 1000)).toBe('23:59');
  });

  it('pads every part of a time, and writes a year of four digits', () => {
    expect(timeIso(Date.UTC(2026, 0, 2, 3, 4, 5) / 1000)).toBe(
      '2026-01-02T03:04:05Z'
    );
    expect(slotIso(Date.UTC(2026, 0, 2, 3, 5) / 1000)).toBe(
      '2026-01-02T03:05Z'
    );
  });
});
