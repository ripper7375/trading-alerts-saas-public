import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Volume2,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { SwipeableItem } from '@/components/mobile/SwipeableItem';
import { EmptyState } from '@/components/mobile/EmptyState';
import { useNotifications } from '@/contexts/NotificationContext';
import { useAuth } from '@/contexts/AuthContext';

export default function AlertsPage() {
  const navigate = useNavigate();
  const { alerts, toggleAlertStatus, deleteAlert, triggerTestAlert } =
    useNotifications();
  const { isPro } = useAuth();
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'TRIGGERED'>('ALL');

  const maxAlerts = isPro ? 20 : 5;
  const activeCount = alerts.filter((a) => a.status === 'ACTIVE').length;

  const filteredAlerts = alerts.filter((a) => {
    if (filter === 'ACTIVE') return a.status === 'ACTIVE';
    if (filter === 'TRIGGERED') return a.status === 'TRIGGERED';
    return true;
  });

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Header & New Alert Button */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <h1 className="text-xl font-black tracking-tight text-foreground">
            Price Breach Alerts
          </h1>
          <p className="text-xs text-muted-foreground">
            Real-time MT5 fractal support & resistance triggers.
          </p>
        </div>
        <Button
          onClick={() => navigate('/alerts/new')}
          className="h-9 gap-1.5 rounded-xl bg-amber-500 font-bold text-slate-950 shadow-md shadow-amber-500/20 hover:bg-amber-400"
        >
          <Plus className="h-4 w-4" />
          <span>New Alert</span>
        </Button>
      </div>

      {/* Tier Quota Gauge Bar */}
      <Card className="border-border/80 bg-card/60 backdrop-blur-md">
        <CardContent className="space-y-2 p-3.5">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 font-semibold text-foreground">
              <Bell className="h-3.5 w-3.5 text-amber-500" />
              Active Alert Capacity
            </span>
            <span className="font-mono font-bold text-amber-500">
              {activeCount} / {maxAlerts} Used
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full transition-all duration-300 ${
                activeCount >= maxAlerts ? 'bg-rose-500' : 'bg-amber-500'
              }`}
              style={{
                width: `${Math.min((activeCount / maxAlerts) * 100, 100)}%`,
              }}
            />
          </div>
          {!isPro && (
            <div className="flex items-center justify-between pt-1 text-[11px]">
              <span className="text-muted-foreground">
                Free Tier: 5 alerts max
              </span>
              <button
                onClick={() => navigate('/pricing')}
                className="inline-flex items-center gap-1 font-bold text-amber-500 hover:underline"
              >
                <Zap className="h-3 w-3 fill-current" />
                <span>Upgrade for 20 Alerts</span>
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 rounded-xl bg-muted p-1 text-xs font-semibold">
          {(['ALL', 'ACTIVE', 'TRIGGERED'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`rounded-lg px-3 py-1 transition-all ${
                filter === tab
                  ? 'shadow-xs bg-background text-foreground'
                  : 'text-muted-foreground'
              }`}
            >
              {tab === 'ALL'
                ? 'All'
                : tab === 'ACTIVE'
                  ? 'Active'
                  : 'Triggered'}
            </button>
          ))}
        </div>

        {/* Test Chime Trigger */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => triggerTestAlert('XAUUSD', 2650.0)}
          className="h-8 gap-1 border-amber-500/30 text-[11px] font-bold text-amber-500 hover:bg-amber-500/10"
        >
          <Volume2 className="h-3 w-3" />
          <span>Test Chime</span>
        </Button>
      </div>

      {/* Swipeable Alert Cards Feed */}
      <div className="flex flex-col gap-2.5">
        {filteredAlerts.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="No alerts found"
            description="Create your first price breach rule to get instant high-priority push notifications."
            actionLabel="Create Alert"
            onAction={() => navigate('/alerts/new')}
            actionIcon={Plus}
          />
        ) : (
          filteredAlerts.map((alert) => {
            const isAbove = alert.condition === 'ABOVE';
            const isTriggered = alert.status === 'TRIGGERED';

            return (
              <SwipeableItem
                key={alert.id}
                onDelete={() => deleteAlert(alert.id)}
                onToggleStatus={() => toggleAlertStatus(alert.id)}
                isActive={alert.status === 'ACTIVE'}
                deleteLabel="Delete"
              >
                <div
                  onClick={() => navigate(`/alerts/${alert.id}/edit`)}
                  className="cursor-pointer space-y-2.5 rounded-2xl border border-border/80 bg-card p-4 transition-all hover:bg-card/90"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-foreground">
                        {alert.symbol}
                      </span>
                      <Badge
                        variant="outline"
                        className="px-1.5 py-0 font-mono text-[10px]"
                      >
                        {alert.timeframe}
                      </Badge>
                      <span className="flex items-center gap-0.5 font-mono text-[10px] text-muted-foreground">
                        <Volume2 className="h-3 w-3 text-amber-500" />
                        {alert.sound}
                      </span>
                    </div>

                    <Badge
                      variant={
                        isTriggered
                          ? 'destructive'
                          : alert.status === 'ACTIVE'
                            ? 'success'
                            : 'outline'
                      }
                      className="px-2 py-0.5 text-[10px] font-bold"
                    >
                      {alert.status}
                    </Badge>
                  </div>

                  <div className="flex items-baseline justify-between border-t border-border/50 pt-1">
                    <div className="flex items-center gap-1.5">
                      {isAbove ? (
                        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-500">
                          <ArrowUpRight className="h-4 w-4" />
                        </div>
                      ) : (
                        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-rose-500/15 text-rose-500">
                          <ArrowDownRight className="h-4 w-4" />
                        </div>
                      )}
                      <div>
                        <div className="text-[10px] font-semibold uppercase text-muted-foreground">
                          Target Price
                        </div>
                        <div className="font-mono text-sm font-bold text-foreground">
                          $
                          {alert.targetPrice.toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-[10px] font-semibold uppercase text-muted-foreground">
                        Current Price
                      </div>
                      <div className="font-mono text-xs text-muted-foreground">
                        $
                        {alert.currentPrice.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                        })}
                      </div>
                    </div>
                  </div>

                  {alert.note && (
                    <p className="border-t border-border/40 pt-1 text-[11px] italic text-muted-foreground/90">
                      &ldquo;{alert.note}&rdquo;
                    </p>
                  )}
                </div>
              </SwipeableItem>
            );
          })
        )}
      </div>

      <p className="pt-1 text-center text-[10px] text-muted-foreground">
        💡 Swipe Left to Delete • Swipe Right to Pause/Activate
      </p>
    </div>
  );
}
