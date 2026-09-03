import {
  Clock,
  CheckCircle2,
  PauseCircle,
  Bell,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface Alert {
  id: string;
  status: 'watching' | 'triggered' | 'paused';
  title: string;
  symbol: string;
  timeframe: string;
  targetPrice: number;
  currentPrice: number;
  createdAt: string;
}

interface RecentAlertsLabels {
  title?: string;
  viewAll?: string;
  watching?: string;
  triggered?: string;
  paused?: string;
  target?: string;
  current?: string;
  distance?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  createFirstAlert?: string;
}

interface RecentAlertsProps {
  alerts: Alert[];
  maxAlerts?: number;
  /**
   * Translated copy -- threaded from the caller (a Server Component that
   * already resolved a dictionary) rather than resolved in here, because
   * this component's own existing test suite renders it synchronously via
   * `@testing-library/react` and an async Server Component can't be
   * rendered by the client test renderer.
   */
  labels?: RecentAlertsLabels;
}

// Status configuration for styling and icons
const statusConfig = {
  watching: {
    icon: Clock,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    borderColor: 'border-l-blue-500',
  },
  triggered: {
    icon: CheckCircle2,
    color: 'text-green-600',
    bgColor: 'bg-green-50 dark:bg-green-900/20',
    borderColor: 'border-l-green-500',
  },
  paused: {
    icon: PauseCircle,
    color: 'text-gray-500',
    bgColor: 'bg-gray-50 dark:bg-gray-800',
    borderColor: 'border-l-gray-400',
  },
};

/**
 * Recent Alerts Widget Component
 *
 * Displays the most recent alerts on the dashboard.
 *
 * Features:
 * - Shows last 5 alerts by default
 * - Status indicators (watching, triggered, paused)
 * - Link to full alerts page
 * - Empty state with CTA to create first alert
 *
 * @param alerts - Array of alert objects
 * @param maxAlerts - Maximum number of alerts to show (default: 5)
 */
export function RecentAlerts({
  alerts,
  maxAlerts = 5,
  labels,
}: RecentAlertsProps): React.ReactElement {
  const displayAlerts = alerts.slice(0, maxAlerts);
  const statusLabel = {
    watching: labels?.watching ?? 'Watching',
    triggered: labels?.triggered ?? 'Triggered',
    paused: labels?.paused ?? 'Paused',
  };

  return (
    <Card
      className="bg-white dark:bg-gray-800"
      data-testid="recent-alerts-card"
    >
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
          <Bell className="h-5 w-5 text-gray-400" />
          {labels?.title ?? 'Recent Alerts'}
        </CardTitle>
        {alerts.length > 0 && (
          <Link href="/alerts">
            <Button
              variant="ghost"
              size="sm"
              className="text-blue-600 hover:text-blue-700"
              data-testid="view-all-alerts"
            >
              {labels?.viewAll ?? 'View All'}
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
        )}
      </CardHeader>
      <CardContent className="pt-0">
        {displayAlerts.length > 0 ? (
          <div className="space-y-3">
            {displayAlerts.map((alert) => {
              const config = statusConfig[alert.status];
              const StatusIcon = config.icon;
              const distance = alert.targetPrice - alert.currentPrice;
              const distancePercent = (distance / alert.currentPrice) * 100;

              return (
                <div
                  key={alert.id}
                  data-testid={`alert-item-${alert.id}`}
                  className={cn(
                    'rounded-lg border-l-4 p-3 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700',
                    config.borderColor,
                    config.bgColor
                  )}
                >
                  <div className="flex items-start gap-3">
                    <StatusIcon
                      className={cn('mt-0.5 h-5 w-5 shrink-0', config.color)}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="truncate font-medium text-gray-900 dark:text-white">
                          {alert.title}
                        </h4>
                        <Badge variant="outline" className="text-xs">
                          {statusLabel[alert.status]}
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
                        {alert.symbol} • {alert.timeframe} •{' '}
                        {labels?.target ?? 'Target'}: $
                        {alert.targetPrice.toFixed(2)}
                      </p>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
                        {labels?.current ?? 'Current'}: $
                        {alert.currentPrice.toFixed(2)} |{' '}
                        {labels?.distance ?? 'Distance'}:{' '}
                        <span
                          className={cn(
                            distance >= 0 ? 'text-green-600' : 'text-red-600'
                          )}
                        >
                          {distance >= 0 ? '+' : ''}
                          {distancePercent.toFixed(2)}%
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Empty State */
          <div className="py-8 text-center" data-testid="recent-alerts-empty">
            <div className="mx-auto mb-4 text-5xl opacity-50">🔔</div>
            <h3 className="mb-2 text-lg font-medium text-gray-600 dark:text-gray-400">
              {labels?.emptyTitle ?? 'No alerts yet'}
            </h3>
            <p className="mb-4 text-sm text-gray-500 dark:text-gray-500">
              {labels?.emptyDescription ??
                'Set up alerts to get notified of price movements'}
            </p>
            <Link href="/alerts/new">
              <Button
                className="bg-blue-600 text-white hover:bg-blue-700"
                data-testid="create-first-alert"
              >
                {labels?.createFirstAlert ?? 'Create Your First Alert'}
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
