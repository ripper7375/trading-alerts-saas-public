'use client';

import { useCallback, useEffect, useState, useRef } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

type ErrorType =
  | 'ALL'
  | 'API_ERROR'
  | 'DATABASE_ERROR'
  | 'AUTH_ERROR'
  | 'PAYMENT_ERROR'
  | 'MT5_ERROR';

type TierFilter = 'ALL' | 'FREE' | 'PRO';

interface ErrorLog {
  id: string;
  timestamp: string;
  type: string;
  message: string;
  userId: string | null;
  userTier: 'FREE' | 'PRO' | null;
  endpoint: string | null;
  stackTrace: string | null;
  metadata: Record<string, unknown> | null;
}

interface ErrorLogsResponse {
  logs: ErrorLog[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ERROR LOGS PAGE
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Error Logs Page - Client Component
 *
 * Features:
 * - Error logs table with pagination
 * - Filter by error type, tier, date range
 * - Auto-refresh every 30 seconds
 * - Export to CSV functionality
 * - Stack trace viewer
 */
export default function ErrorLogsPage(): React.ReactElement {
  const [logs, setLogs] = useState<ErrorLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  // Filters
  const [errorType, setErrorType] = useState<ErrorType>('ALL');
  const [tierFilter, setTierFilter] = useState<TierFilter>('ALL');
  const [startDate, setStartDate] = useState<string>(() => {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    return date.toISOString().split('T')[0] ?? '';
  });
  const [endDate, setEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0] ?? '';
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchLogs = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('pageSize', '50');
      params.set('type', errorType);
      params.set('tier', tierFilter);
      params.set('startDate', startDate);
      params.set('endDate', endDate);

      const response = await fetch(
        `/api/admin/error-logs?${params.toString()}`
      );
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch error logs');
      }

      const data: ErrorLogsResponse = await response.json();
      setLogs(data.logs);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [page, errorType, tierFilter, startDate, endDate]);

