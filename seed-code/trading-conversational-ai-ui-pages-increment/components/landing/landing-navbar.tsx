'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Bot, Sparkles, ArrowRight, Globe, Shield, Zap } from 'lucide-react';

export function LandingNavbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-800/80 bg-[#06070a]/85 backdrop-blur-xl">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
        {/* Brand Logo */}
        <Link href="/" className="group flex items-center space-x-3">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 via-amber-600 to-amber-700 p-0.5 shadow-lg shadow-amber-500/20 transition-transform group-hover:scale-105">
            <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-[#0c0f17]">
              <Bot className="h-5 w-5 text-amber-400" />
            </div>
          </div>
          <div className="flex flex-col">
            <span className="flex items-center gap-1.5 text-lg font-black tracking-tight text-white">
              Davin<span className="text-amber-400">Trade</span>
              <span className="rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-amber-300 uppercase">
                AI SaaS
              </span>
            </span>
            <span className="text-[10px] font-medium text-slate-400">
              Quantitative Conversational Intelligence
            </span>
          </div>
        </Link>

        {/* Center Nav Links */}
        <nav className="hidden items-center space-x-8 md:flex">
          <a
            href="#features"
            className="text-sm font-medium text-slate-300 transition-colors hover:text-amber-400"
          >
            Features
          </a>
          <a
            href="#preview"
            className="text-sm font-medium text-slate-300 transition-colors hover:text-amber-400"
          >
            AI Workbench
          </a>
          <Link
            href="/pricing"
            className="text-sm font-medium text-slate-300 transition-colors hover:text-amber-400"
          >
            Pricing
          </Link>
          <Link
            href="/alerts"
            className="flex items-center gap-1 text-sm font-medium text-slate-300 transition-colors hover:text-amber-400"
          >
            <Zap className="h-3.5 w-3.5 text-amber-400" />
            Live Alerts
          </Link>
          <Link
            href="/affiliate/dashboard"
            className="text-sm font-medium text-slate-300 transition-colors hover:text-amber-400"
          >
            Affiliates
          </Link>
        </nav>

        {/* Right Action Controls */}
        <div className="flex items-center space-x-3">
          <Link href="/settings/language">
            <Button
              variant="outline"
              size="sm"
              className="hidden h-9 border-slate-800 bg-[#0d111c] text-xs font-semibold text-slate-300 hover:border-amber-500/40 hover:bg-slate-800 sm:flex"
            >
              <Globe className="mr-1.5 h-3.5 w-3.5 text-amber-400" />
              en-GB (£)
            </Button>
          </Link>

          <Link href="/login">
            <Button
              variant="ghost"
              size="sm"
              className="h-9 text-xs font-medium text-slate-300 hover:bg-slate-800/80 hover:text-white"
            >
              Sign In
            </Button>
          </Link>

          <Link href="/terminal">
            <Button
              size="sm"
              className="h-9 bg-gradient-to-r from-amber-500 via-amber-600 to-amber-500 font-bold text-slate-950 shadow-md shadow-amber-500/25 transition-all duration-300 hover:scale-[1.02] hover:from-amber-400 hover:to-amber-500 hover:shadow-amber-500/40"
            >
              <Sparkles className="mr-1.5 h-4 w-4" />
              Launch AI Terminal
              <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
