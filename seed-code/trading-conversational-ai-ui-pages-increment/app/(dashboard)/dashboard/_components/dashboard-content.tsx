'use client';

import AppHeader from '@/components/layout/app-header';
import StatsCard from '@/components/dashboard/stats-card';
import RecentAlerts from '@/components/dashboard/recent-alerts';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import {
  Bell,
  LineChart,
  Brain,
  Zap,
  TrendingUp,
  Activity,
  Sparkles,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { useLocale } from '@/lib/context/locale-context';

export function DashboardContent() {
  const { t } = useLocale();

  return (
    <div className="flex h-screen w-full flex-col overflow-y-auto bg-[#06070a] select-none">
      <AppHeader
        title={t('Main Terminal Dashboard')}
        subtitle={t('Real-Time XAUUSD Quantitative Overview & Alert Telemetry')}
      />

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 p-4 md:p-6">
        {/* Top Hero Banner */}
        <div className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-r from-[#0c0f18] via-[#121624] to-[#0d0f17] p-6 shadow-2xl">
          <div className="relative z-10 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
            <div className="max-w-xl space-y-1">
              <div className="flex items-center gap-2">
                <Badge className="border-amber-500/50 bg-amber-500/20 font-mono text-[10px] text-amber-300">
                  ⚡ {t('PRO TIER ACTIVE')}
                </Badge>
                <span className="font-mono text-[11px] text-slate-400">
                  {t('XAUUSD M5 / M15 Feed Live')}
                </span>
              </div>
              <h2 className="text-xl font-extrabold tracking-tight text-slate-100">
                {t('Quantitative Trading & AI Analysis Terminal')}
              </h2>
              <p className="text-xs leading-relaxed text-slate-400">
                {t(
                  'Your PRO account has 100 active alert slots enabled, real-time M5 on M15 equal-distance channel overlay, and quad-RAG AI multi-model queries.'
                )}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Link href="/terminal">
                <Button className="h-9 bg-gradient-to-r from-amber-500 to-amber-600 text-xs font-extrabold text-slate-950 shadow-lg shadow-amber-500/20 hover:from-amber-400 hover:to-amber-500">
                  <LineChart className="mr-1.5 h-4 w-4" />{' '}
                  {t('Launch AI Analyst Workbench')}
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* 4 Stat Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title={t('Active Alert Rules')}
            value="12 / 100"
            change={t('+3 Today')}
            changeType="positive"
            icon={Bell}
            description={t('PRO allocation: 100 Max Rules')}
          />
          <StatsCard
            title={t('M5 EDT Channel Status')}
            value={t('Bullish Retest')}
            change={t('Z-Score +1.8')}
            changeType="positive"
            icon={Activity}
            description={t('Support $2,634.50 Confirmed')}
          />
          <StatsCard
            title={t('AI Monthly Token Quota')}
            value="42,500 / 500,000"
            change={t('8.5% Used')}
            changeType="neutral"
            icon={Brain}
            description={t('Sub-500ms Quad-RAG Latency')}
          />
          <StatsCard
            title={t('Market Volatility Index')}
            value="24.5 ATR"
            change={t('High Volatility')}
            changeType="positive"
            icon={TrendingUp}
            description={t('XAUUSD Session Momentum')}
          />
        </div>

        {/* Middle Section: Recent Alerts Table & Quick Action Cards */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <RecentAlerts />
          </div>

          <div className="space-y-4">
            <Card className="border-slate-800/80 bg-[#090c14] text-slate-100 shadow-xl">
              <CardContent className="space-y-3 p-4">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                  <h3 className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                    <Zap className="h-4 w-4 text-amber-400" />{' '}
                    {t('Quick Actions')}
                  </h3>
                </div>

                <div className="grid gap-2">
                  <Link href="/alerts/new">
                    <Button
                      variant="outline"
                      className="border-slate-750 w-full justify-between bg-[#06080f] text-xs text-slate-200 hover:bg-slate-800"
                    >
                      <span>{t('Create Price Alert')}</span>
                      <ArrowRight className="h-3.5 w-3.5 text-amber-400" />
                    </Button>
                  </Link>

                  <Link href="/terminal">
                    <Button
                      variant="outline"
                      className="border-slate-750 w-full justify-between bg-[#06080f] text-xs text-slate-200 hover:bg-slate-800"
                    >
                      <span>{t('Ask AI Chart Analyst')}</span>
                      <Brain className="h-3.5 w-3.5 text-amber-400" />
                    </Button>
                  </Link>

                  <Link href="/settings/security">
                    <Button
                      variant="outline"
                      className="border-slate-750 w-full justify-between bg-[#06080f] text-xs text-slate-200 hover:bg-slate-800"
                    >
                      <span>{t('Manage Security & 2FA')}</span>
                      <ShieldCheck className="h-3.5 w-3.5 text-amber-400" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            <Card className="border-amber-500/30 bg-amber-500/5 text-slate-100 shadow-xl">
              <CardContent className="space-y-2 p-4">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
                  <Sparkles className="h-4 w-4" />{' '}
                  {t('Multi-Timeframe Strategy Engine')}
                </div>
                <p className="text-[11px] leading-relaxed text-slate-300">
                  {t(
                    'Engine 2 calculates live M5 Equal-Distance Centroid Channels overlaid directly onto the M15 chart for dual-perspective momentum tracking.'
                  )}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
