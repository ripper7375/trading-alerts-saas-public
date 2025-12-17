/**
 * Alert Validation Schemas
 *
 * Zod schemas for trading alert-related inputs.
 * Includes symbol and timeframe validation based on tier.
 */

import { z } from 'zod';

/**
 * All supported symbols
 */
export const SYMBOLS = [
  'XAUUSD', // Gold
  'EURUSD', // Euro/USD
  'GBPUSD', // Pound/USD
  'USDJPY', // USD/Yen
  'AUDUSD', // Aussie/USD
  'BTCUSD', // Bitcoin/USD
  'ETHUSD', // Ethereum/USD
  'XAGUSD', // Silver
  'NDX100', // Nasdaq 100
  'US30', // Dow Jones
] as const;

/**
 * FREE tier symbols
 */
export const FREE_SYMBOLS = ['XAUUSD'] as const;

/**
 * All supported timeframes
 */
export const TIMEFRAMES = ['M15', 'M30', 'H1', 'H2', 'H4', 'H8', 'D1'] as const;

/**
 * Alert condition types
 */
export const CONDITION_TYPES = [
  'price_above',
  'price_below',
  'price_equals',
  'price_crosses_above',
  'price_crosses_below',
] as const;

/**
 * Symbol enum for validation
 */
export const symbolEnum = z.enum(SYMBOLS);

/**
 * Timeframe enum for validation
 */
export const timeframeEnum = z.enum(TIMEFRAMES);

/**
 * Condition type enum for validation
 */
export const conditionTypeEnum = z.enum(CONDITION_TYPES);

/**
 * Create alert schema
 */
export const createAlertSchema = z.object({
  symbol: symbolEnum,
  timeframe: timeframeEnum,
  conditionType: conditionTypeEnum,
  targetValue: z
    .number()
    .positive('Target value must be positive')
    .max(1000000, 'Target value exceeds maximum'),
  name: z
    .string()
    .max(100, 'Alert name must not exceed 100 characters')
    .optional(),
  notes: z
    .string()
    .max(500, 'Notes must not exceed 500 characters')
    .optional(),
  enabled: z.boolean().optional().default(true),
  notifyEmail: z.boolean().optional().default(true),
  notifyPush: z.boolean().optional().default(true),
});

/**
 * Update alert schema
 */
export const updateAlertSchema = z.object({
  id: z.string().min(1, 'Alert ID is required'),
  symbol: symbolEnum.optional(),
  timeframe: timeframeEnum.optional(),
  conditionType: conditionTypeEnum.optional(),
  targetValue: z
    .number()
    .positive('Target value must be positive')
    .max(1000000, 'Target value exceeds maximum')
    .optional(),
  name: z
    .string()
    .max(100, 'Alert name must not exceed 100 characters')
    .optional()
    .nullable(),
  notes: z
    .string()
    .max(500, 'Notes must not exceed 500 characters')
    .optional()
    .nullable(),
  enabled: z.boolean().optional(),
  notifyEmail: z.boolean().optional(),
  notifyPush: z.boolean().optional(),
});

/**
 * Delete alert schema
 */
export const deleteAlertSchema = z.object({
  id: z.string().min(1, 'Alert ID is required'),
});

/**
 * Get alert by ID schema
 */
export const getAlertSchema = z.object({
  id: z.string().min(1, 'Alert ID is required'),
});

/**
 * List alerts query schema
 */
export const listAlertsSchema = z.object({
  symbol: symbolEnum.optional(),
  timeframe: timeframeEnum.optional(),
  enabled: z.boolean().optional(),
  triggered: z.boolean().optional(),
  limit: z.number().int().min(1).max(100).optional().default(50),
  offset: z.number().int().min(0).optional().default(0),
});

/**
 * Validate symbol for tier
 *
 * @param symbol - Symbol to validate
 * @param tier - User tier ('FREE' | 'PRO')
 * @returns true if symbol is valid for tier
 */
export function isSymbolValidForTier(
  symbol: string,
  tier: 'FREE' | 'PRO'
): boolean {
  if (tier === 'PRO') {
    return SYMBOLS.includes(symbol as typeof SYMBOLS[number]);
  }
  return FREE_SYMBOLS.includes(symbol as typeof FREE_SYMBOLS[number]);
}

/**
 * Get allowed symbols for tier
 *
 * @param tier - User tier
 * @returns Array of allowed symbols
 */
export function getAllowedSymbols(tier: 'FREE' | 'PRO'): readonly string[] {
  return tier === 'PRO' ? SYMBOLS : FREE_SYMBOLS;
}

/**
 * Create alert schema with tier validation
 *
 * @param tier - User tier for validation
 * @returns Zod schema with tier-specific symbol validation
 */
export function createAlertSchemaForTier(tier: 'FREE' | 'PRO') {
  const allowedSymbols: readonly string[] = tier === 'PRO' ? SYMBOLS : FREE_SYMBOLS;

  return createAlertSchema.refine(
    (data) => allowedSymbols.includes(data.symbol),
    {
      message: `Symbol not available for ${tier} tier`,
      path: ['symbol'],
    }
  );
}

// Type exports
export type CreateAlertInput = z.infer<typeof createAlertSchema>;
export type UpdateAlertInput = z.infer<typeof updateAlertSchema>;
export type DeleteAlertInput = z.infer<typeof deleteAlertSchema>;
export type GetAlertInput = z.infer<typeof getAlertSchema>;
export type ListAlertsInput = z.infer<typeof listAlertsSchema>;
export type Symbol = typeof SYMBOLS[number];
export type Timeframe = typeof TIMEFRAMES[number];
export type ConditionType = typeof CONDITION_TYPES[number];
