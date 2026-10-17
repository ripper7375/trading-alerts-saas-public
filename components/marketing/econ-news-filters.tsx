'use client';

import { createContext, useContext, useMemo, useState } from 'react';
import { Zap } from 'lucide-react';

import { EconomicCalendarWidget } from '@/components/calendar/economic-calendar-widget';
import { useLocale } from '@/lib/context/locale-context';
import { resolveTradingViewLocale } from '@/lib/utils/tradingview-locale';

import {
  IMPORTANCE_ALL,
  IMPORTANCE_HIGH,
  IMPORTANCE_MEDIUM_HIGH,
  REGION_KEYS,
  REGION_PRESETS,
  type RegionKey,
} from './econ-news-presets';

/**
 * The economic-calendar page's filters. The page is a Server Component; the
 * impact and region the visitor picked are client state. The toolbar sits in
 * the page header and the calendar below it, so the state lives in a provider
 * that wraps both and renders no markup of its own.
 *
 * @module components/marketing/econ-news-filters
 */

interface EconNewsFilterState {
  importance: string;
  setImportance: (importance: string) => void;
  region: RegionKey;
  setRegion: (region: RegionKey) => void;
}

const EconNewsFilterContext = createContext<EconNewsFilterState | null>(null);

function useEconNewsFilter(): EconNewsFilterState {
  const filter = useContext(EconNewsFilterContext);
  if (!filter) throw new Error('Econ news parts must sit in EconNewsFilters');
  return filter;
}

export function EconNewsFilters({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const [importance, setImportance] = useState<string>(IMPORTANCE_ALL);
  const [region, setRegion] = useState<RegionKey>('all');
  return (
    <EconNewsFilterContext.Provider
      value={{ importance, setImportance, region, setRegion }}
    >
      {children}
    </EconNewsFilterContext.Provider>
  );
}

export interface EconNewsToolbarLabels {
  allImpact: string;
  mediumAndHigh: string;
  highImpactOnly: string;
  /** Each region preset's name in the visitor's language. */
  regions: Record<RegionKey, string>;
}

export function EconNewsToolbar({
  labels,
}: {
  labels: EconNewsToolbarLabels;
}): React.ReactElement {
  const { importance, setImportance, region, setRegion } = useEconNewsFilter();
  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Volatility / Impact Filter */}
      <div className="bg-muted/40 flex items-center rounded-lg border border-border p-1 text-xs">
        <button
          type="button"
          onClick={() => setImportance(IMPORTANCE_ALL)}
          className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
            importance === IMPORTANCE_ALL
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {labels.allImpact}
        </button>
        <button
          type="button"
          onClick={() => setImportance(IMPORTANCE_MEDIUM_HIGH)}
          className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
            importance === IMPORTANCE_MEDIUM_HIGH
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {labels.mediumAndHigh}
        </button>
        <button
          type="button"
          onClick={() => setImportance(IMPORTANCE_HIGH)}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors ${
            importance === IMPORTANCE_HIGH
              ? 'border border-amber-500/30 bg-amber-500/20 font-bold text-amber-600 shadow-sm dark:text-amber-400'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Zap className="h-3 w-3 text-amber-500" />
          {labels.highImpactOnly}
        </button>
      </div>

      {/* Region Presets */}
      <div className="bg-muted/40 flex items-center rounded-lg border border-border p-1 text-xs">
        {REGION_KEYS.map((key) => (
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
            {labels.regions[key]}
          </button>
        ))}
      </div>
    </div>
  );
}

export function EconNewsCalendar(): React.ReactElement {
  const { importance, region } = useEconNewsFilter();
  const { language } = useLocale();
  const tvLocale = useMemo(
    () => resolveTradingViewLocale(language),
    [language]
  );

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-xl shadow-black/5 md:p-6">
      <EconomicCalendarWidget
        height={750}
        width="100%"
        importanceFilter={importance}
        countryFilter={REGION_PRESETS[region].filter}
        locale={tvLocale}
      />
    </div>
  );
}
