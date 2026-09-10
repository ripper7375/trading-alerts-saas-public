'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import { Button } from '@/components/ui/button';
import { ChatSidebar } from '@/components/chat-sidebar';
import ChatPanel from '@/components/chat-panel';
import MarketCommentsPanel from '@/components/market-comments-panel';
import { PanelLeftOpen, PanelRightOpen } from 'lucide-react';
import { useLocale } from '@/lib/context/locale-context';

const MtfStackedCharts = dynamic(
  () =>
    import('@/components/charts/mtf-stacked-charts').then(
      (m) => m.MtfStackedCharts
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center rounded-lg bg-card">
        <div className="text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading chart...</p>
        </div>
      </div>
    ),
  }
);

/**
 * `/terminal` -- Protected Page #2, PRO 4-panel quantitative workspace.
 *
 * Panel A (ChatSidebar) and Panel C (real TradingChart -- live Socket.IO
 * OHLCV, drawing toolbar, fired-alert markers, PRO multi-timeframe overlay,
 * all pre-existing and real: components/charts/trading-chart.tsx) are real.
 * Panels B and D (ChatPanel, MarketCommentsPanel) are genuine empty states
 * per this session's Decision 2 -- Stack D/E aren't built until Phases
 * 12/13.
 */
export function TerminalWorkspace(): React.JSX.Element {
  const { t } = useLocale();

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isPanel1Collapsed, setIsPanel1Collapsed] = useState(false);
  const [isPanel3Collapsed, setIsPanel3Collapsed] = useState(false);

  return (
    <div className="flex h-screen w-full select-none overflow-hidden bg-background">
      <div className="flex h-screen flex-1 flex-col overflow-hidden">
        {(isPanel1Collapsed || isPanel3Collapsed) && (
          <div className="z-30 flex h-8 shrink-0 items-center justify-between border-b border-border bg-card px-3 text-xs">
            <div className="flex items-center gap-2">
              {isPanel1Collapsed && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 border-amber-500/40 bg-amber-500/10 text-[11px] font-bold text-amber-700 hover:border-amber-400 hover:bg-amber-500/25 dark:text-amber-300"
                  onClick={() => setIsPanel1Collapsed(false)}
                >
                  <PanelLeftOpen className="mr-1 h-3 w-3" />
                  {t('Show AI Analyst')}
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              {isPanel3Collapsed && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 border-emerald-500/40 bg-emerald-500/10 text-[11px] font-bold text-emerald-700 hover:border-emerald-400 hover:bg-emerald-500/25 dark:text-emerald-300"
                  onClick={() => setIsPanel3Collapsed(false)}
                >
                  <PanelRightOpen className="mr-1 h-3 w-3" />
                  {t('Show Comments')}
                </Button>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-1 overflow-hidden">
          <ResizablePanelGroup direction="horizontal" className="h-full w-full">
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
                tier="PRO"
              />
            </ResizablePanel>

            <ResizableHandle withHandle />

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
                    tier="PRO"
                    onCollapsePanel={() => setIsPanel1Collapsed(true)}
                  />
                </ResizablePanel>
                <ResizableHandle withHandle />
              </>
            )}

            <ResizablePanel
              id="panel-c-chart"
              order={3}
              defaultSize={38}
              minSize={25}
              className="h-full overflow-hidden"
            >
              <div className="flex h-full flex-col overflow-hidden bg-background p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-bold text-foreground">XAUUSD</h2>
                </div>
                {/* Both timeframes are always shown, so the M5/M15 selector
                    that used to sit here has nothing left to select. */}
                <div className="min-h-0 flex-1">
                  <MtfStackedCharts symbol="XAUUSD" />
                </div>
              </div>
            </ResizablePanel>

            {!isPanel3Collapsed && (
              <>
                <ResizableHandle withHandle />
                <ResizablePanel
                  id="panel-d-comments"
                  order={4}
                  defaultSize={22}
                  minSize={15}
                  maxSize={35}
                  className="h-full overflow-hidden"
                >
                  <MarketCommentsPanel
                    tier="PRO"
                    onCollapsePanel={() => setIsPanel3Collapsed(true)}
                  />
                </ResizablePanel>
              </>
            )}
          </ResizablePanelGroup>
        </div>
      </div>
    </div>
  );
}
