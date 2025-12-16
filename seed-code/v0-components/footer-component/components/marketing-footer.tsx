'use client';

import type React from 'react';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Twitter,
  Linkedin,
  Github,
  Youtube,
  MessageCircle,
  ExternalLink,
  Loader2,
  CheckCircle2,
} from 'lucide-react';

// Link data constants for easy maintenance
const FOOTER_LINKS = {
  product: [
    { label: 'Features', href: '/features' },
    { label: 'Pricing', href: '/pricing' },
    { label: 'How It Works', href: '/how-it-works' },
    { label: 'Integrations', href: '/integrations' },
    { label: 'API Documentation', href: '/docs/api' },
    { label: "What's New", href: '/changelog' },
  ],
  company: [
    { label: 'About Us', href: '/about' },
    { label: 'Careers', href: '/careers' },
    { label: 'Blog', href: '/blog' },
    { label: 'Press Kit', href: '/press' },
    { label: 'Contact', href: '/contact' },
    { label: 'Partners', href: '/partners' },
  ],
  resources: [
    { label: 'Help Center', href: '/help' },
    { label: 'Documentation', href: '/docs' },
    { label: 'Trading Guide', href: '/guide' },
    { label: 'Video Tutorials', href: '/tutorials' },
    { label: 'Community Forum', href: '/community' },
    {
      label: 'Status Page',
      href: 'https://status.tradingalerts.com',
      external: true,
    },
  ],
  legal: [
    { label: 'Privacy Policy', href: '/privacy' },
    { label: 'Terms of Service', href: '/terms' },
    { label: 'Cookie Policy', href: '/cookies' },
    { label: 'Acceptable Use', href: '/acceptable-use' },
    { label: 'Refund Policy', href: '/refunds' },
    { label: 'Security', href: '/security' },
  ],
};

const SOCIAL_LINKS = [
  {
    name: 'Twitter',
    icon: Twitter,
    href: 'https://twitter.com/tradingalerts',
    hoverColor: 'hover:text-blue-400',
  },
  {
    name: 'LinkedIn',
    icon: Linkedin,
    href: 'https://linkedin.com/company/tradingalerts',
    hoverColor: 'hover:text-blue-500',
  },
  {
    name: 'GitHub',
    icon: Github,
    href: 'https://github.com/tradingalerts',
    hoverColor: 'hover:text-gray-400',
  },
  {
    name: 'YouTube',
    icon: Youtube,
    href: 'https://youtube.com/@tradingalerts',
    hoverColor: 'hover:text-red-500',
  },
  {
    name: 'Discord',
    icon: MessageCircle,
    href: 'https://discord.gg/tradingalerts',
    hoverColor: 'hover:text-indigo-400',
  },
];

interface MarketingFooterProps {
  variant?: 'marketing' | 'app';
  showNewsletter?: boolean;
  showSocial?: boolean;
}

