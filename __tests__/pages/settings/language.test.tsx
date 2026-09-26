/**
 * Language & Region Settings Page.
 *
 * The page edits the live locale, so the header's country switcher and this
 * page always agree. The header's country sets the language; the language
 * sets date format, time format and currency, each of which the user can
 * still change; the timezone is IP-detected and never follows the language.
 *
 * @module __tests__/pages/settings/language.test
 */

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';

import LanguageSettingsPage from '@/app/settings/language/page';
import { CURRENCY_USD_RATES } from '@/lib/country-config';
import { LocaleProvider, useLocale } from '@/lib/context/locale-context';
import { LOCALE_STORAGE_KEY } from '@/lib/i18n/locale-resolver';

jest.mock('next/navigation', () => ({
  usePathname: () => '/settings/language',
}));

// Stored the way the header switcher wrote it before timezones were
// detected: the UK's own default zone, so it counts as automatic.
const UK_PREFERENCES = {
  countryCode: 'GB',
  language: 'en-GB',
  timezone: 'Europe/London',
  dateFormat: 'DMY',
  timeFormat: '24h',
  currency: 'GBP',
};

const fetchMock = jest.fn();
let switchCountry: (code: string) => void = () => {};

/** Stands in for the header's "Select Country & Region" menu. */
function HeaderCountrySwitcher(): null {
  switchCountry = useLocale().setCountryCode;
  return null;
}

function renderPage(detectedTimezone = 'Europe/London'): void {
  render(
    <LocaleProvider detectedTimezone={detectedTimezone}>
      <HeaderCountrySwitcher />
      <LanguageSettingsPage />
    </LocaleProvider>
  );
}

function combobox(name: string): HTMLElement {
  return screen.getByRole('combobox', { name });
}

function pick(comboboxName: string, option: RegExp): void {
  fireEvent.keyDown(combobox(comboboxName), { key: 'Enter' });
  fireEvent.click(screen.getByRole('option', { name: option }));
}

function checked(name: 'dateFormat' | 'timeFormat'): string | undefined {
  return (
    document.querySelector(
      `input[name="${name}"]:checked`
    ) as HTMLInputElement | null
  )?.value;
}

async function renderLoaded(detectedTimezone?: string): Promise<void> {
  renderPage(detectedTimezone);
  await waitFor(() =>
    expect(combobox('Display Language')).toHaveTextContent('English (UK)')
  );
}

describe('LanguageSettingsPage', () => {
  beforeAll(() => {
    // Radix Select calls these, which jsdom does not implement.
    Element.prototype.hasPointerCapture ??= () => false;
    Element.prototype.releasePointerCapture ??= () => {};
    Element.prototype.scrollIntoView ??= () => {};
  });

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    global.fetch = fetchMock as unknown as typeof fetch;
    // Seeding skips LocaleProvider's real geo-IP fetch() (L40).
    localStorage.setItem(LOCALE_STORAGE_KEY, JSON.stringify(UK_PREFERENCES));
  });

  it('shows the live settings, with GB as the default region', async () => {
    await renderLoaded();
    expect(combobox('Display Currency')).toHaveTextContent('GBP');
    expect(combobox('Your Timezone')).toHaveTextContent('Europe/London');
    expect(checked('dateFormat')).toBe('DMY');
    expect(checked('timeFormat')).toBe('24h');
    // Nothing is loaded from the database any more.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('follows the header: Thailand sets Thai and THB, not the timezone', async () => {
    await renderLoaded();
    act(() => switchCountry('TH'));

    // The page itself is now in Thai, so find the fields by id.
    const byId = (id: string): HTMLElement => document.getElementById(id)!;
    await waitFor(() => expect(byId('language')).toHaveTextContent('Thai'));
    expect(byId('currency')).toHaveTextContent('THB');
    expect(byId('timezone')).toHaveTextContent('Europe/London');
  });

  it('sets date format, time format and currency from the language', async () => {
    await renderLoaded();
    pick('Display Language', /English \(US\)/);

    expect(checked('dateFormat')).toBe('MDY');
    expect(checked('timeFormat')).toBe('12h');
    expect(combobox('Display Currency')).toHaveTextContent('USD');
    expect(combobox('Your Timezone')).toHaveTextContent('Europe/London');
  });

  it('keeps the formats but suggests USD for a language with no country', async () => {
    await renderLoaded();
    pick('Display Language', /Chinese \(Simplified\)/);

    expect(checked('dateFormat')).toBe('DMY');
    expect(combobox('Display Currency')).toHaveTextContent('USD');
  });

  it('lets the user override each value after choosing a language', async () => {
    await renderLoaded();
    pick('Display Language', /Thai/);
    expect(combobox('Display Currency')).toHaveTextContent('THB');

    pick('Display Currency', /^GBP/);
    fireEvent.click(screen.getByRole('radio', { name: /12-hour/ }));

    expect(combobox('Display Currency')).toHaveTextContent('GBP');
    expect(checked('timeFormat')).toBe('12h');
  });

  it('shows the detected timezone and switches back to it after an override', async () => {
    await renderLoaded('Asia/Bangkok');
    await waitFor(() =>
      expect(combobox('Your Timezone')).toHaveTextContent('Asia/Bangkok')
    );
    expect(screen.getByText(/Detected from your location/)).toHaveTextContent(
      'Asia/Bangkok'
    );
    expect(
      screen.queryByRole('button', { name: 'Use detected timezone' })
    ).not.toBeInTheDocument();

    pick('Your Timezone', /Asia\/Tokyo/);
    expect(combobox('Your Timezone')).toHaveTextContent('Asia/Tokyo');

    fireEvent.click(
      screen.getByRole('button', { name: 'Use detected timezone' })
    );
    expect(combobox('Your Timezone')).toHaveTextContent('Asia/Bangkok');
  });

  it('saves Thai with GBP to the database and applies it live', async () => {
    await renderLoaded();
    pick('Display Language', /Thai/);
    pick('Display Currency', /^GBP/);
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/ }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/user/preferences');
    expect(init.method).toBe('PUT');
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({ language: 'th', currency: 'GBP' });
    // The client-only flag is not sent to the API.
    expect(body).not.toHaveProperty('timezoneSetByUser');

    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem(LOCALE_STORAGE_KEY)!);
      expect(stored).toMatchObject({ language: 'th', currency: 'GBP' });
    });
    expect(document.cookie).toContain('davintrade-currency=GBP');
  });

  it('offers only currencies that have a conversion rate, THB included', async () => {
    await renderLoaded();
    fireEvent.keyDown(combobox('Display Currency'), { key: 'Enter' });
    const codes = within(screen.getByRole('listbox'))
      .getAllByRole('option')
      .map((o) => (o.textContent ?? '').trim().split(' ')[0]!);

    expect(codes).toContain('THB');
    expect(codes).not.toEqual(expect.arrayContaining(['CNY']));
    for (const code of codes) {
      expect(CURRENCY_USD_RATES[code]).toBeGreaterThan(0);
    }
  });
});
