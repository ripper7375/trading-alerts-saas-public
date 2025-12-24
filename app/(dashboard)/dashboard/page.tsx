import { Bell, Eye, Zap, TrendingUp, Lightbulb } from 'lucide-react';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';

// Database entity types for TypeScript (Prisma types may not be generated yet)
interface DbAlert {
  id: string;
  name: string | null;
  symbol: string;
  timeframe: string;
  condition: string; // JSON string for complex conditions
  alertType: string;
  isActive: boolean;
  lastTriggered: Date | null;
  triggerCount: number;
  createdAt: Date;
}

interface DbWatchlistItem {
  id: string;
  symbol: string;
  timeframe: string;
  createdAt: Date;
}
import { RecentAlerts } from '@/components/dashboard/recent-alerts';
import { StatsCard } from '@/components/dashboard/stats-card';
import { UpgradePrompt } from '@/components/dashboard/upgrade-prompt';
import { WatchlistWidget } from '@/components/dashboard/watchlist-widget';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/db/prisma';
import { TIER_CONFIG, type Tier } from '@/types/tier';

/**
 * Dashboard Overview Page
 *
 * Server component that displays:
 * - Welcome message with tier badge
 * - Quick start tips (dismissible)
 * - Stats cards (alerts, watchlist, API usage, chart views)
 * - Recent alerts widget
 * - Watchlist widget
 * - Upgrade prompt for FREE users
 */
export default async function DashboardPage(): Promise<React.ReactElement> {
  // Get session
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/login');
  }

  const userId = session.user.id;
  const userTier = (session.user.tier || 'FREE') as Tier;
  const userName = session.user.name || 'User';

  // Fetch user data from database
  let alertCount = 0;
  let watchlistCount = 0;
  let recentAlerts: {
    id: string;
    status: 'watching' | 'triggered' | 'paused';
    title: string;
    symbol: string;
    timeframe: string;
    targetPrice: number;
    currentPrice: number;
    createdAt: string;
  }[] = [];
  let watchlistItems: {
    id: string;
    symbol: string;
    timeframe: string;
    currentPrice: number;
    change: number;
    changePercent: number;
    status?: 'approaching' | 'neutral' | 'away';
    lastUpdated: string;
  }[] = [];

  try {
    // Fetch alert count
    alertCount = await prisma.alert.count({
      where: { userId },
    });

    // Fetch watchlist count
    watchlistCount = await prisma.watchlistItem.count({
      where: { watchlist: { userId } },
    });

    // Fetch recent alerts (last 5)
    const dbAlerts = await prisma.alert.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    recentAlerts = (dbAlerts as DbAlert[]).map((alert: DbAlert) => {
      // Derive status from isActive and lastTriggered
      let status: 'watching' | 'triggered' | 'paused' = 'watching';
      if (!alert.isActive) {
        status = 'paused';
      } else if (alert.lastTriggered) {
        status = 'triggered';
      }

      // Try to extract target price from condition JSON, fallback to placeholder
      let targetPrice = 100.0; // Placeholder - would come from condition or real-time data
      try {
        const conditionData = JSON.parse(alert.condition);
        if (conditionData.targetPrice) {
          targetPrice = conditionData.targetPrice;
        } else if (conditionData.price) {
          targetPrice = conditionData.price;
        }
      } catch {
        // Condition is not valid JSON or doesn't have price, use placeholder
      }

      return {
        id: alert.id,
        status,
        title: alert.name || `${alert.symbol} Alert`,
        symbol: alert.symbol,
        timeframe: alert.timeframe,
        targetPrice,
        currentPrice: targetPrice * 0.98, // Placeholder - would come from real-time data
        createdAt: alert.createdAt.toISOString(),
      };
    });

    // Fetch watchlist items (last 5)
    const dbWatchlistItems = await prisma.watchlistItem.findMany({
      where: { watchlist: { userId } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    watchlistItems = (dbWatchlistItems as DbWatchlistItem[]).map(
      (item: DbWatchlistItem) => ({
        id: item.id,
        symbol: item.symbol,
        timeframe: item.timeframe,
        currentPrice: 100.0, // Placeholder - would come from real-time data
        change: Math.random() * 10 - 5, // Placeholder
        changePercent: Math.random() * 5 - 2.5, // Placeholder
        status: 'neutral' as const,
        lastUpdated: new Date().toISOString(),
      })
    );
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    // Continue with empty data - dashboard should still render
  }

  // Get tier limits
  const tierConfig = TIER_CONFIG[userTier];

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
            Welcome back, {userName.split(' ')[0]}!
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Here&apos;s what&apos;s happening with your trading alerts
          </p>
        </div>
        <Badge
          className={
            userTier === 'PRO'
              ? 'bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-sm'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200 px-4 py-2 text-sm'
          }
        >
          {userTier === 'PRO' ? '⭐ PRO TIER' : '🆓 FREE TIER'}
        </Badge>
      </div>

      {/* Quick Start Tips */}
      <Card className="border-l-4 border-l-blue-600 bg-blue-50 dark:bg-blue-900/20">
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-start gap-3">
            <Lightbulb className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h2 className="font-semibold text-gray-900 dark:text-white mb-2">
                Quick Start Tips
              </h2>
              <ol className="space-y-1.5 text-sm text-gray-700 dark:text-gray-300">
                <li className="flex items-center gap-2">
                  <span className="bg-blue-100 text-blue-700 rounded-full w-5 h-5 flex items-center justify-center text-xs font-medium">
                    1
                  </span>
                  Add symbols to your Watchlist
                </li>
                <li className="flex items-center gap-2">
                  <span className="bg-blue-100 text-blue-700 rounded-full w-5 h-5 flex items-center justify-center text-xs font-medium">
                    2
                  </span>
                  View live charts with fractal lines
                </li>
                <li className="flex items-center gap-2">
                  <span className="bg-blue-100 text-blue-700 rounded-full w-5 h-5 flex items-center justify-center text-xs font-medium">
                    3
                  </span>
                  Create alerts for price levels
                </li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <StatsCard
          title="Active Alerts"
          value={`${alertCount}/${tierConfig.maxAlerts}`}
          icon={Bell}
          variant="usage"
          current={alertCount}
          max={tierConfig.maxAlerts}
        />
        <StatsCard
          title="Watchlist Items"
          value={`${watchlistCount}/${tierConfig.maxWatchlists * 10}`}
          icon={Eye}
          variant="usage"
          current={watchlistCount}
          max={tierConfig.maxWatchlists * 10}
        />
        <StatsCard
          title="API Usage"
          value="42/60"
          description="requests this hour"
          icon={Zap}
          variant="usage"
          current={42}
          max={60}
        />
        <StatsCard
          title="Chart Views"
          value="156"
          description="this week"
          icon={TrendingUp}
          change={12}
          changeLabel="from last week"
        />
      </div>

      {/* Widgets Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <WatchlistWidget items={watchlistItems} />
        <RecentAlerts alerts={recentAlerts} />
      </div>

      {/* Upgrade Prompt for FREE Users */}
      {userTier === 'FREE' && <UpgradePrompt />}
    </div>
  );
}
