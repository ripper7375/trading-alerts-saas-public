'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Bot, MessageSquareText } from 'lucide-react';
import type { ImperativePanelGroupHandle } from 'react-resizable-panels';

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import { ChatSidebar } from '@/components/chat-sidebar';
import ChatPanel from '@/components/chat-panel';
import MarketCommentsPanel from '@/components/market-comments-panel';
import { Translated, useLocale } from '@/lib/context/locale-context';
import type { Tier } from '@/lib/tier-config';

import { CollapsedPanelRail } from './collapsed-panel-rail';
import {
  ANALYST,
  CHART,
  COMMENTS,
  SIDEBAR,
  buildPanelConstraints,
  collapseLayout,
  expandLayout,
  isPanelCollapsed,
  type CollapsiblePanelIndex,
} from './panel-layout';

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
          <p className="text-sm text-muted-foreground">
            <Translated k="charts.loading_chart" fallback="Loading chart..." />
          </p>
        </div>
      </div>
    ),
  }
);

interface TradingWorkspaceProps {
  tier: Tier;
  /** FREE only: the empty-state panels' "Get priority access on PRO" nudge. */
  onOpenUpgradeModal?: () => void;
}

type CollapsedState = Record<CollapsiblePanelIndex, boolean>;

/**
 * The 4-panel workbench shared by `/terminal` (PRO) and `/free` (FREE):
 * sidebar | AI Analyst | M5+M15 charts | Market Comments.
 *
 * Collapsing a panel resizes the panel itself. Before this, the collapse
 * buttons only changed what a panel rendered: the sidebar showed its icon
 * column inside a 16%-wide panel, and a dragged-narrow sidebar re-expanded its
 * labels into a panel that stayed narrow. The AI Analyst and Market Comments
 * panels were unmounted instead, which made react-resizable-panels rebuild the
 * whole layout from the remaining default sizes (every panel grew, the
 * sidebar included, and manual resizing was lost) and moved the reopen button
 * to a bar above the workspace.
 *
 * Now all four panels stay mounted, the three side panels are `collapsible`
 * down to a rail, and the group layout is the single source of truth: the
 * buttons set it, dragging a handle past a panel's minimum collapses it, and
 * the library's onCollapse/onExpand callbacks tell each panel which content to
 * render, whichever of the two moved it.
 */
