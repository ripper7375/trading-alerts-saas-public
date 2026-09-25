/**
 * LocaleProvider: how stored preferences, the detected timezone and a
 * language change combine.
 *
 * @module __tests__/lib/context/locale-context.test
 */

import { act, render, screen, waitFor } from '@testing-library/react';

import { LocaleProvider, useLocale } from '@/lib/context/locale-context';
import { LOCALE_STORAGE_KEY } from '@/lib/i18n/locale-resolver';

jest.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
}));

const mockSync = jest.fn((_prefs: unknown) =>
  Promise.resolve({ success: true })
);
jest.mock('@/app/actions/locale', () => ({
  syncLocaleCookiesAction: (prefs: unknown) => mockSync(prefs),
}));

let setPrefs: ReturnType<typeof useLocale>['setLocalePreferences'] = () => {};
let setCountry: (code: string) => void = () => {};

function Probe(): React.ReactElement {
  const locale = useLocale();
  setPrefs = locale.setLocalePreferences;
  setCountry = locale.setCountryCode;
  return (
    <p data-testid="probe">
      {[
        locale.language,
        locale.currency,
        locale.timezone,
        locale.timezoneSetByUser ? 'user' : 'auto',
        locale.formatCurrency(29),
      ].join('|')}
      <span data-testid="when">
        {locale.formatDateTime(Date.UTC(2024, 11, 25, 22, 30))}
      </span>
    </p>
  );
}

function renderWith(stored: object, detectedTimezone = 'Europe/London'): void {
  localStorage.setItem(LOCALE_STORAGE_KEY, JSON.stringify(stored));
  render(
    <LocaleProvider detectedTimezone={detectedTimezone}>
      <Probe />
    </LocaleProvider>
  );
}

const probe = (): HTMLElement => screen.getByTestId('probe');

describe('LocaleProvider', () => {
  beforeEach(() => localStorage.clear());

  it('replaces a country-default timezone with the detected one', async () => {
    renderWith({
      countryCode: 'TH',
      language: 'th',
      timezone: 'Asia/Bangkok',
      dateFormat: 'DMY',
      timeFormat: '24h',
      currency: 'THB',
    });
    await waitFor(() =>
      expect(probe()).toHaveTextContent('th|THB|Europe/London|auto')
    );
  });

  it('replaces an unknown stored language with the country language', async () => {
    renderWith({
      countryCode: 'TH',
      language: "x'+alert(1)+'",
      timezone: 'Europe/London',
      dateFormat: 'DMY',
      timeFormat: '24h',
      currency: 'THB',
    });
    await waitFor(() => expect(probe()).toHaveTextContent('th|THB'));
    expect(document.documentElement.lang).toBe('th');
    expect(document.documentElement.dir).toBe('ltr');
  });

  it('sets a right-to-left document for Arabic', async () => {
    renderWith({
      countryCode: 'AE',
      language: 'ar',
      timezone: 'Europe/London',
      dateFormat: 'DMY',
      timeFormat: '12h',
      currency: 'AED',
    });
    await waitFor(() => expect(document.documentElement.dir).toBe('rtl'));
  });

  it('keeps a timezone the user picked before the flag existed', async () => {
    renderWith({
      countryCode: 'GB',
      language: 'en-GB',
      timezone: 'Asia/Tokyo',
      dateFormat: 'DMY',
      timeFormat: '24h',
      currency: 'GBP',
    });
    await waitFor(() =>
      expect(probe()).toHaveTextContent('en-GB|GBP|Asia/Tokyo|user')
    );
  });

  it("keeps the user's own timezone when the header country changes", async () => {
    renderWith({
      countryCode: 'GB',
      language: 'en-GB',
      timezone: 'Asia/Tokyo',
      dateFormat: 'DMY',
      timeFormat: '24h',
      currency: 'GBP',
      timezoneSetByUser: true,
    });
    await waitFor(() => expect(probe()).toHaveTextContent('Asia/Tokyo|user'));

    act(() => setCountry('TH'));
    expect(probe()).toHaveTextContent('th|THB|Asia/Tokyo|user');
  });

  it("formats dates and times in the user's timezone and formats", async () => {
    renderWith({
      countryCode: 'US',
      language: 'en-US',
      timezone: 'Asia/Bangkok',
      dateFormat: 'MDY',
      timeFormat: '12h',
      currency: 'USD',
      timezoneSetByUser: true,
    });
    // 22:30 UTC on 25 Dec is 5:30 AM on 26 Dec in Bangkok.
    await waitFor(() =>
      expect(screen.getByTestId('when')).toHaveTextContent('12/26/2024 5:30 AM')
    );
  });

  it('falls back to the language currency for a withdrawn one (CNY)', async () => {
    renderWith({
      countryCode: 'TH',
      language: 'th',
      timezone: 'Asia/Bangkok',
      dateFormat: 'DMY',
      timeFormat: '24h',
      currency: 'CNY',
    });
    await waitFor(() => expect(probe()).toHaveTextContent('th|THB|'));
    expect(probe()).toHaveTextContent('฿1,015');
  });

  it('a language change brings its currency but keeps the timezone', async () => {
    renderWith({
      countryCode: 'GB',
      language: 'en-GB',
      timezone: 'Europe/London',
      dateFormat: 'DMY',
      timeFormat: '24h',
      currency: 'GBP',
    });
    await waitFor(() => expect(probe()).toHaveTextContent('en-GB|GBP'));

    // What the landing page's language picker sends.
    act(() => setPrefs({ language: 'th' }));
    expect(probe()).toHaveTextContent('th|THB|Europe/London|auto|฿1,015');
  });
});

