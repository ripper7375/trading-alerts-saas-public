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

const RECENT_FAILURES_LIMIT = 20;

const STATUS_ORDER = ['PENDING', 'PROCESSED', 'FAILED'] as const;

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'PROCESSED':
      return 'bg-green-600 text-white';
    case 'PENDING':
      return 'bg-blue-700 text-white';
    case 'FAILED':
      return 'bg-red-600 text-white';
    default:
      return 'bg-gray-600 text-white';
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Outbox Event Queue</h1>
          <p className="mt-1 text-sm text-gray-400">
            {totalCount} total event{totalCount === 1 ? '' : 's'} recorded.
            Delivered by money-service&apos;s OutboxPublisherCron to
            operation-service.
          </p>
        </div>
        <RetryFailedEventsButton failedCount={failedCount} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {STATUS_ORDER.map((status) => (
          <Card key={status} className="border-gray-700 bg-gray-800">
            <CardHeader>
              <CardDescription className="text-gray-400">
                {status}
              </CardDescription>
              <CardTitle className="flex items-center gap-2 text-white">
                <Badge className={statusBadgeClass(status)}>{status}</Badge>
                <span>{countsByStatus.get(status) ?? 0}</span>
              </CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card className="border-gray-700 bg-gray-800">
        <CardHeader>
          <CardTitle className="text-white">Recent Failures</CardTitle>
          <CardDescription className="text-gray-400">
            Most recent {RECENT_FAILURES_LIMIT} FAILED events.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {failedEvents.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">
              No failed outbox events recorded.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-700 text-gray-400">
                    <th className="pb-2 pr-4">Event Type</th>
                    <th className="pb-2 pr-4">Aggregate</th>
                    <th className="pb-2 pr-4">Attempts</th>
                    <th className="pb-2 pr-4">Last Error</th>
                    <th className="pb-2">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {failedEvents.map((event) => (
                    <tr
                      key={event.id}
                      className="border-b border-gray-700/50 text-gray-200"
                    >
                      <td className="py-2 pr-4 font-medium">
                        {event.eventType}
                      </td>
                      <td className="py-2 pr-4 text-gray-400">
                        {event.aggregateType}:{event.aggregateId}
                      </td>
                      <td className="py-2 pr-4">{event.attemptCount}</td>
                      <td className="max-w-xs truncate py-2 pr-4 text-red-400">
                        {event.lastError ?? '—'}
                      </td>
                      <td className="py-2 text-gray-400">
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
