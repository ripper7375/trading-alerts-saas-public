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
> & {
  /**
   * The change was made by the user (header country, language modal,
   * Settings), not detected: also remember it on the signed-in account, so the
   * e-mail no request triggers is written in it.
   */
  saveToAccount?: boolean;
};

/**
 * Remembers the language and formats on the signed-in account (its saved
 * Settings -> Language & Region), the record e-mail is written from
 * (lib/email/recipient-locale.ts). Best effort: a visitor with no session, or
 * a failed write, changes nothing for the page that asked.
 */
async function saveLocaleToAccount(prefs: LocaleCookieInput): Promise<void> {
  try {
    const [{ getServerSession }, { authOptions }, { prisma }] =
      await Promise.all([
        import('next-auth'),
        import('@/lib/auth/auth-options'),
        import('@/lib/db/prisma'),
      ]);
    const userId = (await getServerSession(authOptions))?.user?.id;
    if (!userId) return;

    const row = await prisma.userPreferences.findUnique({
      where: { userId },
      select: { preferences: true },
    });
    const preferences = {
      ...((row?.preferences ?? {}) as Record<string, unknown>),
      language: prefs.language,
      currency: prefs.currency.toUpperCase(),
      dateFormat: prefs.dateFormat,
      timeFormat: prefs.timeFormat,
      // An IP-detected timezone is not a choice; only a pinned one is saved.
      ...(prefs.timezoneSetByUser ? { timezone: prefs.timezone } : {}),
    };
    await prisma.userPreferences.upsert({
      where: { userId },
      create: { userId, preferences },
      update: { preferences },
    });
  } catch (error) {
    console.error(
      '[locale] Could not save the language to the account:',
      error
    );
  }
}

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
    if (prefs.saveToAccount) await saveLocaleToAccount(prefs);
    return { success: true };
  } catch {
    // Outside a request (tests) or a failed write: the browser-side cookies
    // still apply on the next load.
    return { success: false };
  }
}
