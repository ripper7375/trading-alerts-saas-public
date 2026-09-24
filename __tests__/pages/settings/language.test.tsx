/**
 * Language & Region Settings Page — display currency.
 *
 * Choosing a language suggests its country's currency (Thai gives THB), the
 * user can still pick another one before saving, and every currency offered
 * has a conversion rate of its own.
 *
 * @module __tests__/pages/settings/language.test
 */

import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';

import LanguageSettingsPage from '@/app/settings/language/page';
import { CURRENCY_USD_RATES } from '@/lib/country-config';
import { LocaleProvider } from '@/lib/context/locale-context';
import { LOCALE_STORAGE_KEY } from '@/lib/i18n/locale-resolver';

jest.mock('next/navigation', () => ({
  usePathname: () => '/settings/language',
}));

const UK_PREFERENCES = {
  countryCode: 'GB',
  language: 'en-GB',
  timezone: 'Europe/London',
  dateFormat: 'DMY',
  timeFormat: '24h',
  currency: 'GBP',
};

const fetchMock = jest.fn();

function renderPage(): void {
  render(
    <LocaleProvider>
      <LanguageSettingsPage />
    </LocaleProvider>
  );
}

function pick(comboboxName: string, option: RegExp): void {
  fireEvent.keyDown(screen.getByRole('combobox', { name: comboboxName }), {
    key: 'Enter',
  });
  fireEvent.click(screen.getByRole('option', { name: option }));
}

function currencyTrigger(): HTMLElement {
  return screen.getByRole('combobox', { name: 'Display Currency' });
}

describe('LanguageSettingsPage display currency', () => {
  beforeAll(() => {
    // Radix Select calls these, which jsdom does not implement.
    Element.prototype.hasPointerCapture ??= () => false;
    Element.prototype.releasePointerCapture ??= () => {};
    Element.prototype.scrollIntoView ??= () => {};
  });

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockImplementation((_url: string, init?: RequestInit) =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve(
            init?.method === 'PUT' ? {} : { preferences: UK_PREFERENCES }
          ),
      })
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    // Seeding skips LocaleProvider's real geo-IP fetch() (L40).
    localStorage.setItem(LOCALE_STORAGE_KEY, JSON.stringify(UK_PREFERENCES));
  });

  async function renderLoaded(): Promise<void> {
    renderPage();
    await waitFor(() => expect(currencyTrigger()).toHaveTextContent('GBP'));
  }

  it('switches the currency to THB when Thai is chosen', async () => {
    await renderLoaded();
    pick('Display Language', /Thai/);
    expect(currencyTrigger()).toHaveTextContent('THB');
  });

  it('keeps the current currency for a language several countries share', async () => {
    await renderLoaded();
    // en-US is used by the US, Nigeria and South Africa.
    pick('Display Language', /English \(US\)/);
    expect(currencyTrigger()).toHaveTextContent('GBP');
  });

  it('saves Thai with GBP when the user overrides the suggestion', async () => {
    await renderLoaded();
    pick('Display Language', /Thai/);
    pick('Display Currency', /^GBP/);
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/ }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/user/preferences',
        expect.objectContaining({ method: 'PUT' })
      )
    );
    const put = fetchMock.mock.calls.find(
      ([, init]) => (init as RequestInit | undefined)?.method === 'PUT'
    );
    const body = JSON.parse((put![1] as RequestInit).body as string);
    expect(body).toMatchObject({ language: 'th', currency: 'GBP' });
  });

  it('offers only currencies that have a conversion rate, THB included', async () => {
    await renderLoaded();
    fireEvent.keyDown(currencyTrigger(), { key: 'Enter' });
    const listbox = screen.getByRole('listbox');
    const codes = within(listbox)
      .getAllByRole('option')
      .map((o) => (o.textContent ?? '').trim().split(' ')[0]!);

    expect(codes).toContain('THB');
    for (const code of codes) {
      expect(CURRENCY_USD_RATES[code]).toBeGreaterThan(0);
    }
  });
});
