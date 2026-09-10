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
import { ProUpgradeModal } from '@/components/ui/pro-upgrade-modal';
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
 * `/free` -- Protected Page #3, FREE-tier quantitative workspace.
 *
 * Same real chart as `/terminal` (components/charts/trading-chart.tsx) --
 * FREE tier gets the same live XAUUSD data (real per this platform's own
 * FREE/PRO model, see components/alerts/alerts-pro-upgrade.tsx: "Full
 * market data and every indicator overlay — same data as PRO"). The chart's
 * own PRO-only multi-timeframe overlay toggle (MtfToggle) is already
 * real-gated -- it routes a FREE user straight to /pricing on click.
 * Panels B/D are the same genuine empty states as /terminal (Decision 2),
 * with an additional "Get priority access on PRO" nudge that opens
 * ProUpgradeModal -- this page's own feature-gate/upgrade-modal surface.
 */
export function FreeWorkspace(): React.JSX.Element {
  const { t } = useLocale();

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isPanel1Collapsed, setIsPanel1Collapsed] = useState(false);
  const [isPanel3Collapsed, setIsPanel3Collapsed] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);

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
                tier="FREE"
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
                    tier="FREE"
                    onCollapsePanel={() => setIsPanel1Collapsed(true)}
                    onOpenUpgradeModal={() => setIsUpgradeModalOpen(true)}
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
                {/* FREE gets the same dual layout and the same real data; the
                    M5-overlay toggle on the M15 panel renders locked and
                    routes to /pricing. */}
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
                    tier="FREE"
                    onCollapsePanel={() => setIsPanel3Collapsed(true)}
                    onOpenUpgradeModal={() => setIsUpgradeModalOpen(true)}
                  />
                </ResizablePanel>
              </>
            )}
          </ResizablePanelGroup>
        </div>
      </div>

      <ProUpgradeModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
        featureName="early access to AI Copilot & Market Comments"
      />
    </div>
  );
}
