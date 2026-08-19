import React, { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  actionIcon?: LucideIcon;
  className?: string;
  children?: ReactNode;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  actionIcon: ActionIcon,
  className,
  children,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'my-4 flex flex-col items-center justify-center rounded-3xl border border-dashed border-border/80 bg-card/40 p-8 text-center',
        className
      )}
    >
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground">
        <Icon className="h-8 w-8" />
      </div>
      <h3 className="mb-1 text-base font-bold text-foreground">{title}</h3>
      <p className="mb-6 max-w-xs text-xs leading-relaxed text-muted-foreground">
        {description}
      </p>

      {actionLabel && onAction && (
        <Button onClick={onAction} className="gap-2 font-bold">
          {ActionIcon && <ActionIcon className="h-4 w-4" />}
          <span>{actionLabel}</span>
        </Button>
      )}

      {children}
    </div>
  );
}
