'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  Terminal,
  Cpu,
  Database,
  Radio,
  Clock,
  RefreshCw,
  Zap,
  Server,
} from 'lucide-react';
import AppHeader from '@/components/layout/app-header';
import { AdminNav } from '@/components/admin/admin-nav';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useLocale } from '@/lib/context/locale-context';

export default function AdminApiUsagePage() {
  const { t } = useLocale();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const apiMetrics = [
    {
      name: 'MT5 Tick Feed Bridge (WebSocket)',
      requests: '14.2M msgs',
      quota: 'Unlimited',
      latency: '12ms',
      status: 'HEALTHY',
      usagePct: 45,
    },
    {
      name: 'Davin AI Conversational Engine (LLM API)',
      requests: '184,200 tokens',
      quota: '1M tokens/mo',
      latency: '420ms',
      status: 'HEALTHY',
      usagePct: 18.4,
    },
    {
      name: 'Stripe & dLocal Webhook Ingestion',
      requests: '1,420 events',
      quota: '100k events/mo',
      latency: '28ms',
      status: 'HEALTHY',
      usagePct: 1.4,
    },
    {
      name: 'Wise Automated Payout REST API',
      requests: '32 calls',
      quota: '5,000 calls/mo',
      latency: '140ms',
      status: 'HEALTHY',
      usagePct: 0.6,
    },
    {
      name: 'TimescaleDB Timeseries Ingestion',
      requests: '8.4M rows',
      quota: '100M rows',
      latency: '6ms',
      status: 'HEALTHY',
      usagePct: 8.4,
    },
  ];

  return (
    <div className="flex h-screen w-full flex-col overflow-y-auto bg-slate-50 text-slate-900 select-none dark:bg-[#050609] dark:text-slate-100">
      <AppHeader
        title={t('Admin API & Gateway Usage Telemetry')}
        subtitle={t(
          'Real-time Endpoint Load, Latency Profiles, Rate Limits & Token Consumptions'
        )}
      />

      <AdminNav />

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 p-4 md:p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge className="border-emerald-500/40 bg-emerald-500/15 text-xs text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">
              {t('All API Endpoints Healthy')}
            </Badge>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setIsRefreshing(true);
              setTimeout(() => setIsRefreshing(false), 500);
            }}
            className="border-slate-300 bg-white text-xs text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-[#090b14] dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <RefreshCw
              className={`mr-1.5 h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`}
            />
            {t('Refresh Telemetry')}
          </Button>
        </div>

        {/* 3 Metric Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card className="border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800/80 dark:bg-[#090b14]/90">
            <div className="text-xs font-medium text-slate-600 dark:text-slate-400">
              {t('Total Requests (24h)')}
            </div>
            <div className="mt-1 font-mono text-3xl font-extrabold text-cyan-700 dark:text-cyan-400">
              {t('1.84M')}
            </div>
          </Card>
          <Card className="border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800/80 dark:bg-[#090b14]/90">
            <div className="text-xs font-medium text-slate-600 dark:text-slate-400">
              {t('Global Median Latency')}
            </div>
            <div className="mt-1 font-mono text-3xl font-extrabold text-emerald-700 dark:text-emerald-400">
              {t('14.2 ms')}
            </div>
          </Card>
          <Card className="border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800/80 dark:bg-[#090b14]/90">
            <div className="text-xs font-medium text-slate-600 dark:text-slate-400">
              {t('Peak Concurrent Connections')}
            </div>
            <div className="mt-1 font-mono text-3xl font-extrabold text-amber-700 dark:text-amber-400">
              {t('1,248 Sockets')}
            </div>
          </Card>
        </div>

        {/* Breakdown List */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold tracking-wider text-slate-600 uppercase dark:text-slate-400">
            {t('Subsystem API Gateway Metrics')}
          </h3>

          <div className="space-y-3">
            {apiMetrics.map((m, idx) => (
              <Card
                key={idx}
                className="space-y-3 border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800/80 dark:bg-[#090b14]/90"
              >
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-slate-200">
                      {t(m.name)}
                    </h4>
                    <div className="mt-0.5 flex items-center gap-3 text-[11px] text-slate-600 dark:text-slate-400">
                      <span>
                        {t('Throughput')}:{' '}
                        <strong className="font-mono text-slate-800 dark:text-slate-300">
                          {t(m.requests)}
                        </strong>
                      </span>
                      <span>•</span>
                      <span>
                        {t('Quota')}:{' '}
                        <strong className="text-slate-800 dark:text-slate-300">
                          {t(m.quota)}
                        </strong>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-start sm:self-center">
                    <span className="font-mono text-xs font-bold text-amber-700 dark:text-amber-400">
                      {t(m.latency)}
                    </span>
                    <Badge className="border-emerald-500/40 bg-emerald-500/15 text-[10px] text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">
                      {t(m.status)}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between font-mono text-[10px] text-slate-500">
                    <span>{t('Capacity Allocated')}</span>
                    <span>{m.usagePct}%</span>
                  </div>
                  <Progress
                    value={m.usagePct}
                    className="h-1.5 bg-slate-200 dark:bg-slate-800"
                  />
                </div>
              </Card>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