// Server Components render from the locale cookies; without a server-side
// cookie write they kept the old language until a reload.
describe('LocaleProvider: server-rendered parts follow a change', () => {
  const gb = {
    countryCode: 'GB',
    language: 'en-GB',
    timezone: 'Europe/London',
    dateFormat: 'DMY' as const,
    timeFormat: '24h' as const,
    currency: 'GBP',
  };

  function renderServer(detectedTimezone = 'Europe/London'): void {
    localStorage.clear();
    // An explicit choice, as the server saw it: no geo-IP lookup (L40).
    document.cookie = 'davintrade-locale=en-GB; path=/';
    render(
      <LocaleProvider
        initialPreferences={{ ...gb, timezoneSetByUser: false }}
        detectedTimezone={detectedTimezone}
      >
        <Probe />
      </LocaleProvider>
    );
  }

  beforeEach(() => mockSync.mockClear());

  it('does not call the server when nothing changed', async () => {
    renderServer();
    await waitFor(() => expect(probe()).toHaveTextContent('en-GB|GBP'));
    expect(mockSync).not.toHaveBeenCalled();
  });

  it('syncs the cookies once when the language changes', async () => {
    renderServer();
    act(() => setPrefs({ language: 'th' }));
    await waitFor(() => expect(mockSync).toHaveBeenCalledTimes(1));
    expect(mockSync).toHaveBeenCalledWith(
      expect.objectContaining({ language: 'th', currency: 'THB' })
    );
  });

  it('syncs when only the currency or a format changes', async () => {
    renderServer();
    act(() => setPrefs({ currency: 'USD' }));
    await waitFor(() => expect(mockSync).toHaveBeenCalledTimes(1));
    act(() => setPrefs({ timeFormat: '12h' }));
    await waitFor(() => expect(mockSync).toHaveBeenCalledTimes(2));
  });

  it('does not sync for a detected timezone: the server detects it itself', async () => {
    renderServer('Asia/Tokyo');
    await waitFor(() => expect(probe()).toHaveTextContent('Asia/Tokyo|auto'));
    expect(mockSync).not.toHaveBeenCalled();
  });

  it('syncs a timezone the user picks', async () => {
    renderServer();
    act(() => setPrefs({ timezone: 'Asia/Tokyo', timezoneSetByUser: true }));
    await waitFor(() =>
      expect(mockSync).toHaveBeenCalledWith(
        expect.objectContaining({
          timezone: 'Asia/Tokyo',
          timezoneSetByUser: true,
        })
      )
    );
  });
});
