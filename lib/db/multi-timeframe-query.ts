/**
 * Part 20 - Phase 06: Multi-Timeframe Query
 *
 * Query all 9 timeframes (117 indicators total) for confluence score calculation.
 * Handles timeframe alignment (e.g., H2 at 16:00, not 17:00).
 *
 * @see docs/sqlite-and-mt5service/part-20-architecture-design.md Section 9.3
 * @see docs/sqlite-and-mt5service/part-20-implementation-plan.md Phase 6
 */

import { query } from './postgresql';
import type { MultiTimeframeData, TimeframeData } from '@/lib/confluence/types';
import { VALID_TIMEFRAMES, type Timeframe } from '@/lib/constants/business-rules';

/**
 * Database row from PostgreSQL
 */
interface DBRow {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  fractals: unknown;
  horizontal_trendlines: unknown;
  diagonal_trendlines: unknown;
  momentum_candles: unknown;
  keltner_channels: unknown;
  tema: number | null;
  hrma: number | null;
  smma: number | null;
  zigzag: unknown;
}

/**
 * Get the closest valid timestamp for a timeframe
 *
 * Different timeframes align differently:
 * - M5: Minutes divisible by 5 (00, 05, 10, 15, ...)
 * - M15: Minutes divisible by 15 (00, 15, 30, 45)
 * - M30: Minutes divisible by 30 (00, 30)
 * - H1: On the hour (00 minutes)
 * - H2: Even hours (00:00, 02:00, 04:00, ...)
 * - H4: Hours divisible by 4 (00:00, 04:00, 08:00, ...)
 * - H8: Hours divisible by 8 (00:00, 08:00, 16:00)
 * - H12: Hours divisible by 12 (00:00, 12:00)
 * - D1: Midnight (00:00:00)
 *
 * @param timestamp - Target timestamp
 * @param timeframe - Timeframe to align to
 * @returns Aligned timestamp (closest but not after target)
 */
function getAlignedTimestamp(timestamp: Date, timeframe: Timeframe): Date {
  const aligned = new Date(timestamp);

  switch (timeframe) {
    case 'M5':
      // Round down to nearest 5 minutes
      aligned.setMinutes(Math.floor(aligned.getMinutes() / 5) * 5, 0, 0);
      break;

    case 'M15':
      // Round down to nearest 15 minutes
      aligned.setMinutes(Math.floor(aligned.getMinutes() / 15) * 15, 0, 0);
      break;

    case 'M30':
      // Round down to nearest 30 minutes
      aligned.setMinutes(Math.floor(aligned.getMinutes() / 30) * 30, 0, 0);
      break;

    case 'H1':
      // Round down to nearest hour
      aligned.setMinutes(0, 0, 0);
      break;

    case 'H2':
      // Round down to nearest even hour
      aligned.setHours(Math.floor(aligned.getHours() / 2) * 2, 0, 0, 0);
      break;

    case 'H4':
      // Round down to nearest 4-hour interval
      aligned.setHours(Math.floor(aligned.getHours() / 4) * 4, 0, 0, 0);
      break;

    case 'H8':
      // Round down to nearest 8-hour interval
      aligned.setHours(Math.floor(aligned.getHours() / 8) * 8, 0, 0, 0);
      break;

    case 'H12':
      // Round down to nearest 12-hour interval
      aligned.setHours(Math.floor(aligned.getHours() / 12) * 12, 0, 0, 0);
      break;

    case 'D1':
      // Round down to midnight
      aligned.setHours(0, 0, 0, 0);
      break;

    default:
      // Fallback: round down to nearest hour
      aligned.setMinutes(0, 0, 0);
  }

  return aligned;
}

/**
 * Transform database row to TimeframeData
 */
