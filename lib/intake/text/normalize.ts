/**
 * Normalising a typed question (architecture 4.2 step 2, plan part 2).
 *
 * The question is untrusted text in any of 17 languages. Before anything looks for a
 * trading term in it, scans it for a symbol, or hands it to the Understand model, it is
 * brought to ONE form, so that the same words typed in different ways read the same:
 *
 *  1. invisible characters are removed (control, format and variation-selector characters:
 *     zero-width, bidirectional overrides, the soft hyphen, the Unicode "tag" block, lone
 *     surrogates). `EUR<ZWSP>USD` must be `EURUSD` to the scope check; a right-to-left
 *     override must not reorder what a person sees against what the code reads;
 *  2. Unicode NFKC (full-width letters and digits, ligatures, the no-break and thin spaces);
 *  3. DIGITS of every script become ASCII (`٤٣٧٧` and `४३७७` and `๔๓๗๗` are `4377`), from a
 *     table of the Unicode decimal-digit runs, so the result does not depend on the Unicode
 *     version of the JavaScript engine;
 *  4. the punctuation of the 17 languages becomes ASCII (`؟ ، 。 、 ।` and the curly quotes
 *     and the dashes);
 *  5. every run of whitespace becomes one space, and the ends are trimmed;
 *  6. NUMBERS are written one way, `4377.99`, when the separators say so without a doubt:
 *     `4.377,99`, `4,377.99`, `4 377,99`, `4'377.99`, `1,234,567`, the Indian `12,34,567`,
 *     the Arabic `٫` and `٬`, and a decimal comma (`0,75`). A number that COULD be read two
 *     ways (`4.377` is 4377 in German and 4.377 in English; `4400,4450` is one number with a
 *     decimal comma or two prices typed without a space) is left exactly as typed and the
 *     text is flagged `AMBIGUOUS_NUMBER`: a price must never be changed by a guess.
 *
 * It never changes a letter: no case folding, no transliteration, no accent stripping (the
 * letters NFKC itself rewrites, such as full-width Latin, are the only exception, and the
 * change is recorded). The original is returned beside the result, and `changes` lists which
 * steps changed something, in pipeline order, for the trace.
 *
 * What it does not do: number WORDS (`四千三百`), homoglyphs (a Cyrillic `Е` in `ЕURUSD`),
 * invisible characters that are letters (the Hangul filler), and anything language-specific.
 *
 * Pure: no I/O, no clock, no randomness. Linear in the length of the text.
 *
 * @module lib/intake/text/normalize
 */

export type NormalizeChange =
  | 'INVISIBLE_REMOVED'
  | 'NFKC'
  | 'DIGITS_FOLDED'
  | 'PUNCTUATION_FOLDED'
  | 'WHITESPACE_FOLDED'
  | 'NUMBERS_FOLDED';

/** Not a change: something the text contains that the normaliser deliberately did not decide. */
export type NormalizeFlag = 'AMBIGUOUS_NUMBER';

export interface NormalizedText {
  /** the text as it came in: unchanged, kept for the packet's `original` */
  original: string;
  /** the one form every later step reads */
  text: string;
  /** the steps that changed the text, in pipeline order, each at most once */
  changes: NormalizeChange[];
  flags: NormalizeFlag[];
}

// ---------------------------------------------------------------------------
// 3. Digits
// ---------------------------------------------------------------------------

/**
 * The first digit (zero) of each run of ten decimal digits in Unicode 16, ASCII first.
 * Unicode keeps every `Nd` run as ten code points in ascending order from zero, so a digit
 * is `codePoint - zero`. The table is written out, not read from the engine, so Node 20
 * and Node 24 fold the same text the same way; a test compares it with the engine.
 */
export const DIGIT_ZEROS: readonly number[] = [
  0x0030, 0x0660, 0x06f0, 0x07c0, 0x0966, 0x09e6, 0x0a66, 0x0ae6, 0x0b66,
  0x0be6, 0x0c66, 0x0ce6, 0x0d66, 0x0de6, 0x0e50, 0x0ed0, 0x0f20, 0x1040,
  0x1090, 0x17e0, 0x1810, 0x1946, 0x19d0, 0x1a80, 0x1a90, 0x1b50, 0x1bb0,
  0x1c40, 0x1c50, 0xa620, 0xa8d0, 0xa900, 0xa9d0, 0xa9f0, 0xaa50, 0xabf0,
  0xff10, 0x104a0, 0x10d30, 0x10d40, 0x11066, 0x110f0, 0x11136, 0x111d0,
  0x112f0, 0x11450, 0x114d0, 0x11650, 0x116c0, 0x116d0, 0x116da, 0x11730,
  0x118e0, 0x11950, 0x11bf0, 0x11c50, 0x11d50, 0x11da0, 0x11f50, 0x16130,
  0x16a60, 0x16ac0, 0x16b50, 0x16d70, 0x1ccf0, 0x1d7ce, 0x1d7d8, 0x1d7e2,
  0x1d7ec, 0x1d7f6, 0x1e140, 0x1e2f0, 0x1e4f0, 0x1e5f1, 0x1e950, 0x1fbf0,
];

