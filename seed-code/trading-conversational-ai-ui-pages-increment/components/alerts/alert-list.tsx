'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Bell, Plus, Trash2, Filter, Pencil, LineChart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useLocale } from '@/lib/context/locale-context';

interface AlertItem {
  id: string;
  name: string;
  symbol: string;
  timeframe: string;
  type: string;
  condition: string;
  targetPrice: string;
  isActive: boolean;
  triggerCount: number;
  lastTriggeredMinutesAgo?: number;
}

// Canonical (English) source strings — translated at render time via t(),
// never baked into state, so switching locale re-translates them instantly.
const SEED_ALERTS: AlertItem[] = [
  {
    id: '1',
    name: 'XAUUSD EDT Lower Boundary Breach',
    symbol: 'XAUUSD',
    timeframe: 'M5',
    type: 'Channel Breach',
    condition: 'Price < $2,634.50',
    targetPrice: '$2,634.50',
    isActive: true,
    triggerCount: 4,
    lastTriggeredMinutesAgo: 10,
  },
  {
    id: '2',
    name: 'M15 SSA Upper Resistance Alert',
    symbol: 'XAUUSD',
    timeframe: 'M15',
    type: 'SSA Resistance',
    condition: 'Price > $2,648.00',
    targetPrice: '$2,648.00',
    isActive: true,
    triggerCount: 1,
    lastTriggeredMinutesAgo: 120,
  },
  {
    id: '3',
    name: 'Centroid Momentum Flip',
    symbol: 'XAUUSD',
    timeframe: 'M5',
    type: 'Centroid Crossover',
    condition: 'Slope > 0.45',
    targetPrice: '0.45',
    isActive: false,
    triggerCount: 0,
  },
];

export default function AlertList({ tier = 'PRO' }: { tier?: 'PRO' | 'FREE' }) {
  const { t, formatRelativeTime } = useLocale();

  const [alerts, setAlerts] = useState<AlertItem[]>(SEED_ALERTS);

  const [filterQuery, setFilterQuery] = useState('');
  const [alertToDelete, setAlertToDelete] = useState<AlertItem | null>(null);

  const toggleAlertActive = (id: string) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, isActive: !a.isActive } : a))
    );
  };

  const confirmDeleteAlert = () => {
    if (!alertToDelete) return;
    setAlerts((prev) => prev.filter((a) => a.id !== alertToDelete.id));
    setAlertToDelete(null);
  };

  const filteredAlerts = alerts.filter((a) => {
    const query = filterQuery.toLowerCase();
    return (
      t(a.name).toLowerCase().includes(query) ||
      t(a.condition).toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-4 select-none">
      {/* Top Action Bar */}
      <div className="flex flex-col items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl sm:flex-row sm:items-center dark:border-slate-800/80 dark:bg-[#090c14]">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/15 text-amber-600 dark:text-amber-400">
            <Bell className="h-4 w-4" />
          </div>
          <div>
            <h2 className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-slate-100">
              {t('Active Alert Rules')} (
              {alerts.filter((a) => a.isActive).length} /{' '}
              {tier === 'PRO' ? '100' : '0'})
              <Badge
                variant="outline"
                className="border-amber-500/40 bg-amber-500/10 font-mono text-[9px] text-amber-700 dark:text-amber-300"
              >
                {tier === 'PRO' ? t('PRO Unlimited') : t('FREE Locked')}
              </Badge>
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {t('Real-Time WebSocket & Server-Side Line Alert Triggers')}
            </p>
          </div>
        </div>

        <div className="flex w-full items-center gap-2 sm:w-auto">
          <div className="relative flex-1 sm:w-48">
            <Filter className="absolute top-2.5 left-2.5 h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
            <Input
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder={t('Filter rules...')}
              className="h-8 border-slate-200 bg-slate-50 pl-8 text-xs text-slate-900 dark:border-slate-700 dark:bg-[#06080e] dark:text-slate-200"
            />
          </div>

          <Link href="/alerts/new">
            <Button
              size="sm"
              disabled={tier === 'FREE'}
              className="h-8 bg-gradient-to-r from-amber-500 to-amber-600 text-xs font-extrabold text-slate-950 shadow-md shadow-amber-500/20 hover:from-amber-400 hover:to-amber-500"
            >
              <Plus className="mr-1 h-3.5 w-3.5" /> {t('+ New Alert Rule')}
            </Button>
          </Link>
        </div>
      </div>

      {/* Alert List Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-800/80 dark:bg-[#090c14]">
        <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
          {filteredAlerts.map((alert) => (
            <div
              key={alert.id}
              className="flex flex-col items-start justify-between gap-3 p-4 transition-colors hover:bg-slate-50 sm:flex-row sm:items-center dark:hover:bg-slate-800/30"
            >
              <div className="flex items-start gap-3">
                <Switch
                  checked={alert.isActive}
                  onCheckedChange={() => toggleAlertActive(alert.id)}
                  disabled={tier === 'FREE'}
                  className="mt-1"
                />

                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      {t(alert.name)}
                    </span>
                    <Badge
                      variant="outline"
                      className="border-slate-200 bg-slate-100 font-mono text-[9px] text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    >
                      {alert.symbol} • {alert.timeframe}
                    </Badge>
                    <Badge className="border-amber-500/30 bg-amber-500/10 font-mono text-[9px] text-amber-700 dark:text-amber-300">
                      {t(alert.type)}
                    </Badge>
                  </div>
                  <div className="font-mono text-xs text-slate-500 dark:text-slate-400">
                    {t('Condition:')}{' '}
                    <span className="font-bold text-amber-700 dark:text-amber-300">
                      {t(alert.condition)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex w-full items-center justify-between gap-4 text-right sm:w-auto sm:justify-end">
                <div className="text-right">
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">
                    {t('Triggers:')}{' '}
                    <strong className="text-slate-800 dark:text-slate-200">
                      {alert.triggerCount} {t('times')}
                    </strong>
                  </div>
                  {alert.lastTriggeredMinutesAgo !== undefined && (
                    <div className="font-mono text-[10px] text-slate-500">
                      {t('Last:')}{' '}
                      {formatRelativeTime(alert.lastTriggeredMinutesAgo)}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <Link href="/terminal">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={t('View chart')}
                      className="h-8 w-8 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-700/40 dark:hover:text-slate-200"
                    >
                      <LineChart className="h-4 w-4" />
                    </Button>
                  </Link>

                  <Link href={`/alerts/${alert.id}/edit`}>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`${t('Edit')} ${t(alert.name)}`}
                      className="h-8 w-8 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-700/40 dark:hover:text-slate-200"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </Link>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setAlertToDelete(alert)}
                    aria-label={`${t('Delete')} ${t(alert.name)}`}
                    className="h-8 w-8 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-500/20 dark:hover:text-rose-300"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <AlertDialog
        open={alertToDelete !== null}
        onOpenChange={(open) => !open && setAlertToDelete(null)}
      >
        <AlertDialogContent className="border-slate-200 bg-white text-slate-900 dark:border-slate-800/80 dark:bg-[#0b0e17] dark:text-slate-100">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-rose-600 dark:text-rose-400">
              {t('Delete Alert Rule?')}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-600 dark:text-slate-400">
              {t('Are you sure you want to delete')} &quot;
              {alertToDelete ? t(alertToDelete.name) : ''}&quot;?{' '}
              {t('This action cannot be undone.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-slate-300 bg-transparent text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100">
              {t('Cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteAlert}
              className="bg-rose-600 text-white hover:bg-rose-500"
            >
              {t('Delete Alert')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
