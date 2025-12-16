'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Bell,
  ListIcon,
  Zap,
  TrendingUp,
  Lightbulb,
  X,
  Plus,
  ArrowUpIcon,
  Clock,
  CheckCircle2,
  PauseCircle,
} from 'lucide-react';

type UserTier = 'FREE' | 'PRO';

interface Stats {
  watchlist: {
    current: number;
    max: number;
  };
  alerts: {
    current: number;
    max: number;
  };
  apiUsage: {
    current: number;
    max: number;
  };
  chartViews: {
    current: number;
    trend: string;
  };
}

interface WatchlistItem {
  symbol: string;
  timeframe: string;
  currentPrice: number;
  change: number;
  changePercent: number;
  status: string;
  statusDistance: number;
  lastUpdated: string;
}

interface Alert {
  id: string;
  status: 'watching' | 'triggered' | 'paused';
  title: string;
  symbol: string;
  timeframe: string;
  targetPrice: number;
  currentPrice: number;
  distance: number;
  distancePercent: number;
  createdAt: string;
}

interface DashboardHomeProps {
  userName: string;
  userTier: UserTier;
  stats: Stats;
  watchlistItems: WatchlistItem[];
  alerts: Alert[];
}

export default function DashboardHome({
  userName,
  userTier,
  stats,
  watchlistItems,
  alerts,
}: DashboardHomeProps) {
  const [showQuickTips, setShowQuickTips] = useState(true);

  const watchlistPercentage =
    (stats.watchlist.current / stats.watchlist.max) * 100;
  const alertsPercentage = (stats.alerts.current / stats.alerts.max) * 100;
  const apiUsagePercentage =
    (stats.apiUsage.current / stats.apiUsage.max) * 100;
  const isApiHighUsage = apiUsagePercentage > 80;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        {/* Welcome Section */}
        <div className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <h1 className="text-3xl font-bold text-gray-900">
            👋 Welcome, {userName}!
          </h1>
          <Badge
            className={`${
              userTier === 'FREE'
                ? 'bg-green-500 text-white hover:bg-green-600'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            } rounded-full px-4 py-2 text-sm font-semibold`}
          >
            {userTier === 'FREE' ? 'FREE TIER 🆓' : 'PRO TIER ⭐'}
          </Badge>
        </div>

        {/* Quick Start Tips */}
        {showQuickTips && (
          <Card className="relative mb-8 border-l-4 border-blue-600 bg-blue-50">
            <CardContent className="p-6">
              <button
                onClick={() => setShowQuickTips(false)}
                className="absolute right-4 top-4 text-gray-500 hover:text-gray-700 transition-colors"
                aria-label="Dismiss quick tips"
              >
                <X className="size-5" />
              </button>
              <div className="flex items-start gap-3">
                <Lightbulb className="size-6 text-blue-600 shrink-0 mt-1" />
                <div>
                  <h2 className="mb-3 text-lg font-semibold text-gray-900">
                    ⚡ Quick Start Tips:
                  </h2>
                  <ol className="space-y-2 text-sm text-gray-700 list-decimal list-inside">
                    <li>Add symbols to your Watchlist</li>
                    <li>View live charts with fractal lines</li>
                    <li>Create your first alert</li>
                  </ol>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Cards */}
        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {/* Watchlist Card */}
          <Card className="bg-white">
            <CardContent className="p-6">
              <div className="mb-4 text-4xl">
                <ListIcon className="size-10 text-gray-400" />
              </div>
              <div className="mb-2 text-sm font-semibold uppercase text-gray-600">
                Watchlist
              </div>
              <div className="mb-1 text-4xl font-bold text-gray-900">
                {stats.watchlist.current}/{stats.watchlist.max}
              </div>
              <div className="mb-3 text-sm text-gray-500">symbols</div>
              <Progress
                value={watchlistPercentage}
                className="h-2 bg-gray-200"
              />
            </CardContent>
          </Card>

          {/* Alerts Card */}
          <Card className="bg-white">
            <CardContent className="p-6">
              <div className="mb-4 text-4xl">
                <Bell className="size-10 text-gray-400" />
              </div>
              <div className="mb-2 text-sm font-semibold uppercase text-gray-600">
                Alerts
              </div>
              <div className="mb-1 text-4xl font-bold text-gray-900">
                {stats.alerts.current}/{stats.alerts.max}
              </div>
              <div className="mb-3 text-sm text-gray-500">active</div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                <div
                  className="h-full bg-green-600 transition-all"
                  style={{ width: `${alertsPercentage}%` }}
                />
              </div>
            </CardContent>
          </Card>

          {/* API Usage Card */}
          <Card className="bg-white">
            <CardContent className="p-6">
              <div className="mb-4 text-4xl">
                <Zap className="size-10 text-gray-400" />
              </div>
              <div className="mb-2 text-sm font-semibold uppercase text-gray-600">
                API Usage
              </div>
              <div className="mb-1 text-4xl font-bold text-gray-900">
                {stats.apiUsage.current}/{stats.apiUsage.max}
              </div>
              <div className="mb-3 text-sm text-gray-500">req/hour</div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                <div
                  className="h-full bg-yellow-500 transition-all"
                  style={{ width: `${apiUsagePercentage}%` }}
                />
              </div>
              {isApiHighUsage && (
                <div className="mt-2 text-xs text-orange-600 flex items-center gap-1">
                  ⚠️ High usage
                </div>
              )}
            </CardContent>
          </Card>

          {/* Chart Views Card */}
          <Card className="bg-white">
            <CardContent className="p-6">
              <div className="mb-4 text-4xl">
                <TrendingUp className="size-10 text-gray-400" />
              </div>
              <div className="mb-2 text-sm font-semibold uppercase text-gray-600">
                Chart Views
              </div>
              <div className="mb-1 text-4xl font-bold text-gray-900">
                {stats.chartViews.current}
              </div>
              <div className="mb-3 text-sm text-gray-500">this week</div>
              <div className="flex items-center gap-1 text-xs text-green-600">
                <ArrowUpIcon className="size-3" />
                {stats.chartViews.trend}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Your Watchlist Section */}
        <div className="mb-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">
              📊 Your Watchlist
            </h2>
            <Button className="bg-blue-600 text-white hover:bg-blue-700 rounded-lg">
              <Plus className="size-4" />
              Add Symbol
            </Button>
          </div>

          {watchlistItems.length > 0 ? (
            <div className="space-y-4">
              {watchlistItems.map((item, index) => (
                <Card
                  key={index}
                  className="bg-white transition-shadow hover:shadow-md"
                >
                  <CardContent className="p-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      {/* Left: Symbol + Timeframe */}
                      <div className="flex-1">
                        <div className="text-xl font-bold text-gray-900">
                          {item.symbol} - {item.timeframe}
                        </div>
                      </div>

                      {/* Center: Current Price */}
                      <div className="flex-1 text-center lg:text-left">
                        <div className="text-2xl font-semibold text-gray-900">
                          ${item.currentPrice.toFixed(2)}
                        </div>
                      </div>

                      {/* Right: Change, Status, Actions */}
                      <div className="flex-1 space-y-2">
                        <div
                          className={`text-sm font-semibold ${item.change >= 0 ? 'text-green-600' : 'text-red-600'}`}
                        >
                          {item.change >= 0 ? '+' : ''}${item.change.toFixed(2)}{' '}
                          ({item.change >= 0 ? '+' : ''}
                          {item.changePercent.toFixed(2)}%)
                        </div>
                        <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200 text-xs">
                          ✓ {item.status} ({item.change >= 0 ? '+' : ''}
                          {item.statusDistance.toFixed(2)}%)
                        </Badge>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="bg-gray-100 hover:bg-gray-200"
                          >
                            View Chart
                          </Button>
                          <span className="text-xs text-gray-500">
                            Updated {item.lastUpdated}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="border-2 border-dashed border-gray-300 bg-gray-50">
              <CardContent className="p-12 text-center">
                <div className="mb-4 text-6xl opacity-50">📋</div>
                <h3 className="mb-2 text-xl text-gray-500">No symbols yet.</h3>
                <p className="mb-4 text-sm text-gray-400">
                  Add your first symbol to start monitoring
                </p>
                <Button className="bg-blue-600 text-white hover:bg-blue-700 rounded-lg px-6 py-3">
                  <Plus className="size-4" />
                  Add Symbol to Watchlist
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Recent Alerts Section */}
        <div className="mb-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">
              🔔 Recent Alerts
            </h2>
            <a href="#" className="text-blue-600 hover:underline text-sm">
              View All
            </a>
          </div>

          {alerts.length > 0 ? (
            <div className="space-y-4">
              {alerts.map((alert) => {
                const borderColor =
                  alert.status === 'watching'
                    ? 'border-green-500'
                    : alert.status === 'triggered'
                      ? 'border-orange-500'
                      : 'border-gray-300';

                const StatusIcon =
                  alert.status === 'watching'
                    ? Clock
                    : alert.status === 'triggered'
                      ? CheckCircle2
                      : PauseCircle;

                return (
                  <Card
                    key={alert.id}
                    className={`bg-white border-l-4 ${borderColor}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <StatusIcon className="size-6 shrink-0 mt-1 text-gray-600" />
                        <div className="flex-1 space-y-1">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {alert.title}
                          </h3>
                          <p className="text-sm text-gray-600">
                            {alert.symbol} • {alert.timeframe} • Target: $
                            {alert.targetPrice.toFixed(2)}
                          </p>
                          <p className="text-sm text-gray-700">
                            Current: ${alert.currentPrice.toFixed(2)} |
                            Distance: ${alert.distance.toFixed(2)} (
                            {alert.distance >= 0 ? '+' : ''}
                            {alert.distancePercent.toFixed(2)}%)
                          </p>
                          <p className="text-xs text-gray-500">
                            Created {alert.createdAt}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="border-2 border-dashed border-gray-300 bg-gray-50">
              <CardContent className="p-12 text-center">
                <div className="mb-4 text-6xl opacity-50">🔔</div>
                <h3 className="mb-2 text-xl text-gray-500">
                  You haven't created any alerts yet.
                </h3>
                <p className="mb-4 text-sm text-gray-400">
                  Set up alerts to get notified of price movements
                </p>
                <Button className="bg-blue-600 text-white hover:bg-blue-700 rounded-lg px-6 py-3">
                  Create Your First Alert
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Upgrade Prompt (FREE users only) */}
        {userTier === 'FREE' && (
          <Card className="border-0 bg-gradient-to-r from-blue-500 to-purple-600 text-white">
            <CardContent className="p-8">
              <div className="flex flex-col items-start gap-6 lg:flex-row lg:items-center">
                <div className="text-5xl">⭐</div>
                <div className="flex-1">
                  <h2 className="mb-2 text-2xl font-bold">💡 Upgrade to PRO</h2>
                  <p className="mb-4 text-lg">
                    Get 15 symbols, 9 timeframes, and 20 alerts for just
                    $29/month
                  </p>
                  <ul className="mb-4 space-y-1 text-sm">
                    <li>✓ 15 trading symbols</li>
                    <li>✓ 9 timeframes (M5-D1)</li>
                    <li>✓ 20 active alerts</li>
                    <li>✓ Priority updates (30s)</li>
                  </ul>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Button className="bg-white text-blue-600 font-bold hover:bg-gray-100 shadow-lg rounded-lg px-8 py-3">
                      Upgrade Now - $29/month
                    </Button>
                    <a
                      href="#"
                      className="text-white underline text-sm hover:no-underline"
                    >
                      See full comparison
                    </a>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
