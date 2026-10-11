'use client';

/**
 * MtfStackedCharts — the two-panel multi-timeframe layout.
 *
 * Implements Proposed Design:
 * - Component 4: Dual-pane container with M15 (top) and M5 (bottom) separated by resizable divider.
 * - Component 5: Upper Chart top-left overlay badge "[DavinTrade Avatar] XAUUSD M15 Market Context".
 * - Component 6: Lower Chart top-left overlay badge "[DavinTrade Avatar] XAUUSD M5 Market Context".
 * - Component 7: Unified top horizontal drawing toolbar.
 * - Component 8: Chart display mode toggles (Bar vs Candlestick).
 * - Component 9: M5 Overlay button relocated to the top toolbar.
 *
 * @module components/charts/mtf-stacked-charts
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ImperativePanelGroupHandle } from 'react-resizable-panels';
import { useSession } from 'next-auth/react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import { useLocale } from '@/lib/context/locale-context';

import type { DrawingType } from './drawing/types';
import { MtfTopBar } from './mtf/MtfTopBar';
import { useMtfPreference } from './mtf/useMtfPreference';
import { TradingChart } from './trading-chart';
import {
  DEFAULT_SPLIT,
  FALLBACK_TOTAL_HEIGHT_PX,
  minPanePercent,
  paneCanvasHeights,
} from './mtf-split-layout';

interface MtfStackedChartsProps {
  symbol: string;
  /** Upper panel. Defaults to M15 in the proposed design. */
  upperTimeframe?: string;
  /** Lower panel. Defaults to M5 in the proposed design. */
  lowerTimeframe?: string;
  /**
   * Total height for both charts combined. Omit to measure the container,
   * which is what a resizable panel needs.
   */
  totalHeight?: number;
  /** Instant prompt callback to AI chat when clicking market context badge */
  onAskAi?: (prompt: string) => void;
}

/** Percentages closer than this are the same divider position. */
const SPLIT_EPSILON = 0.05;

