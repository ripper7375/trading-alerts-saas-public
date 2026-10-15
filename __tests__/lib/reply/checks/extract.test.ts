/**
 * @jest-environment node
 */

import { DIGIT_ZEROS } from '@/lib/reply/contracts/intake';
import {
  SMALL_COUNT_DIGITS,
  UNIT_WORDS,
  extractNumbers,
  readNumber,
} from '@/lib/reply/checks/extract';
import type { ExtractedNumber } from '@/lib/reply/checks/extract';

import {
  DIGIT_RUNS,
  LRM,
  NBSP,
  NOTATIONS,
  SCRIPTS,
  THIN_NBSP,
  ZWSP,
  withDigits,
} from './helpers/checks-fixtures';

const judged = (text: string, language = 'en'): ExtractedNumber[] =>
  extractNumbers(text, 'p', language).filter((n) => n.exempt === null);
const all = (text: string, language = 'en'): ExtractedNumber[] =>
  extractNumbers(text, 'p', language);
const readings = (text: string, language = 'en'): number[][] =>
  judged(text, language).map((n) => n.readings);

describe('readNumber', () => {
  it.each([
    ['4350', [4350], true],
    ['4350.72', [4350.72], false],
    ['4350,72', [4350.72], false],
    ['4,350.72', [4350.72], false],
    ['4.350,72', [4350.72], false],
    ['1,234,567', [1234567], false],
    ['1.234.567', [1234567], false],
    ['12,34,567', [1234567], false],
    ['0,75', [0.75], false],
    ['0.75', [0.75], false],
    ['4350٫72', [4350.72], false],
    ['4.377', [4.377, 4377], false],
    ['4,377', [4.377, 4377], false],
    ['4.37', [4.37], false],
    ['43.770', [43.77, 43770], false],
    ['1.5', [1.5], false],
    ['999,999', [999.999, 999999], false],
  ] as const)('%s reads as %j', (token, values, integer) => {
    const read = readNumber(token);
    expect(read).not.toBeNull();
    expect(read?.values).toEqual(values);
    expect(read?.integer).toBe(integer);
  });

  it.each([
    '1.2.3',
    '4350.16,4367.20',
    '1,234.567,89',
    '12.345.67',
    '1,23,4567',
    '0,123,456',
    '4.350٫72٫1',
    '',
    'abc',
    '4350.',
  ])('%s is not one number', (token) => {
    expect(readNumber(token)).toBeNull();
  });

  it('holds sixteen digits or more as unreadable rather than inexact', () => {
    expect(readNumber('1234567890123456')).toEqual({
      values: [],
      integer: true,
    });
    expect(readNumber('123456789012345')?.values).toEqual([123456789012345]);
  });
});

describe('the notations of the 19 locales', () => {
  it.each(NOTATIONS.map((n) => [n.name, n.text] as const))(
    '%s: %s is 4350.72',
    (_name, text) => {
      const found = judged(`price ${text} now`);
      expect(found).toHaveLength(1);
      expect(found[0]?.readings).toEqual([4350.72]);
      expect(found[0]?.raw).toBe(text);
    }
  );

  it('keeps both readings of a number with one separator and exactly three digits after it', () => {
    expect(readings('about 4.377 here')).toEqual([[4.377, 4377]]);
    expect(readings('about 4,377 here')).toEqual([[4.377, 4377]]);
    expect(readings('about 14.377 here')).toEqual([[14.377, 14377]]);
  });

  it('does not offer thousands to a number that cannot be one', () => {
    expect(readings('about 0.377 here')).toEqual([[0.377]]);
    expect(readings('about 4.37 here')).toEqual([[4.37]]);
    expect(readings('about 4.3777 here')).toEqual([[4.3777]]);
  });

  it('reads two prices written with a comma and no space as two numbers', () => {
    expect(readings('levels 4350.16,4367.20 hold')).toEqual([
      [4350.16],
      [4367.2],
    ]);
  });

  it('reads a list of numbers separated by comma and space as separate numbers', () => {
    expect(readings('levels 4350.16, 4367.20 and 4379.07')).toEqual([
      [4350.16],
      [4367.2],
      [4379.07],
    ]);
  });

  it('does not join a number to the one before it across a full stop and a space', () => {
    expect(readings('it closed at 4350.16. 4367.20 is next')).toEqual([
      [4350.16],
      [4367.2],
    ]);
  });

  it('reads a space or a no-break space only as a group of three digits', () => {
    expect(readings(`from 12${NBSP}345.67 up`)).toEqual([[12345.67]]);
    expect(readings('from 12 345.67 up')).toEqual([[12345.67]]);
    expect(readings('between 4350 and 4367')).toEqual([[4350], [4367]]);
    expect(readings('the 5 400 level')).toEqual([[5400]]);
    expect(readings('2 closes and 15 minutes')).toEqual([]);
  });

  it('ignores the sign of a number', () => {
    expect(readings('slope -29.72 degrees')).toEqual([[29.72]]);
    expect(
      readings('slope ' + String.fromCharCode(0x2212) + '29.72 degrees')
    ).toEqual([[29.72]]);
  });
});

