'use client';

import { useCallback, useEffect, useState } from 'react';

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
import { useLocale } from '@/lib/context/locale-context';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface EndpointStats {
  endpoint: string;
  method: string;
  callsFree: number;
  callsPro: number;
  avgResponseTime: number;
  errorRate: number;
  lastCalled: string | null;
}

interface ApiUsageResponse {
  endpoints: EndpointStats[];
  summary: {
    totalCalls: number;
    totalCallsFree: number;
    totalCallsPro: number;
    avgResponseTime: number;
    overallErrorRate: number;
  };
  dateRange: {
    startDate: string;
    endDate: string;
  };
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// API USAGE PAGE
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * API Usage Analytics Page - Client Component
 *
 * Features:
 * - Endpoint usage statistics table
 * - Calls split by tier (FREE/PRO)
 * - Average response time per endpoint
 * - Error rate tracking with alerts for >5%
 * - Date range filter
 *
 * Data source (Session 9-8a CONFIRM finding, Davin-accepted as pre-existing
 * debt): `GET /api/admin/api-usage` returns generated sample data -- real
 * per-request telemetry (`ApiUsageLog`) is scheduled for Phase 10/14, not
 * this session. The `X-Data-Source` response header discloses this; the
 * banner below surfaces it in the UI rather than presenting it as live.
 */
export default function ApiUsagePage(): React.ReactElement {
  const { t } = useLocale();
  const [data, setData] = useState<ApiUsageResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSampleData, setIsSampleData] = useState(false);

