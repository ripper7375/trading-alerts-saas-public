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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { Tier } from '@/lib/types';

interface ChatSidebarProps {
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  tier: Tier;
  onTierChange?: (tier: Tier) => void;
  onNavigate?: (page: 'Home' | 'Alerts') => void;
  onOpenUpgradeModal?: (featureName: string) => void;
  activePage?: 'Home' | 'Alerts';
  unreadAlertsCount?: number;
}

export function ChatSidebar({
  isCollapsed = false,
  onToggleCollapse,
  tier = 'PRO',
  onTierChange,
  onNavigate,
  onOpenUpgradeModal,
  activePage = 'Home',
  unreadAlertsCount = 3,
}: ChatSidebarProps) {
  const pathname = usePathname();
  const currentTier: Tier = pathname === '/free' ? 'FREE' : tier;
  const [selectedNav, setSelectedNav] = useState<'Home' | 'Alerts'>(activePage);
  const [activeSession, setActiveSession] = useState<string>(
    'XAUUSD M5 Scalp Setup'
  );

  const handleNavClick = (page: 'Home' | 'Alerts') => {
    if (page === 'Alerts' && currentTier === 'FREE') {
      if (onOpenUpgradeModal) {
        onOpenUpgradeModal('Alerts & Real-Time Notification Center');
      }
      return;
    }
    setSelectedNav(page);
    if (onNavigate) onNavigate(page);
  };

  const sessions = [
    'XAUUSD M5 Scalp Setup',
    'XAUUSD M15 EDT Retest',
    'XAUUSD Resistance Rejection',
    'XAUUSD Macro Structure',
  ];

  // Action A6: Trigger PNG Download of Part 24 Matplotlib 3-Panel Vision Render
  const handleDownloadPng = () => {
    const link = document.createElement('a');
    link.href = '/mtf_render_xauusd_sample.png';
    link.download = 'XAUUSD_Matplotlib_3Panel_Vision_Render.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <aside className="relative z-20 flex h-full w-full flex-col overflow-hidden border-r border-slate-800/80 bg-[#06070a] shadow-2xl select-none">
      {/* A1: Header / Brand & Tier Selector Dropdown */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-800/80 bg-[#090b11] px-3.5">
        {!isCollapsed && (
          <div className="flex min-w-0 flex-col justify-center">
            <div className="flex items-center gap-2 truncate text-base font-bold tracking-tight">
              <div className="relative h-6 w-6 shrink-0 overflow-hidden rounded-md shadow-xs ring-1 ring-amber-500/40">
                <Image
                  src="/DavinTrade_Logo.jpg"
                  alt="DavinTrade Logo"
                  fill
                  className="object-cover"
                  priority
                />
              </div>
              <span className="truncate bg-gradient-to-r from-amber-400 via-amber-200 to-amber-500 bg-clip-text font-extrabold text-transparent drop-shadow-xs">
                DavinTrade
              </span>

              {/* Tier Switcher Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="border-slate-750 ml-1 h-5 border px-1.5 font-mono text-[10px] font-bold hover:bg-slate-800"
                  >
                    <Badge
                      className={cn(
                        'px-1.5 py-0 font-mono text-[9px] font-bold',
                        currentTier === 'PRO'
                          ? 'border-amber-500/40 bg-amber-500/20 text-amber-300'
                          : 'border-slate-700 bg-slate-800 text-slate-300'
                      )}
                    >
                      {currentTier === 'PRO' ? '⚡ PRO' : '🔒 FREE'}
                    </Badge>
                    <ChevronDown className="ml-0.5 h-3 w-3 text-slate-400" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="border-slate-750 w-36 bg-[#0f1420] text-xs text-slate-200">
                  <DropdownMenuItem asChild>
                    <Link
                      href="/"
                      className="flex cursor-pointer items-center justify-between font-bold text-amber-300 hover:bg-amber-500/20"
                    >
                      <span>⚡ PRO Tier Page</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link
                      href="/free"
                      className="flex cursor-pointer items-center justify-between font-bold text-slate-300 hover:bg-slate-800"
                    >
                      <span>🔒 FREE Tier Page</span>
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
            'h-8 w-8 shrink-0 text-slate-400 hover:bg-slate-800/80 hover:text-slate-100',
            isCollapsed && 'mx-auto'
          )}
          title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      <ScrollArea className="flex-1 py-3">
        {/* A3: Navigation Items (Home vs Alerts with Notification Dot) */}
        <nav className="grid gap-1.5 px-2.5">
          <Button
            variant={selectedNav === 'Home' ? 'default' : 'ghost'}
            className={cn(
              'h-10 justify-start rounded-xl text-xs font-semibold transition-all',
              isCollapsed && 'justify-center px-0',
              selectedNav === 'Home'
                ? 'border border-amber-500/40 bg-amber-500/15 font-bold text-amber-400 shadow-md shadow-amber-500/10'
                : 'text-slate-300 hover:bg-slate-800/60 hover:text-slate-100'
            )}
            onClick={() => handleNavClick('Home')}
          >
            <LayoutDashboard
              className={cn(
                'h-4 w-4 shrink-0',
                !isCollapsed && 'mr-2.5',
                selectedNav === 'Home' && 'text-amber-400'
              )}
            />
            {!isCollapsed && <span className="truncate">Home</span>}
          </Button>

          {/* Alerts Feature - Gated with PRO Badge in FREE Tier */}
          <Button
            variant={selectedNav === 'Alerts' ? 'default' : 'ghost'}
            className={cn(
              'relative h-10 justify-start rounded-xl text-xs font-semibold transition-all',
              isCollapsed && 'justify-center px-0',
              selectedNav === 'Alerts'
                ? 'border border-amber-500/40 bg-amber-500/15 font-bold text-amber-400 shadow-md shadow-amber-500/10'
                : 'text-slate-300 hover:bg-slate-800/60 hover:text-slate-100'
            )}
            onClick={() => handleNavClick('Alerts')}
          >
            <div className="relative flex shrink-0 items-center">
              <Bell
                className={cn(
                  'h-4 w-4',
                  !isCollapsed && 'mr-2.5',
                  selectedNav === 'Alerts' && 'text-amber-400'
                )}
              />
              {unreadAlertsCount > 0 && currentTier === 'PRO' && (
                <span className="absolute -top-1 -right-1 h-2 w-2 animate-pulse rounded-full bg-rose-500 ring-2 ring-[#06070a]" />
              )}
            </div>
            {!isCollapsed && (
              <div className="flex min-w-0 flex-1 items-center justify-between">
                <span className="truncate">Alerts</span>
                {currentTier === 'FREE' ? (
                  <Badge className="h-4 shrink-0 gap-0.5 border-amber-500/50 bg-amber-500/10 px-1 font-mono text-[9px] text-amber-400">
                    <Lock className="inline h-2.5 w-2.5" /> PRO
                  </Badge>
                ) : unreadAlertsCount > 0 ? (
                  <Badge className="h-4 shrink-0 border-rose-500/40 bg-rose-500/20 px-1.5 font-mono text-[9px] text-rose-300">
                    {unreadAlertsCount}
                  </Badge>
                ) : null}
              </div>
            )}
          </Button>
        </nav>

        {/* A4: Sessions Section with Highlight Mark on Selected Session */}
        <div className="mt-6 px-2.5">
          {!isCollapsed && (
            <h3 className="mb-2.5 truncate px-2 text-xs font-bold tracking-wider text-slate-300 uppercase">
              SESSIONS
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
                    'h-8.5 justify-start rounded-xl text-xs font-medium transition-all',
                    isCollapsed && 'justify-center px-0',
                    isActive
                      ? 'border border-amber-500/50 bg-amber-500/15 font-bold text-amber-300 shadow-xs shadow-amber-500/10'
                      : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-100'
                  )}
                >
                  <MessageSquare
                    className={cn(
                      'h-3.5 w-3.5 shrink-0 transition-colors',
                      !isCollapsed && 'mr-2',
                      isActive ? 'text-amber-400' : 'text-amber-400/60'
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

      {/* Action A6: PNG Download + FREE Tier Upgrade CTA */}
      <div className="shrink-0 space-y-2 border-t border-slate-800/80 bg-[#090b11] p-2.5">
        {currentTier === 'FREE' && (
          <Link href="/">
            <Button
              size="sm"
              className="h-8 w-full bg-gradient-to-r from-amber-500 to-amber-600 text-xs font-extrabold text-slate-950 shadow-md shadow-amber-500/20 hover:from-amber-400 hover:to-amber-500"
            >
              <Sparkles className="mr-1.5 h-3.5 w-3.5 fill-black" />
              Upgrade to PRO
            </Button>
          </Link>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={handleDownloadPng}
          className={cn(
            'h-auto w-full flex-col justify-center rounded-xl border-amber-500/30 bg-amber-500/5 py-2 text-center shadow-xs transition-all hover:border-amber-500/60 hover:bg-amber-500/15',
            isCollapsed && 'p-2'
          )}
        >
          {!isCollapsed ? (
            <div className="flex min-w-0 flex-col items-center">
              <span className="flex items-center gap-1.5 truncate text-xs font-bold text-amber-400">
                <Download className="h-3.5 w-3.5 shrink-0" />
                PNG Download
              </span>
              <span className="mt-0.5 truncate font-mono text-[9px] text-slate-400">
                Matplotlib 3-Panel Vision Render
              </span>
            </div>
          ) : (
            <Download className="h-4 w-4 shrink-0 text-amber-400" />
          )}
        </Button>
      </div>

      {/* A7: User Profile Footer */}
      <div className="shrink-0 border-t border-slate-800/80 bg-[#07090e] p-2.5">
        <div
          className={cn(
            'flex min-w-0 cursor-pointer items-center gap-2.5 rounded-xl border border-slate-800 bg-[#0d101a] p-2 shadow-inner transition-colors hover:bg-slate-800/60',
            isCollapsed && 'justify-center border-0 bg-transparent p-1'
          )}
        >
          <Avatar className="h-7 w-7 shrink-0 ring-1 ring-amber-500/40">
            <AvatarImage src="/placeholder-user.jpg" />
            <AvatarFallback className="bg-slate-800 text-xs text-slate-200">
              TU
            </AvatarFallback>
          </Avatar>
          {!isCollapsed && (
            <div className="flex flex-1 flex-col overflow-hidden">
              <span className="truncate text-xs font-bold text-slate-100">
                Trader User
              </span>
              <span
                className={cn(
                  'flex items-center gap-1 truncate text-[10px] font-bold',
                  currentTier === 'PRO' ? 'text-amber-400' : 'text-slate-400'
                )}
              >
                <ShieldCheck className="h-3 w-3 shrink-0" />
                {currentTier === 'PRO' ? 'Pro Plan' : 'Free Plan'}
              </span>
            </div>
          )}
          {!isCollapsed && (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          )}
        </div>
      </div>
    </aside>
  );
}
