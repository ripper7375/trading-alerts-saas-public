/**
 * MtfStackedCharts Component Tests
 *
 * The layout is a composition of two TradingChart instances (M5 above, M15
 * below) rather than a chart that owns two canvases, so these tests are mostly
 * about the composition holding: both timeframes subscribed, chrome not
 * duplicated, and — the one that matters — the PRO overlay toggle landing on
 * the M15 chart and nowhere else.
 */

import React from 'react';
import {
  render as rtlRender,
  screen,
  fireEvent,
  type RenderOptions,
} from '@testing-library/react';
import { describe, it, expect, beforeEach } from '@jest/globals';

import { LocaleProvider } from '@/lib/context/locale-context';
import { AppearanceProvider } from '@/components/providers/appearance-provider';
import {
  LOCALE_STORAGE_KEY,
  defaultPreferences,
} from '@/lib/i18n/locale-resolver';

// Same shadow-render wrapper as trading-chart.test.tsx: TradingChart reaches
// useLocale() and useChartAppearance() (LESSONS-LEARNED.md L40).
function render(ui: React.ReactElement, options?: RenderOptions) {
  return rtlRender(ui, {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <LocaleProvider>
        <AppearanceProvider>{children}</AppearanceProvider>
      </LocaleProvider>
    ),
    ...options,
  });
}

jest.mock('next/navigation', () => ({
  usePathname: () => '/terminal',
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('@/hooks/use-ohlcv-socket', () => ({
  useOhlcvSocket: jest.fn(),
}));

import { useOhlcvSocket } from '@/hooks/use-ohlcv-socket';
const mockUseOhlcvSocket = useOhlcvSocket as jest.MockedFunction<
  typeof useOhlcvSocket
>;

// `appliedHeights` records every height pushed to a live chart, which is how
// the divider tests tell a real resize from a decorative one. It is built
// inside the factory rather than closed over: babel-jest only hoists a factory
// with no out-of-scope references, and an unhoisted one registers after the
// imports, letting the real module load first.
jest.mock('lightweight-charts', () => {
  const appliedHeights: number[] = [];
  return {
    __appliedHeights: appliedHeights,
    createChart: jest.fn(() => ({
      addSeries: () => ({
        setData: jest.fn(),
        setMarkers: jest.fn(),
        applyOptions: jest.fn(),
      }),
      remove: jest.fn(),
      timeScale: () => ({ fitContent: jest.fn() }),
      applyOptions: (options: { height?: number }) => {
        if (typeof options?.height === 'number') {
          appliedHeights.push(options.height);
        }
      },
    })),
    ColorType: { Solid: 'Solid' },
    CandlestickSeries: 'Candlestick',
  };
});

const appliedChartHeights = (
  jest.requireMock('lightweight-charts') as { __appliedHeights: number[] }
).__appliedHeights;

jest.mock('@/components/charts/drawing/DrawingLayer', () => ({
  DrawingLayer: () => null,
}));

jest.mock('@/components/charts/drawing/useFiredAlertMarkers', () => ({
  useFiredAlertMarkers: jest.fn(),
}));

// NOT stubbed to null here, unlike trading-chart.test.tsx: where the toggle
// renders is the point of this suite.
jest.mock('@/components/charts/mtf/MtfToggle', () => ({
  MtfToggle: ({ isPro }: { isPro: boolean }) => (
    <div data-testid="mtf-toggle" data-is-pro={String(isPro)} />
  ),
}));

const mockUseSession = jest.fn();
jest.mock('next-auth/react', () => ({
  useSession: () => mockUseSession(),
}));

import { MtfStackedCharts } from '@/components/charts/mtf-stacked-charts';
import {
  DEFAULT_SPLIT,
  FALLBACK_TOTAL_HEIGHT_PX,
  paneCanvasHeights,
} from '@/components/charts/mtf-split-layout';

describe('MtfStackedCharts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    appliedChartHeights.length = 0;
    // Seeding skips LocaleProvider's real geo-IP fetch(), which otherwise
    // resolves after jsdom tears the window down and throws
    // "Cannot read properties of null (reading '_location')" — an error that
    // surfaces in whatever suite runs next, not this one
    // (LESSONS-LEARNED.md L40; same reason trading-chart.test.tsx seeds it).
    localStorage.setItem(
      LOCALE_STORAGE_KEY,
      JSON.stringify(defaultPreferences)
    );
    mockUseOhlcvSocket.mockReturnValue({
      data: null,
      isConnected: true,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useOhlcvSocket>);
    mockUseSession.mockReturnValue({ data: { user: { tier: 'PRO' } } });
  });

  it('subscribes to both M5 and M15', () => {
    render(<MtfStackedCharts symbol="XAUUSD" />);

    const timeframes = mockUseOhlcvSocket.mock.calls.map((c) => c[1]);
    expect(timeframes).toContain('M5');
    expect(timeframes).toContain('M15');
    expect(mockUseOhlcvSocket.mock.calls.every((c) => c[0] === 'XAUUSD')).toBe(
      true
    );
  });

  it('renders the M5 panel above the M15 panel', () => {
    const { container } = render(<MtfStackedCharts symbol="XAUUSD" />);

    const text = container.textContent ?? '';
    const m5At = text.indexOf('XAUUSD · M5');
    const m15At = text.indexOf('XAUUSD · M15');

    expect(m5At).toBeGreaterThanOrEqual(0);
    expect(m15At).toBeGreaterThanOrEqual(0);
    expect(m5At).toBeLessThan(m15At);
  });

  it('does not duplicate the full chart header or footer', () => {
    render(<MtfStackedCharts symbol="XAUUSD" />);

    // The single-chart header renders an <h2>; stacked mode uses a compact
    // strip instead, so neither instance should contribute one.
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Displaying live OHLCV candlestick data/i)
    ).not.toBeInTheDocument();
  });

  it('places the PRO overlay toggle on the M15 chart only', () => {
    render(<MtfStackedCharts symbol="XAUUSD" />);

    const toggles = screen.getAllByTestId('mtf-toggle');
    expect(toggles).toHaveLength(1);

    // Guards against someone later "tidying" mtfAvailable and silently moving
    // the toggle onto the M5 chart, where overlaying M5 on itself is a no-op.
    const strip = toggles[0].parentElement;
    expect(strip?.textContent).toContain('M15');
    expect(strip?.textContent).not.toContain('· M5');
  });

  it('still renders both charts for a FREE user, with the toggle locked', () => {
    mockUseSession.mockReturnValue({ data: { user: { tier: 'FREE' } } });
    render(<MtfStackedCharts symbol="XAUUSD" />);

    const timeframes = mockUseOhlcvSocket.mock.calls.map((c) => c[1]);
    expect(timeframes).toContain('M5');
    expect(timeframes).toContain('M15');

    // The toggle is still shown — MtfToggle renders its own locked/upgrade
    // branch — but flagged non-PRO so it cannot enable the overlay.
    const toggle = screen.getByTestId('mtf-toggle');
    expect(toggle).toHaveAttribute('data-is-pro', 'false');
  });

  it('honours explicit timeframes', () => {
    render(
      <MtfStackedCharts
        symbol="XAUUSD"
        upperTimeframe="M1"
        lowerTimeframe="M5"
      />
    );

    const timeframes = mockUseOhlcvSocket.mock.calls.map((c) => c[1]);
    expect(timeframes).toContain('M1');
    expect(timeframes).toContain('M5');
  });
});

