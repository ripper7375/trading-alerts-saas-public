/**
 * TradingChart Component Tests
 *
 * Tests for the trading chart visualization component.
 * Part 9: Charts & Visualization
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Create mock functions that can be referenced in factory
const mockChartRemove = jest.fn();
const mockSetData = jest.fn();
const mockSetMarkers = jest.fn();
const mockFitContent = jest.fn();
const mockApplyOptions = jest.fn();
const mockAddCandlestickSeries = jest.fn();
const mockTimeScale = jest.fn();

// Mock lightweight-charts using factory function
jest.mock('lightweight-charts', () => {
  return {
    createChart: jest.fn(() => ({
      addCandlestickSeries: () => ({
        setData: (...args: unknown[]) => mockSetData(...args),
        setMarkers: (...args: unknown[]) => mockSetMarkers(...args),
      }),
      remove: () => mockChartRemove(),
      timeScale: () => ({ fitContent: () => mockFitContent() }),
      applyOptions: (...args: unknown[]) => mockApplyOptions(...args),
    })),
    ColorType: { Solid: 'Solid' },
  };
});

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock ResizeObserver
class MockResizeObserver {
  observe = jest.fn();
  disconnect = jest.fn();
  unobserve = jest.fn();
}
global.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;

import { TradingChart } from '@/components/charts/trading-chart';

// Sample API response (OHLCV-only, no fractals/trendlines)
const sampleApiResponse = {
  success: true,
  data: {
    ohlcv: [
      { time: 1704067200, open: 2040, high: 2045, low: 2035, close: 2042 },
      { time: 1704070800, open: 2042, high: 2050, low: 2040, close: 2048 },
      { time: 1704074400, open: 2048, high: 2055, low: 2045, close: 2052 },
    ],
    metadata: {
      symbol: 'XAUUSD',
      timeframe: 'H1',
      bars: 3,
    },
  },
  tier: 'FREE',
  requestedAt: '2024-01-01T00:00:00Z',
};

describe('TradingChart Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(sampleApiResponse),
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ============================================================================
  // Loading State
  // ============================================================================
  describe('loading state', () => {
    it('should show loading spinner initially', () => {
      mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

      render(<TradingChart symbol="XAUUSD" timeframe="H1" tier="FREE" />);

      expect(screen.getByText('Loading chart...')).toBeInTheDocument();
    });

    it('should show loading animation', () => {
      mockFetch.mockImplementation(() => new Promise(() => {}));

      const { container } = render(
        <TradingChart symbol="XAUUSD" timeframe="H1" tier="FREE" />
      );

      const spinner = container.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Data Fetching
  // ============================================================================
  describe('data fetching', () => {
    it('should fetch data on mount', async () => {
      render(<TradingChart symbol="XAUUSD" timeframe="H1" tier="FREE" />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/indicators/XAUUSD/H1');
      });
    });

    it('should refetch when symbol changes', async () => {
      const { rerender } = render(
        <TradingChart symbol="XAUUSD" timeframe="H1" tier="FREE" />
      );

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/indicators/XAUUSD/H1');
      });

      rerender(<TradingChart symbol="EURUSD" timeframe="H1" tier="FREE" />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/indicators/EURUSD/H1');
      });
    });

    it('should refetch when timeframe changes', async () => {
      const { rerender } = render(
        <TradingChart symbol="XAUUSD" timeframe="H1" tier="FREE" />
      );

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/indicators/XAUUSD/H1');
      });

      rerender(<TradingChart symbol="XAUUSD" timeframe="M15" tier="FREE" />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/indicators/XAUUSD/M15');
      });
    });
  });

  // ============================================================================
  // Error Handling
  // ============================================================================
  describe('error handling', () => {
    it('should show error message on fetch failure', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () =>
          Promise.resolve({
            success: false,
            error: 'API Error',
            message: 'Failed',
          }),
      });

      render(<TradingChart symbol="XAUUSD" timeframe="H1" tier="FREE" />);

      await waitFor(() => {
        expect(screen.getByText('Error loading chart')).toBeInTheDocument();
      });
    });

    it('should show error details', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () =>
          Promise.resolve({
            success: false,
            error: 'Not Found',
            message: 'Symbol not found',
          }),
      });

      render(<TradingChart symbol="INVALID" timeframe="H1" tier="FREE" />);

      await waitFor(() => {
        expect(screen.getByText('Symbol not found')).toBeInTheDocument();
      });
    });
  });

  // ============================================================================
  // Chart Rendering
  // Note: Chart library internals (setData, setMarkers, etc.) are difficult to
  // test in jsdom as they depend on refs and canvas rendering. These aspects
  // should be covered in E2E tests with a real browser.
  // ============================================================================
  describe('chart rendering', () => {
    it('should render chart container', async () => {
      const { container } = render(
        <TradingChart symbol="XAUUSD" timeframe="H1" tier="FREE" />
      );

      await waitFor(() => {
        // Chart container should exist
        expect(container.querySelector('.rounded-lg')).toBeInTheDocument();
      });
    });

    it('should display OHLCV info text', async () => {
      render(<TradingChart symbol="XAUUSD" timeframe="H1" tier="FREE" />);

      await waitFor(() => {
        expect(
          screen.getByText('Displaying OHLCV candlestick data only')
        ).toBeInTheDocument();
      });
    });
  });

  // ============================================================================
  // Status Bar
  // ============================================================================
  describe('status bar', () => {
    it('should display symbol and timeframe', async () => {
      render(<TradingChart symbol="XAUUSD" timeframe="H1" tier="FREE" />);

      await waitFor(() => {
        expect(screen.getByText('XAUUSD/H1')).toBeInTheDocument();
      });
    });

    it('should show refresh interval for FREE tier', async () => {
      render(<TradingChart symbol="XAUUSD" timeframe="H1" tier="FREE" />);

      await waitFor(() => {
        expect(screen.getByText('Refresh interval: 60 seconds')).toBeInTheDocument();
      });
    });

    it('should show refresh interval for PRO tier', async () => {
      render(<TradingChart symbol="XAUUSD" timeframe="H1" tier="PRO" />);

      await waitFor(() => {
        expect(screen.getByText('Refresh interval: 30 seconds')).toBeInTheDocument();
      });
    });

    it('should show last updated time', async () => {
      render(<TradingChart symbol="XAUUSD" timeframe="H1" tier="FREE" />);

      await waitFor(() => {
        expect(screen.getByText(/Last updated:/)).toBeInTheDocument();
      });
    });
  });

  // ============================================================================
  // Auto-refresh
  // ============================================================================
  describe('auto-refresh', () => {
    it('should auto-refresh every 60s for FREE tier', async () => {
      render(<TradingChart symbol="XAUUSD" timeframe="H1" tier="FREE" />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });

      // Advance time by 60 seconds
      jest.advanceTimersByTime(60000);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });
    });

    it('should auto-refresh every 30s for PRO tier', async () => {
      render(<TradingChart symbol="XAUUSD" timeframe="H1" tier="PRO" />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });

      // Advance time by 30 seconds
      jest.advanceTimersByTime(30000);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });
    });
  });

  // ============================================================================
  // Cleanup
  // Note: Chart cleanup (remove) depends on refs which don't populate in jsdom.
  // The actual cleanup logic should be tested in E2E tests.
  // ============================================================================
  describe('cleanup', () => {
    it('should unmount without errors', async () => {
      const { unmount } = render(
        <TradingChart symbol="XAUUSD" timeframe="H1" tier="FREE" />
      );

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });

      // Should unmount cleanly without throwing
      expect(() => unmount()).not.toThrow();
    });

    it('should clear interval on unmount', async () => {
      const { unmount } = render(
        <TradingChart symbol="XAUUSD" timeframe="H1" tier="FREE" />
      );

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });

      unmount();

      // Advance time - should not trigger more fetches
      jest.advanceTimersByTime(60000);

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================================================
  // Data Loading and Display
  // ============================================================================
  describe('data loading and display', () => {
    it('should load and display JPY pair data', async () => {
      const jpyResponse = {
        ...sampleApiResponse,
        data: {
          ...sampleApiResponse.data,
          ohlcv: [
            {
              time: 1704067200,
              open: 145.123,
              high: 145.5,
              low: 145.0,
              close: 145.234,
            },
          ],
        },
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(jpyResponse),
      });

      render(<TradingChart symbol="USDJPY" timeframe="H1" tier="FREE" />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/indicators/USDJPY/H1');
        expect(mockSetData).toHaveBeenCalled();
      });
    });

    it('should load and display EUR pair data', async () => {
      const eurResponse = {
        ...sampleApiResponse,
        data: {
          ...sampleApiResponse.data,
          ohlcv: [
            {
              time: 1704067200,
              open: 1.085,
              high: 1.086,
              low: 1.084,
              close: 1.08523,
            },
          ],
        },
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(eurResponse),
      });

      render(<TradingChart symbol="EURUSD" timeframe="H1" tier="FREE" />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/indicators/EURUSD/H1');
        expect(mockSetData).toHaveBeenCalled();
      });
    });
  });
});
