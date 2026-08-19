'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Check, Sparkles, Zap, Shield, ArrowRight } from 'lucide-react';
import { useLocale } from '@/lib/context/locale-context';

export function LandingPricing() {
  const { t } = useLocale();

  return (
    <section
      id="pricing"
      className="relative bg-slate-50 py-20 dark:bg-[#06070a]"
    >
      <div className="container mx-auto px-4 md:px-6">
        {/* Section Title */}
        <div className="mx-auto mb-16 max-w-3xl space-y-4 text-center">
          <div className="inline-flex items-center space-x-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1 text-xs font-bold text-amber-700 dark:text-amber-300">
            <Zap className="h-3.5 w-3.5" />
            <span>{t('TRANSPARENT SAAS PRICING')}</span>
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            {t('Choose Your Analytical Advantage')}
          </h2>
          <p className="text-base text-slate-500 sm:text-lg dark:text-slate-400">
            {t(
              'Start with our generous FREE tier or unlock full PRO multi-model AI capabilities.'
            )}
          </p>
        </div>

        {/* Pricing Cards Grid */}
        <div className="mx-auto grid max-w-4xl grid-cols-1 gap-8 md:grid-cols-2">
          {/* FREE Tier Card */}
          <div className="relative flex flex-col justify-between rounded-2xl border border-slate-200 bg-white/80 p-8 shadow-xl backdrop-blur-md dark:border-slate-800 dark:bg-[#0c101a]/80">
            <div>
              <div className="mb-4 flex items-center justify-between">
                <span className="text-xs font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                  {t('FREE STARTER TIER')}
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  {t('Read-Only Analyst')}
                </span>
              </div>
              <div className="mb-6 flex items-baseline space-x-2">
                <span className="font-mono text-4xl font-extrabold text-white">
                  $0
                </span>
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  {t('/ forever free')}
                </span>
              </div>
              <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
                {t(
                  'Ideal for beginner traders wanting read-only AI market history and live M5 XAUUSD charts.'
                )}
              </p>

              <ul className="mb-8 space-y-3 text-sm text-slate-700 dark:text-slate-300">
                <li className="flex items-center space-x-3">
                  <Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span>{t('3-Panel Read-Only Terminal')}</span>
                </li>
                <li className="flex items-center space-x-3">
                  <Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span>{t('Live M5 XAUUSD Chart Stream')}</span>
                </li>
                <li className="flex items-center space-x-3">
                  <Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span>{t('5 Standard Alert Rules')}</span>
                </li>
                <li className="flex items-center space-x-3 text-slate-600 dark:text-slate-500">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 text-[10px] dark:border-slate-700">
                    ✕
                  </span>
                  <span>{t('Multi-Model AI Confluence (Pro)')}</span>
                </li>
              </ul>
            </div>

            <Link href="/free">
              <Button
                variant="outline"
                className="h-11 w-full border-slate-300 bg-slate-100 font-bold text-white hover:bg-slate-700 dark:border-slate-700 dark:bg-slate-800/80"
              >
                {t('Try Free Terminal')}
              </Button>
            </Link>
          </div>

          {/* PRO Tier Card */}
          <div className="relative flex flex-col justify-between rounded-2xl border-2 border-amber-500/60 bg-gradient-to-b from-amber-50 to-white p-8 shadow-2xl shadow-amber-500/10 dark:from-[#131826] dark:to-[#0c0f18]">
            <div className="absolute -top-3.5 right-8 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 px-3 py-1 text-xs font-bold tracking-wider text-slate-950 uppercase shadow-md">
              {t('POPULAR PRO TIER')}
            </div>

            <div>
              <div className="mb-4 flex items-center justify-between">
                <span className="flex items-center gap-1 text-xs font-bold tracking-wider text-amber-600 uppercase dark:text-amber-400">
                  <Sparkles className="h-3.5 w-3.5" />
                  {t('PRO QUANTITATIVE SUITE')}
                </span>
              </div>
              <div className="mb-6 flex items-baseline space-x-2">
                <span className="font-mono text-4xl font-extrabold text-white">
                  $49
                </span>
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  {t('/ month')}
                </span>
              </div>
              <p className="mb-6 text-sm text-slate-700 dark:text-slate-300">
                {t(
                  'Full 4-Panel Workbench, dual AI model confluence score, sub-500ms alerts, & local multi-currency checkout.'
                )}
              </p>

              <ul className="mb-8 space-y-3 text-sm text-slate-800 dark:text-slate-200">
                <li className="flex items-center space-x-3">
                  <Check className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <span className="font-bold">
                    {t('Full 4-Panel Resizable Workbench')}
                  </span>
                </li>
                <li className="flex items-center space-x-3">
                  <Check className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <span>{t('Dual AI Model Pattern Verification')}</span>
                </li>
                <li className="flex items-center space-x-3">
                  <Check className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <span>{t('Sub-500ms Unlimited Price Breach Alerts')}</span>
                </li>
                <li className="flex items-center space-x-3">
                  <Check className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <span>
                    {t('Multi-Currency Local Checkout (£, ₹, ₫, ฿, ₦, Rs)')}
                  </span>
                </li>
              </ul>
            </div>

            <Link href="/checkout">
              <Button className="h-11 w-full bg-gradient-to-r from-amber-500 via-amber-600 to-amber-500 font-extrabold text-slate-950 shadow-lg shadow-amber-500/25 hover:from-amber-400 hover:to-amber-500">
                {t('Upgrade to PRO Access')}
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
