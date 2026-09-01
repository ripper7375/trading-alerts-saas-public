import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  getExecutiveAnalytics,
  type RagStatus,
} from '@/lib/admin/analytics/executive';
import { getServerLocalePreferences } from '@/lib/i18n/server-locale';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { getCountryByCode, formatCurrencyAmount } from '@/lib/country-config';

export const metadata = {
  title: 'Executive Command Center | DavinTrade Admin',
};

const RAG_DOT: Record<RagStatus, string> = {
  GREEN: '🟢',
  AMBER: '🟡',
  RED: '🔴',
};

const RAG_BADGE_CLASS: Record<RagStatus, string> = {
  GREEN: 'bg-success/15 text-success hover:bg-success/15',
  AMBER: 'bg-warning/15 text-warning hover:bg-warning/15',
  RED: 'bg-destructive/15 text-destructive hover:bg-destructive/15',
};

/**
 * BI Dashboard 5 -- Executive Business Command Center. Unified glass-pane
 * synthesis of all 4 pillars (Revenue, Customer, Regional, Affiliate)
 * plus a cross-functional RAG health-status matrix.
 */
export default async function ExecutivePage(): Promise<React.ReactElement> {
  const data = await getExecutiveAnalytics();
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
  const overallRag: RagStatus = data.healthStatusMatrix.some(
    (r) => r.ragStatus === 'RED'
  )
    ? 'RED'
    : data.healthStatusMatrix.some((r) => r.ragStatus === 'AMBER')
      ? 'AMBER'
      : 'GREEN';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-foreground">
          {dict['analytics.executive_command_center'] ??
            'Executive Business Command Center'}
        </h2>
        <p className="text-xs text-muted-foreground">
          {dict['analytics.executive_subtitle'] ??
            'Cross-functional C-suite synthesis across all 4 pillars'}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-border border-l-primary bg-card">
          <CardContent className="px-5">
            <span className="text-xs font-black uppercase tracking-wider text-primary">
              {dict['analytics.pillar.revenue'] ?? '1. Revenue Run-Rate'}
            </span>
            <div className="mt-1 font-mono text-2xl font-black text-foreground">
              {usd(data.revenuePillar.currentMonthSales)}
              <span className="text-xs font-normal text-muted-foreground">
                {' '}
                /mo
              </span>
            </div>
            <div className="mt-2 space-y-1 font-mono text-xs text-muted-foreground">
              <div>
                ARR:{' '}
                <strong className="text-foreground">
                  {usd(data.revenuePillar.arr)}
                </strong>
              </div>
              <div>
                MoM:{' '}
                <strong className="text-success">
                  {data.revenuePillar.momGrowthPct !== null
                    ? `${data.revenuePillar.momGrowthPct.toFixed(1)}%`
                    : newLabel}
                </strong>
                {' | '}
                YoY:{' '}
                <strong className="text-success">
                  {data.revenuePillar.yoyGrowthPct !== null
                    ? `${data.revenuePillar.yoyGrowthPct.toFixed(1)}%`
                    : newLabel}
                </strong>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-border border-l-info bg-card">
          <CardContent className="px-5">
            <span className="text-xs font-black uppercase tracking-wider text-info">
              {dict['analytics.pillar.customer'] ?? '2. Active Customer Base'}
            </span>
            <div className="mt-1 font-mono text-2xl font-black text-foreground">
              {data.customerPillar.totalUsers.toLocaleString()}
              <span className="text-xs font-normal text-muted-foreground">
                {' '}
                {dict['Users'] ?? 'Users'}
              </span>
            </div>
            <div className="mt-2 space-y-1 font-mono text-xs text-muted-foreground">
              <div>
                PRO:{' '}
                <strong className="text-info">
                  {data.customerPillar.proUsers.toLocaleString()}
                </strong>{' '}
                ({data.customerPillar.conversionRate}%{' '}
                {dict['analytics.conv_abbr'] ?? 'Conv'})
              </div>
              <div>
                {dict['analytics.churn_abbr'] ?? 'Churn'}:{' '}
                <strong className="text-warning">
                  {data.customerPillar.trueChurnRate}%
                </strong>
                {' | '}
                MoM:{' '}
                <strong className="text-success">
                  {data.customerPillar.momGrowthPct !== null
                    ? `${data.customerPillar.momGrowthPct.toFixed(1)}%`
                    : newLabel}
                </strong>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-border border-l-warning bg-card">
          <CardContent className="px-5">
            <span className="text-xs font-black uppercase tracking-wider text-warning">
              {dict['analytics.pillar.regional'] ?? '3. Global Footprint'}
            </span>
            <div className="mt-1 font-mono text-2xl font-black text-foreground">
              {data.regionalPillar.activeTaxAlertsCount}
              <span className="text-xs font-normal text-muted-foreground">
                {' '}
                {dict['analytics.active_alerts'] ?? 'Active Alerts'}
              </span>
            </div>
            <div className="mt-2 space-y-1 font-mono text-xs text-muted-foreground">
              <div>
                {dict['analytics.top_rev_abbr'] ?? 'Top Rev'}:{' '}
                <strong className="text-foreground">
                  {data.regionalPillar.topRevenueCountry}
                </strong>
              </div>
              <div>
                {dict['analytics.top_users_abbr'] ?? 'Top Users'}:{' '}
                <strong className="text-foreground">
                  {data.regionalPillar.topUserCountry}
                </strong>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-border border-l-chart-bullish bg-card">
          <CardContent className="px-5">
            <span className="text-xs font-black uppercase tracking-wider text-chart-bullish">
              {dict['analytics.pillar.affiliate'] ?? '4. Affiliate Network'}
            </span>
            <div className="mt-1 font-mono text-2xl font-black text-foreground">
              {data.affiliatePillar.totalAffiliates.toLocaleString()}
              <span className="text-xs font-normal text-muted-foreground">
                {' '}
                {dict['analytics.partners'] ?? 'Partners'}
              </span>
            </div>
            <div className="mt-2 space-y-1 font-mono text-xs text-muted-foreground">
              <div>
                {dict['Growth'] ?? 'Growth'}:{' '}
                <strong className="text-success">
                  {data.affiliatePillar.momGrowthPct !== null
                    ? `${data.affiliatePillar.momGrowthPct.toFixed(1)}%`
                    : newLabel}
                </strong>
                {' | '}
                {dict['analytics.avg_abbr'] ?? 'Avg'}:{' '}
                <strong className="text-foreground">
                  {usd(data.affiliatePillar.avgCommission)}
                </strong>
              </div>
              <div>
                {dict['analytics.sales_influenced'] ?? 'Sales Influenced'}:{' '}
                <strong className="text-foreground">
                  {usd(data.affiliatePillar.salesInfluencedUsd)}
                </strong>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border bg-card">
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm font-extrabold">
              {dict['analytics.rag_matrix_title'] ??
                'Cross-Functional Performance & Strategic RAG Health Matrix'}
            </CardTitle>
            <Badge className={cn('text-xs', RAG_BADGE_CLASS[overallRag])}>
              {RAG_DOT[overallRag]}{' '}
              {dict['analytics.overall_status'] ?? 'Overall Status:'}{' '}
              {overallRag === 'GREEN'
                ? (dict['analytics.rag.optimal'] ?? 'Optimal')
                : overallRag === 'AMBER'
                  ? (dict['analytics.rag.attention_needed'] ??
                    'Attention Needed')
                  : (dict['analytics.rag.critical'] ?? 'Critical')}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 font-mono text-muted-foreground">
                <tr>
                  <th className="px-3 py-2.5">
                    {dict['analytics.pillar_col'] ?? 'Pillar'}
                  </th>
                  <th className="px-3 py-2.5">
                    {dict['analytics.primary_kpi'] ?? 'Primary KPI'}
                  </th>
                  <th className="px-3 py-2.5 text-right">
                    {dict['Current'] ?? 'Current'}
                  </th>
                  <th className="px-3 py-2.5 text-right">
                    {dict['Prior'] ?? 'Prior'}
                  </th>
                  <th className="px-3 py-2.5 text-right">
                    {dict['analytics.mom_trend'] ?? 'MoM Trend'}
                  </th>
                  <th className="px-3 py-2.5 text-right">
                    {dict['analytics.yoy_benchmark'] ?? 'YoY Benchmark'}
                  </th>
                  <th className="px-3 py-2.5 text-center">RAG</th>
                  <th className="px-3 py-2.5">{dict['Notes'] ?? 'Notes'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border font-mono">
                {data.healthStatusMatrix.map((row) => (
                  <tr
                    key={`${row.pillar}-${row.keyMetric}`}
                    className="hover:bg-accent/40"
                  >
                    <td className="px-3 py-2 font-sans font-bold text-foreground">
                      {row.pillar}
                    </td>
                    <td className="px-3 py-2 font-sans">{row.keyMetric}</td>
                    <td className="px-3 py-2 text-right font-bold">
                      {row.currentValue}
                    </td>
                    <td className="px-3 py-2 text-right text-muted-foreground">
                      {row.priorValue}
                    </td>
                    <td className="px-3 py-2 text-right">{row.momTrend}</td>
                    <td className="px-3 py-2 text-right">{row.yoyBenchmark}</td>
                    <td className="px-3 py-2 text-center">
                      <Badge
                        className={cn(
                          'text-[10px]',
                          RAG_BADGE_CLASS[row.ragStatus]
                        )}
                      >
                        {RAG_DOT[row.ragStatus]} {row.ragStatus}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 font-sans text-muted-foreground">
                      {row.notes}
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
