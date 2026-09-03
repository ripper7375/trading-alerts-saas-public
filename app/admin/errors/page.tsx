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
import { useLocale } from '@/lib/context/locale-context';

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
 *
 * Data source (Session 9-8a CONFIRM finding, Davin-accepted as pre-existing
 * debt): `GET /api/admin/error-logs` returns generated sample data -- real
 * persistent error logging is scheduled for a future phase, not this
 * session. The `X-Data-Source` response header discloses this; the banner
 * below surfaces it in the UI rather than presenting it as live.
 */
export default function ErrorLogsPage(): React.ReactElement {
  const { t } = useLocale();
  const [logs, setLogs] = useState<ErrorLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [isSampleData, setIsSampleData] = useState(false);

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
        throw new Error(
          data.error ||
            t('admin.errors.error_fetch_logs', 'Failed to fetch error logs')
        );
      }

      setIsSampleData(response.headers.get('X-Data-Source') === 'mock');
      const data: ErrorLogsResponse = await response.json();
      setLogs(data.logs);
      setTotal(data.total);
      setTotalPages(data.totalPages);
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
      t('admin.errors.csv_timestamp', 'Timestamp'),
      t('admin.errors.csv_type', 'Type'),
      t('admin.errors.csv_message', 'Message'),
      t('admin.errors.csv_user_id', 'User ID'),
      t('admin.errors.csv_tier', 'Tier'),
      t('admin.errors.csv_endpoint', 'Endpoint'),
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
    return typeClasses[type] || 'bg-muted hover:bg-muted';
  };

  const toggleLogExpansion = (logId: string): void => {
    setExpandedLog(expandedLog === logId ? null : logId);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
            {t('admin.errors.page_title', 'Error Logs')}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {t('admin.errors.page_subtitle', 'Monitor and track system errors')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={
              autoRefresh
                ? 'border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700'
                : ''
            }
          >
            {autoRefresh
              ? t('admin.errors.auto_refresh_on', '🔄 Auto-refresh ON')
              : t('admin.errors.auto_refresh_off', '⏸️ Auto-refresh OFF')}
          </Button>
          <Button onClick={handleExportCSV} disabled={logs.length === 0}>
            {t('admin.errors.export_csv', '📥 Export CSV')}
          </Button>
        </div>
      </div>

      {/* Sample-data disclosure -- honest, not hidden (Zero Mock Data rule,
          Davin-accepted exception per this session's own CONFIRM) */}
      {isSampleData && (
        <Card className="border-amber-500/30 bg-amber-500/10">
          <CardContent className="flex items-center gap-3 p-4">
            <span className="text-xl">ℹ️</span>
            <p className="text-sm text-amber-700 dark:text-amber-300">
              {t(
                'admin.errors.sample_data_notice',
                'Showing generated sample data. Real persistent error logging is scheduled for a future phase, not yet implemented.'
              )}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card className="border-border bg-card">
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
              <SelectTrigger>
                <SelectValue
                  placeholder={t('admin.errors.error_type', 'Error Type')}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">
                  {t('admin.errors.all_types', 'All Types')}
                </SelectItem>
                <SelectItem value="API_ERROR">
                  {t('admin.errors.api_error', 'API Error')}
                </SelectItem>
                <SelectItem value="DATABASE_ERROR">
                  {t('admin.errors.database_error', 'Database Error')}
                </SelectItem>
                <SelectItem value="AUTH_ERROR">
                  {t('admin.errors.auth_error', 'Auth Error')}
                </SelectItem>
                <SelectItem value="PAYMENT_ERROR">
                  {t('admin.errors.payment_error', 'Payment Error')}
                </SelectItem>
                <SelectItem value="MT5_ERROR">
                  {t('admin.errors.mt5_error', 'MT5 Error')}
                </SelectItem>
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
              <SelectTrigger>
                <SelectValue
                  placeholder={t('admin.users.tier_placeholder', 'Tier')}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">
                  {t('admin.users.all_tiers', 'All Tiers')}
                </SelectItem>
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
                aria-label={t(
                  'admin.errors.filter_start_date',
                  'Filter start date'
                )}
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
                aria-label={t(
                  'admin.errors.filter_end_date',
                  'Filter end date'
                )}
              />
            </div>

            {/* Apply Filter Button */}
            <Button onClick={() => void fetchLogs()}>
              {t('admin.errors.apply_filters', 'Apply Filters')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {t('admin.errors.errors_found', '{n} error{plural} found')
            .replace('{n}', String(total))
            .replace('{plural}', total !== 1 ? 's' : '')}
        </span>
        <span>
          {t('admin.users.page_of_total', 'Page {page} of {totalPages}')
            .replace('{page}', String(page))
            .replace('{totalPages}', String(totalPages))}
        </span>
      </div>

      {/* Error Logs Table */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-foreground">
            {t('admin.errors.card_title', 'Error Logs')}
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            {t('admin.errors.card_desc', 'Recent system errors with details')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
            </div>
          ) : error ? (
            <div className="py-8 text-center">
              <p className="mb-4 text-red-500">{error}</p>
              <Button onClick={() => void fetchLogs()}>
                {t('admin.dashboard.retry', 'Retry')}
              </Button>
            </div>
          ) : logs.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              {t(
                'admin.errors.no_errors_found',
                'No errors found for the selected filters'
              )}
            </p>
          ) : (
            <div className="space-y-4">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="overflow-hidden rounded-lg border border-border"
                >
                  <div
                    className="bg-accent/30 hover:bg-accent/50 cursor-pointer p-4 transition-colors"
                    onClick={() => toggleLogExpansion(log.id)}
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                      <span className="text-sm text-muted-foreground">
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
                              ? 'bg-primary text-primary-foreground hover:bg-primary'
                              : 'bg-muted text-muted-foreground hover:bg-muted'
                          } w-fit text-xs`}
                        >
                          {log.userTier}
                        </Badge>
                      )}
                      <span className="flex-1 truncate text-foreground">
                        {log.message}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {expandedLog === log.id ? '▲' : '▼'}
                      </span>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {expandedLog === log.id && (
                    <div className="space-y-3 border-t border-border bg-card p-4">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                          <p className="mb-1 text-xs uppercase text-muted-foreground">
                            {t('admin.errors.user_id', 'User ID')}
                          </p>
                          <p className="text-sm text-foreground">
                            {log.userId ||
                              t('admin.errors.not_available', 'N/A')}
                          </p>
                        </div>
                        <div>
                          <p className="mb-1 text-xs uppercase text-muted-foreground">
                            {t('admin.errors.endpoint', 'Endpoint')}
                          </p>
                          <p className="text-sm text-foreground">
                            {log.endpoint ||
                              t('admin.errors.not_available', 'N/A')}
                          </p>
                        </div>
                      </div>

                      {log.stackTrace && (
                        <div>
                          <p className="mb-1 text-xs uppercase text-muted-foreground">
                            {t('admin.errors.stack_trace', 'Stack Trace')}
                          </p>
                          <pre className="max-h-48 overflow-x-auto rounded bg-accent p-3 text-xs text-muted-foreground">
                            {log.stackTrace}
                          </pre>
                        </div>
                      )}

                      {log.metadata && Object.keys(log.metadata).length > 0 && (
                        <div>
                          <p className="mb-1 text-xs uppercase text-muted-foreground">
                            {t('admin.errors.metadata', 'Metadata')}
                          </p>
                          <pre className="overflow-x-auto rounded bg-accent p-3 text-xs text-muted-foreground">
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
          >
            {t('admin.users.previous', 'Previous')}
          </Button>

          <span className="px-4 text-muted-foreground">
            {t('admin.users.page_of_total', 'Page {page} of {totalPages}')
              .replace('{page}', String(page))
              .replace('{totalPages}', String(totalPages))}
          </span>

          <Button
            variant="outline"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            {t('admin.users.next', 'Next')}
          </Button>
        </div>
      )}
    </div>
  );
}
