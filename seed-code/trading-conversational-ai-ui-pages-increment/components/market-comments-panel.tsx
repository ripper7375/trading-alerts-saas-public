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
  HelpCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  Tier,
  MarketComment,
  QualityMetrics,
  TradeSetup,
} from '@/lib/types';
import { useLocale } from '@/lib/context/locale-context';

interface MarketCommentsPanelProps {
  tier: Tier;
  onCollapsePanel?: () => void;
  onOpenUpgradeModal?: (featureName: string) => void;
}

const INITIAL_COMMENTS: MarketComment[] = [
  {
    id: '1',
    iconType: 'SSA_CROSS',
    timestamp: '22:48:26',
    shortComment: 'XAUUSD M5 SSA Baseline Cross',
    callAction: 'NEUTRAL',
  },
  {
    id: '2',
    iconType: 'SSA_CROSS',
    timestamp: '22:47:02',
    shortComment: 'XAUUSD M5 SSA Baseline Cross',
    callAction: 'NEUTRAL',
  },
  {
    id: '3',
    iconType: 'ALERT_RESISTANCE',
    timestamp: '22:45:30',
    shortComment: 'XAUUSD M15 Resistance Test at $2647.78',
    callAction: 'SELL',
  },
  {
    id: '4',
    iconType: 'EDT_TOUCH',
    timestamp: '22:41:05',
    shortComment: 'XAUUSD M5 Touched Lower EDT Channel ($2,634.50)',
    callAction: 'BUY',
  },
];

const METRICS_DATA: QualityMetrics = {
  barCoverage: 92,
  regressionR2: 72,
  edtFitness: 27,
  baselineSymmetry: 32,
  symmetryBias: 'LOEDT Bias',
};

const DEFAULT_TRADE_SETUP: TradeSetup = {
  symbol: 'XAUUSD',
  timeframe: 'M5',
  direction: 'BUY',
  entryPrice: 2634.5,
  takeProfit: 2648.0,
  stopLoss: 2627.0,
  riskReward: '1 : 3.2',
  confidence: 88,
  rationale:
    'Double bottom wick rejection at lower M5 EDT boundary aligned with M15 SSA bullish trend bias.',
};

