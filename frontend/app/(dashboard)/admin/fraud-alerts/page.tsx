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
import { AlertTriangle, Filter, RefreshCw } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FraudAlertCard } from '@/components/admin/FraudAlertCard';
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
  const { toasts, error: showError, removeToast } = useToast();

  // Fetch alerts from API
  const fetchAlerts = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      // Build query params for server-side filtering
      const params = new URLSearchParams();
      if (filter.severity !== 'ALL') {
        params.set('severity', filter.severity);
      }
      if (filter.status !== 'ALL') {
        params.set('status', filter.status);
      }

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
    } catch (err) {
      console.error('Failed to fetch fraud alerts:', err);
      showError('Failed to load fraud alerts', 'Please try again later.');
    } finally {
      setLoading(false);
    }
  }, [filter.severity, filter.status, showError]);

  // Fetch on mount and when filters change
  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  // Handle refresh button click
  const handleRefresh = (): void => {
    fetchAlerts();
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
        <Button variant="outline" onClick={handleRefresh} disabled={loading}>
          <RefreshCw
            className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`}
          />
          Refresh
        </Button>
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
        <div className="space-y-4">
          {alerts.map((alert) => (
            <FraudAlertCard key={alert.id} alert={alert} />
          ))}
        </div>
      )}

      {/* Toast notifications */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}
