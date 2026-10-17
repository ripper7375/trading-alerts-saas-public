/**
 * LocaleProvider and the per-language dictionary chunks (T3-a), in the
 * browser: English and US English are there at once and any other language is
 * a chunk that loads while the previous dictionary stays on screen. The server
 * half is in locale-context-ssr.test.tsx, hydration in
 * locale-context-hydration.test.tsx.
 *
 * @module __tests__/lib/context/locale-context-dictionaries.test
 */

import { act } from 'react';
import { render, screen, waitFor } from '@testing-library/react';

import { LocaleProvider, useLocale } from '@/lib/context/locale-context';
import {
  LOCALE_STORAGE_KEY,
  defaultPreferences,
  type LocalePreferences,
} from '@/lib/i18n/locale-resolver';
import enGB from '@/lib/i18n/dictionaries/en-GB.json';
import enUS from '@/lib/i18n/dictionaries/en-US.json';
import de from '@/lib/i18n/dictionaries/de.json';
import th from '@/lib/i18n/dictionaries/th.json';

jest.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
}));
jest.mock('@/app/actions/locale', () => ({
  syncLocaleCookiesAction: jest.fn(() => Promise.resolve({ success: true })),
}));

const KEY = 'Help Centre';
const text = (dictionary: unknown): string =>
  (dictionary as Record<string, string>)[KEY] as string;

let setPrefs: ReturnType<typeof useLocale>['setLocalePreferences'] = () => {};

function Probe(): React.ReactElement {
  const locale = useLocale();
  setPrefs = locale.setLocalePreferences;
  return <p data-testid="probe">{locale.t(KEY)}</p>;
}

const preferencesFor = (language: string): LocalePreferences => ({
  ...defaultPreferences,
  language,
  timezone: 'Europe/London',
  timezoneSetByUser: true,
});

/** Storage seeded as the server saw it, so the provider makes no geo-IP call. */
function seed(preferences: LocalePreferences): void {
  localStorage.setItem(LOCALE_STORAGE_KEY, JSON.stringify(preferences));
}

function renderIn(language: string): void {
  const preferences = preferencesFor(language);
  seed(preferences);
  render(
    <LocaleProvider
      initialPreferences={preferences}
      detectedTimezone="Europe/London"
    >
      <Probe />
    </LocaleProvider>
  );
}

const probe = (): HTMLElement => screen.getByTestId('probe');

beforeEach(() => localStorage.clear());

describe('the dictionaries that need no waiting', () => {
  it('renders UK English on the first render', () => {
    renderIn('en-GB');
    expect(probe()).toHaveTextContent(text(enGB));
    expect(text(enGB)).toBe('Help Centre');
  });

  it('renders US English on the first render: the base plus the overlay', () => {
    renderIn('en-US');
    expect(probe()).toHaveTextContent(text(enUS));
    expect(probe()).toHaveTextContent('Help Center');
  });
});

describe('switching language at run time, without a reload', () => {
  it('keeps the current words until the new chunk arrives, then swaps them', async () => {
    renderIn('en-GB');
    expect(probe()).toHaveTextContent('Help Centre');

    act(() => setPrefs({ language: 'de' }));
    // The chunk is a separate request: nothing flips to a key or to a blank.
    expect(probe()).toHaveTextContent('Help Centre');

    await waitFor(() => expect(probe()).toHaveTextContent(text(de)));
    expect(text(de)).not.toBe('Help Centre');
  });

  it('applies US English at once, and a language already loaded at once', async () => {
    renderIn('en-GB');

    act(() => setPrefs({ language: 'en-US' }));
    expect(probe()).toHaveTextContent('Help Center');

    act(() => setPrefs({ language: 'th' }));
    await waitFor(() => expect(probe()).toHaveTextContent(text(th)));

    act(() => setPrefs({ language: 'de' }));
    await waitFor(() => expect(probe()).toHaveTextContent(text(de)));

    // Thai and German are both loaded now: going back is synchronous.
    act(() => setPrefs({ language: 'th' }));
    expect(probe()).toHaveTextContent(text(th));
    act(() => setPrefs({ language: 'en-GB' }));
    expect(probe()).toHaveTextContent('Help Centre');
  });

  it('lets the last choice win when the visitor switches faster than a chunk loads', async () => {
    renderIn('en-GB');

    act(() => setPrefs({ language: 'fr' }));
    act(() => setPrefs({ language: 'ja' }));
    act(() => setPrefs({ language: 'en-GB' }));

    // fr and ja settle later; neither may overwrite the English the visitor
    // went back to.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
    expect(probe()).toHaveTextContent('Help Centre');
  });

  it('shows a key it does not have as the text it was given', () => {
    renderIn('en-GB');
    function Missing(): React.ReactElement {
      const { t } = useLocale();
      return <i data-testid="missing">{t('a key with no row', 'Fallback')}</i>;
    }
    render(
      <LocaleProvider initialPreferences={preferencesFor('en-GB')}>
        <Missing />
      </LocaleProvider>
    );
    expect(screen.getByTestId('missing')).toHaveTextContent('Fallback');
  });
});
