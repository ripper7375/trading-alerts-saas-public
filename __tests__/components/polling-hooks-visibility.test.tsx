/**
 * The five client polling hooks share `startVisiblePolling`: each one must
 * pause while the tab is hidden, refresh once on return, and never hold two
 * requests open. (`startVisiblePolling` itself is covered in
 * `__tests__/lib/utils/visible-polling.test.ts`; this file holds each hook to
 * it, so a hook that goes back to a bare `setInterval` fails here.)
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';

import { useEventMarkers } from '@/components/charts/drawing/useEventMarkers';
import { useCurrencyIndexChart } from '@/components/currency-index-pro/hooks/use-currency-index-chart';
import { useCurrencyIndexScreener } from '@/components/currency-index-pro/hooks/use-currency-index-screener';
import { useContainmentRates } from '@/components/market-sessions/useContainmentRates';
import { useUpcomingEvents } from '@/components/market-sessions/useUpcomingEvents';

type ChartArg = Parameters<typeof useEventMarkers>[0];
type SeriesArg = Parameters<typeof useEventMarkers>[1];

const fakeChart = {} as unknown as ChartArg;
const fakeSeries = {
  attachPrimitive: jest.fn(),
  detachPrimitive: jest.fn(),
} as unknown as SeriesArg;

interface HookCase {
  name: string;
  url: string;
  intervalMs: number;
  mount: () => { unmount: () => void };
}

const CASES: HookCase[] = [
  {
    name: 'useCurrencyIndexChart',
    url: '/api/market/currency-index-pro/chart?timeframe=M15',
    intervalMs: 30_000,
    mount: () => renderHook(() => useCurrencyIndexChart('M15')),
  },
  {
    name: 'useCurrencyIndexScreener',
    url: '/api/market/currency-index-pro/screener',
    intervalMs: 30_000,
    mount: () => renderHook(() => useCurrencyIndexScreener()),
  },
  {
    name: 'useUpcomingEvents',
    url: '/api/market/economic-events',
    intervalMs: 300_000,
    mount: () => renderHook(() => useUpcomingEvents()),
  },
  {
    name: 'useContainmentRates',
    url: '/api/market/indicator-statistics',
    intervalMs: 300_000,
    mount: () => renderHook(() => useContainmentRates()),
  },
  {
    name: 'useEventMarkers',
    url: '/api/market/economic-events',
    intervalMs: 300_000,
    mount: () => renderHook(() => useEventMarkers(fakeChart, fakeSeries, true)),
  },
];

const originalFetch = global.fetch;
let visibility: DocumentVisibilityState = 'visible';

function setVisibility(next: DocumentVisibilityState): void {
  visibility = next;
  document.dispatchEvent(new Event('visibilitychange'));
}

async function advance(ms: number): Promise<void> {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
}

function answerEverything(): jest.Mock {
  const fetchMock = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({}),
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

describe('the polling hooks', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    visibility = 'visible';
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibility,
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.useRealTimers();
    delete (document as unknown as Record<string, unknown>)['visibilityState'];
  });

  describe.each(CASES)('$name', ({ url, intervalMs, mount }) => {
    it('polls at once and then once per interval', async () => {
      const fetchMock = answerEverything();
      const { unmount } = mount();
      await advance(0);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(
        url,
        expect.objectContaining({ signal: expect.anything() })
      );

      await advance(intervalMs);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      unmount();
    });

    it('sends nothing while the tab is hidden', async () => {
      const fetchMock = answerEverything();
      const { unmount } = mount();
      await advance(0);
      expect(fetchMock).toHaveBeenCalledTimes(1);

      visibility = 'hidden';
      await advance(intervalMs * 4);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      unmount();
    });

    it('refreshes once, at once, when the tab is visible again', async () => {
      const fetchMock = answerEverything();
      const { unmount } = mount();
      await advance(0);

      visibility = 'hidden';
      await advance(intervalMs * 4);
      setVisibility('visible');
      await advance(0);

      expect(fetchMock).toHaveBeenCalledTimes(2);
      unmount();
    });

    it('never has two requests open at once', async () => {
      const fetchMock = jest.fn(() => new Promise<Response>(() => undefined));
      global.fetch = fetchMock as unknown as typeof fetch;
      const { unmount } = mount();

      await advance(intervalMs * 3);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      unmount();
    });

    it('aborts its request on unmount and sends nothing after it', async () => {
      let signal: AbortSignal | undefined;
      const fetchMock = jest.fn((_url: string, init?: RequestInit) => {
        signal = init?.signal ?? undefined;
        return new Promise<Response>(() => undefined);
      });
      global.fetch = fetchMock as unknown as typeof fetch;
      const { unmount } = mount();
      await advance(0);
      expect(signal?.aborted).toBe(false);

      unmount();
      expect(signal?.aborted).toBe(true);
      await advance(intervalMs * 3);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });
});
