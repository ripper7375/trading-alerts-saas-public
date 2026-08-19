import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  Bell,
  Sparkles,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  Shield,
  Layers,
  ChevronRight,
  Plus,
  Wallet,
  Activity,
  Target,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { PullToRefreshIndicator } from '@/components/mobile/PullToRefresh';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/contexts/NotificationContext';
import { toast } from 'sonner';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, isPro, isAffiliate } = useAuth();
  const { alerts, notifications } = useNotifications();

  const handleRefresh = async () => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    toast.success('Market data and alerts synchronized with MT5');
  };

  const { containerRef, pullDistance, isRefreshing } = usePullToRefresh({
    onRefresh: handleRefresh,
  });

  const MARKETS = [
    {
      symbol: 'XAUUSD',
      name: 'Gold Spot',
      price: '2,642.80',
      change: '+1.42%',
      up: true,
    },
    {
      symbol: 'BTCUSD',
      name: 'Bitcoin',
      price: '96,850.00',
      change: '+3.85%',
      up: true,
    },
    {
      symbol: 'EURUSD',
      name: 'Euro / US Dollar',
      price: '1.0864',
      change: '-0.18%',
      up: false,
    },
    {
      symbol: 'GBPUSD',
      name: 'British Pound',
      price: '1.2952',
      change: '+0.45%',
      up: true,
    },
    {
      symbol: 'US30',
      name: 'Dow Jones Index',
      price: '43,210.00',
      change: '-0.22%',
      up: false,
    },
  ];

  return (
    <div
      ref={containerRef}
      className="relative flex min-h-full flex-col gap-4 p-4"
    >
      <PullToRefreshIndicator
        pullDistance={pullDistance}
        isRefreshing={isRefreshing}
      />

      {/* Greeting Banner */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Trader Overview
          </span>
          <h1 className="text-xl font-black tracking-tight text-foreground">
            {user?.name || 'Trader'}
          </h1>
        </div>
        <Badge
          variant={isPro ? 'pro' : 'outline'}
          className="px-2.5 py-1 text-xs"
        >
          {user?.tier || 'FREE'} TIER
        </Badge>
      </div>

      {/* Portfolio Balance Summary Card */}
      <Card className="border-2 border-amber-500/40 bg-gradient-to-b from-card via-card to-amber-500/10 shadow-lg">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5 font-semibold">
              <Wallet className="h-4 w-4 text-amber-500" />
              Simulated Trading Equity
            </span>
            <Badge variant="outline" className="font-mono text-[9px]">
              MT5 DEMO
            </Badge>
          </div>

          <div className="flex items-baseline justify-between">
            <div className="font-mono text-2xl font-black text-foreground">
              $10,480.50
            </div>
            <div className="flex items-center gap-1 font-mono text-xs font-bold text-emerald-500">
              <ArrowUpRight className="h-4 w-4" />
              <span>+$342.80 (+3.38%)</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 border-t border-border/60 pt-2 text-[11px]">
            <div>
              <span className="block text-[10px] text-muted-foreground">
                Open Positions
              </span>
              <span className="font-mono font-bold text-foreground">
                2 Active
              </span>
            </div>
            <div>
              <span className="block text-[10px] text-muted-foreground">
                Win Rate (30D)
              </span>
              <span className="font-mono font-bold text-emerald-500">
                76.4%
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 4 Bento KPI Stats Cards */}
      <div className="grid grid-cols-2 gap-2.5">
        <Card className="border-border/80 bg-card/60">
          <CardContent className="space-y-1 p-3.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Active Alerts</span>
              <Bell className="h-4 w-4 text-amber-500" />
            </div>
            <div className="font-mono text-xl font-black text-foreground">
              {alerts.filter((a) => a.status === 'ACTIVE').length} /{' '}
              {isPro ? '20' : '5'}
            </div>
            <span className="text-[10px] text-muted-foreground">
              MT5 Live Sync
            </span>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/60">
          <CardContent className="space-y-1 p-3.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Signals Today</span>
              <Activity className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="font-mono text-xl font-black text-foreground">
              18
            </div>
            <span className="text-[10px] text-muted-foreground">
              Fractal Breaches
            </span>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/60">
          <CardContent className="space-y-1 p-3.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>AI Token Quota</span>
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div className="font-mono text-xl font-black text-foreground">
              {isPro ? '42.5k' : '12.5k'}
            </div>
            <span className="text-[10px] text-muted-foreground">
              {isPro ? '500k monthly quota' : '50k monthly quota'}
            </span>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/60">
          <CardContent className="space-y-1 p-3.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>AI Accuracy</span>
              <Target className="h-4 w-4 text-purple-400" />
            </div>
            <div className="font-mono text-xl font-black text-foreground">
              86.2%
            </div>
            <span className="text-[10px] text-muted-foreground">
              Quad-RAG Models
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Live Market Watchlist Card */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Live Market Ticker
          </h2>
          <button
            onClick={() => navigate('/terminal')}
            className="flex items-center text-[11px] font-bold text-amber-500 hover:underline"
          >
            <span>Open Terminal</span>
            <ChevronRight className="h-3 w-3" />
          </button>
        </div>

        <Card className="divide-y divide-border/60 overflow-hidden border-border/80 bg-card">
          {MARKETS.map((m) => (
            <div
              key={m.symbol}
              onClick={() => navigate(`/terminal?symbol=${m.symbol}`)}
              className="flex cursor-pointer items-center justify-between p-3.5 transition-colors hover:bg-muted/30"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted/60 text-xs font-bold">
                  {m.symbol.slice(0, 3)}
                </div>
                <div>
                  <div className="text-xs font-black text-foreground">
                    {m.symbol}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {m.name}
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className="font-mono text-xs font-bold text-foreground">
                  ${m.price}
                </div>
                <div
                  className={`flex items-center justify-end gap-0.5 text-[10px] font-bold ${
                    m.up ? 'text-emerald-500' : 'text-rose-500'
                  }`}
                >
                  {m.up ? (
                    <ArrowUpRight className="h-3 w-3" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3" />
                  )}
                  {m.change}
                </div>
              </div>
            </div>
          ))}
        </Card>
      </div>

      {/* Recent Alerts Section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Active Alerts
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/alerts/new')}
            className="h-6 gap-1 p-0 text-[11px] font-bold text-amber-500 hover:bg-transparent"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Alert</span>
          </Button>
        </div>

        <div className="space-y-2">
          {alerts.slice(0, 3).map((a) => (
            <Card
              key={a.id}
              onClick={() => navigate('/alerts')}
              className="cursor-pointer border-border/80 bg-card/60 transition-all hover:bg-card"
            >
              <CardContent className="flex items-center justify-between p-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/15 text-xs font-bold text-amber-500">
                    {a.symbol.slice(0, 2)}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                      {a.symbol}
                      <Badge
                        variant="outline"
                        className="px-1 py-0 font-mono text-[9px]"
                      >
                        {a.timeframe}
                      </Badge>
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      Target: ${a.targetPrice.toLocaleString()}
                    </div>
                  </div>
                </div>
                <Badge
                  variant={a.status === 'ACTIVE' ? 'success' : 'destructive'}
                  className="text-[9px] font-bold"
                >
                  {a.status}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
