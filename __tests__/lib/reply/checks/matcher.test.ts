/**
 * @jest-environment node
 */

import { extractNumbers } from '@/lib/reply/checks/extract';
import type { ExtractedNumber } from '@/lib/reply/checks/extract';
import {
  ELIGIBLE_KINDS,
  classOf,
  entryMatches,
  matchLiteral,
} from '@/lib/reply/checks/matcher';
import { NUMBER_CLASSES } from '@/lib/reply/contracts/trace-fields';

import { dictOf } from './helpers/checks-fixtures';

const first = (text: string, language = 'en'): ExtractedNumber => {
  const found = extractNumbers(text, 'p', language);
  const literal = found[0];
  if (literal === undefined) throw new Error(`no number in ${text}`);
  return literal;
};

const LOEDT = dictOf([{ id: 'MCD2.LOEDT', value: 4350.22 }]);

describe('the tolerance of a price is $0.05 and no more', () => {
  it.each([
    ['4350.22', true],
    ['4350.27', true],
    ['4350.17', true],
    ['4350.28', false],
    ['4350.16', false],
    ['4350.72', false],
    ['4350.2', true],
    ['4350.3', false],
    ['4350', false],
    ['4351', false],
  ])('%s against 4350.22 matches: %s', (text, expected) => {
    expect(matchLiteral(first(text), LOEDT).matched).toBe(expected);
  });

  it('is decided on integers, not floating point', () => {
    // 4350.27 - 4350.22 is 0.04999999999972 in floating point and 4350.28 - 4350.22 is 0.0600000000001
    const dictionary = dictOf([{ id: 'P', value: 4350.22 }]);
    expect(matchLiteral(first('4350.27'), dictionary).matched).toBe(true);
    expect(matchLiteral(first('4350.28'), dictionary).matched).toBe(false);
    const tenth = dictOf([{ id: 'P', value: 0.1 }]);
    expect(matchLiteral(first('0.15'), tenth).matched).toBe(true);
    expect(matchLiteral(first('0.16'), tenth).matched).toBe(false);
    const sum = dictOf([{ id: 'P', value: 0.1 + 0.2 }]);
    expect(matchLiteral(first('0.3'), sum).matched).toBe(true);
  });

  it('is the entry tolerance, whatever it is', () => {
    const wide = dictOf([{ id: 'P', value: 100, tolerance: 1 }]);
    expect(matchLiteral(first('101'), wide).matched).toBe(true);
    expect(matchLiteral(first('101.01'), wide).matched).toBe(false);
    const exact = dictOf([{ id: 'P', value: 100, tolerance: 0 }]);
    expect(matchLiteral(first('100'), exact).matched).toBe(true);
    expect(matchLiteral(first('100.01'), exact).matched).toBe(false);
  });

  it('passes a literal that matches any one of its two readings', () => {
    const thousands = dictOf([{ id: 'C', kind: 'COUNT', value: 4377 }]);
    const decimal = dictOf([{ id: 'P', kind: 'PRICE', value: 4.377 }]);
    expect(matchLiteral(first('4.377'), thousands).matched).toBe(true);
    expect(matchLiteral(first('4,377'), thousands).matched).toBe(true);
    expect(matchLiteral(first('4.377'), decimal).matched).toBe(true);
    expect(matchLiteral(first('4.378'), decimal).matched).toBe(true);
    expect(matchLiteral(first('4.38'), decimal).matched).toBe(true);
    expect(matchLiteral(first('4.42'), decimal).matched).toBe(true);
    expect(matchLiteral(first('4.43'), decimal).matched).toBe(false);
  });

  it('compares the magnitude: a sign does not matter', () => {
    expect(matchLiteral(first('-4350.22'), LOEDT).matched).toBe(true);
  });

  it('returns the entry it matched', () => {
    const dictionary = dictOf([
      { id: 'A', value: 1 },
      { id: 'B', value: 4350.22 },
    ]);
    expect(matchLiteral(first('4350.22'), dictionary).entry?.id).toBe('B');
    expect(matchLiteral(first('2'), dictionary).entry).toBeNull();
  });
});

