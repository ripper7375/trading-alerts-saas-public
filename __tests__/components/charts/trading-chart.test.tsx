/**
 * TradingChart Component Tests
 *
 * Tests for the trading chart visualization component.
 * Part 9: Charts & Visualization
 *
 * The component uses useOhlcvSocket (Socket.IO) instead of HTTP polling.
 * All tests mock the hook at the module level so no real socket connection
 * is attempted.
 */

import React from 'react';
import {
  render as rtlRender,
  screen,
  waitFor,
  type RenderOptions,
} from '@testing-library/react';
import { describe, it, expect, beforeEach } from '@jest/globals';

import { LocaleProvider } from '@/lib/context/locale-context';
import {
  LOCALE_STORAGE_KEY,
  defaultPreferences,
} from '@/lib/i18n/locale-resolver';

// TradingChart (batch-5 locale wiring) now calls useLocale() -- needs a
// LocaleProvider ancestor. Shadow `render` once here instead of touching
// every one of this file's many render()/rerender() call sites: RTL's own
// `rerender()` re-uses whatever wrapper was passed to the original render(),
// so wrapping only the import fixes every call site in one place
// (LESSONS-LEARNED.md L40).
function render(ui: React.ReactElement, options?: RenderOptions) {
  return rtlRender(ui, { wrapper: LocaleProvider, ...options });
}

// LocaleProvider calls usePathname() directly (L40's own stub).
jest.mock('next/navigation', () => ({
  usePathname: () => '/terminal',
}));

// ─────────────────────────────────────────────────────────────
// Mock useOhlcvSocket — prevents real Socket.IO connections
// ─────────────────────────────────────────────────────────────
jest.mock('@/hooks/use-ohlcv-socket', () => ({
  useOhlcvSocket: jest.fn(),
}));

import { useOhlcvSocket } from '@/hooks/use-ohlcv-socket';
const mockUseOhlcvSocket = useOhlcvSocket as jest.MockedFunction<
  typeof useOhlcvSocket
>;

// ─────────────────────────────────────────────────────────────
// Mock lightweight-charts (canvas not available in jsdom)
// ─────────────────────────────────────────────────────────────
const mockChartRemove = jest.fn();
const mockSetData = jest.fn();
const mockFitContent = jest.fn();
const mockApplyOptions = jest.fn();

jest.mock('lightweight-charts', () => ({
  createChart: jest.fn(() => ({
    // v5 API: chart.addSeries(CandlestickSeries, options)
    addSeries: () => ({
      setData: (...args: unknown[]) => mockSetData(...args),
      setMarkers: jest.fn(),
    }),
    remove: () => mockChartRemove(),
    timeScale: () => ({ fitContent: () => mockFitContent() }),
    applyOptions: (...args: unknown[]) => mockApplyOptions(...args),
  })),
  ColorType: { Solid: 'Solid' },
  CandlestickSeries: 'Candlestick',
}));

// ─────────────────────────────────────────────────────────────
// Mock DrawingLayer and useFiredAlertMarkers — these pull in
// components/charts/drawing/persistence.ts, which does a real
// `fetch('/api/drawings?...')`. jsdom/undici's fetch requires an
// absolute URL (there's no browser "page origin" to resolve a relative
// path against), so the real call throws "Invalid URL", and React 19's
// act() now aggregates/rethrows any console.error logged during
// rendering — even ones the app itself already caught and handled.
// This file only tests TradingChart's own socket/chart behavior, so we
// isolate it the same way we isolate useOhlcvSocket and lightweight-charts.
// ─────────────────────────────────────────────────────────────
jest.mock('@/components/charts/drawing/DrawingLayer', () => ({
  DrawingLayer: () => null,
}));

jest.mock('@/components/charts/drawing/useFiredAlertMarkers', () => ({
  useFiredAlertMarkers: jest.fn(),
}));

// MtfToggle calls next/navigation's useRouter(), which requires an App
// Router context this test doesn't set up. It's a tangential subsystem
// (multi-timeframe overlay toggle) unrelated to what this file tests, so
// isolate it the same way.
jest.mock('@/components/charts/mtf/MtfToggle', () => ({
  MtfToggle: () => null,
}));

// ─────────────────────────────────────────────────────────────
// Mock ResizeObserver (not in jsdom)
// ─────────────────────────────────────────────────────────────
class MockResizeObserver {
  observe = jest.fn();
  disconnect = jest.fn();
  unobserve = jest.fn();
}
global.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;

import { TradingChart } from '@/components/charts/trading-chart';