const DIGIT_OF: ReadonlyMap<number, number> = (() => {
  const map = new Map<number, number>();
  for (const zero of DIGIT_ZEROS) {
    for (let digit = 0; digit < 10; digit += 1) map.set(zero + digit, digit);
  }
  return map;
})();

function foldDigits(input: string): string {
  let out = '';
  for (const char of input) {
    const digit = DIGIT_OF.get(char.codePointAt(0) as number);
    out += digit === undefined ? char : String(digit);
  }
  return out;
}

// ---------------------------------------------------------------------------
// 1. Invisible characters
// ---------------------------------------------------------------------------

/**
 * Control characters (but not the ones that are white space), format characters, variation
 * selectors and lone surrogates. With the `u` flag a surrogate PAIR is one code point, so
 * `[\uD800-\uDFFF]` matches only a lone one.
 */
const INVISIBLE =
  /(?![\t\n\v\f\r\u0085])\p{Cc}|[\p{Cf}\p{Variation_Selector}\uD800-\uDFFF]/gu;

// ---------------------------------------------------------------------------
// 4. Punctuation
// ---------------------------------------------------------------------------

const PUNCTUATION: ReadonlyMap<string, string> = new Map([
  // the sentence marks of the Arabic, Urdu, Hindi and CJK scripts
  ['،', ','], // Arabic comma
  ['؛', ';'], // Arabic semicolon
  ['؟', '?'], // Arabic question mark
  ['٪', '%'], // Arabic percent sign
  ['۔', '.'], // Urdu full stop
  ['।', '.'], // Devanagari danda
  ['॥', '.'], // Devanagari double danda
  ['。', '.'], // ideographic full stop
  ['、', ','], // ideographic comma
  // quotation marks
  ['‘', "'"],
  ['’', "'"],
  ['‚', "'"],
  ['‛', "'"],
  ['ʼ', "'"],
  ['“', '"'],
  ['”', '"'],
  ['„', '"'],
  ['‟', '"'],
  ['«', '"'],
  ['»', '"'],
  // hyphens, dashes and the minus sign (NFKC has already turned U+2011 into U+2010)
  ['‐', '-'],
  ['‒', '-'],
  ['–', '-'],
  ['—', '-'],
  ['―', '-'],
  ['−', '-'],
]);

function foldPunctuation(input: string): string {
  let out = '';
  for (const char of input) out += PUNCTUATION.get(char) ?? char;
  return out;
}

// ---------------------------------------------------------------------------
// 6. Numbers
// ---------------------------------------------------------------------------

/** Characters that can only close a group of thousands: a space, an apostrophe, the Arabic thousands mark. */
const GROUP_ONLY: ReadonlySet<string> = new Set([' ', "'", '٬']);
/** The Arabic decimal mark can only be a decimal point; a comma or a full stop can be either. */
const DECIMAL_ONLY = '٫';
const isSeparator = (char: string): boolean =>
  char === ',' || char === '.' || char === DECIMAL_ONLY || GROUP_ONLY.has(char);

const isDigit = (char: string): boolean => char >= '0' && char <= '9';

