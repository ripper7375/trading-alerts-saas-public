import { LineChart } from 'lucide-react';

import { CURRENCY_GOLD_INDEX_METADATA } from '@/lib/currency-gold-indices/metadata';
import { CurrencyIndexProUpgradeCard } from '@/components/market/currency-index-pro-upgrade-card';
import {
  XauxUsdxChartCard,
  XauxUsdxRebasePanel,
  XauxUsdxTimeframeToggle,
  XauxUsdxWorkspace,
} from '@/components/market/xaux-usdx-workspace';
import { Badge } from '@/components/ui/badge';
import { getServerTranslator } from '@/lib/i18n/server-translator';

/**
 * Public "XAUX vs USDX Comparison chart" page, linked from the landing-page
 * Hero widget. Both free and PRO users (and anonymous visitors) can reach
 * this page -- it sits under the (marketing) route group, which
 * middleware.ts's PROTECTED_PREFIXES never covers, same as /econ-news and
 * /academy.
 *
 * A Server Component: the heading and the index definitions are rendered on
 * the server. The M5/M15 toggle, the rebase sliders and the chart share state
 * (and the history fetch) in `XauxUsdxWorkspace`.
 */
export default async function XauxVsUsdxComparisonPage() {
  const t = await getServerTranslator();

  const xauxMeta = CURRENCY_GOLD_INDEX_METADATA['XAUX'];
  const usdxMeta = CURRENCY_GOLD_INDEX_METADATA['USDX'];

  return (
    <XauxUsdxWorkspace>
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
            <XauxUsdxTimeframeToggle />
          </div>
        </div>

        {/* Rebase controls */}
        <XauxUsdxRebasePanel
          labels={{
            title: t('Rebase for display'),
            reset: t('Reset'),
            description: t(
              'Both indices start from the same value (100), so their lines can sit close together. Rebasing spreads them apart visually for easier reading -- it does not change the real XAUX/USDX values.'
            ),
            xauxBase: t('XAUX base'),
            usdxBase: t('USDX base'),
          }}
        />

        {/* Chart */}
        <XauxUsdxChartCard noDataLabel={t('No data available yet.')} />

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
    </XauxUsdxWorkspace>
  );
}
