/**
 * useMtfOverlay — the PRO multi-timeframe channel overlay following the
 * active-indicator setting (build step 2 part 6; rule 6, ADR-010).
 *
 * The hook sends no variant, titles the lines with the indicator the route
 * answers with, and looks again shortly after every slot boundary so a setting
 * that takes effect at slot T is on screen from the first refresh after the cycle
 * at T is ready, with no page reload. The route's answers here are what the route
 * produces (see market-data-channel-active-indicator.test.ts, which runs the route
 * against the gateway's contract fixtures).
 */

import { act, renderHook } from '@testing-library/react';
import type { IChartApi } from 'lightweight-charts';

import {
  REFRESH_AFTER_SLOT_MS,
  msUntilNextCycleCheck,
  useMtfOverlay,
} from '@/components/charts/mtf/useMtfOverlay';

jest.mock('lightweight-charts', () => ({
  __esModule: true,
  LineSeries: 'Line',
  LineStyle: { Solid: 0, Dashed: 2 },
}));

const SLOT_MS = 5 * 60 * 1000;
const SLOT0 = 1789560000 * 1000; // a slot boundary (a multiple of five minutes)

interface FakeSeries {
  options: { title: string; color: string; lineStyle: number };
  setData: jest.Mock;
}

function makeChart() {
  const created: FakeSeries[] = [];
  const removed: FakeSeries[] = [];
  const chart = {
    addSeries: jest.fn((_type: unknown, options: FakeSeries['options']) => {
      const series: FakeSeries = { options, setData: jest.fn() };
      created.push(series);
      return series;
    }),
    removeSeries: jest.fn((series: FakeSeries) => {
      removed.push(series);
    }),
  };
  return { chart: chart as unknown as IChartApi, created, removed, raw: chart };
}

const POINTS = [
  { time: 100, upper: 12, mid: 11, lower: 10 },
  { time: 200, upper: 13, mid: null, lower: 11 },
];

const mockFetch = jest.fn();
function answers(
  variant: string | undefined,
  points = POINTS,
  init: {
    ok?: boolean;
    success?: boolean;
    message?: string;
    error?: string;
  } = {}
) {
  mockFetch.mockResolvedValueOnce({
    ok: init.ok ?? true,
    json: async () => ({
      success: init.success ?? true,
      variant,
      points,
      message: init.message,
      error: init.error,
    }),
  });
}

async function advance(ms: number) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  jest.useFakeTimers({ now: SLOT0 + 10_000 }); // ten seconds past a slot
  mockFetch.mockReset();
  global.fetch = mockFetch as unknown as typeof fetch;
});
afterEach(() => {
  jest.useRealTimers();
});

describe('msUntilNextCycleCheck: the next 90 seconds past a slot boundary, strictly in the future', () => {
  it.each([
    [0, 90_000],
    [1_000, 89_000],
    [89_000, 1_000],
    [89_999, 1],
    [90_000, SLOT_MS], // exactly on it: the next one, never "now"
    [90_001, SLOT_MS - 1],
    [150_000, SLOT_MS - 60_000],
    [299_999, 90_001],
  ])('%i ms into a slot: wait %i ms', (offset, expected) => {
    expect(msUntilNextCycleCheck(SLOT0 + offset)).toBe(expected);
    expect(msUntilNextCycleCheck(SLOT0 + 7 * SLOT_MS + offset)).toBe(expected);
  });

  it('is always positive and never longer than one slot', () => {
    for (let offset = 0; offset < SLOT_MS; offset += 997) {
      const wait = msUntilNextCycleCheck(SLOT0 + offset);
      expect(wait).toBeGreaterThan(0);
      expect(wait).toBeLessThanOrEqual(SLOT_MS);
    }
  });

  it('the offset is about the time a cycle takes to become ready (ADR-012: two minutes at most)', () => {
    expect(REFRESH_AFTER_SLOT_MS).toBe(90_000);
    expect(REFRESH_AFTER_SLOT_MS).toBeLessThan(2 * 60 * 1000);
  });
});

