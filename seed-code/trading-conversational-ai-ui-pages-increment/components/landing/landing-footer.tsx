'use client';

import Link from 'next/link';
import { Bot, Shield, Globe } from 'lucide-react';

export function LandingFooter() {
  return (
    <footer className="border-t border-slate-800 bg-[#040508] py-12 text-xs text-slate-400">
      <div className="container mx-auto space-y-8 px-4 md:px-6">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          {/* Col 1: Brand */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2 text-base font-bold text-white">
              <Bot className="h-5 w-5 text-amber-400" />
              <span>DavinTrade AI SaaS</span>
            </div>
            <p className="text-xs leading-relaxed text-slate-400">
              Quantitative conversational intelligence, real-time alert
              triggers, and multi-model technical analysis.
            </p>
            <div className="flex items-center space-x-2 text-[11px] text-slate-400">
              <Globe className="h-3.5 w-3.5 text-amber-400" />
              <span>Targeting UK (GBP £) & 8 dLocal Markets</span>
            </div>
          </div>

          {/* Col 2: Navigation */}
          <div className="space-y-2">
            <div className="mb-2 text-xs font-bold tracking-wider text-slate-200 uppercase">
              Platform & Terminal
            </div>
            <ul className="space-y-1.5">
              <li>
                <Link
                  href="/terminal"
                  className="transition-colors hover:text-amber-400"
                >
                  PRO AI Analyst Terminal
                </Link>
              </li>
              <li>
                <Link
                  href="/free"
                  className="transition-colors hover:text-amber-400"
                >
                  FREE Tier Terminal
                </Link>
              </li>
              <li>
                <Link
                  href="/dashboard"
                  className="transition-colors hover:text-amber-400"
                >
                  User Dashboard
                </Link>
              </li>
              <li>
                <Link
                  href="/alerts"
                  className="transition-colors hover:text-amber-400"
                >
                  Real-Time Alert Manager
                </Link>
              </li>
              <li>
                <Link
                  href="/pricing"
                  className="transition-colors hover:text-amber-400"
                >
                  Pricing Matrix
                </Link>
              </li>
              <li>
                <Link
                  href="/docs"
                  className="transition-colors hover:text-amber-400"
                >
                  Documentation
                </Link>
              </li>
              <li>
                <Link
                  href="/changelog"
                  className="transition-colors hover:text-amber-400"
                >
                  Changelog
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 3: Account & Resources */}
          <div className="space-y-2">
            <div className="mb-2 text-xs font-bold tracking-wider text-slate-200 uppercase">
              Account & Company
            </div>
            <ul className="space-y-1.5">
              <li>
                <Link
                  href="/login"
                  className="transition-colors hover:text-amber-400"
                >
                  Sign In
                </Link>
              </li>
              <li>
                <Link
                  href="/register"
                  className="transition-colors hover:text-amber-400"
                >
                  Register Account
                </Link>
              </li>
              <li>
                <Link
                  href="/blog"
                  className="transition-colors hover:text-amber-400"
                >
                  Trading Blog
                </Link>
              </li>
              <li>
                <Link
                  href="/careers"
                  className="transition-colors hover:text-amber-400"
                >
                  Careers
                </Link>
              </li>
              <li>
                <Link
                  href="/settings/security"
                  className="transition-colors hover:text-amber-400"
                >
                  Security & 2FA
                </Link>
              </li>
              <li>
                <Link
                  href="/affiliate/dashboard"
                  className="transition-colors hover:text-amber-400"
                >
                  Affiliate Partner Portal
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 4: Legal & Compliance */}
          <div className="space-y-2">
            <div className="mb-2 text-xs font-bold tracking-wider text-slate-200 uppercase">
              Disclosures & Legal
            </div>
            <ul className="space-y-1.5">
              <li>
                <Link
                  href="/terms"
                  className="transition-colors hover:text-amber-400"
                >
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link
                  href="/privacy"
                  className="transition-colors hover:text-amber-400"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  href="/disclaimer"
                  className="transition-colors hover:text-amber-400"
                >
                  Financial Risk Disclaimer
                </Link>
              </li>
              <li>
                <Link
                  href="/help"
                  className="transition-colors hover:text-amber-400"
                >
                  Help Center & Support Tickets
                </Link>
              </li>
              <li>
                <Link
                  href="/admin"
                  className="transition-colors hover:text-amber-400"
                >
                  Admin System Portal
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Disclaimer */}
        <div className="space-y-2 border-t border-slate-800/80 pt-6 text-[11px] leading-relaxed text-slate-400">
          <p>
            <strong className="text-slate-400">Risk Disclosure:</strong>{' '}
            Financial trading carries a high level of risk and may not be
            suitable for all investors. Leveraged products like Forex, Gold, and
            Cryptocurrencies can result in capital loss. DavinTrade AI provides
            automated quantitative pattern recognition and educational AI
            analysis only, and does not provide personal investment advice.
          </p>
          <div className="flex flex-col items-center justify-between pt-4 text-slate-400 sm:flex-row">
            <span>
              © {new Date().getFullYear()} DavinTrade SaaS. All rights
              reserved.
            </span>
            <span>Deployed on Vercel Cloud Infrastructure</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
