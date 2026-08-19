'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  User,
  Palette,
  Lock,
  Eye,
  CreditCard,
  Globe,
  HelpCircle,
  Shield,
} from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Settings Layout
 *
 * Provides consistent layout for all settings pages with:
 * - Sidebar navigation (desktop)
 * - Horizontal tabs (mobile)
 * - Active tab highlighting
 * - Breadcrumb navigation
 */

interface SettingsLayoutProps {
  children: React.ReactNode;
}

interface SettingsTab {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href: string;
}

const settingsTabs: SettingsTab[] = [
  {
    id: 'profile',
    icon: User,
    label: 'Profile',
    href: '/settings/profile',
  },
  {
    id: 'appearance',
    icon: Palette,
    label: 'Appearance',
    href: '/settings/appearance',
  },
  {
    id: 'account',
    icon: Lock,
    label: 'Account',
    href: '/settings/account',
  },
  {
    id: 'security',
    icon: Shield,
    label: 'Security',
    href: '/settings/security',
  },
  {
    id: 'privacy',
    icon: Eye,
    label: 'Privacy',
    href: '/settings/privacy',
  },
  {
    id: 'billing',
    icon: CreditCard,
    label: 'Billing',
    href: '/settings/billing',
  },
  {
    id: 'language',
    icon: Globe,
    label: 'Language',
    href: '/settings/language',
  },
  {
    id: 'help',
    icon: HelpCircle,
    label: 'Help',
    href: '/settings/help',
  },
];

export default function SettingsLayout({
  children,
}: SettingsLayoutProps): React.ReactElement {
  const pathname = usePathname();

  // Determine active tab from pathname
  const activeTabId = settingsTabs.find((tab) =>
    pathname.startsWith(tab.href)
  )?.id;

  return (
    <div className="min-h-screen bg-gray-50 p-4 dark:bg-gray-900 md:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        {/* Breadcrumb */}
        <nav className="mb-4 text-sm text-gray-500 dark:text-gray-400">
          <Link
            href="/dashboard"
            className="hover:text-gray-700 dark:hover:text-gray-300"
          >
            Dashboard
          </Link>
          {' > '}
          <span>Settings</span>
        </nav>

        {/* Header */}
        <h1 className="mb-2 text-3xl font-bold text-gray-900 dark:text-white">
          Settings
        </h1>
        <p className="mb-8 text-gray-600 dark:text-gray-400">
          Manage your account settings and preferences
        </p>

        {/* Layout Container */}
        <div className="flex flex-col gap-6 lg:flex-row">
          {/* Desktop Sidebar */}
          <div className="hidden w-64 flex-shrink-0 lg:block">
            <div className="sticky top-4 rounded-xl bg-white p-4 shadow-md dark:bg-gray-800">
              <nav className="space-y-2">
                {settingsTabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTabId === tab.id;

                  return (
                    <Link
                      key={tab.id}
                      href={tab.href}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left transition-all duration-200',
                        isActive
                          ? 'bg-primary/10 border-l-4 border-primary font-semibold text-primary'
                          : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                      )}
                    >
                      <Icon className="h-5 w-5" />
                      <span>{tab.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          </div>

          {/* Mobile Horizontal Tabs */}
          <div className="overflow-x-auto lg:hidden">
            <div className="flex gap-2 pb-4">
              {settingsTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTabId === tab.id;

                return (
                  <Link
                    key={tab.id}
                    href={tab.href}
                    className={cn(
                      'flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 transition-colors',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'border-2 border-gray-200 bg-white text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-sm">{tab.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1">
            <div className="min-h-[600px] rounded-xl bg-white p-6 shadow-md dark:bg-gray-800 md:p-8">
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
