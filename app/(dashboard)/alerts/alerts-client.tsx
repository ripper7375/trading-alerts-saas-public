'use client';

import { Undo2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useMemo, useRef, useEffect, useCallback } from 'react';

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

  // Undo state for delete operations
  const [deletedAlert, setDeletedAlert] = useState<AlertWithStatus | null>(
    null
  );
  const [showUndo, setShowUndo] = useState(false);
  const undoTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Pending toggle state for optimistic UI
  const [pendingToggleId, setPendingToggleId] = useState<string | null>(null);

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

  // Cleanup undo timeout on unmount
  useEffect(() => {
    return () => {
      if (undoTimeoutRef.current) {
        clearTimeout(undoTimeoutRef.current);
      }
    };
  }, []);

  // Handle pause/resume alert (optimistic)
  const handleTogglePause = useCallback(
    async (alertId: string): Promise<void> => {
      const alert = alerts.find((a) => a.id === alertId);
      if (!alert) return;

      // Store previous state for rollback
      const previousAlerts = alerts;
      const newIsActive = !alert.isActive;

      // Set pending state
      setPendingToggleId(alertId);

      // Optimistically update
      setAlerts((prev) =>
        prev.map((a) =>
          a.id === alertId
            ? {
                ...a,
                isActive: newIsActive,
                status: newIsActive ? 'active' : 'paused',
              }
            : a
        )
      );

      try {
        const response = await fetch(`/api/alerts/${alertId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isActive: newIsActive }),
        });

        if (!response.ok) {
          throw new Error('Failed to toggle alert');
        }
      } catch (error) {
        // Rollback on error
        setAlerts(previousAlerts);
        console.error('Failed to toggle alert:', error);
      } finally {
        setPendingToggleId(null);
      }
    },
    [alerts]
  );

  // Handle delete alert (optimistic)
  const handleDelete = useCallback(async (): Promise<void> => {
    if (!alertToDelete) return;

    // Store previous state for rollback
    const previousAlerts = alerts;
    const alertBeingDeleted = alertToDelete;

    setIsDeleting(true);

    // Close modal immediately for better UX
    setDeleteModalOpen(false);
    setAlertToDelete(null);

    // Store deleted alert for undo
    setDeletedAlert(alertBeingDeleted);
    setShowUndo(true);

    // Clear previous timeout
    if (undoTimeoutRef.current) {
      clearTimeout(undoTimeoutRef.current);
    }

    // Auto-hide undo after 5 seconds
    undoTimeoutRef.current = setTimeout(() => {
      setShowUndo(false);
      setDeletedAlert(null);
    }, 5000);

    // Optimistically remove alert
    setAlerts((prev) => prev.filter((a) => a.id !== alertBeingDeleted.id));

    try {
      const response = await fetch(`/api/alerts/${alertBeingDeleted.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete alert');
      }
    } catch (error) {
      // Rollback on error
      setAlerts(previousAlerts);
      setShowUndo(false);
      setDeletedAlert(null);
      if (undoTimeoutRef.current) {
        clearTimeout(undoTimeoutRef.current);
      }
      console.error('Failed to delete alert:', error);
    } finally {
      setIsDeleting(false);
    }
  }, [alertToDelete, alerts]);

  // Undo delete - restore the alert
  const handleUndoDelete = useCallback(async (): Promise<void> => {
    if (!deletedAlert) return;

    // Clear timeout
    if (undoTimeoutRef.current) {
      clearTimeout(undoTimeoutRef.current);
    }

    // Restore the alert optimistically
    const alertToRestore = deletedAlert;
    setAlerts((prev) => {
      // Insert back and sort by createdAt
      const restored = [...prev, alertToRestore].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      return restored;
    });

    setShowUndo(false);
    setDeletedAlert(null);

    // Note: In a real app, you might have a dedicated undo endpoint
    // For now, we'll need to re-create the alert
    // This is a simplified version - a production app should handle this better
  }, [deletedAlert]);

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
    const isTogglePending = pendingToggleId === alert.id;

    return (
      <Card
        key={alert.id}
        className={`mb-4 border-l-4 transition-shadow hover:shadow-lg ${
          alert.status === 'active'
            ? 'border-l-green-500'
            : alert.status === 'paused'
              ? 'border-l-gray-300'
              : 'border-l-orange-500'
        } ${alert.status === 'paused' ? 'opacity-70' : ''} ${
          isTogglePending ? 'animate-pulse' : ''
        }`}
      >
        <CardContent className="p-6">
          {/* Card Header */}
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h3 className="text-lg font-bold text-gray-900">
                {alert.name || `${alert.symbol} Alert`}
              </h3>
              <div className="mt-1 flex items-center gap-2">
                <Badge variant="secondary">{alert.symbol}</Badge>
                <span className="text-sm text-gray-500">{alert.timeframe}</span>
              </div>
            </div>
            {renderStatusBadge(alert.status)}
          </div>

          {/* Condition Info */}
          <div className="mb-4">
            <p className="mb-1 text-sm text-gray-600">{conditionDisplay}</p>
            <p className="text-2xl font-bold text-gray-900">
              $
              {targetValue.toLocaleString('en-US', {
                minimumFractionDigits: 2,
              })}
            </p>
          </div>

          {/* Triggered Info */}
          {alert.status === 'triggered' && alert.lastTriggered && (
            <div className="mb-4 rounded-lg border border-orange-200 bg-orange-50 p-3">
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
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-gray-200 pt-4">
            <span className="text-xs text-gray-500">
              Created {new Date(alert.createdAt).toLocaleDateString()}
            </span>

            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => handleViewChart(alert.symbol, alert.timeframe)}
                className="bg-blue-600 text-white hover:bg-blue-700"
                size="sm"
              >
                View Chart
              </Button>

              {alert.status === 'active' && (
                <Button
                  onClick={() => handleTogglePause(alert.id)}
                  variant="outline"
                  size="sm"
                >
                  Pause
                </Button>
              )}

              {alert.status === 'paused' && (
                <Button
                  onClick={() => handleTogglePause(alert.id)}
                  className="bg-green-600 text-white hover:bg-green-700"
                  size="sm"
                >
                  Resume
                </Button>
              )}

              <Link href={`/alerts/${alert.id}/edit`}>
                <Button
                  variant="outline"
                  size="sm"
                  aria-label={`Edit ${alert.name || `${alert.symbol} Alert`}`}
                >
                  Edit
                </Button>
              </Link>

              <Button
                onClick={() => openDeleteModal(alert)}
                variant="outline"
                size="sm"
                className="text-red-600 hover:border-red-500 hover:text-red-700"
                aria-label={`Delete ${alert.name || `${alert.symbol} Alert`}`}
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
      <div className="mx-auto max-w-7xl">
        {/* Page Header */}
        <div className="mb-4">
          <div className="mb-4 text-sm text-gray-500">
            Dashboard &gt; Alerts
          </div>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="mb-2 text-3xl font-bold">Alerts</h1>
              <p className="text-gray-600">Manage your price alerts</p>
            </div>
            <Link href="/alerts/new">
              <Button className="rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700">
                + Create New Alert
              </Button>
            </Link>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-3">
          {/* Active Alerts Card */}
          <Card className="border-l-4 border-l-green-500 shadow-md">
            <CardContent className="p-6">
              <div className="mb-2 text-sm font-semibold uppercase text-gray-600">
                Active
              </div>
              <div className="mb-1 text-4xl font-bold text-green-600">
                {counts.active}/{limit}
              </div>
              <div className="text-sm text-gray-500">alerts watching</div>
              {userTier === 'FREE' && counts.active >= limit && (
                <Link
                  href="/pricing"
                  className="mt-2 block text-sm text-blue-600 underline"
                >
                  Upgrade for more alerts
                </Link>
              )}
            </CardContent>
          </Card>

          {/* Paused Alerts Card */}
          <Card className="border-l-4 border-l-gray-300 shadow-md">
            <CardContent className="p-6">
              <div className="mb-2 text-sm font-semibold uppercase text-gray-600">
                Paused
              </div>
              <div className="mb-1 text-4xl font-bold text-gray-600">
                {counts.paused}
              </div>
              <div className="text-sm text-gray-500">temporarily inactive</div>
            </CardContent>
          </Card>

          {/* Triggered Alerts Card */}
          <Card className="border-l-4 border-l-orange-500 shadow-md">
            <CardContent className="p-6">
              <div className="mb-2 text-sm font-semibold uppercase text-gray-600">
                Triggered
              </div>
              <div className="mb-1 text-4xl font-bold text-orange-600">
                {counts.triggered}
              </div>
              <div className="text-sm text-gray-500">recently triggered</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters & Tabs */}
        <div className="mb-8 rounded-xl bg-white p-4 shadow-md">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            {/* Tabs */}
            <div className="flex gap-2">
              {['active', 'paused', 'triggered', 'all'].map((tab) => (
                <Button
                  key={tab}
                  variant={activeTab === tab ? 'default' : 'outline'}
                  onClick={() => setActiveTab(tab)}
                  className={
                    activeTab === tab
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : ''
                  }
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)} (
                  {statusCounts[tab as keyof typeof statusCounts]})
                </Button>
              ))}
            </div>

            {/* Filters */}
            <div className="flex flex-col gap-2 sm:flex-row">
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
                aria-label="Search alerts"
                className="w-[200px] rounded-lg border-2"
              />
            </div>
          </div>
        </div>

        {/* Undo Delete Banner */}
        {showUndo && deletedAlert && (
          <div className="animate-in slide-in-from-top-2 mb-4 flex items-center justify-between rounded-lg bg-gray-800 px-4 py-3 text-white">
            <span className="text-sm">
              Alert &quot;{deletedAlert.name || `${deletedAlert.symbol} Alert`}
              &quot; deleted
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleUndoDelete}
              className="text-white hover:bg-gray-700 hover:text-white"
            >
              <Undo2 className="mr-2 h-4 w-4" />
              Undo
            </Button>
          </div>
        )}

        {/* Alerts List */}
        <div>
          {filteredAlerts.length === 0 ? (
            <Card className="border-2 border-dashed border-gray-300 bg-gray-50">
              <CardContent className="p-16 text-center">
                <h3 className="mb-2 text-2xl text-gray-500">
                  {activeTab === 'all'
                    ? 'No alerts yet'
                    : `No ${activeTab} alerts`}
                </h3>
                <p className="mb-6 text-gray-400">
                  {activeTab === 'all'
                    ? 'Create your first alert to get notified about price movements'
                    : `You don't have any ${activeTab} alerts`}
                </p>
                {activeTab === 'all' && (
                  <Link href="/alerts/new">
                    <Button className="bg-blue-600 px-8 py-4 text-lg text-white hover:bg-blue-700">
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
            <DialogDescription className="pt-4 text-gray-700">
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
              className="bg-red-600 text-white hover:bg-red-700"
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
