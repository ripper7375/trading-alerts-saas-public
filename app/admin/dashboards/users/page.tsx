import { HistoricalTrendChart } from '@/components/admin/analytics/historical-trend-chart';
import { KpiSummaryCard } from '@/components/admin/analytics/kpi-summary-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getUsersAnalytics } from '@/lib/admin/analytics/users';
import { getServerLanguage } from '@/lib/i18n/server-locale';
import { getDictionary } from '@/lib/i18n/get-dictionary';

export const metadata = { title: 'User Base & Funnel | DavinTrade Admin' };

/**
 * BI Dashboard 2 -- Customer Base, Conversion Funnel & 6-Month Historical
 * Trajectory. Metrics #1-#7, #12.
 */
export default async function UsersPage(): Promise<React.ReactElement> {
  const data = await getUsersAnalytics();
  const dict = getDictionary(await getServerLanguage());

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-foreground">
          {dict['analytics.tab.users'] ?? 'Customer Funnel & 6M Trajectory'}
        </h2>
        <p className="text-xs text-muted-foreground">Metrics #1-#7, #12</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiSummaryCard
          label={dict['analytics.total_users'] ?? 'Total Users'}
          metricBadge="Metric #1 & #2"
          value={data.summary.totalUsers.toLocaleString()}
          deltaPct={data.summary.momGrowth.totalUsersPct}
          deltaLabel="MoM"
        />
        <KpiSummaryCard
          label={dict['analytics.free_tier_users'] ?? 'FREE Tier Users'}
          metricBadge="Metric #3 & #4"
          value={data.summary.freeUsers.toLocaleString()}
          deltaPct={data.summary.momGrowth.freeUsersPct}
          deltaLabel="MoM"
          comparisonSubtext={`${data.summary.freePercentage.toFixed(1)}% ${dict['analytics.of_base'] ?? 'of base'}`}
        />
        <KpiSummaryCard
          label={dict['analytics.pro_paid_users'] ?? 'PRO Paid Users'}
          metricBadge="Metric #5 & #6"
          value={data.summary.proUsers.toLocaleString()}
          deltaPct={data.summary.momGrowth.proUsersPct}
          deltaLabel="MoM"
          comparisonSubtext={`${data.summary.proPercentage.toFixed(1)}% ${dict['analytics.of_base'] ?? 'of base'}`}
          accentClassName="text-primary"
        />
        <KpiSummaryCard
          label={dict['analytics.conversion_churn'] ?? 'Conversion & Churn'}
          metricBadge="#7 & #12"
          value={`${data.summary.conversionRate}% / ${data.summary.trueChurnRate}%`}
          deltaPct={null}
          comparisonSubtext={
            dict['analytics.conversion_true_churn'] ?? 'Conversion / True Churn'
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="border-border bg-card lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-extrabold">
              {dict['analytics.historical_trajectory_title'] ??
                '6-Month Historical Trajectory: Conversion Rate vs True Churn Rate'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <HistoricalTrendChart data={data.historicalTrajectory} />
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-sm font-extrabold">
              {dict['analytics.funnel_pipeline'] ??
                'Conversion Funnel Pipeline'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 font-mono text-xs">
            <div className="bg-muted/30 rounded-xl border border-border p-3">
              <div className="flex justify-between font-bold">
                <span>
                  {dict['analytics.funnel.registered'] ??
                    '1. Registered Signups'}
                </span>
                <span className="text-foreground">
                  {data.funnelCohorts.registeredSignups.toLocaleString()}
                </span>
              </div>
            </div>
            <div className="bg-muted/30 rounded-xl border border-border p-3">
              <div className="flex justify-between font-bold">
                <span>
                  {dict['analytics.funnel.trial_starts'] ??
                    '2. 7-Day Trial Starts (6M)'}
                </span>
                <span className="text-info">
                  {data.funnelCohorts.trialsActivated.toLocaleString()}
                </span>
              </div>
            </div>
            <div className="bg-muted/30 rounded-xl border border-border p-3">
              <div className="flex justify-between font-bold">
                <span>
                  {dict['analytics.funnel.paid_conversions'] ??
                    '3. Paid PRO Conversions (6M)'}
                </span>
                <span className="text-success">
                  {data.funnelCohorts.paidConversions.toLocaleString()}
                </span>
              </div>
            </div>
            <div className="bg-muted/30 rounded-xl border border-border p-3">
              <div className="flex justify-between font-bold">
                <span>
                  {dict['analytics.funnel.retained_60d'] ??
                    '4. Retained After 60 Days'}
                </span>
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
            {dict['analytics.historical_trajectory_table'] ??
              '6-Month Historical Trajectory Table'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 font-mono text-muted-foreground">
                <tr>
                  <th className="px-3 py-2.5">{dict['Month'] ?? 'Month'}</th>
                  <th className="px-3 py-2.5 text-right">
                    {dict['analytics.total_users'] ?? 'Total Users'}
                  </th>
                  <th className="px-3 py-2.5 text-right">
                    {dict['FREE'] ?? 'FREE'}
                  </th>
                  <th className="px-3 py-2.5 text-right">
                    {dict['PRO'] ?? 'PRO'}
                  </th>
                  <th className="px-3 py-2.5 text-right">
                    {dict['analytics.trial_starts'] ?? 'Trial Starts'}
                  </th>
                  <th className="px-3 py-2.5 text-right">
                    {dict['analytics.new_conversions'] ?? 'New Conversions'}
                  </th>
                  <th className="px-3 py-2.5 text-right">
                    {dict['analytics.conversion_pct'] ?? 'Conversion %'}
                  </th>
                  <th className="px-3 py-2.5 text-right">
                    {dict['analytics.pro_at_start'] ?? 'PRO at Start'}
                  </th>
                  <th className="px-3 py-2.5 text-right">
                    {dict['analytics.cancellations'] ?? 'Cancellations'}
                  </th>
                  <th className="px-3 py-2.5 text-right">
                    {dict['analytics.true_churn_pct'] ?? 'True Churn %'}
                  </th>
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
