/**
 * A deterministic token estimator (build step 7 part 2, plan decision D7, finding S7-F18).
 *
 * The repository has no tokenizer, and adding one would be a `package.json` change. The caps of
 * architecture 5.4 are in tokens, so the assembler needs a count that is (a) the same on every
 * machine and every run, (b) close to what a real tokenizer says on the text this prompt is made
 * of, and (c) stated in numbers a registry can calibrate per model. This is it.
 *
 * HOW IT COUNTS. The text is read by code point and cut into runs; each run costs tokens the way
 * the pre-tokenizer of a byte-pair tokenizer (the o200k family that §5.5's figures were
 * measured with) would split it:
 *
 *  - a run of digits costs `ceil(length / digitsPerToken)` (3 for o200k/cl100k, 1 for the
 *    tokenizers that split every digit); a single space before a digit cannot join it and is one
 *    more token, which is why a row of four prices costs about 20 tokens;
 *  - a run of Latin, Cyrillic, Greek and similar letters costs `ceil(length / lettersPerToken)`;
 *    a space before a word is free (it rides on the word);
 *  - a run of Han, Hiragana, Katakana or Hangul costs `ceil(length / cjkCharsPerToken)` and a run
 *    of any other script (Thai, Arabic, Hebrew, the Indic scripts) `ceil(length / otherCharsPerToken)`;
 *  - every punctuation mark, symbol or emoji is one token; a run of line breaks is one token; a
 *    run of two or more spaces is one token, and a lone space at the end of the text is one.
 *
 * The rules are deliberately on the high side wherever a real tokenizer merges (a long English
 * word is one token there and two here), and the per-model SAFETY MARGIN covers the rest: the
 * caller adds it with `withMargin` when it asks "does this fit the model", and the trace keeps
 * the real count from the gateway beside the estimate so the error is measured on every request.
 *
 * Two properties hold by construction and are tested on random text: the estimate never goes down
 * when text is appended, and the estimate of two texts joined is never more than the sum of their
 * estimates (so summing the parts of a prompt never under-counts the whole).
 *
 * Pure: no I/O, no clock, no randomness.
 *
 * @module lib/reply/context/tokens
 */

/** What one model's tokenizer is assumed to do. All of it is data: the registry (part 3) holds one per model. */
export interface TokenCalibration {
  /** digits that one token holds: 3 for o200k/cl100k-style tokenizers, 1 for per-digit ones */
  digitsPerToken: number;
  /** letters of a word (Latin, Cyrillic, Greek, ...) that one token holds */
  lettersPerToken: number;
  /** characters of Han, Hiragana, Katakana and Hangul that one token holds (at most 1 on every tokenizer seen) */
  cjkCharsPerToken: number;
  /** characters of every other script that one token holds */
  otherCharsPerToken: number;
  /**
   * The safety margin, in basis points (1000 = 10%): the share by which this model's own
   * tokenizer may count more than this estimator does. An integer so that the arithmetic is exact.
   */
  marginBp: number;
}

/** The o200k-like starting calibration. Part 10's live run replaces it, per model, with a measurement. */
export const DEFAULT_CALIBRATION: Readonly<TokenCalibration> = Object.freeze({
  digitsPerToken: 3,
  lettersPerToken: 4,
  cjkCharsPerToken: 1,
  otherCharsPerToken: 2,
  marginBp: 1000,
});

/** The widest margin accepted: 100%. A larger one is a typo, not a calibration. */
export const MAX_MARGIN_BP = 10_000;