export default function MarketingFooter({
  variant = 'marketing',
  showNewsletter = true,
  showSocial = true,
}: MarketingFooterProps) {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [error, setError] = useState('');

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setIsSubmitting(true);

    // Mock API call - replace with actual newsletter API
    try {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      setIsSubscribed(true);
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <footer className="w-full bg-gray-900 text-white">
      <div className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-16">
        {/* Top Section: Logo + Description + Social */}
        <div className="mb-12 grid gap-8 md:grid-cols-2">
          {/* Left Column */}
          <div>
            {/* Logo */}
            <div className="mb-4 flex items-center">
              <span
                className="text-4xl"
                role="img"
                aria-label="Trading Alerts Logo"
              >
                📊
              </span>
              <span className="ml-3 text-2xl font-bold text-white">
                Trading Alerts
              </span>
            </div>

            {/* Description */}
            <p className="mb-6 max-w-md text-sm text-gray-400">
              Never miss a trading setup again. Get real-time alerts when price
              reaches key support and resistance levels.
            </p>

            {/* Social Links */}
            {showSocial && (
              <div>
                <h3 className="mb-3 text-sm font-semibold text-gray-300">
                  Follow Us
                </h3>
                <div className="flex gap-4">
                  {SOCIAL_LINKS.map((social) => (
                    <a
                      key={social.name}
                      href={social.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={social.name}
                      className={`flex h-10 w-10 items-center justify-center rounded-lg bg-gray-800 transition-all hover:scale-110 hover:bg-gray-700 ${social.hoverColor}`}
                    >
                      <social.icon className="h-5 w-5 text-gray-400" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Trust Badges */}
          <div className="flex items-start justify-start md:justify-end">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span>🔒</span>
                <span>256-bit SSL</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span>✓</span>
                <span>GDPR Compliant</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span>💳</span>
                <span>Stripe Secured</span>
              </div>
            </div>
          </div>
        </div>

        {/* Middle Section: Link Columns */}
        <div className="mb-12 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Product Column */}
          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-white">
              Product
            </h3>
            <nav className="flex flex-col space-y-3">
              {FOOTER_LINKS.product.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm text-gray-400 transition-colors hover:text-white hover:underline"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Company Column */}
          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-white">
              Company
            </h3>
            <nav className="flex flex-col space-y-3">
              {FOOTER_LINKS.company.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm text-gray-400 transition-colors hover:text-white hover:underline"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Resources Column */}
          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-white">
              Resources
            </h3>
            <nav className="flex flex-col space-y-3">
              {FOOTER_LINKS.resources.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm text-gray-400 transition-colors hover:text-white hover:underline inline-flex items-center gap-1"
                  {...(link.external && {
                    target: '_blank',
                    rel: 'noopener noreferrer',
                  })}
                >
                  {link.label}
                  {link.external && (
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  )}
                </Link>
              ))}
            </nav>
          </div>

          {/* Legal Column */}
          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-white">
              Legal
            </h3>
            <nav className="flex flex-col space-y-3">
              {FOOTER_LINKS.legal.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm text-gray-400 transition-colors hover:text-white hover:underline"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>

        {/* Newsletter Section */}
        {showNewsletter && (
          <div className="mb-8 mt-12 rounded-xl border-2 border-gray-700 bg-gray-800 p-8">
            {!isSubscribed ? (
              <>
                <h3 className="mb-2 text-2xl font-bold text-white">
                  Stay Updated
                </h3>
                <p className="mb-6 text-sm text-gray-400">
                  Get the latest trading insights, product updates, and
                  exclusive tips delivered to your inbox.
                </p>

                <form
                  onSubmit={handleNewsletterSubmit}
                  className="flex flex-col gap-3 sm:flex-row"
                >
                  <Input
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="flex-1 rounded-lg border-2 border-gray-700 bg-gray-900 px-4 py-3 text-white placeholder:text-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                    disabled={isSubmitting}
                    aria-label="Email address"
                    aria-describedby={error ? 'newsletter-error' : undefined}
                  />
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="rounded-lg bg-blue-600 px-8 py-3 font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Subscribing...
                      </>
                    ) : (
                      'Subscribe'
                    )}
                  </Button>
                </form>

                {error && (
                  <p
                    id="newsletter-error"
                    className="mt-3 text-sm text-red-400"
                    role="alert"
                  >
                    {error}
                  </p>
                )}

                <p className="mt-3 text-xs text-gray-500">
                  We respect your privacy. Unsubscribe at any time.
                </p>
              </>
            ) : (
              <div className="text-center">
                <CheckCircle2
                  className="mx-auto mb-4 h-16 w-16 text-green-500"
                  aria-hidden="true"
                />
                <h3 className="mb-2 text-lg font-semibold text-white">
                  Thanks for subscribing!
                </h3>
                <p className="text-sm text-gray-400">
                  Check your email to confirm your subscription.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Bottom Section: Copyright + Legal */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-gray-800 pt-8 sm:flex-row">
          {/* Copyright */}
          <div className="text-center sm:text-left">
            <p className="text-sm text-gray-400">
              © 2025 Trading Alerts. All rights reserved.
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Made with ❤️ for traders worldwide
            </p>
          </div>

          {/* Quick Legal Links */}
          <nav className="flex flex-wrap items-center justify-center gap-2 text-sm text-gray-400">
            <Link
              href="/privacy"
              className="transition-colors hover:text-white"
            >
              Privacy
            </Link>
            <span className="text-gray-600">·</span>
            <Link href="/terms" className="transition-colors hover:text-white">
              Terms
            </Link>
            <span className="text-gray-600">·</span>
            <Link
              href="/cookies"
              className="transition-colors hover:text-white"
            >
              Cookies
            </Link>
            <span className="text-gray-600">·</span>
            <Link
              href="/sitemap"
              className="transition-colors hover:text-white"
            >
              Sitemap
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
