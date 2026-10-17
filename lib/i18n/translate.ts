/**
 * The one lookup rule behind every `t()` in the app, so a Server Component
 * (`getServerTranslator()`) and a Client Component (`useLocale().t`) can never
 * answer differently for the same key.
 *
 * Pure: no React, no `'use client'`, safe on either side.
 *
 * @module lib/i18n/translate
 */

export type TranslationDictionary = Record<string, string>;

/** The `t` signature: a key, or the English text used as a key. */
export type Translate = (keyOrText: string, fallback?: string) => string;

/**
 * Looks `keyOrText` up in `dictionary`: as given, then trimmed, then as a
 * normalised key (`"Sign In!"` -> `"sign_in_"`). A miss is the `fallback`, or
 * the text itself, so an untranslated English literal still reads correctly.
 */
export function translate(
  dictionary: TranslationDictionary,
  keyOrText: string,
  fallback?: string
): string {
  if (!keyOrText) return '';
  const direct = dictionary[keyOrText];
  if (direct) return direct;
  const trimmed = dictionary[keyOrText.trim()];
  if (trimmed) return trimmed;
  const normalizedKey = keyOrText.toLowerCase().replace(/[^a-z0-9]/g, '_');
  const normalized = dictionary[normalizedKey];
  if (normalized) return normalized;

  return fallback || keyOrText;
}

/** `translate` bound to one dictionary. */
export function createTranslator(dictionary: TranslationDictionary): Translate {
  return (keyOrText, fallback) => translate(dictionary, keyOrText, fallback);
}
