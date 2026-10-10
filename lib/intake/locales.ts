/**
 * The locales of the intake path and the rule for the language of a reply
 * (architecture 4.3 and 7.9, ADR-038, plan decision D1).
 *
 * There are 19 interface locales and 17 languages: English twice (`en-US`,
 * `en-GB`) and Portuguese twice (`pt`, `pt-BR`); Simplified and Traditional
 * Chinese (`zh`, `zh-TW`) are two languages in two scripts. The list is NOT
 * written again here: it is `SUPPORTED_LANGUAGES`, the one list the language
 * pickers use, so a locale added there appears in the intake path at once (and
 * fails the pinned counts of the tests until the plan says so).
 *
 * The Understand call detects a LANGUAGE (one of the families below, or `und`),
 * never a locale; the reply is written in a locale (`replyLocale`).
 *
 * @module lib/intake/locales
 */

import { SUPPORTED_LANGUAGES, textDirection } from '@/lib/i18n/languages';

/** One of the 19 interface locales, as `SUPPORTED_LANGUAGES` spells it. */
export type Locale = string;

/** One of the 17 languages: the locale's own code, or its base subtag for en and pt. */
export type LanguageFamily = string;

/** What the Understand call returns when it cannot tell the language. */
export const UNDETERMINED = 'und';

/** The interface default (the first locale of the list), used for a locale that is not one. */
export const DEFAULT_LOCALE: Locale = 'en-US';

export const LOCALES: readonly Locale[] = SUPPORTED_LANGUAGES.map(
  (language) => language.code
);

/**
 * Locales whose region is a different LANGUAGE rather than a regional variant:
 * Traditional Chinese is its own family; `en-US` and `en-GB` share `en`.
 */
const OWN_FAMILY: ReadonlySet<string> = new Set(['zh-TW']);

export function familyOfLocale(locale: Locale): LanguageFamily {
  if (OWN_FAMILY.has(locale)) return locale;
  const dash = locale.indexOf('-');
  return dash === -1 ? locale : locale.slice(0, dash);
}

export const LANGUAGE_FAMILIES: readonly LanguageFamily[] = Array.from(
  new Set(LOCALES.map(familyOfLocale))
);

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && LOCALES.includes(value);
}

export function isLanguageFamily(value: unknown): value is LanguageFamily {
  return typeof value === 'string' && LANGUAGE_FAMILIES.includes(value);
}

/** What the Understand call may say about the language: a family, or `und`. */
export function isDetectedLanguage(value: unknown): value is string {
  return value === UNDETERMINED || isLanguageFamily(value);
}

/** The locales of one language, in list order (so the first is its default). */
export function localesOfFamily(family: LanguageFamily): Locale[] {
  return LOCALES.filter((locale) => familyOfLocale(locale) === family);
}

/** Arabic and Urdu are right to left. */
export function directionOf(locale: Locale): 'ltr' | 'rtl' {
  return textDirection(locale);
}

/**
 * The locale a reply is written in (decision D1).
 *
 *  - The detected language wins, except that when the user's interface locale is
 *    a locale of that same language it wins (`pt` text from a `pt-BR` interface is
 *    answered in `pt-BR`; English from `en-GB` in `en-GB`).
 *  - A language of the list that is not the interface's is answered in the first
 *    locale of that language (English from a German interface: `en-US`).
 *  - `und`, no detection or a language outside the 17 falls back to the interface
 *    locale; an interface value that is not a locale falls back to the default.
 *
 * An instant prompt has no typed text: its "detected" language is the interface's
 * own, and the answer is the interface locale.
 */
export function replyLocale(
  detected: string | null | undefined,
  interfaceLocale: string | null | undefined
): Locale {
  const ui = isLocale(interfaceLocale) ? interfaceLocale : DEFAULT_LOCALE;
  if (!isLanguageFamily(detected)) return ui;
  if (familyOfLocale(ui) === detected) return ui;
  return localesOfFamily(detected)[0] ?? ui;
}
