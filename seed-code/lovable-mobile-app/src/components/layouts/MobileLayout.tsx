import { Outlet, useLocation } from 'react-router-dom';
import { BottomNavigation } from '@/components/navigation/BottomNavigation';
import { AppHeader } from '@/components/navigation/AppHeader';

export const MobileLayout = () => {
  const location = useLocation();

  // Hide bottom nav and header on auth pages
  const hideNav = location.pathname.startsWith('/auth');
  // Hide app header on settings sub-pages (they have their own headers)
  const hideAppHeader = location.pathname.startsWith('/settings/');

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* App Header with theme toggle */}
      {!hideNav && !hideAppHeader && <AppHeader />}

      {/* Main content area with padding for bottom nav */}
      <main className={`flex-1 ${!hideNav ? 'pb-16' : ''}`}>
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      {!hideNav && <BottomNavigation />}
    </div>
  );
};
