import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  ListChecks,
  Bell,
  LineChart,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/watchlist', icon: ListChecks, label: 'Watchlist' },
  { to: '/alerts', icon: Bell, label: 'Alerts' },
  { to: '/charts', icon: LineChart, label: 'Charts' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export const BottomNavigation = () => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card">
      <div className="safe-area-pb flex h-16 items-center justify-around px-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'flex h-full flex-1 flex-col items-center justify-center gap-1 transition-colors',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )
            }
          >
            <item.icon className="h-5 w-5" />
            <span className="text-xs font-medium">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
};
