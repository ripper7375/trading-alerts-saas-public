import { cookies, headers } from 'next/headers';
import {
  COUNTRY_HEADER,
  LOCALE_COOKIE,
  resolvePreferences,
  type LocalePreferences,
} from './locale-resolver';

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
  return resolvePreferences({
    countryPrefix: headerStore.get(COUNTRY_HEADER),
    cookieLanguage: cookieStore.get(LOCALE_COOKIE)?.value,
  });
}
