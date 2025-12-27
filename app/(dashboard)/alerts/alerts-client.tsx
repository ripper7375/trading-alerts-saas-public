'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { Tier } from '@/lib/tier-config';

import type { AlertWithStatus } from './page';

/**
 * Props for AlertsClient component
 */
interface AlertsClientProps {
  initialAlerts: AlertWithStatus[];
  counts: {
    active: number;
    paused: number;
    triggered: number;
  };
  userTier: Tier;
  limit: number;
}

/**
 * Parse condition JSON safely
 */
function parseCondition(conditionJson: string): {
  type: string;
  targetValue: number;
} | null {
  try {
    return JSON.parse(conditionJson);
  } catch {
    return null;
  }
}

/**
 * Get condition display text
 */
function getConditionDisplay(conditionType: string): string {
  switch (conditionType) {
    case 'price_above':
      return 'Price Above';
    case 'price_below':
      return 'Price Below';
    case 'price_equals':
      return 'Price Equals';
    default:
      return conditionType;
  }
}

/**
 * AlertsClient Component
 *
 * Client-side interactive alerts list with filtering, search, and actions.
 */
export function AlertsClient({
  initialAlerts,
  counts,
  userTier,
  limit,
}: AlertsClientProps): React.JSX.Element {
  const router = useRouter();
  const [alerts, setAlerts] = useState(initialAlerts);
  const [activeTab, setActiveTab] = useState<string>('active');
  const [symbolFilter, setSymbolFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [alertToDelete, setAlertToDelete] = useState<AlertWithStatus | null>(
    null
  );
  const [isDeleting, setIsDeleting] = useState(false);
  // Track which alerts are currently being toggled (pause/resume)
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());

  // Get unique symbols for filter dropdown
  const symbols = useMemo(
    () => Array.from(new Set(alerts.map((a) => a.symbol))),
    [alerts]
  );

  // Filter alerts based on tab, symbol filter, and search
  const filteredAlerts = useMemo(() => {
    return alerts.filter((alert) => {
      // Filter by status tab
      if (activeTab !== 'all' && alert.status !== activeTab) {
        return false;
      }

      // Filter by symbol
      if (symbolFilter !== 'all' && alert.symbol !== symbolFilter) {
        return false;
      }

      // Filter by search query
      if (searchQuery) {
        const search = searchQuery.toLowerCase();
        const name = alert.name?.toLowerCase() || '';
        const symbol = alert.symbol.toLowerCase();
        if (!name.includes(search) && !symbol.includes(search)) {
          return false;
        }
      }

      return true;
    });
  }, [alerts, activeTab, symbolFilter, searchQuery]);

  // Count by status for tabs
  const statusCounts = useMemo(
    () => ({
      active: alerts.filter((a) => a.status === 'active').length,
      paused: alerts.filter((a) => a.status === 'paused').length,
      triggered: alerts.filter((a) => a.status === 'triggered').length,
      all: alerts.length,
    }),
    [alerts]
  );

  // Handle pause/resume alert with loading state
  const handleTogglePause = async (alertId: string): Promise<void> => {
    const alert = alerts.find((a) => a.id === alertId);
    if (!alert) return;

    // Add to toggling set
    setTogglingIds((prev) => new Set(prev).add(alertId));

    try {
      const response = await fetch(`/api/alerts/${alertId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !alert.isActive }),
      });

      if (response.ok) {
        setAlerts((prev) =>
          prev.map((a) =>
            a.id === alertId
              ? {
                  ...a,
                  isActive: !a.isActive,
                  status: a.isActive ? 'paused' : 'active',
                }
              : a
          )
        );
      }
    } catch (error) {
      console.error('Failed to toggle alert:', error);
    } finally {
      // Remove from toggling set
      setTogglingIds((prev) => {
        const next = new Set(prev);
        next.delete(alertId);
        return next;
      });
    }
  };

  // Check if alert is being toggled
  const isToggling = (alertId: string): boolean => togglingIds.has(alertId);

  // Handle delete alert with optimistic update
  const handleDelete = async (): Promise<void> => {
    if (!alertToDelete) return;

    // Store alert for potential rollback
    const deletedAlert = alertToDelete;
    const alertIndex = alerts.findIndex((a) => a.id === deletedAlert.id);

    // Optimistically remove from UI immediately
    setAlerts((prev) => prev.filter((a) => a.id !== deletedAlert.id));
    setDeleteModalOpen(false);
    setAlertToDelete(null);

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/alerts/${deletedAlert.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        // Rollback on failure - restore alert at original position
        setAlerts((prev) => {
          const newAlerts = [...prev];
          newAlerts.splice(alertIndex, 0, deletedAlert);
          return newAlerts;
        });
        console.error('Failed to delete alert: Server error');
      }
    } catch (error) {
      // Rollback on network error - restore alert at original position
      setAlerts((prev) => {
        const newAlerts = [...prev];
        newAlerts.splice(alertIndex, 0, deletedAlert);
        return newAlerts;
      });
      console.error('Failed to delete alert:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  // Open delete confirmation
  const openDeleteModal = (alert: AlertWithStatus): void => {
    setAlertToDelete(alert);
    setDeleteModalOpen(true);
  };

  // Navigate to chart
  const handleViewChart = (symbol: string, timeframe: string): void => {
    router.push(`/charts/${symbol}/${timeframe}`);
  };

  // Render status badge
  const renderStatusBadge = (
    status: 'active' | 'paused' | 'triggered'
  ): React.JSX.Element => {
    const config = {
      active: { label: 'Active', className: 'bg-green-100 text-green-800' },
      paused: { label: 'Paused', className: 'bg-gray-100 text-gray-700' },
      triggered: {
        label: 'Triggered',
        className: 'bg-orange-100 text-orange-800',
      },
    };

    return (
      <Badge
        className={`${config[status].className} hover:${config[status].className}`}
      >
        {status === 'active' && '🟢'} {status === 'paused' && '⏸️'}{' '}
        {status === 'triggered' && '✅'} {config[status].label}
      </Badge>
    );
  };

  // Render alert card
  const renderAlertCard = (alert: AlertWithStatus): React.JSX.Element => {
    const condition = parseCondition(alert.condition);
    const conditionDisplay = condition
      ? getConditionDisplay(condition.type)
      : 'Unknown';
    const targetValue = condition?.targetValue || 0;

    return (
      <Card
        key={alert.id}
        className={`border-l-4 mb-4 hover:shadow-lg transition-shadow ${
          alert.status === 'active'
            ? 'border-l-green-500'
            : alert.status === 'paused'
              ? 'border-l-gray-300'
              : 'border-l-orange-500'
        } ${alert.status === 'paused' ? 'opacity-70' : ''}`}
      >
        <CardContent className="p-6">
          {/* Card Header */}
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900">
                {alert.name || `${alert.symbol} Alert`}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary">{alert.symbol}</Badge>
                <span className="text-sm text-gray-500">{alert.timeframe}</span>
              </div>
            </div>
            {renderStatusBadge(alert.status)}
          </div>

          {/* Condition Info */}
          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-1">{conditionDisplay}</p>
            <p className="text-2xl font-bold text-gray-900">
              $
              {targetValue.toLocaleString('en-US', {
                minimumFractionDigits: 2,
              })}
            </p>
          </div>

          {/* Triggered Info */}
          {alert.status === 'triggered' && alert.lastTriggered && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-gray-700">
                Triggered:{' '}
                {new Date(alert.lastTriggered).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
              <p className="text-xs text-gray-500">
                Trigger count: {alert.triggerCount}
              </p>
            </div>
          )}

          {/* Card Footer */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-gray-200">
            <span className="text-xs text-gray-500">
              Created {new Date(alert.createdAt).toLocaleDateString()}
            </span>

            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => handleViewChart(alert.symbol, alert.timeframe)}
                className="bg-blue-600 hover:bg-blue-700 text-white"
                size="sm"
              >
                View Chart
              </Button>

              {alert.status === 'active' && (
                <Button
                  onClick={() => handleTogglePause(alert.id)}
                  variant="outline"
                  size="sm"
                  disabled={isToggling(alert.id)}
                >
                  {isToggling(alert.id) ? 'Pausing...' : 'Pause'}
                </Button>
              )}

              {alert.status === 'paused' && (
                <Button
                  onClick={() => handleTogglePause(alert.id)}
                  className="bg-green-600 hover:bg-green-700 text-white"
                  size="sm"
                  disabled={isToggling(alert.id)}
                >
                  {isToggling(alert.id) ? 'Resuming...' : 'Resume'}
                </Button>
              )}

              <Button
                onClick={() => openDeleteModal(alert)}
                variant="outline"
                size="sm"
                className="text-red-600 hover:text-red-700 hover:border-red-500"
              >
                Delete
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="mb-4">
          <div className="text-sm text-gray-500 mb-4">
            Dashboard &gt; Alerts
          </div>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">Alerts</h1>
              <p className="text-gray-600">Manage your price alerts</p>
            </div>
            <Link href="/alerts/new">
              <Button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold">
                + Create New Alert
              </Button>
            </Link>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Active Alerts Card */}
          <Card className="border-l-4 border-l-green-500 shadow-md">
            <CardContent className="p-6">
              <div className="text-sm uppercase font-semibold text-gray-600 mb-2">
                Active
              </div>
              <div className="text-4xl font-bold text-green-600 mb-1">
                {counts.active}/{limit}
              </div>
              <div className="text-sm text-gray-500">alerts watching</div>
              {userTier === 'FREE' && counts.active >= limit && (
                <Link
                  href="/pricing"
                  className="text-blue-600 text-sm underline mt-2 block"
                >
                  Upgrade for more alerts
                </Link>
              )}
            </CardContent>
          </Card>

          {/* Paused Alerts Card */}
          <Card className="border-l-4 border-l-gray-300 shadow-md">
            <CardContent className="p-6">
              <div className="text-sm uppercase font-semibold text-gray-600 mb-2">
                Paused
              </div>
              <div className="text-4xl font-bold text-gray-600 mb-1">
                {counts.paused}
              </div>
              <div className="text-sm text-gray-500">temporarily inactive</div>
            </CardContent>
          </Card>

          {/* Triggered Alerts Card */}
          <Card className="border-l-4 border-l-orange-500 shadow-md">
            <CardContent className="p-6">
              <div className="text-sm uppercase font-semibold text-gray-600 mb-2">
                Triggered
              </div>
              <div className="text-4xl font-bold text-orange-600 mb-1">
                {counts.triggered}
              </div>
              <div className="text-sm text-gray-500">recently triggered</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters & Tabs */}
        <div className="bg-white rounded-xl shadow-md p-4 mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Tabs */}
            <div className="flex gap-2">
              {['active', 'paused', 'triggered', 'all'].map((tab) => (
                <Button
                  key={tab}
                  variant={activeTab === tab ? 'default' : 'outline'}
                  onClick={() => setActiveTab(tab)}
                  className={
                    activeTab === tab
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : ''
                  }
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)} (
                  {statusCounts[tab as keyof typeof statusCounts]})
                </Button>
              ))}
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-2">
              <Select value={symbolFilter} onValueChange={setSymbolFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Symbols" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Symbols</SelectItem>
                  {symbols.map((symbol) => (
                    <SelectItem key={symbol} value={symbol}>
                      {symbol}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                type="text"
                placeholder="Search alerts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-[200px] border-2 rounded-lg"
              />
            </div>
          </div>
        </div>

        {/* Alerts List */}
        <div>
          {filteredAlerts.length === 0 ? (
            <Card className="bg-gray-50 border-2 border-dashed border-gray-300">
              <CardContent className="p-16 text-center">
                <h3 className="text-2xl text-gray-500 mb-2">
                  {activeTab === 'all'
                    ? 'No alerts yet'
                    : `No ${activeTab} alerts`}
                </h3>
                <p className="text-gray-400 mb-6">
                  {activeTab === 'all'
                    ? 'Create your first alert to get notified about price movements'
                    : `You don't have any ${activeTab} alerts`}
                </p>
                {activeTab === 'all' && (
                  <Link href="/alerts/new">
                    <Button className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 text-lg">
                      + Create Your First Alert
                    </Button>
                  </Link>
                )}
              </CardContent>
            </Card>
          ) : (
            filteredAlerts.map(renderAlertCard)
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-red-600">
              Delete Alert?
            </DialogTitle>
            <DialogDescription className="text-gray-700 pt-4">
              Are you sure you want to delete the alert &quot;
              {alertToDelete?.name || `${alertToDelete?.symbol} Alert`}&quot;?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              onClick={() => {
                setDeleteModalOpen(false);
                setAlertToDelete(null);
              }}
              variant="outline"
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete Alert'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
