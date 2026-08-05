'use client';

import { useState, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Bell,
  AlertTriangle,
  Info,
  Zap,
  ChevronRight,
  Lock,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  BarChart2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Tier, MarketComment, QualityMetrics } from '@/lib/types';

interface MarketCommentsPanelProps {
  tier: Tier;
  onCollapsePanel?: () => void;
  onOpenUpgradeModal?: (featureName: string) => void;
}

const INITIAL_COMMENTS: MarketComment[] = [
  {
    id: '1',
    iconType: 'EDT_TOUCH',
    timestamp: '14:22:05',
    shortComment: 'XAUUSD M5 Touched Lower EDT Channel ($2,634.50)',
    callAction: 'BUY',
  },
  {
    id: '2',
    iconType: 'ALERT_RESISTANCE',
    timestamp: '14:18:30',
    shortComment: 'XAUUSD M15 Rejection at SSA Resistance ($2,648.10)',
    callAction: 'SELL',
  },
  {
    id: '3',
    iconType: 'SSA_CROSS',
    timestamp: '14:10:15',
    shortComment: 'XAUUSD M15 Higher Low Confirmed at $2,638.00',
    callAction: 'NEUTRAL',
  },
  {
    id: '4',
    iconType: 'ALERT_SUPPORT',
    timestamp: '14:05:40',
    shortComment: 'XAUUSD M5 Z-score Candle Expansion Beyond Upper Band',
    callAction: 'BUY',
  },
  {
    id: '5',
    iconType: 'NEUTRAL_INFO',
    timestamp: '13:58:12',
    shortComment: 'XAUUSD M15 EDT Baseline Symmetry Pivot Retest',
    callAction: 'NEUTRAL',
  },
];

const METRICS_DATA: QualityMetrics = {
  barCoverage: 92,
  regressionR2: 72,
  edtFitness: 27,
  baselineSymmetry: 32,
  symmetryBias: 'LOEDT Bias',
};