describe('percentages, ratios and counts are exact', () => {
  const dictionary = dictOf([
    { id: 'PROFILE.max_risk_pct', kind: 'PCT', value: 1 },
    { id: 'X.containment_rate', kind: 'PCT', value: 73.95 },
    { id: 'PROFILE.target_rrr', kind: 'RATIO', value: 2.5 },
    { id: 'Z1.runway_ratio', kind: 'RATIO', value: 0.14 },
    { id: 'MCD2.details.window_bars', kind: 'COUNT', value: 288 },
  ]);

  it.each([
    ['73.95%', true],
    ['73.9%', false],
    ['74%', false],
    ['73.95 percent', true],
    ['1%', true],
    ['1.0%', true],
    ['2%', false],
    ['82%', false],
  ])('%s matches: %s', (text, expected) => {
    expect(matchLiteral(first(text), dictionary).matched).toBe(expected);
  });

  it.each([
    ['2.5x', true],
    ['x2.5', true],
    ['1:2.5', true],
    ['2.5:1', true],
    ['1:2.4', false],
    ['3x', false],
  ])('the ratio %s matches: %s', (text, expected) => {
    expect(matchLiteral(first(text), dictionary).matched).toBe(expected);
  });

  it('matches a count exactly, and a bare number against every kind but a time', () => {
    expect(matchLiteral(first('288 bars'), dictionary).matched).toBe(true);
    expect(matchLiteral(first('289 bars'), dictionary).matched).toBe(false);
    expect(matchLiteral(first('2.5'), dictionary).matched).toBe(true);
    expect(matchLiteral(first('73.95'), dictionary).matched).toBe(true);
    expect(matchLiteral(first('0.14'), dictionary).matched).toBe(true);
  });

  it('never excuses a figure with a value of another kind', () => {
    const prices = dictOf([{ id: 'P', kind: 'PRICE', value: 82 }]);
    expect(matchLiteral(first('82%'), prices).matched).toBe(false);
    expect(matchLiteral(first('82x'), prices).matched).toBe(false);
    expect(matchLiteral(first('1:82'), prices).matched).toBe(false);
    expect(matchLiteral(first('$82'), prices).matched).toBe(true);
    expect(matchLiteral(first('82'), prices).matched).toBe(true);
    const pcts = dictOf([{ id: 'P', kind: 'PCT', value: 82 }]);
    expect(matchLiteral(first('$82'), pcts).matched).toBe(false);
    expect(matchLiteral(first('82x'), pcts).matched).toBe(false);
  });
});

describe('a time matches to the minute, or to the second when the literal says seconds', () => {
  const at = Date.UTC(2026, 8, 18, 12, 30, 30) / 1000;
  const dictionary = dictOf([{ id: 'EVENT1.time', kind: 'TIME', value: at }]);

  it.each([
    ['12:30', true],
    ['12:30:30', true],
    ['12:30:00', false],
    ['12:30:31', false],
    ['12:31', false],
    ['12:29', false],
    ['00:30', false],
    ['0:30', false],
  ])('%s matches: %s', (text, expected) => {
    expect(matchLiteral(first(text), dictionary).matched).toBe(expected);
  });

  it('ignores the date of the stored time', () => {
    const other = dictOf([
      { id: 'T', kind: 'TIME', value: Date.UTC(2020, 0, 1, 12, 30) / 1000 },
    ]);
    expect(matchLiteral(first('12:30'), other).matched).toBe(true);
  });

  it('reads a clock-only value (seconds since midnight)', () => {
    const clock = dictOf([
      { id: 'T', kind: 'TIME', value: 20 * 3600 + 55 * 60 },
    ]);
    expect(matchLiteral(first('20:55'), clock).matched).toBe(true);
    expect(matchLiteral(first('20:56'), clock).matched).toBe(false);
  });

  it('reads a time before the epoch as the clock of that day', () => {
    const before = dictOf([{ id: 'T', kind: 'TIME', value: -3600 }]);
    expect(matchLiteral(first('23:00'), before).matched).toBe(true);
    expect(matchLiteral(first('01:00'), before).matched).toBe(false);
  });

  it('does not match a time with a price that has the same digits, or the other way round', () => {
    const prices = dictOf([{ id: 'P', value: 1230 }]);
    expect(matchLiteral(first('12:30'), prices).matched).toBe(false);
    expect(matchLiteral(first('1230'), dictionary).matched).toBe(false);
  });
});

