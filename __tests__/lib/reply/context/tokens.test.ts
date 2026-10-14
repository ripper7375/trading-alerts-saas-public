/**
 * @jest-environment node
 */

import {
  DEFAULT_CALIBRATION,
  MAX_MARGIN_BP,
  estimateRawTokens,
  estimateTokens,
  validateCalibration,
  withMargin,
} from '@/lib/reply/context/tokens';
import type { TokenCalibration } from '@/lib/reply/context/tokens';

import { lcg } from './helpers/context-fixtures';

const raw = (text: string, calibration?: TokenCalibration): number =>
  estimateRawTokens(text, calibration);

describe('estimateRawTokens: how each kind of text is counted', () => {
  it('counts nothing for nothing', () => {
    expect(raw('')).toBe(0);
  });

  it('counts a run of digits by groups of three', () => {
    expect(raw('1')).toBe(1);
    expect(raw('123')).toBe(1);
    expect(raw('1234')).toBe(2);
    expect(raw('123456')).toBe(2);
    expect(raw('1234567')).toBe(3);
  });

  it('counts a price the way a byte-pair tokenizer splits it: 4331 . 40 is 2 + 1 + 1', () => {
    expect(raw('4331.40')).toBe(4);
    expect(raw('4331.4')).toBe(4);
    expect(raw('433')).toBe(1);
  });

  it("counts a row of four prices and a line break as 20 (the figure behind 5.5's 7,700)", () => {
    expect(raw('4331.40 4333.15 4330.60 4332.85\n')).toBe(20);
  });

  it('counts a word by groups of four letters', () => {
    expect(raw('a')).toBe(1);
    expect(raw('abcd')).toBe(1);
    expect(raw('abcde')).toBe(2);
    expect(raw('abcdefgh')).toBe(2);
    expect(raw('abcdefghi')).toBe(3);
  });

  it('counts Cyrillic and Greek letters as words too', () => {
    expect(raw('привет')).toBe(2);
    expect(raw('γεια')).toBe(1);
  });

  it('lets a single space ride on a word, and charges it before a digit', () => {
    expect(raw('ab cd')).toBe(2);
    expect(raw('ab 12')).toBe(3);
    expect(raw('12 ab')).toBe(2);
  });

  it('counts two or more spaces as one token', () => {
    expect(raw('a  b')).toBe(3);
    expect(raw('a     b')).toBe(3);
    expect(raw('a  12')).toBe(1 + 1 + 1 + 1);
  });

  it('charges a space at the end of the text, which nothing follows', () => {
    expect(raw('a ')).toBe(2);
    expect(raw(' ')).toBe(1);
  });

  it('counts a run of line breaks as one token, whatever mix of CR and LF', () => {
    expect(raw('a\nb')).toBe(3);
    expect(raw('a\n\n\nb')).toBe(3);
    expect(raw('a\r\nb')).toBe(3);
    expect(raw('a\r\n\r\nb')).toBe(3);
  });

  it('counts every punctuation mark, symbol and emoji as a token of its own', () => {
    expect(raw('...')).toBe(3);
    expect(raw('{}')).toBe(2);
    expect(raw('·')).toBe(1);
    expect(raw('😀')).toBe(1);
    expect(raw('\t')).toBe(1);
  });

  it('counts a Han, Hiragana, Katakana or Hangul character as a token', () => {
    expect(raw('你好吗')).toBe(3);
    expect(raw('こんにちは')).toBe(5);
    expect(raw('カタカナ')).toBe(4);
    expect(raw('안녕하세요')).toBe(5);
  });

  it('counts Thai, Arabic, Hebrew and Hindi by pairs of characters', () => {
    expect(raw('สวัสดี')).toBe(3);
    expect(raw('مرحبا')).toBe(3);
    expect(raw('שלום')).toBe(2);
    expect(raw('नमस्ते')).toBe(3);
  });

  it('counts digits of other scripts as digits', () => {
    expect(raw('١٢٣٤')).toBe(2);
    expect(raw('１２３')).toBe(1);
  });

  it('splits runs where the kind changes', () => {
    expect(raw('M5')).toBe(2);
    expect(raw('MCD2')).toBe(2);
    expect(raw('abc123def')).toBe(3);
  });

  it('is the same whatever the text is split into code units (astral characters count once)', () => {
    expect(raw('😀😀')).toBe(2);
    expect(raw('𝟏𝟐𝟑')).toBe(1);
  });
});

