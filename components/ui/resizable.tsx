'use client';

import * as React from 'react';
import { GripVerticalIcon, GripHorizontalIcon } from 'lucide-react';
import * as ResizablePrimitive from 'react-resizable-panels';
import { cn } from '@/lib/utils';

const ResizablePanelGroup = ({
  className,
  dir = 'ltr',
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.PanelGroup>) => (
  <ResizablePrimitive.PanelGroup
    dir={dir}
    className={cn(
      'flex h-full w-full data-[panel-group-direction=horizontal]:flex-row data-[panel-group-direction=vertical]:flex-col',
      className
    )}
    {...props}
  />
);

const ResizablePanel = ResizablePrimitive.Panel;

export interface ResizableHandleProps
  extends React.ComponentProps<typeof ResizablePrimitive.PanelResizeHandle> {
  withHandle?: boolean;
  withGripPill?: boolean;
  tooltipTitle?: string;
  tooltipShortcut?: string;
  tooltipSubtitle?: string;
  tooltipSide?: 'left' | 'right' | 'top' | 'bottom';
  showTooltip?: boolean;
}

const ResizableHandle = ({
  withHandle: _withHandle,
  withGripPill,
  className,
  tooltipTitle,
  tooltipShortcut,
  tooltipSubtitle = 'Drag to resize',
  tooltipSide,
  showTooltip = true,
  onDragging,
  onDoubleClick,
  ...props
}: ResizableHandleProps) => {
  const [isHovered, setIsHovered] = React.useState(false);
  const [isDragging, setIsDragging] = React.useState(false);
  const [mousePos, setMousePos] = React.useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const hoverTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => {
    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    };
  }, []);

  const handleDragging = React.useCallback(
    (dragging: boolean) => {
      setIsDragging(dragging);
      if (dragging) {
        setIsHovered(false);
        if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      }
      onDragging?.(dragging);
    },
    [onDragging]
  );

  const handleMouseMove = React.useCallback(
    (e: React.MouseEvent<any>) => {
      if (isDragging) return;
      const rect = e.currentTarget.getBoundingClientRect();
      setMousePos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        width: rect.width,
        height: rect.height,
      });
    },
    [isDragging]
  );

  const handleMouseEnter = React.useCallback(
    (e: React.MouseEvent<any>) => {
      if (isDragging) return;
      const rect = e.currentTarget.getBoundingClientRect();
      setMousePos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        width: rect.width,
        height: rect.height,
      });
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = setTimeout(() => {
        setIsHovered(true);
      }, 120);
    },
    [isDragging]
  );

  const handleMouseLeave = React.useCallback(() => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    setIsHovered(false);
    setMousePos(null);
  }, []);

  const clampedY = React.useMemo(() => {
    if (!mousePos) return 30;
    return Math.max(30, Math.min(mousePos.height - 30, mousePos.y));
  }, [mousePos]);

  const clampedX = React.useMemo(() => {
    if (!mousePos) return 80;
    return Math.max(80, Math.min(mousePos.width - 80, mousePos.x));
  }, [mousePos]);

  const side = tooltipSide ?? 'right';
  const hasTooltip =
    showTooltip &&
    !isDragging &&
    isHovered &&
    mousePos !== null &&
    (Boolean(tooltipTitle) || Boolean(tooltipSubtitle));

  return (
    <ResizablePrimitive.PanelResizeHandle
      onDragging={handleDragging}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseMove={handleMouseMove}
      onDoubleClick={onDoubleClick}
      className={cn(
        'group relative z-20 flex touch-none select-none items-center justify-center bg-transparent focus-visible:outline-none',
        // Column divider (horizontal panel group)
        'data-[panel-group-direction=horizontal]:h-full data-[panel-group-direction=horizontal]:w-1.5 data-[panel-group-direction=horizontal]:cursor-col-resize',
        // Row divider (vertical panel group)
        'data-[panel-group-direction=vertical]:h-2.5 data-[panel-group-direction=vertical]:w-full data-[panel-group-direction=vertical]:cursor-row-resize',
        className
      )}
      {...props}
    >
      {/* Sleek hairline indicator line */}
      <div
        className={cn(
          'transition-all duration-150',
          // Vertical divider line
          'group-data-[panel-group-direction=horizontal]:h-full group-data-[panel-group-direction=horizontal]:w-[1px]',
          'group-data-[panel-group-direction=horizontal]:bg-border/60',
          'group-hover:group-data-[panel-group-direction=horizontal]:w-[2px] group-hover:group-data-[panel-group-direction=horizontal]:bg-amber-500 group-hover:group-data-[panel-group-direction=horizontal]:shadow-[0_0_8px_rgba(245,158,11,0.5)]',
          'group-data-[resize-handle-state=drag]:group-data-[panel-group-direction=horizontal]:w-[2px] group-data-[resize-handle-state=drag]:group-data-[panel-group-direction=horizontal]:bg-amber-500 group-data-[resize-handle-state=drag]:group-data-[panel-group-direction=horizontal]:shadow-[0_0_8px_rgba(245,158,11,0.5)]',
          // Horizontal divider line
          'group-data-[panel-group-direction=vertical]:h-[1px] group-data-[panel-group-direction=vertical]:w-full',
          'group-data-[panel-group-direction=vertical]:bg-border/60',
          'group-hover:group-data-[panel-group-direction=vertical]:h-[2px] group-hover:group-data-[panel-group-direction=vertical]:bg-amber-500 group-hover:group-data-[panel-group-direction=vertical]:shadow-[0_0_8px_rgba(245,158,11,0.5)]',
          'group-data-[resize-handle-state=drag]:group-data-[panel-group-direction=vertical]:h-[2px] group-data-[resize-handle-state=drag]:group-data-[panel-group-direction=vertical]:bg-amber-500 group-data-[resize-handle-state=drag]:group-data-[panel-group-direction=vertical]:shadow-[0_0_8px_rgba(245,158,11,0.5)]'
        )}
      />

      {/* Legacy grip pill if explicitly requested */}
      {withGripPill && (
        <div className="z-10 flex items-center justify-center rounded-sm border border-border bg-card shadow-md group-data-[panel-group-direction=horizontal]:h-5 group-data-[panel-group-direction=vertical]:h-3.5 group-data-[panel-group-direction=horizontal]:w-3.5 group-data-[panel-group-direction=vertical]:w-6">
          <GripHorizontalIcon className="h-3 w-3 text-muted-foreground group-data-[panel-group-direction=horizontal]:hidden" />
          <GripVerticalIcon className="h-3 w-3 text-muted-foreground group-data-[panel-group-direction=vertical]:hidden" />
        </div>
      )}

      {/* Floating tooltip like VS Code / Image 2 (Arrow 5) */}
      {hasTooltip && (
        <div
          role="tooltip"
          style={{
            top: `${clampedY}px`,
            ...(side === 'bottom' || side === 'top'
              ? { left: `${clampedX}px` }
              : {}),
          }}
          className={cn(
            'animate-in fade-in-0 zoom-in-95 pointer-events-none absolute z-50 select-none whitespace-nowrap rounded-md border border-[#2e2e32] bg-[#18181b] px-3 py-1.5 text-xs shadow-2xl shadow-black/80 transition-opacity duration-150',
            side === 'right' && 'left-4 -translate-y-1/2',
            side === 'left' && 'right-4 -translate-y-1/2',
            side === 'top' && 'bottom-4 -translate-x-1/2',
            side === 'bottom' && 'top-4 -translate-x-1/2'
          )}
        >
          {tooltipTitle && (
            <div className="flex items-center justify-between gap-4 font-normal text-neutral-100">
              <span>{tooltipTitle}</span>
              {tooltipShortcut && (
                <span className="font-mono text-[11px] text-neutral-400">
                  {tooltipShortcut}
                </span>
              )}
            </div>
          )}
          {tooltipSubtitle && (
            <div className="mt-0.5 text-[11px] text-neutral-400">
              {tooltipSubtitle}
            </div>
          )}
        </div>
      )}
    </ResizablePrimitive.PanelResizeHandle>
  );
};

export { ResizablePanelGroup, ResizablePanel, ResizableHandle };
