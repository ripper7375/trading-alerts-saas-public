'use client';

import { useState } from 'react';
import Image from 'next/image';
import {
  LayoutDashboard,
  LineChart,
  Wallet,
  Globe,
  MessageSquare,
  Settings,
  ChevronRight,
  ChevronLeft,
  Sun,
  Moon,
  ShieldCheck,
  Lock,
  Zap,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Tier } from '@/lib/types';

interface ChatSidebarProps {
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  tier: Tier;
  onTierChange: (tier: Tier) => void;
}

export function ChatSidebar({
  isCollapsed = false,
  onToggleCollapse,
  tier,
  onTierChange,
}: ChatSidebarProps) {
  const { setTheme, theme } = useTheme();
  const [activeItem, setActiveItem] = useState('Chart Analysis');

  const mainNavItems = [
    { icon: LayoutDashboard, label: 'Dashboard' },
    { icon: LineChart, label: 'Chart Analysis' },
    { icon: Wallet, label: 'Portfolio' },
    { icon: Globe, label: 'Market News' },
  ];

  const recentChats = [
    'XAUUSD M5 Scalp Setup',
    'XAUUSD M15 EDT Retest',
    'XAUUSD Resistance Rejection',
    'XAUUSD Macro Structure',
  ];

  return (
    <aside
      className={cn(
        'relative z-10 flex flex-col border-r border-slate-800/80 bg-[#07080c] shadow-2xl transition-all duration-300 select-none',
        isCollapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Header / Brand — Deep Slate Tone */}
      <div className="flex h-14 items-center justify-between border-b border-slate-800/80 bg-[#0d0f17] px-3">
        {!isCollapsed && (
          <div className="flex items-center gap-2 text-lg font-bold tracking-tight">
            <div className="relative h-7 w-7 overflow-hidden rounded-md shadow-xs ring-1 ring-amber-500/40">
              <Image
                src="/DavinTrade_Logo.jpg"
                alt="DavinTrade Logo"
                fill
                className="object-cover"
                priority
              />
            </div>
            <span className="bg-gradient-to-r from-amber-400 via-amber-200 to-amber-500 bg-clip-text text-transparent drop-shadow-xs">
              DavinTrade
            </span>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleCollapse}
          className={cn(
            'h-8 w-8 text-slate-400 hover:bg-slate-800 hover:text-slate-100',
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
        {/* Tier Mode Switcher Header Badge */}
        {!isCollapsed && (
          <div className="mx-2.5 mb-3 rounded-xl border border-amber-500/30 bg-[#10131d] p-2 text-xs shadow-inner">
            <div className="mb-1.5 flex items-center justify-between text-[11px] font-semibold text-slate-400">
              <span>PREVIEW TIER</span>
              <Badge
                variant="outline"
                className={cn(
                  'font-mono text-[10px]',
                  tier === 'PRO'
                    ? 'border-amber-500/50 bg-amber-500/10 font-bold text-amber-400'
                    : 'border-slate-700 bg-slate-800 text-slate-400'
                )}
              >
                {tier}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-1">
              <Button
                variant={tier === 'FREE' ? 'default' : 'outline'}
                size="sm"
                className={cn(
                  'h-7 border-slate-700 text-xs font-semibold',
                  tier === 'FREE' && 'bg-slate-700 text-white'
                )}
                onClick={() => onTierChange('FREE')}
              >
                FREE
              </Button>
              <Button
                variant={tier === 'PRO' ? 'default' : 'outline'}
                size="sm"
                className={cn(
                  'h-7 border-amber-500/40 text-xs font-semibold',
                  tier === 'PRO' &&
                    'bg-amber-500 font-bold text-slate-950 shadow-md shadow-amber-500/20 hover:bg-amber-400'
                )}
                onClick={() => onTierChange('PRO')}
              >
                <Zap className="mr-1 h-3 w-3 fill-black" />
                PRO
              </Button>
            </div>
          </div>
        )}

        <nav className="grid gap-1 px-2">
          {mainNavItems.map((item) => (
            <Button
              key={item.label}
              variant={activeItem === item.label ? 'secondary' : 'ghost'}
              className={cn(
                'h-9 justify-start text-xs font-medium text-slate-300 hover:bg-slate-800/60 hover:text-slate-100',
                isCollapsed && 'justify-center px-0',
                activeItem === item.label &&
                  'border border-amber-500/30 bg-amber-500/15 font-bold text-amber-300'
              )}
              onClick={() => setActiveItem(item.label)}
            >
              <item.icon
                className={cn(
                  'h-4 w-4',
                  !isCollapsed && 'mr-2',
                  activeItem === item.label && 'text-amber-400'
                )}
              />
              {!isCollapsed && item.label}
            </Button>
          ))}
        </nav>

        <Separator className="mx-2 my-4 bg-slate-800/80" />

        <div className="px-2">
          {!isCollapsed && (
            <h3 className="mb-2 px-2 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
              XAUUSD Sessions
            </h3>
          )}
          <div className="grid gap-1">
            {recentChats.map((chat, index) => (
              <Button
                key={index}
                variant="ghost"
                className={cn(
                  'h-8 justify-start text-xs font-normal text-slate-400 hover:bg-slate-800/50 hover:text-slate-100',
                  isCollapsed && 'justify-center px-0'
                )}
              >
                <MessageSquare
                  className={cn(
                    'h-3.5 w-3.5 shrink-0 text-amber-400/80',
                    !isCollapsed && 'mr-2'
                  )}
                />
                {!isCollapsed && <span className="truncate">{chat}</span>}
              </Button>
            ))}
          </div>
        </div>
      </ScrollArea>

      {/* Footer Area */}
      <div className="mt-auto space-y-2 border-t border-slate-800/80 bg-[#0a0c13] p-2">
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'border-slate-750 w-full justify-start bg-[#07080c] text-xs text-slate-300 hover:bg-slate-800',
            isCollapsed && 'justify-center px-0'
          )}
          onClick={() => {
            const newTheme = theme === 'dark' ? 'light' : 'dark';
            setTheme(newTheme);
            document.cookie = `davintrade-theme=${newTheme}; path=/; max-age=31536000; SameSite=Lax`;
          }}
        >
          <Sun className="h-4 w-4 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
          <Moon className="absolute h-4 w-4 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
          {!isCollapsed && <span className="ml-2">Switch Theme</span>}
        </Button>

        <div
          className={cn(
            'flex items-center gap-2 rounded-lg border border-slate-800 bg-[#0f121d] p-2 shadow-inner',
            isCollapsed && 'justify-center border-0 bg-transparent p-1'
          )}
        >
          <Avatar className="h-7 w-7 ring-1 ring-amber-500/40">
            <AvatarImage src="/placeholder-user.jpg" />
            <AvatarFallback className="bg-slate-800 text-slate-200">
              TU
            </AvatarFallback>
          </Avatar>
          {!isCollapsed && (
            <div className="flex flex-col overflow-hidden">
              <span className="truncate text-xs font-semibold text-slate-100">
                Trader User
              </span>
              <span
                className={cn(
                  'flex items-center gap-1 truncate text-[10px] font-bold',
                  tier === 'PRO' ? 'text-amber-400' : 'text-slate-400'
                )}
              >
                {tier === 'PRO' ? (
                  <ShieldCheck className="inline h-3 w-3 text-amber-400" />
                ) : (
                  <Lock className="inline h-3 w-3 text-slate-400" />
                )}
                {tier === 'PRO' ? 'Pro Plan' : 'Free Plan'}
              </span>
            </div>
          )}
          {!isCollapsed && (
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto h-6 w-6 text-slate-400 hover:text-slate-100"
            >
              <Settings className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
    </aside>
  );
}
