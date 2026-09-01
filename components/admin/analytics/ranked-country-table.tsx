'use client';

import { cn } from '@/lib/utils';
import { useLocale } from '@/lib/context/locale-context';

export interface RankedCountryRow {
  rank: number;
  countryName: string;
  isoCode: string;
  totalUsers: number;
  allUsersSharePct: number;
  freeUsers: number;
  proUsers: number;
  proUsersSharePct: number;
  trailing12mSalesUsd: number;
  salesSharePct: number;
}

export interface RankedCountryTableProps {
  rows: RankedCountryRow[];
  /** Which column drives the inline percentage bar. Defaults to totalUsers/share. */
  highlightMetric?: 'totalUsers' | 'proUsers' | 'salesUsd';
}

const METRIC_CONFIG = {
  totalUsers: {
    shareKey: 'allUsersSharePct',
    valueKey: 'totalUsers',
    label: 'Users',
  },
  proUsers: {
    shareKey: 'proUsersSharePct',
    valueKey: 'proUsers',
    label: 'PRO',
  },
  salesUsd: {
    shareKey: 'salesSharePct',
    valueKey: 'trailing12mSalesUsd',
    label: 'Sales',
  },
} as const;

/**
 * Master country rankings table (Metrics #13-#16, #18-#19): 17 primary
 * jurisdictions + "Other Countries", ranked, with inline share-percentage
 * bars. Rank-1 row gets a subtle highlight, matching the prototype's
 * ranked-table pattern via `warning`/`info` tokens instead of raw hex.
 */
const METRIC_LABEL_KEY: Record<string, string> = {
  Users: 'analytics.metric_label.users',
  PRO: 'analytics.metric_label.pro',
  Sales: 'analytics.metric_label.sales',
};

export function RankedCountryTable({
  rows,
  highlightMetric = 'totalUsers',
}: RankedCountryTableProps): React.ReactElement {
  const { t, formatCurrency } = useLocale();
  const metric = METRIC_CONFIG[highlightMetric];
  const metricLabel = t(
    METRIC_LABEL_KEY[metric.label] ?? metric.label,
    metric.label
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead className="bg-muted/50 font-mono text-muted-foreground">
          <tr>
            <th className="px-3 py-2.5 text-center">{t('Rank')}</th>
            <th className="px-3 py-2.5">
              {t('analytics.country_territory', 'Country / Territory')}
            </th>
            <th className="px-3 py-2.5 text-center">{t('ISO')}</th>
            <th className="px-3 py-2.5 text-right">
              {t('analytics.total_users', 'Total Users')}
            </th>
            <th className="px-3 py-2.5 text-right">{t('FREE')}</th>
            <th className="px-3 py-2.5 text-right">{t('PRO')}</th>
            <th className="px-3 py-2.5 text-right">
              {t('analytics.trailing_12m_sales', 'Trailing 12M Sales')}
            </th>
            <th className="px-3 py-2.5 text-right">
              {metricLabel} {t('Share')}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border font-mono">
          {rows.map((row) => {
            const isOthers = row.isoCode === 'OTHERS';
            const sharePct = row[metric.shareKey];
            return (
              <tr
                key={row.isoCode}
                className={cn(
                  'hover:bg-accent/40',
                  row.rank === 1 && 'bg-warning/10',
                  isOthers && 'text-muted-foreground'
                )}
              >
                <td
                  className={cn(
                    'px-3 py-2 text-center font-bold',
                    row.rank === 1 ? 'text-warning' : 'text-muted-foreground'
                  )}
                >
                  {row.rank}
                </td>
                <td className="px-3 py-2 font-sans font-semibold text-foreground">
                  {row.countryName}
                </td>
                <td className="px-3 py-2 text-center">
                  <span className="rounded bg-muted px-1.5 py-0.5">
                    {row.isoCode}
                  </span>
                </td>
                <td className="px-3 py-2 text-right">
                  {row.totalUsers.toLocaleString()}
                </td>
                <td className="px-3 py-2 text-right">
                  {row.freeUsers.toLocaleString()}
                </td>
                <td className="px-3 py-2 text-right text-info">
                  {row.proUsers.toLocaleString()}
                </td>
                <td className="px-3 py-2 text-right text-success">
                  {formatCurrency(row.trailing12mSalesUsd)}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center justify-end gap-2">
                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-info"
                        style={{ width: `${Math.min(sharePct, 100)}%` }}
                      />
                    </div>
                    <span className="w-12 text-right">
                      {sharePct.toFixed(2)}%
                    </span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
