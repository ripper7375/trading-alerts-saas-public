'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  User,
  Palette,
  Shield,
  Activity,
  CreditCard,
  Eye,
  Globe,
  HelpCircle,
  Lock,
  Sparkles,
} from 'lucide-react';
import { useLocale } from '@/lib/context/locale-context';

const QUICK_LINKS = [
  {
    href: '/settings/profile',
    icon: User,
    title: 'Profile Settings',
    description: 'Update your name, email, and trading experience level',
  },
  {
    href: '/settings/appearance',
    icon: Palette,
    title: 'Appearance',
    description: 'Customize theme, accent color, and chart preferences',
  },
  {
    href: '/settings/security',
    icon: Shield,
    title: 'Security & 2FA',
    description:
      'Two-factor authentication, password, and security preferences',
  },
  {
    href: '/settings/security/activity',
    icon: Activity,
    title: 'Security Activities',
    description:
      'Active login sessions, authorized devices, and security audit log',
  },
  {
    href: '/settings/billing',
    icon: CreditCard,
    title: 'Billing & Invoices',
    description: 'Manage your PRO subscription and payment history',
  },
  {
    href: '/settings/privacy',
    icon: Eye,
    title: 'Privacy & Data',
    description: 'Control profile visibility and request data exports',
  },
  {
    href: '/settings/language',
    icon: Globe,
    title: 'Language & Region',
    description: 'Display language, timezone, and currency formats',
  },
  {
    href: '/settings/help',
    icon: HelpCircle,
    title: 'Help & Support',
    description: 'Get help, contact support, or browse FAQs',
  },
  {
    href: '/settings/account',
    icon: Lock,
    title: 'Account & Deletion',
    description: 'Change password, manage sessions, or delete your account',
  },
];

export default function SettingsPage() {
  const { t, formatCurrency } = useLocale();

  return (
    <div className="animate-fade-in space-y-6 select-none">
      {/* Current Plan Summary */}
      <div className="space-y-4 rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-slate-100 p-6 shadow-xl dark:from-[#0c0f18] dark:via-[#121624] dark:to-[#0d0f17]">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <Badge className="border-amber-500/50 bg-amber-500/20 font-mono text-[10px] text-amber-700 dark:text-amber-300">
              ⚡ {t('PRO PLAN ACTIVE')}
            </Badge>
            <h2 className="mt-1 text-lg font-extrabold text-slate-900 dark:text-slate-100">
              {t('DavinTrade PRO Tier Subscription')}
            </h2>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              {formatCurrency(49)}/{t('mo')} —{' '}
              {t('100 alerts, drawing engine, multi-timeframe')}
            </p>
          </div>
          <Link href="/settings/billing">
            <Button
              variant="outline"
              className="h-8 border-amber-500/40 bg-amber-500/10 text-xs text-amber-700 hover:bg-amber-500/20 dark:text-amber-300"
            >
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              {t('Manage Subscription')}
            </Button>
          </Link>
        </div>
      </div>

      {/* Quick Links */}
      <div>
        <h3 className="mb-3 text-xs font-extrabold tracking-wider text-slate-500 uppercase dark:text-slate-400">
          {t('All Settings')}
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {QUICK_LINKS.map((link) => {
            const Icon = link.icon;
            return (
              <Link key={link.href} href={link.href}>
                <div className="flex h-full items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl transition-colors hover:border-amber-500/40 hover:bg-slate-50 dark:border-slate-800/80 dark:bg-[#090c14] dark:hover:bg-[#0c0f1a]">
                  <Icon className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
                  <div>
                    <h4 className="text-xs font-extrabold text-slate-900 dark:text-slate-100">
                      {t(link.title)}
                    </h4>
                    <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                      {t(link.description)}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
