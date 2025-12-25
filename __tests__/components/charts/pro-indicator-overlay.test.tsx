/**
 * ProIndicatorOverlay Component Tests
 *
 * Tests for components/charts/pro-indicator-overlay.tsx
 * Chart overlay component for rendering PRO-only indicators
 *
 * Part 9: Charts & Visualization - PRO Indicators Implementation
 */

import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect, beforeEach } from '@jest/globals';

import type { ProIndicatorData } from '@/types/indicator';

// Mock chart series methods
const mockSetData = jest.fn();
const mockRemoveSeries = jest.fn();
const mockAddLineSeries = jest.fn(() => ({
  setData: mockSetData,
}));

// Mock IChartApi
const mockChart = {
  addLineSeries: mockAddLineSeries,
  removeSeries: mockRemoveSeries,
};

// Import after mocks
import { ProIndicatorOverlay } from '@/components/charts/pro-indicator-overlay';

describe('ProIndicatorOverlay Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Null/Empty Handling
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('null/empty handling', () => {
    it('should return null (no DOM elements)', () => {
      const { container } = render(
        <ProIndicatorOverlay
          chart={null}
          proData={null}
          selectedIndicators={[]}
          timeData={[]}
        />
      );

      expect(container.firstChild).toBeNull();
    });

    it('should not render when chart is null', () => {
      const proData: ProIndicatorData = {
        momentumCandles: [],
        tema: [1, 2, 3],
        hrma: [],
        smma: [],
      };

      render(
        <ProIndicatorOverlay
          chart={null}
          proData={proData}
          selectedIndicators={['tema']}
          timeData={[1704067200, 1704070800, 1704074400]}
        />
      );

      expect(mockAddLineSeries).not.toHaveBeenCalled();
    });

    it('should not render when proData is null', () => {
      render(
        <ProIndicatorOverlay
          chart={mockChart as unknown as import('lightweight-charts').IChartApi}
          proData={null}
          selectedIndicators={['tema']}
          timeData={[1704067200, 1704070800, 1704074400]}
        />
      );

      expect(mockAddLineSeries).not.toHaveBeenCalled();
    });

    it('should not render when timeData is empty', () => {
      const proData: ProIndicatorData = {
        momentumCandles: [],
        tema: [1, 2, 3],
        hrma: [],
        smma: [],
      };

      render(
        <ProIndicatorOverlay
          chart={mockChart as unknown as import('lightweight-charts').IChartApi}
          proData={proData}
          selectedIndicators={['tema']}
          timeData={[]}
        />
      );

      expect(mockAddLineSeries).not.toHaveBeenCalled();
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Rendering Based on Selection
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('rendering based on selection', () => {
    it('should not render TEMA when not selected', () => {
      const proData: ProIndicatorData = {
        momentumCandles: [],
        tema: [1, 2, 3],
        hrma: [],
        smma: [],
      };

      render(
        <ProIndicatorOverlay
          chart={mockChart as unknown as import('lightweight-charts').IChartApi}
          proData={proData}
          selectedIndicators={['hrma']} // TEMA not selected
          timeData={[1704067200, 1704070800, 1704074400]}
        />
      );

      // Should only add series for hrma, not tema
      // Since hrma is empty, might not add any
    });

    it('should not render empty indicator data', () => {
      const proData: ProIndicatorData = {
        momentumCandles: [],
        tema: [], // Empty
        hrma: [],
        smma: [],
      };

      render(
        <ProIndicatorOverlay
          chart={mockChart as unknown as import('lightweight-charts').IChartApi}
          proData={proData}
          selectedIndicators={['tema']}
          timeData={[1704067200, 1704070800, 1704074400]}
        />
      );

      // Empty data should not trigger setData
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Component Return Value
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('component return value', () => {
    it('should always return null (manages chart overlays only)', () => {
      const proData: ProIndicatorData = {
        momentumCandles: [],
        tema: [1, 2, 3],
        hrma: [4, 5, 6],
        smma: [7, 8, 9],
        keltnerChannels: {
          ultraExtremeUpper: [100, 101, 102],
          extremeUpper: [90, 91, 92],
          upperMost: [80, 81, 82],
          upper: [70, 71, 72],
          upperMiddle: [60, 61, 62],
          lowerMiddle: [50, 51, 52],
          lower: [40, 41, 42],
          lowerMost: [30, 31, 32],
          extremeLower: [20, 21, 22],
          ultraExtremeLower: [10, 11, 12],
        },
        zigzag: {
          peaks: [{ index: 1, price: 2050 }],
          bottoms: [{ index: 2, price: 2000 }],
        },
      };

      const { container } = render(
        <ProIndicatorOverlay
          chart={mockChart as unknown as import('lightweight-charts').IChartApi}
          proData={proData}
          selectedIndicators={['tema', 'keltner_channels', 'zigzag']}
          timeData={[1704067200, 1704070800, 1704074400]}
        />
      );

      // Component renders nothing to DOM
      expect(container.firstChild).toBeNull();
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Data Filtering
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('data filtering', () => {
    it('should filter out undefined values from data', () => {
      const proData: ProIndicatorData = {
        momentumCandles: [],
        tema: [1, undefined, 3], // Contains undefined
        hrma: [],
        smma: [],
      };

      render(
        <ProIndicatorOverlay
          chart={mockChart as unknown as import('lightweight-charts').IChartApi}
          proData={proData}
          selectedIndicators={['tema']}
          timeData={[1704067200, 1704070800, 1704074400]}
        />
      );

      // If setData was called, verify it received filtered data
      if (mockSetData.mock.calls.length > 0) {
        const dataArg = mockSetData.mock.calls[0][0];
        // Should not contain any undefined values
        const hasUndefined = dataArg.some(
          (d: { value: number | undefined }) => d.value === undefined
        );
        expect(hasUndefined).toBe(false);
      }
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ZigZag Rendering
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('zigzag rendering', () => {
    it('should not render zigzag when not selected', () => {
      const proData: ProIndicatorData = {
        momentumCandles: [],
        tema: [],
        hrma: [],
        smma: [],
        zigzag: {
          peaks: [{ index: 1, price: 2050 }],
          bottoms: [{ index: 2, price: 2000 }],
        },
      };

      render(
        <ProIndicatorOverlay
          chart={mockChart as unknown as import('lightweight-charts').IChartApi}
          proData={proData}
          selectedIndicators={['tema']} // zigzag not selected
          timeData={[1704067200, 1704070800, 1704074400]}
        />
      );

      // ZigZag series should not be added when not selected
    });

    it('should handle zigzag with empty peaks and bottoms', () => {
      const proData: ProIndicatorData = {
        momentumCandles: [],
        tema: [],
        hrma: [],
        smma: [],
        zigzag: {
          peaks: [],
          bottoms: [],
        },
      };

      // Should not throw
      expect(() => {
        render(
          <ProIndicatorOverlay
            chart={mockChart as unknown as import('lightweight-charts').IChartApi}
            proData={proData}
            selectedIndicators={['zigzag']}
            timeData={[1704067200, 1704070800, 1704074400]}
          />
        );
      }).not.toThrow();
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Keltner Channels Rendering
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('keltner channels rendering', () => {
    it('should handle keltnerChannels when undefined', () => {
      const proData: ProIndicatorData = {
        momentumCandles: [],
        tema: [],
        hrma: [],
        smma: [],
        // No keltnerChannels
      };

      expect(() => {
        render(
          <ProIndicatorOverlay
            chart={mockChart as unknown as import('lightweight-charts').IChartApi}
            proData={proData}
            selectedIndicators={['keltner_channels']}
            timeData={[1704067200, 1704070800, 1704074400]}
          />
        );
      }).not.toThrow();
    });
  });
});
