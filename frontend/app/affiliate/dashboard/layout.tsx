/**
 * Affiliate Dashboard Layout
 *
 * Protected layout for affiliate dashboard pages.
 * Requires authenticated affiliate access.
 * Provides navigation and common layout.
 *
 * @module app/affiliate/dashboard/layout
 */

import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getSession } from '@/lib/auth/session';

// Force dynamic rendering since this layout uses headers via getSession
export const dynamic = 'force-dynamic';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPE DEFINITIONS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface DashboardLayoutProps {
  children: React.ReactNode;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// NAVIGATION LINKS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const navLinks = [
  { href: '/affiliate/dashboard', label: 'Dashboard' },
  { href: '/affiliate/dashboard/codes', label: 'My Codes' },
  { href: '/affiliate/dashboard/commissions', label: 'Commissions' },
  { href: '/affiliate/dashboard/profile', label: 'Profile' },
];

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMPONENT
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Affiliate Dashboard Layout
 * Wraps dashboard pages with navigation and authentication check
 */
export default async function AffiliateDashboardLayout({
  children,
}: DashboardLayoutProps): Promise<React.ReactElement> {
  // Check authentication
  const session = await getSession();

  if (!session || !session.user) {
    redirect('/login?callbackUrl=/affiliate/dashboard');
  }

  // Check if user is an affiliate
  if (!session.user.isAffiliate) {
    redirect('/affiliate/register');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Header */}
      <nav className="border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 justify-between">
            <div className="flex">
              {/* Logo/Brand */}
              <div className="flex flex-shrink-0 items-center">
                <Link
                  href="/affiliate/dashboard"
                  className="text-xl font-bold text-gray-900"
                >
                  Affiliate Portal
                </Link>
              </div>

              {/* Navigation Links */}
              <div className="hidden sm:ml-8 sm:flex sm:space-x-8">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-700 hover:border-b-2 hover:border-blue-500 hover:text-gray-900"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>

            {/* User Menu */}
            <div className="flex items-center">
              <span className="text-sm text-gray-600">
                {session.user.email}
              </span>
              <Link
                href="/dashboard"
                className="ml-4 text-sm text-blue-600 hover:text-blue-800"
              >
                Back to App
              </Link>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="border-t border-gray-200 sm:hidden">
          <div className="space-y-1 px-2 pb-3 pt-2">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="block rounded-md px-3 py-2 text-base font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl py-6 sm:px-6 lg:px-8">
        <div className="px-4 sm:px-0">{children}</div>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-gray-500">
            Trading Alerts Affiliate Program
          </p>
        </div>
      </footer>
    </div>
  );
}
