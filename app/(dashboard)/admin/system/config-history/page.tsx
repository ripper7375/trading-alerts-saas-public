import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { prisma } from '@/lib/db/prisma';
import { formatDate } from '@/lib/utils';

const HISTORY_LIMIT = 50;

/**
 * Config Audit History - Server Component (Session 6-11, B2-17)
 *
 * `SystemConfigHistory` exists in the schema with zero readers or writers
 * anywhere in this codebase (monolith or operation-service) -- confirmed at
 * this order's own CONFIRM. Renders an honest "no entries recorded" empty
 * state rather than fabricating audit rows.
 */
export default async function AdminSystemConfigHistoryPage(): Promise<React.ReactElement> {
  const entries = await prisma.systemConfigHistory.findMany({
    orderBy: { changedAt: 'desc' },
    take: HISTORY_LIMIT,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Config Audit History</h1>
        <p className="mt-1 text-sm text-gray-400">
          Records of system configuration changes made through the admin panel.
        </p>
      </div>

      <Card className="border-gray-700 bg-gray-800">
        <CardHeader>
          <CardTitle className="text-white">Recent Changes</CardTitle>
          <CardDescription className="text-gray-400">
            Most recent {HISTORY_LIMIT} entries.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">
              No config changes have been recorded yet. Nothing in this codebase
              currently writes to this audit log.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-700 text-gray-400">
                    <th className="pb-2 pr-4">Config Key</th>
                    <th className="pb-2 pr-4">Old Value</th>
                    <th className="pb-2 pr-4">New Value</th>
                    <th className="pb-2 pr-4">Changed By</th>
                    <th className="pb-2 pr-4">Reason</th>
                    <th className="pb-2">Changed At</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr
                      key={entry.id}
                      className="border-b border-gray-700/50 text-gray-200"
                    >
                      <td className="py-2 pr-4 font-medium">
                        {entry.configKey}
                      </td>
                      <td className="max-w-xs truncate py-2 pr-4 text-gray-400">
                        {entry.oldValue}
                      </td>
                      <td className="max-w-xs truncate py-2 pr-4 text-gray-200">
                        {entry.newValue}
                      </td>
                      <td className="py-2 pr-4 text-gray-400">
                        {entry.changedBy}
                      </td>
                      <td className="py-2 pr-4 text-gray-400">
                        {entry.reason ?? '—'}
                      </td>
                      <td className="py-2 text-gray-400">
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
