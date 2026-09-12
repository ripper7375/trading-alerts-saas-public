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

import { useEffect, useRef, useState } from 'react';
import { Settings } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { CurrencyCode } from '@/lib/currency-index-pro/pairs';

import { RelativeStrengthChart } from './chart/relative-strength-chart';
import { ChartControlHeader } from './chart/chart-control-header';
import { CurrencyLegendStrip } from './chart/currency-legend-strip';
import { HrmaSmmaDetailModal } from './chart/hrma-smma-detail-modal';
import { PairChartModal } from './chart/pair-chart-modal';
import { IndicatorSettingsModal } from './chart/indicator-settings-modal';
import { TradingAdvisoryBanner } from './tables/trading-advisory-banner';
import { Top5ScreenerCard } from './tables/top5-screener-card';
import { DashboardTableM5 } from './tables/dashboard-table-m5';
import { AnalysisTableM15 } from './tables/analysis-table-m15';
import { useCurrencyIndexChart } from './hooks/use-currency-index-chart';
import { useCurrencyIndexScreener } from './hooks/use-currency-index-screener';
import { useCurrencyIndexPreferences } from './hooks/use-currency-index-preferences';

export function ProCurrencyIndexCockpit(): React.JSX.Element {
  const [timeframe, setTimeframeState] = useState<'M5' | 'M15'>('M15');
  const [detailCurrency, setDetailCurrency] = useState<CurrencyCode | null>(
    null
  );
  const [detailOpen, setDetailOpen] = useState(false);
  const [chartPair, setChartPair] = useState<string | null>(null);
  const [pairChartOpen, setPairChartOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const chartData = useCurrencyIndexChart(timeframe);
  const screenerData = useCurrencyIndexScreener();
  const { preferences, setPreferences } = useCurrencyIndexPreferences();

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
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Currency Index PRO</h1>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setSettingsOpen(true)}
        >
          <Settings className="h-3.5 w-3.5" />
          Settings
        </Button>
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
      />

      <CurrencyLegendStrip
        data={chartData}
        onSelectCurrency={handleSelectCurrency}
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

      <HrmaSmmaDetailModal
        open={detailOpen}
        currency={detailCurrency}
        onOpenChange={setDetailOpen}
      />
      <PairChartModal
        open={pairChartOpen}
        pair={chartPair}
        onOpenChange={setPairChartOpen}
      />
      <IndicatorSettingsModal
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        preferences={preferences}
        onChange={setPreferences}
      />
    </div>
  );
}
