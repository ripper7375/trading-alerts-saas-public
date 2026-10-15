/**
 * The small pieces every chat card is made of (build step 7 part 8): a figure or a code that keeps its
 * own left-to-right direction inside right-to-left text, a pill, a section.
 *
 * What stays left to right in Arabic and Urdu: prices, distances, ratios, times, sensor ids (`MCD2`),
 * level names (`UOEDT`, `baseline`), state codes, rule ids, zone ids, model slugs and request ids.
 * They are drawn in a `<bdi dir="ltr">` so the surrounding right-to-left text neither reorders them
 * nor lets their punctuation drift to the wrong end.
 *
 * @module components/chat/figure
 */

import type { ReactElement, ReactNode } from 'react';

import { cn } from '@/lib/utils';

/** A price, a distance, a ratio or a time: a figure, kept left to right. */
export function Figure({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}): ReactElement {
  return (
    <bdi dir="ltr" className={cn('tabular-nums', className)}>
      {children}
    </bdi>
  );
}

/** An id the code gives (a sensor, a level, a state, a rule, a zone, a model): never translated, kept left to right. */
export function Code({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}): ReactElement {
  return (
    <bdi dir="ltr" className={cn('font-mono text-[0.92em]', className)}>
      {children}
    </bdi>
  );
}

export type Tone = 'neutral' | 'good' | 'bad' | 'warn' | 'info';

const TONES: Record<Tone, string> = {
  neutral: 'border-border bg-muted/50 text-foreground',
  good: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-900 dark:border-emerald-400/40 dark:text-emerald-100',
  bad: 'border-rose-500/40 bg-rose-500/10 text-rose-900 dark:border-rose-400/40 dark:text-rose-100',
  warn: 'border-amber-500/50 bg-amber-500/10 text-amber-900 dark:border-amber-400/50 dark:text-amber-100',
  info: 'border-sky-500/40 bg-sky-500/10 text-sky-900 dark:border-sky-400/40 dark:text-sky-100',
};

export function Pill({
  tone = 'neutral',
  children,
  className,
  testId,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
  testId?: string;
}): ReactElement {
  return (
    <span
      data-testid={testId}
      data-tone={tone}
      className={cn(
        'inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-tight',
        TONES[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

/** A titled part of a card. `id` names the heading so the part is a labelled region for a screen reader. */
export function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}): ReactElement {
  return (
    <section aria-labelledby={id} className="space-y-1.5">
      <h4
        id={id}
        className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground"
      >
        {title}
      </h4>
      {children}
    </section>
  );
}

/** One label and its value, in a definition list row. */
export function Row({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}): ReactElement {
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-2">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-end font-medium">{children}</dd>
    </div>
  );
}