describe('the calibration', () => {
  it('moves the counts of a model that splits every digit', () => {
    const perDigit: TokenCalibration = {
      ...DEFAULT_CALIBRATION,
      digitsPerToken: 1,
    };
    expect(raw('4331.40', perDigit)).toBe(7);
    expect(raw('4331.40 ', perDigit)).toBe(8);
  });

  it('moves the counts of a model with longer words', () => {
    const long: TokenCalibration = {
      ...DEFAULT_CALIBRATION,
      lettersPerToken: 8,
    };
    expect(raw('abcdefgh', long)).toBe(1);
    expect(raw('abcdefghi', long)).toBe(2);
  });

  it('moves the counts for the other scripts', () => {
    const wide: TokenCalibration = {
      ...DEFAULT_CALIBRATION,
      cjkCharsPerToken: 2,
      otherCharsPerToken: 3,
    };
    expect(raw('你好吗', wide)).toBe(2);
    expect(raw('สวัสดี', wide)).toBe(2);
  });

  it('has a 10% default margin', () => {
    expect(DEFAULT_CALIBRATION.marginBp).toBe(1000);
  });

  it('cannot be changed by accident', () => {
    expect(Object.isFrozen(DEFAULT_CALIBRATION)).toBe(true);
  });
});

describe('the margin', () => {
  it('adds the share and rounds up, exactly', () => {
    expect(withMargin(0)).toBe(0);
    expect(withMargin(1)).toBe(2);
    expect(withMargin(10)).toBe(11);
    expect(withMargin(100)).toBe(110);
    expect(withMargin(7800)).toBe(8580);
    expect(withMargin(1_000_000)).toBe(1_100_000);
  });

  it('is exact where a floating-point multiplication by 1.1 would round up', () => {
    // 100 * 1.1 is 110.00000000000001 in floating point, which a naive ceil makes 111
    expect(withMargin(100)).toBe(110);
    expect(withMargin(1000)).toBe(1100);
  });

  it('follows the calibration', () => {
    const calibration = { ...DEFAULT_CALIBRATION, marginBp: 2500 };
    expect(withMargin(100, calibration)).toBe(125);
    expect(withMargin(3, calibration)).toBe(4);
    expect(withMargin(100, { ...DEFAULT_CALIBRATION, marginBp: 0 })).toBe(100);
  });

  it('is the estimate with the margin when asked for the estimate', () => {
    expect(estimateTokens('4331.40 4333.15 4330.60 4332.85\n')).toBe(22);
    expect(estimateTokens('')).toBe(0);
  });
});

