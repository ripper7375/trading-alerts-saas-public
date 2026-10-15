/**
 * The number check (build step 7 part 4; architecture 5.8, ADR-053, plan decisions D11 and D13).
 *
 * "Every number in a reply must exist in its context." The model is told never to type a number
 * (it writes `{id}` and the server fills the value), so a literal in its text is either a small
 * count or ordinal (exempt, D13), or a slip. This check finds every literal (`extract.ts`), judges
 * each against the cycle's value dictionary (`matcher.ts`), and reports:
 *   - how many literals it judged, how many matched, the match rate;
 *   - the ones that did not (the violations), each with its text, its place, and what it was;
 *   - whether to ask the model again. ONE regeneration is allowed for the whole reply, shared with
 *     the wording check (D11, see `report.ts`); the literals that failed are the model's own words,
 *     so they are safe to name when asking again.
 * A literal still unmatched after that is replaced, in the text, by the "not verified" mark of the
 * reply's language (`flagUnverified`), never silently dropped.
 *
 * It does not call anything and keeps nothing: the same texts and dictionary give the same result.
 *
 * Pure.
 *
 * @module lib/reply/checks/number-check
 */

import type { Locale } from '../contracts/intake';
import { familyOfLocale } from '../contracts/intake';
import { NUMBER_CLASSES } from '../contracts/trace-fields';
import type { NumberClass } from '../contracts/trace-fields';
import { extractNumbers } from './extract';
import type { LiteralSyntax } from './extract';
import { classOf, matchLiteral } from './matcher';
import type { ValueDictionary } from './value-dictionary';
import type { ModelText } from './wording-check';
import { notVerifiedMark } from './wording-lists';

export interface NumberViolation {
  path: string;
  /** the literal as the model wrote it (its own words: safe to send back) */
  raw: string;
  /** span in the original text of that path, UTF-16 offsets, end exclusive */
  start: number;
  end: number;
  syntax: LiteralSyntax;
  class: NumberClass;
  readings: number[];
}

export interface NumberCheckResult {
  /** literals judged: every one that is not an exempt small count */
  extracted: number;
  /** small counts and ordinals that were seen and not judged (D13) */
  exempt: number;
  matched: number;
  /** matched / extracted; 1 when nothing was judged */
  matchRate: number;
  violations: NumberViolation[];
  /** the violations by class; they add up to the violation count */
  classes: Record<NumberClass, number>;
  /** at least one literal failed: ask the model again, once */
  needsRegeneration: boolean;
}

export function emptyClassCounts(): Record<NumberClass, number> {
  const counts = {} as Record<NumberClass, number>;
  for (const kind of NUMBER_CLASSES) counts[kind] = 0;
  return counts;
}

/** Check the numbers in the texts of a reply against the cycle's value dictionary. */
export function checkNumbers(
  texts: readonly ModelText[],
  dictionary: ValueDictionary,
  locale: Locale
): NumberCheckResult {
  const language = familyOfLocale(locale);
  let extracted = 0;
  let exempt = 0;
  let matched = 0;
  const violations: NumberViolation[] = [];
  const classes = emptyClassCounts();
  for (const item of texts) {
    for (const literal of extractNumbers(item.text, item.path, language)) {
      if (literal.exempt !== null) {
        exempt += 1;
        continue;
      }
      extracted += 1;
      if (matchLiteral(literal, dictionary).matched) {
        matched += 1;
        continue;
      }
      const kind = classOf(literal);
      classes[kind] += 1;
      violations.push({
        path: literal.path,
        raw: literal.raw,
        start: literal.start,
        end: literal.end,
        syntax: literal.syntax,
        class: kind,
        readings: literal.readings,
      });
    }
  }
  return {
    extracted,
    exempt,
    matched,
    matchRate: extracted === 0 ? 1 : matched / extracted,
    violations,
    classes,
    needsRegeneration: violations.length > 0,
  };
}

/** The distinct literals that failed, as the model wrote them, for the one regeneration. */
export function failedLiterals(result: NumberCheckResult): string[] {
  return [...new Set(result.violations.map((violation) => violation.raw))];
}

// ---------------------------------------------------------------------------
// Flagging
// ---------------------------------------------------------------------------

const BEFORE_SIGNS = /[$\uff04\ufe69] ?$/;
const AFTER_SIGNS = /^ ?[%\u066a\uff05\ufe6a]/;

/**
 * Replace each violation of ONE text by `mark`, working from the end so the spans stay true. The
 * sign that belongs to the number (a dollar sign before it, a percent sign after it) goes with it,
 * so the reader does not see "$—, not verified".
 */
export function flagUnverified(
  text: string,
  violations: readonly NumberViolation[],
  mark: string
): string {
  let out = text;
  const ordered = [...violations].sort((a, b) => b.start - a.start);
  let floor = Number.POSITIVE_INFINITY;
  for (const violation of ordered) {
    let start = violation.start;
    let end = violation.end;
    const beforeSign = BEFORE_SIGNS.exec(text.slice(0, start));
    if (beforeSign !== null) start -= beforeSign[0].length;
    const afterSign = AFTER_SIGNS.exec(text.slice(end));
    if (afterSign !== null) end += afterSign[0].length;
    if (end > floor) continue; // a span already replaced by the one after it
    out = `${out.slice(0, start)}${mark}${out.slice(end)}`;
    floor = start;
  }
  return out;
}

/**
 * The texts of a reply with every violation replaced by the mark of the reply's language. The
 * violations are matched to their texts by path; a text with none is returned as it is.
 */
export function flagAll(
  texts: readonly ModelText[],
  violations: readonly NumberViolation[],
  locale: Locale
): ModelText[] {
  const mark = notVerifiedMark(locale);
  return texts.map((item) => {
    const own = violations.filter((violation) => violation.path === item.path);
    return own.length === 0
      ? item
      : { path: item.path, text: flagUnverified(item.text, own, mark) };
  });
}
