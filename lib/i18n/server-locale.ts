import { cookies, headers } from 'next/headers';
import {
  COUNTRY_HEADER,
  LOCALE_COOKIE,
  resolvePreferences,
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
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  return resolvePreferences({
    countryPrefix: headerStore.get(COUNTRY_HEADER),
    cookieLanguage: cookieStore.get(LOCALE_COOKIE)?.value,
  }).language;
}
