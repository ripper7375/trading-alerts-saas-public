import { Flame } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  EconNewsCalendar,
  EconNewsFilters,
  EconNewsToolbar,
} from '@/components/marketing/econ-news-filters';
import {
  REGION_KEYS,
  REGION_PRESETS,
  type RegionKey,
} from '@/components/marketing/econ-news-presets';
import { getServerTranslator } from '@/lib/i18n/server-translator';

export default async function EconNewsPage() {
  const t = await getServerTranslator();

  const regions = Object.fromEntries(
    REGION_KEYS.map((key) => [
      key,
      t(REGION_PRESETS[key].labelKey, REGION_PRESETS[key].label),
    ])
  ) as Record<RegionKey, string>;

  return (
    <EconNewsFilters>
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
          <EconNewsToolbar
            labels={{
              allImpact: t('All Impact'),
              mediumAndHigh: t('Medium & High'),
              highImpactOnly: t('High Impact Only'),
              regions,
            }}
          />
        </div>

        {/* Main Calendar Card */}
        <EconNewsCalendar />

        {/*
          This page is TradingView's own calendar; the /terminal panel is our
          own MT5-sourced calendar. The two vendors do not carry identical
          release data, so they can disagree -- named here so a visitor who
          later sees the terminal banner show a different time/forecast for
          the same event isn't left thinking one of the two is simply wrong.
        */}
        <p className="text-center text-xs text-muted-foreground">
          {t(
            'This calendar is provided by TradingView. The in-app terminal panel uses its own MT5-sourced calendar, which may occasionally show different times or forecasts for the same event.'
          )}
        </p>
      </div>
    </EconNewsFilters>
  );
}
