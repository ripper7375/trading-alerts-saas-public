import { DonutMarketShare } from '@/components/admin/analytics/donut-market-share';
import { KpiSummaryCard } from '@/components/admin/analytics/kpi-summary-card';
import { TimeframeFilter } from '@/components/admin/analytics/timeframe-filter';
import { TopAffiliatesLeaderboard } from '@/components/admin/analytics/top-affiliates-leaderboard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  getAffiliatesAnalytics,
  type AffiliateReportPeriod,
} from '@/lib/admin/analytics/affiliates';

export const metadata = {
  title: 'Affiliate Partner Network | DavinTrade Admin',
};

const PERIOD_OPTIONS = [
  { value: '3months', label: 'Trailing 3 Months' },
  { value: '6months', label: 'Trailing 6 Months' },
  { value: '1year', label: 'Trailing 12 Months' },
];

interface AffiliatesPageProps {
  searchParams: Promise<{ period?: string }>;
}

/**
 * BI Dashboard 4 -- Affiliate Partner Network & Privacy-Preserving
 * Leaderboard. Metrics #20-#25.
 */
export default async function AffiliatesPage({
  searchParams,
}: AffiliatesPageProps): Promise<React.ReactElement> {
  const params = await searchParams;
  const period = (params.period as AffiliateReportPeriod) || '3months';
  const data = await getAffiliatesAnalytics(period);

  const topCountry = [...data.geographicDistribution].sort(
    (a, b) => b.totalAffiliates - a.totalAffiliates
  )[0];
  const donutData = data.geographicDistribution.map((g) => ({
    country: g.countryName,
    iso: g.isoCode,
    count: g.totalAffiliates,
    percentage: g.sharePct,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground">
            Affiliate Partner Network
          </h2>
          <p className="text-xs text-muted-foreground">
            Metrics #20-#25 -- Privacy-Preserving Top 20 Leaderboard
          </p>
        </div>
        <TimeframeFilter
          paramName="period"
          current={period}
          options={PERIOD_OPTIONS}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiSummaryCard
          label="Total Active Affiliates"
          metricBadge="Metric #20 & #21"
          value={`${data.summary.totalAffiliates.toLocaleString()} Partners`}
          deltaPct={data.summary.momGrowthPct}
          deltaLabel="MoM"
        />
        <KpiSummaryCard
          label="Partner Tier Ratio"
          metricBadge="Metric #23"
          value={data.summary.tierRatio}
          deltaPct={null}
          comparisonSubtext={`${data.summary.freePercentage.toFixed(1)}% Free : ${data.summary.proPercentage.toFixed(1)}% PRO`}
        />
        <KpiSummaryCard
          label="Avg Monthly Commission"
          metricBadge="Metric #24"
          value={`$${data.summary.avgMonthlyCommission.toFixed(2)}`}
          deltaPct={null}
          comparisonSubtext="Per active earning affiliate"
          accentClassName="text-success"
        />
        <KpiSummaryCard
          label="Top Partner Country"
          metricBadge="Metric #22"
          value={
            topCountry
              ? `${topCountry.countryName} (${topCountry.isoCode})`
              : 'No data yet'
          }
          deltaPct={null}
          comparisonSubtext={
            topCountry
              ? `${topCountry.totalAffiliates} partners / ${topCountry.sharePct.toFixed(1)}%`
              : undefined
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-sm font-extrabold">
              Geographic Distribution (#22)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DonutMarketShare
              data={donutData}
              centerLabel="Partners"
              centerValue={data.summary.totalAffiliates.toLocaleString()}
            />
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-sm font-extrabold">
              Tier Composition (#23)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary"
                style={{ width: `${data.summary.proPercentage}%` }}
              />
            </div>
            <div className="flex justify-between font-mono text-xs text-muted-foreground">
              <span>
                FREE: {data.summary.affiliateFreeCount.toLocaleString()} (
                {data.summary.freePercentage.toFixed(1)}%)
              </span>
              <span className="text-primary">
                PRO: {data.summary.affiliateProCount.toLocaleString()} (
                {data.summary.proPercentage.toFixed(1)}%)
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-sm font-extrabold">
            Metric #25: Privacy-Preserving Top 20 Affiliates Leaderboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-xs text-muted-foreground">
            All names, emails, and personal contact information are strictly
            redacted (GDPR / PDPA compliant).
          </p>
          <TopAffiliatesLeaderboard rows={data.top20Leaderboard} />
        </CardContent>
      </Card>
    </div>
  );
}
