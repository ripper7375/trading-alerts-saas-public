/**
 * The numbers in a text the model wrote (build step 7 part 4; architecture 5.8, plan decision D13).
 *
 * Step 1 of the number check: find every numeric literal, in any of the 19 locales, and say what it
 * could be, without judging it. `matcher.ts` judges.
 *
 * FOLDING. The text is read once, code point by code point, and folded to ASCII so that the same
 * number written in different scripts is one number: the digits of every script become `0`-`9`
 * (the table is `DIGIT_ZEROS` of `lib/intake/text/normalize.ts`, the 76 runs of Unicode decimal
 * digits, so `٤٣٧٧.٩٩` and `४३७७.९९` and `４３７７．９９` are `4377.99`); the percent signs, the dollar
 * signs, the colons and the separators of the Arabic and Chinese scripts become their ASCII twins;
 * invisible characters (zero-width and bidirectional marks a right-to-left text is full of) are
 * skipped. Every literal keeps its span in the ORIGINAL text, because a number that cannot be
 * verified is replaced there (`number-check.ts`).
 *
 * WHAT IS A NUMBER. `4350.72`, `4 350,72` (a space, a no-break space or an apostrophe closing a
 * group of thousands), `4.350,72`, `4,350.72`, `12,34,567`, `0,75`, with a sign ignored (the check is
 * about magnitude). A literal with ONE separator that could be either (`4.377` is 4.377 in English
 * and 4,377 in German) has TWO readings and passes if either one matches: a price must never be
 * judged by a guess. A clock (`21:00`, `21:00:05`) is a time; `1:2.5` is a ratio; a number
 * followed by `%` (or a word for it) is a percentage; a number after `$` or before a word for
 * dollars is money; a number followed by `x` is a multiple.
 *
 * WHAT IS LEFT OUT (decision D13). Placeholders (`{Z1.invalidation}`: the server fills them);
 * identifiers and timeframes (`MCD2`, `Z1`, `M5`, `R1_...`, `sr_1`: a number glued to a Latin
 * letter or an underscore does not begin a number); `n=30`; dates (`2026-09-18`, `18.09.2026`,
 * `2026年`); and small counts and ordinals, a whole number of at most two digits that is not a
 * percentage, an amount of money, a multiple, a clock or a ratio. Those are returned as exempt, not
 * dropped, so the report can say how many it saw.
 *
 * Pure.
 *
 * @module lib/reply/checks/extract
 */

import { DIGIT_ZEROS } from '../contracts/intake';

// ---------------------------------------------------------------------------
// Result
// ---------------------------------------------------------------------------

export type LiteralSyntax = 'CLOCK' | 'PERCENT' | 'RATIO' | 'MONEY' | 'BARE';

export interface ExtractedNumber {
  path: string;
  /** span in the original text, UTF-16 offsets, end exclusive */
  start: number;
  end: number;
  raw: string;
  syntax: LiteralSyntax;
  /** the magnitudes it can be read as (one, or two for `4.377`); empty when it cannot be read */
  readings: number[];
  /** for a clock: the minute of the day and the second, when one was written */
  clock: { minuteOfDay: number; second: number | null } | null;
  /** written without any separator */
  integer: boolean;
  /** digits of the integer part (the small-count rule reads it) */
  digits: number;
  /** why it is not judged (decision D13), or null when it is */
  exempt: 'SMALL_COUNT' | null;
}

/** Whole numbers up to this many digits, written bare, are counts and ordinals. */
export const SMALL_COUNT_DIGITS = 2;

/** Numbers with more digits than this cannot be held exactly. */
const MAX_DIGITS = 15;

// ---------------------------------------------------------------------------
// Folding
// ---------------------------------------------------------------------------

const DIGIT_VALUE: ReadonlyMap<number, number> = (() => {
  const map = new Map<number, number>();
  for (const zero of DIGIT_ZEROS) {
    for (let digit = 0; digit < 10; digit += 1) map.set(zero + digit, digit);
  }
  return map;
})();

