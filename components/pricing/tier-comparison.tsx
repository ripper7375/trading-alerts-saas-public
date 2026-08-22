'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, X, Sparkles, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLocale } from '@/lib/context/locale-context';
import { FREE_TIER_CONFIG, PRO_TIER_CONFIG } from '@/lib/tier-config';

/**
 * Ported from seed-code's tier-comparison.tsx, which hardcoded the PRO price
 * ($39/$49 monthly/annual toggle) and an entirely fabricated feature list
 * (multi-model AI chat, quad-RAG queries, live market comments feed, 500K
 * token quota) -- Stack D/E features from Phases 12/13, not built in this
 * repo yet ("the repo has zero LLM SDKs, no VANNA, no txtai" per
 * MASTER-ROADMAP-PHASES-7-15.md). Shipping that list would advertise
 * non-existent product capabilities to paying customers.
 *
 * This version keeps seed-code's visual design but binds price to
 * lib/tier-config.ts (PRO_MONTHLY_PRICE, the tier system's single source of
 * truth) via useLocale().formatCurrency, per Davin's explicit instruction at
 * CONFIRM, and lists the REAL V8 single-symbol feature set both tiers
 * actually have today (alerts, rate limit, drawing-engine line alerts,
 * multi-timeframe visualization, notifications, export, support) -- the
 * same substance the previous (differently-styled) version of this
 * component already showed.
 *
 * No separate annual Stripe Price ID exists (checkout only knows
 * STRIPE_PRO_MONTHLY_PRICE_ID, app/api/checkout/route.ts has no billing-
 * cycle parameter) -- same as the component this replaces, the annual
 * figure is informational (price x10 months) rather than a distinct
 * purchasable plan; both CTAs go through the one real monthly checkout.
 */
export function TierComparison(): React.ReactElement {
  const { t, formatCurrency } = useLocale();
  const [isAnnual, setIsAnnual] = useState(true);

  const monthlyPrice = PRO_TIER_CONFIG.price;
  const annualPrice = Math.round(monthlyPrice * 10); // 10 months billed, 2 free
  const annualSavingsPercent = Math.round(
    ((monthlyPrice * 12 - annualPrice) / (monthlyPrice * 12)) * 100
  );

  const features = [
    {
      name: t('XAUUSD Real-Time M5/M15 Data Stream'),
      free: true,
      pro: true,
    },
    {
      name: t('Server-Side Price & Line Alert Rules'),
      free: `${FREE_TIER_CONFIG.maxAlerts} ${t('Active Alerts')}`,
      pro: `${PRO_TIER_CONFIG.maxAlerts} ${t('Active Alerts')}`,
    },
    {
      name: t('Drawing-Engine Line Alerts'),
      free: false,
      pro: true,
    },
    {
      name: t('Multi-Timeframe Visualization'),
      free: false,
      pro: true,
    },
    {
      name: t('Alert Notifications'),
      free: false,
      pro: true,
    },
    {
      name: t('API Rate Limit'),
      free: `${FREE_TIER_CONFIG.rateLimit}/${t('hour')}`,
      pro: `${PRO_TIER_CONFIG.rateLimit}/${t('hour')}`,
    },
    {
      name: t('Data Export'),
      free: false,
      pro: true,
    },
    {
      name: t('Priority Support'),
      free: false,
      pro: true,
    },
  ];

  return (
    <div className="mx-auto max-w-5xl select-none space-y-8">
      {/* Billing Cycle Toggle */}
      <div className="flex flex-col items-center space-y-3 text-center">
        <Badge className="border-amber-500/40 bg-amber-500/10 px-3 py-1 font-mono text-xs text-amber-700 dark:text-amber-300">
          ⚡ {t('ONE SYMBOL, FULL DATA ACCESS, PRO UNLOCKS ALERTS & MORE')}
        </Badge>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
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
            <span className="rounded bg-amber-300 px-1.5 py-0.5 text-[9px] font-extrabold uppercase text-slate-950">
              {t('SAVE')} {annualSavingsPercent}%
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
                  {t('Full XAUUSD data access, read-only alerts')}
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
              className="h-10 w-full border-slate-300 bg-slate-100 text-xs font-bold text-slate-800 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <Link href="/register">{t('Get Started Free')}</Link>
            </Button>
          </div>

          <div className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800/80">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              {t('PLAN HIGHLIGHTS:')}
            </h4>
            <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />{' '}
                {t('Full XAUUSD M5/M15 Data & Indicator Access')}
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />{' '}
                {`${FREE_TIER_CONFIG.rateLimit} ${t('Requests/Hour')}`}
              </li>
              <li className="flex items-center gap-2 text-slate-400 dark:text-slate-500">
                <X className="h-4 w-4 shrink-0 text-rose-500" />{' '}
                {t('0 Active Alerts (PRO Exclusive)')}
              </li>
              <li className="flex items-center gap-2 text-slate-400 dark:text-slate-500">
                <X className="h-4 w-4 shrink-0 text-rose-500" />{' '}
                {t('Multi-Timeframe Visualization Locked')}
              </li>
            </ul>
          </div>
        </div>

        {/* PRO Tier Card */}
        <div className="relative flex flex-col justify-between space-y-6 rounded-2xl border-2 border-amber-500/60 bg-gradient-to-b from-amber-500/10 via-amber-500/5 to-slate-100 p-6 shadow-2xl dark:from-[#0e121e] dark:to-[#080a10]">
          <div className="absolute -top-3 right-6 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 px-3 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-950 shadow-md">
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
                  {t(
                    'Alerts, multi-timeframe visualization & priority support'
                  )}
                </p>
              </div>
              <Badge className="border-amber-500/50 bg-amber-500/20 font-mono text-[10px] text-amber-700 dark:text-amber-300">
                {`${PRO_TIER_CONFIG.maxAlerts} ${t('ALERTS')}`}
              </Badge>
            </div>

            <div className="flex items-baseline gap-1">
              <span className="font-mono text-3xl font-extrabold text-amber-700 dark:text-amber-300">
                {formatCurrency(isAnnual ? annualPrice / 12 : monthlyPrice)}
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
            <h4 className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
              {t('EVERYTHING IN FREE, PLUS:')}
            </h4>
            <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-200">
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />{' '}
                {`${PRO_TIER_CONFIG.maxAlerts} ${t('Server-Side Price & Line Alert Rules')}`}
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />{' '}
                {t('Drawing-Engine Line Alerts')}
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />{' '}
                {t('Multi-Timeframe Visualization')}
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />{' '}
                {t('Email/Push Alert Notifications')}
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />{' '}
                {`${PRO_TIER_CONFIG.rateLimit} ${t('Requests/Hour')}`}
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Feature Comparison Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-[#090c14]">
        <div className="border-b border-slate-200 bg-slate-100/80 p-4 dark:border-slate-800 dark:bg-[#0d101a]">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
            {t('DETAILED TIER FEATURE COMPARISON')}
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

export default TierComparison;
