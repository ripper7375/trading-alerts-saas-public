import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { WorldGoldMarket } from '@/components/market/world-gold-market';
import { MARKETS } from '@/lib/world-gold/catalog';
import { SUPPORTED_LANGUAGE_CODES } from '@/lib/i18n/languages';
import {
  formatLocalGoldAmount,
  formatLocalGoldPercent,
} from '@/lib/i18n/format-local-amount';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import messages from '@/lib/i18n/world-gold-messages.json';
import type { WorldGoldSnapshot } from '@/lib/world-gold/types';

let mockLanguage = 'en-GB';
let mockTimeFormat = '24h';
jest.mock('@/lib/context/locale-context', () => ({
  useLocale: () => ({
    language: mockLanguage,
    dateFormat: 'DMY',
    timeFormat: mockTimeFormat,
    t: (key: string) => getDictionary(mockLanguage)[key] ?? key,
  }),
}));

function fixture(): WorldGoldSnapshot {
  return {
    generatedAt: '2026-10-15T10:00:00Z',
    gold: { price: 4000, updatedAt: '2026-10-15T10:00:00Z', stale: false },
    fx: {
      provider: 'currencybeacon',
      updatedAt: '2026-10-15T09:30:00Z',
      stale: false,
    },
    historyAvailable: true,
    markets: MARKETS.map((market) => ({
      id: market.id,
      status: 'open',
      updatedAt: '2026-10-15T09:30:00Z',
      previousCloseAt: '2026-10-14T16:00:00Z',
      units: market.units.map((unit, index) => ({
        id: unit.id,
        price: 1234.5 + index,
        previousClose: 1200,
        change: 34.5 + index,
        changePercent: (34.5 + index) / 12,
      })),
    })),
  };
}
const mockFetch = jest.fn();
beforeEach(() => {
  mockLanguage = 'en-GB';
  mockTimeFormat = '24h';
  mockFetch.mockReset();
  global.fetch = mockFetch;
});

it.each(SUPPORTED_LANGUAGE_CODES)(
  'renders all ten markets and localized details in %s',
  async (language) => {
    mockLanguage = language;
    const dict = getDictionary(language);
    mockFetch.mockResolvedValue({ ok: true, json: async () => fixture() });
    render(<WorldGoldMarket />);
    expect(
      await screen.findByText(formatLocalGoldAmount(1234.5, 'GBP', language), {
        normalizer: (text) => text,
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: dict['worldGold.title'] })
    ).toBeInTheDocument();
    for (const market of MARKETS) {
      const name = dict[market.countryKey] as string;
      expect(name).toBeTruthy();
      expect(name).not.toBe(market.countryKey);
      const heading = screen.getByRole('heading', { name });
      const section = heading.closest('section') as HTMLElement;
      const toggle = within(section).getByRole('button');
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
      fireEvent.click(toggle);
      expect(toggle).toHaveAttribute('aria-expanded', 'true');
      expect(
        within(section).getByText(dict[market.hoursKey] as string)
      ).toBeInTheDocument();
      expect(
        within(section).getByText(dict[market.notesKey] as string)
      ).toBeInTheDocument();
      for (const unit of market.units) expect(dict[unit.labelKey]).toBeTruthy();
    }
    expect(document.body.textContent).not.toContain('worldGold.');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  }
);

it('keeps currency fixed to each market, with matching unit changes and no invented missing close', async () => {
  const data = fixture();
  const thai = data.markets.find((m) => m.id === 'th')!;
  thai.previousCloseAt = null;
  thai.units = thai.units.map((unit) => ({
    ...unit,
    previousClose: null,
    change: null,
    changePercent: null,
  }));
  mockFetch.mockResolvedValue({ ok: true, json: async () => data });
  render(<WorldGoldMarket />);
  await screen.findByText(formatLocalGoldAmount(1234.5, 'GBP', 'en-GB'), {
    normalizer: (text) => text,
  });
  const uk = screen
    .getByRole('heading', { name: 'United Kingdom' })
    .closest('section')!;
  expect(
    within(uk).getByText(formatLocalGoldAmount(35.5, 'GBP', 'en-GB', true), {
      normalizer: (text) => text,
    })
  ).toBeInTheDocument();
  expect(
    within(uk).getByText(formatLocalGoldPercent(35.5 / 12, 'en-GB'), {
      normalizer: (text) => text,
    })
  ).toBeInTheDocument();
  const thailand = screen
    .getByRole('heading', { name: 'Thailand' })
    .closest('section')!;
  expect(
    within(thailand).getByText('Previous close unavailable')
  ).toBeInTheDocument();
  expect(within(thailand).queryByText(/GBP/)).not.toBeInTheDocument();
});

it('shows a recoverable error then retries', async () => {
  mockFetch.mockResolvedValueOnce({ ok: false });
  render(<WorldGoldMarket />);
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Market prices are temporarily unavailable.'
  );
  mockFetch.mockResolvedValueOnce({ ok: true, json: async () => fixture() });
  fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
  await waitFor(() =>
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  );
  expect(
    await screen.findByText(formatLocalGoldAmount(1234.5, 'GBP', 'en-GB'), {
      normalizer: (text) => text,
    })
  ).toBeInTheDocument();
});

it('shows delayed-source and unavailable-history notices', async () => {
  const data = fixture();
  data.historyAvailable = false;
  data.gold!.stale = true;
  mockFetch.mockResolvedValue({ ok: true, json: async () => data });
  render(<WorldGoldMarket />);
  expect(await screen.findByText('Delayed source data')).toBeInTheDocument();
  expect(screen.getByText(/Close history is unavailable/)).toBeInTheDocument();
});

it('honors the selected 12-hour format in displayed trading sessions', async () => {
  mockTimeFormat = '12h';
  mockFetch.mockResolvedValue({ ok: true, json: async () => fixture() });
  render(<WorldGoldMarket />);
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeEnabled()
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Show details — United Kingdom' })
  );
  expect(screen.getByText('Mon–Fri 8:00 AM–5:00 PM')).toBeInTheDocument();
});

it('recovers from a hung request and enables retry after its timeout', async () => {
  jest.useFakeTimers();
  mockFetch.mockImplementation(
    (_url: string, options: RequestInit) =>
      new Promise((_resolve, reject) => {
        options.signal?.addEventListener('abort', () =>
          reject(new Error('aborted'))
        );
      })
  );
  try {
    render(<WorldGoldMarket />);
    await act(async () => {
      jest.advanceTimersByTime(20_000);
    });
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Market prices are temporarily unavailable.'
    );
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeEnabled();
  } finally {
    jest.useRealTimers();
  }
});

it('keeps the synchronous route messages identical to every canonical dictionary', () => {
  for (const language of SUPPORTED_LANGUAGE_CODES) {
    const expected = Object.fromEntries(
      Object.entries(getDictionary(language)).filter(([key]) =>
        key.startsWith('worldGold.')
      )
    );
    expect(
      (messages as Record<string, Record<string, string>>)[language]
    ).toEqual(expected);
  }
});
