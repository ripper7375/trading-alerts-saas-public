import {
  FALLBACK_USD_RATES,
  FX_SUPPORTED_CURRENCIES,
  FX_MAX_RETAINED_AGE_MS,
} from './usd-fallback-rates';
import {
  fetchCurrencyBeacon,
  FX_PROVIDER_TIMEOUT_MS,
  parseCurrencyBeacon,
  parseFrankfurter,
  utcTimestamp,
} from './rate-providers';

describe('FX provider validation (money-service)', () => {
  const now = Date.parse('2026-10-13T10:00:00Z');
  const rates: Record<string, number> = {
    ...FALLBACK_USD_RATES,
    GBP: 0.756,
    THB: 33.53,
  };
  const primary = (patch: Record<string, unknown> = {}) => ({
    meta: { code: 200 },
    response: { base: 'USD', timestamp: now / 1000, rates, ...patch },
  });
  const daily = () =>
    FX_SUPPORTED_CURRENCIES.filter((code) => code !== 'USD').map((quote) => ({
      base: 'USD',
      quote,
      rate: rates[quote],
      date: '2026-10-12',
    }));

  it('accepts provider observation seconds and ISO time without inventing current time', () => {
    expect(parseCurrencyBeacon(primary(), now)).toMatchObject({
      rateUpdatedAt: new Date(now).toISOString(),
      rates,
    });
    expect(
      parseCurrencyBeacon(
        primary({ timestamp: undefined, date: '2026-10-13T09:00:00Z' }),
        now
      )
    ).toMatchObject({ rateUpdatedAt: '2026-10-13T09:00:00.000Z' });
  });

  it('derives USD identity only after validating the base, and rejects an invalid supplied identity', () => {
    const { USD: _, ...quotes } = rates;
    expect(
      parseCurrencyBeacon(primary({ rates: quotes }), now)?.rates.USD
    ).toBe(1);
    expect(parseCurrencyBeacon(primary({ base: 'EUR' }), now)).toBeNull();
    expect(
      parseCurrencyBeacon(primary({ rates: { ...rates, USD: 2 } }), now)
    ).toBeNull();
  });

  it.each([0, -1, NaN, Infinity, '33.53', null, undefined])(
    'rejects invalid or absent currency rate %s',
    (value) => {
      expect(
        parseCurrencyBeacon(primary({ rates: { ...rates, THB: value } }), now)
      ).toBeNull();
    }
  );

  it('rejects source times beyond retained age or clock skew, missing timestamps and API error payloads', () => {
    expect(
      parseCurrencyBeacon(
        primary({ timestamp: (now - FX_MAX_RETAINED_AGE_MS - 1) / 1000 }),
        now
      )
    ).toBeNull();
    expect(
      parseCurrencyBeacon(primary({ timestamp: (now + 300001) / 1000 }), now)
    ).toBeNull();
    expect(
      parseCurrencyBeacon(primary({ timestamp: undefined }), now)
    ).toBeNull();
    expect(
      parseCurrencyBeacon({ ...primary(), meta: { code: 401 } }, now)
    ).toBeNull();
  });

  it('accepts all fourteen fallback rows and uses the oldest source date conservatively', () => {
    const rows = daily();
    rows[0].date = '2026-10-11';
    expect(parseFrankfurter(rows, now)).toEqual({
      provider: 'frankfurter',
      rates,
      rateUpdatedAt: '2026-10-11T00:00:00.000Z',
    });
  });

  it('rejects incomplete, duplicate, wrong-base, future and stale daily fallback rows', () => {
    const rows = daily();
    expect(parseFrankfurter(rows.slice(1), now)).toBeNull();
    expect(parseFrankfurter([rows[0], ...rows.slice(0, -1)], now)).toBeNull();
    expect(
      parseFrankfurter(
        rows.map((row) => ({ ...row, base: 'EUR' })),
        now
      )
    ).toBeNull();
    expect(
      parseFrankfurter(
        rows.map((row) => ({ ...row, date: '2026-10-14' })),
        now
      )
    ).toBeNull();
    expect(
      parseFrankfurter(
        rows.map((row) => ({ ...row, date: '2026-10-05' })),
        now
      )
    ).toBeNull();
    expect(
      parseFrankfurter(
        rows.map((row) => ({ ...row, date: '2026-02-31' })),
        now
      )
    ).toBeNull();
  });

  it('accepts prior business-day dates through weekends without requiring same-day data', () => {
    expect(
      parseFrankfurter(daily(), Date.parse('2026-10-18T10:00:00Z'))
    ).not.toBeNull();
  });

  it('rejects UTC date rollover and locale-dependent or date-only timestamps', () => {
    expect(utcTimestamp('2026-02-31T10:00:00Z')).toBeNull();
    expect(utcTimestamp('2026-10-13')).toBeNull();
    expect(utcTimestamp('10/13/2026')).toBeNull();
  });

  it('aborts and bounds a hanging provider call at three seconds', async () => {
    jest.useFakeTimers();
    const previousFetch = global.fetch;
    const mockFetch = jest.fn(
      (_url: string, _options?: RequestInit) => new Promise(() => {})
    );
    global.fetch = mockFetch as unknown as typeof fetch;
    try {
      const pending = fetchCurrencyBeacon('test-key');
      const assertion = expect(pending).rejects.toThrow(
        'FX provider timed out'
      );
      await jest.advanceTimersByTimeAsync(FX_PROVIDER_TIMEOUT_MS);
      await assertion;
      expect(mockFetch.mock.calls[0][1]?.signal?.aborted).toBe(true);
    } finally {
      global.fetch = previousFetch;
      jest.useRealTimers();
    }
  });
});