function transformDBRow(row: DBRow | null): TimeframeData | null {
  if (!row) return null;

  return {
    ohlc: {
      time: Math.floor(row.timestamp.getTime() / 1000), // Convert to Unix timestamp
      open: row.open,
      high: row.high,
      low: row.low,
      close: row.close,
    },
    fractals: row.fractals as unknown,
    horizontal_trendlines: row.horizontal_trendlines as unknown,
    diagonal_trendlines: row.diagonal_trendlines as unknown,
    momentum_candles: (row.momentum_candles as unknown) || [],
    keltner_channels: (row.keltner_channels as unknown) || {
      ultra_extreme_upper: [],
      extreme_upper: [],
      upper_most: [],
      upper: [],
      upper_middle: [],
      lower_middle: [],
      lower: [],
      lower_most: [],
      extreme_lower: [],
      ultra_extreme_lower: [],
    },
    tema: row.tema,
    hrma: row.hrma,
    smma: row.smma,
    zigzag: (row.zigzag as unknown) || { peaks: [], bottoms: [] },
  };
}

/**
 * Query data for a single timeframe at a specific timestamp
 *
 * @param symbol - Trading symbol (uppercase)
 * @param timeframe - Timeframe to query
 * @param timestamp - Target timestamp
 * @returns Timeframe data or null if not found
 */
async function queryTimeframe(
  symbol: string,
  timeframe: Timeframe,
  timestamp: Date
): Promise<TimeframeData | null> {
  const tableName = `${symbol.toLowerCase()}_${timeframe.toLowerCase()}`;
  const alignedTimestamp = getAlignedTimestamp(timestamp, timeframe);

  try {
    // Query for the row closest to (but not after) the aligned timestamp
    const rows = await query<DBRow>(
      `
      SELECT
        timestamp,
        open,
        high,
        low,
        close,
        fractals,
        horizontal_trendlines,
        diagonal_trendlines,
        momentum_candles,
        keltner_channels,
        tema,
        hrma,
        smma,
        zigzag
      FROM ${tableName}
      WHERE timestamp <= $1
      ORDER BY timestamp DESC
      LIMIT 1
    `,
      [alignedTimestamp.toISOString()]
    );

    if (rows.length === 0) {
      console.warn(
        `[MultiTimeframeQuery] No data found for ${symbol} ${timeframe} at ${alignedTimestamp.toISOString()}`
      );
      return null;
    }

    return transformDBRow(rows[0] ?? null);
  } catch (error) {
    console.error(
      `[MultiTimeframeQuery] Error querying ${symbol} ${timeframe}:`,
      error
    );
    return null;
  }
}

/**
 * Get multi-timeframe data for confluence calculation
 *
 * Queries all 9 timeframes in parallel for maximum performance.
 * Handles timeframe alignment automatically.
 *
 * @param symbol - Trading symbol (e.g., 'EURUSD')
 * @param timestamp - Target timestamp (ISO 8601 string or Date)
 * @returns Multi-timeframe data containing 117 indicators
 *
 * @example
 * const data = await getMultiTimeframeData('EURUSD', '2026-01-03T17:00:00Z');
 * // Returns data for all 9 timeframes at 17:00:00 (or closest available)
 */
export async function getMultiTimeframeData(
  symbol: string,
  timestamp: string | Date
): Promise<MultiTimeframeData> {
  const targetTimestamp =
    typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  const upperSymbol = symbol.toUpperCase();

  // Query all timeframes in parallel for performance
  const results = await Promise.all(
    VALID_TIMEFRAMES.map((timeframe) =>
      queryTimeframe(upperSymbol, timeframe, targetTimestamp)
    )
  );

  // Build multi-timeframe data object
  const multiTfData: MultiTimeframeData = {
    M5: results[0] ?? null,
    M15: results[1] ?? null,
    M30: results[2] ?? null,
    H1: results[3] ?? null,
    H2: results[4] ?? null,
    H4: results[5] ?? null,
    H8: results[6] ?? null,
    H12: results[7] ?? null,
    D1: results[8] ?? null,
  };

  return multiTfData;
}

/**
 * Get latest multi-timeframe data (uses current time)
 *
 * @param symbol - Trading symbol
 * @returns Multi-timeframe data for current time
 */
export async function getLatestMultiTimeframeData(
  symbol: string
): Promise<MultiTimeframeData> {
  return getMultiTimeframeData(symbol, new Date());
}
