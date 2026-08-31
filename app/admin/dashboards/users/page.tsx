import { HistoricalTrendChart } from '@/components/admin/analytics/historical-trend-chart';
import { KpiSummaryCard } from '@/components/admin/analytics/kpi-summary-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getUsersAnalytics } from '@/lib/admin/analytics/users';

export const metadata = { title: 'User Base & Funnel | DavinTrade Admin' };

/**
 * BI Dashboard 2 -- Customer Base, Conversion Funnel & 6-Month Historical
 * Trajectory. Metrics #1-#7, #12.
 */
export default async function UsersPage(): Promise<React.ReactElement> {
  const data = await getUsersAnalytics();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-foreground">
          Customer Funnel &amp; 6M Trajectory
        </h2>
        <p className="text-xs text-muted-foreground">Metrics #1-#7, #12</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiSummaryCard
          label="Total Users"
          metricBadge="Metric #1 & #2"
          value={data.summary.totalUsers.toLocaleString()}
          deltaPct={data.summary.momGrowth.totalUsersPct}
          deltaLabel="MoM"
        />
        <KpiSummaryCard
          label="FREE Tier Users"
          metricBadge="Metric #3 & #4"
          value={data.summary.freeUsers.toLocaleString()}
          deltaPct={data.summary.momGrowth.freeUsersPct}
          deltaLabel="MoM"
          comparisonSubtext={`${data.summary.freePercentage.toFixed(1)}% of base`}
        />
        <KpiSummaryCard
          label="PRO Paid Users"
          metricBadge="Metric #5 & #6"
          value={data.summary.proUsers.toLocaleString()}
          deltaPct={data.summary.momGrowth.proUsersPct}
          deltaLabel="MoM"
          comparisonSubtext={`${data.summary.proPercentage.toFixed(1)}% of base`}
          accentClassName="text-primary"
        />
        <KpiSummaryCard
          label="Conversion &amp; Churn"
          metricBadge="#7 & #12"
          value={`${data.summary.conversionRate}% / ${data.summary.trueChurnRate}%`}
          deltaPct={null}
          comparisonSubtext="Conversion / True Churn"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="border-border bg-card lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-extrabold">
              6-Month Historical Trajectory: Conversion Rate vs True Churn Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <HistoricalTrendChart data={data.historicalTrajectory} />
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-sm font-extrabold">
              Conversion Funnel Pipeline
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 font-mono text-xs">
            <div className="bg-muted/30 rounded-xl border border-border p-3">
              <div className="flex justify-between font-bold">
                <span>1. Registered Signups</span>
                <span className="text-foreground">
                  {data.funnelCohorts.registeredSignups.toLocaleString()}
                </span>
              </div>
            </div>
            <div className="bg-muted/30 rounded-xl border border-border p-3">
              <div className="flex justify-between font-bold">
                <span>2. 7-Day Trial Starts (6M)</span>
                <span className="text-info">
                  {data.funnelCohorts.trialsActivated.toLocaleString()}
                </span>
              </div>
            </div>
            <div className="bg-muted/30 rounded-xl border border-border p-3">
              <div className="flex justify-between font-bold">
                <span>3. Paid PRO Conversions (6M)</span>
                <span className="text-success">
                  {data.funnelCohorts.paidConversions.toLocaleString()}
                </span>
              </div>
            </div>
            <div className="bg-muted/30 rounded-xl border border-border p-3">
              <div className="flex justify-between font-bold">
                <span>4. Retained After 60 Days</span>
                <span className="text-primary">
                  {data.funnelCohorts.retainedAfter60Days.toLocaleString()}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-sm font-extrabold">
            6-Month Historical Trajectory Table
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 font-mono text-muted-foreground">
                <tr>
                  <th className="px-3 py-2.5">Month</th>
                  <th className="px-3 py-2.5 text-right">Total Users</th>
                  <th className="px-3 py-2.5 text-right">FREE</th>
                  <th className="px-3 py-2.5 text-right">PRO</th>
                  <th className="px-3 py-2.5 text-right">Trial Starts</th>
                  <th className="px-3 py-2.5 text-right">New Conversions</th>
                  <th className="px-3 py-2.5 text-right">Conversion %</th>
                  <th className="px-3 py-2.5 text-right">PRO at Start</th>
                  <th className="px-3 py-2.5 text-right">Cancellations</th>
                  <th className="px-3 py-2.5 text-right">True Churn %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border font-mono">
                {data.historicalTrajectory.map((row) => (
                  <tr key={row.month} className="hover:bg-accent/40">
                    <td className="px-3 py-2 font-sans font-semibold text-foreground">
                      {row.monthLabel}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {row.totalUsersAtEnd.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {row.freeUsers.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right text-primary">
                      {row.proUsers.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right">{row.trialStarts}</td>
                    <td className="px-3 py-2 text-right">
                      {row.newConversions}
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-success">
                      {row.conversionRatePct.toFixed(2)}%
                    </td>
                    <td className="px-3 py-2 text-right">
                      {row.activeStartSubs.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right">{row.churnedSubs}</td>
                    <td className="px-3 py-2 text-right font-bold text-warning">
                      {row.trueChurnRatePct.toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
