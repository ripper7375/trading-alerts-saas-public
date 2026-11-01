import React, { createContext, useContext, useState, useEffect } from 'react';
import { NotificationItem, PriceAlert } from '@/lib/types';
import { soundEngine, ChimeType } from '@/lib/audio';
import { haptics } from '@/lib/haptics';
import { toast } from 'sonner';

interface NotificationContextType {
  notifications: NotificationItem[];
  alerts: PriceAlert[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  deleteNotification: (id: string) => void;
  addAlert: (alert: Omit<PriceAlert, 'id' | 'createdAt' | 'status'>) => void;
  toggleAlertStatus: (id: string) => void;
  deleteAlert: (id: string) => void;
  playAlertChime: (type?: ChimeType) => void;
  triggerTestAlert: (symbol: string, price: number) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined
);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [alerts, setAlerts] = useState<PriceAlert[]>([
    {
      id: 'alert_1',
      symbol: 'XAUUSD',
      timeframe: 'M15',
      condition: 'ABOVE',
      targetPrice: 2650.0,
      currentPrice: 2642.8,
      status: 'ACTIVE',
      sound: 'chime_crystal',
      note: 'M15 EDT Resistance Breakout',
      createdAt: Date.now() - 3600000,
    },
    {
      id: 'alert_2',
      symbol: 'BTCUSD',
      timeframe: 'H1',
      condition: 'BELOW',
      targetPrice: 95500.0,
      currentPrice: 96850.0,
      status: 'ACTIVE',
      sound: 'chime_bell',
      note: 'Key Fractal Support Zone',
      createdAt: Date.now() - 7200000,
    },
    {
      id: 'alert_3',
      symbol: 'EURUSD',
      timeframe: 'H4',
      condition: 'ABOVE',
      targetPrice: 1.092,
      currentPrice: 1.0864,
      status: 'TRIGGERED',
      sound: 'chime_crystal',
      note: 'Daily High Breakout',
      createdAt: Date.now() - 86400000,
    },
  ]);

  const [notifications, setNotifications] = useState<NotificationItem[]>([
    {
      id: 'notif_1',
      title: 'XAUUSD Fractal Resistance Armed',
      body: 'Monitoring M15 EDT channel upper band at $2,650.00.',
      priority: 'HIGH',
      isRead: false,
      createdAt: Date.now() - 1800000,
      url: '/terminal?symbol=XAUUSD',
    },
    {
      id: 'notif_2',
      title: 'EURUSD Alert Triggered',
      body: 'Price breached 1.0920 at 14:32 UTC. Peak-to-Peak confirmed.',
      priority: 'HIGH',
      isRead: true,
      createdAt: Date.now() - 86400000,
      url: '/terminal?symbol=EURUSD',
    },
  ]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const playAlertChime = (type: ChimeType = 'crystal') => {
    soundEngine.play(type);
    haptics.light();
  };

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    toast.success('All notifications marked as read');
    haptics.light();
  };

  const deleteNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    haptics.light();
  };

  const addAlert = (
    newAlertData: Omit<PriceAlert, 'id' | 'createdAt' | 'status'>
  ) => {
    const createdAlert: PriceAlert = {
      ...newAlertData,
      id: `alert_${Date.now()}`,
      status: 'ACTIVE',
      createdAt: Date.now(),
    };
    setAlerts((prev) => [createdAlert, ...prev]);
    toast.success(`Armed price alert for ${createdAlert.symbol}`);
    haptics.success();
  };

  const toggleAlertStatus = (id: string) => {
    setAlerts((prev) =>
      prev.map((a) => {
        if (a.id === id) {
          const nextStatus = a.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
          toast.info(`${a.symbol} alert is now ${nextStatus}`);
          haptics.medium();
          return { ...a, status: nextStatus };
        }
        return a;
      })
    );
  };

  const deleteAlert = (id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
    toast.error('Alert rule removed');
    haptics.heavy();
  };

  const triggerTestAlert = (symbol: string, price: number) => {
    playAlertChime('breakout');
    haptics.warning();
    const newNotif: NotificationItem = {
      id: `notif_${Date.now()}`,
      title: `⚡ TEST BREACH: ${symbol}`,
      body: `Price hit $${price.toLocaleString()} with confirmed fractal breakout.`,
      priority: 'HIGH',
      isRead: false,
      createdAt: Date.now(),
      url: `/terminal?symbol=${symbol}`,
    };
    setNotifications((prev) => [newNotif, ...prev]);
    toast.warning(`🔔 Price breach alert triggered for ${symbol}!`);
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        alerts,
        unreadCount,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        addAlert,
        toggleAlertStatus,
        deleteAlert,
        playAlertChime,
        triggerTestAlert,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error(
      'useNotifications must be used within a NotificationProvider'
    );
  }
  return context;
};
