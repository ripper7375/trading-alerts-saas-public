'use client';

import type {
  IChartApi,
  ISeriesApi,
  Time,
  LineWidth,
} from 'lightweight-charts';
import { useEffect, useRef } from 'react';

/**
 * Line point data structure
 */
interface LinePoint {
  time: number;
  value: number;
}

/**
 * IndicatorOverlay Props
 */
interface IndicatorOverlayProps {
  chart: IChartApi;
  candleSeries: ISeriesApi<'Candlestick'>;
  horizontal: Record<string, LinePoint[]>;
  diagonal: Record<string, LinePoint[]>;
}

/**
 * Color configuration for different line types
 */
const LINE_COLORS = {
  // Horizontal resistance lines (peaks) - red shades
  peak_1: '#f23645',
  peak_2: '#ff6b6b',
  peak_3: '#ff8c8c',
  // Horizontal support lines (bottoms) - green shades
  bottom_1: '#00c853',
  bottom_2: '#4ecdc4',
  bottom_3: '#95e1d3',
  // Diagonal ascending lines - blue shades
  ascending_1: '#1e88e5',
  ascending_2: '#64b5f6',
  ascending_3: '#90caf9',
  // Diagonal descending lines - orange shades
  descending_1: '#ff6b35',
  descending_2: '#ff8c5a',
  descending_3: '#ffad7f',
} as const;

/**
 * Line style interface
 */
interface LineStyleConfig {
  lineWidth: LineWidth;
  lineStyle: number;
}

/**
 * Line style configuration
 * lineWidth must be 1, 2, 3, or 4 for lightweight-charts
 */
const LINE_STYLE_PRIMARY: LineStyleConfig = {
  lineWidth: 2,
  lineStyle: 0, // Solid
};

const LINE_STYLE_SECONDARY: LineStyleConfig = {
  lineWidth: 1,
  lineStyle: 2, // Dashed
};

const LINE_STYLE_TERTIARY: LineStyleConfig = {
  lineWidth: 1,
  lineStyle: 3, // Dotted
};

/**
 * Get line color based on key name
 */
function getLineColor(key: string): string {
  // Try exact match first
  if (key in LINE_COLORS) {
    return LINE_COLORS[key as keyof typeof LINE_COLORS];
  }

  // Try to match by pattern
  const lowerKey = key.toLowerCase();

  if (lowerKey.includes('peak') || lowerKey.includes('resistance')) {
    if (lowerKey.includes('1')) return LINE_COLORS.peak_1;
    if (lowerKey.includes('2')) return LINE_COLORS.peak_2;
    return LINE_COLORS.peak_3;
  }

  if (lowerKey.includes('bottom') || lowerKey.includes('support')) {
    if (lowerKey.includes('1')) return LINE_COLORS.bottom_1;
    if (lowerKey.includes('2')) return LINE_COLORS.bottom_2;
    return LINE_COLORS.bottom_3;
  }

  if (lowerKey.includes('ascending') || lowerKey.includes('up')) {
    if (lowerKey.includes('1')) return LINE_COLORS.ascending_1;
    if (lowerKey.includes('2')) return LINE_COLORS.ascending_2;
    return LINE_COLORS.ascending_3;
  }

  if (lowerKey.includes('descending') || lowerKey.includes('down')) {
    if (lowerKey.includes('1')) return LINE_COLORS.descending_1;
    if (lowerKey.includes('2')) return LINE_COLORS.descending_2;
    return LINE_COLORS.descending_3;
  }

  // Default color
  return '#758696';
}

/**
 * Get line style based on priority level
 */
function getLineStyle(key: string): LineStyleConfig {
  const lowerKey = key.toLowerCase();

  if (lowerKey.includes('1') || lowerKey.includes('primary')) {
    return LINE_STYLE_PRIMARY;
  }

  if (lowerKey.includes('2') || lowerKey.includes('secondary')) {
    return LINE_STYLE_SECONDARY;
  }

  return LINE_STYLE_TERTIARY;
}

/**
 * IndicatorOverlay Component
 *
 * Renders indicator lines on the trading chart.
 * Supports horizontal (support/resistance) and diagonal (trend) lines.
 *
 * Line Types:
 * - Horizontal: peak_1/2/3 (resistance), bottom_1/2/3 (support)
 * - Diagonal: ascending_1/2/3 (uptrend), descending_1/2/3 (downtrend)
 *
 * Color Scheme:
 * - Red shades: Resistance/peaks
 * - Green shades: Support/bottoms
 * - Blue shades: Ascending trends
 * - Orange shades: Descending trends
 */
export function IndicatorOverlay({
  chart,
  candleSeries,
  horizontal,
  diagonal,
}: IndicatorOverlayProps): null {
  // Store line series references for cleanup
  const lineSeriesRef = useRef<ISeriesApi<'Line'>[]>([]);

  useEffect(() => {
    // Cleanup previous lines
    lineSeriesRef.current.forEach((series) => {
      try {
        chart.removeSeries(series);
      } catch {
        // Series might already be removed
      }
    });
    lineSeriesRef.current = [];

    // Render horizontal lines
    if (horizontal) {
      Object.entries(horizontal).forEach(([key, points]) => {
        if (!Array.isArray(points) || points.length === 0) return;

        try {
          const color = getLineColor(key);
          const style = getLineStyle(key);

          const lineSeries = chart.addLineSeries({
            color,
            lineWidth: style.lineWidth,
            lineStyle: style.lineStyle,
            crosshairMarkerVisible: false,
            lastValueVisible: true,
            priceLineVisible: false,
          });

          // Convert data format
          const lineData = points.map((point) => ({
            time: point.time as Time,
            value: point.value,
          }));

          lineSeries.setData(lineData);
          lineSeriesRef.current.push(lineSeries);
        } catch (err) {
          console.error(`Failed to add horizontal line ${key}:`, err);
        }
      });
    }

    // Render diagonal lines
    if (diagonal) {
      Object.entries(diagonal).forEach(([key, points]) => {
        if (!Array.isArray(points) || points.length === 0) return;

        try {
          const color = getLineColor(key);
          const style = getLineStyle(key);

          const lineSeries = chart.addLineSeries({
            color,
            lineWidth: style.lineWidth,
            lineStyle: style.lineStyle,
            crosshairMarkerVisible: false,
            lastValueVisible: true,
            priceLineVisible: false,
          });

          // Convert data format
          const lineData = points.map((point) => ({
            time: point.time as Time,
            value: point.value,
          }));

          lineSeries.setData(lineData);
          lineSeriesRef.current.push(lineSeries);
        } catch (err) {
          console.error(`Failed to add diagonal line ${key}:`, err);
        }
      });
    }

    // Cleanup on unmount
    return (): void => {
      lineSeriesRef.current.forEach((series) => {
        try {
          chart.removeSeries(series);
        } catch {
          // Series might already be removed
        }
      });
      lineSeriesRef.current = [];
    };
  }, [chart, candleSeries, horizontal, diagonal]);

  // This component only manages chart overlays, doesn't render DOM
  return null;
}

/**
 * Export color constants for use in other components
 */
export { LINE_COLORS };
