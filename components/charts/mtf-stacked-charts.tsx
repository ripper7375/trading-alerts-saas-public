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
 * - Component 10: the Panel C instant prompts, one "Explain the current M5 / M15 chart" button at
 *   the bottom left of each pane (flag-gated; an overlay, so the split arithmetic is untouched).
 *
 * @module components/charts/mtf-stacked-charts
 */

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ImperativePanelGroupHandle } from 'react-resizable-panels';
import type { IChartApi, IRange, Time } from 'lightweight-charts';
import { Lock, Sparkles } from 'lucide-react';
import { useSession } from 'next-auth/react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import { useLocale } from '@/lib/context/locale-context';
import { cn } from '@/lib/utils';

import { AskAiOverlay } from './ask-ai-button';
import type { DrawingType } from './drawing/types';
import { MtfTopBar, type IndicatorId } from './mtf/MtfTopBar';
import { useMtfPreference } from './mtf/useMtfPreference';
import { TradingChart } from './trading-chart';
import { instantKindFor, useInstantPrompt } from './use-instant-prompt';
import {
  DEFAULT_SPLIT,
  FALLBACK_TOTAL_HEIGHT_PX,
  FREE_DEFAULT_SPLIT,
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
  /** Whether the user has PRO tier. If omitted, resolved from session. */
  isPro?: boolean;
  /**
   * The Panel C instant prompts ("Explain the current M5 chart" and the M15 one): one button at the
   * bottom left of each pane. Off unless the server says `INTAKE_INSTANT_PROMPTS_ENABLED` is `true`
   * (`isInstantPromptsEnabled()`, read by the page and passed down).
   */
  instantPromptsEnabled?: boolean;
  /** A Free trader's press on an instant prompt opens this (the existing upgrade modal). */
  onOpenUpgradeModal?: () => void;
  /** The success body of an instant prompt, for the chat that step 7 builds. */
  onInstantResult?: (body: unknown) => void;
}

/** Percentages closer than this are the same divider position. */
const SPLIT_EPSILON = 0.05;

