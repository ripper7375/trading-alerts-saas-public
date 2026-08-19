import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User } from '@supabase/supabase-js';

export interface Notification {
  id: string;
  type: 'price_alert' | 'trade' | 'warning' | 'news' | 'system';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
}

export interface NotificationSettings {
  soundEnabled: boolean;
  selectedSound: string;
  soundVolume: number;
  vibrationEnabled: boolean;
  selectedVibration: string;
  quietHoursEnabled: boolean;
  quietStartTime: string;
  quietEndTime: string;
  quietDays: string[];
  allowCritical: boolean;
  // Synced with profile preferences
  notificationsEnabled: boolean;
  emailNotifications: boolean;
  pushNotifications: boolean;
  priceAlerts: boolean;
  tradeConfirmations: boolean;
  marketNews: boolean;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  settings: NotificationSettings;
  isLoading: boolean;
  addNotification: (
    notification: Omit<Notification, 'id' | 'timestamp' | 'read'>
  ) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  deleteNotification: (id: string) => void;
  clearAll: () => void;
  updateSettings: (settings: Partial<NotificationSettings>) => Promise<void>;
  playNotificationSound: () => void;
  triggerVibration: () => void;
  syncFromDatabase: () => Promise<void>;
}

const STORAGE_KEYS = {
  notifications: 'app-notifications',
  settings: 'app-notification-settings',
};

const defaultSettings: NotificationSettings = {
  soundEnabled: true,
  selectedSound: 'default',
  soundVolume: 70,
  vibrationEnabled: true,
  selectedVibration: 'short',
  quietHoursEnabled: true,
  quietStartTime: '10:00 PM',
  quietEndTime: '7:00 AM',
  quietDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
  allowCritical: true,
  notificationsEnabled: true,
  emailNotifications: true,
  pushNotifications: true,
  priceAlerts: true,
  tradeConfirmations: true,
  marketNews: false,
};

const notificationSounds: Record<
  string,
  { frequency: number; duration: number }
> = {
  default: { frequency: 880, duration: 0.15 },
  chime: { frequency: 1200, duration: 0.2 },
  ping: { frequency: 1000, duration: 0.1 },
  bell: { frequency: 600, duration: 0.3 },
  alert: { frequency: 440, duration: 0.25 },
};

const vibrationPatterns: Record<string, number[]> = {
  short: [100],
  medium: [200],
  long: [400],
  double: [100, 100, 100],
  pulse: [100, 50, 100, 50, 100],
};

