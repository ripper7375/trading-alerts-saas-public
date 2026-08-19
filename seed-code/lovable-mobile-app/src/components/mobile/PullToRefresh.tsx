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
  threshold = 80,
}: PullToRefreshIndicatorProps) {
  const progress = Math.min(pullDistance / threshold, 1);
  const isReady = pullDistance >= threshold;

  if (pullDistance === 0 && !isRefreshing) return null;

  return (
    <div
      className="pointer-events-none absolute left-0 right-0 z-50 flex items-center justify-center"
      style={{
        top: 0,
        height: pullDistance,
        transition: isRefreshing ? 'none' : 'height 0.2s ease-out',
      }}
    >
      <div
        className={cn(
          'flex h-10 w-10 items-center justify-center rounded-full border border-primary/20 bg-primary/10 transition-all',
          isReady && 'border-primary/40 bg-primary/20',
          isRefreshing && 'bg-primary/20'
        )}
        style={{
          transform: `scale(${0.5 + progress * 0.5}) rotate(${progress * 180}deg)`,
          opacity: Math.min(progress * 1.5, 1),
        }}
      >
        {isRefreshing ? (
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        ) : (
          <ArrowDown
            className={cn(
              'h-5 w-5 text-primary transition-transform',
              isReady && 'rotate-180'
            )}
          />
        )}
      </div>
    </div>
  );
}
