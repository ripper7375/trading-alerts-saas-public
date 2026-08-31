import { KpiSummaryCard } from '@/components/admin/analytics/kpi-summary-card';
import { TimeframeFilter } from '@/components/admin/analytics/timeframe-filter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  getRevenueAnalytics,
  type RevenueTimeframe,
} from '@/lib/admin/analytics/revenue';

export const metadata = { title: 'Revenue & Growth | DavinTrade Admin' };

const TIMEFRAME_OPTIONS = [
  { value: '6M', label: 'Trailing 6 Months (Standard)' },
  { value: '12M', label: 'Trailing 12 Months' },
  { value: 'YTD', label: 'Year-To-Date' },
  { value: 'ALL', label: 'All-Time' },
];

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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground">
            Sales &amp; Revenue Velocity
          </h2>
          <p className="text-xs text-muted-foreground">
            Merged Stripe + dLocal revenue -- Metrics #8, #9, #10, #11
          </p>
        </div>
        <TimeframeFilter current={timeframe} options={TIMEFRAME_OPTIONS} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiSummaryCard
          label="Monthly Sales (USD)"
          metricBadge="Metric #8"
          value={`$${data.summary.currentMonthSales.toLocaleString()}`}
          deltaPct={data.summary.momGrowthPct}
          deltaLabel="MoM"
          comparisonSubtext={
            data.summary.prevMonthSales !== null
              ? `vs prior month $${data.summary.prevMonthSales.toLocaleString()}`
              : undefined
          }
        />
        <KpiSummaryCard
          label="Monthly YoY Growth"
          metricBadge="Metric #10"
          value={
            data.summary.monthlyYoYGrowthPct !== null
              ? `${data.summary.monthlyYoYGrowthPct >= 0 ? '+' : ''}${data.summary.monthlyYoYGrowthPct.toFixed(1)}%`
              : 'New'
          }
          deltaPct={null}
          comparisonSubtext="vs same month prior year"
          accentClassName={
            data.summary.monthlyYoYGrowthPct !== null &&
            data.summary.monthlyYoYGrowthPct >= 0
              ? 'text-success'
              : 'text-destructive'
          }
        />
        <KpiSummaryCard
          label="Quarterly Sales (USD)"
          metricBadge="Metric #9"
          value={`$${data.summary.currentQuarterSales.toLocaleString()}`}
          deltaPct={data.summary.qoqGrowthPct}
          deltaLabel="QoQ"
          comparisonSubtext={
            data.summary.prevQuarterSales !== null
              ? `vs prior quarter $${data.summary.prevQuarterSales.toLocaleString()}`
              : undefined
          }
        />
        <KpiSummaryCard
          label="Quarterly YoY Growth"
          metricBadge="Metric #11"
          value={
            data.summary.quarterlyYoYGrowthPct !== null
              ? `${data.summary.quarterlyYoYGrowthPct >= 0 ? '+' : ''}${data.summary.quarterlyYoYGrowthPct.toFixed(1)}%`
              : 'New'
          }
          deltaPct={null}
          comparisonSubtext="vs same quarter prior year"
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
              MRR / ARR Run-Rate
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-4 font-mono">
            <div>
              <div className="text-xs text-muted-foreground">MRR</div>
              <div className="text-xl font-bold text-foreground">
                ${data.summary.mrr.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">ARR</div>
              <div className="text-xl font-bold text-foreground">
                ${data.summary.arr.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">ARPPU</div>
              <div className="text-xl font-bold text-foreground">
                ${data.summary.arppu.toFixed(2)}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-sm font-extrabold">
            Trailing Monthly Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 font-mono text-muted-foreground">
                <tr>
                  <th className="px-3 py-2.5">Month</th>
                  <th className="px-3 py-2.5 text-right">Revenue (USD)</th>
                  <th className="px-3 py-2.5 text-right">Prior Month</th>
                  <th className="px-3 py-2.5 text-right">MoM %</th>
                  <th className="px-3 py-2.5 text-right">Prior Year</th>
                  <th className="px-3 py-2.5 text-right">YoY %</th>
                  <th className="px-3 py-2.5 text-right">Transactions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border font-mono">
                {data.monthlyTrailing.map((row) => (
                  <tr key={row.month} className="hover:bg-accent/40">
                    <td className="px-3 py-2 font-sans font-semibold text-foreground">
                      {row.monthLabel}
                    </td>
                    <td className="px-3 py-2 text-right">
                      ${row.revenueUsd.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right text-muted-foreground">
                      {row.prevMonthUsd !== null
                        ? `$${row.prevMonthUsd.toLocaleString()}`
                        : '-'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {row.momGrowthPct !== null
                        ? `${row.momGrowthPct.toFixed(1)}%`
                        : 'New'}
                    </td>
                    <td className="px-3 py-2 text-right text-muted-foreground">
                      {row.prevYearUsd !== null
                        ? `$${row.prevYearUsd.toLocaleString()}`
                        : '-'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {row.yoyGrowthPct !== null
                        ? `${row.yoyGrowthPct.toFixed(1)}%`
                        : 'New'}
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
                      No revenue recorded yet.
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
