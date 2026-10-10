/**
 * @jest-environment node
 */

import {
  SUPPORTED_LANGUAGES,
  SUPPORTED_LANGUAGE_CODES,
} from '@/lib/i18n/languages';
import {
  DEFAULT_LOCALE,
  LANGUAGE_FAMILIES,
  LOCALES,
  UNDETERMINED,
  directionOf,
  familyOfLocale,
  isDetectedLanguage,
  isLanguageFamily,
  isLocale,
  localesOfFamily,
  replyLocale,
} from '@/lib/intake';

// -- the plan's facts, written out by hand (not derived from the code under test) --------

/** The 19 interface locales and the language each one writes. */
const FAMILY_OF: Record<string, string> = {
  'en-US': 'en',
  'en-GB': 'en',
  es: 'es',
  de: 'de',
  pt: 'pt',
  'pt-BR': 'pt',
  it: 'it',
  ja: 'ja',
  ar: 'ar',
  fr: 'fr',
  ko: 'ko',
  zh: 'zh',
  'zh-TW': 'zh-TW',
  ur: 'ur',
  hi: 'hi',
  vi: 'vi',
  id: 'id',
  th: 'th',
  tr: 'tr',
};

/** Where a reply to a language goes when the interface is of another language (D1). */
const FIRST_LOCALE_OF: Record<string, string> = {
  en: 'en-US',
  es: 'es',
  de: 'de',
  pt: 'pt',
  it: 'it',
  ja: 'ja',
  ar: 'ar',
  fr: 'fr',
  ko: 'ko',
  zh: 'zh',
  'zh-TW': 'zh-TW',
  ur: 'ur',
  hi: 'hi',
  vi: 'vi',
  id: 'id',
  th: 'th',
  tr: 'tr',
};

/** The rule of D1 as a table lookup. */
function expectedReply(detected: unknown, ui: unknown): string {
  const interfaceLocale =
    typeof ui === 'string' && ui in FAMILY_OF ? ui : 'en-US';
  if (typeof detected !== 'string' || !(detected in FIRST_LOCALE_OF)) {
    return interfaceLocale;
  }
  if (FAMILY_OF[interfaceLocale] === detected) return interfaceLocale;
  return FIRST_LOCALE_OF[detected] as string;
}

describe('the locales', () => {
  it('are the 19 of the language pickers, not a second list', () => {
    expect([...LOCALES]).toEqual([...SUPPORTED_LANGUAGE_CODES]);
    expect(LOCALES).toHaveLength(19);
    expect(SUPPORTED_LANGUAGES).toHaveLength(19);
    expect([...LOCALES].sort()).toEqual(Object.keys(FAMILY_OF).sort());
  });

  it('are 17 languages: English and Portuguese twice, the two Chinese scripts apart', () => {
    expect(LANGUAGE_FAMILIES).toHaveLength(17);
    expect([...LANGUAGE_FAMILIES].sort()).toEqual(
      Object.keys(FIRST_LOCALE_OF).sort()
    );
    for (const locale of LOCALES) {
      expect(familyOfLocale(locale)).toBe(FAMILY_OF[locale]);
    }
    expect(localesOfFamily('en')).toEqual(['en-US', 'en-GB']);
    expect(localesOfFamily('pt')).toEqual(['pt', 'pt-BR']);
    expect(localesOfFamily('zh')).toEqual(['zh']);
    expect(localesOfFamily('zh-TW')).toEqual(['zh-TW']);
    expect(localesOfFamily('xx')).toEqual([]);
    // every locale belongs to exactly one language
    const all = LANGUAGE_FAMILIES.flatMap((family) => localesOfFamily(family));
    expect([...all].sort()).toEqual([...LOCALES].sort());
  });

  it('write right to left in Arabic and Urdu only', () => {
    for (const locale of LOCALES) {
      expect(directionOf(locale)).toBe(
        locale === 'ar' || locale === 'ur' ? 'rtl' : 'ltr'
      );
    }
  });

  it('start with the interface default', () => {
    expect(DEFAULT_LOCALE).toBe('en-US');
    expect(LOCALES[0]).toBe(DEFAULT_LOCALE);
  });

  it('are recognised exactly', () => {
    for (const locale of LOCALES) {
      expect(isLocale(locale)).toBe(true);
      expect(isLanguageFamily(locale)).toBe(locale in FIRST_LOCALE_OF);
    }
    for (const junk of [
      'en',
      'pt-br',
      'EN-US',
      '',
      'und',
      'fr-FR',
      null,
      undefined,
      1,
      {},
    ]) {
      expect(isLocale(junk)).toBe(false);
    }
    expect(isLocale('en')).toBe(false); // a language, not a locale
    expect(isLanguageFamily('en')).toBe(true);
    expect(isLanguageFamily('en-US')).toBe(false);
    expect(isLanguageFamily('pt-BR')).toBe(false);
    expect(isLanguageFamily(UNDETERMINED)).toBe(false);
    expect(isDetectedLanguage(UNDETERMINED)).toBe(true);
    expect(isDetectedLanguage('th')).toBe(true);
    expect(isDetectedLanguage('ru')).toBe(false);
    expect(isDetectedLanguage('en-GB')).toBe(false);
    expect(isDetectedLanguage(undefined)).toBe(false);
  });
});

