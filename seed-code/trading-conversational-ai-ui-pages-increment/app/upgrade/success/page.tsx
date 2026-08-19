'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Sparkles,
  Zap,
  CheckCircle2,
  LineChart,
  ShieldCheck,
  Brain,
  ArrowRight,
  Receipt,
  MessageSquare,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLocale } from '@/lib/context/locale-context';

export default function UpgradeSuccessPage() {
  const { t } = useLocale();
  const [isConfirming, setIsConfirming] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsConfirming(false), 900);
    return () => clearTimeout(timer);
  }, []);

  const unlockedFeatures = [
    {
      icon: Zap,
      title: t('Zero-Latency Real-Time Feeds'),
      desc: t('Sub-millisecond MT5 tick throughput on Spot Gold (XAUUSD).'),
    },
    {
      icon: Brain,
      title: t('Davin AI Quantitative Assistant'),
      desc: t(
        '24/7 natural language queries, liquidity clustering, and harmonic alerts.'
      ),
    },
    {
      icon: LineChart,
      title: t('M5 & M15 Fractal Overlays'),
      desc: t('Institutional volume validation and exhaustion filters.'),
    },
    {
      icon: ShieldCheck,
      title: t('Unlimited Multi-Channel Alerts'),
      desc: t(
        'Instant Webhook payloads, Telegram bot integrations, and in-app sound chimes.'
      ),
    },
  ];

  if (isConfirming) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 text-slate-900 dark:bg-[#050609] dark:text-slate-100">
        <div className="space-y-3 text-center">
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-amber-600 dark:text-amber-400" />
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {t('Confirming your upgrade...')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 text-slate-900 dark:bg-[#050609] dark:text-slate-100">
      <div className="w-full max-w-xl space-y-6">
        <div className="space-y-2 text-center">
          <Link href="/" className="inline-flex items-center gap-2">
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
          </Link>
        </div>

        <Card className="space-y-6 border-amber-500/40 bg-white p-6 shadow-2xl md:p-8 dark:bg-[#090b14]/95">
          <div className="space-y-3 text-center">
            <div className="flex justify-center">
              <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-500/40 bg-amber-500/20 text-amber-600 shadow-lg shadow-amber-500/20 dark:text-amber-400">
                <Sparkles className="h-8 w-8" />
              </div>
            </div>
            <Badge className="bg-amber-500 px-3 py-1 text-xs font-bold text-slate-950">
              {t('PRO TIER ACTIVATED')}
            </Badge>
            <h1 className="text-2xl font-extrabold text-slate-900 md:text-3xl dark:text-slate-100">
              {t('Welcome to DavinTrade PRO!')}
            </h1>
            <p className="text-xs text-slate-600 md:text-sm dark:text-slate-400">
              {t(
                'Your account has been upgraded. All professional quantitative features and conversational AI models are now active.'
              )}
            </p>
          </div>

          <div className="grid gap-3 pt-2">
            {unlockedFeatures.map((feat, idx) => {
              const Icon = feat.icon;
              return (
                <div
                  key={idx}
                  className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800/80 dark:bg-[#06080e]"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-slate-200">
                      {feat.title}
                    </h4>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400">
                      {feat.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-col gap-3 pt-2">
            <Link href="/terminal">
              <Button className="w-full bg-gradient-to-r from-amber-500 to-amber-600 py-5 font-bold text-slate-950 shadow-lg shadow-amber-500/20 hover:from-amber-400 hover:to-amber-500">
                <Zap className="mr-2 h-5 w-5" />
                {t('Enter PRO Terminal Workspace')}
              </Button>
            </Link>
            <div className="flex items-center justify-center gap-4 pt-1 text-xs text-slate-600 dark:text-slate-500">
              <Link
                href="/settings/billing"
                className="flex items-center gap-1 hover:text-amber-600 dark:hover:text-amber-400"
              >
                <Receipt className="h-3.5 w-3.5" />
                <span>{t('View Invoice')}</span>
              </Link>
              <span>•</span>
              <Link
                href="/dashboard"
                className="hover:text-amber-600 dark:hover:text-amber-400"
              >
                {t('Go to Dashboard')}
              </Link>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
