'use server';

import { cookies } from 'next/headers';

import { isSupportedCurrency } from '@/lib/country-config';
import { isSupportedLanguage } from '@/lib/i18n/languages';
import {
  isValidTimezone,
  localeCookies,
  type LocalePreferences,
} from '@/lib/i18n/locale-resolver';

const DATE_FORMATS = ['MDY', 'DMY', 'YMD'];
const TIME_FORMATS = ['12h', '24h'];

type LocaleCookieInput = Pick<
  LocalePreferences,
  | 'language'
  | 'currency'
  | 'dateFormat'
  | 'timeFormat'
  | 'timezone'
  | 'timezoneSetByUser'
>;

/**
 * Writes the locale cookies from the server after a language or format
 * change on the client.
 *
 * `LocaleProvider` already writes the same cookies in the browser, but that
 * only affects the NEXT server render: Server Components (the admin sidebar,
 * the BI dashboards, /academy, ...) keep the old language until a reload,
 * and layouts cached by the client router are reused on later navigations.
 * Setting cookies inside a Server Action makes Next.js re-render the current
 * route in the same round trip and drop the client's cached routes, so every
 * server-rendered part follows the change without a refresh.
 *
 * Every value is re-validated: a Server Action is callable with any input.
 */
export async function syncLocaleCookiesAction(
  prefs: LocaleCookieInput
): Promise<{ success: boolean }> {
  if (
    !prefs ||
    !isSupportedLanguage(prefs.language) ||
    !isSupportedCurrency(prefs.currency) ||
    !DATE_FORMATS.includes(prefs.dateFormat) ||
    !TIME_FORMATS.includes(prefs.timeFormat) ||
    (prefs.timezoneSetByUser && !isValidTimezone(prefs.timezone))
  ) {
    return { success: false };
  }

  try {
    const cookieStore = await cookies();
    for (const cookie of localeCookies({
      countryCode: '',
      ...prefs,
      currency: prefs.currency.toUpperCase(),
      timezoneSetByUser: !!prefs.timezoneSetByUser,
    })) {
      cookieStore.set(cookie.name, cookie.value, {
        path: '/',
        maxAge: cookie.maxAge,
        sameSite: 'lax',
        // The client reads the language cookie (inline script in app/layout.tsx).
        httpOnly: false,
      });
    }
    return { success: true };
  } catch {
    // Outside a request (tests) or a failed write: the browser-side cookies
    // still apply on the next load.
    return { success: false };
  }
}
