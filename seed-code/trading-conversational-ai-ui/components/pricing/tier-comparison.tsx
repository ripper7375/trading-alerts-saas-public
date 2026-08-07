'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, X, Sparkles, Zap, Shield, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function TierComparison() {
  const [isAnnual, setIsAnnual] = useState(true);

  const features = [
    { name: 'XAUUSD Real-Time M5/M15 Data Stream', free: true, pro: true },
    {
      name: 'AI Chart Analyst Quad-RAG Queries',
      free: 'Gemini 3.6 Flash Only',
      pro: 'All 6 Premium AI Models',
    },
    {
      name: 'Interactive Prompt Input',
      free: 'Disabled (Read-Only History)',
      pro: 'Full Interactive Input',
    },
    {
      name: 'Server-Side Price & Line Alert Rules',
      free: '0 Active Alerts',
      pro: '100 Active Alerts',
    },
    {
      name: 'M5 Equal-Distance Centroid Channel Overlay',
      free: 'Locked (🔒 PRO Only)',
      pro: 'Full MTF Overlay',
    },
    {
      name: 'Live Market Comments & WebSocket Feed',
      free: 'Glassmorphism Blur Gate',
      pro: 'Unrestricted Feed',
    },
    {
      name: 'Speedometer Gauges & Quality Metrics',
      free: 'Locked',
      pro: 'Full Access',
    },
    {
      name: 'Monthly AI Token Allocation',
      free: '50,000 Tokens',
      pro: '500,000 Tokens',
    },
    { name: '24/7 Priority Support & VIP Discord', free: false, pro: true },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-8 select-none">
      {/* Billing Cycle Toggle */}
      <div className="flex flex-col items-center space-y-3 text-center">
        <Badge className="border-amber-500/40 bg-amber-500/10 px-3 py-1 font-mono text-xs text-amber-300">
          ⚡ PRO TIER UNLOCKS ALL AI MODELS & REAL-TIME FEEDS
        </Badge>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-100 sm:text-3xl">
          Flexible Pricing Built for Quantitative Traders
        </h1>

        <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-[#0b0e17] p-1">
          <button
            type="button"
            onClick={() => setIsAnnual(false)}
            className={`rounded-lg px-4 py-1.5 text-xs font-bold transition-all ${
              !isAnnual
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Monthly Billing
          </button>
          <button
            type="button"
            onClick={() => setIsAnnual(true)}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-bold transition-all ${
              isAnnual
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Annual Billing
            <span className="rounded bg-amber-300 px-1.5 py-0.5 text-[9px] font-extrabold text-slate-950 uppercase">
              Save 20%
            </span>
          </button>
        </div>
      </div>

      {/* Pricing Cards Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* FREE Tier Card */}
        <div className="flex flex-col justify-between space-y-6 rounded-2xl border border-slate-800 bg-[#090c14] p-6 shadow-xl">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-200">FREE Tier</h3>
                <p className="text-xs text-slate-400">
                  Basic market preview & past session viewer
                </p>
              </div>
              <Badge
                variant="outline"
                className="border-slate-700 bg-slate-800 font-mono text-slate-300"
              >
                FREE
              </Badge>
            </div>

            <div className="flex items-baseline gap-1">
              <span className="font-mono text-3xl font-extrabold text-slate-100">
                $0
              </span>
              <span className="text-xs text-slate-400">/ forever</span>
            </div>

            <Button
              variant="outline"
              asChild
              className="border-slate-750 h-10 w-full bg-slate-800 text-xs font-bold text-slate-200"
            >
              <Link href="/free">Access FREE Terminal</Link>
            </Button>
          </div>

          <div className="space-y-3 border-t border-slate-800/80 pt-4">
            <h4 className="text-xs font-bold tracking-wider text-slate-300 uppercase">
              Plan Highlights:
            </h4>
            <ul className="space-y-2 text-xs text-slate-400">
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 shrink-0 text-emerald-400" />{' '}
                Real-Time M5/M15 XAUUSD Charts
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 shrink-0 text-emerald-400" /> Gemini
                3.6 Flash AI Model
              </li>
              <li className="flex items-center gap-2 text-slate-500">
                <X className="h-4 w-4 shrink-0 text-rose-500" /> 0 Active Alerts
                (PRO Exclusive)
              </li>
              <li className="flex items-center gap-2 text-slate-500">
                <X className="h-4 w-4 shrink-0 text-rose-500" /> MTF
                Equal-Distance Overlay Locked
              </li>
            </ul>
          </div>
        </div>

        {/* PRO Tier Card */}
        <div className="relative flex flex-col justify-between space-y-6 rounded-2xl border-2 border-amber-500/60 bg-gradient-to-b from-[#0e121e] to-[#080a10] p-6 shadow-2xl">
          <div className="absolute -top-3 right-6 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 px-3 py-0.5 text-[10px] font-extrabold tracking-wider text-slate-950 uppercase shadow-md">
            MOST POPULAR FOR TRADERS
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="flex items-center gap-1.5 text-lg font-extrabold text-amber-300">
                  <Sparkles className="h-4 w-4 text-amber-400" /> PRO Tier
                </h3>
                <p className="text-xs text-slate-300">
                  Complete AI quantitative analyst & 100 alerts
                </p>
              </div>
              <Badge className="border-amber-500/50 bg-amber-500/20 font-mono text-[10px] text-amber-300">
                UNLIMITED
              </Badge>
            </div>

            <div className="flex items-baseline gap-1">
              <span className="font-mono text-3xl font-extrabold text-amber-300">
                {isAnnual ? '$39' : '$49'}
              </span>
              <span className="text-xs text-slate-400">
                / month {isAnnual && '(billed annually)'}
              </span>
            </div>

            <Button
              asChild
              className="h-10 w-full bg-gradient-to-r from-amber-500 to-amber-600 text-xs font-extrabold text-slate-950 shadow-lg shadow-amber-500/25 hover:from-amber-400 hover:to-amber-500"
            >
              <Link href="/checkout">
                Upgrade to PRO Now <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          </div>

          <div className="space-y-3 border-t border-amber-500/30 pt-4">
            <h4 className="text-xs font-bold tracking-wider text-amber-300 uppercase">
              Everything in FREE, plus:
            </h4>
            <ul className="space-y-2 text-xs text-slate-200">
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 shrink-0 text-amber-400" /> 100
                Server-Side Price & Line Alert Rules
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 shrink-0 text-amber-400" /> All 6
                Premium AI Models (Claude Sonnet 5, GPT 5.6, etc.)
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 shrink-0 text-amber-400" /> M5
                Equal-Distance Centroid Overlay on M15 Chart
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 shrink-0 text-amber-400" />{' '}
                Unrestricted Live Market Comments WebSocket Stream
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 shrink-0 text-amber-400" /> 500,000
                Monthly AI Token Quota
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Exhaustive Feature Breakdown Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-[#090c14] shadow-xl">
        <div className="border-b border-slate-800 bg-[#0d101a] p-4">
          <h3 className="text-xs font-bold tracking-wider text-slate-200 uppercase">
            Detailed Tier Feature Comparison Matrix
          </h3>
        </div>
        <div className="divide-y divide-slate-800/60">
          {features.map((item, idx) => (
            <div
              key={idx}
              className="grid grid-cols-3 items-center p-3.5 text-xs"
            >
              <span className="col-span-1 font-medium text-slate-300">
                {item.name}
              </span>
              <span className="text-center font-mono text-slate-400">
                {typeof item.free === 'boolean' ? (
                  item.free ? (
                    <Check className="mx-auto h-4 w-4 text-emerald-400" />
                  ) : (
                    <X className="mx-auto h-4 w-4 text-rose-500" />
                  )
                ) : (
                  item.free
                )}
              </span>
              <span className="text-center font-mono font-bold text-amber-300">
                {typeof item.pro === 'boolean' ? (
                  item.pro ? (
                    <Check className="mx-auto h-4 w-4 text-amber-400" />
                  ) : (
                    <X className="mx-auto h-4 w-4 text-rose-500" />
                  )
                ) : (
                  item.pro
                )}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
