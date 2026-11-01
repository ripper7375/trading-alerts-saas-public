import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bell,
  Sparkles,
  Layers,
  ChevronDown,
  UserCheck,
  LogOut,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ThemeToggle } from './ThemeToggle';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/contexts/NotificationContext';
import { UserRole } from '@/lib/types';

export const AppHeader: React.FC = () => {
  const { user, role, switchRole, logout, isPro, isAffiliate } = useAuth();
  const { unreadCount } = useNotifications();
  const navigate = useNavigate();

  const roleLabels: Record<
    UserRole,
    { label: string; desc: string; badge: string }
  > = {
    NL: { label: 'Non-Login', desc: 'Public Visitor', badge: 'Public' },
    FT: { label: 'Free Tier', desc: '5 Symbols / 3 TFs', badge: 'FREE' },
    PT: { label: 'PRO Tier', desc: '15 Symbols / 9 TFs / AI', badge: 'PRO' },
    AF: {
      label: 'Affiliate + Free',
      desc: 'Partner + Free Terminal',
      badge: 'AFFILIATE',
    },
    AP: {
      label: 'Affiliate + PRO',
      desc: 'Partner + Full Terminal',
      badge: 'VIP PARTNER',
    },
  };

  return (
    <header className="safe-area-pt sticky top-0 z-40 w-full border-b border-border/80 bg-background/90 backdrop-blur-md">
      <div className="flex h-14 items-center justify-between px-3">
        {/* Brand & Logo */}
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500 font-black text-slate-950 shadow-md shadow-amber-500/25">
            <span className="text-sm tracking-tighter">DT</span>
          </div>
          <div className="flex flex-col">
            <span className="flex items-center gap-1.5 text-sm font-extrabold tracking-tight text-foreground">
              DavinTrade
              <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-emerald-500 dark:text-emerald-400">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                MT5 Live
              </span>
            </span>
          </div>
        </Link>

        {/* Right Header Actions */}
        <div className="flex items-center gap-1.5">
          {/* Role Preview Switcher Dropdown (Essential for testing all 5 roles) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1 rounded-lg border-amber-500/30 bg-amber-500/10 px-2 text-[11px] font-semibold text-amber-600 hover:bg-amber-500/20 dark:text-amber-400"
              >
                <Layers className="h-3 w-3" />
                <span>{roleLabels[role]?.badge}</span>
                <ChevronDown className="h-3 w-3 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Switch Role Preview (5 External Roles)
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {(['NL', 'FT', 'PT', 'AF', 'AP'] as UserRole[]).map((r) => (
                <DropdownMenuItem
                  key={r}
                  onClick={() => switchRole(r)}
                  className="flex cursor-pointer items-center justify-between py-2 text-xs"
                >
                  <div className="flex flex-col">
                    <span className="flex items-center gap-1 font-semibold">
                      {roleLabels[r].label}
                      {role === r && (
                        <UserCheck className="h-3.5 w-3.5 text-emerald-500" />
                      )}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {roleLabels[r].desc}
                    </span>
                  </div>
                  <Badge
                    variant={r === 'PT' || r === 'AP' ? 'pro' : 'outline'}
                    className="px-1.5 py-0 text-[9px]"
                  >
                    {r}
                  </Badge>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Tier Upgrade Pill (for Free users) */}
          {!isPro && user && role !== 'NL' && (
            <Button
              size="sm"
              onClick={() => navigate('/pricing')}
              className="shadow-xs h-7 bg-amber-500 px-2.5 text-[11px] font-extrabold text-slate-950 hover:bg-amber-400"
            >
              <Zap className="mr-1 h-3 w-3 fill-current" />
              Upgrade
            </Button>
          )}

          {/* Notifications Bell */}
          {user && role !== 'NL' && (
            <Link to="/notifications">
              <Button
                variant="ghost"
                size="icon-sm"
                className="relative h-8 w-8 text-muted-foreground hover:text-foreground"
                aria-label="Notifications"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute right-1 top-1 flex h-2 w-2 rounded-full bg-primary ring-2 ring-background" />
                )}
              </Button>
            </Link>
          )}

          {/* Theme Toggle */}
          <ThemeToggle />

          {/* User Profile / Logout for logged-in */}
          {user && role !== 'NL' && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="h-8 w-8 rounded-full border border-border bg-secondary p-0 text-xs font-bold"
                >
                  {user.name.charAt(0)}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel className="flex flex-col gap-0.5">
                  <span className="text-xs font-bold text-foreground">
                    {user.name}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {user.email}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/settings/profile')}>
                  Profile Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/settings/billing')}>
                  Billing & Plans
                </DropdownMenuItem>
                {isAffiliate && (
                  <DropdownMenuItem
                    onClick={() => navigate('/affiliate/dashboard')}
                  >
                    Affiliate Portal
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={logout}
                  className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                >
                  <LogOut className="mr-2 h-3.5 w-3.5" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Login CTA for NL */}
          {role === 'NL' && (
            <Button
              size="sm"
              onClick={() => navigate('/login')}
              className="h-7 bg-primary px-3 text-xs font-bold text-primary-foreground"
            >
              Sign In
            </Button>
          )}
        </div>
      </div>
    </header>
  );
};
