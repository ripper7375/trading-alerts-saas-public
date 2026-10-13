import { act, render, screen, waitFor } from '@testing-library/react';
import { PriceDisplay } from '@/components/payments/PriceDisplay';
import { PlanSelector } from '@/components/payments/PlanSelector';
import { LocaleProvider } from '@/lib/context/locale-context';
import { CURRENCY_USD_RATES, type DisplayUsdRates } from '@/lib/country-config';
import {
  defaultPreferences,
  LOCALE_STORAGE_KEY,
} from '@/lib/i18n/locale-resolver';

jest.mock('next/navigation', () => ({ usePathname: () => '/checkout' }));
jest.mock('@/lib/hooks/useAffiliateConfig', () => ({
  useAffiliateConfig: () => ({
    regularPrice: 20,
    threeDayPrice: 1.99,
    annualPrice: 200,
    annualSavingsPercent: 17,
  }),
}));
const mockFetch = jest.fn();
const firstRates: DisplayUsdRates = {
  rates: { ...CURRENCY_USD_RATES, THB: 33.53 },
  provider: 'currencybeacon',
  source: 'live',
  fetchedAt: '2026-10-13T04:00:00Z',
  rateUpdatedAt: '2026-10-13T04:00:00Z',
};
const response = (value: unknown) => ({ ok: true, json: async () => value });
function View({ amount = 20 }: { amount?: number }): React.ReactElement {
  return (
    <LocaleProvider
      initialPreferences={defaultPreferences}
      initialUsdRates={firstRates}
    >
      <PlanSelector
        value="MONTHLY"
        onChange={() => {}}
        canUseThreeDayPlan
        showThreeDayPlan
        currency="THB"
      />
      <PriceDisplay usdAmount={amount} currency="THB" compact />
    </LocaleProvider>
  );
}

describe('local checkout quote follows shared FX', () => {
  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-13T04:00:00Z'));
    localStorage.setItem(
      LOCALE_STORAGE_KEY,
      JSON.stringify(defaultPreferences)
    );
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });
    mockFetch.mockReset();
    global.fetch = mockFetch;
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });
  it('updates both monthly plan card and selected total on a new provider snapshot', async () => {
    let rates = firstRates;
    mockFetch.mockImplementation(async (url: string) =>
      url === '/api/fx/rates'
        ? response(rates)
        : response({
            currency: 'THB',
            localAmount: Math.round(20 * (rates.rates['THB'] ?? 0) * 100) / 100,
            exchangeRate: rates.rates['THB'],
          })
    );
    render(<View />);
    await waitFor(() => expect(screen.getAllByText(/670\.60/)).toHaveLength(2));
    rates = {
      ...firstRates,
      rates: { ...firstRates.rates, THB: 34 },
      fetchedAt: '2026-10-13T05:00:00Z',
      rateUpdatedAt: '2026-10-13T05:00:00Z',
    };
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });
    await waitFor(() => expect(screen.getAllByText(/680\.00/)).toHaveLength(2));
    expect(screen.queryByText(/670\.60/)).not.toBeInTheDocument();
  });
  it('does not let an older in-flight quote overwrite the newly selected amount', async () => {
    let resolveOld: (value: unknown) => void = () => {};
    mockFetch.mockImplementation(async (url: string) => {
      if (url === '/api/fx/rates') return response(firstRates);
      if (url.includes('amount=20&'))
        return new Promise((resolve) => {
          resolveOld = resolve;
        });
      return response({
        currency: 'THB',
        localAmount: 6706,
        exchangeRate: 33.53,
      });
    });
    const { rerender } = render(<View />);
    rerender(<View amount={200} />);
    await waitFor(() =>
      expect(screen.getAllByText(/6,706\.00/).length).toBeGreaterThan(0)
    );
    await act(async () => {
      resolveOld(
        response({ currency: 'THB', localAmount: 670.6, exchangeRate: 33.53 })
      );
    });
    expect(screen.getAllByText(/6,706\.00/).length).toBeGreaterThan(0);
  });
  it('uses shared THB rates when conversion transport fails', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url === '/api/fx/rates') return response(firstRates);
      throw new Error('conversion offline');
    });
    render(<View />);
    await waitFor(() => expect(screen.getAllByText(/670\.60/)).toHaveLength(2));
  });
});

describe('stalled conversion deadline', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(Date.parse('2026-10-13T04:00:00Z'));
    localStorage.setItem(
      LOCALE_STORAGE_KEY,
      JSON.stringify(defaultPreferences)
    );
    mockFetch.mockReset();
    global.fetch = mockFetch;
    mockFetch.mockImplementation(async (url: string) =>
      url === '/api/fx/rates' ? response(firstRates) : new Promise(() => {})
    );
  });
  afterEach(() => {
    jest.useRealTimers();
  });
  it('shows the shared rate estimate after a fetch/body stalls instead of loading forever', async () => {
    render(<View />);
    await act(async () => {
      jest.advanceTimersByTime(10_000);
    });
    expect(screen.getAllByText(/670\.60/)).toHaveLength(2);
    expect(screen.queryByText(/Calculating price/)).not.toBeInTheDocument();
  });
});
