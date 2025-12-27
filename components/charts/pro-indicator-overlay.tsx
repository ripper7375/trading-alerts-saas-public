'use client';

import type { IChartApi, ISeriesApi, LineData, Time } from 'lightweight-charts';
import { useEffect, useRef } from 'react';

import {
  KELTNER_COLORS,
  MA_COLORS,
  ZIGZAG_COLORS,
  type IndicatorId,
} from '@/lib/tier/constants';
import type { KeltnerChannelData, ProIndicatorData } from '@/types/indicator';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface ProIndicatorOverlayProps {
  chart: IChartApi | null;
  proData: ProIndicatorData | null;
  selectedIndicators: IndicatorId[];
  timeData: Time[]; // MUST be valid Time[] with no undefined
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMPONENT
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * ProIndicatorOverlay Component
 *
 * Renders PRO-only indicators on the trading chart:
 * - Keltner Channels (10-band ATR system)
 * - TEMA (Triple Exponential Moving Average)
 * - HRMA (Hull-like Responsive Moving Average)
 * - SMMA (Smoothed Moving Average)
 * - ZigZag (Peak/Bottom structure detection)
 *
 * All data must be transformed to use undefined (not null) before
 * passing to this component.
 */
export function ProIndicatorOverlay({
  chart,
  proData,
  selectedIndicators,
  timeData,
}: ProIndicatorOverlayProps): null {
  // Store series references for cleanup
  const seriesRefs = useRef<Map<string, ISeriesApi<'Line'>>>(new Map());

  useEffect(() => {
    if (!chart || !proData || timeData.length === 0) return;

    // Copy ref to local variable for cleanup function
    const currentSeriesRefs = seriesRefs.current;

    // Clean up existing series
    currentSeriesRefs.forEach((series) => {
      try {
        chart.removeSeries(series);
      } catch {
        // Series already removed
      }
    });
    currentSeriesRefs.clear();

    //───────────────────────────────────────────────────────
    // Render Keltner Channels
    //───────────────────────────────────────────────────────
    if (
      selectedIndicators.includes('keltner_channels') &&
      proData.keltnerChannels
    ) {
      const kc = proData.keltnerChannels;

      (Object.keys(kc) as (keyof KeltnerChannelData)[]).forEach((band) => {
        const values = kc[band];
        if (!values || values.length === 0) return;

        try {
          const series = chart.addLineSeries({
            color: KELTNER_COLORS[band],
            lineWidth: band.includes('Middle') ? 3 : 2,
            priceLineVisible: false,
            lastValueVisible: false,
            crosshairMarkerVisible: false,
          });

          // CRITICAL: Filter out undefined values AND ensure time exists
          const lineData: LineData<Time>[] = values
            .map((value, i) => ({
              time: timeData[i],
              value: value,
            }))
            .filter(
              (d): d is LineData<Time> =>
                d.time !== undefined && d.value !== undefined && !isNaN(d.value)
            );

          if (lineData.length > 0) {
            series.setData(lineData);
            currentSeriesRefs.set(`keltner_${band}`, series);
          } else {
            chart.removeSeries(series);
          }
        } catch (err) {
          console.error(`Failed to render Keltner band ${band}:`, err);
        }
      });
    }

    //───────────────────────────────────────────────────────
    // Render Moving Averages (TEMA, HRMA, SMMA)
    //───────────────────────────────────────────────────────
    const renderMA = (
      id: IndicatorId,
      data: (number | undefined)[],
      color: string
    ): void => {
      if (!selectedIndicators.includes(id) || data.length === 0) return;

      try {
        const series = chart.addLineSeries({
          color,
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: true,
          crosshairMarkerVisible: true,
        });

        const lineData: LineData<Time>[] = data
          .map((value, i) => ({
            time: timeData[i],
            value: value,
          }))
          .filter(
            (d): d is LineData<Time> =>
              d.time !== undefined && d.value !== undefined && !isNaN(d.value)
          );

        if (lineData.length > 0) {
          series.setData(lineData);
          currentSeriesRefs.set(id, series);
        } else {
          chart.removeSeries(series);
        }
      } catch (err) {
        console.error(`Failed to render ${id}:`, err);
      }
    };

    renderMA('tema', proData.tema, MA_COLORS.tema);
    renderMA('hrma', proData.hrma, MA_COLORS.hrma);
    renderMA('smma', proData.smma, MA_COLORS.smma);

    //───────────────────────────────────────────────────────
    // Render ZigZag
    //───────────────────────────────────────────────────────
    if (selectedIndicators.includes('zigzag') && proData.zigzag) {
      const { peaks, bottoms } = proData.zigzag;

      // Combine peaks and bottoms, sort by index for line
      const allPoints = [
        ...peaks.map((p) => ({ ...p, type: 'peak' as const })),
        ...bottoms.map((p) => ({ ...p, type: 'bottom' as const })),
      ].sort((a, b) => a.index - b.index);

      if (allPoints.length > 1) {
        try {
          // ZigZag line connecting peaks and bottoms
          const zigzagSeries = chart.addLineSeries({
            color: ZIGZAG_COLORS.line,
            lineWidth: 2,
            priceLineVisible: false,
            lastValueVisible: false,
            crosshairMarkerVisible: false,
          });

          const lineData: LineData<Time>[] = allPoints.reduce<LineData<Time>[]>(
            (arr, p) => {
              const t = timeData[p.index];
              if (t !== undefined) {
                arr.push({ time: t, value: p.price });
              }
              return arr;
            },
            []
          );

          if (lineData.length > 0) {
            zigzagSeries.setData(lineData);
            currentSeriesRefs.set('zigzag_line', zigzagSeries);
          } else {
            chart.removeSeries(zigzagSeries);
          }
        } catch (err) {
          console.error('Failed to render ZigZag line:', err);
        }
      }

      // Render peak markers
      if (peaks.length > 0) {
        try {
          const peakSeries = chart.addLineSeries({
            color: ZIGZAG_COLORS.peaks,
            lineWidth: 1,
            lineVisible: false,
            crosshairMarkerVisible: true,
            crosshairMarkerRadius: 6,
            priceLineVisible: false,
            lastValueVisible: false,
          });

          const peakData: LineData<Time>[] = peaks.reduce<LineData<Time>[]>(
            (arr, p) => {
              const t = timeData[p.index];
              if (t !== undefined) {
                arr.push({ time: t, value: p.price });
              }
              return arr;
            },
            []
          );

          if (peakData.length > 0) {
            peakSeries.setData(peakData);
            currentSeriesRefs.set('zigzag_peaks', peakSeries);
          } else {
            chart.removeSeries(peakSeries);
          }
        } catch (err) {
          console.error('Failed to render ZigZag peaks:', err);
        }
      }

      // Render bottom markers
      if (bottoms.length > 0) {
        try {
          const bottomSeries = chart.addLineSeries({
            color: ZIGZAG_COLORS.bottoms,
            lineWidth: 1,
            lineVisible: false,
            crosshairMarkerVisible: true,
            crosshairMarkerRadius: 6,
            priceLineVisible: false,
            lastValueVisible: false,
          });

          const bottomData: LineData<Time>[] = bottoms.reduce<LineData<Time>[]>(
            (arr, p) => {
              const t = timeData[p.index];
              if (t !== undefined) {
                arr.push({ time: t, value: p.price });
              }
              return arr;
            },
            []
          );

          if (bottomData.length > 0) {
            bottomSeries.setData(bottomData);
            currentSeriesRefs.set('zigzag_bottoms', bottomSeries);
          } else {
            chart.removeSeries(bottomSeries);
          }
        } catch (err) {
          console.error('Failed to render ZigZag bottoms:', err);
        }
      }
    }

    // Note: Momentum Candles are rendered by modifying candle colors,
    // which would be done in the main chart component, not here.

    // Cleanup on unmount
    return (): void => {
      currentSeriesRefs.forEach((series) => {
        try {
          chart.removeSeries(series);
        } catch {
          // Ignore
        }
      });
      currentSeriesRefs.clear();
    };
  }, [chart, proData, selectedIndicators, timeData]);

  // This component only manages chart overlays, doesn't render DOM
  return null;
}

/**
 * Export for use in parent components
 */
export type { ProIndicatorOverlayProps };
