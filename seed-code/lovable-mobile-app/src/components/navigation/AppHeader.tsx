import { useLocation, useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from './ThemeToggle';
import { useNotifications } from '@/contexts/NotificationContext';

const routeTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/watchlist': 'Watchlist',
  '/alerts': 'Alerts',
  '/charts': 'Charts',
  '/settings': 'Settings',
  '/notifications': 'Notifications',
};

export const AppHeader = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { unreadCount } = useNotifications();

  // Get title from route, handle nested routes
  const getTitle = () => {
    if (location.pathname.startsWith('/settings/')) {
      return 'Settings';
    }
    return routeTitles[location.pathname] || 'TradeView';
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center justify-between px-4">
        <h1 className="text-lg font-semibold text-foreground">{getTitle()}</h1>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="relative h-9 w-9"
            onClick={() => navigate('/notifications')}
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-xs font-medium text-destructive-foreground">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Button>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
};
