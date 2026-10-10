/**
 * Rendering Report 2 components the way the app does: inside a `LocaleProvider`, in a
 * chosen language.
 *
 * `LocaleProvider` starts from the server's resolution, then reconciles with
 * `localStorage` after hydration, and loads a non-bundled dictionary with an
 * asynchronous `import()`. A test therefore seeds the storage (which also keeps the
 * provider's geo-IP `fetch` from leaking past teardown, `LESSONS-LEARNED.md` L40),
 * renders, and waits for the language to arrive (`waitForLanguage`).
 */

import { render as rtlRender, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';

import { LocaleProvider } from '@/lib/context/locale-context';
import { LOCALE_STORAGE_KEY } from '@/lib/i18n/locale-resolver';

jest.mock('next/navigation', () => ({
  usePathname: () => '/dev/report2',
}));

/** What a stored preference looks like for a language, with the country's own formats. */
const PREFERENCES: Record<string, object> = {
  'en-US': {
    countryCode: 'US',
    language: 'en-US',
    timezone: 'UTC',
    dateFormat: 'MDY',
    timeFormat: '24h',
    currency: 'USD',
  },
  ar: {
    countryCode: 'AE',
    language: 'ar',
    timezone: 'UTC',
    dateFormat: 'DMY',
    timeFormat: '24h',
    currency: 'AED',
  },
  ur: {
    countryCode: 'PK',
    language: 'ur',
    timezone: 'UTC',
    dateFormat: 'DMY',
    timeFormat: '24h',
    currency: 'PKR',
  },
  de: {
    countryCode: 'DE',
    language: 'de',
    timezone: 'UTC',
    dateFormat: 'DMY',
    timeFormat: '24h',
    currency: 'EUR',
  },
};

export function seedLanguage(language: string): void {
  const preferences = PREFERENCES[language] ?? {
    ...PREFERENCES['en-US'],
    language,
  };
  localStorage.setItem(LOCALE_STORAGE_KEY, JSON.stringify(preferences));
}

export function renderIn(ui: ReactElement, language = 'en-US') {
  seedLanguage(language);
  return rtlRender(ui, { wrapper: LocaleProvider });
}

/** Wait until the document says it is in `language` (the provider has reconciled and loaded the dictionary). */
export async function waitForLanguage(language: string): Promise<void> {
  await waitFor(() => {
    expect(document.documentElement.lang).toBe(language);
  });
}

/** Text without the invisible direction marks the app puts around figures in right-to-left sentences. */
export function plain(text: string | null | undefined): string {
  return (text ?? '').replace(/[⁦-⁩‎‏]/g, '');
}
