'use client';

/**
 * Watchlist Item Component
 *
 * Card component displaying a single watchlist item with symbol+timeframe.
 * Includes actions for viewing chart and removing from watchlist.
 *
 * @module components/watchlist/watchlist-item
 */

import {
  BarChart3,
  MoreVertical,
  Trash2,
  TrendingUp,
  TrendingDown,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

type WatchlistStatus = 'support' | 'resistance' | 'normal';

interface WatchlistItemProps {
  /** Unique identifier */
  id: string;
  /** Trading symbol (e.g., 'XAUUSD') */
  symbol: string;
  /** Timeframe (e.g., 'H1') */
  timeframe: string;
  /** Current price (optional) */
  currentPrice?: number;
  /** Price change amount (optional) */
  priceChange?: number;
  /** Price change percentage (optional) */
  priceChangePercent?: number;
  /** Status indicator */
  status?: WatchlistStatus;
  /** Last update timestamp */
  lastUpdated?: string;
  /** Callback when remove is clicked */
  onRemove: (id: string) => void;
  /** Whether remove action is loading */
  isRemoving?: boolean;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SYMBOL DATA
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const SYMBOL_DESCRIPTIONS: Record<string, string> = {
  BTCUSD: 'Bitcoin',
  EURUSD: 'Euro / US Dollar',
  USDJPY: 'US Dollar / Japanese Yen',
  US30: 'Dow Jones',
  XAUUSD: 'Gold',
  AUDJPY: 'Australian Dollar / Yen',
  AUDUSD: 'Australian Dollar / USD',
  ETHUSD: 'Ethereum',
  GBPJPY: 'British Pound / Yen',
  GBPUSD: 'British Pound / USD',
  NDX100: 'Nasdaq 100',
  NZDUSD: 'New Zealand Dollar / USD',
  USDCAD: 'USD / Canadian Dollar',
  USDCHF: 'USD / Swiss Franc',
  XAGUSD: 'Silver',
};

const TIMEFRAME_NAMES: Record<string, string> = {
  M5: '5 Minutes',
  M15: '15 Minutes',
  M30: '30 Minutes',
  H1: '1 Hour',
  H2: '2 Hours',
  H4: '4 Hours',
  H8: '8 Hours',
  H12: '12 Hours',
  D1: '1 Day',
};

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STATUS STYLES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const STATUS_STYLES: Record<
  WatchlistStatus,
  { border: string; badge: string; bg: string }
> = {
  support: {
    border: 'border-green-500',
    badge: 'bg-green-100 text-green-800',
    bg: 'bg-green-50',
  },
  resistance: {
    border: 'border-red-500',
    badge: 'bg-red-100 text-red-800',
    bg: 'bg-red-50',
  },
  normal: {
    border: 'border-blue-500',
    badge: 'bg-blue-100 text-blue-800',
    bg: 'bg-blue-50',
  },
};

const STATUS_MESSAGES: Record<WatchlistStatus, string> = {
  support: 'Near Support',
  resistance: 'Near Resistance',
  normal: 'Normal Range',
};

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMPONENT
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Watchlist Item Component
 *
 * Displays a single watchlist item card with symbol, timeframe,
 * price data, and action buttons.
 */
export function WatchlistItem({
  id,
  symbol,
  timeframe,
  currentPrice = 0,
  priceChange = 0,
  priceChangePercent = 0,
  status = 'normal',
  lastUpdated = 'N/A',
  onRemove,
  isRemoving = false,
}: WatchlistItemProps): React.JSX.Element {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const isPositive = priceChange >= 0;
  const styles = STATUS_STYLES[status];
  const symbolDescription = SYMBOL_DESCRIPTIONS[symbol] || symbol;
  const timeframeName = TIMEFRAME_NAMES[timeframe] || timeframe;

  const handleRemove = (): void => {
    setShowDeleteDialog(false);
    onRemove(id);
  };

  return (
    <>
      <Card
        className={`shadow-md hover:shadow-xl transition-shadow border-l-4 ${styles.border}`}
      >
        <CardContent className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-xl font-bold text-gray-900">
                {symbol} - {timeframe}
              </h3>
              <p className="text-sm text-gray-500">{symbolDescription}</p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href={`/charts/${symbol}/${timeframe}`}>
                    <BarChart3 className="h-4 w-4 mr-2" />
                    View Chart
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setShowDeleteDialog(true)}
                  disabled={isRemoving}
                  className="text-red-600"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remove
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Price Section (if available) */}
          {currentPrice > 0 && (
            <div className="mb-4">
              <p className="text-2xl font-bold text-gray-900">
                ${currentPrice.toFixed(2)}
              </p>
              <div
                className={`flex items-center gap-1 ${
                  isPositive ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {isPositive ? (
                  <TrendingUp className="h-4 w-4" />
                ) : (
                  <TrendingDown className="h-4 w-4" />
                )}
                <span>
                  {isPositive ? '+' : ''}${Math.abs(priceChange).toFixed(2)} (
                  {isPositive ? '+' : ''}
                  {priceChangePercent.toFixed(2)}%)
                </span>
              </div>
            </div>
          )}

          {/* Status Badge */}
          <Badge className={`${styles.badge} mb-3`}>
            {status === 'support' && '✓ '}
            {status === 'resistance' && '⚠️ '}
            {status === 'normal' && '📊 '}
            {STATUS_MESSAGES[status]}
          </Badge>

          {/* Timeframe Badge */}
          <Badge variant="outline" className="ml-2 mb-3">
            {timeframeName}
          </Badge>

          {/* Last Updated */}
          <p className="text-xs text-gray-500 mb-4">Updated {lastUpdated}</p>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button asChild className="flex-1 bg-blue-600 hover:bg-blue-700">
              <Link href={`/charts/${symbol}/${timeframe}`}>
                <BarChart3 className="h-4 w-4 mr-2" />
                View Chart
              </Link>
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(true)}
              disabled={isRemoving}
              className="border-2 border-gray-300 hover:border-red-500 hover:text-red-600"
            >
              {isRemoving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from Watchlist?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove{' '}
              <strong>
                {symbol} - {timeframe}
              </strong>{' '}
              from your watchlist? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemove}
              className="bg-red-600 hover:bg-red-700"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default WatchlistItem;
