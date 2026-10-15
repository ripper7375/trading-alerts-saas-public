/**
 * The placeholder resolver (build step 7 part 5; architecture 5.7, ADR-052, plan section 4):
 * fills the `{id}` placeholders of the model's text from the cycle's value dictionary, so a
 * number reaches the trader in one way only, as the engines gave it.
 *
 *  - An id the dictionary does not know, or knows but never offered to the model (a match-only
 *    entry), is a FAILURE, never a blank and never a brace left in the text. One failure fails
 *    the whole text: the caller regenerates or falls back to a fixed answer, it does not show a
 *    sentence with a hole in it.
 *  - Numbers are written for the reply's locale: the decimal mark and the grouping of that
 *    language, but ALWAYS ASCII digits (prices and levels are read as figures, and the number check
 *    reads them back in every notation). In right-to-left languages (Arabic, Urdu) each figure is
 *    wrapped in a left-to-right isolate, so the digits, the separators and the sign keep their
 *    order inside the right-to-left line.
 *  - Level names, sensor ids (`MCD2`), zone ids and state codes are not placeholders and are never
 *    touched: they stay as the model wrote them, untranslated.
 *
 * What a figure looks like by the kind of its entry (no currency sign: the placement of one is a
 * per-language copy decision for the native readers, and the number check reads a bare figure):
 *
 *   PRICE, DISTANCE   two decimals            4,367.25   4.367,25
 *   PCT               up to two, then %       1.5%
 *   RATIO             up to two decimals      1.47   2
 *   COUNT             a whole number          12
 *   TIME              hh:mm UTC, with the date when it is not the cycle's own day
 *
 * Pure: the same text and dictionary give the same result.
 *
 * @module lib/reply/report1/resolve
 */

import {
  clockOf,
  directionOf,
  isEpochSeconds,
  slotIso,
} from '../contracts/intake';
import type { Locale } from '../contracts/intake';
import type { ResolvedLine } from '../contracts/result';
import { scanPlaceholders } from '../contracts/shape';
import type { ReportLine } from '../contracts/shape';
import type { ValueDictionary, ValueEntry } from '../checks/value-dictionary';

export interface NumberStyle {
  /** the decimal mark */
  decimal: string;
  /** the thousands separator */
  group: string;
}

const POINT: NumberStyle = { decimal: '.', group: ',' };
const COMMA: NumberStyle = { decimal: ',', group: '.' };
const NARROW_NO_BREAK_SPACE = String.fromCharCode(0x202f);
const FRENCH: NumberStyle = { decimal: ',', group: NARROW_NO_BREAK_SPACE };

/**
 * The number style of each of the 19 locales. These are drafts for the native readers (they are
 * the common written forms, not a CLDR import: the output must not depend on the ICU data of the
 * machine). A locale that is not in the table is formatted like English.
 */
export const NUMBER_STYLES: Readonly<Record<string, NumberStyle>> = {
  'en-US': POINT,
  'en-GB': POINT,
  ar: POINT,
  de: COMMA,
  es: COMMA,
  fr: FRENCH,
  hi: POINT,
  id: COMMA,
  it: COMMA,
  ja: POINT,
  ko: POINT,
  pt: COMMA,
  'pt-BR': COMMA,
  th: POINT,
  tr: COMMA,
  ur: POINT,
  vi: COMMA,
  zh: POINT,
  'zh-TW': POINT,
};

/** The left-to-right isolate and its terminator (Unicode bidirectional isolates). */
export const LRI = String.fromCharCode(0x2066);
export const PDI = String.fromCharCode(0x2069);

export type ResolveFailureCode =
  | 'BAD_BRACES'
  | 'UNKNOWN_ID'
  | 'NOT_OFFERED'
  | 'NOT_FORMATTABLE';

export interface ResolveFailure {
  code: ResolveFailureCode;
  /** where in the reply: `headline`, `rationale[0].text` */
  path: string;
  /** the id, when the failure is about one */
  id: string | null;
  detail: string;
}

export interface ResolveOptions {
  locale: Locale;
  /**
   * The cycle's slot in unix seconds. A time on the same UTC day is written `hh:mm UTC`; any other
   * is written with its date. Omitted, every time carries its date.
   */
  referenceSeconds?: number | null;
}

export type ResolvedText =
  | { ok: true; text: string; ids: string[] }
  | { ok: false; failures: ResolveFailure[] };

export function styleOf(locale: Locale): NumberStyle {
  return Object.prototype.hasOwnProperty.call(NUMBER_STYLES, locale)
    ? (NUMBER_STYLES[locale] as NumberStyle)
    : POINT;
}

/** The biggest magnitude `toFixed` writes without an exponent is 1e21; a price is never near it. */
const FORMAT_LIMIT = 1e15;

interface FixedParts {
  /** a minus sign, only when the figure is not zero as written */
  negative: boolean;
  whole: string;
  fraction: string;
}

/** The magnitude of a value written to `decimals` places, split at the decimal point. */
function fixedParts(value: number, decimals: number): FixedParts {
  const fixed = Math.abs(value).toFixed(decimals);
  const [whole, fraction = ''] = fixed.split('.') as [string, string?];
  return { negative: value < 0 && /[1-9]/.test(fixed), whole, fraction };
}

