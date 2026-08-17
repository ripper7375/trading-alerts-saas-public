'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Bell,
  CheckCheck,
  Filter,
  Trash2,
  Zap,
  Shield,
  CreditCard,
  Radio,
  Clock,
  Sparkles,
  ArrowRight,
  Undo2,
} from 'lucide-react';
import AppHeader from '@/components/layout/app-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLocale } from '@/lib/context/locale-context';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  category: 'ALERT' | 'SYSTEM' | 'BILLING' | 'SECURITY';
  timestamp: string;
  read: boolean;
  link?: string;
}

type FilterValue =
  | 'ALL'
  | 'UNREAD'
  | 'READ'
  | 'ALERT'
  | 'SYSTEM'
  | 'BILLING'
  | 'SECURITY';

export default function NotificationsPage() {
  const { t } = useLocale();
  const [filter, setFilter] = useState<FilterValue>('ALL');
  const [deletedNotification, setDeletedNotification] =
    useState<NotificationItem | null>(null);
  const [showUndo, setShowUndo] = useState(false);
  const undoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([
    {
      id: 'notif-1',
      title: t('XAUUSD M5 Bullish Fractal Confirmed'),
      message: t(
        'Price broke above 2,420.50 with multi-timeframe volume confirmation.'
      ),
      category: 'ALERT',
      timestamp: '5m ago',
      read: false,
      link: '/terminal',
    },
    {
      id: 'notif-2',
      title: t('Davin AI Copilot v2.4 Active'),
      message: t(
        'New conversational market reasoning models are now live on your terminal.'
      ),
      category: 'SYSTEM',
      timestamp: '2h ago',
      read: false,
      link: '/changelog',
    },
    {
      id: 'notif-3',
      title: t('PRO Subscription Active'),
      message: t(
        'Your monthly invoice has been processed securely via Stripe.'
      ),
      category: 'BILLING',
      timestamp: '1d ago',
      read: true,
      link: '/settings/billing',
    },
    {
      id: 'notif-4',
      title: t('New Login from Chrome on Windows'),
      message: t('New active session detected in Bangkok, Thailand.'),
      category: 'SECURITY',
      timestamp: '2d ago',
      read: true,
      link: '/settings/security/activity',
    },
  ]);

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const markItemRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const deleteNotification = (id: string) => {
    const notification = notifications.find((n) => n.id === id);
    if (!notification) return;

    if (undoTimeoutRef.current) {
      clearTimeout(undoTimeoutRef.current);
    }

    setDeletedNotification(notification);
    setShowUndo(true);
    setNotifications((prev) => prev.filter((n) => n.id !== id));

    undoTimeoutRef.current = setTimeout(() => {
      setShowUndo(false);
      setDeletedNotification(null);
    }, 5000);
  };

  const undoDelete = () => {
    if (!deletedNotification) return;
    if (undoTimeoutRef.current) {
      clearTimeout(undoTimeoutRef.current);
    }
    setNotifications((prev) => [...prev, deletedNotification]);
    setShowUndo(false);
    setDeletedNotification(null);
  };

  useEffect(() => {
    return () => {
      if (undoTimeoutRef.current) {
        clearTimeout(undoTimeoutRef.current);
      }
    };
  }, []);

  const filtered = notifications.filter((n) => {
    if (filter === 'UNREAD') return !n.read;
    if (filter === 'READ') return n.read;
    if (filter === 'ALERT' || filter === 'SYSTEM') return n.category === filter;
    if (filter === 'BILLING') return n.category === 'BILLING';
    if (filter === 'SECURITY') return n.category === 'SECURITY';
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="flex h-screen w-full flex-col overflow-y-auto bg-[#050609] text-slate-100 select-none">
      <AppHeader
        title={t('Notifications Centre')}
        subtitle={t(
          'Live Signal Alerts, System Announcements & Security Events'
        )}
      />

      <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 p-4 md:p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          {/* Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {[
              { id: 'ALL', label: t('All') },
              {
                id: 'UNREAD',
                label: `${t('Unread')} (${unreadCount})`,
              },
              { id: 'READ', label: t('Read') },
              { id: 'ALERT', label: t('Signals') },
              { id: 'SYSTEM', label: t('System') },
              { id: 'BILLING', label: t('Billing') },
              { id: 'SECURITY', label: t('Security') },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id as any)}
                className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all ${
                  filter === tab.id
                    ? 'bg-amber-500 font-bold text-slate-950 shadow-md shadow-amber-500/20'
                    : 'border border-slate-800 bg-[#090b14] text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={markAllRead}
              className="self-start border-slate-800 bg-[#090b14] text-xs text-slate-300 hover:bg-slate-800"
            >
              <CheckCheck className="mr-1.5 h-3.5 w-3.5 text-emerald-400" />
              {t('Mark all as read')}
            </Button>
          )}
        </div>

        {/* Undo Delete Banner */}
        {showUndo && deletedNotification && (
          <div className="animate-in slide-in-from-top-2 flex items-center justify-between rounded-xl bg-slate-800 px-4 py-3 text-slate-100">
            <span className="text-xs">
              {t('Notification')} &quot;{deletedNotification.title}&quot;{' '}
              {t('deleted')}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={undoDelete}
              className="text-xs text-slate-100 hover:bg-slate-700 hover:text-white"
            >
              <Undo2 className="mr-2 h-3.5 w-3.5" />
              {t('Undo')}
            </Button>
          </div>
        )}

        {/* Notifications Feed */}
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <Card className="border-slate-800 bg-[#090b14]/80 p-12 text-center">
              <Bell className="mx-auto mb-3 h-10 w-10 text-slate-600" />
              <h3 className="text-sm font-bold text-slate-300">
                {t('No notifications found')}
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                {t('You are all caught up with your alert telemetry.')}
              </p>
            </Card>
          ) : (
            filtered.map((item) => {
              const getIcon = () => {
                switch (item.category) {
                  case 'ALERT':
                    return <Zap className="h-4 w-4 text-amber-400" />;
                  case 'BILLING':
                    return <CreditCard className="h-4 w-4 text-cyan-400" />;
                  case 'SECURITY':
                    return <Shield className="h-4 w-4 text-rose-400" />;
                  default:
                    return <Sparkles className="h-4 w-4 text-purple-400" />;
                }
              };

              return (
                <Card
                  key={item.id}
                  onClick={() => markItemRead(item.id)}
                  className={`border transition-all hover:border-slate-700 ${
                    item.read
                      ? 'border-slate-800/60 bg-[#070910]/70'
                      : 'border-amber-500/30 bg-[#0b0e1a]/95 shadow-md shadow-amber-500/5'
                  }`}
                >
                  <CardContent className="flex items-start justify-between gap-4 p-4">
                    <div className="flex items-start gap-3.5">
                      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-800 bg-[#06080e]">
                        {getIcon()}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4
                            className={`text-xs font-bold ${item.read ? 'text-slate-300' : 'text-slate-100'}`}
                          >
                            {item.title}
                          </h4>
                          {!item.read && (
                            <span className="h-2 w-2 rounded-full bg-amber-400" />
                          )}
                        </div>
                        <p className="text-xs leading-relaxed text-slate-400">
                          {item.message}
                        </p>
                        <div className="flex items-center gap-3 pt-1 text-[10px] text-slate-500">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {item.timestamp}
                          </span>
                          <span>•</span>
                          <span className="font-semibold tracking-wider uppercase">
                            {item.category}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1 self-center">
                      {item.link && (
                        <Link href={item.link}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="px-2.5 text-xs text-amber-400 hover:bg-amber-500/10"
                          >
                            <span>{t('View')}</span>
                            <ArrowRight className="ml-1 h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t('Delete notification')}
                        onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                          e.stopPropagation();
                          deleteNotification(item.id);
                        }}
                        className="h-8 w-8 text-slate-500 hover:bg-rose-500/20 hover:text-rose-300"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}
