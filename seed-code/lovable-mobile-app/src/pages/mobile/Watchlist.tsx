import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Star,
  TrendingUp,
  TrendingDown,
  Search,
  Plus,
  ArrowUpDown,
  ChevronDown,
} from 'lucide-react';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { PullToRefreshIndicator } from '@/components/mobile/PullToRefresh';
import { WatchlistSkeleton } from '@/components/mobile/Skeletons';
import { WatchlistEmpty, SearchEmpty } from '@/components/mobile/EmptyState';
import { SwipeableItem } from '@/components/mobile/SwipeableItem';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { UsageLimitIndicator } from '@/components/subscription/FeatureGate';
import { toast } from 'sonner';

interface WatchlistItem {
  symbol: string;
  name: string;
  price: string;
  change: string;
  changePercent: number;
  isUp: boolean;
}

// Mock watchlist data
const initialWatchlist: WatchlistItem[] = [
  {
    symbol: 'EURUSD',
    name: 'Euro / US Dollar',
    price: '1.0852',
    change: '+0.32%',
    changePercent: 0.32,
    isUp: true,
  },
  {
    symbol: 'GBPUSD',
    name: 'British Pound / US Dollar',
    price: '1.2634',
    change: '-0.15%',
    changePercent: -0.15,
    isUp: false,
  },
  {
    symbol: 'USDJPY',
    name: 'US Dollar / Japanese Yen',
    price: '149.82',
    change: '+0.45%',
    changePercent: 0.45,
    isUp: true,
  },
  {
    symbol: 'XAUUSD',
    name: 'Gold / US Dollar',
    price: '2024.50',
    change: '+1.20%',
    changePercent: 1.2,
    isUp: true,
  },
  {
    symbol: 'BTCUSD',
    name: 'Bitcoin / US Dollar',
    price: '43250.00',
    change: '-2.10%',
    changePercent: -2.1,
    isUp: false,
  },
];

// Available symbols to add
const availableSymbols: WatchlistItem[] = [
  {
    symbol: 'AUDUSD',
    name: 'Australian Dollar / US Dollar',
    price: '0.6542',
    change: '+0.18%',
    changePercent: 0.18,
    isUp: true,
  },
  {
    symbol: 'USDCAD',
    name: 'US Dollar / Canadian Dollar',
    price: '1.3521',
    change: '-0.22%',
    changePercent: -0.22,
    isUp: false,
  },
  {
    symbol: 'NZDUSD',
    name: 'New Zealand Dollar / US Dollar',
    price: '0.6123',
    change: '+0.05%',
    changePercent: 0.05,
    isUp: true,
  },
  {
    symbol: 'USDCHF',
    name: 'US Dollar / Swiss Franc',
    price: '0.8845',
    change: '+0.12%',
    changePercent: 0.12,
    isUp: true,
  },
  {
    symbol: 'ETHUSD',
    name: 'Ethereum / US Dollar',
    price: '2285.50',
    change: '-1.45%',
    changePercent: -1.45,
    isUp: false,
  },
  {
    symbol: 'XAGUSD',
    name: 'Silver / US Dollar',
    price: '23.45',
    change: '+0.85%',
    changePercent: 0.85,
    isUp: true,
  },
];

type SortOption = 'symbol' | 'price' | 'change';

