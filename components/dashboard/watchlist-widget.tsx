import { Eye, ArrowRight, TrendingUp, TrendingDown, Plus } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface WatchlistItem {
  id: string;
  symbol: string;
  timeframe: string;
  currentPrice: number;
  change: number;
  changePercent: number;
  status?: 'approaching' | 'neutral' | 'away';
  lastUpdated: string;
}

interface WatchlistWidgetProps {
  items: WatchlistItem[];
  maxItems?: number;
}

/**
 * Watchlist Widget Component
 *
 * Displays the user's watchlist items on the dashboard.
 *
 * Features:
 * - Shows top watchlist items
 * - Price and change indicators
 * - Status badges for approaching levels
 * - Link to full watchlist page
 * - Empty state with CTA
 *
 * @param items - Array of watchlist items
 * @param maxItems - Maximum number of items to show (default: 5)
 */
export function WatchlistWidget({
  items,
  maxItems = 5,
}: WatchlistWidgetProps): React.ReactElement {
  const displayItems = items.slice(0, maxItems);

  return (
    <Card className="bg-white dark:bg-gray-800">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
          <Eye className="h-5 w-5 text-gray-400" />
          Watchlist
        </CardTitle>
        <div className="flex items-center gap-2">
          <Link href="/watchlist/add">
            <Button variant="outline" size="sm">
              <Plus className="h-4 w-4" />
              <span className="sr-only sm:not-sr-only sm:ml-1">Add</span>
            </Button>
          </Link>
          {items.length > 0 && (
            <Link href="/watchlist">
              <Button
                variant="ghost"
                size="sm"
                className="text-blue-600 hover:text-blue-700"
              >
                View All
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {displayItems.length > 0 ? (
          <div className="space-y-2">
            {displayItems.map((item) => {
              const isPositive = item.change >= 0;
              const TrendIcon = isPositive ? TrendingUp : TrendingDown;

              return (
                <Link
                  key={item.id}
                  href={`/charts?symbol=${item.symbol}&timeframe=${item.timeframe}`}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors group"
                >
                  {/* Left: Symbol and Timeframe */}
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col">
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {item.symbol}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {item.timeframe}
                      </span>
                    </div>
                  </div>

                  {/* Center: Status badge */}
                  {item.status === 'approaching' && (
                    <Badge
                      variant="secondary"
                      className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"
                    >
                      Approaching
                    </Badge>
                  )}

                  {/* Right: Price and Change */}
                  <div className="flex flex-col items-end">
                    <span className="font-medium text-gray-900 dark:text-white">
                      ${item.currentPrice.toFixed(2)}
                    </span>
                    <div
                      className={cn(
                        'flex items-center gap-1 text-xs font-medium',
                        isPositive ? 'text-green-600' : 'text-red-600'
                      )}
                    >
                      <TrendIcon className="h-3 w-3" />
                      <span>
                        {isPositive ? '+' : ''}
                        {item.changePercent.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          /* Empty State */
          <div className="text-center py-8">
            <div className="mx-auto mb-4 text-5xl opacity-50">📋</div>
            <h3 className="text-lg font-medium text-gray-600 dark:text-gray-400 mb-2">
              No symbols in watchlist
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-500 mb-4">
              Add symbols to track their price movements
            </p>
            <Link href="/watchlist/add">
              <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                <Plus className="h-4 w-4 mr-1" />
                Add Symbol
              </Button>
            </Link>
          </div>
        )}

        {/* Last updated */}
        {displayItems.length > 0 && (
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-4 text-center">
            Prices updated automatically
          </p>
        )}
      </CardContent>
    </Card>
  );
}
