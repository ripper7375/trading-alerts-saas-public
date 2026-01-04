/**
 * Database Query Functions
 *
 * Part 20 - Phase 04: Next.js API Routes
 * Query functions for retrieving indicator data from PostgreSQL.
 *
 * @module lib/db/queries
 */

import type {
  DiagonalTrendlines,
  Fractals,
  HorizontalTrendlines,
  IndicatorData,
  KeltnerChannels,
  MomentumCandle,
  OHLCBar,
  ZigZag,
} from '@/lib/indicators/types';

import { query } from './postgresql';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPE DEFINITIONS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Raw row from PostgreSQL indicator table
 */
interface IndicatorRow {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  fractals_peaks: string | null;
  fractals_bottoms: string | null;
  horizontal_peak_1: string | null;
  horizontal_peak_2: string | null;
  horizontal_peak_3: string | null;
  horizontal_bottom_1: string | null;
  horizontal_bottom_2: string | null;
  horizontal_bottom_3: string | null;
  diagonal_ascending_1: string | null;
  diagonal_ascending_2: string | null;
  diagonal_ascending_3: string | null;
  diagonal_descending_1: string | null;
  diagonal_descending_2: string | null;
  diagonal_descending_3: string | null;
  momentum_candles: string | null;
  keltner_ultra_extreme_upper: number | null;
  keltner_extreme_upper: number | null;
  keltner_upper_most: number | null;
  keltner_upper: number | null;
  keltner_upper_middle: number | null;
  keltner_lower_middle: number | null;
  keltner_lower: number | null;
  keltner_lower_most: number | null;
  keltner_extreme_lower: number | null;
  keltner_ultra_extreme_lower: number | null;
  tema: number | null;
  hrma: number | null;
  smma: number | null;
  zigzag_peaks: string | null;
  zigzag_bottoms: string | null;
}

/**
 * Data freshness result
 */
