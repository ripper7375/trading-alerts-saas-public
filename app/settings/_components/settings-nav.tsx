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
 * Settings sub-navigation -- desktop sticky sidebar / mobile horizontal
 * tabs, shared by every `/settings/*` page via `app/settings/layout.tsx`.
 * `/settings/terms` and `/settings/security/activity` are reachable via
 * in-page links (Security page, Account footer) rather than primary tabs,
 * matching the legacy `app/(dashboard)/settings/layout.tsx` nav shape this
 * was ported from.
 */

interface SettingsTab {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href: string;
}

const settingsTabs: SettingsTab[] = [
  { id: 'profile', icon: User, label: 'Profile', href: '/settings/profile' },
  {
    id: 'appearance',
    icon: Palette,
    label: 'Appearance',
    href: '/settings/appearance',
  },
  { id: 'account', icon: Lock, label: 'Account', href: '/settings/account' },
  {
    id: 'security',
    icon: Shield,
    label: 'Security',
    href: '/settings/security',
  },
  { id: 'privacy', icon: Eye, label: 'Privacy', href: '/settings/privacy' },
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
  { id: 'help', icon: HelpCircle, label: 'Help', href: '/settings/help' },
];

export function SettingsNav(): React.ReactElement {
  const pathname = usePathname();

  const activeTabId = settingsTabs.find(
    (tab) => pathname === tab.href || pathname.startsWith(`${tab.href}/`)
  )?.id;

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden w-56 flex-shrink-0 lg:block">
        <div className="sticky top-20 rounded-xl border border-border bg-card p-3 shadow-sm">
          <nav className="space-y-1">
            {settingsTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTabId === tab.id;

              return (
                <Link
                  key={tab.id}
                  href={tab.href}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-all duration-200',
                    isActive
                      ? 'bg-primary/10 border-l-2 border-primary font-semibold text-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  )}
                >
                  <Icon className="h-4 w-4" />
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
                  'flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'border border-border bg-card text-muted-foreground'
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
