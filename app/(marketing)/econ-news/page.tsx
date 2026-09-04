'use client';

import { useMemo, useState } from 'react';
import { Zap, Flame } from 'lucide-react';
import { EconomicCalendarWidget } from '@/components/calendar/economic-calendar-widget';
import { useLocale } from '@/lib/context/locale-context';
import { resolveTradingViewLocale } from '@/lib/utils/tradingview-locale';
import { Badge } from '@/components/ui/badge';

const REGION_PRESETS = {
  all: {
    labelKey: 'econNews.region.all',
    label: 'Global (All)',
    filter: undefined as string | undefined,
  },
  majors: {
    labelKey: 'econNews.region.majors',
    label: 'Forex Majors',
    filter: 'us,eu,gb,jp,ca,au,ch,nz',
  },
  us: {
    labelKey: 'econNews.region.us',
    label: 'US Only',
    filter: 'us',
  },
  asia: {
    labelKey: 'econNews.region.asia',
    label: 'Asia-Pacific',
    filter: 'cn,jp,au,nz,in,sg',
  },
} as const;

export default function EconNewsPage() {
  const { t, language } = useLocale();
  const [importance, setImportance] = useState<string>('-1,0,1');
  const [region, setRegion] = useState<keyof typeof REGION_PRESETS>('all');

  const tvLocale = useMemo(
    () => resolveTradingViewLocale(language),
    [language]
  );

  return (
    <div className="container mx-auto space-y-8 px-4 py-8 md:px-6 md:py-12">
      {/* Hero Header */}
      <div className="flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl space-y-2">
          <div className="flex items-center gap-2">
            <Badge className="border-amber-500/40 bg-amber-500/15 font-semibold text-amber-600 dark:text-amber-400">
              <Flame className="mr-1 h-3.5 w-3.5" />
              {t('Macro Intelligence')}
            </Badge>
            <span className="text-xs text-muted-foreground">
              • {t('Real-Time Updates')}
            </span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            {t('Economic Calendar & News')}
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t(
              'Track market-moving macroeconomic events, central bank interest rate decisions, CPI inflation data, and employment releases in real time.'
            )}
          </p>
        </div>

        {/* Quick Filter Toolbar */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Volatility / Impact Filter */}
          <div className="bg-muted/40 flex items-center rounded-lg border border-border p-1 text-xs">
            <button
              type="button"
              onClick={() => setImportance('-1,0,1')}
              className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                importance === '-1,0,1'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t('All Impact')}
            </button>
            <button
              type="button"
              onClick={() => setImportance('0,1')}
              className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                importance === '0,1'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t('Medium & High')}
            </button>
            <button
              type="button"
              onClick={() => setImportance('1')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors ${
                importance === '1'
                  ? 'border border-amber-500/30 bg-amber-500/20 font-bold text-amber-600 shadow-sm dark:text-amber-400'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Zap className="h-3 w-3 text-amber-500" />
              {t('High Impact Only')}
            </button>
          </div>

          {/* Region Presets */}
          <div className="bg-muted/40 flex items-center rounded-lg border border-border p-1 text-xs">
            {(
              Object.keys(REGION_PRESETS) as Array<keyof typeof REGION_PRESETS>
            ).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setRegion(key)}
                className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                  region === key
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t(REGION_PRESETS[key].labelKey, REGION_PRESETS[key].label)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Calendar Card */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-xl shadow-black/5 md:p-6">
        <EconomicCalendarWidget
          height={750}
          width="100%"
          importanceFilter={importance}
          countryFilter={REGION_PRESETS[region].filter}
          locale={tvLocale}
        />
      </div>
    </div>
  );
}
