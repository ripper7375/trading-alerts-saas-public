import React from 'react';
import { cn } from '@/lib/utils';

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-xl bg-muted/60', className)}
      {...props}
    />
  );
}

export function AlertCardSkeleton() {
  return (
    <div className="space-y-3 rounded-2xl border border-border/60 bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-16 rounded-md" />
          <Skeleton className="h-5 w-10 rounded-md" />
        </div>
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
      <div className="flex items-baseline justify-between pt-1">
        <div className="space-y-1">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-6 w-24" />
        </div>
        <div className="space-y-1 text-right">
          <Skeleton className="ml-auto h-3 w-16" />
          <Skeleton className="ml-auto h-5 w-20" />
        </div>
      </div>
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="flex h-full w-full flex-col space-y-4 p-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-9 w-32 rounded-xl" />
        <div className="flex gap-1">
          <Skeleton className="h-8 w-10 rounded-lg" />
          <Skeleton className="h-8 w-10 rounded-lg" />
          <Skeleton className="h-8 w-10 rounded-lg" />
        </div>
      </div>
      <Skeleton className="min-h-[300px] w-full flex-1 rounded-2xl" />
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="space-y-2 rounded-2xl border border-border/60 bg-card p-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-7 w-7 rounded-lg" />
      </div>
      <Skeleton className="h-7 w-28" />
      <Skeleton className="h-3 w-16" />
    </div>
  );
}

export function NotificationItemSkeleton() {
  return (
    <div className="flex gap-3 rounded-2xl border border-border/60 bg-card p-3.5">
      <Skeleton className="h-9 w-9 shrink-0 rounded-xl" />
      <div className="flex-1 space-y-1.5">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-12" />
        </div>
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-3/4" />
      </div>
    </div>
  );
}