describe('the locale of a reply (decision D1)', () => {
  it('answers Portuguese text from a Brazilian interface in Brazilian Portuguese', () => {
    expect(replyLocale('pt', 'pt-BR')).toBe('pt-BR');
    expect(replyLocale('pt', 'pt')).toBe('pt');
  });

  it('answers English from a British interface in British English', () => {
    expect(replyLocale('en', 'en-GB')).toBe('en-GB');
    expect(replyLocale('en', 'en-US')).toBe('en-US');
  });

  it('answers a language that is not the interface’s in the first locale of that language', () => {
    expect(replyLocale('en', 'de')).toBe('en-US');
    expect(replyLocale('pt', 'es')).toBe('pt');
    expect(replyLocale('zh', 'zh-TW')).toBe('zh');
    expect(replyLocale('zh-TW', 'zh')).toBe('zh-TW');
    expect(replyLocale('th', 'en-GB')).toBe('th');
    expect(replyLocale('ar', 'ur')).toBe('ar');
  });

  it('falls back to the interface when the language is unknown, undetermined or outside the 17', () => {
    expect(replyLocale('und', 'ja')).toBe('ja');
    expect(replyLocale(null, 'pt-BR')).toBe('pt-BR');
    expect(replyLocale(undefined, 'en-GB')).toBe('en-GB');
    expect(replyLocale('ru', 'de')).toBe('de');
    expect(replyLocale('pt-BR', 'de')).toBe('de'); // a locale is not a language
    expect(replyLocale('', 'fr')).toBe('fr');
  });

  it('falls back to the default when the interface value is not a locale', () => {
    expect(replyLocale('und', 'xx')).toBe('en-US');
    expect(replyLocale('und', null)).toBe('en-US');
    expect(replyLocale('und', undefined)).toBe('en-US');
    expect(replyLocale('th', 'xx')).toBe('th');
    expect(replyLocale('en', 'xx')).toBe('en-US');
    expect(replyLocale(null, '')).toBe('en-US');
  });

  it('gives the table answer for all 19 interfaces against all 17 languages and the three non-languages', () => {
    const detected: unknown[] = [
      ...Object.keys(FIRST_LOCALE_OF),
      UNDETERMINED,
      null,
      'ru',
    ];
    let cases = 0;
    for (const ui of Object.keys(FAMILY_OF)) {
      for (const language of detected) {
        expect(replyLocale(language as string | null, ui)).toBe(
          expectedReply(language, ui)
        );
        cases += 1;
      }
    }
    expect(cases).toBe(19 * 20);
  });

  it('is always one of the 19 locales', () => {
    for (const ui of [...LOCALES, 'xx', '', null, undefined]) {
      for (const language of [...LANGUAGE_FAMILIES, 'und', 'ru', null]) {
        expect(LOCALES).toContain(replyLocale(language, ui));
      }
    }
  });
});
