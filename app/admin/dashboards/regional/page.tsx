import { DonutMarketShare } from '@/components/admin/analytics/donut-market-share';
import { KpiSummaryCard } from '@/components/admin/analytics/kpi-summary-card';
import { RankedCountryTable } from '@/components/admin/analytics/ranked-country-table';
import { TaxThresholdGauge } from '@/components/admin/analytics/tax-threshold-gauge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { OTHERS_ISO } from '@/lib/admin/analytics/jurisdictions';
import { getRegionalAnalytics } from '@/lib/admin/analytics/regional';

export const metadata = {
  title: 'Regional & Tax Surveillance | DavinTrade Admin',
};

/**
 * BI Dashboard 3 -- Regional Markets & Multi-Jurisdiction Tax
 * Surveillance. Metrics #13-#19. Country resolution falls back through
 * Invoice.taxCountry -> UserSession.country (the latter is currently
 * unpopulated by any live code path, so FREE-tier-only rankings will
 * mostly show "Other Countries" until that's fixed elsewhere -- see the
 * doc comment on lib/admin/analytics/regional.ts).
 */
export default async function RegionalPage(): Promise<React.ReactElement> {
  const data = await getRegionalAnalytics();

  const realRankings = data.countryRankings.filter(
    (r) => r.isoCode !== OTHERS_ISO
  );
  const topRevenue = [...realRankings].sort(
    (a, b) => b.trailing12mSalesUsd - a.trailing12mSalesUsd
  )[0];
  const topUsers = [...realRankings].sort(
    (a, b) => b.totalUsers - a.totalUsers
  )[0];
  const topPro = [...realRankings].sort((a, b) => b.proUsers - a.proUsers)[0];
  const activeAlerts = data.taxSurveillance.filter(
    (t) =>
      t.alertLevel === 'LEVEL_1_WARN' ||
      t.alertLevel === 'LEVEL_2_ACTION' ||
      t.alertLevel === 'LEVEL_3_CRITICAL'
  );
  const topAlert = [...activeAlerts].sort(
    (a, b) => (b.utilizationPct ?? 0) - (a.utilizationPct ?? 0)
  )[0];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-foreground">
          Regional &amp; Tax Surveillance
        </h2>
        <p className="text-xs text-muted-foreground">
          Metrics #13-#19 -- 17 Whitelisted Jurisdictions + Other Countries
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiSummaryCard
          label="Top Revenue Jurisdiction"
          metricBadge="Metric #16"
          value={
            topRevenue
              ? `${topRevenue.countryName} (${topRevenue.isoCode})`
              : 'No data yet'
          }
          deltaPct={null}
          comparisonSubtext={
            topRevenue
              ? `$${topRevenue.trailing12mSalesUsd.toLocaleString()} / ${topRevenue.salesSharePct.toFixed(1)}%`
              : undefined
          }
        />
        <KpiSummaryCard
          label="Top User Base Market"
          metricBadge="Metric #13 & #18"
          value={
            topUsers
              ? `${topUsers.countryName} (${topUsers.isoCode})`
              : 'No data yet'
          }
          deltaPct={null}
          comparisonSubtext={
            topUsers
              ? `${topUsers.totalUsers.toLocaleString()} users / ${topUsers.allUsersSharePct.toFixed(1)}%`
              : undefined
          }
        />
        <KpiSummaryCard
          label="Top Paid PRO Market"
          metricBadge="Metric #15 & #19"
          value={
            topPro ? `${topPro.countryName} (${topPro.isoCode})` : 'No data yet'
          }
          deltaPct={null}
          comparisonSubtext={
            topPro
              ? `${topPro.proUsers.toLocaleString()} PRO / ${topPro.proUsersSharePct.toFixed(1)}%`
              : undefined
          }
          accentClassName="text-primary"
        />
        <KpiSummaryCard
          label="Active Tax Warning"
          metricBadge="Metric #17"
          value={
            topAlert
              ? `${topAlert.alertLevel.replace(/_/g, ' ')}`
              : 'No active alerts'
          }
          deltaPct={null}
          comparisonSubtext={
            topAlert
              ? `${topAlert.countryName}: ${(topAlert.utilizationPct ?? 0).toFixed(1)}%`
              : undefined
          }
          accentClassName={topAlert ? 'text-warning' : 'text-success'}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-sm font-extrabold">
              All Users Geographic Distribution (#18)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DonutMarketShare
              data={data.donutMarketShare.allUsers}
              centerLabel="Total Users"
              centerValue={realRankings
                .reduce((s, r) => s + r.totalUsers, 0)
                .toLocaleString()}
            />
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-sm font-extrabold">
              PRO Paid Subscribers Distribution (#19)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DonutMarketShare
              data={data.donutMarketShare.proUsers}
              centerLabel="PRO Users"
              centerValue={realRankings
                .reduce((s, r) => s + r.proUsers, 0)
                .toLocaleString()}
            />
          </CardContent>
        </Card>
      </div>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-sm font-extrabold">
            Master Country Rankings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RankedCountryTable rows={data.countryRankings} />
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-sm font-extrabold">
            Metric #17: VAT &amp; Sales Tax Threshold Surveillance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.taxSurveillance.map((t) => (
            <TaxThresholdGauge
              key={t.isoCode}
              countryName={`${t.countryName} (${t.isoCode})`}
              utilizationPct={t.utilizationPct}
              alertLevel={t.alertLevel}
              approxLocalSales={t.approxLocalSales}
              statutoryThreshold={t.statutoryThreshold}
              statutoryThresholdCurrency={t.statutoryThresholdCurrency}
            />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
