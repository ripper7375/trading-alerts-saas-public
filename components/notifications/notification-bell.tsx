'use client';

import {
  Bell,
  Check,
  AlertTriangle,
  Info,
  CreditCard,
  AlertCircle,
  MoreVertical,
  Loader2,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useState, useEffect, useCallback } from 'react';

import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useRealtimeSocket } from '@/hooks/use-realtime-socket';

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

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// NOTIFICATION BELL COMPONENT
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Notification bell icon with dropdown showing recent notifications
 *
 * Features:
 * - Unread count badge (shows 9+ if more than 9)
 * - Dropdown with tabs: All, Alerts, System, Billing, Unread
 * - Mark as read on click
 * - Mark all as read button
 * - View all link to full notifications page
 */
export function NotificationBell(): React.JSX.Element {
  const router = useRouter();
  const { data: session } = useSession();
  const isPro = session?.user?.tier === 'PRO';
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch notifications from API
  const fetchNotifications = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/notifications?pageSize=10');

      if (!response.ok) {
        if (response.status === 401) {
          // Not logged in, silently fail
          return;
        }
        throw new Error('Failed to fetch notifications');
      }

      const data: NotificationsResponse = await response.json();
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to load notifications'
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch on mount and when popover opens
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    if (open) {
      fetchNotifications();
    }
  }, [open, fetchNotifications]);

  // Live badge update (F8, Session 4B-17) — additive to the REST poll
  // above, which stays the durable fallback (fact #6 in this session's
  // order: notifications already work without this). Re-fetches on push
  // rather than merging the pushed payload into state directly, so the
  // list/unreadCount stay single-sourced from the server's own pagination
  // and read-state logic.
  useRealtimeSocket({
    onNotification: () => {
      fetchNotifications();
    },
  });

  // Mark single notification as read
  const handleMarkAsRead = async (id: string): Promise<void> => {
    try {
      const response = await fetch(`/api/notifications/${id}/read`, {
        method: 'POST',
      });

      if (response.ok) {
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === id
              ? { ...n, read: true, readAt: new Date().toISOString() }
              : n
          )
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  // Mark all notifications as read
  const handleMarkAllAsRead = async (): Promise<void> => {
    try {
      const response = await fetch('/api/notifications', {
        method: 'POST',
      });

      if (response.ok) {
        setNotifications((prev) =>
          prev.map((n) => ({
            ...n,
            read: true,
            readAt: new Date().toISOString(),
          }))
        );
        setUnreadCount(0);
      }
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  // Delete notification
  const handleDelete = async (id: string): Promise<void> => {
    try {
      const response = await fetch(`/api/notifications/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        const deletedNotification = notifications.find((n) => n.id === id);
        setNotifications((prev) => prev.filter((n) => n.id !== id));
        if (deletedNotification && !deletedNotification.read) {
          setUnreadCount((prev) => Math.max(0, prev - 1));
        }
      }
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  };

  // Handle notification click
  const handleNotificationClick = async (
    notification: Notification
  ): Promise<void> => {
    if (!notification.read) {
      await handleMarkAsRead(notification.id);
    }
    if (notification.link) {
      router.push(notification.link);
      setOpen(false);
    }
  };

  // Filter notifications by tab
  const filteredNotifications = notifications.filter((n) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'unread') return !n.read;
    if (activeTab === 'alerts') return n.type === 'ALERT';
    if (activeTab === 'system') return n.type === 'SYSTEM';
    if (activeTab === 'billing')
      return n.type === 'PAYMENT' || n.type === 'SUBSCRIPTION';
    return true;
  });

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

  // Format relative time
  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    const diff = Date.now() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={`relative rounded-full bg-transparent p-2 transition-colors hover:bg-gray-100 ${
            open ? 'bg-blue-50 ring-2 ring-blue-500' : ''
          }`}
          aria-label="Notifications"
        >
          <Bell className="h-6 w-6 text-gray-700" />
          {unreadCount > 0 && (
            <span
              className="absolute right-0 top-0 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white"
              aria-label={`${unreadCount} unread notifications`}
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="w-96 rounded-xl border-2 border-gray-200 p-0 shadow-2xl"
      >
        {/* Header */}
        <div className="rounded-t-xl bg-gradient-to-r from-blue-600 to-purple-600 p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold">Notifications</h3>
              <p className="text-sm opacity-90">{unreadCount} unread</p>
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="cursor-pointer rounded-lg bg-white/20 px-3 py-1 text-xs transition-colors hover:bg-white/30"
              >
                <Check className="mr-1 inline h-3 w-3" />
                Mark all read
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 overflow-x-auto border-b-2 border-gray-200 bg-white px-4">
          {[
            { id: 'all', label: 'All' },
            { id: 'alerts', label: 'Alerts' },
            { id: 'system', label: 'System' },
            { id: 'billing', label: 'Billing' },
            { id: 'unread', label: 'Unread' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap border-b-2 py-3 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 font-semibold text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-blue-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Notifications List */}
        <ScrollArea className="max-h-96">
          {isLoading ? (
            <div className="p-8 text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-gray-400" />
              <p className="mt-2 text-sm text-gray-500">
                Loading notifications...
              </p>
            </div>
          ) : error ? (
            <div className="p-8 text-center">
              <AlertTriangle className="mx-auto h-8 w-8 text-red-400" />
              <p className="mt-2 text-sm text-red-500">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchNotifications}
                className="mt-2"
              >
                Try again
              </Button>
            </div>
          ) : filteredNotifications.length === 0 ? (
            activeTab === 'alerts' && !isPro ? (
              /* V8: FREE users cannot create alerts — show upgrade prompt
                 in the Alerts tab instead of a generic empty state */
              <div className="p-8 text-center">
                <div className="mb-4 text-6xl opacity-30">🔔</div>
                <p className="mb-2 text-lg font-semibold text-gray-700">
                  Alert notifications are a PRO feature
                </p>
                <p className="mb-4 text-sm text-gray-500">
                  Upgrade to create up to 100 price alerts on XAUUSD M5/M15 and
                  get notified the moment they trigger.
                </p>
                <Button
                  size="sm"
                  className="bg-blue-600 text-white hover:bg-blue-700"
                  onClick={() => {
                    setOpen(false);
                    router.push('/pricing');
                  }}
                >
                  Upgrade to PRO
                </Button>
              </div>
            ) : (
              <div className="p-8 text-center">
                <div className="mb-4 text-6xl opacity-30">🔔</div>
                <p className="mb-2 text-lg text-gray-500">
                  No notifications yet
                </p>
                <p className="text-sm text-gray-400">
                  {isPro
                    ? "We'll notify you about alerts and important updates"
                    : "We'll notify you about account and billing updates"}
                </p>
              </div>
            )
          ) : (
            filteredNotifications.map((notification) => (
              <div
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className={`flex cursor-pointer items-start gap-4 border-b border-gray-100 p-4 transition-colors hover:bg-blue-50 ${
                  !notification.read
                    ? 'border-l-4 border-l-blue-500 bg-blue-50/50'
                    : 'bg-white'
                } ${
                  notification.priority === 'HIGH'
                    ? 'border-l-4 !border-l-orange-500 bg-orange-50/30'
                    : ''
                }`}
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
                  <h4 className="mb-1 text-sm font-semibold text-gray-900">
                    {!notification.read && (
                      <span className="mr-1 text-blue-500">•</span>
                    )}
                    {notification.title}
                  </h4>
                  <p className="line-clamp-2 text-sm text-gray-600">
                    {notification.body}
                  </p>

                  {/* Metadata */}
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500">
                    <span>{formatTime(notification.createdAt)}</span>
                    <span className="rounded bg-gray-100 px-2 py-0.5">
                      {notification.type.charAt(0) +
                        notification.type.slice(1).toLowerCase()}
                    </span>
                    {notification.priority === 'HIGH' && (
                      <span className="rounded bg-red-100 px-2 py-0.5 font-semibold text-red-600">
                        HIGH
                      </span>
                    )}
                  </div>
                </div>

                {/* Action Menu or Unread Indicator */}
                <div className="flex-shrink-0">
                  {!notification.read ? (
                    <div className="h-2 w-2 rounded-full bg-blue-500" />
                  ) : (
                    <button
                      onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                        e.stopPropagation();
                        handleDelete(notification.id);
                      }}
                      className="p-1 text-gray-400 hover:text-gray-600"
                      aria-label="Delete notification"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="rounded-b-xl border-t-2 border-gray-200 bg-gray-50 p-4 text-center">
          <a
            href="/notifications"
            onClick={(e: React.MouseEvent<HTMLAnchorElement>) => {
              e.preventDefault();
              setOpen(false);
              router.push('/notifications');
            }}
            className="block font-semibold text-blue-600 hover:underline"
          >
            View All Notifications
          </a>
          <button
            onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
              e.preventDefault();
              setOpen(false);
              router.push('/settings/notifications');
            }}
            className="mt-2 block w-full text-sm text-gray-600 hover:text-blue-600"
          >
            Notification Settings
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default NotificationBell;