const isAsciiLetter = (char: string): boolean =>
  (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z');

/** `4`, `12`, `123`: no leading zero. */
const leadingGroup = (group: string): boolean =>
  group.length <= 3 && group.charAt(0) !== '0';

/**
 * The thousands groups of a number, at least two of them: `1,234,567` (and, for a comma, the
 * Indian `12,34,567`).
 */
function validGrouping(groups: readonly string[], separator: string): boolean {
  const first = groups[0] as string;
  const last = groups[groups.length - 1] as string;
  const middle = groups.slice(1, -1);
  return (
    last.length === 3 &&
    ((leadingGroup(first) && middle.every((group) => group.length === 3)) ||
      (separator === ',' &&
        first.length <= 2 &&
        first.charAt(0) !== '0' &&
        middle.every((group) => group.length === 2)))
  );
}

/** The number as written one way, no reading ('AMBIGUOUS'), or no number at all (null). */
type Folded = { text: string } | 'AMBIGUOUS' | null;

/**
 * One run of digit groups joined by single separator characters, read as a number if (and
 * only if) the separators leave one reading.
 */
function readNumber(groups: string[], separators: string[]): Folded {
  const count = separators.length;
  const last = separators[count - 1] as string;
  const earlier = separators.slice(0, -1);
  const uniform = earlier.every((separator) => separator === earlier[0]);

  // Every separator closes a group of thousands.
  const allGrouping = (): Folded => {
    const first = separators[0] as string;
    return separators.every((separator) => separator === first) &&
      validGrouping(groups, first)
      ? { text: groups.join('') }
      : null;
  };

  // The last separator is the decimal point; the ones before it are thousands separators.
  const withDecimal = (): Folded => {
    const decimal = groups[groups.length - 1] as string;
    const integer = groups.slice(0, -1);
    if (earlier.length === 0) return { text: `${integer[0]}.${decimal}` };
    const first = earlier[0] as string;
    if (!uniform || first === DECIMAL_ONLY) return null;
    return validGrouping(integer, first)
      ? { text: `${integer.join('')}.${decimal}` }
      : null;
  };

  if (GROUP_ONLY.has(last)) return allGrouping();
  if (last === DECIMAL_ONLY) return withDecimal();

  // The last separator is a comma or a full stop.
  if (uniform && earlier[0] === last) {
    return allGrouping(); // 1.234.567 and 1,234,567: the same mark again is a thousands mark
  }
  if (count === 1) {
    const [head, tail] = groups as [string, string];
    // 4,377 / 4.377: thousands or decimals. 4400,4450: a decimal comma or two prices typed
    // without a space. Either way no guess is made.
    const thousands = tail.length === 3 && leadingGroup(head);
    const twoPrices = last === ',' && head.length >= 4 && tail.length >= 4;
    return thousands || twoPrices ? 'AMBIGUOUS' : { text: `${head}.${tail}` };
  }
  return withDecimal();
}

/** Where a number may begin: not glued to a Latin letter, an underscore or another number. */
function canBeginNumber(input: string, index: number): boolean {
  const before = input.charAt(index - 1);
  const continuesANumber =
    (before === '.' || before === ',') && isDigit(input.charAt(index - 2));
  return !(
    isAsciiLetter(before) ||
    before === '_' ||
    isDigit(before) ||
    continuesANumber
  );
}

function foldNumbers(input: string): { text: string; ambiguous: boolean } {
  let out = '';
  let ambiguous = false;
  let index = 0;
  while (index < input.length) {
    if (!isDigit(input.charAt(index)) || !canBeginNumber(input, index)) {
      out += input.charAt(index);
      index += 1;
      continue;
    }
    const groups: string[] = [];
    const separators: string[] = [];
    let end = index;
    for (;;) {
      let stop = end;
      while (isDigit(input.charAt(stop))) stop += 1;
      groups.push(input.slice(end, stop));
      const mark = input.charAt(stop);
      if (isSeparator(mark) && isDigit(input.charAt(stop + 1))) {
        separators.push(mark);
        end = stop + 1;
      } else {
        end = stop;
        break;
      }
    }
    const folded =
      separators.length === 0 ? null : readNumber(groups, separators);
    if (folded === 'AMBIGUOUS') ambiguous = true;
    out +=
      folded === null || folded === 'AMBIGUOUS'
        ? input.slice(index, end)
        : folded.text;
    index = end;
  }
  return { text: out, ambiguous };
}

// ---------------------------------------------------------------------------
// The pipeline
// ---------------------------------------------------------------------------

export function normalizeQuestion(raw: string): NormalizedText {
  const changes: NormalizeChange[] = [];
  const flags: NormalizeFlag[] = [];
  let text = raw;

  const step = (next: string, change: NormalizeChange): void => {
    if (next !== text) changes.push(change);
    text = next;
  };

  step(text.replace(INVISIBLE, ''), 'INVISIBLE_REMOVED');
  step(text.normalize('NFKC'), 'NFKC');
  step(foldDigits(text), 'DIGITS_FOLDED');
  step(foldPunctuation(text), 'PUNCTUATION_FOLDED');
  step(text.replace(/[\s\u0085]+/gu, ' ').trim(), 'WHITESPACE_FOLDED');
  const numbers = foldNumbers(text);
  step(numbers.text, 'NUMBERS_FOLDED');
  if (numbers.ambiguous) flags.push('AMBIGUOUS_NUMBER');

  return { original: raw, text, changes, flags };
}