export default function MarketCommentsPanel({
  tier,
  onCollapsePanel,
  onOpenUpgradeModal,
}: MarketCommentsPanelProps) {
  const { t, formatTimestamp } = useLocale();
  const [comments, setComments] = useState<MarketComment[]>(INITIAL_COMMENTS);
  const [tradeSetup, setTradeSetup] = useState<TradeSetup>(DEFAULT_TRADE_SETUP);

  // Live ticking countdown timer for London session news event (D4)
  const [countdownSeconds, setCountdownSeconds] = useState(
    5 * 3600 + 19 * 60 + 36
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdownSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatCountdown = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600)
      .toString()
      .padStart(2, '0');
    const mins = Math.floor((totalSec % 3600) / 60)
      .toString()
      .padStart(2, '0');
    const secs = (totalSec % 60).toString().padStart(2, '0');
    return `${hrs}:${mins}:${secs}`;
  };

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

      setComments((prev) => [newComment, ...prev.slice(0, 5)]);
    }, 8000);

    return () => clearInterval(interval);
  }, [tier]);

  const renderIcon = (type: MarketComment['iconType']) => {
    switch (type) {
      case 'ALERT_RESISTANCE':
        return (
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-rose-600 dark:text-rose-400" />
        );
      case 'EDT_TOUCH':
        return (
          <Bell className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
        );
      case 'SSA_CROSS':
        return (
          <Zap className="h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-blue-400" />
        );
      default:
        return (
          <Info className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
        );
    }
  };

  const renderActionBadge = (action: MarketComment['callAction']) => {
    switch (action) {
      case 'BUY':
        return (
          <Badge className="shrink-0 border-emerald-500/50 bg-emerald-500/20 px-1.5 py-0 font-mono text-[9px] text-emerald-700 shadow-xs dark:text-emerald-300">
            <TrendingUp className="mr-0.5 inline h-2.5 w-2.5" /> {t('BUY')}
          </Badge>
        );
      case 'SELL':
        return (
          <Badge className="shrink-0 border-rose-500/50 bg-rose-500/20 px-1.5 py-0 font-mono text-[9px] text-rose-700 shadow-xs dark:text-rose-300">
            <TrendingDown className="mr-0.5 inline h-2.5 w-2.5" /> {t('SELL')}
          </Badge>
        );
      default:
        return (
          <Badge className="shrink-0 border-slate-500/50 bg-slate-500/20 px-1.5 py-0 font-mono text-[9px] text-slate-700 shadow-xs dark:text-slate-300">
            <Minus className="mr-0.5 inline h-2.5 w-2.5" /> {t('NEUTRAL')}
          </Badge>
        );
    }
  };

  // Helper component for Apache ECharts style circular gauge progress dials (D5)
  const RenderGaugeDial = ({
    label,
    value,
    color,
  }: {
    label: string;
    value: number;
    color: string;
  }) => {
    const radius = 34;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (value / 100) * circumference;

    return (
      <div className="flex flex-col items-center justify-center text-center">
        <div className="relative flex h-20 w-20 items-center justify-center">
          <svg className="h-20 w-20 -rotate-90" viewBox="0 0 80 80">
            {/* Background Arc Track */}
            <circle
              cx="40"
              cy="40"
              r={radius}
              stroke="#1e293b"
              strokeWidth="6"
              fill="transparent"
            />
            {/* Progress Arc */}
            <circle
              cx="40"
              cy="40"
              r={radius}
              stroke={color}
              strokeWidth="6"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="transparent"
              className="transition-all duration-1000 ease-out"
            />
          </svg>
          <div className="absolute flex flex-col items-center justify-center text-center">
            <span className="font-mono text-base font-black text-slate-900 dark:text-slate-100">
              {value}
            </span>
            <span className="font-mono text-[8px] text-slate-500 uppercase dark:text-slate-400">
              {t('pts')}
            </span>
          </div>
        </div>
        <span className="mt-1.5 text-[10px] font-extrabold text-slate-700 dark:text-slate-300">
          {label}
        </span>
      </div>
    );
  };

  return (
    <div className="relative flex h-full flex-col space-y-3.5 overflow-y-auto border-l border-emerald-100 bg-slate-50 p-0.5 shadow-2xl select-none dark:border-emerald-950/70 dark:bg-[#080d0a]">
      {/* D2: Panel Header — Market Comments : LIVE (Larger Font Size) */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-emerald-100 bg-white px-4 dark:border-emerald-900/40 dark:bg-[#101713]">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 shadow-xs ring-1 ring-emerald-500/30 dark:text-emerald-400">
            <Activity className="h-4 w-4" />
          </div>
          <div>
            <h2 className="flex items-center gap-2 text-base font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
              {t('comments.title', 'Market Comments')} :
              {tier === 'PRO' && (
                <span className="flex items-center gap-1.5 font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  <span className="h-2 w-2 animate-ping rounded-full bg-emerald-400" />
                  {t('LIVE')}
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
            className="h-7 w-7 text-slate-500 hover:bg-emerald-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-emerald-950/60 dark:hover:text-slate-100"
            title={t('Collapse Right Panel')}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* D3: Expanded Market Comments Feed (Space expanded to allow 3 full rows of comments comfortably) */}
      <div className="flex shrink-0 flex-col px-3">
        <div className="flex items-center justify-between rounded-t-lg border border-emerald-100 bg-slate-50 px-3.5 py-2 text-[10px] font-extrabold tracking-wider text-slate-500 uppercase dark:border-emerald-900/40 dark:bg-[#0c1310] dark:text-slate-400">
          <span>
            {t('comments.col_comment', 'ALERT / TIMESTAMP / COMMENT')}
          </span>
          <span>{t('comments.col_action', 'ACTION')}</span>
        </div>

        <ScrollArea className="h-44 rounded-b-lg border-x border-b border-emerald-100 bg-white p-2 dark:border-emerald-900/40 dark:bg-[#0a0f0c]">
          <div className="space-y-2">
            {comments.map((comment) => (
              <div
                key={comment.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-emerald-100 bg-slate-50 p-2.5 text-xs shadow-xs transition-all hover:border-emerald-300 hover:bg-slate-100 dark:border-emerald-900/30 dark:bg-[#0d1411] dark:hover:border-emerald-700/40 dark:hover:bg-[#101915]"
              >
                <div className="flex min-w-0 items-center gap-2">
                  {renderIcon(comment.iconType)}
                  <div className="flex min-w-0 flex-col">
                    <span className="font-mono text-[9px] text-slate-500 dark:text-slate-400">
                      {comment.timestamp}
                    </span>
                    <span className="truncate text-[11px] font-semibold text-slate-800 dark:text-slate-200">
                      {t(comment.shortComment)}
                    </span>
                  </div>
                </div>

                {renderActionBadge(comment.callAction)}
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* D4: Session & Countdown Banner (Sydney 🇦🇺, Tokyo 🇯🇵, London 🇬🇧, New York 🇺🇸 flags) */}
      <div className="shrink-0 px-3">
        <div className="relative overflow-hidden rounded-xl border border-amber-500/60 bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 p-3.5 text-slate-950 shadow-xl shadow-amber-500/15">
          <div className="mb-1.5 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-sm font-black">
              <span className="text-base">🇬🇧</span>
              <span>{t('GB London Session')}</span>
            </div>
            <div className="flex items-center gap-1 text-[11px] font-bold opacity-90">
              <span title={t('Sydney')}>🇦🇺</span>
              <span title={t('Tokyo')}>🇯🇵</span>
              <span title={t('London')}>🇬🇧</span>
              <span title={t('New York')}>🇺🇸</span>
              <HelpCircle className="ml-1 inline h-3.5 w-3.5 cursor-pointer text-slate-900" />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold tracking-tight uppercase opacity-90">
              {t(
                'comments.news_countdown',
                'UPCOMING HIGH IMPACT NEWS/EVENT COUNTDOWN'
              )}
            </span>
            <span className="rounded-md bg-amber-400/90 px-2.5 py-0.5 font-mono text-base font-black tracking-widest text-slate-950 shadow-xs">
              {formatCountdown(countdownSeconds)}
            </span>
          </div>
        </div>
      </div>

      {/* D5: 3 Circular Speedometer / Gauge-Progress Dials */}
      <div className="mx-3 shrink-0 rounded-xl border border-emerald-100 bg-white py-3 shadow-md dark:border-emerald-900/40 dark:bg-[#0a0f0c]">
        <div className="grid grid-cols-3 gap-2">
          <RenderGaugeDial
            label={t('M15 EDT Stochastic')}
            value={85}
            color="#38bdf8"
          />
          <RenderGaugeDial
            label={t('M15 SSA Deviation')}
            value={72}
            color="#38bdf8"
          />
          <RenderGaugeDial
            label={t('M15 Market Momentum')}
            value={61}
            color="#38bdf8"
          />
        </div>
      </div>

      {/* D6: Transferred TRADE SETUP CARD with Thicker Outline & Direction Themes */}
      <div className="shrink-0 px-3">
        <div
          className={cn(
            'relative space-y-3 rounded-xl border-2 p-3.5 shadow-2xl transition-all',
            tradeSetup.direction === 'BUY'
              ? 'border-emerald-400 bg-gradient-to-br from-emerald-50 via-emerald-50 to-white text-slate-900 shadow-emerald-950/50 dark:from-[#062014] dark:via-[#092b1b] dark:to-[#04170e] dark:text-slate-100'
              : 'border-rose-500 bg-gradient-to-br from-rose-50 via-rose-50 to-white text-slate-900 shadow-rose-950/50 dark:from-[#2a0910] dark:via-[#380c15] dark:to-[#1c0409] dark:text-slate-100'
          )}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <TrendingUp
                className={cn(
                  'h-4 w-4 stroke-[2.5]',
                  tradeSetup.direction === 'BUY'
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                )}
              />
              <span
                className={cn(
                  'text-xs font-black tracking-wider uppercase',
                  tradeSetup.direction === 'BUY'
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                )}
              >
                {t('comments.trade_setup_card', 'TRADE SETUP CARD')}
              </span>
            </div>
            <Badge
              className={cn(
                'border-2 px-2.5 py-0.5 font-mono text-xs font-black',
                tradeSetup.direction === 'BUY'
                  ? 'border-emerald-400 bg-emerald-500/30 text-emerald-800 dark:text-emerald-200'
                  : 'border-rose-500 bg-rose-500/30 text-rose-800 dark:text-rose-200'
              )}
            >
              {tradeSetup.direction === 'BUY'
                ? t('BUY LIMIT')
                : t('SELL LIMIT')}{' '}
              @ ${tradeSetup.entryPrice.toFixed(2)}
            </Badge>
          </div>

          <div className="grid grid-cols-3 gap-2 rounded-lg border border-slate-200 bg-slate-100 p-2.5 font-mono text-[11px] dark:border-slate-800 dark:bg-black/60">
            <div>
              <div className="text-[9px] font-bold text-slate-500 uppercase dark:text-slate-400">
                {t('Take Profit')}
              </div>
              <div className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400">
                ${tradeSetup.takeProfit.toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-[9px] font-bold text-slate-500 uppercase dark:text-slate-400">
                {t('Stop Loss')}
              </div>
              <div className="text-xs font-extrabold text-rose-600 dark:text-rose-400">
                ${tradeSetup.stopLoss.toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-[9px] font-bold text-slate-500 uppercase dark:text-slate-400">
                {t('Risk / Reward')}
              </div>
              <div className="text-xs font-extrabold text-amber-600 dark:text-amber-400">
                {tradeSetup.riskReward}
              </div>
            </div>
          </div>

          <p className="text-[11px] leading-relaxed font-medium text-slate-800 dark:text-slate-200">
            {t(tradeSetup.rationale)}
          </p>
        </div>
      </div>

      {/* D7: EDT Quality Metrics (Removed Stack E badge as requested!) */}
      <div className="mt-2 shrink-0 space-y-3 border-t border-emerald-100 bg-white p-4 dark:border-emerald-900/50 dark:bg-[#0a0f0c]">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-base font-black text-slate-900 dark:text-slate-100">
            <BarChart2 className="h-4.5 w-4.5 text-amber-600 dark:text-amber-400" />
            {t('comments.edt_quality_metrics', 'EDT Quality Metrics')}
          </span>
        </div>

        <div className="space-y-2 font-mono text-xs">
          {/* 1. Bar Coverage */}
          <div className="space-y-1 rounded-lg border border-emerald-100 bg-slate-50 p-2 dark:border-emerald-900/30 dark:bg-[#0d1411]">
            <div className="flex justify-between text-[11px]">
              <span className="font-sans font-semibold text-slate-500 dark:text-slate-400">
                {t('comments.bar_coverage', 'Bar Coverage')}
              </span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                {t('Excellent')} {METRICS_DATA.barCoverage}%
              </span>
            </div>
            <Progress
              value={METRICS_DATA.barCoverage}
              className="h-1.5 bg-slate-100 dark:bg-slate-800"
            />
          </div>

          {/* 2. Regression R² */}
          <div className="space-y-1 rounded-lg border border-emerald-100 bg-slate-50 p-2 dark:border-emerald-900/30 dark:bg-[#0d1411]">
            <div className="flex justify-between text-[11px]">
              <span className="font-sans font-semibold text-slate-500 dark:text-slate-400">
                {t('comments.regression_r2', 'Regression R²')}
              </span>
              <span className="font-bold text-amber-600 dark:text-amber-400">
                {t('Fair')} {METRICS_DATA.regressionR2}%
              </span>
            </div>
            <Progress
              value={METRICS_DATA.regressionR2}
              className="h-1.5 bg-slate-100 dark:bg-slate-800"
            />
          </div>

          {/* 3. EDT Fitness */}
          <div className="space-y-1 rounded-lg border border-emerald-100 bg-slate-50 p-2 dark:border-emerald-900/30 dark:bg-[#0d1411]">
            <div className="flex justify-between text-[11px]">
              <span className="font-sans font-semibold text-slate-500 dark:text-slate-400">
                {t('comments.edt_fitness', 'EDT Fitness')}
              </span>
              <span className="font-bold text-rose-600 dark:text-rose-400">
                {t('Underfit')} {METRICS_DATA.edtFitness}%
              </span>
            </div>
            <Progress
              value={METRICS_DATA.edtFitness}
              className="h-1.5 bg-slate-100 dark:bg-slate-800"
            />
          </div>

          {/* 4. Baseline Symmetry */}
          <div className="space-y-1 rounded-lg border border-emerald-100 bg-slate-50 p-1.5 dark:border-emerald-900/30 dark:bg-[#0d1411]">
            <div className="flex justify-between text-[11px]">
              <span className="font-sans font-semibold text-slate-500 dark:text-slate-400">
                {t('comments.baseline_symmetry', 'Baseline Symmetry')}
              </span>
              <span className="font-bold text-cyan-600 dark:text-cyan-400">
                {t(METRICS_DATA.symmetryBias)}{' '}
                {`${METRICS_DATA.baselineSymmetry}%`}
              </span>
            </div>
            <Progress
              value={METRICS_DATA.baselineSymmetry}
              className="h-1.5 bg-slate-100 dark:bg-slate-800"
            />
          </div>
        </div>
      </div>

      {/* FREE Tier Glassmorphism Blur Overlay Gate */}
      {tier === 'FREE' && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/85 p-6 text-center backdrop-blur-md dark:bg-[#070b09]/85">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600 shadow-lg ring-1 shadow-amber-500/10 ring-amber-500/40 dark:text-amber-400">
            <Lock className="h-6 w-6" />
          </div>
          <Badge
            variant="outline"
            className="mb-2 border-amber-500/50 bg-amber-500/10 font-mono text-[10px] text-amber-600 dark:text-amber-400"
          >
            🔒 {t('PRO Subscriber Feature')}
          </Badge>
          <h3 className="mb-1 text-base font-bold text-slate-900 dark:text-slate-100">
            {t('Live Feeds & Quality Metrics')}
          </h3>
          <p className="mb-4 max-w-xs text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            {t(
              'Live Market Comments, Session Countdowns, Gauges, and EDT Quality Metrics require a PRO subscription. Upgrade to unlock real-time WebSocket feeds for XAUUSD.'
            )}
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
            {t('Upgrade to PRO')}
          </Button>
        </div>
      )}
    </div>
  );
}