/**
 * The divider. Before this the two charts sat in a fixed 50/50 flex column
 * and the band between them was inert, unlike the seed prototype's own
 * drag-resizable one — so these tests are about it being genuinely live:
 * present, between the right two charts, moving when driven, and — the one
 * that matters — carrying both canvases with it. A divider that moves while
 * the charts keep their mount-time height is the failure this guards, the
 * same class as the workspace panels' own collapse-without-resize bug.
 */
describe('MtfStackedCharts divider', () => {
  const dividerOf = (container: HTMLElement): HTMLElement => {
    const divider = container.querySelector<HTMLElement>('[role="separator"]');
    if (!divider) throw new Error('no divider rendered');
    return divider;
  };

  const growthOf = (container: HTMLElement, panelId: string): number =>
    Number(
      container.querySelector<HTMLElement>(`[data-panel-id="${panelId}"]`)
        ?.style.flexGrow
    );

  it('stacks the two charts in a vertical group', () => {
    const { container } = render(<MtfStackedCharts symbol="XAUUSD" />);

    expect(
      container
        .querySelector('[data-panel-group]')
        ?.getAttribute('data-panel-group-direction')
    ).toBe('vertical');
  });

  it('puts a labelled divider between the upper and lower charts', () => {
    const { container } = render(<MtfStackedCharts symbol="XAUUSD" />);

    const divider = dividerOf(container);
    expect(divider).toHaveAccessibleName(
      'Drag to resize the upper and lower charts'
    );

    const order = Array.from(
      container.querySelectorAll('[data-panel-id], [role="separator"]')
    );
    expect(order.map((el) => el.getAttribute('data-panel-id'))).toEqual([
      'mtf-upper',
      null,
      'mtf-lower',
    ]);
  });

  it('starts at an even split', () => {
    const { container } = render(<MtfStackedCharts symbol="XAUUSD" />);

    expect(growthOf(container, 'mtf-upper')).toBe(50);
    expect(growthOf(container, 'mtf-lower')).toBe(50);
  });

  it('moves the split when the divider is driven', () => {
    const { container } = render(<MtfStackedCharts symbol="XAUUSD" />);

    fireEvent.keyDown(dividerOf(container), { key: 'ArrowDown' });

    expect(growthOf(container, 'mtf-upper')).toBeGreaterThan(50);
    expect(growthOf(container, 'mtf-lower')).toBeLessThan(50);
    expect(
      growthOf(container, 'mtf-upper') + growthOf(container, 'mtf-lower')
    ).toBeCloseTo(100);
  });

  it('resizes both canvases to follow the divider', () => {
    const { container } = render(<MtfStackedCharts symbol="XAUUSD" />);
    const before = paneCanvasHeights(FALLBACK_TOTAL_HEIGHT_PX, DEFAULT_SPLIT);
    appliedChartHeights.length = 0;

    fireEvent.keyDown(dividerOf(container), { key: 'ArrowDown' });

    const expected = paneCanvasHeights(FALLBACK_TOTAL_HEIGHT_PX, [
      growthOf(container, 'mtf-upper'),
      growthOf(container, 'mtf-lower'),
    ]);
    expect(expected[0]).toBeGreaterThan(before[0]);
    expect(expected[1]).toBeLessThan(before[1]);
    expect(appliedChartHeights).toEqual(expect.arrayContaining(expected));
  });

  it('keeps both charts mounted and subscribed across a resize', () => {
    const { container } = render(<MtfStackedCharts symbol="XAUUSD" />);

    fireEvent.keyDown(dividerOf(container), { key: 'ArrowDown' });

    const text = container.textContent ?? '';
    expect(text).toContain('XAUUSD · M5');
    expect(text).toContain('XAUUSD · M15');
    expect(screen.getAllByTestId('mtf-toggle')).toHaveLength(1);
  });
});
