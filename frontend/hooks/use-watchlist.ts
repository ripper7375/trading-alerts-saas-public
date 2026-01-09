'use client';

/**
 * Watchlist Hook
 *
 * React hook for watchlist operations including fetch, add, remove, and reorder.
 * Provides tier limit checking helpers.
 *
 * @module hooks/use-watchlist
 */

import { useState, useCallback, useEffect } from 'react';

import { useAuth } from '@/hooks/use-auth';
import { FREE_TIER_CONFIG, PRO_TIER_CONFIG } from '@/lib/tier-config';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface WatchlistItem {
  id: string;
  symbol: string;
  timeframe: string;
  order: number;
  createdAt: string;
}

interface WatchlistData {
  id: string;
  name: string;
  items: WatchlistItem[];
}

interface UseWatchlistResult {
  /** List of watchlist items */
  items: WatchlistItem[];
  /** Watchlist metadata */
  watchlist: WatchlistData | null;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: string | null;
  /** Current item count */
  currentCount: number;
  /** Maximum items allowed for user's tier */
  limit: number;
  /** Whether user can add more items */
  canAdd: boolean;
  /** Number of slots remaining */
  slotsRemaining: number;
  /** Fetch watchlist data */
  fetchWatchlist: () => Promise<void>;
  /** Add item to watchlist */
  addItem: (symbol: string, timeframe: string) => Promise<boolean>;
  /** Remove item from watchlist */
  removeItem: (id: string) => Promise<boolean>;
  /** Reorder watchlist items */
  reorderItems: (itemIds: string[]) => Promise<boolean>;
  /** Check if combination exists */
  hasCombo: (symbol: string, timeframe: string) => boolean;
}

interface ApiResponse<T> {
  success: boolean;
  error?: string;
  message?: string;
  item?: T;
  items?: T[];
  watchlist?: WatchlistData;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HOOK
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * useWatchlist Hook
 *
 * Provides watchlist data and operations with tier limit checking.
 *
 * @returns Watchlist data and operations
 *
 * @example
 * const { items, addItem, removeItem, canAdd, limit } = useWatchlist();
 *
 * // Add item
 * const success = await addItem('XAUUSD', 'H1');
 *
 * // Remove item
 * await removeItem(itemId);
 *
 * // Check limit
 * if (!canAdd) {
 *   alert(`Limit reached (${limit} items)`);
 * }
 */
export function useWatchlist(): UseWatchlistResult {
  const { tier, isAuthenticated } = useAuth();

  const [watchlist, setWatchlist] = useState<WatchlistData | null>(null);
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Calculate tier limit
  const limit =
    tier === 'PRO'
      ? PRO_TIER_CONFIG.maxWatchlistItems
      : FREE_TIER_CONFIG.maxWatchlistItems;

  const currentCount = items.length;
  const canAdd = currentCount < limit;
  const slotsRemaining = limit - currentCount;

  /**
   * Fetch watchlist data from API
   */
  const fetchWatchlist = useCallback(async (): Promise<void> => {
    if (!isAuthenticated) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/watchlist');
      const data: ApiResponse<WatchlistItem> = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch watchlist');
      }

      setWatchlist(data.watchlist || null);
      setItems(data.items || []);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to fetch watchlist';
      setError(message);
      console.error('fetchWatchlist error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  /**
   * Add item to watchlist
   */
  const addItem = useCallback(
    async (symbol: string, timeframe: string): Promise<boolean> => {
      setError(null);

      try {
        const response = await fetch('/api/watchlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbol, timeframe }),
        });

        const data: ApiResponse<WatchlistItem> = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to add item');
        }

        if (data.item) {
          setItems((prev) => [...prev, data.item as WatchlistItem]);
        }

        return true;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to add item';
        setError(message);
        console.error('addItem error:', err);
        return false;
      }
    },
    []
  );

  /**
   * Remove item from watchlist
   */
  const removeItem = useCallback(async (id: string): Promise<boolean> => {
    setError(null);

    try {
      const response = await fetch(`/api/watchlist/${id}`, {
        method: 'DELETE',
      });

      const data: ApiResponse<WatchlistItem> = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to remove item');
      }

      setItems((prev) => prev.filter((item) => item.id !== id));
      return true;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to remove item';
      setError(message);
      console.error('removeItem error:', err);
      return false;
    }
  }, []);

  /**
   * Reorder watchlist items
   */
  const reorderItems = useCallback(
    async (itemIds: string[]): Promise<boolean> => {
      setError(null);

      // Optimistically update local state
      const reorderedItems = itemIds
        .map((id, index) => {
          const item = items.find((i) => i.id === id);
          return item ? { ...item, order: index } : null;
        })
        .filter((item): item is WatchlistItem => item !== null);

      setItems(reorderedItems);

      try {
        const response = await fetch('/api/watchlist/reorder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemIds }),
        });

        const data: ApiResponse<WatchlistItem> = await response.json();

        if (!response.ok) {
          // Revert on failure
          await fetchWatchlist();
          throw new Error(data.error || 'Failed to reorder items');
        }

        return true;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to reorder items';
        setError(message);
        console.error('reorderItems error:', err);
        return false;
      }
    },
    [items, fetchWatchlist]
  );

  /**
   * Check if symbol+timeframe combination exists
   */
  const hasCombo = useCallback(
    (symbol: string, timeframe: string): boolean => {
      return items.some(
        (item) => item.symbol === symbol && item.timeframe === timeframe
      );
    },
    [items]
  );

  // Fetch watchlist on mount
  useEffect(() => {
    fetchWatchlist();
  }, [fetchWatchlist]);

  return {
    items,
    watchlist,
    isLoading,
    error,
    currentCount,
    limit,
    canAdd,
    slotsRemaining,
    fetchWatchlist,
    addItem,
    removeItem,
    reorderItems,
    hasCombo,
  };
}

export default useWatchlist;
