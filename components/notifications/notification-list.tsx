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
import { useState, useEffect, useCallback, useRef } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useOptimisticMutation } from '@/hooks/use-optimistic-mutation';

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
              className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`}
            />
            Refresh
          </Button>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={handleMarkAllAsRead}>
              <Check className="h-4 w-4 mr-2" />
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
        <div className="flex gap-2 mb-4 flex-wrap">
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
          <div className="mb-4 flex items-center justify-between bg-gray-800 text-white px-4 py-3 rounded-lg animate-in slide-in-from-top-2">
            <span className="text-sm">Notification deleted</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleUndoDelete}
              className="text-white hover:text-white hover:bg-gray-700"
            >
              <Undo2 className="h-4 w-4 mr-2" />
              Undo
            </Button>
          </div>
        )}

        {/* Notifications List */}
        {isLoading ? (
          <div className="py-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" />
            <p className="text-sm text-gray-500 mt-2">
              Loading notifications...
            </p>
          </div>
        ) : error ? (
          <div className="py-12 text-center">
            <AlertTriangle className="h-8 w-8 mx-auto text-red-400" />
            <p className="text-sm text-red-500 mt-2">{error}</p>
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
          <div className="py-12 text-center">
            <Bell className="h-12 w-12 mx-auto text-gray-300" />
            <p className="text-lg text-gray-500 mt-4">No notifications</p>
            <p className="text-sm text-gray-400">
              {statusFilter === 'unread'
                ? 'All caught up!'
                : "You don't have any notifications yet"}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className={`flex items-start gap-4 p-4 rounded-lg border cursor-pointer transition-colors ${
                  !notification.read
                    ? 'bg-blue-50/50 border-blue-200 hover:bg-blue-100/50'
                    : 'bg-white hover:bg-gray-50'
                } ${notification.priority === 'HIGH' ? 'border-l-4 border-l-red-500' : ''}`}
              >
                {/* Icon */}
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${getNotificationIconBg(
                    notification
                  )}`}
                >
                  {getNotificationIcon(notification)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-gray-900">
                        {!notification.read && (
                          <span className="text-blue-500 mr-1">•</span>
                        )}
                        {notification.title}
                      </h4>
                      <p className="text-gray-600 text-sm mt-1">
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
                  <div className="flex gap-2 text-xs text-gray-500 mt-2 flex-wrap items-center">
                    <span>{formatDate(notification.createdAt)}</span>
                    <span className="w-1 h-1 bg-gray-300 rounded-full" />
                    <span className="bg-gray-100 px-2 py-0.5 rounded">
                      {notification.type.charAt(0) +
                        notification.type.slice(1).toLowerCase()}
                    </span>
                    {notification.priority === 'HIGH' && (
                      <span className="bg-red-100 text-red-600 px-2 py-0.5 rounded font-semibold">
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
          <div className="flex items-center justify-between mt-6 pt-4 border-t">
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
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page === totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default NotificationList;
