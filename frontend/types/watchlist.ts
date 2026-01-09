/**
 * Watchlist Types
 *
 * This file serves as a placeholder for additional watchlist-related types.
 *
 * Primary watchlist types are defined in:
 * - types/user.ts - Watchlist interface
 * - types/prisma-stubs.d.ts - Watchlist and WatchlistItem models from Prisma
 *
 * @see {@link ./user.ts} for Watchlist interface
 * @see {@link ./prisma-stubs.d.ts} for Prisma Watchlist models
 */

import type { Symbol, Timeframe } from './tier';

// Re-export Watchlist from user.ts for convenience
export type { Watchlist } from './user';

/**
 * Watchlist item representing a symbol+timeframe combination
 */
export interface WatchlistItem {
  id: string;
  watchlistId: string;
  userId: string;
  symbol: Symbol;
  timeframe: Timeframe;
  order: number;
  createdAt: Date;
}

/**
 * Request to create a new watchlist
 */
export interface CreateWatchlistRequest {
  name: string;
  items?: Array<{
    symbol: Symbol;
    timeframe: Timeframe;
  }>;
}

/**
 * Request to update a watchlist
 */
export interface UpdateWatchlistRequest {
  name?: string;
  order?: number;
}

/**
 * Request to add item to watchlist
 */
export interface AddWatchlistItemRequest {
  symbol: Symbol;
  timeframe: Timeframe;
}

/**
 * Watchlist with items included
 */
export interface WatchlistWithItems {
  id: string;
  userId: string;
  name: string;
  order: number;
  createdAt: Date;
  items: WatchlistItem[];
}
