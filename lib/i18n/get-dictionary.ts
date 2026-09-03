import enGBDict from '@/lib/i18n/dictionaries/en-GB.json';
import enUSDict from '@/lib/i18n/dictionaries/en-US.json';
import thDict from '@/lib/i18n/dictionaries/th.json';
import deDict from '@/lib/i18n/dictionaries/de.json';
import esDict from '@/lib/i18n/dictionaries/es.json';
import jaDict from '@/lib/i18n/dictionaries/ja.json';
import hiDict from '@/lib/i18n/dictionaries/hi.json';
import viDict from '@/lib/i18n/dictionaries/vi.json';
import idDict from '@/lib/i18n/dictionaries/id.json';
import trDict from '@/lib/i18n/dictionaries/tr.json';
import urDict from '@/lib/i18n/dictionaries/ur.json';
import ptDict from '@/lib/i18n/dictionaries/pt.json';
import arDict from '@/lib/i18n/dictionaries/ar.json';
import frDict from '@/lib/i18n/dictionaries/fr.json';
import koDict from '@/lib/i18n/dictionaries/ko.json';
import zhDict from '@/lib/i18n/dictionaries/zh.json';
import zhTWDict from '@/lib/i18n/dictionaries/zh-TW.json';

/**
 * Server-safe mirror of `lib/context/locale-context.tsx`'s dictionary map, for
 * use in `generateMetadata()` and other Server Components that run before any
 * client provider exists. Deliberately a separate module (no `'use client'`,
 * no React) rather than importing from locale-context.tsx directly, so server
 * code never pulls client-context internals into its module graph.
 *
 * Unlike the client provider — which only bundles `en-GB`/`en-US`/`th`
 * synchronously and lazy-loads the rest to keep the client bundle small —
 * this loads every dictionary eagerly. There is no bundle-size concern on the
 * server, and metadata generation needs a synchronous, deterministic result.
 */
const dictionaries: Record<string, Record<string, string>> = {
  'en-GB': enGBDict,
  'en-US': enUSDict,
  th: thDict,
  de: deDict,
  es: esDict,
  ja: jaDict,
  hi: hiDict,
  vi: viDict,
  id: idDict,
  tr: trDict,
  ur: urDict,
  pt: ptDict,
  ar: arDict,
  fr: frDict,
  ko: koDict,
  zh: zhDict,
  'zh-TW': zhTWDict,
};

/** Same fallback convention as `dictionaryFor()` in locale-context.tsx: en-GB is the base. */
export function getDictionary(language: string): Record<string, string> {
  return dictionaries[language] || dictionaries['en-GB']!;
}
