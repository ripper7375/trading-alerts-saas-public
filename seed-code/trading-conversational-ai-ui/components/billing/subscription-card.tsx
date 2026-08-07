'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  CreditCard,
  Sparkles,
  Shield,
  Download,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function SubscriptionCard() {
  const invoices = [
    {
      id: 'INV-2026-008',
      date: 'Aug 01, 2026',
      amount: '$49.00',
      status: 'Paid',
      method: 'Visa ending in 8892',
    },
    {
      id: 'INV-2026-007',
      date: 'Jul 01, 2026',
      amount: '$49.00',
      status: 'Paid',
      method: 'Visa ending in 8892',
    },
    {
      id: 'INV-2026-006',
      date: 'Jun 01, 2026',
      amount: '$49.00',
      status: 'Paid',
      method: 'Visa ending in 8892',
    },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6 select-none">
      {/* Active Subscription Box */}
      <div className="space-y-4 rounded-2xl border border-amber-500/40 bg-gradient-to-r from-[#0c0f18] via-[#121624] to-[#0d0f17] p-6 shadow-xl">
        <div className="flex flex-col items-start justify-between gap-4 border-b border-amber-500/30 pb-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <Badge className="border-amber-500/50 bg-amber-500/20 font-mono text-[10px] text-amber-300">
                ⚡ PRO PLAN ACTIVE
              </Badge>
              <span className="font-mono text-[11px] text-slate-400">
                Renews Sep 01, 2026
              </span>
            </div>
            <h2 className="mt-1 text-lg font-extrabold text-slate-100">
              DavinTrade PRO Tier Subscription
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/pricing">
              <Button
                variant="outline"
                className="h-8 border-amber-500/40 bg-amber-500/10 text-xs text-amber-300 hover:bg-amber-500/20"
              >
                Change Plan
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 text-xs sm:grid-cols-3">
          <div className="rounded-xl border border-slate-800 bg-[#06080e] p-3">
            <span className="text-[10px] text-slate-400">
              Current Billing Rate
            </span>
            <div className="font-mono text-base font-extrabold text-amber-300">
              $49.00 / mo
            </div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-[#06080e] p-3">
            <span className="text-[10px] text-slate-400">
              Alert Rule Allocation
            </span>
            <div className="font-mono text-base font-extrabold text-slate-100">
              100 Max Rules
            </div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-[#06080e] p-3">
            <span className="text-[10px] text-slate-400">
              Monthly AI Token Quota
            </span>
            <div className="font-mono text-base font-extrabold text-slate-100">
              500,000 Tokens
            </div>
          </div>
        </div>
      </div>

      {/* Invoice History Table */}
      <div className="space-y-3 overflow-hidden rounded-2xl border border-slate-800 bg-[#090c14] p-4 shadow-xl">
        <h3 className="flex items-center justify-between text-xs font-bold tracking-wider text-slate-200 uppercase">
          <span>Billing & Payment History</span>
          <span className="font-mono text-[10px] text-slate-400">
            3 Invoices
          </span>
        </h3>

        <div className="divide-y divide-slate-800/60">
          {invoices.map((inv) => (
            <div
              key={inv.id}
              className="flex items-center justify-between py-3 text-xs"
            >
              <div className="space-y-0.5">
                <div className="font-mono font-bold text-slate-200">
                  {inv.id}
                </div>
                <div className="text-[10px] text-slate-400">
                  {inv.date} • {inv.method}
                </div>
              </div>

              <div className="flex items-center gap-4 text-right">
                <span className="font-mono font-bold text-slate-100">
                  {inv.amount}
                </span>
                <Badge className="border-emerald-500/40 bg-emerald-500/15 font-mono text-[9px] text-emerald-400">
                  {inv.status}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-slate-400 hover:text-slate-100"
                >
                  <Download className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