describe('the digits of every script', () => {
  it('knows the 76 runs of the intake path', () => {
    expect(DIGIT_RUNS).toBe(DIGIT_ZEROS);
    expect(DIGIT_RUNS.length).toBeGreaterThanOrEqual(76);
  });

  it.each(DIGIT_RUNS.map((zero) => [zero.toString(16), zero] as const))(
    'the digit run at U+%s folds to ASCII',
    (_hex, zero) => {
      const text = withDigits('price 4350.72 now', zero);
      const found = judged(text);
      expect(found).toHaveLength(1);
      expect(found[0]?.readings).toEqual([4350.72]);
      expect(found[0]?.raw).toBe(withDigits('4350.72', zero));
    }
  );

  it.each(SCRIPTS.map((s) => [s.name, s.zero] as const))(
    '%s digits with the notations of the locales',
    (_name, zero) => {
      for (const { text } of NOTATIONS) {
        const found = judged(withDigits(`at ${text} now`, zero));
        expect(found).toHaveLength(1);
        expect(found[0]?.readings).toEqual([4350.72]);
      }
    }
  );

  it('reads the Arabic decimal and thousands marks', () => {
    const arabic = String.fromCharCode(0x066b);
    const thousands = String.fromCharCode(0x066c);
    expect(readings(withDigits(`4350${arabic}72`, 0x0660))).toEqual([
      [4350.72],
    ]);
    expect(readings(withDigits(`4${thousands}350${arabic}72`, 0x0660))).toEqual(
      [[4350.72]]
    );
  });

  it('reads the full-width signs', () => {
    const text =
      withDigits('82', 0xff10) +
      String.fromCharCode(0xff05) +
      ' and ' +
      String.fromCharCode(0xff04) +
      withDigits('0.50', 0xff10).replace('.', String.fromCharCode(0xff0e));
    const found = judged(text);
    expect(found.map((n) => n.syntax)).toEqual(['PERCENT', 'MONEY']);
    expect(found.map((n) => n.readings)).toEqual([[82], [0.5]]);
  });

  it('skips the invisible marks right-to-left text is full of', () => {
    const text = withDigits(`4350${LRM}.${ZWSP}72`, 0x0660);
    const found = judged(`at ${text} now`);
    expect(found).toHaveLength(1);
    expect(found[0]?.readings).toEqual([4350.72]);
    expect(found[0]?.raw).toBe(text);
  });
});

describe('what a literal is', () => {
  const syntax = (text: string, language = 'en'): string[] =>
    judged(text, language).map((n) => n.syntax);

  it.each([
    ['$0.50 away', 'MONEY'],
    ['$ 0.50 away', 'MONEY'],
    ['0.50 USD away', 'MONEY'],
    ['USD 0.50 away', 'MONEY'],
    ['usd 0.50', 'MONEY'],
    ['US$0.50', 'MONEY'],
    ['50 dollars away', 'MONEY'],
    ['50 bucks', 'MONEY'],
    ['82% chance', 'PERCENT'],
    ['82 % chance', 'PERCENT'],
    ['82 percent chance', 'PERCENT'],
    ['82 per cent', 'PERCENT'],
    ['the ratio is 2.5x', 'RATIO'],
    ['the ratio is 2.5 x', 'RATIO'],
    ['the ratio is 2.5×', 'RATIO'],
    ['the ratio is x2.5', 'RATIO'],
    ['at 4350.72', 'BARE'],
    ['at 0.8192', 'BARE'],
  ])('%s is %s', (text, expected) => {
    expect(syntax(text)).toEqual([expected]);
  });

  it('reads a clock with its minute and its second', () => {
    const [a, b, c] = judged('at 21:00 and 7:05 and 21:00:05 UTC');
    expect(a?.syntax).toBe('CLOCK');
    expect(a?.clock).toEqual({ minuteOfDay: 1260, second: null });
    expect(b?.clock).toEqual({ minuteOfDay: 425, second: null });
    expect(c?.clock).toEqual({ minuteOfDay: 1260, second: 5 });
    expect(a?.readings).toEqual([]);
  });

  it('does not read an hour of 24 or more, or minutes of 60 or more, as a clock', () => {
    expect(judged('at 24:00 UTC').some((n) => n.syntax === 'CLOCK')).toBe(
      false
    );
    expect(judged('at 21:60 UTC').some((n) => n.syntax === 'CLOCK')).toBe(
      false
    );
  });

  it('reads a ratio as the second over the first, and the other way too', () => {
    const [ratio] = judged('a 1:2.5 setup');
    expect(ratio?.syntax).toBe('RATIO');
    expect(ratio?.readings).toEqual([2.5, 0.4]);
    expect(judged('a 3 : 1 setup')[0]?.readings).toEqual([0.333333, 3]);
    expect(judged('risk 1:3')[0]?.readings).toEqual([3, 0.333333]);
  });

  it('does not call a number a percentage because a percent sign is somewhere else', () => {
    expect(syntax('10% then 5 bars')).toEqual(['PERCENT']);
    expect(all('10% then 5 bars').map((n) => n.exempt)).toEqual([
      null,
      'SMALL_COUNT',
    ]);
  });

  it('does not call 5 xau a multiple', () => {
    expect(all('5 xauusd lots').map((n) => n.syntax)).toEqual(['BARE']);
  });

  it('knows the word for percent and for dollars in each language', () => {
    const percent: [string, string][] = [
      ['en', '82 percent'],
      ['es', '82 por ciento'],
      ['de', '82 Prozent'],
      ['pt', '82 por cento'],
      ['it', '82 per cento'],
      ['ja', '82パーセント'],
      ['ar', '82 في المئة'],
      ['fr', '82 pour cent'],
      ['ko', '82퍼센트'],
      ['zh', '百分之82'],
      ['zh-TW', '百分之82'],
      ['ur', '82 فیصد'],
      ['hi', '82 प्रतिशत'],
      ['vi', '82 phần trăm'],
      ['id', '82 persen'],
      ['th', '82 เปอร์เซ็นต์'],
      ['tr', 'yüzde 82'],
    ];
    for (const [language, text] of percent) {
      const found = all(text, language);
      expect({
        language,
        syntax: found[0]?.syntax,
        exempt: found[0]?.exempt,
      }).toEqual({
        language,
        syntax: 'PERCENT',
        exempt: null,
      });
    }
    const money: [string, string][] = [
      ['en', '50 dollars'],
      ['es', '50 dólares'],
      ['de', '50 Dollar'],
      ['pt', '50 dólares'],
      ['it', '50 dollari'],
      ['ja', '50ドル'],
      ['ar', '50 دولار'],
      ['fr', '50 dollars'],
      ['ko', '50달러'],
      ['zh', '50美元'],
      ['zh-TW', '50美元'],
      ['ur', '50 ڈالر'],
      ['hi', '50 डॉलर'],
      ['vi', '50 đô la'],
      ['id', '50 dolar'],
      ['th', '50 ดอลลาร์'],
      ['tr', '50 dolar'],
    ];
    for (const [language, text] of money) {
      const found = all(text, language);
      expect({
        language,
        syntax: found[0]?.syntax,
        exempt: found[0]?.exempt,
      }).toEqual({
        language,
        syntax: 'MONEY',
        exempt: null,
      });
    }
  });

  it('does not take the unit of another language for a unit', () => {
    expect(all('82 Prozent', 'en')[0]?.syntax).toBe('BARE');
    expect(all('82 Prozent', 'en')[0]?.exempt).toBe('SMALL_COUNT');
  });

  it('does not take a word that only starts like a unit for one', () => {
    expect(all('82 percentile', 'en')[0]?.syntax).toBe('BARE');
    expect(all('50 dollarsign', 'en')[0]?.syntax).toBe('BARE');
  });
});

