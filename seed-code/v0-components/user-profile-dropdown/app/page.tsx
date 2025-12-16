'use client';

import { useRouter } from 'next/navigation';
import UserProfileDropdown from '@/components/user-profile-dropdown';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';

export default function Home() {
  const router = useRouter();
  const { toast } = useToast();

  // Mock user data - FREE tier example
  const freeUser = {
    name: 'John Trader',
    email: 'john@example.com',
    avatar: '/professional-trader-avatar.png',
    tier: 'FREE' as const,
  };

  // Mock user data - PRO tier example
  const proUser = {
    name: 'Sarah Williams',
    email: 'sarah@example.com',
    avatar: '/professional-businesswoman-avatar.jpg',
    tier: 'PRO' as const,
  };

  const freeUsage = {
    alerts: { used: 4, limit: 5 },
    watchlist: { used: 3, limit: 5 },
  };

  const proUsage = {
    alerts: { used: 8, limit: 20 },
    watchlist: { used: 12, limit: 50 },
  };

  const proSubscription = {
    type: 'active' as const,
    renewsAt: new Date('2025-02-15'),
  };

  const handleSignOut = () => {
    // In production, call next-auth signOut() here
    toast({
      title: '✓ Signed out successfully',
      description: 'You have been logged out of your account.',
    });
    // Simulate redirect to login
    setTimeout(() => {
      router.push('/login');
    }, 1000);
  };

  const handleUpgrade = () => {
    router.push('/pricing');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation Bar */}
      <nav className="border-b-2 border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-gray-900">Trading Alerts</h1>
            <nav className="hidden items-center gap-6 md:flex">
              <a
                href="#"
                className="text-sm font-medium text-gray-600 hover:text-gray-900"
              >
                Dashboard
              </a>
              <a
                href="#"
                className="text-sm font-medium text-gray-600 hover:text-gray-900"
              >
                Watchlist
              </a>
              <a
                href="#"
                className="text-sm font-medium text-gray-600 hover:text-gray-900"
              >
                Alerts
              </a>
            </nav>
          </div>

          {/* User Profile Dropdown */}
          <UserProfileDropdown
            user={freeUser}
            usage={freeUsage}
            onSignOut={handleSignOut}
            onUpgrade={handleUpgrade}
          />
        </div>
      </nav>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-12">
        <div className="mb-8 rounded-xl border-2 border-gray-200 bg-white p-8">
          <h2 className="mb-4 text-3xl font-bold text-gray-900">
            User Profile Dropdown Demo
          </h2>
          <p className="mb-6 text-gray-600">
            This demo showcases the user profile dropdown component with all
            features including tier badges, menu items, and sign-out flow.
          </p>

          <div className="space-y-4">
            <div className="rounded-lg bg-blue-50 p-4">
              <h3 className="mb-2 font-semibold text-blue-900">
                Current Demo: FREE Tier User
              </h3>
              <ul className="list-inside list-disc space-y-1 text-sm text-blue-800">
                <li>Using 4/5 alerts (80% usage)</li>
                <li>Shows upgrade prompt</li>
                <li>All menu items functional</li>
                <li>Sign-out confirmation modal</li>
              </ul>
            </div>

            <div className="rounded-lg bg-gray-100 p-4">
              <h3 className="mb-2 font-semibold text-gray-900">Features:</h3>
              <ul className="grid grid-cols-1 gap-2 text-sm text-gray-700 md:grid-cols-2">
                <li>✓ Profile trigger with avatar</li>
                <li>✓ Tier badges (FREE/PRO)</li>
                <li>✓ User info section</li>
                <li>✓ Usage statistics</li>
                <li>✓ Upgrade prompt for FREE users</li>
                <li>✓ Subscription status for PRO users</li>
                <li>✓ Grouped menu items</li>
                <li>✓ External link handling</li>
                <li>✓ Sign-out confirmation</li>
                <li>✓ Keyboard shortcuts (ESC to close)</li>
                <li>✓ Click outside to close</li>
                <li>✓ Fully responsive</li>
              </ul>
            </div>
          </div>
        </div>

        {/* PRO User Example */}
        <div className="rounded-xl border-2 border-gray-200 bg-white p-8">
          <h3 className="mb-4 text-2xl font-bold text-gray-900">
            PRO Tier Example
          </h3>
          <p className="mb-4 text-gray-600">
            Click the profile dropdown below to see the PRO tier version:
          </p>
          <div className="flex justify-center">
            <UserProfileDropdown
              user={proUser}
              usage={proUsage}
              subscriptionStatus={proSubscription}
              onSignOut={handleSignOut}
            />
          </div>
        </div>
      </main>

      <Toaster />
    </div>
  );
}
