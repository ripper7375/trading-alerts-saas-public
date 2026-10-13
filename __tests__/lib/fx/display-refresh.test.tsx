import { act, renderHook } from '@testing-library/react';
import { CURRENCY_USD_RATES, type DisplayUsdRates } from '@/lib/country-config';
import {
  useDisplayUsdRates,
  isDisplayRateSnapshot,
} from '@/lib/fx/use-display-usd-rates';
import {
  FX_BROWSER_REFRESH_MS,
  FX_MAX_DAILY_RATE_AGE_MS,
  FX_MAX_RETAINED_AGE_MS,
} from '@/lib/fx/rate-contract';

const now = Date.parse('2026-10-13T04:00:00Z');
const snapshot = (rate = 0.756, offset = 0): DisplayUsdRates => ({
  rates: { ...CURRENCY_USD_RATES, GBP: rate },
  source: 'live',
  provider: 'currencybeacon',
  fetchedAt: new Date(now + offset).toISOString(),
  rateUpdatedAt: new Date(now + offset).toISOString(),
});
const mockFetch = jest.fn();
const response = (value: unknown) => ({ ok: true, json: async () => value });
const flush = async (): Promise<void> => {
  await act(async () => {
    await Promise.resolve();
  });
};

describe('display FX refresh', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(now);
    mockFetch.mockReset();
    global.fetch = mockFetch;
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });
    mockFetch.mockResolvedValue(response(snapshot()));
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('keeps server hydration and applies changed GBP prices without a reload', async () => {
    const { result } = renderHook(() => useDisplayUsdRates(snapshot()));
    expect(result.current?.rates['GBP']).toBe(0.756);
    await flush();
    mockFetch.mockResolvedValue(response(snapshot(0.77, 3600000)));
    await act(async () => {
      jest.advanceTimersByTime(FX_BROWSER_REFRESH_MS);
    });
    expect(result.current?.rates['GBP']).toBe(0.77);
    expect(mockFetch).toHaveBeenLastCalledWith(
      '/api/fx/rates',
      expect.objectContaining({
        cache: 'no-store',
        signal: expect.any(AbortSignal),
      })
    );
  });

  it('revalidates on returning to a visible tab and on reconnect', async () => {
    const { result } = renderHook(() => useDisplayUsdRates(snapshot()));
    await flush();
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'hidden',
    });
    await act(async () => {
      jest.advanceTimersByTime(FX_BROWSER_REFRESH_MS);
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    mockFetch.mockResolvedValue(response(snapshot(0.78, 3600000)));
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(result.current?.rates['GBP']).toBe(0.78);
    await act(async () => {
      window.dispatchEvent(new Event('online'));
    });
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('deduplicates overlapping focus/online requests and aborts on unmount', async () => {
    mockFetch.mockImplementation(() => new Promise(() => {}));
    const { unmount } = renderHook(() => useDisplayUsdRates(snapshot()));
    act(() => {
      window.dispatchEvent(new Event('focus'));
      window.dispatchEvent(new Event('online'));
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const options = mockFetch.mock.calls[0]?.[1] as RequestInit;
    unmount();
    expect(options.signal?.aborted).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('retains the full previous snapshot for malformed data or request failure', async () => {
    const { result } = renderHook(() => useDisplayUsdRates(snapshot()));
    await flush();
    mockFetch.mockResolvedValue(
      response({ ...snapshot(0.99, 3600000), rates: { GBP: 0.99 } })
    );
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });
    expect(result.current?.rates['GBP']).toBe(0.756);
    mockFetch.mockRejectedValue(new Error('offline'));
    await act(async () => {
      window.dispatchEvent(new Event('online'));
    });
    expect(result.current?.provider).toBe('currencybeacon');
    expect(result.current?.rates['GBP']).toBe(0.756);
  });

  it('expires retained provider data after eight hours even in a hidden offline tab', async () => {
    const { result } = renderHook(() => useDisplayUsdRates(snapshot()));
    await flush();
    mockFetch.mockRejectedValue(new Error('offline'));
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'hidden',
    });

    act(() => {
      jest.advanceTimersByTime(FX_MAX_RETAINED_AGE_MS + 1);
    });

    expect(result.current).toMatchObject({
      provider: 'fixed',
      source: 'fallback',
      rateUpdatedAt: null,
      rates: CURRENCY_USD_RATES,
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['currencybeacon', FX_MAX_RETAINED_AGE_MS],
    ['frankfurter', FX_MAX_DAILY_RATE_AGE_MS],
  ] as const)(
    'expires %s publication data independently of its fresh retrieval time',
    async (provider, maxSourceAge) => {
      const initial: DisplayUsdRates = {
        ...snapshot(),
        provider,
        rateUpdatedAt: new Date(now - maxSourceAge + 1000).toISOString(),
      };
      mockFetch.mockRejectedValue(new Error('offline'));
      const { result } = renderHook(() => useDisplayUsdRates(initial));
      await flush();
      expect(result.current?.provider).toBe(provider);

      act(() => {
        jest.advanceTimersByTime(1001);
      });

      expect(result.current).toMatchObject({
        provider: 'fixed',
        source: 'fallback',
        rateUpdatedAt: null,
        rates: CURRENCY_USD_RATES,
      });
    }
  );

  it.each([
    [
      'retained data',
      {
        ...snapshot(0.99, -FX_MAX_RETAINED_AGE_MS - 1),
        provider: 'frankfurter',
        rateUpdatedAt: new Date(now - 24 * 60 * 60 * 1000).toISOString(),
      },
    ],
    [
      'CurrencyBeacon publication',
      {
        ...snapshot(0.99),
        rateUpdatedAt: new Date(now - FX_MAX_RETAINED_AGE_MS - 1).toISOString(),
      },
    ],
    [
      'Frankfurter publication',
      {
        ...snapshot(0.99),
        provider: 'frankfurter',
        rateUpdatedAt: new Date(
          now - FX_MAX_DAILY_RATE_AGE_MS - 1
        ).toISOString(),
      },
    ],
  ] as const)('rejects stale incoming %s', async (_, staleSnapshot) => {
    const initial = snapshot();
    const { result } = renderHook(() => useDisplayUsdRates(initial));
    await flush();
    mockFetch.mockResolvedValue(response(staleSnapshot));

    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });

    expect(isDisplayRateSnapshot(staleSnapshot)).toBe(false);
    expect(result.current).toBe(initial);
  });

  it('expires on focus before a pending request and recovers from a valid server snapshot', async () => {
    const { result } = renderHook(() => useDisplayUsdRates(snapshot()));
    await flush();
    jest.setSystemTime(now + FX_MAX_RETAINED_AGE_MS + 1);
    let resolveRequest: (value: ReturnType<typeof response>) => void = () => {};
    mockFetch.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        })
    );

    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    expect(result.current?.provider).toBe('fixed');
    expect(result.current?.rates).toEqual(CURRENCY_USD_RATES);

    // The provider copy predates the local expiry fallback by 1ms but is fresh.
    const recovered = snapshot(0.77, FX_MAX_RETAINED_AGE_MS);
    await act(async () => {
      resolveRequest(response(recovered));
    });

    expect(result.current).toBe(recovered);
    expect(result.current?.provider).toBe('currencybeacon');
    expect(result.current?.rates['GBP']).toBe(0.77);
  });

  it('accepts legacy metadata while applying the retention limit', async () => {
    const legacy = {
      ...snapshot(),
      provider: undefined,
      rateUpdatedAt: undefined,
    };
    mockFetch.mockRejectedValue(new Error('offline'));
    expect(isDisplayRateSnapshot(legacy)).toBe(true);
    const { result } = renderHook(() => useDisplayUsdRates(legacy));
    await flush();
    expect(result.current).toBe(legacy);

    jest.setSystemTime(now + FX_MAX_RETAINED_AGE_MS + 1);
    await act(async () => {
      window.dispatchEvent(new Event('online'));
    });

    expect(isDisplayRateSnapshot(legacy)).toBe(false);
    expect(result.current?.provider).toBe('fixed');
    expect(result.current?.rateUpdatedAt).toBeNull();
  });

  it('does not regress when a server navigation supplies an older snapshot', async () => {
    const { result, rerender } = renderHook(
      ({ initial }) => useDisplayUsdRates(initial),
      { initialProps: { initial: snapshot(0.77, 3600000) } }
    );
    await flush();
    rerender({ initial: snapshot(0.756) });
    expect(result.current?.rates['GBP']).toBe(0.77);
  });

  it('skips fetching in consumers without a server rate seed', () => {
    const { result } = renderHook(() => useDisplayUsdRates());
    expect(result.current).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it.each([NaN, Infinity, -1, 0])('rejects invalid GBP rate %s', (rate) => {
    expect(isDisplayRateSnapshot(snapshot(rate))).toBe(false);
  });
  it('rejects unknown providers, invalid time and a nonidentity USD rate', () => {
    expect(isDisplayRateSnapshot({ ...snapshot(), provider: 'unknown' })).toBe(
      false
    );
    expect(isDisplayRateSnapshot({ ...snapshot(), fetchedAt: 'invalid' })).toBe(
      false
    );
    expect(
      isDisplayRateSnapshot({
        ...snapshot(),
        rates: { ...snapshot().rates, USD: 2 },
      })
    ).toBe(false);
  });
});
