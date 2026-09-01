import { getServerLanguage } from '@/lib/i18n/server-locale';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { DashboardTabs } from './dashboard-tabs';

interface DashboardsLayoutProps {
  children: React.ReactNode;
}

/**
 * Shared layout for the DavinTrade Business Intelligence dashboard suite
 * (5 dashboards synthesizing the 25 business metrics catalog). Admin RBAC
 * is already enforced by the parent `app/admin/layout.tsx` -- this layout
 * only adds the BI-suite sub-navigation.
 */
export default async function DashboardsLayout({
  children,
}: DashboardsLayoutProps): Promise<React.ReactElement> {
  const dict = getDictionary(await getServerLanguage());
  return (
    <div className="-m-4 sm:-m-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-6 py-3.5">
        <div>
          <h1 className="text-base font-extrabold tracking-tight text-foreground">
            DavinTrade{' '}
            <span className="text-primary">
              {dict['analytics.executive_bi'] ?? 'Executive BI'}
            </span>
          </h1>
          <p className="text-[11px] font-medium text-muted-foreground">
            {dict['analytics.bi_subtitle'] ??
              'Business Administration & Decision Analytics System'}
          </p>
        </div>
        <div className="bg-muted/50 flex items-center gap-1.5 rounded-xl border border-border px-3.5 py-1.5 text-xs shadow-inner">
          <span className="text-muted-foreground">
            💵 {dict['analytics.base_currency'] ?? 'Base:'}
          </span>
          <span className="font-black text-success">USD ($)</span>
        </div>
      </div>

      <DashboardTabs />

      <div className="space-y-6 p-4 sm:p-6">{children}</div>
    </div>
  );
}
