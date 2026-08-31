import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  getExecutiveAnalytics,
  type RagStatus,
} from '@/lib/admin/analytics/executive';

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
          Executive Business Command Center
        </h2>
        <p className="text-xs text-muted-foreground">
          Cross-functional C-suite synthesis across all 4 pillars
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-border border-l-primary bg-card">
          <CardContent className="px-5">
            <span className="text-xs font-black uppercase tracking-wider text-primary">
              1. Revenue Run-Rate
            </span>
            <div className="mt-1 font-mono text-2xl font-black text-foreground">
              ${data.revenuePillar.currentMonthSales.toLocaleString()}
              <span className="text-xs font-normal text-muted-foreground">
                {' '}
                /mo
              </span>
            </div>
            <div className="mt-2 space-y-1 font-mono text-xs text-muted-foreground">
              <div>
                ARR:{' '}
                <strong className="text-foreground">
                  ${data.revenuePillar.arr.toLocaleString()}
                </strong>
              </div>
              <div>
                MoM:{' '}
                <strong className="text-success">
                  {data.revenuePillar.momGrowthPct !== null
                    ? `${data.revenuePillar.momGrowthPct.toFixed(1)}%`
                    : 'New'}
                </strong>
                {' | '}
                YoY:{' '}
                <strong className="text-success">
                  {data.revenuePillar.yoyGrowthPct !== null
                    ? `${data.revenuePillar.yoyGrowthPct.toFixed(1)}%`
                    : 'New'}
                </strong>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-border border-l-info bg-card">
          <CardContent className="px-5">
            <span className="text-xs font-black uppercase tracking-wider text-info">
              2. Active Customer Base
            </span>
            <div className="mt-1 font-mono text-2xl font-black text-foreground">
              {data.customerPillar.totalUsers.toLocaleString()}
              <span className="text-xs font-normal text-muted-foreground">
                {' '}
                Users
              </span>
            </div>
            <div className="mt-2 space-y-1 font-mono text-xs text-muted-foreground">
              <div>
                PRO:{' '}
                <strong className="text-info">
                  {data.customerPillar.proUsers.toLocaleString()}
                </strong>{' '}
                ({data.customerPillar.conversionRate}% Conv)
              </div>
              <div>
                Churn:{' '}
                <strong className="text-warning">
                  {data.customerPillar.trueChurnRate}%
                </strong>
                {' | '}
                MoM:{' '}
                <strong className="text-success">
                  {data.customerPillar.momGrowthPct !== null
                    ? `${data.customerPillar.momGrowthPct.toFixed(1)}%`
                    : 'New'}
                </strong>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-border border-l-warning bg-card">
          <CardContent className="px-5">
            <span className="text-xs font-black uppercase tracking-wider text-warning">
              3. Global Footprint
            </span>
            <div className="mt-1 font-mono text-2xl font-black text-foreground">
              {data.regionalPillar.activeTaxAlertsCount}
              <span className="text-xs font-normal text-muted-foreground">
                {' '}
                Active Alerts
              </span>
            </div>
            <div className="mt-2 space-y-1 font-mono text-xs text-muted-foreground">
              <div>
                Top Rev:{' '}
                <strong className="text-foreground">
                  {data.regionalPillar.topRevenueCountry}
                </strong>
              </div>
              <div>
                Top Users:{' '}
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
              4. Affiliate Network
            </span>
            <div className="mt-1 font-mono text-2xl font-black text-foreground">
              {data.affiliatePillar.totalAffiliates.toLocaleString()}
              <span className="text-xs font-normal text-muted-foreground">
                {' '}
                Partners
              </span>
            </div>
            <div className="mt-2 space-y-1 font-mono text-xs text-muted-foreground">
              <div>
                Growth:{' '}
                <strong className="text-success">
                  {data.affiliatePillar.momGrowthPct !== null
                    ? `${data.affiliatePillar.momGrowthPct.toFixed(1)}%`
                    : 'New'}
                </strong>
                {' | '}
                Avg:{' '}
                <strong className="text-foreground">
                  ${data.affiliatePillar.avgCommission.toFixed(2)}
                </strong>
              </div>
              <div>
                Sales Influenced:{' '}
                <strong className="text-foreground">
                  ${data.affiliatePillar.salesInfluencedUsd.toLocaleString()}
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
              Cross-Functional Performance &amp; Strategic RAG Health Matrix
            </CardTitle>
            <Badge className={cn('text-xs', RAG_BADGE_CLASS[overallRag])}>
              {RAG_DOT[overallRag]} Overall Status:{' '}
              {overallRag === 'GREEN'
                ? 'Optimal'
                : overallRag === 'AMBER'
                  ? 'Attention Needed'
                  : 'Critical'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 font-mono text-muted-foreground">
                <tr>
                  <th className="px-3 py-2.5">Pillar</th>
                  <th className="px-3 py-2.5">Primary KPI</th>
                  <th className="px-3 py-2.5 text-right">Current</th>
                  <th className="px-3 py-2.5 text-right">Prior</th>
                  <th className="px-3 py-2.5 text-right">MoM Trend</th>
                  <th className="px-3 py-2.5 text-right">YoY Benchmark</th>
                  <th className="px-3 py-2.5 text-center">RAG</th>
                  <th className="px-3 py-2.5">Notes</th>
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
