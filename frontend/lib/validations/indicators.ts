/**
 * Indicator Validation Schemas
 * Validates symbols, timeframes, and bars parameters for indicator API endpoints
 */

import { z } from 'zod';

// =============================================
// Symbol Constants
// =============================================

/**
 * FREE Tier Symbols (5 total)
 * Only these symbols can be accessed by FREE tier users
 */
export const FREE_SYMBOLS = [
  'BTCUSD',
  'EURUSD',
  'USDJPY',
  'US30',
  'XAUUSD',
] as const;

/**
 * PRO Tier Exclusive Symbols (10 additional)
 * These symbols are only available to PRO tier users
 */
export const PRO_EXCLUSIVE_SYMBOLS = [
  'AUDJPY',
  'AUDUSD',
  'ETHUSD',
  'GBPJPY',
  'GBPUSD',
  'NDX100',
  'NZDUSD',
  'USDCAD',
  'USDCHF',
  'XAGUSD',
] as const;

/**
 * All Symbols (15 total)
 * Combined FREE_SYMBOLS + PRO_EXCLUSIVE_SYMBOLS
 */
export const ALL_SYMBOLS = [...FREE_SYMBOLS, ...PRO_EXCLUSIVE_SYMBOLS] as const;

// =============================================
// Timeframe Constants
// =============================================

/**
 * FREE Tier Timeframes (3 total)
 * H1, H4, D1 - Basic timeframes for FREE users
 */
export const FREE_TIMEFRAMES = ['H1', 'H4', 'D1'] as const;

/**
 * PRO Tier Exclusive Timeframes (6 additional)
 * Scalping and swing trading timeframes
 * NOTE: NO M1 or W1 in the system!
 */
export const PRO_EXCLUSIVE_TIMEFRAMES = [
  'M5', // 5 Minutes (scalping)
  'M15', // 15 Minutes
  'M30', // 30 Minutes
  'H2', // 2 Hours
  'H8', // 8 Hours
  'H12', // 12 Hours (swing trading)
] as const;

/**
 * All Timeframes (9 total)
 * Ordered from smallest to largest
 * NOTE: NO M1 or W1 in the system!
 */
export const ALL_TIMEFRAMES = [
  'M5', // 5 Minutes
  'M15', // 15 Minutes
  'M30', // 30 Minutes
  'H1', // 1 Hour
  'H2', // 2 Hours
  'H4', // 4 Hours
  'H8', // 8 Hours
  'H12', // 12 Hours
  'D1', // Daily
] as const;

// =============================================
// Type Definitions
// =============================================

export type Symbol = (typeof ALL_SYMBOLS)[number];
export type Timeframe = (typeof ALL_TIMEFRAMES)[number];
export type FreeSymbol = (typeof FREE_SYMBOLS)[number];
export type FreeTimeframe = (typeof FREE_TIMEFRAMES)[number];

// =============================================
// Validation Schemas
// =============================================

/**
 * Symbol validation schema
 * Validates against ALL 15 symbols (case-insensitive)
 */
export const symbolSchema = z
  .string()
  .min(1, 'Symbol is required')
  .transform((val) => val.toUpperCase())
  .refine(
    (val) => (ALL_SYMBOLS as readonly string[]).includes(val),
    (val) => ({
      message: `Invalid symbol: ${val}. Must be one of: ${ALL_SYMBOLS.join(', ')}`,
    })
  );

/**
 * Timeframe validation schema
 * Validates against ALL 9 timeframes (case-insensitive)
 * NOTE: NO M1 or W1 included!
 */
export const timeframeSchema = z
  .string()
  .min(1, 'Timeframe is required')
  .transform((val) => val.toUpperCase())
  .refine(
    (val) => (ALL_TIMEFRAMES as readonly string[]).includes(val),
    (val) => ({
      message: `Invalid timeframe: ${val}. Must be one of: ${ALL_TIMEFRAMES.join(', ')}`,
    })
  );

/**
 * Bars parameter validation
 * Optional, defaults to 1000, range: 1-5000
 */
export const barsSchema = z
  .string()
  .optional()
  .transform((val) => (val ? parseInt(val, 10) : 1000))
  .pipe(
    z
      .number()
      .int('Bars must be an integer')
      .min(1, 'Bars must be at least 1')
      .max(5000, 'Bars cannot exceed 5000')
  );

/**
 * Complete indicator request schema
 * Validates symbol, timeframe, and optional bars parameters
 */
export const indicatorRequestSchema = z.object({
  symbol: symbolSchema,
  timeframe: timeframeSchema,
  bars: barsSchema,
});

/**
 * Query params schema for GET requests
 * All parameters come as strings from URL
 */
export const indicatorQuerySchema = z.object({
  symbol: z.string().min(1, 'Symbol is required'),
  timeframe: z.string().min(1, 'Timeframe is required'),
  bars: z.string().optional(),
});

// =============================================
// Utility Functions
// =============================================

/**
 * Check if a symbol is valid
 */
export function isValidSymbol(symbol: string): boolean {
  return (ALL_SYMBOLS as readonly string[]).includes(symbol.toUpperCase());
}

/**
 * Check if a timeframe is valid
 */
export function isValidTimeframe(timeframe: string): boolean {
  return (ALL_TIMEFRAMES as readonly string[]).includes(timeframe.toUpperCase());
}

/**
 * Check if a symbol is FREE tier accessible
 */
export function isFreeSymbol(symbol: string): boolean {
  return (FREE_SYMBOLS as readonly string[]).includes(symbol.toUpperCase());
}

/**
 * Check if a timeframe is FREE tier accessible
 */
export function isFreeTimeframe(timeframe: string): boolean {
  return (FREE_TIMEFRAMES as readonly string[]).includes(
    timeframe.toUpperCase()
  );
}

/**
 * Get the category for a symbol
 */
export function getSymbolCategory(
  symbol: string
): 'crypto' | 'forex' | 'index' | 'commodity' | 'unknown' {
  const upperSymbol = symbol.toUpperCase();

  // Crypto
  if (['BTCUSD', 'ETHUSD'].includes(upperSymbol)) {
    return 'crypto';
  }

  // Indices
  if (['US30', 'NDX100'].includes(upperSymbol)) {
    return 'index';
  }

  // Commodities
  if (['XAUUSD', 'XAGUSD'].includes(upperSymbol)) {
    return 'commodity';
  }

  // Forex (remaining symbols)
  if (
    [
      'EURUSD',
      'USDJPY',
      'GBPUSD',
      'AUDUSD',
      'NZDUSD',
      'USDCAD',
      'USDCHF',
      'GBPJPY',
      'AUDJPY',
    ].includes(upperSymbol)
  ) {
    return 'forex';
  }

  return 'unknown';
}

/**
 * Convert timeframe string to minutes
 */
export function timeframeToMinutes(timeframe: string): number {
  const upper = timeframe.toUpperCase();

  const mapping: Record<string, number> = {
    M5: 5,
    M15: 15,
    M30: 30,
    H1: 60,
    H2: 120,
    H4: 240,
    H8: 480,
    H12: 720,
    D1: 1440,
  };

  return mapping[upper] ?? 0;
}

/**
 * Inferred type from indicatorRequestSchema
 */
export type IndicatorRequest = {
  symbol: string;
  timeframe: string;
  bars: number;
};

/**
 * Validate a complete indicator request
 * Returns parsed data or throws ZodError
 */
export function validateIndicatorRequest(data: {
  symbol: string;
  timeframe: string;
  bars?: string;
}): IndicatorRequest {
  const result = indicatorRequestSchema.parse(data);
  return result as IndicatorRequest;
}
