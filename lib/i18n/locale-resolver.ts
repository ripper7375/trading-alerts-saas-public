import {
  SUPPORTED_COUNTRIES,
  DEFAULT_COUNTRY,
  type CountryConfig,
} from '@/lib/country-config';

/**
 * Single source of truth for turning a country prefix / cookie language into a
 * COMPLETE set of locale preferences.
 *
 * This module is deliberately free of both `next/headers` and browser globals so
 * the exact same resolution runs in three places that must agree byte-for-byte:
 *
 *   1. `middleware.ts`      — reads the `/th/...` URL prefix
 *   2. `app/layout.tsx`     — server render (SSR HTML)
 *   3. `locale-context.tsx` — client hydration (first React render)
 *
 * If any of the three disagreed, React would hydrate over mismatched text and
 * the user would see the English -> Thai flip this module exists to prevent.
 */

export interface LocalePreferences {
  countryCode: string;
  language: string;
  timezone: string;
  dateFormat: 'MDY' | 'DMY' | 'YMD';
  timeFormat: '12h' | '24h';
  currency: string;
}

export const LOCALE_COOKIE = 'davintrade-locale';
export const LOCALE_STORAGE_KEY = 'davin_locale_preferences';

/**
 * Set by `middleware.ts` on the rewritten request so the server render can see
 * the country prefix. The rewrite strips `/th` from the pathname before the
 * layout runs, so without this header SSR has no way to know the URL asked for
 * Thai and would fall back to the cookie (or English) and then flip on hydrate.
 */
export const COUNTRY_HEADER = 'x-davin-country';

/** Lowercase URL prefixes (`gb`, `th`, ...) shared with the middleware matcher. */
export const SUPPORTED_COUNTRY_PREFIXES = Object.keys(SUPPORTED_COUNTRIES);

/**
 * Three countries share `en-US` (ng, za, us) so a plain
 * `Object.values(SUPPORTED_COUNTRIES).find(c => c.language === lang)` resolved
 * `en-US` to Nigeria purely because of object key order — giving an American
 * user NGN currency and Africa/Lagos time on the server, then flipping to
 * USD/New_York after hydration. Pin the primary country per language instead.
 */
const PRIMARY_COUNTRY_FOR_LANGUAGE: Record<string, string> = {
  'en-GB': 'gb',
  'en-US': 'us',
  hi: 'in',
  ur: 'pk',
  vi: 'vn',
  id: 'id',
  th: 'th',
  tr: 'tr',
  de: 'eu',
  ja: 'jp',
  ar: 'ae',
  fr: 'fr',
  ko: 'kr',
};

/** Expand a country config into the full preference set (never a partial one). */
export function preferencesFromCountry(
  config: CountryConfig
): LocalePreferences {
  return {
    countryCode: config.code,
    language: config.language,
    timezone: config.timezone,
    dateFormat: config.dateFormat,
    timeFormat: config.timeFormat,
    currency: config.currency,
  };
}

export const defaultPreferences: LocalePreferences =
  preferencesFromCountry(DEFAULT_COUNTRY);

export function isSupportedCountryPrefix(prefix?: string | null): boolean {
  return !!prefix && prefix.toLowerCase() in SUPPORTED_COUNTRIES;
}

export function preferencesForCountryPrefix(
  prefix?: string | null
): LocalePreferences | null {
  if (!prefix) return null;
  const config = SUPPORTED_COUNTRIES[prefix.toLowerCase()];
  return config ? preferencesFromCountry(config) : null;
}

export function preferencesForLanguage(
  language?: string | null
): LocalePreferences | null {
  if (!language) return null;

  const primary = PRIMARY_COUNTRY_FOR_LANGUAGE[language];
  if (primary && SUPPORTED_COUNTRIES[primary]) {
    return preferencesFromCountry(SUPPORTED_COUNTRIES[primary]);
  }

  // Languages added to a country config without a primary mapping still resolve.
  const match = Object.values(SUPPORTED_COUNTRIES).find(
    (c) => c.language === language
  );
  return match ? preferencesFromCountry(match) : null;
}

/**
 * The authoritative resolution order, used identically on server and client.
 *
 * URL prefix wins over the cookie because it is the more explicit signal — a
 * user opening `/th/pricing` asked for Thai on this request regardless of what
 * their cookie happens to say.
 */
export function resolvePreferences({
  countryPrefix,
  cookieLanguage,
}: {
  countryPrefix?: string | null;
  cookieLanguage?: string | null;
}): LocalePreferences {
  return (
    preferencesForCountryPrefix(countryPrefix) ??
    preferencesForLanguage(cookieLanguage) ??
    defaultPreferences
  );
}

/** Serialised cookie value written by every client-side preference change. */
export function localeCookieString(language: string): string {
  return `${LOCALE_COOKIE}=${language}; path=/; max-age=31536000; SameSite=Lax`;
}