export interface DataFreshness {
  last_sync: Date | null;
  rows_count: number;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HELPER FUNCTIONS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Get table name for symbol and timeframe
 * Format: {symbol_lowercase}_{timeframe_lowercase}
 */
function getTableName(symbol: string, timeframe: string): string {
  return `${symbol.toLowerCase()}_${timeframe.toLowerCase()}`;
}

/**
 * Safely parse JSON string to array, returning empty array on failure
 */
function safeParseJson<T>(jsonStr: string | null): T[] {
  if (!jsonStr) return [];
  try {
    const parsed = JSON.parse(jsonStr);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN QUERY FUNCTIONS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Get indicator data for a symbol and timeframe
 *
 * @param symbol - Trading symbol (e.g., 'EURUSD')
 * @param timeframe - Timeframe (e.g., 'H1')
 * @param limit - Maximum number of rows to return (default 1000, max 10000)
 * @returns IndicatorData object with all indicators
 */
export async function getIndicatorData(
  symbol: string,
  timeframe: string,
  limit: number = 1000
): Promise<IndicatorData> {
  const tableName = getTableName(symbol, timeframe);
  const safeLimit = Math.min(Math.max(limit, 1), 10000);

  // Query the most recent rows
  const sql = `
    SELECT
      timestamp,
      open,
      high,
      low,
      close,
      fractals_peaks,
      fractals_bottoms,
      horizontal_peak_1,
      horizontal_peak_2,
      horizontal_peak_3,
      horizontal_bottom_1,
      horizontal_bottom_2,
      horizontal_bottom_3,
      diagonal_ascending_1,
      diagonal_ascending_2,
      diagonal_ascending_3,
      diagonal_descending_1,
      diagonal_descending_2,
      diagonal_descending_3,
      momentum_candles,
      keltner_ultra_extreme_upper,
      keltner_extreme_upper,
      keltner_upper_most,
      keltner_upper,
      keltner_upper_middle,
      keltner_lower_middle,
      keltner_lower,
      keltner_lower_most,
      keltner_extreme_lower,
      keltner_ultra_extreme_lower,
      tema,
      hrma,
      smma,
      zigzag_peaks,
      zigzag_bottoms
    FROM "${tableName}"
    ORDER BY timestamp DESC
    LIMIT $1
  `;

  const rows = await query<IndicatorRow>(sql, [safeLimit]);

  // Reverse to get chronological order (oldest first)
  rows.reverse();

  // Transform rows to IndicatorData format
  return transformRowsToIndicatorData(rows);
}

/**
 * Transform database rows to IndicatorData format
 */
function transformRowsToIndicatorData(rows: IndicatorRow[]): IndicatorData {
  // Initialize empty arrays
  const ohlc: OHLCBar[] = [];
  const tema: (number | null)[] = [];
  const hrma: (number | null)[] = [];
  const smma: (number | null)[] = [];

  // Keltner channels arrays
  const keltnerChannels: KeltnerChannels = {
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
  };

  // Process each row
  for (const row of rows) {
    // OHLC data
    ohlc.push({
      time: row.timestamp,
      open: row.open,
      high: row.high,
      low: row.low,
      close: row.close,
    });

    // Moving averages
    tema.push(row.tema);
    hrma.push(row.hrma);
    smma.push(row.smma);

    // Keltner channels
    keltnerChannels.ultra_extreme_upper?.push(row.keltner_ultra_extreme_upper);
    keltnerChannels.extreme_upper?.push(row.keltner_extreme_upper);
    keltnerChannels.upper_most?.push(row.keltner_upper_most);
    keltnerChannels.upper?.push(row.keltner_upper);
    keltnerChannels.upper_middle?.push(row.keltner_upper_middle);
    keltnerChannels.lower_middle?.push(row.keltner_lower_middle);
    keltnerChannels.lower?.push(row.keltner_lower);
    keltnerChannels.lower_most?.push(row.keltner_lower_most);
    keltnerChannels.extreme_lower?.push(row.keltner_extreme_lower);
    keltnerChannels.ultra_extreme_lower?.push(row.keltner_ultra_extreme_lower);
  }

  // Get latest row for dynamic indicators (only latest values are meaningful)
  const latestRow = rows[rows.length - 1];

  // Parse fractals from latest row
  const fractals: Fractals = {
    peaks: latestRow ? safeParseJson(latestRow.fractals_peaks) : [],
    bottoms: latestRow ? safeParseJson(latestRow.fractals_bottoms) : [],
  };

  // Parse horizontal trendlines from latest row
  const horizontalTrendlines: HorizontalTrendlines = {
    peak_1: latestRow ? safeParseJson(latestRow.horizontal_peak_1) : [],
    peak_2: latestRow ? safeParseJson(latestRow.horizontal_peak_2) : [],
    peak_3: latestRow ? safeParseJson(latestRow.horizontal_peak_3) : [],
    bottom_1: latestRow ? safeParseJson(latestRow.horizontal_bottom_1) : [],
    bottom_2: latestRow ? safeParseJson(latestRow.horizontal_bottom_2) : [],
    bottom_3: latestRow ? safeParseJson(latestRow.horizontal_bottom_3) : [],
  };

  // Parse diagonal trendlines from latest row
  const diagonalTrendlines: DiagonalTrendlines = {
    ascending_1: latestRow ? safeParseJson(latestRow.diagonal_ascending_1) : [],
    ascending_2: latestRow ? safeParseJson(latestRow.diagonal_ascending_2) : [],
    ascending_3: latestRow ? safeParseJson(latestRow.diagonal_ascending_3) : [],
    descending_1: latestRow
      ? safeParseJson(latestRow.diagonal_descending_1)
      : [],
    descending_2: latestRow
      ? safeParseJson(latestRow.diagonal_descending_2)
      : [],
    descending_3: latestRow
      ? safeParseJson(latestRow.diagonal_descending_3)
      : [],
  };

  // Parse momentum candles from latest row
  const momentumCandles: MomentumCandle[] = latestRow
    ? safeParseJson(latestRow.momentum_candles)
    : [];

  // Parse zigzag from latest row
  const zigzag: ZigZag = {
    peaks: latestRow ? safeParseJson(latestRow.zigzag_peaks) : [],
    bottoms: latestRow ? safeParseJson(latestRow.zigzag_bottoms) : [],
  };

  return {
    ohlc,
    fractals,
    horizontal_trendlines: horizontalTrendlines,
    diagonal_trendlines: diagonalTrendlines,
    momentum_candles: momentumCandles,
    keltner_channels: keltnerChannels,
    tema,
    hrma,
    smma,
    zigzag,
  };
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DATA FRESHNESS QUERIES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Get data freshness for a symbol and timeframe
 *
 * @param symbol - Trading symbol
 * @param timeframe - Timeframe
 * @returns Last sync timestamp and row count
 */
export async function getDataFreshness(
  symbol: string,
  timeframe: string
): Promise<DataFreshness> {
  const tableName = getTableName(symbol, timeframe);

  try {
    const sql = `
      SELECT
        MAX(to_timestamp(timestamp)) as last_sync,
        COUNT(*) as rows_count
      FROM "${tableName}"
    `;

    const result = await query<{
      last_sync: Date | null;
      rows_count: string;
    }>(sql);

    return {
      last_sync: result[0]?.last_sync || null,
      rows_count: parseInt(result[0]?.rows_count || '0', 10),
    };
  } catch {
    return {
      last_sync: null,
      rows_count: 0,
    };
  }
}

/**
 * Get row count for a symbol and timeframe table
 *
 * @param symbol - Trading symbol
 * @param timeframe - Timeframe
 * @returns Number of rows in table
 */
export async function getTableRowCount(
  symbol: string,
  timeframe: string
): Promise<number> {
  const tableName = getTableName(symbol, timeframe);

  try {
    const sql = `SELECT COUNT(*) as count FROM "${tableName}"`;
    const result = await query<{ count: string }>(sql);
    return parseInt(result[0]?.count || '0', 10);
  } catch {
    return 0;
  }
}

/**
 * Check if a table exists
 *
 * @param symbol - Trading symbol
 * @param timeframe - Timeframe
 * @returns True if table exists
 */
export async function tableExists(
  symbol: string,
  timeframe: string
): Promise<boolean> {
  const tableName = getTableName(symbol, timeframe);

  try {
    const sql = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = $1
      ) as exists
    `;

    const result = await query<{ exists: boolean }>(sql, [tableName]);
    return result[0]?.exists || false;
  } catch {
    return false;
  }
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// UTILITY QUERIES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Get timestamp range for a symbol and timeframe
 *
 * @param symbol - Trading symbol
 * @param timeframe - Timeframe
 * @returns Object with oldest and newest timestamps
 */
export async function getTimestampRange(
  symbol: string,
  timeframe: string
): Promise<{ oldest: number | null; newest: number | null }> {
  const tableName = getTableName(symbol, timeframe);

  try {
    const sql = `
      SELECT
        MIN(timestamp) as oldest,
        MAX(timestamp) as newest
      FROM "${tableName}"
    `;

    const result = await query<{ oldest: number | null; newest: number | null }>(
      sql
    );

    return {
      oldest: result[0]?.oldest || null,
      newest: result[0]?.newest || null,
    };
  } catch {
    return { oldest: null, newest: null };
  }
}

/**
 * Get list of all indicator tables
 *
 * @returns Array of table names
 */
export async function getIndicatorTables(): Promise<string[]> {
  try {
    const sql = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name LIKE '%_%'
      ORDER BY table_name
    `;

    const result = await query<{ table_name: string }>(sql);
    return result.map((row) => row.table_name);
  } catch {
    return [];
  }
}
