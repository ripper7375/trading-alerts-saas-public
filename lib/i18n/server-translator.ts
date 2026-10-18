import 'server-only';

import { cache } from 'react';

import { formatDateInZone, formatDateTimeInZone } from './format-datetime';
import { getDictionary } from './get-dictionary';
import type { LocalePreferences } from './locale-resolver';
import { getServerLocalePreferences } from './server-locale';
import { createTranslator, type Translate } from './translate';

/**
 * What a Server Component needs to write a page in the visitor's language,
 * the server-side counterpart of `useLocale()`:
 *
 * - `t(keyOrText, fallback?)` -- the same lookup as the client's `t` (both call
 *   `translate()` in `./translate`), over this request's dictionary.
 * - `formatDate` / `formatDateTime` -- the visitor's timezone, date format and
 *   time format, through `./format-datetime` as `useLocale()` does.
 * - `language` and `preferences` -- as resolved for this request.
 *
 * One resolution per request (`React.cache`, like `getServerLocalePreferences`
 * which it reads), so a page and the components it renders share it. Outside a
 * render it is a pass-through.
 *
 * A language change made in the browser reaches these pages through the locale
 * cookies (`syncLocaleCookiesAction`, which refreshes the route).
 */
export interface ServerLocaleTools {
  t: Translate;
  language: string;
  preferences: LocalePreferences;
  formatDate: (utc: number | string | Date) => string;
  formatDateTime: (utc: number | string | Date) => string;
}

export const getServerLocaleTools = cache(
  async (): Promise<ServerLocaleTools> => {
    const preferences = await getServerLocalePreferences();
    return {
      t: createTranslator(getDictionary(preferences.language)),
      language: preferences.language,
      preferences,
      formatDate: (utc) => formatDateInZone(utc, preferences),
      formatDateTime: (utc) => formatDateTimeInZone(utc, preferences),
    };
  }
);

/** Just `t`, for the many pages that need nothing else. */
export async function getServerTranslator(): Promise<Translate> {
  return (await getServerLocaleTools()).t;
}
