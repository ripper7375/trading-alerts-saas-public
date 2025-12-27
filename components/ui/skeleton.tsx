import { cn } from '@/lib/utils';

/**
 * Skeleton loading placeholder component
 *
 * A placeholder component that shows a pulsing animation
 * while content is loading.
 */
function Skeleton({
  className,
  ...props
}: React.ComponentProps<'div'>): React.JSX.Element {
  return (
    <div
      data-slot="skeleton"
      className={cn('bg-gray-200 dark:bg-gray-700 animate-pulse rounded-md', className)}
      {...props}
    />
  );
}

export { Skeleton };
