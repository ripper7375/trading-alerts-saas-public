'use client';

import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

type NavItem = 'dashboard' | 'charts' | 'alerts' | 'watchlist' | 'settings';

export default function DashboardLayout() {
  const [activeNav, setActiveNav] = useState<NavItem>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navItems = [
    { id: 'dashboard' as NavItem, label: 'Dashboard', icon: '🏠' },
    { id: 'charts' as NavItem, label: 'Live Charts', icon: '📊' },
    { id: 'alerts' as NavItem, label: 'Alerts', icon: '🔔' },
    { id: 'watchlist' as NavItem, label: 'Watchlist', icon: '📝' },
    { id: 'settings' as NavItem, label: 'Settings', icon: '⚙️' },
  ];

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:flex-col md:w-64 bg-white shadow-lg">
        {/* Logo Section */}
        <div className="p-6 border-b">
          <h1 className="text-xl font-bold text-blue-600">📊 Trading Alerts</h1>
          <div className="mt-3 inline-block bg-green-100 text-green-700 px-3 py-1 rounded-md text-xs font-semibold">
            FREE TIER 🆓
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveNav(item.id)}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors duration-200 cursor-pointer',
                'hover:bg-gray-100',
                activeNav === item.id
                  ? 'bg-blue-50 text-blue-600 font-semibold border-l-4 border-blue-600'
                  : 'text-gray-700'
              )}
            >
              <span className="text-xl">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        >
          <aside
            className="w-64 h-full bg-white shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Logo Section */}
            <div className="p-6 border-b">
              <h1 className="text-xl font-bold text-blue-600">
                📊 Trading Alerts
              </h1>
              <div className="mt-3 inline-block bg-green-100 text-green-700 px-3 py-1 rounded-md text-xs font-semibold">
                FREE TIER 🆓
              </div>
            </div>

            {/* Navigation Links */}
            <nav className="p-4 space-y-2">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveNav(item.id);
                    setSidebarOpen(false);
                  }}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors duration-200 cursor-pointer',
                    'hover:bg-gray-100',
                    activeNav === item.id
                      ? 'bg-blue-50 text-blue-600 font-semibold border-l-4 border-blue-600'
                      : 'text-gray-700'
                  )}
                >
                  <span className="text-xl">{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
        <header className="h-16 bg-white border-b flex items-center justify-between px-6">
          {/* Mobile Hamburger Menu */}
          <button
            className="md:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
            onClick={() => setSidebarOpen(true)}
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>

          <div className="flex-1 md:flex-none" />

          {/* Right Side - Notifications & Profile */}
          <div className="flex items-center gap-4">
            {/* Bell Icon */}
            <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors relative">
              <svg
                className="w-6 h-6 text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              </svg>
            </button>

            {/* Profile Section */}
            <button className="flex items-center gap-3 hover:bg-gray-100 px-3 py-2 rounded-lg transition-colors">
              <Avatar className="h-10 w-10">
                <AvatarImage src="/professional-trader-avatar.png" />
                <AvatarFallback className="bg-blue-500 text-white">
                  JT
                </AvatarFallback>
              </Avatar>
              <div className="hidden sm:flex items-center gap-2">
                <span className="font-medium text-gray-800">John Trader</span>
                <svg
                  className="w-4 h-4 text-gray-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>
            </button>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-8 overflow-auto">
          <div className="flex items-center justify-center h-full">
            <p className="text-4xl text-gray-400 font-light">
              Dashboard content goes here
            </p>
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg">
        <nav className="flex justify-around items-center h-16">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveNav(item.id)}
              className={cn(
                'flex flex-col items-center justify-center flex-1 h-full transition-colors duration-200',
                activeNav === item.id ? 'text-blue-600' : 'text-gray-500'
              )}
            >
              <span className="text-2xl">{item.icon}</span>
              <span className="text-xs mt-1">{item.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
