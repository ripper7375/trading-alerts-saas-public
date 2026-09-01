import { KpiSummaryCard } from '@/components/admin/analytics/kpi-summary-card';
import { TimeframeFilter } from '@/components/admin/analytics/timeframe-filter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  getRevenueAnalytics,
  type RevenueTimeframe,
} from '@/lib/admin/analytics/revenue';
import { getServerLocalePreferences } from '@/lib/i18n/server-locale';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { getCountryByCode, formatCurrencyAmount } from '@/lib/country-config';

export const metadata = { title: 'Revenue & Growth | DavinTrade Admin' };

interface RevenuePageProps {
  searchParams: Promise<{ timeframe?: string }>;
}

/**
 * BI Dashboard 1 -- Sales Growth Performance & Source of Sales Analysis.
 * Metrics #8-#11. Server Component: calls the cached analytics getter
 * directly rather than fetching its own API route.
 */
export default async function RevenuePage({
  searchParams,
}: RevenuePageProps): Promise<React.ReactElement> {
  const params = await searchParams;
  const timeframe = (params.timeframe as RevenueTimeframe) || '6M';
  const data = await getRevenueAnalytics(timeframe);
  const prefs = await getServerLocalePreferences();
  const dict = getDictionary(prefs.language);
  const exchangeRate = getCountryByCode(prefs.countryCode).exchangeRate;
  const usd = (amount: number): string =>
    formatCurrencyAmount(amount, {
      currency: prefs.currency,
      exchangeRate,
      language: prefs.language,
    });
  const newLabel = dict['analytics.new_badge'] ?? 'New';

  const TIMEFRAME_OPTIONS = [
    {
      value: '6M',
      label: dict['analytics.timeframe.6m'] ?? 'Trailing 6 Months (Standard)',
    },
    {
      value: '12M',
      label: dict['analytics.timeframe.12m'] ?? 'Trailing 12 Months',
    },
    { value: 'YTD', label: dict['analytics.timeframe.ytd'] ?? 'Year-To-Date' },
    { value: 'ALL', label: dict['analytics.timeframe.all'] ?? 'All-Time' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground">
            {dict['analytics.tab.revenue'] ?? 'Sales & Revenue Velocity'}
          </h2>
          <p className="text-xs text-muted-foreground">
            {dict['analytics.revenue_subtitle'] ??
              'Merged Stripe + dLocal revenue -- Metrics #8, #9, #10, #11'}
          </p>
        </div>
        <TimeframeFilter current={timeframe} options={TIMEFRAME_OPTIONS} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiSummaryCard
          label={dict['analytics.monthly_sales'] ?? 'Monthly Sales (USD)'}
          metricBadge="Metric #8"
          value={usd(data.summary.currentMonthSales)}
          deltaPct={data.summary.momGrowthPct}
          deltaLabel="MoM"
          comparisonSubtext={
            data.summary.prevMonthSales !== null
              ? `${dict['analytics.vs_prior_month'] ?? 'vs prior month'} ${usd(data.summary.prevMonthSales)}`
              : undefined
          }
        />
        <KpiSummaryCard
          label={dict['analytics.monthly_yoy_growth'] ?? 'Monthly YoY Growth'}
          metricBadge="Metric #10"
          value={
            data.summary.monthlyYoYGrowthPct !== null
              ? `${data.summary.monthlyYoYGrowthPct >= 0 ? '+' : ''}${data.summary.monthlyYoYGrowthPct.toFixed(1)}%`
              : newLabel
          }
          deltaPct={null}
          comparisonSubtext={
            dict['analytics.vs_same_month_prior_year'] ??
            'vs same month prior year'
          }
          accentClassName={
            data.summary.monthlyYoYGrowthPct !== null &&
            data.summary.monthlyYoYGrowthPct >= 0
              ? 'text-success'
              : 'text-destructive'
          }
        />
        <KpiSummaryCard
          label={dict['analytics.quarterly_sales'] ?? 'Quarterly Sales (USD)'}
          metricBadge="Metric #9"
          value={usd(data.summary.currentQuarterSales)}
          deltaPct={data.summary.qoqGrowthPct}
          deltaLabel="QoQ"
          comparisonSubtext={
            data.summary.prevQuarterSales !== null
              ? `${dict['analytics.vs_prior_quarter'] ?? 'vs prior quarter'} ${usd(data.summary.prevQuarterSales)}`
              : undefined
          }
        />
        <KpiSummaryCard
          label={
            dict['analytics.quarterly_yoy_growth'] ?? 'Quarterly YoY Growth'
          }
          metricBadge="Metric #11"
          value={
            data.summary.quarterlyYoYGrowthPct !== null
              ? `${data.summary.quarterlyYoYGrowthPct >= 0 ? '+' : ''}${data.summary.quarterlyYoYGrowthPct.toFixed(1)}%`
              : newLabel
          }
          deltaPct={null}
          comparisonSubtext={
            dict['analytics.vs_same_quarter_prior_year'] ??
            'vs same quarter prior year'
          }
          accentClassName={
            data.summary.quarterlyYoYGrowthPct !== null &&
            data.summary.quarterlyYoYGrowthPct >= 0
              ? 'text-success'
              : 'text-destructive'
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="border-border bg-card lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-extrabold">
              {dict['analytics.mrr_arr_run_rate'] ?? 'MRR / ARR Run-Rate'}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-4 font-mono">
            <div>
              <div className="text-xs text-muted-foreground">MRR</div>
              <div className="text-xl font-bold text-foreground">
                {usd(data.summary.mrr)}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">ARR</div>
              <div className="text-xl font-bold text-foreground">
                {usd(data.summary.arr)}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">ARPPU</div>
              <div className="text-xl font-bold text-foreground">
                {usd(data.summary.arppu)}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-sm font-extrabold">
            {dict['analytics.trailing_monthly_breakdown'] ??
              'Trailing Monthly Breakdown'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 font-mono text-muted-foreground">
                <tr>
                  <th className="px-3 py-2.5">{dict['Month'] ?? 'Month'}</th>
                  <th className="px-3 py-2.5 text-right">
                    {dict['analytics.revenue_usd'] ?? 'Revenue (USD)'}
                  </th>
                  <th className="px-3 py-2.5 text-right">
                    {dict['Prior Month'] ?? 'Prior Month'}
                  </th>
                  <th className="px-3 py-2.5 text-right">MoM %</th>
                  <th className="px-3 py-2.5 text-right">
                    {dict['Prior Year'] ?? 'Prior Year'}
                  </th>
                  <th className="px-3 py-2.5 text-right">YoY %</th>
                  <th className="px-3 py-2.5 text-right">
                    {dict['Transactions'] ?? 'Transactions'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border font-mono">
                {data.monthlyTrailing.map((row) => (
                  <tr key={row.month} className="hover:bg-accent/40">
                    <td className="px-3 py-2 font-sans font-semibold text-foreground">
                      {row.monthLabel}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {usd(row.revenueUsd)}
                    </td>
                    <td className="px-3 py-2 text-right text-muted-foreground">
                      {row.prevMonthUsd !== null ? usd(row.prevMonthUsd) : '-'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {row.momGrowthPct !== null
                        ? `${row.momGrowthPct.toFixed(1)}%`
                        : newLabel}
                    </td>
                    <td className="px-3 py-2 text-right text-muted-foreground">
                      {row.prevYearUsd !== null ? usd(row.prevYearUsd) : '-'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {row.yoyGrowthPct !== null
                        ? `${row.yoyGrowthPct.toFixed(1)}%`
                        : newLabel}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {row.transactionCount}
                    </td>
                  </tr>
                ))}
                {data.monthlyTrailing.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-3 py-8 text-center font-sans text-muted-foreground"
                    >
                      {dict['analytics.no_revenue_yet'] ??
                        'No revenue recorded yet.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
