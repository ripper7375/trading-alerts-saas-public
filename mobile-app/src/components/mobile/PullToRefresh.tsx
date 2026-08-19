import React from 'react';
import { Loader2, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PullToRefreshIndicatorProps {
  pullDistance: number;
  isRefreshing: boolean;
  threshold?: number;
}

export function PullToRefreshIndicator({
  pullDistance,
  isRefreshing,
  threshold = 75,
}: PullToRefreshIndicatorProps) {
  const progress = Math.min(pullDistance / threshold, 1);
  const isReady = pullDistance >= threshold;

  if (pullDistance === 0 && !isRefreshing) return null;

  return (
    <div
      className="pointer-events-none absolute left-0 right-0 z-50 flex items-center justify-center overflow-hidden"
      style={{
        top: 0,
        height: pullDistance,
        transition: isRefreshing ? 'none' : 'height 0.2s ease-out',
      }}
    >
      <div
        className={cn(
          'flex h-10 w-10 items-center justify-center rounded-full border border-primary/30 bg-card/90 shadow-lg backdrop-blur-md transition-all',
          isReady && 'scale-110 border-primary bg-primary/20'
        )}
        style={{
          transform: `scale(${0.6 + progress * 0.4}) rotate(${progress * 180}deg)`,
          opacity: Math.min(progress * 1.5, 1),
        }}
      >
        {isRefreshing ? (
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        ) : (
          <ArrowDown
            className={cn(
              'h-5 w-5 text-primary transition-transform duration-150',
              isReady && 'rotate-180 text-amber-500'
            )}
          />
        )}
      </div>
    </div>
  );
}
