import { cn } from '@/lib/utils';

/**
 * Skeleton Component
 *
 * A loading placeholder component that shows an animated pulse effect.
 * Use this to indicate loading states in UI elements.
 *
 * @example
 * ```tsx
 * // Basic skeleton
 * <Skeleton className="h-4 w-[250px]" />
 *
 * // Card skeleton
 * <Skeleton className="h-[200px] w-full rounded-xl" />
 *
 * // Text block skeleton
 * <div className="space-y-2">
 *   <Skeleton className="h-4 w-[250px]" />
 *   <Skeleton className="h-4 w-[200px]" />
 * </div>
 * ```
 */
function Skeleton({
  className,
  ...props
}: React.ComponentProps<'div'>): React.ReactElement {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        'bg-gray-200 dark:bg-gray-700 animate-pulse rounded-md',
        className
      )}
      {...props}
    />
  );
}

export { Skeleton };
