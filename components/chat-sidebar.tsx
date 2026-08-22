'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Bell,
  MessageSquare,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Download,
  ShieldCheck,
  Sparkles,
  Lock,
  Home,
  CreditCard,
  Settings,
  Share2,
  LogOut,
  Inbox,
  HelpCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { Tier } from '@/lib/tier-config';
import { useLocale } from '@/lib/context/locale-context';

interface ChatSidebarProps {
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  tier?: Tier;
  onTierChange?: (tier: Tier) => void;
  onNavigate?: (page: any) => void;
  onOpenUpgradeModal?: (featureName: string) => void;
  activePage?: string;
  unreadAlertsCount?: number;
}

/**
 * Batch-0 finding (codebase-2-parity-audit/batch-0-shared-shell.md): the
 * seed-code version of this file hardcodes slate-N and dark:bg-[hex] classes
 * regardless of theme, so Light Clean Mode never actually re-themes it.
 * Rewritten here to use the sidebar-N semantic tokens (app/globals.css,
 * Session 9-1) instead -- same structure and icons, theme-reactive colors.
 */
export function ChatSidebar({
  isCollapsed = false,
  onToggleCollapse,
  tier = 'PRO',
  unreadAlertsCount = 3,
}: ChatSidebarProps) {
  const pathname = usePathname();
  const { t } = useLocale();
  const currentTier: Tier = pathname === '/free' ? 'FREE' : tier;
  const [activeSession, setActiveSession] = useState<string>(
    'XAUUSD M5 Scalp Setup'
  );

  const sessions = [
    'XAUUSD M5 Scalp Setup',
    'XAUUSD M15 EDT Retest',
    'XAUUSD Resistance Rejection',
    'XAUUSD Macro Structure',
  ];

  const handleDownloadPng = () => {
    const link = document.createElement('a');
    link.href = '/mtf_render_xauusd_sample.png';
    link.download = 'XAUUSD_Matplotlib_3Panel_Vision_Render.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const navItems = [
    {
      label: t('nav.dashboard', 'Main Dashboard'),
      href: '/dashboard',
      icon: LayoutDashboard,
    },
    {
      label: t('nav.home', 'Home Page'),
      href: '/',
      icon: Home,
    },
    {
      label: t('nav.alerts', 'Real-Time Alerts'),
      href: '/alerts',
      icon: Bell,
      badge: currentTier === 'FREE' ? 'PRO' : unreadAlertsCount,
      isProGated: currentTier === 'FREE',
    },
    {
      label: t('nav.notifications', 'Notifications'),
      href: '/notifications',
      icon: Inbox,
    },
    ...(currentTier === 'FREE'
      ? [
          {
            label: t('nav.pro_upgrade', 'PRO Upgrade'),
            href: '/pricing',
            icon: CreditCard,
          },
        ]
      : []),
  ];

  const managementNavItems = [
    {
      label: t('nav.profile', 'Account Settings'),
      href: '/settings/profile',
      icon: Settings,
    },
    {
      label: t('nav.help', 'Help & Support'),
      href: '/settings/help',
      icon: HelpCircle,
    },
    {
      label: t('nav.affiliate', 'Affiliate Portal'),
      href: '/affiliate/dashboard',
      icon: Share2,
    },
  ];

  return (
    <aside className="relative z-20 flex h-full w-full select-none flex-col overflow-hidden border-r border-sidebar-border bg-sidebar shadow-2xl">
      {/* Brand & Tier Selector Dropdown */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-sidebar-border bg-sidebar px-3.5">
        {!isCollapsed && (
          <div className="flex min-w-0 flex-col justify-center">
            <div className="flex items-center gap-2 truncate text-base font-bold tracking-tight">
              <Link href="/" className="flex items-center gap-2">
                <div className="shadow-xs relative h-6 w-6 shrink-0 overflow-hidden rounded-md ring-1 ring-amber-500/40">
                  <Image
                    src="/DavinTrade_Logo.jpg"
                    alt="DavinTrade Logo"
                    fill
                    className="object-cover"
                    priority
                  />
                </div>
                <span className="drop-shadow-xs truncate bg-gradient-to-r from-amber-400 via-amber-200 to-amber-500 bg-clip-text font-extrabold text-transparent">
                  DavinTrade
                </span>
              </Link>

              {/* Tier Switcher Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-1 h-5 border border-sidebar-border px-1.5 font-mono text-[10px] font-bold hover:bg-sidebar-accent"
                  >
                    <Badge
                      className={cn(
                        'px-1.5 py-0 font-mono text-[9px] font-bold',
                        currentTier === 'PRO'
                          ? 'border-amber-500/40 bg-amber-500/20 text-amber-700 dark:text-amber-300'
                          : 'border-border bg-muted text-muted-foreground'
                      )}
                    >
                      {currentTier === 'PRO' ? t('⚡ PRO') : t('🔒 FREE')}
                    </Badge>
                    <ChevronDown className="ml-0.5 h-3 w-3 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-36 border-sidebar-border bg-popover text-xs text-popover-foreground">
                  <DropdownMenuItem asChild>
                    <Link
                      href="/terminal"
                      className="flex cursor-pointer items-center justify-between font-bold text-amber-700 hover:bg-amber-500/20 dark:text-amber-300"
                    >
                      <span>{t('⚡ PRO Tier Page')}</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link
                      href="/free"
                      className="flex cursor-pointer items-center justify-between font-bold text-popover-foreground hover:bg-sidebar-accent"
                    >
                      <span>{t('🔒 FREE Tier Page')}</span>
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        )}

        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleCollapse}
          className={cn(
            'h-8 w-8 shrink-0 text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground',
            isCollapsed && 'mx-auto'
          )}
          title={isCollapsed ? t('Expand Sidebar') : t('Collapse Sidebar')}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      <ScrollArea className="flex-1 py-3">
        {/* Main Navigation Menu */}
        <nav className="grid gap-1 px-2.5">
          {navItems.map((item, index) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Button
                key={index}
                asChild
                variant={isActive ? 'default' : 'ghost'}
                className={cn(
                  'h-9 justify-start rounded-xl text-xs font-semibold transition-all',
                  isCollapsed && 'justify-center px-0',
                  isActive
                    ? 'border-[var(--primary)]/40 bg-[var(--primary)]/15 shadow-[var(--primary)]/10 border font-bold text-[var(--primary)] shadow-md'
                    : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                )}
              >
                <Link href={item.href}>
                  <Icon
                    className={cn(
                      'h-4 w-4 shrink-0',
                      !isCollapsed && 'mr-2.5',
                      isActive && 'text-[var(--primary)]'
                    )}
                  />
                  {!isCollapsed && (
                    <div className="flex min-w-0 flex-1 items-center justify-between">
                      <span className="truncate">{item.label}</span>
                      {item.badge && (
                        <Badge
                          className={cn(
                            'h-4 shrink-0 px-1.5 font-mono text-[9px]',
                            item.isProGated
                              ? 'border-[var(--primary)]/50 bg-[var(--primary)]/10 gap-0.5 text-[var(--primary)]'
                              : 'border-rose-500/40 bg-rose-500/20 text-rose-700 dark:text-rose-300'
                          )}
                        >
                          {item.isProGated && (
                            <Lock className="mr-0.5 inline h-2.5 w-2.5" />
                          )}
                          {item.badge}
                        </Badge>
                      )}
                    </div>
                  )}
                </Link>
              </Button>
            );
          })}
        </nav>

        {/* Management Navigation */}
        <div className="mt-4 px-2.5">
          {!isCollapsed && (
            <h3 className="mb-2 truncate px-2 text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
              {t('nav.management_header', 'MANAGEMENT')}
            </h3>
          )}
          <nav className="grid gap-1">
            {managementNavItems.map((item, index) => {
              const Icon = item.icon;
              const isActive = pathname.startsWith(item.href);
              return (
                <Button
                  key={index}
                  asChild
                  variant="ghost"
                  className={cn(
                    'h-8.5 justify-start rounded-xl text-xs font-medium transition-all',
                    isCollapsed && 'justify-center px-0',
                    isActive
                      ? 'border-[var(--primary)]/30 bg-[var(--primary)]/10 border font-bold text-[var(--primary)]'
                      : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground'
                  )}
                >
                  <Link href={item.href}>
                    <Icon className="mr-2 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    {!isCollapsed && (
                      <span className="truncate text-[11px]">{item.label}</span>
                    )}
                  </Link>
                </Button>
              );
            })}
          </nav>
        </div>

        {/* Sessions Section */}
        <div className="mt-4 px-2.5">
          {!isCollapsed && (
            <h3 className="mb-2 truncate px-2 text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
              {t('nav.sessions_header', 'SESSIONS')}
            </h3>
          )}
          <div className="grid gap-1">
            {sessions.map((session, index) => {
              const isActive = activeSession === session;
              return (
                <Button
                  key={index}
                  variant="ghost"
                  onClick={() => setActiveSession(session)}
                  className={cn(
                    'h-8 justify-start rounded-lg text-xs font-medium transition-all',
                    isCollapsed && 'justify-center px-0',
                    isActive
                      ? 'border-[var(--primary)]/50 bg-[var(--primary)]/15 shadow-[var(--primary)]/10 shadow-xs border font-bold text-[var(--primary)]'
                      : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground'
                  )}
                >
                  <MessageSquare
                    className={cn(
                      'h-3.5 w-3.5 shrink-0 transition-colors',
                      !isCollapsed && 'mr-2',
                      isActive
                        ? 'text-[var(--primary)]'
                        : 'text-[var(--primary)]/60'
                    )}
                  />
                  {!isCollapsed && (
                    <span className="truncate text-[11px]">{session}</span>
                  )}
                </Button>
              );
            })}
          </div>
        </div>
      </ScrollArea>

      {/* Action Section: PNG Download + Upgrade CTA */}
      <div className="shrink-0 space-y-2 border-t border-sidebar-border bg-sidebar p-2.5">
        {currentTier === 'FREE' && (
          <Link href="/pricing">
            <Button
              size="sm"
              className="h-8 w-full bg-gradient-to-r from-amber-500 to-amber-600 text-xs font-extrabold text-slate-950 shadow-md shadow-amber-500/20 hover:from-amber-400 hover:to-amber-500"
            >
              <Sparkles className="mr-1.5 h-3.5 w-3.5 fill-black" />
              {t('Upgrade to PRO')}
            </Button>
          </Link>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={handleDownloadPng}
          className={cn(
            'border-[var(--primary)]/30 bg-[var(--primary)]/5 shadow-xs hover:border-[var(--primary)]/60 hover:bg-[var(--primary)]/15 h-auto w-full flex-col justify-center rounded-xl py-2 text-center transition-all',
            isCollapsed && 'p-2'
          )}
        >
          {!isCollapsed ? (
            <div className="flex min-w-0 flex-col items-center">
              <span className="flex items-center gap-1.5 truncate text-xs font-bold text-[var(--primary)]">
                <Download className="h-3.5 w-3.5 shrink-0" />
                {t('PNG Download')}
              </span>
              <span className="mt-0.5 truncate font-mono text-[9px] text-muted-foreground">
                {t('Matplotlib 3-Panel Vision Render')}
              </span>
            </div>
          ) : (
            <Download className="h-4 w-4 shrink-0 text-[var(--primary)]" />
          )}
        </Button>
      </div>

      {/* User Profile Footer */}
      <div className="shrink-0 border-t border-sidebar-border bg-sidebar p-2.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div
              className={cn(
                'bg-sidebar-accent/30 flex min-w-0 cursor-pointer items-center gap-2.5 rounded-xl border border-sidebar-border p-2 shadow-inner transition-colors hover:bg-sidebar-accent',
                isCollapsed && 'justify-center border-0 bg-transparent p-1'
              )}
            >
              <Avatar className="h-7 w-7 shrink-0 ring-1 ring-amber-500/40">
                <AvatarImage src="/placeholder-user.jpg" />
                <AvatarFallback className="bg-muted text-xs text-muted-foreground">
                  TU
                </AvatarFallback>
              </Avatar>
              {!isCollapsed && (
                <div className="flex flex-1 flex-col overflow-hidden">
                  <span className="truncate text-xs font-bold text-sidebar-foreground">
                    {t('Trader User')}
                  </span>
                  <span
                    className={cn(
                      'flex items-center gap-1 truncate text-[10px] font-bold',
                      currentTier === 'PRO'
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-muted-foreground'
                    )}
                  >
                    <ShieldCheck className="h-3 w-3 shrink-0" />
                    {currentTier === 'PRO' ? t('Pro Plan') : t('Free Plan')}
                  </span>
                </div>
              )}
              {!isCollapsed && (
                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              )}
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-48 border-sidebar-border bg-popover text-xs text-popover-foreground">
            <DropdownMenuLabel className="font-bold text-amber-600 dark:text-amber-400">
              {t('Account Options')}
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-border" />
            <DropdownMenuItem asChild>
              <Link href="/settings/profile" className="cursor-pointer">
                {t('Profile Settings')}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings/security" className="cursor-pointer">
                {t('Security & 2FA')}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings/billing" className="cursor-pointer">
                {t('Billing & Invoices')}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-border" />
            <DropdownMenuItem asChild>
              <Link
                href="/login"
                className="flex cursor-pointer items-center text-rose-600 dark:text-rose-400"
              >
                <LogOut className="mr-1.5 h-3.5 w-3.5" /> {t('Log out')}
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
