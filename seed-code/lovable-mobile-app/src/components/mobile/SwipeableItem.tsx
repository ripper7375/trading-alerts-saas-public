import { useState, useRef, useCallback, ReactNode } from 'react';
import { Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SwipeableItemProps {
  children: ReactNode;
  onDelete?: () => void;
  deleteLabel?: string;
  className?: string;
}

export function SwipeableItem({
  children,
  onDelete,
  deleteLabel = 'Delete',
  className,
}: SwipeableItemProps) {
  const [translateX, setTranslateX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startX = useRef(0);
  const currentX = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const SWIPE_THRESHOLD = 80;
  const MAX_SWIPE = 100;

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    setIsDragging(true);
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isDragging) return;

      currentX.current = e.touches[0].clientX;
      const diff = startX.current - currentX.current;

      // Only allow left swipe (positive diff)
      if (diff > 0) {
        setTranslateX(Math.min(diff, MAX_SWIPE));
      } else {
        setTranslateX(Math.max(diff * 0.3, -20));
      }
    },
    [isDragging]
  );

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);

    if (translateX >= SWIPE_THRESHOLD) {
      // Snap to delete position
      setTranslateX(MAX_SWIPE);
    } else {
      // Reset position
      setTranslateX(0);
    }
  }, [translateX]);

  const handleDelete = useCallback(() => {
    setTranslateX(0);
    onDelete?.();
  }, [onDelete]);

  const handleReset = useCallback(() => {
    setTranslateX(0);
  }, []);

  return (
    <div className={cn('relative overflow-hidden rounded-lg', className)}>
      {/* Delete Action Background */}
      <div
        className="absolute inset-y-0 right-0 flex items-center justify-end bg-destructive"
        style={{ width: MAX_SWIPE }}
      >
        <button
          onClick={handleDelete}
          className="flex h-full w-full flex-col items-center justify-center px-4 text-destructive-foreground"
        >
          <Trash2 className="mb-1 h-5 w-5" />
          <span className="text-xs font-medium">{deleteLabel}</span>
        </button>
      </div>

      {/* Swipeable Content */}
      <div
        ref={containerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={translateX > 0 ? handleReset : undefined}
        className="relative bg-card"
        style={{
          transform: `translateX(-${translateX}px)`,
          transition: isDragging ? 'none' : 'transform 0.2s ease-out',
        }}
      >
        {children}
      </div>
    </div>
  );
}
