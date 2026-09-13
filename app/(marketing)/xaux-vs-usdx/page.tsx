'use client';

import { useState } from 'react';
import { LineChart } from 'lucide-react';

import { useLocale } from '@/lib/context/locale-context';
import { CURRENCY_GOLD_INDEX_METADATA } from '@/lib/currency-gold-indices/metadata';
import { useCurrencyGoldIndexHistory } from '@/components/market/useCurrencyIndexHistory';
import { XauxUsdxComparisonChart } from '@/components/market/xaux-usdx-comparison-chart';
import type { ComparisonTimeframe } from '@/lib/currency-gold-indices/history';
import { Badge } from '@/components/ui/badge';

const TIMEFRAMES: ComparisonTimeframe[] = ['M5', 'M15'];

/**
 * Public "XAUX vs USDX Comparison chart" page, linked from the landing-page
 * Hero widget. Both free and PRO users (and anonymous visitors) can reach
 * this page -- it sits under the (marketing) route group, which
 * middleware.ts's PROTECTED_PREFIXES never covers, same as /econ-news and
 * /academy.
 */
export default function XauxVsUsdxComparisonPage(): React.JSX.Element {
  const { t } = useLocale();
  const [timeframe, setTimeframe] = useState<ComparisonTimeframe>('M15');
  const { series, isLoading } = useCurrencyGoldIndexHistory(timeframe);

  const hasData = series.some((s) => s.bars.length > 0);
  const xauxMeta = CURRENCY_GOLD_INDEX_METADATA['XAUX'];
  const usdxMeta = CURRENCY_GOLD_INDEX_METADATA['USDX'];

  return (
    <div className="container mx-auto space-y-8 px-4 py-8 md:px-6 md:py-12">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl space-y-2">
          <div className="flex items-center gap-2">
            <Badge className="border-amber-500/40 bg-amber-500/15 font-semibold text-amber-600 dark:text-amber-400">
              <LineChart className="mr-1 h-3.5 w-3.5" />
              {t('Currency & Gold Index Suite')}
            </Badge>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            {t('XAUX vs USDX Comparison Chart')}
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t(
              'Compare the Gold Index (XAUX) against the US Dollar Index (USDX) over up to 3,000 bars, on the M5 or M15 timeframe.'
            )}
          </p>
        </div>

        {/* M5/M15 Toggle */}
        <div className="bg-muted/40 flex items-center rounded-lg border border-border p-1 text-xs">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              type="button"
              onClick={() => setTimeframe(tf)}
              className={`rounded-md px-4 py-1.5 font-semibold transition-colors ${
                timeframe === tf
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-xl shadow-black/5 md:p-6">
        {!isLoading && !hasData ? (
          <div className="flex h-[480px] items-center justify-center text-sm text-muted-foreground">
            {t('No data available yet.')}
          </div>
        ) : (
          <XauxUsdxComparisonChart series={series} />
        )}
      </div>

      {/* Legend / Definitions */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {xauxMeta && (
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="flex items-center gap-2 font-semibold text-foreground">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-amber-500" />
              {t(xauxMeta.name)} (XAUX)
            </p>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {t(xauxMeta.definition)}
            </p>
          </div>
        )}
        {usdxMeta && (
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="flex items-center gap-2 font-semibold text-foreground">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-blue-500" />
              {t(usdxMeta.name)} (USDX)
            </p>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {t(usdxMeta.definition)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
