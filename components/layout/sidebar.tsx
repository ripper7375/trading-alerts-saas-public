'use client';

import {
  LayoutDashboard,
  Bell,
  LineChart,
  Eye,
  BarChart3,
  Zap,
  Settings,
  HelpCircle,
  Lock,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  tier: 'FREE' | 'PRO';
  description?: string;
}

// Navigation items configuration
// Items with tier: 'PRO' will show a lock icon for FREE users
const navigationItems: NavItem[] = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    tier: 'FREE',
    description: 'Overview and stats',
  },
  {
    name: 'Charts',
    href: '/charts',
    icon: LineChart,
    tier: 'FREE',
    description: 'Live price charts',
  },
  {
    name: 'Alerts',
    href: '/alerts',
    icon: Bell,
    tier: 'FREE',
    description: 'Manage your alerts',
  },
  {
    name: 'Watchlist',
    href: '/watchlist',
    icon: Eye,
    tier: 'FREE',
    description: 'Track your symbols',
  },
  {
    name: 'Analytics',
    href: '/analytics',
    icon: BarChart3,
    tier: 'PRO',
    description: 'Advanced analytics',
  },
  {
    name: 'Custom Indicators',
    href: '/indicators',
    icon: Zap,
    tier: 'PRO',
    description: 'Custom indicators',
  },
];

const bottomNavItems: NavItem[] = [
  {
    name: 'Settings',
    href: '/settings',
    icon: Settings,
    tier: 'FREE',
  },
  {
    name: 'Help',
    href: '/settings/help',
    icon: HelpCircle,
    tier: 'FREE',
  },
];

interface SidebarProps {
  userTier: string;
}

/**
 * Sidebar Navigation Component
 *
 * Features:
 * - Tier-based navigation items (hide PRO features for FREE users with lock icon)
 * - Active link highlighting
 * - Icon-based navigation with descriptions
 */
export function Sidebar({ userTier }: SidebarProps): React.ReactElement {
  const pathname = usePathname();

  // Check if user can access the nav item based on tier
  const canAccess = (itemTier: 'FREE' | 'PRO'): boolean => {
    if (itemTier === 'FREE') return true;
    return userTier === 'PRO';
  };

  // Check if the current path matches the nav item
  const isActive = (href: string): boolean => {
    if (href === '/dashboard') {
      return pathname === '/dashboard';
    }
    return pathname.startsWith(href);
  };

  return (
    <div className="flex h-full flex-col border-r bg-white dark:bg-gray-800 dark:border-gray-700">
      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        <div className="mb-4">
          <p className="px-3 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Main Menu
          </p>
        </div>

        {navigationItems.map((item) => {
          const Icon = item.icon;
          const accessible = canAccess(item.tier);
          const active = isActive(item.href);

          return (
            <Link
              key={item.href}
              href={accessible ? item.href : '/settings/billing'}
              className={cn(
                'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                active
                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                  : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700',
                !accessible && 'opacity-60 cursor-pointer'
              )}
            >
              <Icon
                className={cn(
                  'h-5 w-5 shrink-0',
                  active
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300'
                )}
              />
              <span className="flex-1">{item.name}</span>

              {/* Show lock icon or PRO badge for PRO-only items when user is FREE */}
              {item.tier === 'PRO' && !accessible && (
                <div className="flex items-center gap-1">
                  <Lock className="h-3.5 w-3.5 text-gray-400" />
                  <Badge
                    variant="secondary"
                    className="text-[10px] px-1.5 py-0 bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"
                  >
                    PRO
                  </Badge>
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Upgrade prompt for FREE users */}
      {userTier === 'FREE' && (
        <div className="mx-3 mb-4 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 p-4 text-white">
          <p className="text-sm font-semibold mb-1">Upgrade to PRO</p>
          <p className="text-xs opacity-90 mb-3">
            Get 15 symbols, 9 timeframes, and 20 alerts
          </p>
          <Link
            href="/settings/billing"
            className="block w-full rounded-md bg-white/20 hover:bg-white/30 transition-colors text-center py-1.5 text-xs font-medium"
          >
            Upgrade Now
          </Link>
        </div>
      )}

      {/* Bottom navigation */}
      <div className="border-t border-gray-200 dark:border-gray-700 px-3 py-4 space-y-1">
        {bottomNavItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                active
                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                  : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
              )}
            >
              <Icon
                className={cn(
                  'h-5 w-5 shrink-0',
                  active
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300'
                )}
              />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
