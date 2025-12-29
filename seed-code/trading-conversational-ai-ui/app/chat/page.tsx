'use client';

import { useState } from 'react';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import TradingChart from '@/components/trading-chart';
import ChatPanel from '@/components/chat-panel';
import { ChatSidebar } from '@/components/chat-sidebar';
import type { Symbol, Timeframe } from '@/lib/types';

export default function Page() {
  const [symbol, setSymbol] = useState<Symbol>('XAUUSD');
  const [timeframe, setTimeframe] = useState<Timeframe>('H1');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  return (
    <div className="bg-background flex h-screen w-full overflow-hidden">
      {/* Left Sidebar */}
      <ChatSidebar
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={toggleSidebar}
      />

      {/* Main Content Area with Resizable Panels */}
      <div className="flex h-screen flex-1">
        <ResizablePanelGroup direction="horizontal">
          {/* Chat Panel */}
          <ResizablePanel defaultSize={30} minSize={20} maxSize={50}>
            <ChatPanel
              symbol={symbol}
              timeframe={timeframe}
              onSymbolChange={setSymbol}
              onTimeframeChange={setTimeframe}
              isSidebarCollapsed={isSidebarCollapsed}
              onToggleSidebar={toggleSidebar}
            />
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Trading Chart */}
          <ResizablePanel defaultSize={70}>
            <TradingChart
              tier="PRO"
              symbol={symbol}
              timeframe={timeframe}
              onSymbolChange={setSymbol}
              onTimeframeChange={setTimeframe}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
