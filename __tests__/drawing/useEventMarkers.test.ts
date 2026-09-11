/**
 * useEventMarkers — draws a vertical line per upcoming high-impact economic
 * event. Unit-tested directly against a minimal fake chart/series pair
 * rather than through TradingChart, which mocks this hook out entirely
 * (see trading-chart.test.tsx's own comment on why a real fetch() inside
 * that file's jsdom environment is unsafe -- the same reasoning applies
 * here, so it is isolated the same way useFiredAlertMarkers already is).
 */

import { act, renderHook } from '@testing-library/react';
import { describe, it, expect, afterEach } from '@jest/globals';

import { useEventMarkers } from '@/components/charts/drawing/useEventMarkers';

type FakeChart = Parameters<typeof useEventMarkers>[0];
type FakeSeries = Parameters<typeof useEventMarkers>[1];

function makeFakeChart(): FakeChart {
  return {
    timeScale: () => ({ timeToCoordinate: () => null }),
  } as unknown as FakeChart;
}

function makeFakeSeries(): {
  attachPrimitive: jest.Mock;
  detachPrimitive: jest.Mock;
} {
  return {
    attachPrimitive: jest.fn(),
    detachPrimitive: jest.fn(),
  };
}

const originalFetch = global.fetch;

function mockEvents(events: Array<Record<string, unknown>>): void {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ events }),
  }) as unknown as typeof fetch;
}

describe('useEventMarkers', () => {
  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it('does nothing when disabled', async () => {
    const series = makeFakeSeries();
    mockEvents([{ valueId: '1', eventTime: 1700000000 }]);

    renderHook(() =>
      useEventMarkers(makeFakeChart(), series as unknown as FakeSeries, false)
    );
    await act(async () => {
      await Promise.resolve();
    });

    expect(global.fetch).not.toHaveBeenCalled();
    expect(series.attachPrimitive).not.toHaveBeenCalled();
  });

  it('does nothing when chart or series is null', async () => {
    mockEvents([{ valueId: '1', eventTime: 1700000000 }]);

    renderHook(() => useEventMarkers(null, null, true));
    await act(async () => {
      await Promise.resolve();
    });

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('attaches one primitive per event when enabled', async () => {
    const series = makeFakeSeries();
    mockEvents([
      { valueId: '1', eventTime: 1700000000 },
      { valueId: '2', eventTime: 1700003600 },
    ]);

    renderHook(() =>
      useEventMarkers(makeFakeChart(), series as unknown as FakeSeries, true)
    );
    await act(async () => {
      await Promise.resolve();
    });

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/market/economic-events',
      expect.objectContaining({ signal: expect.anything() })
    );
    expect(series.attachPrimitive).toHaveBeenCalledTimes(2);
  });

  it('attaches nothing when the request is refused', async () => {
    const series = makeFakeSeries();
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 403 }) as unknown as typeof fetch;

    renderHook(() =>
      useEventMarkers(makeFakeChart(), series as unknown as FakeSeries, true)
    );
    await act(async () => {
      await Promise.resolve();
    });

    expect(series.attachPrimitive).not.toHaveBeenCalled();
  });

  it('attaches nothing when the request throws', async () => {
    const series = makeFakeSeries();
    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error('offline')) as unknown as typeof fetch;

    renderHook(() =>
      useEventMarkers(makeFakeChart(), series as unknown as FakeSeries, true)
    );
    await act(async () => {
      await Promise.resolve();
    });

    expect(series.attachPrimitive).not.toHaveBeenCalled();
  });

  it('detaches every attached line on unmount', async () => {
    const series = makeFakeSeries();
    mockEvents([{ valueId: '1', eventTime: 1700000000 }]);

    const { unmount } = renderHook(() =>
      useEventMarkers(makeFakeChart(), series as unknown as FakeSeries, true)
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(series.attachPrimitive).toHaveBeenCalledTimes(1);

    unmount();
    expect(series.detachPrimitive).toHaveBeenCalledTimes(1);
  });

  it('aborts its in-flight request on unmount', async () => {
    const abort = jest.fn();
    const OriginalAbortController = global.AbortController;
    global.AbortController = class {
      signal = {} as AbortSignal;
      abort = abort;
    } as unknown as typeof AbortController;

    const series = makeFakeSeries();
    mockEvents([{ valueId: '1', eventTime: 1700000000 }]);

    const { unmount } = renderHook(() =>
      useEventMarkers(makeFakeChart(), series as unknown as FakeSeries, true)
    );
    unmount();

    expect(abort).toHaveBeenCalled();
    global.AbortController = OriginalAbortController;
  });
});
