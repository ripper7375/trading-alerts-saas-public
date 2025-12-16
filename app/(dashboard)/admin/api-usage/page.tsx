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
 */
export default function ApiUsagePage(): React.ReactElement {
  const [data, setData] = useState<ApiUsageResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        throw new Error(responseData.error || 'Failed to fetch API usage');
      }

      const responseData: ApiUsageResponse = await response.json();
      setData(responseData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    void fetchUsage();
  }, [fetchUsage]);

  const getErrorRateBadge = (
    errorRate: number
  ): { className: string; text: string } => {
    if (errorRate > 5) {
      return { className: 'bg-red-600 hover:bg-red-600', text: 'High' };
    }
    if (errorRate > 2) {
      return { className: 'bg-yellow-600 hover:bg-yellow-600', text: 'Medium' };
    }
    return { className: 'bg-green-600 hover:bg-green-600', text: 'Low' };
  };

  const getMethodBadgeClass = (method: string): string => {
    const methodClasses: Record<string, string> = {
      GET: 'bg-green-600 hover:bg-green-600',
      POST: 'bg-blue-600 hover:bg-blue-600',
      PATCH: 'bg-yellow-600 hover:bg-yellow-600',
      PUT: 'bg-orange-600 hover:bg-orange-600',
      DELETE: 'bg-red-600 hover:bg-red-600',
    };
    return methodClasses[method] || 'bg-gray-600 hover:bg-gray-600';
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white">API Usage</h1>
        <p className="text-gray-400 mt-1">
          Monitor API endpoint usage and performance by tier
        </p>
      </div>

      {/* Date Range Filter */}
      <Card className="bg-gray-800 border-gray-700">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm text-gray-400 mb-1">
                Start Date
              </label>
              <Input
                type="date"
                value={startDate}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setStartDate(e.target.value)
                }
                className="bg-gray-700 border-gray-600 text-white"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm text-gray-400 mb-1">
                End Date
              </label>
              <Input
                type="date"
                value={endDate}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setEndDate(e.target.value)
                }
                className="bg-gray-700 border-gray-600 text-white"
              />
            </div>
            <Button
              onClick={() => void fetchUsage()}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Apply Filter
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-4">
              <p className="text-gray-400 text-sm">Total Calls</p>
              <p className="text-2xl font-bold text-white">
                {data.summary.totalCalls.toLocaleString()}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-4">
              <p className="text-gray-400 text-sm">FREE Tier Calls</p>
              <p className="text-2xl font-bold text-white">
                {data.summary.totalCallsFree.toLocaleString()}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-4">
              <p className="text-gray-400 text-sm">PRO Tier Calls</p>
              <p className="text-2xl font-bold text-blue-400">
                {data.summary.totalCallsPro.toLocaleString()}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-4">
              <p className="text-gray-400 text-sm">Avg Response Time</p>
              <p className="text-2xl font-bold text-white">
                {data.summary.avgResponseTime.toFixed(0)}ms
              </p>
            </CardContent>
          </Card>
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-4">
              <p className="text-gray-400 text-sm">Error Rate</p>
              <p
                className={`text-2xl font-bold ${
                  data.summary.overallErrorRate > 5
                    ? 'text-red-400'
                    : 'text-green-400'
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
        <Card className="bg-red-900/30 border-red-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🚨</span>
              <div>
                <p className="text-white font-medium">
                  High Error Rate Detected
                </p>
                <p className="text-red-300 text-sm">
                  {data.endpoints.filter((e) => e.errorRate > 5).length}{' '}
                  endpoint(s) have error rates above 5%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Endpoints Table */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">Endpoint Statistics</CardTitle>
          <CardDescription className="text-gray-400">
            API endpoint usage breakdown by tier
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-red-400 mb-4">{error}</p>
              <Button
                onClick={() => void fetchUsage()}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Retry
              </Button>
            </div>
          ) : !data || data.endpoints.length === 0 ? (
            <p className="text-gray-400 text-center py-8">
              No API usage data found for the selected date range
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">
                      Endpoint
                    </th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">
                      Method
                    </th>
                    <th className="text-right py-3 px-4 text-gray-400 font-medium">
                      FREE Calls
                    </th>
                    <th className="text-right py-3 px-4 text-gray-400 font-medium">
                      PRO Calls
                    </th>
                    <th className="text-right py-3 px-4 text-gray-400 font-medium hidden md:table-cell">
                      Avg Time
                    </th>
                    <th className="text-right py-3 px-4 text-gray-400 font-medium">
                      Error Rate
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.endpoints.map((endpoint, index) => (
                    <tr
                      key={`${endpoint.endpoint}-${endpoint.method}-${index}`}
                      className={`border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors ${
                        endpoint.errorRate > 5 ? 'bg-red-900/10' : ''
                      }`}
                    >
                      <td className="py-3 px-4">
                        <code className="text-sm text-white bg-gray-700 px-2 py-1 rounded">
                          {endpoint.endpoint}
                        </code>
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          className={`${getMethodBadgeClass(endpoint.method)} text-white text-xs`}
                        >
                          {endpoint.method}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="text-gray-300">
                          {endpoint.callsFree.toLocaleString()}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="text-blue-400">
                          {endpoint.callsPro.toLocaleString()}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right hidden md:table-cell">
                        <span className="text-gray-300">
                          {endpoint.avgResponseTime.toFixed(0)}ms
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span
                            className={
                              endpoint.errorRate > 5
                                ? 'text-red-400'
                                : 'text-gray-300'
                            }
                          >
                            {endpoint.errorRate.toFixed(2)}%
                          </span>
                          <Badge
                            className={`${getErrorRateBadge(endpoint.errorRate).className} text-white text-xs`}
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