describe('what is left out (decision D13)', () => {
  it('skips placeholders, whatever is inside the braces', () => {
    expect(
      all('hold {Z1.invalidation} and {MCD3.M5.UOEDT} and {DAY.high}')
    ).toEqual([]);
    expect(all('{EVENT12.time} at')).toEqual([]);
  });

  it.each([
    'MCD2',
    'MCD15',
    'Z1',
    'M5',
    'M15',
    'H4',
    'MCD2_UP_IN_CORRIDOR',
    'R1_MACRO_COUNTER_TREND_RALLY',
    'R4_RANGE',
    'EVENT1',
    'sr_1',
    'sr_2',
    'fib_618',
    'XAUUSD1',
    'v2',
  ])('skips the identifier %s', (id) => {
    expect(all(`the ${id} reading`)).toEqual([]);
    expect(all(`${id}.baseline moved`)).toEqual([]);
  });

  it('skips the sample size of a statistic', () => {
    expect(all('median 3.2 (n=42)').map((n) => n.raw)).toEqual(['3.2']);
    expect(all('(n = 1,204)')).toEqual([]);
    expect(all('N=30')).toEqual([]);
    expect(all('an=30')).not.toEqual([]);
  });

  it('skips dates, and keeps the clock of a timestamp', () => {
    expect(all('on 2026-09-18')).toEqual([]);
    expect(all('on 2026/09/18')).toEqual([]);
    expect(all('on 18.09.2026')).toEqual([]);
    expect(all('on 18/09/2026')).toEqual([]);
    const stamp = all('as of 2026-09-18T20:55:00Z');
    expect(stamp.map((n) => n.syntax)).toEqual(['CLOCK']);
    expect(stamp[0]?.clock).toEqual({ minuteOfDay: 1255, second: 0 });
    const year = all('2026年9月18日', 'ja');
    expect(year.map((n) => n.raw)).toEqual(['9', '18']);
    expect(year.every((n) => n.exempt === 'SMALL_COUNT')).toBe(true);
    expect(all('2026년 9월', 'ko').map((n) => n.raw)).toEqual(['9']);
  });

  it('marks a whole number of at most two digits as a small count and judges the rest', () => {
    expect(SMALL_COUNT_DIGITS).toBe(2);
    expect(all('99 bars').map((n) => n.exempt)).toEqual(['SMALL_COUNT']);
    expect(all('05 bars').map((n) => n.exempt)).toEqual(['SMALL_COUNT']);
    expect(all('0 bars').map((n) => n.exempt)).toEqual(['SMALL_COUNT']);
    expect(all('100 bars').map((n) => n.exempt)).toEqual([null]);
    expect(all('288 bars').map((n) => n.exempt)).toEqual([null]);
    expect(all('4350 level').map((n) => n.exempt)).toEqual([null]);
    expect(all('1.5 bars').map((n) => n.exempt)).toEqual([null]);
    expect(all('0,5 bars').map((n) => n.exempt)).toEqual([null]);
  });

  it('never exempts a small number that is a percentage, an amount, a multiple, a clock or a ratio', () => {
    for (const text of [
      '5%',
      '5 %',
      '$5',
      '5 USD',
      '5 dollars',
      '5x',
      'x5',
      '3:1',
      '9:05',
    ]) {
      const found = all(text);
      expect({ text, exempt: found.map((n) => n.exempt) }).toEqual({
        text,
        exempt: found.map(() => null),
      });
      expect(found.length).toBeGreaterThan(0);
    }
  });

  it('treats a list marker and an ordinal as small counts', () => {
    expect(all('Step 1: wait. Step 2: watch.').map((n) => n.exempt)).toEqual([
      'SMALL_COUNT',
      'SMALL_COUNT',
    ]);
    expect(
      all('the 3rd close, the 2nd test').every((n) => n.exempt !== null)
    ).toBe(true);
  });
});

