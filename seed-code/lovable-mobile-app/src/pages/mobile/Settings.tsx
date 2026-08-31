import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  User,
  Bell,
  Palette,
  Globe,
  Shield,
  CreditCard,
  LogOut,
  ChevronRight,
  ShieldCheck,
  HelpCircle,
  Info,
  Loader2,
  Gift,
  GraduationCap,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { supabase } from '@/integrations/supabase/client';

const settingsSections = [
  {
    title: 'Account',
    items: [
      {
        icon: User,
        label: 'Profile',
        description: 'Name, email, avatar',
        route: '/settings/profile',
      },
      {
        icon: Shield,
        label: 'Security',
        description: 'Password, 2FA',
        route: '/settings/security',
      },
      {
        icon: CreditCard,
        label: 'Subscription',
        description: 'FREE tier',
        badge: 'Upgrade',
        route: '/settings/subscription',
      },
    ],
  },
  {
    title: 'Preferences',
    items: [
      {
        icon: Bell,
        label: 'Notifications',
        description: 'Push, email, SMS',
        route: '/settings/notifications',
      },
      {
        icon: Palette,
        label: 'Appearance',
        description: 'Theme, colors',
        route: '/settings/appearance',
      },
      {
        icon: Globe,
        label: 'Language',
        description: 'English',
        route: '/settings/language',
      },
    ],
  },
  {
    title: 'Earn',
    items: [
      {
        icon: Gift,
        label: 'Affiliate Program',
        description: 'Referral code, commissions, payouts',
        route: '/settings/affiliate',
      },
    ],
  },
  {
    title: 'Administration',
    items: [
      {
        icon: ShieldCheck,
        label: 'Admin Portal',
        description: 'System management',
        badge: 'Admin',
        route: '/settings/admin',
      },
    ],
  },
  {
    title: 'Support',
    items: [
      {
        icon: GraduationCap,
        label: 'DavinTrade Academy',
        description: 'Free video tutorials',
        route: '/academy',
      },
      {
        icon: HelpCircle,
        label: 'Help & Support',
        description: 'FAQ, contact us',
        route: '/settings/help',
      },
      {
        icon: Info,
        label: 'About',
        description: 'Version, legal',
        route: '/settings/about',
      },
    ],
  },
];

const Settings = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { currentTier, getTierName } = useSubscription();
  const [displayName, setDisplayName] = useState('');
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      const { data } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', user.id)
        .maybeSingle();

      setDisplayName(data?.display_name || '');
    };
    fetchProfile();
  }, [user]);

  const handleNavigation = (route: string | null) => {
    if (route) {
      navigate(route);
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await logout();
    navigate('/auth', { replace: true });
  };

  const getInitials = () => {
    if (displayName) {
      const parts = displayName.split(' ');
      return parts.length > 1
        ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
        : displayName.substring(0, 2).toUpperCase();
    }
    return user?.email?.substring(0, 2).toUpperCase() || 'U';
  };

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background px-4 py-3">
        <h1 className="text-xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your account</p>
      </header>

      {/* Content */}
      <div className="flex-1 space-y-4 p-4 pb-24">
        {/* User Card */}
        <Card
          className="cursor-pointer bg-card transition-colors hover:bg-accent/50"
          onClick={() => navigate('/settings/profile')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary">
                <span className="text-xl font-bold text-primary-foreground">
                  {getInitials()}
                </span>
              </div>
              <div className="flex-1">
                <p className="font-semibold text-foreground">
                  {displayName || 'User'}
                </p>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
                <Badge
                  variant={currentTier === 'free' ? 'secondary' : 'default'}
                  className="mt-1"
                >
                  {getTierName().toUpperCase()}
                </Badge>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        {/* Settings Sections */}
        {settingsSections.map((section) => (
          <Card key={section.title}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">
                {section.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 p-2">
              {section.items.map((item) => (
                <button
                  key={item.label}
                  onClick={() => handleNavigation(item.route)}
                  className={`flex w-full items-center gap-3 rounded-lg p-3 transition-colors ${
                    item.route
                      ? 'hover:bg-accent'
                      : 'cursor-not-allowed opacity-60'
                  }`}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
                    <item.icon className="h-5 w-5 text-secondary-foreground" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-medium text-foreground">{item.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                  {item.badge && (
                    <Badge variant="default" className="text-xs">
                      {item.badge}
                    </Badge>
                  )}
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              ))}
            </CardContent>
          </Card>
        ))}

        {/* Logout */}
        <button
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-destructive p-4 text-destructive transition-colors hover:bg-destructive hover:text-destructive-foreground disabled:opacity-50"
        >
          {isLoggingOut ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <LogOut className="h-5 w-5" />
          )}
          <span className="font-medium">
            {isLoggingOut ? 'Signing out...' : 'Sign Out'}
          </span>
        </button>
      </div>
    </div>
  );
};

export default Settings;
