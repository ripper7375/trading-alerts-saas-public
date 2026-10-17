'use client';

/**
 * ProCurrencyIndexCockpit — the `/pro/currency-index` page container.
 *
 * Owns every piece of cross-component state: the timeframe toggle, the two
 * modals' open/selection state, and the lifted `preferences` (read once via
 * `useCurrencyIndexPreferences`, edited by `IndicatorSettingsModal`, and fed
 * to `RelativeStrengthChart` as a corridor override with zero perceived
 * delay per spec's own "0ms server roundtrip" requirement).
 *
 * @module components/currency-index-pro/pro-currency-index-cockpit
 */

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { LineChart, Settings } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ChartSkeleton } from '@/components/ui/chart-skeleton';
import { useLocale } from '@/lib/context/locale-context';
import { CURRENCY_INDEX_COMPARE_PATH } from '@/lib/currency-index-comparison/series';
import type { CurrencyCode } from '@/lib/currency-index-pro/pairs';

import { ChartControlHeader } from './chart/chart-control-header';
import { CurrencyLegendStrip } from './chart/currency-legend-strip';
import { RELATIVE_STRENGTH_CHART_HEIGHT } from './chart/relative-strength-config';
import { IndicatorSettingsModal } from './chart/indicator-settings-modal';
import { ProPageNav } from './pro-page-nav';
import { TradingAdvisoryBanner } from './tables/trading-advisory-banner';
import { Top5ScreenerCard } from './tables/top5-screener-card';
import { DashboardTableM5 } from './tables/dashboard-table-m5';
import { AnalysisTableM15 } from './tables/analysis-table-m15';
import { useCurrencyIndexChart } from './hooks/use-currency-index-chart';
import { useCurrencyIndexScreener } from './hooks/use-currency-index-screener';
import { useCurrencyIndexPreferences } from './hooks/use-currency-index-preferences';
import { useHiddenCurrencyLines } from './hooks/use-hidden-currency-lines';
import { useMountedOnceOpen } from './hooks/use-mounted-once-open';

// The chart (lightweight-charts) and the two modals a trader opens on request
// are loaded on demand, so the page's first bundle carries neither. The chart
// shows a block of its own height meanwhile, so nothing below it moves.
const RelativeStrengthChart = dynamic(
  () =>
    import('./chart/relative-strength-chart').then(
      (mod) => mod.RelativeStrengthChart
    ),
  {
    ssr: false,
    loading: () => <ChartSkeleton height={RELATIVE_STRENGTH_CHART_HEIGHT} />,
  }
);
const HrmaSmmaDetailModal = dynamic(
  () =>
    import('./chart/hrma-smma-detail-modal').then(
      (mod) => mod.HrmaSmmaDetailModal
    ),
  { ssr: false }
);
const PairChartModal = dynamic(
  () => import('./chart/pair-chart-modal').then((mod) => mod.PairChartModal),
  { ssr: false }
);

export function ProCurrencyIndexCockpit(): React.JSX.Element {
  const { t } = useLocale();
  const [timeframe, setTimeframeState] = useState<'M5' | 'M15'>('M15');
  const [detailCurrency, setDetailCurrency] = useState<CurrencyCode | null>(
    null
  );
  const [detailOpen, setDetailOpen] = useState(false);
  const [chartPair, setChartPair] = useState<string | null>(null);
  const [pairChartOpen, setPairChartOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const detailMounted = useMountedOnceOpen(detailOpen);
  const pairChartMounted = useMountedOnceOpen(pairChartOpen);

  const chartData = useCurrencyIndexChart(timeframe);
  const screenerData = useCurrencyIndexScreener();
  const { preferences, setPreferences } = useCurrencyIndexPreferences();
  const hiddenLines = useHiddenCurrencyLines();

  // Sync the timeframe toggle to the user's saved `preferredTf` exactly
  // once, when preferences first load -- afterward the toggle is the
  // user's own live choice, never silently overridden by a background
  // preferences refresh.
  const syncedTimeframeRef = useRef(false);
  useEffect(() => {
    if (!syncedTimeframeRef.current && preferences.preferredTf) {
      setTimeframeState(preferences.preferredTf);
      syncedTimeframeRef.current = true;
    }
  }, [preferences.preferredTf]);

  const handleTimeframeChange = (tf: 'M5' | 'M15'): void => {
    setTimeframeState(tf);
    setPreferences({ preferredTf: tf });
  };

  const handleSelectCurrency = (currency: CurrencyCode): void => {
    setDetailCurrency(currency);
    setDetailOpen(true);
  };

  const handleViewChart = (pair: string): void => {
    setChartPair(pair);
    setPairChartOpen(true);
  };

  const corridorOverride = preferences.useAutoZones
    ? null
    : {
        strikeZonePct: preferences.customObPct ?? 0.78,
        extremeZonePct: null,
      };

  return (
    <div className="w-full space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">
          {t('currency_index_pro.cockpit.title', 'Currency Index PRO')}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <ProPageNav className="mr-6" />
          <Button asChild variant="outline" size="sm">
            <Link href={CURRENCY_INDEX_COMPARE_PATH}>
              <LineChart className="h-3.5 w-3.5" />
              {t(
                'currency_index_pro.cockpit.compare_indices',
                'Compare indices'
              )}
            </Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings className="h-3.5 w-3.5" />
            {t('currency_index_pro.cockpit.settings', 'Settings')}
          </Button>
        </div>
      </div>

      <TradingAdvisoryBanner />

      <ChartControlHeader
        timeframe={timeframe}
        onTimeframeChange={handleTimeframeChange}
        todaySessionOpen={chartData?.todaySessionOpen ?? null}
        spreadDelta={screenerData?.spreadDelta ?? null}
      />

      <RelativeStrengthChart
        data={chartData}
        corridorOverride={corridorOverride}
        hiddenCurrencies={hiddenLines.hidden}
      />

      <CurrencyLegendStrip
        data={chartData}
        onSelectCurrency={handleSelectCurrency}
        hiddenCurrencies={hiddenLines.hidden}
        onToggleCurrency={hiddenLines.toggle}
        onShowAll={hiddenLines.showAll}
        onHideAll={hiddenLines.hideAll}
      />

      <Top5ScreenerCard
        trades={screenerData?.top5Trades ?? []}
        onViewChart={handleViewChart}
      />

      <div className="grid gap-3 lg:grid-cols-2">
        <DashboardTableM5 rows={screenerData?.dashboardTableM5 ?? []} />
        <AnalysisTableM15
          rows={screenerData?.analysisTableM15 ?? []}
          onSelectCurrency={handleSelectCurrency}
        />
      </div>

      {detailMounted && (
        <HrmaSmmaDetailModal
          open={detailOpen}
          currency={detailCurrency}
          onOpenChange={setDetailOpen}
        />
      )}
      {pairChartMounted && (
        <PairChartModal
          open={pairChartOpen}
          pair={chartPair}
          onOpenChange={setPairChartOpen}
        />
      )}
      <IndicatorSettingsModal
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        preferences={preferences}
        onChange={setPreferences}
      />
    </div>
  );
}
