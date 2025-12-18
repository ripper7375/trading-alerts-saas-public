/**
 * Watchlist Validation Schemas
 *
 * Zod schemas for watchlist-related inputs.
 * Includes validation for adding items and managing watchlists.
 */

import { z } from 'zod';
import { SYMBOLS, FREE_SYMBOLS, symbolEnum, timeframeEnum } from './alert';

/**
 * Add item to watchlist schema
 */
export const addToWatchlistSchema = z.object({
  symbol: symbolEnum,
  timeframe: timeframeEnum,
  watchlistId: z.string().optional(), // If not provided, add to default watchlist
  position: z.number().int().min(0).optional(), // Position in list
});

/**
 * Remove item from watchlist schema
 */
export const removeFromWatchlistSchema = z.object({
  id: z.string().min(1, 'Watchlist item ID is required'),
});

/**
 * Reorder watchlist items schema
 */
export const reorderWatchlistSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().min(1, 'Item ID is required'),
        position: z.number().int().min(0, 'Position must be non-negative'),
      })
    )
    .min(1, 'At least one item is required'),
});

/**
 * Create watchlist schema
 */
export const createWatchlistSchema = z.object({
  name: z
    .string()
    .min(1, 'Watchlist name is required')
    .max(50, 'Watchlist name must not exceed 50 characters')
    .trim(),
  description: z
    .string()
    .max(200, 'Description must not exceed 200 characters')
    .optional(),
  isDefault: z.boolean().optional().default(false),
});

/**
 * Update watchlist schema
 */
export const updateWatchlistSchema = z.object({
  id: z.string().min(1, 'Watchlist ID is required'),
  name: z
    .string()
    .min(1, 'Watchlist name is required')
    .max(50, 'Watchlist name must not exceed 50 characters')
    .trim()
    .optional(),
  description: z
    .string()
    .max(200, 'Description must not exceed 200 characters')
    .optional()
    .nullable(),
  isDefault: z.boolean().optional(),
});

/**
 * Delete watchlist schema
 */
export const deleteWatchlistSchema = z.object({
  id: z.string().min(1, 'Watchlist ID is required'),
});

/**
 * Get watchlist schema
 */
export const getWatchlistSchema = z.object({
  id: z.string().min(1, 'Watchlist ID is required'),
});

/**
 * List watchlists query schema
 */
export const listWatchlistsSchema = z.object({
  limit: z.number().int().min(1).max(50).optional().default(20),
  offset: z.number().int().min(0).optional().default(0),
});

/**
 * Validate symbol/timeframe combination for tier
 *
 * @param symbol - Trading symbol
 * @param tier - User tier ('FREE' | 'PRO')
 * @returns Object with valid status and optional error message
 */
export function validateSymbolTimeframeCombination(
  symbol: string,
  tier: 'FREE' | 'PRO'
): { valid: boolean; error?: string } {
  // Check if symbol is valid
  if (!SYMBOLS.includes(symbol as (typeof SYMBOLS)[number])) {
    return { valid: false, error: `Invalid symbol: ${symbol}` };
  }

  // Check tier access
  if (
    tier === 'FREE' &&
    !FREE_SYMBOLS.includes(symbol as (typeof FREE_SYMBOLS)[number])
  ) {
    return {
      valid: false,
      error: `Symbol ${symbol} is not available for FREE tier. Upgrade to PRO.`,
    };
  }

  return { valid: true };
}

/**
 * Create schema for adding to watchlist with tier validation
 *
 * @param tier - User tier
 * @returns Zod schema with tier-specific validation
 */
export function addToWatchlistSchemaForTier(tier: 'FREE' | 'PRO') {
  const allowedSymbols: readonly string[] =
    tier === 'PRO' ? SYMBOLS : FREE_SYMBOLS;

  return addToWatchlistSchema.refine(
    (data) => allowedSymbols.includes(data.symbol),
    {
      message: `Symbol not available for ${tier} tier`,
      path: ['symbol'],
    }
  );
}

/**
 * Validate watchlist limit for tier
 *
 * @param currentCount - Current number of watchlists
 * @param tier - User tier
 * @returns Object with valid status and limits info
 */
export function validateWatchlistLimit(
  currentCount: number,
  tier: 'FREE' | 'PRO'
): { valid: boolean; current: number; limit: number } {
  const limits = {
    FREE: 3,
    PRO: 10,
  };

  const limit = limits[tier];

  return {
    valid: currentCount < limit,
    current: currentCount,
    limit,
  };
}

/**
 * Validate watchlist item limit for tier
 *
 * @param currentCount - Current number of items in watchlist
 * @param tier - User tier
 * @returns Object with valid status and limits info
 */
export function validateWatchlistItemLimit(
  currentCount: number,
  tier: 'FREE' | 'PRO'
): { valid: boolean; current: number; limit: number } {
  const limits = {
    FREE: 5,
    PRO: 50,
  };

  const limit = limits[tier];

  return {
    valid: currentCount < limit,
    current: currentCount,
    limit,
  };
}

// Type exports
export type AddToWatchlistInput = z.infer<typeof addToWatchlistSchema>;
export type RemoveFromWatchlistInput = z.infer<
  typeof removeFromWatchlistSchema
>;
export type ReorderWatchlistInput = z.infer<typeof reorderWatchlistSchema>;
export type CreateWatchlistInput = z.infer<typeof createWatchlistSchema>;
export type UpdateWatchlistInput = z.infer<typeof updateWatchlistSchema>;
export type DeleteWatchlistInput = z.infer<typeof deleteWatchlistSchema>;
export type GetWatchlistInput = z.infer<typeof getWatchlistSchema>;
export type ListWatchlistsInput = z.infer<typeof listWatchlistsSchema>;
