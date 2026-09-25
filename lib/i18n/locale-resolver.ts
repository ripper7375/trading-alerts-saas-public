import {
  SUPPORTED_COUNTRIES,
  DEFAULT_COUNTRY,
  isSupportedCurrency,
  type CountryConfig,
} from '@/lib/country-config';
import { isSupportedLanguage } from '@/lib/i18n/languages';

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
  /**
   * True once the user picks a timezone themselves. Until then the timezone
   * is the one detected from their IP address, and a country or language
   * change never touches it (a Thai speaker in London keeps London time).
   */
  timezoneSetByUser?: boolean;
}

export const LOCALE_COOKIE = 'davintrade-locale';

/**
 * The display currency, written with the language cookie so Server
 * Components format money in the currency the user chose (Thai with GBP),
 * not the one their language implies.
 */
export const CURRENCY_COOKIE = 'davintrade-currency';

/** The user's date and time format, e.g. `DMY.24h`. */
export const FORMATS_COOKIE = 'davintrade-formats';

const DATE_FORMATS = ['MDY', 'DMY', 'YMD'] as const;
const TIME_FORMATS = ['12h', '24h'] as const;

function parseFormatsCookie(
  value?: string | null
): Pick<LocalePreferences, 'dateFormat' | 'timeFormat'> | null {
  const [date, time] = (value ?? '').split('.');
  const dateFormat = DATE_FORMATS.find((f) => f === date);
  const timeFormat = TIME_FORMATS.find((f) => f === time);
  return dateFormat && timeFormat ? { dateFormat, timeFormat } : null;
}

/** A timezone the user picked themselves; absent while it is IP-detected. */
export const TIMEZONE_COOKIE = 'davintrade-timezone';

/**
 * Request headers carrying the visitor's IP-derived IANA timezone: Vercel
 * always sends the first; Cloudflare sends the second when its "visitor
 * location headers" transform is on.
 */
export const IP_TIMEZONE_HEADERS = ['x-vercel-ip-timezone', 'cf-timezone'];
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
  'en-US': 'us',
  'en-GB': 'gb',
  en: 'gb',
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

/** Whether `timezone` is an IANA zone this runtime can format in. */
export function isValidTimezone(timezone?: string | null): timezone is string {
  if (!timezone) return false;
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

/**
 * The authoritative resolution order, used identically on server and client.
 *
 * URL prefix wins over the cookie because it is the more explicit signal — a
 * user opening `/th/pricing` asked for Thai on this request regardless of what
 * their cookie happens to say. The prefix also brings its own currency; the
 * currency cookie only refines a cookie-language resolution.
 *
 * Timezone is independent of both: the user's own pick, else the IP-detected
 * zone, else the country's default.
 */
export function resolvePreferences({
  countryPrefix,
  cookieLanguage,
  cookieCurrency,
  cookieFormats,
  cookieTimezone,
  detectedTimezone,
}: {
  countryPrefix?: string | null;
  cookieLanguage?: string | null;
  cookieCurrency?: string | null;
  cookieFormats?: string | null;
  cookieTimezone?: string | null;
  detectedTimezone?: string | null;
}): LocalePreferences {
  const fromPrefix = preferencesForCountryPrefix(countryPrefix);
  // The cookie is user-controlled and the result reaches `<html lang>` and an
  // inline script, so an unknown value is ignored rather than passed through.
  const language = isSupportedLanguage(cookieLanguage) ? cookieLanguage : null;
  // A language with no backing country (zh, zh-TW, es, pt) keeps the default
  // formats but must not fall back to English.
  const fromLanguage =
    fromPrefix ??
    (language
      ? (preferencesForLanguage(language) ?? {
          ...defaultPreferences,
          language,
        })
      : defaultPreferences);
  // The user's own date/time format refines a cookie-language resolution; a
  // URL prefix brings its country's formats, like its currency.
  const formats = fromPrefix ? null : parseFormatsCookie(cookieFormats);
  const base = formats ? { ...fromLanguage, ...formats } : fromLanguage;

  const currency =
    !fromPrefix && isSupportedCurrency(cookieCurrency)
      ? cookieCurrency!.toUpperCase()
      : base.currency;

  if (isValidTimezone(cookieTimezone)) {
    return {
      ...base,
      currency,
      timezone: cookieTimezone,
      timezoneSetByUser: true,
    };
  }
  return {
    ...base,
    currency,
    timezone: isValidTimezone(detectedTimezone)
      ? detectedTimezone
      : base.timezone,
    timezoneSetByUser: false,
  };
}

/** Serialised cookie value written by every client-side preference change. */
export function localeCookieString(language: string): string {
  return `${LOCALE_COOKIE}=${language}; path=/; max-age=31536000; SameSite=Lax`;
}

/**
 * The cookies that let the server render the user's currency, date/time
 * format and timezone.
 */
export function preferenceCookieStrings(prefs: LocalePreferences): string[] {
  const attrs = 'path=/; SameSite=Lax';
  return [
    `${CURRENCY_COOKIE}=${prefs.currency}; ${attrs}; max-age=31536000`,
    `${FORMATS_COOKIE}=${prefs.dateFormat}.${prefs.timeFormat}; ${attrs}; max-age=31536000`,
    prefs.timezoneSetByUser
      ? `${TIMEZONE_COOKIE}=${encodeURIComponent(prefs.timezone)}; ${attrs}; max-age=31536000`
      : `${TIMEZONE_COOKIE}=; ${attrs}; max-age=0`,
  ];
}