/** Signs and separators of other scripts, and their ASCII twins. */
const SIGN_MAP: ReadonlyMap<number, string> = new Map([
  [0x066a, '%'], // Arabic percent sign
  [0xff05, '%'], // full-width percent sign
  [0xfe6a, '%'], // small percent sign
  [0xff04, '$'], // full-width dollar sign
  [0xfe69, '$'], // small dollar sign
  [0xff1a, ':'], // full-width colon
  [0xff0e, '.'], // full-width full stop
  // the comma of the CJK and Arabic scripts (U+FF0C, U+060C, U+3001) is a list and clause mark that
  // never joins two numbers, so it is left as it is: it is not a separator the scan reads
  [0x066c, "'"], // Arabic thousands separator: closes a group
  [0x2019, "'"],
  [0x2018, "'"],
  [0x2212, '-'], // minus sign
  [0x2010, '-'],
  [0x2011, '-'],
  [0x2013, '-'],
  [0x2014, '-'],
  [0xff58, 'x'], // full-width x
  [0xff38, 'X'],
]);

/** The Arabic decimal mark is kept as it is: it can only be a decimal point. */
const ARABIC_DECIMAL = '\u066b';

const INVISIBLE_POINT = /[\p{Cf}\p{Cc}\p{Variation_Selector}]/u;
const SPACE_POINT = /[\s\u0085]/u;

interface Folded {
  /** one UTF-16 unit per kept code point */
  text: string;
  /** offset in the original text of each kept code point, and one more for the end */
  starts: number[];
  ends: number[];
}

function fold(original: string): Folded {
  const chars: string[] = [];
  const starts: number[] = [];
  const ends: number[] = [];
  let offset = 0;
  for (const point of original) {
    const length = point.length;
    const code = point.codePointAt(0) as number;
    let out: string | null;
    const digit = DIGIT_VALUE.get(code);
    if (digit !== undefined) out = String(digit);
    else if (SPACE_POINT.test(point)) out = ' ';
    else if (SIGN_MAP.has(code)) out = SIGN_MAP.get(code) as string;
    else if (INVISIBLE_POINT.test(point)) out = null;
    else out = length === 1 ? point : '\ufffd';
    if (out !== null) {
      chars.push(out);
      starts.push(offset);
      ends.push(offset + length);
    }
    offset += length;
  }
  return { text: chars.join(''), starts, ends };
}

// ---------------------------------------------------------------------------
// Words for "percent" and "dollars", by language
// ---------------------------------------------------------------------------

export interface UnitWords {
  percentAfter: readonly string[];
  percentBefore: readonly string[];
  moneyAfter: readonly string[];
  /** the language is written without spaces: a unit word needs no boundary after it */
  loose: boolean;
}

const EN: UnitWords = {
  percentAfter: ['percent', 'per cent', 'percentage', 'pct'],
  percentBefore: [],
  moneyAfter: ['dollars', 'dollar', 'usd', 'bucks'],
  loose: false,
};

export const UNIT_WORDS: Readonly<Record<string, UnitWords>> = {
  en: EN,
  es: {
    percentAfter: ['por ciento', 'por cien', 'porciento'],
    percentBefore: [],
    moneyAfter: ['dólares', 'dolares', 'dólar', 'dolar', 'usd'],
    loose: false,
  },
  de: {
    percentAfter: ['prozent', 'prozentpunkte'],
    percentBefore: [],
    moneyAfter: ['dollar', 'usd'],
    loose: false,
  },
  pt: {
    percentAfter: ['por cento', 'porcento'],
    percentBefore: [],
    moneyAfter: ['dólares', 'dolares', 'dólar', 'dolar', 'usd'],
    loose: false,
  },
  it: {
    percentAfter: ['per cento', 'percento', 'percentuale'],
    percentBefore: [],
    moneyAfter: ['dollari', 'dollaro', 'usd'],
    loose: false,
  },
  ja: {
    percentAfter: ['パーセント', 'パーセンテージ'],
    percentBefore: [],
    moneyAfter: ['ドル', '米ドル'],
    loose: true,
  },
  ar: {
    percentAfter: ['بالمئة', 'في المئة', 'بالمائة', 'في المائة', 'بالمية'],
    percentBefore: [],
    moneyAfter: ['دولار', 'دولارا', 'دولارات'],
    loose: true,
  },
  fr: {
    percentAfter: ['pour cent', 'pourcent', 'pourcents'],
    percentBefore: [],
    moneyAfter: ['dollars', 'dollar', 'usd'],
    loose: false,
  },
  ko: {
    percentAfter: ['퍼센트', '프로'],
    percentBefore: [],
    moneyAfter: ['달러'],
    loose: true,
  },
  zh: {
    percentAfter: ['个百分点', '百分点'],
    percentBefore: ['百分之'],
    moneyAfter: ['美元', '美金', '元'],
    loose: true,
  },
  'zh-TW': {
    percentAfter: ['個百分點', '百分點'],
    percentBefore: ['百分之'],
    moneyAfter: ['美元', '美金', '元'],
    loose: true,
  },
  ur: {
    percentAfter: ['فیصد', 'فی صد', 'پرسنٹ'],
    percentBefore: [],
    moneyAfter: ['ڈالر', 'ڈالرز'],
    loose: true,
  },
  hi: {
    percentAfter: ['प्रतिशत', 'फीसदी', 'फ़ीसदी', 'परसेंट'],
    percentBefore: [],
    moneyAfter: ['डॉलर', 'डालर'],
    loose: false,
  },
  vi: {
    percentAfter: ['phần trăm'],
    percentBefore: [],
    moneyAfter: ['đô la', 'đô', 'usd'],
    loose: false,
  },
  id: {
    percentAfter: ['persen', 'prosen'],
    percentBefore: [],
    moneyAfter: ['dolar', 'usd'],
    loose: false,
  },
  th: {
    percentAfter: ['เปอร์เซ็นต์', 'เปอร์เซนต์'],
    percentBefore: [],
    moneyAfter: ['ดอลลาร์'],
    loose: true,
  },
  tr: {
    percentAfter: ['yüzde'],
    percentBefore: ['yüzde'],
    moneyAfter: ['dolar', 'usd'],
    loose: false,
  },
};