// ─────────────────────────────────────────────────────────────
// Shared fixtures
// ─────────────────────────────────────────────────────────────
const sampleOhlcvData = {
  symbol: 'XAUUSD',
  timeframe: 'H1',
  ohlcv: [
    { time: 1704067200, open: 2040, high: 2045, low: 2035, close: 2042 },
    { time: 1704070800, open: 2042, high: 2050, low: 2040, close: 2048 },
    { time: 1704074400, open: 2048, high: 2055, low: 2045, close: 2052 },
  ],
  metadata: { timestamp: 1704074400, bars: 3 },
};

const loadingState = {
  data: null,
  isConnected: false,
  isLoading: true,
  error: null,
} as const;

const connectedState = {
  data: sampleOhlcvData,
  isConnected: true,
  isLoading: false,
  error: null,
} as const;

const disconnectedState = {
  data: null,
  isConnected: false,
  isLoading: false,
  error: null,
} as const;

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────
describe('TradingChart Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: connected with data
    mockUseOhlcvSocket.mockReturnValue(connectedState);
    // Seeding skips LocaleProvider's real geo-IP fetch(), which otherwise
    // races jsdom teardown (LESSONS-LEARNED.md L40).
    localStorage.setItem(
      LOCALE_STORAGE_KEY,
      JSON.stringify(defaultPreferences)
    );
  });

  // ──────────────────────────────────────────────────────────
  // Loading State
  // ──────────────────────────────────────────────────────────
  describe('loading state', () => {
    it('should show loading spinner while socket is connecting', () => {
      mockUseOhlcvSocket.mockReturnValue(loadingState);

      render(<TradingChart symbol="XAUUSD" timeframe="H1" />);

      expect(
        screen.getByText('Connecting to live data...')
      ).toBeInTheDocument();
    });

    it('should show loading animation spinner element', () => {
      mockUseOhlcvSocket.mockReturnValue(loadingState);

      const { container } = render(
        <TradingChart symbol="XAUUSD" timeframe="H1" />
      );

      expect(container.querySelector('.animate-spin')).toBeInTheDocument();
    });
  });

  // ──────────────────────────────────────────────────────────
  // Socket Hook Integration
  // ──────────────────────────────────────────────────────────
  describe('socket hook integration', () => {
    it('should call useOhlcvSocket with correct symbol and timeframe', () => {
      render(<TradingChart symbol="XAUUSD" timeframe="H1" />);

      expect(mockUseOhlcvSocket).toHaveBeenCalledWith('XAUUSD', 'H1');
    });

    it('should call useOhlcvSocket with new symbol when symbol prop changes', () => {
      const { rerender } = render(
        <TradingChart symbol="XAUUSD" timeframe="H1" />
      );

      expect(mockUseOhlcvSocket).toHaveBeenCalledWith('XAUUSD', 'H1');

      rerender(<TradingChart symbol="EURUSD" timeframe="H1" />);

      expect(mockUseOhlcvSocket).toHaveBeenCalledWith('EURUSD', 'H1');
    });

    it('should call useOhlcvSocket with new timeframe when timeframe prop changes', () => {
      const { rerender } = render(
        <TradingChart symbol="XAUUSD" timeframe="H1" />
      );

      rerender(<TradingChart symbol="XAUUSD" timeframe="M15" />);

      expect(mockUseOhlcvSocket).toHaveBeenCalledWith('XAUUSD', 'M15');
    });
  });

  // ──────────────────────────────────────────────────────────
  // Error Handling
  // ──────────────────────────────────────────────────────────
  describe('error handling', () => {
    it('should show error heading when socket reports an error', () => {
      mockUseOhlcvSocket.mockReturnValue({
        data: null,
        isConnected: false,
        isLoading: false,
        error: 'Connection failed: ECONNREFUSED',
      });

      render(<TradingChart symbol="XAUUSD" timeframe="H1" />);

      expect(screen.getByText('Error loading chart')).toBeInTheDocument();
    });

    it('should display the specific error message', () => {
      mockUseOhlcvSocket.mockReturnValue({
        data: null,
        isConnected: false,
        isLoading: false,
        error: 'Symbol not found',
      });

      render(<TradingChart symbol="INVALID" timeframe="H1" />);

      expect(screen.getByText('Symbol not found')).toBeInTheDocument();
    });
  });

  // ──────────────────────────────────────────────────────────
  // Chart Rendering
  // ──────────────────────────────────────────────────────────
  describe('chart rendering', () => {
    it('should render the chart container', () => {
      const { container } = render(
        <TradingChart symbol="XAUUSD" timeframe="H1" />
      );

      expect(container.querySelector('.rounded-lg')).toBeInTheDocument();
    });

    it('should display live OHLCV info text', () => {
      render(<TradingChart symbol="XAUUSD" timeframe="H1" />);

      expect(
        screen.getByText('Displaying live OHLCV candlestick data')
      ).toBeInTheDocument();
    });

    it('should display WebSocket update info text', () => {
      render(<TradingChart symbol="XAUUSD" timeframe="H1" />);

      expect(
        screen.getByText('Updates in real-time via WebSocket')
      ).toBeInTheDocument();
    });
  });

  // ──────────────────────────────────────────────────────────
  // Status Bar
  // ──────────────────────────────────────────────────────────
  describe('status bar', () => {
    it('should display symbol and timeframe in header', () => {
      render(<TradingChart symbol="XAUUSD" timeframe="H1" />);

      expect(screen.getByText('XAUUSD/H1')).toBeInTheDocument();
    });

    it('should show "Live" when socket is connected', () => {
      mockUseOhlcvSocket.mockReturnValue(connectedState);

      render(<TradingChart symbol="XAUUSD" timeframe="H1" />);

      expect(screen.getByText('Live')).toBeInTheDocument();
    });

    it('should show "Disconnected" when socket is not connected', () => {
      mockUseOhlcvSocket.mockReturnValue(disconnectedState);

      render(<TradingChart symbol="XAUUSD" timeframe="H1" />);

      expect(screen.getByText('Disconnected')).toBeInTheDocument();
    });

    it('should show green dot when connected', () => {
      mockUseOhlcvSocket.mockReturnValue(connectedState);

      const { container } = render(
        <TradingChart symbol="XAUUSD" timeframe="H1" />
      );

      expect(container.querySelector('.bg-green-500')).toBeInTheDocument();
    });

    it('should show red dot when disconnected', () => {
      mockUseOhlcvSocket.mockReturnValue(disconnectedState);

      const { container } = render(
        <TradingChart symbol="XAUUSD" timeframe="H1" />
      );

      expect(container.querySelector('.bg-red-500')).toBeInTheDocument();
    });
  });

  // ──────────────────────────────────────────────────────────
  // Data Loading and Display
  // ──────────────────────────────────────────────────────────
  describe('data loading and display', () => {
    it('should pass OHLCV data to the chart series when received', async () => {
      mockUseOhlcvSocket.mockReturnValue(connectedState);

      render(<TradingChart symbol="XAUUSD" timeframe="H1" />);

      await waitFor(() => {
        expect(mockSetData).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({ open: 2040, close: 2042 }),
          ])
        );
      });
    });

    it('should pass JPY pair OHLCV data to the chart series', async () => {
      const jpyData = {
        symbol: 'USDJPY',
        timeframe: 'H1',
        ohlcv: [
          {
            time: 1704067200,
            open: 145.123,
            high: 145.5,
            low: 145.0,
            close: 145.234,
          },
        ],
        metadata: { timestamp: 1704067200, bars: 1 },
      };

      mockUseOhlcvSocket.mockReturnValue({
        data: jpyData,
        isConnected: true,
        isLoading: false,
        error: null,
      });

      render(<TradingChart symbol="USDJPY" timeframe="H1" />);

      await waitFor(() => {
        expect(mockSetData).toHaveBeenCalledWith(
          expect.arrayContaining([expect.objectContaining({ close: 145.234 })])
        );
      });
    });

    it('should pass EUR pair OHLCV data to the chart series', async () => {
      const eurData = {
        symbol: 'EURUSD',
        timeframe: 'H1',
        ohlcv: [
          {
            time: 1704067200,
            open: 1.085,
            high: 1.086,
            low: 1.084,
            close: 1.08523,
          },
        ],
        metadata: { timestamp: 1704067200, bars: 1 },
      };

      mockUseOhlcvSocket.mockReturnValue({
        data: eurData,
        isConnected: true,
        isLoading: false,
        error: null,
      });

      render(<TradingChart symbol="EURUSD" timeframe="H1" />);

      await waitFor(() => {
        expect(mockSetData).toHaveBeenCalledWith(
          expect.arrayContaining([expect.objectContaining({ close: 1.08523 })])
        );
      });
    });
  });

  // ──────────────────────────────────────────────────────────
  // Cleanup
  // ──────────────────────────────────────────────────────────
  describe('cleanup', () => {
    it('should unmount without errors', () => {
      const { unmount } = render(
        <TradingChart symbol="XAUUSD" timeframe="H1" />
      );

      expect(() => unmount()).not.toThrow();
    });
  });
});
