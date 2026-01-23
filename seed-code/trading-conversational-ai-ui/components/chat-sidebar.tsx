'use client';

import { useState } from 'react';
import Image from 'next/image'; // Import Next.js Image component
import {
  MessageCircle,
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
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

interface ChatSidebarProps {
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function ChatSidebar({
  isCollapsed = false,
  onToggleCollapse,
}: ChatSidebarProps) {
  const { setTheme, theme } = useTheme();
  const [activeItem, setActiveItem] = useState('New Chat');

  // Genuine Trading Navigation Items
  const mainNavItems = [
    {
      icon: MessageCircle,
      label: 'New Chat',
      href: process.env.NEXT_PUBLIC_CHAT_URL || 'http://localhost:3000',
    },
    { icon: LineChart, label: 'Chart Analysis' },
    { icon: Wallet, label: 'Portfolio' },
    { icon: Globe, label: 'Market News' },
  ];

  // Recent Analysis Sessions
  const recentChats = [
    'XAU/USD Trend Analysis',
    'BTC Breakout Strategy',
    'Forex Macro View',
    'NVDA Earnings Prep',
  ];

  return (
    <aside
      className={cn(
        'bg-muted/10 relative flex flex-col border-r transition-all duration-300',
        isCollapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Header / Brand */}
      <div className="flex h-14 items-center justify-between border-b px-3">
        {!isCollapsed && (
          <div className="flex items-center gap-2 text-lg font-bold tracking-tight">
            {/* Logo Image */}
            <div className="relative h-7 w-7 overflow-hidden rounded-md">
              <Image
                src="/DavinTrade_Logo.jpg"
                alt="DavinTrade Logo"
                fill
                className="object-cover"
                priority
              />
            </div>
            <span>DavinTrade</span>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleCollapse}
          className={cn('h-8 w-8', isCollapsed && 'mx-auto')}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      <ScrollArea className="flex-1 py-4">
        <nav className="grid gap-1 px-2">
          {mainNavItems.map((item) => (
            <Button
              key={item.label}
              variant={activeItem === item.label ? 'secondary' : 'ghost'}
              className={cn(
                'h-9 justify-start',
                isCollapsed && 'justify-center px-0',
                activeItem === item.label && 'font-medium'
              )}
              onClick={() => {
                if (item.href) {
                  const url = new URL(item.href);
                  if (theme) url.searchParams.set('theme', theme);
                  window.location.href = url.toString();
                } else {
                  setActiveItem(item.label);
                }
              }}
            >
              <item.icon className={cn('h-4 w-4', !isCollapsed && 'mr-2')} />
              {!isCollapsed && item.label}
            </Button>
          ))}
        </nav>

        <Separator className="mx-2 my-4" />

        <div className="px-2">
          {!isCollapsed && (
            <h3 className="text-muted-foreground mb-2 px-2 text-xs font-semibold tracking-wider uppercase">
              Recent Sessions
            </h3>
          )}
          <div className="grid gap-1">
            {recentChats.map((chat, index) => (
              <Button
                key={index}
                variant="ghost"
                className={cn(
                  'text-muted-foreground h-8 justify-start text-sm font-normal',
                  isCollapsed && 'justify-center px-0'
                )}
              >
                <MessageSquare
                  className={cn('h-4 w-4', !isCollapsed && 'mr-2')}
                />
                {!isCollapsed && <span className="truncate">{chat}</span>}
              </Button>
            ))}
          </div>
        </div>
      </ScrollArea>

      {/* Footer Area */}
      <div className="mt-auto space-y-2 border-t p-2">
        {/* Dark Mode Toggle */}
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'w-full justify-start',
            isCollapsed && 'justify-center px-0'
          )}
          onClick={() => {
            const newTheme = theme === 'dark' ? 'light' : 'dark';
            setTheme(newTheme);
            document.cookie = `davintrade-theme=${newTheme}; path=/; max-age=31536000; SameSite=Lax`;
          }}
        >
          <Sun className="h-[1.2rem] w-[1.2rem] scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
          {!isCollapsed && <span className="ml-2">Switch Theme</span>}
        </Button>

        <div
          className={cn(
            'bg-muted/50 flex items-center gap-2 rounded-lg p-2',
            isCollapsed && 'justify-center bg-transparent p-1'
          )}
        >
          <Avatar className="h-8 w-8">
            <AvatarImage src="/placeholder-user.jpg" />
            <AvatarFallback>DT</AvatarFallback>
          </Avatar>
          {!isCollapsed && (
            <div className="flex flex-col overflow-hidden">
              <span className="truncate text-sm font-medium">Trader User</span>
              <span className="text-muted-foreground truncate text-xs">
                Pro Plan
              </span>
            </div>
          )}
          {!isCollapsed && (
            <Button variant="ghost" size="icon" className="ml-auto h-6 w-6">
              <Settings className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
    </aside>
  );
}
