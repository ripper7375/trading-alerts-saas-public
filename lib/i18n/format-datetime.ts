/**
 * Date and time formatting in the user's own timezone, date format and time
 * format (Settings → Language & Region).
 *
 * Framework-agnostic (no React, no `next/headers`) so the same functions run
 * in `LocaleProvider`'s `formatDate()`/`formatDateTime()`, in Server
 * Components (with `getServerLocalePreferences()`) and in chart axes.
 *
 * @module lib/i18n/format-datetime
 */

import type { LocalePreferences } from './locale-resolver';

export type DateTimePrefs = Pick<
  LocalePreferences,
  'timezone' | 'dateFormat' | 'timeFormat'
>;

type DateInput = number | string | Date;

function toDate(value: DateInput): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return isNaN(date.getTime()) ? null : date;
}

function zoneParts(
  date: Date,
  timeZone: string,
  options: Intl.DateTimeFormatOptions
): Record<string, string> {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat('en-GB', {
      ...options,
      timeZone,
    }).formatToParts(date);
  } catch {
    parts = new Intl.DateTimeFormat('en-GB', options).formatToParts(date);
  }
  return Object.fromEntries(parts.map((p) => [p.type, p.value]));
}

/** `25/12/2024`, `12/25/2024` or `2024-12-25`, in the user's timezone. */
export function formatDateInZone(
  value: DateInput,
  { timezone, dateFormat }: Pick<DateTimePrefs, 'timezone' | 'dateFormat'>
): string {
  const date = toDate(value);
  if (!date) return '--/--/----';
  const { day, month, year } = zoneParts(date, timezone, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  if (dateFormat === 'DMY') return `${day}/${month}/${year}`;
  if (dateFormat === 'YMD') return `${year}-${month}-${day}`;
  return `${month}/${day}/${year}`;
}

/** `14:30` or `2:30 PM` (optionally with seconds), in the user's timezone. */
export function formatTimeInZone(
  value: DateInput,
  { timezone, timeFormat }: Pick<DateTimePrefs, 'timezone' | 'timeFormat'>,
  { seconds = false }: { seconds?: boolean } = {}
): string {
  const date = toDate(value);
  if (!date) return seconds ? '--:--:--' : '--:--';
  const twelve = timeFormat === '12h';
  const { hour, minute, second, dayPeriod } = zoneParts(date, timezone, {
    hour: twelve ? 'numeric' : '2-digit',
    minute: '2-digit',
    ...(seconds && { second: '2-digit' }),
    hourCycle: twelve ? 'h12' : 'h23',
  });
  const time = seconds ? `${hour}:${minute}:${second}` : `${hour}:${minute}`;
  return twelve ? `${time} ${(dayPeriod ?? '').toUpperCase()}`.trim() : time;
}

/** Date and time together, e.g. `25/12/2024 14:30`. */
export function formatDateTimeInZone(
  value: DateInput,
  prefs: DateTimePrefs,
  options?: { seconds?: boolean }
): string {
  if (!toDate(value)) return '--';
  return `${formatDateInZone(value, prefs)} ${formatTimeInZone(value, prefs, options)}`;
}
