'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ShieldAlert,
  Users,
  Share2,
  Landmark,
  AlertTriangle,
  Server,
  Activity,
  Radio,
  FileCode,
  Settings,
  History,
  Terminal,
  Layers,
  Gauge,
  FolderDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLocale } from '@/lib/context/locale-context';

export function AdminNav() {
  const pathname = usePathname();
  const { t } = useLocale();

  const links = [
    {
      href: '/admin',
      label: t('Executive'),
      icon: ShieldAlert,
    },
    {
      href: '/admin/users',
      label: t('Users'),
      icon: Users,
    },
    {
      href: '/admin/affiliates',
      label: t('Affiliates & Reports'),
      icon: Share2,
    },
    {
      href: '/admin/disbursement',
      label: t('Disbursements'),
      icon: Landmark,
    },
    {
      href: '/admin/settings/affiliate',
      label: t('Affiliate Settings'),
      icon: Settings,
    },
    {
      href: '/admin/resources',
      label: t('Marketing Resources'),
      icon: FolderDown,
    },
    {
      href: '/admin/fraud-alerts',
      label: t('Fraud Detection'),
      icon: AlertTriangle,
    },
    {
      href: '/admin/api-usage',
      label: t('API & Telemetry'),
      icon: Activity,
    },
    {
      href: '/admin/errors',
      label: t('System Errors'),
      icon: FileCode,
    },
    {
      href: '/status',
      label: t('System Status'),
      icon: Gauge,
    },
    {
      href: '/admin/system/terminals',
      label: t('MT5 Fleet'),
      icon: Terminal,
    },
    {
      href: '/admin/system/jobs',
      label: t('Cron & Jobs'),
      icon: Server,
    },
    {
      href: '/admin/system/outbox',
      label: t('Outbox Events'),
      icon: Layers,
    },
    {
      href: '/admin/system/config-history',
      label: t('Config History'),
      icon: History,
    },
    {
      href: '/admin/notifications/broadcast',
      label: t('Broadcast'),
      icon: Radio,
    },
  ];

  return (
    <div className="flex w-full scrollbar-none items-center gap-1 overflow-x-auto border-b border-rose-500/20 bg-slate-50 px-4 py-2 text-xs md:px-6 dark:bg-[#07080e]">
      {links.map((link) => {
        const Icon = link.icon;
        const isActive =
          link.href === '/admin'
            ? pathname === '/admin'
            : pathname?.startsWith(link.href);

        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium whitespace-nowrap transition-all',
              isActive
                ? 'border border-rose-500/30 bg-rose-500/15 font-semibold text-rose-600 shadow-xs dark:text-rose-400'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-200'
            )}
          >
            <Icon
              className={cn(
                'h-3.5 w-3.5',
                isActive
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-slate-500 dark:text-slate-400'
              )}
            />
            <span>{link.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