export function validateCalibration(value: unknown): string[] {
  const problems: string[] = [];
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return ['the calibration must be an object'];
  }
  const record = value as Record<string, unknown>;
  const positive = (key: keyof TokenCalibration): void => {
    const found = record[key];
    if (typeof found !== 'number' || !Number.isFinite(found) || found <= 0) {
      problems.push(`${key} must be a number above zero`);
    }
  };
  positive('digitsPerToken');
  positive('lettersPerToken');
  positive('cjkCharsPerToken');
  positive('otherCharsPerToken');
  const margin = record['marginBp'];
  if (
    typeof margin !== 'number' ||
    !Number.isInteger(margin) ||
    margin < 0 ||
    margin > MAX_MARGIN_BP
  ) {
    problems.push(`marginBp must be a whole number from 0 to ${MAX_MARGIN_BP}`);
  }
  const known = new Set<string>(Object.keys(DEFAULT_CALIBRATION));
  for (const key of Object.keys(record)) {
    if (!known.has(key)) problems.push(`${key} is not a calibration field`);
  }
  return problems;
}

const DIGIT = /\p{Nd}/u;
const CJK =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
const WORD_SCRIPT = /[\p{Script=Latin}\p{Script=Cyrillic}\p{Script=Greek}]/u;
const LETTER_OR_MARK = /[\p{L}\p{M}]/u;

type Kind = 'DIGIT' | 'WORD' | 'CJK' | 'OTHER' | 'SPACE' | 'BREAK' | 'SYMBOL';

function kindOf(char: string): Kind {
  if (char === ' ') return 'SPACE';
  if (char === '\n' || char === '\r') return 'BREAK';
  if (DIGIT.test(char)) return 'DIGIT';
  if (LETTER_OR_MARK.test(char)) {
    if (CJK.test(char)) return 'CJK';
    if (WORD_SCRIPT.test(char)) return 'WORD';
    // Thai, Arabic, Hebrew, the Indic scripts, and a combining mark (counted as its own run,
    // which is a high estimate: the prompt is NFKC-normalised, so marks are rare)
    return 'OTHER';
  }
  return 'SYMBOL';
}

interface Run {
  kind: Kind;
  length: number;
}

function runsOf(text: string): Run[] {
  const runs: Run[] = [];
  for (const char of text) {
    const kind = kindOf(char);
    const last = runs[runs.length - 1];
    if (kind !== 'SYMBOL' && last !== undefined && last.kind === kind) {
      last.length += 1;
    } else {
      runs.push({ kind, length: 1 });
    }
  }
  return runs;
}

/** The estimate before the margin: whole tokens, never negative. */
export function estimateRawTokens(
  text: string,
  calibration: Readonly<TokenCalibration> = DEFAULT_CALIBRATION
): number {
  const runs = runsOf(text);
  let total = 0;
  for (let index = 0; index < runs.length; index += 1) {
    const run = runs[index] as Run;
    const next = runs[index + 1];
    switch (run.kind) {
      case 'DIGIT':
        total += Math.ceil(run.length / calibration.digitsPerToken);
        break;
      case 'WORD':
        total += Math.ceil(run.length / calibration.lettersPerToken);
        break;
      case 'CJK':
        total += Math.ceil(run.length / calibration.cjkCharsPerToken);
        break;
      case 'OTHER':
        total += Math.ceil(run.length / calibration.otherCharsPerToken);
        break;
      case 'BREAK':
        total += 1;
        break;
      case 'SYMBOL':
        total += 1;
        break;
      case 'SPACE':
        // two or more spaces are one token; a space that cannot ride on the next token
        // (a digit follows, or the text ends) is one more
        total += run.length >= 2 ? 1 : 0;
        if (next === undefined || next.kind === 'DIGIT') total += 1;
        break;
    }
  }
  return total;
}

/** `tokens` plus the safety margin, rounded up: the count to hold against a model's own limit. */
export function withMargin(
  tokens: number,
  calibration: Readonly<TokenCalibration> = DEFAULT_CALIBRATION
): number {
  return Math.ceil((tokens * (10_000 + calibration.marginBp)) / 10_000);
}

/** The estimate with the margin: the one number a caller compares to a model's budget. */
export function estimateTokens(
  text: string,
  calibration: Readonly<TokenCalibration> = DEFAULT_CALIBRATION
): number {
  return withMargin(estimateRawTokens(text, calibration), calibration);
}
