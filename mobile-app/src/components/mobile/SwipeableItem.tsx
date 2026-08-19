import React, { useState, useRef, useCallback, ReactNode } from 'react';
import { Trash2, Power, Pause, Play } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SwipeableItemProps {
  children: ReactNode;
  onDelete?: () => void;
  onToggleStatus?: () => void;
  deleteLabel?: string;
  toggleLabel?: string;
  isActive?: boolean;
  className?: string;
}

export function SwipeableItem({
  children,
  onDelete,
  onToggleStatus,
  deleteLabel = 'Delete',
  toggleLabel,
  isActive = true,
  className,
}: SwipeableItemProps) {
  const [translateX, setTranslateX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startX = useRef(0);
  const currentX = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const SWIPE_THRESHOLD = 70;
  const MAX_SWIPE = 90;

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    setIsDragging(true);
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isDragging) return;

      currentX.current = e.touches[0].clientX;
      const diff = startX.current - currentX.current;

      // diff > 0: Swiping Left (Reveals Delete on right)
      // diff < 0: Swiping Right (Reveals Toggle status on left)
      if (diff > 0 && onDelete) {
        setTranslateX(Math.min(diff, MAX_SWIPE));
      } else if (diff < 0 && onToggleStatus) {
        setTranslateX(Math.max(diff, -MAX_SWIPE));
      }
    },
    [isDragging, onDelete, onToggleStatus]
  );

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);

    if (translateX >= SWIPE_THRESHOLD && onDelete) {
      // Snap to delete position
      setTranslateX(MAX_SWIPE);
    } else if (translateX <= -SWIPE_THRESHOLD && onToggleStatus) {
      // Snap to toggle position
      setTranslateX(-MAX_SWIPE);
    } else {
      // Reset position
      setTranslateX(0);
    }
  }, [translateX, onDelete, onToggleStatus]);

  const handleDelete = useCallback(() => {
    setTranslateX(0);
    onDelete?.();
  }, [onDelete]);

  const handleToggle = useCallback(() => {
    setTranslateX(0);
    onToggleStatus?.();
  }, [onToggleStatus]);

  const handleReset = useCallback(() => {
    setTranslateX(0);
  }, []);

  return (
    <div className={cn('relative overflow-hidden rounded-2xl', className)}>
      {/* Left Action Background: Toggle Active / Pause (Swiping Right) */}
      {onToggleStatus && (
        <div
          className={cn(
            'absolute inset-y-0 left-0 flex items-center justify-start',
            isActive ? 'bg-amber-600' : 'bg-emerald-600'
          )}
          style={{ width: MAX_SWIPE }}
        >
          <button
            onClick={handleToggle}
            className="flex h-full w-full flex-col items-center justify-center px-3 text-white transition-opacity active:opacity-80"
          >
            {isActive ? (
              <Pause className="mb-1 h-5 w-5" />
            ) : (
              <Play className="mb-1 h-5 w-5" />
            )}
            <span className="text-[10px] font-bold">
              {toggleLabel || (isActive ? 'Pause' : 'Activate')}
            </span>
          </button>
        </div>
      )}

      {/* Right Action Background: Delete Alert (Swiping Left) */}
      {onDelete && (
        <div
          className="absolute inset-y-0 right-0 flex items-center justify-end bg-destructive"
          style={{ width: MAX_SWIPE }}
        >
          <button
            onClick={handleDelete}
            className="flex h-full w-full flex-col items-center justify-center px-3 text-destructive-foreground transition-opacity active:opacity-80"
          >
            <Trash2 className="mb-1 h-5 w-5" />
            <span className="text-[10px] font-bold">{deleteLabel}</span>
          </button>
        </div>
      )}

      {/* Swipeable Foreground Card */}
      <div
        ref={containerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={translateX !== 0 ? handleReset : undefined}
        className="relative bg-card"
        style={{
          transform: `translateX(-${translateX}px)`,
          transition: isDragging
            ? 'none'
            : 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {children}
      </div>
    </div>
  );
}
