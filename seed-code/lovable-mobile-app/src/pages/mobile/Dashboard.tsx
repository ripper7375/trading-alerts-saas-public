import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  TrendingUp,
  TrendingDown,
  Bell,
  Eye,
  Activity,
  BarChart3,
  Plus,
  ChevronRight,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import PortfolioSummary from '@/components/dashboard/PortfolioSummary';
import StatCard from '@/components/dashboard/StatCard';
import MarketItem from '@/components/dashboard/MarketItem';
import AlertItem from '@/components/dashboard/AlertItem';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { PullToRefreshIndicator } from '@/components/mobile/PullToRefresh';
import { DashboardSkeleton } from '@/components/mobile/Skeletons';
import { EmptyState } from '@/components/mobile/EmptyState';

// Mock data - will be replaced with API data
const portfolioData = {
  totalBalance: 125847.32,
  dailyChange: 1234.56,
  dailyChangePercent: 0.99,
};

const statsData = [
  {
    title: 'Watchlist',
    value: '12',
    icon: Eye,
    trend: '+2 today',
    trendType: 'positive' as const,
  },
  {
    title: 'Active Alerts',
    value: '5',
    icon: Bell,
    trend: '3 triggered',
    trendType: 'neutral' as const,
  },
  {
    title: 'Gainers',
    value: '8',
    icon: TrendingUp,
    trend: '+4.2% avg',
    trendType: 'positive' as const,
  },
  {
    title: 'Losers',
    value: '4',
    icon: TrendingDown,
    trend: '-2.1% avg',
    trendType: 'negative' as const,
  },
];

const marketData = [
  {
    symbol: 'EUR/USD',
    name: 'Euro / US Dollar',
    price: 1.08542,
    change: 0.00123,
    changePercent: 0.11,
  },
  {
    symbol: 'GBP/USD',
    name: 'British Pound / US Dollar',
    price: 1.26891,
    change: -0.00234,
    changePercent: -0.18,
  },
  {
    symbol: 'USD/JPY',
    name: 'US Dollar / Japanese Yen',
    price: 149.234,
    change: 0.456,
    changePercent: 0.31,
  },
  {
    symbol: 'XAU/USD',
    name: 'Gold / US Dollar',
    price: 2024.56,
    change: 12.34,
    changePercent: 0.61,
  },
];

const recentAlerts = [
  {
    symbol: 'EUR/USD',
    condition: 'Price crossed above 1.0850',
    triggeredAt: '2m ago',
    status: 'triggered' as const,
  },
  {
    symbol: 'GBP/USD',
    condition: 'RSI below 30',
    triggeredAt: '15m ago',
    status: 'triggered' as const,
  },
  {
    symbol: 'USD/JPY',
    condition: 'Price target 150.00',
    triggeredAt: 'Pending',
    status: 'pending' as const,
  },
];

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const handleRefresh = useCallback(async () => {
    setIsLoading(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setIsLoading(false);
  }, []);

  const { containerRef, pullDistance, isRefreshing } = usePullToRefresh({
    onRefresh: handleRefresh,
  });

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Welcome back, {user?.email?.split('@')[0] || 'Trader'}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            onClick={() => navigate('/notifications')}
          >
            <Bell className="h-5 w-5" />
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
              3
            </span>
          </Button>
        </div>
      </header>

      {/* Content */}
      <div
        ref={containerRef}
        className="relative flex-1 space-y-4 overflow-y-auto p-4 pb-24"
      >
        <PullToRefreshIndicator
          pullDistance={pullDistance}
          isRefreshing={isRefreshing}
        />

        {isLoading ? (
          <DashboardSkeleton />
        ) : (
          <>
            {/* Portfolio Summary */}
            <PortfolioSummary
              totalBalance={portfolioData.totalBalance}
              dailyChange={portfolioData.dailyChange}
              dailyChangePercent={portfolioData.dailyChangePercent}
            />

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3">
              {statsData.map((stat) => (
                <StatCard
                  key={stat.title}
                  title={stat.title}
                  value={stat.value}
                  icon={stat.icon}
                  trend={stat.trend}
                  trendType={stat.trendType}
                />
              ))}
            </div>

            {/* Market Overview */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Activity className="h-4 w-4 text-primary" />
                    Market Overview
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-primary"
                    onClick={() => navigate('/charts')}
                  >
                    View All
                    <ChevronRight className="ml-1 h-3 w-3" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {marketData.length > 0 ? (
                  marketData.map((item) => (
                    <MarketItem
                      key={item.symbol}
                      symbol={item.symbol}
                      name={item.name}
                      price={item.price}
                      change={item.change}
                      changePercent={item.changePercent}
                    />
                  ))
                ) : (
                  <EmptyState variant="data" />
                )}
              </CardContent>
            </Card>

            {/* Recent Alerts */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Bell className="h-4 w-4 text-primary" />
                    Recent Alerts
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-primary"
                    onClick={() => navigate('/alerts')}
                  >
                    View All
                    <ChevronRight className="ml-1 h-3 w-3" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {recentAlerts.length > 0 ? (
                  recentAlerts.map((alert, index) => (
                    <AlertItem
                      key={index}
                      symbol={alert.symbol}
                      condition={alert.condition}
                      triggeredAt={alert.triggeredAt}
                      status={alert.status}
                    />
                  ))
                ) : (
                  <EmptyState variant="alerts" />
                )}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-3">
              <Button
                className="h-12 gap-2"
                onClick={() => navigate('/alerts')}
              >
                <Plus className="h-4 w-4" />
                Add Alert
              </Button>
              <Button
                variant="secondary"
                className="h-12 gap-2"
                onClick={() => navigate('/charts')}
              >
                <BarChart3 className="h-4 w-4" />
                View Charts
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
