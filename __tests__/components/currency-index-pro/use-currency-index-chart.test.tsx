/**
 * useCurrencyIndexChart — a request aborted by a timeframe switch (or an
 * unmount) must not touch `data`.
 *
 * The hook used to call `setData(EMPTY_DATA)` from the `catch` that the
 * AbortError of the switch lands in, so the chart was blanked between the
 * switch and the new answer (and a loaded chart was wiped by a switch away
 * and back). A timeout or a network failure still degrades to EMPTY_DATA.
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';

import {
  useCurrencyIndexChart,
  type CurrencyIndexChartData,
} from '@/components/currency-index-pro/hooks/use-currency-index-chart';

const originalFetch = global.fetch;

function payload(
  timeframe: 'M5' | 'M15',
  serverTime: number
): CurrencyIndexChartData {
  return {
    timeframe,
    serverTime,
    todaySessionOpen: null,
    corridor: null,
    highImpactNews: [],
    series: {},
  };
}

interface PendingRequest {
  url: string;
  signal: AbortSignal;
  answer: (body: CurrencyIndexChartData) => void;
}

/** A fetch that stays open until answered and rejects on abort, like a real one. */
function abortableFetch(): PendingRequest[] {
  const pending: PendingRequest[] = [];
  global.fetch = jest.fn((url: string, init?: RequestInit) => {
    const signal = init?.signal as AbortSignal;
    return new Promise<Response>((resolve, reject) => {
      signal.addEventListener('abort', () =>
        reject(new DOMException('The operation was aborted.', 'AbortError'))
      );
      pending.push({
        url,
        signal,
        answer: (body) =>
          resolve({ ok: true, json: async () => body } as Response),
      });
    });
  }) as unknown as typeof fetch;
  return pending;
}

async function flush(): Promise<void> {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(0);
  });
}

describe('useCurrencyIndexChart', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.useRealTimers();
  });

  it('stays null while the first answer is pending after a timeframe switch aborted the first request', async () => {
    const pending = abortableFetch();
    const { result, rerender } = renderHook(
      ({ timeframe }: { timeframe: 'M5' | 'M15' }) =>
        useCurrencyIndexChart(timeframe),
      { initialProps: { timeframe: 'M5' } }
    );
    await flush();
    expect(pending).toHaveLength(1);

    rerender({ timeframe: 'M15' });
    await flush();

    expect(pending[0]?.signal.aborted).toBe(true);
    expect(pending).toHaveLength(2);
    expect(pending[1]?.url).toContain('timeframe=M15');
    // The bug: the aborted request's catch had turned this into EMPTY_DATA.
    expect(result.current).toBeNull();

    await act(async () => {
      pending[1]?.answer(payload('M15', 2));
    });
    await flush();
    expect(result.current).toEqual(payload('M15', 2));
  });

  it('keeps loaded data when a switch aborts the request that followed it', async () => {
    const pending = abortableFetch();
    const { result, rerender } = renderHook(
      ({ timeframe }: { timeframe: 'M5' | 'M15' }) =>
        useCurrencyIndexChart(timeframe),
      { initialProps: { timeframe: 'M5' } }
    );
    await flush();
    await act(async () => {
      pending[0]?.answer(payload('M5', 1));
    });
    await flush();
    expect(result.current).toEqual(payload('M5', 1));

    rerender({ timeframe: 'M15' });
    await flush();
    rerender({ timeframe: 'M5' });
    await flush();

    expect(pending[1]?.signal.aborted).toBe(true);
    expect(result.current).toEqual(payload('M5', 1));
  });

  it('ignores a late answer of the timeframe it has left', async () => {
    // A fetch that does not honour the abort and answers late.
    const answers: Array<(body: CurrencyIndexChartData) => void> = [];
    global.fetch = jest.fn(
      () =>
        new Promise<Response>((resolve) =>
          answers.push((body) =>
            resolve({ ok: true, json: async () => body } as Response)
          )
        )
    ) as unknown as typeof fetch;
    const { result, rerender } = renderHook(
      ({ timeframe }: { timeframe: 'M5' | 'M15' }) =>
        useCurrencyIndexChart(timeframe),
      { initialProps: { timeframe: 'M5' } }
    );
    await flush();
    rerender({ timeframe: 'M15' });
    await flush();

    await act(async () => {
      answers[0]?.(payload('M5', 1));
    });
    await flush();
    expect(result.current).toBeNull();

    await act(async () => {
      answers[1]?.(payload('M15', 2));
    });
    await flush();
    expect(result.current).toEqual(payload('M15', 2));
  });

  describe('failure still degrades to empty data', () => {
    it('on a refused request', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 403,
      }) as unknown as typeof fetch;
      const { result } = renderHook(() => useCurrencyIndexChart('M15'));
      await flush();
      expect(result.current).toEqual(
        expect.objectContaining({ serverTime: 0, series: {} })
      );
    });

    it('on a network failure', async () => {
      global.fetch = jest
        .fn()
        .mockRejectedValue(new TypeError('offline')) as unknown as typeof fetch;
      const { result } = renderHook(() => useCurrencyIndexChart('M15'));
      await flush();
      expect(result.current).toEqual(
        expect.objectContaining({ serverTime: 0, series: {} })
      );
    });

    it('on a request that times out', async () => {
      const pending = abortableFetch();
      const { result } = renderHook(() => useCurrencyIndexChart('M15'));
      await flush();
      expect(result.current).toBeNull();

      await act(async () => {
        await jest.advanceTimersByTimeAsync(10_000);
      });
      expect(pending[0]?.signal.aborted).toBe(true);
      expect(result.current).toEqual(
        expect.objectContaining({ serverTime: 0, series: {} })
      );
    });
  });
});
