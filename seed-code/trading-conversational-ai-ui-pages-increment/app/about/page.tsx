'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Target,
  Zap,
  ShieldCheck,
  LineChart,
  Brain,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Cpu,
  Globe2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MarketingNavbar } from '@/components/marketing/marketing-navbar';
import { MarketingFooter } from '@/components/marketing/marketing-footer';
import { useLocale } from '@/lib/context/locale-context';

export default function AboutPage() {
  const { t } = useLocale();

  const values = [
    {
      icon: Target,
      title: t('Focus Over Feature-Bloat'),
      description: t(
        'One primary asset, engineered with absolute mathematical depth. XAUUSD across M5 and M15 with full fractal analysis and quantitative harmonic models, instead of shallow alerts across hundreds of noisy symbols.'
      ),
    },
    {
      icon: Zap,
      title: t('Signal, Not Noise'),
      description: t(
        'Real-time automated validation filters every tick. Alerts trigger only when multi-timeframe fractal alignment, momentum exhaustion, and institutional volume thresholds are strictly satisfied.'
      ),
    },
    {
      icon: Brain,
      title: t('Conversational Quantitative AI'),
      description: t(
        'Ask Davin AI anything about current market structure, support/resistance clustering, macroeconomic calendar risks, or strategy setups in natural language 24/7.'
      ),
    },
    {
      icon: ShieldCheck,
      title: t('Total Transparency & Speed'),
      description: t(
        'Sub-millisecond MT5 execution pipes, zero black-box promises, clear risk-to-reward metrics, and verified public performance telemetry.'
      ),
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-[#050609] text-slate-100">
      <MarketingNavbar />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden border-b border-slate-800/80 px-4 py-20 md:px-6 md:py-28">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(245,158,11,0.15),transparent_60%)]" />
          <div className="relative container mx-auto max-w-5xl space-y-6 text-center">
            <Badge className="border-amber-500/40 bg-amber-500/15 px-3 py-1 font-mono text-xs text-amber-400">
              {t('About DavinTrade AI')}
            </Badge>

            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl">
              {t('Precision Gold Analytics Powered by')}{' '}
              <span className="bg-gradient-to-r from-amber-400 via-amber-200 to-yellow-500 bg-clip-text text-transparent">
                {t('Conversational AI')}
              </span>
            </h1>

            <p className="mx-auto max-w-2xl text-base leading-relaxed text-slate-400 md:text-lg">
              {t(
                'We built DavinTrade because retail traders deserve the same quantitative rigor, real-time fractal signal precision, and sub-second execution telemetry that institutional desks use every day.'
              )}
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
              <Link href="/register">
                <Button className="bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-5 font-bold text-slate-950 shadow-lg shadow-amber-500/20 hover:from-amber-400 hover:to-amber-500">
                  <Sparkles className="mr-2 h-4 w-4" />
                  {t('Start Exploring Free')}
                </Button>
              </Link>
              <Link href="/terminal">
                <Button
                  variant="outline"
                  className="border-slate-700 bg-slate-900/60 px-6 py-5 text-slate-200 hover:bg-slate-800"
                >
                  <LineChart className="mr-2 h-4 w-4 text-amber-400" />
                  {t('Open PRO Terminal')}
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Core Principles */}
        <section className="container mx-auto max-w-6xl px-4 py-16 md:px-6">
          <div className="mb-12 space-y-3 text-center">
            <h2 className="text-2xl font-extrabold text-slate-100 md:text-3xl">
              {t('Our Engineering Principles')}
            </h2>
            <p className="mx-auto max-w-xl text-sm text-slate-400">
              {t(
                'How we design algorithmic tools that genuinely empower traders to make disciplined, high-probability decisions.'
              )}
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {values.map((v, idx) => {
              const Icon = v.icon;
              return (
                <Card
                  key={idx}
                  className="border-slate-800/80 bg-[#090b14]/80 backdrop-blur-xl transition-all duration-200 hover:border-amber-500/40 hover:bg-[#0c0f1d]"
                >
                  <CardContent className="space-y-4 p-6">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400">
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-100">
                      {v.title}
                    </h3>
                    <p className="text-sm leading-relaxed text-slate-400">
                      {v.description}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        {/* Global Infrastructure Stats */}
        <section className="border-t border-slate-800/80 bg-[#070910] px-4 py-16 md:px-6">
          <div className="container mx-auto max-w-5xl">
            <div className="grid grid-cols-2 gap-6 text-center md:grid-cols-4">
              <div className="space-y-1">
                <div className="font-mono text-3xl font-extrabold text-amber-400 md:text-4xl">
                  &lt; 50ms
                </div>
                <div className="text-xs font-medium text-slate-400">
                  {t('Tick Processing Latency')}
                </div>
              </div>
              <div className="space-y-1">
                <div className="font-mono text-3xl font-extrabold text-amber-400 md:text-4xl">
                  99.98%
                </div>
                <div className="text-xs font-medium text-slate-400">
                  {t('Platform Uptime')}
                </div>
              </div>
              <div className="space-y-1">
                <div className="font-mono text-3xl font-extrabold text-amber-400 md:text-4xl">
                  24/7
                </div>
                <div className="text-xs font-medium text-slate-400">
                  {t('AI Copilot Availability')}
                </div>
              </div>
              <div className="space-y-1">
                <div className="font-mono text-3xl font-extrabold text-amber-400 md:text-4xl">
                  100%
                </div>
                <div className="text-xs font-medium text-slate-400">
                  {t('Rule-Based Logic')}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
