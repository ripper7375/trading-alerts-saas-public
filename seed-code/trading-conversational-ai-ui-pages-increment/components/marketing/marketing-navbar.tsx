'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  Sparkles,
  ArrowRight,
  Menu,
  X,
  LineChart,
  Shield,
  FileText,
  HelpCircle,
  Activity,
  Layers,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useLocale } from '@/lib/context/locale-context';

export function MarketingNavbar() {
  const pathname = usePathname();
  const { t } = useLocale();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { href: '/#features', label: t('Features') },
    { href: '/pricing', label: t('Pricing') },
    { href: '/docs', label: t('Docs') },
    { href: '/blog', label: t('Blog') },
    { href: '/affiliate', label: t('Affiliates') },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-800/80 bg-[#06070a]/90 backdrop-blur-xl">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
        {/* Brand Logo with Davin AI Icon */}
        <Link href="/" className="group flex items-center space-x-3">
          <div className="relative flex h-10 w-10 overflow-hidden rounded-xl border border-amber-500/40 bg-amber-500/20 p-0.5 shadow-lg shadow-amber-500/20 transition-transform group-hover:scale-105">
            <Image
              src="/davintrade-ai-icon.png"
              alt="DavinTrade AI Icon"
              width={40}
              height={40}
              className="h-full w-full rounded-[9px] object-cover"
              onError={(e) => {
                // Fallback gracefully
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="bg-gradient-to-r from-amber-400 via-amber-200 to-yellow-500 bg-clip-text text-lg font-black tracking-tight text-transparent">
                DavinTrade
              </span>
              <Badge className="border-amber-500/40 bg-amber-500/15 px-1.5 py-0 text-[10px] font-bold text-amber-400">
                AI
              </Badge>
            </div>
            <span className="text-[10px] font-medium text-slate-400">
              {t('Conversational Quantitative SaaS')}
            </span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden items-center space-x-6 text-sm font-medium md:flex">
          {navLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`transition-colors hover:text-amber-400 ${
                pathname === item.href
                  ? 'font-semibold text-amber-400'
                  : 'text-slate-300'
              }`}
            >
              {item.label}
            </Link>
          ))}

          {/* More Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1 text-slate-300 transition-colors hover:text-amber-400 focus:outline-none">
                <span>{t('More')}</span>
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-48 border-slate-800 bg-[#0d111c]/95 backdrop-blur-xl"
            >
              <DropdownMenuItem asChild>
                <Link
                  href="/about"
                  className="flex cursor-pointer items-center gap-2 text-slate-200 hover:text-amber-400"
                >
                  <Layers className="h-4 w-4 text-amber-400" />
                  <span>{t('About Us')}</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link
                  href="/status"
                  className="flex cursor-pointer items-center gap-2 text-slate-200 hover:text-amber-400"
                >
                  <Activity className="h-4 w-4 text-emerald-400" />
                  <span>{t('System Status')}</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link
                  href="/changelog"
                  className="flex cursor-pointer items-center gap-2 text-slate-200 hover:text-amber-400"
                >
                  <Sparkles className="h-4 w-4 text-amber-400" />
                  <span>{t('Changelog')}</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link
                  href="/help"
                  className="flex cursor-pointer items-center gap-2 text-slate-200 hover:text-amber-400"
                >
                  <HelpCircle className="h-4 w-4 text-cyan-400" />
                  <span>{t('Help Centre')}</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-slate-800" />
              <DropdownMenuItem asChild>
                <Link
                  href="/disclaimer"
                  className="flex cursor-pointer items-center gap-2 text-xs text-slate-400 hover:text-slate-200"
                >
                  <Shield className="h-3.5 w-3.5" />
                  <span>{t('Risk Disclaimer')}</span>
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>

        {/* Right CTA / Auth */}
        <div className="hidden items-center space-x-3 md:flex">
          <Link href="/login">
            <Button
              variant="ghost"
              className="text-slate-300 hover:bg-slate-800/60 hover:text-slate-100"
            >
              {t('Log In')}
            </Button>
          </Link>
          <Link href="/register">
            <Button className="bg-gradient-to-r from-amber-500 to-amber-600 font-bold text-slate-950 shadow-md shadow-amber-500/20 hover:from-amber-400 hover:to-amber-500">
              <Sparkles className="mr-1.5 h-4 w-4" />
              {t('Get Started')}
            </Button>
          </Link>
        </div>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-800 text-slate-400 hover:text-slate-100 md:hidden"
        >
          {mobileMenuOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <Menu className="h-5 w-5" />
          )}
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="border-b border-slate-800 bg-[#06070a]/98 px-4 py-6 md:hidden">
          <div className="flex flex-col space-y-4">
            {navLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className="text-base font-medium text-slate-200 hover:text-amber-400"
              >
                {item.label}
              </Link>
            ))}
            <div className="flex flex-col space-y-2 border-t border-slate-800/80 pt-4">
              <Link
                href="/about"
                onClick={() => setMobileMenuOpen(false)}
                className="text-sm text-slate-300 hover:text-amber-400"
              >
                {t('About Us')}
              </Link>
              <Link
                href="/status"
                onClick={() => setMobileMenuOpen(false)}
                className="text-sm text-slate-300 hover:text-amber-400"
              >
                {t('System Status')}
              </Link>
              <Link
                href="/help"
                onClick={() => setMobileMenuOpen(false)}
                className="text-sm text-slate-300 hover:text-amber-400"
              >
                {t('Help Centre')}
              </Link>
            </div>
            <div className="flex flex-col gap-2 border-t border-slate-800/80 pt-4">
              <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                <Button
                  variant="outline"
                  className="w-full border-slate-700 text-slate-200"
                >
                  {t('Log In')}
                </Button>
              </Link>
              <Link href="/register" onClick={() => setMobileMenuOpen(false)}>
                <Button className="w-full bg-amber-500 font-bold text-slate-950 hover:bg-amber-400">
                  {t('Get Started Free')}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