describe('eligibility', () => {
  it('lists the kinds each way of writing a number can match', () => {
    expect(ELIGIBLE_KINDS.CLOCK).toEqual(['TIME']);
    expect(ELIGIBLE_KINDS.PERCENT).toEqual(['PCT']);
    expect(ELIGIBLE_KINDS.RATIO).toEqual(['RATIO']);
    expect(ELIGIBLE_KINDS.MONEY).toEqual(['PRICE', 'DISTANCE']);
    expect(ELIGIBLE_KINDS.BARE).toEqual([
      'PRICE',
      'DISTANCE',
      'RATIO',
      'PCT',
      'COUNT',
    ]);
  });

  it('refuses an entry of a kind the literal cannot be', () => {
    const time = dictOf([{ id: 'T', kind: 'TIME', value: 1 }])
      .entries[0] as never;
    expect(entryMatches(time, first('1'))).toBe(false);
  });

  it('gives a clock with no clock data no match', () => {
    const literal = { ...first('12:30'), clock: null };
    const time = dictOf([{ id: 'T', kind: 'TIME', value: 45000 }])
      .entries[0] as never;
    expect(entryMatches(time, literal)).toBe(false);
  });

  it('gives a literal that could not be read no match', () => {
    const literal = first('1234567890123456');
    expect(literal.readings).toEqual([]);
    expect(
      matchLiteral(literal, dictOf([{ id: 'P', value: 1234567890123456 }]))
        .matched
    ).toBe(false);
  });
});

describe('the class of a literal that did not match', () => {
  it.each([
    ['12:30', 'TIME'],
    ['82%', 'PCT'],
    ['82 percent', 'PCT'],
    ['2.5x', 'RATIO'],
    ['1:2.5', 'RATIO'],
    ['$5000', 'PRICE'],
    ['$1000', 'PRICE'],
    ['$1000.5', 'PRICE'],
    ['$999.99', 'DISTANCE'],
    ['$0.50', 'DISTANCE'],
    ['4350.72', 'PRICE'],
    ['1000', 'PRICE'],
    ['999', 'COUNT'],
    ['288', 'COUNT'],
    ['100', 'COUNT'],
    ['16.78', 'DISTANCE'],
    ['10.0', 'DISTANCE'],
    ['9.99', 'RATIO'],
    ['0.8192', 'RATIO'],
    ['1234567890123456', 'PRICE'],
  ])('%s is %s', (text, expected) => {
    expect(classOf(first(text))).toBe(expected);
  });

  it('is always one of the six classes of the trace', () => {
    for (const text of ['1', '12:30', '5%', '2x', '$3', '4,377', '0.5']) {
      expect(NUMBER_CLASSES).toContain(classOf(first(text)));
    }
  });

  it('takes the larger reading of a number with two', () => {
    expect(classOf(first('4.377'))).toBe('PRICE');
  });
});

describe('exactness to the millionth', () => {
  it('tells 0.123456 from 0.123457 for an exact entry, and does not for a price', () => {
    const exact = dictOf([{ id: 'R', kind: 'RATIO', value: 0.123456 }]);
    expect(matchLiteral(first('0.123456'), exact).matched).toBe(true);
    expect(matchLiteral(first('0.123457'), exact).matched).toBe(false);
    expect(matchLiteral(first('0.123455'), exact).matched).toBe(false);
    const price = dictOf([{ id: 'P', value: 100.123456 }]);
    expect(matchLiteral(first('100.17'), price).matched).toBe(true);
    expect(matchLiteral(first('100.18'), price).matched).toBe(false);
  });
});
