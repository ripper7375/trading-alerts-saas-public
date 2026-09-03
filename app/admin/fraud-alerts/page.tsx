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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FraudAlertCard } from '@/components/admin/FraudAlertCard';
import { useToast } from '@/hooks/use-toast';
import { ToastContainer } from '@/components/ui/toast-container';
import { useLocale } from '@/lib/context/locale-context';

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
  const { t } = useLocale();
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
          showError(
            t('admin.fraud.unauthorized', 'Unauthorized'),
            t(
              'admin.fraud.error_login_required',
              'Please log in to view fraud alerts.'
            )
          );
          return;
        }
        if (res.status === 403) {
          showError(
            t('admin.fraud.access_denied', 'Access Denied'),
            t(
              'admin.fraud.error_no_permission',
              'You do not have permission to view fraud alerts.'
            )
          );
          return;
        }
        throw new Error(
          t('admin.fraud.error_fetch_alerts', 'Failed to fetch fraud alerts')
        );
      }

      const data: FraudAlertsResponse = await res.json();
      setAlerts(data.alerts);
      setStats(data.stats);
    } catch (err) {
      console.error('Failed to fetch fraud alerts:', err);
      showError(
        t('admin.fraud.error_load_alerts', 'Failed to load fraud alerts'),
        t('admin.fraud.error_try_again_later', 'Please try again later.')
      );
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
            {t('admin.fraud.page_title', 'Fraud Alerts')}
          </h1>
          <p className="text-muted-foreground">
            {t(
              'admin.fraud.page_subtitle',
              'Monitor and manage suspicious payment activities'
            )}
          </p>
        </div>
        <Button variant="outline" onClick={handleRefresh} disabled={loading}>
          <RefreshCw
            className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`}
          />
          {t('Refresh', 'Refresh')}
        </Button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
        <Card className="border-border bg-card">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-foreground">
              {stats.total}
            </div>
            <div className="text-sm text-muted-foreground">
              {t('admin.fraud.total', 'Total')}
            </div>
          </CardContent>
        </Card>
        <Card className="border-red-500/30 bg-card">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-red-500">
              {stats.critical}
            </div>
            <div className="text-sm text-muted-foreground">
              {t('admin.fraud.critical', 'Critical')}
            </div>
          </CardContent>
        </Card>
        <Card className="border-orange-500/30 bg-card">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-orange-500">
              {stats.high}
            </div>
            <div className="text-sm text-muted-foreground">
              {t('admin.fraud.high', 'High')}
            </div>
          </CardContent>
        </Card>
        <Card className="border-yellow-500/30 bg-card">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-yellow-500">
              {stats.medium}
            </div>
            <div className="text-sm text-muted-foreground">
              {t('admin.fraud.medium', 'Medium')}
            </div>
          </CardContent>
        </Card>
        <Card className="border-blue-500/30 bg-card">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-500">{stats.low}</div>
            <div className="text-sm text-muted-foreground">
              {t('admin.fraud.low', 'Low')}
            </div>
          </CardContent>
        </Card>
        <Card className="border-orange-500/30 bg-card">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-orange-500">
              {stats.pending}
            </div>
            <div className="text-sm text-muted-foreground">
              {t('admin.fraud.pending', 'Pending')}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border-border bg-card">
        <CardContent className="flex flex-wrap items-center gap-4 p-4">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">
              {t('admin.fraud.severity_label', 'Severity:')}
            </span>
            <Select
              value={filter.severity}
              onValueChange={(value) =>
                setFilter({
                  ...filter,
                  severity: value as SeverityLevel | 'ALL',
                })
              }
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">
                  {t('admin.fraud.all', 'All')}
                </SelectItem>
                <SelectItem value="CRITICAL">
                  {t('admin.fraud.critical', 'Critical')}
                </SelectItem>
                <SelectItem value="HIGH">
                  {t('admin.fraud.high', 'High')}
                </SelectItem>
                <SelectItem value="MEDIUM">
                  {t('admin.fraud.medium', 'Medium')}
                </SelectItem>
                <SelectItem value="LOW">
                  {t('admin.fraud.low', 'Low')}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">
              {t('admin.fraud.status_label', 'Status:')}
            </span>
            <Select
              value={filter.status}
              onValueChange={(value) =>
                setFilter({
                  ...filter,
                  status: value as AlertStatus | 'ALL',
                })
              }
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">
                  {t('admin.fraud.all', 'All')}
                </SelectItem>
                <SelectItem value="PENDING">
                  {t('admin.fraud.status_pending', 'Pending')}
                </SelectItem>
                <SelectItem value="REVIEWED">
                  {t('admin.fraud.status_reviewed', 'Reviewed')}
                </SelectItem>
                <SelectItem value="DISMISSED">
                  {t('admin.fraud.status_dismissed', 'Dismissed')}
                </SelectItem>
                <SelectItem value="BLOCKED">
                  {t('admin.fraud.status_blocked', 'Blocked')}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Alerts list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
        </div>
      ) : alerts.length === 0 ? (
        <Card className="border-border bg-card">
          <CardContent className="py-12 text-center">
            <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="text-lg font-medium text-foreground">
              {t('admin.fraud.no_alerts_found', 'No alerts found')}
            </h3>
            <p className="text-muted-foreground">
              {filter.severity !== 'ALL' || filter.status !== 'ALL'
                ? t(
                    'admin.fraud.try_adjusting_filters',
                    'Try adjusting your filters'
                  )
                : t(
                    'admin.fraud.no_alerts_to_review',
                    'No fraud alerts to review'
                  )}
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