describe('spans', () => {
  it('give the literal exactly as it stands in the original text', () => {
    const text = `Preis ${withDigits('4.350,72', 0x0660)} und ${withDigits('4350.16', 0xff10)}, ${LRM}82%`;
    for (const found of extractNumbers(text, 'p', 'de')) {
      expect(text.slice(found.start, found.end)).toBe(found.raw);
    }
    expect(extractNumbers(text, 'p', 'de')).toHaveLength(3);
  });

  it('count a digit outside the basic plane as two units', () => {
    const text = `x ${withDigits('4350.72', 0x1d7ce)} y`;
    const found = judged(text);
    expect(found).toHaveLength(1);
    expect(text.slice(found[0]?.start, found[0]?.end)).toBe(
      withDigits('4350.72', 0x1d7ce)
    );
    expect((found[0]?.end ?? 0) - (found[0]?.start ?? 0)).toBe(2 * 6 + 1);
  });

  it('come back in reading order, and do not overlap', () => {
    const found = extractNumbers(
      'a 4350.16 b 1:2.5 c 21:00 d 82% e 4367.2 f',
      'p',
      'en'
    );
    for (let i = 1; i < found.length; i += 1) {
      expect((found[i] as ExtractedNumber).start).toBeGreaterThanOrEqual(
        (found[i - 1] as ExtractedNumber).end
      );
    }
    expect(found.map((n) => n.raw)).toEqual([
      '4350.16',
      '1:2.5',
      '21:00',
      '82',
      '4367.2',
    ]);
  });

  it('carry the path they were found at', () => {
    expect(extractNumbers('4350.72', 'rationale[0].text')[0]?.path).toBe(
      'rationale[0].text'
    );
  });
});

