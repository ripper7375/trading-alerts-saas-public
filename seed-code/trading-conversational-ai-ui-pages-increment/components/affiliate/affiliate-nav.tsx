'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  QrCode,
  Layers,
  Percent,
  Landmark,
  FileSpreadsheet,
  FolderDown,
  User,
  CreditCard,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLocale } from '@/lib/context/locale-context';

export function AffiliateNav() {
  const pathname = usePathname();
  const { t } = useLocale();

  const links = [
    {
      href: '/affiliate/dashboard',
      label: t('Dashboard'),
      icon: LayoutDashboard,
    },
    {
      href: '/affiliate/dashboard/codes',
      label: t('Promo Codes'),
      icon: QrCode,
    },
    {
      href: '/affiliate/dashboard/code-inventory',
      label: t('Inventory'),
      icon: Layers,
    },
    {
      href: '/affiliate/dashboard/commissions',
      label: t('Commissions'),
      icon: Percent,
    },
    {
      href: '/affiliate/dashboard/payouts',
      label: t('Payouts'),
      icon: Landmark,
    },
    {
      href: '/affiliate/dashboard/statements',
      label: t('Statements'),
      icon: FileSpreadsheet,
    },
    {
      href: '/affiliate/resources',
      label: t('Media Kit'),
      icon: FolderDown,
    },
    {
      href: '/affiliate/dashboard/profile',
      label: t('Partner Profile'),
      icon: User,
    },
  ];

  return (
    <div className="flex w-full scrollbar-none items-center gap-1 overflow-x-auto border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs md:px-6 dark:border-slate-800/80 dark:bg-[#080a10]">
      {links.map((link) => {
        const Icon = link.icon;
        const isActive =
          pathname === link.href ||
          (link.href !== '/affiliate/dashboard' &&
            pathname?.startsWith(link.href));

        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium whitespace-nowrap transition-all',
              isActive
                ? 'border border-amber-500/30 bg-amber-500/15 font-semibold text-amber-700 shadow-xs dark:text-amber-400'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-200'
            )}
          >
            <Icon
              className={cn(
                'h-3.5 w-3.5',
                isActive
                  ? 'text-amber-700 dark:text-amber-400'
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
