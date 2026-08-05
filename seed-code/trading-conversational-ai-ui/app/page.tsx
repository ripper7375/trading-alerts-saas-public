'use client';

import { useState } from 'react';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import TradingChart from '@/components/trading-chart';
import ChatPanel from '@/components/chat-panel';
import MarketCommentsPanel from '@/components/market-comments-panel';
import { ChatSidebar } from '@/components/chat-sidebar';
import { ProUpgradeModal } from '@/components/ui/pro-upgrade-modal';
import {
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Sparkles,
  Zap,
  Lock,
} from 'lucide-react';
import type { Symbol, Timeframe, Tier } from '@/lib/types';
import { cn } from '@/lib/utils';

export default function Page() {
  const [symbol, setSymbol] = useState<Symbol>('XAUUSD');
  const [timeframe, setTimeframe] = useState<Timeframe>('M5');

  // Preview Tier State: FREE vs PRO
  const [tier, setTier] = useState<Tier>('PRO');

  // Sidebar Collapse State
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Panel 1 (Chat) and Panel 3 (Comments) Collapse States
  const [isPanel1Collapsed, setIsPanel1Collapsed] = useState(false);
  const [isPanel3Collapsed, setIsPanel3Collapsed] = useState(false);

  // Pro Upgrade Modal State
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [upgradeFeatureName, setUpgradeFeatureName] = useState('');

  const handleOpenUpgradeModal = (featureName: string) => {
    setUpgradeFeatureName(featureName);
    setIsUpgradeModalOpen(true);
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#06070a] select-none">
      {/* Leftmost Navigation Sidebar */}
      <ChatSidebar
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        tier={tier}
        onTierChange={setTier}
      />

      {/* Main Content Workspace Area */}
      <div className="flex h-screen flex-1 flex-col overflow-hidden">
        {/* Top Workspace Header Toolbar with Deep Slate Charcoal Background #0f121a */}
        <div className="flex h-11 items-center justify-between border-b border-slate-800 bg-[#0f121a] px-3.5 text-xs shadow-md">
          <div className="flex items-center gap-2">
            {/* Toggle Panel 1 Button if collapsed */}
            {isPanel1Collapsed && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 border-amber-500/40 bg-amber-500/10 text-xs font-medium text-amber-300 hover:bg-amber-500/20"
                onClick={() => setIsPanel1Collapsed(false)}
              >
                <PanelLeftOpen className="mr-1.5 h-3.5 w-3.5" />
                Show AI Analyst
              </Button>
            )}

            <div className="flex items-center gap-2 font-bold">
              <span className="text-slate-100">DavinTrade Target UI</span>
              <Badge
                variant="outline"
                className="border-amber-500/50 bg-amber-500/10 font-mono text-[10px] text-amber-400 uppercase"
              >
                Parts 01–33
              </Badge>
            </div>
          </div>

          {/* Center Title Badge */}
          <div className="hidden items-center gap-2 md:flex">
            <span className="font-mono text-[11px] text-slate-400">
              Stack D (AI Analyst) + Stack E (Market Comments) + Part 24 Engine
              2
            </span>
          </div>

          {/* Right Header Preview Switch & Controls */}
          <div className="flex items-center gap-2">
            <div className="border-slate-750 flex items-center rounded-lg border bg-[#080a0f] p-0.5 shadow-inner">
              <span className="px-2 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                Preview Mode:
              </span>
              <Button
                variant={tier === 'FREE' ? 'default' : 'ghost'}
                size="sm"
                className={cn(
                  'h-6 px-2.5 text-[11px] font-bold transition-all',
                  tier === 'FREE' && 'bg-slate-750 text-white shadow-xs'
                )}
                onClick={() => setTier('FREE')}
              >
                <Lock className="mr-1 h-3 w-3" />
                FREE
              </Button>
              <Button
                variant={tier === 'PRO' ? 'default' : 'ghost'}
                size="sm"
                className={cn(
                  'h-6 px-2.5 text-[11px] font-bold transition-all',
                  tier === 'PRO' &&
                    'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 hover:bg-amber-400'
                )}
                onClick={() => setTier('PRO')}
              >
                <Zap className="mr-1 h-3 w-3 fill-black" />
                PRO
              </Button>
            </div>

            {/* Toggle Panel 3 Button if collapsed */}
            {isPanel3Collapsed && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 border-emerald-500/40 bg-emerald-500/10 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20"
                onClick={() => setIsPanel3Collapsed(false)}
              >
                <PanelRightOpen className="mr-1.5 h-3.5 w-3.5" />
                Show Comments
              </Button>
            )}
          </div>
        </div>

        {/* 3-Panel Split Workspace with Distinct Canvases & Tones */}
        <div className="flex flex-1 overflow-hidden">
          <ResizablePanelGroup direction="horizontal">
            {/* Panel 1: Stack D AI Analyst Chat (Left) — Dark Obsidian Tone #0c0d12 */}
            {!isPanel1Collapsed && (
              <>
                <ResizablePanel defaultSize={25} minSize={18} maxSize={40}>
                  <ChatPanel
                    tier={tier}
                    symbol={symbol}
                    timeframe={timeframe}
                    onSymbolChange={setSymbol}
                    onTimeframeChange={setTimeframe}
                    isSidebarCollapsed={isSidebarCollapsed}
                    onToggleSidebar={() =>
                      setIsSidebarCollapsed(!isSidebarCollapsed)
                    }
                    onCollapsePanel={() => setIsPanel1Collapsed(true)}
                    onOpenUpgradeModal={handleOpenUpgradeModal}
                  />
                </ResizablePanel>
                <ResizableHandle
                  withHandle
                  className="bg-slate-800/80 transition-colors hover:bg-amber-500/50"
                />
              </>
            )}

            {/* Panel 2: Part 24 Dual Stacked MTF Lightweight Charts (Middle) — Deep Navy M5 vs Amethyst M15 */}
            <ResizablePanel
              defaultSize={
                isPanel1Collapsed && isPanel3Collapsed
                  ? 100
                  : isPanel1Collapsed || isPanel3Collapsed
                    ? 75
                    : 50
              }
            >
              <TradingChart
                tier={tier}
                symbol={symbol}
                timeframe={timeframe}
                onSymbolChange={setSymbol}
                onTimeframeChange={setTimeframe}
                onOpenUpgradeModal={handleOpenUpgradeModal}
              />
            </ResizablePanel>

            {/* Panel 3: Stack E Market Comments & Quality Metrics (Right) — Deep Emerald Tone #090e0c */}
            {!isPanel3Collapsed && (
              <>
                <ResizableHandle
                  withHandle
                  className="bg-slate-800/80 transition-colors hover:bg-emerald-500/50"
                />
                <ResizablePanel defaultSize={25} minSize={18} maxSize={40}>
                  <MarketCommentsPanel
                    tier={tier}
                    onCollapsePanel={() => setIsPanel3Collapsed(true)}
                    onOpenUpgradeModal={handleOpenUpgradeModal}
                  />
                </ResizablePanel>
              </>
            )}
          </ResizablePanelGroup>
        </div>
      </div>

      {/* Pro Upgrade Modal Dialog */}
      <ProUpgradeModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
        featureName={upgradeFeatureName}
        onUpgradeSuccess={() => setTier('PRO')}
      />
    </div>
  );
}
