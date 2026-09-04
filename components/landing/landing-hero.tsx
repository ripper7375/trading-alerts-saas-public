'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useLocale } from '@/lib/context/locale-context';
import { Sparkles, ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react';

/**
 * Session 9-1 deferred the seed-code support-chat widget
 * (components/chat-widget/*) to Phase 14 -- it isn't wired into
 * ClientProviders yet. This hero drops seed-code's "Support Centre"
 * textarea/quick-chips sandbox (entirely built around
 * useSupportChat().openChatWithMessage()) rather than ship an input box
 * that has nothing to call.
 */
export function LandingHero() {
  const { t } = useLocale();
  const { data: session, status } = useSession();

  const userTier = (session?.user as { tier?: string } | undefined)?.tier;
  const workbenchHref = userTier === 'PRO' ? '/terminal' : '/free';
  const getStartedHref =
    status === 'authenticated' && session?.user ? workbenchHref : '/login';

  return (
    <section className="relative overflow-hidden pb-20 pt-12 md:pb-28 md:pt-20">
      {/* Dynamic Background Radial Gradients */}
      <div className="pointer-events-none absolute left-1/2 top-1/4 h-[500px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-500/10 blur-[140px]" />
      <div className="pointer-events-none absolute left-1/4 top-1/3 h-[350px] w-[350px] rounded-full bg-emerald-500/10 blur-[120px]" />
      <div className="pointer-events-none absolute right-1/4 top-1/2 h-[350px] w-[350px] rounded-full bg-cyan-500/10 blur-[120px]" />

      <div className="container relative z-10 mx-auto px-4 md:px-6">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
          {/* Left Column: Headline & Trust Indicators */}
          <div className="space-y-8 lg:col-span-6">
            {/* Top Pill */}
            <div className="inline-flex items-center space-x-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 backdrop-blur-md">
              <Sparkles className="h-4 w-4 animate-pulse text-amber-600 dark:text-amber-400" />
              <span className="text-xs font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                {t('Next-Gen AI Trading Intelligence')}
              </span>
            </div>

            {/* Main Headline */}
            <div className="space-y-4">
              <h1 className="text-4xl font-extrabold leading-[1.1] tracking-tight text-slate-900 dark:text-white sm:text-5xl lg:text-6xl">
                {t('Trade Smarter with')}{' '}
                <span className="bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500 bg-clip-text text-transparent">
                  {t('Davin AI')}
                </span>
              </h1>
              <p className="text-lg font-normal leading-relaxed text-slate-700 dark:text-slate-300">
                {t(
                  'Your 24/7 Quantitative Analyst. Real-time chart pattern recognition, multi-model signal verification, sub-500ms alerts, and institutional order management for Forex, Commodities & Crypto.'
                )}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <Link href={getStartedHref}>
                <button className="inline-flex h-11 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 px-6 font-bold text-slate-950 shadow-lg shadow-amber-500/20 transition-colors hover:from-amber-400 hover:to-amber-500">
                  {t('Get Started Free')}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </Link>
              <Link href="#pricing">
                <button className="inline-flex h-11 items-center justify-center rounded-lg border-2 border-slate-300 bg-white px-6 font-bold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:bg-slate-800">
                  {t('View Pricing')}
                </button>
              </Link>
            </div>

            {/* Metric Trust Indicators */}
            <div className="grid grid-cols-3 gap-4 pt-2">
              <div className="rounded-xl border border-slate-200 bg-white/70 p-3 text-center dark:border-slate-800/80 dark:bg-[#0c101a]/70">
                <div className="font-mono text-2xl font-extrabold text-amber-600 dark:text-amber-400">
                  &lt;500ms
                </div>
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  {t('Alert Trigger Time')}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white/70 p-3 text-center dark:border-slate-800/80 dark:bg-[#0c101a]/70">
                <div className="font-mono text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
                  94.8%
                </div>
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  {t('Signal Confluence Rate')}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white/70 p-3 text-center dark:border-slate-800/80 dark:bg-[#0c101a]/70">
                <div className="font-mono text-2xl font-extrabold text-cyan-400">
                  24/7
                </div>
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  {t('Multi-Model Oversight')}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Hero Graphic featuring Mascot & Live Ticker Image */}
          <div className="relative lg:col-span-6">
            <div className="relative mx-auto max-w-lg lg:max-w-none">
              {/* Outer Glow Ring */}
              <div className="absolute -inset-1 animate-pulse rounded-3xl bg-gradient-to-r from-amber-500 via-emerald-500 to-cyan-500 opacity-30 blur-xl" />

              {/* Main Container Card */}
              <div className="relative rounded-3xl border border-slate-700/80 bg-white p-3 shadow-2xl shadow-black dark:bg-[#0b0e17]">
                <div className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
                  <Image
                    src="/davintrade-landing-page_home.png"
                    alt={t(
                      'DavinTrade AI Wall Street Analyst Mascot and Majors Ticker'
                    )}
                    width={1200}
                    height={750}
                    priority
                    className="w-full rounded-2xl object-cover transition-transform duration-500 hover:scale-[1.02]"
                  />

                  {/* Overlaid Live AI Signal Pills */}
                  <div className="absolute left-4 top-4 rounded-xl border border-amber-500/40 bg-white/90 px-3.5 py-2 shadow-lg backdrop-blur-md dark:bg-[#0c0f17]/90">
                    <div className="flex items-center space-x-2 text-xs font-bold text-amber-700 dark:text-amber-300">
                      <span className="h-2 w-2 animate-ping rounded-full bg-emerald-400" />
                      <span>{t('LIVE SIGNAL VERIFIED')}</span>
                    </div>
                    <div className="mt-0.5 font-mono text-[11px] text-slate-700 dark:text-slate-300">
                      {t('XAUUSD M5 • Confluence Score 94%')}
                    </div>
                  </div>

                  <div className="absolute bottom-4 right-4 rounded-xl border border-emerald-500/40 bg-white/90 px-3.5 py-2 shadow-lg backdrop-blur-md dark:bg-[#0c0f17]/90">
                    <div className="flex items-center space-x-2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>{t('ORDER BLOCK BREACH')}</span>
                    </div>
                    <div className="mt-0.5 font-mono text-[11px] text-slate-700 dark:text-slate-300">
                      {t('EURUSD Target 1.08850 Reached')}
                    </div>
                  </div>
                </div>

                {/* Floating Bottom Quick Bar */}
                <div className="mt-3 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-800 dark:bg-[#070910]">
                  <div className="flex items-center space-x-2 text-slate-700 dark:text-slate-300">
                    <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <span>{t('Multi-Market Forex, Commodities & Crypto')}</span>
                  </div>
                  <Link href={workbenchHref}>
                    <span className="flex cursor-pointer items-center gap-1 font-bold text-amber-600 hover:underline dark:text-amber-400">
                      {t('Enter Workbench')} <ArrowRight className="h-3 w-3" />
                    </span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