describe('validateCalibration', () => {
  it('accepts the default and a lower and an upper edge', () => {
    expect(validateCalibration(DEFAULT_CALIBRATION)).toEqual([]);
    expect(
      validateCalibration({ ...DEFAULT_CALIBRATION, marginBp: 0 })
    ).toEqual([]);
    expect(
      validateCalibration({ ...DEFAULT_CALIBRATION, marginBp: MAX_MARGIN_BP })
    ).toEqual([]);
    expect(
      validateCalibration({ ...DEFAULT_CALIBRATION, digitsPerToken: 0.5 })
    ).toEqual([]);
  });

  it('puts the widest margin at exactly 100% (10,000 basis points), in numbers and not in the constant', () => {
    expect(MAX_MARGIN_BP).toBe(10_000);
    expect(
      validateCalibration({ ...DEFAULT_CALIBRATION, marginBp: 10_000 })
    ).toEqual([]);
    expect(
      validateCalibration({ ...DEFAULT_CALIBRATION, marginBp: 10_001 })
    ).toEqual(['marginBp must be a whole number from 0 to 10000']);
    expect(
      validateCalibration({ ...DEFAULT_CALIBRATION, marginBp: 9_999 })
    ).toEqual([]);
  });

  it.each([
    'digitsPerToken',
    'lettersPerToken',
    'cjkCharsPerToken',
    'otherCharsPerToken',
  ] as const)(
    'refuses a %s that is zero, negative, infinite, not a number or a string',
    (key) => {
      for (const bad of [
        0,
        -1,
        Number.NaN,
        Number.POSITIVE_INFINITY,
        '3',
        null,
      ]) {
        const problems = validateCalibration({
          ...DEFAULT_CALIBRATION,
          [key]: bad,
        });
        expect(problems).toEqual([`${key} must be a number above zero`]);
      }
    }
  );

  it('refuses a margin that is negative, over 100%, fractional or not a number', () => {
    for (const bad of [-1, MAX_MARGIN_BP + 1, 12.5, '10', null, Number.NaN]) {
      expect(
        validateCalibration({ ...DEFAULT_CALIBRATION, marginBp: bad })
      ).toEqual([`marginBp must be a whole number from 0 to ${MAX_MARGIN_BP}`]);
    }
  });

  it('refuses a field it does not know, and anything that is not an object', () => {
    expect(
      validateCalibration({ ...DEFAULT_CALIBRATION, charsPerToken: 4 })
    ).toEqual(['charsPerToken is not a calibration field']);
    for (const bad of [null, undefined, 3, 'x', []]) {
      expect(validateCalibration(bad)).toEqual([
        'the calibration must be an object',
      ]);
    }
  });

  it('names every missing field', () => {
    expect(validateCalibration({}).length).toBe(5);
  });
});

describe('properties of the estimate (random texts, seeded)', () => {
  const ALPHABET = [
    ...'abcdefghijklmnopqrstuvwxyz'.split(''),
    ...'0123456789'.split(''),
    ' ',
    ' ',
    '\n',
    '\r',
    '.',
    ',',
    '{',
    '}',
    '"',
    '·',
    '你',
    '好',
    'ก',
    'ข',
    'ب',
    'ж',
    '٣',
    '😀',
    '\t',
  ];
  const random = lcg(7);
  const text = (): string => {
    const length = Math.floor(random() * 40);
    let out = '';
    for (let i = 0; i < length; i += 1) {
      out += ALPHABET[Math.floor(random() * ALPHABET.length)] as string;
    }
    return out;
  };
  const CASES = Array.from({ length: 600 }, () => [text(), text()] as const);

  it('is a whole number, never negative, and the same twice', () => {
    for (const [a] of CASES) {
      const n = raw(a);
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(raw(a)).toBe(n);
    }
  });

  it('never goes down when text is appended', () => {
    for (const [a, b] of CASES) {
      expect(raw(a + b)).toBeGreaterThanOrEqual(raw(a));
    }
  });

  it('never counts two texts joined as more than the two counted apart', () => {
    for (const [a, b] of CASES) {
      expect(raw(a + b)).toBeLessThanOrEqual(raw(a) + raw(b));
    }
  });

  it('keeps those two properties with the margin on', () => {
    for (const [a, b] of CASES) {
      expect(estimateTokens(a + b)).toBeLessThanOrEqual(
        estimateTokens(a) + estimateTokens(b)
      );
      expect(estimateTokens(a + b)).toBeGreaterThanOrEqual(estimateTokens(a));
    }
  });

  it('is never below the margin-free count', () => {
    for (const [a] of CASES) {
      expect(estimateTokens(a)).toBeGreaterThanOrEqual(raw(a));
    }
  });
});
