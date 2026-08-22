'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { getSession, signOut, useSession } from 'next-auth/react';
import {
  Bell,
  Sparkles,
  User,
  Shield,
  LayoutDashboard,
  LineChart,
  Settings,
  LogOut,
  ChevronRight,
  ChevronDown,
  ShieldAlert,
  Share2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { isAuthBridgeEnabled } from '@/lib/auth/auth-bridge-flag';
import { useLocale } from '@/lib/context/locale-context';
import { SUPPORTED_COUNTRIES } from '@/lib/country-config';

interface AppHeaderProps {
  title?: string;
  subtitle?: string;
  tier?: 'PRO' | 'FREE';
}

/**
 * Batch-0 finding (codebase-2-parity-audit/batch-0-shared-shell.md): the
 * seed-code version of this file hardcodes slate-N and dark:bg-[hex] classes
 * regardless of theme, so Light Clean Mode never actually re-themes it.
 * Rewritten here to use semantic tokens (bg-card/bg-background/border-border/
 * text-foreground/text-muted-foreground/bg-popover) instead -- same
 * structure and icons, theme-reactive colors.
 */
export default function AppHeader({
  title,
  subtitle,
  tier = 'PRO',
}: AppHeaderProps) {
  const pathname = usePathname();
  const { t, countryCode, countryConfig, setCountryCode } = useLocale();
  const { data: session } = useSession();
  const currentTier = pathname.startsWith('/free')
    ? 'FREE'
    : ((session?.user?.tier as 'PRO' | 'FREE' | undefined) ?? tier);
  const userName = session?.user?.name || 'Trader';
  const userInitials = userName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
  const isAdmin = session?.user?.role === 'ADMIN';

  // Same bridge-aware logout as components/layout/header.tsx (the component
  // this file retires) -- see that file's own comment for why both the
  // token-logout endpoint AND next-auth's own signOut() are called.
  const handleLogout = async (): Promise<void> => {
    if (isAuthBridgeEnabled()) {
      await fetch('/api/auth/token-logout', { method: 'POST' });
      await signOut({ redirect: false });
      await getSession();
      window.location.href = '/login';
      return;
    }
    await signOut({ redirect: false });
    window.location.href = '/login';
  };

  return (
    <header className="z-20 flex h-14 w-full shrink-0 select-none items-center justify-between border-b border-border bg-card px-4 shadow-sm">
      {/* Left: Brand Logo & Current Section Title */}
      <div className="flex items-center gap-3">
        <Link href="/" className="flex items-center gap-2">
          <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded-lg ring-1 ring-amber-500/40">
            <Image
              src="/DavinTrade_Logo.jpg"
              alt="DavinTrade Logo"
              fill
              className="object-cover"
            />
          </div>
          <span className="hidden bg-gradient-to-r from-amber-400 via-amber-200 to-amber-500 bg-clip-text text-sm font-extrabold tracking-tight text-transparent sm:inline">
            DavinTrade
          </span>
        </Link>

        <ChevronRight className="hidden h-4 w-4 text-muted-foreground sm:inline" />

        <div className="flex flex-col">
          <h1 className="flex items-center gap-2 text-xs font-bold text-foreground">
            {title || 'Dashboard'}
            <Badge
              className={
                currentTier === 'PRO'
                  ? 'border-amber-500/40 bg-amber-500/20 px-1.5 py-0 font-mono text-[9px] text-amber-700 dark:text-amber-300'
                  : 'border-border bg-muted px-1.5 py-0 font-mono text-[9px] text-muted-foreground'
              }
            >
              {currentTier === 'PRO' ? '⚡ PRO' : '🔒 FREE'}
            </Badge>
          </h1>
          {subtitle && (
            <p className="hidden truncate text-[10px] text-muted-foreground md:inline">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {/* Middle: Quick Action Tabs */}
      <div className="hidden items-center gap-1 rounded-xl border border-border bg-background p-1 md:flex">
        <Link href="/dashboard">
          <Button
            variant="ghost"
            size="sm"
            className={`h-7 px-3 text-xs font-medium ${
              pathname === '/dashboard'
                ? 'bg-accent font-bold text-[var(--primary)]'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <LayoutDashboard className="mr-1.5 h-3.5 w-3.5" />
            {t('nav.dashboard', 'Dashboard')}
          </Button>
        </Link>
        <Link href={currentTier === 'FREE' ? '/free' : '/terminal'}>
          <Button
            variant="ghost"
            size="sm"
            className={`h-7 px-3 text-xs font-medium ${
              pathname === '/terminal' || pathname === '/free'
                ? 'border-[var(--primary)]/30 bg-[var(--primary)]/20 border font-bold text-[var(--primary)]'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <LineChart className="mr-1.5 h-3.5 w-3.5 text-[var(--primary)]" />
            {t('nav.ai_workbench', 'AI Analyst Workbench')}
          </Button>
        </Link>
        <Link href="/alerts">
          <Button
            variant="ghost"
            size="sm"
            className={`h-7 px-3 text-xs font-medium ${
              pathname.startsWith('/alerts')
                ? 'bg-accent font-bold text-[var(--primary)]'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Bell className="mr-1.5 h-3.5 w-3.5" />
            {t('nav.alerts', 'Alerts')}
          </Button>
        </Link>
      </div>

      {/* Right: Country Selector, Notifications & User Profile */}
      <div className="flex items-center gap-2">
        {/* Quick Country Switcher Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 border border-border bg-card px-2 font-mono text-xs font-bold text-foreground hover:bg-accent"
              title={t('Select Country & Region')}
            >
              <span className="text-sm">{countryConfig?.flag || '🇬🇧'}</span>
              <span className="hidden font-sans text-[11px] font-bold text-amber-700 dark:text-amber-300 sm:inline">
                {countryConfig?.code || 'GB'}
              </span>
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="max-h-72 w-48 overflow-y-auto border-border bg-popover text-xs text-popover-foreground">
            <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              {t('Select Country & Region')}
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-border" />
            {Object.values(SUPPORTED_COUNTRIES).map((c) => (
              <DropdownMenuItem
                key={c.code}
                onClick={() => setCountryCode(c.code)}
                className={`flex cursor-pointer items-center justify-between py-1.5 ${
                  countryCode === c.code
                    ? 'bg-amber-500/20 font-bold text-amber-700 dark:text-amber-300'
                    : ''
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">{c.flag}</span>
                  <span>{t(c.name)}</span>
                </div>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {c.symbol}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {currentTier === 'FREE' && (
          <Link href="/pricing">
            <Button
              size="sm"
              className="h-7 bg-gradient-to-r from-amber-500 to-amber-600 px-2.5 text-xs font-extrabold text-slate-950 shadow-md shadow-amber-500/20 hover:from-amber-400 hover:to-amber-500"
            >
              <Sparkles className="mr-1 h-3.5 w-3.5 fill-black" />
              {t('Upgrade')}
            </Button>
          </Link>
        )}

        <Link href="/alerts">
          <Button
            variant="ghost"
            size="icon"
            className="relative h-8 w-8 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute right-1.5 top-1.5 h-2 w-2 animate-pulse rounded-full bg-rose-500 ring-2 ring-card" />
          </Button>
        </Link>

        {/* User Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-2 p-1 hover:bg-accent"
            >
              <Avatar className="h-6 w-6 ring-1 ring-amber-500/40">
                <AvatarImage src={session?.user?.image || undefined} />
                <AvatarFallback className="bg-muted text-[10px] text-muted-foreground">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <span className="hidden text-xs font-bold text-foreground sm:inline">
                {userName}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-52 border-border bg-popover text-xs text-popover-foreground">
            <DropdownMenuLabel className="font-bold text-amber-600 dark:text-amber-400">
              {session?.user?.email || t('Trader Account')}
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-border" />
            <DropdownMenuItem asChild>
              <Link
                href="/settings/profile"
                className="flex cursor-pointer items-center"
              >
                <User className="mr-2 h-3.5 w-3.5 text-muted-foreground" />{' '}
                {t('Profile Settings')}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link
                href="/settings/security"
                className="flex cursor-pointer items-center"
              >
                <Shield className="mr-2 h-3.5 w-3.5 text-muted-foreground" />{' '}
                {t('Security & 2FA')}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link
                href="/settings/billing"
                className="flex cursor-pointer items-center"
              >
                <Settings className="mr-2 h-3.5 w-3.5 text-muted-foreground" />{' '}
                {t('Billing & Invoices')}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-border" />
            <DropdownMenuItem asChild>
              <Link
                href="/affiliate/dashboard"
                className="flex cursor-pointer items-center"
              >
                <Share2 className="mr-2 h-3.5 w-3.5 text-muted-foreground" />{' '}
                {t('Affiliate Partner Dashboard')}
              </Link>
            </DropdownMenuItem>
            {isAdmin && (
              <DropdownMenuItem asChild>
                <Link
                  href="/admin"
                  className="flex cursor-pointer items-center"
                >
                  <ShieldAlert className="mr-2 h-3.5 w-3.5 text-muted-foreground" />{' '}
                  {t('nav.admin', 'Admin Control')}
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator className="bg-border" />
            <DropdownMenuItem
              onClick={handleLogout}
              className="flex cursor-pointer items-center text-rose-600 dark:text-rose-400"
            >
              <LogOut className="mr-2 h-3.5 w-3.5" /> {t('Log out')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
