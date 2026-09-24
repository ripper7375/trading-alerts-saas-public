import { cookies, headers } from 'next/headers';
import {
  COUNTRY_HEADER,
  CURRENCY_COOKIE,
  IP_TIMEZONE_HEADERS,
  LOCALE_COOKIE,
  TIMEZONE_COOKIE,
  isValidTimezone,
  resolvePreferences,
  type LocalePreferences,
} from './locale-resolver';

type CookieReader = { get(name: string): { value: string } | undefined };
type HeaderReader = { get(name: string): string | null };

function decodeCookie(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** The visitor's IANA timezone as detected from their IP by the edge. */
export function detectedTimezoneFromHeaders(
  headerStore: HeaderReader
): string | null {
  for (const name of IP_TIMEZONE_HEADERS) {
    const value = headerStore.get(name);
    if (isValidTimezone(value)) return value;
  }
  return null;
}

/**
 * Full preference resolution for one request. `app/layout.tsx` (SSR) and
 * `getServerLocalePreferences()` (Server Components) both call this, so the
 * two can never disagree.
 */
export function resolveRequestPreferences(
  cookieStore: CookieReader,
  headerStore: HeaderReader
): LocalePreferences {
  return resolvePreferences({
    countryPrefix: headerStore.get(COUNTRY_HEADER),
    cookieLanguage: cookieStore.get(LOCALE_COOKIE)?.value,
    cookieCurrency: cookieStore.get(CURRENCY_COOKIE)?.value,
    cookieTimezone: decodeCookie(cookieStore.get(TIMEZONE_COOKIE)?.value),
    detectedTimezone: detectedTimezoneFromHeaders(headerStore),
  });
}

/**
 * Resolves the request's language for use in `generateMetadata()` (or any
 * other Server Component that runs ahead of the client `LocaleProvider`).
 *
 * Mirrors `app/layout.tsx`'s own resolution exactly (country-prefix header
 * set by `middleware.ts`, falling back to the persisted cookie, falling back
 * to the app default) so a page's `<title>`/`<meta description>` always
 * agrees with the language its body actually renders in.
 */
export async function getServerLanguage(): Promise<string> {
  return (await getServerLocalePreferences()).language;
}

/**
 * Full-preference variant of `getServerLanguage()` -- for Server Components
 * that need `countryCode`/`currency` too (e.g. to format a confirmed-USD
 * figure via `formatCurrencyAmount()`, since the client-only `formatCurrency()`
 * from `useLocale()` isn't reachable here). Same resolution, just returning
 * the whole object instead of only `.language`.
 */
export async function getServerLocalePreferences(): Promise<LocalePreferences> {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  return resolveRequestPreferences(cookieStore, headerStore);
}
