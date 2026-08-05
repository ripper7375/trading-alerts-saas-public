'use client';

import * as React from 'react';
import { GripVerticalIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ResizablePanelGroupProps
  extends React.HTMLAttributes<HTMLDivElement> {
  direction?: 'horizontal' | 'vertical';
}

function ResizablePanelGroup({
  className,
  direction = 'horizontal',
  children,
  ...props
}: ResizablePanelGroupProps) {
  return (
    <div
      data-slot="resizable-panel-group"
      className={cn(
        'flex h-full w-full',
        direction === 'vertical' ? 'flex-col' : 'flex-row',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

interface ResizablePanelProps extends React.HTMLAttributes<HTMLDivElement> {
  defaultSize?: number;
  minSize?: number;
  maxSize?: number;
  id?: string;
  order?: number;
}

function ResizablePanel({
  className,
  defaultSize,
  minSize,
  maxSize,
  id,
  order,
  children,
  style,
  ...props
}: ResizablePanelProps) {
  return (
    <div
      data-slot="resizable-panel"
      className={cn('h-full w-full flex-1 overflow-hidden', className)}
      style={{
        flex: defaultSize ? `${defaultSize} 1 0%` : '1 1 0%',
        minWidth: minSize ? `${minSize}%` : undefined,
        maxWidth: maxSize ? `${maxSize}%` : undefined,
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
}

interface ResizableHandleProps extends React.HTMLAttributes<HTMLDivElement> {
  withHandle?: boolean;
}

function ResizableHandle({
  withHandle,
  className,
  ...props
}: ResizableHandleProps) {
  return (
    <div
      data-slot="resizable-handle"
      className={cn(
        'border-border/50 relative flex w-px shrink-0 items-center justify-center border-r bg-border',
        className
      )}
      {...props}
    >
      {withHandle && (
        <div className="rounded-xs z-10 flex h-4 w-3 items-center justify-center border bg-border">
          <GripVerticalIcon className="size-2.5" />
        </div>
      )}
    </div>
  );
}

export { ResizablePanelGroup, ResizablePanel, ResizableHandle };
