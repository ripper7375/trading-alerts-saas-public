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

interface RecentAlertsProps {
  alerts: Alert[];
  maxAlerts?: number;
}

// Status configuration for styling and icons
const statusConfig = {
  watching: {
    icon: Clock,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    borderColor: 'border-l-blue-500',
    label: 'Watching',
  },
  triggered: {
    icon: CheckCircle2,
    color: 'text-green-600',
    bgColor: 'bg-green-50 dark:bg-green-900/20',
    borderColor: 'border-l-green-500',
    label: 'Triggered',
  },
  paused: {
    icon: PauseCircle,
    color: 'text-gray-500',
    bgColor: 'bg-gray-50 dark:bg-gray-800',
    borderColor: 'border-l-gray-400',
    label: 'Paused',
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
}: RecentAlertsProps): React.ReactElement {
  const displayAlerts = alerts.slice(0, maxAlerts);

  return (
    <Card className="bg-white dark:bg-gray-800">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
          <Bell className="h-5 w-5 text-gray-400" />
          Recent Alerts
        </CardTitle>
        {alerts.length > 0 && (
          <Link href="/dashboard/alerts">
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
                  className={cn(
                    'rounded-lg border-l-4 p-3 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700',
                    config.borderColor,
                    config.bgColor
                  )}
                >
                  <div className="flex items-start gap-3">
                    <StatusIcon
                      className={cn('h-5 w-5 mt-0.5 shrink-0', config.color)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-medium text-gray-900 dark:text-white truncate">
                          {alert.title}
                        </h4>
                        <Badge variant="outline" className="text-xs">
                          {config.label}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                        {alert.symbol} • {alert.timeframe} • Target: $
                        {alert.targetPrice.toFixed(2)}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                        Current: ${alert.currentPrice.toFixed(2)} | Distance:{' '}
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
          <div className="text-center py-8">
            <div className="mx-auto mb-4 text-5xl opacity-50">🔔</div>
            <h3 className="text-lg font-medium text-gray-600 dark:text-gray-400 mb-2">
              No alerts yet
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-500 mb-4">
              Set up alerts to get notified of price movements
            </p>
            <Link href="/dashboard/alerts/new">
              <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                Create Your First Alert
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
