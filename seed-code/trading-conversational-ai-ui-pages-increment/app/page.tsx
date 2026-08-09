'use client';

import { useState } from 'react';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import { Button } from '@/components/ui/button';
import dynamic from 'next/dynamic';
import { ChartSkeleton } from '@/components/ui/chart-skeleton';

const TradingChart = dynamic(() => import('@/components/trading-chart'), {
  ssr: false,
  loading: () => <ChartSkeleton />,
});

const ProUpgradeModal = dynamic(
  () =>
    import('@/components/ui/pro-upgrade-modal').then(
      (mod) => mod.ProUpgradeModal
    ),
  { ssr: false }
);
import ChatPanel from '@/components/chat-panel';
import MarketCommentsPanel from '@/components/market-comments-panel';
import { ChatSidebar } from '@/components/chat-sidebar';
import { PanelLeftOpen, PanelRightOpen } from 'lucide-react';
import type { Symbol, Timeframe, Tier } from '@/lib/types';

export default function Page() {
  const [symbol, setSymbol] = useState<Symbol>('XAUUSD');
  const [timeframe, setTimeframe] = useState<Timeframe>('M5');

  // Active Tier (PRO Tier focused layout as specified)
  const [tier, setTier] = useState<Tier>('PRO');

  // Active Sidebar Page ('Home' | 'Alerts')
  const [activePage, setActivePage] = useState<'Home' | 'Alerts'>('Home');

  // Sidebar & Panel Collapse States
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isPanel1Collapsed, setIsPanel1Collapsed] = useState(false);
  const [isPanel3Collapsed, setIsPanel3Collapsed] = useState(false);

  // Pro Upgrade Modal State
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [upgradeFeatureName, setUpgradeFeatureName] = useState('');

  // Predetermined Question state triggered from Chart Avatar Ask AI buttons (C3/C5)
  const [predeterminedQuestion, setPredeterminedQuestion] = useState<
    string | null
  >(null);

  const handleOpenUpgradeModal = (featureName: string) => {
    setUpgradeFeatureName(featureName);
    setIsUpgradeModalOpen(true);
  };

  const handleAskAiFromChart = (question: string) => {
    setPredeterminedQuestion(question);
    if (isPanel1Collapsed) {
      setIsPanel1Collapsed(false); // Auto-expand Chat panel if user clicks Ask AI on chart
    }
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#06070a] select-none">
      <div className="flex h-screen flex-1 flex-col overflow-hidden">
        {/* Top Control Bar when Chat Panel B or Comments Panel D are collapsed */}
        {(isPanel1Collapsed || isPanel3Collapsed) && (
          <div className="z-30 flex h-8 shrink-0 items-center justify-between border-b border-slate-800 bg-[#0c0f17] px-3 text-xs">
            <div className="flex items-center gap-2">
              {isPanel1Collapsed && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 border-amber-500/40 bg-amber-500/10 text-[11px] font-bold text-amber-300"
                  onClick={() => setIsPanel1Collapsed(false)}
                >
                  <PanelLeftOpen className="mr-1 h-3 w-3" />
                  Show AI Analyst
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {isPanel3Collapsed && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 border-emerald-500/40 bg-emerald-500/10 text-[11px] font-bold text-emerald-300"
                  onClick={() => setIsPanel3Collapsed(false)}
                >
                  <PanelRightOpen className="mr-1 h-3 w-3" />
                  Show Comments
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Unified 4-Panel Horizontal Drag-Resizable Workspace (Part A, Part B, Part C, Part D) */}
        <div className="flex flex-1 overflow-hidden">
          <ResizablePanelGroup
            direction="horizontal"
            dir="ltr"
            className="h-full w-full"
          >
            {/* Part-A: Leftmost Navigation Sidebar */}
            <ResizablePanel
              id="panel-a-sidebar"
              order={1}
              defaultSize={16}
              minSize={4}
              maxSize={25}
              className="h-full overflow-hidden"
            >
              <ChatSidebar
                isCollapsed={isSidebarCollapsed}
                onToggleCollapse={() =>
                  setIsSidebarCollapsed(!isSidebarCollapsed)
                }
                tier={tier}
                onTierChange={setTier}
                activePage={activePage}
                onNavigate={setActivePage}
              />
            </ResizablePanel>

            {/* Drag Handle 1: Between Part A (Sidebar) and Part B (Chat Panel) */}
            <ResizableHandle
              withHandle
              className="border-x border-amber-500/30 bg-[#0c0f17] hover:bg-amber-500/60"
            />

            {/* Part-B: Stack D AI Analyst Chat Panel (Left-Middle) */}
            {!isPanel1Collapsed && (
              <>
                <ResizablePanel
                  id="panel-b-chat"
                  order={2}
                  defaultSize={24}
                  minSize={15}
                  maxSize={35}
                  className="h-full overflow-hidden"
                >
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
                    predeterminedQuestion={predeterminedQuestion}
                    onClearPredeterminedQuestion={() =>
                      setPredeterminedQuestion(null)
                    }
                  />
                </ResizablePanel>

                {/* Drag Handle 2: Between Part B (Chat Panel) and Part C (Trading Chart) */}
                <ResizableHandle
                  withHandle
                  className="border-x border-amber-500/30 bg-[#0c0f17] hover:bg-amber-500/60"
                />
              </>
            )}

            {/* Part-C: Dual Stacked MTF Lightweight Charts (Middle - Auto Expands when A/B/D collapsed) */}
            <ResizablePanel
              id="panel-c-charts"
              order={3}
              defaultSize={38}
              minSize={25}
              className="h-full overflow-hidden"
            >
              <TradingChart
                tier={tier}
                symbol={symbol}
                timeframe={timeframe}
                onSymbolChange={setSymbol}
                onTimeframeChange={setTimeframe}
                onOpenUpgradeModal={handleOpenUpgradeModal}
                onAskAiFromChart={handleAskAiFromChart}
              />
            </ResizablePanel>

            {/* Part-D: Stack E Market Comments, Session Countdown, Gauges & Setup Card (Right) */}
            {!isPanel3Collapsed && (
              <>
                {/* Drag Handle 3: Between Part C (Trading Chart) and Part D (Comments Panel) */}
                <ResizableHandle
                  withHandle
                  className="border-x border-emerald-500/30 bg-[#0c0f17] hover:bg-emerald-500/60"
                />

                <ResizablePanel
                  id="panel-d-comments"
                  order={4}
                  defaultSize={22}
                  minSize={15}
                  maxSize={35}
                  className="h-full overflow-hidden"
                >
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
