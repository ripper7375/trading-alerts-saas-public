import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { RetryFailedEventsButton } from '@/components/admin/system/retry-failed-events-button';
import { prisma } from '@/lib/db/prisma';
import { formatDate } from '@/lib/utils';
import { getServerLanguage } from '@/lib/i18n/server-locale';
import { getDictionary } from '@/lib/i18n/get-dictionary';

const RECENT_FAILURES_LIMIT = 20;

const STATUS_ORDER = ['PENDING', 'PROCESSED', 'FAILED'] as const;

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'PROCESSED':
      return 'bg-emerald-600 text-white hover:bg-emerald-600';
    case 'PENDING':
      return 'bg-blue-600 text-white hover:bg-blue-600';
    case 'FAILED':
      return 'bg-red-600 text-white hover:bg-red-600';
    default:
      return 'bg-muted text-muted-foreground hover:bg-muted';
  }
}

/**
 * Outbox Event Queue Monitor - Server Component (Session 6-11, B2-16)
 *
 * `OutboxEvent` has been live in production since Session 4A-8 (F14) --
 * confirmed empty (0 rows, ever) as of Waiting-on #78 at this order's own
 * drafting. Renders real counts and real rows either way; a zero row count
 * is an honest, expected result, not an error state.
 */
export default async function AdminSystemOutboxPage(): Promise<React.ReactElement> {
  const [grouped, failedEvents, totalCount] = await Promise.all([
    prisma.outboxEvent.groupBy({
      by: ['status'],
      _count: { _all: true },
    }),
    prisma.outboxEvent.findMany({
      where: { status: 'FAILED' },
      orderBy: { createdAt: 'desc' },
      take: RECENT_FAILURES_LIMIT,
    }),
    prisma.outboxEvent.count(),
  ]);

  const countsByStatus = new Map(grouped.map((g) => [g.status, g._count._all]));
  const failedCount = countsByStatus.get('FAILED') ?? 0;

  const dict = getDictionary(await getServerLanguage());
  const dt = (key: string, fallback: string): string => dict[key] ?? fallback;
  const statusLabel = (status: string): string =>
    dt(`admin.system.outbox_status_${status.toLowerCase()}`, status);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {dt('admin.system.outbox_title', 'Outbox Event Queue')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {totalCount}{' '}
            {totalCount === 1
              ? dt('admin.system.total_event_singular', 'total event recorded.')
              : dt(
                  'admin.system.total_event_plural',
                  'total events recorded.'
                )}{' '}
            {dt(
              'admin.system.outbox_delivered_by',
              "Delivered by money-service's OutboxPublisherCron to operation-service."
            )}
          </p>
        </div>
        <RetryFailedEventsButton failedCount={failedCount} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {STATUS_ORDER.map((status) => (
          <Card key={status} className="border-border bg-card">
            <CardHeader>
              <CardDescription className="text-muted-foreground">
                {statusLabel(status)}
              </CardDescription>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <Badge className={statusBadgeClass(status)}>
                  {statusLabel(status)}
                </Badge>
                <span>{countsByStatus.get(status) ?? 0}</span>
              </CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-foreground">
            {dt('admin.system.recent_failures', 'Recent Failures')}
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            {dt(
              'admin.system.recent_failures_count',
              'Most recent {limit} FAILED events.'
            ).replace('{limit}', String(RECENT_FAILURES_LIMIT))}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {failedEvents.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {dt(
                'admin.system.no_failed_outbox_events',
                'No failed outbox events recorded.'
              )}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="pb-2 pr-4">
                      {dt('admin.system.event_type', 'Event Type')}
                    </th>
                    <th className="pb-2 pr-4">
                      {dt('admin.system.aggregate', 'Aggregate')}
                    </th>
                    <th className="pb-2 pr-4">
                      {dt('admin.system.attempts', 'Attempts')}
                    </th>
                    <th className="pb-2 pr-4">
                      {dt('admin.system.last_error', 'Last Error')}
                    </th>
                    <th className="pb-2">
                      {dt('admin.system.created', 'Created')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {failedEvents.map((event) => (
                    <tr
                      key={event.id}
                      className="border-border/50 border-b text-foreground"
                    >
                      <td className="py-2 pr-4 font-medium">
                        {event.eventType}
                      </td>
                      <td className="py-2 pr-4 text-muted-foreground">
                        {event.aggregateType}:{event.aggregateId}
                      </td>
                      <td className="py-2 pr-4">{event.attemptCount}</td>
                      <td className="max-w-xs truncate py-2 pr-4 text-red-600 dark:text-red-400">
                        {event.lastError ?? '—'}
                      </td>
                      <td className="py-2 text-muted-foreground">
                        {formatDate(event.createdAt)}
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
