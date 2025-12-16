'use client';

import { useState } from 'react';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import TradingChart from '@/components/trading-chart';
import ChatPanel from '@/components/chat-panel';
import type { Symbol, Timeframe } from '@/lib/types';

export default function Page() {
  const [symbol, setSymbol] = useState<Symbol>('XAUUSD');
  const [timeframe, setTimeframe] = useState<Timeframe>('H1');

  return (
    <div className="h-screen w-full bg-background overflow-hidden">
      <ResizablePanelGroup direction="horizontal">
        {/* Left Panel: AI Chat */}
        <ResizablePanel defaultSize={30} minSize={20} maxSize={50}>
          <ChatPanel
            symbol={symbol}
            timeframe={timeframe}
            onSymbolChange={setSymbol}
            onTimeframeChange={setTimeframe}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Right Panel: Trading Chart */}
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
  );
}
