/**
 * The server's `t()` (T3-b): the lookup rule is one function shared with the
 * client, the translator follows the request's language, and the date helpers
 * follow the visitor's timezone and format.
 *
 * @module __tests__/lib/i18n/server-translator.test
 */

import { render, screen } from '@testing-library/react';

import { LocaleProvider, useLocale } from '@/lib/context/locale-context';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import {
  getServerLocaleTools,
  getServerTranslator,
} from '@/lib/i18n/server-translator';
import {
  createTranslator,
  translate,
  type TranslationDictionary,
} from '@/lib/i18n/translate';
import {
  defaultPreferences,
  LOCALE_STORAGE_KEY,
  type LocalePreferences,
} from '@/lib/i18n/locale-resolver';
import { preloadDictionaries } from '@/lib/i18n/client-dictionaries';

let mockPreferences: LocalePreferences;
jest.mock('@/lib/i18n/server-locale', () => ({
  getServerLocalePreferences: jest.fn(() => Promise.resolve(mockPreferences)),
}));
jest.mock('next/navigation', () => ({
  usePathname: () => '/about',
}));
jest.mock('@/app/actions/locale', () => ({
  syncLocaleCookiesAction: jest.fn(() => Promise.resolve({ success: true })),
}));

const preferencesFor = (
  language: string,
  extra: Partial<LocalePreferences> = {}
): LocalePreferences => ({
  ...defaultPreferences,
  language,
  timezone: 'Europe/London',
  timezoneSetByUser: true,
  ...extra,
});

describe('translate', () => {
  const dictionary: TranslationDictionary = {
    'nav.home': 'Home',
    'Sign In': 'Sign in',
    sign_in_: 'Normalised',
    a_b: 'Underscored',
  };

  it('finds a key as given', () => {
    expect(translate(dictionary, 'nav.home')).toBe('Home');
  });

  it('finds a key once trimmed', () => {
    expect(translate(dictionary, '  Sign In  ')).toBe('Sign in');
  });

  it('finds a key once normalised to lower-case words joined by underscores', () => {
    expect(translate(dictionary, 'A B')).toBe('Underscored');
  });

  it('answers a miss with the fallback, else with the text itself', () => {
    expect(translate(dictionary, 'No such key', 'Fallback')).toBe('Fallback');
    expect(translate(dictionary, 'No such key')).toBe('No such key');
  });

  it('answers an empty key with nothing', () => {
    expect(translate(dictionary, '', 'Fallback')).toBe('');
  });

  it('does not use an empty translation: it is a miss', () => {
    expect(translate({ key: '' }, 'key', 'Fallback')).toBe('Fallback');
  });

  it('createTranslator is translate over one dictionary', () => {
    const t = createTranslator(dictionary);
    expect(t('nav.home')).toBe('Home');
    expect(t('x', 'y')).toBe('y');
  });
});

describe('the server and the client answer alike', () => {
  const KEYS = [
    'Help Centre',
    'Features',
    'Pricing',
    'Sign In',
    '  Sign In ',
    'Dashboard',
    'a key that is in no dictionary',
    'nav.not_a_real_key',
    '',
  ];

  beforeAll(() => preloadDictionaries(['de', 'th']));

  it.each(['en-GB', 'en-US', 'de', 'th'])(
    'for every key, in %s',
    (language) => {
      const preferences = preferencesFor(language);
      localStorage.setItem(LOCALE_STORAGE_KEY, JSON.stringify(preferences));
      const clientAnswers: string[] = [];
      function Probe(): React.ReactElement {
        const { t } = useLocale();
        clientAnswers.splice(
          0,
          clientAnswers.length,
          ...KEYS.map((key) => t(key, 'fallback')),
          t('another miss')
        );
        return <i data-testid="done" />;
      }
      render(
        <LocaleProvider
          initialPreferences={preferences}
          detectedTimezone="Europe/London"
        >
          <Probe />
        </LocaleProvider>
      );
      expect(screen.getByTestId('done')).toBeInTheDocument();

      const serverT = createTranslator(getDictionary(language));
      const serverAnswers = [
        ...KEYS.map((key) => serverT(key, 'fallback')),
        serverT('another miss'),
      ];
      expect(clientAnswers).toEqual(serverAnswers);
    }
  );
});

describe('getServerLocaleTools', () => {
  it('translates into the request language', async () => {
    mockPreferences = preferencesFor('de');
    const t = await getServerTranslator();
    expect(t('Help Centre')).toBe('Hilfezentrum');
  });

  it('is UK English by default and US English for en-US', async () => {
    mockPreferences = preferencesFor('en-GB');
    expect((await getServerTranslator())('Help Centre')).toBe('Help Centre');
    mockPreferences = preferencesFor('en-US');
    expect((await getServerTranslator())('Help Centre')).toBe('Help Center');
  });

  it('is English for a language it has no dictionary for', async () => {
    mockPreferences = preferencesFor('xx');
    expect((await getServerTranslator())('Help Centre')).toBe('Help Centre');
  });

  it('reports the language and the preferences it resolved', async () => {
    mockPreferences = preferencesFor('th');
    const tools = await getServerLocaleTools();
    expect(tools.language).toBe('th');
    expect(tools.preferences).toBe(mockPreferences);
  });

  it("formats dates in the visitor's timezone and date format", async () => {
    // 22:30 UTC on 25 Dec is 5:30 AM on 26 Dec in Bangkok.
    const instant = Date.UTC(2024, 11, 25, 22, 30);
    mockPreferences = preferencesFor('en-US', {
      timezone: 'Asia/Bangkok',
      dateFormat: 'MDY',
      timeFormat: '12h',
    });
    const tools = await getServerLocaleTools();
    expect(tools.formatDate(instant)).toBe('12/26/2024');
    expect(tools.formatDateTime(instant)).toBe('12/26/2024 5:30 AM');
  });

  it('formats as the browser does for the same preferences', async () => {
    const preferences = preferencesFor('en-GB', {
      timezone: 'Asia/Tokyo',
      dateFormat: 'DMY',
      timeFormat: '24h',
    });
    mockPreferences = preferences;
    localStorage.setItem(LOCALE_STORAGE_KEY, JSON.stringify(preferences));
    let clientDate = '';
    function Probe(): React.ReactElement {
      clientDate = useLocale().formatDate('2026-08-14T12:00:00Z');
      return <i />;
    }
    render(
      <LocaleProvider
        initialPreferences={preferences}
        detectedTimezone="Asia/Tokyo"
      >
        <Probe />
      </LocaleProvider>
    );
    const tools = await getServerLocaleTools();
    expect(tools.formatDate('2026-08-14T12:00:00Z')).toBe(clientDate);
    expect(clientDate).toBe('14/08/2026');
  });
});
