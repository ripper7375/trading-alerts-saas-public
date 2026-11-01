import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DollarSign,
  Users,
  MousePointerClick,
  Percent,
  Share2,
  Copy,
  Tag,
  CreditCard,
  History,
  FileSpreadsheet,
  Settings,
  ChevronRight,
  Sparkles,
  Calendar,
  ArrowUpRight,
  QrCode,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export default function AffiliateDashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const refCode = user?.affiliateCode || 'DAVIN_VIP';
  const referralUrl = `https://app.davintrade.com/?ref=${refCode}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(referralUrl);
    toast.success('Referral link copied to clipboard!');
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: 'DavinTrade AI Trading Alerts',
        text: 'Join DavinTrade with my referral link for sub-500ms MT5 fractal alerts & AI analysis!',
        url: referralUrl,
      });
    } else {
      handleCopyLink();
    }
  };

  const STATS = [
    {
      title: 'Total Earned',
      value: '$1,482.50',
      icon: DollarSign,
      color: 'text-emerald-500',
      desc: 'Lifetime 20% rev-share',
    },
    {
      title: 'Unpaid Balance',
      value: '$248.60',
      icon: CreditCard,
      color: 'text-amber-500',
      desc: 'Disburses on Sept 1',
    },
    {
      title: 'Active Clicks',
      value: '1,842',
      icon: MousePointerClick,
      color: 'text-blue-400',
      desc: '+14% this week',
    },
    {
      title: 'Conversion Rate',
      value: '6.4%',
      icon: Percent,
      color: 'text-purple-400',
      desc: '48 paid subscribers',
    },
  ];

  const MENU_ITEMS = [
    {
      icon: Tag,
      label: 'Referral Codes & Tags',
      desc: 'Create custom campaign tags',
      path: '/affiliate/dashboard/codes',
    },
    {
      icon: History,
      label: 'Commissions Ledger',
      desc: '20% recurring monthly log',
      path: '/affiliate/dashboard/commissions',
    },
    {
      icon: CreditCard,
      label: 'Payout Tracker & Status',
      desc: 'Monthly bank & USDT timeline',
      path: '/affiliate/dashboard/payouts',
    },
    {
      icon: Sparkles,
      label: 'Marketing Kit & Copy',
      desc: 'Social copy & QR code assets',
      path: '/affiliate/resources',
    },
    {
      icon: FileSpreadsheet,
      label: 'Monthly Statements',
      desc: 'Download CSV / PDF reports',
      path: '/affiliate/dashboard/statements',
    },
    {
      icon: Settings,
      label: 'Payout Settings',
      desc: 'USDT TRC20 & Bank Wire details',
      path: '/affiliate/dashboard/profile/payment',
    },
  ];

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Partner Portal
          </span>
          <h1 className="text-xl font-black tracking-tight text-foreground">
            Affiliate Dashboard
          </h1>
        </div>
        <Badge variant="pro" className="px-2.5 py-1 text-xs">
          20% REV-SHARE
        </Badge>
      </div>

      {/* 1-Tap Referral Share Card */}
      <Card className="border-2 border-amber-500/60 bg-gradient-to-b from-card via-card to-amber-500/10 shadow-lg">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-bold text-foreground">
              <Share2 className="h-4 w-4 text-amber-500" />
              Your Partner Referral Link
            </span>
            <Badge variant="outline" className="font-mono text-[10px]">
              Code: {refCode}
            </Badge>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-border/80 bg-background/80 p-2.5 font-mono text-xs text-muted-foreground">
            <span className="flex-1 select-all truncate">{referralUrl}</span>
            <button
              onClick={handleCopyLink}
              className="rounded-lg p-1 text-foreground hover:bg-muted"
              title="Copy"
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleCopyLink}
              className="h-10 flex-1 gap-1.5 bg-amber-500 text-xs font-bold text-slate-950 shadow-md shadow-amber-500/20 hover:bg-amber-400"
            >
              <Copy className="h-3.5 w-3.5" />
              <span>Copy Link</span>
            </Button>
            <Button
              variant="outline"
              onClick={handleShare}
              className="h-10 flex-1 gap-1.5 text-xs font-bold"
            >
              <Share2 className="h-3.5 w-3.5" />
              <span>Share Sheet</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 4 Bento KPI Cards */}
      <div className="grid grid-cols-2 gap-2.5">
        {STATS.map((s) => (
          <Card key={s.title} className="border-border/80 bg-card/60">
            <CardContent className="space-y-1 p-3.5">
              <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
                <span>{s.title}</span>
                <s.icon className={`h-4 w-4 ${s.color}`} />
              </div>
              <div className="font-mono text-xl font-black text-foreground">
                {s.value}
              </div>
              <span className="block truncate text-[10px] text-muted-foreground">
                {s.desc}
              </span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Next Disbursement Countdown Card */}
      <Card className="border-border/80 bg-card">
        <CardContent className="flex items-center justify-between p-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-500">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-foreground">
                Next Scheduled Disbursement
              </div>
              <div className="text-[10px] text-muted-foreground">
                September 1, 2026 • Automatic via USDT
              </div>
            </div>
          </div>
          <span className="font-mono text-xs font-bold text-amber-500">
            $248.60
          </span>
        </CardContent>
      </Card>

      {/* Affiliate Drill-Down Navigation */}
      <div className="space-y-2">
        <h2 className="px-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          Partner Management
        </h2>
        <Card className="divide-y divide-border/60 overflow-hidden border-border/80 bg-card">
          {MENU_ITEMS.map((item) => (
            <div
              key={item.path}
              onClick={() => navigate(item.path)}
              className="flex cursor-pointer items-center justify-between p-3.5 transition-colors hover:bg-muted/30"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-muted/60 text-muted-foreground">
                  <item.icon className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-foreground">
                    {item.label}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {item.desc}
                  </div>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground/60" />
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
