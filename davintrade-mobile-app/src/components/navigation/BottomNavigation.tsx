import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  TrendingUp,
  Bell,
  LayoutDashboard,
  Users,
  Settings,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/contexts/NotificationContext';

export const BottomNavigation: React.FC = () => {
  const { user, isAffiliate, isPro } = useAuth();
  const { unreadCount, activeAlertsCount } = useNotifications();

  // If user is not logged in, bottom navigation is hidden or shows public actions
  if (!user || user.role === 'NL') {
    return null;
  }

  const terminalPath = isPro ? '/terminal' : '/free';

  const navItems = [
    {
      to: terminalPath,
      icon: TrendingUp,
      label: 'Terminal',
      badge: null,
    },
    {
      to: '/alerts',
      icon: Bell,
      label: 'Alerts',
      badge: activeAlertsCount > 0 ? activeAlertsCount : null,
      badgeVariant: 'amber',
    },
    {
      to: '/dashboard',
      icon: LayoutDashboard,
      label: 'Dashboard',
      badge: null,
    },
    isAffiliate
      ? {
          to: '/affiliate/dashboard',
          icon: Users,
          label: 'Affiliate',
          badge: null,
        }
      : {
          to: '/notifications',
          icon: Sparkles,
          label: 'Updates',
          badge: unreadCount > 0 ? unreadCount : null,
          badgeVariant: 'primary',
        },
    {
      to: '/settings',
      icon: Settings,
      label: 'Settings',
      badge: null,
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/80 bg-card/95 backdrop-blur-lg">
      <div className="safe-area-pb flex h-16 items-center justify-around px-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'relative flex h-full flex-1 select-none flex-col items-center justify-center gap-1 transition-all',
                isActive
                  ? 'font-bold text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )
            }
          >
            {({ isActive }) => (
              <>
                <div className="relative">
                  <item.icon
                    className={cn(
                      'h-5 w-5 transition-transform',
                      isActive && 'scale-110 stroke-[2.5]'
                    )}
                  />
                  {item.badge !== null && (
                    <span
                      className={cn(
                        'shadow-xs absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-extrabold text-slate-950',
                        item.badgeVariant === 'amber'
                          ? 'bg-amber-500'
                          : 'bg-primary'
                      )}
                    >
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </div>
                <span className="text-[10px] tracking-tight">{item.label}</span>
                {isActive && (
                  <span className="absolute bottom-1 h-1 w-4 rounded-full bg-primary" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
};
