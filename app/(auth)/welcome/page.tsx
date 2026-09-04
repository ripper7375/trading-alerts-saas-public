'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ArrowRight, LineChart, Loader2, PencilRuler, Zap } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLocale } from '@/lib/context/locale-context';
import { useAppearance } from '@/components/providers/appearance-provider';
import type { AccentScheme } from '@/lib/appearance/types';

const ACCENT_OPTIONS: { id: AccentScheme; label: string; swatch: string }[] = [
  { id: 'amber', label: 'Gold Amber', swatch: 'bg-amber-500' },
  { id: 'emerald', label: 'Emerald Green', swatch: 'bg-emerald-500' },
  { id: 'blue', label: 'Sapphire Blue', swatch: 'bg-blue-500' },
  { id: 'purple', label: 'Amethyst Purple', swatch: 'bg-purple-500' },
];

export default function WelcomePage(): JSX.Element {
  const router = useRouter();
  const { status } = useSession();
  const { t } = useLocale();
  const { settings, updateSettings, saveSettings } = useAppearance();
  const [step, setStep] = useState(1);

  // Soft, client-side session gate (Decision 1: no aggressive server-side
  // redirect that would obstruct the onboarding funnel) — /welcome is
  // SESSION REQUIRED (route-map row 95), so an unauthenticated visitor is
  // sent to /login rather than shown a page bound to a session that isn't
  // there.
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [status, router]);

  const handleSelectAccent = (accent: AccentScheme): void => {
    updateSettings({ accent });
    // Pass the override directly rather than relying on `settings` having
    // already picked up the update above -- updateSettings() schedules a
    // state update but doesn't apply it synchronously, so calling
    // saveSettings() with no args here would persist the PRE-selection
    // accent (see appearance-provider.tsx's saveSettings() doc comment).
    void saveSettings({ accent });
  };

  if (status === 'loading' || status === 'unauthenticated') {
    return (
      <div className="flex w-full max-w-xl items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    );
  }

  const stepCopy: Record<1 | 2 | 3, { title: string; subtitle: string }> = {
    1: {
      title: t('Welcome to DavinTrade'),
      subtitle: t(
        'Your real-time XAUUSD alerting and charting workspace is ready.'
      ),
    },
    2: {
      title: t('Choose Your Preferred Theme Accent'),
      subtitle: t('Customize your charting accents and workspace aesthetics.'),
    },
    3: {
      title: t('Launch Your First Workspace'),
      subtitle: t(
        'Select whether you want to explore the Free Workspace or enter the PRO Terminal.'
      ),
    },
  };

  const currentStep = stepCopy[step as 1 | 2 | 3];

  return (
    <div className="w-full max-w-xl space-y-4">
      <div className="flex items-center justify-center gap-2">
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

      <Card className="space-y-6 border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800/80 dark:bg-[#090b14]/95 dark:backdrop-blur-2xl md:p-8">
        <div className="space-y-2 text-center">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 md:text-2xl">
            {currentStep.title}
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 md:text-sm">
            {currentStep.subtitle}
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
                  {t('Real-Time XAUUSD Price Alerts')}
                </h4>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  {t(
                    'Set price-trigger alerts and get notified the moment they fire.'
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-[#06080e]">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <PencilRuler className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-slate-200">
                  {t('Chart Drawing Tools & Line Alerts')}
                </h4>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  {t(
                    'Draw trendlines and levels directly on the chart, alert-bound.'
                  )}
                </p>
              </div>
            </div>

            <Button
              onClick={() => setStep(2)}
              className="mt-4 w-full"
              size="lg"
            >
              <span>{t('Continue')}</span>
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              {ACCENT_OPTIONS.map((acc) => (
                <button
                  key={acc.id}
                  onClick={() => handleSelectAccent(acc.id)}
                  className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                    settings.accent === acc.id
                      ? 'border-amber-500 bg-amber-500/15 text-slate-900 dark:text-slate-100'
                      : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:text-slate-900 dark:border-slate-800 dark:bg-[#06080e] dark:text-slate-400 dark:hover:border-slate-700'
                  }`}
                >
                  <div className={`h-4 w-4 rounded-full ${acc.swatch}`} />
                  <span className="text-xs font-semibold">{t(acc.label)}</span>
                </button>
              ))}
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setStep(1)}
                className="flex-1"
              >
                {t('Back')}
              </Button>
              <Button onClick={() => setStep(3)} className="flex-1">
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
                        {t('Full charting, alerts and drawing tools.')}
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
                        {t('Explore baseline charting and alerts.')}
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
  );
}
