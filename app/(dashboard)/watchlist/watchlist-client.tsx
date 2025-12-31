'use client';

/**
 * Watchlist Client Component
 *
 * Interactive watchlist management with add/remove functionality.
 * Tier-based limits: FREE: 5 items, PRO: 50 items
 *
 * @module app/(dashboard)/watchlist/watchlist-client
 */

import {
  ChevronRight,
  Lock,
  MoreVertical,
  BarChart3,
  Trash2,
  Plus,
  Loader2,
  Undo2,
} from 'lucide-react';
import Link from 'next/link';
import { useState, useCallback, useRef, useEffect } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FREE_SYMBOLS,
  PRO_SYMBOLS,
  FREE_TIMEFRAMES,
  PRO_TIMEFRAMES,
  type Tier,
} from '@/lib/tier-config';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface WatchlistItem {
  id: string;
  symbol: string;
  timeframe: string;
  order: number;
  createdAt: Date;
}

interface WatchlistClientProps {
  initialItems: WatchlistItem[];
  watchlistId: string;
  userTier: Tier;
  limit: number;
}

interface SymbolInfo {
  id: string;
  name: string;
  description: string;
  icon: string;
  tier: Tier;
}

interface TimeframeInfo {
  id: string;
  name: string;
  tier: Tier;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SYMBOL & TIMEFRAME DATA
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const SYMBOLS: SymbolInfo[] = [
  {
    id: 'BTCUSD',
    name: 'BTCUSD',
    description: 'Bitcoin',
    icon: '₿',
    tier: 'FREE',
  },
  {
    id: 'EURUSD',
    name: 'EURUSD',
    description: 'Euro / US Dollar',
    icon: '€',
    tier: 'FREE',
  },
  {
    id: 'USDJPY',
    name: 'USDJPY',
    description: 'US Dollar / Japanese Yen',
    icon: '¥',
    tier: 'FREE',
  },
  {
    id: 'US30',
    name: 'US30',
    description: 'Dow Jones',
    icon: '📈',
    tier: 'FREE',
  },
  {
    id: 'XAUUSD',
    name: 'XAUUSD',
    description: 'Gold',
    icon: '🥇',
    tier: 'FREE',
  },
  {
    id: 'AUDJPY',
    name: 'AUDJPY',
    description: 'Australian Dollar / Yen',
    icon: '🦘',
    tier: 'PRO',
  },
  {
    id: 'AUDUSD',
    name: 'AUDUSD',
    description: 'Australian Dollar / USD',
    icon: '🇦🇺',
    tier: 'PRO',
  },
  {
    id: 'ETHUSD',
    name: 'ETHUSD',
    description: 'Ethereum',
    icon: '⟠',
    tier: 'PRO',
  },
  {
    id: 'GBPJPY',
    name: 'GBPJPY',
    description: 'British Pound / Yen',
    icon: '£',
    tier: 'PRO',
  },
  {
    id: 'GBPUSD',
    name: 'GBPUSD',
    description: 'British Pound / USD',
    icon: '💷',
    tier: 'PRO',
  },
  {
    id: 'NDX100',
    name: 'NDX100',
    description: 'Nasdaq 100',
    icon: '📊',
    tier: 'PRO',
  },
  {
    id: 'NZDUSD',
    name: 'NZDUSD',
    description: 'New Zealand Dollar / USD',
    icon: '🥝',
    tier: 'PRO',
  },
  {
    id: 'USDCAD',
    name: 'USDCAD',
    description: 'USD / Canadian Dollar',
    icon: '🍁',
    tier: 'PRO',
  },
  {
    id: 'USDCHF',
    name: 'USDCHF',
    description: 'USD / Swiss Franc',
    icon: '🇨🇭',
    tier: 'PRO',
  },
  {
    id: 'XAGUSD',
    name: 'XAGUSD',
    description: 'Silver',
    icon: '🥈',
    tier: 'PRO',
  },
];

const TIMEFRAMES: TimeframeInfo[] = [
  { id: 'M5', name: '5 Minutes', tier: 'PRO' },
  { id: 'M15', name: '15 Minutes', tier: 'PRO' },
  { id: 'M30', name: '30 Minutes', tier: 'PRO' },
  { id: 'H1', name: '1 Hour', tier: 'FREE' },
  { id: 'H2', name: '2 Hours', tier: 'PRO' },
  { id: 'H4', name: '4 Hours', tier: 'FREE' },
  { id: 'H8', name: '8 Hours', tier: 'PRO' },
  { id: 'H12', name: '12 Hours', tier: 'PRO' },
  { id: 'D1', name: '1 Day', tier: 'FREE' },
];

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMPONENT
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function WatchlistClient({
  initialItems,
  watchlistId,
  userTier,
  limit,
}: WatchlistClientProps): React.JSX.Element {
  const [items, setItems] = useState<WatchlistItem[]>(initialItems);
  const [selectedSymbol, setSelectedSymbol] = useState<string>('');
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [isRemoving, setIsRemoving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Undo state for remove operations
  const [removedItem, setRemovedItem] = useState<WatchlistItem | null>(null);
  const [showUndo, setShowUndo] = useState(false);
  const undoTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Pending add state for optimistic UI
  const [pendingAddId, setPendingAddId] = useState<string | null>(null);

  const usedSlots = items.length;

  // Get available symbols and timeframes based on tier
  const availableSymbols = userTier === 'PRO' ? PRO_SYMBOLS : FREE_SYMBOLS;
  const availableTimeframes =
    userTier === 'PRO' ? PRO_TIMEFRAMES : FREE_TIMEFRAMES;

  // Check if combination already exists
  const isComboExists = useCallback((): boolean => {
    return items.some(
      (item) =>
        item.symbol === selectedSymbol && item.timeframe === selectedTimeframe
    );
  }, [items, selectedSymbol, selectedTimeframe]);

  const canAdd =
    selectedSymbol &&
    selectedTimeframe &&
    !isComboExists() &&
    usedSlots < limit &&
    !isAdding;

  // Cleanup undo timeout on unmount
  useEffect(() => {
    return () => {
      if (undoTimeoutRef.current) {
        clearTimeout(undoTimeoutRef.current);
      }
    };
  }, []);

  // Add item handler (optimistic)
  const handleAddItem = useCallback(async (): Promise<void> => {
    if (!canAdd) return;

    setIsAdding(true);
    setError(null);

    // Create optimistic item with temporary ID
    const tempId = `temp-${Date.now()}`;
    const optimisticItem: WatchlistItem = {
      id: tempId,
      symbol: selectedSymbol,
      timeframe: selectedTimeframe,
      order: items.length,
      createdAt: new Date(),
    };

    // Store previous state for rollback
    const previousItems = items;
    const previousSymbol = selectedSymbol;
    const previousTimeframe = selectedTimeframe;

    // Optimistically add item
    setItems((prev) => [...prev, optimisticItem]);
    setPendingAddId(tempId);
    setSelectedSymbol('');
    setSelectedTimeframe('');
    setShowAddForm(false);

    try {
      const response = await fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          watchlistId,
          symbol: previousSymbol,
          timeframe: previousTimeframe,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add item');
      }

      // Replace temporary item with real item from server
      setItems((prev) =>
        prev.map((item) => (item.id === tempId ? data.item : item))
      );
    } catch (err) {
      // Rollback on error
      setItems(previousItems);
      setSelectedSymbol(previousSymbol);
      setSelectedTimeframe(previousTimeframe);
      setShowAddForm(true);
      setError(err instanceof Error ? err.message : 'Failed to add item');
    } finally {
      setIsAdding(false);
      setPendingAddId(null);
    }
  }, [canAdd, watchlistId, selectedSymbol, selectedTimeframe, items]);

  // Remove item handler (optimistic)
  const handleRemoveItem = useCallback(
    async (id: string): Promise<void> => {
      setIsRemoving(id);
      setError(null);

      // Store item for undo
      const itemToRemove = items.find((item) => item.id === id);
      if (!itemToRemove) {
        setIsRemoving(null);
        return;
      }

      // Store previous state for rollback
      const previousItems = items;

      // Set up undo state
      setRemovedItem(itemToRemove);
      setShowUndo(true);

      // Clear previous timeout
      if (undoTimeoutRef.current) {
        clearTimeout(undoTimeoutRef.current);
      }

      // Auto-hide undo after 5 seconds
      undoTimeoutRef.current = setTimeout(() => {
        setShowUndo(false);
        setRemovedItem(null);
      }, 5000);

      // Optimistically remove item
      setItems((prev) => prev.filter((item) => item.id !== id));

      try {
        const response = await fetch(`/api/watchlist/${id}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to remove item');
        }
      } catch (err) {
        // Rollback on error
        setItems(previousItems);
        setShowUndo(false);
        setRemovedItem(null);
        if (undoTimeoutRef.current) {
          clearTimeout(undoTimeoutRef.current);
        }
        setError(err instanceof Error ? err.message : 'Failed to remove item');
      } finally {
        setIsRemoving(null);
      }
    },
    [items]
  );

  // Undo remove - restore the item
  const handleUndoRemove = useCallback(async (): Promise<void> => {
    if (!removedItem) return;

    // Clear timeout
    if (undoTimeoutRef.current) {
      clearTimeout(undoTimeoutRef.current);
    }

    // Restore the item optimistically
    const itemToRestore = removedItem;
    setItems((prev) => {
      // Insert back in the correct position based on order
      const restored = [...prev, itemToRestore].sort(
        (a, b) => a.order - b.order
      );
      return restored;
    });

    setShowUndo(false);
    setRemovedItem(null);

    // Re-create the item on the server
    try {
      await fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          watchlistId,
          symbol: itemToRestore.symbol,
          timeframe: itemToRestore.timeframe,
        }),
      });
    } catch (err) {
      console.error('Failed to restore watchlist item:', err);
      // Remove the item if server restore failed
      setItems((prev) => prev.filter((item) => item.id !== itemToRestore.id));
      setError('Failed to restore item');
    }
  }, [removedItem, watchlistId]);

  // Get symbol info
  const getSymbolInfo = (symbol: string): SymbolInfo | undefined => {
    return SYMBOLS.find((s) => s.id === symbol);
  };

  // Get timeframe info
  const getTimeframeInfo = (timeframe: string): TimeframeInfo | undefined => {
    return TIMEFRAMES.find((t) => t.id === timeframe);
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <span>Dashboard</span>
        <ChevronRight className="h-4 w-4" />
        <span>Watchlist</span>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">My Watchlist</h1>
        <div className="flex items-center gap-4">
          <Badge
            variant="secondary"
            className="bg-gray-100 px-4 py-2 rounded-full font-semibold text-base"
          >
            {usedSlots}/{limit} slots used
          </Badge>
          <Button
            onClick={() => setShowAddForm(!showAddForm)}
            disabled={usedSlots >= limit}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add New
          </Button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Add Item Form */}
      {showAddForm && (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl">
              Select Symbol and Timeframe:
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Symbol Selector */}
            <div>
              <label className="block font-medium text-gray-700 mb-2">
                Symbol
              </label>
              <Select value={selectedSymbol} onValueChange={setSelectedSymbol}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a symbol" />
                </SelectTrigger>
                <SelectContent>
                  {SYMBOLS.map((symbol) => {
                    const isLocked = !(
                      availableSymbols as readonly string[]
                    ).includes(symbol.id);
                    return (
                      <SelectItem
                        key={symbol.id}
                        value={symbol.id}
                        disabled={isLocked}
                        className="py-3"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{symbol.icon}</span>
                          <div className="flex-1">
                            <div className="font-semibold">{symbol.name}</div>
                            <div className="text-xs text-gray-500">
                              {symbol.description}
                            </div>
                          </div>
                          {isLocked && (
                            <Lock className="h-4 w-4 text-gray-400" />
                          )}
                          {symbol.tier === 'PRO' && (
                            <Badge
                              variant="secondary"
                              className="bg-purple-100 text-purple-700 text-xs"
                            >
                              PRO
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Timeframe Selector */}
            <div>
              <label className="block font-medium text-gray-700 mb-2">
                Timeframe
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {TIMEFRAMES.map((timeframe) => {
                  const isLocked = !(
                    availableTimeframes as readonly string[]
                  ).includes(timeframe.id);
                  const isSelected = selectedTimeframe === timeframe.id;
                  return (
                    <button
                      key={timeframe.id}
                      type="button"
                      onClick={() =>
                        !isLocked && setSelectedTimeframe(timeframe.id)
                      }
                      disabled={isLocked}
                      className={`
                        border-2 rounded-lg px-4 py-3 text-center transition-all
                        ${
                          isSelected
                            ? 'bg-blue-50 border-blue-600 text-blue-600 font-semibold'
                            : 'border-gray-300 hover:border-blue-600'
                        }
                        ${isLocked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                      `}
                    >
                      <div className="flex items-center justify-center gap-2">
                        {isLocked && <Lock className="h-3 w-3" />}
                        <span className="font-semibold">{timeframe.id}</span>
                      </div>
                      <div className="text-xs mt-1 text-gray-600">
                        {timeframe.name}
                      </div>
                      {timeframe.tier === 'PRO' && (
                        <Badge
                          variant="secondary"
                          className="bg-purple-100 text-purple-700 text-xs mt-1"
                        >
                          PRO
                        </Badge>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Submit Button */}
            <Button
              onClick={handleAddItem}
              disabled={!canAdd}
              className="w-full bg-green-600 hover:bg-green-700 text-white py-3 text-lg font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isAdding ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Adding...
                </>
              ) : isComboExists() ? (
                'Combination Already Exists'
              ) : (
                'Add to Watchlist'
              )}
            </Button>

            {usedSlots >= limit && (
              <p className="text-sm text-red-600 text-center">
                You have reached your {limit} slot limit. Remove an item to add
                more.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Undo Remove Banner */}
      {showUndo && removedItem && (
        <div className="flex items-center justify-between bg-gray-800 text-white px-4 py-3 rounded-lg animate-in slide-in-from-top-2">
          <span className="text-sm">
            Removed {removedItem.symbol} - {removedItem.timeframe}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleUndoRemove}
            className="text-white hover:text-white hover:bg-gray-700"
          >
            <Undo2 className="h-4 w-4 mr-2" />
            Undo
          </Button>
        </div>
      )}

      {/* Watchlist Items */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          Active Watchlist Items ({usedSlots}/{limit}):
        </h2>

        {items.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((item) => {
              const symbolInfo = getSymbolInfo(item.symbol);
              const timeframeInfo = getTimeframeInfo(item.timeframe);
              const isPending = item.id === pendingAddId;

              return (
                <Card
                  key={item.id}
                  className={`shadow-md hover:shadow-xl transition-shadow border-l-4 border-blue-500 ${
                    isPending ? 'opacity-70' : ''
                  }`}
                >
                  <CardContent className="p-6">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">
                          {item.symbol} - {item.timeframe}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {symbolInfo?.description || item.symbol}
                        </p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link
                              href={`/charts/${item.symbol}/${item.timeframe}`}
                            >
                              <BarChart3 className="h-4 w-4 mr-2" />
                              View Chart
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleRemoveItem(item.id)}
                            disabled={isRemoving === item.id}
                            className="text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Remove
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Status Badge */}
                    <Badge
                      variant="secondary"
                      className="bg-blue-100 text-blue-800 mb-3"
                    >
                      {timeframeInfo?.name || item.timeframe}
                    </Badge>

                    {/* Action Buttons */}
                    <div className="flex gap-2 mt-4">
                      <Button
                        asChild
                        className="flex-1 bg-blue-600 hover:bg-blue-700"
                      >
                        <Link href={`/charts/${item.symbol}/${item.timeframe}`}>
                          <BarChart3 className="h-4 w-4 mr-2" />
                          View Chart
                        </Link>
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleRemoveItem(item.id)}
                        disabled={isRemoving === item.id}
                        className="border-2 border-gray-300 hover:border-red-500 hover:text-red-600"
                      >
                        {isRemoving === item.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          /* Empty State */
          <Card className="bg-gray-50 border-2 border-dashed border-gray-300">
            <CardContent className="p-16 text-center">
              <div className="text-8xl opacity-30 mb-4">📋</div>
              <h3 className="text-2xl text-gray-500 mb-2">
                No watchlist items yet
              </h3>
              <p className="text-gray-400 mb-6">
                Add your first symbol and timeframe combination above to start
                monitoring
              </p>
              <div className="bg-blue-50 border-l-4 border-blue-600 p-4 rounded text-sm text-gray-600">
                <p className="mb-1">
                  {userTier} Tier: You can add up to {limit} combinations
                </p>
                {userTier === 'FREE' && (
                  <p className="text-blue-700 font-medium">
                    Upgrade to PRO for 50 watchlist items
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Tier Info Card */}
      <Card
        className={`border-l-4 ${
          userTier === 'FREE'
            ? 'border-blue-600 bg-gradient-to-r from-blue-50 to-purple-50'
            : 'border-purple-600 bg-gradient-to-r from-purple-50 to-blue-50'
        }`}
      >
        <CardContent className="p-6">
          {userTier === 'FREE' ? (
            <div>
              <h3 className="text-lg font-semibold mb-2">FREE Tier Limits</h3>
              <p className="text-gray-700 mb-2">
                You can add up to {limit} symbol+timeframe combinations
              </p>
              <div className="space-y-1 mb-3">
                <p className="text-sm text-gray-600">
                  <strong>Symbols:</strong> {FREE_SYMBOLS.length} available (
                  {FREE_SYMBOLS.join(', ')})
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Timeframes:</strong> {FREE_TIMEFRAMES.join(', ')}
                </p>
              </div>
              <Button
                asChild
                className="bg-blue-600 hover:bg-blue-700 text-white mt-3"
              >
                <Link href="/pricing">
                  Upgrade to PRO for 50 watchlist items
                </Link>
              </Button>
            </div>
          ) : (
            <div>
              <h3 className="text-lg font-semibold mb-2">PRO Tier Benefits</h3>
              <p className="text-gray-700 mb-3">
                You have {limit} watchlist slots with all symbols and timeframes
              </p>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <span>
                    Using {usedSlots}/{limit} slots (
                    {Math.round((usedSlots / limit) * 100)}%)
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-purple-600 to-blue-600 h-full rounded-full transition-all"
                    style={{ width: `${(usedSlots / limit) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
