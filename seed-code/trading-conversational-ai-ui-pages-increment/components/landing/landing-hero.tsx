'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useSupportChat } from '@/components/chat-widget/chat-context';
import { useLocale } from '@/lib/context/locale-context';
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Headphones,
  CheckCircle2,
} from 'lucide-react';

export function LandingHero() {
  const { t } = useLocale();
  const [prompt, setPrompt] = useState(t('How can I help you today ?'));
  const router = useRouter();
  const { openChatWithMessage } = useSupportChat();

  const handleLaunchSupport = () => {
    if (prompt.trim()) {
      openChatWithMessage(prompt);
    } else {
      openChatWithMessage(t('How can I help you today ?'));
    }
  };

  const handleChipClick = (topicText: string) => {
    setPrompt(t(`Tell me more about ${topicText}...`));
    openChatWithMessage(
      t(`I have a question about ${topicText}...`),
      topicText
    );
  };

  return (
    <section className="relative overflow-hidden pt-12 pb-20 md:pt-20 md:pb-28">
      {/* Dynamic Background Radial Gradients */}
      <div className="pointer-events-none absolute top-1/4 left-1/2 h-[500px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-500/10 blur-[140px]" />
      <div className="pointer-events-none absolute top-1/3 left-1/4 h-[350px] w-[350px] rounded-full bg-emerald-500/10 blur-[120px]" />
      <div className="pointer-events-none absolute top-1/2 right-1/4 h-[350px] w-[350px] rounded-full bg-cyan-500/10 blur-[120px]" />

      <div className="relative z-10 container mx-auto px-4 md:px-6">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
          {/* Left Column: Headline & Customer Support Centre */}
          <div className="space-y-8 lg:col-span-6">
            {/* Top Pill */}
            <div className="inline-flex items-center space-x-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 backdrop-blur-md">
              <Sparkles className="h-4 w-4 animate-pulse text-amber-600 dark:text-amber-400" />
              <span className="text-xs font-bold tracking-wide text-amber-700 uppercase dark:text-amber-300">
                {t('Next-Gen AI Trading Intelligence')}
              </span>
            </div>

            {/* Main Headline */}
            <div className="space-y-4">
              <h1 className="text-4xl leading-[1.1] font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl">
                {t('Trade Smarter with')}{' '}
                <span className="bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500 bg-clip-text text-transparent">
                  {t('Davin AI')}
                </span>
              </h1>
              <p className="text-lg leading-relaxed font-normal text-slate-700 dark:text-slate-300">
                {t(
                  'Your 24/7 Quantitative Analyst. Real-time chart pattern recognition, multi-model signal verification, sub-500ms alerts, and institutional order management for Forex, Commodities & Crypto.'
                )}
              </p>
            </div>

            {/* Support Centre Input Sandbox */}
            <div className="relative rounded-2xl border border-slate-700/80 bg-white/90 p-2.5 shadow-2xl shadow-black/80 backdrop-blur-xl transition-all focus-within:border-amber-500/60 focus-within:ring-1 focus-within:ring-amber-500/30 dark:bg-[#0d111c]/90">
              {/* Header Badge "Support Centre" */}
              <div className="mb-2 flex items-center space-x-2 border-b border-slate-200 px-3 py-1 pb-2 text-xs font-semibold text-amber-400/90 dark:border-slate-800/60">
                <Headphones className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                <span>{t('Support Centre')}</span>
              </div>

              {/* Textarea content */}
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleLaunchSupport();
                  }
                }}
                rows={2}
                placeholder={t('How can I help you today ?')}
                className="w-full resize-none bg-transparent px-3 py-1 text-sm font-medium text-slate-900 placeholder:text-slate-500 focus:outline-none dark:text-slate-100"
              />

              <div className="flex flex-col justify-between gap-3 border-t border-slate-200 px-2 pt-2 sm:flex-row sm:items-center dark:border-slate-800/60">
                {/* Quick Chips "Product Info | Technical Support | PRO Subscription | Billing" */}
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <button
                    type="button"
                    onClick={() => handleChipClick('Product Info')}
                    className="rounded border border-slate-700/50 bg-slate-800/90 px-2.5 py-1 text-[11px] font-semibold text-slate-700 transition-colors hover:bg-amber-500/20 hover:text-amber-700 dark:text-slate-300 dark:hover:text-amber-300"
                  >
                    {t('Product Info')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleChipClick('Technical Support')}
                    className="rounded border border-slate-700/50 bg-slate-800/90 px-2.5 py-1 text-[11px] font-semibold text-slate-700 transition-colors hover:bg-amber-500/20 hover:text-amber-700 dark:text-slate-300 dark:hover:text-amber-300"
                  >
                    {t('Technical Support')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleChipClick('PRO Subscription')}
                    className="rounded border border-slate-700/50 bg-slate-800/90 px-2.5 py-1 text-[11px] font-semibold text-slate-700 transition-colors hover:bg-amber-500/20 hover:text-amber-700 dark:text-slate-300 dark:hover:text-amber-300"
                  >
                    {t('PRO Subscription')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleChipClick('Billing')}
                    className="rounded border border-slate-700/50 bg-slate-800/90 px-2.5 py-1 text-[11px] font-semibold text-slate-700 transition-colors hover:bg-amber-500/20 hover:text-amber-700 dark:text-slate-300 dark:hover:text-amber-300"
                  >
                    {t('Billing')}
                  </button>
                </div>

                {/* Button "Ask Customer Support" (Triggers Floating Chat Box matching chat-feature-1.png) */}
                <Button
                  onClick={handleLaunchSupport}
                  size="sm"
                  className="h-9 shrink-0 bg-gradient-to-r from-amber-500 to-amber-600 font-bold text-slate-950 shadow-lg shadow-amber-500/20 hover:from-amber-400 hover:to-amber-500"
                >
                  {t('Ask Customer Support')}
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </div>
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
                  <div className="absolute top-4 left-4 rounded-xl border border-amber-500/40 bg-white/90 px-3.5 py-2 shadow-lg backdrop-blur-md dark:bg-[#0c0f17]/90">
                    <div className="flex items-center space-x-2 text-xs font-bold text-amber-700 dark:text-amber-300">
                      <span className="h-2 w-2 animate-ping rounded-full bg-emerald-400" />
                      <span>{t('LIVE SIGNAL VERIFIED')}</span>
                    </div>
                    <div className="mt-0.5 font-mono text-[11px] text-slate-700 dark:text-slate-300">
                      {t('XAUUSD M5 • Confluence Score 94%')}
                    </div>
                  </div>

                  <div className="absolute right-4 bottom-4 rounded-xl border border-emerald-500/40 bg-white/90 px-3.5 py-2 shadow-lg backdrop-blur-md dark:bg-[#0c0f17]/90">
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
                  <Link href="/terminal">
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
