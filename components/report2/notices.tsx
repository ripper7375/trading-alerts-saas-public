'use client';

/**
 * The notices of Report 2 (build step 5, part 7).
 *
 * `CompulsoryNotices` is the text that is on EVERY report and in the modal, never
 * hidden and never optional: the single-order scope notice, "you place the order
 * with your broker" and the calculation-tool disclaimer (architecture 6.10, 6.11,
 * ADR-068). The rest are the notices the offer check raised (a delay, the half-risk
 * caution, a style mismatch, a newer cycle), the reason a setup is not offered, and
 * the releases that fall inside the holding window.
 *
 * @module components/report2/notices
 */

import { AlertTriangle, Ban, Info, RefreshCw } from 'lucide-react';
import type { ReactElement, ReactNode } from 'react';

import type { Described } from '@/lib/engine4/templates/messages';
import {
  COMPULSORY_KEYS,
  type WarningDoc,
} from '@/lib/engine4/templates/report2';
import type { Report2Key } from '@/lib/engine4/templates/text';
import { cn } from '@/lib/utils';

import { useReport2 } from './use-report2';

export type Tone = 'info' | 'caution' | 'danger';

const TONES: Record<Tone, string> = {
  info: 'border-sky-500/40 bg-sky-500/10 text-sky-950 dark:border-sky-400/40 dark:text-sky-50',
  caution:
    'border-amber-500/50 bg-amber-500/10 text-amber-950 dark:border-amber-400/50 dark:text-amber-50',
  danger:
    'border-red-500/50 bg-red-500/10 text-red-950 dark:border-red-400/50 dark:text-red-50',
};

const ICONS: Record<Tone, typeof Info> = {
  info: Info,
  caution: AlertTriangle,
  danger: Ban,
};

export function Callout({
  tone,
  role,
  className,
  children,
}: {
  tone: Tone;
  role?: 'status' | 'alert' | 'note';
  className?: string;
  children: ReactNode;
}): ReactElement {
  const Icon = ICONS[tone];
  return (
    <div
      role={role}
      className={cn(
        'flex min-w-0 items-start gap-2 rounded-md border p-3 text-sm',
        TONES[tone],
        className
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1 break-words">{children}</div>
    </div>
  );
}

/** On every report: the single-order notice, "you place the order with your broker", the disclaimer. */
export function CompulsoryNotices({
  keys = COMPULSORY_KEYS,
  className,
}: {
  keys?: readonly Report2Key[];
  className?: string;
}): ReactElement {
  const { tr } = useReport2();
  return (
    <div
      role="note"
      data-testid="report2-compulsory"
      className={cn(
        'bg-muted/40 space-y-1.5 rounded-md border p-3 text-xs text-muted-foreground',
        className
      )}
    >
      {keys.map((key) => (
        <p
          key={key}
          className={cn(
            'break-words',
            key === 'report2.notice.broker_order' &&
              'text-sm font-medium text-foreground'
          )}
        >
          {tr(key)}
        </p>
      ))}
    </div>
  );
}

/** Delay, caution, style and newer-cycle notices of the offer check. */
export function OfferNotices({
  notices,
  onRefresh,
}: {
  notices: readonly Described[];
  /** pressed on the "the picture changed" notice; without it the notice has no button */
  onRefresh?: () => void;
}): ReactElement | null {
  const { say, tr } = useReport2();
  if (notices.length === 0) return null;
  return (
    <div className="space-y-2" data-testid="report2-offer-notices">
      {notices.map((notice) => {
        const refresh = notice.key === 'report2.notice.newer_cycle';
        const caution =
          notice.key === 'report2.notice.cautionary' ||
          notice.key === 'report2.notice.retuning';
        return (
          <Callout
            key={notice.key}
            tone={refresh || caution ? 'caution' : 'info'}
            role="status"
          >
            <p>{say(notice)}</p>
            {refresh && onRefresh !== undefined ? (
              <button
                type="button"
                onClick={onRefresh}
                className="hover:bg-foreground/5 mt-2 inline-flex items-center gap-1.5 rounded-md border border-current px-2.5 py-1 text-xs font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                {tr('report2.notice.refresh')}
              </button>
            ) : null}
          </Callout>
        );
      })}
    </div>
  );
}

/** Why Report 2 is not offered: the first reason, in the order of the 6.4 table. */
export function NotOfferedNotice({
  reason,
}: {
  reason: Described | null;
}): ReactElement {
  const { say, tr } = useReport2();
  return (
    <Callout tone="danger" role="alert">
      <p className="font-medium">{tr('report2.not_offered.heading')}</p>
      {reason === null ? null : <p className="mt-1">{say(reason)}</p>}
    </Callout>
  );
}

/** Other HIGH-impact USD releases inside the holding window: a warning, not a block (6.6). */
export function ReleaseWarnings({
  warnings,
}: {
  warnings: readonly WarningDoc[];
}): ReactElement | null {
  const { say, tr } = useReport2();
  if (warnings.length === 0) return null;
  return (
    <Callout tone="caution" role="status">
      <p className="font-medium">{tr('report2.warning.heading')}</p>
      <ul className="mt-1 space-y-0.5">
        {warnings.map((warning) => (
          <li key={`${warning.name.text}-${warning.time.text}`}>
            {say({
              key: 'report2.warning.release',
              params: { name: warning.name, time: warning.time },
            })}
            {warning.approximate ? (
              <span className="text-xs opacity-80">
                {' '}
                {tr('report2.warning.approximate')}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </Callout>
  );
}
