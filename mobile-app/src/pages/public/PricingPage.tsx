import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Check,
  Zap,
  Sparkles,
  ShieldCheck,
  Brain,
  Bell,
  Clock,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';

export default function PricingPage() {
  const navigate = useNavigate();
  const { isPro } = useAuth();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>(
    'monthly'
  );

  const FREE_FEATURES = [
    '5 Allowed Symbols (EURUSD, GBPUSD, USDJPY, XAUUSD, BTCUSD)',
    '3 Timeframes (H1, H4, D1)',
    '5 Active Simultaneous Price Breach Alerts',
    'Standard 60-second delayed MT5 feed',
    'Read-Only AI Analyst Session History',
    'Standard Community Support',
  ];

  const PRO_FEATURES = [
    '15+ Asset Symbols (Forex, Metals, Crypto, Indices)',
    '9 Timeframes (M1, M5, M15, M30, H1, H2, H4, D1, W1)',
    '20 Active Simultaneous High-Priority Alerts',
    'Sub-500ms Real-Time Institutional MT5 Streaming',
    'Conversational AI Analyst (Gemini, Claude, GPT, DeepSeek)',
    '500,000 Monthly AI Token Quota',
    'Automated Peak-to-Peak MT5 Fractal Lines',
    'High-Priority Crystal Sound Chimes & Instant Push',
    'VIP 24/7 Priority Support Desk',
  ];

  const priceMonthly = '$29';
  const priceAnnual = '$23.20';

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-5 p-4">
      {/* Title & Billing Toggle */}
      <div className="space-y-2 pt-2 text-center">
        <Badge variant="pro" className="px-3 py-0.5 text-[11px]">
          Transparent Pricing
        </Badge>
        <h1 className="text-2xl font-black tracking-tight text-foreground">
          Upgrade to Institutional <br />
          <span className="bg-gradient-to-r from-amber-400 to-amber-600 bg-clip-text text-transparent">
            MT5 Fractal Intelligence
          </span>
        </h1>
        <p className="mx-auto max-w-xs text-xs text-muted-foreground">
          Choose the plan that fits your trading style. Cancel anytime.
        </p>

        {/* Billing Cycle Pill */}
        <div className="flex justify-center pt-2">
          <div className="flex items-center gap-1 rounded-2xl border border-border/80 bg-muted p-1">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`rounded-xl px-4 py-1.5 text-xs font-bold transition-all ${
                billingCycle === 'monthly'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground'
              }`}
            >
              Monthly Billing
            </button>
            <button
              onClick={() => setBillingCycle('annual')}
              className={`flex items-center gap-1.5 rounded-xl px-4 py-1.5 text-xs font-bold transition-all ${
                billingCycle === 'annual'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-muted-foreground'
              }`}
            >
              <span>Annual</span>
              <span className="py-0.2 rounded-full bg-slate-950/20 px-1.5 text-[9px] font-black dark:bg-slate-950/40">
                SAVE 20%
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="space-y-4">
        {/* PRO Tier Card (Highlighted) */}
        <Card className="relative overflow-hidden border-2 border-amber-500/80 bg-gradient-to-b from-card via-card to-amber-500/10 shadow-2xl">
          <div className="absolute right-0 top-0 rounded-bl-xl bg-gradient-to-l from-amber-500 to-amber-600 px-3 py-1 text-[10px] font-black uppercase text-slate-950 shadow-md">
            Most Popular
          </div>

          <CardContent className="space-y-4 p-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-black text-foreground">
                  PRO Analyst
                </span>
                <Badge variant="pro" className="px-1.5 py-0 text-[9px]">
                  FULL ACCESS
                </Badge>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                For serious traders requiring real-time execution & AI.
              </p>
            </div>

            <div className="flex items-baseline gap-1 border-t border-border/60 pt-1">
              <span className="font-mono text-3xl font-black text-foreground">
                {billingCycle === 'annual' ? priceAnnual : priceMonthly}
              </span>
              <span className="text-xs font-semibold text-muted-foreground">
                / month{' '}
                {billingCycle === 'annual'
                  ? '(billed annually $278.40/yr)'
                  : ''}
              </span>
            </div>

            <Button
              onClick={() => navigate('/checkout')}
              className="h-12 w-full gap-2 bg-gradient-to-r from-amber-500 to-amber-600 text-xs font-extrabold text-slate-950 shadow-lg shadow-amber-500/25 hover:from-amber-400 hover:to-amber-500"
            >
              <Zap className="h-4 w-4 fill-slate-950" />
              <span>
                {isPro ? 'Manage Active PRO Plan' : 'Get Started with PRO'}
              </span>
              <ArrowRight className="ml-auto h-4 w-4" />
            </Button>

            <div className="space-y-2 border-t border-border/60 pt-2 text-xs">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-foreground">
                Everything in PRO:
              </span>
              {PRO_FEATURES.map((f) => (
                <div
                  key={f}
                  className="flex items-start gap-2 text-foreground/90"
                >
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  <span className="text-xs leading-snug">{f}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* FREE Starter Plan Card */}
        <Card className="border-border/80 bg-card">
          <CardContent className="space-y-4 p-5">
            <div>
              <span className="text-base font-black text-foreground">
                FREE Starter
              </span>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Basic charting & delayed MT5 alerts.
              </p>
            </div>

            <div className="flex items-baseline gap-1 border-t border-border/60 pt-1">
              <span className="font-mono text-3xl font-black text-foreground">
                $0
              </span>
              <span className="text-xs font-semibold text-muted-foreground">
                / forever free
              </span>
            </div>

            <Button
              variant="outline"
              onClick={() => navigate('/free')}
              className="h-11 w-full text-xs font-bold"
            >
              <span>Continue Free</span>
            </Button>

            <div className="space-y-2 border-t border-border/60 pt-2 text-xs">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-foreground">
                Free Plan Features:
              </span>
              {FREE_FEATURES.map((f) => (
                <div
                  key={f}
                  className="flex items-start gap-2 text-muted-foreground"
                >
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="text-xs leading-snug">{f}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-center gap-2 pb-2 text-xs text-muted-foreground">
        <ShieldCheck className="h-4 w-4 text-emerald-500" />
        <span>30-Day Money-Back Guarantee • Instant Setup</span>
      </div>
    </div>
  );
}
