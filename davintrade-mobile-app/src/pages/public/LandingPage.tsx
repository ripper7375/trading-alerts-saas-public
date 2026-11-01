import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  Download,
  Bell,
  Sparkles,
  ShieldCheck,
  Zap,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';

export default function LandingPage() {
  const navigate = useNavigate();
  const { user, isPro } = useAuth();

  const TICKERS = [
    { symbol: 'XAUUSD', price: '2,642.80', change: '+1.42%', up: true },
    { symbol: 'EURUSD', price: '1.0864', change: '-0.18%', up: false },
    { symbol: 'BTCUSD', price: '96,850.00', change: '+3.85%', up: true },
    { symbol: 'GBPUSD', price: '1.2952', change: '+0.45%', up: true },
    { symbol: 'US30', price: '43,210.0', change: '-0.22%', up: false },
  ];

  return (
    <div className="flex flex-col gap-6 p-4">
      {/* Ticker Tape */}
      <div className="no-scrollbar flex items-center gap-2 overflow-x-auto py-1">
        {TICKERS.map((t) => (
          <div
            key={t.symbol}
            className="backdrop-blur-xs flex shrink-0 items-center gap-2 rounded-xl border border-border/80 bg-card/60 px-3 py-1.5 font-mono text-xs"
          >
            <span className="font-bold text-foreground">{t.symbol}</span>
            <span className="text-muted-foreground">{t.price}</span>
            <span
              className={`font-semibold ${
                t.up ? 'text-emerald-500' : 'text-rose-500'
              }`}
            >
              {t.change}
            </span>
          </div>
        ))}
      </div>

      {/* Hero Section */}
      <div className="flex flex-col items-center gap-4 pt-4 text-center">
        <Badge variant="pro" className="gap-1.5 px-3 py-1 text-xs font-bold">
          <Sparkles className="h-3.5 w-3.5 fill-current" />
          <span>AI-Powered MT5 Trading Alerts SaaS</span>
        </Badge>

        <h1 className="text-3xl font-extrabold leading-[1.15] tracking-tight text-foreground">
          Real-Time Fractals & <br />
          <span className="bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 bg-clip-text text-transparent">
            AI Market Analysis
          </span>
        </h1>

        <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
          Never miss a price breakout. Connect directly to live MetaTrader 5
          terminals, receive high-priority push chimes, and consult your
          conversational AI analyst on mobile.
        </p>

        {/* Primary CTAs */}
        <div className="flex w-full max-w-xs flex-col gap-3 pt-2 sm:flex-row">
          <Button
            onClick={() =>
              navigate(user ? (isPro ? '/terminal' : '/free') : '/login')
            }
            className="h-12 w-full gap-2 bg-amber-500 font-bold text-slate-950 shadow-lg shadow-amber-500/25 hover:bg-amber-400"
          >
            <TrendingUp className="h-4 w-4" />
            <span>{user ? 'Open Trading Terminal' : 'Get Started Free'}</span>
            <ArrowRight className="ml-auto h-4 w-4" />
          </Button>

          <Button
            variant="outline"
            onClick={() => {
              window.open('#download-apk', '_self');
              alert(
                'Direct APK download initiating for Android. 0% Google Play fee!'
              );
            }}
            className="h-12 w-full gap-2 border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400"
          >
            <Download className="h-4 w-4 text-emerald-500" />
            <span>Download Android .apk</span>
          </Button>
        </div>
      </div>

      {/* Feature Cards Bento */}
      <div className="grid grid-cols-1 gap-3 pt-2">
        <Card className="border-amber-500/20 bg-card/60 backdrop-blur-md">
          <CardContent className="flex items-start gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-500">
              <Bell className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-foreground">
                High-Priority Push Chimes
              </h3>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Custom sound alerts trigger instantaneously via Firebase Cloud
                Messaging when MT5 fractal support or resistance lines break.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/60 backdrop-blur-md">
          <CardContent className="flex items-start gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/15 text-blue-500">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-foreground">
                Sliding AI Chat Drawer
              </h3>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Consult Gemini, Claude & GPT trading models directly over your
                candlestick chart with sub-500ms Quad-RAG response times.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/60 backdrop-blur-md">
          <CardContent className="flex items-start gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-500/15 text-purple-500">
              <Zap className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-foreground">
                20% Lifetime Partner Affiliate
              </h3>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Earn recurring lifetime commissions paid monthly via Bank, Wire,
                or USDT TRC20 with real-time tracking.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Trust & Guarantee */}
      <div className="flex items-center justify-between rounded-2xl border border-border/80 bg-muted/30 p-4 text-xs">
        <div className="flex items-center gap-2 text-muted-foreground">
          <ShieldCheck className="h-5 w-5 text-emerald-500" />
          <span>MetaTrader 5 Native VPS Sync</span>
        </div>
        <Badge variant="outline" className="font-mono text-[10px]">
          99.9% Uptime
        </Badge>
      </div>
    </div>
  );
}
