'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useToast } from '@/hooks/use-toast';
import { ToastContainer } from '@/components/ui/toast-container';
import {
  Shield,
  ArrowLeft,
  RefreshCw,
  KeyRound,
  Mail,
  ShieldCheck,
  ShieldOff,
  AlertTriangle,
  Lock,
  MapPin,
  Check,
  Loader2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

/**
 * Security Activity Page (Row 80, `/settings/security/activity`)
 *
 * Full paginated view of `SecurityAlert` rows for the authenticated user,
 * bound to the real GET /api/user/security-alerts (+ /[id]/read) routes.
 */

type SecurityAlertType =
  | 'NEW_DEVICE_LOGIN'
  | 'PASSWORD_CHANGED'
  | 'EMAIL_CHANGED'
  | 'TWO_FACTOR_ENABLED'
  | 'TWO_FACTOR_DISABLED'
  | 'SUSPICIOUS_LOGIN'
  | 'ACCOUNT_LOCKED';

interface SecurityAlertItem {
  id: string;
  type: SecurityAlertType;
  title: string;
  message: string;
  ipAddress: string | null;
  deviceInfo: string | null;
  location: string | null;
  read: boolean;
  readAt: string | null;
  createdAt: string;
}

interface Pagination {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

const PAGE_SIZE = 20;

const TYPE_META: Record<
  SecurityAlertType,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badgeClass: string;
  }
> = {
  NEW_DEVICE_LOGIN: {
    label: 'New Device Login',
    icon: Shield,
    badgeClass:
      'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  },
  PASSWORD_CHANGED: {
    label: 'Password Changed',
    icon: KeyRound,
    badgeClass:
      'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  },
  EMAIL_CHANGED: {
    label: 'Email Changed',
    icon: Mail,
    badgeClass:
      'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  },
  TWO_FACTOR_ENABLED: {
    label: '2FA Enabled',
    icon: ShieldCheck,
    badgeClass:
      'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  },
  TWO_FACTOR_DISABLED: {
    label: '2FA Disabled',
    icon: ShieldOff,
    badgeClass:
      'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  },
  SUSPICIOUS_LOGIN: {
    label: 'Suspicious Login',
    icon: AlertTriangle,
    badgeClass: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  },
  ACCOUNT_LOCKED: {
    label: 'Account Locked',
    icon: Lock,
    badgeClass: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  },
};

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60)
    return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
  if (diffHours < 24)
    return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

export default function SecurityActivityPage(): React.ReactElement {
  useSession();
  const { toasts, removeToast, error: showError } = useToast();

  const [alerts, setAlerts] = useState<SecurityAlertItem[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [markingReadId, setMarkingReadId] = useState<string | null>(null);

  const fetchAlerts = useCallback(async (offset: number, append: boolean) => {
    if (append) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
    }
    setLoadError(null);
    try {
      const response = await fetch(
        `/api/user/security-alerts?limit=${PAGE_SIZE}&offset=${offset}`
      );
      if (!response.ok) {
        throw new Error('Failed to load security activity');
      }
      const data = await response.json();
      setAlerts((prev) =>
        append ? [...prev, ...(data.alerts || [])] : data.alerts || []
      );
      setPagination(data.pagination || null);
    } catch (err) {
      console.error('Error fetching security alerts:', err);
      setLoadError('Failed to load security activity');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts(0, false);
  }, [fetchAlerts]);

  const handleLoadMore = () => {
    if (!pagination?.hasMore) return;
    fetchAlerts(pagination.offset + pagination.limit, true);
  };

  const handleMarkRead = async (id: string) => {
    setMarkingReadId(id);
    try {
      const response = await fetch(`/api/user/security-alerts/${id}/read`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('Failed to mark as read');
      }
      setAlerts((prev) =>
        prev.map((a) =>
          a.id === id
            ? { ...a, read: true, readAt: new Date().toISOString() }
            : a
        )
      );
    } catch (err) {
      console.error('Error marking security alert read:', err);
      showError('Failed to mark alert as read');
    } finally {
      setMarkingReadId(null);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/settings/security"
          className="mb-2 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Security Settings
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
              <Shield className="h-6 w-6" />
              Security Activity
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              A full record of security events on your account: password
              changes, two-factor changes, and device/login alerts.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchAlerts(0, false)}
            disabled={isLoading}
          >
            <RefreshCw
              className={`mr-1 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`}
            />
            Refresh
          </Button>
        </div>
      </div>

      {loadError && (
        <Card className="mb-4 border-red-200 dark:border-red-900">
          <CardContent className="flex items-center gap-2 p-4 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            <span>{loadError}</span>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {isLoading ? (
          <>
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 animate-pulse rounded-full bg-muted" />
                    <div className="flex-1">
                      <div className="mb-2 h-4 w-48 animate-pulse rounded bg-muted" />
                      <div className="h-3 w-32 animate-pulse rounded bg-muted" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </>
        ) : alerts.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Shield className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground">No security activity yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Security events for your account will appear here
              </p>
            </CardContent>
          </Card>
        ) : (
          alerts.map((alert) => {
            const meta = TYPE_META[alert.type];
            const Icon = meta?.icon ?? Shield;
            return (
              <Card
                key={alert.id}
                className={
                  alert.read
                    ? undefined
                    : 'border-blue-200 dark:border-blue-900'
                }
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-muted">
                      <Icon className="h-5 w-5 text-muted-foreground" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-foreground">
                          {alert.title}
                        </span>
                        <Badge className={meta?.badgeClass}>
                          {meta?.label ?? alert.type}
                        </Badge>
                        {!alert.read && (
                          <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                            New
                          </Badge>
                        )}
                      </div>

                      <p className="mt-1 text-sm text-muted-foreground">
                        {alert.message}
                      </p>

                      <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                        {alert.deviceInfo && <span>{alert.deviceInfo}</span>}
                        {alert.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {alert.location}
                          </span>
                        )}
                        {alert.ipAddress && <span>{alert.ipAddress}</span>}
                        <span>{formatRelativeTime(alert.createdAt)}</span>
                      </div>
                    </div>

                    {!alert.read && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleMarkRead(alert.id)}
                        disabled={markingReadId === alert.id}
                      >
                        {markingReadId === alert.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Check className="mr-1 h-4 w-4" />
                            Mark read
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {pagination && alerts.length > 0 && (
        <div className="mt-4 text-center">
          {pagination.hasMore ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleLoadMore}
              disabled={isLoadingMore}
            >
              {isLoadingMore ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : null}
              Load more
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">
              Showing all {pagination.total} security events
            </p>
          )}
        </div>
      )}

      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}
