'use client';

/**
 * Chart time-axis labels in the user's timezone, date format and time format.
 *
 * lightweight-charts treats every timestamp as UTC and prints it that way, so
 * without this a London user whose timezone is Asia/Bangkok read 7-hour-old
 * times on every axis and crosshair. Only the labels change; the data and the
 * tick positions stay in UTC, so drawings, markers and alerts are unaffected.
 *
 * @module components/charts/use-chart-time-options
 */

import { useEffect, useMemo, useRef } from 'react';
import type { IChartApi, Time, TickMarkType } from 'lightweight-charts';

import { useLocale } from '@/lib/context/locale-context';
import {
  formatDateInZone,
  formatTimeInZone,
  type DateTimePrefs,
} from '@/lib/i18n/format-datetime';

// TickMarkType values, used as numbers so tests that mock lightweight-charts
// do not need the enum.
const YEAR = 0;
const MONTH = 1;
const DAY_OF_MONTH = 2;
const TIME = 3;
const TIME_WITH_SECONDS = 4;

type ChartTimePrefs = DateTimePrefs & { language: string };

export interface ChartTimeOptions {
  localization: { timeFormatter: (time: Time) => string };
  timeScale: {
    tickMarkFormatter: (time: Time, tickMarkType: TickMarkType) => string;
  };
}

/** Milliseconds for a chart time, or null for date-only times. */
function timeToMs(time: Time): number | null {
  return typeof time === 'number' ? time * 1000 : null;
}

function dateOnlyLabel(time: Time): string {
  if (typeof time === 'string') return time;
  if (typeof time === 'object') {
    return `${time.year}-${String(time.month).padStart(2, '0')}-${String(time.day).padStart(2, '0')}`;
  }
  return String(time);
}

function zonePart(
  ms: number,
  prefs: ChartTimePrefs,
  options: Intl.DateTimeFormatOptions
): string {
  try {
    return new Intl.DateTimeFormat(prefs.language || 'en-GB', {
      ...options,
      timeZone: prefs.timezone,
    }).format(ms);
  } catch {
    return new Intl.DateTimeFormat('en-GB', options).format(ms);
  }
}

export function chartTimeOptions(prefs: ChartTimePrefs): ChartTimeOptions {
  return {
    // Crosshair label: full date and time.
    localization: {
      timeFormatter: (time) => {
        const ms = timeToMs(time);
        if (ms === null) return dateOnlyLabel(time);
        return `${formatDateInZone(ms, prefs)} ${formatTimeInZone(ms, prefs)}`;
      },
    },
    timeScale: {
      tickMarkFormatter: (time, tickMarkType) => {
        const ms = timeToMs(time);
        if (ms === null) return dateOnlyLabel(time);
        switch (tickMarkType as number) {
          case YEAR:
            return zonePart(ms, prefs, { year: 'numeric' });
          case MONTH:
            return zonePart(ms, prefs, { month: 'short' });
          case DAY_OF_MONTH:
            return zonePart(ms, prefs, { day: 'numeric' });
          case TIME_WITH_SECONDS:
            return formatTimeInZone(ms, prefs, { seconds: true });
          case TIME:
          default:
            return formatTimeInZone(ms, prefs);
        }
      },
    },
  };
}

/**
 * Applies the user's time labels to a chart and keeps them current. Call
 * `applyTo(chart)` right after `createChart()`; later changes to the
 * timezone or formats are pushed to `chartRef.current` automatically.
 */
export function useChartTimeOptions(chartRef: { current: IChartApi | null }): {
  applyTo: (chart: IChartApi) => void;
} {
  const { timezone, dateFormat, timeFormat, language } = useLocale();
  const options = useMemo(
    () => chartTimeOptions({ timezone, dateFormat, timeFormat, language }),
    [timezone, dateFormat, timeFormat, language]
  );
  const latest = useRef(options);

  useEffect(() => {
    latest.current = options;
    chartRef.current?.applyOptions(options);
  }, [options, chartRef]);

  return useMemo(
    () => ({
      applyTo: (chart: IChartApi) => chart.applyOptions(latest.current),
    }),
    []
  );
}
