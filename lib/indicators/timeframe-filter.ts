/**
 * Part 20 - Timeframe Filter Utility
 *
 * Filters indicator data rows based on timeframe boundaries.
 * Used by the sync script and API to categorize data into appropriate timeframes.
 *
 * @see docs/sqlite-and-mt5service/part-20-architecture-design.md Section 4.3
 */

/**
 * Timeframe divisors in minutes
 *
 * - M5: timestamps at 5-minute boundaries
 * - M15: timestamps at 15-minute boundaries
 * - M30: timestamps at 30-minute boundaries
 * - H1: timestamps on the hour
 * - H2: timestamps on even hours
 * - H4: timestamps on hours divisible by 4
 * - H8: timestamps on hours divisible by 8
 * - H12: timestamps on hours divisible by 12
 * - D1: timestamps at midnight only
 */
export const TIMEFRAME_DIVISORS: Record<string, number> = {
  M5: 5, // Minutes divisible by 5
  M15: 15, // Minutes divisible by 15
  M30: 30, // Minutes divisible by 30
  H1: 60, // On the hour (60 minutes)
  H2: 120, // Even hours (120 minutes)
  H4: 240, // Hours divisible by 4 (240 minutes)
  H8: 480, // Hours divisible by 8 (480 minutes)
  H12: 720, // Hours divisible by 12 (720 minutes)
  D1: 1440, // Midnight only (1440 minutes = 1 day)
};

/**
 * Valid timeframes
 */
export const VALID_TIMEFRAMES = [
  'M5',
  'M15',
  'M30',
  'H1',
  'H2',
  'H4',
  'H8',
  'H12',
  'D1',
] as const;

export type Timeframe = (typeof VALID_TIMEFRAMES)[number];

/**
 * Generic row interface for filtering
 */
export interface FilterableRow {
  timestamp: number; // Unix timestamp in seconds
  [key: string]: unknown;
}

/**
 * Filter rows based on timeframe boundaries
 *
 * @param rows - Array of rows with timestamp field (Unix timestamp in seconds)
 * @param timeframe - Target timeframe (M5, M15, M30, H1, H2, H4, H8, H12, D1)
 * @returns Filtered rows matching the timeframe boundaries
 *
 * @example
 * const rows = [
 *   { timestamp: 1704067200, ... }, // 00:00
 *   { timestamp: 1704067500, ... }, // 00:05
 *   { timestamp: 1704067800, ... }, // 00:10
 * ];
 *
 * filterByTimeframe(rows, 'M5');  // Returns all rows (all on 5-min boundaries)
 * filterByTimeframe(rows, 'M15'); // Returns [{ timestamp: 1704067200 }] (only 00:00 and 00:15, etc.)
 */
export function filterByTimeframe<T extends FilterableRow>(
  rows: T[],
  timeframe: string
): T[] {
  const upperTimeframe = timeframe.toUpperCase();
  const divisor = TIMEFRAME_DIVISORS[upperTimeframe];

  if (divisor === undefined) {
    console.warn(`[TimeframeFilter] Unknown timeframe: ${timeframe}`);
    return [];
  }

  return rows.filter((row) => {
    const timestamp = row.timestamp;
    const date = new Date(timestamp * 1000); // Convert to milliseconds

    // Get hours and minutes in UTC
    const hours = date.getUTCHours();
    const minutes = date.getUTCMinutes();
    const seconds = date.getUTCSeconds();

    // Calculate minutes since midnight
    const minutesSinceMidnight = hours * 60 + minutes;

    // Handle D1 (Daily): must be exactly midnight
    if (upperTimeframe === 'D1') {
      return hours === 0 && minutes === 0 && seconds === 0;
    }

    // Handle hourly timeframes (H1, H2, H4, H8, H12)
    if (upperTimeframe.startsWith('H')) {
      // Minute and seconds must be 0
      if (minutes !== 0 || seconds !== 0) {
        return false;
      }
      // Check if hours align with divisor
      return minutesSinceMidnight % divisor === 0;
    }

    // Handle minute timeframes (M5, M15, M30)
    // Seconds should be 0 and minutes should be divisible
    if (seconds !== 0) {
      return false;
    }
    return minutes % divisor === 0;
  });
}

/**
 * Check if a timestamp matches a timeframe boundary
 *
 * @param timestamp - Unix timestamp in seconds
 * @param timeframe - Target timeframe
 * @returns true if timestamp matches the timeframe boundary
 */
export function isTimeframeBoundary(
  timestamp: number,
  timeframe: string
): boolean {
  const row = { timestamp } as FilterableRow;
  const result = filterByTimeframe([row], timeframe);
  return result.length > 0;
}

/**
 * Get the latest valid timestamp for a timeframe
 *
 * @param timeframe - Target timeframe
 * @param referenceTime - Reference time (defaults to now)
 * @returns Unix timestamp aligned to the timeframe
 */
export function getLatestTimeframeTimestamp(
  timeframe: string,
  referenceTime?: Date
): number {
  const now = referenceTime || new Date();
  const upperTimeframe = timeframe.toUpperCase();
  const divisor = TIMEFRAME_DIVISORS[upperTimeframe];

  if (divisor === undefined) {
    throw new Error(`Unknown timeframe: ${timeframe}`);
  }

  // Start with a copy of the reference time
  const aligned = new Date(now);

  // Zero out seconds and milliseconds
  aligned.setUTCSeconds(0, 0);

  if (upperTimeframe === 'D1') {
    // Daily: align to midnight
    aligned.setUTCHours(0, 0, 0, 0);
  } else if (upperTimeframe.startsWith('H')) {
    // Hourly: align to hour boundary
    aligned.setUTCMinutes(0, 0, 0);
    const hours = aligned.getUTCHours();
    const hoursMultiple = divisor / 60;
    const alignedHour = Math.floor(hours / hoursMultiple) * hoursMultiple;
    aligned.setUTCHours(alignedHour);
  } else {
    // Minute: align to minute boundary
    const minutes = aligned.getUTCMinutes();
    const alignedMinute = Math.floor(minutes / divisor) * divisor;
    aligned.setUTCMinutes(alignedMinute);
  }

  return Math.floor(aligned.getTime() / 1000);
}

/**
 * Get the next timeframe boundary timestamp
 *
 * @param timeframe - Target timeframe
 * @param referenceTime - Reference time (defaults to now)
 * @returns Unix timestamp of the next boundary
 */
export function getNextTimeframeBoundary(
  timeframe: string,
  referenceTime?: Date
): number {
  const current = getLatestTimeframeTimestamp(timeframe, referenceTime);
  const divisor = TIMEFRAME_DIVISORS[timeframe.toUpperCase()];

  // Add the divisor in seconds
  return current + divisor * 60;
}

/**
 * Get the number of bars expected between two timestamps for a timeframe
 *
 * @param startTimestamp - Start Unix timestamp
 * @param endTimestamp - End Unix timestamp
 * @param timeframe - Target timeframe
 * @returns Expected number of bars
 */
export function getExpectedBarCount(
  startTimestamp: number,
  endTimestamp: number,
  timeframe: string
): number {
  const divisor = TIMEFRAME_DIVISORS[timeframe.toUpperCase()];

  if (!divisor) {
    return 0;
  }

  const diffSeconds = endTimestamp - startTimestamp;
  const divisorSeconds = divisor * 60;

  return Math.floor(diffSeconds / divisorSeconds) + 1;
}