  // Date filters
  const [startDate, setStartDate] = useState<string>(() => {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    return date.toISOString().split('T')[0] ?? '';
  });
  const [endDate, setEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0] ?? '';
  });

  const fetchUsage = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.set('startDate', startDate);
      params.set('endDate', endDate);

      const response = await fetch(`/api/admin/api-usage?${params.toString()}`);
      if (!response.ok) {
        const responseData = await response.json();
        throw new Error(
          responseData.error ||
            t('admin.api_usage.error_fetch', 'Failed to fetch API usage')
        );
      }

      setIsSampleData(response.headers.get('X-Data-Source') === 'mock');
      const responseData: ApiUsageResponse = await response.json();
      setData(responseData);
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
  }, [startDate, endDate]);

  useEffect(() => {
    void fetchUsage();
  }, [fetchUsage]);

  const getErrorRateBadge = (
    errorRate: number
  ): { className: string; text: string } => {
    if (errorRate > 5) {
      return {
        className: 'bg-red-600 hover:bg-red-600',
        text: t('admin.api_usage.error_rate_high', 'High'),
      };
    }
    if (errorRate > 2) {
      return {
        className: 'bg-yellow-600 hover:bg-yellow-600',
        text: t('admin.api_usage.error_rate_medium', 'Medium'),
      };
    }
    return {
      className: 'bg-emerald-600 hover:bg-emerald-600',
      text: t('admin.api_usage.error_rate_low', 'Low'),
    };
  };

  const getMethodBadgeClass = (method: string): string => {
    const methodClasses: Record<string, string> = {
      GET: 'bg-emerald-600 hover:bg-emerald-600',
      POST: 'bg-blue-600 hover:bg-blue-600',
      PATCH: 'bg-yellow-600 hover:bg-yellow-600',
      PUT: 'bg-orange-600 hover:bg-orange-600',
      DELETE: 'bg-red-600 hover:bg-red-600',
    };
    return methodClasses[method] || 'bg-muted hover:bg-muted';
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
          {t('admin.api_usage.title', 'API Usage')}
        </h1>
        <p className="mt-1 text-muted-foreground">
          {t(
            'admin.api_usage.subtitle',
            'Monitor API endpoint usage and performance by tier'
          )}
        </p>
      </div>

      {/* Sample-data disclosure -- honest, not hidden (Zero Mock Data rule,
          Davin-accepted exception per this session's own CONFIRM) */}
      {isSampleData && (
        <Card className="border-amber-500/30 bg-amber-500/10">
          <CardContent className="flex items-center gap-3 p-4">
            <span className="text-xl">ℹ️</span>
            <p className="text-sm text-amber-700 dark:text-amber-300">
              {t(
                'admin.api_usage.sample_data_prefix',
                'Showing generated sample data. Real per-request telemetry ('
              )}
              <code className="font-mono text-xs">ApiUsageLog</code>
              {t(
                'admin.api_usage.sample_data_suffix',
                ') is scheduled for a future phase, not yet implemented.'
              )}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Date Range Filter */}
      <Card className="border-border bg-card">
        <CardContent className="flex flex-col items-end gap-4 p-4 sm:flex-row sm:p-6">
          <div className="flex-1">
            <label className="mb-1 block text-sm text-muted-foreground">
              {t('admin.api_usage.start_date', 'Start Date')}
            </label>
            <Input
              type="date"
              value={startDate}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setStartDate(e.target.value)
              }
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-sm text-muted-foreground">
              {t('admin.api_usage.end_date', 'End Date')}
            </label>
            <Input
              type="date"
              value={endDate}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setEndDate(e.target.value)
              }
            />
          </div>
          <Button onClick={() => void fetchUsage()}>
            {t('admin.api_usage.apply_filter', 'Apply Filter')}
          </Button>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {data && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Card className="border-border bg-card">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">
                {t('admin.api_usage.total_calls', 'Total Calls')}
              </p>
              <p className="text-2xl font-bold text-foreground">
                {data.summary.totalCalls.toLocaleString()}
              </p>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">
                {t('admin.api_usage.free_tier_calls', 'FREE Tier Calls')}
              </p>
              <p className="text-2xl font-bold text-foreground">
                {data.summary.totalCallsFree.toLocaleString()}
              </p>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">
                {t('admin.api_usage.pro_tier_calls', 'PRO Tier Calls')}
              </p>
              <p className="text-2xl font-bold text-primary">
                {data.summary.totalCallsPro.toLocaleString()}
              </p>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">
                {t('admin.api_usage.avg_response_time', 'Avg Response Time')}
              </p>
              <p className="text-2xl font-bold text-foreground">
                {data.summary.avgResponseTime.toFixed(0)}ms
              </p>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">
                {t('admin.api_usage.error_rate', 'Error Rate')}
              </p>
              <p
                className={`text-2xl font-bold ${
                  data.summary.overallErrorRate > 5
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {data.summary.overallErrorRate.toFixed(2)}%
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* High Error Rate Alert */}
      {data?.endpoints.some((e) => e.errorRate > 5) && (
        <Card className="border-red-600/30 bg-red-600/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🚨</span>
              <div>
                <p className="font-medium text-foreground">
                  {t(
                    'admin.api_usage.high_error_rate_detected',
                    'High Error Rate Detected'
                  )}
                </p>
                <p className="text-sm text-red-600 dark:text-red-400">
                  {t(
                    'admin.api_usage.endpoints_above_threshold',
                    '{count} endpoint(s) have error rates above 5%'
                  ).replace(
                    '{count}',
                    String(data.endpoints.filter((e) => e.errorRate > 5).length)
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Endpoints Table */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-foreground">
            {t('admin.api_usage.endpoint_statistics', 'Endpoint Statistics')}
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            {t(
              'admin.api_usage.endpoint_statistics_desc',
              'API endpoint usage breakdown by tier'
            )}
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
              <Button onClick={() => void fetchUsage()}>
                {t('admin.dashboard.retry', 'Retry')}
              </Button>
            </div>
          ) : !data || data.endpoints.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              {t(
                'admin.api_usage.no_data_found',
                'No API usage data found for the selected date range'
              )}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      {t('admin.api_usage.endpoint', 'Endpoint')}
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      {t('admin.api_usage.method', 'Method')}
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                      {t('admin.api_usage.free_calls', 'FREE Calls')}
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                      {t('admin.api_usage.pro_calls', 'PRO Calls')}
                    </th>
                    <th className="hidden px-4 py-3 text-right font-medium text-muted-foreground md:table-cell">
                      {t('admin.api_usage.avg_time', 'Avg Time')}
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                      {t('admin.api_usage.error_rate', 'Error Rate')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.endpoints.map((endpoint, index) => (
                    <tr
                      key={`${endpoint.endpoint}-${endpoint.method}-${index}`}
                      className={`border-border/50 hover:bg-accent/30 border-b transition-colors ${
                        endpoint.errorRate > 5 ? 'bg-red-600/10' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <code className="rounded bg-accent px-2 py-1 text-sm text-foreground">
                          {endpoint.endpoint}
                        </code>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          className={`${getMethodBadgeClass(endpoint.method)} text-xs text-white`}
                        >
                          {endpoint.method}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-muted-foreground">
                          {endpoint.callsFree.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-primary">
                          {endpoint.callsPro.toLocaleString()}
                        </span>
                      </td>
                      <td className="hidden px-4 py-3 text-right md:table-cell">
                        <span className="text-muted-foreground">
                          {endpoint.avgResponseTime.toFixed(0)}ms
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span
                            className={
                              endpoint.errorRate > 5
                                ? 'text-red-600 dark:text-red-400'
                                : 'text-muted-foreground'
                            }
                          >
                            {endpoint.errorRate.toFixed(2)}%
                          </span>
                          <Badge
                            className={`${getErrorRateBadge(endpoint.errorRate).className} text-xs text-white`}
                          >
                            {getErrorRateBadge(endpoint.errorRate).text}
                          </Badge>
                        </div>
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
