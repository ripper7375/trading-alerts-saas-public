'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  User,
  Settings,
  CreditCard,
  HelpCircle,
  Book,
  Bug,
  Palette,
  Globe,
  LogOut,
  ExternalLink,
  ChevronDown,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// Types
interface UsageStats {
  alerts: { used: number; limit: number };
  watchlist: { used: number; limit: number };
}

interface SubscriptionStatus {
  type: 'trial' | 'active' | 'canceled';
  endsAt?: Date;
  renewsAt?: Date;
}

interface UserData {
  name: string;
  email: string;
  avatar?: string;
  tier: 'FREE' | 'PRO';
}

interface UserProfileDropdownProps {
  user: UserData;
  subscriptionStatus?: SubscriptionStatus;
  usage?: UsageStats;
  onSignOut: () => void;
  onUpgrade?: () => void;
}

// Helper to get user initials
const getUserInitials = (name: string) => {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

export default function UserProfileDropdown({
  user,
  subscriptionStatus,
  usage,
  onSignOut,
  onUpgrade,
}: UserProfileDropdownProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = React.useState(false);
  const [showSignOutModal, setShowSignOutModal] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () =>
        document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Handle escape key
  React.useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (showSignOutModal) {
          setShowSignOutModal(false);
        } else if (isOpen) {
          setIsOpen(false);
          buttonRef.current?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, showSignOutModal]);

  const handleNavigation = (path: string) => {
    setIsOpen(false);
    router.push(path);
  };

  const handleExternalLink = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleSignOutClick = () => {
    setShowSignOutModal(true);
  };

  const confirmSignOut = () => {
    setShowSignOutModal(false);
    setIsOpen(false);
    onSignOut();
  };

  const MenuItem = ({
    icon: Icon,
    label,
    onClick,
    subLabel,
    badge,
    external,
    danger,
  }: {
    icon: React.ElementType;
    label: string;
    onClick: () => void;
    subLabel?: string;
    badge?: string;
    external?: boolean;
    danger?: boolean;
  }) => (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-100',
        danger && 'hover:bg-red-50'
      )}
      role="menuitem"
    >
      <Icon
        className={cn('h-5 w-5', danger ? 'text-red-600' : 'text-gray-600')}
      />
      <span
        className={cn(
          'text-sm font-medium',
          danger ? 'text-red-600' : 'text-gray-900'
        )}
      >
        {label}
      </span>
      {subLabel && (
        <span className="ml-auto text-xs text-gray-500">{subLabel}</span>
      )}
      {badge && (
        <Badge className="ml-auto bg-blue-100 text-blue-800 hover:bg-blue-100">
          {badge}
        </Badge>
      )}
      {external && <ExternalLink className="ml-auto h-3 w-3 text-gray-400" />}
    </button>
  );

  const Divider = () => <div className="my-2 border-t-2 border-gray-200" />;

  // Calculate progress percentage for FREE tier
  const alertProgress = usage
    ? (usage.alerts.used / usage.alerts.limit) * 100
    : 0;

  return (
    <>
      {/* Profile Trigger Button */}
      <div className="relative">
        <button
          ref={buttonRef}
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            'flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-gray-100',
            isOpen && 'border-2 border-blue-500 bg-blue-50'
          )}
          aria-label="User menu"
          aria-expanded={isOpen}
          aria-haspopup="true"
        >
          <Avatar className="h-10 w-10 border-2 border-gray-200">
            <AvatarImage
              src={user.avatar || '/placeholder.svg'}
              alt={user.name}
            />
            <AvatarFallback className="bg-blue-600 font-bold text-white">
              {getUserInitials(user.name)}
            </AvatarFallback>
          </Avatar>
          <div className="hidden flex-col items-start md:flex">
            <span className="text-sm font-medium text-gray-900">
              {user.name}
            </span>
            <span className="text-xs text-gray-600">
              {user.tier === 'FREE' ? 'FREE 🆓' : 'PRO ⭐'}
            </span>
          </div>
          <ChevronDown
            className={cn(
              'h-4 w-4 text-gray-500 transition-transform',
              isOpen && 'rotate-180'
            )}
          />
        </button>

        {/* Dropdown Menu */}
        {isOpen && (
          <div
            ref={dropdownRef}
            className={cn(
              'absolute right-0 z-50 mt-2 w-80 rounded-xl border-2 border-gray-200 bg-white shadow-2xl transition-all duration-200',
              'animate-in slide-in-from-top-2 fade-in',
              'max-w-[90vw] md:w-80'
            )}
            role="menu"
          >
            {/* User Info Section */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white">
              <Avatar className="mx-auto mb-3 h-16 w-16 border-4 border-white shadow-lg">
                <AvatarImage
                  src={user.avatar || '/placeholder.svg'}
                  alt={user.name}
                />
                <AvatarFallback className="bg-blue-700 text-xl font-bold text-white">
                  {getUserInitials(user.name)}
                </AvatarFallback>
              </Avatar>
              <h3 className="mb-1 text-center text-xl font-bold">
                {user.name}
              </h3>
              <p className="mb-3 text-center text-sm opacity-90">
                {user.email}
              </p>
              <div className="flex justify-center">
                <span className="inline-block rounded-full bg-white/20 px-4 py-2 text-center text-sm">
                  {user.tier === 'FREE' ? 'FREE TIER 🆓' : 'PRO TIER ⭐'}
                </span>
              </div>
            </div>

            {/* Tier Status Section */}
            {user.tier === 'FREE' && (
              <div className="m-4 border-l-4 border-yellow-500 bg-yellow-50 p-4">
                <h4 className="mb-2 text-sm font-semibold text-yellow-900">
                  Upgrade to PRO
                </h4>
                <p className="mb-3 text-xs text-yellow-800">
                  Get 15 symbols, 9 timeframes, and 20 alerts
                </p>
                {usage && (
                  <>
                    <p className="mb-1 text-xs text-yellow-800">
                      Using {usage.alerts.used}/{usage.alerts.limit} alerts
                    </p>
                    <div className="mb-3 h-2 w-full rounded-full bg-yellow-200">
                      <div
                        className="h-2 rounded-full bg-yellow-600"
                        style={{ width: `${alertProgress}%` }}
                      />
                    </div>
                  </>
                )}
                <Button
                  onClick={() => {
                    setIsOpen(false);
                    onUpgrade?.();
                  }}
                  className="mt-3 w-full bg-blue-600 py-2 text-sm font-semibold hover:bg-blue-700"
                >
                  Upgrade Now
                </Button>
              </div>
            )}

            {user.tier === 'PRO' && (
              <div className="m-4 border-l-4 border-blue-500 bg-blue-50 p-4">
                <h4 className="mb-2 text-sm font-semibold text-blue-900">
                  PRO Tier Active ✓
                </h4>
                {subscriptionStatus?.type === 'trial' &&
                  subscriptionStatus.endsAt && (
                    <p className="mb-2 text-xs text-blue-800">
                      Trial ends in{' '}
                      {Math.ceil(
                        (subscriptionStatus.endsAt.getTime() - Date.now()) /
                          (1000 * 60 * 60 * 24)
                      )}{' '}
                      days
                    </p>
                  )}
                {subscriptionStatus?.type === 'active' &&
                  subscriptionStatus.renewsAt && (
                    <p className="mb-2 text-xs text-blue-800">
                      Renews on{' '}
                      {subscriptionStatus.renewsAt.toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                  )}
                {usage && (
                  <div className="mb-2 space-y-1">
                    <p className="text-xs text-blue-700">
                      Alerts: {usage.alerts.used}/{usage.alerts.limit}
                    </p>
                    <p className="text-xs text-blue-700">
                      Watchlist: {usage.watchlist.used}/{usage.watchlist.limit}
                    </p>
                  </div>
                )}
                <button
                  onClick={() =>
                    handleNavigation('/dashboard/settings/billing')
                  }
                  className="mt-2 cursor-pointer text-xs text-blue-600 hover:underline"
                >
                  Manage subscription →
                </button>
              </div>
            )}

            {/* Menu Items */}
            <Divider />

            {/* Group 1: Account */}
            <MenuItem
              icon={User}
              label="My Profile"
              onClick={() => handleNavigation('/dashboard/settings/profile')}
            />
            <MenuItem
              icon={Settings}
              label="Settings"
              onClick={() => handleNavigation('/dashboard/settings')}
            />

            <Divider />

            {/* Group 2: Billing */}
            <MenuItem
              icon={CreditCard}
              label="Billing & Subscription"
              onClick={() => handleNavigation('/dashboard/settings/billing')}
              badge="PRO"
            />

            <Divider />

            {/* Group 3: Help & Support */}
            <MenuItem
              icon={HelpCircle}
              label="Help & Support"
              onClick={() => handleNavigation('/dashboard/settings/help')}
            />
            <MenuItem
              icon={Book}
              label="Documentation"
              onClick={() =>
                handleExternalLink('https://docs.tradingalerts.com')
              }
              external
            />
            <MenuItem
              icon={Bug}
              label="Report a Bug"
              onClick={() => handleNavigation('/dashboard/settings/bug-report')}
            />

            <Divider />

            {/* Group 4: Preferences */}
            <MenuItem
              icon={Palette}
              label="Appearance"
              onClick={() => handleNavigation('/dashboard/settings/appearance')}
              subLabel="Light"
            />
            <MenuItem
              icon={Globe}
              label="Language"
              onClick={() => handleNavigation('/dashboard/settings/language')}
              subLabel="English"
            />

            <Divider />

            {/* Group 5: Sign Out */}
            <MenuItem
              icon={LogOut}
              label="Sign Out"
              onClick={handleSignOutClick}
              danger
            />

            {/* Keyboard Shortcuts Hint */}
            <div className="border-t-2 border-gray-200 bg-gray-50 p-3 text-center text-xs text-gray-500">
              💡 Press '?' for keyboard shortcuts
            </div>
          </div>
        )}
      </div>

      {/* Sign Out Confirmation Modal */}
      {showSignOutModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setShowSignOutModal(false)}
        >
          <div
            className="max-w-md rounded-2xl bg-white p-8 text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 text-6xl text-gray-400">
              <LogOut className="mx-auto h-16 w-16" />
            </div>
            <h2 className="mb-2 text-2xl font-bold text-gray-900">Sign Out?</h2>
            <p className="mb-8 text-gray-600">
              Are you sure you want to sign out of your account?
            </p>
            <div className="flex justify-center gap-3">
              <Button
                variant="outline"
                onClick={() => setShowSignOutModal(false)}
                className="border-2 border-gray-300 px-6 py-3 text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </Button>
              <Button
                onClick={confirmSignOut}
                className="bg-red-600 px-6 py-3 font-semibold hover:bg-red-700"
              >
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