export function MtfStackedCharts({
  symbol,
  upperTimeframe = 'M15',
  lowerTimeframe = 'M5',
  totalHeight,
  onAskAi,
  isPro: isProProp,
  instantPromptsEnabled = false,
  onOpenUpgradeModal,
  onInstantResult,
}: MtfStackedChartsProps): React.JSX.Element {
  const { t } = useLocale();
  const { data: session } = useSession();
  const sessionIsPro = session?.user?.tier === 'PRO';
  const isPro = isProProp !== undefined ? isProProp : sessionIsPro;
  const initialSplit = isPro ? DEFAULT_SPLIT : FREE_DEFAULT_SPLIT;

  // Panel C instant prompts: one request in flight for the whole chart. A Free trader with nowhere
  // to be sent (no upgrade modal) gets no button rather than one that does nothing.
  const instant = useInstantPrompt({
    isPro,
    onOpenUpgradeModal,
    onResult: onInstantResult,
  });
  const showInstantPrompts =
    instantPromptsEnabled && (isPro || onOpenUpgradeModal !== undefined);
  const upperInstantKind = instantKindFor(upperTimeframe);
  const lowerInstantKind = instantKindFor(lowerTimeframe);

  const containerRef = useRef<HTMLDivElement>(null);
  const panelsContainerRef = useRef<HTMLDivElement>(null);
  const groupRef = useRef<ImperativePanelGroupHandle>(null);
  const [measuredHeight, setMeasuredHeight] = useState<number | null>(null);
  const [split, setSplit] = useState<readonly number[]>(initialSplit);

  // Active chart panel: 'upper' (M15) or 'lower' (M5)
  const [activePanel, setActivePanel] = useState<'upper' | 'lower'>('upper');
  // Visual click/press feedback state: shows thick orange border while clicking
  const [pressingPanel, setPressingPanel] = useState<'upper' | 'lower' | null>(
    null
  );
  const pressStartTimeRef = useRef<number>(0);
  const pressTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Drawing tools state (Component 7) applied to active panel
  const [activeTool, setActiveTool] = useState<DrawingType | null>(null);

  // Chart price display mode state (Component 8): per-panel candle/bar/hide switch
  const [upperPriceMode, setUpperPriceMode] = useState<
    'CANDLE' | 'BAR' | 'HIDE'
  >('CANDLE');
  const [lowerPriceMode, setLowerPriceMode] = useState<
    'CANDLE' | 'BAR' | 'HIDE'
  >('CANDLE');

  const activePriceMode =
    activePanel === 'upper' ? upperPriceMode : lowerPriceMode;

  const handlePriceModeChange = useCallback(
    (mode: 'CANDLE' | 'BAR' | 'HIDE') => {
      if (activePanel === 'upper') {
        setUpperPriceMode(mode);
      } else {
        setLowerPriceMode(mode);
      }
    },
    [activePanel]
  );

  const handlePanelPress = useCallback((panel: 'upper' | 'lower') => {
    setActivePanel(panel);
    setPressingPanel(panel);
    pressStartTimeRef.current = Date.now();
    if (pressTimeoutRef.current) {
      clearTimeout(pressTimeoutRef.current);
      pressTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    const handlePointerUp = () => {
      const elapsed = Date.now() - pressStartTimeRef.current;
      const remaining = Math.max(0, 180 - elapsed);
      if (remaining > 0) {
        pressTimeoutRef.current = setTimeout(() => {
          setPressingPanel(null);
        }, remaining);
      } else {
        setPressingPanel(null);
      }
    };

    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointerup', handlePointerUp);
      if (pressTimeoutRef.current) clearTimeout(pressTimeoutRef.current);
    };
  }, []);

  // Multi-timeframe overlay preference (Component 9)
  const {
    enabled: mtfEnabled,
    setEnabled: setMtfEnabled,
    isSaving: mtfSaving,
  } = useMtfPreference(isPro);

  // Active indicators state (multi-select: EDT, SSA, FT, SR, ZZ)
  const [activeIndicators, setActiveIndicators] = useState<IndicatorId[]>([]);
  const handleToggleIndicator = useCallback((id: IndicatorId) => {
    setActiveIndicators((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }, []);

  // Timeframe timeline sync state (M15 & M5 sync visible range)
  const [isTfLocked, setIsTfLocked] = useState(false);
  const handleToggleTfLock = useCallback(() => {
    setIsTfLocked((prev) => !prev);
  }, []);

  // Chart API references for timeline sync
  const [upperChartApi, setUpperChartApi] = useState<IChartApi | null>(null);
  const [lowerChartApi, setLowerChartApi] = useState<IChartApi | null>(null);

  // Synchronize timeline between upper and lower charts when Padlock TF is enabled
  useEffect(() => {
    if (!isTfLocked || !upperChartApi || !lowerChartApi) return;

    // Initial sync from upper to lower if visible range exists
    try {
      const initialRange = upperChartApi.timeScale().getVisibleRange();
      if (initialRange) {
        lowerChartApi.timeScale().setVisibleRange(initialRange);
      }
    } catch {
      // Safe guard if chart timeScale is not ready
    }

    let isSyncing = false;
    const handleUpperRangeChange = (range: IRange<Time> | null) => {
      if (!range || isSyncing || !lowerChartApi) return;
      isSyncing = true;
      try {
        lowerChartApi.timeScale().setVisibleRange(range);
      } catch {
        // Safe guard
      } finally {
        requestAnimationFrame(() => {
          isSyncing = false;
        });
      }
    };

    const handleLowerRangeChange = (range: IRange<Time> | null) => {
      if (!range || isSyncing || !upperChartApi) return;
      isSyncing = true;
      try {
        upperChartApi.timeScale().setVisibleRange(range);
      } catch {
        // Safe guard
      } finally {
        requestAnimationFrame(() => {
          isSyncing = false;
        });
      }
    };

    const upperTimeScale = upperChartApi.timeScale();
    const lowerTimeScale = lowerChartApi.timeScale();

    upperTimeScale.subscribeVisibleTimeRangeChange(handleUpperRangeChange);
    lowerTimeScale.subscribeVisibleTimeRangeChange(handleLowerRangeChange);

    return () => {
      try {
        upperTimeScale.unsubscribeVisibleTimeRangeChange(
          handleUpperRangeChange
        );
        lowerTimeScale.unsubscribeVisibleTimeRangeChange(
          handleLowerRangeChange
        );
      } catch {
        // Cleanup guard
      }
    };
  }, [isTfLocked, upperChartApi, lowerChartApi]);

  const handleResetSplit = useCallback(() => {
    groupRef.current?.setLayout([...initialSplit]);
    setSplit(initialSplit);
  }, [initialSplit]);

  const handleDeleteSelected = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete' }));
    }
  }, []);

  const getInstantPrompt = useCallback(
    (tf: string) =>
      t(
        'charts.instant_prompt_analyze',
        'Analyse {symbol} {timeframe} market context and structure.'
      )
        .replace('{symbol}', symbol)
        .replace('{timeframe}', tf),
    [t, symbol]
  );

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
      {/* Unified top toolbar: Component 7 + 8 + 9 + Indicators + Padlock TF */}
      <MtfTopBar
        activeTool={activeTool}
        onSelectTool={setActiveTool}
        onDeleteSelected={handleDeleteSelected}
        priceMode={activePriceMode}
        onPriceModeChange={handlePriceModeChange}
        isPro={isPro}
        mtfEnabled={mtfEnabled}
        mtfLoading={mtfSaving}
        onToggleMtf={setMtfEnabled}
        activeIndicators={activeIndicators}
        onToggleIndicator={handleToggleIndicator}
        isTfLocked={isTfLocked}
        onToggleTfLock={handleToggleTfLock}
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
            defaultSize={initialSplit[0]}
            minSize={minSize}
            className="overflow-hidden p-1"
          >
            <div
              data-testid="mtf-upper-container"
              className={cn(
                'relative h-full w-full select-none overflow-hidden rounded-md transition-all duration-300 ease-out',
                pressingPanel === 'upper'
                  ? 'border-2 border-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.5)] ring-2 ring-amber-500/30'
                  : activePanel === 'upper'
                    ? 'border-border/90 ring-border/50 border ring-1'
                    : 'border-border/60 border'
              )}
              onPointerDownCapture={() => handlePanelPress('upper')}
            >
              <TradingChart
                symbol={symbol}
                timeframe={upperTimeframe}
                height={upperHeight}
                showHeader={false}
                showFooter={false}
                isStacked={true}
                hideToolbar={true}
                onChartReady={setUpperChartApi}
                externalTool={activePanel === 'upper' ? activeTool : null}
                onActiveToolChange={(tool) => {
                  if (activePanel === 'upper') setActiveTool(tool);
                }}
                priceMode={upperPriceMode}
                externalMtfEnabled={mtfEnabled}
                watermark={!isPro ? 'DavinTrade' : undefined}
                watermarkSubtext={
                  !isPro ? `${symbol} ${upperTimeframe}` : undefined
                }
                overlayBadge={
                  isPro ? (
                    <button
                      type="button"
                      onClick={() =>
                        onAskAi?.(getInstantPrompt(upperTimeframe))
                      }
                      title={t(
                        'charts.instant_prompt_title',
                        'Instant prompt to AI chat'
                      )}
                      className={cn(
                        'shadow-xs backdrop-blur-xs group flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-left transition-all active:scale-95',
                        activePanel === 'upper'
                          ? 'border-amber-500/70 bg-amber-500/10 ring-1 ring-amber-500/30'
                          : 'border-border/80 bg-background/90 hover:bg-muted/80 hover:border-amber-500/50'
                      )}
                    >
                      <Avatar className="h-4 w-4 border border-amber-400/80">
                        <AvatarImage
                          src="/DavinTrade_Logo.jpg"
                          alt="DavinTrade"
                        />
                        <AvatarFallback className="text-[9px]">
                          DT
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-mono text-xs font-semibold text-foreground">
                        {symbol} · {upperTimeframe}
                      </span>
                      <span className="text-[11px] font-medium text-muted-foreground group-hover:text-foreground">
                        {t('Market Context')}
                      </span>
                      {activePanel === 'upper' && (
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                      )}
                    </button>
                  ) : undefined
                }
                label={`${symbol} · ${upperTimeframe}`}
              />

              {showInstantPrompts && upperInstantKind !== null && (
                <AskAiOverlay
                  kind={upperInstantKind}
                  loading={instant.pending === upperInstantKind}
                  disabled={instant.pending !== null}
                  notice={
                    instant.notice?.kind === upperInstantKind
                      ? instant.notice.text
                      : null
                  }
                  onPress={instant.press}
                />
              )}
            </div>
          </ResizablePanel>

          <ResizableHandle
            aria-label={t('Drag to resize the upper and lower charts')}
            onDoubleClick={handleResetSplit}
            tooltipTitle={
              isPro ? 'Reset chart split (50:50)' : 'Reset chart split (60:40)'
            }
            tooltipShortcut="Double-click"
            tooltipSubtitle="Drag to resize"
            tooltipSide="bottom"
          />

          {/* Lower chart: M5 with Component 6 overlay badge */}
          <ResizablePanel
            id="mtf-lower"
            order={2}
            defaultSize={initialSplit[1]}
            minSize={minSize}
            className="overflow-hidden p-1"
          >
            <div
              data-testid="mtf-lower-container"
              className={cn(
                'relative h-full w-full select-none overflow-hidden rounded-md transition-all duration-300 ease-out',
                pressingPanel === 'lower'
                  ? 'border-2 border-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.5)] ring-2 ring-amber-500/30'
                  : activePanel === 'lower'
                    ? 'border-border/90 ring-border/50 border ring-1'
                    : 'border-border/60 border'
              )}
              onPointerDownCapture={() => handlePanelPress('lower')}
            >
              <TradingChart
                symbol={symbol}
                timeframe={lowerTimeframe}
                height={lowerHeight}
                showHeader={false}
                showFooter={false}
                isStacked={true}
                hideToolbar={true}
                onChartReady={setLowerChartApi}
                externalTool={activePanel === 'lower' ? activeTool : null}
                onActiveToolChange={(tool) => {
                  if (activePanel === 'lower') setActiveTool(tool);
                }}
                priceMode={lowerPriceMode}
                watermark={!isPro ? 'DavinTrade' : undefined}
                watermarkSubtext={
                  !isPro ? `${symbol} ${lowerTimeframe}` : undefined
                }
                overlayBadge={
                  isPro ? (
                    <button
                      type="button"
                      onClick={() =>
                        onAskAi?.(getInstantPrompt(lowerTimeframe))
                      }
                      title={t(
                        'charts.instant_prompt_title',
                        'Instant prompt to AI chat'
                      )}
                      className={cn(
                        'shadow-xs backdrop-blur-xs group flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-left transition-all active:scale-95',
                        activePanel === 'lower'
                          ? 'border-amber-500/70 bg-amber-500/10 ring-1 ring-amber-500/30'
                          : 'border-border/80 bg-background/90 hover:bg-muted/80 hover:border-amber-500/50'
                      )}
                    >
                      <Avatar className="h-4 w-4 border border-amber-400/80">
                        <AvatarImage
                          src="/DavinTrade_Logo.jpg"
                          alt="DavinTrade"
                        />
                        <AvatarFallback className="text-[9px]">
                          DT
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-mono text-xs font-semibold text-foreground">
                        {symbol} · {lowerTimeframe}
                      </span>
                      <span className="text-[11px] font-medium text-muted-foreground group-hover:text-foreground">
                        {t('Market Context')}
                      </span>
                      {activePanel === 'lower' && (
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                      )}
                    </button>
                  ) : undefined
                }
                label={`${symbol} · ${lowerTimeframe}`}
              />

              {showInstantPrompts && lowerInstantKind !== null && (
                <AskAiOverlay
                  kind={lowerInstantKind}
                  loading={instant.pending === lowerInstantKind}
                  disabled={instant.pending !== null}
                  notice={
                    instant.notice?.kind === lowerInstantKind
                      ? instant.notice.text
                      : null
                  }
                  onPress={instant.press}
                />
              )}

              {!isPro && (
                <div
                  data-testid="free-tier-tools-banner"
                  className="shadow-xs backdrop-blur-xs pointer-events-auto absolute left-1/2 top-2.5 z-20 flex -translate-x-1/2 items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-foreground"
                >
                  <Lock className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                  <span className="text-[11px] font-medium">
                    {t(
                      'charts.free_tier_tools_notice',
                      'Drawing and Indicator Tools are unavailable for FREE Tier'
                    )}
                  </span>
                  <Link
                    href="/pricing"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    className="shadow-xs h-5.5 inline-flex items-center gap-1 rounded bg-amber-500 px-2 text-[10px] font-bold text-slate-950 transition-colors hover:bg-amber-400"
                  >
                    <Sparkles className="h-2.5 w-2.5 fill-slate-950" />
                    <span>
                      {t('dashboard.upgrade_to_pro', 'Upgrade to PRO')}
                    </span>
                  </Link>
                </div>
              )}
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
