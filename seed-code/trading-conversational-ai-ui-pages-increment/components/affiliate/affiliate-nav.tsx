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
      label: t('Dashboard', 'แดชบอร์ด'),
      icon: LayoutDashboard,
    },
    {
      href: '/affiliate/dashboard/codes',
      label: t('Promo Codes', 'รหัสโปรโมชัน'),
      icon: QrCode,
    },
    {
      href: '/affiliate/dashboard/code-inventory',
      label: t('Inventory', 'คลังรหัส'),
      icon: Layers,
    },
    {
      href: '/affiliate/dashboard/commissions',
      label: t('Commissions', 'ค่าคอมมิชชัน'),
      icon: Percent,
    },
    {
      href: '/affiliate/dashboard/payouts',
      label: t('Payouts', 'ประวัติถอนเงิน'),
      icon: Landmark,
    },
    {
      href: '/affiliate/dashboard/statements',
      label: t('Statements', 'ใบแจ้งยอด'),
      icon: FileSpreadsheet,
    },
    {
      href: '/affiliate/resources',
      label: t('Media Kit', 'สื่อการตลาด'),
      icon: FolderDown,
    },
    {
      href: '/affiliate/dashboard/profile',
      label: t('Partner Profile', 'โปรไฟล์พันธมิตร'),
      icon: User,
    },
    {
      href: '/affiliate/settings/payout',
      label: t('Payout Settings', 'ตั้งค่าการรับเงิน'),
      icon: CreditCard,
    },
  ];

  return (
    <div className="flex w-full scrollbar-none items-center gap-1 overflow-x-auto border-b border-slate-800/80 bg-[#080a10] px-4 py-2 text-xs md:px-6">
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
                ? 'border border-amber-500/30 bg-amber-500/15 font-semibold text-amber-400 shadow-sm'
                : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
            )}
          >
            <Icon
              className={cn(
                'h-3.5 w-3.5',
                isActive ? 'text-amber-400' : 'text-slate-400'
              )}
            />
            <span>{link.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
