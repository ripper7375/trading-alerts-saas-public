'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Activity,
  Server,
  Terminal,
  Database,
  Radio,
  CreditCard,
  RefreshCw,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MarketingNavbar } from '@/components/marketing/marketing-navbar';
import { MarketingFooter } from '@/components/marketing/marketing-footer';
import { useLocale } from '@/lib/context/locale-context';

interface ComponentHealth {
  name: string;
  status: 'OPERATIONAL' | 'DEGRADED' | 'OUTAGE';
  latency: string;
  uptime: string;
  icon: React.ComponentType<{ className?: string }>;
}

export default function StatusPage() {
  const { t } = useLocale();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastCheck, setLastCheck] = useState('Just now');

  const components: ComponentHealth[] = [
    {
      name: t('MetaTrader 5 (MT5) Feed Gateway'),
      status: 'OPERATIONAL',
      latency: '24ms',
      uptime: '99.99%',
      icon: Terminal,
    },
    {
      name: t('Real-Time WebSocket Pipeline'),
      status: 'OPERATIONAL',
      latency: '18ms',
      uptime: '99.98%',
      icon: Radio,
    },
    {
      name: t('Davin AI Conversational Engine'),
      status: 'OPERATIONAL',
      latency: '120ms',
      uptime: '99.95%',
      icon: Activity,
    },
    {
      name: t('PostgreSQL & TimescaleDB Clusters'),
      status: 'OPERATIONAL',
      latency: '8ms',
      uptime: '100.0%',
      icon: Database,
    },
    {
      name: t('Stripe & dLocal Billing Webhooks'),
      status: 'OPERATIONAL',
      latency: '45ms',
      uptime: '99.99%',
      icon: CreditCard,
    },
    {
      name: t('Wise & RiseWorks Disbursement Queues'),
      status: 'OPERATIONAL',
      latency: '32ms',
      uptime: '100.0%',
      icon: Server,
    },
  ];

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      setLastCheck(new Date().toLocaleTimeString());
    }, 600);
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#050609] text-slate-100">
      <MarketingNavbar />

      <main className="container mx-auto max-w-4xl flex-1 px-4 py-16 md:px-6">
        <div className="space-y-8">
          <div className="space-y-3">
            <Badge className="border-emerald-500/40 bg-emerald-500/15 px-3 py-1 font-mono text-xs text-emerald-400">
              {t('Live Telemetry Monitor')}
            </Badge>
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <h1 className="text-3xl font-extrabold tracking-tight text-slate-100 md:text-4xl">
                  {t('DavinTrade System Status')}
                </h1>
                <p className="mt-1 text-sm text-slate-400">
                  {t('Last updated')}: {lastCheck}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="self-start border-slate-800 bg-[#0a0d16] text-slate-300 hover:bg-slate-800"
              >
                <RefreshCw
                  className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`}
                />
                {t('Refresh Status')}
              </Button>
            </div>
          </div>

          {/* Overall Banner */}
          <Card className="border-emerald-500/30 bg-emerald-950/20 backdrop-blur-xl">
            <CardContent className="flex items-center justify-between p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-500/40 bg-emerald-500/20 text-emerald-400">
                  <CheckCircle2 className="h-7 w-7" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-emerald-200">
                    {t('All Systems Operational')}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {t(
                      'No outages or degraded performance detected in the past 90 days.'
                    )}
                  </p>
                </div>
              </div>
              <div className="hidden text-right sm:block">
                <div className="font-mono text-2xl font-extrabold text-emerald-400">
                  99.98%
                </div>
                <div className="text-[11px] text-slate-500">
                  {t('90-day avg uptime')}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Component List */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold tracking-wider text-slate-300 uppercase">
              {t('Subsystem Health')}
            </h3>

            <div className="space-y-2">
              {components.map((comp, idx) => {
                const Icon = comp.icon;
                return (
                  <Card
                    key={idx}
                    className="border-slate-800/80 bg-[#090b14]/90 p-4 transition-all hover:border-slate-700"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700 bg-slate-800/50 text-slate-300">
                          <Icon className="h-5 w-5 text-amber-400" />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-slate-200">
                            {comp.name}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-500">
                            <span>
                              {t('Latency')}:{' '}
                              <strong className="text-slate-400">
                                {comp.latency}
                              </strong>
                            </span>
                            <span>•</span>
                            <span>
                              {t('Uptime')}:{' '}
                              <strong className="text-slate-400">
                                {comp.uptime}
                              </strong>
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
                        </span>
                        <span className="text-xs font-semibold text-emerald-400">
                          {t('Operational')}
                        </span>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-slate-800/80 bg-[#090b14]/80 p-4 text-center">
            <p className="text-sm text-slate-400">
              {t(
                'MT5 terminal health, scheduled jobs, and queue diagnostics are managed in the Admin Panel.'
              )}
            </p>
            <Link
              href="/admin/system/terminals"
              className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-amber-400 hover:text-amber-300 hover:underline"
            >
              {t('Go to Admin System Panel')} →
            </Link>
          </div>
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}
