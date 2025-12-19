/**
 * Affiliate Portal Layout
 *
 * Provides navigation and common layout for affiliate dashboard pages.
 * Requires authenticated affiliate access.
 *
 * @module app/affiliate/layout
 */

import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getSession } from '@/lib/auth/session';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPE DEFINITIONS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface AffiliateLayoutProps {
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
 * Affiliate Portal Layout
 * Wraps affiliate pages with navigation and authentication check
 */
export default async function AffiliateLayout({
  children,
}: AffiliateLayoutProps): Promise<React.ReactElement> {
  // Check authentication
  const session = await getSession();

  if (!session || !session.user) {
    redirect('/auth/login?callbackUrl=/affiliate/dashboard');
  }

  // Check if user is an affiliate
  if (!session.user.isAffiliate) {
    redirect('/affiliate/register');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Header */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              {/* Logo/Brand */}
              <div className="flex-shrink-0 flex items-center">
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
                    className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-700 hover:text-gray-900 hover:border-b-2 hover:border-blue-500"
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
        <div className="sm:hidden border-t border-gray-200">
          <div className="px-2 pt-2 pb-3 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="block px-3 py-2 text-base font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900 rounded-md"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 sm:px-0">{children}</div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-gray-500">
            Trading Alerts Affiliate Program
          </p>
        </div>
      </footer>
    </div>
  );
}
