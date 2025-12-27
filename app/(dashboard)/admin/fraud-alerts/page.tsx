'use client';

/**
 * Fraud Alerts List Page
 *
 * Admin page for viewing and managing fraud alerts:
 * - Lists all fraud alerts from internal fraud detection system
 * - Filter by severity and status
 * - Quick actions for common operations
 *
 * @module app/(dashboard)/admin/fraud-alerts/page
 */

import { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  Filter,
  RefreshCw,
  Download,
  CheckSquare,
  XSquare,
  Trash2,
} from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { FraudAlertCard } from '@/components/admin/FraudAlertCard';
import { StandardPagination } from '@/components/ui/pagination';
import { useToast } from '@/hooks/use-toast';
import { ToastContainer } from '@/components/ui/toast-container';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

type SeverityLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
type AlertStatus = 'PENDING' | 'REVIEWED' | 'DISMISSED' | 'BLOCKED';

interface FraudAlert {
  id: string;
  severity: SeverityLevel;
  pattern: string;
  description: string;
  userId: string;
  userEmail: string;
  country: string | null;
  paymentMethod: string | null;
  amount: string | null;
  currency: string | null;
  createdAt: string;
  status: AlertStatus;
}

interface FraudStats {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  pending: number;
}

interface FraudAlertsResponse {
  alerts: FraudAlert[];
  stats: FraudStats;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMPONENT
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function FraudAlertsPage(): React.ReactElement {
  const [alerts, setAlerts] = useState<FraudAlert[]>([]);
  const [stats, setStats] = useState<FraudStats>({
    total: 0,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    pending: 0,
  });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<{
    severity: SeverityLevel | 'ALL';
    status: AlertStatus | 'ALL';
  }>({
    severity: 'ALL',
    status: 'ALL',
  });

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize] = useState(10);

  // Bulk selection state
  const [selectedAlerts, setSelectedAlerts] = useState<Set<string>>(new Set());
  const [isBulkActionLoading, setIsBulkActionLoading] = useState(false);

  const { toasts, error: showError, success, removeToast } = useToast();

  // Fetch alerts from API
  const fetchAlerts = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      // Build query params for server-side filtering and pagination
      const params = new URLSearchParams();
      if (filter.severity !== 'ALL') {
        params.set('severity', filter.severity);
      }
      if (filter.status !== 'ALL') {
        params.set('status', filter.status);
      }
      params.set('page', String(currentPage));
      params.set('pageSize', String(pageSize));

      const res = await fetch(`/api/admin/fraud-alerts?${params.toString()}`);

      if (!res.ok) {
        if (res.status === 401) {
          showError('Unauthorized', 'Please log in to view fraud alerts.');
          return;
        }
        if (res.status === 403) {
          showError(
            'Access Denied',
            'You do not have permission to view fraud alerts.'
          );
          return;
        }
        throw new Error('Failed to fetch fraud alerts');
      }

