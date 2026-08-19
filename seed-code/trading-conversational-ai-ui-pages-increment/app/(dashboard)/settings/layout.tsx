'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import AppHeader from '@/components/layout/app-header';
import {
  LayoutDashboard,
  User,
  Palette,
  Shield,
  Activity,
  CreditCard,
  Eye,
  Globe,
  HelpCircle,
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
  exact?: boolean;
  badge?: string;
}

const settingsTabs: SettingsTab[] = [
  {
    id: 'overview',
    icon: LayoutDashboard,
    translationKey: 'settings.nav.overview',
    defaultLabel: 'Overview',
    href: '/settings',
    exact: true,
  },
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
    exact: true,
  },
  {
    id: 'security-activity',
    icon: Activity,
    translationKey: 'settings.nav.security_activity',
    defaultLabel: 'Security Activities',
    href: '/settings/security/activity',
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
    id: 'account',
    icon: Lock,
    translationKey: 'settings.nav.account',
    defaultLabel: 'Account & Deletion',
    href: '/settings/account',
  },
];

function isTabActive(tab: SettingsTab, pathname: string | null): boolean {
  if (!pathname) return false;
  if (tab.exact) return pathname === tab.href;
  return pathname.startsWith(tab.href);
}

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { t } = useLocale();

  const activeTab =
    settingsTabs.find((tab) => isTabActive(tab, pathname)) || settingsTabs[0];
  const activeTabLabel = t(activeTab.translationKey, activeTab.defaultLabel);

  return (
    <div className="flex h-screen w-full flex-col overflow-y-auto bg-slate-50 select-none dark:bg-[#06070a]">
      <AppHeader
        title={`${t('breadcrumb.settings', 'Settings')}: ${activeTabLabel}`}
        subtitle={t(
          'Manage your DavinTrade account preferences, security & quantitative terminal configurations'
        )}
      />

      <main className="mx-auto w-full max-w-7xl flex-1 p-4 md:p-6">
        {/* Breadcrumb Navigation */}
        <div className="mb-6 flex items-center gap-2 font-mono text-xs text-slate-500 dark:text-slate-400">
          <Link
            href="/terminal"
            className="transition-colors hover:text-amber-700 dark:hover:text-amber-300"
          >
            {t('breadcrumb.workbench', 'Workbench')}
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-400 dark:text-slate-600" />
          <Link
            href="/settings"
            className="transition-colors hover:text-amber-700 dark:hover:text-amber-300"
          >
            {t('breadcrumb.settings', 'Settings')}
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-400 dark:text-slate-600" />
          <span className="font-bold text-amber-600 dark:text-amber-400">
            {activeTabLabel}
          </span>
        </div>

        {/* 2-Column Responsive Settings Shell */}
        <div className="flex flex-col gap-6 lg:flex-row">
          {/* Desktop Sub-Sidebar Menu */}
          <div className="hidden w-64 shrink-0 lg:block">
            <div className="sticky top-4 space-y-1 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-800/80 dark:bg-[#090c14]">
              <div className="px-3 py-2 text-[10px] font-extrabold tracking-wider text-slate-600 uppercase dark:text-slate-500">
                {t('settings.nav_title', 'SETTINGS NAVIGATION')}
              </div>
              <nav className="grid gap-1">
                {settingsTabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = isTabActive(tab, pathname);
                  const label = t(tab.translationKey, tab.defaultLabel);

                  return (
                    <Link
                      key={tab.id}
                      href={tab.href}
                      className={cn(
                        'flex items-center justify-between rounded-xl px-3 py-2.5 text-xs font-semibold transition-all',
                        isActive
                          ? 'border border-amber-500/40 bg-amber-500/15 font-bold text-amber-700 shadow-md shadow-amber-500/10 dark:text-amber-300'
                          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-100'
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon
                          className={cn(
                            'h-4 w-4',
                            isActive
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-slate-500 dark:text-slate-400'
                          )}
                        />
                        <span>{label}</span>
                      </div>
                      {tab.badge && (
                        <span className="rounded border border-amber-500/40 bg-amber-500/20 px-1.5 py-0.5 font-mono text-[9px] font-bold text-amber-700 dark:text-amber-300">
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
                const isActive = isTabActive(tab, pathname);
                const label = t(tab.translationKey, tab.defaultLabel);

                return (
                  <Link
                    key={tab.id}
                    href={tab.href}
                    className={cn(
                      'flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold whitespace-nowrap transition-colors',
                      isActive
                        ? 'bg-amber-500 font-bold text-slate-950 shadow-md'
                        : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-[#090c14] dark:text-slate-300 dark:hover:bg-slate-800'
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
