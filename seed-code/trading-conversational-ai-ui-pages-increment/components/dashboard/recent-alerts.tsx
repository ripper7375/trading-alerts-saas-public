'use client';

import {
  Bell,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useLocale } from '@/lib/context/locale-context';

export default function RecentAlerts() {
  const { t, formatRelativeTime } = useLocale();

  const alerts = [
    {
      id: '1',
      symbol: 'XAUUSD',
      type: t('EDT Channel Breach'),
      condition: t('Price > $2,648.50'),
      timeframe: 'M5',
      triggeredAt: formatRelativeTime(2),
      direction: 'BUY',
      status: t('Triggered'),
    },
    {
      id: '2',
      symbol: 'XAUUSD',
      type: t('SSA Z-Score Spike'),
      condition: t('Z-Score > +2.5'),
      timeframe: 'M15',
      triggeredAt: formatRelativeTime(18),
      direction: 'SELL',
      status: t('Triggered'),
    },
    {
      id: '3',
      symbol: 'XAUUSD',
      type: t('Centroid Support Retest'),
      condition: t('Price = $2,634.50'),
      timeframe: 'M5',
      triggeredAt: formatRelativeTime(45),
      direction: 'BUY',
      status: t('Active'),
    },
  ];

  return (
    <div className="rounded-2xl border border-slate-800/80 bg-[#090c14] p-4 shadow-xl select-none">
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/15 text-amber-400">
            <Bell className="h-4 w-4" />
          </div>
          <h2 className="text-xs font-bold tracking-wider text-slate-100 uppercase">
            {t('RECENT ALERT EXECUTIONS')}
          </h2>
        </div>
        <Link href="/alerts">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs font-semibold text-amber-400 hover:text-amber-300"
          >
            {t('View All Alerts')}
          </Button>
        </Link>
      </div>

      <div className="mt-3 divide-y divide-slate-800/60">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className="flex items-center justify-between py-2.5"
          >
            <div className="flex items-center gap-3">
              <Badge
                className={
                  alert.direction === 'BUY'
                    ? 'border-emerald-500/40 bg-emerald-500/15 font-mono text-[10px] text-emerald-400'
                    : 'border-rose-500/40 bg-rose-500/15 font-mono text-[10px] text-rose-400'
                }
              >
                {alert.direction === 'BUY' ? (
                  <ArrowUpRight className="mr-0.5 inline h-3 w-3" />
                ) : (
                  <ArrowDownRight className="mr-0.5 inline h-3 w-3" />
                )}
                {alert.direction}
              </Badge>

              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-slate-200">
                    {alert.symbol}
                  </span>
                  <Badge
                    variant="outline"
                    className="border-slate-700 bg-slate-800 font-mono text-[9px]"
                  >
                    {alert.timeframe}
                  </Badge>
                </div>
                <div className="text-[11px] font-medium text-slate-400">
                  {t(alert.type)}: {alert.condition}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-right">
              <span className="flex items-center gap-1 font-mono text-[10px] text-slate-500">
                <Clock className="h-3 w-3" />
                {alert.triggeredAt}
              </span>
              <Badge className="border-amber-500/40 bg-amber-500/10 font-mono text-[9px] text-amber-300">
                {alert.status}
              </Badge>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
