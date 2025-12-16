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
import { useState, useEffect, useCallback } from 'react';

import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';


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
      setError(err instanceof Error ? err.message : 'Failed to load notifications');
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

  // Mark single notification as read
  const handleMarkAsRead = async (id: string): Promise<void> => {
    try {
      const response = await fetch(`/api/notifications/${id}/read`, {
        method: 'POST',
      });

      if (response.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, read: true, readAt: new Date().toISOString() } : n))
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
          prev.map((n) => ({ ...n, read: true, readAt: new Date().toISOString() }))
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
  const handleNotificationClick = async (notification: Notification): Promise<void> => {
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
    if (activeTab === 'billing') return n.type === 'PAYMENT' || n.type === 'SUBSCRIPTION';
    return true;
  });

  // Get icon for notification type
  const getNotificationIcon = (notification: Notification): React.JSX.Element => {
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
          className={`relative bg-transparent hover:bg-gray-100 rounded-full p-2 transition-colors ${
            open ? 'bg-blue-50 ring-2 ring-blue-500' : ''
          }`}
          aria-label="Notifications"
        >
          <Bell className="h-6 w-6 text-gray-700" />
          {unreadCount > 0 && (
            <span
              className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center"
              aria-label={`${unreadCount} unread notifications`}
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="w-96 p-0 rounded-xl shadow-2xl border-2 border-gray-200"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-4 text-white rounded-t-xl">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xl font-bold">Notifications</h3>
              <p className="text-sm opacity-90">{unreadCount} unread</p>
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1 rounded-lg cursor-pointer transition-colors"
              >
                <Check className="inline w-3 h-3 mr-1" />
                Mark all read
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white border-b-2 border-gray-200 px-4 flex gap-4 overflow-x-auto">
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
              className={`py-3 border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'text-blue-600 border-blue-600 font-semibold'
                  : 'text-gray-600 border-transparent hover:text-blue-600'
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
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" />
              <p className="text-sm text-gray-500 mt-2">Loading notifications...</p>
            </div>
          ) : error ? (
            <div className="p-8 text-center">
              <AlertTriangle className="h-8 w-8 mx-auto text-red-400" />
              <p className="text-sm text-red-500 mt-2">{error}</p>
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
            <div className="p-8 text-center">
              <div className="text-6xl opacity-30 mb-4">🔔</div>
              <p className="text-lg text-gray-500 mb-2">No notifications yet</p>
              <p className="text-sm text-gray-400">
                We&apos;ll notify you about alerts and important updates
              </p>
            </div>
          ) : (
            filteredNotifications.map((notification) => (
              <div
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className={`flex items-start gap-4 p-4 border-b border-gray-100 cursor-pointer hover:bg-blue-50 transition-colors ${
                  !notification.read
                    ? 'bg-blue-50/50 border-l-4 border-l-blue-500'
                    : 'bg-white'
                } ${
                  notification.priority === 'HIGH'
                    ? 'border-l-4 !border-l-orange-500 bg-orange-50/30'
                    : ''
                }`}
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
                  <h4 className="font-semibold text-gray-900 text-sm mb-1">
                    {!notification.read && (
                      <span className="text-blue-500 mr-1">•</span>
                    )}
                    {notification.title}
                  </h4>
                  <p className="text-gray-600 text-sm line-clamp-2">
                    {notification.body}
                  </p>

                  {/* Metadata */}
                  <div className="flex gap-2 text-xs text-gray-500 mt-2 flex-wrap">
                    <span>{formatTime(notification.createdAt)}</span>
                    <span className="bg-gray-100 px-2 py-0.5 rounded">
                      {notification.type.charAt(0) + notification.type.slice(1).toLowerCase()}
                    </span>
                    {notification.priority === 'HIGH' && (
                      <span className="bg-red-100 text-red-600 px-2 py-0.5 rounded font-semibold">
                        HIGH
                      </span>
                    )}
                  </div>
                </div>

                {/* Action Menu or Unread Indicator */}
                <div className="flex-shrink-0">
                  {!notification.read ? (
                    <div className="w-2 h-2 bg-blue-500 rounded-full" />
                  ) : (
                    <button
                      onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                        e.stopPropagation();
                        handleDelete(notification.id);
                      }}
                      className="text-gray-400 hover:text-gray-600 p-1"
                      aria-label="Delete notification"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="border-t-2 border-gray-200 bg-gray-50 p-4 text-center rounded-b-xl">
          <a
            href="/dashboard/notifications"
            onClick={(e: React.MouseEvent<HTMLAnchorElement>) => {
              e.preventDefault();
              setOpen(false);
              router.push('/dashboard/notifications');
            }}
            className="text-blue-600 hover:underline font-semibold block"
          >
            View All Notifications
          </a>
          <button
            onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
              e.preventDefault();
              setOpen(false);
              router.push('/dashboard/settings/notifications');
            }}
            className="text-gray-600 hover:text-blue-600 text-sm mt-2 block w-full"
          >
            Notification Settings
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default NotificationBell;