export default function MarketCommentsPanel({
  tier,
  onCollapsePanel,
  onOpenUpgradeModal,
}: MarketCommentsPanelProps) {
  const [comments, setComments] = useState<MarketComment[]>(INITIAL_COMMENTS);

  // Simulate Socket.IO live comments stream in PRO mode
  useEffect(() => {
    if (tier !== 'PRO') return;

    const interval = setInterval(() => {
      const actions: ('BUY' | 'SELL' | 'NEUTRAL')[] = [
        'BUY',
        'SELL',
        'NEUTRAL',
      ];
      const action = actions[Math.floor(Math.random() * actions.length)];
      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

      const newComment: MarketComment = {
        id: Date.now().toString(),
        iconType:
          action === 'BUY'
            ? 'EDT_TOUCH'
            : action === 'SELL'
              ? 'ALERT_RESISTANCE'
              : 'SSA_CROSS',
        timestamp: timeStr,
        shortComment:
          action === 'BUY'
            ? `XAUUSD M5 EDT Channel Touch at $${(2634 + Math.random()).toFixed(2)}`
            : action === 'SELL'
              ? `XAUUSD M15 Resistance Test at $${(2647 + Math.random()).toFixed(2)}`
              : `XAUUSD M5 SSA Baseline Cross`,
        callAction: action,
      };

      setComments((prev) => [newComment, ...prev.slice(0, 14)]);
    }, 6000);

    return () => clearInterval(interval);
  }, [tier]);

  const renderIcon = (type: MarketComment['iconType']) => {
    switch (type) {
      case 'ALERT_RESISTANCE':
        return <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-rose-400" />;
      case 'EDT_TOUCH':
        return <Bell className="h-3.5 w-3.5 shrink-0 text-amber-400" />;
      case 'SSA_CROSS':
        return <Zap className="h-3.5 w-3.5 shrink-0 text-blue-400" />;
      default:
        return <Info className="h-3.5 w-3.5 shrink-0 text-emerald-400" />;
    }
  };

  const renderActionBadge = (action: MarketComment['callAction']) => {
    switch (action) {
      case 'BUY':
        return (
          <Badge className="shrink-0 border-emerald-500/50 bg-emerald-500/20 px-1.5 py-0 font-mono text-[9px] text-emerald-300 shadow-xs">
            <TrendingUp className="mr-0.5 inline h-2.5 w-2.5" /> BUY
          </Badge>
        );
      case 'SELL':
        return (
          <Badge className="shrink-0 border-rose-500/50 bg-rose-500/20 px-1.5 py-0 font-mono text-[9px] text-rose-300 shadow-xs">
            <TrendingDown className="mr-0.5 inline h-2.5 w-2.5" /> SELL
          </Badge>
        );
      default:
        return (
          <Badge className="shrink-0 border-slate-500/50 bg-slate-500/20 px-1.5 py-0 font-mono text-[9px] text-slate-300 shadow-xs">
            <Minus className="mr-0.5 inline h-2.5 w-2.5" /> NEUTRAL
          </Badge>
        );
    }
  };

  return (
    <div className="relative flex h-full flex-col overflow-hidden border-l border-emerald-950/60 bg-[#090e0c] shadow-xl select-none">
      {/* Panel Header — Deep Dark Emerald Tone #111815 */}
      <div className="flex h-14 items-center justify-between border-b border-emerald-900/40 bg-[#111815] px-3.5">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400 shadow-xs ring-1 ring-emerald-500/30">
            <Activity className="h-4 w-4" />
          </div>
          <div>
            <h2 className="flex items-center gap-1.5 text-xs font-bold tracking-tight text-slate-100">
              Market Comments :
              {tier === 'PRO' && (
                <span className="flex items-center gap-1 font-mono text-[10px] font-normal text-emerald-400">
                  <span className="h-1.5 w-1.5 animate-ping rounded-full bg-emerald-400" />
                  LIVE
                </span>
              )}
            </h2>
          </div>
        </div>

        {onCollapsePanel && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onCollapsePanel}
            className="h-7 w-7 text-slate-400 hover:bg-emerald-950/60 hover:text-slate-100"
            title="Collapse Right Panel"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Top Section: Real-Time Market Comments Feed */}
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-emerald-900/30 bg-[#0d1411] px-3.5 py-1.5 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
          <span>Alert / Timestamp / Comment</span>
          <span>Action</span>
        </div>

        <ScrollArea className="flex-1 p-2">
          <div className="space-y-1.5">
            {comments.map((comment) => (
              <div
                key={comment.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-emerald-900/30 bg-[#0d1411] p-2 text-xs shadow-xs transition-all hover:border-emerald-700/40 hover:bg-[#101915]"
              >
                <div className="flex min-w-0 items-center gap-2">
                  {renderIcon(comment.iconType)}
                  <div className="flex min-w-0 flex-col">
                    <span className="font-mono text-[10px] text-slate-400">
                      {comment.timestamp}
                    </span>
                    <span className="truncate text-[11px] font-medium text-slate-200">
                      {comment.shortComment}
                    </span>
                  </div>
                </div>

                {renderActionBadge(comment.callAction)}
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Bottom Section: 4 Statistical Quality Metrics Cards (Progress Bar Meters) */}
      <div className="shrink-0 space-y-3 border-t border-emerald-900/50 bg-[#0b100e] p-3.5 shadow-lg">
        <div className="flex items-center justify-between text-xs font-bold text-slate-100">
          <span className="flex items-center gap-1.5">
            <BarChart2 className="h-4 w-4 text-amber-400" />
            Market Quality Metrics
          </span>
          <Badge
            variant="outline"
            className="border-emerald-500/40 bg-emerald-500/10 font-mono text-[9px] text-emerald-400"
          >
            Stack E
          </Badge>
        </div>

        <div className="space-y-2.5 font-mono text-xs">
          {/* 1. Bar Coverage */}
          <div className="space-y-1 rounded border border-emerald-900/30 bg-[#0d1411] p-2">
            <div className="flex justify-between text-[11px]">
              <span className="font-sans text-slate-400">Bar Coverage</span>
              <span className="font-bold text-emerald-400">
                Excellent {METRICS_DATA.barCoverage}%
              </span>
            </div>
            <Progress
              value={METRICS_DATA.barCoverage}
              className="h-1.5 bg-slate-800"
            />
          </div>

          {/* 2. Regression R² */}
          <div className="space-y-1 rounded border border-emerald-900/30 bg-[#0d1411] p-2">
            <div className="flex justify-between text-[11px]">
              <span className="font-sans text-slate-400">Regression R²</span>
              <span className="font-bold text-amber-400">
                Fair {METRICS_DATA.regressionR2}%
              </span>
            </div>
            <Progress
              value={METRICS_DATA.regressionR2}
              className="h-1.5 bg-slate-800"
            />
          </div>

          {/* 3. EDT Fitness */}
          <div className="space-y-1 rounded border border-emerald-900/30 bg-[#0d1411] p-2">
            <div className="flex justify-between text-[11px]">
              <span className="font-sans text-slate-400">EDT Fitness</span>
              <span className="font-bold text-rose-400">
                Underfit {METRICS_DATA.edtFitness}%
              </span>
            </div>
            <Progress
              value={METRICS_DATA.edtFitness}
              className="h-1.5 bg-slate-800"
            />
          </div>

          {/* 4. Baseline Symmetry */}
          <div className="space-y-1 rounded border border-emerald-900/30 bg-[#0d1411] p-2">
            <div className="flex justify-between text-[11px]">
              <span className="font-sans text-slate-400">
                Baseline Symmetry
              </span>
              <span className="font-bold text-cyan-400">
                {METRICS_DATA.symmetryBias} {METRICS_DATA.baselineSymmetry}%
              </span>
            </div>
            <Progress
              value={METRICS_DATA.baselineSymmetry}
              className="h-1.5 bg-slate-800"
            />
          </div>
        </div>
      </div>

      {/* FREE Tier Glassmorphism Blur Overlay Gate */}
      {tier === 'FREE' && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#070b09]/85 p-6 text-center backdrop-blur-md">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-400 shadow-lg ring-1 shadow-amber-500/10 ring-amber-500/40">
            <Lock className="h-6 w-6" />
          </div>
          <Badge
            variant="outline"
            className="mb-2 border-amber-500/50 bg-amber-500/10 font-mono text-[10px] text-amber-400"
          >
            🔒 PRO Subscriber Feature
          </Badge>
          <h3 className="mb-1 text-base font-bold text-slate-100">
            Live Feeds & Quality Metrics
          </h3>
          <p className="mb-4 max-w-xs text-xs leading-relaxed text-slate-400">
            Live Market Comments and 4 Statistical Quality Metrics require a PRO
            subscription. Upgrade to unlock real-time WebSocket feeds for
            XAUUSD.
          </p>
          <Button
            size="sm"
            onClick={() =>
              onOpenUpgradeModal &&
              onOpenUpgradeModal('Stack E: Live Comments & Quality Metrics')
            }
            className="bg-gradient-to-r from-amber-500 to-amber-600 font-bold text-slate-950 shadow-md shadow-amber-500/20 hover:from-amber-400 hover:to-amber-500"
          >
            <Sparkles className="mr-1.5 h-3.5 w-3.5 fill-black" />
            Upgrade to PRO
          </Button>
        </div>
      )}
    </div>
  );
}
