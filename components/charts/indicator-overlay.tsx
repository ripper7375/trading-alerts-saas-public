'use client';

import type {
  IChartApi,
  ISeriesApi,
  Time,
  LineWidth,
} from 'lightweight-charts';
import { useEffect, useRef } from 'react';

import type {
  ProIndicatorData,
  KeltnerChannelData,
} from '@/types/indicator';

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
  proIndicators?: ProIndicatorData;
  selectedIndicators?: string[];
  timeData?: Time[];
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
 * Color configuration for Keltner Channels
 */
const KELTNER_COLORS: Record<keyof KeltnerChannelData, string> = {
  ultraExtremeUpper: '#9C27B0',
  extremeUpper: '#AB47BC',
  upperMost: '#BA68C8',
  upper: '#CE93D8',
  upperMiddle: '#FF5722',
  lowerMiddle: '#FF7043',
  lower: '#CE93D8',
  lowerMost: '#BA68C8',
  extremeLower: '#AB47BC',
  ultraExtremeLower: '#9C27B0',
};

/**
 * Color configuration for Moving Averages
 */
const MA_COLORS = {
  tema: '#808080', // Gray
  hrma: '#00CED1', // Dark Cyan
  smma: '#0000FF', // Blue
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
  proIndicators,
  selectedIndicators = ['fractals', 'trendlines'],
  timeData = [],
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

    // Render horizontal lines (only if fractals is selected)
    if (horizontal && selectedIndicators.includes('fractals')) {
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

    // Render diagonal lines (only if trendlines is selected)
    if (diagonal && selectedIndicators.includes('trendlines')) {
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

    // ========================================
    // PRO INDICATORS
    // ========================================

    // Render Keltner Channels
    if (
      proIndicators?.keltnerChannels &&
      selectedIndicators.includes('keltner_channels') &&
      timeData.length > 0
    ) {
      const kc = proIndicators.keltnerChannels;
      (Object.keys(kc) as (keyof KeltnerChannelData)[]).forEach((band) => {
        const values = kc[band];
        if (!values || values.length === 0) return;

        try {
          const isMiddleBand = band.includes('Middle');
          const lineSeries = chart.addLineSeries({
            color: KELTNER_COLORS[band],
            lineWidth: isMiddleBand ? 3 : 2,
            lineStyle: 0, // Solid
            crosshairMarkerVisible: false,
            lastValueVisible: false,
            priceLineVisible: false,
          });

          const lineData = values
            .map((value, i) => ({
              time: timeData[i],
              value: value ?? undefined,
            }))
            .filter(
              (d): d is { time: Time; value: number } => d.value !== undefined
            );

          lineSeries.setData(lineData);
          lineSeriesRef.current.push(lineSeries);
        } catch (err) {
          console.error(`Failed to add Keltner Channel ${band}:`, err);
        }
      });
    }

    // Render TEMA
    if (
      proIndicators?.tema &&
      proIndicators.tema.length > 0 &&
      selectedIndicators.includes('tema') &&
      timeData.length > 0
    ) {
      try {
        const lineSeries = chart.addLineSeries({
          color: MA_COLORS.tema,
          lineWidth: 2,
          lineStyle: 0,
          crosshairMarkerVisible: false,
          lastValueVisible: true,
          priceLineVisible: false,
        });

        const lineData = proIndicators.tema
          .map((value, i) => ({
            time: timeData[i],
            value: value ?? undefined,
          }))
          .filter(
            (d): d is { time: Time; value: number } => d.value !== undefined
          );

        lineSeries.setData(lineData);
        lineSeriesRef.current.push(lineSeries);
      } catch (err) {
        console.error('Failed to add TEMA:', err);
      }
    }

    // Render HRMA
    if (
      proIndicators?.hrma &&
      proIndicators.hrma.length > 0 &&
      selectedIndicators.includes('hrma') &&
      timeData.length > 0
    ) {
      try {
        const lineSeries = chart.addLineSeries({
          color: MA_COLORS.hrma,
          lineWidth: 2,
          lineStyle: 0,
          crosshairMarkerVisible: false,
          lastValueVisible: true,
          priceLineVisible: false,
        });

        const lineData = proIndicators.hrma
          .map((value, i) => ({
            time: timeData[i],
            value: value ?? undefined,
          }))
          .filter(
            (d): d is { time: Time; value: number } => d.value !== undefined
          );

        lineSeries.setData(lineData);
        lineSeriesRef.current.push(lineSeries);
      } catch (err) {
        console.error('Failed to add HRMA:', err);
      }
    }

    // Render SMMA
    if (
      proIndicators?.smma &&
      proIndicators.smma.length > 0 &&
      selectedIndicators.includes('smma') &&
      timeData.length > 0
    ) {
      try {
        const lineSeries = chart.addLineSeries({
          color: MA_COLORS.smma,
          lineWidth: 2,
          lineStyle: 0,
          crosshairMarkerVisible: false,
          lastValueVisible: true,
          priceLineVisible: false,
        });

        const lineData = proIndicators.smma
          .map((value, i) => ({
            time: timeData[i],
            value: value ?? undefined,
          }))
          .filter(
            (d): d is { time: Time; value: number } => d.value !== undefined
          );

        lineSeries.setData(lineData);
        lineSeriesRef.current.push(lineSeries);
      } catch (err) {
        console.error('Failed to add SMMA:', err);
      }
    }

    // Render ZigZag
    if (
      proIndicators?.zigzag &&
      selectedIndicators.includes('zigzag') &&
      timeData.length > 0
    ) {
      const { peaks, bottoms } = proIndicators.zigzag;

      // Combine peaks and bottoms and sort by index to draw connected line
      const allPoints = [
        ...peaks.map((p) => ({ ...p, type: 'peak' as const })),
        ...bottoms.map((p) => ({ ...p, type: 'bottom' as const })),
      ].sort((a, b) => a.index - b.index);

      if (allPoints.length > 0) {
        try {
          // Draw zigzag line connecting all points
          const lineSeries = chart.addLineSeries({
            color: '#2196F3', // Blue zigzag line
            lineWidth: 2,
            lineStyle: 0,
            crosshairMarkerVisible: false,
            lastValueVisible: false,
            priceLineVisible: false,
          });

          const lineData = allPoints
            .filter((p) => p.index < timeData.length)
            .map((point) => ({
              time: timeData[point.index],
              value: point.price,
            }));

          lineSeries.setData(lineData);
          lineSeriesRef.current.push(lineSeries);
        } catch (err) {
          console.error('Failed to add ZigZag:', err);
        }
      }
    }

    // Note: Momentum Candles would need special handling
    // They modify candlestick colors based on classification
    // This would require modifying the candlestick series directly

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
  }, [chart, candleSeries, horizontal, diagonal, proIndicators, selectedIndicators, timeData]);

  // This component only manages chart overlays, doesn't render DOM
  return null;
}

/**
 * Export color constants for use in other components
 */
export { LINE_COLORS };
