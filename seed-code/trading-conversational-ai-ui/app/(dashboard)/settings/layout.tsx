'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import AppHeader from '@/components/layout/app-header';
import {
  User,
  Palette,
  Shield,
  CreditCard,
  Eye,
  Globe,
  HelpCircle,
  FileText,
  Lock,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLocale } from '@/lib/context/locale-context';

interface SettingsTab {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  translationKey: string;
  defaultLabel: string;
  href: string;
  badge?: string;
}

const settingsTabs: SettingsTab[] = [
  {
    id: 'profile',
    icon: User,
    translationKey: 'settings.nav.profile',
    defaultLabel: 'Profile',
    href: '/settings/profile',
  },
  {
    id: 'appearance',
    icon: Palette,
    translationKey: 'settings.nav.appearance',
    defaultLabel: 'Appearance',
    href: '/settings/appearance',
  },
  {
    id: 'security',
    icon: Shield,
    translationKey: 'settings.nav.security',
    defaultLabel: 'Security & 2FA',
    href: '/settings/security',
  },
  {
    id: 'billing',
    icon: CreditCard,
    translationKey: 'settings.nav.billing',
    defaultLabel: 'Billing & Invoices',
    href: '/settings/billing',
    badge: 'PRO',
  },
  {
    id: 'privacy',
    icon: Eye,
    translationKey: 'settings.nav.privacy',
    defaultLabel: 'Privacy & Data',
    href: '/settings/privacy',
  },
  {
    id: 'language',
    icon: Globe,
    translationKey: 'settings.nav.language',
    defaultLabel: 'Language & Region',
    href: '/settings/language',
  },
  {
    id: 'help',
    icon: HelpCircle,
    translationKey: 'settings.nav.help',
    defaultLabel: 'Help & Support',
    href: '/settings/help',
  },
  {
    id: 'terms',
    icon: FileText,
    translationKey: 'settings.nav.terms',
    defaultLabel: 'Terms & Disclosures',
    href: '/settings/terms',
  },
  {
    id: 'account',
    icon: Lock,
    translationKey: 'settings.nav.account',
    defaultLabel: 'Account & Deletion',
    href: '/settings/account',
  },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { t } = useLocale();

  const activeTab =
    settingsTabs.find((tab) => pathname.startsWith(tab.href)) ||
    settingsTabs[0];
  const activeTabLabel = t(activeTab.translationKey, activeTab.defaultLabel);

  return (
    <div className="flex h-screen w-full flex-col overflow-y-auto bg-[#06070a] select-none">
      <AppHeader
        title={`${t('breadcrumb.settings', 'Settings')}: ${activeTabLabel}`}
        subtitle="Manage your DavinTrade account preferences, security & quantitative terminal configurations"
      />

      <main className="mx-auto w-full max-w-7xl flex-1 p-4 md:p-6">
        {/* Breadcrumb Navigation */}
        <div className="mb-6 flex items-center gap-2 font-mono text-xs text-slate-400">
          <Link
            href="/dashboard"
            className="transition-colors hover:text-amber-300"
          >
            {t('breadcrumb.dashboard', 'Dashboard')}
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-600" />
          <Link
            href="/settings/profile"
            className="transition-colors hover:text-amber-300"
          >
            {t('breadcrumb.settings', 'Settings')}
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-600" />
          <span className="font-bold text-amber-400">{activeTabLabel}</span>
        </div>

        {/* 2-Column Responsive Settings Shell */}
        <div className="flex flex-col gap-6 lg:flex-row">
          {/* Desktop Sub-Sidebar Menu */}
          <div className="hidden w-64 shrink-0 lg:block">
            <div className="sticky top-4 space-y-1 rounded-2xl border border-slate-800/80 bg-[#090c14] p-3 shadow-xl">
              <div className="px-3 py-2 text-[10px] font-extrabold tracking-wider text-slate-500 uppercase">
                {t('settings.nav_title', 'SETTINGS NAVIGATION')}
              </div>
              <nav className="grid gap-1">
                {settingsTabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = pathname.startsWith(tab.href);
                  const label = t(tab.translationKey, tab.defaultLabel);

                  return (
                    <Link
                      key={tab.id}
                      href={tab.href}
                      className={cn(
                        'flex items-center justify-between rounded-xl px-3 py-2.5 text-xs font-semibold transition-all',
                        isActive
                          ? 'border border-amber-500/40 bg-amber-500/15 font-bold text-amber-300 shadow-md shadow-amber-500/10'
                          : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-100'
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon
                          className={cn(
                            'h-4 w-4',
                            isActive ? 'text-amber-400' : 'text-slate-400'
                          )}
                        />
                        <span>{label}</span>
                      </div>
                      {tab.badge && (
                        <span className="rounded border border-amber-500/40 bg-amber-500/20 px-1.5 py-0.5 font-mono text-[9px] font-bold text-amber-300">
                          {tab.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </nav>
            </div>
          </div>

          {/* Mobile Horizontal Sub-Navigation Tabs */}
          <div className="overflow-x-auto pb-2 lg:hidden">
            <div className="flex gap-2">
              {settingsTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = pathname.startsWith(tab.href);
                const label = t(tab.translationKey, tab.defaultLabel);

                return (
                  <Link
                    key={tab.id}
                    href={tab.href}
                    className={cn(
                      'flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold whitespace-nowrap transition-colors',
                      isActive
                        ? 'bg-amber-500 font-bold text-slate-950 shadow-md'
                        : 'border border-slate-800 bg-[#090c14] text-slate-300 hover:bg-slate-800'
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{label}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Main Setting Page Content Container */}
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </main>
    </div>
  );
}
