/**
 * Part 20 - Phase 04b: Database Query Functions
 *
 * Query functions for retrieving indicator data from PostgreSQL.
 * Uses types from Phase 04a.
 *
 * @see docs/sqlite-and-mt5service/part-20-architecture-design.md
 */

import { query } from './postgresql';
import type { IndicatorData, OHLCBar } from '@/lib/indicators/types';
import { VALID_SYMBOLS, VALID_TIMEFRAMES } from '@/lib/constants/business-rules';

/**
 * Validate and sanitize table name components to prevent SQL injection
 */
function validateTableName(
  symbol: string,
  timeframe: string
): { isValid: boolean; tableName: string } {
  const normalizedSymbol = symbol.toUpperCase();
  const normalizedTimeframe = timeframe.toUpperCase();

  // Cast to readonly string[] to allow includes() check with string input
  const isValidSymbol = (VALID_SYMBOLS as readonly string[]).includes(
    normalizedSymbol
  );
  const isValidTimeframe = (VALID_TIMEFRAMES as readonly string[]).includes(
    normalizedTimeframe
  );

  if (!isValidSymbol || !isValidTimeframe) {
    return { isValid: false, tableName: '' };
  }

  // Create safe table name (lowercase for PostgreSQL convention)
  const tableName = `${normalizedSymbol.toLowerCase()}_${normalizedTimeframe.toLowerCase()}`;
  return { isValid: true, tableName };
}

interface RawRow {
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

export async function getIndicatorDataFromDb(
  symbol: string,
  timeframe: string,
  limit: number = 1000
): Promise<IndicatorData> {
  const { isValid, tableName } = validateTableName(symbol, timeframe);

  if (!isValid) {
    throw new Error(`Invalid symbol or timeframe: ${symbol}/${timeframe}`);
  }

  // Use double-quoted identifier for table name (validated above)
  const rows = await query<RawRow>(
    `SELECT timestamp, open, high, low, close,
            fractals, horizontal_trendlines, diagonal_trendlines,
            momentum_candles, keltner_channels, tema, hrma, smma, zigzag
     FROM "${tableName}"
     ORDER BY timestamp DESC
     LIMIT $1`,
    [limit]
  );

  const ohlc: OHLCBar[] = rows
    .map((row) => ({
      time: Math.floor(new Date(row.timestamp).getTime() / 1000),
      open: row.open,
      high: row.high,
      low: row.low,
      close: row.close,
    }))
    .reverse();

  return {
    ohlc,
    fractals: (rows[0]?.fractals as IndicatorData['fractals']) || {
      peaks: [],
      bottoms: [],
    },
    horizontal_trendlines: (rows[0]
      ?.horizontal_trendlines as IndicatorData['horizontal_trendlines']) || {
      support: [],
      resistance: [],
    },
    diagonal_trendlines: (rows[0]
      ?.diagonal_trendlines as IndicatorData['diagonal_trendlines']) || {
      support: [],
      resistance: [],
    },
    momentum_candles: rows.flatMap(
      (r) => (r.momentum_candles as IndicatorData['momentum_candles']) || []
    ),
    keltner_channels: (rows[0]
      ?.keltner_channels as IndicatorData['keltner_channels']) || {
      upper: [],
      middle: [],
      lower: [],
      timestamps: [],
    },
    tema: rows
      .map((r) => r.tema)
      .filter((v): v is number => v !== null)
      .reverse(),
    hrma: rows
      .map((r) => r.hrma)
      .filter((v): v is number => v !== null)
      .reverse(),
    smma: rows
      .map((r) => r.smma)
      .filter((v): v is number => v !== null)
      .reverse(),
    zigzag: (rows[0]?.zigzag as IndicatorData['zigzag']) || { points: [] },
  };
}

export async function getDataFreshness(
  symbol: string,
  timeframe: string
): Promise<Date | null> {
  const { isValid, tableName } = validateTableName(symbol, timeframe);

  if (!isValid) {
    throw new Error(`Invalid symbol or timeframe: ${symbol}/${timeframe}`);
  }

  const rows = await query<{ timestamp: Date }>(
    `SELECT timestamp FROM "${tableName}" ORDER BY timestamp DESC LIMIT 1`
  );
  return rows[0]?.timestamp || null;
}

export async function getTableCount(): Promise<number> {
  const rows = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`
  );
  return parseInt(rows[0]?.count || '0', 10);
}
