'use client';

/**
 * The monthly allowance as the trader sees it (build step 7 part 8; architecture 5.6, 7.3; ADR-073):
 * the SHARE that is left as a bar and a percentage, and "about N analyses left" worked out from what a
 * message of the chosen model MEASURED to cost.
 *
 * What it never shows: a number of tokens, a number of units, a price. A unit is a micro-dollar of the
 * gateway's cost; printing it would publish the business's own cost, and ADR-073 says no token number
 * is published until the first measurement run. While the cost is not measured the meter says so in
 * words instead of guessing; while the allowance is not set it says that and draws no bar.
 *
 * @module components/chat/quota-meter
 */

import { Zap } from 'lucide-react';
import type { ReactElement } from 'react';

import { cn } from '@/lib/utils';

import { analysesLeft, shareLeft } from './chat-state';
import type { ChatInfo, PickerModel } from './types';
import { useChatWords } from './use-chat-words';

export function QuotaMeter({
  info,
  model,
}: {
  info: ChatInfo | null;
  /** the model the next message goes to: its measured cost is what "analyses left" divides by */
  model: PickerModel | null;
}): ReactElement | null {
  const { tr, percent, count, inline } = useChatWords();
  if (info === null) return null;

  const label = (
    <span className="flex items-center gap-1 font-semibold text-foreground">
      <Zap
        className="h-3 w-3 text-purple-500 dark:text-purple-400"
        aria-hidden="true"
      />
      {tr('chat.quota.label')}
    </span>
  );

  if (!info.quota.configured) {
    return (
      <div
        data-testid="quota-meter"
        data-state="unconfigured"
        className="border-border/70 bg-muted/20 shrink-0 space-y-1 border-t px-3.5 py-2 text-[11px]"
      >
        {label}
        <p className="text-muted-foreground">{tr('chat.quota.unconfigured')}</p>
      </div>
    );
  }

  const share = shareLeft(info);
  if (share === null) {
    // configured, but the balance could not be read: an honest dash, not a made-up bar
    return (
      <div
        data-testid="quota-meter"
        data-state="unknown"
        className="border-border/70 bg-muted/20 shrink-0 space-y-1 border-t px-3.5 py-2 text-[11px]"
      >
        {label}
        <p className="text-muted-foreground">—</p>
      </div>
    );
  }

  const left = analysesLeft(info, model);
  const value = Math.round(share * 100);
  return (
    <div
      data-testid="quota-meter"
      data-state={share <= 0 ? 'empty' : 'ok'}
      className="border-border/70 bg-muted/20 shrink-0 space-y-1.5 border-t px-3.5 py-2 text-[11px]"
    >
      <div className="flex items-center justify-between gap-2 font-medium">
        {label}
        <span data-testid="quota-percent" className="font-bold text-foreground">
          {tr('chat.quota.left', { percent: inline(percent(share)) })}
        </span>
      </div>
      <div
        role="meter"
        aria-label={tr('chat.quota.label')}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        aria-valuetext={percent(share)}
        className="bg-muted/60 h-1.5 w-full overflow-hidden rounded-full"
      >
        <div
          data-testid="quota-bar"
          className={cn(
            'h-full rounded-full transition-all',
            share <= 0.1 ? 'bg-rose-500' : 'bg-purple-500 dark:bg-purple-400'
          )}
          style={{ width: `${value}%` }}
        />
      </div>
      <p data-testid="quota-analyses" className="text-muted-foreground">
        {share <= 0
          ? tr('chat.quota.empty')
          : left === null
            ? tr('chat.quota.not_measured')
            : tr('chat.quota.analyses', { count: inline(count(left)) })}
      </p>
    </div>
  );
}