function unitPatterns(language: string): {
  percentAfter: RegExp[];
  percentBefore: RegExp[];
  moneyAfter: RegExp[];
} {
  const own = UNIT_WORDS[language];
  const sets = own === undefined || own === EN ? [EN] : [own, EN];
  const after = (words: readonly string[], loose: boolean): RegExp[] =>
    words.map(
      (word) =>
        new RegExp(`^ ?${word}${loose ? '' : '(?![\\p{L}\\p{N}])'}`, 'iu')
    );
  const before = (words: readonly string[], loose: boolean): RegExp[] =>
    words.map(
      (word) =>
        new RegExp(`${loose ? '' : '(?<![\\p{L}\\p{N}])'}${word} ?$`, 'iu')
    );
  return {
    percentAfter: sets.flatMap((set) => after(set.percentAfter, set.loose)),
    percentBefore: sets.flatMap((set) => before(set.percentBefore, set.loose)),
    moneyAfter: sets.flatMap((set) => after(set.moneyAfter, set.loose)),
  };
}

// ---------------------------------------------------------------------------
// Reading a number
// ---------------------------------------------------------------------------

const GROUP_FIRST = /^[1-9]\d{0,2}$/;

/** `1,234,567` / `1.234.567` (and the Indian `12,34,567` for a comma): the groups after the first. */
function validGrouping(groups: readonly string[], separator: string): boolean {
  const first = groups[0] as string;
  const rest = groups.slice(1);
  if (rest.length === 0 || !GROUP_FIRST.test(first)) return false;
  if (rest.every((group) => group.length === 3)) return true;
  const last = rest[rest.length - 1] as string;
  return (
    separator === ',' &&
    first.length <= 2 &&
    last.length === 3 &&
    rest.slice(0, -1).every((group) => group.length === 2)
  );
}

export interface Reading {
  values: number[];
  integer: boolean;
}

/**
 * The magnitudes a run of digits and separators can be, or null when it is not a number at all
 * (`1.2.3`, `4350.16,4367.20`). `token` has no group spaces in it.
 */