describe('a text that is not a number', () => {
  it('gives nothing for an empty text, for words, and for a text of only identifiers', () => {
    expect(all('')).toEqual([]);
    expect(all('no numbers here at all')).toEqual([]);
    expect(all('MCD2 and Z1 and M15')).toEqual([]);
  });

  it('stays linear on a long text', () => {
    const text = `${'4350.16, '.repeat(2000)}end`;
    const started = Date.now();
    expect(all(text)).toHaveLength(2000);
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it('survives a lone surrogate and a control character', () => {
    expect(() =>
      all(`4350.16 ${String.fromCharCode(0xd800)} \u0001 4367.20`)
    ).not.toThrow();
    expect(
      judged(`4350.16 ${String.fromCharCode(0xd800)} 4367.20`)
    ).toHaveLength(2);
  });

  it('marks an unreadable number as one with no readings', () => {
    const found = judged('id 1234567890123456 here');
    expect(found[0]?.readings).toEqual([]);
  });

  it('does not use the grouping of an Arabic thousands mark for a space', () => {
    expect(THIN_NBSP).toHaveLength(1);
    expect(readings(`4${THIN_NBSP}350`)).toEqual([[4350]]);
  });
});

describe('every digit of every run', () => {
  it('folds 0123456789 to 123456789 in each of the runs', () => {
    for (const zero of DIGIT_RUNS) {
      const found = judged(`at ${withDigits('0123456789', zero)} now`);
      expect({ zero, readings: found.map((n) => n.readings) }).toEqual({
        zero,
        readings: [[123456789]],
      });
    }
  });

  it('folds 9876543210.5 to the same number in each of the runs', () => {
    for (const zero of DIGIT_RUNS) {
      expect(readings(`at ${withDigits('9876543210.5', zero)} now`)).toEqual([
        [9876543210.5],
      ]);
    }
  });
});

describe('every sign and separator of the other scripts', () => {
  const at = (code: number): string => String.fromCodePoint(code);

  it.each([
    [
      'U+066A Arabic percent sign',
      `${withDigits('82', 0x0660)}${at(0x066a)}`,
      'PERCENT',
      [82],
    ],
    [
      'U+FF05 full-width percent sign',
      `${withDigits('82', 0xff10)}${at(0xff05)}`,
      'PERCENT',
      [82],
    ],
    ['U+FE6A small percent sign', `82${at(0xfe6a)}`, 'PERCENT', [82]],
    [
      'U+FF04 full-width dollar sign',
      `${at(0xff04)}${withDigits('5', 0xff10)}`,
      'MONEY',
      [5],
    ],
    ['U+FE69 small dollar sign', `${at(0xfe69)}5`, 'MONEY', [5]],
    ['a dollar sign after the number', '16.78 $', 'MONEY', [16.78]],
    [
      'U+FF0E full-width full stop',
      withDigits('4350.72', 0xff10).replace('.', at(0xff0e)),
      'BARE',
      [4350.72],
    ],
    ['U+066C Arabic thousands mark', `4${at(0x066c)}350`, 'BARE', [4350]],
    [
      'U+2019 right single quotation mark',
      `4${at(0x2019)}350.72`,
      'BARE',
      [4350.72],
    ],
    [
      'U+2018 left single quotation mark',
      `4${at(0x2018)}350.72`,
      'BARE',
      [4350.72],
    ],
    ['U+FF58 full-width x', `2.5${at(0xff58)}`, 'RATIO', [2.5]],
    ['U+FF38 full-width X', `${at(0xff38)}2.5`, 'RATIO', [2.5]],
  ] as const)('%s', (_name, text, syntax, values) => {
    const found = judged(`at ${text} now`);
    expect(found).toHaveLength(1);
    expect(found[0]?.syntax).toBe(syntax);
    expect(found[0]?.readings).toEqual(values);
  });

  it('reads a full-width colon as the colon of a clock', () => {
    const text = `${withDigits('20', 0xff10)}${at(0xff1a)}${withDigits('55', 0xff10)}`;
    const [clock] = judged(`at ${text} now`);
    expect(clock?.syntax).toBe('CLOCK');
    expect(clock?.clock).toEqual({ minuteOfDay: 1255, second: null });
  });

  it.each([
    ['U+2010 hyphen', 0x2010],
    ['U+2011 non-breaking hyphen', 0x2011],
    ['U+2013 en dash', 0x2013],
    ['U+2014 em dash', 0x2014],
    ['U+2212 minus sign', 0x2212],
    ['ASCII hyphen', 0x2d],
  ])('reads a date written with the %s as a date', (_name, code) => {
    const h = at(code);
    expect(all(`on 2026${h}09${h}18 only`)).toEqual([]);
    expect(
      all(`on 2026${h}09${h}18T20:55:00Z only`).map((n) => n.syntax)
    ).toEqual(['CLOCK']);
  });

  it.each([
    ['U+FF0C full-width comma', 0xff0c],
    ['U+060C Arabic comma', 0x060c],
    ['U+3001 ideographic comma', 0x3001],
  ])('does not let the %s join two numbers', (_name, code) => {
    expect(readings(`4350.16${at(code)}4367.20`)).toEqual([
      [4350.16],
      [4367.2],
    ]);
    expect(readings(`4350.16${at(code)} 4367.20`)).toEqual([
      [4350.16],
      [4367.2],
    ]);
    expect(readings(`3${at(code)}350`)).toEqual([[350]]);
  });
});

describe('the words for percent and for dollars', () => {
  const languages = Object.keys(UNIT_WORDS);
  /** whether another word of the set is a word-start of `word` plus one more letter (then `word` + a letter is still a unit) */
  const longer = (set: readonly string[], word: string): boolean =>
    set.some(
      (other) =>
        other !== word &&
        `${word}x`.toLowerCase().startsWith(`${other.toLowerCase()} `)
    );

  it('are written for the 17 languages and English', () => {
    expect(languages.sort()).toEqual(
      [
        'ar',
        'de',
        'en',
        'es',
        'fr',
        'hi',
        'id',
        'it',
        'ja',
        'ko',
        'pt',
        'th',
        'tr',
        'ur',
        'vi',
        'zh',
        'zh-TW',
      ].sort()
    );
  });

  it.each(languages)(
    '%s: every word makes a small number a percentage or an amount',
    (language) => {
      const words = UNIT_WORDS[language];
      if (words === undefined) throw new Error(language);
      for (const word of words.percentAfter) {
        for (const text of [`82 ${word}`, `82 ${word.toUpperCase()}`]) {
          expect({
            language,
            text,
            syntax: all(text, language)[0]?.syntax,
          }).toEqual({ language, text, syntax: 'PERCENT' });
        }
        if (words.loose) {
          expect(all(`82${word}です`, language)[0]?.syntax).toBe('PERCENT');
        } else if (!longer(words.percentAfter, word)) {
          expect(all(`82 ${word}x`, language)[0]?.syntax).toBe('BARE');
        }
      }
      for (const word of words.percentBefore) {
        for (const text of words.loose
          ? [`${word}82`, `${word} 82`]
          : [`${word} 82`]) {
          expect({
            language,
            text,
            syntax: all(text, language)[0]?.syntax,
          }).toEqual({ language, text, syntax: 'PERCENT' });
        }
        if (!words.loose)
          expect(all(`x${word} 82`, language)[0]?.syntax).toBe('BARE');
      }
      for (const word of words.moneyAfter) {
        for (const text of [`50 ${word}`, `50 ${word.toUpperCase()}`]) {
          expect({
            language,
            text,
            syntax: all(text, language)[0]?.syntax,
          }).toEqual({ language, text, syntax: 'MONEY' });
        }
        if (words.loose) {
          expect(all(`50${word}です`, language)[0]?.syntax).toBe('MONEY');
        } else if (!longer(words.moneyAfter, word)) {
          expect(all(`50 ${word}x`, language)[0]?.syntax).toBe('BARE');
        }
      }
    }
  );

  it('count English words in every language', () => {
    for (const language of languages) {
      expect(all('82 percent', language)[0]?.syntax).toBe('PERCENT');
      expect(all('50 dollars', language)[0]?.syntax).toBe('MONEY');
    }
  });

  it('are read for a language the table does not know as English', () => {
    expect(all('82 percent', 'xx')[0]?.syntax).toBe('PERCENT');
    expect(all('82 Prozent', 'xx')[0]?.syntax).toBe('BARE');
  });
});

describe('the corners of reading and of spans', () => {
  const arabicDecimal = String.fromCodePoint(0x066b);

  it('reads the Arabic decimal mark as a decimal point only, even before three digits', () => {
    expect(readNumber('4' + arabicDecimal + '377')?.values).toEqual([4.377]);
    expect(readNumber('43' + arabicDecimal + '770')?.values).toEqual([43.77]);
    expect(readings(withDigits('4' + arabicDecimal + '377', 0x0660))).toEqual([
      [4.377],
    ]);
    expect(readNumber('1,234' + arabicDecimal + '5')?.values).toEqual([1234.5]);
    expect(
      readNumber('1' + arabicDecimal + '234' + arabicDecimal + '5')
    ).toBeNull();
    expect(readNumber('1' + arabicDecimal + '234,5')).toBeNull();
  });

  it.each([
    '1234,567,890',
    '01,234,567',
    '0.123.456',
    '12345.678.901',
    '1,234.567.890',
    '123,45,678',
    '1,2345,678',
  ])('does not read %s as one number', (token) => {
    expect(readNumber(token)).toBeNull();
  });

  it.each([
    ['1,234,567', [1234567]],
    ['12,34,567', [1234567]],
    ['123,456', [123.456, 123456]],
    ['1.234.567,89', [1234567.89]],
    ['999.999.999', [999999999]],
    ['1,23,45,678', [12345678]],
  ])('reads %s', (token, values) => {
    expect(readNumber(token)?.values).toEqual(values);
  });

  it('keeps the span of a number after a character outside the basic plane', () => {
    const text =
      String.fromCodePoint(0x1f600) +
      ' ' +
      String.fromCodePoint(0x20000) +
      ' 4350.72 ok';
    const found = judged(text);
    expect(found).toHaveLength(1);
    expect(text.slice(found[0]?.start, found[0]?.end)).toBe('4350.72');
    expect(found[0]?.start).toBe(6);
  });

  it('keeps the span of a number after invisible and control characters', () => {
    const text = ZWSP + LRM + String.fromCharCode(1) + ' 4350.72';
    const found = judged(text);
    expect(text.slice(found[0]?.start, found[0]?.end)).toBe('4350.72');
  });

  it('writes the unit words with letters, digits and spaces only, so they can be a pattern', () => {
    for (const [language, words] of Object.entries(UNIT_WORDS)) {
      for (const word of [
        ...words.percentAfter,
        ...words.percentBefore,
        ...words.moneyAfter,
      ]) {
        expect({
          language,
          word,
          plain: /^[\p{L}\p{N}\p{M} ]+$/u.test(word),
        }).toEqual({ language, word, plain: true });
      }
    }
  });

  it('builds the patterns for each call, so nothing is kept between texts', () => {
    expect(all('82 Prozent', 'de')[0]?.syntax).toBe('PERCENT');
    expect(all('82 Prozent', 'en')[0]?.syntax).toBe('BARE');
    expect(all('82 Prozent', 'de')[0]?.syntax).toBe('PERCENT');
  });
});

describe('which languages write without spaces', () => {
  it('names them in the table, as the tests know them and not as the table says', () => {
    const loose = ['ja', 'ar', 'ko', 'zh', 'zh-TW', 'ur', 'th'];
    for (const [language, words] of Object.entries(UNIT_WORDS)) {
      expect({ language, loose: words.loose }).toEqual({
        language,
        loose: loose.includes(language),
      });
    }
  });

  it('needs a boundary after a unit word in the languages with spaces and none in the others', () => {
    for (const [text, language, syntax] of [
      ['82 por cientos', 'es', 'BARE'],
      ['82 prozentual', 'de', 'BARE'],
      ['82 por centos', 'pt', 'BARE'],
      ['82 per centop', 'it', 'BARE'],
      ['82 pour centx', 'fr', 'BARE'],
      ['82 phần trămx', 'vi', 'BARE'],
      ['82 persenx', 'id', 'BARE'],
      ['82 प्रतिशतx', 'hi', 'BARE'],
      ['yüzdex 82', 'tr', 'BARE'],
      ['82パーセントです', 'ja', 'PERCENT'],
      ['82في المئةً', 'ar', 'PERCENT'],
      ['82퍼센트입니다', 'ko', 'PERCENT'],
      ['82个百分点以上', 'zh', 'PERCENT'],
      ['82個百分點以上', 'zh-TW', 'PERCENT'],
      ['82فیصدہے', 'ur', 'PERCENT'],
      ['82เปอร์เซ็นต์ครับ', 'th', 'PERCENT'],
      ['50 dolarx', 'tr', 'BARE'],
      ['50美元以上', 'zh', 'MONEY'],
      ['50ドルです', 'ja', 'MONEY'],
      ['50달러입니다', 'ko', 'MONEY'],
      ['50دولارا', 'ar', 'MONEY'],
      ['50ڈالرہے', 'ur', 'MONEY'],
      ['50ดอลลาร์ครับ', 'th', 'MONEY'],
    ] as const) {
      expect({
        text,
        language,
        syntax: all(text, language)[0]?.syntax,
      }).toEqual({ text, language, syntax });
    }
  });
});

describe('the edges of the grammar', () => {
  it.each([
    'x1.5',
    '1.5x',
    ' 1.5',
    '1.5 ',
    '-1.5',
    '12345,678.90',
    '1,23.45',
    '0,123.45',
    '1,2345.67',
  ])('does not read %j as one number', (token) => {
    expect(readNumber(token)).toBeNull();
  });

  it.each([
    ['1,234.56', [1234.56]],
    ['12,345.6', [12345.6]],
    ['1.234,56', [1234.56]],
    ['12,34,567.89', [1234567.89]],
    ['999,999.99', [999999.99]],
  ])('reads %s', (token, values) => {
    expect(readNumber(token)?.values).toEqual(values);
  });

  it('masks the whole of a sample size, however many groups it has', () => {
    expect(all('(n = 1,204,567)')).toEqual([]);
    expect(all('n=1 204 567 here')).toEqual([]);
    expect(all('n=30, then 4350.16').map((n) => n.raw)).toEqual(['4350.16']);
  });

  it('masks a placeholder whose parts start with a digit', () => {
    expect(all('hold {ZONE.5} and {ZONE.123.4} now')).toEqual([]);
    expect(all('hold {ZONE.5')).not.toEqual([]);
  });

  it('reads a ratio with more than one digit on either side', () => {
    expect(judged('a 12:2.5 setup')[0]?.readings).toEqual([0.208333, 4.8]);
    expect(judged('a 1:60 setup')[0]?.readings).toEqual([60, 0.016667]);
    expect(judged('a 120:5 setup')[0]?.readings).toEqual([0.041667, 24]);
    expect(judged('a 2.5:1 setup')[0]?.readings).toEqual([0.4, 2.5]);
    expect(judged('a 1:2,5 setup')[0]?.readings).toEqual([2.5, 0.4]);
  });

  it('reads a number grouped in more than one place by spaces or apostrophes', () => {
    expect(readings('from 1 234 567 up')).toEqual([[1234567]]);
    expect(readings('a 12 345 678.5 level')).toEqual([[12345678.5]]);
    expect(readings("an 1'234'567 level")).toEqual([[1234567]]);
    expect(readings('the 1 234 and 567')).toEqual([[1234], [567]]);
  });

  it('reads digits after the separator, more than one', () => {
    expect(readings('at 4350.7219 now')).toEqual([[4350.7219]]);
    expect(readings('at 4350,72 now')).toEqual([[4350.72]]);
  });
});

describe('what the survivors of the mutation check pinned', () => {
  it('gives a clock and a ratio no digits, no integer flag and no exemption', () => {
    const [clock] = judged('at 21:00 now');
    expect(clock).toMatchObject({
      syntax: 'CLOCK',
      integer: false,
      digits: 0,
      exempt: null,
      readings: [],
    });
    const [ratio] = judged('a 1:3 setup');
    expect(ratio).toMatchObject({
      syntax: 'RATIO',
      integer: false,
      digits: 0,
      exempt: null,
      clock: null,
    });
  });

  it('reads a ratio with a zero on either side, and with several digits after the point', () => {
    expect(judged('a 0:5 setup')[0]?.readings).toEqual([0]);
    expect(judged('a 5:0 setup')[0]?.readings).toEqual([0]);
    expect(judged('a 0:0 setup')[0]?.readings).toEqual([]);
    expect(judged('a 1:2.55 setup')[0]?.readings).toEqual([2.55, 0.392157]);
    expect(judged('a 1.25:2.75 setup')[0]?.readings).toEqual([2.2, 0.454545]);
    expect(judged('a 1,25:2,75 setup')[0]?.readings).toEqual([2.2, 0.454545]);
  });

  it('does not take 1,23,456,789 for an Indian grouping', () => {
    expect(readNumber('1,23,456,789')).toBeNull();
    expect(readNumber('1,23,45,789')?.values).toEqual([12345789]);
    expect(readNumber('1.23.45.789')).toBeNull();
  });

  it('splits a token that is not one number at its commas, or else at its full stops, and keeps each span', () => {
    const comma = 'levels 4350.16,4367.20 hold';
    const found = judged(comma);
    expect(found.map((n) => comma.slice(n.start, n.end))).toEqual([
      '4350.16',
      '4367.20',
    ]);
    expect(found.map((n) => n.readings)).toEqual([[4350.16], [4367.2]]);
    const dots = 'a 12345.678.901 id';
    const foundDots = judged(dots);
    expect(foundDots.map((n) => dots.slice(n.start, n.end))).toEqual([
      '12345',
      '678',
      '901',
    ]);
    expect(foundDots.map((n) => n.readings)).toEqual([[12345], [678], [901]]);
    const three = 'x 1,234.567,89,10 y';
    const parts = extractNumbers(three, 'p', 'en');
    expect(parts.map((n) => three.slice(n.start, n.end))).toEqual([
      '1',
      '234.567',
      '89',
      '10',
    ]);
  });

  it('keeps an unreadable token that has a group mark as one literal', () => {
    const text = 'a 1 234,5.6 b';
    const found = extractNumbers(text, 'p', 'en');
    expect(found).toHaveLength(1);
    expect(text.slice(found[0]?.start, found[0]?.end)).toBe('1 234,5.6');
    expect(found[0]?.readings).toEqual([]);
    expect(found[0]?.exempt).toBeNull();
    const apostrophe = "a 1'234,5.6 b";
    expect(extractNumbers(apostrophe, 'p', 'en')).toHaveLength(1);
  });

  it('puts the literals in reading order, whatever order they were found in', () => {
    const text =
      'a 4350.16 b 1:2.5 c 21:00 d 82% e 9:30 f 4399.1 g 3:1 h 4401.2';
    const found = extractNumbers(text, 'p', 'en');
    const starts = found.map((n) => n.start);
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
    expect(found.map((n) => n.raw)).toEqual([
      '4350.16',
      '1:2.5',
      '21:00',
      '82',
      '9:30',
      '4399.1',
      '3:1',
      '4401.2',
    ]);
  });

  it('looks for a unit word only next to the number', () => {
    expect(all('50 ' + 'x'.repeat(30) + ' dollars')[0]?.syntax).toBe('BARE');
    expect(all('percent ' + 'x'.repeat(30) + ' 82')[0]?.syntax).toBe('BARE');
    expect(all('usd were far, then 5 bars')[0]?.syntax).toBe('BARE');
    expect(all('usd ' + 'x'.repeat(30) + ' 5')[0]?.syntax).toBe('BARE');
    expect(all('the price in usd 5')[0]?.syntax).toBe('MONEY');
    expect(all('USD 5')[0]?.syntax).toBe('MONEY');
    expect(all('prices in USD  5')[0]?.syntax).toBe('BARE');
    expect(all('a stop of $ 5')[0]?.syntax).toBe('MONEY');
    expect(all('a ' + 'long '.repeat(10) + 'stop of US$ 5')[0]?.syntax).toBe(
      'MONEY'
    );
    expect(all('a $ then 5')[0]?.syntax).toBe('BARE');
  });

  it('reads a text with the default language and path', () => {
    expect(extractNumbers('82 percent')[0]).toMatchObject({
      path: '',
      syntax: 'PERCENT',
    });
    expect(extractNumbers('82 Prozent')[0]).toMatchObject({ syntax: 'BARE' });
    expect(extractNumbers('82 Prozent', 'p', 'de')[0]).toMatchObject({
      syntax: 'PERCENT',
    });
  });
});

describe('the last corners of the scan', () => {
  it('judges a piece that is not a number, and exempts the small count next to it', () => {
    const found = all('v 1.2.3,4 y');
    expect(found.map((n) => n.raw)).toEqual(['1.2.3', '4']);
    expect(found.map((n) => n.exempt)).toEqual([null, 'SMALL_COUNT']);
    expect(found[0]?.readings).toEqual([]);
    expect(found[0]?.integer).toBe(false);
  });

  it('looks for the unit word after a long number as well as after a short one', () => {
    expect(all('123456 Prozentpunkte', 'de')[0]?.syntax).toBe('PERCENT');
    expect(all('12345678 per cent', 'en')[0]?.syntax).toBe('PERCENT');
    expect(all('1234567890 prozentpunkte', 'de')[0]?.syntax).toBe('PERCENT');
    expect(all('12345678 dollars', 'en')[0]?.syntax).toBe('MONEY');
  });

  it('reads a sign next to the number whether or not there is a space, and only one', () => {
    expect(all('82%')[0]?.syntax).toBe('PERCENT');
    expect(all('82 %')[0]?.syntax).toBe('PERCENT');
    expect(all('82  %')[0]?.syntax).toBe('BARE');
    expect(all('$5')[0]?.syntax).toBe('MONEY');
    expect(all('$ 5')[0]?.syntax).toBe('MONEY');
    expect(all('$  5')[0]?.syntax).toBe('BARE');
    expect(all('5$')[0]?.syntax).toBe('MONEY');
    expect(all('5 $')[0]?.syntax).toBe('MONEY');
    expect(all('x 5')[0]?.syntax).toBe('RATIO');
    expect(all('x5')[0]?.syntax).toBe('RATIO');
  });

  it('gives each kind of literal the same fields', () => {
    const [clock, ratio, bare] = all('at 21:00 or 1:3 or 4350.7');
    for (const literal of [clock, ratio, bare]) {
      expect(Object.keys(literal as object).sort()).toEqual(
        [
          'clock',
          'digits',
          'end',
          'exempt',
          'integer',
          'path',
          'raw',
          'readings',
          'start',
          'syntax',
        ].sort()
      );
    }
    expect(bare).toMatchObject({
      syntax: 'BARE',
      digits: 4,
      integer: false,
      clock: null,
      exempt: null,
    });
  });
});
