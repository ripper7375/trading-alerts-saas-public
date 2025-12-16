'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Lock,
  MoreVertical,
  BarChart3,
  X,
  Plus,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type UserTier = 'FREE' | 'PRO';

type WatchlistItem = {
  id: string;
  symbol: string;
  symbolName: string;
  timeframe: string;
  timeframeName: string;
  currentPrice: number;
  priceChange: number;
  priceChangePercent: number;
  status: 'support' | 'resistance' | 'normal';
  statusMessage: string;
  lastUpdated: string;
  borderColor: string;
};

type Symbol = {
  id: string;
  name: string;
  description: string;
  icon: string;
  tier: 'FREE' | 'PRO';
};

type Timeframe = {
  id: string;
  name: string;
  tier: 'FREE' | 'PRO';
};

const SYMBOLS: Symbol[] = [
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

const TIMEFRAMES: Timeframe[] = [
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

const SAMPLE_WATCHLIST: WatchlistItem[] = [
  {
    id: '1',
    symbol: 'XAUUSD',
    symbolName: 'Gold',
    timeframe: 'H1',
    timeframeName: '1 Hour',
    currentPrice: 2650.5,
    priceChange: 12.5,
    priceChangePercent: 0.47,
    status: 'support',
    statusMessage: '✓ Near B-B1 Support (+0.21%)',
    lastUpdated: '5s ago',
    borderColor: 'border-green-500',
  },
  {
    id: '2',
    symbol: 'BTCUSD',
    symbolName: 'Bitcoin',
    timeframe: 'H4',
    timeframeName: '4 Hours',
    currentPrice: 43250.0,
    priceChange: -125.0,
    priceChangePercent: -0.29,
    status: 'normal',
    statusMessage: '📊 Normal trading range',
    lastUpdated: '12s ago',
    borderColor: 'border-blue-500',
  },
  {
    id: '3',
    symbol: 'EURUSD',
    symbolName: 'Euro / US Dollar',
    timeframe: 'D1',
    timeframeName: '1 Day',
    currentPrice: 1.0875,
    priceChange: -0.0015,
    priceChangePercent: -0.14,
    status: 'resistance',
    statusMessage: '⚠️ Near P-P2 Resistance (-0.18%)',
    lastUpdated: '8s ago',
    borderColor: 'border-red-500',
  },
];

export default function WatchlistPage() {
  const [userTier, setUserTier] = useState<UserTier>('FREE');
  const [watchlistItems, setWatchlistItems] =
    useState<WatchlistItem[]>(SAMPLE_WATCHLIST);
  const [selectedSymbol, setSelectedSymbol] = useState<string>('');
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>('');
  const [showAddForm, setShowAddForm] = useState(false);

  const tierLimits = {
    FREE: { slots: 5, symbols: 5, timeframes: 3 },
    PRO: { slots: 50, symbols: 15, timeframes: 9 },
  };

  const currentLimit = tierLimits[userTier];
  const usedSlots = watchlistItems.length;

  const availableSymbols = SYMBOLS.filter(
    (s) => userTier === 'PRO' || s.tier === 'FREE'
  );
  const availableTimeframes = TIMEFRAMES.filter(
    (t) => userTier === 'PRO' || t.tier === 'FREE'
  );

  const isComboExists = () => {
    return watchlistItems.some(
      (item) =>
        item.symbol === selectedSymbol && item.timeframe === selectedTimeframe
    );
  };

  const canAdd =
    selectedSymbol &&
    selectedTimeframe &&
    !isComboExists() &&
    usedSlots < currentLimit.slots;

  const handleAddItem = () => {
    if (!canAdd) return;

    const symbol = SYMBOLS.find((s) => s.id === selectedSymbol);
    const timeframe = TIMEFRAMES.find((t) => t.id === selectedTimeframe);

    if (!symbol || !timeframe) return;

    const newItem: WatchlistItem = {
      id: Date.now().toString(),
      symbol: symbol.id,
      symbolName: symbol.description,
      timeframe: timeframe.id,
      timeframeName: timeframe.name,
      currentPrice: Math.random() * 10000,
      priceChange: (Math.random() - 0.5) * 100,
      priceChangePercent: (Math.random() - 0.5) * 2,
      status: ['support', 'normal', 'resistance'][
        Math.floor(Math.random() * 3)
      ] as any,
      statusMessage: '📊 Normal trading range',
      lastUpdated: 'Just now',
      borderColor: 'border-blue-500',
    };

    setWatchlistItems([...watchlistItems, newItem]);
    setSelectedSymbol('');
    setSelectedTimeframe('');
    setShowAddForm(false);
  };

  const handleRemoveItem = (id: string) => {
    setWatchlistItems(watchlistItems.filter((item) => item.id !== id));
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-4 flex items-center gap-2 text-sm text-gray-500">
          <span>Dashboard</span>
          <ChevronRight className="h-4 w-4" />
          <span>Watchlist</span>
        </div>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <h1 className="text-3xl font-bold text-gray-900">📋 My Watchlist</h1>
          <div className="flex items-center gap-4">
            <Badge
              variant="secondary"
              className="bg-gray-100 px-4 py-2 rounded-full font-semibold text-base"
            >
              {usedSlots}/{currentLimit.slots} slots used
            </Badge>
            <Button
              onClick={() => setShowAddForm(!showAddForm)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add New
            </Button>
          </div>
        </div>

        {/* Demo Tier Switcher */}
        <Card className="mb-6 bg-purple-50 border-purple-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-gray-700">
                Demo: Switch Tier
              </span>
              <Button
                variant={userTier === 'FREE' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setUserTier('FREE')}
              >
                FREE
              </Button>
              <Button
                variant={userTier === 'PRO' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setUserTier('PRO')}
              >
                PRO
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Add Item Form */}
        {showAddForm && (
          <Card className="mb-8 shadow-lg">
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
                <Select
                  value={selectedSymbol}
                  onValueChange={setSelectedSymbol}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a symbol" />
                  </SelectTrigger>
                  <SelectContent>
                    {SYMBOLS.map((symbol) => {
                      const isLocked =
                        symbol.tier === 'PRO' && userTier === 'FREE';
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
                                🎉 PRO
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
                    const isLocked =
                      timeframe.tier === 'PRO' && userTier === 'FREE';
                    const isSelected = selectedTimeframe === timeframe.id;
                    return (
                      <button
                        key={timeframe.id}
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
                            🎉 PRO
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
                {isComboExists()
                  ? 'Combination Already Exists'
                  : 'Add to Watchlist'}
              </Button>

              {usedSlots >= currentLimit.slots && (
                <p className="text-sm text-red-600 text-center">
                  ⚠️ You've reached your {currentLimit.slots} slot limit. Remove
                  an item to add more.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Active Watchlist Items */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            📊 Active Watchlist Items ({usedSlots}/{currentLimit.slots}):
          </h2>

          {watchlistItems.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {watchlistItems.map((item) => (
                <Card
                  key={item.id}
                  className={`shadow-md hover:shadow-xl transition-shadow border-l-4 ${item.borderColor}`}
                >
                  <CardContent className="p-6">
                    {/* Top Row */}
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-2xl font-bold text-gray-900">
                          {item.symbol} - {item.timeframe}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {item.symbolName}
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
                          <DropdownMenuItem>
                            <BarChart3 className="h-4 w-4 mr-2" />
                            View Chart
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleRemoveItem(item.id)}
                            className="text-red-600"
                          >
                            <X className="h-4 w-4 mr-2" />
                            Remove
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Price Section */}
                    <div className="mb-4">
                      <p className="text-3xl font-bold text-gray-900">
                        ${item.currentPrice.toFixed(2)}
                      </p>
                      <div
                        className={`flex items-center gap-1 text-lg ${
                          item.priceChange >= 0
                            ? 'text-green-600'
                            : 'text-red-600'
                        }`}
                      >
                        {item.priceChange >= 0 ? (
                          <TrendingUp className="h-5 w-5" />
                        ) : (
                          <TrendingDown className="h-5 w-5" />
                        )}
                        <span>
                          {item.priceChange >= 0 ? '+' : ''}$
                          {Math.abs(item.priceChange).toFixed(2)} (
                          {item.priceChange >= 0 ? '+' : ''}
                          {item.priceChangePercent.toFixed(2)}%)
                        </span>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <Badge
                      variant="secondary"
                      className={`mb-3 ${
                        item.status === 'support'
                          ? 'bg-yellow-100 text-yellow-800'
                          : item.status === 'resistance'
                            ? 'bg-orange-100 text-orange-800'
                            : 'bg-blue-100 text-blue-800'
                      } rounded-full px-3 py-1 text-sm`}
                    >
                      {item.statusMessage}
                    </Badge>

                    {/* Last Updated */}
                    <p className="text-xs text-gray-500 mb-4">
                      Updated {item.lastUpdated}
                    </p>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <Button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm">
                        <BarChart3 className="h-4 w-4 mr-2" />
                        View Chart
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleRemoveItem(item.id)}
                        className="border-2 border-gray-300 hover:border-red-500 hover:text-red-600 text-sm"
                      >
                        <X className="h-4 w-4 mr-1" />
                        Remove
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
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
                    ℹ️ {userTier} Tier: You can add up to {currentLimit.slots}{' '}
                    combinations
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

        {/* Tier Limit Indicator */}
        <Card
          className={`border-l-4 ${userTier === 'FREE' ? 'border-blue-600 bg-gradient-to-r from-blue-50 to-purple-50' : 'border-purple-600 bg-gradient-to-r from-purple-50 to-blue-50'}`}
        >
          <CardContent className="p-6">
            {userTier === 'FREE' ? (
              <div>
                <h3 className="text-lg font-semibold mb-2">
                  ℹ️ FREE Tier Limits
                </h3>
                <p className="text-gray-700 mb-2">
                  You can add up to {currentLimit.slots} symbol+timeframe
                  combinations
                </p>
                <div className="space-y-1 mb-3">
                  <p className="text-sm text-gray-600">
                    <strong>Symbols:</strong> {currentLimit.symbols} available
                    (BTCUSD, EURUSD, USDJPY, US30, XAUUSD)
                  </p>
                  <p className="text-sm text-gray-600">
                    <strong>Timeframes:</strong> H1, H4, D1 only
                  </p>
                </div>
                <Button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg mt-3">
                  Upgrade to PRO for 50 watchlist items
                </Button>
              </div>
            ) : (
              <div>
                <h3 className="text-lg font-semibold mb-2">
                  ⭐ PRO Tier Benefits
                </h3>
                <p className="text-gray-700 mb-3">
                  You have {currentLimit.slots} watchlist slots with all symbols
                  and timeframes
                </p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm text-gray-600">
                    <span>
                      Using {usedSlots}/{currentLimit.slots} slots (
                      {Math.round((usedSlots / currentLimit.slots) * 100)}
                      %)
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-purple-600 to-blue-600 h-full rounded-full transition-all"
                      style={{
                        width: `${(usedSlots / currentLimit.slots) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
