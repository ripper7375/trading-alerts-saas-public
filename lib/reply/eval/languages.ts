/**
 * The 19 locales as the evaluation suite counts them (build step 7 part 10; architecture 5.10,
 * plan part 10).
 *
 * "All 19 within 5 points of English" compares LOCALES, not language families: `en-GB` is as much
 * a locale of the run as `ar`, and `pt` and `pt-BR` are two. English is the yardstick, and its
 * yardstick is `en-US`, the interface's default locale.
 *
 * The 17 LANGUAGES behind them are the units of the wording lists (`checks/wording-lists.ts`);
 * the suite reports both, because a failure in `pt-BR` and a failure in `pt` have one cause, the
 * Portuguese list.
 *
 * Pure.
 *
 * @module lib/reply/eval/languages
 */

import { DEFAULT_LOCALE, LOCALES, familyOfLocale } from '../contracts/intake';
import type { Locale } from '../contracts/intake';

/** The locale every other locale is compared with. */
export const BASELINE_LOCALE: Locale = DEFAULT_LOCALE;

/** How far below English a locale's score may be, in percentage points (architecture 5.10). */
export const LANGUAGE_BAR_POINTS = 5;

/** The 19 locales, in the interface's order. */
export const EVAL_LOCALES: readonly Locale[] = LOCALES;

/** The language (family) a locale is written in: `en` for both English locales, `zh-TW` for itself. */
export function languageOfLocale(locale: Locale): string {
  return familyOfLocale(locale);
}

/** The 17 languages of the 19 locales, in order of first appearance. */
export const EVAL_LANGUAGES: readonly string[] = Array.from(
  new Set(EVAL_LOCALES.map(languageOfLocale))
);

/** The locales written in one language. */
export function localesOfLanguage(language: string): Locale[] {
  return EVAL_LOCALES.filter((locale) => languageOfLocale(locale) === language);
}

/** Is this one of the 19 locales? */
export function isEvalLocale(value: unknown): value is Locale {
  return (
    typeof value === 'string' &&
    (EVAL_LOCALES as readonly string[]).includes(value)
  );
}
