import { DonutMarketShare } from '@/components/admin/analytics/donut-market-share';
import { KpiSummaryCard } from '@/components/admin/analytics/kpi-summary-card';
import { RankedCountryTable } from '@/components/admin/analytics/ranked-country-table';
import { TaxThresholdGauge } from '@/components/admin/analytics/tax-threshold-gauge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { OTHERS_ISO } from '@/lib/admin/analytics/jurisdictions';
import { getRegionalAnalytics } from '@/lib/admin/analytics/regional';
import { getServerLocalePreferences } from '@/lib/i18n/server-locale';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { getCountryByCode, formatCurrencyAmount } from '@/lib/country-config';

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
  const prefs = await getServerLocalePreferences();
  const dict = getDictionary(prefs.language);
  const exchangeRate = getCountryByCode(prefs.countryCode).exchangeRate;
  const usd = (amount: number): string =>
    formatCurrencyAmount(amount, {
      currency: prefs.currency,
      exchangeRate,
      language: prefs.language,
    });
  const noDataYet = dict['analytics.no_data_yet'] ?? 'No data yet';

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
          {dict['analytics.tab.regional'] ?? 'Regional & Tax Surveillance'}
        </h2>
        <p className="text-xs text-muted-foreground">
          {dict['analytics.regional_subtitle'] ??
            'Metrics #13-#19 -- 17 Whitelisted Jurisdictions + Other Countries'}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiSummaryCard
          label={
            dict['analytics.top_revenue_jurisdiction'] ??
            'Top Revenue Jurisdiction'
          }
          metricBadge="Metric #16"
          value={
            topRevenue
              ? `${topRevenue.countryName} (${topRevenue.isoCode})`
              : noDataYet
          }
          deltaPct={null}
          comparisonSubtext={
            topRevenue
              ? `${usd(topRevenue.trailing12mSalesUsd)} / ${topRevenue.salesSharePct.toFixed(1)}%`
              : undefined
          }
        />
        <KpiSummaryCard
          label={
            dict['analytics.top_user_base_market'] ?? 'Top User Base Market'
          }
          metricBadge="Metric #13 & #18"
          value={
            topUsers
              ? `${topUsers.countryName} (${topUsers.isoCode})`
              : noDataYet
          }
          deltaPct={null}
          comparisonSubtext={
            topUsers
              ? `${topUsers.totalUsers.toLocaleString()} ${dict['Users'] ?? 'users'} / ${topUsers.allUsersSharePct.toFixed(1)}%`
              : undefined
          }
        />
        <KpiSummaryCard
          label={dict['analytics.top_pro_market'] ?? 'Top Paid PRO Market'}
          metricBadge="Metric #15 & #19"
          value={
            topPro ? `${topPro.countryName} (${topPro.isoCode})` : noDataYet
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
          label={dict['analytics.active_tax_warning'] ?? 'Active Tax Warning'}
          metricBadge="Metric #17"
          value={
            topAlert
              ? `${topAlert.alertLevel.replace(/_/g, ' ')}`
              : (dict['analytics.no_active_alerts'] ?? 'No active alerts')
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
              {dict['analytics.all_users_geo_distribution'] ??
                'All Users Geographic Distribution (#18)'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DonutMarketShare
              data={data.donutMarketShare.allUsers}
              centerLabel={dict['analytics.total_users'] ?? 'Total Users'}
              centerValue={realRankings
                .reduce((s, r) => s + r.totalUsers, 0)
                .toLocaleString()}
            />
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-sm font-extrabold">
              {dict['analytics.pro_subscribers_distribution'] ??
                'PRO Paid Subscribers Distribution (#19)'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DonutMarketShare
              data={data.donutMarketShare.proUsers}
              centerLabel={dict['analytics.pro_users'] ?? 'PRO Users'}
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
            {dict['analytics.master_country_rankings'] ??
              'Master Country Rankings'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RankedCountryTable rows={data.countryRankings} />
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-sm font-extrabold">
            {dict['analytics.vat_threshold_surveillance'] ??
              'Metric #17: VAT & Sales Tax Threshold Surveillance'}
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
