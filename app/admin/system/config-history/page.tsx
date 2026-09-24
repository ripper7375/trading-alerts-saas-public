import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { prisma } from '@/lib/db/prisma';
import { formatDateInZone } from '@/lib/i18n/format-datetime';
import { getServerLocalePreferences } from '@/lib/i18n/server-locale';
import { getDictionary } from '@/lib/i18n/get-dictionary';

const HISTORY_LIMIT = 50;

/**
 * Config Audit History - Server Component (Session 6-11, B2-17)
 *
 * Lists the latest `SystemConfigHistory` rows. Writers: `PATCH
 * /api/admin/settings/affiliate` (affiliate pricing/commission keys) and
 * `PATCH /api/disbursement/settings` (payout settings, DECISION-LOG F83).
 * (The Session 6-11 note that the table had "zero readers or writers" is
 * stale.) Renders an honest "no entries recorded" empty state when the table
 * is empty rather than fabricating audit rows.
 */
export default async function AdminSystemConfigHistoryPage(): Promise<React.ReactElement> {
  const entries = await prisma.systemConfigHistory.findMany({
    orderBy: { changedAt: 'desc' },
    take: HISTORY_LIMIT,
  });

  const prefs = await getServerLocalePreferences();
  const dict = getDictionary(prefs.language);
  // Dates in the admin's own timezone and date format.
  const formatDate = (value: Date | string): string =>
    formatDateInZone(value, prefs);
  const dt = (key: string, fallback: string): string => dict[key] ?? fallback;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {dt('admin.system.config_history_title', 'Config Audit History')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {dt(
            'admin.system.config_history_subtitle',
            'Records of system configuration changes made through the admin panel.'
          )}
        </p>
      </div>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-foreground">
            {dt('admin.system.recent_changes', 'Recent Changes')}
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            {dt(
              'admin.system.recent_changes_count',
              'Most recent {limit} entries.'
            ).replace('{limit}', String(HISTORY_LIMIT))}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {dt(
                'admin.system.no_config_changes',
                'No config changes have been recorded yet. Nothing in this codebase currently writes to this audit log.'
              )}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="pb-2 pr-4">
                      {dt('admin.system.config_key', 'Config Key')}
                    </th>
                    <th className="pb-2 pr-4">
                      {dt('admin.system.old_value', 'Old Value')}
                    </th>
                    <th className="pb-2 pr-4">
                      {dt('admin.system.new_value', 'New Value')}
                    </th>
                    <th className="pb-2 pr-4">
                      {dt('admin.system.changed_by', 'Changed By')}
                    </th>
                    <th className="pb-2 pr-4">
                      {dt('admin.system.reason', 'Reason')}
                    </th>
                    <th className="pb-2">
                      {dt('admin.system.changed_at', 'Changed At')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr
                      key={entry.id}
                      className="border-border/50 border-b text-foreground"
                    >
                      <td className="py-2 pr-4 font-medium">
                        {entry.configKey}
                      </td>
                      <td className="max-w-xs truncate py-2 pr-4 text-muted-foreground">
                        {entry.oldValue}
                      </td>
                      <td className="max-w-xs truncate py-2 pr-4 text-foreground">
                        {entry.newValue}
                      </td>
                      <td className="py-2 pr-4 text-muted-foreground">
                        {entry.changedBy}
                      </td>
                      <td className="py-2 pr-4 text-muted-foreground">
                        {entry.reason ?? '—'}
                      </td>
                      <td className="py-2 text-muted-foreground">
                        {formatDate(entry.changedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
