'use client';

import { useState } from 'react';
import Image from 'next/image';
import {
  LayoutDashboard,
  Bell,
  MessageSquare,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Download,
  ShieldCheck,
  Settings,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Tier } from '@/lib/types';

interface ChatSidebarProps {
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  tier: Tier;
  onTierChange: (tier: Tier) => void;
  onNavigate?: (page: 'Home' | 'Alerts') => void;
  activePage?: 'Home' | 'Alerts';
  unreadAlertsCount?: number;
}

export function ChatSidebar({
  isCollapsed = false,
  onToggleCollapse,
  tier,
  onNavigate,
  activePage = 'Home',
  unreadAlertsCount = 3,
}: ChatSidebarProps) {
  const [selectedNav, setSelectedNav] = useState<'Home' | 'Alerts'>(activePage);

  const handleNavClick = (page: 'Home' | 'Alerts') => {
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
    <aside
      className={cn(
        'relative z-20 flex flex-col border-r border-slate-800/80 bg-[#06070a] shadow-2xl transition-all duration-300 select-none',
        isCollapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* A1: Header / Brand */}
      <div className="flex h-14 items-center justify-between border-b border-slate-800/80 bg-[#090b11] px-3.5">
        {!isCollapsed && (
          <div className="flex items-center gap-2.5 text-lg font-bold tracking-tight">
            <div className="relative h-7 w-7 overflow-hidden rounded-md shadow-xs ring-1 ring-amber-500/40">
              <Image
                src="/DavinTrade_Logo.jpg"
                alt="DavinTrade Logo"
                fill
                className="object-cover"
                priority
              />
            </div>
            <span className="bg-gradient-to-r from-amber-400 via-amber-200 to-amber-500 bg-clip-text font-extrabold text-transparent drop-shadow-xs">
              DavinTrade
            </span>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleCollapse}
          className={cn(
            'h-8 w-8 text-slate-400 hover:bg-slate-800/80 hover:text-slate-100',
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
                'h-4 w-4',
                !isCollapsed && 'mr-2.5',
                selectedNav === 'Home' && 'text-amber-400'
              )}
            />
            {!isCollapsed && <span>Home</span>}
          </Button>

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
            <div className="relative flex items-center">
              <Bell
                className={cn(
                  'h-4 w-4',
                  !isCollapsed && 'mr-2.5',
                  selectedNav === 'Alerts' && 'text-amber-400'
                )}
              />
              {unreadAlertsCount > 0 && (
                <span className="absolute -top-1 -right-1 h-2 w-2 animate-pulse rounded-full bg-rose-500 ring-2 ring-[#06070a]" />
              )}
            </div>
            {!isCollapsed && (
              <div className="flex flex-1 items-center justify-between">
                <span>Alerts</span>
                {unreadAlertsCount > 0 && (
                  <Badge className="h-4 border-rose-500/40 bg-rose-500/20 px-1.5 font-mono text-[9px] text-rose-300">
                    {unreadAlertsCount}
                  </Badge>
                )}
              </div>
            )}
          </Button>
        </nav>

        {/* A4: Sessions Section with Larger Font Header */}
        <div className="mt-6 px-2.5">
          {!isCollapsed && (
            <h3 className="mb-2.5 px-2 text-xs font-bold tracking-wider text-slate-300 uppercase">
              SESSIONS
            </h3>
          )}
          <div className="grid gap-1">
            {sessions.map((session, index) => (
              <Button
                key={index}
                variant="ghost"
                className={cn(
                  'h-8 justify-start rounded-lg text-xs font-normal text-slate-400 hover:bg-slate-800/50 hover:text-slate-100',
                  isCollapsed && 'justify-center px-0'
                )}
              >
                <MessageSquare
                  className={cn(
                    'h-3.5 w-3.5 shrink-0 text-amber-400/80',
                    !isCollapsed && 'mr-2'
                  )}
                />
                {!isCollapsed && (
                  <span className="truncate text-[11px]">{session}</span>
                )}
              </Button>
            ))}
          </div>
        </div>
      </ScrollArea>

      {/* A6: Transformation of Theme Button to PNG Download Button */}
      <div className="border-t border-slate-800/80 bg-[#090b11] p-2.5">
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
            <div className="flex flex-col items-center">
              <span className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
                <Download className="h-3.5 w-3.5" />
                PNG Download
              </span>
              <span className="mt-0.5 font-mono text-[9px] text-slate-400">
                Matplotlib 3-Panel Vision Render
              </span>
            </div>
          ) : (
            <Download className="h-4 w-4 text-amber-400" />
          )}
        </Button>
      </div>

      {/* A7: User Profile Footer */}
      <div className="border-t border-slate-800/80 bg-[#07090e] p-2.5">
        <div
          className={cn(
            'flex cursor-pointer items-center gap-2.5 rounded-xl border border-slate-800 bg-[#0d101a] p-2 shadow-inner transition-colors hover:bg-slate-800/60',
            isCollapsed && 'justify-center border-0 bg-transparent p-1'
          )}
        >
          <Avatar className="h-7 w-7 ring-1 ring-amber-500/40">
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
              <span className="flex items-center gap-1 text-[10px] font-bold text-amber-400">
                <ShieldCheck className="h-3 w-3 text-amber-400" />
                Pro Plan
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
