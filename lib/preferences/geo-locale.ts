/**
 * Server-Side GeoIP Locale Resolution
 *
 * Resolves a guest/new user's locale bundle from edge-injected GeoIP
 * headers (`cf-ipcountry` on Cloudflare, `x-vercel-ip-country` on Vercel)
 * so the very first server render already reflects their country instead
 * of always defaulting to `en-US`/USD and flipping after client-side
 * hydration (the FOUC-equivalent gap described in the language/timezone/
 * regional-format hand-off spec, §4).
 *
 * Mirrors the per-country bundle in `seed-code/trading-conversational-ai-ui-
 * pages-increment/lib/country-config.ts` (client-side reference), but is
 * keyed by the REAL ISO 3166-1 alpha-2 codes a GeoIP header actually sends
 * — that source file's `eu` row is a synthetic UI prefix, never a value
 * either header will contain, so Eurozone member codes are mapped to it
 * individually below.
 */

import type { DateFormat, TimeFormat } from './defaults';

export interface GeoLocaleBundle {
  countryCode: string;
  language: string;
  timezone: string;
  dateFormat: DateFormat;
  timeFormat: TimeFormat;
  currency: string;
}

const EUROZONE_BUNDLE: GeoLocaleBundle = {
  countryCode: 'EU',
  language: 'de',
  timezone: 'Europe/Berlin',
  dateFormat: 'DMY',
  timeFormat: '24h',
  currency: 'EUR',
};

/** ISO alpha-2 codes of current Eurozone member states — all resolve to EUROZONE_BUNDLE. */
const EUROZONE_COUNTRY_CODES = [
  'DE',
  'FR',
  'IT',
  'ES',
  'NL',
  'BE',
  'AT',
  'PT',
  'IE',
  'FI',
  'GR',
  'LU',
  'SK',
  'SI',
  'EE',
  'LV',
  'LT',
  'CY',
  'MT',
  'HR',
];

const GEO_COUNTRY_TO_LOCALE: Record<string, GeoLocaleBundle> = {
  GB: {
    countryCode: 'GB',
    language: 'en-GB',
    timezone: 'Europe/London',
    dateFormat: 'DMY',
    timeFormat: '24h',
    currency: 'GBP',
  },
  IN: {
    countryCode: 'IN',
    language: 'hi',
    timezone: 'Asia/Kolkata',
    dateFormat: 'DMY',
    timeFormat: '12h',
    currency: 'INR',
  },
  NG: {
    countryCode: 'NG',
    language: 'en-US',
    timezone: 'Africa/Lagos',
    dateFormat: 'DMY',
    timeFormat: '24h',
    currency: 'NGN',
  },
  PK: {
    countryCode: 'PK',
    language: 'ur',
    timezone: 'Asia/Karachi',
    dateFormat: 'DMY',
    timeFormat: '12h',
    currency: 'PKR',
  },
  VN: {
    countryCode: 'VN',
    language: 'vi',
    timezone: 'Asia/Ho_Chi_Minh',
    dateFormat: 'DMY',
    timeFormat: '24h',
    currency: 'VND',
  },
  ID: {
    countryCode: 'ID',
    language: 'id',
    timezone: 'Asia/Jakarta',
    dateFormat: 'DMY',
    timeFormat: '24h',
    currency: 'IDR',
  },
  TH: {
    countryCode: 'TH',
    language: 'th',
    timezone: 'Asia/Bangkok',
    dateFormat: 'DMY',
    timeFormat: '24h',
    currency: 'THB',
  },
  ZA: {
    countryCode: 'ZA',
    language: 'en-US',
    timezone: 'Africa/Johannesburg',
    dateFormat: 'DMY',
    timeFormat: '24h',
    currency: 'ZAR',
  },
  TR: {
    countryCode: 'TR',
    language: 'tr',
    timezone: 'Europe/Istanbul',
    dateFormat: 'DMY',
    timeFormat: '24h',
    currency: 'TRY',
  },
  US: {
    countryCode: 'US',
    language: 'en-US',
    timezone: 'America/New_York',
    dateFormat: 'MDY',
    timeFormat: '12h',
    currency: 'USD',
  },
  JP: {
    countryCode: 'JP',
    language: 'ja',
    timezone: 'Asia/Tokyo',
    dateFormat: 'YMD',
    timeFormat: '24h',
    currency: 'JPY',
  },
};

for (const code of EUROZONE_COUNTRY_CODES) {
  GEO_COUNTRY_TO_LOCALE[code] = EUROZONE_BUNDLE;
}

/**
 * Resolve a raw ISO 3166-1 alpha-2 country code (as sent by `cf-ipcountry`/
 * `x-vercel-ip-country`) to a locale bundle. Returns null for an unknown or
 * unsupported country (e.g. `XX`, the value Cloudflare sends for
 * non-geolocatable requests) — callers fall back to the app default.
 */
export function resolveLocaleFromCountryHeader(
  rawCountryCode?: string | null
): GeoLocaleBundle | null {
  if (!rawCountryCode) return null;
  return GEO_COUNTRY_TO_LOCALE[rawCountryCode.toUpperCase()] ?? null;
}

/**
 * Extracts the GeoIP country header value from a request, checking
 * Cloudflare's `cf-ipcountry` first, then Vercel's `x-vercel-ip-country`
 * (matches the precedence the hand-off spec's §6.B names explicitly).
 */
export function extractGeoCountryHeader(request: {
  headers: { get(name: string): string | null };
}): string | null {
  return (
    request.headers.get('cf-ipcountry') ||
    request.headers.get('x-vercel-ip-country') ||
    null
  );
}
