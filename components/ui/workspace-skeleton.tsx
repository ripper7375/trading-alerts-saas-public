import { Skeleton } from '@/components/ui/skeleton';

/**
 * The placeholder of the full-screen trading workspaces (`/terminal`,
 * `/free`) while the page's server work runs: the same full-height frame as
 * `components/workspace/trading-workspace.tsx` with a thread rail on the left,
 * the two stacked charts in the middle and the conversation on the right, so
 * the workspace appears in place and nothing jumps.
 */
export function WorkspaceSkeleton(): React.ReactElement {
  return (
    <div
      aria-busy="true"
      data-slot="workspace-skeleton"
      className="flex h-screen w-full overflow-hidden bg-background"
    >
      <div className="hidden w-64 shrink-0 space-y-3 border-r border-border p-3 md:block">
        <Skeleton className="h-9 w-full" />
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-3 p-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="min-h-0 flex-1" />
        <Skeleton className="min-h-0 flex-1" />
      </div>

      <div className="hidden w-80 shrink-0 flex-col gap-3 border-l border-border p-3 lg:flex">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="min-h-0 flex-1" />
        <Skeleton className="h-12 w-full" />
      </div>
    </div>
  );
}
