'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, Suspense } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatDate } from '@/lib/utils';
import type { AuditLogStatus } from '@/types/disbursement';

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

function getStatusBadge(status: AuditLogStatus): React.ReactElement {
  const statusConfig: Record<
    AuditLogStatus,
    { className: string; label: string }
  > = {
    SUCCESS: { className: 'bg-green-600', label: 'Success' },
    FAILURE: { className: 'bg-red-600', label: 'Failure' },
    WARNING: { className: 'bg-yellow-600', label: 'Warning' },
    INFO: { className: 'bg-blue-600', label: 'Info' },
  };

  const config = statusConfig[status];

  return (
    <Badge className={`${config.className} text-white text-xs`}>
      {config.label}
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
        throw new Error(data.error || 'Failed to fetch audit logs');
      }

      const data = await response.json();
      setLogs(data.logs || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">
            Audit Logs
          </h1>
          <p className="text-gray-400 mt-1">Disbursement activity history</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => void fetchLogs()}
            variant="outline"
            disabled={isLoading}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <Card className="bg-red-900/50 border-red-600">
          <CardContent className="py-4">
            <p className="text-red-300">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Action Filter */}
      <Card className="bg-gray-800 border-gray-700">
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-2">
            <Button
              variant={!actionFilter ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleActionFilter(null)}
              className={!actionFilter ? 'bg-green-600 hover:bg-green-700' : ''}
            >
              All Actions
            </Button>
            {uniqueActions.map((action) => (
              <Button
                key={action}
                variant={actionFilter === action ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleActionFilter(action)}
                className={
                  actionFilter === action
                    ? 'bg-green-600 hover:bg-green-700'
                    : ''
                }
              >
                {action}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Audit Logs List */}
      {isLoading ? (
        <div className="flex items-center justify-center min-h-[200px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500" />
        </div>
      ) : logs.length > 0 ? (
        <div className="space-y-3">
          {logs.map((log) => (
            <Card
              key={log.id}
              className="bg-gray-800 border-gray-700 hover:border-gray-600 transition-colors"
            >
              <CardContent className="py-4">
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <span className="text-2xl mt-1">
                    {getActionIcon(log.action)}
                  </span>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-white font-medium">
                        {log.action}
                      </span>
                      {getStatusBadge(log.status)}
                    </div>

                    {/* Metadata */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
                      <span>{formatDate(log.createdAt)}</span>
                      {log.actor && <span>by {log.actor}</span>}
                      {log.batchId && (
                        <span>
                          Batch:{' '}
                          <span className="text-gray-300">
                            {log.batchId.slice(0, 8)}...
                          </span>
                        </span>
                      )}
                      {log.transactionId && (
                        <span>
                          TX:{' '}
                          <span className="text-gray-300">
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
                          className="text-blue-400 hover:text-blue-300 text-xs"
                        >
                          {expandedLogs.has(log.id)
                            ? 'Hide details ▲'
                            : 'Show details ▼'}
                        </button>
                        {expandedLogs.has(log.id) && (
                          <pre className="mt-2 p-2 bg-gray-900 rounded text-xs text-gray-300 overflow-auto max-h-40">
                            {JSON.stringify(log.details, null, 2)}
                          </pre>
                        )}
                      </div>
                    )}

                    {/* IP/User Agent (if available and expanded) */}
                    {expandedLogs.has(log.id) &&
                      (log.ipAddress || log.userAgent) && (
                        <div className="mt-2 text-xs text-gray-500">
                          {log.ipAddress && <p>IP: {log.ipAddress}</p>}
                          {log.userAgent && (
                            <p className="truncate">UA: {log.userAgent}</p>
                          )}
                        </div>
                      )}
                  </div>

                  {/* Timestamp */}
                  <span className="text-gray-500 text-xs whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleTimeString()}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="py-12 text-center">
            <p className="text-gray-400">No audit logs found.</p>
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
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500" />
        </div>
      }
    >
      <AuditLogsPageContent />
    </Suspense>
  );
}
