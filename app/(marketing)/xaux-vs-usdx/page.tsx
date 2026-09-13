'use client';

import { useMemo, useState } from 'react';
import { LineChart } from 'lucide-react';

import { useLocale } from '@/lib/context/locale-context';
import { CURRENCY_GOLD_INDEX_METADATA } from '@/lib/currency-gold-indices/metadata';
import { useCurrencyGoldIndexHistory } from '@/components/market/useCurrencyIndexHistory';
import { CurrencyIndexProUpgradeCard } from '@/components/market/currency-index-pro-upgrade-card';
import {
  REBASE_DEFAULT,
  REBASE_MAX,
  REBASE_MIN,
  XauxUsdxComparisonChart,
} from '@/components/market/xaux-usdx-comparison-chart';
import type { ComparisonTimeframe } from '@/lib/currency-gold-indices/history';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';

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

  // Both indices are rebased to exactly 100.00 at their own inception by
  // construction (Lane 4's own schema) -- overlaid, their lines start from
  // the same point and can sit close together. These sliders shift each
  // series' DISPLAYED values by a constant amount so the two visually
  // separate; nothing here reaches the API or the database (see
  // XauxUsdxComparisonChart's own `rebase` prop doc comment).
  const [xauxBase, setXauxBase] = useState(REBASE_DEFAULT);
  const [usdxBase, setUsdxBase] = useState(REBASE_DEFAULT);
  const isRebased = xauxBase !== REBASE_DEFAULT || usdxBase !== REBASE_DEFAULT;
  const rebase = useMemo(
    () => ({ XAUX: xauxBase, USDX: usdxBase }),
    [xauxBase, usdxBase]
  );

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

        <div className="flex flex-col items-stretch gap-4 md:items-end">
          {/* Entry point to the PRO comparison page. */}
          <CurrencyIndexProUpgradeCard />

          {/* M5/M15 Toggle */}
          <div className="bg-muted/40 flex items-center self-end rounded-lg border border-border p-1 text-xs">
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
      </div>

      {/* Rebase controls */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-xl shadow-black/5 md:p-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-foreground">
            {t('Rebase for display')}
          </p>
          <button
            type="button"
            disabled={!isRebased}
            onClick={() => {
              setXauxBase(REBASE_DEFAULT);
              setUsdxBase(REBASE_DEFAULT);
            }}
            className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            {t('Reset')}
          </button>
        </div>
        <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
          {t(
            'Both indices start from the same value (100), so their lines can sit close together. Rebasing spreads them apart visually for easier reading -- it does not change the real XAUX/USDX values.'
          )}
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-medium text-muted-foreground">
                <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" />
                {t('XAUX base')}
              </span>
              <span className="font-mono tabular-nums text-foreground">
                {xauxBase}
              </span>
            </div>
            <Slider
              value={[xauxBase]}
              min={REBASE_MIN}
              max={REBASE_MAX}
              step={1}
              onValueChange={(v) => setXauxBase(v[0] ?? xauxBase)}
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-medium text-muted-foreground">
                <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                {t('USDX base')}
              </span>
              <span className="font-mono tabular-nums text-foreground">
                {usdxBase}
              </span>
            </div>
            <Slider
              value={[usdxBase]}
              min={REBASE_MIN}
              max={REBASE_MAX}
              step={1}
              onValueChange={(v) => setUsdxBase(v[0] ?? usdxBase)}
            />
          </div>
        </div>
      </div>

      {/* Chart -- always mounted, even with no price data yet, so the
          drawing tools stay usable regardless of Lane 4's VPS deployment
          status (drawing doesn't need price data at all). The "no data"
          message floats ON TOP as a non-blocking hint instead of replacing
          the chart entirely, matching trading-chart.tsx's own established
          "overlay a status message over an already-mounted chart" pattern.
          Needs an EXPLICIT z-index (matching the drawing toolbar's own
          z-10): confirmed live that a plain z-index:auto sibling does not
          reliably paint above the chart's <canvas> layers in this stacking
          setup, the same reason the toolbar itself already carries z-10. */}
      <div className="relative rounded-2xl border border-border bg-card p-4 shadow-xl shadow-black/5 md:p-6">
        <XauxUsdxComparisonChart series={series} rebase={rebase} />
        {!isLoading && !hasData && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            <p className="rounded-md border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 text-sm font-semibold text-amber-600 shadow-md dark:text-amber-400">
              {t('No data available yet.')}
            </p>
          </div>
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
