'use client';

import { ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

interface CollapsedPanelRailProps {
  /** The workspace edge the panel collapses toward: sets chevron and border. */
  side: 'left' | 'right';
  icon: LucideIcon;
  /** The panel's own title, shown vertically. */
  label: string;
  /** Accessible name, e.g. "Show AI Analyst". */
  actionLabel: string;
  accent: 'amber' | 'emerald';
  onExpand: () => void;
}

const ACCENT_CLASSES = {
  amber:
    'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400',
  emerald:
    'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
} as const;

/**
 * What a collapsed AI Analyst / Market Comments panel shows: a narrow,
 * full-height button in the panel's own place, so the control to reopen a
 * panel sits where the panel was (same as the sidebar's own chevron).
 *
 * Replaces the "Show AI Analyst" / "Show Comments" bar that used to appear
 * above the whole workspace, which users did not find.
 */
export function CollapsedPanelRail({
  side,
  icon: Icon,
  label,
  actionLabel,
  accent,
  onExpand,
}: CollapsedPanelRailProps): React.JSX.Element {
  const Chevron = side === 'left' ? ChevronRight : ChevronLeft;

  return (
    <button
      type="button"
      onClick={onExpand}
      title={actionLabel}
      aria-label={actionLabel}
      className={cn(
        'flex h-full w-full flex-col items-center overflow-hidden border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
        side === 'left' ? 'border-r' : 'border-l'
      )}
    >
      <span className="flex h-14 w-full shrink-0 items-center justify-center border-b border-border">
        <Chevron className="h-4 w-4" />
      </span>
      <span
        className={cn(
          'mt-3 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border',
          ACCENT_CLASSES[accent]
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="mt-3 whitespace-nowrap text-[11px] font-bold text-foreground [writing-mode:vertical-rl]">
        {label}
      </span>
    </button>
  );
}
