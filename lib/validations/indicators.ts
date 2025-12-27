/**
 * Indicator API Validation Schemas
 *
 * Zod schemas for validating indicator API request parameters.
 */

import { z } from 'zod';

import { PRO_SYMBOLS, PRO_TIMEFRAMES } from '@/lib/tier-config';

/**
 * Valid symbols enum
 */
export const symbolSchema = z
  .string()
  .min(1, 'Symbol is required')
  .max(20, 'Symbol must not exceed 20 characters')
  .transform((val) => val.toUpperCase())
  .refine(
    (val) => PRO_SYMBOLS.includes(val as (typeof PRO_SYMBOLS)[number]),
    (val) => ({
      message: `Invalid symbol: ${val}. Valid symbols: ${PRO_SYMBOLS.join(', ')}`,
    })
  );

/**
 * Valid timeframes enum
 */
export const timeframeSchema = z
  .string()
  .min(1, 'Timeframe is required')
  .max(10, 'Timeframe must not exceed 10 characters')
  .transform((val) => val.toUpperCase())
  .refine(
    (val) => PRO_TIMEFRAMES.includes(val as (typeof PRO_TIMEFRAMES)[number]),
    (val) => ({
      message: `Invalid timeframe: ${val}. Valid timeframes: ${PRO_TIMEFRAMES.join(', ')}`,
    })
  );

/**
 * Bars parameter validation
 * - Minimum: 100
 * - Maximum: 5000
 * - Default: 1000
 */
export const barsSchema = z.coerce
  .number()
  .int('Bars must be an integer')
  .min(100, 'Bars must be at least 100')
  .max(5000, 'Bars must not exceed 5000')
  .default(1000);

/**
 * Indicator request query parameters
 */
export const indicatorQuerySchema = z.object({
  bars: barsSchema,
});

/**
 * Indicator route params schema
 */
export const indicatorParamsSchema = z.object({
  symbol: symbolSchema,
  timeframe: timeframeSchema,
});

/**
 * Full indicator request schema
 */
export const indicatorRequestSchema = z.object({
  params: indicatorParamsSchema,
  query: indicatorQuerySchema,
});

// Type exports
export type IndicatorParams = z.infer<typeof indicatorParamsSchema>;
export type IndicatorQuery = z.infer<typeof indicatorQuerySchema>;
export type IndicatorRequest = z.infer<typeof indicatorRequestSchema>;
