'use client';

import Link from 'next/link';
import { Download, CheckCircle2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLocale } from '@/lib/context/locale-context';

interface SubscriptionCardProps {
  /**
   * DavinTrade has no client-visible session/tier signal on the shared
   * `/settings/*` route tree (unlike `/free` vs `/dashboard`, which are
   * separate routes) -- defaults to 'PRO' to preserve prior behavior.
   * Pass 'FREE' to render the upgrade-prompt view Codebase 1 shows its
   * FREE-tier users instead of a fabricated active PRO subscription.
   */
  tier?: 'FREE' | 'PRO';
}

const FREE_FEATURES = [
  'XAUUSD (Gold) — M5 & M15 real-time alerts',
  'Full market data & AI chart indicators',
  '100 price alerts (vs. 0 on Free)',
  'Drawing Engine line alerts',
  'Multi-timeframe visualization overlays',
  '500,000 monthly AI token quota',
];

export default function SubscriptionCard({
  tier = 'PRO',
}: SubscriptionCardProps) {
  const { t, formatCurrency, formatDate } = useLocale();

  const invoices = [
    {
      id: 'INV-2026-008',
      date: formatDate('2026-08-01'),
      amount: formatCurrency(49),
      status: t('Paid'),
      method: t('Visa ending in 8892'),
    },
    {
      id: 'INV-2026-007',
      date: formatDate('2026-07-01'),
      amount: formatCurrency(49),
      status: t('Paid'),
      method: t('Visa ending in 8892'),
    },
    {
      id: 'INV-2026-006',
      date: formatDate('2026-06-01'),
      amount: formatCurrency(49),
      status: t('Paid'),
      method: t('Visa ending in 8892'),
    },
  ];

  if (tier === 'FREE') {
    return (
      <div className="mx-auto max-w-4xl space-y-6 select-none">
        <div className="space-y-4 rounded-2xl border border-slate-800/80 bg-[#090c14] p-6 shadow-xl">
          <div className="flex flex-col items-start justify-between gap-4 border-b border-slate-800 pb-4 sm:flex-row sm:items-center">
            <div>
              <Badge className="border-slate-700 bg-slate-800 font-mono text-[10px] text-slate-300">
                🔒 {t('FREE PLAN')}
              </Badge>
              <h2 className="mt-1 text-lg font-extrabold text-slate-100">
                {t('DavinTrade Free Tier')}
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                {t('Free Forever')} — {t('no active subscription')}
              </p>
            </div>
            <Link href="/pricing">
              <Button className="h-9 bg-gradient-to-r from-amber-500 to-amber-600 text-xs font-extrabold text-slate-950 hover:from-amber-400 hover:to-amber-500">
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                {t('Upgrade to PRO')}
              </Button>
            </Link>
          </div>

          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
            <h3 className="mb-3 text-xs font-extrabold text-amber-300">
              {t('Unlock More with PRO')} — {formatCurrency(49)}/{t('mo')}
            </h3>
            <ul className="space-y-2">
              {FREE_FEATURES.map((feature) => (
                <li
                  key={feature}
                  className="flex items-center gap-2 text-xs text-slate-300"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  {t(feature)}
                </li>
              ))}
            </ul>
            <Link href="/pricing">
              <Button
                variant="outline"
                className="mt-4 w-full border-amber-500/40 bg-amber-500/10 text-xs text-amber-300 hover:bg-amber-500/20"
              >
                {t('Start 7-Day Free Trial')}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 select-none">
      {/* Active Subscription Box */}
      <div className="space-y-4 rounded-2xl border border-amber-500/40 bg-gradient-to-r from-[#0c0f18] via-[#121624] to-[#0d0f17] p-6 shadow-xl">
        <div className="flex flex-col items-start justify-between gap-4 border-b border-amber-500/30 pb-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <Badge className="border-amber-500/50 bg-amber-500/20 font-mono text-[10px] text-amber-300">
                ⚡ {t('PRO PLAN ACTIVE')}
              </Badge>
              <span className="font-mono text-[11px] text-slate-400">
                {t('Renews')} {formatDate('2026-09-01')}
              </span>
            </div>
            <h2 className="mt-1 text-lg font-extrabold text-slate-100">
              {t('DavinTrade PRO Tier Subscription')}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/pricing">
              <Button
                variant="outline"
                className="h-8 border-amber-500/40 bg-amber-500/10 text-xs text-amber-300 hover:bg-amber-500/20"
              >
                {t('Change Plan')}
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 text-xs sm:grid-cols-3">
          <div className="rounded-xl border border-slate-800 bg-[#06080e] p-3">
            <span className="text-[10px] text-slate-400">
              {t('Current Billing Rate')}
            </span>
            <div className="font-mono text-base font-extrabold text-amber-300">
              {formatCurrency(49)} / {t('mo')}
            </div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-[#06080e] p-3">
            <span className="text-[10px] text-slate-400">
              {t('Alert Rule Allocation')}
            </span>
            <div className="font-mono text-base font-extrabold text-slate-100">
              100 {t('Max Rules')}
            </div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-[#06080e] p-3">
            <span className="text-[10px] text-slate-400">
              {t('Monthly AI Token Quota')}
            </span>
            <div className="font-mono text-base font-extrabold text-slate-100">
              500,000 {t('Tokens')}
            </div>
          </div>
        </div>
      </div>

      {/* Invoice History Table */}
      <div className="space-y-3 overflow-hidden rounded-2xl border border-slate-800 bg-[#090c14] p-4 shadow-xl">
        <h3 className="flex items-center justify-between text-xs font-bold tracking-wider text-slate-200 uppercase">
          <span>{t('Billing & Payment History')}</span>
          <span className="font-mono text-[10px] text-slate-400">
            3 {t('Invoices')}
          </span>
        </h3>

        <div className="divide-y divide-slate-800/60">
          {invoices.map((inv) => (
            <div
              key={inv.id}
              className="flex items-center justify-between py-3 text-xs"
            >
              <div className="space-y-0.5">
                <div className="font-mono font-bold text-slate-200">
                  {inv.id}
                </div>
                <div className="text-[10px] text-slate-400">
                  {inv.date} • {inv.method}
                </div>
              </div>

              <div className="flex items-center gap-4 text-right">
                <span className="font-mono font-bold text-slate-100">
                  {inv.amount}
                </span>
                <Badge className="border-emerald-500/40 bg-emerald-500/15 font-mono text-[9px] text-emerald-400">
                  {inv.status}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-slate-400 hover:text-slate-100"
                >
                  <Download className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
