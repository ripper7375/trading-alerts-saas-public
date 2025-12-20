'use client';

/**
 * Fraud Alerts List Page
 *
 * Admin page for viewing and managing fraud alerts:
 * - Lists all fraud alerts
 * - Filter by severity and status
 * - Quick actions for common operations
 *
 * @module app/(dashboard)/admin/fraud-alerts/page
 */

import { useState, useEffect } from 'react';
import { AlertTriangle, Filter, RefreshCw } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FraudAlertCard } from '@/components/admin/FraudAlertCard';
import { FraudPatternBadge } from '@/components/admin/FraudPatternBadge';

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
  country: string;
  paymentMethod: string;
  amount: string;
  currency: string;
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

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MOCK DATA (replace with API call in production)
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const MOCK_ALERTS: FraudAlert[] = [
  {
    id: '1',
    severity: 'CRITICAL',
    pattern: 'Multiple 3-day plan attempts',
    description: 'User attempted to purchase 3-day plan 5 times with different payment methods',
    userId: 'user_123',
    userEmail: 'suspicious@example.com',
    country: 'IN',
    paymentMethod: 'UPI',
    amount: '165.17',
    currency: 'INR',
    createdAt: new Date().toISOString(),
    status: 'PENDING',
  },
  {
    id: '2',
    severity: 'HIGH',
    pattern: 'Velocity limit exceeded',
    description: 'More than 10 payment attempts in 1 hour',
    userId: 'user_456',
    userEmail: 'trader@example.com',
    country: 'NG',
    paymentMethod: 'Bank Transfer',
    amount: '22620',
    currency: 'NGN',
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    status: 'REVIEWED',
  },
  {
    id: '3',
    severity: 'MEDIUM',
    pattern: 'IP mismatch',
    description: 'Payment country (India) does not match IP location (US)',
    userId: 'user_789',
    userEmail: 'global@example.com',
    country: 'IN',
    paymentMethod: 'Paytm',
    amount: '2407.48',
    currency: 'INR',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    status: 'DISMISSED',
  },
];

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMPONENT
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function FraudAlertsPage(): React.ReactElement {
  const [alerts, setAlerts] = useState<FraudAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<{
    severity: SeverityLevel | 'ALL';
    status: AlertStatus | 'ALL';
  }>({
    severity: 'ALL',
    status: 'ALL',
  });

  // Fetch alerts
  useEffect(() => {
    const fetchAlerts = async (): Promise<void> => {
      setLoading(true);
      try {
        // In production, replace with actual API call
        // const res = await fetch('/api/admin/fraud-alerts');
        // const data = await res.json();
        // setAlerts(data.alerts);

        // Using mock data for now
        await new Promise((resolve) => setTimeout(resolve, 500));
        setAlerts(MOCK_ALERTS);
      } catch (error) {
        console.error('Failed to fetch fraud alerts:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAlerts();
  }, []);

  // Calculate stats
  const stats: FraudStats = {
    total: alerts.length,
    critical: alerts.filter((a) => a.severity === 'CRITICAL').length,
    high: alerts.filter((a) => a.severity === 'HIGH').length,
    medium: alerts.filter((a) => a.severity === 'MEDIUM').length,
    low: alerts.filter((a) => a.severity === 'LOW').length,
    pending: alerts.filter((a) => a.status === 'PENDING').length,
  };

  // Filter alerts
  const filteredAlerts = alerts.filter((alert) => {
    if (filter.severity !== 'ALL' && alert.severity !== filter.severity) {
      return false;
    }
    if (filter.status !== 'ALL' && alert.status !== filter.status) {
      return false;
    }
    return true;
  });

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
        <Button
          variant="outline"
          onClick={() => window.location.reload()}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
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
            <div className="text-2xl font-bold text-red-600">{stats.critical}</div>
            <div className="text-sm text-muted-foreground">Critical</div>
          </CardContent>
        </Card>
        <Card className="border-orange-200">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-orange-600">{stats.high}</div>
            <div className="text-sm text-muted-foreground">High</div>
          </CardContent>
        </Card>
        <Card className="border-yellow-200">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-yellow-600">{stats.medium}</div>
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
            <div className="text-2xl font-bold text-orange-600">{stats.pending}</div>
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
                setFilter({ ...filter, severity: e.target.value as SeverityLevel | 'ALL' })
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
                setFilter({ ...filter, status: e.target.value as AlertStatus | 'ALL' })
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
      ) : filteredAlerts.length === 0 ? (
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
          {filteredAlerts.map((alert) => (
            <FraudAlertCard key={alert.id} alert={alert} />
          ))}
        </div>
      )}
    </div>
  );
}
