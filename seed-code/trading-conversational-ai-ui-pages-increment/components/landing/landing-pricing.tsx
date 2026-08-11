'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Check, Sparkles, Zap, Shield, ArrowRight } from 'lucide-react';

export function LandingPricing() {
  return (
    <section id="pricing" className="relative bg-[#06070a] py-20">
      <div className="container mx-auto px-4 md:px-6">
        {/* Section Title */}
        <div className="mx-auto mb-16 max-w-3xl space-y-4 text-center">
          <div className="inline-flex items-center space-x-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1 text-xs font-bold text-amber-300">
            <Zap className="h-3.5 w-3.5" />
            <span>TRANSPARENT SAAS PRICING</span>
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Choose Your Analytical Advantage
          </h2>
          <p className="text-base text-slate-400 sm:text-lg">
            Start with our generous FREE tier or unlock full PRO multi-model AI
            capabilities.
          </p>
        </div>

        {/* Pricing Cards Grid */}
        <div className="mx-auto grid max-w-4xl grid-cols-1 gap-8 md:grid-cols-2">
          {/* FREE Tier Card */}
          <div className="relative flex flex-col justify-between rounded-2xl border border-slate-800 bg-[#0c101a]/80 p-8 shadow-xl backdrop-blur-md">
            <div>
              <div className="mb-4 flex items-center justify-between">
                <span className="text-xs font-bold tracking-wider text-slate-400 uppercase">
                  FREE STARTER TIER
                </span>
                <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-300">
                  Read-Only Analyst
                </span>
              </div>
              <div className="mb-6 flex items-baseline space-x-2">
                <span className="font-mono text-4xl font-extrabold text-white">
                  $0
                </span>
                <span className="text-sm text-slate-400">/ forever free</span>
              </div>
              <p className="mb-6 text-sm text-slate-400">
                Ideal for beginner traders wanting read-only AI market history
                and live M5 XAUUSD charts.
              </p>

              <ul className="mb-8 space-y-3 text-sm text-slate-300">
                <li className="flex items-center space-x-3">
                  <Check className="h-4 w-4 shrink-0 text-emerald-400" />
                  <span>3-Panel Read-Only Terminal</span>
                </li>
                <li className="flex items-center space-x-3">
                  <Check className="h-4 w-4 shrink-0 text-emerald-400" />
                  <span>Live M5 XAUUSD Chart Stream</span>
                </li>
                <li className="flex items-center space-x-3">
                  <Check className="h-4 w-4 shrink-0 text-emerald-400" />
                  <span>5 Standard Alert Rules</span>
                </li>
                <li className="flex items-center space-x-3 text-slate-500">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full border border-slate-700 text-[10px]">
                    ✕
                  </span>
                  <span>Multi-Model AI Confluence (Pro)</span>
                </li>
              </ul>
            </div>

            <Link href="/free">
              <Button
                variant="outline"
                className="h-11 w-full border-slate-700 bg-slate-800/80 font-bold text-white hover:bg-slate-700"
              >
                Try Free Terminal
              </Button>
            </Link>
          </div>

          {/* PRO Tier Card */}
          <div className="relative flex flex-col justify-between rounded-2xl border-2 border-amber-500/60 bg-gradient-to-b from-[#131826] to-[#0c0f18] p-8 shadow-2xl shadow-amber-500/10">
            <div className="absolute -top-3.5 right-8 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 px-3 py-1 text-xs font-bold tracking-wider text-slate-950 uppercase shadow-md">
              POPULAR PRO TIER
            </div>

            <div>
              <div className="mb-4 flex items-center justify-between">
                <span className="flex items-center gap-1 text-xs font-bold tracking-wider text-amber-400 uppercase">
                  <Sparkles className="h-3.5 w-3.5" />
                  PRO QUANTITATIVE SUITE
                </span>
              </div>
              <div className="mb-6 flex items-baseline space-x-2">
                <span className="font-mono text-4xl font-extrabold text-white">
                  $49
                </span>
                <span className="text-sm text-slate-400">/ month</span>
              </div>
              <p className="mb-6 text-sm text-slate-300">
                Full 4-Panel Workbench, dual AI model confluence score,
                sub-500ms alerts, & local multi-currency checkout.
              </p>

              <ul className="mb-8 space-y-3 text-sm text-slate-200">
                <li className="flex items-center space-x-3">
                  <Check className="h-4 w-4 shrink-0 text-amber-400" />
                  <span className="font-bold">
                    Full 4-Panel Resizable Workbench
                  </span>
                </li>
                <li className="flex items-center space-x-3">
                  <Check className="h-4 w-4 shrink-0 text-amber-400" />
                  <span>Dual AI Model Pattern Verification</span>
                </li>
                <li className="flex items-center space-x-3">
                  <Check className="h-4 w-4 shrink-0 text-amber-400" />
                  <span>Sub-500ms Unlimited Price Breach Alerts</span>
                </li>
                <li className="flex items-center space-x-3">
                  <Check className="h-4 w-4 shrink-0 text-amber-400" />
                  <span>Multi-Currency Local Checkout (£, ₹, ₫, ฿, ₦, Rs)</span>
                </li>
              </ul>
            </div>

            <Link href="/checkout">
              <Button className="h-11 w-full bg-gradient-to-r from-amber-500 via-amber-600 to-amber-500 font-extrabold text-slate-950 shadow-lg shadow-amber-500/25 hover:from-amber-400 hover:to-amber-500">
                Upgrade to PRO Access
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
