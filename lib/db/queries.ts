/**
 * Database Query Functions for Part 20 SQLite + PostgreSQL Architecture
 *
 * Provides typed query functions for retrieving indicator data
 * from PostgreSQL. Tables follow naming convention: {symbol}_{timeframe}
 *
 * @module lib/db/queries
 */

import { query } from './postgresql';
import type {
  IndicatorData,
  OHLCBar,
  Fractals,
  HorizontalTrendlines,
  DiagonalTrendlines,
  MomentumCandle,
  KeltnerChannels,
  ZigZag,
} from '@/lib/indicators/types';

/**
 * Raw row type from PostgreSQL query
 */
interface RawIndicatorRow {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  fractals: Fractals | null;
  horizontal_trendlines: HorizontalTrendlines | null;
  diagonal_trendlines: DiagonalTrendlines | null;
  momentum_candles: MomentumCandle[] | null;
  keltner_channels: KeltnerChannels | null;
  tema: number | null;
  hrma: number | null;
  smma: number | null;
  zigzag: ZigZag | null;
}

/**
 * Get indicator data for a symbol and timeframe
 *
 * @param symbol - Trading symbol (e.g., 'EURUSD')
 * @param timeframe - Chart timeframe (e.g., 'H1')
 * @param limit - Maximum number of rows to return (default: 1000)
 * @returns Transformed indicator data ready for API response
 */
export async function getIndicatorData(
  symbol: string,
  timeframe: string,
  limit: number = 1000
): Promise<IndicatorData> {
  const tableName = `${symbol.toLowerCase()}_${timeframe.toLowerCase()}`;

  const rows = await query<RawIndicatorRow>(
    `SELECT timestamp, open, high, low, close,
            fractals, horizontal_trendlines, diagonal_trendlines,
            momentum_candles, keltner_channels, tema, hrma, smma, zigzag
     FROM ${tableName}
     ORDER BY timestamp DESC
     LIMIT $1`,
    [limit]
  );

  // Transform database rows to API response format
  const ohlc: OHLCBar[] = rows
    .map((row) => ({
      time: Math.floor(new Date(row.timestamp).getTime() / 1000),
      open: row.open,
      high: row.high,
      low: row.low,
      close: row.close,
    }))
    .reverse(); // Chronological order for charts

  // Get latest fractals (dynamic indicator - only latest values are valid)
  const latestFractals = rows[0]?.fractals || { peaks: [], bottoms: [] };

  // Get latest trendlines (dynamic indicators)
  const latestHorizontalTrendlines = rows[0]?.horizontal_trendlines || {
    support: [],
    resistance: [],
  };
  const latestDiagonalTrendlines = rows[0]?.diagonal_trendlines || {
    support: [],
    resistance: [],
  };

  // Aggregate momentum candles from all rows
  const momentumCandles: MomentumCandle[] = rows
    .map((r) => r.momentum_candles)
    .filter((m): m is MomentumCandle[] => m !== null)
    .flat();

  // Get latest Keltner channels
  const latestKeltnerChannels = rows[0]?.keltner_channels || {
    upper: [],
    middle: [],
    lower: [],
    timestamps: [],
  };

  // Extract moving average values (filter nulls and reverse for chronological order)
  const tema: number[] = rows
    .map((r) => r.tema)
    .filter((v): v is number => v !== null)
    .reverse();

  const hrma: number[] = rows
    .map((r) => r.hrma)
    .filter((v): v is number => v !== null)
    .reverse();

  const smma: number[] = rows
    .map((r) => r.smma)
    .filter((v): v is number => v !== null)
    .reverse();

  // Get latest ZigZag structure
  const latestZigzag = rows[0]?.zigzag || { points: [] };

  return {
    ohlc,
    fractals: latestFractals,
    horizontal_trendlines: latestHorizontalTrendlines,
    diagonal_trendlines: latestDiagonalTrendlines,
    momentum_candles: momentumCandles,
    keltner_channels: latestKeltnerChannels,
    tema,
    hrma,
    smma,
    zigzag: latestZigzag,
  };
}

/**
 * Get the freshness of data for a symbol/timeframe
 *
 * @param symbol - Trading symbol
 * @param timeframe - Chart timeframe
 * @returns Latest timestamp in the table, or null if empty
 */
export async function getDataFreshness(
  symbol: string,
  timeframe: string
): Promise<Date | null> {
  const tableName = `${symbol.toLowerCase()}_${timeframe.toLowerCase()}`;
  const rows = await query<{ timestamp: Date }>(
    `SELECT timestamp FROM ${tableName} ORDER BY timestamp DESC LIMIT 1`
  );
  return rows[0]?.timestamp || null;
}

/**
 * Get row count for a symbol/timeframe table
 *
 * @param symbol - Trading symbol
 * @param timeframe - Chart timeframe
 * @returns Number of rows in the table
 */
export async function getTableRowCount(
  symbol: string,
  timeframe: string
): Promise<number> {
  const tableName = `${symbol.toLowerCase()}_${timeframe.toLowerCase()}`;
  const rows = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM ${tableName}`
  );
  return parseInt(rows[0]?.count || '0', 10);
}

/**
 * Get total number of tables in the public schema
 *
 * @returns Number of tables (should be 135 for 15 symbols × 9 timeframes)
 */
export async function getTableCount(): Promise<number> {
  const rows = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`
  );
  return parseInt(rows[0]?.count || '0', 10);
}

/**
 * Get all available symbol/timeframe combinations
 *
 * @returns Array of table names representing available data
 */
export async function getAvailableTables(): Promise<string[]> {
  const rows = await query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public'
     AND table_type = 'BASE TABLE'
     AND table_name ~ '^[a-z]+_[a-z0-9]+$'
     ORDER BY table_name`
  );
  return rows.map((r) => r.table_name);
}

/**
 * Check if a specific symbol/timeframe table exists
 *
 * @param symbol - Trading symbol
 * @param timeframe - Chart timeframe
 * @returns true if table exists
 */
export async function tableExists(
  symbol: string,
  timeframe: string
): Promise<boolean> {
  const tableName = `${symbol.toLowerCase()}_${timeframe.toLowerCase()}`;
  const rows = await query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT FROM information_schema.tables
       WHERE table_schema = 'public'
       AND table_name = $1
     )`,
    [tableName]
  );
  return rows[0]?.exists || false;
}