describe('the first draw', () => {
  it('asks for the channel without choosing an indicator, and draws three lines titled with the one the route chose', async () => {
    const { chart, created } = makeChart();
    answers('best_fit_a');
    const { result } = renderHook(() =>
      useMtfOverlay(chart, true, { symbol: 'XAUUSD', sourceTimeframe: 'M5' })
    );
    expect(result.current.isLoading).toBe(true);
    await advance(0);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/market-data/channel?symbol=XAUUSD&timeframe=M5'
    );
    expect(created.map((s) => s.options.title)).toEqual([
      'M5 upper (best_fit_a)',
      'M5 base (best_fit_a)',
      'M5 lower (best_fit_a)',
    ]);
    expect(created.map((s) => s.options.lineStyle)).toEqual([0, 2, 0]); // the base line dashed
    expect(result.current).toEqual({ isLoading: false, error: null });
  });

  it('feeds each line its own values and leaves out the points that have none', async () => {
    const { chart, created } = makeChart();
    answers('cherry_a');
    renderHook(() =>
      useMtfOverlay(chart, true, { symbol: 'XAUUSD', sourceTimeframe: 'M5' })
    );
    await advance(0);
    expect(created[0].setData).toHaveBeenCalledWith([
      { time: 100, value: 12 },
      { time: 200, value: 13 },
    ]);
    expect(created[1].setData).toHaveBeenCalledWith([{ time: 100, value: 11 }]); // 200 has no mid
    expect(created[2].setData).toHaveBeenCalledWith([
      { time: 100, value: 10 },
      { time: 200, value: 11 },
    ]);
  });

  it('a pinned variant is sent, for callers that must not follow the setting', async () => {
    const { chart } = makeChart();
    answers('non_b');
    renderHook(() =>
      useMtfOverlay(chart, true, {
        symbol: 'XAUUSD',
        sourceTimeframe: 'M5',
        variant: 'non_b',
      })
    );
    await advance(0);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/market-data/channel?symbol=XAUUSD&timeframe=M5&variant=non_b'
    );
  });

  it('a route that does not say which indicator (the flag is off) falls back to the pin, or to an empty title', async () => {
    const { chart, created } = makeChart();
    answers(undefined);
    renderHook(() =>
      useMtfOverlay(chart, true, {
        symbol: 'XAUUSD',
        sourceTimeframe: 'M5',
        variant: 'cherry_b',
      })
    );
    await advance(0);
    expect(created[0].options.title).toBe('M5 upper (cherry_b)');
  });

  it('is inert while disabled and while there is no chart: nothing is fetched', async () => {
    const { chart } = makeChart();
    renderHook(() =>
      useMtfOverlay(chart, false, { symbol: 'XAUUSD', sourceTimeframe: 'M5' })
    );
    renderHook(() =>
      useMtfOverlay(null, true, { symbol: 'XAUUSD', sourceTimeframe: 'M5' })
    );
    await advance(SLOT_MS * 3);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('a route error is shown, with no lines, and the overlay tries again at the next cycle', async () => {
    const { chart, created } = makeChart();
    answers(undefined, undefined, {
      ok: false,
      success: false,
      message: 'Active indicator unavailable',
    });
    const { result } = renderHook(() =>
      useMtfOverlay(chart, true, { symbol: 'XAUUSD', sourceTimeframe: 'M5' })
    );
    await advance(0);
    expect(result.current).toEqual({
      isLoading: false,
      error: 'Active indicator unavailable',
    });
    expect(created).toHaveLength(0);

    answers('best_fit_a');
    await advance(80_000); // 10 s + 80 s = 90 s past the slot
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(created).toHaveLength(3);
    expect(result.current.error).toBeNull();
  });

  it('a network failure is reported and does not stop the refreshing', async () => {
    const { chart } = makeChart();
    mockFetch.mockRejectedValueOnce(new Error('offline'));
    const { result } = renderHook(() =>
      useMtfOverlay(chart, true, { symbol: 'XAUUSD', sourceTimeframe: 'M5' })
    );
    await advance(0);
    expect(result.current.error).toBe('Network error loading MTF channel');
    answers('best_fit_a');
    await advance(80_000);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result.current.error).toBeNull();
  });
});

