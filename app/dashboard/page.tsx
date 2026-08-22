import {
  Bell,
  Zap,
  TrendingUp,
  Lightbulb,
  BarChart3,
  Clock,
  LineChart,
} from 'lucide-react';
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
import AppHeader from '@/components/layout/app-header';
import { RecentAlerts } from '@/components/dashboard/recent-alerts';
import { StatsCard } from '@/components/dashboard/stats-card';
import { UpgradePrompt } from '@/components/dashboard/upgrade-prompt';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/db/prisma';
import { TIER_CONFIG, type Tier } from '@/types/tier';

/**
 * Dashboard Overview Page — V8 single-symbol architecture
 *
 * Server component that displays:
 * - Welcome message with tier badge
 * - Quick start tips
 * - Stats cards (XAUUSD M5/M15, alerts, API usage)
 * - Recent alerts widget
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

  try {
    // Fetch alert count
    alertCount = await prisma.alert.count({
      where: { userId },
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
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    // Continue with empty data - dashboard should still render
  }

  // Get tier limits (with fallback to FREE if tier is invalid)
  const tierConfig = TIER_CONFIG[userTier] ?? TIER_CONFIG.FREE;

  // V8 tier stats: both tiers share XAUUSD × M5/M15
  const tierStats = {
    symbols: 1,
    timeframes: 2,
    combinations: 2,
    maxAlerts: tierConfig.maxAlerts,
  };

  return (
    <div className="flex h-screen w-full flex-col overflow-y-auto bg-background">
      <AppHeader
        title="Main Terminal Dashboard"
        subtitle="Real-Time XAUUSD Quantitative Overview & Alert Telemetry"
        tier={userTier}
      />

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 p-4 md:p-6">
        {/* Hero Banner */}
        <div className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-card p-6 shadow-xl">
          <div className="relative z-10 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
            <div className="max-w-xl space-y-1">
              <Badge
                className={
                  userTier === 'PRO'
                    ? 'border-amber-500/50 bg-amber-500/20 font-mono text-[10px] text-amber-700 dark:text-amber-300'
                    : 'border-border bg-muted font-mono text-[10px] text-muted-foreground'
                }
              >
                {userTier === 'PRO' ? '⚡ PRO TIER' : '🆓 FREE TIER'}
              </Badge>
              <h1 className="text-xl font-extrabold tracking-tight text-foreground">
                Welcome back, {userName.split(' ')[0]}!
              </h1>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Here&apos;s what&apos;s happening with your trading alerts.
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Button
                asChild
                className="h-9 bg-gradient-to-r from-amber-500 to-amber-600 text-xs font-extrabold text-slate-950 shadow-lg shadow-amber-500/20 hover:from-amber-400 hover:to-amber-500"
              >
                <a href={userTier === 'PRO' ? '/terminal' : '/free'}>
                  <LineChart className="mr-1.5 h-4 w-4" />
                  Launch AI Analyst Workbench
                </a>
              </Button>
            </div>
          </div>
        </div>

        {/* Quick Start Tips */}
        <Card className="border-l-4 border-l-amber-500 bg-amber-500/5">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-start gap-3">
              <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
              <div className="flex-1">
                <h2 className="mb-2 font-semibold text-foreground">
                  Quick Start Tips
                </h2>
                <ol className="space-y-1.5 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/20 text-xs font-medium text-amber-700 dark:text-amber-300">
                      1
                    </span>
                    Open the XAUUSD chart on M5 or M15
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/20 text-xs font-medium text-amber-700 dark:text-amber-300">
                      2
                    </span>
                    Explore channel and structure overlays
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/20 text-xs font-medium text-amber-700 dark:text-amber-300">
                      3
                    </span>
                    {userTier === 'PRO'
                      ? 'Create alerts for price levels or from chart drawings'
                      : 'Upgrade to PRO to create price alerts'}
                  </li>
                </ol>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tier Stats Cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 sm:gap-6">
          <StatsCard
            title="Symbol"
            value="XAUUSD"
            icon={BarChart3}
            description="Gold — full data access"
          />
          <StatsCard
            title="Timeframes"
            value={`${tierStats.timeframes}`}
            icon={Clock}
            description="M5, M15"
          />
          <StatsCard
            title="Charts"
            value={`${tierStats.combinations}`}
            icon={LineChart}
            description="XAUUSD × M5/M15"
          />
          <StatsCard
            title="Max Alerts"
            value={`${tierStats.maxAlerts}`}
            icon={Bell}
            description={
              userTier === 'PRO' ? `${alertCount} active` : 'PRO feature'
            }
          />
        </div>

        {/* Usage Stats Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-6">
          <StatsCard
            title="Active Alerts"
            value={
              userTier === 'PRO'
                ? `${alertCount}/${tierConfig.maxAlerts}`
                : 'PRO only'
            }
            icon={Bell}
            variant="usage"
            current={alertCount}
            max={Math.max(tierConfig.maxAlerts, 1)}
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
        <div className="grid grid-cols-1 gap-6">
          <RecentAlerts alerts={recentAlerts} />
        </div>

        {/* Upgrade Prompt for FREE Users */}
        {userTier === 'FREE' && <UpgradePrompt />}
      </main>
    </div>
  );
}