const Watchlist = () => {
  const { getLimit, canUseFeature } = useSubscription();
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>(initialWatchlist);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('symbol');
  const [sortAsc, setSortAsc] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [addSearchQuery, setAddSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const watchlistLimit = getLimit('watchlistItems');
  const canAddMore = canUseFeature('watchlistItems', watchlist.length);

  const handleRefresh = useCallback(async () => {
    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setIsLoading(false);
  }, []);

  const { containerRef, pullDistance, isRefreshing } = usePullToRefresh({
    onRefresh: handleRefresh,
  });

  // Filter and sort watchlist
  const filteredWatchlist = useMemo(() => {
    let result = watchlist.filter(
      (item) =>
        item.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    result.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'symbol':
          comparison = a.symbol.localeCompare(b.symbol);
          break;
        case 'price':
          comparison = parseFloat(a.price) - parseFloat(b.price);
          break;
        case 'change':
          comparison = a.changePercent - b.changePercent;
          break;
      }
      return sortAsc ? comparison : -comparison;
    });

    return result;
  }, [watchlist, searchQuery, sortBy, sortAsc]);

  // Available symbols not in watchlist
  const addableSymbols = useMemo(() => {
    const watchlistSymbols = new Set(watchlist.map((item) => item.symbol));
    return availableSymbols
      .filter((item) => !watchlistSymbols.has(item.symbol))
      .filter(
        (item) =>
          item.symbol.toLowerCase().includes(addSearchQuery.toLowerCase()) ||
          item.name.toLowerCase().includes(addSearchQuery.toLowerCase())
      );
  }, [watchlist, addSearchQuery]);

  const handleAddSymbol = (item: WatchlistItem) => {
    if (!canAddMore) {
      toast.error(
        `Watchlist limit reached (${watchlistLimit} items). Upgrade to add more.`
      );
      return;
    }
    setWatchlist((prev) => [...prev, item]);
    setAddSearchQuery('');
  };

  const handleRemoveSymbol = (symbol: string) => {
    setWatchlist((prev) => prev.filter((item) => item.symbol !== symbol));
  };

  const handleSort = (option: SortOption) => {
    if (sortBy === option) {
      setSortAsc(!sortAsc);
    } else {
      setSortBy(option);
      setSortAsc(true);
    }
  };

  const getSortLabel = () => {
    const labels: Record<SortOption, string> = {
      symbol: 'Symbol',
      price: 'Price',
      change: 'Change',
    };
    return `${labels[sortBy]} ${sortAsc ? '↑' : '↓'}`;
  };

  const openAddDialog = () => {
    setIsAddDialogOpen(true);
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background px-4 py-3">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Watchlist</h1>
            <div className="flex items-center gap-2">
              <p className="text-sm text-muted-foreground">
                {watchlist.length} symbols tracked
              </p>
              <UsageLimitIndicator
                feature="watchlistItems"
                currentUsage={watchlist.length}
              />
            </div>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1">
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[90vw] rounded-lg">
              <DialogHeader>
                <DialogTitle>Add Symbol</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search symbols..."
                    value={addSearchQuery}
                    onChange={(e) => setAddSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="max-h-[300px] space-y-2 overflow-y-auto">
                  {addableSymbols.length > 0 ? (
                    addableSymbols.map((item) => (
                      <Card
                        key={item.symbol}
                        className="cursor-pointer transition-colors hover:bg-accent"
                        onClick={() => handleAddSymbol(item)}
                      >
                        <CardContent className="flex items-center justify-between p-3">
                          <div>
                            <p className="font-semibold text-foreground">
                              {item.symbol}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {item.name}
                            </p>
                          </div>
                          <Plus className="h-4 w-4 text-primary" />
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <p className="py-4 text-center text-muted-foreground">
                      No symbols available
                    </p>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search and Sort */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search watchlist..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="shrink-0 gap-1">
                <ArrowUpDown className="h-4 w-4" />
                <span className="hidden sm:inline">{getSortLabel()}</span>
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleSort('symbol')}>
                Sort by Symbol {sortBy === 'symbol' && (sortAsc ? '↑' : '↓')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSort('price')}>
                Sort by Price {sortBy === 'price' && (sortAsc ? '↑' : '↓')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSort('change')}>
                Sort by Change {sortBy === 'change' && (sortAsc ? '↑' : '↓')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Watchlist Items */}
      <div
        ref={containerRef}
        className="relative flex-1 space-y-2 overflow-y-auto p-4 pb-24"
      >
        <PullToRefreshIndicator
          pullDistance={pullDistance}
          isRefreshing={isRefreshing}
        />

        {isLoading ? (
          <WatchlistSkeleton />
        ) : filteredWatchlist.length > 0 ? (
          filteredWatchlist.map((item) => (
            <SwipeableItem
              key={item.symbol}
              onDelete={() => handleRemoveSymbol(item.symbol)}
            >
              <Card className="rounded-none border-0 bg-card">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
                        <span className="text-xs font-bold text-secondary-foreground">
                          {item.symbol.slice(0, 2)}
                        </span>
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">
                          {item.symbol}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {item.name}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="font-bold text-foreground">
                          {item.price}
                        </p>
                        <div className="flex items-center justify-end gap-1">
                          {item.isUp ? (
                            <TrendingUp className="h-3 w-3 text-green-500" />
                          ) : (
                            <TrendingDown className="h-3 w-3 text-destructive" />
                          )}
                          <span
                            className={`text-sm font-medium ${
                              item.isUp ? 'text-green-500' : 'text-destructive'
                            }`}
                          >
                            {item.change}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </SwipeableItem>
          ))
        ) : searchQuery ? (
          <SearchEmpty />
        ) : (
          <WatchlistEmpty onAdd={openAddDialog} />
        )}
      </div>
    </div>
  );
};

export default Watchlist;
