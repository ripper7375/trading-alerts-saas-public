import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { BottomNavigation } from '@/components/navigation/BottomNavigation';
import { AppHeader } from '@/components/navigation/AppHeader';

export const MobileLayout: React.FC = () => {
  const location = useLocation();

  // Paths where AppHeader should be hidden
  const hideHeaderPaths = [
    '/login',
    '/register',
    '/forgot-password',
    '/reset-password',
    '/verify-email',
    '/verify-2fa',
    '/welcome',
  ];

  // Paths where BottomNavigation should be hidden
  const hideBottomNavPaths = [
    '/login',
    '/register',
    '/forgot-password',
    '/reset-password',
    '/verify-email',
    '/verify-2fa',
    '/welcome',
    '/checkout',
  ];

  const isAuthOrOnboarding = hideHeaderPaths.some((path) =>
    location.pathname.startsWith(path)
  );

  const hideBottomNav = hideBottomNavPaths.some((path) =>
    location.pathname.startsWith(path)
  );

  return (
    <div className="relative flex min-h-dvh flex-col bg-background text-foreground">
      {/* Top Mobile Header */}
      {!isAuthOrOnboarding && <AppHeader />}

      {/* Main Content Viewport */}
      <main
        className={`mx-auto flex w-full max-w-lg flex-1 flex-col ${
          !hideBottomNav ? 'pb-20' : 'pb-6'
        }`}
      >
        <Outlet />
      </main>

      {/* Fixed 5-Tab Bottom Navigation Bar */}
      {!hideBottomNav && <BottomNavigation />}
    </div>
  );
};