describe('staying current: the overlay looks again 90 seconds after each slot', () => {
  it('not before the cycle can be ready, then once per slot', async () => {
    const { chart } = makeChart();
    answers('best_fit_a');
    answers('best_fit_a');
    answers('best_fit_a');
    renderHook(() =>
      useMtfOverlay(chart, true, { symbol: 'XAUUSD', sourceTimeframe: 'M5' })
    );
    await advance(0);
    expect(mockFetch).toHaveBeenCalledTimes(1); // mounted ten seconds past the slot

    await advance(79_999);
    expect(mockFetch).toHaveBeenCalledTimes(1); // 89.999 s past the slot: not yet
    await advance(1);
    expect(mockFetch).toHaveBeenCalledTimes(2); // 90 s past the slot

    await advance(SLOT_MS - 1);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    await advance(1);
    expect(mockFetch).toHaveBeenCalledTimes(3); // 90 s past the next slot
  });

  it('the same indicator: the three lines are updated in place with the new bars, nothing is drawn again', async () => {
    const { chart, created, removed, raw } = makeChart();
    answers('best_fit_a');
    renderHook(() =>
      useMtfOverlay(chart, true, { symbol: 'XAUUSD', sourceTimeframe: 'M5' })
    );
    await advance(0);
    const [upper] = created;
    const newer = [...POINTS, { time: 300, upper: 14, mid: 13, lower: 12 }];

    answers('best_fit_a', newer);
    await advance(80_000);

    expect(raw.addSeries).toHaveBeenCalledTimes(3); // no new lines
    expect(removed).toHaveLength(0);
    expect(upper.setData).toHaveBeenLastCalledWith([
      { time: 100, value: 12 },
      { time: 200, value: 13 },
      { time: 300, value: 14 },
    ]);
  });

  it('the active indicator changed at T: the first refresh after the cycle at T replaces the lines and retitles them', async () => {
    const { chart, created, removed } = makeChart();
    answers('best_fit_a'); // the cycle before T
    renderHook(() =>
      useMtfOverlay(chart, true, { symbol: 'XAUUSD', sourceTimeframe: 'M5' })
    );
    await advance(0);
    const before = [...created];
    expect(before.map((s) => s.options.title)).toEqual([
      'M5 upper (best_fit_a)',
      'M5 base (best_fit_a)',
      'M5 lower (best_fit_a)',
    ]);

    answers('cherry_a'); // the cycle at T is ready: the route resolves the new setting
    await advance(80_000);

    expect(removed).toEqual(before);
    const after = created.slice(3);
    expect(after.map((s) => s.options.title)).toEqual([
      'M5 upper (cherry_a)',
      'M5 base (cherry_a)',
      'M5 lower (cherry_a)',
    ]);
  });

  it('until then it does not move: a refresh that still answers the old indicator changes nothing on screen', async () => {
    const { chart, created, removed } = makeChart();
    answers('best_fit_a');
    answers('best_fit_a');
    renderHook(() =>
      useMtfOverlay(chart, true, { symbol: 'XAUUSD', sourceTimeframe: 'M5' })
    );
    await advance(0);
    await advance(80_000);
    expect(created).toHaveLength(3);
    expect(removed).toHaveLength(0);
  });

  it('a refresh that fails keeps the lines on screen, shows the error, and recovers on the next one', async () => {
    const { chart, created, removed } = makeChart();
    answers('best_fit_a');
    const { result } = renderHook(() =>
      useMtfOverlay(chart, true, { symbol: 'XAUUSD', sourceTimeframe: 'M5' })
    );
    await advance(0);

    answers(undefined, undefined, {
      ok: false,
      success: false,
      error: 'Failed to fetch channel data',
    });
    await advance(80_000);
    expect(result.current.error).toBe('Failed to fetch channel data');
    expect(removed).toHaveLength(0); // still on screen
    expect(created).toHaveLength(3);

    answers('best_fit_a');
    await advance(SLOT_MS);
    expect(result.current.error).toBeNull();
  });

  it('leaving (disabled or unmounted) removes the lines and stops the refreshing', async () => {
    const { chart, created, removed } = makeChart();
    answers('best_fit_a');
    const { rerender, unmount } = renderHook(
      ({ enabled }) =>
        useMtfOverlay(chart, enabled, {
          symbol: 'XAUUSD',
          sourceTimeframe: 'M5',
        }),
      { initialProps: { enabled: true } }
    );
    await advance(0);

    rerender({ enabled: false });
    expect(removed).toEqual(created);
    await advance(SLOT_MS * 3);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    answers('best_fit_a');
    rerender({ enabled: true });
    await advance(0);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    unmount();
    await advance(SLOT_MS * 3);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('an answer that arrives after the overlay was switched off is dropped', async () => {
    const { chart, created } = makeChart();
    let release: (v: unknown) => void = () => undefined;
    mockFetch.mockReturnValueOnce(
      new Promise((resolve) => (release = resolve))
    );
    const { rerender } = renderHook(
      ({ enabled }) =>
        useMtfOverlay(chart, enabled, {
          symbol: 'XAUUSD',
          sourceTimeframe: 'M5',
        }),
      { initialProps: { enabled: true } }
    );
    rerender({ enabled: false });
    await act(async () => {
      release({
        ok: true,
        json: async () => ({
          success: true,
          variant: 'best_fit_a',
          points: POINTS,
        }),
      });
    });
    expect(created).toHaveLength(0);
  });
});