export function TradingWorkspace({
  tier,
  onOpenUpgradeModal,
}: TradingWorkspaceProps): React.JSX.Element {
  const { t } = useLocale();

  const groupRef = useRef<ImperativePanelGroupHandle>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [panelSpacePx, setPanelSpacePx] = useState(0);
  const constraints = useMemo(
    () => buildPanelConstraints(panelSpacePx),
    [panelSpacePx]
  );

  const [collapsed, setCollapsed] = useState<CollapsedState>({
    [SIDEBAR]: false,
    [ANALYST]: false,
    [COMMENTS]: false,
  });
  // Width each panel had when last expanded, restored when it is reopened.
  const lastExpandedSize = useRef<
    Partial<Record<CollapsiblePanelIndex, number>>
  >({});
  // Layout when the current handle drag began. A drag that collapses a panel
  // passes through its minimum on the way, so without this, reopening it
  // would restore the minimum instead of the width it had before the drag.
  const dragStartLayout = useRef<number[] | null>(null);
  const onHandleDragging = (isDragging: boolean): void => {
    dragStartLayout.current = isDragging
      ? (groupRef.current?.getLayout() ?? null)
      : null;
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const measure = (): void => {
      const handles = container.querySelectorAll<HTMLElement>(
        '[data-panel-resize-handle-id]'
      );
      let handlesPx = 0;
      handles.forEach((handle) => {
        handlesPx += handle.offsetWidth;
      });
      setPanelSpacePx(Math.max(0, container.clientWidth - handlesPx));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const togglePanel = (index: CollapsiblePanelIndex): void => {
    const group = groupRef.current;
    if (!group) return;
    const layout = group.getLayout();
    group.setLayout(
      isPanelCollapsed(layout, index, constraints)
        ? expandLayout(
            layout,
            index,
            constraints,
            lastExpandedSize.current[index]
          )
        : collapseLayout(layout, index, constraints)
    );
  };

  const collapsiblePanelProps = (index: CollapsiblePanelIndex) => {
    const constraint = constraints[index];
    const setPanelCollapsed = (value: boolean): void =>
      setCollapsed((prev) =>
        prev[index] === value ? prev : { ...prev, [index]: value }
      );

    return {
      order: index + 1,
      collapsible: true,
      defaultSize: constraint?.defaultSize,
      minSize: constraint?.minSize,
      maxSize: constraint?.maxSize,
      collapsedSize: constraint?.collapsedSize,
      onCollapse: () => {
        const sizeBeforeDrag = dragStartLayout.current?.[index];
        if (
          constraint &&
          sizeBeforeDrag !== undefined &&
          sizeBeforeDrag >= constraint.minSize - 0.01
        ) {
          lastExpandedSize.current[index] = sizeBeforeDrag;
        }
        setPanelCollapsed(true);
      },
      onExpand: () => setPanelCollapsed(false),
      onResize: (size: number) => {
        if (constraint && size >= constraint.minSize - 0.01) {
          lastExpandedSize.current[index] = size;
        }
      },
      className: 'h-full overflow-hidden',
    };
  };

  const chartConstraint = constraints[CHART];

  return (
    <div className="flex h-screen w-full select-none overflow-hidden bg-background">
      <div ref={containerRef} className="flex h-screen flex-1 overflow-hidden">
        <ResizablePanelGroup
          ref={groupRef}
          direction="horizontal"
          className="h-full w-full"
        >
          <ResizablePanel
            id="panel-a-sidebar"
            {...collapsiblePanelProps(SIDEBAR)}
          >
            <ChatSidebar
              isCollapsed={collapsed[SIDEBAR]}
              onToggleCollapse={() => togglePanel(SIDEBAR)}
              tier={tier}
            />
          </ResizablePanel>

          <ResizableHandle withHandle onDragging={onHandleDragging} />

          <ResizablePanel id="panel-b-chat" {...collapsiblePanelProps(ANALYST)}>
            {collapsed[ANALYST] ? (
              <CollapsedPanelRail
                side="left"
                icon={Bot}
                label={t('AI Analyst')}
                actionLabel={t('Show AI Analyst')}
                accent="amber"
                onExpand={() => togglePanel(ANALYST)}
              />
            ) : (
              <ChatPanel
                tier={tier}
                onCollapsePanel={() => togglePanel(ANALYST)}
                onOpenUpgradeModal={onOpenUpgradeModal}
              />
            )}
          </ResizablePanel>

          <ResizableHandle withHandle onDragging={onHandleDragging} />

          <ResizablePanel
            id="panel-c-chart"
            order={CHART + 1}
            defaultSize={chartConstraint?.defaultSize}
            minSize={chartConstraint?.minSize}
            className="h-full overflow-hidden"
          >
            <div className="flex h-full flex-col overflow-hidden bg-background p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-bold text-foreground">XAUUSD</h2>
              </div>
              {/* Both timeframes are always shown. FREE gets the same layout
                  and data; the M5-overlay toggle on the M15 chart renders
                  locked there and routes to /pricing. */}
              <div className="min-h-0 flex-1">
                <MtfStackedCharts symbol="XAUUSD" />
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle onDragging={onHandleDragging} />

          <ResizablePanel
            id="panel-d-comments"
            {...collapsiblePanelProps(COMMENTS)}
          >
            {collapsed[COMMENTS] ? (
              <CollapsedPanelRail
                side="right"
                icon={MessageSquareText}
                label={t('Market Comments')}
                actionLabel={t('Show Comments')}
                accent="emerald"
                onExpand={() => togglePanel(COMMENTS)}
              />
            ) : (
              <MarketCommentsPanel
                tier={tier}
                onCollapsePanel={() => togglePanel(COMMENTS)}
                onOpenUpgradeModal={onOpenUpgradeModal}
              />
            )}
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
