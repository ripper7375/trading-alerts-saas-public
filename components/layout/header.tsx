'use client';

import {
  Bell,
  Settings,
  LogOut,
  Menu,
  ChevronDown,
  User,
  CreditCard,
  Shield,
} from 'lucide-react';

import Link from 'next/link';
import { getSession, signOut } from 'next-auth/react';
import { useState } from 'react';

import { isAuthBridgeEnabled } from '@/lib/auth/auth-bridge-flag';
import { MobileNav } from '@/components/layout/mobile-nav';
import { ThemeToggle } from '@/components/theme-toggle';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface HeaderUser {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  tier: string;
  role: string;
}

interface HeaderProps {
  user: HeaderUser;
}

/**
 * Dashboard Header Component
 *
 * Features:
 * - Logo and app name
 * - User menu with avatar, tier badge, settings, and logout
 * - Notification bell
 * - Mobile navigation trigger
 */
export function Header({ user }: HeaderProps): React.ReactElement {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Get user initials for avatar fallback
  const initials = user.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  // Handle logout
  const handleLogout = async (): Promise<void> => {
    if (isAuthBridgeEnabled()) {
      // Bridge path (Session 4B-21, DECISION-LOG.md F56/F57): token-logout
      // clears the shared session cookie server-side. signOut({redirect:
      // false}) is ALSO called alongside it (Davin's explicit direction) so
      // next-auth/react's own SessionProvider state is purged via its own
      // native path too, not just the getSession() refetch — belt-and-
      // suspenders against any stale internal NextAuth client state before a
      // user switches to a different OAuth provider. OAuth's own
      // [...nextauth] route stays live (Option B, F56), so this call
      // continues to resolve normally.
      await fetch('/api/auth/token-logout', { method: 'POST' });
      await signOut({ redirect: false });
      await getSession();
      // Full browser navigation (not router.push) so no in-memory React/
      // SessionProvider state or pending cookie header survives into the
      // next sign-in — a stale client-side session reference here is what
      // lets NextAuth silently attempt OAuth account linking against the
      // previous session on the very next login.
      window.location.href = '/login';
      return;
    }
    await signOut({ redirect: false });
    window.location.href = '/login';
  };

  return (
    <>
      <header className="sticky top-0 z-40 border-b bg-background">
        <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Left side: Logo + Mobile menu button */}
          <div className="flex items-center gap-4">
            {/* Mobile menu button */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open menu"
              data-testid="mobile-menu-button"
            >
              <Menu className="h-5 w-5" />
            </Button>

            {/* Logo */}
            <Link href="/dashboard" className="flex items-center gap-2">
              <span className="text-2xl" role="img" aria-label="Trading Alerts">
                📊
              </span>
              <span className="hidden text-lg font-bold text-foreground sm:inline-block">
                Trading Alerts
              </span>
            </Link>
          </div>

          {/* Right side: Notifications + User menu */}
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Tier Badge */}
            <Badge
              variant={user.tier === 'PRO' ? 'default' : 'secondary'}
              data-testid="tier-badge"
              className={
                user.tier === 'PRO'
                  ? 'hover:bg-primary/90 bg-primary text-primary-foreground'
                  : 'hover:bg-secondary/80 bg-secondary text-secondary-foreground'
              }
            >
              {user.tier === 'PRO' ? '⭐ PRO' : 'FREE'}
            </Badge>

            {/* Notifications */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative"
                  aria-label="Notifications"
                  data-testid="notification-bell"
                >
                  <Bell className="h-5 w-5" />
                  {/* Notification dot - show when there are unread notifications */}
                  <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-80"
                data-testid="notification-dropdown"
              >
                <DropdownMenuLabel>Notifications</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="p-4 text-center text-sm text-muted-foreground">
                  <Bell className="mx-auto mb-2 h-8 w-8 opacity-50" />
                  <p>No new notifications</p>
                  <p className="mt-1 text-xs">
                    You&apos;ll be notified when your alerts are triggered
                  </p>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Theme Toggle */}
            <ThemeToggle />

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="flex items-center gap-2 pl-2 pr-1"
                  data-testid="user-menu-button"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage
                      src={user.image || undefined}
                      alt={user.name}
                    />
                    <AvatarFallback className="bg-blue-100 text-sm text-blue-600">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden text-sm font-medium text-foreground sm:inline-block">
                    {user.name.split(' ')[0]}
                  </span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-56"
                data-testid="user-menu-dropdown"
              >
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium" data-testid="user-name">
                      {user.name}
                    </p>
                    <p
                      className="text-xs text-muted-foreground"
                      data-testid="user-email"
                    >
                      {user.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem asChild>
                    <Link
                      href="/settings"
                      className="cursor-pointer"
                      data-testid="menu-profile"
                    >
                      <User className="mr-2 h-4 w-4" />
                      Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link
                      href="/settings/billing"
                      className="cursor-pointer"
                      data-testid="menu-billing"
                    >
                      <CreditCard className="mr-2 h-4 w-4" />
                      Billing
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link
                      href="/settings"
                      className="cursor-pointer"
                      data-testid="menu-settings"
                    >
                      <Settings className="mr-2 h-4 w-4" />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                  {user.role === 'ADMIN' && (
                    <DropdownMenuItem asChild>
                      <Link
                        href="/admin"
                        className="cursor-pointer font-semibold text-red-600 hover:text-red-700 dark:text-red-400"
                        data-testid="menu-admin"
                      >
                        <Shield className="mr-2 h-4 w-4" />
                        Admin Executive Dashboard
                      </Link>
                    </DropdownMenuItem>
                  )}
                </DropdownMenuGroup>

                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer text-red-600 focus:text-red-600"
                  onClick={handleLogout}
                  data-testid="logout-button"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Mobile Navigation Sheet */}
      <MobileNav
        isOpen={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        userTier={user.tier}
      />
    </>
  );
}
