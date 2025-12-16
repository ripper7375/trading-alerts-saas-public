'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAffiliateConfig } from '@/lib/hooks/useAffiliateConfig';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Bell,
  Check,
  AlertTriangle,
  Info,
  Star,
  Ticket,
  MoreVertical,
  Clock,
  CheckCircle2,
} from 'lucide-react';

interface Notification {
  id: string;
  type:
    | 'alert'
    | 'warning'
    | 'system'
    | 'upgrade'
    | 'billing'
    | 'discount_reminder';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  priority?: 'normal' | 'high' | 'urgent';
  action?: {
    label: string;
    url: string;
  };
  cta?: {
    label: string;
    onClick: () => void;
    className?: string;
  };
  metadata?: {
    symbol?: string;
    timeframe?: string;
    category?: string;
    renewalDate?: string;
    daysUntilRenewal?: number;
  };
}

export default function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // ✅ CRITICAL: Use SystemConfig hook for dynamic percentages
  const { discountPercent, calculateDiscountedPrice, isLoading } =
    useAffiliateConfig();

  const basePrice = 29.0;
  const discountedPrice = calculateDiscountedPrice(basePrice);
  const savings = basePrice - discountedPrice;

  // Generate mock notifications with dynamic discount values
  useEffect(() => {
    if (isLoading) return;

    const renewalDate = new Date();
    renewalDate.setDate(renewalDate.getDate() + 10);
    const renewalDateStr = renewalDate.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

    const mockNotifications: Notification[] = [
      // Type 6: Day -10 Discount Reminder
      {
        id: '1',
        type: 'discount_reminder',
        title: `💰 Save ${discountPercent}% on Your Next Payment`,
        message: `Your PRO subscription renews in 10 days. Find a new affiliate code to save $${savings.toFixed(
          2
        )} on your next payment!`,
        timestamp: new Date(Date.now() - 5 * 60000), // 5 mins ago
        read: false,
        priority: 'normal',
        action: {
          label: 'Enter Code Now',
          url: '/dashboard/settings/billing',
        },
        cta: {
          label: 'Enter Code Now',
          onClick: () => {
            setOpen(false);
            router.push('/dashboard/settings/billing');
          },
          className:
            'bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded text-xs mt-2 transition-colors',
        },
        metadata: {
          category: 'Billing',
          renewalDate: renewalDateStr,
          daysUntilRenewal: 10,
        },
      },
      // Type 1: Alert Triggered
      {
        id: '2',
        type: 'alert',
        title: 'Alert Triggered: Gold H1 Support',
        message:
          'XAUUSD has reached $2,645.00 (B-B1 Support). Current price: $2,645.80',
        timestamp: new Date(Date.now() - 2 * 60000), // 2 mins ago
        read: false,
        action: {
          label: 'View Chart',
          url: '/dashboard/charts?symbol=XAUUSD&timeframe=H1',
        },
        metadata: {
          symbol: 'XAUUSD',
          timeframe: 'H1',
          category: 'Alert',
        },
      },
      // Type 7: Day -7 Discount Reminder
      {
        id: '3',
        type: 'discount_reminder',
        title: '⏰ 7 Days Until Renewal - Apply Your Code',
        message: `Your next payment is $${basePrice.toFixed(2)} on ${renewalDateStr}. Save ${discountPercent}% ($${savings.toFixed(
          2
        )}) by entering an affiliate code before renewal!`,
        timestamp: new Date(Date.now() - 15 * 60000), // 15 mins ago
        read: false,
        priority: 'normal',
        cta: {
          label: 'Enter Code',
          onClick: () => {
            setOpen(false);
            router.push('/dashboard/settings/billing');
          },
          className:
            'bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded text-xs mt-2 transition-colors',
        },
        metadata: {
          category: 'Billing',
          renewalDate: renewalDateStr,
          daysUntilRenewal: 7,
        },
      },
      // Type 2: Price Near Target
      {
        id: '4',
        type: 'warning',
        title: 'Price Approaching Target',
        message:
          'EURUSD is $0.0012 away from your alert at $1.0850 (P-P2 Resistance)',
        timestamp: new Date(Date.now() - 10 * 60000), // 10 mins ago
        read: false,
        action: {
          label: 'View Chart',
          url: '/dashboard/charts?symbol=EURUSD&timeframe=H4',
        },
        metadata: {
          symbol: 'EURUSD',
          timeframe: 'H4',
          category: 'Alert',
        },
      },
      // Type 8: Day -3 Urgent Reminder
      {
        id: '5',
        type: 'discount_reminder',
        title: `🚨 Final Reminder: 3 Days to Save ${discountPercent}%`,
        message: `Your renewal is in 3 days at $${basePrice.toFixed(
          2
        )}. This is your last chance to enter a discount code and save $${savings.toFixed(
          2
        )}. Find codes on social media!`,
        timestamp: new Date(Date.now() - 2 * 3600000), // 2 hours ago
        read: false,
        priority: 'urgent',
        cta: {
          label: 'Enter Code NOW',
          onClick: () => {
            setOpen(false);
            router.push('/dashboard/settings/billing');
          },
          className:
            'bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-xs mt-2 animate-pulse transition-colors',
        },
        metadata: {
          category: 'Billing',
          renewalDate: renewalDateStr,
          daysUntilRenewal: 3,
        },
      },
      // Type 3: System Update
      {
        id: '6',
        type: 'system',
        title: 'New Feature Available',
        message:
          'Advanced chart tools are now available for PRO users. Check them out!',
        timestamp: new Date(Date.now() - 3600000), // 1 hour ago
        read: true,
        action: {
          label: 'Learn More',
          url: '/dashboard/features',
        },
        metadata: {
          category: 'System',
        },
      },
      // Type 4: Upgrade Prompt
      {
        id: '7',
        type: 'upgrade',
        title: 'Upgrade to PRO',
        message:
          "You've used 4/5 FREE alerts. Upgrade to PRO for 20 alerts and more features.",
        timestamp: new Date(Date.now() - 3 * 3600000), // 3 hours ago
        read: true,
        action: {
          label: 'View Plans',
          url: '/pricing',
        },
        metadata: {
          category: 'Upgrade',
        },
      },
      // Type 9: Code Successfully Applied
      {
        id: '8',
        type: 'billing',
        title: '🎉 Discount Code Applied!',
        message: `Your code is ready for the next payment on ${renewalDateStr}. You'll save $${savings.toFixed(
          2
        )} (${discountPercent}% off)!`,
        timestamp: new Date(Date.now() - 6 * 3600000), // 6 hours ago
        read: true,
        metadata: {
          category: 'Billing',
          renewalDate: renewalDateStr,
        },
      },
      // Type 5: Trial Ending
      {
        id: '9',
        type: 'billing',
        title: 'Trial Ending Soon',
        message:
          'Your 7-day PRO trial ends in 2 days. Update your payment method to continue.',
        timestamp: new Date(Date.now() - 86400000), // 1 day ago
        read: true,
        action: {
          label: 'Manage Subscription',
          url: '/dashboard/settings/billing',
        },
        metadata: {
          category: 'Billing',
        },
      },
      // Type 10: Renewal Without Code
      {
        id: '10',
        type: 'billing',
        title: `Payment Processed: $${basePrice.toFixed(2)}`,
        message: `Your PRO subscription has renewed. Want to save ${discountPercent}% next month? Find and enter a new affiliate code before your next renewal!`,
        timestamp: new Date(Date.now() - 2 * 86400000), // 2 days ago
        read: true,
        action: {
          label: 'Enter Code for Next Billing',
          url: '/dashboard/settings/billing',
        },
        metadata: {
          category: 'Billing',
        },
      },
      // Additional alert notifications
      {
        id: '11',
        type: 'alert',
        title: 'Alert Triggered: BTC Support Level',
        message: 'BTCUSD has bounced off $42,000 support level as expected.',
        timestamp: new Date(Date.now() - 5 * 3600000), // 5 hours ago
        read: true,
        metadata: {
          symbol: 'BTCUSD',
          timeframe: 'D1',
          category: 'Alert',
        },
      },
      {
        id: '12',
        type: 'warning',
        title: 'Multiple Alerts Near Trigger',
        message:
          'You have 3 alerts that may trigger soon. Check your dashboard.',
        timestamp: new Date(Date.now() - 8 * 3600000), // 8 hours ago
        read: true,
        metadata: {
          category: 'Alert',
        },
      },
    ];

    setNotifications(mockNotifications);
  }, [isLoading, discountPercent, savings, basePrice, router]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const handleMarkAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleDelete = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const handleNotificationClick = (notification: Notification) => {
    handleMarkAsRead(notification.id);
    if (notification.action && !notification.cta) {
      router.push(notification.action.url);
      setOpen(false);
    }
  };

  const filteredNotifications = notifications.filter((n) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'unread') return !n.read;
    if (activeTab === 'billing')
      return n.type === 'billing' || n.type === 'discount_reminder';
    if (activeTab === 'alerts')
      return n.type === 'alert' || n.type === 'warning';
    return n.type === activeTab;
  });

  const getNotificationIcon = (notification: Notification) => {
    const iconClass = 'w-5 h-5';

    switch (notification.type) {
      case 'alert':
        return <CheckCircle2 className={iconClass} />;
      case 'warning':
        return <AlertTriangle className={iconClass} />;
      case 'system':
        return <Info className={iconClass} />;
      case 'upgrade':
        return <Star className={iconClass} />;
      case 'discount_reminder':
        return <Ticket className={iconClass} />;
      case 'billing':
        return <Clock className={iconClass} />;
      default:
        return <Bell className={iconClass} />;
    }
  };

  const getNotificationIconBg = (notification: Notification) => {
    if (notification.priority === 'urgent') {
      return 'bg-gradient-to-br from-red-100 to-orange-100 text-red-600';
    }

    switch (notification.type) {
      case 'alert':
        return 'bg-green-100 text-green-600';
      case 'warning':
        return 'bg-orange-100 text-orange-600';
      case 'system':
        return 'bg-blue-100 text-blue-600';
      case 'upgrade':
        return 'bg-purple-100 text-purple-600';
      case 'discount_reminder':
        return 'bg-yellow-100 text-yellow-600';
      case 'billing':
        return 'bg-blue-100 text-blue-600';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  if (isLoading) {
    return (
      <button
        className="relative bg-transparent hover:bg-gray-100 rounded-full p-2 transition-colors"
        disabled
      >
        <Bell className="h-6 w-6 text-gray-400 animate-pulse" />
      </button>
    );
  }

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
              className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse"
              aria-label={`${unreadCount} unread notifications`}
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="w-96 p-0 rounded-xl shadow-2xl border-2 border-gray-200 animate-in slide-in-from-top-2 fade-in-0 duration-200"
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
          {filteredNotifications.length === 0 ? (
            <div className="p-8 text-center">
              <div className="text-6xl opacity-30 mb-4">🔔</div>
              <p className="text-lg text-gray-500 mb-2">No notifications yet</p>
              <p className="text-sm text-gray-400">
                We'll notify you about alerts and important updates
              </p>
            </div>
          ) : (
            filteredNotifications.map((notification) => (
              <div
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className={`flex items-start gap-4 p-4 border-b border-gray-100 cursor-pointer hover:bg-blue-50 transition-colors ${
                  !notification.read
                    ? 'bg-blue-50/50 border-l-4 border-blue-500'
                    : 'bg-white'
                } ${
                  notification.priority === 'urgent'
                    ? 'border-l-4 !border-orange-500 bg-orange-50/30'
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
                    {notification.message}
                  </p>

                  {/* CTA Button */}
                  {notification.cta && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        notification.cta!.onClick();
                      }}
                      className={notification.cta.className}
                    >
                      {notification.cta.label}
                    </button>
                  )}

                  {/* Metadata */}
                  <div className="flex gap-2 text-xs text-gray-500 mt-2 flex-wrap">
                    <span>{formatTime(notification.timestamp)}</span>
                    {notification.metadata?.category && (
                      <span className="bg-gray-100 px-2 py-0.5 rounded">
                        {notification.metadata.category}
                      </span>
                    )}
                    {notification.priority === 'urgent' && (
                      <span className="bg-red-100 text-red-600 px-2 py-0.5 rounded font-semibold">
                        URGENT
                      </span>
                    )}
                  </div>
                </div>

                {/* Action Menu or Unread Indicator */}
                <div className="flex-shrink-0">
                  {!notification.read ? (
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  ) : (
                    <button
                      onClick={(e) => {
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
            onClick={(e) => {
              e.preventDefault();
              setOpen(false);
              router.push('/dashboard/notifications');
            }}
            className="text-blue-600 hover:underline font-semibold block"
          >
            View All Notifications
          </a>
          <button
            onClick={(e) => {
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

function formatTime(date: Date): string {
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
}
