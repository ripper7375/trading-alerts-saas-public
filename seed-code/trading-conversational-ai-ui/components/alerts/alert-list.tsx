'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Bell,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  XCircle,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  Lock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';

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
  lastTriggered?: string;
}

export default function AlertList({ tier = 'PRO' }: { tier?: 'PRO' | 'FREE' }) {
  const [alerts, setAlerts] = useState<AlertItem[]>([
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
      lastTriggered: '10 mins ago',
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
      lastTriggered: '2 hours ago',
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
  ]);

  const [filterQuery, setFilterQuery] = useState('');

  const toggleAlertActive = (id: string) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, isActive: !a.isActive } : a))
    );
  };

  const deleteAlert = (id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  const filteredAlerts = alerts.filter(
    (a) =>
      a.name.toLowerCase().includes(filterQuery.toLowerCase()) ||
      a.condition.toLowerCase().includes(filterQuery.toLowerCase())
  );

  return (
    <div className="space-y-4 select-none">
      {/* Top Action Bar */}
      <div className="flex flex-col items-start justify-between gap-3 rounded-2xl border border-slate-800/80 bg-[#090c14] p-4 shadow-xl sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/15 text-amber-400">
            <Bell className="h-4 w-4" />
          </div>
          <div>
            <h2 className="flex items-center gap-2 text-xs font-bold text-slate-100">
              Active Alert Rules ({alerts.filter((a) => a.isActive).length} /{' '}
              {tier === 'PRO' ? '100' : '0'})
              <Badge
                variant="outline"
                className="border-amber-500/40 bg-amber-500/10 font-mono text-[9px] text-amber-300"
              >
                {tier === 'PRO' ? 'PRO Unlimited' : 'FREE Locked'}
              </Badge>
            </h2>
            <p className="text-[11px] text-slate-400">
              Real-Time WebSocket & Server-Side Line Alert Triggers
            </p>
          </div>
        </div>

        <div className="flex w-full items-center gap-2 sm:w-auto">
          <div className="relative flex-1 sm:w-48">
            <Filter className="absolute top-2.5 left-2.5 h-3.5 w-3.5 text-slate-500" />
            <Input
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Filter rules..."
              className="border-slate-750 h-8 bg-[#06080e] pl-8 text-xs text-slate-200"
            />
          </div>

          <Link href="/alerts/new">
            <Button
              size="sm"
              disabled={tier === 'FREE'}
              className="h-8 bg-gradient-to-r from-amber-500 to-amber-600 text-xs font-extrabold text-slate-950 shadow-md shadow-amber-500/20 hover:from-amber-400 hover:to-amber-500"
            >
              <Plus className="mr-1 h-3.5 w-3.5" /> New Alert Rule
            </Button>
          </Link>
        </div>
      </div>

      {/* Alert List Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-800/80 bg-[#090c14] shadow-xl">
        <div className="divide-y divide-slate-800/60">
          {filteredAlerts.map((alert) => (
            <div
              key={alert.id}
              className="flex flex-col items-start justify-between gap-3 p-4 transition-colors hover:bg-slate-800/30 sm:flex-row sm:items-center"
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
                    <span className="text-xs font-bold text-slate-100">
                      {alert.name}
                    </span>
                    <Badge
                      variant="outline"
                      className="border-slate-700 bg-slate-800 font-mono text-[9px]"
                    >
                      {alert.symbol} • {alert.timeframe}
                    </Badge>
                    <Badge className="border-amber-500/30 bg-amber-500/10 font-mono text-[9px] text-amber-300">
                      {alert.type}
                    </Badge>
                  </div>
                  <div className="font-mono text-xs text-slate-400">
                    Condition:{' '}
                    <span className="font-bold text-amber-300">
                      {alert.condition}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex w-full items-center justify-between gap-4 text-right sm:w-auto sm:justify-end">
                <div className="text-right">
                  <div className="text-[10px] text-slate-400">
                    Triggers:{' '}
                    <strong className="text-slate-200">
                      {alert.triggerCount} times
                    </strong>
                  </div>
                  {alert.lastTriggered && (
                    <div className="font-mono text-[10px] text-slate-500">
                      Last: {alert.lastTriggered}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteAlert(alert.id)}
                    className="h-8 w-8 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
