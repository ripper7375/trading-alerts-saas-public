/**
 * Date-window helpers shared by the BI dashboard analytics layer.
 *
 * @module lib/admin/analytics/date-windows
 */

const MONTH_LABEL_FORMAT: Intl.DateTimeFormatOptions = {
  month: 'short',
  year: 'numeric',
};

/** UTC-safe "YYYY-MM" key for a given date's month. */
export function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** e.g. "Aug 2026" */
export function monthLabel(date: Date): string {
  return new Intl.DateTimeFormat('en-US', MONTH_LABEL_FORMAT).format(date);
}

/** 1-indexed calendar quarter (1-4) for a given date, UTC. */
export function quarterOf(date: Date): number {
  return Math.floor(date.getUTCMonth() / 3) + 1;
}

/** e.g. "2026-Q3" */
export function quarterKey(date: Date): string {
  return `${date.getUTCFullYear()}-Q${quarterOf(date)}`;
}

/** e.g. "Q3 2026" */
export function quarterLabel(date: Date): string {
  return `Q${quarterOf(date)} ${date.getUTCFullYear()}`;
}

/**
 * Null-safe percentage growth: returns `null` (not `0`) when there is no
 * prior-period baseline at all, so the UI can render "New -- no prior
 * data" instead of a misleading `+0.0%` on a fresh dataset. Returns `0`
 * only when the prior period genuinely exists and is exactly zero, guarded
 * to never divide by zero.
 */
export function growthPct(
  current: number,
  previous: number | null | undefined
): number | null {
  if (previous === null || previous === undefined) return null;
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