const mockNotifications: Notification[] = [
  {
    id: '1',
    type: 'price_alert',
    title: 'AAPL Price Alert',
    message: 'Apple Inc. has reached your target price of $185.00',
    timestamp: new Date(Date.now() - 5 * 60 * 1000),
    read: false,
  },
  {
    id: '2',
    type: 'trade',
    title: 'Order Executed',
    message: 'Buy order for 10 shares of MSFT filled at $378.50',
    timestamp: new Date(Date.now() - 30 * 60 * 1000),
    read: false,
  },
  {
    id: '3',
    type: 'warning',
    title: 'Margin Warning',
    message: 'Your margin level is below 50%. Consider adding funds.',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
    read: false,
  },
];

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined
);

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [notifications, setNotifications] = useState<Notification[]>(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.notifications);
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed.map((n: Notification) => ({
        ...n,
        timestamp: new Date(n.timestamp),
      }));
    }
    return mockNotifications;
  });

  const [settings, setSettings] = useState<NotificationSettings>(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.settings);
    return stored
      ? { ...defaultSettings, ...JSON.parse(stored) }
      : defaultSettings;
  });

  // Listen to auth state changes directly from Supabase
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Sync settings from database when user logs in
  const syncFromDatabase = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('preferences')
        .eq('id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (data?.preferences) {
        const prefs = data.preferences as Record<string, unknown>;
        setSettings((prev) => ({
          ...prev,
          notificationsEnabled:
            (prefs.notificationsEnabled as boolean) ??
            prev.notificationsEnabled,
          emailNotifications:
            (prefs.emailNotifications as boolean) ?? prev.emailNotifications,
          pushNotifications:
            (prefs.pushNotifications as boolean) ?? prev.pushNotifications,
          priceAlerts: (prefs.priceAlerts as boolean) ?? prev.priceAlerts,
          tradeConfirmations:
            (prefs.tradeConfirmations as boolean) ?? prev.tradeConfirmations,
          marketNews: (prefs.marketNews as boolean) ?? prev.marketNews,
        }));
      }
    } catch (error) {
      console.error('Error syncing notification settings:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Sync on user login
  useEffect(() => {
    if (user) {
      syncFromDatabase();
    }
  }, [user, syncFromDatabase]);

  // Persist notifications to localStorage
  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEYS.notifications,
      JSON.stringify(notifications)
    );
  }, [notifications]);

  // Persist settings to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
  }, [settings]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const playNotificationSound = useCallback(() => {
    if (!settings.soundEnabled || !settings.notificationsEnabled) return;

    const sound =
      notificationSounds[settings.selectedSound] || notificationSounds.default;
    const audioContext = new (window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext)();

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = sound.frequency;
    oscillator.type = 'sine';

    const volume = settings.soundVolume / 100;
    gainNode.gain.setValueAtTime(volume * 0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(
      0.01,
      audioContext.currentTime + sound.duration
    );

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + sound.duration);
  }, [
    settings.soundEnabled,
    settings.selectedSound,
    settings.soundVolume,
    settings.notificationsEnabled,
  ]);

  const triggerVibration = useCallback(() => {
    if (
      !settings.vibrationEnabled ||
      !settings.notificationsEnabled ||
      !navigator.vibrate
    )
      return;
    const pattern =
      vibrationPatterns[settings.selectedVibration] || vibrationPatterns.short;
    navigator.vibrate(pattern);
  }, [
    settings.vibrationEnabled,
    settings.selectedVibration,
    settings.notificationsEnabled,
  ]);

  const addNotification = useCallback(
    (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
      // Check if this notification type is enabled
      if (!settings.notificationsEnabled) return;

      if (notification.type === 'price_alert' && !settings.priceAlerts) return;
      if (notification.type === 'trade' && !settings.tradeConfirmations) return;
      if (notification.type === 'news' && !settings.marketNews) return;

      const newNotification: Notification = {
        ...notification,
        id: Date.now().toString(),
        timestamp: new Date(),
        read: false,
      };
      setNotifications((prev) => [newNotification, ...prev]);
      playNotificationSound();
      triggerVibration();
    },
    [playNotificationSound, triggerVibration, settings]
  );

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const deleteNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const updateSettings = useCallback(
    async (newSettings: Partial<NotificationSettings>) => {
      const updatedSettings = { ...settings, ...newSettings };
      setSettings(updatedSettings);

      // Sync relevant settings to database if user is logged in
      if (user) {
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('preferences')
            .eq('id', user.id)
            .maybeSingle();

          const existingPrefs =
            (profile?.preferences as Record<string, unknown>) || {};

          await supabase
            .from('profiles')
            .update({
              preferences: JSON.parse(
                JSON.stringify({
                  ...existingPrefs,
                  notificationsEnabled: updatedSettings.notificationsEnabled,
                  emailNotifications: updatedSettings.emailNotifications,
                  pushNotifications: updatedSettings.pushNotifications,
                  priceAlerts: updatedSettings.priceAlerts,
                  tradeConfirmations: updatedSettings.tradeConfirmations,
                  marketNews: updatedSettings.marketNews,
                })
              ),
            })
            .eq('id', user.id);
        } catch (error) {
          console.error('Error syncing settings to database:', error);
        }
      }
    },
    [settings, user]
  );

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        settings,
        isLoading,
        addNotification,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        clearAll,
        updateSettings,
        playNotificationSound,
        triggerVibration,
        syncFromDatabase,
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
