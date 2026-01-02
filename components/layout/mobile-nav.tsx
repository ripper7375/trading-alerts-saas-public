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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  tier: 'FREE' | 'PRO';
}

// Navigation items configuration (same as sidebar)
const navigationItems: NavItem[] = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    tier: 'FREE',
  },
  {
    name: 'Charts',
    href: '/charts',
    icon: LineChart,
    tier: 'FREE',
  },
  {
    name: 'Alerts',
    href: '/alerts',
    icon: Bell,
    tier: 'FREE',
  },
  {
    name: 'Watchlist',
    href: '/watchlist',
    icon: Eye,
    tier: 'FREE',
  },
  {
    name: 'Analytics',
    href: '/analytics',
    icon: BarChart3,
    tier: 'PRO',
  },
  {
    name: 'Custom Indicators',
    href: '/indicators',
    icon: Zap,
    tier: 'PRO',
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

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
  userTier: string;
}

/**
 * Mobile Navigation Component
 *
 * Features:
 * - Slide-out sheet navigation for mobile devices
 * - Same tier-based logic as desktop sidebar
 * - Closes automatically on navigation
 */
export function MobileNav({
  isOpen,
  onClose,
  userTier,
}: MobileNavProps): React.ReactElement {
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

  // Handle navigation click - close the mobile nav
  const handleNavClick = (): void => {
    onClose();
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="left" className="w-[280px] p-0">
        <SheetHeader className="border-b p-4">
          <SheetTitle className="flex items-center gap-2">
            <span className="text-2xl" role="img" aria-label="Trading Alerts">
              📊
            </span>
            <span className="font-bold text-lg">Trading Alerts</span>
          </SheetTitle>
        </SheetHeader>

        <div className="flex h-[calc(100%-73px)] flex-col">
          {/* Main Navigation */}
          <nav className="flex-1 space-y-1 px-3 py-4">
            <p className="px-3 mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
              Main Menu
            </p>

            {navigationItems.map((item) => {
              const Icon = item.icon;
              const accessible = canAccess(item.tier);
              const active = isActive(item.href);

              return (
                <Link
                  key={item.href}
                  href={accessible ? item.href : '/settings/billing'}
                  onClick={handleNavClick}
                  className={cn(
                    'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    active
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100',
                    !accessible && 'opacity-60'
                  )}
                >
                  <Icon
                    className={cn(
                      'h-5 w-5 shrink-0',
                      active
                        ? 'text-blue-600'
                        : 'text-gray-400 group-hover:text-gray-600'
                    )}
                  />
                  <span className="flex-1">{item.name}</span>

                  {/* Show lock icon for PRO-only items when user is FREE */}
                  {item.tier === 'PRO' && !accessible && (
                    <div className="flex items-center gap-1">
                      <Lock className="h-3.5 w-3.5 text-gray-400" />
                      <Badge
                        variant="secondary"
                        className="text-[10px] px-1.5 py-0 bg-amber-100 text-amber-700"
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
                onClick={handleNavClick}
                className="block w-full rounded-md bg-white/20 hover:bg-white/30 transition-colors text-center py-1.5 text-xs font-medium"
              >
                Upgrade Now
              </Link>
            </div>
          )}

          {/* Bottom Navigation */}
          <div className="border-t px-3 py-4 space-y-1">
            {bottomNavItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={handleNavClick}
                  className={cn(
                    'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    active
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  )}
                >
                  <Icon
                    className={cn(
                      'h-5 w-5 shrink-0',
                      active
                        ? 'text-blue-600'
                        : 'text-gray-400 group-hover:text-gray-600'
                    )}
                  />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