  // Initial fetch and auto-refresh
  useEffect(() => {
    void fetchLogs();

    if (autoRefresh) {
      intervalRef.current = setInterval(() => {
        void fetchLogs();
      }, 30000); // 30 seconds
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchLogs, autoRefresh]);

  const handleExportCSV = (): void => {
    if (logs.length === 0) return;

    const headers = [
      'Timestamp',
      'Type',
      'Message',
      'User ID',
      'Tier',
      'Endpoint',
    ];
    const rows = logs.map((log) => [
      new Date(log.timestamp).toISOString(),
      log.type,
      `"${log.message.replace(/"/g, '""')}"`,
      log.userId || '',
      log.userTier || '',
      log.endpoint || '',
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `error-logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getErrorTypeBadgeClass = (type: string): string => {
    const typeClasses: Record<string, string> = {
      API_ERROR: 'bg-blue-600 hover:bg-blue-600',
      DATABASE_ERROR: 'bg-purple-600 hover:bg-purple-600',
      AUTH_ERROR: 'bg-yellow-600 hover:bg-yellow-600',
      PAYMENT_ERROR: 'bg-red-600 hover:bg-red-600',
      MT5_ERROR: 'bg-orange-600 hover:bg-orange-600',
    };
    return typeClasses[type] || 'bg-gray-600 hover:bg-gray-600';
  };

  const toggleLogExpansion = (logId: string): void => {
    setExpandedLog(expandedLog === logId ? null : logId);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white sm:text-3xl">
            Error Logs
          </h1>
          <p className="mt-1 text-gray-400">Monitor and track system errors</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`${
              autoRefresh
                ? 'border-green-600 bg-green-600 hover:bg-green-700'
                : 'border-gray-600 bg-gray-700 hover:bg-gray-600'
            } text-white`}
          >
            {autoRefresh ? '🔄 Auto-refresh ON' : '⏸️ Auto-refresh OFF'}
          </Button>
          <Button
            onClick={handleExportCSV}
            disabled={logs.length === 0}
            className="bg-blue-600 hover:bg-blue-700"
          >
            📥 Export CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="border-gray-700 bg-gray-800">
        <CardContent className="p-4 sm:p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {/* Error Type Filter */}
            <Select
              value={errorType}
              onValueChange={(v) => {
                setErrorType(v as ErrorType);
                setPage(1);
              }}
            >
              <SelectTrigger className="border-gray-600 bg-gray-700 text-white">
                <SelectValue placeholder="Error Type" />
              </SelectTrigger>
              <SelectContent className="border-gray-600 bg-gray-700">
                <SelectItem value="ALL">All Types</SelectItem>
                <SelectItem value="API_ERROR">API Error</SelectItem>
                <SelectItem value="DATABASE_ERROR">Database Error</SelectItem>
                <SelectItem value="AUTH_ERROR">Auth Error</SelectItem>
                <SelectItem value="PAYMENT_ERROR">Payment Error</SelectItem>
                <SelectItem value="MT5_ERROR">MT5 Error</SelectItem>
              </SelectContent>
            </Select>

            {/* Tier Filter */}
            <Select
              value={tierFilter}
              onValueChange={(v) => {
                setTierFilter(v as TierFilter);
                setPage(1);
              }}
            >
              <SelectTrigger className="border-gray-600 bg-gray-700 text-white">
                <SelectValue placeholder="Tier" />
              </SelectTrigger>
              <SelectContent className="border-gray-600 bg-gray-700">
                <SelectItem value="ALL">All Tiers</SelectItem>
                <SelectItem value="FREE">FREE</SelectItem>
                <SelectItem value="PRO">PRO</SelectItem>
              </SelectContent>
            </Select>

            {/* Start Date */}
            <div>
              <Input
                type="date"
                value={startDate}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
                aria-label="Filter start date"
                className="border-gray-600 bg-gray-700 text-white"
              />
            </div>

            {/* End Date */}
            <div>
              <Input
                type="date"
                value={endDate}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
                aria-label="Filter end date"
                className="border-gray-600 bg-gray-700 text-white"
              />
            </div>

            {/* Apply Filter Button */}
            <Button
              onClick={() => void fetchLogs()}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Apply Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="flex items-center justify-between text-sm text-gray-400">
        <span>
          {total} error{total !== 1 ? 's' : ''} found
        </span>
        <span>
          Page {page} of {totalPages}
        </span>
      </div>

      {/* Error Logs Table */}
      <Card className="border-gray-700 bg-gray-800">
        <CardHeader>
          <CardTitle className="text-white">Error Logs</CardTitle>
          <CardDescription className="text-gray-400">
            Recent system errors with details
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-500" />
            </div>
          ) : error ? (
            <div className="py-8 text-center">
              <p className="mb-4 text-red-400">{error}</p>
              <Button
                onClick={() => void fetchLogs()}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Retry
              </Button>
            </div>
          ) : logs.length === 0 ? (
            <p className="py-8 text-center text-gray-400">
              No errors found for the selected filters
            </p>
          ) : (
            <div className="space-y-4">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="overflow-hidden rounded-lg border border-gray-700"
                >
                  <div
                    className="cursor-pointer bg-gray-700/30 p-4 transition-colors hover:bg-gray-700/50"
                    onClick={() => toggleLogExpansion(log.id)}
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                      <span className="text-sm text-gray-400">
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                      <Badge
                        className={`${getErrorTypeBadgeClass(log.type)} w-fit text-xs text-white`}
                      >
                        {log.type}
                      </Badge>
                      {log.userTier && (
                        <Badge
                          className={`${
                            log.userTier === 'PRO'
                              ? 'bg-blue-600 hover:bg-blue-600'
                              : 'bg-gray-600 hover:bg-gray-600'
                          } w-fit text-xs text-white`}
                        >
                          {log.userTier}
                        </Badge>
                      )}
                      <span className="flex-1 truncate text-white">
                        {log.message}
                      </span>
                      <span className="text-sm text-gray-500">
                        {expandedLog === log.id ? '▲' : '▼'}
                      </span>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {expandedLog === log.id && (
                    <div className="space-y-3 border-t border-gray-700 bg-gray-800 p-4">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                          <p className="mb-1 text-xs uppercase text-gray-400">
                            User ID
                          </p>
                          <p className="text-sm text-white">
                            {log.userId || 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="mb-1 text-xs uppercase text-gray-400">
                            Endpoint
                          </p>
                          <p className="text-sm text-white">
                            {log.endpoint || 'N/A'}
                          </p>
                        </div>
                      </div>

                      {log.stackTrace && (
                        <div>
                          <p className="mb-1 text-xs uppercase text-gray-400">
                            Stack Trace
                          </p>
                          <pre className="max-h-48 overflow-x-auto rounded bg-gray-900 p-3 text-xs text-gray-300">
                            {log.stackTrace}
                          </pre>
                        </div>
                      )}

                      {log.metadata && Object.keys(log.metadata).length > 0 && (
                        <div>
                          <p className="mb-1 text-xs uppercase text-gray-400">
                            Metadata
                          </p>
                          <pre className="overflow-x-auto rounded bg-gray-900 p-3 text-xs text-gray-300">
                            {JSON.stringify(log.metadata, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="border-gray-600 bg-gray-700 text-white hover:bg-gray-600 disabled:opacity-50"
          >
            Previous
          </Button>

          <span className="px-4 text-gray-400">
            Page {page} of {totalPages}
          </span>

          <Button
            variant="outline"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="border-gray-600 bg-gray-700 text-white hover:bg-gray-600 disabled:opacity-50"
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