      const data: FraudAlertsResponse = await res.json();
      setAlerts(data.alerts);
      setStats(data.stats);
      setTotalPages(data.pagination?.totalPages || 1);
      // Clear selection when data changes
      setSelectedAlerts(new Set());
    } catch (err) {
      console.error('Failed to fetch fraud alerts:', err);
      showError('Failed to load fraud alerts', 'Please try again later.');
    } finally {
      setLoading(false);
    }
  }, [filter.severity, filter.status, currentPage, pageSize, showError]);

  // Fetch on mount and when filters change
  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  // Handle refresh button click
  const handleRefresh = (): void => {
    fetchAlerts();
  };

  // Handle page change
  const handlePageChange = (page: number): void => {
    setCurrentPage(page);
  };

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filter.severity, filter.status]);

  // Toggle single alert selection
  const toggleAlertSelection = (alertId: string): void => {
    setSelectedAlerts((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(alertId)) {
        newSet.delete(alertId);
      } else {
        newSet.add(alertId);
      }
      return newSet;
    });
  };

  // Select all alerts on current page
  const selectAllAlerts = (): void => {
    if (selectedAlerts.size === alerts.length) {
      setSelectedAlerts(new Set());
    } else {
      setSelectedAlerts(new Set(alerts.map((a) => a.id)));
    }
  };

  // Export to CSV
  const handleExportCSV = (): void => {
    if (alerts.length === 0) {
      showError('No data to export', 'There are no alerts to export.');
      return;
    }

    // Define CSV headers
    const headers = [
      'ID',
      'Severity',
      'Pattern',
      'Description',
      'User ID',
      'User Email',
      'Country',
      'Payment Method',
      'Amount',
      'Currency',
      'Status',
      'Created At',
    ];

    // Map alerts to CSV rows
    const rows = alerts.map((alert) => [
      alert.id,
      alert.severity,
      alert.pattern,
      `"${alert.description.replace(/"/g, '""')}"`,
      alert.userId,
      alert.userEmail,
      alert.country || '',
      alert.paymentMethod || '',
      alert.amount || '',
      alert.currency || '',
      alert.status,
      alert.createdAt,
    ]);

    // Create CSV content
    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.join(',')),
    ].join('\n');

    // Download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `fraud-alerts-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);

    success('Export Complete', `Exported ${alerts.length} alerts to CSV.`);
  };

  // Bulk action handler
  const handleBulkAction = async (
    action: 'review' | 'dismiss' | 'delete'
  ): Promise<void> => {
    if (selectedAlerts.size === 0) {
      showError('No alerts selected', 'Please select at least one alert.');
      return;
    }

    const actionLabel = action === 'review' ? 'reviewed' : action === 'dismiss' ? 'dismissed' : 'deleted';

    setIsBulkActionLoading(true);
    try {
      const res = await fetch('/api/admin/fraud-alerts/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          alertIds: Array.from(selectedAlerts),
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to perform bulk action');
      }

      const result = await res.json();
      success(
        'Bulk Action Complete',
        `${result.updated || selectedAlerts.size} alerts ${actionLabel}.`
      );
      setSelectedAlerts(new Set());
      fetchAlerts();
    } catch (err) {
      console.error('Bulk action failed:', err);
      showError('Bulk action failed', 'Please try again later.');
    } finally {
      setIsBulkActionLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Fraud Alerts</h1>
          <p className="text-muted-foreground">
            Monitor and manage suspicious payment activities
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportCSV} disabled={loading}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button variant="outline" onClick={handleRefresh} disabled={loading}>
            <RefreshCw
              className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`}
            />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-sm text-muted-foreground">Total</div>
          </CardContent>
        </Card>
        <Card className="border-red-200">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-red-600">
              {stats.critical}
            </div>
            <div className="text-sm text-muted-foreground">Critical</div>
          </CardContent>
        </Card>
        <Card className="border-orange-200">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-orange-600">
              {stats.high}
            </div>
            <div className="text-sm text-muted-foreground">High</div>
          </CardContent>
        </Card>
        <Card className="border-yellow-200">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-yellow-600">
              {stats.medium}
            </div>
            <div className="text-sm text-muted-foreground">Medium</div>
          </CardContent>
        </Card>
        <Card className="border-blue-200">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.low}</div>
            <div className="text-sm text-muted-foreground">Low</div>
          </CardContent>
        </Card>
        <Card className="border-orange-200">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-orange-600">
              {stats.pending}
            </div>
            <div className="text-sm text-muted-foreground">Pending</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="flex flex-wrap items-center gap-4 p-4">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Severity:</span>
            <select
              value={filter.severity}
              onChange={(e) =>
                setFilter({
                  ...filter,
                  severity: e.target.value as SeverityLevel | 'ALL',
                })
              }
              className="rounded border p-1 text-sm"
            >
              <option value="ALL">All</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Status:</span>
            <select
              value={filter.status}
              onChange={(e) =>
                setFilter({
                  ...filter,
                  status: e.target.value as AlertStatus | 'ALL',
                })
              }
              className="rounded border p-1 text-sm"
            >
              <option value="ALL">All</option>
              <option value="PENDING">Pending</option>
              <option value="REVIEWED">Reviewed</option>
              <option value="DISMISSED">Dismissed</option>
              <option value="BLOCKED">Blocked</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions Bar */}
      {alerts.length > 0 && (
        <Card className="mb-6">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
            <div className="flex items-center gap-4">
              <Checkbox
                checked={selectedAlerts.size === alerts.length && alerts.length > 0}
                onCheckedChange={selectAllAlerts}
                aria-label="Select all alerts"
              />
              <span className="text-sm text-muted-foreground">
                {selectedAlerts.size > 0
                  ? `${selectedAlerts.size} alert${selectedAlerts.size > 1 ? 's' : ''} selected`
                  : 'Select alerts for bulk actions'}
              </span>
            </div>
            {selectedAlerts.size > 0 && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkAction('review')}
                  disabled={isBulkActionLoading}
                >
                  <CheckSquare className="mr-2 h-4 w-4" />
                  Mark Reviewed
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkAction('dismiss')}
                  disabled={isBulkActionLoading}
                >
                  <XSquare className="mr-2 h-4 w-4" />
                  Dismiss
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleBulkAction('delete')}
                  disabled={isBulkActionLoading}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Alerts list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent" />
            <p className="text-muted-foreground">Loading alerts...</p>
          </div>
        </div>
      ) : alerts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="text-lg font-medium">No alerts found</h3>
            <p className="text-muted-foreground">
              {filter.severity !== 'ALL' || filter.status !== 'ALL'
                ? 'Try adjusting your filters'
                : 'No fraud alerts to review'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-4">
            {alerts.map((alert) => (
              <div key={alert.id} className="flex items-start gap-3">
                <Checkbox
                  checked={selectedAlerts.has(alert.id)}
                  onCheckedChange={() => toggleAlertSelection(alert.id)}
                  className="mt-4"
                  aria-label={`Select alert ${alert.id}`}
                />
                <div className="flex-1">
                  <FraudAlertCard alert={alert} />
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-6">
              <StandardPagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
                disabled={loading}
              />
            </div>
          )}
        </>
      )}

      {/* Toast notifications */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}
