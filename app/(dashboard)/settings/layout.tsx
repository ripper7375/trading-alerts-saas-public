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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Breadcrumb */}
        <nav className="text-sm text-gray-500 dark:text-gray-400 mb-4">
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
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Settings
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          Manage your account settings and preferences
        </p>

        {/* Layout Container */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Desktop Sidebar */}
          <div className="hidden lg:block w-64 flex-shrink-0">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4 sticky top-4">
              <nav className="space-y-2">
                {settingsTabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTabId === tab.id;

                  return (
                    <Link
                      key={tab.id}
                      href={tab.href}
                      className={cn(
                        'w-full text-left px-4 py-3 rounded-lg transition-all duration-200 flex items-center gap-3',
                        isActive
                          ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-l-4 border-blue-600 dark:border-blue-400 font-semibold'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                      )}
                    >
                      <Icon className="w-5 h-5" />
                      <span>{tab.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          </div>

          {/* Mobile Horizontal Tabs */}
          <div className="lg:hidden overflow-x-auto">
            <div className="flex gap-2 pb-4">
              {settingsTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTabId === tab.id;

                return (
                  <Link
                    key={tab.id}
                    href={tab.href}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-colors',
                      isActive
                        ? 'bg-blue-600 text-white'
                        : 'bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-sm">{tab.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 md:p-8 min-h-[600px]">
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
