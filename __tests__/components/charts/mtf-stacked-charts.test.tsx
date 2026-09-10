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

jest.mock('lightweight-charts', () => ({
  createChart: jest.fn(() => ({
    addSeries: () => ({
      setData: jest.fn(),
      setMarkers: jest.fn(),
      applyOptions: jest.fn(),
    }),
    remove: jest.fn(),
    timeScale: () => ({ fitContent: jest.fn() }),
    applyOptions: jest.fn(),
  })),
  ColorType: { Solid: 'Solid' },
  CandlestickSeries: 'Candlestick',
}));

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

describe('MtfStackedCharts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
