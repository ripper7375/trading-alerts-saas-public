'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, Suspense } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatDate } from '@/lib/utils';
import type { AuditLogStatus } from '@/types/disbursement';
import { useLocale } from '@/lib/context/locale-context';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface AuditLog {
  id: string;
  transactionId: string | null;
  batchId: string | null;
  action: string;
  actor: string | null;
  status: AuditLogStatus;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HELPER FUNCTIONS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function getStatusBadge(
  status: AuditLogStatus,
  t: (keyOrText: string, fallback?: string) => string
): React.ReactElement {
  const statusConfig: Record<
    AuditLogStatus,
    { className: string; labelKey: string; label: string }
  > = {
    SUCCESS: {
      className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
      labelKey: 'admin.disbursement.audit_status_success',
      label: 'Success',
    },
    FAILURE: {
      className: 'bg-red-500/10 text-red-600 dark:text-red-400',
      labelKey: 'admin.disbursement.audit_status_failure',
      label: 'Failure',
    },
    WARNING: {
      className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
      labelKey: 'admin.disbursement.audit_status_warning',
      label: 'Warning',
    },
    INFO: {
      className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
      labelKey: 'admin.disbursement.audit_status_info',
      label: 'Info',
    },
  };

  const config = statusConfig[status];

  return (
    <Badge className={`${config.className} text-xs`}>
      {t(config.labelKey, config.label)}
    </Badge>
  );
}

function getActionIcon(action: string): string {
  if (action.includes('created')) return '📦';
  if (action.includes('executed')) return '▶️';
  if (action.includes('completed')) return '✅';
  if (action.includes('failed')) return '❌';
  if (action.includes('cancelled')) return '🚫';
  if (action.includes('webhook')) return '🔔';
  if (action.includes('payment')) return '💸';
  if (action.includes('retry')) return '🔄';
  return '📋';
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AUDIT LOGS PAGE CONTENT
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function AuditLogsPageContent(): React.ReactElement {
  const { t } = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());

  const actionFilter = searchParams.get('action');

  const fetchLogs = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (actionFilter) params.set('action', actionFilter);
      params.set('limit', '100');

      const response = await fetch(
        `/api/disbursement/audit-logs?${params.toString()}`
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(
          data.error ||
            t(
              'admin.disbursement.error_fetch_audit_logs',
              'Failed to fetch audit logs'
            )
        );
      }

      const data = await response.json();
      setLogs(data.logs || []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('admin.dashboard.unknown_error', 'Unknown error')
      );
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionFilter]);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  const handleActionFilter = (action: string | null): void => {
    const params = new URLSearchParams();
    if (action) params.set('action', action);
    router.push(`/admin/disbursement/audit?${params.toString()}`);
  };

  const toggleLogExpand = (logId: string): void => {
    const newExpanded = new Set(expandedLogs);
    if (newExpanded.has(logId)) {
      newExpanded.delete(logId);
    } else {
      newExpanded.add(logId);
    }
    setExpandedLogs(newExpanded);
  };

  // Extract unique actions for filter
  const uniqueActions = [...new Set(logs.map((log) => log.action))].sort();

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
            {t('admin.disbursement.nav_audit_logs', 'Audit Logs')}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {t(
              'admin.disbursement.audit_logs_subtitle',
              'Disbursement activity history'
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => void fetchLogs()}
            variant="outline"
            disabled={isLoading}
          >
            {t('Refresh', 'Refresh')}
          </Button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <Card className="border-red-600 bg-red-500/10">
          <CardContent className="py-4">
            <p className="text-red-500">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Action Filter */}
      <Card className="border-border bg-card">
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-2">
            <Button
              variant={!actionFilter ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleActionFilter(null)}
            >
              {t('admin.disbursement.all_actions', 'All Actions')}
            </Button>
            {uniqueActions.map((action) => (
              <Button
                key={action}
                variant={actionFilter === action ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleActionFilter(action)}
              >
                {action}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Audit Logs List */}
      {isLoading ? (
        <div className="flex min-h-[200px] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-green-500" />
        </div>
      ) : logs.length > 0 ? (
        <div className="space-y-3">
          {logs.map((log) => (
            <Card
              key={log.id}
              className="border-border bg-card transition-colors hover:border-border"
            >
              <CardContent className="py-4">
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <span className="mt-1 text-2xl">
                    {getActionIcon(log.action)}
                  </span>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="font-medium text-foreground">
                        {log.action}
                      </span>
                      {getStatusBadge(log.status, t)}
                    </div>

                    {/* Metadata */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>{formatDate(log.createdAt)}</span>
                      {log.actor && (
                        <span>
                          {t(
                            'admin.disbursement.by_actor',
                            'by {actor}'
                          ).replace('{actor}', log.actor)}
                        </span>
                      )}
                      {log.batchId && (
                        <span>
                          {t('admin.disbursement.batch_label', 'Batch:')}{' '}
                          <span className="text-foreground">
                            {log.batchId.slice(0, 8)}...
                          </span>
                        </span>
                      )}
                      {log.transactionId && (
                        <span>
                          {t('admin.disbursement.tx_label', 'TX:')}{' '}
                          <span className="text-foreground">
                            {log.transactionId.slice(0, 8)}...
                          </span>
                        </span>
                      )}
                    </div>

                    {/* Details (expandable) */}
                    {log.details && Object.keys(log.details).length > 0 && (
                      <div className="mt-2">
                        <button
                          onClick={() => toggleLogExpand(log.id)}
                          className="hover:text-primary/80 text-xs text-primary"
                        >
                          {expandedLogs.has(log.id)
                            ? t(
                                'admin.disbursement.hide_details',
                                'Hide details ▲'
                              )
                            : t(
                                'admin.disbursement.show_details',
                                'Show details ▼'
                              )}
                        </button>
                        {expandedLogs.has(log.id) && (
                          <pre className="mt-2 max-h-40 overflow-auto rounded bg-background p-2 text-xs text-foreground">
                            {JSON.stringify(log.details, null, 2)}
                          </pre>
                        )}
                      </div>
                    )}

                    {/* IP/User Agent (if available and expanded) */}
                    {expandedLogs.has(log.id) &&
                      (log.ipAddress || log.userAgent) && (
                        <div className="mt-2 text-xs text-muted-foreground">
                          {log.ipAddress && (
                            <p>
                              {t('admin.disbursement.ip_label', 'IP:')}{' '}
                              {log.ipAddress}
                            </p>
                          )}
                          {log.userAgent && (
                            <p className="truncate">
                              {t('admin.disbursement.ua_label', 'UA:')}{' '}
                              {log.userAgent}
                            </p>
                          )}
                        </div>
                      )}
                  </div>

                  {/* Timestamp */}
                  <span className="whitespace-nowrap text-xs text-muted-foreground">
                    {new Date(log.createdAt).toLocaleTimeString()}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-border bg-card">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No audit logs found.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AUDIT LOGS PAGE
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Audit Logs Page - Client Component with Suspense
 *
 * Features:
 * - List of all audit logs
 * - Action filter
 * - Expandable details
 * - Timestamp display
 *
 * Data fetching:
 * - Fetches from /api/disbursement/audit-logs
 */
export default function AuditLogsPage(): React.ReactElement {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-green-500" />
        </div>
      }
    >
      <AuditLogsPageContent />
    </Suspense>
  );
}
