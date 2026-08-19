'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, X, Sparkles, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLocale } from '@/lib/context/locale-context';

export default function TierComparison() {
  const { t, formatCurrency } = useLocale();
  const [isAnnual, setIsAnnual] = useState(true);

  const features = [
    {
      name: t('XAUUSD Real-Time M5/M15 Data Stream'),
      free: true,
      pro: true,
    },
    {
      name: t('AI Chart Analyst Quad-RAG Queries'),
      free: t('Gemini 3.6 Flash Only'),
      pro: t('All 6 Premium AI Models'),
    },
    {
      name: t('Interactive Prompt Input'),
      free: t('Disabled (Read-Only History)'),
      pro: t('Full Interactive Input'),
    },
    {
      name: t('Server-Side Price & Line Alert Rules'),
      free: t('0 Active Alerts'),
      pro: t('100 Active Alerts'),
    },
    {
      name: t('M5 Equal-Distance Centroid Channel Overlay'),
      free: t('MTF Equal-Distance Overlay Locked'),
      pro: t('Full MTF Overlay'),
    },
    {
      name: t('Live Market Comments & WebSocket Feed'),
      free: t('Glassmorphism Blur Gate'),
      pro: t('Unrestricted Feed'),
    },
    {
      name: t('Speedometer Gauges & Quality Metrics'),
      free: t('Locked'),
      pro: t('Full Access'),
    },
    {
      name: t('Monthly AI Token Allocation'),
      free: `50,000 ${t('Tokens')}`,
      pro: `500,000 ${t('Tokens')}`,
    },
    {
      name: t('24/7 Priority Support & VIP Discord'),
      free: false,
      pro: true,
    },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-8 select-none">
      {/* Billing Cycle Toggle */}
      <div className="flex flex-col items-center space-y-3 text-center">
        <Badge className="border-amber-500/40 bg-amber-500/10 px-3 py-1 font-mono text-xs text-amber-700 dark:text-amber-300">
          ⚡ {t('PRO TIER UNLOCKS ALL AI MODELS & REAL-TIME FEEDS')}
        </Badge>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl dark:text-slate-100">
          {t('Flexible Pricing Built for Quantitative Traders')}
        </h1>

        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-800 dark:bg-[#0b0e17]">
          <button
            type="button"
            onClick={() => setIsAnnual(false)}
            className={`rounded-lg px-4 py-1.5 text-xs font-bold transition-all ${
              !isAnnual
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            {t('Monthly Billing')}
          </button>
          <button
            type="button"
            onClick={() => setIsAnnual(true)}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-bold transition-all ${
              isAnnual
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            {t('Annual Billing')}
            <span className="rounded bg-amber-300 px-1.5 py-0.5 text-[9px] font-extrabold text-slate-950 uppercase">
              {t('SAVE 20%')}
            </span>
          </button>
        </div>
      </div>

      {/* Pricing Cards Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* FREE Tier Card */}
        <div className="flex flex-col justify-between space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-[#090c14]">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-200">
                  {t('FREE Tier')}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  {t('Basic market preview & past session viewer')}
                </p>
              </div>
              <Badge
                variant="outline"
                className="border-slate-300 bg-slate-100 font-mono text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                FREE
              </Badge>
            </div>

            <div className="flex items-baseline gap-1">
              <span className="font-mono text-3xl font-extrabold text-slate-900 dark:text-slate-100">
                {formatCurrency(0)}
              </span>
              <span className="text-xs text-slate-600 dark:text-slate-400">
                / {t('forever')}
              </span>
            </div>

            <Button
              variant="outline"
              asChild
              className="dark:border-slate-750 h-10 w-full border-slate-300 bg-slate-100 text-xs font-bold text-slate-800 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
            >
              <Link href="/free">{t('Access FREE Terminal')}</Link>
            </Button>
          </div>

          <div className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800/80">
            <h4 className="text-xs font-bold tracking-wider text-slate-700 uppercase dark:text-slate-300">
              {t('PLAN HIGHLIGHTS:')}
            </h4>
            <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />{' '}
                {t('Real-Time M5/M15 XAUUSD Charts')}
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />{' '}
                {t('Gemini 3.6 Flash AI Model')}
              </li>
              <li className="flex items-center gap-2 text-slate-400 dark:text-slate-500">
                <X className="h-4 w-4 shrink-0 text-rose-500" />{' '}
                {t('0 Active Alerts (PRO Exclusive)')}
              </li>
              <li className="flex items-center gap-2 text-slate-400 dark:text-slate-500">
                <X className="h-4 w-4 shrink-0 text-rose-500" />{' '}
                {t('MTF Equal-Distance Overlay Locked')}
              </li>
            </ul>
          </div>
        </div>

        {/* PRO Tier Card */}
        <div className="relative flex flex-col justify-between space-y-6 rounded-2xl border-2 border-amber-500/60 bg-gradient-to-b from-amber-500/10 via-amber-500/5 to-slate-100 p-6 shadow-2xl dark:from-[#0e121e] dark:to-[#080a10]">
          <div className="absolute -top-3 right-6 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 px-3 py-0.5 text-[10px] font-extrabold tracking-wider text-slate-950 uppercase shadow-md">
            {t('MOST POPULAR FOR TRADERS')}
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="flex items-center gap-1.5 text-lg font-extrabold text-amber-700 dark:text-amber-300">
                  <Sparkles className="h-4 w-4 text-amber-600 dark:text-amber-400" />{' '}
                  {t('PRO Tier')}
                </h3>
                <p className="text-xs text-slate-700 dark:text-slate-300">
                  {t('Complete AI quantitative analyst & 100 alerts')}
                </p>
              </div>
              <Badge className="border-amber-500/50 bg-amber-500/20 font-mono text-[10px] text-amber-700 dark:text-amber-300">
                {t('UNLIMITED')}
              </Badge>
            </div>

            <div className="flex items-baseline gap-1">
              <span className="font-mono text-3xl font-extrabold text-amber-700 dark:text-amber-300">
                {formatCurrency(isAnnual ? 39 : 49)}
              </span>
              <span className="text-xs text-slate-600 dark:text-slate-400">
                / {t('month')} {isAnnual && t('(billed annually)')}
              </span>
            </div>

            <Button
              asChild
              className="h-10 w-full bg-gradient-to-r from-amber-500 to-amber-600 text-xs font-extrabold text-slate-950 shadow-lg shadow-amber-500/25 hover:from-amber-400 hover:to-amber-500"
            >
              <Link href="/checkout">
                {t('Upgrade to PRO Now')}{' '}
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          </div>

          <div className="space-y-3 border-t border-amber-500/30 pt-4">
            <h4 className="text-xs font-bold tracking-wider text-amber-700 uppercase dark:text-amber-300">
              {t('EVERYTHING IN FREE, PLUS:')}
            </h4>
            <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-200">
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />{' '}
                {t('100 Server-Side Price & Line Alert Rules')}
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />{' '}
                {t('All 6 Premium AI Models (Claude Sonnet 5, GPT 5.6, etc.)')}
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />{' '}
                {t('M5 Equal-Distance Centroid Overlay on M15 Chart')}
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />{' '}
                {t('Unrestricted Live Market Comments WebSocket Stream')}
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />{' '}
                {t('500,000 Monthly AI Token Quota')}
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Feature Comparison Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-[#090c14]">
        <div className="border-b border-slate-200 bg-slate-100/80 p-4 dark:border-slate-800 dark:bg-[#0d101a]">
          <h3 className="text-xs font-bold tracking-wider text-slate-700 uppercase dark:text-slate-200">
            {t('DETAILED TIER FEATURE COMPARISON MATRIX')}
          </h3>
        </div>
        <div className="divide-y divide-slate-200 dark:divide-slate-800/60">
          {features.map((item, idx) => (
            <div
              key={idx}
              className="grid grid-cols-3 items-center p-3.5 text-xs"
            >
              <span className="col-span-1 font-medium text-slate-900 dark:text-slate-300">
                {item.name}
              </span>
              <span className="text-center font-mono text-slate-600 dark:text-slate-400">
                {typeof item.free === 'boolean' ? (
                  item.free ? (
                    <Check className="mx-auto h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <X className="mx-auto h-4 w-4 text-rose-500" />
                  )
                ) : (
                  item.free
                )}
              </span>
              <span className="text-center font-mono font-bold text-amber-700 dark:text-amber-300">
                {typeof item.pro === 'boolean' ? (
                  item.pro ? (
                    <Check className="mx-auto h-4 w-4 text-amber-600 dark:text-amber-400" />
                  ) : (
                    <X className="mx-auto h-4 w-4 text-rose-500" />
                  )
                ) : (
                  item.pro
                )}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