export function MtfStackedCharts({
  symbol,
  upperTimeframe = 'M15',
  lowerTimeframe = 'M5',
  totalHeight,
  onAskAi,
}: MtfStackedChartsProps): React.JSX.Element {
  const { t } = useLocale();
  const containerRef = useRef<HTMLDivElement>(null);
  const panelsContainerRef = useRef<HTMLDivElement>(null);
  const groupRef = useRef<ImperativePanelGroupHandle>(null);
  const [measuredHeight, setMeasuredHeight] = useState<number | null>(null);
  const [split, setSplit] = useState<readonly number[]>(DEFAULT_SPLIT);

  // Drawing tools state (Component 7)
  const [activeTool, setActiveTool] = useState<DrawingType | null>(null);

  // Chart price display mode state (Component 8)
  const [priceMode, setPriceMode] = useState<'CANDLE' | 'BAR' | 'HIDE'>(
    'CANDLE'
  );

  // Multi-timeframe overlay preference (Component 9)
  const { data: session } = useSession();
  const isPro = session?.user?.tier === 'PRO';
  const {
    enabled: mtfEnabled,
    setEnabled: setMtfEnabled,
    isSaving: mtfSaving,
  } = useMtfPreference(isPro);

  const handleResetSplit = useCallback(() => {
    groupRef.current?.setLayout([...DEFAULT_SPLIT]);
    setSplit(DEFAULT_SPLIT);
  }, []);

  const handleDeleteSelected = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete' }));
    }
  }, []);

  /**
   * Observe the panels container box to size the chart canvases accurately.
   */
  useEffect(() => {
    if (totalHeight !== undefined) return;
    const el = panelsContainerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.height;
      if (next && next > 0) setMeasuredHeight(next);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [totalHeight]);

  /**
   * Fires on every frame of a drag, resizing both canvases live.
   */
  const onLayout = useCallback((next: number[]): void => {
    setSplit((prev) =>
      next.every(
        (size, i) => Math.abs(size - (prev[i] ?? Number.NaN)) < SPLIT_EPSILON
      )
        ? prev
        : next
    );
  }, []);

  const available = totalHeight ?? measuredHeight ?? FALLBACK_TOTAL_HEIGHT_PX;
  const [upperHeight, lowerHeight] = paneCanvasHeights(available, split);
  const minSize = minPanePercent(available);

  return (
    <div
      ref={containerRef}
      className="flex h-full w-full flex-col overflow-hidden bg-background"
      style={totalHeight !== undefined ? { height: totalHeight } : undefined}
    >
      {/* Unified top toolbar: Component 7 + 8 + 9 */}
      <MtfTopBar
        activeTool={activeTool}
        onSelectTool={setActiveTool}
        onDeleteSelected={handleDeleteSelected}
        priceMode={priceMode}
        onPriceModeChange={setPriceMode}
        isPro={isPro}
        mtfEnabled={mtfEnabled}
        mtfLoading={mtfSaving}
        onToggleMtf={setMtfEnabled}
      />

      {/* Panels container */}
      <div ref={panelsContainerRef} className="relative min-h-0 flex-1">
        <ResizablePanelGroup
          ref={groupRef}
          direction="vertical"
          className="h-full w-full"
          onLayout={onLayout}
        >
          {/* Upper chart: M15 with Component 5 overlay badge */}
          <ResizablePanel
            id="mtf-upper"
            order={1}
            defaultSize={DEFAULT_SPLIT[0]}
            minSize={minSize}
            className="overflow-hidden"
          >
            <TradingChart
              symbol={symbol}
              timeframe={upperTimeframe}
              height={upperHeight}
              showHeader={false}
              showFooter={false}
              isStacked={true}
              hideToolbar={true}
              externalTool={activeTool}
              onActiveToolChange={setActiveTool}
              priceMode={priceMode}
              externalMtfEnabled={mtfEnabled}
              overlayBadge={
                <button
                  type="button"
                  onClick={() =>
                    onAskAi?.(
                      `Analyze ${symbol} ${upperTimeframe} market context and structure.`
                    )
                  }
                  title="Instant prompt to AI chat"
                  className="border-border/80 bg-background/90 shadow-xs backdrop-blur-xs hover:bg-muted/80 group flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-left transition-all hover:border-amber-500/50 active:scale-95"
                >
                  <Avatar className="h-4 w-4 border border-amber-400/80">
                    <AvatarImage src="/DavinTrade_Logo.jpg" alt="DavinTrade" />
                    <AvatarFallback className="text-[9px]">DT</AvatarFallback>
                  </Avatar>
                  <span className="font-mono text-xs font-semibold text-foreground">
                    {symbol} · {upperTimeframe}
                  </span>
                  <span className="text-[11px] font-medium text-muted-foreground group-hover:text-foreground">
                    {t('Market Context')}
                  </span>
                </button>
              }
              label={`${symbol} · ${upperTimeframe}`}
            />
          </ResizablePanel>

          <ResizableHandle
            aria-label={t('Drag to resize the upper and lower charts')}
            onDoubleClick={handleResetSplit}
            tooltipTitle="Reset chart split (50:50)"
            tooltipShortcut="Double-click"
            tooltipSubtitle="Drag to resize"
            tooltipSide="bottom"
          />

          {/* Lower chart: M5 with Component 6 overlay badge */}
          <ResizablePanel
            id="mtf-lower"
            order={2}
            defaultSize={DEFAULT_SPLIT[1]}
            minSize={minSize}
            className="overflow-hidden"
          >
            <TradingChart
              symbol={symbol}
              timeframe={lowerTimeframe}
              height={lowerHeight}
              showHeader={false}
              showFooter={false}
              isStacked={true}
              hideToolbar={true}
              externalTool={activeTool}
              onActiveToolChange={setActiveTool}
              priceMode={priceMode}
              overlayBadge={
                <button
                  type="button"
                  onClick={() =>
                    onAskAi?.(
                      `Analyze ${symbol} ${lowerTimeframe} market context and structure.`
                    )
                  }
                  title="Instant prompt to AI chat"
                  className="border-border/80 bg-background/90 shadow-xs backdrop-blur-xs hover:bg-muted/80 group flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-left transition-all hover:border-amber-500/50 active:scale-95"
                >
                  <Avatar className="h-4 w-4 border border-amber-400/80">
                    <AvatarImage src="/DavinTrade_Logo.jpg" alt="DavinTrade" />
                    <AvatarFallback className="text-[9px]">DT</AvatarFallback>
                  </Avatar>
                  <span className="font-mono text-xs font-semibold text-foreground">
                    {symbol} · {lowerTimeframe}
                  </span>
                  <span className="text-[11px] font-medium text-muted-foreground group-hover:text-foreground">
                    {t('Market Context')}
                  </span>
                </button>
              }
              label={`${symbol} · ${lowerTimeframe}`}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
