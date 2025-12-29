'use client';

import {
  Bell,
  Settings,
  LogOut,
  Menu,
  ChevronDown,
  User,
  CreditCard,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { useState } from 'react';

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
  const router = useRouter();
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
    await signOut({ redirect: false });
    router.push('/login');
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
            >
              <Menu className="h-5 w-5" />
            </Button>

            {/* Logo */}
            <Link href="/dashboard" className="flex items-center gap-2">
              <span className="text-2xl" role="img" aria-label="Trading Alerts">
                📊
              </span>
              <span className="hidden sm:inline-block font-bold text-lg text-foreground">
                Trading Alerts
              </span>
            </Link>
          </div>

          {/* Right side: Notifications + User menu */}
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Tier Badge */}
            <Badge
              variant={user.tier === 'PRO' ? 'default' : 'secondary'}
              className={
                user.tier === 'PRO'
                  ? 'bg-primary hover:bg-primary/90 text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
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
                >
                  <Bell className="h-5 w-5" />
                  {/* Notification dot - show when there are unread notifications */}
                  <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel>Notifications</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="p-4 text-center text-sm text-muted-foreground">
                  <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No new notifications</p>
                  <p className="text-xs mt-1">
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
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage
                      src={user.image || undefined}
                      alt={user.name}
                    />
                    <AvatarFallback className="bg-blue-100 text-blue-600 text-sm">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:inline-block text-sm font-medium text-foreground">
                    {user.name.split(' ')[0]}
                  </span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">{user.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {user.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard/settings" className="cursor-pointer">
                      <User className="mr-2 h-4 w-4" />
                      Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link
                      href="/dashboard/settings/billing"
                      className="cursor-pointer"
                    >
                      <CreditCard className="mr-2 h-4 w-4" />
                      Billing
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard/settings" className="cursor-pointer">
                      <Settings className="mr-2 h-4 w-4" />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-red-600 focus:text-red-600 cursor-pointer"
                  onClick={handleLogout}
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
