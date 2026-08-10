'use client';

import {
  Bell,
  AlertTriangle,
  Info,
  CreditCard,
  AlertCircle,
  Trash2,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
  Undo2,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useState, useEffect, useCallback, useRef } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useOptimisticMutation } from '@/hooks/use-optimistic-mutation';
import {
  useRealtimeSocket,
  type RealtimeNotification,
} from '@/hooks/use-realtime-socket';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface Notification {
  id: string;
  type: 'ALERT' | 'SUBSCRIPTION' | 'PAYMENT' | 'SYSTEM';
  title: string;
  body: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  read: boolean;
  readAt: string | null;
  link: string | null;
  createdAt: string;
}

interface NotificationsResponse {
  notifications: Notification[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  unreadCount: number;
}

type StatusFilter = 'all' | 'unread' | 'read';
type TypeFilter = 'ALERT' | 'SUBSCRIPTION' | 'PAYMENT' | 'SYSTEM' | undefined;

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// NOTIFICATION LIST COMPONENT
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Full notification list page component
 *
 * Features:
 * - Tabs: All / Unread / Read
 * - Filter by type (Alert / Subscription / Payment / System)
 * - Pagination (20 per page)
 * - Delete button for each notification
 * - Mark as read on click
 * - Mark all as read button
 */
export function NotificationList(): React.JSX.Element {
  const router = useRouter();
  const { data: session } = useSession();
  const isPro = session?.user?.tier === 'PRO';
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>(undefined);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Undo state for delete operations
  const [deletedNotification, setDeletedNotification] =
    useState<Notification | null>(null);
  const [showUndo, setShowUndo] = useState(false);
  const undoTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Screen-reader announcement for a realtime-pushed notification (A11y
  // Standards rule: "screen reader announcements for new notifications").
  const [liveAnnouncement, setLiveAnnouncement] = useState('');

  const PAGE_SIZE = 20;

  // Fetch notifications from API
  const fetchNotifications = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams({
        status: statusFilter,
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });

      if (typeFilter) {
        params.set('type', typeFilter);
      }

      const response = await fetch(`/api/notifications?${params.toString()}`);

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error('Failed to fetch notifications');
      }

      const data: NotificationsResponse = await response.json();
      setNotifications(data.notifications);
      setTotal(data.total);
      setTotalPages(data.totalPages);
      setUnreadCount(data.unreadCount);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to load notifications'
      );
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, typeFilter, page, router]);

  // Fetch on mount and when filters change
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Reset page when filter changes
  useEffect(() => {
    setPage(1);
  }, [statusFilter, typeFilter]);

  // Live list update (F8, Session 4B-17/4B-18) — mirrors notification-bell.tsx's
  // own wiring exactly: re-fetch on push rather than merging the pushed payload
  // into state directly, so the list/pagination/unreadCount stay single-sourced
  // from the server's own filtering, pagination, and read-state logic.
  useRealtimeSocket({
    onNotification: (notification: RealtimeNotification) => {
      setLiveAnnouncement(`New notification: ${notification.title}`);
      fetchNotifications();
    },
  });

  // Clear undo timeout on unmount
  useEffect(() => {
    return () => {
      if (undoTimeoutRef.current) {
        clearTimeout(undoTimeoutRef.current);
      }
    };
  }, []);

  // Optimistic mark as read mutation
  const markAsReadMutation = useOptimisticMutation<void, string>({
    mutationFn: async (id) => {
      const response = await fetch(`/api/notifications/${id}/read`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('Failed to mark as read');
      }
    },
    onMutate: (id) => {
      // Store previous state
      const previousNotifications = notifications;
      const previousUnreadCount = unreadCount;
      const notification = notifications.find((n) => n.id === id);
      const wasUnread = notification && !notification.read;

      // Optimistically update
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id
            ? { ...n, read: true, readAt: new Date().toISOString() }
            : n
        )
      );
      if (wasUnread) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }

      // Return rollback function
      return () => {
        setNotifications(previousNotifications);
        setUnreadCount(previousUnreadCount);
      };
    },
    onError: (error, _id, rollback) => {
      rollback?.();
      console.error('Failed to mark notification as read:', error);
    },
  });

  // Mark single notification as read (optimistic)
  const handleMarkAsRead = async (id: string): Promise<void> => {
    await markAsReadMutation.mutate(id);
  };

  // Optimistic mark all as read mutation
  const markAllAsReadMutation = useOptimisticMutation<void, void>({
    mutationFn: async () => {
      const response = await fetch('/api/notifications', {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('Failed to mark all as read');
      }
    },
    onMutate: () => {
      // Store previous state
      const previousNotifications = notifications;
      const previousUnreadCount = unreadCount;

      // Optimistically update all
      setNotifications((prev) =>
        prev.map((n) => ({
          ...n,
          read: true,
          readAt: new Date().toISOString(),
        }))
      );
      setUnreadCount(0);

      // Return rollback function
      return () => {
        setNotifications(previousNotifications);
        setUnreadCount(previousUnreadCount);
      };
    },
    onError: (error, _vars, rollback) => {
      rollback?.();
      console.error('Failed to mark all as read:', error);
    },
  });

  // Mark all notifications as read (optimistic)
  const handleMarkAllAsRead = async (): Promise<void> => {
    await markAllAsReadMutation.mutate();
  };

  // Optimistic delete mutation
  const deleteMutation = useOptimisticMutation<void, string>({
    mutationFn: async (id) => {
      const response = await fetch(`/api/notifications/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to delete notification');
      }
    },
    onMutate: (id) => {
      // Store previous state
      const previousNotifications = notifications;
      const previousTotal = total;
      const previousUnreadCount = unreadCount;
      const notification = notifications.find((n) => n.id === id);
      const wasUnread = notification && !notification.read;

      // Store deleted notification for undo
      if (notification) {
        setDeletedNotification(notification);
        setShowUndo(true);

        // Clear previous timeout
        if (undoTimeoutRef.current) {
          clearTimeout(undoTimeoutRef.current);
        }

        // Auto-hide undo after 5 seconds
        undoTimeoutRef.current = setTimeout(() => {
          setShowUndo(false);
          setDeletedNotification(null);
        }, 5000);
      }

      // Optimistically remove
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      setTotal((prev) => prev - 1);
      if (wasUnread) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }

      // Return rollback function
      return () => {
        setNotifications(previousNotifications);
        setTotal(previousTotal);
        setUnreadCount(previousUnreadCount);
        setShowUndo(false);
        setDeletedNotification(null);
        if (undoTimeoutRef.current) {
          clearTimeout(undoTimeoutRef.current);
        }
      };
    },
    onError: (error, _id, rollback) => {
      rollback?.();
      console.error('Failed to delete notification:', error);
    },
    onSuccess: () => {
      // Clear undo state after successful deletion (server confirmed)
      // But we keep showing undo until timeout for UX
    },
  });

  // Delete notification (optimistic)
  const handleDelete = async (id: string): Promise<void> => {
    await deleteMutation.mutate(id);
  };

  // Undo delete - restore the notification
  const handleUndoDelete = useCallback((): void => {
    if (!deletedNotification) return;

    // Clear timeout
    if (undoTimeoutRef.current) {
      clearTimeout(undoTimeoutRef.current);
    }

    // Restore the notification (add it back to the list)
    setNotifications((prev) => {
      // Insert back in the correct position based on createdAt
      const restored = [...prev, deletedNotification].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      return restored;
    });
    setTotal((prev) => prev + 1);
    if (!deletedNotification.read) {
      setUnreadCount((prev) => prev + 1);
    }

    setShowUndo(false);
    setDeletedNotification(null);

    // Re-create the notification on the server
    // Note: This is a best-effort - in a real app you might want
    // a dedicated undo endpoint
    fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: deletedNotification.type,
        title: deletedNotification.title,
        body: deletedNotification.body,
        priority: deletedNotification.priority,
      }),
    }).catch((err) => {
      console.error('Failed to restore notification:', err);
    });
  }, [deletedNotification]);

  // Handle notification click
  const handleNotificationClick = async (
    notification: Notification
  ): Promise<void> => {
    if (!notification.read) {
      await handleMarkAsRead(notification.id);
    }
    if (notification.link) {
      router.push(notification.link);
    }
  };

  // Get icon for notification type
  const getNotificationIcon = (
    notification: Notification
  ): React.JSX.Element => {
    const iconClass = 'w-5 h-5';

    switch (notification.type) {
      case 'ALERT':
        return <AlertCircle className={iconClass} />;
      case 'SUBSCRIPTION':
        return <Info className={iconClass} />;
      case 'PAYMENT':
        return <CreditCard className={iconClass} />;
      case 'SYSTEM':
        return <AlertTriangle className={iconClass} />;
      default:
        return <Bell className={iconClass} />;
    }
  };

  // Get icon background color
  const getNotificationIconBg = (notification: Notification): string => {
    if (notification.priority === 'HIGH') {
      return 'bg-red-100 text-red-600';
    }

    switch (notification.type) {
      case 'ALERT':
        return 'bg-green-100 text-green-600';
      case 'SUBSCRIPTION':
        return 'bg-purple-100 text-purple-600';
      case 'PAYMENT':
        return 'bg-blue-100 text-blue-600';
      case 'SYSTEM':
        return 'bg-orange-100 text-orange-600';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  // Format date
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (hours < 1) {
      const minutes = Math.floor(diff / (1000 * 60));
      return minutes < 1 ? 'Just now' : `${minutes}m ago`;
    }
    if (hours < 24) return `${hours}h ago`;
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  };

  return (
    <Card className="w-full">
      {/* Screen-reader-only live region, not the visible list itself */}
      <div aria-live="polite" role="status" className="sr-only">
        {liveAnnouncement}
      </div>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle className="text-2xl font-bold">Notifications</CardTitle>
          <p className="text-sm text-muted-foreground">
            {total} total, {unreadCount} unread
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchNotifications}
            disabled={isLoading}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`}
            />
            Refresh
          </Button>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={handleMarkAllAsRead}>
              <Check className="mr-2 h-4 w-4" />
              Mark all as read
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {/* Status Tabs */}
        <Tabs
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as StatusFilter)}
          className="mb-4"
        >
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="unread">Unread ({unreadCount})</TabsTrigger>
            <TabsTrigger value="read">Read</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Type Filter */}
        <div className="mb-4 flex flex-wrap gap-2">
          <Button
            variant={typeFilter === undefined ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTypeFilter(undefined)}
          >
            All Types
          </Button>
          {(['ALERT', 'SUBSCRIPTION', 'PAYMENT', 'SYSTEM'] as const).map(
            (type) => (
              <Button
                key={type}
                variant={typeFilter === type ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTypeFilter(type)}
              >
                {type.charAt(0) + type.slice(1).toLowerCase()}
              </Button>
            )
          )}
        </div>

        {/* Undo Delete Banner */}
        {showUndo && deletedNotification && (
          <div className="animate-in slide-in-from-top-2 mb-4 flex items-center justify-between rounded-lg bg-gray-800 px-4 py-3 text-white">
            <span className="text-sm">Notification deleted</span>
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

        {/* Notifications List */}
        {isLoading ? (
          <div className="py-12 text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-gray-400" />
            <p className="mt-2 text-sm text-gray-500">
              Loading notifications...
            </p>
          </div>
        ) : error ? (
          <div className="py-12 text-center">
            <AlertTriangle className="mx-auto h-8 w-8 text-red-400" />
            <p className="mt-2 text-sm text-red-500">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchNotifications}
              className="mt-4"
            >
              Try again
            </Button>
          </div>
        ) : notifications.length === 0 ? (
          typeFilter === 'ALERT' && !isPro ? (
            /* V8: alert notifications are PRO-only */
            <div className="py-12 text-center">
              <Bell className="mx-auto h-12 w-12 text-gray-300" />
              <p className="mt-4 text-lg font-semibold text-gray-700">
                Alert notifications are a PRO feature
              </p>
              <p className="mb-4 mt-1 text-sm text-gray-500">
                Upgrade to create up to 100 price alerts on XAUUSD M5/M15 and
                get notified when they trigger.
              </p>
              <Button
                size="sm"
                className="bg-blue-600 text-white hover:bg-blue-700"
                onClick={() => router.push('/pricing')}
              >
                Upgrade to PRO
              </Button>
            </div>
          ) : (
            <div className="py-12 text-center">
              <Bell className="mx-auto h-12 w-12 text-gray-300" />
              <p className="mt-4 text-lg text-gray-500">No notifications</p>
              <p className="text-sm text-gray-400">
                {statusFilter === 'unread'
                  ? 'All caught up!'
                  : "You don't have any notifications yet"}
              </p>
            </div>
          )
        ) : (
          <div className="space-y-2">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className={`flex cursor-pointer items-start gap-4 rounded-lg border p-4 transition-colors ${
                  !notification.read
                    ? 'border-blue-200 bg-blue-50/50 hover:bg-blue-100/50'
                    : 'bg-white hover:bg-gray-50'
                } ${notification.priority === 'HIGH' ? 'border-l-4 border-l-red-500' : ''}`}
              >
                {/* Icon */}
                <div
                  className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${getNotificationIconBg(
                    notification
                  )}`}
                >
                  {getNotificationIcon(notification)}
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <h4 className="font-semibold text-gray-900">
                        {!notification.read && (
                          <span className="mr-1 text-blue-500">•</span>
                        )}
                        {notification.title}
                      </h4>
                      <p className="mt-1 text-sm text-gray-600">
                        {notification.body}
                      </p>
                    </div>

                    {/* Delete Button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-2 flex-shrink-0 text-gray-400 hover:text-red-500"
                      onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                        e.stopPropagation();
                        handleDelete(notification.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Metadata */}
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                    <span>{formatDate(notification.createdAt)}</span>
                    <span className="h-1 w-1 rounded-full bg-gray-300" />
                    <span className="rounded bg-gray-100 px-2 py-0.5">
                      {notification.type.charAt(0) +
                        notification.type.slice(1).toLowerCase()}
                    </span>
                    {notification.priority === 'HIGH' && (
                      <span className="rounded bg-red-100 px-2 py-0.5 font-semibold text-red-600">
                        HIGH PRIORITY
                      </span>
                    )}
                    {notification.link && (
                      <span className="text-blue-500">Click to view</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between border-t pt-4">
            <p className="text-sm text-gray-500">
              Page {page} of {totalPages} ({total} total)
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page === totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default NotificationList;
