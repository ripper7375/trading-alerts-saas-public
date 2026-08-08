'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  Bell,
  Sparkles,
  User,
  Shield,
  LayoutDashboard,
  LineChart,
  Settings,
  LogOut,
  ChevronRight,
  ChevronDown,
  ShieldAlert,
  Share2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { useLocale } from '@/lib/context/locale-context';
import { SUPPORTED_COUNTRIES } from '@/lib/country-config';

interface AppHeaderProps {
  title?: string;
  subtitle?: string;
  tier?: 'PRO' | 'FREE';
}

export default function AppHeader({
  title,
  subtitle,
  tier = 'PRO',
}: AppHeaderProps) {
  const pathname = usePathname();
  const { t, countryCode, countryConfig, setCountryCode } = useLocale();
  const currentTier = pathname.startsWith('/free') ? 'FREE' : tier;

  return (
    <header className="z-20 flex h-14 w-full shrink-0 items-center justify-between border-b border-slate-800/80 bg-[#090b11] px-4 shadow-sm select-none">
      {/* Left: Brand Logo & Current Section Title */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded-lg ring-1 ring-amber-500/40">
            <Image
              src="/DavinTrade_Logo.jpg"
              alt="DavinTrade Logo"
              fill
              className="object-cover"
            />
          </div>
          <span className="hidden bg-gradient-to-r from-amber-400 via-amber-200 to-amber-500 bg-clip-text text-sm font-extrabold tracking-tight text-transparent sm:inline">
            DavinTrade
          </span>
        </Link>

        <ChevronRight className="hidden h-4 w-4 text-slate-600 sm:inline" />

        <div className="flex flex-col">
          <h1 className="flex items-center gap-2 text-xs font-bold text-slate-100">
            {title || 'Dashboard'}
            <Badge
              className={
                currentTier === 'PRO'
                  ? 'border-amber-500/40 bg-amber-500/20 px-1.5 py-0 font-mono text-[9px] text-amber-300'
                  : 'border-slate-700 bg-slate-800 px-1.5 py-0 font-mono text-[9px] text-slate-400'
              }
            >
              {currentTier === 'PRO' ? '⚡ PRO' : '🔒 FREE'}
            </Badge>
          </h1>
          {subtitle && (
            <p className="hidden truncate text-[10px] text-slate-400 md:inline">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {/* Middle: Quick Action Tabs */}
      <div className="hidden items-center gap-1 rounded-xl border border-slate-800 bg-[#05060a] p-1 md:flex">
        <Link href="/dashboard">
          <Button
            variant="ghost"
            size="sm"
            className={`h-7 px-3 text-xs font-medium ${
              pathname === '/dashboard'
                ? 'bg-slate-800 font-bold text-amber-300'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <LayoutDashboard className="mr-1.5 h-3.5 w-3.5" />
            {t('nav.dashboard', 'Dashboard')}
          </Button>
        </Link>
        <Link href={currentTier === 'FREE' ? '/free' : '/'}>
          <Button
            variant="ghost"
            size="sm"
            className={`h-7 px-3 text-xs font-medium ${
              pathname === '/' || pathname === '/free'
                ? 'border border-amber-500/30 bg-amber-500/20 font-bold text-amber-300'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <LineChart className="mr-1.5 h-3.5 w-3.5 text-amber-400" />
            {t('nav.ai_workspace', 'AI Analyst Workspace')}
          </Button>
        </Link>
        <Link href="/alerts">
          <Button
            variant="ghost"
            size="sm"
            className={`h-7 px-3 text-xs font-medium ${
              pathname.startsWith('/alerts')
                ? 'bg-slate-800 font-bold text-amber-300'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Bell className="mr-1.5 h-3.5 w-3.5" />
            {t('nav.alerts', 'Alerts')}
          </Button>
        </Link>
      </div>

      {/* Right: Country Selector, Notifications & User Profile */}
      <div className="flex items-center gap-2">
        {/* Quick Country Switcher Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="border-slate-750 h-7 gap-1.5 border bg-[#0c0f19] px-2 font-mono text-xs font-bold text-slate-200 hover:bg-slate-800"
              title={t('Select Country & Region')}
            >
              <span className="text-sm">{countryConfig?.flag || '🇬🇧'}</span>
              <span className="hidden font-sans text-[11px] font-bold text-amber-300 sm:inline">
                {countryConfig?.code || 'GB'}
              </span>
              <ChevronDown className="h-3 w-3 text-slate-400" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="border-slate-750 max-h-72 w-48 overflow-y-auto bg-[#0f1420] text-xs text-slate-200">
            <DropdownMenuLabel className="text-[10px] font-bold tracking-wider text-amber-400 uppercase">
              {t('Select Country & Region')}
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-slate-800" />
            {Object.values(SUPPORTED_COUNTRIES).map((c) => (
              <DropdownMenuItem
                key={c.code}
                onClick={() => setCountryCode(c.code)}
                className={`flex cursor-pointer items-center justify-between py-1.5 ${
                  countryCode === c.code
                    ? 'bg-amber-500/20 font-bold text-amber-300'
                    : ''
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">{c.flag}</span>
                  <span>{t(c.name)}</span>
                </div>
                <span className="font-mono text-[10px] text-slate-400">
                  {c.symbol}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {currentTier === 'FREE' && (
          <Link href="/pricing">
            <Button
              size="sm"
              className="h-7 bg-gradient-to-r from-amber-500 to-amber-600 px-2.5 text-xs font-extrabold text-slate-950 shadow-md shadow-amber-500/20 hover:from-amber-400 hover:to-amber-500"
            >
              <Sparkles className="mr-1 h-3.5 w-3.5 fill-black" />
              {t('Upgrade')}
            </Button>
          </Link>
        )}

        <Link href="/alerts">
          <Button
            variant="ghost"
            size="icon"
            className="relative h-8 w-8 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 animate-pulse rounded-full bg-rose-500 ring-2 ring-[#090b11]" />
          </Button>
        </Link>

        {/* User Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-2 p-1 hover:bg-slate-800"
            >
              <Avatar className="h-6 w-6 ring-1 ring-amber-500/40">
                <AvatarImage src="/placeholder-user.jpg" />
                <AvatarFallback className="bg-slate-800 text-[10px] text-slate-200">
                  TU
                </AvatarFallback>
              </Avatar>
              <span className="hidden text-xs font-bold text-slate-200 sm:inline">
                {t('Trader User', 'ผู้ใช้งานการเทรด')}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="border-slate-750 w-52 bg-[#0f1420] text-xs text-slate-200">
            <DropdownMenuLabel className="font-bold text-amber-400">
              {t('Trader Account')}
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-slate-800" />
            <DropdownMenuItem asChild>
              <Link
                href="/settings/profile"
                className="flex cursor-pointer items-center"
              >
                <User className="mr-2 h-3.5 w-3.5 text-slate-400" />{' '}
                {t('Profile Settings')}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link
                href="/settings/security"
                className="flex cursor-pointer items-center"
              >
                <Shield className="mr-2 h-3.5 w-3.5 text-slate-400" />{' '}
                {t('Security & 2FA')}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link
                href="/settings/billing"
                className="flex cursor-pointer items-center"
              >
                <Settings className="mr-2 h-3.5 w-3.5 text-slate-400" />{' '}
                {t('Billing & Invoices')}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-slate-800" />
            <DropdownMenuItem asChild>
              <Link
                href="/affiliate/dashboard"
                className="flex cursor-pointer items-center"
              >
                <Share2 className="mr-2 h-3.5 w-3.5 text-slate-400" />{' '}
                {t('Affiliate Partner Dashboard')}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/admin" className="flex cursor-pointer items-center">
                <ShieldAlert className="mr-2 h-3.5 w-3.5 text-slate-400" />{' '}
                {t('nav.admin', 'Admin Control')}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-slate-800" />
            <DropdownMenuItem asChild>
              <Link
                href="/login"
                className="flex cursor-pointer items-center text-rose-400"
              >
                <LogOut className="mr-2 h-3.5 w-3.5" /> {t('Log out')}
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
