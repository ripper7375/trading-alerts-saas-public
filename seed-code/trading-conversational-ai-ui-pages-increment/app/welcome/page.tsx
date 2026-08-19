'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  ArrowRight,
  CheckCircle2,
  LineChart,
  Palette,
  Bell,
  MessageSquare,
  Shield,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLocale } from '@/lib/context/locale-context';
import { useAppearance } from '@/components/providers/appearance-provider';

export default function WelcomePage() {
  const router = useRouter();
  const { t } = useLocale();
  const { settings, updateSettings } = useAppearance();
  const [step, setStep] = useState(1);

  const steps = [
    {
      step: 1,
      title: t('Welcome to DavinTrade AI'),
      subtitle: t(
        'Your quantitative AI copilot for XAUUSD fractal market intelligence is ready.'
      ),
    },
    {
      step: 2,
      title: t('Choose Your Preferred Theme Accent'),
      subtitle: t('Customize your charting accents and workspace aesthetics.'),
    },
    {
      step: 3,
      title: t('Launch Your First Workspace'),
      subtitle: t(
        'Select whether you want to explore the Free Workspace or enter the PRO Terminal.'
      ),
    },
  ];

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-4 text-slate-900 dark:bg-[#050609] dark:text-slate-100">
      <div className="w-full max-w-xl space-y-6">
        {/* Logo & Step indicator */}
        <div className="space-y-3 text-center">
          <div className="inline-flex items-center gap-2">
            <div className="relative flex h-11 w-11 overflow-hidden rounded-xl border border-amber-500/40 bg-amber-500/20 p-0.5 shadow-lg shadow-amber-500/20">
              <Image
                src="/davintrade-ai-icon.png"
                alt="DavinTrade AI"
                width={44}
                height={44}
                className="h-full w-full rounded-[9px] object-cover"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>
            <span className="bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-600 bg-clip-text text-2xl font-black text-transparent dark:from-amber-400 dark:to-amber-200">
              DavinTrade AI
            </span>
          </div>

          <div className="flex items-center justify-center gap-2 pt-1">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  step === s
                    ? 'w-8 bg-amber-500'
                    : step > s
                      ? 'w-4 bg-amber-500/50'
                      : 'w-4 bg-slate-200 dark:bg-slate-800'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Step Card */}
        <Card className="space-y-6 border-slate-200 bg-white p-6 shadow-2xl md:p-8 dark:border-slate-800/80 dark:bg-[#090b14]/95 dark:backdrop-blur-2xl">
          <div className="space-y-2 text-center">
            <h2 className="text-xl font-bold text-slate-900 md:text-2xl dark:text-slate-100">
              {steps[step - 1].title}
            </h2>
            <p className="text-xs text-slate-600 md:text-sm dark:text-slate-400">
              {steps[step - 1].subtitle}
            </p>
          </div>

          {step === 1 && (
            <div className="space-y-3 py-2">
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-[#06080e]">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <LineChart className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-200">
                    {t('Real-Time XAUUSD M5/M15 Fractal Feeds')}
                  </h4>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    {t('Multi-timeframe liquidity detection.')}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-[#06080e]">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-200">
                    {t('Davin AI Quantitative Chat Copilot')}
                  </h4>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    {t('Instant market context via floating widget.')}
                  </p>
                </div>
              </div>

              <Button
                onClick={() => setStep(2)}
                className="mt-4 w-full bg-amber-500 py-5 font-bold text-slate-950 hover:bg-amber-400"
              >
                <span>{t('Continue')}</span>
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                {[
                  {
                    id: 'amber',
                    label: t('Gold Amber'),
                    color: 'bg-amber-500',
                  },
                  {
                    id: 'emerald',
                    label: t('Emerald Green'),
                    color: 'bg-emerald-500',
                  },
                  {
                    id: 'blue',
                    label: t('Sapphire Blue'),
                    color: 'bg-blue-500',
                  },
                  {
                    id: 'purple',
                    label: t('Amethyst Purple'),
                    color: 'bg-purple-500',
                  },
                ].map((acc) => (
                  <button
                    key={acc.id}
                    onClick={() => updateSettings({ accent: acc.id as any })}
                    className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                      settings.accent === acc.id
                        ? 'border-amber-500 bg-amber-500/15 text-slate-900 dark:text-slate-100'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:text-slate-900 dark:border-slate-800 dark:bg-[#06080e] dark:text-slate-400 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className={`h-4 w-4 rounded-full ${acc.color}`} />
                    <span className="text-xs font-semibold">{acc.label}</span>
                  </button>
                ))}
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setStep(1)}
                  className="flex-1 border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  {t('Back')}
                </Button>
                <Button
                  onClick={() => setStep(3)}
                  className="flex-1 bg-amber-500 font-bold text-slate-950 hover:bg-amber-400"
                >
                  <span>{t('Next')}</span>
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 py-2">
              <div className="grid gap-3">
                <Link href="/terminal">
                  <div className="group flex items-center justify-between rounded-xl border border-amber-500/40 bg-gradient-to-r from-amber-500/15 to-amber-500/5 p-4 transition-all hover:border-amber-400 hover:shadow-lg hover:shadow-amber-500/10 dark:to-[#0e1220]">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 font-bold text-slate-950">
                        <Zap className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                            {t('PRO Terminal Workspace')}
                          </h4>
                          <Badge className="bg-amber-500 text-[10px] font-bold text-slate-950">
                            {t('RECOMMENDED')}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400">
                          {t(
                            'Real-time zero latency, conversational AI, full indicators.'
                          )}
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-amber-600 transition-transform group-hover:translate-x-1 dark:text-amber-400" />
                  </div>
                </Link>

                <Link href="/free">
                  <div className="group flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4 transition-all hover:border-slate-300 hover:bg-slate-100/80 dark:border-slate-800 dark:bg-[#06080e] dark:hover:border-slate-700">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        <LineChart className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-slate-200">
                          {t('Free Workspace Overview')}
                        </h4>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400">
                          {t(
                            'Explore delayed sample charts and baseline telemetry.'
                          )}
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-slate-500 transition-transform group-hover:translate-x-1 dark:text-slate-400" />
                  </div>
                </Link>
              </div>

              <div className="pt-2 text-center">
                <Link
                  href="/dashboard"
                  className="text-xs text-slate-600 underline underline-offset-4 hover:text-amber-600 dark:text-slate-500 dark:hover:text-amber-400"
                >
                  {t('Or go straight to User Dashboard')}
                </Link>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
