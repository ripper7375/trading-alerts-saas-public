'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/lib/context/locale-context';
import {
  Sparkles,
  ArrowRight,
  Monitor,
  MessageSquare,
  TrendingUp,
  Bell,
  CheckCircle,
  Maximize2,
} from 'lucide-react';

export function LandingTerminalPreview() {
  const { t } = useLocale();
  const [activeTab, setActiveTab] = useState<
    'chart' | 'chat' | 'comments' | 'alerts'
  >('chart');

  return (
    <section
      id="preview"
      className="relative border-t border-slate-800/80 bg-[#080b13] py-20"
    >
      <div className="container mx-auto px-4 md:px-6">
        {/* Section Header */}
        <div className="mx-auto mb-12 max-w-3xl space-y-4 text-center">
          <div className="inline-flex items-center space-x-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1 text-xs font-bold text-amber-300">
            <Monitor className="h-3.5 w-3.5" />
            <span>{t('INTERACTIVE WORKBENCH PREVIEW')}</span>
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            {t('4-Panel Modular Trading Terminal')}
          </h2>
          <p className="text-base text-slate-400 sm:text-lg">
            {t(
              'Experience complete control with synchronized charts, dual AI model chat, live market comments, and position management.'
            )}
          </p>

          {/* Tab Selector Buttons */}
          <div className="inline-flex flex-wrap items-center justify-center gap-2 rounded-xl border border-slate-800 bg-[#0c101a] p-1.5 backdrop-blur-md">
            <button
              onClick={() => setActiveTab('chart')}
              className={`flex items-center space-x-2 rounded-lg px-4 py-2 text-xs font-bold transition-all ${
                activeTab === 'chart'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <TrendingUp className="h-4 w-4" />
              <span>{t('Multi-Timeframe Charts')}</span>
            </button>
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex items-center space-x-2 rounded-lg px-4 py-2 text-xs font-bold transition-all ${
                activeTab === 'chat'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <MessageSquare className="h-4 w-4" />
              <span>{t('AI Analyst Chat')}</span>
            </button>
            <button
              onClick={() => setActiveTab('comments')}
              className={`flex items-center space-x-2 rounded-lg px-4 py-2 text-xs font-bold transition-all ${
                activeTab === 'comments'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sparkles className="h-4 w-4" />
              <span>{t('Market Comments & Setup')}</span>
            </button>
            <button
              onClick={() => setActiveTab('alerts')}
              className={`flex items-center space-x-2 rounded-lg px-4 py-2 text-xs font-bold transition-all ${
                activeTab === 'alerts'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Bell className="h-4 w-4" />
              <span>{t('500ms Price Breach Rules')}</span>
            </button>
          </div>
        </div>

        {/* Interactive Mockup Container */}
        <div className="relative mx-auto max-w-5xl overflow-hidden rounded-2xl border border-slate-700/80 bg-[#060810] shadow-2xl">
          {/* Top Mockup Header Bar */}
          <div className="flex h-10 items-center justify-between border-b border-slate-800 bg-[#0c0f18] px-4 text-xs text-slate-400">
            <div className="flex items-center space-x-2">
              <span className="h-3 w-3 rounded-full bg-rose-500/80" />
              <span className="h-3 w-3 rounded-full bg-amber-500/80" />
              <span className="h-3 w-3 rounded-full bg-emerald-500/80" />
              <span className="ml-2 font-mono text-slate-300">
                {t('http://localhost:3009/terminal — PRO Tier Analyst Mode')}
              </span>
            </div>
            <Link href="/terminal">
              <span className="flex cursor-pointer items-center space-x-1 font-bold text-amber-400 hover:underline">
                <Maximize2 className="h-3.5 w-3.5" />
                <span>{t('Launch Fullscreen')}</span>
              </span>
            </Link>
          </div>

          {/* Content View per active tab */}
          <div className="flex min-h-[420px] flex-col justify-between bg-[#080b13] p-6">
            {activeTab === 'chart' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center space-x-3">
                    <span className="font-mono text-lg font-bold text-white">
                      XAUUSD
                    </span>
                    <span className="rounded border border-amber-500/40 bg-amber-500/20 px-2 py-0.5 text-xs font-bold text-amber-300">
                      {t('M5 / M15 Dual View')}
                    </span>
                    <span className="font-mono text-xs font-semibold text-emerald-400">
                      $2,645.80 (+1.45%)
                    </span>
                  </div>
                  <div className="flex items-center space-x-2 text-xs text-slate-400">
                    <span className="rounded bg-slate-800 px-2 py-1">
                      {t('Order Blocks: Active')}
                    </span>
                    <span className="rounded bg-slate-800 px-2 py-1">
                      {t('EMA 20/50: Bullish Confluence')}
                    </span>
                  </div>
                </div>

                {/* Simulated Chart Visual */}
                <div className="relative flex h-64 w-full flex-col justify-between overflow-hidden rounded-xl border border-slate-800 bg-[#0a0d16] p-4">
                  <div className="absolute inset-0 bg-[radial-gradient(#f59e0b_1px,transparent_1px)] [background-size:16px_16px] opacity-10" />
                  <div className="flex justify-between font-mono text-xs text-slate-500">
                    <span>{t('Resistance: $2,652.00')}</span>
                    <span>{t('Support: $2,638.50')}</span>
                  </div>
                  {/* Candlestick Waves Placeholder Visual */}
                  <div className="flex h-36 items-end justify-between space-x-2 px-4">
                    {[
                      40, 55, 48, 65, 75, 60, 85, 92, 80, 110, 125, 115, 140,
                    ].map((h, i) => (
                      <div
                        key={i}
                        className="group flex flex-1 flex-col items-center"
                      >
                        <div className="h-full w-0.5 bg-slate-600" />
                        <div
                          style={{ height: `${h}px` }}
                          className={`w-full rounded-sm ${
                            i % 2 === 0 ? 'bg-emerald-500' : 'bg-rose-500'
                          } transition-all group-hover:brightness-125`}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between border-t border-slate-800 pt-2 font-mono text-xs font-bold text-amber-400">
                    <span>{t('⚡ Davin AI Target Level: $2,655.00')}</span>
                    <span>{t('Confluence: 94%')}</span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'chat' && (
              <div className="space-y-4">
                <div className="space-y-3 rounded-xl border border-slate-800 bg-[#0c101b] p-4">
                  <div className="flex items-center space-x-2 text-xs font-bold text-amber-400">
                    <Sparkles className="h-4 w-4" />
                    <span>{t('Davin Quantitative AI Engine')}</span>
                  </div>
                  <p className="font-mono text-sm leading-relaxed text-slate-200">
                    {t(
                      '"XAUUSD is currently testing the key liquidity resistance at 2648.50 on the M15 timeframe. Confluence scan indicates a high-probability bullish continuation towards 2655.00 supported by 200 EMA structure."'
                    )}
                  </p>
                  <div className="flex items-center space-x-2 text-xs font-semibold text-emerald-400">
                    <CheckCircle className="h-3.5 w-3.5" />
                    <span>{t('Verified across 2 AI Sub-agents')}</span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'comments' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2 rounded-xl border border-slate-800 bg-[#0c101b] p-4">
                    <div className="text-xs font-bold text-slate-300">
                      {t('London Session Sentiment')}
                    </div>
                    <div className="font-mono text-2xl font-extrabold text-emerald-400">
                      {t('BULLISH 78%')}
                    </div>
                    <div className="text-xs text-slate-400">
                      {t('Higher highs confirmed on EURUSD & XAUUSD')}
                    </div>
                  </div>
                  <div className="space-y-2 rounded-xl border border-slate-800 bg-[#0c101b] p-4">
                    <div className="text-xs font-bold text-slate-300">
                      {t('Next High-Impact News')}
                    </div>
                    <div className="font-mono text-2xl font-extrabold text-amber-400">
                      14:30 GMT
                    </div>
                    <div className="text-xs text-slate-400">
                      {t('US Core CPI (YoY) Expected: 3.2%')}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'alerts' && (
              <div className="space-y-4">
                <div className="space-y-3 rounded-xl border border-slate-800 bg-[#0c101b] p-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2 text-xs font-bold text-slate-200">
                    <span>{t('Active Alert Rules')}</span>
                    <span className="text-emerald-400">
                      {t('500ms Engine Status: ONLINE')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-[#070912] p-2.5 font-mono text-xs text-slate-300">
                    <span>{t('XAUUSD Price > $2,648.50')}</span>
                    <span className="rounded bg-emerald-500/20 px-2 py-0.5 font-bold text-emerald-300">
                      {t('TRIGGERED (12ms ago)')}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Bottom Call To Action Bar */}
            <div className="flex items-center justify-between border-t border-slate-800 pt-6">
              <span className="text-xs text-slate-400">
                {t(
                  'Ready to trade with Davin AI? Get instant access to all 31 screens.'
                )}
              </span>
              <Link href="/terminal">
                <Button className="bg-amber-500 font-bold text-slate-950 hover:bg-amber-400">
                  {t('Launch Live Workbench')}
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
