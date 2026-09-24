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
