'use client';

import { useState } from 'react';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import { Button } from '@/components/ui/button';
import TradingChart from '@/components/trading-chart';
import ChatPanel from '@/components/chat-panel';
import MarketCommentsPanel from '@/components/market-comments-panel';
import { ChatSidebar } from '@/components/chat-sidebar';
import { ProUpgradeModal } from '@/components/ui/pro-upgrade-modal';
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
      {/* Part-A: Leftmost Navigation Sidebar */}
      <ChatSidebar
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        tier={tier}
        onTierChange={setTier}
        activePage={activePage}
        onNavigate={setActivePage}
      />

      {/* Main Content Workspace Area */}
      <div className="flex h-screen flex-1 flex-col overflow-hidden">
        {/* Helper Top Bar for collapsed panel controls if needed */}
        {(isPanel1Collapsed || isPanel3Collapsed) && (
          <div className="flex h-8 shrink-0 items-center justify-between border-b border-slate-800 bg-[#0c0f17] px-3 text-xs">
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

        {/* 3-Panel Split Workspace with Reciprocal Drag Resizing */}
        <div className="flex flex-1 overflow-hidden">
          <ResizablePanelGroup direction="horizontal">
            {/* Part-B: Stack D AI Analyst Chat (Left) */}
            {!isPanel1Collapsed && (
              <>
                <ResizablePanel defaultSize={26} minSize={18} maxSize={40}>
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
                <ResizableHandle
                  withHandle
                  className="bg-slate-800/90 transition-colors hover:bg-amber-500/50"
                />
              </>
            )}

            {/* Part-C: Dual Stacked MTF Lightweight Charts (Middle) */}
            <ResizablePanel
              defaultSize={
                isPanel1Collapsed && isPanel3Collapsed
                  ? 100
                  : isPanel1Collapsed || isPanel3Collapsed
                    ? 74
                    : 48
              }
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
                <ResizableHandle
                  withHandle
                  className="bg-slate-800/90 transition-colors hover:bg-emerald-500/50"
                />
                <ResizablePanel defaultSize={26} minSize={18} maxSize={40}>
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