export function readNumber(token: string): Reading | null {
  if (!/^\d+(?:[.,\u066b]\d+)*$/.test(token)) return null;
  const parts = token.split(/[.,\u066b]/);
  const seps = token.match(/[.,\u066b]/g) ?? [];
  const digits = token.replace(/[^\d]/g, '').length;
  if (digits > MAX_DIGITS) return { values: [], integer: seps.length === 0 };
  const value = (text: string): number => Number(text);
  if (seps.length === 0) {
    return { values: [value(token)], integer: true };
  }
  const last = seps[seps.length - 1] as string;
  const earlier = seps.slice(0, -1);
  const uniform = earlier.every((sep) => sep === earlier[0]);
  const head = parts.slice(0, -1);
  const tail = parts[parts.length - 1] as string;

  // every separator the same: one decimal point, or thousands marks
  if (seps.every((sep) => sep === last) && last !== ARABIC_DECIMAL) {
    if (seps.length === 1) {
      const [whole] = head as [string];
      const both = value(`${whole}.${tail}`);
      if (tail.length === 3 && GROUP_FIRST.test(whole)) {
        return { values: [both, value(`${whole}${tail}`)], integer: false };
      }
      return { values: [both], integer: false };
    }
    return validGrouping(parts, last)
      ? { values: [value(parts.join(''))], integer: false }
      : null;
  }
  // the last separator closes the number as its decimal point; the ones before are thousands marks
  if (earlier.length === 0) {
    return { values: [value(`${head[0]}.${tail}`)], integer: false };
  }
  const mark = earlier[0] as string;
  if (!uniform || mark === ARABIC_DECIMAL || mark === last) {
    return null;
  }
  return validGrouping(head, mark)
    ? { values: [value(`${head.join('')}.${tail}`)], integer: false }
    : null;
}

// ---------------------------------------------------------------------------
// The scan
// ---------------------------------------------------------------------------

const MASK = '\u0000';

function mask(text: string, pattern: RegExp): string {
  return text.replace(pattern, (found) => MASK.repeat(found.length));
}

