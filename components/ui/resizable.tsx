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

const ResizableHandle = ({
  withHandle,
  className,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.PanelResizeHandle> & {
  withHandle?: boolean;
}) => (
  <ResizablePrimitive.PanelResizeHandle
    className={cn(
      'relative z-20 flex touch-none select-none items-center justify-center bg-border transition-colors hover:bg-amber-500/60 focus-visible:outline-none data-[panel-group-direction=horizontal]:h-full data-[panel-group-direction=vertical]:h-2.5 data-[panel-group-direction=horizontal]:w-2.5 data-[panel-group-direction=vertical]:w-full data-[panel-group-direction=horizontal]:cursor-col-resize data-[panel-group-direction=vertical]:cursor-row-resize',
      className
    )}
    {...props}
  >
    {withHandle && (
      <div className="z-10 flex items-center justify-center rounded-sm border border-border bg-card shadow-md data-[panel-group-direction=horizontal]:h-5 data-[panel-group-direction=vertical]:h-3.5 data-[panel-group-direction=horizontal]:w-3.5 data-[panel-group-direction=vertical]:w-6">
        <GripHorizontalIcon className="h-3 w-3 text-muted-foreground data-[panel-group-direction=horizontal]:hidden" />
        <GripVerticalIcon className="h-3 w-3 text-muted-foreground data-[panel-group-direction=vertical]:hidden" />
      </div>
    )}
  </ResizablePrimitive.PanelResizeHandle>
);

export { ResizablePanelGroup, ResizablePanel, ResizableHandle };
