'use client';

import { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  TrendingUp,
  Wallet,
  Globe,
  MessageSquare,
  Moon,
  Sun,
  Settings,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from '@/components/ui/sidebar';
import { useTheme } from 'next-themes';

export function AppSidebar() {
  const [activeItem, setActiveItem] = useState('Chart Analysis');
  const [mounted, setMounted] = useState(false);
  const { state } = useSidebar();
  const { theme, setTheme } = useTheme();
  const isCollapsed = state === 'collapsed';

  useEffect(() => {
    setMounted(true);
  }, []);

  const navigationItems = [
    {
      icon: LayoutDashboard,
      label: 'Dashboard',
      href: process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:3001',
    },
    { icon: TrendingUp, label: 'Chart Analysis' },
    { icon: Wallet, label: 'Portfolio' },
    { icon: Globe, label: 'Market News' },
  ];

  const recentSessions = [
    'XAU/USD Trend Analysis',
    'BTC Breakout Strategy',
    'Forex Macro View',
    'NVDA Earnings Prep',
  ];

  return (
    <Sidebar
      collapsible="icon"
      className="z-50 overflow-hidden border-none bg-zinc-50 shadow-[4px_0_24px_rgba(0,0,0,0.1)] dark:bg-gradient-to-b dark:from-[#121212] dark:via-[#0A0A0A] dark:to-black dark:shadow-[4px_0_24px_rgba(0,0,0,0.9)]"
    >
      {/* Header */}
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="h-8 w-8 flex-shrink-0 overflow-hidden rounded-md bg-zinc-200 dark:bg-[#1a1a1a]">
            <img
              src="/davintrade-logo-icon.jpg"
              alt="DavinTrade"
              className="h-full w-full scale-110 object-cover"
            />
          </div>
          {!isCollapsed && (
            <span className="text-xl font-bold tracking-wide text-zinc-900 dark:text-white">
              DavinTrade
            </span>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="overflow-x-hidden bg-transparent">
        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarMenu>
            {navigationItems.map((item) => (
              <SidebarMenuItem key={item.label}>
                <SidebarMenuButton
                  tooltip={item.label}
                  isActive={activeItem === item.label}
                  onClick={() => {
                    if (item.href) {
                      const url = new URL(item.href);
                      if (theme) url.searchParams.set('theme', theme);
                      window.location.href = url.toString();
                    } else {
                      setActiveItem(item.label);
                    }
                  }}
                  className={`transition-all duration-200 ease-in-out ${
                    activeItem === item.label
                      ? 'border-l-2 border-[#BA9465] bg-gradient-to-r from-[#BA9465]/20 to-transparent text-[#BA9465]'
                      : 'border-l-2 border-transparent text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-[#1a1a1a] dark:hover:text-white'
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>

        <SidebarSeparator className="bg-zinc-200 dark:bg-[#3D3D3D]" />

        {/* Recent Sessions */}
        <SidebarGroup>
          {!isCollapsed && (
            <SidebarGroupLabel className="mb-2 px-2 text-sm font-medium tracking-wider text-zinc-500 uppercase">
              Recent Sessions
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              {recentSessions.map((session, index) => (
                <SidebarMenuItem key={index}>
                  <SidebarMenuButton
                    tooltip={session}
                    className="text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-[#1a1a1a] dark:hover:text-white"
                  >
                    <MessageSquare className="h-4 w-4" />
                    <span className="truncate">{session}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <div className="flex-1" />

        {/* Theme Switch & User Profile */}
        <SidebarGroup className="mt-auto">
          <SidebarSeparator className="mb-2 bg-zinc-200 dark:bg-[#3D3D3D]" />
          <SidebarMenu>
            {/* Switch Theme */}
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="Switch Theme"
                onClick={() => {
                  const newTheme = theme === 'dark' ? 'light' : 'dark';
                  setTheme(newTheme);
                  document.cookie = `davintrade-theme=${newTheme}; path=/; max-age=31536000; SameSite=Lax`;
                }}
                className="text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-[#1a1a1a] dark:hover:text-white"
              >
                {mounted ? (
                  theme === 'dark' ? (
                    <Moon className="h-4 w-4" />
                  ) : (
                    <Sun className="h-4 w-4" />
                  )
                ) : (
                  <Sun className="h-4 w-4" />
                )}
                <span>Switch Theme</span>
              </SidebarMenuButton>
            </SidebarMenuItem>

            {/* User Profile */}
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="Trader User"
                className="text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-[#1a1a1a] dark:hover:text-white"
              >
                <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-blue-500 text-xs font-bold text-white">
                  N
                </div>
                {!isCollapsed && (
                  <div className="flex min-w-0 flex-1 flex-col text-left">
                    <span className="truncate text-sm font-medium text-zinc-900 dark:text-white">
                      Trader User
                    </span>
                    <span className="truncate text-xs text-[#BA9465]">
                      Pro Plan
                    </span>
                  </div>
                )}
                {!isCollapsed && (
                  <Settings className="h-4 w-4 flex-shrink-0 text-zinc-400 transition-colors hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-white" />
                )}
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarRail className="hover:after:bg-[#BA9465]" />
    </Sidebar>
  );
}