function assemble(
  parts: FixedParts,
  fraction: string,
  style: NumberStyle
): string {
  const grouped = parts.whole.replace(/\B(?=(\d{3})+(?!\d))/g, style.group);
  return `${parts.negative ? '-' : ''}${grouped}${fraction === '' ? '' : style.decimal + fraction}`;
}

/** Exactly `decimals` places: 4,367.25 */
function fixedText(
  value: number,
  decimals: number,
  style: NumberStyle
): string {
  const parts = fixedParts(value, decimals);
  return assemble(parts, parts.fraction, style);
}

/** Up to `decimals` places with the trailing zeros dropped: 1.5, 2 */
function trimmedText(
  value: number,
  decimals: number,
  style: NumberStyle
): string {
  const parts = fixedParts(value, decimals);
  return assemble(parts, parts.fraction.replace(/0+$/, ''), style);
}

const SECONDS_PER_DAY = 86_400;

function timeText(seconds: number, reference: number | null): string {
  if (seconds < SECONDS_PER_DAY) {
    // a time of day with no date (seconds since midnight)
    return `${clockOf(seconds)} UTC`;
  }
  const sameDay =
    reference !== null &&
    Math.floor(seconds / SECONDS_PER_DAY) ===
      Math.floor(reference / SECONDS_PER_DAY);
  return sameDay
    ? `${clockOf(seconds)} UTC`
    : `${slotIso(seconds).slice(0, 10)} ${clockOf(seconds)} UTC`;
}

/**
 * One figure as the trader reads it, or null when the entry cannot be written (not a finite
 * number of a size a figure has, or a time outside the calendar).
 */
export function formatValue(
  entry: ValueEntry,
  options: ResolveOptions
): string | null {
  const { value } = entry;
  if (!Number.isFinite(value) || Math.abs(value) >= FORMAT_LIMIT) return null;
  const style = styleOf(options.locale);
  let text: string;
  switch (entry.kind) {
    case 'PRICE':
    case 'DISTANCE':
      text = fixedText(value, 2, style);
      break;
    case 'PCT':
      text = `${trimmedText(value, 2, style)}%`;
      break;
    case 'RATIO':
      text = trimmedText(value, 2, style);
      break;
    case 'COUNT':
      text = fixedText(Math.round(value), 0, style);
      break;
    case 'TIME': {
      const whole = Math.round(value);
      if (!isEpochSeconds(whole)) return null;
      text = timeText(whole, options.referenceSeconds ?? null);
      break;
    }
  }
  return directionOf(options.locale) === 'rtl' ? `${LRI}${text}${PDI}` : text;
}

/**
 * Fill the placeholders of ONE text. The whole text fails if any placeholder cannot be filled or
 * any brace is left over; nothing is returned in part.
 */
export function resolveText(
  text: string,
  path: string,
  dictionary: ValueDictionary,
  options: ResolveOptions
): ResolvedText {
  const failures: ResolveFailure[] = [];
  const scan = scanPlaceholders(text);
  for (const fault of scan.faults) {
    failures.push({ code: 'BAD_BRACES', path, id: null, detail: fault });
  }

  const filled = new Map<string, string>();
  for (const id of new Set(scan.ids)) {
    const entry = dictionary.byId.get(id);
    if (entry === undefined) {
      failures.push({
        code: 'UNKNOWN_ID',
        path,
        id,
        detail: `{${id}} is not a value of this cycle`,
      });
    } else if (!entry.addressable) {
      failures.push({
        code: 'NOT_OFFERED',
        path,
        id,
        detail: `{${id}} exists but was never offered to the model`,
      });
    } else {
      const written = formatValue(entry, options);
      if (written === null) {
        failures.push({
          code: 'NOT_FORMATTABLE',
          path,
          id,
          detail: `{${id}} cannot be written as a ${entry.kind}`,
        });
      } else {
        filled.set(id, written);
      }
    }
  }
  if (failures.length > 0) return { ok: false, failures };

  const out = text.replace(
    /\{([^{}]*)\}/g,
    (_whole, id: string) => filled.get(id) as string
  );
  return { ok: true, text: out, ids: scan.ids };
}

/** Fill the placeholders of a list of lines; every failure of every line is reported. */
export function resolveLines(
  lines: readonly ReportLine[],
  path: string,
  dictionary: ValueDictionary,
  options: ResolveOptions
):
  | { ok: true; lines: ResolvedLine[] }
  | { ok: false; failures: ResolveFailure[] } {
  const failures: ResolveFailure[] = [];
  const out: ResolvedLine[] = [];
  lines.forEach((line, index) => {
    const resolved = resolveText(
      line.text,
      `${path}[${index}].text`,
      dictionary,
      options
    );
    if (resolved.ok) out.push({ text: resolved.text, cites: [...line.cites] });
    else failures.push(...resolved.failures);
  });
  return failures.length > 0
    ? { ok: false, failures }
    : { ok: true, lines: out };
}