const PLACEHOLDER = /\{[^{}]*\}/g;
const DATES: readonly RegExp[] = [
  /(?<![0-9])\d{4}-\d{2}-\d{2}T?/g,
  /(?<![0-9])\d{4}[/.]\d{1,2}[/.]\d{1,2}(?![0-9])/g,
  /(?<![0-9])\d{1,2}[/.]\d{1,2}[/.]\d{4}(?![0-9])/g,
  /(?<![0-9])\d{4}(?=[年년])/g,
];
const SAMPLE_SIZE = /(?<![A-Za-z0-9])[nN] ?= ?\d+(?:[,. ]\d{3})*/g;
const CLOCK = /(?<![0-9:.,])(?:[01]?\d|2[0-3]):[0-5]\d(?::[0-5]\d)?(?![0-9])/g;
const RATIO = /(?<![0-9.,:])(\d+(?:[.,]\d+)?) ?: ?(\d+(?:[.,]\d+)?)(?![0-9:])/g;
// not glued to a Latin letter or an underscore (an identifier), except after a lone x (a multiple)
const NUMBER =
  /(?:(?<![A-Za-z_])|(?<=(?<![A-Za-z0-9_])[xX]))(?<![0-9])(?<![0-9][.,])(?:\d{1,3}(?:[ ']\d{3})+|\d+)(?:[.,\u066b]\d+)*/g;

/** The marks that close a group of thousands: a space (no-break spaces are folded to one) and an apostrophe. */
const GROUP_MARKS = /[ ']/g;

interface Span {
  path: string;
  start: number;
  end: number;
  raw: string;
}

/** Where the folded code points `from` to `to` (exclusive) are in the original text. */
function spanOf(
  path: string,
  folded: Folded,
  from: number,
  to: number,
  original: string
): Span {
  const start = folded.starts[from] as number;
  const end = folded.ends[to - 1] as number;
  return { path, start, end, raw: original.slice(start, end) };
}

type UnitPatterns = ReturnType<typeof unitPatterns>;

/** What the scan of the numbers needs to classify one. */
interface Scan {
  path: string;
  original: string;
  folded: Folded;
  /** the folded text with the placeholders, dates, sample sizes, clocks and ratios masked out */
  work: string;
  units: UnitPatterns;
}

/** A token that is not a number: it has no readings. */
const UNREADABLE: Reading = { values: [], integer: false };

/**
 * Every numeric literal of a text, in reading order, folded and classified. `language` is the
 * family of the locale the text is written in (`en`, `de`, `zh-TW`, ...): it picks the words for
 * "percent" and "dollars" that make a small number a percentage or an amount.
 */
export function extractNumbers(
  text: string,
  path = '',
  language = 'en'
): ExtractedNumber[] {
  const folded = fold(text);
  const found: ExtractedNumber[] = [];

  let work = mask(folded.text, PLACEHOLDER);
  for (const date of DATES) work = mask(work, date);
  work = mask(work, SAMPLE_SIZE);

  // clocks
  work = work.replace(CLOCK, (match, offset: number) => {
    const [hours, minutes, seconds] = match.split(':').map(Number) as [
      number,
      number,
      number | undefined,
    ];
    found.push({
      ...spanOf(path, folded, offset, offset + match.length, text),
      syntax: 'CLOCK',
      readings: [],
      clock: {
        minuteOfDay: hours * 60 + minutes,
        second: seconds === undefined ? null : seconds,
      },
      integer: false,
      digits: 0,
      exempt: null,
    });
    return MASK.repeat(match.length);
  });

  // ratios
  work = work.replace(
    RATIO,
    (match, first: string, second: string, offset: number) => {
      const a = readNumber(first);
      const b = readNumber(second);
      const readings: number[] = [];
      for (const x of a?.values ?? []) {
        for (const y of b?.values ?? []) {
          if (x !== 0) readings.push(round6(y / x));
          if (y !== 0) readings.push(round6(x / y));
        }
      }
      found.push({
        ...spanOf(path, folded, offset, offset + match.length, text),
        syntax: 'RATIO',
        readings: [...new Set(readings)],
        clock: null,
        integer: false,
        digits: 0,
        exempt: null,
      });
      return MASK.repeat(match.length);
    }
  );

  // the numbers
  const scan: Scan = {
    path,
    original: text,
    folded,
    work,
    units: unitPatterns(language),
  };
  for (const match of work.matchAll(NUMBER)) {
    const index = match.index as number;
    const token = match[0];
    const bare = token.replace(GROUP_MARKS, '');
    const reading = readNumber(bare);
    if (reading === null) {
      // not one number: a list written without a space after the comma, or a stray separator
      found.push(...splitUnreadable(scan, token, index));
    } else {
      found.push(classify(scan, index, token.length, reading, bare));
    }
  }

  return found.sort((a, b) => a.start - b.start);
}

function round6(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

/**
 * A token that is not one number, as the numbers it is made of: cut at its commas, or else at its
 * full stops (`4350.16,4367.20`, `1.2.3`). A token with a group mark in it, or with neither mark,
 * stays one literal that cannot be read.
 */
function splitUnreadable(
  scan: Scan,
  token: string,
  index: number
): ExtractedNumber[] {
  const separator = token.includes(',') ? ',' : '.';
  if (/[ ']/.test(token) || !token.includes(separator)) {
    return [classify(scan, index, token.length, UNREADABLE, token)];
  }
  const out: ExtractedNumber[] = [];
  let at = index;
  for (const piece of token.split(separator)) {
    const reading = readNumber(piece) ?? UNREADABLE;
    out.push(classify(scan, at, piece.length, reading, piece));
    at += piece.length + 1;
  }
  return out;
}

/** How far around a number the unit words are looked for: longer than the longest of them. */
const UNIT_WINDOW = 24;

/** The literal at `index` of the folded text: how it is written, and whether it is judged. */
function classify(
  scan: Scan,
  index: number,
  length: number,
  reading: Reading,
  bare: string
): ExtractedNumber {
  const { work, units } = scan;
  const before = work.slice(Math.max(0, index - UNIT_WINDOW), index);
  const after = work.slice(index + length, index + length + UNIT_WINDOW);
  const afterSign = after.startsWith(' ') ? after.slice(1) : after;
  const beforeSign = before.endsWith(' ') ? before.slice(0, -1) : before;

  let syntax: LiteralSyntax = 'BARE';
  if (
    afterSign.startsWith('%') ||
    units.percentAfter.some((pattern) => pattern.test(after)) ||
    units.percentBefore.some((pattern) => pattern.test(before))
  ) {
    syntax = 'PERCENT';
  } else if (
    beforeSign.endsWith('$') ||
    afterSign.startsWith('$') ||
    /(?<![A-Za-z])usd$/i.test(beforeSign) ||
    units.moneyAfter.some((pattern) => pattern.test(after))
  ) {
    syntax = 'MONEY';
  } else if (
    /^ ?[x×](?![\p{L}\p{N}])/iu.test(after) ||
    /(?<![A-Za-z])[x×] ?$/i.test(before)
  ) {
    syntax = 'RATIO';
  }
  const digits = (bare.split(/[.,\u066b]/)[0] as string).length;
  return {
    ...spanOf(scan.path, scan.folded, index, index + length, scan.original),
    syntax,
    readings: reading.values,
    clock: null,
    integer: reading.integer,
    digits,
    exempt:
      syntax === 'BARE' && reading.integer && digits <= SMALL_COUNT_DIGITS
        ? 'SMALL_COUNT'
        : null,
  };
}
